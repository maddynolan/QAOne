# Flowstral Backend v3.12.2
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
            from app.routers.salesforce.salesforce_api import auto_connect_salesforce
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

# Rate Limiting Middleware (enterprise security — protects against DDoS/abuse)
from app.middleware.rate_limit_middleware import RateLimitMiddleware
app.add_middleware(RateLimitMiddleware)

# CORS middleware — MUST be added LAST so it's the outermost middleware.
# This ensures CORS headers are present on ALL responses, including error responses
# from inner middleware/routes. Without this, BaseHTTPMiddleware exceptions can
# bypass CORS header injection, causing browser CORS blocks on legitimate origins.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:8080",  # Frontend
        "http://localhost:3000",  # Alternative frontend
        "http://localhost:5173",  # Vite dev server
        "http://localhost:5174",  # Vite dev server (alt port)
        "http://localhost:8081",  # Tools server (Flowstral recorder)
        "http://127.0.0.1:8081",  # Tools server (alternative)
        "http://127.0.0.1:8080",  # Frontend (alternative)
        "http://127.0.0.1:5173",  # Vite dev (alternative)
        "https://flowstral.com",   # Production site
        "https://www.flowstral.com",
        "https://qaone-production.up.railway.app",  # Railway production
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global exception handler: ensures unhandled exceptions return JSON (not plain text)
# so that CORSMiddleware can properly add headers to the response.
from starlette.responses import JSONResponse

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Catch-all for unhandled exceptions. Returns JSON so CORS middleware can add headers."""
    logger.error(f"Unhandled exception on {request.method} {request.url.path}: {exc}")
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"},
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
# Include all routers
# ============================================================================

# Health and metrics
from app.routers.platform.health_api import router as health_router
app.include_router(health_router)

# Dashboard API
from app.routers.platform.dashboard_api import router as dashboard_router
app.include_router(dashboard_router)

# Phase 4.1: Plugin API endpoints
from app.routers.platform.plugin_api import router as plugin_router
app.include_router(plugin_router)

# App-First Flow endpoints
from app.routers.platform.app_first_flow import router as app_first_flow_router
app.include_router(app_first_flow_router)

# Flowstral API - Simple and Fast Script Generation
from app.routers.recorder.playwright_recorder_api import router as flowstral_router
app.include_router(flowstral_router)

# Flowstral Engine API - Robust Automation Engine for Enterprise Apps
from app.routers.recorder.flowstral_engine_api import router as flowstral_engine_router
app.include_router(flowstral_engine_router)

# CDP Recorder API - Browser Recording WITHOUT Extension (like Testim/Tosca)
from app.routers.recorder.cdp_recorder_api import router as cdp_recorder_router
app.include_router(cdp_recorder_router)

# License Management API - Desktop Agent Licensing (mount under /api for desktop client)
from app.routers.platform.license_api import router as license_router
app.include_router(license_router, prefix="/api")

# Download Proxy - Serves GitHub release assets for private repos
from app.routers.platform.download_api import router as download_router
app.include_router(download_router, prefix="/api")

# Agent WebSocket API - Real-time Desktop Agent Communication
from app.routers.ai.agent_websocket import router as agent_ws_router
app.include_router(agent_ws_router)

# COMMENTED OUT: Flowstral endpoints (old recording system)
# from app.routers.recorder.flowstral_api import router as flowstral_router
# from app.routers.recorder.flowstral_config_api import router as flowstral_config_router
# app.include_router(flowstral_router)
# app.include_router(flowstral_config_router)

from app.routers.test_management.test_case_api import router as test_case_router
from app.routers.test_management.test_cases_crud_api import router as test_cases_crud_router
from app.routers.test_management.test_case_rewrite_api import router as test_case_rewrite_router
from app.routers.test_management.test_runs_api import router as test_runs_router
from app.routers.test_management.test_plans_api import router as test_plans_router
from app.routers.platform.defects_api import router as defects_router
from app.routers.platform.requirements_api import router as requirements_router
from app.routers.platform.tenants_api import router as tenants_router
from app.routers.ai.agents_api import router as agents_router
from app.routers.test_management.workflows_api import router as workflows_router
from app.routers.ai.models_api import router as models_router
from app.routers.ai.ai_generation_api import router as ai_generation_router
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
from app.routers.ai.llm_api import router as llm_router
app.include_router(llm_router)

# API Import and Gherkin routers
from app.routers.api_testing.api_import_api import router as api_import_router
from app.routers.test_management.gherkin_api import router as gherkin_router

app.include_router(api_import_router)
app.include_router(gherkin_router)

# Automation API router
from app.routers.test_management.automation_api import router as automation_router
app.include_router(automation_router)

# Requirement-to-TestCase API
from app.routers.test_management.requirement_to_testcase_api import router as requirement_to_testcase_router
app.include_router(requirement_to_testcase_router)

# Autonomous App Exploration API
from app.routers.exploration.exploration_api import router as exploration_router
app.include_router(exploration_router)

# Exploration Test Generation API
from app.routers.exploration.exploration_test_generation_api import router as exploration_test_generation_router
app.include_router(exploration_test_generation_router)

# Exploration Reporting API
from app.routers.exploration.exploration_reporting_api import router as exploration_reporting_router
app.include_router(exploration_reporting_router)

# Nexus Autonomous Exploratory Testing API
from app.routers.exploration.nexus_exploratory_api import router as nexus_exploratory_router
app.include_router(nexus_exploratory_router)

# Blaze - Real Autonomous Exploratory Testing (no AI dependency)
from app.routers.exploration.blaze_api import router as blaze_router
app.include_router(blaze_router)

# AI Vision Self-Healing API (GPT-4 Vision powered)
try:
    from app.routers.ai.vision_healing_api import router as vision_healing_router
    app.include_router(vision_healing_router)
    logger.info("Vision Self-Healing API registered")
except ImportError as e:
    logger.warning(f"Vision Self-Healing API not available: {e}")

# AI-Enhanced Automation API (Zero-Failure Playback)
try:
    from app.routers.ai.ai_automation_api import router as ai_automation_router
    app.include_router(ai_automation_router)
    logger.info("AI Automation API registered (zero-failure playback)")
except ImportError as e:
    logger.warning(f"AI Automation API not available: {e}")

# Exploration Complete Workflow API
from app.routers.exploration.exploration_workflow_api import router as exploration_workflow_router
app.include_router(exploration_workflow_router)

# Prometheus Metrics API
from app.routers.platform.metrics_api import router as metrics_router
app.include_router(metrics_router)

# Secrets Vault API - Encrypted secrets management
from app.routers.platform.secrets_api import router as secrets_router
app.include_router(secrets_router)

# Enterprise integrations
from app.routers.integrations.jira_webhook import router as jira_webhook_router
app.include_router(jira_webhook_router)

# Performance Testing API
from app.routers.performance.performance_api import router as performance_router
app.include_router(performance_router)

# Protocol Recording API - HTTP traffic capture for load testing
from app.routers.performance.protocol_recording_api import router as protocol_recording_router
app.include_router(protocol_recording_router)

# System Resource Monitoring API - CPU, Memory, Disk, Network (LOCAL machine)
from app.routers.platform.system_monitoring_api import router as system_monitoring_router
app.include_router(system_monitoring_router)

# Server Resource Monitoring API - Like LoadRunner SiteScope (TARGET servers)
from app.routers.platform.server_monitoring_api import router as server_monitoring_router
app.include_router(server_monitoring_router)

# OCR Fallback API - Last resort when all DOM locators fail
from app.routers.ai.ocr_fallback_api import router as ocr_fallback_router
app.include_router(ocr_fallback_router)

# Accessibility Testing API
from app.routers.accessibility.accessibility_api import router as accessibility_router
app.include_router(accessibility_router)

# NEW: Real Axe-Core Accessibility Scanning (v2)
from app.routers.accessibility.accessibility_scan_api import router as a11y_scan_router
app.include_router(a11y_scan_router)

# Compliance and competitive optimizations
from app.routers.accessibility.compliance_api import router as compliance_router
app.include_router(compliance_router)

# Enhanced API Testing (Enterprise-grade, ReadyAPI-level)
from app.routers.api_testing.enhanced_api_testing_api import router as enhanced_api_testing_router
app.include_router(enhanced_api_testing_router)

# Salesforce Metadata Validation API
from app.routers.salesforce.salesforce_api import router as salesforce_router
app.include_router(salesforce_router)

# Salesforce Authentication Service (for parallel test execution)
from app.routers.salesforce.salesforce_auth import router as salesforce_auth_router
app.include_router(salesforce_auth_router)

# Framework Analyzer - Analyze and convert automation frameworks
from app.routers.platform.framework_analyzer_api import router as framework_analyzer_router
app.include_router(framework_analyzer_router)

# CodeAlchemy - Transform any repository into executable test cases
from app.routers.platform.code_alchemy_api import router as code_alchemy_router
app.include_router(code_alchemy_router)

# Database API - Unified SQLite/PostgreSQL storage with caching
from app.routers.platform.database_api import router as database_router
app.include_router(database_router)

# Project Management API - Better than Jira
from app.routers.platform.project_management_api import router as project_management_router
app.include_router(project_management_router)

# Traceability API - Requirements to Test Runs coverage matrix
from app.routers.platform.traceability_api import router as traceability_router
app.include_router(traceability_router)

# Sample Data (for testing/demos)
from app.routers.test_management.sample_data_api import router as sample_data_router
app.include_router(sample_data_router)

# Enterprise Scale API (v2) - Production-ready paginated endpoints
from app.routers.performance.scale_api import router as scale_api_router
app.include_router(scale_api_router)

# Complex Verifications API - Email, PDF, File verification
from app.routers.test_management.complex_verifications import router as complex_verifications_router
app.include_router(complex_verifications_router)

# OAuth2 Authentication API - Enterprise-grade OAuth2 support (like ReadyAPI)
from app.routers.platform.oauth2_api import router as oauth2_router
app.include_router(oauth2_router)

# Request Chaining API - Like ReadyAPI TestSuites with request chaining
from app.routers.api_testing.request_chaining_api import router as request_chaining_router
app.include_router(request_chaining_router)

# API Collection Persistence - Server-side storage for API collections (team sharing)
try:
    from app.routers.api_testing.collection_persistence_api import router as collection_persistence_router
    app.include_router(collection_persistence_router)
except Exception as e:
    logger.warning(f"Collection persistence API not loaded: {e}")

# Mobile Test Flows Persistence - Server-side storage for mobile YAML flows
try:
    from app.routers.test_management.mobile_flows_api import router as mobile_flows_router
    app.include_router(mobile_flows_router)
except Exception as e:
    logger.warning(f"Mobile flows API not loaded: {e}")

# OWASP API Security Testing - Automated security scanning
from app.routers.platform.owasp_security_api import router as owasp_security_router
app.include_router(owasp_security_router)

# Visual Testing - Robust visual regression testing with multiple comparison modes
from app.routers.visual_testing.visual_testing_api import router as visual_testing_router
app.include_router(visual_testing_router)

# Leads API - Lead generation and tracking for sales
from app.routers.platform.leads_api import router as leads_router
app.include_router(leads_router)

# AI Testing API - Revolutionary plain-English testing
try:
    from app.routers.ai.ai_testing import router as ai_testing_router
    app.include_router(ai_testing_router)
    logger.info("AI Testing API registered")
except Exception as e:
    logger.warning(f"AI Testing API not loaded (non-critical): {e}")

# Audit Trail API - Enterprise compliance logging
from app.routers.platform.audit_api import router as audit_router
app.include_router(audit_router)

# AI Settings API - BYOK key management, per-org/project AI configuration, usage tracking
try:
    from app.routers.platform.ai_settings_api import router as ai_settings_router
    app.include_router(ai_settings_router)
    logger.info("AI Settings API registered")
except Exception as e:
    logger.warning(f"AI Settings API not loaded (non-critical): {e}")

# AI Enhancements API - False positive persistence, flaky step detection, AI failure explainer
# Independent module: works with or without AI keys, never blocks existing flows
try:
    from app.routers.ai.ai_enhancements_api import router as ai_enhancements_router
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