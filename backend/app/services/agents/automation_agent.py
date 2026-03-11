# DEPRECATED — Scheduled for removal (v3.20.0)
# Part of the old 8-agent registry system. Unused in production.
"""
Automation Agent - Wrapper around Playwright runner with DOM recorder and self-healing
Phase 2.2: Automation Agent Enhancement
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
from app.services.executors.playwright_runner import PlaywrightRunner, TestCase, TestStep
from app.services.utils.dom_recorder import DOMRecorder
from app.services.utils.self_healing import SelfHealingService

logger = logging.getLogger(__name__)


class AutomationAgent:
    """
    Agent for functional automation:
    - Generates test code from requirements/recordings
    - Executes tests via Playwright
    - Integrates with self-healing for selector repair
    - Generates maintenance suggestions
    """
    
    def __init__(self):
        self.playwright_runner = PlaywrightRunner()
        self.dom_recorder = DOMRecorder()
        self.self_healing = SelfHealingService()
        self.model_gateway = get_model_gateway()
    
    async def generate_test(
        self,
        requirement_id: Optional[str] = None,
        recording_id: Optional[str] = None,
        description: Optional[str] = None,
        tenant_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """Generate test code from requirement or recording"""
        if recording_id:
            # Generate from recording
            recording = await self._get_recording(recording_id)
            if not recording:
                raise ValueError(f"Recording {recording_id} not found")
            
            # Extract steps from recording
            steps = self.dom_recorder.extract_test_steps(recording)
            
            # Generate Playwright code
            code = self.dom_recorder.generate_playwright_code(recording)
            
            return {
                "status": "success",
                "source": "recording",
                "recording_id": recording_id,
                "test_code": code,
                "steps": steps
            }
        
        elif requirement_id:
            # Generate from requirement using LLM
            requirement = await self._get_requirement(requirement_id)
            if not requirement:
                raise ValueError(f"Requirement {requirement_id} not found")
            
            prompt = f"""Generate a Playwright test for the following requirement:

Title: {requirement.get('title', '')}
Description: {requirement.get('description', '')}

Generate a complete Playwright test in JavaScript/TypeScript format.
Include:
1. Test description
2. Navigation steps
3. Interaction steps (click, type, etc.)
4. Assertions
5. Proper selectors (prefer data-testid, role, or label)

Respond with ONLY the test code, no explanations."""

            gen_request = GenerationRequest(
                prompt=prompt,
                mode="ui",
                task_type="automation"
            )
            
            result = await self.model_gateway.generate(gen_request, tenant_id=tenant_id)
            
            return {
                "status": "success",
                "source": "requirement",
                "requirement_id": requirement_id,
                "test_code": result.response,
                "model": result.model
            }
        
        elif description:
            # Generate from free-form description
            prompt = f"""Generate a Playwright test for the following scenario:

{description}

