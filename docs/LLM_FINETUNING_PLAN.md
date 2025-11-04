# LLM Fine-Tuning Plan: QA Expert Model

## 🎯 Goal
Create a fine-tuned LLM that acts as an **exclusive senior QA engineer** - capable of handling all QA tasks including:
- Test case generation (manual, automated, API, performance, security, accessibility)
- Test failure triage and root cause analysis
- Test plan creation and optimization
- Test data generation
- Test strategy recommendations
- Quality metrics analysis
- Test automation code generation

---

## 📊 Current State Analysis

### ✅ What We Have
1. **RAG System** - Complete with embeddings, caching, and retrieval
2. **Data Collection** - `ai_generations` table storing all LLM interactions
3. **Prompt Templates** - Versioned templates for different QA tasks
4. **Infrastructure** - PostgreSQL, Redis, embedding service, metrics tracking

### 📈 Data Collection Status
- **Current**: Storing prompt/response pairs in `ai_generations`
- **Gap**: Need to label and curate high-quality examples
- **Opportunity**: Can use existing successful generations as training data

---

## 🚀 Phase 1: Data Collection & Preparation (Weeks 1-2)

### 1.1 Enhance Data Collection

**Current Implementation:**
- `ai_generations` table stores all generations
- Includes: prompt, model, output, latency, endpoint

**Enhancements Needed:**

```sql
-- Add columns to ai_generations for fine-tuning data
ALTER TABLE ai_generations ADD COLUMN IF NOT EXISTS:
    - quality_score INTEGER (1-5, user rating)
    - is_approved BOOLEAN DEFAULT false (manually reviewed)
    - feedback TEXT (user corrections/improvements)
    - corrected_output TEXT (if user modified output)
    - task_category VARCHAR(50) (manual, api, automation, etc.)
    - complexity_level VARCHAR(20) (simple, medium, complex)
    - tags TEXT[] (for filtering training data)
```

**Action Items:**
1. Add quality rating UI to frontend (star rating after generation)
2. Add "Edit & Improve" functionality to capture corrections
3. Add batch export endpoint for training data
4. Create data quality filters (remove low-quality, duplicate, invalid JSON)

### 1.2 Data Sources

**Primary Sources:**
1. **High-Quality Generations** (`quality_score >= 4`)
   - User-approved test cases
   - Successfully executed test cases
   - Test cases with high pass rates

2. **Corrected Outputs** (`corrected_output IS NOT NULL`)
   - User edits show what was wrong
   - Valuable for learning from mistakes

3. **Triage Successes** (from `triage_analysis` table)
   - Successful root cause identifications
   - Effective fix suggestions

4. **Test Plans** (from `test_plans` table)
   - Well-structured test plans
   - Comprehensive coverage

**Secondary Sources:**
1. **Public QA Datasets** (if available)
   - Software testing best practices
   - Test case examples from open-source projects

2. **Manual Curation**
   - Create golden examples for each task type
   - Include edge cases and complex scenarios

### 1.3 Data Formatting

**Training Format:**
```json
{
  "instruction": "Generate manual test cases for the following requirement...",
  "input": "As a user, I want to login with email and password so that I can access my account",
  "output": "[{\"title\": \"Valid login with email and password\", ...}]",
  "task_type": "manual_test_generation",
  "quality_score": 5,
  "tags": ["authentication", "login", "happy_path"]
}
```

**Conversion Script:**
```python
# backend/scripts/prepare_finetuning_data.py
- Query ai_generations for high-quality examples
- Format into instruction/input/output format
- Split into train/validation sets (80/20)
- Export as JSONL for fine-tuning
```

---

## 🎓 Phase 2: Fine-Tuning Strategy (Weeks 3-4)

### 2.1 Model Selection

**Base Model Options:**
1. **Qwen2.5:7B** (Current favorite)
   - Good balance of capability and speed
   - Already integrated in system
   - Can fine-tune on GPU or cloud

2. **Qwen2.5:14B** (For higher quality)
   - More capable but slower
   - Better for complex QA scenarios
   - Requires more GPU memory

3. **Qwen2.5-Coder:7B/14B** (For code generation)
   - Better at Playwright/automation code
   - Good for test automation tasks

**Recommendation:** Start with **Qwen2.5:7B** for speed, then fine-tune **Qwen2.5-Coder:14B** for automation tasks.

### 2.2 Fine-Tuning Approach

