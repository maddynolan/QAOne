#!/usr/bin/env python3
"""
Advanced 4-Tier Caching System
L1: Redis (exact match, <1ms)
L2: Postgres (semantic similarity, <100ms)
L3: Model cache (common patterns, in-memory)
L4: CDN (static templates, <10ms)
"""

import redis
import json
import hashlib
from typing import Dict, Optional, Any, Tuple
from datetime import datetime, timedelta

# L1: Redis cache
redis_client = redis.Redis(host='localhost', port=6379, db=0, decode_responses=True)

# L3: In-memory model cache (common patterns)
model_cache: Dict[str, Any] = {}
model_cache_max_size = 1000

# L4: Static templates (could use CDN, but for now in-memory)
static_templates = {
    "test_case_template": {
        "structure": {
            "name": "string",
            "description": "string",
            "steps": [{"action": "string", "expectedResult": "string"}],
            "priority": "low|medium|high|critical",
            "tags": ["string"]
        },
        "example": {
            "name": "User login test",
            "description": "Test user login functionality",
            "steps": [
                {"action": "Navigate to login page", "expectedResult": "Login page loads"},
                {"action": "Enter credentials", "expectedResult": "Credentials entered"},
                {"action": "Click login", "expectedResult": "User logged in"}
            ],
            "priority": "high",
            "tags": ["authentication", "login"]
        }
    }
}


def generate_cache_key(prompt: str, model: str, task_type: Optional[str] = None) -> str:
    """Generate cache key from prompt and model"""
    key_data = f"{prompt}:{model}:{task_type or ''}"
    return hashlib.md5(key_data.encode()).hexdigest()


async def get_from_cache(
    prompt: str,
    model: str,
    task_type: Optional[str] = None,
    similarity_threshold: float = 0.92
) -> Tuple[Optional[Dict[str, Any]], str]:
    """
    Try to get from cache (L1 → L2 → L3 → L4)
    Returns: (cached_data, cache_tier) or (None, None)
    """
    cache_key = generate_cache_key(prompt, model, task_type)
    
    # L1: Redis (exact match, <1ms)
    try:
        cached = redis_client.get(f"l1:{cache_key}")
        if cached:
            logger.info(f"L1 cache hit: {cache_key[:16]}...")
            return json.loads(cached), "L1"
    except Exception as e:
        logger.debug(f"L1 cache error: {e}")
    
    # L2: Postgres semantic cache (similarity, <100ms)
    try:
        from app.services.postgres_direct import execute_query
        
        # Get embedding for prompt
        from app.services.embedding_service import embedding_service
        await embedding_service.initialize()
        prompt_embedding = await embedding_service.generate_embedding(prompt)
        
        # Search for similar cached responses
        query = """
            SELECT 
                prompt,
                response,
                model,
                similarity(prompt_embedding, %s::vector) as similarity
            FROM cached_responses
            WHERE model = %s
              AND similarity(prompt_embedding, %s::vector) >= %s
            ORDER BY similarity DESC
            LIMIT 1
        """
        
        results = await execute_query(query, (prompt_embedding.tolist(), model, prompt_embedding.tolist(), similarity_threshold))
        
        if results and len(results) > 0:
            result = results[0]
            similarity = result.get("similarity", 0)
            if similarity >= similarity_threshold:
                logger.info(f"L2 cache hit: similarity={similarity:.3f}")
                return {
                    "response": result.get("response"),
                    "similarity": similarity,
                    "source": "L2"
                }, "L2"
    except Exception as e:
        logger.debug(f"L2 cache error: {e}")
    
    # L3: Model cache (common patterns, in-memory)
    # Check if prompt matches common patterns
    for pattern_key, pattern_data in model_cache.items():
        if _matches_pattern(prompt, pattern_data["pattern"]):
            logger.info(f"L3 cache hit: pattern={pattern_key}")
            return pattern_data["response"], "L3"
    
    # L4: CDN/Static templates (if prompt matches template)
    if _matches_template(prompt):
        template = static_templates.get("test_case_template")
        if template:
            logger.info("L4 cache hit: static template")
            return {"template": template, "source": "L4"}, "L4"
    
    return None, None


async def set_cache(
    prompt: str,
    model: str,
    response: str,
    task_type: Optional[str] = None,
    ttl: int = 3600
):
    """Set cache in all tiers (as appropriate)"""
    cache_key = generate_cache_key(prompt, model, task_type)
    
    # L1: Redis (exact match)
    try:
        redis_client.setex(
            f"l1:{cache_key}",
            ttl,
            json.dumps({"response": response, "model": model, "timestamp": datetime.utcnow().isoformat()})
        )
    except Exception as e:
        logger.debug(f"L1 cache set error: {e}")
    
    # L2: Postgres semantic cache (store embedding + response)
    try:
        from app.services.embedding_service import embedding_service
        await embedding_service.initialize()
        prompt_embedding = await embedding_service.generate_embedding(prompt)
        
        from app.services.postgres_direct import execute_insert
        
        data = {
            "prompt": prompt,
            "prompt_embedding": prompt_embedding.tolist(),
            "response": response,
            "model": model,
            "task_type": task_type,
            "created_at": datetime.utcnow()
        }
        
        await execute_insert("cached_responses", data)
    except Exception as e:
        logger.debug(f"L2 cache set error: {e}")
    
    # L3: Model cache (store common patterns)
    if _is_common_pattern(prompt):
        pattern_key = _extract_pattern(prompt)
        if len(model_cache) >= model_cache_max_size:
            # Remove oldest entry
            oldest_key = min(model_cache.keys(), key=lambda k: model_cache[k]["timestamp"])
            del model_cache[oldest_key]
        
        model_cache[pattern_key] = {
            "pattern": pattern_key,
            "response": response,
            "timestamp": datetime.utcnow()
        }


def _matches_pattern(prompt: str, pattern: str) -> bool:
    """Check if prompt matches a cached pattern"""
    # Simple keyword matching (could be enhanced with ML)
    pattern_words = set(pattern.lower().split())
    prompt_words = set(prompt.lower().split())
    overlap = len(pattern_words & prompt_words) / len(pattern_words) if pattern_words else 0
    return overlap >= 0.7  # 70% keyword overlap


def _matches_template(prompt: str) -> bool:
    """Check if prompt matches a template pattern"""
    template_keywords = ["generate", "test case", "test", "requirement"]
    prompt_lower = prompt.lower()
    return any(keyword in prompt_lower for keyword in template_keywords)


def _is_common_pattern(prompt: str) -> bool:
    """Determine if prompt represents a common pattern worth caching"""
    # Common patterns: simple test case generation requests
    simple_patterns = [
        "generate test case",
        "create test",
        "test for",
        "test scenario"
    ]
    prompt_lower = prompt.lower()
    return any(pattern in prompt_lower for pattern in simple_patterns)


def _extract_pattern(prompt: str) -> str:
    """Extract pattern from prompt (simplified version)"""
    # Extract key words (could be enhanced)
    words = prompt.lower().split()
    key_words = [w for w in words if len(w) > 4]  # Keep words > 4 chars
    return " ".join(key_words[:5])  # First 5 key words


# Logging
import logging
logger = logging.getLogger(__name__)

