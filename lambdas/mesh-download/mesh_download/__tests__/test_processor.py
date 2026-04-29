"""
Tests for mesh-download MeshDownloadProcessor
Following the pattern from mesh-poll tests
"""
import json
from uuid import uuid4
import pytest
from unittest.mock import Mock, patch
from datetime import datetime, timezone
from pydantic import ValidationError
from mesh_download.errors import MeshMessageNotFound
from mesh_download.document_store import DocumentAlreadyExistsError, DocumentAlreadyExistsInternalRetryError


def setup_mocks():
    """
    Create all mock objects needed for processor testing
    """
    config = Mock()
    # Set up default config attributes
    config.mesh_client = Mock()
    config.download_metric = Mock()
    config.internal_duplicate_download_metric = Mock()
    config.trust_duplicate_download_metric = Mock()
    config.s3_client = Mock()
    config.environment = 'development'
    config.transactional_data_bucket = 'test-pii-bucket'
    config.use_mesh_mock = False

    log = Mock()
    event_publisher = Mock()
    document_store = Mock()

    return config, log, event_publisher, document_store


def create_valid_cloud_event():
    """
    Create a valid CloudEvent for testing
    """
    return {
        'id': str(uuid4()),
        'specversion': '1.0',
        'source': '/nhs/england/notify/development/primary/digitalletters/mesh',
        'subject': 'customer/00000000-0000-0000-0000-000000000000/recipient/00000000-0000-0000-0000-000000000000',
        'type': 'uk.nhs.notify.digital.letters.mesh.inbox.message.received.v1',
        'plane': 'data',
        'dataschemaversion': '1.0.0',
        'datacontenttype': 'application/json',
        'time': '2023-01-01T12:00:00Z',
        'recordedtime': '2023-01-01T12:00:00Z',
        'severitynumber': 2,
        'severitytext': 'INFO',
        'traceparent': '00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01',
        'dataschema': 'https://notify.nhs.uk/cloudevents/schemas/digital-letters/2025-10-draft/data/digital-letters-mesh-inbox-message-received-data.schema.json',
        'data': {
            'meshMessageId': 'test-message-123',
            'senderId': 'TEST-SENDER',
            'messageReference': 'ref-001'
        }
    }


def create_sqs_record(cloud_event=None):
    """
    Create a mock SQS record containing a CloudEvent
    """
    if cloud_event is None:
        cloud_event = create_valid_cloud_event()

    return {
        'messageId': 'sqs-msg-123',
        'eventSource': 'aws:sqs',
        'body': json.dumps({'detail': cloud_event})
    }

def create_fhir_content():
    """
    Create a mock FHIR JSON content for testing
    """
    return json.dumps({
        "resourceType": "DocumentReference",
        "id": "82bfb7f3-4889-4e15-b308-bbe4e3cd431f",
        "status": "current",
        "docStatus": "final",
        "type": {
            "coding": [
            {
                "system": "http://snomed.info/sct",
                "code": "308540004",
                "display": "Appointment"
            }
            ]
        },
        "subject": {
            "identifier": {
            "system": "https://fhir.nhs.uk/Id/nhs-number",
            "value": "9876543210"
            }
        },
        "author": [
            {
            "identifier": {
                "system": "https://fhir.nhs.uk/Id/ods-organization-code",
                "value": "RX809"
            },
            "display": "Example NHS Trust"
            }
        ],
        "custodian": {
            "identifier": {
            "system": "https://fhir.nhs.uk/Id/ods-organization-code",
            "value": "C4L8E"
            },
            "display": "NHS ENGLAND: NHS NOTIFY"
        },
        "date": "2025-11-19T14:30:00Z",
        "description": "Appointment notification letter for outpatient consultation",
        "content": [
            {
                "attachment": {
                    "contentType": "application/pdf",
                    "title": "Appointment Letter - November 2025",
                    "data": "base64here=="
                    }
            }
        ]
    })

def create_mesh_message(message_id='test_123', sender='SENDER_001', local_id='ref_001'):
    """
    Create a mock MESH message object
    """
    message = Mock()
    message.id.return_value = message_id
    message.sender = sender
    message.local_id = local_id
    message.subject = 'test_document.pdf'
    message.workflow_id = 'TEST_WORKFLOW'
    message.message_type = 'DATA'
    message.read.return_value = create_fhir_content()
    message.acknowledge = Mock()

    return message


