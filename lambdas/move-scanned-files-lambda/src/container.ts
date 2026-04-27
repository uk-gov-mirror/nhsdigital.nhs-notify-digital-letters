import {
  EventPublisher,
  MetricHandler,
  eventBridgeClient,
  logger,
  sqsClient,
} from 'utils';
import type { SqsHandlerDependencies } from 'apis/sqs-handler';
import { loadConfig } from 'infra/config';
import { MoveFileHandler } from 'app/move-file-handler';

export async function createContainer(): Promise<SqsHandlerDependencies> {
  const config = loadConfig();

  const {
    dlMetricsNamespace,
    eventPublisherDlqUrl,
    eventPublisherEventBusArn,
  } = config;

  const eventPublisher = new EventPublisher({
    eventBusArn: eventPublisherEventBusArn,
    dlqUrl: eventPublisherDlqUrl,
    logger,
    sqsClient,
    eventBridgeClient,
    metricHandler: new MetricHandler(dlMetricsNamespace, [
      { Name: 'Environment', Value: config.environment },
    ]),
  });

  const moveFileHandler = new MoveFileHandler(logger, config);

  return {
    logger,
    moveFileHandler,
    eventPublisher,
  };
}
