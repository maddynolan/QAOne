"""
Ollama LLM Service for QA AI Platform
Integrates with Ollama running on DGX with 7B, 14B, and 32B models
"""

import asyncio
import aiohttp
import logging
import json
import os
from typing import Dict, List, Any, Optional
from enum import Enum

logger = logging.getLogger(__name__)

class ModelMode(str, Enum):
    """Model selection based on task complexity"""
    QUICK = "quick"  # 7B model
    UI = "ui"  # 14B model  
    HEAVY = "heavy"  # 32B model


class OllamaService:
    """Service to interact with Ollama API on DGX"""
    
    def __init__(self):
        # Get DGX IP from environment or use default
        self.ollama_base_url = os.getenv("OLLAMA_URL", "http://localhost:11434")
        self.ollama_api_url = f"{self.ollama_base_url}/api/generate"
        self.session: Optional[aiohttp.ClientSession] = None
        self.timeout = 180  # 3 minutes timeout for large models (14B can take 60-90s)
        
        # Log which Ollama instance we're using
        logger.info(f"OllamaService initialized - Using Ollama at: {self.ollama_base_url}")
        
        # Model mapping based on mode
        self.model_map = {
            ModelMode.QUICK: "qwen2.5:7b-instruct",
            ModelMode.UI: "qwen2.5-coder:14b",
            ModelMode.HEAVY: "qwen2.5-coder:32b"
        }
    
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
    
    def _select_model(self, mode: Optional[str] = None, task_type: Optional[str] = None) -> str:
        """Select model based on mode and task type, checking registry for fine-tuned models"""
        # Check if we have a fine-tuned model for this task type
        if task_type:
            try:
                from app.services.model_registry import model_registry
                # Try to get fine-tuned model for task type
                fine_tuned_model_id = f"qa-{task_type}"
                version = model_registry.get_model_for_request(fine_tuned_model_id, user_id=None)
                if version:
                    # Construct model path (assuming Ollama format)
                    model_path = f"{fine_tuned_model_id}:{version}"
                    logger.info(f"Using fine-tuned model: {model_path}")
                    return model_path
            except Exception as e:
                logger.debug(f"Could not get fine-tuned model: {e}, falling back to base model")
        
        # Fallback to base model selection
        if not mode:
            mode = ModelMode.UI.value
        
        mode_enum = ModelMode(mode) if mode in [m.value for m in ModelMode] else ModelMode.UI
        return self.model_map.get(mode_enum, self.model_map[ModelMode.UI])
    
    async def generate(
        self,
        prompt: str,
        mode: Optional[str] = None,
        max_retries: int = 3,
        validate_json: bool = True,
        task_type: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Generate response from Ollama with JSON validation and retry logic
        
        Args:
            prompt: The prompt to send to the model
            mode: Model mode (quick/ui/heavy)
            max_retries: Maximum retries for JSON validation
            validate_json: Whether to validate and retry on invalid JSON
            
        Returns:
            Dict containing 'response' text and 'model' used
        """
        if not self.session:
            await self.initialize()
        
        model = self._select_model(mode, task_type=task_type)
        
        for attempt in range(max_retries):
            try:
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
                        raise Exception(f"Ollama API error: {response.status} - {error_text}")
                    
                    data = await response.json()
                    response_text = data.get("response", "")
                    
                    # Validate JSON if requested
                    if validate_json:
                        # Try to extract JSON from response (might have markdown or text)
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
                            # If we get here, JSON is valid
                            return {
                                "response": json_text,  # Return cleaned JSON
                                "model": model,
                                "raw_response": data
                            }
                        except json.JSONDecodeError as e:
                            if attempt < max_retries - 1:
                                # Retry with instruction to fix JSON
                                logger.warning(f"Invalid JSON on attempt {attempt + 1}, retrying...")
                                logger.warning(f"Response snippet: {response_text[:200]}")
                                prompt = f"""{prompt}

Your previous answer was not valid JSON. Please respond with ONLY a valid JSON array. No explanations, no markdown, no text. Just the JSON array starting with [ and ending with ]."""
                                continue
                            else:
                                logger.error(f"Failed to get valid JSON after retries. Response: {response_text[:500]}")
                                raise Exception(f"Failed to get valid JSON response from model. Last response: {response_text[:200]}")
                    else:
                        return {
                            "response": response_text,
                            "model": model,
                            "raw_response": data
                        }
                        
            except asyncio.TimeoutError:
                if attempt < max_retries - 1:
                    logger.warning(f"Timeout on attempt {attempt + 1}, retrying...")
                    await asyncio.sleep(2)
                    continue
                else:
                    raise Exception("Ollama API timeout after retries")
            except Exception as e:
                if attempt < max_retries - 1:
                    logger.warning(f"Error on attempt {attempt + 1}: {str(e)}, retrying...")
                    await asyncio.sleep(2)
                    continue
                else:
                    raise
    
    async def generate_json(
        self,
        prompt: str,
        mode: Optional[str] = None,
        max_retries: int = 3
    ) -> Dict[str, Any]:
        """
        Generate and parse JSON response
        
        Returns:
            Parsed JSON as dict
        """
        result = None
        try:
            result = await self.generate(prompt, mode, max_retries, validate_json=True)
            parsed = json.loads(result["response"])
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
        _ollama_service_instance = OllamaService()
    return _ollama_service_instance

# For backward compatibility, create instance but allow recreation
ollama_service = OllamaService()