Generate a complete Playwright test in JavaScript/TypeScript format.
Include navigation, interactions, and assertions."""

            gen_request = GenerationRequest(
                prompt=prompt,
                mode="ui",
                task_type="automation"
            )
            
            result = await self.model_gateway.generate(gen_request, tenant_id=tenant_id)
            
            return {
                "status": "success",
                "source": "description",
                "test_code": result.response,
                "model": result.model
            }
        
        else:
            raise ValueError("Either requirement_id, recording_id, or description must be provided")
    
    async def run_test(
        self,
        test_code: str,
        browser: str = "chromium",
        headless: bool = True,
        tenant_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """Execute a test using Playwright runner"""
        try:
            # Parse test code and create TestCase
            # For now, we'll create a simple test case
            # In production, you'd parse the Playwright code
            
            test_case = TestCase(
                case_id="generated_test",
                title="Generated Test",
                description="Test generated from requirement/recording",
                steps=[TestStep(action="execute", data={"code": test_code})]
            )
            
            # Run test
            result = await self.playwright_runner.run_test(
                test_case=test_case,
                browser=browser,
                headless=headless
            )
            
            return {
                "status": "success",
                "test_result": result,
                "browser": browser
            }
        
        except Exception as e:
            logger.error(f"Test execution failed: {e}", exc_info=True)
            return {
                "status": "failed",
                "error": str(e)
            }
    
    async def heal_test(
        self,
        test_id: str,
        failure_message: str,
        page_html: Optional[str] = None,
        tenant_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """Repair a failing test using self-healing"""
        # Get test details
        test = await self._get_test(test_id)
        if not test:
            raise ValueError(f"Test {test_id} not found")
        
        # Use self-healing service to repair selectors
        repair_result = self.self_healing.repair_selectors(
            failed_selector=test.get("selector", ""),
            page_html=page_html or "",
            error_message=failure_message
        )
        
        if repair_result and repair_result.candidates:
            # Use best candidate
            best_candidate = max(repair_result.candidates, key=lambda c: c.confidence)
            
            # Generate updated test code
            updated_code = await self._update_test_code(
                test.get("code", ""),
                test.get("selector", ""),
                best_candidate.selector,
                tenant_id
            )
            
            return {
                "status": "success",
                "test_id": test_id,
                "original_selector": test.get("selector", ""),
                "repaired_selector": best_candidate.selector,
                "confidence": best_candidate.confidence,
                "updated_code": updated_code,
                "candidates": [
                    {
                        "selector": c.selector,
                        "type": c.selector_type,
                        "confidence": c.confidence,
                        "reason": c.reason
                    }
                    for c in repair_result.candidates
                ]
            }
        
        return {
            "status": "failed",
            "message": "No repair candidates found"
        }
    
    async def generate_maintenance_suggestions(
        self,
        project_id: str,
        tenant_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """Generate maintenance suggestions for tests"""
        # Get failing tests
        failing_tests = await self._get_failing_tests(project_id, tenant_id)
        
        suggestions = []
        
        for test in failing_tests:
            # Analyze failure patterns
            failure_count = test.get("failure_count", 0)
            last_failure = test.get("last_failure", "")
            
            if failure_count > 3:
                suggestion = {
                    "test_id": test.get("id"),
                    "test_name": test.get("name"),
                    "type": "high_failure_rate",
                    "priority": "high",
                    "message": f"Test has failed {failure_count} times. Consider reviewing selectors or test logic.",
                    "recommendations": [
                        "Review and update selectors",
                        "Check if application has changed",
                        "Consider using more stable selectors (data-testid, role)"
                    ]
                }
                suggestions.append(suggestion)
        
        # Store suggestions
        await self._store_maintenance_suggestions(project_id, suggestions, tenant_id)
        
        return {
            "status": "success",
            "suggestions": suggestions,
            "count": len(suggestions)
        }
    
    # ==================== Helper Methods ====================
    
    async def _get_recording(self, recording_id: str) -> Optional[Dict[str, Any]]:
        """Get recording from database"""
        import concurrent.futures
        from app.services.storage.postgres_direct import get_postgres_pool
        
        pool = get_postgres_pool()
        if not pool:
            return None
        
        loop = asyncio.get_event_loop()
        with concurrent.futures.ThreadPoolExecutor() as executor:
            result = await loop.run_in_executor(
                executor,
                self._get_recording_sync,
                pool,
                recording_id
            )
        return result
    
    def _get_recording_sync(self, pool, recording_id: str) -> Optional[Dict[str, Any]]:
        """Synchronous recording query"""
        import json
        conn = pool.getconn()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT * FROM recordings WHERE id = %s",
                    (recording_id,)
                )
                row = cur.fetchone()
                if not row:
                    return None
                
                columns = [desc[0] for desc in cur.description]
                result = dict(zip(columns, row))
                
                if result.get("data"):
                    result["data"] = json.loads(result["data"]) if isinstance(result["data"], str) else result["data"]
                
                return result
        finally:
            pool.putconn(conn)
    
    async def _get_requirement(self, requirement_id: str) -> Optional[Dict[str, Any]]:
        """Get requirement from database"""
        import concurrent.futures
        from app.services.storage.postgres_direct import get_postgres_pool
        
        pool = get_postgres_pool()
        if not pool:
            return None
        
        loop = asyncio.get_event_loop()
        with concurrent.futures.ThreadPoolExecutor() as executor:
            result = await loop.run_in_executor(
                executor,
                self._get_requirement_sync,
                pool,
                requirement_id
            )
        return result
    
    def _get_requirement_sync(self, pool, requirement_id: str) -> Optional[Dict[str, Any]]:
        """Synchronous requirement query"""
        conn = pool.getconn()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT * FROM requirements WHERE id = %s",
                    (requirement_id,)
                )
                row = cur.fetchone()
                if not row:
                    return None
                
                columns = [desc[0] for desc in cur.description]
                return dict(zip(columns, row))
        finally:
            pool.putconn(conn)
    
    async def _get_test(self, test_id: str) -> Optional[Dict[str, Any]]:
        """Get test from database"""
        import concurrent.futures
        from app.services.storage.postgres_direct import get_postgres_pool
        
        pool = get_postgres_pool()
        if not pool:
            return None
        
        loop = asyncio.get_event_loop()
        with concurrent.futures.ThreadPoolExecutor() as executor:
            result = await loop.run_in_executor(
                executor,
                self._get_test_sync,
                pool,
                test_id
            )
        return result
    
    def _get_test_sync(self, pool, test_id: str) -> Optional[Dict[str, Any]]:
        """Synchronous test query"""
        import json
        conn = pool.getconn()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT * FROM test_cases WHERE id = %s",
                    (test_id,)
                )
                row = cur.fetchone()
                if not row:
                    return None
                
                columns = [desc[0] for desc in cur.description]
                result = dict(zip(columns, row))
                
                if result.get("code"):
                    result["code"] = json.loads(result["code"]) if isinstance(result["code"], str) else result["code"]
                
                return result
        finally:
            pool.putconn(conn)
    
    async def _get_failing_tests(
        self,
        project_id: str,
        tenant_id: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Get failing tests for a project"""
        import concurrent.futures
        from app.services.storage.postgres_direct import get_postgres_pool
        
        pool = get_postgres_pool()
        if not pool:
            return []
        
        loop = asyncio.get_event_loop()
        with concurrent.futures.ThreadPoolExecutor() as executor:
            results = await loop.run_in_executor(
                executor,
                self._get_failing_tests_sync,
                pool,
                project_id,
                tenant_id
            )
        return results
    
    def _get_failing_tests_sync(
        self,
        pool,
        project_id: str,
        tenant_id: Optional[str]
    ) -> List[Dict[str, Any]]:
        """Synchronous failing tests query"""
        conn = pool.getconn()
        try:
            with conn.cursor() as cur:
                query = """
                    SELECT 
                        tc.id,
                        tc.title as name,
                        COUNT(tr.id) FILTER (WHERE tr.status = 'failed') as failure_count,
                        MAX(tr.created_at) FILTER (WHERE tr.status = 'failed') as last_failure
                    FROM test_cases tc
                    LEFT JOIN test_runs tr ON tr.plan_id = tc.plan_id
                    WHERE tc.project_id = %s
                """
                params = [project_id]
                
                if tenant_id:
                    query += " AND tc.tenant_id = %s"
                    params.append(tenant_id)
                
                query += " GROUP BY tc.id, tc.title HAVING COUNT(tr.id) FILTER (WHERE tr.status = 'failed') > 0"
                
                cur.execute(query, params)
                columns = [desc[0] for desc in cur.description]
                return [dict(zip(columns, row)) for row in cur.fetchall()]
        finally:
            pool.putconn(conn)
    
    async def _update_test_code(
        self,
        original_code: str,
        old_selector: str,
        new_selector: str,
        tenant_id: Optional[str]
    ) -> str:
        """Update test code with new selector"""
        prompt = f"""Update the following Playwright test code by replacing the selector:

Old selector: {old_selector}
New selector: {new_selector}

Test code:
{original_code}

Replace all occurrences of the old selector with the new selector. Return ONLY the updated code."""

        gen_request = GenerationRequest(
            prompt=prompt,
            mode="ui",
            task_type="automation"
        )
        
        result = await self.model_gateway.generate(gen_request, tenant_id=tenant_id)
        return result.response
    
    async def _store_maintenance_suggestions(
        self,
        project_id: str,
        suggestions: List[Dict[str, Any]],
        tenant_id: Optional[str]
    ):
        """Store maintenance suggestions in database"""
        import concurrent.futures
        from app.services.storage.postgres_direct import get_postgres_pool
        import json
        
        pool = get_postgres_pool()
        if not pool:
            return
        
        loop = asyncio.get_event_loop()
        with concurrent.futures.ThreadPoolExecutor() as executor:
            await loop.run_in_executor(
                executor,
                self._store_suggestions_sync,
                pool,
                project_id,
                suggestions,
                tenant_id
            )
    
    def _store_suggestions_sync(
        self,
        pool,
        project_id: str,
        suggestions: List[Dict[str, Any]],
        tenant_id: Optional[str]
    ):
        """Synchronous suggestions insert"""
        import json
        conn = pool.getconn()
        try:
            with conn.cursor() as cur:
                for suggestion in suggestions:
                    cur.execute(
                        """
                        INSERT INTO maintenance_suggestions
                        (id, project_id, test_id, type, priority, message, recommendations, tenant_id, created_at)
                        VALUES (uuid_generate_v4(), %s, %s, %s, %s, %s, %s, %s, NOW())
                        ON CONFLICT (project_id, test_id) DO UPDATE
                        SET type = EXCLUDED.type,
                            priority = EXCLUDED.priority,
                            message = EXCLUDED.message,
                            recommendations = EXCLUDED.recommendations,
                            updated_at = NOW()
                        """,
                        (
                            project_id,
                            suggestion.get("test_id"),
                            suggestion.get("type"),
                            suggestion.get("priority"),
                            suggestion.get("message"),
                            json.dumps(suggestion.get("recommendations", [])),
                            tenant_id
                        )
                    )
                conn.commit()
        finally:
            pool.putconn(conn)


