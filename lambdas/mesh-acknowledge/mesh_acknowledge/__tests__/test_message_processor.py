"""
Tests for MessageProcessor class in mesh_acknowledge.message_processor
"""
from unittest.mock import Mock, patch
from uuid import uuid4
import pytest
from digital_letters_events import MESHInboxMessageDownloaded, MESHInboxMessageInvalid
from mesh_acknowledge.message_processor import MessageProcessor

from .fixtures import create_downloaded_event_dict, create_invalid_event_dict


@pytest.fixture(name='mock_logger')
def create_mock_logger():
    """Create a mock logger for testing"""
    logger = Mock()
    logger.info = Mock()
    logger.warn = Mock()
    logger.error = Mock()
    return logger


@pytest.fixture(name='mock_acknowledger')
def create_mock_acknowledger():
    """Create a mock MeshAcknowledger for testing"""
    acknowledger = Mock()
    acknowledger.acknowledge_message = Mock(return_value="ACK123")
    return acknowledger


@pytest.fixture(name='mock_event_publisher')
def create_mock_event_publisher():
    """Create a mock EventPublisher for testing"""
    publisher = Mock()
    publisher.send_events = Mock(return_value=[])
    return publisher


@pytest.fixture(name='mock_sender_lookup')
def create_mock_sender_lookup():
    """Create a mock SenderLookup for testing"""
    lookup = Mock()
    lookup.get_mailbox_id = Mock(return_value="MAILBOX001")
    return lookup

@pytest.fixture(name='mock_dlq')
def create_mock_dlq():
    """Create a mock Dlq for testing"""
    dlq = Mock()
    dlq.send_to_queue = Mock()
    return dlq

@pytest.fixture(name='message_processor')
def create_message_processor(
        mock_acknowledger, mock_event_publisher,
        mock_sender_lookup, mock_logger, mock_dlq):
    """Create a MessageProcessor instance with mocked dependencies"""
    return MessageProcessor(
        mock_acknowledger,
        mock_event_publisher,
        mock_sender_lookup,
        mock_dlq,
        mock_logger
    )


@pytest.fixture(name='downloaded_event')
def downloaded_event_fixture():
    """Create a MESHInboxMessageDownloaded event"""
    event_id = str(uuid4())
    return MESHInboxMessageDownloaded(**create_downloaded_event_dict(event_id))


@pytest.fixture(name='valid_sqs_message')
def create_valid_sqs_message():
    """Create a valid SQS message with one downloaded event record"""
    event_id = str(uuid4())
    import json
    return {
        'Records': [
            {
                'messageId': 'sqs-msg-123',
                'eventSource': 'aws:sqs',
                'body': json.dumps({'detail': create_downloaded_event_dict(event_id)}),
            }
        ]
    }


