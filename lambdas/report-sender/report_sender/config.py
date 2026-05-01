"""
Module for configuring Report Sender application
"""
from dl_utils import BaseMeshConfig, Metric


_REQUIRED_ENV_VAR_MAP = {
    "ssm_mesh_prefix": "SSM_MESH_PREFIX",
    "ssm_senders_prefix": "SSM_SENDERS_PREFIX",
    "environment": "ENVIRONMENT",
    "event_publisher_event_bus_arn": "EVENT_PUBLISHER_EVENT_BUS_ARN",
    "event_publisher_dlq_url": "EVENT_PUBLISHER_DLQ_URL",
    "send_metric_name": "REPORT_SENDER_METRIC_NAME",
    "dl_metrics_namespace": "DL_METRICS_NAMESPACE"
}


class Config(BaseMeshConfig):
    """
    Represents the configuration of the Send Reports application.
    Inherits common MESH configuration from BaseMeshConfig.
    """

    _REQUIRED_ENV_VAR_MAP = _REQUIRED_ENV_VAR_MAP

    def __init__(self, ssm=None):
        super().__init__(ssm=ssm)

        self.send_metric = None
    def __enter__(self):
        super().__enter__()

        # Build send metric
        self.send_metric = self.build_send_metric()

        return self

    def build_send_metric(self):
        """
        Returns a custom metric to record messages found in the when sending the report file using MESH
        """
        return Metric(
            name=self.send_metric_name,
            namespace=self.dl_metrics_namespace,
            dimensions={"Environment": self.environment}
        )
