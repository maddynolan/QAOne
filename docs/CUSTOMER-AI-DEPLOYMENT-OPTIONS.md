# Customer AI Deployment Options

## Overview

This document outlines deployment options for customers who want to run AI-powered features on-premise or in their own cloud infrastructure.

---

## Quick Decision Guide

```
┌─────────────────────────────────────────────────────────────────────────────┐
│              WHICH DEPLOYMENT OPTION IS RIGHT FOR YOUR CUSTOMER?            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Q1: Can they use cloud APIs (OpenAI, Azure OpenAI)?                       │
│      YES → OPTION 1: Cloud API (Simplest)                                  │
│      NO  → Continue...                                                     │
│                                                                             │
│  Q2: Do they have GPU servers?                                             │
│      YES → OPTION 2: On-Prem GPU (Best Performance)                        │
│      NO  → Continue...                                                     │
│                                                                             │
│  Q3: Do they have modern CPU servers (16+ cores)?                          │
│      YES → OPTION 3: CPU-Only (Slower but Works)                           │
│      NO  → OPTION 4: Hybrid (Cloud for AI, On-Prem for Data)               │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Option 1: Cloud API (Recommended for Most)

**Best For:** Most customers, fastest time-to-value

### Configuration
```yaml
AI_PROVIDER: "openai"  # or "azure_openai"
AI_MODEL: "gpt-4o-mini"
AI_API_KEY: "sk-..."
```

### Costs (GPT-4o-mini)
| Usage | Monthly Cost |
|-------|--------------|
| Light (100 AI calls/month) | ~$1.50 |
| Medium (1,000 AI calls/month) | ~$15 |
| Heavy (10,000 AI calls/month) | ~$150 |

### Pros
- ✅ Zero infrastructure required
- ✅ Best model quality
- ✅ Automatic updates
- ✅ No maintenance

### Cons
- ❌ Data leaves customer network
- ❌ Internet required
- ❌ Usage-based costs

### Azure OpenAI (Enterprise)
For customers with Microsoft contracts:
```yaml
AI_PROVIDER: "azure_openai"
AZURE_OPENAI_ENDPOINT: "https://your-resource.openai.azure.com/"
AZURE_OPENAI_KEY: "..."
AZURE_OPENAI_DEPLOYMENT: "gpt-4o-mini"
```

---

## Option 2: On-Premise GPU (Enterprise)

**Best For:** Air-gapped environments, strict data compliance

### Hardware Requirements

| Tier | GPU | VRAM | Model Size | Performance |
|------|-----|------|------------|-------------|
| **Good** | RTX 4090 | 24GB | 7B | ~30 tok/s |
| **Better** | A10 | 24GB | 7B-13B | ~40 tok/s |
| **Best** | A100 | 40-80GB | 7B-70B | ~100 tok/s |
| **Enterprise** | H100 | 80GB | 70B+ | ~200 tok/s |

### Software Stack
```
┌─────────────────────────────────────────┐
│         Flowstral Test Platform          │
├─────────────────────────────────────────┤
│              AI Services                 │
│  - Element Resolution                    │
│  - Failure Analysis                      │
│  - Visual Testing                        │
├─────────────────────────────────────────┤
│           vLLM / Ollama                  │
│      (Model Serving Layer)               │
├─────────────────────────────────────────┤
│           NVIDIA Drivers                 │
│           CUDA 12.x                      │
├─────────────────────────────────────────┤
│              Linux OS                    │
│         (Ubuntu 22.04 LTS)               │
└─────────────────────────────────────────┘
```

### Recommended Models for On-Prem

| Use Case | Model | Size | Notes |
|----------|-------|------|-------|
| **General** | Qwen2.5-7B-Instruct | 7B | Best quality/speed ratio |
| **Code-focused** | CodeLlama-13B | 13B | Better for test generation |
| **Enterprise** | Mixtral-8x7B | 47B | Near GPT-4 quality |
| **Fine-tuned** | Flowstral-7B (ours) | 7B | Optimized for test automation |

### Installation (Docker)
```bash
# Pull and run vLLM
docker run -d --gpus all \
  -p 8001:8000 \
  -v /path/to/models:/models \
  vllm/vllm-openai:latest \
  --model Qwen/Qwen2.5-7B-Instruct \
  --dtype half \
  --max-model-len 8192

