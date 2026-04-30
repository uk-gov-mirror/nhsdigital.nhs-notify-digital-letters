module "s3bucket_file_safe" {
  source = "git::https://github.com/NHSDigital/nhs-notify-shared-modules.git//infrastructure/terraform/modules/s3bucket?ref=feature/CCM-16776_s3_pii_access" #Change this later to actual tag

  name = "file-safe"

  aws_account_id = var.aws_account_id
  region         = var.region
  project        = var.project
  environment    = var.environment
  component      = local.component

  kms_key_arn = module.kms.key_arn
  enable_abac = var.restrict_pii_data_access ? true : false

  policy_documents = [data.aws_iam_policy_document.s3bucket_file_safe.json]

  force_destroy = var.force_destroy

  lifecycle_rules = [
    {
      enabled = true

      expiration = {
        days = "90"
      }

      noncurrent_version_transition = [
        {
          noncurrent_days = "30"
          storage_class   = "STANDARD_IA"
        }
      ]

      noncurrent_version_expiration = {
        noncurrent_days = "90"
      }

      abort_incomplete_multipart_upload = {
        days = "1"
      }
    }
  ]

  default_tags = {
    NHSE-Enable-S3-Backup-Acct = "True",
    NHSE-PII-Data              = "True"
  }
}

data "aws_iam_policy_document" "s3bucket_file_safe" {
  statement {
    sid    = "AllowManagedAccountsToList"
    effect = "Allow"

    actions = [
      "s3:ListBucket",
    ]

    resources = [
      module.s3bucket_file_safe.arn,
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
    ]

    resources = [
      "${module.s3bucket_file_safe.arn}/*",
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
  #       module.s3bucket_file_safe.arn,
  #       "${module.s3bucket_file_safe.arn}/*",
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