class TestMeshDownloadProcessor:
    """Test suite for MeshDownloadProcessor"""

    def test_processor_initialization_calls_mesh_handshake(self):
        """Processor initializes and handshakes mesh client"""
        from mesh_download.processor import MeshDownloadProcessor

        config, log, event_publisher, document_store = setup_mocks()

        processor = MeshDownloadProcessor(
            config=config,
            log=log,
            mesh_client=config.mesh_client,
            download_metric=config.download_metric,
            internal_duplicate_download_metric=config.internal_duplicate_download_metric,
            trust_duplicate_download_metric=config.trust_duplicate_download_metric,
            document_store=document_store,
            event_publisher=event_publisher
        )

        config.mesh_client.handshake.assert_called_once()

    @patch('mesh_download.processor.datetime')
    def test_process_sqs_message_success(self, mock_datetime):
        """Successful end-to-end: validate, download, store via document_store, publish, acknowledge"""
        from mesh_download.processor import MeshDownloadProcessor

        config, log, event_publisher, document_store = setup_mocks()

        fixed_time = datetime(2025, 11, 19, 15, 30, 45, tzinfo=timezone.utc)
        mock_datetime.now.return_value = fixed_time

        document_store.store_document.return_value = 'document-reference/SENDER-001/ref-001_test-message-123'

        event_publisher.send_events.return_value = []

        processor = MeshDownloadProcessor(
            config=config,
            log=log,
            mesh_client=config.mesh_client,
            download_metric=config.download_metric,
            internal_duplicate_download_metric=config.internal_duplicate_download_metric,
            trust_duplicate_download_metric=config.trust_duplicate_download_metric,
            document_store=document_store,
            event_publisher=event_publisher
        )

        mesh_message = create_mesh_message()
        config.mesh_client.retrieve_message.return_value = mesh_message

        sqs_record = create_sqs_record()

        outcome = processor.process_sqs_message(sqs_record)

        assert outcome == 'downloaded'
        config.mesh_client.retrieve_message.assert_called_once_with('test-message-123')

        mesh_message.read.assert_called_once()

        document_store.store_document.assert_called_once_with(
            sender_id='TEST-SENDER',
            message_reference='ref-001',
            mesh_message_id='test-message-123',
            content=create_fhir_content()
        )

        mesh_message.acknowledge.assert_called_once()

        config.download_metric.record.assert_called_once_with(1)

        event_publisher.send_events.assert_called_once()

        # Verify the published event content
        published_events = event_publisher.send_events.call_args[0][0]
        assert len(published_events) == 1

        published_event = published_events[0]

        # Verify CloudEvent envelope fields
        assert published_event['type'] == 'uk.nhs.notify.digital.letters.mesh.inbox.message.downloaded.v1'
        assert published_event['source'] == '/nhs/england/notify/development/primary/digitalletters/mesh'
        assert published_event['subject'] == 'customer/00000000-0000-0000-0000-000000000000/recipient/00000000-0000-0000-0000-000000000000'
        assert published_event['time'] == '2025-11-19T15:30:45+00:00'
        assert published_event['plane'] == 'data'
        assert published_event['dataschemaversion'] == '1.0.0'
        assert published_event['datacontenttype'] == 'application/json'
        assert 'id' in published_event
        assert 'tracestate' not in published_event
        assert 'partitionkey' not in published_event
        assert 'sequence' not in published_event
        assert 'dataclassification' not in published_event
        assert 'dataregulation' not in published_event
        assert 'datacategory' not in published_event

        # Verify CloudEvent data payload
        event_data = published_event['data']
        assert event_data['senderId'] == 'TEST-SENDER'
        assert event_data['messageReference'] == 'ref-001'
        assert event_data['messageUri'] == 's3://test-pii-bucket/document-reference/SENDER-001/ref-001_test-message-123'
        assert set(event_data.keys()) == {'senderId', 'messageReference', 'messageUri', 'meshMessageId'}

    @patch('mesh_download.processor.datetime')
    def test_process_sqs_message_invalid_fhir_content(self, mock_datetime):
        from mesh_download.processor import MeshDownloadProcessor

        config, log, event_publisher, document_store = setup_mocks()

        fixed_time = datetime(2025, 11, 19, 15, 30, 45, tzinfo=timezone.utc)
        mock_datetime.now.return_value = fixed_time

        document_store.store_document.return_value = 'document-reference/SENDER_001_ref_001'

        event_publisher.send_events.return_value = []

        processor = MeshDownloadProcessor(
            config=config,
            log=log,
            mesh_client=config.mesh_client,
            download_metric=config.download_metric,
            internal_duplicate_download_metric=config.internal_duplicate_download_metric,
            trust_duplicate_download_metric=config.trust_duplicate_download_metric,
            document_store=document_store,
            event_publisher=event_publisher
        )

        mesh_message = create_mesh_message()
        mesh_message.read.return_value = '{}'  # invalid FHIR content (empty JSON)}
        config.mesh_client.retrieve_message.return_value = mesh_message

        sqs_record = create_sqs_record()

        processor.process_sqs_message(sqs_record)

        config.mesh_client.retrieve_message.assert_called_once_with('test-message-123')

        mesh_message.read.assert_called_once()

        document_store.store_document.assert_not_called()

        mesh_message.acknowledge.assert_called_once()

        config.download_metric.record.assert_not_called()

        event_publisher.send_events.assert_called_once()

        # Verify the published event content
        published_events = event_publisher.send_events.call_args[0][0]
        assert len(published_events) == 1

        published_event = published_events[0]

        # Verify CloudEvent envelope fields
        assert published_event['type'] == 'uk.nhs.notify.digital.letters.mesh.inbox.message.invalid.v1'
        assert published_event['source'] == '/nhs/england/notify/development/primary/digitalletters/mesh'
        assert published_event['subject'] == 'customer/00000000-0000-0000-0000-000000000000/recipient/00000000-0000-0000-0000-000000000000'
        assert published_event['time'] == '2025-11-19T15:30:45+00:00'
        assert published_event['plane'] == 'data'
        assert published_event['dataschemaversion'] == '1.0.0'
        assert published_event['datacontenttype'] == 'application/json'
        assert 'id' in published_event
        assert 'tracestate' not in published_event
        assert 'partitionkey' not in published_event
        assert 'sequence' not in published_event
        assert 'dataclassification' not in published_event
        assert 'dataregulation' not in published_event
        assert 'datacategory' not in published_event

        # Verify CloudEvent data payload
        event_data = published_event['data']
        assert event_data['senderId'] == 'TEST-SENDER'
        assert event_data['messageReference'] == 'ref-001'
        assert event_data['meshMessageId'] == 'test-message-123'
        assert event_data['failureCode'] == 'DL_CLIV_005'
        assert set(event_data.keys()) == {'senderId', 'messageReference', 'meshMessageId', 'failureCode'}

    def test_process_sqs_message_validation_failure(self):
        """Malformed CloudEvents should be rejected by pydantic and not trigger downloads"""
        from mesh_download.processor import MeshDownloadProcessor

        config, log, event_publisher, document_store = setup_mocks()

        processor = MeshDownloadProcessor(
            config=config,
            log=log,
            mesh_client=config.mesh_client,
            download_metric=config.download_metric,
            internal_duplicate_download_metric=config.internal_duplicate_download_metric,
            trust_duplicate_download_metric=config.trust_duplicate_download_metric,
            document_store=document_store,
            event_publisher=event_publisher
        )

        # Create broken cloud event
        invalid_event = {'id': 'test-id'}  # missing required fields
        sqs_record = create_sqs_record(cloud_event=invalid_event)

        with pytest.raises(ValidationError):
            processor.process_sqs_message(sqs_record)

        config.mesh_client.retrieve_message.assert_not_called()

    def test_process_sqs_message_missing_mesh_message_id(self):
        """Event missing meshMessageId should not be processed"""
        from mesh_download.processor import MeshDownloadProcessor

        config, log, event_publisher, document_store = setup_mocks()

        processor = MeshDownloadProcessor(
            config=config,
            log=log,
            mesh_client=config.mesh_client,
            download_metric=config.download_metric,
            internal_duplicate_download_metric=config.internal_duplicate_download_metric,
            trust_duplicate_download_metric=config.trust_duplicate_download_metric,
            document_store=document_store,
            event_publisher=event_publisher
        )

        event = create_valid_cloud_event()
        del event['data']['meshMessageId']
        sqs_record = create_sqs_record(cloud_event=event)

        # Should raise ValidationError for missing required field
        with pytest.raises(ValidationError, match="meshMessageId"):
            processor.process_sqs_message(sqs_record)

        config.mesh_client.retrieve_message.assert_not_called()

    def test_download_and_store_message_not_found(self):
        """If MESH returns None, nothing is stored or published"""
        from mesh_download.processor import MeshDownloadProcessor

        config, log, event_publisher, document_store = setup_mocks()
        bound_logger = Mock()
        log.bind.return_value = bound_logger

        processor = MeshDownloadProcessor(
            config=config,
            log=log,
            mesh_client=config.mesh_client,
            download_metric=config.download_metric,
            internal_duplicate_download_metric=config.internal_duplicate_download_metric,
            trust_duplicate_download_metric=config.trust_duplicate_download_metric,
            document_store=document_store,
            event_publisher=event_publisher
        )

        config.mesh_client.retrieve_message.return_value = None
        sqs_record = create_sqs_record()

        with pytest.raises(MeshMessageNotFound, match="MESH message with ID test-message-123 not found"):
            processor.process_sqs_message(sqs_record)

        config.mesh_client.retrieve_message.assert_called_once_with('test-message-123')
        document_store.store_document.assert_not_called()
        event_publisher.send_events.assert_not_called()
        config.download_metric.record.assert_not_called()

        bound_logger.error.assert_called_once_with("Message not found in MESH inbox")

    def test_document_store_failure_prevents_ack_and_raises(self):
        """If storing fails the processor should raise and not acknowledge the MESH message"""
        from mesh_download.processor import MeshDownloadProcessor

        config, log, event_publisher, document_store = setup_mocks()

        document_store.store_document.side_effect = Exception("document store failure")

        processor = MeshDownloadProcessor(
            config=config,
            log=log,
            mesh_client=config.mesh_client,
            download_metric=config.download_metric,
            internal_duplicate_download_metric=config.internal_duplicate_download_metric,
            trust_duplicate_download_metric=config.trust_duplicate_download_metric,
            document_store=document_store,
            event_publisher=event_publisher
        )

        mesh_message = create_mesh_message()
        config.mesh_client.retrieve_message.return_value = mesh_message
        sqs_record = create_sqs_record()

        with pytest.raises(Exception, match="document store failure"):
            processor.process_sqs_message(sqs_record)

        # ensure we did not acknowledge the message if storage failed
        mesh_message.acknowledge.assert_not_called()

    @patch('mesh_download.processor.datetime')
    def test_bucket_selection_with_mesh_mock_enabled(self, mock_datetime):
        """When use_mesh_mock=True, processor uses PII bucket for storage"""
        from mesh_download.processor import MeshDownloadProcessor

        config, log, event_publisher, document_store = setup_mocks()
        # Configure for mock mesh
        config.use_mesh_mock = True
        config.transactional_data_bucket = 'test-pii-bucket'

        fixed_time = datetime(2025, 11, 19, 15, 30, 45, tzinfo=timezone.utc)
        mock_datetime.now.return_value = fixed_time

        document_store.store_document.return_value = 'document-reference/SENDER_001_ref_001'
        event_publisher.send_events.return_value = []

        processor = MeshDownloadProcessor(
            config=config,
            log=log,
            mesh_client=config.mesh_client,
            download_metric=config.download_metric,
            internal_duplicate_download_metric=config.internal_duplicate_download_metric,
            trust_duplicate_download_metric=config.trust_duplicate_download_metric,
            document_store=document_store,
            event_publisher=event_publisher
        )

        mesh_message = create_mesh_message()
        config.mesh_client.retrieve_message.return_value = mesh_message
        sqs_record = create_sqs_record()

        outcome = processor.process_sqs_message(sqs_record)

        assert outcome == 'downloaded'
        # Verify event was published with PII bucket in URI
        event_publisher.send_events.assert_called_once()
        published_events = event_publisher.send_events.call_args[0][0]
        assert len(published_events) == 1
        message_uri = published_events[0]['data']['messageUri']
        assert message_uri.startswith('s3://test-pii-bucket/')

    @patch('mesh_download.processor.datetime')
    def test_bucket_selection_with_mesh_mock_disabled(self, mock_datetime):
        """When use_mesh_mock=False, processor uses PII bucket for storage"""
        from mesh_download.processor import MeshDownloadProcessor

        config, log, event_publisher, document_store = setup_mocks()
        # Configure for production (PII bucket)
        config.use_mesh_mock = False
        config.transactional_data_bucket = 'test-pii-bucket'

        fixed_time = datetime(2025, 11, 19, 15, 30, 45, tzinfo=timezone.utc)
        mock_datetime.now.return_value = fixed_time

        document_store.store_document.return_value = 'document-reference/SENDER_001_ref_001'
        event_publisher.send_events.return_value = []

        processor = MeshDownloadProcessor(
            config=config,
            log=log,
            mesh_client=config.mesh_client,
            download_metric=config.download_metric,
            internal_duplicate_download_metric=config.internal_duplicate_download_metric,
            trust_duplicate_download_metric=config.trust_duplicate_download_metric,
            document_store=document_store,
            event_publisher=event_publisher
        )

        mesh_message = create_mesh_message()
        config.mesh_client.retrieve_message.return_value = mesh_message
        sqs_record = create_sqs_record()

        outcome = processor.process_sqs_message(sqs_record)

        assert outcome == 'downloaded'
        event_publisher.send_events.assert_called_once()
        published_events = event_publisher.send_events.call_args[0][0]
        assert len(published_events) == 1
        message_uri = published_events[0]['data']['messageUri']
        assert message_uri.startswith('s3://test-pii-bucket/')

    def test_duplicate_delivery_skips_publish_and_acknowledge(self):
        """
        Internal retry: the object already exists with the same meshMessageId.
        Skip publish, record internal metric, acknowledge
        """
        from mesh_download.processor import MeshDownloadProcessor

        config, log, event_publisher, document_store = setup_mocks()
        bound_logger = Mock()
        log.bind.return_value = bound_logger

        document_store.store_document.side_effect = DocumentAlreadyExistsInternalRetryError(
            "Internal retry for key: document-reference/TEST-SENDER/ref-001"
        )

        processor = MeshDownloadProcessor(
            config=config,
            log=log,
            mesh_client=config.mesh_client,
            download_metric=config.download_metric,
            internal_duplicate_download_metric=config.internal_duplicate_download_metric,
            trust_duplicate_download_metric=config.trust_duplicate_download_metric,
            document_store=document_store,
            event_publisher=event_publisher
        )

        mesh_message = create_mesh_message()
        config.mesh_client.retrieve_message.return_value = mesh_message
        sqs_record = create_sqs_record()

        outcome = processor.process_sqs_message(sqs_record)

        assert outcome == 'skipped'
        bound_logger.warning.assert_called_once()
        assert "Internal retry" in bound_logger.warning.call_args[0][0]
        config.internal_duplicate_download_metric.record.assert_called_once_with(1)
        config.trust_duplicate_download_metric.record.assert_not_called()
        event_publisher.send_events.assert_not_called()
        config.download_metric.record.assert_not_called()
        # Acknowledge should still be called to remove message from MESH inbox
        mesh_message.acknowledge.assert_called_once()

    @patch('mesh_download.processor.datetime')
    def test_trust_duplicate_publishes_invalid_event_and_acknowledges(self, mock_datetime):
        """
        Trust duplicate: the object already exists with a different meshMessageId.
        Publish invalid event with DL_CLIV_004, record trust metric, acknowledge
        """
        from mesh_download.processor import MeshDownloadProcessor

        config, log, event_publisher, document_store = setup_mocks()
        bound_logger = Mock()
        log.bind.return_value = bound_logger

        fixed_time = datetime(2025, 11, 19, 15, 30, 45, tzinfo=timezone.utc)
        mock_datetime.now.return_value = fixed_time

        document_store.store_document.side_effect = DocumentAlreadyExistsError(
            "Trust duplicate for key: document-reference/TEST-SENDER/ref-001"
        )
        event_publisher.send_events.return_value = []

        processor = MeshDownloadProcessor(
            config=config,
            log=log,
            mesh_client=config.mesh_client,
            download_metric=config.download_metric,
            internal_duplicate_download_metric=config.internal_duplicate_download_metric,
            trust_duplicate_download_metric=config.trust_duplicate_download_metric,
            document_store=document_store,
            event_publisher=event_publisher
        )

        mesh_message = create_mesh_message()
        config.mesh_client.retrieve_message.return_value = mesh_message
        sqs_record = create_sqs_record()

        outcome = processor.process_sqs_message(sqs_record)

        assert outcome == 'duplicate'
        bound_logger.warning.assert_called_once()
        assert "Trust duplicate" in bound_logger.warning.call_args[0][0]
        config.trust_duplicate_download_metric.record.assert_called_once_with(1)
        config.internal_duplicate_download_metric.record.assert_not_called()
        config.download_metric.record.assert_not_called()

        event_publisher.send_events.assert_called_once()
        published_event = event_publisher.send_events.call_args[0][0][0]
        assert published_event['type'] == 'uk.nhs.notify.digital.letters.mesh.inbox.message.invalid.v1'
        assert published_event['time'] == '2025-11-19T15:30:45+00:00'

        event_data = published_event['data']
        assert event_data['senderId'] == 'TEST-SENDER'
        assert event_data['meshMessageId'] == 'test-message-123'
        assert event_data['messageReference'] == 'ref-001'
        assert event_data['failureCode'] == 'DL_CLIV_004'

        mesh_message.acknowledge.assert_called_once()
