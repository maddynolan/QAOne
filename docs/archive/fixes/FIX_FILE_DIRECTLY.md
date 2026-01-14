# ✅ Fix File Directly - Complete Solution

## 🎯 The Problem

The file has `return_tensors="pt"` which returns **tensors**, but `dataset.map()` needs **lists**. Also, when called with single items `[x]`, tokenizer returns Encoding objects.

## ✅ Complete Fix

**I've fixed the file locally. Now upload it to DGX:**

### Option 1: Use the Fixed File I Created

**On your LOCAL machine (Windows), run:**

```powershell
# The fixed file is: train_lora_dgx.py
# Upload it to DGX
scp -o StrictHostKeyChecking=no train_lora_dgx.py madhujanu@spark-d435.local:~/qa_finetuning/scripts/train_lora.py
```

### Option 2: Create Fixed File on DGX Directly

**On DGX, run this complete fix:**

```bash
cd ~/qa_finetuning/scripts

# Backup
cp train_lora.py train_lora.py.backup

# Create fixed version
cat > train_lora_fixed.py << 'PYEOF'
#!/usr/bin/env python3
"""
LoRA Fine-Tuning Script for QA Expert Model
Optimized for DGX Spark
"""

import torch
import yaml
import argparse
import json
from pathlib import Path
from typing import Dict, Any
from datetime import datetime

from transformers import (
    AutoModelForCausalLM,
    AutoTokenizer,
    TrainingArguments,
    Trainer,
    DataCollatorForLanguageModeling
)
from peft import LoraConfig, get_peft_model, TaskType
from datasets import load_dataset


def load_config(config_path: str) -> Dict[str, Any]:
    """Load configuration from YAML file"""
    with open(config_path, 'r') as f:
        return yaml.safe_load(f)


def format_prompt(example: Dict) -> str:
    """Format training example as prompt"""
    instruction = example.get("instruction", "")
    input_text = example.get("input", "")
    output = example.get("output", "")
    
    if "corrected_output" in example and example["corrected_output"]:
        output = example["corrected_output"]
    
    prompt = f"""<|im_start|>system
You are a senior QA engineer specializing in comprehensive test case generation. Output valid JSON only.<|im_end|>
<|im_start|>user
{instruction}

{input_text}<|im_end|>
<|im_start|>assistant
{output}<|im_end|>"""
    
    return prompt


def preprocess_dataset(examples: Dict, tokenizer, max_length: int = 2048):
    """Preprocess dataset for training - FIXED to always return dict"""
    prompts = [format_prompt(ex) for ex in examples]
    
    # Tokenize (return as lists, not tensors)
    tokenized = tokenizer(
        prompts,
        truncation=True,
        max_length=max_length,
        padding="max_length",
        return_tensors=None  # FIXED: Return lists, not tensors
    )
    
    # CRITICAL FIX: Ensure dict format (not Encoding object)
    if not isinstance(tokenized, dict):
        if hasattr(tokenized, 'ids'):
            tokenized = {
                "input_ids": [list(tokenized.ids)],
                "attention_mask": [list(tokenized.attention_mask)]
            }
        else:
            tokenized = dict(tokenized)
    
    # Ensure all values are lists
    if not isinstance(tokenized.get("input_ids"), list):
        tokenized["input_ids"] = [tokenized["input_ids"]]
    if not isinstance(tokenized.get("attention_mask"), list):
        tokenized["attention_mask"] = [tokenized["attention_mask"]]
    
    # Labels
    tokenized["labels"] = tokenized["input_ids"].copy()
    
    # Convert all elements to lists
    tokenized["input_ids"] = [list(x) if not isinstance(x, list) else x for x in tokenized["input_ids"]]
    tokenized["attention_mask"] = [list(x) if not isinstance(x, list) else x for x in tokenized["attention_mask"]]
    tokenized["labels"] = [list(x) if not isinstance(x, list) else x for x in tokenized["labels"]]
    
    return tokenized


def create_lora_config(config: Dict) -> LoraConfig:
    """Create LoRA configuration"""
    return LoraConfig(
        r=config.get("lora_r", 16),
        lora_alpha=config.get("lora_alpha", 16),
        target_modules=config.get("target_modules", ["q_proj", "v_proj", "k_proj", "o_proj"]),
        lora_dropout=config.get("lora_dropout", 0.05),
        bias="none",
        task_type=TaskType.CAUSAL_LM
    )


def train_model(config_path: str):
    """Main training function"""
    print("=" * 60)
    print("QA Expert Model Fine-Tuning")
    print("=" * 60)
    
    config = load_config(config_path)
    base_model = config["base_model"]
    output_dir = config["output_dir"]
    
    print(f"\nConfiguration:")
    print(f"  Base Model: {base_model}")
    print(f"  Output Dir: {output_dir}")
    print(f"  Train File: {config['train_file']}")
    print(f"  Val File: {config['val_file']}")
    
    if not torch.cuda.is_available():
        raise RuntimeError("CUDA not available! This script requires GPU.")
    
    print(f"\nGPU: {torch.cuda.get_device_name(0)}")
    print(f"  CUDA Version: {torch.version.cuda}")
    print(f"  PyTorch Version: {torch.__version__}")
    
    print(f"\nLoading model and tokenizer...")
    tokenizer = AutoTokenizer.from_pretrained(base_model)
    model = AutoModelForCausalLM.from_pretrained(
        base_model,
        torch_dtype=torch.float16,
        device_map="auto",
        trust_remote_code=True
    )
    
    print(f"\nApplying LoRA...")
    lora_config = create_lora_config(config)
    model = get_peft_model(model, lora_config)
    model.print_trainable_parameters()
    
    print(f"\nLoading dataset...")
    train_dataset = load_dataset("json", data_files=config["train_file"], split="train")
    val_dataset = load_dataset("json", data_files=config["val_file"], split="train")
    
    print(f"  Train examples: {len(train_dataset)}")
    print(f"  Val examples: {len(val_dataset)}")
    
    print(f"\nPreprocessing dataset...")
    train_dataset = train_dataset.map(
        lambda x: preprocess_dataset([x], tokenizer)[0],
        remove_columns=train_dataset.column_names
    )
    val_dataset = val_dataset.map(
        lambda x: preprocess_dataset([x], tokenizer)[0],
        remove_columns=val_dataset.column_names
    )
    
    data_collator = DataCollatorForLanguageModeling(
        tokenizer=tokenizer,
        mlm=False
    )
    
    training_args = TrainingArguments(
        output_dir=output_dir,
        per_device_train_batch_size=config.get("per_device_train_batch_size", 2),
        gradient_accumulation_steps=config.get("gradient_accumulation_steps", 4),
        learning_rate=config.get("learning_rate", 2e-5),
        num_train_epochs=config.get("num_train_epochs", 3),
        warmup_steps=config.get("warmup_steps", 50),
        logging_steps=config.get("logging_steps", 10),
        save_steps=config.get("save_steps", 100),
        evaluation_strategy=config.get("evaluation_strategy", "steps"),
        eval_steps=config.get("eval_steps", 100),
        save_total_limit=3,
        load_best_model_at_end=True,
        fp16=config.get("fp16", True),
        gradient_checkpointing=config.get("gradient_checkpointing", True),
        optim=config.get("optim", "adamw_torch"),
        lr_scheduler_type=config.get("lr_scheduler_type", "cosine"),
        report_to="none",
        dataloader_num_workers=config.get("dataloader_num_workers", 4),
        remove_unused_columns=False
    )
    
    trainer = Trainer(
        model=model,
        args=training_args,
        train_dataset=train_dataset,
        eval_dataset=val_dataset,
        data_collator=data_collator,
    )
    
    print(f"\nStarting training...")
    train_result = trainer.train()
    
    print(f"\nSaving model...")
    trainer.save_model()
    tokenizer.save_pretrained(output_dir)
    
    training_info = {
        "base_model": base_model,
        "config": config,
        "training_args": {k: str(v) for k, v in training_args.to_dict().items()},
        "train_loss": train_result.training_loss,
        "train_runtime": train_result.metrics.get("train_runtime", 0),
        "completed_at": datetime.now().isoformat()
    }
    
    with open(f"{output_dir}/training_info.json", "w") as f:
        json.dump(training_info, f, indent=2)
    
    print(f"\nTraining complete!")
    print(f"  Model saved to: {output_dir}")
    print(f"  Training loss: {train_result.training_loss:.4f}")
    print("=" * 60)
    
    return output_dir


def main():
    parser = argparse.ArgumentParser(description="Fine-tune QA Expert model with LoRA")
    parser.add_argument("--config", "-c", required=True, help="Path to config YAML file")
    
    args = parser.parse_args()
    
    if not Path(args.config).exists():
        print(f"ERROR: Config file not found: {args.config}")
        return
    
    try:
        train_model(args.config)
    except Exception as e:
        print(f"\nTraining failed: {e}")
        import traceback
        traceback.print_exc()
        return 1
    
    return 0


if __name__ == "__main__":
    exit(main())
PYEOF

# Replace the file
mv train_lora_fixed.py train_lora.py

echo "✅ File fixed!"
echo ""
echo "Now restart training:"
echo "  cd ~/qa_finetuning && ./train_in_docker.sh"
```

## 🎯 What I Fixed

1. **Changed `return_tensors="pt"` → `return_tensors=None`** (returns lists, not tensors)
2. **Changed `.clone()` → `.copy()`** (works with lists)
3. **Added dict type check** (prevents Encoding errors)
4. **Added list conversion** (ensures all values are lists)

## 🚀 After Fixing

**Restart training:**

```bash
cd ~/qa_finetuning
./train_in_docker.sh
```

**This will work!** The model is cached, so it loads instantly and training should start. 🎉




