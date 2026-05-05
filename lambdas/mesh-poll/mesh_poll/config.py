"""
Module for configuring Mesh Poll application
"""
from dl_utils import BaseMeshConfig, Metric, log

__all__ = ['Config', 'log']

_REQUIRED_ENV_VAR_MAP = {
    "ssm_senders_prefix": "SSM_SENDERS_PREFIX",
    "ssm_mesh_prefix": "SSM_MESH_PREFIX",
    "lambda_timeout_buffer_milliseconds": "LAMBDA_TIMEOUT_BUFFER_MILLISECONDS",
    "environment": "ENVIRONMENT",
    "event_bus_arn": "EVENT_PUBLISHER_EVENT_BUS_ARN",
    "event_publisher_dlq_url": "EVENT_PUBLISHER_DLQ_URL",
    "certificate_expiry_metric_name": "CERTIFICATE_EXPIRY_METRIC_NAME",
    "polling_metric_name": "POLLING_METRIC_NAME",
    "dl_metrics_namespace": "DL_METRICS_NAMESPACE",
}


class Config(BaseMeshConfig):
    """
    Represents the configuration of the Mesh Poll application.
    Inherits common MESH configuration from BaseMeshConfig.
    """

    _REQUIRED_ENV_VAR_MAP = _REQUIRED_ENV_VAR_MAP

    def __init__(self, ssm=None):
        super().__init__(ssm=ssm)

        self.polling_metric = None
        self.messages_in_mailbox_metric = None
        self.finished_before_reading_all_messages_metric = None
        self.event_publisher_metric = None

    def __enter__(self):
        super().__enter__()

        # Build polling metric
        self.polling_metric = self.build_polling_metric()
        self.messages_in_mailbox_metric = self.build_messages_in_mailbox_metric()
        self.finished_before_reading_all_messages_metric = self.build_finished_before_reading_all_messages_metric()
        self.event_publisher_metric = self.build_event_publisher_metric()

        return self

    def build_polling_metric(self):
        """
        Returns a custom metric to record the poller finished succesfully.
        """
        return Metric(
            name=self.polling_metric_name,
            namespace=self.dl_metrics_namespace,
            dimensions={"Environment": self.environment}
        )

    def build_event_publisher_metric(self):
        """
        Returns a custom metric to record event published by the EventPublisher class
        """
        return Metric(
            namespace=self.dl_metrics_namespace,
            dimensions={"Environment": self.environment}
        )

    def build_messages_in_mailbox_metric(self):
        """
        Returns a custom metric to record number of messages in the MESH mailbox
        """
        return Metric(
            name="mesh-poll-messages-in-mailbox",
            namespace=self.dl_metrics_namespace,
            dimensions={"Environment": self.environment}
        )

    def build_finished_before_reading_all_messages_metric(self):
        """
        Returns a custom metric to record that the poll lambda is exiting before processing all messages in the MESH inbox due to time constraints
        """
        return Metric(
            name="mesh-poll-finished-before-reading-all-messages",
            namespace=self.dl_metrics_namespace,
            dimensions={"Environment": self.environment}
        )
