"""
Unified Database Service

Supports both SQLite (development) and PostgreSQL (production).
Provides fast, scalable storage for all QA platform entities.

Usage:
    from app.services.storage.database_service import db
    
    # Initialize once at startup
    await db.initialize()
    
    # Use throughout the app
    test_case = await db.test_cases.get(id)
    await db.test_cases.create(data)
"""

import os
import json
import logging
import asyncio
from typing import List, Dict, Any, Optional, TypeVar, Generic
from datetime import datetime
from pathlib import Path
from contextlib import asynccontextmanager
import aiosqlite
from pydantic import BaseModel

logger = logging.getLogger(__name__)

# ==================== CONFIGURATION ====================

DATABASE_TYPE = os.getenv("DATABASE_TYPE", "sqlite")  # "sqlite" or "postgres"
SQLITE_PATH = os.getenv("SQLITE_PATH", "data/qaai.db")
POSTGRES_URL = os.getenv("DATABASE_URL", "postgresql://localhost:5432/qaai")

# ==================== MODELS ====================

class TestCase(BaseModel):
    id: str
    name: str
    description: Optional[str] = ""
    steps: List[Dict[str, Any]] = []
    status: str = "draft"  # draft, approved, archived
    priority: str = "medium"  # low, medium, high, critical
    category: str = "functional"
    tags: List[str] = []
    script: Optional[str] = None
    metadata: Dict[str, Any] = {}
    created_at: str = ""
    updated_at: str = ""
    created_by: Optional[str] = None
    project_id: Optional[str] = None
    suite_id: Optional[str] = None

class TestSuite(BaseModel):
    id: str
    name: str
    description: Optional[str] = ""
    test_case_ids: List[str] = []
    status: str = "active"
    created_at: str = ""
    updated_at: str = ""
    project_id: Optional[str] = None


class ApiCollection(BaseModel):
    """Stores full API test suite (collection + folders + test cases) for backend as source of truth."""
    id: str
    name: str = "default"
    payload: Any = None  # JSON: { test_cases, folders, base_url, metadata, ... } (stored as string in DB)
    created_at: str = ""
    updated_at: str = ""


class ApiWorkspace(BaseModel):
    """API Testing Workspace - groups collections for multi-project testers."""
    id: str
    name: str
    description: str = ""
    collections: List[str] = []  # collection IDs
    created_at: str = ""
    updated_at: str = ""


class ApiCollectionV2(BaseModel):
    """Granular API Collection - individual requests, folders, metadata stored properly."""
    id: str
    workspace_id: str = ""
    name: str = "New Collection"
    description: str = ""
    base_url: str = ""
    folders: List[Dict[str, Any]] = []  # [{id, name, parent_folder_id, request_ids, sort_order}]
    requests: List[Dict[str, Any]] = []  # Full request objects with assertions, headers, etc.
    chains: List[Dict[str, Any]] = []    # Saved chains (moved from localStorage)
    environment_ids: List[str] = []
    variables: Dict[str, str] = {}
    metadata: Dict[str, Any] = {}
    created_at: str = ""
    updated_at: str = ""


class ApiChain(BaseModel):
    """API Request Chain - multi-step test flows, persisted to DB instead of localStorage."""
    id: str
    collection_id: str = ""
    name: str = "New Chain"
    description: str = ""
    steps: List[Dict[str, Any]] = []  # ChainStep objects
    variables: Dict[str, str] = {}
    tags: List[str] = []
    last_run: Dict[str, Any] = {}
    created_at: str = ""
    updated_at: str = ""


class ApiTestRunRecord(BaseModel):
    """API Test Run record - persisted execution results for history/reporting."""
    id: str
    collection_id: str = ""
    name: str = ""
    status: str = "pending"  # pending, running, passed, failed, cancelled
    mode: str = "automated"  # manual, automated, ci_cd, load
    environment_id: Optional[str] = None
    request_ids: List[str] = []
    results: List[Dict[str, Any]] = []
    started_at: str = ""
    completed_at: Optional[str] = None
    duration_ms: int = 0
    created_at: str = ""


class TestRun(BaseModel):
    id: str
    name: str
    suite_id: Optional[str] = None
    test_case_ids: List[str] = []
    status: str = "pending"  # pending, running, passed, failed
    results: Dict[str, Any] = {}
    started_at: Optional[str] = None
    completed_at: Optional[str] = None
    created_at: str = ""
    project_id: Optional[str] = None
    browser: str = "chromium"
    environment: str = "local"

