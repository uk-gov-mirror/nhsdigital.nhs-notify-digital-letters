resource "aws_api_gateway_resource" "patient_data_manager" {
  count = var.enable_pdm_mock ? 1 : 0

  rest_api_id = aws_api_gateway_rest_api.pdm_mock[0].id
  parent_id   = aws_api_gateway_rest_api.pdm_mock[0].root_resource_id
  path_part   = "patient-data-manager"
}
