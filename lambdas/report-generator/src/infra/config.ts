import { defaultConfigReader } from 'utils';

export type ReportGeneratorConfig = {
  athenaNamedQueryId: string;
  environment: string;
  eventPublisherEventBusArn: string;
  eventPublisherDlqUrl: string;
  dlMetricsNamespace: string;
  maxPollLimit: number;
  reportingBucket: string;
  reportName: string;
  waitForInSeconds: number;
};

export function loadConfig(): ReportGeneratorConfig {
  return {
    athenaNamedQueryId: defaultConfigReader.getValue('ATHENA_NAMED_QUERY_ID'),
    environment: defaultConfigReader.getValue('ENVIRONMENT'),
    eventPublisherEventBusArn: defaultConfigReader.getValue(
      'EVENT_PUBLISHER_EVENT_BUS_ARN',
    ),
    eventPublisherDlqUrl: defaultConfigReader.getValue(
      'EVENT_PUBLISHER_DLQ_URL',
    ),
    dlMetricsNamespace: defaultConfigReader.getValue('DL_METRICS_NAMESPACE'),
    maxPollLimit: defaultConfigReader.getInt('MAX_POLL_LIMIT'),
    reportingBucket: defaultConfigReader.getValue('REPORTING_BUCKET'),
    reportName: defaultConfigReader.getValue('REPORT_NAME'),
    waitForInSeconds: defaultConfigReader.getInt('WAIT_FOR_IN_SECONDS'),
  };
}
