# LLM Cost Optimization Guide

## Overview

The QAAI platform implements a multi-layered caching system to dramatically reduce LLM API costs:

| Layer | Cost Savings | Description |
|-------|-------------|-------------|
| **Local SQLite Cache** | 100% | Identical/similar prompts return cached response |
| **Anthropic Prompt Cache** | 90% | Static system prompts cached on Anthropic's servers |
| **Semantic Cache** | ~95% | Similar (not identical) prompts hit cache |
| **Model Tiering** | 50-80% | Cheaper models for simple tasks |

## How It Works

### 1. SQLite-Backed Persistent Cache

The new `PromptCache` system (in `backend/app/services/llm/prompt_cache.py`) provides:

- **Persistent storage** - Survives server restarts (no more lost cache!)
- **Configurable TTL per task type** - Longer cache for deterministic tasks
- **Semantic matching** - Similar prompts can hit cache
- **Automatic cleanup** - Expired entries removed automatically

```
┌─────────────────────────────────────────────────────────────┐
│                     Request Flow                            │
├─────────────────────────────────────────────────────────────┤
│  1. Check SQLite cache (exact hash match)                   │
│     └── HIT? Return cached response (FREE!)                 │
│                                                             │
│  2. Check SQLite cache (normalized hash match)              │
│     └── HIT? Return cached response (FREE!)                 │
│                                                             │
│  3. Check SQLite cache (semantic/keyword match)             │
│     └── HIT? Return cached response (FREE!)                 │
│                                                             │
│  4. Call Anthropic API                                      │
│     ├── System prompt uses cache_control: ephemeral         │
│     │   └── If cached on Anthropic's side: 90% cheaper      │
│     └── Store response in SQLite cache for next time        │
└─────────────────────────────────────────────────────────────┘
```

### 2. Cache TTL by Task Type

Different tasks have different cache lifetimes:

| Task Type | TTL | Reason |
|-----------|-----|--------|
| `selector_generation` | 7 days | Selectors rarely change |
| `simple_assertion` | 7 days | Deterministic output |
| `element_description` | 7 days | Static content |
| `basic_validation` | 3 days | Semi-deterministic |
| `test_generation` | 24 hours | May need updates |
| `flow_analysis` | 24 hours | Context-dependent |
| `debugging` | 4 hours | Needs fresh analysis |
| `refactoring` | 12 hours | Code changes often |

### 3. Model Tiering

The system automatically selects the cheapest appropriate model:

| Task Complexity | Model | Cost (per 1M tokens) |
|-----------------|-------|---------------------|
| Simple (selectors, assertions) | `claude-3-haiku` | $0.25 input, $1.25 output |
| Medium (test generation) | `claude-sonnet-4` | $3 input, $15 output |
| Complex (debugging) | `claude-sonnet-4` | $3 input, $15 output |

**Cost difference**: Using Haiku for simple tasks saves ~92% vs Sonnet!

## API Endpoints

### View Cache Statistics

```bash
GET /api/llm/cache-stats
```

Returns:
```json
{
  "success": true,
  "cache_stats": {
    "session_stats": {
      "hits": 150,
      "misses": 20,
      "semantic_hits": 30,
      "hit_rate_percent": 88.24
    },
    "database_stats": {
      "total_entries": 500,
      "total_hits": 2500,
      "total_tokens_saved": 1500000
    },
    "by_task_type": {
      "selector_generation": {"count": 200, "hits": 1800},
      "test_generation": {"count": 150, "hits": 450}
    }
  }
}
```

### View Usage Statistics

```bash
GET /api/llm/usage-stats
```

Returns comprehensive stats including:
- Total API calls and costs
- Cache hit rates
- Tokens used vs saved
- Cost optimization tips

### Clear Cache

```bash
POST /api/llm/clear-cache
Content-Type: application/json

{
  "task_type": "test_generation"  // Optional - clears only this type
}
```

## Best Practices for Cost Reduction

### 1. Use Appropriate Task Types

Always specify the correct `task_type` when making LLM calls:

```python
# For simple selector generation (uses Haiku, 7-day cache)
result = await service.generate_test(
    page_context=element_html,
    user_request="Generate selector",
    task_type="selector_generation"  # <-- Important!
)

# For complex debugging (uses Sonnet, 4-hour cache)
result = await service.generate_test(
    page_context=context,
    user_request="Debug this failure",
    task_type="debugging"  # <-- Different TTL
)
```

