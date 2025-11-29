"""
Cache Service - Two-tier caching (L1 Redis + L2 Postgres)
Implements fast exact match (L1) and semantic similarity (L2) caching
"""

import logging
import os
import json
import hashlib
import asyncpg
import redis.asyncio as redis
from typing import Dict, Any, Optional, Tuple
import numpy as np
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)

class CacheService:
    """Four-tier caching service for LLM responses (L1/L2/L3/L4)"""
    
    def __init__(self):
        # Redis connection (L1 cache)
        self.redis_url = os.getenv("REDIS_URL", "redis://localhost:6379")
        self.redis_client: Optional[redis.Redis] = None
        
        # Postgres connection (L2 cache)
        self.database_url = os.getenv("DATABASE_URL")
        # Don't raise error on init - allow lazy initialization
        
        # Cache TTL settings
        self.l1_ttl_days = int(os.getenv("L1_CACHE_TTL_DAYS", "7"))
        self.l2_ttl_days = int(os.getenv("L2_CACHE_TTL_DAYS", "7"))
        
        # L2 semantic similarity threshold
        self.l2_similarity_threshold = float(os.getenv("L2_SIMILARITY_THRESHOLD", "0.92"))
        
        # L3: In-memory model cache (common patterns)
        self.model_cache: Dict[str, Dict[str, Any]] = {}
        self.model_cache_max_size = 1000
        
        # L4: Static templates
        self.static_templates = {
            "test_case_template": {
                "structure": {
                    "name": "string",
                    "description": "string",
                    "steps": [{"action": "string", "expectedResult": "string"}],
                    "priority": "low|medium|high|critical",
                    "tags": ["string"]
                }
            }
        }
    
    async def initialize(self):
        """Initialize Redis and Postgres connections"""
        if not self.redis_client:
            self.redis_client = await redis.from_url(
                self.redis_url,
                encoding="utf-8",
                decode_responses=True
            )
            # Test connection
            await self.redis_client.ping()
            logger.info("Redis L1 cache connected")
    
    async def cleanup(self):
        """Cleanup connections"""
        if self.redis_client:
            await self.redis_client.aclose()
            self.redis_client = None
    
    def _generate_cache_key(
        self,
        org_id: str,
        prompt: str,
        model_version: str,
        test_type: Optional[str] = None,
        project_id: Optional[str] = None,
        prompt_template_version: Optional[str] = None
    ) -> str:
        """
        Generate deterministic cache key
        
        Format: org_id:model_version:test_type:template_version:hash(prompt)
        """
        # Normalize prompt (remove whitespace, lowercase)
        normalized = ' '.join(prompt.lower().split())
        
        # Create hash of prompt
        prompt_hash = hashlib.sha256(normalized.encode('utf-8')).hexdigest()[:16]
        
        # Build key components
        parts = [org_id, model_version]
        if test_type:
            parts.append(test_type)
        if project_id:
            parts.append(project_id)
        if prompt_template_version:
            parts.append(prompt_template_version)
        parts.append(prompt_hash)
        
        return ':'.join(parts)
    
    async def l1_get(self, cache_key: str) -> Optional[Dict[str, Any]]:
        """
        Get from L1 cache (Redis) - exact match
        
        Args:
            cache_key: Cache key
            
        Returns:
            Cached response dict or None if miss
        """
        if not self.redis_client:
            await self.initialize()
        
        try:
            cached_data = await self.redis_client.get(cache_key)
            if cached_data:
                data = json.loads(cached_data)
                logger.debug(f"L1 cache HIT: {cache_key[:50]}...")
                return data
            else:
                logger.debug(f"L1 cache MISS: {cache_key[:50]}...")
                return None
        except Exception as e:
            logger.warning(f"L1 cache get error: {e}")
            return None
    
    async def l1_set(
        self,
        cache_key: str,
        response: Dict[str, Any],
        ttl_days: Optional[int] = None
    ) -> bool:
        """
        Set L1 cache (Redis)
        
        Args:
            cache_key: Cache key
            response: Response to cache
            ttl_days: Time to live in days (defaults to L1_TTL_DAYS)
            
        Returns:
            True if successful
        """
        if not self.redis_client:
            await self.initialize()
        
        try:
            ttl = (ttl_days or self.l1_ttl_days) * 24 * 60 * 60  # Convert to seconds
            data = json.dumps(response)
            await self.redis_client.setex(cache_key, ttl, data)
            logger.debug(f"L1 cache SET: {cache_key[:50]}... (TTL: {ttl_days or self.l1_ttl_days} days)")
            return True
        except Exception as e:
            logger.warning(f"L1 cache set error: {e}")
            return False
    
    async def l2_semantic_get(
        self,
        organization_id: str,
        query_embedding: np.ndarray,
        similarity_threshold: Optional[float] = None,
        project_id: Optional[str] = None,
        test_type: Optional[str] = None
    ) -> Optional[Tuple[Dict[str, Any], float]]:
        """
        Get from L2 cache (Postgres) - semantic similarity
        
        Args:
            organization_id: Organization ID
            query_embedding: Query embedding vector
            similarity_threshold: Minimum similarity (defaults to config)
            project_id: Optional project filter
            test_type: Optional test type filter
            
        Returns:
            Tuple of (cached response, similarity score) or None if miss
        """
        if not self.database_url:
            logger.warning("DATABASE_URL not set, skipping L2 cache")
            return None
        conn = await asyncpg.connect(self.database_url)
        
        try:
            threshold = similarity_threshold or self.l2_similarity_threshold
            embedding_str = '[' + ','.join(map(str, query_embedding.tolist())) + ']'
            
            # Build query with filters
            query = """
                SELECT 
                    id,
                    response_json,
                    model_version,
                    test_type,
                    1 - (request_embedding <=> $1::vector) as similarity
                FROM cached_responses
                WHERE organization_id = $2::uuid
                  AND expires_at > NOW()
                  AND 1 - (request_embedding <=> $1::vector) >= $3
            """
            
            params = [embedding_str, organization_id, threshold]
            param_idx = 4
            
            if project_id:
                query += f" AND project_id = ${param_idx}::uuid"
                params.append(project_id)
                param_idx += 1
            
            if test_type:
                query += f" AND test_type = ${param_idx}"
                params.append(test_type)
                param_idx += 1
            
            query += """
                ORDER BY request_embedding <=> $1::vector
                LIMIT 1
            """
            
            row = await conn.fetchrow(query, *params)
            
            if row:
                similarity = float(row['similarity'])
                logger.debug(f"L2 cache HIT: similarity={similarity:.2%}")
                
                # Update hit tracking
                await conn.execute(
                    "SELECT update_cache_hit($1)",
                    row['id']
                )
                
                return (
                    json.loads(row['response_json']) if isinstance(row['response_json'], str) else row['response_json'],
                    similarity
                )
            else:
                logger.debug("L2 cache MISS")
                return None
                
        except Exception as e:
            logger.warning(f"L2 cache get error: {e}")
            return None
        finally:
            await conn.close()
    
    async def l2_semantic_set(
        self,
        organization_id: str,
        cache_key: str,
        request_embedding: np.ndarray,
        response: Dict[str, Any],
        model_version: str,
        ttl_days: Optional[int] = None,
        project_id: Optional[str] = None,
        test_type: Optional[str] = None,
        prompt_template_version: Optional[str] = None
    ) -> bool:
        """
        Set L2 cache (Postgres) - semantic similarity
        
        Args:
            organization_id: Organization ID
            cache_key: Cache key for exact matching
            request_embedding: Request embedding vector
            response: Response to cache
            model_version: Model version used
            ttl_days: Time to live in days
            project_id: Optional project ID
            test_type: Optional test type
            prompt_template_version: Optional prompt template version
            
        Returns:
            True if successful
        """
        if not self.database_url:
            logger.warning("DATABASE_URL not set, skipping L2 cache set")
            return False
        conn = await asyncpg.connect(self.database_url)
        
        try:
            ttl = ttl_days or self.l2_ttl_days
            embedding_str = '[' + ','.join(map(str, request_embedding.tolist())) + ']'
            
            query = """
                INSERT INTO cached_responses (
                    organization_id,
                    project_id,
                    request_key,
                    request_embedding,
                    response_json,
                    model_version,
                    prompt_template_version,
                    test_type,
                    ttl_days,
                    created_at
                ) VALUES ($1, $2, $3, $4::vector, $5, $6, $7, $8, $9, NOW())
                ON CONFLICT (request_key) DO UPDATE SET
                    response_json = EXCLUDED.response_json,
                    request_embedding = EXCLUDED.request_embedding,
                    hit_count = 0,
                    last_hit_at = NULL,
                    created_at = NOW()
            """
            
            await conn.execute(
                query,
                organization_id,
                project_id,
                cache_key,
                embedding_str,
                json.dumps(response) if not isinstance(response, str) else response,
                model_version,
                prompt_template_version,
                test_type,
                ttl
            )
            
            logger.debug(f"L2 cache SET: {cache_key[:50]}... (TTL: {ttl} days)")
            return True
            
        except Exception as e:
            logger.warning(f"L2 cache set error: {e}")
            return False
        finally:
            await conn.close()
    
    async def get_cache_stats(self, organization_id: str) -> Dict[str, Any]:
        """Get cache statistics for an organization"""
        stats = {
            'l1_hits': 0,
            'l1_misses': 0,
            'l2_hits': 0,
            'l2_misses': 0,
        }
        
        # TODO: Implement actual stats tracking
        # This would require maintaining counters in Redis/Postgres
        
        return stats


# Global instance
cache_service = CacheService()

