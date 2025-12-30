"""
Enterprise Scale Data Service
============================
Database-agnostic data layer with caching support.

Architecture:
- Supports SQLite (dev) → PostgreSQL (prod) → Distributed (enterprise)
- Redis caching with graceful fallback
- Connection pooling ready
- Query optimization with indexes

Future-proof design:
- Abstract interfaces for easy backend swapping
- Event-driven architecture ready (can add message queues)
- Sharding-ready data model
"""

import os
import json
import logging
import hashlib
from typing import Optional, List, Dict, Any, Tuple
from datetime import datetime, timedelta
from abc import ABC, abstractmethod
from dataclasses import dataclass, asdict
from enum import Enum

logger = logging.getLogger(__name__)

# ============================================================================
# DATA MODELS (Database Agnostic)
# ============================================================================

@dataclass
class TestCaseDTO:
    """Data Transfer Object for Test Cases - works across all storage backends"""
    id: str
    name: str
    description: str = ""
    folder_id: Optional[str] = None
    folder_name: Optional[str] = None
    priority: str = "medium"
    status: str = "active"
    tags: List[str] = None
    steps: List[Dict] = None
    automation_status: str = "none"
    automation_script_path: Optional[str] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None
    
    def __post_init__(self):
        self.tags = self.tags or []
        self.steps = self.steps or []
    
    def to_dict(self) -> Dict:
        return asdict(self)
    
    def to_list_item(self) -> Dict:
        """Lightweight version for list views (no steps)"""
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "folder_id": self.folder_id,
            "folder_name": self.folder_name,
            "priority": self.priority,
            "status": self.status,
            "tags": self.tags,
            "automation_status": self.automation_status,
            "created_at": self.created_at,
            "updated_at": self.updated_at
        }


@dataclass
class PaginatedResult:
    """Standard pagination response"""
    items: List[Any]
    total: int
    page: int
    limit: int
    total_pages: int
    has_next: bool
    has_prev: bool


class SortOrder(Enum):
    ASC = "asc"
    DESC = "desc"


# ============================================================================
# CACHE INTERFACE
# ============================================================================

class CacheBackend(ABC):
    """Abstract cache interface - Redis, Memcached, In-Memory, etc."""
    
    @abstractmethod
    async def get(self, key: str) -> Optional[str]:
        pass
    
    @abstractmethod
    async def set(self, key: str, value: str, ttl_seconds: int = 300) -> bool:
        pass
    
    @abstractmethod
    async def delete(self, key: str) -> bool:
        pass
    
    @abstractmethod
    async def clear_pattern(self, pattern: str) -> int:
        pass


class InMemoryCache(CacheBackend):
    """In-memory cache fallback when Redis isn't available"""
    
    def __init__(self):
        self._cache: Dict[str, Tuple[str, datetime]] = {}
        self._max_size = 1000
    
    async def get(self, key: str) -> Optional[str]:
        if key in self._cache:
            value, expires = self._cache[key]
            if datetime.now() < expires:
                return value
            del self._cache[key]
        return None
    
    async def set(self, key: str, value: str, ttl_seconds: int = 300) -> bool:
        if len(self._cache) >= self._max_size:
            # Simple LRU-like cleanup
            oldest = sorted(self._cache.items(), key=lambda x: x[1][1])[:100]
            for k, _ in oldest:
                del self._cache[k]
        
        self._cache[key] = (value, datetime.now() + timedelta(seconds=ttl_seconds))
        return True
    
    async def delete(self, key: str) -> bool:
        if key in self._cache:
            del self._cache[key]
            return True
        return False
    
    async def clear_pattern(self, pattern: str) -> int:
        # Simple pattern matching (supports * at end)
        pattern = pattern.rstrip('*')
        keys_to_delete = [k for k in self._cache.keys() if k.startswith(pattern)]
        for k in keys_to_delete:
            del self._cache[k]
        return len(keys_to_delete)


