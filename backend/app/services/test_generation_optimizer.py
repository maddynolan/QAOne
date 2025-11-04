"""
Optimization utilities for LLM test generation
Includes retry logic, deduplication, and coverage hints
"""

import json
import re
from typing import List, Dict, Any, Set
from collections import Counter


def extract_json_from_response(text: str) -> List[Dict]:
    """Extract JSON array from LLM response with multiple fallback strategies"""
    if not text:
        return []
    
    text = text.strip()
    original_text = text
    
    # Strategy 1: Remove markdown code blocks
    if "```json" in text:
        parts = text.split("```json")
        if len(parts) > 1:
            text = parts[1].split("```")[0].strip()
    elif "```" in text:
        parts = text.split("```")
        for part in parts:
            part = part.strip()
            if part.startswith("[") or part.startswith("{"):
                try:
                    parsed = json.loads(part)
                    if isinstance(parsed, list):
                        return parsed
                except:
                    continue
    
    # Strategy 2: Find JSON array boundaries (more robust)
    start_idx = text.find('[')
    end_idx = text.rfind(']')
    if start_idx != -1 and end_idx != -1 and end_idx > start_idx:
        try:
            json_candidate = text[start_idx:end_idx+1]
            parsed = json.loads(json_candidate)
            if isinstance(parsed, list):
                return parsed
        except json.JSONDecodeError as e:
            # Try to fix common JSON issues
            # Remove trailing commas
            json_candidate = re.sub(r',\s*}', '}', json_candidate)
            json_candidate = re.sub(r',\s*]', ']', json_candidate)
            # Fix unquoted keys
            json_candidate = re.sub(r'(\w+):', r'"\1":', json_candidate)
            try:
                parsed = json.loads(json_candidate)
                if isinstance(parsed, list):
                    return parsed
            except:
                pass
    
    # Strategy 3: Try direct JSON parse
    try:
        parsed = json.loads(text)
        if isinstance(parsed, list):
            return parsed
    except:
        pass
    
    # Strategy 4: Try to find and extract JSON objects/arrays more aggressively
    # Look for patterns like [{...}] or array of objects
    json_pattern = r'\[\s*\{[^}]*\}\s*(?:,\s*\{[^}]*\}\s*)*\]'
    matches = re.findall(json_pattern, original_text, re.DOTALL)
    for match in matches:
        try:
            parsed = json.loads(match)
            if isinstance(parsed, list):
                return parsed
        except:
            continue
    
    return []


def is_valid_test_case_json(tests: List[Dict]) -> bool:
    """Validate that test cases have required structure"""
    if not tests or not isinstance(tests, list):
        return False
    
    # Accept either "name" or "title" as required field
    for test in tests:
        if not isinstance(test, dict):
            return False
        # Must have either "name" or "title"
        if "name" not in test and "title" not in test:
            return False
    
    return True


def deduplicate_test_cases(tests: List[Dict]) -> List[Dict]:
    """Remove duplicate or near-duplicate test cases based on title similarity"""
    if not tests:
        return []
    
    seen_titles: Set[str] = set()
    unique_tests = []
    
    for test in tests:
        title = test.get("title", "").lower().strip()
        
        # Check for exact duplicate
        if title in seen_titles:
            continue
        
        # Check for near-duplicate (similar titles)
        is_duplicate = False
        for seen_title in seen_titles:
            # Simple similarity check: if titles are very similar, skip
            similarity = calculate_similarity(title, seen_title)
            if similarity > 0.85:  # 85% similarity threshold
                is_duplicate = True
                break
        
        if not is_duplicate:
            seen_titles.add(title)
            unique_tests.append(test)
    
    return unique_tests


def calculate_similarity(str1: str, str2: str) -> float:
    """Calculate simple string similarity using word overlap"""
    words1 = set(str1.split())
    words2 = set(str2.split())
    
    if not words1 and not words2:
        return 1.0
    if not words1 or not words2:
        return 0.0
    
    intersection = len(words1 & words2)
    union = len(words1 | words2)
    
    return intersection / union if union > 0 else 0.0


def check_coverage_hints(requirement: str, tests: List[Dict]) -> List[str]:
    """Check if test cases cover important scenarios and suggest missing ones"""
    hints = []
    requirement_lower = requirement.lower()
    test_titles = " ".join([t.get("title", "").lower() for t in tests])
    
    # Check for common test scenarios
    coverage_checks = {
        "invalid": ["invalid", "error", "wrong", "incorrect"],
        "empty": ["empty", "blank", "null"],
        "boundary": ["boundary", "limit", "edge", "max", "min"],
        "negative": ["negative", "fail", "reject"],
        "validation": ["validation", "validate", "verify"]
    }
    
    for check_name, keywords in coverage_checks.items():
        if not any(keyword in test_titles for keyword in keywords):
            # Check if requirement mentions this scenario
            if any(keyword in requirement_lower for keyword in ["invalid", "error", "validation", "empty", "limit"]):
                hints.append(f"Consider adding {check_name} test scenarios")
    
    return hints


def add_coverage_hints_to_prompt(base_prompt: str, hints: List[str]) -> str:
    """Add coverage hints to the prompt to guide LLM"""
    if not hints:
        return base_prompt
    
    hints_text = "\n".join([f"- {hint}" for hint in hints])
    enhanced_prompt = f"""{base_prompt}

Additional Coverage Requirements:
{hints_text}

Please ensure these scenarios are covered in your generated test cases."""
    
    return enhanced_prompt


def retry_with_fixup_prompt(original_prompt: str, error_type: str = "json") -> str:
    """Generate a fixup prompt for retry"""
    if error_type == "json":
        return f"""{original_prompt}

IMPORTANT: Your previous response was not valid JSON. Please fix it and return ONLY a valid JSON array. Do not include any explanations, markdown formatting, or code blocks."""
    elif error_type == "structure":
        return f"""{original_prompt}

IMPORTANT: Your previous response was missing required fields. Each test case must have: title, steps (array), expected, priority. Please ensure all fields are present."""
    else:
        return original_prompt


def validate_and_fix_test_cases(tests: List[Dict]) -> List[Dict]:
    """Validate and fix common issues in generated test cases"""
    fixed_tests = []
    
    for test in tests:
        if not isinstance(test, dict):
            continue
        
        # Ensure required fields
        if "title" not in test or not test["title"]:
            continue  # Skip tests without title
        
        # Fix steps if needed
        if "steps" not in test:
            test["steps"] = []
        elif not isinstance(test["steps"], list):
            # Convert single step to array
            if isinstance(test["steps"], dict):
                test["steps"] = [test["steps"]]
            else:
                test["steps"] = []
        
        # Ensure steps have required structure
        fixed_steps = []
        for step in test["steps"]:
            if isinstance(step, dict):
                if "action" not in step:
                    continue
                fixed_steps.append({
                    "action": step.get("action", ""),
                    "expectedResult": step.get("expectedResult", step.get("expected", ""))
                })
        test["steps"] = fixed_steps
        
        # Set defaults
        test.setdefault("priority", "medium")
        test.setdefault("tags", [])
        test.setdefault("description", test.get("title", ""))
        
        fixed_tests.append(test)
    
    return fixed_tests

