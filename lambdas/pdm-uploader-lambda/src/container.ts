import {
  EventPublisher,
  MetricHandler,
  ParameterStoreCache,
  PdmClient,
  createGetApimAccessToken,
  eventBridgeClient,
  logger,
  sqsClient,
} from 'utils';
import { loadConfig } from 'infra/config';
import { UploadToPdm } from 'app/upload-to-pdm';

export const createContainer = () => {
  const {
    apimAccessTokenSsmParameterName,
    apimBaseUrl,
    dlMetricsNamespace,
    environment,
    eventPublisherDlqUrl,
    eventPublisherEventBusArn,
  } = loadConfig();

  const parameterStore = new ParameterStoreCache();

  const accessTokenRepository = {
    getAccessToken: createGetApimAccessToken(
      apimAccessTokenSsmParameterName,
      logger,
      parameterStore,
    ),
  };

  const pdmClient = new PdmClient(apimBaseUrl, accessTokenRepository, logger);

  const uploadToPdm = new UploadToPdm(pdmClient, logger);

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
    uploadToPdm,
    eventPublisher,
    logger,
  };
};

export default createContainer;
