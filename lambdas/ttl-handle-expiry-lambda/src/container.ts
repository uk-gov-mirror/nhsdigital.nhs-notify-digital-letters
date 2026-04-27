import {
  EventPublisher,
  MetricHandler,
  eventBridgeClient,
  logger,
  sqsClient,
} from 'utils';
import { CreateHandlerDependencies } from 'apis/dynamodb-stream-handler';
import { loadConfig } from 'infra/config';
import { Dlq } from 'app/dlq';

export const createContainer = (): CreateHandlerDependencies => {
  const {
    dlMetricsNamespace,
    dlqUrl,
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

  const dlq = new Dlq({
    dlqUrl,
    sqsClient,
    logger,
  });

  return { eventPublisher, logger, dlq };
};

export default createContainer;