class TestPlan(BaseModel):
    id: str
    name: str
    description: Optional[str] = ""
    suite_ids: List[str] = []
    test_case_ids: List[str] = []
    status: str = "draft"
    created_at: str = ""
    updated_at: str = ""
    project_id: Optional[str] = None

class Recording(BaseModel):
    id: str
    name: str
    url: str
    actions: List[Dict[str, Any]] = []
    script: Optional[str] = None
    status: str = "recorded"  # recorded, converted, approved
    app_type: str = "generic"
    framework: str = "playwright-python"
    created_at: str = ""
    metadata: Dict[str, Any] = {}

class Element(BaseModel):
    id: str
    name: str
    selector: str
    selector_type: str = "css"  # css, xpath, text, role
    page_name: Optional[str] = None
    app_type: str = "generic"
    attributes: Dict[str, Any] = {}
    created_at: str = ""
    updated_at: str = ""

class Defect(BaseModel):
    id: str
    title: str
    description: Optional[str] = ""
    severity: str = "medium"  # low, medium, high, critical
    status: str = "open"  # open, in_progress, resolved, closed
    test_case_id: Optional[str] = None
    test_run_id: Optional[str] = None
    screenshot: Optional[str] = None
    created_at: str = ""
    updated_at: str = ""

class Environment(BaseModel):
    id: str
    name: str
    env_type: str = "development"  # development, staging, production
    base_url: str = ""
    variables: List[Dict[str, Any]] = []  # [{key, value, type, enabled, description}]
    auth: Dict[str, Any] = {}  # {type, bearer_token, oauth2_client_id, ...}
    headers: Dict[str, Any] = {}
    timeouts: Dict[str, Any] = {}
    created_at: str = ""
    updated_at: str = ""
    created_by: Optional[str] = None
    project_id: Optional[str] = None

class TestCaseVersion(BaseModel):
    id: str
    test_case_id: str
    version_number: int = 1
    name: Optional[str] = None
    description: Optional[str] = None
    steps: List[Dict[str, Any]] = []
    status: Optional[str] = None
    priority: Optional[str] = None
    category: Optional[str] = None
    tags: List[str] = []
    script: Optional[str] = None
    metadata: Dict[str, Any] = {}
    change_summary: Optional[str] = None
    changed_by: Optional[str] = None
    created_at: str = ""

class GlobalVariable(BaseModel):
    id: str
    key: str
    value: str = ""
    var_type: str = "default"  # default, secret
    enabled: int = 1
    description: Optional[str] = None
    created_at: str = ""
    updated_at: str = ""

# ==================== SQL SCHEMAS ====================

