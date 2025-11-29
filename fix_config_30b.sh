#!/bin/bash
# Fix config to use 30B model instead of 7B

cd ~/qa_finetuning/configs

# Backup
cp lora_qwen7b_dgx.yaml lora_qwen7b_dgx.yaml.backup

# Create new 30B config
cat > lora_qwen3_30b_coder.yaml << 'EOF'
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
per_device_train_batch_size: 1
gradient_accumulation_steps: 16
learning_rate: 5e-6
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

# Memory Optimization
dataloader_num_workers: 2
max_length: 4096
EOF

echo "✅ Created lora_qwen3_30b_coder.yaml with 30B model"
echo ""
echo "Now update train_in_docker.sh to use this config, or run:"
echo "  python scripts/train_lora.py --config configs/lora_qwen3_30b_coder.yaml"




