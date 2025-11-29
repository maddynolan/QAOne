"""
Prometheus Metrics Exporter
Exports metrics in Prometheus format for monitoring and alerting.
"""

import logging
import time
from typing import Dict, Any, Optional
from prometheus_client import Counter, Histogram, Gauge, generate_latest, CONTENT_TYPE_LATEST
from prometheus_client.core import CollectorRegistry, REGISTRY

logger = logging.getLogger(__name__)

# Create custom registry (optional - can use default REGISTRY)
registry = REGISTRY

# ==================== Test Execution Metrics ====================

# Test run metrics
test_runs_total = Counter(
    'qaai_test_runs_total',
    'Total number of test runs',
    ['status', 'project_id', 'tenant_id']
)

test_runs_duration = Histogram(
    'qaai_test_runs_duration_seconds',
    'Test run duration in seconds',
    ['project_id', 'tenant_id'],
    buckets=[1, 5, 10, 30, 60, 120, 300, 600, 1800, 3600]
)

test_steps_total = Counter(
    'qaai_test_steps_total',
    'Total number of test steps executed',
    ['status', 'test_case_id', 'tenant_id']
)

# ==================== AI Generation Metrics ====================

ai_generations_total = Counter(
    'qaai_ai_generations_total',
    'Total number of AI generations',
    ['provider', 'model', 'task_type', 'tenant_id']
)

ai_generation_duration = Histogram(
    'qaai_ai_generation_duration_seconds',
    'AI generation duration in seconds',
    ['provider', 'model', 'task_type', 'tenant_id'],
    buckets=[0.1, 0.5, 1, 2, 5, 10, 30, 60, 120]
)

ai_tokens_used = Counter(
    'qaai_ai_tokens_total',
    'Total AI tokens used',
    ['provider', 'model', 'type', 'tenant_id']  # type: prompt or completion
)

ai_cost_usd = Counter(
    'qaai_ai_cost_usd_total',
    'Total AI cost in USD',
    ['provider', 'model', 'tenant_id']
)

# ==================== Test Case Metrics ====================

test_cases_total = Gauge(
    'qaai_test_cases_total',
    'Total number of test cases',
    ['status', 'project_id', 'tenant_id']
)

test_cases_created = Counter(
    'qaai_test_cases_created_total',
    'Total number of test cases created',
    ['project_id', 'tenant_id']
)

# ==================== Defect Metrics ====================

defects_total = Gauge(
    'qaai_defects_total',
    'Total number of defects',
    ['severity', 'status', 'project_id', 'tenant_id']
)

defects_created = Counter(
    'qaai_defects_created_total',
    'Total number of defects created',
    ['severity', 'project_id', 'tenant_id']
)

# ==================== System Metrics ====================

api_requests_total = Counter(
    'qaai_api_requests_total',
    'Total API requests',
    ['method', 'endpoint', 'status_code', 'tenant_id']
)

api_request_duration = Histogram(
    'qaai_api_request_duration_seconds',
    'API request duration in seconds',
    ['method', 'endpoint', 'tenant_id'],
    buckets=[0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10, 30]
)

active_sessions = Gauge(
    'qaai_active_sessions',
    'Number of active sessions',
    ['session_type', 'tenant_id']  # session_type: flowstral, nexus, exploration
)

# ==================== Database Metrics ====================

db_queries_total = Counter(
    'qaai_db_queries_total',
    'Total database queries',
    ['operation', 'table', 'tenant_id']
)

db_query_duration = Histogram(
    'qaai_db_query_duration_seconds',
    'Database query duration in seconds',
    ['operation', 'table', 'tenant_id'],
    buckets=[0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 2, 5]
)

# ==================== Helper Functions ====================

def record_test_run(
    status: str,
    duration_seconds: float,
    project_id: Optional[str] = None,
    tenant_id: Optional[str] = None
):
    """Record a test run metric"""
    test_runs_total.labels(
        status=status,
        project_id=project_id or "unknown",
        tenant_id=tenant_id or "unknown"
    ).inc()
    
    if duration_seconds > 0:
        test_runs_duration.labels(
            project_id=project_id or "unknown",
            tenant_id=tenant_id or "unknown"
        ).observe(duration_seconds)


def record_ai_generation(
    provider: str,
    model: str,
    task_type: str,
    duration_seconds: float,
    prompt_tokens: int = 0,
    completion_tokens: int = 0,
    cost_usd: float = 0.0,
    tenant_id: Optional[str] = None
):
    """Record an AI generation metric"""
    ai_generations_total.labels(
        provider=provider,
        model=model,
        task_type=task_type or "unknown",
        tenant_id=tenant_id or "unknown"
    ).inc()
    
    ai_generation_duration.labels(
        provider=provider,
        model=model,
        task_type=task_type or "unknown",
        tenant_id=tenant_id or "unknown"
    ).observe(duration_seconds)
    
    if prompt_tokens > 0:
        ai_tokens_used.labels(
            provider=provider,
            model=model,
            type="prompt",
            tenant_id=tenant_id or "unknown"
        ).inc(prompt_tokens)
    
    if completion_tokens > 0:
        ai_tokens_used.labels(
            provider=provider,
            model=model,
            type="completion",
            tenant_id=tenant_id or "unknown"
        ).inc(completion_tokens)
    
    if cost_usd > 0:
        ai_cost_usd.labels(
            provider=provider,
            model=model,
            tenant_id=tenant_id or "unknown"
        ).inc(cost_usd)


def record_api_request(
    method: str,
    endpoint: str,
    status_code: int,
    duration_seconds: float,
    tenant_id: Optional[str] = None
):
    """Record an API request metric"""
    api_requests_total.labels(
        method=method,
        endpoint=endpoint,
        status_code=str(status_code),
        tenant_id=tenant_id or "unknown"
    ).inc()
    
    api_request_duration.labels(
        method=method,
        endpoint=endpoint,
        tenant_id=tenant_id or "unknown"
    ).observe(duration_seconds)


def get_metrics() -> bytes:
    """Get Prometheus metrics in text format"""
    return generate_latest(registry)


def get_metrics_content_type() -> str:
    """Get content type for Prometheus metrics"""
    return CONTENT_TYPE_LATEST

