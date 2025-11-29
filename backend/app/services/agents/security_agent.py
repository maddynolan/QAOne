"""
Security Agent - Wrapper around ZAP executor with intelligent triage
Phase 3.3: Specialized Agents
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
from app.services.executors.zap_executor import ZAPExecutor

logger = logging.getLogger(__name__)


class SecurityAgent:
    """
    Agent for security testing:
    - Executes ZAP security scans
    - De-duplicates findings using LLM
    - Explains risks in plain English
    - Generates test cases for exploitation
    """
    
    def __init__(self):
        self.zap_executor = ZAPExecutor()
        self.model_gateway = get_model_gateway()
    
    async def scan_application(
        self,
        target_url: str,
        scan_type: str = "spider",
        project_id: Optional[str] = None,
        tenant_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """Execute security scan and process findings"""
        # Initialize ZAP
        await self.zap_executor.initialize()
        
        # Execute scan
        scan_result = await self.zap_executor.execute_scan(
            target_url=target_url,
            scan_type=scan_type
        )
        
        # Process and de-duplicate findings
        findings = await self._process_findings(scan_result.get("alerts", []), tenant_id)
        
        # Store findings
        scan_id = await self._store_scan(
            target_url=target_url,
            scan_type=scan_type,
            project_id=project_id,
            tenant_id=tenant_id,
            findings=findings
        )
        
        # Generate risk explanations
        explained_findings = await self._explain_risks(findings, tenant_id)
        
        return {
            "status": "success",
            "scan_id": scan_id,
            "target_url": target_url,
            "findings": explained_findings,
            "summary": {
                "total": len(findings),
                "high": sum(1 for f in findings if f.get("risk") == "High"),
                "medium": sum(1 for f in findings if f.get("risk") == "Medium"),
                "low": sum(1 for f in findings if f.get("risk") == "Low"),
                "informational": sum(1 for f in findings if f.get("risk") == "Informational")
            }
        }
    
    async def deduplicate_findings(
        self,
        findings: List[Dict[str, Any]],
        tenant_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """De-duplicate security findings using LLM"""
        if not findings:
            return {
                "status": "success",
                "original_count": 0,
                "deduplicated_count": 0,
                "findings": []
            }
        
        prompt = f"""Analyze these security findings and identify duplicates:

Findings:
{chr(10).join([f"{i+1}. {f.get('name', '')}: {f.get('description', '')[:200]}" for i, f in enumerate(findings[:20])])}

Identify:
1. Duplicate findings (same vulnerability, different instances)
2. Related findings (same root cause)
3. Unique findings

For each finding, provide:
- is_duplicate: true/false
- duplicate_of: index of original finding (if duplicate)
- group_id: group identifier for related findings

Respond as JSON array with same length as input."""

        gen_request = GenerationRequest(
            prompt=prompt,
            mode="ui",
            validate_json=True
        )
        
        result = await self.model_gateway.generate(gen_request, tenant_id=tenant_id)
        
        import json
        try:
            analysis = json.loads(result.response)
            
            # Group findings
            unique_findings = []
            seen_groups = set()
            
            for i, finding in enumerate(findings):
                item_analysis = analysis[i] if i < len(analysis) else {}
                
                if item_analysis.get("is_duplicate"):
                    continue  # Skip duplicates
                
                group_id = item_analysis.get("group_id", str(i))
                if group_id not in seen_groups:
                    seen_groups.add(group_id)
                    finding["group_id"] = group_id
                    unique_findings.append(finding)
            
            return {
                "status": "success",
                "original_count": len(findings),
                "deduplicated_count": len(unique_findings),
                "findings": unique_findings
            }
        except Exception as e:
            logger.warning(f"Failed to de-duplicate findings: {e}")
            return {
                "status": "error",
                "message": str(e),
                "findings": findings
            }
    
    async def explain_risk(
        self,
        finding_id: str,
        tenant_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """Explain security risk in plain English"""
        finding = await self._get_finding(finding_id)
        if not finding:
            raise ValueError(f"Finding {finding_id} not found")
        
        prompt = f"""Explain this security finding in plain English for non-technical stakeholders:

