"""
Multi-Factor Authentication (MFA) Service
Implements TOTP (Time-based One-Time Password) for enterprise deployments.

Required for: SOC 2, HIPAA, PCI-DSS, ISO 27001 compliance.

Usage:
    from app.services.auth.mfa_service import mfa_service

    # Enrollment
    secret, uri, qr_b64 = mfa_service.generate_secret("user@example.com")
    is_valid = mfa_service.verify_totp(secret, "123456")

    # Recovery codes
    codes = mfa_service.generate_recovery_codes()
"""

import base64
import hashlib
import hmac
import io
import logging
import os
import secrets
import struct
import time
from typing import Any, Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)

# Try to import pyotp for TOTP; fall back to manual implementation
try:
    import pyotp
    _HAS_PYOTP = True
    logger.info("[MFA] Using pyotp for TOTP generation")
except ImportError:
    _HAS_PYOTP = False
    logger.warning("[MFA] pyotp not installed — using built-in TOTP. pip install pyotp for production.")

# Try to import qrcode for QR code generation
try:
    import qrcode
    _HAS_QRCODE = True
except ImportError:
    _HAS_QRCODE = False
    logger.info("[MFA] qrcode not installed — QR codes will not be generated. pip install qrcode[pil]")

# Configuration
MFA_ISSUER = os.getenv("MFA_ISSUER", "Flowstral")
TOTP_DIGITS = 6
TOTP_PERIOD = 30  # seconds
TOTP_ALGORITHM = "SHA1"  # Standard for Google Authenticator compatibility
RECOVERY_CODE_COUNT = 10
RECOVERY_CODE_LENGTH = 8


def _manual_totp(secret_b32: str, time_step: Optional[int] = None) -> str:
    """
    Manual TOTP implementation (RFC 6238) for when pyotp is not available.
    """
    if time_step is None:
        time_step = int(time.time()) // TOTP_PERIOD

    # Decode base32 secret
    key = base64.b32decode(secret_b32.upper())
    # Pack time step as big-endian 8-byte integer
    msg = struct.pack(">Q", time_step)
    # HMAC-SHA1
    h = hmac.new(key, msg, hashlib.sha1).digest()
    # Dynamic truncation
    offset = h[-1] & 0x0F
    code = struct.unpack(">I", h[offset:offset + 4])[0] & 0x7FFFFFFF
    return str(code % (10 ** TOTP_DIGITS)).zfill(TOTP_DIGITS)


