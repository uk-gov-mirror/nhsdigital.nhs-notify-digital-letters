import { NotifySendMessageConfig, loadConfig } from 'infra/config';
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
      apimAccessTokenSsmParameterName: '/test/apim/access-token',
      apimBaseUrl: 'https://api.test.nhs.uk',
      nhsAppBaseUrl: 'https://example.com',
      environment: 'test',
    };

    mockGetValue
      .mockReturnValueOnce(mockConfig.eventPublisherEventBusArn)
      .mockReturnValueOnce(mockConfig.eventPublisherDlqUrl)
      .mockReturnValueOnce(mockConfig.apimAccessTokenSsmParameterName)
      .mockReturnValueOnce(mockConfig.apimBaseUrl)
      .mockReturnValueOnce(mockConfig.nhsAppBaseUrl)
      .mockReturnValueOnce(mockConfig.environment);

    const result = loadConfig();

    expect(result).toEqual(mockConfig);
    expect(mockGetValue).toHaveBeenCalledTimes(6);
    expect(mockGetValue).toHaveBeenNthCalledWith(
      1,
      'EVENT_PUBLISHER_EVENT_BUS_ARN',
    );
    expect(mockGetValue).toHaveBeenNthCalledWith(2, 'EVENT_PUBLISHER_DLQ_URL');
    expect(mockGetValue).toHaveBeenNthCalledWith(
      3,
      'APIM_ACCESS_TOKEN_SSM_PARAMETER_NAME',
    );
    expect(mockGetValue).toHaveBeenNthCalledWith(4, 'APIM_BASE_URL');
    expect(mockGetValue).toHaveBeenNthCalledWith(5, 'NHS_APP_BASE_URL');
    expect(mockGetValue).toHaveBeenNthCalledWith(6, 'ENVIRONMENT');
  });

  it('returns config with correct types', () => {
    mockGetValue
      .mockReturnValueOnce('arn:test')
      .mockReturnValueOnce('https://dlq')
      .mockReturnValueOnce('/param')
      .mockReturnValueOnce('https://api')
      .mockReturnValueOnce('https://example.com')
      .mockReturnValueOnce('prod');

    const result: NotifySendMessageConfig = loadConfig();

    expect(typeof result.eventPublisherEventBusArn).toBe('string');
    expect(typeof result.eventPublisherDlqUrl).toBe('string');
    expect(typeof result.apimAccessTokenSsmParameterName).toBe('string');
    expect(typeof result.apimBaseUrl).toBe('string');
    expect(typeof result.nhsAppBaseUrl).toBe('string');
    expect(typeof result.environment).toBe('string');
  });
});