**Option A: LoRA (Low-Rank Adaptation) - Recommended**
- **Pros:**
  - Faster training (fewer parameters)
  - Less GPU memory required
  - Can merge multiple LoRA adapters
  - Preserves base model capabilities
  
- **Implementation:**
  ```python
  # Use PEFT library with LoRA
  from peft import LoraConfig, get_peft_model
  
  lora_config = LoraConfig(
      r=16,  # Rank
      lora_alpha=32,
      target_modules=["q_proj", "v_proj", "k_proj", "o_proj"],
      lora_dropout=0.1,
      bias="none",
      task_type="CAUSAL_LM"
  )
  ```

**Option B: Full Fine-Tuning**
- **Pros:** Maximum customization
- **Cons:** Requires more GPU, longer training, risk of overfitting

**Option C: QLoRA (Quantized LoRA)**
- **Pros:** Can fine-tune on consumer GPUs (24GB)
- **Cons:** Slightly lower quality than full LoRA

### 2.3 Training Configuration

**Hyperparameters:**
```python
training_args = {
    "output_dir": "./qa_expert_model",
    "num_train_epochs": 3,
    "per_device_train_batch_size": 4,
    "gradient_accumulation_steps": 8,
    "learning_rate": 2e-4,
    "warmup_steps": 100,
    "logging_steps": 10,
    "save_steps": 500,
    "evaluation_strategy": "steps",
    "eval_steps": 500,
    "save_total_limit": 3,
    "load_best_model_at_end": True,
    "fp16": True,  # Use mixed precision
    "lr_scheduler_type": "cosine"
}
```

**Training Data Requirements:**
- **Minimum:** 500 high-quality examples per task type
- **Recommended:** 2000-5000 examples total
- **Distribution:**
  - 40% manual test generation
  - 20% automation test generation
  - 15% API test generation
  - 10% triage/analysis
  - 10% test plan creation
  - 5% other tasks (performance, security, accessibility)

---

## 🔧 Phase 3: Infrastructure Setup (Week 2-3)

### 3.1 Training Infrastructure

**Option A: Local GPU (if available)**
- Requires NVIDIA GPU with 24GB+ VRAM (for 7B model)
- Use: `transformers`, `accelerate`, `peft`
- Cost: Hardware investment

**Option B: Cloud GPU (Recommended)**
- **AWS SageMaker** - Managed training
- **Google Colab Pro** - Cost-effective for experimentation
- **RunPod/Vast.ai** - Cheaper GPU rentals
- **Lambda Labs** - Good pricing for A100/H100

**Option C: Gradient AI** - Specialized for fine-tuning
- Easy integration with HuggingFace
- Automatic model deployment

### 3.2 Training Pipeline

**Components:**
1. **Data Preparation Service**
   - Export from database
   - Format conversion
   - Quality filtering
   - Train/val split

2. **Training Script**
   - Load base model
   - Apply LoRA
   - Train with validation
   - Save checkpoints

3. **Evaluation Script**
   - Test on held-out validation set
   - Measure quality metrics
   - Compare with base model

4. **Model Deployment**
   - Merge LoRA weights (optional)
   - Convert to Ollama format
   - Deploy to Ollama server

### 3.3 Integration with Existing System

**Model Management:**
- Store fine-tuned model info in database
- Version control for models
- A/B testing capability (compare base vs fine-tuned)
- Rollback mechanism

**Service Updates:**
```python
# backend/app/services/ollama_service.py
class OllamaService:
    def __init__(self):
        self.base_models = {
            "quick": "qwen2.5:7b-instruct",
            "ui": "qwen2.5-coder:14b"
        }
        self.finetuned_models = {
            "qa-expert": "qa-expert:7b",  # Fine-tuned model
            "qa-automation": "qa-automation:14b"  # Automation-focused
        }
    
    def select_model(self, mode, task_type=None):
        # Use fine-tuned model if available for task
        if task_type == "automation" and "qa-automation" in self.finetuned_models:
            return self.finetuned_models["qa-automation"]
        # Fallback to base models
        return self.base_models.get(mode, self.base_models["ui"])
```

---

## 📈 Phase 4: Evaluation & Iteration (Weeks 4-5)

### 4.1 Evaluation Metrics

**Quality Metrics:**
1. **Accuracy**
   - Valid JSON output rate
   - Test case structure correctness
   - Field completeness

2. **Relevance**
   - Test cases match requirements
   - Coverage of scenarios
   - Appropriate test data

3. **Completeness**
   - All edge cases covered
   - Positive and negative scenarios
   - Proper priority assignment

