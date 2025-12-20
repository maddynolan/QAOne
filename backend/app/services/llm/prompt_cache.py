"""
Intelligent Prompt Cache - Persistent, Cost-Optimized LLM Response Caching
=========================================================================

This module provides a robust caching system for LLM responses with:
1. SQLite-backed persistent storage (survives restarts)
2. Semantic similarity matching (find similar cached prompts)
3. Configurable TTL per task type
4. Cache statistics and monitoring
5. Automatic cache cleanup

Cost Savings:
- Local cache hit = 100% cost savings (no API call)
- Anthropic prompt cache hit = 90% savings on input tokens
- Semantic cache hit = ~95% savings (near-identical prompts)

Usage:
    cache = PromptCache()
    
    # Check cache first
    cached = await cache.get(prompt, model, task_type)
    if cached:
        return cached
    
    # Make API call
    response = await call_llm(prompt)
    
    # Store in cache
    await cache.set(prompt, model, task_type, response)
"""

import os
import json
import hashlib
import logging
import sqlite3
import threading
import re
from datetime import datetime, timedelta
from typing import Optional, Dict, Any, List, Tuple
from pathlib import Path
from contextlib import contextmanager
from dataclasses import dataclass
from enum import Enum

logger = logging.getLogger(__name__)


class CacheStrategy(Enum):
    """Cache matching strategies"""
    EXACT = "exact"           # Exact hash match only
    NORMALIZED = "normalized"  # Normalized text match (whitespace, case)
    SEMANTIC = "semantic"      # Similar prompts (keywords, structure)


@dataclass
class CacheConfig:
    """Cache configuration"""
    # TTL settings per task type (in hours)
    ttl_by_task: Dict[str, int] = None
    
    # Default TTL (24 hours)
    default_ttl_hours: int = 24
    
    # Max cache entries
    max_entries: int = 10000
    
    # Enable semantic matching
    enable_semantic: bool = True
    
    # Semantic similarity threshold (0-1)
    semantic_threshold: float = 0.85
    
    # Database path
    db_path: str = None
    
    def __post_init__(self):
        if self.ttl_by_task is None:
            self.ttl_by_task = {
                # Deterministic tasks - long TTL
                "selector_generation": 168,  # 7 days
                "simple_assertion": 168,
                "element_description": 168,
                "basic_validation": 72,
                
                # Semi-deterministic - medium TTL
                "test_generation": 24,
                "flow_analysis": 24,
                
                # Dynamic tasks - short TTL
                "debugging": 4,
                "refactoring": 12,
                "multi_step_test": 12,
            }
        
        if self.db_path is None:
            self.db_path = str(Path(__file__).parent / "prompt_cache.db")


class PromptNormalizer:
    """Normalize prompts for better cache matching"""
    
    @staticmethod
    def normalize(text: str) -> str:
        """
        Normalize prompt text for cache key generation.
        Removes variable parts while preserving semantic meaning.
        """
        if not text:
            return ""
        
        # Convert to lowercase
        text = text.lower()
        
        # Normalize whitespace
        text = re.sub(r'\s+', ' ', text)
        
        # Remove timestamps
        text = re.sub(r'\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}:\d{2}', '[TIMESTAMP]', text)
        
        # Normalize UUIDs
        text = re.sub(r'[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}', '[UUID]', text)
        
        # Normalize session IDs (common patterns)
        text = re.sub(r'session[_-]?[a-z0-9]{8,}', '[SESSION]', text)
        
        # Normalize URLs (but keep paths)
        text = re.sub(r'https?://[^\s/]+', '[HOST]', text)
        
        # Strip leading/trailing whitespace
        text = text.strip()
        
        return text
    
    @staticmethod
    def extract_keywords(text: str) -> List[str]:
        """Extract key terms for semantic matching"""
        # Common stop words to ignore
        stop_words = {
            'a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'been',
            'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will',
            'would', 'could', 'should', 'may', 'might', 'must', 'shall',
            'can', 'need', 'to', 'of', 'in', 'for', 'on', 'with', 'at',
            'by', 'from', 'as', 'into', 'through', 'during', 'before',
            'after', 'above', 'below', 'between', 'under', 'again',
            'further', 'then', 'once', 'here', 'there', 'when', 'where',
            'why', 'how', 'all', 'each', 'few', 'more', 'most', 'other',
            'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same',
            'so', 'than', 'too', 'very', 'just', 'and', 'but', 'if', 'or',
            'because', 'until', 'while', 'this', 'that', 'these', 'those'
        }
        
        # Normalize and split
        text = text.lower()
        words = re.findall(r'\b[a-z][a-z0-9_]+\b', text)
        
        # Filter and dedupe
        keywords = list(set(w for w in words if w not in stop_words and len(w) > 2))
        
        return sorted(keywords)[:50]  # Top 50 keywords


