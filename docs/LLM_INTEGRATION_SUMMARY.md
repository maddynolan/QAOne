# LLM Integration Summary for Qwen 2.5 Models

## Overview

Complete integration system for Qwen 2.5 models (7B, 14B, 32B) for test generation across all test types.

## Components Created

### 1. Evaluation System

**Golden Set Generator** (`scripts/generate_golden_set.py`)
- Extracts requirements and test cases from database
- Creates `golden.jsonl` for LLM evaluation
- Links human-written tests to requirements

**Evaluation Harness** (`scripts/evaluate_llm.py`)
- Comprehensive scoring metrics:
  - Structure score (JSON validity, required fields)
  - Diversity score (uniqueness of test cases)
  - Overlap score (similarity to human tests)
  - Compilation check (for automation tests)
- Supports all test types
- Pass/fail gates for quality assessment

### 2. Backend Integration

**Enhanced Test Generation Endpoint** (`POST /ai/generate-tests-enhanced`)
- Supports all test types: manual, automation, API, performance, security, accessibility, database
- Model selection: `quick` (7B), `ui` (14B), `heavy` (32B)
- Optimization features:
  - Retry logic with fixup prompts
  - Deduplication of test cases
  - Coverage hints detection
  - JSON validation and extraction

**Prompt Templates** (`backend/app/services/prompt_templates.py`)
- Specialized prompts for each test type
- Optimized for Qwen 2.5 models
- Consistent JSON output format

**Test Generation Optimizer** (`backend/app/services/test_generation_optimizer.py`)
- JSON extraction with multiple fallback strategies
- Test case deduplication
- Coverage gap detection
- Structure validation and fixing

### 3. Training & Fine-tuning

**Training Guide** (`docs/LLM_TRAINING_GUIDE.md`)
- Complete fine-tuning instructions
- Ollama Modelfile approach
- Hugging Face Transformers approach
- LoRA for efficient fine-tuning
- Hardware requirements

**Data Export** (`scripts/export_finetuning_data.py`)
- Exports all AI generations from database
- Formats for Qwen fine-tuning
- Filters by model type

### 4. Monitoring

**Evaluation Summary** (`GET /ai/evaluation-summary`)
- Statistics by model and endpoint
- Latency metrics
- Call counts
- Performance monitoring

## Usage Examples

### Generate Manual Tests

```bash
curl -X POST http://localhost:8001/ai/generate-tests-enhanced \
  -H "Content-Type: application/json" \
  -d '{
    "requirement": "User login functionality",
    "test_type": "manual",
    "mode": "ui"
  }'
```

### Generate API Tests

```bash
curl -X POST http://localhost:8001/ai/generate-tests-enhanced \
  -H "Content-Type: application/json" \
  -d '{
    "requirement": "REST API for user management",
    "test_type": "api",
    "mode": "ui"
  }'
```

### Generate Automation Tests

```bash
curl -X POST http://localhost:8001/ai/generate-tests-enhanced \
  -H "Content-Type: application/json" \
  -d '{
    "requirement": "E-commerce checkout flow",
    "test_type": "automation",
    "mode": "heavy"
  }'
```

### Evaluate LLM Performance

```bash
# Generate golden set
python scripts/generate_golden_set.py

# Evaluate on manual tests
python scripts/evaluate_llm.py manual qwen2.5-coder:14b

# Evaluate on API tests
python scripts/evaluate_llm.py api qwen2.5-coder:14b
```

### Export Training Data

```bash
# Export all data
python scripts/export_finetuning_data.py

# Export specific model
python scripts/export_finetuning_data.py --model 14b
```

## Test Types Supported

1. **Manual Tests**: Step-by-step manual test cases
2. **Automation Tests**: Playwright TypeScript code
3. **API Tests**: REST API test cases (Postman/Playwright-API)
4. **Performance Tests**: Load/stress test scenarios (k6)
5. **Security Tests**: OWASP Top 10 security test cases
6. **Accessibility Tests**: WCAG 2.1 AA compliance tests
7. **Database Tests**: SQL/data integrity tests

## Model Selection Strategy

- **7B (quick)**: Fast generation, good for simple test cases, low latency
- **14B (ui)**: Balanced quality/speed, recommended for most use cases
- **32B (heavy)**: Highest quality, use for complex scenarios or when quality is critical

## Quality Gates

- Valid JSON: > 95%
- Structure Score: > 85%
- Diversity Score: > 80%
- Overlap with Human: 30-70% (not too similar, not too different)
- Playwright Compilable: > 60% (for automation tests)

## Fine-tuning Workflow

1. **Collect Data**: Run test generation, collect all prompts/responses
2. **Export**: `python scripts/export_finetuning_data.py`
3. **Review**: Clean and filter training data
4. **Fine-tune**: Use training guide commands
5. **Evaluate**: Compare fine-tuned vs baseline
6. **Deploy**: Update model configuration
7. **Monitor**: Track performance metrics
8. **Iterate**: Continuous improvement

## Next Steps

1. ✅ Generate golden set from existing data
2. ✅ Run evaluation on baseline models
3. ✅ Collect training data from production
4. ✅ Fine-tune models on your data
5. ✅ Deploy fine-tuned models
6. ✅ Monitor and iterate

## Integration Points

- **Frontend**: Use `/ai/generate-tests-enhanced` endpoint
- **Database**: All generations logged to `ai_generations` table
- **Monitoring**: `/ai/evaluation-summary` for metrics
- **Training**: Export from `ai_generations` for fine-tuning

## Files Created

- `scripts/generate_golden_set.py` - Golden set generation
- `scripts/evaluate_llm.py` - LLM evaluation harness
- `scripts/export_finetuning_data.py` - Training data export
- `backend/app/services/prompt_templates.py` - Prompt templates
- `backend/app/services/test_generation_optimizer.py` - Optimization utilities
- `docs/LLM_TRAINING_GUIDE.md` - Training documentation
- `docs/LLM_INTEGRATION_SUMMARY.md` - This file

## API Endpoints

- `POST /ai/generate-tests-enhanced` - Enhanced test generation (all types)
- `POST /ai/convert-to-playwright` - Convert manual to Playwright
- `GET /ai/evaluation-summary` - Performance metrics
- `POST /ai/generate-tests` - Original endpoint (still supported)

## Configuration

Update `backend/app/services/ollama_service.py` to use custom models:

```python
self.model_map = {
    ModelMode.QUICK: "qwen2.5-7b-qa-custom",
    ModelMode.UI: "qwen2.5-14b-qa-custom",
    ModelMode.HEAVY: "qwen2.5-32b-qa-custom"
}
```

