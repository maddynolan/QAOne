"""
Pydantic models for Requirement Context and Test Case schemas
Based on the specification for requirement-to-test-case generation
"""

from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field
from enum import Enum


class RequirementType(str, Enum):
    """High-level requirement type used for pattern selection"""
    WORKFLOW_FEATURE = "workflow_feature"
    CRUD = "crud"
    VALIDATION = "validation"
    CALCULATION = "calculation"
    INTEGRATION = "integration"
    PERMISSION = "permission"
    REPORTING = "reporting"
    NON_FUNCTIONAL = "non_functional"


class RequirementContext(BaseModel):
    """Structured requirement context model"""
    requirement_id: str = Field(..., description="External ID of the requirement, e.g. Jira key")
    title: str = Field(..., description="Short human-readable title of the requirement")
    type: RequirementType = Field(..., description="High-level requirement type used for pattern selection")
    
    domain_area: Optional[str] = Field(None, description="Domain or module name, e.g. 'Authentication', 'Payments'")
    primary_actor: Optional[str] = Field(None, description="Main actor using this feature")
    secondary_actors: Optional[List[str]] = Field(default_factory=list, description="Other systems or roles involved")
    entities: Optional[List[str]] = Field(default_factory=list, description="Domain entities affected by this requirement")
    preconditions: Optional[List[str]] = Field(default_factory=list, description="Conditions that must be true before scenario begins")
    triggers: Optional[List[str]] = Field(default_factory=list, description="Events or actions that initiate the flow")
    main_outcomes: Optional[List[str]] = Field(default_factory=list, description="Key outcomes or goals of the requirement")
    business_rules: Optional[List[str]] = Field(default_factory=list, description="Explicit business rules / constraints")
    risks: Optional[List[str]] = Field(default_factory=list, description="Known risk areas related to this requirement")
    acceptance_criteria: Optional[List[str]] = Field(default_factory=list, description="Acceptance criteria imported from the tracking tool")
    raw_requirements_text: Optional[str] = Field(None, description="Optional raw description text from Jira/spec for traceability")
    metadata: Optional[Dict[str, Any]] = Field(default_factory=dict, description="Optional arbitrary metadata (labels, priority, etc.)")


class TestCaseStep(BaseModel):
    """A single step in a test case"""
    step_number: int = Field(..., ge=1, description="Sequential number of the step")
    action: str = Field(..., description="What the user/system does in this step")
    expected_result: Optional[str] = Field(None, description="Expected outcome after this step, if applicable")
    screen_id: Optional[str] = Field(None, description="Optional reference to synthetic/real screen ID")
    target_id: Optional[str] = Field(None, description="Optional reference to abstract target element ID (field/button/etc.)")
    data: Optional[Dict[str, Any]] = Field(default_factory=dict, description="Optional test data used in this step")


class TestCasePriority(str, Enum):
    """Test case priority"""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


class AutomationMetadata(BaseModel):
    """Automation-related metadata"""
    candidate: Optional[bool] = Field(None, description="Whether this test is recommended for automation")
    tool: Optional[str] = Field(None, description="Target tool/framework (e.g. 'playwright', 'selenium')")
    script_reference: Optional[str] = Field(None, description="Reference to generated automation script or ID")


class TestCaseLinks(BaseModel):
    """Traceability links"""
    defects: Optional[List[str]] = Field(default_factory=list)
    related_tests: Optional[List[str]] = Field(default_factory=list)


class TestCase(BaseModel):
    """Complete test case model"""
    id: str = Field(..., description="Unique ID of the test case within your system")
    requirement_id: str = Field(..., description="ID of the linked requirement (e.g. Jira key)")
    title: str = Field(..., description="Short summary of what this test case validates")
    objective: Optional[str] = Field(None, description="Optional longer description of the test case goal")
    kind: Optional[str] = Field(None, description="Category for pattern-based grouping (e.g. 'happy_path', 'negative', 'boundary')")
    preconditions: Optional[List[str]] = Field(default_factory=list, description="Conditions that must be satisfied before executing the test")
    steps: List[TestCaseStep] = Field(..., description="Ordered list of steps for the test case")
    expected_result_summary: Optional[str] = Field(None, description="High-level expected outcome for the whole test")
    postconditions: Optional[List[str]] = Field(default_factory=list, description="State that should hold after the test (if applicable)")
    priority: TestCasePriority = Field(default=TestCasePriority.MEDIUM, description="Business or testing priority of the test case")
    tags: Optional[List[str]] = Field(default_factory=list, description="Free-form tags for filtering/grouping (e.g. 'security', 'regression')")
    automation: Optional[AutomationMetadata] = Field(None, description="Optional automation-related metadata")
    links: Optional[TestCaseLinks] = Field(None, description="Optional traceability links")
    metadata: Optional[Dict[str, Any]] = Field(default_factory=dict, description="Optional arbitrary metadata (suite, component, etc.)")


class SyntheticScreen(BaseModel):
    """Synthetic screen model"""
    id: str
    name: str
    type: str  # "list", "form", "detail", etc.
    entities: Optional[List[str]] = Field(default_factory=list)
    fields: Optional[List[Dict[str, Any]]] = Field(default_factory=list)
    actions: Optional[List[Dict[str, Any]]] = Field(default_factory=list)


class SyntheticAPI(BaseModel):
    """Synthetic API model"""
    id: str
    name: str
    method: str
    path: str
    request_schema: Optional[Dict[str, Any]] = Field(default_factory=dict)
    response_scenarios: Optional[List[Dict[str, Any]]] = Field(default_factory=list)


class SyntheticAppModel(BaseModel):
    """Synthetic application model generated from requirements"""
    requirement_id: str
    screens: List[SyntheticScreen] = Field(default_factory=list)
    apis: List[SyntheticAPI] = Field(default_factory=list)
    policies: Optional[Dict[str, Any]] = Field(default_factory=dict)


class ScenarioSkeleton(BaseModel):
    """Deterministic scenario skeleton before LLM rewrite"""
    id: str
    requirement_id: str
    kind: str  # "happy_path", "negative", "boundary", etc.
    title: str
    preconditions: List[str] = Field(default_factory=list)
    steps: List[str] = Field(..., description="High-level step descriptions")
    expected_result: List[str] = Field(default_factory=list, description="Expected outcomes")
    priority: str = "medium"
    tags: List[str] = Field(default_factory=list)




