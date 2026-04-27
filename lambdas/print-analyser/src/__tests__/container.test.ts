import { createContainer } from 'container';

jest.mock('infra/config', () => ({
  loadConfig: jest.fn(() => ({
    environment: 'test',
    eventPublisherDlqUrl: 'test-url',
    eventPublisherEventBusArn: 'test-arn',
    dlMetricsNamespace: 'test-namespace',
  })),
}));

jest.mock('utils', () => ({
  eventBridgeClient: {},
  EventPublisher: jest.fn(() => ({})),
  MetricHandler: jest.fn(() => ({})),
  logger: {},
  sqsClient: {},
}));

describe('container', () => {
  it('should create container', () => {
    const container = createContainer();
    expect(container).toBeDefined();
  });
});
