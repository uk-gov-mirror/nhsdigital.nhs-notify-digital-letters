import { defaultConfigReader } from 'utils';

export type TtlCreateConfig = {
  environment: string;
  ttlTableName: string;
  eventPublisherEventBusArn: string;
  eventPublisherDlqUrl: string;
  dlMetricsNamespace: string;
};

export function loadConfig(): TtlCreateConfig {
  return {
    environment: defaultConfigReader.getValue('ENVIRONMENT'),
    ttlTableName: defaultConfigReader.getValue('TTL_TABLE_NAME'),
    eventPublisherEventBusArn: defaultConfigReader.getValue(
      'EVENT_PUBLISHER_EVENT_BUS_ARN',
    ),
    eventPublisherDlqUrl: defaultConfigReader.getValue(
      'EVENT_PUBLISHER_DLQ_URL',
    ),
    dlMetricsNamespace: defaultConfigReader.getValue('DL_METRICS_NAMESPACE'),
  };
}