SQLITE_SCHEMA = """
-- Test Cases
CREATE TABLE IF NOT EXISTS test_cases (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    steps TEXT,  -- JSON array
    status TEXT DEFAULT 'draft',
    priority TEXT DEFAULT 'medium',
    category TEXT DEFAULT 'functional',
    tags TEXT,  -- JSON array
    script TEXT,
    metadata TEXT,  -- JSON object
    created_at TEXT,
    updated_at TEXT,
    created_by TEXT,
    project_id TEXT,
    suite_id TEXT
);

CREATE INDEX IF NOT EXISTS idx_test_cases_status ON test_cases(status);
CREATE INDEX IF NOT EXISTS idx_test_cases_project ON test_cases(project_id);
CREATE INDEX IF NOT EXISTS idx_test_cases_suite ON test_cases(suite_id);

-- Test Suites
CREATE TABLE IF NOT EXISTS test_suites (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    test_case_ids TEXT,  -- JSON array
    status TEXT DEFAULT 'active',
    created_at TEXT,
    updated_at TEXT,
    project_id TEXT
);

CREATE INDEX IF NOT EXISTS idx_test_suites_status ON test_suites(status);
CREATE INDEX IF NOT EXISTS idx_test_suites_project ON test_suites(project_id);

-- API Collections (full suite payload for API tab - backend source of truth, legacy)
CREATE TABLE IF NOT EXISTS api_collections (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL DEFAULT 'default',
    payload TEXT NOT NULL DEFAULT '{}',
    created_at TEXT,
    updated_at TEXT
);

-- API Workspaces (group collections for multi-project testers)
CREATE TABLE IF NOT EXISTS api_workspaces (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    collections TEXT DEFAULT '[]',  -- JSON array of collection IDs
    created_at TEXT,
    updated_at TEXT
);

-- API Collections V2 (granular: individual requests, folders, chains stored properly)
CREATE TABLE IF NOT EXISTS api_collections_v2 (
    id TEXT PRIMARY KEY,
    workspace_id TEXT DEFAULT '',
    name TEXT NOT NULL DEFAULT 'New Collection',
    description TEXT DEFAULT '',
    base_url TEXT DEFAULT '',
    folders TEXT DEFAULT '[]',      -- JSON array of folder objects
    requests TEXT DEFAULT '[]',     -- JSON array of request objects
    chains TEXT DEFAULT '[]',       -- JSON array of chain references
    environment_ids TEXT DEFAULT '[]', -- JSON array
    variables TEXT DEFAULT '{}',    -- JSON object
    metadata TEXT DEFAULT '{}',     -- JSON object
    created_at TEXT,
    updated_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_api_collections_v2_workspace ON api_collections_v2(workspace_id);

-- API Chains (multi-step test flows, moved from localStorage to DB)
CREATE TABLE IF NOT EXISTS api_chains (
    id TEXT PRIMARY KEY,
    collection_id TEXT DEFAULT '',
    name TEXT NOT NULL DEFAULT 'New Chain',
    description TEXT DEFAULT '',
    steps TEXT DEFAULT '[]',        -- JSON array of chain step objects
    variables TEXT DEFAULT '{}',    -- JSON object
    tags TEXT DEFAULT '[]',         -- JSON array
    last_run TEXT DEFAULT '{}',     -- JSON object (last execution summary)
    created_at TEXT,
    updated_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_api_chains_collection ON api_chains(collection_id);

-- API Test Runs (persistent execution history for all flows: builder, tests tab, runs)
CREATE TABLE IF NOT EXISTS api_test_runs (
    id TEXT PRIMARY KEY,
    collection_id TEXT DEFAULT '',
    name TEXT NOT NULL DEFAULT '',
    status TEXT DEFAULT 'pending',
    mode TEXT DEFAULT 'automated',
    environment_id TEXT,
    request_ids TEXT DEFAULT '[]',  -- JSON array
    results TEXT DEFAULT '[]',      -- JSON array of result objects
    started_at TEXT,
    completed_at TEXT,
    duration_ms INTEGER DEFAULT 0,
    created_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_api_test_runs_collection ON api_test_runs(collection_id);
CREATE INDEX IF NOT EXISTS idx_api_test_runs_status ON api_test_runs(status);

-- Test Runs
CREATE TABLE IF NOT EXISTS test_runs (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    suite_id TEXT,
    test_case_ids TEXT,  -- JSON array
    status TEXT DEFAULT 'pending',
    results TEXT,  -- JSON object
    started_at TEXT,
    completed_at TEXT,
    created_at TEXT,
    project_id TEXT,
    browser TEXT DEFAULT 'chromium',
    environment TEXT DEFAULT 'local'
);

CREATE INDEX IF NOT EXISTS idx_test_runs_status ON test_runs(status);
CREATE INDEX IF NOT EXISTS idx_test_runs_suite ON test_runs(suite_id);

-- Test Plans
CREATE TABLE IF NOT EXISTS test_plans (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    suite_ids TEXT,  -- JSON array
    test_case_ids TEXT,  -- JSON array
    status TEXT DEFAULT 'draft',
    created_at TEXT,
    updated_at TEXT,
    project_id TEXT
);

-- Recordings
CREATE TABLE IF NOT EXISTS recordings (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    url TEXT,
    actions TEXT,  -- JSON array
    script TEXT,
    status TEXT DEFAULT 'recorded',
    app_type TEXT DEFAULT 'generic',
    framework TEXT DEFAULT 'playwright-python',
    created_at TEXT,
    metadata TEXT
);

CREATE INDEX IF NOT EXISTS idx_recordings_status ON recordings(status);

-- Elements (Element Repository)
CREATE TABLE IF NOT EXISTS elements (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    selector TEXT NOT NULL,
    selector_type TEXT DEFAULT 'css',
    page_name TEXT,
    app_type TEXT DEFAULT 'generic',
    attributes TEXT,  -- JSON object
    created_at TEXT,
    updated_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_elements_page ON elements(page_name);

-- Defects
CREATE TABLE IF NOT EXISTS defects (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    severity TEXT DEFAULT 'medium',
    status TEXT DEFAULT 'open',
    test_case_id TEXT,
    test_run_id TEXT,
    screenshot TEXT,
    created_at TEXT,
    updated_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_defects_status ON defects(status);
CREATE INDEX IF NOT EXISTS idx_defects_severity ON defects(severity);

-- Cache table for fast lookups
CREATE TABLE IF NOT EXISTS cache (
    key TEXT PRIMARY KEY,
    value TEXT,
    expires_at TEXT
);

-- Environments (API testing environments with variables)
CREATE TABLE IF NOT EXISTS environments (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    env_type TEXT DEFAULT 'development',
    base_url TEXT,
    variables TEXT,  -- JSON array of {key, value, type, enabled, description}
    auth TEXT,  -- JSON object {type, bearer_token, basic_username, ...}
    headers TEXT,  -- JSON object
    timeouts TEXT,  -- JSON object
    created_at TEXT,
    updated_at TEXT,
    created_by TEXT,
    project_id TEXT
);

CREATE INDEX IF NOT EXISTS idx_environments_type ON environments(env_type);
CREATE INDEX IF NOT EXISTS idx_environments_project ON environments(project_id);

-- Test Case Versions (audit trail for test case edits)
CREATE TABLE IF NOT EXISTS test_case_versions (
    id TEXT PRIMARY KEY,
    test_case_id TEXT NOT NULL,
    version_number INTEGER DEFAULT 1,
    name TEXT,
    description TEXT,
    steps TEXT,  -- JSON array
    status TEXT,
    priority TEXT,
    category TEXT,
    tags TEXT,  -- JSON array
    script TEXT,
    metadata TEXT,  -- JSON object
    change_summary TEXT,
    changed_by TEXT,
    created_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_tc_versions_case ON test_case_versions(test_case_id);
CREATE INDEX IF NOT EXISTS idx_tc_versions_number ON test_case_versions(test_case_id, version_number);

-- Global Variables (shared across all environments)
CREATE TABLE IF NOT EXISTS global_variables (
    id TEXT PRIMARY KEY,
    key TEXT NOT NULL UNIQUE,
    value TEXT,
    var_type TEXT DEFAULT 'default',
    enabled INTEGER DEFAULT 1,
    description TEXT,
    created_at TEXT,
    updated_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_global_vars_key ON global_variables(key);
"""

