"""
LLM Configuration
Handles LLM provider configuration including air-gapped/offline mode.
"""

import os
import logging
from typing import List, Optional

logger = logging.getLogger(__name__)

# Air-gapped mode - blocks all external LLM calls
AIR_GAPPED_MODE = os.getenv("AIR_GAPPED_MODE", "false").lower() == "true"

# Allowed LLM providers based on mode
if AIR_GAPPED_MODE:
    ALLOWED_LLM_PROVIDERS = ["local_ollama", "local_vllm", "local_qwen"]
    logger.info("🔒 AIR-GAPPED MODE ENABLED - External LLM calls blocked")
else:
    ALLOWED_LLM_PROVIDERS = [
        "local_ollama",
        "local_vllm",
        "local_qwen",  # Added: Qwen models via Ollama
        "openai",
        "anthropic",
        "azure_openai"
    ]

# Provider-specific configuration
LLM_CONFIG = {
    "local_ollama": {
        "url": os.getenv("OLLAMA_URL", "http://localhost:11434"),
        "enabled": True,
        "models": {
            "7b": "qwen2.5-coder:7b",
            "14b": "qwen2.5-coder:14b",
            "32b": "qwen2.5-coder:32b"
        }
    },
    "local_vllm": {
        "url": os.getenv("VLLM_URL", "http://localhost:8000"),
        "enabled": os.getenv("VLLM_ENABLED", "false").lower() == "true",
        "models": {
            "30b": "qwen3-coder-30b"
        }
    },
    "openai": {
        "api_key": os.getenv("OPENAI_API_KEY"),
        "enabled": not AIR_GAPPED_MODE and bool(os.getenv("OPENAI_API_KEY")),
        "models": {
            "gpt4": "gpt-4",
            "gpt4o": "gpt-4o",
            "gpt4o_mini": "gpt-4o-mini",
            "o1_mini": "o1-mini"
        }
    },
    "anthropic": {
        "api_key": os.getenv("ANTHROPIC_API_KEY"),
        "enabled": not AIR_GAPPED_MODE and bool(os.getenv("ANTHROPIC_API_KEY")),
        "use_prompt_caching": os.getenv("LLM_ENABLE_PROMPT_CACHING", "true").lower() == "true",
        "models": {
            # Claude Sonnet 4 - Latest and best for coding tasks
            "claude_sonnet_4": "claude-sonnet-4-20250514",
            # Claude 3.5 Sonnet - Previous gen, still excellent
            "claude_3_5_sonnet": "claude-3-5-sonnet-20241022",
            # Claude 3 Haiku - Fast and cheap for simple tasks
            "claude_3_haiku": "claude-3-haiku-20240307",
            # Claude 3 Opus - Most capable (use sparingly, expensive)
            "claude_3_opus": "claude-3-opus-20240229"
        },
        # Default models for different task types
        "default_model": os.getenv("CLAUDE_DEFAULT_MODEL", "claude-sonnet-4-20250514"),
        "simple_model": os.getenv("CLAUDE_SIMPLE_MODEL", "claude-3-haiku-20240307"),
    },
    "azure_openai": {
        "endpoint": os.getenv("AZURE_OPENAI_ENDPOINT"),
        "api_key": os.getenv("AZURE_OPENAI_API_KEY"),
        "enabled": not AIR_GAPPED_MODE and bool(os.getenv("AZURE_OPENAI_ENDPOINT")),
        "models": {}
    }
}


def is_provider_allowed(provider: str) -> bool:
    """Check if a provider is allowed in current mode"""
    if provider not in ALLOWED_LLM_PROVIDERS:
        logger.warning(f"Provider {provider} not in allowed list: {ALLOWED_LLM_PROVIDERS}")
        return False
    
    if AIR_GAPPED_MODE and provider not in ["local_ollama", "local_vllm"]:
        logger.error(f"🔒 AIR-GAPPED MODE: Provider {provider} is blocked")
        return False
    
    return True


def get_enabled_providers() -> List[str]:
    """Get list of enabled providers"""
    enabled = []
    for provider, config in LLM_CONFIG.items():
        if is_provider_allowed(provider) and config.get("enabled", False):
            enabled.append(provider)
    return enabled


def validate_provider(provider: str) -> bool:
    """
    Validate that a provider can be used.
    Raises exception in air-gapped mode if external provider requested.
    """
    if not is_provider_allowed(provider):
        if AIR_GAPPED_MODE:
            raise ValueError(
                f"Air-gapped mode enabled. Provider '{provider}' is not allowed. "
                f"Only local providers (local_ollama, local_vllm) are permitted."
            )
        else:
            raise ValueError(f"Provider '{provider}' is not enabled or configured.")
    
    return True


# Log configuration on startup
if AIR_GAPPED_MODE:
    logger.info("=" * 60)
    logger.info("🔒 AIR-GAPPED MODE ACTIVE")
    logger.info("   All external LLM calls are blocked")
    logger.info(f"   Allowed providers: {ALLOWED_LLM_PROVIDERS}")
    logger.info("=" * 60)
else:
    logger.info(f"LLM Configuration: Allowed providers: {ALLOWED_LLM_PROVIDERS}")

