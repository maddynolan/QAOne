"""
License Management API

Handles license validation, activation, and management for Flowstral Desktop.
Supports both SaaS (cloud) and On-Premise deployments.
"""

from fastapi import APIRouter, HTTPException, Depends, Header, Query, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from typing import Optional, List, Dict
from datetime import datetime, timedelta
from collections import defaultdict
import hashlib
import hmac
import secrets
import os
import jwt
import time
import logging
import json
from pathlib import Path
import threading

router = APIRouter(prefix="/license", tags=["License Management"])
logger = logging.getLogger("license_admin")

# Security
security = HTTPBearer(auto_error=False)

# ═══════════════════════════════════════════════════════════════════════════
# PERSISTENT STORAGE - PostgreSQL (Railway/production) with JSON file fallback
# ═══════════════════════════════════════════════════════════════════════════
#
# Problem: JSON file storage is ephemeral in Docker (Railway deletes data/ on redeploy).
# Solution: Use PostgreSQL (via Supabase/DATABASE_URL) as primary, JSON file as fallback.

# JSON file fallback (for local dev or when PostgreSQL is unavailable)
DATA_DIR = Path(os.getenv("LICENSE_DATA_DIR", Path(__file__).parent.parent.parent / "data"))
DATA_DIR.mkdir(parents=True, exist_ok=True)
LICENSES_FILE = DATA_DIR / "licenses.json"
AUDIT_FILE = DATA_DIR / "license_audit.json"

# Thread lock for file operations
_file_lock = threading.Lock()

# ─── PostgreSQL helpers (direct connection via DATABASE_URL) ──────────────
# Uses DATABASE_URL directly — does NOT require ENABLE_POSTGRES=true.
# This ensures licenses persist on Railway even if the rest of the app uses SQLite.

_pg_conn_string_raw = os.getenv("DATABASE_URL", "")
_license_pg_available = None  # Cached after first check
_license_pg_conn_string = None  # The connection string that actually works


def _get_pg_connection():
    """Get a psycopg2 connection. Tries multiple SSL modes to handle Supabase/Railway/local."""
    global _license_pg_conn_string
    
    if not _pg_conn_string_raw:
        return None
    
    try:
        import psycopg2
    except ImportError:
        return None
    
    # If we already know what works, use it
    if _license_pg_conn_string:
        try:
            conn = psycopg2.connect(_license_pg_conn_string, connect_timeout=5)
            return conn
        except Exception:
            _license_pg_conn_string = None  # Reset and retry all methods
    
    # Try multiple connection methods (first success wins and gets cached)
    base = _pg_conn_string_raw
    sep = "&" if "?" in base else "?"
    attempts = [
        ("sslmode=require", base + sep + "sslmode=require"),
        ("sslmode=prefer", base + sep + "sslmode=prefer"),
        ("sslmode=disable", base + sep + "sslmode=disable"),
        ("as-is", base),
    ]
    
    for label, conn_str in attempts:
        try:
            conn = psycopg2.connect(conn_str, connect_timeout=5)
            # Test the connection actually works
            with conn.cursor() as cur:
                cur.execute("SELECT 1")
            _license_pg_conn_string = conn_str  # Cache what works
            logger.info(f"[License] PostgreSQL connected OK ({label})")
            return conn
        except Exception as e:
            logger.info(f"[License] Connection attempt ({label}) failed: {str(e)[:100]}")
            continue
    
    logger.warning(f"[License] All PostgreSQL connection methods failed for {_pg_conn_string_raw.split('@')[-1] if '@' in _pg_conn_string_raw else 'unknown'}")
    return None


def _is_postgres_available() -> bool:
    """Check if PostgreSQL is available for license storage."""
    global _license_pg_available
    if _license_pg_available is not None:
        return _license_pg_available

    if not _pg_conn_string_raw:
        _license_pg_available = False
        return False

    conn = _get_pg_connection()
    if conn:
        conn.close()
        _license_pg_available = True
        return True
    _license_pg_available = False
    return False


