<!-- BEGIN_TF_DOCS -->
<!-- markdownlint-disable -->
<!-- vale off -->

## Requirements

No requirements.
## Inputs

| Name | Description | Type | Default | Required |
|------|-------------|------|---------|:--------:|
| <a name="input_apim_auth_token_schedule"></a> [apim\_auth\_token\_schedule](#input\_apim\_auth\_token\_schedule) | Schedule to renew the APIM auth token | `string` | `"rate(9 minutes)"` | no |
| <a name="input_apim_auth_token_url"></a> [apim\_auth\_token\_url](#input\_apim\_auth\_token\_url) | URL to generate an APIM auth token | `string` | `"https://int.api.service.nhs.uk/oauth2/token"` | no |
| <a name="input_apim_base_url"></a> [apim\_base\_url](#input\_apim\_base\_url) | The URL used to send requests to PDM | `string` | `"https://int.api.service.nhs.uk"` | no |
| <a name="input_apim_keygen_schedule"></a> [apim\_keygen\_schedule](#input\_apim\_keygen\_schedule) | Schedule to refresh key pairs if necessary | `string` | `"cron(0 14 * * ? *)"` | no |
| <a name="input_athena_query_max_polling_attempts"></a> [athena\_query\_max\_polling\_attempts](#input\_athena\_query\_max\_polling\_attempts) | The number of times athena will be polled to check if a query is completed | `number` | `3` | no |
| <a name="input_athena_query_polling_time_seconds"></a> [athena\_query\_polling\_time\_seconds](#input\_athena\_query\_polling\_time\_seconds) | The amount of time in seconds to wait between each athena poll | `number` | `15` | no |
| <a name="input_aws_account_id"></a> [aws\_account\_id](#input\_aws\_account\_id) | The AWS Account ID (numeric) | `string` | n/a | yes |
| <a name="input_aws_account_type"></a> [aws\_account\_type](#input\_aws\_account\_type) | The AWS Account Type | `string` | n/a | yes |
| <a name="input_component"></a> [component](#input\_component) | The variable encapsulating the name of this component | `string` | `"dl"` | no |
| <a name="input_core_notify_include_auth_header"></a> [core\_notify\_include\_auth\_header](#input\_core\_notify\_include\_auth\_header) | Whether to send auth tokens with core notify API calls. | `bool` | `true` | no |
| <a name="input_core_notify_url"></a> [core\_notify\_url](#input\_core\_notify\_url) | The URL used to send requests to Notify | `string` | `"https://sandbox.api.service.nhs.uk"` | no |
| <a name="input_default_cloudwatch_event_bus_name"></a> [default\_cloudwatch\_event\_bus\_name](#input\_default\_cloudwatch\_event\_bus\_name) | The name of the default cloudwatch event bus. This is needed as GuardDuty Scan Result events are sent to the default bus | `string` | `"default"` | no |
| <a name="input_default_tags"></a> [default\_tags](#input\_default\_tags) | A map of default tags to apply to all taggable resources within the component | `map(string)` | `{}` | no |
| <a name="input_enable_dynamodb_delete_protection"></a> [enable\_dynamodb\_delete\_protection](#input\_enable\_dynamodb\_delete\_protection) | Enable DynamoDB Delete Protection on all Tables | `bool` | `true` | no |
| <a name="input_enable_event_anomaly_detection"></a> [enable\_event\_anomaly\_detection](#input\_enable\_event\_anomaly\_detection) | Enable CloudWatch anomaly detection alarm for core notifier queue message reception | `bool` | `true` | no |
| <a name="input_enable_event_cache"></a> [enable\_event\_cache](#input\_enable\_event\_cache) | Enable caching of events to an S3 bucket | `bool` | `true` | no |
| <a name="input_enable_mock_mesh"></a> [enable\_mock\_mesh](#input\_enable\_mock\_mesh) | Enable mock mesh access (dev only). Grants lambda permission to read mock-mesh prefix in non-pii bucket. | `bool` | `false` | no |
| <a name="input_enable_pdm_mock"></a> [enable\_pdm\_mock](#input\_enable\_pdm\_mock) | Flag indicating whether to deploy PDM mock API (should be false in production environments) | `bool` | `false` | no |
| <a name="input_enable_sns_delivery_logging"></a> [enable\_sns\_delivery\_logging](#input\_enable\_sns\_delivery\_logging) | Enable SNS Delivery Failure Notifications | `bool` | `true` | no |
| <a name="input_environment"></a> [environment](#input\_environment) | The name of the tfscaffold environment | `string` | n/a | yes |
| <a name="input_event_anomaly_band_width"></a> [event\_anomaly\_band\_width](#input\_event\_anomaly\_band\_width) | The width of the anomaly detection band. Higher values (e.g. 4-6) reduce sensitivity and noise, lower values (e.g. 2-3) increase sensitivity. Recommended: 2-4. | `number` | `3` | no |
| <a name="input_event_anomaly_evaluation_periods"></a> [event\_anomaly\_evaluation\_periods](#input\_event\_anomaly\_evaluation\_periods) | Number of evaluation periods for the anomaly alarm. Each period is defined by event\_anomaly\_period. | `number` | `2` | no |
| <a name="input_event_anomaly_period"></a> [event\_anomaly\_period](#input\_event\_anomaly\_period) | The period in seconds over which the specified statistic is applied for anomaly detection. Minimum 300 seconds (5 minutes). Recommended: 300-600. | `number` | `300` | no |
| <a name="input_eventpub_control_plane_bus_arn"></a> [eventpub\_control\_plane\_bus\_arn](#input\_eventpub\_control\_plane\_bus\_arn) | Event publisher control plane | `string` | n/a | yes |
| <a name="input_eventpub_data_plane_bus_arn"></a> [eventpub\_data\_plane\_bus\_arn](#input\_eventpub\_data\_plane\_bus\_arn) | Event publisher data plane | `string` | n/a | yes |
| <a name="input_force_destroy"></a> [force\_destroy](#input\_force\_destroy) | Flag to force deletion of S3 buckets | `bool` | `false` | no |
| <a name="input_force_lambda_code_deploy"></a> [force\_lambda\_code\_deploy](#input\_force\_lambda\_code\_deploy) | If the lambda package in s3 has the same commit id tag as the terraform build branch, the lambda will not update automatically. Set to True if making changes to Lambda code from on the same commit for example during development | `bool` | `false` | no |
| <a name="input_group"></a> [group](#input\_group) | The group variables are being inherited from (often synonmous with account short-name) | `string` | n/a | yes |
| <a name="input_kms_deletion_window"></a> [kms\_deletion\_window](#input\_kms\_deletion\_window) | When a kms key is deleted, how long should it wait in the pending deletion state? | `string` | `"30"` | no |
| <a name="input_lambda_timeout_seconds"></a> [lambda\_timeout\_seconds](#input\_lambda\_timeout\_seconds) | The timeout of the lambdas that are triggered by SQS. | `string` | `"45"` | no |
| <a name="input_log_level"></a> [log\_level](#input\_log\_level) | The log level to be used in lambda functions within the component. Any log with a lower severity than the configured value will not be logged: https://docs.python.org/3/library/logging.html#levels | `string` | `"INFO"` | no |
| <a name="input_log_retention_in_days"></a> [log\_retention\_in\_days](#input\_log\_retention\_in\_days) | The retention period in days for the Cloudwatch Logs events to be retained, default of 0 is indefinite | `number` | `0` | no |
| <a name="input_mesh_poll_schedule"></a> [mesh\_poll\_schedule](#input\_mesh\_poll\_schedule) | Schedule to poll MESH for messages | `string` | `"rate(5 minutes)"` | no |
| <a name="input_metadata_refresh_schedule"></a> [metadata\_refresh\_schedule](#input\_metadata\_refresh\_schedule) | Schedule for refreshing reporting metadata. | `string` | `"cron(10 6-22 * * ? *)"` | no |
| <a name="input_nhs_app_base_url"></a> [nhs\_app\_base\_url](#input\_nhs\_app\_base\_url) | The URL used to build the NHS App resource URL | `string` | `"https://example.com"` | no |
| <a name="input_parent_acct_environment"></a> [parent\_acct\_environment](#input\_parent\_acct\_environment) | Name of the environment responsible for the acct resources used, affects things like DNS zone. Useful for named dev environments | `string` | `"main"` | no |
| <a name="input_pii_data_retention_non_current_days"></a> [pii\_data\_retention\_non\_current\_days](#input\_pii\_data\_retention\_non\_current\_days) | The number of non current days for data retention policy for PII | `number` | `14` | no |
| <a name="input_pii_data_retention_policy_days"></a> [pii\_data\_retention\_policy\_days](#input\_pii\_data\_retention\_policy\_days) | The number of days for data retention policy for PII | `number` | `534` | no |
| <a name="input_project"></a> [project](#input\_project) | The name of the tfscaffold project | `string` | n/a | yes |
| <a name="input_queue_batch_size"></a> [queue\_batch\_size](#input\_queue\_batch\_size) | maximum number of queue items to process | `number` | `10` | no |
| <a name="input_queue_batch_window_seconds"></a> [queue\_batch\_window\_seconds](#input\_queue\_batch\_window\_seconds) | maximum time in seconds between processing events | `number` | `1` | no |
| <a name="input_region"></a> [region](#input\_region) | The AWS Region | `string` | n/a | yes |
| <a name="input_report_scheduler_schedule"></a> [report\_scheduler\_schedule](#input\_report\_scheduler\_schedule) | Schedule to trigger sender reports | `string` | `"cron(30 4 * * ? *)"` | no |
| <a name="input_reports_data_retention_non_current_days"></a> [reports\_data\_retention\_non\_current\_days](#input\_reports\_data\_retention\_non\_current\_days) | The number of non current days for data retention policy for reports generated by Athena in the reporting bucket | `number` | `14` | no |
| <a name="input_reports_data_retention_policy_days"></a> [reports\_data\_retention\_policy\_days](#input\_reports\_data\_retention\_policy\_days) | The number of days for data retention policy for reports generated by Athena in the reporting bucket | `number` | `90` | no |
| <a name="input_shared_infra_account_id"></a> [shared\_infra\_account\_id](#input\_shared\_infra\_account\_id) | The AWS Shared Infra Account ID (numeric) | `string` | n/a | yes |
| <a name="input_sns_success_logging_sample_percent"></a> [sns\_success\_logging\_sample\_percent](#input\_sns\_success\_logging\_sample\_percent) | Enable SNS Delivery Successful Sample Percentage | `number` | `0` | no |
| <a name="input_sqs_max_receive_count"></a> [sqs\_max\_receive\_count](#input\_sqs\_max\_receive\_count) | Maximum number of times a message can be received before being sent to the DLQ | `string` | `"3"` | no |
| <a name="input_sqs_visibility_timeout_seconds"></a> [sqs\_visibility\_timeout\_seconds](#input\_sqs\_visibility\_timeout\_seconds) | The visibility timeout of the SQS queues. AWS recommends this timeout to be at least 6 times the function timeout (lambda\_timeout\_seconds), see https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/sqs-configure-lambda-function-trigger.html | `string` | `"270"` | no |
| <a name="input_ttl_poll_schedule"></a> [ttl\_poll\_schedule](#input\_ttl\_poll\_schedule) | Schedule to poll for any overdue TTL records | `string` | `"rate(10 minutes)"` | no |
## Modules

| Name | Source | Version |
|------|--------|---------|
| <a name="module_core_notifier"></a> [core\_notifier](#module\_core\_notifier) | https://github.com/NHSDigital/nhs-notify-shared-modules/releases/download/3.0.6/terraform-lambda.zip | n/a |
| <a name="module_eventpub"></a> [eventpub](#module\_eventpub) | https://github.com/NHSDigital/nhs-notify-shared-modules/releases/download/3.0.6/terraform-eventpub.zip | n/a |
| <a name="module_file_scanner"></a> [file\_scanner](#module\_file\_scanner) | https://github.com/NHSDigital/nhs-notify-shared-modules/releases/download/3.0.6/terraform-lambda.zip | n/a |
| <a name="module_kms"></a> [kms](#module\_kms) | https://github.com/NHSDigital/nhs-notify-shared-modules/releases/download/3.0.6/terraform-kms.zip | n/a |
| <a name="module_lambda_apim_key_generation"></a> [lambda\_apim\_key\_generation](#module\_lambda\_apim\_key\_generation) | https://github.com/NHSDigital/nhs-notify-shared-modules/releases/download/3.0.6/terraform-lambda.zip | n/a |
| <a name="module_lambda_lambda_apim_refresh_token"></a> [lambda\_lambda\_apim\_refresh\_token](#module\_lambda\_lambda\_apim\_refresh\_token) | https://github.com/NHSDigital/nhs-notify-shared-modules/releases/download/3.0.6/terraform-lambda.zip | n/a |
| <a name="module_mesh_acknowledge"></a> [mesh\_acknowledge](#module\_mesh\_acknowledge) | https://github.com/NHSDigital/nhs-notify-shared-modules/releases/download/3.0.6/terraform-lambda.zip | n/a |
| <a name="module_mesh_download"></a> [mesh\_download](#module\_mesh\_download) | https://github.com/NHSDigital/nhs-notify-shared-modules/releases/download/3.0.6/terraform-lambda.zip | n/a |
| <a name="module_mesh_poll"></a> [mesh\_poll](#module\_mesh\_poll) | https://github.com/NHSDigital/nhs-notify-shared-modules/releases/download/3.0.6/terraform-lambda.zip | n/a |
| <a name="module_move_scanned_files"></a> [move\_scanned\_files](#module\_move\_scanned\_files) | https://github.com/NHSDigital/nhs-notify-shared-modules/releases/download/3.0.6/terraform-lambda.zip | n/a |
| <a name="module_nhsapp_status_handler"></a> [nhsapp\_status\_handler](#module\_nhsapp\_status\_handler) | https://github.com/NHSDigital/nhs-notify-shared-modules/releases/download/3.0.6/terraform-lambda.zip | n/a |
| <a name="module_pdm_mock"></a> [pdm\_mock](#module\_pdm\_mock) | https://github.com/NHSDigital/nhs-notify-shared-modules/releases/download/3.0.6/terraform-lambda.zip | n/a |
| <a name="module_pdm_poll"></a> [pdm\_poll](#module\_pdm\_poll) | https://github.com/NHSDigital/nhs-notify-shared-modules/releases/download/3.0.6/terraform-lambda.zip | n/a |
| <a name="module_pdm_uploader"></a> [pdm\_uploader](#module\_pdm\_uploader) | https://github.com/NHSDigital/nhs-notify-shared-modules/releases/download/3.0.6/terraform-lambda.zip | n/a |
| <a name="module_print_analyser"></a> [print\_analyser](#module\_print\_analyser) | https://github.com/NHSDigital/nhs-notify-shared-modules/releases/download/3.0.6/terraform-lambda.zip | n/a |
| <a name="module_print_sender"></a> [print\_sender](#module\_print\_sender) | https://github.com/NHSDigital/nhs-notify-shared-modules/releases/download/3.0.6/terraform-lambda.zip | n/a |
| <a name="module_print_status_handler"></a> [print\_status\_handler](#module\_print\_status\_handler) | https://github.com/NHSDigital/nhs-notify-shared-modules/releases/download/3.0.6/terraform-lambda.zip | n/a |
| <a name="module_report_event_transformer"></a> [report\_event\_transformer](#module\_report\_event\_transformer) | https://github.com/NHSDigital/nhs-notify-shared-modules/releases/download/3.0.6/terraform-lambda.zip | n/a |
| <a name="module_report_generator"></a> [report\_generator](#module\_report\_generator) | https://github.com/NHSDigital/nhs-notify-shared-modules/releases/download/3.0.6/terraform-lambda.zip | n/a |
| <a name="module_report_scheduler"></a> [report\_scheduler](#module\_report\_scheduler) | https://github.com/NHSDigital/nhs-notify-shared-modules/releases/download/3.0.6/terraform-lambda.zip | n/a |
| <a name="module_report_sender"></a> [report\_sender](#module\_report\_sender) | https://github.com/NHSDigital/nhs-notify-shared-modules/releases/download/3.0.6/terraform-lambda.zip | n/a |
| <a name="module_s3bucket_cf_logs"></a> [s3bucket\_cf\_logs](#module\_s3bucket\_cf\_logs) | https://github.com/NHSDigital/nhs-notify-shared-modules/releases/download/3.0.6/terraform-s3bucket.zip | n/a |
| <a name="module_s3bucket_file_quarantine"></a> [s3bucket\_file\_quarantine](#module\_s3bucket\_file\_quarantine) | https://github.com/NHSDigital/nhs-notify-shared-modules/releases/download/3.0.6/terraform-s3bucket.zip | n/a |
| <a name="module_s3bucket_file_safe"></a> [s3bucket\_file\_safe](#module\_s3bucket\_file\_safe) | https://github.com/NHSDigital/nhs-notify-shared-modules/releases/download/3.0.6/terraform-s3bucket.zip | n/a |
| <a name="module_s3bucket_letters"></a> [s3bucket\_letters](#module\_s3bucket\_letters) | https://github.com/NHSDigital/nhs-notify-shared-modules/releases/download/3.0.6/terraform-s3bucket.zip | n/a |
| <a name="module_s3bucket_non_pii_data"></a> [s3bucket\_non\_pii\_data](#module\_s3bucket\_non\_pii\_data) | https://github.com/NHSDigital/nhs-notify-shared-modules/releases/download/3.0.6/terraform-s3bucket.zip | n/a |
| <a name="module_s3bucket_pii_data"></a> [s3bucket\_pii\_data](#module\_s3bucket\_pii\_data) | https://github.com/NHSDigital/nhs-notify-shared-modules/releases/download/3.0.6/terraform-s3bucket.zip | n/a |
| <a name="module_s3bucket_reporting"></a> [s3bucket\_reporting](#module\_s3bucket\_reporting) | https://github.com/NHSDigital/nhs-notify-shared-modules/releases/download/3.0.6/terraform-s3bucket.zip | n/a |
| <a name="module_s3bucket_static_assets"></a> [s3bucket\_static\_assets](#module\_s3bucket\_static\_assets) | https://github.com/NHSDigital/nhs-notify-shared-modules/releases/download/3.0.6/terraform-s3bucket.zip | n/a |
| <a name="module_sqs_core_notifier"></a> [sqs\_core\_notifier](#module\_sqs\_core\_notifier) | https://github.com/NHSDigital/nhs-notify-shared-modules/releases/download/3.0.6/terraform-sqs.zip | n/a |
| <a name="module_sqs_event_publisher_errors"></a> [sqs\_event\_publisher\_errors](#module\_sqs\_event\_publisher\_errors) | https://github.com/NHSDigital/nhs-notify-shared-modules/releases/download/3.0.6/terraform-sqs.zip | n/a |
| <a name="module_sqs_mesh_acknowledge"></a> [sqs\_mesh\_acknowledge](#module\_sqs\_mesh\_acknowledge) | https://github.com/NHSDigital/nhs-notify-shared-modules/releases/download/3.0.6/terraform-sqs.zip | n/a |
| <a name="module_sqs_mesh_download"></a> [sqs\_mesh\_download](#module\_sqs\_mesh\_download) | https://github.com/NHSDigital/nhs-notify-shared-modules/releases/download/3.0.6/terraform-sqs.zip | n/a |
| <a name="module_sqs_move_scanned_files"></a> [sqs\_move\_scanned\_files](#module\_sqs\_move\_scanned\_files) | https://github.com/NHSDigital/nhs-notify-shared-modules/releases/download/3.0.6/terraform-sqs.zip | n/a |
| <a name="module_sqs_nhsapp_status_handler"></a> [sqs\_nhsapp\_status\_handler](#module\_sqs\_nhsapp\_status\_handler) | https://github.com/NHSDigital/nhs-notify-shared-modules/releases/download/3.0.6/terraform-sqs.zip | n/a |
| <a name="module_sqs_pdm_poll"></a> [sqs\_pdm\_poll](#module\_sqs\_pdm\_poll) | https://github.com/NHSDigital/nhs-notify-shared-modules/releases/download/3.0.6/terraform-sqs.zip | n/a |
| <a name="module_sqs_pdm_uploader"></a> [sqs\_pdm\_uploader](#module\_sqs\_pdm\_uploader) | https://github.com/NHSDigital/nhs-notify-shared-modules/releases/download/3.0.6/terraform-sqs.zip | n/a |
| <a name="module_sqs_print_analyser"></a> [sqs\_print\_analyser](#module\_sqs\_print\_analyser) | https://github.com/NHSDigital/nhs-notify-shared-modules/releases/download/3.0.6/terraform-sqs.zip | n/a |
| <a name="module_sqs_print_sender"></a> [sqs\_print\_sender](#module\_sqs\_print\_sender) | https://github.com/NHSDigital/nhs-notify-shared-modules/releases/download/3.0.6/terraform-sqs.zip | n/a |
| <a name="module_sqs_print_status_handler"></a> [sqs\_print\_status\_handler](#module\_sqs\_print\_status\_handler) | https://github.com/NHSDigital/nhs-notify-shared-modules/releases/download/3.0.6/terraform-sqs.zip | n/a |
| <a name="module_sqs_report_generator"></a> [sqs\_report\_generator](#module\_sqs\_report\_generator) | https://github.com/NHSDigital/nhs-notify-shared-modules/releases/download/3.0.6/terraform-sqs.zip | n/a |
| <a name="module_sqs_report_sender"></a> [sqs\_report\_sender](#module\_sqs\_report\_sender) | https://github.com/NHSDigital/nhs-notify-shared-modules/releases/download/3.0.6/terraform-sqs.zip | n/a |
| <a name="module_sqs_scanner"></a> [sqs\_scanner](#module\_sqs\_scanner) | https://github.com/NHSDigital/nhs-notify-shared-modules/releases/download/3.0.6/terraform-sqs.zip | n/a |
| <a name="module_sqs_ttl"></a> [sqs\_ttl](#module\_sqs\_ttl) | https://github.com/NHSDigital/nhs-notify-shared-modules/releases/download/3.0.6/terraform-sqs.zip | n/a |
| <a name="module_sqs_ttl_handle_expiry_errors"></a> [sqs\_ttl\_handle\_expiry\_errors](#module\_sqs\_ttl\_handle\_expiry\_errors) | https://github.com/NHSDigital/nhs-notify-shared-modules/releases/download/3.0.6/terraform-sqs.zip | n/a |
| <a name="module_ttl_create"></a> [ttl\_create](#module\_ttl\_create) | https://github.com/NHSDigital/nhs-notify-shared-modules/releases/download/3.0.6/terraform-lambda.zip | n/a |
| <a name="module_ttl_handle_expiry"></a> [ttl\_handle\_expiry](#module\_ttl\_handle\_expiry) | https://github.com/NHSDigital/nhs-notify-shared-modules/releases/download/3.0.6/terraform-lambda.zip | n/a |
| <a name="module_ttl_poll"></a> [ttl\_poll](#module\_ttl\_poll) | https://github.com/NHSDigital/nhs-notify-shared-modules/releases/download/3.0.6/terraform-lambda.zip | n/a |
## Outputs

| Name | Description |
|------|-------------|
| <a name="output_deployment"></a> [deployment](#output\_deployment) | Deployment details used for post-deployment scripts |
<!-- vale on -->
<!-- markdownlint-enable -->
<!-- END_TF_DOCS -->
