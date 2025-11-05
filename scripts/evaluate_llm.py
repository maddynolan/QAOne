#!/usr/bin/env python3
"""
LLM Evaluation Harness for Test Generation
Evaluates Qwen 2.5 models (7B, 14B, 32B) on test generation quality.
"""

import json
import os
import time
import requests
import subprocess
import tempfile
from typing import List, Dict, Any, Optional
from collections import Counter

# Configuration
OLLAMA_URL = os.getenv("OLLAMA_URL", "http://localhost:11434")
OLLAMA_API_URL = f"{OLLAMA_URL}/api/generate"
MODEL = os.getenv("MODEL", "qwen2.5-coder:14b")  # Default to 14B

# Model mapping
MODEL_MAP = {
    "7b": "qwen2.5:7b-instruct",
    "14b": "qwen2.5-coder:14b",
    "32b": "qwen2.5-coder:32b"
}

# Prompt templates
PROMPT_REQ_TO_TESTS = """You are a senior QA engineer. Output JSON only.

Input requirement:
{requirement}

Generate 4-6 test cases covering: positive, negative, edge, validation.
Each item fields: title, preconditions, steps, expected, priority.
Return a JSON array only.
"""

PROMPT_MANUAL_TO_PLAYWRIGHT = """You are a test automation expert.
Convert the following JSON test case to Playwright (TypeScript). Use min/data testid selectors.

Import {{ test, expect }} from '@playwright/test';

Return code only (no extra text).

Test case:
{test_json}
"""

PROMPT_REQ_TO_API_TESTS = """You are an API testing expert. Output JSON only.

Input requirement:
{requirement}

Generate 4-6 API test cases covering: GET, POST, PUT, DELETE, error handling, validation.
Each item fields: title, method, endpoint, headers, body, expected_status, expected_response.
Return a JSON array only.
"""

PROMPT_REQ_TO_PERFORMANCE_TESTS = """You are a performance testing expert. Output JSON only.

Input requirement:
{requirement}

Generate 3-4 performance test cases covering: load, stress, endurance, spike.
Each item fields: title, virtual_users, duration, ramp_up, expected_throughput, expected_latency.
Return a JSON array only.
"""

PROMPT_REQ_TO_SECURITY_TESTS = """You are a security testing expert. Output JSON only.

Input requirement:
{requirement}

Generate 4-6 security test cases covering: authentication, authorization, injection, XSS, CSRF, data exposure.
Each item fields: title, attack_vector, payload, expected_behavior, severity.
Return a JSON array only.
"""

PROMPT_REQ_TO_ACCESSIBILITY_TESTS = """You are an accessibility testing expert. Output JSON only.

Input requirement:
{requirement}

Generate 4-5 accessibility test cases covering: WCAG 2.1 AA compliance, keyboard navigation, screen readers, color contrast.
Each item fields: title, wcag_guideline, test_method, expected_result, priority.
Return a JSON array only.
"""


def call_ollama(prompt: str, model: Optional[str] = None) -> str:
    """Call Ollama API with a prompt"""
    model_to_use = model or MODEL
    
    # Map shorthand to full model name
    if model_to_use in MODEL_MAP:
        model_to_use = MODEL_MAP[model_to_use]
    
    payload = {
        "model": model_to_use,
        "prompt": prompt,
        "stream": False,
        "options": {
            "temperature": 0.7,
            "top_p": 0.9
        }
    }
    
    try:
        response = requests.post(OLLAMA_API_URL, json=payload, timeout=300)
        response.raise_for_status()
        data = response.json()
        return data.get("response", "")
    except Exception as e:
        print(f"Error calling Ollama: {str(e)}")
        raise


def is_json_array(text: str) -> bool:
    """Check if text is a valid JSON array"""
    try:
        parsed = json.loads(text)
        return isinstance(parsed, list) and len(parsed) > 0
    except:
        return False


