resource "aws_lambda_event_source_mapping" "nhsapp_status_handler" {
  event_source_arn                   = module.sqs_nhsapp_status_handler.sqs_queue_arn
  function_name                      = module.nhsapp_status_handler.function_name
  batch_size                         = var.queue_batch_size
  maximum_batching_window_in_seconds = var.queue_batch_window_seconds

  function_response_types = [
    "ReportBatchItemFailures"
  ]
}