class RedisCache(CacheBackend):
    """Redis cache backend"""
    
    def __init__(self, host: str = "localhost", port: int = 6379, db: int = 0):
        self._redis = None
        self._host = host
        self._port = port
        self._db = db
        self._fallback = InMemoryCache()
    
    def _get_client(self):
        if self._redis is None and not hasattr(self, '_redis_failed'):
            try:
                import redis
                self._redis = redis.Redis(
                    host=self._host, 
                    port=self._port, 
                    db=self._db,
                    decode_responses=True,
                    socket_timeout=0.1,  # Fast timeout
                    socket_connect_timeout=0.1
                )
                self._redis.ping()
                logger.info("Redis connected successfully")
            except Exception as e:
                logger.info(f"Redis not available, using in-memory cache (this is fine for dev)")
                self._redis = None
                self._redis_failed = True  # Don't retry
        return self._redis
    
    async def get(self, key: str) -> Optional[str]:
        client = self._get_client()
        if client:
            try:
                return client.get(key)
            except Exception:
                pass
        return await self._fallback.get(key)
    
    async def set(self, key: str, value: str, ttl_seconds: int = 300) -> bool:
        client = self._get_client()
        if client:
            try:
                return client.setex(key, ttl_seconds, value)
            except Exception:
                pass
        return await self._fallback.set(key, value, ttl_seconds)
    
    async def delete(self, key: str) -> bool:
        client = self._get_client()
        if client:
            try:
                return client.delete(key) > 0
            except Exception:
                pass
        return await self._fallback.delete(key)
    
    async def clear_pattern(self, pattern: str) -> int:
        client = self._get_client()
        if client:
            try:
                keys = client.keys(pattern)
                if keys:
                    return client.delete(*keys)
                return 0
            except Exception:
                pass
        return await self._fallback.clear_pattern(pattern)


# ============================================================================
# DATABASE INTERFACE
# ============================================================================

class DatabaseBackend(ABC):
    """Abstract database interface - SQLite, PostgreSQL, MongoDB, etc."""
    
    @abstractmethod
    async def get_test_cases_paginated(
        self,
        page: int,
        limit: int,
        search: Optional[str] = None,
        priority: Optional[str] = None,
        status: Optional[str] = None,
        folder_id: Optional[str] = None,
        sort_by: str = "updated_at",
        sort_order: SortOrder = SortOrder.DESC
    ) -> PaginatedResult:
        pass
    
    @abstractmethod
    async def get_test_case_by_id(self, test_case_id: str) -> Optional[TestCaseDTO]:
        pass
    
    @abstractmethod
    async def get_summary_counts(self) -> Dict[str, int]:
        pass
    
    @abstractmethod
    async def get_suites_paginated(self, page: int, limit: int) -> PaginatedResult:
        pass
    
    @abstractmethod
    async def get_plans_paginated(self, page: int, limit: int) -> PaginatedResult:
        pass
    
    @abstractmethod
    async def get_releases_paginated(self, page: int, limit: int) -> PaginatedResult:
        pass


