"""
Service to store test run results in database
Aligns with test_run_steps and artifacts tables
"""

import os
import logging
from typing import Dict, Any, Optional, List
from datetime import datetime

logger = logging.getLogger(__name__)

try:
    from supabase import create_client, Client
    from app.services.database import get_database_client
    from app.services.postgres_direct import execute_insert
except ImportError:
    def get_database_client():
        return None
    def execute_insert():
        return None


async def store_test_run(
    project_id: str,
    name: str,
    status: str,
    environment: Optional[str] = None,
    branch: Optional[str] = None,
    commit: Optional[str] = None,
    runner_version: Optional[str] = None,
    started_at: Optional[str] = None,
    completed_at: Optional[str] = None,
    created_by: Optional[str] = None
) -> Optional[str]:
    """Store a test run record"""
    try:
        client = get_database_client()
        if not client:
            logger.warning("No database client available")
            return None
        
        data = {
            "project_id": project_id,
            "name": name,
            "status": status,
            "environment": environment or "local",
            "branch": branch,
            "commit": commit,
            "runner_version": runner_version,
            "started_at": started_at,
            "completed_at": completed_at,
            "created_by": created_by or "22222222-2222-2222-2222-222222222222"  # DEFAULT_USER_ID
        }
        
        # Try direct Postgres first
        if hasattr(client, 'getconn'):
            # Direct Postgres
            try:
                from app.services.postgres_direct import execute_insert
                return await execute_insert("test_runs", data)
            except Exception as e:
                logger.error(f"Postgres insert error: {str(e)}")
                return None
        elif hasattr(client, 'table'):
            # Supabase
            result = client.table("test_runs").insert(data).execute()
            if result.data:
                return result.data[0].get("id")
            return None
        
        return None
    except Exception as e:
        logger.error(f"Error storing test run: {str(e)}")
        return None


async def store_test_run_step(
    run_id: str,
    case_id: str,
    title: str,
    status: str,
    duration_ms: Optional[int] = None,
    error_message: Optional[str] = None,
    stdout: Optional[str] = None,
    stderr: Optional[str] = None,
    started_at: Optional[str] = None,
    completed_at: Optional[str] = None
) -> Optional[str]:
    """Store a test run step (individual test case result)"""
    try:
        client = get_database_client()
        if not client:
            return None
        
        data = {
            "run_id": run_id,
            "case_id": case_id,
            "title": title,
            "status": status,
            "duration_ms": duration_ms or 0,
            "error_message": error_message,
            "stdout": stdout,
            "stderr": stderr,
            "started_at": started_at,
            "completed_at": completed_at
        }
        
        # Try direct Postgres first
        if hasattr(client, 'getconn'):
            try:
                from app.services.postgres_direct import execute_insert
                step_id = await execute_insert("test_run_steps", data)
                if step_id:
                    logger.info(f"Created test_run_step: id={step_id}, run_id={run_id}, case_id={case_id}, title={title}")
                else:
                    logger.warning(f"Failed to create test_run_step: execute_insert returned None")
                return step_id
            except Exception as e:
                logger.error(f"Postgres insert error: {str(e)}")
                import traceback
                logger.error(f"Traceback: {traceback.format_exc()}")
                return None
        elif hasattr(client, 'table'):
            result = client.table("test_run_steps").insert(data).execute()
            if result.data:
                return result.data[0].get("id")
            return None
        
        return None
    except Exception as e:
        logger.error(f"Error storing test run step: {str(e)}")
        return None


async def store_artifact(
    run_id: Optional[str],
    step_id: Optional[str],
    artifact_type: str,
    url: str,
    size_bytes: Optional[int] = None,
    checksum: Optional[str] = None,
    metadata: Optional[Dict[str, Any]] = None
) -> Optional[str]:
    """Store an artifact (screenshot, video, log, etc.)"""
    try:
        client = get_database_client()
        if not client:
            return None
        
        if not run_id and not step_id:
            logger.warning("Must provide either run_id or step_id")
            return None
        
        data = {
            "run_id": run_id,
            "step_id": step_id,
            "type": artifact_type,
            "url": url,
            "size_bytes": size_bytes,
            "checksum": checksum,
            "metadata": metadata or {}
        }
        
        # Try direct Postgres first
        if hasattr(client, 'getconn'):
            try:
                from app.services.postgres_direct import execute_insert
                return await execute_insert("artifacts", data)
            except Exception as e:
                logger.error(f"Postgres insert error: {str(e)}")
                return None
        elif hasattr(client, 'table'):
            result = client.table("artifacts").insert(data).execute()
            if result.data:
                return result.data[0].get("id")
            return None
        
        return None
    except Exception as e:
        logger.error(f"Error storing artifact: {str(e)}")
        return None

