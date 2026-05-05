import type { SQSEvent, SQSRecord } from 'aws-lambda';
import { mock } from 'jest-mock-extended';
import { SqsHandlerDependencies, createHandler } from 'apis/sqs-handler';
import { EventPublisher, Logger } from 'utils';
import { MoveFileHandler } from 'app/move-file-handler';
import { parseSqsRecord } from 'app/parse-sqs-message';
import { FileQuarantined, FileSafe } from 'digital-letters-events';
import {
  guardDutyNoThreadsFoundEvent,
  guardDutyThreadsFoundEvent,
} from '__tests__/constants';

jest.mock('app/parse-sqs-message');

const createSqsEvent = (recordCount: number): SQSEvent => ({
  Records: Array.from(
    { length: recordCount },
    (_, i): SQSRecord => ({
      messageId: `message-id-${i + 1}`,
      receiptHandle: `receipt-handle-${i + 1}`,
      body: JSON.stringify({
        detail: guardDutyNoThreadsFoundEvent,
      }),
      attributes: {
        ApproximateReceiveCount: '1',
        SentTimestamp: '1234567890',
        SenderId: 'sender-id',
        ApproximateFirstReceiveTimestamp: '1234567890',
      },
      messageAttributes: {},
      md5OfBody: 'md5',
      eventSource: 'aws:sqs',
      eventSourceARN: 'arn:aws:sqs:region:account:queue',
      awsRegion: 'eu-west-2',
    }),
  ),
});