class TestMessageProcessorProcessMessage:
    """Test suite for MessageProcessor.process_message"""

    @patch('mesh_acknowledge.message_processor.publish_acknowledged_event')
    @patch('mesh_acknowledge.message_processor.parse_downloaded_event')
    def test_process_message_success(
        self,
        mock_parse,
        mock_publish,
        message_processor,
        mock_acknowledger,
        mock_sender_lookup,
        mock_event_publisher,
        mock_logger,
        valid_sqs_message,
        downloaded_event: MESHInboxMessageDownloaded
    ):
        """Test successful processing of a single SQS message"""
        mesh_mailbox_id = "MAILBOX001"

        mock_parse.return_value = downloaded_event
        mock_sender_lookup.get_mailbox_id.return_value = mesh_mailbox_id
        mock_acknowledger.acknowledge_message.return_value = "ACK123"

        result = message_processor.process_message(valid_sqs_message)

        assert result == []

        mock_parse.assert_called_once_with(
            valid_sqs_message['Records'][0],
            mock_logger
        )
        mock_sender_lookup.get_mailbox_id.assert_called_once_with(
            downloaded_event.data.senderId)
        mock_acknowledger.acknowledge_message.assert_called_once_with(
            mailbox_id=mesh_mailbox_id,
            message_reference=downloaded_event.data.messageReference,
            sender_id=downloaded_event.data.senderId,
            message_id=downloaded_event.data.meshMessageId
        )
        mock_publish.assert_called_once_with(
            logger=mock_logger,
            event_publisher=mock_event_publisher,
            incoming_event=downloaded_event,
            mesh_mailbox_id=mesh_mailbox_id,
            sent_mesh_message_id="ACK123"
        )

    @patch('mesh_acknowledge.message_processor.publish_acknowledged_event')
    @patch('mesh_acknowledge.message_processor.parse_downloaded_event')
    def test_process_message_multiple_records(
        self,
        mock_parse,
        mock_publish,
        message_processor,
        mock_sender_lookup,
        mock_acknowledger,
        downloaded_event
    ):
        """Test processing multiple SQS records"""
        mock_parse.return_value = downloaded_event
        mock_sender_lookup.get_mailbox_id.return_value = "MAILBOX001"
        mock_acknowledger.acknowledge_message.return_value = "ACK123"

        message = {
            'Records': [
                {'messageId': 'msg-1', 'eventSource': 'aws:sqs',
                    'body': '{"detail": {"type": "uk.nhs.notify.digital.letters.mesh.inbox.message.downloaded.v1"}}'},
                {'messageId': 'msg-2', 'eventSource': 'aws:sqs',
                    'body': '{"detail": {"type": "uk.nhs.notify.digital.letters.mesh.inbox.message.downloaded.v1"}}'},
                {'messageId': 'msg-3', 'eventSource': 'aws:sqs',
                    'body': '{"detail": {"type": "uk.nhs.notify.digital.letters.mesh.inbox.message.downloaded.v1"}}'}
            ]
        }

        result = message_processor.process_message(message)

        assert result == []
        assert mock_acknowledger.acknowledge_message.call_count == 3
        assert mock_publish.call_count == 3

    @patch('mesh_acknowledge.message_processor.publish_acknowledged_event')
    @patch('mesh_acknowledge.message_processor.parse_downloaded_event')
    def test_process_message_partial_failures(
        self,
        mock_parse,
        mock_publish,
        message_processor,
        mock_sender_lookup,
        mock_acknowledger,
        downloaded_event
    ):
        """Test processing with some successes and some failures"""
        # First call succeeds, second fails, third succeeds
        mock_parse.side_effect = [
            downloaded_event,
            ValueError("Parse failed"),
            downloaded_event
        ]
        mock_sender_lookup.get_mailbox_id.return_value = "MAILBOX001"
        mock_acknowledger.acknowledge_message.return_value = "ACK123"

        message = {
            'Records': [
                {'messageId': 'msg-1', 'eventSource': 'aws:sqs',
                    'body': '{"detail": {"type": "uk.nhs.notify.digital.letters.mesh.inbox.message.downloaded.v1"}}'},
                {'messageId': 'msg-2', 'eventSource': 'aws:sqs',
                    'body': '{"detail": {"type": "uk.nhs.notify.digital.letters.mesh.inbox.message.downloaded.v1"}}'},
                {'messageId': 'msg-3', 'eventSource': 'aws:sqs',
                    'body': '{"detail": {"type": "uk.nhs.notify.digital.letters.mesh.inbox.message.downloaded.v1"}}'}
            ]
        }

        result = message_processor.process_message(message)

        assert len(result) == 1
        assert result[0] == {"itemIdentifier": "msg-2"}
        assert mock_acknowledger.acknowledge_message.call_count == 2
        assert mock_publish.call_count == 2

    @patch('mesh_acknowledge.message_processor.publish_acknowledged_event')
    @patch('mesh_acknowledge.message_processor.parse_downloaded_event')
    def test_process_message_all_failures(
        self,
        mock_parse,
        mock_publish,
        message_processor,
        mock_acknowledger,
    ):
        """Test processing where all messages fail"""
        mock_parse.side_effect = Exception("All fail")

        message = {
            'Records': [
                {
                    'messageId': 'msg-1', 'eventSource': 'aws:sqs',
                    'body': '{"detail": {"type": "uk.nhs.notify.digital.letters.mesh.inbox.message.downloaded.v1"}}'
                },
                {
                    'messageId': 'msg-2', 'eventSource': 'aws:sqs',
                    'body': '{"detail": {"type": "uk.nhs.notify.digital.letters.mesh.inbox.message.downloaded.v1"}}'
                }
            ]
        }

        result = message_processor.process_message(message)

        assert len(result) == 2
        assert result[0] == {"itemIdentifier": "msg-1"}
        assert result[1] == {"itemIdentifier": "msg-2"}
        mock_acknowledger.acknowledge_message.assert_not_called()
        mock_publish.assert_not_called()

    @patch('mesh_acknowledge.message_processor.publish_acknowledged_event')
    def test_process_message_empty_records(
        self,
        mock_publish,
        mock_acknowledger,
        message_processor,
    ):
        """Test processing message with no records"""
        message = {'Records': []}

        result = message_processor.process_message(message)

        assert result == []
        mock_acknowledger.acknowledge_message.assert_not_called()
        mock_publish.assert_not_called()

    @patch('mesh_acknowledge.message_processor.publish_acknowledged_event')
    def test_process_message_missing_records_key(
        self,
        mock_publish,
        message_processor,
        mock_acknowledger,
    ):
        """Test processing message without Records key"""
        message = {}

        result = message_processor.process_message(message)

        assert result == []
        mock_acknowledger.acknowledge_message.assert_not_called()
        mock_publish.assert_not_called()

    @patch('mesh_acknowledge.message_processor.publish_acknowledged_event')
    @patch('mesh_acknowledge.message_processor.parse_downloaded_event')
    def test_process_message_parse_error_returns_failure(
        self,
        mock_parse,
        mock_publish,
        message_processor,
        mock_acknowledger,
        valid_sqs_message
    ):
        """Test that parse errors are caught and returned as batch failures"""
        mock_parse.side_effect = ValueError("Parse failed")

        result = message_processor.process_message(valid_sqs_message)

        assert len(result) == 1
        assert result[0] == {"itemIdentifier": "sqs-msg-123"}

        mock_acknowledger.acknowledge_message.assert_not_called()
        mock_publish.assert_not_called()

    @patch('mesh_acknowledge.message_processor.publish_acknowledged_event')
    @patch('mesh_acknowledge.message_processor.parse_downloaded_event')
    def test_process_message_empty_sender_lookup_response_returns_failure(
        self,
        mock_parse,
        mock_publish,
        message_processor,
        mock_sender_lookup,
        mock_acknowledger,
        valid_sqs_message,
        downloaded_event
    ):
        """Test that an empty sender lookup response causes a batch failure to be returned"""
        mock_parse.return_value = downloaded_event
        mock_sender_lookup.get_mailbox_id.return_value = None

        result = message_processor.process_message(valid_sqs_message)

        assert len(result) == 1
        assert result[0] == {"itemIdentifier": "sqs-msg-123"}

        mock_acknowledger.acknowledge_message.assert_not_called()
        mock_publish.assert_not_called()

    @patch('mesh_acknowledge.message_processor.publish_acknowledged_event')
    @patch('mesh_acknowledge.message_processor.parse_downloaded_event')
    def test_process_message_sender_lookup_error_returns_failure(
        self,
        mock_parse,
        mock_publish,
        message_processor,
        mock_sender_lookup,
        mock_acknowledger,
        valid_sqs_message,
        downloaded_event
    ):
        """Test that sender lookup errors are caught and returned as batch failures"""
        mock_parse.return_value = downloaded_event
        mock_sender_lookup.get_mailbox_id.side_effect = Exception(
            "Sender lookup error")

        result = message_processor.process_message(valid_sqs_message)

        assert len(result) == 1
        assert result[0] == {"itemIdentifier": "sqs-msg-123"}

        mock_acknowledger.acknowledge_message.assert_not_called()
        mock_publish.assert_not_called()

    @patch('mesh_acknowledge.message_processor.publish_acknowledged_event')
    @patch('mesh_acknowledge.message_processor.parse_downloaded_event')
    def test_process_message_acknowledge_error_returns_failure(
        self,
        mock_parse,
        mock_publish,
        message_processor,
        mock_sender_lookup,
        mock_acknowledger,
        valid_sqs_message,
        downloaded_event
    ):
        """Test that acknowledge errors are caught and returned as batch failures"""
        mock_parse.return_value = downloaded_event
        mock_sender_lookup.get_mailbox_id.return_value = "MAILBOX001"
        mock_acknowledger.acknowledge_message.side_effect = RuntimeError(
            "ACK failed")

        result = message_processor.process_message(valid_sqs_message)

        assert len(result) == 1
        assert result[0] == {"itemIdentifier": "sqs-msg-123"}

        mock_publish.assert_not_called()

    @patch('mesh_acknowledge.message_processor.publish_acknowledged_event')
    @patch('mesh_acknowledge.message_processor.parse_downloaded_event')
    def test_process_message_publish_error_sends_to_dlq(
        self,
        mock_parse,
        mock_publish,
        message_processor,
        mock_sender_lookup,
        mock_acknowledger,
        mock_dlq,
        valid_sqs_message,
        downloaded_event
    ):
        """
        Test that publish errors are caught and the record is sent directly to the DLQ
        """
        mock_parse.return_value = downloaded_event
        mock_sender_lookup.get_mailbox_id.return_value = "MAILBOX001"
        mock_acknowledger.acknowledge_message.return_value = "ACK123"
        mock_publish.side_effect = Exception("Publish failed")

        result = message_processor.process_message(valid_sqs_message)

        assert result == []
        mock_dlq.send_to_queue.assert_called_once_with(
            record=valid_sqs_message['Records'][0],
            reason="Failed to publish acknowledged event"
        )

    @patch('mesh_acknowledge.message_processor.publish_acknowledged_event')
    @patch('mesh_acknowledge.message_processor.parse_downloaded_event')
    def test_process_message_dlq_error_returns_failure(
        self,
        mock_parse,
        mock_publish,
        message_processor,
        mock_sender_lookup,
        mock_acknowledger,
        mock_dlq,
        valid_sqs_message,
        downloaded_event
    ):
        """
        Test that if publishing to the DLQ fails, the record is returned as a batch failure.
        """
        mock_parse.return_value = downloaded_event
        mock_sender_lookup.get_mailbox_id.return_value = "MAILBOX001"
        mock_acknowledger.acknowledge_message.return_value = "ACK123"
        mock_publish.side_effect = Exception("Publish failed")
        mock_dlq.send_to_queue.side_effect = Exception("DLQ send failed")

        result = message_processor.process_message(valid_sqs_message)

        assert len(result) == 1
        assert result[0] == {"itemIdentifier": "sqs-msg-123"}

    @patch('mesh_acknowledge.message_processor.parse_downloaded_event')
    def test_process_message_logs_summary(
        self,
        mock_parse,
        message_processor,
        mock_sender_lookup,
        mock_acknowledger,
        mock_logger,
        downloaded_event
    ):
        """Test that processing summary is logged correctly"""
        mock_parse.side_effect = [
            downloaded_event,
            ValueError("Failed"),
            downloaded_event
        ]
        mock_sender_lookup.get_mailbox_id.return_value = "MAILBOX001"
        mock_acknowledger.acknowledge_message.return_value = "ACK123"

        message = {
            'Records': [
                {'messageId': 'msg-1', 'eventSource': 'aws:sqs',
                    'body': '{"detail": {"type": "uk.nhs.notify.digital.letters.mesh.inbox.message.downloaded.v1"}}'},
                {'messageId': 'msg-2', 'eventSource': 'aws:sqs',
                    'body': '{"detail": {"type": "uk.nhs.notify.digital.letters.mesh.inbox.message.downloaded.v1"}}'},
                {'messageId': 'msg-3', 'eventSource': 'aws:sqs',
                    'body': '{"detail": {"type": "uk.nhs.notify.digital.letters.mesh.inbox.message.downloaded.v1"}}'}
            ]
        }

        message_processor.process_message(message)

        # Check final summary log
        final_log_call = mock_logger.info.call_args_list[-1]
        assert final_log_call[1]['retrieved'] == 3
        assert final_log_call[1]['acknowledged'] == 2
        assert final_log_call[1]['failed'] == 1


