import { createContainer } from 'container';

jest.mock('infra/config', () => ({
  loadConfig: jest.fn(() => ({
    eventPublisherDlqUrl: 'test-url',
    eventPublisherEventBusArn: 'test-arn',
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
  dynamoDocumentClient: {},
  eventBridgeClient: {},
  logger: {},
}));

describe('container', () => {
  it('should create container', () => {
    const container = createContainer();
    expect(container).toBeDefined();
  });
});
