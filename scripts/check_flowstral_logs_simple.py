#!/usr/bin/env python3
"""
Simple log checker that doesn't hang like PowerShell
Uses Python's file reading instead of PowerShell commands
"""

import os
import sys
from pathlib import Path
from datetime import datetime

def check_logs():
    log_file = Path("backend/logs/app.log")
    
    if not log_file.exists():
        print(f"❌ Log file not found: {log_file}")
        return
    
    print(f"📋 Checking logs: {log_file}")
    print("=" * 80)
    
    # Read last 100 lines
    try:
        with open(log_file, 'r', encoding='utf-8', errors='ignore') as f:
            lines = f.readlines()
            recent_lines = lines[-100:] if len(lines) > 100 else lines
            
        # Filter for Flowstral-related entries
        keywords = [
            'flowstral', 'FLOWSTRAL', 'FORGE', 'SIMPLE-FLUX',
            'capture', 'CAPTURE', 'session', 'SESSION',
            'node', 'NODE', 'selector', 'SELECTOR',
            'Error', 'ERROR', 'Exception', 'Failed', 'failed',
            'WARNING', 'Warning'
        ]
        
        print("\n🔍 Recent Flowstral Activity:\n")
        found_any = False
        
        for line in recent_lines:
            if any(keyword.lower() in line.lower() for keyword in keywords):
                found_any = True
                # Extract timestamp and message
                if ' - ' in line:
                    parts = line.split(' - ', 2)
                    if len(parts) >= 3:
                        timestamp = parts[0]
                        logger = parts[1]
                        message = parts[2].strip()
                        
                        # Highlight important entries
                        if 'ERROR' in line or 'Error' in line or 'Exception' in line:
                            print(f"❌ {timestamp} | {logger}")
                            print(f"   {message[:200]}")
                        elif 'WARNING' in line or 'Warning' in line:
                            print(f"⚠️  {timestamp} | {logger}")
                            print(f"   {message[:200]}")
                        elif '[SELECTOR]' in line or '[FORGE]' in line or '[SIMPLE-FLUX]' in line:
                            print(f"✅ {timestamp} | {logger}")
                            print(f"   {message[:200]}")
                        elif 'Added node' in line or 'session' in line.lower():
                            print(f"📝 {timestamp} | {logger}")
                            print(f"   {message[:200]}")
                        else:
                            print(f"ℹ️  {timestamp} | {logger}")
                            print(f"   {message[:200]}")
                        print()
        
        if not found_any:
            print("   No recent Flowstral activity found in last 100 lines")
        
        # Check for session stop
        print("\n🛑 Session Stop Events:\n")
        for line in recent_lines:
            if 'session stopped' in line.lower() or 'session.*stop' in line.lower():
                print(f"   {line.strip()}")
        
        # Check for errors
        print("\n❌ Recent Errors:\n")
        error_count = 0
        for line in recent_lines:
            if 'ERROR' in line or 'Exception' in line or 'Traceback' in line:
                error_count += 1
                if error_count <= 10:  # Show first 10 errors
                    print(f"   {line.strip()[:200]}")
        
        if error_count == 0:
            print("   No recent errors found")
        elif error_count > 10:
            print(f"   ... and {error_count - 10} more errors")
        
    except Exception as e:
        print(f"❌ Error reading log file: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    check_logs()




