"""
Model Registry Service
Manages fine-tuned model versions, A/B testing, and deployments

=============================================================================
DISABLED: Fine-tuned models not ready
This service tracks fine-tuned model versions for DGX deployment.
When fine-tuning is ready, set ENABLE_MODEL_REGISTRY=true in .env
=============================================================================
"""

import logging
import json
import hashlib
import os
from typing import Dict, List, Optional, Any
from datetime import datetime
from enum import Enum

logger = logging.getLogger(__name__)

# ============================================================================
# DISABLED FLAG - Set to True when fine-tuned models are ready
# ============================================================================
MODEL_REGISTRY_ENABLED = os.getenv("ENABLE_MODEL_REGISTRY", "false").lower() == "true"

if not MODEL_REGISTRY_ENABLED:
    logger.info("[DISABLED] Model registry - no fine-tuned models available (set ENABLE_MODEL_REGISTRY=true when ready)")


class ModelStatus(str, Enum):
    """Model deployment status"""
    TRAINING = "training"
    STAGED = "staged"
    ACTIVE = "active"
    DEPRECATED = "deprecated"
    ARCHIVED = "archived"


class ModelVersion:
    """Represents a model version"""
    
    def __init__(
        self,
        model_id: str,
        version: str,
        base_model: str,
        model_path: str,
        status: ModelStatus,
        metrics: Dict[str, Any],
        created_at: datetime,
        metadata: Optional[Dict[str, Any]] = None
    ):
        self.model_id = model_id
        self.version = version
        self.base_model = base_model
        self.model_path = model_path
        self.status = status
        self.metrics = metrics
        self.created_at = created_at
        self.metadata = metadata or {}
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "model_id": self.model_id,
            "version": self.version,
            "base_model": self.base_model,
            "model_path": self.model_path,
            "status": self.status.value,
            "metrics": self.metrics,
            "created_at": self.created_at.isoformat(),
            "metadata": self.metadata
        }


class ModelRegistry:
    """Manages model versions, A/B tests, and deployments"""
    
    def __init__(self):
        self.models: Dict[str, List[ModelVersion]] = {}
        self.active_models: Dict[str, str] = {}  # model_id -> version
        self.ab_tests: Dict[str, Dict[str, Any]] = {}
    
    async def register_model(
        self,
        model_id: str,
        version: str,
        base_model: str,
        model_path: str,
        metrics: Dict[str, Any],
        metadata: Optional[Dict[str, Any]] = None
    ) -> ModelVersion:
        """Register a new model version"""
        version_obj = ModelVersion(
            model_id=model_id,
            version=version,
            base_model=base_model,
            model_path=model_path,
            status=ModelStatus.STAGED,
            metrics=metrics,
            created_at=datetime.utcnow(),
            metadata=metadata
        )
        
        if model_id not in self.models:
            self.models[model_id] = []
        
        self.models[model_id].append(version_obj)
        
        logger.info(f"Registered model {model_id} version {version}")
        return version_obj
    
    async def deploy_model(
        self,
        model_id: str,
        version: str,
        percentage: int = 100
    ) -> bool:
        """Deploy a model version (canary or full)"""
        if model_id not in self.models:
            raise ValueError(f"Model {model_id} not found")
        
        versions = self.models[model_id]
        target_version = next((v for v in versions if v.version == version), None)
        
        if not target_version:
            raise ValueError(f"Version {version} not found for model {model_id}")
        
        # Update status
        target_version.status = ModelStatus.ACTIVE
        
        # If 100%, make it the active model
        if percentage == 100:
            self.active_models[model_id] = version
            # Deprecate previous active version
            for v in versions:
                if v.version != version and v.status == ModelStatus.ACTIVE:
                    v.status = ModelStatus.DEPRECATED
        
        logger.info(f"Deployed model {model_id} version {version} at {percentage}%")
        return True
    
    async def start_ab_test(
        self,
        model_id: str,
        control_version: str,
        treatment_version: str,
        percentage: int = 10
    ) -> str:
        """Start an A/B test between two model versions"""
        test_id = f"{model_id}_ab_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}"
        
        self.ab_tests[test_id] = {
            "model_id": model_id,
            "control_version": control_version,
            "treatment_version": treatment_version,
            "percentage": percentage,
            "status": "active",
            "started_at": datetime.utcnow().isoformat(),
            "metrics": {
                "control": {"requests": 0, "success": 0, "avg_latency": 0},
                "treatment": {"requests": 0, "success": 0, "avg_latency": 0}
            }
        }
        
        logger.info(f"Started A/B test {test_id}")
        return test_id
    
    async def get_model_for_request(
        self,
        model_id: str,
        user_id: Optional[str] = None
    ) -> Optional[str]:
        """Get model version for a request (handles A/B testing)"""
        # Check if user is in A/B test
        if user_id:
            for test_id, test in self.ab_tests.items():
                if test["model_id"] == model_id and test["status"] == "active":
                    # Simple hash-based assignment
                    import hashlib
                    hash_val = int(hashlib.md5(f"{user_id}{test_id}".encode()).hexdigest(), 16)
                    if hash_val % 100 < test["percentage"]:
                        return test["treatment_version"]
                    else:
                        return test["control_version"]
        
        # Default to active model
        if model_id in self.active_models:
            return self.active_models[model_id]
        
        # Fallback to latest version
        if model_id in self.models and self.models[model_id]:
            return self.models[model_id][-1].version
        
        return None
    
    async def rollback_model(
        self,
        model_id: str,
        target_version: Optional[str] = None
    ) -> bool:
        """Rollback to a previous model version"""
        if model_id not in self.models:
            raise ValueError(f"Model {model_id} not found")
        
        versions = self.models[model_id]
        
        if target_version:
            # Rollback to specific version
            target = next((v for v in versions if v.version == target_version), None)
            if not target:
                raise ValueError(f"Version {target_version} not found")
        else:
            # Rollback to previous active version
            active_version = self.active_models.get(model_id)
            if not active_version:
                raise ValueError(f"No active version to rollback from")
            
            # Find previous version
            sorted_versions = sorted(versions, key=lambda v: v.created_at, reverse=True)
            current_idx = next((i for i, v in enumerate(sorted_versions) if v.version == active_version), None)
            
            if current_idx is None or current_idx + 1 >= len(sorted_versions):
                raise ValueError(f"No previous version to rollback to")
            
            target = sorted_versions[current_idx + 1]
        
        # Deploy previous version
        await self.deploy_model(model_id, target.version, percentage=100)
        
        logger.info(f"Rolled back model {model_id} to version {target.version}")
        return True
    
    async def list_models(self) -> List[Dict[str, Any]]:
        """List all registered models"""
        result = []
        for model_id, versions in self.models.items():
            active_version = self.active_models.get(model_id)
            result.append({
                "model_id": model_id,
                "versions": [v.to_dict() for v in versions],
                "active_version": active_version,
                "total_versions": len(versions)
            })
        return result
    
    async def get_model_info(self, model_id: str) -> Optional[Dict[str, Any]]:
        """Get information about a specific model"""
        if model_id not in self.models:
            return None
        
        versions = self.models[model_id]
        active_version = self.active_models.get(model_id)
        
        return {
            "model_id": model_id,
            "versions": [v.to_dict() for v in versions],
            "active_version": active_version,
            "total_versions": len(versions),
            "ab_tests": [t for t in self.ab_tests.values() if t["model_id"] == model_id]
        }


# Global instance
model_registry = ModelRegistry()

