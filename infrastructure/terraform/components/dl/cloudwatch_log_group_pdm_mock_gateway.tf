resource "aws_cloudwatch_log_group" "pdm_mock_gateway" {
  count = var.enable_pdm_mock ? 1 : 0

  name              = "/aws/apigateway/${var.project}-${var.environment}-pdm-mock"
  retention_in_days = var.log_retention_in_days
  kms_key_id        = module.kms.key_arn

  tags = {
    Name        = "${var.project}-${var.environment}-pdm-mock-logs"
    Project     = var.project
    Environment = var.environment
    Component   = local.component
  }
}
