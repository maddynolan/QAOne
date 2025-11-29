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
    DataCollatorForLanguageModeling,
    BitsAndBytesConfig
)
from peft import LoraConfig, get_peft_model, TaskType, prepare_model_for_kbit_training
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
    
    # Use corrected_output if available
    if "corrected_output" in example and example["corrected_output"]:
        output = example["corrected_output"]
    
    # Qwen2.5 format
    prompt = f"""<|im_start|>system
You are a senior QA engineer specializing in comprehensive test case generation. Output valid JSON only.<|im_end|>
<|im_start|>user
{instruction}

{input_text}<|im_end|>
<|im_start|>assistant
{output}<|im_end|>"""
    
    return prompt


def preprocess_dataset(examples: Dict, tokenizer, max_length: int = 2048):
    """Preprocess dataset for training"""
    prompts = [format_prompt(ex) for ex in examples]
    
    # Tokenize (return as lists, not tensors, for dataset.map)
    tokenized = tokenizer(
        prompts,
        truncation=True,
        max_length=max_length,
        padding="max_length",
        return_tensors=None  # Return lists, not tensors - saves memory
    )
    
    # Labels are the same as input_ids (for causal LM)
    tokenized["labels"] = tokenized["input_ids"].copy()
    
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
    
    # CRITICAL: Use 8-bit quantization (QLoRA) for 30B models to prevent OOM
    # This reduces memory from ~60GB to ~15GB for model weights
    use_8bit = config.get("use_8bit_quantization", True)  # Default to True for 30B
    quantization_config = None
    
    if use_8bit:
        print("  Using 8-bit quantization (QLoRA) for memory efficiency...")
        try:
            # Check if bitsandbytes is available
            import bitsandbytes as bnb
            print(f"  bitsandbytes version: {bnb.__version__}")
            
            quantization_config = BitsAndBytesConfig(
                load_in_8bit=True,
                llm_int8_threshold=6.0,
                llm_int8_has_fp16_weight=False,
            )
            print("  ✅ 8-bit quantization enabled")
        except ImportError:
            print("  ❌ ERROR: bitsandbytes not installed!")
            print("  Install with: pip install bitsandbytes")
            print("  Falling back to FP16 (WILL LIKELY CAUSE OOM with 30B model)")
            quantization_config = None
        except Exception as e:
            print(f"  ⚠️  Warning: Could not enable 8-bit quantization: {e}")
            print("  Falling back to FP16 (may cause OOM with 30B model)")
            quantization_config = None
    
    # Use cuda:0 explicitly to avoid meta device offloading issue
    # device_map="auto" can sometimes offload parameters to meta device
    model = AutoModelForCausalLM.from_pretrained(
        base_model,
        quantization_config=quantization_config,
        torch_dtype=torch.float16 if not quantization_config else None,
        device_map="cuda:0",  # Explicit GPU placement - avoids meta device issue
        trust_remote_code=True,
        low_cpu_mem_usage=True  # Memory optimization
    )
    
    # Prepare model for k-bit training if using quantization
    if quantization_config:
        print("  Preparing model for 8-bit training...")
        model = prepare_model_for_kbit_training(model)
        print("  ✅ Model prepared for 8-bit training")
    
    # Apply LoRA
    print(f"\n🔧 Applying LoRA...")
    lora_config = create_lora_config(config)
    model = get_peft_model(model, lora_config)
    model.print_trainable_parameters()
    
    # CRITICAL: Enable gradient checkpointing at model level for 30B models
    # This is essential for memory efficiency
    if config.get("gradient_checkpointing", True):
        if hasattr(model, "gradient_checkpointing_enable"):
            model.gradient_checkpointing_enable()
        if hasattr(model, "base_model") and hasattr(model.base_model, "gradient_checkpointing_enable"):
            model.base_model.gradient_checkpointing_enable()
        print("  ✅ Gradient checkpointing enabled at model level")
    
    # Verify GPU usage
    print(f"\n🔍 Verifying GPU usage...")
    if hasattr(model, 'hf_device_map'):
        print(f"  Model device map: {model.hf_device_map}")
    else:
        # Check which device model parameters are on
        first_param = next(model.parameters())
        device = first_param.device
        print(f"  Model device: {device}")
        if device.type != 'cuda':
            print(f"  ⚠️  WARNING: Model is not on GPU! Current device: {device}")
        else:
            print(f"  ✅ Model is on GPU: {device}")
    
    # Print GPU memory info
    if torch.cuda.is_available():
        for i in range(torch.cuda.device_count()):
            print(f"  GPU {i}: {torch.cuda.get_device_name(i)}")
            print(f"    Memory: {torch.cuda.get_device_properties(i).total_memory / 1e9:.1f} GB")
            if torch.cuda.memory_allocated(i) > 0:
                print(f"    Allocated: {torch.cuda.memory_allocated(i) / 1e9:.2f} GB")
                print(f"    Reserved: {torch.cuda.memory_reserved(i) / 1e9:.2f} GB")
    
    # Load dataset
    print(f"\n📊 Loading dataset...")
    train_dataset = load_dataset("json", data_files=config["train_file"], split="train")
    val_dataset = load_dataset("json", data_files=config["val_file"], split="train")
    
    print(f"  Train examples: {len(train_dataset)}")
    print(f"  Val examples: {len(val_dataset)}")
    
    # Preprocess - use batched=True for memory efficiency
    print(f"\n🔄 Preprocessing dataset...")
    max_length = config.get("max_length", 512)  # Reduced to 512 for 30B model to prevent OOM
    print(f"  Using max_length: {max_length} (aggressively reduced for memory efficiency)")
    
    def preprocess_function(examples):
        """Preprocess function for dataset.map - processes batches"""
        # Format prompts - examples is a dict with lists of values when batched=True
        prompts = []
        for i in range(len(examples.get("instruction", []))):
            example = {
                "instruction": examples["instruction"][i] if "instruction" in examples else "",
                "input": examples["input"][i] if "input" in examples else "",
                "output": examples["output"][i] if "output" in examples else ""
            }
            # Use corrected_output if available
            if "corrected_output" in examples and i < len(examples["corrected_output"]) and examples["corrected_output"][i]:
                example["output"] = examples["corrected_output"][i]
            prompts.append(format_prompt(example))
        
        # Tokenize batch - returns dict with lists, not tensors
        tokenized = tokenizer(
            prompts,
            truncation=True,
            max_length=max_length,
            padding="max_length",
            return_tensors=None  # Return lists, not tensors - saves memory
        )
        
        # Labels are the same as input_ids (for causal LM)
        tokenized["labels"] = tokenized["input_ids"].copy()
        
        return tokenized
    
    train_dataset = train_dataset.map(
        preprocess_function,
        remove_columns=train_dataset.column_names,
        batched=True,  # Process in batches - more memory efficient
        batch_size=100  # Process 100 examples at a time
    )
    val_dataset = val_dataset.map(
        preprocess_function,
        remove_columns=val_dataset.column_names,
        batched=True,  # Process in batches - more memory efficient
        batch_size=100  # Process 100 examples at a time
    )
    
    # Data collator
    data_collator = DataCollatorForLanguageModeling(
        tokenizer=tokenizer,
        mlm=False
    )
    
    # Training arguments - optimized for 30B model memory efficiency
    # CRITICAL: Disable FP16 when using 8-bit quantization (they're incompatible)
    use_fp16 = config.get("fp16", True) and not quantization_config
    
    training_args = TrainingArguments(
        output_dir=output_dir,
        per_device_train_batch_size=config.get("per_device_train_batch_size", 1),  # Must be 1 for 30B
        gradient_accumulation_steps=config.get("gradient_accumulation_steps", 16),
        learning_rate=config.get("learning_rate", 5e-6),
        num_train_epochs=config.get("num_train_epochs", 3),
        warmup_steps=config.get("warmup_steps", 200),
        logging_steps=config.get("logging_steps", 10),
        save_steps=config.get("save_steps", 50),
        evaluation_strategy=config.get("evaluation_strategy", "steps"),
        eval_steps=config.get("eval_steps", 50),
        save_total_limit=3,
        load_best_model_at_end=True,
        fp16=use_fp16,  # Disabled when using 8-bit quantization
        gradient_checkpointing=config.get("gradient_checkpointing", True),  # CRITICAL: Must be True for 30B
        optim=config.get("optim", "adamw_torch"),  # Use 8-bit optimizer if OOM persists
        lr_scheduler_type=config.get("lr_scheduler_type", "cosine"),
        report_to="none",  # Change to "wandb" if using WandB
        dataloader_num_workers=config.get("dataloader_num_workers", 0),  # 0 to save memory
        dataloader_pin_memory=False,  # Disable pin_memory to save memory
        remove_unused_columns=False,
        max_grad_norm=1.0,  # Gradient clipping for stability
        ddp_find_unused_parameters=False  # Speed optimization
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
    steps_per_epoch = len(train_dataset) // (training_args.per_device_train_batch_size * training_args.gradient_accumulation_steps)
    total_steps = steps_per_epoch * training_args.num_train_epochs
    print(f"  Training steps: {total_steps}")
    print(f"  Steps per epoch: {steps_per_epoch}")
    print(f"  Epochs: {training_args.num_train_epochs}")
    print(f"  Effective batch size: {training_args.per_device_train_batch_size * training_args.gradient_accumulation_steps}")
    print(f"  Max length: {max_length} tokens (optimized for memory)")
    print(f"  Gradient checkpointing: {training_args.gradient_checkpointing}")
    print(f"  8-bit quantization: {quantization_config is not None} (reduces memory by ~4x)")
    print(f"  FP16: {use_fp16} (disabled when using 8-bit quantization)")
    
    # Clear cache before training to free up memory
    if torch.cuda.is_available():
        torch.cuda.empty_cache()
        allocated = torch.cuda.memory_allocated(0) / 1e9
        reserved = torch.cuda.memory_reserved(0) / 1e9
        total = torch.cuda.get_device_properties(0).total_memory / 1e9
        print(f"  GPU memory before training:")
        print(f"    Allocated: {allocated:.2f} GB")
        print(f"    Reserved: {reserved:.2f} GB")
        print(f"    Total: {total:.1f} GB")
        print(f"    Available: {total - reserved:.2f} GB")
        
        # Warn if memory usage is already high
        if reserved > total * 0.85:
            print(f"  ⚠️  WARNING: GPU memory usage is already at {reserved/total*100:.1f}%!")
            print(f"     Training may fail with OOM. Consider:")
            print(f"     1. Reducing max_length further (currently {max_length})")
            print(f"     2. Ensuring 8-bit quantization is enabled (currently: {quantization_config is not None})")
            print(f"     3. Reducing gradient_accumulation_steps")
    
    train_result = trainer.train()
    
    # Save model
    print(f"\n💾 Saving model...")
    trainer.save_model()
    tokenizer.save_pretrained(output_dir)
    
    # Save training info
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
    
    print(f"\n✅ Training complete!")
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
        print(f"\n❌ Training failed: {e}")
        import traceback
        traceback.print_exc()
        return 1
    
    return 0


if __name__ == "__main__":
    exit(main())


