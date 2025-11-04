#!/usr/bin/env python3
"""
Script to:
1. Delete all test runs
2. Create test plans based on the seeded test cases
"""

import requests
import json

BASE_URL = "http://localhost:8001"
DEFAULT_PROJECT_ID = "11111111-1111-1111-1111-111111111111"

def delete_all_test_runs():
    """Delete all test runs"""
    print("Deleting all test runs...")
    
    try:
        # Get all test runs
        response = requests.get(f"{BASE_URL}/test-runs")
        if response.status_code != 200:
            print(f"Error getting test runs: {response.status_code}")
            return
        
        data = response.json()
        runs = data.get("testRuns", []) if isinstance(data, dict) else data
        
        run_ids = []
        for run in runs:
            if isinstance(run, dict):
                run_id = run.get("id")
            else:
                run_id = str(run) if run else None
            if run_id:
                run_ids.append(run_id)
        
        deleted_count = 0
        for run_id in run_ids:
            delete_response = requests.delete(f"{BASE_URL}/test-runs/{run_id}")
            if delete_response.status_code in [200, 204]:
                deleted_count += 1
                print(f"  [OK] Deleted test run: {run_id}")
            else:
                print(f"  [FAIL] Failed to delete test run: {run_id}")
        
        print(f"\n[OK] Deleted {deleted_count}/{len(run_ids)} test runs\n")
    except Exception as e:
        print(f"Error deleting test runs: {e}")

def get_test_cases():
    """Get all test cases"""
    try:
        response = requests.get(f"{BASE_URL}/test-cases")
        if response.status_code != 200:
            return []
        data = response.json()
        # Handle both array and object with testCases key
        if isinstance(data, list):
            return data
        elif isinstance(data, dict) and "testCases" in data:
            return data["testCases"]
        elif isinstance(data, dict):
            return [data]  # Single test case
        return []
    except Exception as e:
        print(f"Error getting test cases: {e}")
        return []

def create_test_plan(name, description, test_case_ids):
    """Create a test plan"""
    url = f"{BASE_URL}/test-plans"
    payload = {
        "name": name,
        "description": description,
        "testCaseIds": test_case_ids
    }
    
    try:
        response = requests.post(url, json=payload)
        response.raise_for_status()
        result = response.json()
        return result.get("id", "")
    except Exception as e:
        print(f"Error creating test plan {name}: {e}")
        if hasattr(e, 'response') and e.response is not None:
            print(f"Response: {e.response.text}")
        return ""

def assign_test_cases_to_plan(plan_id, test_case_ids):
    """Assign test cases to a plan"""
    for case_id in test_case_ids:
        try:
            url = f"{BASE_URL}/test-cases/{case_id}/assign-plan"
            payload = {"planId": plan_id}
            response = requests.put(url, json=payload)
            if response.status_code not in [200, 204]:
                print(f"  Warning: Could not assign test case {case_id} to plan")
        except Exception as e:
            print(f"  Warning: Error assigning test case {case_id}: {e}")

def main():
    print("=" * 60)
    print("Cleanup and Create Test Plans")
    print("=" * 60)
    
    # Check if backend is running
    try:
        health_check = requests.get(f"{BASE_URL}/health")
        if health_check.status_code != 200:
            print(f"ERROR: Backend is not responding correctly at {BASE_URL}")
            return
    except Exception as e:
        print(f"ERROR: Cannot connect to backend at {BASE_URL}")
        print(f"Error: {e}")
        return
    
    # Step 1: Delete all test runs
    delete_all_test_runs()
    
    # Step 2: Get all test cases
    print("Fetching test cases...")
    test_cases = get_test_cases()
    print(f"[OK] Found {len(test_cases)} test cases\n")
    
    if not test_cases:
        print("No test cases found. Please run seed_realistic_data.py first.")
        return
    
    # Step 3: Group test cases by category
    ecommerce_cases = []
    api_cases = []
    todo_cases = []
    bank_cases = []
    automated_cases = []
    form_cases = []
    
    for tc in test_cases:
        if not isinstance(tc, dict):
            continue
        tc_id = tc.get("id")
        tc_name = tc.get("name", "")
        tc_type = tc.get("testType", "")
        
        if tc_id:
            if "ECO" in tc_name:
                ecommerce_cases.append(tc_id)
            if "API" in tc_name:
                api_cases.append(tc_id)
            if "TODO" in tc_name:
                todo_cases.append(tc_id)
            if "BANK" in tc_name:
                bank_cases.append(tc_id)
            if tc_type == "automated":
                automated_cases.append(tc_id)
            if "FORM" in tc_name:
                form_cases.append(tc_id)
    
    # Step 4: Create test plans
    print("Creating Test Plans...")
    
    plans = [
        {
            "name": "E-commerce Test Plan",
            "description": "Comprehensive test plan for e-commerce functionality including login, cart, checkout, and product management",
            "test_case_ids": ecommerce_cases
        },
        {
            "name": "API Testing Plan",
            "description": "Test plan covering REST API endpoints for CRUD operations, authentication, and data retrieval",
            "test_case_ids": api_cases
        },
        {
            "name": "Todo Application Test Plan",
            "description": "Test plan for todo application features including CRUD operations and filtering",
            "test_case_ids": todo_cases
        },
        {
            "name": "Banking System Test Plan",
            "description": "Test plan for banking application including customer login, account management, and transactions",
            "test_case_ids": bank_cases
        },
        {
            "name": "Automated Test Suite",
            "description": "Automated test cases for regression testing and continuous integration",
            "test_case_ids": automated_cases
        },
        {
            "name": "Form Validation Test Plan",
            "description": "Test plan for form validation, submission, and file upload functionality",
            "test_case_ids": form_cases
        },
        {
            "name": "End-to-End Test Plan",
            "description": "Complete end-to-end test scenarios covering multiple application types",
            "test_case_ids": ecommerce_cases[:5] + api_cases[:3] + todo_cases[:2]  # Mix of different types
        }
    ]
    
    created_plans = 0
    for plan in plans:
        if not plan["test_case_ids"]:
            print(f"  [SKIP] {plan['name']} - No test cases to assign")
            continue
        
        plan_id = create_test_plan(plan["name"], plan["description"], plan["test_case_ids"])
        if plan_id:
            created_plans += 1
            print(f"  [OK] Created test plan: {plan['name']} ({len(plan['test_case_ids'])} test cases)")
            
            # Assign test cases to plan
            assign_test_cases_to_plan(plan_id, plan["test_case_ids"])
        else:
            print(f"  [FAIL] Failed to create test plan: {plan['name']}")
    
    print(f"\n[OK] Created {created_plans}/{len(plans)} test plans\n")
    
    print("=" * 60)
    print("SUMMARY")
    print("=" * 60)
    print(f"Test runs deleted: All")
    print(f"Test plans created: {created_plans}")
    print("\n[OK] Cleanup and test plan creation complete!")

if __name__ == "__main__":
    main()

