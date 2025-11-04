# LLM Training & Fine-tuning Guide for Qwen 2.5 Models

This guide covers how to train and fine-tune your custom Qwen 2.5 models (7B, 14B, 32B) for optimal test generation.

## 1. Data Collection

### Export Fine-tuning Data from Database

```bash
# Export all AI generations to JSONL format for fine-tuning
python scripts/export_finetuning_data.py --output training_data.jsonl
```

The script will export:
- All prompts and responses from `ai_generations` table
- Filtered by model type (7B, 14B, 32B)
- Formatted for Qwen fine-tuning

### Prepare Training Data Format

Qwen 2.5 uses a specific format for fine-tuning:

```json
{
  "messages": [
    {"role": "system", "content": "You are a senior QA engineer..."},
    {"role": "user", "content": "Generate test cases for: [requirement]"},
    {"role": "assistant", "content": "[generated test cases in JSON]"}
  ]
}
```

## 2. Fine-tuning Commands

### Using Ollama (Recommended for Local/DGX)

Ollama supports fine-tuning via Modelfile:

```bash
# Create Modelfile for fine-tuning
cat > Modelfile << EOF
FROM qwen2.5-coder:14b
PARAMETER temperature 0.7
PARAMETER top_p 0.9
PARAMETER num_ctx 4096
SYSTEM "You are a senior QA engineer specializing in comprehensive test case generation."
EOF

# Create fine-tuned model
ollama create qwen2.5-coder:14b-qa-custom -f Modelfile
```

### Using Qwen Training Scripts (Advanced)

For custom fine-tuning with your own data:

```bash
# Install dependencies
pip install transformers datasets accelerate peft bitsandbytes

# Fine-tune 7B model
python scripts/finetune_qwen.py \
  --model qwen2.5:7b-instruct \
  --data training_data.jsonl \
  --output qwen2.5-7b-qa-custom \
  --epochs 3 \
  --batch_size 4 \
  --learning_rate 2e-5

# Fine-tune 14B model
python scripts/finetune_qwen.py \
  --model qwen2.5-coder:14b \
  --data training_data.jsonl \
  --output qwen2.5-14b-qa-custom \
  --epochs 3 \
  --batch_size 2 \
  --learning_rate 2e-5 \
  --use_lora  # Use LoRA for efficiency

# Fine-tune 32B model (requires significant GPU memory)
python scripts/finetune_qwen.py \
  --model qwen2.5-coder:32b \
  --data training_data.jsonl \
  --output qwen2.5-32b-qa-custom \
  --epochs 2 \
  --batch_size 1 \
  --learning_rate 1e-5 \
  --use_lora \
  --use_8bit  # Use 8-bit quantization
```

### Using Hugging Face Transformers

```python
# scripts/finetune_qwen.py example
from transformers import AutoModelForCausalLM, AutoTokenizer, TrainingArguments, Trainer
from datasets import load_dataset
import torch

model_name = "Qwen/Qwen2.5-7B-Instruct"
tokenizer = AutoTokenizer.from_pretrained(model_name)
model = AutoModelForCausalLM.from_pretrained(
    model_name,
    torch_dtype=torch.float16,
    device_map="auto"
)

# Load your training data
dataset = load_dataset("json", data_files="training_data.jsonl")

# Training arguments
training_args = TrainingArguments(
    output_dir="./qwen2.5-7b-qa-custom",
    num_train_epochs=3,
    per_device_train_batch_size=4,
    learning_rate=2e-5,
    logging_steps=10,
    save_steps=500,
    fp16=True,
)

trainer = Trainer(
    model=model,
    args=training_args,
    train_dataset=dataset["train"],
)

trainer.train()
trainer.save_model()
```

## 3. Using LoRA for Efficient Fine-tuning

LoRA (Low-Rank Adaptation) is recommended for 14B and 32B models:

```bash
# Install peft
pip install peft

# Fine-tune with LoRA
python scripts/finetune_qwen_lora.py \
  --model qwen2.5-coder:14b \
  --data training_data.jsonl \
  --output qwen2.5-14b-qa-lora \
  --lora_r 16 \
  --lora_alpha 32 \
  --lora_dropout 0.05
```

## 4. Evaluation After Fine-tuning

After fine-tuning, evaluate your model:

```bash
# Evaluate fine-tuned model
python scripts/evaluate_llm.py manual qwen2.5-7b-qa-custom

# Compare with baseline
python scripts/compare_models.py \
  --baseline qwen2.5:7b-instruct \
  --fine_tuned qwen2.5-7b-qa-custom \
  --golden_set golden.jsonl
```

## 5. Model Deployment

### Deploy to Ollama

```bash
# Copy fine-tuned model to Ollama
cp qwen2.5-7b-qa-custom /path/to/ollama/models/

# Or create from exported model
ollama create qwen2.5-7b-qa-custom -f Modelfile
```

### Update Backend Configuration

Update `backend/app/services/ollama_service.py`:

```python
self.model_map = {
    ModelMode.QUICK: "qwen2.5-7b-qa-custom",  # Your fine-tuned 7B
    ModelMode.UI: "qwen2.5-14b-qa-custom",    # Your fine-tuned 14B
    ModelMode.HEAVY: "qwen2.5-32b-qa-custom"  # Your fine-tuned 32B
}
```

## 6. Continuous Improvement

### Collect More Training Data

1. Run evaluation harness regularly
2. Identify low-scoring generations
3. Manually correct and add to training set
4. Re-fine-tune periodically

### A/B Testing

```bash
# Compare models
python scripts/ab_test_models.py \
  --model_a qwen2.5:7b-instruct \
  --model_b qwen2.5-7b-qa-custom \
  --golden_set golden.jsonl \
  --output ab_results.json
```

## 7. Training Data Quality Tips

1. **Diversity**: Include examples from all test types (manual, API, automation, etc.)
2. **Quality**: Only include high-quality, manually reviewed test cases
3. **Balance**: Ensure positive, negative, and edge case examples
4. **Coverage**: Include requirements from different domains (e-commerce, banking, healthcare, etc.)
5. **Format**: Ensure consistent JSON structure in all examples

## 8. Hardware Requirements

- **7B Model**: ~14GB VRAM (fine-tuning), ~8GB (inference)
- **14B Model**: ~28GB VRAM (fine-tuning), ~16GB (inference)  
- **32B Model**: ~64GB VRAM (fine-tuning), ~32GB (inference)

For 32B, consider:
- Using LoRA to reduce memory requirements
- Using 8-bit or 4-bit quantization
- Using gradient checkpointing

## 9. Monitoring & Iteration

1. Track evaluation metrics over time
2. Monitor production generation quality
3. Collect user feedback on generated tests
4. Continuously improve training dataset
5. Regular re-fine-tuning cycles (monthly/quarterly)

## Next Steps

1. Export your current AI generations: `python scripts/export_finetuning_data.py`
2. Review and clean the training data
3. Start with 7B model fine-tuning (smallest, fastest)
4. Evaluate and compare with baseline
5. Iterate based on results

