resource "aws_api_gateway_method" "create_document_reference" {
  count = var.enable_pdm_mock ? 1 : 0

  rest_api_id   = aws_api_gateway_rest_api.pdm_mock[0].id
  resource_id   = aws_api_gateway_resource.document_reference[0].id
  http_method   = "POST"
  authorization = "NONE"
}