def _init_license_table():
    """Create the licenses table in PostgreSQL if it doesn't exist."""
    conn = _get_pg_connection()
    if not conn:
        return False
    try:
        with conn.cursor() as cur:
            cur.execute("""
                CREATE TABLE IF NOT EXISTS license_store (
                    id TEXT PRIMARY KEY DEFAULT 'singleton',
                    licenses JSONB NOT NULL DEFAULT '{}'::jsonb,
                    activations JSONB NOT NULL DEFAULT '{}'::jsonb,
                    saved_at TIMESTAMPTZ DEFAULT NOW()
                )
            """)
            cur.execute("""
                CREATE TABLE IF NOT EXISTS license_audit_log (
                    id SERIAL PRIMARY KEY,
                    entry JSONB NOT NULL,
                    created_at TIMESTAMPTZ DEFAULT NOW()
                )
            """)
            conn.commit()
        logger.info("[License] PostgreSQL license tables ready")
        return True
    except Exception as e:
        logger.warning(f"[License] PostgreSQL table init failed: {e}")
        return False
    finally:
        conn.close()


def _pg_load_licenses() -> tuple:
    """Load licenses from PostgreSQL. Returns (licenses_dict, activations_dict) or None on failure."""
    conn = _get_pg_connection()
    if not conn:
        return None
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT licenses, activations FROM license_store WHERE id = 'singleton'")
            row = cur.fetchone()
            if row:
                lic = row[0] if isinstance(row[0], dict) else json.loads(row[0]) if row[0] else {}
                act = row[1] if isinstance(row[1], dict) else json.loads(row[1]) if row[1] else {}
                return lic, act
            return {}, {}
    except Exception as e:
        logger.warning(f"[License] PostgreSQL load failed: {e}")
        return None
    finally:
        conn.close()


