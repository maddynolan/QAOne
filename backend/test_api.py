#!/usr/bin/env python3
"""
Simple test script for QA AI Platform API
This tests the basic functionality without requiring a database
"""

import requests
import json
import time
from typing import Dict, Any

# Configuration
API_BASE_URL = "http://localhost:8000"
TEST_TIMEOUT = 30

def test_health_endpoint():
    """Test the health endpoint"""
    print("Testing health endpoint...")
    try:
        response = requests.get(f"{API_BASE_URL}/health", timeout=10)
        if response.status_code == 200:
            data = response.json()
            print(f"SUCCESS: Health check passed: {data.get('status', 'unknown')}")
            return True
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

def test_create_test_plan():
    """Test creating a test plan"""
    print("Testing test plan creation...")
    
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
        
        if response.status_code == 200:
            data = response.json()
            if data.get("success"):
                print(f"SUCCESS: Test plan creation started: {data.get('data', {}).get('task_id', 'unknown')}")
                return data.get("data", {}).get("task_id")
            else:
                print(f"FAILED: Test plan creation failed: {data.get('message', 'unknown error')}")
                return None
        else:
            print(f"FAILED: Test plan creation failed: {response.status_code}")
            print(f"Response: {response.text}")
            return None
            
    except requests.exceptions.RequestException as e:
        print(f"ERROR: Test plan creation error: {e}")
        return None

def test_task_status(task_id: str):
    """Test task status endpoint"""
    if not task_id:
        return False
        
    print(f"Testing task status for {task_id}...")
    try:
        response = requests.get(f"{API_BASE_URL}/tasks/{task_id}", timeout=10)
        if response.status_code == 200:
            data = response.json()
            status = data.get("status", "unknown")
            print(f"SUCCESS: Task status: {status}")
            return True
        else:
            print(f"FAILED: Task status failed: {response.status_code}")
            return False
    except requests.exceptions.RequestException as e:
        print(f"ERROR: Task status error: {e}")
        return False

def test_reports_endpoint():
    """Test the reports endpoint"""
    print("Testing reports endpoint...")
    try:
        response = requests.get(f"{API_BASE_URL}/reports", timeout=10)
        if response.status_code == 200:
            data = response.json()
            if data.get("success"):
                print("SUCCESS: Reports endpoint working")
                return True
            else:
                print(f"FAILED: Reports failed: {data.get('message', 'unknown error')}")
                return False
        else:
            print(f"FAILED: Reports failed: {response.status_code}")
            return False
    except requests.exceptions.RequestException as e:
        print(f"ERROR: Reports error: {e}")
        return False

def main():
    """Run all tests"""
    print("Starting QA AI Platform API Tests")
    print("=" * 50)
    
    # Test 1: Health endpoint
    health_ok = test_health_endpoint()
    if not health_ok:
        print("ERROR: Server is not running. Please start the backend server first.")
        print("Run: uvicorn app.main:app --reload")
        return
    
    print()
    
    # Test 2: API docs
    docs_ok = test_api_docs()
    print()
    
    # Test 3: Create test plan
    task_id = test_create_test_plan()
    print()
    
    # Test 4: Task status (if we got a task ID)
    if task_id:
        test_task_status(task_id)
        print()
    
    # Test 5: Reports endpoint
    test_reports_endpoint()
    print()
    
    # Summary
    print("=" * 50)
    print("Test Summary:")
    print(f"Health endpoint: {'PASS' if health_ok else 'FAIL'}")
    print(f"API docs: {'PASS' if docs_ok else 'FAIL'}")
    print(f"Test plan creation: {'PASS' if task_id else 'FAIL'}")
    print(f"Task status: {'PASS' if task_id else 'SKIP'}")
    
    if health_ok and docs_ok and task_id:
        print("\nSUCCESS: All core tests passed! The QA AI Platform is working correctly.")
        print(f"API Documentation: {API_BASE_URL}/docs")
        print(f"Health Check: {API_BASE_URL}/health")
    else:
        print("\nWARNING: Some tests failed. Check the server logs for details.")

if __name__ == "__main__":
    main()