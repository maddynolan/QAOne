"""
App-First Flow Orchestrator - Coordinates the complete flow from recording to execution
Flow A: Recording → Automation Agent → Test Design Agent → Requirements Agent → Execution → Defect Agent
"""

import logging
import asyncio
from typing import Dict, List, Any, Optional
from datetime import datetime
from uuid import uuid4
import time

from app.services.agents.automation_agent import AutomationAgent
from app.services.agents.test_design_agent import TestDesignAgent
from app.services.agents.requirements_agent import RequirementsAgent
from app.services.agents.defect_agent import DefectAgent
from app.services.agents.performance_agent import PerformanceAgent
from app.services.agents.accessibility_agent import AccessibilityAgent
from app.services.utils.dom_recorder import DOMRecorder
from app.services.executors.playwright_runner import PlaywrightRunner

logger = logging.getLogger(__name__)


class AppFirstFlowOrchestrator:
    """
    Orchestrates the complete App-First flow:
    1. User records flow (DOM + actions)
    2. Automation Agent: Captures DOM + actions, generates Playwright script
    3. Test Design Agent: Converts script + DOM into structured test cases
    4. Requirements Agent: Infers implicit requirements from flows and Jira, suggests missing acceptance criteria
    5. Run automation: Execute tests
    6. Defect Agent: If failures, captures logs/screenshot/steps, files defect
    7. Optional: Perf & A11y Agents re-run flow in perf/a11y mode, raise findings
    """
    
    def __init__(self):
        self.automation_agent = AutomationAgent()
        self.test_design_agent = TestDesignAgent()
        self.requirements_agent = RequirementsAgent()
        self.defect_agent = DefectAgent()
        self.performance_agent = PerformanceAgent()
        self.accessibility_agent = AccessibilityAgent()
        self.dom_recorder = DOMRecorder()
        self.playwright_runner = PlaywrightRunner()
    
    async def execute_complete_flow(
        self,
        recording_data: Dict[str, Any],
        project_id: Optional[str] = None,
        org_id: Optional[str] = None,
        tenant_id: Optional[str] = None,
        enable_performance: bool = False,
        enable_accessibility: bool = False,
        file_defects_to_jira: bool = False,
        jira_project_key: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Execute the complete App-First flow from recording to test case generation
        """
        flow_id = str(uuid4())
        start_time = time.time()
        
        try:
            logger.info(f"Starting App-First flow {flow_id}")
            
            # Step 1: Parse recording
            recording = self.dom_recorder.parse_recording(recording_data)
            recording_id = await self._store_recording(recording, tenant_id)
            
            # Step 2: Automation Agent - Generate Playwright script
            logger.info(f"Step 2: Automation Agent generating Playwright script")
            automation_result = await self.automation_agent.generate_test(
                recording_id=recording_id,
                tenant_id=tenant_id
            )
            playwright_script = automation_result.get("test_code", "")
            
            # Step 3: Test Design Agent - Convert to structured test cases
            logger.info(f"Step 3: Test Design Agent converting to structured test cases")
            test_design_result = await self.test_design_agent.convert_script_to_test_case(
                playwright_script=playwright_script,
                recording_data=recording,
                project_id=project_id,
                tenant_id=tenant_id
            )
            test_case_id = test_design_result.get("test_case_id")
            test_case = test_design_result.get("test_case", {})
            
            # Step 4: Requirements Agent - Infer requirements and suggest acceptance criteria
            logger.info(f"Step 4: Requirements Agent inferring requirements")
            requirements_result = await self.requirements_agent.infer_requirements_from_flow(
                recording_data=recording,
                test_case=test_case,
                project_id=project_id,
                org_id=org_id,
                tenant_id=tenant_id
            )
            inferred_requirements = requirements_result.get("requirements", [])
            suggested_criteria = requirements_result.get("suggested_acceptance_criteria", [])
            
            # Link test case to requirements
            for req in inferred_requirements:
                req_id = req.get("id")
                if req_id:
                    await self.test_design_agent._link_test_case_to_requirement(
                        test_case_id,
                        req_id,
                        tenant_id
                    )
            
            # Step 5: Optional - Performance and Accessibility analysis
            perf_findings = []
            a11y_findings = []
            
            if enable_performance:
                logger.info(f"Step 5a: Performance Agent analyzing flow")
                perf_result = await self._run_performance_analysis(
                    recording=recording,
                    project_id=project_id,
                    tenant_id=tenant_id
                )
                perf_findings = perf_result.get("findings", [])
            
            if enable_accessibility:
                logger.info(f"Step 5b: Accessibility Agent analyzing flow")
                a11y_result = await self._run_accessibility_analysis(
                    recording=recording,
                    project_id=project_id,
                    tenant_id=tenant_id
                )
                a11y_findings = a11y_result.get("findings", [])
            
            # Store flow metadata
            await self._store_flow_metadata(
                flow_id=flow_id,
                recording_id=recording_id,
                test_case_id=test_case_id,
                project_id=project_id,
                tenant_id=tenant_id
            )
            
            duration = time.time() - start_time
            logger.info(f"App-First flow {flow_id} completed in {duration:.2f}s")
            
            return {
                "flow_id": flow_id,
                "recording_id": recording_id,
                "playwright_script": playwright_script,
                "test_cases": [test_case],
                "requirements": inferred_requirements,
                "suggested_acceptance_criteria": suggested_criteria,
                "performance_findings": perf_findings,
                "accessibility_findings": a11y_findings,
                "duration_seconds": duration
            }
        
        except Exception as e:
            logger.error(f"App-First flow {flow_id} failed: {e}", exc_info=True)
            raise
    
    async def execute_recorded_flow(
        self,
        recording_id: str,
        project_id: Optional[str] = None,
        org_id: Optional[str] = None,
        tenant_id: Optional[str] = None,
        run_performance: bool = False,
        run_accessibility: bool = False
    ) -> Dict[str, Any]:
        """
        Execute a previously recorded flow:
        1. Run automation tests
        2. If failures, Defect Agent captures and files defects
        3. Optionally run performance and accessibility tests
        """
        execution_id = str(uuid4())
        start_time = time.time()
        
        try:
            logger.info(f"Executing recorded flow {recording_id}")
            
            # Get recording
            recording = await self.automation_agent._get_recording(recording_id)
            if not recording:
                raise ValueError(f"Recording {recording_id} not found")
            
            # Get test case
            flow_metadata = await self._get_flow_metadata_by_recording(recording_id, tenant_id)
            test_case_id = flow_metadata.get("test_case_id")
            
            if not test_case_id:
                raise ValueError(f"No test case found for recording {recording_id}")
            
            # Get Playwright script
            test_case = await self.automation_agent._get_test(test_case_id)
            if not test_case:
                raise ValueError(f"Test case {test_case_id} not found")
            
            test_code_json = test_case.get("code", {})
            if isinstance(test_code_json, str):
                import json
                test_code_json = json.loads(test_code_json)
            playwright_script = test_code_json.get("playwright", "")
            
            # Step 1: Run automation test
            logger.info(f"Running automation test")
            test_result = await self.automation_agent.run_test(
                test_code=playwright_script,
                tenant_id=tenant_id
            )
            
            # Create test run
            test_run_id = await self._create_test_run(
                test_case_id=test_case_id,
                project_id=project_id,
                tenant_id=tenant_id,
                status="passed" if test_result.get("status") == "success" else "failed"
            )
            
            defects = []
            
            # Step 2: If test failed, capture defect
            if test_result.get("status") != "success" or test_result.get("test_result", {}).get("status") == "failed":
                logger.info(f"Test failed, capturing defect")
                
                failure_message = test_result.get("error") or test_result.get("test_result", {}).get("error", "Test execution failed")
                screenshot = test_result.get("test_result", {}).get("screenshot")
                logs = test_result.get("test_result", {}).get("logs")
                steps = test_case.get("steps", [])
                
                defect_result = await self.defect_agent.capture_and_file_defect(
                    test_run_id=test_run_id,
                    test_case_id=test_case_id,
                    failure_message=failure_message,
                    screenshot=screenshot,
                    logs=logs,
                    steps=steps,
                    project_id=project_id,
                    tenant_id=tenant_id,
                    file_to_jira=False  # Can be configured
                )
                defects.append(defect_result)
            
            # Step 3: Optional - Performance and Accessibility tests
            perf_findings = []
            a11y_findings = []
            
            if run_performance:
                logger.info(f"Running performance analysis")
                perf_result = await self._run_performance_analysis(
                    recording=recording,
                    project_id=project_id,
                    tenant_id=tenant_id
                )
                perf_findings = perf_result.get("findings", [])
            
            if run_accessibility:
                logger.info(f"Running accessibility analysis")
                a11y_result = await self._run_accessibility_analysis(
                    recording=recording,
                    project_id=project_id,
                    tenant_id=tenant_id
                )
                a11y_findings = a11y_result.get("findings", [])
            
            duration = time.time() - start_time
            
            return {
                "execution_id": execution_id,
                "test_run_id": test_run_id,
                "test_results": test_result,
                "defects": defects,
                "performance_findings": perf_findings,
                "accessibility_findings": a11y_findings,
                "duration_seconds": duration
            }
        
        except Exception as e:
            logger.error(f"Flow execution {execution_id} failed: {e}", exc_info=True)
            raise
    
    async def get_flow_status(
        self,
        flow_id: str,
        tenant_id: Optional[str]
    ) -> Dict[str, Any]:
        """Get status of a flow"""
        import concurrent.futures
        from app.services.storage.postgres_direct import get_postgres_pool
        
        pool = get_postgres_pool()
        if not pool:
            return {"status": "unknown"}
        
        loop = asyncio.get_event_loop()
        with concurrent.futures.ThreadPoolExecutor() as executor:
            result = await loop.run_in_executor(
                executor,
                self._get_flow_status_sync,
                pool,
                flow_id,
                tenant_id
            )
        return result
    
    def _get_flow_status_sync(self, pool, flow_id: str, tenant_id: Optional[str]) -> Dict[str, Any]:
        """Synchronous flow status query"""
        conn = pool.getconn()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT * FROM app_first_flows
                    WHERE id = %s AND (tenant_id = %s OR tenant_id IS NULL)
                    """,
                    (flow_id, tenant_id)
                )
                row = cur.fetchone()
                if not row:
                    return {"status": "not_found"}
                
                columns = [desc[0] for desc in cur.description]
                return dict(zip(columns, row))
        finally:
            pool.putconn(conn)
    
    async def get_flow_findings(
        self,
        flow_id: str,
        tenant_id: Optional[str]
    ) -> Dict[str, Any]:
        """Get all findings for a flow"""
        flow_status = await self.get_flow_status(flow_id, tenant_id)
        test_case_id = flow_status.get("test_case_id")
        
        if not test_case_id:
            return {"defects": [], "performance_findings": [], "accessibility_findings": []}
        
        # Get defects
        defects = await self._get_defects_for_test_case(test_case_id, tenant_id)
        
        # Get performance findings
        perf_findings = await self._get_performance_findings(flow_id, tenant_id)
        
        # Get accessibility findings
        a11y_findings = await self._get_accessibility_findings(flow_id, tenant_id)
        
        return {
            "defects": defects,
            "performance_findings": perf_findings,
            "accessibility_findings": a11y_findings
        }
    
    # ==================== Helper Methods ====================
    
    async def _store_recording(self, recording: Dict[str, Any], tenant_id: Optional[str]) -> str:
        """Store recording in database"""
        import concurrent.futures
        from app.services.storage.postgres_direct import get_postgres_pool
        import json
        
        pool = get_postgres_pool()
        if not pool:
            return recording.get("recording_id", str(uuid4()))
        
        recording_id = recording.get("recording_id", str(uuid4()))
        
        loop = asyncio.get_event_loop()
        with concurrent.futures.ThreadPoolExecutor() as executor:
            await loop.run_in_executor(
                executor,
                self._store_recording_sync,
                pool,
                recording_id,
                recording,
                tenant_id
            )
        
        return recording_id
    
    def _store_recording_sync(self, pool, recording_id: str, recording: Dict[str, Any], tenant_id: Optional[str]):
        """Synchronous recording insert"""
        import json
        conn = pool.getconn()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO recordings
                    (id, url, title, data, tenant_id, created_at)
                    VALUES (%s, %s, %s, %s, %s, NOW())
                    ON CONFLICT (id) DO NOTHING
                    """,
                    (
                        recording_id,
                        recording.get("url"),
                        recording.get("title"),
                        json.dumps(recording),
                        tenant_id
                    )
                )
                conn.commit()
        finally:
            pool.putconn(conn)
    
    async def _store_flow_metadata(
        self,
        flow_id: str,
        recording_id: str,
        test_case_id: str,
        project_id: Optional[str],
        tenant_id: Optional[str]
    ):
        """Store flow metadata"""
        import concurrent.futures
        from app.services.storage.postgres_direct import get_postgres_pool
        
        pool = get_postgres_pool()
        if not pool:
            return
        
        loop = asyncio.get_event_loop()
        with concurrent.futures.ThreadPoolExecutor() as executor:
            await loop.run_in_executor(
                executor,
                self._store_flow_metadata_sync,
                pool,
                flow_id,
                recording_id,
                test_case_id,
                project_id,
                tenant_id
            )
    
    def _store_flow_metadata_sync(
        self,
        pool,
        flow_id: str,
        recording_id: str,
        test_case_id: str,
        project_id: Optional[str],
        tenant_id: Optional[str]
    ):
        """Synchronous flow metadata insert"""
        conn = pool.getconn()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO app_first_flows
                    (id, recording_id, test_case_id, project_id, tenant_id, created_at, updated_at)
                    VALUES (%s, %s, %s, %s, %s, NOW(), NOW())
                    ON CONFLICT (id) DO UPDATE
                    SET test_case_id = EXCLUDED.test_case_id,
                        updated_at = NOW()
                    """,
                    (flow_id, recording_id, test_case_id, project_id, tenant_id)
                )
                conn.commit()
        finally:
            pool.putconn(conn)
    
    async def _get_flow_metadata_by_recording(
        self,
        recording_id: str,
        tenant_id: Optional[str]
    ) -> Dict[str, Any]:
        """Get flow metadata by recording ID"""
        import concurrent.futures
        from app.services.storage.postgres_direct import get_postgres_pool
        
        pool = get_postgres_pool()
        if not pool:
            return {}
        
        loop = asyncio.get_event_loop()
        with concurrent.futures.ThreadPoolExecutor() as executor:
            result = await loop.run_in_executor(
                executor,
                self._get_flow_metadata_sync,
                pool,
                recording_id,
                tenant_id
            )
        return result
    
    def _get_flow_metadata_sync(self, pool, recording_id: str, tenant_id: Optional[str]) -> Dict[str, Any]:
        """Synchronous flow metadata query"""
        conn = pool.getconn()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT * FROM app_first_flows
                    WHERE recording_id = %s AND (tenant_id = %s OR tenant_id IS NULL)
                    ORDER BY created_at DESC
                    LIMIT 1
                    """,
                    (recording_id, tenant_id)
                )
                row = cur.fetchone()
                if not row:
                    return {}
                
                columns = [desc[0] for desc in cur.description]
                return dict(zip(columns, row))
        finally:
            pool.putconn(conn)
    
    async def _create_test_run(
        self,
        test_case_id: str,
        project_id: Optional[str],
        tenant_id: Optional[str],
        status: str
    ) -> str:
        """Create test run"""
        import concurrent.futures
        from app.services.storage.postgres_direct import get_postgres_pool
        
        pool = get_postgres_pool()
        if not pool:
            return str(uuid4())
        
        run_id = str(uuid4())
        
        loop = asyncio.get_event_loop()
        with concurrent.futures.ThreadPoolExecutor() as executor:
            await loop.run_in_executor(
                executor,
                self._create_test_run_sync,
                pool,
                run_id,
                test_case_id,
                project_id,
                tenant_id,
                status
            )
        
        return run_id
    
    def _create_test_run_sync(
        self,
        pool,
        run_id: str,
        test_case_id: str,
        project_id: Optional[str],
        tenant_id: Optional[str],
        status: str
    ):
        """Synchronous test run insert"""
        conn = pool.getconn()
        try:
            with conn.cursor() as cur:
                # Get plan_id from test_case
                cur.execute("SELECT plan_id FROM test_cases WHERE id = %s", (test_case_id,))
                plan_row = cur.fetchone()
                plan_id = plan_row[0] if plan_row else None
                
                cur.execute(
                    """
                    INSERT INTO test_runs
                    (id, plan_id, project_id, tenant_id, name, status, created_at, updated_at)
                    VALUES (%s, %s, %s, %s, %s, %s, NOW(), NOW())
                    """,
                    (run_id, plan_id, project_id, tenant_id, f"Run for {test_case_id}", status)
                )
                conn.commit()
        finally:
            pool.putconn(conn)
    
    async def _run_performance_analysis(
        self,
        recording: Dict[str, Any],
        project_id: Optional[str],
        tenant_id: Optional[str]
    ) -> Dict[str, Any]:
        """Run performance analysis on recorded flow"""
        url = recording.get("url", "")
        if not url:
            return {"findings": []}
        
        # Generate k6 script from flow
        endpoints = [{"method": "GET", "url": url, "description": "Main page"}]
        
        perf_result = await self.performance_agent.generate_k6_script(
            endpoints=endpoints,
            tenant_id=tenant_id
        )
        
        # Execute performance test
        if perf_result.get("script"):
            exec_result = await self.performance_agent.execute_performance_test(
                test_script=perf_result.get("script"),
                project_id=project_id,
                tenant_id=tenant_id
            )
            
            # Extract findings from SLA violations
            findings = exec_result.get("sla_violations", [])
            
            return {
                "findings": findings,
                "run_id": exec_result.get("run_id")
            }
        
        return {"findings": []}
    
    async def _run_accessibility_analysis(
        self,
        recording: Dict[str, Any],
        project_id: Optional[str],
        tenant_id: Optional[str]
    ) -> Dict[str, Any]:
        """Run accessibility analysis on recorded flow"""
        url = recording.get("url", "")
        if not url:
            return {"findings": []}
        
        # Scan page for accessibility issues
        scan_result = await self.accessibility_agent.scan_page(
            url=url,
            project_id=project_id,
            tenant_id=tenant_id
        )
        
        # Convert issues to findings
        findings = [
            {
                "type": issue.get("type"),
                "severity": issue.get("severity"),
                "description": issue.get("description"),
                "element": issue.get("element"),
                "wcag_reference": issue.get("wcag_reference")
            }
            for issue in scan_result.get("issues", [])
        ]
        
        return {
            "findings": findings,
            "scan_id": scan_result.get("scan_id")
        }
    
    async def _get_defects_for_test_case(
        self,
        test_case_id: str,
        tenant_id: Optional[str]
    ) -> List[Dict[str, Any]]:
        """Get defects for a test case"""
        import concurrent.futures
        from app.services.storage.postgres_direct import get_postgres_pool
        
        pool = get_postgres_pool()
        if not pool:
            return []
        
        loop = asyncio.get_event_loop()
        with concurrent.futures.ThreadPoolExecutor() as executor:
            results = await loop.run_in_executor(
                executor,
                self._get_defects_sync,
                pool,
                test_case_id,
                tenant_id
            )
        return results
    
    def _get_defects_sync(self, pool, test_case_id: str, tenant_id: Optional[str]) -> List[Dict[str, Any]]:
        """Synchronous defects query"""
        conn = pool.getconn()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT * FROM defects
                    WHERE test_case_id = %s AND (tenant_id = %s OR tenant_id IS NULL)
                    ORDER BY created_at DESC
                    """,
                    (test_case_id, tenant_id)
                )
                columns = [desc[0] for desc in cur.description]
                return [dict(zip(columns, row)) for row in cur.fetchall()]
        finally:
            pool.putconn(conn)
    
    async def _get_performance_findings(
        self,
        flow_id: str,
        tenant_id: Optional[str]
    ) -> List[Dict[str, Any]]:
        """Get performance findings for a flow"""
        # Implementation would query perf_runs and perf_metrics
        return []
    
    async def _get_accessibility_findings(
        self,
        flow_id: str,
        tenant_id: Optional[str]
    ) -> List[Dict[str, Any]]:
        """Get accessibility findings for a flow"""
        # Implementation would query accessibility_issues
        return []

