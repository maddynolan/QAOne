from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uuid
import time
import json
from typing import List, Optional, Dict, Any
import os
import sys
from app.services.playwright_runner import PlaywrightRunner, TestCase, TestStep

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

@app.post("/ai/generate-tests")
async def generate_tests(request: Request, body: GenerateTestsRequest):
    """Generate structured test cases from requirements and context"""
    try:
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
        
        # Call the AI service
        ai_request = {
            "feature": body.context.get("product_area", "Test Feature") if body.context else "Test Feature",
            "description": body.requirements,
            "requirements": body.requirements,
            "testType": "manual",
            "complexity": "medium",
            "context": ", ".join(body.context.get("acceptance_criteria", [])) if body.context else ""
        }
        
        ai_response = await mock_ai_service.generate_test_case(ai_request)

        # Calculate timing and costs
        end_time = time.time()
        latency_ms = int((end_time - start_time) * 1000)
        
        # Convert AI response to API format
        test_case = ai_response["testCase"]
        test_steps = [
            TestStep(
                action=step["action"],
                data={},
                expected=step["expectedResult"],
                locator_hints=[]
            )
            for step in test_case["steps"]
        ]
        
        test_cases = [TestCase(
            case_id=str(uuid.uuid4()),
            title=test_case["name"],
            description=test_case["description"],
            priority=map_priority(test_case["priority"]),
            tags=test_case["tags"],
            steps=test_steps
        )]

        # Calculate audit info
        prompt_tokens = estimate_tokens(body.requirements)
        completion_tokens = estimate_tokens(json.dumps(test_case))
        
        audit_info = AuditInfo(
            model="mock-ai-service",
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            cost_usd=calculate_cost(prompt_tokens, completion_tokens),
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

        # Generate run ID
        run_id = str(uuid.uuid4())
        
        # Initialize Playwright runner
        runner = PlaywrightRunner()
        await runner.initialize()
        
        results = []
        total_tests = len(body.test_cases)
        passed_tests = 0
        failed_tests = 0
        
        try:
            for test_case_data in body.test_cases:
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
                    case_id=test_case_data.get('id', str(uuid.uuid4())),
                    title=test_case_data.get('title', 'Untitled Test'),
                    description=test_case_data.get('description', ''),
                    priority=test_case_data.get('priority', 'P2'),
                    tags=test_case_data.get('tags', []),
                    steps=steps
                )
                
                # Execute the test case
                result = await runner.run_test_case(test_case)
                
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