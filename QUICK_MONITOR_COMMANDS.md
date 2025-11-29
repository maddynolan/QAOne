# 🔍 Quick Monitor Commands

## Pipeline is Running! Use These to Monitor:

### 1. Real-Time Monitor
```bash
python scripts/monitor_dgx_training_optimized.py
```

### 2. Check Pipeline Log
```powershell
Get-Content logs/pipeline_output.log -Tail 50 -Wait
```

### 3. Check DGX Training
```bash
ssh madhujanu@spark-d435.local "tail -f ~/qa_finetuning/training.log"
```

### 4. Check GPU
```bash
ssh madhujanu@spark-d435.local "nvidia-smi"
```

### 5. Check Status (One-liner)
```bash
ssh madhujanu@spark-d435.local "echo 'Training:' && (pgrep -f finetune && echo 'RUNNING' || echo 'STOPPED') && echo 'GPU:' && nvidia-smi --query-gpu=utilization.gpu,memory.used --format=csv,noheader"
```

---

**Pipeline started! Use these commands to monitor!** 🚀




