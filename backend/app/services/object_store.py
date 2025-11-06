"""
Object Store Service - S3/MinIO Integration
Handles storage of test artifacts: videos, screenshots, HAR files, logs, etc.
"""

import os
import boto3
from botocore.exceptions import ClientError
from typing import Optional, BinaryIO, Dict, Any
from datetime import datetime, timedelta
import logging
from pathlib import Path
import uuid

logger = logging.getLogger(__name__)


class ObjectStoreService:
    """
    Service for storing and retrieving test artifacts.
    Supports S3-compatible storage (AWS S3, MinIO, etc.)
    """

    def __init__(
        self,
        endpoint_url: Optional[str] = None,
        access_key: Optional[str] = None,
        secret_key: Optional[str] = None,
        bucket_name: str = "qa-artifacts",
        region: str = "us-east-1",
        use_ssl: bool = True
    ):
        """
        Initialize object store service.
        
        Args:
            endpoint_url: S3 endpoint (None for AWS, or MinIO URL)
            access_key: Access key
            secret_key: Secret key
            bucket_name: Default bucket name
            region: AWS region
            use_ssl: Use SSL/TLS
        """
        self.endpoint_url = endpoint_url or os.getenv("S3_ENDPOINT_URL")
        self.access_key = access_key or os.getenv("S3_ACCESS_KEY", "minioadmin")
        self.secret_key = secret_key or os.getenv("S3_SECRET_KEY", "minioadmin")
        self.bucket_name = bucket_name or os.getenv("S3_BUCKET_NAME", "qa-artifacts")
        self.region = region
        self.use_ssl = use_ssl

        # Initialize S3 client
        self.s3_client = boto3.client(
            's3',
            endpoint_url=self.endpoint_url,
            aws_access_key_id=self.access_key,
            aws_secret_access_key=self.secret_key,
            region_name=self.region,
            use_ssl=self.use_ssl
        )

        # Ensure bucket exists
        self._ensure_bucket_exists()

    def _ensure_bucket_exists(self):
        """Create bucket if it doesn't exist"""
        try:
            self.s3_client.head_bucket(Bucket=self.bucket_name)
            logger.info(f"Bucket {self.bucket_name} exists")
        except ClientError:
            try:
                if self.endpoint_url:
                    # MinIO - no LocationConstraint needed
                    self.s3_client.create_bucket(Bucket=self.bucket_name)
                else:
                    # AWS S3
                    self.s3_client.create_bucket(
                        Bucket=self.bucket_name,
                        CreateBucketConfiguration={'LocationConstraint': self.region}
                    )
                logger.info(f"Created bucket {self.bucket_name}")
            except Exception as e:
                logger.error(f"Failed to create bucket {self.bucket_name}: {e}")
                raise

    def upload_artifact(
        self,
        artifact_type: str,  # 'video', 'screenshot', 'har', 'log', 'coverage', etc.
        artifact_data: bytes,
        org_id: str,
        project_id: str,
        run_id: str,
        step_id: Optional[str] = None,
        filename: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> str:
        """
        Upload an artifact to object store.
        
        Returns:
            S3 key/path of the uploaded artifact
        """
        # Generate path: org_id/project_id/run_id/step_id/artifact_type/filename
        timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
        filename = filename or f"{artifact_type}_{timestamp}_{uuid.uuid4().hex[:8]}"
        
        if step_id:
            key = f"{org_id}/{project_id}/{run_id}/{step_id}/{artifact_type}/{filename}"
        else:
            key = f"{org_id}/{project_id}/{run_id}/{artifact_type}/{filename}"

        try:
            extra_args = {}
            if metadata:
                extra_args['Metadata'] = {str(k): str(v) for k, v in metadata.items()}

            self.s3_client.put_object(
                Bucket=self.bucket_name,
                Key=key,
                Body=artifact_data,
                ContentType=self._get_content_type(artifact_type),
                **extra_args
            )

            logger.info(f"Uploaded artifact to s3://{self.bucket_name}/{key}")
            return key

        except Exception as e:
            logger.error(f"Failed to upload artifact {key}: {e}")
            raise

    def download_artifact(self, key: str) -> bytes:
        """Download an artifact from object store"""
        try:
            response = self.s3_client.get_object(Bucket=self.bucket_name, Key=key)
            return response['Body'].read()
        except Exception as e:
            logger.error(f"Failed to download artifact {key}: {e}")
            raise

    def get_presigned_url(
        self,
        key: str,
        expiration: int = 3600  # 1 hour
    ) -> str:
        """Generate a presigned URL for accessing an artifact"""
        try:
            url = self.s3_client.generate_presigned_url(
                'get_object',
                Params={'Bucket': self.bucket_name, 'Key': key},
                ExpiresIn=expiration
            )
            return url
        except Exception as e:
            logger.error(f"Failed to generate presigned URL for {key}: {e}")
            raise

    def list_artifacts(
        self,
        org_id: str,
        project_id: str,
        run_id: Optional[str] = None,
        artifact_type: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """List artifacts for a project/run"""
        prefix = f"{org_id}/{project_id}/"
        if run_id:
            prefix += f"{run_id}/"
        if artifact_type:
            prefix += f"{artifact_type}/"

        try:
            response = self.s3_client.list_objects_v2(
                Bucket=self.bucket_name,
                Prefix=prefix
            )

            artifacts = []
            for obj in response.get('Contents', []):
                artifacts.append({
                    'key': obj['Key'],
                    'size': obj['Size'],
                    'last_modified': obj['LastModified'].isoformat(),
                    'etag': obj['ETag']
                })

            return artifacts
        except Exception as e:
            logger.error(f"Failed to list artifacts: {e}")
            return []

    def delete_artifact(self, key: str):
        """Delete an artifact from object store"""
        try:
            self.s3_client.delete_object(Bucket=self.bucket_name, Key=key)
            logger.info(f"Deleted artifact {key}")
        except Exception as e:
            logger.error(f"Failed to delete artifact {key}: {e}")
            raise

    def delete_run_artifacts(self, org_id: str, project_id: str, run_id: str):
        """Delete all artifacts for a test run"""
        prefix = f"{org_id}/{project_id}/{run_id}/"
        
        try:
            # List all objects with prefix
            response = self.s3_client.list_objects_v2(
                Bucket=self.bucket_name,
                Prefix=prefix
            )

            # Delete each object
            for obj in response.get('Contents', []):
                self.s3_client.delete_object(
                    Bucket=self.bucket_name,
                    Key=obj['Key']
                )

            logger.info(f"Deleted all artifacts for run {run_id}")
        except Exception as e:
            logger.error(f"Failed to delete run artifacts: {e}")
            raise

    def _get_content_type(self, artifact_type: str) -> str:
        """Get content type based on artifact type"""
        content_types = {
            'video': 'video/mp4',
            'screenshot': 'image/png',
            'har': 'application/json',
            'log': 'text/plain',
            'coverage': 'application/json',
            'perf': 'application/json',
            'security': 'application/json'
        }
        return content_types.get(artifact_type, 'application/octet-stream')


# Global instance (initialized with env vars)
object_store_service = ObjectStoreService()

