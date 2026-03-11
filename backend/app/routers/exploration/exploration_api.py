# DEPRECATED — Scheduled for removal (v3.20.0)
# Autonomous Explorer / Flowmap is unused. Router registration commented out in main.py.
"""
Exploration API Router
Endpoints for autonomous app exploration and capability map generation.
"""

import logging
import asyncio
from typing import Dict, List, Any, Optional
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from datetime import datetime

from app.services.exploration import (
    AutonomousExplorer,
    ExplorationConfig,
    CapabilityMapBuilder,
    RequirementComparator
)
from app.services.storage.capability_map_storage import get_capability_map_storage
from app.utils.endpoint_helpers import ensure_default_org_project

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/exploration", tags=["exploration"])

@router.get("/health")
async def health_check():
    """Health check endpoint to verify database connection and tables"""
    from app.services.storage.postgres_direct import execute_query
    
    try:
        # Check if table exists
        result = await execute_query(
            "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'exploration_runs'"
        )
        table_exists = result and len(result) > 0
        
        # Check database info
        db_info = await execute_query("SELECT current_database(), current_schema()")
        
        return {
            "status": "ok" if table_exists else "error",
            "table_exists": table_exists,
            "database_info": db_info[0] if db_info else None,
            "message": "Table exists" if table_exists else "Table does not exist - run migration"
        }
    except Exception as e:
        return {
            "status": "error",
            "error": str(e),
            "message": "Database connection failed"
        }


# ==================== Request Models ====================

class StartExplorationRequest(BaseModel):
    base_url: str
    max_depth: int = 5
    max_pages: int = 100
    allowed_domains: Optional[List[str]] = None
    excluded_paths: Optional[List[str]] = None
    login_flow: Optional[Dict[str, Any]] = None
    headless: bool = True
    screenshot: bool = True


class CompareRequirementsRequest(BaseModel):
    requirements: List[Dict[str, Any]]
    capability_map: Dict[str, Any]


# ==================== API Endpoints ====================

