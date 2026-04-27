import { createContainer } from 'container';

jest.mock('infra/config', () => ({
  loadConfig: jest.fn(() => ({
    eventPublisherDlqUrl: 'test-url',
    eventPublisherEventBusArn: 'test-arn',
    dlMetricsNamespace: 'test-namespace',
    environment: 'test',
    accountType: 'test-account',
  })),
}));

jest.mock('app/print-sender', () => ({
  PrintSender: jest.fn(() => ({})),
}));

jest.mock('utils', () => ({
  EventPublisher: jest.fn(() => ({})),
  MetricHandler: jest.fn(() => ({})),
  eventBridgeClient: {},
  logger: {},
  sqsClient: {},
}));

describe('container', () => {
  it('should create container', () => {
    const container = createContainer();
    expect(container).toBeDefined();
  });
});
