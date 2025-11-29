"""
Shared helper functions for API endpoints
"""
import logging
from typing import Tuple, Optional
from fastapi import HTTPException
from app.services.storage.database import get_database_client

logger = logging.getLogger(__name__)

# Default IDs for test data
DEFAULT_USER_ID = "22222222-2222-2222-2222-222222222222"
DEFAULT_ORG_ID = "11111111-1111-1111-1111-111111111111"
DEFAULT_PROJECT_ID = "00000000-0000-0000-0000-000000000000"


def map_priority_from_db(priority: str) -> str:
    """Map database priority (P0, P1, P2, P3) to frontend format (critical, high, medium, low)"""
    priority_map = {
        "P0": "critical",
        "P1": "high",
        "P2": "medium",
        "P3": "low"
    }
    return priority_map.get(priority, "medium")


def map_priority_to_db(priority: str) -> str:
    """Map frontend priority (critical, high, medium, low) to database format (P0, P1, P2, P3)"""
    priority_map = {
        "critical": "P0",
        "high": "P1",
        "medium": "P2",
        "low": "P3"
    }
    return priority_map.get(priority, "P2")


async def ensure_default_org_project() -> Tuple[str, str]:
    """
    Ensure default organization and project exist.
    Returns (org_id, project_id) - uses actual IDs from database if they exist.
    """
    try:
        from app.services.storage.postgres_direct import execute_query, execute_insert
        from app.services.storage.database import get_database_client
        
        pool = get_database_client()
        if not pool or not hasattr(pool, 'getconn'):
            return DEFAULT_ORG_ID, DEFAULT_PROJECT_ID
        
        # Strategy: Find existing org/project by slug first, then by ID, then create if needed
        actual_org_id = None
        actual_project_id = None
        
        # Step 1: Find or create organization
        # Try to find by slug first (most reliable)
        orgs_by_slug = await execute_query("SELECT id FROM organizations WHERE slug = %s LIMIT 1", ("demo",))
        if orgs_by_slug:
            actual_org_id = orgs_by_slug[0][0] if isinstance(orgs_by_slug[0], tuple) else orgs_by_slug[0].get('id')
            logger.info(f"Found existing organization with slug 'demo': {actual_org_id}")
        else:
            # Try to find by default ID
            orgs_by_id = await execute_query("SELECT id FROM organizations WHERE id = %s", (DEFAULT_ORG_ID,))
            if orgs_by_id:
                actual_org_id = DEFAULT_ORG_ID
                logger.info(f"Found organization with default ID: {actual_org_id}")
            else:
                # Try to find any org (use first one found)
                any_orgs = await execute_query("SELECT id FROM organizations ORDER BY created_at LIMIT 1", ())
                if any_orgs:
                    actual_org_id = any_orgs[0][0] if isinstance(any_orgs[0], tuple) else any_orgs[0].get('id')
                    logger.info(f"Using existing organization: {actual_org_id}")
                else:
                    # Create new org - try with default ID first
                    try:
                        org_id = await execute_insert("organizations", {
                            "id": DEFAULT_ORG_ID,
                            "name": "Demo Organization",
                            "slug": "demo"
                        })
                        actual_org_id = org_id or DEFAULT_ORG_ID
                        logger.info(f"Created new organization: {actual_org_id}")
                    except Exception as e:
                        error_str = str(e)
                        if "slug" in error_str.lower() or "unique" in error_str.lower():
                            # Slug conflict - find existing org with that slug
                            orgs_by_slug = await execute_query("SELECT id FROM organizations WHERE slug = %s LIMIT 1", ("demo",))
                            if orgs_by_slug:
                                actual_org_id = orgs_by_slug[0][0] if isinstance(orgs_by_slug[0], tuple) else orgs_by_slug[0].get('id')
                                logger.info(f"Using existing organization with slug 'demo': {actual_org_id}")
                            else:
                                # Try any org
                                any_orgs = await execute_query("SELECT id FROM organizations ORDER BY created_at LIMIT 1", ())
                                if any_orgs:
                                    actual_org_id = any_orgs[0][0] if isinstance(any_orgs[0], tuple) else any_orgs[0].get('id')
                                    logger.info(f"Using first available organization: {actual_org_id}")
                                else:
                                    raise Exception(f"Cannot find or create organization: {e}")
                        else:
                            raise
        
        if not actual_org_id:
            raise Exception("Could not determine organization ID")
        
        # Step 2: Find or create project
        # Try to find by slug first (most reliable)
        projects_by_slug = await execute_query(
            "SELECT id FROM projects WHERE slug = %s AND org_id = %s LIMIT 1", 
            ("demo", actual_org_id)
        )
        if projects_by_slug:
            actual_project_id = projects_by_slug[0][0] if isinstance(projects_by_slug[0], tuple) else projects_by_slug[0].get('id')
            logger.info(f"Found existing project with slug 'demo': {actual_project_id}")
        else:
            # Try to find by default ID
            projects_by_id = await execute_query("SELECT id FROM projects WHERE id = %s", (DEFAULT_PROJECT_ID,))
            if projects_by_id:
                actual_project_id = DEFAULT_PROJECT_ID
                logger.info(f"Found project with default ID: {actual_project_id}")
            else:
                # Try to find any project for this org
                any_projects = await execute_query(
                    "SELECT id FROM projects WHERE org_id = %s ORDER BY created_at LIMIT 1", 
                    (actual_org_id,)
                )
                if any_projects:
                    actual_project_id = any_projects[0][0] if isinstance(any_projects[0], tuple) else any_projects[0].get('id')
                    logger.info(f"Using existing project: {actual_project_id}")
                else:
                    # Create new project
                    try:
                        project_id = await execute_insert("projects", {
                            "id": DEFAULT_PROJECT_ID,
                            "org_id": actual_org_id,  # Use actual_org_id, not DEFAULT_ORG_ID
                            "name": "Demo Project",
                            "slug": "demo"
                        })
                        actual_project_id = project_id or DEFAULT_PROJECT_ID
                        logger.info(f"Created new project: {actual_project_id}")
                    except Exception as e:
                        error_str = str(e)
                        if "slug" in error_str.lower() or "unique" in error_str.lower():
                            # Slug conflict - find existing project
                            projects_by_slug = await execute_query(
                                "SELECT id FROM projects WHERE slug = %s AND org_id = %s LIMIT 1", 
                                ("demo", actual_org_id)
                            )
                            if projects_by_slug:
                                actual_project_id = projects_by_slug[0][0] if isinstance(projects_by_slug[0], tuple) else projects_by_slug[0].get('id')
                                logger.info(f"Using existing project with slug 'demo': {actual_project_id}")
                            else:
                                # Try any project for this org
                                any_projects = await execute_query(
                                    "SELECT id FROM projects WHERE org_id = %s ORDER BY created_at LIMIT 1", 
                                    (actual_org_id,)
                                )
                                if any_projects:
                                    actual_project_id = any_projects[0][0] if isinstance(any_projects[0], tuple) else any_projects[0].get('id')
                                    logger.info(f"Using first available project: {actual_project_id}")
                                else:
                                    raise Exception(f"Cannot find or create project: {e}")
                        else:
                            raise
        
        if not actual_project_id:
            raise Exception("Could not determine project ID")
        
        # Step 3: Verify both exist
        orgs = await execute_query("SELECT id FROM organizations WHERE id = %s", (actual_org_id,))
        projects = await execute_query("SELECT id FROM projects WHERE id = %s", (actual_project_id,))
        
        if not orgs:
            raise Exception(f"Organization {actual_org_id} does not exist")
        if not projects:
            raise Exception(f"Project {actual_project_id} does not exist")
        
        logger.info(f"Using org_id={actual_org_id}, project_id={actual_project_id}")
        return actual_org_id, actual_project_id
    except Exception as e:
        logger.error(f"Error ensuring default org/project/user: {str(e)}", exc_info=True)
        # Don't silently return invalid IDs - raise the exception so caller knows
        raise HTTPException(
            status_code=500,
            detail=f"Failed to ensure default organization and project exist: {str(e)}"
        )


def map_priority(priority: str) -> str:
    """Map internal priority to API format (critical/high/medium/low -> P0/P1/P2/P3)"""
    priority_map = {
        "critical": "P0",
        "high": "P1", 
        "medium": "P2",
        "low": "P3"
    }
    return priority_map.get(priority, "P2")


def estimate_tokens(text: str) -> int:
    """Rough token estimation (4 chars per token)"""
    return len(text) // 4

