import { defaultConfigReader } from 'utils';

export type PrintSenderConfig = {
  eventPublisherEventBusArn: string;
  eventPublisherDlqUrl: string;
  dlMetricsNamespace: string;
  environment: string;
  accountType: string;
};

export function loadConfig(): PrintSenderConfig {
  return {
    eventPublisherEventBusArn: defaultConfigReader.getValue(
      'EVENT_PUBLISHER_EVENT_BUS_ARN',
    ),
    eventPublisherDlqUrl: defaultConfigReader.getValue(
      'EVENT_PUBLISHER_DLQ_URL',
    ),
    dlMetricsNamespace: defaultConfigReader.getValue('DL_METRICS_NAMESPACE'),
    environment: defaultConfigReader.getValue('ENVIRONMENT'),
    accountType: defaultConfigReader.getValue('ACCOUNT_TYPE'),
  };
}
