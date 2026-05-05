resource "aws_lambda_permission" "pdm_mock_gateway" {
  count = var.enable_pdm_mock ? 1 : 0

  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = module.pdm_mock[0].function_name
  principal     = "apigateway.amazonaws.com"

  source_arn = "${aws_api_gateway_rest_api.pdm_mock[0].execution_arn}/*/*"
}
