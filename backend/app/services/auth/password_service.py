"""
Password Hashing & Validation Service
Enterprise-grade password security for on-prem deployments where Supabase auth is not available.

Uses bcrypt for password hashing (industry standard, resistant to rainbow table attacks).
Enforces configurable password policy (minimum length, complexity requirements).

Usage:
    from app.services.auth.password_service import password_service

    hashed = password_service.hash_password("my-secure-password")
    is_valid = password_service.verify_password("my-secure-password", hashed)
    errors = password_service.validate_strength("weak")
"""

import logging
import os
import re
import hashlib
from typing import List, Optional

logger = logging.getLogger(__name__)

# Try to import passlib with bcrypt; fall back to hashlib-based hashing
try:
    from passlib.context import CryptContext
    _pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
    _HAS_PASSLIB = True
    logger.info("[PasswordService] Using passlib+bcrypt for password hashing")
except ImportError:
    _HAS_PASSLIB = False
    logger.warning(
        "[PasswordService] passlib not installed — using SHA-512 fallback. "
        "Install passlib[bcrypt] for production: pip install passlib[bcrypt]"
    )

# Password policy configuration (via environment variables)
MIN_PASSWORD_LENGTH = int(os.getenv("PASSWORD_MIN_LENGTH", "12"))
REQUIRE_UPPERCASE = os.getenv("PASSWORD_REQUIRE_UPPERCASE", "true").lower() == "true"
REQUIRE_LOWERCASE = os.getenv("PASSWORD_REQUIRE_LOWERCASE", "true").lower() == "true"
REQUIRE_DIGIT = os.getenv("PASSWORD_REQUIRE_DIGIT", "true").lower() == "true"
REQUIRE_SPECIAL = os.getenv("PASSWORD_REQUIRE_SPECIAL", "true").lower() == "true"

# Common passwords to reject (top 20)
_COMMON_PASSWORDS = {
    "password", "123456", "12345678", "qwerty", "abc123",
    "monkey", "1234567", "letmein", "trustno1", "dragon",
    "baseball", "iloveyou", "master", "sunshine", "ashley",
    "bailey", "shadow", "123123", "654321", "superman",
    "password1", "password123", "admin", "admin123", "root",
}


class PasswordService:
    """
    Service for password hashing, verification, and strength validation.
    Uses bcrypt (via passlib) when available, SHA-512 fallback otherwise.
    """

    def hash_password(self, password: str) -> str:
        """
        Hash a plaintext password using bcrypt.

        Args:
            password: Plaintext password

        Returns:
            Hashed password string (bcrypt format)
        """
        if _HAS_PASSLIB:
            return _pwd_context.hash(password)
        else:
            # SHA-512 fallback with salt (not as secure as bcrypt but functional)
            import secrets
            salt = secrets.token_hex(32)
            hash_val = hashlib.sha512((salt + password).encode()).hexdigest()
            return f"sha512${salt}${hash_val}"

    def verify_password(self, password: str, hashed: str) -> bool:
        """
        Verify a plaintext password against a hash.

        Args:
            password: Plaintext password to check
            hashed: Previously hashed password

        Returns:
            True if password matches
        """
        if _HAS_PASSLIB:
            try:
                return _pwd_context.verify(password, hashed)
            except Exception as e:
                logger.error(f"Password verification error: {e}")
                return False
        else:
            # SHA-512 fallback verification
            if not hashed.startswith("sha512$"):
                return False
            parts = hashed.split("$")
            if len(parts) != 3:
                return False
            _, salt, expected_hash = parts
            actual_hash = hashlib.sha512((salt + password).encode()).hexdigest()
            # Constant-time comparison to prevent timing attacks
            return hashlib.sha256(actual_hash.encode()).digest() == hashlib.sha256(expected_hash.encode()).digest()

    def validate_strength(self, password: str) -> List[str]:
        """
        Validate password against the configured password policy.

        Args:
            password: Password to validate

        Returns:
            List of validation error messages (empty = password is strong enough)
        """
        errors = []

        if len(password) < MIN_PASSWORD_LENGTH:
            errors.append(f"Password must be at least {MIN_PASSWORD_LENGTH} characters")

        if REQUIRE_UPPERCASE and not re.search(r'[A-Z]', password):
            errors.append("Password must contain at least one uppercase letter")

        if REQUIRE_LOWERCASE and not re.search(r'[a-z]', password):
            errors.append("Password must contain at least one lowercase letter")

        if REQUIRE_DIGIT and not re.search(r'\d', password):
            errors.append("Password must contain at least one digit")

        if REQUIRE_SPECIAL and not re.search(r'[!@#$%^&*()_+\-=\[\]{};:\'",.<>?/\\|`~]', password):
            errors.append("Password must contain at least one special character")

        # Check against common passwords
        if password.lower() in _COMMON_PASSWORDS:
            errors.append("This password is too common. Please choose a more unique password")

        return errors

    def needs_rehash(self, hashed: str) -> bool:
        """
        Check if a password hash needs to be re-hashed (e.g., algorithm upgrade).

        Args:
            hashed: Existing password hash

        Returns:
            True if the hash should be updated
        """
        if _HAS_PASSLIB:
            return _pwd_context.needs_update(hashed)
        return hashed.startswith("sha512$")  # Always rehash SHA-512 if bcrypt is available


# Global instance
password_service = PasswordService()
