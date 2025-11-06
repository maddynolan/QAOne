# 🚀 DGX Spark Training - Quick Start Guide

## ✅ Package Ready!

**Location:** `dgx_training_package/`

**Contents:**
- ✅ Training data (train.jsonl, val.jsonl)
- ✅ Training scripts (train_lora.py, evaluate_model.py)
- ✅ Config file (lora_qwen7b_dgx.yaml)
- ✅ Setup script (setup.sh)
- ✅ README with instructions

---

## 🎯 Quick Start (3 Steps)

### Step 1: Transfer to DGX Spark

```bash
# From your local machine
scp -r dgx_training_package <dgx-user>@<dgx-ip>:~/qa_finetuning/
```

### Step 2: SSH and Setup

```bash
# SSH to DGX Spark
ssh <dgx-user>@<dgx-ip>

# Navigate to package
cd ~/qa_finetuning/dgx_training_package

# Run setup script
bash setup.sh
```

### Step 3: Start Training

```bash
# Activate environment
conda activate qafn

# Start training
python scripts/train_lora.py --config configs/lora_qwen7b_dgx.yaml
```

---

## 📊 What Happens

1. **Setup** (10-15 minutes)
   - Creates conda environment
   - Installs dependencies
   - Verifies GPU access

2. **Training** (2-4 hours)
   - Loads 396 training examples
   - Trains for 3 epochs
   - Validates on 100 examples
   - Saves model to `outputs/qa-expert-7b-v1`

3. **Output**
   - Fine-tuned model weights
   - Training metrics
   - Ready for evaluation

---

## ✅ Expected Results

- **Training Loss:** Should decrease from ~0.5 to ~0.3
- **Validation Loss:** Should track training loss
- **GPU Utilization:** 80-95%
- **Memory Usage:** ~20-30GB VRAM

---

## 📝 Next Steps After Training

1. **Evaluate Model:**
   ```bash
   python scripts/evaluate_model.py --model outputs/qa-expert-7b-v1 --val_file data/val.jsonl
   ```

2. **Convert to Ollama:**
   ```bash
   # Create Modelfile
   ollama create qa-expert:7b -f Modelfile
   ```

3. **Deploy:**
   - Register in Model Registry
   - Update backend to use fine-tuned model
   - A/B test against base model

---

## 🆘 Troubleshooting

**GPU not detected:** Check `nvidia-smi` and CUDA installation

**Out of memory:** Reduce `per_device_train_batch_size` in config

**Training slow:** Check GPU utilization with `nvidia-smi`

**Setup fails:** Check Python/Conda version compatibility

---

**Status:** Package ready! Transfer to DGX Spark and start training! 🎉

