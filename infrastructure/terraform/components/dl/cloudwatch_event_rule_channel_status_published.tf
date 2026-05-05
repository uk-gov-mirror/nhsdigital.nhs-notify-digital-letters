resource "aws_cloudwatch_event_rule" "channel_status_published" {
  name           = "${local.csi}-channel-status-published"
  description    = "channel status PUBLISHED event rule"
  event_bus_name = aws_cloudwatch_event_bus.main.name

  event_pattern = jsonencode({
    "detail" : {
      "type" : [
        "uk.nhs.notify.channel.status.PUBLISHED.v1"
      ],
    }
  })
}

resource "aws_cloudwatch_event_target" "sqs_nhsapp_status_handler_target" {
  rule           = aws_cloudwatch_event_rule.channel_status_published.name
  arn            = module.sqs_nhsapp_status_handler.sqs_queue_arn
  event_bus_name = aws_cloudwatch_event_bus.main.name
}
