module "report_sender" {
  source = "https://github.com/NHSDigital/nhs-notify-shared-modules/releases/download/3.0.6/terraform-lambda.zip"

  function_name  = "report-sender"
  description    = "A lambda function for sending reports to Trusts via MESH messages"
  aws_account_id = var.aws_account_id
  component      = local.component
  environment    = var.environment
  project        = var.project
  region         = var.region
  group          = var.group

  log_retention_in_days = var.log_retention_in_days
  kms_key_arn           = module.kms.key_arn

  iam_policy_document = {
    body = data.aws_iam_policy_document.report_sender_lambda.json
  }

  function_s3_bucket      = local.acct.s3_buckets["lambda_function_artefacts"]["id"]
  function_code_base_path = local.aws_lambda_functions_dir_path
  function_code_dir       = "report-sender/target/dist"
  function_include_common = true
  function_module_name    = "report_sender"
  handler_function_name   = "handler.handler"
  runtime                 = "python3.14"
  memory                  = 256
  timeout                 = var.lambda_timeout_seconds
  log_level               = var.log_level

  force_lambda_code_deploy = var.force_lambda_code_deploy
  enable_lambda_insights   = false

  log_destination_arn       = local.log_destination_arn
  log_subscription_role_arn = local.acct.log_subscription_role_arn

  lambda_env_vars = {
    REPORT_SENDER_METRIC_NAME      = "report-sender-successful-sends"
    REPORT_SENDER_METRIC_NAMESPACE = "dl-report-sender"
    DLQ_URL                        = module.sqs_report_sender.sqs_dlq_url
    ENVIRONMENT                    = var.environment
    EVENT_PUBLISHER_DLQ_URL        = module.sqs_event_publisher_errors.sqs_queue_url
    EVENT_PUBLISHER_EVENT_BUS_ARN  = aws_cloudwatch_event_bus.main.arn
    MOCK_MESH_BUCKET               = module.s3bucket_non_pii_data.bucket
    SSM_MESH_PREFIX                = local.ssm_mesh_prefix
    SSM_SENDERS_PREFIX             = local.ssm_senders_prefix
    USE_MESH_MOCK                  = var.enable_mock_mesh ? "true" : "false"
  }

}

data "aws_iam_policy_document" "report_sender_lambda" {
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
    sid    = "SQSPermissions"
    effect = "Allow"

    actions = [
      "sqs:ReceiveMessage",
      "sqs:DeleteMessage",
      "sqs:GetQueueAttributes",
    ]

    resources = [
      module.sqs_report_sender.sqs_queue_arn,
    ]
  }

  statement {
    sid    = "SQSDLQPermissions"
    effect = "Allow"

    actions = [
      "sqs:SendMessage",
    ]

    resources = [
      module.sqs_report_sender.sqs_dlq_arn,
    ]
  }

  statement {
    sid    = "EventBridgePermissions"
    effect = "Allow"

    actions = [
      "events:PutEvents",
    ]

    resources = [
      aws_cloudwatch_event_bus.main.arn,
    ]
  }

  statement {
    sid    = "DLQPermissions"
    effect = "Allow"

    actions = [
      "sqs:SendMessage",
      "sqs:SendMessageBatch",
    ]

    resources = [
      module.sqs_event_publisher_errors.sqs_queue_arn,
    ]
  }

  statement {
    sid    = "SSMPermissions"
    effect = "Allow"

    actions = [
      "ssm:GetParameter",
      "ssm:GetParametersByPath",
    ]

    resources = [
      "arn:aws:ssm:${var.region}:${var.aws_account_id}:parameter${local.ssm_prefix}/*"
    ]
  }

  statement {
    sid    = "S3BucketPermissions"
    effect = "Allow"

    actions = [
      "s3:GetObject",
    ]

    resources = [
      "${module.s3bucket_reporting.arn}/*",
    ]
  }

  # Grant S3 PutObject permissions for the mock-mesh directory only when the mock is enabled
  dynamic "statement" {
    for_each = var.enable_mock_mesh ? [1] : []
    content {
      sid    = "MockMeshPutObject"
      effect = "Allow"

      actions = [
        "s3:PutObject",
      ]

      resources = [
        "${module.s3bucket_non_pii_data.arn}/mock-mesh/*"
      ]
    }
  }
}
