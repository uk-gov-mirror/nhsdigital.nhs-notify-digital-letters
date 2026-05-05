module "sqs_ttl_handle_expiry_errors" {
  source = "https://github.com/NHSDigital/nhs-notify-shared-modules/releases/download/3.0.6/terraform-sqs.zip"

  aws_account_id = var.aws_account_id
  component      = local.component
  environment    = var.environment
  project        = var.project
  region         = var.region
  name           = "ttl-handle-expiry-errors"

  sqs_kms_key_arn = module.kms.key_arn

  visibility_timeout_seconds = var.sqs_visibility_timeout_seconds
}
