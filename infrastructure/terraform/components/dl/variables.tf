##
# Basic Required Variables for tfscaffold Components
##

variable "project" {
  type        = string
  description = "The name of the tfscaffold project"
}

variable "environment" {
  type        = string
  description = "The name of the tfscaffold environment"
}

variable "aws_account_id" {
  type        = string
  description = "The AWS Account ID (numeric)"
}

variable "shared_infra_account_id" {
  type        = string
  description = "The AWS Shared Infra Account ID (numeric)"
}

variable "region" {
  type        = string
  description = "The AWS Region"
}

variable "group" {
  type        = string
  description = "The group variables are being inherited from (often synonmous with account short-name)"
}

##
# tfscaffold variables specific to this component
##

# This is the only primary variable to have its value defined as
# a default within its declaration in this file, because the variables
# purpose is as an identifier unique to this component, rather
# then to the environment from where all other variables come.
variable "component" {
  type        = string
  description = "The variable encapsulating the name of this component"
  default     = "dl"
}

variable "default_tags" {
  type        = map(string)
  description = "A map of default tags to apply to all taggable resources within the component"
  default     = {}
}

##
# Variables specific to the component
##

variable "log_retention_in_days" {
  type        = number
  description = "The retention period in days for the Cloudwatch Logs events to be retained, default of 0 is indefinite"
  default     = 0
}

variable "kms_deletion_window" {
  type        = string
  description = "When a kms key is deleted, how long should it wait in the pending deletion state?"
  default     = "30"
}

variable "log_level" {
  type        = string
  description = "The log level to be used in lambda functions within the component. Any log with a lower severity than the configured value will not be logged: https://docs.python.org/3/library/logging.html#levels"
  default     = "INFO"
}

variable "force_lambda_code_deploy" {
  type        = bool
  description = "If the lambda package in s3 has the same commit id tag as the terraform build branch, the lambda will not update automatically. Set to True if making changes to Lambda code from on the same commit for example during development"
  default     = false
}

variable "parent_acct_environment" {
  type        = string
  description = "Name of the environment responsible for the acct resources used, affects things like DNS zone. Useful for named dev environments"
  default     = "main"
}

variable "mesh_poll_schedule" {
  type        = string
  description = "Schedule to poll MESH for messages"
  default     = "rate(5 minutes)" # Every 5 minutes
}

variable "enable_mock_mesh" {
  description = "Enable mock mesh access (dev only). Grants lambda permission to read mock-mesh prefix in non-pii bucket."
  type        = bool
  default     = false
}

variable "queue_batch_size" {
  type        = number
  description = "maximum number of queue items to process"
  default     = 10
}

variable "queue_batch_window_seconds" {
  type        = number
  description = "maximum time in seconds between processing events"
  default     = 1
}

variable "enable_dynamodb_delete_protection" {
  type        = bool
  description = "Enable DynamoDB Delete Protection on all Tables"
  default     = true
}

variable "ttl_poll_schedule" {
  type        = string
  description = "Schedule to poll for any overdue TTL records"
  default     = "rate(10 minutes)" # Every 10 minutes
}

variable "apim_base_url" {
  type        = string
  description = "The URL used to send requests to PDM"
  default     = "https://int.api.service.nhs.uk"
}

variable "nhs_app_base_url" {
  type        = string
  description = "The URL used to build the NHS App resource URL"
  default     = "https://example.com"
}

variable "core_notify_url" {
  type        = string
  description = "The URL used to send requests to Notify"
  default     = "https://sandbox.api.service.nhs.uk"
}

variable "core_notify_include_auth_header" {
  type        = bool
  description = "Whether to send auth tokens with core notify API calls."
  default     = true

  validation {
    condition     = var.environment == "prod" ? var.core_notify_include_auth_header == true : true
    error_message = "core_notify_include_auth_header must be set to true when environment is 'prod'."
  }
}

variable "apim_auth_token_url" {
  type        = string
  description = "URL to generate an APIM auth token"
  default     = "https://int.api.service.nhs.uk/oauth2/token"
}

variable "apim_keygen_schedule" {
  type        = string
  description = "Schedule to refresh key pairs if necessary"
  default     = "cron(0 14 * * ? *)"
}

variable "apim_auth_token_schedule" {
  type        = string
  description = "Schedule to renew the APIM auth token"
  default     = "rate(9 minutes)"
}

