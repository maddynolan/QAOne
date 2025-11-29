"""
Defect Storage Service
Handles storage of defects detected during exploration.
"""

import logging
from typing import Dict, List, Any, Optional
from datetime import datetime
from uuid import uuid4
import json

from app.services.storage.postgres_direct import execute_query
# Import Defect from sync version (used in both async and sync contexts)
try:
    from app.services.exploration.defect_detector_sync import Defect
except ImportError:
    from app.services.exploration.defect_detector import Defect

logger = logging.getLogger(__name__)


class DefectStorage:
    """Storage service for exploration defects."""
    
    async def save_defect(
        self,
        defect: Defect,
        exploration_run_id: Optional[str] = None,
        capability_map_id: Optional[str] = None,
        project_id: Optional[str] = None
    ) -> str:
        """Save a defect to the database."""
        defect_id = str(uuid4())
        
        # Map severity to priority (for compatibility with existing system)
        severity_to_priority = {
            'critical': 'P0',
            'high': 'P1',
            'medium': 'P2',
            'low': 'P3'
        }
        priority = severity_to_priority.get(defect.severity, 'P2')
        
        query = """
            INSERT INTO defects (
                id, exploration_run_id, capability_map_id, project_id,
                defect_type, severity, priority, status,
                title, description,
                page_url, page_id, element_selector,
                screenshot_path,
                console_errors, network_errors, evidence,
                steps_to_reproduce, expected_behavior, actual_behavior,
                detected_at, created_at, updated_at
            )
            VALUES (
                %s, %s, %s, %s,
                %s, %s, %s, 'open',
                %s, %s,
                %s, %s, %s,
                %s,
                %s::jsonb, %s::jsonb, %s::jsonb,
                %s, %s, %s,
                %s, NOW(), NOW()
            )
            RETURNING id
        """
        
        try:
            # Convert lists to JSON
            console_errors_json = json.dumps(defect.console_errors) if defect.console_errors else '[]'
            network_errors_json = json.dumps(defect.network_errors) if defect.network_errors else '[]'
            evidence_json = json.dumps(defect.evidence) if defect.evidence else '{}'
            
            result = await execute_query(
                query,
                (
                    defect_id,
                    exploration_run_id,
                    capability_map_id,
                    project_id,
                    defect.defect_type,
                    defect.severity,
                    priority,
                    defect.title,
                    defect.description,
                    defect.page_url,
                    defect.page_id,
                    defect.element_selector,
                    defect.screenshot_path,
                    console_errors_json,
                    network_errors_json,
                    evidence_json,
                    defect.steps_to_reproduce,
                    defect.expected_behavior,
                    defect.actual_behavior,
                    defect.detected_at
                )
            )
            
            if result and len(result) > 0:
                returned_id = result[0].get('id') or defect_id
                logger.info(f"Saved defect: {returned_id} - {defect.title}")
                return str(returned_id)
            else:
                logger.warning(f"No ID returned, using generated: {defect_id}")
                return defect_id
                
        except Exception as e:
            logger.error(f"Failed to save defect: {e}", exc_info=True)
            raise
    
    async def save_defects_batch(
        self,
        defects: List[Defect],
        exploration_run_id: Optional[str] = None,
        capability_map_id: Optional[str] = None,
        project_id: Optional[str] = None
    ) -> List[str]:
        """Save multiple defects in batch."""
        defect_ids = []
        
        for defect in defects:
            try:
                defect_id = await self.save_defect(
                    defect,
                    exploration_run_id,
                    capability_map_id,
                    project_id
                )
                defect_ids.append(defect_id)
            except Exception as e:
                logger.error(f"Failed to save defect {defect.title}: {e}")
        
        logger.info(f"Saved {len(defect_ids)}/{len(defects)} defects")
        return defect_ids
    
    async def get_defects_by_exploration(
        self,
        exploration_run_id: str
    ) -> List[Dict[str, Any]]:
        """Get all defects for an exploration run."""
        query = """
            SELECT id, exploration_run_id, defect_type, severity, status,
                   title, description, page_url, page_id, element_selector,
                   screenshot_path, console_errors, network_errors, evidence,
                   steps_to_reproduce, expected_behavior, actual_behavior,
                   detected_at, created_at
            FROM defects
            WHERE exploration_run_id = %s
            ORDER BY detected_at DESC
        """
        
        try:
            results = await execute_query(query, (exploration_run_id,))
            return results or []
        except Exception as e:
            logger.error(f"Failed to get defects: {e}", exc_info=True)
            return []
    
    async def get_defects_by_type(
        self,
        defect_type: str,
        project_id: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Get defects by type."""
        query = """
            SELECT id, exploration_run_id, defect_type, severity, status,
                   title, description, page_url, page_id,
                   detected_at, created_at
            FROM defects
            WHERE defect_type = %s
        """
        params = [defect_type]
        
        if project_id:
            query += " AND project_id = %s"
            params.append(project_id)
        
        query += " ORDER BY detected_at DESC"
        
        try:
            results = await execute_query(query, tuple(params))
            return results or []
        except Exception as e:
            logger.error(f"Failed to get defects by type: {e}", exc_info=True)
            return []

