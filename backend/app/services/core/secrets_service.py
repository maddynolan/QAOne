"""
Secrets Management Service
Handles encrypted storage and retrieval of API keys, passwords, and sensitive test data.
"""

import logging
import os
from typing import Dict, Any, Optional, List
from cryptography.fernet import Fernet
import base64
import hashlib

from app.services.storage.postgres_direct import get_postgres_pool
from app.middleware.tenant_middleware import get_current_tenant_id
from app.middleware.rbac_middleware import get_current_auth_user_id

logger = logging.getLogger(__name__)


class SecretsService:
    """
    Service for managing encrypted secrets.
    Uses Fernet (symmetric encryption) for encryption at rest.
    """
    
    def __init__(self):
        # Get encryption key from environment
        encryption_key = os.getenv("SECRETS_ENCRYPTION_KEY")
        if not encryption_key:
            # Generate a key (for development only - should be set in production)
            logger.warning("SECRETS_ENCRYPTION_KEY not set, generating temporary key")
            encryption_key = Fernet.generate_key().decode()
        
        # Ensure key is 32 bytes (Fernet requirement)
        if isinstance(encryption_key, str):
            # If key is a string, hash it to get 32 bytes
            key_hash = hashlib.sha256(encryption_key.encode()).digest()
            self.encryption_key = base64.urlsafe_b64encode(key_hash)
        else:
            self.encryption_key = encryption_key
        
        self.cipher = Fernet(self.encryption_key)
    
    def _encrypt_value(self, plaintext: str) -> bytes:
        """Encrypt a plaintext value"""
        return self.cipher.encrypt(plaintext.encode())
    
    def _decrypt_value(self, encrypted: bytes) -> str:
        """Decrypt an encrypted value"""
        return self.cipher.decrypt(encrypted).decode()
    
    async def create_secret(
        self,
        name: str,
        value: str,
        secret_type: str = "custom",
        description: Optional[str] = None,
        org_id: Optional[str] = None,
        project_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Create a new encrypted secret.
        
        Args:
            name: Secret name (must be unique per org/project)
            value: Plaintext secret value
            secret_type: Type of secret (api_key, password, token, credential, custom)
            description: Optional description
            org_id: Organization ID
            project_id: Project ID
            
        Returns:
            Created secret dictionary
        """
        pool = get_postgres_pool()
        if not pool:
            raise Exception("Database connection pool not available")
        
        tenant_id = get_current_tenant_id()
        user_id = get_current_auth_user_id()
        
        # Encrypt the value
        encrypted_value = self._encrypt_value(value)
        
        async with pool.acquire() as conn:
            result = await conn.fetchrow("""
                INSERT INTO secrets (
                    org_id, project_id, name, description, secret_type,
                    encrypted_value, created_by, tenant_id
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                RETURNING secret_id, created_at
            """, org_id, project_id, name, description, secret_type,
                encrypted_value, user_id, tenant_id)
        
        return {
            "secret_id": str(result["secret_id"]),
            "name": name,
            "secret_type": secret_type,
            "description": description,
            "org_id": org_id,
            "project_id": project_id,
            "created_at": result["created_at"].isoformat()
        }
    
    async def get_secret(
        self,
        secret_id: str,
        decrypt: bool = True
    ) -> Optional[Dict[str, Any]]:
        """
        Get a secret by ID.
        
        Args:
            secret_id: Secret ID
            decrypt: Whether to decrypt the value (default: True)
            
        Returns:
            Secret dictionary with decrypted value if decrypt=True
        """
        pool = get_postgres_pool()
        if not pool:
            raise Exception("Database connection pool not available")
        
        tenant_id = get_current_tenant_id()
        
        async with pool.acquire() as conn:
            result = await conn.fetchrow("""
                SELECT secret_id, org_id, project_id, name, description,
                       secret_type, encrypted_value, created_at, updated_at,
                       created_by, tenant_id
                FROM secrets
                WHERE secret_id = $1
                  AND (tenant_id = $2 OR tenant_id IS NULL)
            """, secret_id, tenant_id)
        
        if not result:
            return None
        
        secret = dict(result)
        
        if decrypt:
            try:
                secret["value"] = self._decrypt_value(result["encrypted_value"])
            except Exception as e:
                logger.error(f"Failed to decrypt secret {secret_id}: {e}")
                secret["value"] = None
        else:
            secret["encrypted_value"] = base64.b64encode(result["encrypted_value"]).decode()
        
        # Remove encrypted_value from response if decrypted
        if decrypt and "encrypted_value" in secret:
            del secret["encrypted_value"]
        
        return secret
    
    async def get_secret_by_name(
        self,
        name: str,
        org_id: Optional[str] = None,
        project_id: Optional[str] = None,
        decrypt: bool = True
    ) -> Optional[Dict[str, Any]]:
        """
        Get a secret by name.
        
        Args:
            name: Secret name
            org_id: Organization ID
            project_id: Project ID
            decrypt: Whether to decrypt the value
            
        Returns:
            Secret dictionary
        """
        pool = get_postgres_pool()
        if not pool:
            raise Exception("Database connection pool not available")
        
        tenant_id = get_current_tenant_id()
        
        async with pool.acquire() as conn:
            result = await conn.fetchrow("""
                SELECT secret_id, org_id, project_id, name, description,
                       secret_type, encrypted_value, created_at, updated_at,
                       created_by, tenant_id
                FROM secrets
                WHERE name = $1
                  AND (org_id = $2 OR $2 IS NULL)
                  AND (project_id = $3 OR $3 IS NULL)
                  AND (tenant_id = $4 OR tenant_id IS NULL)
                ORDER BY created_at DESC
                LIMIT 1
            """, name, org_id, project_id, tenant_id)
        
        if not result:
            return None
        
        secret = dict(result)
        
        if decrypt:
            try:
                secret["value"] = self._decrypt_value(result["encrypted_value"])
            except Exception as e:
                logger.error(f"Failed to decrypt secret {name}: {e}")
                secret["value"] = None
        
        if decrypt and "encrypted_value" in secret:
            del secret["encrypted_value"]
        
        return secret
    
    async def list_secrets(
        self,
        org_id: Optional[str] = None,
        project_id: Optional[str] = None,
        secret_type: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        List secrets (without decrypted values).
        
        Args:
            org_id: Filter by organization ID
            project_id: Filter by project ID
            secret_type: Filter by secret type
            
        Returns:
            List of secret dictionaries (without decrypted values)
        """
        pool = get_postgres_pool()
        if not pool:
            raise Exception("Database connection pool not available")
        
        tenant_id = get_current_tenant_id()
        
        query = """
            SELECT secret_id, org_id, project_id, name, description,
                   secret_type, created_at, updated_at, created_by, tenant_id
            FROM secrets
            WHERE (tenant_id = $1 OR tenant_id IS NULL)
        """
        params = [tenant_id]
        param_idx = 2
        
        if org_id:
            query += f" AND (org_id = ${param_idx} OR org_id IS NULL)"
            params.append(org_id)
            param_idx += 1
        
        if project_id:
            query += f" AND (project_id = ${param_idx} OR project_id IS NULL)"
            params.append(project_id)
            param_idx += 1
        
        if secret_type:
            query += f" AND secret_type = ${param_idx}"
            params.append(secret_type)
            param_idx += 1
        
        query += " ORDER BY created_at DESC"
        
        async with pool.acquire() as conn:
            results = await conn.fetch(query, *params)
        
        return [dict(row) for row in results]
    
    async def inject_secrets_into_env(
        self,
        secret_names: List[str],
        org_id: Optional[str] = None,
        project_id: Optional[str] = None
    ) -> Dict[str, str]:
        """
        Inject secrets into environment variables for test execution.
        Returns a dictionary of secret_name -> value for injection.
        
        Args:
            secret_names: List of secret names to inject
            org_id: Organization ID
            project_id: Project ID
            
        Returns:
            Dictionary mapping secret names to values
        """
        secrets_dict = {}
        
        for secret_name in secret_names:
            secret = await self.get_secret_by_name(
                secret_name,
                org_id=org_id,
                project_id=project_id,
                decrypt=True
            )
            
            if secret and secret.get("value"):
                # Convert secret name to environment variable name
                env_var_name = secret_name.upper().replace("-", "_").replace(" ", "_")
                secrets_dict[env_var_name] = secret["value"]
                logger.info(f"Injected secret {secret_name} as {env_var_name}")
            else:
                logger.warning(f"Secret {secret_name} not found or could not be decrypted")
        
        return secrets_dict


# Global instance
_secrets_service = None

def get_secrets_service() -> SecretsService:
    """Get or create global SecretsService instance"""
    global _secrets_service
    if _secrets_service is None:
        _secrets_service = SecretsService()
    return _secrets_service

