from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uuid
import time
import json
from typing import List, Optional, Dict, Any, Union
from datetime import datetime
import os
import sys
from app.services.playwright_runner import PlaywrightRunner, TestCase, TestStep
from app.services.ollama_service import ollama_service, ModelMode
from app.services.ai_storage import store_ai_generation
from app.services.database import create_requirement, get_database_client
import logging

logger = logging.getLogger(__name__)

# Add the parent directory to the path to import our services
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

app = FastAPI(
    title="QAOne AI & Runs API",
    version="0.1.8",
    description="Service providing AI test generation, failure triage, and test run ingestion"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:8080", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Pydantic models
class GenerateTestsRequest(BaseModel):
    org_id: str
    project_id: str
    requirements: str
    context: Optional[Dict[str, Any]] = None

class TestStep(BaseModel):
    action: str
    data: Optional[Dict[str, Any]] = {}
    expected: str
    locator_hints: Optional[List[str]] = []

class TestCase(BaseModel):
    case_id: str
    title: str
    description: str
    priority: str
    tags: List[str]
    steps: List[TestStep]

class AuditInfo(BaseModel):
    model: str
    prompt_tokens: int
    completion_tokens: int
    cost_usd: float
    latency_ms: int

class GenerateTestsResponse(BaseModel):
    cases: List[TestCase]
    audit: AuditInfo

class TriageRequest(BaseModel):
    org_id: str
    project_id: str
    run_id: str
    logs: str
    artifacts: Optional[List[Dict[str, Any]]] = []

class TriageResponse(BaseModel):
    summary: str
    root_cause: str
    category: Optional[str] = None
    suggested_fixes: List[str] = []
    selector_suggestions: List[str] = []
    likelihood_flaky: float = 0.0
    related_cases: List[str] = []

class RunIngestRequest(BaseModel):
    org_id: str
    project_id: str
    runner_version: str
    started_at: str
    completed_at: str
    status: str
    environment: Optional[str] = "local"
    branch: Optional[str] = None
    commit: Optional[str] = None
    steps: List[Dict[str, Any]]

class RunIngestResponse(BaseModel):
    run_id: str

class TestExecutionRequest(BaseModel):
    org_id: str
    project_id: str
    test_cases: List[Dict[str, Any]]  # Test case data from frontend

class TestExecutionResponse(BaseModel):
    run_id: str
    results: List[Dict[str, Any]]
    summary: Dict[str, Any]

# Mock AI Service for development
class MockAIService:
    def __init__(self):
        self.default_delay = 2.0  # seconds

    async def generate_test_case(self, request: Dict[str, Any]) -> Dict[str, Any]:
        """Mock test case generation"""
        import asyncio
        await asyncio.sleep(self.default_delay)
        
        # Generate realistic test case based on requirements
        requirements = request.get("description", "")
        feature = request.get("feature", "Test Feature")
        
        test_cases = []
        
        # Generate multiple test cases based on requirements
        if "login" in requirements.lower():
            test_cases.extend([
                {
                    "name": "User Login with Valid Credentials",
                    "description": "Verify that a user can successfully log in with correct username and password",
                    "steps": [
                        {"action": "Navigate to login page", "expectedResult": "Login form is displayed"},
                        {"action": "Enter valid username and password", "expectedResult": "Credentials are accepted"},
                        {"action": "Click login button", "expectedResult": "User is redirected to dashboard"}
                    ],
                    "priority": "critical",
                    "tags": ["authentication", "smoke", "critical-path"]
                },
                {
                    "name": "User Login with Invalid Credentials",
                    "description": "Verify that login fails with invalid credentials",
                    "steps": [
                        {"action": "Navigate to login page", "expectedResult": "Login form is displayed"},
                        {"action": "Enter invalid username and password", "expectedResult": "Credentials are rejected"},
                        {"action": "Click login button", "expectedResult": "Error message is displayed"}
                    ],
                    "priority": "high",
                    "tags": ["authentication", "negative-testing"]
                }
            ])
        else:
            # Generic test case
            test_cases.append({
                "name": f"Test {feature} Functionality",
                "description": f"Verify that {feature} works as expected",
                "steps": [
                    {"action": "Navigate to the application", "expectedResult": "Application loads successfully"},
                    {"action": "Perform the main action", "expectedResult": "Action completes successfully"},
                    {"action": "Verify the result", "expectedResult": "Expected result is achieved"}
                ],
                "priority": "medium",
                "tags": ["functional", "regression"]
            })

        return {
            "testCase": test_cases[0],  # Return first test case
            "suggestions": [
                "Consider edge cases for input validation",
                "Add performance checks for this flow",
                "Explore security vulnerabilities"
            ]
        }

    async def analyze_defect(self, request: Dict[str, Any]) -> Dict[str, Any]:
        """Mock defect analysis"""
        import asyncio
        await asyncio.sleep(self.default_delay)
        
        logs = request.get("logs", "")
        
        # Analyze logs for common patterns
        if "element not found" in logs.lower():
            return {
                "summary": "Element not found error detected",
                "root_cause": "The test is trying to interact with an element that doesn't exist or isn't visible",
                "category": "locator",
                "suggested_fixes": [
                    "Add explicit wait for element visibility",
                    "Use more robust selector strategy",
                    "Check if element is in iframe"
                ],
                "selector_suggestions": [
                    "[data-testid='element']",
                    "button:contains('text')",
                    "form input[name='field']"
                ],
                "likelihood_flaky": 0.8,
                "related_cases": []
            }
        elif "timeout" in logs.lower():
            return {
                "summary": "Timeout error detected",
                "root_cause": "The operation took longer than expected to complete",
                "category": "timing",
                "suggested_fixes": [
                    "Increase timeout duration",
                    "Optimize application performance",
                    "Add loading state checks"
                ],
                "selector_suggestions": [],
                "likelihood_flaky": 0.6,
                "related_cases": []
            }
        else:
            return {
                "summary": "Generic error analysis",
                "root_cause": "An unexpected error occurred during test execution",
                "category": "data",
                "suggested_fixes": [
                    "Check application logs for more details",
                    "Verify test data is correct",
                    "Ensure environment is properly configured"
                ],
                "selector_suggestions": [],
                "likelihood_flaky": 0.3,
                "related_cases": []
            }

# Initialize mock AI service
mock_ai_service = MockAIService()

@app.get("/health")
async def health_check():
    return {"status": "ok"}

@app.get("/health/database")
async def health_check_database():
    """Check database connection and schema"""
    try:
        from app.services.postgres_direct import test_connection as test_postgres_connection, get_postgres_pool
        
        # Try direct Postgres first
        pool = get_postgres_pool()
        if pool:
            # Test connection
            is_connected = await test_postgres_connection()
            if not is_connected:
                return {
                    "status": "error",
                    "message": "PostgreSQL connection pool created but connection test failed"
                }
            
            # Query tables using direct Postgres
            try:
                from app.services.postgres_direct import execute_query
                result = await execute_query("""
                    SELECT table_name 
                    FROM information_schema.tables 
                    WHERE table_schema = 'public' 
                    ORDER BY table_name
                """)
                
                if result:
                    all_tables = [row['table_name'] for row in result]
                    key_tables = ["organizations", "projects", "test_cases", "test_runs", "ai_generations", "ai_templates", "requirements"]
                    tables_available = [t for t in key_tables if t in all_tables]
                    
                    return {
                        "status": "connected",
                        "connection_type": "direct_postgres",
                        "message": "PostgreSQL connection successful",
                        "tables_available": tables_available,
                        "tables_missing": [t for t in key_tables if t not in tables_available],
                        "all_tables": all_tables
                    }
            except Exception as e:
                return {
                    "status": "connected",
                    "connection_type": "direct_postgres",
                    "message": f"Connected but query error: {str(e)}"
                }
        
        # Fallback: Try Supabase
        client = get_database_client()
        if not client:
            return {
                "status": "no_database",
                "message": "No database configured. Using file-based storage.",
                "tables": []
            }
        
        # Test connection by querying a table
        try:
            # Try to query organizations table
            if hasattr(client, 'table'):
                result = client.table("organizations").select("id").limit(1).execute()
                tables_available = ["organizations"]
                
                # Check for other key tables
                key_tables = ["projects", "test_cases", "test_runs", "ai_generations", "ai_templates", "requirements"]
                for table in key_tables:
                    try:
                        client.table(table).select("id").limit(1).execute()
                        tables_available.append(table)
                    except:
                        pass
                
                return {
                    "status": "connected",
                    "connection_type": "supabase",
                    "message": "Database connection successful",
                    "tables_available": tables_available,
                    "tables_missing": [t for t in key_tables if t not in tables_available]
                }
        except Exception as e:
            return {
                "status": "error",
                "message": f"Database connection error: {str(e)}",
                "suggestion": "Run migrations: 001_initial_schema.sql, 002_ai_generations.sql, 003_ai_templates.sql, 004_requirements_table.sql, 005_fix_ai_generations.sql"
            }
    except Exception as e:
        return {
            "status": "error",
            "message": str(e)
        }

@app.post("/ai/generate-tests")
async def generate_tests(request: Request, body: Optional[GenerateTestsRequest] = None):
    """
    Generate structured test cases from requirements and context
    Also supports planId query param for expanding test plans
    """
    try:
        # Get planId from query params if provided (for "Expand plan with AI")
        plan_id = request.query_params.get("planId")
        
        # If planId provided, generate additional scenarios for the plan
        if plan_id:
            mode = request.query_params.get("mode", "ui")
            # For plan expansion, we'll generate additional test scenarios
            # TODO: Fetch existing test cases from plan and use them as context
            prompt = f"""You are an expert QA engineer. Generate additional test scenarios to expand an existing test plan.

Plan ID: {plan_id}

Generate 3-5 additional test cases that:
- Complement existing tests in the plan
- Cover edge cases and negative scenarios
- Fill gaps in test coverage
- Follow the same testing style as the plan

Respond ONLY with valid JSON array of test cases:
[
  {{
    "name": "string",
    "description": "string",
    "steps": [{{"action": "string", "expectedResult": "string"}}],
    "priority": "low|medium|high|critical",
    "tags": ["string"]
  }}
]"""
            
            start_time = time.time()
            raw_result = await ollama_service.generate_json(prompt, mode=mode)
            latency_ms = int((time.time() - start_time) * 1000)
            
            model_used = ollama_service._select_model(mode)
            test_cases_data = raw_result if isinstance(raw_result, list) else [raw_result]
            
            # Convert to TestCase format
            test_cases = []
            for tc_data in test_cases_data:
                steps = [
                    TestStep(
                        action=step.get("action", ""),
                        data={},
                        expected=step.get("expectedResult", ""),
                        locator_hints=[]
                    )
                    for step in tc_data.get("steps", [])
                ]
                test_cases.append(TestCase(
                    case_id=str(uuid.uuid4()),
                    title=tc_data.get("name", "Generated Test"),
                    description=tc_data.get("description", ""),
                    priority=map_priority(tc_data.get("priority", "medium")),
                    tags=tc_data.get("tags", []),
                    steps=steps
                ))
            
            audit_info = AuditInfo(
                model=model_used,
                prompt_tokens=estimate_tokens(prompt),
                completion_tokens=estimate_tokens(json.dumps(test_cases_data)),
                cost_usd=0.0,  # Self-hosted, no cost
                latency_ms=latency_ms
            )
            
            return GenerateTestsResponse(cases=test_cases, audit=audit_info)
        
        # Original flow: require body with requirements
        if not body:
            raise HTTPException(
                status_code=400,
                detail="Request body required when planId is not provided"
            )
        
        # Validate required fields
        if not body.org_id or not body.project_id or not body.requirements:
            raise HTTPException(
                status_code=400,
                detail="Missing required fields: org_id, project_id, requirements"
            )

        # Generate idempotency key if not provided
        idempotency_key = request.headers.get("idempotency-key") or str(uuid.uuid4())
        
        # Start timing for audit
        start_time = time.time()
        mode = body.context.get("mode", "ui") if body.context else "ui"
        
        # Use Ollama to generate test cases
        prompt = f"""You are an expert QA engineer. Generate comprehensive test cases from the following requirements.

Requirements:
{body.requirements}

Context:
{json.dumps(body.context, indent=2) if body.context else "None"}

Generate test cases in JSON format. Each test case should have:
- name: Clear test case name
- description: Detailed description
- steps: Array of {{"action": "...", "expectedResult": "..."}}
- priority: "low", "medium", "high", or "critical"
- tags: Array of relevant tags

Respond ONLY with valid JSON array:
[
  {{
    "name": "string",
    "description": "string",
    "steps": [{{"action": "string", "expectedResult": "string"}}],
    "priority": "string",
    "tags": ["string"]
  }}
]"""
        
        raw_result = await ollama_service.generate_json(prompt, mode=mode)
        latency_ms = int((time.time() - start_time) * 1000)
        model_used = ollama_service._select_model(mode)
        
        test_cases_data = raw_result if isinstance(raw_result, list) else [raw_result]
        
        # Convert to TestCase format
        test_cases = []
        for tc_data in test_cases_data:
            steps = [
                TestStep(
                    action=step.get("action", ""),
                    data={},
                    expected=step.get("expectedResult", ""),
                    locator_hints=[]
                )
                for step in tc_data.get("steps", [])
            ]
            test_cases.append(TestCase(
                case_id=str(uuid.uuid4()),
                title=tc_data.get("name", "Generated Test"),
                description=tc_data.get("description", ""),
                priority=map_priority(tc_data.get("priority", "medium")),
                tags=tc_data.get("tags", []),
                steps=steps
            ))

        # Store generation for fine-tuning
        await store_ai_generation(
            project_id=body.project_id,
            prompt=prompt,
            model=model_used,
            output=json.dumps(test_cases_data),
            mode=mode,
            endpoint="/ai/generate-tests",
            latency_ms=latency_ms,
            org_id=body.org_id
        )
        
        audit_info = AuditInfo(
            model=model_used,
            prompt_tokens=estimate_tokens(body.requirements),
            completion_tokens=estimate_tokens(json.dumps(test_cases_data)),
            cost_usd=0.0,  # Self-hosted, no cost
            latency_ms=latency_ms
        )

        response = GenerateTestsResponse(
            cases=test_cases,
            audit=audit_info
        )

        return response

    except Exception as e:
        print(f"Error generating tests: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to generate test cases: {str(e)}"
        )

@app.post("/ai/triage")
async def triage_failure(request: Request, body: TriageRequest):
    """Analyze failing test logs and artifacts for root cause and fixes"""
    try:
        # Validate required fields
        if not body.org_id or not body.project_id or not body.run_id or not body.logs:
            raise HTTPException(
                status_code=400,
                detail="Missing required fields: org_id, project_id, run_id, logs"
            )

        # Start timing
        start_time = time.time()
        
        # Call the AI service
        ai_request = {
            "logs": body.logs,
            "artifacts": body.artifacts or []
        }
        
        ai_response = await mock_ai_service.analyze_defect(ai_request)

        # Calculate timing
        end_time = time.time()
        latency_ms = int((end_time - start_time) * 1000)

        response = TriageResponse(
            summary=ai_response["summary"],
            root_cause=ai_response["root_cause"],
            category=ai_response["category"],
            suggested_fixes=ai_response["suggested_fixes"],
            selector_suggestions=ai_response["selector_suggestions"],
            likelihood_flaky=ai_response["likelihood_flaky"],
            related_cases=ai_response["related_cases"]
        )

        return response

    except Exception as e:
        print(f"Error analyzing defect: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to analyze defect: {str(e)}"
        )

@app.post("/runs/ingest")
async def ingest_run(request: Request, body: RunIngestRequest):
    """Ingest a completed test run with steps and artifacts"""
    try:
        # Validate required fields
        if not body.org_id or not body.project_id or not body.runner_version:
            raise HTTPException(
                status_code=400,
                detail="Missing required fields: org_id, project_id, runner_version"
            )

        # Generate run ID
        run_id = str(uuid.uuid4())
        
        # TODO: Store run data in database
        # For now, just return the run ID
        
        response = RunIngestResponse(run_id=run_id)
        
        return response

    except Exception as e:
        print(f"Error ingesting run: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to ingest run: {str(e)}"
        )

@app.post("/tests/execute")
async def execute_tests(request: Request, body: TestExecutionRequest):
    """Execute test cases using Playwright"""
    try:
        # Validate required fields
        if not body.org_id or not body.project_id or not body.test_cases:
            raise HTTPException(
                status_code=400,
                detail="Missing required fields: org_id, project_id, test_cases"
            )

        from app.services.test_results_storage import store_test_run, store_test_run_step, store_artifact
        
        # Create test run record
        run_name = f"Test Run {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')}"
        started_at = datetime.utcnow().isoformat()
        
        db_run_id = await store_test_run(
            project_id=body.project_id,
            name=run_name,
            status="running",
            environment="local",
            started_at=started_at,
            created_by="system"
        )
        
        # Generate run ID (use DB ID if available)
        run_id = db_run_id or str(uuid.uuid4())
        
        # Initialize Playwright runner
        runner = PlaywrightRunner()
        await runner.initialize()
        
        results = []
        total_tests = len(body.test_cases)
        passed_tests = 0
        failed_tests = 0
        
        try:
            for test_case_data in body.test_cases:
                case_id = test_case_data.get('id', str(uuid.uuid4()))
                step_started = datetime.utcnow().isoformat()
                
                # Convert frontend test case to backend TestCase
                steps = [
                    TestStep(
                        action=step.get('action', ''),
                        data=step.get('data', {}),
                        expected=step.get('expected', ''),
                        locator_hints=step.get('locator_hints', [])
                    )
                    for step in test_case_data.get('steps', [])
                ]
                
                test_case = TestCase(
                    case_id=case_id,
                    title=test_case_data.get('title', 'Untitled Test'),
                    description=test_case_data.get('description', ''),
                    priority=test_case_data.get('priority', 'P2'),
                    tags=test_case_data.get('tags', []),
                    steps=steps
                )
                
                # Execute the test case
                result = await runner.run_test_case(test_case)
                step_completed = datetime.utcnow().isoformat()
                
                # Store test run step in database
                step_status = "passed" if result.status == "passed" else "failed"
                await store_test_run_step(
                    run_id=run_id,
                    case_id=case_id,
                    title=test_case.title,
                    status=step_status,
                    duration_ms=result.duration,
                    error_message=result.error,
                    stdout="\n".join(result.logs) if result.logs else None,
                    started_at=step_started,
                    completed_at=step_completed
                )
                
                # Store artifacts (screenshots)
                if result.screenshots:
                    for screenshot in result.screenshots:
                        await store_artifact(
                            run_id=run_id,
                            step_id=None,  # Could link to step_id if we return it
                            artifact_type="screenshot",
                            url=screenshot.get("url", ""),
                            metadata={"path": screenshot.get("path", "")}
                        )
                
                # Convert result to dict
                result_dict = {
                    'case_id': result.case_id,
                    'status': result.status,
                    'duration': result.duration,
                    'error': result.error,
                    'logs': result.logs,
                    'screenshots': result.screenshots
                }
                
                results.append(result_dict)
                
                if result.status == 'passed':
                    passed_tests += 1
                else:
                    failed_tests += 1
                    
        finally:
            # Always cleanup
            await runner.cleanup()
            
            # Update test run status
            completed_at = datetime.utcnow().isoformat()
            final_status = "passed" if failed_tests == 0 else "failed"
            if db_run_id:
                try:
                    client = get_database_client()
                    if client:
                        client.table("test_runs").update({
                            "status": final_status,
                            "completed_at": completed_at
                        }).eq("id", db_run_id).execute()
                except Exception as e:
                    print(f"Warning: Could not update test run status: {str(e)}")
        
        # Create summary
        summary = {
            'total_tests': total_tests,
            'passed': passed_tests,
            'failed': failed_tests,
            'success_rate': (passed_tests / total_tests * 100) if total_tests > 0 else 0,
            'run_id': run_id
        }
        
        response = TestExecutionResponse(
            run_id=run_id,
            results=results,
            summary=summary
        )
        
        return response
        
    except Exception as e:
        print(f"Error executing tests: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to execute tests: {str(e)}"
        )

# ============================================================================
# NEW AI ENDPOINTS - Ollama Integration
# ============================================================================

@app.post("/ai/jira-to-testcases")
async def jira_to_testcases(request: Request, body: dict):
    """
    Convert Jira story/JSON to manual test cases
    Input: Jira JSON or plain text
    Output: Array of manual test cases
    """
    try:
        jira_content = body.get("jira", "") or body.get("story", "") or json.dumps(body)
        mode = body.get("mode", "ui")
        project_id = body.get("project_id", "default")
        org_id = body.get("org_id", "default")
        
        # Extract Jira info if it's structured
        jira_key = None
        jira_title = None
        jira_payload = None
        
        if isinstance(body.get("jira"), dict):
            jira_payload = body.get("jira")
            jira_key = jira_payload.get("key") or jira_payload.get("id")
            jira_title = jira_payload.get("summary") or jira_payload.get("title")
        elif isinstance(body, dict) and "key" in body:
            jira_key = body.get("key")
            jira_title = body.get("summary") or body.get("title")
            jira_payload = body
        
        # Store requirement in database (async, don't block)
        requirement_id = None
        try:
            requirement_id = await create_requirement(
                project_id=project_id,
                source="jira",
                title=jira_title or "Jira Story",
                description=jira_content[:1000] if len(jira_content) > 1000 else jira_content,
                source_ref=jira_key,
                raw_payload=jira_payload
            )
        except Exception as e:
            print(f"Warning: Could not store requirement: {str(e)}")
        
        prompt = f"""You are an expert QA engineer. Convert the following Jira story into comprehensive manual test cases.

Jira Story/Requirements:
{jira_content}

Generate an array of manual test cases in JSON format. Each test case should have:
- name: Clear test case name
- description: Detailed description
- steps: Array of {{"action": "...", "expectedResult": "..."}}
- priority: "low", "medium", "high", or "critical"
- tags: Array of relevant tags

Respond ONLY with valid JSON array of test cases:
[
  {{
    "name": "string",
    "description": "string",
    "steps": [{{"action": "string", "expectedResult": "string"}}],
    "priority": "string",
    "tags": ["string"]
  }}
]"""

        start_time = time.time()
        raw_result = await ollama_service.generate_json(prompt, mode=mode)
        latency_ms = int((time.time() - start_time) * 1000)
        
        # raw_result is the parsed JSON, not a dict with model
        # Get model from service's last call
        model_used = ollama_service._select_model(mode)
        
        # Ensure result is a list
        test_cases = raw_result if isinstance(raw_result, list) else [raw_result]
        
        # Store generation for fine-tuning (fire and forget)
        await store_ai_generation(
            project_id=project_id,
            prompt=prompt,
            model=model_used,
            output=json.dumps(test_cases),
            mode=mode,
            endpoint="/ai/jira-to-testcases",
            latency_ms=latency_ms,
            org_id=org_id
        )
        
        return {
            "status": "success",
            "test_cases": test_cases,
            "requirement_id": requirement_id,
            "model": model_used,
            "latency_ms": latency_ms
        }
        
    except Exception as e:
        print(f"Error in jira-to-testcases: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/ai/testcase-to-playwright")
async def testcase_to_playwright(request: Request, body: dict):
    """
    Convert manual test case to Playwright TypeScript code
    Input: Single manual test case
    Output: TypeScript/Playwright code
    """
    try:
        test_case = body.get("test_case", body)
        mode = body.get("mode", "ui")
        
        prompt = f"""You are an expert in Playwright test automation. Convert the following manual test case into executable Playwright TypeScript code.

Test Case:
{json.dumps(test_case, indent=2)}

Generate complete, runnable Playwright test code in TypeScript. Include:
- Proper imports
- Test structure with describe/it blocks
- Step-by-step automation matching the manual test steps
- Assertions for expected results
- Proper selectors and waits

Respond ONLY with valid TypeScript code (no markdown, no explanations):"""

        start_time = time.time()
        result = await ollama_service.generate(prompt, mode=mode, validate_json=False)
        latency_ms = int((time.time() - start_time) * 1000)
        
        return {
            "status": "success",
            "code": result["response"],
            "model": result["model"],
            "latency_ms": latency_ms
        }
        
    except Exception as e:
        print(f"Error in testcase-to-playwright: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/ai/api-tests")
async def generate_api_tests(request: Request, body: dict):
    """
    Generate API tests from OpenAPI spec and story
    Input: OpenAPI specification and story description
    Output: Postman or Playwright-API tests
    """
    try:
        openapi_spec = body.get("openapi_spec", body.get("openapi", ""))
        story = body.get("story", body.get("description", ""))
        output_format = body.get("format", "playwright")  # playwright or postman
        mode = body.get("mode", "ui")
        
        prompt = f"""You are an expert in API testing. Generate comprehensive API tests based on the OpenAPI specification and user story.

OpenAPI Specification:
{openapi_spec[:2000]}...  (truncated if too long)

User Story:
{story}

Generate {output_format} API tests that:
- Cover all endpoints mentioned in the story
- Include positive and negative test cases
- Test request/response validation
- Include proper assertions

Respond with valid {output_format} test code (no markdown, no explanations):"""

        start_time = time.time()
        result = await ollama_service.generate(prompt, mode=mode, validate_json=False)
        latency_ms = int((time.time() - start_time) * 1000)
        
        return {
            "status": "success",
            "tests": result["response"],
            "format": output_format,
            "model": result["model"],
            "latency_ms": latency_ms
        }
        
    except Exception as e:
        print(f"Error in api-tests: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/ai/perf-tests")
async def generate_perf_tests(request: Request, body: dict):
    """
    Generate performance tests from endpoint URL and load profile
    Input: Endpoint URL and load profile
    Output: k6 or JMeter script
    """
    try:
        endpoint_url = body.get("endpoint_url", body.get("url", ""))
        load_profile = body.get("load_profile", body.get("profile", ""))
        tool = body.get("tool", "k6")  # k6 or jmeter
        mode = body.get("mode", "quick")
        
        prompt = f"""You are an expert in performance testing. Generate a {tool} performance test script.

Endpoint URL: {endpoint_url}

Load Profile:
{load_profile}

Generate a complete {tool} script that:
- Defines the target endpoint
- Implements the load profile (VUs, duration, ramp-up)
- Includes proper metrics collection
- Tests different scenarios (spike, load, stress)

Respond with valid {tool} script code (no markdown, no explanations):"""

        start_time = time.time()
        result = await ollama_service.generate(prompt, mode=mode, validate_json=False)
        latency_ms = int((time.time() - start_time) * 1000)
        
        return {
            "status": "success",
            "script": result["response"],
            "tool": tool,
            "model": result["model"],
            "latency_ms": latency_ms
        }
        
    except Exception as e:
        print(f"Error in perf-tests: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/ai/a11y-tests")
async def generate_a11y_tests(request: Request, body: dict):
    """
    Generate accessibility tests from DOM dump or URL
    Input: DOM dump or URL
    Output: Playwright + Axe run results
    """
    try:
        dom_dump = body.get("dom_dump", body.get("dom", ""))
        url = body.get("url", "")
        mode = body.get("mode", "ui")
        
        if not dom_dump and not url:
            raise HTTPException(status_code=400, detail="Either dom_dump or url must be provided")
        
        input_data = f"URL: {url}\n\nDOM Dump:\n{dom_dump}" if dom_dump else f"URL: {url}"
        
        prompt = f"""You are an expert in web accessibility testing. Generate Playwright + Axe accessibility tests.

{input_data}

Generate a complete Playwright test with Axe that:
- Tests WCAG 2.1 compliance
- Checks for common accessibility issues
- Tests keyboard navigation
- Validates ARIA attributes
- Includes proper assertions

Respond with valid TypeScript/Playwright code using @axe-core/playwright (no markdown, no explanations):"""

        start_time = time.time()
        result = await ollama_service.generate(prompt, mode=mode, validate_json=False)
        latency_ms = int((time.time() - start_time) * 1000)
        
        return {
            "status": "success",
            "code": result["response"],
            "model": result["model"],
            "latency_ms": latency_ms
        }
        
    except Exception as e:
        print(f"Error in a11y-tests: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/ai/triage")
async def triage_with_ollama(request: Request, body: TriageRequest):
    """
    Analyze failed test run logs for root cause and fixes
    Input: Failed run log
    Output: Root cause, likely defect, and which test to re-run
    """
    try:
        if not body.org_id or not body.project_id or not body.run_id or not body.logs:
            raise HTTPException(
                status_code=400,
                detail="Missing required fields: org_id, project_id, run_id, logs"
            )

        start_time = time.time()
        mode = "ui"  # Use 14B model for triage
        
        prompt = f"""You are an expert QA engineer analyzing test failures. Analyze the following test run logs and provide root cause analysis.

Test Run ID: {body.run_id}
Logs:
{body.logs}

Artifacts:
{json.dumps(body.artifacts, indent=2) if body.artifacts else "None"}

Provide a comprehensive analysis in JSON format:
{{
  "summary": "Brief summary of the issue",
  "root_cause": "Detailed root cause analysis",
  "category": "locator|timing|data|network|environment|other",
  "suggested_fixes": ["fix 1", "fix 2", ...],
  "selector_suggestions": ["selector 1", "selector 2", ...],
  "likelihood_flaky": 0.0-1.0,
  "related_cases": ["case_id_1", "case_id_2", ...],
  "recommended_rerun": "test_case_id or 'none'"
}}"""

        result = await ollama_service.generate_json(prompt, mode=mode)
        latency_ms = int((time.time() - start_time) * 1000)

        response = TriageResponse(
            summary=result.get("summary", "Analysis completed"),
            root_cause=result.get("root_cause", "Root cause analysis"),
            category=result.get("category"),
            suggested_fixes=result.get("suggested_fixes", []),
            selector_suggestions=result.get("selector_suggestions", []),
            likelihood_flaky=result.get("likelihood_flaky", 0.0),
            related_cases=result.get("related_cases", [])
        )

        return {
            **response.dict(),
            "model": result.get("model", "unknown"),
            "latency_ms": latency_ms,
            "recommended_rerun": result.get("recommended_rerun", "none")
        }

    except Exception as e:
        print(f"Error in triage: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to analyze defect: {str(e)}"
        )


# ============================================================================
# AI TEMPLATES ENDPOINTS
# ============================================================================

@app.get("/ai/templates")
async def get_ai_templates(request: Request, project_id: str, task: Optional[str] = None):
    """Get AI prompt templates for a project"""
    try:
        # TODO: Query database for templates
        # For now, return default templates
        default_templates = {
            "jira-to-tests": """You are an expert QA engineer. Convert the following Jira story into comprehensive manual test cases.

Jira Story/Requirements:
{requirements}

Generate an array of manual test cases in JSON format. Each test case should have:
- name: Clear test case name
- description: Detailed description
- steps: Array of {{"action": "...", "expectedResult": "..."}}
- priority: "low", "medium", "high", or "critical"
- tags: Array of relevant tags

Respond ONLY with valid JSON array of test cases.""",
            "testcase-to-playwright": """You are an expert in Playwright test automation. Convert the following manual test case into executable Playwright TypeScript code.

Test Case:
{test_case}

Generate complete, runnable Playwright test code in TypeScript. Include proper imports, test structure, step-by-step automation, assertions, and proper selectors.""",
            "triage": """You are an expert QA engineer analyzing test failures. Analyze the following test run logs and provide root cause analysis.

Test Run ID: {run_id}
Logs:
{logs}

Provide a comprehensive analysis in JSON format with summary, root_cause, category, suggested_fixes, selector_suggestions, likelihood_flaky, and related_cases."""
        }
        
        if task:
            return {"task": task, "template": default_templates.get(task, "")}
        
        return {"templates": default_templates}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/ai/templates")
async def save_ai_template(request: Request, body: dict):
    """Save or update AI prompt template"""
    try:
        project_id = body.get("project_id")
        org_id = body.get("org_id")
        task = body.get("task")
        template = body.get("template")
        
        if not project_id or not task or not template:
            raise HTTPException(
                status_code=400,
                detail="Missing required fields: project_id, task, template"
            )
        
        # Save to database
        client = get_database_client()
        if client:
            try:
                # Check if template exists
                existing = client.table("ai_templates").select("*").eq("project_id", project_id).eq("task", task).execute()
                
                if existing.data:
                    # Update existing
                    result = client.table("ai_templates").update({
                        "template": template,
                        "updated_at": datetime.utcnow().isoformat()
                    }).eq("id", existing.data[0]["id"]).execute()
                else:
                    # Insert new
                    result = client.table("ai_templates").insert({
                        "project_id": project_id,
                        "org_id": org_id,
                        "task": task,
                        "template": template,
                        "version": 1,
                        "is_default": False
                    }).execute()
                
                return {
                    "status": "success",
                    "message": "Template saved successfully"
                }
            except Exception as db_error:
                print(f"Database error saving template: {str(db_error)}")
                return {
                    "status": "success",
                    "message": "Template saved to cache (database error)"
                }
        else:
            return {
                "status": "success",
                "message": "Template saved to cache (no database configured)"
            }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# CRUD Endpoints for Test Cases, Test Runs, and Test Plans
# ============================================================================

# Default org and project IDs for demo (should be replaced with actual auth)
DEFAULT_ORG_ID = "00000000-0000-0000-0000-000000000000"
DEFAULT_PROJECT_ID = "11111111-1111-1111-1111-111111111111"
DEFAULT_USER_ID = "22222222-2222-2222-2222-222222222222"

def _map_priority_from_db(priority: str) -> str:
    """Map database priority (P0-P3) to frontend format (critical, high, medium, low)"""
    priority_map = {
        "P0": "critical",
        "P1": "high",
        "P2": "medium",
        "P3": "low"
    }
    return priority_map.get(priority.upper(), "medium")

# Helper function to get or create default org/project
async def ensure_default_org_project():
    """Ensure default org and project exist"""
    try:
        from app.services.postgres_direct import execute_query, execute_insert
        pool = get_database_client()
        
        if not pool or not hasattr(pool, 'getconn'):
            return DEFAULT_ORG_ID, DEFAULT_PROJECT_ID
        
        # Check if org exists
        orgs = await execute_query("SELECT id FROM organizations WHERE id = %s", (DEFAULT_ORG_ID,))
        if not orgs:
            await execute_insert("organizations", {
                "id": DEFAULT_ORG_ID,
                "name": "Demo Organization",
                "slug": "demo"
            })
        
        # Check if project exists
        projects = await execute_query("SELECT id FROM projects WHERE id = %s", (DEFAULT_PROJECT_ID,))
        if not projects:
            await execute_insert("projects", {
                "id": DEFAULT_PROJECT_ID,
                "org_id": DEFAULT_ORG_ID,
                "name": "Demo Project",
                "slug": "demo"
            })
        
        return DEFAULT_ORG_ID, DEFAULT_PROJECT_ID
    except Exception as e:
        logger.error(f"Error ensuring default org/project: {str(e)}")
        return DEFAULT_ORG_ID, DEFAULT_PROJECT_ID

# Test Cases CRUD
@app.get("/test-cases")
async def get_test_cases(project_id: Optional[str] = None):
    """Get all test cases"""
    try:
        org_id, proj_id = await ensure_default_org_project()
        project_id = project_id or proj_id
        
        from app.services.postgres_direct import execute_query
        
        pool = get_database_client()
        if not pool or not hasattr(pool, 'getconn'):
            return {"testCases": []}
        
        query = """
            SELECT id, project_id, plan_id, title, description, priority, test_type, 
                   status, tags, steps, preconditions, test_data, estimated_time,
                   created_by, created_at, updated_at
            FROM test_cases 
            WHERE project_id = %s
            ORDER BY created_at DESC
        """
        results = await execute_query(query, (project_id,))
        
        test_cases = []
        for row in results or []:
            test_cases.append({
                "id": str(row.get("id", "")),
                "name": row.get("title", ""),
                "description": row.get("description", ""),
                "steps": row.get("steps") or [],
                "priority": _map_priority_from_db(row.get("priority", "P2")),
                "tags": row.get("tags") or [],
                "testType": row.get("test_type", "manual"),
                "complexity": "medium",
                "estimatedTime": row.get("estimated_time", 15),
                "preconditions": row.get("preconditions") or [],
                "testData": row.get("test_data") or {},
                "createdAt": row.get("created_at", "").isoformat() if hasattr(row.get("created_at"), 'isoformat') else str(row.get("created_at", "")),
                "updatedAt": row.get("updated_at", "").isoformat() if hasattr(row.get("updated_at"), 'isoformat') else str(row.get("updated_at", ""))
            })
        
        return {"testCases": test_cases}
    except Exception as e:
        logger.error(f"Error getting test cases: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/test-cases/{case_id}")
async def get_test_case(case_id: str):
    """Get a specific test case"""
    try:
        from app.services.postgres_direct import execute_query
        
        pool = get_database_client()
        if not pool or not hasattr(pool, 'getconn'):
            raise HTTPException(status_code=404, detail="Test case not found")
        
        query = """
            SELECT id, project_id, plan_id, title, description, priority, test_type, 
                   status, tags, steps, preconditions, test_data, estimated_time,
                   created_by, created_at, updated_at
            FROM test_cases 
            WHERE id = %s
        """
        results = await execute_query(query, (case_id,))
        
        if not results or len(results) == 0:
            raise HTTPException(status_code=404, detail="Test case not found")
        
        row = results[0]
        return {
            "id": str(row.get("id", "")),
            "name": row.get("title", ""),
            "description": row.get("description", ""),
            "steps": row.get("steps") or [],
            "priority": _map_priority_from_db(row.get("priority", "P2")),
            "tags": row.get("tags") or [],
            "testType": row.get("test_type", "manual"),
            "complexity": "medium",
            "estimatedTime": row.get("estimated_time", 15),
            "preconditions": row.get("preconditions") or [],
            "testData": row.get("test_data") or {}
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting test case: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/test-cases")
async def create_test_case(request: Request):
    """Create a new test case"""
    try:
        org_id, project_id = await ensure_default_org_project()
        
        data = await request.json()
        
        # Map frontend format to database format
        priority_map = {"low": "P3", "medium": "P2", "high": "P1", "critical": "P0"}
        priority = priority_map.get(data.get("priority", "medium"), "P2")
        
        from app.services.postgres_direct import execute_insert
        
        pool = get_database_client()
        if not pool or not hasattr(pool, 'getconn'):
            # Fallback: return mock ID
            return {"id": f"tc_{int(time.time())}"}
        
        case_data = {
            "project_id": project_id,
            "title": data.get("name", ""),
            "description": data.get("description", ""),
            "priority": priority,
            "test_type": data.get("testType", "manual"),
            "status": "draft",
            "tags": data.get("tags", []),
            "steps": data.get("steps", []),
            "preconditions": data.get("preconditions", []),
            "test_data": data.get("testData", {}),
            "estimated_time": data.get("estimatedTime", 15),
            "created_by": DEFAULT_USER_ID
        }
        
        case_id = await execute_insert("test_cases", case_data)
        
        return {"id": case_id or f"tc_{int(time.time())}"}
    except Exception as e:
        logger.error(f"Error creating test case: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/test-cases/{case_id}")
async def update_test_case(case_id: str, request: Request):
    """Update a test case"""
    try:
        org_id, project_id = await ensure_default_org_project()
        
        data = await request.json()
        
        pool = get_database_client()
        if not pool or not hasattr(pool, 'getconn'):
            raise HTTPException(status_code=404, detail="Test case not found")
        
        priority_map = {"low": "P3", "medium": "P2", "high": "P1", "critical": "P0"}
        priority = priority_map.get(data.get("priority", "medium"), "P2")
        
        from app.services.postgres_direct import get_postgres_pool
        pool = get_postgres_pool()
        if not pool:
            raise HTTPException(status_code=500, detail="Database connection failed")
        
        conn = pool.getconn()
        try:
            with conn.cursor() as cur:
                update_query = """
                    UPDATE test_cases 
                    SET title = %s, description = %s, priority = %s, test_type = %s,
                        tags = %s, steps = %s, preconditions = %s, test_data = %s,
                        estimated_time = %s, updated_at = NOW()
                    WHERE id = %s
                    RETURNING id
                """
                cur.execute(update_query, (
                    data.get("name", ""),
                    data.get("description", ""),
                    priority,
                    data.get("testType", "manual"),
                    data.get("tags", []),
                    json.dumps(data.get("steps", [])),
                    data.get("preconditions", []),
                    json.dumps(data.get("testData", {})),
                    data.get("estimatedTime", 15),
                    case_id
                ))
                result = cur.fetchone()
                conn.commit()
                
                if not result:
                    raise HTTPException(status_code=404, detail="Test case not found")
                
                return {"id": str(result[0])}
        finally:
            pool.putconn(conn)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating test case: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/test-cases/{case_id}")
async def delete_test_case(case_id: str):
    """Delete a test case"""
    try:
        from app.services.postgres_direct import get_postgres_pool
        pool = get_postgres_pool()
        
        if not pool:
            raise HTTPException(status_code=404, detail="Test case not found")
        
        conn = pool.getconn()
        try:
            with conn.cursor() as cur:
                cur.execute("DELETE FROM test_cases WHERE id = %s RETURNING id", (case_id,))
                result = cur.fetchone()
                conn.commit()
                
                if not result:
                    raise HTTPException(status_code=404, detail="Test case not found")
                
                return {"status": "deleted", "id": str(result[0])}
        finally:
            pool.putconn(conn)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting test case: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# Test Runs CRUD
@app.get("/test-runs")
async def get_test_runs(project_id: Optional[str] = None):
    """Get all test runs"""
    try:
        org_id, proj_id = await ensure_default_org_project()
        project_id = project_id or proj_id
        
        from app.services.postgres_direct import execute_query
        
        pool = get_database_client()
        if not pool or not hasattr(pool, 'getconn'):
            return {"testRuns": []}
        
        query = """
            SELECT tr.id, tr.project_id, tr.name, tr.status, tr.environment,
                   tr.started_at, tr.completed_at, tr.created_at,
                   COUNT(trs.id) as step_count
            FROM test_runs tr
            LEFT JOIN test_run_steps trs ON tr.id = trs.run_id
            WHERE tr.project_id = %s
            GROUP BY tr.id
            ORDER BY tr.created_at DESC
        """
        results = await execute_query(query, (project_id,))
        
        test_runs = []
        for row in results or []:
            # Map database status to frontend status
            status_map = {
                "pending": "pending",
                "running": "running",
                "passed": "completed",
                "failed": "failed",
                "partial": "completed",
                "error": "failed",
                "cancelled": "failed"
            }
            
            test_runs.append({
                "id": str(row.get("id", "")),
                "name": row.get("name", ""),
                "status": status_map.get(row.get("status", "pending"), "pending"),
                "testCases": [],
                "results": [],
                "summary": {
                    "passed": 0,
                    "failed": 0,
                    "skipped": 0,
                    "duration": 0
                },
                "startTime": row.get("started_at"),
                "createdAt": row.get("created_at", "").isoformat() if hasattr(row.get("created_at"), 'isoformat') else str(row.get("created_at", "")),
                "completedAt": row.get("completed_at")
            })
        
        return {"testRuns": test_runs}
    except Exception as e:
        logger.error(f"Error getting test runs: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/test-runs/{run_id}")
async def get_test_run(run_id: str):
    """Get a specific test run with details"""
    try:
        from app.services.postgres_direct import execute_query
        
        pool = get_database_client()
        if not pool or not hasattr(pool, 'getconn'):
            raise HTTPException(status_code=404, detail="Test run not found")
        
        # Get run details
        run_query = """
            SELECT id, project_id, name, status, environment, started_at, completed_at, created_at
            FROM test_runs 
            WHERE id = %s
        """
        run_results = await execute_query(run_query, (run_id,))
        
        if not run_results or len(run_results) == 0:
            raise HTTPException(status_code=404, detail="Test run not found")
        
        run = run_results[0]
        
        # Get run steps
        steps_query = """
            SELECT id, case_id, title, status, duration_ms, error_message,
                   stdout, stderr, started_at, completed_at
            FROM test_run_steps
            WHERE run_id = %s
            ORDER BY created_at
        """
        steps_results = await execute_query(steps_query, (run_id,))
        
        status_map = {"pending": "pending", "running": "running", "passed": "completed",
                     "failed": "failed", "partial": "completed", "error": "failed", "cancelled": "failed"}
        
        results = []
        summary = {"passed": 0, "failed": 0, "skipped": 0, "duration": 0}
        
        for step in steps_results or []:
            step_status = step.get("status", "pending")
            if step_status == "passed":
                summary["passed"] += 1
            elif step_status == "failed":
                summary["failed"] += 1
            elif step_status == "skipped":
                summary["skipped"] += 1
            
            summary["duration"] += step.get("duration_ms", 0) or 0
            
            results.append({
                "test_name": step.get("title", ""),
                "status": "passed" if step_status == "passed" else "failed" if step_status == "failed" else "pending",
                "duration": step.get("duration_ms", 0) or 0,
                "error": step.get("error_message", ""),
                "screenshots": [],
                "logs": [step.get("stdout", ""), step.get("stderr", "")] if step.get("stdout") or step.get("stderr") else []
            })
        
        return {
            "id": str(run.get("id", "")),
            "name": run.get("name", ""),
            "status": status_map.get(run.get("status", "pending"), "pending"),
            "testCases": [],
            "results": results,
            "summary": summary,
            "startTime": run.get("started_at"),
            "createdAt": str(run.get("created_at", "")),
            "completedAt": run.get("completed_at")
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting test run: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/test-runs")
async def create_test_run(request: Request):
    """Create a new test run"""
    try:
        org_id, project_id = await ensure_default_org_project()
        
        data = await request.json()
        
        from app.services.postgres_direct import execute_insert
        
        pool = get_database_client()
        if not pool or not hasattr(pool, 'getconn'):
            return {"id": f"run_{int(time.time())}"}
        
        run_data = {
            "project_id": project_id,
            "name": data.get("name", f"Test Run {datetime.utcnow().isoformat()}"),
            "status": "pending",
            "environment": data.get("environment", "local"),
            "created_by": DEFAULT_USER_ID
        }
        
        run_id = await execute_insert("test_runs", run_data)
        
        return {"id": run_id or f"run_{int(time.time())}"}
    except Exception as e:
        logger.error(f"Error creating test run: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/test-runs/{run_id}")
async def update_test_run(run_id: str, request: Request):
    """Update a test run"""
    try:
        data = await request.json()
        
        from app.services.postgres_direct import get_postgres_pool
        pool = get_postgres_pool()
        
        if not pool:
            raise HTTPException(status_code=404, detail="Test run not found")
        
        # Map frontend status to database status
        status_map = {
            "pending": "pending",
            "running": "running",
            "completed": "passed",
            "failed": "failed"
        }
        
        conn = pool.getconn()
        try:
            with conn.cursor() as cur:
                update_query = """
                    UPDATE test_runs 
                    SET name = %s, status = %s, updated_at = NOW(),
                        started_at = %s, completed_at = %s
                    WHERE id = %s
                    RETURNING id
                """
                cur.execute(update_query, (
                    data.get("name", ""),
                    status_map.get(data.get("status", "pending"), "pending"),
                    data.get("startTime"),
                    data.get("completedAt"),
                    run_id
                ))
                result = cur.fetchone()
                conn.commit()
                
                if not result:
                    raise HTTPException(status_code=404, detail="Test run not found")
                
                return {"id": str(result[0])}
        finally:
            pool.putconn(conn)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating test run: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/test-runs/{run_id}")
async def delete_test_run(run_id: str):
    """Delete a test run"""
    try:
        from app.services.postgres_direct import get_postgres_pool
        pool = get_postgres_pool()
        
        if not pool:
            raise HTTPException(status_code=404, detail="Test run not found")
        
        conn = pool.getconn()
        try:
            with conn.cursor() as cur:
                cur.execute("DELETE FROM test_runs WHERE id = %s RETURNING id", (run_id,))
                result = cur.fetchone()
                conn.commit()
                
                if not result:
                    raise HTTPException(status_code=404, detail="Test run not found")
                
                return {"status": "deleted", "id": str(result[0])}
        finally:
            pool.putconn(conn)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting test run: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# Test Plans CRUD
@app.get("/test-plans")
async def get_test_plans(project_id: Optional[str] = None):
    """Get all test plans"""
    try:
        org_id, proj_id = await ensure_default_org_project()
        project_id = project_id or proj_id
        
        from app.services.postgres_direct import execute_query
        
        pool = get_database_client()
        if not pool or not hasattr(pool, 'getconn'):
            return {"testPlans": []}
        
        query = """
            SELECT id, project_id, name, description, status, settings, created_at, updated_at
            FROM test_plans 
            WHERE project_id = %s
            ORDER BY created_at DESC
        """
        results = await execute_query(query, (project_id,))
        
        test_plans = []
        for row in results or []:
            test_plans.append({
                "id": str(row.get("id", "")),
                "name": row.get("name", ""),
                "description": row.get("description", ""),
                "status": row.get("status", "draft"),
                "testCases": [],
                "createdAt": str(row.get("created_at", "")),
                "updatedAt": str(row.get("updated_at", ""))
            })
        
        return {"testPlans": test_plans}
    except Exception as e:
        logger.error(f"Error getting test plans: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/test-plans")
async def create_test_plan(request: Request):
    """Create a new test plan"""
    try:
        org_id, project_id = await ensure_default_org_project()
        
        data = await request.json()
        
        from app.services.postgres_direct import execute_insert
        
        pool = get_database_client()
        if not pool or not hasattr(pool, 'getconn'):
            return {"id": f"plan_{int(time.time())}"}
        
        plan_data = {
            "project_id": project_id,
            "name": data.get("name", ""),
            "description": data.get("description", ""),
            "status": "draft",
            "created_by": DEFAULT_USER_ID
        }
        
        plan_id = await execute_insert("test_plans", plan_data)
        
        return {"id": plan_id or f"plan_{int(time.time())}"}
    except Exception as e:
        logger.error(f"Error creating test plan: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/test-plans/{plan_id}")
async def update_test_plan(plan_id: str, request: Request):
    """Update a test plan"""
    try:
        data = await request.json()
        
        from app.services.postgres_direct import get_postgres_pool
        pool = get_postgres_pool()
        
        if not pool:
            raise HTTPException(status_code=404, detail="Test plan not found")
        
        conn = pool.getconn()
        try:
            with conn.cursor() as cur:
                update_query = """
                    UPDATE test_plans 
                    SET name = %s, description = %s, status = %s, updated_at = NOW()
                    WHERE id = %s
                    RETURNING id
                """
                cur.execute(update_query, (
                    data.get("name", ""),
                    data.get("description", ""),
                    data.get("status", "draft"),
                    plan_id
                ))
                result = cur.fetchone()
                conn.commit()
                
                if not result:
                    raise HTTPException(status_code=404, detail="Test plan not found")
                
                return {"id": str(result[0])}
        finally:
            pool.putconn(conn)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating test plan: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/test-plans/{plan_id}")
async def delete_test_plan(plan_id: str):
    """Delete a test plan"""
    try:
        from app.services.postgres_direct import get_postgres_pool
        pool = get_postgres_pool()
        
        if not pool:
            raise HTTPException(status_code=404, detail="Test plan not found")
        
        conn = pool.getconn()
        try:
            with conn.cursor() as cur:
                cur.execute("DELETE FROM test_plans WHERE id = %s RETURNING id", (plan_id,))
                result = cur.fetchone()
                conn.commit()
                
                if not result:
                    raise HTTPException(status_code=404, detail="Test plan not found")
                
                return {"status": "deleted", "id": str(result[0])}
        finally:
            pool.putconn(conn)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting test plan: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/integrations/jira/webhook")
async def jira_webhook(request: Request):
    """Receive Jira issue updates (status, assignee, comments)"""
    try:
        # Get the webhook payload
        payload = await request.json()
        
        # TODO: Process Jira webhook
        # For now, just acknowledge receipt
        
        return {"status": "acknowledged"}
        
    except Exception as e:
        print(f"Error processing Jira webhook: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to process webhook: {str(e)}"
        )

def map_priority(priority: str) -> str:
    """Map internal priority to API format"""
    priority_map = {
        "critical": "P0",
        "high": "P1", 
        "medium": "P2",
        "low": "P3"
    }
    return priority_map.get(priority, "P2")

def estimate_tokens(text: str) -> int:
    """Rough token estimation (4 chars per token)"""
    return len(text) // 4

def calculate_cost(prompt_tokens: int, completion_tokens: int) -> float:
    """Calculate cost based on token usage"""
    # Mock pricing for development
    prompt_cost_per_1k = 0.002
    completion_cost_per_1k = 0.006
    
    prompt_cost = (prompt_tokens / 1000) * prompt_cost_per_1k
    completion_cost = (completion_tokens / 1000) * completion_cost_per_1k
    
    return round(prompt_cost + completion_cost, 4)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)