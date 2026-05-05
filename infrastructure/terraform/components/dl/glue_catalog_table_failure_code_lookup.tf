resource "aws_glue_catalog_table" "failure_code_lookup" {
  name          = "failure_code_lookup"
  description   = "Lookup table for failure code descriptions"
  database_name = aws_glue_catalog_database.reporting.name

  table_type = "EXTERNAL_TABLE"

  storage_descriptor {
    location = "s3://${module.s3bucket_reporting.bucket}/reference-data/failure_codes/"

    input_format  = "org.apache.hadoop.mapred.TextInputFormat"
    output_format = "org.apache.hadoop.hive.ql.io.HiveIgnoreKeyTextOutputFormat"

    ser_de_info {
      name                  = "csv"
      serialization_library = "org.apache.hadoop.hive.serde2.OpenCSVSerde"

      parameters = {
        "separatorChar"          = ","
        "skip.header.line.count" = "1"
      }
    }

    columns {
      name = "code"
      type = "string"
    }

    columns {
      name = "description"
      type = "string"
    }
  }

  parameters = {
    EXTERNAL       = "TRUE"
    classification = "csv"
  }
}
