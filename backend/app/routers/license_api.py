"""
License Management API

Handles license validation, activation, and management for Flowstral Desktop.
Supports both SaaS (cloud) and On-Premise deployments.
"""

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timedelta
import hashlib
import hmac
import secrets
import os

router = APIRouter(prefix="/license", tags=["License Management"])

# In-memory storage (replace with database in production)
licenses_db = {}
activations_db = {}

# Secret for license generation (use env var in production)
LICENSE_SECRET = os.getenv("LICENSE_SECRET", "flowstral-offline-2024")


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
    
    # Check if license exists in DB
    if request.licenseKey not in licenses_db:
        # Auto-register for offline-valid keys
        licenses_db[request.licenseKey] = {
            "key": request.licenseKey,
            "type": validate_result["type"],
            "expiresAt": validate_result["expiresAt"],
            "maxActivations": 5,
            "features": get_features_for_type(validate_result["type"]),
            "createdAt": datetime.now().isoformat()
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
    
    return {"success": True}


@router.post("/create", response_model=LicenseInfo)
async def create_license(request: LicenseCreateRequest):
    """
    Create a new license key.
    
    Admin endpoint for generating licenses.
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


@router.get("/list")
async def list_licenses():
    """
    List all licenses (admin endpoint).
    """
    result = []
    for key, data in licenses_db.items():
        activations = activations_db.get(key, [])
        result.append({
            **data,
            "currentActivations": len(activations),
            "activations": activations
        })
    return result


@router.get("/generate-sample")
async def generate_sample_licenses():
    """
    Generate sample license keys for testing.
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

