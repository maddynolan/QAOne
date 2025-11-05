#!/usr/bin/env python3
"""
Validate training data quality before fine-tuning
- Check JSON validity
- Detect duplicates using pgvector similarity
- Validate required fields
- Check output quality
"""

import json
import sys
import os
import requests
from typing import List, Dict, Any
from collections import Counter

# Backend API base URL
BASE_URL = os.getenv("BACKEND_URL", "http://localhost:8001")


def validate_json_validity(outputs: List[str]) -> Dict[str, Any]:
    """Check if all outputs are valid JSON"""
    valid_count = 0
    invalid_count = 0
    invalid_examples = []
    
    for i, output in enumerate(outputs):
        try:
            json.loads(output)
            valid_count += 1
        except json.JSONDecodeError as e:
            invalid_count += 1
            invalid_examples.append({
                "index": i,
                "error": str(e),
                "preview": output[:100] + "..." if len(output) > 100 else output
            })
    
    return {
        "valid": valid_count,
        "invalid": invalid_count,
        "validity_rate": valid_count / len(outputs) if outputs else 0,
        "invalid_examples": invalid_examples[:10]  # Show first 10
    }


def validate_required_fields(data: List[Dict]) -> Dict[str, Any]:
    """Check if all required fields are present"""
    required = ["instruction", "input", "output"]
    missing_fields = []
    
    for i, entry in enumerate(data):
        missing = [field for field in required if not entry.get(field)]
        if missing:
            missing_fields.append({
                "index": i,
                "missing_fields": missing
            })
    
    return {
        "total": len(data),
        "complete": len(data) - len(missing_fields),
        "missing_fields_count": len(missing_fields),
        "examples": missing_fields[:10]
    }


def validate_output_quality(outputs: List[str]) -> Dict[str, Any]:
    """Check output quality (length, emptiness, etc.)"""
    lengths = [len(output) for output in outputs]
    empty_count = sum(1 for o in outputs if not o.strip())
    
    return {
        "total": len(outputs),
        "empty": empty_count,
        "min_length": min(lengths) if lengths else 0,
        "max_length": max(lengths) if lengths else 0,
        "avg_length": sum(lengths) / len(lengths) if lengths else 0,
        "quality_issues": empty_count
    }


def check_duplicates_via_api(data: List[Dict], similarity_threshold: float = 0.95) -> Dict[str, Any]:
    """Check for duplicate prompts using API (if pgvector available)"""
    # This would require an API endpoint to check similarity
    # For now, do simple text-based duplicate detection
    prompts = [entry.get("input", "") for entry in data]
    prompt_counts = Counter(prompts)
    duplicates = {prompt: count for prompt, count in prompt_counts.items() if count > 1}
    
    return {
        "total_unique": len(set(prompts)),
        "duplicates": len(duplicates),
        "duplicate_examples": list(duplicates.items())[:10]
    }


def validate_training_data(file_path: str = None, data: List[Dict] = None) -> Dict[str, Any]:
    """Main validation function"""
    if file_path:
        # Load from JSONL file
        with open(file_path, 'r', encoding='utf-8') as f:
            data = [json.loads(line) for line in f]
    elif data is None:
        # Fetch from API
        try:
            response = requests.get(f"{BASE_URL}/ai/training-data/export?min_quality_score=4&format=json&limit=1000")
            if response.ok:
                result = response.json()
                data = result.get("data", [])
            else:
                print(f"ERROR: Failed to fetch data: {response.status_code}")
                return {}
        except Exception as e:
            print(f"ERROR: Failed to fetch data: {e}")
            return {}
    
    if not data:
        print("ERROR: No data to validate")
        return {}
    
    print(f"Validating {len(data)} training examples...\n")
    
    # Extract outputs
    outputs = [entry.get("output", "") for entry in data]
    
    # Run validations
    json_validity = validate_json_validity(outputs)
    required_fields = validate_required_fields(data)
    output_quality = validate_output_quality(outputs)
    duplicates = check_duplicates_via_api(data)
    
    # Summary
    results = {
        "total_examples": len(data),
        "json_validity": json_validity,
        "required_fields": required_fields,
        "output_quality": output_quality,
        "duplicates": duplicates,
        "overall_quality": "good" if json_validity["validity_rate"] >= 0.95 and required_fields["complete"] == len(data) else "needs_improvement"
    }
    
    # Print results
    print("=" * 60)
    print("VALIDATION RESULTS")
    print("=" * 60)
    print(f"\nTotal Examples: {results['total_examples']}")
    
    print(f"\n📋 JSON Validity:")
    print(f"  Valid: {json_validity['valid']}")
    print(f"  Invalid: {json_validity['invalid']}")
    print(f"  Validity Rate: {json_validity['validity_rate']:.2%}")
    if json_validity['invalid_examples']:
        print(f"  ⚠️  First {len(json_validity['invalid_examples'])} invalid examples:")
        for ex in json_validity['invalid_examples'][:5]:
            print(f"    - Index {ex['index']}: {ex['error']}")
    
    print(f"\n📝 Required Fields:")
    print(f"  Complete: {required_fields['complete']}")
    print(f"  Missing Fields: {required_fields['missing_fields_count']}")
    if required_fields['examples']:
        print(f"  ⚠️  Examples with missing fields:")
        for ex in required_fields['examples'][:5]:
            print(f"    - Index {ex['index']}: Missing {', '.join(ex['missing_fields'])}")
    
    print(f"\n📊 Output Quality:")
    print(f"  Empty outputs: {output_quality['empty']}")
    print(f"  Avg length: {output_quality['avg_length']:.0f} chars")
    print(f"  Min length: {output_quality['min_length']} chars")
    print(f"  Max length: {output_quality['max_length']} chars")
    
    print(f"\n🔄 Duplicates:")
    print(f"  Unique prompts: {duplicates['total_unique']}")
    print(f"  Duplicates: {duplicates['duplicates']}")
    if duplicates['duplicate_examples']:
        print(f"  ⚠️  Duplicate examples:")
        for prompt, count in duplicates['duplicate_examples'][:5]:
            print(f"    - '{prompt[:50]}...' appears {count} times")
    
    print(f"\n✅ Overall Quality: {results['overall_quality'].upper()}")
    print("=" * 60)
    
    return results


def main():
    import argparse
    
    parser = argparse.ArgumentParser(description="Validate training data quality")
    parser.add_argument("--file", "-f", help="Path to JSONL training data file")
    parser.add_argument("--api", "-a", action="store_true", help="Fetch from API instead of file")
    parser.add_argument("--min-quality", type=int, default=4, help="Minimum quality score for API fetch")
    
    args = parser.parse_args()
    
    if args.api:
        validate_training_data()
    elif args.file:
        if not os.path.exists(args.file):
            print(f"ERROR: File not found: {args.file}")
            sys.exit(1)
        validate_training_data(file_path=args.file)
    else:
        print("ERROR: Must specify --file or --api")
        parser.print_help()
        sys.exit(1)


if __name__ == "__main__":
    main()

