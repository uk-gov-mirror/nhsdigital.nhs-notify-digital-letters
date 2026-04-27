import {
  EventPublisher,
  MetricHandler,
  ParameterStoreCache,
  dynamoClient,
  eventBridgeClient,
  logger,
  sqsClient,
} from 'utils';
import { loadConfig } from 'infra/config';
import { TtlRepository } from 'infra/ttl-repository';
import { CreateTtl } from 'app/create-ttl';
import { SenderManagement } from 'sender-management';

export const createContainer = () => {
  const {
    dlMetricsNamespace,
    environment,
    eventPublisherDlqUrl,
    eventPublisherEventBusArn,
    ttlShardCount,
    ttlTableName,
  } = loadConfig();

  const parameterStore = new ParameterStoreCache();

  const senderRepository = SenderManagement({
    configOverrides: { environment },
    parameterStore,
  });

  const requestTtlRepository = new TtlRepository(
    ttlTableName,
    logger,
    dynamoClient,
    ttlShardCount,
    senderRepository,
  );

  const createTtl = new CreateTtl(requestTtlRepository, logger);

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
    createTtl,
    eventPublisher,
    logger,
  };
};

export default createContainer;
