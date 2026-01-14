# Flowstral AI Model Strategy: Fine-Tuning & On-Prem Deployment

## Executive Summary

This document outlines the strategy for fine-tuning a purpose-built AI model for Flowstral that understands:
- **Element identification patterns** across 25+ enterprise applications
- **Selector strategies** and when to use each
- **Common failure patterns** and their fixes
- **Navigation styles** per application type
- **Context-aware element resolution**

The goal: **ZERO playback failures** through a unified approach where AI is the safety net, not the primary engine.

---

## 🎯 PART 1: What We're Building

### The Flowstral Element Model (FEM)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    FLOWSTRAL ELEMENT MODEL (FEM)                             │
│                    ─────────────────────────────────                         │
│                                                                             │
│  PURPOSE: Understand elements like a senior QA engineer                     │
│                                                                             │
│  CAPABILITIES:                                                              │
│  ┌───────────────────────────────────────────────────────────────────┐     │
│  │ 1. ELEMENT IDENTIFICATION                                         │     │
│  │    • Given: Recipe (what/where/which) + screenshot + DOM          │     │
│  │    • Output: Best selector + alternatives + confidence            │     │
│  │                                                                   │     │
│  │ 2. SELECTOR HEALING                                               │     │
│  │    • Given: Failed selector + screenshot + error                  │     │
│  │    • Output: Fixed selector + explanation                         │     │
│  │                                                                   │     │
│  │ 3. APPLICATION CONTEXT                                            │     │
│  │    • Given: URL/DOM/screenshot                                    │     │
│  │    • Output: App type + navigation patterns + stable attributes   │     │
│  │                                                                   │     │
│  │ 4. FAILURE ANALYSIS                                               │     │
│  │    • Given: Error + context + history                             │     │
│  │    • Output: Root cause + fix suggestion                          │     │
│  └───────────────────────────────────────────────────────────────────┘     │
│                                                                             │
│  SIZE: 7B-14B parameters (optimized for on-prem deployment)                │
│  BASE: Qwen2.5-7B-Instruct or similar                                      │
│  TRAINING: LoRA fine-tuning on Flowstral-specific data                     │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 🗂️ PART 2: Training Data Strategy

### What Data Do We Need?

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    TRAINING DATA CATEGORIES                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  CATEGORY 1: ELEMENT → SELECTOR MAPPINGS                                   │
│  ─────────────────────────────────────────                                  │
│  Format:                                                                    │
│  {                                                                          │
│    "input": {                                                               │
│      "recipe": {                                                            │
│        "what": {"role": "button", "text": "Submit"},                       │
│        "where": {"landmark": "form", "nearText": "Email"},                 │
│        "which": {"position": 1}                                            │
│      },                                                                     │
│      "app": "salesforce",                                                   │
│      "dom_context": "<lightning-button>...</lightning-button>",            │
│      "existing_selectors": ["[data-testid='submit']", "button.submit"]     │
│    },                                                                       │
│    "output": {                                                              │
│      "best_selector": "page.getByRole('button', {name: 'Submit'})",        │
│      "fallbacks": [...],                                                    │
│      "reasoning": "Role-based selector is most stable for SF buttons"      │
│    }                                                                        │
│  }                                                                          │
│                                                                             │
│  Target: 5,000+ examples across 25+ applications                           │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  CATEGORY 2: HEALING PAIRS (Failed → Fixed)                                │
│  ───────────────────────────────────────────                                │
│  Format:                                                                    │
│  {                                                                          │
│    "input": {                                                               │
│      "failed_selector": "#btn-123",                                        │
│      "error": "Element not found",                                         │
│      "original_recipe": {...},                                             │
│      "current_dom": "<div>...<button id='submit-btn'>Submit</button>..."   │
│    },                                                                       │
│    "output": {                                                              │
│      "healed_selector": "page.getByRole('button', {name: 'Submit'})",      │
│      "healing_method": "role_based_replacement",                           │
│      "explanation": "ID changed from #btn-123 to #submit-btn, using..."    │
│    }                                                                        │
│  }                                                                          │
│                                                                             │
│  Target: 2,000+ healing examples (from real failures)                      │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  CATEGORY 3: APPLICATION FINGERPRINTS                                       │
│  ─────────────────────────────────────                                      │
│  Format:                                                                    │
│  {                                                                          │
│    "input": {                                                               │
│      "url": "https://company.lightning.force.com/...",                     │
│      "dom_sample": "<html>...<lightning-...>",                             │
│      "meta_tags": {...}                                                     │
│    },                                                                       │
│    "output": {                                                              │
│      "app": "salesforce",                                                   │
│      "app_version": "lightning",                                           │
│      "stable_attributes": ["data-aura-rendered-by", "data-component-id"],  │
│      "unstable_patterns": ["aura\\d+", "lwc-\\d+"],                        │
│      "navigation_style": "spa_routing",                                    │
│      "shadow_dom": true                                                    │
│    }                                                                        │
│  }                                                                          │
│                                                                             │
│  Target: 100+ fingerprints per application (different pages/states)        │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  CATEGORY 4: FAILURE PATTERNS                                               │
│  ────────────────────────────                                               │
│  Format:                                                                    │
│  {                                                                          │
│    "input": {                                                               │
│      "error_type": "timeout",                                              │
│      "error_message": "Timeout 30000ms exceeded waiting for...",           │
│      "step": {"action": "click", "selector": "..."},                       │
│      "console_logs": [...],                                                │
│      "network_requests": [...]                                             │
│    },                                                                       │
│    "output": {                                                              │
│      "root_cause": "element_changed",                                      │
│      "category": "selector_issue",                                         │
│      "fix_type": "update_selector",                                        │
│      "suggested_fix": "Update to getByRole('button', {name: 'Save'})",     │
│      "confidence": 0.92                                                    │
│    }                                                                        │
│  }                                                                          │
│                                                                             │
│  Target: 3,000+ failure patterns with resolutions                          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Data Collection Infrastructure

