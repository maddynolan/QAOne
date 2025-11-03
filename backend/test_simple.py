#!/usr/bin/env python3

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uuid
import time
import json
from typing import List, Optional, Dict, Any

app = FastAPI(
    title="QAOne AI & Runs API - Simple Test",
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

class GenerateTestsRequest(BaseModel):
    org_id: str
    project_id: str
    requirements: str
    test_type: Optional[str] = "automated"  # automated, manual, api
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

@app.get("/health")
async def health_check():
    return {"status": "ok", "message": "Simple backend is running"}

@app.post("/ai/generate-tests")
async def generate_tests(body: GenerateTestsRequest):
    """Generate structured test cases from requirements and context with code preview"""
    try:
        from enhanced_ai_generator import (
            generate_playwright_code, 
            generate_manual_test_steps, 
            generate_api_test_code,
            get_suggested_test_websites
        )
        
        requirements = body.requirements
        test_type = body.test_type or "automated"
        context = body.context or {}
        app_url = context.get("app_url", "https://www.saucedemo.com")
        context["app_url"] = app_url
        
        # Generate code based on test type
        generated_code = None
        manual_steps = None
        suggested_websites = get_suggested_test_websites(requirements.lower())
        
        if test_type == "automated":
            generated_code = generate_playwright_code(requirements, context)
        elif test_type == "manual":
            manual_steps = generate_manual_test_steps(requirements, context)
        elif test_type == "api":
            generated_code = generate_api_test_code(requirements, context)
        
        # Generate traditional test case structure for compatibility
        test_cases = []
        
        if "checkout" in requirements.lower() or "e-commerce" in requirements.lower():
            # E-commerce checkout test case
            test_case = TestCase(
                case_id=str(uuid.uuid4()),
                title="E-commerce Checkout Process Test",
                description="Complete checkout flow from cart to payment completion",
                priority="P1",
                tags=["ai-generated", "e2e", "checkout", "critical"],
                steps=[
                    TestStep(
                        action="Navigate to shopping cart",
                        data={"url": f"{app_url}/cart"},
                        expected="Cart page loads with items",
                        locator_hints=["#cart-page", ".cart-items", "[data-testid='cart']"]
                    ),
                    TestStep(
                        action="Click checkout button",
                        data={"selector": "#checkout-btn"},
                        expected="Checkout form is displayed",
                        locator_hints=["#checkout-btn", "button[data-testid='checkout']"]
                    ),
                    TestStep(
                        action="Fill shipping information",
                        data={
                            "name": "John Doe",
                            "address": "123 Main St",
                            "city": "New York",
                            "zip": "10001"
                        },
                        expected="Shipping form is completed",
                        locator_hints=["#shipping-form", "input[name='name']", ".shipping-section"]
                    ),
                    TestStep(
                        action="Select payment method",
                        data={"method": "credit-card"},
                        expected="Payment form is displayed",
                        locator_hints=["#payment-method", "input[type='radio']", ".payment-section"]
                    ),
                    TestStep(
                        action="Enter payment details",
                        data={
                            "card_number": "4111111111111111",
                            "expiry": "12/25",
                            "cvv": "123"
                        },
                        expected="Payment details are entered",
                        locator_hints=["#card-number", "input[name='cvv']", ".payment-form"]
                    ),
                    TestStep(
                        action="Submit order",
                        data={"selector": "#submit-order"},
                        expected="Order confirmation page is displayed",
                        locator_hints=["#submit-order", "button[type='submit']", ".order-confirmation"]
                    )
                ]
            )
            test_cases.append(test_case)
            
        elif "login" in requirements or "authentication" in requirements:
            # Login/authentication test case
            test_case = TestCase(
                case_id=str(uuid.uuid4()),
                title="User Authentication Test",
                description="Test user login with valid and invalid credentials",
                priority="P1",
                tags=["ai-generated", "auth", "login", "security"],
                steps=[
                    TestStep(
                        action="Navigate to login page",
                        data={"url": f"{app_url}/login"},
                        expected="Login page loads successfully",
                        locator_hints=["#login-page", ".login-form", "[data-testid='login']"]
                    ),
                    TestStep(
                        action="Enter valid credentials",
                        data={
                            "username": "testuser@example.com",
                            "password": "password123"
                        },
                        expected="Credentials are entered",
                        locator_hints=["#username", "#password", "input[name='email']"]
                    ),
                    TestStep(
                        action="Click login button",
                        data={"selector": "#login-btn"},
                        expected="User is logged in successfully",
                        locator_hints=["#login-btn", "button[type='submit']", ".login-button"]
                    ),
                    TestStep(
                        action="Verify dashboard access",
                        data={},
                        expected="Dashboard page is displayed",
                        locator_hints=["#dashboard", ".user-dashboard", "[data-testid='dashboard']"]
                    )
                ]
            )
            test_cases.append(test_case)
            
        elif "search" in requirements:
            # Search functionality test case
            test_case = TestCase(
                case_id=str(uuid.uuid4()),
                title="Search Functionality Test",
                description="Test search functionality with various queries",
                priority="P2",
                tags=["ai-generated", "search", "functional"],
                steps=[
                    TestStep(
                        action="Navigate to search page",
                        data={"url": f"{app_url}/search"},
                        expected="Search page loads successfully",
                        locator_hints=["#search-page", ".search-form", "[data-testid='search']"]
                    ),
                    TestStep(
                        action="Enter search query",
                        data={"query": "test product"},
                        expected="Search query is entered",
                        locator_hints=["#search-input", "input[name='q']", ".search-field"]
                    ),
                    TestStep(
                        action="Click search button",
                        data={"selector": "#search-btn"},
                        expected="Search results are displayed",
                        locator_hints=["#search-btn", "button[type='submit']", ".search-button"]
                    ),
                    TestStep(
                        action="Verify search results",
                        data={},
                        expected="Relevant results are shown",
                        locator_hints=["#search-results", ".result-item", "[data-testid='results']"]
                    )
                ]
            )
            test_cases.append(test_case)
            
        else:
            # Generic test case
            test_case = TestCase(
                case_id=str(uuid.uuid4()),
                title=f"Functional Test: {body.requirements[:50]}...",
                description=f"AI-generated test for: {body.requirements}",
                priority="P2",
                tags=["ai-generated", "functional"],
                steps=[
                    TestStep(
                        action="Navigate to application",
                        data={"url": app_url},
                        expected="Application loads successfully",
                        locator_hints=["#app", ".main-content", "[data-testid='app']"]
                    ),
                    TestStep(
                        action="Verify page elements",
                        data={},
                        expected="Page elements are visible",
                        locator_hints=["#main", ".content", "[data-testid='main']"]
                    ),
                    TestStep(
                        action="Test basic functionality",
                        data={},
                        expected="Basic functionality works",
                        locator_hints=["button", ".interactive", "[data-testid='interactive']"]
                    )
                ]
            )
            test_cases.append(test_case)
        
        # Return response with code and test cases for review
        response = {
            "cases": test_cases,
            "status": "success",
            "test_type": test_type,
            "suggested_websites": suggested_websites
        }
        
        if generated_code:
            response["generated_code"] = generated_code
            response["code_language"] = "typescript" if test_type == "api" else "typescript"
        
        if manual_steps:
            response["manual_steps"] = manual_steps
        
        return response
        
    except Exception as e:
        print(f"Error generating tests: {str(e)}")
        return {"error": str(e), "status": "error"}

@app.post("/tests/execute")
async def execute_tests(body: dict):
    """Execute test cases using Playwright"""
    try:
        # Import Playwright runner
        import sys
        import os
        sys.path.append(os.path.dirname(os.path.abspath(__file__)))
        
        from app.services.playwright_runner import PlaywrightRunner, TestCase, TestStep
        import asyncio
        
        org_id = body.get("org_id", "demo")
        project_id = body.get("project_id", "demo")
        test_cases_data = body.get("test_cases", [])
        
        # Convert API test cases to Playwright TestCase objects
        playwright_test_cases = []
        for tc_data in test_cases_data:
            steps = []
            for step_data in tc_data.get("steps", []):
                step = TestStep(
                    action=step_data.get("action", ""),
                    data=step_data.get("data", {}),
                    expected=step_data.get("expected", ""),
                    locator_hints=step_data.get("locator_hints", [])
                )
                steps.append(step)
            
            test_case = TestCase(
                case_id=tc_data.get("id", str(uuid.uuid4())),
                title=tc_data.get("title", "Untitled Test"),
                description=tc_data.get("description", ""),
                priority=tc_data.get("priority", "P2"),
                tags=tc_data.get("tags", []),
                steps=steps
            )
            playwright_test_cases.append(test_case)
        
        # Execute tests
        runner = PlaywrightRunner()
        results = []
        
        try:
            await runner.initialize()
            
            for test_case in playwright_test_cases:
                result = await runner.run_test_case(test_case)
                results.append({
                    "case_id": result.case_id,
                    "status": result.status,
                    "duration": result.duration,
                    "error": result.error,
                    "screenshots": result.screenshots,
                    "logs": result.logs
                })
                
        finally:
            await runner.cleanup()
        
        # Calculate summary
        total_tests = len(results)
        passed = len([r for r in results if r["status"] == "passed"])
        failed = len([r for r in results if r["status"] == "failed"])
        success_rate = (passed / total_tests * 100) if total_tests > 0 else 0
        
        return {
            "run_id": str(uuid.uuid4()),
            "results": results,
            "summary": {
                "total_tests": total_tests,
                "passed": passed,
                "failed": failed,
                "success_rate": success_rate,
                "run_id": str(uuid.uuid4())
            }
        }
        
    except Exception as e:
        print(f"Error executing tests: {str(e)}")
        return {"error": str(e), "status": "error"}

@app.post("/tests/run-generated")
async def run_generated_test(body: dict):
    """Execute generated Playwright test code"""
    try:
        from minimal_test_runner import MinimalTestRunner
        import asyncio
        
        test_code = body.get("test_code", "")
        test_name = body.get("test_name", "generated_test")
        
        if not test_code:
            return {"error": "No test code provided", "status": "error"}
        
        runner = MinimalTestRunner()
        result = await runner.run_generated_test(test_code, test_name)
        
        return result
        
    except Exception as e:
        print(f"Error running generated test: {str(e)}")
        return {"error": str(e), "status": "error"}

if __name__ == "__main__":
    import uvicorn
    print("Starting simple backend server...")
    uvicorn.run(app, host="0.0.0.0", port=8001)
