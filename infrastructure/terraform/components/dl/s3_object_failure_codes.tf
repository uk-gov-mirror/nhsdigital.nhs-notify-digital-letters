resource "aws_s3_object" "failure_codes" {
  bucket       = module.s3bucket_reporting.bucket
  key          = "reference-data/failure_codes/failure_codes.csv"
  source       = "${path.module}/../../../../utils/py-utils/dl_utils/failure_codes.csv"
  content_type = "text/csv"
  etag         = filemd5("${path.module}/../../../../utils/py-utils/dl_utils/failure_codes.csv")

  tags = merge(
    local.default_tags,
    {
      Name = "${local.csi}-failure-codes-csv"
    }
  )
}
