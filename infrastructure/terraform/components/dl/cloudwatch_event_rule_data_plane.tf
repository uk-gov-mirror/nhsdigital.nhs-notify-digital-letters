resource "aws_cloudwatch_event_rule" "data_plane" {
  name           = "${local.csi}-data-plane"
  description    = "Data plane event rule"
  event_bus_name = aws_cloudwatch_event_bus.main.name

  event_pattern = jsonencode({
    "detail" : {
      "plane" : [
        "data"
      ],
      "type" : [{
        "prefix" : "uk.nhs.notify.digital.letters."
      }]
    }
  })
}

resource "aws_cloudwatch_event_target" "data-plane-main-bus-target" {
  rule           = aws_cloudwatch_event_rule.data_plane.name
  arn            = module.eventpub.sns_topic.arn
  event_bus_name = aws_cloudwatch_event_bus.main.name

  input_path = "$.detail"
}
