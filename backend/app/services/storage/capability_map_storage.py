# DEPRECATED — Scheduled for removal (v3.20.0)
# Part of the Autonomous Explorer / Flowmap system which is unused.
"""
Storage service for capability maps and exploration results.
Handles persistence of exploration runs, capability maps, and comparisons.
"""

import logging
from typing import Dict, List, Any, Optional
from datetime import datetime
from uuid import uuid4, UUID

from app.services.storage.postgres_direct import execute_query, execute_insert

logger = logging.getLogger(__name__)


class CapabilityMapStorage:
    """Storage service for capability maps and exploration data."""
    
    async def create_exploration_run(
        self,
        project_id: str,
        base_url: str,
        config: Dict[str, Any],
        created_by: Optional[str] = None
    ) -> str:
        """Create a new exploration run record."""
        run_id = str(uuid4())
        
        # Verify table exists using information_schema (most reliable)
        try:
            check_result = await execute_query(
                "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'exploration_runs'"
            )
            if not check_result or len(check_result) == 0:
                logger.error("Table 'exploration_runs' not found in information_schema!")
                # Force connection pool reset
                from app.services.storage.postgres_direct import reset_connection_pool
                reset_connection_pool()
                logger.error("Connection pool reset. RESTART BACKEND SERVER to apply changes.")
                raise Exception("Table 'exploration_runs' does not exist. Restart backend server after running: python scripts/create_exploration_tables.py")
            logger.debug(f"Table verification passed: {check_result}")
        except Exception as check_error:
            if "Restart backend" in str(check_error) or "does not exist" in str(check_error):
                raise
            logger.warning(f"Table verification warning: {check_error}")
        
        query = """
            INSERT INTO exploration_runs (id, project_id, base_url, config, status, created_by)
            VALUES (%s, %s, %s, %s::jsonb, 'running', %s)
            RETURNING id
        """
        
        # Convert config dict to JSON string for JSONB column
        import json
        config_json = json.dumps(config) if isinstance(config, dict) else config
        
        try:
            # Use execute_query for INSERT with RETURNING
            result = await execute_query(
                query,
                (run_id, project_id, base_url, config_json, created_by)
            )
            if result and len(result) > 0:
                # Extract ID from result (result is a list of dicts with 'id' key)
                returned_id = result[0].get('id') or run_id
                logger.info(f"Created exploration run: {returned_id}")
                return str(returned_id)
            else:
                # If no result, return the run_id we generated
                logger.warning(f"No ID returned from query, using generated run_id: {run_id}")
                return run_id
        except Exception as e:
            logger.error(f"Failed to create exploration run: {e}")
            raise
    
    async def update_exploration_run(
        self,
        run_id: str,
        status: str,
        total_pages: Optional[int] = None,
        error_message: Optional[str] = None
    ) -> bool:
        """Update exploration run status and results."""
        updates = []
        params = []
        
        updates.append("status = %s")
        params.append(status)
        
        if total_pages is not None:
            updates.append("total_pages_discovered = %s")
            params.append(total_pages)
        
        if error_message:
            updates.append("error_message = %s")
            params.append(error_message)
        
        if status == 'completed' or status == 'failed':
            updates.append("completed_at = NOW()")
        
        updates.append("updated_at = NOW()")
        params.append(run_id)
        
        query = f"""
            UPDATE exploration_runs
            SET {', '.join(updates)}
            WHERE id = %s
        """
        
        try:
            await execute_query(query, tuple(params))
            logger.info(f"Updated exploration run: {run_id} to status: {status}")
            return True
        except Exception as e:
            logger.error(f"Failed to update exploration run: {e}")
            return False
    
    async def save_capability_map(
        self,
        exploration_run_id: str,
        project_id: str,
        base_url: str,
        capability_data: Dict[str, Any]
    ) -> str:
        """Save a capability map."""
        map_id = str(uuid4())
        
        # Count entities and capabilities
        entities = capability_data.get('entities', [])
        total_entities = len(set(e.get('entity', '') for e in entities))
        total_capabilities = len(entities)
        
        query = """
            INSERT INTO capability_maps (
                id, exploration_run_id, project_id, base_url,
                capability_data, total_entities, total_capabilities
            )
            VALUES (%s, %s, %s, %s, %s::jsonb, %s, %s)
            RETURNING id
        """
        
        # Convert capability_data dict to JSON string for JSONB column
        import json
        capability_data_json = json.dumps(capability_data) if isinstance(capability_data, dict) else capability_data
        
        try:
            # Use execute_query for INSERT with RETURNING
            result = await execute_query(
                query,
                (map_id, exploration_run_id, project_id, base_url, capability_data_json, total_entities, total_capabilities)
            )
            if result and len(result) > 0:
                # Extract ID from result
                returned_id = result[0].get('id') or map_id
                logger.info(f"Saved capability map: {returned_id} ({total_entities} entities, {total_capabilities} capabilities)")
                return str(returned_id)
            else:
                # If no result, return the map_id we generated
                logger.warning(f"No ID returned from query, using generated map_id: {map_id}")
                return map_id
        except Exception as e:
            logger.error(f"Failed to save capability map: {e}")
            raise
    
    async def get_capability_map(self, map_id: str) -> Optional[Dict[str, Any]]:
        """Retrieve a capability map by ID."""
        query = """
            SELECT id, exploration_run_id, project_id, base_url,
                   capability_data, total_entities, total_capabilities,
                   version, created_at, updated_at
            FROM capability_maps
            WHERE id = %s
        """
        
        try:
            results = await execute_query(query, (map_id,))
            if results and len(results) > 0:
                row = results[0]
                return {
                    'id': row['id'],
                    'exploration_run_id': row['exploration_run_id'],
                    'project_id': row['project_id'],
                    'base_url': row['base_url'],
                    'capability_data': row['capability_data'],
                    'total_entities': row['total_entities'],
                    'total_capabilities': row['total_capabilities'],
                    'version': row['version'],
                    'created_at': row['created_at'].isoformat() if row['created_at'] else None,
                    'updated_at': row['updated_at'].isoformat() if row['updated_at'] else None
                }
            return None
        except Exception as e:
            logger.error(f"Failed to get capability map: {e}")
            return None
    
    async def get_capability_maps_by_project(
        self,
        project_id: str,
        limit: int = 10
    ) -> List[Dict[str, Any]]:
        """Get all capability maps for a project."""
        query = """
            SELECT id, exploration_run_id, base_url, total_entities,
                   total_capabilities, version, created_at, updated_at
            FROM capability_maps
            WHERE project_id = %s
            ORDER BY created_at DESC
            LIMIT %s
        """
        
        try:
            results = await execute_query(query, (project_id, limit))
            return [
                {
                    'id': row['id'],
                    'exploration_run_id': row['exploration_run_id'],
                    'base_url': row['base_url'],
                    'total_entities': row['total_entities'],
                    'total_capabilities': row['total_capabilities'],
                    'version': row['version'],
                    'created_at': row['created_at'].isoformat() if row['created_at'] else None,
                    'updated_at': row['updated_at'].isoformat() if row['updated_at'] else None
                }
                for row in results
            ]
        except Exception as e:
            logger.error(f"Failed to get capability maps: {e}")
            return []
    
    async def save_requirement_comparison(
        self,
        capability_map_id: str,
        requirement_id: str,
        project_id: str,
        comparison_result: Dict[str, Any]
    ) -> str:
        """Save a requirement comparison result."""
        comp_id = str(uuid4())
        
        # Convert dict/list values to JSON strings for JSONB columns
        import json
        gaps_json = json.dumps(comparison_result.get('gaps', []))
        conflicts_json = json.dumps(comparison_result.get('conflicts', []))
        impacted_pages_json = json.dumps(comparison_result.get('impacted_pages', []))
        suggested_tests_json = json.dumps(comparison_result.get('suggested_tests', []))
        comparison_data_json = json.dumps(comparison_result)
        
        query = """
            INSERT INTO requirement_comparisons (
                id, capability_map_id, requirement_id, project_id,
                status, confidence, gaps, conflicts, impacted_pages,
                impact_type, suggested_tests, comparison_data
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s::jsonb, %s::jsonb, %s::jsonb, %s, %s::jsonb, %s::jsonb)
            RETURNING id
        """
        
        try:
            # Use execute_query for INSERT with RETURNING
            result = await execute_query(
                query,
                (
                    comp_id, capability_map_id, requirement_id, project_id,
                    comparison_result.get('status', ''),
                    comparison_result.get('confidence', 0.0),
                    gaps_json,
                    conflicts_json,
                    impacted_pages_json,
                    comparison_result.get('impact_type', ''),
                    suggested_tests_json,
                    comparison_data_json
                )
            )
            if result and len(result) > 0:
                # Extract ID from result
                returned_id = result[0].get('id') or comp_id
                logger.info(f"Saved requirement comparison: {returned_id}")
                return str(returned_id)
            else:
                # If no result, return the comp_id we generated
                logger.warning(f"No ID returned from query, using generated comp_id: {comp_id}")
                return comp_id
        except Exception as e:
            logger.error(f"Failed to save requirement comparison: {e}")
            raise
    
    async def get_exploration_run(self, run_id: str) -> Optional[Dict[str, Any]]:
        """Get exploration run details."""
        query = """
            SELECT id, project_id, base_url, status, config,
                   started_at, completed_at, total_pages_discovered,
                   error_message, created_at
            FROM exploration_runs
            WHERE id = %s
        """
        
        try:
            results = await execute_query(query, (run_id,))
            if results and len(results) > 0:
                row = results[0]
                return {
                    'id': row['id'],
                    'project_id': row['project_id'],
                    'base_url': row['base_url'],
                    'status': row['status'],
                    'config': row['config'],
                    'started_at': row['started_at'].isoformat() if row['started_at'] else None,
                    'completed_at': row['completed_at'].isoformat() if row['completed_at'] else None,
                    'total_pages_discovered': row['total_pages_discovered'],
                    'error_message': row['error_message'],
                    'created_at': row['created_at'].isoformat() if row['created_at'] else None
                }
            return None
        except Exception as e:
            logger.error(f"Failed to get exploration run: {e}")
            return None


# Singleton instance
_capability_map_storage = None

def get_capability_map_storage() -> CapabilityMapStorage:
    """Get singleton instance of capability map storage."""
    global _capability_map_storage
    if _capability_map_storage is None:
        _capability_map_storage = CapabilityMapStorage()
    return _capability_map_storage

