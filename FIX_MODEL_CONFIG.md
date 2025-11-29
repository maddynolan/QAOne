# 🔧 Fix: Wrong Model (7B instead of 30B)

## Problem

Training is using **Qwen2.5-7B-Instruct** instead of **Qwen3-Coder-30B-Instruct**!

## Quick Fix

**On DGX, update the config file:**

```bash
cd ~/qa_finetuning

# Option 1: Use the correct config file
cp configs/lora_qwen3_30b_coder.yaml configs/lora_qwen7b_dgx.yaml

# Option 2: Or edit the existing config
nano configs/lora_qwen7b_dgx.yaml
```

**Change line 4 from:**
```yaml
base_model: "Qwen/Qwen2.5-7B-Instruct"
```

**To:**
```yaml
base_model: "Qwen/Qwen3-Coder-30B-Instruct"
```

**Also update:**
- Line 5: `model_name: "qa-expert-30b-coder"`
- Line 22: `output_dir: "outputs/qa-expert-30b-coder-v1"`
- Line 27: `per_device_train_batch_size: 1` (must be 1 for 30B)
- Line 28: `gradient_accumulation_steps: 16` (higher for 30B)
- Line 29: `learning_rate: 5e-6` (lower for larger model)
- Line 46: `max_length: 4096` (longer context for 30B)

## Or Use the Correct Config File

**Update the Docker script to use the 30B config:**

```bash
cd ~/qa_finetuning

# Edit train_in_docker.sh
nano train_in_docker.sh
```

**Find this line:**
```bash
python scripts/train_lora.py --config configs/lora_qwen7b_dgx.yaml
```

**Change to:**
```bash
python scripts/train_lora.py --config configs/lora_qwen3_30b_coder.yaml
```

## Complete Config for 30B

**Full config file should be:**

```yaml
base_model: "Qwen/Qwen3-Coder-30B-Instruct"
model_name: "qa-expert-30b-coder"

# LoRA Configuration
lora_r: 32
lora_alpha: 32
lora_dropout: 0.05
target_modules:
  - "q_proj"
  - "v_proj"
  - "k_proj"
  - "o_proj"
  - "gate_proj"
  - "up_proj"

# Data Paths
train_file: "data/train.jsonl"
val_file: "data/val.jsonl"

# Training Configuration
output_dir: "outputs/qa-expert-30b-coder-v1"
per_device_train_batch_size: 1  # Must be 1 for 30B
gradient_accumulation_steps: 16  # High accumulation
learning_rate: 5e-6  # Lower LR for larger model
num_train_epochs: 3
warmup_steps: 200
logging_steps: 10
save_steps: 50
eval_steps: 50
evaluation_strategy: "steps"

# Optimization
fp16: true
gradient_checkpointing: true
optim: "adamw_torch"
lr_scheduler_type: "cosine"

# DGX Spark Specific
dataloader_num_workers: 2  # Reduced for 30B
max_length: 4096  # Longer context
```

## After Fixing

**Restart training:**

```bash
cd ~/qa_finetuning
./train_in_docker.sh
```

## Important Notes for 30B

- **Memory**: Requires 60-80GB GPU memory
- **Batch size**: Must be 1 (can't use 2)
- **Training time**: 8-16 hours (much longer than 7B)
- **Learning rate**: Lower (5e-6 vs 2e-5)




