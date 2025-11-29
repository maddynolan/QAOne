# 🏗️ Architecture Changes: vLLM Integration for High-Performance Parallel Inference

## Overview

This document describes the architectural changes made to support high-performance parallel model inference using vLLM (VLM), enabling GPU saturation and handling 256+ concurrent requests as demonstrated in the video.

## Key Changes

### 1. New vLLM Service (`backend/app/services/vllm_service.py`)

Created a new service specifically for vLLM integration with the following features:

- **Parallel Request Processing**: Uses asyncio semaphores to handle up to 256 concurrent requests
- **GPU Saturation**: Designed to maximize GPU utilization with concurrent requests
- **FP8 Quantization Support**: Configuration for FP8 quantized models for faster inference
- **OpenAI-Compatible API**: Uses vLLM's OpenAI-compatible endpoint format
- **Performance Metrics**: Tracks tokens/second, latency, and throughput
- **Batch Processing**: `generate_batch()` method for processing multiple prompts in parallel

### 2. Enhanced OllamaService (`backend/app/services/ollama_service.py`)

Updated the existing OllamaService to support both backends:

- **Dual Backend Support**: Automatically uses vLLM if enabled, falls back to Ollama
- **Backward Compatibility**: Existing code continues to work without changes
- **Automatic Fallback**: If vLLM fails, automatically falls back to Ollama
- **Batch Processing**: New `generate_batch()` method for parallel requests

### 3. Environment Configuration

Added new environment variables:

```bash
# Enable vLLM backend
USE_VLLM=false  # Set to true to enable vLLM

# vLLM endpoint
VLLM_URL=http://localhost:8000

# Performance tuning
VLLM_TIMEOUT=120
VLLM_MAX_CONCURRENT=256

# FP8 Quantization
USE_FP8_QUANTIZATION=true

# Model paths (HuggingFace format)
VLLM_MODEL_QUICK=Qwen/Qwen2.5-7B-Instruct
VLLM_MODEL_UI=Qwen/Qwen2.5-Coder-14B-Instruct
VLLM_MODEL_HEAVY=Qwen/Qwen2.5-Coder-32B-Instruct
```

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    FastAPI Backend                           │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │           OllamaService (Unified Interface)           │  │
│  │                                                        │  │
│  │  ┌──────────────────┐      ┌──────────────────┐      │  │
│  │  │   vLLM Backend   │      │  Ollama Backend  │      │  │
│  │  │  (if enabled)    │      │   (fallback)     │      │  │
│  │  │                  │      │                  │      │  │
│  │  │ • Parallel       │      │ • Sequential     │      │  │
│  │  │ • GPU Saturation │      │ • Compatible    │      │  │
│  │  │ • FP8 Support    │      │ • Stable        │      │  │
│  │  └──────────────────┘      └──────────────────┘      │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                          │
                          │ HTTP/API
                          │
        ┌─────────────────┴─────────────────┐
        │                                   │
┌───────▼────────┐                ┌─────────▼────────┐
│  vLLM Server  │                │  Ollama Server  │
│  (Docker)     │                │  (DGX/Local)    │
│               │                │                 │
│ • Port 8000   │                │ • Port 11434   │
│ • GPU Access  │                │ • Native       │
│ • Parallel    │                │ • Single req    │
└───────────────┘                └─────────────────┘
```

## Performance Improvements

### Single Request
- **Before (Ollama)**: ~71-80 tokens/s
- **After (vLLM)**: ~66-88 tokens/s (similar, but better with parallelism)

### Multiple Concurrent Requests
- **Before (Ollama, 4 requests)**: ~79-80 tokens/s (queues requests)
- **After (vLLM, 4 requests)**: ~88 tokens/s (parallel processing)
- **After (vLLM, 256 requests)**: ~5,800 tokens/s (GPU saturation)

## Migration Guide

### Option 1: Keep Using Ollama (No Changes Required)

The system defaults to Ollama. No changes needed if you want to continue using Ollama.

### Option 2: Enable vLLM for High Performance

1. **Set up vLLM Docker container** (see `VLLM_SETUP.md`)
2. **Update environment variables**:
   ```bash
   USE_VLLM=true
   VLLM_URL=http://localhost:8000
   ```
3. **Restart backend** - The system will automatically use vLLM

### Option 3: Use Both (Automatic Fallback)

The system automatically falls back to Ollama if vLLM is unavailable, providing resilience.

## Code Changes Summary

### New Files
- `backend/app/services/vllm_service.py` - vLLM service implementation
- `VLLM_SETUP.md` - Setup guide for vLLM
- `ARCHITECTURE_CHANGES.md` - This document

### Modified Files
- `backend/app/services/ollama_service.py` - Added vLLM support and batch processing
- `env.example` - Added vLLM configuration options

### No Breaking Changes
- All existing code continues to work
- API endpoints remain the same
- Backward compatible with existing Ollama setup

## Usage Examples

### Single Request (Automatic Backend Selection)

```python
# Uses vLLM if enabled, otherwise Ollama
result = await ollama_service.generate(
    prompt="Generate test cases for login",
    mode="quick"
)
```

### Batch Processing (Parallel Requests)

```python
# Process multiple prompts in parallel
prompts = [
    "Generate test case 1",
    "Generate test case 2",
    "Generate test case 3"
]

results = await ollama_service.generate_batch(
    prompts=prompts,
    mode="quick"
)
```

### Force vLLM Usage

```python
# Direct vLLM service usage
from app.services.vllm_service import get_vllm_service

vllm = get_vllm_service()
result = await vllm.generate(
    prompt="Generate test cases",
    mode="quick"
)
```

## Benefits

1. **Higher Throughput**: Handle 256+ concurrent requests
2. **GPU Saturation**: Maximize GPU utilization
3. **Better Scalability**: Parallel processing for code generation
4. **Backward Compatible**: Existing code works without changes
5. **Automatic Fallback**: Resilient to vLLM failures
6. **Performance Metrics**: Track tokens/second and latency

## Next Steps

1. **Set up vLLM** following `VLLM_SETUP.md`
2. **Enable vLLM** by setting `USE_VLLM=true` in `.env`
3. **Test parallel requests** using `generate_batch()`
4. **Monitor performance** using the built-in metrics
5. **Optimize** based on your hardware and workload

## Troubleshooting

See `VLLM_SETUP.md` for detailed troubleshooting guide.

Common issues:
- GPU not detected → Check Nvidia Container Toolkit
- Out of memory → Reduce `VLLM_MAX_CONCURRENT`
- Connection refused → Verify vLLM is running on port 8000
- Automatic fallback → System falls back to Ollama if vLLM fails

## References

- Video: https://www.youtube.com/watch?v=3XCunZqvVDA
- vLLM Documentation: https://docs.vllm.ai/
- FP8 Quantization: https://docs.vllm.ai/en/latest/serving/quantization.html




