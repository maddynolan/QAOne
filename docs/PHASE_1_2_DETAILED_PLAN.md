# Phase 1.2: Detailed Implementation Plan
## Weeks 1-2: Data Collection + Training Prep

**Status:** ✅ Plan approved - Ready to execute  
**Start Date:** TBD  
**Target Completion:** 14 days from start

---

## WEEK 1 - DATA COLLECTION + VALIDATION

### DAY 1-2: Data Collection Ramp-Up

#### Tasks:
- [x] Generate 100 AI outputs ✅ (infrastructure ready)
- [x] Use Quality Rating UI (1-5 auto-approved) ✅ (component ready)
- [x] Use Edit & Improve component for poor outputs ✅ (component ready)
- [ ] Ensure each example has `task_category` populated
- [ ] Ensure each example has `complexity_level` set
- [ ] Ensure each example has at least one tag (e.g., `api`, `ui`, `triage`)

#### Implementation Notes:
- **task_category**: Currently auto-populated from endpoint detection ✅
- **complexity_level**: Need to add logic to detect/classify
- **tags**: Need to extract from generated test cases or prompt user

#### SQL Query to Check:
```sql
SELECT 
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE task_category IS NOT NULL) as has_category,
  COUNT(*) FILTER (WHERE complexity_level IS NOT NULL) as has_complexity,
  COUNT(*) FILTER (WHERE tags IS NOT NULL AND array_length(tags, 1) > 0) as has_tags
FROM ai_generations
WHERE created_at >= NOW() - INTERVAL '2 days';
```

**Target by Day 3:** 150 total, 60+ high-quality (quality_score >= 4)

---

### DAY 3: Quick Database Validation

#### SQL Validation Query:
```sql
SELECT 
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE quality_score >= 4) as high_quality,
  COUNT(*) FILTER (WHERE corrected_output IS NOT NULL) as corrected,
  COUNT(*) FILTER (WHERE is_approved = true) as approved
FROM ai_generations;
```

**Target:** 150 total, 60+ high-quality ✅

---

### DAY 4-5: Data Quality Audit

#### Tasks:
- [ ] Run validation script: `scripts/validate_training_data.py`
- [ ] Fix JSON format issues
- [ ] Flag duplicates using pgvector similarity check
- [ ] Export sample to verify structure

#### Export Command:
```bash
curl "http://localhost:8001/ai/training-data/export?min_quality_score=4&format=jsonl&limit=10" -o sample_training_data.jsonl
```

#### Validation Checks:
1. JSON validity (all outputs parseable)
2. Duplicate detection (similarity < 0.95)
3. Required fields present (instruction, input, output)
4. Output quality (not empty, reasonable length)

---

## WEEK 2 - EXPORT + TRAINING PREP

### DAY 6: Bulk Approval & Tagging

#### Tasks:
- [ ] Batch-approve trusted outputs in UI or via API
- [ ] Tag datasets with themes:
  - `manual` - Manual test cases
  - `api` - API test cases
  - `automation` - Automated test cases
  - `triage` - Test failure analysis
  - `playwright` - Playwright automation

#### Bulk Approval SQL:
```sql
UPDATE ai_generations
SET is_approved = true
WHERE quality_score >= 4
  AND corrected_output IS NULL
  AND is_approved = false;
```

#### Tagging Enhancement Needed:
- Add UI for bulk tagging
- Or API endpoint: `POST /ai/generations/bulk-tag`

---

### DAY 7: Final Export for Fine-Tuning

#### Tasks:
- [ ] Execute: `python scripts/export_finetuning_data.py --output training_data.jsonl --model 7b`
- [ ] Confirm JSONL validity
- [ ] Count lines: `wc -l training_data.jsonl` (target: 500 samples)
- [ ] Verify structure matches expected format

#### Export Command:
```bash
# Via API
curl "http://localhost:8001/ai/training-data/export?min_quality_score=4&format=jsonl&limit=500" -o training_data.jsonl

# Via Script
python scripts/export_finetuning_data.py --output training_data.jsonl
```

#### Validation:
```bash
# Check line count
wc -l training_data.jsonl

# Validate JSON on each line
python -c "import json; [json.loads(line) for line in open('training_data.jsonl')]"
```

**Target:** 500 samples ✅

---

### DAY 8: Train/Validation Split

#### Tasks:
- [ ] Run: `python scripts/prepare_train_val_split.py training_data.jsonl`
- [ ] Confirm creation of `train.jsonl` (80%) and `val.jsonl` (20%)
- [ ] Verify split ratios

#### Expected Output:
- `train.jsonl` - ~400 samples
- `val.jsonl` - ~100 samples
- Total: 500 samples

---

### DAY 9-10: GPU Environment Setup (DGX / Cloud)