# ==================== REPOSITORY BASE CLASS ====================

T = TypeVar('T', bound=BaseModel)

class Repository(Generic[T]):
    """Base repository for CRUD operations."""
    
    def __init__(self, db: 'DatabaseService', table: str, model_class: type):
        self.db = db
        self.table = table
        self.model_class = model_class
        self._cache: Dict[str, T] = {}
        self._cache_timestamp: float = 0
        self._cache_ttl: float = 30  # 30 seconds cache
    
    def _to_row(self, item: T) -> Dict[str, Any]:
        """Convert model to database row."""
        data = item.model_dump()
        # Serialize lists and dicts to JSON
        for key, value in data.items():
            if isinstance(value, (list, dict)):
                data[key] = json.dumps(value)
        return data
    
    def _from_row(self, row: Dict[str, Any]) -> T:
        """Convert database row to model."""
        data = dict(row)
        # Parse JSON fields
        for key, value in data.items():
            if isinstance(value, str) and value.startswith(('[', '{')):
                try:
                    data[key] = json.loads(value)
                except json.JSONDecodeError:
                    pass
        return self.model_class(**data)
    
    async def get(self, id: str) -> Optional[T]:
        """Get item by ID."""
        # Check cache first
        if id in self._cache:
            return self._cache[id]
        
        async with self.db.connection() as conn:
            cursor = await conn.execute(
                f"SELECT * FROM {self.table} WHERE id = ?",
                (id,)
            )
            row = await cursor.fetchone()
            if row:
                item = self._from_row(row)
                self._cache[id] = item
                return item
        return None
    
    async def get_all(self, limit: int = 1000, offset: int = 0, 
                      filters: Optional[Dict[str, Any]] = None) -> List[T]:
        """Get all items with optional filtering."""
        # Build query
        query = f"SELECT * FROM {self.table}"
        params = []
        
        if filters:
            conditions = []
            for key, value in filters.items():
                conditions.append(f"{key} = ?")
                params.append(value)
            if conditions:
                query += " WHERE " + " AND ".join(conditions)
        
        query += f" ORDER BY created_at DESC LIMIT ? OFFSET ?"
        params.extend([limit, offset])
        
        async with self.db.connection() as conn:
            cursor = await conn.execute(query, params)
            rows = await cursor.fetchall()
            return [self._from_row(row) for row in rows]
    
    async def create(self, item: T) -> T:
        """Create new item."""
        # Set timestamps
        now = datetime.utcnow().isoformat()
        data = self._to_row(item)
        if 'created_at' in data and not data['created_at']:
            data['created_at'] = now
        if 'updated_at' in data:
            data['updated_at'] = now
        
        columns = ', '.join(data.keys())
        placeholders = ', '.join(['?' for _ in data])
        
        async with self.db.connection() as conn:
            await conn.execute(
                f"INSERT INTO {self.table} ({columns}) VALUES ({placeholders})",
                list(data.values())
            )
            await conn.commit()
        
        self._cache[item.id] = item
        return item
    
    async def update(self, id: str, updates: Dict[str, Any]) -> Optional[T]:
        """Update existing item."""
        # Work on a COPY so we don't mutate the caller's dict
        # (caller may reuse the dict, e.g. for fallback create after a no-op update)
        row_data = dict(updates)
        row_data['updated_at'] = datetime.utcnow().isoformat()
        
        # Serialize lists and dicts for SQLite storage
        for key, value in row_data.items():
            if isinstance(value, (list, dict)):
                row_data[key] = json.dumps(value)
        
        set_clause = ', '.join([f"{k} = ?" for k in row_data.keys()])
        values = list(row_data.values()) + [id]
        
        async with self.db.connection() as conn:
            await conn.execute(
                f"UPDATE {self.table} SET {set_clause} WHERE id = ?",
                values
            )
            await conn.commit()
        
        # Invalidate cache
        if id in self._cache:
            del self._cache[id]
        
        return await self.get(id)
    
    async def delete(self, id: str) -> bool:
        """Delete item."""
        async with self.db.connection() as conn:
            result = await conn.execute(
                f"DELETE FROM {self.table} WHERE id = ?",
                (id,)
            )
            await conn.commit()
            
            # Invalidate cache
            if id in self._cache:
                del self._cache[id]
            
            return result.rowcount > 0
    
    async def count(self, filters: Optional[Dict[str, Any]] = None) -> int:
        """Count items."""
        query = f"SELECT COUNT(*) FROM {self.table}"
        params = []
        
        if filters:
            conditions = []
            for key, value in filters.items():
                conditions.append(f"{key} = ?")
                params.append(value)
            if conditions:
                query += " WHERE " + " AND ".join(conditions)
        
        async with self.db.connection() as conn:
            cursor = await conn.execute(query, params)
            row = await cursor.fetchone()
            return row[0] if row else 0
    
    async def search(self, query_text: str, fields: List[str]) -> List[T]:
        """Full-text search across fields."""
        conditions = [f"{field} LIKE ?" for field in fields]
        query = f"SELECT * FROM {self.table} WHERE {' OR '.join(conditions)}"
        params = [f"%{query_text}%" for _ in fields]
        
        async with self.db.connection() as conn:
            cursor = await conn.execute(query, params)
            rows = await cursor.fetchall()
            return [self._from_row(row) for row in rows]
    
    def clear_cache(self):
        """Clear the repository cache."""
        self._cache.clear()


