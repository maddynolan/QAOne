"""
Ollama LLM Service for QA AI Platform
Integrates with Ollama running on DGX with 7B, 14B, and 32B models
Now supports vLLM backend for high-performance parallel inference

=============================================================================
DISABLED: DGX Spark / Ollama infrastructure not ready
This service requires DGX hardware with Qwen models deployed via Ollama.
When DGX is ready, set ENABLE_OLLAMA_SERVICE=true in .env
=============================================================================
"""

import asyncio
import aiohttp
import logging
import json
import os
from typing import Dict, List, Any, Optional
import re
from enum import Enum

logger = logging.getLogger(__name__)

# ============================================================================
# DISABLED FLAG - Set to True when DGX/Ollama infrastructure is ready
# ============================================================================
OLLAMA_SERVICE_ENABLED = os.getenv("ENABLE_OLLAMA_SERVICE", "false").lower() == "true"

if not OLLAMA_SERVICE_ENABLED:
    logger.info("[DISABLED] Ollama service - DGX infrastructure not ready (set ENABLE_OLLAMA_SERVICE=true when ready)")

class ModelMode(str, Enum):
    """Model selection based on task complexity"""
    QUICK = "quick"  # 7B model
    UI = "ui"  # 14B model  
    HEAVY = "heavy"  # 32B model


