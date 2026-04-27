import { MoveScannedFilesConfig, loadConfig } from 'infra/config';
import { defaultConfigReader } from 'utils';

jest.mock('utils', () => ({
  defaultConfigReader: {
    getValue: jest.fn(),
  },
}));

describe('loadConfig', () => {
  const mockGetValue = jest.mocked(defaultConfigReader.getValue);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('loads all configuration values from environment', () => {
    const mockConfig = {
      eventPublisherEventBusArn:
        'arn:aws:events:eu-west-2:123456789012:event-bus/test-bus',
      eventPublisherDlqUrl:
        'https://sqs.eu-west-2.amazonaws.com/123456789012/test-dlq',
      dlMetricsNamespace: 'test-namespace',
      environment: 'test',
      keyPrefixUnscannedFiles: 'dl/',
      unscannedFileS3BucketName: 'unscanned-bucket',
      safeFileS3BucketName: 'safe-bucket',
      quarantineFileS3BucketName: 'quarantine-bucket',
    };

    mockGetValue
      .mockReturnValueOnce(mockConfig.eventPublisherEventBusArn)
      .mockReturnValueOnce(mockConfig.eventPublisherDlqUrl)
      .mockReturnValueOnce(mockConfig.dlMetricsNamespace)
      .mockReturnValueOnce(mockConfig.keyPrefixUnscannedFiles)
      .mockReturnValueOnce(mockConfig.unscannedFileS3BucketName)
      .mockReturnValueOnce(mockConfig.safeFileS3BucketName)
      .mockReturnValueOnce(mockConfig.quarantineFileS3BucketName)
      .mockReturnValueOnce(mockConfig.environment);

    const result = loadConfig();

    expect(result).toEqual(mockConfig);
    expect(mockGetValue).toHaveBeenCalledTimes(8);
    expect(mockGetValue).toHaveBeenNthCalledWith(
      1,
      'EVENT_PUBLISHER_EVENT_BUS_ARN',
    );
    expect(mockGetValue).toHaveBeenNthCalledWith(2, 'EVENT_PUBLISHER_DLQ_URL');
    expect(mockGetValue).toHaveBeenNthCalledWith(3, 'DL_METRICS_NAMESPACE');
    expect(mockGetValue).toHaveBeenNthCalledWith(
      4,
      'KEY_PREFIX_UNSCANNED_FILES',
    );
    expect(mockGetValue).toHaveBeenNthCalledWith(
      5,
      'UNSCANNED_FILE_S3_BUCKET_NAME',
    );
    expect(mockGetValue).toHaveBeenNthCalledWith(6, 'SAFE_FILE_S3_BUCKET_NAME');
    expect(mockGetValue).toHaveBeenNthCalledWith(
      7,
      'QUARANTINE_FILE_S3_BUCKET_NAME',
    );
    expect(mockGetValue).toHaveBeenNthCalledWith(8, 'ENVIRONMENT');
  });

  it('returns config with correct types', () => {
    mockGetValue
      .mockReturnValueOnce('arn:test')
      .mockReturnValueOnce('https://dlq')
      .mockReturnValueOnce('test-namespace')
      .mockReturnValueOnce('dl/')
      .mockReturnValueOnce('unscanned-bucket')
      .mockReturnValueOnce('safe-bucket')
      .mockReturnValueOnce('quarantine-bucket')
      .mockReturnValueOnce('prod');

    const result: MoveScannedFilesConfig = loadConfig();

    expect(typeof result.eventPublisherEventBusArn).toBe('string');
    expect(typeof result.eventPublisherDlqUrl).toBe('string');
    expect(typeof result.dlMetricsNamespace).toBe('string');
    expect(typeof result.environment).toBe('string');
    expect(typeof result.keyPrefixUnscannedFiles).toBe('string');
    expect(typeof result.unscannedFileS3BucketName).toBe('string');
    expect(typeof result.safeFileS3BucketName).toBe('string');
    expect(typeof result.quarantineFileS3BucketName).toBe('string');
  });
});
