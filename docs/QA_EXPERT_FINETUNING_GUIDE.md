# 🎓 Senior QA Expert: Complete Fine-Tuning Guide
## Master Guide for Data Collection, Training, and Evaluation

**Your AI Assistant:** Acting as Senior QA Expert  
**GPU:** DGX Spark (Local)  
**Goal:** Create world-class QA expert LLM fine-tuned model

---

## 🎯 Role: Senior QA Expert Responsibilities

As your Senior QA Expert, I will help you:

1. **Data Collection Strategy** - Ensure high-quality, diverse training data
2. **Training Orchestration** - Optimize for DGX Spark hardware
3. **Quality Assurance** - Review and validate all outputs
4. **Evaluation & Metrics** - Measure success scientifically
5. **Iteration & Improvement** - Continuous refinement

---

## 📊 PHASE 1: Data Collection (Weeks 1-2)

### DAY 1-2: Strategic Data Collection

#### Step 1: Generate Diverse Test Cases

**As Senior QA, I recommend:**

1. **Cover All Test Types:**
   - Manual test cases (40% of data)
   - API test cases (20% of data)
   - Automation test cases (20% of data)
   - Triage/analysis (10% of data)
   - Performance/Security (10% of data)

2. **Cover Complexity Levels:**
   - Simple: Happy path scenarios
   - Medium: Integration scenarios
   - Complex: Edge cases, error handling

3. **Cover Different Domains:**
   - Authentication/Authorization
   - Data validation
   - UI/UX testing
   - API contract testing
   - Performance testing
   - Security testing

#### Step 2: Use Quality Rating System

**For each generation:**
- ⭐⭐⭐⭐⭐ (5 stars): Perfect, production-ready
- ⭐⭐⭐⭐ (4 stars): Good, minor improvements needed
- ⭐⭐⭐ (3 stars): Acceptable, needs refinement
- ⭐⭐ (2 stars): Poor, significant issues
- ⭐ (1 star): Very poor, major problems

**Auto-approve threshold:** 4+ stars

#### Step 3: Edit & Improve Poor Outputs

**When to use Edit & Improve:**
- Output has JSON parsing errors
- Missing critical test scenarios
- Incorrect test steps
- Poor test data
- Incomplete coverage

**Best Practice:** For 3-star or below, ALWAYS correct rather than just rate low.

---

### DAY 3-4: Data Quality Audit

#### Run Validation Script

```bash
# From project root
python scripts/validate_training_data.py --api
```

**What to Check:**
- ✅ JSON validity rate >= 95%
- ✅ All examples have required fields
- ✅ No empty outputs
- ✅ Duplicate rate < 5%
- ✅ Task category distribution balanced

#### SQL Quality Checks

```sql
-- Check data completeness
SELECT 
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE task_category IS NOT NULL) as has_category,
  COUNT(*) FILTER (WHERE complexity_level IS NOT NULL) as has_complexity,
  COUNT(*) FILTER (WHERE tags IS NOT NULL AND array_length(tags, 1) > 0) as has_tags,
  COUNT(*) FILTER (WHERE quality_score >= 4) as high_quality,
  COUNT(*) FILTER (WHERE corrected_output IS NOT NULL) as corrected
FROM ai_generations;

-- Check distribution by task_category
SELECT 
  task_category,
  COUNT(*) as count,
  AVG(quality_score) as avg_quality,
  COUNT(*) FILTER (WHERE quality_score >= 4) as high_quality_count
FROM ai_generations
WHERE task_category IS NOT NULL
GROUP BY task_category
ORDER BY count DESC;

-- Check distribution by complexity
SELECT 
  complexity_level,
  COUNT(*) as count,
  AVG(quality_score) as avg_quality
FROM ai_generations
WHERE complexity_level IS NOT NULL
GROUP BY complexity_level;
```

---

### DAY 5-7: Bulk Operations

