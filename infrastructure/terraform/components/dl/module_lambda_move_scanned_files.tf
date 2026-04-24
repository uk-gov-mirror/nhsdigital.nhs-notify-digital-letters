module "move_scanned_files" {
  source = "https://github.com/NHSDigital/nhs-notify-shared-modules/releases/download/3.0.6/terraform-lambda.zip"

  function_name = "move-scanned-files"
  description   = "A function that handles GuardDuty Malware Protection Object Scan Result and depending on the result moves objects from the unscanned bucket to the file safe or quarantined bucket. "

  aws_account_id = var.aws_account_id
  component      = local.component
  environment    = var.environment
  project        = var.project
  region         = var.region
  group          = var.group

  log_retention_in_days = var.log_retention_in_days
  kms_key_arn           = module.kms.key_arn

  iam_policy_document = {
    body = data.aws_iam_policy_document.move_scanned_files.json
  }

  function_s3_bucket      = local.acct.s3_buckets["lambda_function_artefacts"]["id"]
  function_code_base_path = local.aws_lambda_functions_dir_path
  function_code_dir       = "move-scanned-files-lambda/dist"
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
    "EVENT_PUBLISHER_EVENT_BUS_ARN"  = aws_cloudwatch_event_bus.main.arn
    "EVENT_PUBLISHER_DLQ_URL"        = module.sqs_event_publisher_errors.sqs_queue_url
    "ENVIRONMENT"                    = var.environment
    "KEY_PREFIX_UNSCANNED_FILES"     = local.csi
    "UNSCANNED_FILE_S3_BUCKET_NAME"  = local.unscanned_files_bucket
    "SAFE_FILE_S3_BUCKET_NAME"       = module.s3bucket_file_safe.bucket
    "QUARANTINE_FILE_S3_BUCKET_NAME" = module.s3bucket_file_quarantine.bucket
    "DL_METRICS_NAMESPACE"           = local.metrics_namespace_name
  }
}

data "aws_iam_policy_document" "move_scanned_files" {
  statement {
    sid    = "KMSPermissions"
    effect = "Allow"

    actions = [
      "kms:Encrypt",
      "kms:Decrypt",
      "kms:GenerateDataKey",
    ]

    resources = [
      module.kms.key_arn,
    ]
  }

  statement {
    sid    = "SQSPermissionsFileScannerMoveScannedFiles"
    effect = "Allow"

    actions = [
      "sqs:ReceiveMessage",
      "sqs:DeleteMessage",
      "sqs:GetQueueAttributes",
      "sqs:GetQueueUrl",
    ]

    resources = [
      module.sqs_move_scanned_files.sqs_queue_arn,
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
    sid    = "SQSPermissionsDLQ"
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
    sid    = "PermissionsToUnscannedBucket"
    effect = "Allow"

    actions = [
      "s3:GetObject",
      "s3:GetObjectTagging",
      "s3:DeleteObject",
    ]

    resources = [
      "arn:aws:s3:::${local.unscanned_files_bucket}/*",
    ]
  }

  statement {
    sid    = "PermissionsToSafeFileBucket"
    effect = "Allow"

    actions = [
      "s3:PutObject",
      "s3:PutObjectTagging",
    ]

    resources = [
      "${module.s3bucket_file_safe.arn}/*"
    ]
  }

  statement {
    sid    = "PermissionsToQuarantineFileBucket"
    effect = "Allow"

    actions = [
      "s3:PutObject",
      "s3:PutObjectTagging",
    ]

    resources = [
      "${module.s3bucket_file_quarantine.arn}/*"
    ]
  }

}
