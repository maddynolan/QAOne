"""
MFA (Multi-Factor Authentication) API Router
Provides TOTP enrollment, verification, and recovery code management.

Endpoints:
    POST /api/mfa/enroll          — Generate TOTP secret + QR code
    POST /api/mfa/verify-setup    — Verify first TOTP code to complete enrollment
    POST /api/mfa/verify          — Verify TOTP code during login
    POST /api/mfa/recovery-codes  — Generate new recovery codes
    POST /api/mfa/verify-recovery — Verify a recovery code
    DELETE /api/mfa/disable       — Disable MFA for current user
    GET /api/mfa/status           — Check MFA status for current user
"""

import logging
from typing import Dict, Any, List, Optional
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from app.services.auth.mfa_service import mfa_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/mfa", tags=["MFA"])

# In-memory MFA state (should be moved to PostgreSQL for production)
# Key: user_id -> {secret, enabled, recovery_codes_hashed}
_mfa_state: Dict[str, Dict[str, Any]] = {}


class EnrollResponse(BaseModel):
    secret: str
    otpauth_uri: str
    qr_code_base64: Optional[str] = None


class VerifyRequest(BaseModel):
    code: str


class RecoveryCodesResponse(BaseModel):
    codes: List[str]
    message: str


def _get_user_id(request: Request) -> str:
    """Extract user_id from request state."""
    user_id = getattr(request.state, "user_id", None)
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")
    return user_id


@router.post("/enroll", response_model=EnrollResponse)
async def enroll_mfa(request: Request):
    """
    Start MFA enrollment — generates TOTP secret and QR code.
    User must verify with /verify-setup to complete enrollment.
    """
    user_id = _get_user_id(request)
    email = getattr(request.state, "email", user_id)

    # Check if already enrolled
    if user_id in _mfa_state and _mfa_state[user_id].get("enabled"):
        raise HTTPException(status_code=400, detail="MFA is already enabled. Disable first to re-enroll.")

    secret, uri, qr_b64 = mfa_service.generate_secret(email)

    # Store pending enrollment (not yet enabled)
    _mfa_state[user_id] = {
        "secret": secret,
        "enabled": False,
        "recovery_codes_hashed": [],
    }

    logger.info(f"[MFA] Enrollment started for user {user_id}")
    return EnrollResponse(secret=secret, otpauth_uri=uri, qr_code_base64=qr_b64)


@router.post("/verify-setup")
async def verify_setup(request: Request, body: VerifyRequest):
    """
    Complete MFA enrollment by verifying the first TOTP code.
    Also generates recovery codes.
    """
    user_id = _get_user_id(request)

    state = _mfa_state.get(user_id)
    if not state or not state.get("secret"):
        raise HTTPException(status_code=400, detail="No pending MFA enrollment. Call /enroll first.")

    if state.get("enabled"):
        raise HTTPException(status_code=400, detail="MFA is already enabled.")

    # Verify the code
    if not mfa_service.verify_totp(state["secret"], body.code):
        raise HTTPException(status_code=400, detail="Invalid code. Please try again with your authenticator app.")

    # Generate recovery codes
    codes = mfa_service.generate_recovery_codes()
    hashed = [mfa_service.hash_recovery_code(c) for c in codes]

    # Enable MFA
    _mfa_state[user_id]["enabled"] = True
    _mfa_state[user_id]["recovery_codes_hashed"] = hashed

    logger.info(f"[MFA] Enrollment completed for user {user_id}")
    return {
        "message": "MFA enabled successfully",
        "recovery_codes": codes,
        "warning": "Save these recovery codes securely. They cannot be shown again."
    }


@router.post("/verify")
async def verify_mfa(request: Request, body: VerifyRequest):
    """
    Verify a TOTP code during login or sensitive operation.
    """
    user_id = _get_user_id(request)

    state = _mfa_state.get(user_id)
    if not state or not state.get("enabled"):
        raise HTTPException(status_code=400, detail="MFA is not enabled for this account.")

    if mfa_service.verify_totp(state["secret"], body.code):
        logger.info(f"[MFA] Verification successful for user {user_id}")
        return {"verified": True, "message": "MFA verification successful"}
    else:
        logger.warning(f"[MFA] Verification failed for user {user_id}")
        raise HTTPException(status_code=401, detail="Invalid MFA code")


@router.post("/verify-recovery")
async def verify_recovery(request: Request, body: VerifyRequest):
    """
    Verify a one-time recovery code (burns the code on success).
    """
    user_id = _get_user_id(request)

    state = _mfa_state.get(user_id)
    if not state or not state.get("enabled"):
        raise HTTPException(status_code=400, detail="MFA is not enabled for this account.")

    hashed_codes = state.get("recovery_codes_hashed", [])
    match_idx = mfa_service.verify_recovery_code(body.code, hashed_codes)

    if match_idx is not None:
        # Burn the used code
        hashed_codes.pop(match_idx)
        remaining = len(hashed_codes)
        logger.info(f"[MFA] Recovery code used for user {user_id} ({remaining} remaining)")
        return {
            "verified": True,
            "remaining_codes": remaining,
            "message": f"Recovery code accepted. {remaining} recovery codes remaining."
        }
    else:
        logger.warning(f"[MFA] Invalid recovery code for user {user_id}")
        raise HTTPException(status_code=401, detail="Invalid recovery code")


@router.post("/recovery-codes", response_model=RecoveryCodesResponse)
async def regenerate_recovery_codes(request: Request, body: VerifyRequest):
    """
    Generate new recovery codes (requires current TOTP code for verification).
    Replaces all existing recovery codes.
    """
    user_id = _get_user_id(request)

    state = _mfa_state.get(user_id)
    if not state or not state.get("enabled"):
        raise HTTPException(status_code=400, detail="MFA is not enabled.")

    # Require TOTP verification to regenerate codes
    if not mfa_service.verify_totp(state["secret"], body.code):
        raise HTTPException(status_code=401, detail="Invalid MFA code. Cannot regenerate recovery codes.")

    codes = mfa_service.generate_recovery_codes()
    hashed = [mfa_service.hash_recovery_code(c) for c in codes]
    _mfa_state[user_id]["recovery_codes_hashed"] = hashed

    logger.info(f"[MFA] Recovery codes regenerated for user {user_id}")
    return RecoveryCodesResponse(
        codes=codes,
        message="New recovery codes generated. Save them securely — old codes are invalidated."
    )


@router.delete("/disable")
async def disable_mfa(request: Request, body: VerifyRequest):
    """
    Disable MFA for current user (requires current TOTP code).
    """
    user_id = _get_user_id(request)

    state = _mfa_state.get(user_id)
    if not state or not state.get("enabled"):
        raise HTTPException(status_code=400, detail="MFA is not enabled.")

    # Require TOTP verification to disable
    if not mfa_service.verify_totp(state["secret"], body.code):
        raise HTTPException(status_code=401, detail="Invalid MFA code. Cannot disable MFA.")

    del _mfa_state[user_id]
    logger.info(f"[MFA] Disabled for user {user_id}")
    return {"message": "MFA has been disabled"}


@router.get("/status")
async def mfa_status(request: Request):
    """
    Check MFA status for the current user.
    """
    user_id = _get_user_id(request)
    state = _mfa_state.get(user_id, {})

    return {
        "enabled": state.get("enabled", False),
        "recovery_codes_remaining": len(state.get("recovery_codes_hashed", [])),
    }