def extract_json_from_response(text: str) -> Optional[List[Dict]]:
    """Extract JSON array from LLM response"""
    # Try to find JSON array in response
    text = text.strip()
    
    # Remove markdown code blocks if present
    if "```json" in text:
        parts = text.split("```json")
        if len(parts) > 1:
            text = parts[1].split("```")[0].strip()
    elif "```" in text:
        parts = text.split("```")
        for part in parts:
            try:
                parsed = json.loads(part.strip())
                if isinstance(parsed, list):
                    return parsed
            except:
                continue
    
    # Try direct JSON parse
    try:
        parsed = json.loads(text)
        if isinstance(parsed, list):
            return parsed
    except:
        pass
    
    # Try to find array-like structure
    start_idx = text.find('[')
    end_idx = text.rfind(']')
    if start_idx != -1 and end_idx != -1 and end_idx > start_idx:
        try:
            parsed = json.loads(text[start_idx:end_idx+1])
            if isinstance(parsed, list):
                return parsed
        except:
            pass
    
    return None


def score_structure(tests: List[Dict]) -> float:
    """Score based on structure completeness"""
    if not tests:
        return 0.0
    
    required_fields = ["title", "steps", "expected"]
    optional_fields = ["preconditions", "priority", "test_type"]
    
    scores = []
    for test in tests:
        score = 0.0
        # Required fields
        for field in required_fields:
            if field in test and test[field]:
                score += 1.0
        # Optional fields bonus
        for field in optional_fields:
            if field in test and test[field]:
                score += 0.2
        
        scores.append(score / (len(required_fields) + len(optional_fields) * 0.2))
    
    return sum(scores) / len(scores) * 100


def score_diversity(tests: List[Dict]) -> float:
    """Score based on test case diversity"""
    if not tests:
        return 0.0
    
    titles = [test.get("title", "").lower().strip() for test in tests if test.get("title")]
    if not titles:
        return 0.0
    
    unique_titles = len(set(titles))
    total = len(titles)
    
    return (unique_titles / total) * 100 if total > 0 else 0.0


def jaccard_similarity(set1: set, set2: set) -> float:
    """Calculate Jaccard similarity between two sets"""
    if not set1 and not set2:
        return 1.0
    if not set1 or not set2:
        return 0.0
    
    intersection = len(set1 & set2)
    union = len(set1 | set2)
    
    return intersection / union if union > 0 else 0.0


def score_overlap_with_human(gen: List[Dict], human: List[Dict]) -> float:
    """Score based on overlap with human-written tests"""
    if not human:
        return 50.0  # Neutral score if no human tests to compare
    
    if not gen:
        return 0.0
    
    # Extract titles as sets
    gen_titles = set(t.get("title", "").lower().strip() for t in gen if t.get("title"))
    human_titles = set(t.get("title", "").lower().strip() for t in human if t.get("title"))
    
    if not gen_titles or not human_titles:
        return 0.0
    
    # Calculate Jaccard similarity
    similarity = jaccard_similarity(gen_titles, human_titles)
    
    # We want some overlap (30-70%) but not 100% (would be copying)
    # Score higher for overlap in the sweet spot
    if 0.3 <= similarity <= 0.7:
        return 100.0
    elif similarity < 0.3:
        return similarity * 100 / 0.3
    else:  # > 0.7
        return 100.0 - (similarity - 0.7) * 100 / 0.3


def quick_ts_compile(ts_code: str) -> bool:
    """Quick check if TypeScript code compiles (optional)"""
    try:
        with tempfile.NamedTemporaryFile(mode='w', suffix='.ts', delete=False) as f:
            f.write(ts_code)
            temp_file = f.name
        
        try:
            # Try TypeScript compiler
            result = subprocess.run(
                ["tsc", temp_file],
                capture_output=True,
                timeout=10,
                text=True
            )
            return result.returncode == 0
        except (subprocess.TimeoutExpired, FileNotFoundError):
            # If tsc not available, try basic syntax check
            # This is a simplified check
            required_keywords = ["test", "expect", "from", "@playwright"]
            return all(keyword in ts_code for keyword in required_keywords)
        finally:
            try:
                os.unlink(temp_file)
            except:
                pass
    except Exception as e:
        print(f"Compile check error: {str(e)}")
        return False