4. **Code Quality** (for automation)
   - Syntactically correct code
   - Uses best practices
   - Proper error handling

**Comparison Metrics:**
- Side-by-side comparison: Base model vs Fine-tuned
- User preference ratings
- Execution success rate (for generated tests)

### 4.2 Iterative Improvement

**Process:**
1. Train initial model with available data
2. Deploy and collect user feedback
3. Identify failure patterns
4. Add more training examples for weak areas
5. Retrain with expanded dataset
6. Repeat

**Feedback Loop:**
```
User Generation → Quality Rating → Approval/Correction → 
Training Data → Model Retraining → Deploy → Collect Feedback
```

---

## 🎯 Phase 5: Specialized QA Expert Capabilities

### 5.1 Core QA Tasks

**The fine-tuned model should excel at:**

1. **Test Case Generation**
   - Manual test cases (happy path, negative, edge cases)
   - Automation test cases (Playwright, Selenium)
   - API test cases (REST, GraphQL)
   - Performance test cases (load, stress, endurance)
   - Security test cases (OWASP Top 10)
   - Accessibility test cases (WCAG compliance)

2. **Test Planning**
   - Test strategy creation
   - Test plan structure
   - Coverage analysis
   - Risk-based prioritization

3. **Test Failure Analysis**
   - Root cause identification
   - Log analysis
   - Screenshot/video analysis
   - Fix suggestions
   - Flakiness detection

4. **Test Data Generation**
   - Realistic test data
   - Edge case data
   - Boundary value data
   - Negative test data

5. **Code Review (Test Code)**
   - Test code quality review
   - Best practices suggestions
   - Refactoring recommendations
   - Performance optimization

### 5.2 Domain Knowledge

**The model should understand:**
- QA terminology and concepts
- Testing methodologies (BDD, TDD, ATDD)
- Test pyramid principles
- CI/CD integration
- Test reporting and metrics
- Test maintenance strategies

**Training Data Should Include:**
- QA best practices documentation
- Testing strategy guides
- Test case examples from various domains
- Common testing patterns and anti-patterns

---

## 📋 Implementation Roadmap

### Week 1-2: Data Collection Enhancement
- [x] Add quality rating to frontend ✅ **COMPLETE**
- [x] Add edit/correction functionality ✅ **COMPLETE**
- [x] Create data export endpoint ✅ **COMPLETE**
- [x] Build data quality filters ✅ **COMPLETE** (basic filters in place, can be enhanced)
- [ ] Collect initial 500+ high-quality examples (ongoing)

### Week 3: Data Preparation
- [ ] Format data for training (instruction/input/output)
- [ ] Create train/validation split
- [ ] Validate data quality
- [ ] Export to JSONL format

### Week 4: Training Setup
- [ ] Set up GPU environment (cloud or local)
- [ ] Install training dependencies
- [ ] Prepare training scripts
- [ ] Run initial training run

### Week 5: Model Evaluation
- [ ] Evaluate on validation set
- [ ] Compare with base model
- [ ] User testing with real scenarios
- [ ] Collect feedback

### Week 6: Iteration & Deployment
- [ ] Refine training data based on feedback
- [ ] Retrain model
- [ ] Deploy to Ollama
- [ ] Integrate with existing system
- [ ] A/B testing setup

---

## 🛠️ Technical Implementation Details

### Training Script Structure

```python
# backend/scripts/train_qa_expert.py

import torch
from transformers import AutoModelForCausalLM, AutoTokenizer, TrainingArguments
from peft import LoraConfig, get_peft_model
from datasets import load_dataset

def train_qa_expert():
    # 1. Load base model
    model_name = "Qwen/Qwen2.5-7B-Instruct"
    model = AutoModelForCausalLM.from_pretrained(model_name)
    tokenizer = AutoTokenizer.from_pretrained(model_name)
    
    # 2. Apply LoRA
    lora_config = LoraConfig(...)
    model = get_peft_model(model, lora_config)
    
    # 3. Load training data
    dataset = load_dataset("json", data_files="training_data.jsonl")
    
    # 4. Format data
    def format_prompt(example):
        return f"### Instruction:\n{example['instruction']}\n\n### Input:\n{example['input']}\n\n### Response:\n{example['output']}"
    
    # 5. Train
    trainer = Trainer(
        model=model,
        args=training_args,
        train_dataset=dataset["train"],
        eval_dataset=dataset["validation"]
    )
    trainer.train()
    
    # 6. Save model
    model.save_pretrained("./qa_expert_model")
```

### Data Export Script

