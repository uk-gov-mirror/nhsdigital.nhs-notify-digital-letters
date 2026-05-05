import { createHandler } from 'apis/sqs-handler';
import type { SQSEvent } from 'aws-lambda';
import { mockDeep } from 'jest-mock-extended';
import type { HandlerDependencies } from 'apis/sqs-handler';
import { FileScanner } from 'app/file-scanner';
import { EventPublisher, Logger } from 'utils';

const mockFileScanner = mockDeep<FileScanner>();
const mockEventPublisher = mockDeep<EventPublisher>();
const mockLogger = mockDeep<Logger>();

const createSQSEvent = (
  records: {
    messageId: string;
    body: string;
  }[],
): SQSEvent => ({
  Records: records.map((record) => ({
    messageId: record.messageId,
    receiptHandle: 'test-receipt-handle',
    body: record.body,
    attributes: {
      ApproximateReceiveCount: '1',
      SentTimestamp: '1',
      SenderId: 'test',
      ApproximateFirstReceiveTimestamp: '1',
    },
    messageAttributes: {},
    md5OfBody: 'test',
    eventSource: 'aws:sqs',
    eventSourceARN: 'arn:aws:sqs:us-east-1:123456789012:test-queue',
    awsRegion: 'us-east-1',
  })),
});

const createValidItemDequeuedBody = (
  messageReference: string,
  senderId: string,
  messageUri: string,
) =>
  JSON.stringify({
    detail: {
      specversion: '1.0',
      id: `event-${messageReference}`,
      plane: 'data',
      dataschemaversion: '1.0.0',
      source: '/nhs/england/notify/development/primary/digitalletters/queue',
      subject: `message/${messageReference}`,
      type: 'uk.nhs.notify.digital.letters.queue.item.dequeued.v1',
      time: '2026-01-19T12:00:00Z',
      recordedtime: '2026-01-19T12:00:00.100Z',
      datacontenttype: 'application/json',
      dataschema:
        'https://notify.nhs.uk/cloudevents/schemas/digital-letters/2025-10-draft/data/digital-letters-queue-item-dequeued-data.schema.json',
      traceparent: '00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01',
      severitynumber: 2,
      data: {
        messageReference,
        senderId,
        messageUri,
      },
    },
  });

