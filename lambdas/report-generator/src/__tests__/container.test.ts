import { createContainer } from 'container';

jest.mock('infra/config', () => ({
  loadConfig: jest.fn(() => ({
    athenaNamedQueryId: 'test-named-query-id',
    environment: 'test',
    eventPublisherDlqUrl: 'test-url',
    eventPublisherEventBusArn: 'test-arn',
    dlMetricsNamespace: 'test-namespace',
    maxPollLimit: 10,
    reportName: 'test-report',
    reportingBucket: 'test-bucket',
    waitForInSeconds: 5,
    dlqUrl: 'test-dlq-url',
  })),
}));

jest.mock('utils', () => ({
  ...jest.requireActual('utils'),
  AthenaDataRepository: jest.fn(() => ({})),
  ReportService: jest.fn(() => ({})),
  createStorageRepository: jest.fn(() => ({})),
  s3Client: {},
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
