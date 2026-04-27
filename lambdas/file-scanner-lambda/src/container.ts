import { HandlerDependencies } from 'apis/sqs-handler';
import { FileScanner } from 'app/file-scanner';
import { loadConfig } from 'infra/config';
import {
  EventPublisher,
  MetricHandler,
  eventBridgeClient,
  logger,
  s3Client,
  sqsClient,
} from 'utils';

export const createContainer = (): HandlerDependencies => {
  const {
    dlMetricsNamespace,
    documentReferenceBucket,
    environment,
    eventPublisherDlqUrl,
    eventPublisherEventBusArn,
    unscannedFilesBucket,
    unscannedFilesPathPrefix,
  } = loadConfig();

  const eventPublisher = new EventPublisher({
    eventBusArn: eventPublisherEventBusArn,
    dlqUrl: eventPublisherDlqUrl,
    logger,
    sqsClient,
    eventBridgeClient,
    metricHandler: new MetricHandler(dlMetricsNamespace, [
      { Name: 'Environment', Value: environment },
    ]),
  });

  const fileScanner = new FileScanner({
    documentReferenceBucket,
    unscannedFilesBucket,
    unscannedFilesPathPrefix,
    s3Client,
    logger,
  });

  return { eventPublisher, logger, fileScanner };
};

export default createContainer;
