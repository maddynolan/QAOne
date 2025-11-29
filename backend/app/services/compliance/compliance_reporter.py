"""
Compliance Reporter Service
Generates compliance reports from test runs and security scans.
"""

import logging
from typing import Dict, Any, List, Optional
from datetime import datetime

from app.services.compliance.framework_mapper import get_compliance_mapper, ComplianceFramework
from app.services.storage.postgres_direct import get_postgres_pool
from app.middleware.tenant_middleware import get_current_tenant_id
from app.middleware.rbac_middleware import get_current_auth_user_id

logger = logging.getLogger(__name__)


class ComplianceReporter:
    """
    Service for generating compliance reports.
    Maps test results to compliance frameworks and generates audit-ready reports.
    """
    
    def __init__(self):
        self.compliance_mapper = get_compliance_mapper()
    
    async def generate_compliance_report(
        self,
        test_run_id: Optional[str] = None,
        project_id: Optional[str] = None,
        frameworks: Optional[List[str]] = None,
        report_name: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Generate compliance report from test runs.
        
        Args:
            test_run_id: Specific test run ID (optional)
            project_id: Project ID to generate report for
            frameworks: List of frameworks to include (default: all)
            report_name: Custom report name
            
        Returns:
            Compliance report dictionary
        """
        # Get test run results
        test_runs = await self._get_test_run_results(test_run_id, project_id)
        
        if frameworks is None:
            frameworks = [f.value for f in ComplianceFramework]
        
        # Generate report using compliance mapper
        report = self.compliance_mapper.generate_compliance_report(
            test_runs=test_runs,
            frameworks=frameworks
        )
        
        # Store report in database
        report_id = await self._store_compliance_report(
            report_name=report_name or f"Compliance Report {datetime.utcnow().strftime('%Y-%m-%d')}",
            report_type="test_run" if test_run_id else "project",
            frameworks=frameworks,
            report_data=report,
            project_id=project_id
        )
        
        report["report_id"] = report_id
        report["report_name"] = report_name
        
        return report
    
    async def _get_test_run_results(
        self,
        test_run_id: Optional[str],
        project_id: Optional[str]
    ) -> List[Dict[str, Any]]:
        """Get test run results from database"""
        pool = get_postgres_pool()
        if not pool:
            raise Exception("Database connection pool not available")
        
        tenant_id = get_current_tenant_id()
        
        query = """
            SELECT tr.test_run_id, tr.name, tr.status, tr.created_at,
                   tc.test_case_id, tc.name as test_case_name, tc.description,
                   tcr.status as test_status, tcr.duration_ms
            FROM test_runs tr
            LEFT JOIN test_case_runs tcr ON tr.test_run_id = tcr.test_run_id
            LEFT JOIN test_cases tc ON tcr.test_case_id = tc.test_case_id
            WHERE (tr.tenant_id = $1 OR tr.tenant_id IS NULL)
        """
        params = [tenant_id]
        param_idx = 2
        
        if test_run_id:
            query += f" AND tr.test_run_id = ${param_idx}::UUID"
            params.append(test_run_id)
            param_idx += 1
        elif project_id:
            query += f" AND tr.project_id = ${param_idx}::UUID"
            params.append(project_id)
            param_idx += 1
        
        async with pool.acquire() as conn:
            results = await conn.fetch(query, *params)
        
        test_runs = []
        for row in results:
            test_runs.append({
                "test_run_id": str(row["test_run_id"]),
                "test_case_id": str(row["test_case_id"]) if row["test_case_id"] else None,
                "test_name": row["test_case_name"] or row["name"],
                "description": row["description"] or "",
                "status": row["test_status"] or row["status"],
                "test_type": "security",  # Default, could be enhanced
                "duration_ms": row["duration_ms"] or 0
            })
        
        return test_runs
    
    async def _store_compliance_report(
        self,
        report_name: str,
        report_type: str,
        frameworks: List[str],
        report_data: Dict[str, Any],
        project_id: Optional[str] = None
    ) -> str:
        """Store compliance report in database"""
        pool = get_postgres_pool()
        if not pool:
            raise Exception("Database connection pool not available")
        
        tenant_id = get_current_tenant_id()
        user_id = get_current_auth_user_id()
        
        import json
        
        async with pool.acquire() as conn:
            result = await conn.fetchrow("""
                INSERT INTO compliance_reports (
                    report_name, report_type, frameworks, report_data,
                    generated_by, project_id, tenant_id
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7)
                RETURNING report_id
            """,
                report_name, report_type, json.dumps(frameworks),
                json.dumps(report_data), user_id, project_id, tenant_id
            )
        
        return str(result["report_id"])
    
    async def get_compliance_report(self, report_id: str) -> Optional[Dict[str, Any]]:
        """Get stored compliance report"""
        pool = get_postgres_pool()
        if not pool:
            raise Exception("Database connection pool not available")
        
        tenant_id = get_current_tenant_id()
        
        import json
        
        async with pool.acquire() as conn:
            result = await conn.fetchrow("""
                SELECT report_id, report_name, report_type, frameworks, report_data,
                       generated_at, generated_by
                FROM compliance_reports
                WHERE report_id = $1::UUID
                  AND (tenant_id = $2 OR tenant_id IS NULL)
            """, report_id, tenant_id)
        
        if not result:
            return None
        
        return {
            "report_id": str(result["report_id"]),
            "report_name": result["report_name"],
            "report_type": result["report_type"],
            "frameworks": json.loads(result["frameworks"]) if isinstance(result["frameworks"], str) else result["frameworks"],
            "report_data": json.loads(result["report_data"]) if isinstance(result["report_data"], str) else result["report_data"],
            "generated_at": result["generated_at"].isoformat(),
            "generated_by": str(result["generated_by"]) if result["generated_by"] else None
        }


# Global instance
_compliance_reporter = None

def get_compliance_reporter() -> ComplianceReporter:
    """Get or create global ComplianceReporter instance"""
    global _compliance_reporter
    if _compliance_reporter is None:
        _compliance_reporter = ComplianceReporter()
    return _compliance_reporter