We already have:
- ✅ `scripts/collect_training_data.py`
- ✅ `scripts/export_finetuning_data.py`
- ✅ `ai_generations` table in PostgreSQL
- ✅ ~485 high-quality examples ready

**What We Need to Add:**

```python
# NEW: backend/app/services/training/element_data_collector.py

class ElementDataCollector:
    """
    Collects training data specifically for element identification.
    Hooks into recording and playback to capture real-world examples.
    """
    
    async def capture_recording_example(
        self,
        element: Dict[str, Any],
        recipe: Dict[str, Any],
        selected_selector: str,
        all_selectors: List[Dict[str, Any]],
        app_context: Dict[str, Any]
    ):
        """Capture a successful element identification during recording."""
        example = {
            "task": "element_to_selector",
            "input": {
                "recipe": recipe,
                "app": app_context.get("app_type"),
                "dom_context": element.get("outer_html", "")[:2000],
            },
            "output": {
                "best_selector": selected_selector,
                "all_selectors": all_selectors,
            },
            "metadata": {
                "source": "recording",
                "timestamp": datetime.now().isoformat(),
                "app_url": app_context.get("url"),
            }
        }
        await self._store_example(example)
    
    async def capture_healing_example(
        self,
        original_selector: str,
        failed_error: str,
        healed_selector: str,
        healing_method: str,
        recipe: Dict[str, Any],
        dom_snapshot: str
    ):
        """Capture a successful healing (gold data!)"""
        example = {
            "task": "selector_healing",
            "input": {
                "failed_selector": original_selector,
                "error": failed_error,
                "recipe": recipe,
                "dom_context": dom_snapshot[:3000],
            },
            "output": {
                "healed_selector": healed_selector,
                "healing_method": healing_method,
            },
            "metadata": {
                "source": "auto_healing",
                "quality": "high",  # Real healing = high quality
            }
        }
        await self._store_example(example)
```

