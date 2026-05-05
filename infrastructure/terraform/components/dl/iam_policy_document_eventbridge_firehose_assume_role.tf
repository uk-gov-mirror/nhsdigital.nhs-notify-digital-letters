# IAM role for EventBridge to write to Kinesis Firehose
data "aws_iam_policy_document" "eventbridge_firehose_assume_role" {
  statement {
    effect = "Allow"

    principals {
      type        = "Service"
      identifiers = ["events.amazonaws.com"]
    }

    actions = ["sts:AssumeRole"]
  }
}

resource "aws_iam_role" "eventbridge_firehose" {
  name               = "${local.csi}-eventbridge-firehose"
  description        = "Role for EventBridge to write to Kinesis Firehose"
  assume_role_policy = data.aws_iam_policy_document.eventbridge_firehose_assume_role.json
}

data "aws_iam_policy_document" "eventbridge_firehose_policy" {
  statement {
    effect = "Allow"

    actions = [
      "firehose:PutRecord",
      "firehose:PutRecordBatch"
    ]

    resources = [
      aws_kinesis_firehose_delivery_stream.to_s3_reporting.arn
    ]
  }
}

resource "aws_iam_role_policy" "eventbridge_firehose" {
  name   = "${local.csi}-eventbridge-firehose"
  role   = aws_iam_role.eventbridge_firehose.id
  policy = data.aws_iam_policy_document.eventbridge_firehose_policy.json
}