describe('SQS Handler', () => {
  let handler: ReturnType<typeof createHandler>;
  let dependencies: HandlerDependencies;

  beforeEach(() => {
    jest.clearAllMocks();
    dependencies = {
      eventPublisher: mockEventPublisher,
      logger: mockLogger,
      fileScanner: mockFileScanner,
    };
    handler = createHandler(dependencies);
  });

  describe('successful processing', () => {
    it('should process valid ItemDequeued events successfully', async () => {
      mockFileScanner.scanFile.mockResolvedValue({ outcome: 'success' });

      const event = createSQSEvent([
        {
          messageId: 'msg-001',
          body: createValidItemDequeuedBody(
            'ref-001',
            'SENDER_001',
            's3://bucket/key',
          ),
        },
      ]);

      const response = await handler(event);

      expect(response.batchItemFailures).toEqual([]);
      expect(mockFileScanner.scanFile).toHaveBeenCalledWith('s3://bucket/key', {
        messageReference: 'ref-001',
        senderId: 'SENDER_001',
        createdAt: '2026-01-19T12:00:00Z',
      });

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          description: 'Starting file scanner batch',
          recordCount: 1,
        }),
      );

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          description: 'Processing ItemDequeued event',
          messageReference: 'ref-001',
          senderId: 'SENDER_001',
        }),
      );

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          description: 'Completed file scanner batch',
          successCount: 1,
          failureCount: 0,
        }),
      );
    });

    it('should process multiple valid events in batch', async () => {
      mockFileScanner.scanFile.mockResolvedValue({ outcome: 'success' });

      const event = createSQSEvent([
        {
          messageId: 'msg-001',
          body: createValidItemDequeuedBody(
            'ref-001',
            'SENDER_001',
            's3://bucket/key1',
          ),
        },
        {
          messageId: 'msg-002',
          body: createValidItemDequeuedBody(
            'ref-002',
            'SENDER_002',
            's3://bucket/key2',
          ),
        },
        {
          messageId: 'msg-003',
          body: createValidItemDequeuedBody(
            'ref-003',
            'SENDER_003',
            's3://bucket/key3',
          ),
        },
      ]);

      const response = await handler(event);

      expect(response.batchItemFailures).toEqual([]);
      expect(mockFileScanner.scanFile).toHaveBeenCalledTimes(3);
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          description: 'Completed file scanner batch',
          successCount: 3,
          failureCount: 0,
        }),
      );
    });
  });

  describe('failure handling', () => {
    it('should return failed message when file scanner fails', async () => {
      mockFileScanner.scanFile.mockResolvedValue({
        outcome: 'failed',
        errorMessage: 'PDF extraction failed',
      });

      const event = createSQSEvent([
        {
          messageId: 'msg-001',
          body: createValidItemDequeuedBody(
            'ref-001',
            'SENDER_001',
            's3://bucket/key',
          ),
        },
      ]);

      const response = await handler(event);

      expect(response.batchItemFailures).toEqual([
        { itemIdentifier: 'msg-001' },
      ]);

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          description: 'Error processing record',
          messageId: 'msg-001',
        }),
      );

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          description: 'Completed file scanner batch',
          successCount: 0,
          failureCount: 1,
        }),
      );
    });

    it('should handle partial batch failures', async () => {
      mockFileScanner.scanFile
        .mockResolvedValueOnce({ outcome: 'success' })
        .mockResolvedValueOnce({
          outcome: 'failed',
          errorMessage: 'Error',
        })
        .mockResolvedValueOnce({ outcome: 'success' });

      const event = createSQSEvent([
        {
          messageId: 'msg-001',
          body: createValidItemDequeuedBody(
            'ref-001',
            'SENDER_001',
            's3://bucket/key1',
          ),
        },
        {
          messageId: 'msg-002',
          body: createValidItemDequeuedBody(
            'ref-002',
            'SENDER_002',
            's3://bucket/key2',
          ),
        },
        {
          messageId: 'msg-003',
          body: createValidItemDequeuedBody(
            'ref-003',
            'SENDER_003',
            's3://bucket/key3',
          ),
        },
      ]);

      const response = await handler(event);

      expect(response.batchItemFailures).toEqual([
        { itemIdentifier: 'msg-002' },
      ]);

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          description: 'Completed file scanner batch',
          successCount: 2,
          failureCount: 1,
        }),
      );
    });

    it('should handle fileScanner throwing exception', async () => {
      mockFileScanner.scanFile.mockRejectedValue(new Error('Unexpected error'));

      const event = createSQSEvent([
        {
          messageId: 'msg-001',
          body: createValidItemDequeuedBody(
            'ref-001',
            'SENDER_001',
            's3://bucket/key',
          ),
        },
      ]);

      const response = await handler(event);

      expect(response.batchItemFailures).toEqual([
        { itemIdentifier: 'msg-001' },
      ]);
    });

    it('should handle fileScanner throwing non-Error object', async () => {
      mockFileScanner.scanFile.mockRejectedValue('string error');

      const event = createSQSEvent([
        {
          messageId: 'msg-002',
          body: createValidItemDequeuedBody(
            'ref-002',
            'SENDER_002',
            's3://bucket/key2',
          ),
        },
      ]);

      const response = await handler(event);

      expect(response.batchItemFailures).toEqual([
        { itemIdentifier: 'msg-002' },
      ]);

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          description: 'Error processing record',
          err: 'string error',
          messageId: 'msg-002',
        }),
      );
    });
  });

  describe('validation errors', () => {
    it('should skip invalid event type', async () => {
      const invalidEvent = createSQSEvent([
        {
          messageId: 'msg-001',
          body: JSON.stringify({
            detail: {
              specversion: '1.0',
              id: 'event-001',
              source:
                '/nhs/england/notify/development/primary/digitalletters/queue',
              type: 'uk.nhs.notify.wrong.event.type.v1',
              time: '2026-01-19T12:00:00Z',
              data: {
                messageReference: 'ref-001',
                senderId: 'SENDER_001',
                messageUri: 's3://bucket/key',
              },
            },
          }),
        },
      ]);

      const response = await handler(invalidEvent);

      expect(response.batchItemFailures).toEqual([
        { itemIdentifier: 'msg-001' },
      ]);
      expect(mockFileScanner.scanFile).not.toHaveBeenCalled();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          description: 'Invalid record will be retried',
        }),
      );
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          description: 'Error parsing SQS record',
        }),
      );
    });

    it('should skip malformed JSON', async () => {
      const event = createSQSEvent([
        {
          messageId: 'msg-001',
          body: 'invalid json {',
        },
      ]);

      const response = await handler(event);

      expect(response.batchItemFailures).toEqual([
        { itemIdentifier: 'msg-001' },
      ]);
      expect(mockFileScanner.scanFile).not.toHaveBeenCalled();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          description: 'Error parsing SQS record',
        }),
      );
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          description: 'Invalid record will be retried',
          messageId: 'msg-001',
        }),
      );
    });

    it('should skip events with missing required fields', async () => {
      const invalidEvent = createSQSEvent([
        {
          messageId: 'msg-001',
          body: JSON.stringify({
            detail: {
              specversion: '1.0',
              id: 'event-001',
              source:
                '/nhs/england/notify/development/primary/digitalletters/queue',
              type: 'uk.nhs.notify.digital.letters.queue.item.dequeued.v1',
              time: '2026-01-19T12:00:00Z',
              data: {
                // Missing messageReference, senderId, messageUri
              },
            },
          }),
        },
      ]);

      const response = await handler(invalidEvent);

      expect(response.batchItemFailures).toEqual([
        { itemIdentifier: 'msg-001' },
      ]);
      expect(mockFileScanner.scanFile).not.toHaveBeenCalled();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          description: 'Error parsing SQS record',
        }),
      );
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          description: 'Invalid record will be retried',
          messageId: 'msg-001',
        }),
      );
    });

    it('should process valid events and skip invalid ones in same batch', async () => {
      mockFileScanner.scanFile.mockResolvedValue({ outcome: 'success' });

      const event = createSQSEvent([
        {
          messageId: 'msg-001',
          body: createValidItemDequeuedBody(
            'ref-001',
            'SENDER_001',
            's3://bucket/key1',
          ),
        },
        {
          messageId: 'msg-002',
          body: 'invalid json',
        },
        {
          messageId: 'msg-003',
          body: createValidItemDequeuedBody(
            'ref-003',
            'SENDER_003',
            's3://bucket/key3',
          ),
        },
      ]);

      const response = await handler(event);

      expect(response.batchItemFailures).toEqual([
        { itemIdentifier: 'msg-002' },
      ]);
      expect(mockFileScanner.scanFile).toHaveBeenCalledTimes(2);
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          description: 'Completed file scanner batch',
          successCount: 2,
          failureCount: 1,
        }),
      );
    });
  });

  describe('empty batch handling', () => {
    it('should handle empty records array', async () => {
      const event = createSQSEvent([]);

      const response = await handler(event);

      expect(response.batchItemFailures).toEqual([]);
      expect(mockFileScanner.scanFile).not.toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          description: 'Starting file scanner batch',
          recordCount: 0,
        }),
      );
    });

    it('should handle batch with all invalid records', async () => {
      const event = createSQSEvent([
        {
          messageId: 'msg-001',
          body: 'invalid',
        },
        {
          messageId: 'msg-002',
          body: 'also invalid',
        },
      ]);

      const response = await handler(event);

      expect(response.batchItemFailures).toEqual([
        { itemIdentifier: 'msg-001' },
        { itemIdentifier: 'msg-002' },
      ]);
      expect(mockFileScanner.scanFile).not.toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          description: 'Completed file scanner batch',
          successCount: 0,
          failureCount: 2,
        }),
      );
    });
  });
});
