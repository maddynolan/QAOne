#!/usr/bin/env python3
"""
Start Complete Pipeline with Automatic Monitoring
Runs pipeline and monitors progress automatically
"""

import subprocess
import sys
import time
from pathlib import Path
from datetime import datetime

def main():
    print("=" * 70)
    print("🚀 Starting Complete DGX Pipeline with Monitoring")
    print("=" * 70)
    print()
    print("This will:")
    print("  1. Generate 2000 test cases + 2000 automation examples")
    print("  2. Prepare dataset (includes ALL test types)")
    print("  3. Transfer to DGX (spark-d435.local)")
    print("  4. Start optimized training")
    print("  5. Monitor progress automatically")
    print()
    print("Test types included:")
    print("  ✅ Functional, Negative, Boundary")
    print("  ✅ Security, Performance, Accessibility")
    print("  ✅ API, UI automation")
    print()
    print("=" * 70)
    print()
    
    # Start pipeline in background
    print("📦 Step 1: Starting data generation and pipeline...")
    pipeline_process = subprocess.Popen(
        [sys.executable, "scripts/dgx_pipeline_optimized.py", 
         "--test-cases", "2000", 
         "--automation", "2000"],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True
    )
    
    print("  ✅ Pipeline started (PID: {})".format(pipeline_process.pid))
    print()
    print("📊 Step 2: Starting monitoring...")
    print()
    
    # Wait a bit for pipeline to start
    time.sleep(10)
    
    # Start monitor
    try:
        monitor_process = subprocess.Popen(
            [sys.executable, "scripts/monitor_dgx_training_optimized.py"],
            stdout=sys.stdout,
            stderr=sys.stderr
        )
        
        print("  ✅ Monitor started (PID: {})".format(monitor_process.pid))
        print()
        print("=" * 70)
        print("✅ Everything Started!")
        print("=" * 70)
        print()
        print("Pipeline is running in the background.")
        print("Monitor is showing real-time progress.")
        print()
        print("To check pipeline logs:")
        print("  tail -f logs/pipeline_optimized_*.log")
        print()
        print("To stop monitoring (Ctrl+C), pipeline will continue.")
        print("=" * 70)
        print()
        
        # Wait for monitor (user can Ctrl+C to stop monitoring)
        monitor_process.wait()
        
    except KeyboardInterrupt:
        print("\n\n👋 Monitoring stopped. Pipeline continues in background.")
        print("Check logs: tail -f logs/pipeline_optimized_*.log")
        monitor_process.terminate()
    
    # Check pipeline status
    if pipeline_process.poll() is None:
        print("\n✅ Pipeline still running in background")
    else:
        print("\n⚠️  Pipeline process ended. Check logs for details.")

if __name__ == "__main__":
    main()




