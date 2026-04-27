import {
  EventPublisher,
  MetricHandler,
  dynamoDocumentClient,
  eventBridgeClient,
  logger,
  sqsClient,
} from 'utils';
import { loadConfig } from 'infra/config';
import { TtlRepository } from 'infra/ttl-repository';
import { TtlActions } from 'app/ttl-actions';

export const createContainer = () => {
  const {
    dlMetricsNamespace,
    environment,
    eventPublisherDlqUrl,
    eventPublisherEventBusArn,
    ttlTableName,
  } = loadConfig();

  const requestTtlRepository = new TtlRepository(
    ttlTableName,
    dynamoDocumentClient,
  );

  const ttlActions = new TtlActions(requestTtlRepository, logger);

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

  return {
    ttlActions,
    eventPublisher,
    logger,
  };
};

export default createContainer;
