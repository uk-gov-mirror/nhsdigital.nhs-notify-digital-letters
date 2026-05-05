import {
  EventPublisher,
  dynamoDocumentClient,
  eventBridgeClient,
  logger,
  sqsClient,
} from 'utils';
import { loadConfig } from 'infra/config';
import { TtlRepository } from 'infra/ttl-repository';
import { TtlActions } from 'app/ttl-actions';

export const createContainer = () => {
  const { eventPublisherDlqUrl, eventPublisherEventBusArn, ttlTableName } =
    loadConfig();

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
  });

  return {
    ttlActions,
    eventPublisher,
    logger,
  };
};

export default createContainer;