# Configure Flowstral
AI_PROVIDER: "vllm"
VLLM_URL: "http://localhost:8001/v1"
```

### Costs (One-Time)
| Component | Cost Range |
|-----------|------------|
| GPU Server (RTX 4090) | $3,000-5,000 |
| GPU Server (A10) | $8,000-12,000 |
| GPU Server (A100) | $15,000-25,000 |
| Software (Open Source) | $0 |

### Pros
- ✅ Data never leaves network
- ✅ No per-call costs
- ✅ Works air-gapped
- ✅ Customizable models

### Cons
- ❌ Upfront hardware cost
- ❌ Maintenance required
- ❌ May need GPU expertise

---

## Option 3: CPU-Only On-Premise

**Best For:** Limited budget, existing server infrastructure

### Hardware Requirements
| Tier | CPU | RAM | Model Size | Performance |
|------|-----|-----|------------|-------------|
| **Minimum** | 8 cores | 16GB | 7B (Q4) | ~5 tok/s |
| **Recommended** | 16 cores | 32GB | 7B | ~10 tok/s |
| **Better** | 32+ cores | 64GB | 13B | ~8 tok/s |

### Software: Ollama (Simplest)
```bash
# Install Ollama
curl -fsSL https://ollama.com/install.sh | sh

# Pull model (quantized for CPU)
ollama pull qwen2.5:7b-instruct-q4_K_M

# Run
ollama serve

# Configure Flowstral
AI_PROVIDER: "ollama"
OLLAMA_URL: "http://localhost:11434"
OLLAMA_MODEL: "qwen2.5:7b-instruct-q4_K_M"
```

### Quantization Options (Speed vs Quality)
| Quantization | RAM Required | Speed | Quality |
|--------------|--------------|-------|---------|
| Q4_K_M | 4-5GB | Fast | Good |
| Q5_K_M | 5-6GB | Medium | Better |
| Q8_0 | 8-9GB | Slow | Best |
| FP16 (GPU) | 14GB | Fastest | Original |

### Pros
- ✅ Works on existing servers
- ✅ No GPU required
- ✅ Free software
- ✅ Easy setup

### Cons
- ❌ 5-10x slower than GPU
- ❌ May impact test execution time
- ❌ Limited model size

### Performance Expectations
| Task | GPU Time | CPU Time |
|------|----------|----------|
| Element healing | 200ms | 2s |
| Failure analysis | 500ms | 5s |
| Batch of 10 failures | 5s | 50s |

**Recommendation:** CPU is viable for low-volume AI usage (< 50 calls/day).

---

## Option 4: Hybrid (Recommended for Complex Requirements)

**Best For:** Need data control + good performance

### Architecture
```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         CUSTOMER ENVIRONMENT                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────┐              ┌─────────────────────┐              │
│  │   Flowstral Core    │              │   AI Proxy Service  │              │
│  │  (On-Premise)       │◄────────────►│   (On-Premise)      │              │
│  │                     │              │                     │              │
│  │  • Test Storage     │              │  • Data Anonymizer  │              │
│  │  • Execution        │              │  • Rate Limiter     │              │
│  │  • Results          │              │  • Audit Logger     │              │
│  │  • Screenshots      │              │  • Fallback Handler │              │
│  └─────────────────────┘              └──────────┬──────────┘              │
│                                                  │                         │
│                                                  │ HTTPS (anonymized)      │
│                                                  ▼                         │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                        DMZ / Firewall                                │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                  │                         │
└──────────────────────────────────────────────────┼─────────────────────────┘
                                                   │
                                                   ▼
                                    ┌─────────────────────────┐
                                    │    Cloud AI Service     │
                                    │  (OpenAI / Azure)       │
                                    │                         │
                                    │  Only receives:         │
                                    │  • Anonymized queries   │
                                    │  • No screenshots       │
                                    │  • No DOM snapshots     │
                                    └─────────────────────────┘
```

### AI Proxy Service Features
1. **Data Anonymization** - Strips PII before sending to cloud
2. **Screenshot Processing** - Blurs sensitive areas locally
3. **Query Caching** - Avoids duplicate AI calls
4. **Audit Logging** - Tracks all AI usage
5. **Fallback** - Uses local model if cloud unavailable

### Configuration
```yaml
# Hybrid mode
AI_PROVIDER: "hybrid"

