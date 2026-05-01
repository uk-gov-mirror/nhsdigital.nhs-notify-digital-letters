"""
Module for configuring MESH Acknowledger application
"""
from dl_utils import BaseMeshConfig, Metric

_REQUIRED_ENV_VAR_MAP = {
    "ssm_mesh_prefix": "SSM_MESH_PREFIX",
    "ssm_senders_prefix": "SSM_SENDERS_PREFIX",
    "environment": "ENVIRONMENT",
    "event_publisher_event_bus_arn": "EVENT_PUBLISHER_EVENT_BUS_ARN",
    "event_publisher_dlq_url": "EVENT_PUBLISHER_DLQ_URL",
    "dl_metrics_namespace": "DL_METRICS_NAMESPACE",
    "dlq_url": "DLQ_URL",
}


class Config(BaseMeshConfig):
    """
    Represents the configuration of the MESH Acknowledger application.

    Inherits common MESH configuration from BaseMeshConfig.
    """

    _REQUIRED_ENV_VAR_MAP = _REQUIRED_ENV_VAR_MAP

    def __init__(self, ssm=None):
        super().__init__(ssm=ssm)
        self.event_publisher_metric = None

    def __enter__(self):
        super().__enter__()
        self.event_publisher_metric = self.build_event_publisher_metric()
        return self

    def build_event_publisher_metric(self):
        """
        Returns a custom metric to record events published by the EventPublisher class
        """
        return Metric(
            namespace=self.dl_metrics_namespace,
            dimensions={"Environment": self.environment}
        )
