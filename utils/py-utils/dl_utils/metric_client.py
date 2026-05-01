"""
Module for  reporting metrics
"""
import json
import time


class Metric:  # pylint: disable=too-few-public-methods
    """
    Class for  reporting metrics
    """

    def __init__(self, **kwargs):
        self.name = kwargs.get('name', None)
        self.namespace = kwargs['namespace']
        self.dimensions = kwargs.get("dimensions", {})
        self.unit = kwargs.get("unit", 'Count')

    def record(self, value, **kwargs):

        metric_name = kwargs.get('name', self.name)
        """
        method for  reporting metric
        """
        print(json.dumps({
            "_aws": {
                "Timestamp": int(time.time() * 1000),
                "CloudWatchMetrics": [{
                    "Namespace": self.namespace,
                    "Dimensions": [
                        list(self.dimensions.keys())
                    ],
                    "Metrics": [
                        {
                            "Name": metric_name,
                            "Unit": self.unit,
                        }
                    ]
                }],
            },
            **self.dimensions,
            metric_name: value,
        }))
