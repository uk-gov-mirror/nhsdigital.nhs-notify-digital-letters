locals {
  apim_access_token_ssm_parameter_name = "/${var.component}/${var.environment}/apim/access_token"
  apim_api_key_ssm_parameter_name      = "/${var.component}/${var.environment}/apim/api_key"
  apim_keystore_s3_bucket              = "nhs-${var.aws_account_id}-${var.region}-${var.environment}-${var.component}-static-assets"
  apim_private_key_ssm_parameter_name  = "/${var.component}/${var.environment}/apim/private_key"
  aws_lambda_functions_dir_path        = "../../../../lambdas"
  pdm_access_token_ssm_parameter_name  = var.enable_pdm_mock ? "" : local.apim_access_token_ssm_parameter_name
  pdm_url                              = var.enable_pdm_mock ? aws_api_gateway_stage.pdm_mock[0].invoke_url : var.apim_base_url
  firehose_output_path_prefix          = "kinesis-firehose-output"
  log_destination_arn                  = "arn:aws:logs:${var.region}:${var.shared_infra_account_id}:destination:nhs-main-obs-firehose-logs"
  mock_mesh_endpoint                   = "s3://${module.s3bucket_non_pii_data.bucket}/mock-mesh"
  root_domain_id                       = local.acct.route53_zone_ids["digital-letters"]
  root_domain_name                     = "${var.environment}.${local.acct.route53_zone_names["digital-letters"]}"
  ssm_mesh_prefix                      = "${local.ssm_prefix}/mesh"
  ssm_prefix                           = "/${var.component}/${var.environment}"
  ssm_senders_prefix                   = "${local.ssm_prefix}/senders"
  ttl_shard_count                      = 3
  unscanned_files_bucket               = local.acct.additional_s3_buckets["digital-letters_unscanned-files"]["id"]
  metrics_namespace_name               = "nhs-${var.environment}-${var.component}"
}
