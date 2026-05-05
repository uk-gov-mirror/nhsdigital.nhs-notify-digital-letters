import { defaultConfigReader } from 'utils';

export type TtlCreateConfig = {
  ttlTableName: string;
  eventPublisherEventBusArn: string;
  eventPublisherDlqUrl: string;
};

export function loadConfig(): TtlCreateConfig {
  return {
    ttlTableName: defaultConfigReader.getValue('TTL_TABLE_NAME'),
    eventPublisherEventBusArn: defaultConfigReader.getValue(
      'EVENT_PUBLISHER_EVENT_BUS_ARN',
    ),
    eventPublisherDlqUrl: defaultConfigReader.getValue(
      'EVENT_PUBLISHER_DLQ_URL',
    ),
  };
}
