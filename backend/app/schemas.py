"""
Pydantic models matching JSON schemas for training and API
Task 1: Requirement → Test Plan
Task 2: Requirement → Concrete Tests + Code
"""

from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field


# ---- Task 1: Requirement -> Test Plan ---- #

class ReqToTestPlanInput(BaseModel):
    requirement_id: str
    requirement_title: Optional[str] = None
    requirement_text: str
    acceptance_criteria: Optional[List[str]] = None
    domain_tags: Optional[List[str]] = None  # salesforce, ecommerce, sap, mobile, etc.
    risk_level: Optional[str] = Field(default="medium", pattern="^(low|medium|high)$")
    non_functional_focus: Optional[List[str]] = None  # performance, accessibility, security, reliability, usability


class TestPlanDataSet(BaseModel):
    name: str
    description: Optional[str] = None
    variables: Optional[Dict[str, Any]] = None  # key-value pairs for test data


class TestPlanScenario(BaseModel):
    scenario_id: str
    name: str
    description: Optional[str] = None
    type: str  # functional / non_functional / edge_case / negative
    test_types: Optional[List[str]] = None  # ui/api/performance/accessibility/security
    priority: str  # P0..P3
    is_positive: Optional[bool] = True
    preconditions: Optional[List[str]] = None
    postconditions: Optional[List[str]] = None
    data_sets: Optional[List[TestPlanDataSet]] = None
    tags: Optional[List[str]] = None


class CoverageSummary(BaseModel):
    happy_path_covered: Optional[bool] = None
    negative_paths_covered: Optional[bool] = None
    edge_cases_covered: Optional[bool] = None
    performance_covered: Optional[bool] = None
    accessibility_covered: Optional[bool] = None
    security_covered: Optional[bool] = None


class ReqToTestPlanOutput(BaseModel):
    test_plan_id: str
    summary: Optional[str] = None  # Short summary of what is being validated
    scenarios: List[TestPlanScenario]
    coverage_summary: Optional[CoverageSummary] = None


class ReqToTestPlanRequest(BaseModel):
    input: ReqToTestPlanInput


class ReqToTestPlanResponse(BaseModel):
    test_plan: ReqToTestPlanOutput
    raw_model_output: Optional[Dict[str, Any]] = None  # for debugging/telemetry


# ----- Task 2: Requirement -> Tests & Code ----- #

class ReqToTestsInput(BaseModel):
    requirement_id: str
    requirement_title: Optional[str] = None
    requirement_text: str
    acceptance_criteria: Optional[List[str]] = None
    domain_tags: Optional[List[str]] = None
    test_plan: Optional[ReqToTestPlanOutput] = None  # Optional output from Task 1 to ground test generation
    target_frameworks: Optional[List[str]] = None  # playwright, cypress, pytest-api, k6, axe, lighthouse, zap, etc.


class TestStep(BaseModel):
    index: int = Field(ge=1)  # minimum 1
    action: str
    expected_result: Optional[str] = None
    notes: Optional[str] = None


class AdditionalFile(BaseModel):
    filename: str
    content: str


class GeneratedTest(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    linked_scenario_id: Optional[str] = None
    test_type: str  # ui/api/performance/accessibility/security
    framework: str  # playwright/cypress/pytest-api/k6/axe/lighthouse/zap
    language: str  # typescript/javascript/python/go/yaml/other
    tags: Optional[List[str]] = None
    steps: Optional[List[TestStep]] = None  # Human-readable steps
    assertions: Optional[List[str]] = None
    preconditions: Optional[List[str]] = None
    postconditions: Optional[List[str]] = None
    code: str  # Full code snippet for the test
    additional_files: Optional[List[AdditionalFile]] = None  # e.g. k6 config, ZAP policy


class ReqToTestsOutput(BaseModel):
    tests: List[GeneratedTest]


class ReqToTestsRequest(BaseModel):
    input: ReqToTestsInput


class ReqToTestsResponse(BaseModel):
    tests: List[GeneratedTest]
    raw_model_output: Optional[Dict[str, Any]] = None  # for debugging/telemetry


# Metadata for training (optional)
class TrainingMetadata(BaseModel):
    """Optional metadata for training only"""
    pass  # Can be extended with training-specific fields


