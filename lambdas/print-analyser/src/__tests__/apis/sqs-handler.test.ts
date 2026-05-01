import { mock } from 'jest-mock-extended';
import { randomUUID } from 'node:crypto';
import { createHandler } from 'apis/sqs-handler';
import { EventPublisher, Logger } from 'utils';
import { fileSafeEvent, fivePagePdf, recordEvent } from '__tests__/test-data';
import { FileSafe } from 'digital-letters-events';

const logger = mock<Logger>();
const mockChildLogger = mock<Logger>();
logger.child.mockReturnValue(mockChildLogger);
const eventPublisher = mock<EventPublisher>();

jest.mock('node:crypto', () => ({
  ...jest.requireActual('node:crypto'),
  randomUUID: jest.fn(),
}));

const mockGetS3ObjectBufferFromUri = jest.fn();
jest.mock('utils', () => ({
  ...jest.requireActual('utils'),
  getS3ObjectBufferFromUri: (...args: any[]) =>
    mockGetS3ObjectBufferFromUri(...args),
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

  describe('file safe', () => {
    it('should send pdf.analysed event when file.safe received', async () => {
      const testPdf = fivePagePdf();
      mockGetS3ObjectBufferFromUri.mockResolvedValue(testPdf);

      eventPublisher.sendEvents.mockImplementation(
        async (events, validateFn) => {
          for (const event of events) {
            validateFn(event, logger);
          }
          return [];
        },
      );

      const response = await handler(recordEvent([fileSafeEvent]));

      expect(mockGetS3ObjectBufferFromUri).toHaveBeenCalledWith(
        fileSafeEvent.data.letterUri,
      );
      expect(eventPublisher.sendEvents).toHaveBeenCalledWith(
        [
          {
            ...fileSafeEvent,
            id: '550e8400-e29b-41d4-a716-446655440001',
            time: '2023-06-20T12:00:00.250Z',
            recordedtime: '2023-06-20T12:00:00.250Z',
            dataschema:
              'https://notify.nhs.uk/cloudevents/schemas/digital-letters/2025-10-draft/data/digital-letters-print-pdf-analysed-data.schema.json',
            type: 'uk.nhs.notify.digital.letters.print.pdf.analysed.v1',
            source:
              '/nhs/england/notify/production/primary/digitalletters/print',
            data: {
              senderId: fileSafeEvent.data.senderId,
              messageReference: fileSafeEvent.data.messageReference,
              letterUri: fileSafeEvent.data.letterUri,
              pageCount: 5,
              sha256Hash:
                '631b6ef1a936e62277d55a80deb850babdde861152d476489d75b0c9161bd326',
              createdAt: fileSafeEvent.data.createdAt,
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
  });

  describe('errors', () => {
    it('should return failed SQS records to the queue if an error occurs while processing them', async () => {
      const event = recordEvent([fileSafeEvent]);
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

    it('should return failed items to the queue if a mildly invalid file.safe event is received', async () => {
      const invalidFileSafeEvent = {
        ...fileSafeEvent,
        source: 'invalid file.safe source',
      };
      const event = recordEvent([invalidFileSafeEvent]);

      const result = await handler(event);

      expect(logger.child).toHaveBeenCalledWith({
        messageReference: fileSafeEvent.data.messageReference,
      });
      expect(mockChildLogger.error).toHaveBeenCalledWith({
        err: expect.arrayContaining([
          expect.objectContaining({
            instancePath: '/source',
          }),
        ]),
        description: 'Error parsing FileSafe event',
      });

      expect(logger.info).toHaveBeenCalledWith(
        '0 of 1 records processed successfully',
      );

      expect(result).toEqual({
        batchItemFailures: [{ itemIdentifier: '1' }],
      });
    });

    it('should return failed items to the queue if a very invalid file.safe event is received', async () => {
      const invalidFileSafeEvent = {} as FileSafe;
      const event = recordEvent([invalidFileSafeEvent]);

      const result = await handler(event);

      expect(mockChildLogger.error).toHaveBeenCalledWith({
        err: expect.arrayContaining([
          expect.objectContaining({
            message: `must have required property 'specversion'`,
          }),
        ]),
        description: 'Error parsing FileSafe event',
      });

      expect(logger.info).toHaveBeenCalledWith(
        '0 of 1 records processed successfully',
      );

      expect(result).toEqual({
        batchItemFailures: [{ itemIdentifier: '1' }],
      });
    });

    it('should return failed items to the queue if PDF analysis fails', async () => {
      mockGetS3ObjectBufferFromUri.mockRejectedValue(
        new Error('S3 GetObject failed'),
      );

      const event = recordEvent([fileSafeEvent]);

      const result = await handler(event);

      expect(logger.warn).toHaveBeenCalledWith({
        err: expect.objectContaining({ message: 'S3 GetObject failed' }),
        description: 'Failed processing message',
      });

      expect(logger.info).toHaveBeenCalledWith(
        '0 of 1 records processed successfully',
      );

      expect(result).toEqual({
        batchItemFailures: [{ itemIdentifier: '1' }],
      });
    });

    it('should publish InvalidAttachmentReceived event when PDF parsing fails (non-PDF attachment)', async () => {
      const testPdfBuffer = Buffer.from('not a valid PDF file');
      mockGetS3ObjectBufferFromUri.mockResolvedValue(testPdfBuffer);

      eventPublisher.sendEvents.mockImplementation(
        async (events, validateFn) => {
          for (const event of events) {
            validateFn(event, logger);
          }
          return [];
        },
      );

      const event = recordEvent([fileSafeEvent]);

      const result = await handler(event);

      expect(eventPublisher.sendEvents).toHaveBeenCalledWith(
        [
          {
            ...fileSafeEvent,
            id: '550e8400-e29b-41d4-a716-446655440001',
            time: '2023-06-20T12:00:00.250Z',
            recordedtime: '2023-06-20T12:00:00.250Z',
            dataschema:
              'https://notify.nhs.uk/cloudevents/schemas/digital-letters/2025-10-draft/data/digital-letters-print-invalid-attachment-received-data.schema.json',
            type: 'uk.nhs.notify.digital.letters.print.invalid.attachment.received.v1',
            source:
              '/nhs/england/notify/production/primary/digitalletters/print',
            data: {
              senderId: fileSafeEvent.data.senderId,
              messageReference: fileSafeEvent.data.messageReference,
              reasonCode: 'DL_CLIV_002',
            },
          },
        ],
        expect.any(Function),
      );

      expect(logger.warn).toHaveBeenCalledWith({
        err: expect.any(Error),
        messageReference: fileSafeEvent.data.messageReference,
        reasonCode: 'DL_CLIV_002',
        description: 'Failed to analyze PDF - invalid attachment format',
      });

      expect(logger.info).toHaveBeenCalledWith(
        '1 of 1 records processed successfully',
      );

      expect(result).toEqual({ batchItemFailures: [] });
    });

    it('should throw error for unknown event type during validation', async () => {
      const testPdf = fivePagePdf();
      mockGetS3ObjectBufferFromUri.mockResolvedValue(testPdf);

      eventPublisher.sendEvents.mockImplementation(
        async (events, validateFn) => {
          const modifiedEvent = {
            ...events[0],
            type: 'uk.nhs.notify.unknown.event.type',
          };
          validateFn(modifiedEvent, logger);
          return [];
        },
      );

      const event = recordEvent([fileSafeEvent]);

      await expect(handler(event)).rejects.toThrow(
        'Unknown event type: uk.nhs.notify.unknown.event.type',
      );
    });
  });
});