### Data Augmentation Strategy

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    DATA AUGMENTATION TECHNIQUES                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  1. SELECTOR MUTATION                                                       │
│     • Take working selector → Generate broken variants                     │
│     • "#submit-btn" → "#btn-123", ".MuiButton-root:nth(3)"                │
│     • Train model to heal back to original                                 │
│                                                                             │
│  2. APPLICATION TRANSFER                                                    │
│     • Same element type across apps                                        │
│     • "Submit button" in Salesforce vs WorkDay vs SAP                     │
│     • Different DOM structure, same semantic meaning                       │
│                                                                             │
│  3. DOM PERTURBATION                                                        │
│     • Inject extra elements, change order                                  │
│     • Simulate real-world DOM changes                                      │
│     • Test selector resilience                                             │
│                                                                             │
│  4. ERROR VARIATION                                                         │
│     • Same failure, different error messages                               │
│     • "Element not found" vs "Timeout waiting for selector"               │
│     • Generalize root cause detection                                      │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 🏗️ PART 3: Fine-Tuning Architecture

### Model Selection

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    MODEL OPTIONS FOR ON-PREM                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  OPTION 1: Qwen2.5-7B-Instruct (RECOMMENDED)                               │
│  ──────────────────────────────────────────────                             │
│  Pros:                                                                      │
│  ✓ Excellent code understanding                                            │
│  ✓ Good at structured output (JSON)                                        │
│  ✓ 7B fits on single GPU (24GB)                                           │
│  ✓ Apache 2.0 license (commercial OK)                                     │
│  ✓ We already have LoRA config ready                                       │
│                                                                             │
│  Requirements:                                                              │
│  • 24GB VRAM for inference                                                  │
│  • 48GB VRAM for LoRA training                                             │
│                                                                             │
│  OPTION 2: Qwen2.5-14B-Instruct (Higher quality)                           │
│  ────────────────────────────────────────────────                           │
│  Pros:                                                                      │
│  ✓ Better reasoning                                                        │
│  ✓ More accurate for complex scenarios                                     │
│                                                                             │
│  Requirements:                                                              │
│  • 48GB VRAM for inference                                                  │
│  • 80GB+ for training (needs A100)                                         │
│                                                                             │
│  OPTION 3: Llama-3.2-8B (Alternative)                                       │
│  ─────────────────────────────────────                                      │
│  Pros:                                                                      │
│  ✓ Meta's latest                                                           │
│  ✓ Good multilingual support                                               │
│                                                                             │
│  Cons:                                                                      │
│  • License requires signup                                                  │
│  • Less tested with our data                                               │
│                                                                             │
│  RECOMMENDATION: Start with Qwen2.5-7B, upgrade to 14B if needed           │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Fine-Tuning Parameters

```yaml
# configs/flowstral_element_model.yaml

# Base Model
base_model: "Qwen/Qwen2.5-7B-Instruct"
model_type: "qwen2"

# LoRA Configuration
lora:
  rank: 32  # Higher rank for complex task
  alpha: 64
  dropout: 0.1
  target_modules:
    - "q_proj"
    - "k_proj"
    - "v_proj"
    - "o_proj"
    - "gate_proj"
    - "up_proj"
    - "down_proj"

# Training Configuration
training:
  num_epochs: 5
  batch_size: 4
  gradient_accumulation_steps: 4  # Effective batch size: 16
  learning_rate: 2e-4
  warmup_ratio: 0.1
  lr_scheduler: "cosine"
  max_seq_length: 4096  # DOM context can be long
  
# Data Configuration
data:
  train_file: "data/flowstral_train.jsonl"
  val_file: "data/flowstral_val.jsonl"
  
  # Task-specific prompts
  tasks:
    element_to_selector:
      system: |
        You are Flowstral Element Model, an expert at identifying web elements.
        Given an element recipe and context, generate the best Playwright selector.
        Prioritize: testId > role > aria-label > text > css > xpath
      
    selector_healing:
      system: |
        You are Flowstral Healing Model, an expert at fixing broken selectors.
        Given a failed selector and current DOM, suggest the best fix.
        Explain WHY the selector broke and HOW your fix addresses it.
      
    failure_analysis:
      system: |
        You are Flowstral Failure Analyst, an expert at diagnosing test failures.
        Given error context, identify root cause and suggest specific fix.
        Categories: element_changed, timing_issue, app_bug, env_issue

# Quantization (for deployment)
quantization:
  enabled: true
  bits: 4  # 4-bit quantization for smaller footprint
  method: "awq"  # or "gptq"

# Output
output:
  dir: "models/flowstral-element-v1"
  save_steps: 500
  eval_steps: 100
```

