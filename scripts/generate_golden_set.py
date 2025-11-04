#!/usr/bin/env python3
"""
Generate golden set from existing requirements and test cases in database.
This creates a JSONL file with requirements and human-written test cases for LLM evaluation.
"""

import requests
import json
from typing import List, Dict, Any

# Backend API base URL
BASE_URL = "http://localhost:8001"

# Output file
OUTPUT_FILE = "golden.jsonl"


def get_all_requirements() -> List[Dict[str, Any]]:
    """Fetch all requirements from the database"""
    try:
        response = requests.get(f"{BASE_URL}/requirements")
        if response.ok:
            data = response.json()
            return data.get("requirements", [])
        else:
            print(f"Error fetching requirements: {response.status_code}")
            return []
    except Exception as e:
        print(f"Error fetching requirements: {str(e)}")
        return []


def get_test_cases_for_requirement(requirement_id: str) -> List[Dict[str, Any]]:
    """Fetch test cases linked to a requirement"""
    try:
        response = requests.get(f"{BASE_URL}/test-cases")
        if response.ok:
            data = response.json()
            test_cases = data.get("testCases", [])
            
            # Filter test cases that reference this requirement
            # Note: This depends on how requirements are linked to test cases
            # You may need to adjust based on your schema
            linked_cases = []
            for tc in test_cases:
                # Check if requirement_id is in test case data
                # This might be in requirement_ref, requirement_id, or linked_requirements
                if requirement_id in str(tc.get("requirement_ref", "")) or \
                   requirement_id in str(tc.get("requirement_id", "")):
                    linked_cases.append(tc)
            
            return linked_cases
    except Exception as e:
        print(f"Error fetching test cases: {str(e)}")
        return []
    
    return []


def format_test_case_for_golden(tc: Dict[str, Any]) -> Dict[str, Any]:
    """Format a test case for the golden set"""
    steps = tc.get("steps", [])
    
    # Format steps as a readable string
    steps_text = ""
    if isinstance(steps, list):
        for i, step in enumerate(steps, 1):
            if isinstance(step, dict):
                action = step.get("action", "")
                expected = step.get("expectedResult", step.get("expected", ""))
                steps_text += f"{i}. {action}\n"
                if expected:
                    steps_text += f"   Expected: {expected}\n"
            else:
                steps_text += f"{i}. {step}\n"
    else:
        steps_text = str(steps)
    
    return {
        "title": tc.get("title", tc.get("name", "Untitled Test Case")),
        "steps": steps_text.strip(),
        "priority": tc.get("priority", "medium"),
        "test_type": tc.get("testType", tc.get("test_type", "manual"))
    }


def create_golden_set():
    """Create golden set from database"""
    print("=" * 60)
    print("Generating Golden Set for LLM Evaluation")
    print("=" * 60)
    
    # Check backend health
    try:
        health_response = requests.get(f"{BASE_URL}/health", timeout=5)
        if not health_response.ok:
            print("ERROR: Backend server is not running or not healthy")
            return
    except Exception as e:
        print(f"ERROR: Cannot connect to backend at {BASE_URL}")
        print(f"Error: {str(e)}")
        return
    
    # Fetch all requirements
    print("\n[1/3] Fetching requirements from database...")
    requirements = get_all_requirements()
    
    if not requirements:
        print("No requirements found in database")
        return
    
    print(f"Found {len(requirements)} requirements")
    
    # Fetch all test cases (we'll link them later)
    print("\n[2/3] Fetching test cases from database...")
    try:
        tc_response = requests.get(f"{BASE_URL}/test-cases")
        if tc_response.ok:
            tc_data = tc_response.json()
            all_test_cases = tc_data.get("testCases", [])
            print(f"Found {len(all_test_cases)} test cases")
        else:
            all_test_cases = []
            print("Could not fetch test cases")
    except Exception as e:
        print(f"Error fetching test cases: {str(e)}")
        all_test_cases = []
    
    # Create a mapping of requirement refs to test cases
    req_to_tests = {}
    for tc in all_test_cases:
        req_ref = tc.get("requirement_ref", "")
        if req_ref:
            if req_ref not in req_to_tests:
                req_to_tests[req_ref] = []
            req_to_tests[req_ref].append(tc)
    
    # Generate golden set
    print("\n[3/3] Generating golden set...")
    golden_items = []
    
    for i, req in enumerate(requirements, 1):
        req_id = req.get("id", "")
        req_title = req.get("title", "")
        req_desc = req.get("description", "")
        req_source_ref = req.get("source_ref", "")
        
        # Get human-written test cases for this requirement
        human_tests = []
        if req_source_ref and req_source_ref in req_to_tests:
            for tc in req_to_tests[req_source_ref]:
                formatted_tc = format_test_case_for_golden(tc)
                human_tests.append(formatted_tc)
        
        # Format requirement text
        requirement_text = req_desc if req_desc else req_title
        
        # Create golden set item
        golden_item = {
            "id": f"{i:03d}",
            "requirement": requirement_text,
            "requirement_id": req_id,
            "requirement_title": req_title,
            "source_ref": req_source_ref,
            "human_tests": human_tests
        }
        
        golden_items.append(golden_item)
        print(f"  [{i}/{len(requirements)}] {req_title}: {len(human_tests)} human test(s)")
    
    # Write to JSONL file
    print(f"\nWriting golden set to {OUTPUT_FILE}...")
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        for item in golden_items:
            f.write(json.dumps(item, ensure_ascii=False) + '\n')
    
    total_human_tests = sum(len(item["human_tests"]) for item in golden_items)
    
    print("\n" + "=" * 60)
    print("Golden Set Generation Complete")
    print("=" * 60)
    print(f"Total requirements: {len(golden_items)}")
    print(f"Requirements with human tests: {sum(1 for item in golden_items if item['human_tests'])}")
    print(f"Total human test cases: {total_human_tests}")
    print(f"Output file: {OUTPUT_FILE}")
    print("\n[OK] Golden set ready for LLM evaluation!")
    print("=" * 60)


if __name__ == "__main__":
    create_golden_set()

