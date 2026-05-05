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
    "polling_metric_namespace": "POLLING_METRIC_NAMESPACE"
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

    def __enter__(self):
        super().__enter__()

        # Build polling metric
        self.polling_metric = self.build_polling_metric()

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
