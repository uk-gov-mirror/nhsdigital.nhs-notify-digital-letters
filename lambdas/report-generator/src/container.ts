import {
  AthenaDataRepository,
  AthenaDataRepositoryDependencies,
  EventPublisher,
  MetricHandler,
  ReportService,
  S3StorageRepository,
  eventBridgeClient,
  logger,
  region,
  s3Client,
  sqsClient,
} from 'utils';
import { loadConfig } from 'infra/config';
import { ReportGenerator } from 'app/report-generator';
import { AthenaClient } from '@aws-sdk/client-athena';

export const createContainer = () => {
  const {
    athenaNamedQueryId,
    dlMetricsNamespace,
    environment,
    eventPublisherDlqUrl,
    eventPublisherEventBusArn,
    maxPollLimit,
    reportName,
    reportingBucket,
    waitForInSeconds,
  } = loadConfig();

  const athenaClient = new AthenaClient({
    region: region(),
  });

  const dataRepositoryDependencies: AthenaDataRepositoryDependencies = {
    athenaClient,
  };

  const dataRepository = new AthenaDataRepository(dataRepositoryDependencies);

  const storageRepository = new S3StorageRepository({
    s3Client,
    reportingBucketName: reportingBucket,
    logger,
  });

  const reportService = new ReportService(
    dataRepository,
    storageRepository,
    maxPollLimit,
    waitForInSeconds,
    logger,
  );

  const reportGenerator = new ReportGenerator(
    logger,
    reportService,
    reportName,
    athenaNamedQueryId,
  );

  const metricHandler = new MetricHandler(dlMetricsNamespace, [
    { Name: 'Environment', Value: environment },
  ]);

  const eventPublisher = new EventPublisher({
    eventBusArn: eventPublisherEventBusArn,
    dlqUrl: eventPublisherDlqUrl,
    logger,
    sqsClient,
    eventBridgeClient,
    metricHandler,
  });

  return {
    reportGenerator,
    eventPublisher,
    logger,
  };
};

export default createContainer;
