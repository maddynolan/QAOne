# Flowstral Backend v3.3.0
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from contextlib import asynccontextmanager
import uuid
import time
import json
import asyncio
from typing import List, Optional, Dict, Any, Union
from datetime import datetime
import os
import sys
import uvicorn
import logging

# Fix Windows asyncio event loop policy for Playwright subprocess support
# Must be done before any event loop is created
if sys.platform == 'win32':
    asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())
from logging.handlers import RotatingFileHandler
from pathlib import Path

# Setup file logging BEFORE loading anything else
log_dir = Path(__file__).parent.parent / "logs"
log_dir.mkdir(exist_ok=True)
log_file = log_dir / "app.log"

# Configure root logger with file handler and trace_id for issue tracking
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s trace_id=%(trace_id)s %(name)s %(levelname)s %(message)s',
    handlers=[
        RotatingFileHandler(log_file, maxBytes=10*1024*1024, backupCount=5),  # 10MB per file, keep 5 backups
        logging.StreamHandler()  # Also log to console
    ]
)
# Add trace_id to all log records (set by TraceLoggingMiddleware per request)
from app.middleware.trace_logging_middleware import TraceIdFilter
_root_logger = logging.getLogger()
for h in _root_logger.handlers:
    h.addFilter(TraceIdFilter())

# Load environment variables from .env file FIRST, before importing services
try:
    from dotenv import load_dotenv
    # Load .env from backend directory
    env_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), '.env')
    if os.path.exists(env_path):
        load_dotenv(env_path)
        logger = logging.getLogger(__name__)
    else:
        # Try loading from current directory
        load_dotenv()
        logger = logging.getLogger(__name__)
except ImportError:
    logger = logging.getLogger(__name__)
    logger.warning("python-dotenv not installed. Install with: pip install python-dotenv")

logger = logging.getLogger(__name__)

# NOW import services AFTER .env is loaded
from app.services.executors.playwright_runner import PlaywrightRunner, TestCase as PlaywrightTestCase, TestStep
from app.services.llm.ollama_service import OllamaService, ModelMode
from app.services.storage.ai_storage import store_ai_generation
from app.services.storage.database import create_requirement, get_database_client
from app.services.llm.enhanced_generation_service import enhanced_generation_service

# Phase 1.2: Initialize agent registry and orchestrator integration
from app.services.core.agent_registry import agent_registry
from app.services.core.orchestrator import orchestrator
orchestrator.set_agent_registry(agent_registry)

# Phase 2-4: Register all agents
from app.services.core.agent_registration import register_all_agents
register_all_agents()
from app.schemas import (
    ReqToTestPlanRequest, ReqToTestPlanResponse,
    ReqToTestsRequest, ReqToTestsResponse
)
from app.services.llm.prompt.prompt_builders import build_req_to_testplan_prompt, build_req_to_tests_prompt

# Recreate ollama_service after .env is loaded to pick up OLLAMA_URL
from app.services.llm.ollama_service import get_ollama_service
ollama_service = get_ollama_service()  # Get service instance with environment loaded

# Add the parent directory to the path to import our services
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Handle application startup and shutdown gracefully"""
    # Startup
    try:
        # Initialize SQLite database (local fallback)
        from app.services.storage.database_service import init_database
        await init_database()
        logger.info("QA AI Backend started (SQLite ready)")
        
        # Auto-run PostgreSQL migrations if DATABASE_URL is set (Railway/production)
        try:
            import os as _os
            _db_url = _os.getenv("DATABASE_URL")
            if _db_url:
                from app.services.storage.auto_migrate import run_auto_migrations
                run_auto_migrations(_db_url)
        except Exception as e:
            logger.warning(f"Auto-migration skipped (non-critical): {e}")
        
        # Auto-connect to Salesforce if credentials are saved
        try:
            from app.routers.salesforce_api import auto_connect_salesforce
            sf_result = await auto_connect_salesforce()
            if sf_result.get("connected"):
                logger.info(f"[OK] Salesforce auto-connected: {sf_result.get('instance_url')} ({sf_result.get('username', 'unknown')})")
            else:
                reason = sf_result.get("reason", "unknown")
                if reason == "no_credentials":
                    logger.info("Salesforce: No saved credentials - connect via OAuth when needed")
                elif reason == "refresh_token_expired":
                    logger.warning("[WARN] Salesforce refresh token expired - please re-authenticate via OAuth")
                else:
                    logger.warning(f"Salesforce auto-connect skipped: {reason}")
        except Exception as e:
            logger.warning(f"Salesforce auto-connect failed: {e}")
        
        yield
    except asyncio.CancelledError:
        # Gracefully handle cancellation during shutdown
        raise
    finally:
        # Shutdown - cleanup resources
        try:
            # Cleanup WebSocket connections
            try:
                from app.services.flowstral.flowstral_websocket_manager import flowstral_ws_manager
                await flowstral_ws_manager.cleanup()
            except Exception:
                pass
            
            # Cleanup HTTP sessions (vLLM, etc.)
            try:
                from app.services.llm.vllm_service import vllm_service
                await vllm_service.cleanup()
            except Exception:
                pass
            
            logger.info("Backend stopped")
        except asyncio.CancelledError:
            # Ignore cancellation errors during cleanup
            logger.debug("Cleanup cancelled (normal during shutdown)")
        except Exception as e:
            logger.warning(f"Error during cleanup: {e}")


app = FastAPI(
    title="QAOne AI & Runs API",
    version="0.1.8",
    description="Service providing AI test generation, failure triage, and test run ingestion",
    lifespan=lifespan
)

# Middleware ordering: last added = outermost = processes request first.
# CORS must be outermost so headers are added to ALL responses (including errors).

# Trace logging (innermost — runs closest to the app)
from app.middleware.trace_logging_middleware import TraceLoggingMiddleware
app.add_middleware(TraceLoggingMiddleware)

# Tenant Context Middleware (for RLS enforcement)
from app.middleware.tenant_middleware import TenantContextMiddleware
app.add_middleware(TenantContextMiddleware)

# RBAC Middleware (for permission checking)
from app.middleware.rbac_middleware import RBACMiddleware
app.add_middleware(RBACMiddleware)

# CORS middleware — MUST be added LAST so it's the outermost middleware.
# This ensures CORS headers are present on ALL responses, including error responses
# from inner middleware/routes. Without this, BaseHTTPMiddleware exceptions can
# bypass CORS header injection, causing browser CORS blocks on legitimate origins.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:8080",  # Frontend
        "http://localhost:3000",  # Alternative frontend
        "http://localhost:8081",  # Tools server (Flowstral recorder)
        "http://127.0.0.1:8081",  # Tools server (alternative)
        "http://127.0.0.1:8080",  # Frontend (alternative)
        "https://flowstral.com",   # Production site
        "https://www.flowstral.com",
    ],
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

# Health endpoints moved to routers/health_api.py

# Health endpoints moved to routers/health_api.py

# Legacy health/database endpoint (kept for backward compatibility, redirects to health router)
@app.get("/health/database")
async def health_check_database():
    """Check database connection and schema - DEPRECATED: Use /health/database from health router"""
    try:
        import os
        postgres_enabled = os.getenv("ENABLE_POSTGRES", "false").lower() == "true"
        
        if not postgres_enabled:
            return {
                "status": "ok",
                "connection_type": "sqlite_memory",
                "message": "Using SQLite/in-memory storage (PostgreSQL disabled)",
                "tables_available": ["test_cases", "recordings", "defects", "requirements"],
                "note": "Set ENABLE_POSTGRES=true to use PostgreSQL"
            }
        
        from app.services.storage.postgres_direct import test_connection as test_postgres_connection, get_postgres_pool
        
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
                from app.services.storage.postgres_direct import execute_query
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

# ============================================================================
# OLD AI GENERATION ENDPOINTS - COMMENTED OUT (MOVED TO routers/ai_generation_api.py)
# ============================================================================
"""
# @app.post("/ai/generate-tests")
# async def generate_tests(request: Request, body: Optional[GenerateTestsRequest] = None):
#     """
#     Generate structured test cases from requirements and context
#     Also supports planId query param for expanding test plans
#     """
#     try:
        # Get planId from query params if provided (for "Expand plan with AI")
#         plan_id = request.query_params.get("planId")
        
        # If planId provided, generate additional scenarios for the plan
#         if plan_id:
            # Use quick mode to leverage trained model (qa-expert:7b)
#             mode = request.query_params.get("mode", "quick")
            # For plan expansion, we'll generate additional test scenarios
            # TODO: Fetch existing test cases from plan and use them as context
#             prompt = f"""You are an expert QA engineer. Generate additional test scenarios to expand an existing test plan.

# Plan ID: {plan_id}

# Generate 3-5 additional test cases that:
# - Complement existing tests in the plan
# - Cover edge cases and negative scenarios
# - Fill gaps in test coverage
# - Follow the same testing style as the plan

# Respond ONLY with valid JSON array of test cases:
# [
#   {{
#     "name": "string",
#     "description": "string",
#     "steps": [{{"action": "string", "expectedResult": "string"}}],
#     "priority": "low|medium|high|critical",
#     "tags": ["string"]
#   }}
# ]"""
            
#             start_time = time.time()
#             selected_model = ollama_service._select_model(mode)
#             print(f"[INFO] PLAN EXPANSION - Mode: {mode}, Selected model: {selected_model}")
#             logger.info(f"[INFO] PLAN EXPANSION - Mode: {mode}, Selected model: {selected_model}")
            
#             raw_result = await ollama_service.generate_json(prompt, mode=mode)
#             latency_ms = int((time.time() - start_time) * 1000)
            
            # Extract model from result
#             model_used = selected_model
#             if isinstance(raw_result, list) and len(raw_result) > 0 and isinstance(raw_result[0], dict):
#                 model_used = raw_result[0].get("_model_used", selected_model)
#                 if "_model_used" in raw_result[0]:
#                     del raw_result[0]["_model_used"]
#             elif isinstance(raw_result, dict):
#                 model_used = raw_result.get("_model_used", selected_model)
#                 if "_model_used" in raw_result:
#                     del raw_result["_model_used"]
            
#             print(f"[INFO] PLAN EXPANSION - Model used: {model_used}")
#             logger.info(f"[INFO] PLAN EXPANSION - Model used: {model_used}")
#             if "qa-expert" in model_used.lower():
#                 print(f"[OK] Using trained model: {model_used}")
#                 logger.info(f"✅ Using trained model: {model_used}")
#             test_cases_data = raw_result if isinstance(raw_result, list) else [raw_result]
            
            # Convert to TestCase format
#             test_cases = []
#             for tc_data in test_cases_data:
#                 steps = [
#                     TestStep(
#                         action=step.get("action", ""),
#                         data={},
#                         expected=step.get("expectedResult", ""),
#                         locator_hints=[]
#                     )
#                     for step in tc_data.get("steps", [])
#                 ]
#                 test_cases.append(TestCase(
#                     case_id=str(uuid.uuid4()),
#                     title=tc_data.get("name", "Generated Test"),
#                     description=tc_data.get("description", ""),
#                     priority=map_priority(tc_data.get("priority", "medium")),
#                     tags=tc_data.get("tags", []),
#                     steps=steps
#                 ))
            
#             audit_info = AuditInfo(
#                 model=model_used,
#                 prompt_tokens=estimate_tokens(prompt),
#                 completion_tokens=estimate_tokens(json.dumps(test_cases_data)),
#                 cost_usd=0.0,  # Self-hosted, no cost
#                 latency_ms=latency_ms
#             )
            
#             return GenerateTestsResponse(cases=test_cases, audit=audit_info)
        
        # Original flow: require body with requirements
#         if not body:
#             raise HTTPException(
#                 status_code=400,
#                 detail="Request body required when planId is not provided"
#             )
        
        # Validate required fields
#         if not body.org_id or not body.project_id or not body.requirements:
#             raise HTTPException(
#                 status_code=400,
#                 detail="Missing required fields: org_id, project_id, requirements"
#             )

        # Generate idempotency key if not provided
#         idempotency_key = request.headers.get("idempotency-key") or str(uuid.uuid4())
        
        # Start timing for audit
#         start_time = time.time()
        # Default to "quick" mode to use trained model (qa-expert:7b)
#         mode = body.context.get("mode", "quick") if body.context else "quick"
        
        # Use Ollama to generate test cases
#         prompt = f"""You are an expert QA engineer. Generate comprehensive test cases from the following requirements.

# Requirements:
# {body.requirements}

# Context:
# {json.dumps(body.context, indent=2) if body.context else "None"}

# Generate test cases in JSON format. Each test case should have:
# - name: Clear test case name
# - description: Detailed description
# - steps: Array of {{"action": "...", "expectedResult": "..."}}
# - priority: "low", "medium", "high", or "critical"
# - tags: Array of relevant tags

# Respond ONLY with valid JSON array:
# [
#   {{
#     "name": "string",
#     "description": "string",
#     "steps": [{{"action": "string", "expectedResult": "string"}}],
#     "priority": "string",
#     "tags": ["string"]
#   }}
# ]"""
        
        # Log before generation
#         selected_model = ollama_service._select_model(mode)
#         print(f"[INFO] GENERATE_TESTS - Mode: {mode}, Selected model: {selected_model}")
#         logger.info(f"[INFO] GENERATE_TESTS - Mode: {mode}, Selected model: {selected_model}")
        
#         raw_result = await ollama_service.generate_json(prompt, mode=mode)
#         latency_ms = int((time.time() - start_time) * 1000)
        
        # Extract model from result (if attached by generate_json)
#         actual_model = None
#         if isinstance(raw_result, dict):
#             actual_model = raw_result.get("_model_used") or raw_result.get("model")
#         elif isinstance(raw_result, list) and len(raw_result) > 0 and isinstance(raw_result[0], dict):
#             actual_model = raw_result[0].get("_model_used")
        
#         model_used = actual_model or selected_model
        
        # Log which model was actually used (for verification)
#         print(f"[INFO] MODEL USAGE - Mode: {mode}, Selected: {selected_model}, Actual: {model_used}")
#         logger.info(f"[INFO] MODEL USAGE - Mode: {mode}, Selected: {selected_model}, Actual: {model_used}")
#         if "qa-expert" in str(model_used).lower():
#             print(f"[OK] Using trained model: {model_used}")
#             logger.info(f"[OK] Using trained model: {model_used}")
#         else:
#             print(f"[WARN] Using base model: {model_used}")
#             logger.info(f"⚠️  Using base model: {model_used}")
        
        # Remove _model_used from result if present (clean up)
#         if isinstance(raw_result, dict) and "_model_used" in raw_result:
#             del raw_result["_model_used"]
#         elif isinstance(raw_result, list) and len(raw_result) > 0 and isinstance(raw_result[0], dict):
#             if "_model_used" in raw_result[0]:
#                 del raw_result[0]["_model_used"]
        
#         test_cases_data = raw_result if isinstance(raw_result, list) else [raw_result]
        
        # Convert to TestCase format
#         test_cases = []
#         for tc_data in test_cases_data:
#             steps = [
#                 TestStep(
#                     action=step.get("action", ""),
#                     data={},
#                     expected=step.get("expectedResult", ""),
#                     locator_hints=[]
#                 )
#                 for step in tc_data.get("steps", [])
#             ]
#             test_cases.append(TestCase(
#                 case_id=str(uuid.uuid4()),
#                 title=tc_data.get("name", "Generated Test"),
#                 description=tc_data.get("description", ""),
#                 priority=map_priority(tc_data.get("priority", "medium")),
#                 tags=tc_data.get("tags", []),
#                 steps=steps
#             ))

        # Store generation for fine-tuning
#         await store_ai_generation(
#             project_id=body.project_id,
#             prompt=prompt,
#             model=model_used,
#             output=json.dumps(test_cases_data),
#             mode=mode,
#             endpoint="/ai/generate-tests",
#             latency_ms=latency_ms,
#             org_id=body.org_id
#         )
        
#         audit_info = AuditInfo(
#             model=model_used,
#             prompt_tokens=estimate_tokens(body.requirements),
#             completion_tokens=estimate_tokens(json.dumps(test_cases_data)),
#             cost_usd=0.0,  # Self-hosted, no cost
#             latency_ms=latency_ms
#         )

#         response = GenerateTestsResponse(
#             cases=test_cases,
#             audit=audit_info
#         )

#         return response

#     except Exception as e:
#         print(f"Error generating tests: {str(e)}")
#         raise HTTPException(
#             status_code=500,
#             detail=f"Failed to generate test cases: {str(e)}"
#         )

# @app.post("/ai/triage")
# async def triage_failure(request: Request, body: TriageRequest):
#     """Analyze failing test logs and artifacts for root cause and fixes"""
#     try:
        # Validate required fields
#         if not body.org_id or not body.project_id or not body.run_id or not body.logs:
#             raise HTTPException(
#                 status_code=400,
#                 detail="Missing required fields: org_id, project_id, run_id, logs"
#             )

        # Start timing
#         start_time = time.time()
        
        # Call the AI service
#         ai_request = {
#             "logs": body.logs,
#             "artifacts": body.artifacts or []
#         }
        
#         ai_response = await mock_ai_service.analyze_defect(ai_request)

        # Calculate timing
#         end_time = time.time()
#         latency_ms = int((end_time - start_time) * 1000)

#         response = TriageResponse(
#             summary=ai_response["summary"],
#             root_cause=ai_response["root_cause"],
#             category=ai_response["category"],
#             suggested_fixes=ai_response["suggested_fixes"],
#             selector_suggestions=ai_response["selector_suggestions"],
#             likelihood_flaky=ai_response["likelihood_flaky"],
#             related_cases=ai_response["related_cases"]
#         )

#         return response

#     except Exception as e:
#         print(f"Error analyzing defect: {str(e)}")
#         raise HTTPException(
#             status_code=500,
#             detail=f"Failed to analyze defect: {str(e)}"
#         )

# @app.post("/runs/ingest")
# async def ingest_run(request: Request, body: RunIngestRequest):
#     """Ingest a completed test run with steps and artifacts"""
#     try:
        # Validate required fields
#         if not body.org_id or not body.project_id or not body.runner_version:
#             raise HTTPException(
#                 status_code=400,
#                 detail="Missing required fields: org_id, project_id, runner_version"
#             )

        # Generate run ID
#         run_id = str(uuid.uuid4())
        
        # TODO: Store run data in database
        # For now, just return the run ID
        
#         response = RunIngestResponse(run_id=run_id)
        
#         return response

#     except Exception as e:
#         print(f"Error ingesting run: {str(e)}")
#         raise HTTPException(
#             status_code=500,
#             detail=f"Failed to ingest run: {str(e)}"
#         )

# @app.post("/runners/execute")
# async def execute_test_with_runner(request: Request, body: dict):
#     """
#     Unified test execution endpoint
#     Supports all test types: ui, api, performance, accessibility, security
    
#     Body:
#     {
#         "test_type": "ui|api|performance|accessibility|security",
#         "test_code": "generated code",
#         "test_name": "Test Name",
#         "framework": "playwright|pytest|k6|axe|zap",
#         "options": {
#             "target_url": "...",
#             "k6_options": {...},
#             "zap_options": {...}
#         }
#     }
#     """
#     try:
#         from app.services.executors.unified_runner_service import unified_runner_service
        
#         test_type = body.get("test_type", "ui")
#         test_code = body.get("test_code", "")
#         test_name = body.get("test_name", "Generated Test")
#         framework = body.get("framework")
#         options = body.get("options", {})
        
#         if not test_code:
#             raise HTTPException(status_code=400, detail="test_code is required")
        
#         result = await unified_runner_service.execute_test(
#             test_type=test_type,
#             test_code=test_code,
#             test_name=test_name,
#             framework=framework,
#             options=options
#         )
        
#         return {
#             "status": "success",
#             "result": result
#         }
#     except Exception as e:
#         logger.error(f"Error executing test: {e}")
#         raise HTTPException(status_code=500, detail=str(e))


# @app.post("/runners/execute-batch")
# async def execute_tests_batch(request: Request, body: dict):
#     """
#     Execute multiple tests in batch
#     """
#     try:
#         from app.services.executors.unified_runner_service import unified_runner_service
        
#         tests = body.get("tests", [])
#         if not tests:
#             raise HTTPException(status_code=400, detail="tests array is required")
        
#         results = await unified_runner_service.execute_multiple_tests(tests)
        
#         return {
#             "status": "success",
#             "results": results,
#             "total": len(results),
#             "passed": len([r for r in results if r.get("status") == "passed"]),
#             "failed": len([r for r in results if r.get("status") == "failed"]),
#             "errors": len([r for r in results if r.get("status") == "error"])
#         }
#     except Exception as e:
#         logger.error(f"Error executing batch tests: {e}")
#         raise HTTPException(status_code=500, detail=str(e))


# @app.post("/tests/execute")
# async def execute_tests(request: Request, body: TestExecutionRequest):
#     """
#     Execute test cases using Playwright
    
#     Enhanced Features:
#     - Optional code validation before execution
#     - Queue-based execution (optional)
#     - Artifact streaming
#     """
#     try:
        # Validate required fields
#         if not body.org_id or not body.project_id or not body.test_cases:
#             raise HTTPException(
#                 status_code=400,
#                 detail="Missing required fields: org_id, project_id, test_cases"
#             )

        # NEW: Optional code validation
#         validate_code_before_run = body.dict().get("validateCode", False)
#         if validate_code_before_run:
#             from app.services.utils.code_validator import get_code_validator
#             validator = get_code_validator()
            # TODO: Extract code from test cases and validate
            # For now, skip validation if not provided

        # NEW: Optional queue-based execution
#         use_queue = body.dict().get("useQueue", False)
#         if use_queue:
#             from app.services.executors.test_executor_queue import get_executor_queue
#             queue = get_executor_queue()
#             job_id = await queue.push_job(
#                 test_cases=body.test_cases,
#                 test_type=body.dict().get("test_type", "ui"),
#                 project_id=body.project_id,
#                 org_id=body.org_id,
#                 executor_type="ui-runner"
#             )
#             return {
#                 "status": "queued",
#                 "job_id": job_id,
#                 "message": "Test execution queued. Poll /tests/job/{job_id}/status for updates."
#             }

#         from app.services.storage.test_results_storage import store_test_run, store_test_run_step, store_artifact
        
        # Create test run record
#         run_name = f"Test Run {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')}"
#         started_at = datetime.utcnow().isoformat()
        
#         db_run_id = await store_test_run(
#             project_id=body.project_id,
#             name=run_name,
#             status="running",
#             environment="local",
#             started_at=started_at,
#             created_by="22222222-2222-2222-2222-222222222222"  # DEFAULT_USER_ID
#         )
        
        # Generate run ID (use DB ID if available)
#         run_id = db_run_id or str(uuid.uuid4())
        
        # Initialize Playwright runner
#         runner = PlaywrightRunner()
#         await runner.initialize()
        
#         results = []
#         total_tests = len(body.test_cases)
#         passed_tests = 0
#         failed_tests = 0
        
#         try:
#             for test_case_data in body.test_cases:
#                 case_id = test_case_data.get('id', str(uuid.uuid4()))
#                 step_started = datetime.utcnow().isoformat()
                
                # Convert frontend test case to backend TestCase
#                 steps = [
#                     TestStep(
#                         action=step.get('action', ''),
#                         data=step.get('data', {}),
#                         expected=step.get('expected', ''),
#                         locator_hints=step.get('locator_hints', [])
#                     )
#                     for step in test_case_data.get('steps', [])
#                 ]
                
#                 test_case = TestCase(
#                     case_id=case_id,
#                     title=test_case_data.get('title', 'Untitled Test'),
#                     description=test_case_data.get('description', ''),
#                     priority=test_case_data.get('priority', 'P2'),
#                     tags=test_case_data.get('tags', []),
#                     steps=steps
#                 )
                
                # Execute the test case
#                 result = await runner.run_test_case(test_case)
#                 step_completed = datetime.utcnow().isoformat()
                
                # Store test run step in database
#                 step_status = "passed" if result.status == "passed" else "failed"
#                 await store_test_run_step(
#                     run_id=run_id,
#                     case_id=case_id,
#                     title=test_case.title,
#                     status=step_status,
#                     duration_ms=result.duration,
#                     error_message=result.error,
#                     stdout="\n".join(result.logs) if result.logs else None,
#                     started_at=step_started,
#                     completed_at=step_completed
#                 )
                
                # Store artifacts (screenshots)
#                 if result.screenshots:
#                     for screenshot in result.screenshots:
#                         await store_artifact(
#                             run_id=run_id,
#                             step_id=None,  # Could link to step_id if we return it
#                             artifact_type="screenshot",
#                             url=screenshot.get("url", ""),
#                             metadata={"path": screenshot.get("path", "")}
#                         )
                
                # Convert result to dict
#                 result_dict = {
#                     'case_id': result.case_id,
#                     'status': result.status,
#                     'duration': result.duration,
#                     'error': result.error,
#                     'logs': result.logs,
#                     'screenshots': result.screenshots
#                 }
                
#                 results.append(result_dict)
                
#                 if result.status == 'passed':
#                     passed_tests += 1
#                 else:
#                     failed_tests += 1
                    
#         finally:
            # Always cleanup
#             await runner.cleanup()
            
            # Update test run status
#             completed_at = datetime.utcnow().isoformat()
#             final_status = "passed" if failed_tests == 0 else "failed"
#             if db_run_id:
#                 try:
#                     client = get_database_client()
#                     if client:
#                         client.table("test_runs").update({
#                             "status": final_status,
#                             "completed_at": completed_at
#                         }).eq("id", db_run_id).execute()
#                 except Exception as e:
#                     print(f"Warning: Could not update test run status: {str(e)}")
        
        # Create summary
#         summary = {
#             'total_tests': total_tests,
#             'passed': passed_tests,
#             'failed': failed_tests,
#             'success_rate': (passed_tests / total_tests * 100) if total_tests > 0 else 0,
#             'run_id': run_id
#         }
        
#         response = TestExecutionResponse(
#             run_id=run_id,
#             results=results,
#             summary=summary
#         )
        
#         return response
        
#     except Exception as e:
#         print(f"Error executing tests: {str(e)}")
#         raise HTTPException(
#             status_code=500,
#             detail=f"Failed to execute tests: {str(e)}"
#         )

# ============================================================================
# NEW AI ENDPOINTS - Ollama Integration
# ============================================================================

# @app.post("/ai/jira-to-testcases")
# async def jira_to_testcases(request: Request, body: dict):
#     """
#     Convert Jira story/JSON to manual test cases
#     Input: Jira JSON or plain text
#     Output: Array of manual test cases
    
#     Now uses enhanced generation with RAG + caching!
#     """
#     try:
#         jira_content = body.get("jira", "") or body.get("story", "") or json.dumps(body)
        # Default to "quick" mode to use trained model (qa-expert:7b)
#         mode = body.get("mode", "quick")  # 'quick' (trained model), 'ui' (14B), or 'heavy' (32B)
#         project_id = body.get("project_id", "default")
#         org_id = body.get("org_id", "default")
        
        # Log mode selection
#         print(f"[INFO] JIRA-TO-TESTCASES - Mode: {mode}")
#         logger.info(f"[INFO] JIRA-TO-TESTCASES - Mode: {mode}")
        
        # Try enhanced generation first (if enabled and DATABASE_URL is set)
        # Disable enhanced generation if DATABASE_URL is not set to avoid fallback delays
#         database_url = os.getenv("DATABASE_URL")
#         use_enhanced = os.getenv("USE_ENHANCED_GENERATION", "true").lower() == "true" and database_url is not None
#         if not database_url:
#             logger.info("DATABASE_URL not set, skipping enhanced generation to avoid fallback delay")
        
#         if use_enhanced:
#             try:
#                 await enhanced_generation_service.initialize()
                
                # Ensure "quick" mode is passed correctly to use trained model
#                 user_mode_for_enhanced = mode if mode in ["quick", "deep", "ui", "heavy"] else "quick"
#                 print(f"[INFO] JIRA-TO-TESTCASES - Passing mode to enhanced service: {user_mode_for_enhanced} (original: {mode})")
#                 logger.info(f"Passing mode to enhanced service: {user_mode_for_enhanced} (original: {mode})")
                
#                 result = await enhanced_generation_service.generate_test_cases(
#                     requirement=jira_content,
#                     organization_id=org_id,
#                     project_id=project_id if project_id != "default" else None,
#                     test_type="manual",
#                     user_mode=user_mode_for_enhanced
#                 )
                
                # Store requirement (async, don't block)
#                 try:
#                     jira_key = None
#                     jira_title = None
#                     jira_payload = None
                    
#                     if isinstance(body.get("jira"), dict):
#                         jira_payload = body.get("jira")
#                         jira_key = jira_payload.get("key") or jira_payload.get("id")
#                         jira_title = jira_payload.get("summary") or jira_payload.get("title")
                    
#                     if jira_title or jira_content:
#                         await create_requirement(
#                             project_id=project_id,
#                             source="jira",
#                             title=jira_title or "Jira Story",
#                             description=jira_content[:1000] if len(jira_content) > 1000 else jira_content,
#                             source_ref=jira_key,
#                             raw_payload=jira_payload
#                         )
#                 except Exception as e:
#                     logger.warning(f"Could not store requirement: {str(e)}")
                
#                 return {
#                     "status": "success",
#                     "test_cases": result.get("test_cases", []),
#                     "model": result.get("model"),
#                     "latency_ms": result.get("latency_ms"),
#                     "cache_hit": result.get("cache_hit", False),
#                     "cache_level": result.get("cache_level"),
#                     "rag_context_used": result.get("rag_context_used", False),
#                     "source": result.get("source", "generation")
#                 }
                
#             except Exception as e:
#                 logger.warning(f"Enhanced generation failed, falling back to basic: {e}")
                # Fall through to original implementation
        
        # Extract Jira info if it's structured
#         jira_key = None
#         jira_title = None
#         jira_payload = None
        
#         if isinstance(body.get("jira"), dict):
#             jira_payload = body.get("jira")
#             jira_key = jira_payload.get("key") or jira_payload.get("id")
#             jira_title = jira_payload.get("summary") or jira_payload.get("title")
#         elif isinstance(body, dict) and "key" in body:
#             jira_key = body.get("key")
#             jira_title = body.get("summary") or body.get("title")
#             jira_payload = body
        
        # Store requirement in database (async, don't block)
