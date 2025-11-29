#!/usr/bin/env python3
"""
Synthetic Data Generator Script for QA Training
Generates two JSONL files:
1. qa_test_cases.jsonl - Task 1: Requirement → Test Cases
2. qa_automation_examples.jsonl - Task 2: Test Case → Automation Code
"""

import json
import random
import uuid
import argparse
import multiprocessing
from typing import List, Dict, Any
from pathlib import Path
from concurrent.futures import ProcessPoolExecutor, as_completed
import time

# App types and their feature areas
APP_TYPES = {
    "ecommerce": {
        "feature_areas": ["login", "product_search", "product_details", "cart", "checkout", "payments", "order_history"]
    },
    "crm": {
        "feature_areas": ["login", "contacts", "accounts", "opportunities", "tasks", "reports"]
    },
    "salesforce_like": {
        "feature_areas": ["login", "record_page", "list_view", "global_search", "workflow_automation", "dashboards"]
    },
    "banking": {
        "feature_areas": ["login", "account_overview", "fund_transfer", "bill_pay", "statements", "card_management"]
    },
    "helpdesk": {
        "feature_areas": ["login", "ticket_creation", "ticket_assignment", "sla_management", "knowledge_base", "reporting"]
    },
    "project_management": {
        "feature_areas": ["login", "projects", "boards", "tasks", "sprints", "burndown_reports"]
    }
}

PRIORITIES = ["P0", "P1", "P2"]
TEST_TYPES = ["functional", "negative", "boundary", "security", "performance", "accessibility"]
AUTOMATION_KINDS = ["ui", "api", "performance", "accessibility", "security"]

TEAM_BY_APP = {
    "ecommerce": "checkout",
    "crm": "sales",
    "salesforce_like": "sf-core",
    "banking": "payments",
    "helpdesk": "support",
    "project_management": "delivery"
}


def slugify(title: str) -> str:
    """Convert title to function name"""
    return "_".join(title.lower().split())


def random_requirement(app_type: str, feature_area: str) -> str:
    """Generate a requirement text based on app type and feature area"""
    templates = {
        "login": "As a user, I can log into the application with valid credentials so that I can access my account.",
        "product_search": "As a shopper, I can search for products by keyword and filters so that I can find what I need quickly.",
        "product_details": "As a shopper, I can view product details including images, price, and specifications so that I can make informed purchase decisions.",
        "cart": "As a shopper, I can add and remove items from my shopping cart so that I can manage my intended purchases.",
        "checkout": "As a shopper, I can complete checkout with different payment methods so that I can purchase items securely.",
        "payments": "As a shopper, I can pay securely using cards or wallets so that my payment details are protected.",
        "order_history": "As a shopper, I can see my past orders so that I can track deliveries and reorder items.",
        "contacts": "As a sales user, I can create and edit contacts so that I can track customer relationships.",
        "accounts": "As a sales user, I can manage accounts linked to contacts so that I can track organizational relationships.",
        "opportunities": "As a sales user, I can manage opportunities so that I can track potential revenue.",
        "tasks": "As a user, I can create and complete tasks so that I can manage my daily work.",
        "reports": "As a manager, I can view summary reports so that I can understand performance.",
        "record_page": "As a user, I can view and edit a record page so that I can update business data.",
        "list_view": "As a user, I can filter and sort list views so that I can find the right records quickly.",
        "global_search": "As a user, I can search across all records so that I can find anything fast.",
        "workflow_automation": "As an admin, I can define workflow rules so that the system can automate business processes.",
        "dashboards": "As a manager, I can see dashboards so that I can monitor key KPIs.",
        "account_overview": "As a banking customer, I can see my account balances so that I know my financial status.",
        "fund_transfer": "As a banking customer, I can transfer funds between accounts so that I can manage my money.",
        "bill_pay": "As a banking customer, I can pay bills online so that I do not need to visit physical locations.",
        "statements": "As a banking customer, I can download monthly statements so that I can track transactions.",
        "card_management": "As a banking customer, I can manage my cards so that I can freeze or replace them as needed.",
        "ticket_creation": "As a customer, I can create a support ticket so that I can report an issue and get help.",
        "ticket_assignment": "As an agent, I can assign tickets so that the right person works on each issue.",
        "sla_management": "As a manager, I can define SLAs so that tickets are resolved within agreed timeframes.",
        "knowledge_base": "As a customer, I can search the knowledge base so that I might resolve issues myself.",
        "projects": "As a project manager, I manage projects so that I can group related work.",
        "boards": "As a team member, I can use boards to visualize work so that I can see progress and priorities.",
        "tasks": "As a team member, I can create and update tasks so that work is tracked and completed.",
        "sprints": "As a scrum master, I can manage sprints so that the team delivers in iterations.",
        "burndown_reports": "As a project manager, I can view burndown charts so that I can track sprint progress."
    }
    
    text = templates.get(feature_area, f"As a user, I can use the {feature_area} feature in the {app_type} application.")
    return text.format(app_type=app_type.replace("_", " "), feature_area=feature_area.replace("_", " "))