@pytest.fixture(name='invalid_event')
def invalid_event_fixture():
    """Create a MESHInboxMessageInvalid event"""
    event_id = str(uuid4())
    return MESHInboxMessageInvalid(**create_invalid_event_dict(event_id))


@pytest.fixture(name='invalid_sqs_message')
def create_invalid_sqs_message():
    """Create a valid SQS message containing a MESHInboxMessageInvalid record"""
    event_id = str(uuid4())
    return {
        'Records': [
            {
                'messageId': 'sqs-msg-invalid-123',
                'eventSource': 'aws:sqs',
                'body': __import__('json').dumps({
                    'detail': {
                        **create_invalid_event_dict(event_id),
                    }
                }),
            }
        ]
    }


class TestMessageProcessorInvalidEvent:
    """Test suite for MessageProcessor handling of MESHInboxMessageInvalid events"""

    @patch('mesh_acknowledge.message_processor.publish_negative_acknowledged_event')
    @patch('mesh_acknowledge.message_processor.parse_invalid_event')
    def test_process_invalid_event_success(
        self,
        mock_parse_invalid,
        mock_publish_nack,
        message_processor,
        mock_acknowledger,
        mock_sender_lookup,
        mock_event_publisher,
        mock_logger,
        invalid_sqs_message,
        invalid_event: MESHInboxMessageInvalid
    ):
        """Test successful processing of a MESHInboxMessageInvalid SQS record"""
        mesh_mailbox_id = "MAILBOX001"

        mock_parse_invalid.return_value = invalid_event
        mock_sender_lookup.get_mailbox_id.return_value = mesh_mailbox_id
        mock_acknowledger.negative_acknowledge_message.return_value = "NACK123"

        result = message_processor.process_message(invalid_sqs_message)

        assert result == []

        mock_parse_invalid.assert_called_once_with(
            invalid_sqs_message['Records'][0],
            mock_logger
        )
        mock_sender_lookup.get_mailbox_id.assert_called_once_with(
            invalid_event.data.senderId)
        mock_acknowledger.negative_acknowledge_message.assert_called_once_with(
            mailbox_id=mesh_mailbox_id,
            message_id=invalid_event.data.meshMessageId,
            failure_code=invalid_event.data.failureCode,
            sender_id=invalid_event.data.senderId,
            message_reference=invalid_event.data.messageReference
        )
        mock_publish_nack.assert_called_once_with(
            logger=mock_logger,
            event_publisher=mock_event_publisher,
            incoming_event=invalid_event,
            mesh_mailbox_id=mesh_mailbox_id,
            sent_mesh_message_id="NACK123"
        )

    @patch('mesh_acknowledge.message_processor.publish_negative_acknowledged_event')
    @patch('mesh_acknowledge.message_processor.parse_invalid_event')
    def test_process_invalid_event_unknown_sender_returns_failure(
        self,
        mock_parse_invalid,
        mock_publish_nack,
        message_processor,
        mock_sender_lookup,
        mock_acknowledger,
        invalid_sqs_message,
        invalid_event: MESHInboxMessageInvalid
    ):
        """Test that an unknown senderId causes a batch failure for invalid events"""
        mock_parse_invalid.return_value = invalid_event
        mock_sender_lookup.get_mailbox_id.return_value = None

        result = message_processor.process_message(invalid_sqs_message)

        assert len(result) == 1
        assert result[0] == {"itemIdentifier": "sqs-msg-invalid-123"}

        mock_acknowledger.negative_acknowledge_message.assert_not_called()
        mock_publish_nack.assert_not_called()

    @patch('mesh_acknowledge.message_processor.publish_negative_acknowledged_event')
    @patch('mesh_acknowledge.message_processor.parse_invalid_event')
    def test_process_invalid_event_nack_error_returns_failure(
        self,
        mock_parse_invalid,
        mock_publish_nack,
        message_processor,
        mock_sender_lookup,
        mock_acknowledger,
        invalid_sqs_message,
        invalid_event: MESHInboxMessageInvalid
    ):
        """Test that a NACK send failure causes a batch failure"""
        mock_parse_invalid.return_value = invalid_event
        mock_sender_lookup.get_mailbox_id.return_value = "MAILBOX001"
        mock_acknowledger.negative_acknowledge_message.side_effect = RuntimeError("NACK failed")

        result = message_processor.process_message(invalid_sqs_message)

        assert len(result) == 1
        assert result[0] == {"itemIdentifier": "sqs-msg-invalid-123"}

        mock_publish_nack.assert_not_called()

    @patch('mesh_acknowledge.message_processor.publish_negative_acknowledged_event')
    @patch('mesh_acknowledge.message_processor.parse_invalid_event')
    def test_process_invalid_event_publish_error_sends_to_dlq(
        self,
        mock_parse_invalid,
        mock_publish_nack,
        message_processor,
        mock_sender_lookup,
        mock_acknowledger,
        mock_dlq,
        invalid_sqs_message,
        invalid_event: MESHInboxMessageInvalid
    ):
        """
        Test that if publishing the NACK event fails, the record is sent to the DLQ
        """
        mock_parse_invalid.return_value = invalid_event
        mock_sender_lookup.get_mailbox_id.return_value = "MAILBOX001"
        mock_acknowledger.negative_acknowledge_message.return_value = "NACK123"
        mock_publish_nack.side_effect = Exception("Publish failed")

        result = message_processor.process_message(invalid_sqs_message)

        assert result == []
        mock_dlq.send_to_queue.assert_called_once_with(
            record=invalid_sqs_message['Records'][0],
            reason="Failed to publish negative acknowledged event"
        )

    @patch('mesh_acknowledge.message_processor.publish_negative_acknowledged_event')
    @patch('mesh_acknowledge.message_processor.parse_invalid_event')
    def test_process_invalid_event_dlq_error_returns_failure(
        self,
        mock_parse_invalid,
        mock_publish_nack,
        message_processor,
        mock_sender_lookup,
        mock_acknowledger,
        mock_dlq,
        invalid_sqs_message,
        invalid_event: MESHInboxMessageInvalid
    ):
        """Test that if both publish and DLQ fail, the record is returned as a batch failure"""
        mock_parse_invalid.return_value = invalid_event
        mock_sender_lookup.get_mailbox_id.return_value = "MAILBOX001"
        mock_acknowledger.negative_acknowledge_message.return_value = "NACK123"
        mock_publish_nack.side_effect = Exception("Publish failed")
        mock_dlq.send_to_queue.side_effect = Exception("DLQ send failed")

        result = message_processor.process_message(invalid_sqs_message)

        assert len(result) == 1
        assert result[0] == {"itemIdentifier": "sqs-msg-invalid-123"}
