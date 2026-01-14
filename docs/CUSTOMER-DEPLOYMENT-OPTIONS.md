# Flowstral AI Deployment Options for Customers

## Quick Summary

| Option | GPU Required? | Best For | Monthly Cost |
|--------|--------------|----------|--------------|
| **Cloud API** | ❌ No | Small teams, quick start | ~$50-150 |
| **On-Prem CPU** | ❌ No | Air-gapped, privacy-first | $0 (slower) |
| **On-Prem GPU** | ✅ Yes | High volume, low latency | $0 (fast) |
| **Hybrid** | ⚡ Optional | Flexibility | ~$20-50 |

---

## Option 1: Cloud API (Recommended Start)

**Best for:** Teams getting started, small-medium test suites

```
┌─────────────────────────────────────────────────────────────────┐
│  Customer's Server                                              │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Flowstral (runs tests)                                   │  │
│  │  • All deterministic strategies run locally               │  │
│  │  • AI fallback calls cloud API (rare, <1% of actions)    │  │
│  └──────────────────────────────────────────────────────────┘  │
│                             │                                   │
│                             ▼ (only when needed)                │
│                    ┌────────────────────┐                      │
│                    │  OpenAI API        │                      │
│                    │  (GPT-4o-mini)     │                      │
│                    └────────────────────┘                      │
└─────────────────────────────────────────────────────────────────┘
```

**Requirements:**
- ✅ Any server (Windows/Linux/Mac)
- ✅ 8GB RAM minimum
- ✅ Internet access
- ✅ OpenAI API key

**Pros:**
- Zero setup - works immediately
- No special hardware
- Always latest AI model

**Cons:**
- Requires internet
- Data leaves network (only screenshots/DOM when AI needed)

**Estimated Cost:** $50-150/month (AI called <1% of actions)

---

## Option 2: On-Prem CPU (Air-Gapped)

**Best for:** Regulated industries, air-gapped environments, privacy-first

```
┌─────────────────────────────────────────────────────────────────┐
│  Customer's Server (NO GPU REQUIRED)                            │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Flowstral                                                │  │
│  │  ┌────────────────────────────────────────────────────┐  │  │
│  │  │  Ollama (Local AI)                                  │  │  │
│  │  │  Model: Qwen2.5-7B-Q4 (4-bit quantized)            │  │  │
│  │  │  • Runs on CPU only                                 │  │  │
│  │  │  • 16GB RAM needed                                  │  │  │
│  │  │  • Response time: 2-5 seconds                       │  │  │
│  │  └────────────────────────────────────────────────────┘  │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

**Requirements:**
- ✅ Any server (Windows/Linux)
- ✅ 16GB RAM minimum
- ✅ 20GB disk space
- ❌ No GPU needed
- ❌ No internet needed

**Pros:**
- Completely air-gapped
- Zero data leaves network
- Zero ongoing cost

**Cons:**
- Slower AI responses (2-5 seconds vs 0.5 seconds)
- Setup required (install Ollama + model)

**Installation:**
```bash
# 1. Install Ollama
curl -fsSL https://ollama.com/install.sh | sh

# 2. Pull quantized model (runs on CPU)
ollama pull qwen2.5:7b-instruct-q4_K_M

# 3. Configure Flowstral to use local
export FLOWSTRAL_AI_ENDPOINT="http://localhost:11434"
```

---

## Option 3: On-Prem GPU (High Performance)

**Best for:** Large enterprises, high test volume, lowest latency

```
┌─────────────────────────────────────────────────────────────────┐
│  Customer's GPU Server                                          │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Flowstral                                                │  │
│  │  ┌────────────────────────────────────────────────────┐  │  │
│  │  │  vLLM or Ollama (GPU-accelerated)                   │  │  │
│  │  │  Model: Qwen2.5-7B (full or quantized)              │  │  │
│  │  │  • Response time: 0.3-0.5 seconds                   │  │  │
│  │  │  • Can serve multiple test runners                  │  │  │
│  │  └────────────────────────────────────────────────────┘  │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

**Requirements:**
- ✅ NVIDIA GPU with 16GB+ VRAM
- ✅ Examples: RTX 4090, A4000, A5000, A100
- ✅ 32GB system RAM
- ✅ CUDA drivers

**GPU Options:**
| GPU | VRAM | Performance | Cost (approx) |
|-----|------|-------------|---------------|
| RTX 4090 | 24GB | Excellent | ~$1,600 |
| RTX A4000 | 16GB | Good | ~$1,000 |
| RTX A5000 | 24GB | Excellent | ~$2,500 |
| A100 (cloud) | 40-80GB | Best | ~$2/hour |