#### Setup Commands:
```bash
# Create conda environment
conda create -n qafn python=3.10 -y
conda activate qafn

# Install libraries
pip install transformers peft bitsandbytes accelerate wandb datasets torch

# Verify GPU
nvidia-smi
```

#### Environment Checklist:
- [ ] CUDA >= 12.2
- [ ] RAM >= 24 GB
- [ ] LoRA rank >= 8 (for 7B model) or 16 (for 14B model)
- [ ] GPU memory >= 16GB (for 7B with LoRA)

---

### DAY 11-12: Fine-Tuning Config

#### Create Config: `configs/lora_qwen7b.yaml`
```yaml
base_model: "Qwen/Qwen2.5-7B-Instruct"
lora_r: 16
lora_alpha: 16
lora_dropout: 0.05
train_file: "data/train.jsonl"
val_file: "data/val.jsonl"
per_device_train_batch_size: 2
gradient_accumulation_steps: 4
learning_rate: 2e-5
num_train_epochs: 3
logging_steps: 10
save_steps: 100
output_dir: "outputs/lora_qwen7b"
```

#### Run Training:
```bash
python scripts/train_lora.py --config configs/lora_qwen7b.yaml
```

#### Monitor Training:
- Watch WandB dashboard (if configured)
- Check loss curves
- Monitor GPU utilization

---

### DAY 13-14: Evaluation + Metrics

#### Evaluation Tasks:
- [ ] Evaluate JSONL validity rate (target: >= 95%)
- [ ] Evaluate approval rate (target: >= 90%)
- [ ] Qualitative comparison: Fine-tuned vs baseline (Qwen2.5-7B)
- [ ] Save model weights to `outputs/lora_qwen7b/`

#### Evaluation Script:
```python
# scripts/evaluate_model.py
# Compare fine-tuned vs baseline on validation set
# Measure: JSON validity, approval rate, quality metrics
```

#### Metrics to Track:
1. **JSON Validity Rate:** % of outputs that parse as valid JSON
2. **Approval Rate:** % of outputs rated >= 4 stars
3. **Test Execution Success:** % of generated tests that execute successfully
4. **Coverage:** % of requirements covered by generated tests
5. **Latency:** Average generation time

---

## PHASE 1.2 MILESTONES RECAP

| Milestone | Target Date | Owner | Status |
|-----------|-------------|-------|--------|
| 500 approved examples | Week 2 Day 7 | Team | ⏳ Pending |
| Data validated & exported | Week 2 Day 8 | Lead Dev | ⏳ Pending |
| GPU training env ready | Week 2 Day 10 | Infra Team | ⏳ Planned |
| Model LoRA run complete | Week 2 Day 12 | AI Program | ⏳ Planned |

---

## Optional Enhancements

### High Priority:
- [ ] **Feedback Analytics Dashboard** - Admin view of all feedback/ratings
- [ ] **Automated Duplicate Check** - Use pgvector similarity to flag duplicates
- [ ] **Batch Rating UI** - Faster approval for multiple outputs

### Medium Priority:
- [ ] **Daily Email Report** - Rating statistics summary
- [ ] **Complexity Auto-Detection** - Analyze prompt length/complexity
- [ ] **Tag Auto-Extraction** - Extract tags from generated test cases

### Low Priority:
- [ ] **A/B Testing Framework** - Compare base vs fine-tuned models
- [ ] **Model Versioning** - Track different fine-tuned versions
- [ ] **Continuous Learning** - Auto-retrain with new data

---

## Scripts Needed

### To Create:
1. **`scripts/validate_training_data.py`** - Data quality validation
2. **`scripts/prepare_train_val_split.py`** - Train/validation split
3. **`scripts/train_lora.py`** - LoRA fine-tuning script
4. **`scripts/evaluate_model.py`** - Model evaluation

### To Enhance:
1. **`scripts/export_finetuning_data.py`** - Add complexity/tags filtering
2. **`backend/app/main.py`** - Add bulk approval/tagging endpoints

---

## Success Criteria

### Data Collection:
- ✅ 500+ high-quality examples (quality_score >= 4)
- ✅ 100+ corrected examples
- ✅ All examples have task_category, complexity_level, tags

### Training:
- ✅ Train/validation split (80/20)
- ✅ LoRA training completes successfully
- ✅ Model weights saved

### Evaluation:
- ✅ JSON validity rate >= 95%
- ✅ Approval rate >= 90%
- ✅ Qualitative improvement over baseline

---

## Notes

- **Start Small:** Begin with 7B model, can scale to 14B later
- **Iterate:** First run may not be perfect, use feedback to improve
- **Monitor:** Track metrics throughout, not just at the end
- **Document:** Keep notes on what works/doesn't work

---

**Ready to proceed?** Start with DAY 1-2: Data Collection Ramp-Up! 🚀


