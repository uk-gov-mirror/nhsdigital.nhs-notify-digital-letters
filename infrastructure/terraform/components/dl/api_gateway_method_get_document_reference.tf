resource "aws_api_gateway_method" "get_document_reference" {
  count = var.enable_pdm_mock ? 1 : 0

  rest_api_id   = aws_api_gateway_rest_api.pdm_mock[0].id
  resource_id   = aws_api_gateway_resource.document_reference_id[0].id
  http_method   = "GET"
  authorization = "NONE"
}
