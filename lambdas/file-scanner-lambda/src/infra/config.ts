import { logger } from 'utils';

export interface Config {
  documentReferenceBucket: string;
  unscannedFilesBucket: string;
  unscannedFilesPathPrefix: string;
  eventPublisherEventBusArn: string;
  eventPublisherDlqUrl: string;
  dlMetricsNamespace: string;
}

export function loadConfig(): Config {
  const documentReferenceBucket = process.env.DOCUMENT_REFERENCE_BUCKET;
  const unscannedFilesBucket = process.env.UNSCANNED_FILES_BUCKET;
  const unscannedFilesPathPrefix = process.env.UNSCANNED_FILES_PATH_PREFIX;
  const eventPublisherEventBusArn = process.env.EVENT_PUBLISHER_EVENT_BUS_ARN;
  const eventPublisherDlqUrl = process.env.EVENT_PUBLISHER_DLQ_URL;
  const dlMetricsNamespace = process.env.DL_METRICS_NAMESPACE;

  if (!documentReferenceBucket) {
    throw new Error('DOCUMENT_REFERENCE_BUCKET is not set');
  }

  if (!unscannedFilesBucket) {
    throw new Error('UNSCANNED_FILES_BUCKET is not set');
  }

  if (!unscannedFilesPathPrefix) {
    throw new Error('UNSCANNED_FILES_PATH_PREFIX is not set');
  }

  if (!eventPublisherEventBusArn) {
    throw new Error('EVENT_PUBLISHER_EVENT_BUS_ARN is not set');
  }

  if (!eventPublisherDlqUrl) {
    throw new Error('EVENT_PUBLISHER_DLQ_URL is not set');
  }
  if (!dlMetricsNamespace) {
    throw new Error('DL_METRICS_NAMESPACE is not set');
  }

  logger.info({
    description: 'Configuration loaded',
    documentReferenceBucket,
    unscannedFilesBucket,
    unscannedFilesPathPrefix,
    dlMetricsNamespace,
  });

  return {
    documentReferenceBucket,
    unscannedFilesBucket,
    unscannedFilesPathPrefix,
    eventPublisherEventBusArn,
    eventPublisherDlqUrl,
    dlMetricsNamespace,
  };
}