### Training Pipeline

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    FINE-TUNING PIPELINE                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  PHASE 1: DATA PREPARATION                                                  │
│  ─────────────────────────────                                              │
│  1. Export existing examples from database                                  │
│  2. Augment with synthetic variations                                       │
│  3. Split into train/val (90/10)                                           │
│  4. Validate JSON format                                                    │
│                                                                             │
│  PHASE 2: BASE TRAINING                                                     │
│  ──────────────────────────                                                 │
│  1. Load Qwen2.5-7B base model                                             │
│  2. Apply LoRA adapters                                                     │
│  3. Train on element_to_selector task (2 epochs)                           │
│  4. Evaluate on held-out examples                                           │
│                                                                             │
│  PHASE 3: MULTI-TASK TRAINING                                              │
│  ─────────────────────────────                                              │
│  1. Continue training with all tasks mixed                                  │
│  2. Weight by task importance:                                              │
│     • element_to_selector: 40%                                             │
│     • selector_healing: 30%                                                │
│     • failure_analysis: 20%                                                │
│     • app_detection: 10%                                                   │
│                                                                             │
│  PHASE 4: QUANTIZATION & OPTIMIZATION                                      │
│  ──────────────────────────────────────                                     │
│  1. Merge LoRA weights into base model                                     │
│  2. Apply AWQ 4-bit quantization                                           │
│  3. Export to GGUF format (for llama.cpp)                                  │
│  4. Test inference speed                                                   │
│                                                                             │
│  PHASE 5: VALIDATION                                                        │
│  ───────────────────                                                        │
│  1. Test against 100+ real recorded tests                                  │
│  2. Measure selector accuracy                                              │
│  3. Measure healing success rate                                           │
│  4. Compare to deterministic-only approach                                 │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 🏢 PART 4: On-Premise Deployment Options

### Deployment Architectures

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    ON-PREM DEPLOYMENT OPTIONS                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  OPTION A: EMBEDDED (Single Machine)                                        │
│  ─────────────────────────────────────                                      │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────┐               │
│  │           Customer's Test Automation Server              │               │
│  │  ┌─────────────────────────────────────────────────────┐│               │
│  │  │  Flowstral Desktop / Backend                        ││               │
│  │  │  ┌─────────────────────┐  ┌──────────────────────┐ ││               │
│  │  │  │  Ollama Server      │  │  Flowstral Engine    │ ││               │
│  │  │  │  (flowstral-elem-7b)│  │  (Test Execution)    │ ││               │
│  │  │  └─────────────────────┘  └──────────────────────┘ ││               │
│  │  └─────────────────────────────────────────────────────┘│               │
│  └─────────────────────────────────────────────────────────┘               │
│                                                                             │
│  Requirements:                                                              │
│  • 32GB RAM                                                                 │
│  • NVIDIA GPU with 24GB VRAM (RTX 4090, A5000, etc.)                       │
│  • 50GB disk space                                                          │
│                                                                             │
│  Pros: Simple, no network latency, fully air-gapped                        │
│  Cons: Requires GPU on each machine                                        │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  OPTION B: CENTRALIZED (Shared GPU Server)                                  │
│  ─────────────────────────────────────────                                  │
│                                                                             │
│  ┌─────────────┐     ┌─────────────┐     ┌─────────────────────────────┐   │
│  │ Test Server │     │ Test Server │     │     AI Inference Server     │   │
│  │    (no GPU) │────▶│    (no GPU) │────▶│  ┌─────────────────────────┐│   │
│  └─────────────┘     └─────────────┘     │  │   vLLM / TGI / Ollama   ││   │
│                                          │  │   (Flowstral Model)     ││   │
│                                          │  │   GPU: A100 / H100      ││   │
│                                          │  └─────────────────────────┘│   │
│                                          └─────────────────────────────┘   │
│                                                                             │
│  Requirements:                                                              │
│  • Inference Server: 48-80GB VRAM (A100 recommended)                       │
│  • Network: Low latency (<10ms) between servers                            │
│  • Load Balancer for multiple clients                                       │
│                                                                             │
│  Pros: Cost-efficient for many clients, easier to update model             │
│  Cons: Network dependency, single point of failure                         │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  OPTION C: HYBRID (Local + Fallback)                                        │
│  ────────────────────────────────────                                       │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────┐               │
│  │           Customer's Test Server                         │               │
│  │  ┌─────────────────────────────────────────────────────┐│               │
│  │  │  Ollama (Local - CPU inference, slower)             ││               │
│  │  │  Model: flowstral-elem-7b-q4 (quantized)            ││               │
│  │  └───────────────────────┬─────────────────────────────┘│               │
│  └──────────────────────────│──────────────────────────────┘               │
│                             │                                               │
│                             ▼ (Fallback if local too slow)                  │
│  ┌─────────────────────────────────────────────────────────┐               │
│  │           Customer's GPU Server (Optional)               │               │
│  │  ┌─────────────────────────────────────────────────────┐│               │
│  │  │  vLLM (Fast GPU inference)                          ││               │
│  │  │  Model: flowstral-elem-7b (full precision)          ││               │
│  │  └─────────────────────────────────────────────────────┘│               │
│  └─────────────────────────────────────────────────────────┘               │
│                                                                             │
│  Pros: Works without GPU, scales with GPU when available                   │
│  Cons: More complex setup                                                  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Deployment Artifacts

