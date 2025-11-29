"""
JWT Authentication Service
Handles JWT token generation, validation, and claims extraction.
Integrates with RBAC for role and permission claims.
"""

import logging
import os
from typing import Dict, List, Optional, Any
from datetime import datetime, timedelta
import jwt
from jwt.exceptions import InvalidTokenError, ExpiredSignatureError

logger = logging.getLogger(__name__)

# JWT Configuration
JWT_SECRET = os.getenv("JWT_SECRET", "your-secret-key-change-in-production")
JWT_ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
JWT_EXPIRATION_HOURS = int(os.getenv("JWT_EXPIRATION_HOURS", "24"))


class JWTService:
    """
    Service for JWT token operations:
    - Generate tokens with user, tenant, roles, permissions
    - Validate tokens
    - Extract claims
    """
    
    def __init__(self):
        self.secret = JWT_SECRET
        self.algorithm = JWT_ALGORITHM
        self.expiration_hours = JWT_EXPIRATION_HOURS
        
        if self.secret == "your-secret-key-change-in-production":
            logger.warning("Using default JWT secret - change in production!")
    
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
        Extract claims from token without validation (for debugging).
        Use validate_token() for production.
        """
        try:
            # Decode without verification (for debugging only)
            payload = jwt.decode(token, options={"verify_signature": False})
            return payload
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

