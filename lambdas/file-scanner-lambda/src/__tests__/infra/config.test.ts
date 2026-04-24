import { loadConfig } from 'infra/config';

describe('loadConfig', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('should load valid configuration', () => {
    process.env.DOCUMENT_REFERENCE_BUCKET = 'test-doc-ref-bucket';
    process.env.UNSCANNED_FILES_BUCKET = 'test-unscanned-bucket';
    process.env.UNSCANNED_FILES_PATH_PREFIX = 'dev';
    process.env.EVENT_PUBLISHER_EVENT_BUS_ARN =
      'arn:aws:events:us-east-1:123456789012:event-bus/test-bus';
    process.env.EVENT_PUBLISHER_DLQ_URL =
      'https://sqs.us-east-1.amazonaws.com/123456789012/test-dlq';
    process.env.DL_METRICS_NAMESPACE = 'test-namespace';

    const config = loadConfig();

    expect(config).toEqual({
      documentReferenceBucket: 'test-doc-ref-bucket',
      unscannedFilesBucket: 'test-unscanned-bucket',
      unscannedFilesPathPrefix: 'dev',
      eventPublisherEventBusArn:
        'arn:aws:events:us-east-1:123456789012:event-bus/test-bus',
      eventPublisherDlqUrl:
        'https://sqs.us-east-1.amazonaws.com/123456789012/test-dlq',
      dlMetricsNamespace: 'test-namespace',
    });
  });

  it('should throw error when DOCUMENT_REFERENCE_BUCKET is missing', () => {
    process.env.UNSCANNED_FILES_BUCKET = 'test-unscanned-bucket';
    process.env.UNSCANNED_FILES_PATH_PREFIX = 'dev';
    process.env.EVENT_PUBLISHER_EVENT_BUS_ARN = 'arn:aws:events:test';
    process.env.EVENT_PUBLISHER_DLQ_URL = 'https://sqs.test.com/dlq';
    process.env.DL_METRICS_NAMESPACE = 'test-namespace';
    expect(() => loadConfig()).toThrow('DOCUMENT_REFERENCE_BUCKET is not set');
  });

  it('should throw error when UNSCANNED_FILES_BUCKET is missing', () => {
    process.env.DOCUMENT_REFERENCE_BUCKET = 'test-doc-ref-bucket';
    process.env.UNSCANNED_FILES_PATH_PREFIX = 'dev';
    process.env.EVENT_PUBLISHER_EVENT_BUS_ARN = 'arn:aws:events:test';
    process.env.EVENT_PUBLISHER_DLQ_URL = 'https://sqs.test.com/dlq';
    process.env.DL_METRICS_NAMESPACE = 'test-namespace';

    expect(() => loadConfig()).toThrow('UNSCANNED_FILES_BUCKET is not set');
  });

  it('should throw error when UNSCANNED_FILES_PATH_PREFIX is missing', () => {
    process.env.DOCUMENT_REFERENCE_BUCKET = 'test-doc-ref-bucket';
    process.env.UNSCANNED_FILES_BUCKET = 'test-unscanned-bucket';
    process.env.EVENT_PUBLISHER_EVENT_BUS_ARN = 'arn:aws:events:test';
    process.env.EVENT_PUBLISHER_DLQ_URL = 'https://sqs.test.com/dlq';
    process.env.DL_METRICS_NAMESPACE = 'test-namespace';

    expect(() => loadConfig()).toThrow(
      'UNSCANNED_FILES_PATH_PREFIX is not set',
    );
  });

  it('should throw error when EVENT_PUBLISHER_EVENT_BUS_ARN is missing', () => {
    process.env.DOCUMENT_REFERENCE_BUCKET = 'test-doc-ref-bucket';
    process.env.UNSCANNED_FILES_BUCKET = 'test-unscanned-bucket';
    process.env.UNSCANNED_FILES_PATH_PREFIX = 'dev';
    process.env.EVENT_PUBLISHER_DLQ_URL = 'https://sqs.test.com/dlq';
    process.env.DL_METRICS_NAMESPACE = 'test-namespace';

    expect(() => loadConfig()).toThrow(
      'EVENT_PUBLISHER_EVENT_BUS_ARN is not set',
    );
  });

  it('should throw error when EVENT_PUBLISHER_DLQ_URL is missing', () => {
    process.env.DOCUMENT_REFERENCE_BUCKET = 'test-doc-ref-bucket';
    process.env.UNSCANNED_FILES_BUCKET = 'test-unscanned-bucket';
    process.env.UNSCANNED_FILES_PATH_PREFIX = 'dev';
    process.env.EVENT_PUBLISHER_EVENT_BUS_ARN = 'arn:aws:events:test';
    process.env.DL_METRICS_NAMESPACE = 'test-namespace';

    expect(() => loadConfig()).toThrow('EVENT_PUBLISHER_DLQ_URL is not set');
  });

  it('should handle empty string values as missing', () => {
    process.env.DOCUMENT_REFERENCE_BUCKET = '';
    process.env.UNSCANNED_FILES_BUCKET = 'test-unscanned-bucket';
    process.env.UNSCANNED_FILES_PATH_PREFIX = 'dev';
    process.env.EVENT_PUBLISHER_EVENT_BUS_ARN = 'arn:aws:events:test';
    process.env.EVENT_PUBLISHER_DLQ_URL = 'https://sqs.test.com/dlq';
    process.env.DL_METRICS_NAMESPACE = 'test-namespace';

    expect(() => loadConfig()).toThrow('DOCUMENT_REFERENCE_BUCKET is not set');
  });

  it('should throw error when DL_METRICS_NAMESPACE is missing', () => {
    process.env.DOCUMENT_REFERENCE_BUCKET = 'test-doc-ref-bucket';
    process.env.UNSCANNED_FILES_BUCKET = 'test-unscanned-bucket';
    process.env.UNSCANNED_FILES_PATH_PREFIX = 'dev';
    process.env.EVENT_PUBLISHER_EVENT_BUS_ARN = 'arn:aws:events:test';
    process.env.EVENT_PUBLISHER_DLQ_URL = 'https://sqs.test.com/dlq';

    expect(() => loadConfig()).toThrow('DL_METRICS_NAMESPACE is not set');
  });
});