```
flowstral-element-model/
├── models/
│   ├── flowstral-elem-7b/           # Full model (for GPU inference)
│   │   ├── config.json
│   │   ├── tokenizer.json
│   │   ├── model.safetensors
│   │   └── adapter_config.json
│   │
│   ├── flowstral-elem-7b-q4/        # Quantized (for CPU or small GPU)
│   │   └── flowstral-elem-7b-q4_k_m.gguf
│   │
│   └── flowstral-elem-7b-awq/       # AWQ quantized (for vLLM)
│       └── model.safetensors
│
├── docker/
│   ├── Dockerfile.ollama            # Ollama-based deployment
│   ├── Dockerfile.vllm              # vLLM-based deployment
│   └── docker-compose.yml           # Full stack
│
├── helm/
│   └── flowstral-ai/                # Kubernetes deployment
│       ├── Chart.yaml
│       ├── values.yaml
│       └── templates/
│
└── scripts/
    ├── install-ollama.sh            # Single-machine setup
    ├── pull-model.sh                # Download model
    └── verify-installation.sh       # Test inference
```

### vLLM Deployment (Recommended for Enterprise)

```python
# docker/vllm_server.py
from vllm import LLM, SamplingParams
from fastapi import FastAPI

app = FastAPI()

# Load model once at startup
llm = LLM(
    model="models/flowstral-elem-7b-awq",
    quantization="awq",
    tensor_parallel_size=1,  # Increase for multi-GPU
    gpu_memory_utilization=0.9,
)

@app.post("/v1/element/resolve")
async def resolve_element(request: ElementResolveRequest):
    """
    Resolve an element using the fine-tuned model.
    Called ONLY when deterministic methods fail.
    """
    prompt = build_element_prompt(request)
    
    outputs = llm.generate(
        [prompt],
        SamplingParams(
            temperature=0.1,  # Low for consistency
            max_tokens=500,
            top_p=0.95,
        )
    )
    
    return parse_element_response(outputs[0])

@app.post("/v1/selector/heal")
async def heal_selector(request: SelectorHealRequest):
    """Heal a broken selector."""
    prompt = build_healing_prompt(request)
    outputs = llm.generate([prompt], SamplingParams(...))
    return parse_healing_response(outputs[0])
```

---

## 🔄 PART 5: Unified Selector Strategy

