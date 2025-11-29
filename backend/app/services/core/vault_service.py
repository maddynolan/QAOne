"""
Vault Service - HashiCorp Vault Integration (Optional)
Provides dynamic secret injection with short-lived tokens for test runners.
Falls back to local secrets service if Vault is not configured.
"""

import logging
import os
from typing import Dict, Any, Optional, List
from datetime import datetime, timedelta
import hvac  # HashiCorp Vault client
from app.services.core.secrets_service import get_secrets_service

logger = logging.getLogger(__name__)


class VaultService:
    """
    Service for HashiCorp Vault integration.
    Provides short-lived tokens and dynamic secret injection.
    Falls back to local secrets service if Vault is not available.
    """
    
    def __init__(self):
        self.vault_url = os.getenv("VAULT_ADDR", "")
        self.vault_token = os.getenv("VAULT_TOKEN", "")
        self.vault_enabled = bool(self.vault_url and self.vault_token)
        self.client = None
        self.secrets_service = get_secrets_service()
        
        if self.vault_enabled:
            try:
                self.client = hvac.Client(url=self.vault_url, token=self.vault_token)
                # Verify connection
                if self.client.is_authenticated():
                    logger.info("HashiCorp Vault connection established")
                else:
                    logger.warning("Vault authentication failed, falling back to local secrets")
                    self.vault_enabled = False
            except Exception as e:
                logger.warning(f"Failed to connect to Vault: {e}, falling back to local secrets")
                self.vault_enabled = False
    
    async def generate_short_lived_token(
        self,
        secret_paths: List[str],
        ttl_seconds: int = 3600,  # 1 hour default
        policies: Optional[List[str]] = None
    ) -> Optional[str]:
        """
        Generate a short-lived Vault token with access to specific secrets.
        
        Args:
            secret_paths: List of secret paths the token should access
            ttl_seconds: Time-to-live in seconds
            policies: Optional custom policies
            
        Returns:
            Short-lived token string or None if Vault not available
        """
        if not self.vault_enabled:
            logger.debug("Vault not enabled, skipping token generation")
            return None
        
        try:
            # Create a policy that allows access to specific paths
            policy_name = f"test-runner-{datetime.utcnow().timestamp()}"
            policy_rules = "\n".join([
                f'path "{path}" {{ capabilities = ["read"] }}'
                for path in secret_paths
            ])
            
            self.client.sys.create_or_update_policy(
                name=policy_name,
                policy=policy_rules
            )
            
            # Create token with policy and TTL
            token_response = self.client.auth.token.create(
                policies=[policy_name],
                ttl=f"{ttl_seconds}s",
                renewable=True
            )
            
            token = token_response["auth"]["client_token"]
            logger.info(f"Generated short-lived Vault token with {ttl_seconds}s TTL")
            
            return token
        
        except Exception as e:
            logger.error(f"Failed to generate Vault token: {e}")
            return None
    
    async def get_secrets_for_test_case(
        self,
        test_case_id: str,
        secret_names: List[str],
        org_id: Optional[str] = None,
        project_id: Optional[str] = None,
        use_vault: bool = True
    ) -> Dict[str, str]:
        """
        Get secrets for a test case with dynamic least privilege.
        Only returns secrets required for that specific test case.
        
        Args:
            test_case_id: Test case ID
            secret_names: List of secret names needed
            org_id: Organization ID
            project_id: Project ID
            use_vault: Whether to use Vault (if available)
            
        Returns:
            Dictionary mapping secret names to values
        """
        if use_vault and self.vault_enabled:
            # Use Vault for secret retrieval
            secrets = {}
            for secret_name in secret_names:
                try:
                    # Construct Vault path (e.g., "secret/data/org_id/project_id/secret_name")
                    vault_path = f"secret/data/{org_id or 'default'}/{project_id or 'default'}/{secret_name}"
                    response = self.client.secrets.kv.v2.read_secret_version(path=vault_path)
                    secrets[secret_name] = response["data"]["data"].get("value", "")
                except Exception as e:
                    logger.warning(f"Failed to read secret {secret_name} from Vault: {e}")
                    # Fallback to local secrets
                    secret = await self.secrets_service.get_secret_by_name(
                        secret_name, org_id=org_id, project_id=project_id, decrypt=True
                    )
                    if secret:
                        secrets[secret_name] = secret.get("value", "")
        else:
            # Use local secrets service
            secrets = await self.secrets_service.inject_secrets_into_env(
                secret_names=secret_names,
                org_id=org_id,
                project_id=project_id
            )
        
        return secrets
    
    async def inject_secrets_into_runner(
        self,
        test_case_id: str,
        runner_container_id: str,
        secret_names: List[str],
        org_id: Optional[str] = None,
        project_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Inject secrets into a test runner container using short-lived tokens.
        Implements dynamic least privilege - only required secrets are injected.
        
        Args:
            test_case_id: Test case ID
            runner_container_id: Container/runner ID
            secret_names: List of secret names needed
            org_id: Organization ID
            project_id: Project ID
            
        Returns:
            Injection result with token info
        """
        # Generate short-lived token (1 hour TTL)
        vault_paths = [
            f"secret/data/{org_id or 'default'}/{project_id or 'default'}/{name}"
            for name in secret_names
        ]
        
        token = await self.generate_short_lived_token(
            secret_paths=vault_paths,
            ttl_seconds=3600
        )
        
        # Get secrets
        secrets = await self.get_secrets_for_test_case(
            test_case_id=test_case_id,
            secret_names=secret_names,
            org_id=org_id,
            project_id=project_id,
            use_vault=bool(token)
        )
        
        return {
            "status": "success",
            "runner_id": runner_container_id,
            "test_case_id": test_case_id,
            "secrets_injected": list(secrets.keys()),
            "vault_token": token if token else None,
            "token_ttl_seconds": 3600 if token else None,
            "secrets": secrets  # For direct injection if Vault not used
        }
    
    def is_vault_available(self) -> bool:
        """Check if Vault is available and configured"""
        return self.vault_enabled


# Global instance
_vault_service = None

def get_vault_service() -> VaultService:
    """Get or create global VaultService instance"""
    global _vault_service
    if _vault_service is None:
        _vault_service = VaultService()
    return _vault_service

