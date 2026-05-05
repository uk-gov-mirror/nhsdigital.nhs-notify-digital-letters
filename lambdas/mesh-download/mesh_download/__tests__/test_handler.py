"""
Tests for Lambda handler
"""
import pytest
from unittest.mock import Mock, patch, MagicMock


def setup_mocks():
    """
    Create all mock objects needed for handler testing
    """
    mock_context = Mock()

    mock_config = MagicMock()
    mock_config.mesh_client = Mock()

    mock_processor = Mock()
    mock_processor.process_sqs_message = Mock(return_value='downloaded')

    return (
        mock_context,
        mock_config,
        mock_processor
    )


def create_sqs_event(num_records=1, event_source='aws:sqs'):
    """
    Create a mock SQS event for testing
    """
    records = []
    for i in range(num_records):
        records.append({
            'messageId': f'msg-{i}',
            'eventSource': event_source,
            'body': '{"detail": {"data": {"meshMessageId": "test_id"}}}'
        })

    return {'Records': records}


class TestHandler:
    """Test suite for Lambda handler"""

    @patch('mesh_download.handler.EventPublisher')
    @patch('mesh_download.handler.DocumentStore')
    @patch('mesh_download.handler.Config')
    @patch('mesh_download.handler.MeshDownloadProcessor')
    def test_handler_success_single_message(self, mock_processor_class, mock_config_class, mock_doc_store_class, mock_event_pub_class):
        """Test successful handler execution with single SQS message"""
        from mesh_download.handler import handler

        (mock_context, mock_config, mock_processor) = setup_mocks()

        mock_config_class.return_value.__enter__.return_value = mock_config
        mock_config_class.return_value.__exit__ = Mock(return_value=None)
        mock_processor_class.return_value = mock_processor

        mock_doc_store = Mock()
        mock_doc_store_class.return_value = mock_doc_store
        mock_event_pub = Mock()
        mock_event_pub_class.return_value = mock_event_pub

        event = create_sqs_event(num_records=1)

        result = handler(event, mock_context)

        mock_config_class.assert_called_once()
        mock_config_class.return_value.__enter__.assert_called_once()

        # Verify MeshDownloadProcessor was created with correct parameters
        mock_processor_class.assert_called_once()
        call_kwargs = mock_processor_class.call_args[1]
        assert call_kwargs['config'] == mock_config
        assert call_kwargs['log'] is not None

        mock_processor.process_sqs_message.assert_called_once()

        assert result == {"batchItemFailures": []}

    @patch('mesh_download.handler.EventPublisher')
    @patch('mesh_download.handler.DocumentStore')
    @patch('mesh_download.handler.Config')
    @patch('mesh_download.handler.MeshDownloadProcessor')
    def test_handler_success_multiple_messages(self, mock_processor_class, mock_config_class, mock_doc_store_class, mock_event_pub_class):
        """Test successful handler execution with multiple SQS messages"""
        from mesh_download.handler import handler

        (mock_context, mock_config, mock_processor) = setup_mocks()

        mock_config_class.return_value.__enter__.return_value = mock_config
        mock_config_class.return_value.__exit__ = Mock(return_value=None)
        mock_processor_class.return_value = mock_processor

        mock_doc_store_class.return_value = Mock()
        mock_event_pub_class.return_value = Mock()

        event = create_sqs_event(num_records=3)

        result = handler(event, mock_context)

        # Verify process_sqs_message was called 3 times
        assert mock_processor.process_sqs_message.call_count == 3

        # Verify return value (no failures)
        assert result == {"batchItemFailures": []}

    @patch('mesh_download.handler.EventPublisher')
    @patch('mesh_download.handler.DocumentStore')
    @patch('mesh_download.handler.Config')
    @patch('mesh_download.handler.MeshDownloadProcessor')
    def test_handler_config_cleanup_on_success(self, mock_processor_class, mock_config_class, mock_doc_store_class, mock_event_pub_class):
        """Test that Config context manager cleanup is called on success"""
        from mesh_download.handler import handler

        (mock_context, mock_config, mock_processor) = setup_mocks()

        mock_config_class.return_value.__enter__.return_value = mock_config
        mock_exit = Mock(return_value=None)
        mock_config_class.return_value.__exit__ = mock_exit
        mock_processor_class.return_value = mock_processor

        mock_doc_store_class.return_value = Mock()
        mock_event_pub_class.return_value = Mock()

        event = create_sqs_event(num_records=1)

        handler(event, mock_context)

        mock_exit.assert_called_once()
        assert mock_exit.call_args[0] == (None, None, None)

    @patch('mesh_download.handler.EventPublisher')
    @patch('mesh_download.handler.DocumentStore')
    @patch('mesh_download.handler.Config')
    @patch('mesh_download.handler.MeshDownloadProcessor')
    def test_handler_partial_batch_failure(self, mock_processor_class, mock_config_class, mock_doc_store_class, mock_event_pub_class):
        """Test handler handles partial batch failures correctly"""
        from mesh_download.handler import handler

        (mock_context, mock_config, mock_processor) = setup_mocks()

        mock_config_class.return_value.__enter__.return_value = mock_config
        mock_config_class.return_value.__exit__ = Mock(return_value=None)
        mock_processor_class.return_value = mock_processor

        mock_doc_store_class.return_value = Mock()
        mock_event_pub_class.return_value = Mock()

        # Make second message fail
        mock_processor.process_sqs_message.side_effect = [
            'downloaded',
            Exception("Test error"),
            'downloaded'
        ]

        event = create_sqs_event(num_records=3)

        result = handler(event, mock_context)

        # Verify only the failed message is in batch item failures
        assert len(result["batchItemFailures"]) == 1
        assert result["batchItemFailures"][0]["itemIdentifier"] == "msg-1"

    @patch('mesh_download.handler.EventPublisher')
    @patch('mesh_download.handler.DocumentStore')
    @patch('mesh_download.handler.Config')
    @patch('mesh_download.handler.MeshDownloadProcessor')
    def test_handler_skips_non_sqs_records(self, mock_processor_class, mock_config_class, mock_doc_store_class, mock_event_pub_class):
        """Test handler skips records that are not from SQS"""
        from mesh_download.handler import handler

        (mock_context, mock_config, mock_processor) = setup_mocks()

        mock_config_class.return_value.__enter__.return_value = mock_config
        mock_config_class.return_value.__exit__ = Mock(return_value=None)
        mock_processor_class.return_value = mock_processor

        mock_doc_store_class.return_value = Mock()
        mock_event_pub_class.return_value = Mock()

        event = create_sqs_event(num_records=1, event_source='aws:dynamodb')

        result = handler(event, mock_context)

        mock_processor.process_sqs_message.assert_not_called()

        assert result == {"batchItemFailures": []}

    @patch('mesh_download.handler.EventPublisher')
    @patch('mesh_download.handler.DocumentStore')
    @patch('mesh_download.handler.Config')
    @patch('mesh_download.handler.MeshDownloadProcessor')
    def test_handler_config_cleanup_on_exception(self, mock_processor_class, mock_config_class, mock_doc_store_class, mock_event_pub_class):
        """Test that Config context manager cleanup is called even on exception"""
        from mesh_download.handler import handler

        (mock_context, mock_config, mock_processor) = setup_mocks()

        mock_config_class.return_value.__enter__.return_value = mock_config
        mock_exit = Mock(return_value=None)
        mock_config_class.return_value.__exit__ = mock_exit

        mock_doc_store_class.return_value = Mock()
        mock_event_pub_class.return_value = Mock()

        test_exception = RuntimeError("Processing error")
        mock_processor.process_sqs_message.side_effect = test_exception
        mock_processor_class.return_value = mock_processor

        event = create_sqs_event(num_records=1)

        result = handler(event, mock_context)

        mock_exit.assert_called_once()

        # Verify the failed message is in batch failures
        assert len(result["batchItemFailures"]) == 1

    @patch('mesh_download.handler.EventPublisher')
    @patch('mesh_download.handler.DocumentStore')
    @patch('mesh_download.handler.Config')
    @patch('mesh_download.handler.MeshDownloadProcessor')
    def test_handler_returns_empty_failures_on_empty_event(self, mock_processor_class, mock_config_class, mock_doc_store_class, mock_event_pub_class):
        """Test handler handles empty event gracefully"""
        from mesh_download.handler import handler

        (mock_context, mock_config, mock_processor) = setup_mocks()

        mock_config_class.return_value.__enter__.return_value = mock_config
        mock_config_class.return_value.__exit__ = Mock(return_value=None)
        mock_processor_class.return_value = mock_processor

        mock_doc_store_class.return_value = Mock()
        mock_event_pub_class.return_value = Mock()

        event = {'Records': []}

        result = handler(event, mock_context)

        mock_processor.process_sqs_message.assert_not_called()

        assert result == {"batchItemFailures": []}

    @patch('mesh_download.handler.EventPublisher')
    @patch('mesh_download.handler.DocumentStore')
    @patch('mesh_download.handler.Config')
    @patch('mesh_download.handler.MeshDownloadProcessor')
    def test_handler_passes_correct_parameters_to_processor(self, mock_processor_class, mock_config_class, mock_doc_store_class, mock_event_pub_class):
        """Test that handler passes all required parameters to MeshDownloadProcessor"""
        from mesh_download.handler import handler

        (mock_context, mock_config, mock_processor) = setup_mocks()

        mock_mesh_client = Mock()
        mock_download_metric = Mock()
        mock_config.mesh_client = mock_mesh_client
        mock_config.download_metric = mock_download_metric

        mock_config_class.return_value.__enter__.return_value = mock_config
        mock_config_class.return_value.__exit__ = Mock(return_value=None)
        mock_processor_class.return_value = mock_processor

        mock_doc_store = Mock()
        mock_doc_store_class.return_value = mock_doc_store
        mock_event_pub = Mock()
        mock_event_pub_class.return_value = mock_event_pub

        event = create_sqs_event(num_records=1)

        handler(event, mock_context)

        mock_processor_class.assert_called_once()
        call_kwargs = mock_processor_class.call_args[1]

        # Handler now passes the entire config object and dependencies
        assert call_kwargs['config'] == mock_config
        assert call_kwargs['mesh_client'] == mock_mesh_client
        assert call_kwargs['download_metric'] == mock_download_metric
        assert call_kwargs['document_store'] == mock_doc_store
        assert call_kwargs['event_publisher'] == mock_event_pub
        assert 'log' in call_kwargs
