# 🔧 Simple Fix: Update Config to 30B Model

## Quick Fix - Run This on DGX

**Copy and paste this entire block:**

```bash
cd ~/qa_finetuning/configs

# Create 30B config file
cat > lora_qwen3_30b_coder.yaml << 'YAML_EOF'
base_model: "Qwen/Qwen3-Coder-30B-Instruct"
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

echo "✅ Config file created!"
```

## Then Update Docker Script

**Or just edit the Docker script to use the new config:**

```bash
cd ~/qa_finetuning

# Edit train_in_docker.sh
sed -i 's/configs\/lora_qwen7b_dgx.yaml/configs\/lora_qwen3_30b_coder.yaml/g' train_in_docker.sh

echo "✅ Docker script updated!"
```

## Or Use Python to Update Config

**Run this Python one-liner:**

```bash
cd ~/qa_finetuning/configs

python3 << 'PYEOF'
import yaml

# Read existing config
with open('lora_qwen7b_dgx.yaml', 'r') as f:
    config = yaml.safe_load(f)

# Update to 30B
config['base_model'] = 'Qwen/Qwen3-Coder-30B-Instruct'
config['model_name'] = 'qa-expert-30b-coder'
config['output_dir'] = 'outputs/qa-expert-30b-coder-v1'
config['per_device_train_batch_size'] = 1
config['gradient_accumulation_steps'] = 16
config['learning_rate'] = 5e-6
config['max_length'] = 4096
config['lora_r'] = 32
config['lora_alpha'] = 32
if 'target_modules' in config:
    if isinstance(config['target_modules'], list):
        config['target_modules'].extend(['gate_proj', 'up_proj'])

# Save
with open('lora_qwen3_30b_coder.yaml', 'w') as f:
    yaml.dump(config, f, default_flow_style=False, sort_keys=False)

print('✅ Config updated to 30B!')
PYEOF
```

## Simplest: Just Change Model Name

**If you just want to change the model name in existing config:**

```bash
cd ~/qa_finetuning/configs

# Simple sed replacement
sed -i 's/Qwen\/Qwen2\.5-7B-Instruct/Qwen\/Qwen3-Coder-30B-Instruct/g' lora_qwen7b_dgx.yaml
sed -i 's/qa-expert-7b/qa-expert-30b-coder/g' lora_qwen7b_dgx.yaml
sed -i 's/per_device_train_batch_size: 2/per_device_train_batch_size: 1/g' lora_qwen7b_dgx.yaml
sed -i 's/gradient_accumulation_steps: 4/gradient_accumulation_steps: 16/g' lora_qwen7b_dgx.yaml
sed -i 's/learning_rate: 2e-5/learning_rate: 5e-6/g' lora_qwen7b_dgx.yaml
sed -i 's/max_length: 2048/max_length: 4096/g' lora_qwen7b_dgx.yaml

echo "✅ Config updated!"
```

## After Fixing

**Restart training:**

```bash
cd ~/qa_finetuning
./train_in_docker.sh
```

**Or run directly:**

```bash
cd ~/qa_finetuning
docker run --rm --gpus all --shm-size=8g \
  -v ~/qa_finetuning:/workspace/qa_finetuning \
  -w /workspace/qa_finetuning \
  nvcr.io/nvidia/pytorch:24.06-py3 \
  bash -c "
    pip install transformers>=4.40.0 peft>=0.8.0 accelerate>=0.27.0 --quiet
    pip install datasets>=2.16.0 bitsandbytes>=0.42.0 scipy pyyaml trl>=0.7.0 --quiet
    python scripts/train_lora.py --config configs/lora_qwen3_30b_coder.yaml
  "
```




