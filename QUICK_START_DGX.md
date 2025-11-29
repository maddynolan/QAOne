# 🚀 Quick Start: DGX Pipeline

## One-Command Setup

### Windows (PowerShell)

```powershell
# 1. Set environment variables
$env:DGX_HOST = "your-dgx-ip"
$env:DGX_USER = "your-username"

# 2. Install dependencies
pip install paramiko tqdm

# 3. Run pipeline
python scripts/dgx_pipeline_complete.py
```

### Linux/Mac

```bash
# 1. Set environment variables
export DGX_HOST="your-dgx-ip"
export DGX_USER="your-username"

# 2. Install dependencies
pip install paramiko tqdm

# 3. Run pipeline
python3 scripts/dgx_pipeline_complete.py
```

---

## What Happens

The pipeline will:

1. ✅ **Generate 1000 test cases + 1000 automation examples** (5-10 min)
2. ✅ **Prepare combined dataset** (1 min)
3. ✅ **Connect to DGX** and setup environment (1 min)
4. ✅ **Transfer data to DGX** (2-5 min)
5. ✅ **Upload training script** (30 sec)
6. ✅ **Start training** on DGX (launches in background)
7. ✅ **Monitor progress** for up to 16 hours

**Total time**: ~10-15 minutes setup, then training runs 8-16 hours

---

## Monitor Progress

### Option 1: Built-in Monitor (Recommended)

In a **separate terminal**:

```bash
python scripts/monitor_dgx_training.py
```

Shows:
- Training status
- GPU utilization
- Checkpoint progress
- Latest logs
- Auto-refreshes every 30 seconds

### Option 2: Manual Check

```bash
# Check logs
ssh $DGX_USER@$DGX_HOST "tail -f ~/qa_finetuning/training.log"

# Check GPU
ssh $DGX_USER@$DGX_HOST "nvidia-smi"

# Check checkpoints
ssh $DGX_USER@$DGX_HOST "ls -lh ~/qa_finetuning/outputs/qa-expert-30b-coder/"
```

---

## Customize

### More Training Data

```bash
python scripts/dgx_pipeline_complete.py \
  --test-cases 2000 \
  --automation 2000
```

### More Epochs

```bash
python scripts/dgx_pipeline_complete.py \
  --num-epochs 5
```

### Skip Steps (if data already exists)

```bash
# Skip data generation
python scripts/dgx_pipeline_complete.py --skip-data-gen

# Skip data transfer (data already on DGX)
python scripts/dgx_pipeline_complete.py --skip-transfer
```

---

## After Training

### Download Model

```bash
scp -r $DGX_USER@$DGX_HOST:~/qa_finetuning/outputs/qa-expert-30b-coder ./models/
```

### Deploy with vLLM

```bash
vllm serve ./models/qa-expert-30b-coder \
  --dtype auto \
  --max-model-len 4096 \
  --gpu-memory-utilization 0.9 \
  --port 8000
```

---

## Troubleshooting

### "Connection refused"

- Check DGX IP and username
- Test SSH: `ssh $DGX_USER@$DGX_HOST "echo test"`
- Check firewall/network

### "Module not found"

```bash
pip install -r requirements_dgx_pipeline.txt
```

### Training fails

Check logs on DGX:
```bash
ssh $DGX_USER@$DGX_HOST "tail -100 ~/qa_finetuning/training.log"
```

---

## Full Documentation

See `DGX_COMPLETE_PIPELINE.md` for complete details.
