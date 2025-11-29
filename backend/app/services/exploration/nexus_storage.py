"""
Nexus Session Storage Service
Handles persistence of Nexus autonomous exploratory testing sessions to PostgreSQL
"""

import json
import logging
from typing import Dict, List, Optional, Any
from datetime import datetime
from uuid import UUID

from app.services.storage.postgres_direct import execute_query

logger = logging.getLogger(__name__)


class NexusStorage:
    """Storage service for Nexus sessions"""
    
    async def create_session(
        self,
        session_id: str,
        app_url: str,
        project_id: Optional[str] = None,
        max_duration_seconds: int = 1800,
        red_team_mode: bool = False
    ) -> Dict[str, Any]:
        """Create a new Nexus session in the database"""
        try:
            query = """
                INSERT INTO nexus_sessions (session_id, app_url, project_id, max_duration_seconds, red_team_mode, status)
                VALUES (%s, %s, %s, %s, %s, 'running')
                RETURNING id, session_id, app_url, project_id, status, started_at, max_duration_seconds, red_team_mode
            """
            result = await execute_query(
                query,
                (session_id, app_url, project_id, max_duration_seconds, red_team_mode)
            )
            
            if result and len(result) > 0:
                return dict(result[0])
            return {}
        except Exception as e:
            logger.error(f"Error creating Nexus session: {e}", exc_info=True)
            raise
    
    async def get_session(self, session_id: str) -> Optional[Dict[str, Any]]:
        """Get a Nexus session by session_id"""
        try:
            query = """
                SELECT id, session_id, app_url, project_id, status, started_at, completed_at,
                       max_duration_seconds, red_team_mode, proof, created_at, updated_at
                FROM nexus_sessions
                WHERE session_id = %s
            """
            result = await execute_query(query, (session_id,))
            
            if result and len(result) > 0:
                return dict(result[0])
            return None
        except Exception as e:
            logger.error(f"Error getting Nexus session: {e}", exc_info=True)
            return None
    
    async def update_session_status(
        self,
        session_id: str,
        status: str,
        proof: Optional[str] = None
    ) -> bool:
        """Update session status"""
        try:
            query = """
                UPDATE nexus_sessions
                SET status = %s, proof = %s, completed_at = CASE WHEN %s = 'complete' THEN NOW() ELSE completed_at END
                WHERE session_id = %s
            """
            await execute_query(query, (status, proof, status, session_id))
            return True
        except Exception as e:
            logger.error(f"Error updating session status: {e}", exc_info=True)
            return False
    
    async def save_queue_item(
        self,
        session_id: str,
        priority: int,
        capability: Optional[str] = None,
        url: Optional[str] = None,
        flow_steps: Optional[List[str]] = None,
        metadata: Optional[Dict] = None
    ) -> bool:
        """Save a queue item to the database"""
        try:
            query = """
                INSERT INTO nexus_session_queue (session_id, priority, capability, url, flow_steps, metadata)
                VALUES (%s, %s, %s, %s, %s::jsonb, %s::jsonb)
            """
            await execute_query(
                query,
                (session_id, priority, capability, url, json.dumps(flow_steps or []), json.dumps(metadata or {}))
            )
            return True
        except Exception as e:
            logger.error(f"Error saving queue item: {e}", exc_info=True)
            return False
    
    async def get_queue_items(self, session_id: str, unprocessed_only: bool = True) -> List[Dict[str, Any]]:
        """Get queue items for a session"""
        try:
            if unprocessed_only:
                query = """
                    SELECT id, priority, capability, url, flow_steps, metadata
                    FROM nexus_session_queue
                    WHERE session_id = %s AND processed = FALSE
                    ORDER BY priority ASC, created_at ASC
                """
            else:
                query = """
                    SELECT id, priority, capability, url, flow_steps, metadata
                    FROM nexus_session_queue
                    WHERE session_id = %s
                    ORDER BY priority ASC, created_at ASC
                """
            result = await execute_query(query, (session_id,))
            return [dict(row) for row in result]
        except Exception as e:
            logger.error(f"Error getting queue items: {e}", exc_info=True)
            return []
    
    async def mark_queue_item_processed(self, queue_item_id: str) -> bool:
        """Mark a queue item as processed"""
        try:
            query = """
                UPDATE nexus_session_queue
                SET processed = TRUE, processed_at = NOW()
                WHERE id = %s
            """
            await execute_query(query, (queue_item_id,))
            return True
        except Exception as e:
            logger.error(f"Error marking queue item processed: {e}", exc_info=True)
            return False
    
    async def save_risk_heatmap(
        self,
        session_id: str,
        capability: str,
        risk_level: str,
        reason: Optional[str] = None
    ) -> bool:
        """Save or update risk heatmap entry"""
        try:
            query = """
                INSERT INTO nexus_risk_heatmap (session_id, capability, risk_level, reason)
                VALUES (%s, %s, %s, %s)
                ON CONFLICT (session_id, capability)
                DO UPDATE SET risk_level = EXCLUDED.risk_level, reason = EXCLUDED.reason, updated_at = NOW()
            """
            await execute_query(query, (session_id, capability, risk_level, reason))
            return True
        except Exception as e:
            logger.error(f"Error saving risk heatmap: {e}", exc_info=True)
            return False
    
    async def get_risk_heatmap(self, session_id: str) -> Dict[str, str]:
        """Get risk heatmap for a session"""
        try:
            query = """
                SELECT capability, risk_level
                FROM nexus_risk_heatmap
                WHERE session_id = %s
            """
            result = await execute_query(query, (session_id,))
            return {row['capability']: row['risk_level'] for row in result}
        except Exception as e:
            logger.error(f"Error getting risk heatmap: {e}", exc_info=True)
            return {}
    
    async def save_history_message(
        self,
        session_id: str,
        role: str,
        content: Optional[str] = None,
        tool_calls: Optional[List] = None,
        tool_results: Optional[Dict] = None,
        sequence_number: int = 0
    ) -> bool:
        """Save a message to session history"""
        try:
            query = """
                INSERT INTO nexus_session_history (session_id, role, content, tool_calls, tool_results, sequence_number)
                VALUES (%s, %s, %s, %s::jsonb, %s::jsonb, %s)
            """
            await execute_query(
                query,
                (
                    session_id,
                    role,
                    content,
                    json.dumps(tool_calls or []),
                    json.dumps(tool_results or {}),
                    sequence_number
                )
            )
            return True
        except Exception as e:
            logger.error(f"Error saving history message: {e}", exc_info=True)
            return False
    
    async def get_session_history(self, session_id: str, limit: int = 100) -> List[Dict[str, Any]]:
        """Get session history"""
        try:
            query = """
                SELECT role, content, tool_calls, tool_results, sequence_number, created_at
                FROM nexus_session_history
                WHERE session_id = %s
                ORDER BY sequence_number ASC
                LIMIT %s
            """
            result = await execute_query(query, (session_id, limit))
            return [dict(row) for row in result]
        except Exception as e:
            logger.error(f"Error getting session history: {e}", exc_info=True)
            return []
    
    async def save_defect(
        self,
        session_id: str,
        defect_type: str,
        severity: str,
        title: str,
        description: str,
        page_url: Optional[str] = None,
        evidence: Optional[Dict] = None
    ) -> Optional[str]:
        """Save a detected defect"""
        try:
            query = """
                INSERT INTO nexus_defects (session_id, defect_type, severity, title, description, page_url, evidence)
                VALUES (%s, %s, %s, %s, %s, %s, %s::jsonb)
                RETURNING id
            """
            result = await execute_query(
                query,
                (session_id, defect_type, severity, title, description, page_url, json.dumps(evidence or {}))
            )
            if result and len(result) > 0:
                return str(result[0]['id'])
            return None
        except Exception as e:
            logger.error(f"Error saving defect: {e}", exc_info=True)
            return None
    
    async def get_session_defects(self, session_id: str) -> List[Dict[str, Any]]:
        """Get all defects for a session"""
        try:
            query = """
                SELECT id, defect_type, severity, title, description, page_url, evidence, detected_at
                FROM nexus_defects
                WHERE session_id = %s
                ORDER BY detected_at DESC
            """
            result = await execute_query(query, (session_id,))
            return [dict(row) for row in result]
        except Exception as e:
            logger.error(f"Error getting session defects: {e}", exc_info=True)
            return []
    
    async def save_e2e_result(
        self,
        session_id: str,
        flow_name: str,
        steps: List[str],
        negative: bool,
        success: bool,
        execution_time_seconds: Optional[float] = None,
        evidence: Optional[Dict] = None,
        error_message: Optional[str] = None,
        defect_id: Optional[str] = None
    ) -> Optional[str]:
        """Save E2E flow execution result"""
        try:
            query = """
                INSERT INTO nexus_e2e_results (session_id, flow_name, steps, negative, success,
                                               execution_time_seconds, evidence, error_message, defect_id)
                VALUES (%s, %s, %s::jsonb, %s, %s, %s, %s::jsonb, %s, %s)
                RETURNING id
            """
            result = await execute_query(
                query,
                (
                    session_id, flow_name, json.dumps(steps), negative, success,
                    execution_time_seconds, json.dumps(evidence or {}), error_message, defect_id
                )
            )
            if result and len(result) > 0:
                return str(result[0]['id'])
            return None
        except Exception as e:
            logger.error(f"Error saving E2E result: {e}", exc_info=True)
            return None
    
    async def get_e2e_results(self, session_id: str) -> List[Dict[str, Any]]:
        """Get all E2E results for a session"""
        try:
            query = """
                SELECT id, flow_name, steps, negative, success, execution_time_seconds,
                       evidence, error_message, defect_id, executed_at
                FROM nexus_e2e_results
                WHERE session_id = %s
                ORDER BY executed_at DESC
            """
            result = await execute_query(query, (session_id,))
            return [dict(row) for row in result]
        except Exception as e:
            logger.error(f"Error getting E2E results: {e}", exc_info=True)
            return []
