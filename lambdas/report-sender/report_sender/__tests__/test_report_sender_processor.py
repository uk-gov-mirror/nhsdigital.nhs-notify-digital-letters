"""
Tests for ReportSenderProcessor class
"""
import json
import pytest
from unittest.mock import ANY, Mock
from pydantic import ValidationError
from report_sender.report_sender_processor import ReportSenderProcessor
from report_sender.errors import InvalidSenderDetailsError
from digital_letters_events import ReportSent


@pytest.fixture(name='mock_logger')
def create_mock_logger():
    """Create a mock logger for testing"""
    logger = Mock()
    logger.info = Mock()
    logger.debug = Mock()
    logger.error = Mock()
    return logger


@pytest.fixture(name='mock_sender_lookup')
def create_mock_sender_lookup():
    """Create a mock sender lookup for testing"""
    sender_lookup = Mock()
    sender_lookup.get_mesh_mailbox_reports_id_from_sender = Mock()
    return sender_lookup


@pytest.fixture(name='mock_reports_store')
def create_mock_reports_store():
    """Create a mock reports store for testing"""
    reports_store = Mock()
    reports_store.download_report = Mock()
    return reports_store


@pytest.fixture(name='mock_event_publisher')
def create_mock_event_publisher():
    """Create a mock event publisher for testing"""
    event_publisher = Mock()
    event_publisher.send_events = Mock(return_value=[])
    return event_publisher


@pytest.fixture(name='mock_send_metric')
def create_mock_send_metric():
    """Create a mock send metric for testing"""
    send_metric = Mock()
    send_metric.record = Mock()
    return send_metric


@pytest.fixture(name='mock_mesh_report_sender')
def create_mock_mesh_report_sender():
    """Create a mock MESH reports sender for testing"""
    mesh_sender = Mock()
    mesh_sender.send_report = Mock()
    return mesh_sender


@pytest.fixture(name='processor')
def create_processor(
    mock_logger,
    mock_sender_lookup,
    mock_reports_store,
    mock_event_publisher,
    mock_send_metric,
    mock_mesh_report_sender
):
    """Create a ReportSenderProcessor instance with mocked dependencies"""
    mock_config = Mock()
    return ReportSenderProcessor(
        config=mock_config,
        log=mock_logger,
        sender_lookup=mock_sender_lookup,
        reports_store=mock_reports_store,
        event_publisher=mock_event_publisher,
        send_metric=mock_send_metric,
        mesh_report_sender=mock_mesh_report_sender
    )

SENDER_ID = "test-sender-1"
REPORT_URI = "s3://bucket/report-2026-02-03.csv"

def create_valid_sqs_record(sender_id=SENDER_ID, report_uri=REPORT_URI):
    """Helper to create a valid SQS record"""
    return {
        'messageId': 'msg-123',
        'body': json.dumps({
            'detail': {
                'id': '6f1c2a53-3d54-4a0a-9a0b-0e9ae2d4c111',
                'specversion': '1.0',
                'source': '/nhs/england/notify/development/primary/digitalletters/reporting',
                'subject': 'customer/920fca11-596a-4eca-9c47-99f624614658',
                'type': 'uk.nhs.notify.digital.letters.reporting.report.generated.v1',
                'plane': 'data',
                'dataschemaversion': '1.0.0',
                'time': '2026-02-03T10:00:00Z',
                'datacontenttype': 'application/json',
                'dataschema': 'https://notify.nhs.uk/cloudevents/schemas/digital-letters/2025-10-draft/data/digital-letters-reporting-report-generated-data.schema.json',
                'data': {
                    'senderId': sender_id,
                    'reportUri': report_uri
                },
                'traceparent': '00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01',
                'recordedtime': '2026-02-03T10:00:00.250Z',
                'severitynumber': 2,
                'severitytext': 'INFO'
            }
        })
    }


