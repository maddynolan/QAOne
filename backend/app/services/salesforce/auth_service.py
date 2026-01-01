"""
Salesforce Authentication Service

Supports multiple authentication strategies for parallel test execution:
1. JWT Bearer Flow (recommended for CI/CD)
2. OAuth Refresh Token
3. Username/Password with Security Token

This service manages token lifecycle, refresh, and distribution to parallel test runners.
"""

import os
import json
import time
import jwt
import httpx
from datetime import datetime, timedelta
from typing import Optional, Dict, Any, List
from dataclasses import dataclass, asdict
from pathlib import Path
import asyncio
import logging
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.backends import default_backend

logger = logging.getLogger(__name__)


@dataclass
class SalesforceToken:
    """Represents a Salesforce access token with metadata"""
    access_token: str
    instance_url: str
    token_type: str = "Bearer"
    issued_at: float = None
    expires_at: float = None
    scope: str = None
    id_url: str = None
    
    def __post_init__(self):
        if self.issued_at is None:
            self.issued_at = time.time()
        if self.expires_at is None:
            # Default 2 hour expiry
            self.expires_at = self.issued_at + 7200
    
    @property
    def is_expired(self) -> bool:
        # Consider expired 5 minutes before actual expiry for safety
        return time.time() > (self.expires_at - 300)
    
    @property
    def time_remaining(self) -> int:
        return max(0, int(self.expires_at - time.time()))
    
    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class SalesforceOrg:
    """Salesforce org configuration"""
    name: str
    instance_url: str
    login_url: str = "https://login.salesforce.com"
    api_version: str = "v59.0"
    
    # OAuth credentials
    client_id: str = None
    client_secret: str = None
    
    # For Username/Password flow
    username: str = None
    password: str = None
    security_token: str = None
    
    # For JWT Bearer flow
    private_key_path: str = None
    private_key: str = None  # PEM encoded key
    
    # For refresh token flow
    refresh_token: str = None
    
    # Current token
    current_token: SalesforceToken = None


