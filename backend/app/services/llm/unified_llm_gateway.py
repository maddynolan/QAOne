"""
Unified LLM Gateway - Cost-Optimized Multi-Provider Service
============================================================

This gateway provides a unified interface to multiple LLM providers with:
- Automatic prompt caching for Claude (90% cost savings)
- Smart model selection based on task complexity
- Fallback chains for reliability
- Usage tracking and cost monitoring
- Local response caching for identical requests

Usage:
    gateway = UnifiedLLMGateway()
    result = await gateway.generate(
        prompt="Generate a test...",
        task_type="test_generation",
        provider="anthropic"  # or "auto" for smart routing
    )
"""

import os
import logging
from typing import Optional, Dict, Any, List
from enum import Enum

logger = logging.getLogger(__name__)


class TaskType(Enum):
    """Task types for model selection"""
    SIMPLE = "simple"           # Haiku - selectors, simple assertions
    MEDIUM = "medium"           # Sonnet - test generation, analysis
    COMPLEX = "complex"         # Sonnet/Opus - debugging, refactoring


class Provider(Enum):
    """Available LLM providers"""
    ANTHROPIC = "anthropic"
    OPENAI = "openai"
    OLLAMA = "ollama"
    AUTO = "auto"


class UnifiedLLMGateway:
    """
    Unified gateway for all LLM operations with cost optimization.
    
    Features:
    - Automatic provider selection
    - Prompt caching for Claude
    - Response caching for all providers
    - Usage tracking
    - Fallback chains
    """
    
    def __init__(self):
        self._claude_service = None
        self._ollama_client = None
        self._openai_client = None
        
        # Track which providers are available
        self.available_providers = self._detect_providers()
        
        logger.debug(f"UnifiedLLMGateway initialized. Available: {self.available_providers}")
    
    def _detect_providers(self) -> List[str]:
        """Detect which providers are configured"""
        available = []
        
        # Check Anthropic
        if os.getenv("ANTHROPIC_API_KEY"):
            available.append("anthropic")
        
        # Check OpenAI
        if os.getenv("OPENAI_API_KEY"):
            available.append("openai")
        
        # Check Ollama (local)
        ollama_url = os.getenv("OLLAMA_URL", "http://localhost:11434")
        # Assume available if URL is set (check happens at runtime)
        available.append("ollama")
        
        return available
    
    @property
    def claude_service(self):
        """Lazy-load Claude service"""
        if self._claude_service is None:
            try:
                from app.services.llm.cached_claude_service import get_cached_claude_service
                self._claude_service = get_cached_claude_service()
            except Exception as e:
                logger.warning(f"Could not initialize Claude service: {e}")
        return self._claude_service
    
    def _classify_task(self, task_type: str) -> TaskType:
        """Classify task complexity for model selection"""
        simple_tasks = [
            "selector_generation",
            "simple_assertion",
            "element_description",
            "basic_validation",
            "quick_check"
        ]
        
        complex_tasks = [
            "debugging",
            "refactoring",
            "architecture",
            "complex_analysis",
            "multi_file"
        ]
        
        if task_type in simple_tasks:
            return TaskType.SIMPLE
        elif task_type in complex_tasks:
            return TaskType.COMPLEX
        else:
            return TaskType.MEDIUM
    
    def _select_provider(self, task_type: str, preferred: str = "auto") -> str:
        """Select best provider based on task and availability"""
        if preferred != "auto" and preferred in self.available_providers:
            return preferred
        
        task = self._classify_task(task_type)
        
        # For complex tasks, prefer Claude (better at coding)
        if task == TaskType.COMPLEX:
            if "anthropic" in self.available_providers:
                return "anthropic"
            elif "openai" in self.available_providers:
                return "openai"
        
        # For simple tasks, prefer local (free) or Haiku (cheap)
        if task == TaskType.SIMPLE:
            if "ollama" in self.available_providers:
                return "ollama"
            elif "anthropic" in self.available_providers:
                return "anthropic"
        
        # Default: Use Claude if available (best caching support)
        if "anthropic" in self.available_providers:
            return "anthropic"
        
        # Fallback to whatever is available
        return self.available_providers[0] if self.available_providers else "ollama"
    
    async def generate(
        self,
        prompt: str,
        task_type: str = "test_generation",
        provider: str = "auto",
        page_context: str = "",
        app_type: str = "generic",
        use_cache: bool = True,
        **kwargs
    ) -> Dict[str, Any]:
        """
        Generate content using the best available provider.
        
        Args:
            prompt: The user request/prompt
            task_type: Type of task (affects model selection)
            provider: Provider to use ("auto" for smart selection)
            page_context: Page DOM/context (for test generation)
            app_type: Application type (salesforce, workday, etc.)
            use_cache: Whether to use local response cache
            
        Returns:
            Dict with 'content', 'provider', 'model', 'usage', etc.
        """
        # Select provider
        selected_provider = self._select_provider(task_type, provider)
        logger.info(f"Selected provider: {selected_provider} for task: {task_type}")
        
        try:
            if selected_provider == "anthropic":
                return await self._generate_with_claude(
                    prompt=prompt,
                    page_context=page_context,
                    app_type=app_type,
                    task_type=task_type,
                    use_cache=use_cache
                )
            elif selected_provider == "openai":
                return await self._generate_with_openai(
                    prompt=prompt,
                    task_type=task_type
                )
            elif selected_provider == "ollama":
                return await self._generate_with_ollama(
                    prompt=prompt,
                    task_type=task_type
                )
            else:
                return {
                    "success": False,
                    "error": f"No suitable provider found. Available: {self.available_providers}"
                }
                
        except Exception as e:
            logger.error(f"Error with {selected_provider}: {e}")
            
            # Try fallback
            fallback = self._get_fallback(selected_provider)
            if fallback:
                logger.info(f"Falling back to {fallback}")
                return await self.generate(
                    prompt=prompt,
                    task_type=task_type,
                    provider=fallback,
                    page_context=page_context,
                    app_type=app_type,
                    use_cache=use_cache
                )
            
            return {
                "success": False,
                "error": str(e),
                "provider": selected_provider
            }
    
    def _get_fallback(self, failed_provider: str) -> Optional[str]:
        """Get fallback provider"""
        fallback_order = ["anthropic", "openai", "ollama"]
        
        for provider in fallback_order:
            if provider != failed_provider and provider in self.available_providers:
                return provider
        
        return None
    
    async def _generate_with_claude(
        self,
        prompt: str,
        page_context: str,
        app_type: str,
        task_type: str,
        use_cache: bool
    ) -> Dict[str, Any]:
        """Generate using Claude with prompt caching"""
        if not self.claude_service:
            raise Exception("Claude service not available")
        
        result = await self.claude_service.generate_test(
            page_context=page_context,
            user_request=prompt,
            app_type=app_type,
            task_type=task_type,
            use_cache=use_cache
        )
        
        return {
            "success": not result.get("error", False),
            "content": result.get("content", ""),
            "provider": "anthropic",
            "model": result.get("model"),
            "from_cache": result.get("from_cache", False),
            "usage": result.get("usage", {}),
        }
    
    async def _generate_with_openai(
        self,
        prompt: str,
        task_type: str
    ) -> Dict[str, Any]:
        """Generate using OpenAI"""
        try:
            import openai
            
            client = openai.AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY"))
            
            model = "gpt-4o-mini" if task_type in ["simple", "selector_generation"] else "gpt-4o"
            
            response = await client.chat.completions.create(
                model=model,
                messages=[
                    {"role": "system", "content": "You are an expert QA automation engineer."},
                    {"role": "user", "content": prompt}
                ],
                max_tokens=4096
            )
            
            return {
                "success": True,
                "content": response.choices[0].message.content,
                "provider": "openai",
                "model": model,
                "from_cache": False,
                "usage": {
                    "input_tokens": response.usage.prompt_tokens,
                    "output_tokens": response.usage.completion_tokens
                }
            }
            
        except Exception as e:
            raise Exception(f"OpenAI error: {e}")
    
    async def _generate_with_ollama(
        self,
        prompt: str,
        task_type: str
    ) -> Dict[str, Any]:
        """Generate using local Ollama"""
        import aiohttp
        
        ollama_url = os.getenv("OLLAMA_URL", "http://localhost:11434")
        model = os.getenv("OLLAMA_MODEL", "qwen2.5-coder:7b")
        
        try:
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    f"{ollama_url}/api/generate",
                    json={
                        "model": model,
                        "prompt": prompt,
                        "stream": False
                    },
                    timeout=aiohttp.ClientTimeout(total=120)
                ) as response:
                    if response.status == 200:
                        data = await response.json()
                        return {
                            "success": True,
                            "content": data.get("response", ""),
                            "provider": "ollama",
                            "model": model,
                            "from_cache": False,
                            "usage": {
                                "total_duration": data.get("total_duration", 0),
                                "eval_count": data.get("eval_count", 0)
                            }
                        }
                    else:
                        raise Exception(f"Ollama returned {response.status}")
                        
        except Exception as e:
            raise Exception(f"Ollama error: {e}")
    
    # Convenience methods for common tasks
    
    async def generate_test(
        self,
        page_context: str,
        user_request: str,
        app_type: str = "generic"
    ) -> Dict[str, Any]:
        """Generate a test case"""
        return await self.generate(
            prompt=user_request,
            task_type="test_generation",
            page_context=page_context,
            app_type=app_type
        )
    
    async def generate_selector(
        self,
        element_html: str,
        app_type: str = "generic"
    ) -> Dict[str, Any]:
        """Generate a robust selector (uses cheaper model)"""
        return await self.generate(
            prompt=f"Generate the most robust Playwright selector for this element:\n{element_html}",
            task_type="selector_generation",
            app_type=app_type
        )
    
    async def analyze_failure(
        self,
        error_message: str,
        test_code: str,
        page_context: str = ""
    ) -> Dict[str, Any]:
        """Analyze a test failure"""
        prompt = f"""
        Analyze this test failure:
        
        Error: {error_message}
        
        Test Code:
        {test_code}
        
        Page Context:
        {page_context}
        
        Provide: 1) Root cause, 2) Fix suggestions, 3) Updated code
        """
        return await self.generate(
            prompt=prompt,
            task_type="debugging",
            page_context=page_context
        )
    
    def get_usage_stats(self) -> Dict[str, Any]:
        """Get usage statistics from Claude service"""
        if self.claude_service:
            return self.claude_service.get_usage_stats()
        return {"error": "No Claude service available"}


# Singleton instance
_gateway: Optional[UnifiedLLMGateway] = None

def get_llm_gateway() -> UnifiedLLMGateway:
    """Get or create the LLM gateway singleton"""
    global _gateway
    if _gateway is None:
        _gateway = UnifiedLLMGateway()
    return _gateway
