class TestReportSenderProcessor:
    """Test suite for ReportSenderProcessor class"""

    def test_parse_and_validate_event_success(self, processor):
        """Test successful parsing and validation of CloudEvent"""
        sqs_record = create_valid_sqs_record()

        result = processor._parse_and_validate_event(sqs_record)

        assert result.data.senderId == SENDER_ID
        assert str(result.data.reportUri) == REPORT_URI

    def test_parse_and_validate_event_validation_error(self, processor, mock_logger):
        """Test that validation errors are handled correctly"""
        sqs_record = {
            'messageId': 'msg-123',
            'body': json.dumps({
                'detail': {
                    'id': 'event-123',
                    'specversion': '1.0',
                    'source': '/test/source',
                    'type': 'uk.nhs.notify.digital.letters.reporting.report.generated.v1',
                    'plane': 'data',
                    'dataschemaversion': '1.0.0',
                    'time': '2026-02-03T10:00:00Z',
                    'data': {
                        # Missing required fields
                    }
                }
            })
        }

        with pytest.raises(ValidationError):
            processor._parse_and_validate_event(sqs_record)

        mock_logger.error.assert_called()

    def test_process_sqs_message_success(
        self,
        processor,
        mock_sender_lookup,
        mock_reports_store,
        mock_mesh_report_sender,
        mock_event_publisher,
        mock_send_metric,
    ):
        """Test successful processing of SQS message"""
        sqs_record = create_valid_sqs_record()
        mock_sender_lookup.get_mesh_mailbox_reports_id_from_sender.return_value = 'MAILBOX001'
        mock_reports_store.download_report.return_value = b'report content'
        mock_event_publisher.send_events.return_value = []

        processor.process_sqs_message(sqs_record)

        # Verify all steps were called
        mock_sender_lookup.get_mesh_mailbox_reports_id_from_sender.assert_called_once_with(SENDER_ID)
        mock_reports_store.download_report.assert_called_once_with(REPORT_URI)
        mock_mesh_report_sender.send_report.assert_called_once_with(
            'MAILBOX001',
            b'report content',
            '2026-02-03',
            ANY,
        )
        mock_event_publisher.send_events.assert_called_once()
        mock_send_metric.record.assert_called_once_with(1)

    def test_process_sqs_message_sender_lookup_fails(
        self,
        processor,
        mock_sender_lookup,
    ):
        """Test processing fails when sender lookup fails"""
        sqs_record = create_valid_sqs_record()
        mock_sender_lookup.get_mesh_mailbox_reports_id_from_sender.side_effect = InvalidSenderDetailsError("Failed to parse mailbox ID")

        with pytest.raises(InvalidSenderDetailsError):
            processor.process_sqs_message(sqs_record)

    def test_process_sqs_message_reports_store_fails(
        self,
        processor,
        mock_sender_lookup,
        mock_reports_store
    ):
        """Test processing fails when reports store fails"""
        sqs_record = create_valid_sqs_record()
        mock_sender_lookup.get_mesh_mailbox_reports_id_from_sender.return_value = 'MAILBOX001'
        mock_reports_store.download_report.side_effect = Exception("S3 error")

        with pytest.raises(Exception, match="S3 error"):
            processor.process_sqs_message(sqs_record)

    def test_process_sqs_message_mesh_send_fails(
        self,
        processor,
        mock_sender_lookup,
        mock_reports_store,
        mock_mesh_report_sender
    ):
        """Test processing fails when MESH send fails"""
        sqs_record = create_valid_sqs_record()
        mock_sender_lookup.get_mesh_mailbox_reports_id_from_sender.return_value = 'MAILBOX001'
        mock_reports_store.download_report.return_value = b'report content'
        mock_mesh_report_sender.send_report.side_effect = Exception("MESH error")

        with pytest.raises(Exception, match="MESH error"):
            processor.process_sqs_message(sqs_record)

    def test_publish_report_sent_event_success(
        self,
        processor,
        mock_event_publisher,
        mock_logger
    ):
        """Test successful publishing of ReportSent event"""
        mesh_mailbox_reports_id = "MAILBOX001"
        report_reference = "report-reference-123"
        sent_mesh_message_id = "mesh-msg-id-abc123"

        processor._publish_report_sent_event(SENDER_ID, mesh_mailbox_reports_id, report_reference, sent_mesh_message_id)

        # Verify event was published
        mock_event_publisher.send_events.assert_called_once()
        call_args = mock_event_publisher.send_events.call_args[0][0]
        assert len(call_args) == 1
        event = call_args[0]

        # Verify event structure
        assert event['type'] == 'uk.nhs.notify.digital.letters.reporting.report.sent.v1'
        assert event['subject'] == f'customer/{SENDER_ID}'
        assert event['data']['senderId'] == SENDER_ID
        assert event['data']['meshMailboxReportsId'] == mesh_mailbox_reports_id
        assert event['data']['sentMeshMessageId'] == sent_mesh_message_id
        assert event['specversion'] == '1.0'
        assert event['plane'] == 'data'
        assert event['dataschemaversion'] == '1.0.0'
        assert event['datacontenttype'] == 'application/json'
        assert 'id' in event
        assert 'time' in event
        assert 'recordedtime' in event
        ReportSent.model_validate(event) # Validate against schema

        mock_logger.info.assert_called()

    def test_publish_report_sent_event_failure(
        self,
        processor,
        mock_event_publisher,
        mock_logger
    ):
        """Test error handling when event publishing fails"""
        mesh_mailbox_reports_id = "MAILBOX001"
        mock_event_publisher.send_events.return_value = [{'id': 'failed-event'}]
        report_reference = "report-reference-123"
        sent_mesh_message_id = "mesh-msg-id-abc123"

        with pytest.raises(RuntimeError) as exc_info:
            processor._publish_report_sent_event(SENDER_ID, mesh_mailbox_reports_id, report_reference, sent_mesh_message_id)

        assert "Failed to publish ReportingReportSent event" in str(exc_info.value)
        mock_logger.error.assert_called()
