import { defaultConfigReader } from 'utils';

export type SendRequestConfig = {
  environment: string;
  eventPublisherEventBusArn: string;
  eventPublisherDlqUrl: string;
  dlMetricsNamespace: string;
  dlqUrl: string;
};

export function loadConfig(): SendRequestConfig {
  return {
    environment: defaultConfigReader.getValue('ENVIRONMENT'),
    eventPublisherEventBusArn: defaultConfigReader.getValue(
      'EVENT_PUBLISHER_EVENT_BUS_ARN',
    ),
    eventPublisherDlqUrl: defaultConfigReader.getValue(
      'EVENT_PUBLISHER_DLQ_URL',
    ),
    dlMetricsNamespace: defaultConfigReader.getValue('DL_METRICS_NAMESPACE'),
    dlqUrl: defaultConfigReader.getValue('DLQ_URL'),
  };
}
