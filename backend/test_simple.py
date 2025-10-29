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
    """Generate structured test cases from requirements and context"""
    try:
        # Simple mock response without any external dependencies
        test_case = TestCase(
            case_id=str(uuid.uuid4()),
            title=f"Test: {body.requirements}",
            description=f"Generated test for: {body.requirements}",
            priority="P1",
            tags=["ai-generated", "functional"],
            steps=[
                TestStep(
                    action="Navigate to application",
                    expected="Application loads successfully",
                    locator_hints=[]
                ),
                TestStep(
                    action="Perform test action",
                    expected="Action completes as expected",
                    locator_hints=[]
                )
            ]
        )
        
        return {"cases": [test_case], "status": "success"}
        
    except Exception as e:
        print(f"Error generating tests: {str(e)}")
        return {"error": str(e), "status": "error"}

if __name__ == "__main__":
    import uvicorn
    print("Starting simple backend server...")
    uvicorn.run(app, host="0.0.0.0", port=8001)
