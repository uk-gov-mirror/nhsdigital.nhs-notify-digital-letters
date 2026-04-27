import { createContainer } from 'container';

jest.mock('infra/config', () => ({
  loadConfig: jest.fn(() => ({
    environment: 'test',
    eventPublisherDlqUrl: 'test-url',
    eventPublisherEventBusArn: 'test-arn',
    dlMetricsNamespace: 'test-namespace',
    ttlTableName: 'test-table',
  })),
}));

jest.mock('infra/ttl-repository', () => ({
  TtlRepository: jest.fn(() => ({})),
}));

jest.mock('app/ttl-actions', () => ({
  TtlActions: jest.fn(() => ({})),
}));

jest.mock('utils', () => ({
  EventPublisher: jest.fn(() => ({})),
  MetricHandler: jest.fn(() => ({})),
  dynamoDocumentClient: {},
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