class SalesforceAuthService:
    """
    Centralized authentication service for Salesforce.
    
    Supports:
    - JWT Bearer Flow (for CI/CD, Docker, parallel execution)
    - OAuth Refresh Token Flow
    - Username/Password Flow (legacy)
    
    Features:
    - Automatic token refresh
    - Token pooling for parallel execution
    - Rate limit handling
    - Secure credential storage
    """
    
    def __init__(self, config_path: str = None):
        self.config_path = config_path or os.path.join(
            os.path.dirname(__file__), 
            "../../../config/salesforce_credentials.json"
        )
        self.orgs: Dict[str, SalesforceOrg] = {}
        self.default_org: str = None
        self._token_lock = asyncio.Lock()
        self._config_mtime: float = 0  # Track file modification time
        self._load_config()
    
    def reload_config_if_changed(self):
        """Reload config if the file has been modified"""
        try:
            if os.path.exists(self.config_path):
                mtime = os.path.getmtime(self.config_path)
                if mtime > self._config_mtime:
                    logger.info(f"Config file changed, reloading...")
                    self._load_config()
                    self._config_mtime = mtime
        except Exception as e:
            logger.error(f"Failed to check config file: {e}")
    
    def _load_config(self):
        """Load Salesforce configuration from file or environment"""
        # Try file-based config first
        if os.path.exists(self.config_path):
            try:
                with open(self.config_path, 'r') as f:
                    config = json.load(f)
                    self._load_from_dict(config)
                    logger.info(f"Loaded Salesforce config from {self.config_path}")
            except Exception as e:
                logger.error(f"Failed to load config from file: {e}")
        
        # Override with environment variables if present
        self._load_from_env()
    
    def _load_from_dict(self, config: Dict[str, Any]):
        """Load configuration from dictionary"""
        org = SalesforceOrg(
            name=config.get('org_name', 'default'),
            instance_url=config.get('instance_url', ''),
            login_url=config.get('login_url', 'https://login.salesforce.com'),
            client_id=config.get('client_id'),
            client_secret=config.get('client_secret'),
            username=config.get('username'),
            refresh_token=config.get('refresh_token'),
            private_key_path=config.get('private_key_path'),
            private_key=config.get('private_key'),
        )
        
        # If we have existing tokens, load them
        if config.get('access_token'):
            org.current_token = SalesforceToken(
                access_token=config['access_token'],
                instance_url=config.get('instance_url', ''),
            )
        
        self.orgs[org.name] = org
        self.default_org = org.name
    
    def _load_from_env(self):
        """Load/override configuration from environment variables"""
        # Check for environment-based config
        env_vars = {
            'SF_INSTANCE_URL': os.getenv('SF_INSTANCE_URL'),
            'SF_CLIENT_ID': os.getenv('SF_CLIENT_ID') or os.getenv('SALESFORCE_CLIENT_ID'),
            'SF_CLIENT_SECRET': os.getenv('SF_CLIENT_SECRET') or os.getenv('SALESFORCE_CLIENT_SECRET'),
            'SF_USERNAME': os.getenv('SF_USERNAME'),
            'SF_PRIVATE_KEY': os.getenv('SF_PRIVATE_KEY'),
            'SF_PRIVATE_KEY_PATH': os.getenv('SF_PRIVATE_KEY_PATH'),
            'SF_REFRESH_TOKEN': os.getenv('SF_REFRESH_TOKEN'),
        }
        
        # Only create env org if we have essential env vars
        if env_vars['SF_INSTANCE_URL'] and env_vars['SF_CLIENT_ID']:
            org = SalesforceOrg(
                name='env',
                instance_url=env_vars['SF_INSTANCE_URL'],
                client_id=env_vars['SF_CLIENT_ID'],
                client_secret=env_vars['SF_CLIENT_SECRET'],
                username=env_vars['SF_USERNAME'],
                private_key=env_vars['SF_PRIVATE_KEY'],
                private_key_path=env_vars['SF_PRIVATE_KEY_PATH'],
                refresh_token=env_vars['SF_REFRESH_TOKEN'],
            )
            self.orgs['env'] = org
            self.default_org = 'env'
            logger.info("Loaded Salesforce config from environment variables")
    
    async def get_token(self, org_name: str = None) -> SalesforceToken:
        """
        Get a valid access token for the specified org.
        Automatically refreshes if expired.
        
        Args:
            org_name: Name of the org, or None for default
            
        Returns:
            SalesforceToken with valid access_token
        """
        # Reload config if file has changed (e.g., token was refreshed externally)
        self.reload_config_if_changed()
        
        async with self._token_lock:
            org = self.orgs.get(org_name or self.default_org)
            if not org:
                raise ValueError(f"Org '{org_name or self.default_org}' not found")
            
            # Check if we have a valid token
            if org.current_token and not org.current_token.is_expired:
                return org.current_token
            
            # Need to get a new token
            logger.info(f"Obtaining new token for org: {org.name}")
            
            # Try different auth methods in order of preference
            if org.private_key or org.private_key_path:
                token = await self._jwt_bearer_auth(org)
            elif org.refresh_token:
                token = await self._refresh_token_auth(org)
            elif org.username and org.password:
                token = await self._password_auth(org)
            else:
                raise ValueError(
                    f"No valid authentication method available for org '{org.name}'. "
                    "Provide private_key (JWT), refresh_token, or username/password."
                )
            
            org.current_token = token
            return token
    
    async def _jwt_bearer_auth(self, org: SalesforceOrg) -> SalesforceToken:
        """
        Authenticate using JWT Bearer Flow.
        This is the recommended method for CI/CD and parallel execution.
        
        Requires:
        - Connected App with "Use digital signatures" enabled
        - X.509 certificate uploaded to the Connected App
        - Private key available to this service
        """
        # Load private key
        if org.private_key:
            private_key = org.private_key.encode()
        elif org.private_key_path:
            with open(org.private_key_path, 'rb') as f:
                private_key = f.read()
        else:
            raise ValueError("No private key available for JWT auth")
        
        # Create JWT assertion
        now = int(time.time())
        claims = {
            'iss': org.client_id,
            'sub': org.username,
            'aud': org.login_url,
            'exp': now + 300,  # 5 minute expiry for the assertion
        }
        
        # Sign the JWT
        try:
            assertion = jwt.encode(
                claims,
                private_key,
                algorithm='RS256'
            )
        except Exception as e:
            raise ValueError(f"Failed to create JWT assertion: {e}")
        
        # Exchange JWT for access token
        token_url = f"{org.login_url}/services/oauth2/token"
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                token_url,
                data={
                    'grant_type': 'urn:ietf:params:oauth:grant-type:jwt-bearer',
                    'assertion': assertion,
                }
            )
            
            if response.status_code != 200:
                error = response.json()
                raise ValueError(
                    f"JWT auth failed: {error.get('error_description', error)}"
                )
            
            result = response.json()
            
            return SalesforceToken(
                access_token=result['access_token'],
                instance_url=result['instance_url'],
                token_type=result.get('token_type', 'Bearer'),
                scope=result.get('scope'),
                id_url=result.get('id'),
            )
    
    async def _refresh_token_auth(self, org: SalesforceOrg) -> SalesforceToken:
        """
        Authenticate using OAuth Refresh Token Flow.
        Good for scenarios where you have a pre-authorized refresh token.
        """
        token_url = f"{org.login_url}/services/oauth2/token"
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                token_url,
                data={
                    'grant_type': 'refresh_token',
                    'refresh_token': org.refresh_token,
                    'client_id': org.client_id,
                    'client_secret': org.client_secret or '',
                }
            )
            
            if response.status_code != 200:
                error = response.json()
                raise ValueError(
                    f"Refresh token auth failed: {error.get('error_description', error)}"
                )
            
            result = response.json()
            
            # Update refresh token if a new one was issued
            if result.get('refresh_token'):
                org.refresh_token = result['refresh_token']
            
            return SalesforceToken(
                access_token=result['access_token'],
                instance_url=result.get('instance_url', org.instance_url),
                token_type=result.get('token_type', 'Bearer'),
                scope=result.get('scope'),
                id_url=result.get('id'),
            )
    
    async def _password_auth(self, org: SalesforceOrg) -> SalesforceToken:
        """
        Authenticate using Username/Password Flow.
        Legacy method, not recommended for production/CI.
        """
        token_url = f"{org.login_url}/services/oauth2/token"
        
        password = org.password
        if org.security_token:
            password += org.security_token
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                token_url,
                data={
                    'grant_type': 'password',
                    'client_id': org.client_id,
                    'client_secret': org.client_secret or '',
                    'username': org.username,
                    'password': password,
                }
            )
            
            if response.status_code != 200:
                error = response.json()
                raise ValueError(
                    f"Password auth failed: {error.get('error_description', error)}"
                )
            
            result = response.json()
            
            return SalesforceToken(
                access_token=result['access_token'],
                instance_url=result['instance_url'],
                token_type=result.get('token_type', 'Bearer'),
                scope=result.get('scope'),
                id_url=result.get('id'),
            )
    
    def add_org(self, org: SalesforceOrg) -> None:
        """Add a new org configuration"""
        self.orgs[org.name] = org
        if not self.default_org:
            self.default_org = org.name
    
    def set_default_org(self, org_name: str) -> None:
        """Set the default org"""
        if org_name not in self.orgs:
            raise ValueError(f"Org '{org_name}' not found")
        self.default_org = org_name
    
    def get_org(self, org_name: str = None) -> SalesforceOrg:
        """Get org configuration"""
        return self.orgs.get(org_name or self.default_org)
    
    def list_orgs(self) -> List[str]:
        """List all configured orgs"""
        return list(self.orgs.keys())
    
    async def validate_token(self, token: SalesforceToken) -> bool:
        """Validate that a token is still working"""
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{token.instance_url}/services/data/v59.0/",
                    headers={'Authorization': f'Bearer {token.access_token}'}
                )
                return response.status_code == 200
        except Exception:
            return False