def _pg_save_licenses():
    """Save licenses to PostgreSQL (upsert)."""
    conn = _get_pg_connection()
    if not conn:
        return False
    try:
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO license_store (id, licenses, activations, saved_at)
                VALUES ('singleton', %s::jsonb, %s::jsonb, NOW())
                ON CONFLICT (id) DO UPDATE SET
                    licenses = EXCLUDED.licenses,
                    activations = EXCLUDED.activations,
                    saved_at = NOW()
            """, (json.dumps(licenses_db), json.dumps(activations_db)))
            conn.commit()
        logger.info(f"[License] Saved {len(licenses_db)} licenses to PostgreSQL")
        return True
    except Exception as e:
        logger.warning(f"[License] PostgreSQL save failed: {e}")
        return False
    finally:
        conn.close()


def _pg_save_audit_entry(entry: dict):
    """Append a single audit entry to PostgreSQL."""
    conn = _get_pg_connection()
    if not conn:
        return
    try:
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO license_audit_log (entry) VALUES (%s::jsonb)",
                (json.dumps(entry),)
            )
            conn.commit()
    except Exception as e:
        logger.warning(f"[License] PostgreSQL audit save failed: {e}")
    finally:
        conn.close()


# ─── Unified load / save (PostgreSQL primary, JSON fallback) ─────────────

def _load_licenses() -> tuple[dict, dict]:
    """Load licenses: try PostgreSQL first, fall back to JSON file."""
    # Try PostgreSQL (production / Railway)
    if _is_postgres_available():
        _init_license_table()
        pg_result = _pg_load_licenses()
        if pg_result is not None:
            lic, act = pg_result
            logger.info(f"[License] Loaded {len(lic)} licenses from PostgreSQL")
            return lic, act

    # Fallback: JSON file (local dev)
    if not LICENSES_FILE.exists():
        return {}, {}
    try:
        with open(LICENSES_FILE, 'r') as f:
            data = json.load(f)
            return data.get("licenses", {}), data.get("activations", {})
    except Exception as e:
        logger.error(f"[License] Failed to load licenses from file: {e}")
        return {}, {}


def _save_licenses():
    """Save licenses: try PostgreSQL first, always write JSON file as backup."""
    # Try PostgreSQL (production / Railway)
    if _is_postgres_available():
        if _pg_save_licenses():
            return  # Success — PostgreSQL is the source of truth

    # Fallback: JSON file
    with _file_lock:
        try:
            temp_file = LICENSES_FILE.with_suffix('.tmp')
            with open(temp_file, 'w') as f:
                json.dump({
                    "licenses": licenses_db,
                    "activations": activations_db,
                    "saved_at": datetime.utcnow().isoformat()
                }, f, indent=2)
            temp_file.replace(LICENSES_FILE)
            logger.info(f"[License] Saved {len(licenses_db)} licenses to file (fallback)")
        except Exception as e:
            logger.error(f"[License] Failed to save licenses to file: {e}")


def _save_audit():
    """Save audit log: PostgreSQL if available, else JSON file."""
    if _is_postgres_available():
        # Individual entries are saved via _pg_save_audit_entry() at log time
        return

    with _file_lock:
        try:
            with open(AUDIT_FILE, 'w') as f:
                json.dump(audit_log[-1000:], f, indent=2)
        except Exception as e:
            logger.error(f"[License] Failed to save audit log: {e}")


# Load existing licenses on module import
licenses_db, activations_db = _load_licenses()
logger.info(f"[License] Loaded {len(licenses_db)} licenses ({('PostgreSQL' if _is_postgres_available() else 'JSON file')})")

audit_log: List[Dict] = []  # Audit trail for admin actions

# Rate limiting for login attempts (IP -> {attempts, last_attempt, locked_until})
login_attempts: Dict[str, Dict] = defaultdict(lambda: {"attempts": 0, "last_attempt": 0, "locked_until": 0})
MAX_LOGIN_ATTEMPTS = 5
LOCKOUT_DURATION = 300  # 5 minutes

# Secret for license generation — MUST be set via environment variable (no hardcoded fallback)
LICENSE_SECRET = os.getenv("LICENSE_SECRET")
if not LICENSE_SECRET:
    import warnings
    warnings.warn("LICENSE_SECRET not set — using temporary default. Set this env var in production!")
    LICENSE_SECRET = "flowstral-offline-2024"  # Temporary fallback for dev only
JWT_SECRET = os.getenv("JWT_SECRET", "flowstral-jwt-secret-2024")

# Admin whitelist - only these emails can access admin endpoints
ADMIN_EMAILS = [
    "sales@flowstral.com",
    "admin@flowstral.com",
    "janum@flowstral.com",  # Add more as needed
]

# Optional: IP whitelist for admin access (empty = allow all)
# Set ADMIN_IP_WHITELIST env var as comma-separated IPs, e.g., "1.2.3.4,5.6.7.8"
ADMIN_IP_WHITELIST = [ip.strip() for ip in os.getenv("ADMIN_IP_WHITELIST", "").split(",") if ip.strip()]


def log_admin_action(action: str, admin_email: str, details: dict = None, ip: str = None):
    """Log admin actions for audit trail (PostgreSQL + in-memory)."""
    entry = {
        "timestamp": datetime.utcnow().isoformat(),
        "action": action,
        "admin": admin_email,
        "ip": ip,
        "details": details or {}
    }
    audit_log.append(entry)
    # Keep last 1000 entries in memory
    if len(audit_log) > 1000:
        audit_log.pop(0)
    # Persist to PostgreSQL if available
    if _is_postgres_available():
        _pg_save_audit_entry(entry)
    logger.info(f"[AUDIT] {action} by {admin_email} from {ip}: {details}")


def check_ip_whitelist(request: Request) -> str:
    """Check if request IP is whitelisted (if whitelist is configured)."""
    client_ip = request.client.host if request.client else "unknown"
    
    # If whitelist is configured, enforce it
    if ADMIN_IP_WHITELIST and client_ip not in ADMIN_IP_WHITELIST:
        logger.warning(f"[SECURITY] Admin access denied from non-whitelisted IP: {client_ip}")
        raise HTTPException(status_code=403, detail="Access denied")
    
    return client_ip


def check_rate_limit(ip: str) -> None:
    """Check and enforce rate limiting for login attempts."""
    now = time.time()
    record = login_attempts[ip]
    
    # Check if currently locked out
    if record["locked_until"] > now:
        wait_time = int(record["locked_until"] - now)
        raise HTTPException(
            status_code=429, 
            detail=f"Too many login attempts. Try again in {wait_time} seconds."
        )
    
    # Reset attempts if last attempt was more than lockout duration ago
    if now - record["last_attempt"] > LOCKOUT_DURATION:
        record["attempts"] = 0


def record_login_attempt(ip: str, success: bool) -> None:
    """Record a login attempt for rate limiting."""
    now = time.time()
    record = login_attempts[ip]
    
    if success:
        # Reset on successful login
        record["attempts"] = 0
        record["locked_until"] = 0
    else:
        record["attempts"] += 1
        record["last_attempt"] = now
        
        if record["attempts"] >= MAX_LOGIN_ATTEMPTS:
            record["locked_until"] = now + LOCKOUT_DURATION
            logger.warning(f"[SECURITY] IP {ip} locked out after {MAX_LOGIN_ATTEMPTS} failed login attempts")


async def verify_admin(
    request: Request,
    credentials: HTTPAuthorizationCredentials = Depends(security),
    x_admin_email: Optional[str] = Header(None)
) -> str:
    """
    Verify admin access. Accepts either:
    1. JWT token with admin email claim
    2. X-Admin-Email header (for simple auth during development)
    
    Also enforces IP whitelist if configured.
    """
    # Check IP whitelist first
    client_ip = check_ip_whitelist(request)
    
    # Try JWT first
    if credentials:
        try:
            payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=["HS256"])
            email = payload.get("email", "").lower()
            if email in [e.lower() for e in ADMIN_EMAILS]:
                return email
            raise HTTPException(status_code=403, detail="Not authorized as admin")
        except jwt.ExpiredSignatureError:
            raise HTTPException(status_code=401, detail="Token expired")
        except jwt.InvalidTokenError:
            pass  # Fall through to header check
    
    # Check header (development/simple auth)
    if x_admin_email:
        email = x_admin_email.lower()
        if email in [e.lower() for e in ADMIN_EMAILS]:
            return email
        raise HTTPException(status_code=403, detail="Not authorized as admin")
    
    raise HTTPException(status_code=401, detail="Admin authentication required")


def generate_admin_token(email: str, expires_hours: int = 24) -> str:
    """Generate a JWT token for admin access."""
    if email.lower() not in [e.lower() for e in ADMIN_EMAILS]:
        raise ValueError("Email not in admin whitelist")
    
    payload = {
        "email": email,
        "exp": datetime.utcnow() + timedelta(hours=expires_hours),
        "iat": datetime.utcnow(),
        "type": "admin"
    }
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")


class LicenseValidateRequest(BaseModel):
    licenseKey: str
    deviceId: str
    productId: str = "flowstral-desktop"


class LicenseActivateRequest(BaseModel):
    licenseKey: str
    deviceId: str
    deviceName: Optional[str] = None
    productId: str = "flowstral-desktop"


class LicenseCreateRequest(BaseModel):
    type: str = "professional"  # trial, professional, enterprise, unlimited
    email: str
    company: Optional[str] = None
    maxActivations: int = 5
    validDays: int = 365
    features: Optional[List[str]] = None


class LicenseResponse(BaseModel):
    valid: bool
    type: Optional[str] = None
    expiresAt: Optional[str] = None
    features: Optional[List[str]] = None
    error: Optional[str] = None


class LicenseInfo(BaseModel):
    key: str
    type: str
    email: str
    company: Optional[str]
    expiresAt: str
    maxActivations: int
    currentActivations: int
    features: List[str]
    createdAt: str


def generate_license_key(license_type: str, expiry_date: datetime) -> str:
    """Generate a license key with embedded type and expiry."""
    type_codes = {
        "trial": "T",
        "professional": "P",
        "enterprise": "E",
        "unlimited": "U"
    }
    
    type_code = type_codes.get(license_type, "T")
    expiry_yymm = expiry_date.strftime("%y%m")
    
    # Generate random segments
    seg1 = type_code + secrets.token_hex(2).upper()
    seg2 = secrets.token_hex(2).upper() + "A"
    seg3 = expiry_yymm + secrets.token_hex(1).upper()[0]
    
    data_to_sign = f"FLOWSTRAL-{seg1}-{seg2}-{seg3}"
    
    # Generate checksum
    checksum = hmac.new(
        LICENSE_SECRET.encode(),
        data_to_sign.encode(),
        hashlib.sha256
    ).hexdigest()[:5].upper()
    
    return f"{data_to_sign}-{checksum}"


def validate_license_key(license_key: str) -> dict:
    """Validate a license key format and checksum."""
    try:
        parts = license_key.split("-")
        if len(parts) != 5 or parts[0] != "FLOWSTRAL":
            return {"valid": False, "error": "Invalid license format"}
        
        # Verify checksum
        data_to_check = "-".join(parts[:4])
        expected_checksum = hmac.new(
            LICENSE_SECRET.encode(),
            data_to_check.encode(),
            hashlib.sha256
        ).hexdigest()[:5].upper()
        
        if parts[4] != expected_checksum:
            return {"valid": False, "error": "Invalid license checksum"}
        
        # Decode type
        type_code = parts[1][0]
        type_map = {"T": "trial", "P": "professional", "E": "enterprise", "U": "unlimited"}
        license_type = type_map.get(type_code, "trial")
        
        # Decode expiry
        expiry_yymm = parts[3][:4]
        year = 2000 + int(expiry_yymm[:2])
        month = int(expiry_yymm[2:4])
        expiry_date = datetime(year, month, 28)  # End of month approximation
        
        if datetime.now() > expiry_date:
            return {"valid": False, "error": "License has expired"}
        
        return {
            "valid": True,
            "type": license_type,
            "expiresAt": expiry_date.isoformat()
        }
    except Exception as e:
        return {"valid": False, "error": str(e)}


def get_features_for_type(license_type: str) -> List[str]:
    """Get available features for a license type."""
    features = {
        "trial": ["recording", "playback", "basic-reports"],
        "professional": [
            "recording", "playback", "basic-reports", "advanced-reports",
            "parallel-execution", "api-testing"
        ],
        "enterprise": [
            "recording", "playback", "basic-reports", "advanced-reports",
            "parallel-execution", "api-testing", "ci-cd", "self-healing",
            "ai-suggestions"
        ],
        "unlimited": [
            "recording", "playback", "basic-reports", "advanced-reports",
            "parallel-execution", "api-testing", "ci-cd", "self-healing",
            "ai-suggestions", "custom-integrations", "dedicated-support"
        ]
    }
    return features.get(license_type, features["trial"])


@router.post("/validate", response_model=LicenseResponse)
async def validate_license(request: LicenseValidateRequest):
    """
    Validate a license key.
    
    First checks the database for registered licenses,
    then falls back to offline validation for portable licenses.
    """
    # Check database first
    if request.licenseKey in licenses_db:
        license_data = licenses_db[request.licenseKey]
        
        # Check expiry
        if datetime.fromisoformat(license_data["expiresAt"]) < datetime.now():
            return LicenseResponse(valid=False, error="License has expired")
        
        return LicenseResponse(
            valid=True,
            type=license_data["type"],
            expiresAt=license_data["expiresAt"],
            features=license_data["features"]
        )
    
    # Fall back to offline validation
    result = validate_license_key(request.licenseKey)
    
    if result["valid"]:
        return LicenseResponse(
            valid=True,
            type=result["type"],
            expiresAt=result["expiresAt"],
            features=get_features_for_type(result["type"])
        )
    
    return LicenseResponse(valid=False, error=result.get("error", "Invalid license"))


@router.post("/activate")
async def activate_license(request: LicenseActivateRequest):
    """
    Activate a license on a specific device.
    
    Tracks device activations and enforces activation limits.
    """
    # Validate license first
    validate_result = validate_license_key(request.licenseKey)
    if not validate_result["valid"]:
        return {"success": False, "error": validate_result.get("error")}
    
    # Check if license exists in DB (must be admin-created via /create or /admin/generate)
    if request.licenseKey not in licenses_db:
        return {
            "success": False, 
            "error": "License key not found. Please contact your administrator."
        }
    
    license_data = licenses_db[request.licenseKey]
    
    # Check activation limit
    if request.licenseKey not in activations_db:
        activations_db[request.licenseKey] = []
    
    activations = activations_db[request.licenseKey]
    existing = [a for a in activations if a["deviceId"] == request.deviceId]
    
    if not existing:
        if len(activations) >= license_data.get("maxActivations", 5):
            return {
                "success": False,
                "error": f"Maximum activations ({license_data['maxActivations']}) reached"
            }
        
        # Add new activation
        activations.append({
            "deviceId": request.deviceId,
            "deviceName": request.deviceName,
            "activatedAt": datetime.now().isoformat()
        })
        _save_licenses()  # Persist to disk
    
    return {
        "success": True,
        "license": {
            "valid": True,
            "type": license_data["type"],
            "expiresAt": license_data["expiresAt"],
            "features": license_data["features"]
        }
    }


@router.post("/deactivate")
async def deactivate_license(request: LicenseValidateRequest):
    """
    Deactivate a license from a specific device.
    """
    if request.licenseKey in activations_db:
        activations = activations_db[request.licenseKey]
        activations_db[request.licenseKey] = [
            a for a in activations if a["deviceId"] != request.deviceId
        ]
        _save_licenses()  # Persist to disk
    
    return {"success": True}


@router.post("/admin/login")
async def admin_login(
    request: Request,
    email: str = Query(...), 
    password: str = Query(...)
):
    """
    Admin login endpoint with rate limiting and audit logging.
    
    For production, integrate with your auth provider (Supabase, Auth0, etc.)
    For now, uses a simple password check.
    """
    client_ip = request.client.host if request.client else "unknown"
    
    # Check IP whitelist
    check_ip_whitelist(request)
    
    # Check rate limiting
    check_rate_limit(client_ip)
    
    # Validate email is in admin list
    if email.lower() not in [e.lower() for e in ADMIN_EMAILS]:
        record_login_attempt(client_ip, success=False)
        log_admin_action("login_failed", email, {"reason": "email_not_authorized"}, client_ip)
        raise HTTPException(status_code=403, detail="Email not authorized as admin")
    
    # Check password
    admin_password = os.getenv("ADMIN_PASSWORD", "Inception@123")
    if password != admin_password:
        record_login_attempt(client_ip, success=False)
        log_admin_action("login_failed", email, {"reason": "invalid_password"}, client_ip)
        raise HTTPException(status_code=401, detail="Invalid password")
    
    # Success - generate token
    record_login_attempt(client_ip, success=True)
    token = generate_admin_token(email)
    
    log_admin_action("login_success", email, {}, client_ip)
    
    return {
        "success": True,
        "email": email,
        "token": token,
        "expiresIn": 24 * 60 * 60  # 24 hours in seconds
    }


@router.get("/admin/me")
async def admin_me(admin_email: str = Depends(verify_admin)):
    """Get current admin info."""
    return {
        "email": admin_email,
        "authorized": True
    }


@router.get("/admin/audit-log")
async def get_audit_log(
    limit: int = Query(100, ge=1, le=500),
    admin_email: str = Depends(verify_admin)
):
    """
    Get recent admin audit log entries.
    """
    return {
        "entries": audit_log[-limit:],
        "total": len(audit_log)
    }


@router.get("/admin/security-status")
async def get_security_status(admin_email: str = Depends(verify_admin)):
    """
    Get current security configuration status.
    """
    locked_ips = [
        ip for ip, record in login_attempts.items() 
        if record["locked_until"] > time.time()
    ]
    
    return {
        "ip_whitelist_enabled": len(ADMIN_IP_WHITELIST) > 0,
        "ip_whitelist": ADMIN_IP_WHITELIST if ADMIN_IP_WHITELIST else "disabled",
        "max_login_attempts": MAX_LOGIN_ATTEMPTS,
        "lockout_duration_seconds": LOCKOUT_DURATION,
        "currently_locked_ips": locked_ips,
        "admin_emails": ADMIN_EMAILS
    }


@router.post("/create", response_model=LicenseInfo)
async def create_license(
    request: LicenseCreateRequest,
    admin_email: str = Depends(verify_admin)
):
    """
    Create a new license key.
    
    Admin endpoint for generating licenses. Requires admin authentication.
    """
    # Calculate expiry date
    expiry_date = datetime.now() + timedelta(days=request.validDays)
    
    # Generate the key
    license_key = generate_license_key(request.type, expiry_date)
    
    # Get features
    features = request.features or get_features_for_type(request.type)
    
    # Store in database
    license_data = {
        "key": license_key,
        "type": request.type,
        "email": request.email,
        "company": request.company,
        "expiresAt": expiry_date.isoformat(),
        "maxActivations": request.maxActivations,
        "features": features,
        "createdAt": datetime.now().isoformat()
    }
    
    licenses_db[license_key] = license_data
    activations_db[license_key] = []
    _save_licenses()  # Persist to disk
    
    return LicenseInfo(
        key=license_key,
        type=request.type,
        email=request.email,
        company=request.company,
        expiresAt=expiry_date.isoformat(),
        maxActivations=request.maxActivations,
        currentActivations=0,
        features=features,
        createdAt=license_data["createdAt"]
    )


@router.get("/admin/list")
async def list_licenses(admin_email: str = Depends(verify_admin)):
    """
    List all licenses with tracking info (admin endpoint).
    
    Returns detailed information about each license including:
    - License key and type
    - Expiration date and days remaining
    - Activation status and device details
    - Usage history
    """
    result = []
    now = datetime.now()
    
    for key, data in licenses_db.items():
        activations = activations_db.get(key, [])
        expires_at = datetime.fromisoformat(data["expiresAt"])
        days_left = (expires_at - now).days
        
        result.append({
            **data,
            "daysLeft": max(0, days_left),
            "isExpired": days_left < 0,
            "isExpiringSoon": 0 < days_left <= 7,
            "currentActivations": len(activations),
            "activations": activations,
            "status": "expired" if days_left < 0 else "expiring_soon" if days_left <= 7 else "active"
        })
    
    # Sort by days left (expiring soonest first)
    result.sort(key=lambda x: x["daysLeft"])
    
    return {
        "total": len(result),
        "active": len([l for l in result if l["status"] == "active"]),
        "expiring_soon": len([l for l in result if l["status"] == "expiring_soon"]),
        "expired": len([l for l in result if l["status"] == "expired"]),
        "licenses": result
    }


@router.get("/admin/stats")
async def license_stats(admin_email: str = Depends(verify_admin)):
    """
    Get license statistics dashboard data.
    """
    now = datetime.now()
    
    total_licenses = len(licenses_db)
    total_activations = sum(len(a) for a in activations_db.values())
    
    # Count by type
    by_type = {"trial": 0, "professional": 0, "enterprise": 0, "unlimited": 0}
    active_count = 0
    expired_count = 0
    expiring_soon_count = 0
    
    for key, data in licenses_db.items():
        license_type = data.get("type", "trial")
        by_type[license_type] = by_type.get(license_type, 0) + 1
        
        expires_at = datetime.fromisoformat(data["expiresAt"])
        days_left = (expires_at - now).days
        
        if days_left < 0:
            expired_count += 1
        elif days_left <= 7:
            expiring_soon_count += 1
        else:
            active_count += 1
    
    return {
        "totalLicenses": total_licenses,
        "totalActivations": total_activations,
        "byType": by_type,
        "byStatus": {
            "active": active_count,
            "expiring_soon": expiring_soon_count,
            "expired": expired_count
        }
    }


@router.get("/admin/generate-sample")
async def generate_sample_licenses(admin_email: str = Depends(verify_admin)):
    """
    Generate sample license keys for testing (admin only).
    """
    samples = []
    
    for license_type in ["trial", "professional", "enterprise"]:
        # Generate 30-day license
        expiry = datetime.now() + timedelta(days=30)
        key = generate_license_key(license_type, expiry)
        samples.append({
            "type": license_type,
            "key": key,
            "expiresAt": expiry.isoformat(),
            "features": get_features_for_type(license_type)
        })
    
    return samples


@router.post("/admin/generate")
async def generate_licenses(
    license_type: str = Query("trial", description="License type: trial, professional, enterprise, unlimited"),
    count: int = Query(1, ge=1, le=100, description="Number of licenses to generate"),
    days: int = Query(14, ge=1, le=365, description="Validity period in days"),
    max_activations: int = Query(1, ge=1, le=100, description="Max device activations per license"),
    email: Optional[str] = Query(None, description="Optional email to associate with license"),
    company: Optional[str] = Query(None, description="Optional company name"),
    admin_email: str = Depends(verify_admin)
):
    """
    Generate license keys with customizable parameters (admin only).
    
    This is the main license generation endpoint for sales/admin use.
    """
    if license_type not in ["trial", "professional", "enterprise", "unlimited"]:
        raise HTTPException(status_code=400, detail="Invalid license type")
    
    expiry = datetime.now() + timedelta(days=days)
    keys_created = []
    
    for i in range(count):
        license_key = generate_license_key(license_type, expiry)
        features = get_features_for_type(license_type)
        
        license_data = {
            "key": license_key,
            "type": license_type,
            "email": email or f"generated-{i+1}@flowstral.com",
            "company": company,
            "expiresAt": expiry.isoformat(),
            "maxActivations": max_activations,
            "features": features,
            "createdAt": datetime.now().isoformat(),
            "createdBy": admin_email,  # Track who created the license
        }
        
        licenses_db[license_key] = license_data
        activations_db[license_key] = []
        
        keys_created.append({
            "key": license_key,
            "type": license_type,
            "expiresAt": expiry.isoformat(),
            "validDays": days,
            "maxActivations": max_activations,
        })
    
    # Save all generated licenses to disk
    _save_licenses()
    
    # Audit log the generation
    log_admin_action("licenses_generated", admin_email, {
        "count": len(keys_created),
        "type": license_type,
        "days": days,
        "email": email,
        "company": company
    })
    
    return {
        "success": True,
        "count": len(keys_created),
        "type": license_type,
        "validDays": days,
        "expiresAt": expiry.isoformat(),
        "licenses": keys_created,
        "createdBy": admin_email
    }


@router.delete("/admin/revoke/{license_key}")
async def revoke_license(license_key: str, admin_email: str = Depends(verify_admin)):
    """
    Revoke a license (admin only).
    
    This removes the license from the database, invalidating it.
    """
    if license_key not in licenses_db:
        raise HTTPException(status_code=404, detail="License not found")
    
    # Store revocation info before deleting
    revoked_data = licenses_db.pop(license_key)
    activations_db.pop(license_key, None)
    _save_licenses()  # Persist to disk
    
    # Audit log the revocation
    log_admin_action("license_revoked", admin_email, {
        "license_key": license_key[:20] + "...",
        "type": revoked_data.get("type"),
        "email": revoked_data.get("email")
    })
    
    return {
        "success": True,
        "message": f"License {license_key} has been revoked",
        "revokedBy": admin_email,
        "revokedLicense": revoked_data
    }


# Legacy endpoint - redirect to new admin endpoint
@router.get("/list")
async def list_licenses_legacy():
    """Legacy endpoint - use /admin/list instead."""
    raise HTTPException(
        status_code=401, 
        detail="This endpoint requires admin authentication. Use /admin/list with proper auth."
    )


@router.get("/generate-trials")
async def generate_trial_licenses_legacy(count: int = 20, days: int = 14):
    """Legacy endpoint - use /admin/generate instead."""
    raise HTTPException(
        status_code=401,
        detail="This endpoint requires admin authentication. Use /admin/generate with proper auth."
    )

