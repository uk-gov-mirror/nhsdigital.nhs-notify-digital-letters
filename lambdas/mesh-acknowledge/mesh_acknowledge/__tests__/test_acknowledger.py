"""
Tests for MeshAcknowledger class
"""
import json
from unittest.mock import Mock
import pytest
from mesh_acknowledge.acknowledger import (
    MeshAcknowledger,
    NOTIFY_ACK_WORKFLOW_ID,
    ACK_SUBJECT,
    NACK_SUBJECT,
)

SENT_MESH_MESSAGE_ID = "MSG123456"


@pytest.fixture(name='mock_mesh_client')
def create_mock_mesh_client():
    """Create a mock MeshClient for testing"""
    client = Mock()
    client.handshake = Mock()
    client.send_message = Mock(return_value=SENT_MESH_MESSAGE_ID)
    return client


@pytest.fixture(name='mock_logger')
def create_mock_logger():
    """Create a mock logger for testing"""
    logger = Mock()
    logger.debug = Mock()
    return logger


@pytest.fixture(name='acknowledger')
def create_acknowledger(mock_mesh_client, mock_logger):
    """Create a MeshAcknowledger instance with mocked dependencies"""
    return MeshAcknowledger(mock_mesh_client, mock_logger)


class TestMeshAcknowledger:
    """Test suite for MeshAcknowledger class"""

    def test_init_performs_handshake(self, mock_mesh_client, mock_logger):
        """Test that __init__ performs a MESH handshake"""
        MeshAcknowledger(mock_mesh_client, mock_logger)

        mock_mesh_client.handshake.assert_called_once()

    def test_acknowledge_message_sends_correct_message(
        self, acknowledger, mock_mesh_client
    ):
        """Test that acknowledge_message sends the correct message via MESH"""
        mailbox_id = "MAILBOX001"
        message_id = "MSG123456"
        message_reference = "REF789"
        sender_id = "SENDER001"

        expected_body = json.dumps({
            "meshMessageId": message_id,
            "requestId": f"{sender_id}_{message_reference}"
        }).encode()

        acknowledger.acknowledge_message(
            mailbox_id, message_id, message_reference, sender_id
        )

        mock_mesh_client.send_message.assert_called_once_with(
            mailbox_id,
            expected_body,
            workflow_id=NOTIFY_ACK_WORKFLOW_ID,
            local_id=message_reference,
            subject=ACK_SUBJECT
        )

    def test_acknowledge_message_raises_error_if_mesh_send_fails(
        self, acknowledger, mock_mesh_client
    ):
        """Test that the MeshAcknowledger raises an error if MESH send_message fails"""
        mailbox_id = "MAILBOX001"
        message_id = "MSG123"
        message_reference = "REF123"
        sender_id = "SENDER001"
        expected_exception_message = "MESH send failed"

        mock_mesh_client.send_message.side_effect = Exception(
            expected_exception_message)

        with pytest.raises(Exception, match=expected_exception_message):
            acknowledger.acknowledge_message(
                mailbox_id, message_id, message_reference, sender_id
            )


class TestMeshAcknowledgerNack:
    """Test suite for MeshAcknowledger.negative_acknowledge_message"""

    def test_negative_acknowledge_message_sends_correct_message_with_reference(
        self, acknowledger, mock_mesh_client
    ):
        """Test that negative_acknowledge_message sends the correct NACK with messageReference"""
        mailbox_id = "MAILBOX001"
        message_id = "MSG123456"
        failure_code = "DL_CLIV_004"
        sender_id = "SENDER001"
        message_reference = "REF789"

        expected_body = json.dumps({
            "meshMessageId": message_id,
            "failureCode": failure_code,
            "requestId": f"{sender_id}_{message_reference}",
            "message": "Duplicate request",
        }).encode()

        acknowledger.negative_acknowledge_message(
            mailbox_id, message_id, failure_code, sender_id, message_reference
        )

        mock_mesh_client.send_message.assert_called_once_with(
            mailbox_id,
            expected_body,
            workflow_id=NOTIFY_ACK_WORKFLOW_ID,
            local_id=message_reference,
            subject=NACK_SUBJECT
        )

    def test_negative_acknowledge_message_sends_correct_message_without_reference(
        self, acknowledger, mock_mesh_client
    ):
        """Test that negative_acknowledge_message sends the correct NACK without messageReference"""
        mailbox_id = "MAILBOX001"
        message_id = "MSG123456"
        failure_code = "DL_CLIV_005"
        sender_id = "SENDER001"

        expected_body = json.dumps({
            "meshMessageId": message_id,
            "failureCode": failure_code,
            "requestId": f"{sender_id}_",
            "message": "Invalid FHIR resource",
        }).encode()

        acknowledger.negative_acknowledge_message(
            mailbox_id, message_id, failure_code, sender_id
        )

        mock_mesh_client.send_message.assert_called_once_with(
            mailbox_id,
            expected_body,
            workflow_id=NOTIFY_ACK_WORKFLOW_ID,
            subject=NACK_SUBJECT
        )

    def test_negative_acknowledge_message_unknown_failure_code_omits_description(
        self, acknowledger, mock_mesh_client
    ):
        """Test that an unknown failure code omits message from the body"""
        acknowledger.negative_acknowledge_message(
            "MAILBOX001", "MSG123456", "UNKNOWN_CODE", "SENDER001"
        )

        call_body = json.loads(mock_mesh_client.send_message.call_args[0][1].decode())
        assert "message" not in call_body
