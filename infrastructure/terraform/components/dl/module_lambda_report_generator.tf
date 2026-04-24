module "report_generator" {
  source = "https://github.com/NHSDigital/nhs-notify-shared-modules/releases/download/3.0.6/terraform-lambda.zip"

  function_name = "report-generator"
  description   = "A function to generate reports from an event"

  aws_account_id = var.aws_account_id
  component      = local.component
  environment    = var.environment
  project        = var.project
  region         = var.region
  group          = var.group

  log_retention_in_days = var.log_retention_in_days
  kms_key_arn           = module.kms.key_arn

  iam_policy_document = {
    body = data.aws_iam_policy_document.report_generator_lambda.json
  }

  function_s3_bucket      = local.acct.s3_buckets["lambda_function_artefacts"]["id"]
  function_code_base_path = local.aws_lambda_functions_dir_path
  function_code_dir       = "report-generator/dist"
  function_include_common = true
  handler_function_name   = "handler"
  runtime                 = "nodejs22.x"
  memory                  = 256
  timeout                 = 60
  log_level               = var.log_level

  force_lambda_code_deploy = var.force_lambda_code_deploy
  enable_lambda_insights   = false

  log_destination_arn       = local.log_destination_arn
  log_subscription_role_arn = local.acct.log_subscription_role_arn

  lambda_env_vars = {
    "ATHENA_NAMED_QUERY_ID"         = aws_athena_named_query.daily_report.id
    "EVENT_PUBLISHER_EVENT_BUS_ARN" = aws_cloudwatch_event_bus.main.arn
    "EVENT_PUBLISHER_DLQ_URL"       = module.sqs_event_publisher_errors.sqs_queue_url
    "MAX_POLL_LIMIT"                = var.athena_query_max_polling_attempts
    "REPORTING_BUCKET"              = module.s3bucket_reporting.bucket
    "REPORT_NAME"                   = "completed_communications"
    "WAIT_FOR_IN_SECONDS"           = var.athena_query_polling_time_seconds
    "DL_METRICS_NAMESPACE"          = local.metrics_namespace_name
  }
}

data "aws_iam_policy_document" "report_generator_lambda" {
  statement {
    sid    = "AllowS3Get"
    effect = "Allow"

    actions = [
      "s3:PutObject",
      "s3:GetObject",
      "s3:GetBucketLocation",
      "s3:ListBucket"
    ]

    resources = [
      "${module.s3bucket_reporting.arn}/*",
      "${module.s3bucket_reporting.arn}"
    ]
  }

  statement {
    sid    = "KMSPermissions"
    effect = "Allow"

    actions = [
      "kms:Decrypt",
      "kms:GenerateDataKey",
    ]

    resources = [
      module.kms.key_arn,
    ]
  }

  statement {
    sid    = "AllowAthenaAccess"
    effect = "Allow"

    actions = [
      "athena:StartQueryExecution",
      "athena:GetQueryResults",
      "athena:GetQueryExecution",
      "athena:GetNamedQuery"
    ]

    resources = [
      "arn:aws:athena:${var.region}:${var.aws_account_id}:workgroup/${aws_athena_workgroup.reporting.name}"
    ]
  }

  statement {
    sid    = "AllowGlueAccess"
    effect = "Allow"

    actions = [
      "glue:GetTable",
      "glue:GetDatabase",
      "glue:GetPartition",
      "glue:GetPartitions",
    ]

    resources = [
      "arn:aws:glue:${var.region}:${var.aws_account_id}:catalog",
      "arn:aws:glue:${var.region}:${var.aws_account_id}:database/${aws_glue_catalog_database.reporting.name}",
      "arn:aws:glue:${var.region}:${var.aws_account_id}:table/${aws_glue_catalog_database.reporting.name}/*"
    ]
  }

  statement {
    sid    = "SQSPermissionsReportGeneratorQueue"
    effect = "Allow"

    actions = [
      "sqs:ReceiveMessage",
      "sqs:DeleteMessage",
      "sqs:GetQueueAttributes",
      "sqs:GetQueueUrl",
    ]

    resources = [
      module.sqs_report_generator.sqs_queue_arn,
    ]
  }

  statement {
    sid    = "PutEvents"
    effect = "Allow"

    actions = [
      "events:PutEvents",
    ]

    resources = [
      aws_cloudwatch_event_bus.main.arn,
    ]
  }

  statement {
    sid    = "SQSPermissionsEventPublisherDLQ"
    effect = "Allow"

    actions = [
      "sqs:SendMessage",
      "sqs:SendMessageBatch",
    ]

    resources = [
      module.sqs_event_publisher_errors.sqs_queue_arn,
    ]
  }
}
