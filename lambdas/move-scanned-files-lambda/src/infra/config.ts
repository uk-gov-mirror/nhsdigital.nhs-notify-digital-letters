import { defaultConfigReader } from 'utils';

export type MoveScannedFilesConfig = {
  eventPublisherEventBusArn: string;
  eventPublisherDlqUrl: string;
  dlMetricsNamespace: string;
  environment: string;
  unscannedFileS3BucketName: string;
  safeFileS3BucketName: string;
  quarantineFileS3BucketName: string;
  keyPrefixUnscannedFiles: string;
};

export function loadConfig(): MoveScannedFilesConfig {
  return {
    eventPublisherEventBusArn: defaultConfigReader.getValue(
      'EVENT_PUBLISHER_EVENT_BUS_ARN',
    ),
    eventPublisherDlqUrl: defaultConfigReader.getValue(
      'EVENT_PUBLISHER_DLQ_URL',
    ),
    dlMetricsNamespace: defaultConfigReader.getValue('DL_METRICS_NAMESPACE'),
    // There is a limitation of how many buckets can be scanned with GuardDuty per account.
    // As DL will share the same bucket with other services, this is a safeguard to only process events for files for digital letters.
    keyPrefixUnscannedFiles: defaultConfigReader.getValue(
      'KEY_PREFIX_UNSCANNED_FILES',
    ),
    unscannedFileS3BucketName: defaultConfigReader.getValue(
      'UNSCANNED_FILE_S3_BUCKET_NAME',
    ),
    safeFileS3BucketName: defaultConfigReader.getValue(
      'SAFE_FILE_S3_BUCKET_NAME',
    ),
    quarantineFileS3BucketName: defaultConfigReader.getValue(
      'QUARANTINE_FILE_S3_BUCKET_NAME',
    ),
    environment: defaultConfigReader.getValue('ENVIRONMENT'),
  };
}