#         requirement_id = None
#         try:
#             requirement_id = await create_requirement(
#                 project_id=project_id,
#                 source="jira",
#                 title=jira_title or "Jira Story",
#                 description=jira_content[:1000] if len(jira_content) > 1000 else jira_content,
#                 source_ref=jira_key,
#                 raw_payload=jira_payload
#             )
#         except Exception as e:
#             logger.warning(f"Could not store requirement: {str(e)}")
        
#         if not jira_content or len(jira_content.strip()) < 10:
#             raise HTTPException(
#                 status_code=400, 
#                 detail="Requirement text is too short. Please provide a detailed Jira story or requirement (at least 10 characters)."
#             )
        
#         prompt = f"""You are an expert QA engineer. Convert the following Jira story into comprehensive manual test cases.

# Jira Story/Requirements:
# {jira_content}

# Generate 4-6 comprehensive manual test cases in JSON format. Each test case must have:
# - name: Clear test case name
# - description: Detailed description
# - steps: Array of {{"action": "...", "expectedResult": "..."}}
# - priority: "low", "medium", "high", or "critical"
# - tags: Array of relevant tags

# CRITICAL: Respond with ONLY valid JSON array. No explanations, no markdown, no code blocks, no text before or after. Start with [ and end with ].

# Example format:
# [{{"name":"Test Case 1","description":"Description","steps":[{{"action":"Step 1","expectedResult":"Result 1"}}],"priority":"high","tags":["tag1"]}}]"""

#         start_time = time.time()
#         try:
            # Log model selection before generation
#             selected_model = ollama_service._select_model(mode)
#             print(f"[INFO] JIRA-TO-TESTCASES - Selected model: {selected_model}")
#             logger.info(f"[INFO] JIRA-TO-TESTCASES - Selected model: {selected_model}")
            
            # Use generate method with validate_json=False, then extract JSON manually
            # This gives us more control over JSON extraction
#             result = await ollama_service.generate(prompt, mode=mode, max_retries=2, validate_json=False)
#             raw_response = result.get("response", "")
#             model_used = result.get("model", selected_model)
#             latency_ms = int((time.time() - start_time) * 1000)
            
            # Log which model was actually used
#             print(f"[INFO] JIRA-TO-TESTCASES - Model used: {model_used}")
#             logger.info(f"[INFO] JIRA-TO-TESTCASES - Model used: {model_used}")
#             if "qa-expert" in model_used.lower():
#                 print(f"[OK] Using trained model: {model_used}")
#                 logger.info(f"✅ Using trained model: {model_used}")
#             else:
#                 print(f"[WARN] Using base model: {model_used}")
#                 logger.warning(f"⚠️  Using base model: {model_used}")
            
            # Extract JSON from response (might have markdown or text)
#             from app.services.utils.test_generation_optimizer import extract_json_from_response, is_valid_test_case_json
            
#             test_cases = extract_json_from_response(raw_response)
            
#             if not test_cases:
                # Try one more time with a fixup prompt
#                 logger.warning("No JSON extracted, trying with fixup prompt...")
#                 fixup_prompt = f"""{prompt}

# IMPORTANT: Your response must be ONLY a valid JSON array. No markdown, no explanations, no text. Just the JSON array."""
#                 result2 = await ollama_service.generate(fixup_prompt, mode=mode, max_retries=1, validate_json=False)
#                 test_cases = extract_json_from_response(result2.get("response", ""))
            
#             if not test_cases:
#                 logger.error(f"Could not extract JSON from response: {raw_response[:500]}")
#                 raise Exception(f"Model did not return valid JSON. Response started with: {raw_response[:200]}")
            
            # Validate test case structure
#             if not is_valid_test_case_json(test_cases):
#                 logger.warning("Test cases don't match expected structure, but will try to use them")
            
            # Ensure result is a list
#             if not isinstance(test_cases, list):
#                 test_cases = [test_cases]
            
#             if len(test_cases) == 0:
#                 raise Exception("No test cases generated from model response")
                
#         except Exception as e:
#             logger.error(f"Error generating test cases: {str(e)}")
            # Return a more helpful error
#             raise HTTPException(
#                 status_code=500, 
#                 detail=f"Failed to generate test cases: {str(e)}. This might be due to: 1) Model timeout, 2) Invalid JSON response, 3) Network issue. Try again or use a simpler requirement."
#             )
        
        # Store generation for fine-tuning (fire and forget)
#         generation_id = await store_ai_generation(
#             project_id=project_id,
#             prompt=prompt,
#             model=model_used,
#             output=json.dumps(test_cases),
#             mode=mode,
#             endpoint="/ai/jira-to-testcases",
#             latency_ms=latency_ms,
#             org_id=org_id,
#             task_category="manual"
#         )
        
#         return {
#             "status": "success",
#             "test_cases": test_cases,
#             "requirement_id": requirement_id,
#             "model": model_used,
#             "latency_ms": latency_ms,
#             "generation_id": generation_id  # Include for rating/correction
#         }
        
#     except Exception as e:
#         print(f"Error in jira-to-testcases: {str(e)}")
#         raise HTTPException(status_code=500, detail=str(e))


# @app.post("/ai/testcase-to-playwright")
# async def testcase_to_playwright(request: Request, body: dict):
#     """
#     Convert manual test case to Playwright TypeScript code
#     Input: Single manual test case
#     Output: TypeScript/Playwright code
#     """
#     try:
#         test_case = body.get("test_case", body)
        # Default to "quick" mode to use trained model (qa-expert:7b)
#         mode = body.get("mode", "quick")  # 'quick' (trained model), 'ui' (14B), or 'heavy' (32B)
        
        # Log mode selection
#         print(f"[INFO] TESTCASE-TO-PLAYWRIGHT - Mode: {mode}")
#         logger.info(f"[INFO] TESTCASE-TO-PLAYWRIGHT - Mode: {mode}")
        
#         prompt = f"""You are an expert in Playwright test automation. Convert the following manual test case into executable Playwright TypeScript code.

# Test Case:
# {json.dumps(test_case, indent=2)}

# Generate complete, runnable Playwright test code in TypeScript. Include:
# - Proper imports
# - Test structure with describe/it blocks
# - Step-by-step automation matching the manual test steps
# - Assertions for expected results
# - Proper selectors and waits

# Respond ONLY with valid TypeScript code (no markdown, no explanations):"""

#         start_time = time.time()
#         result = await ollama_service.generate(prompt, mode=mode, validate_json=False)
#         latency_ms = int((time.time() - start_time) * 1000)
        
#         return {
#             "status": "success",
#             "code": result["response"],
#             "model": result["model"],
#             "latency_ms": latency_ms
#         }
        
#     except Exception as e:
#         print(f"Error in testcase-to-playwright: {str(e)}")
#         raise HTTPException(status_code=500, detail=str(e))


# @app.post("/ai/api-tests")
# async def generate_api_tests(request: Request, body: dict):
#     """
#     Generate API tests from OpenAPI spec and story
#     Input: OpenAPI specification and story description
#     Output: Postman or Playwright-API tests
#     """
#     try:
#         openapi_spec = body.get("openapi_spec", body.get("openapi", ""))
#         story = body.get("story", body.get("description", ""))
#         output_format = body.get("format", "playwright")  # playwright or postman
        # Default to "quick" mode to use trained model (qa-expert:7b)
#         mode = body.get("mode", "quick")  # 'quick' (trained model), 'ui' (14B), or 'heavy' (32B)
        
        # Log mode selection
#         print(f"[INFO] OPENAPI-TO-TESTS - Mode: {mode}")
#         logger.info(f"[INFO] OPENAPI-TO-TESTS - Mode: {mode}")
        
#         prompt = f"""You are an expert in API testing. Generate comprehensive API tests based on the OpenAPI specification and user story.

# OpenAPI Specification:
# {openapi_spec[:2000]}...  (truncated if too long)

# User Story:
# {story}

# Generate {output_format} API tests that:
# - Cover all endpoints mentioned in the story
# - Include positive and negative test cases
# - Test request/response validation
# - Include proper assertions

# Respond with valid {output_format} test code (no markdown, no explanations):"""

#         start_time = time.time()
#         result = await ollama_service.generate(prompt, mode=mode, validate_json=False)
#         latency_ms = int((time.time() - start_time) * 1000)
        
#         return {
#             "status": "success",
#             "tests": result["response"],
#             "format": output_format,
#             "model": result["model"],
#             "latency_ms": latency_ms
#         }
        
#     except Exception as e:
#         print(f"Error in api-tests: {str(e)}")
#         raise HTTPException(status_code=500, detail=str(e))


# @app.post("/ai/perf-tests")
# async def generate_perf_tests(request: Request, body: dict):
#     """
#     Generate performance tests from endpoint URL and load profile
#     Input: Endpoint URL and load profile
#     Output: k6 or JMeter script
#     """
#     try:
#         endpoint_url = body.get("endpoint_url", body.get("url", ""))
#         load_profile = body.get("load_profile", body.get("profile", ""))
#         tool = body.get("tool", "k6")  # k6 or jmeter
#         mode = body.get("mode", "quick")
        
#         prompt = f"""You are an expert in performance testing. Generate a {tool} performance test script.

# Endpoint URL: {endpoint_url}

# Load Profile:
# {load_profile}

# Generate a complete {tool} script that:
# - Defines the target endpoint
# - Implements the load profile (VUs, duration, ramp-up)
# - Includes proper metrics collection
# - Tests different scenarios (spike, load, stress)

# Respond with valid {tool} script code (no markdown, no explanations):"""

#         start_time = time.time()
#         result = await ollama_service.generate(prompt, mode=mode, validate_json=False)
#         latency_ms = int((time.time() - start_time) * 1000)
        
#         return {
#             "status": "success",
#             "script": result["response"],
#             "tool": tool,
#             "model": result["model"],
#             "latency_ms": latency_ms
#         }
        
#     except Exception as e:
#         print(f"Error in perf-tests: {str(e)}")
#         raise HTTPException(status_code=500, detail=str(e))


# @app.post("/ai/a11y-tests")
# async def generate_a11y_tests(request: Request, body: dict):
#     """
#     Generate accessibility tests (WCAG 2.1 AA compliance)
#     Uses hardcoded templates - NO inference needed for compliance requirements
#     """
#     try:
#         from app.services.agents.accessibility_compliance import get_accessibility_test_cases
        
        # Get all WCAG 2.1 AA compliance test cases (hardcoded, no inference)
#         test_cases = get_accessibility_test_cases()
        
        # Store generation for tracking (even though no inference)
#         project_id = body.get("project_id", "11111111-1111-1111-1111-111111111111")
#         org_id = body.get("org_id", "00000000-0000-0000-0000-000000000000")
        
#         await store_ai_generation(
#             project_id=project_id,
#             prompt="WCAG 2.1 AA Compliance Test Cases (Hardcoded Templates)",
#             model="template-based",
#             output=json.dumps(test_cases),
#             mode="template",
#             endpoint="/ai/a11y-tests",
#             latency_ms=0,  # No inference, instant
#             org_id=org_id,
#             task_category="accessibility"
#         )
        
#         return {
#             "status": "success",
#             "test_type": "accessibility",
#             "test_cases": test_cases,
#             "count": len(test_cases),
#             "wcag_level": "AA",
#             "wcag_version": "2.1",
#             "source": "hardcoded_templates",
#             "latency_ms": 0
#         }
#     except Exception as e:
#         logger.error(f"Error in a11y-tests: {e}")
#         raise HTTPException(status_code=500, detail=str(e))
    
# @app.post("/ai/a11y-tests-old")
# async def generate_a11y_tests_old(request: Request, body: dict):
#     """
#     Generate accessibility tests from DOM dump or URL
#     Input: DOM dump or URL
#     Output: Playwright + Axe run results
#     """
#     try:
#         dom_dump = body.get("dom_dump", body.get("dom", ""))
#         url = body.get("url", "")
        # Default to "quick" mode to use trained model (qa-expert:7b)
#         mode = body.get("mode", "quick")  # 'quick' (trained model), 'ui' (14B), or 'heavy' (32B)
        
        # Log mode selection
#         print(f"[INFO] DOM-TO-TESTCASES - Mode: {mode}")
#         logger.info(f"[INFO] DOM-TO-TESTCASES - Mode: {mode}")
        
#         if not dom_dump and not url:
#             raise HTTPException(status_code=400, detail="Either dom_dump or url must be provided")
        
#         input_data = f"URL: {url}\n\nDOM Dump:\n{dom_dump}" if dom_dump else f"URL: {url}"
        
#         prompt = f"""You are an expert in web accessibility testing. Generate Playwright + Axe accessibility tests.

# {input_data}

# Generate a complete Playwright test with Axe that:
# - Tests WCAG 2.1 compliance
# - Checks for common accessibility issues
# - Tests keyboard navigation
# - Validates ARIA attributes
# - Includes proper assertions

# Respond with valid TypeScript/Playwright code using @axe-core/playwright (no markdown, no explanations):"""

#         start_time = time.time()
#         result = await ollama_service.generate(prompt, mode=mode, validate_json=False)
#         latency_ms = int((time.time() - start_time) * 1000)
        
#         return {
#             "status": "success",
#             "code": result["response"],
#             "model": result["model"],
#             "latency_ms": latency_ms
#         }
        
#     except Exception as e:
#         print(f"Error in a11y-tests: {str(e)}")
#         raise HTTPException(status_code=500, detail=str(e))


# @app.post("/ai/triage")
# async def triage_with_ollama(request: Request, body: TriageRequest):
#     """
#     Analyze failed test run logs for root cause and fixes
#     Input: Failed run log
#     Output: Root cause, likely defect, and which test to re-run
#     """
#     try:
#         if not body.org_id or not body.project_id or not body.run_id or not body.logs:
#             raise HTTPException(
#                 status_code=400,
#                 detail="Missing required fields: org_id, project_id, run_id, logs"
#             )

#         start_time = time.time()
        # Default to "quick" mode to use trained model (qa-expert:7b)
        # Note: Triage might benefit from larger model, but defaulting to trained for consistency
#         mode = body.get("mode", "quick")  # 'quick' (trained model), 'ui' (14B), or 'heavy' (32B)
        
        # Log mode selection
#         print(f"[INFO] TRIAGE-TEST-FAILURES - Mode: {mode}")
#         logger.info(f"[INFO] TRIAGE-TEST-FAILURES - Mode: {mode}")
        
#         prompt = f"""You are an expert QA engineer analyzing test failures. Analyze the following test run logs and provide root cause analysis.

# Test Run ID: {body.run_id}
# Logs:
# {body.logs}

# Artifacts:
# {json.dumps(body.artifacts, indent=2) if body.artifacts else "None"}

# Provide a comprehensive analysis in JSON format:
# {{
#   "summary": "Brief summary of the issue",
#   "root_cause": "Detailed root cause analysis",
#   "category": "locator|timing|data|network|environment|other",
#   "suggested_fixes": ["fix 1", "fix 2", ...],
#   "selector_suggestions": ["selector 1", "selector 2", ...],
#   "likelihood_flaky": 0.0-1.0,
#   "related_cases": ["case_id_1", "case_id_2", ...],
#   "recommended_rerun": "test_case_id or 'none'"
# }}"""

#         result = await ollama_service.generate_json(prompt, mode=mode)
#         latency_ms = int((time.time() - start_time) * 1000)

#         response = TriageResponse(
#             summary=result.get("summary", "Analysis completed"),
#             root_cause=result.get("root_cause", "Root cause analysis"),
#             category=result.get("category"),
#             suggested_fixes=result.get("suggested_fixes", []),
#             selector_suggestions=result.get("selector_suggestions", []),
#             likelihood_flaky=result.get("likelihood_flaky", 0.0),
#             related_cases=result.get("related_cases", [])
#         )

#         return {
#             **response.dict(),
#             "model": result.get("model", "unknown"),
#             "latency_ms": latency_ms,
#             "recommended_rerun": result.get("recommended_rerun", "none")
#         }

#     except Exception as e:
#         print(f"Error in triage: {str(e)}")
#         raise HTTPException(
#             status_code=500,
#             detail=f"Failed to analyze defect: {str(e)}"
#         )


# ============================================================================
# AI TEMPLATES ENDPOINTS
# ============================================================================

# @app.get("/ai/templates")
# async def get_ai_templates(request: Request, project_id: str, task: Optional[str] = None):
#     """Get AI prompt templates for a project"""
#     try:
        # TODO: Query database for templates
        # For now, return default templates
#         default_templates = {
#             "jira-to-tests": """You are an expert QA engineer. Convert the following Jira story into comprehensive manual test cases.

# Jira Story/Requirements:
# {requirements}

# Generate an array of manual test cases in JSON format. Each test case should have:
# - name: Clear test case name
# - description: Detailed description
# - steps: Array of {{"action": "...", "expectedResult": "..."}}
# - priority: "low", "medium", "high", or "critical"
# - tags: Array of relevant tags

# Respond ONLY with valid JSON array of test cases.""",
#             "testcase-to-playwright": """You are an expert in Playwright test automation. Convert the following manual test case into executable Playwright TypeScript code.

# Test Case:
# {test_case}

# Generate complete, runnable Playwright test code in TypeScript. Include proper imports, test structure, step-by-step automation, assertions, and proper selectors.""",
#             "triage": """You are an expert QA engineer analyzing test failures. Analyze the following test run logs and provide root cause analysis.

# Test Run ID: {run_id}
# Logs:
# {logs}

# Provide a comprehensive analysis in JSON format with summary, root_cause, category, suggested_fixes, selector_suggestions, likelihood_flaky, and related_cases."""
#         }
        
#         if task:
#             return {"task": task, "template": default_templates.get(task, "")}
        
#         return {"templates": default_templates}
#     except Exception as e:
#         raise HTTPException(status_code=500, detail=str(e))


# @app.post("/ai/templates")
# async def save_ai_template(request: Request, body: dict):
#     """Save or update AI prompt template with automatic versioning"""
#     try:
#         from app.services.llm.prompt.prompt_template_service import prompt_template_service
        
#         project_id = body.get("project_id")
#         org_id = body.get("org_id")
#         task = body.get("task")
#         template = body.get("template")
#         version_type = body.get("version_type", "minor")  # "major", "minor", or "patch"
        
#         if not project_id or not task or not template:
#             raise HTTPException(
#                 status_code=400,
#                 detail="Missing required fields: project_id, task, template"
#             )
        
        # Save with versioning service
#         new_version = await prompt_template_service.save_template(
#             task=task,
#             template=template,
#             organization_id=org_id,
#             project_id=project_id,
#             version_type=version_type
#         )
        
#         return {
#             "status": "success",
#             "message": "Template saved successfully",
#             "version": new_version
#         }
#     except HTTPException:
#         raise
#     except Exception as db_error:
#         logger.error(f"Database error saving template: {str(db_error)}")
#         raise HTTPException(
#             status_code=500,
#             detail=f"Failed to save template: {str(db_error)}"
#         )
#     except Exception as e:
#         raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# AI GENERATION QUALITY TRACKING ENDPOINTS (for fine-tuning data collection)
# ============================================================================

# @app.post("/ai/generations/{generation_id}/rate")
# async def rate_generation(generation_id: str, request: Request):
#     """Rate an AI generation (1-5 stars) for quality tracking"""
#     try:
#         body = await request.json()
#         quality_score = body.get("quality_score")
#         feedback = body.get("feedback")
#         is_approved = body.get("is_approved", False)
        
#         if not quality_score or not (1 <= quality_score <= 5):
#             raise HTTPException(
#                 status_code=400,
#                 detail="quality_score must be between 1 and 5"
#             )
        
#         from app.services.storage.database import get_database_client
#         from app.services.storage.postgres_direct import execute_update
        
#         client = get_database_client()
#         if not client or not hasattr(client, 'getconn'):
#             raise HTTPException(status_code=500, detail="Database connection not available")
        
        # Update generation with rating
#         update_query = """
#             UPDATE ai_generations
#             SET quality_score = %s,
#                 feedback = %s,
#                 is_approved = %s,
#                 rated_at = NOW()
#             WHERE id = %s
#             RETURNING id
#         """
        
#         result = await execute_update(
#             update_query,
#             (quality_score, feedback, is_approved, generation_id)
#         )
        
#         if not result or len(result) == 0:
#             raise HTTPException(status_code=404, detail="Generation not found")
        
#         return {
#             "status": "success",
#             "message": "Rating saved successfully",
#             "generation_id": generation_id,
#             "quality_score": quality_score
#         }
        
#     except HTTPException:
#         raise
#     except Exception as e:
#         logger.error(f"Error rating generation: {e}")
#         raise HTTPException(status_code=500, detail=str(e))


# @app.post("/ai/generations/{generation_id}/correct")
# async def correct_generation(generation_id: str, request: Request):
#     """Submit a corrected version of an AI generation"""
#     try:
#         body = await request.json()
#         corrected_output = body.get("corrected_output")
#         feedback = body.get("feedback")
        
#         if not corrected_output:
#             raise HTTPException(
#                 status_code=400,
#                 detail="corrected_output is required"
#             )
        
#         from app.services.storage.database import get_database_client
#         from app.services.storage.postgres_direct import execute_update
        
#         client = get_database_client()
#         if not client or not hasattr(client, 'getconn'):
#             raise HTTPException(status_code=500, detail="Database connection not available")
        
        # Update generation with correction
#         update_query = """
#             UPDATE ai_generations
#             SET corrected_output = %s,
#                 feedback = %s,
#                 corrected_at = NOW(),
#                 is_approved = true  -- Auto-approve if user took time to correct
#             WHERE id = %s
#             RETURNING id
#         """
        
#         result = await execute_update(
#             update_query,
#             (corrected_output, feedback, generation_id)
#         )
        
#         if not result or len(result) == 0:
#             raise HTTPException(status_code=404, detail="Generation not found")
        
#         return {
#             "status": "success",
#             "message": "Correction saved successfully",
#             "generation_id": generation_id
#         }
        
#     except HTTPException:
#         raise
#     except Exception as e:
#         logger.error(f"Error correcting generation: {e}")
#         raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# MODEL GATEWAY ENDPOINTS (Phase 1.1)
# ============================================================================

# @app.post("/ai/gateway/generate")
# async def gateway_generate(request: Request, body: dict):
#     """
#     Unified text generation endpoint via Model Gateway
#     Routes to local Qwen, OpenAI, Anthropic, etc.
#     """
#     try:
#         from app.services.llm.model_gateway import get_model_gateway, GenerationRequest, LLMProvider
        
#         gateway = get_model_gateway()
#         tenant_id = body.get("tenant_id")  # Will be used in Phase 1.3
        
#         gen_request = GenerationRequest(
#             prompt=body.get("prompt", ""),
#             mode=body.get("mode"),
#             max_tokens=body.get("max_tokens"),
#             temperature=body.get("temperature"),
#             validate_json=body.get("validate_json", True),
#             task_type=body.get("task_type"),
#             provider=LLMProvider(body.get("provider")) if body.get("provider") else None
#         )
        
#         result = await gateway.generate(gen_request, tenant_id=tenant_id)
        
#         return {
#             "status": "success",
#             "response": result.response,
#             "model": result.model,
#             "provider": result.provider,
#             "tokens_used": result.tokens_used,
#             "latency_ms": result.latency_ms,
#             "cost_usd": result.cost_usd
#         }
        
#     except Exception as e:
#         logger.error(f"Gateway generate failed: {e}")
#         raise HTTPException(status_code=500, detail=str(e))


# @app.post("/ai/gateway/chat")
# async def gateway_chat(request: Request, body: dict):
#     """
#     Unified chat completion endpoint via Model Gateway
#     """
#     try:
#         from app.services.llm.model_gateway import get_model_gateway, ChatRequest, LLMProvider
        
#         gateway = get_model_gateway()
#         tenant_id = body.get("tenant_id")
        
#         chat_request = ChatRequest(
#             messages=body.get("messages", []),
#             mode=body.get("mode"),
#             max_tokens=body.get("max_tokens"),
#             temperature=body.get("temperature"),
#             provider=LLMProvider(body.get("provider")) if body.get("provider") else None
#         )
        
#         result = await gateway.chat(chat_request, tenant_id=tenant_id)
        
#         return {
#             "status": "success",
#             "response": result.response,
#             "model": result.model,
#             "provider": result.provider,
#             "tokens_used": result.tokens_used,
#             "latency_ms": result.latency_ms,
#             "cost_usd": result.cost_usd
#         }
        
#     except Exception as e:
#         logger.error(f"Gateway chat failed: {e}")
#         raise HTTPException(status_code=500, detail=str(e))


# @app.post("/ai/gateway/embedding")
# async def gateway_embedding(request: Request, body: dict):
#     """
#     Unified embedding endpoint via Model Gateway
#     """
#     try:
#         from app.services.llm.model_gateway import get_model_gateway, EmbeddingRequest, LLMProvider
        
#         gateway = get_model_gateway()
#         tenant_id = body.get("tenant_id")
        
#         embedding_request = EmbeddingRequest(
#             text=body.get("text", ""),
#             provider=LLMProvider(body.get("provider")) if body.get("provider") else None
#         )
        
#         result = await gateway.embedding(embedding_request, tenant_id=tenant_id)
        
#         return {
#             "status": "success",
#             "embedding": result.get("embedding", []),
#             "model": result.get("model", ""),
#             "provider": result.get("provider", ""),
#             "tokens_used": result.get("tokens_used", 0),
#             "latency_ms": result.get("latency_ms", 0),
#             "cost_usd": result.get("cost_usd", 0.0)
#         }
        
#     except Exception as e:
#         logger.error(f"Gateway embedding failed: {e}")
#         raise HTTPException(status_code=500, detail=str(e))


# @app.get("/ai/gateway/usage")
# async def get_llm_usage(
#     tenant_id: Optional[str] = None,
#     provider: Optional[str] = None,
#     start_date: Optional[str] = None,
#     end_date: Optional[str] = None,
#     limit: int = 100
# ):
#     """
#     Get LLM usage statistics
#     """
#     try:
#         from app.services.storage.postgres_direct import get_postgres_pool
#         import concurrent.futures
        
#         pool = get_postgres_pool()
#         if not pool:
#             raise HTTPException(status_code=500, detail="Database not available")
        
        # Build query
#         query = "SELECT * FROM llm_usage WHERE 1=1"
#         params = []
        
#         if tenant_id:
#             query += " AND tenant_id = %s"
#             params.append(tenant_id)
        
#         if provider:
#             query += " AND provider = %s"
#             params.append(provider)
        
#         if start_date:
#             query += " AND created_at >= %s"
#             params.append(start_date)
        
#         if end_date:
#             query += " AND created_at <= %s"
#             params.append(end_date)
        
#         query += " ORDER BY created_at DESC LIMIT %s"
#         params.append(limit)
        
        # Execute query
#         loop = asyncio.get_event_loop()
#         with concurrent.futures.ThreadPoolExecutor() as executor:
#             results = await loop.run_in_executor(
#                 executor,
#                 lambda: _query_usage_sync(pool, query, params)
#             )
        
#         return {
#             "status": "success",
#             "count": len(results),
#             "usage": results
#         }
        
#     except Exception as e:
#         logger.error(f"Failed to get usage stats: {e}")
#         raise HTTPException(status_code=500, detail=str(e))


# def _query_usage_sync(pool, query, params):
#     """Synchronous database query"""
#     conn = pool.getconn()
#     try:
#         with conn.cursor() as cur:
#             cur.execute(query, params)
#             columns = [desc[0] for desc in cur.description]
#             results = [dict(zip(columns, row)) for row in cur.fetchall()]
#             return results
#     finally:
#         pool.putconn(conn)


# ============================================================================
# TENANT MANAGEMENT ENDPOINTS (Phase 1.3)
# ============================================================================

# @app.post("/tenants")
# async def create_tenant(request: Request, body: dict):
#     """
#     Create a new tenant
#     """
#     try:
#         from app.services.core.tenant_service import tenant_service
        
#         tenant_id = body.get("tenant_id")
#         if not tenant_id:
#             raise HTTPException(status_code=400, detail="tenant_id is required")
        
#         tenant = await tenant_service.create_tenant(
#             tenant_id=tenant_id,
#             org_id=body.get("org_id"),
#             name=body.get("name"),
#             settings=body.get("settings", {})
#         )
        
#         return {
#             "status": "success",
#             "tenant": tenant
#         }
        
#     except Exception as e:
#         logger.error(f"Failed to create tenant: {e}")
#         raise HTTPException(status_code=500, detail=str(e))


# @app.get("/tenants/{tenant_id}")
# async def get_tenant(tenant_id: str):
#     """
#     Get tenant configuration
#     """
#     try:
#         from app.services.core.tenant_service import tenant_service
        
#         tenant = await tenant_service.get_tenant(tenant_id)
#         if not tenant:
#             raise HTTPException(status_code=404, detail="Tenant not found")
        
#         return {
#             "status": "success",
#             "tenant": tenant
#         }
        
#     except HTTPException:
#         raise
#     except Exception as e:
#         logger.error(f"Failed to get tenant: {e}")
#         raise HTTPException(status_code=500, detail=str(e))


# @app.get("/tenants")
# async def list_tenants(limit: int = 100):
#     """
#     List all tenants
#     """
#     try:
#         from app.services.core.tenant_service import tenant_service
        
#         tenants = await tenant_service.list_tenants(limit=limit)
        
#         return {
#             "status": "success",
#             "count": len(tenants),
#             "tenants": tenants
#         }
        
#     except Exception as e:
#         logger.error(f"Failed to list tenants: {e}")
#         raise HTTPException(status_code=500, detail=str(e))


# @app.patch("/tenants/{tenant_id}/settings")
# async def update_tenant_settings(tenant_id: str, body: dict):
#     """
#     Update tenant settings
#     """
#     try:
#         from app.services.core.tenant_service import tenant_service
        
#         settings = body.get("settings", {})
#         success = await tenant_service.update_tenant_settings(tenant_id, settings)
        
#         if not success:
#             raise HTTPException(status_code=404, detail="Tenant not found")
        
#         return {
#             "status": "success",
#             "message": "Settings updated"
#         }
        
