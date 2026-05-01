"""
Tests for Lambda handler in mesh_acknowledge.handler
"""
from unittest.mock import Mock, MagicMock, patch, call

import pytest
from dl_utils import log
from mesh_acknowledge.handler import handler


def setup_mocks(config_cls,
                event_publisher_cls,
                acknowledger_cls,
                message_processor_cls,
                sender_lookup_cls,
                dlq_cls,
                boto3_client_cls):
    """Setup common mocks for handler tests"""
    config = Mock()
    config.event_publisher_event_bus_arn = (
        "arn:aws:eventbridge:eu-west-2:123456789012:event-bus/test"
        )
    config.event_publisher_dlq_url = "https://sqs.eu-west-2.amazonaws.com/123456789012/event-dlq"
    config.dlq_url = "https://sqs.eu-west-2.amazonaws.com/123456789012/dlq"
    config.mesh_client = Mock()

    config_cm = MagicMock()
    config_cm.__enter__.return_value = config
    config_cls.return_value = config_cm

    event_publisher = Mock()
    event_publisher_cls.return_value = event_publisher

    acknowledger = Mock()
    acknowledger_cls.return_value = acknowledger

    processor = Mock()
    message_processor_cls.return_value = processor

    sender_lookup = Mock()
    sender_lookup_cls.return_value = sender_lookup

    dlq = Mock()
    dlq_cls.return_value = dlq

    boto_client = Mock()
    boto3_client_cls.return_value = boto_client

    return (config_cm, config, event_publisher, acknowledger,
            processor, sender_lookup, dlq, boto_client)


