"""
Base configuration module for MESH client applications
"""
import json
import os
import boto3
import mesh_client
from py_mock_mesh.mesh_client import MockMeshClient
from .certificate_monitor import report_expiry_time
from .log_config import log
from .store_file import store_file


class InvalidMeshEndpointError(Exception):
    """
    Indicates an invalid MESH endpoint in configuration
    """


class InvalidEnvironmentVariableError(Exception):
    """
    Indicates an invalid environment variable
    """


class BaseMeshConfig:  # pylint: disable=too-many-instance-attributes
    """
    Base configuration class for MESH client applications.
    """

    _OPTIONAL_ENV_VAR_MAP = {
        "use_mesh_mock": "USE_MESH_MOCK"
    }

    def __init__(self, ssm=None, s3_client=None):
        """
        Initialize base MESH configuration.
        """
        self.ssm = ssm if ssm is not None else boto3.client('ssm')
        self.s3_client = s3_client if s3_client is not None else boto3.client('s3')

        # MESH connection attributes
        self.mesh_endpoint = None
        self.mesh_mailbox = None
        self.mesh_mailbox_password = None
        self.mesh_shared_key = None
        self.client_cert = None
        self.client_key = None
        self.mesh_client = None

        # Common configuration attributes
        self.ssm_mesh_prefix = None
        self.environment = None
        self.certificate_expiry_metric_name = None
        self.certificate_expiry_metric_namespace = None
        self.polling_metric_name = None
        self.polling_metric_namespace = None
        self.use_mesh_mock = False

        self._load_required_env_vars()

        self._load_optional_env_vars()

    def _load_required_env_vars(self):
        """
        Load required environment variables.
        """
        if not hasattr(self, '_REQUIRED_ENV_VAR_MAP'):
            raise NotImplementedError()

        missing_env_vars = []
        for attr, key in self._REQUIRED_ENV_VAR_MAP.items():
            if key not in os.environ:
                missing_env_vars.append(f'"{key}"')
            else:
                setattr(self, attr, os.environ[key])

        if len(missing_env_vars) > 0:
            raise InvalidEnvironmentVariableError(
                f"Required environment variables {', '.join(missing_env_vars)} not set.")

    def _load_optional_env_vars(self):
        """
        Load optional environment variables.
        """
        for attr, key in self._OPTIONAL_ENV_VAR_MAP.items():
            if key in os.environ:
                value = os.environ[key]
                if attr == "use_mesh_mock":
                    # Convert string to boolean
                    setattr(self, attr, value.lower() in ('true', '1', 'yes', 'on'))
                else:
                    setattr(self, attr, value)

    def __enter__(self):
        # Load MESH configuration from SSM
        ssm_response = self.ssm.get_parameter(
            Name=self.ssm_mesh_prefix + '/config',
            WithDecryption=True
        )
        mesh_config = json.loads(ssm_response['Parameter']['Value'])

        self.mesh_endpoint = mesh_config['mesh_endpoint']
        self.mesh_mailbox = mesh_config['mesh_mailbox']
        self.mesh_mailbox_password = mesh_config['mesh_mailbox_password']
        self.mesh_shared_key = mesh_config['mesh_shared_key'].encode('ascii')

        # Load client certificates from SSM
        client_cert_parameter = self.ssm.get_parameter(
            Name=self.ssm_mesh_prefix + '/client-cert',
            WithDecryption=True
        )
        client_key_parameter = self.ssm.get_parameter(
            Name=self.ssm_mesh_prefix + '/client-key',
            WithDecryption=True
        )

        self.client_cert = store_file(
            client_cert_parameter['Parameter']['Value'].encode('utf-8')
        )
        self.client_key = store_file(
            client_key_parameter['Parameter']['Value'].encode('utf-8')
        )

        # Build MESH client
        self.mesh_client = self.build_mesh_client()

        return self

    def __exit__(self, exc_type, exc_value, traceback):
        log.info('Cleaning up temporary files')
        if self.client_cert:
            os.unlink(self.client_cert)
        if self.client_key:
            os.unlink(self.client_key)
        if self.mesh_client:
            self.mesh_client.close()

    def lookup_endpoint(self, endpoint_identifier):
        variable_name = f"{endpoint_identifier}_ENDPOINT"

        if hasattr(mesh_client, variable_name):
            return getattr(mesh_client, variable_name)

        raise InvalidMeshEndpointError(
            f"mesh_client module has no such endpoint {variable_name}")

    def build_mesh_client(self):
        if self.use_mesh_mock:
            mock_endpoint = self.mesh_endpoint
            return MockMeshClient(
                boto3.client('s3'),
                mock_endpoint,
                self.mesh_mailbox,
                log
            )

        # Use real MESH client
        if self.certificate_expiry_metric_name and getattr(self, 'dl_metrics_namespace', None):
            report_expiry_time(
                self.client_cert,
                self.certificate_expiry_metric_name,
                self.dl_metrics_namespace,
                self.environment
            )

        return mesh_client.MeshClient(
            self.lookup_endpoint(self.mesh_endpoint),
            self.mesh_mailbox,
            self.mesh_mailbox_password,
            self.mesh_shared_key,
            transparent_compress=True,
            cert=(self.client_cert, self.client_key)
        )
