from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any, Union
from datetime import datetime
from enum import Enum
import uuid

# Enums for type safety
class TestType(str, Enum):
    POSTMAN = "postman"
    PLAYWRIGHT = "playwright"
    K6 = "k6"
    AXE_CORE = "axe-core"

class TestStatus(str, Enum):
    DRAFT = "draft"
    ACTIVE = "active"
    ARCHIVED = "archived"
    READY = "ready"
    RUNNING = "running"
    COMPLETED = "completed"
    PASSED = "passed"
    FAILED = "failed"
    SKIPPED = "skipped"
    ERROR = "error"
    PENDING = "pending"
    REVIEWED = "reviewed"
    APPLIED = "applied"
    REJECTED = "rejected"

class Priority(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"

# Base models
class BaseEntity(BaseModel):
    id: Optional[uuid.UUID] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    created_by: Optional[str] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)

# Test Plan Models
class TestTarget(BaseModel):
    endpoints: Optional[List[str]] = None
    pages: Optional[List[str]] = None
    components: Optional[List[str]] = None
    paths: Optional[List[str]] = None

class APIConfig(BaseModel):
    api: bool = True
    ui: bool = False
    performance: bool = False
    accessibility: bool = False

class TestPlan(BaseEntity):
    plan_id: str = Field(..., description="Unique plan identifier")
    name: str = Field(..., max_length=500)
    description: Optional[str] = None
    source: str = Field(..., description="Original specification content")
    targets: TestTarget = Field(..., description="Target endpoints/components")
    api_ui: APIConfig = Field(..., description="API vs UI test configuration")
    path: Optional[str] = Field(None, max_length=1000)
    priority: int = Field(default=1, ge=1, le=5)
    status: TestStatus = Field(default=TestStatus.DRAFT)

class TestPlanCreate(BaseModel):
    name: str = Field(..., max_length=500)
    description: Optional[str] = None
    source: str = Field(..., description="Original specification content")
    targets: TestTarget = Field(..., description="Target endpoints/components")
    api_ui: APIConfig = Field(..., description="API vs UI test configuration")
    path: Optional[str] = Field(None, max_length=1000)
    priority: int = Field(default=1, ge=1, le=5)

class TestPlanResponse(BaseModel):
    plan_id: str
    name: str
    description: Optional[str]
    status: TestStatus
    created_at: datetime
    updated_at: datetime

# Suite Artifacts Models
class Artifact(BaseModel):
    type: TestType
    path: str
    content: Optional[str] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)

class SuiteArtifacts(BaseEntity):
    suite_id: str = Field(..., description="Unique suite identifier")
    plan_id: uuid.UUID = Field(..., description="Reference to parent plan")
    name: str = Field(..., max_length=500)
    description: Optional[str] = None
    test_type: TestType = Field(..., description="Type of tests in this suite")
    artifacts: List[Artifact] = Field(..., description="Test artifact definitions")
    path: Optional[str] = Field(None, max_length=1000)
    status: TestStatus = Field(default=TestStatus.DRAFT)

class SuiteArtifactsCreate(BaseModel):
    plan_id: uuid.UUID
    name: str = Field(..., max_length=500)
    description: Optional[str] = None
    test_type: TestType
    artifacts: List[Artifact]
    path: Optional[str] = Field(None, max_length=1000)

class SuiteArtifactsResponse(BaseModel):
    suite_id: str
    name: str
    test_type: TestType
    status: TestStatus
    artifact_count: int
    created_at: datetime

# Run Result Models
class TestReport(BaseModel):
    type: str = Field(..., description="Report type (junit, html, json)")
    path: str = Field(..., description="Path to report file")
    content: Optional[str] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)

class RunResult(BaseEntity):
    run_id: str = Field(..., description="Unique run identifier")
    suite_id: uuid.UUID = Field(..., description="Reference to parent suite")
    name: str = Field(..., max_length=500)
    status: TestStatus = Field(..., description="Overall run status")
    pass_count: int = Field(default=0, ge=0)
    fail_count: int = Field(default=0, ge=0)
    skip_count: int = Field(default=0, ge=0)
    total_count: int = Field(default=0, ge=0)
    duration_seconds: Optional[int] = Field(None, ge=0)
    reports: List[TestReport] = Field(default_factory=list)
    logs: Optional[str] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None

