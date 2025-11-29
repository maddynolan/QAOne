#!/usr/bin/env python3
"""
Finetune Qwen3 Coder 30B for QA specialization using LoRA/QLoRA
Uses HuggingFace transformers + PEFT + TRL
"""

import json
import os
from datasets import load_dataset
from transformers import (
    AutoTokenizer,
    AutoModelForCausalLM,
    TrainingArguments,
    BitsAndBytesConfig
)
from peft import LoraConfig, get_peft_model, prepare_model_for_kbit_training
from trl import SFTTrainer, SFTConfig
import torch

# Note: Update MODEL_NAME to the correct Qwen3 Coder model name from HuggingFace
# Options: "Qwen/Qwen2.5-Coder-32B-Instruct" or "Qwen/Qwen2.5-Coder-7B-Instruct"
MODEL_NAME = os.getenv("FINETUNE_MODEL_NAME", "Qwen/Qwen2.5-Coder-7B-Instruct")  # Default to 7B for testing
DATASET_PATH = os.getenv("FINETUNE_DATASET_PATH", "data/qa_training_data.jsonl")
OUTPUT_DIR = os.getenv("FINETUNE_OUTPUT_DIR", "./models/qwen3_coder_30b_qa_lora")

def format_example(example):
    """Format example for chat-style training"""
    # Handle both old and new data formats
    if "input" in example:
        requirement = example["input"].get("requirement", example["input"].get("requirement_text", ""))
        app_type = example["input"].get("app_type", "")
        domains = ", ".join(example["input"].get("test_domains", []))
        output = example.get("output", {})
    else:
        # Fallback for old format
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

    # Teaching signal: we give the final JSON as the assistant message
    assistant = json.dumps(output, ensure_ascii=False)

    # Qwen-style chat template
    text = (
        f"<|im_start|>system\n{system}<|im_end|>\n"
        f"<|im_start|>user\n{user}<|im_end|>\n"
        f"<|im_start|>assistant\n{assistant}<|im_end|>"
    )

    return {"text": text}


def main():
    """Main training function"""
    print("=" * 60)
    print("Qwen3 Coder 30B QA Finetuning")
    print("=" * 60)
    print(f"Model: {MODEL_NAME}")
    print(f"Dataset: {DATASET_PATH}")
    print(f"Output: {OUTPUT_DIR}")
    print()
    
    # Load dataset
    print("Loading dataset...")
    if not os.path.exists(DATASET_PATH):
        raise FileNotFoundError(f"Dataset not found: {DATASET_PATH}")
    
    dataset = load_dataset("json", data_files=DATASET_PATH)["train"]
    print(f"  ✓ Loaded {len(dataset)} examples")
    
    # Format dataset
    print("Formatting dataset...")
    dataset = dataset.map(format_example, remove_columns=dataset.column_names)
    print("  ✓ Formatted examples")
    
    # Load tokenizer
    print("Loading tokenizer...")
    tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME, use_fast=False, trust_remote_code=True)
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token
    print("  ✓ Tokenizer loaded")
    
    # Load model with quantization (8-bit for memory efficiency)
    print("Loading model...")
    bnb_config = BitsAndBytesConfig(
        load_in_4bit=True,
        bnb_4bit_quant_type="nf4",
        bnb_4bit_compute_dtype=torch.bfloat16,
        bnb_4bit_use_double_quant=True,
    )
    
    model = AutoModelForCausalLM.from_pretrained(
        MODEL_NAME,
        quantization_config=bnb_config,
        device_map="auto",
        trust_remote_code=True,
        torch_dtype=torch.bfloat16
    )
    
    # Prepare model for k-bit training
    model = prepare_model_for_kbit_training(model)
    print("  ✓ Model loaded")
    
    # Configure LoRA
    print("Configuring LoRA...")
    lora_config = LoraConfig(
        r=16,
        lora_alpha=32,
        lora_dropout=0.05,
        target_modules=[
            "q_proj", "k_proj", "v_proj", "o_proj",
            "gate_proj", "up_proj", "down_proj"
        ],
        bias="none",
        task_type="CAUSAL_LM"
    )
    
    model = get_peft_model(model, lora_config)
    print("  ✓ LoRA configured")
    
    # Training arguments
    training_args = SFTConfig(
        output_dir=OUTPUT_DIR,
        num_train_epochs=2,
        per_device_train_batch_size=1,
        gradient_accumulation_steps=8,
        learning_rate=2e-4,
        lr_scheduler_type="cosine",
        warmup_ratio=0.03,
        logging_steps=50,
        save_steps=500,
        bf16=True,
        max_seq_length=2048,
        packing=False,
        remove_unused_columns=False,
    )
    
    # Create trainer
    print("Creating trainer...")
    trainer = SFTTrainer(
        model=model,
        tokenizer=tokenizer,
        train_dataset=dataset,
        args=training_args,
        dataset_text_field="text",
    )
    print("  ✓ Trainer created")
    
    # Train
    print()
    print("=" * 60)
    print("Starting training...")
    print("=" * 60)
    trainer.train()
    
    # Save model
    print()
    print("Saving model...")
    trainer.save_model()
    tokenizer.save_pretrained(OUTPUT_DIR)
    print(f"  ✓ Model saved to {OUTPUT_DIR}")
    
    print()
    print("=" * 60)
    print("✅ Training complete!")
    print("=" * 60)
    print(f"📁 Model saved to: {OUTPUT_DIR}")
    print()
    print("To use the model:")
    print(f"  vllm serve {OUTPUT_DIR} --dtype auto --max-model-len 2048")


if __name__ == "__main__":
    main()

