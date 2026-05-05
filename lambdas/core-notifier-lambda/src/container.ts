import {
  EventPublisher,
  ParameterStoreCache,
  createGetApimAccessToken,
  eventBridgeClient,
  logger,
  sqsClient,
} from 'utils';
import { NotifyClient } from 'app/notify-api-client';
import { NotifyMessageProcessor } from 'app/notify-message-processor';
import type { SqsHandlerDependencies } from 'apis/sqs-handler';
import { loadConfig } from 'infra/config';
import { SenderManagement } from 'sender-management';
import { CoreRequestMapper } from 'domain/core-request-mapper';
import { MessageRequestSubmittedMapper } from 'domain/message-request-submitted-mapper';
import { MessageRequestRejectedMapper } from 'domain/message-request-rejected-mapper';

export async function createContainer(): Promise<SqsHandlerDependencies> {
  const parameterStore = new ParameterStoreCache();
  const config = loadConfig();
  const senderManagement = SenderManagement({
    parameterStore,
  });

  const accessTokenRepository = {
    getAccessToken: createGetApimAccessToken(
      config.apimAccessTokenSsmParameterName,
      logger,
      parameterStore,
    ),
  };

  const notifyClient = new NotifyClient(
    config.apimBaseUrl,
    accessTokenRepository,
    logger,
  );

  const notifyMessageProcessor = new NotifyMessageProcessor({
    nhsNotifyClient: notifyClient,
    logger,
  });

  const { eventPublisherDlqUrl, eventPublisherEventBusArn } = config;

  const eventPublisher = new EventPublisher({
    eventBusArn: eventPublisherEventBusArn,
    dlqUrl: eventPublisherDlqUrl,
    logger,
    sqsClient,
    eventBridgeClient,
  });

  const coreRequestMapper = new CoreRequestMapper(config.nhsAppBaseUrl);

  const messageRequestSubmittedMapper = new MessageRequestSubmittedMapper(
    config.nhsAppBaseUrl,
  );

  const messageRequestRejectedMapper = new MessageRequestRejectedMapper(
    config.nhsAppBaseUrl,
  );

  return {
    logger,
    notifyMessageProcessor,
    senderManagement,
    eventPublisher,
    coreRequestMapper,
    messageRequestSubmittedMapper,
    messageRequestRejectedMapper,
  };
}
