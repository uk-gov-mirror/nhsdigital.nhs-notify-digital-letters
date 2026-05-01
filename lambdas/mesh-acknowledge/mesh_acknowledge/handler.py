"""lambda handler for Mesh Acknowledge application"""

from typing import Dict, Any

from boto3 import client
from dl_utils import log, EventPublisher, SenderLookup
from .acknowledger import MeshAcknowledger
from .config import Config
from .dlq import Dlq
from .message_processor import MessageProcessor


def handler(message: Dict[str, Any], _context: Any):
    """
    Lambda handler for Mesh Acknowledge application.

    Processes events from SQS queue.
    Returns batch item failures for partial batch failure handling.
    """

    try:
        with Config() as config:
            event_publisher = EventPublisher(
                event_bus_arn=config.event_publisher_event_bus_arn,
                dlq_url=config.event_publisher_dlq_url,
                event_metric=config.event_publisher_metric,
                logger=log
            )
            acknowledger = MeshAcknowledger(
                logger=log, mesh_client=config.mesh_client)
            sender_lookup = SenderLookup(
                ssm=client('ssm'),
                config=config,
                logger=log
            )
            dlq = Dlq(
                sqs_client=client('sqs'),
                dlq_url=config.dlq_url,
                logger=log
            )
            message_processor = MessageProcessor(
                acknowledger=acknowledger,
                event_publisher=event_publisher,
                sender_lookup=sender_lookup,
                dlq=dlq,
                logger=log
            )

            batch_item_failures = message_processor.process_message(message)

            return {"batchItemFailures": batch_item_failures}

    except Exception as exc:
        log.error("Error in MESH Acknowledge handler", error=str(exc))
        raise
