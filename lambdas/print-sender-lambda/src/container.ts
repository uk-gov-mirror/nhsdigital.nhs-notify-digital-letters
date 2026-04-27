import {
  EventPublisher,
  MetricHandler,
  eventBridgeClient,
  logger,
  sqsClient,
} from 'utils';
import { loadConfig } from 'infra/config';
import { PrintSender } from 'app/print-sender';

export const createContainer = () => {
  const {
    accountType,
    dlMetricsNamespace,
    environment,
    eventPublisherDlqUrl,
    eventPublisherEventBusArn,
  } = loadConfig();

  const metricHandler = new MetricHandler(dlMetricsNamespace, [
    { Name: 'Environment', Value: environment },
  ]);

  const eventPublisher = new EventPublisher({
    eventBusArn: eventPublisherEventBusArn,
    dlqUrl: eventPublisherDlqUrl,
    logger,
    sqsClient,
    eventBridgeClient,
    metricHandler,
  });

  const printSender = new PrintSender(
    eventPublisher,
    environment,
    accountType,
    logger,
  );

  return {
    printSender,
    logger,
  };
};

export default createContainer;
