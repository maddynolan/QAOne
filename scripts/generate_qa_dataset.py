#!/usr/bin/env python3
"""
Generate synthetic QA training dataset for finetuning Qwen3 Coder 30B
Creates JSONL file with structured test cases and automation code
"""

import json
import uuid
import asyncio
import httpx
from typing import List, Dict, Any
from pathlib import Path

API_URL = "http://localhost:8000/v1/chat/completions"  # vLLM or gateway
MODEL_ID = "Qwen/Qwen3-Coder-30B-A3B-Instruct"

APP_TYPES = [
    ("ecommerce", "As a shopper, I can add items to cart and checkout with credit card or PayPal."),
    ("crm", "As a sales rep, I can create and update opportunities linked to accounts."),
    ("banking", "As a user, I can transfer money between my accounts and view recent transactions."),
    ("analytics", "As an analyst, I can filter dashboards by date range and export CSV."),
    ("auth", "As a user, I can sign up, login, reset password, and enable 2FA."),
    ("admin-portal", "As an admin, I can manage users, roles, and permissions."),
    ("web", "As a user, I can navigate through the website and complete key user flows."),
    ("api-only", "As a developer, I can use the REST API to create, read, update, and delete resources."),
    ("mobile-webview", "As a mobile user, I can access the webview app and complete transactions."),
]

TEST_DOMAINS = ["ui", "api", "performance", "accessibility", "security"]

SYSTEM_PROMPT = """You are a senior QA automation architect.
Given a requirement, app_type, env, and test domains, you MUST return:
- A JSON object with 'test_cases' (list) and 'code' (object).
- test_cases include ui/api/perf/a11y/security where applicable.
- code includes runnable Playwright TS, pytest API tests, k6 script, a11y script, and ZAP config.
Use realistic but generic fields (no client-specific data).

Return STRICT JSON with this exact schema:
{
  "test_cases": [
    {
      "id": "TC_UI_001",
      "type": "ui",
      "priority": "P0",
      "title": "Test case title",
      "preconditions": ["Precondition 1"],
      "steps": [
        {"action": "Step action", "expectedResult": "Expected result"}
      ],
      "expected": ["Expected outcome 1"],
      "tags": ["@ui", "@smoke", "@env:staging"]
    }
  ],
  "code": {
    "ui_playwright_ts": "// Playwright TypeScript code",
    "api_pytest": "# pytest API test code",
    "perf_k6": "// k6 script",
    "a11y_script": "// axe or Lighthouse script",
    "security_zap_config": "# ZAP scan config"
  }
}"""


async def call_llm(requirement: str, app_type: str, test_domains: List[str], env: str = "staging") -> Dict:
    """Call LLM to generate test cases and code"""
    prompt = f"""
Requirement:
{requirement}

App type: {app_type}
Environment: {env}
Test domains: {', '.join(test_domains)}

Return STRICT JSON with:
{{
  "test_cases": [...],
  "code": {{
    "ui_playwright_ts": "...",
    "api_pytest": "...",
    "perf_k6": "...",
    "a11y_script": "...",
    "security_zap_config": "..."
  }}
}}
"""

    async with httpx.AsyncClient(timeout=120) as client:
        try:
            resp = await client.post(
                API_URL,
                json={
                    "model": MODEL_ID,
                    "messages": [
                        {"role": "system", "content": SYSTEM_PROMPT},
                        {"role": "user", "content": prompt}
                    ],
                    "temperature": 0.2,
                    "max_tokens": 4096
                }
            )
            resp.raise_for_status()
            data = resp.json()
            
            # Extract content from response
            if "choices" in data and len(data["choices"]) > 0:
                content = data["choices"][0]["message"]["content"]
                # Try to extract JSON from response
                if "```json" in content:
                    content = content.split("```json")[1].split("```")[0].strip()
                elif "```" in content:
                    content = content.split("```")[1].split("```")[0].strip()
                
                return json.loads(content)
            else:
                raise ValueError("No choices in response")
        except Exception as e:
            print(f"Error calling LLM: {e}")
            # Return fallback structure
            return {
                "test_cases": [{
                    "id": f"TC_{app_type.upper()}_001",
                    "type": "ui",
                    "priority": "P1",
                    "title": f"Test {requirement[:50]}",
                    "preconditions": [],
                    "steps": [{"action": "Execute test", "expectedResult": "Test passes"}],
                    "expected": ["Test completes"],
                    "tags": [f"@{app_type}", "@env:staging"]
                }],
                "code": {
                    "ui_playwright_ts": "// Placeholder code",
                    "api_pytest": "# Placeholder code",
                    "perf_k6": "// Placeholder code",
                    "a11y_script": "// Placeholder code",
                    "security_zap_config": "# Placeholder code"
                }
            }


