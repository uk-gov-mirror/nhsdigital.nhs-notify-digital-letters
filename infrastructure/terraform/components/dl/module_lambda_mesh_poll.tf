module "mesh_poll" {
  source = "https://github.com/NHSDigital/nhs-notify-shared-modules/releases/download/3.0.6/terraform-lambda.zip"

  function_name = "mesh-poll"
  description   = "A lambda function for polling MESH inbox for new messages"

  aws_account_id = var.aws_account_id
  component      = local.component
  environment    = var.environment
  project        = var.project
  region         = var.region
  group          = var.group

  log_retention_in_days = var.log_retention_in_days
  kms_key_arn           = module.kms.key_arn

  iam_policy_document = {
    body = data.aws_iam_policy_document.mesh_poll_lambda.json
  }

  function_s3_bucket      = local.acct.s3_buckets["lambda_function_artefacts"]["id"]
  function_code_base_path = local.aws_lambda_functions_dir_path
  function_code_dir       = "mesh-poll/target/dist"
  function_include_common = true
  function_module_name    = "mesh_poll"
  handler_function_name   = "handler.handler"
  runtime                 = "python3.14"
  memory                  = 256
  timeout                 = 300
  log_level               = var.log_level
  schedule                = var.mesh_poll_schedule

  force_lambda_code_deploy = var.force_lambda_code_deploy
  enable_lambda_insights   = false

  log_destination_arn       = local.log_destination_arn
  log_subscription_role_arn = local.acct.log_subscription_role_arn

  lambda_env_vars = {
    CERTIFICATE_EXPIRY_METRIC_NAME      = "mesh-poll-client-certificate-near-expiry"
    CERTIFICATE_EXPIRY_METRIC_NAMESPACE = "dl-mesh-poll"
    ENVIRONMENT                         = var.environment
    EVENT_PUBLISHER_DLQ_URL             = module.sqs_event_publisher_errors.sqs_queue_url
    EVENT_PUBLISHER_EVENT_BUS_ARN       = aws_cloudwatch_event_bus.main.arn
    LAMBDA_TIMEOUT_BUFFER_MILLISECONDS  = "60000" # 1 minute, to leave time for mesh-download to acknowledge the message before we run again.
    POLLING_METRIC_NAME                 = "mesh-poll-successful-polls"
    POLLING_METRIC_NAMESPACE            = "dl-mesh-poll"
    SSM_MESH_PREFIX                     = local.ssm_mesh_prefix
    SSM_SENDERS_PREFIX                  = local.ssm_senders_prefix
    USE_MESH_MOCK                       = var.enable_mock_mesh ? "true" : "false"
  }

}

data "aws_iam_policy_document" "mesh_poll_lambda" {
  # Mock S3 ListBucket only when enabled
  dynamic "statement" {
    for_each = var.enable_mock_mesh ? [1] : []
    content {
      sid    = "MockMeshListBucket"
      effect = "Allow"

      actions = [
        "s3:ListBucket"
      ]

      resources = [
        module.s3bucket_non_pii_data.arn
      ]

      condition {
        test     = "StringLike"
        variable = "s3:prefix"
        values   = ["mock-mesh/*"]
      }
    }
  }

  dynamic "statement" {
    for_each = var.enable_mock_mesh ? [1] : []
    content {
      sid    = "AllowMockMeshActions"
      effect = "Allow"

      actions = [
        "s3:PutObject",
        "s3:GetObject",
        "s3:DeleteObject"
      ]

      resources = [
        "${module.s3bucket_non_pii_data.arn}/mock-mesh/*"
      ]
    }
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
      "arn:aws:ssm:${var.region}:${var.aws_account_id}:parameter${local.ssm_mesh_prefix}/*",
      "arn:aws:ssm:${var.region}:${var.aws_account_id}:parameter${local.ssm_senders_prefix}/*"
    ]
  }
}
