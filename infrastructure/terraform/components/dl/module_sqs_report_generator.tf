module "sqs_report_generator" {
  source = "https://github.com/NHSDigital/nhs-notify-shared-modules/releases/download/3.0.6/terraform-sqs.zip"

  aws_account_id = var.aws_account_id
  component      = local.component
  environment    = var.environment
  project        = var.project
  region         = var.region
  name           = "report-generator"

  sqs_kms_key_arn = module.kms.key_arn

  visibility_timeout_seconds = 360

  create_dlq = true

  sqs_policy_overload = data.aws_iam_policy_document.sqs_report_generator.json
}

data "aws_iam_policy_document" "sqs_report_generator" {
  statement {
    sid    = "AllowEventBridgeToSendMessage"
    effect = "Allow"

    principals {
      type        = "Service"
      identifiers = ["events.amazonaws.com"]
    }

    actions = [
      "sqs:SendMessage"
    ]

    resources = [
      "arn:aws:sqs:${var.region}:${var.aws_account_id}:${local.csi}-report-generator-queue"
    ]

    condition {
      test     = "ArnEquals"
      variable = "aws:SourceArn"
      values   = [aws_cloudwatch_event_rule.generate_report.arn]
    }
  }
}