class RunResultCreate(BaseModel):
    suite_id: uuid.UUID
    name: str = Field(..., max_length=500)

class RunResultResponse(BaseModel):
    run_id: str
    name: str
    status: TestStatus
    pass_count: int
    fail_count: int
    skip_count: int
    total_count: int
    duration_seconds: Optional[int]
    started_at: Optional[datetime]
    completed_at: Optional[datetime]

# Triage Result Models
class FailureCluster(BaseModel):
    root_cause: str = Field(..., description="Identified root cause")
    hints: List[str] = Field(default_factory=list, description="Additional hints")
    evidence: List[str] = Field(default_factory=list, description="Supporting evidence")
    test_ids: List[str] = Field(default_factory=list, description="Affected test IDs")
    confidence: float = Field(..., ge=0.0, le=1.0, description="Confidence score")

class TriageResult(BaseEntity):
    run_id: uuid.UUID = Field(..., description="Reference to failed run")
    name: str = Field(..., max_length=500)
    clusters: List[FailureCluster] = Field(..., description="Root cause clusters")
    suggested_fix: Optional[str] = None
    confidence_score: Optional[float] = Field(None, ge=0.0, le=1.0)
    status: TestStatus = Field(default=TestStatus.PENDING)
    reviewed_by: Optional[str] = None

class TriageResultCreate(BaseModel):
    run_id: uuid.UUID
    name: str = Field(..., max_length=500)

class TriageResultResponse(BaseModel):
    run_id: uuid.UUID
    name: str
    cluster_count: int
    confidence_score: Optional[float]
    status: TestStatus
    created_at: datetime

# Patch Models
class Patch(BaseModel):
    file: str = Field(..., description="File path to patch")
    path: str = Field(..., description="Relative path within repository")
    unified_diff: str = Field(..., description="Git unified diff format")
    metadata: Dict[str, Any] = Field(default_factory=dict)

class PatchGet(BaseEntity):
    triage_id: uuid.UUID = Field(..., description="Reference to triage result")
    patches: List[Patch] = Field(..., description="Generated patches")
    open_pr: bool = Field(default=False, description="Whether PR was opened")
    pr_url: Optional[str] = Field(None, max_length=1000)
    state: TestStatus = Field(default=TestStatus.PENDING)
    branch: Optional[str] = Field(None, max_length=255)
    applied_at: Optional[datetime] = None
    applied_by: Optional[str] = None

class PatchCreate(BaseModel):
    triage_id: uuid.UUID
    patches: List[Patch]
    branch: Optional[str] = Field(None, max_length=255)

class PatchResponse(BaseModel):
    triage_id: uuid.UUID
    patch_count: int
    open_pr: bool
    pr_url: Optional[str]
    state: TestStatus
    created_at: datetime

# Event Models
class Event(BaseEntity):
    event_type: str = Field(..., max_length=100)
    entity_type: str = Field(..., max_length=50)
    entity_id: uuid.UUID
    user_id: Optional[str] = None
    details: Dict[str, Any] = Field(default_factory=dict)

# API Response Models
class APIResponse(BaseModel):
    success: bool = True
    message: str = "Operation completed successfully"
    data: Optional[Any] = None
    errors: Optional[List[str]] = None

class ErrorResponse(BaseModel):
    success: bool = False
    message: str
    errors: List[str] = Field(default_factory=list)
    details: Optional[Dict[str, Any]] = None

# Pagination Models
class PaginationParams(BaseModel):
    page: int = Field(default=1, ge=1)
    size: int = Field(default=20, ge=1, le=100)
    sort_by: Optional[str] = None
    sort_order: str = Field(default="desc", pattern="^(asc|desc)$")

class PaginatedResponse(BaseModel):
    items: List[Any]
    total: int
    page: int
    size: int
    pages: int
    has_next: bool
    has_prev: bool
