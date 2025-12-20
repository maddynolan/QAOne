"""
vLLM Service for High-Performance Parallel Model Inference
Supports FP8 quantization and concurrent request handling for GPU saturation
Based on vLLM (VLM) architecture for maximum throughput

=============================================================================
DISABLED: DGX Spark / vLLM infrastructure not ready
This service requires DGX hardware with vLLM server running.
When DGX is ready, set ENABLE_VLLM_SERVICE=true in .env
=============================================================================
"""

import asyncio
import aiohttp
import logging
import json
import os
from typing import Dict, List, Any, Optional
from enum import Enum
import time

logger = logging.getLogger(__name__)

# ============================================================================
# DISABLED FLAG - Set to True when DGX/vLLM infrastructure is ready
# ============================================================================
VLLM_SERVICE_ENABLED = os.getenv("ENABLE_VLLM_SERVICE", "false").lower() == "true"

if not VLLM_SERVICE_ENABLED:
    logger.info("[DISABLED] vLLM service - DGX infrastructure not ready (set ENABLE_VLLM_SERVICE=true when ready)")

class ModelMode(str, Enum):
    """Model selection based on task complexity"""
    QUICK = "quick"  # 7B model
    UI = "ui"  # 14B model  
    HEAVY = "heavy"  # 32B model


