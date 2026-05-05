module "sqs_scanner" {
  source = "https://github.com/NHSDigital/nhs-notify-shared-modules/releases/download/3.0.6/terraform-sqs.zip"

  aws_account_id             = var.aws_account_id
  component                  = local.component
  environment                = var.environment
  project                    = var.project
  region                     = var.region
  name                       = "file-scanner"
  sqs_kms_key_arn            = module.kms.key_arn
  visibility_timeout_seconds = var.sqs_visibility_timeout_seconds
  delay_seconds              = 0
  create_dlq                 = true
  max_receive_count          = var.sqs_max_receive_count
  sqs_policy_overload        = data.aws_iam_policy_document.sqs_scanner.json
}

data "aws_iam_policy_document" "sqs_scanner" {
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
      "arn:aws:sqs:${var.region}:${var.aws_account_id}:${local.csi}-file-scanner-queue"
    ]

    condition {
      test     = "ArnEquals"
      variable = "aws:SourceArn"
      values   = [aws_cloudwatch_event_rule.item_dequeued.arn]
    }
  }
}
