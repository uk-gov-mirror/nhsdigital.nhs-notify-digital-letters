"""
EventPublisher - Python implementation for publishing CloudEvents to EventBridge.

This module provides a Python equivalent of the TypeScript EventPublisher class.
"""

import json
import logging
import random
import time
from typing import List, Dict, Any, Optional, Literal, Callable
from uuid import uuid4
import boto3
from botocore.config import Config
from botocore.exceptions import ClientError
from .trace_context import create_traceparent, derive_child_traceparent


DlqReason = Literal['INVALID_EVENT', 'EVENTBRIDGE_FAILURE']
MAX_BATCH_SIZE = 10
MAX_PUBLISHER_RETRIES = 3
TRANSIENT_ERROR_CODES = {
    'ThrottlingException',
    'TooManyRequestsException',
    'RequestLimitExceeded',
    'ProvisionedThroughputExceededException',
    'InternalFailure',
    'InternalError',
    'ServiceUnavailable',
}


class EventPublisher:
    """
    Publisher for CloudEvents to AWS EventBridge with DLQ support.

    Validates events, sends them to EventBridge in batches, and routes
    failed events to a Dead Letter Queue (DLQ) for later processing.
    """

    def __init__(
        self,
        event_bus_arn: str,
        dlq_url: str,
        logger: Optional[logging.Logger] = None,
        events_client: Optional[Any] = None,
        sqs_client: Optional[Any] = None
    ):
        """
        Initialize the EventPublisher.
        """
        if not event_bus_arn:
            raise ValueError('event_bus_arn has not been specified')
        if not dlq_url:
            raise ValueError('dlq_url has not been specified')

        self.event_bus_arn = event_bus_arn
        self.dlq_url = dlq_url
        self.logger = logger or logging.getLogger(__name__)
        self.events_client = events_client or boto3.client(
            'events',
            config=Config(retries={'max_attempts': 3, 'mode': 'standard'})
        )
        self.sqs_client = sqs_client or boto3.client('sqs')

    def _validate_cloud_event(self, event: Dict[str, Any], validator: Callable[..., Any]) -> tuple[bool, Optional[str]]:
        """
        Validate event using the specified validator function.
        """
        try:
            validator(**event)
            return (True, None)
        except Exception as e:
            return (False, str(e))

    def _classify_failed_entries(
        self,
        response: Dict[str, Any],
        events: List[Dict[str, Any]]
    ) -> tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
        transient = []
        permanent = []

        for entry, event in zip(response.get("Entries", []), events):
            error_code = entry.get("ErrorCode")
            if not error_code:
                continue

            if error_code in TRANSIENT_ERROR_CODES:
                transient.append(event)
            else:
                permanent.append(event)

        return transient, permanent

    def _send_batch_with_retry(
        self, batch: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """
        Send a single batch to EventBridge with retries for transient errors.
        Returns a list of events that permanently failed.
        """
        events_to_retry = batch
        permanent_failures = []

        for attempt in range(MAX_PUBLISHER_RETRIES):
            entries = [
                {
                    "Source": event["source"],
                    "DetailType": event["type"],
                    "Detail": json.dumps(event),
                    "EventBusName": self.event_bus_arn,
                }
                for event in events_to_retry
            ]

            try:
                response = self.events_client.put_events(Entries=entries)

                transient, permanent = self._classify_failed_entries(
                    response, events_to_retry
                )

                permanent_failures.extend(permanent)

                if not transient:
                    if permanent_failures:
                        self.logger.warning(
                            'Batch completed with failures',
                            extra={'permanent_failure_count': len(permanent_failures)}
                        )
                    else:
                        self.logger.info('Batch completed successfully')
                    return permanent_failures

                if attempt == MAX_PUBLISHER_RETRIES - 1:
                    self.logger.warning(
                        'Retries exhausted, treating remaining transient failures as permanent',
                        extra={
                            'attempt': attempt + 1,
                            'max_retries': MAX_PUBLISHER_RETRIES,
                            'transient_failure_count': len(transient),
                            'permanent_failure_count': len(permanent_failures),
                        }
                    )
                    return permanent_failures + transient

                self.logger.info(
                    'Retrying transient failures',
                    extra={
                        'attempt': attempt + 1,
                        'max_retries': MAX_PUBLISHER_RETRIES,
                        'retry_count': len(transient),
                        'permanent_failure_count': len(permanent_failures),
                    }
                )
                events_to_retry = transient
                time.sleep((2 ** attempt) + random.uniform(0, 1))

            except ClientError as e:
                error_code = e.response.get("Error", {}).get("Code")

                if error_code in TRANSIENT_ERROR_CODES and attempt < MAX_PUBLISHER_RETRIES - 1:
                    self.logger.info(
                        'Retrying batch after transient ClientError',
                        extra={
                            'attempt': attempt + 1,
                            'max_retries': MAX_PUBLISHER_RETRIES,
                            'error_code': error_code,
                            'retry_count': len(events_to_retry),
                        }
                    )
                    time.sleep((2 ** attempt) + random.uniform(0, 1))
                    continue

                self.logger.warning(
                    'ClientError sending batch to EventBridge, failing entire batch',
                    extra={
                        'error_code': error_code,
                        'batch_size': len(events_to_retry),
                    }
                )
                return permanent_failures + events_to_retry

        return permanent_failures + events_to_retry

    def _send_to_event_bridge(self, events: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Send events to EventBridge in batches.
        """
        failed_events = []

        self.logger.info(
            f"Sending {len(events)} events to EventBridge",
            extra={
                'event_bus_arn': self.event_bus_arn,
                'event_count': len(events)
            }
        )

        for i in range(0, len(events), MAX_BATCH_SIZE):
            batch = events[i:i + MAX_BATCH_SIZE]

            self.logger.info(
                f"Sending batch of {len(batch)} events to EventBridge",
                extra={
                    'event_bus_arn': self.event_bus_arn,
                    'batch_size': len(batch)
                }
            )

            batch_failures = self._send_batch_with_retry(batch)

            if batch_failures:
                for event in batch_failures:
                    self.logger.warning(
                        'Event failed to send to EventBridge',
                        extra={'event_id': event.get('id')}
                    )
                failed_events.extend(batch_failures)

        return failed_events

    def _build_dlq_entries(
        self,
        events: List[Dict[str, Any]],
        reason: DlqReason
    ) -> tuple[List[Dict[str, Any]], Dict[str, Any]]:
        """Build SQS batch entries for the DLQ and a mapping of entry IDs to events"""
        id_to_event_map = {}
        entries = []
        for event in events:
            entry_id = str(uuid4())
            id_to_event_map[entry_id] = event
            entries.append({
                'Id': entry_id,
                'MessageBody': json.dumps(event),
                'MessageAttributes': {
                    'DlqReason': {
                        'DataType': 'String',
                        'StringValue': reason
                    }
                }
            })
        return entries, id_to_event_map

    def _extract_failed_dlq_events(
        self,
        response: Dict[str, Any],
        id_to_event_map: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        """Extract events that failed to send to the DLQ from a send_message_batch response."""
        failed = []
        for failed_entry in response.get('Failed', []):
            entry_id = failed_entry.get('Id')
            if entry_id and entry_id in id_to_event_map:
                failed_event = id_to_event_map[entry_id]
                self.logger.warning(
                    'Event failed to send to DLQ',
                    extra={
                        'error_code': failed_entry.get('Code'),
                        'error_message': failed_entry.get('Message'),
                        'event_id': failed_event.get('id')
                    }
                )
                failed.append(failed_event)
        return failed

    def _send_to_dlq(
        self,
        events: List[Dict[str, Any]],
        reason: DlqReason
    ) -> List[Dict[str, Any]]:
        """
        Send failed events to the Dead Letter Queue.
        """
        failed_dlqs = []

        self.logger.warning(
            'Sending failed events to DLQ',
            extra={
                'dlq_url': self.dlq_url,
                'event_count': len(events),
                'reason': reason
            }
        )

        for i in range(0, len(events), MAX_BATCH_SIZE):
            batch = events[i:i + MAX_BATCH_SIZE]
            entries, id_to_event_map = self._build_dlq_entries(batch, reason)

            try:
                response = self.sqs_client.send_message_batch(
                    QueueUrl=self.dlq_url,
                    Entries=entries
                )
                failed_dlqs.extend(self._extract_failed_dlq_events(response, id_to_event_map))

            except ClientError as error:
                self.logger.warning(
                    'DLQ send error',
                    extra={
                        'error': str(error),
                        'dlq_url': self.dlq_url,
                        'batch_size': len(batch)
                    }
                )
                failed_dlqs.extend(batch)

        if failed_dlqs:
            self.logger.error(
                'Failed to send events to DLQ',
                extra={
                    'failed_event_count': len(failed_dlqs),
                    'dlq_url': self.dlq_url
                }
            )

        return failed_dlqs

    def send_events(self, events: List[Dict[str, Any]],
                    validator: Callable[..., Any]) -> List[Dict[str, Any]]:
        """
        Send CloudEvents to EventBridge with validation and DLQ support.

        1. Stamps each event with a traceparent: derives a child if one exists, otherwise creates a new root traceparent.
        2. Validates events using the specified validator function
        3. Sends valid events to EventBridge
        4. Routes failed events to DLQ
        """
        if not events:
            self.logger.info('No events to send')
            return []

        for event in events:
            incoming = event.get('traceparent')
            if incoming:
                event['traceparent'] = derive_child_traceparent(incoming)
            else:
                event['traceparent'] = create_traceparent()

        valid_events = []
        invalid_events = []

        # Validate events using Pydantic
        for event in events:
            is_valid, error_msg = self._validate_cloud_event(event, validator)
            if is_valid:
                valid_events.append(event)
            else:
                invalid_events.append(event)
                self.logger.warning(
                    'Event validation failed',
                    extra={
                        'event_id': event.get('id', 'unknown'),
                        'validation_error': error_msg
                    }
                )

        self.logger.info(
            'Event validation completed',
            extra={
                'valid_event_count': len(valid_events),
                'invalid_event_count': len(invalid_events),
                'total_event_count': len(events)
            }
        )

        total_failed_events = []

        # Send invalid events to DLQ
        if invalid_events:
            failed_dlq_sends = self._send_to_dlq(invalid_events, 'INVALID_EVENT')
            total_failed_events.extend(failed_dlq_sends)

        # Send valid events to EventBridge
        if valid_events:
            failed_sends = self._send_to_event_bridge(valid_events)
            if failed_sends:
                failed_dlq_sends = self._send_to_dlq(failed_sends, 'EVENTBRIDGE_FAILURE')
                total_failed_events.extend(failed_dlq_sends)

        return total_failed_events