def random_non_functional(feature_area: str) -> List[str]:
    """Generate non-functional requirements"""
    candidates = [
        "Response time under 2 seconds for main action.",
        "Error messages are clearly displayed and localized.",
        "Feature is usable on desktop and mobile browsers.",
        "Logs key actions for audit trail.",
        "No sensitive data is exposed in URLs or logs."
    ]
    
    perf = {
        "checkout": "End-to-end checkout completes within 5 seconds under typical load.",
        "fund_transfer": "Fund transfer confirmation appears within 3 seconds after submission.",
        "login": "Login completes within 2 seconds under typical load."
    }
    
    selected = random.sample(candidates, 2)
    if feature_area in perf:
        selected.append(perf[feature_area])
    
    return selected


def random_risks(feature_area: str) -> List[str]:
    """Generate risk notes"""
    base = [
        "High customer impact if this flow breaks.",
        "Compliance / regulatory impact if data is incorrect.",
        "Security risk if access control is not enforced."
    ]
    
    if feature_area in ["checkout", "payments", "fund_transfer", "bill_pay"]:
        base.append("Direct revenue or money movement impact if logic is wrong.")
    
    return random.sample(base, min(3, len(base)))


def generate_single_test_case(app_type: str, feature_area: str, scenario_name: str, idx: int) -> Dict[str, Any]:
    """Generate a single test case"""
    priority = random.choice(PRIORITIES)
    t_type = random.choice(TEST_TYPES)
    prefix = app_type[:4].upper()
    tc_id = f"TC-{prefix}-{idx:04d}"
    
    preconditions = []
    if feature_area != "login":
        preconditions.append("User is logged in.")
    if feature_area in ["checkout", "cart", "fund_transfer", "bill_pay"]:
        preconditions.append("User has at least one eligible item/account configured.")
    
    generic_steps = {
        "login": [
            "Navigate to login page.",
            "Enter valid username and password.",
            "Click Login."
        ],
        "checkout": [
            "Add a product to the cart.",
            "Go to checkout page.",
            "Select shipping method.",
            "Select payment method.",
            "Click Place order."
        ],
        "fund_transfer": [
            "Navigate to Fund Transfer page.",
            "Select source account.",
            "Select destination account.",
            "Enter transfer amount.",
            "Click Submit."
        ]
    }
    
    steps = generic_steps.get(feature_area, [
        f"Navigate to {feature_area.replace('_', '')} page.",
        "Perform the primary user action.",
        "Verify the result."
    ])
    
    expected_results = [
        "Action completes successfully.",
        "UI reflects the updated state."
    ]
    
    if t_type == "negative":
        expected_results[0] = "Action is blocked with a clear validation error."
    elif t_type == "security":
        expected_results = [
            "Unauthorized user is prevented from accessing this feature.",
            "Appropriate HTTP status code is returned (e.g., 401 or 403)."
        ]
    elif t_type == "accessibility":
        expected_results = [
            "All interactive elements are reachable via keyboard.",
            "Screen reader announces labels and roles correctly."
        ]
    
    tags = []
    if feature_area in ["login", "account_overview", "record_page"]:
        tags.append("@smoke")
    else:
        tags.append("@regression")
    
    # Domain tags
    if app_type in ["ecommerce", "banking"]:
        tags.append("@ui")
    if t_type == "performance":
        tags.append("@perf")
    if t_type == "security":
        tags.append("@security")
    if t_type == "accessibility":
        tags.append("@a11y")
    
    tags.append("@env:staging")
    tags.append(f"@team:{TEAM_BY_APP.get(app_type, 'core')}")
    
    return {
        "id": tc_id,
        "title": scenario_name,
        "description": f"{scenario_name} for {feature_area} in {app_type} application.",
        "priority": priority,
        "type": t_type,
        "preconditions": preconditions,
        "steps": steps,
        "expected_results": expected_results,
        "tags": tags
    }


