import { randomUUID } from 'node:crypto';
import { GenerateReport, ReportGenerated } from 'digital-letters-events';
import { EventPublisher, Logger } from 'utils';
import type { SQSEvent, SQSRecord } from 'aws-lambda';
import type {
  ReportGenerator,
  ReportGeneratorResult,
} from 'app/report-generator';
import { createHandler } from 'apis/sqs-trigger-lambda';

jest.mock('node:crypto');

const mockUuid = '123e4567-e89b-12d3-a456-426614174000';

const createMockSQSRecord = (
  messageId: string,
  event: Partial<GenerateReport>,
): SQSRecord => ({
  messageId,
  receiptHandle: 'receipt-handle',
  body: JSON.stringify({
    detail: {
      id: event.id || mockUuid,
      source:
        event.source ||
        '/nhs/england/notify/development/primary/digitalletters/reporting',
      plane: 'data',
      dataschemaversion: '1.0.0',
      datacontenttype: 'application/json',
      specversion: event.specversion || '1.0',
      type:
        event.type ||
        'uk.nhs.notify.digital.letters.reporting.generate.report.v1',
      dataschema:
        event.dataschema ||
        'https://notify.nhs.uk/cloudevents/schemas/digital-letters/2025-10-draft/data/digital-letters-reporting-generate-report-data.schema.json',
      time: event.time || new Date().toISOString(),
      recordedtime: event.recordedtime || new Date().toISOString(),
      subject: event.subject || 'customer/5661de82-7453-44a1-9922-e0c98e5411c1',
      traceparent:
        event.traceparent ||
        '00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01',
      severitynumber: event.severitynumber || 2,
      data: event.data || {
        senderId: 'fce3ddee-2aca-4b2e-90a8-ce4da3787792',
        reportDate: '2025-01-01',
      },
    },
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
  awsRegion: 'us-east-1',
});

const createMockSQSEvent = (records: SQSRecord[]): SQSEvent => ({
  Records: records,
});

describe('sqs-trigger-lambda', () => {
  let mockReportGenerator: jest.Mocked<ReportGenerator>;
  let mockEventPublisher: jest.Mocked<EventPublisher>;
  let mockLogger: jest.Mocked<Logger>;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(randomUUID).mockReturnValue(mockUuid);

    mockReportGenerator = {
      generate: jest.fn(),
    } as unknown as jest.Mocked<ReportGenerator>;

    mockEventPublisher = {
      sendEvents: jest.fn().mockResolvedValue([]),
    } as unknown as jest.Mocked<EventPublisher>;

    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    } as unknown as jest.Mocked<Logger>;
  });

  describe('createHandler', () => {
    it('should process valid SQS records successfully', async () => {
      const reportUri = 's3://bucket/report.csv';
      const mockResult: ReportGeneratorResult = {
        outcome: 'generated',
        reportUri,
      };
      mockReportGenerator.generate.mockResolvedValue(mockResult);

      const record = createMockSQSRecord('msg-1', {});
      const sqsEvent = createMockSQSEvent([record]);

      const handler = createHandler({
        reportGenerator: mockReportGenerator,
        eventPublisher: mockEventPublisher,
        logger: mockLogger,
      });

      const response = await handler(sqsEvent);

      expect(response.batchItemFailures).toEqual([]);
      expect(mockReportGenerator.generate).toHaveBeenCalledTimes(1);
      expect(mockEventPublisher.sendEvents).toHaveBeenCalledTimes(1);
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          description: 'Processed SQS Event.',
          retrieved: 1,
          generated: 1,
          failed: 0,
        }),
      );
    });

    it('should return batch item failures when report generated event failed to be published', async () => {
      const reportUri = 's3://bucket/report.csv';
      const mockResult: ReportGeneratorResult = {
        outcome: 'generated',
        reportUri,
      };
      mockReportGenerator.generate.mockResolvedValue(mockResult);

      const record = createMockSQSRecord('msg-1', { id: 'event-id-1' });
      const record2 = createMockSQSRecord('msg-2', { id: 'event-id-2' });
      const record3 = createMockSQSRecord('msg-3', { id: 'event-id-3' });
      const sqsEvent = createMockSQSEvent([record, record2, record3]);

      mockEventPublisher.sendEvents.mockResolvedValue([
        {
          id: 'event-id-1',
        } as unknown as ReportGenerated,
        {
          id: 'event-id-3',
        } as unknown as ReportGenerated,
      ]);

      const handler = createHandler({
        reportGenerator: mockReportGenerator,
        eventPublisher: mockEventPublisher,
        logger: mockLogger,
      });

      const response = await handler(sqsEvent);

      expect(response.batchItemFailures).toEqual([
        { itemIdentifier: 'msg-1' },
        { itemIdentifier: 'msg-3' },
      ]);
      expect(mockEventPublisher.sendEvents).toHaveBeenCalledTimes(1);
    });

    it('should handle invalid JSON in SQS record body', async () => {
      const sqsEvent: SQSEvent = {
        Records: [
          {
            ...createMockSQSRecord('msg-1', {}),
            body: 'invalid-json',
          },
        ],
      };

      const handler = createHandler({
        reportGenerator: mockReportGenerator,
        eventPublisher: mockEventPublisher,
        logger: mockLogger,
      });

      const response = await handler(sqsEvent);

      expect(response.batchItemFailures).toEqual([{ itemIdentifier: 'msg-1' }]);
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          description: 'Error parsing SQS record',
        }),
      );
      expect(mockReportGenerator.generate).not.toHaveBeenCalled();
    });

    it('should handle validation failure for event schema', async () => {
      const record = createMockSQSRecord('msg-1', {
        type: 'invalid-type' as any,
        data: {} as any,
      });
      const sqsEvent = createMockSQSEvent([record]);

      const handler = createHandler({
        reportGenerator: mockReportGenerator,
        eventPublisher: mockEventPublisher,
        logger: mockLogger,
      });

      const response = await handler(sqsEvent);

      expect(response.batchItemFailures).toEqual([{ itemIdentifier: 'msg-1' }]);
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          description: 'Error parsing GenerateReport event',
        }),
      );
      expect(mockReportGenerator.generate).not.toHaveBeenCalled();
    });

    it('should add to batch failures when report generation fails', async () => {
      const mockResult: ReportGeneratorResult = { outcome: 'failed' };
      mockReportGenerator.generate.mockResolvedValue(mockResult);

      const record = createMockSQSRecord('msg-1', {});
      const sqsEvent = createMockSQSEvent([record]);

      const handler = createHandler({
        reportGenerator: mockReportGenerator,
        eventPublisher: mockEventPublisher,
        logger: mockLogger,
      });

      const response = await handler(sqsEvent);

      expect(response.batchItemFailures).toEqual([{ itemIdentifier: 'msg-1' }]);
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          failed: 1,
          generated: 0,
        }),
      );
    });

    it('should handle exceptions during report generation', async () => {
      const error = new Error('Generation error');
      mockReportGenerator.generate.mockRejectedValue(error);

      const record = createMockSQSRecord('msg-1', {});
      const sqsEvent = createMockSQSEvent([record]);

      const handler = createHandler({
        reportGenerator: mockReportGenerator,
        eventPublisher: mockEventPublisher,
        logger: mockLogger,
      });

      const response = await handler(sqsEvent);

      expect(response.batchItemFailures).toEqual([{ itemIdentifier: 'msg-1' }]);
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          err: error,
          description: 'Error during SQS trigger handler',
        }),
      );
    });

    it('should not publish events when there are no successful items', async () => {
      mockReportGenerator.generate.mockResolvedValue({ outcome: 'failed' });

      const record = createMockSQSRecord('msg-1', {
        data: { senderId: 'sender-123' } as any,
      });
      const sqsEvent = createMockSQSEvent([record]);

      const handler = createHandler({
        reportGenerator: mockReportGenerator,
        eventPublisher: mockEventPublisher,
        logger: mockLogger,
      });

      await handler(sqsEvent);

      expect(mockEventPublisher.sendEvents).not.toHaveBeenCalled();
    });

    it('should generate correct ReportGenerated events', async () => {
      const reportUri = 's3://bucket/report.csv';
      mockReportGenerator.generate.mockResolvedValue({
        outcome: 'generated',
        reportUri,
      });

      const record = createMockSQSRecord('msg-1', {});
      const sqsEvent = createMockSQSEvent([record]);

      const handler = createHandler({
        reportGenerator: mockReportGenerator,
        eventPublisher: mockEventPublisher,
        logger: mockLogger,
      });

      await handler(sqsEvent);

      expect(mockEventPublisher.sendEvents).toHaveBeenCalledWith(
        [
          expect.objectContaining({
            id: mockUuid,
            type: 'uk.nhs.notify.digital.letters.reporting.report.generated.v1',
            dataschema:
              'https://notify.nhs.uk/cloudevents/schemas/digital-letters/2025-10-draft/data/digital-letters-reporting-report-generated-data.schema.json',
            data: {
              senderId: 'fce3ddee-2aca-4b2e-90a8-ce4da3787792',
              reportUri,
            },
          }),
        ],
        expect.any(Function),
      );
    });

    it('should handle promise rejection during processing', async () => {
      const error = new Error('Unexpected processing error');
      mockReportGenerator.generate.mockImplementation(() => {
        throw error;
      });

      const record = createMockSQSRecord('msg-1', {});
      const sqsEvent = createMockSQSEvent([record]);

      const handler = createHandler({
        reportGenerator: mockReportGenerator,
        eventPublisher: mockEventPublisher,
        logger: mockLogger,
      });

      const response = await handler(sqsEvent);

      expect(response.batchItemFailures).toEqual([{ itemIdentifier: 'msg-1' }]);
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          err: error,
        }),
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          failed: 1,
          generated: 0,
        }),
      );
    });

    it('should log and count a rejected settled result as failed', async () => {
      const record = createMockSQSRecord('msg-1', {});
      const sqsEvent = createMockSQSEvent([record]);
      const error = new Error('Unexpected settled rejection');

      mockReportGenerator.generate.mockImplementation(() =>
        Promise.reject(error),
      );

      const originalAllSettled = Promise.allSettled;
      const allSettledSpy = jest
        .spyOn(Promise, 'allSettled')
        .mockResolvedValueOnce([
          {
            status: 'rejected',
            reason: error,
          } as PromiseRejectedResult,
        ]);

      const handler = createHandler({
        reportGenerator: mockReportGenerator,
        eventPublisher: mockEventPublisher,
        logger: mockLogger,
      });

      const response = await handler(sqsEvent);

      expect(response.batchItemFailures).toEqual([
        {
          itemIdentifier: 'msg-1',
        },
      ]);
      expect(mockLogger.error).toHaveBeenCalledWith({ err: error });
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          description: 'Processed SQS Event.',
          retrieved: 1,
          generated: 0,
          failed: 1,
          failedToPublish: 0,
        }),
      );
      expect(mockEventPublisher.sendEvents).not.toHaveBeenCalled();

      allSettledSpy.mockImplementation(originalAllSettled);
    });
  });
});
