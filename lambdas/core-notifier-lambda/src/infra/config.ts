import { defaultConfigReader } from 'utils';

export type NotifySendMessageConfig = {
  eventPublisherEventBusArn: string;
  eventPublisherDlqUrl: string;
  apimAccessTokenSsmParameterName: string;
  apimBaseUrl: string;
  nhsAppBaseUrl: string;
  environment: string;
};

export function loadConfig(): NotifySendMessageConfig {
  return {
    eventPublisherEventBusArn: defaultConfigReader.getValue(
      'EVENT_PUBLISHER_EVENT_BUS_ARN',
    ),
    eventPublisherDlqUrl: defaultConfigReader.getValue(
      'EVENT_PUBLISHER_DLQ_URL',
    ),
    apimAccessTokenSsmParameterName: defaultConfigReader.getValue(
      'APIM_ACCESS_TOKEN_SSM_PARAMETER_NAME',
    ),
    apimBaseUrl: defaultConfigReader.getValue('APIM_BASE_URL'),
    nhsAppBaseUrl: defaultConfigReader.getValue('NHS_APP_BASE_URL'),
    environment: defaultConfigReader.getValue('ENVIRONMENT'),
  };
}