def generate_test_case_example(idx: int) -> Dict[str, Any]:
    """Generate a single test case example"""
    app_type = random.choice(list(APP_TYPES.keys()))
    feature_area = random.choice(APP_TYPES[app_type]["feature_areas"])
    scenario_suffix = random.choice([
        "happy path",
        "invalid input",
        "timeout",
        "access denied",
        "field validation",
        "a11y sanity",
        "performance under load"
    ])
    scenario_name = f"{feature_area.replace('_', ' ').title()} {scenario_suffix}"
    
    requirement_text = random_requirement(app_type, feature_area)
    non_func = random_non_functional(feature_area)
    risks = random_risks(feature_area)
    
    test_case = generate_single_test_case(app_type, feature_area, scenario_name, idx)
    
    return {
        "task": "generate_test_cases",
        "input": {
            "app_type": app_type,
            "feature_area": feature_area,
            "scenario_name": scenario_name,
            "requirement_text": requirement_text,
            "non_functional_requirements": non_func,
            "risk_notes": risks
        },
        "output": {
            "test_cases": [test_case]
        }
    }


def render_playwright_ts(test_case: Dict[str, Any]) -> str:
    """Render Playwright TypeScript code"""
    steps_comments = "\n    // ".join(test_case["steps"])
    return f"""import {{ test, expect }} from '@playwright/test';

test('{test_case['title']}', async ({{ page }}) => {{
    // {steps_comments}
    // TODO: Add concrete selectors and assertions based on the app under test
    await page.goto('https://example.com');
    // Add test steps here
}});
"""


def render_api_pytest(test_case: Dict[str, Any]) -> str:
    """Render pytest API test code"""
    func_name = slugify(test_case['title'])
    return f"""import requests

def test_{func_name}():
    base_url = 'https://api.example.com'
    # TODO: Adjust endpoint and payload based on the app under test
    response = requests.get(f'{{base_url}}/health')
    assert response.status_code == 200
"""


def render_k6_performance(test_case: Dict[str, Any]) -> str:
    """Render k6 performance test script"""
    return """import http from 'k6/http';
import { sleep } from 'k6';

export const options = {
    vus: 10,
    duration: '30s',
};

export default function () {
    http.get('https://example.com');
    // TODO: Add checks and thresholds relevant to the scenario
    sleep(1);
}
"""


def render_axe_accessibility(test_case: Dict[str, Any]) -> str:
    """Render axe accessibility test script"""
    return """const { Builder } = require('selenium-webdriver');
const { AxeBuilder } = require('@axe-core/webdriver');

async function runAxeScan() {
    let driver = await new Builder().forBrowser('chrome').build();
    try {
        await driver.get('https://example.com');
        const results = await new AxeBuilder(driver).analyze();
        console.log(JSON.stringify(results, null, 2));
    } finally {
        await driver.quit();
    }
}

runAxeScan();
"""


def render_zap_security(test_case: Dict[str, Any]) -> str:
    """Render ZAP security test script"""
    return """from zapv2 import ZAPv2

zap = ZAPv2(apikey='YOUR_ZAP_API_KEY')
target = 'https://example.com'

print('Opening target...')
zap.urlopen(target)

print('Spidering...')
zap.spider.scan(target)

print('Active scanning...')
zap.ascan.scan(target)
# TODO: Add logic to parse and assert on alerts
"""


def generate_automation_example(idx: int) -> Dict[str, Any]:
    """Generate a single automation example"""
    # Reuse logic to create a base test case
    test_case_example = generate_test_case_example(idx)
    test_case = test_case_example["output"]["test_cases"][0]
    app_type = test_case_example["input"]["app_type"]
    
    automation_kind = random.choice(AUTOMATION_KINDS)
    
    if automation_kind == "ui":
        framework = "playwright"
        language = "typescript"
        script = render_playwright_ts(test_case)
    elif automation_kind == "api":
        framework = "pytest"
        language = "python"
        script = render_api_pytest(test_case)
    elif automation_kind == "performance":
        framework = "k6"
        language = "javascript"
        script = render_k6_performance(test_case)
    elif automation_kind == "accessibility":
        framework = "axe"
        language = "javascript"
        script = render_axe_accessibility(test_case)
    else:  # security
        framework = "zap"
        language = "python"
        script = render_zap_security(test_case)
    
    entry_function = slugify(test_case["title"])
    metadata = {
        "requires_env": "staging",
        "estimated_runtime_sec": random.choice([10, 20, 30, 60]),
        "app_type": app_type,
        "automation_kind": automation_kind
    }
    
    return {
        "task": "generate_automation",
        "input": {
            "app_type": app_type,
            "automation_kind": automation_kind,
            "framework": framework,
            "language": language,
            "test_case": test_case
        },
        "output": {
            "kind": automation_kind,
            "framework": framework,
            "language": language,
            "script": script,
            "entry_function": entry_function,
            "metadata": metadata
        }
    }


def _generate_single_test_case(idx: int) -> tuple:
    """Generate a single test case (for multiprocessing)"""
    try:
        ex = generate_test_case_example(idx)
        return (idx, json.dumps(ex, ensure_ascii=False))
    except Exception as e:
        print(f"Error generating test case {idx}: {e}")
        return (idx, None)