@router.post("/start")
async def start_exploration(request: StartExplorationRequest, project_id: Optional[str] = None):
    """
    Start autonomous exploration of an application.
    Returns a capability map of discovered pages, entities, and operations.
    """
    # SEC-INPUT-004: SSRF prevention — validate URL before crawling
    from app.utils.url_validator import validate_url, sanitize_url_for_logging
    try:
        validate_url(request.base_url)
    except ValueError as url_err:
        raise HTTPException(status_code=400, detail=f"Invalid URL: {str(url_err)}")

    # Resource limits
    if request.max_pages > 200:
        raise HTTPException(status_code=400, detail="max_pages cannot exceed 200")
    if request.max_depth > 10:
        raise HTTPException(status_code=400, detail="max_depth cannot exceed 10")

    try:
        storage = get_capability_map_storage()
    except Exception as storage_error:
        logger.error(f"Failed to get capability map storage: {type(storage_error).__name__}")
        raise HTTPException(
            status_code=500,
            detail="Storage initialization failed"
        )

    try:
        # Ensure we have a project_id
        try:
            if not project_id:
                _, project_id = await ensure_default_org_project()
            logger.info(f"Using project_id: {project_id}")
        except Exception as project_error:
            logger.error(f"Failed to get project_id: {type(project_error).__name__}")
            raise HTTPException(
                status_code=500,
                detail="Failed to initialize project"
            )

        logger.info(f"Starting exploration of {sanitize_url_for_logging(request.base_url)}")
        
        # Build exploration config
        try:
            config = ExplorationConfig(
                base_url=request.base_url,
                max_depth=request.max_depth,
                max_pages=request.max_pages,
                allowed_domains=request.allowed_domains or [],
                excluded_paths=request.excluded_paths or [],
                login_flow=request.login_flow,
                headless=request.headless,
                screenshot=request.screenshot,
                delay_between_pages=3.0,  # 3 second delay between pages (ethical/legal)
                respect_robots_txt=True,  # Check robots.txt
                wait_timeout=30000  # 30 second timeout for slow sites
            )
        except Exception as config_error:
            logger.error(f"Failed to create exploration config: {config_error}", exc_info=True)
            raise HTTPException(
                status_code=500,
                detail=f"Config creation failed: {str(config_error)}"
            )
        
        # Create exploration run record
        try:
            run_id = await storage.create_exploration_run(
                project_id=project_id,
                base_url=request.base_url,
                config=config.__dict__
            )
            logger.info(f"Created exploration run: {run_id}")
        except Exception as create_error:
            logger.error(f"Failed to create exploration run: {create_error}", exc_info=True)
            raise HTTPException(
                status_code=500,
                detail=f"Failed to create exploration run: {str(create_error)}"
            )
        
        try:
            # Run exploration with timeout
            try:
                explorer = AutonomousExplorer(config)
            except Exception as explorer_error:
                logger.error(f"Failed to create explorer: {explorer_error}", exc_info=True)
                await storage.update_exploration_run(
                    run_id=run_id,
                    status='failed',
                    error_message=f"Explorer creation failed: {str(explorer_error)}"
                )
                raise HTTPException(
                    status_code=500,
                    detail=f"Explorer creation failed: {str(explorer_error)}"
                )
            
            try:
                exploration_result = await asyncio.wait_for(
                    explorer.explore(),
                    timeout=600.0  # 10 minute timeout
                )
            except asyncio.TimeoutError:
                error_msg = "Exploration timed out after 10 minutes"
                logger.error(error_msg)
                await storage.update_exploration_run(
                    run_id=run_id,
                    status='failed',
                    error_message=error_msg
                )
                raise HTTPException(status_code=500, detail=error_msg)
            except Exception as explore_error:
                logger.error(f"Exploration failed: {explore_error}", exc_info=True)
                await storage.update_exploration_run(
                    run_id=run_id,
                    status='failed',
                    error_message=str(explore_error)
                )
                raise HTTPException(
                    status_code=500,
                    detail=f"Exploration failed: {str(explore_error)}"
                )
            
            # Update run status
            try:
                await storage.update_exploration_run(
                    run_id=run_id,
                    status='completed',
                    total_pages=exploration_result.get('total_pages', 0)
                )
            except Exception as update_error:
                logger.warning(f"Failed to update exploration run status: {update_error}")
            
            # Build capability map
            try:
                builder = CapabilityMapBuilder()
                capability_map_data = await builder.build_capability_map(exploration_result)
            except Exception as builder_error:
                logger.error(f"Failed to build capability map: {builder_error}", exc_info=True)
                # Continue without capability map rather than failing completely
                capability_map_data = {
                    'base_url': exploration_result.get('base_url'),
                    'exploration_date': exploration_result.get('exploration_date'),
                    'total_pages': exploration_result.get('total_pages'),
                    'entities': [],
                    'pages': exploration_result.get('pages', [])
                }
                logger.warning("Continuing without LLM-enriched capability map")
            
            # Save capability map
            try:
                map_id = await storage.save_capability_map(
                    exploration_run_id=run_id,
                    project_id=project_id,
                    base_url=request.base_url,
                    capability_data=capability_map_data
                )
            except Exception as save_error:
                logger.error(f"Failed to save capability map: {save_error}", exc_info=True)
                map_id = None
                logger.warning("Continuing without saving capability map to database")
            
            # Save defects detected during exploration
            defects_saved = 0
            if exploration_result.get('defects'):
                try:
                    from app.services.exploration.defect_storage import DefectStorage
                    from app.services.exploration.defect_detector import Defect
                    defect_storage = DefectStorage()
                    
                    # Convert defect dicts back to Defect objects
                    defects = []
                    for defect_data in exploration_result.get('defects', []):
                        try:
                            defect = Defect(**defect_data)
                            defects.append(defect)
                        except:
                            logger.warning(f"Failed to convert defect: {defect_data}")
                    
                    if defects:
                        defect_ids = await defect_storage.save_defects_batch(
                            defects,
                            exploration_run_id=run_id,
                            capability_map_id=map_id,
                            project_id=project_id
                        )
                        defects_saved = len(defect_ids)
                        logger.info(f"Saved {defects_saved} defects from exploration")
                except Exception as defect_error:
                    logger.error(f"Failed to save defects: {defect_error}", exc_info=True)
            
            return {
                "status": "success",
                "exploration_run_id": run_id,
                "capability_map_id": map_id,
                "exploration_result": exploration_result,
                "capability_map": capability_map_data,
                "defects_detected": len(exploration_result.get('defects', [])),
                "defects_saved": defects_saved,
                "timestamp": datetime.utcnow().isoformat()
            }
        
        except HTTPException:
            raise
        except Exception as e:
            # Update run status to failed
            try:
                await storage.update_exploration_run(
                    run_id=run_id,
                    status='failed',
                    error_message=str(e)
                )
            except:
                pass  # Ignore errors updating status
            raise
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Exploration failed with unexpected error: {e}", exc_info=True)
        import traceback
        error_detail = f"{str(e)}\n\nTraceback:\n{traceback.format_exc()}"
        raise HTTPException(
            status_code=500,
            detail="Exploration failed. Check server logs for details."
        )


