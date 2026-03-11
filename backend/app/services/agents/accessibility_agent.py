# DEPRECATED — Scheduled for removal (v3.20.0)
# Part of the old 8-agent registry system. Unused in production.
"""
Accessibility Agent - Wrapper around accessibility compliance with reporting
Phase 3.2: Specialized Agents
"""

import logging
import asyncio
from typing import Dict, List, Any, Optional
from datetime import datetime
import time

from app.schemas.agent_schemas import (
    AgentTaskRequest, AgentTaskResult, AgentType, AgentStatus
)
from app.services.llm.model_gateway import get_model_gateway, GenerationRequest
from app.services.agents.accessibility_compliance import WCAG_21_AA_CHECKLIST
from app.services.executors.playwright_runner import PlaywrightRunner

logger = logging.getLogger(__name__)


class AccessibilityAgent:
    """
    Agent for accessibility testing:
    - Runs accessibility checks via Playwright
    - Stores issues in database
    - Generates human-readable reports
    - Provides prioritized fixes
    """
    
    def __init__(self):
        self.playwright_runner = PlaywrightRunner()
        self.model_gateway = get_model_gateway()
    
    async def scan_page(
        self,
        url: str,
        project_id: Optional[str] = None,
        tenant_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """Scan a page for accessibility issues"""
        # Run accessibility checks using Playwright
        issues = await self._run_accessibility_checks(url)
        
        # Store issues
        scan_id = await self._store_scan(
            url=url,
            project_id=project_id,
            tenant_id=tenant_id,
            issues=issues
        )
        
        # Generate report
        report = await self._generate_report(issues, tenant_id)
        
        return {
            "status": "success",
            "scan_id": scan_id,
            "url": url,
            "issues": issues,
            "summary": {
                "total": len(issues),
                "critical": sum(1 for i in issues if i.get("severity") == "critical"),
                "high": sum(1 for i in issues if i.get("severity") == "high"),
                "medium": sum(1 for i in issues if i.get("severity") == "medium"),
                "low": sum(1 for i in issues if i.get("severity") == "low")
            },
            "report": report
        }
    
    async def generate_fixes(
        self,
        issue_id: str,
        tenant_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """Generate code fixes for an accessibility issue"""
        issue = await self._get_issue(issue_id)
        if not issue:
            raise ValueError(f"Issue {issue_id} not found")
        
        prompt = f"""Generate code fixes for this accessibility issue:

Issue Type: {issue.get('type', '')}
Description: {issue.get('description', '')}
Element: {issue.get('element', '')}
Current Code: {issue.get('code_snippet', '')}

Provide:
1. Fixed code snippet
2. Explanation of the fix
3. WCAG guideline reference

Format as JSON:
{{
  "fixed_code": "...",
  "explanation": "...",
  "wcag_reference": "..."
}}"""

        gen_request = GenerationRequest(
            prompt=prompt,
            mode="ui",
            validate_json=True
        )
        
        result = await self.model_gateway.generate(gen_request, tenant_id=tenant_id)
        
        import json
        try:
            fixes = json.loads(result.response)
            return {
                "status": "success",
                "issue_id": issue_id,
                "fixes": fixes,
                "model": result.model
            }
        except:
            return {
                "status": "error",
                "message": "Failed to parse fixes"
            }
    
    async def get_issues(
        self,
        project_id: Optional[str] = None,
        tenant_id: Optional[str] = None,
        severity: Optional[str] = None,
        limit: int = 100
    ) -> Dict[str, Any]:
        """Get accessibility issues"""
        issues = await self._get_issues(project_id, tenant_id, severity, limit)
        
        return {
            "status": "success",
            "issues": issues,
            "count": len(issues)
        }
    
    # ==================== Helper Methods ====================
    
    async def _run_accessibility_checks(self, url: str) -> List[Dict[str, Any]]:
        """Run accessibility checks on a page"""
        issues = []
        
        # Basic checks using Playwright
        # In production, you'd use axe-core or similar
        
        # Check for missing alt text
        # Check for heading hierarchy
        # Check for contrast
        # etc.
        
        # For now, return sample structure
        return [
            {
                "type": "missing_alt_text",
                "severity": "critical",
                "description": "Image missing alt text",
                "element": "img[src='...']",
                "wcag_reference": "1.1.1",
                "code_snippet": "<img src='logo.png' />"
            }
        ]
    
    async def _store_scan(
        self,
        url: str,
        project_id: Optional[str],
        tenant_id: Optional[str],
        issues: List[Dict[str, Any]]
    ) -> str:
        """Store accessibility scan"""
        import concurrent.futures
        from app.services.storage.postgres_direct import get_postgres_pool
        from uuid import uuid4
        import json
        
        pool = get_postgres_pool()
        if not pool:
            return str(uuid4())
        
        scan_id = str(uuid4())
        
        loop = asyncio.get_event_loop()
        with concurrent.futures.ThreadPoolExecutor() as executor:
            # Store scan
            await loop.run_in_executor(
                executor,
                self._store_scan_sync,
                pool,
                scan_id,
                url,
                project_id,
                tenant_id
            )
            
            # Store issues
            for issue in issues:
                await loop.run_in_executor(
                    executor,
                    self._store_issue_sync,
                    pool,
                    scan_id,
                    issue,
                    project_id,
                    tenant_id
                )
        
        return scan_id
    
    def _store_scan_sync(
        self,
        pool,
        scan_id: str,
        url: str,
        project_id: Optional[str],
        tenant_id: Optional[str]
    ):
        """Synchronous scan insert"""
        conn = pool.getconn()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO accessibility_scans
                    (id, url, project_id, tenant_id, created_at)
                    VALUES (%s, %s, %s, %s, NOW())
                    """,
                    (scan_id, url, project_id, tenant_id)
                )
                conn.commit()
        finally:
            pool.putconn(conn)
    
    def _store_issue_sync(
        self,
        pool,
        scan_id: str,
        issue: Dict[str, Any],
        project_id: Optional[str],
        tenant_id: Optional[str]
    ):
        """Synchronous issue insert"""
        import json
        conn = pool.getconn()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO accessibility_issues
                    (id, scan_id, type, severity, description, element, wcag_reference, code_snippet, project_id, tenant_id, created_at)
                    VALUES (uuid_generate_v4(), %s, %s, %s, %s, %s, %s, %s, %s, %s, NOW())
                    """,
                    (
                        scan_id,
                        issue.get("type"),
                        issue.get("severity"),
                        issue.get("description"),
                        issue.get("element"),
                        issue.get("wcag_reference"),
                        issue.get("code_snippet"),
                        project_id,
                        tenant_id
                    )
                )
                conn.commit()
        finally:
            pool.putconn(conn)
    
    async def _generate_report(
        self,
        issues: List[Dict[str, Any]],
        tenant_id: Optional[str]
    ) -> Dict[str, Any]:
        """Generate human-readable accessibility report (LLM optional)"""
        summary = {
            "total": len(issues),
            "critical": sum(1 for i in issues if i.get("severity") == "critical"),
            "high": sum(1 for i in issues if i.get("severity") == "high"),
            "medium": sum(1 for i in issues if i.get("severity") == "medium"),
            "low": sum(1 for i in issues if i.get("severity") == "low")
        }
        
        # Generate basic report without LLM
        report_markdown = f"""# Accessibility Report

## Executive Summary
Total Issues: {summary['total']}
- Critical: {summary['critical']}
- High: {summary['high']}
- Medium: {summary['medium']}
- Low: {summary['low']}

## Compliance Status
"""
        
        if summary['critical'] > 0:
            report_markdown += "**Status**: Non-Compliant (Critical issues found)\n\n"
        elif summary['high'] > 5:
            report_markdown += "**Status**: Needs Improvement (Multiple high-severity issues)\n\n"
        elif summary['total'] == 0:
            report_markdown += "**Status**: Compliant (No issues found)\n\n"
        else:
            report_markdown += "**Status**: Mostly Compliant (Minor issues only)\n\n"
        
        report_markdown += "## Issue Breakdown\n\n"
        
        # Add top issues
        for i, issue in enumerate(issues[:10], 1):
            report_markdown += f"### Issue {i}: {issue.get('type', 'Unknown')}\n"
            report_markdown += f"- **Severity**: {issue.get('severity', 'unknown')}\n"
            report_markdown += f"- **Description**: {issue.get('description', '')}\n"
            if issue.get('element'):
                report_markdown += f"- **Element**: `{issue.get('element', '')[:100]}`\n"
            if issue.get('suggested_fix'):
                report_markdown += f"- **Suggested Fix**: {issue.get('suggested_fix', '')}\n"
            report_markdown += "\n"
        
        model_used = None
        
        # Try to enhance with LLM if available (optional)
        try:
            prompt = f"""Generate a human-readable accessibility report for these issues:

Summary:
- Total Issues: {summary['total']}
- Critical: {summary['critical']}
- High: {summary['high']}
- Medium: {summary['medium']}
- Low: {summary['low']}

Issues:
{chr(10).join([f"- {i.get('type', '')}: {i.get('description', '')}" for i in issues[:10]])}

Generate a comprehensive report with:
1. Executive summary
2. Issue breakdown by severity
3. Priority recommendations
4. WCAG compliance status

Format as markdown."""

            gen_request = GenerationRequest(
                prompt=prompt,
                mode="ui"
            )
            
            result = await self.model_gateway.generate(gen_request, tenant_id=tenant_id)
            report_markdown = result.response
            model_used = result.model
        except Exception as e:
            logger.warning(f"LLM report generation failed, using basic report: {e}")
        
        return {
            "summary": summary,
            "report_markdown": report_markdown,
            "model": model_used
        }
    
    async def _get_issue(self, issue_id: str) -> Optional[Dict[str, Any]]:
        """Get issue from database"""
        import concurrent.futures
        from app.services.storage.postgres_direct import get_postgres_pool
        
        pool = get_postgres_pool()
        if not pool:
            return None
        
        loop = asyncio.get_event_loop()
        with concurrent.futures.ThreadPoolExecutor() as executor:
            result = await loop.run_in_executor(
                executor,
                self._get_issue_sync,
                pool,
                issue_id
            )
        return result
    
    def _get_issue_sync(self, pool, issue_id: str) -> Optional[Dict[str, Any]]:
        """Synchronous issue query"""
        conn = pool.getconn()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT * FROM accessibility_issues WHERE id = %s",
                    (issue_id,)
                )
                row = cur.fetchone()
                if not row:
                    return None
                
                columns = [desc[0] for desc in cur.description]
                return dict(zip(columns, row))
        finally:
            pool.putconn(conn)
    
    async def _get_issues(
        self,
        project_id: Optional[str],
        tenant_id: Optional[str],
        severity: Optional[str],
        limit: int
    ) -> List[Dict[str, Any]]:
        """Get issues from database"""
        import concurrent.futures
        from app.services.storage.postgres_direct import get_postgres_pool
        
        pool = get_postgres_pool()
        if not pool:
            return []
        
        loop = asyncio.get_event_loop()
        with concurrent.futures.ThreadPoolExecutor() as executor:
            results = await loop.run_in_executor(
                executor,
                self._get_issues_sync,
                pool,
                project_id,
                tenant_id,
                severity,
                limit
            )
        return results
    
    def _get_issues_sync(
        self,
        pool,
        project_id: Optional[str],
        tenant_id: Optional[str],
        severity: Optional[str],
        limit: int
    ) -> List[Dict[str, Any]]:
        """Synchronous issues query"""
        conn = pool.getconn()
        try:
            with conn.cursor() as cur:
                query = "SELECT * FROM accessibility_issues WHERE 1=1"
                params = []
                
                if project_id:
                    query += " AND project_id = %s"
                    params.append(project_id)
                
                if tenant_id:
                    query += " AND tenant_id = %s"
                    params.append(tenant_id)
                
                if severity:
                    query += " AND severity = %s"
                    params.append(severity)
                
                query += " ORDER BY severity DESC, created_at DESC LIMIT %s"
                params.append(limit)
                
                cur.execute(query, params)
                columns = [desc[0] for desc in cur.description]
                return [dict(zip(columns, row)) for row in cur.fetchall()]
        finally:
            pool.putconn(conn)


