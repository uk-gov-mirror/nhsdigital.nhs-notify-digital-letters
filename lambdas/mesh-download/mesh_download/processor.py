import json
from datetime import datetime, timezone
from uuid import uuid4

from pydantic import ValidationError
from digital_letters_events import MESHInboxMessageDownloaded, MESHInboxMessageReceived, MESHInboxMessageInvalid
from mesh_download.errors import MeshMessageNotFound
from mesh_download.document_store import DocumentAlreadyExistsError, DocumentAlreadyExistsInternalRetryError
from nhs_notify_letters_onboarding import validate


class MeshDownloadProcessor:
    def __init__(self, **kwargs):
        self.__config = kwargs['config']
        self.__log = kwargs['log']
        self.__mesh_client = kwargs['mesh_client']
        self.__download_metric = kwargs['download_metric']
        self.__internal_duplicate_download_metric = kwargs['internal_duplicate_download_metric']
        self.__trust_duplicate_download_metric = kwargs['trust_duplicate_download_metric']
        self.__document_store = kwargs['document_store']
        self.__event_publisher = kwargs['event_publisher']

        self.__mesh_client.handshake()

        self.__storage_bucket = self.__config.transactional_data_bucket

    def process_sqs_message(self, sqs_record):
        try:
            validated_event = self._parse_and_validate_event(sqs_record)
            logger = self.__log.bind(mesh_message_id=validated_event.data.meshMessageId)

            logger.info("Processing MESH download request")
            return self._handle_download(validated_event, logger)

        except Exception as exc:
            self.__log.error(
                "Error processing SQS message",
                error=str(exc),
                sqs_record=sqs_record
            )
            raise

    def _parse_and_validate_event(self, sqs_record):
        message_body = json.loads(sqs_record['body'])
        event_detail = message_body.get('detail', {})

        try:
            event = MESHInboxMessageReceived(**event_detail)
            self.__log.debug("CloudEvent validation passed")
            return event
        except ValidationError as e:
            self.__log.error(
                "CloudEvent validation failed",
                validation_errors=str(e),
                event_detail=event_detail
            )
            raise

    def _validate_fhir_content(self, content):
        json_content = json.loads(content)
        validate(json_content)

    def _handle_download(self, event, logger):
        data = event.data

        message = self.__mesh_client.retrieve_message(data.meshMessageId)
        if not message:
            logger.error("Message not found in MESH inbox")
            raise MeshMessageNotFound(f"MESH message with ID {data.meshMessageId} not found")

        logger.info(
            "Retrieved MESH message",
            sender=getattr(message, 'sender', ''),
            local_id=getattr(message, 'local_id', ''),
            workflow_id=getattr(message, 'workflow_id', ''),
            subject=getattr(message, 'subject', ''),
            message_type=getattr(message, 'message_type', '')
        )

        content = message.read()
        logger.info("Downloaded MESH message content")

        try:
            self._validate_fhir_content(content)
        except Exception as e:
            logger.error("FHIR content is invalid", error=str(e))
            self._publish_message_invalid_event(incoming_event=event, failure_code='DL_CLIV_005')
            message.acknowledge()
            logger.info("Acknowledged message")
            return

        try:
            uri = self._store_message_content(
                sender_id=data.senderId,
                message_reference=data.messageReference,
                mesh_message_id=data.meshMessageId,
                message_content=content,
                logger=logger
            )
        except DocumentAlreadyExistsInternalRetryError:
            logger.warning(
                "Internal retry detected. Message already stored with same meshMessageId, skipping",
                mesh_message_id=data.meshMessageId,
                message_reference=data.messageReference
            )
            self.__internal_duplicate_download_metric.record(1)
            message.acknowledge()
            logger.info("Acknowledged message")
            return 'skipped'
        except DocumentAlreadyExistsError:
            logger.warning(
                "Trust duplicate detected. Same senderId + messageReference but different meshMessageId",
                mesh_message_id=data.meshMessageId,
                message_reference=data.messageReference
            )
            self.__trust_duplicate_download_metric.record(1)
            self._publish_message_invalid_event(incoming_event=event, failure_code='DL_CLIV_004')
            message.acknowledge()
            logger.info("Acknowledged message")
            return 'duplicate'

        self._publish_downloaded_event(
            incoming_event=event,
            message_uri=uri
        )
        self.__download_metric.record(1)
        message.acknowledge()
        logger.info("Acknowledged message")
        return 'downloaded'

    def _store_message_content(self, sender_id, message_reference, mesh_message_id, message_content, logger):
        s3_key = self.__document_store.store_document(
            sender_id=sender_id,
            message_reference=message_reference,
            mesh_message_id=mesh_message_id,
            content=message_content,
        )

        message_uri = f"s3://{self.__storage_bucket}/{s3_key}"
        logger.info("Stored MESH message in S3",
                    s3_bucket=self.__storage_bucket,
                    s3_key=s3_key)

        return message_uri

    def _publish_downloaded_event(self, incoming_event, message_uri):
        """
        Publishes a MESHInboxMessageDownloaded event.
        """
        now = datetime.now(timezone.utc).isoformat()

        cloud_event = {
            **incoming_event.model_dump(exclude_none=True),
            'id': str(uuid4()),
            'time': now,
            'recordedtime': now,
            'type': 'uk.nhs.notify.digital.letters.mesh.inbox.message.downloaded.v1',
            'plane': 'data',
            'dataschemaversion': '1.0.0',
            'dataschema': (
                'https://notify.nhs.uk/cloudevents/schemas/digital-letters/2025-10-draft/data/'
                'digital-letters-mesh-inbox-message-downloaded-data.schema.json'
            ),
            'data': {
                'senderId': incoming_event.data.senderId,
                'messageReference': incoming_event.data.messageReference,
                'messageUri': message_uri,
                'meshMessageId': incoming_event.data.meshMessageId
            }
        }

        failed = self.__event_publisher.send_events([cloud_event], MESHInboxMessageDownloaded)
        if failed:
            msg = f"Failed to publish MESHInboxMessageDownloaded event: {failed}"
            self.__log.error(msg, failed_count=len(failed))
            raise RuntimeError(msg)

        self.__log.info(
            "Published MESHInboxMessageDownloaded event",
            sender_id=incoming_event.data.senderId,
            message_uri=message_uri,
            message_reference=incoming_event.data.messageReference
        )

    def _publish_message_invalid_event(self, incoming_event, failure_code: str):
        """
        Publishes a MESHInboxMessageInvalid event.
        """
        now = datetime.now(timezone.utc).isoformat()

        cloud_event = {
            **incoming_event.model_dump(exclude_none=True),
            'id': str(uuid4()),
            'time': now,
            'recordedtime': now,
            'type': 'uk.nhs.notify.digital.letters.mesh.inbox.message.invalid.v1',
            'dataschema': (
                'https://notify.nhs.uk/cloudevents/schemas/digital-letters/2025-10-draft/data/'
                'digital-letters-mesh-inbox-message-invalid-data.schema.json'
            ),
            'data': {
                'senderId': incoming_event.data.senderId,
                'meshMessageId': incoming_event.data.meshMessageId,
                'failureCode': failure_code,
                'messageReference': incoming_event.data.messageReference,
            }
        }

        failed = self.__event_publisher.send_events([cloud_event], MESHInboxMessageInvalid)
        if failed:
            msg = f"Failed to publish MESHInboxMessageInvalid event: {failed}"
            self.__log.error(msg, failed_count=len(failed))
            raise RuntimeError(msg)

        self.__log.info(
            "Published MESHInboxMessageInvalid event",
            sender_id=incoming_event.data.senderId,
            message_reference=incoming_event.data.messageReference
        )
