"""
Secrets Management API Router
Provides secure storage and retrieval of API keys, passwords, and sensitive test data.
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime
import logging

from app.services.core.secrets_service import get_secrets_service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/secrets", tags=["secrets"])


class CreateSecretRequest(BaseModel):
    """Request to create a new secret"""
    name: str
    value: str
    secret_type: str = "custom"  # api_key, password, token, credential, custom
    description: Optional[str] = None
    project_id: Optional[str] = None
    environment: Optional[str] = None  # dev, qa, staging, prod


class UpdateSecretRequest(BaseModel):
    """Request to update a secret"""
    value: Optional[str] = None
    description: Optional[str] = None
    environment: Optional[str] = None


class SecretResponse(BaseModel):
    """Secret response (value is masked)"""
    secret_id: str
    name: str
    secret_type: str
    description: Optional[str]
    environment: Optional[str]
    project_id: Optional[str]
    created_at: str
    updated_at: Optional[str]
    masked_value: str  # Only show first/last few chars


@router.get("/")
async def list_secrets(
    project_id: Optional[str] = None,
    environment: Optional[str] = None,
    secret_type: Optional[str] = None
) -> Dict[str, Any]:
    """
    List all secrets (values are masked).
    
    Query params:
    - project_id: Filter by project
    - environment: Filter by environment (dev, qa, staging, prod)
    - secret_type: Filter by type (api_key, password, token, credential, custom)
    """
    try:
        secrets_service = get_secrets_service()
        secrets = await secrets_service.list_secrets(
            project_id=project_id,
            environment=environment,
            secret_type=secret_type
        )
        
        # Mask values in response
        masked_secrets = []
        for secret in secrets:
            masked = {
                **secret,
                "masked_value": _mask_value(secret.get("name", "")),
                "value": None  # Never expose actual value in list
            }
            masked_secrets.append(masked)
        
        return {
            "status": "success",
            "secrets": masked_secrets,
            "total": len(masked_secrets)
        }
    except Exception as e:
        logger.error(f"Failed to list secrets: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/")
async def create_secret(request: CreateSecretRequest) -> Dict[str, Any]:
    """
    Create a new encrypted secret.
    
    The value is encrypted at rest using Fernet symmetric encryption.
    """
    try:
        secrets_service = get_secrets_service()
        result = await secrets_service.create_secret(
            name=request.name,
            value=request.value,
            secret_type=request.secret_type,
            description=request.description,
            project_id=request.project_id
        )
        
        # Store environment if provided
        if request.environment:
            result["environment"] = request.environment
        
        return {
            "status": "success",
            "message": f"Secret '{request.name}' created successfully",
            "secret_id": result.get("secret_id"),
            "name": request.name,
            "secret_type": request.secret_type
        }
    except Exception as e:
        logger.error(f"Failed to create secret: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{secret_id}")
async def get_secret(secret_id: str, reveal: bool = False) -> Dict[str, Any]:
    """
    Get a secret by ID.
    
    Query params:
    - reveal: If true, returns the actual decrypted value (use with caution)
    """
    try:
        secrets_service = get_secrets_service()
        secret = await secrets_service.get_secret(secret_id)
        
        if not secret:
            raise HTTPException(status_code=404, detail="Secret not found")
        
        response = {
            "status": "success",
            "secret": {
                **secret,
                "masked_value": _mask_value(secret.get("value", ""))
            }
        }
        
        # Only include actual value if explicitly requested
        if not reveal:
            response["secret"]["value"] = None
        
        return response
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get secret: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/{secret_id}")
async def update_secret(secret_id: str, request: UpdateSecretRequest) -> Dict[str, Any]:
    """
    Update an existing secret.
    """
    try:
        secrets_service = get_secrets_service()
        
        # Check if secret exists
        existing = await secrets_service.get_secret(secret_id)
        if not existing:
            raise HTTPException(status_code=404, detail="Secret not found")
        
        result = await secrets_service.update_secret(
            secret_id=secret_id,
            value=request.value,
            description=request.description
        )
        
        return {
            "status": "success",
            "message": "Secret updated successfully",
            "secret_id": secret_id
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to update secret: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{secret_id}")
async def delete_secret(secret_id: str) -> Dict[str, Any]:
    """
    Delete a secret.
    """
    try:
        secrets_service = get_secrets_service()
        
        # Check if secret exists
        existing = await secrets_service.get_secret(secret_id)
        if not existing:
            raise HTTPException(status_code=404, detail="Secret not found")
        
        await secrets_service.delete_secret(secret_id)
        
        return {
            "status": "success",
            "message": "Secret deleted successfully",
            "secret_id": secret_id
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to delete secret: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/resolve/{secret_name}")
async def resolve_secret(secret_name: str, project_id: Optional[str] = None) -> Dict[str, Any]:
    """
    Resolve a secret by name (for use in test execution).
    Returns the decrypted value.
    
    Use this endpoint when executing tests that need secret values.
    """
    try:
        secrets_service = get_secrets_service()
        value = await secrets_service.resolve_secret(secret_name, project_id=project_id)
        
        if value is None:
            raise HTTPException(status_code=404, detail=f"Secret '{secret_name}' not found")
        
        return {
            "status": "success",
            "name": secret_name,
            "value": value
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to resolve secret: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/validate")
async def validate_secrets(secret_names: List[str], project_id: Optional[str] = None) -> Dict[str, Any]:
    """
    Validate that all required secrets exist before test execution.
    
    Returns which secrets exist and which are missing.
    """
    try:
        secrets_service = get_secrets_service()
        
        results = {
            "valid": [],
            "missing": []
        }
        
        for name in secret_names:
            value = await secrets_service.resolve_secret(name, project_id=project_id)
            if value is not None:
                results["valid"].append(name)
            else:
                results["missing"].append(name)
        
        return {
            "status": "success",
            "all_valid": len(results["missing"]) == 0,
            "results": results
        }
    except Exception as e:
        logger.error(f"Failed to validate secrets: {e}")
        raise HTTPException(status_code=500, detail=str(e))


def _mask_value(value: str) -> str:
    """Mask a secret value for display"""
    if not value:
        return "••••••••"
    
    if len(value) <= 8:
        return "•" * len(value)
    
    # Show first 2 and last 2 characters
    return value[:2] + "•" * (len(value) - 4) + value[-2:]

