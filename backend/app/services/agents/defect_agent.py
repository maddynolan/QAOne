"""
Defect Agent - Captures and files defects automatically from test failures
App-First Flow: Critical component for logging findings and bugs
"""

import logging
import asyncio
from typing import Dict, List, Any, Optional
from datetime import datetime
from uuid import uuid4
import time
import json
import base64

from app.schemas.agent_schemas import (
    AgentTaskRequest, AgentTaskResult, AgentType, AgentStatus
)
from app.services.llm.model_gateway import get_model_gateway, GenerationRequest
from app.services.connectors.jira_connector import JiraConnector

logger = logging.getLogger(__name__)


class DefectAgent:
    """
    Agent for defect management:
    - Captures test failures with logs, screenshots, steps
    - Files defects automatically (internal and/or Jira)
    - Categorizes and prioritizes defects
    - Links defects to requirements and test cases
    """
    
    def __init__(self):
        self.model_gateway = get_model_gateway()
        self._jira_connector = None
    
    def _get_jira_connector(self) -> Optional[JiraConnector]:
        """Lazy load Jira connector"""
        if self._jira_connector is None:
            try:
                self._jira_connector = JiraConnector()
            except Exception as e:
                logger.warning(f"Jira connector not available: {e}")
        return self._jira_connector
    
    async def capture_and_file_defect(
        self,
        test_run_id: str,
        test_case_id: str,
        failure_message: str,
        failure_step: Optional[int] = None,
        screenshot: Optional[str] = None,  # base64 encoded
        logs: Optional[str] = None,
        steps: Optional[List[Dict[str, Any]]] = None,
        project_id: Optional[str] = None,
        requirement_id: Optional[str] = None,
        tenant_id: Optional[str] = None,
        file_to_jira: bool = False,
        jira_project_key: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Capture test failure and file defect automatically
        
        Args:
            test_run_id: ID of the test run that failed
            test_case_id: ID of the test case that failed
            failure_message: Error message from test failure
            failure_step: Step number where failure occurred
            screenshot: Base64 encoded screenshot
            logs: Test execution logs
            steps: List of test steps executed
            project_id: Project ID
            requirement_id: Related requirement ID
            tenant_id: Tenant ID
            file_to_jira: Whether to file defect in Jira
            jira_project_key: Jira project key if filing to Jira
        """
        # Get test case details
        test_case = await self._get_test_case(test_case_id)
        if not test_case:
            raise ValueError(f"Test case {test_case_id} not found")
        
        # Analyze failure using LLM
        defect_analysis = await self._analyze_failure(
            failure_message=failure_message,
            test_case_title=test_case.get("title", ""),
            test_case_description=test_case.get("description", ""),
            steps=steps or [],
            failure_step=failure_step,
            tenant_id=tenant_id
        )
        
        # Create defect record
        defect_id = await self._create_defect(
            test_run_id=test_run_id,
            test_case_id=test_case_id,
            project_id=project_id,
            requirement_id=requirement_id,
            tenant_id=tenant_id,
            title=defect_analysis.get("title", f"Test Failure: {test_case.get('title', '')}"),
            description=defect_analysis.get("description", failure_message),
            severity=defect_analysis.get("severity", "medium"),
            category=defect_analysis.get("category", "functional"),
            failure_message=failure_message,
            failure_step=failure_step,
            screenshot=screenshot,
            logs=logs,
            steps=steps,
            root_cause=defect_analysis.get("root_cause"),
            reproduction_steps=defect_analysis.get("reproduction_steps", [])
        )
        
        # File to Jira if requested
        jira_issue_key = None
        if file_to_jira and jira_project_key:
            jira_issue_key = await self._file_to_jira(
                defect_id=defect_id,
                jira_project_key=jira_project_key,
                title=defect_analysis.get("title"),
                description=defect_analysis.get("description"),
                severity=defect_analysis.get("severity"),
                tenant_id=tenant_id
            )
            
            # Update defect with Jira reference
            if jira_issue_key:
                await self._update_defect_jira_ref(defect_id, jira_issue_key, tenant_id)
        
        return {
            "status": "success",
            "defect_id": defect_id,
            "jira_issue_key": jira_issue_key,
            "analysis": defect_analysis,
            "created_at": datetime.utcnow().isoformat()
        }
    
    async def _analyze_failure(
        self,
        failure_message: str,
        test_case_title: str,
        test_case_description: str,
        steps: List[Dict[str, Any]],
        failure_step: Optional[int],
        tenant_id: Optional[str]
    ) -> Dict[str, Any]:
        """Analyze test failure using LLM to extract defect details"""
        steps_text = "\n".join([
            f"Step {i+1}: {step.get('action', '')} - {step.get('expected_result', '')}"
            for i, step in enumerate(steps)
        ])
        
        prompt = f"""Analyze this test failure and extract defect information:

Test Case: {test_case_title}
Description: {test_case_description}

Test Steps:
{steps_text}

Failure occurred at step: {failure_step or 'unknown'}
Failure Message: {failure_message}

Extract and provide:
1. Defect title (concise, descriptive)
2. Detailed description (what failed, why it matters)
3. Severity (critical, high, medium, low)
4. Category (functional, performance, accessibility, security, ui, api)
5. Root cause analysis (likely reason for failure)
6. Reproduction steps (step-by-step how to reproduce)

Respond in JSON format:
{{
  "title": "...",
  "description": "...",
  "severity": "critical|high|medium|low",
  "category": "functional|performance|accessibility|security|ui|api",
  "root_cause": "...",
  "reproduction_steps": ["step 1", "step 2", ...]
}}"""

        gen_request = GenerationRequest(
            prompt=prompt,
            mode="ui",
            validate_json=True,
            task_type="defect_analysis"
        )
        
        result = await self.model_gateway.generate(gen_request, tenant_id=tenant_id)
        
        try:
            analysis = json.loads(result.response)
            return analysis
        except Exception as e:
            logger.warning(f"Failed to parse defect analysis: {e}")
            # Fallback
            return {
                "title": f"Test Failure: {test_case_title}",
                "description": failure_message,
                "severity": "medium",
                "category": "functional",
                "root_cause": "Unable to analyze automatically",
                "reproduction_steps": steps_text.split("\n") if steps_text else []
            }
    
    async def _create_defect(
        self,
        test_run_id: str,
        test_case_id: str,
        project_id: Optional[str],
        requirement_id: Optional[str],
        tenant_id: Optional[str],
        title: str,
        description: str,
        severity: str,
        category: str,
        failure_message: str,
        failure_step: Optional[int],
        screenshot: Optional[str],
        logs: Optional[str],
        steps: Optional[List[Dict[str, Any]]],
        root_cause: Optional[str],
        reproduction_steps: Optional[List[str]]
    ) -> str:
        """Create defect record in database"""
        import concurrent.futures
        from app.services.storage.postgres_direct import get_postgres_pool
        
        pool = get_postgres_pool()
        if not pool:
            return str(uuid4())
        
        defect_id = str(uuid4())
        
        loop = asyncio.get_event_loop()
        with concurrent.futures.ThreadPoolExecutor() as executor:
            await loop.run_in_executor(
                executor,
                self._create_defect_sync,
                pool,
                defect_id,
                test_run_id,
                test_case_id,
                project_id,
                requirement_id,
                tenant_id,
                title,
                description,
                severity,
                category,
                failure_message,
                failure_step,
                screenshot,
                logs,
                steps,
                root_cause,
                reproduction_steps
            )
        
        return defect_id
    
    def _create_defect_sync(
        self,
        pool,
        defect_id: str,
        test_run_id: str,
        test_case_id: str,
        project_id: Optional[str],
        requirement_id: Optional[str],
        tenant_id: Optional[str],
        title: str,
        description: str,
        severity: str,
        category: str,
        failure_message: str,
        failure_step: Optional[int],
        screenshot: Optional[str],
        logs: Optional[str],
        steps: Optional[List[Dict[str, Any]]],
        root_cause: Optional[str],
        reproduction_steps: Optional[List[str]]
    ):
        """Synchronous defect insert"""
        conn = pool.getconn()
        try:
            with conn.cursor() as cur:
                # Insert defect
                cur.execute(
                    """
                    INSERT INTO defects
                    (id, test_run_id, test_case_id, project_id, requirement_id, tenant_id,
                     title, description, severity, category, status, failure_message,
                     failure_step, root_cause, reproduction_steps, created_at, updated_at)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 'open', %s, %s, %s, %s, NOW(), NOW())
                    """,
                    (
                        defect_id,
                        test_run_id,
                        test_case_id,
                        project_id,
                        requirement_id,
                        tenant_id,
                        title,
                        description,
                        severity,
                        category,
                        failure_message,
                        failure_step,
                        root_cause,
                        json.dumps(reproduction_steps) if reproduction_steps else None
                    )
                )
                
                # Store screenshot if provided (synchronous call from sync context)
                if screenshot:
                    self._store_screenshot_sync(pool, defect_id, screenshot, tenant_id)
                
                # Store logs if provided
                if logs:
                    cur.execute(
                        """
                        UPDATE defects
                        SET logs = %s, updated_at = NOW()
                        WHERE id = %s
                        """,
                        (logs, defect_id)
                    )
                
                # Store steps if provided
                if steps:
                    cur.execute(
                        """
                        UPDATE defects
                        SET test_steps = %s, updated_at = NOW()
                        WHERE id = %s
                        """,
                        (json.dumps(steps), defect_id)
                    )
                
                conn.commit()
        finally:
            pool.putconn(conn)
    
    def _store_screenshot_sync(self, pool, defect_id: str, screenshot: str, tenant_id: Optional[str]):
        """Store screenshot for defect (synchronous)"""
        from app.services.storage.object_store import get_object_store
        
        screenshot_path = f"defects/{defect_id}/screenshot.png"
        
        try:
            # Decode base64
            screenshot_bytes = base64.b64decode(screenshot)
            
            # Store in object store (synchronous)
            object_store = get_object_store()
            # Note: This may need to be async in production, but for now we'll store path
            # In production, you'd want to handle this properly with async object store
            
            # Update defect with screenshot path
            conn = pool.getconn()
            try:
                with conn.cursor() as cur:
                    cur.execute(
                        """
                        UPDATE defects
                        SET screenshot_path = %s, updated_at = NOW()
                        WHERE id = %s
                        """,
                        (screenshot_path, defect_id)
                    )
                    conn.commit()
            finally:
                pool.putconn(conn)
        except Exception as e:
            logger.warning(f"Failed to store screenshot: {e}")
    
    def _update_defect_screenshot_sync(self, pool, defect_id: str, screenshot_path: str, tenant_id: Optional[str]):
        """Update defect with screenshot path"""
        conn = pool.getconn()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    UPDATE defects
                    SET screenshot_path = %s, updated_at = NOW()
                    WHERE id = %s AND (tenant_id = %s OR tenant_id IS NULL)
                    """,
                    (screenshot_path, defect_id, tenant_id)
                )
                conn.commit()
        finally:
            pool.putconn(conn)
    
    async def _store_logs_async(self, defect_id: str, logs: str, tenant_id: Optional[str]):
        """Store logs for defect"""
        import concurrent.futures
        from app.services.storage.postgres_direct import get_postgres_pool
        
        pool = get_postgres_pool()
        if not pool:
            return
        
        loop = asyncio.get_event_loop()
        with concurrent.futures.ThreadPoolExecutor() as executor:
            await loop.run_in_executor(
                executor,
                self._store_logs_sync,
                pool,
                defect_id,
                logs,
                tenant_id
            )
    
    def _store_logs_sync(self, pool, defect_id: str, logs: str, tenant_id: Optional[str]):
        """Synchronous logs insert"""
        conn = pool.getconn()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    UPDATE defects
                    SET logs = %s, updated_at = NOW()
                    WHERE id = %s AND (tenant_id = %s OR tenant_id IS NULL)
                    """,
                    (logs, defect_id, tenant_id)
                )
                conn.commit()
        finally:
            pool.putconn(conn)
    
    async def _store_steps_async(self, defect_id: str, steps: List[Dict[str, Any]], tenant_id: Optional[str]):
        """Store test steps for defect"""
        import concurrent.futures
        from app.services.storage.postgres_direct import get_postgres_pool
        
        pool = get_postgres_pool()
        if not pool:
            return
        
        loop = asyncio.get_event_loop()
        with concurrent.futures.ThreadPoolExecutor() as executor:
            await loop.run_in_executor(
                executor,
                self._store_steps_sync,
                pool,
                defect_id,
                steps,
                tenant_id
            )
    
    def _store_steps_sync(self, pool, defect_id: str, steps: List[Dict[str, Any]], tenant_id: Optional[str]):
        """Synchronous steps insert"""
        conn = pool.getconn()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    UPDATE defects
                    SET test_steps = %s, updated_at = NOW()
                    WHERE id = %s AND (tenant_id = %s OR tenant_id IS NULL)
                    """,
                    (json.dumps(steps), defect_id, tenant_id)
                )
                conn.commit()
        finally:
            pool.putconn(conn)
    
    async def _file_to_jira(
        self,
        defect_id: str,
        jira_project_key: str,
        title: str,
        description: str,
        severity: str,
        tenant_id: Optional[str]
    ) -> Optional[str]:
        """File defect to Jira"""
        jira = self._get_jira_connector()
        if not jira:
            logger.warning("Jira connector not available")
            return None
        
        try:
            # Map severity to Jira priority
            priority_map = {
                "critical": "Highest",
                "high": "High",
                "medium": "Medium",
                "low": "Lowest"
            }
            priority = priority_map.get(severity, "Medium")
            
            # Create Jira issue
            issue_key = await jira.create_issue(
                project_key=jira_project_key,
                summary=title,
                description=description,
                issue_type="Bug",
                priority=priority,
                labels=["auto-generated", "test-failure"]
            )
            
            return issue_key
        except Exception as e:
            logger.error(f"Failed to file defect to Jira: {e}", exc_info=True)
            return None
    
    async def _update_defect_jira_ref(self, defect_id: str, jira_issue_key: str, tenant_id: Optional[str]):
        """Update defect with Jira issue reference"""
        import concurrent.futures
        from app.services.storage.postgres_direct import get_postgres_pool
        
        pool = get_postgres_pool()
        if not pool:
            return
        
        loop = asyncio.get_event_loop()
        with concurrent.futures.ThreadPoolExecutor() as executor:
            await loop.run_in_executor(
                executor,
                self._update_defect_jira_ref_sync,
                pool,
                defect_id,
                jira_issue_key,
                tenant_id
            )
    
    def _update_defect_jira_ref_sync(self, pool, defect_id: str, jira_issue_key: str, tenant_id: Optional[str]):
        """Synchronous Jira ref update"""
        conn = pool.getconn()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    UPDATE defects
                    SET jira_issue_key = %s, updated_at = NOW()
                    WHERE id = %s AND (tenant_id = %s OR tenant_id IS NULL)
                    """,
                    (jira_issue_key, defect_id, tenant_id)
                )
                conn.commit()
        finally:
            pool.putconn(conn)
    
    async def _get_test_case(self, test_case_id: str) -> Optional[Dict[str, Any]]:
        """Get test case from database"""
        import concurrent.futures
        from app.services.storage.postgres_direct import get_postgres_pool
        
        pool = get_postgres_pool()
        if not pool:
            return None
        
        loop = asyncio.get_event_loop()
        with concurrent.futures.ThreadPoolExecutor() as executor:
            result = await loop.run_in_executor(
                executor,
                self._get_test_case_sync,
                pool,
                test_case_id
            )
        return result
    
    def _get_test_case_sync(self, pool, test_case_id: str) -> Optional[Dict[str, Any]]:
        """Synchronous test case query"""
        conn = pool.getconn()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT * FROM test_cases WHERE id = %s",
                    (test_case_id,)
                )
                row = cur.fetchone()
                if not row:
                    return None
                
                columns = [desc[0] for desc in cur.description]
                return dict(zip(columns, row))
        finally:
            pool.putconn(conn)


# Agent handler function
async def defect_agent_handler(request: AgentTaskRequest) -> AgentTaskResult:
    """Handler for Defect Agent tasks"""
    start_time = time.time()
    
    agent = DefectAgent()
    operation = request.input_data.get("operation")
    
    try:
        if operation == "capture_and_file":
            result = await agent.capture_and_file_defect(
                test_run_id=request.input_data.get("test_run_id"),
                test_case_id=request.input_data.get("test_case_id"),
                failure_message=request.input_data.get("failure_message"),
                failure_step=request.input_data.get("failure_step"),
                screenshot=request.input_data.get("screenshot"),
                logs=request.input_data.get("logs"),
                steps=request.input_data.get("steps"),
                project_id=request.project_id,
                requirement_id=request.input_data.get("requirement_id"),
                tenant_id=request.tenant_id,
                file_to_jira=request.input_data.get("file_to_jira", False),
                jira_project_key=request.input_data.get("jira_project_key")
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
        logger.error(f"Defect agent task failed: {e}", exc_info=True)
        return AgentTaskResult(
            task_id=request.task_id,
            agent_type=request.agent_type,
            status=AgentStatus.FAILED,
            error=str(e),
            started_at=datetime.utcnow(),
            completed_at=datetime.utcnow(),
            duration_ms=(time.time() - start_time) * 1000
        )

