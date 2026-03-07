"""
Gherkin Conversion API Router
Handles converting requirements to Gherkin format
"""

import logging
from typing import Dict, List, Any, Optional
from datetime import datetime
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.services.engines.gherkin_converter import GherkinConverter
from app.services.storage.postgres_direct import execute_query, get_postgres_pool

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/gherkin", tags=["gherkin"])

converter = GherkinConverter()


class RequirementToGherkinRequest(BaseModel):
    """Request to convert requirement to Gherkin"""
    requirement_id: Optional[str] = None
    requirement: Optional[Dict[str, Any]] = None
    include_background: bool = True
    include_scenarios: bool = True
    max_scenarios: int = 5


class BatchGherkinRequest(BaseModel):
    """Request to convert multiple requirements to Gherkin"""
    requirement_ids: Optional[List[str]] = None
    requirements: Optional[List[Dict[str, Any]]] = None
    output_format: str = "feature_files"  # feature_files or single_file
    project_id: Optional[str] = None


@router.post("/convert")
async def convert_requirement_to_gherkin(request: RequirementToGherkinRequest):
    """
    Convert a requirement to Gherkin format
    
    Can accept either:
    - requirement_id: ID of requirement in database
    - requirement: Requirement dictionary directly
    """
    try:
        requirement = None
        
        # Fetch from database if ID provided
        if request.requirement_id:
            pool = get_postgres_pool()
            if not pool:
                raise HTTPException(status_code=500, detail="Database connection failed")
            
            query = """
                SELECT id, project_id, source, source_ref, title, description, raw_payload
                FROM requirements 
                WHERE id = %s
            """
            results = await execute_query(query, (request.requirement_id,))
            
            if not results or len(results) == 0:
                raise HTTPException(status_code=404, detail="Requirement not found")
            
            req = results[0]
            requirement = {
                "id": req.get("id"),
                "title": req.get("title", ""),
                "description": req.get("description", ""),
                "source": req.get("source", "application"),
                "source_ref": req.get("source_ref", ""),
                "raw_payload": req.get("raw_payload", {})
            }
        elif request.requirement:
            requirement = request.requirement
        else:
            raise HTTPException(status_code=400, detail="Either requirement_id or requirement must be provided")
        
        # Convert to Gherkin
        gherkin = converter.convert_requirement_to_gherkin(
            requirement=requirement,
            include_background=request.include_background,
            include_scenarios=request.include_scenarios,
            max_scenarios=request.max_scenarios
        )
        
        return {
            "status": "success",
            "requirement_id": requirement.get("id"),
            "requirement_title": requirement.get("title"),
            "gherkin": gherkin,
            "metadata": {
                "generated_at": datetime.utcnow().isoformat(),
                "format": "gherkin",
                "version": "1.0"
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error converting requirement to Gherkin: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to convert requirement to Gherkin")


@router.post("/convert-batch")
async def convert_batch_requirements_to_gherkin(request: BatchGherkinRequest):
    """
    Convert multiple requirements to Gherkin format
    
    Can accept either:
    - requirement_ids: List of requirement IDs from database
    - requirements: List of requirement dictionaries
    - project_id: Convert all requirements for a project
    """
    try:
        requirements = []
        
        # Fetch from database
        if request.requirement_ids:
            pool = get_postgres_pool()
            if not pool:
                raise HTTPException(status_code=500, detail="Database connection failed")
            
            placeholders = ",".join(["%s"] * len(request.requirement_ids))
            query = f"""
                SELECT id, project_id, source, source_ref, title, description, raw_payload
                FROM requirements 
                WHERE id IN ({placeholders})
            """
            results = await execute_query(query, tuple(request.requirement_ids))
            
            for req in results:
                requirements.append({
                    "id": req.get("id"),
                    "title": req.get("title", ""),
                    "description": req.get("description", ""),
                    "source": req.get("source", "application"),
                    "source_ref": req.get("source_ref", ""),
                    "raw_payload": req.get("raw_payload", {})
                })
        elif request.project_id:
            pool = get_postgres_pool()
            if not pool:
                raise HTTPException(status_code=500, detail="Database connection failed")
            
            query = """
                SELECT id, project_id, source, source_ref, title, description, raw_payload
                FROM requirements 
                WHERE project_id = %s
                ORDER BY created_at DESC
            """
            results = await execute_query(query, (request.project_id,))
            
            for req in results:
                requirements.append({
                    "id": req.get("id"),
                    "title": req.get("title", ""),
                    "description": req.get("description", ""),
                    "source": req.get("source", "application"),
                    "source_ref": req.get("source_ref", ""),
                    "raw_payload": req.get("raw_payload", {})
                })
        elif request.requirements:
            requirements = request.requirements
        else:
            raise HTTPException(status_code=400, detail="Either requirement_ids, requirements, or project_id must be provided")
        
        if not requirements:
            raise HTTPException(status_code=404, detail="No requirements found")
        
        # Convert batch
        result = converter.convert_batch_requirements(
            requirements=requirements,
            output_format=request.output_format
        )
        
        return {
            "status": "success",
            "total_requirements": len(requirements),
            "output_format": request.output_format,
            "features": result.get("features", {}),
            "metadata": {
                "generated_at": datetime.utcnow().isoformat(),
                "format": "gherkin",
                "version": "1.0"
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error converting batch requirements to Gherkin: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to convert requirements to Gherkin")


@router.get("/formats")
async def get_gherkin_info():
    """Get information about Gherkin format support"""
    return {
        "format": "gherkin",
        "version": "1.0",
        "keywords": {
            "given": ["Given", "And", "But"],
            "when": ["When", "And", "But"],
            "then": ["Then", "And", "But"],
            "background": "Background",
            "scenario": "Scenario",
            "scenario_outline": "Scenario Outline",
            "examples": "Examples"
        },
        "supported_inputs": [
            "requirement_id",
            "requirement_object",
            "test_cases",
            "acceptance_criteria"
        ],
        "output_formats": [
            "feature_files",
            "single_file"
        ]
    }

