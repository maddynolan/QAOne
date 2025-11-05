#!/usr/bin/env python3
"""
Continuous Data Collection System
Runs back-to-back batches until reaching 500 examples
Includes best practices for test case writing
"""

import json
import os
import sys
import time
import requests
from typing import List, Dict, Any
from datetime import datetime
from automated_data_collection import AutomatedDataCollector, QUALITY_CRITERIA

# Enhanced requirements with diverse scenarios
ENHANCED_REQUIREMENTS = [
    # Manual Tests
    {"title": "User Login", "description": "User should log in with email and password", "test_type": "manual"},
    {"title": "Password Reset", "description": "User can reset password via email", "test_type": "manual"},
    {"title": "User Registration", "description": "New user can register with email", "test_type": "manual"},
    {"title": "Profile Update", "description": "User can update profile information", "test_type": "manual"},
    {"title": "Search Functionality", "description": "Users can search for products", "test_type": "manual"},
    {"title": "Shopping Cart", "description": "User can add items to cart", "test_type": "manual"},
    {"title": "Checkout Process", "description": "User can complete purchase", "test_type": "manual"},
    {"title": "Order History", "description": "User can view past orders", "test_type": "manual"},
    {"title": "Form Validation", "description": "Forms validate required fields", "test_type": "manual"},
    {"title": "Data Export", "description": "Users can export their data", "test_type": "manual"},
    
    # API Tests
    {"title": "API Authentication", "description": "API requires valid authentication token", "test_type": "api"},
    {"title": "API Rate Limiting", "description": "API enforces rate limits per user", "test_type": "api"},
    {"title": "API Error Handling", "description": "API returns proper error codes", "test_type": "api"},
    {"title": "API Pagination", "description": "API supports paginated responses", "test_type": "api"},
    {"title": "API Versioning", "description": "API supports multiple versions", "test_type": "api"},
    {"title": "API Data Validation", "description": "API validates request payloads", "test_type": "api"},
    {"title": "API CORS", "description": "API handles CORS properly", "test_type": "api"},
    {"title": "API Security Headers", "description": "API includes security headers", "test_type": "api"},
    
    # Automation Tests
    {"title": "E2E User Flow", "description": "Complete user journey from login to checkout", "test_type": "automation"},
    {"title": "Form Submission", "description": "Automated form filling and submission", "test_type": "automation"},
    {"title": "Dynamic Content", "description": "Test dynamic content loading", "test_type": "automation"},
    {"title": "Multi-tab Navigation", "description": "Test navigation across browser tabs", "test_type": "automation"},
    
    # Performance Tests
    {"title": "API Load Test", "description": "Test API under load", "test_type": "performance"},
    {"title": "Page Load Performance", "description": "Test page load times", "test_type": "performance"},
    {"title": "Database Query Performance", "description": "Test database query speed", "test_type": "performance"},
    
    # Security Tests
    {"title": "SQL Injection", "description": "Test SQL injection protection", "test_type": "security"},
    {"title": "XSS Protection", "description": "Test XSS attack prevention", "test_type": "security"},
    {"title": "Authentication Bypass", "description": "Test authentication security", "test_type": "security"},
]


def run_continuous_collection(target_count: int = 500, batch_size: int = 10):
    """Run continuous collection until target is reached"""
    collector = AutomatedDataCollector()
    total_collected = 0
    batch_number = 1
    
    print("=" * 70)
    print("🚀 CONTINUOUS DATA COLLECTION")
    print("=" * 70)
    print(f"Target: {target_count} examples")
    print(f"Batch size: {batch_size}")
    print(f"Starting collection...\n")
    
    # Cycle through requirements
    requirements_pool = ENHANCED_REQUIREMENTS.copy()
    
    while total_collected < target_count:
        # Get batch of requirements
        batch_requirements = []
        for i in range(batch_size):
            req = requirements_pool[i % len(requirements_pool)]
            batch_requirements.append(req)
        
        print(f"\n{'='*70}")
        print(f"BATCH {batch_number} - Collecting {len(batch_requirements)} examples")
        print(f"Progress: {total_collected}/{target_count} ({total_collected*100//target_count}%)")
        print(f"{'='*70}\n")
        
        # Run collection
        collector.collect_and_rate(batch_requirements, delay_seconds=2.5)
        
        # Update stats
        batch_successful = collector.stats["successful"]
        total_collected += batch_successful
        
        batch_number += 1
        
        # Check status
        if total_collected >= target_count:
            print(f"\n✅ TARGET REACHED! Collected {total_collected} examples")
            break
        
        # Short break between batches
        print(f"\n⏸️  Pausing 5 seconds before next batch...\n")
        time.sleep(5)
    
    # Final summary
    print("\n" + "=" * 70)
    print("📊 FINAL COLLECTION SUMMARY")
    print("=" * 70)
    print(f"Total collected: {total_collected}")
    print(f"High quality: {collector.stats['high_quality']}")
    print(f"Medium quality: {collector.stats['medium_quality']}")
    print(f"Low quality: {collector.stats['low_quality']}")
    print("\n✅ Collection complete!")
    print("=" * 70)


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Continuous data collection")
    parser.add_argument("--target", type=int, default=500, help="Target number of examples")
    parser.add_argument("--batch-size", type=int, default=10, help="Examples per batch")
    
    args = parser.parse_args()
    run_continuous_collection(target_count=args.target, batch_size=args.batch_size)

