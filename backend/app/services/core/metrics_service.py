"""
Metrics Service - Observability and monitoring for RAG + caching system
Tracks cache hit rates, latency, token usage, and RAG quality metrics
"""

import logging
import os
import time
from typing import Dict, Any, Optional, List
from datetime import datetime, timedelta
import asyncpg
import redis.asyncio as redis

logger = logging.getLogger(__name__)

class MetricsService:
    """Service for tracking and retrieving observability metrics"""
    
    def __init__(self):
        # Redis for fast counters
        self.redis_url = os.getenv("REDIS_URL", "redis://localhost:6379")
        self.redis_client: Optional[redis.Redis] = None
        
        # Postgres for persistent storage
        self.database_url = os.getenv("DATABASE_URL")
        
        # Metric keys prefix
        self.metrics_prefix = "metrics:"
    
    async def initialize(self):
        """Initialize Redis connection"""
        if not self.redis_client:
            try:
                self.redis_client = await redis.from_url(
                    self.redis_url,
                    encoding="utf-8",
                    decode_responses=True
                )
                await self.redis_client.ping()
                logger.info("Metrics service Redis connected")
            except Exception as e:
                logger.warning(f"Redis not available for metrics: {e}")
                self.redis_client = None
    
    async def cleanup(self):
        """Cleanup connections"""
        if self.redis_client:
            await self.redis_client.aclose()
            self.redis_client = None
    
    def _get_metric_key(self, org_id: str, metric_type: str, period: str = "day") -> str:
        """Generate metric key for Redis"""
        date_str = datetime.now().strftime("%Y-%m-%d")
        return f"{self.metrics_prefix}{org_id}:{metric_type}:{period}:{date_str}"
    
    async def record_cache_hit(self, org_id: str, cache_level: str, latency_ms: int):
        """Record a cache hit (L1 or L2)"""
        if not self.redis_client:
            await self.initialize()
        
        if not self.redis_client:
            return  # Silently fail if Redis unavailable
        
        try:
            # Record hit count
            hit_key = self._get_metric_key(org_id, f"{cache_level}_hits")
            await self.redis_client.incr(hit_key)
            await self.redis_client.expire(hit_key, 86400 * 7)  # Keep for 7 days
            
            # Record latency
            latency_key = self._get_metric_key(org_id, f"{cache_level}_latency")
            await self.redis_client.lpush(latency_key, latency_ms)
            await self.redis_client.ltrim(latency_key, 0, 999)  # Keep last 1000 samples
            await self.redis_client.expire(latency_key, 86400 * 7)
            
        except Exception as e:
            logger.warning(f"Failed to record cache hit: {e}")
    
    async def record_cache_miss(self, org_id: str, cache_level: str):
        """Record a cache miss (L1 or L2)"""
        if not self.redis_client:
            await self.initialize()
        
        if not self.redis_client:
            return
        
        try:
            miss_key = self._get_metric_key(org_id, f"{cache_level}_misses")
            await self.redis_client.incr(miss_key)
            await self.redis_client.expire(miss_key, 86400 * 7)
        except Exception as e:
            logger.warning(f"Failed to record cache miss: {e}")
    
    async def record_generation(
        self,
        org_id: str,
        model: str,
        latency_ms: int,
        cache_hit: bool,
        cache_level: Optional[str] = None,
        rag_used: bool = False,
        rag_similarity: Optional[float] = None,
        tokens_estimated: Optional[int] = None
    ):
        """Record a generation event (cache miss, requires LLM)"""
        if not self.redis_client:
            await self.initialize()
        
        if not self.redis_client:
            return
        
        try:
            # Record generation count by model
            gen_key = self._get_metric_key(org_id, f"generations:{model}")
            await self.redis_client.incr(gen_key)
            await self.redis_client.expire(gen_key, 86400 * 7)
            
            # Record latency by model
            latency_key = self._get_metric_key(org_id, f"latency:{model}")
            await self.redis_client.lpush(latency_key, latency_ms)
            await self.redis_client.ltrim(latency_key, 0, 999)
            await self.redis_client.expire(latency_key, 86400 * 7)
            
            # Record RAG usage
            if rag_used:
                rag_key = self._get_metric_key(org_id, "rag_used")
                await self.redis_client.incr(rag_key)
                await self.redis_client.expire(rag_key, 86400 * 7)
                
                if rag_similarity is not None:
                    similarity_key = self._get_metric_key(org_id, "rag_similarity")
                    await self.redis_client.lpush(similarity_key, rag_similarity)
                    await self.redis_client.ltrim(similarity_key, 0, 999)
                    await self.redis_client.expire(similarity_key, 86400 * 7)
            
            # Record token usage (estimated)
            if tokens_estimated:
                tokens_key = self._get_metric_key(org_id, f"tokens:{model}")
                await self.redis_client.incrby(tokens_key, tokens_estimated)
                await self.redis_client.expire(tokens_key, 86400 * 7)
                
        except Exception as e:
            logger.warning(f"Failed to record generation: {e}")
    
    async def get_metrics(
        self,
        organization_id: str,
        days: int = 7
    ) -> Dict[str, Any]:
        """
        Get comprehensive metrics for an organization
        
        Returns:
            Dictionary with cache hit rates, latency stats, token usage, etc.
        """
        if not self.redis_client:
            await self.initialize()
        
        if not self.redis_client:
            return {
                "error": "Redis not available for metrics",
                "cache_hit_rates": {},
                "latency_stats": {},
                "token_usage": {},
                "rag_stats": {}
            }
        
        try:
            metrics = {
                "organization_id": organization_id,
                "period_days": days,
                "cache_hit_rates": {},
                "latency_stats": {},
                "token_usage": {},
                "rag_stats": {},
                "generation_counts": {}
            }
            
            # Collect metrics for the last N days
            today = datetime.now()
            all_l1_hits = 0
            all_l1_misses = 0
            all_l2_hits = 0
            all_l2_misses = 0
            
            for day_offset in range(days):
                date_str = (today - timedelta(days=day_offset)).strftime("%Y-%m-%d")
                
                # L1 cache metrics
                l1_hits_key = f"{self.metrics_prefix}{organization_id}:L1_hits:day:{date_str}"
                l1_misses_key = f"{self.metrics_prefix}{organization_id}:L1_misses:day:{date_str}"
                l1_hits = await self.redis_client.get(l1_hits_key) or "0"
                l1_misses = await self.redis_client.get(l1_misses_key) or "0"
                all_l1_hits += int(l1_hits)
                all_l1_misses += int(l1_misses)
                
                # L2 cache metrics
                l2_hits_key = f"{self.metrics_prefix}{organization_id}:L2_hits:day:{date_str}"
                l2_misses_key = f"{self.metrics_prefix}{organization_id}:L2_misses:day:{date_str}"
                l2_hits = await self.redis_client.get(l2_hits_key) or "0"
                l2_misses = await self.redis_client.get(l2_misses_key) or "0"
                all_l2_hits += int(l2_hits)
                all_l2_misses += int(l2_misses)
            
            # Calculate hit rates
            total_l1 = all_l1_hits + all_l1_misses
            total_l2 = all_l2_hits + all_l2_misses
            total_requests = all_l1_hits + all_l2_hits + all_l1_misses  # L1 misses become L2 checks
            
            metrics["cache_hit_rates"] = {
                "l1": {
                    "hits": all_l1_hits,
                    "misses": all_l1_misses,
                    "total": total_l1,
                    "hit_rate": (all_l1_hits / total_l1 * 100) if total_l1 > 0 else 0
                },
                "l2": {
                    "hits": all_l2_hits,
                    "misses": all_l2_misses,
                    "total": total_l2,
                    "hit_rate": (all_l2_hits / total_l2 * 100) if total_l2 > 0 else 0
                },
                "combined": {
                    "total_hits": all_l1_hits + all_l2_hits,
                    "total_requests": total_requests,
                    "hit_rate": ((all_l1_hits + all_l2_hits) / total_requests * 100) if total_requests > 0 else 0
                }
            }
            
            # Get latency stats (from today's data)
            today_str = today.strftime("%Y-%m-%d")
            
            # L1 latency
            l1_latency_key = f"{self.metrics_prefix}{organization_id}:L1_latency:day:{today_str}"
            l1_latencies = await self.redis_client.lrange(l1_latency_key, 0, 999)
            if l1_latencies:
                l1_latencies = [float(x) for x in l1_latencies]
                metrics["latency_stats"]["l1"] = {
                    "mean": sum(l1_latencies) / len(l1_latencies),
                    "min": min(l1_latencies),
                    "max": max(l1_latencies),
                    "p50": sorted(l1_latencies)[len(l1_latencies) // 2] if l1_latencies else 0,
                    "p95": sorted(l1_latencies)[int(len(l1_latencies) * 0.95)] if l1_latencies else 0,
                    "samples": len(l1_latencies)
                }
            
            # L2 latency
            l2_latency_key = f"{self.metrics_prefix}{organization_id}:L2_latency:day:{today_str}"
            l2_latencies = await self.redis_client.lrange(l2_latency_key, 0, 999)
            if l2_latencies:
                l2_latencies = [float(x) for x in l2_latencies]
                metrics["latency_stats"]["l2"] = {
                    "mean": sum(l2_latencies) / len(l2_latencies),
                    "min": min(l2_latencies),
                    "max": max(l2_latencies),
                    "p50": sorted(l2_latencies)[len(l2_latencies) // 2] if l2_latencies else 0,
                    "p95": sorted(l2_latencies)[int(len(l2_latencies) * 0.95)] if l2_latencies else 0,
                    "samples": len(l2_latencies)
                }
            
            # Generation latency by model
            for model in ["qwen2.5:7b-instruct", "qwen2.5-coder:14b"]:
                model_latency_key = f"{self.metrics_prefix}{organization_id}:latency:{model}:day:{today_str}"
                model_latencies = await self.redis_client.lrange(model_latency_key, 0, 999)
                if model_latencies:
                    model_latencies = [float(x) for x in model_latencies]
                    metrics["latency_stats"][model] = {
                        "mean": sum(model_latencies) / len(model_latencies),
                        "min": min(model_latencies),
                        "max": max(model_latencies),
                        "p50": sorted(model_latencies)[len(model_latencies) // 2],
                        "p95": sorted(model_latencies)[int(len(model_latencies) * 0.95)],
                        "samples": len(model_latencies)
                    }
            
            # Token usage
            for model in ["qwen2.5:7b-instruct", "qwen2.5-coder:14b"]:
                tokens_key = f"{self.metrics_prefix}{organization_id}:tokens:{model}:day:{today_str}"
                tokens = await self.redis_client.get(tokens_key)
                if tokens:
                    metrics["token_usage"][model] = int(tokens)
            
            # RAG stats
            rag_used_key = f"{self.metrics_prefix}{organization_id}:rag_used:day:{today_str}"
            rag_used_count = await self.redis_client.get(rag_used_key) or "0"
            
            rag_similarity_key = f"{self.metrics_prefix}{organization_id}:rag_similarity:day:{today_str}"
            rag_similarities = await self.redis_client.lrange(rag_similarity_key, 0, 999)
            
            metrics["rag_stats"] = {
                "usage_count": int(rag_used_count),
                "avg_similarity": (
                    sum(float(x) for x in rag_similarities) / len(rag_similarities)
                    if rag_similarities else 0
                ),
                "samples": len(rag_similarities) if rag_similarities else 0
            }
            
            # Generation counts by model
            for model in ["qwen2.5:7b-instruct", "qwen2.5-coder:14b"]:
                gen_key = f"{self.metrics_prefix}{organization_id}:generations:{model}:day:{today_str}"
                gen_count = await self.redis_client.get(gen_key) or "0"
                metrics["generation_counts"][model] = int(gen_count)
            
            return metrics
            
        except Exception as e:
            logger.error(f"Error getting metrics: {e}")
            return {
                "error": str(e),
                "cache_hit_rates": {},
                "latency_stats": {},
                "token_usage": {},
                "rag_stats": {}
            }


# Global instance
metrics_service = MetricsService()


