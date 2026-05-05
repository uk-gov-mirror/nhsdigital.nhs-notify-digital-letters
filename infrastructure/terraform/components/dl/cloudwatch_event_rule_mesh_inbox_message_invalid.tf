resource "aws_cloudwatch_event_rule" "mesh_inbox_message_invalid" {
  name           = "${local.csi}-mesh-inbox-message-invalid"
  description    = "MESH inbox message invalid event rule"
  event_bus_name = aws_cloudwatch_event_bus.main.name

  event_pattern = jsonencode({
    "detail" : {
      "type" : [
        "uk.nhs.notify.digital.letters.mesh.inbox.message.invalid.v1"
      ],
    }
  })
}

resource "aws_cloudwatch_event_target" "mesh_acknowledge_invalid_target" {
  rule           = aws_cloudwatch_event_rule.mesh_inbox_message_invalid.name
  arn            = module.sqs_mesh_acknowledge.sqs_queue_arn
  target_id      = "mesh_acknowledge_invalid_target"
  event_bus_name = aws_cloudwatch_event_bus.main.name
}
