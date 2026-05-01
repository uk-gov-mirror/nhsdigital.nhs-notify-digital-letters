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
    "certificate_expiry_metric_namespace": "CERTIFICATE_EXPIRY_METRIC_NAMESPACE",
    "polling_metric_name": "POLLING_METRIC_NAME",
    "polling_metric_namespace": "POLLING_METRIC_NAMESPACE",
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
        self.remaining_mesh_messages_metric = None
        self.unfinished_reading_mesh_metric = None

    def __enter__(self):
        super().__enter__()

        # Build polling metric
        self.polling_metric = self.build_polling_metric()
        self.remaining_mesh_messages_metric = self.build_remaining_mesh_messages_metric()
        self.unfinished_reading_mesh_metric = self.build_unfinished_reading_mesh_metric()

        return self

    def build_polling_metric(self):
        """
        Returns a custom metric to record messages found in the MESH inbox during polling
        """
        return Metric(
            name=self.polling_metric_name,
            namespace=self.polling_metric_namespace,
            dimensions={"Environment": self.environment}
        )

    def build_remaining_mesh_messages_metric(self):
        """
        Returns a custom metric to record remaining messages in the MESH inbox after polling
        """
        return Metric(
            name="RemainingMeshMessages",
            namespace=self.dl_metrics_namespace,
            dimensions={"Environment": self.environment}
        )

    def build_unfinished_reading_mesh_metric(self):
        """
        Returns a custom metric to record that the poll lambda is exiting before processing all messages in the MESH inbox due to time constraints
        """
        return Metric(
            name="UnfinishedReadingMeshMessages",
            namespace=self.dl_metrics_namespace,
            dimensions={"Environment": self.environment}
        )
