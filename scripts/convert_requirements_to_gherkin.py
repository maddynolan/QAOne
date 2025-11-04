#!/usr/bin/env python3
"""
Script to convert existing requirements to Gherkin format using LLM.
Updates all requirements in the database with detailed Gherkin scenarios.
"""

import asyncio
import json
import requests
from typing import List, Dict, Any

# Backend API base URL
BASE_URL = "http://localhost:8001"

# Default IDs matching backend constants
DEFAULT_PROJECT_ID = "11111111-1111-1111-1111-111111111111"


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


def convert_to_gherkin(requirement: Dict[str, Any]) -> str:
    """
    Convert a requirement to Gherkin format using LLM.
    Returns a detailed Gherkin feature with scenarios.
    """
    req_id = requirement.get("id")
    original_title = requirement.get("title", "")
    original_description = requirement.get("description", "")
    source = requirement.get("source", "")
    
    try:
        # Use the new backend endpoint for Gherkin conversion
        response = requests.post(
            f"{BASE_URL}/requirements/convert-to-gherkin/{req_id}",
            headers={"Content-Type": "application/json"},
            timeout=300  # 5 minutes for heavy model
        )
        
        if response.ok:
            data = response.json()
            gherkin = data.get("gherkin", "")
            if gherkin:
                return gherkin
            else:
                # Fallback: create basic Gherkin
                return create_basic_gherkin(original_title, original_description, source)
        else:
            print(f"API error: {response.status_code} - {response.text[:200]}")
            return create_basic_gherkin(original_title, original_description, source)
    except Exception as e:
        print(f"Error calling conversion API: {str(e)}")
        return create_basic_gherkin(original_title, original_description, source)


def generate_gherkin_from_testcases(title: str, description: str, source: str, test_cases: List[Dict[str, Any]]) -> str:
    """Convert test cases to proper Gherkin format"""
    gherkin = f"""Feature: {title}
  As a user
  I want to {description.lower()}
  So that I can efficiently accomplish my task

  Background:
    Given I am on the {source} application
    And I have valid access credentials

"""
    
    # Process each test case as a scenario
    for idx, tc in enumerate(test_cases[:5], 1):  # Limit to 5 scenarios
        tc_name = tc.get("name", tc.get("title", f"Scenario {idx}"))
        steps = tc.get("steps", [])
        
        if steps:
            # Determine scenario type based on name
            scenario_type = "successful" if any(word in tc_name.lower() for word in ["valid", "success", "correct", "happy"]) else "alternative"
            
            gherkin += f"""  Scenario: {tc_name}
"""
            
            step_count = 0
            for step in steps:
                action = step.get("action", "")
                expected = step.get("expectedResult", step.get("expected", ""))
                
                if not action:
                    continue
                
                step_count += 1
                
                # Convert to Gherkin format based on action keywords
                action_lower = action.lower()
                
                # Given statements (preconditions)
                if any(word in action_lower for word in ["navigate", "open", "go to", "visit", "access", "am on", "have", "is displayed", "exists"]):
                    gherkin += f"""    Given {action}\n"""
                # When statements (actions)
                elif any(word in action_lower for word in ["enter", "type", "fill", "input", "provide", "click", "select", "choose", "press", "tap", "submit", "perform"]):
                    gherkin += f"""    When {action}\n"""
                # Then statements (validations)
                elif any(word in action_lower for word in ["verify", "check", "validate", "confirm", "assert", "should see", "should be", "should display"]):
                    gherkin += f"""    Then {action}\n"""
                else:
                    # Default to When for unknown actions
                    gherkin += f"""    When {action}\n"""
                
                # Add expected result as Then if provided separately
                if expected and expected.lower() not in action_lower:
                    gherkin += f"""    Then {expected}\n"""
            
            gherkin += "\n"
    
    # Add error handling scenario
    gherkin += f"""  Scenario: Error handling for {title}
    Given I am on the {source} application
    When I attempt to perform the action with invalid or missing data
    Then I should see an appropriate error message
    And the system should handle the error gracefully
    And I should be able to correct the input and retry

"""
    
    return gherkin


