"""
LLM services package

Contains LLM-related services for the QAAI platform.

=============================================================================
✅ ACTIVE SERVICES:
- openai_service: OpenAI gpt-4o-mini for test case formatting (PRODUCT)
- cached_claude_service: Claude API with caching (DEVELOPMENT USE ONLY)

❌ DISABLED SERVICES (DGX infrastructure not ready):
- ollama_service: Ollama API integration - Set ENABLE_OLLAMA_SERVICE=true
- vllm_service: vLLM integration - Set ENABLE_VLLM_SERVICE=true  
- model_registry: Fine-tuned model tracking - Set ENABLE_MODEL_REGISTRY=true
- model_gateway: Routes to local_qwen when DGX ready, defaults to OpenAI now

To enable local services when DGX is ready, add to .env:
    ENABLE_OLLAMA_SERVICE=true
    ENABLE_VLLM_SERVICE=true
    ENABLE_MODEL_REGISTRY=true
=============================================================================
"""

__all__ = [
    # Active services
    "openai_service",
    "cached_claude_service",
]