Finding: {finding.get('name', '')}
Description: {finding.get('description', '')}
Risk Level: {finding.get('risk', 'Unknown')}
Solution: {finding.get('solution', '')}

Provide:
1. What the vulnerability is (in simple terms)
2. Why it matters (business impact)
3. How it could be exploited
4. What to do about it

Format as JSON:
{{
  "explanation": "...",
  "business_impact": "...",
  "exploitation_scenario": "...",
  "recommendation": "..."
}}"""

        gen_request = GenerationRequest(
            prompt=prompt,
            mode="ui",
            validate_json=True
        )
        
        result = await self.model_gateway.generate(gen_request, tenant_id=tenant_id)
        
        import json
        try:
            explanation = json.loads(result.response)
            return {
                "status": "success",
                "finding_id": finding_id,
                "explanation": explanation,
                "model": result.model
            }
        except:
            return {
                "status": "error",
                "message": "Failed to generate explanation"
            }
    
    async def generate_exploitation_test(
        self,
        finding_id: str,
        tenant_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """Generate test case for exploiting a vulnerability"""
        finding = await self._get_finding(finding_id)
        if not finding:
            raise ValueError(f"Finding {finding_id} not found")
        
        prompt = f"""Generate a test case to verify and exploit this security vulnerability:

Finding: {finding.get('name', '')}
Description: {finding.get('description', '')}
URL: {finding.get('url', '')}
Parameter: {finding.get('parameter', '')}

Generate a test case that:
1. Verifies the vulnerability exists
2. Demonstrates exploitation
3. Includes expected results
4. Uses appropriate tools (curl, Postman, etc.)