class SQLiteBackend(DatabaseBackend):
    """SQLite backend - great for development and small-medium scale"""
    
    def __init__(self, db_path: str):
        self.db_path = db_path
        self._ensure_indexes()
    
    def _ensure_indexes(self):
        """Create indexes for performance"""
        if not os.path.exists(self.db_path):
            return
        
        import sqlite3
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        try:
            # Create indexes for common queries
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_tc_name ON scale_test_cases(name)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_tc_priority ON scale_test_cases(priority)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_tc_status ON scale_test_cases(automation_status)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_tc_folder ON scale_test_cases(folder_id)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_tc_updated ON scale_test_cases(updated_at)")
            conn.commit()
            logger.info("Database indexes ensured")
        except Exception as e:
            logger.warning(f"Could not create indexes: {e}")
        finally:
            conn.close()
    
    def _get_connection(self):
        import sqlite3
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn
    
    async def get_test_cases_paginated(
        self,
        page: int,
        limit: int,
        search: Optional[str] = None,
        priority: Optional[str] = None,
        status: Optional[str] = None,
        folder_id: Optional[str] = None,
        sort_by: str = "updated_at",
        sort_order: SortOrder = SortOrder.DESC
    ) -> PaginatedResult:
        
        if not os.path.exists(self.db_path):
            return PaginatedResult([], 0, page, limit, 0, False, False)
        
        conn = self._get_connection()
        cursor = conn.cursor()
        
        # Build query
        where_clauses = []
        params = []
        
        if search:
            where_clauses.append("(name LIKE ? OR description LIKE ?)")
            params.extend([f"%{search}%", f"%{search}%"])
        
        if priority and priority != 'all':
            where_clauses.append("priority = ?")
            params.append(priority)
        
        if status and status != 'all':
            where_clauses.append("automation_status = ?")
            params.append(status)
        
        if folder_id:
            where_clauses.append("folder_id = ?")
            params.append(folder_id)
        
        where_sql = " AND ".join(where_clauses) if where_clauses else "1=1"
        
        # Get total
        cursor.execute(f"SELECT COUNT(*) FROM scale_test_cases WHERE {where_sql}", params)
        total = cursor.fetchone()[0]
        
        # Get page
        offset = (page - 1) * limit
        order_col = sort_by if sort_by in ["name", "priority", "updated_at", "created_at"] else "updated_at"
        order_dir = "DESC" if sort_order == SortOrder.DESC else "ASC"
        
        cursor.execute(f"""
            SELECT id, name, description, folder_id, folder_name, priority, status,
                   tags, automation_status, automation_script_path, created_at, updated_at
            FROM scale_test_cases
            WHERE {where_sql}
            ORDER BY {order_col} {order_dir}
            LIMIT ? OFFSET ?
        """, params + [limit, offset])
        
        items = []
        for row in cursor.fetchall():
            tc = TestCaseDTO(
                id=row['id'],
                name=row['name'],
                description=row['description'] or "",
                folder_id=row['folder_id'],
                folder_name=row['folder_name'],
                priority=row['priority'] or "medium",
                status=row['status'] or "active",
                tags=json.loads(row['tags'] or '[]'),
                automation_status=row['automation_status'] or "none",
                automation_script_path=row['automation_script_path'],
                created_at=row['created_at'],
                updated_at=row['updated_at']
            )
            items.append(tc.to_list_item())
        
        conn.close()
        
        total_pages = (total + limit - 1) // limit
        
        return PaginatedResult(
            items=items,
            total=total,
            page=page,
            limit=limit,
            total_pages=total_pages,
            has_next=page < total_pages,
            has_prev=page > 1
        )
    
    async def get_test_case_by_id(self, test_case_id: str) -> Optional[TestCaseDTO]:
        if not os.path.exists(self.db_path):
            return None
        
        conn = self._get_connection()
        cursor = conn.cursor()
        
        cursor.execute("SELECT * FROM scale_test_cases WHERE id = ?", (test_case_id,))
        row = cursor.fetchone()
        
        if not row:
            conn.close()
            return None
        
        tc = TestCaseDTO(
            id=row['id'],
            name=row['name'],
            description=row['description'] or "",
            folder_id=row['folder_id'],
            folder_name=row['folder_name'],
            priority=row['priority'] or "medium",
            status=row['status'] or "active",
            tags=json.loads(row['tags'] or '[]'),
            steps=json.loads(row['steps'] or '[]'),
            automation_status=row['automation_status'] or "none",
            automation_script_path=row['automation_script_path'],
            created_at=row['created_at'],
            updated_at=row['updated_at']
        )
        
        conn.close()
        return tc
    
    async def get_summary_counts(self) -> Dict[str, int]:
        if not os.path.exists(self.db_path):
            return {"testCases": 0, "suites": 0, "plans": 0, "releases": 0}
        
        conn = self._get_connection()
        cursor = conn.cursor()
        
        counts = {}
        
        cursor.execute("SELECT COUNT(*) FROM scale_test_cases")
        counts["testCases"] = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(*) FROM scale_test_suites")
        counts["suites"] = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(*) FROM scale_test_plans")
        counts["plans"] = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(*) FROM scale_releases")
        counts["releases"] = cursor.fetchone()[0]
        
        # Additional stats
        cursor.execute("SELECT COUNT(*) FROM scale_test_cases WHERE automation_status = 'full'")
        counts["automated"] = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(*) FROM scale_test_cases WHERE automation_status = 'none' OR automation_status IS NULL")
        counts["manual"] = cursor.fetchone()[0]
        
        conn.close()
        return counts
    
    async def get_suites_paginated(self, page: int, limit: int) -> PaginatedResult:
        if not os.path.exists(self.db_path):
            return PaginatedResult([], 0, page, limit, 0, False, False)
        
        conn = self._get_connection()
        cursor = conn.cursor()
        
        cursor.execute("SELECT COUNT(*) FROM scale_test_suites")
        total = cursor.fetchone()[0]
        
        offset = (page - 1) * limit
        cursor.execute("SELECT * FROM scale_test_suites LIMIT ? OFFSET ?", (limit, offset))
        
        items = []
        for row in cursor.fetchall():
            suite = dict(row)
            suite['testCaseIds'] = json.loads(suite.get('test_case_ids') or '[]')
            items.append(suite)
        
        conn.close()
        
        total_pages = (total + limit - 1) // limit
        return PaginatedResult(items, total, page, limit, total_pages, page < total_pages, page > 1)
    
    async def get_plans_paginated(self, page: int, limit: int) -> PaginatedResult:
        if not os.path.exists(self.db_path):
            return PaginatedResult([], 0, page, limit, 0, False, False)
        
        conn = self._get_connection()
        cursor = conn.cursor()
        
        cursor.execute("SELECT COUNT(*) FROM scale_test_plans")
        total = cursor.fetchone()[0]
        
        offset = (page - 1) * limit
        cursor.execute("SELECT * FROM scale_test_plans LIMIT ? OFFSET ?", (limit, offset))
        
        items = []
        for row in cursor.fetchall():
            plan = dict(row)
            plan['suiteIds'] = json.loads(plan.get('suite_ids') or '[]')
            plan['testCaseIds'] = json.loads(plan.get('test_case_ids') or '[]')
            items.append(plan)
        
        conn.close()
        
        total_pages = (total + limit - 1) // limit
        return PaginatedResult(items, total, page, limit, total_pages, page < total_pages, page > 1)
    
    async def get_releases_paginated(self, page: int, limit: int) -> PaginatedResult:
        if not os.path.exists(self.db_path):
            return PaginatedResult([], 0, page, limit, 0, False, False)
        
        conn = self._get_connection()
        cursor = conn.cursor()
        
        cursor.execute("SELECT COUNT(*) FROM scale_releases")
        total = cursor.fetchone()[0]
        
        offset = (page - 1) * limit
        cursor.execute("SELECT * FROM scale_releases LIMIT ? OFFSET ?", (limit, offset))
        
        items = []
        for row in cursor.fetchall():
            release = dict(row)
            release['suiteIds'] = json.loads(release.get('suite_ids') or '[]')
            items.append(release)
        
        conn.close()
        
        total_pages = (total + limit - 1) // limit
        return PaginatedResult(items, total, page, limit, total_pages, page < total_pages, page > 1)


