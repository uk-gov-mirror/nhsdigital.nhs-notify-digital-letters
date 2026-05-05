"""
Module implementing a fake MESH mailbox using AWS S3
"""

import io
import uuid
from .mesh_message import MockMeshMessage


class MockMeshClient:  # pylint: disable=too-many-arguments
    """
    Implements a fake MESH mailbox using AWS S3
    """

    def __init__(self, s3_client, s3_path, mailbox, log):
        self.__log = log
        self.s3_client = s3_client
        _, _, self.s3_bucket, self.s3_prefix = s3_path.split('/', 3)

        self.inbox_prefix = f"{self.s3_prefix}/{mailbox}/in/"
        self.outbox_prefix = f"{self.s3_prefix}/{mailbox}/out/"

    def iterate_all_messages(self):
        """
        Iterates over all available messages in a mailbox
        """

        response = self.s3_client.list_objects_v2(
            Bucket=self.s3_bucket,
            Prefix=self.inbox_prefix)

        message_count = 0

        has_objects = True
        while has_objects:
            for s3_object in response.get('Contents', []):
                message_count += 1
                if message_count > 500:
                    return

                yield MockMeshMessage(self.s3_client, self.s3_bucket, s3_object, self.__log)

            # pagination
            has_objects = response['IsTruncated']
            if has_objects:
                continuation_token = response['NextContinuationToken']
                response = self.s3_client.list_objects_v2(
                    Bucket=self.s3_bucket,
                    Prefix=self.inbox_prefix,
                    ContinuationToken=continuation_token
                )

    def retrieve_message(self, message_id):
        """
        Retrieves a specific message by ID from the inbox
        """
        message_key = f"{self.inbox_prefix}{message_id}"

        try:
            response = self.s3_client.head_object(
                Bucket=self.s3_bucket,
                Key=message_key
            )

            s3_object = {
                'Key': message_key,
                'ETag': response['ETag']
            }

            return MockMeshMessage(self.s3_client, self.s3_bucket, s3_object, self.__log)

        except self.s3_client.exceptions.NoSuchKey:
            self.__log.warning(f"Message {message_id} not found in inbox")
            return None
        except Exception as e:
            self.__log.error(
                f"Error retrieving message {message_id}: {str(e)}")
            return None

    def send_message(self, recipient, data, **kwargs):
        """
        Sends a message to a mailbox. Returns a generated mesh_message_id.
        """

        mesh_message_id = str(uuid.uuid4())
        message_key = f"{self.outbox_prefix}{recipient}/{mesh_message_id}"

        output_buffer = io.StringIO()
        output_buffer.write(data.decode('utf-8'))
        output_buffer.seek(0)

        self.s3_client.put_object(
            Bucket=self.s3_bucket,
            Key=message_key,
            Body=output_buffer.read().encode('utf8'),
            Metadata=kwargs
        )

        return mesh_message_id
    def close(self):
        """
        Empty implementation
        """

    def handshake(self):
        """
        Empty implementation
        """