class VLLMService:
    """
    High-performance vLLM service with parallel request support
    Optimized for GPU saturation and concurrent code generation
    
    DISABLED: DGX/vLLM infrastructure not ready. Enable with ENABLE_VLLM_SERVICE=true
    """
    
    def __init__(self):
        # ============================================================================
        # CHECK IF SERVICE IS ENABLED
        # ============================================================================
        self.enabled = VLLM_SERVICE_ENABLED
        if not self.enabled:
            self.session = None
            return  # Skip all initialization when disabled
        
        # vLLM endpoint (typically running in Docker)
        self.vllm_base_url = os.getenv("VLLM_URL", "http://localhost:8000")
        self.vllm_api_url = f"{self.vllm_base_url}/v1/completions"
        self.vllm_chat_url = f"{self.vllm_base_url}/v1/chat/completions"
        
        # Session for concurrent requests
        self.session: Optional[aiohttp.ClientSession] = None
        
        # Timeout configuration (vLLM is typically faster with parallelism)
        self.timeout = int(os.getenv("VLLM_TIMEOUT", "120"))  # 2 minutes default
        
        # Parallel request configuration
        self.max_concurrent_requests = int(os.getenv("VLLM_MAX_CONCURRENT", "256"))
        self.semaphore = asyncio.Semaphore(self.max_concurrent_requests)
        
        # Model mapping with FP8 quantization support
        # Default to qwen3-coder:30b since old models deleted
        self.finetuned_model = os.getenv("FINETUNED_MODEL_NAME", "qwen3-coder:30b")
        # Default to false since fine-tuned model (qa-expert:7b) was deleted
        self.use_finetuned = os.getenv("USE_FINETUNED_MODEL", "false").lower() == "true"
        
        # Model mapping - supports FP8 quantized models
        # Format: model_name or model_name-fp8 for quantized versions
        self.model_map = {
            ModelMode.QUICK: os.getenv("VLLM_MODEL_QUICK", "Qwen/Qwen2.5-7B-Instruct"),
            ModelMode.UI: os.getenv("VLLM_MODEL_UI", "Qwen/Qwen2.5-Coder-14B-Instruct"),
            ModelMode.HEAVY: os.getenv("VLLM_MODEL_HEAVY", "Qwen/Qwen2.5-Coder-32B-Instruct")
        }
        
        # FP8 quantization flag
        self.use_fp8 = os.getenv("USE_FP8_QUANTIZATION", "true").lower() == "true"
        
        # If FP8 is enabled, append -fp8 to model names (if not already present)
        if self.use_fp8:
            for mode in self.model_map:
                model_name = self.model_map[mode]
                if "-fp8" not in model_name.lower() and "-fp4" not in model_name.lower():
                    logger.debug(f"FP8 quantization enabled for {mode} mode")
        
        # If fine-tuned model is enabled, use it for QUICK mode
        if self.use_finetuned:
            self.model_map[ModelMode.QUICK] = self.finetuned_model
            logger.debug(f"Fine-tuned model enabled: {self.finetuned_model}")
        
        # Use vLLM backend flag
        self.use_vllm = os.getenv("USE_VLLM", "false").lower() == "true"
        
        logger.debug(f"VLLMService initialized - URL: {self.vllm_base_url}")
    
    async def initialize(self):
        """Initialize HTTP session with connection pooling for parallelism"""
        if not self.session:
            # Use connector with higher limits for parallel requests
            connector = aiohttp.TCPConnector(
                limit=self.max_concurrent_requests,
                limit_per_host=self.max_concurrent_requests,
                ttl_dns_cache=300,
                force_close=False
            )
            timeout = aiohttp.ClientTimeout(total=self.timeout)
            self.session = aiohttp.ClientSession(
                connector=connector,
                timeout=timeout
            )
    
    async def cleanup(self):
        """Cleanup HTTP session"""
        if self.session:
            await self.session.close()
            self.session = None
    
    def _select_model(self, mode: Optional[str] = None, task_type: Optional[str] = None, use_fast_model: bool = False) -> str:
        """Select model based on mode and task type"""
        # Note: This is a sync method, so we can't await async calls
        # Fine-tuned model lookup would need to be done in async context
        # For now, skip registry lookup in sync context
        
        # Priority 2: Use fine-tuned model if enabled and mode is quick
        if self.use_finetuned and (not mode or mode == ModelMode.QUICK.value or mode == "quick"):
            logger.debug(f"Using fine-tuned model: {self.finetuned_model}")
            return self.finetuned_model
        
        # Fallback to base model selection
        if not mode:
            mode = ModelMode.UI.value
        
        mode_enum = ModelMode(mode) if mode in [m.value for m in ModelMode] else ModelMode.UI
        selected_model = self.model_map.get(mode_enum, self.model_map[ModelMode.UI])
        logger.debug(f"Using model: {selected_model} (mode: {mode})")
        return selected_model
    
    async def generate(
        self,
        prompt: str,
        mode: Optional[str] = None,
        max_retries: int = 3,
        validate_json: bool = True,
        task_type: Optional[str] = None,
        temperature: float = 0.7,
        top_p: float = 0.9,
        max_tokens: Optional[int] = None,
        use_fast_model: bool = False
    ) -> Dict[str, Any]:
        """
        Generate response from vLLM with parallel request support
        
        Args:
            prompt: The prompt to send to the model
            mode: Model mode (quick/ui/heavy)
            max_retries: Maximum retries for JSON validation
            validate_json: Whether to validate and retry on invalid JSON
            task_type: Type of task for model selection
            temperature: Sampling temperature
            top_p: Top-p sampling parameter
            max_tokens: Maximum tokens to generate
            
        Returns:
            Dict containing 'response' text and 'model' used
        """
        # ============================================================================
        # DISABLED CHECK - Return empty response when service is disabled
        # ============================================================================
        if not self.enabled:
            logger.warning("VLLMService.generate() called but service is DISABLED")
            return {
                "response": "",
                "model": "vllm_disabled",
                "error": "vLLM service disabled - DGX infrastructure not ready. Set ENABLE_VLLM_SERVICE=true"
            }
        
        if not self.session:
            await self.initialize()
        
        model = self._select_model(mode, task_type=task_type, use_fast_model=use_fast_model)
        
        # If use_fast_model is True, prefer 7B model
        if use_fast_model:
            # Check if 7B model is available in model_map
            if ModelMode.QUICK in self.model_map:
                quick_model = self.model_map[ModelMode.QUICK]
                # If quick model is 7B or smaller, use it
                if "7b" in quick_model.lower() or "7B" in quick_model:
                    model = quick_model
                    logger.debug(f"Using fast 7B model for test cases: {model}")
        
        # Use semaphore to control concurrent requests
        async with self.semaphore:
            for attempt in range(max_retries):
                try:
                    # vLLM uses OpenAI-compatible API format
                    payload = {
                        "model": model,
                        "prompt": prompt,
                        "temperature": temperature,
                        "top_p": top_p,
                        "max_tokens": max_tokens or 2000,
                        "stop": None,
                        "stream": False
                    }
                    
                    start_time = time.time()
                    async with self.session.post(
                        self.vllm_api_url,
                        json=payload
                    ) as response:
                        if response.status != 200:
                            error_text = await response.text()
                            raise Exception(f"vLLM API error: {response.status} - {error_text}")
                        
                        data = await response.json()
                        latency_ms = int((time.time() - start_time) * 1000)
                        
                        # vLLM response format
                        choices = data.get("choices", [])
                        if not choices:
                            raise Exception("No choices in vLLM response")
                        
                        response_text = choices[0].get("text", "")
                        actual_model_used = data.get("model", model)
                        
                        # Log performance metrics
                        usage = data.get("usage", {})
                        tokens_generated = usage.get("completion_tokens", 0)
                        tokens_per_second = tokens_generated / (latency_ms / 1000.0) if latency_ms > 0 else 0
                        
                        logger.info(
                            f"vLLM Response - Model: {actual_model_used}, "
                            f"Latency: {latency_ms}ms, "
                            f"Tokens: {tokens_generated}, "
                            f"Throughput: {tokens_per_second:.1f} tokens/s"
                        )
                        
                        if "qa-expert" in actual_model_used.lower():
                            logger.debug(f"Using trained model: {actual_model_used}")
                        else:
                            logger.debug(f"Using base model: {actual_model_used}")
                        
                        # Validate JSON if requested
                        if validate_json:
                            json_text = response_text.strip()
                            
                            # Remove markdown code blocks
                            if "```json" in json_text:
                                parts = json_text.split("```json")
                                if len(parts) > 1:
                                    json_text = parts[1].split("```")[0].strip()
                            elif "```" in json_text:
                                parts = json_text.split("```")
                                for part in parts:
                                    part = part.strip()
                                    if part.startswith("[") or part.startswith("{"):
                                        json_text = part
                                        break
                            
                            # Find JSON array boundaries
                            start_idx = json_text.find('[')
                            end_idx = json_text.rfind(']')
                            if start_idx != -1 and end_idx != -1 and end_idx > start_idx:
                                json_text = json_text[start_idx:end_idx+1]
                            
                            try:
                                parsed = json.loads(json_text)
                                return {
                                    "response": json_text,
                                    "model": actual_model_used,
                                    "raw_response": data,
                                    "latency_ms": latency_ms,
                                    "tokens_per_second": tokens_per_second,
                                    "tokens_generated": tokens_generated
                                }
                            except json.JSONDecodeError as e:
                                if attempt < max_retries - 1:
                                    logger.warning(f"Invalid JSON on attempt {attempt + 1}, retrying...")
                                    prompt = f"""{prompt}

Your previous answer was not valid JSON. Please respond with ONLY a valid JSON array. No explanations, no markdown, no text. Just the JSON array starting with [ and ending with ]."""
                                    continue
                                else:
                                    logger.error(f"Failed to get valid JSON after retries. Response: {response_text[:200]}")
                                    raise Exception(f"Failed to get valid JSON response from model. Last response: {response_text[:200]}")
                        else:
                            return {
                                "response": response_text,
                                "model": actual_model_used,
                                "raw_response": data,
                                "latency_ms": latency_ms,
                                "tokens_per_second": tokens_per_second,
                                "tokens_generated": tokens_generated
                            }
                            
                except asyncio.TimeoutError:
                    if attempt < max_retries - 1:
                        logger.warning(f"Timeout on attempt {attempt + 1}, retrying...")
                        await asyncio.sleep(2)
                        continue
                    else:
                        raise Exception("vLLM API timeout after retries")
                except Exception as e:
                    if attempt < max_retries - 1:
                        logger.warning(f"Error on attempt {attempt + 1}: {str(e)}, retrying...")
                        await asyncio.sleep(2)
                        continue
                    else:
                        raise
    
    async def generate_batch(
        self,
        prompts: List[str],
        mode: Optional[str] = None,
        task_type: Optional[str] = None,
        temperature: float = 0.7,
        top_p: float = 0.9
    ) -> List[Dict[str, Any]]:
        """
        Generate responses for multiple prompts in parallel
        This enables GPU saturation with concurrent requests
        
        Args:
            prompts: List of prompts to process
            mode: Model mode (quick/ui/heavy)
            task_type: Type of task for model selection
            temperature: Sampling temperature
            top_p: Top-p sampling parameter
            
        Returns:
            List of response dicts
        """
        tasks = [
            self.generate(
                prompt=prompt,
                mode=mode,
                validate_json=False,
                task_type=task_type,
                temperature=temperature,
                top_p=top_p
            )
            for prompt in prompts
        ]
        
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # Handle exceptions
        processed_results = []
        for i, result in enumerate(results):
            if isinstance(result, Exception):
                logger.error(f"Error processing prompt {i}: {str(result)}")
                processed_results.append({
                    "response": "",
                    "model": "error",
                    "error": str(result)
                })
            else:
                processed_results.append(result)
        
        return processed_results
    
    async def generate_json(
        self,
        prompt: str,
        mode: Optional[str] = None,
        max_retries: int = 3
    ) -> Dict[str, Any]:
        """
        Generate and parse JSON response
        
        Returns:
            Parsed JSON as dict, or list, with model info attached
        """
        result = None
        try:
            result = await self.generate(prompt, mode, max_retries, validate_json=True)
            parsed = json.loads(result["response"])
            
            # Attach model info to result for logging
            if isinstance(parsed, dict):
                parsed["_model_used"] = result.get("model", "unknown")
                parsed["_latency_ms"] = result.get("latency_ms", 0)
                parsed["_tokens_per_second"] = result.get("tokens_per_second", 0)
            elif isinstance(parsed, list) and len(parsed) > 0:
                if isinstance(parsed[0], dict):
                    parsed[0]["_model_used"] = result.get("model", "unknown")
                    parsed[0]["_latency_ms"] = result.get("latency_ms", 0)
                    parsed[0]["_tokens_per_second"] = result.get("tokens_per_second", 0)
            
            model_used = result.get("model", "unknown")
            tokens_per_second = result.get("tokens_per_second", 0)
            logger.info(f"vLLM generate_json - Model: {model_used}, Throughput: {tokens_per_second:.1f} tokens/s")
            
            return parsed
        except json.JSONDecodeError as e:
            logger.error(f"JSON decode error: {str(e)}")
            if result:
                logger.error(f"Response was: {result.get('response', '')[:500]}")
            raise Exception(f"Failed to parse JSON from model response: {str(e)}")
        except Exception as e:
            logger.error(f"Error in generate_json: {str(e)}")
            raise


# Global instance
_vllm_service_instance = None

def get_vllm_service() -> VLLMService:
    """Get or create VLLMService instance (lazy initialization)"""
    global _vllm_service_instance
    if _vllm_service_instance is None:
        _vllm_service_instance = VLLMService()
    return _vllm_service_instance

# For backward compatibility
vllm_service = VLLMService()