```python
# backend/scripts/export_finetuning_data.py

async def export_training_data(
    min_quality_score: int = 4,
    task_types: List[str] = None,
    limit: int = 5000
):
    """
    Export high-quality generations for fine-tuning
    """
    query = """
        SELECT 
            prompt,
            output,
            endpoint,
            task,
            quality_score,
            corrected_output
        FROM ai_generations
        WHERE quality_score >= $1
          AND (corrected_output IS NOT NULL OR is_approved = true)
    """
    
    # Format as instruction/input/output
    # Export to JSONL
```

### Model Deployment

```bash
# Convert to Ollama format
ollama create qa-expert:7b -f Modelfile

# Modelfile content:
# FROM ./qa_expert_model
# TEMPLATE """{{ .System }}
# 
# {{ .Prompt }}"""
# PARAMETER temperature 0.7
# PARAMETER top_p 0.9
```

---

## 📊 Success Criteria

### Quantitative Metrics
- **JSON Validity Rate:** > 95% (vs ~85% for base model)
- **User Approval Rate:** > 80% (vs ~60% for base model)
- **Test Execution Success:** > 90% (vs ~75% for base model)
- **Latency:** < 5s for 7B model (same as base)
- **Token Efficiency:** 20% reduction in tokens needed

### Qualitative Improvements
- Better understanding of QA context
- More comprehensive test coverage
- Higher quality test code
- Better root cause analysis
- More relevant suggestions

---

## 🚨 Challenges & Mitigations

### Challenge 1: Data Quality
**Risk:** Poor training data = poor model
**Mitigation:**
- Strict quality filters (minimum 4/5 rating)
- Manual review of training examples
- Continuous data curation

### Challenge 2: Overfitting
**Risk:** Model memorizes training data
**Mitigation:**
- Use validation set
- Early stopping
- LoRA (fewer parameters = less overfitting)
- Data augmentation

### Challenge 3: Deployment Complexity
**Risk:** Difficult to deploy fine-tuned model
**Mitigation:**
- Use Ollama (easy model deployment)
- Keep LoRA weights separate (can merge later)
- Version control for models

### Challenge 4: Cost
**Risk:** Training and deployment costs
**Mitigation:**
- Start with LoRA (cheaper)
- Use spot instances for training
- Train on subset first, expand if successful

---

## 📚 Resources & References

### Training Resources
- [HuggingFace Fine-Tuning Guide](https://huggingface.co/docs/transformers/training)
- [PEFT LoRA Documentation](https://huggingface.co/docs/peft)
- [Qwen2.5 Fine-Tuning Guide](https://github.com/QwenLM/Qwen2.5)

### Tools
- **Transformers** - Model loading and training
- **PEFT** - LoRA implementation
- **Accelerate** - Distributed training
- **Datasets** - Data handling
- **WandB** - Training monitoring

### Data Collection
- **Existing**: `ai_generations` table
- **Manual**: Create golden examples
- **Public**: QA datasets (if available)

---

## 🎯 Next Immediate Steps

### This Week:
1. ✅ **Enhance Data Collection**
   - Add quality rating UI
   - Add edit/correction flow
   - Create data export endpoint

2. ✅ **Start Data Collection**
   - Use existing successful generations
   - Manual curation of 50-100 examples
   - Set up data quality pipeline

3. ✅ **Research Training Infrastructure**
   - Choose cloud provider or local GPU
   - Set up development environment
   - Test with small dataset first

### Next Week:
1. **Prepare Training Data**
   - Export and format data
   - Create train/validation split
   - Validate data quality

2. **First Training Run**
   - Train on 500 examples
   - Evaluate results
   - Compare with base model

---

## 💡 Long-Term Vision

### Multi-Model Strategy
- **QA Expert General** - All-around QA tasks
- **QA Automation Specialist** - Test automation code
- **QA Analyst** - Test failure analysis
- **QA Strategist** - Test planning and strategy

### Continuous Learning
- Regularly retrain with new data
- A/B test new models
- User feedback integration
- Domain-specific fine-tuning (e.g., fintech, healthcare)

### Ecosystem
- Fine-tuned models for different industries
- Custom models per organization
- Model marketplace (share models)
- Community contributions

---

## 📝 Notes

- Start small: Fine-tune on one task type first (manual test generation)
- Iterate: Use feedback to improve
- Measure: Track metrics before/after
- Scale: Expand to more task types once proven

The goal is to create a model that understands QA context deeply and generates high-quality, production-ready test artifacts.

