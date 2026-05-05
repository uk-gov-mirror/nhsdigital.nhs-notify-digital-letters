module "pdm_poll" {
  source = "https://github.com/NHSDigital/nhs-notify-shared-modules/releases/download/3.0.6/terraform-lambda.zip"

  function_name = "pdm-poll"
  description   = "A function for polling PDM document status"

  aws_account_id = var.aws_account_id
  component      = local.component
  environment    = var.environment
  project        = var.project
  region         = var.region
  group          = var.group

  log_retention_in_days = var.log_retention_in_days
  kms_key_arn           = module.kms.key_arn

  iam_policy_document = {
    body = data.aws_iam_policy_document.pdm_poll_lambda.json
  }

  function_s3_bucket      = local.acct.s3_buckets["lambda_function_artefacts"]["id"]
  function_code_base_path = local.aws_lambda_functions_dir_path
  function_code_dir       = "pdm-poll-lambda/dist"
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
    "APIM_BASE_URL"                        = local.pdm_url
    "APIM_ACCESS_TOKEN_SSM_PARAMETER_NAME" = local.pdm_access_token_ssm_parameter_name
    "EVENT_PUBLISHER_EVENT_BUS_ARN"        = aws_cloudwatch_event_bus.main.arn
    "EVENT_PUBLISHER_DLQ_URL"              = module.sqs_event_publisher_errors.sqs_queue_url
    "POLL_MAX_RETRIES"                     = 10
  }
}

data "aws_iam_policy_document" "pdm_poll_lambda" {
  statement {
    sid    = "AllowSSMParam"
    effect = "Allow"

    actions = [
      "ssm:GetParameter",
      "ssm:GetParameters",
      "ssm:GetParametersByPath"
    ]

    resources = [
      "arn:aws:ssm:${var.region}:${var.aws_account_id}:parameter/${var.component}/${var.environment}/apim/*"
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
    sid    = "SQSPermissionsPollPdmQueue"
    effect = "Allow"

    actions = [
      "sqs:ReceiveMessage",
      "sqs:DeleteMessage",
      "sqs:GetQueueAttributes",
      "sqs:GetQueueUrl",
    ]

    resources = [
      module.sqs_pdm_poll.sqs_queue_arn,
    ]
  }
}