#     except HTTPException:
#         raise
#     except Exception as e:
#         logger.error(f"Failed to update tenant settings: {e}")
#         raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# AGENT ORCHESTRATOR ENDPOINTS (Phase 1.2)
# ============================================================================

# @app.post("/agents/execute")
# async def execute_agent_task(request: Request, body: dict):
#     """
#     Execute a task using an agent via the agent registry
#     """
#     try:
#         from app.services.core.agent_registry import agent_registry
#         from app.schemas.agent_schemas import AgentTaskRequest, AgentType
        
#         task_request = AgentTaskRequest(
#             task_id=body.get("task_id", str(uuid.uuid4())),
#             agent_type=AgentType(body.get("agent_type")),
#             tenant_id=body.get("tenant_id"),
#             project_id=body.get("project_id"),
#             org_id=body.get("org_id"),
#             input_data=body.get("input_data", {}),
#             timeout_seconds=body.get("timeout_seconds", 300),
#             max_retries=body.get("max_retries", 3),
#             priority=body.get("priority", 5),
#             metadata=body.get("metadata", {})
#         )
        
#         result = await agent_registry.execute_task(task_request)
        
#         return {
#             "status": "success",
#             "result": result.dict()
#         }
        
#     except Exception as e:
#         logger.error(f"Agent task execution failed: {e}")
#         raise HTTPException(status_code=500, detail=str(e))


# @app.get("/agents")
# async def list_agents():
#     """
#     List all registered agents
#     """
#     try:
#         from app.services.core.agent_registry import agent_registry
        
#         agents = agent_registry.list_agents()
        
#         return {
#             "status": "success",
#             "count": len(agents),
#             "agents": [agent.dict() for agent in agents]
#         }
        
#     except Exception as e:
#         logger.error(f"Failed to list agents: {e}")
#         raise HTTPException(status_code=500, detail=str(e))


# @app.get("/agents/{agent_type}/health")
# async def get_agent_health(agent_type: str):
#     """
#     Get health status for an agent
#     """
#     try:
#         from app.services.core.agent_registry import agent_registry
#         from app.schemas.agent_schemas import AgentType
        
#         health = agent_registry.get_health(AgentType(agent_type))
        
#         if not health:
#             raise HTTPException(status_code=404, detail="Agent not found")
        
#         return {
#             "status": "success",
#             "health": health[AgentType(agent_type)].dict()
#         }
        
#     except HTTPException:
#         raise
#     except Exception as e:
#         logger.error(f"Failed to get agent health: {e}")
#         raise HTTPException(status_code=500, detail=str(e))


# @app.get("/agents/health")
# async def get_all_agents_health():
#     """
#     Get health status for all agents
#     """
#     try:
#         from app.services.core.agent_registry import agent_registry
        
#         health = agent_registry.get_health()
        
#         return {
#             "status": "success",
#             "health": {k.value: v.dict() for k, v in health.items()}
#         }
        
#     except Exception as e:
#         logger.error(f"Failed to get agents health: {e}")
#         raise HTTPException(status_code=500, detail=str(e))


# @app.post("/workflows/multi-agent")
# async def create_multi_agent_workflow(request: Request, body: dict):
#     """
#     Create a multi-agent workflow
#     """
#     try:
#         from app.services.core.orchestrator import orchestrator
        
#         workflow_id = await orchestrator.create_multi_agent_workflow(
#             org_id=body.get("org_id", "00000000-0000-0000-0000-000000000000"),
#             project_id=body.get("project_id", "11111111-1111-1111-1111-111111111111"),
#             agent_tasks=body.get("agent_tasks", []),
#             metadata=body.get("metadata", {})
#         )
        
#         return {
#             "status": "success",
#             "workflow_id": workflow_id
#         }
        
#     except Exception as e:
#         logger.error(f"Failed to create multi-agent workflow: {e}")
#         raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# TRAINING DATA EXPORT
# ============================================================================

# @app.get("/ai/training-data/export")
# async def export_training_data(
#     min_quality_score: int = 4,
#     task_category: Optional[str] = None,
#     limit: int = 1000,
#     format: str = "jsonl"
# ):
#     """
#     Export high-quality generations for fine-tuning
    
#     Args:
#         min_quality_score: Minimum quality score (1-5, default 4)
#         task_category: Filter by task category (optional)
#         limit: Maximum number of records (default 1000)
#         format: Export format ('jsonl' or 'json', default 'jsonl')
#     """
#     try:
#         from app.services.storage.database import get_database_client
#         from app.services.storage.postgres_direct import execute_query
        
#         client = get_database_client()
#         if not client or not hasattr(client, 'getconn'):
#             raise HTTPException(status_code=500, detail="Database connection not available")
        
        # Build query
#         query = """
#             SELECT 
#                 id,
#                 prompt,
#                 output,
#                 corrected_output,
#                 task_category,
#                 endpoint,
#                 model,
#                 quality_score,
#                 is_approved,
#                 created_at
#             FROM ai_generations
#             WHERE (quality_score >= %s OR is_approved = true OR corrected_output IS NOT NULL)
#         """
#         params = [min_quality_score]
        
#         if task_category:
#             query += " AND task_category = %s"
#             params.append(task_category)
        
#         query += " ORDER BY created_at DESC LIMIT %s"
#         params.append(limit)
        
#         results = await execute_query(query, tuple(params))
        
#         if not results:
#             return {
#                 "status": "success",
#                 "count": 0,
#                 "data": []
#             }
        
        # Format for training
#         training_data = []
#         for row in results:
            # Use corrected output if available (more valuable for training)
#             output = row.get("corrected_output") or row.get("output")
            
            # Format as instruction/input/output
#             training_entry = {
#                 "instruction": f"Generate {row.get('task_category', 'test cases')} based on the following requirement:",
#                 "input": row.get("prompt", ""),
#                 "output": output,
#                 "task_type": row.get("task_category", "unknown"),
#                 "quality_score": row.get("quality_score"),
#                 "is_approved": row.get("is_approved", False),
#                 "has_correction": row.get("corrected_output") is not None,
#                 "model": row.get("model"),
#                 "created_at": row.get("created_at").isoformat() if row.get("created_at") else None
#             }
#             training_data.append(training_entry)
        
#         if format == "jsonl":
            # Return as JSONL (one JSON object per line)
#             from fastapi.responses import Response
#             jsonl_content = "\n".join([json.dumps(entry) for entry in training_data])
#             return Response(
#                 content=jsonl_content,
#                 media_type="application/x-ndjson",
#                 headers={
#                     "Content-Disposition": f"attachment; filename=training_data_{datetime.now().strftime('%Y%m%d_%H%M%S')}.jsonl"
#                 }
#             )
#         else:
            # Return as JSON array
#             return {
#                 "status": "success",
#                 "count": len(training_data),
#                 "data": training_data
#             }
        
#     except HTTPException:
#         raise
#     except Exception as e:
#         logger.error(f"Error exporting training data: {e}")
#         raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# MODEL REGISTRY ENDPOINTS (for fine-tuned model management)
# ============================================================================

# @app.get("/ai/models")
# async def list_models():
#     """List all registered models and versions"""
#     try:
#         from app.services.llm.model_registry import model_registry
#         models = await model_registry.list_models()
#         return {
#             "status": "success",
#             "models": models
#         }
#     except Exception as e:
#         logger.error(f"Error listing models: {e}")
#         raise HTTPException(status_code=500, detail=str(e))


# @app.get("/ai/models/{model_id}")
# async def get_model_info(model_id: str):
#     """Get information about a specific model"""
#     try:
#         from app.services.llm.model_registry import model_registry
#         info = await model_registry.get_model_info(model_id)
#         if not info:
#             raise HTTPException(status_code=404, detail=f"Model {model_id} not found")
#         return {
#             "status": "success",
#             "model": info
#         }
#     except HTTPException:
#         raise
#     except Exception as e:
#         logger.error(f"Error getting model info: {e}")
#         raise HTTPException(status_code=500, detail=str(e))


# @app.post("/ai/models/register")
# async def register_model(request: Request):
#     """Register a new model version"""
#     try:
#         body = await request.json()
#         model_id = body.get("model_id")
#         version = body.get("version")
#         base_model = body.get("base_model")
#         model_path = body.get("model_path")
#         metrics = body.get("metrics", {})
#         metadata = body.get("metadata", {})
        
#         if not all([model_id, version, base_model, model_path]):
#             raise HTTPException(
#                 status_code=400,
#                 detail="Missing required fields: model_id, version, base_model, model_path"
#             )
        
#         from app.services.llm.model_registry import model_registry
#         model_version = await model_registry.register_model(
#             model_id=model_id,
#             version=version,
#             base_model=base_model,
#             model_path=model_path,
#             metrics=metrics,
#             metadata=metadata
#         )
        
#         return {
#             "status": "success",
#             "message": "Model registered successfully",
#             "model": model_version.to_dict()
#         }
#     except HTTPException:
#         raise
#     except Exception as e:
#         logger.error(f"Error registering model: {e}")
#         raise HTTPException(status_code=500, detail=str(e))


# @app.post("/ai/models/{model_id}/deploy")
# async def deploy_model(model_id: str, request: Request):
#     """Deploy a model version (canary or full rollout)"""
#     try:
#         body = await request.json()
#         version = body.get("version")
#         percentage = body.get("percentage", 100)
        
#         if not version:
#             raise HTTPException(status_code=400, detail="version is required")
        
#         if not (1 <= percentage <= 100):
#             raise HTTPException(status_code=400, detail="percentage must be between 1 and 100")
        
#         from app.services.llm.model_registry import model_registry
#         success = await model_registry.deploy_model(
#             model_id=model_id,
#             version=version,
#             percentage=percentage
#         )
        
#         return {
#             "status": "success",
#             "message": f"Model {model_id} version {version} deployed at {percentage}%",
#             "model_id": model_id,
#             "version": version,
#             "percentage": percentage
#         }
#     except HTTPException:
#         raise
#     except Exception as e:
#         logger.error(f"Error deploying model: {e}")
#         raise HTTPException(status_code=500, detail=str(e))


# @app.post("/ai/models/{model_id}/ab-test")
# async def start_ab_test(model_id: str, request: Request):
#     """Start an A/B test between two model versions"""
#     try:
#         body = await request.json()
#         control_version = body.get("control_version")
#         treatment_version = body.get("treatment_version")
#         percentage = body.get("percentage", 10)
        
#         if not all([control_version, treatment_version]):
#             raise HTTPException(
#                 status_code=400,
#                 detail="control_version and treatment_version are required"
#             )
        
#         if not (1 <= percentage <= 50):
#             raise HTTPException(
#                 status_code=400,
#                 detail="percentage must be between 1 and 50 for A/B tests"
#             )
        
#         from app.services.llm.model_registry import model_registry
#         test_id = await model_registry.start_ab_test(
#             model_id=model_id,
#             control_version=control_version,
#             treatment_version=treatment_version,
#             percentage=percentage
#         )
        
#         return {
#             "status": "success",
#             "message": "A/B test started",
#             "test_id": test_id,
#             "model_id": model_id,
#             "control_version": control_version,
#             "treatment_version": treatment_version,
#             "percentage": percentage
#         }
#     except HTTPException:
#         raise
#     except Exception as e:
#         logger.error(f"Error starting A/B test: {e}")
#         raise HTTPException(status_code=500, detail=str(e))


# @app.post("/ai/models/{model_id}/rollback")
# async def rollback_model(model_id: str, request: Request):
#     """Rollback to a previous model version"""
#     try:
#         body = await request.json()
#         target_version = body.get("target_version")  # Optional, defaults to previous
        
#         from app.services.llm.model_registry import model_registry
#         success = await model_registry.rollback_model(
#             model_id=model_id,
#             target_version=target_version
#         )
        
#         return {
#             "status": "success",
#             "message": f"Model {model_id} rolled back successfully",
#             "model_id": model_id,
#             "target_version": target_version or "previous"
#         }
#     except HTTPException:
#         raise
#     except Exception as e:
#         logger.error(f"Error rolling back model: {e}")
#         raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# CRUD Endpoints for Test Cases, Test Runs, and Test Plans
# ============================================================================

# Default org and project IDs for demo (should be replaced with actual auth)
# DEFAULT_ORG_ID = "00000000-0000-0000-0000-000000000000"
# DEFAULT_PROJECT_ID = "11111111-1111-1111-1111-111111111111"
# DEFAULT_USER_ID = "22222222-2222-2222-2222-222222222222"

# def _map_priority_from_db(priority: str) -> str:
#     """Map database priority (P0-P3) to frontend format (critical, high, medium, low)"""
#     priority_map = {
#         "P0": "critical",
#         "P1": "high",
#         "P2": "medium",
#         "P3": "low"
#     }
#     return priority_map.get(priority.upper(), "medium")

# Helper function to get or create default org/project/user
# async def ensure_default_org_project():
#     """Ensure default org, project, and user exist"""
#     try:
#         from app.services.storage.postgres_direct import execute_query, execute_insert
#         pool = get_database_client()
        
#         if not pool or not hasattr(pool, 'getconn'):
#             return DEFAULT_ORG_ID, DEFAULT_PROJECT_ID
        
        # Check if org exists
#         orgs = await execute_query("SELECT id FROM organizations WHERE id = %s", (DEFAULT_ORG_ID,))
#         if not orgs:
#             await execute_insert("organizations", {
#                 "id": DEFAULT_ORG_ID,
#                 "name": "Demo Organization",
#                 "slug": "demo"
#             })
        
        # Check if project exists
#         projects = await execute_query("SELECT id FROM projects WHERE id = %s", (DEFAULT_PROJECT_ID,))
#         if not projects:
#             await execute_insert("projects", {
#                 "id": DEFAULT_PROJECT_ID,
#                 "org_id": DEFAULT_ORG_ID,
#                 "name": "Demo Project",
#                 "slug": "demo"
#             })
        
        # Check if default user exists
#         users = await execute_query("SELECT id FROM users WHERE id = %s", (DEFAULT_USER_ID,))
#         if not users:
            # Get users table columns to determine which fields to include
#             try:
                # Try to get table structure
#                 columns_query = """
#                     SELECT column_name 
#                     FROM information_schema.columns 
#                     WHERE table_name = 'users' 
#                     ORDER BY ordinal_position
#                 """
#                 columns = await execute_query(columns_query, ())
#                 column_names = [col[0] if isinstance(col, tuple) else col.get('column_name', '') for col in columns] if columns else []
                
#                 user_data = {
#                     "id": DEFAULT_USER_ID,
#                     "email": "demo@qaai.local",
#                     "name": "Demo User"
#                 }
                
                # Only include org_id if the column exists
#                 if column_names and 'org_id' in column_names:
#                     user_data["org_id"] = DEFAULT_ORG_ID
                
#                 await execute_insert("users", user_data)
#             except Exception as e:
#                 logger.warning(f"Could not check users table schema, trying without org_id: {e}")
                # Fallback: try without org_id
#                 try:
#                     await execute_insert("users", {
#                         "id": DEFAULT_USER_ID,
#                         "email": "demo@qaai.local",
#                         "name": "Demo User"
#                     })
#                 except Exception as e2:
#                     logger.error(f"Failed to create default user: {e2}")
                    # Continue anyway - user creation is not critical for Flowstral
        
#         return DEFAULT_ORG_ID, DEFAULT_PROJECT_ID
#     except Exception as e:
#         logger.error(f"Error ensuring default org/project/user: {str(e)}")
#         return DEFAULT_ORG_ID, DEFAULT_PROJECT_ID

# Test Cases CRUD - MOVED to routers/test_cases_crud_api.py
# All test cases endpoints are now in routers/test_cases_crud_api.py
# OLD CODE COMMENTED OUT TO AVOID CONFLICTS
# """
# @app.get("/test-cases")
# async def get_test_cases(
#     project_id: Optional[str] = None,
#     plan_id: Optional[str] = None
# ):
#     """Get all test cases, optionally filtered by plan_id"""
#     try:
#         org_id, proj_id = await ensure_default_org_project()
#         project_id = project_id or proj_id
        
#         from app.services.storage.postgres_direct import execute_query
        
#         pool = get_database_client()
#         if not pool or not hasattr(pool, 'getconn'):
#             return []
        
        # Build query with optional plan_id filter
#         if plan_id:
#             query = """
#                 SELECT id, project_id, plan_id, title, description, priority, test_type, 
#                        status, tags, steps, preconditions, test_data, estimated_time,
#                        created_by, created_at, updated_at
#                 FROM test_cases 
#                 WHERE project_id = %s AND plan_id = %s
#                 ORDER BY created_at DESC
#             """
#             results = await execute_query(query, (project_id, plan_id))
#         else:
#             query = """
#                 SELECT id, project_id, plan_id, title, description, priority, test_type, 
#                        status, tags, steps, preconditions, test_data, estimated_time,
#                        created_by, created_at, updated_at
#                 FROM test_cases 
#                 WHERE project_id = %s
#                 ORDER BY created_at DESC
#             """
#             results = await execute_query(query, (project_id,))
        
#         test_cases = []
#         for row in results or []:
            # Parse steps JSON if needed
#             steps = row.get("steps") or []
#             if isinstance(steps, str):
#                 try:
#                     import json
#                     steps = json.loads(steps)
#                 except:
#                     steps = []
            
#             test_cases.append({
#                 "id": str(row.get("id", "")),
#                 "name": row.get("title", ""),
#                 "description": row.get("description", ""),
#                 "steps": steps,
#                 "priority": _map_priority_from_db(row.get("priority", "P2")),
#                 "tags": row.get("tags") or [],
#                 "testType": row.get("test_type", "manual"),
#                 "complexity": "medium",
#                 "estimatedTime": row.get("estimated_time", 15),
#                 "preconditions": row.get("preconditions") or [],
#                 "testData": row.get("test_data") or {},
#                 "createdAt": row.get("created_at", "").isoformat() if hasattr(row.get("created_at"), 'isoformat') else str(row.get("created_at", "")),
#                 "updatedAt": row.get("updated_at", "").isoformat() if hasattr(row.get("updated_at"), 'isoformat') else str(row.get("updated_at", ""))
#             })
        
        # Return array directly (frontend expects array)
#         return test_cases
#     except Exception as e:
#         logger.error(f"Error getting test cases: {str(e)}")
#         raise HTTPException(status_code=500, detail=str(e))

# @app.get("/test-cases/{case_id}")
# async def get_test_case(case_id: str):
#     """Get a specific test case"""
#     try:
#         from app.services.storage.postgres_direct import execute_query
        
#         pool = get_database_client()
#         if not pool or not hasattr(pool, 'getconn'):
#             raise HTTPException(status_code=404, detail="Test case not found")
        
#         query = """
#             SELECT id, project_id, plan_id, title, description, priority, test_type, 
#                    status, tags, steps, preconditions, test_data, estimated_time,
#                    created_by, created_at, updated_at
#             FROM test_cases 
#             WHERE id = %s
#         """
#         results = await execute_query(query, (case_id,))
        
#         if not results or len(results) == 0:
#             raise HTTPException(status_code=404, detail="Test case not found")
        
#         row = results[0]
#         return {
#             "id": str(row.get("id", "")),
#             "name": row.get("title", ""),
#             "description": row.get("description", ""),
#             "steps": row.get("steps") or [],
#             "priority": _map_priority_from_db(row.get("priority", "P2")),
#             "tags": row.get("tags") or [],
#             "testType": row.get("test_type", "manual"),
#             "complexity": "medium",
#             "estimatedTime": row.get("estimated_time", 15),
#             "preconditions": row.get("preconditions") or [],
#             "testData": row.get("test_data") or {}
#         }
#     except HTTPException:
#         raise
#     except Exception as e:
#         logger.error(f"Error getting test case: {str(e)}")
#         raise HTTPException(status_code=500, detail=str(e))

# @app.post("/test-cases")
# async def create_test_case(request: Request):
#     """Create a new test case"""
#     try:
#         org_id, project_id = await ensure_default_org_project()
        
#         data = await request.json()
        
        # Map frontend format to database format
#         priority_map = {"low": "P3", "medium": "P2", "high": "P1", "critical": "P0"}
#         priority = priority_map.get(data.get("priority", "medium"), "P2")
        
#         from app.services.storage.postgres_direct import execute_insert
        
        # Convert steps if needed (for all test types that might have different structures)
        # Note: execute_insert will handle database connection and raise proper errors
#         steps = data.get("steps", [])
#         if not steps or len(steps) == 0:
            # Try to convert test structures to steps based on test type
#             test_type = data.get("testType", "manual")
#             if test_type == "performance":
                # Convert performance test fields to steps
#                 steps = [
#                     {
#                         "action": f"Configure load test: {data.get('virtual_users', 'N/A')} virtual users, {data.get('duration', 'N/A')}s duration, {data.get('ramp_up', 'N/A')}s ramp-up",
#                         "expectedResult": f"Test configured successfully"
#                     },
#                     {
#                         "action": f"Execute load test and monitor: throughput >= {data.get('expected_throughput', 'N/A')} req/s, p95 latency <= {data.get('expected_latency_p95', 'N/A')}ms",
#                         "expectedResult": f"Performance metrics meet expectations, error rate <= {data.get('expected_error_rate', 0.01) * 100}%"
#                     }
#                 ]
#             elif test_type in ["accessibility", "a11y"]:
                # Convert accessibility test fields to steps
#                 steps = [
#                     {
#                         "action": data.get("test_method", "Execute accessibility test"),
#                         "expectedResult": data.get("expected_result", "Test passes WCAG compliance")
#                     }
#                 ]
#                 if data.get("wcag_guideline"):
#                     steps[0]["action"] = f"Test {data.get('wcag_guideline')}: {steps[0]['action']}"
#             elif test_type == "api":
                # Convert API test fields to steps
#                 http_method = data.get("method", "GET")
#                 endpoint = data.get("endpoint", data.get("url", "N/A"))
#                 expected_status = data.get("expected_status", "200")
#                 request_body = data.get("request_body", "")
#                 expected_response = data.get("expected_response", "")
                
#                 steps = [
#                     {
#                         "action": f"Send {http_method} request to {endpoint}" + (f" with body: {request_body}" if request_body else ""),
#                         "expectedResult": f"Response status is {expected_status}" + (f" and response matches: {expected_response}" if expected_response else "")
#                     }
#                 ]
#                 if data.get("headers"):
#                     steps[0]["action"] = f"Set headers: {data.get('headers')}, then {steps[0]['action']}"
#             elif test_type == "security":
                # Convert security test fields to steps
#                 vulnerability = data.get("vulnerability", "Security vulnerability")
#                 attack_vector = data.get("attack_vector", "Test security controls")
#                 expected_result = data.get("expected_result", "Security controls prevent vulnerability")
                
#                 steps = [
#                     {
#                         "action": f"Test for {vulnerability}: {attack_vector}",
#                         "expectedResult": expected_result
#                     }
#                 ]
#             elif test_type == "manual":
                # Manual tests should have steps, but if missing, create from description
#                 if data.get("description"):
#                     steps = [
#                         {
#                             "action": f"Execute test: {data.get('description', '')[:100]}",
#                             "expectedResult": data.get("expected", "Test completes successfully")
#                         }
#                     ]
#                 else:
                    # Last resort: create generic step
#                     steps = [
#                         {
#                             "action": "Execute manual test case",
#                             "expectedResult": "Test case completes successfully"
#                         }
#                     ]
        
#         case_data = {
#             "project_id": project_id,
#             "title": data.get("name", ""),
#             "description": data.get("description", ""),
#             "priority": priority,
#             "test_type": data.get("testType", "manual"),
#             "status": "draft",
#             "tags": data.get("tags", []),
#             "steps": steps,
#             "preconditions": data.get("preconditions", []),
#             "test_data": data.get("testData", {}),
#             "estimated_time": data.get("estimatedTime", 15),
#             "created_by": DEFAULT_USER_ID
#         }
        
#         logger.info(f"Creating test case: title={case_data['title']}, test_type={case_data['test_type']}, steps_count={len(steps)}")
#         print(f"[INFO] CREATE_TEST_CASE - Title: {case_data['title']}, Type: {case_data['test_type']}, Steps: {len(steps)}")
        
#         try:
#             case_id = await execute_insert("test_cases", case_data)
#             if not case_id:
#                 error_msg = "execute_insert returned None - database insert failed"
#                 logger.error(error_msg)
#                 print(f"[ERROR] CREATE_TEST_CASE - {error_msg}")
#                 raise HTTPException(status_code=500, detail=error_msg)
            
#             logger.info(f"Successfully created test case: {case_id}")
#             print(f"[OK] CREATE_TEST_CASE - Created with ID: {case_id}")
#             return {"id": case_id}
#         except HTTPException:
#             raise
#         except Exception as db_error:
#             error_msg = f"Database error creating test case: {str(db_error)}"
#             logger.error(error_msg)
#             print(f"[ERROR] CREATE_TEST_CASE - {error_msg}")
#             import traceback
#             full_traceback = traceback.format_exc()
#             logger.error(f"Full traceback:\n{full_traceback}")
#             print(f"[ERROR] CREATE_TEST_CASE - Full traceback:\n{full_traceback}")
            # Return detailed error message to frontend
#             raise HTTPException(status_code=500, detail=f"Database error: {str(db_error)}. Check server logs for full details.")
#     except Exception as e:
#         logger.error(f"Error in create_test_case: {str(e)}")
#         raise HTTPException(status_code=500, detail=str(e))

# @app.put("/test-cases/{case_id}")
# async def update_test_case(case_id: str, request: Request):
#     """Update a test case"""
#     try:
#         org_id, project_id = await ensure_default_org_project()
        
#         data = await request.json()
        
#         pool = get_database_client()
#         if not pool or not hasattr(pool, 'getconn'):
#             raise HTTPException(status_code=404, detail="Test case not found")
        
#         priority_map = {"low": "P3", "medium": "P2", "high": "P1", "critical": "P0"}
#         priority = priority_map.get(data.get("priority", "medium"), "P2")
        
#         from app.services.storage.postgres_direct import get_postgres_pool
#         pool = get_postgres_pool()
#         if not pool:
#             raise HTTPException(status_code=500, detail="Database connection failed")
        
#         conn = pool.getconn()
#         try:
#             with conn.cursor() as cur:
#                 update_query = """
#                     UPDATE test_cases 
#                     SET title = %s, description = %s, priority = %s, test_type = %s,
#                         tags = %s, steps = %s, preconditions = %s, test_data = %s,
#                         estimated_time = %s, updated_at = NOW()
#                     WHERE id = %s
#                     RETURNING id
#                 """
#                 cur.execute(update_query, (
#                     data.get("name", ""),
#                     data.get("description", ""),
#                     priority,
#                     data.get("testType", "manual"),
#                     data.get("tags", []),
#                     json.dumps(data.get("steps", [])),
#                     data.get("preconditions", []),
#                     json.dumps(data.get("testData", {})),
#                     data.get("estimatedTime", 15),
#                     case_id
#                 ))
#                 result = cur.fetchone()
#                 conn.commit()
                
#                 if not result:
#                     raise HTTPException(status_code=404, detail="Test case not found")
                
#                 return {"id": str(result[0])}
#         finally:
#             pool.putconn(conn)
#     except HTTPException:
#         raise
#     except Exception as e:
#         logger.error(f"Error updating test case: {str(e)}")
#         raise HTTPException(status_code=500, detail=str(e))

# @app.delete("/test-cases/{case_id}")
# async def delete_test_case(case_id: str):
#     """Delete a test case"""
#     try:
#         from app.services.storage.postgres_direct import get_postgres_pool
#         pool = get_postgres_pool()
        
#         if not pool:
#             raise HTTPException(status_code=404, detail="Test case not found")
        
#         conn = pool.getconn()
#         try:
#             with conn.cursor() as cur:
#                 cur.execute("DELETE FROM test_cases WHERE id = %s RETURNING id", (case_id,))
#                 result = cur.fetchone()
#                 conn.commit()
                
#                 if not result:
#                     raise HTTPException(status_code=404, detail="Test case not found")
                
#                 return {"status": "deleted", "id": str(result[0])}
#         finally:
#             pool.putconn(conn)
#     except HTTPException:
#         raise
#     except Exception as e:
#         logger.error(f"Error deleting test case: {str(e)}")
#         raise HTTPException(status_code=500, detail=str(e))
# """

# ============================================================================
# Test Runs CRUD - MOVED to routers/test_runs_api.py
# All endpoints below are COMMENTED OUT - now handled by router
# ============================================================================
# """
# OLD CODE - Now in routers/test_runs_api.py
# @app.get("/test-runs")
# async def get_test_runs(project_id: Optional[str] = None):
#     """Get all test runs"""
#     try:
#         org_id, proj_id = await ensure_default_org_project()
#         project_id = project_id or proj_id
        
#         from app.services.storage.postgres_direct import execute_query
        
#         pool = get_database_client()
#         if not pool or not hasattr(pool, 'getconn'):
#             return {"testRuns": []}
        
#         query = """
#             SELECT tr.id, tr.project_id, tr.name, tr.status, tr.environment,
#                    tr.started_at, tr.completed_at, tr.created_at,
#                    COUNT(trs.id) as step_count
#             FROM test_runs tr
#             LEFT JOIN test_run_steps trs ON tr.id = trs.run_id
#             WHERE tr.project_id = %s
#             GROUP BY tr.id
#             ORDER BY tr.created_at DESC
#         """
#         results = await execute_query(query, (project_id,))
        
#         test_runs = []
#         for row in results or []:
            # Map database status to frontend status
#             status_map = {
#                 "pending": "pending",
#                 "running": "running",
#                 "passed": "completed",
#                 "failed": "failed",
#                 "partial": "completed",
#                 "error": "failed",
#                 "cancelled": "failed"
#             }
            
#             test_runs.append({
#                 "id": str(row.get("id", "")),
#                 "name": row.get("name", ""),
#                 "status": status_map.get(row.get("status", "pending"), "pending"),
#                 "testCases": [],
#                 "results": [],
#                 "summary": {
#                     "passed": 0,
#                     "failed": 0,
#                     "skipped": 0,
#                     "duration": 0
#                 },
#                 "startTime": row.get("started_at"),
#                 "createdAt": row.get("created_at", "").isoformat() if hasattr(row.get("created_at"), 'isoformat') else str(row.get("created_at", "")),
#                 "completedAt": row.get("completed_at")
#             })
        