# ============================================================================
# SCALE DATA SERVICE (Main Interface)
# ============================================================================

class ScaleDataService:
    """
    Main service for enterprise-scale test data management.
    
    Features:
    - Database-agnostic (swap backends without code changes)
    - Automatic caching with Redis (falls back to in-memory)
    - Connection pooling ready
    - Query optimization
    
    Usage:
        service = ScaleDataService()
        result = await service.get_test_cases(page=1, limit=50)
    """
    
    _instance = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialized = False
        return cls._instance
    
    def __init__(self):
        if self._initialized:
            return
        
        # Determine database path
        self.db_path = os.path.join(
            os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))),
            "data", "scale_test.db"
        )
        
        # Initialize backends
        self.db = SQLiteBackend(self.db_path)
        self.cache = RedisCache()
        
        # Cache settings
        self.cache_ttl = {
            "summary": 60,       # 1 minute for counts
            "list": 120,        # 2 minutes for list pages
            "detail": 300,      # 5 minutes for single items
            "search": 60        # 1 minute for search results
        }
        
        self._initialized = True
        logger.info(f"ScaleDataService initialized with db: {self.db_path}")
    
    def _cache_key(self, prefix: str, **kwargs) -> str:
        """Generate consistent cache key"""
        params = json.dumps(kwargs, sort_keys=True)
        hash_val = hashlib.md5(params.encode()).hexdigest()[:8]
        return f"scale:{prefix}:{hash_val}"
    
    async def get_summary(self) -> Dict[str, int]:
        """Get summary counts (cached)"""
        cache_key = self._cache_key("summary")
        
        # Try cache
        cached = await self.cache.get(cache_key)
        if cached:
            return json.loads(cached)
        
        # Get from DB
        result = await self.db.get_summary_counts()
        
        # Cache it
        await self.cache.set(cache_key, json.dumps(result), self.cache_ttl["summary"])
        
        return result
    
    async def get_test_cases(
        self,
        page: int = 1,
        limit: int = 50,
        search: Optional[str] = None,
        priority: Optional[str] = None,
        status: Optional[str] = None,
        folder_id: Optional[str] = None,
        sort_by: str = "updated_at",
        sort_order: str = "desc"
    ) -> Dict[str, Any]:
        """Get paginated test cases (cached)"""
        
        cache_key = self._cache_key(
            "list" if not search else "search",
            page=page, limit=limit, search=search,
            priority=priority, status=status, folder_id=folder_id,
            sort_by=sort_by, sort_order=sort_order
        )
        
        # Try cache
        cached = await self.cache.get(cache_key)
        if cached:
            logger.debug(f"Cache hit for {cache_key}")
            return json.loads(cached)
        
        # Get from DB
        order = SortOrder.DESC if sort_order == "desc" else SortOrder.ASC
        result = await self.db.get_test_cases_paginated(
            page, limit, search, priority, status, folder_id, sort_by, order
        )
        
        response = {
            "testCases": result.items,
            "total": result.total,
            "page": result.page,
            "limit": result.limit,
            "totalPages": result.total_pages,
            "hasNext": result.has_next,
            "hasPrev": result.has_prev
        }
        
        # Cache it
        ttl = self.cache_ttl["search"] if search else self.cache_ttl["list"]
        await self.cache.set(cache_key, json.dumps(response), ttl)
        
        return response
    
    async def get_test_case(self, test_case_id: str) -> Optional[Dict]:
        """Get single test case with full details (cached)"""
        
        cache_key = self._cache_key("detail", id=test_case_id)
        
        # Try cache
        cached = await self.cache.get(cache_key)
        if cached:
            return json.loads(cached)
        
        # Get from DB
        tc = await self.db.get_test_case_by_id(test_case_id)
        if not tc:
            return None
        
        result = tc.to_dict()
        
        # Cache it
        await self.cache.set(cache_key, json.dumps(result), self.cache_ttl["detail"])
        
        return result
    
    async def get_suites(self, page: int = 1, limit: int = 50) -> Dict[str, Any]:
        """Get paginated suites"""
        cache_key = self._cache_key("suites", page=page, limit=limit)
        
        cached = await self.cache.get(cache_key)
        if cached:
            return json.loads(cached)
        
        result = await self.db.get_suites_paginated(page, limit)
        
        response = {
            "suites": result.items,
            "total": result.total,
            "page": result.page,
            "limit": result.limit,
            "totalPages": result.total_pages
        }
        
        await self.cache.set(cache_key, json.dumps(response), self.cache_ttl["list"])
        return response
    
    async def get_plans(self, page: int = 1, limit: int = 50) -> Dict[str, Any]:
        """Get paginated plans"""
        cache_key = self._cache_key("plans", page=page, limit=limit)
        
        cached = await self.cache.get(cache_key)
        if cached:
            return json.loads(cached)
        
        result = await self.db.get_plans_paginated(page, limit)
        
        response = {
            "plans": result.items,
            "total": result.total,
            "page": result.page,
            "limit": result.limit,
            "totalPages": result.total_pages
        }
        
        await self.cache.set(cache_key, json.dumps(response), self.cache_ttl["list"])
        return response
    
    async def get_releases(self, page: int = 1, limit: int = 50) -> Dict[str, Any]:
        """Get paginated releases"""
        cache_key = self._cache_key("releases", page=page, limit=limit)
        
        cached = await self.cache.get(cache_key)
        if cached:
            return json.loads(cached)
        
        result = await self.db.get_releases_paginated(page, limit)
        
        response = {
            "releases": result.items,
            "total": result.total,
            "page": result.page,
            "limit": result.limit,
            "totalPages": result.total_pages
        }
        
        await self.cache.set(cache_key, json.dumps(response), self.cache_ttl["list"])
        return response
    
    async def invalidate_cache(self, pattern: str = "scale:*"):
        """Invalidate cache - call after data changes"""
        await self.cache.clear_pattern(pattern)
        logger.info(f"Cache invalidated for pattern: {pattern}")


# Global service instance
_service: Optional[ScaleDataService] = None

def get_scale_data_service() -> ScaleDataService:
    """Get or create the global service instance"""
    global _service
    if _service is None:
        _service = ScaleDataService()
    return _service

