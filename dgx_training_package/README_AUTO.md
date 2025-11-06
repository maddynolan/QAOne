# 🤖 Fully Automated Training

## One-Command Setup and Training

This package includes a **fully automated script** that does everything:

1. ✅ Creates conda environment
2. ✅ Installs all dependencies  
3. ✅ Verifies GPU access
4. ✅ Runs training
5. ✅ Evaluates model

---

## 🚀 Quick Start (Single Command)

### On DGX Spark:

```bash
# Transfer package first (from local machine)
scp -r dgx_training_package user@dgx-spark:~/qa_finetuning/

# SSH to DGX Spark
ssh user@dgx-spark
cd ~/qa_finetuning/dgx_training_package

# Run automated script (does EVERYTHING)
bash auto_setup_and_train.sh
```

**That's it!** The script will:
- Run for 2-4 hours
- Show progress in real-time
- Save model when complete
- Run evaluation automatically

---

## 📊 What Happens

### Phase 1: Setup (10-15 minutes)
- Creates conda environment `qafn`
- Installs PyTorch, transformers, peft, etc.
- Verifies GPU access

### Phase 2: Training (2-4 hours)
- Loads 396 training examples
- Trains for 3 epochs
- Validates on 100 examples
- Saves checkpoints

### Phase 3: Evaluation (5-10 minutes)
- Evaluates model on validation set
- Compares with base model
- Shows metrics

---

## 📁 Output Location

After completion, model will be at:
```
~/qa_finetuning/outputs/qa-expert-7b-v1/
```

---

## 🛑 If Training Fails

The script will:
- Show error messages
- Exit with error code
- Preserve any checkpoints

To restart:
```bash
# Fix the issue, then rerun
bash auto_setup_and_train.sh
```

---

## 📊 Monitor Progress

### During Training:
```bash
# View live logs
tail -f ~/qa_finetuning/training.log

# Check GPU usage
watch -n 1 nvidia-smi

# Check process
ps aux | grep train_lora
```

### After Training:
```bash
# Check model files
ls -lh ~/qa_finetuning/outputs/qa-expert-7b-v1/

# View training logs
cat ~/qa_finetuning/outputs/qa-expert-7b-v1/training_info.json
```

---

## ✅ Requirements

- **DGX Spark** with GPU access
- **Conda** installed
- **Internet** for downloading models/dependencies
- **~50GB disk space** for model and dependencies

---

## 🎯 Expected Timeline

- **Setup:** 10-15 minutes
- **Training:** 2-4 hours  
- **Evaluation:** 5-10 minutes
- **Total:** ~3-5 hours

---

## 📝 Notes

- Script runs everything automatically
- No manual intervention needed
- Progress shown in real-time
- Model saved automatically
- Evaluation runs automatically after training

---

**Just run `bash auto_setup_and_train.sh` and wait! 🚀**