#         return {"testRuns": test_runs}
#     except Exception as e:
#         logger.error(f"Error getting test runs: {str(e)}")
#         raise HTTPException(status_code=500, detail=str(e))

# @app.get("/test-runs/{run_id}")
# async def get_test_run(run_id: str):
#     """Get a specific test run with details including test cases and steps"""
#     try:
#         from app.services.storage.postgres_direct import execute_query
#         import json
        
#         pool = get_database_client()
#         if not pool or not hasattr(pool, 'getconn'):
#             raise HTTPException(status_code=404, detail="Test run not found")
        
        # Get run details
#         run_query = """
#             SELECT id, project_id, plan_id, name, status, environment, branch, commit, started_at, completed_at, created_at
#             FROM test_runs 
#             WHERE id = %s
#         """
#         run_results = await execute_query(run_query, (run_id,))
        
#         if not run_results or len(run_results) == 0:
#             raise HTTPException(status_code=404, detail="Test run not found")
        
#         run = run_results[0]
        
        # Get ALL steps for this run first - this is the source of truth
#         all_steps_query = """
#             SELECT id, case_id, title, status, duration_ms, error_message,
#                    stdout, stderr, started_at, completed_at, created_at
#             FROM test_run_steps
#             WHERE run_id = %s OR run_id::text = %s
#             ORDER BY case_id, created_at
#         """
#         all_steps_results = await execute_query(all_steps_query, (run_id, str(run_id)))
#         print(f"[INFO] GET TEST RUN - Found {len(all_steps_results) if all_steps_results else 0} steps for run {run_id}")
        
        # Group steps by case_id
#         steps_by_case: Dict[str, List[Any]] = {}
#         if all_steps_results:
#             for step in all_steps_results:
#                 case_id = str(step.get("case_id", ""))
#                 if case_id:
#                     if case_id not in steps_by_case:
#                         steps_by_case[case_id] = []
#                     steps_by_case[case_id].append(step)
        
#         print(f"[INFO] GET TEST RUN - Grouped into {len(steps_by_case)} test cases")
        
        # Get unique case_ids
#         case_ids = list(steps_by_case.keys())
#         test_cases = []
        
        # Process each case_id
#         for case_id in case_ids:
#             tc_query = """
#                 SELECT id, title, description, priority, tags, steps, test_type
#                 FROM test_cases 
#                 WHERE id = %s
#             """
#             tc_results = await execute_query(tc_query, (case_id,))
            
            # Get steps for this case_id from our grouped steps
#             case_steps = steps_by_case.get(case_id, [])
#             case_steps.sort(key=lambda x: x.get("created_at") or "")
            
#             steps = []
#             if tc_results:
#                 tc = tc_results[0]
                # Parse steps JSON if it's stored as JSONB
#                 steps = tc.get("steps", [])
#                 if isinstance(steps, str):
#                     try:
#                         steps = json.loads(steps)
#                     except:
#                         steps = []
            
            # If no steps from test_cases, create steps from test_run_steps
#             if not steps or len(steps) == 0:
#                 if case_steps:
#                     for idx, run_step in enumerate(case_steps):
                        # Extract action from title (format: "Test Name - Step N: {action}")
#                         title = run_step.get("title", "")
                        # Parse title to extract action
                        # Format: "Test Name - Step N: {action}" or variations
#                         if ": " in title:
                            # Has colon separator, extract everything after ": "
#                             action = title.split(": ", 1)[1]
#                         elif " - Step" in title:
                            # Has " - Step" but no colon, try to extract
#                             parts = title.split(" - Step")
#                             if len(parts) > 1:
                                # Remove step number part (e.g., " - Step 1")
#                                 step_part = parts[1]
                                # Try to extract just the action if there's more text
#                                 if step_part.strip().startswith(tuple("0123456789")):
                                    # Step number at start, use test name
#                                     action = parts[0]
#                                 else:
#                                     action = step_part.strip()
#                             else:
#                                 action = title
#                         else:
#                             action = title
                        
#                         steps.append({
#                             "action": action,
#                             "expectedResult": f"Step {idx + 1} should complete successfully",
#                             "expected": f"Step {idx + 1} should complete successfully"
#                         })
            
            # If still no steps, create placeholder
#             if not steps or len(steps) == 0:
#                 steps = [{
#                     "action": "Test step not defined",
#                     "expectedResult": "Step should be executed",
#                     "expected": "Step should be executed"
#                 }]
            
#             if tc_results:
#                 tc = tc_results[0]
                # Map priority from database format
#                 priority_map = {"P0": "critical", "P1": "high", "P2": "medium", "P3": "low"}
#                 db_priority = tc.get("priority", "P2")
#                 priority = priority_map.get(db_priority, "medium")
                
#                 test_cases.append({
#                     "id": str(tc.get("id", "")),
#                     "name": tc.get("title", ""),
#                     "description": tc.get("description", ""),
#                     "priority": priority,
#                     "tags": tc.get("tags", []) or [],
#                     "steps": steps,
#                     "testType": tc.get("test_type", "manual"),
#                     "complexity": "medium"
#                 })
#             else:
                # Test case doesn't exist in test_cases table, create from test_run_steps
#                 if case_steps:
                    # Get first step to get test case name
#                     first_step = case_steps[0]
#                     test_name = first_step.get("title", "").split(" - Step")[0] if " - Step" in first_step.get("title", "") else "Test Case"
                    
#                     test_cases.append({
#                         "id": case_id,
#                         "name": test_name,
#                         "description": f"Test case from run {run_id}",
#                         "priority": "medium",
#                         "tags": [],
#                         "steps": steps,
#                         "testType": "manual",
#                         "complexity": "medium"
#                     })
        
        # Organize step results by case_id and step_index for execution tracking
        # Use the steps we already fetched
#         step_results: Dict[str, Dict[int, Any]] = {}
        
        # Process each case's steps in order
#         for case_id, steps_list in steps_by_case.items():
#             if case_id not in step_results:
#                 step_results[case_id] = {}
            
            # Sort steps by created_at to maintain order
#             steps_list.sort(key=lambda x: x.get("created_at") or "")
            
            # Assign step_index based on order (0-based)
#             for step_index, step in enumerate(steps_list):
                # Get artifacts (screenshots) for this step
#                 artifacts_query = """
#                     SELECT id, url, type, metadata
#                     FROM artifacts
#                     WHERE step_id = %s
#                     ORDER BY created_at
#                 """
#                 artifacts_results = await execute_query(artifacts_query, (step.get("id"),))
#                 screenshots = []
#                 for artifact in artifacts_results or []:
#                     screenshots.append({
#                         "url": artifact.get("url", ""),
#                         "metadata": artifact.get("metadata", {})
#                     })
                
                # Get defects linked to this step
#                 defects_query = """
#                     SELECT id, title, priority, status, description
#                     FROM defects
#                     WHERE step_id = %s
#                 """
#                 defects_results = await execute_query(defects_query, (step.get("id"),))
#                 defects = []
#                 for defect in defects_results or []:
#                     priority_map = {"P0": "critical", "P1": "high", "P2": "medium", "P3": "low"}
#                     db_priority = defect.get("priority", "P2")
#                     priority = priority_map.get(db_priority, "medium")
#                     defects.append({
#                         "id": str(defect.get("id", "")),
#                         "title": defect.get("title", ""),
#                         "priority": priority,
#                         "status": defect.get("status", "open"),
#                         "description": defect.get("description", "")
#                     })
                
#                 step_id = str(step.get("id", ""))
#                 step_results[case_id][step_index] = {
#                     "step_id": step_id,
#                     "status": step.get("status", "pending"),
#                     "duration_ms": step.get("duration_ms", 0) or 0,
#                     "error_message": step.get("error_message", ""),
#                     "screenshots": screenshots,
#                     "defects": defects
#                 }
#                 logger.debug(f"Mapped step: case_id={case_id}, step_index={step_index}, step_id={step_id}")
        
        # Get global artifacts (screenshots not linked to a specific step)
#         global_artifacts_query = """
#             SELECT id, url, type, metadata
#             FROM artifacts
#             WHERE run_id = %s AND step_id IS NULL
#             ORDER BY created_at
#         """
#         global_artifacts_results = await execute_query(global_artifacts_query, (run_id,))
#         global_screenshots = []
#         for artifact in global_artifacts_results or []:
#             global_screenshots.append({
#                 "url": artifact.get("url", ""),
#                 "metadata": artifact.get("metadata", {})
#             })
        
        # Get global defects (linked to run but not a specific step)
#         global_defects_query = """
#             SELECT id, title, priority, status, description
#             FROM defects
#             WHERE run_id = %s AND step_id IS NULL
#         """
#         global_defects_results = await execute_query(global_defects_query, (run_id,))
#         global_defects = []
#         for defect in global_defects_results or []:
#             priority_map = {"P0": "critical", "P1": "high", "P2": "medium", "P3": "low"}
#             db_priority = defect.get("priority", "P2")
#             priority = priority_map.get(db_priority, "medium")
#             global_defects.append({
#                 "id": str(defect.get("id", "")),
#                 "title": defect.get("title", ""),
#                 "priority": priority,
#                 "status": defect.get("status", "open"),
#                 "description": defect.get("description", "")
#             })
        
        # Calculate test case statuses based on step results
#         test_case_statuses: Dict[str, str] = {}
#         for case_id, steps_dict in step_results.items():
#             all_pending = True
#             any_failed = False
#             all_passed = True
            
#             for step_index, step_data in steps_dict.items():
#                 step_status = step_data.get("status", "pending")
#                 if step_status != "pending":
#                     all_pending = False
#                 if step_status == "failed":
#                     any_failed = True
#                     all_passed = False
#                 elif step_status == "passed":
#                     all_passed = all_passed and True
            
#             if all_pending:
#                 test_case_statuses[case_id] = "pending"
#             elif any_failed:
#                 test_case_statuses[case_id] = "failed"
#             elif all_passed:
#                 test_case_statuses[case_id] = "passed"
#             else:
#                 test_case_statuses[case_id] = "executing"
        
        # Calculate summary
#         summary = {"passed": 0, "failed": 0, "skipped": 0, "duration": 0, "total": 0}
#         for case_id, steps in step_results.items():
#             for step_index, step_data in steps.items():
#                 summary["total"] += 1
#                 status = step_data.get("status", "pending")
#                 if status == "passed":
#                     summary["passed"] += 1
#                 elif status == "failed":
#                     summary["failed"] += 1
#                 elif status == "skipped":
#                     summary["skipped"] += 1
#                 summary["duration"] += step_data.get("duration_ms", 0) or 0
        
        # Map database status to frontend status
        # Frontend uses "executing" for manual testing, backend uses "running"
#         db_status = run.get("status", "pending")
#         if db_status == "running":
#             frontend_status = "executing"
#         elif db_status == "passed":
#             frontend_status = "completed"
#         elif db_status in ["failed", "error", "cancelled"]:
#             frontend_status = "failed"
#         else:
#             frontend_status = db_status
        
#         return {
#             "id": str(run.get("id", "")),
#             "name": run.get("name", ""),
#             "status": frontend_status,
#             "planId": str(run.get("plan_id", "")) if run.get("plan_id") else None,
#             "environment": run.get("environment", "local"),
#             "branch": run.get("branch"),
#             "commit": run.get("commit"),
#             "testCases": test_cases,
#             "stepResults": step_results,
#             "testCaseStatuses": test_case_statuses,
#             "summary": summary,
#             "globalScreenshots": global_screenshots,
#             "globalDefects": global_defects,
#             "started_at": run.get("started_at"),
#             "completed_at": run.get("completed_at"),
#             "startTime": run.get("started_at"),
#             "createdAt": str(run.get("created_at", "")),
#             "completedAt": run.get("completed_at")
#         }
#     except HTTPException:
#         raise
#     except Exception as e:
#         logger.error(f"Error getting test run: {str(e)}")
#         raise HTTPException(status_code=500, detail=str(e))

# @app.post("/test-runs")
# async def create_test_run(request: Request):
#     """Create a new test run with test cases"""
#     try:
#         org_id, project_id = await ensure_default_org_project()
        
#         data = await request.json()
#         print(f"[INFO] CREATE TEST RUN - Received data keys: {list(data.keys())}")
        
#         from app.services.storage.postgres_direct import execute_insert, execute_query
#         from app.services.storage.test_results_storage import store_test_run_step
        
#         pool = get_database_client()
#         if not pool or not hasattr(pool, 'getconn'):
#             print("[WARN] No database pool, returning mock ID")
#             return {"id": f"run_{int(time.time())}"}
        
#         run_data = {
#             "project_id": project_id,
#             "name": data.get("name", f"Test Run {datetime.utcnow().isoformat()}"),
#             "status": "pending",
#             "environment": data.get("environment", "local"),
#             "plan_id": data.get("planId"),
#             "created_by": DEFAULT_USER_ID
#         }
        
#         run_id = await execute_insert("test_runs", run_data)
#         print(f"✅ Created test run with ID: {run_id}")
#         if not run_id:
#             raise HTTPException(status_code=500, detail="Failed to create test run")
        
        # Support both old format (testCases array) and new format (test_case_ids array)
#         test_case_ids = data.get("test_case_ids", [])
#         test_cases = data.get("testCases", [])
        
        # If test_case_ids provided, fetch test cases from database
#         if test_case_ids and len(test_case_ids) > 0:
#             print(f"[INFO] CREATE TEST RUN - Using test_case_ids: {len(test_case_ids)} IDs provided")
            # Fetch test cases from database
#             test_cases = []
#             for case_id in test_case_ids:
#                 tc_query = """
#                     SELECT id, title, description, priority, tags, steps, test_type
#                     FROM test_cases 
#                     WHERE id = %s
#                 """
#                 tc_results = await execute_query(tc_query, (case_id,))
#                 if tc_results:
#                     tc = tc_results[0]
                    # Parse steps JSON if needed
#                     steps = tc.get("steps", [])
#                     if isinstance(steps, str):
#                         try:
#                             import json
#                             steps = json.loads(steps)
#                         except:
#                             steps = []
                    
#                     test_cases.append({
#                         "id": str(tc.get("id", "")),
#                         "title": tc.get("title", ""),
#                         "name": tc.get("title", ""),
#                         "description": tc.get("description", ""),
#                         "priority": tc.get("priority", "P2"),
#                         "tags": tc.get("tags", []) or [],
#                         "steps": steps or []
#                     })
#                 else:
#                     logger.warning(f"Test case {case_id} not found in database, skipping")
        
#         print(f"[INFO] CREATE TEST RUN - Processing {len(test_cases)} test cases")
#         logger.info(f"Creating test run {run_id} with {len(test_cases)} test cases")
        
#         if test_cases:
#             print(f"[INFO] Processing {len(test_cases)} test cases")
#             for idx, test_case in enumerate(test_cases):
#                 print(f"[INFO] Test case {idx + 1}: {test_case}")
#                 case_id = test_case.get("id") or test_case.get("case_id")
#                 steps = test_case.get("steps", [])
                
#                 print(f"[INFO] Case ID: {case_id}, Steps count: {len(steps)}")
#                 logger.info(f"Processing test case {case_id} with {len(steps)} steps. Test case data: {test_case}")
                
                # If no case_id, generate one (must be valid UUID)
#                 if not case_id:
#                     case_id = str(uuid.uuid4())
#                     logger.warning(f"Test case missing ID, generated: {case_id}")
#                 else:
                    # Ensure case_id is a valid UUID format
#                     try:
#                         uuid.UUID(case_id)  # Validate it's a valid UUID
#                     except ValueError:
                        # If not a valid UUID, generate a new one
#                         logger.warning(f"Test case ID '{case_id}' is not a valid UUID, generating new one")
#                         case_id = str(uuid.uuid4())
                
                # If no steps provided, create a placeholder step
#                 if not steps or len(steps) == 0:
#                     logger.warning(f"No steps found for test case {case_id}, creating placeholder")
#                     steps = [{
#                         "action": "Execute test case",
#                         "expectedResult": "Test case should complete successfully",
#                         "expected": "Test case should complete successfully"
#                     }]
                
                # Always create test_run_steps entries (case_id is guaranteed now)
#                 for step_idx, step in enumerate(steps):
                    # Get step action and expected result
#                     step_action = step.get("action") or step.get("action") or "Execute step"
#                     step_expected = step.get("expectedResult") or step.get("expected") or "Step should complete"
                    
#                     test_case_name = test_case.get('title') or test_case.get('name') or 'Test'
#                     step_title = f"{test_case_name} - Step {step_idx + 1}: {step_action}"
                    
#                     try:
#                         print(f"[INFO] CALLING store_test_run_step: run_id={run_id}, case_id={case_id}, step={step_idx + 1}")
#                         step_id = await store_test_run_step(
#                             run_id=run_id,
#                             case_id=case_id,
#                             title=step_title,
#                             status="pending",
#                             duration_ms=0,
#                             error_message=None,
#                             stdout=None,
#                             stderr=None,
#                             started_at=None,
#                             completed_at=None
#                         )
#                         print(f"✅ store_test_run_step returned: step_id={step_id} for case {case_id}, step {step_idx + 1}")
#                         if step_id:
#                             print(f"✅ Created test_run_step for case {case_id}, step {step_idx + 1}: {step_title}")
#                             logger.info(f"✅ Created test_run_step for case {case_id}, step {step_idx + 1}: {step_title}")
#                         else:
#                             print(f"[ERROR] store_test_run_step returned None for case {case_id}, step {step_idx + 1}")
#                             logger.warning(f"store_test_run_step returned None for case {case_id}, step {step_idx + 1}")
#                     except Exception as e:
#                         print(f"[ERROR] ERROR creating test_run_step: {str(e)}")
#                         logger.error(f"[ERROR] Failed to create test_run_step for case {case_id}, step {step_idx + 1}: {str(e)}")
#                         raise
#         else:
#             print(f"[WARN] No test cases provided when creating test run {run_id}")
#             logger.warning(f"No test cases provided when creating test run {run_id}")
        
        # Verify steps were actually inserted
#         print(f"[INFO] VERIFY - Checking if steps were inserted for run_id: {run_id}")
#         verify_query = """
#             SELECT COUNT(*) as count FROM test_run_steps WHERE run_id = %s
#         """
#         from app.services.storage.postgres_direct import execute_query
#         verify_result = await execute_query(verify_query, (run_id,))
#         if verify_result:
#             count = verify_result[0].get("count", 0)
#             print(f"[INFO] VERIFY - Found {count} steps in database for run_id: {run_id}")
#             if count == 0:
#                 print(f"[ERROR] VERIFY - NO STEPS FOUND! This means insert failed or didn't commit")
#         else:
#             print(f"[ERROR] VERIFY - Query returned None")
        
#         return {"id": run_id}
#     except HTTPException:
#         raise
#     except Exception as e:
#         logger.error(f"Error creating test run: {str(e)}")
#         raise HTTPException(status_code=500, detail=str(e))

# @app.put("/test-runs/{run_id}")
# async def update_test_run(run_id: str, request: Request):
#     """Update a test run"""
#     try:
#         data = await request.json()
        
#         from app.services.storage.postgres_direct import get_postgres_pool
#         pool = get_postgres_pool()
        
#         if not pool:
#             raise HTTPException(status_code=404, detail="Test run not found")
        
        # Map frontend status to database status
#         status_map = {
#             "pending": "pending",
#             "running": "running",
#             "completed": "passed",
#             "failed": "failed"
#         }
        
#         conn = pool.getconn()
#         try:
#             with conn.cursor() as cur:
#                 update_query = """
#                     UPDATE test_runs 
#                     SET name = %s, status = %s, updated_at = NOW(),
#                         started_at = %s, completed_at = %s
#                     WHERE id = %s
#                     RETURNING id
#                 """
#                 cur.execute(update_query, (
#                     data.get("name", ""),
#                     status_map.get(data.get("status", "pending"), "pending"),
#                     data.get("startTime"),
#                     data.get("completedAt"),
#                     run_id
#                 ))
#                 result = cur.fetchone()
#                 conn.commit()
                
#                 if not result:
#                     raise HTTPException(status_code=404, detail="Test run not found")
                
#                 return {"id": str(result[0])}
#         finally:
#             pool.putconn(conn)
#     except HTTPException:
#         raise
#     except Exception as e:
#         logger.error(f"Error updating test run: {str(e)}")
#         raise HTTPException(status_code=500, detail=str(e))

# @app.post("/test-runs/{run_id}/start")
# async def start_test_run(run_id: str):
#     """Start a test run execution - change status from pending to running"""
#     try:
#         from app.services.storage.postgres_direct import get_postgres_pool
#         pool = get_postgres_pool()
        
#         if not pool:
#             raise HTTPException(status_code=404, detail="Test run not found")
        
#         conn = pool.getconn()
#         try:
#             with conn.cursor() as cur:
                # Update status to running and set started_at
#                 update_query = """
#                     UPDATE test_runs 
#                     SET status = 'running', started_at = NOW(), updated_at = NOW()
#                     WHERE id = %s AND status = 'pending'
#                     RETURNING id, status, started_at
#                 """
#                 cur.execute(update_query, (run_id,))
#                 result = cur.fetchone()
#                 conn.commit()
                
#                 if not result:
#                     raise HTTPException(status_code=404, detail="Test run not found or already started")
                
#                 return {
#                     "id": str(result[0]),
#                     "status": result[1],
#                     "started_at": str(result[2])
#                 }
#         finally:
#             pool.putconn(conn)
#     except HTTPException:
#         raise
#     except Exception as e:
#         logger.error(f"Error starting test run: {str(e)}")
#         raise HTTPException(status_code=500, detail=str(e))

# @app.post("/test-runs/{run_id}/execute-selected")
# async def execute_selected_test_cases(run_id: str, request: Request):
#     """Execute selected test cases within a test run"""
#     try:
#         data = await request.json()
#         case_ids = data.get("case_ids", [])
        
#         if not case_ids or len(case_ids) == 0:
#             raise HTTPException(status_code=400, detail="No test case IDs provided")
        
        # Ensure test run is started
#         from app.services.storage.postgres_direct import get_postgres_pool, execute_query
#         pool = get_postgres_pool()
        
#         if not pool:
#             raise HTTPException(status_code=404, detail="Test run not found")
        
        # Check if run exists and start it if pending
#         run_query = "SELECT id, status FROM test_runs WHERE id = %s"
#         run_result = await execute_query(run_query, (run_id,))
#         if not run_result:
#             raise HTTPException(status_code=404, detail="Test run not found")
        
#         run_status = run_result[0].get("status")
#         if run_status == "pending":
            # Start the test run first
#             conn = pool.getconn()
#             try:
#                 with conn.cursor() as cur:
#                     update_query = """
#                         UPDATE test_runs 
#                         SET status = 'running', started_at = NOW(), updated_at = NOW()
#                         WHERE id = %s
#                     """
#                     cur.execute(update_query, (run_id,))
#                     conn.commit()
#             finally:
#                 pool.putconn(conn)
        
        # For now, just mark the selected test cases as ready for execution
        # In a full implementation, this would trigger actual test execution
        # For manual execution, the user will execute them individually
        
#         return {
#             "message": f"Selected {len(case_ids)} test case(s) ready for execution",
#             "case_ids": case_ids
#         }
#     except HTTPException:
#         raise
#     except Exception as e:
#         logger.error(f"Error executing selected test cases: {str(e)}")
#         raise HTTPException(status_code=500, detail=str(e))

# @app.post("/test-runs/{run_id}/steps/{step_id}/mark")
# async def mark_test_step(run_id: str, step_id: str, request: Request):
#     """Mark a test step as passed or failed"""
#     try:
#         data = await request.json()
#         status = data.get("status")  # "passed" or "failed"
#         error = data.get("error", "")
        
#         if status not in ["passed", "failed"]:
#             raise HTTPException(status_code=400, detail="Status must be 'passed' or 'failed'")
        
#         from app.services.storage.postgres_direct import get_postgres_pool
#         pool = get_postgres_pool()
        
#         if not pool:
#             raise HTTPException(status_code=404, detail="Test run not found")
        
#         conn = pool.getconn()
#         try:
#             with conn.cursor() as cur:
                # Update step status
#                 update_query = """
#                     UPDATE test_run_steps 
#                     SET status = %s, error_message = %s, completed_at = NOW()
#                     WHERE id = %s AND run_id = %s
#                     RETURNING id
#                 """
#                 cur.execute(update_query, (status, error, step_id, run_id))
#                 result = cur.fetchone()
                
#                 if not result:
                    # Log more details for debugging
#                     logger.error(f"Step not found: step_id={step_id}, run_id={run_id}")
                    # Check if step exists but with different run_id
#                     check_query = "SELECT id, run_id FROM test_run_steps WHERE id = %s"
#                     cur.execute(check_query, (step_id,))
#                     check_result = cur.fetchone()
#                     if check_result:
#                         logger.error(f"Step exists but with different run_id: {check_result[1]}")
#                     raise HTTPException(status_code=404, detail=f"Test step not found: step_id={step_id}, run_id={run_id}")
                
                # Check if all steps are completed and update run status
#                 all_steps_query = """
#                     SELECT COUNT(*) as total, 
#                            SUM(CASE WHEN status IN ('passed', 'failed') THEN 1 ELSE 0 END) as completed
#                     FROM test_run_steps
#                     WHERE run_id = %s
#                 """
#                 cur.execute(all_steps_query, (run_id,))
#                 stats = cur.fetchone()
                
#                 if stats and stats[0] > 0 and stats[1] == stats[0]:
                    # All steps completed, determine run status
#                     failed_count_query = """
#                         SELECT COUNT(*) FROM test_run_steps 
#                         WHERE run_id = %s AND status = 'failed'
#                     """
#                     cur.execute(failed_count_query, (run_id,))
#                     failed_count = cur.fetchone()[0]
                    
#                     run_status = "failed" if failed_count > 0 else "passed"
#                     update_run_query = """
#                         UPDATE test_runs 
#                         SET status = %s, completed_at = NOW()
#                         WHERE id = %s
#                     """
#                     cur.execute(update_run_query, (run_status, run_id))
                
#                 conn.commit()
#                 return {"id": str(result[0]), "status": status}
#         finally:
#             pool.putconn(conn)
#     except HTTPException:
#         raise
#     except Exception as e:
#         logger.error(f"Error marking test step: {str(e)}")
#         raise HTTPException(status_code=500, detail=str(e))

# @app.post("/test-runs/{run_id}/steps/{step_id}/screenshot")
# async def upload_step_screenshot(run_id: str, step_id: str, request: Request):
#     """Upload a screenshot for a specific test step"""
#     try:
#         data = await request.json()
#         image_base64 = data.get("image")
#         image_type = data.get("type", "image/png")
        
#         if not image_base64:
#             raise HTTPException(status_code=400, detail="Missing image data")
        
#         from app.services.storage.postgres_direct import get_postgres_pool
#         from app.services.storage.test_results_storage import store_artifact
#         import base64
        
#         pool = get_postgres_pool()
#         if not pool:
#             raise HTTPException(status_code=404, detail="Test run not found")
        
        # Decode base64 image
#         try:
#             image_bytes = base64.b64decode(image_base64)
#         except Exception as e:
#             raise HTTPException(status_code=400, detail=f"Invalid base64 image: {str(e)}")
        
        # Store as data URL (base64)
#         image_url = f"data:{image_type};base64,{image_base64}"
        
#         artifact_id = await store_artifact(
#             run_id=run_id,
#             step_id=step_id,
#             artifact_type="screenshot",
#             url=image_url,
#             size_bytes=len(image_bytes),
#             metadata={"type": image_type}
#         )
        
#         if not artifact_id:
#             raise HTTPException(status_code=500, detail="Failed to store screenshot")
        
#         return {"id": artifact_id, "url": image_url}
#     except HTTPException:
#         raise
#     except Exception as e:
#         logger.error(f"Error uploading step screenshot: {str(e)}")
#         raise HTTPException(status_code=500, detail=str(e))

# @app.post("/test-runs/{run_id}/screenshot")
# async def upload_run_screenshot(run_id: str, request: Request):
#     """Upload a global screenshot for a test run"""
#     try:
#         data = await request.json()
#         image_base64 = data.get("image")
#         image_type = data.get("type", "image/png")
        
#         if not image_base64:
#             raise HTTPException(status_code=400, detail="Missing image data")
        
#         from app.services.storage.postgres_direct import get_postgres_pool
#         from app.services.storage.test_results_storage import store_artifact
#         import base64
        
#         pool = get_postgres_pool()
#         if not pool:
#             raise HTTPException(status_code=404, detail="Test run not found")
        
        # Decode base64 image
#         try:
#             image_bytes = base64.b64decode(image_base64)
#         except Exception as e:
#             raise HTTPException(status_code=400, detail=f"Invalid base64 image: {str(e)}")
        
        # Store as data URL (base64)
#         image_url = f"data:{image_type};base64,{image_base64}"
        
#         artifact_id = await store_artifact(
#             run_id=run_id,
#             step_id=None,
#             artifact_type="screenshot",
#             url=image_url,
#             size_bytes=len(image_bytes),
#             metadata={"type": image_type, "global": True}
#         )
        
#         if not artifact_id:
#             raise HTTPException(status_code=500, detail="Failed to store screenshot")
        
#         return {"id": artifact_id, "url": image_url}
#     except HTTPException:
#         raise
#     except Exception as e:
#         logger.error(f"Error uploading run screenshot: {str(e)}")
#         raise HTTPException(status_code=500, detail=str(e))

# @app.post("/test-runs/{run_id}/steps/{step_id}/link-defect")
# async def link_defect_to_step(run_id: str, step_id: str, request: Request):
#     """Link an existing defect to a test step"""
#     try:
#         data = await request.json()
#         defect_id = data.get("defect_id")
        
#         if not defect_id:
#             raise HTTPException(status_code=400, detail="Missing defect_id")
        
#         from app.services.storage.postgres_direct import get_postgres_pool
#         pool = get_postgres_pool()
        
#         if not pool:
#             raise HTTPException(status_code=404, detail="Test run not found")
        
#         conn = pool.getconn()
#         try:
#             with conn.cursor() as cur:
                # Update defect to link it to the step