variable "force_destroy" {
  type        = bool
  description = "Flag to force deletion of S3 buckets"
  default     = false

  validation {
    condition     = !(var.force_destroy && var.environment == "prod")
    error_message = "force_destroy must not be set to true when environment is 'prod'."
  }
}

variable "enable_pdm_mock" {
  type        = bool
  description = "Flag indicating whether to deploy PDM mock API (should be false in production environments)"
  default     = false
}

variable "aws_account_type" {
  type        = string
  description = "The AWS Account Type"
}

variable "eventpub_control_plane_bus_arn" {
  type        = string
  description = "Event publisher control plane"
}

variable "eventpub_data_plane_bus_arn" {
  type        = string
  description = "Event publisher data plane"
}

variable "report_scheduler_schedule" {
  type        = string
  description = "Schedule to trigger sender reports"
  default     = "cron(30 4 * * ? *)" # Daily at 04:30
}

variable "pii_data_retention_policy_days" {
  type        = number
  description = "The number of days for data retention policy for PII"
  default     = 534
}

variable "pii_data_retention_non_current_days" {
  type        = number
  description = "The number of non current days for data retention policy for PII"
  default     = 14
}

variable "reports_data_retention_policy_days" {
  type        = number
  description = "The number of days for data retention policy for reports generated by Athena in the reporting bucket"
  default     = 90
}

variable "reports_data_retention_non_current_days" {
  type        = number
  description = "The number of non current days for data retention policy for reports generated by Athena in the reporting bucket"
  default     = 14
}

variable "default_cloudwatch_event_bus_name" {
  type        = string
  description = "The name of the default cloudwatch event bus. This is needed as GuardDuty Scan Result events are sent to the default bus"
  default     = "default"
}

variable "metadata_refresh_schedule" {
  type        = string
  description = "Schedule for refreshing reporting metadata."
  default     = "cron(10 6-22 * * ? *)" # 10 minutes past the hour, between 06:00 - 22:00
}

variable "athena_query_max_polling_attempts" {
  type        = number
  description = "The number of times athena will be polled to check if a query is completed"
  default     = 3
}

variable "athena_query_polling_time_seconds" {
  type        = number
  description = "The amount of time in seconds to wait between each athena poll"
  default     = 15
}

variable "sqs_max_receive_count" {
  type        = string
  description = "Maximum number of times a message can be received before being sent to the DLQ"
  default     = "3"
}

variable "sqs_visibility_timeout_seconds" {
  type        = string
  description = "The visibility timeout of the SQS queues. AWS recommends this timeout to be at least 6 times the function timeout (lambda_timeout_seconds), see https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/sqs-configure-lambda-function-trigger.html"
  default     = "270"
}

variable "lambda_timeout_seconds" {
  type        = string
  description = "The timeout of the lambdas that are triggered by SQS. "
  default     = "45"
}

variable "enable_event_cache" {
  type        = bool
  description = "Enable caching of events to an S3 bucket"
  default     = true
}

variable "enable_sns_delivery_logging" {
  type        = bool
  description = "Enable SNS Delivery Failure Notifications"
  default     = true
}

variable "sns_success_logging_sample_percent" {
  type        = number
  description = "Enable SNS Delivery Successful Sample Percentage"
  default     = 0
}

variable "enable_event_anomaly_detection" {
  type        = bool
  description = "Enable CloudWatch anomaly detection alarm for core notifier queue message reception"
  default     = true
}

variable "event_anomaly_evaluation_periods" {
  type        = number
  description = "Number of evaluation periods for the anomaly alarm. Each period is defined by event_anomaly_period."
  default     = 2
}

variable "event_anomaly_period" {
  type        = number
  description = "The period in seconds over which the specified statistic is applied for anomaly detection. Minimum 300 seconds (5 minutes). Recommended: 300-600."
  default     = 300
}

variable "event_anomaly_band_width" {
  type        = number
  description = "The width of the anomaly detection band. Higher values (e.g. 4-6) reduce sensitivity and noise, lower values (e.g. 2-3) increase sensitivity. Recommended: 2-4."
  default     = 3

  validation {
    condition     = var.event_anomaly_band_width >= 2 && var.event_anomaly_band_width <= 10
    error_message = "Band width must be between 2 and 10"
  }
}