@router.post("/compare-requirements")
async def compare_requirements(request: CompareRequirementsRequest):
    """
    Compare new requirements against a capability map.
    Returns gap analysis, impact assessment, and suggested tests.
    """
    try:
        logger.info(f"Comparing {len(request.requirements)} requirements against capability map")
        
        comparator = RequirementComparator()
        matches = await comparator.compare_requirements(
            request.requirements,
            request.capability_map
        )
        
        # Build summary
        summary = {
            "fully_supported": len([m for m in matches if m.status.value == "fully_supported"]),
            "partially_supported": len([m for m in matches if m.status.value == "partially_supported"]),
            "not_supported": len([m for m in matches if m.status.value == "not_supported"]),
            "conflicting": len([m for m in matches if m.status.value == "conflicting"])
        }
        
        return {
            "status": "success",
            "summary": summary,
            "matches": [
                {
                    "requirement_id": m.requirement_id,
                    "status": m.status.value,
                    "confidence": m.confidence,
                    "gaps": m.gaps,
                    "conflicts": m.conflicts,
                    "impacted_pages": m.impacted_pages,
                    "impact_type": m.impact_type,
                    "suggested_tests": m.suggested_tests
                }
                for m in matches
            ],
            "timestamp": datetime.utcnow().isoformat()
        }
    
    except Exception as e:
        logger.error(f"Requirement comparison failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Comparison failed")


@router.get("/capability-map/{map_id}")
async def get_capability_map(map_id: str):
    """Retrieve a stored capability map by ID."""
    storage = get_capability_map_storage()
    
    try:
        capability_map = await storage.get_capability_map(map_id)
        if not capability_map:
            raise HTTPException(status_code=404, detail="Capability map not found")
        
        return {
            "status": "success",
            "capability_map": capability_map
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get capability map: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to retrieve capability map")


@router.get("/capability-maps")
async def get_capability_maps(project_id: Optional[str] = None, limit: int = 10):
    """Get all capability maps for a project."""
    storage = get_capability_map_storage()
    
    try:
        if not project_id:
            _, project_id = await ensure_default_org_project()
        
        maps = await storage.get_capability_maps_by_project(project_id, limit)
        
        return {
            "status": "success",
            "capability_maps": maps,
            "count": len(maps)
        }
    except Exception as e:
        logger.error(f"Failed to get capability maps: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to retrieve capability maps")


@router.get("/exploration-run/{run_id}")
async def get_exploration_run(run_id: str):
    """Get exploration run details."""
    storage = get_capability_map_storage()
    
    try:
        run = await storage.get_exploration_run(run_id)
        if not run:
            raise HTTPException(status_code=404, detail="Exploration run not found")
        
        return {
            "status": "success",
            "exploration_run": run
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get exploration run: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to retrieve exploration run")

