from dl_utils.errors import format_exception
from mesh_client import MeshClient

MESH_MESSAGE_WORKFLOW_ID = 'NHS_NOTIFY_DIGITAL_LETTERS_DAILY_REPORT'

class MeshReportsSender:
    """
    Class responsible for sending reports to MESH mailboxes.
    """
    def __init__(self, mesh_client: MeshClient, logger):
        self.__log = logger
        self.__mesh_client = mesh_client

        self.__mesh_client.handshake()

    def send_report(self, reporting_mailbox: str, report_bytes: bytes, report_date: str, report_reference: str) -> str:
        """
        Sends a report to a specified MESH mailbox.

        Args:
            reporting_mailbox (str): The MESH mailbox ID to send the report to.
            report_bytes (bytes): The report content in bytes.
            report_date (str): The date of the report, used in the message subject.
            report_reference (str): The reference for the report, used in the message subject.

        Returns:
            str: The MESH message ID assigned to the sent message.

        Raises:
            Exception: If sending the report fails.
        """
        try:
            mesh_message_id = self.__mesh_client.send_message(
                reporting_mailbox,
                report_bytes,
                workflow_id=MESH_MESSAGE_WORKFLOW_ID,
                subject=f'{report_date}',
                local_id=report_reference,
            )
            self.__log.info(
                "Sent report to MESH mailbox",
                reporting_mailbox=reporting_mailbox,
                report_date=report_date
            )
            return mesh_message_id
        except Exception as e:
            self.__log.error(
                f"Failed to send report to MESH mailbox, error:{str(e)}",
                reporting_mailbox=reporting_mailbox,
                report_date=report_date,
                error=format_exception(e)
            )
            raise
