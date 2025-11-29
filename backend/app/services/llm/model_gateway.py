"""
Model Gateway Service - Unified LLM Access Layer
Provides a single interface for all LLM operations across different providers
"""

import asyncio
import logging
import os
from typing import Dict, List, Any, Optional
from enum import Enum
from datetime import datetime
from pydantic import BaseModel

logger = logging.getLogger(__name__)

# Provider types
class LLMProvider(str, Enum):
    """Supported LLM providers"""
    LOCAL_QWEN = "local_qwen"  # Local Qwen models via Ollama/vLLM
    OPENAI = "openai"  # OpenAI API
    ANTHROPIC = "anthropic"  # Claude API
    AZURE_OPENAI = "azure_openai"  # Azure OpenAI


class GenerationRequest(BaseModel):
    """Request model for text generation"""
    prompt: str
    mode: Optional[str] = None  # quick/ui/heavy
    max_tokens: Optional[int] = None
    temperature: Optional[float] = None
    validate_json: bool = True
    task_type: Optional[str] = None
    provider: Optional[LLMProvider] = None  # Override provider selection
    use_fast_model: bool = False  # Use 7B model for speed (test case generation)


class ChatRequest(BaseModel):
    """Request model for chat completion"""
    messages: List[Dict[str, str]]
    mode: Optional[str] = None
    max_tokens: Optional[int] = None
    temperature: Optional[float] = None
    provider: Optional[LLMProvider] = None


class EmbeddingRequest(BaseModel):
    """Request model for embeddings"""
    text: str
    provider: Optional[LLMProvider] = None


class GenerationResponse(BaseModel):
    """Response model for generation"""
    response: str
    model: str
    provider: str
    tokens_used: Optional[int] = None
    latency_ms: Optional[float] = None
    cost_usd: Optional[float] = None