**Installation:**
```bash
# Using Ollama (simpler)
ollama pull qwen2.5:7b-instruct
export FLOWSTRAL_AI_ENDPOINT="http://localhost:11434"

# Using vLLM (higher performance)
pip install vllm
vllm serve Qwen/Qwen2.5-7B-Instruct --port 8000
export FLOWSTRAL_AI_ENDPOINT="http://localhost:8000/v1"
```

---

## Option 4: Hybrid (Recommended for Flexibility)

**Best for:** Most enterprise customers

```
┌─────────────────────────────────────────────────────────────────┐
│  Customer's Server                                              │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Flowstral                                                │  │
│  │  ┌────────────────────────────────────────────────────┐  │  │
│  │  │  Local Ollama (CPU)  ◀─── Try First (free)         │  │  │
│  │  │  • Works offline                                    │  │  │
│  │  │  • Handles 95% of AI needs                          │  │  │
│  │  └────────────────────────────────────────────────────┘  │  │
│  │                         │                                 │  │
│  │                         ▼ (fallback if complex)           │  │
│  │  ┌────────────────────────────────────────────────────┐  │  │
│  │  │  Cloud API (GPT-4o-mini)                           │  │  │
│  │  │  • For complex vision tasks                         │  │  │
│  │  │  • Only when local fails                            │  │  │
│  │  └────────────────────────────────────────────────────┘  │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

**Requirements:**
- ✅ Any server (16GB RAM recommended)
- ✅ Ollama installed locally
- ✅ Optional: OpenAI API key for fallback

**Configuration:**
```bash
# Set primary (local) and fallback (cloud)
export FLOWSTRAL_AI_PRIMARY="http://localhost:11434"
export FLOWSTRAL_AI_FALLBACK="https://api.openai.com/v1"
export OPENAI_API_KEY="sk-..."  # Optional fallback
```

---

## Decision Guide

### "We have no special hardware"
→ Start with **Option 1 (Cloud API)** or **Option 4 (Hybrid)**

### "We can't send data outside"
→ Use **Option 2 (On-Prem CPU)** - slower but fully air-gapped

### "We have NVIDIA GPUs available"
→ Use **Option 3 (On-Prem GPU)** - fastest, zero cost

### "We want flexibility"
→ Use **Option 4 (Hybrid)** - best of both worlds

---

## What Data Goes to AI?

**IMPORTANT:** AI is only called as a LAST RESORT (<1% of actions).

When AI IS called, it receives:
- Screenshot of current page (PNG)
- Partial DOM context (~2KB)
- Element description ("Submit button")
- Error message

**NOT sent:**
- Credentials (never in DOM)
- Full page source
- Test logic or assertions
- Historical data

---

## Bandwidth & Performance

| Scenario | AI Calls | Data/Call | Latency |
|----------|----------|-----------|---------|
| Typical test run (50 steps) | 0-1 | ~500KB | <1s |
| Complex app (100 steps) | 1-3 | ~500KB | <1s |
| AI-heavy (edge case) | 3 max | ~500KB | <1s |

**AI is capped at 3 calls per test run** to control costs.

---

## Quick Start Commands

### Cloud API (Fastest Setup)
```bash
# Just set your API key
export OPENAI_API_KEY="sk-your-key"
# That's it! AI fallback is automatic
```

### Local CPU (Air-Gapped)
```bash
# Install Ollama
curl -fsSL https://ollama.com/install.sh | sh
ollama pull qwen2.5:7b-instruct-q4_K_M
export FLOWSTRAL_AI_ENDPOINT="http://localhost:11434"
```

### Local GPU (Best Performance)
```bash
# Install Ollama (auto-detects GPU)
curl -fsSL https://ollama.com/install.sh | sh
ollama pull qwen2.5:7b-instruct
export FLOWSTRAL_AI_ENDPOINT="http://localhost:11434"
```

---

## FAQ

**Q: Do I need a GPU for Flowstral?**
A: No. GPU is optional and only improves AI response speed. All test execution works without GPU.

**Q: How much does the AI cost?**
A: With cloud API: ~$50-150/month for typical usage. AI is called <1% of actions.

**Q: Can I run completely offline?**
A: Yes. Use Option 2 (On-Prem CPU) with Ollama. Zero internet required.

**Q: What if I don't configure AI at all?**
A: Flowstral works fine! AI is only a safety net. You'll still get 99%+ success rate from deterministic strategies.