#                 update_query = """
#                     UPDATE defects 
#                     SET step_id = %s, run_id = %s, updated_at = NOW()
#                     WHERE id = %s
#                     RETURNING id
#                 """
#                 cur.execute(update_query, (step_id, run_id, defect_id))
#                 result = cur.fetchone()
                
#                 if not result:
#                     raise HTTPException(status_code=404, detail="Defect not found")
                
#                 conn.commit()
#                 return {"id": str(result[0]), "step_id": step_id, "run_id": run_id}
#         finally:
#             pool.putconn(conn)
#     except HTTPException:
#         raise
#     except Exception as e:
#         logger.error(f"Error linking defect to step: {str(e)}")
#         raise HTTPException(status_code=500, detail=str(e))

# @app.post("/test-runs/{run_id}/link-defect")
# async def link_defect_to_run(run_id: str, request: Request):
#     """Link an existing defect to a test run (global)"""
#     try:
#         data = await request.json()
#         defect_id = data.get("defect_id")
        
#         if not defect_id:
#             raise HTTPException(status_code=400, detail="Missing defect_id")
        
#         from app.services.storage.postgres_direct import get_postgres_pool
#         pool = get_postgres_pool()
        
#         if not pool:
#             raise HTTPException(status_code=404, detail="Test run not found")
        
#         conn = pool.getconn()
#         try:
#             with conn.cursor() as cur:
                # Update defect to link it to the run (without a specific step)
#                 update_query = """
#                     UPDATE defects 
#                     SET run_id = %s, updated_at = NOW()
#                     WHERE id = %s
#                     RETURNING id
#                 """
#                 cur.execute(update_query, (run_id, defect_id))
#                 result = cur.fetchone()
                
#                 if not result:
#                     raise HTTPException(status_code=404, detail="Defect not found")
                
#                 conn.commit()
#                 return {"id": str(result[0]), "run_id": run_id}
#         finally:
#             pool.putconn(conn)
#     except HTTPException:
#         raise
#     except Exception as e:
#         logger.error(f"Error linking defect to run: {str(e)}")
#         raise HTTPException(status_code=500, detail=str(e))

# @app.delete("/test-runs/{run_id}")
# async def delete_test_run(run_id: str):
#     """Delete a test run"""
#     try:
#         from app.services.storage.postgres_direct import get_postgres_pool
#         pool = get_postgres_pool()
        
#         if not pool:
#             raise HTTPException(status_code=404, detail="Test run not found")
        
#         conn = pool.getconn()
#         try:
#             with conn.cursor() as cur:
#                 cur.execute("DELETE FROM test_runs WHERE id = %s RETURNING id", (run_id,))
#                 result = cur.fetchone()
#                 conn.commit()
                
#                 if not result:
#                     raise HTTPException(status_code=404, detail="Test run not found")
                
#                 return {"status": "deleted", "id": str(result[0])}
#         finally:
#             pool.putconn(conn)
#     except HTTPException:
#         raise
#     except Exception as e:
#         logger.error(f"Error deleting test run: {str(e)}")
#         raise HTTPException(status_code=500, detail=str(e))

# Test Plans CRUD
# @app.get("/test-plans")
# async def get_test_plans(project_id: Optional[str] = None):
#     """Get all test plans"""
#     try:
#         org_id, proj_id = await ensure_default_org_project()
#         project_id = project_id or proj_id
        
#         from app.services.storage.postgres_direct import execute_query
        
#         pool = get_database_client()
#         if not pool or not hasattr(pool, 'getconn'):
#             return {"testPlans": []}
        
#         query = """
#             SELECT id, project_id, name, description, status, settings, created_at, updated_at
#             FROM test_plans 
#             WHERE project_id = %s
#             ORDER BY created_at DESC
#         """
#         results = await execute_query(query, (project_id,))
        
#         test_plans = []
#         for row in results or []:
#             test_plans.append({
#                 "id": str(row.get("id", "")),
#                 "name": row.get("name", ""),
#                 "description": row.get("description", ""),
#                 "status": row.get("status", "draft"),
#                 "testCases": [],
#                 "createdAt": str(row.get("created_at", "")),
#                 "updatedAt": str(row.get("updated_at", ""))
#             })
        
#         return {"testPlans": test_plans}
#     except Exception as e:
#         logger.error(f"Error getting test plans: {str(e)}")
#         raise HTTPException(status_code=500, detail=str(e))

# @app.post("/test-plans")
# async def create_test_plan(request: Request):
#     """Create a new test plan"""
#     try:
#         org_id, project_id = await ensure_default_org_project()
        
#         data = await request.json()
        
#         from app.services.storage.postgres_direct import execute_insert
        
#         pool = get_database_client()
#         if not pool or not hasattr(pool, 'getconn'):
#             return {"id": f"plan_{int(time.time())}"}
        
#         plan_data = {
#             "project_id": project_id,
#             "name": data.get("name", ""),
#             "description": data.get("description", ""),
#             "status": "draft",
#             "created_by": DEFAULT_USER_ID
#         }
        
#         plan_id = await execute_insert("test_plans", plan_data)
        
#         return {"id": plan_id or f"plan_{int(time.time())}"}
#     except Exception as e:
#         logger.error(f"Error creating test plan: {str(e)}")
#         raise HTTPException(status_code=500, detail=str(e))

# @app.put("/test-plans/{plan_id}")
# async def update_test_plan(plan_id: str, request: Request):
#     """Update a test plan"""
#     try:
#         data = await request.json()
        
#         from app.services.storage.postgres_direct import get_postgres_pool
#         pool = get_postgres_pool()
        
#         if not pool:
#             raise HTTPException(status_code=404, detail="Test plan not found")
        
#         conn = pool.getconn()
#         try:
#             with conn.cursor() as cur:
#                 update_query = """
#                     UPDATE test_plans 
#                     SET name = %s, description = %s, status = %s, updated_at = NOW()
#                     WHERE id = %s
#                     RETURNING id
#                 """
#                 cur.execute(update_query, (
#                     data.get("name", ""),
#                     data.get("description", ""),
#                     data.get("status", "draft"),
#                     plan_id
#                 ))
#                 result = cur.fetchone()
#                 conn.commit()
                
#                 if not result:
#                     raise HTTPException(status_code=404, detail="Test plan not found")
                
#                 return {"id": str(result[0])}
#         finally:
#             pool.putconn(conn)
#     except HTTPException:
#         raise
#     except Exception as e:
#         logger.error(f"Error updating test plan: {str(e)}")
#         raise HTTPException(status_code=500, detail=str(e))

# @app.delete("/test-plans/{plan_id}")
# async def delete_test_plan(plan_id: str):
#     """Delete a test plan"""
#     try:
#         from app.services.storage.postgres_direct import get_postgres_pool
#         pool = get_postgres_pool()
        
#         if not pool:
#             raise HTTPException(status_code=404, detail="Test plan not found")
        
#         conn = pool.getconn()
#         try:
#             with conn.cursor() as cur:
#                 cur.execute("DELETE FROM test_plans WHERE id = %s RETURNING id", (plan_id,))
#                 result = cur.fetchone()
#                 conn.commit()
                
#                 if not result:
#                     raise HTTPException(status_code=404, detail="Test plan not found")
                
#                 return {"status": "deleted", "id": str(result[0])}
#         finally:
#             pool.putconn(conn)
#     except HTTPException:
#         raise
#     except Exception as e:
#         logger.error(f"Error deleting test plan: {str(e)}")
#         raise HTTPException(status_code=500, detail=str(e))

# Defects CRUD
# @app.get("/defects")
# async def get_defects(project_id: Optional[str] = None):
#     """Get all defects"""
#     try:
#         org_id, proj_id = await ensure_default_org_project()
#         project_id = project_id or proj_id
        
#         from app.services.storage.postgres_direct import execute_query
        
#         pool = get_database_client()
#         if not pool or not hasattr(pool, 'getconn'):
#             return {"defects": []}
        
#         query = """
#             SELECT id, project_id, run_id, step_id, title, description, priority, status, 
#                    assigned_to, jira_id, created_by, created_at, updated_at
#             FROM defects
#             WHERE project_id = %s
#             ORDER BY created_at DESC
#         """
#         results = await execute_query(query, (project_id,))
        
#         defects = []
#         for row in results or []:
            # Map priority from database format to frontend format
#             priority_map = {"P0": "critical", "P1": "high", "P2": "medium", "P3": "low"}
#             db_priority = row.get("priority", "P2")
#             priority = priority_map.get(db_priority, "medium")
            
#             defects.append({
#                 "id": str(row.get("id", "")),
#                 "title": row.get("title", ""),
#                 "description": row.get("description", ""),
#                 "priority": priority,
#                 "severity": priority,  # Using priority as severity for now
#                 "status": row.get("status", "open"),
#                 "runId": str(row.get("run_id", "")) if row.get("run_id") else None,
#                 "stepId": str(row.get("step_id", "")) if row.get("step_id") else None,
#                 "assignedTo": str(row.get("assigned_to", "")) if row.get("assigned_to") else None,
#                 "jiraId": row.get("jira_id"),
#                 "createdAt": str(row.get("created_at", "")),
#                 "updatedAt": str(row.get("updated_at", ""))
#             })
        
#         return {"defects": defects}
#     except Exception as e:
#         logger.error(f"Error getting defects: {str(e)}")
#         return {"defects": []}

# @app.get("/defects/{defect_id}")
# async def get_defect(defect_id: str):
#     """Get a specific defect"""
#     try:
#         from app.services.storage.postgres_direct import execute_query
        
#         pool = get_database_client()
#         if not pool or not hasattr(pool, 'getconn'):
#             raise HTTPException(status_code=404, detail="Defect not found")
        
#         query = """
#             SELECT id, project_id, run_id, step_id, title, description, priority, status,
#                    assigned_to, jira_id, created_by, created_at, updated_at
#             FROM defects
#             WHERE id = %s
#         """
#         results = await execute_query(query, (defect_id,))
        
#         if not results or len(results) == 0:
#             raise HTTPException(status_code=404, detail="Defect not found")
        
#         row = results[0]
#         priority_map = {"P0": "critical", "P1": "high", "P2": "medium", "P3": "low"}
#         db_priority = row.get("priority", "P2")
#         priority = priority_map.get(db_priority, "medium")
        
#         return {
#             "id": str(row.get("id", "")),
#             "title": row.get("title", ""),
#             "description": row.get("description", ""),
#             "priority": priority,
#             "severity": priority,
#             "status": row.get("status", "open"),
#             "runId": str(row.get("run_id", "")) if row.get("run_id") else None,
#             "stepId": str(row.get("step_id", "")) if row.get("step_id") else None,
#             "assignedTo": str(row.get("assigned_to", "")) if row.get("assigned_to") else None,
#             "jiraId": row.get("jira_id"),
#             "createdAt": str(row.get("created_at", "")),
#             "updatedAt": str(row.get("updated_at", ""))
#         }
#     except HTTPException:
#         raise
#     except Exception as e:
#         logger.error(f"Error getting defect: {str(e)}")
#         raise HTTPException(status_code=500, detail=str(e))

# @app.post("/defects")
# async def create_defect(request: Request):
#     """Create a new defect"""
#     try:
#         org_id, project_id = await ensure_default_org_project()
        
#         data = await request.json()
        
        # Map frontend priority to database format
#         priority_map = {"low": "P3", "medium": "P2", "high": "P1", "critical": "P0"}
#         priority = priority_map.get(data.get("priority", "medium"), "P2")
        
#         from app.services.storage.postgres_direct import execute_insert
        
#         pool = get_database_client()
#         if not pool or not hasattr(pool, 'getconn'):
#             raise HTTPException(status_code=500, detail="Database connection not available")
        
#         defect_data = {
#             "project_id": project_id,
#             "title": data.get("title", ""),
#             "description": data.get("description", ""),
#             "priority": priority,
#             "status": data.get("status", "open"),
#             "run_id": data.get("runId"),
#             "step_id": data.get("stepId"),
#             "assigned_to": data.get("assignedTo"),
#             "jira_id": data.get("jiraId"),
#             "created_by": DEFAULT_USER_ID
#         }
        
#         defect_id = await execute_insert("defects", defect_data)
#         if not defect_id:
#             raise HTTPException(status_code=500, detail="Failed to create defect")
        
#         return {"id": defect_id}
#     except HTTPException:
#         raise
#     except Exception as e:
#         logger.error(f"Error creating defect: {str(e)}")
#         raise HTTPException(status_code=500, detail=str(e))

# @app.put("/defects/{defect_id}")
# async def update_defect(defect_id: str, request: Request):
#     """Update a defect"""
#     try:
#         data = await request.json()
        
#         from app.services.storage.postgres_direct import get_postgres_pool
#         pool = get_postgres_pool()
        
#         if not pool:
#             raise HTTPException(status_code=404, detail="Defect not found")
        
        # Map frontend priority to database format
#         priority_map = {"low": "P3", "medium": "P2", "high": "P1", "critical": "P0"}
#         priority = None
#         if "priority" in data:
#             priority = priority_map.get(data.get("priority", "medium"), "P2")
        
#         conn = pool.getconn()
#         try:
#             with conn.cursor() as cur:
                # Build update query dynamically
#                 update_fields = []
#                 update_values = []
                
#                 if "title" in data:
#                     update_fields.append("title = %s")
#                     update_values.append(data.get("title"))
                
#                 if "description" in data:
#                     update_fields.append("description = %s")
#                     update_values.append(data.get("description"))
                
#                 if priority:
#                     update_fields.append("priority = %s")
#                     update_values.append(priority)
                
#                 if "status" in data:
#                     update_fields.append("status = %s")
#                     update_values.append(data.get("status"))
                
#                 if "assignedTo" in data:
#                     update_fields.append("assigned_to = %s")
#                     update_values.append(data.get("assignedTo") or None)
                
#                 if "jiraId" in data:
#                     update_fields.append("jira_id = %s")
#                     update_values.append(data.get("jiraId"))
                
#                 if not update_fields:
#                     raise HTTPException(status_code=400, detail="No fields to update")
                
#                 update_fields.append("updated_at = NOW()")
#                 update_values.append(defect_id)
                
#                 update_query = f"""
#                     UPDATE defects 
#                     SET {", ".join(update_fields)}
#                     WHERE id = %s
#                     RETURNING id
#                 """
#                 cur.execute(update_query, tuple(update_values))
#                 result = cur.fetchone()
#                 conn.commit()
                
#                 if not result:
#                     raise HTTPException(status_code=404, detail="Defect not found")
                
#                 return {"id": str(result[0])}
#         finally:
#             pool.putconn(conn)
#     except HTTPException:
#         raise
#     except Exception as e:
#         logger.error(f"Error updating defect: {str(e)}")
#         raise HTTPException(status_code=500, detail=str(e))

# @app.delete("/defects/{defect_id}")
# async def delete_defect(defect_id: str):
#     """Delete a defect"""
#     try:
#         from app.services.storage.postgres_direct import get_postgres_pool
#         pool = get_postgres_pool()
        
#         if not pool:
#             raise HTTPException(status_code=404, detail="Defect not found")
        
#         conn = pool.getconn()
#         try:
#             with conn.cursor() as cur:
#                 cur.execute("DELETE FROM defects WHERE id = %s RETURNING id", (defect_id,))
#                 result = cur.fetchone()
#                 conn.commit()
                
#                 if not result:
#                     raise HTTPException(status_code=404, detail="Defect not found")
                
#                 return {"status": "deleted", "id": str(result[0])}
#         finally:
#             pool.putconn(conn)
#     except HTTPException:
#         raise
#     except Exception as e:
#         logger.error(f"Error deleting defect: {str(e)}")
#         raise HTTPException(status_code=500, detail=str(e))

# @app.get("/requirements")
# async def get_requirements(project_id: Optional[str] = None):
#     """Get all requirements"""
#     try:
#         org_id, proj_id = await ensure_default_org_project()
#         project_id = project_id or proj_id
        
#         from app.services.storage.postgres_direct import execute_query
        
#         pool = get_database_client()
#         if not pool or not hasattr(pool, 'getconn'):
#             return {"requirements": []}
        
#         query = """
#             SELECT id, project_id, source, source_ref, title, description, raw_payload, created_at
#             FROM requirements
#             WHERE project_id = %s
#             ORDER BY created_at DESC
#         """
#         results = await execute_query(query, (project_id,))
        
#         requirements = []
#         for row in results or []:
#             requirements.append({
#                 "id": str(row.get("id", "")),
#                 "title": row.get("title", ""),
#                 "description": row.get("description", ""),
#                 "source": row.get("source", ""),
#                 "source_ref": row.get("source_ref", ""),
#                 "created_at": str(row.get("created_at", ""))
#             })
        
#         return {"requirements": requirements}
#     except Exception as e:
#         logger.error(f"Error getting requirements: {str(e)}")
#         return {"requirements": []}

# @app.post("/requirements")
# async def create_requirement_endpoint(request: Request):
#     """Create a new requirement"""
#     try:
#         org_id, project_id = await ensure_default_org_project()
#         data = await request.json()
        
#         from app.services.storage.database import create_requirement
        
#         requirement_id = await create_requirement(
#             project_id=project_id,
#             source=data.get("source", "manual"),
#             title=data.get("title", ""),
#             description=data.get("description", ""),
#             source_ref=data.get("source_ref"),
#             raw_payload=data.get("raw_payload")
#         )
        
#         if not requirement_id:
#             raise HTTPException(status_code=500, detail="Failed to create requirement")
        
#         return {"id": requirement_id}
#     except HTTPException:
#         raise
#     except Exception as e:
#         logger.error(f"Error creating requirement: {str(e)}")
#         raise HTTPException(status_code=500, detail=str(e))

# @app.post("/requirements/convert-to-gherkin/{requirement_id}")
# async def convert_requirement_to_gherkin(requirement_id: str, request: Request):
#     """Convert a requirement to Gherkin format using LLM"""
#     try:
#         from app.services.storage.postgres_direct import execute_query, get_postgres_pool
        
        # Get the requirement
#         pool = get_postgres_pool()
#         if not pool:
#             raise HTTPException(status_code=500, detail="Database connection failed")
        
#         query = """
#             SELECT id, project_id, source, source_ref, title, description, raw_payload
#             FROM requirements 
#             WHERE id = %s
#         """
#         results = await execute_query(query, (requirement_id,))
        
#         if not results or len(results) == 0:
#             raise HTTPException(status_code=404, detail="Requirement not found")
        
#         req = results[0]
#         title = req.get("title", "")
#         description = req.get("description", "")
#         source = req.get("source", "")
        
        # Create prompt for Gherkin generation
#         prompt = f"""You are an expert QA engineer specializing in Behavior-Driven Development (BDD) and Gherkin syntax.

# Convert the following requirement into a comprehensive Gherkin feature specification.

# Original Requirement:
# Title: {title}
# Source: {source}
# Description: {description}

# Create a detailed Gherkin feature file that includes:

# 1. Feature Header with "As a... I want to... So that..." format
# 2. Background section (if applicable)
# 3. Multiple Scenarios (3-5 scenarios):
#    - Happy path scenario
#    - Edge cases
#    - Error handling scenarios
#    - Alternative flows
# 4. Use proper Given-When-Then-And-But keywords
# 5. Scenario Outline with Examples table (if applicable)

# Return ONLY the Gherkin feature code. Do not include explanations or markdown formatting. Start with "Feature:" and provide complete scenarios.
# """
        
        # Use Ollama to generate Gherkin
#         from app.services.llm.ollama_service import ollama_service
#         import time
        
#         start_time = time.time()
#         try:
            # Try to get Gherkin directly
#             result = await ollama_service.generate(prompt, mode="heavy", validate_json=False)
#             gherkin_text = result.get("response", "")
            
            # Extract Gherkin from response
#             if "Feature:" in gherkin_text:
                # Find the start of Feature
#                 feature_idx = gherkin_text.find("Feature:")
#                 gherkin = gherkin_text[feature_idx:].strip()
                
                # Clean up any markdown code blocks
#                 if "```" in gherkin:
#                     parts = gherkin.split("```")
#                     for part in parts:
#                         if "Feature:" in part:
#                             gherkin = part.strip()
#                             break
#             else:
                # Fallback: create basic Gherkin
#                 gherkin = f"""Feature: {title}
#   As a user
#   I want to {description.lower()}
#   So that I can efficiently accomplish my task

#   Background:
#     Given I am on the {source} application
#     And I have valid access credentials

#   Scenario: Successful {title}
#     Given I am on the {source} application
#     When I perform the action: {description}
#     Then I should see the expected result
#     And the operation should complete successfully

#   Scenario: Error handling for {title}
#     Given I am on the {source} application
#     When I perform the action with invalid data
#     Then I should see an appropriate error message
#     And the system should handle the error gracefully
# """
#         except Exception as e:
#             logger.error(f"Error generating Gherkin: {str(e)}")
            # Fallback to basic Gherkin
#             gherkin = f"""Feature: {title}
#   As a user
#   I want to {description.lower()}
#   So that I can efficiently accomplish my task

#   Background:
#     Given I am on the {source} application
#     And I have valid access credentials

#   Scenario: Successful {title}
#     Given I am on the {source} application
#     When I perform the action: {description}
#     Then I should see the expected result
#     And the operation should complete successfully

#   Scenario: Error handling for {title}
#     Given I am on the {source} application
#     When I perform the action with invalid data
#     Then I should see an appropriate error message
#     And the system should handle the error gracefully
# """
        
        # Update the requirement with Gherkin description
#         pool = get_postgres_pool()
#         if pool:
#             conn = pool.getconn()
#             try:
#                 with conn.cursor() as cur:
#                     update_query = """
#                         UPDATE requirements 
#                         SET description = %s, updated_at = NOW()
#                         WHERE id = %s
#                         RETURNING id
#                     """
#                     cur.execute(update_query, (gherkin, requirement_id))
#                     result = cur.fetchone()
#                     conn.commit()
                    
#                     if result:
#                         return {
#                             "id": str(result[0]),
#                             "gherkin": gherkin,
#                             "status": "success"
#                         }
#             finally:
#                 pool.putconn(conn)
        
#         return {
#             "id": requirement_id,
#             "gherkin": gherkin,
#             "status": "generated"
#         }
        
#     except HTTPException:
#         raise
#     except Exception as e:
#         logger.error(f"Error converting requirement to Gherkin: {str(e)}")
#         raise HTTPException(status_code=500, detail=str(e))

# @app.get("/requirements/{requirement_id}")
# async def get_requirement(requirement_id: str):
#     """Get a specific requirement"""
#     try:
#         from app.services.storage.postgres_direct import execute_query
        
#         pool = get_database_client()
#         if not pool or not hasattr(pool, 'getconn'):
#             raise HTTPException(status_code=404, detail="Requirement not found")
        
#         query = """
#             SELECT id, project_id, source, source_ref, title, description, raw_payload, created_at
#             FROM requirements 
#             WHERE id = %s
#         """
#         results = await execute_query(query, (requirement_id,))
        
#         if not results or len(results) == 0:
#             raise HTTPException(status_code=404, detail="Requirement not found")
        
#         row = results[0]
#         return {
#             "id": str(row.get("id", "")),
#             "title": row.get("title", ""),
#             "description": row.get("description", ""),
#             "source": row.get("source", ""),
#             "source_ref": row.get("source_ref", ""),
#             "created_at": str(row.get("created_at", ""))
#         }
#     except HTTPException:
#         raise
#     except Exception as e:
#         logger.error(f"Error getting requirement: {str(e)}")
#         raise HTTPException(status_code=500, detail=str(e))

# @app.put("/requirements/{requirement_id}")
# async def update_requirement(requirement_id: str, request: Request):
#     """Update a requirement"""
#     try:
#         org_id, project_id = await ensure_default_org_project()
#         data = await request.json()
        
#         from app.services.storage.postgres_direct import get_postgres_pool
        
#         pool = get_postgres_pool()
#         if not pool:
#             raise HTTPException(status_code=500, detail="Database connection failed")
        
#         conn = pool.getconn()
#         try:
#             with conn.cursor() as cur:
                # Only update fields that are provided (not None)
#                 update_fields = []
#                 update_values = []
                
#                 if data.get("title") is not None:
#                     update_fields.append("title = %s")
#                     update_values.append(data.get("title", ""))
                
#                 if data.get("description") is not None:
#                     update_fields.append("description = %s")
#                     update_values.append(data.get("description", ""))
                
#                 if data.get("source") is not None:
#                     update_fields.append("source = %s")
#                     update_values.append(data.get("source", "manual"))
                
#                 if data.get("source_ref") is not None:
#                     update_fields.append("source_ref = %s")
#                     update_values.append(data.get("source_ref"))
                
#                 if not update_fields:
#                     raise HTTPException(status_code=400, detail="No fields to update")
                
#                 update_fields.append("updated_at = NOW()")
#                 update_values.append(requirement_id)
                
#                 update_query = f"""
#                     UPDATE requirements 
#                     SET {", ".join(update_fields)}
#                     WHERE id = %s
#                     RETURNING id
#                 """
#                 cur.execute(update_query, tuple(update_values))
#                 result = cur.fetchone()
#                 conn.commit()
                
#                 if not result:
#                     raise HTTPException(status_code=404, detail="Requirement not found")
                
#                 return {"id": str(result[0])}
#         finally:
#             pool.putconn(conn)
#     except HTTPException:
#         raise
#     except Exception as e:
#         logger.error(f"Error updating requirement: {str(e)}")
#         raise HTTPException(status_code=500, detail=str(e))

# @app.get("/traceability")
# async def get_traceability_matrix(project_id: Optional[str] = None):
#     """Get complete traceability matrix: Requirements → Test Cases → Test Runs → Defects"""
#     try:
#         org_id, proj_id = await ensure_default_org_project()
#         project_id = project_id or proj_id
        
#         from app.services.storage.postgres_direct import execute_query
        
#         pool = get_database_client()
#         if not pool or not hasattr(pool, 'getconn'):
#             return {"traceability": []}
        
        # Get requirements with linked test cases, test runs, and defects
#         query = """
#             SELECT 
#                 r.id as requirement_id,
#                 r.title as requirement_title,
#                 r.source,
#                 r.source_ref,
#                 tc.id as test_case_id,
#                 tc.title as test_case_title,
#                 tc.status as test_case_status,
#                 tc.priority as test_case_priority,
#                 tr.id as test_run_id,
#                 tr.name as test_run_name,
#                 tr.status as test_run_status,
#                 d.id as defect_id,
#                 d.title as defect_title,
#                 d.status as defect_status
#             FROM requirements r
#             LEFT JOIN test_case_requirements tcr ON r.id = tcr.requirement_id
#             LEFT JOIN test_cases tc ON tcr.test_case_id = tc.id
#             LEFT JOIN test_runs tr ON tr.plan_id = (SELECT plan_id FROM test_cases WHERE id = tc.id LIMIT 1)
#             LEFT JOIN defects d ON (d.run_id = tr.id OR d.step_id IN (SELECT id FROM test_run_steps WHERE run_id = tr.id))
#             WHERE r.project_id = %s
#             ORDER BY r.created_at DESC, tc.created_at
#         """
#         results = await execute_query(query, (project_id,))
        
        # Organize by requirement
#         traceability: Dict[str, Any] = {}
#         for row in results or []:
#             req_id = str(row.get("requirement_id", ""))
#             if req_id not in traceability:
#                 traceability[req_id] = {
#                     "requirement": {
#                         "id": req_id,
#                         "title": row.get("requirement_title", ""),
#                         "source": row.get("source", ""),
#                         "source_ref": row.get("source_ref", "")
#                     },
#                     "test_cases": [],
#                     "test_runs": [],
#                     "defects": []
#                 }
            
            # Add test case if exists
#             if row.get("test_case_id") and not any(tc["id"] == str(row.get("test_case_id")) for tc in traceability[req_id]["test_cases"]):
#                 traceability[req_id]["test_cases"].append({
#                     "id": str(row.get("test_case_id", "")),
#                     "title": row.get("test_case_title", ""),
#                     "status": row.get("test_case_status", ""),
#                     "priority": row.get("test_case_priority", "")
#                 })
            
            # Add test run if exists
#             if row.get("test_run_id") and not any(tr["id"] == str(row.get("test_run_id")) for tr in traceability[req_id]["test_runs"]):
#                 traceability[req_id]["test_runs"].append({
#                     "id": str(row.get("test_run_id", "")),
#                     "name": row.get("test_run_name", ""),
#                     "status": row.get("test_run_status", "")
#                 })
            
            # Add defect if exists
#             if row.get("defect_id") and not any(d["id"] == str(row.get("defect_id")) for d in traceability[req_id]["defects"]):
#                 traceability[req_id]["defects"].append({
#                     "id": str(row.get("defect_id", "")),
#                     "title": row.get("defect_title", ""),
#                     "status": row.get("defect_status", "")
#                 })
        
#         return {"traceability": list(traceability.values())}
#     except Exception as e:
#         logger.error(f"Error getting traceability: {str(e)}")
#         return {"traceability": []}

# @app.post("/test-runs/{run_id}/comments")
# async def add_test_run_comment(run_id: str, request: Request):
#     """Add a comment to a test run, test case, or step"""
#     try:
#         org_id, project_id = await ensure_default_org_project()
#         data = await request.json()
        
#         comment_text = data.get("comment", "")
#         case_id = data.get("case_id")
#         step_id = data.get("step_id")
        
#         if not comment_text:
#             raise HTTPException(status_code=400, detail="Comment text is required")
        
#         from app.services.storage.postgres_direct import execute_insert
        
#         comment_data = {
#             "project_id": project_id,
#             "run_id": run_id,
#             "case_id": case_id,
#             "step_id": step_id,
#             "comment": comment_text,
#             "created_by": DEFAULT_USER_ID
#         }
        
#         comment_id = await execute_insert("test_comments", comment_data)
#         if not comment_id:
#             raise HTTPException(status_code=500, detail="Failed to create comment")
        
#         return {"id": comment_id}
#     except HTTPException:
#         raise
#     except Exception as e:
#         logger.error(f"Error adding comment: {str(e)}")
#         raise HTTPException(status_code=500, detail=str(e))

