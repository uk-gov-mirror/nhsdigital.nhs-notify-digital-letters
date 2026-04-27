// Set environment variables before any imports
process.env.DOCUMENT_REFERENCE_BUCKET = 'test-doc-ref-bucket';
process.env.ENVIRONMENT = 'test';
process.env.UNSCANNED_FILES_BUCKET = 'test-unscanned-bucket';
process.env.UNSCANNED_FILES_PATH_PREFIX = 'test-prefix';
process.env.EVENT_PUBLISHER_EVENT_BUS_ARN =
  'arn:aws:events:us-east-1:123456789012:event-bus/test-bus';
process.env.EVENT_PUBLISHER_DLQ_URL =
  'https://sqs.us-east-1.amazonaws.com/123456789012/test-dlq';
process.env.DL_METRICS_NAMESPACE = 'test-namespace';

// eslint-disable-next-line import-x/first
import { handler } from '..';

describe('Lambda Handler', () => {
  afterAll(() => {
    delete process.env.DOCUMENT_REFERENCE_BUCKET;
    delete process.env.ENVIRONMENT;
    delete process.env.UNSCANNED_FILES_BUCKET;
    delete process.env.UNSCANNED_FILES_PATH_PREFIX;
    delete process.env.EVENT_PUBLISHER_EVENT_BUS_ARN;
    delete process.env.EVENT_PUBLISHER_DLQ_URL;
    delete process.env.DL_METRICS_NAMESPACE;
  });

  it('should export handler function', () => {
    expect(handler).toBeDefined();
    expect(typeof handler).toBe('function');
  });
});
