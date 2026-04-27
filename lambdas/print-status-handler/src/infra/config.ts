import { defaultConfigReader } from 'utils';

export type Config = {
  environment: string;
  eventPublisherEventBusArn: string;
  eventPublisherDlqUrl: string;
  dlMetricsNamespace: string;
};

export function loadConfig(): Config {
  return {
    environment: defaultConfigReader.getValue('ENVIRONMENT'),
    eventPublisherEventBusArn: defaultConfigReader.getValue(
      'EVENT_PUBLISHER_EVENT_BUS_ARN',
    ),
    eventPublisherDlqUrl: defaultConfigReader.getValue(
      'EVENT_PUBLISHER_DLQ_URL',
    ),
    dlMetricsNamespace: defaultConfigReader.getValue('DL_METRICS_NAMESPACE'),
  };
}
