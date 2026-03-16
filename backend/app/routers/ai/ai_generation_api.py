"""
AI Generation API Router
Handles all AI-powered test generation, triage, templates, and model gateway endpoints
"""
import logging
import json
import uuid
import time
import asyncio
import os
import concurrent.futures
import re
from typing import List, Optional, Dict, Any
from datetime import datetime
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import Response
# Services
from app.services.llm.ollama_service import get_ollama_service
from app.services.storage.ai_storage import store_ai_generation
from app.services.storage.database import create_requirement, get_database_client
from app.services.llm.enhanced_generation_service import enhanced_generation_service
from app.services.executors.playwright_runner import PlaywrightRunner, TestCase as PlaywrightTestCase, TestStep
from app.services.storage.postgres_direct import execute_query, execute_update, get_postgres_pool
from app.services.storage.test_results_storage import store_test_run, store_test_run_step
from app.utils.endpoint_helpers import ensure_default_org_project, map_priority, estimate_tokens, DEFAULT_USER_ID, map_priority_from_db
from app.dependencies import get_current_project, get_current_user, get_current_tenant
from app.schemas import (
    ReqToTestPlanRequest, ReqToTestPlanResponse, ReqToTestPlanOutput,
    ReqToTestsRequest, ReqToTestsResponse, ReqToTestsOutput
)
from app.services.llm.prompt.prompt_builders import build_req_to_testplan_prompt, build_req_to_tests_prompt
from .ai_generation_models import (
    GenerateTestsRequest,
    TestStep,
    TestCase,
    AuditInfo,
    GenerateTestsResponse,
    TriageRequest,
    TriageResponse,
    RunIngestRequest,
    RunIngestResponse,
    TestExecutionRequest,
    TestExecutionResponse,
)
from .ai_generation_utils import _query_usage_sync

logger = logging.getLogger(__name__)

# Get ollama service instance
ollama_service = get_ollama_service()

router = APIRouter(prefix="/ai", tags=["ai-generation"])


# ============================================================================
# TEST GENERATION ENDPOINTS
# ============================================================================
@router.post("/generate-tests-legacy")
async def generate_tests_legacy(request: Request, body: Optional[GenerateTestsRequest] = None):
    """
    Generate structured test cases from requirements and context (Legacy endpoint)
    Also supports planId query param for expanding test plans
    """
    try:
        # Get planId from query params if provided (for "Expand plan with AI")
        plan_id = request.query_params.get("planId")
        
        # If planId provided, generate additional scenarios for the plan
        if plan_id:
            # Use quick mode to leverage trained model (qa-expert:7b)
            mode = request.query_params.get("mode", "quick")
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
            selected_model = ollama_service._select_model(mode)
            print(f"[INFO] PLAN EXPANSION - Mode: {mode}, Selected model: {selected_model}")
            logger.info(f"[INFO] PLAN EXPANSION - Mode: {mode}, Selected model: {selected_model}")
            
            raw_result = await ollama_service.generate_json(prompt, mode=mode)
            latency_ms = int((time.time() - start_time) * 1000)
            
            # Extract model from result
            model_used = selected_model
            if isinstance(raw_result, list) and len(raw_result) > 0 and isinstance(raw_result[0], dict):
                model_used = raw_result[0].get("_model_used", selected_model)
                if "_model_used" in raw_result[0]:
                    del raw_result[0]["_model_used"]
            elif isinstance(raw_result, dict):
                model_used = raw_result.get("_model_used", selected_model)
                if "_model_used" in raw_result:
                    del raw_result["_model_used"]
            
            print(f"[INFO] PLAN EXPANSION - Model used: {model_used}")
            logger.info(f"[INFO] PLAN EXPANSION - Model used: {model_used}")
            if "qa-expert" in model_used.lower():
                print(f"[OK] Using trained model: {model_used}")
                logger.info(f"✅ Using trained model: {model_used}")
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
        # Default to "quick" mode to use trained model (qa-expert:7b)
        mode = body.context.get("mode", "quick") if body.context else "quick"
        
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
        
        # Log before generation
        selected_model = ollama_service._select_model(mode)
        print(f"[INFO] GENERATE_TESTS - Mode: {mode}, Selected model: {selected_model}")
        logger.info(f"[INFO] GENERATE_TESTS - Mode: {mode}, Selected model: {selected_model}")
        
        raw_result = await ollama_service.generate_json(prompt, mode=mode)
        latency_ms = int((time.time() - start_time) * 1000)
        
        # Extract model from result (if attached by generate_json)
        actual_model = None
        if isinstance(raw_result, dict):
            actual_model = raw_result.get("_model_used") or raw_result.get("model")
        elif isinstance(raw_result, list) and len(raw_result) > 0 and isinstance(raw_result[0], dict):
            actual_model = raw_result[0].get("_model_used")
        
        model_used = actual_model or selected_model
        
        # Log which model was actually used (for verification)
        print(f"[INFO] MODEL USAGE - Mode: {mode}, Selected: {selected_model}, Actual: {model_used}")
        logger.info(f"[INFO] MODEL USAGE - Mode: {mode}, Selected: {selected_model}, Actual: {model_used}")
        if "qa-expert" in str(model_used).lower():
            print(f"[OK] Using trained model: {model_used}")
            logger.info(f"[OK] Using trained model: {model_used}")
        else:
            print(f"[WARN] Using base model: {model_used}")
            logger.info(f"⚠️  Using base model: {model_used}")
        
        # Remove _model_used from result if present (clean up)
        if isinstance(raw_result, dict) and "_model_used" in raw_result:
            del raw_result["_model_used"]
        elif isinstance(raw_result, list) and len(raw_result) > 0 and isinstance(raw_result[0], dict):
            if "_model_used" in raw_result[0]:
                del raw_result[0]["_model_used"]
        
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
        logger.error(f"Error generating tests: {e}")
        raise HTTPException(
            status_code=500,
            detail="Failed to generate test cases"
        )



@router.post("/triage")
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
        logger.error(f"Error analyzing defect: {e}")
        raise HTTPException(
            status_code=500,
            detail="Failed to analyze defect"
        )

@router.post("/runs/ingest")


@router.post("/jira-to-testcases")
async def jira_to_testcases(request: Request, body: dict):
    """
    Convert Jira story/JSON to manual test cases
    Input: Jira JSON or plain text
    Output: Array of manual test cases
    
    Now uses enhanced generation with RAG + caching!
    """
    try:
        jira_content = body.get("jira", "") or body.get("story", "") or json.dumps(body)
        # Default to "quick" mode to use trained model (qa-expert:7b)
        mode = body.get("mode", "quick")  # 'quick' (trained model), 'ui' (14B), or 'heavy' (32B)
        project_id = body.get("project_id", "default")
        org_id = body.get("org_id", "default")
        
        # Log mode selection
        print(f"[INFO] JIRA-TO-TESTCASES - Mode: {mode}")
        logger.info(f"[INFO] JIRA-TO-TESTCASES - Mode: {mode}")
        
        # Try enhanced generation first (if enabled and DATABASE_URL is set)
        # Disable enhanced generation if DATABASE_URL is not set to avoid fallback delays
        database_url = os.getenv("DATABASE_URL")
        use_enhanced = os.getenv("USE_ENHANCED_GENERATION", "true").lower() == "true" and database_url is not None
        if not database_url:
            logger.info("DATABASE_URL not set, skipping enhanced generation to avoid fallback delay")
        
        if use_enhanced:
            try:
                await enhanced_generation_service.initialize()
                
                # Ensure "quick" mode is passed correctly to use trained model
                user_mode_for_enhanced = mode if mode in ["quick", "deep", "ui", "heavy"] else "quick"
                print(f"[INFO] JIRA-TO-TESTCASES - Passing mode to enhanced service: {user_mode_for_enhanced} (original: {mode})")
                logger.info(f"Passing mode to enhanced service: {user_mode_for_enhanced} (original: {mode})")
                
                result = await enhanced_generation_service.generate_test_cases(
                    requirement=jira_content,
                    organization_id=org_id,
                    project_id=project_id if project_id != "default" else None,
                    test_type="manual",
                    user_mode=user_mode_for_enhanced
                )
                
                # Store requirement (async, don't block)
                try:
                    jira_key = None
                    jira_title = None
                    jira_payload = None
                    
                    if isinstance(body.get("jira"), dict):
                        jira_payload = body.get("jira")
                        jira_key = jira_payload.get("key") or jira_payload.get("id")
                        jira_title = jira_payload.get("summary") or jira_payload.get("title")
                    
                    if jira_title or jira_content:
                        await create_requirement(
                            project_id=project_id,
                            source="jira",
                            title=jira_title or "Jira Story",
                            description=jira_content[:1000] if len(jira_content) > 1000 else jira_content,
                            source_ref=jira_key,
                            raw_payload=jira_payload
                        )
                except Exception as e:
                    logger.warning(f"Could not store requirement: {str(e)}")
                
                return {
                    "status": "success",
                    "test_cases": result.get("test_cases", []),
                    "model": result.get("model"),
                    "latency_ms": result.get("latency_ms"),
                    "cache_hit": result.get("cache_hit", False),
                    "cache_level": result.get("cache_level"),
                    "rag_context_used": result.get("rag_context_used", False),
                    "source": result.get("source", "generation")
                }
                
            except Exception as e:
                logger.warning(f"Enhanced generation failed, falling back to basic: {e}")
                # Fall through to original implementation
        
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
            logger.warning(f"Could not store requirement: {str(e)}")
        
        if not jira_content or len(jira_content.strip()) < 10:
            raise HTTPException(
                status_code=400, 
                detail="Requirement text is too short. Please provide a detailed Jira story or requirement (at least 10 characters)."
            )
        
        prompt = f"""You are an expert QA engineer. Convert the following Jira story into comprehensive manual test cases.

Jira Story/Requirements:
{jira_content}

Generate 4-6 comprehensive manual test cases in JSON format. Each test case must have:
- name: Clear test case name
- description: Detailed description
- steps: Array of {{"action": "...", "expectedResult": "..."}}
- priority: "low", "medium", "high", or "critical"
- tags: Array of relevant tags

CRITICAL: Respond with ONLY valid JSON array. No explanations, no markdown, no code blocks, no text before or after. Start with [ and end with ].

Example format:
[{{"name":"Test Case 1","description":"Description","steps":[{{"action":"Step 1","expectedResult":"Result 1"}}],"priority":"high","tags":["tag1"]}}]"""

        start_time = time.time()
        try:
            # Log model selection before generation
            selected_model = ollama_service._select_model(mode)
            print(f"[INFO] JIRA-TO-TESTCASES - Selected model: {selected_model}")
            logger.info(f"[INFO] JIRA-TO-TESTCASES - Selected model: {selected_model}")
            
            # Use generate method with validate_json=False, then extract JSON manually
            # This gives us more control over JSON extraction
            result = await ollama_service.generate(prompt, mode=mode, max_retries=2, validate_json=False)
            raw_response = result.get("response", "")
            model_used = result.get("model", selected_model)
            latency_ms = int((time.time() - start_time) * 1000)
            
            # Log which model was actually used
            print(f"[INFO] JIRA-TO-TESTCASES - Model used: {model_used}")
            logger.info(f"[INFO] JIRA-TO-TESTCASES - Model used: {model_used}")
            if "qa-expert" in model_used.lower():
                print(f"[OK] Using trained model: {model_used}")
                logger.info(f"✅ Using trained model: {model_used}")
            else:
                print(f"[WARN] Using base model: {model_used}")
                logger.warning(f"⚠️  Using base model: {model_used}")
            
            # Extract JSON from response (might have markdown or text)
            from app.services.utils.test_generation_optimizer import extract_json_from_response, is_valid_test_case_json
            
            test_cases = extract_json_from_response(raw_response)
            
            if not test_cases:
                # Try one more time with a fixup prompt
                logger.warning("No JSON extracted, trying with fixup prompt...")
                fixup_prompt = f"""{prompt}

IMPORTANT: Your response must be ONLY a valid JSON array. No markdown, no explanations, no text. Just the JSON array."""
                result2 = await ollama_service.generate(fixup_prompt, mode=mode, max_retries=1, validate_json=False)
                test_cases = extract_json_from_response(result2.get("response", ""))
            
            if not test_cases:
                logger.error(f"Could not extract JSON from response: {raw_response[:500]}")
                raise Exception(f"Model did not return valid JSON. Response started with: {raw_response[:200]}")
            
            # Validate test case structure
            if not is_valid_test_case_json(test_cases):
                logger.warning("Test cases don't match expected structure, but will try to use them")
            
            # Ensure result is a list
            if not isinstance(test_cases, list):
                test_cases = [test_cases]
            
            if len(test_cases) == 0:
                raise Exception("No test cases generated from model response")
                
        except Exception as e:
            logger.error(f"Error generating test cases: {e}")
            raise HTTPException(
                status_code=500,
                detail="Failed to generate test cases. This might be due to: 1) Model timeout, 2) Invalid JSON response, 3) Network issue. Try again or use a simpler requirement."
            )
        
        # Store generation for fine-tuning (fire and forget)
        generation_id = await store_ai_generation(
            project_id=project_id,
            prompt=prompt,
            model=model_used,
            output=json.dumps(test_cases),
            mode=mode,
            endpoint="/ai/jira-to-testcases",
            latency_ms=latency_ms,
            org_id=org_id,
            task_category="manual"
        )
        
        return {
            "status": "success",
            "test_cases": test_cases,
            "requirement_id": requirement_id,
            "model": model_used,
            "latency_ms": latency_ms,
            "generation_id": generation_id  # Include for rating/correction
        }
        
    except Exception as e:
        print(f"Error in jira-to-testcases: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")




