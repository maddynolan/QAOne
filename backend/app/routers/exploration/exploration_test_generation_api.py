# DEPRECATED — Scheduled for removal (v3.20.0)
# Part of the Autonomous Explorer / Flowmap system which is unused.
# Router registration commented out in main.py.
"""
API endpoints for test case generation from capability maps.
"""

import logging
from datetime import datetime
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.services.exploration.test_case_generator import ExplorationTestCaseGenerator
from app.services.exploration.capability_map_builder import CapabilityMapBuilder
from app.services.storage.capability_map_storage import get_capability_map_storage
from app.utils.endpoint_helpers import ensure_default_org_project
from app.dependencies import get_current_project, get_current_user, get_current_tenant
from app.services.storage.database import get_database_client

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/exploration", tags=["exploration-test-generation"])


class GenerateTestsRequest(BaseModel):
    """Request to generate tests from capability map."""
    capability_map_id: Optional[str] = None
    exploration_run_id: Optional[str] = None
    project_id: Optional[str] = None


@router.post("/generate-tests")
async def generate_tests_from_capability_map(request: GenerateTestsRequest):
    """
    Generate test cases from a capability map.
    """
    try:
        # Get project_id
        if not request.project_id:
            _, project_id = await ensure_default_org_project()
        else:
            project_id = request.project_id
        
        # Get capability map
        storage = get_capability_map_storage()
        capability_map = None
        
        if request.capability_map_id:
            map_data = await storage.get_capability_map(request.capability_map_id)
            if map_data:
                capability_map = map_data.get('capability_data')
        elif request.exploration_run_id:
            # Get latest capability map for this exploration run
            maps = await storage.get_capability_maps_by_project(project_id, limit=1)
            if maps:
                map_data = await storage.get_capability_map(maps[0]['id'])
                if map_data:
                    capability_map = map_data.get('capability_data')
        
        if not capability_map:
            raise HTTPException(
                status_code=404,
                detail="Capability map not found. Run exploration first."
            )
        
        # Generate test cases
        generator = ExplorationTestCaseGenerator()
        test_cases = await generator.generate_from_capability_map(capability_map)
        
        # Convert to dict format
        test_cases_data = []
        for tc in test_cases:
            test_cases_data.append({
                'title': tc.title,
                'description': tc.description,
                'test_type': tc.test_type,
                'priority': tc.priority,
                'steps': tc.steps,
                'expected_result': tc.expected_result,
                'entity': tc.entity,
                'operation': tc.operation,
                'test_data': tc.test_data,
                'tags': tc.tags
            })
        
        return {
            "status": "success",
            "test_cases_generated": len(test_cases_data),
            "test_cases": test_cases_data,
            "timestamp": datetime.utcnow().isoformat()
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Test generation failed: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail="Test generation failed"
        )


@router.post("/generate-and-save-tests")
async def generate_and_save_tests(request: GenerateTestsRequest):
    """
    Generate test cases from capability map and save them to database.
    """
    try:
        from datetime import datetime
        
        # Get project_id
        if not request.project_id:
            _, project_id = await ensure_default_org_project()
        else:
            project_id = request.project_id
        
        # Get capability map
        storage = get_capability_map_storage()
        capability_map = None
        
        if request.capability_map_id:
            map_data = await storage.get_capability_map(request.capability_map_id)
            if map_data:
                capability_map = map_data.get('capability_data')
        elif request.exploration_run_id:
            maps = await storage.get_capability_maps_by_project(project_id, limit=1)
            if maps:
                map_data = await storage.get_capability_map(maps[0]['id'])
                if map_data:
                    capability_map = map_data.get('capability_data')
        
        if not capability_map:
            raise HTTPException(
                status_code=404,
                detail="Capability map not found. Run exploration first."
            )
        
        # Generate test cases
        generator = ExplorationTestCaseGenerator()
        test_cases = await generator.generate_from_capability_map(capability_map)
        
        # Save to database
        from app.services.storage.postgres_direct import execute_query
        from uuid import uuid4
        
        saved_count = 0
        for tc in test_cases:
            try:
                test_case_id = str(uuid4())
                
                # Convert steps to JSON
                import json
                steps_json = json.dumps(tc.steps)
                test_data_json = json.dumps(tc.test_data) if tc.test_data else '{}'
                tags_array = tc.tags
                
                query = """
                    INSERT INTO test_cases (
                        id, project_id, title, description, test_type, priority,
                        steps, expected_result, tags, created_at, updated_at
                    )
                    VALUES (%s, %s, %s, %s, %s, %s, %s::jsonb, %s, %s, NOW(), NOW())
                    RETURNING id
                """
                
                result = await execute_query(
                    query,
                    (
                        test_case_id,
                        project_id,
                        tc.title,
                        tc.description,
                        tc.test_type,
                        tc.priority,
                        steps_json,
                        tc.expected_result,
                        tags_array
                    )
                )
                
                if result:
                    saved_count += 1
            except Exception as save_error:
                logger.warning(f"Failed to save test case {tc.title}: {save_error}")
        
        return {
            "status": "success",
            "test_cases_generated": len(test_cases),
            "test_cases_saved": saved_count,
            "timestamp": datetime.utcnow().isoformat()
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Test generation and save failed: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail="Test generation failed"
        )