#### Bulk Approval (High-Quality Outputs)

```sql
-- Approve all 4+ star ratings that haven't been corrected
UPDATE ai_generations
SET is_approved = true
WHERE quality_score >= 4
  AND corrected_output IS NULL
  AND is_approved = false;
```

#### Tagging Strategy

**Recommended Tags:**
- Task type: `manual`, `api`, `automation`, `triage`
- Framework: `playwright`, `selenium`, `postman`, `rest`
- Domain: `auth`, `payment`, `dashboard`, `api_contract`
- Complexity: `simple`, `medium`, `complex`
- Quality: `golden`, `approved`, `corrected`

**Tag examples:**
```sql
-- Tag high-quality examples
UPDATE ai_generations
SET tags = ARRAY['golden', 'approved'] || tags
WHERE quality_score = 5 AND is_approved = true;
```

---

## 🚀 PHASE 2: Training Setup (Week 2)

### DAY 8: Data Export & Preparation

#### Export Training Data

```bash
# Export all high-quality examples
curl "http://localhost:8001/ai/training-data/export?min_quality_score=4&format=jsonl&limit=500" -o training_data.jsonl

# Or use script
python scripts/export_finetuning_data.py --output training_data.jsonl
```

#### Train/Validation Split

```bash
python scripts/prepare_train_val_split.py training_data.jsonl --train-ratio 0.8 --balance
```

**Expected Output:**
- `train.jsonl` - ~400 examples (80%)
- `val.jsonl` - ~100 examples (20%)

---

### DAY 9-10: DGX Spark Environment Setup

#### Connect to DGX Spark

**Verify Connection:**
```bash
# Test Ollama connection
curl http://<dgx-ip>:11434/api/tags

# Check GPU
ssh <dgx-user>@<dgx-ip> "nvidia-smi"
```

#### Setup Training Environment on DGX Spark

**On DGX Spark:**

```bash
# Create conda environment
conda create -n qafn python=3.10 -y
conda activate qafn

# Install dependencies
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu121
pip install transformers>=4.40.0
pip install peft>=0.8.0
pip install bitsandbytes>=0.42.0
pip install accelerate>=0.27.0
pip install datasets>=2.16.0
pip install wandb  # Optional for monitoring
pip install scipy  # For LoRA
```

**Verify GPU:**
```bash
python -c "import torch; print(f'CUDA Available: {torch.cuda.is_available()}, GPU: {torch.cuda.get_device_name(0)}')"
```

#### Transfer Training Data

```bash
# From local machine to DGX Spark
scp training_data.jsonl train.jsonl val.jsonl <dgx-user>@<dgx-ip>:~/qa_finetuning/data/
```

---

### DAY 11-12: Fine-Tuning Configuration

#### Create Config File

**Location:** `configs/lora_qwen7b_dgx.yaml`

```yaml
base_model: "Qwen/Qwen2.5-7B-Instruct"
model_name: "qa-expert-7b"

# LoRA Configuration
lora_r: 16
lora_alpha: 16
lora_dropout: 0.05
target_modules:
  - "q_proj"
  - "v_proj"
  - "k_proj"
  - "o_proj"

# Data Paths
train_file: "data/train.jsonl"
val_file: "data/val.jsonl"

# Training Configuration
output_dir: "outputs/qa-expert-7b-v1"
per_device_train_batch_size: 2
gradient_accumulation_steps: 4
learning_rate: 2e-5
num_train_epochs: 3
warmup_steps: 50
logging_steps: 10
save_steps: 100
eval_steps: 100
evaluation_strategy: "steps"

# Optimization
fp16: true
gradient_checkpointing: true
optim: "adamw_torch"
lr_scheduler_type: "cosine"

# DGX Spark Specific
dataloader_num_workers: 4
```

#### Run Training

```bash
# On DGX Spark
cd ~/qa_finetuning
python scripts/train_lora.py --config configs/lora_qwen7b_dgx.yaml
```