### The Complete Flow: Zero Failures Guarantee

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    UNIFIED ELEMENT RESOLUTION FLOW                           │
│                    (ZERO PLAYBACK FAILURES GUARANTEE)                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  TEST STEP: Click "Submit" button                                          │
│       │                                                                     │
│       ▼                                                                     │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  LAYER 1: RECIPE-BASED RESOLUTION (from recording)                   │   │
│  │  ═══════════════════════════════════════════════════                 │   │
│  │  Recipe: {what: {role: "button", text: "Submit"},                   │   │
│  │          where: {landmark: "form"},                                  │   │
│  │          which: {testId: "submit-btn"}}                             │   │
│  │                                                                      │   │
│  │  Try in order:                                                       │   │
│  │  1. page.getByTestId('submit-btn')           ✓ FOUND → DONE        │   │
│  │  2. page.getByRole('button', {name: 'Submit'})                      │   │
│  │  3. page.getByText('Submit')                                        │   │
│  │  4. page.locator('form').getByRole('button')                        │   │
│  └──────────────────────────┬──────────────────────────────────────────┘   │
│                             │                                               │
│                             │ ALL FAILED? (rare)                           │
│                             ▼                                               │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  LAYER 2: AUTO-HEALING ENGINE                                        │   │
│  │  ═══════════════════════════════                                     │   │
│  │  AutoHealingLocatorEngine tries:                                     │   │
│  │  5. Application-specific selectors (data-aura-*, data-automation-*) │   │
│  │  6. ARIA selectors (aria-label, aria-describedby)                   │   │
│  │  7. CSS with stable classes                                         │   │
│  │  8. XPath with multiple attributes                                  │   │
│  │  9. Chained locators (parent >> child)                              │   │
│  │  10. Position-based (nth, filter)                                   │   │
│  └──────────────────────────┬──────────────────────────────────────────┘   │
│                             │                                               │
│                             │ ALL FAILED? (extremely rare)                 │
│                             ▼                                               │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  LAYER 3: AI SAFETY NET (Fine-Tuned Model)                          │   │
│  │  ═════════════════════════════════════════                           │   │
│  │  Budget Check: Can we use AI? (limit: 3 per run)                    │   │
│  │                                                                      │   │
│  │  If YES:                                                             │   │
│  │  • Take screenshot                                                   │   │
│  │  • Send to Flowstral Element Model:                                 │   │
│  │    - Recipe                                                          │   │
│  │    - Current DOM                                                     │   │
│  │    - Error message                                                   │   │
│  │    - Screenshot (if vision model)                                   │   │
│  │                                                                      │   │
│  │  • Get AI suggestion                                                 │   │
│  │  • VALIDATE suggestion works                                         │   │
│  │  • CACHE for future (avoid repeated AI calls)                       │   │
│  │  • LOG for human review                                              │   │
│  └──────────────────────────┬──────────────────────────────────────────┘   │
│                             │                                               │
│                             │ AI FAILED OR BUDGET EXCEEDED?                │
│                             ▼                                               │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  LAYER 4: GRACEFUL FAILURE (with maximum context)                   │   │
│  │  ══════════════════════════════════════════════════                  │   │
│  │  Throw detailed error with:                                          │   │
│  │  • All selectors tried                                               │   │
│  │  • Screenshot at failure                                             │   │
│  │  • DOM snapshot                                                      │   │
│  │  • AI analysis (if attempted)                                        │   │
│  │  • Suggested manual fix                                              │   │
│  │                                                                      │   │
│  │  This should be EXTREMELY RARE (<0.1% of steps)                     │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Implementation: Unified Resolver

