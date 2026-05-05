import { randomUUID } from 'node:crypto';
import type { SQSEvent } from 'aws-lambda';
import type { EventPublisher, Logger } from 'utils';
import { createHandler } from 'apis/sqs-trigger-lambda';
import type { UploadToPdm } from 'app/upload-to-pdm';
import { mockEvent } from '__tests__/data';

jest.mock('node:crypto');

const mockRandomUUID = randomUUID as jest.MockedFunction<typeof randomUUID>;

const createValidSQSEvent = (overrides?: Partial<SQSEvent>): SQSEvent => ({
  Records: [
    {
      messageId: 'msg-1',
      body: JSON.stringify({
        detail: mockEvent,
      }),
      receiptHandle: 'receipt-1',
      attributes: {} as any,
      messageAttributes: {},
      md5OfBody: 'md5',
      eventSource: 'aws:sqs',
      eventSourceARN: 'arn:aws:sqs:region:account:queue',
      awsRegion: 'us-east-1',
    },
  ],
  ...overrides,
});

describe('sqs-trigger-lambda', () => {
  let mockUploadToPdm: jest.Mocked<UploadToPdm>;
  let mockEventPublisher: jest.Mocked<EventPublisher>;
  let mockLogger: jest.Mocked<Logger>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockRandomUUID.mockReturnValue('3a2e9238-11f9-41ed-98e4-e519eafb1167');

    mockUploadToPdm = {
      send: jest.fn(),
    } as unknown as jest.Mocked<UploadToPdm>;

    mockEventPublisher = {
      sendEvents: jest.fn().mockResolvedValue([]),
    } as unknown as jest.Mocked<EventPublisher>;

    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
    } as unknown as jest.Mocked<Logger>;
  });

  describe('successful processing', () => {
    it('should process single message successfully', async () => {
      mockUploadToPdm.send.mockResolvedValue({
        outcome: 'sent',
        resourceId: 'resource-123',
      });
      const handler = createHandler({
        uploadToPdm: mockUploadToPdm,
        eventPublisher: mockEventPublisher,
        logger: mockLogger,
      });
      const sqsEvent = createValidSQSEvent();

      const result = await handler(sqsEvent);

      expect(result.batchItemFailures).toEqual([]);
      expect(mockUploadToPdm.send).toHaveBeenCalledTimes(1);
      expect(mockEventPublisher.sendEvents).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            type: 'uk.nhs.notify.digital.letters.pdm.resource.submitted.v1',
            id: '3a2e9238-11f9-41ed-98e4-e519eafb1167',
          }),
        ]),
        expect.anything(),
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          description: 'Processed SQS Event.',
          retrieved: 1,
          sent: 1,
          failed: 0,
        }),
      );
    });

    it('should process multiple messages successfully', async () => {
      mockRandomUUID.mockReturnValueOnce(
        '11111111-1111-1111-1111-111111111111',
      );
      mockRandomUUID.mockReturnValueOnce(
        '22222222-2222-2222-2222-222222222222',
      );
      mockUploadToPdm.send.mockResolvedValue({
        outcome: 'sent',
        resourceId: 'resource-123',
      });
      const handler = createHandler({
        uploadToPdm: mockUploadToPdm,
        eventPublisher: mockEventPublisher,
        logger: mockLogger,
      });
      const sqsEvent = createValidSQSEvent({
        Records: [
          ...createValidSQSEvent().Records,
          {
            ...createValidSQSEvent().Records[0],
            messageId: 'msg-2',
          },
        ],
      });

      const result = await handler(sqsEvent);

      expect(result.batchItemFailures).toEqual([]);
      expect(mockUploadToPdm.send).toHaveBeenCalledTimes(2);
      expect(mockEventPublisher.sendEvents).toHaveBeenCalledTimes(1);
      expect(mockEventPublisher.sendEvents).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            type: 'uk.nhs.notify.digital.letters.pdm.resource.submitted.v1',
            id: '11111111-1111-1111-1111-111111111111',
          }),
          expect.objectContaining({
            type: 'uk.nhs.notify.digital.letters.pdm.resource.submitted.v1',
            id: '22222222-2222-2222-2222-222222222222',
          }),
        ]),
        expect.anything(),
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          retrieved: 2,
          sent: 2,
          failed: 0,
        }),
      );
    });
  });

  describe('failed processing', () => {
    it('should handle upload failure', async () => {
      mockUploadToPdm.send.mockResolvedValue({ outcome: 'failed' });
      const handler = createHandler({
        uploadToPdm: mockUploadToPdm,
        eventPublisher: mockEventPublisher,
        logger: mockLogger,
      });
      const sqsEvent = createValidSQSEvent();

      const result = await handler(sqsEvent);

      expect(result.batchItemFailures).toEqual([{ itemIdentifier: 'msg-1' }]);
      expect(mockEventPublisher.sendEvents).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            type: 'uk.nhs.notify.digital.letters.pdm.resource.submission.rejected.v1',
            data: expect.objectContaining({
              reasonCode: 'DL_PDMV_001',
            }),
          }),
        ]),
        expect.anything(),
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          retrieved: 1,
          sent: 0,
          failed: 1,
        }),
      );
    });

    it('should handle unexpected error in validateRecord', async () => {
      const handler = createHandler({
        uploadToPdm: mockUploadToPdm,
        eventPublisher: mockEventPublisher,
        logger: mockLogger,
      });
      const sqsEvent = createValidSQSEvent({
        Records: [
          {
            ...createValidSQSEvent().Records[0],
            body: 'I-am-not-json',
          },
        ],
      });

      const result = await handler(sqsEvent);

      expect(result.batchItemFailures).toEqual([{ itemIdentifier: 'msg-1' }]);
      expect(mockEventPublisher.sendEvents).not.toHaveBeenCalled();
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          description: 'Error parsing SQS record',
          err: expect.objectContaining({
            message: expect.stringContaining('Unexpected token'),
          }),
        }),
      );
    });

    it('should handle invalid message body', async () => {
      const handler = createHandler({
        uploadToPdm: mockUploadToPdm,
        eventPublisher: mockEventPublisher,
        logger: mockLogger,
      });
      const sqsEvent = createValidSQSEvent({
        Records: [
          {
            ...createValidSQSEvent().Records[0],
            body: '{"invalidKey":"invalidValue"}',
          },
        ],
      });

      const result = await handler(sqsEvent);

      expect(result.batchItemFailures).toEqual([{ itemIdentifier: 'msg-1' }]);
      expect(mockEventPublisher.sendEvents).not.toHaveBeenCalled();
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          description: 'Error parsing MESHInboxMessageDownloaded event',
        }),
      );
    });

    it('should handle exception during upload', async () => {
      mockUploadToPdm.send.mockRejectedValue(new Error('Upload error'));
      const handler = createHandler({
        uploadToPdm: mockUploadToPdm,
        eventPublisher: mockEventPublisher,
        logger: mockLogger,
      });
      const sqsEvent = createValidSQSEvent();

      const result = await handler(sqsEvent);

      expect(mockEventPublisher.sendEvents).not.toHaveBeenCalled();
      expect(result.batchItemFailures).toEqual([{ itemIdentifier: 'msg-1' }]);
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          description: 'Error during SQS trigger handler',
          err: expect.any(Error),
        }),
      );
    });

    it('should handle unhandled promise rejection in processing', async () => {
      // It's an unlikely scenario due to the try/catch in processRecord, but added for 100% coverage.
      // Mock logger.error to throw an error, which will cause processRecord to reject
      const loggerErrorSpy = jest.spyOn(mockLogger, 'error');
      let callCount = 0;
      loggerErrorSpy.mockImplementation((() => {
        callCount += 1;
        if (callCount === 1) {
          // First call from processRecord's catch block - throw to cause rejection
          throw new Error('Logger error causing unhandled rejection');
        }
        return mockLogger;
      }) as any);

      mockUploadToPdm.send.mockRejectedValue(new Error('Upload error'));
      const handler = createHandler({
        uploadToPdm: mockUploadToPdm,
        eventPublisher: mockEventPublisher,
        logger: mockLogger,
      });
      const sqsEvent = createValidSQSEvent();

      const result = await handler(sqsEvent);

      expect(result.batchItemFailures).toEqual([]);
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          err: expect.any(Error),
        }),
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          retrieved: 1,
          sent: 0,
          failed: 1,
        }),
      );
    });
  });

  describe('event publishing', () => {
    it('should handle partial event publishing failure for successful events', async () => {
      mockUploadToPdm.send.mockResolvedValue({
        outcome: 'sent',
        resourceId: 'resource-123',
      });
      mockEventPublisher.sendEvents.mockResolvedValue([
        { itemIdentifier: 'failed-event' },
      ] as any);
      const handler = createHandler({
        uploadToPdm: mockUploadToPdm,
        eventPublisher: mockEventPublisher,
        logger: mockLogger,
      });
      const sqsEvent = createValidSQSEvent();

      await handler(sqsEvent);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          description: 'Some successful events failed to publish',
          failedCount: 1,
          totalAttempted: 1,
        }),
      );
    });

    it('should handle event publishing exception for successful events', async () => {
      mockUploadToPdm.send.mockResolvedValue({
        outcome: 'sent',
        resourceId: 'resource-123',
      });
      mockEventPublisher.sendEvents.mockRejectedValue(
        new Error('EventBridge error'),
      );
      const handler = createHandler({
        uploadToPdm: mockUploadToPdm,
        eventPublisher: mockEventPublisher,
        logger: mockLogger,
      });
      const sqsEvent = createValidSQSEvent();

      await handler(sqsEvent);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          description: 'Failed to send successful events to EventBridge',
          eventCount: 1,
          err: expect.any(Error),
        }),
      );
    });

    it('should handle partial event publishing failure for failed events', async () => {
      mockUploadToPdm.send.mockResolvedValue({ outcome: 'failed' });
      mockEventPublisher.sendEvents.mockResolvedValue([
        { itemIdentifier: 'failed-event' },
      ] as any);
      const handler = createHandler({
        uploadToPdm: mockUploadToPdm,
        eventPublisher: mockEventPublisher,
        logger: mockLogger,
      });
      const sqsEvent = createValidSQSEvent();

      await handler(sqsEvent);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          description: 'Some failed events failed to publish',
          failedCount: 1,
          totalAttempted: 1,
        }),
      );
    });

    it('should handle event publishing exception for failed events', async () => {
      mockUploadToPdm.send.mockResolvedValue({ outcome: 'failed' });
      mockEventPublisher.sendEvents.mockRejectedValue(
        new Error('EventBridge error'),
      );
      const handler = createHandler({
        uploadToPdm: mockUploadToPdm,
        eventPublisher: mockEventPublisher,
        logger: mockLogger,
      });
      const sqsEvent = createValidSQSEvent();

      await handler(sqsEvent);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          description: 'Failed to send failed events to EventBridge',
          eventCount: 1,
          err: expect.any(Error),
        }),
      );
    });
  });

  describe('mixed outcomes', () => {
    it('should handle mix of successful and failed uploads', async () => {
      mockUploadToPdm.send
        .mockResolvedValueOnce({ outcome: 'sent', resourceId: 'resource-123' })
        .mockResolvedValueOnce({ outcome: 'failed' });
      const handler = createHandler({
        uploadToPdm: mockUploadToPdm,
        eventPublisher: mockEventPublisher,
        logger: mockLogger,
      });
      const sqsEvent = createValidSQSEvent({
        Records: [
          ...createValidSQSEvent().Records,
          {
            ...createValidSQSEvent().Records[0],
            messageId: 'msg-2',
          },
        ],
      });

      const result = await handler(sqsEvent);

      expect(result.batchItemFailures).toEqual([{ itemIdentifier: 'msg-2' }]);
      expect(mockEventPublisher.sendEvents).toHaveBeenCalledTimes(2);
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          retrieved: 2,
          sent: 1,
          failed: 1,
        }),
      );
    });
  });
});