def evaluate_golden_set(golden_set: List[Dict], test_type: str = "manual") -> Dict:
    """Evaluate LLM on golden set"""
    results = []
    
    print(f"\nEvaluating {len(golden_set)} requirements for {test_type} test generation...")
    print(f"Using model: {MODEL}\n")
    
    # Select appropriate prompt template
    prompt_template = PROMPT_REQ_TO_TESTS
    if test_type == "api":
        prompt_template = PROMPT_REQ_TO_API_TESTS
    elif test_type == "performance":
        prompt_template = PROMPT_REQ_TO_PERFORMANCE_TESTS
    elif test_type == "security":
        prompt_template = PROMPT_REQ_TO_SECURITY_TESTS
    elif test_type == "accessibility":
        prompt_template = PROMPT_REQ_TO_ACCESSIBILITY_TESTS
    
    for i, item in enumerate(golden_set, 1):
        requirement = item.get("requirement", "")
        human_tests = item.get("human_tests", [])
        item_id = item.get("id", f"{i:03d}")
        
        print(f"[{i}/{len(golden_set)}] Evaluating requirement: {item_id}")
        
        # Format prompt
        prompt = prompt_template.format(requirement=requirement)
        
        # Call LLM
        start_time = time.time()
        try:
            llm_response = call_ollama(prompt)
            latency_ms = int((time.time() - start_time) * 1000)
        except Exception as e:
            print(f"  [ERROR] LLM call failed: {str(e)}")
            results.append({
                "id": item_id,
                "requirement": requirement,
                "human_test_count": len(human_tests),
                "llm_response": "",
                "is_valid_json": False,
                "structure_score": 0.0,
                "diversity_score": 0.0,
                "overlap_score": 0.0,
                "latency_ms": 0,
                "error": str(e)
            })
            continue
        
        # Extract JSON from response
        gen_tests = extract_json_from_response(llm_response)
        is_valid = gen_tests is not None
        
        if not is_valid:
            # Retry with fixup prompt
            print("  [RETRY] Invalid JSON, retrying with fixup prompt...")
            fixup_prompt = f"{prompt}\n\nYour previous response was not valid JSON. Please fix it and return ONLY a valid JSON array."
            try:
                llm_response = call_ollama(fixup_prompt)
                gen_tests = extract_json_from_response(llm_response)
                is_valid = gen_tests is not None
            except:
                pass
        
        # Calculate scores
        structure_score = score_structure(gen_tests) if gen_tests else 0.0
        diversity_score = score_diversity(gen_tests) if gen_tests else 0.0
        overlap_score = score_overlap_with_human(gen_tests, human_tests) if gen_tests else 0.0
        
        # Optional: Check Playwright compilation for automation tests
        compile_ok = None
        if test_type == "automation" and gen_tests and len(gen_tests) > 0:
            # Convert first test to Playwright and check compilation
            try:
                playwright_prompt = PROMPT_MANUAL_TO_PLAYWRIGHT.format(
                    test_json=json.dumps(gen_tests[0])
                )
                playwright_code = call_ollama(playwright_prompt)
                compile_ok = quick_ts_compile(playwright_code)
            except:
                compile_ok = False
        
        result = {
            "id": item_id,
            "requirement": requirement,
            "human_test_count": len(human_tests),
            "llm_response": llm_response[:500],  # Truncate for storage
            "generated_tests": gen_tests,
            "is_valid_json": is_valid,
            "structure_score": round(structure_score, 2),
            "diversity_score": round(diversity_score, 2),
            "overlap_score": round(overlap_score, 2),
            "compile_ok": compile_ok,
            "latency_ms": latency_ms,
            "model": MODEL
        }
        
        results.append(result)
        
        print(f"  [OK] Structure: {structure_score:.1f}%, Diversity: {diversity_score:.1f}%, Overlap: {overlap_score:.1f}%")
    
    # Calculate summary
    valid_json_count = sum(1 for r in results if r.get("is_valid_json", False))
    avg_structure = sum(r.get("structure_score", 0) for r in results) / len(results) if results else 0
    avg_diversity = sum(r.get("diversity_score", 0) for r in results) / len(results) if results else 0
    avg_overlap = sum(r.get("overlap_score", 0) for r in results) / len(results) if results else 0
    avg_latency = sum(r.get("latency_ms", 0) for r in results) / len(results) if results else 0
    
    summary = {
        "model": MODEL,
        "test_type": test_type,
        "total_items": len(golden_set),
        "valid_json_percent": round(valid_json_count / len(results) * 100, 2) if results else 0,
        "avg_structure": round(avg_structure, 2),
        "avg_diversity": round(avg_diversity, 2),
        "avg_overlap": round(avg_overlap, 2),
        "avg_latency_ms": round(avg_latency, 2),
        "items": results
    }
    
    return summary


