#!/usr/bin/env python3
"""
Senior QA Expert: Data Collection Workflow
Helps guide and track data collection for fine-tuning
"""

import json
import os
import sys
import requests
from datetime import datetime
from typing import Dict, List, Any
from collections import defaultdict

# Backend API base URL
BASE_URL = os.getenv("BACKEND_URL", "http://localhost:8001")


def get_data_stats() -> Dict[str, Any]:
    """Get current data collection statistics"""
    try:
        response = requests.get(f"{BASE_URL}/ai/training-data/export?min_quality_score=4&format=json&limit=1000")
        if response.ok:
            result = response.json()
            data = result.get("data", [])
            
            stats = {
                "total": len(data),
                "by_category": defaultdict(int),
                "by_complexity": defaultdict(int),
                "high_quality": 0,
                "corrected": 0,
                "approved": 0
            }
            
            for entry in data:
                category = entry.get("task_type", "unknown")
                stats["by_category"][category] += 1
                
                if entry.get("quality_score", 0) >= 4:
                    stats["high_quality"] += 1
                
                if entry.get("has_correction", False):
                    stats["corrected"] += 1
                
                if entry.get("is_approved", False):
                    stats["approved"] += 1
            
            return stats
        else:
            print(f"ERROR: Failed to fetch data: {response.status_code}")
            return {}
    except Exception as e:
        print(f"ERROR: Failed to fetch data: {e}")
        return {}


def print_data_collection_status():
    """Print current data collection status"""
    print("=" * 60)
    print("📊 DATA COLLECTION STATUS")
    print("=" * 60)
    
    stats = get_data_stats()
    
    if not stats:
        print("\n⚠️  Could not fetch statistics. Is backend running?")
        return
    
    print(f"\n📈 Overall Statistics:")
    print(f"  Total Examples: {stats['total']}")
    print(f"  High Quality (4+ stars): {stats['high_quality']}")
    print(f"  Corrected: {stats['corrected']}")
    print(f"  Approved: {stats['approved']}")
    
    print(f"\n📋 By Task Category:")
    for category, count in sorted(stats['by_category'].items(), key=lambda x: -x[1]):
        print(f"  {category}: {count}")
    
    # Recommendations
    print(f"\n💡 Recommendations:")
    
    if stats['total'] < 500:
        needed = 500 - stats['total']
        print(f"  ⚠️  Need {needed} more examples to reach 500 target")
    
    if stats['high_quality'] < 300:
        needed = 300 - stats['high_quality']
        print(f"  ⚠️  Need {needed} more high-quality examples (4+ stars)")
    
    if stats['corrected'] < 100:
        needed = 100 - stats['corrected']
        print(f"  ⚠️  Need {needed} more corrected examples")
    
    # Check distribution
    categories = list(stats['by_category'].keys())
    if len(categories) < 4:
        print(f"  ⚠️  Need more diverse task categories (currently: {len(categories)})")
    
    print("\n" + "=" * 60)


def generate_data_collection_plan():
    """Generate a data collection plan"""
    stats = get_data_stats()
    
    if not stats:
        print("⚠️  Cannot generate plan without statistics")
        return
    
    print("=" * 60)
    print("📋 DATA COLLECTION PLAN")
    print("=" * 60)
    
    target_total = 500
    target_high_quality = 300
    target_corrected = 100
    
    current_total = stats['total']
    current_high_quality = stats['high_quality']
    current_corrected = stats['corrected']
    
    print(f"\n🎯 Targets:")
    print(f"  Total Examples: {target_total} (Current: {current_total}, Need: {max(0, target_total - current_total)})")
    print(f"  High Quality: {target_high_quality} (Current: {current_high_quality}, Need: {max(0, target_high_quality - current_high_quality)})")
    print(f"  Corrected: {target_corrected} (Current: {current_corrected}, Need: {max(0, target_corrected - current_corrected)})")
    
    print(f"\n📝 Next Steps:")
    
    if current_total < target_total:
        print(f"  1. Generate {target_total - current_total} more test cases")
        print(f"     - Use the platform to create diverse test scenarios")
        print(f"     - Cover all test types: manual, API, automation, triage")
    
    if current_high_quality < target_high_quality:
        print(f"  2. Rate {target_high_quality - current_high_quality} more as 4+ stars")
        print(f"     - Review existing generations")
        print(f"     - Use Quality Rating UI")
    
    if current_corrected < target_corrected:
        print(f"  3. Correct {target_corrected - current_corrected} more examples")
        print(f"     - Use Edit & Improve for poor outputs")
        print(f"     - Focus on examples with JSON errors")
    
    print(f"\n💡 Tips:")
    print(f"  - Quality over quantity: 500 excellent examples > 5000 mediocre ones")
    print(f"  - Corrected outputs are gold: they teach the model what was wrong")
    print(f"  - Cover all complexity levels: simple, medium, complex")
    print(f"  - Balance task categories: manual (40%), API (20%), automation (20%), etc.")
    
    print("\n" + "=" * 60)


def validate_ready_for_training() -> bool:
    """Check if data is ready for training"""
    stats = get_data_stats()
    
    if not stats:
        print("⚠️  Cannot validate without statistics")
        return False
    
    print("=" * 60)
    print("✅ READINESS CHECK FOR TRAINING")
    print("=" * 60)
    
    checks = {
        "Total Examples >= 500": stats['total'] >= 500,
        "High Quality >= 300": stats['high_quality'] >= 300,
        "Corrected >= 100": stats['corrected'] >= 100,
        "Approved >= 400": stats['approved'] >= 400,
        "Multiple Categories": len(stats['by_category']) >= 4
    }
    
    all_passed = True
    for check, passed in checks.items():
        status = "✅" if passed else "❌"
        print(f"  {status} {check}")
        if not passed:
            all_passed = False
    
    print("\n" + "=" * 60)
    
    if all_passed:
        print("✅ READY FOR TRAINING!")
    else:
        print("❌ NOT READY - Complete missing requirements above")
    
    return all_passed


def main():
    import argparse
    
    parser = argparse.ArgumentParser(description="Senior QA Expert: Data Collection Workflow")
    parser.add_argument("--status", "-s", action="store_true", help="Show current status")
    parser.add_argument("--plan", "-p", action="store_true", help="Generate collection plan")
    parser.add_argument("--validate", "-v", action="store_true", help="Validate readiness for training")
    
    args = parser.parse_args()
    
    if args.status:
        print_data_collection_status()
    elif args.plan:
        generate_data_collection_plan()
    elif args.validate:
        validate_ready_for_training()
    else:
        print("Usage:")
        print("  python scripts/collect_training_data.py --status    # Show current status")
        print("  python scripts/collect_training_data.py --plan     # Generate collection plan")
        print("  python scripts/collect_training_data.py --validate  # Check readiness")
        parser.print_help()


if __name__ == "__main__":
    main()

