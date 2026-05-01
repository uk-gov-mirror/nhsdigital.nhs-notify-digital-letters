module "s3bucket_pii_data" {
  source = "https://github.com/NHSDigital/nhs-notify-shared-modules/releases/download/3.1.3/terraform-s3bucket.zip"

  name = "pii-data"

  aws_account_id = var.aws_account_id
  region         = var.region
  project        = var.project
  environment    = var.environment
  component      = local.component

  kms_key_arn      = module.kms.key_arn
  enable_abac      = var.restrict_pii_data_access ? true : false
  policy_documents = [data.aws_iam_policy_document.s3bucket_pii_data.json]

  force_destroy = var.force_destroy

  lifecycle_rules = [
    {
      enabled = true

      expiration = {
        days = var.pii_data_retention_policy_days
      }

      noncurrent_version_expiration = {
        noncurrent_days = var.pii_data_retention_non_current_days
      }

      abort_incomplete_multipart_upload = {
        days = "1"
      }
    }
  ]

  default_tags = {
    NHSE-Enable-S3-Backup-Acct = "True",
    NHSE-PII-Data              = "True",
  }
}

data "aws_iam_policy_document" "s3bucket_pii_data" {
  statement {
    sid    = "AllowManagedAccountsToList"
    effect = "Allow"

    actions = [
      "s3:ListBucket",
    ]

    resources = [
      module.s3bucket_pii_data.arn,
    ]

    principals {
      type = "AWS"
      identifiers = [
        "arn:aws:iam::${var.aws_account_id}:root"
      ]
    }
  }

  statement {
    sid    = "AllowManagedAccountsToGet"
    effect = "Allow"

    actions = [
      "s3:GetObject",
      "s3:PutObject",
    ]

    resources = [
      "${module.s3bucket_pii_data.arn}/*",
    ]

    principals {
      type = "AWS"
      identifiers = [
        "arn:aws:iam::${var.aws_account_id}:root"
      ]
    }
  }

  # dynamic "statement" {
  #   for_each = var.restrict_pii_data_access ? [1] : []
  #   content {
  #     effect = "Deny"
  #     actions = [
  #       "s3:GetObject",
  #       "s3:GetObjectVersion",
  #       "s3:PutObject",
  #       "s3:DeleteObject"
  #     ]
  #     resources = [
  #       module.s3bucket_pii_data.arn,
  #       "${module.s3bucket_pii_data.arn}/*",
  #     ]

  #     principals {
  #       type = "AWS"
  #       identifiers = [
  #         local.bc_restricted_dev_role
  #       ]
  #     }
  #   }
  # }
}
