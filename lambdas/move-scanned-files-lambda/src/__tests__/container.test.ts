import { mock } from 'jest-mock-extended';
import { EventPublisher, logger } from 'utils';
import { MoveFileHandler } from 'app/move-file-handler';
import { createContainer } from 'container';
import { loadConfig } from 'infra/config';

jest.mock('utils', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
  EventPublisher: jest.fn(),
  MetricHandler: jest.fn(),
  eventBridgeClient: {},
  sqsClient: {},
}));

jest.mock('app/move-file-handler');
jest.mock('infra/config');

describe('createContainer', () => {
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

  const mockMoveFileHandler = mock<MoveFileHandler>();
  const mockEventPublisher = mock<EventPublisher>();

  beforeEach(() => {
    jest.clearAllMocks();

    (loadConfig as jest.Mock).mockReturnValue(mockConfig);
    (MoveFileHandler as jest.Mock).mockImplementation(
      () => mockMoveFileHandler,
    );
    (EventPublisher as jest.Mock).mockImplementation(() => mockEventPublisher);
  });

  it('creates and returns a container with all dependencies', async () => {
    const container = await createContainer();

    expect(container).toEqual({
      moveFileHandler: mockMoveFileHandler,
      logger,
      eventPublisher: mockEventPublisher,
    });
  });

  it('loads configuration', async () => {
    await createContainer();

    expect(loadConfig).toHaveBeenCalledTimes(1);
  });

  it('creates MoveFileHandler with logger and config', async () => {
    await createContainer();

    expect(MoveFileHandler).toHaveBeenCalledTimes(1);
    expect(MoveFileHandler).toHaveBeenCalledWith(logger, mockConfig);
  });

  it('creates EventPublisher instance with config', async () => {
    await createContainer();

    expect(EventPublisher).toHaveBeenCalledTimes(1);
    expect(EventPublisher).toHaveBeenCalledWith(
      expect.objectContaining({
        eventBusArn: mockConfig.eventPublisherEventBusArn,
        dlqUrl: mockConfig.eventPublisherDlqUrl,
        logger,
        sqsClient: expect.any(Object),
        eventBridgeClient: expect.any(Object),
        metricHandler: expect.any(Object),
      }),
    );
  });
});
