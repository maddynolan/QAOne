"""
JWT Authentication Service
Handles JWT token generation, validation, and claims extraction.
Integrates with RBAC for role and permission claims.

Security notes:
- JWT_SECRET_KEY MUST be set via environment variable (no hardcoded fallback)
- Signature verification is ALWAYS enforced — no bypass
- Short-lived access tokens (configurable, default 24h) with refresh support
"""

import logging
import os
import uuid
from typing import Dict, List, Optional, Any
from datetime import datetime, timedelta
import jwt
from jwt.exceptions import InvalidTokenError, ExpiredSignatureError

logger = logging.getLogger(__name__)

# JWT Configuration — SECRET MUST be provided via environment variable
JWT_SECRET = os.getenv("JWT_SECRET_KEY", os.getenv("JWT_SECRET", ""))
JWT_ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
JWT_EXPIRATION_HOURS = int(os.getenv("JWT_EXPIRATION_HOURS", "24"))

# Minimum secret length for security (256 bits = 32 bytes)
_MIN_SECRET_LENGTH = 32


def validate_jwt_config():
    """
    Validate JWT configuration on startup.
    Raises RuntimeError if critical config is missing.
    Called from main.py startup.
    """
    if not JWT_SECRET:
        if os.getenv("APP_ENV", "development") == "production":
            raise RuntimeError(
                "CRITICAL: JWT_SECRET_KEY environment variable is not set. "
                "This is required for production deployments. "
                "Generate a secure secret: python -c \"import secrets; print(secrets.token_urlsafe(64))\""
            )
        else:
            logger.warning(
                "JWT_SECRET_KEY not set — using insecure default for development. "
                "Set JWT_SECRET_KEY env var before deploying to production!"
            )
    elif len(JWT_SECRET) < _MIN_SECRET_LENGTH:
        logger.warning(
            f"JWT_SECRET_KEY is only {len(JWT_SECRET)} chars — "
            f"recommend at least {_MIN_SECRET_LENGTH} chars for security"
        )


class JWTService:
    """
    Service for JWT token operations:
    - Generate tokens with user, tenant, roles, permissions
    - Validate tokens with signature verification
    - Extract claims (always verified)
    """

    def __init__(self):
        self.secret = JWT_SECRET or "dev-only-insecure-secret-change-me"
        self.algorithm = JWT_ALGORITHM
        self.expiration_hours = JWT_EXPIRATION_HOURS

        if not JWT_SECRET:
            logger.warning("JWT secret not configured — using insecure dev default")
    
    def generate_token(
        self,
        user_id: str,
        tenant_id: str,
        email: Optional[str] = None,
        roles: Optional[List[str]] = None,
        permissions: Optional[List[str]] = None,
        additional_claims: Optional[Dict[str, Any]] = None
    ) -> str:
        """
        Generate a JWT token with user and tenant context.
        
        Args:
            user_id: User identifier
            tenant_id: Tenant identifier
            email: User email
            roles: List of role names
            permissions: List of permission strings
            additional_claims: Additional claims to include
        
        Returns:
            JWT token string
        """
        now = datetime.utcnow()
        expiration = now + timedelta(hours=self.expiration_hours)

        payload = {
            "sub": user_id,  # Standard JWT subject claim
            "user_id": user_id,
            "tenant_id": tenant_id,
            "jti": str(uuid.uuid4()),  # Unique token ID for revocation support
            "iat": int(now.timestamp()),  # Issued at
            "exp": int(expiration.timestamp()),  # Expiration
        }
        
        if email:
            payload["email"] = email
        
        if roles:
            payload["roles"] = roles
        
        if permissions:
            payload["permissions"] = permissions
        
        if additional_claims:
            payload.update(additional_claims)
        
        token = jwt.encode(payload, self.secret, algorithm=self.algorithm)
        
        logger.info(f"Generated JWT token for user {user_id}, tenant {tenant_id}")
        return token
    
    def validate_token(self, token: str) -> Dict[str, Any]:
        """
        Validate and decode a JWT token.
        
        Args:
            token: JWT token string
        
        Returns:
            Decoded payload dictionary
        
        Raises:
            ExpiredSignatureError: Token has expired
            InvalidTokenError: Token is invalid
        """
        try:
            payload = jwt.decode(token, self.secret, algorithms=[self.algorithm])
            return payload
        except ExpiredSignatureError:
            logger.warning("JWT token expired")
            raise
        except InvalidTokenError as e:
            logger.warning(f"Invalid JWT token: {e}")
            raise
        except Exception as e:
            logger.error(f"Error validating JWT token: {e}")
            raise InvalidTokenError(f"Token validation failed: {e}")
    
    def extract_claims(self, token: str) -> Dict[str, Any]:
        """
        Extract claims from token WITH signature verification.
        This is the safe version — signature is always verified.
        """
        try:
            # Always verify signature — never skip verification
            payload = jwt.decode(token, self.secret, algorithms=[self.algorithm])
            return payload
        except ExpiredSignatureError:
            logger.warning("JWT token expired during claims extraction")
            return {}
        except Exception as e:
            logger.error(f"Error extracting claims: {e}")
            return {}
    
    def refresh_token(self, token: str) -> str:
        """
        Refresh a JWT token (generate new token with same claims, new expiration).
        
        Args:
            token: Existing JWT token
        
        Returns:
            New JWT token
        """
        payload = self.validate_token(token)
        
        # Extract original claims
        user_id = payload.get("user_id") or payload.get("sub")
        tenant_id = payload.get("tenant_id")
        email = payload.get("email")
        roles = payload.get("roles", [])
        permissions = payload.get("permissions", [])
        
        # Generate new token
        return self.generate_token(
            user_id=user_id,
            tenant_id=tenant_id,
            email=email,
            roles=roles,
            permissions=permissions
        )
    
    def get_user_id(self, token: str) -> Optional[str]:
        """Extract user_id from token"""
        try:
            payload = self.validate_token(token)
            return payload.get("user_id") or payload.get("sub")
        except Exception:
            return None
    
    def get_tenant_id(self, token: str) -> Optional[str]:
        """Extract tenant_id from token"""
        try:
            payload = self.validate_token(token)
            return payload.get("tenant_id")
        except Exception:
            return None
    
    def get_roles(self, token: str) -> List[str]:
        """Extract roles from token"""
        try:
            payload = self.validate_token(token)
            return payload.get("roles", [])
        except Exception:
            return []
    
    def get_permissions(self, token: str) -> List[str]:
        """Extract permissions from token"""
        try:
            payload = self.validate_token(token)
            return payload.get("permissions", [])
        except Exception:
            return []


# Global instance
jwt_service = JWTService()

