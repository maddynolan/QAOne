#!/usr/bin/env python3
"""
Monitor data collection progress
"""

import time
import requests
import sys

BASE_URL = "http://localhost:8001"

def get_status():
    """Get current collection status"""
    try:
        response = requests.get(f"{BASE_URL}/ai/training-data/export?min_quality_score=4&format=json&limit=1000", timeout=10)
        if response.ok:
            result = response.json()
            data = result.get("data", [])
            return len(data)
        return 0
    except:
        return -1

def monitor(target=500, interval=30):
    """Monitor collection progress"""
    print(f"📊 Monitoring collection progress (target: {target})")
    print("=" * 60)
    
    while True:
        count = get_status()
        if count < 0:
            print(f"⚠️  Cannot reach backend - {time.strftime('%H:%M:%S')}")
        else:
            progress = (count / target) * 100 if target > 0 else 0
            print(f"[{time.strftime('%H:%M:%S')}] Current: {count}/{target} ({progress:.1f}%)")
            
            if count >= target:
                print(f"\n✅ TARGET REACHED! {count} examples collected!")
                break
        
        time.sleep(interval)

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--target", type=int, default=500)
    parser.add_argument("--interval", type=int, default=30)
    args = parser.parse_args()
    
    monitor(target=args.target, interval=args.interval)

