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
    from app.services.storage.database import get_database_client
    from app.services.storage.postgres_direct import execute_insert
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
        
        # Always try direct Postgres first (most reliable)
        try:
            from app.services.storage.postgres_direct import execute_insert, get_postgres_pool
            pool = get_postgres_pool()
            if pool:
                logger.info(f"Creating test run via direct Postgres: {name}")
                run_id = await execute_insert("test_runs", data)
                if run_id:
                    logger.info(f"✅ Created test run: {run_id}")
                    return run_id
        except Exception as e:
            logger.warning(f"Direct Postgres insert failed: {str(e)}, trying database client")
        
        # Fallback to database client
        client = get_database_client()
        if client:
            if hasattr(client, 'getconn'):
                # Direct Postgres (already tried above, but try again)
                try:
                    from app.services.storage.postgres_direct import execute_insert
                    return await execute_insert("test_runs", data)
                except Exception as e:
                    logger.error(f"Postgres insert error: {str(e)}")
            elif hasattr(client, 'table'):
                # Supabase
                result = client.table("test_runs").insert(data).execute()
                if result.data:
                    return result.data[0].get("id")
        
        logger.warning("No database connection available for test run creation")
        return None
    except Exception as e:
        logger.error(f"Error storing test run: {str(e)}")
        import traceback
        logger.error(f"Traceback: {traceback.format_exc()}")
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
    print(f"[INFO] STORE STEP - Function called: run_id={run_id}, case_id={case_id}, title={title[:50]}")
    try:
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
        
        # Always try direct Postgres first (this is the primary method)
        try:
            from app.services.storage.postgres_direct import execute_insert, get_postgres_pool
            pool = get_postgres_pool()
            if pool:
                print(f"[INFO] STORE STEP - Using direct Postgres, inserting into test_run_steps: run_id={run_id}, case_id={case_id}, title={title[:50]}")
                step_id = await execute_insert("test_run_steps", data)
                if step_id:
                    print(f"[OK] STORE STEP - Created test_run_step: id={step_id}, run_id={run_id}, case_id={case_id}")
                    logger.info(f"Created test_run_step: id={step_id}, run_id={run_id}, case_id={case_id}, title={title}")
                    return step_id
                else:
                    print(f"[ERROR] STORE STEP - execute_insert returned None for run_id={run_id}, case_id={case_id}")
                    logger.warning(f"Failed to create test_run_step: execute_insert returned None")
            else:
                print(f"[WARN] STORE STEP - Postgres pool not available, trying database client...")
        except Exception as e:
            print(f"[WARN] STORE STEP - Direct Postgres failed: {str(e)}, trying database client...")
            logger.warning(f"Direct Postgres insert failed: {str(e)}")
        
        # Fallback to database client (Supabase or other)
        client = get_database_client()
        if client and hasattr(client, 'table'):
            try:
                result = client.table("test_run_steps").insert(data).execute()
                if result.data:
                    step_id = result.data[0].get("id")
                    print(f"[OK] STORE STEP - Created test_run_step via Supabase: id={step_id}")
                    return step_id
            except Exception as e:
                logger.error(f"Supabase insert error: {str(e)}")
        
        print(f"[ERROR] STORE STEP - All insert methods failed")
        logger.error(f"Failed to store test run step: no database connection available")
        return None
    except Exception as e:
        print(f"[ERROR] STORE STEP - Error: {str(e)}")
        logger.error(f"Error storing test run step: {str(e)}")
        import traceback
        logger.error(f"Traceback: {traceback.format_exc()}")
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
                from app.services.storage.postgres_direct import execute_insert
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