# Agent handler function
async def automation_agent_handler(request: AgentTaskRequest) -> AgentTaskResult:
    """Handler for Automation Agent tasks"""
    import asyncio
    start_time = time.time()
    
    agent = AutomationAgent()
    operation = request.input_data.get("operation")
    
    try:
        if operation == "generate":
            result = await agent.generate_test(
                requirement_id=request.input_data.get("requirement_id"),
                recording_id=request.input_data.get("recording_id"),
                description=request.input_data.get("description"),
                tenant_id=request.tenant_id
            )
        
        elif operation == "run":
            result = await agent.run_test(
                test_code=request.input_data.get("test_code"),
                browser=request.input_data.get("browser", "chromium"),
                headless=request.input_data.get("headless", True),
                tenant_id=request.tenant_id
            )
        
        elif operation == "heal":
            result = await agent.heal_test(
                test_id=request.input_data.get("test_id"),
                failure_message=request.input_data.get("failure_message"),
                page_html=request.input_data.get("page_html"),
                tenant_id=request.tenant_id
            )
        
        elif operation == "maintenance_suggestions":
            result = await agent.generate_maintenance_suggestions(
                project_id=request.project_id or "",
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
        logger.error(f"Automation agent task failed: {e}", exc_info=True)
        return AgentTaskResult(
            task_id=request.task_id,
            agent_type=request.agent_type,
            status=AgentStatus.FAILED,
            error=str(e),
            started_at=datetime.utcnow(),
            completed_at=datetime.utcnow(),
            duration_ms=(time.time() - start_time) * 1000
        )

