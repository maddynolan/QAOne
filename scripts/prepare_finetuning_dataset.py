#!/usr/bin/env python3
"""
Prepare combined finetuning dataset from separate Task 1 and Task 2 files
Combines qa_test_cases.jsonl and qa_automation_examples.jsonl into qa_training_data.jsonl
"""

import json
import argparse
from pathlib import Path
from typing import Dict, Any

def load_jsonl(file_path: Path) -> list:
    """Load JSONL file"""
    data = []
    with open(file_path, 'r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if line:
                data.append(json.loads(line))
    return data

def save_jsonl(data: list, file_path: Path):
    """Save data to JSONL file"""
    with open(file_path, 'w', encoding='utf-8') as f:
        for item in data:
            f.write(json.dumps(item, ensure_ascii=False) + '\n')

def transform_task1_to_training_format(example: Dict[str, Any]) -> Dict[str, Any]:
    """Transform Task 1 example to training format"""
    return {
        "task": "req_to_tests_all",
        "input": {
            "requirement": example.get("input", {}).get("requirement_text", ""),
            "app_type": example.get("input", {}).get("app_type", ""),
            "env": example.get("input", {}).get("environment", "staging"),
            "test_domains": example.get("input", {}).get("test_domains", ["ui", "api"]),
            "style": example.get("input", {}).get("test_style", "step-list")
        },
        "output": {
            "test_cases": example.get("output", {}).get("test_cases", []),
            "code": {}  # Task 1 doesn't have code
        }
    }

def transform_task2_to_training_format(example: Dict[str, Any]) -> Dict[str, Any]:
    """Transform Task 2 example to training format"""
    # Extract test case info from input
    test_case = example.get("input", {}).get("test_case", {})
    automation_kind = example.get("input", {}).get("automation_kind", "ui")
    framework = example.get("input", {}).get("framework", "playwright")
    
    # Build requirement text from test case
    requirement_text = f"Test: {test_case.get('title', '')} - {test_case.get('description', '')}"
    
    # Build code object
    code_obj = {}
    script = example.get("output", {}).get("script", "")
    
    if automation_kind == "ui":
        code_obj["ui_playwright_ts"] = script
    elif automation_kind == "api":
        code_obj["api_pytest"] = script
    elif automation_kind == "performance":
        code_obj["perf_k6"] = script
    elif automation_kind == "accessibility":
        code_obj["a11y_script"] = script
    elif automation_kind == "security":
        code_obj["security_zap_config"] = script
    
    return {
        "task": "req_to_tests_all",
        "input": {
            "requirement": requirement_text,
            "app_type": test_case.get("app_type", ""),
            "env": "staging",
            "test_domains": [automation_kind],
            "style": "step-list"
        },
        "output": {
            "test_cases": [test_case],  # Include the test case
            "code": code_obj
        }
    }

def main():
    parser = argparse.ArgumentParser(description="Prepare combined finetuning dataset")
    parser.add_argument(
        "--test-cases-file",
        type=str,
        default="data/qa_test_cases.jsonl",
        help="Path to Task 1 JSONL file"
    )
    parser.add_argument(
        "--automation-file",
        type=str,
        default="data/qa_automation_examples.jsonl",
        help="Path to Task 2 JSONL file"
    )
    parser.add_argument(
        "--output",
        type=str,
        default="data/qa_training_data.jsonl",
        help="Output combined dataset path"
    )
    parser.add_argument(
        "--max-examples",
        type=int,
        default=None,
        help="Maximum examples per task (for testing)"
    )
    
    args = parser.parse_args()
    
    test_cases_file = Path(args.test_cases_file)
    automation_file = Path(args.automation_file)
    output_file = Path(args.output)
    
    print("=" * 60)
    print("Preparing Finetuning Dataset")
    print("=" * 60)
    print(f"Task 1 file: {test_cases_file}")
    print(f"Task 2 file: {automation_file}")
    print(f"Output file: {output_file}")
    print()
    
    # Load Task 1 data
    if test_cases_file.exists():
        print(f"Loading Task 1 data from {test_cases_file}...")
        task1_data = load_jsonl(test_cases_file)
        if args.max_examples:
            task1_data = task1_data[:args.max_examples]
        print(f"  [OK] Loaded {len(task1_data)} Task 1 examples")
    else:
        print(f"  [WARNING] Task 1 file not found: {test_cases_file}")
        task1_data = []
    
    # Load Task 2 data
    if automation_file.exists():
        print(f"Loading Task 2 data from {automation_file}...")
        task2_data = load_jsonl(automation_file)
        if args.max_examples:
            task2_data = task2_data[:args.max_examples]
        print(f"  [OK] Loaded {len(task2_data)} Task 2 examples")
    else:
        print(f"  [WARNING] Task 2 file not found: {automation_file}")
        task2_data = []
    
    if not task1_data and not task2_data:
        print("\n[ERROR] No data found in either file!")
        return
    
    # Transform to training format
    print("\nTransforming to training format...")
    combined_data = []
    
    for example in task1_data:
        try:
            transformed = transform_task1_to_training_format(example)
            combined_data.append(transformed)
        except Exception as e:
            print(f"  [WARNING] Error transforming Task 1 example: {e}")
    
    for example in task2_data:
        try:
            transformed = transform_task2_to_training_format(example)
            combined_data.append(transformed)
        except Exception as e:
            print(f"  [WARNING] Error transforming Task 2 example: {e}")
    
    print(f"  [OK] Transformed {len(combined_data)} examples")
    
    # Save combined dataset
    print(f"\nSaving combined dataset to {output_file}...")
    output_file.parent.mkdir(parents=True, exist_ok=True)
    save_jsonl(combined_data, output_file)
    print(f"  [OK] Saved {len(combined_data)} examples")
    
    print()
    print("=" * 60)
    print("[OK] Dataset preparation complete!")
    print("=" * 60)
    print(f"Output: {output_file}")
    print(f"Total examples: {len(combined_data)}")
    print(f"   - Task 1: {len(task1_data)}")
    print(f"   - Task 2: {len(task2_data)}")
    print()
    print("Next step: Run finetuning")
    print(f"  python scripts/finetune_qwen3_30b_qa.py")

if __name__ == "__main__":
    main()

