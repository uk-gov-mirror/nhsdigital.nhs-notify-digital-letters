"""lambda handler for mesh poll application"""

from boto3 import client
from dl_utils import SenderLookup
from .config import Config, log
from .processor import MeshMessageProcessor


def handler(_, context):
    """lambda handler for mesh poll application"""
    with Config() as config:
        processor = MeshMessageProcessor(
            config=config,
            sender_lookup=SenderLookup(client('ssm'), config, log),
            mesh_client=config.mesh_client,
            get_remaining_time_in_millis=context.get_remaining_time_in_millis,
            log=log,
            polling_metric=config.polling_metric,
            remaining_mesh_messages_metric=config.remaining_mesh_messages_metric,
            unfinished_reading_mesh_metric=config.unfinished_reading_mesh_metric,
            event_publisher_metric=config.event_publisher_metric)

        processor.process_messages()