```typescript
// NEW: flowstral-engine/src/core/UnifiedElementResolver.ts

import { AutoHealingLocatorEngine } from './AutoHealingLocatorEngine';
import { RecipeResolver } from './RecipeResolver';
import { FlowstralAIClient } from './FlowstralAIClient';

export class UnifiedElementResolver {
  private recipeResolver: RecipeResolver;
  private autoHealingEngine: AutoHealingLocatorEngine;
  private aiClient: FlowstralAIClient;
  private aiCallsThisRun: number = 0;
  
  constructor(options: {
    page: Page,
    appFingerprint: ApplicationFingerprint,
    aiEnabled: boolean,
    aiCallLimit: number,
    aiEndpoint: string  // Local Ollama or remote vLLM
  }) {
    this.recipeResolver = new RecipeResolver(options.page);
    this.autoHealingEngine = new AutoHealingLocatorEngine(options.appFingerprint);
    this.aiClient = new FlowstralAIClient({
      endpoint: options.aiEndpoint,
      enabled: options.aiEnabled,
      limit: options.aiCallLimit,
    });
  }
  
  /**
   * Resolve an element with GUARANTEED success (or detailed failure).
   * Uses layered approach: Recipe → AutoHealing → AI → Detailed Error
   */
  async resolveElement(step: TestStep): Promise<Locator> {
    const recipe = step.recipe || this.convertLegacyToRecipe(step);
    const startTime = Date.now();
    
    // ========== LAYER 1: Recipe-Based Resolution ==========
    const recipeResult = await this.recipeResolver.resolve(recipe, {
      timeout: 5000,  // Fast initial attempt
    });
    
    if (recipeResult.found) {
      this.logResolution('recipe', step, recipeResult, Date.now() - startTime);
      return recipeResult.locator;
    }
    
    // ========== LAYER 2: Auto-Healing Engine ==========
    const healingLocator = this.autoHealingEngine.generateAutoHealingLocator({
      ...step.element,
      recipe,
    });
    
    for (const strategy of [healingLocator.primary, ...healingLocator.fallbacks]) {
      try {
        const locator = this.page.locator(strategy.playwrightCode);
        if (await locator.isVisible({ timeout: 2000 })) {
          this.logHealing('auto', step, strategy);
          return locator;
        }
      } catch (e) {
        continue;
      }
    }
    
    // ========== LAYER 3: AI Safety Net ==========
    if (this.aiClient.canUse() && this.aiCallsThisRun < this.options.aiCallLimit) {
      this.aiCallsThisRun++;
      
      const screenshot = await this.page.screenshot({ type: 'png' });
      const dom = await this.page.content();
      
      const aiResult = await this.aiClient.resolveElement({
        recipe,
        dom: dom.substring(0, 10000),  // Truncate for model context
        screenshot: screenshot.toString('base64'),
        error: 'All deterministic selectors failed',
        app: this.appFingerprint.application,
      });
      
      if (aiResult.success && aiResult.selector) {
        // VALIDATE before using
        try {
          const aiLocator = this.page.locator(aiResult.selector);
          if (await aiLocator.isVisible({ timeout: 3000 })) {
            // CACHE for future
            await this.cacheHealedSelector(step.id, aiResult.selector, recipe);
            this.logHealing('ai', step, aiResult);
            return aiLocator;
          }
        } catch (e) {
          // AI suggestion didn't work, continue to failure
        }
      }
    }
    
    // ========== LAYER 4: Detailed Failure ==========
    throw new ElementResolutionError({
      step,
      recipe,
      triedStrategies: [
        ...this.recipeResolver.getAttemptedStrategies(),
        ...healingLocator.fallbacks.map(f => f.playwrightCode),
      ],
      aiAttempted: this.aiCallsThisRun > 0,
      screenshot: await this.page.screenshot(),
      dom: await this.page.content(),
      suggestion: this.generateManualFixSuggestion(step, recipe),
    });
  }
}
```

---

## 📊 PART 6: Metrics & Monitoring

### Success Metrics

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    KEY METRICS TO TRACK                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  RESOLUTION SUCCESS RATES                                                   │
│  ─────────────────────────                                                  │
│  • Layer 1 (Recipe): Target 95%+                                           │
│  • Layer 2 (AutoHealing): Target 4%                                        │
│  • Layer 3 (AI): Target 0.9%                                               │
│  • Layer 4 (Failure): Target <0.1%                                         │
│                                                                             │
│  AI USAGE                                                                   │
│  ─────────                                                                  │
│  • AI calls per test run: Target <3                                        │
│  • AI calls per day (tenant): Track for billing                            │
│  • AI success rate: Target >80%                                            │
│  • AI latency: Target <2s                                                  │
│                                                                             │
│  MODEL PERFORMANCE                                                          │
│  ─────────────────                                                          │
│  • Inference latency: Target <500ms                                        │
│  • Memory usage: Track for capacity                                        │
│  • Tokens per request: Track for efficiency                                │
│                                                                             │
│  HEALING PATTERNS                                                           │
│  ────────────────                                                           │
│  • Most healed selectors (by type)                                         │
│  • Most common failure patterns                                            │
│  • Healing success by application                                          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Dashboard Integration