class PromptCache:
    """
    Persistent, intelligent LLM response cache.
    
    Features:
    - SQLite-backed for persistence across restarts
    - Normalized prompt matching
    - Semantic similarity matching
    - Per-task TTL configuration
    - Automatic cleanup of expired entries
    """
    
    def __init__(self, config: Optional[CacheConfig] = None):
        self.config = config or CacheConfig()
        self.normalizer = PromptNormalizer()
        self._local = threading.local()
        self._init_db()
        
        # Statistics
        self._stats = {
            "hits": 0,
            "misses": 0,
            "semantic_hits": 0,
            "writes": 0,
            "evictions": 0,
            "start_time": datetime.utcnow().isoformat()
        }
        
        logger.debug(f"PromptCache initialized. DB: {self.config.db_path}")
    
    @contextmanager
    def _get_conn(self):
        """Get thread-local database connection"""
        if not hasattr(self._local, 'conn') or self._local.conn is None:
            self._local.conn = sqlite3.connect(
                self.config.db_path,
                check_same_thread=False
            )
            self._local.conn.row_factory = sqlite3.Row
        
        try:
            yield self._local.conn
        except Exception as e:
            self._local.conn.rollback()
            raise
    
    def _init_db(self):
        """Initialize database schema"""
        with self._get_conn() as conn:
            conn.executescript("""
                CREATE TABLE IF NOT EXISTS prompt_cache (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    hash_exact TEXT NOT NULL,
                    hash_normalized TEXT NOT NULL,
                    model TEXT NOT NULL,
                    task_type TEXT NOT NULL,
                    prompt_preview TEXT,
                    keywords TEXT,
                    response TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    expires_at TEXT NOT NULL,
                    hit_count INTEGER DEFAULT 0,
                    last_hit_at TEXT,
                    tokens_saved INTEGER DEFAULT 0
                );
                
                CREATE INDEX IF NOT EXISTS idx_hash_exact ON prompt_cache(hash_exact);
                CREATE INDEX IF NOT EXISTS idx_hash_normalized ON prompt_cache(hash_normalized);
                CREATE INDEX IF NOT EXISTS idx_expires_at ON prompt_cache(expires_at);
                CREATE INDEX IF NOT EXISTS idx_model_task ON prompt_cache(model, task_type);
                
                CREATE TABLE IF NOT EXISTS cache_stats (
                    id INTEGER PRIMARY KEY,
                    stat_name TEXT UNIQUE NOT NULL,
                    stat_value TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                );
            """)
            conn.commit()
    
    def _hash_exact(self, prompt: str, model: str) -> str:
        """Generate exact match hash"""
        content = f"{model}:{prompt}"
        return hashlib.sha256(content.encode()).hexdigest()
    
    def _hash_normalized(self, prompt: str, model: str) -> str:
        """Generate normalized hash"""
        normalized = self.normalizer.normalize(prompt)
        content = f"{model}:{normalized}"
        return hashlib.sha256(content.encode()).hexdigest()
    
    def _get_ttl(self, task_type: str) -> int:
        """Get TTL in hours for task type"""
        return self.config.ttl_by_task.get(
            task_type, 
            self.config.default_ttl_hours
        )
    
    async def get(
        self,
        prompt: str,
        model: str,
        task_type: str = "test_generation",
        strategy: CacheStrategy = CacheStrategy.NORMALIZED
    ) -> Optional[Dict[str, Any]]:
        """
        Retrieve cached response for a prompt.
        
        Args:
            prompt: The LLM prompt
            model: Model name (e.g., claude-sonnet-4)
            task_type: Type of task for TTL selection
            strategy: Cache matching strategy
            
        Returns:
            Cached response dict or None if not found
        """
        now = datetime.utcnow()
        
        # Try exact match first
        hash_exact = self._hash_exact(prompt, model)
        
        with self._get_conn() as conn:
            # Clean expired entries periodically
            if self._stats["hits"] % 100 == 0:
                self._cleanup_expired(conn)
            
            # Exact match
            cursor = conn.execute("""
                SELECT * FROM prompt_cache 
                WHERE hash_exact = ? AND expires_at > ?
                LIMIT 1
            """, (hash_exact, now.isoformat()))
            
            row = cursor.fetchone()
            
            if row:
                self._record_hit(conn, row['id'])
                self._stats["hits"] += 1
                logger.debug(f"Cache HIT (exact): {hash_exact[:12]}...")
                return {
                    "response": row['response'],
                    "from_cache": True,
                    "cache_type": "exact",
                    "hit_count": row['hit_count'] + 1
                }
            
            # Normalized match
            if strategy in [CacheStrategy.NORMALIZED, CacheStrategy.SEMANTIC]:
                hash_normalized = self._hash_normalized(prompt, model)
                
                cursor = conn.execute("""
                    SELECT * FROM prompt_cache 
                    WHERE hash_normalized = ? AND model = ? AND expires_at > ?
                    LIMIT 1
                """, (hash_normalized, model, now.isoformat()))
                
                row = cursor.fetchone()
                
                if row:
                    self._record_hit(conn, row['id'])
                    self._stats["hits"] += 1
                    logger.debug(f"Cache HIT (normalized): {hash_normalized[:12]}...")
                    return {
                        "response": row['response'],
                        "from_cache": True,
                        "cache_type": "normalized",
                        "hit_count": row['hit_count'] + 1
                    }
            
            # Semantic match (keyword overlap)
            if strategy == CacheStrategy.SEMANTIC and self.config.enable_semantic:
                keywords = self.normalizer.extract_keywords(prompt)
                
                if keywords:
                    semantic_match = self._find_semantic_match(
                        conn, keywords, model, task_type, now
                    )
                    
                    if semantic_match:
                        self._record_hit(conn, semantic_match['id'])
                        self._stats["hits"] += 1
                        self._stats["semantic_hits"] += 1
                        logger.debug(f"Cache HIT (semantic): similarity={semantic_match['similarity']:.2f}")
                        return {
                            "response": semantic_match['response'],
                            "from_cache": True,
                            "cache_type": "semantic",
                            "similarity": semantic_match['similarity'],
                            "hit_count": semantic_match['hit_count'] + 1
                        }
        
        self._stats["misses"] += 1
        return None
    
    def _find_semantic_match(
        self,
        conn: sqlite3.Connection,
        keywords: List[str],
        model: str,
        task_type: str,
        now: datetime
    ) -> Optional[Dict[str, Any]]:
        """Find semantically similar cached prompt"""
        cursor = conn.execute("""
            SELECT id, keywords, response, hit_count FROM prompt_cache
            WHERE model = ? AND task_type = ? AND expires_at > ?
            ORDER BY hit_count DESC
            LIMIT 100
        """, (model, task_type, now.isoformat()))
        
        keywords_set = set(keywords)
        best_match = None
        best_similarity = 0
        
        for row in cursor:
            cached_keywords = set(json.loads(row['keywords'] or '[]'))
            
            if not cached_keywords:
                continue
            
            # Jaccard similarity
            intersection = len(keywords_set & cached_keywords)
            union = len(keywords_set | cached_keywords)
            similarity = intersection / union if union > 0 else 0
            
            if similarity > best_similarity and similarity >= self.config.semantic_threshold:
                best_similarity = similarity
                best_match = {
                    "id": row['id'],
                    "response": row['response'],
                    "similarity": similarity,
                    "hit_count": row['hit_count']
                }
        
        return best_match
    
    def _record_hit(self, conn: sqlite3.Connection, cache_id: int):
        """Record a cache hit"""
        conn.execute("""
            UPDATE prompt_cache 
            SET hit_count = hit_count + 1, last_hit_at = ?
            WHERE id = ?
        """, (datetime.utcnow().isoformat(), cache_id))
        conn.commit()
    
    async def set(
        self,
        prompt: str,
        model: str,
        task_type: str,
        response: str,
        tokens_saved: int = 0
    ):
        """
        Cache a response.
        
        Args:
            prompt: The original prompt
            model: Model name
            task_type: Type of task
            response: The LLM response to cache
            tokens_saved: Estimated tokens saved by caching
        """
        now = datetime.utcnow()
        ttl_hours = self._get_ttl(task_type)
        expires_at = now + timedelta(hours=ttl_hours)
        
        hash_exact = self._hash_exact(prompt, model)
        hash_normalized = self._hash_normalized(prompt, model)
        keywords = json.dumps(self.normalizer.extract_keywords(prompt))
        prompt_preview = prompt[:200] + "..." if len(prompt) > 200 else prompt
        
        with self._get_conn() as conn:
            # Check if we need to evict
            cursor = conn.execute("SELECT COUNT(*) as cnt FROM prompt_cache")
            count = cursor.fetchone()['cnt']
            
            if count >= self.config.max_entries:
                self._evict_oldest(conn, count - self.config.max_entries + 100)
            
            # Upsert (replace if exact hash exists)
            conn.execute("""
                INSERT OR REPLACE INTO prompt_cache
                (hash_exact, hash_normalized, model, task_type, prompt_preview,
                 keywords, response, created_at, expires_at, tokens_saved)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                hash_exact, hash_normalized, model, task_type, prompt_preview,
                keywords, response, now.isoformat(), expires_at.isoformat(),
                tokens_saved
            ))
            conn.commit()
        
        self._stats["writes"] += 1
        logger.debug(f"Cache SET: {hash_exact[:12]}... (TTL: {ttl_hours}h)")
    
    def _evict_oldest(self, conn: sqlite3.Connection, count: int):
        """Evict oldest/least used entries"""
        conn.execute("""
            DELETE FROM prompt_cache
            WHERE id IN (
                SELECT id FROM prompt_cache
                ORDER BY hit_count ASC, created_at ASC
                LIMIT ?
            )
        """, (count,))
        conn.commit()
        self._stats["evictions"] += count
        logger.debug(f"Cache evicted {count} entries")
    
    def _cleanup_expired(self, conn: sqlite3.Connection):
        """Remove expired entries"""
        cursor = conn.execute("""
            DELETE FROM prompt_cache
            WHERE expires_at < ?
        """, (datetime.utcnow().isoformat(),))
        conn.commit()
        
        if cursor.rowcount > 0:
            logger.info(f"Cache cleaned up {cursor.rowcount} expired entries")
    
    def get_stats(self) -> Dict[str, Any]:
        """Get cache statistics"""
        with self._get_conn() as conn:
            cursor = conn.execute("""
                SELECT 
                    COUNT(*) as total_entries,
                    SUM(hit_count) as total_hits,
                    SUM(tokens_saved) as total_tokens_saved,
                    AVG(hit_count) as avg_hits_per_entry
                FROM prompt_cache
            """)
            row = cursor.fetchone()
            
            cursor = conn.execute("""
                SELECT task_type, COUNT(*) as count, SUM(hit_count) as hits
                FROM prompt_cache
                GROUP BY task_type
            """)
            by_task = {r['task_type']: {"count": r['count'], "hits": r['hits']} 
                       for r in cursor}
        
        total_requests = self._stats["hits"] + self._stats["misses"]
        hit_rate = (self._stats["hits"] / total_requests * 100) if total_requests > 0 else 0
        
        return {
            "session_stats": {
                **self._stats,
                "total_requests": total_requests,
                "hit_rate_percent": round(hit_rate, 2)
            },
            "database_stats": {
                "total_entries": row['total_entries'] or 0,
                "total_hits": row['total_hits'] or 0,
                "total_tokens_saved": row['total_tokens_saved'] or 0,
                "avg_hits_per_entry": round(row['avg_hits_per_entry'] or 0, 2)
            },
            "by_task_type": by_task,
            "config": {
                "max_entries": self.config.max_entries,
                "semantic_enabled": self.config.enable_semantic,
                "semantic_threshold": self.config.semantic_threshold,
                "ttl_by_task": self.config.ttl_by_task
            }
        }
    
    def clear(self, task_type: Optional[str] = None):
        """Clear cache (optionally by task type)"""
        with self._get_conn() as conn:
            if task_type:
                conn.execute("DELETE FROM prompt_cache WHERE task_type = ?", (task_type,))
            else:
                conn.execute("DELETE FROM prompt_cache")
            conn.commit()
        
        logger.debug(f"Cache cleared (task_type={task_type})")
    
    def warm_cache(self, entries: List[Dict[str, Any]]):
        """
        Pre-warm cache with known prompts/responses.
        
        Args:
            entries: List of dicts with prompt, model, task_type, response
        """
        import asyncio
        
        async def _warm():
            for entry in entries:
                await self.set(
                    prompt=entry['prompt'],
                    model=entry['model'],
                    task_type=entry.get('task_type', 'test_generation'),
                    response=entry['response'],
                    tokens_saved=entry.get('tokens_saved', 0)
                )
        
        asyncio.run(_warm())
        logger.debug(f"Cache warmed with {len(entries)} entries")


# Singleton instance
_prompt_cache: Optional[PromptCache] = None


def get_prompt_cache() -> PromptCache:
    """Get or create the prompt cache singleton"""
    global _prompt_cache
    if _prompt_cache is None:
        _prompt_cache = PromptCache()
    return _prompt_cache













