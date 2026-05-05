resource "aws_api_gateway_integration" "get_document_reference" {
  count = var.enable_pdm_mock ? 1 : 0

  rest_api_id = aws_api_gateway_rest_api.pdm_mock[0].id
  resource_id = aws_api_gateway_resource.document_reference_id[0].id
  http_method = aws_api_gateway_method.get_document_reference[0].http_method

  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = module.pdm_mock[0].function_invoke_arn
}