class ModelGateway:
    """
    Unified gateway for LLM access
    Routes requests to appropriate providers (local Qwen, cloud APIs)
    Tracks usage and costs
    """
    
    def __init__(self):
        # Default provider (can be overridden per request)
        self.default_provider = LLMProvider(os.getenv("DEFAULT_LLM_PROVIDER", "local_qwen"))
        
        # Initialize provider services (lazy loading)
        self._ollama_service = None
        self._vllm_service = None
        self._openai_client = None
        self._anthropic_client = None
        
        # Usage tracking
        self._track_usage = os.getenv("TRACK_LLM_USAGE", "true").lower() == "true"
        
        logger.info(f"ModelGateway initialized with default provider: {self.default_provider}")
    
    # ==================== Provider Initialization ====================
    
    def _get_ollama_service(self):
        """Lazy load Ollama service"""
        if self._ollama_service is None:
            # Ensure .env is loaded before creating OllamaService
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
                        ollama_url = os.getenv('OLLAMA_URL', 'NOT SET')
                        logger.info(f"ModelGateway: Loaded .env from {env_path} - OLLAMA_URL={ollama_url}")
                        if ollama_url == 'NOT SET':
                            logger.warning(f"⚠️  OLLAMA_URL not found in {env_path}!")
                        break
            except ImportError:
                pass  # dotenv not available, skip
            
            from app.services.llm.ollama_service import OllamaService
            self._ollama_service = OllamaService()
        return self._ollama_service
    
    def _get_vllm_service(self):
        """Lazy load vLLM service"""
        if self._vllm_service is None:
            try:
                from app.services.llm.vllm_service import get_vllm_service
                self._vllm_service = get_vllm_service()
            except Exception as e:
                logger.warning(f"vLLM service not available: {e}")
        return self._vllm_service
    
    def _get_openai_client(self):
        """Lazy load OpenAI client"""
        if self._openai_client is None:
            try:
                import openai
                api_key = os.getenv("OPENAI_API_KEY")
                if not api_key:
                    raise ValueError("OPENAI_API_KEY not set")
                self._openai_client = openai.AsyncOpenAI(api_key=api_key)
            except Exception as e:
                logger.warning(f"OpenAI client not available: {e}")
        return self._openai_client
    
    def _get_anthropic_client(self):
        """Lazy load Anthropic client"""
        if self._anthropic_client is None:
            try:
                import anthropic
                api_key = os.getenv("ANTHROPIC_API_KEY")
                if not api_key:
                    raise ValueError("ANTHROPIC_API_KEY not set")
                self._anthropic_client = anthropic.AsyncAnthropic(api_key=api_key)
            except Exception as e:
                logger.warning(f"Anthropic client not available: {e}")
        return self._anthropic_client
    
    # ==================== Provider Selection ====================
    
    def _select_provider(self, request_provider: Optional[LLMProvider] = None) -> LLMProvider:
        """Select provider for request"""
        from app.config.llm_config import AIR_GAPPED_MODE, validate_provider
        
        provider = request_provider or self.default_provider
        
        # Validate provider (checks air-gapped mode)
        try:
            validate_provider(provider.value if isinstance(provider, LLMProvider) else provider)
        except ValueError as e:
            logger.error(f"Provider validation failed: {e}")
            # In air-gapped mode, fallback to local
            if AIR_GAPPED_MODE:
                logger.warning("Air-gapped mode: Falling back to local_qwen")
                return LLMProvider.LOCAL_QWEN
            raise
        
        return provider
    
    # ==================== Generation Methods ====================
    
    async def generate(
        self,
        request: GenerationRequest,
        tenant_id: Optional[str] = None
    ) -> GenerationResponse:
        """
        Generate text using selected provider
        
        Args:
            request: Generation request
            tenant_id: Tenant ID for usage tracking
            
        Returns:
            GenerationResponse with result and metadata
        """
        import time
        start_time = time.time()
        
        provider = self._select_provider(request.provider)
        
        try:
            # Route to appropriate provider
            if provider == LLMProvider.LOCAL_QWEN:
                result = await self._generate_local(request)
            elif provider == LLMProvider.OPENAI:
                result = await self._generate_openai(request)
            elif provider == LLMProvider.ANTHROPIC:
                result = await self._generate_anthropic(request)
            else:
                raise ValueError(f"Unsupported provider: {provider}")
            
            # Calculate latency
            latency_ms = (time.time() - start_time) * 1000
            
            # Estimate tokens (rough: 1 token ≈ 4 characters)
            tokens_used = len(result.get("response", "")) // 4
            
            # Calculate cost (if applicable)
            cost_usd = self._calculate_cost(provider, tokens_used, result.get("model", ""))
            
            # Track usage
            if self._track_usage:
                await self._track_llm_usage(
                    tenant_id=tenant_id,
                    provider=provider.value,
                    model=result.get("model", ""),
                    operation="generate",
                    tokens_used=tokens_used,
                    cost_usd=cost_usd,
                    latency_ms=latency_ms
                )
            
            return GenerationResponse(
                response=result.get("response", ""),
                model=result.get("model", ""),
                provider=provider.value,
                tokens_used=tokens_used,
                latency_ms=latency_ms,
                cost_usd=cost_usd
            )
            
        except Exception as e:
            logger.error(f"Generation failed with provider {provider}: {e}")
            # Don't raise - return error response instead
            return GenerationResponse(
                response="",
                model="unknown",
                provider=provider.value,
                tokens_used=0,
                latency_ms=0,
                cost_usd=0.0
            )
    
    async def _generate_local(self, request: GenerationRequest) -> Dict[str, Any]:
        """Generate using local Qwen models"""
        # Log model selection request
        if request.use_fast_model:
            logger.info(f"🚀 MODEL_GATEWAY - Fast model requested (use_fast_model=True) for task_type={request.task_type}")
            print(f"[INFO] MODEL_GATEWAY - Fast model requested (use_fast_model=True) for task_type={request.task_type}")
        
        ollama = self._get_ollama_service()
        result = await ollama.generate(
            prompt=request.prompt,
            mode=request.mode,
            validate_json=request.validate_json,
            task_type=request.task_type,
            use_fast_model=request.use_fast_model
        )
        
        # Log actual model used
        model_used = result.get("model", "unknown") if result else "None"
        if result:
            logger.info(f"✅ MODEL_GATEWAY - Model used: {model_used}, has_response={bool(result.get('response'))}, response_length={len(result.get('response', ''))}")
            print(f"[INFO] MODEL_GATEWAY - Model used: {model_used}, has_response={bool(result.get('response'))}")
            if "7b" in model_used.lower() or "qwen2.5-coder" in model_used.lower():
                logger.info(f"✅ Confirmed: Using 7B model ({model_used})")
                print(f"[OK] Using 7B model: {model_used}")
            else:
                logger.warning(f"⚠️  Not using 7B model - got: {model_used}")
                print(f"[WARN] Not using 7B model - got: {model_used}")
        else:
            logger.error(f"❌ MODEL_GATEWAY - Ollama service returned None result!")
            print(f"[ERROR] MODEL_GATEWAY - Ollama service returned None result!")
        
        return {
            "response": result.get("response", "") if result else "",
            "model": model_used
        }
    
    async def _generate_openai(self, request: GenerationRequest) -> Dict[str, Any]:
        """Generate using OpenAI API"""
        client = self._get_openai_client()
        if not client:
            raise ValueError("OpenAI client not available")
        
        model = self._map_mode_to_openai_model(request.mode)
        
        response = await client.chat.completions.create(
            model=model,
            messages=[{"role": "user", "content": request.prompt}],
            max_tokens=request.max_tokens or 2000,
            temperature=request.temperature or 0.7
        )
        
        return {
            "response": response.choices[0].message.content,
            "model": model
        }
    
    async def _generate_anthropic(self, request: GenerationRequest) -> Dict[str, Any]:
        """Generate using Anthropic Claude API"""
        client = self._get_anthropic_client()
        if not client:
            raise ValueError("Anthropic client not available")
        
        model = self._map_mode_to_anthropic_model(request.mode)
        
        response = await client.messages.create(
            model=model,
            max_tokens=request.max_tokens or 2000,
            temperature=request.temperature or 0.7,
            messages=[{"role": "user", "content": request.prompt}]
        )
        
        return {
            "response": response.content[0].text,
            "model": model
        }
    
    # ==================== Chat Methods ====================
    
    async def chat(
        self,
        request: ChatRequest,
        tenant_id: Optional[str] = None
    ) -> GenerationResponse:
        """
        Chat completion using selected provider
        
        Args:
            request: Chat request with messages
            tenant_id: Tenant ID for usage tracking
            
        Returns:
            GenerationResponse with result and metadata
        """
        import time
        start_time = time.time()
        
        provider = self._select_provider(request.provider)
        
        try:
            # Route to appropriate provider
            if provider == LLMProvider.LOCAL_QWEN:
                result = await self._chat_local(request)
            elif provider == LLMProvider.OPENAI:
                result = await self._chat_openai(request)
            elif provider == LLMProvider.ANTHROPIC:
                result = await self._chat_anthropic(request)
            else:
                raise ValueError(f"Unsupported provider: {provider}")
            
            latency_ms = (time.time() - start_time) * 1000
            tokens_used = len(result.get("response", "")) // 4
            cost_usd = self._calculate_cost(provider, tokens_used, result.get("model", ""))
            
            if self._track_usage:
                await self._track_llm_usage(
                    tenant_id=tenant_id,
                    provider=provider.value,
                    model=result.get("model", ""),
                    operation="chat",
                    tokens_used=tokens_used,
                    cost_usd=cost_usd,
                    latency_ms=latency_ms
                )
            
            return GenerationResponse(
                response=result.get("response", ""),
                model=result.get("model", ""),
                provider=provider.value,
                tokens_used=tokens_used,
                latency_ms=latency_ms,
                cost_usd=cost_usd
            )
            
        except Exception as e:
            logger.error(f"Chat failed with provider {provider}: {e}")
            raise
    
    async def _chat_local(self, request: ChatRequest) -> Dict[str, Any]:
        """Chat using local Qwen models"""
        # Convert messages to prompt format
        prompt = self._messages_to_prompt(request.messages)
        
        ollama = self._get_ollama_service()
        result = await ollama.generate(
            prompt=prompt,
            mode=request.mode
        )
        return {
            "response": result.get("response", ""),
            "model": result.get("model", "unknown")
        }
    
    async def _chat_openai(self, request: ChatRequest) -> Dict[str, Any]:
        """Chat using OpenAI API"""
        client = self._get_openai_client()
        if not client:
            raise ValueError("OpenAI client not available")
        
        model = self._map_mode_to_openai_model(request.mode)
        
        response = await client.chat.completions.create(
            model=model,
            messages=request.messages,
            max_tokens=request.max_tokens or 2000,
            temperature=request.temperature or 0.7
        )
        
        return {
            "response": response.choices[0].message.content,
            "model": model
        }
    
    async def _chat_anthropic(self, request: ChatRequest) -> Dict[str, Any]:
        """Chat using Anthropic Claude API"""
        client = self._get_anthropic_client()
        if not client:
            raise ValueError("Anthropic client not available")
        
        model = self._map_mode_to_anthropic_model(request.mode)
        
        response = await client.messages.create(
            model=model,
            max_tokens=request.max_tokens or 2000,
            temperature=request.temperature or 0.7,
            messages=request.messages
        )
        
        return {
            "response": response.content[0].text,
            "model": model
        }
    
    # ==================== Embedding Methods ====================
    
    async def embedding(
        self,
        request: EmbeddingRequest,
        tenant_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Generate embeddings using selected provider
        
        Args:
            request: Embedding request
            tenant_id: Tenant ID for usage tracking
            
        Returns:
            Dict with embedding vector and metadata
        """
        import time
        start_time = time.time()
        
        provider = self._select_provider(request.provider)
        
        try:
            # Route to appropriate provider
            if provider == LLMProvider.LOCAL_QWEN:
                result = await self._embedding_local(request)
            elif provider == LLMProvider.OPENAI:
                result = await self._embedding_openai(request)
            else:
                raise ValueError(f"Embeddings not supported for provider: {provider}")
            
            latency_ms = (time.time() - start_time) * 1000
            tokens_used = len(request.text) // 4
            cost_usd = self._calculate_cost(provider, tokens_used, result.get("model", ""))
            
            if self._track_usage:
                await self._track_llm_usage(
                    tenant_id=tenant_id,
                    provider=provider.value,
                    model=result.get("model", ""),
                    operation="embedding",
                    tokens_used=tokens_used,
                    cost_usd=cost_usd,
                    latency_ms=latency_ms
                )
            
            return {
                "embedding": result.get("embedding", []),
                "model": result.get("model", ""),
                "provider": provider.value,
                "tokens_used": tokens_used,
                "latency_ms": latency_ms,
                "cost_usd": cost_usd
            }
            
        except Exception as e:
            logger.error(f"Embedding failed with provider {provider}: {e}")
            raise
    
    async def _embedding_local(self, request: EmbeddingRequest) -> Dict[str, Any]:
        """Generate embeddings using local service"""
        from app.services.utils.embedding_service import EmbeddingService
        embedding_service = EmbeddingService()
        embedding = await embedding_service.get_embedding(request.text)
        return {
            "embedding": embedding,
            "model": "local_embedding"
        }
    
    async def _embedding_openai(self, request: EmbeddingRequest) -> Dict[str, Any]:
        """Generate embeddings using OpenAI API"""
        client = self._get_openai_client()
        if not client:
            raise ValueError("OpenAI client not available")
        
        response = await client.embeddings.create(
            model="text-embedding-3-small",
            input=request.text
        )
        
        return {
            "embedding": response.data[0].embedding,
            "model": "text-embedding-3-small"
        }
    
    # ==================== Helper Methods ====================
    
    def _messages_to_prompt(self, messages: List[Dict[str, str]]) -> str:
        """Convert chat messages to prompt format"""
        prompt_parts = []
        for msg in messages:
            role = msg.get("role", "user")
            content = msg.get("content", "")
            if role == "system":
                prompt_parts.append(f"System: {content}")
            elif role == "user":
                prompt_parts.append(f"User: {content}")
            elif role == "assistant":
                prompt_parts.append(f"Assistant: {content}")
        return "\n\n".join(prompt_parts)
    
    def _map_mode_to_openai_model(self, mode: Optional[str]) -> str:
        """Map mode to OpenAI model"""
        mode_map = {
            "quick": "gpt-3.5-turbo",
            "ui": "gpt-4",
            "heavy": "gpt-4-turbo"
        }
        return mode_map.get(mode, "gpt-3.5-turbo")
    
    def _map_mode_to_anthropic_model(self, mode: Optional[str]) -> str:
        """Map mode to Anthropic model"""
        mode_map = {
            "quick": "claude-3-haiku-20240307",
            "ui": "claude-3-sonnet-20240229",
            "heavy": "claude-3-opus-20240229"
        }
        return mode_map.get(mode, "claude-3-sonnet-20240229")
    
    def _calculate_cost(self, provider: LLMProvider, tokens: int, model: str) -> Optional[float]:
        """Calculate cost in USD (rough estimates)"""
        if provider == LLMProvider.LOCAL_QWEN:
            return 0.0  # Local models are free
        
        # Rough cost estimates (per 1K tokens)
        cost_map = {
            "gpt-3.5-turbo": 0.0015,  # $0.0015 per 1K tokens
            "gpt-4": 0.03,  # $0.03 per 1K tokens
            "gpt-4-turbo": 0.01,  # $0.01 per 1K tokens
            "claude-3-haiku": 0.00025,
            "claude-3-sonnet": 0.003,
            "claude-3-opus": 0.015
        }
        
        cost_per_1k = cost_map.get(model, 0.001)
        return (tokens / 1000) * cost_per_1k
    
    async def _track_llm_usage(
        self,
        tenant_id: Optional[str],
        provider: str,
        model: str,
        operation: str,
        tokens_used: int,
        cost_usd: float,
        latency_ms: float
    ):
        """Track LLM usage in database"""
        try:
            from app.services.storage.postgres_direct import get_postgres_pool
            import concurrent.futures
            
            pool = get_postgres_pool()
            if not pool:
                logger.warning("Database pool not available, skipping usage tracking")
                return
            
            # Run synchronous database operation in thread pool
            loop = asyncio.get_event_loop()
            with concurrent.futures.ThreadPoolExecutor() as executor:
                await loop.run_in_executor(
                    executor,
                    self._insert_usage_sync,
                    pool,
                    tenant_id,
                    provider,
                    model,
                    operation,
                    tokens_used,
                    cost_usd,
                    latency_ms
                )
        except Exception as e:
            logger.warning(f"Failed to track LLM usage: {e}")
    
    def _insert_usage_sync(
        self,
        pool,
        tenant_id: Optional[str],
        provider: str,
        model: str,
        operation: str,
        tokens_used: int,
        cost_usd: float,
        latency_ms: float
    ):
        """Synchronous database insert"""
        conn = pool.getconn()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO llm_usage 
                    (tenant_id, provider, model, operation, tokens_used, cost_usd, latency_ms, created_at)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                    """,
                    (tenant_id, provider, model, operation, tokens_used, float(cost_usd), float(latency_ms), datetime.utcnow())
                )
                conn.commit()
        finally:
            pool.putconn(conn)


# Global instance
_model_gateway: Optional[ModelGateway] = None

def get_model_gateway() -> ModelGateway:
    """Get global ModelGateway instance"""
    global _model_gateway
    if _model_gateway is None:
        _model_gateway = ModelGateway()
    return _model_gateway

