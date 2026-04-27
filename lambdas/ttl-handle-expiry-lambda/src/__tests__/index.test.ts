import type { DynamoDBStreamEvent } from 'aws-lambda';
import { handler } from 'index';

jest.mock('utils', () => ({
  EventPublisher: jest.fn().mockImplementation(() => ({
    sendEvents: jest.fn().mockResolvedValue({}),
  })),
  MetricHandler: jest.fn().mockImplementation(() => ({})),
  eventBridgeClient: {},
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
  },
  sqsClient: {},
  defaultConfigReader: {
    getValue: jest.fn().mockImplementation((key: string) => {
      if (key === 'EVENT_PUBLISHER_EVENT_BUS_ARN') return 'test-bus-arn';
      if (key === 'EVENT_PUBLISHER_DLQ_URL') return 'test-dlq-url';
      return 'test-value';
    }),
  },
}));

describe('index module integration', () => {
  it('should export a handler function', () => {
    expect(handler).toBeDefined();
    expect(typeof handler).toBe('function');
  });

  it('should handle DynamoDB stream events', async () => {
    const mockEvent: DynamoDBStreamEvent = {
      Records: [
        {
          eventID: 'test-event-1',
          eventName: 'REMOVE',
          eventVersion: '1.1',
          eventSource: 'aws:dynamodb',
          awsRegion: 'us-east-1',
          dynamodb: {
            ApproximateCreationDateTime: 1_234_567_890,
            Keys: { id: { S: 'test-id-1' } },
            SequenceNumber: '123456789',
            SizeBytes: 100,
            StreamViewType: 'OLD_IMAGE',
          },
        },
      ],
    };

    const result = await handler(mockEvent);
    expect(result).toBeDefined();
  });
});
