import type { SQSEvent, SQSRecord } from 'aws-lambda';
import { createHandler } from 'apis/sqs-trigger-lambda';
import { PrintSender } from 'app/print-sender';
import type { Logger } from 'utils';
import { PDFAnalysed } from 'digital-letters-events';

const createSQSRecord = (body: string, messageId: string): SQSRecord => ({
  messageId,
  receiptHandle: 'receipt-handle',
  body,
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
});

const createValidEvent = (overrides = {}): PDFAnalysed => ({
  id: 'test-id',
  time: '2024-01-01T00:00:00Z',
  recordedtime: '2024-01-01T00:00:00Z',
  type: 'uk.nhs.notify.digital.letters.print.pdf.analysed.v1',
  dataschema:
    'https://notify.nhs.uk/cloudevents/schemas/digital-letters/2025-10-draft/data/digital-letters-print-pdf-analysed-data.schema.json',
  plane: 'data',
  dataschemaversion: '1.0.0',
  datacontenttype: 'application/json',
  source: '/nhs/england/notify/production/primary/digitalletters/print',
  specversion: '1.0',
  traceparent: '00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01',
  severitynumber: 2,
  subject: 'test-subject',
  data: {
    senderId: 'test-sender',
    messageReference: 'test-ref-123',
    pageCount: 5,
    sha256Hash:
      '3f4146a1d0b5dac26562ff7dc6248573f4e996cf764a0f517318ff398dcfa792',
    letterUri: 's3://bucket/letter.pdf',
    createdAt: '2024-01-01T00:00:00Z',
  },
  ...overrides,
});

describe('sqs-trigger-lambda', () => {
  let mockPrintSender: jest.Mocked<PrintSender>;
  let mockLogger: jest.Mocked<Logger>;
  let mockChildLogger: jest.Mocked<Logger>;
  let handler: any;

  beforeEach(() => {
    mockPrintSender = {
      send: jest.fn(),
    } as unknown as jest.Mocked<PrintSender>;

    mockChildLogger = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
    } as unknown as jest.Mocked<Logger>;

    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      child: jest.fn().mockReturnValue(mockChildLogger),
    } as unknown as jest.Mocked<Logger>;

    handler = createHandler({
      printSender: mockPrintSender,
      logger: mockLogger,
    });
  });

  it('should process valid SQS messages successfully', async () => {
    const event1 = createValidEvent({ id: 'id-1' });
    const event2 = createValidEvent({ id: 'id-2' });
    const event3 = createValidEvent({ id: 'id-3' });
    const sqsEvent: SQSEvent = {
      Records: [
        createSQSRecord(JSON.stringify({ detail: event1 }), 'message-1'),
        createSQSRecord(JSON.stringify({ detail: event2 }), 'message-2'),
        createSQSRecord(JSON.stringify({ detail: event3 }), 'message-3'),
      ],
    };

    mockPrintSender.send.mockResolvedValue('sent');

    const result = await handler(sqsEvent);

    expect(result.batchItemFailures).toEqual([]);
    expect(mockPrintSender.send).toHaveBeenCalledTimes(3);
    expect(mockPrintSender.send).toHaveBeenCalledWith(event1);
    expect(mockPrintSender.send).toHaveBeenCalledWith(event2);
    expect(mockPrintSender.send).toHaveBeenCalledWith(event3);
    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        description: 'Processed SQS Event.',
        retrieved: 3,
        sent: 3,
        failed: 0,
      }),
    );
  });

  it('should handle invalid event schema', async () => {
    const invalidEvent = { invalid: 'data' };
    const sqsEvent: SQSEvent = {
      Records: [
        createSQSRecord(JSON.stringify({ detail: invalidEvent }), 'message-1'),
      ],
    };

    const result = await handler(sqsEvent);

    expect(result.batchItemFailures).toEqual([{ itemIdentifier: 'message-1' }]);
    expect(mockChildLogger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        description: 'Error parsing PDFAnalysed event',
      }),
    );
    expect(mockPrintSender.send).not.toHaveBeenCalled();
  });

  it('should handle sendPrint failures', async () => {
    const validEvent = createValidEvent();
    const sqsEvent: SQSEvent = {
      Records: [
        createSQSRecord(JSON.stringify({ detail: validEvent }), 'message-1'),
      ],
    };

    mockPrintSender.send.mockResolvedValue('failed');

    const result = await handler(sqsEvent);

    expect(result.batchItemFailures).toEqual([{ itemIdentifier: 'message-1' }]);
  });

  it('should handle partial batch failures', async () => {
    const event1 = createValidEvent({ id: 'id-1' });
    const event2 = createValidEvent({ id: 'id-2' });
    const event4 = createValidEvent({ id: 'id-3' });
    const event5 = createValidEvent({ id: 'id-4' });
    const sqsEvent: SQSEvent = {
      Records: [
        createSQSRecord(JSON.stringify({ detail: event1 }), 'message-1'),
        createSQSRecord(JSON.stringify({ detail: event2 }), 'message-2'),
        createSQSRecord(JSON.stringify({ detail: event4 }), 'message-3'),
        createSQSRecord(JSON.stringify({ detail: event5 }), 'message-4'),
      ],
    };

    mockPrintSender.send
      .mockResolvedValueOnce('sent')
      .mockResolvedValueOnce('failed')
      .mockResolvedValueOnce('failed')
      .mockResolvedValueOnce('failed');

    const result = await handler(sqsEvent);

    expect(result.batchItemFailures).toEqual([
      { itemIdentifier: 'message-2' },
      { itemIdentifier: 'message-3' },
      { itemIdentifier: 'message-4' },
    ]);
    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        retrieved: 4,
        sent: 1,
        failed: 3,
      }),
    );
  });

  it('should handle JSON parsing errors', async () => {
    const sqsEvent: SQSEvent = {
      Records: [createSQSRecord('invalid json', 'message-1')],
    };

    const result = await handler(sqsEvent);

    expect(result.batchItemFailures).toEqual([{ itemIdentifier: 'message-1' }]);
    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        description: 'Error during SQS trigger handler',
      }),
    );
  });

  it('should handle promise rejections in batch processing', async () => {
    const validEvent = createValidEvent();
    const sqsEvent: SQSEvent = {
      Records: [
        createSQSRecord(JSON.stringify({ detail: validEvent }), 'message-1'),
      ],
    };

    mockPrintSender.send.mockRejectedValue(new Error('Unexpected error'));

    const result = await handler(sqsEvent);

    expect(result.batchItemFailures).toEqual([{ itemIdentifier: 'message-1' }]);
    expect(mockLogger.error).toHaveBeenCalled();
  });
});
