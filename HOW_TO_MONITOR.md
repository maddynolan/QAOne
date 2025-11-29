# 📊 How to Monitor Pipeline Progress

## Quick Check (One Time)

```bash
python -c "from scripts.monitor_pipeline_progress import get_progress, print_progress; print_progress(get_progress())"
```

## Continuous Monitoring

```bash
python scripts/monitor_pipeline_progress.py
```

**Updates every 30 seconds automatically**

Press `Ctrl+C` to stop.

---

## What You'll See

### Step 1: Test Cases Generation
- Progress: X/2000 (X%)
- Status: [RUNNING], [OK], or [PENDING]

### Step 2: Automation Examples Generation
- Progress: X/2000 (X%)
- Status: [RUNNING], [OK], or [PENDING]

### Step 3: Dataset Preparation
- Examples: X examples
- Status: [OK] or [PENDING]

### Step 4: DGX Setup
- Venv status
- Data transfer status
- Status: [OK], [RUNNING], [PENDING], or [UNKNOWN]

### Step 5: Training
- Training process status
- GPU utilization
- Status: [RUNNING], [PENDING], or [UNKNOWN]

---

## Status Icons

- **[OK]** = Step completed
- **[RUNNING]** = Step in progress
- **[PENDING]** = Step waiting to start
- **[UNKNOWN]** = Cannot verify (usually DGX connection issue)

---

## Current Progress

**Last Check**: Step 1 at 0.5% (10/2000 test cases)

**Pipeline is working!** ✅

---

**Run the monitor script to see real-time updates!** 📊




