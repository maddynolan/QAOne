import redis
import json
import hashlib
from typing import Optional, Any, Dict
from datetime import datetime, timedelta
import logging

from app.core.config import settings, get_redis

logger = logging.getLogger(__name__)

class CacheService:
    """Redis-based caching service with LLM-aware cache keys"""
    
    def __init__(self):
        self.redis_client = get_redis()
        self.default_ttl = settings.llm_cache_ttl
    
    def _generate_cache_key(self, model_id: str, prompt_template: str, input_hash: str, policy_flags: str = "") -> str:
        """Generate cache key for LLM responses with versioning"""
        key_components = [
            f"llm:{model_id}",
            f"template:{settings.prompt_template_version}",
            f"input:{input_hash}",
            f"policy:{policy_flags}" if policy_flags else ""
        ]
        
        key_string = "|".join(filter(None, key_components))
        return f"qaai:{hashlib.md5(key_string.encode()).hexdigest()}"
    
    def _hash_input(self, input_data: Any) -> str:
        """Generate hash for input data"""
        if isinstance(input_data, dict):
            # Sort keys for consistent hashing
            sorted_data = json.dumps(input_data, sort_keys=True)
        else:
            sorted_data = str(input_data)
        
        return hashlib.md5(sorted_data.encode()).hexdigest()
    
    def get_llm_response(self, model_id: str, prompt_template: str, input_data: Any, policy_flags: str = "") -> Optional[Dict[str, Any]]:
        """Get cached LLM response"""
        if not settings.llm_cache_enabled:
            return None
        
        try:
            input_hash = self._hash_input(input_data)
            cache_key = self._generate_cache_key(model_id, prompt_template, input_hash, policy_flags)
            
            cached_data = self.redis_client.get(cache_key)
            if cached_data:
                logger.info(f"Cache hit for key: {cache_key}")
                return json.loads(cached_data)
            
            logger.info(f"Cache miss for key: {cache_key}")
            return None
            
        except Exception as e:
            logger.error(f"Error getting cached LLM response: {str(e)}")
            return None
    
    def set_llm_response(self, model_id: str, prompt_template: str, input_data: Any, response_data: Dict[str, Any], policy_flags: str = "", ttl: Optional[int] = None) -> bool:
        """Cache LLM response"""
        if not settings.llm_cache_enabled:
            return False
        
        try:
            input_hash = self._hash_input(input_data)
            cache_key = self._generate_cache_key(model_id, prompt_template, input_hash, policy_flags)
            
            # Add metadata to cached response
            cache_data = {
                "response": response_data,
                "metadata": {
                    "model_id": model_id,
                    "prompt_template": prompt_template,
                    "input_hash": input_hash,
                    "policy_flags": policy_flags,
                    "cached_at": datetime.utcnow().isoformat(),
                    "template_version": settings.prompt_template_version
                }
            }
            
            ttl = ttl or self.default_ttl
            self.redis_client.setex(cache_key, ttl, json.dumps(cache_data))
            
            logger.info(f"Cached LLM response with key: {cache_key}, TTL: {ttl}s")
            return True
            
        except Exception as e:
            logger.error(f"Error caching LLM response: {str(e)}")
            return False
    
    def invalidate_spec_cache(self, spec_hash: str) -> int:
        """Invalidate cache when specification changes"""
        try:
            pattern = f"qaai:*spec:{spec_hash}*"
            keys = self.redis_client.keys(pattern)
            if keys:
                deleted_count = self.redis_client.delete(*keys)
                logger.info(f"Invalidated {deleted_count} cache entries for spec: {spec_hash}")
                return deleted_count
            return 0
            
        except Exception as e:
            logger.error(f"Error invalidating spec cache: {str(e)}")
            return 0
    
    def invalidate_data_cache(self, data_hash: str) -> int:
        """Invalidate cache when test data changes"""
        try:
            pattern = f"qaai:*data:{data_hash}*"
            keys = self.redis_client.keys(pattern)
            if keys:
                deleted_count = self.redis_client.delete(*keys)
                logger.info(f"Invalidated {deleted_count} cache entries for data: {data_hash}")
                return deleted_count
            return 0
            
        except Exception as e:
            logger.error(f"Error invalidating data cache: {str(e)}")
            return 0
    
    def get_cache_stats(self) -> Dict[str, Any]:
        """Get cache statistics"""
        try:
            info = self.redis_client.info()
            
            # Get cache key patterns
            llm_keys = len(self.redis_client.keys("qaai:llm:*"))
            spec_keys = len(self.redis_client.keys("qaai:*spec:*"))
            data_keys = len(self.redis_client.keys("qaai:*data:*"))
            
            return {
                "redis_info": {
                    "used_memory": info.get("used_memory_human"),
                    "connected_clients": info.get("connected_clients"),
                    "total_commands_processed": info.get("total_commands_processed"),
                    "keyspace_hits": info.get("keyspace_hits"),
                    "keyspace_misses": info.get("keyspace_misses")
                },
                "cache_keys": {
                    "llm_responses": llm_keys,
                    "spec_cached": spec_keys,
                    "data_cached": data_keys,
                    "total": llm_keys + spec_keys + data_keys
                },
                "hit_rate": self._calculate_hit_rate(info)
            }
            
        except Exception as e:
            logger.error(f"Error getting cache stats: {str(e)}")
            return {"error": str(e)}
    
    def _calculate_hit_rate(self, info: Dict[str, Any]) -> float:
        """Calculate cache hit rate"""
        hits = info.get("keyspace_hits", 0)
        misses = info.get("keyspace_misses", 0)
        total = hits + misses
        
        if total == 0:
            return 0.0
        
        return round((hits / total) * 100, 2)
    
    def clear_cache(self, pattern: str = "qaai:*") -> int:
        """Clear cache entries matching pattern"""
        try:
            keys = self.redis_client.keys(pattern)
            if keys:
                deleted_count = self.redis_client.delete(*keys)
                logger.info(f"Cleared {deleted_count} cache entries matching pattern: {pattern}")
                return deleted_count
            return 0
            
        except Exception as e:
            logger.error(f"Error clearing cache: {str(e)}")
            return 0
    
    def set_test_plan_cache(self, plan_id: str, plan_data: Dict[str, Any], ttl: int = 3600) -> bool:
        """Cache test plan data"""
        try:
            cache_key = f"qaai:plan:{plan_id}"
            cache_data = {
                "plan": plan_data,
                "cached_at": datetime.utcnow().isoformat()
            }
            
            self.redis_client.setex(cache_key, ttl, json.dumps(cache_data))
            logger.info(f"Cached test plan: {plan_id}")
            return True
            
        except Exception as e:
            logger.error(f"Error caching test plan: {str(e)}")
            return False
    
    def get_test_plan_cache(self, plan_id: str) -> Optional[Dict[str, Any]]:
        """Get cached test plan data"""
        try:
            cache_key = f"qaai:plan:{plan_id}"
            cached_data = self.redis_client.get(cache_key)
            
            if cached_data:
                data = json.loads(cached_data)
                logger.info(f"Cache hit for test plan: {plan_id}")
                return data.get("plan")
            
            return None
            
        except Exception as e:
            logger.error(f"Error getting cached test plan: {str(e)}")
            return None
    
    def set_run_result_cache(self, run_id: str, run_data: Dict[str, Any], ttl: int = 1800) -> bool:
        """Cache run result data"""
        try:
            cache_key = f"qaai:run:{run_id}"
            cache_data = {
                "run": run_data,
                "cached_at": datetime.utcnow().isoformat()
            }
            
            self.redis_client.setex(cache_key, ttl, json.dumps(cache_data))
            logger.info(f"Cached run result: {run_id}")
            return True
            
        except Exception as e:
            logger.error(f"Error caching run result: {str(e)}")
            return False
    
    def get_run_result_cache(self, run_id: str) -> Optional[Dict[str, Any]]:
        """Get cached run result data"""
        try:
            cache_key = f"qaai:run:{run_id}"
            cached_data = self.redis_client.get(cache_key)
            
            if cached_data:
                data = json.loads(cached_data)
                logger.info(f"Cache hit for run result: {run_id}")
                return data.get("run")
            
            return None
            
        except Exception as e:
            logger.error(f"Error getting cached run result: {str(e)}")
            return None

# Global cache service instance
cache_service = CacheService()
