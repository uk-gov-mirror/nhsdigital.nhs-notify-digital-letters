import { messageDownloadedEvent } from '__tests__/data';
import { createHandler } from 'apis/sqs-trigger-lambda';
import type { SQSEvent } from 'aws-lambda';
import { ItemEnqueued, validateItemEnqueued } from 'digital-letters-events';
import { randomUUID } from 'node:crypto';

jest.mock('node:crypto', () => ({
  randomUUID: jest.fn(),
}));

const mockRandomUUID = randomUUID as jest.MockedFunction<typeof randomUUID>;
const mockDate = jest.spyOn(Date.prototype, 'toISOString');
mockRandomUUID.mockReturnValue('550e8400-e29b-41d4-a716-446655440001');
mockDate.mockReturnValue('2023-06-20T12:00:00.250Z');

describe('createHandler', () => {
  let createTtl: any;
  let eventPublisher: any;
  let logger: any;
  let handler: any;

  const eventBusEvent = {
    detail: messageDownloadedEvent,
  };

  const itemEnqueuedEvent: ItemEnqueued = {
    ...messageDownloadedEvent,
    id: '550e8400-e29b-41d4-a716-446655440001',
    source: '/nhs/england/notify/production/primary/digitalletters/queue',
    type: 'uk.nhs.notify.digital.letters.queue.item.enqueued.v1',
    time: '2023-06-20T12:00:00.250Z',
    recordedtime: '2023-06-20T12:00:00.250Z',
    dataschema:
      'https://notify.nhs.uk/cloudevents/schemas/digital-letters/2025-10-draft/data/digital-letters-queue-item-enqueued-data.schema.json',
    data: {
      messageReference: messageDownloadedEvent.data.messageReference,
      senderId: messageDownloadedEvent.data.senderId,
      messageUri: messageDownloadedEvent.data.messageUri,
    },
  };

  beforeEach(() => {
    createTtl = { send: jest.fn() };
    eventPublisher = { sendEvents: jest.fn().mockResolvedValue([]) };
    logger = { error: jest.fn(), info: jest.fn(), warn: jest.fn() };
    handler = createHandler({ createTtl, eventPublisher, logger });
  });

  it('processes a valid SQS event and returns success', async () => {
    createTtl.send.mockResolvedValue('sent');
    const event: SQSEvent = {
      Records: [{ body: JSON.stringify(eventBusEvent), messageId: 'msg1' }],
    } as any;

    const res = await handler(event);

    expect(res.batchItemFailures).toEqual([]);
    expect(createTtl.send).toHaveBeenCalledWith(messageDownloadedEvent);
    expect(eventPublisher.sendEvents).toHaveBeenCalledWith(
      [itemEnqueuedEvent],
      validateItemEnqueued,
    );

    const publishedEvent = eventPublisher.sendEvents.mock.lastCall?.[0];
    expect(publishedEvent).toHaveLength(1);
    expect(() =>
      validateItemEnqueued(publishedEvent?.[0], logger),
    ).not.toThrow();

    expect(logger.info).toHaveBeenCalledWith({
      description: 'Processed SQS Event.',
      failed: 0,
      retrieved: 1,
      sent: 1,
    });
  });

  it('handles parse failure and logs error', async () => {
    const event: SQSEvent = {
      Records: [{ body: '{}', messageId: 'msg2' }],
    } as any;

    const res = await handler(event);

    expect(res.batchItemFailures).toEqual([{ itemIdentifier: 'msg2' }]);
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        description: expect.stringContaining(
          'Error parsing MESHInboxMessageDownloaded event',
        ),
      }),
    );
    expect(logger.info).toHaveBeenCalledWith({
      description: 'Processed SQS Event.',
      failed: 1,
      retrieved: 1,
      sent: 0,
    });
  });

  it('handles createTtl.send failure', async () => {
    createTtl.send.mockResolvedValue('failed');
    const event: SQSEvent = {
      Records: [{ body: JSON.stringify(eventBusEvent), messageId: 'msg3' }],
    } as any;

    const res = await handler(event);

    expect(res.batchItemFailures).toEqual([{ itemIdentifier: 'msg3' }]);
    expect(logger.info).toHaveBeenCalledWith({
      description: 'Processed SQS Event.',
      failed: 1,
      retrieved: 1,
      sent: 0,
    });
  });

  it('handles thrown error and logs', async () => {
    createTtl.send.mockRejectedValue(new Error('TTL service error'));
    const event: SQSEvent = {
      Records: [{ body: JSON.stringify(eventBusEvent), messageId: 'msg4' }],
    } as any;

    const res = await handler(event);

    expect(res.batchItemFailures).toEqual([{ itemIdentifier: 'msg4' }]);
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        description: expect.stringContaining('SQS trigger handler'),
      }),
    );
    expect(logger.info).toHaveBeenCalledWith({
      description: 'Processed SQS Event.',
      failed: 1,
      retrieved: 1,
      sent: 0,
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

    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ err: expect.any(Error) }),
    );
    expect(logger.info).toHaveBeenCalledWith({
      description: 'Processed SQS Event.',
      failed: 1,
      retrieved: 1,
      sent: 0,
    });

    Promise.allSettled = originalAllSettled;
  });

  it('processes multiple successful events and sends them as a batch', async () => {
    createTtl.send.mockResolvedValue('sent');
    const sqsEvent: SQSEvent = {
      Records: [
        { body: JSON.stringify(eventBusEvent), messageId: 'msg1' },
        { body: JSON.stringify(eventBusEvent), messageId: 'msg2' },
        { body: JSON.stringify(eventBusEvent), messageId: 'msg3' },
      ],
    } as any;

    const res = await handler(sqsEvent);

    expect(res.batchItemFailures).toEqual([]);
    expect(createTtl.send).toHaveBeenCalledTimes(3);
    expect(eventPublisher.sendEvents).toHaveBeenCalledWith(
      [itemEnqueuedEvent, itemEnqueuedEvent, itemEnqueuedEvent],
      validateItemEnqueued,
    );
    expect(logger.info).toHaveBeenCalledWith({
      description: 'Processed SQS Event.',
      failed: 0,
      retrieved: 3,
      sent: 3,
    });
  });

  it('handles partial event publishing failures and logs warning', async () => {
    createTtl.send.mockResolvedValue('sent');
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
      [itemEnqueuedEvent, itemEnqueuedEvent],
      validateItemEnqueued,
    );
    expect(logger.warn).toHaveBeenCalledWith({
      description: 'Some events failed to publish',
      failedCount: 1,
      totalAttempted: 2,
    });
  });

  it('handles event publishing exception and logs warning', async () => {
    createTtl.send.mockResolvedValue('sent');
    const publishError = new Error('EventBridge error');
    eventPublisher.sendEvents.mockRejectedValue(publishError);

    const event: SQSEvent = {
      Records: [{ body: JSON.stringify(eventBusEvent), messageId: 'msg1' }],
    } as any;

    const res = await handler(event);

    expect(res.batchItemFailures).toEqual([]);
    expect(eventPublisher.sendEvents).toHaveBeenCalledWith(
      [itemEnqueuedEvent],
      validateItemEnqueued,
    );
    expect(logger.warn).toHaveBeenCalledWith({
      err: publishError,
      description: 'Failed to send events to EventBridge',
      eventCount: 1,
    });
  });

  it('does not call eventPublisher when no successful events', async () => {
    createTtl.send.mockResolvedValue('failed');

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
      sent: 0,
    });
  });

  it('handles mixed success and failure scenarios', async () => {
    createTtl.send
      .mockResolvedValueOnce('sent')
      .mockResolvedValueOnce('failed');

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
      [itemEnqueuedEvent],
      validateItemEnqueued,
    );
    expect(logger.info).toHaveBeenCalledWith({
      description: 'Processed SQS Event.',
      failed: 2,
      retrieved: 3,
      sent: 1,
    });
  });
});
