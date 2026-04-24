module "ttl_handle_expiry" {
  source = "https://github.com/NHSDigital/nhs-notify-shared-modules/releases/download/3.0.6/terraform-lambda.zip"

  function_name = "ttl-handle-expiry"
  description   = "A function for handling deleted TTL records"

  aws_account_id = var.aws_account_id
  component      = local.component
  environment    = var.environment
  project        = var.project
  region         = var.region
  group          = var.group

  log_retention_in_days = var.log_retention_in_days
  kms_key_arn           = module.kms.key_arn

  iam_policy_document = {
    body = data.aws_iam_policy_document.ttl_handle_expiry_lambda.json
  }

  function_s3_bucket      = local.acct.s3_buckets["lambda_function_artefacts"]["id"]
  function_code_base_path = local.aws_lambda_functions_dir_path
  function_code_dir       = "ttl-handle-expiry-lambda/dist"
  function_include_common = true
  handler_function_name   = "handler"
  runtime                 = "nodejs22.x"
  memory                  = 256
  timeout                 = var.lambda_timeout_seconds
  log_level               = var.log_level

  force_lambda_code_deploy = var.force_lambda_code_deploy
  enable_lambda_insights   = false

  log_destination_arn       = local.log_destination_arn
  log_subscription_role_arn = local.acct.log_subscription_role_arn

  lambda_env_vars = {
    "EVENT_PUBLISHER_EVENT_BUS_ARN" = aws_cloudwatch_event_bus.main.arn
    "EVENT_PUBLISHER_DLQ_URL"       = module.sqs_event_publisher_errors.sqs_queue_url
    "DLQ_URL"                       = module.sqs_ttl_handle_expiry_errors.sqs_queue_url
    "DL_METRICS_NAMESPACE"          = local.metrics_namespace_name
  }
}

data "aws_iam_policy_document" "ttl_handle_expiry_lambda" {
  statement {
    sid    = "AllowTtlDynamoAccess"
    effect = "Allow"

    actions = [
      "dynamodb:DescribeStream",
      "dynamodb:GetRecords",
      "dynamodb:GetShardIterator",
      "dynamodb:ListStreams",
    ]

    resources = [
      aws_dynamodb_table.ttl.stream_arn
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
    sid    = "SQSPermissionsDLQs"
    effect = "Allow"

    actions = [
      "sqs:SendMessage",
      "sqs:SendMessageBatch",
    ]

    resources = [
      module.sqs_ttl_handle_expiry_errors.sqs_queue_arn,
      module.sqs_event_publisher_errors.sqs_queue_arn,
    ]
  }
}
