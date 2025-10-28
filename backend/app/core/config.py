# Enhanced Configuration with Job Orchestration and Caching
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.ext.declarative import declarative_base
from pydantic_settings import BaseSettings
from typing import Optional, List
import os
import redis
from celery import Celery

class Settings(BaseSettings):
    # Database settings
    database_url: str = "postgresql://qaai:qaai_dev@localhost:5432/qaai"
    database_pool_size: int = 10
    database_max_overflow: int = 20
    
    # Redis settings
    redis_url: str = "redis://localhost:6379"
    redis_max_connections: int = 10
    
    # Celery settings for job orchestration
    celery_broker_url: str = "redis://localhost:6379/0"
    celery_result_backend: str = "redis://localhost:6379/0"
    celery_task_serializer: str = "json"
    celery_result_serializer: str = "json"
    celery_accept_content: List[str] = ["json"]
    celery_timezone: str = "UTC"
    celery_enable_utc: bool = True
    
    # API settings
    api_title: str = "QA AI Platform API"
    api_version: str = "1.0.0"
    api_description: str = "Hybrid AI QA platform for automated test generation and execution"
    debug: bool = False
    environment: str = "development"
    
    # Security settings
    secret_key: str = "your-secret-key-change-in-production"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    
    # LLM settings with caching strategy
    openai_api_key: Optional[str] = None
    openai_model: str = "gpt-3.5-turbo"
    vllm_base_url: Optional[str] = None
    vllm_model: str = "llama-2-7b"
    
    # LLM Caching settings
    llm_cache_ttl: int = 3600  # 1 hour
    llm_cache_enabled: bool = True
    prompt_template_version: str = "v1.0"
    
    # Test execution settings
    max_concurrent_runs: int = 5
    test_timeout_seconds: int = 300
    artifact_storage_path: str = "./artifacts"
    
    # Job orchestration settings
    job_retry_attempts: int = 3
    job_retry_delay: int = 60  # seconds
    job_backoff_factor: float = 2.0
    
    # Rate limiting
    rate_limit_per_minute: int = 100
    rate_limit_burst: int = 20
    
    # CORS settings
    cors_origins: list = ["http://localhost:3000", "http://localhost:8000"]
    
    class Config:
        env_file = ".env"
        case_sensitive = False

# Global settings instance
settings = Settings()

# Database engine and session
engine = create_engine(
    settings.database_url,
    pool_size=settings.database_pool_size,
    max_overflow=settings.database_max_overflow,
    echo=settings.debug
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Redis connection with proper configuration
def get_redis():
    return redis.from_url(
        settings.redis_url,
        max_connections=settings.redis_max_connections,
        retry_on_timeout=True,
        decode_responses=True
    )

# Celery app for job orchestration
celery_app = Celery(
    "qaai",
    broker=settings.celery_broker_url,
    backend=settings.celery_result_backend,
    include=["app.tasks"]
)

celery_app.conf.update(
    task_serializer=settings.celery_task_serializer,
    result_serializer=settings.celery_result_serializer,
    accept_content=settings.celery_accept_content,
    timezone=settings.celery_timezone,
    enable_utc=settings.celery_enable_utc,
    task_track_started=True,
    task_time_limit=settings.test_timeout_seconds,
    task_soft_time_limit=settings.test_timeout_seconds - 30,
    worker_prefetch_multiplier=1,
    task_acks_late=True,
    worker_disable_rate_limits=False,
    task_reject_on_worker_lost=True,
    result_expires=3600,  # 1 hour
)

# Dependency to get database session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Cache key generation for LLM responses
def generate_cache_key(model_id: str, prompt_template: str, input_hash: str, policy_flags: str = "") -> str:
    """Generate cache key for LLM responses with versioning"""
    import hashlib
    
    key_components = [
        f"llm:{model_id}",
        f"template:{settings.prompt_template_version}",
        f"input:{input_hash}",
        f"policy:{policy_flags}" if policy_flags else ""
    ]
    
    key_string = "|".join(filter(None, key_components))
    return f"qaai:{hashlib.md5(key_string.encode()).hexdigest()}"

# Cache invalidation triggers
def invalidate_cache_on_spec_change(spec_hash: str):
    """Invalidate cache when specification changes"""
    redis_client = get_redis()
    pattern = f"qaai:*spec:{spec_hash}*"
    keys = redis_client.keys(pattern)
    if keys:
        redis_client.delete(*keys)

def invalidate_cache_on_data_change(data_hash: str):
    """Invalidate cache when test data changes"""
    redis_client = get_redis()
    pattern = f"qaai:*data:{data_hash}*"
    keys = redis_client.keys(pattern)
    if keys:
        redis_client.delete(*keys)