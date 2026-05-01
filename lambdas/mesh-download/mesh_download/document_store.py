"""Module for storing document references in S3"""

from botocore.exceptions import ClientError


class IntermediaryBodyStoreError(Exception):
    """Error to represent any failure to upload document to intermediate location"""


class DocumentAlreadyExistsInternalRetryError(Exception):
    """Raised when a document already exists in S3 with the same meshMessageId (internal retry)"""


class DocumentAlreadyExistsError(Exception):
    """Raised when a document already exists in S3 with a different meshMessageId (trust duplicate)"""


class DocumentStoreConfig:
    """Configuration holder for DocumentStore"""
    def __init__(self, s3_client, transactional_data_bucket):
        self.s3_client = s3_client
        self.transactional_data_bucket = transactional_data_bucket


class DocumentStore:  # pylint: disable=too-few-public-methods
    """Class for storing document references in S3"""

    def __init__(self, config):
        self.config = config

    def store_document(self, sender_id, message_reference, mesh_message_id, content):
        """Store document reference in S3.

        Enforces one message per (senderId, messageReference).
        meshMessageId is stored in object metadata to distinguish internal retries from
        trust duplicates.

        Raises DocumentAlreadyExistsInternalRetryError when the same meshMessageId already
        exists (safe to skip and acknowledge).

        Raises DocumentAlreadyExistsError when a different meshMessageId exists for the same
        (senderId, messageReference) key. This indicates a trust duplicate and will be rejected with a nack.
        """
        s3_key = f"document-reference/{sender_id}/{message_reference}"

        try:
            s3_response = self.config.s3_client.put_object(
                Bucket=self.config.transactional_data_bucket,
                Key=s3_key,
                Body=content,
                Metadata={'mesh_message_id': mesh_message_id},
                IfNoneMatch='*'
            )
        except ClientError as e:
            if e.response['Error']['Code'] == 'PreconditionFailed':
                self._classify_existing_document(s3_key, mesh_message_id)
            raise IntermediaryBodyStoreError(e) from e

        if s3_response['ResponseMetadata']['HTTPStatusCode'] != 200:
            raise IntermediaryBodyStoreError(s3_response)

        return s3_key

    def _classify_existing_document(self, s3_key, incoming_mesh_message_id):
        """Fetch existing object metadata and raise the appropriate duplicate error."""
        try:
            head = self.config.s3_client.head_object(
                Bucket=self.config.transactional_data_bucket,
                Key=s3_key
            )
            existing_mesh_message_id = head.get('Metadata', {}).get('mesh_message_id')
        except ClientError as e:
            raise IntermediaryBodyStoreError(
                f"Failed to fetch existing document metadata for key: {s3_key}"
            ) from e

        if existing_mesh_message_id == incoming_mesh_message_id:
            raise DocumentAlreadyExistsInternalRetryError(
                f"Internal retry for key: {s3_key}, meshMessageId: {incoming_mesh_message_id}"
            )

        raise DocumentAlreadyExistsError(
            f"Trust duplicate for key: {s3_key}. "
            f"Stored meshMessageId: {existing_mesh_message_id}, "
            f"incoming meshMessageId: {incoming_mesh_message_id}"
        )