class MFAService:
    """
    Service for TOTP-based Multi-Factor Authentication.
    Compatible with Google Authenticator, Authy, 1Password, etc.
    """

    def generate_secret(self, email: str) -> Tuple[str, str, Optional[str]]:
        """
        Generate a new TOTP secret for MFA enrollment.

        Args:
            email: User's email (displayed in authenticator app)

        Returns:
            Tuple of (base32_secret, otpauth_uri, qr_code_base64_or_None)
        """
        if _HAS_PYOTP:
            secret = pyotp.random_base32(32)
            totp = pyotp.TOTP(secret)
            uri = totp.provisioning_uri(name=email, issuer_name=MFA_ISSUER)
        else:
            # Generate 20-byte random secret, encode as base32
            raw = secrets.token_bytes(20)
            secret = base64.b32encode(raw).decode().rstrip("=")
            # Build otpauth URI manually
            uri = (
                f"otpauth://totp/{MFA_ISSUER}:{email}"
                f"?secret={secret}&issuer={MFA_ISSUER}"
                f"&algorithm={TOTP_ALGORITHM}&digits={TOTP_DIGITS}&period={TOTP_PERIOD}"
            )

        # Generate QR code if qrcode library is available
        qr_b64 = None
        if _HAS_QRCODE:
            try:
                qr = qrcode.QRCode(version=1, box_size=10, border=4)
                qr.add_data(uri)
                qr.make(fit=True)
                img = qr.make_image(fill_color="black", back_color="white")
                buffer = io.BytesIO()
                img.save(buffer, format="PNG")
                qr_b64 = base64.b64encode(buffer.getvalue()).decode()
            except Exception as e:
                logger.warning(f"[MFA] QR code generation failed: {e}")

        logger.info(f"[MFA] Generated TOTP secret for {email}")
        return secret, uri, qr_b64

    def verify_totp(self, secret: str, code: str, window: int = 1) -> bool:
        """
        Verify a TOTP code against a secret.

        Args:
            secret: Base32-encoded secret
            code: 6-digit TOTP code from authenticator app
            window: Number of time steps to check before/after current (default: 1)

        Returns:
            True if the code is valid
        """
        if not code or len(code) != TOTP_DIGITS:
            return False

        if _HAS_PYOTP:
            totp = pyotp.TOTP(secret)
            return totp.verify(code, valid_window=window)
        else:
            # Manual verification with time window
            current_step = int(time.time()) // TOTP_PERIOD
            for offset in range(-window, window + 1):
                expected = _manual_totp(secret, current_step + offset)
                if hmac.compare_digest(expected, code):
                    return True
            return False

    def generate_recovery_codes(self, count: int = RECOVERY_CODE_COUNT) -> List[str]:
        """
        Generate one-time recovery codes for MFA backup.

        Args:
            count: Number of recovery codes to generate

        Returns:
            List of recovery code strings (e.g., ["ABCD-EFGH", ...])
        """
        codes = []
        for _ in range(count):
            # Generate random alphanumeric code
            raw = secrets.token_hex(RECOVERY_CODE_LENGTH // 2).upper()
            # Format as XXXX-XXXX for readability
            formatted = f"{raw[:4]}-{raw[4:]}"
            codes.append(formatted)
        return codes

    def hash_recovery_code(self, code: str) -> str:
        """
        Hash a recovery code for storage (don't store plaintext).

        Args:
            code: Recovery code to hash

        Returns:
            SHA-256 hash of the normalized code
        """
        normalized = code.upper().replace("-", "").replace(" ", "")
        return hashlib.sha256(normalized.encode()).hexdigest()

    def verify_recovery_code(self, code: str, hashed_codes: List[str]) -> Optional[int]:
        """
        Verify a recovery code against stored hashes.

        Args:
            code: Recovery code to verify
            hashed_codes: List of hashed recovery codes

        Returns:
            Index of matching code (for removal), or None if no match
        """
        code_hash = self.hash_recovery_code(code)
        for i, stored_hash in enumerate(hashed_codes):
            if hmac.compare_digest(code_hash, stored_hash):
                return i
        return None


# ── MFA Enforcement Policy ──
# In-memory policy store (should be PostgreSQL for production multi-instance)
# Key: org_id -> enforcement settings
_enforcement_policies: Dict[str, Dict[str, Any]] = {}

# Default policy: MFA required for admin/owner roles
DEFAULT_ENFORCEMENT_POLICY = {
    "enabled": True,
    "required_roles": ["owner", "admin"],  # Roles that MUST have MFA
    "recommended_roles": ["member"],  # Roles where MFA is recommended but not enforced
    "grace_period_days": 14,  # Days before enforcement kicks in for new users
    "allow_recovery_bypass": True,  # Allow recovery codes to bypass MFA
}


def is_mfa_required(role: str, org_id: Optional[str] = None) -> bool:
    """
    Check if MFA is required for a given role in an organization.

    Args:
        role: User's role (owner, admin, member, viewer)
        org_id: Organization ID (uses default policy if not found)

    Returns:
        True if MFA is required for this role
    """
    policy = _enforcement_policies.get(org_id, DEFAULT_ENFORCEMENT_POLICY) if org_id else DEFAULT_ENFORCEMENT_POLICY
    if not policy.get("enabled", True):
        return False
    required_roles = policy.get("required_roles", ["owner", "admin"])
    return role.lower() in [r.lower() for r in required_roles]


def get_enforcement_policy(org_id: Optional[str] = None) -> Dict[str, Any]:
    """
    Get the MFA enforcement policy for an organization.

    Args:
        org_id: Organization ID

    Returns:
        Policy dict with enabled, required_roles, recommended_roles, grace_period_days
    """
    if org_id and org_id in _enforcement_policies:
        return _enforcement_policies[org_id]
    return DEFAULT_ENFORCEMENT_POLICY.copy()


def set_enforcement_policy(org_id: str, policy: Dict[str, Any]) -> Dict[str, Any]:
    """
    Set the MFA enforcement policy for an organization.

    Args:
        org_id: Organization ID
        policy: Policy settings to merge with defaults

    Returns:
        Updated policy dict
    """
    current = _enforcement_policies.get(org_id, DEFAULT_ENFORCEMENT_POLICY.copy())
    # Merge provided fields with current/default policy
    for key in ["enabled", "required_roles", "recommended_roles", "grace_period_days", "allow_recovery_bypass"]:
        if key in policy:
            current[key] = policy[key]
    _enforcement_policies[org_id] = current
    logger.info(f"[MFA] Enforcement policy updated for org {org_id}: required_roles={current.get('required_roles')}")
    return current


# Global instance
mfa_service = MFAService()
