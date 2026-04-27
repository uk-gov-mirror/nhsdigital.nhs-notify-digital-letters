resource "aws_kinesis_firehose_delivery_stream" "to_s3_reporting" {
  name = "${local.csi}-to-s3-reporting"

  destination = "extended_s3"

  extended_s3_configuration {
    role_arn   = aws_iam_role.firehose_role.arn
    bucket_arn = module.s3bucket_reporting.arn

    prefix              = "${local.firehose_output_path_prefix}/reporting/parquet/${aws_glue_catalog_table.event_record.name}/senderid=!{partitionKeyFromLambda:senderId}/__year=!{partitionKeyFromLambda:year}/__month=!{partitionKeyFromLambda:month}/__day=!{partitionKeyFromLambda:day}/"
    error_output_prefix = "${local.firehose_output_path_prefix}/errors/!{timestamp:yyyy}-!{timestamp:MM}-!{timestamp:dd}-!{timestamp:HH}/!{firehose:error-output-type}/"

    buffering_size     = 128
    buffering_interval = var.firehose_destination_buffer_interval

    dynamic_partitioning_configuration {
      enabled = true
    }

    processing_configuration {
      enabled = "true"

      processors {
        type = "Lambda"

        parameters {
          parameter_name  = "LambdaArn"
          parameter_value = "${module.report_event_transformer.function_arn}:$LATEST"
        }
        parameters {
          parameter_name  = "RoleArn"
          parameter_value = aws_iam_role.firehose_role.arn
        }
        parameters {
          parameter_name  = "BufferSizeInMBs"
          parameter_value = 1
        }
        parameters {
          parameter_name  = "BufferIntervalInSeconds"
          parameter_value = var.firehose_processor_buffer_interval
        }
      }
    }

    data_format_conversion_configuration {
      input_format_configuration {
        deserializer {
          open_x_json_ser_de {}
        }
      }

      output_format_configuration {
        serializer {
          parquet_ser_de {}
        }
      }

      schema_configuration {
        database_name = aws_glue_catalog_database.reporting.name
        role_arn      = aws_iam_role.firehose_role.arn
        table_name    = aws_glue_catalog_table.event_record.name
      }
    }

    cloudwatch_logging_options {
      enabled         = true
      log_group_name  = aws_cloudwatch_log_group.kinesis_logs.name
      log_stream_name = aws_cloudwatch_log_stream.reporting_kinesis_logs.name
    }
  }

}

resource "aws_iam_role" "firehose_role" {
  name               = "${local.csi}-firehose"
  description        = "Firehose Role"
  assume_role_policy = data.aws_iam_policy_document.firehose_assume_role.json
}

data "aws_iam_policy_document" "firehose_assume_role" {
  statement {
    sid    = "FirehoseAssumeRole"
    effect = "Allow"

    principals {
      type = "Service"
      identifiers = [
        "firehose.amazonaws.com"
      ]
    }

    actions = [
      "sts:AssumeRole"
    ]
  }
}

resource "aws_iam_policy" "firehose_policy" {
  name        = "${local.csi}-firehose"
  description = "Firehose Policy"
  path        = "/"
  policy      = data.aws_iam_policy_document.firehose_policy.json
}

resource "aws_iam_role_policy_attachment" "firehose" {
  role       = aws_iam_role.firehose_role.name
  policy_arn = aws_iam_policy.firehose_policy.arn
}

data "aws_iam_policy_document" "firehose_policy" {
  version = "2012-10-17"

  statement {
    actions = [
      "logs:PutLogEvents",
    ]

    resources = [
      aws_cloudwatch_log_group.kinesis_logs.arn,
      aws_cloudwatch_log_stream.reporting_kinesis_logs.arn
    ]

    effect = "Allow"
  }

  statement {
    actions = [
      "lambda:InvokeFunction",
      "lambda:GetFunctionConfiguration",
    ]

    resources = [
      "${module.report_event_transformer.function_arn}:$LATEST",
    ]
  }

  statement {
    sid    = "AllowSSE"
    effect = "Allow"
    actions = [
      "kms:DescribeKey",
      "kms:Encrypt",
      "kms:Decrypt",
      "kms:GenerateDataKey*",
      "kms:ReEncrypt*",
    ]

    resources = [
      module.kms.key_arn
    ]
  }

  statement {
    sid    = "DestinationS3Access"
    effect = "Allow"

    actions = [
      "s3:AbortMultipartUpload",
      "s3:GetBucketLocation",
      "s3:GetObject",
      "s3:ListBucket",
      "s3:ListBucketMultipartUploads",
      "s3:PutObject",
    ]

    resources = [
      module.s3bucket_reporting.arn,
      "${module.s3bucket_reporting.arn}/${local.firehose_output_path_prefix}/*"
    ]
  }

  statement {
    sid    = "EncryptTargetData"
    effect = "Allow"

    actions = [
      "kms:Decrypt",
      "kms:GenerateDataKey"
    ]
    resources = [
      module.kms.key_arn
    ]

    condition {
      test     = "StringLike"
      variable = "kms:EncryptionContext:aws:s3:arn"
      values = [
        "${module.s3bucket_reporting.arn}"
      ]
    }

    condition {
      test     = "StringEquals"
      variable = "kms:ViaService"
      values = [
        "s3.${var.region}.amazonaws.com"
      ]
    }
  }

  statement {
    sid    = "AllowListDataStream"
    effect = "Allow"
    actions = [
      "kinesis:ListStreams"
    ]

    resources = [
      "*"
    ]
  }

  statement {
    sid    = "AllowGlueTableAccess"
    effect = "Allow"
    actions = [
      "glue:GetTable",
      "glue:GetTableVersion",
      "glue:GetTableVersions"
    ]

    resources = [
      aws_glue_catalog_table.event_record.arn,
      aws_glue_catalog_database.reporting.arn,
      "arn:aws:glue:${var.region}:${var.aws_account_id}:catalog"
    ]
  }
}
