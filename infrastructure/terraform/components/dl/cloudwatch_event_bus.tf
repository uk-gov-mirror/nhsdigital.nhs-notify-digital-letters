resource "aws_cloudwatch_event_bus" "main" {
  name = local.csi

  kms_key_identifier = module.kms.key_id

  log_config {
    include_detail = "FULL"
    level          = "TRACE"
  }
}

# CloudWatch Log Delivery Sources for INFO, ERROR, and TRACE logs
resource "aws_cloudwatch_log_delivery_source" "main_info_logs" {
  name         = "EventBusSource-${aws_cloudwatch_event_bus.main.name}-INFO_LOGS"
  log_type     = "INFO_LOGS"
  resource_arn = aws_cloudwatch_event_bus.main.arn
}

resource "aws_cloudwatch_log_delivery_source" "main_error_logs" {
  name         = "EventBusSource-${aws_cloudwatch_event_bus.main.name}-ERROR_LOGS"
  log_type     = "ERROR_LOGS"
  resource_arn = aws_cloudwatch_event_bus.main.arn
}

resource "aws_cloudwatch_log_delivery_source" "main_trace_logs" {
  name         = "EventBusSource-${aws_cloudwatch_event_bus.main.name}-TRACE_LOGS"
  log_type     = "TRACE_LOGS"
  resource_arn = aws_cloudwatch_event_bus.main.arn
}

data "aws_iam_policy_document" "main_event_bus_document" {
  statement {
    sid    = "AllowCrossDomainEventBridgeToPutEvent"
    effect = "Allow"

    principals {
      type        = "AWS"
      identifiers = ["arn:aws:iam::${var.shared_infra_account_id}:root"]
    }

    actions = [
      "events:PutEvents",
    ]

    resources = [
      aws_cloudwatch_event_bus.main.arn,
    ]

    condition {
      test     = "ArnLike"
      variable = "aws:SourceArn"
      values = [
        "arn:aws:events:${var.region}:${var.shared_infra_account_id}:rule/*-data-plane*"
      ]
    }
  }
}

resource "aws_cloudwatch_event_bus_policy" "main_event_bus_policy" {
  policy         = data.aws_iam_policy_document.main_event_bus_document.json
  event_bus_name = aws_cloudwatch_event_bus.main.name
}
