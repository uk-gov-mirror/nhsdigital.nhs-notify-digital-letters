import { HandlerDependencies } from 'apis/sqs-handler';
import { loadConfig } from 'infra/config';
import {
  EventPublisher,
  MetricHandler,
  eventBridgeClient,
  logger,
  sqsClient,
} from 'utils';

export const createContainer = (): HandlerDependencies => {
  const {
    dlMetricsNamespace,
    environment,
    eventPublisherDlqUrl,
    eventPublisherEventBusArn,
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

  return { eventPublisher, logger };
};

export default createContainer;