# Singleton instance
_auth_service: SalesforceAuthService = None


def get_auth_service() -> SalesforceAuthService:
    """Get the singleton auth service instance"""
    global _auth_service
    if _auth_service is None:
        _auth_service = SalesforceAuthService()
    return _auth_service


# ============================================================================
# TOKEN POOL FOR PARALLEL EXECUTION
# ============================================================================

class TokenPool:
    """
    Manages a pool of Salesforce tokens for parallel test execution.
    
    Use cases:
    - Multiple Docker containers running tests simultaneously
    - CI/CD pipeline with parallel jobs
    - Load testing scenarios
    
    Features:
    - Pre-warms tokens before tests start
    - Distributes tokens across runners
    - Handles token exhaustion gracefully
    - Rate limit aware
    """
    
    def __init__(
        self, 
        auth_service: SalesforceAuthService,
        pool_size: int = 5,
        org_name: str = None
    ):
        self.auth_service = auth_service
        self.pool_size = pool_size
        self.org_name = org_name
        self.tokens: List[SalesforceToken] = []
        self.token_index = 0
        self._lock = asyncio.Lock()
    
    async def initialize(self) -> None:
        """Pre-warm the token pool"""
        logger.info(f"Initializing token pool with {self.pool_size} tokens")
        
        # For JWT flow, we can get multiple tokens
        # For refresh token flow, we typically get one token but can distribute it
        for i in range(self.pool_size):
            try:
                token = await self.auth_service.get_token(self.org_name)
                self.tokens.append(token)
            except Exception as e:
                logger.error(f"Failed to obtain token {i+1}: {e}")
                if not self.tokens:
                    raise  # Must have at least one token
        
        logger.info(f"Token pool initialized with {len(self.tokens)} tokens")
    
    async def acquire(self) -> SalesforceToken:
        """
        Acquire a token from the pool.
        Uses round-robin distribution for load balancing.
        """
        async with self._lock:
            if not self.tokens:
                raise RuntimeError("Token pool is empty")
            
            # Round-robin distribution
            token = self.tokens[self.token_index % len(self.tokens)]
            self.token_index += 1
            
            # Check if token needs refresh
            if token.is_expired:
                new_token = await self.auth_service.get_token(self.org_name)
                idx = self.tokens.index(token)
                self.tokens[idx] = new_token
                return new_token
            
            return token
    
    async def release(self, token: SalesforceToken) -> None:
        """Release a token back to the pool (no-op for shared tokens)"""
        pass  # Tokens are shared, nothing to release
    
    @property
    def available_count(self) -> int:
        """Number of available tokens"""
        return len([t for t in self.tokens if not t.is_expired])