def _generate_single_automation(idx: int) -> tuple:
    """Generate a single automation example (for multiprocessing)"""
    try:
        ex = generate_automation_example(idx)
        return (idx, json.dumps(ex, ensure_ascii=False))
    except Exception as e:
        print(f"Error generating automation {idx}: {e}")
        return (idx, None)

def generate_parallel(generate_func, total_count: int, num_workers: int = None):
    """Generate examples in parallel using multiprocessing"""
    if num_workers is None:
        num_workers = min(multiprocessing.cpu_count(), 8)  # Cap at 8 workers
    
    print(f"  Using {num_workers} parallel workers...")
    
    # Create list of indices
    indices = list(range(1, total_count + 1))
    
    all_results = {}
    completed = 0
    start_time = time.time()
    
    with ProcessPoolExecutor(max_workers=num_workers) as executor:
        # Submit all tasks
        future_to_idx = {executor.submit(generate_func, idx): idx for idx in indices}
        
        # Process completed tasks
        for future in as_completed(future_to_idx):
            idx, result = future.result()
            if result is not None:
                all_results[idx] = result
            completed += 1
            
            # Progress update every 50 items or at completion
            if completed % 50 == 0 or completed == total_count:
                elapsed = time.time() - start_time
                rate = completed / elapsed if elapsed > 0 else 0
                remaining = total_count - completed
                eta_seconds = remaining / rate if rate > 0 else 0
                eta_minutes = eta_seconds / 60
                
                print(f"  Progress: {completed}/{total_count} ({completed*100//total_count}%) | "
                      f"Rate: {rate:.1f}/s | ETA: {eta_minutes:.1f} min")
    
    # Sort by index and return as list
    return [all_results[i] for i in sorted(all_results.keys())]

def main():
    """Main function"""
    parser = argparse.ArgumentParser(description="Generate synthetic QA training data")
    parser.add_argument("--test-cases", type=int, default=200, help="Number of test case generation examples to create.")
    parser.add_argument("--automation", type=int, default=200, help="Number of automation generation examples to create.")
    parser.add_argument("--test-cases-out", type=str, default="qa_test_cases.jsonl", help="Output file for test cases")
    parser.add_argument("--automation-out", type=str, default="qa_automation_examples.jsonl", help="Output file for automation examples")
    parser.add_argument("--num-workers", type=int, default=None, help="Number of parallel workers (default: CPU count, max 8)")
    
    args = parser.parse_args()
    
    # Ensure output directory exists
    output_dir = Path("data")
    output_dir.mkdir(exist_ok=True)
    
    test_cases_path = output_dir / args.test_cases_out
    automation_path = output_dir / args.automation_out
    
    print("=" * 60)
    print("QA Synthetic Data Generator (OPTIMIZED)")
    print("=" * 60)
    print(f"Generating {args.test_cases} test case examples...")
    print(f"Generating {args.automation} automation examples...")
    print()
    
    # Generate test case examples in parallel
    start_time = time.time()
    print("Step 1: Generating test cases...")
    test_case_results = generate_parallel(
        _generate_single_test_case, 
        args.test_cases, 
        num_workers=args.num_workers
    )
    
    # Write test cases to file
    with open(test_cases_path, "w", encoding="utf-8") as f:
        for line in test_case_results:
            f.write(line + "\n")
    
    test_duration = time.time() - start_time
    print(f"[OK] Test cases saved to: {test_cases_path} ({test_duration:.1f}s, {args.test_cases/test_duration:.1f} examples/s)")
    
    # Generate automation examples in parallel
    start_time = time.time()
    print()
    print("Step 2: Generating automation examples...")
    automation_results = generate_parallel(
        _generate_single_automation,
        args.automation,
        num_workers=args.num_workers
    )
    
    # Write automation examples to file
    with open(automation_path, "w", encoding="utf-8") as f:
        for line in automation_results:
            f.write(line + "\n")
    
    automation_duration = time.time() - start_time
    print(f"[OK] Automation examples saved to: {automation_path} ({automation_duration:.1f}s, {args.automation/automation_duration:.1f} examples/s)")
    
    total_duration = test_duration + automation_duration
    print()
    print("=" * 60)
    print(f"[OK] Generation complete! Total time: {total_duration:.1f}s")
    print(f"    Total examples: {args.test_cases + args.automation}")
    print(f"    Average rate: {(args.test_cases + args.automation)/total_duration:.1f} examples/s")
    print("=" * 60)
    print()
    print("Next steps:")
    print("1. Review the generated JSONL files")
    print("2. Use these files for finetuning Qwen Coder 3 30B")
    print("3. Mix in real enterprise test cases as they come (same schema)")


if __name__ == "__main__":
    main()

