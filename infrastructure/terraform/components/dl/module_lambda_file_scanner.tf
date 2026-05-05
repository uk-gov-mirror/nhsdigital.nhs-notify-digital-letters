module "file_scanner" {
  source = "https://github.com/NHSDigital/nhs-notify-shared-modules/releases/download/3.0.6/terraform-lambda.zip"

  function_name = "file-scanner"
  description   = "A function for extracting PDFs from DocumentReference and storing in UnscannedFiles bucket for virus scanning"

  aws_account_id = var.aws_account_id
  component      = local.component
  environment    = var.environment
  project        = var.project
  region         = var.region
  group          = var.group

  log_retention_in_days = var.log_retention_in_days
  kms_key_arn           = module.kms.key_arn

  iam_policy_document = {
    body = data.aws_iam_policy_document.file_scanner_lambda.json
  }

  function_s3_bucket      = local.acct.s3_buckets["lambda_function_artefacts"]["id"]
  function_code_base_path = local.aws_lambda_functions_dir_path
  function_code_dir       = "file-scanner-lambda/dist"
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
    "DOCUMENT_REFERENCE_BUCKET"     = module.s3bucket_pii_data.bucket
    "UNSCANNED_FILES_BUCKET"        = local.unscanned_files_bucket
    "UNSCANNED_FILES_PATH_PREFIX"   = local.csi
    "EVENT_PUBLISHER_EVENT_BUS_ARN" = aws_cloudwatch_event_bus.main.arn
    "EVENT_PUBLISHER_DLQ_URL"       = module.sqs_event_publisher_errors.sqs_queue_url
  }
}

data "aws_iam_policy_document" "file_scanner_lambda" {
  statement {
    sid    = "ReadDocumentReferenceBucket"
    effect = "Allow"

    actions = [
      "s3:GetObject",
      "s3:ListBucket",
    ]

    resources = [
      module.s3bucket_pii_data.arn,
      "${module.s3bucket_pii_data.arn}/*",
    ]
  }

  statement {
    sid    = "WriteUnscannedFilesBucket"
    effect = "Allow"

    actions = [
      "s3:PutObject",
    ]

    resources = [
      "arn:aws:s3:::${local.unscanned_files_bucket}/*",
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
      module.sqs_event_publisher_errors.sqs_queue_arn,
    ]
  }

  statement {
    sid    = "SQSPermissionsScannerQueue"
    effect = "Allow"

    actions = [
      "sqs:ReceiveMessage",
      "sqs:DeleteMessage",
      "sqs:GetQueueAttributes",
      "sqs:GetQueueUrl",
    ]

    resources = [
      module.sqs_scanner.sqs_queue_arn,
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
}
