"""
Tests for mesh-poll MeshMessageProcessor
Following the pattern from backend comms-mgr mesh-poll tests
"""
from unittest.mock import Mock, patch

from mesh_client import MeshClient
from mesh_poll.processor import MeshMessageProcessor


def setup_mocks():
    """
    Create all mock objects needed for processor testing
    """
    config = Mock()
    config.lambda_timeout_buffer_milliseconds = "500"
    config.ssm_prefix = "/dl/test"
    config.environment = "development"

    sender_lookup = Mock()
    sender_lookup.is_valid_sender.return_value = True  # Default to valid sender
    sender_lookup.get_sender_id.return_value = "test-sender-id"

    mesh_client = Mock(spec=MeshClient)

    log = Mock()

    polling_metric = Mock()

    return (
        config,
        sender_lookup,
        mesh_client,
        log,
        polling_metric
    )


def setup_message_data(test_id="0"):
    """
    Create test message data
    """
    from mesh_client import Message

    message = Mock(spec=Message)
    message.sender = f"TEST_SENDER_{test_id}"
    message.subject = f"test_subject_{test_id}"
    message.local_id = f"test_local_id_{test_id}"
    message.workflow_id = "NHS_NOTIFY_SEND_REQUEST"
    message.message_type = "DATA"
    message.id.return_value = f"test_message_id_{test_id}"
    message.read.return_value = b"test_message_%s_contents" % test_id.encode()

    return message


def get_remaining_time_in_millis():
    return 1000


def get_remaining_time_in_millis_near_timeout():
    return 100


