"""
CodeAlchemy Data Models
=======================

Data structures for the repository-to-test-case transformation pipeline.
"""

from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional
from enum import Enum
from datetime import datetime
import uuid


class ImportJobStatus(str, Enum):
    """Status of an import job"""
    PENDING = "pending"
    ANALYZING = "analyzing"
    CONVERTING = "converting"
    IMPORTING = "importing"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


@dataclass
class AlchemyTestStep:
    """A single step in a test case (Builder format)"""
    action: str  # navigate, click, fill, assert, wait, etc.
    selector: str = ""  # CSS selector or locator
    value: str = ""  # Input value or URL
    description: str = ""  # Human-readable description
    
    # Additional metadata
    original_code: str = ""  # Original code line (hidden from user)
    locator_type: str = ""  # id, css, xpath, role, text, etc.
    wait_time: int = 0  # Wait time in ms
    
    # Assertion specific
    assert_type: str = ""  # visible, text, value, url, title
    expected_value: str = ""
    
    def to_dict(self) -> Dict:
        return {
            "action": self.action,
            "selector": self.selector,
            "value": self.value,
            "description": self.description,
            "locatorType": self.locator_type,
            "waitTime": self.wait_time,
            "assertType": self.assert_type,
            "expectedValue": self.expected_value
        }


@dataclass
class AlchemyTestCase:
    """A test case in Builder format (converted from source code)"""
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    name: str = ""
    description: str = ""
    priority: str = "medium"  # critical, high, medium, low
    tags: List[str] = field(default_factory=list)
    steps: List[AlchemyTestStep] = field(default_factory=list)
    
    # Metadata
    original_method_name: str = ""
    original_class_name: str = ""
    original_file_path: str = ""
    framework: str = ""
    language: str = ""
    
    # Statistics
    step_count: int = 0
    assertion_count: int = 0
    
    # Source tracking
    source_repository: str = ""
    source_branch: str = ""
    imported_at: Optional[str] = None
    
    def __post_init__(self):
        self.step_count = len(self.steps)
        self.assertion_count = len([s for s in self.steps if s.action == "assert"])
    
    def to_dict(self) -> Dict:
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "priority": self.priority,
            "tags": self.tags,
            "steps": [s.to_dict() for s in self.steps],
            "originalMethodName": self.original_method_name,
            "originalClassName": self.original_class_name,
            "originalFilePath": self.original_file_path,
            "framework": self.framework,
            "language": self.language,
            "stepCount": self.step_count,
            "assertionCount": self.assertion_count,
            "sourceRepository": self.source_repository,
            "sourceBranch": self.source_branch,
            "importedAt": self.imported_at
        }
    
    def to_builder_format(self) -> Dict:
        """Convert to the exact format expected by UnifiedWorkflowEditor"""
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "priority": self.priority,
            "tags": self.tags + ["imported", f"framework:{self.framework}"],
            "testType": "automation",
            "status": "draft",
            "steps": [
                {
                    "id": f"step-{i}",
                    "action": step.action,
                    "selector": step.selector,
                    "value": step.value,
                    "description": step.description,
                    "locatorType": step.locator_type or "css",
                    "assertType": step.assert_type,
                    "expectedValue": step.expected_value,
                    "waitTime": step.wait_time
                }
                for i, step in enumerate(self.steps)
            ],
            "metadata": {
                "source": "code_alchemy",
                "repository": self.source_repository,
                "branch": self.source_branch,
                "originalMethod": self.original_method_name,
                "originalClass": self.original_class_name,
                "originalFile": self.original_file_path,
                "framework": self.framework,
                "language": self.language,
                "importedAt": self.imported_at or datetime.now().isoformat()
            }
        }


@dataclass
class AlchemyAnalysisResult:
    """Result of analyzing a repository"""
    success: bool = True
    error_message: str = ""
    
    # Repository info
    repository_url: str = ""
    branch: str = ""
    provider: str = ""  # github, gitlab, bitbucket, azure-devops
    
    # Framework detection
    framework_type: str = ""
    framework_name: str = ""
    language: str = ""
    patterns_used: List[str] = field(default_factory=list)
    
    # Statistics
    files_analyzed: int = 0
    test_files_found: int = 0
    test_methods_found: int = 0
    page_objects_found: int = 0
    assertions_found: int = 0
    
    # Extracted test cases (preview - no code shown)
    test_cases: List[AlchemyTestCase] = field(default_factory=list)
    
    # Analysis metadata
    analysis_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    analyzed_at: str = field(default_factory=lambda: datetime.now().isoformat())
    duration_seconds: float = 0
    
    # Entities and domain info
    domain: str = ""
    entities: List[str] = field(default_factory=list)
    
    def to_dict(self) -> Dict:
        return {
            "success": self.success,
            "errorMessage": self.error_message,
            "repositoryUrl": self.repository_url,
            "branch": self.branch,
            "provider": self.provider,
            "frameworkType": self.framework_type,
            "frameworkName": self.framework_name,
            "language": self.language,
            "patternsUsed": self.patterns_used,
            "filesAnalyzed": self.files_analyzed,
            "testFilesFound": self.test_files_found,
            "testMethodsFound": self.test_methods_found,
            "pageObjectsFound": self.page_objects_found,
            "assertionsFound": self.assertions_found,
            "testCases": [tc.to_dict() for tc in self.test_cases],
            "analysisId": self.analysis_id,
            "analyzedAt": self.analyzed_at,
            "durationSeconds": self.duration_seconds,
            "domain": self.domain,
            "entities": self.entities
        }


@dataclass
class ImportJob:
    """Tracks a long-running import job"""
    job_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    status: ImportJobStatus = ImportJobStatus.PENDING
    
    # Progress tracking
    total_test_cases: int = 0
    imported_count: int = 0
    failed_count: int = 0
    progress_percent: float = 0
    current_item: str = ""
    
    # Configuration
    analysis_id: str = ""
    selected_test_ids: List[str] = field(default_factory=list)
    target_suite_id: str = ""
    target_suite_name: str = ""
    
    # Results
    imported_test_case_ids: List[str] = field(default_factory=list)
    errors: List[Dict] = field(default_factory=list)
    
    # Timestamps
    started_at: Optional[str] = None
    completed_at: Optional[str] = None
    
    def to_dict(self) -> Dict:
        return {
            "jobId": self.job_id,
            "status": self.status.value,
            "totalTestCases": self.total_test_cases,
            "importedCount": self.imported_count,
            "failedCount": self.failed_count,
            "progressPercent": self.progress_percent,
            "currentItem": self.current_item,
            "analysisId": self.analysis_id,
            "targetSuiteId": self.target_suite_id,
            "targetSuiteName": self.target_suite_name,
            "importedTestCaseIds": self.imported_test_case_ids,
            "errors": self.errors,
            "startedAt": self.started_at,
            "completedAt": self.completed_at
        }