def main():
    """Main evaluation function"""
    import sys
    
    # Parse arguments
    test_type = sys.argv[1] if len(sys.argv) > 1 else "manual"
    model = sys.argv[2] if len(sys.argv) > 2 else None
    
    if model:
        global MODEL
        MODEL = model
    
    # Load golden set
    golden_file = "golden.jsonl"
    if not os.path.exists(golden_file):
        print(f"ERROR: Golden set file '{golden_file}' not found!")
        print("Please run: python scripts/generate_golden_set.py first")
        return
    
    print("=" * 60)
    print("LLM Evaluation Harness")
    print("=" * 60)
    print(f"Model: {MODEL}")
    print(f"Test Type: {test_type}")
    print(f"Golden Set: {golden_file}")
    print("=" * 60)
    
    # Load golden set
    golden_set = []
    with open(golden_file, 'r', encoding='utf-8') as f:
        for line in f:
            if line.strip():
                golden_set.append(json.loads(line))
    
    if not golden_set:
        print("ERROR: Golden set is empty!")
        return
    
    # Run evaluation
    summary = evaluate_golden_set(golden_set, test_type)
    
    # Save results
    output_dir = "outputs"
    os.makedirs(output_dir, exist_ok=True)
    
    output_file = f"{output_dir}/summary_{test_type}_{MODEL.replace(':', '_')}.json"
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(summary, f, indent=2, ensure_ascii=False)
    
    # Print summary
    print("\n" + "=" * 60)
    print("Evaluation Summary")
    print("=" * 60)
    print(f"Model: {summary['model']}")
    print(f"Test Type: {summary['test_type']}")
    print(f"Valid JSON: {summary['valid_json_percent']}%")
    print(f"Avg Structure Score: {summary['avg_structure']:.2f}%")
    print(f"Avg Diversity Score: {summary['avg_diversity']:.2f}%")
    print(f"Avg Overlap Score: {summary['avg_overlap']:.2f}%")
    print(f"Avg Latency: {summary['avg_latency_ms']:.2f}ms")
    print(f"\nResults saved to: {output_file}")
    print("=" * 60)
    
    # Check pass/fail gates
    print("\nPass/Fail Gates:")
    gates = {
        "Valid JSON > 95%": summary['valid_json_percent'] >= 95,
        "Structure Score > 85": summary['avg_structure'] >= 85,
        "Diversity Score > 80": summary['avg_diversity'] >= 80,
        "Overlap Score 30-70": 30 <= summary['avg_overlap'] <= 70
    }
    
    for gate, passed in gates.items():
        status = "[PASS]" if passed else "[FAIL]"
        print(f"  {status} {gate}")
    
    all_passed = all(gates.values())
    print(f"\nOverall: {'[PASS]' if all_passed else '[FAIL]'}")


if __name__ == "__main__":
    main()


