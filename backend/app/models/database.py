from sqlalchemy import Column, String, Text, Integer, DateTime, Boolean, ForeignKey, JSON
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid

Base = declarative_base()

class Plan(Base):
    __tablename__ = "plans"
    __table_args__ = {"schema": "qaai"}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    plan_id = Column(String(255), unique=True, nullable=False, index=True)
    name = Column(String(500), nullable=False)
    description = Column(Text)
    source = Column(Text, nullable=False)
    targets = Column(JSON, nullable=False)
    api_ui = Column(JSON, nullable=False)
    path = Column(String(1000))
    priority = Column(Integer, default=1)
    status = Column(String(50), default="draft", index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    created_by = Column(String(255))
    meta_data = Column(JSON, default={})

    # Relationships
    suites = relationship("Suite", back_populates="plan", cascade="all, delete-orphan")

class Suite(Base):
    __tablename__ = "suites"
    __table_args__ = {"schema": "qaai"}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    suite_id = Column(String(255), unique=True, nullable=False, index=True)
    plan_id = Column(UUID(as_uuid=True), ForeignKey("qaai.plans.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(500), nullable=False)
    description = Column(Text)
    test_type = Column(String(50), nullable=False, index=True)
    artifacts = Column(JSON, nullable=False)
    path = Column(String(1000))
    status = Column(String(50), default="draft", index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    created_by = Column(String(255))
    meta_data = Column(JSON, default={})

    # Relationships
    plan = relationship("Plan", back_populates="suites")
    runs = relationship("Run", back_populates="suite", cascade="all, delete-orphan")

class Run(Base):
    __tablename__ = "runs"
    __table_args__ = {"schema": "qaai"}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    run_id = Column(String(255), unique=True, nullable=False, index=True)
    suite_id = Column(UUID(as_uuid=True), ForeignKey("qaai.suites.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(500), nullable=False)
    status = Column(String(50), nullable=False, index=True)
    pass_count = Column(Integer, default=0)
    fail_count = Column(Integer, default=0)
    skip_count = Column(Integer, default=0)
    total_count = Column(Integer, default=0)
    duration_seconds = Column(Integer)
    reports = Column(JSON, default=[])
    logs = Column(Text)
    started_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    completed_at = Column(DateTime(timezone=True))
    created_by = Column(String(255))
    meta_data = Column(JSON, default={})

    # Relationships
    suite = relationship("Suite", back_populates="runs")
    triage_results = relationship("TriageResult", back_populates="run", cascade="all, delete-orphan")

class TriageResult(Base):
    __tablename__ = "triage_results"
    __table_args__ = {"schema": "qaai"}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    run_id = Column(UUID(as_uuid=True), ForeignKey("qaai.runs.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(500), nullable=False)
    clusters = Column(JSON, nullable=False)
    suggested_fix = Column(Text)
    confidence_score = Column(Integer)  # Store as integer (0-100) for simplicity
    status = Column(String(50), default="pending", index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    reviewed_by = Column(String(255))
    meta_data = Column(JSON, default={})

    # Relationships
    run = relationship("Run", back_populates="triage_results")
    patches = relationship("Patch", back_populates="triage_result", cascade="all, delete-orphan")

class Patch(Base):
    __tablename__ = "patches"
    __table_args__ = {"schema": "qaai"}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    triage_id = Column(UUID(as_uuid=True), ForeignKey("qaai.triage_results.id", ondelete="CASCADE"), nullable=False)
    file_path = Column(String(1000), nullable=False)
    unified_diff = Column(Text, nullable=False)
    open_pr = Column(Boolean, default=False)
    pr_url = Column(String(1000))
    state = Column(String(50), default="pending", index=True)
    branch = Column(String(255))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    applied_at = Column(DateTime(timezone=True))
    applied_by = Column(String(255))
    meta_data = Column(JSON, default={})

    # Relationships
    triage_result = relationship("TriageResult", back_populates="patches")

class Event(Base):
    __tablename__ = "events"
    __table_args__ = {"schema": "qaai"}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    event_type = Column(String(100), nullable=False, index=True)
    entity_type = Column(String(50), nullable=False)
    entity_id = Column(UUID(as_uuid=True), nullable=False)
    user_id = Column(String(255))
    details = Column(JSON, default={})
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)

class Embedding(Base):
    __tablename__ = "embeddings"
    __table_args__ = {"schema": "qaai"}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    content = Column(Text, nullable=False)
    content_type = Column(String(50), nullable=False)
    entity_id = Column(UUID(as_uuid=True))
    embedding = Column(JSON)  # Store as JSON for now, will use pgvector later
    meta_data = Column(JSON, default={})
    created_at = Column(DateTime(timezone=True), server_default=func.now())
