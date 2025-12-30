"""
Test Script for Salesforce Metadata Validation

Run this to test the validation feature without a real Salesforce org.
"""

import requests
import json

BASE_URL = "http://localhost:8000/api/salesforce"

def test_status():
    """Test status endpoint"""
    print("\n=== Testing Status ===")
    response = requests.get(f"{BASE_URL}/status")
    print(f"Status: {response.status_code}")
    print(json.dumps(response.json(), indent=2))
    return response.json()

def test_validate_selector():
    """Test selector validation (works without org connection)"""
    print("\n=== Testing Selector Validation ===")
    
    # Test cases
    selectors = [
        # Good selectors
        ("lightning-input[name='Email']", "Good - Lightning component with name"),
        ("[data-id='submitButton']", "Good - data-id attribute"),
        ("[aria-label='Save']", "Good - aria-label"),
        
        # Bad selectors (unstable)
        ("#auraId_123456", "Bad - Aura dynamic ID"),
        (".lwc-789", "Bad - LWC dynamic class"),
        ("#ember456", "Bad - Ember dynamic ID"),
        ("[id='12345']", "Bad - Numeric ID"),
    ]
    
    for selector, description in selectors:
        response = requests.post(
            f"{BASE_URL}/validate/selector",
            json={"selector": selector}
        )
        result = response.json()
        status = "VALID" if result.get("valid") else "WARNING"
        warnings = result.get("warnings", [])
        print(f"\n[{status}] {description}")
        print(f"  Selector: {selector}")
        if warnings:
            print(f"  Warnings: {warnings}")
        if result.get("extracted", {}).get("components"):
            print(f"  Components: {result['extracted']['components']}")

def test_validate_object():
    """Test object validation"""
    print("\n=== Testing Object Validation ===")
    
    objects = ["Account", "Contact", "Lead", "InvalidObject__c", "Acount"]
    
    for obj in objects:
        response = requests.post(
            f"{BASE_URL}/validate/object",
            json={"object_name": obj}
        )
        result = response.json()
        status = "VALID" if result.get("valid") else "INVALID"
        print(f"\n[{status}] {obj}")
        print(f"  Message: {result.get('message')}")
        if result.get("suggestions"):
            print(f"  Suggestions: {result.get('suggestions')}")

def test_validate_field():
    """Test field validation"""
    print("\n=== Testing Field Validation ===")
    
    fields = [
        ("Account", "Email"),
        ("Account", "Industry"),
        ("Contact", "FirstName"),
        ("Account", "InvalidField__c"),
    ]
    
    for obj, field in fields:
        response = requests.post(
            f"{BASE_URL}/validate/field",
            json={"object_name": obj, "field_name": field}
        )
        result = response.json()
        status = "VALID" if result.get("valid") else "INVALID"
        print(f"\n[{status}] {obj}.{field}")
        print(f"  Message: {result.get('message')}")

def test_validate_workflow():
    """Test workflow validation"""
    print("\n=== Testing Workflow Validation ===")
    
    workflow_nodes = [
        {
            "data": {
                "selector": "lightning-input[name='Email']",
                "type": "input",
                "label": "Enter Email"
            }
        },
        {
            "data": {
                "selector": "#auraId_dynamic123",
                "type": "click",
                "label": "Click Submit (bad selector)"
            }
        },
        {
            "data": {
                "selector": "[data-id='saveButton']",
                "type": "click",
                "label": "Click Save (good selector)"
            }
        }
    ]
    
    response = requests.post(
        f"{BASE_URL}/validate/workflow",
        json={"nodes": workflow_nodes, "app_type": "salesforce"}
    )
    result = response.json()
    
    print(f"\nWorkflow Valid: {result.get('workflow_valid')}")
    print(f"Total Steps: {result.get('total_steps')}")
    print(f"Valid Steps: {result.get('valid_steps')}")
    print(f"Warnings: {result.get('warnings_count')}")
    
    print("\nPer-step results:")
    for step in result.get("steps", []):
        status = "PASS" if step.get("step_valid") else "WARN"
        print(f"  [{status}] Step {step.get('step_index')}: {step.get('step_name', 'Unknown')}")
        for warning in step.get("warnings", []):
            print(f"    - {warning}")

def test_suggestions():
    """Test autocomplete suggestions"""
    print("\n=== Testing Suggestions ===")
    
    # Object suggestions
    print("\nObject suggestions for 'Acc':")
    response = requests.post(
        f"{BASE_URL}/suggest/objects",
        json={"partial": "Acc", "limit": 5}
    )
    for obj in response.json().get("suggestions", []):
        print(f"  - {obj.get('name')} ({obj.get('label')})")
    
    # Field suggestions
    print("\nField suggestions for 'Account.Ind':")
    response = requests.post(
        f"{BASE_URL}/suggest/fields",
        json={"object_name": "Account", "partial": "Ind", "limit": 5}
    )
    for field in response.json().get("suggestions", []):
        print(f"  - {field.get('name')} ({field.get('type')})")

def main():
    print("=" * 60)
    print("Salesforce Metadata Validation Test Suite")
    print("=" * 60)
    
    try:
        # Test all features
        test_status()
        test_validate_selector()
        test_validate_object()
        test_validate_field()
        test_validate_workflow()
        test_suggestions()
        
        print("\n" + "=" * 60)
        print("All tests completed!")
        print("=" * 60)
        
    except requests.exceptions.ConnectionError:
        print("\nERROR: Could not connect to backend.")
        print("Make sure the backend is running:")
        print("  cd backend && python -m uvicorn app.main:app --port 8000")

if __name__ == "__main__":
    main()












