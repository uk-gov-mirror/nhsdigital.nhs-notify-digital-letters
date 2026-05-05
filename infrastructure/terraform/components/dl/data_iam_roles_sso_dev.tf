data "aws_iam_roles" "sso_bc_restricted_dev" {
  count       = var.restrict_pid_data_access ? 1 : 0
  name_regex  = "AWSReservedSSO_nhs-notify-bc-developer_.*"
  path_prefix = "/aws-reserved/sso.amazonaws.com/"
}