describe('sqs-handler', () => {
  const mockLogger = mock<Logger>();
  const mockEventPublisher = mock<EventPublisher>();
  const mockMoveFileHandler = mock<MoveFileHandler>();
  const mockParseSqsRecord = jest.mocked(parseSqsRecord);

  const dependencies: SqsHandlerDependencies = {
    logger: mockLogger,
    eventPublisher: mockEventPublisher,
    moveFileHandler: mockMoveFileHandler,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createHandler', () => {
    it('creates a handler function', () => {
      const handler = createHandler(dependencies);
      expect(typeof handler).toBe('function');
    });

    it('processes a single SQS record successfully', async () => {
      const sqsEvent = createSqsEvent(1);
      const handler = createHandler(dependencies);

      mockParseSqsRecord.mockReturnValue(guardDutyNoThreadsFoundEvent.detail);
      mockMoveFileHandler.handle.mockResolvedValue({
        fileSafe: {
          specversion: '1.0',
          id: 'test-id',
          source: '/test',
          plane: 'data',
          dataschemaversion: '1.0.0',
          datacontenttype: 'application/json',
          dataschema:
            'https://notify.nhs.uk/cloudevents/schemas/digital-letters/2025-10-draft/data/digital-letters-print-file-safe-data.schema.json',
          type: 'uk.nhs.notify.digital.letters.print.file.safe.v1',
          time: '2024-01-01T00:00:00Z',
          data: {
            messageReference: 'msg-ref',
            senderId: 'sender-id',
            letterUri: 'https://bucket/key',
            createdAt: '2024-01-01T00:00:00Z',
          },
          subject: 'test-subject',
          traceparent: 'test-traceparent',
          recordedtime: '2024-01-01T00:00:00Z',
          severitynumber: 2,
        },
      });

      const result = await handler(sqsEvent);

      expect(mockLogger.info).toHaveBeenCalledWith({
        description: 'Received SQS Event of 1 record(s)',
      });
      expect(mockParseSqsRecord).toHaveBeenCalledWith(
        sqsEvent.Records[0],
        mockLogger,
      );
      expect(mockMoveFileHandler.handle).toHaveBeenCalledWith(
        guardDutyNoThreadsFoundEvent.detail,
      );
      expect(mockEventPublisher.sendEvents).toHaveBeenCalledTimes(1);
      expect(result).toEqual({ batchItemFailures: [] });
    });

    it('publishes both FileSafe and FileQuarantined events from multiple records', async () => {
      const sqsEvent = createSqsEvent(2);
      const handler = createHandler(dependencies);

      const mockFileSafeEvent: FileSafe = {
        specversion: '1.0',
        id: 'test-id-1',
        source: '/test',
        plane: 'data',
        dataschema:
          'https://notify.nhs.uk/cloudevents/schemas/digital-letters/2025-10-draft/data/digital-letters-print-file-safe-data.schema.json',
        dataschemaversion: '1.0.0',
        datacontenttype: 'application/json',
        type: 'uk.nhs.notify.digital.letters.print.file.safe.v1',
        time: '2024-01-01T00:00:00Z',
        data: {
          messageReference: 'msg-ref-1',
          senderId: 'sender-id-1',
          letterUri: 'https://bucket/key1',
          createdAt: '2024-01-01T00:00:00Z',
        },
        subject: 'test-subject',
        traceparent: 'test-traceparent',
        recordedtime: '2024-01-01T00:00:00Z',
        severitynumber: 2,
      };

      const mockFileQuarantinedEvent: FileQuarantined = {
        specversion: '1.0',
        id: 'test-id-2',
        source: '/test',
        plane: 'data',
        dataschema:
          'https://notify.nhs.uk/cloudevents/schemas/digital-letters/2025-10-draft/data/digital-letters-print-file-quarantined-data.schema.json',
        dataschemaversion: '1.0.0',
        datacontenttype: 'application/json',
        type: 'uk.nhs.notify.digital.letters.print.file.quarantined.v1',
        time: '2024-01-01T00:00:00Z',
        data: {
          messageReference: 'msg-ref-2',
          senderId: 'sender-id-2',
          letterUri: 'https://bucket/key2',
          createdAt: '2024-01-01T00:00:00Z',
          reasonCode: 'DL_CLIV_003',
        },
        subject: 'test-subject',
        traceparent: 'test-traceparent',
        recordedtime: '2024-01-01T00:00:00Z',
        severitynumber: 2,
      };

      mockParseSqsRecord
        .mockReturnValueOnce(guardDutyNoThreadsFoundEvent.detail)
        .mockReturnValueOnce(guardDutyThreadsFoundEvent.detail);
      mockMoveFileHandler.handle
        .mockResolvedValueOnce({ fileSafe: mockFileSafeEvent })
        .mockResolvedValueOnce({
          fileQuarantined: mockFileQuarantinedEvent,
        });

      await handler(sqsEvent);

      expect(mockEventPublisher.sendEvents).toHaveBeenCalledTimes(2);
      expect(mockEventPublisher.sendEvents).toHaveBeenNthCalledWith(
        1,
        [mockFileSafeEvent],
        expect.any(Function),
      );
      expect(mockEventPublisher.sendEvents).toHaveBeenNthCalledWith(
        2,
        [mockFileQuarantinedEvent],
        expect.any(Function),
      );
    });

    it('does not publish events when handler returns null', async () => {
      const sqsEvent = createSqsEvent(1);
      const handler = createHandler(dependencies);

      mockParseSqsRecord.mockReturnValue(guardDutyNoThreadsFoundEvent.detail);
      mockMoveFileHandler.handle.mockResolvedValue(null);

      await handler(sqsEvent);

      expect(mockEventPublisher.sendEvents).not.toHaveBeenCalled();
    });

    it('returns batch item failures when processing fails', async () => {
      const sqsEvent = createSqsEvent(2);
      const handler = createHandler(dependencies);

      mockParseSqsRecord
        .mockReturnValueOnce(guardDutyNoThreadsFoundEvent.detail)
        .mockImplementationOnce(() => {
          throw new Error('Parse error');
        });
      mockMoveFileHandler.handle.mockResolvedValue({
        fileSafe: {
          specversion: '1.0',
          id: 'test-id',
          source: '/test',
          plane: 'data',
          dataschemaversion: '1.0.0',
          datacontenttype: 'application/json',
          dataschema:
            'https://notify.nhs.uk/cloudevents/schemas/digital-letters/2025-10-draft/data/digital-letters-print-file-safe-data.schema.json',
          type: 'uk.nhs.notify.digital.letters.print.file.safe.v1',
          time: '2024-01-01T00:00:00Z',
          data: {
            messageReference: 'msg-ref',
            senderId: 'sender-id',
            letterUri: 'https://bucket/key',
            createdAt: '2024-01-01T00:00:00Z',
          },
          subject: 'test-subject',
          traceparent: 'test-traceparent',
          recordedtime: '2024-01-01T00:00:00Z',
          severitynumber: 2,
        },
      });

      const result = await handler(sqsEvent);

      expect(mockLogger.warn).toHaveBeenCalledWith({
        error: 'Parse error',
        description: 'Failed processing message',
        messageId: 'message-id-2',
      });
      expect(result.batchItemFailures).toEqual([
        { itemIdentifier: 'message-id-2' },
      ]);
      expect(mockLogger.info).toHaveBeenCalledWith({
        description: '1 of 2 records processed successfully',
      });
    });

    it('handles errors from moveFileHandler', async () => {
      const sqsEvent = createSqsEvent(1);
      const handler = createHandler(dependencies);

      mockParseSqsRecord.mockReturnValue(guardDutyNoThreadsFoundEvent.detail);
      mockMoveFileHandler.handle.mockRejectedValue(new Error('Handler error'));

      const result = await handler(sqsEvent);

      expect(mockLogger.warn).toHaveBeenCalledWith({
        error: 'Handler error',
        description: 'Failed processing message',
        messageId: 'message-id-1',
      });
      expect(result.batchItemFailures).toEqual([
        { itemIdentifier: 'message-id-1' },
      ]);
    });
  });
});
