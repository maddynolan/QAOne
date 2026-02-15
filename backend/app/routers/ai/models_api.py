"""
Models API Router
Handles model registration, deployment, and management
"""
import logging
from fastapi import APIRouter, HTTPException, Request
from app.services.llm.model_registry import model_registry

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/ai/models", tags=["models"])


@router.get("")
async def list_models():
    """List all registered models and versions"""
    try:
        models = await model_registry.list_models()
        return {
            "status": "success",
            "models": models
        }
    except Exception as e:
        logger.error(f"Error listing models: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{model_id}")
async def get_model_info(model_id: str):
    """Get information about a specific model"""
    try:
        info = await model_registry.get_model_info(model_id)
        if not info:
            raise HTTPException(status_code=404, detail=f"Model {model_id} not found")
        return {
            "status": "success",
            "model": info
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting model info: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/register")
async def register_model(request: Request):
    """Register a new model version"""
    try:
        body = await request.json()
        model_id = body.get("model_id")
        version = body.get("version")
        base_model = body.get("base_model")
        model_path = body.get("model_path")
        metrics = body.get("metrics", {})
        metadata = body.get("metadata", {})
        
        if not all([model_id, version, base_model, model_path]):
            raise HTTPException(
                status_code=400,
                detail="Missing required fields: model_id, version, base_model, model_path"
            )
        
        model_version = await model_registry.register_model(
            model_id=model_id,
            version=version,
            base_model=base_model,
            model_path=model_path,
            metrics=metrics,
            metadata=metadata
        )
        
        return {
            "status": "success",
            "message": "Model registered successfully",
            "model": model_version.to_dict()
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error registering model: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{model_id}/deploy")
async def deploy_model(model_id: str, request: Request):
    """Deploy a model version (canary or full rollout)"""
    try:
        body = await request.json()
        version = body.get("version")
        percentage = body.get("percentage", 100)
        
        if not version:
            raise HTTPException(status_code=400, detail="version is required")
        
        if not (1 <= percentage <= 100):
            raise HTTPException(status_code=400, detail="percentage must be between 1 and 100")
        
        success = await model_registry.deploy_model(
            model_id=model_id,
            version=version,
            percentage=percentage
        )
        
        return {
            "status": "success",
            "message": f"Model {model_id} version {version} deployed at {percentage}%",
            "model_id": model_id,
            "version": version,
            "percentage": percentage
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deploying model: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{model_id}/ab-test")
async def start_ab_test(model_id: str, request: Request):
    """Start an A/B test between two model versions"""
    try:
        body = await request.json()
        control_version = body.get("control_version")
        treatment_version = body.get("treatment_version")
        percentage = body.get("percentage", 10)
        
        if not all([control_version, treatment_version]):
            raise HTTPException(
                status_code=400,
                detail="control_version and treatment_version are required"
            )
        
        if not (1 <= percentage <= 50):
            raise HTTPException(
                status_code=400,
                detail="percentage must be between 1 and 50 for A/B tests"
            )
        
        test_id = await model_registry.start_ab_test(
            model_id=model_id,
            control_version=control_version,
            treatment_version=treatment_version,
            percentage=percentage
        )
        
        return {
            "status": "success",
            "message": "A/B test started",
            "test_id": test_id,
            "model_id": model_id,
            "control_version": control_version,
            "treatment_version": treatment_version,
            "percentage": percentage
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error starting A/B test: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{model_id}/rollback")
async def rollback_model(model_id: str, request: Request):
    """Rollback to a previous model version"""
    try:
        body = await request.json()
        target_version = body.get("target_version")  # Optional, defaults to previous
        
        success = await model_registry.rollback_model(
            model_id=model_id,
            target_version=target_version
        )
        
        return {
            "status": "success",
            "message": f"Model {model_id} rolled back successfully",
            "model_id": model_id,
            "target_version": target_version or "previous"
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error rolling back model: {e}")
        raise HTTPException(status_code=500, detail=str(e))


