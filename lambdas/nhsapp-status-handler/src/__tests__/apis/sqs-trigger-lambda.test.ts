import { messageDownloadedEvent, nhsAppStatusEvent } from '__tests__/data';
import { createHandler } from 'apis/sqs-trigger-lambda';
import type { SQSEvent } from 'aws-lambda';
import {
  DigitalLetterRead,
  validateDigitalLetterRead,
} from 'digital-letters-events';
import { randomUUID } from 'node:crypto';

jest.mock('node:crypto', () => ({
  randomUUID: jest.fn(),
}));

const mockRandomUUID = randomUUID as jest.MockedFunction<typeof randomUUID>;
const mockDate = jest.spyOn(Date.prototype, 'toISOString');
mockRandomUUID.mockReturnValue('550e8400-e29b-41d4-a716-446655440001');
mockDate.mockReturnValue('2023-06-20T12:00:00.250Z');

describe('createHandler', () => {
  let ttlActions: any;
  let eventPublisher: any;
  let logger: any;
  let handler: any;

  const eventBusEvent = {
    detail: nhsAppStatusEvent,
  };

  const digitalLetterReadEvent: DigitalLetterRead = {
    ...messageDownloadedEvent,
    id: '550e8400-e29b-41d4-a716-446655440001',
    source: '/nhs/england/notify/production/primary/digitalletters/queue',
    type: 'uk.nhs.notify.digital.letters.queue.digital.letter.read.v1',
    time: '2023-06-20T12:00:00.250Z',
    recordedtime: '2023-06-20T12:00:00.250Z',
    dataschema:
      'https://notify.nhs.uk/cloudevents/schemas/digital-letters/2025-10-draft/data/digital-letters-queue-digital-letter-read-data.schema.json',
    data: {
      messageReference: messageDownloadedEvent.data.messageReference,
      senderId: messageDownloadedEvent.data.senderId,
    },
  };

  beforeEach(() => {
    ttlActions = { markWithdrawn: jest.fn() };
    eventPublisher = { sendEvents: jest.fn().mockResolvedValue([]) };
    logger = { error: jest.fn(), info: jest.fn(), warn: jest.fn() };
    handler = createHandler({ ttlActions, eventPublisher, logger });
  });

  it('processes a valid SQS event and returns success', async () => {
    ttlActions.markWithdrawn.mockResolvedValue({
      result: 'success',
      ttlItem: { event: messageDownloadedEvent },
    });
    const event: SQSEvent = {
      Records: [{ body: JSON.stringify(eventBusEvent), messageId: 'msg1' }],
    } as any;

    const res = await handler(event);

    expect(res.batchItemFailures).toEqual([]);
    expect(ttlActions.markWithdrawn).toHaveBeenCalledWith(nhsAppStatusEvent);
    expect(eventPublisher.sendEvents).toHaveBeenCalledWith(
      [digitalLetterReadEvent],
      validateDigitalLetterRead,
    );

    const publishedEvent = eventPublisher.sendEvents.mock.lastCall?.[0];
    expect(publishedEvent).toHaveLength(1);
    expect(() =>
      validateDigitalLetterRead(publishedEvent?.[0], logger),
    ).not.toThrow();

    expect(logger.info).toHaveBeenCalledWith({
      description: 'Processed SQS Event.',
      failed: 0,
      retrieved: 1,
      success: 1,
    });
  });

  it('handles event validation failure and logs error', async () => {
    const event: SQSEvent = {
      Records: [{ body: '{}', messageId: 'msg1' }],
    } as any;

    const res = await handler(event);

    expect(res.batchItemFailures).toEqual([{ itemIdentifier: 'msg1' }]);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        description: expect.stringContaining('Error parsing sqs record'),
        messageReference: 'not present',
      }),
    );
    expect(logger.info).toHaveBeenCalledWith({
      description: 'Processed SQS Event.',
      failed: 1,
      retrieved: 1,
      success: 0,
    });
  });

  it('handles event validation failure and logs error with message reference if present', async () => {
    const messageReference = randomUUID();
    const event: SQSEvent = {
      Records: [
        {
          body: `{ "detail": { "data": { "messageReference": "${messageReference}" } } }`,
          messageId: 'msg1',
        },
      ],
    } as any;

    const res = await handler(event);

    expect(res.batchItemFailures).toEqual([{ itemIdentifier: 'msg1' }]);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        description: expect.stringContaining('Error parsing sqs record'),
        messageReference,
      }),
    );
    expect(logger.info).toHaveBeenCalledWith({
      description: 'Processed SQS Event.',
      failed: 1,
      retrieved: 1,
      success: 0,
    });
  });

  it('handles ttlActions.markWithdrawn failure', async () => {
    ttlActions.markWithdrawn.mockResolvedValue({ result: 'failed' });
    const event: SQSEvent = {
      Records: [{ body: JSON.stringify(eventBusEvent), messageId: 'msg1' }],
    } as any;

    const res = await handler(event);

    expect(ttlActions.markWithdrawn).toHaveBeenCalledWith(nhsAppStatusEvent);
    expect(eventPublisher.sendEvents).not.toHaveBeenCalled();
    expect(res.batchItemFailures).toEqual([{ itemIdentifier: 'msg1' }]);
    expect(logger.info).toHaveBeenCalledWith({
      description: 'Processed SQS Event.',
      failed: 1,
      retrieved: 1,
      success: 0,
    });
  });

  it('handles thrown error and logs', async () => {
    const event: SQSEvent = {
      Records: [{ body: 'I am not json', messageId: 'msg1' }],
    } as any;

    const res = await handler(event);

    expect(res.batchItemFailures).toEqual([{ itemIdentifier: 'msg1' }]);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        description: expect.stringContaining(
          'Error during SQS trigger handler',
        ),
        err: expect.objectContaining({
          message: expect.stringContaining('is not valid JSON'),
        }),
      }),
    );
    expect(logger.info).toHaveBeenCalledWith({
      description: 'Processed SQS Event.',
      failed: 1,
      retrieved: 1,
      success: 0,
    });
  });

  it('handles rejected promises from event.Records.map', async () => {
    // Very unlikely that event.Records.map will reject as all the logic is inside a try/catch.

    const event = { Records: [] } as any;
    // Spy on Promise.allSettled to return a rejected result
    const originalAllSettled = Promise.allSettled;
    Promise.allSettled = jest
      .fn()
      .mockResolvedValue([
        { status: 'rejected', reason: new Error('forced rejection') },
      ]);

    await handler(event);

    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ err: expect.any(Error) }),
    );
    expect(logger.info).toHaveBeenCalledWith({
      description: 'Processed SQS Event.',
      failed: 1,
      retrieved: 1,
      success: 0,
    });

    Promise.allSettled = originalAllSettled;
  });

  it('processes multiple successful events and sends them as a batch', async () => {
    ttlActions.markWithdrawn.mockResolvedValue({
      result: 'success',
      ttlItem: { event: messageDownloadedEvent },
    });
    const sqsEvent: SQSEvent = {
      Records: [
        { body: JSON.stringify(eventBusEvent), messageId: 'msg1' },
        { body: JSON.stringify(eventBusEvent), messageId: 'msg2' },
        { body: JSON.stringify(eventBusEvent), messageId: 'msg3' },
      ],
    } as any;

    const res = await handler(sqsEvent);

    expect(res.batchItemFailures).toEqual([]);
    expect(ttlActions.markWithdrawn).toHaveBeenCalledTimes(3);
    expect(eventPublisher.sendEvents).toHaveBeenCalledWith(
      [digitalLetterReadEvent, digitalLetterReadEvent, digitalLetterReadEvent],
      validateDigitalLetterRead,
    );
    expect(logger.info).toHaveBeenCalledWith({
      description: 'Processed SQS Event.',
      failed: 0,
      retrieved: 3,
      success: 3,
    });
  });

  it('handles partial event publishing failures and logs warning', async () => {
    ttlActions.markWithdrawn.mockResolvedValue({
      result: 'success',
      ttlItem: { event: messageDownloadedEvent },
    });
    const failedEvents = [messageDownloadedEvent];
    eventPublisher.sendEvents.mockResolvedValue(failedEvents);

    const event: SQSEvent = {
      Records: [
        { body: JSON.stringify(eventBusEvent), messageId: 'msg1' },
        { body: JSON.stringify(eventBusEvent), messageId: 'msg2' },
      ],
    } as any;

    const res = await handler(event);

    expect(res.batchItemFailures).toEqual([]);
    expect(eventPublisher.sendEvents).toHaveBeenCalledWith(
      [digitalLetterReadEvent, digitalLetterReadEvent],
      validateDigitalLetterRead,
    );
    expect(logger.warn).toHaveBeenCalledWith({
      description: 'Some events failed to publish',
      failedCount: 1,
      totalAttempted: 2,
    });
  });

  it('handles event publishing exception and logs warning', async () => {
    ttlActions.markWithdrawn.mockResolvedValue({
      result: 'success',
      ttlItem: { event: messageDownloadedEvent },
    });
    const publishError = new Error('EventBridge error');
    eventPublisher.sendEvents.mockRejectedValue(publishError);

    const event: SQSEvent = {
      Records: [{ body: JSON.stringify(eventBusEvent), messageId: 'msg1' }],
    } as any;

    const res = await handler(event);

    expect(res.batchItemFailures).toEqual([]);
    expect(eventPublisher.sendEvents).toHaveBeenCalledWith(
      [digitalLetterReadEvent],
      validateDigitalLetterRead,
    );
    expect(logger.warn).toHaveBeenCalledWith({
      err: publishError,
      description: 'Failed to send events to EventBridge',
      eventCount: 1,
    });
  });

  it('does not call eventPublisher when no successful events', async () => {
    ttlActions.markWithdrawn.mockResolvedValue({ result: 'failed' });

    const event: SQSEvent = {
      Records: [{ body: JSON.stringify(eventBusEvent), messageId: 'msg1' }],
    } as any;

    const res = await handler(event);

    expect(res.batchItemFailures).toEqual([{ itemIdentifier: 'msg1' }]);
    expect(eventPublisher.sendEvents).not.toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledWith({
      description: 'Processed SQS Event.',
      failed: 1,
      retrieved: 1,
      success: 0,
    });
  });

  it('does not call eventPublisher when no TTL record is found', async () => {
    ttlActions.markWithdrawn.mockResolvedValue({ result: 'success' });

    const event: SQSEvent = {
      Records: [{ body: JSON.stringify(eventBusEvent), messageId: 'msg1' }],
    } as any;

    const res = await handler(event);

    expect(res.batchItemFailures).toEqual([]);
    expect(eventPublisher.sendEvents).not.toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledWith({
      description: 'Processed SQS Event.',
      failed: 0,
      retrieved: 1,
      success: 1,
    });
  });

  it('handles mixed success and failure scenarios', async () => {
    ttlActions.markWithdrawn
      .mockResolvedValueOnce({
        result: 'success',
        ttlItem: { event: messageDownloadedEvent },
      })
      .mockResolvedValueOnce({ result: 'failed' });

    const event: SQSEvent = {
      Records: [
        { body: JSON.stringify(eventBusEvent), messageId: 'msg1' },
        { body: '{}', messageId: 'msg2' },
        { body: JSON.stringify(eventBusEvent), messageId: 'msg3' },
      ],
    } as any;

    const res = await handler(event);

    expect(res.batchItemFailures).toEqual([
      { itemIdentifier: 'msg2' },
      { itemIdentifier: 'msg3' },
    ]);
    expect(eventPublisher.sendEvents).toHaveBeenCalledWith(
      [digitalLetterReadEvent],
      validateDigitalLetterRead,
    );
    expect(logger.info).toHaveBeenCalledWith({
      description: 'Processed SQS Event.',
      failed: 2,
      retrieved: 3,
      success: 1,
    });
  });
});