# @app.get("/test-runs/{run_id}/comments")
# async def get_test_run_comments(run_id: str, case_id: Optional[str] = None, step_id: Optional[str] = None):
#     """Get comments for a test run, optionally filtered by case or step"""
#     try:
#         from app.services.storage.postgres_direct import execute_query
        
#         pool = get_database_client()
#         if not pool or not hasattr(pool, 'getconn'):
#             return {"comments": []}
        
#         if step_id:
#             query = """
#                 SELECT id, case_id, step_id, comment, created_by, created_at, updated_at
#                 FROM test_comments
#                 WHERE run_id = %s AND step_id = %s
#                 ORDER BY created_at ASC
#             """
#             params = (run_id, step_id)
#         elif case_id:
#             query = """
#                 SELECT id, case_id, step_id, comment, created_by, created_at, updated_at
#                 FROM test_comments
#                 WHERE run_id = %s AND case_id = %s
#                 ORDER BY created_at ASC
#             """
#             params = (run_id, case_id)
#         else:
#             query = """
#                 SELECT id, case_id, step_id, comment, created_by, created_at, updated_at
#                 FROM test_comments
#                 WHERE run_id = %s
#                 ORDER BY created_at ASC
#             """
#             params = (run_id,)
        
#         results = await execute_query(query, params)
        
#         comments = []
#         for row in results or []:
#             comments.append({
#                 "id": str(row.get("id", "")),
#                 "case_id": str(row.get("case_id", "")) if row.get("case_id") else None,
#                 "step_id": str(row.get("step_id", "")) if row.get("step_id") else None,
#                 "comment": row.get("comment", ""),
#                 "created_by": str(row.get("created_by", "")),
#                 "created_at": str(row.get("created_at", "")),
#                 "updated_at": str(row.get("updated_at", ""))
#             })
        
#         return {"comments": comments}
#     except Exception as e:
#         logger.error(f"Error getting comments: {str(e)}")
#         return {"comments": []}

# OLD CODE - Now in routers/test_cases_crud_api.py
# """
# @app.post("/test-cases/{case_id}/link-requirement")
# async def link_test_case_to_requirement(case_id: str, request: Request):
#     """Link a test case to a requirement"""
#     try:
#         org_id, project_id = await ensure_default_org_project()
#         data = await request.json()
#         requirement_id = data.get("requirement_id")
        
#         if not requirement_id:
#             raise HTTPException(status_code=400, detail="requirement_id is required")
        
#         from app.services.storage.postgres_direct import execute_insert
        
#         link_data = {
#             "test_case_id": case_id,
#             "requirement_id": requirement_id
#         }
        
#         link_id = await execute_insert("test_case_requirements", link_data)
#         if not link_id:
#             raise HTTPException(status_code=500, detail="Failed to link requirement")
        
#         return {"id": link_id}
#     except HTTPException:
#         raise
#     except Exception as e:
#         logger.error(f"Error linking requirement: {str(e)}")
#         raise HTTPException(status_code=500, detail=str(e))

# @app.post("/integrations/jira/webhook")
# async def jira_webhook(request: Request):
#     """Receive Jira issue updates (status, assignee, comments)"""
#     try:
        # Get the webhook payload
#         payload = await request.json()
        
        # TODO: Process Jira webhook
        # For now, just acknowledge receipt
        
#         return {"status": "acknowledged"}
        
#     except Exception as e:
#         print(f"Error processing Jira webhook: {str(e)}")
#         raise HTTPException(
#             status_code=500,
#             detail=f"Failed to process webhook: {str(e)}"
#         )

# def map_priority(priority: str) -> str:
#     """Map internal priority to API format"""
#     priority_map = {
#         "critical": "P0",
#         "high": "P1", 
#         "medium": "P2",
#         "low": "P3"
#     }
#     return priority_map.get(priority, "P2")

# def estimate_tokens(text: str) -> int:
#     """Rough token estimation (4 chars per token)"""
#     return len(text) // 4

# def calculate_cost(prompt_tokens: int, completion_tokens: int) -> float:
#     """Calculate cost based on token usage"""
    # Mock pricing for development
#     prompt_cost_per_1k = 0.002
#     completion_cost_per_1k = 0.006
    
#     prompt_cost = (prompt_tokens / 1000) * prompt_cost_per_1k
#     completion_cost = (completion_tokens / 1000) * completion_cost_per_1k
    
#     return round(prompt_cost + completion_cost, 4)

# @app.post("/ai/generate-tests-enhanced")
# async def generate_tests_enhanced(request: Request, body: dict):
#     """
#     Enhanced test generation endpoint supporting all test types with optimization features.
#     Supports: manual, automation, api, performance, security, accessibility, database
    
#     New Features (UI Integration):
#     - Multiple test types in one request (testTypes: {ui, api, perf, a11y, security})
#     - Coverage levels (smoke, balanced, deep)
#     - Test plan output (scenarios, risk tags)
#     - Enhanced test case format with tags and automation code
    
#     Features:
#     - Retry logic with fixup prompts
#     - Deduplication
#     - Coverage hints
#     - All test types
#     - Overall timeout protection (max 10 minutes total)
#     """
#     import asyncio
#     import time
#     overall_start_time = time.time()
#     OVERALL_TIMEOUT = 600  # 10 minutes max for entire generation
    
#     try:
#         from app.services.llm.prompt.prompt_templates import (
#             PROMPT_REQ_TO_MANUAL_TESTS,
#             PROMPT_REQ_TO_AUTOMATION_TESTS,
#             PROMPT_REQ_TO_API_TESTS,
#             PROMPT_REQ_TO_PERFORMANCE_TESTS,
#             PROMPT_REQ_TO_SECURITY_TESTS,
#             PROMPT_REQ_TO_ACCESSIBILITY_TESTS,
#             PROMPT_REQ_TO_DATABASE_TESTS
#         )
#         from app.services.utils.test_generation_optimizer import (
#             extract_json_from_response,
#             is_valid_test_case_json,
#             deduplicate_test_cases,
#             check_coverage_hints,
#             add_coverage_hints_to_prompt,
#             retry_with_fixup_prompt,
#             validate_and_fix_test_cases
#         )
        
#         requirement = body.get("requirement", body.get("requirements", ""))
#         test_type = body.get("test_type", "manual").lower()
        
        # NEW: Support multiple test types from UI - Generate for ALL selected types
#         test_types = body.get("testTypes", {})
#         selected_types = []
#         if test_types:
            # If UI sends testTypes object, check which are enabled
#             selected_types = [t for t, enabled in test_types.items() if enabled]
        
        # NEW: Coverage level support
#         coverage = body.get("coverage", "balanced")  # smoke, balanced, deep
#         coverage_hint = ""
#         if coverage == "smoke":
#             coverage_hint = "Generate only critical smoke tests (3-5 tests max)"
#         elif coverage == "deep":
#             coverage_hint = "Generate comprehensive regression suite (10-15 tests)"
#         else:
#             coverage_hint = "Generate balanced test coverage (5-8 tests)"
        
        # Default to "quick" mode to use trained model (qa-expert:7b)
#         mode = body.get("mode", "quick")  # quick (7B trained), ui (14B), heavy (32B)
#         project_id = body.get("project_id", "default")
#         org_id = body.get("org_id", "default")
#         max_retries = body.get("max_retries", 2)
        
#         if not requirement:
#             raise HTTPException(status_code=400, detail="requirement is required")
        
        # Map UI test types to backend test types
#         type_mapping = {
#             "manual": "manual",
#             "ui": "automation",
#             "api": "api",
#             "perf": "performance",
#             "a11y": "accessibility",
#             "security": "security"
#         }
        
        # Select appropriate prompt template
#         prompt_templates = {
#             "manual": PROMPT_REQ_TO_MANUAL_TESTS,
#             "automation": PROMPT_REQ_TO_AUTOMATION_TESTS,
#             "api": PROMPT_REQ_TO_API_TESTS,
#             "performance": PROMPT_REQ_TO_PERFORMANCE_TESTS,
#             "perf": PROMPT_REQ_TO_PERFORMANCE_TESTS,
#             "security": PROMPT_REQ_TO_SECURITY_TESTS,
#             "accessibility": PROMPT_REQ_TO_ACCESSIBILITY_TESTS,
#             "a11y": PROMPT_REQ_TO_ACCESSIBILITY_TESTS,
#             "database": PROMPT_REQ_TO_DATABASE_TESTS,
#             "db": PROMPT_REQ_TO_DATABASE_TESTS
#         }
        
        # Generate test cases for ALL selected types (or default to manual)
#         all_test_cases = []
#         all_model_used = None
#         total_latency = 0
#         coverage_hints = []  # Initialize for return statement
        
#         types_to_generate = selected_types if selected_types else ["manual"]
        
        # Check overall timeout before starting
#         elapsed = time.time() - overall_start_time
#         if elapsed > OVERALL_TIMEOUT:
#             raise HTTPException(status_code=408, detail=f"Overall timeout exceeded ({OVERALL_TIMEOUT}s). Generation cancelled.")
        
#         logger.info(f"Starting generation for {len(types_to_generate)} test types: {types_to_generate}")
#         print(f"[INFO] Starting generation for {len(types_to_generate)} test types: {types_to_generate}")
        
#         for idx, ui_type in enumerate(types_to_generate):
            # Check timeout before each test type
#             elapsed = time.time() - overall_start_time
#             if elapsed > OVERALL_TIMEOUT:
#                 logger.warning(f"Overall timeout reached after {elapsed:.1f}s. Generated {len(all_test_cases)} test cases so far.")
#                 print(f"[WARN] Overall timeout reached. Stopping generation after {idx}/{len(types_to_generate)} types.")
#                 break
            
#             backend_type = type_mapping.get(ui_type, "manual")
#             base_prompt_template = prompt_templates.get(backend_type, PROMPT_REQ_TO_MANUAL_TESTS)
            
#             logger.info(f"[{idx+1}/{len(types_to_generate)}] Generating {backend_type} tests (UI type: {ui_type})")
#             print(f"[INFO] [{idx+1}/{len(types_to_generate)}] Generating {backend_type} tests (UI type: {ui_type})")
            
            # Check for existing test cases to get coverage hints
#             existing_tests = body.get("existing_tests", [])
#             if existing_tests and not coverage_hints:  # Only compute once
#                 coverage_hints = check_coverage_hints(requirement, existing_tests)
            
            # Build prompt with coverage hints
#             base_prompt = base_prompt_template.format(requirement=requirement)
#             prompt = add_coverage_hints_to_prompt(base_prompt, coverage_hints) if coverage_hints else base_prompt
            
            # NEW: Add coverage level hint to prompt
#             if coverage_hint:
#                 prompt = f"{prompt}\n\nCoverage Requirement: {coverage_hint}"
            
            # Generate with retry logic
#             start_time = time.time()
#             test_cases = []
#             last_error = None
            
#             for attempt in range(max_retries + 1):
#                 try:
#                     if attempt > 0:
                        # Use fixup prompt on retry
#                         prompt = retry_with_fixup_prompt(base_prompt, "json")
                    
                    # Check timeout before LLM call
#                     elapsed = time.time() - overall_start_time
#                     if elapsed > OVERALL_TIMEOUT:
#                         logger.warning(f"Timeout before LLM call for {backend_type}. Skipping.")
#                         break
                    
                    # Call LLM with timeout protection
#                     try:
#                         result = await asyncio.wait_for(
#                             ollama_service.generate(prompt, mode=mode, validate_json=False),
#                             timeout=min(300, OVERALL_TIMEOUT - elapsed)  # Max 5 min per type, or remaining time
#                         )
#                         llm_response = result.get("response", "")
#                         model_used = result.get("model", ollama_service._select_model(mode))
#                         all_model_used = model_used
#                     except asyncio.TimeoutError:
#                         logger.error(f"Timeout generating {backend_type} tests. Skipping to next type.")
#                         print(f"[ERROR] Timeout generating {backend_type} tests. Moving to next type.")
#                         last_error = f"Timeout generating {backend_type} tests"
#                         test_cases = []
#                         break
                    
                    # Extract JSON from response
#                     extracted = extract_json_from_response(llm_response)
                    
#                     if extracted and is_valid_test_case_json(extracted):
#                         test_cases = extracted
#                         break
#                     else:
#                         last_error = "Invalid JSON structure"
#                         if attempt < max_retries:
#                             continue
#                         else:
                            # Last attempt failed, try to extract what we can
#                             test_cases = extracted if extracted else []
                            
#                 except Exception as e:
#                     last_error = str(e)
#                     error_str = str(e).lower()
                    
                    # AUTO-FIX: If model not found, retry with qwen3-coder:30b
#                     if "model" in error_str and ("not found" in error_str or "404" in error_str):
#                         logger.warning(f"Model not found error: {e}. Retrying with qwen3-coder:30b")
#                         try:
                            # Force use qwen3-coder:30b directly
#                             result = await ollama_service.generate(
#                                 prompt, 
#                                 mode="heavy",  # Use heavy mode which maps to qwen3-coder:30b
#                                 validate_json=False
#                             )
#                             llm_response = result.get("response", "")
#                             model_used = "qwen3-coder:30b"  # Force model name
#                             all_model_used = model_used
                            
                            # Extract JSON from response
#                             extracted = extract_json_from_response(llm_response)
                            
#                             if extracted and is_valid_test_case_json(extracted):
#                                 test_cases = extracted
#                                 break
#                         except Exception as retry_error:
#                             logger.error(f"Retry with qwen3-coder:30b also failed: {retry_error}")
#                             last_error = f"Original: {e}, Retry: {retry_error}"
                    
#                     if attempt < max_retries:
#                         await asyncio.sleep(1)  # Brief delay before retry
#                         continue
#                     else:
#                         logger.warning(f"Failed to generate {backend_type} tests: {last_error}")
                        # Continue with other types even if one fails
#                         test_cases = []
            
#             latency_ms = int((time.time() - start_time) * 1000)
#             total_latency += latency_ms
            
#             logger.info(f"Generated {len(test_cases)} {backend_type} test cases in {latency_ms}ms")
#             print(f"[INFO] Generated {len(test_cases)} {backend_type} test cases in {latency_ms}ms")
            
            # Add test cases with type tag
#             for tc in test_cases:
#                 tc["_generated_type"] = backend_type  # Track which type generated this
#                 all_test_cases.append(tc)
        
        # Optimize generated test cases
#         if all_test_cases:
            # Validate and fix structure
#             all_test_cases = validate_and_fix_test_cases(all_test_cases)
            # Deduplicate
#             all_test_cases = deduplicate_test_cases(all_test_cases)
        
        # Store generation for fine-tuning
#         generation_id = await store_ai_generation(
#             project_id=project_id,
#             prompt=f"Multi-type generation: {', '.join(types_to_generate)}",
#             model=all_model_used or "unknown",
#             output=json.dumps(all_test_cases),
#             mode=mode,
#             endpoint="/ai/generate-tests-enhanced",
#             latency_ms=total_latency,
#             org_id=org_id,
#             task_category="multi-type"
#         )
        
        # NEW: Generate test plan (scenarios and risk tags)
#         test_plan = {
#             "scenarios": [
#                 f"Test {tc.get('name', tc.get('title', 'Unknown'))}" 
#                 for tc in all_test_cases[:5]  # Top 5 scenarios
#             ],
#             "riskTags": [
#                 f"P{idx % 3}" if idx < 3 else "P2" 
#                 for idx in range(min(len(all_test_cases), 5))
#             ]
#         }
        
        # NEW: Enhance test cases with tags and automation code
#         enhanced_test_cases = []
#         for tc in all_test_cases:
#             generated_type = tc.pop("_generated_type", "manual")  # Get and remove type tag
            
            # Convert all test types to steps format (some have different structures)
#             steps = tc.get("steps", [])
#             if not steps or len(steps) == 0:
#                 if generated_type == "performance":
                    # Convert performance test fields to steps
#                     desc = tc.get("description", "")
#                     if desc and not any(tc.get(k) for k in ['virtual_users', 'duration', 'ramp_up', 'expected_throughput']):
                        # If no structured fields but has description, create steps from description
#                         steps = [
#                             {
#                                 "action": f"Configure and execute performance test: {desc[:100]}",
#                                 "expectedResult": "Performance metrics meet expectations"
#                             }
#                         ]
#                     else:
                        # Use structured fields if available
#                         steps = [
#                             {
#                                 "action": f"Configure load test: {tc.get('virtual_users', 'N/A')} virtual users, {tc.get('duration', 'N/A')}s duration, {tc.get('ramp_up', 'N/A')}s ramp-up",
#                                 "expectedResult": f"Test configured successfully"
#                             },
#                             {
#                                 "action": f"Execute load test and monitor: throughput >= {tc.get('expected_throughput', 'N/A')} req/s, p95 latency <= {tc.get('expected_latency_p95', 'N/A')}ms",
#                                 "expectedResult": f"Performance metrics meet expectations, error rate <= {tc.get('expected_error_rate', 0.01) * 100}%"
#                             }
#                         ]
#                 elif generated_type == "accessibility":
                    # Convert accessibility test fields to steps
#                     desc = tc.get("description", "")
#                     if desc and not any(tc.get(k) for k in ['test_method', 'wcag_guideline', 'expected_result']):
                        # If no structured fields but has description, create steps from description
#                         steps = [
#                             {
#                                 "action": f"Execute accessibility test: {desc[:100]}",
#                                 "expectedResult": "Test passes WCAG compliance"
#                             }
#                         ]
#                     else:
                        # Use structured fields if available
#                         test_method = tc.get("test_method", "Execute accessibility test")
#                         expected_result = tc.get("expected_result", "Test passes WCAG compliance")
#                         wcag_guideline = tc.get("wcag_guideline", "")
                        
#                         steps = [
#                             {
#                                 "action": f"Test {wcag_guideline}: {test_method}" if wcag_guideline else test_method,
#                                 "expectedResult": expected_result
#                             }
#                         ]
#                 elif generated_type == "api":
                    # Convert API test fields to steps
#                     desc = tc.get("description", "")
#                     if desc and not any(tc.get(k) for k in ['method', 'endpoint', 'url', 'expected_status']):
                        # If no structured fields but has description, create steps from description
#                         steps = [
#                             {
#                                 "action": f"Execute API test: {desc[:100]}",
#                                 "expectedResult": "API responds correctly"
#                             }
#                         ]
#                     else:
                        # Use structured fields if available
#                         http_method = tc.get("method", "GET")
#                         endpoint = tc.get("endpoint", tc.get("url", "N/A"))
#                         expected_status = tc.get("expected_status", "200")
#                         request_body = tc.get("request_body", "")
#                         expected_response = tc.get("expected_response", "")
                        
#                         steps = [
#                             {
#                                 "action": f"Send {http_method} request to {endpoint}" + (f" with body: {request_body}" if request_body else ""),
#                                 "expectedResult": f"Response status is {expected_status}" + (f" and response matches: {expected_response}" if expected_response else "")
#                             }
#                         ]
#                         if tc.get("headers"):
#                             steps[0]["action"] = f"Set headers: {tc.get('headers')}, then {steps[0]['action']}"
#                 elif generated_type == "security":
                    # Convert security test fields to steps
#                     desc = tc.get("description", "")
#                     if desc and not any(tc.get(k) for k in ['vulnerability', 'attack_vector', 'expected_result']):
                        # If no structured fields but has description, create steps from description
#                         steps = [
#                             {
#                                 "action": f"Execute security test: {desc[:100]}",
#                                 "expectedResult": "Security controls prevent vulnerabilities"
#                             }
#                         ]
#                     else:
                        # Use structured fields if available
#                         vulnerability = tc.get("vulnerability", "Security vulnerability")
#                         attack_vector = tc.get("attack_vector", "Test security controls")
#                         expected_result = tc.get("expected_result", "Security controls prevent vulnerability")
                        
#                         steps = [
#                             {
#                                 "action": f"Test for {vulnerability}: {attack_vector}",
#                                 "expectedResult": expected_result
#                             }
#                         ]
#                 elif generated_type == "manual":
                    # Manual tests should have steps, but if missing, create from description
#                     if tc.get("description"):
#                         steps = [
#                             {
#                                 "action": f"Execute test: {tc.get('description', '')[:100]}",
#                                 "expectedResult": tc.get("expected", "Test completes successfully")
#                             }
#                         ]
#                     else:
                        # Last resort: create generic step
#                         steps = [
#                             {
#                                 "action": "Execute manual test case",
#                                 "expectedResult": "Test case completes successfully"
#                             }
#                         ]
            
#             enhanced_tc = {
#                 **tc,
#                 "steps": steps,  # Use converted steps
#                 "tags": tc.get("tags", []) + [generated_type],
#                 "automationCode": None  # Will be generated if automation type
#             }
            
            # Generate automation code for automation/UI test cases
#             if generated_type == "automation" and "ui" in types_to_generate:
#                 try:
                    # Generate Playwright code for this test case
#                     playwright_prompt = f"""You are an expert in Playwright test automation. Convert the following manual test case into executable Playwright TypeScript code.

# Test Case:
# {json.dumps(tc, indent=2)}

# Generate complete, runnable Playwright test code in TypeScript. Include:
# - Proper imports (@playwright/test)
# - Test structure with describe/it blocks
# - Step-by-step automation matching the manual test steps
# - Assertions for expected results
# - Proper selectors (prefer data-testid, role, or stable selectors)

# Respond ONLY with valid TypeScript code (no markdown, no explanations):"""
                    
#                     code_result = await ollama_service.generate(
#                         playwright_prompt,
#                         mode=mode,
#                         validate_json=False
#                     )
#                     code_text = code_result.get("response", "").strip()
                    # Remove markdown code blocks if present
#                     if code_text.startswith("```"):
#                         lines = code_text.split("\n")
#                         code_text = "\n".join(lines[1:-1]) if lines[-1].strip() == "```" else "\n".join(lines[1:])
#                     enhanced_tc["automationCode"] = code_text
#                     logger.info(f"Generated automation code for test case: {tc.get('name', 'Unknown')}")
#                 except Exception as e:
#                     logger.warning(f"Failed to generate automation code: {e}")
#                     enhanced_tc["automationCode"] = None
            
#             enhanced_test_cases.append(enhanced_tc)
        
        # Generate automation code for all requested test types
#         generated_code = {}
        
        # Extract app_type, test_style, environment from request
#         app_type = body.get("app_type", "web")
#         test_style = body.get("test_style", "step-list")
#         environment = body.get("environment", "staging")
        
        # Generate UI automation code (Playwright) if UI tests requested
#         if "ui" in types_to_generate or "automation" in types_to_generate:
#             try:
#                 ui_test_cases = [tc for tc in enhanced_test_cases if tc.get("_generated_type") == "automation"]
#                 if ui_test_cases:
#                     playwright_prompt = f"""Generate complete Playwright TypeScript test code for the following test cases.
# App type: {app_type}
# Environment: {environment}

# Test Cases:
# {json.dumps(ui_test_cases[:3], indent=2)}

# Generate runnable Playwright TypeScript code with:
# - Proper imports and test structure
# - Page object pattern if applicable
# - All test steps automated
# - Assertions for expected results
# - Error handling

# Return ONLY valid TypeScript code (no markdown):"""
                    
#                     code_result = await ollama_service.generate(
#                         playwright_prompt,
#                         mode=mode,
#                         validate_json=False
#                     )
#                     code_text = code_result.get("response", "").strip()
#                     if code_text.startswith("```"):
#                         code_text = code_text.split("```")[1].split("```")[0].strip()
#                         if code_text.startswith("typescript") or code_text.startswith("ts"):
#                             code_text = "\n".join(code_text.split("\n")[1:])
#                     generated_code["ui_playwright_ts"] = code_text
#             except Exception as e:
#                 logger.warning(f"Failed to generate UI code: {e}")
        
        # Generate API test code (pytest) if API tests requested
#         if "api" in types_to_generate:
#             try:
#                 api_test_cases = [tc for tc in enhanced_test_cases if tc.get("_generated_type") == "api"]
#                 if api_test_cases:
#                     api_prompt = f"""Generate complete pytest API test code for the following test cases.
# App type: {app_type}
# Environment: {environment}
# API Base: {body.get('api_base', f'https://api.{app_type}.example.com')}

# Test Cases:
# {json.dumps(api_test_cases[:3], indent=2)}

# Generate runnable pytest code with:
# - Proper imports (pytest, requests, etc.)
# - Test fixtures and setup
# - API endpoint tests
# - Response validation
# - Error handling

# Return ONLY valid Python code (no markdown):"""
                    
#                     code_result = await ollama_service.generate(
#                         api_prompt,
#                         mode=mode,
#                         validate_json=False
#                     )
#                     code_text = code_result.get("response", "").strip()
#                     if code_text.startswith("```"):
#                         code_text = code_text.split("```")[1].split("```")[0].strip()
#                         if code_text.startswith("python") or code_text.startswith("py"):
#                             code_text = "\n".join(code_text.split("\n")[1:])
#                     generated_code["api_pytest"] = code_text
#             except Exception as e:
#                 logger.warning(f"Failed to generate API code: {e}")
        
        # Generate Performance test code (k6) if performance tests requested
#         if "perf" in types_to_generate or "performance" in types_to_generate:
#             try:
#                 perf_prompt = f"""Generate k6 performance test script for the following requirement.
# Requirement: {requirement}
# App type: {app_type}
# Environment: {environment}

# Generate k6 script with:
# - Proper imports and setup
# - Load test scenarios
# - Ramp-up configuration
# - Thresholds and metrics
# - Error handling

# Return ONLY valid JavaScript k6 code (no markdown):"""
                
#                 code_result = await ollama_service.generate(
#                     perf_prompt,
#                     mode=mode,
#                     validate_json=False
#                 )
#                 code_text = code_result.get("response", "").strip()
#                 if code_text.startswith("```"):
#                     code_text = code_text.split("```")[1].split("```")[0].strip()
#                 generated_code["perf_k6"] = code_text
#             except Exception as e:
#                 logger.warning(f"Failed to generate performance code: {e}")
        
        # Generate Accessibility test code if accessibility tests requested
#         if "a11y" in types_to_generate or "accessibility" in types_to_generate:
#             try:
#                 a11y_prompt = f"""Generate accessibility test script using axe-core or Lighthouse for the following requirement.
# Requirement: {requirement}
# App type: {app_type}
# Environment: {environment}

# Generate accessibility test script with:
# - axe-core integration (Playwright or Node.js)
# - WCAG 2.1 AA compliance checks
# - Violation reporting
# - Error handling

# Return ONLY valid code (no markdown):"""
                
#                 code_result = await ollama_service.generate(
#                     a11y_prompt,
#                     mode=mode,
#                     validate_json=False
#                 )
#                 code_text = code_result.get("response", "").strip()
#                 if code_text.startswith("```"):
#                     code_text = code_text.split("```")[1].split("```")[0].strip()
#                 generated_code["a11y_script"] = code_text
#             except Exception as e:
#                 logger.warning(f"Failed to generate accessibility code: {e}")
        
        # Generate Security test config (ZAP) if security tests requested
#         if "security" in types_to_generate:
#             try:
#                 security_prompt = f"""Generate ZAP/Burp security scan configuration for the following requirement.
# Requirement: {requirement}
# App type: {app_type}
# Environment: {environment}

# Generate security scan config with:
# - Target URLs
# - Scan policies
# - Authentication setup (if needed)
# - Focus areas (OWASP Top 10)

# Return ONLY valid configuration (no markdown):"""
                
#                 code_result = await ollama_service.generate(
#                     security_prompt,
#                     mode=mode,
#                     validate_json=False
#                 )
#                 code_text = code_result.get("response", "").strip()
#                 if code_text.startswith("```"):
#                     code_text = code_text.split("```")[1].split("```")[0].strip()
#                 generated_code["security_zap_config"] = code_text
#             except Exception as e:
#                 logger.warning(f"Failed to generate security code: {e}")
        
#         return {
#             "status": "success",
#             "test_type": types_to_generate[0] if types_to_generate else "manual",  # Primary type
#             "test_types_generated": types_to_generate,  # All types generated
#             "test_cases": enhanced_test_cases,  # Return enhanced format
#             "code": generated_code,  # NEW: Structured automation code
#             "testPlan": test_plan,  # NEW: Test plan with scenarios and risk tags
#             "count": len(enhanced_test_cases),
#             "model": all_model_used or "unknown",
#             "latency_ms": total_latency,
#             "generation_id": generation_id,
#             "coverage": coverage,  # NEW: Return coverage level used
#             "coverage_hints_applied": coverage_hints if existing_tests else [],
#             "optimizations": {
#                 "deduplicated": True,
#                 "validated": True,
#                 "multi_type": len(types_to_generate) > 1
#             }
#         }
        
#     except Exception as e:
#         logger.error(f"Error in generate-tests-enhanced: {str(e)}")
#         raise HTTPException(status_code=500, detail=str(e))


# @app.post("/ai/generate-test-plan", response_model=ReqToTestPlanResponse)
# async def generate_test_plan(payload: ReqToTestPlanRequest):
#     """
#     Task 1: Requirement → structured test plan (scenarios, data, coverage).
#     """
#     try:
#         prompt = build_req_to_testplan_prompt(payload.input)
        
        # Call LLM service - your routing (use 30B coder)
#         raw = await ollama_service.generate_json(
#             prompt,
#             mode="heavy"  # Use heavy mode for 30B model
#         )
        
        # generate_json returns parsed JSON directly
        # Handle both dict with "output" key and direct dict
#         if isinstance(raw, dict) and "output" in raw:
#             output_data = raw["output"]
#         elif isinstance(raw, dict) and "test_plan_id" in raw:
            # Direct test plan structure
#             output_data = raw
#         else:
            # Fallback: use raw as-is
#             output_data = raw if isinstance(raw, dict) else {}
        
#         test_plan = ReqToTestPlanOutput(**output_data)
        
#         return ReqToTestPlanResponse(
#             test_plan=test_plan,
#             raw_model_output=raw
#         )
#     except Exception as exc:
#         logger.error(f"Error generating test plan: {str(exc)}")
#         raise HTTPException(status_code=500, detail=str(exc))


# @app.post("/ai/generate-tests", response_model=ReqToTestsResponse)
# async def generate_tests(payload: ReqToTestsRequest):
#     """
#     Task 2: Requirement (+optional plan) → concrete tests + code across UI, API, performance, accessibility, and security.
#     """
#     try:
#         prompt = build_req_to_tests_prompt(payload.input)
        
        # Call LLM service - still going through 30B coder