class TestHandler:
    """Test suite for Lambda handler"""

    @patch("mesh_acknowledge.handler.client")
    @patch("mesh_acknowledge.handler.Dlq")
    @patch("mesh_acknowledge.handler.SenderLookup")
    @patch("mesh_acknowledge.handler.MessageProcessor")
    @patch("mesh_acknowledge.handler.MeshAcknowledger")
    @patch("mesh_acknowledge.handler.EventPublisher")
    @patch("mesh_acknowledge.handler.Config")
    def test_handler_returns_batch_failures(
        self,
        config_cls,
        event_publisher_cls,
        acknowledger_cls,
        message_processor_cls,
        sender_lookup_cls,
        dlq_cls,
        boto3_client_cls,
    ):
        """Test that handler returns batch item failures from MessageProcessor."""
        (
            _config_cm,
            _config,
            _event_publisher,
            _acknowledger,
            processor,
            _sender_lookup,
            _dlq,
            _boto_client
        ) = setup_mocks(
            config_cls,
            event_publisher_cls,
            acknowledger_cls,
            message_processor_cls,
            sender_lookup_cls,
            dlq_cls,
            boto3_client_cls
        )

        batch_failures = [{"itemIdentifier": "abc"}]
        processor.process_message.return_value = batch_failures

        message = {"Records": []}

        result = handler(message, None)

        assert result == {"batchItemFailures": batch_failures}

        processor.process_message.assert_called_with(message)

    @patch("mesh_acknowledge.handler.client")
    @patch("mesh_acknowledge.handler.Dlq")
    @patch("mesh_acknowledge.handler.SenderLookup")
    @patch("mesh_acknowledge.handler.MessageProcessor")
    @patch("mesh_acknowledge.handler.MeshAcknowledger")
    @patch("mesh_acknowledge.handler.EventPublisher")
    @patch("mesh_acknowledge.handler.Config")
    def test_handler_passes_correct_parameters(
        self,
        config_cls,
        event_publisher_cls,
        acknowledger_cls,
        message_processor_cls,
        sender_lookup_cls,
        dlq_cls,
        boto3_client_cls,
    ):
        """Test that handler passes correct parameters to dependencies."""
        (
            _config_cm,
            config,
            event_publisher,
            acknowledger,
            _processor,
            sender_lookup,
            dlq,
            boto_client
        ) = setup_mocks(
            config_cls,
            event_publisher_cls,
            acknowledger_cls,
            message_processor_cls,
            sender_lookup_cls,
            dlq_cls,
            boto3_client_cls
        )

        handler({"Records": []}, None)

        event_publisher_cls.assert_called_once_with(
            event_bus_arn=config.event_publisher_event_bus_arn,
            dlq_url=config.event_publisher_dlq_url,
            event_metric=config.event_publisher_metric,
            logger=log,
        )
        acknowledger_cls.assert_called_once_with(
            logger=log,
            mesh_client=config.mesh_client,
        )
        sender_lookup_cls.assert_called_once_with(
            ssm=boto_client,
            config=config,
            logger=log,
        )
        dlq_cls.assert_called_once_with(
            sqs_client=boto_client,
            dlq_url=config.dlq_url,
            logger=log,
        )
        message_processor_cls.assert_called_once_with(
            acknowledger=acknowledger,
            event_publisher=event_publisher,
            sender_lookup=sender_lookup,
            dlq=dlq,
            logger=log,
        )
        assert boto3_client_cls.call_count == 2
        boto3_client_cls.assert_has_calls([
            call("ssm"),
            call("sqs"),
        ])

    @patch("mesh_acknowledge.handler.client")
    @patch("mesh_acknowledge.handler.Dlq")
    @patch("mesh_acknowledge.handler.SenderLookup")
    @patch("mesh_acknowledge.handler.MessageProcessor")
    @patch("mesh_acknowledge.handler.MeshAcknowledger")
    @patch("mesh_acknowledge.handler.EventPublisher")
    @patch("mesh_acknowledge.handler.Config")
    def test_handler_reraises_on_processing_error(
        self,
        config_cls,
        event_publisher_cls,
        acknowledger_cls,
        message_processor_cls,
        sender_lookup_cls,
        dlq_cls,
        boto3_client_cls,
    ):
        """Test that handler re-raises exceptions from MessageProcessor."""
        (
            _config_cm,
            _config,
            _event_publisher,
            _acknowledger,
            processor,
            _sender_lookup,
            _dlq,
            _boto_client
        ) = setup_mocks(
            config_cls,
            event_publisher_cls,
            acknowledger_cls,
            message_processor_cls,
            sender_lookup_cls,
            dlq_cls,
            boto3_client_cls
        )

        processor.process_message.side_effect = RuntimeError("boom")

        with pytest.raises(RuntimeError, match="boom"):
            handler({"Records": []}, None)

    @patch("mesh_acknowledge.handler.Config", side_effect=Exception("bad config"))
    def test_handler_reraises_on_config_error(self, _config_cls):
        """Test that handler re-raises exceptions from Config."""
        with pytest.raises(Exception, match="bad config"):
            handler({"Records": []}, None)

    @patch("mesh_acknowledge.handler.client")
    @patch("mesh_acknowledge.handler.Dlq")
    @patch("mesh_acknowledge.handler.SenderLookup")
    @patch("mesh_acknowledge.handler.MessageProcessor")
    @patch("mesh_acknowledge.handler.MeshAcknowledger")
    @patch("mesh_acknowledge.handler.EventPublisher")
    @patch("mesh_acknowledge.handler.Config")
    def test_handler_config_cleanup_on_success(
            self,
            config_cls,
            event_publisher_cls,
            acknowledger_cls,
            message_processor_cls,
            sender_lookup_cls,
            dlq_cls,
            boto3_client_cls):
        """Test that Config context manager is cleaned up on success."""
        setup_mocks(
            config_cls,
            event_publisher_cls,
            acknowledger_cls,
            message_processor_cls,
            sender_lookup_cls,
            dlq_cls,
            boto3_client_cls
        )

        handler({"Records": []}, None)

        config_cls.return_value.__exit__.assert_called_once()

    @patch("mesh_acknowledge.handler.client")
    @patch("mesh_acknowledge.handler.Dlq")
    @patch("mesh_acknowledge.handler.SenderLookup")
    @patch("mesh_acknowledge.handler.MessageProcessor")
    @patch("mesh_acknowledge.handler.MeshAcknowledger")
    @patch("mesh_acknowledge.handler.EventPublisher")
    @patch("mesh_acknowledge.handler.Config")
    def test_handler_config_cleanup_on_error(
            self,
            config_cls,
            event_publisher_cls,
            acknowledger_cls,
            message_processor_cls,
            sender_lookup_cls,
            dlq_cls,
            boto3_client_cls):
        """Test that Config context manager is cleaned up on error."""
        (
            _config_cm,
            _config,
            _event_publisher,
            _acknowledger,
            processor,
            _sender_lookup,
            _dlq,
            _boto_client
        ) = setup_mocks(
            config_cls,
            event_publisher_cls,
            acknowledger_cls,
            message_processor_cls,
            sender_lookup_cls,
            dlq_cls,
            boto3_client_cls
        )

        processor.process_message.side_effect = RuntimeError("boom")

        with pytest.raises(RuntimeError):
            handler({"Records": []}, None)

        config_cls.return_value.__exit__.assert_called_once()
