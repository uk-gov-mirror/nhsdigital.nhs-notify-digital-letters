resource "aws_api_gateway_deployment" "pdm_mock" {
  count = var.enable_pdm_mock ? 1 : 0

  depends_on = [
    aws_api_gateway_integration.create_document_reference,
    aws_api_gateway_integration.get_document_reference,
  ]

  rest_api_id = aws_api_gateway_rest_api.pdm_mock[0].id

  triggers = {
    redeployment = sha1(jsonencode([
      aws_api_gateway_resource.patient_data_manager[0].id,
      aws_api_gateway_resource.fhir[0].id,
      aws_api_gateway_resource.r4[0].id,
      aws_api_gateway_resource.document_reference[0].id,
      aws_api_gateway_resource.document_reference_id[0].id,
      aws_api_gateway_method.create_document_reference[0].id,
      aws_api_gateway_method.create_document_reference[0].authorization,
      aws_api_gateway_method.get_document_reference[0].id,
      aws_api_gateway_method.get_document_reference[0].authorization,
      aws_api_gateway_integration.create_document_reference[0].id,
      aws_api_gateway_integration.get_document_reference[0].id,
    ]))
  }

  lifecycle {
    create_before_destroy = true
  }
}
