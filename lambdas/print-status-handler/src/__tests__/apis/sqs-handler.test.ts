import { mock } from 'jest-mock-extended';
import { randomUUID } from 'node:crypto';
import { createHandler } from 'apis/sqs-handler';
import { EventPublisher, Logger } from 'utils';
import {
  acceptedLetterEvent,
  failedLetterEvent,
  recordEvent,
} from '__tests__/test-data';

const logger = mock<Logger>();
const eventPublisher = mock<EventPublisher>();

jest.mock('node:crypto', () => ({
  randomUUID: jest.fn(),
}));

const mockRandomUUID = randomUUID as jest.MockedFunction<typeof randomUUID>;
const mockDate = jest.spyOn(Date.prototype, 'toISOString');
mockRandomUUID.mockReturnValue('550e8400-e29b-41d4-a716-446655440001');
mockDate.mockReturnValue('2023-06-20T12:00:00.250Z');

const handler = createHandler({
  eventPublisher,
  logger,
});

describe('SQS Handler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('letter status transitions', () => {
    it('should send print.letter.transitioned event when letter.ACCEPTED received', async () => {
      const response = await handler(recordEvent([acceptedLetterEvent]));

      expect(eventPublisher.sendEvents).toHaveBeenCalledWith(
        [
          {
            ...acceptedLetterEvent,
            id: '550e8400-e29b-41d4-a716-446655440001',
            time: '2023-06-20T12:00:00.250Z',
            recordedtime: '2023-06-20T12:00:00.250Z',
            plane: 'data',
            dataschema:
              'https://notify.nhs.uk/cloudevents/schemas/digital-letters/2025-10-draft/data/digital-letters-print-letter-transitioned-data.schema.json',
            type: 'uk.nhs.notify.digital.letters.print.letter.transitioned.v1',
            source:
              '/nhs/england/notify/production/primary/digitalletters/print',
            subject:
              'client/f47ac10b-58cc-4372-a567-0e02b2c3d479/letter-request/2503cbd5-6722-4e90-9fbd-5f1e96d65c22',
            dataschemaversion: '1.0.0',
            data: {
              senderId: acceptedLetterEvent.data.origin.subject.split('/')[1],
              messageReference:
                acceptedLetterEvent.data.origin.subject.split('/')[3],
              specificationId: acceptedLetterEvent.data.specificationId,
              status: acceptedLetterEvent.data.status,
              supplierId: acceptedLetterEvent.data.supplierId,
              time: acceptedLetterEvent.time,
            },
          },
        ],
        expect.any(Function),
      );
      expect(logger.info).toHaveBeenCalledWith(
        'Received SQS Event of 1 record(s)',
      );
      expect(logger.info).toHaveBeenCalledWith(
        '1 of 1 records processed successfully',
      );
      expect(response).toEqual({ batchItemFailures: [] });
    });

    it('should include reasonCode and reasonText when provided in letter.FAILED event', async () => {
      const response = await handler(recordEvent([failedLetterEvent]));

      expect(eventPublisher.sendEvents).toHaveBeenCalledWith(
        [
          {
            ...failedLetterEvent,
            id: '550e8400-e29b-41d4-a716-446655440001',
            time: '2023-06-20T12:00:00.250Z',
            recordedtime: '2023-06-20T12:00:00.250Z',
            dataschema:
              'https://notify.nhs.uk/cloudevents/schemas/digital-letters/2025-10-draft/data/digital-letters-print-letter-transitioned-data.schema.json',
            type: 'uk.nhs.notify.digital.letters.print.letter.transitioned.v1',
            source:
              '/nhs/england/notify/production/primary/digitalletters/print',
            subject:
              'client/f47ac10b-58cc-4372-a567-0e02b2c3d480/letter-request/2503cbd5-6722-4e90-9fbd-5f1e96d65c22',
            dataschemaversion: '1.0.0',
            data: {
              senderId: failedLetterEvent.data.origin.subject.split('/')[1],
              messageReference:
                failedLetterEvent.data.origin.subject.split('/')[3],
              specificationId: failedLetterEvent.data.specificationId,
              status: failedLetterEvent.data.status,
              supplierId: failedLetterEvent.data.supplierId,
              time: failedLetterEvent.time,
              reasonCode: 'FAILURE001',
              reasonText: 'Letter has too many pages',
            },
          },
        ],
        expect.any(Function),
      );
      expect(logger.info).toHaveBeenCalledWith(
        'Received SQS Event of 1 record(s)',
      );
      expect(logger.info).toHaveBeenCalledWith(
        '1 of 1 records processed successfully',
      );
      expect(response).toEqual({ batchItemFailures: [] });
    });

    it('should not include reasonCode when only reasonText is provided', async () => {
      const eventWithReasonTextOnly = {
        ...failedLetterEvent,
        data: {
          ...failedLetterEvent.data,
          reasonCode: undefined,
          reasonText: 'Letter has too many pages',
        },
      };

      const response = await handler(recordEvent([eventWithReasonTextOnly]));

      const publishedEvent = (eventPublisher.sendEvents as jest.Mock).mock
        .calls[0][0][0];

      expect(publishedEvent.data).not.toHaveProperty('reasonCode');
      expect(publishedEvent.data.reasonText).toBe('Letter has too many pages');
      expect(response).toEqual({ batchItemFailures: [] });
    });

    it('should not include reasonText when only reasonCode is provided', async () => {
      const eventWithReasonCodeOnly = {
        ...failedLetterEvent,
        data: {
          ...failedLetterEvent.data,
          reasonCode: 'FAILURE001',
          reasonText: undefined,
        },
      };

      const response = await handler(recordEvent([eventWithReasonCodeOnly]));

      const publishedEvent = (eventPublisher.sendEvents as jest.Mock).mock
        .calls[0][0][0];

      expect(publishedEvent.data.reasonCode).toBe('FAILURE001');
      expect(publishedEvent.data).not.toHaveProperty('reasonText');
      expect(response).toEqual({ batchItemFailures: [] });
    });
  });

  describe('errors', () => {
    it('should return failed SQS records to the queue if an error occurs while processing them', async () => {
      const event = recordEvent([acceptedLetterEvent]);
      event.Records[0].body = 'not-json';

      const result = await handler(event);

      expect(logger.warn).toHaveBeenCalledWith({
        err: new SyntaxError(
          `Unexpected token 'o', "not-json" is not valid JSON`,
        ),
        description: 'Error parsing SQS record',
      });

      expect(logger.info).toHaveBeenCalledWith(
        '0 of 1 records processed successfully',
      );

      expect(result).toEqual({
        batchItemFailures: [{ itemIdentifier: '1' }],
      });
    });

    it('should return failed items to the queue if an invalid letter.ACCEPTED event is received', async () => {
      const invalidAcceptedLetterEvent = {
        ...acceptedLetterEvent,
        source: 'invalid letter.ACCEPTED source',
      };
      const event = recordEvent([invalidAcceptedLetterEvent]);

      const result = await handler(event);

      expect(logger.warn).toHaveBeenCalledWith({
        err: expect.objectContaining({
          issues: expect.arrayContaining([
            expect.objectContaining({
              path: ['source'],
            }),
          ]),
        }),
        description: 'Error parsing queue item',
      });

      expect(logger.info).toHaveBeenCalledWith(
        '0 of 1 records processed successfully',
      );

      expect(result).toEqual({
        batchItemFailures: [{ itemIdentifier: '1' }],
      });
    });

    it('should return failed items to the queue if an invalid origin.subject event is received', async () => {
      const invalidAcceptedLetterEvent = {
        ...acceptedLetterEvent,
        data: {
          ...acceptedLetterEvent.data,
          origin: {
            ...acceptedLetterEvent.data.origin,
            subject: 'invalid origin.subject',
          },
        },
      };
      const event = recordEvent([invalidAcceptedLetterEvent]);

      const result = await handler(event);

      expect(logger.warn).toHaveBeenCalledWith({
        err: expect.objectContaining({
          issues: expect.arrayContaining([
            expect.objectContaining({
              message:
                'Subject must be in format: client/{senderId}/letter-request/{messageReference}',
            }),
          ]),
        }),
        description: 'Invalid origin.subject format',
      });

      expect(logger.info).toHaveBeenCalledWith(
        '0 of 1 records processed successfully',
      );

      expect(result).toEqual({
        batchItemFailures: [{ itemIdentifier: '1' }],
      });
    });

    it('should return failed items to the queue if event transformation fails', async () => {
      mockRandomUUID.mockImplementationOnce(() => {
        throw new Error('A forced error scenario');
      });

      const event = recordEvent([acceptedLetterEvent]);
      const result = await handler(event);

      expect(logger.warn).toHaveBeenCalledWith({
        err: 'A forced error scenario',
        description: 'Failed processing message',
      });

      expect(logger.info).toHaveBeenCalledWith(
        '0 of 1 records processed successfully',
      );

      expect(result).toEqual({
        batchItemFailures: [{ itemIdentifier: '1' }],
      });
    });
  });
});
