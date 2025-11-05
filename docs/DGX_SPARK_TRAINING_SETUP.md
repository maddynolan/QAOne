# DGX Spark Training Setup Guide
## Complete Setup for Fine-Tuning on DGX Spark

**GPU:** DGX Spark (Local)  
**Model:** Qwen2.5-7B-Instruct  
**Fine-Tuning:** LoRA

---

## Prerequisites

✅ **DGX Spark Access** - SSH access to DGX Spark  
✅ **Training Data** - 500+ high-quality examples exported  
✅ **Network Access** - Can transfer files to/from DGX Spark

---

## Step 1: Connect to DGX Spark

### 1.1 SSH Connection

```bash
ssh <dgx-user>@<dgx-ip>
```

### 1.2 Verify GPU

```bash
nvidia-smi
```

**Expected Output:**
```
+-----------------------------------------------------------------------------+
| NVIDIA-SMI 535.xx.xx    Driver Version: 535.xx.xx    CUDA Version: 12.x   |
|-------------------------------+----------------------+----------------------+
| GPU  Name        Persistence-M| Bus-Id        Disp.A | Volatile Uncorr. ECC |
| Fan  Temp  Perf  Pwr:Usage/Cap|         Memory-Usage | GPU-Util  Compute M. |
|================================================================================|
|   0  NVIDIA A100 ...      Off | 00000000:00:00.0 Off |                  Off |
| N/A   XX°C    P0    XXW / XXXW |   XXXXXMiB / XXXXXMiB |     XX%      Default |
+-------------------------------+----------------------+----------------------+
```

---

## Step 2: Setup Training Environment

### 2.1 Create Working Directory

```bash
mkdir -p ~/qa_finetuning/{data,configs,outputs,scripts}
cd ~/qa_finetuning
```

### 2.2 Create Conda Environment

```bash
# Create environment
conda create -n qafn python=3.10 -y

# Activate environment
conda activate qafn
```

### 2.3 Install Dependencies

```bash
# PyTorch with CUDA 12.1
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu121

# Transformers and related
pip install transformers>=4.40.0
pip install peft>=0.8.0
pip install bitsandbytes>=0.42.0
pip install accelerate>=0.27.0
pip install datasets>=2.16.0

# Optional: WandB for monitoring
pip install wandb

# Utilities
pip install pyyaml scipy
```

### 2.4 Verify Installation

```bash
python -c "import torch; print(f'CUDA Available: {torch.cuda.is_available()}'); print(f'GPU: {torch.cuda.get_device_name(0)}')"
```

**Expected Output:**
```
CUDA Available: True
GPU: NVIDIA A100-SXM4-40GB
```

---

## Step 3: Transfer Training Data

### 3.1 From Local Machine to DGX Spark

```bash
# On local machine
scp training_data.jsonl train.jsonl val.jsonl <dgx-user>@<dgx-ip>:~/qa_finetuning/data/

# Transfer config file
scp configs/lora_qwen7b_dgx.yaml <dgx-user>@<dgx-ip>:~/qa_finetuning/configs/

# Transfer training script
scp scripts/train_lora.py <dgx-user>@<dgx-ip>:~/qa_finetuning/scripts/
```

### 3.2 Verify Files on DGX Spark

```bash
# On DGX Spark
cd ~/qa_finetuning
ls -lh data/
ls -lh configs/
ls -lh scripts/
```

---

## Step 4: Configure Training

### 4.1 Review Config File

```bash
cat configs/lora_qwen7b_dgx.yaml
```

**Key Settings:**
- `base_model`: "Qwen/Qwen2.5-7B-Instruct"
- `lora_r`: 16 (LoRA rank)
- `per_device_train_batch_size`: 2
- `gradient_accumulation_steps`: 4
- `learning_rate`: 2e-5
- `num_train_epochs`: 3

### 4.2 Adjust if Needed

**For DGX Spark with more/less GPU memory:**
- More memory: Increase `per_device_train_batch_size` to 4
- Less memory: Decrease to 1, increase `gradient_accumulation_steps` to 8

---

## Step 5: Run Training

### 5.1 Start Training

```bash
cd ~/qa_finetuning
conda activate qafn

python scripts/train_lora.py --config configs/lora_qwen7b_dgx.yaml
```

