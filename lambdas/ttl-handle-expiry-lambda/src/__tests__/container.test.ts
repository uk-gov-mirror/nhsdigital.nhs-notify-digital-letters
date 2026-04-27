import { EventPublisher } from 'utils';
import { loadConfig } from 'infra/config';
import { createContainer } from 'container';

jest.mock('utils', () => ({
  EventPublisher: jest.fn(),
  MetricHandler: jest.fn(),
  eventBridgeClient: {},
  logger: {},
  sqsClient: {},
}));

jest.mock('infra/config', () => ({
  loadConfig: jest.fn(),
}));

const mockLoadConfig = loadConfig as jest.MockedFunction<typeof loadConfig>;
const mockEventPublisher = jest.mocked(EventPublisher);

describe('createContainer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should create a container with EventPublisher and logger', () => {
    const mockConfig = {
      eventPublisherEventBusArn:
        'arn:aws:events:us-east-1:123456789012:event-bus/test-bus',
      eventPublisherDlqUrl:
        'https://sqs.us-east-1.amazonaws.com/123456789012/test-event-dlq',
      environment: 'test',
      dlMetricsNamespace: 'test-namespace',
      dlqUrl: 'https://sqs.us-east-1.amazonaws.com/123456789012/test-dlq',
    };

    mockLoadConfig.mockReturnValue(mockConfig);

    const mockEventPublisherInstance = {
      sendEvents: jest.fn(),
    };
    mockEventPublisher.mockReturnValue(mockEventPublisherInstance as any);

    const container = createContainer();

    expect(loadConfig).toHaveBeenCalledTimes(1);

    expect(EventPublisher).toHaveBeenCalledWith({
      eventBusArn: mockConfig.eventPublisherEventBusArn,
      dlqUrl: mockConfig.eventPublisherDlqUrl,
      logger: expect.any(Object),
      sqsClient: expect.any(Object),
      eventBridgeClient: expect.any(Object),
      metricHandler: expect.any(Object),
    });

    expect(container).toEqual({
      eventPublisher: mockEventPublisherInstance,
      logger: expect.any(Object),
      dlq: expect.any(Object),
    });
  });

  it('should export default as createContainer', () => {
    expect(createContainer).toBeDefined();
    expect(typeof createContainer).toBe('function');

    const container1 = createContainer();
    const container2 = createContainer();

    expect(container1).toMatchObject({
      eventPublisher: expect.any(Object),
      logger: expect.any(Object),
      dlq: expect.any(Object),
    });
    expect(container2).toMatchObject({
      eventPublisher: expect.any(Object),
      logger: expect.any(Object),
      dlq: expect.any(Object),
    });
  });
});