async def generate_record(app_type: str, requirement: str, test_domains: List[str], 
                         env: str = "staging", style: str = "step-list", 
                         task: str = "req_to_tests") -> Dict[str, Any]:
    """Generate a single training record following the schema"""
    requirement_id = f"REQ-{uuid.uuid4().hex[:8].upper()}"
    
    if task == "req_to_testplan":
        # Task 1: Generate test plan
        result = await call_llm_for_testplan(requirement, app_type, test_domains, env)
        record = {
            "id": str(uuid.uuid4()),
            "task": "req_to_testplan",
            "input": {
                "requirement_id": requirement_id,
                "requirement_title": f"Requirement for {app_type}",
                "requirement_text": requirement,
                "domain_tags": [app_type],
                "risk_level": "medium",
                "non_functional_focus": [d for d in test_domains if d in ["performance", "accessibility", "security"]]
            },
            "output": result
        }
    else:
        # Task 2: Generate concrete tests + code
        result = await call_llm(requirement, app_type, test_domains, env)
        
        # Transform to match schema
        tests = []
        for idx, tc in enumerate(result.get("test_cases", [])):
            test_type = tc.get("type", "ui")
            framework_map = {
                "ui": "playwright",
                "api": "pytest-api",
                "performance": "k6",
                "accessibility": "axe",
                "security": "zap"
            }
            language_map = {
                "ui": "typescript",
                "api": "python",
                "performance": "javascript",
                "accessibility": "javascript",
                "security": "yaml"
            }
            
            code_map = result.get("code", {})
            code = ""
            if test_type == "ui":
                code = code_map.get("ui_playwright_ts", "")
            elif test_type == "api":
                code = code_map.get("api_pytest", "")
            elif test_type == "performance":
                code = code_map.get("perf_k6", "")
            elif test_type == "accessibility":
                code = code_map.get("a11y_script", "")
            elif test_type == "security":
                code = code_map.get("security_zap_config", "")
            
            steps = []
            for step_idx, step in enumerate(tc.get("steps", []), 1):
                steps.append({
                    "index": step_idx,
                    "action": step.get("action", ""),
                    "expected_result": step.get("expectedResult", step.get("expected", "")),
                    "notes": None
                })
            
            test = {
                "id": tc.get("id", f"TC_{test_type.upper()}_{idx+1:03d}"),
                "name": tc.get("name", tc.get("title", "")),
                "description": tc.get("description", ""),
                "linked_scenario_id": None,  # Can link to test plan scenarios if available
                "test_type": test_type,
                "framework": framework_map.get(test_type, "playwright"),
                "language": language_map.get(test_type, "typescript"),
                "tags": tc.get("tags", []),
                "steps": steps,
                "assertions": tc.get("expected", []),
                "preconditions": tc.get("preconditions", []),
                "postconditions": [],
                "code": code,
                "additional_files": []
            }
            tests.append(test)
        
        record = {
            "id": str(uuid.uuid4()),
            "task": "req_to_tests",
            "input": {
                "requirement_id": requirement_id,
                "requirement_title": f"Requirement for {app_type}",
                "requirement_text": requirement,
                "domain_tags": [app_type],
                "target_frameworks": [framework_map.get(d, "playwright") for d in test_domains]
            },
            "output": {
                "tests": tests
            }
        }
    
    return record