### 5.2 Monitor Training

**Training Output:**
```
============================================================
QA Expert Model Fine-Tuning
============================================================

📋 Configuration:
  Base Model: Qwen/Qwen2.5-7B-Instruct
  Output Dir: outputs/qa-expert-7b-v1
  Train File: data/train.jsonl
  Val File: data/val.jsonl

🖥️  GPU: NVIDIA A100-SXM4-40GB
  CUDA Version: 12.1
  PyTorch Version: 2.1.0

📥 Loading model and tokenizer...
🔧 Applying LoRA...
trainable params: 33,554,432 || all params: 7,066,000,000 || trainable%: 0.47

📊 Loading dataset...
  Train examples: 400
  Val examples: 100

🔄 Preprocessing dataset...
🚀 Starting training...
  Training steps: 150

{'loss': 0.5234, 'learning_rate': 0.00002, 'epoch': 1.0}
{'loss': 0.4123, 'learning_rate': 0.000018, 'epoch': 2.0}
{'loss': 0.3456, 'learning_rate': 0.000015, 'epoch': 3.0}

💾 Saving model...
✅ Training complete!
  Model saved to: outputs/qa-expert-7b-v1
  Training loss: 0.3456
============================================================
```

### 5.3 Expected Training Time

- **400 examples, 3 epochs:** 2-4 hours on DGX Spark A100
- **GPU Utilization:** Should be 80-95%
- **Memory Usage:** ~20-30GB VRAM

---

## Step 6: Transfer Model Back

### 6.1 Compress Model (Optional)

```bash
# On DGX Spark
cd ~/qa_finetuning/outputs
tar -czf qa-expert-7b-v1.tar.gz qa-expert-7b-v1/
```

### 6.2 Transfer to Local Machine

```bash
# On local machine
scp <dgx-user>@<dgx-ip>:~/qa_finetuning/outputs/qa-expert-7b-v1.tar.gz ./

# Or transfer entire directory
scp -r <dgx-user>@<dgx-ip>:~/qa_finetuning/outputs/qa-expert-7b-v1 ./
```

---

## Step 7: Convert to Ollama Format

### 7.1 On DGX Spark (if Ollama is there)

```bash
# Create Modelfile
cat > Modelfile << EOF
FROM ~/qa_finetuning/outputs/qa-expert-7b-v1
TEMPLATE """{{ .System }}

{{ .Prompt }}"""
PARAMETER temperature 0.7
PARAMETER top_p 0.9
PARAMETER num_ctx 4096
SYSTEM "You are a senior QA engineer specializing in comprehensive test case generation."
EOF

# Create Ollama model
ollama create qa-expert:7b -f Modelfile
```

### 7.2 Verify Model

```bash
ollama list
ollama show qa-expert:7b
```

---

## Troubleshooting

### Issue: CUDA Out of Memory

**Solution:**
- Reduce `per_device_train_batch_size` to 1
- Increase `gradient_accumulation_steps` to 8
- Enable `gradient_checkpointing: true`

### Issue: Training Too Slow

**Solution:**
- Increase `per_device_train_batch_size` if memory allows
- Increase `dataloader_num_workers` to 8
- Use `fp16: true` (already enabled)

### Issue: Loss Not Decreasing

**Solution:**
- Check learning rate (try 1e-5 or 3e-5)
- Increase warmup steps
- Check data quality (run validation script)

### Issue: Model Not Loading

**Solution:**
- Verify model files are complete
- Check CUDA version compatibility
- Ensure model path is correct

---

## Quick Reference

### Files Needed on DGX Spark
```
~/qa_finetuning/
├── data/
│   ├── train.jsonl
│   └── val.jsonl
├── configs/
│   └── lora_qwen7b_dgx.yaml
├── scripts/
│   └── train_lora.py
└── outputs/
    └── qa-expert-7b-v1/
```

### Commands
```bash
# Setup
conda create -n qafn python=3.10 -y
conda activate qafn
pip install torch transformers peft accelerate datasets

# Train
python scripts/train_lora.py --config configs/lora_qwen7b_dgx.yaml

# Check training
tail -f outputs/qa-expert-7b-v1/training_info.json
```

---

**Ready to train?** Start with Step 1! 🚀