# Agent handler function
async def accessibility_agent_handler(request: AgentTaskRequest) -> AgentTaskResult:
    """Handler for Accessibility Agent tasks"""
    start_time = time.time()
    
    agent = AccessibilityAgent()
    operation = request.input_data.get("operation")
    
    try:
        if operation == "scan":
            result = await agent.scan_page(
                url=request.input_data.get("url"),
                project_id=request.project_id,
                tenant_id=request.tenant_id
            )
        
        elif operation == "generate_fixes":
            result = await agent.generate_fixes(
                issue_id=request.input_data.get("issue_id"),
                tenant_id=request.tenant_id
            )
        
        elif operation == "get_issues":
            result = await agent.get_issues(
                project_id=request.project_id,
                tenant_id=request.tenant_id,
                severity=request.input_data.get("severity"),
                limit=request.input_data.get("limit", 100)
            )
        
        else:
            raise ValueError(f"Unknown operation: {operation}")
        
        return AgentTaskResult(
            task_id=request.task_id,
            agent_type=request.agent_type,
            status=AgentStatus.COMPLETED,
            output_data=result,
            started_at=datetime.utcnow(),
            completed_at=datetime.utcnow(),
            duration_ms=(time.time() - start_time) * 1000
        )
    
    except Exception as e:
        logger.error(f"Accessibility agent task failed: {e}", exc_info=True)
        return AgentTaskResult(
            task_id=request.task_id,
            agent_type=request.agent_type,
            status=AgentStatus.FAILED,
            error=str(e),
            started_at=datetime.utcnow(),
            completed_at=datetime.utcnow(),
            duration_ms=(time.time() - start_time) * 1000
        )

