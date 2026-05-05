module "eventpub" {
  source = "https://github.com/NHSDigital/nhs-notify-shared-modules/releases/download/3.0.6/terraform-eventpub.zip"

  name = "eventpub"

  aws_account_id = var.aws_account_id
  component      = var.component
  environment    = var.environment
  project        = var.project
  region         = var.region
  group          = var.group

  default_tags = local.default_tags

  kms_key_arn           = module.kms.key_arn
  log_retention_in_days = var.log_retention_in_days
  log_level             = var.log_level

  force_destroy = var.force_destroy

  event_cache_buffer_interval        = 500
  enable_sns_delivery_logging        = var.enable_sns_delivery_logging
  sns_success_logging_sample_percent = var.sns_success_logging_sample_percent
  access_logging_bucket              = local.acct.s3_buckets["access_logs"]["id"]

  event_cache_expiry_days = 30
  enable_event_cache      = var.enable_event_cache
  data_plane_bus_arn      = var.eventpub_data_plane_bus_arn
  control_plane_bus_arn   = var.eventpub_control_plane_bus_arn

  enable_event_anomaly_detection   = var.enable_event_anomaly_detection
  event_anomaly_band_width         = var.event_anomaly_band_width
  event_anomaly_evaluation_periods = var.event_anomaly_evaluation_periods
  event_anomaly_period             = var.event_anomaly_period
}

resource "aws_sns_topic_policy" "eventbridge_publish" {
  arn    = module.eventpub.sns_topic.arn
  policy = data.aws_iam_policy_document.sns_publish.json
}

data "aws_iam_policy_document" "sns_publish" {
  statement {
    sid    = "AllowEventBridgePublish"
    effect = "Allow"

    principals {
      type        = "Service"
      identifiers = ["events.amazonaws.com"]
    }

    actions = [
      "sns:Publish"
    ]

    resources = [
      module.eventpub.sns_topic.arn
    ]

    condition {
      test     = "ArnEquals"
      variable = "aws:SourceArn"
      values = [aws_cloudwatch_event_rule.letter_prepared.arn,
        aws_cloudwatch_event_rule.data_plane.arn
      ]
    }
  }
}
