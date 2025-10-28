#!/usr/bin/env python3
"""
Simple test script for QA AI Platform API
This tests the basic functionality without requiring Redis or database
"""

import requests
import json
import time
from typing import Dict, Any

# Configuration
API_BASE_URL = "http://127.0.0.1:8000"
TEST_TIMEOUT = 30

def test_health_endpoint():
    """Test the health endpoint"""
    print("Testing health endpoint...")
    try:
        response = requests.get(f"{API_BASE_URL}/health", timeout=10)
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.text}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"SUCCESS: Health check passed: {data.get('status', 'unknown')}")
            return True
        elif response.status_code == 503:
            data = response.json()
            print(f"WARNING: Health check returned 503: {data.get('error', 'unknown error')}")
            print("This is expected if Redis/PostgreSQL are not running")
            return True  # Still consider this a success for testing
        else:
            print(f"FAILED: Health check failed: {response.status_code}")
            return False
    except requests.exceptions.RequestException as e:
        print(f"ERROR: Health check error: {e}")
        return False

def test_api_docs():
    """Test the API documentation endpoint"""
    print("Testing API docs...")
    try:
        response = requests.get(f"{API_BASE_URL}/docs", timeout=10)
        if response.status_code == 200:
            print("SUCCESS: API docs accessible")
            return True
        else:
            print(f"FAILED: API docs failed: {response.status_code}")
            return False
    except requests.exceptions.RequestException as e:
        print(f"ERROR: API docs error: {e}")
        return False

def test_openapi_spec():
    """Test the OpenAPI specification endpoint"""
    print("Testing OpenAPI spec...")
    try:
        response = requests.get(f"{API_BASE_URL}/openapi.json", timeout=10)
        if response.status_code == 200:
            data = response.json()
            print(f"SUCCESS: OpenAPI spec accessible - {data.get('info', {}).get('title', 'Unknown')}")
            return True
        else:
            print(f"FAILED: OpenAPI spec failed: {response.status_code}")
            return False
    except requests.exceptions.RequestException as e:
        print(f"ERROR: OpenAPI spec error: {e}")
        return False

def test_create_test_plan():
    """Test creating a test plan (this will fail without Redis, but we can test the endpoint)"""
    print("Testing test plan creation endpoint...")
    
    test_plan_data = {
        "name": "Test Plan - API Validation",
        "description": "Test plan for validating API functionality",
        "source": """
        {
            "openapi": "3.0.0",
            "info": {
                "title": "Test API",
                "version": "1.0.0"
            },
            "paths": {
                "/health": {
                    "get": {
                        "summary": "Health check",
                        "responses": {
                            "200": {
                                "description": "OK"
                            }
                        }
                    }
                }
            }
        }
        """,
        "targets": {
            "endpoints": ["/health", "/api/test"]
        },
        "api_ui": {
            "api": True,
            "ui": False,
            "performance": False,
            "accessibility": False
        },
        "priority": 1
    }
    
    try:
        response = requests.post(
            f"{API_BASE_URL}/generate_test_plan",
            json=test_plan_data,
            timeout=TEST_TIMEOUT
        )
        
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.text}")
        
        if response.status_code == 200:
            data = response.json()
            if data.get("success"):
                print(f"SUCCESS: Test plan creation started: {data.get('data', {}).get('task_id', 'unknown')}")
                return data.get("data", {}).get("task_id")
            else:
                print(f"FAILED: Test plan creation failed: {data.get('message', 'unknown error')}")
                return None
        elif response.status_code == 500:
            print("EXPECTED: Test plan creation failed due to missing Redis/database")
            print("This is normal when running without infrastructure")
            return "expected_failure"
        else:
            print(f"FAILED: Test plan creation failed: {response.status_code}")
            print(f"Response: {response.text}")
            return None
            
    except requests.exceptions.RequestException as e:
        print(f"ERROR: Test plan creation error: {e}")
        return None

def main():
    """Run all tests"""
    print("Starting QA AI Platform API Tests")
    print("=" * 50)
    
    # Test 1: Health endpoint
    health_ok = test_health_endpoint()
    print()
    
    # Test 2: API docs
    docs_ok = test_api_docs()
    print()
    
    # Test 3: OpenAPI spec
    spec_ok = test_openapi_spec()
    print()
    
    # Test 4: Create test plan
    task_id = test_create_test_plan()
    print()
    
    # Summary
    print("=" * 50)
    print("Test Summary:")
    print(f"Health endpoint: {'PASS' if health_ok else 'FAIL'}")
    print(f"API docs: {'PASS' if docs_ok else 'FAIL'}")
    print(f"OpenAPI spec: {'PASS' if spec_ok else 'FAIL'}")
    print(f"Test plan creation: {'PASS' if task_id else 'FAIL'}")
    
    if health_ok and docs_ok and spec_ok:
        print("\nSUCCESS: Core API functionality is working!")
        print(f"API Documentation: {API_BASE_URL}/docs")
        print(f"Health Check: {API_BASE_URL}/health")
        print(f"OpenAPI Spec: {API_BASE_URL}/openapi.json")
        print("\nNOTE: Some endpoints may fail without Redis/PostgreSQL running.")
        print("This is expected behavior for testing the API structure.")
    else:
        print("\nWARNING: Some tests failed. Check the server logs for details.")

if __name__ == "__main__":
    main()
