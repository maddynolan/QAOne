#!/usr/bin/env python3
"""
LoRA Fine-Tuning Script for QA Expert Model
FIXED VERSION - Proper tokenization that works
"""

import torch
from transformers import (
    AutoModelForCausalLM,
    AutoTokenizer,
    TrainingArguments,
    Trainer,
    DataCollatorForLanguageModeling
)
from peft import LoraConfig, get_peft_model, TaskType
from datasets import load_dataset
import yaml
import json
from typing import Dict, List
from pathlib import Path

def load_config(config_path: str) -> Dict:
    """Load configuration from YAML file"""
    with open(config_path, 'r') as f:
        return yaml.safe_load(f)

def format_prompt(example: Dict) -> str:
    """Format example as chat prompt"""
    instruction = example.get("instruction", "")
    input_text = example.get("input", "")
    output = example.get("output", "")
    
    prompt = f"""<|im_start|>system
You are a QA expert. Generate comprehensive test cases.{'<|im_end|>' if instruction or input_text else ''}
<|im_start|>user
{instruction}
{input_text}<|im_end|>
<|im_start|>assistant
{output}<|im_end|>"""
    
    return prompt

def train_model(config_path: str):
    """Main training function"""
    print("=" * 60)
    print("QA Expert Model Fine-Tuning")
    print("=" * 60)
    
    # Load config
    config = load_config(config_path)
    base_model = config["base_model"]
    output_dir = config["output_dir"]
    
    print(f"\n📋 Configuration:")
    print(f"  Base Model: {base_model}")
    print(f"  Output Dir: {output_dir}")
    print(f"  Train File: {config['train_file']}")
    print(f"  Val File: {config['val_file']}")
    
    # Check GPU
    if not torch.cuda.is_available():
        raise RuntimeError("CUDA not available! This script requires GPU.")
    
    print(f"\n🖥️  GPU: {torch.cuda.get_device_name(0)}")
    print(f"  CUDA Version: {torch.version.cuda}")
    print(f"  PyTorch Version: {torch.__version__}")
    
    # Load tokenizer and model
    print(f"\n📥 Loading model and tokenizer...")
    tokenizer = AutoTokenizer.from_pretrained(base_model)
    
    # Set pad token if not exists
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token
    
    model = AutoModelForCausalLM.from_pretrained(
        base_model,
        dtype=torch.float16,  # Fixed: use dtype instead of torch_dtype
        device_map="auto",
        trust_remote_code=True
    )
    
    # Apply LoRA - ensure numeric types are correct
    print(f"\n🔧 Applying LoRA...")
    lora_config = LoraConfig(
        r=int(config.get("lora_r", 16)),
        lora_alpha=int(config.get("lora_alpha", 16)),
        target_modules=config.get("target_modules", ["q_proj", "v_proj", "k_proj", "o_proj"]),
        lora_dropout=float(config.get("lora_dropout", 0.05)),
        bias="none",
        task_type=TaskType.CAUSAL_LM
    )
    model = get_peft_model(model, lora_config)
    model.print_trainable_parameters()
    
    # Load dataset
    print(f"\n📊 Loading dataset...")
    train_dataset = load_dataset("json", data_files=config["train_file"], split="train")
    val_dataset = load_dataset("json", data_files=config["val_file"], split="train")
    
    print(f"  Train examples: {len(train_dataset)}")
    print(f"  Val examples: {len(val_dataset)}")
    
    # Preprocess - PROVEN WORKING PATTERN
    print(f"\n🔄 Preprocessing dataset...")
    def preprocess_function(examples):
        """Preprocess function - PROPER HuggingFace pattern"""
        # Format prompts - examples is dict with lists when batched=True
        prompts = []
        for i in range(len(examples.get("instruction", []))):
            example = {
                "instruction": examples["instruction"][i] if "instruction" in examples else "",
                "input": examples["input"][i] if "input" in examples else "",
                "output": examples["output"][i] if "output" in examples else ""
            }
            prompts.append(format_prompt(example))
        
        # Tokenize - ALWAYS pass list, ALWAYS get dict back
        tokenized = tokenizer(
            prompts,  # List of strings
            truncation=True,
            max_length=2048,
            padding="max_length",
            return_tensors=None  # Returns dict with lists
        )
        
        # Convert any Encoding objects to dict (safety check)
        if hasattr(tokenized, 'ids'):  # It's an Encoding object (shouldn't happen with list input)
            # Convert to dict
            result = {
                "input_ids": [list(tokenized.ids)],
                "attention_mask": [list(tokenized.attention_mask)]
            }
        else:
            # Already a dict - ensure all values are lists
            result = {
                "input_ids": tokenized["input_ids"],
                "attention_mask": tokenized["attention_mask"]
            }
        
        # Labels are same as input_ids (for causal LM)
        result["labels"] = result["input_ids"].copy()
        
        # Final validation - ensure everything is lists
        assert isinstance(result["input_ids"], list), "input_ids must be list"
        assert isinstance(result["attention_mask"], list), "attention_mask must be list"
        assert isinstance(result["labels"], list), "labels must be list"
        assert isinstance(result["input_ids"][0], list), "input_ids[0] must be list"
        
        return result
    
    train_dataset = train_dataset.map(
        preprocess_function,
        batched=True,
        remove_columns=train_dataset.column_names,
        desc="Tokenizing train dataset"
    )
    val_dataset = val_dataset.map(
        preprocess_function,
        batched=True,
        remove_columns=val_dataset.column_names,
        desc="Tokenizing val dataset"
    )
    
    # Data collator
    data_collator = DataCollatorForLanguageModeling(
        tokenizer=tokenizer,
        mlm=False
    )
    
    # Training arguments - ensure all numeric types are correct
    # Handle learning_rate - YAML might parse scientific notation as string
    lr = config.get("learning_rate", 2e-5)
    if isinstance(lr, str):
        lr = float(lr)
    else:
        lr = float(lr)
    
    training_args = TrainingArguments(
        output_dir=output_dir,
        per_device_train_batch_size=int(config.get("per_device_train_batch_size", 2)),
        gradient_accumulation_steps=int(config.get("gradient_accumulation_steps", 4)),
        learning_rate=lr,  # Fixed: ensure float, handle string conversion
        num_train_epochs=float(config.get("num_train_epochs", 3)),
        warmup_steps=int(config.get("warmup_steps", 50)),
        logging_steps=10,
        save_steps=100,
        eval_strategy="epoch",  # Fixed: use eval_strategy not evaluation_strategy
        save_strategy="epoch",
        load_best_model_at_end=True,
        fp16=True,
        remove_unused_columns=False,
        report_to=None
    )
    
    # Trainer
    trainer = Trainer(
        model=model,
        args=training_args,
        train_dataset=train_dataset,
        eval_dataset=val_dataset,
        data_collator=data_collator,
    )
    
    # Train
    print(f"\n🚀 Starting training...")
    trainer.train()
    
    # Save
    print(f"\n💾 Saving model...")
    model.save_pretrained(output_dir)
    tokenizer.save_pretrained(output_dir)
    
    print(f"\n✅ Training complete!")
    print(f"Model saved to: {output_dir}")

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--config", required=True, help="Path to config YAML file")
    args = parser.parse_args()
    
    try:
        train_model(args.config)
    except Exception as e:
        print(f"\n❌ Training failed: {e}")
        import traceback
        traceback.print_exc()
        exit(1)

