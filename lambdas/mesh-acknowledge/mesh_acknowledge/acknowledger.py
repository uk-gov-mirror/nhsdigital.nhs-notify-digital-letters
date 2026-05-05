"""Module for acknowledging MESH messages."""

import json
from mesh_client import MeshClient
from dl_utils import get_failure_code_description

NOTIFY_ACK_WORKFLOW_ID = "NHS_NOTIFY_FHIR_ACK"
ACK_SUBJECT = "202"
NACK_SUBJECT = "400"


class MeshAcknowledger:
    """
    Class responsible for acknowledging MESH messages.
    """

    def __init__(self, mesh_client: MeshClient, logger):
        self.__log = logger
        self.__mesh_client = mesh_client

        self.__mesh_client.handshake()

    def acknowledge_message(self,
                            mailbox_id: str,
                            message_id: str,
                            message_reference: str,
                            sender_id: str
                            ) -> str:
        """
        Acknowledge a MESH message given its ID.

        Args:
            mailbox_id (str): The ID of the mailbox to send the acknowledgment to.
            message_id (str): The ID of the message to acknowledge.
            message_reference (str): The reference of the message to acknowledge.
            sender_id (str): ID of the original message's sender to acknowledge.

        Returns:
            str: The ID of the acknowledgment message sent.

        Raises:
            Exception: If the acknowledgment fails.
        """

        message_body = json.dumps({
            "meshMessageId": message_id,
            "requestId": f"{sender_id}_{message_reference}"
        }).encode()

        try:
            ack_message_id = self.__mesh_client.send_message(
                mailbox_id,
                message_body,
                workflow_id=NOTIFY_ACK_WORKFLOW_ID,
                local_id=message_reference,
                subject=ACK_SUBJECT
            )
            self.__log.info(
                "Acknowledged MESH message",
                mesh_mailbox_id=mailbox_id,
                mesh_message_id=message_id,
                mesh_message_reference=message_reference,
                ack_message_id=ack_message_id
            )

            return ack_message_id

        except Exception as e:
            self.__log.error(
                "Failed to acknowledge MESH message",
                mesh_mailbox_id=mailbox_id,
                mesh_message_id=message_id,
                mesh_message_reference=message_reference,
                error=str(e)
            )

            raise

    def negative_acknowledge_message(self,
                                    mailbox_id: str,
                                    message_id: str,
                                    failure_code: str,
                                    sender_id: str,
                                    message_reference: str | None = None
                                    ) -> str:
        """
        Send a negative acknowledgement (NACK) for a MESH message.

        Args:
            mailbox_id (str): The ID of the mailbox to send the NACK to.
            message_id (str): The ID of the MESH message being rejected.
            failure_code (str): The failure code indicating why the message is invalid.
            sender_id (str): ID of the original message's sender.
            message_reference (str | None): Optional message reference from the original event.

        Returns:
            str: The ID of the NACK message sent.

        Raises:
            Exception: If the NACK fails to send.
        """

        body_dict: dict = {
            "meshMessageId": message_id,
            "failureCode": failure_code,
            "requestId": f"{sender_id}_{message_reference or ''}",
        }

        description = get_failure_code_description(failure_code)
        if description is not None:
            body_dict["message"] = description

        message_body = json.dumps(body_dict).encode()

        try:
            nack_message_id = self.__mesh_client.send_message(
                mailbox_id,
                message_body,
                workflow_id=NOTIFY_ACK_WORKFLOW_ID,
                subject=NACK_SUBJECT,
                **({'local_id': message_reference} if message_reference is not None else {})
            )
            self.__log.info(
                "Sent negative acknowledgement for MESH message",
                mesh_mailbox_id=mailbox_id,
                mesh_message_id=message_id,
                failure_code=failure_code,
                message_reference=message_reference,
                nack_message_id=nack_message_id
            )

            return nack_message_id

        except Exception as e:
            self.__log.error(
                "Failed to send negative acknowledgement for MESH message",
                mesh_mailbox_id=mailbox_id,
                mesh_message_id=message_id,
                failure_code=failure_code,
                message_reference=message_reference,
                error=str(e)
            )

            raise
