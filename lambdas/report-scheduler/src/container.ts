import { loadConfig } from 'infra/config';
import { CreateHandlerDependencies } from 'apis/scheduled-event-handler';
import { SenderManagement } from 'sender-management';
import {
  EventPublisher,
  MetricHandler,
  ParameterStoreCache,
  eventBridgeClient,
  logger,
  sqsClient,
} from 'utils';

export const createContainer = (): CreateHandlerDependencies => {
  const {
    dlMetricsNamespace,
    environment,
    eventPublisherDlqUrl,
    eventPublisherEventBusArn,
  } = loadConfig();

  const parameterStore = new ParameterStoreCache();
  const senderManagement = SenderManagement({
    parameterStore,
  });

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

  return { senderManagement, eventPublisher };
};

export default createContainer;
