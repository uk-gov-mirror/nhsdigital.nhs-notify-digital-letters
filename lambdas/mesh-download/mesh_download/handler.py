"""lambda handler for mesh download"""

import json
from dl_utils import EventPublisher

from .config import Config, log
from .processor import MeshDownloadProcessor
from .document_store import DocumentStore, DocumentStoreConfig


def handler(event, context):
    """
    lambda handler for mesh download
    Processes SQS events from mesh-download queue
    Returns batch item failures for partial batch failure handling
    """

    log.info("Received SQS event", record_count=len(event.get('Records', [])))

    batch_item_failures = []
    processed = {
        'retrieved': 0,
        'downloaded': 0,
        'skipped': 0,
        'failed': 0
    }

    try:
        with Config() as config:
            doc_store_config = DocumentStoreConfig(
                s3_client=config.s3_client,
                transactional_data_bucket=config.transactional_data_bucket
            )
            document_store = DocumentStore(doc_store_config)

            event_publisher = EventPublisher(
                event_bus_arn=config.event_publisher_event_bus_arn,
                dlq_url=config.event_publisher_dlq_url,
                logger=log
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

            # Process each SQS record
            for record in event.get('Records', []):
                processed['retrieved'] += 1
                message_id = record.get('messageId')

                if record.get('eventSource') != 'aws:sqs':
                    log.warn("Skipping non-SQS record", message_id=message_id)
                    continue

                try:
                    outcome = processor.process_sqs_message(record)
                    processed[outcome] += 1

                except Exception as exc:
                    processed['failed'] += 1
                    log.error("Failed to process SQS message",
                            message_id=message_id,
                            error=str(exc))
                    batch_item_failures.append({"itemIdentifier": message_id})

        log.info("Processed SQS event",
                retrieved=processed['retrieved'],
                downloaded=processed['downloaded'],
                skipped=processed['skipped'],
                failed=processed['failed'])

        return {"batchItemFailures": batch_item_failures}

    except Exception as exc:
        log.error("Error in mesh download handler", error=str(exc))
        raise
