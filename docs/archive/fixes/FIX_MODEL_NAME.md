# 🔧 Fix: Wrong Model Name - Qwen3-Coder-30B

## Problem

The model name `Qwen/Qwen3-Coder-30B-Instruct` doesn't exist on HuggingFace!

**Error:**
```
OSError: Qwen/Qwen3-Coder-30B-Instruct is not a local folder and is not a valid model identifier
```

## Solution: Use Correct Model Name

The correct model name is: **`Qwen/Qwen3-Coder-30B-A3B-Instruct`**

The "A3B" means "3.3 Billion activated parameters" (Mixture of Experts architecture).

## Quick Fix

**On DGX, run:**

```bash
cd ~/qa_finetuning/configs

# Update config file
sed -i 's/Qwen\/Qwen3-Coder-30B-Instruct/Qwen\/Qwen3-Coder-30B-A3B-Instruct/g' lora_qwen3_30b_coder.yaml

echo "✅ Model name fixed!"
```

## Or Create New Config

```bash
cd ~/qa_finetuning/configs

cat > lora_qwen3_30b_coder.yaml << 'YAML_EOF'
base_model: "Qwen/Qwen3-Coder-30B-A3B-Instruct"
model_name: "qa-expert-30b-coder"
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
train_file: "data/train.jsonl"
val_file: "data/val.jsonl"
output_dir: "outputs/qa-expert-30b-coder-v1"
per_device_train_batch_size: 1
gradient_accumulation_steps: 16
learning_rate: 5e-6
num_train_epochs: 3
warmup_steps: 200
logging_steps: 10
save_steps: 50
eval_steps: 50
evaluation_strategy: "steps"
fp16: true
gradient_checkpointing: true
optim: "adamw_torch"
lr_scheduler_type: "cosine"
dataloader_num_workers: 2
max_length: 4096
YAML_EOF

echo "✅ Config created with correct model name!"
```

## Alternative: Use Qwen2.5-Coder Models

If the Qwen3 model still doesn't work, you can use Qwen2.5 Coder models which are available:

- `Qwen/Qwen2.5-Coder-32B-Instruct` (32B model)
- `Qwen/Qwen2.5-Coder-7B-Instruct` (7B model)

## After Fixing

**Restart training:**

```bash
cd ~/qa_finetuning
./train_in_docker.sh
```

## Model Details

**Qwen3-Coder-30B-A3B-Instruct:**
- 30.5 billion parameters total
- 3.3 billion activated (MoE architecture)
- 48 layers
- 262,144 token context length
- Specialized for coding tasks




