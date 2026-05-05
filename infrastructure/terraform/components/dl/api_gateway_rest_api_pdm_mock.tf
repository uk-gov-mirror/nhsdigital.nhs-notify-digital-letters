resource "aws_api_gateway_rest_api" "pdm_mock" {
  count = var.enable_pdm_mock ? 1 : 0

  name        = "${var.project}-${var.environment}-pdm-mock"
  description = "PDM Mock API for testing integration with Patient Data Manager"

  endpoint_configuration {
    types = ["REGIONAL"]
  }

  tags = {
    Name        = "${var.project}-${var.environment}-pdm-mock"
    Project     = var.project
    Environment = var.environment
    Component   = local.component
  }
}
