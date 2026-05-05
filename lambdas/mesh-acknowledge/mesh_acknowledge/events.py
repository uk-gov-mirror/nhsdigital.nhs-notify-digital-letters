"""Event parsing and publishing for MESH acknowledge lambda."""

import json
from datetime import datetime, timezone
from uuid import uuid4
from digital_letters_events import MESHInboxMessageAcknowledged, MESHInboxMessageDownloaded, MESHInboxMessageInvalid
from dl_utils import EventPublisher


def parse_downloaded_event(sqs_record, logger) -> MESHInboxMessageDownloaded:
    """
    Parses and validates a MESHInboxMessageDownloaded event from an SQS record.
    """
    try:
        message_body = json.loads(sqs_record['body'])
        event_detail = message_body.get('detail', {})

        try:
            return MESHInboxMessageDownloaded(**event_detail)

        except Exception as e:
            logger.error(
                "MESHInboxMessageDownloaded validation failed",
                validation_errors=str(e),
                event_detail=event_detail
            )
            raise ValueError(
                "Error processing MESHInboxMessageDownloaded event") from e
    except json.JSONDecodeError as e:
        logger.error(
            "Error parsing SQS record body as JSON",
            body=sqs_record.get('body', ''),
            error=str(e)
        )
        raise ValueError("Error parsing SQS record") from e


def parse_invalid_event(sqs_record, logger) -> MESHInboxMessageInvalid:
    """
    Parses and validates a MESHInboxMessageInvalid event from an SQS record.
    """
    try:
        message_body = json.loads(sqs_record['body'])
        event_detail = message_body.get('detail', {})
        try:
            return MESHInboxMessageInvalid(**event_detail)
        except Exception as e:
            logger.error(
                "MESHInboxMessageInvalid validation failed",
                validation_errors=str(e),
                event_detail=event_detail
            )
            raise ValueError(
                "Error processing MESHInboxMessageInvalid event") from e
    except json.JSONDecodeError as e:
        logger.error(
            "Error parsing SQS record body as JSON",
            body=sqs_record.get('body', ''),
            error=str(e)
        )
        raise ValueError("Error parsing SQS record") from e


def publish_acknowledged_event(
        logger, event_publisher: EventPublisher, incoming_event: MESHInboxMessageDownloaded,
        mesh_mailbox_id: str, sent_mesh_message_id: str):
    """
    Publishes a MESHInboxMessageAcknowledged event.
    """
    now = datetime.now(timezone.utc).isoformat()

    try:
        acknowledged_event = {
            **incoming_event.model_dump(exclude_none=True),
            'id': str(uuid4()),
            'time': now,
            'recordedtime': now,
            'type': 'uk.nhs.notify.digital.letters.mesh.inbox.message.acknowledged.v1',
            'plane': 'data',
            'dataschemaversion': '1.0.0',
            'dataschema': (
                'https://notify.nhs.uk/cloudevents/schemas/digital-letters/2025-10-draft/data/'
                'digital-letters-mesh-inbox-message-acknowledged-data.schema.json'
            ),
            'data': {
                'messageReference': incoming_event.data.messageReference,
                'senderId': incoming_event.data.senderId,
                'meshMailboxId': mesh_mailbox_id,
                'receivedMeshMessageId': incoming_event.data.meshMessageId,
                'sentMeshMessageId': sent_mesh_message_id,
                'statusCode': 202,
            }
        }

        failed = event_publisher.send_events([acknowledged_event], MESHInboxMessageAcknowledged)

        if failed:
            msg = f"Failed to publish MESHInboxMessageAcknowledged event: {failed}"
            logger.error(msg, failed_count=len(failed))
            raise RuntimeError(msg)

        logger.info(
            "Published MESHInboxMessageAcknowledged event",
            sender_id=incoming_event.data.senderId,
            mesh_mailbox_id=mesh_mailbox_id,
            message_reference=incoming_event.data.messageReference
        )
    except Exception as e:
        logger.error(
            "Failed to publish MESHInboxMessageAcknowledged event", error=str(e))
        raise


def publish_negative_acknowledged_event(
        logger, event_publisher: EventPublisher, incoming_event: MESHInboxMessageInvalid,
        mesh_mailbox_id: str, sent_mesh_message_id: str):
    """
    Publishes a MESHInboxMessageAcknowledged event for a negative acknowledgement,
    with statusCode 400 and the failureCode from the invalid event.
    """
    now = datetime.now(timezone.utc).isoformat()

    try:
        nack_event = {
            **incoming_event.model_dump(exclude_none=True),
            'id': str(uuid4()),
            'time': now,
            'recordedtime': now,
            'type': 'uk.nhs.notify.digital.letters.mesh.inbox.message.acknowledged.v1',
            'dataschema': (
                'https://notify.nhs.uk/cloudevents/schemas/digital-letters/2025-10-draft/data/'
                'digital-letters-mesh-inbox-message-acknowledged-data.schema.json'
            ),
            'data': {
                'senderId': incoming_event.data.senderId,
                'meshMailboxId': mesh_mailbox_id,
                'receivedMeshMessageId': incoming_event.data.meshMessageId,
                'sentMeshMessageId': sent_mesh_message_id,
                'statusCode': 400,
                'failureCode': incoming_event.data.failureCode,
                **(
                    {'messageReference': incoming_event.data.messageReference}
                    if incoming_event.data.messageReference is not None
                    else {}
                ),
            }
        }

        failed = event_publisher.send_events([nack_event], MESHInboxMessageAcknowledged)

        if failed:
            msg = f"Failed to publish MESHInboxMessageAcknowledged (negative acknowledgement) event: {failed}"
            logger.error(msg, failed_count=len(failed))
            raise RuntimeError(msg)

        logger.info(
            "Published MESHInboxMessageAcknowledged (negative acknowledgement) event",
            sender_id=incoming_event.data.senderId,
            mesh_mailbox_id=mesh_mailbox_id,
            failure_code=incoming_event.data.failureCode,
            message_reference=incoming_event.data.messageReference
        )
    except Exception as e:
        logger.error(
            "Failed to publish MESHInboxMessageAcknowledged (NACK) event", error=str(e))
        raise