@router.post("/testcase-to-playwright")
async def testcase_to_playwright(request: Request, body: dict):
    """
    Convert manual test case to Playwright TypeScript code
    Input: Single manual test case
    Output: TypeScript/Playwright code
    """
    try:
        test_case = body.get("test_case", body)
        # Default to "quick" mode to use trained model (qa-expert:7b)
        mode = body.get("mode", "quick")  # 'quick' (trained model), 'ui' (14B), or 'heavy' (32B)
        
        # Log mode selection
        print(f"[INFO] TESTCASE-TO-PLAYWRIGHT - Mode: {mode}")
        logger.info(f"[INFO] TESTCASE-TO-PLAYWRIGHT - Mode: {mode}")
        
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
        raise HTTPException(status_code=500, detail="Internal server error")




@router.post("/api-tests")
async def generate_api_tests(request: Request, body: dict):
    """
    Generate API tests from OpenAPI spec and story with OpenAI enhancement.
    Input: OpenAPI specification and story description
    Output: Postman or Playwright-API tests
    
    Uses OpenAI (gpt-4o-mini) for high-quality test generation.
    Falls back to Ollama if OpenAI is unavailable.
    """
    try:
        import asyncio
        from app.services.llm.api_test_service import get_api_test_service
        
        openapi_spec = body.get("openapi_spec", body.get("openapi", ""))
        story = body.get("story", body.get("description", ""))
        output_format = body.get("format", "playwright")  # playwright or postman
        
        # Try OpenAI first
        api_test_service = get_api_test_service()
        openai_available = api_test_service.openai_service.is_available()
        
        if openai_available:
            logger.info("[API-TESTS] Using OpenAI for API test generation")
            
            system_prompt = f"""You are an expert in API testing. Generate comprehensive API tests based on the OpenAPI specification and user story.

Generate {output_format} API tests that:
- Cover all endpoints mentioned in the story
- Include positive and negative test cases
- Test request/response validation
- Include proper assertions
- Use realistic test data
- Handle error scenarios

Return ONLY valid {output_format} test code (no markdown, no code blocks, no explanations)."""

            user_message = f"""OpenAPI Specification:
{openapi_spec[:3000]}

User Story:
{story}

Generate complete {output_format} API test code."""

            try:
                result = await asyncio.wait_for(
                    api_test_service._call_openai_for_code(
                        system_prompt=system_prompt,
                        user_message=user_message,
                        timeout=60.0
                    ),
                    timeout=65.0
                )
                
                code = api_test_service._extract_code_from_response(result.get("response", ""))
                
                return {
                    "status": "success",
                    "tests": code,
                    "format": output_format,
                    "provider": "openai",
                    "model": "gpt-4o-mini",
                    "latency_ms": result.get("latency_ms", 0),
                    "tokens_used": result.get("tokens_used"),
                    "cost_usd": result.get("cost_usd")
                }
            except Exception as e:
                logger.warning(f"OpenAI API test generation failed: {e}, falling back to Ollama")
        
        # Fallback to Ollama
        logger.info("[API-TESTS] Using Ollama for API test generation")
        mode = body.get("mode", "quick")
        
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
            "provider": "ollama",
            "model": result["model"],
            "latency_ms": latency_ms
        }
        
    except Exception as e:
        logger.error(f"Error in api-tests: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail={
                "error": "Failed to generate API tests",
                "message": str(e),
                "type": type(e).__name__
            }
        )




@router.post("/perf-tests")
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
        raise HTTPException(status_code=500, detail="Internal server error")




@router.post("/a11y-tests")
async def generate_a11y_tests(request: Request, body: dict):
    """
    Generate accessibility tests (WCAG 2.1 AA compliance)
    Uses hardcoded templates - NO inference needed for compliance requirements
    """
    try:
        from app.services.agents.accessibility_compliance import get_accessibility_test_cases
        
        # Get all WCAG 2.1 AA compliance test cases (hardcoded, no inference)
        test_cases = get_accessibility_test_cases()
        
        # Store generation for tracking (even though no inference)
        # Get actual org/project IDs from database
        org_id, project_id = await ensure_default_org_project()
        # Allow override from request body if provided
        project_id = body.get("project_id", project_id)
        org_id = body.get("org_id", org_id)
        
        await store_ai_generation(
            project_id=project_id,
            prompt="WCAG 2.1 AA Compliance Test Cases (Hardcoded Templates)",
            model="template-based",
            output=json.dumps(test_cases),
            mode="template",
            endpoint="/ai/a11y-tests",
            latency_ms=0,  # No inference, instant
            org_id=org_id,
            task_category="accessibility"
        )
        
        return {
            "status": "success",
            "test_type": "accessibility",
            "test_cases": test_cases,
            "count": len(test_cases),
            "wcag_level": "AA",
            "wcag_version": "2.1",
            "source": "hardcoded_templates",
            "latency_ms": 0
        }
    except Exception as e:
        logger.error(f"Error in a11y-tests: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")
    


@router.post("/a11y-tests-old")
async def generate_a11y_tests_old(request: Request, body: dict):
    """
    Generate accessibility tests from DOM dump or URL
    Input: DOM dump or URL
    Output: Playwright + Axe run results
    """
    try:
        dom_dump = body.get("dom_dump", body.get("dom", ""))
        url = body.get("url", "")
        # Default to "quick" mode to use trained model (qa-expert:7b)
        mode = body.get("mode", "quick")  # 'quick' (trained model), 'ui' (14B), or 'heavy' (32B)
        
        # Log mode selection
        print(f"[INFO] DOM-TO-TESTCASES - Mode: {mode}")
        logger.info(f"[INFO] DOM-TO-TESTCASES - Mode: {mode}")
        
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
        raise HTTPException(status_code=500, detail="Internal server error")




@router.post("/triage")
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
        # Default to "quick" mode to use trained model (qa-expert:7b)
        # Note: Triage might benefit from larger model, but defaulting to trained for consistency
        mode = body.get("mode", "quick")  # 'quick' (trained model), 'ui' (14B), or 'heavy' (32B)
        
        # Log mode selection
        print(f"[INFO] TRIAGE-TEST-FAILURES - Mode: {mode}")
        logger.info(f"[INFO] TRIAGE-TEST-FAILURES - Mode: {mode}")
        
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
        logger.error(f"Error in triage: {e}")
        raise HTTPException(
            status_code=500,
            detail="Failed to analyze defect"
        )


# ============================================================================
# AI TEMPLATES ENDPOINTS
# ============================================================================



@router.get("/templates")
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
        raise HTTPException(status_code=500, detail="Internal server error")




