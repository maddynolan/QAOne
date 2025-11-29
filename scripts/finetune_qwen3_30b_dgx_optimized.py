#!/usr/bin/env python3
"""
Optimized Finetuning for DGX Spark GB10 - Qwen3 Coder 30B
- Optimized for 128GB GPU
- FP8 quantization support
- Parallel data loading
- Speed optimizations
"""

import json
import os
import sys
import argparse
import torch
from pathlib import Path
from datetime import datetime
from datasets import load_dataset
from transformers import (
    AutoTokenizer,
    AutoModelForCausalLM,
    BitsAndBytesConfig,
    TrainingArguments
)
from peft import LoraConfig, get_peft_model, prepare_model_for_kbit_training
from trl import SFTTrainer, SFTConfig
import logging

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('training.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

def format_example(example):
    """Format example for chat-style training"""
    if "input" in example:
        requirement = example["input"].get("requirement", example["input"].get("requirement_text", ""))
        app_type = example["input"].get("app_type", "")
        domains = ", ".join(example["input"].get("test_domains", []))
        output = example.get("output", {})
    else:
        requirement = example.get("requirement", "")
        app_type = example.get("app_type", "")
        domains = ", ".join(example.get("test_domains", []))
        output = example.get("output", {})

    system = (
        "You are a senior QA automation architect. "
        "You write structured test cases and runnable code for UI, API, performance, accessibility, and security."
    )

    user = f"""Requirement:
{requirement}

App type: {app_type}
Test domains: {domains}

Return STRICT JSON with this schema:
{{
  "test_cases": [...],
  "code": {{
    "ui_playwright_ts": "...",
    "api_pytest": "...",
    "perf_k6": "...",
    "a11y_script": "...",
    "security_zap_config": "..."
  }}
}}"""

    assistant = json.dumps(output, ensure_ascii=False)
    text = (
        f"<|im_start|>system\n{system}<|im_end|>\n"
        f"<|im_start|>user\n{user}<|im_end|>\n"
        f"<|im_start|>assistant\n{assistant}<|im_end|>"
    )
    return {"text": text}


def main():
    parser = argparse.ArgumentParser(description="Optimized Finetuning for DGX")
    parser.add_argument("--dataset", type=str, required=True, help="Training dataset JSONL")
    parser.add_argument("--output-dir", type=str, default="./outputs/qa-expert-30b-coder", help="Output directory")
    parser.add_argument("--model-name", type=str, default="Qwen/Qwen3-Coder-30B-Instruct", help="Base model")
    parser.add_argument("--num-epochs", type=int, default=3, help="Training epochs")
    parser.add_argument("--batch-size", type=int, default=2, help="Per device batch size (optimized for 128GB)")
    parser.add_argument("--gradient-accumulation", type=int, default=32, help="Gradient accumulation")
    parser.add_argument("--learning-rate", type=float, default=5e-6, help="Learning rate")
    parser.add_argument("--max-length", type=int, default=4096, help="Max sequence length")
    parser.add_argument("--use-fp8", action="store_true", help="Use FP8 quantization (faster)")
    parser.add_argument("--use-fp4", action="store_true", help="Use FP4 quantization (fastest)")
    parser.add_argument("--num-workers", type=int, default=8, help="Data loader workers")
    parser.add_argument("--lora-r", type=int, default=32, help="LoRA rank")
    parser.add_argument("--lora-alpha", type=int, default=32, help="LoRA alpha")
    
    args = parser.parse_args()
    
    print("=" * 60)
    print("🚀 Optimized Qwen3 Coder 30B Finetuning")
    print("=" * 60)
    print(f"Model: {args.model_name}")
    print(f"Dataset: {args.dataset}")
    print(f"Output: {args.output_dir}")
    print(f"Batch size: {args.batch_size} (effective: {args.batch_size * args.gradient_accumulation})")
    print(f"Workers: {args.num_workers}")
    print(f"FP8: {args.use_fp8}, FP4: {args.use_fp4}")
    print("=" * 60)
    print()
    
    # Check GPU
    if not torch.cuda.is_available():
        raise RuntimeError("CUDA not available!")
    
    gpu_count = torch.cuda.device_count()
    gpu_name = torch.cuda.get_device_name(0)
    gpu_memory = torch.cuda.get_device_properties(0).total_memory / 1e9
    
    print(f"🖥️  GPU Info:")
    print(f"  Count: {gpu_count}")
    print(f"  Name: {gpu_name}")
    print(f"  Memory: {gpu_memory:.1f} GB")
    print()
    
    # Load dataset with caching
    logger.info("Loading dataset...")
    dataset = load_dataset("json", data_files=args.dataset, cache_dir="./.cache")["train"]
    logger.info(f"  ✓ Loaded {len(dataset)} examples")
    
    # Format dataset (parallel)
    logger.info("Formatting dataset...")
    dataset = dataset.map(format_example, remove_columns=dataset.column_names, num_proc=args.num_workers)
    logger.info("  ✓ Formatted examples")
    
    # Load tokenizer
    logger.info("Loading tokenizer...")
    tokenizer = AutoTokenizer.from_pretrained(args.model_name, use_fast=False, trust_remote_code=True)
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token
    logger.info("  ✓ Tokenizer loaded")
    
    # Load model with quantization
    logger.info("Loading model...")
    quantization_config = None
    
    if args.use_fp4:
        logger.info("  Using FP4 quantization (fastest)")
        quantization_config = BitsAndBytesConfig(
            load_in_4bit=True,
            bnb_4bit_quant_type="fp4",
            bnb_4bit_compute_dtype=torch.bfloat16,
            bnb_4bit_use_double_quant=True,
        )
    elif args.use_fp8:
        logger.info("  Using FP8 quantization (faster)")
        # FP8 via bitsandbytes (if supported) or use 8-bit
        quantization_config = BitsAndBytesConfig(load_in_8bit=True)
    
    model = AutoModelForCausalLM.from_pretrained(
        args.model_name,
        quantization_config=quantization_config,
        device_map="auto",
        trust_remote_code=True,
        torch_dtype=torch.bfloat16 if not quantization_config else None,
        low_cpu_mem_usage=True,  # Speed optimization
    )
    
    if quantization_config:
        model = prepare_model_for_kbit_training(model)
    
    logger.info("  ✓ Model loaded")
    
    # Configure LoRA
    logger.info("Configuring LoRA...")
    lora_config = LoraConfig(
        r=args.lora_r,
        lora_alpha=args.lora_alpha,
        lora_dropout=0.05,
        target_modules=[
            "q_proj", "k_proj", "v_proj", "o_proj",
            "gate_proj", "up_proj", "down_proj"
        ],
        bias="none",
        task_type="CAUSAL_LM"
    )
    
    model = get_peft_model(model, lora_config)
    logger.info("  ✓ LoRA configured")
    
    # Print trainable parameters
    trainable_params = sum(p.numel() for p in model.parameters() if p.requires_grad)
    total_params = sum(p.numel() for p in model.parameters())
    logger.info(f"  Trainable: {trainable_params:,} ({100 * trainable_params / total_params:.2f}%)")
    
    # Optimized training arguments
    training_args = SFTConfig(
        output_dir=args.output_dir,
        num_train_epochs=args.num_epochs,
        per_device_train_batch_size=args.batch_size,
        gradient_accumulation_steps=args.gradient_accumulation,
        learning_rate=args.learning_rate,
        lr_scheduler_type="cosine",
        warmup_ratio=0.03,
        logging_steps=10,
        save_steps=50,
        save_total_limit=3,
        bf16=True,
        fp16=False,
        max_seq_length=args.max_length,
        packing=False,
        remove_unused_columns=False,
        gradient_checkpointing=True,
        dataloader_num_workers=args.num_workers,  # Parallel data loading
        dataloader_pin_memory=True,  # Speed optimization
        report_to="none",
        ddp_find_unused_parameters=False,  # Speed optimization
        optim="adamw_torch_fused",  # Faster optimizer
    )
    
    # Create trainer
    logger.info("Creating trainer...")
    trainer = SFTTrainer(
        model=model,
        tokenizer=tokenizer,
        train_dataset=dataset,
        args=training_args,
        dataset_text_field="text",
    )
    logger.info("  ✓ Trainer created")
    
    # Train
    logger.info("")
    logger.info("=" * 60)
    logger.info("🚀 Starting optimized training...")
    logger.info("=" * 60)
    
    start_time = datetime.now()
    trainer.train()
    end_time = datetime.now()
    
    training_time = (end_time - start_time).total_seconds() / 3600
    
    # Save model
    logger.info("")
    logger.info("Saving model...")
    trainer.save_model()
    tokenizer.save_pretrained(args.output_dir)
    logger.info(f"  ✓ Model saved to {args.output_dir}")
    
    # Save training info
    training_info = {
        "model_name": args.model_name,
        "dataset": args.dataset,
        "dataset_size": len(dataset),
        "num_epochs": args.num_epochs,
        "batch_size": args.batch_size,
        "gradient_accumulation": args.gradient_accumulation,
        "effective_batch_size": args.batch_size * args.gradient_accumulation,
        "learning_rate": args.learning_rate,
        "max_length": args.max_length,
        "training_time_hours": training_time,
        "trainable_parameters": trainable_params,
        "total_parameters": total_params,
        "gpu_name": gpu_name,
        "gpu_memory_gb": gpu_memory,
        "optimizations": {
            "fp8": args.use_fp8,
            "fp4": args.use_fp4,
            "num_workers": args.num_workers,
            "fused_optimizer": True,
        },
        "completed_at": end_time.isoformat()
    }
    
    info_file = Path(args.output_dir) / "training_info.json"
    with open(info_file, 'w') as f:
        json.dump(training_info, f, indent=2)
    
    logger.info("")
    logger.info("=" * 60)
    logger.info("✅ Training complete!")
    logger.info("=" * 60)
    logger.info(f"📁 Model: {args.output_dir}")
    logger.info(f"⏱️  Time: {training_time:.2f} hours")
    logger.info("")
    logger.info("Next: Export weights and setup Docker vLLM")


if __name__ == "__main__":
    main()




