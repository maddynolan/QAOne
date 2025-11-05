#!/usr/bin/env python3
"""
Quick runner for automated data collection
Simplified entry point
"""

import sys
import os

# Add scripts directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from automated_data_collection import AutomatedDataCollector, SAMPLE_REQUIREMENTS

if __name__ == "__main__":
    print("🚀 Starting Automated Data Collection...")
    print("   This will generate, analyze, and rate training examples automatically\n")
    
    collector = AutomatedDataCollector()
    
    # Start with 10 examples
    collector.collect_and_rate(SAMPLE_REQUIREMENTS[:10], delay_seconds=2.0)
    
    print("\n✅ Collection complete! Check results above.")