**Expected Training Time:** 2-4 hours for 400 examples on DGX Spark

---

## 📈 PHASE 3: Evaluation & Review (Day 13-14)

### DAY 13: Automated Evaluation

#### Run Evaluation Script

```bash
python scripts/evaluate_model.py \
  --model outputs/qa-expert-7b-v1 \
  --val_file data/val.jsonl \
  --baseline "Qwen/Qwen2.5-7B-Instruct"
```

**Metrics to Evaluate:**
1. **JSON Validity Rate** - Target: >= 95%
2. **Approval Rate** - Target: >= 90%
3. **Test Execution Success** - Target: >= 90%
4. **Coverage Completeness** - Target: >= 85%
5. **Latency** - Target: < 5s per generation

---

### DAY 14: Qualitative Review

#### As Senior QA Expert, I'll Review:

1. **Output Quality**
   - Are test cases realistic?
   - Are steps clear and actionable?
   - Is test data appropriate?
   - Are edge cases covered?

2. **Domain Understanding**
   - Does model understand QA context?
   - Are best practices followed?
   - Is terminology correct?

3. **Improvement Areas**
   - What's working well?
   - What needs improvement?
   - What data should we collect more of?

#### Side-by-Side Comparison

**Compare outputs:**
- Base model (Qwen2.5-7B) vs Fine-tuned model
- Same prompt, different models
- Rate each output (1-5 stars)
- Note improvements

---

## 🔄 PHASE 4: Iteration (Ongoing)

### Continuous Improvement Loop

```
Generate → Rate → Review → Collect More Data → Retrain → Evaluate → Repeat
```

### Data Collection Priorities

**After first training:**
1. Collect more examples for weak areas
2. Focus on edge cases
3. Add more complex scenarios
4. Balance task categories

### Model Versioning

**Naming Convention:**
- `qa-expert-7b-v1` - First version
- `qa-expert-7b-v2` - Second iteration
- `qa-expert-7b-v3` - Third iteration

**Track Performance:**
- Keep evaluation results for each version
- Compare improvements
- Document what worked/didn't work

---

## 📋 Quick Reference Commands

### Data Collection
```bash
# Generate test cases (use platform)
# Rate quality (use UI)
# Export data
curl "http://localhost:8001/ai/training-data/export?min_quality_score=4&format=jsonl" -o training_data.jsonl
```

### Validation
```bash
python scripts/validate_training_data.py --file training_data.jsonl
```

### Training
```bash
# On DGX Spark
python scripts/train_lora.py --config configs/lora_qwen7b_dgx.yaml
```

### Evaluation
```bash
python scripts/evaluate_model.py --model outputs/qa-expert-7b-v1 --val_file data/val.jsonl
```

---

## 🎯 Success Criteria

### Data Collection (Week 1)
- ✅ 500+ total examples
- ✅ 300+ high-quality (4+ stars)
- ✅ 100+ corrected examples
- ✅ Balanced task categories
- ✅ All have task_category, complexity_level, tags

### Training (Week 2)
- ✅ Train/validation split (80/20)
- ✅ Training completes successfully
- ✅ Model weights saved
- ✅ Training metrics logged

### Evaluation (Week 2)
- ✅ JSON validity >= 95%
- ✅ Approval rate >= 90%
- ✅ Qualitative improvement vs baseline
- ✅ Ready for deployment

---

## 💡 Senior QA Expert Tips

1. **Quality Over Quantity** - 500 excellent examples > 5000 mediocre ones
2. **Diversity Matters** - Cover all test types and complexity levels
3. **Corrections Are Gold** - Corrected outputs teach the model what was wrong
4. **Iterate Based on Results** - Use evaluation to guide next data collection
5. **Document Everything** - Keep notes on what works/doesn't work

---

**Ready to start?** Let's begin with data collection! 🚀