@patch('mesh_poll.processor.EventPublisher')
class TestMeshMessageProcessor:
    """Test suite for MeshMessageProcessor"""

    def test_process_messages_iterates_through_inbox(self, mock_event_publisher_class):
        """Test that processor iterates through all messages in MESH inbox"""
        (config, sender_lookup, mesh_client, log, polling_metric) = setup_mocks()
        message1 = setup_message_data("1")
        message2 = setup_message_data("2")

        processor = MeshMessageProcessor(
            config=config,
            sender_lookup=sender_lookup,
            mesh_client=mesh_client,
            get_remaining_time_in_millis=get_remaining_time_in_millis,
            log=log,
            polling_metric=polling_metric
        )

        mesh_client.iterate_all_messages.return_value = [message1, message2]
        sender_lookup.is_valid_sender.return_value = True

        processor.process_messages()

        mesh_client.handshake.assert_called_once()
        assert mesh_client.iterate_all_messages.call_count == 1
        assert sender_lookup.is_valid_sender.call_count == 2  # Both messages validated
        polling_metric.record.assert_called_once()

    def test_process_messages_stops_near_timeout(self, mock_event_publisher_class):
        """Test that processor stops processing when near timeout"""
        (config, sender_lookup, mesh_client, log, polling_metric) = setup_mocks()
        message1 = setup_message_data("1")

        mock_event_publisher = Mock()
        mock_event_publisher_class.return_value = mock_event_publisher

        processor = MeshMessageProcessor(
            config=config,
            sender_lookup=sender_lookup,
            mesh_client=mesh_client,
            get_remaining_time_in_millis=get_remaining_time_in_millis_near_timeout,
            log=log,
            polling_metric=polling_metric
        )

        mesh_client.iterate_all_messages.return_value = [message1]

        processor.process_messages()

        sender_lookup.is_valid_sender.assert_not_called()
        mock_event_publisher.send_events.assert_not_called()  # No events published when timeout
        polling_metric.record.assert_called_once()

    def test_process_message_with_valid_sender(self, mock_event_publisher_class):
        """Test processing a single message from valid sender"""
        (config, sender_lookup, mesh_client, log, polling_metric) = setup_mocks()
        message = setup_message_data("1")

        mock_event_publisher = Mock()
        mock_event_publisher.send_events.return_value = []  # No failed events
        mock_event_publisher_class.return_value = mock_event_publisher

        processor = MeshMessageProcessor(
            config=config,
            sender_lookup=sender_lookup,
            mesh_client=mesh_client,
            get_remaining_time_in_millis=get_remaining_time_in_millis,
            log=log,
            polling_metric=polling_metric
        )

        sender_lookup.is_valid_sender.return_value = True

        processor.process_message(message)

        mesh_client.handshake.assert_called_once()
        sender_lookup.is_valid_sender.assert_called_once_with(message.sender)
        mock_event_publisher.send_events.assert_called_once()
        message.acknowledge.assert_not_called()  # Only acknowledged on auth error

    def test_process_message_with_unknown_sender(self, mock_event_publisher_class):
        """Test that messages from unknown senders are rejected silently"""
        (config, sender_lookup, mesh_client, log, polling_metric) = setup_mocks()
        message = setup_message_data("1")

        mock_event_publisher = Mock()
        mock_event_publisher_class.return_value = mock_event_publisher

        # Invalid sender
        sender_lookup.is_valid_sender.return_value = False

        processor = MeshMessageProcessor(
            config=config,
            sender_lookup=sender_lookup,
            mesh_client=mesh_client,
            get_remaining_time_in_millis=get_remaining_time_in_millis,
            log=log,
            polling_metric=polling_metric
        )

        processor.process_message(message)

        sender_lookup.is_valid_sender.assert_called_once_with(message.sender)
        message.acknowledge.assert_called_once()
        mock_event_publisher.send_events.assert_not_called()

    def test_process_message_logs_error_on_event_publish_failure(self, mock_event_publisher_class):
        """
        Test that processor logs error when event publishing fails
        and does not acknowledge message
        """
        (config, sender_lookup, mesh_client, log, polling_metric) = setup_mocks()
        message = setup_message_data("1")

        mock_event_publisher = Mock()
        mock_event_publisher.send_events.return_value = [{"id": "failed-event-1"}]
        mock_event_publisher_class.return_value = mock_event_publisher

        sender_lookup.is_valid_sender.return_value = True
        sender_lookup.get_sender_id.return_value = "test_sender_id"

        processor = MeshMessageProcessor(
            config=config,
            sender_lookup=sender_lookup,
            mesh_client=mesh_client,
            get_remaining_time_in_millis=get_remaining_time_in_millis,
            log=log,
            polling_metric=polling_metric
        )

        processor.process_message(message)

        mock_event_publisher.send_events.assert_called_once()
        message.acknowledge.assert_not_called()
        # Verify error was logged
        log.error.assert_called()

    def test_all_messages_are_processed_in_a_single_iteration(self, mock_event_publisher_class):
        """Test that processor processes all messages in a single iteration"""
        (config, sender_lookup, mesh_client, log, polling_metric) = setup_mocks()
        message1 = setup_message_data("1")
        message2 = setup_message_data("2")
        message3 = setup_message_data("3")

        mock_event_publisher = Mock()
        mock_event_publisher.send_events.return_value = []  # No failed events
        mock_event_publisher_class.return_value = mock_event_publisher

        processor = MeshMessageProcessor(
            config=config,
            sender_lookup=sender_lookup,
            mesh_client=mesh_client,
            get_remaining_time_in_millis=get_remaining_time_in_millis,
            log=log,
            polling_metric=polling_metric
        )

        mesh_client.iterate_all_messages.return_value = [message1, message2, message3]
        sender_lookup.is_valid_sender.return_value = True

        processor.process_messages()

        mesh_client.handshake.assert_called_once()
        assert mesh_client.iterate_all_messages.call_count == 1
        assert sender_lookup.is_valid_sender.call_count == 3
        assert mock_event_publisher.send_events.call_count == 3
        polling_metric.record.assert_called_once()

    def test_process_message_rejects_missing_local_id(self, mock_event_publisher_class):
        """Test that processor publishes MESHInboxMessageInvalid event for missing local_id"""
        (config, sender_lookup, mesh_client, log, polling_metric) = setup_mocks()
        message = setup_message_data("1")
        message.local_id = None

        mock_event_publisher = Mock()
        mock_event_publisher.send_events.return_value = []
        mock_event_publisher_class.return_value = mock_event_publisher

        sender_lookup.is_valid_sender.return_value = True
        sender_lookup.get_sender_id.return_value = "test-sender-id"

        processor = MeshMessageProcessor(
            config=config,
            sender_lookup=sender_lookup,
            mesh_client=mesh_client,
            get_remaining_time_in_millis=get_remaining_time_in_millis,
            log=log,
            polling_metric=polling_metric
        )

        processor.process_message(message)

        message.acknowledge.assert_called_once()
        mock_event_publisher.send_events.assert_called_once()

    def test_process_message_rejects_empty_local_id(self, mock_event_publisher_class):
        """Test that processor publishes MESHInboxMessageInvalid event for empty local_id"""
        (config, sender_lookup, mesh_client, log, polling_metric) = setup_mocks()
        message = setup_message_data("1")
        message.local_id = ""

        mock_event_publisher = Mock()
        mock_event_publisher.send_events.return_value = []  # Success
        mock_event_publisher_class.return_value = mock_event_publisher

        sender_lookup.is_valid_sender.return_value = True
        sender_lookup.get_sender_id.return_value = "test-sender-id"

        processor = MeshMessageProcessor(
            config=config,
            sender_lookup=sender_lookup,
            mesh_client=mesh_client,
            get_remaining_time_in_millis=get_remaining_time_in_millis,
            log=log,
            polling_metric=polling_metric
        )

        processor.process_message(message)

        message.acknowledge.assert_called_once()
        mock_event_publisher.send_events.assert_called_once()

    def test_process_message_rejects_whitespace_only_local_id(self, mock_event_publisher_class):
        """
        Test that processor publishes MESHInboxMessageInvalid event
        for whitespace-only local_id
        """
        (config, sender_lookup, mesh_client, log, polling_metric) = setup_mocks()
        message = setup_message_data("1")
        message.local_id = "   "

        mock_event_publisher = Mock()
        mock_event_publisher.send_events.return_value = []  # Success
        mock_event_publisher_class.return_value = mock_event_publisher

        sender_lookup.is_valid_sender.return_value = True
        sender_lookup.get_sender_id.return_value = "test-sender-id"

        processor = MeshMessageProcessor(
            config=config,
            sender_lookup=sender_lookup,
            mesh_client=mesh_client,
            get_remaining_time_in_millis=get_remaining_time_in_millis,
            log=log,
            polling_metric=polling_metric
        )

        processor.process_message(message)

        message.acknowledge.assert_called_once()
        mock_event_publisher.send_events.assert_called_once()