Format as JSON:
{{
  "test_name": "...",
  "steps": [
    {{"action": "...", "expected": "..."}}
  ],
  "tool": "...",
  "command": "..."
}}"""

        gen_request = GenerationRequest(
            prompt=prompt,
            mode="ui",
            validate_json=True
        )
        
        result = await self.model_gateway.generate(gen_request, tenant_id=tenant_id)
        
        import json
        try:
            test_case = json.loads(result.response)
            return {
                "status": "success",
                "finding_id": finding_id,
                "test_case": test_case,
                "model": result.model
            }
        except:
            return {
                "status": "error",
                "message": "Failed to generate test case"
            }
    
    # ==================== Helper Methods ====================
    
    async def _process_findings(
        self,
        alerts: List[Dict[str, Any]],
        tenant_id: Optional[str]
    ) -> List[Dict[str, Any]]:
        """Process and normalize ZAP alerts"""
        findings = []
        
        for alert in alerts:
            finding = {
                "name": alert.get("name", ""),
                "description": alert.get("description", ""),
                "risk": alert.get("risk", "Informational"),
                "confidence": alert.get("confidence", "Medium"),
                "url": alert.get("url", ""),
                "parameter": alert.get("parameter", ""),
                "solution": alert.get("solution", ""),
                "reference": alert.get("reference", ""),
                "cwe_id": alert.get("cweid", ""),
                "wasc_id": alert.get("wascid", "")
            }
            findings.append(finding)
        
        # De-duplicate
        dedup_result = await self.deduplicate_findings(findings, tenant_id)
        return dedup_result.get("findings", findings)
    
    async def _store_scan(
        self,
        target_url: str,
        scan_type: str,
        project_id: Optional[str],
        tenant_id: Optional[str],
        findings: List[Dict[str, Any]]
    ) -> str:
        """Store security scan"""
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
                target_url,
                scan_type,
                project_id,
                tenant_id
            )
            
            # Store findings
            for finding in findings:
                await loop.run_in_executor(
                    executor,
                    self._store_finding_sync,
                    pool,
                    scan_id,
                    finding,
                    project_id,
                    tenant_id
                )
        
        return scan_id
    
    def _store_scan_sync(
        self,
        pool,
        scan_id: str,
        target_url: str,
        scan_type: str,
        project_id: Optional[str],
        tenant_id: Optional[str]
    ):
        """Synchronous scan insert"""
        conn = pool.getconn()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO security_scans
                    (id, target_url, scan_type, project_id, tenant_id, created_at)
                    VALUES (%s, %s, %s, %s, %s, NOW())
                    """,
                    (scan_id, target_url, scan_type, project_id, tenant_id)
                )
                conn.commit()
        finally:
            pool.putconn(conn)
    
    def _store_finding_sync(
        self,
        pool,
        scan_id: str,
        finding: Dict[str, Any],
        project_id: Optional[str],
        tenant_id: Optional[str]
    ):
        """Synchronous finding insert"""
        import json
        conn = pool.getconn()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO security_findings
                    (id, scan_id, name, description, risk, confidence, url, parameter, solution, reference, cwe_id, wasc_id, project_id, tenant_id, created_at)
                    VALUES (uuid_generate_v4(), %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, NOW())
                    """,
                    (
                        scan_id,
                        finding.get("name"),
                        finding.get("description"),
                        finding.get("risk"),
                        finding.get("confidence"),
                        finding.get("url"),
                        finding.get("parameter"),
                        finding.get("solution"),
                        finding.get("reference"),
                        finding.get("cwe_id"),
                        finding.get("wasc_id"),
                        project_id,
                        tenant_id
                    )
                )
                conn.commit()
        finally:
            pool.putconn(conn)
    
    async def _explain_risks(
        self,
        findings: List[Dict[str, Any]],
        tenant_id: Optional[str]
    ) -> List[Dict[str, Any]]:
        """Add risk explanations to findings"""
        explained = []
        
        for finding in findings:
            if finding.get("risk") in ["High", "Medium"]:
                explanation = await self.explain_risk(finding.get("id", ""), tenant_id)
                if explanation.get("status") == "success":
                    finding["explanation"] = explanation.get("explanation", {})
            explained.append(finding)
        
        return explained
    
    async def _get_finding(self, finding_id: str) -> Optional[Dict[str, Any]]:
        """Get finding from database"""
        import concurrent.futures
        from app.services.storage.postgres_direct import get_postgres_pool
        
        pool = get_postgres_pool()
        if not pool:
            return None
        
        loop = asyncio.get_event_loop()
        with concurrent.futures.ThreadPoolExecutor() as executor:
            result = await loop.run_in_executor(
                executor,
                self._get_finding_sync,
                pool,
                finding_id
            )
        return result
    
    def _get_finding_sync(self, pool, finding_id: str) -> Optional[Dict[str, Any]]:
        """Synchronous finding query"""
        conn = pool.getconn()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT * FROM security_findings WHERE id = %s",
                    (finding_id,)
                )
                row = cur.fetchone()
                if not row:
                    return None
                
                columns = [desc[0] for desc in cur.description]
                return dict(zip(columns, row))
        finally:
            pool.putconn(conn)


# Agent handler function
async def security_agent_handler(request: AgentTaskRequest) -> AgentTaskResult:
    """Handler for Security Agent tasks"""
    start_time = time.time()
    
    agent = SecurityAgent()
    operation = request.input_data.get("operation")
    
    try:
        if operation == "scan":
            result = await agent.scan_application(
                target_url=request.input_data.get("target_url"),
                scan_type=request.input_data.get("scan_type", "spider"),
                project_id=request.project_id,
                tenant_id=request.tenant_id
            )
        
        elif operation == "deduplicate":
            result = await agent.deduplicate_findings(
                findings=request.input_data.get("findings", []),
                tenant_id=request.tenant_id
            )
        
        elif operation == "explain_risk":
            result = await agent.explain_risk(
                finding_id=request.input_data.get("finding_id"),
                tenant_id=request.tenant_id
            )
        
        elif operation == "generate_test":
            result = await agent.generate_exploitation_test(
                finding_id=request.input_data.get("finding_id"),
                tenant_id=request.tenant_id
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
        logger.error(f"Security agent task failed: {e}", exc_info=True)
        return AgentTaskResult(
            task_id=request.task_id,
            agent_type=request.agent_type,
            status=AgentStatus.FAILED,
            error=str(e),
            started_at=datetime.utcnow(),
            completed_at=datetime.utcnow(),
            duration_ms=(time.time() - start_time) * 1000
        )