### 2. Normalize Inputs

The cache normalizes prompts automatically, but you can help:

- Remove timestamps from prompts
- Use consistent formatting
- Avoid including session IDs or UUIDs in prompts

### 3. Enable Caching (Default)

Caching is enabled by default. Don't disable unless necessary:

```python
# Good - uses cache
result = await service.generate_test(..., use_cache=True)

# Only disable for truly unique, one-time requests
result = await service.generate_test(..., use_cache=False)
```

### 4. Batch Similar Requests

The semantic cache will match similar prompts. If generating multiple selectors for the same page, they may share cached context.

## Monitoring Costs

### Check Current Session

```bash
curl http://localhost:8000/api/llm/usage-stats
```

### Cost Estimation Formula

```
Actual Cost = (input_tokens × $3/1M) + (output_tokens × $15/1M)
             - (cache_read_tokens × $2.70/1M)  # 90% savings
             - (local_cache_hits × estimated_cost)  # 100% savings
```

### Example Savings

Scenario: 1000 test generation requests

**Without caching:**
- 1000 API calls × avg 2000 tokens = 2M tokens
- Cost: ~$36 (input + output)

**With caching (80% hit rate):**
- 200 API calls (20% misses)
- 800 local cache hits (FREE)
- 200 × 2000 = 400K tokens with 50% Anthropic cache hits
- Cost: ~$5.40 (85% savings!)

## Troubleshooting

### Cache Not Working?

1. Check if SQLite database exists:
   ```bash
   ls backend/app/services/llm/prompt_cache.db
   ```

2. Check cache stats:
   ```bash
   curl http://localhost:8000/api/llm/cache-stats
   ```

3. Verify caching is enabled in your requests

### High Costs Despite Caching?

1. Check hit rate - should be >60% for most workloads
2. Ensure you're using correct task types
3. Check if prompts are too dynamic (contain timestamps, etc.)

### Clear Cache If Needed

```bash
# Clear all
curl -X POST http://localhost:8000/api/llm/clear-cache

# Clear specific task type
curl -X POST http://localhost:8000/api/llm/clear-cache \
  -H "Content-Type: application/json" \
  -d '{"task_type": "test_generation"}'
```

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                    CachedClaudeService                        │
├──────────────────────────────────────────────────────────────┤
│  ┌────────────────┐    ┌──────────────────┐                  │
│  │ UsageTracker   │    │ LocalResponseCache│                 │
│  │ (stats/costs)  │    │ (wrapper)         │                 │
│  └────────────────┘    └────────┬─────────┘                  │
│                                 │                             │
│                    ┌────────────▼─────────────┐              │
│                    │      PromptCache         │              │
│                    │   (SQLite-backed)        │              │
│                    ├──────────────────────────┤              │
│                    │ - Exact hash matching    │              │
│                    │ - Normalized matching    │              │
│                    │ - Semantic matching      │              │
│                    │ - Per-task TTL           │              │
│                    │ - Auto-cleanup           │              │
│                    └──────────────────────────┘              │
│                                                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              Anthropic API                            │   │
│  │  (with cache_control: ephemeral for system prompts)  │   │
│  └──────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────┘
```

## Files

| File | Purpose |
|------|---------|
| `backend/app/services/llm/prompt_cache.py` | SQLite-backed persistent cache |
| `backend/app/services/llm/cached_claude_service.py` | Main Claude service with caching |
| `backend/app/services/llm/unified_llm_gateway.py` | Multi-provider gateway |
| `backend/app/routers/llm_api.py` | API endpoints for LLM operations |

## Summary

The caching system provides **80-95% cost reduction** through:

1. ✅ **Persistent SQLite cache** - survives restarts
2. ✅ **Semantic matching** - similar prompts hit cache
3. ✅ **Per-task TTL** - optimal cache lifetime
4. ✅ **Anthropic prompt caching** - 90% savings on system prompts
5. ✅ **Model tiering** - cheap models for simple tasks
6. ✅ **Automatic cleanup** - no manual maintenance needed

Monitor your costs with `/api/llm/usage-stats` and `/api/llm/cache-stats`.
