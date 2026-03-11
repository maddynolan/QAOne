# DEPRECATED — Scheduled for removal (v3.20.0)
# Part of the Autonomous Explorer / Flowmap system which is unused.
# Router registration commented out in main.py.
"""
API endpoints for exploration reporting.
"""

import logging
from typing import Optional
from fastapi import APIRouter, HTTPException

from app.services.exploration.exploration_reporting import ExplorationReporting
from app.utils.endpoint_helpers import ensure_default_org_project

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/exploration", tags=["exploration-reporting"])


@router.get("/report/{exploration_run_id}")
async def get_exploration_report(exploration_run_id: str, project_id: Optional[str] = None):
    """
    Get comprehensive report for an exploration run.
    """
    try:
        if not project_id:
            _, project_id = await ensure_default_org_project()
        
        reporting = ExplorationReporting()
        report = await reporting.generate_exploration_report(exploration_run_id, project_id)
        
        return {
            "status": "success",
            "report": report
        }
    
    except Exception as e:
        logger.error(f"Failed to generate report: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail="Report generation failed"
        )


@router.get("/defects/stats")
async def get_defect_statistics(project_id: Optional[str] = None):
    """
    Get defect statistics for a project.
    """
    try:
        if not project_id:
            _, project_id = await ensure_default_org_project()
        
        from app.services.exploration.defect_storage import DefectStorage
        from app.services.storage.postgres_direct import execute_query
        
        # Get defect counts by type
        query = """
            SELECT defect_type, severity, status, COUNT(*) as count
            FROM defects
            WHERE project_id = %s
            GROUP BY defect_type, severity, status
        """
        
        results = await execute_query(query, (project_id,))
        
        stats = {
            'by_type': {},
            'by_severity': {},
            'by_status': {}
        }
        
        for row in results or []:
            defect_type = row.get('defect_type', 'unknown')
            severity = row.get('severity', 'unknown')
            status = row.get('status', 'unknown')
            count = row.get('count', 0)
            
            if defect_type not in stats['by_type']:
                stats['by_type'][defect_type] = 0
            stats['by_type'][defect_type] += count
            
            if severity not in stats['by_severity']:
                stats['by_severity'][severity] = 0
            stats['by_severity'][severity] += count
            
            if status not in stats['by_status']:
                stats['by_status'][status] = 0
            stats['by_status'][status] += count
        
        return {
            "status": "success",
            "statistics": stats
        }
    
    except Exception as e:
        logger.error(f"Failed to get defect statistics: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail="Failed to get statistics"
        )