@router.post("/templates")
async def save_ai_template(request: Request, body: dict):
    """Save or update AI prompt template with automatic versioning"""
    try:
        from app.services.llm.prompt.prompt_template_service import prompt_template_service
        
        project_id = body.get("project_id")
        org_id = body.get("org_id")
        task = body.get("task")
        template = body.get("template")
        version_type = body.get("version_type", "minor")  # "major", "minor", or "patch"
        
        if not project_id or not task or not template:
            raise HTTPException(
                status_code=400,
                detail="Missing required fields: project_id, task, template"
            )
        
        # Save with versioning service
        new_version = await prompt_template_service.save_template(
            task=task,
            template=template,
            organization_id=org_id,
            project_id=project_id,
            version_type=version_type
        )
        
        return {
            "status": "success",
            "message": "Template saved successfully",
            "version": new_version
        }
    except HTTPException:
        raise
    except Exception as db_error:
        logger.error(f"Database error saving template: {str(db_error)}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to save template: {str(db_error)}"
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail="Internal server error")


# ============================================================================
# AI GENERATION QUALITY TRACKING ENDPOINTS (for fine-tuning data collection)
# ============================================================================



@router.post("/generations/{generation_id}/rate")
async def rate_generation(generation_id: str, request: Request):
    """Rate an AI generation (1-5 stars) for quality tracking"""
    try:
        body = await request.json()
        quality_score = body.get("quality_score")
        feedback = body.get("feedback")
        is_approved = body.get("is_approved", False)
        
        if not quality_score or not (1 <= quality_score <= 5):
            raise HTTPException(
                status_code=400,
                detail="quality_score must be between 1 and 5"
            )
        
        from app.services.storage.database import get_database_client
        from app.services.storage.postgres_direct import execute_update
        
        client = get_database_client()
        if not client or not hasattr(client, 'getconn'):
            raise HTTPException(status_code=500, detail="Database connection not available")
        
        # Update generation with rating
        update_query = """
            UPDATE ai_generations
            SET quality_score = %s,
                feedback = %s,
                is_approved = %s,
                rated_at = NOW()
            WHERE id = %s
            RETURNING id
        """
        
        result = await execute_update(
            update_query,
            (quality_score, feedback, is_approved, generation_id)
        )
        
        if not result or len(result) == 0:
            raise HTTPException(status_code=404, detail="Generation not found")
        
        return {
            "status": "success",
            "message": "Rating saved successfully",
            "generation_id": generation_id,
            "quality_score": quality_score
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error rating generation: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")




@router.post("/generations/{generation_id}/correct")
async def correct_generation(generation_id: str, request: Request):
    """Submit a corrected version of an AI generation"""
    try:
        body = await request.json()
        corrected_output = body.get("corrected_output")
        feedback = body.get("feedback")
        
        if not corrected_output:
            raise HTTPException(
                status_code=400,
                detail="corrected_output is required"
            )
        
        from app.services.storage.database import get_database_client
        from app.services.storage.postgres_direct import execute_update
        
        client = get_database_client()
        if not client or not hasattr(client, 'getconn'):
            raise HTTPException(status_code=500, detail="Database connection not available")
        
        # Update generation with correction
        update_query = """
            UPDATE ai_generations
            SET corrected_output = %s,
                feedback = %s,
                corrected_at = NOW(),
                is_approved = true  -- Auto-approve if user took time to correct
            WHERE id = %s
            RETURNING id
        """
        
        result = await execute_update(
            update_query,
            (corrected_output, feedback, generation_id)
        )
        
        if not result or len(result) == 0:
            raise HTTPException(status_code=404, detail="Generation not found")
        
        return {
            "status": "success",
            "message": "Correction saved successfully",
            "generation_id": generation_id
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error correcting generation: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


# ============================================================================
# MODEL GATEWAY ENDPOINTS (Phase 1.1)
# ============================================================================



@router.post("/gateway/generate")
async def gateway_generate(request: Request, body: dict):
    """
    Unified text generation endpoint via Model Gateway
    Routes to local Qwen, OpenAI, Anthropic, etc.
    """
    try:
        from app.services.llm.model_gateway import get_model_gateway, GenerationRequest, LLMProvider
        
        gateway = get_model_gateway()
        tenant_id = body.get("tenant_id")  # Will be used in Phase 1.3
        
        gen_request = GenerationRequest(
            prompt=body.get("prompt", ""),
            mode=body.get("mode"),
            max_tokens=body.get("max_tokens"),
            temperature=body.get("temperature"),
            validate_json=body.get("validate_json", True),
            task_type=body.get("task_type"),
            provider=LLMProvider(body.get("provider")) if body.get("provider") else None
        )
        
        result = await gateway.generate(gen_request, tenant_id=tenant_id)
        
        return {
            "status": "success",
            "response": result.response,
            "model": result.model,
            "provider": result.provider,
            "tokens_used": result.tokens_used,
            "latency_ms": result.latency_ms,
            "cost_usd": result.cost_usd
        }
        
    except Exception as e:
        logger.error(f"Gateway generate failed: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")




@router.post("/gateway/chat")
async def gateway_chat(request: Request, body: dict):
    """
    Unified chat completion endpoint via Model Gateway
    """
    try:
        from app.services.llm.model_gateway import get_model_gateway, ChatRequest, LLMProvider
        
        gateway = get_model_gateway()
        tenant_id = body.get("tenant_id")
        
        chat_request = ChatRequest(
            messages=body.get("messages", []),
            mode=body.get("mode"),
            max_tokens=body.get("max_tokens"),
            temperature=body.get("temperature"),
            provider=LLMProvider(body.get("provider")) if body.get("provider") else None
        )
        
        result = await gateway.chat(chat_request, tenant_id=tenant_id)
        
        return {
            "status": "success",
            "response": result.response,
            "model": result.model,
            "provider": result.provider,
            "tokens_used": result.tokens_used,
            "latency_ms": result.latency_ms,
            "cost_usd": result.cost_usd
        }
        
    except Exception as e:
        logger.error(f"Gateway chat failed: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")




@router.post("/gateway/embedding")
async def gateway_embedding(request: Request, body: dict):
    """
    Unified embedding endpoint via Model Gateway
    """
    try:
        from app.services.llm.model_gateway import get_model_gateway, EmbeddingRequest, LLMProvider
        
        gateway = get_model_gateway()
        tenant_id = body.get("tenant_id")
        
        embedding_request = EmbeddingRequest(
            text=body.get("text", ""),
            provider=LLMProvider(body.get("provider")) if body.get("provider") else None
        )
        
        result = await gateway.embedding(embedding_request, tenant_id=tenant_id)
        
        return {
            "status": "success",
            "embedding": result.get("embedding", []),
            "model": result.get("model", ""),
            "provider": result.get("provider", ""),
            "tokens_used": result.get("tokens_used", 0),
            "latency_ms": result.get("latency_ms", 0),
            "cost_usd": result.get("cost_usd", 0.0)
        }
        
    except Exception as e:
        logger.error(f"Gateway embedding failed: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")




@router.get("/gateway/usage")
async def get_llm_usage(
    tenant_id: Optional[str] = None,
    provider: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    limit: int = 100
):
    """
    Get LLM usage statistics
    """
    try:
        from app.services.storage.postgres_direct import get_postgres_pool
        import concurrent.futures
        
        pool = get_postgres_pool()
        if not pool:
            raise HTTPException(status_code=500, detail="Database not available")
        
        # Build query
        query = "SELECT * FROM llm_usage WHERE 1=1"
        params = []
        
        if tenant_id:
            query += " AND tenant_id = %s"
            params.append(tenant_id)
        
        if provider:
            query += " AND provider = %s"
            params.append(provider)
        
        if start_date:
            query += " AND created_at >= %s"
            params.append(start_date)
        
        if end_date:
            query += " AND created_at <= %s"
            params.append(end_date)
        
        query += " ORDER BY created_at DESC LIMIT %s"
        params.append(limit)
        
        # Execute query
        loop = asyncio.get_event_loop()
        with concurrent.futures.ThreadPoolExecutor() as executor:
            results = await loop.run_in_executor(
                executor,
                lambda: _query_usage_sync(pool, query, params)
            )
        
        return {
            "status": "success",
            "count": len(results),
            "usage": results
        }
        
    except Exception as e:
        logger.error(f"Failed to get usage stats: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")




@router.get("/training-data/export")
async def export_training_data(
    min_quality_score: int = 4,
    task_category: Optional[str] = None,
    limit: int = 1000,
    format: str = "jsonl"
):
    """
    Export high-quality generations for fine-tuning
    
    Args:
        min_quality_score: Minimum quality score (1-5, default 4)
        task_category: Filter by task category (optional)
        limit: Maximum number of records (default 1000)
        format: Export format ('jsonl' or 'json', default 'jsonl')
    """
    try:
        from app.services.storage.database import get_database_client
        from app.services.storage.postgres_direct import execute_query
        
        client = get_database_client()
        if not client or not hasattr(client, 'getconn'):
            raise HTTPException(status_code=500, detail="Database connection not available")
        
        # Build query
        query = """
            SELECT 
                id,
                prompt,
                output,
                corrected_output,
                task_category,
                endpoint,
                model,
                quality_score,
                is_approved,
                created_at
            FROM ai_generations
            WHERE (quality_score >= %s OR is_approved = true OR corrected_output IS NOT NULL)
        """
        params = [min_quality_score]
        
        if task_category:
            query += " AND task_category = %s"
            params.append(task_category)
        
        query += " ORDER BY created_at DESC LIMIT %s"
        params.append(limit)
        
        results = await execute_query(query, tuple(params))
        
        if not results:
            return {
                "status": "success",
                "count": 0,
                "data": []
            }
        
        # Format for training
        training_data = []
        for row in results:
            # Use corrected output if available (more valuable for training)
            output = row.get("corrected_output") or row.get("output")
            
            # Format as instruction/input/output
            training_entry = {
                "instruction": f"Generate {row.get('task_category', 'test cases')} based on the following requirement:",
                "input": row.get("prompt", ""),
                "output": output,
                "task_type": row.get("task_category", "unknown"),
                "quality_score": row.get("quality_score"),
                "is_approved": row.get("is_approved", False),
                "has_correction": row.get("corrected_output") is not None,
                "model": row.get("model"),
                "created_at": row.get("created_at").isoformat() if row.get("created_at") else None
            }
            training_data.append(training_entry)
        
        if format == "jsonl":
            # Return as JSONL (one JSON object per line)
            from fastapi.responses import Response
            jsonl_content = "\n".join([json.dumps(entry) for entry in training_data])
            return Response(
                content=jsonl_content,
                media_type="application/x-ndjson",
                headers={
                    "Content-Disposition": f"attachment; filename=training_data_{datetime.now().strftime('%Y%m%d_%H%M%S')}.jsonl"
                }
            )
        else:
            # Return as JSON array
            return {
                "status": "success",
                "count": len(training_data),
                "data": training_data
            }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error exporting training data: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")



@router.post("/generate-tests-enhanced")
async def generate_tests_enhanced(request: Request, body: dict):
    """
    Enhanced test generation endpoint supporting all test types with optimization features.
    Supports: manual, automation, api, performance, security, accessibility, database
    
    New Features (UI Integration):
    - Multiple test types in one request (testTypes: {ui, api, perf, a11y, security})
    - Coverage levels (smoke, balanced, deep)
    - Test plan output (scenarios, risk tags)
    - Enhanced test case format with tags and automation code
    
    Features:
    - Retry logic with fixup prompts
    - Deduplication
    - Coverage hints
    - All test types
    - Overall timeout protection (max 10 minutes total)
    """
    import asyncio
    import time
    overall_start_time = time.time()
    OVERALL_TIMEOUT = 600  # 10 minutes max for entire generation
    
    try:
        from app.services.llm.prompt.prompt_templates import (
            PROMPT_REQ_TO_MANUAL_TESTS,
            PROMPT_REQ_TO_AUTOMATION_TESTS,
            PROMPT_REQ_TO_API_TESTS,
            PROMPT_REQ_TO_PERFORMANCE_TESTS,
            PROMPT_REQ_TO_SECURITY_TESTS,
            PROMPT_REQ_TO_ACCESSIBILITY_TESTS,
            PROMPT_REQ_TO_DATABASE_TESTS
        )
        from app.services.utils.test_generation_optimizer import (
            extract_json_from_response,
            is_valid_test_case_json,
            deduplicate_test_cases,
            check_coverage_hints,
            add_coverage_hints_to_prompt,
            retry_with_fixup_prompt,
            validate_and_fix_test_cases
        )
        
        requirement = body.get("requirement", body.get("requirements", ""))
        test_type = body.get("test_type", "manual").lower()
        
        # NEW: Support multiple test types from UI - Generate for ALL selected types
        test_types = body.get("testTypes", {})
        selected_types = []
        if test_types:
            # If UI sends testTypes object, check which are enabled
            selected_types = [t for t, enabled in test_types.items() if enabled]
        
        # NEW: Coverage level support
        coverage = body.get("coverage", "balanced")  # smoke, balanced, deep
        coverage_hint = ""
        if coverage == "smoke":
            coverage_hint = "Generate only critical smoke tests (3-5 tests max)"
        elif coverage == "deep":
            coverage_hint = "Generate comprehensive regression suite (10-15 tests)"
        else:
            coverage_hint = "Generate balanced test coverage (5-8 tests)"
        
        # Default to "quick" mode to use trained model (qa-expert:7b)
        mode = body.get("mode", "quick")  # quick (7B trained), ui (14B), heavy (32B)
        project_id = body.get("project_id", "default")
        org_id = body.get("org_id", "default")
        max_retries = body.get("max_retries", 2)
        
        if not requirement:
            raise HTTPException(status_code=400, detail="requirement is required")
        
        # Map UI test types to backend test types
        type_mapping = {
            "manual": "manual",
            "ui": "automation",
            "api": "api",
            "perf": "performance",
            "a11y": "accessibility",
            "security": "security"
        }
        
        # Select appropriate prompt template
        prompt_templates = {
            "manual": PROMPT_REQ_TO_MANUAL_TESTS,
            "automation": PROMPT_REQ_TO_AUTOMATION_TESTS,
            "api": PROMPT_REQ_TO_API_TESTS,
            "performance": PROMPT_REQ_TO_PERFORMANCE_TESTS,
            "perf": PROMPT_REQ_TO_PERFORMANCE_TESTS,
            "security": PROMPT_REQ_TO_SECURITY_TESTS,
            "accessibility": PROMPT_REQ_TO_ACCESSIBILITY_TESTS,
            "a11y": PROMPT_REQ_TO_ACCESSIBILITY_TESTS,
            "database": PROMPT_REQ_TO_DATABASE_TESTS,
            "db": PROMPT_REQ_TO_DATABASE_TESTS
        }
        
        # Generate test cases for ALL selected types (or default to manual)
        all_test_cases = []
        all_model_used = None
        total_latency = 0
        coverage_hints = []  # Initialize for return statement
        
        types_to_generate = selected_types if selected_types else ["manual"]
        
        # Check overall timeout before starting
        elapsed = time.time() - overall_start_time
        if elapsed > OVERALL_TIMEOUT:
            raise HTTPException(status_code=408, detail=f"Overall timeout exceeded ({OVERALL_TIMEOUT}s). Generation cancelled.")
        
        logger.info(f"Starting generation for {len(types_to_generate)} test types: {types_to_generate}")
        print(f"[INFO] Starting generation for {len(types_to_generate)} test types: {types_to_generate}")
        
        for idx, ui_type in enumerate(types_to_generate):
            # Check timeout before each test type
            elapsed = time.time() - overall_start_time
            if elapsed > OVERALL_TIMEOUT:
                logger.warning(f"Overall timeout reached after {elapsed:.1f}s. Generated {len(all_test_cases)} test cases so far.")
                print(f"[WARN] Overall timeout reached. Stopping generation after {idx}/{len(types_to_generate)} types.")
                break
            
            backend_type = type_mapping.get(ui_type, "manual")
            base_prompt_template = prompt_templates.get(backend_type, PROMPT_REQ_TO_MANUAL_TESTS)
            
            logger.info(f"[{idx+1}/{len(types_to_generate)}] Generating {backend_type} tests (UI type: {ui_type})")
            print(f"[INFO] [{idx+1}/{len(types_to_generate)}] Generating {backend_type} tests (UI type: {ui_type})")
            
            # Check for existing test cases to get coverage hints
            existing_tests = body.get("existing_tests", [])
            if existing_tests and not coverage_hints:  # Only compute once
                coverage_hints = check_coverage_hints(requirement, existing_tests)
            
            # Build prompt with coverage hints
            base_prompt = base_prompt_template.format(requirement=requirement)
            prompt = add_coverage_hints_to_prompt(base_prompt, coverage_hints) if coverage_hints else base_prompt
            
            # NEW: Add coverage level hint to prompt
            if coverage_hint:
                prompt = f"{prompt}\n\nCoverage Requirement: {coverage_hint}"
            
            # Generate with retry logic
            start_time = time.time()
            test_cases = []
            last_error = None
            
            for attempt in range(max_retries + 1):
                try:
                    if attempt > 0:
                        # Use fixup prompt on retry
                        prompt = retry_with_fixup_prompt(base_prompt, "json")
                    
                    # Check timeout before LLM call
                    elapsed = time.time() - overall_start_time
                    if elapsed > OVERALL_TIMEOUT:
                        logger.warning(f"Timeout before LLM call for {backend_type}. Skipping.")
                        break
                    
                    # Call LLM with timeout protection
                    try:
                        result = await asyncio.wait_for(
                            ollama_service.generate(prompt, mode=mode, validate_json=False),
                            timeout=min(300, OVERALL_TIMEOUT - elapsed)  # Max 5 min per type, or remaining time
                        )
                        llm_response = result.get("response", "")
                        model_used = result.get("model", ollama_service._select_model(mode))
                        all_model_used = model_used
                    except asyncio.TimeoutError:
                        logger.error(f"Timeout generating {backend_type} tests. Skipping to next type.")
                        print(f"[ERROR] Timeout generating {backend_type} tests. Moving to next type.")
                        last_error = f"Timeout generating {backend_type} tests"
                        test_cases = []
                        break
                    
                    # Extract JSON from response
                    extracted = extract_json_from_response(llm_response)
                    
                    if extracted and is_valid_test_case_json(extracted):
                        test_cases = extracted
                        break
                    else:
                        last_error = "Invalid JSON structure"
                        if attempt < max_retries:
                            continue
                        else:
                            # Last attempt failed, try to extract what we can
                            test_cases = extracted if extracted else []
                            
                except Exception as e:
                    last_error = str(e)
                    error_str = str(e).lower()
                    
                    # AUTO-FIX: If model not found, retry with qwen3-coder:30b
                    if "model" in error_str and ("not found" in error_str or "404" in error_str):
                        logger.warning(f"Model not found error: {e}. Retrying with qwen3-coder:30b")
                        try:
                            # Force use qwen3-coder:30b directly
                            result = await ollama_service.generate(
                                prompt, 
                                mode="heavy",  # Use heavy mode which maps to qwen3-coder:30b
                                validate_json=False
                            )
                            llm_response = result.get("response", "")
                            model_used = "qwen3-coder:30b"  # Force model name
                            all_model_used = model_used
                            
                            # Extract JSON from response
                            extracted = extract_json_from_response(llm_response)
                            
                            if extracted and is_valid_test_case_json(extracted):
                                test_cases = extracted
                                break
                        except Exception as retry_error:
                            logger.error(f"Retry with qwen3-coder:30b also failed: {retry_error}")
                            last_error = f"Original: {e}, Retry: {retry_error}"
                    
                    if attempt < max_retries:
                        await asyncio.sleep(1)  # Brief delay before retry
                        continue
                    else:
                        logger.warning(f"Failed to generate {backend_type} tests: {last_error}")
                        # Continue with other types even if one fails
                        test_cases = []
            
            latency_ms = int((time.time() - start_time) * 1000)
            total_latency += latency_ms
            
            logger.info(f"Generated {len(test_cases)} {backend_type} test cases in {latency_ms}ms")
            print(f"[INFO] Generated {len(test_cases)} {backend_type} test cases in {latency_ms}ms")
            
            # Add test cases with type tag
            for tc in test_cases:
                tc["_generated_type"] = backend_type  # Track which type generated this
                all_test_cases.append(tc)
        
        # Optimize generated test cases
        if all_test_cases:
            # Validate and fix structure
            all_test_cases = validate_and_fix_test_cases(all_test_cases)
            # Deduplicate
            all_test_cases = deduplicate_test_cases(all_test_cases)
        
        # Store generation for fine-tuning
        generation_id = await store_ai_generation(
            project_id=project_id,
            prompt=f"Multi-type generation: {', '.join(types_to_generate)}",
            model=all_model_used or "unknown",
            output=json.dumps(all_test_cases),
            mode=mode,
            endpoint="/ai/generate-tests-enhanced",
            latency_ms=total_latency,
            org_id=org_id,
            task_category="multi-type"
        )
        
        # NEW: Generate test plan (scenarios and risk tags)
        test_plan = {
            "scenarios": [
                f"Test {tc.get('name', tc.get('title', 'Unknown'))}" 
                for tc in all_test_cases[:5]  # Top 5 scenarios
            ],
            "riskTags": [
                f"P{idx % 3}" if idx < 3 else "P2" 
                for idx in range(min(len(all_test_cases), 5))
            ]
        }
        
        # NEW: Enhance test cases with tags and automation code
        enhanced_test_cases = []
        for tc in all_test_cases:
            generated_type = tc.pop("_generated_type", "manual")  # Get and remove type tag
            
            # Convert all test types to steps format (some have different structures)
            steps = tc.get("steps", [])
            if not steps or len(steps) == 0:
                if generated_type == "performance":
                    # Convert performance test fields to steps
                    desc = tc.get("description", "")
                    if desc and not any(tc.get(k) for k in ['virtual_users', 'duration', 'ramp_up', 'expected_throughput']):
                        # If no structured fields but has description, create steps from description
                        steps = [
                            {
                                "action": f"Configure and execute performance test: {desc[:100]}",
                                "expectedResult": "Performance metrics meet expectations"
                            }
                        ]
                    else:
                        # Use structured fields if available
                        steps = [
                            {
                                "action": f"Configure load test: {tc.get('virtual_users', 'N/A')} virtual users, {tc.get('duration', 'N/A')}s duration, {tc.get('ramp_up', 'N/A')}s ramp-up",
                                "expectedResult": f"Test configured successfully"
                            },
                            {
                                "action": f"Execute load test and monitor: throughput >= {tc.get('expected_throughput', 'N/A')} req/s, p95 latency <= {tc.get('expected_latency_p95', 'N/A')}ms",
                                "expectedResult": f"Performance metrics meet expectations, error rate <= {tc.get('expected_error_rate', 0.01) * 100}%"
                            }
                        ]
                elif generated_type == "accessibility":
                    # Convert accessibility test fields to steps
                    desc = tc.get("description", "")
                    if desc and not any(tc.get(k) for k in ['test_method', 'wcag_guideline', 'expected_result']):
                        # If no structured fields but has description, create steps from description
                        steps = [
                            {
                                "action": f"Execute accessibility test: {desc[:100]}",
                                "expectedResult": "Test passes WCAG compliance"
                            }
                        ]
                    else:
                        # Use structured fields if available
                        test_method = tc.get("test_method", "Execute accessibility test")
                        expected_result = tc.get("expected_result", "Test passes WCAG compliance")
                        wcag_guideline = tc.get("wcag_guideline", "")
                        
                        steps = [
                            {
                                "action": f"Test {wcag_guideline}: {test_method}" if wcag_guideline else test_method,
                                "expectedResult": expected_result
                            }
                        ]
                elif generated_type == "api":
                    # Convert API test fields to steps
                    desc = tc.get("description", "")
                    if desc and not any(tc.get(k) for k in ['method', 'endpoint', 'url', 'expected_status']):
                        # If no structured fields but has description, create steps from description
                        steps = [
                            {
                                "action": f"Execute API test: {desc[:100]}",
                                "expectedResult": "API responds correctly"
                            }
                        ]
                    else:
                        # Use structured fields if available
                        http_method = tc.get("method", "GET")
                        endpoint = tc.get("endpoint", tc.get("url", "N/A"))
                        expected_status = tc.get("expected_status", "200")
                        request_body = tc.get("request_body", "")
                        expected_response = tc.get("expected_response", "")
                        
                        steps = [
                            {
                                "action": f"Send {http_method} request to {endpoint}" + (f" with body: {request_body}" if request_body else ""),
                                "expectedResult": f"Response status is {expected_status}" + (f" and response matches: {expected_response}" if expected_response else "")
                            }
                        ]
                        if tc.get("headers"):
                            steps[0]["action"] = f"Set headers: {tc.get('headers')}, then {steps[0]['action']}"
                elif generated_type == "security":
                    # Convert security test fields to steps
                    desc = tc.get("description", "")
                    if desc and not any(tc.get(k) for k in ['vulnerability', 'attack_vector', 'expected_result']):
                        # If no structured fields but has description, create steps from description
                        steps = [
                            {
                                "action": f"Execute security test: {desc[:100]}",
                                "expectedResult": "Security controls prevent vulnerabilities"
                            }
                        ]
                    else:
                        # Use structured fields if available
                        vulnerability = tc.get("vulnerability", "Security vulnerability")
                        attack_vector = tc.get("attack_vector", "Test security controls")
                        expected_result = tc.get("expected_result", "Security controls prevent vulnerability")
                        
                        steps = [
                            {
                                "action": f"Test for {vulnerability}: {attack_vector}",
                                "expectedResult": expected_result
                            }
                        ]
                elif generated_type == "manual":
                    # Manual tests should have steps, but if missing, create from description
                    if tc.get("description"):
                        steps = [
                            {
                                "action": f"Execute test: {tc.get('description', '')[:100]}",
                                "expectedResult": tc.get("expected", "Test completes successfully")
                            }
                        ]
                    else:
                        # Last resort: create generic step
                        steps = [
                            {
                                "action": "Execute manual test case",
                                "expectedResult": "Test case completes successfully"
                            }
                        ]
            
            enhanced_tc = {
                **tc,
                "steps": steps,  # Use converted steps
                "tags": tc.get("tags", []) + [generated_type],
                "automationCode": None  # Will be generated if automation type
            }
            
            # Generate automation code for automation/UI test cases
            if generated_type == "automation" and "ui" in types_to_generate:
                try:
                    # Generate Playwright code for this test case
                    playwright_prompt = f"""You are an expert in Playwright test automation. Convert the following manual test case into executable Playwright TypeScript code.

Test Case:
{json.dumps(tc, indent=2)}

Generate complete, runnable Playwright test code in TypeScript. Include:
- Proper imports (@playwright/test)
- Test structure with describe/it blocks
- Step-by-step automation matching the manual test steps
- Assertions for expected results
- Proper selectors (prefer data-testid, role, or stable selectors)

Respond ONLY with valid TypeScript code (no markdown, no explanations):"""
                    
                    code_result = await ollama_service.generate(
                        playwright_prompt,
                        mode=mode,
                        validate_json=False
                    )
                    code_text = code_result.get("response", "").strip()
                    # Remove markdown code blocks if present
                    if code_text.startswith("```"):
                        lines = code_text.split("\n")
                        code_text = "\n".join(lines[1:-1]) if lines[-1].strip() == "```" else "\n".join(lines[1:])
                    enhanced_tc["automationCode"] = code_text
                    logger.info(f"Generated automation code for test case: {tc.get('name', 'Unknown')}")
                except Exception as e:
                    logger.warning(f"Failed to generate automation code: {e}")
                    enhanced_tc["automationCode"] = None
            
            enhanced_test_cases.append(enhanced_tc)
        
        # Generate automation code for all requested test types
        generated_code = {}
        
        # Extract app_type, test_style, environment from request
        app_type = body.get("app_type", "web")
        test_style = body.get("test_style", "step-list")
        environment = body.get("environment", "staging")
        
        # Generate UI automation code (Playwright) if UI tests requested
        if "ui" in types_to_generate or "automation" in types_to_generate:
            try:
                ui_test_cases = [tc for tc in enhanced_test_cases if tc.get("_generated_type") == "automation"]
                if ui_test_cases:
                    playwright_prompt = f"""Generate complete Playwright TypeScript test code for the following test cases.
App type: {app_type}
Environment: {environment}

Test Cases:
{json.dumps(ui_test_cases[:3], indent=2)}

Generate runnable Playwright TypeScript code with:
- Proper imports and test structure
- Page object pattern if applicable
- All test steps automated
- Assertions for expected results
- Error handling

Return ONLY valid TypeScript code (no markdown):"""
                    
                    code_result = await ollama_service.generate(
                        playwright_prompt,
                        mode=mode,
                        validate_json=False
                    )
                    code_text = code_result.get("response", "").strip()
                    if code_text.startswith("```"):
                        code_text = code_text.split("```")[1].split("```")[0].strip()
                        if code_text.startswith("typescript") or code_text.startswith("ts"):
                            code_text = "\n".join(code_text.split("\n")[1:])
                    generated_code["ui_playwright_ts"] = code_text
            except Exception as e:
                logger.warning(f"Failed to generate UI code: {e}")
        
        # Generate API test code (pytest) if API tests requested
        if "api" in types_to_generate:
            try:
                api_test_cases = [tc for tc in enhanced_test_cases if tc.get("_generated_type") == "api"]
                if api_test_cases:
                    api_prompt = f"""Generate complete pytest API test code for the following test cases.
App type: {app_type}
Environment: {environment}
API Base: {body.get('api_base', f'https://api.{app_type}.example.com')}

Test Cases:
{json.dumps(api_test_cases[:3], indent=2)}

Generate runnable pytest code with:
- Proper imports (pytest, requests, etc.)
- Test fixtures and setup
- API endpoint tests
- Response validation
- Error handling

Return ONLY valid Python code (no markdown):"""
                    
                    code_result = await ollama_service.generate(
                        api_prompt,
                        mode=mode,
                        validate_json=False
                    )
                    code_text = code_result.get("response", "").strip()
                    if code_text.startswith("```"):
                        code_text = code_text.split("```")[1].split("```")[0].strip()
                        if code_text.startswith("python") or code_text.startswith("py"):
                            code_text = "\n".join(code_text.split("\n")[1:])
                    generated_code["api_pytest"] = code_text
            except Exception as e:
                logger.warning(f"Failed to generate API code: {e}")
        
        # Generate Performance test code (k6) if performance tests requested
        if "perf" in types_to_generate or "performance" in types_to_generate:
            try:
                perf_prompt = f"""Generate k6 performance test script for the following requirement.
Requirement: {requirement}
App type: {app_type}
Environment: {environment}

Generate k6 script with:
- Proper imports and setup
- Load test scenarios
- Ramp-up configuration
- Thresholds and metrics
- Error handling

Return ONLY valid JavaScript k6 code (no markdown):"""
                
                code_result = await ollama_service.generate(
                    perf_prompt,
                    mode=mode,
                    validate_json=False
                )
                code_text = code_result.get("response", "").strip()
                if code_text.startswith("```"):
                    code_text = code_text.split("```")[1].split("```")[0].strip()
                generated_code["perf_k6"] = code_text
            except Exception as e:
                logger.warning(f"Failed to generate performance code: {e}")
        
        # Generate Accessibility test code if accessibility tests requested
        if "a11y" in types_to_generate or "accessibility" in types_to_generate:
            try:
                a11y_prompt = f"""Generate accessibility test script using axe-core or Lighthouse for the following requirement.
Requirement: {requirement}
App type: {app_type}
Environment: {environment}

Generate accessibility test script with:
- axe-core integration (Playwright or Node.js)
- WCAG 2.1 AA compliance checks
- Violation reporting
- Error handling

Return ONLY valid code (no markdown):"""
                
                code_result = await ollama_service.generate(
                    a11y_prompt,
                    mode=mode,
                    validate_json=False
                )
                code_text = code_result.get("response", "").strip()
                if code_text.startswith("```"):
                    code_text = code_text.split("```")[1].split("```")[0].strip()
                generated_code["a11y_script"] = code_text
            except Exception as e:
                logger.warning(f"Failed to generate accessibility code: {e}")
        
        # Generate Security test config (ZAP) if security tests requested
        if "security" in types_to_generate:
            try:
                security_prompt = f"""Generate ZAP/Burp security scan configuration for the following requirement.
Requirement: {requirement}
App type: {app_type}
Environment: {environment}

Generate security scan config with:
- Target URLs
- Scan policies
- Authentication setup (if needed)
- Focus areas (OWASP Top 10)

Return ONLY valid configuration (no markdown):"""
                
                code_result = await ollama_service.generate(
                    security_prompt,
                    mode=mode,
                    validate_json=False
                )
                code_text = code_result.get("response", "").strip()
                if code_text.startswith("```"):
                    code_text = code_text.split("```")[1].split("```")[0].strip()
                generated_code["security_zap_config"] = code_text
            except Exception as e:
                logger.warning(f"Failed to generate security code: {e}")
        
        return {
            "status": "success",
            "test_type": types_to_generate[0] if types_to_generate else "manual",  # Primary type
            "test_types_generated": types_to_generate,  # All types generated
            "test_cases": enhanced_test_cases,  # Return enhanced format
            "code": generated_code,  # NEW: Structured automation code
            "testPlan": test_plan,  # NEW: Test plan with scenarios and risk tags
            "count": len(enhanced_test_cases),
            "model": all_model_used or "unknown",
            "latency_ms": total_latency,
            "generation_id": generation_id,
            "coverage": coverage,  # NEW: Return coverage level used
            "coverage_hints_applied": coverage_hints if existing_tests else [],
            "optimizations": {
                "deduplicated": True,
                "validated": True,
                "multi_type": len(types_to_generate) > 1
            }
        }
        
    except Exception as e:
        logger.error(f"Error in generate-tests-enhanced: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")




@router.post("/generate-test-plan", response_model=ReqToTestPlanResponse)
async def generate_test_plan(payload: ReqToTestPlanRequest):
    """
    Task 1: Requirement → structured test plan (scenarios, data, coverage).
    """
    try:
        prompt = build_req_to_testplan_prompt(payload.input)
        
        # Call LLM service - your routing (use 30B coder)
        raw = await ollama_service.generate_json(
            prompt,
            mode="heavy"  # Use heavy mode for 30B model
        )
        
        # generate_json returns parsed JSON directly
        # Handle both dict with "output" key and direct dict
        if isinstance(raw, dict) and "output" in raw:
            output_data = raw["output"]
        elif isinstance(raw, dict) and "test_plan_id" in raw:
            # Direct test plan structure
            output_data = raw
        else:
            # Fallback: use raw as-is
            output_data = raw if isinstance(raw, dict) else {}
        
        test_plan = ReqToTestPlanOutput(**output_data)
        
        return ReqToTestPlanResponse(
            test_plan=test_plan,
            raw_model_output=raw
        )
    except Exception as exc:
        logger.error(f"Error generating test plan: {str(exc)}")
        raise HTTPException(status_code=500, detail=str(exc))




@router.post("/generate-tests", response_model=ReqToTestsResponse)
async def generate_tests(payload: ReqToTestsRequest):
    """
    Task 2: Requirement (+optional plan) → concrete tests + code across UI, API, performance, accessibility, and security.
    """
    try:
        prompt = build_req_to_tests_prompt(payload.input)
        
        # Call LLM service - still going through 30B coder
        raw = await ollama_service.generate_json(
            prompt,
            mode="heavy"
        )
        
        # generate_json returns parsed JSON directly
        # Handle both dict with "output" key and direct dict with "tests" key
        if isinstance(raw, dict) and "output" in raw:
            output_data = raw["output"]
        elif isinstance(raw, dict) and "tests" in raw:
            # Direct tests structure
            output_data = raw
        else:
            # Fallback: wrap in output structure
            output_data = {"tests": raw if isinstance(raw, list) else []}
        
        output = ReqToTestsOutput(**output_data)
        
        return ReqToTestsResponse(
            tests=output.tests,
            raw_model_output=raw
        )
    except Exception as exc:
        logger.error(f"Error generating tests: {str(exc)}")
        raise HTTPException(status_code=500, detail=str(exc))




@router.post("/url-discover")
async def url_discover(request: Request, body: dict):
    """
    Auto-discover and generate tests from a website URL
    
    Features:
    - Crawl and map pages
    - Generate UI tests for key flows
    - Run accessibility checks
    - Basic security + perf smoke tests
    """
    try:
        base_url = body.get("url", "")
        if not base_url:
            raise HTTPException(status_code=400, detail="URL is required")
        
        discover_options = body.get("discoverOptions", {})
        crawl = discover_options.get("crawl", True)
        generate_ui = discover_options.get("generateUI", True)
        check_a11y = discover_options.get("checkA11y", False)
        check_perf = discover_options.get("checkPerf", False)
        check_security = discover_options.get("checkSecurity", False)
        
        # TODO: Implement actual crawling and discovery
        # For now, return placeholder response
        return {
            "status": "success",
            "url": base_url,
            "siteMap": {
                "pages": [
                    {"url": base_url, "title": "Home", "depth": 0}
                ]
            },
            "generatedTests": [],
            "a11yIssues": [],
            "perfMetrics": {},
            "securityFindings": [],
            "message": "URL discovery feature coming soon - placeholder response"
        }
    except Exception as e:
        logger.error(f"Error in url-discover: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/tests/job/{job_id}/status")
async def get_job_status(job_id: str):
    """Get status of a queued test execution job"""
    try:
        from app.services.executors.test_executor_queue import get_executor_queue
        queue = get_executor_queue()
        status = await queue.get_job_status(job_id)
        if not status:
            raise HTTPException(status_code=404, detail="Job not found")
        return status
    except Exception as e:
        logger.error(f"Error getting job status: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")


# Health endpoints removed - use /health/database and /health/diagnostic from health_api router instead
# The diagnostic_check() function has been removed as it's a duplicate of the one in health_api.py


@router.post("/tests/validate-code")
async def validate_code(request: Request, body: dict):
    """
    Validate generated test code before execution
    
    Validates:
    - TypeScript/JavaScript syntax
    - Playwright dry-run (test discovery)
    - Linting (if available)
    - Returns suggestions for fixes
    """
    try:
        from app.services.utils.code_validator import get_code_validator
        
        code = body.get("code", "")
        project_type = body.get("projectType", "playwright-ts")
        
        if not code:
            raise HTTPException(status_code=400, detail="Code is required")
        
        validator = get_code_validator()
        result = await validator.validate_playwright_code(code, project_type)
        
        return {
            "valid": result["valid"],
            "errors": result["errors"],
            "warnings": result["warnings"],
            "suggestions": result["suggestions"],
            "dry_run_output": result["dry_run_output"]
        }
    except Exception as e:
        logger.error(f"Error in validate-code: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")




@router.post("/convert-to-playwright")
async def convert_manual_to_playwright(request: Request, body: dict):
    """
    Convert manual test case to Playwright TypeScript code
    Enhanced with validation and compilation checks
    """
    try:
        from app.services.llm.prompt.prompt_templates import PROMPT_MANUAL_TO_PLAYWRIGHT
        
        test_case = body.get("test_case", body)
        # Default to "quick" mode to use trained model (qa-expert:7b)
        mode = body.get("mode", "quick")  # 'quick' (trained model), 'ui' (14B), or 'heavy' (32B)
        project_id = body.get("project_id", "default")
        org_id = body.get("org_id", "default")
        
        # Log mode selection
        print(f"[INFO] REQUIREMENT-TO-TESTCASES - Mode: {mode}")
        logger.info(f"[INFO] REQUIREMENT-TO-TESTCASES - Mode: {mode}")
        
        if not test_case:
            raise HTTPException(status_code=400, detail="test_case is required")
        
        # Format prompt
        prompt = PROMPT_MANUAL_TO_PLAYWRIGHT.format(test_case=json.dumps(test_case, indent=2))
        
        # Generate Playwright code
        start_time = time.time()
        result = await ollama_service.generate(prompt, mode=mode, validate_json=False)
        latency_ms = int((time.time() - start_time) * 1000)
        
        playwright_code = result.get("response", "")
        model_used = result.get("model", ollama_service._select_model(mode))
        
        # Store generation for fine-tuning
        await store_ai_generation(
            project_id=project_id,
            prompt=prompt,
            model=model_used,
            output=playwright_code,
            mode=mode,
            endpoint="/ai/convert-to-playwright",
            latency_ms=latency_ms,
            org_id=org_id
        )
        
        return {
            "status": "success",
            "code": playwright_code,
            "model": model_used,
            "latency_ms": latency_ms
        }
        
    except Exception as e:
        logger.error(f"Error in convert-to-playwright: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")




@router.post("/generate-and-execute-automated")
async def generate_and_execute_automated(request: Request, body: dict):
    """
    Generate automated test script from description and execute it immediately.
    Creates test run and stores results in dashboard.
    """
    try:
        description = body.get("description", "")
        test_name = body.get("name", "Generated Test")
        project_id = body.get("project_id")
        org_id = body.get("org_id")
        app_url = body.get("app_url", "https://www.saucedemo.com")
        
        if not description:
            raise HTTPException(status_code=400, detail="Description required")
        
        org_id, proj_id = await ensure_default_org_project()
        project_id = project_id or proj_id
        
        # 1. Generate Playwright code from description
        prompt = f"""You are an expert in Playwright test automation. Generate executable Playwright TypeScript code for the following test scenario.

Test Description: {description}
Application URL: {app_url}

Generate complete, runnable Playwright test code in TypeScript. Include:
- Proper imports from '@playwright/test'
- Test structure with test() or describe() blocks
- Step-by-step automation matching the description
- Assertions for expected results
- Proper selectors and waits
- Error handling

Respond ONLY with valid TypeScript code (no markdown, no explanations, no code blocks):"""
        
        start_time = time.time()
        # Use "quick" mode to leverage trained model (qa-expert:7b)
        selected_model = ollama_service._select_model("quick")
        print(f"[INFO] GENERATE-AND-EXECUTE - Mode: quick, Selected model: {selected_model}")
        logger.info(f"[INFO] GENERATE-AND-EXECUTE - Mode: quick, Selected model: {selected_model}")
        
        result = await ollama_service.generate(prompt, mode="quick", validate_json=False)
        latency_ms = int((time.time() - start_time) * 1000)
        
        playwright_code = result.get("response", "")
        model_used = result.get("model", selected_model)
        
        # Log which model was used (for verification)
        print(f"[INFO] GENERATE-AND-EXECUTE - Model used: {model_used}")
        logger.info(f"[INFO] GENERATE-AND-EXECUTE - Model used: {model_used}")
        if "qa-expert" in model_used.lower():
            print(f"[OK] Using trained model: {model_used}")
            logger.info(f"[OK] Using trained model: {model_used}")
        else:
            print(f"[WARN]  Using base model instead of trained model: {model_used}")
            logger.warning(f"⚠️  Using base model instead of trained model: {model_used}")
        
        # Extract code from markdown if needed
        import re
        code_match = re.search(r'```(?:typescript|ts)?\n(.*?)\n```', playwright_code, re.DOTALL)
        if code_match:
            playwright_code = code_match.group(1)
        
        # Log the generated code for debugging
        print(f"[INFO] Generated Playwright code (first 500 chars): {playwright_code[:500]}")
        logger.info(f"Generated Playwright code: {playwright_code[:1000]}")
        
        # 2. Parse Playwright code to extract test steps using AI
        # Ask the model to extract structured steps from the generated code
        parse_prompt = f"""You are a test automation expert. Extract structured test steps from the following Playwright TypeScript code.

Playwright Code:
{playwright_code}

Application URL: {app_url}

Extract each step and convert it to a structured format. For each step, identify:
- action: The action being performed (navigate, click, fill, type, wait, etc.)
- selector: The CSS selector or locator used
- value: Any text/value being entered (if applicable)
- expected: What should happen after this step

Return ONLY a valid JSON array with this structure:
[
  {{
    "action": "navigate|click|fill|type|wait|press",
    "selector": "CSS selector or locator",
    "value": "text to enter (if applicable)",
    "expected": "expected result"
  }}
]

If the code has page.goto(), the first step should be navigate with url in data.
If the code has page.click(), extract the selector.
If the code has page.fill() or page.type(), extract selector and value.
If the code has expect(), extract the expected result.

Return ONLY the JSON array, no markdown, no explanations:"""
        
        print(f"[INFO] Parsing Playwright code to extract steps...")
        logger.info("Parsing Playwright code to extract steps")
        
        # Use robust JSON extraction (handles truncation, markdown, etc.)
        from app.services.utils.test_generation_optimizer import extract_json_from_response
        
        try:
            parse_result = await ollama_service.generate(parse_prompt, mode="quick", validate_json=False)
            steps_json = parse_result.get("response", "")
        except Exception as parse_error:
            logger.warning(f"Generation failed, trying with validate_json=False: {str(parse_error)}")
            parse_result = await ollama_service.generate(parse_prompt, mode="quick", validate_json=False)
            steps_json = parse_result.get("response", "")
        
        print(f"[INFO] Parse result (first 500 chars): {steps_json[:500]}")
        logger.info(f"Parse result: {steps_json[:1000]}")
        
        # Extract JSON from response using robust extraction
        try:
            steps_data = extract_json_from_response(steps_json)
            
            if not steps_data or not isinstance(steps_data, list):
                # If extraction failed, try manual parsing
                logger.warning("extract_json_from_response returned empty, trying manual parsing")
                json_match = re.search(r'\[.*?\]', steps_json, re.DOTALL)
                if json_match:
                    try:
                        steps_data = json.loads(json_match.group(0))
                    except json.JSONDecodeError:
                        # Try to fix truncated JSON by closing brackets
                        partial_json = json_match.group(0)
                        # Count brackets to see if we need to close
                        open_brackets = partial_json.count('[') - partial_json.count(']')
                        open_braces = partial_json.count('{') - partial_json.count('}')
                        # Close incomplete objects/arrays
                        for _ in range(open_braces):
                            partial_json += '}'
                        for _ in range(open_brackets):
                            partial_json += ']'
                        try:
                            steps_data = json.loads(partial_json)
                        except:
                            raise ValueError("Could not parse JSON even after fixing")
                else:
                    raise ValueError("No JSON array found in response")
            
            if not isinstance(steps_data, list):
                raise ValueError(f"Expected list, got {type(steps_data)}")
            
            if len(steps_data) == 0:
                raise ValueError("Empty steps array")
            
            print(f"✅ Parsed {len(steps_data)} steps from Playwright code")
            logger.info(f"Parsed {len(steps_data)} steps from Playwright code: {steps_data}")
            
            # Convert to TestStep objects
            steps = []
            for i, step_data in enumerate(steps_data):
                action = step_data.get('action', '').lower()
                selector = step_data.get('selector', '')
                value = step_data.get('value', '')
                expected = step_data.get('expected', '')
                
                # Build data dict based on action
                step_data_dict = {}
                if 'navigate' in action or 'go' in action:
                    step_data_dict['url'] = app_url
                elif selector:
                    step_data_dict['selector'] = selector
                if value:
                    step_data_dict['value'] = value
                
                # Extract locator hints from selector
                locator_hints = []
                if selector:
                    # If selector has multiple options (comma-separated), split them
                    if ',' in selector:
                        locator_hints = [s.strip() for s in selector.split(',')]
                    else:
                        locator_hints = [selector]
                
                steps.append(TestStep(
                    action=step_data.get('action', ''),
                    data=step_data_dict,
                    expected=expected,
                    locator_hints=locator_hints
                ))
            
            if not steps:
                raise ValueError("No steps extracted from Playwright code")
                
        except Exception as parse_error:
            import traceback
            error_traceback = traceback.format_exc()
            logger.error(f"Failed to parse Playwright code: {str(parse_error)}")
            logger.error(f"Full traceback:\n{error_traceback}")
            print(f"[WARN] Failed to parse Playwright code, falling back to description parsing: {str(parse_error)}")
            print(f"Full traceback:\n{error_traceback}")
            
            # Fallback: create steps from description
            steps = []
            step_lines = description.split('.')
            for i, line in enumerate(step_lines, 1):
                if line.strip():
                    steps.append(TestStep(
                        action=line.strip(),
                        data={"url": app_url} if i == 1 else {},
                        expected="",
                        locator_hints=[]
                    ))
            
            if not steps:
                steps = [
                    TestStep(
                        action=f"Execute test: {description}",
                        data={"url": app_url},
                        expected="Test completes successfully",
                        locator_hints=[]
                    )
                ]
            
            print(f"[WARN] Using fallback: created {len(steps)} steps from description")
            logger.warning(f"Using fallback: created {len(steps)} steps from description")
        
        # Log steps before execution
        print(f"[INFO] Created {len(steps)} test steps:")
        for i, step in enumerate(steps, 1):
            print(f"   {i}. {step.action} - selector: {step.data.get('selector', 'N/A')}, data: {step.data}")
        logger.info(f"Created {len(steps)} test steps: {[s.action for s in steps]}")
        
        # 3. Create test run
        from app.services.storage.test_results_storage import store_test_run, store_test_run_step
        from app.services.storage.postgres_direct import execute_update
        
        run_name = f"Auto-Generated: {test_name}"
        started_at = datetime.utcnow().isoformat()
        
        # Create test run - ensure it's created in database
        run_id = await store_test_run(
            project_id=project_id,
            name=run_name,
            status="running",
            environment="local",
            started_at=started_at,
            created_by="22222222-2222-2222-2222-222222222222"  # DEFAULT_USER_ID
        )
        
        # If store_test_run failed, try direct insert
        if not run_id:
            logger.warning("store_test_run returned None, trying direct insert")
            try:
                from app.services.storage.postgres_direct import execute_insert, get_postgres_pool
                pool = get_postgres_pool()
                if pool:
                    run_data = {
                        "project_id": project_id,
                        "name": run_name,
                        "status": "running",
                        "environment": "local",
                        "started_at": started_at,
                        "created_by": "22222222-2222-2222-2222-222222222222"
                    }
                    run_id = await execute_insert("test_runs", run_data)
                    logger.info(f"Created test run via direct insert: {run_id}")
                else:
                    # Generate UUID as fallback
                    run_id = str(uuid.uuid4())
                    logger.warning(f"No database pool, using generated UUID: {run_id}")
            except Exception as e:
                logger.error(f"Failed to create test run: {str(e)}")
                run_id = str(uuid.uuid4())
                logger.warning(f"Using generated UUID as fallback: {run_id}")
        
        if not run_id:
            run_id = str(uuid.uuid4())
        
        print(f"[INFO] Created test run: {run_id}")
        logger.info(f"Test run ID: {run_id}")
        
        # 4. Create test case in database first (required for foreign key)
        case_id = str(uuid.uuid4())
        
        # Create test case record in database - CRITICAL: must succeed before execution
        print(f"[INFO] Creating test case in database: {case_id}")
        logger.info(f"Creating test case in database: {case_id}")
        
        test_case_created = False
        try:
            from app.services.storage.postgres_direct import execute_insert, get_postgres_pool
            pool = get_postgres_pool()
            if not pool:
                raise Exception("No database pool available")
            
            test_case_data = {
                "id": case_id,
                "project_id": project_id,
                "title": test_name,
                "description": description,
                "test_type": "automated",
                "priority": "P2",
                "tags": ["automated", "ai-generated"],
                "status": "active",
                "created_by": "22222222-2222-2222-2222-222222222222"
            }
            
            print(f"[INFO] Attempting to insert test case with data: {list(test_case_data.keys())}")
            logger.info(f"Attempting to insert test case: {test_case_data}")
            
            created_case_id = await execute_insert("test_cases", test_case_data)
            
            if created_case_id:
                logger.info(f"✅ Created test case in database: {created_case_id}")
                case_id = created_case_id
                test_case_created = True
                print(f"✅ Created test case: {case_id}")
            else:
                raise Exception("execute_insert returned None - test case not created")
                
        except Exception as e:
            import traceback
            error_traceback = traceback.format_exc()
            logger.error(f"❌ CRITICAL: Could not create test case in database: {str(e)}")
            logger.error(f"Full traceback:\n{error_traceback}")
            print(f"[ERROR] CRITICAL ERROR: Could not create test case: {str(e)}")
            print(f"Full traceback:\n{error_traceback}")
            # Don't continue if test case creation failed - we need it for foreign key
            raise HTTPException(
                status_code=500,
                detail="Failed to create test case in database. Cannot proceed with test execution."
            )
        
        if not test_case_created:
            raise HTTPException(
                status_code=500,
                detail="Test case creation failed - cannot proceed with test execution"
            )
        
        print(f"✅ Test case verified in database: {case_id}")
        logger.info(f"Test case verified in database: {case_id}")
        
        # Use PlaywrightTestCase (from playwright_runner) not the Pydantic TestCase model
        test_case = PlaywrightTestCase(
            case_id=case_id,
            title=test_name,
            description=description,
            priority="P2",  # Default priority
            tags=["automated", "ai-generated"],  # Default tags
            steps=steps
        )
        
        runner = PlaywrightRunner()
        try:
            print(f"🔧 Initializing Playwright runner...")
            logger.info("Initializing Playwright runner")
            await runner.initialize()
            print(f"✅ Playwright runner initialized")
            logger.info("Playwright runner initialized successfully")
        except Exception as init_error:
            import traceback
            error_traceback = traceback.format_exc()
            logger.error(f"Failed to initialize Playwright: {str(init_error)}")
            logger.error(f"Traceback:\n{error_traceback}")
            print(f"[ERROR] Failed to initialize Playwright: {str(init_error)}")
            print(f"Full traceback:\n{error_traceback}")
            raise HTTPException(
                status_code=500, 
                detail=f"Failed to initialize Playwright browser: {str(init_error)}. This might be a Windows compatibility issue. Check server logs for details."
            )
        
        try:
            # Execute test
            print(f"🚀 Executing test case: {test_case.title}")
            logger.info(f"Executing test case: {test_case.title}")
            execution_result = await runner.run_test_case(test_case)
            print(f"✅ Test execution completed: {execution_result.status}")
            logger.info(f"Test execution completed: {execution_result.status}")
            
            # Store results in database
            # Verify run_id exists in database before storing step
            try:
                from app.services.storage.postgres_direct import get_postgres_pool, execute_query
                pool = get_postgres_pool()
                if pool:
                    # Verify run exists
                    verify_query = "SELECT id FROM test_runs WHERE id = %s"
                    verify_result = await execute_query(verify_query, (run_id,))
                    if not verify_result or len(verify_result) == 0:
                        logger.warning(f"Test run {run_id} does not exist in database, creating it now")
                        # Create the run now
                        run_data = {
                            "id": run_id,
                            "project_id": project_id,
                            "name": run_name,
                            "status": "running",
                            "environment": "local",
                            "started_at": started_at,
                            "created_by": "22222222-2222-2222-2222-222222222222"  # DEFAULT_USER_ID
                        }
                        from app.services.storage.postgres_direct import execute_insert
                        created_run_id = await execute_insert("test_runs", run_data)
                        if created_run_id:
                            logger.info(f"✅ Created missing test run: {created_run_id}")
                            run_id = created_run_id
            except Exception as e:
                logger.warning(f"Could not verify test run existence: {str(e)}")
            
            # Log execution result details
            print(f"[INFO] Execution result - Status: {execution_result.status}, Error: {execution_result.error}")
            print(f"[INFO] Execution logs: {execution_result.logs[:3] if execution_result.logs else 'None'}")
            logger.info(f"Execution result - Status: {execution_result.status}, Error: {execution_result.error}")
            if execution_result.logs:
                logger.info(f"Execution logs: {execution_result.logs}")
            
            await store_test_run_step(
                run_id=run_id,
                case_id=case_id,
                title=test_case.title,
                status=execution_result.status,
                duration_ms=execution_result.duration,
                error_message=execution_result.error,
                stdout="\n".join(execution_result.logs) if execution_result.logs else None,
                started_at=started_at,
                completed_at=datetime.utcnow().isoformat()
            )
            
            # Update test run status
            final_status = "passed" if execution_result.status == "passed" else "failed"
            try:
                from app.services.storage.postgres_direct import get_postgres_pool
                pool = get_postgres_pool()
                if pool:
                    conn = pool.getconn()
                    try:
                        with conn.cursor() as cur:
                            update_query = """
                                UPDATE test_runs 
                                SET status = %s, completed_at = NOW(), updated_at = NOW()
                                WHERE id = %s
                            """
                            cur.execute(update_query, (final_status, run_id))
                            conn.commit()
                    finally:
                        pool.putconn(conn)
            except Exception as e:
                logger.warning(f"Could not update test run status: {str(e)}")
            
            return {
                "status": "success",
                "test_run_id": run_id,
                "test_case_id": case_id,
                "execution_result": {
                    "status": execution_result.status,
                    "duration": execution_result.duration,
                    "error": execution_result.error,
                    "logs": execution_result.logs
                },
                "generated_code": playwright_code,
                "model": model_used,
                "latency_ms": latency_ms
            }
            
        finally:
            await runner.cleanup()
            
    except Exception as e:
        import traceback
        error_traceback = traceback.format_exc()
        logger.error(f"Error in generate-and-execute-automated: {str(e)}")
        logger.error(f"Full traceback:\n{error_traceback}")
        print(f"[ERROR] ERROR in generate-and-execute-automated: {str(e)}")
        print(f"Full traceback:\n{error_traceback}")
        raise HTTPException(status_code=500, detail="Internal server error. Check server logs for details.")



@router.get("/evaluation-summary")
async def get_evaluation_summary(project_id: Optional[str] = None):
    """
    Get evaluation summary from ai_generations table
    Useful for monitoring LLM performance and quality
    """
    try:
        from app.services.storage.postgres_direct import execute_query, get_postgres_pool
        
        org_id, proj_id = await ensure_default_org_project()
        project_id = project_id or proj_id
        
        pool = get_postgres_pool()
        if not pool:
            return {"summary": {}, "error": "Database not available"}
        
        query = """
            SELECT 
                model,
                endpoint,
                COUNT(*) as total_calls,
                AVG(latency_ms) as avg_latency_ms,
                MIN(latency_ms) as min_latency_ms,
                MAX(latency_ms) as max_latency_ms,
                COUNT(CASE WHEN latency_ms > 10000 THEN 1 END) as slow_calls
            FROM ai_generations
            WHERE project_id = %s
            GROUP BY model, endpoint
            ORDER BY total_calls DESC
        """
        
        results = await execute_query(query, (project_id,))
        
        summary = {
            "project_id": project_id,
            "models": {},
            "endpoints": {},
            "total_generations": 0
        }
        
        for row in results or []:
            model = row.get("model", "unknown")
            endpoint = row.get("endpoint", "unknown")
            total_calls = row.get("total_calls", 0)
            
            summary["total_generations"] += total_calls
            
            if model not in summary["models"]:
                summary["models"][model] = {
                    "total_calls": 0,
                    "avg_latency_ms": 0,
                    "endpoints": {}
                }
            
            summary["models"][model]["total_calls"] += total_calls
            summary["models"][model]["avg_latency_ms"] = row.get("avg_latency_ms", 0)
            summary["models"][model]["endpoints"][endpoint] = {
                "calls": total_calls,
                "avg_latency_ms": row.get("avg_latency_ms", 0),
                "min_latency_ms": row.get("min_latency_ms", 0),
                "max_latency_ms": row.get("max_latency_ms", 0),
                "slow_calls": row.get("slow_calls", 0)
            }
            
            if endpoint not in summary["endpoints"]:
                summary["endpoints"][endpoint] = {
                    "total_calls": 0,
                    "models": {}
                }
            
            summary["endpoints"][endpoint]["total_calls"] += total_calls
            summary["endpoints"][endpoint]["models"][model] = total_calls
        
        return summary
        
    except Exception as e:
        logger.error(f"Error getting evaluation summary: {str(e)}")
        return {"summary": {}, "error": str(e)}



