"""
Module for processing messages from an SQS queue.
"""

from datetime import datetime, timezone
import json
from uuid import uuid4

from pydantic import ValidationError
from digital_letters_events import ReportGenerated, ReportSent

class ReportSenderProcessor:  # pylint: disable=too-many-instance-attributes
    """
    Class that processes messages from the SQS queue and publish a Report Sent Event to the event bus.
    """

    def __init__(self, **kwargs):
        self.__log = kwargs['log']
        self.__sender_lookup = kwargs['sender_lookup']
        self.__reports_store = kwargs['reports_store']
        self.__event_publisher = kwargs['event_publisher']
        self.__send_metric = kwargs['send_metric']
        self.__mesh_report_sender = kwargs['mesh_report_sender']

        environment = 'development'
        deployment = 'primary'
        self.__cloud_event_source = f'/nhs/england/notify/{environment}/{deployment}/digitalletters/reporting'

    def _parse_and_validate_event(self, sqs_record) -> ReportGenerated:
        """Extract report generated data from SQS record"""
        message_body = json.loads(sqs_record['body'])
        event_detail = message_body.get('detail', {})

        try:
            validated_event = ReportGenerated(**event_detail)
            self.__log.debug("CloudEvent validation passed")
            return validated_event
        except ValidationError as e:
            self.__log.error(
                "CloudEvent validation failed",
                validation_errors=str(e),
                event_detail=event_detail
            )
            raise

    def _extract_report_date_from_report_uri(self, report_uri) -> str:
        ignore_extension_characters = -4 # to skip .csv
        report_date_start_index = -14 # to extract from the end of the URI the date 2026-02-03.csv
        report_uri_str = str(report_uri)
        return report_uri_str[report_date_start_index:ignore_extension_characters]


    def process_sqs_message(self, sqs_record):
        """
        Iterates over and processes messages in the SQS queue
        """
        self.__log.info('Extract data from SQS record')

        report_generated_event : ReportGenerated = self._parse_and_validate_event(sqs_record)
        sender_id = report_generated_event.data.senderId
        report_uri = str(report_generated_event.data.reportUri)

        self.__log.info(f'Fetching sender details for sender ID: {sender_id}')
        reporting_mailbox = self.__sender_lookup.get_mesh_mailbox_reports_id_from_sender(sender_id)

        self.__log.info(f'Fetching reporting URI : {report_uri} for sender ID: {sender_id}')
        report_bytes = self.__reports_store.download_report(report_uri)
        report_date = self._extract_report_date_from_report_uri(report_uri)
        report_reference = str(uuid4())

        self.__log.info(f'Sending MESH message to the sender: {sender_id} using mailbox: {reporting_mailbox} for date: {report_date} with reference: {report_reference}')

        sent_mesh_message_id = self.__mesh_report_sender.send_report(
            reporting_mailbox,
            report_bytes,
            report_date,
            report_reference
        )

        self.__log.info(f'Publishing ReportEventSent for the sender: {sender_id} using mailbox: {reporting_mailbox} for date: {report_date}')
        self._publish_report_sent_event(sender_id, reporting_mailbox, report_reference, sent_mesh_message_id)
        self.__send_metric.record(1)

    def _publish_report_sent_event(self, sender_id, mesh_mailbox_reports_id, report_reference, sent_mesh_message_id):
        """
        Publishes a ReportSent event
        """
        now = datetime.now(timezone.utc).isoformat()

        cloud_event = {
            'id': str(uuid4()),
            'specversion': '1.0',
            'source': self.__cloud_event_source,
            'subject': f'customer/{sender_id}',
            'plane': 'data',
            'dataschemaversion': '1.0.0',
            'datacontenttype': 'application/json',
            'type': 'uk.nhs.notify.digital.letters.reporting.report.sent.v1',
            'time': now,
            'recordedtime': now,
            'severitynumber': 2,
            'severitytext': 'INFO',
            'traceparent': '00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01', # Note: covered by CCM-14255
            'dataschema': 'https://notify.nhs.uk/cloudevents/schemas/digital-letters/2025-10-draft/data/digital-letters-reporting-report-sent-data.schema.json',
            'data': {
                "senderId": sender_id,
                "meshMailboxReportsId": mesh_mailbox_reports_id,
                "reportReference": report_reference,
                "sentMeshMessageId": sent_mesh_message_id,
            },
        }

        failed_events = self.__event_publisher.send_events([cloud_event], ReportSent)

        if failed_events:
            error_msg = f"Failed to publish ReportingReportSent event: {failed_events}"
            self.__log.error(error_msg, failed_count=len(failed_events))
            raise RuntimeError(error_msg)

        self.__log.info(
            "Published ReportingReportSent event",
            sender_id=sender_id,
            mesh_mailbox_reports_id=mesh_mailbox_reports_id,
            report_reference=report_reference
        )
