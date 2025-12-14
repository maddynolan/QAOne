"""
Exploration Reporting Service
Generates comprehensive reports for exploration results, test cases, and defects.
"""

import logging
from typing import Dict, List, Any, Optional
from datetime import datetime
from collections import defaultdict

from app.services.storage.capability_map_storage import get_capability_map_storage
from app.services.exploration.defect_storage import DefectStorage
from app.services.storage.postgres_direct import execute_query

logger = logging.getLogger(__name__)


class ExplorationReporting:
    """Generates reports for exploration-driven testing."""
    
    def __init__(self):
        self.defect_storage = DefectStorage()
        self.capability_storage = get_capability_map_storage()
    
    async def generate_exploration_report(
        self,
        exploration_run_id: str,
        project_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Generate comprehensive report for an exploration run.
        
        Args:
            exploration_run_id: Exploration run ID
            project_id: Project ID
        
        Returns:
            Comprehensive exploration report
        """
        logger.info(f"Generating exploration report for run: {exploration_run_id}")
        
        # Get exploration run details
        exploration_run = await self._get_exploration_run(exploration_run_id)
        if not exploration_run:
            raise ValueError(f"Exploration run {exploration_run_id} not found")
        
        # Get capability map
        capability_map_id = None
        capability_map = None
        if exploration_run.get('capability_map_id'):
            capability_map_id = exploration_run['capability_map_id']
            map_data = await self.capability_storage.get_capability_map(capability_map_id)
            if map_data:
                capability_map = map_data.get('capability_data')
        
        # Get defects
        defects = await self.defect_storage.get_defects_by_exploration(exploration_run_id)
        
        # Get test execution results
        test_results = await self._get_test_execution_results(exploration_run_id)
        
        # Build report
        report = {
            'exploration_run_id': exploration_run_id,
            'base_url': exploration_run.get('base_url', ''),
            'total_pages': exploration_run.get('total_pages_discovered', 0),
            'total_defects': len(defects),
            'defects_by_type': self._group_defects_by_type(defects),
            'defects_by_severity': self._group_defects_by_severity(defects),
            'capability_map_summary': self._summarize_capability_map(capability_map) if capability_map else {},
            'test_execution_summary': self._summarize_test_execution(test_results),
            'generated_at': datetime.utcnow().isoformat()
        }
        
        return report
    
    async def _get_exploration_run(self, run_id: str) -> Optional[Dict[str, Any]]:
        """Get exploration run details."""
        query = """
            SELECT id, project_id, base_url, status, total_pages_discovered,
                   error_message, created_at, completed_at
            FROM exploration_runs
            WHERE id = %s
        """
        
        try:
            results = await execute_query(query, (run_id,))
            if results and len(results) > 0:
                return results[0]
        except Exception as e:
            logger.error(f"Failed to get exploration run: {e}")
        
        return None
    
    async def _get_test_execution_results(self, exploration_run_id: str) -> List[Dict[str, Any]]:
        """Get test execution results for exploration run."""
        query = """
            SELECT id, test_case_id, status, execution_time_ms,
                   error_message, defect_id, executed_at
            FROM test_execution_results
            WHERE exploration_run_id = %s
            ORDER BY executed_at DESC
        """
        
        try:
            results = await execute_query(query, (exploration_run_id,))
            return results or []
        except Exception as e:
            logger.error(f"Failed to get test execution results: {e}")
            return []
    
    def _group_defects_by_type(self, defects: List[Dict]) -> Dict[str, int]:
        """Group defects by type."""
        grouped = defaultdict(int)
        for defect in defects:
            defect_type = defect.get('defect_type', 'unknown')
            grouped[defect_type] += 1
        return dict(grouped)
    
    def _group_defects_by_severity(self, defects: List[Dict]) -> Dict[str, int]:
        """Group defects by severity."""
        grouped = defaultdict(int)
        for defect in defects:
            severity = defect.get('severity', 'unknown')
            grouped[severity] += 1
        return dict(grouped)
    
    def _summarize_capability_map(self, capability_map: Dict[str, Any]) -> Dict[str, Any]:
        """Summarize capability map."""
        if not capability_map:
            return {}
        
        entities = capability_map.get('entities', [])
        pages = capability_map.get('pages', [])
        
        # Count operations by entity
        entity_operations = defaultdict(set)
        for entity_cap in entities:
            entity = entity_cap.get('entity', '')
            operation = entity_cap.get('operation', '')
            entity_operations[entity].add(operation)
        
        return {
            'total_entities': len(set(e.get('entity', '') for e in entities)),
            'total_capabilities': len(entities),
            'total_pages': len(pages),
            'entities': {
                entity: list(operations) for entity, operations in entity_operations.items()
            }
        }
    
    def _summarize_test_execution(self, test_results: List[Dict]) -> Dict[str, Any]:
        """Summarize test execution results."""
        if not test_results:
            return {
                'total': 0,
                'passed': 0,
                'failed': 0,
                'skipped': 0
            }
        
        total = len(test_results)
        passed = len([r for r in test_results if r.get('status') == 'passed'])
        failed = len([r for r in test_results if r.get('status') == 'failed'])
        skipped = len([r for r in test_results if r.get('status') == 'skipped'])
        
        return {
            'total': total,
            'passed': passed,
            'failed': failed,
            'skipped': skipped,
            'pass_rate': (passed / total * 100) if total > 0 else 0
        }







