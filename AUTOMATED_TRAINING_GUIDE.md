# 🤖 Fully Automated Training Guide

## ✅ Everything is Ready!

I've created a **fully automated training system** that requires minimal intervention.

---

## 🎯 What's Been Created

### 1. **Automated Setup & Training Script**
   - **File:** `dgx_training_package/auto_setup_and_train.sh`
   - **Does:** Everything automatically (setup → train → evaluate)
   - **Time:** 3-5 hours total

### 2. **One-Command Execution**
   - Just run the script on DGX Spark
   - No manual steps needed
   - Progress shown in real-time

---

## 🚀 How to Run (3 Simple Steps)

### Step 1: Transfer Package to DGX Spark

```bash
# From your local machine
scp -r dgx_training_package <your-dgx-user>@<your-dgx-ip>:~/qa_finetuning/
```

### Step 2: SSH to DGX Spark

```bash
ssh <your-dgx-user>@<your-dgx-ip>
cd ~/qa_finetuning/dgx_training_package
```

### Step 3: Run Automated Script

```bash
bash auto_setup_and_train.sh
```

**That's it!** The script will:
- ✅ Setup environment (10-15 min)
- ✅ Install dependencies (5-10 min)
- ✅ Run training (2-4 hours)
- ✅ Evaluate model (5-10 min)
- ✅ Save results automatically

---

## 📊 What the Script Does

### Automatic Setup:
1. Creates conda environment `qafn`
2. Installs PyTorch with CUDA
3. Installs transformers, peft, accelerate
4. Verifies GPU access
5. Checks all files are present

### Automatic Training:
1. Loads training data (396 examples)
2. Configures LoRA fine-tuning
3. Trains for 3 epochs
4. Saves checkpoints
5. Validates on 100 examples

### Automatic Evaluation:
1. Evaluates fine-tuned model
2. Compares with base model
3. Shows metrics
4. Saves results

---

## 📁 Output

After completion, you'll have:

```
~/qa_finetuning/
├── outputs/
│   └── qa-expert-7b-v1/          # Fine-tuned model
│       ├── adapter_config.json
│       ├── adapter_model.bin
│       └── training_info.json
└── training.log                   # Full training log
```

---

## 📊 Monitor Progress

### During Training:

**View live logs:**
```bash
tail -f ~/qa_finetuning/training.log
```

**Check GPU usage:**
```bash
watch -n 1 nvidia-smi
```

**Check process:**
```bash
ps aux | grep train_lora
```

### After Training:

**Check results:**
```bash
ls -lh ~/qa_finetuning/outputs/qa-expert-7b-v1/
cat ~/qa_finetuning/outputs/qa-expert-7b-v1/training_info.json
```

---

## 🛑 If Something Goes Wrong

### Training Fails:
- Script will show error messages
- Check `training.log` for details
- Fix the issue and rerun the script

### Need to Stop:
- Press `Ctrl+C` (will save checkpoint)
- Or kill process: `pkill -f train_lora`

### Restart Training:
```bash
# Just rerun the script
bash auto_setup_and_train.sh
```

---

## ✅ Expected Results

### Training Metrics:
- **Training Loss:** Should decrease from ~0.5 to ~0.3
- **Validation Loss:** Should track training loss
- **GPU Utilization:** 80-95%
- **Memory Usage:** ~20-30GB VRAM

### Model Quality:
- **JSON Validity:** Maintained at ~95-98%
- **Quality Score:** Improved by 0.2-0.5 points
- **Consistency:** Better (fewer edge cases)

---

## 📝 Files Included

### In Package:
- ✅ `auto_setup_and_train.sh` - **Main automated script**
- ✅ `data/train.jsonl` - 396 training examples
- ✅ `data/val.jsonl` - 100 validation examples
- ✅ `scripts/train_lora.py` - Training script
- ✅ `scripts/evaluate_model.py` - Evaluation script
- ✅ `configs/lora_qwen7b_dgx.yaml` - Training config
- ✅ `README_AUTO.md` - This guide

---

## 🎯 Timeline

- **Setup:** 10-15 minutes (automatic)
- **Training:** 2-4 hours (automatic)
- **Evaluation:** 5-10 minutes (automatic)
- **Total:** ~3-5 hours (mostly waiting)

---

## 💡 Next Steps After Training

1. **Review Results:**
   ```bash
   cat ~/qa_finetuning/outputs/qa-expert-7b-v1/training_info.json
   ```

2. **Convert to Ollama:**
   ```bash
   # Create Modelfile and convert
   ollama create qa-expert:7b -f Modelfile
   ```

3. **Deploy:**
   - Register in Model Registry
   - Update backend configuration
   - A/B test against base model

---

## 🎉 Summary

**Everything is automated!** Just:

1. Transfer package to DGX Spark
2. SSH and run `bash auto_setup_and_train.sh`
3. Wait 3-5 hours
4. Check results!

**No manual intervention needed!** 🚀

---

**Status:** Ready to run! Just transfer and execute! ✅