# ==================== DATABASE SERVICE ====================

class DatabaseService:
    """Unified database service supporting SQLite and PostgreSQL."""
    
    def __init__(self):
        self.db_type = DATABASE_TYPE
        self.db_path = SQLITE_PATH
        self._connection: Optional[aiosqlite.Connection] = None
        self._initialized = False
        
        # Initialize repositories
        self.test_cases: Repository[TestCase] = Repository(self, 'test_cases', TestCase)
        self.test_suites: Repository[TestSuite] = Repository(self, 'test_suites', TestSuite)
        self.api_collections: Repository[ApiCollection] = Repository(self, 'api_collections', ApiCollection)
        self.api_workspaces: Repository[ApiWorkspace] = Repository(self, 'api_workspaces', ApiWorkspace)
        self.api_collections_v2: Repository[ApiCollectionV2] = Repository(self, 'api_collections_v2', ApiCollectionV2)
        self.api_chains: Repository[ApiChain] = Repository(self, 'api_chains', ApiChain)
        self.api_test_runs: Repository[ApiTestRunRecord] = Repository(self, 'api_test_runs', ApiTestRunRecord)
        self.test_runs: Repository[TestRun] = Repository(self, 'test_runs', TestRun)
        self.test_plans: Repository[TestPlan] = Repository(self, 'test_plans', TestPlan)
        self.recordings: Repository[Recording] = Repository(self, 'recordings', Recording)
        self.elements: Repository[Element] = Repository(self, 'elements', Element)
        self.defects: Repository[Defect] = Repository(self, 'defects', Defect)
        self.environments: Repository[Environment] = Repository(self, 'environments', Environment)
        self.test_case_versions: Repository[TestCaseVersion] = Repository(self, 'test_case_versions', TestCaseVersion)
        self.global_variables: Repository[GlobalVariable] = Repository(self, 'global_variables', GlobalVariable)
    
    async def initialize(self):
        """Initialize the database and create tables."""
        if self._initialized:
            return
        
        # Create data directory
        Path(self.db_path).parent.mkdir(parents=True, exist_ok=True)
        
        # Connect and create schema
        async with self.connection() as conn:
            await conn.executescript(SQLITE_SCHEMA)
            await conn.commit()
        
        self._initialized = True
        logger.debug(f"Database initialized: {self.db_type} at {self.db_path}")
    
    @asynccontextmanager
    async def connection(self):
        """Get a database connection."""
        if self.db_type == 'sqlite':
            conn = await aiosqlite.connect(self.db_path)
            conn.row_factory = aiosqlite.Row
            try:
                yield conn
            finally:
                await conn.close()
        else:
            # PostgreSQL support - use asyncpg
            raise NotImplementedError("PostgreSQL support coming soon")
    
    async def migrate_from_json(self, json_dir: str = "data"):
        """Migrate existing JSON data to database."""
        logger.info(f"Migrating data from {json_dir}")
        migrated = 0
        
        # Migrate test cases
        tc_file = Path(json_dir) / "test_cases.json"
        if tc_file.exists():
            with open(tc_file) as f:
                data = json.load(f)
                for item in data.get('test_cases', []):
                    try:
                        tc = TestCase(**item)
                        await self.test_cases.create(tc)
                        migrated += 1
                    except Exception as e:
                        logger.warning(f"Failed to migrate test case: {e}")
        
        # Migrate recordings
        recordings_dir = Path(json_dir) / "recordings"
        if recordings_dir.exists():
            for file in recordings_dir.glob("*.json"):
                try:
                    with open(file) as f:
                        data = json.load(f)
                        rec = Recording(**data)
                        await self.recordings.create(rec)
                        migrated += 1
                except Exception as e:
                    logger.warning(f"Failed to migrate recording {file}: {e}")
        
        logger.info(f"Migration complete: {migrated} items migrated")
        return migrated
    
    async def get_stats(self) -> Dict[str, Any]:
        """Get database statistics."""
        return {
            "test_cases": await self.test_cases.count(),
            "test_suites": await self.test_suites.count(),
            "test_runs": await self.test_runs.count(),
            "test_plans": await self.test_plans.count(),
            "recordings": await self.recordings.count(),
            "elements": await self.elements.count(),
            "defects": await self.defects.count(),
            "environments": await self.environments.count(),
            "test_case_versions": await self.test_case_versions.count(),
            "global_variables": await self.global_variables.count(),
            "database_type": self.db_type,
            "database_path": self.db_path,
        }
    
    async def backup(self, backup_path: str = None) -> str:
        """Create a backup of the database."""
        import shutil
        
        if backup_path is None:
            timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
            backup_path = f"data/backups/qaai_backup_{timestamp}.db"
        
        Path(backup_path).parent.mkdir(parents=True, exist_ok=True)
        shutil.copy(self.db_path, backup_path)
        
        logger.info(f"Database backed up to: {backup_path}")
        return backup_path
    
    def clear_all_caches(self):
        """Clear all repository caches."""
        self.test_cases.clear_cache()
        self.test_suites.clear_cache()
        self.test_runs.clear_cache()
        self.test_plans.clear_cache()
        self.recordings.clear_cache()
        self.elements.clear_cache()
        self.defects.clear_cache()
        self.environments.clear_cache()
        self.test_case_versions.clear_cache()
        self.global_variables.clear_cache()


# ==================== SINGLETON INSTANCE ====================

db = DatabaseService()


# ==================== CONVENIENCE FUNCTIONS ====================

async def init_database():
    """Initialize the database. Call once at startup."""
    await db.initialize()

async def get_database() -> DatabaseService:
    """Get the database service instance."""
    if not db._initialized:
        await db.initialize()
    return db