class OllamaService:
    """
    Service to interact with Ollama API on DGX
    Now supports vLLM backend for high-performance parallel inference with GPU saturation
    
    DISABLED: DGX/Ollama infrastructure not ready. Enable with ENABLE_OLLAMA_SERVICE=true
    """
    
    def __init__(self):
        # ============================================================================
        # CHECK IF SERVICE IS ENABLED
        # ============================================================================
        self.enabled = OLLAMA_SERVICE_ENABLED
        if not self.enabled:
            self.session = None
            self._vllm_service = None
            return  # Skip all initialization when disabled
        
        # Backend selection: vLLM for parallel processing, Ollama for compatibility
        self.use_vllm = os.getenv("USE_VLLM", "false").lower() == "true"
        
        # CRITICAL: Load .env if not already loaded (defensive)
        try:
            from dotenv import load_dotenv
            import os as os_module
            # Try multiple locations
            env_paths = [
                os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), '.env'),  # Root .env
                os.path.join(os.path.dirname(os.path.dirname(__file__)), '.env'),  # Backend .env
                '.env'  # Current directory
            ]
            for env_path in env_paths:
                if os.path.exists(env_path):
                    load_dotenv(env_path, override=True)
                    break
        except:
            pass
        
        # Get DGX IP from environment or use default
        ollama_url_from_env = os.getenv("OLLAMA_URL", "http://localhost:11434")
        self.ollama_base_url = ollama_url_from_env
        self.ollama_api_url = f"{self.ollama_base_url}/api/generate"
        
        # Log URL at debug level only
        logger.debug(f"OllamaService URL: {self.ollama_base_url}")
        self.session: Optional[aiohttp.ClientSession] = None
        # Increased timeout for 14B model on DGX (can take 2-3 minutes, need buffer)
        self.timeout = 360  # 6 minutes timeout for 14B model (actual takes 114-117s, but need buffer)
        
        # vLLM service for parallel processing (lazy import)
        self._vllm_service = None
        
        # Initialize vLLM backend if enabled
        if self.use_vllm:
            try:
                from app.services.llm.vllm_service import get_vllm_service
                self._vllm_service = get_vllm_service()
                logger.debug("OllamaService using vLLM backend")
            except Exception as e:
                logger.warning(f"vLLM init failed: {e}, falling back to Ollama")
                self.use_vllm = False
        
        # Model mapping based on mode
        # Fine-tuned model takes precedence if available
        # Load from environment - default to qwen3-coder:30b since old models deleted
        self.finetuned_model = os.getenv("FINETUNED_MODEL_NAME", "qwen3-coder:30b")
        # Default to false since fine-tuned model (qa-expert:7b) was deleted
        self.use_finetuned = os.getenv("USE_FINETUNED_MODEL", "false").lower() == "true"
        
        # Model configuration - support 7B for test cases (faster)
        # Allow override via environment variable
        self.test_case_model = os.getenv("TEST_CASE_MODEL", "qwen2.5-coder:7b")  # Default to 7B for speed
        self.use_7b_for_test_cases = os.getenv("USE_7B_FOR_TEST_CASES", "true").lower() == "true"
        
        # Updated model map for qwen3-coder:30b (replaces deleted 7B and 14B models)
        # But allow 7B model for test cases if available
        self.model_map = {
            ModelMode.QUICK: "qwen3-coder:30b",  # Default to 30B
            ModelMode.UI: "qwen3-coder:30b",     # Using 30B for all modes since 7B/14B deleted
            ModelMode.HEAVY: "qwen3-coder:30b"   # Using 30B for all modes
        }
        
        # If fine-tuned model is enabled, use it for QUICK mode
        if self.use_finetuned:
            self.model_map[ModelMode.QUICK] = self.finetuned_model
            logger.debug(f"Fine-tuned model enabled: {self.finetuned_model}")
    
    async def initialize(self):
        """Initialize HTTP session"""
        if not self.session:
            timeout = aiohttp.ClientTimeout(total=self.timeout)
            self.session = aiohttp.ClientSession(timeout=timeout)
    
    async def cleanup(self):
        """Cleanup HTTP session"""
        if self.session:
            await self.session.close()
            self.session = None
    
    def _select_model(self, mode: Optional[str] = None, task_type: Optional[str] = None, use_fast_model: bool = False) -> str:
        """Select model based on mode and task type, checking registry for fine-tuned models
        
        Args:
            mode: Model mode (quick/ui/heavy)
            task_type: Task type (test_design, automation, etc.)
            use_fast_model: If True, use 7B model for speed (for test case generation)
        """
        # Note: This is a sync method, so we can't await async calls
        # Fine-tuned model lookup would need to be done in async context
        # For now, skip registry lookup in sync context
        
        # Priority 1: Use fast model (7B) for test case generation if requested
        if use_fast_model and self.use_7b_for_test_cases:
            logger.debug(f"Using fast 7B model: {self.test_case_model}")
            return self.test_case_model
        
        # Priority 2: Use fine-tuned model if enabled and mode is quick (7B equivalent)
        if self.use_finetuned and (not mode or mode == ModelMode.QUICK.value or mode == "quick"):
            logger.debug(f"Using fine-tuned model: {self.finetuned_model}")
            return self.finetuned_model
        
        # Fallback to base model selection
        if not mode:
            mode = ModelMode.UI.value
        
        mode_enum = ModelMode(mode) if mode in [m.value for m in ModelMode] else ModelMode.UI
        selected_model = self.model_map.get(mode_enum, self.model_map[ModelMode.UI])
        logger.debug(f"Using base model: {selected_model} (mode: {mode})")
        return selected_model
    
    async def generate(
        self,
        prompt: str,
        mode: Optional[str] = None,
        max_retries: int = 3,
        validate_json: bool = True,
        task_type: Optional[str] = None,
        use_fast_model: bool = False
    ) -> Dict[str, Any]:
        """
        Generate response from Ollama or vLLM with JSON validation and retry logic
        Automatically uses vLLM if enabled for better parallel processing
        
        Args:
            prompt: The prompt to send to the model
            mode: Model mode (quick/ui/heavy)
            max_retries: Maximum retries for JSON validation
            validate_json: Whether to validate and retry on invalid JSON
            task_type: Type of task for model selection
            
        Returns:
            Dict containing 'response' text and 'model' used
        """
        # ============================================================================
        # DISABLED CHECK - Return empty response when service is disabled
        # ============================================================================
        if not self.enabled:
            logger.warning("OllamaService.generate() called but service is DISABLED")
            return {
                "response": "",
                "model": "ollama_disabled",
                "error": "Ollama service disabled - DGX infrastructure not ready. Set ENABLE_OLLAMA_SERVICE=true"
            }
        
        # Use vLLM if enabled for better parallelism
        if self.use_vllm and self._vllm_service:
            try:
                return await self._vllm_service.generate(
                    prompt=prompt,
                    mode=mode,
                    max_retries=max_retries,
                    validate_json=validate_json,
                    task_type=task_type,
                    use_fast_model=use_fast_model
                )
            except Exception as e:
                logger.warning(f"vLLM request failed: {e}, falling back to Ollama")
                # Fall through to Ollama
        
        # Fallback to Ollama
        if not self.session:
            await self.initialize()
        
        model = self._select_model(mode, task_type=task_type, use_fast_model=use_fast_model)
        
        for attempt in range(max_retries):
            try:
                # Log model being used (especially for 7B debugging)
                if use_fast_model and model == self.test_case_model:
                    logger.info(f"[DEBUG] Attempt {attempt + 1}: Requesting 7B model '{model}' from {self.ollama_api_url}")
                    print(f"[DEBUG] Attempt {attempt + 1}: Requesting 7B model '{model}' from {self.ollama_api_url}")
                
                payload = {
                    "model": model,
                    "prompt": prompt,
                    "stream": False,
                    "options": {
                        "temperature": 0.7,
                        "top_p": 0.9,
                    }
                }
                
                async with self.session.post(
                    self.ollama_api_url,
                    json=payload
                ) as response:
                    if response.status != 200:
                        error_text = await response.text()
                        error_msg = f"Ollama API error: {response.status} - {error_text}"
                        
                        # AUTO-FIX: If model not found (404), try fallback
                        # BUT: For 7B model, retry a few times before falling back (might be connection issue)
                        if response.status == 404 and ("not found" in error_text.lower() or "model" in error_text.lower()):
                            # Special handling for 7B test case model - retry before falling back
                            if model == self.test_case_model and use_fast_model:
                                logger.warning(f"[WARNING] 7B test case model '{model}' returned 404 on attempt {attempt + 1}")
                                logger.warning(f"   Error: {error_text}")
                                
                                # If this is not the last attempt, retry the 7B model (might be temporary connection issue)
                                if attempt < max_retries - 1:
                                    logger.info(f"   Retrying 7B model (attempt {attempt + 2}/{max_retries}) before fallback...")
                                    await asyncio.sleep(1)  # Brief delay before retry
                                    continue  # Retry with same 7B model
                                else:
                                    # Last attempt failed, now try fallback
                                    logger.warning(f"   7B model failed after {max_retries} attempts. Falling back to qwen3-coder:30b...")
                                    fallback_payload = payload.copy()
                                    fallback_payload["model"] = "qwen3-coder:30b"
                                    async with self.session.post(
                                        self.ollama_api_url,
                                        json=fallback_payload
                                    ) as fallback_response:
                                        if fallback_response.status == 200:
                                            data = await fallback_response.json()
                                            response_text = data.get("response", "")
                                            actual_model_used = "qwen3-coder:30b"
                                            logger.info(f"Fallback successful: Using qwen3-coder:30b")
                                            break
                                        else:
                                            raise Exception(error_msg)
                            else:
                                # For other models, fallback immediately
                                logger.warning(f"Model {model} not found, trying fallback: qwen3-coder:30b")
                                if model != "qwen3-coder:30b":
                                    fallback_payload = payload.copy()
                                    fallback_payload["model"] = "qwen3-coder:30b"
                                    async with self.session.post(
                                        self.ollama_api_url,
                                        json=fallback_payload
                                    ) as fallback_response:
                                        if fallback_response.status == 200:
                                            data = await fallback_response.json()
                                            response_text = data.get("response", "")
                                            actual_model_used = "qwen3-coder:30b"
                                            logger.info(f"Fallback successful: Using qwen3-coder:30b")
                                            break
                                        else:
                                            raise Exception(error_msg)
                                else:
                                    # Already using fallback model, can't fallback further
                                    if attempt < max_retries - 1:
                                        continue
                                    else:
                                        return {
                                            "response": "",
                                            "model": model,
                                            "error": error_msg
                                        }
                        else:
                            # Non-404 error
                            if attempt < max_retries - 1:
                                continue
                            else:
                                return {
                                    "response": "",
                                    "model": model,
                                    "error": error_msg
                                }
                    else:
                        # Original request succeeded
                        data = await response.json()
                        response_text = data.get("response", "")
                        actual_model_used = data.get("model", model)
                        response_length = len(response_text) if response_text else 0
                        
                        # Log response details for debugging
                        logger.info(f"[OK] Ollama API success - Model: {actual_model_used}, Response length: {response_length}")
                        if response_length == 0:
                            logger.warning(f"[WARNING] Model {actual_model_used} returned empty response!")
                            logger.warning(f"   Response data keys: {list(data.keys())}")
                            logger.warning(f"   Response data: {str(data)[:500]}")
                            # Check if response is actually empty or just not in 'response' key
                            if 'done' in data and data.get('done') is True:
                                logger.warning(f"   API says 'done=True' but no response text - this is unusual")
                        else:
                            logger.info(f"[OK] Got response from {actual_model_used}: {response_text[:100]}...")
                        
                        # Process response (JSON validation if needed)
                        # Log which model was actually used for verification
                        print(f"[INFO] Ollama API Response - Requested: {model}, Actual: {actual_model_used}")
                        logger.info(f"[INFO] Ollama API Response - Requested: {model}, Actual: {actual_model_used}")
                        if "qa-expert" in actual_model_used.lower():
                            print(f"[OK] Using trained model: {actual_model_used}")
                            logger.info(f"[OK] Using trained model: {actual_model_used}")
                        else:
                            print(f"[WARN] Using base model: {actual_model_used}")
                            logger.info(f"[WARN] Using base model: {actual_model_used}")
                        
                        # Validate JSON if requested
                        if validate_json:
                            # OPTIMIZATION Strategy 10: Enhanced JSON extraction with better fallback parsing
                            def extract_json_robust(text: str) -> Optional[str]:
                                """Extract JSON from text with multiple fallback strategies"""
                                text = text.strip()
                                
                                # Strategy 1: Remove markdown code blocks
                                if "```json" in text:
                                    parts = text.split("```json")
                                    if len(parts) > 1:
                                        text = parts[1].split("```")[0].strip()
                                elif "```" in text:
                                    parts = text.split("```")
                                    for part in parts:
                                        part = part.strip()
                                        if part.startswith("[") or part.startswith("{"):
                                            text = part
                                            break
                                
                                # Strategy 2: Find JSON boundaries (array or object)
                                start_idx = text.find('[')
                                end_idx = text.rfind(']')
                                if start_idx != -1 and end_idx != -1 and end_idx > start_idx:
                                    text = text[start_idx:end_idx+1]
                                else:
                                    # Try object boundaries
                                    start_idx = text.find('{')
                                    end_idx = text.rfind('}')
                                    if start_idx != -1 and end_idx != -1 and end_idx > start_idx:
                                        text = text[start_idx:end_idx+1]
                                
                                # Strategy 3: Try to fix common JSON issues
                                # Remove trailing commas before closing brackets/braces
                                text = re.sub(r',\s*([}\]])', r'\1', text)
                                
                                # Strategy 4: Try parsing - if it works, return cleaned text
                                try:
                                    parsed = json.loads(text)
                                    return json.dumps(parsed)  # Re-serialize to ensure clean JSON
                                except:
                                    pass
                                
                                # Strategy 5: Try to extract first valid JSON object/array
                                # Find all potential JSON structures
                                for pattern in [r'\[.*?\]', r'\{.*?\}']:
                                    matches = re.findall(pattern, text, re.DOTALL)
                                    for match in matches:
                                        try:
                                            parsed = json.loads(match)
                                            return json.dumps(parsed)
                                        except:
                                            continue
                                
                                return None
                            
                            json_text = extract_json_robust(response_text)
                            
                            if json_text:
                                # Successfully extracted valid JSON
                                return {
                                    "response": json_text,
                                    "model": actual_model_used,
                                    "raw_response": data
                                }
                            else:
                                # JSON extraction failed - but we still have the raw response
                                # CRITICAL FIX: Return the raw response instead of retrying or returning empty
                                # The caller (flowstral_artifacts) can extract JSON from markdown
                                logger.warning(f"JSON extraction failed, but returning raw response for caller to parse")
                                logger.info(f"Raw response length: {len(response_text)}, preview: {response_text[:200]}")
                                return {
                                    "response": response_text,  # Return raw response - caller will extract JSON
                                    "model": actual_model_used,
                                    "raw_response": data,
                                    "_json_extraction_failed": True  # Flag for caller
                                }
                        else:
                            # No JSON validation needed - return raw response immediately
                            return {
                                "response": response_text,
                                "model": actual_model_used,  # Use actual model from API response
                                "raw_response": data
                            }
                        
            except asyncio.TimeoutError:
                if attempt < max_retries - 1:
                    logger.warning(f"Timeout on attempt {attempt + 1}, retrying...")
                    await asyncio.sleep(2)
                    continue
                else:
                    logger.error(f"Ollama API timeout after {max_retries} attempts")
                    return {
                        "response": "",
                        "model": model,
                        "error": "Ollama API timeout after retries"
                    }
            except Exception as e:
                logger.error(f"[ERROR] Exception on attempt {attempt + 1}: {type(e).__name__}: {str(e)}")
                import traceback
                logger.debug(f"Traceback: {traceback.format_exc()}")
                if attempt < max_retries - 1:
                    logger.warning(f"Retrying... (attempt {attempt + 2}/{max_retries})")
                    await asyncio.sleep(2)
                    continue
                else:
                    logger.error(f"Ollama API error after {max_retries} attempts: {str(e)}")
                    return {
                        "response": "",
                        "model": model,
                        "error": str(e)
                    }
        
        # If we get here, all retries failed - return empty response
        logger.error("All retry attempts failed, returning empty response")
        return {
            "response": "",
            "model": model,
            "error": "All retry attempts failed"
        }
    
    async def generate_batch(
        self,
        prompts: List[str],
        mode: Optional[str] = None,
        task_type: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        Generate responses for multiple prompts in parallel
        Uses vLLM if available for GPU saturation, otherwise processes sequentially
        
        Args:
            prompts: List of prompts to process
            mode: Model mode (quick/ui/heavy)
            task_type: Type of task for model selection
            
        Returns:
            List of response dicts
        """
        # Use vLLM batch processing if available
        if self.use_vllm and self._vllm_service:
            try:
                return await self._vllm_service.generate_batch(
                    prompts=prompts,
                    mode=mode,
                    task_type=task_type
                )
            except Exception as e:
                logger.warning(f"vLLM batch request failed: {e}, falling back to sequential Ollama")
        
        # Fallback to sequential processing with Ollama
        results = []
        for prompt in prompts:
            try:
                result = await self.generate(prompt, mode, validate_json=False, task_type=task_type)
                results.append(result)
            except Exception as e:
                logger.error(f"Error processing prompt in batch: {str(e)}")
                results.append({
                    "response": "",
                    "model": "error",
                    "error": str(e)
                })
        return results
    
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
            elif isinstance(parsed, list) and len(parsed) > 0:
                # Attach to first item if it's a list
                if isinstance(parsed[0], dict):
                    parsed[0]["_model_used"] = result.get("model", "unknown")
            
            # Also log here for visibility
            model_used = result.get("model", "unknown")
            print(f"[INFO] GENERATE_JSON - Model used: {model_used}")
            logger.info(f"[INFO] GENERATE_JSON - Model used: {model_used}")
            if "qa-expert" in model_used.lower():
                print(f"[OK] Using trained model: {model_used}")
                logger.info(f"[OK] Using trained model: {model_used}")
            else:
                print(f"[WARN] Using base model: {model_used}")
                logger.info(f"[WARN] Using base model: {model_used}")
            
            return parsed
        except json.JSONDecodeError as e:
            logger.error(f"JSON decode error: {str(e)}")
            if result:
                logger.error(f"Response was: {result.get('response', '')[:500]}")
            raise Exception(f"Failed to parse JSON from model response: {str(e)}")
        except Exception as e:
            logger.error(f"Error in generate_json: {str(e)}")
            raise


# Global instance - will be initialized after .env is loaded
_ollama_service_instance = None

def get_ollama_service() -> OllamaService:
    """Get or create OllamaService instance (lazy initialization)"""
    global _ollama_service_instance
    if _ollama_service_instance is None:
        # Ensure .env is loaded before creating service
        try:
            from dotenv import load_dotenv
            import os
            # Try loading .env from common locations
            env_paths = [
                os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), '.env'),  # Root .env
                os.path.join(os.path.dirname(os.path.dirname(__file__)), '.env'),  # Backend .env
                '.env'  # Current directory
            ]
            for env_path in env_paths:
                if os.path.exists(env_path):
                    load_dotenv(env_path, override=True)
                    break
        except ImportError:
            pass  # dotenv not available, skip
        _ollama_service_instance = OllamaService()
    return _ollama_service_instance

# For backward compatibility, create instance but allow recreation
ollama_service = OllamaService()