#         raw = await ollama_service.generate_json(
#             prompt,
#             mode="heavy"
#         )
        
        # generate_json returns parsed JSON directly
        # Handle both dict with "output" key and direct dict with "tests" key
#         if isinstance(raw, dict) and "output" in raw:
#             output_data = raw["output"]
#         elif isinstance(raw, dict) and "tests" in raw:
            # Direct tests structure
#             output_data = raw
#         else:
            # Fallback: wrap in output structure
#             output_data = {"tests": raw if isinstance(raw, list) else []}
        
#         output = ReqToTestsOutput(**output_data)
        
#         return ReqToTestsResponse(
#             tests=output.tests,
#             raw_model_output=raw
#         )
#     except Exception as exc:
#         logger.error(f"Error generating tests: {str(exc)}")
#         raise HTTPException(status_code=500, detail=str(exc))


# @app.post("/ai/url-discover")
# async def url_discover(request: Request, body: dict):
#     """
#     Auto-discover and generate tests from a website URL
    
#     Features:
#     - Crawl and map pages
#     - Generate UI tests for key flows
#     - Run accessibility checks
#     - Basic security + perf smoke tests
#     """
#     try:
#         base_url = body.get("url", "")
#         if not base_url:
#             raise HTTPException(status_code=400, detail="URL is required")
        
#         discover_options = body.get("discoverOptions", {})
#         crawl = discover_options.get("crawl", True)
#         generate_ui = discover_options.get("generateUI", True)
#         check_a11y = discover_options.get("checkA11y", False)
#         check_perf = discover_options.get("checkPerf", False)
#         check_security = discover_options.get("checkSecurity", False)
        
        # TODO: Implement actual crawling and discovery
        # For now, return placeholder response
#         return {
#             "status": "success",
#             "url": base_url,
#             "siteMap": {
#                 "pages": [
#                     {"url": base_url, "title": "Home", "depth": 0}
#                 ]
#             },
#             "generatedTests": [],
#             "a11yIssues": [],
#             "perfMetrics": {},
#             "securityFindings": [],
#             "message": "URL discovery feature coming soon - placeholder response"
#         }
#     except Exception as e:
#         logger.error(f"Error in url-discover: {str(e)}")
#         raise HTTPException(status_code=500, detail=str(e))


# @app.get("/tests/job/{job_id}/status")
# async def get_job_status(job_id: str):
#     """Get status of a queued test execution job"""
#     try:
#         from app.services.executors.test_executor_queue import get_executor_queue
#         queue = get_executor_queue()
#         status = await queue.get_job_status(job_id)
#         if not status:
#             raise HTTPException(status_code=404, detail="Job not found")
#         return status
#     except Exception as e:
#         logger.error(f"Error getting job status: {str(e)}")
#         raise HTTPException(status_code=500, detail=str(e))


# @app.get("/health/database")
# async def database_check():
#     """Simple database connection check endpoint"""
#     try:
#         from app.services.storage.postgres_direct import get_postgres_pool, get_postgres_connection_string
        
#         pool = get_postgres_pool()
#         conn_string = get_postgres_connection_string()
        
#         result = {
#             "pool_exists": pool is not None,
#             "connection_string_configured": conn_string is not None,
#             "connection_string": conn_string[:50] + "..." if conn_string else None,
#             "env_vars": {
#                 "DATABASE_URL": "set" if os.getenv("DATABASE_URL") else "not_set",
#                 "POSTGRES_HOST": os.getenv("POSTGRES_HOST", "not_set"),
#                 "POSTGRES_DB": os.getenv("POSTGRES_DB", "not_set"),
#                 "POSTGRES_USER": os.getenv("POSTGRES_USER", "not_set"),
#                 "POSTGRES_PASSWORD": "set" if os.getenv("POSTGRES_PASSWORD") else "not_set"
#             }
#         }
        
#         if not pool:
#             result["error"] = "PostgreSQL connection pool not available"
#             result["suggestion"] = "Check DATABASE_URL or POSTGRES_* environment variables"
        
#         return result
#     except Exception as e:
#         import traceback
#         return {
#             "error": str(e),
#             "error_type": str(e.__class__.__name__),
#             "traceback": traceback.format_exc()[:500]
#         }


# @app.get("/health/diagnostic")
# async def diagnostic_check():
#     """Diagnostic endpoint to check system health and connections"""
#     import time
#     import aiohttp
    
#     diagnostic = {
#         "timestamp": time.time(),
#         "backend_status": "running",
#         "connections": {}
#     }
    
    # Check Database connection (simplified, non-blocking) - ALWAYS include in response
    # This MUST run and set diagnostic["connections"]["database"] before any other checks
#     try:
#         from app.services.storage.postgres_direct import get_postgres_pool, get_postgres_connection_string
        
#         pool = get_postgres_pool()
#         conn_string = get_postgres_connection_string()
#         if pool:
            # Just check if pool exists, don't try to connect (to avoid hanging)
#             diagnostic["connections"]["database"] = {
#                 "status": "pool_exists",
#                 "has_pool": True,
#                 "connection_string": "configured" if conn_string else "not_configured",
#                 "note": "Pool exists but connection test skipped to avoid hanging"
#             }
#         else:
#             diagnostic["connections"]["database"] = {
#                 "status": "no_pool",
#                 "error": "PostgreSQL connection pool not available",
#                 "connection_string": conn_string[:50] + "..." if conn_string else "not_configured",
#                 "env_check": {
#                     "DATABASE_URL": "set" if os.getenv("DATABASE_URL") else "not_set",
#                     "POSTGRES_HOST": os.getenv("POSTGRES_HOST", "not_set"),
#                     "POSTGRES_DB": os.getenv("POSTGRES_DB", "not_set"),
#                     "POSTGRES_USER": os.getenv("POSTGRES_USER", "not_set")
#                 }
#             }
#     except ImportError as ie:
#         diagnostic["connections"]["database"] = {
#             "status": "import_error",
#             "error": f"Failed to import postgres_direct: {str(ie)}",
#             "error_type": "ImportError"
#         }
#     except Exception as e:
#         import traceback
#         diagnostic["connections"]["database"] = {
#             "status": "error",
#             "error": str(e),
#             "error_type": str(e.__class__.__name__),
#             "traceback": traceback.format_exc()[:500]  # First 500 chars of traceback
#         }
    
    # Ensure database check is always set (fallback)
#     if "database" not in diagnostic["connections"]:
#         diagnostic["connections"]["database"] = {
#             "status": "unknown",
#             "error": "Database check did not execute - this should not happen"
#         }
    
    # Check Ollama connection
#     try:
#         from app.services.llm.ollama_service import get_ollama_service
#         ollama_service = get_ollama_service()
        # Initialize session if not already done
#         if not ollama_service.session:
#             try:
#                 await ollama_service.initialize()
#             except Exception as init_err:
#                 diagnostic["connections"]["ollama"] = {
#                     "status": "init_error",
#                     "error": f"Failed to initialize session: {str(init_err)}",
#                     "url": ollama_service.ollama_api_url
#                 }
#                 return diagnostic  # Return early but database check already done
        
#         if ollama_service.session:
#             test_payload = {
#                 "model": "qwen3-coder:30b",
#                 "prompt": "test",
#                 "stream": False
#             }
            
#             start = time.time()
#             async with ollama_service.session.post(
#                 ollama_service.ollama_api_url,
#                 json=test_payload,
#                 timeout=aiohttp.ClientTimeout(total=5)
#             ) as response:
#                 elapsed = time.time() - start
#                 diagnostic["connections"]["ollama"] = {
#                     "status": "connected" if response.status == 200 else f"error_{response.status}",
#                     "response_time_ms": round(elapsed * 1000, 2),
#                     "url": ollama_service.ollama_api_url
#                 }
#         else:
#             diagnostic["connections"]["ollama"] = {
#                 "status": "error",
#                 "error": "Ollama session is None after initialization attempt",
#                 "url": ollama_service.ollama_api_url,
#                 "session_initialized": False
#             }
#     except ImportError as ie:
#         diagnostic["connections"]["ollama"] = {
#             "status": "import_error",
#             "error": f"Failed to import ollama_service: {str(ie)}"
#         }
#     except asyncio.TimeoutError:
#         diagnostic["connections"]["ollama"] = {
#             "status": "timeout",
#             "response_time_ms": 5000,
#             "url": ollama_service.ollama_api_url if 'ollama_service' in locals() else "unknown",
#             "error": "Connection timeout after 5 seconds"
#         }
#     except Exception as e:
#         diagnostic["connections"]["ollama"] = {
#             "status": "error",
#             "error": str(e),
#             "error_type": str(e.__class__.__name__),
#             "url": ollama_service.ollama_api_url if 'ollama_service' in locals() else "unknown"
#         }
    
    # Check SSH tunnel
#     try:
#         import socket
#         sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
#         sock.settimeout(2)
#         result = sock.connect_ex(('localhost', 31143))
#         sock.close()
#         diagnostic["connections"]["ssh_tunnel"] = {
#             "status": "connected" if result == 0 else "disconnected",
#             "port": 31143
#         }
#     except Exception as e:
#         diagnostic["connections"]["ssh_tunnel"] = {
#             "status": "error",
#             "error": str(e),
#             "port": 31143
#         }
    
#     return diagnostic


# @app.post("/tests/validate-code")
# async def validate_code(request: Request, body: dict):
#     """
#     Validate generated test code before execution
    
#     Validates:
#     - TypeScript/JavaScript syntax
#     - Playwright dry-run (test discovery)
#     - Linting (if available)
#     - Returns suggestions for fixes
#     """
#     try:
#         from app.services.utils.code_validator import get_code_validator
        
#         code = body.get("code", "")
#         project_type = body.get("projectType", "playwright-ts")
        
#         if not code:
#             raise HTTPException(status_code=400, detail="Code is required")
        
#         validator = get_code_validator()
#         result = await validator.validate_playwright_code(code, project_type)
        
#         return {
#             "valid": result["valid"],
#             "errors": result["errors"],
#             "warnings": result["warnings"],
#             "suggestions": result["suggestions"],
#             "dry_run_output": result["dry_run_output"]
#         }
#     except Exception as e:
#         logger.error(f"Error in validate-code: {str(e)}")
#         raise HTTPException(status_code=500, detail=str(e))


# @app.post("/ai/convert-to-playwright")
# async def convert_manual_to_playwright(request: Request, body: dict):
#     """
#     Convert manual test case to Playwright TypeScript code
#     Enhanced with validation and compilation checks
#     """
#     try:
#         from app.services.llm.prompt.prompt_templates import PROMPT_MANUAL_TO_PLAYWRIGHT
        
#         test_case = body.get("test_case", body)
        # Default to "quick" mode to use trained model (qa-expert:7b)
#         mode = body.get("mode", "quick")  # 'quick' (trained model), 'ui' (14B), or 'heavy' (32B)
#         project_id = body.get("project_id", "default")
#         org_id = body.get("org_id", "default")
        
        # Log mode selection
#         print(f"[INFO] REQUIREMENT-TO-TESTCASES - Mode: {mode}")
#         logger.info(f"[INFO] REQUIREMENT-TO-TESTCASES - Mode: {mode}")
        
#         if not test_case:
#             raise HTTPException(status_code=400, detail="test_case is required")
        
        # Format prompt
#         prompt = PROMPT_MANUAL_TO_PLAYWRIGHT.format(test_case=json.dumps(test_case, indent=2))
        
        # Generate Playwright code
#         start_time = time.time()
#         result = await ollama_service.generate(prompt, mode=mode, validate_json=False)
#         latency_ms = int((time.time() - start_time) * 1000)
        
#         playwright_code = result.get("response", "")
#         model_used = result.get("model", ollama_service._select_model(mode))
        
        # Store generation for fine-tuning
#         await store_ai_generation(
#             project_id=project_id,
#             prompt=prompt,
#             model=model_used,
#             output=playwright_code,
#             mode=mode,
#             endpoint="/ai/convert-to-playwright",
#             latency_ms=latency_ms,
#             org_id=org_id
#         )
        
#         return {
#             "status": "success",
#             "code": playwright_code,
#             "model": model_used,
#             "latency_ms": latency_ms
#         }
        
#     except Exception as e:
#         logger.error(f"Error in convert-to-playwright: {str(e)}")
#         raise HTTPException(status_code=500, detail=str(e))


# @app.post("/ai/generate-and-execute-automated")
# async def generate_and_execute_automated(request: Request, body: dict):
#     """
#     Generate automated test script from description and execute it immediately.
#     Creates test run and stores results in dashboard.
#     """
#     try:
#         description = body.get("description", "")
#         test_name = body.get("name", "Generated Test")
#         project_id = body.get("project_id")
#         org_id = body.get("org_id")
#         app_url = body.get("app_url", "https://www.saucedemo.com")
        
#         if not description:
#             raise HTTPException(status_code=400, detail="Description required")
        
#         org_id, proj_id = await ensure_default_org_project()
#         project_id = project_id or proj_id
        
        # 1. Generate Playwright code from description
#         prompt = f"""You are an expert in Playwright test automation. Generate executable Playwright TypeScript code for the following test scenario.

# Test Description: {description}
# Application URL: {app_url}

# Generate complete, runnable Playwright test code in TypeScript. Include:
# - Proper imports from '@playwright/test'
# - Test structure with test() or describe() blocks
# - Step-by-step automation matching the description
# - Assertions for expected results
# - Proper selectors and waits
# - Error handling

# Respond ONLY with valid TypeScript code (no markdown, no explanations, no code blocks):"""
        
#         start_time = time.time()
        # Use "quick" mode to leverage trained model (qa-expert:7b)
#         selected_model = ollama_service._select_model("quick")
#         print(f"[INFO] GENERATE-AND-EXECUTE - Mode: quick, Selected model: {selected_model}")
#         logger.info(f"[INFO] GENERATE-AND-EXECUTE - Mode: quick, Selected model: {selected_model}")
        
#         result = await ollama_service.generate(prompt, mode="quick", validate_json=False)
#         latency_ms = int((time.time() - start_time) * 1000)
        
#         playwright_code = result.get("response", "")
#         model_used = result.get("model", selected_model)
        
        # Log which model was used (for verification)
#         print(f"[INFO] GENERATE-AND-EXECUTE - Model used: {model_used}")
#         logger.info(f"[INFO] GENERATE-AND-EXECUTE - Model used: {model_used}")
#         if "qa-expert" in model_used.lower():
#             print(f"[OK] Using trained model: {model_used}")
#             logger.info(f"[OK] Using trained model: {model_used}")
#         else:
#             print(f"[WARN]  Using base model instead of trained model: {model_used}")
#             logger.warning(f"⚠️  Using base model instead of trained model: {model_used}")
        
        # Extract code from markdown if needed
#         import re
#         code_match = re.search(r'```(?:typescript|ts)?\n(.*?)\n```', playwright_code, re.DOTALL)
#         if code_match:
#             playwright_code = code_match.group(1)
        
        # Log the generated code for debugging
#         print(f"[INFO] Generated Playwright code (first 500 chars): {playwright_code[:500]}")
#         logger.info(f"Generated Playwright code: {playwright_code[:1000]}")
        
        # 2. Parse Playwright code to extract test steps using AI
        # Ask the model to extract structured steps from the generated code
#         parse_prompt = f"""You are a test automation expert. Extract structured test steps from the following Playwright TypeScript code.

# Playwright Code:
# {playwright_code}

# Application URL: {app_url}

# Extract each step and convert it to a structured format. For each step, identify:
# - action: The action being performed (navigate, click, fill, type, wait, etc.)
# - selector: The CSS selector or locator used
# - value: Any text/value being entered (if applicable)
# - expected: What should happen after this step

# Return ONLY a valid JSON array with this structure:
# [
#   {{
#     "action": "navigate|click|fill|type|wait|press",
#     "selector": "CSS selector or locator",
#     "value": "text to enter (if applicable)",
#     "expected": "expected result"
#   }}
# ]

# If the code has page.goto(), the first step should be navigate with url in data.
# If the code has page.click(), extract the selector.
# If the code has page.fill() or page.type(), extract selector and value.
# If the code has expect(), extract the expected result.

# Return ONLY the JSON array, no markdown, no explanations:"""
        
#         print(f"[INFO] Parsing Playwright code to extract steps...")
#         logger.info("Parsing Playwright code to extract steps")
        
        # Use robust JSON extraction (handles truncation, markdown, etc.)
#         from app.services.utils.test_generation_optimizer import extract_json_from_response
        
#         try:
#             parse_result = await ollama_service.generate(parse_prompt, mode="quick", validate_json=False)
#             steps_json = parse_result.get("response", "")
#         except Exception as parse_error:
#             logger.warning(f"Generation failed, trying with validate_json=False: {str(parse_error)}")
#             parse_result = await ollama_service.generate(parse_prompt, mode="quick", validate_json=False)
#             steps_json = parse_result.get("response", "")
        
#         print(f"[INFO] Parse result (first 500 chars): {steps_json[:500]}")
#         logger.info(f"Parse result: {steps_json[:1000]}")
        
        # Extract JSON from response using robust extraction
#         try:
#             steps_data = extract_json_from_response(steps_json)
            
#             if not steps_data or not isinstance(steps_data, list):
                # If extraction failed, try manual parsing
#                 logger.warning("extract_json_from_response returned empty, trying manual parsing")
#                 json_match = re.search(r'\[.*?\]', steps_json, re.DOTALL)
#                 if json_match:
#                     try:
#                         steps_data = json.loads(json_match.group(0))
#                     except json.JSONDecodeError:
                        # Try to fix truncated JSON by closing brackets
#                         partial_json = json_match.group(0)
                        # Count brackets to see if we need to close
#                         open_brackets = partial_json.count('[') - partial_json.count(']')
#                         open_braces = partial_json.count('{') - partial_json.count('}')
                        # Close incomplete objects/arrays
#                         for _ in range(open_braces):
#                             partial_json += '}'
#                         for _ in range(open_brackets):
#                             partial_json += ']'
#                         try:
#                             steps_data = json.loads(partial_json)
#                         except:
#                             raise ValueError("Could not parse JSON even after fixing")
#                 else:
#                     raise ValueError("No JSON array found in response")
            
#             if not isinstance(steps_data, list):
#                 raise ValueError(f"Expected list, got {type(steps_data)}")
            
#             if len(steps_data) == 0:
#                 raise ValueError("Empty steps array")
            
#             print(f"✅ Parsed {len(steps_data)} steps from Playwright code")
#             logger.info(f"Parsed {len(steps_data)} steps from Playwright code: {steps_data}")
            
            # Convert to TestStep objects
#             steps = []
#             for i, step_data in enumerate(steps_data):
#                 action = step_data.get('action', '').lower()
#                 selector = step_data.get('selector', '')
#                 value = step_data.get('value', '')
#                 expected = step_data.get('expected', '')
                
                # Build data dict based on action
#                 step_data_dict = {}
#                 if 'navigate' in action or 'go' in action:
#                     step_data_dict['url'] = app_url
#                 elif selector:
#                     step_data_dict['selector'] = selector
#                 if value:
#                     step_data_dict['value'] = value
                
                # Extract locator hints from selector
#                 locator_hints = []
#                 if selector:
                    # If selector has multiple options (comma-separated), split them
#                     if ',' in selector:
#                         locator_hints = [s.strip() for s in selector.split(',')]
#                     else:
#                         locator_hints = [selector]
                
#                 steps.append(TestStep(
#                     action=step_data.get('action', ''),
#                     data=step_data_dict,
#                     expected=expected,
#                     locator_hints=locator_hints
#                 ))
            
#             if not steps:
#                 raise ValueError("No steps extracted from Playwright code")
                
#         except Exception as parse_error:
#             import traceback
#             error_traceback = traceback.format_exc()
#             logger.error(f"Failed to parse Playwright code: {str(parse_error)}")
#             logger.error(f"Full traceback:\n{error_traceback}")
#             print(f"[WARN] Failed to parse Playwright code, falling back to description parsing: {str(parse_error)}")
#             print(f"Full traceback:\n{error_traceback}")
            
            # Fallback: create steps from description
#             steps = []
#             step_lines = description.split('.')
#             for i, line in enumerate(step_lines, 1):
#                 if line.strip():
#                     steps.append(TestStep(
#                         action=line.strip(),
#                         data={"url": app_url} if i == 1 else {},
#                         expected="",
#                         locator_hints=[]
#                     ))
            
#             if not steps:
#                 steps = [
#                     TestStep(
#                         action=f"Execute test: {description}",
#                         data={"url": app_url},
#                         expected="Test completes successfully",
#                         locator_hints=[]
#                     )
#                 ]
            
#             print(f"[WARN] Using fallback: created {len(steps)} steps from description")
#             logger.warning(f"Using fallback: created {len(steps)} steps from description")
        
        # Log steps before execution
#         print(f"[INFO] Created {len(steps)} test steps:")
#         for i, step in enumerate(steps, 1):
#             print(f"   {i}. {step.action} - selector: {step.data.get('selector', 'N/A')}, data: {step.data}")
#         logger.info(f"Created {len(steps)} test steps: {[s.action for s in steps]}")
        
        # 3. Create test run
#         from app.services.storage.test_results_storage import store_test_run, store_test_run_step
#         from app.services.storage.postgres_direct import execute_update
        
#         run_name = f"Auto-Generated: {test_name}"
#         started_at = datetime.utcnow().isoformat()
        
        # Create test run - ensure it's created in database
#         run_id = await store_test_run(
#             project_id=project_id,
#             name=run_name,
#             status="running",
#             environment="local",
#             started_at=started_at,
#             created_by="22222222-2222-2222-2222-222222222222"  # DEFAULT_USER_ID
#         )
        
        # If store_test_run failed, try direct insert
#         if not run_id:
#             logger.warning("store_test_run returned None, trying direct insert")
#             try:
#                 from app.services.storage.postgres_direct import execute_insert, get_postgres_pool
#                 pool = get_postgres_pool()
#                 if pool:
#                     run_data = {
#                         "project_id": project_id,
#                         "name": run_name,
#                         "status": "running",
#                         "environment": "local",
#                         "started_at": started_at,
#                         "created_by": "22222222-2222-2222-2222-222222222222"
#                     }
#                     run_id = await execute_insert("test_runs", run_data)
#                     logger.info(f"Created test run via direct insert: {run_id}")
#                 else:
                    # Generate UUID as fallback
#                     run_id = str(uuid.uuid4())
#                     logger.warning(f"No database pool, using generated UUID: {run_id}")
#             except Exception as e:
#                 logger.error(f"Failed to create test run: {str(e)}")
#                 run_id = str(uuid.uuid4())
#                 logger.warning(f"Using generated UUID as fallback: {run_id}")
        
#         if not run_id:
#             run_id = str(uuid.uuid4())
        
#         print(f"[INFO] Created test run: {run_id}")
#         logger.info(f"Test run ID: {run_id}")
        
        # 4. Create test case in database first (required for foreign key)
#         case_id = str(uuid.uuid4())
        
        # Create test case record in database - CRITICAL: must succeed before execution
#         print(f"[INFO] Creating test case in database: {case_id}")
#         logger.info(f"Creating test case in database: {case_id}")
        
#         test_case_created = False
#         try:
#             from app.services.storage.postgres_direct import execute_insert, get_postgres_pool
#             pool = get_postgres_pool()
#             if not pool:
#                 raise Exception("No database pool available")
            
#             test_case_data = {
#                 "id": case_id,
#                 "project_id": project_id,
#                 "title": test_name,
#                 "description": description,
#                 "test_type": "automated",
#                 "priority": "P2",
#                 "tags": ["automated", "ai-generated"],
#                 "status": "active",
#                 "created_by": "22222222-2222-2222-2222-222222222222"
#             }
            
#             print(f"[INFO] Attempting to insert test case with data: {list(test_case_data.keys())}")
#             logger.info(f"Attempting to insert test case: {test_case_data}")
            
#             created_case_id = await execute_insert("test_cases", test_case_data)
            
#             if created_case_id:
#                 logger.info(f"✅ Created test case in database: {created_case_id}")
#                 case_id = created_case_id
#                 test_case_created = True
#                 print(f"✅ Created test case: {case_id}")
#             else:
#                 raise Exception("execute_insert returned None - test case not created")
                
#         except Exception as e:
#             import traceback
#             error_traceback = traceback.format_exc()
#             logger.error(f"❌ CRITICAL: Could not create test case in database: {str(e)}")
#             logger.error(f"Full traceback:\n{error_traceback}")
#             print(f"[ERROR] CRITICAL ERROR: Could not create test case: {str(e)}")
#             print(f"Full traceback:\n{error_traceback}")
            # Don't continue if test case creation failed - we need it for foreign key
#             raise HTTPException(
#                 status_code=500, 
#                 detail=f"Failed to create test case in database: {str(e)}. Cannot proceed with test execution."
#             )
        
#         if not test_case_created:
#             raise HTTPException(
#                 status_code=500,
#                 detail="Test case creation failed - cannot proceed with test execution"
#             )
        
#         print(f"✅ Test case verified in database: {case_id}")
#         logger.info(f"Test case verified in database: {case_id}")
        
        # Use PlaywrightTestCase (from playwright_runner) not the Pydantic TestCase model
#         test_case = PlaywrightTestCase(
#             case_id=case_id,
#             title=test_name,
#             description=description,
#             priority="P2",  # Default priority
#             tags=["automated", "ai-generated"],  # Default tags
#             steps=steps
#         )
        
#         runner = PlaywrightRunner()
#         try:
#             print(f"🔧 Initializing Playwright runner...")
#             logger.info("Initializing Playwright runner")
#             await runner.initialize()
#             print(f"✅ Playwright runner initialized")
#             logger.info("Playwright runner initialized successfully")
#         except Exception as init_error:
#             import traceback
#             error_traceback = traceback.format_exc()
#             logger.error(f"Failed to initialize Playwright: {str(init_error)}")
#             logger.error(f"Traceback:\n{error_traceback}")
#             print(f"[ERROR] Failed to initialize Playwright: {str(init_error)}")
#             print(f"Full traceback:\n{error_traceback}")
#             raise HTTPException(
#                 status_code=500, 
#                 detail=f"Failed to initialize Playwright browser: {str(init_error)}. This might be a Windows compatibility issue. Check server logs for details."
#             )
        
#         try:
            # Execute test
#             print(f"🚀 Executing test case: {test_case.title}")
#             logger.info(f"Executing test case: {test_case.title}")
#             execution_result = await runner.run_test_case(test_case)
#             print(f"✅ Test execution completed: {execution_result.status}")
#             logger.info(f"Test execution completed: {execution_result.status}")
            
            # Store results in database
            # Verify run_id exists in database before storing step
#             try:
#                 from app.services.storage.postgres_direct import get_postgres_pool, execute_query
#                 pool = get_postgres_pool()
#                 if pool:
                    # Verify run exists
#                     verify_query = "SELECT id FROM test_runs WHERE id = %s"
#                     verify_result = await execute_query(verify_query, (run_id,))
#                     if not verify_result or len(verify_result) == 0:
#                         logger.warning(f"Test run {run_id} does not exist in database, creating it now")
                        # Create the run now
#                         run_data = {
#                             "id": run_id,
#                             "project_id": project_id,
#                             "name": run_name,
#                             "status": "running",
#                             "environment": "local",
#                             "started_at": started_at,
#                             "created_by": "22222222-2222-2222-2222-222222222222"  # DEFAULT_USER_ID
#                         }
#                         from app.services.storage.postgres_direct import execute_insert
#                         created_run_id = await execute_insert("test_runs", run_data)
#                         if created_run_id:
#                             logger.info(f"✅ Created missing test run: {created_run_id}")
#                             run_id = created_run_id
#             except Exception as e:
#                 logger.warning(f"Could not verify test run existence: {str(e)}")
            
            # Log execution result details
#             print(f"[INFO] Execution result - Status: {execution_result.status}, Error: {execution_result.error}")
#             print(f"[INFO] Execution logs: {execution_result.logs[:3] if execution_result.logs else 'None'}")
#             logger.info(f"Execution result - Status: {execution_result.status}, Error: {execution_result.error}")
#             if execution_result.logs:
#                 logger.info(f"Execution logs: {execution_result.logs}")
            
#             await store_test_run_step(
#                 run_id=run_id,
#                 case_id=case_id,
#                 title=test_case.title,
#                 status=execution_result.status,
#                 duration_ms=execution_result.duration,
#                 error_message=execution_result.error,
#                 stdout="\n".join(execution_result.logs) if execution_result.logs else None,
#                 started_at=started_at,
#                 completed_at=datetime.utcnow().isoformat()
#             )
            
            # Update test run status
#             final_status = "passed" if execution_result.status == "passed" else "failed"
#             try:
#                 from app.services.storage.postgres_direct import get_postgres_pool
#                 pool = get_postgres_pool()
#                 if pool:
#                     conn = pool.getconn()
#                     try:
#                         with conn.cursor() as cur:
#                             update_query = """
#                                 UPDATE test_runs 
#                                 SET status = %s, completed_at = NOW(), updated_at = NOW()
#                                 WHERE id = %s
#                             """
#                             cur.execute(update_query, (final_status, run_id))
#                             conn.commit()
#                     finally:
#                         pool.putconn(conn)
#             except Exception as e:
#                 logger.warning(f"Could not update test run status: {str(e)}")
            
#             return {
#                 "status": "success",
#                 "test_run_id": run_id,
#                 "test_case_id": case_id,
#                 "execution_result": {
#                     "status": execution_result.status,
#                     "duration": execution_result.duration,
#                     "error": execution_result.error,
#                     "logs": execution_result.logs
#                 },
#                 "generated_code": playwright_code,
#                 "model": model_used,
#                 "latency_ms": latency_ms
#             }
            
#         finally:
#             await runner.cleanup()
            
#     except Exception as e:
#         import traceback
#         error_traceback = traceback.format_exc()
#         logger.error(f"Error in generate-and-execute-automated: {str(e)}")
#         logger.error(f"Full traceback:\n{error_traceback}")
#         print(f"[ERROR] ERROR in generate-and-execute-automated: {str(e)}")
#         print(f"Full traceback:\n{error_traceback}")
#         raise HTTPException(status_code=500, detail=f"Error: {str(e)}. Check server logs for full traceback.")

