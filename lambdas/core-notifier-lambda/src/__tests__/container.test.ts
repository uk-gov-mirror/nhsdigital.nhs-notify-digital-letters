import { mock } from 'jest-mock-extended';
import { EventPublisher, ParameterStoreCache, logger } from 'utils';
import { NotifyClient } from 'app/notify-api-client';
import { NotifyMessageProcessor } from 'app/notify-message-processor';
import { ISenderManagement, SenderManagement } from 'sender-management';
import { createContainer } from 'container';
import { loadConfig } from 'infra/config';
import { CoreRequestMapper } from 'domain/core-request-mapper';
import { MessageRequestRejectedMapper } from 'domain/message-request-rejected-mapper';
import { MessageRequestSubmittedMapper } from 'domain/message-request-submitted-mapper';

jest.mock('utils', () => ({
  ParameterStoreCache: jest.fn(),
  createGetApimAccessToken: jest.fn(() => jest.fn()),
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
  EventPublisher: jest.fn(),
  eventBridgeClient: {},
  sqsClient: {},
}));

jest.mock('app/notify-api-client');
jest.mock('app/notify-message-processor');
jest.mock('sender-management');
jest.mock('infra/config');
jest.mock('domain/core-request-mapper');
jest.mock('domain/message-request-submitted-mapper');
jest.mock('domain/message-request-rejected-mapper');

describe('createContainer', () => {
  const mockParameterStore = mock<ParameterStoreCache>();
  const mockConfig = {
    eventPublisherEventBusArn:
      'arn:aws:events:eu-west-2:123456789012:event-bus/test-bus',
    eventPublisherDlqUrl:
      'https://sqs.eu-west-2.amazonaws.com/123456789012/test-dlq',
    apimAccessTokenSsmParameterName: '/test/apim/access-token',
    apimBaseUrl: 'https://api.test.nhs.uk',
    environment: 'test',
    nhsAppBaseUrl: 'https://example.com',
  };

  const mockSenderManagement = mock<ISenderManagement>();
  const mockNotifyClient = mock<NotifyClient>();
  const mockNotifyMessageProcessor = mock<NotifyMessageProcessor>();
  const mockEventPublisher = mock<EventPublisher>();
  const mockCoreRequestMapper = mock<CoreRequestMapper>();
  const mockMessageRequestSubmittedMapper =
    mock<MessageRequestSubmittedMapper>();
  const mockMessageRequestRejectedMapper = mock<MessageRequestRejectedMapper>();

  beforeEach(() => {
    jest.clearAllMocks();

    (ParameterStoreCache as jest.Mock).mockImplementation(
      () => mockParameterStore,
    );
    (loadConfig as jest.Mock).mockReturnValue(mockConfig);
    (SenderManagement as jest.Mock).mockImplementation(
      () => mockSenderManagement,
    );
    (NotifyClient as jest.Mock).mockImplementation(() => mockNotifyClient);
    (NotifyMessageProcessor as jest.Mock).mockImplementation(
      () => mockNotifyMessageProcessor,
    );
    (EventPublisher as jest.Mock).mockImplementation(() => mockEventPublisher);
    (CoreRequestMapper as jest.Mock).mockImplementation(
      () => mockCoreRequestMapper,
    );
    (MessageRequestSubmittedMapper as jest.Mock).mockImplementation(
      () => mockMessageRequestSubmittedMapper,
    );
    (MessageRequestRejectedMapper as jest.Mock).mockImplementation(
      () => mockMessageRequestRejectedMapper,
    );
  });

  it('creates and returns a container with all dependencies', async () => {
    const container = await createContainer();

    expect(container).toEqual({
      notifyMessageProcessor: mockNotifyMessageProcessor,
      logger,
      senderManagement: mockSenderManagement,
      eventPublisher: mockEventPublisher,
      coreRequestMapper: mockCoreRequestMapper,
      messageRequestSubmittedMapper: mockMessageRequestSubmittedMapper,
      messageRequestRejectedMapper: mockMessageRequestRejectedMapper,
    });
  });

  it('initializes ParameterStoreCache', async () => {
    await createContainer();

    expect(ParameterStoreCache).toHaveBeenCalledTimes(1);
    expect(ParameterStoreCache).toHaveBeenCalledWith();
  });

  it('loads configuration', async () => {
    await createContainer();

    expect(loadConfig).toHaveBeenCalledTimes(1);
  });

  it('creates SenderManagement with parameter store', async () => {
    await createContainer();

    expect(SenderManagement).toHaveBeenCalledTimes(1);
    expect(SenderManagement).toHaveBeenCalledWith({
      parameterStore: mockParameterStore,
    });
  });

  it('creates NotifyClient with config and dependencies', async () => {
    await createContainer();

    expect(NotifyClient).toHaveBeenCalledTimes(1);
    expect(NotifyClient).toHaveBeenCalledWith(
      mockConfig.apimBaseUrl,
      expect.objectContaining({
        getAccessToken: expect.any(Function),
      }),
      logger,
    );
  });

  it('creates NotifyMessageProcessor with client and logger', async () => {
    await createContainer();

    expect(NotifyMessageProcessor).toHaveBeenCalledTimes(1);
    expect(NotifyMessageProcessor).toHaveBeenCalledWith({
      nhsNotifyClient: mockNotifyClient,
      logger,
    });
  });

  it('creates EventPublisher instances with config', async () => {
    await createContainer();

    expect(EventPublisher).toHaveBeenCalledTimes(1);
    expect(EventPublisher).toHaveBeenCalledWith(
      expect.objectContaining({
        eventBusArn: mockConfig.eventPublisherEventBusArn,
        dlqUrl: mockConfig.eventPublisherDlqUrl,
        logger,
        sqsClient: expect.any(Object),
        eventBridgeClient: expect.any(Object),
      }),
    );
  });
});
