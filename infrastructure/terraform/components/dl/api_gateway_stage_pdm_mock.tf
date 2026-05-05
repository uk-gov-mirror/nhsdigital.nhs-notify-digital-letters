resource "aws_api_gateway_stage" "pdm_mock" {
  count = var.enable_pdm_mock ? 1 : 0

  deployment_id = aws_api_gateway_deployment.pdm_mock[0].id
  rest_api_id   = aws_api_gateway_rest_api.pdm_mock[0].id
  stage_name    = var.environment

  xray_tracing_enabled = true

  access_log_settings {
    destination_arn = aws_cloudwatch_log_group.pdm_mock_gateway[0].arn
    format = jsonencode({
      requestId      = "$context.requestId"
      ip             = "$context.identity.sourceIp"
      caller         = "$context.identity.caller"
      user           = "$context.identity.user"
      requestTime    = "$context.requestTime"
      httpMethod     = "$context.httpMethod"
      resourcePath   = "$context.resourcePath"
      status         = "$context.status"
      protocol       = "$context.protocol"
      responseLength = "$context.responseLength"
    })
  }

  tags = {
    Name        = "${var.project}-${var.environment}-pdm-mock-stage"
    Project     = var.project
    Environment = var.environment
    Component   = local.component
  }
}