# Primary: Cloud (fast, high quality)
AI_PRIMARY_PROVIDER: "azure_openai"
AZURE_OPENAI_ENDPOINT: "https://..."

# Fallback: Local (air-gapped backup)
AI_FALLBACK_PROVIDER: "ollama"
OLLAMA_URL: "http://localhost:11434"

# Proxy settings
AI_PROXY_ANONYMIZE: true
AI_PROXY_BLUR_SCREENSHOTS: true
AI_PROXY_AUDIT: true
```

---

## Comparison Summary

| Feature | Cloud API | GPU On-Prem | CPU On-Prem | Hybrid |
|---------|-----------|-------------|-------------|--------|
| **Setup Time** | 5 min | 2-4 hours | 30 min | 1-2 hours |
| **Monthly Cost** | $15-150 | $0 (after HW) | $0 | $5-50 |
| **Hardware Cost** | $0 | $3K-25K | $0 | $0 |
| **Performance** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐⭐ |
| **Data Privacy** | ⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| **Air-Gapped** | ❌ | ✅ | ✅ | Partial |
| **Maintenance** | None | High | Low | Medium |

---

## Recommendations by Customer Type

### Startups / SMB
→ **Option 1: Cloud API (OpenAI)**
- Fast to start
- Pay-as-you-go
- Best model quality

### Enterprise (Standard)
→ **Option 1: Azure OpenAI**
- Enterprise agreements
- Data residency options
- SOC 2 compliance

### Enterprise (Strict Compliance)
→ **Option 2: GPU On-Prem** or **Option 4: Hybrid**
- Full data control
- Audit trails
- Air-gapped option

### Government / Defense
→ **Option 2: GPU On-Prem**
- Complete isolation
- Custom models
- No external dependencies

### Budget-Constrained
→ **Option 3: CPU On-Prem** (with Ollama)
- Zero cost
- Acceptable for low volume
- Easy upgrade path to GPU later

---

## DGX Spark Deployment (Your Hardware)

Since you have NVIDIA DGX Spark:

### Specs
- GPU: NVIDIA Grace Hopper (H100 class)
- Memory: 128GB unified memory
- Perfect for: Fine-tuning + serving large models

### Recommended Setup
```bash
# Use vLLM for maximum performance
docker run -d --gpus all \
  -p 8001:8000 \
  vllm/vllm-openai:latest \
  --model Qwen/Qwen2.5-7B-Instruct \
  --dtype bfloat16 \
  --tensor-parallel-size 1 \
  --max-model-len 16384

# Or run our fine-tuned model
docker run -d --gpus all \
  -p 8001:8000 \
  vllm/vllm-openai:latest \
  --model /path/to/flowstral-7b-finetuned \
  --dtype bfloat16
```

### Fine-tuning on DGX Spark
```bash
# Transfer training data
scp training_data.jsonl dgx:/data/

# Run fine-tuning
python finetune_lora.py \
  --model Qwen/Qwen2.5-7B-Instruct \
  --data /data/training_data.jsonl \
  --output /models/flowstral-7b \
  --lora_rank 16 \
  --epochs 3
```

---

## Questions for Customer Discovery

Before recommending a deployment option, ask:

1. **Data Sensitivity**
   - Can test data (screenshots, DOM) leave the network?
   - Are there compliance requirements (HIPAA, SOC2, FedRAMP)?

2. **Infrastructure**
   - Do you have GPU servers available?
   - What's your typical server spec (CPU, RAM)?
   - Is internet access available from test environments?

3. **Usage Volume**
   - How many test failures per day need AI analysis?
   - How many element healing attempts expected?

4. **Budget**
   - Is there budget for cloud AI services?
   - Is there budget for GPU hardware?

5. **Timeline**
   - How soon do you need AI features?
   - Is there time for hardware procurement?

---

## Support & Next Steps

1. **For Cloud Deployment:** Share API key setup guide
2. **For On-Prem GPU:** Schedule infrastructure review call
3. **For CPU-Only:** Provide Ollama quickstart guide
4. **For Hybrid:** Custom architecture design session

Contact: [Your support email]