async def call_llm_for_testplan(requirement: str, app_type: str, test_domains: List[str], env: str = "staging") -> Dict:
    """Call LLM to generate test plan (Task 1)"""
    prompt = f"""
Requirement:
{requirement}

App type: {app_type}
Environment: {env}
Test domains: {', '.join(test_domains)}

Generate a test plan with scenarios following this structure:
{{
  "test_plan_id": "TP_001",
  "summary": "Short summary",
  "scenarios": [
    {{
      "scenario_id": "SC_001",
      "name": "Scenario name",
      "description": "Description",
      "type": "functional|non_functional|edge_case|negative",
      "test_types": ["ui", "api", "performance", "accessibility", "security"],
      "priority": "P0|P1|P2|P3",
      "is_positive": true,
      "preconditions": [],
      "postconditions": [],
      "tags": []
    }}
  ],
  "coverage_summary": {{
    "happy_path_covered": true,
    "negative_paths_covered": false,
    "edge_cases_covered": false,
    "performance_covered": false,
    "accessibility_covered": false,
    "security_covered": false
  }}
}}

Return STRICT JSON only.
"""

    async with httpx.AsyncClient(timeout=120) as client:
        try:
            resp = await client.post(
                API_URL,
                json={
                    "model": MODEL_ID,
                    "messages": [
                        {"role": "system", "content": SYSTEM_PROMPT},
                        {"role": "user", "content": prompt}
                    ],
                    "temperature": 0.2,
                    "max_tokens": 4096
                }
            )
            resp.raise_for_status()
            data = resp.json()
            
            if "choices" in data and len(data["choices"]) > 0:
                content = data["choices"][0]["message"]["content"]
                if "```json" in content:
                    content = content.split("```json")[1].split("```")[0].strip()
                elif "```" in content:
                    content = content.split("```")[1].split("```")[0].strip()
                
                return json.loads(content)
            else:
                raise ValueError("No choices in response")
        except Exception as e:
            print(f"Error calling LLM for test plan: {e}")
            # Return fallback structure
            return {
                "test_plan_id": f"TP_{app_type.upper()}_001",
                "summary": f"Test plan for {requirement[:50]}",
                "scenarios": [{
                    "scenario_id": "SC_001",
                    "name": "Main scenario",
                    "type": "functional",
                    "test_types": test_domains,
                    "priority": "P1",
                    "is_positive": True
                }],
                "coverage_summary": {
                    "happy_path_covered": True,
                    "negative_paths_covered": False,
                    "edge_cases_covered": False,
                    "performance_covered": "performance" in test_domains,
                    "accessibility_covered": "accessibility" in test_domains,
                    "security_covered": "security" in test_domains
                }
            }


async def main():
    """Main function to generate dataset"""
    output_path = Path("data/qa_training_data.jsonl")
    output_path.parent.mkdir(exist_ok=True)
    
    print("=" * 60)
    print("QA Training Dataset Generator")
    print("=" * 60)
    print(f"Generating dataset to: {output_path}")
    print()
    
    records = []
    total = len(APP_TYPES) * 2  # Task 1 + Task 2 for each app type
    current = 0
    
    with open(output_path, "w", encoding="utf-8") as f:
        for app_type, requirement in APP_TYPES:
            print(f"Processing {app_type}...")
            
            # Task 1: Generate test plan
            print(f"  Generating test plan (Task 1)...")
            record = await generate_record(app_type, requirement, TEST_DOMAINS, task="req_to_testplan")
            f.write(json.dumps(record, ensure_ascii=False) + "\n")
            records.append(record)
            current += 1
            print(f"  ✓ Generated test plan record {current}/{total}")
            
            # Task 2: Generate concrete tests + code
            print(f"  Generating tests + code (Task 2)...")
            record = await generate_record(app_type, requirement, TEST_DOMAINS, task="req_to_tests")
            f.write(json.dumps(record, ensure_ascii=False) + "\n")
            records.append(record)
            current += 1
            print(f"  ✓ Generated tests record {current}/{total}")
            
            # Small delay to avoid rate limiting
            await asyncio.sleep(1)
    
    print()
    print("=" * 60)
    print(f"✅ Generated {len(records)} training records")
    print(f"📁 Saved to: {output_path}")
    print("=" * 60)


if __name__ == "__main__":
    asyncio.run(main())

