#!/usr/bin/env python3
"""
Script to delete all test runs from the database.
Useful for starting fresh with test execution.
"""

import requests
import sys
from typing import List, Dict, Any

# Backend API base URL
BASE_URL = "http://localhost:8001"


def get_all_test_runs() -> List[Dict[str, Any]]:
    """Fetch all test runs from the database"""
    try:
        response = requests.get(f"{BASE_URL}/test-runs")
        if response.ok:
            data = response.json()
            # Handle different response formats
            if isinstance(data, list):
                return data
            elif isinstance(data, dict):
                if "testRuns" in data:
                    return data["testRuns"]
                elif "test_runs" in data:
                    return data["test_runs"]
            return []
        else:
            print(f"Error fetching test runs: {response.status_code}")
            return []
    except Exception as e:
        print(f"Error fetching test runs: {str(e)}")
        return []


def delete_test_run(run_id: str) -> bool:
    """Delete a test run by ID"""
    try:
        response = requests.delete(f"{BASE_URL}/test-runs/{run_id}")
        if response.ok:
            return True
        else:
            # Try to get error details
            try:
                error_data = response.json()
                error_msg = error_data.get("detail", response.text)
                print(f"  Error: {error_msg}")
            except:
                print(f"  Error: {response.status_code} - {response.text[:100]}")
            return False
    except Exception as e:
        print(f"Error deleting test run {run_id}: {str(e)}")
        return False


def main():
    print("=" * 60)
    print("Delete All Test Runs")
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
    
    # Fetch all test runs
    print("\n[1/2] Fetching test runs from database...")
    test_runs = get_all_test_runs()
    
    if not test_runs:
        print("No test runs found in database")
        return
    
    print(f"Found {len(test_runs)} test runs to delete")
    
    # Confirm deletion (skip if --yes flag provided)
    skip_confirmation = "--yes" in sys.argv or "-y" in sys.argv
    
    if not skip_confirmation:
        print(f"\n[WARNING] This will delete {len(test_runs)} test run(s)!")
        try:
            confirmation = input("Are you sure you want to proceed? (yes/no): ")
            if confirmation.lower() != "yes":
                print("Deletion cancelled.")
                return
        except (EOFError, KeyboardInterrupt):
            print("\nDeletion cancelled (no input available).")
            print("Use --yes or -y flag to skip confirmation: python scripts/delete_all_test_runs.py --yes")
            return
    else:
        print(f"\n[INFO] Skipping confirmation (--yes flag provided)")
    
    # Delete each test run
    print("\n[2/2] Deleting test runs...")
    deleted = 0
    failed = 0
    
    for i, run in enumerate(test_runs, 1):
        run_id = run.get("id")
        run_name = run.get("name", "Unknown")
        
        print(f"[{i}/{len(test_runs)}] Deleting: {run_name}")
        
        if delete_test_run(run_id):
            deleted += 1
            print(f"  [OK] Deleted: {run_name}")
        else:
            failed += 1
            print(f"  [FAIL] Failed to delete: {run_name}")
    
    # Summary
    print("\n" + "=" * 60)
    print("Deletion Summary")
    print("=" * 60)
    print(f"Total test runs: {len(test_runs)}")
    print(f"Successfully deleted: {deleted}")
    print(f"Failed: {failed}")
    print("\n[OK] Deletion complete!")
    print("=" * 60)


if __name__ == "__main__":
    main()

