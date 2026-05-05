// Envar Based
// Environment Configuration
export const ENV = process.env.ENVIRONMENT || 'main';
export const REGION = process.env.AWS_REGION || 'eu-west-2';
export const { AWS_ACCOUNT_ID } = process.env;

if (!AWS_ACCOUNT_ID) {
  throw new Error('AWS_ACCOUNT_ID environment variable is not set');
}

export const AWS_ACCOUNT_ID_SAFE: string = AWS_ACCOUNT_ID;

// Compound Scope Indicator
export const CSI = `nhs-${ENV}-dl`;

// Lambda Names
export const MESH_POLL_LAMBDA_NAME = `${CSI}-mesh-poll`;
export const TTL_CREATE_LAMBDA_NAME = `${CSI}-ttl-create`;
export const TTL_POLL_LAMBDA_NAME = `${CSI}-ttl-poll`;
export const CORE_NOTIFIER_LAMBDA_NAME = `${CSI}-core-notifier`;
export const REPORT_EVENT_TRANSFORMER_LAMBDA_NAME = `${CSI}-report-event-transformer`;
export const REPORT_SCHEDULER_LAMBDA_NAME = `${CSI}-report-scheduler`;

// Queue Names
export const TTL_QUEUE_NAME = `${CSI}-ttl-queue`;
export const TTL_DLQ_NAME = `${CSI}-ttl-dlq`;
export const PDM_UPLOADER_DLQ_NAME = `${CSI}-pdm-uploader-dlq`;
export const MESH_DOWNLOAD_DLQ_NAME = `${CSI}-mesh-download-dlq`;
export const PDM_POLL_DLQ_NAME = `${CSI}-pdm-poll-dlq`;
export const MESH_ACKNOWLEDGE_DLQ_NAME = `${CSI}-mesh-acknowledge-dlq`;
export const CORE_NOTIFIER_DLQ_NAME = `${CSI}-core-notifier-dlq`;
export const FILE_SCANNER_DLQ_NAME = `${CSI}-file-scanner-dlq`;
export const PRINT_STATUS_HANDLER_DLQ_NAME = `${CSI}-print-status-handler-dlq`;
export const HANDLE_TTL_DLQ_NAME = `${CSI}-ttl-handle-expiry-errors-queue`;
export const CREATE_TTL_DLQ_NAME = `${CSI}-ttl-dlq`;
export const PRINT_ANALYSER_DLQ_NAME = `${CSI}-print-analyser-dlq`;
export const PRINT_SENDER_DLQ_NAME = `${CSI}-print-sender-dlq`;
export const MOVE_SCANNED_FILES_NAME = `${CSI}-move-scanned-files-queue`;
export const MOVE_SCANNED_FILES_DLQ_NAME = `${CSI}-move-scanned-files-dlq`;
export const REPORT_SENDER_DLQ_NAME = `${CSI}-report-sender-dlq`;
export const NHSAPP_STATUS_HANDLER_DLQ_NAME = `${CSI}-nhsapp-status-handler-dlq`;

// Queue Url Prefix
export const SQS_URL_PREFIX = `https://sqs.${REGION}.amazonaws.com/${AWS_ACCOUNT_ID}/`;

// Event Bus
export const EVENT_BUS_ARN = `arn:aws:events:${REGION}:${AWS_ACCOUNT_ID}:event-bus/${CSI}`;
export const EVENT_BUS_DLQ_URL = `${SQS_URL_PREFIX}${CSI}-event-publisher-errors-queue`;
export const EVENT_BUS_LOG_GROUP_NAME = `/aws/vendedlogs/events/event-bus/${CSI}`;

// DynamoDB
export const TTL_TABLE_NAME = `${CSI}-ttl`;

// Glue
export const GLUE_DATABASE_NAME = `${CSI}-reporting`;
export const GLUE_TABLE_NAME = 'event_record';

// S3
export const LETTERS_S3_BUCKET_NAME = `nhs-${process.env.AWS_ACCOUNT_ID}-${REGION}-${ENV}-dl-letters`;
export const NON_PII_S3_BUCKET_NAME = `nhs-${process.env.AWS_ACCOUNT_ID}-${REGION}-${ENV}-dl-non-pii-data`;
export const PII_S3_BUCKET_NAME = `nhs-${process.env.AWS_ACCOUNT_ID}-${REGION}-${ENV}-dl-pii-data`;
export const REPORTING_S3_FIREHOSE_OUTPUT_KEY_PREFIX = `kinesis-firehose-output/reporting/parquet/${GLUE_TABLE_NAME}`;
export const FILE_SAFE_S3_BUCKET_NAME = `nhs-${process.env.AWS_ACCOUNT_ID}-${REGION}-${ENV}-dl-file-safe`;
export const UNSCANNED_FILES_S3_BUCKET_NAME = `nhs-${process.env.AWS_ACCOUNT_ID}-${REGION}-main-acct-digi-unscanned-files`;
export const FILE_QUARANTINE_S3_BUCKET_NAME = `nhs-${process.env.AWS_ACCOUNT_ID}-${REGION}-${ENV}-dl-file-quarantine`;
export const REPORTING_S3_BUCKET_NAME = `nhs-${process.env.AWS_ACCOUNT_ID}-${REGION}-${ENV}-dl-reporting`;
// Files that are scanned by Guardduty are in a bucket prefixed by the environment.
export const PREFIX_DL_FILES = `${CSI}/`;

// Cloudwatch
export const PDM_UPLOADER_LAMBDA_LOG_GROUP_NAME = `/aws/lambda/${CSI}-pdm-uploader`;
export const PDM_POLL_LAMBDA_LOG_GROUP_NAME = `/aws/lambda/${CSI}-pdm-poll`;
export const CORE_NOTIFIER_LAMBDA_LOG_GROUP_NAME = `/aws/lambda/${CSI}-core-notifier`;
export const FILE_SCANNER_LAMBDA_LOG_GROUP_NAME = `/aws/lambda/${CSI}-file-scanner`;
export const PRINT_STATUS_HANDLER_LAMBDA_LOG_GROUP_NAME = `/aws/lambda/${CSI}-print-status-handler`;
export const PRINT_ANALYSER_LAMBDA_LOG_GROUP_NAME = `/aws/lambda/${CSI}-print-analyser`;
export const PRINT_SENDER_LAMBDA_LOG_GROUP_NAME = `/aws/lambda/${CSI}-print-sender`;
export const MOVE_SCANNED_FILES_LAMBDA_LOG_GROUP_NAME = `/aws/lambda/${CSI}-move-scanned-files`;
export const MESH_DOWNLOAD_LAMBDA_LOG_GROUP_NAME = `/aws/lambda/${CSI}-mesh-download`;
export const CREATE_TTL_LAMBDA_LOG_GROUP_NAME = `/aws/lambda/${CSI}-ttl-create`;
export const NHSAPP_STATUS_HANDLER_LAMBDA_LOG_GROUP_NAME = `/aws/lambda/${CSI}-nhsapp-status-handler`;

// Data Firehose
export const FIREHOSE_STREAM_NAME = `${CSI}-to-s3-reporting`;
export const TERRAFORM_DESTINATION_BUFFER_INTERVAL = 300;
export const TERRAFORM_PROCESSOR_BUFFER_INTERVAL = 301;
export const MINIMUM_DESTINATION_BUFFER_INTERVAL = 60;
export const MINIMUM_PROCESSOR_BUFFER_INTERVAL = 0;

// Athena
export const ATHENA_WORKGROUP_NAME = CSI;