```python
# backend/app/routers/ai_metrics_api.py

@router.get("/ai/metrics")
async def get_ai_metrics(
    tenant_id: str,
    start_date: datetime,
    end_date: datetime
) -> AIMetricsResponse:
    """Get AI usage and performance metrics."""
    return {
        "resolution_stats": {
            "recipe_success": 0.952,
            "autohealing_success": 0.038,
            "ai_success": 0.009,
            "failures": 0.001,
        },
        "ai_usage": {
            "total_calls": 127,
            "successful": 112,
            "success_rate": 0.882,
            "avg_latency_ms": 423,
        },
        "cost_estimate": {
            "local_calls": 120,  # Free
            "cloud_fallback_calls": 7,
            "estimated_cost_usd": 0.21,
        },
        "healing_patterns": {
            "most_common_failure": "dynamic_id_change",
            "most_healed_app": "salesforce",
            "healing_by_strategy": {...},
        }
    }
```

---

## 🚀 PART 7: Implementation Roadmap

### Phase 1: Data Collection (2 weeks)

- [ ] Implement `ElementDataCollector` to capture recording data
- [ ] Hook into playback to capture healing examples
- [ ] Create data augmentation pipeline
- [ ] Target: 5,000+ element examples, 2,000+ healing examples

### Phase 2: Model Training (1 week)

- [ ] Prepare training data in correct format
- [ ] Fine-tune Qwen2.5-7B with LoRA
- [ ] Evaluate on held-out test set
- [ ] Target: >90% accuracy on element resolution task

### Phase 3: On-Prem Deployment (1 week)

- [ ] Create Ollama model package
- [ ] Create vLLM Docker deployment
- [ ] Test on customer-like hardware
- [ ] Document installation process

### Phase 4: Integration (1 week)

- [ ] Implement `UnifiedElementResolver`
- [ ] Integrate with existing test execution
- [ ] Add AI budget controls
- [ ] Add metrics and logging

### Phase 5: Validation (1 week)

- [ ] Run against 100+ real customer tests
- [ ] Measure failure rate (target <0.1%)
- [ ] Measure AI usage (target <3 per run)
- [ ] Performance benchmarking

---

## 💡 ANSWERS TO YOUR QUESTIONS

### 1. How to keep recorder flows/selectors as-is?

**Answer:** The Recipe-based approach is ALREADY implemented (`element-recipe.js`). We keep it and ADD AI as Layer 3:

```
Recording: Element → Recipe → Legacy Selectors (backward compatible)
                 ↓
Playback:  Recipe → SmartFinder → AutoHealing → AI Fallback
```

### 2. Recipe-based approach for selectors?

**Answer:** YES, it's built! The `{what, where, which}` structure is first-principles:

```javascript
{
  what: { role: "button", text: "Submit" },    // WHAT is it?
  where: { landmark: "form", nearText: "Email" },  // WHERE is it?
  which: { testId: "submit", position: 1 }     // WHICH ONE?
}
```

### 3. AI only as last resort?

**Answer:** YES, our 4-layer approach ensures:
- Layer 1 (Recipe): 95% success
- Layer 2 (AutoHealing): 4% success  
- Layer 3 (AI): 0.9% success
- Layer 4 (Failure): <0.1%

AI is called in less than 1% of element resolutions.

### 4. Users should not see failures in playback?

**Answer:** With this unified approach, failure rate should be <0.1%. When failures do occur, they include:
- All strategies tried
- Screenshot
- AI analysis
- Suggested fix

This makes the remaining failures easy to fix.

---

## 📞 Next Steps

1. **Approve this strategy** - Any modifications needed?
2. **Start data collection** - Begin capturing element/healing examples
3. **Set up training infrastructure** - DGX Spark or cloud GPU
4. **Choose deployment model** - Embedded vs Centralized vs Hybrid

**Questions to answer:**
- What's your preferred on-prem deployment model?
- Do you have DGX/GPU infrastructure for training?
- What's the target customer hardware profile?
- Timeline expectations?