# @app.get("/debug/model-info")
# async def get_model_info():
#     """Get current model configuration and verify which model is being used"""
#     try:
#         from app.services.llm.ollama_service import ollama_service
        
        # Get current configuration
#         ollama_url = os.getenv("OLLAMA_URL", "http://localhost:11434")
#         finetuned_model = os.getenv("FINETUNED_MODEL_NAME", "qa-expert:7b")
#         use_finetuned = os.getenv("USE_FINETUNED_MODEL", "true").lower() == "true"
        
        # Test model selection for each mode
#         model_selection = {
#             "quick": ollama_service._select_model("quick"),
#             "ui": ollama_service._select_model("ui"),
#             "heavy": ollama_service._select_model("heavy")
#         }
        
        # Check if trained model is being used
#         quick_uses_trained = "qa-expert" in model_selection["quick"].lower()
        
#         return {
#             "configuration": {
#                 "ollama_url": ollama_url,
#                 "finetuned_model_name": finetuned_model,
#                 "use_finetuned": use_finetuned
#             },
#             "model_selection": model_selection,
#             "status": {
#                 "trained_model_available": quick_uses_trained,
#                 "default_mode": "quick",
#                 "default_model": model_selection["quick"],
#                 "message": f"{'✅ Using trained model' if quick_uses_trained else '⚠️ Using base model'} for default (quick) mode"
#             }
#         }
#     except Exception as e:
#         logger.error(f"Error getting model info: {str(e)}")
#         raise HTTPException(status_code=500, detail=str(e))

# @app.get("/ai/evaluation-summary")
# async def get_evaluation_summary(project_id: Optional[str] = None):
#     """
#     Get evaluation summary from ai_generations table
#     Useful for monitoring LLM performance and quality
#     """
#     try:
#         from app.services.storage.postgres_direct import execute_query, get_postgres_pool
        
#         org_id, proj_id = await ensure_default_org_project()
#         project_id = project_id or proj_id
        
#         pool = get_postgres_pool()
#         if not pool:
#             return {"summary": {}, "error": "Database not available"}
        
#         query = """
#             SELECT 
#                 model,
#                 endpoint,
#                 COUNT(*) as total_calls,
#                 AVG(latency_ms) as avg_latency_ms,
#                 MIN(latency_ms) as min_latency_ms,
#                 MAX(latency_ms) as max_latency_ms,
#                 COUNT(CASE WHEN latency_ms > 10000 THEN 1 END) as slow_calls
#             FROM ai_generations
#             WHERE project_id = %s
#             GROUP BY model, endpoint
#             ORDER BY total_calls DESC
#         """
        
#         results = await execute_query(query, (project_id,))
        
#         summary = {
#             "project_id": project_id,
#             "models": {},
#             "endpoints": {},
#             "total_generations": 0
#         }
        
#         for row in results or []:
#             model = row.get("model", "unknown")
#             endpoint = row.get("endpoint", "unknown")
#             total_calls = row.get("total_calls", 0)
            
#             summary["total_generations"] += total_calls
            
#             if model not in summary["models"]:
#                 summary["models"][model] = {
#                     "total_calls": 0,
#                     "avg_latency_ms": 0,
#                     "endpoints": {}
#                 }
            
#             summary["models"][model]["total_calls"] += total_calls
#             summary["models"][model]["avg_latency_ms"] = row.get("avg_latency_ms", 0)
#             summary["models"][model]["endpoints"][endpoint] = {
#                 "calls": total_calls,
#                 "avg_latency_ms": row.get("avg_latency_ms", 0),
#                 "min_latency_ms": row.get("min_latency_ms", 0),
#                 "max_latency_ms": row.get("max_latency_ms", 0),
#                 "slow_calls": row.get("slow_calls", 0)
#             }
            
#             if endpoint not in summary["endpoints"]:
#                 summary["endpoints"][endpoint] = {
#                     "total_calls": 0,
#                     "models": {}
#                 }
            
#             summary["endpoints"][endpoint]["total_calls"] += total_calls
#             summary["endpoints"][endpoint]["models"][model] = total_calls
        
#         return summary
        
#     except Exception as e:
#         logger.error(f"Error getting evaluation summary: {str(e)}")
#         return {"summary": {}, "error": str(e)}


# ============================================================================
# New Architecture Endpoints - Orchestrator, Run Matrix, Style Codes, etc.
# ============================================================================

# @app.post("/workflows/create")
# async def create_workflow(request: Request, body: dict):
#     """Create a new workflow"""
#     try:
#         from app.services.core.orchestrator import orchestrator, WORKFLOW_TEMPLATES
        
#         org_id = body.get("org_id", "00000000-0000-0000-0000-000000000000")
#         project_id = body.get("project_id", "11111111-1111-1111-1111-111111111111")
#         workflow_type = body.get("workflow_type", "test_execution")
#         steps = body.get("steps")
#         metadata = body.get("metadata", {})
        
#         if not steps:
            # Use template if available
#             template = WORKFLOW_TEMPLATES.get(workflow_type)
#             if template:
#                 steps = template["steps"]
#             else:
#                 raise HTTPException(status_code=400, detail="No steps provided and no template found")
        
#         workflow_id = await orchestrator.create_workflow(
#             org_id=org_id,
#             project_id=project_id,
#             workflow_type=workflow_type,
#             steps=steps,
#             metadata=metadata
#         )
        
#         return {"workflow_id": workflow_id, "status": "created"}
        
#     except Exception as e:
#         logger.error(f"Error creating workflow: {str(e)}")
#         raise HTTPException(status_code=500, detail=str(e))


# @app.post("/workflows/{workflow_id}/execute")
# async def execute_workflow(request: Request, workflow_id: str):
#     """Execute a workflow"""
#     try:
#         from app.services.core.orchestrator import orchestrator
        
#         result = await orchestrator.execute_workflow(workflow_id)
#         return result
        
#     except ValueError as e:
#         raise HTTPException(status_code=404, detail=str(e))
#     except Exception as e:
#         logger.error(f"Error executing workflow: {str(e)}")
#         raise HTTPException(status_code=500, detail=str(e))


# @app.get("/workflows/{workflow_id}")
# async def get_workflow(request: Request, workflow_id: str):
#     """Get workflow by ID"""
#     try:
#         from app.services.core.orchestrator import orchestrator
#         from dataclasses import asdict
        
#         workflow = orchestrator.get_workflow(workflow_id)
#         if not workflow:
#             raise HTTPException(status_code=404, detail="Workflow not found")
        
#         return asdict(workflow)
        
#     except HTTPException:
#         raise
#     except Exception as e:
#         logger.error(f"Error getting workflow: {str(e)}")
#         raise HTTPException(status_code=500, detail=str(e))


# @app.post("/run-matrix/route")
# async def route_test(request: Request, body: dict):
#     """Route a test case to executor and environment"""
#     try:
#         from app.services.utils.run_matrix import run_matrix_service
        
#         test_case = body.get("test_case", {})
#         test_path = body.get("test_path")
        
#         route = run_matrix_service.route_test(test_case, test_path)
#         return route
        
#     except Exception as e:
#         logger.error(f"Error routing test: {str(e)}")
#         raise HTTPException(status_code=500, detail=str(e))


# @app.post("/style-codes/profile")
# async def profile_style(request: Request, body: dict):
#     """Profile style from test examples"""
#     try:
#         from app.services.utils.style_codes import style_profiler
        
#         examples = body.get("examples", [])
#         min_samples = body.get("min_samples", 5)
#         max_samples = body.get("max_samples", 50)
        
#         codex = style_profiler.profile_from_examples(examples, min_samples, max_samples)
        
#         from dataclasses import asdict
#         return asdict(codex)
        
#     except Exception as e:
#         logger.error(f"Error profiling style: {str(e)}")
#         raise HTTPException(status_code=500, detail=str(e))


# @app.post("/style-codes/enforce")
# async def enforce_style(request: Request, body: dict):
#     """Enforce style codex on generated test"""
#     try:
#         from app.services.utils.style_codes import StyleCodex, StyleEnforcer, StyleFormat, NamingConvention
#         from dataclasses import asdict
        
#         generated_test = body.get("test", {})
#         codex_data = body.get("codex", {})
        
        # Convert dict to StyleCodex
#         codex = StyleCodex(
#             format=StyleFormat(codex_data.get("format", "gherkin")),
#             naming_convention=NamingConvention(codex_data.get("naming_convention", "PascalCase")),
#             use_tags=codex_data.get("use_tags", True),
#             tag_patterns=codex_data.get("tag_patterns", []),
#             max_steps_per_test=codex_data.get("max_steps_per_test", 7),
#             min_steps_per_test=codex_data.get("min_steps_per_test", 3)
#         )
        
#         enforcer = StyleEnforcer(codex)
#         enforced_test = enforcer.enforce_style(generated_test)
        
#         return enforced_test
        
#     except Exception as e:
#         logger.error(f"Error enforcing style: {str(e)}")
#         raise HTTPException(status_code=500, detail=str(e))


# @app.post("/planner/prioritize")
# async def prioritize_tests(request: Request, body: dict):
#     """Prioritize tests using risk-based planning"""
#     try:
#         from app.services.utils.planner import risk_based_planner
#         from dataclasses import asdict
        
#         test_cases = body.get("test_cases", [])
#         context = body.get("context", {})
        
#         priorities = risk_based_planner.plan_test_suite(test_cases, context)
        
#         return {
#             "priorities": [asdict(p) for p in priorities],
#             "total_tests": len(priorities)
#         }
        
#     except Exception as e:
#         logger.error(f"Error prioritizing tests: {str(e)}")
#         raise HTTPException(status_code=500, detail=str(e))


# @app.get("/q-index/{project_id}")
# async def get_q_index(request: Request, project_id: str):
#     """Calculate Q-Index for a project"""
#     try:
#         from app.services.utils.q_index import q_index_service
#         from dataclasses import asdict
        
#         metrics_data = {}  # TODO: Query from database
#         metrics = q_index_service.calculate_q_index(project_id, metrics_data)
        
#         return asdict(metrics)
        
#     except Exception as e:
#         logger.error(f"Error calculating Q-Index: {str(e)}")
#         raise HTTPException(status_code=500, detail=str(e))


# @app.post("/q-index/{project_id}/gates")
# async def check_quality_gates(request: Request, project_id: str, body: dict):
#     """Check quality gates for a project"""
#     try:
#         from app.services.utils.q_index import q_index_service, QualityGate
#         from dataclasses import asdict
        
#         gates_data = body.get("gates", {})
#         gates = QualityGate(**gates_data) if gates_data else None
        
#         metrics_data = {}  # TODO: Query from database
#         metrics = q_index_service.calculate_q_index(project_id, metrics_data)
        
#         gate_result = q_index_service.check_quality_gates(metrics, gates)
        
#         return {
#             "passed": gate_result["passed"],
#             "violations": gate_result["violations"],
#             "metrics": asdict(gate_result["metrics"])
#         }
        
#     except Exception as e:
#         logger.error(f"Error checking quality gates: {str(e)}")
#         raise HTTPException(status_code=500, detail=str(e))


# @app.post("/self-healing/repair-selectors")
# async def repair_selectors(request: Request, body: dict):
#     """Generate candidate selectors for repair"""
#     try:
#         from app.services.utils.self_healing import self_healing_service
#         from dataclasses import asdict
        
#         failed_step = body.get("failed_step", {})
#         page_context = body.get("page_context", {})
        
#         candidates = self_healing_service.repair_selectors(failed_step, page_context)
        
#         return {
#             "candidates": [asdict(c) for c in candidates],
#             "recommended": asdict(candidates[0]) if candidates else None
#         }
        
#     except Exception as e:
#         logger.error(f"Error repairing selectors: {str(e)}")
#         raise HTTPException(status_code=500, detail=str(e))


# @app.post("/self-healing/classify-flake")
# async def classify_flake(request: Request, body: dict):
#     """Classify a test failure as flaky or legitimate"""
#     try:
#         from app.services.utils.self_healing import self_healing_service
#         from dataclasses import asdict
        
#         test_run = body.get("test_run", {})
#         historical_runs = body.get("historical_runs", [])
        
#         analysis = self_healing_service.classify_flake(test_run, historical_runs)
        
#         return asdict(analysis)
        
#     except Exception as e:
#         logger.error(f"Error classifying flake: {str(e)}")
#         raise HTTPException(status_code=500, detail=str(e))


# @app.post("/github/webhook")
# async def github_webhook(request: Request):
#     """Handle GitHub webhook events"""
#     try:
#         from app.services.connectors.github_connector import github_connector
        
        # Get signature header
#         signature = request.headers.get("X-Hub-Signature-256", "")
#         event_type = request.headers.get("X-GitHub-Event", "")
        
        # Read raw body for signature verification
#         body_bytes = await request.body()
        
        # Verify signature
#         if not await github_connector.verify_webhook_signature(body_bytes, signature):
#             raise HTTPException(status_code=401, detail="Invalid signature")
        
        # Parse payload
#         payload = await request.json()
        
        # Handle webhook
#         result = await github_connector.handle_webhook(event_type, payload)
        
#         return result
        
#     except HTTPException:
#         raise
#     except Exception as e:
#         logger.error(f"Error handling GitHub webhook: {str(e)}")
#         raise HTTPException(status_code=500, detail=str(e))


# @app.post("/artifacts/upload")
# async def upload_artifact(request: Request, body: dict):
#     """Upload test artifact to object store"""
#     try:
#         from app.services.storage.object_store import object_store_service
#         import base64
        
#         artifact_type = body.get("artifact_type")
#         artifact_data_b64 = body.get("artifact_data")  # Base64 encoded
#         org_id = body.get("org_id")
#         project_id = body.get("project_id")
#         run_id = body.get("run_id")
#         step_id = body.get("step_id")
#         filename = body.get("filename")
#         metadata = body.get("metadata", {})
        
        # Decode base64 data
#         artifact_data = base64.b64decode(artifact_data_b64)
        
#         key = object_store_service.upload_artifact(
#             artifact_type=artifact_type,
#             artifact_data=artifact_data,
#             org_id=org_id,
#             project_id=project_id,
#             run_id=run_id,
#             step_id=step_id,
#             filename=filename,
#             metadata=metadata
#         )
        
#         return {"key": key, "status": "uploaded"}
        
#     except Exception as e:
#         logger.error(f"Error uploading artifact: {str(e)}")
#         raise HTTPException(status_code=500, detail=str(e))


# @app.get("/artifacts/{org_id}/{project_id}/{run_id}")
# async def list_artifacts(request: Request, org_id: str, project_id: str, run_id: str):
#     """List artifacts for a test run"""
#     try:
#         from app.services.storage.object_store import object_store_service
        
#         artifact_type = request.query_params.get("type")
        
#         artifacts = object_store_service.list_artifacts(
#             org_id=org_id,
#             project_id=project_id,
#             run_id=run_id,
#             artifact_type=artifact_type
#         )
        
#         return {"artifacts": artifacts, "count": len(artifacts)}
        
#     except Exception as e:
#         logger.error(f"Error listing artifacts: {str(e)}")
#         raise HTTPException(status_code=500, detail=str(e))


# @app.get("/artifacts/presigned/{key:path}")
# async def get_presigned_url(request: Request, key: str):
#     """Get presigned URL for artifact access"""
#     try:
#         from app.services.storage.object_store import object_store_service
        
#         expiration = int(request.query_params.get("expiration", 3600))
        
#         url = object_store_service.get_presigned_url(key, expiration)
        
#         return {"url": url, "expiration_seconds": expiration}
        
#     except Exception as e:
#         logger.error(f"Error generating presigned URL: {str(e)}")
#         raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# CI/CD and Executor Endpoints
# ============================================================================

# @app.post("/cicd/webhook")
# async def cicd_webhook(request: Request):
#     """Handle CI/CD webhook events (GitHub Actions, Jenkins, GitLab CI)"""
#     try:
#         from app.services.connectors.cicd_connector import cicd_connector, CICDProvider
        
        # Detect provider from headers
#         github_event = request.headers.get("X-GitHub-Event")
#         jenkins_auth = request.headers.get("Authorization")
#         gitlab_token = request.headers.get("X-Gitlab-Token")
        
#         payload = await request.json()
#         result = None

#         if github_event:
            # GitHub Actions
#             signature = request.headers.get("X-Hub-Signature-256", "")
#             body_bytes = await request.body()
            
            # Verify signature would be done here
#             result = await cicd_connector.handle_github_actions_webhook(payload, signature)
#             provider = CICDProvider.GITHUB_ACTIONS

#         elif jenkins_auth:
            # Jenkins
#             result = await cicd_connector.handle_jenkins_webhook(payload, jenkins_auth)
#             provider = CICDProvider.JENKINS

#         elif gitlab_token:
            # GitLab CI
#             result = await cicd_connector.handle_gitlab_ci_webhook(payload, gitlab_token)
#             provider = CICDProvider.GITLAB_CI

#         else:
#             raise HTTPException(status_code=400, detail="Unknown CI/CD provider")

        # Trigger test run if needed
#         if result.get("action") == "trigger_tests":
#             test_run_result = await cicd_connector.trigger_test_run(provider, payload)
#             result["test_run"] = test_run_result

#         return result

#     except HTTPException:
#         raise
#     except Exception as e:
#         logger.error(f"Error handling CI/CD webhook: {str(e)}")
#         raise HTTPException(status_code=500, detail=str(e))


# @app.post("/executors/k6/execute")
# async def execute_k6_test(request: Request, body: dict):
#     """Execute k6 performance test"""
#     try:
#         from app.services.executors.k6_executor import k6_executor
        
#         test_script = body.get("test_script")
#         options = body.get("options", {})
        
#         if not test_script:
            # Generate script from endpoints
#             endpoints = body.get("endpoints", [])
#             if not endpoints:
#                 raise HTTPException(status_code=400, detail="Either test_script or endpoints required")
            
#             test_script = k6_executor.generate_test_script(endpoints, options)
        
#         result = await k6_executor.execute_test(test_script, options)
        
#         return result

#     except Exception as e:
#         logger.error(f"Error executing k6 test: {str(e)}")
#         raise HTTPException(status_code=500, detail=str(e))


# @app.post("/executors/k6/generate")
# async def generate_k6_script(request: Request, body: dict):
#     """Generate k6 test script from endpoint definitions"""
#     try:
#         from app.services.executors.k6_executor import k6_executor
        
#         endpoints = body.get("endpoints", [])
#         options = body.get("options", {})
        
#         if not endpoints:
#             raise HTTPException(status_code=400, detail="endpoints required")
        
#         script = k6_executor.generate_test_script(endpoints, options)
        
#         return {
#             "script": script,
#             "status": "generated"
#         }

#     except Exception as e:
#         logger.error(f"Error generating k6 script: {str(e)}")
#         raise HTTPException(status_code=500, detail=str(e))


# @app.post("/executors/zap/scan")
# async def execute_zap_scan(request: Request, body: dict):
#     """Execute ZAP security scan"""
#     try:
#         from app.services.executors.zap_executor import zap_executor
        
#         target_url = body.get("target_url")
#         scan_type = body.get("scan_type", "spider")
#         options = body.get("options", {})
        
#         if not target_url:
#             raise HTTPException(status_code=400, detail="target_url required")
        
#         result = await zap_executor.execute_scan(target_url, scan_type, options)
        
#         return result

#     except Exception as e:
#         logger.error(f"Error executing ZAP scan: {str(e)}")
#         raise HTTPException(status_code=500, detail=str(e))


# @app.post("/synthetic-requirements/generate")
# async def generate_synthetic_requirements(request: Request, body: dict):
#     """Generate synthetic requirements for pre-approval mode"""
#     try:
#         from app.services.utils.synthetic_requirements import synthetic_requirements_generator
#         from dataclasses import asdict
        
#         count = body.get("count", 5)
#         style_codex = body.get("style_codex")
#         categories = body.get("categories")
        
#         requirements = synthetic_requirements_generator.generate_requirements(
#             count=count,
#             style_codex=style_codex,
#             categories=categories
#         )
        
#         return {
#             "requirements": [asdict(r) for r in requirements],
#             "count": len(requirements),
#             "status": "generated"
#         }

#     except Exception as e:
#         logger.error(f"Error generating synthetic requirements: {str(e)}")
#         raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# Include all routers
# ============================================================================

# Health and metrics
from app.routers.health_api import router as health_router
app.include_router(health_router)

# Dashboard API
from app.routers.dashboard_api import router as dashboard_router
app.include_router(dashboard_router)

# Phase 4.1: Plugin API endpoints
from app.routers.plugin_api import router as plugin_router
app.include_router(plugin_router)

# App-First Flow endpoints
from app.routers.app_first_flow import router as app_first_flow_router
app.include_router(app_first_flow_router)

# Flowstral API - Simple and Fast Script Generation
from app.routers.playwright_recorder_api import router as flowstral_router
app.include_router(flowstral_router)

# Flowstral Engine API - Robust Automation Engine for Enterprise Apps
from app.routers.flowstral_engine_api import router as flowstral_engine_router
app.include_router(flowstral_engine_router)

# CDP Recorder API - Browser Recording WITHOUT Extension (like Testim/Tosca)
from app.routers.cdp_recorder_api import router as cdp_recorder_router
app.include_router(cdp_recorder_router)

# License Management API - Desktop Agent Licensing (mount under /api for desktop client)
from app.routers.license_api import router as license_router
app.include_router(license_router, prefix="/api")

# Download Proxy - Serves GitHub release assets for private repos
from app.routers.download_api import router as download_router
app.include_router(download_router, prefix="/api")

# Agent WebSocket API - Real-time Desktop Agent Communication
from app.routers.agent_websocket import router as agent_ws_router
app.include_router(agent_ws_router)

# COMMENTED OUT: Flowstral endpoints (old recording system)
# from app.routers.flowstral_api import router as flowstral_router
# from app.routers.flowstral_config_api import router as flowstral_config_router
# app.include_router(flowstral_router)
# app.include_router(flowstral_config_router)

from app.routers.test_case_api import router as test_case_router
from app.routers.test_cases_crud_api import router as test_cases_crud_router
from app.routers.test_case_rewrite_api import router as test_case_rewrite_router
from app.routers.test_runs_api import router as test_runs_router
from app.routers.test_plans_api import router as test_plans_router
from app.routers.defects_api import router as defects_router
from app.routers.requirements_api import router as requirements_router
from app.routers.tenants_api import router as tenants_router
from app.routers.agents_api import router as agents_router
from app.routers.workflows_api import router as workflows_router
from app.routers.models_api import router as models_router
from app.routers.ai_generation_api import router as ai_generation_router
app.include_router(test_case_router)
app.include_router(test_cases_crud_router)
app.include_router(test_case_rewrite_router)
app.include_router(test_runs_router)
app.include_router(test_plans_router)
app.include_router(defects_router)
app.include_router(requirements_router)
app.include_router(tenants_router)
app.include_router(agents_router)
app.include_router(workflows_router)
app.include_router(models_router)
app.include_router(ai_generation_router)

# LLM API with cost optimization
from app.routers.llm_api import router as llm_router
app.include_router(llm_router)

# API Import and Gherkin routers
from app.routers.api_import_api import router as api_import_router
from app.routers.gherkin_api import router as gherkin_router

app.include_router(api_import_router)
app.include_router(gherkin_router)

# Automation API router
from app.routers.automation_api import router as automation_router
app.include_router(automation_router)

# Requirement-to-TestCase API
from app.routers.requirement_to_testcase_api import router as requirement_to_testcase_router
app.include_router(requirement_to_testcase_router)

# Autonomous App Exploration API
from app.routers.exploration_api import router as exploration_router
app.include_router(exploration_router)

# Exploration Test Generation API
from app.routers.exploration_test_generation_api import router as exploration_test_generation_router
app.include_router(exploration_test_generation_router)

# Exploration Reporting API
from app.routers.exploration_reporting_api import router as exploration_reporting_router
app.include_router(exploration_reporting_router)

# Nexus Autonomous Exploratory Testing API
from app.routers.nexus_exploratory_api import router as nexus_exploratory_router
app.include_router(nexus_exploratory_router)

# Blaze - Real Autonomous Exploratory Testing (no AI dependency)
from app.routers.blaze_api import router as blaze_router
app.include_router(blaze_router)

# AI Vision Self-Healing API (GPT-4 Vision powered)
try:
    from app.routers.vision_healing_api import router as vision_healing_router
    app.include_router(vision_healing_router)
    logger.info("Vision Self-Healing API registered")
except ImportError as e:
    logger.warning(f"Vision Self-Healing API not available: {e}")

# AI-Enhanced Automation API (Zero-Failure Playback)
try:
    from app.routers.ai_automation_api import router as ai_automation_router
    app.include_router(ai_automation_router)
    logger.info("AI Automation API registered (zero-failure playback)")
except ImportError as e:
    logger.warning(f"AI Automation API not available: {e}")

# Exploration Complete Workflow API
from app.routers.exploration_workflow_api import router as exploration_workflow_router
app.include_router(exploration_workflow_router)

# Prometheus Metrics API
from app.routers.metrics_api import router as metrics_router
app.include_router(metrics_router)

# Secrets Vault API - Encrypted secrets management
from app.routers.secrets_api import router as secrets_router
app.include_router(secrets_router)

# Enterprise integrations
from app.routers.integrations.jira_webhook import router as jira_webhook_router
app.include_router(jira_webhook_router)

# Performance Testing API
from app.routers.performance_api import router as performance_router
app.include_router(performance_router)

# Protocol Recording API - HTTP traffic capture for load testing
from app.routers.protocol_recording_api import router as protocol_recording_router
app.include_router(protocol_recording_router)

# System Resource Monitoring API - CPU, Memory, Disk, Network (LOCAL machine)
from app.routers.system_monitoring_api import router as system_monitoring_router
app.include_router(system_monitoring_router)

# Server Resource Monitoring API - Like LoadRunner SiteScope (TARGET servers)
from app.routers.server_monitoring_api import router as server_monitoring_router
app.include_router(server_monitoring_router)

# OCR Fallback API - Last resort when all DOM locators fail
from app.routers.ocr_fallback_api import router as ocr_fallback_router
app.include_router(ocr_fallback_router)

# Accessibility Testing API
from app.routers.accessibility_api import router as accessibility_router
app.include_router(accessibility_router)

# NEW: Real Axe-Core Accessibility Scanning (v2)
from app.routers.accessibility_scan_api import router as a11y_scan_router
app.include_router(a11y_scan_router)

# Compliance and competitive optimizations
from app.routers.compliance_api import router as compliance_router
app.include_router(compliance_router)

# Enhanced API Testing (Enterprise-grade, ReadyAPI-level)
from app.routers.enhanced_api_testing_api import router as enhanced_api_testing_router
app.include_router(enhanced_api_testing_router)

# Salesforce Metadata Validation API
from app.routers.salesforce_api import router as salesforce_router
app.include_router(salesforce_router)

# Salesforce Authentication Service (for parallel test execution)
from app.routers.salesforce_auth import router as salesforce_auth_router
app.include_router(salesforce_auth_router)

# Framework Analyzer - Analyze and convert automation frameworks
from app.routers.framework_analyzer_api import router as framework_analyzer_router
app.include_router(framework_analyzer_router)

# CodeAlchemy - Transform any repository into executable test cases
from app.routers.code_alchemy_api import router as code_alchemy_router
app.include_router(code_alchemy_router)

# Database API - Unified SQLite/PostgreSQL storage with caching
from app.routers.database_api import router as database_router
app.include_router(database_router)

# Project Management API - Better than Jira
from app.routers.project_management_api import router as project_management_router
app.include_router(project_management_router)

# Traceability API - Requirements to Test Runs coverage matrix
from app.routers.traceability_api import router as traceability_router
app.include_router(traceability_router)

# Sample Data (for testing/demos)
from app.routers.sample_data_api import router as sample_data_router
app.include_router(sample_data_router)

# Enterprise Scale API (v2) - Production-ready paginated endpoints
from app.routers.scale_api import router as scale_api_router
app.include_router(scale_api_router)

# Complex Verifications API - Email, PDF, File verification
from app.routers.complex_verifications import router as complex_verifications_router
app.include_router(complex_verifications_router)

# OAuth2 Authentication API - Enterprise-grade OAuth2 support (like ReadyAPI)
from app.routers.oauth2_api import router as oauth2_router
app.include_router(oauth2_router)

# Request Chaining API - Like ReadyAPI TestSuites with request chaining
from app.routers.request_chaining_api import router as request_chaining_router
app.include_router(request_chaining_router)

# OWASP API Security Testing - Automated security scanning
from app.routers.owasp_security_api import router as owasp_security_router
app.include_router(owasp_security_router)

# Visual Testing - Robust visual regression testing with multiple comparison modes
from app.routers.visual_testing_api import router as visual_testing_router
app.include_router(visual_testing_router)

# Leads API - Lead generation and tracking for sales
from app.routers.leads_api import router as leads_router
app.include_router(leads_router)

# AI Testing API - Revolutionary plain-English testing
try:
    from app.routers.ai_testing import router as ai_testing_router
    app.include_router(ai_testing_router)
    logger.info("AI Testing API registered")
except Exception as e:
    logger.warning(f"AI Testing API not loaded (non-critical): {e}")

# AI Enhancements API - False positive persistence, flaky step detection, AI failure explainer
# Independent module: works with or without AI keys, never blocks existing flows
try:
    from app.routers.ai_enhancements_api import router as ai_enhancements_router
    app.include_router(ai_enhancements_router)
    logger.info("AI Enhancements API registered")
except Exception as e:
    logger.warning(f"AI Enhancements API not loaded (non-critical): {e}")

if __name__ == "__main__":
    # On Windows, set event loop policy for Playwright compatibility
    import sys
    if sys.platform == 'win32':
        import asyncio
        # Windows requires ProactorEventLoopPolicy for subprocess support (needed by Playwright)
        if not isinstance(asyncio.get_event_loop_policy(), asyncio.WindowsProactorEventLoopPolicy):
            asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())
            logger.info("Set WindowsProactorEventLoopPolicy for Playwright compatibility")
    
    uvicorn.run(app, host="0.0.0.0", port=8000)