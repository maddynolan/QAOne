#!/usr/bin/env python3
"""
Batch Training Data Generation Helper
Helps generate multiple training examples quickly
"""

import json
import os
import sys
import requests
import time
from typing import List, Dict, Any
from datetime import datetime

# Backend API base URL
BASE_URL = os.getenv("BACKEND_URL", "http://localhost:8001")

# Sample test cases to generate
SAMPLE_REQUIREMENTS = [
    {
        "title": "User Login Functionality",
        "description": "User should be able to log in with email and password",
        "test_type": "manual"
    },
    {
        "title": "API Authentication",
        "description": "API endpoints should require authentication token",
        "test_type": "api"
    },
    {
        "title": "Shopping Cart Checkout",
        "description": "User should be able to add items to cart and checkout",
        "test_type": "automation"
    },
    {
        "title": "Password Reset Flow",
        "description": "User should be able to reset password via email",
        "test_type": "manual"
    },
    {
        "title": "API Rate Limiting",
        "description": "API should enforce rate limits per user",
        "test_type": "api"
    },
    {
        "title": "Form Validation",
        "description": "Forms should validate required fields before submission",
        "test_type": "automation"
    },
    {
        "title": "Search Functionality",
        "description": "Users should be able to search for products",
        "test_type": "automation"
    },
    {
        "title": "Payment Processing",
        "description": "Payment gateway integration should work correctly",
        "test_type": "api"
    },
    {
        "title": "User Profile Update",
        "description": "Users should be able to update their profile information",
        "test_type": "manual"
    },
    {
        "title": "Data Export",
        "description": "Users should be able to export their data",
        "test_type": "automation"
    }
]


def generate_test_case(requirement: Dict[str, Any]) -> Dict[str, Any]:
    """Generate a test case from a requirement"""
    test_type = requirement.get("test_type", "manual")
    endpoint_map = {
        "manual": "/ai/generate-tests",
        "api": "/ai/api-tests",
        "automation": "/ai/testcase-to-playwright"
    }
    
    endpoint = endpoint_map.get(test_type, "/ai/generate-tests")
    
    # Construct prompt
    prompt = f"""Generate test cases for the following requirement:

Title: {requirement['title']}
Description: {requirement['description']}

Please generate comprehensive test cases covering positive, negative, and edge cases."""
    
    payload = {
        "project_id": "11111111-1111-1111-1111-111111111111",  # Default project
        "requirement_text": prompt,
        "test_type": test_type
    }
    
    try:
        response = requests.post(f"{BASE_URL}{endpoint}", json=payload, timeout=120)
        if response.ok:
            result = response.json()
            return {
                "success": True,
                "generation_id": result.get("generation_id"),
                "test_type": test_type,
                "requirement": requirement
            }
        else:
            return {
                "success": False,
                "error": f"HTTP {response.status_code}",
                "test_type": test_type
            }
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "test_type": test_type
        }


def batch_generate(count: int = 10, delay_seconds: float = 2.0):
    """Generate multiple training examples"""
    print("=" * 60)
    print(f"🚀 BATCH TRAINING DATA GENERATION")
    print("=" * 60)
    print(f"\nGenerating {count} training examples...")
    print(f"Delay between requests: {delay_seconds}s\n")
    
    results = []
    requirements = SAMPLE_REQUIREMENTS[:count]
    
    for i, req in enumerate(requirements, 1):
        print(f"[{i}/{count}] Generating {req['test_type']} test for: {req['title'][:50]}...")
        result = generate_test_case(req)
        results.append(result)
        
        if result["success"]:
            print(f"  ✅ Generated (ID: {result.get('generation_id', 'unknown')[:8]}...)")
        else:
            print(f"  ❌ Failed: {result.get('error', 'unknown error')}")
        
        if i < len(requirements):
            time.sleep(delay_seconds)
    
    # Summary
    print("\n" + "=" * 60)
    print("📊 SUMMARY")
    print("=" * 60)
    
    successful = sum(1 for r in results if r["success"])
    failed = len(results) - successful
    
    print(f"\n✅ Successful: {successful}")
    print(f"❌ Failed: {failed}")
    
    if successful > 0:
        print(f"\n💡 Next Steps:")
        print(f"   1. Go to your platform UI")
        print(f"   2. Rate each generation (4-5 stars for good ones)")
        print(f"   3. Use Edit & Improve for any poor outputs")
        print(f"   4. Check progress: python scripts/collect_training_data.py --status")
    
    print("\n" + "=" * 60)
    
    return results


if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="Generate training data batch")
    parser.add_argument("--count", type=int, default=10, help="Number of examples to generate")
    parser.add_argument("--delay", type=float, default=2.0, help="Delay between requests (seconds)")
    
    args = parser.parse_args()
    
    batch_generate(count=args.count, delay_seconds=args.delay)