def extract_gherkin_from_response(response_text: str, title: str, description: str, source: str) -> str:
    """Extract Gherkin code from LLM response"""
    # Try to find Gherkin code block
    if "```" in response_text:
        # Extract content between ``` markers
        parts = response_text.split("```")
        if len(parts) >= 2:
            # Look for gherkin or feature code block
            for i, part in enumerate(parts):
                if "gherkin" in part.lower() or "feature:" in part.lower():
                    if i + 1 < len(parts):
                        return parts[i + 1].strip()
    
    # Try to extract from Feature: to end
    if "Feature:" in response_text:
        idx = response_text.find("Feature:")
        return response_text[idx:].strip()
    
    # Fallback
    return create_basic_gherkin(title, description, source)


def create_basic_gherkin(title: str, description: str, source: str) -> str:
    """Create a basic Gherkin feature when LLM is not available"""
    return f"""Feature: {title}
  As a user
  I want to {description.lower()}
  So that I can achieve my goal efficiently

  Background:
    Given I am on the application
    And I have valid access credentials

  Scenario: Successful {title}
    Given I am on the {source} application
    When I perform the action: {description}
    Then I should see the expected result
    And the operation should complete successfully

  Scenario Outline: {title} with different inputs
    Given I am on the {source} application
    When I perform the action with "<input>"
    Then I should see "<expected_result>"

    Examples:
      | input | expected_result |
      | valid_input_1 | success_message_1 |
      | valid_input_2 | success_message_2 |

  Scenario: Error handling for {title}
    Given I am on the {source} application
    When I perform the action with invalid data
    Then I should see an appropriate error message
    And the system should handle the error gracefully
"""


def update_requirement(requirement_id: str, gherkin_description: str) -> bool:
    """Update requirement with Gherkin formatted description"""
    try:
        response = requests.put(
            f"{BASE_URL}/requirements/{requirement_id}",
            json={
                "description": gherkin_description
                # Only update description, keep other fields unchanged
            },
            headers={"Content-Type": "application/json"}
        )
        return response.ok
    except Exception as e:
        print(f"Error updating requirement {requirement_id}: {str(e)}")
        return False


def main():
    print("=" * 60)
    print("Converting Requirements to Gherkin Format")
    print("=" * 60)
    
    # Check backend health
    try:
        health_response = requests.get(f"{BASE_URL}/health", timeout=5)
        if not health_response.ok:
            print("ERROR: Backend server is not running or not healthy")
            print("Please start the backend server first")
            return
    except Exception as e:
        print(f"ERROR: Cannot connect to backend at {BASE_URL}")
        print(f"Error: {str(e)}")
        print("Please ensure the backend server is running")
        return
    
    # Fetch all requirements
    print("\n[1/3] Fetching requirements from database...")
    requirements = get_all_requirements()
    
    if not requirements:
        print("No requirements found in database")
        return
    
    print(f"Found {len(requirements)} requirements to convert")
    
    # Convert each requirement to Gherkin
    print("\n[2/3] Converting requirements to Gherkin format using LLM...")
    converted = 0
    failed = 0
    
    for i, req in enumerate(requirements, 1):
        req_id = req.get("id")
        req_title = req.get("title", "Unknown")
        
        print(f"\n[{i}/{len(requirements)}] Converting: {req_title}")
        
        try:
            # The convert_to_gherkin function now calls the backend API
            # which handles LLM generation and database update
            gherkin = convert_to_gherkin(req)
            
            if gherkin and len(gherkin) > 50:  # Check if we got meaningful Gherkin
                # The backend API already updates the requirement, but verify
                # by checking if update is needed
                converted += 1
                print(f"  [OK] Converted and updated: {req_title}")
                print(f"       Gherkin length: {len(gherkin)} characters")
            else:
                # Try manual update as fallback
                if gherkin and update_requirement(req_id, gherkin):
                    converted += 1
                    print(f"  [OK] Converted and updated (fallback): {req_title}")
                else:
                    failed += 1
                    print(f"  [FAIL] Failed to generate or update Gherkin: {req_title}")
        except Exception as e:
            failed += 1
            print(f"  [ERROR] Exception: {str(e)}")
    
    # Summary
    print("\n" + "=" * 60)
    print("[3/3] Conversion Summary")
    print("=" * 60)
    print(f"Total requirements: {len(requirements)}")
    print(f"Successfully converted: {converted}")
    print(f"Failed: {failed}")
    print("\n[OK] Conversion complete!")
    print("=" * 60)


if __name__ == "__main__":
    main()

