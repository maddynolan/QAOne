# LLM Provider Configuration

## Current Setup

### Default Provider
- **ModelGateway default**: `local_qwen` (Qwen models via Ollama)
- Set via `DEFAULT_LLM_PROVIDER` environment variable (defaults to `local_qwen`)

### Service-Level Configuration

Most services use **"auto" mode** which:
1. **Tries OpenAI (gpt-4o-mini) first** ✅
2. **Falls back to Ollama (Qwen models)** if OpenAI unavailable ✅

#### Services Using "auto" Mode (OpenAI → Qwen fallback):

1. **Test Case Rewrite Service** (`TEST_CASE_LLM_PROVIDER=auto`)
   - Primary: OpenAI (gpt-4o-mini)
   - Fallback: Ollama (qwen2.5-coder:7b)

2. **API Test Service** (`API_TEST_LLM_PROVIDER=auto`)
   - Primary: OpenAI (gpt-4o-mini)
   - Fallback: Ollama (qwen2.5-coder:7b)

3. **Performance Report Service** (`PERFORMANCE_LLM_PROVIDER=auto`)
   - Primary: OpenAI (gpt-4o-mini)
   - Fallback: Ollama (qwen2.5-coder:7b)

4. **Security Report Service** (`SECURITY_LLM_PROVIDER=auto`)
   - Primary: OpenAI (gpt-4o-mini)
   - Fallback: Ollama (qwen2.5-coder:7b)

5. **Playwright Code Service** (`PLAYWRIGHT_LLM_PROVIDER=auto`)
   - Primary: OpenAI (gpt-4o-mini)
   - Fallback: Ollama (qwen2.5-coder:7b)

### Models Used

#### OpenAI
- **gpt-4o-mini**: Primary model for most tasks
- **gpt-4o**: Available for heavier tasks
- **gpt-4**: Available for complex tasks
- **o1-mini**: Used in some exploration services

#### Ollama (Local Qwen Models)
- **qwen2.5-coder:7b**: Fast model (used when `use_fast_model=True`)
- **qwen2.5-coder:14b**: Medium model
- **qwen2.5-coder:32b**: Large model
- **qwen3-coder-30b**: Via vLLM (if enabled)

## Configuration

### Environment Variables

```bash
# Default provider for ModelGateway
DEFAULT_LLM_PROVIDER=local_qwen  # or "openai"

# Service-specific providers (all default to "auto")
TEST_CASE_LLM_PROVIDER=auto      # "auto" | "openai" | "ollama"
API_TEST_LLM_PROVIDER=auto
PERFORMANCE_LLM_PROVIDER=auto
SECURITY_LLM_PROVIDER=auto
PLAYWRIGHT_LLM_PROVIDER=auto

# OpenAI API Key (required for OpenAI to work)
OPENAI_API_KEY=sk-...

# Ollama URL (default: http://localhost:11434)
OLLAMA_URL=http://localhost:11434

# Air-gapped mode (blocks external LLM calls)
AIR_GAPPED_MODE=false
```

## How "auto" Mode Works

1. **Check if OpenAI is available** (has API key and not air-gapped)
2. **If available**: Use OpenAI (gpt-4o-mini)
3. **If unavailable**: Fall back to Ollama (Qwen models)

## Summary

**Answer to your question**: 
- ✅ **Yes, most services use GPT-4o-mini as primary**
- ✅ **Yes, Qwen models (via Ollama) are the fallback**

However:
- **ModelGateway default** is `local_qwen` (if no provider specified)
- **Most individual services** use "auto" mode (OpenAI first, Qwen fallback)

## To Change Behavior

### Use OpenAI Only
```bash
TEST_CASE_LLM_PROVIDER=openai
API_TEST_LLM_PROVIDER=openai
# etc.
```

### Use Qwen Only
```bash
TEST_CASE_LLM_PROVIDER=ollama
API_TEST_LLM_PROVIDER=ollama
# etc.
```

### Use Auto (Current Default)
```bash
TEST_CASE_LLM_PROVIDER=auto  # or leave unset
```


