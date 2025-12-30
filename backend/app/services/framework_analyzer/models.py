"""
Data Models for Framework Analyzer

Defines the core data structures for:
- Parsed code elements
- Domain models
- Analysis results
"""

from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional
from enum import Enum
from datetime import datetime


class FrameworkType(str, Enum):
    """Supported automation frameworks"""
    SELENIUM_JAVA = "selenium-java"
    SELENIUM_PYTHON = "selenium-python"
    SELENIUM_CSHARP = "selenium-csharp"
    CYPRESS = "cypress"
    PLAYWRIGHT_PYTHON = "playwright-python"
    PLAYWRIGHT_TYPESCRIPT = "playwright-typescript"
    TESTNG = "testng"
    JUNIT = "junit"
    PYTEST = "pytest"
    ROBOT_FRAMEWORK = "robot-framework"
    CUCUMBER = "cucumber"
    KATALON = "katalon"
    CUSTOM = "custom"
    UNKNOWN = "unknown"


class LocatorType(str, Enum):
    """Types of element locators"""
    ID = "id"
    NAME = "name"
    CLASS_NAME = "class_name"
    CSS_SELECTOR = "css_selector"
    XPATH = "xpath"
    LINK_TEXT = "link_text"
    PARTIAL_LINK_TEXT = "partial_link_text"
    TAG_NAME = "tag_name"
    DATA_TESTID = "data_testid"
    ARIA_LABEL = "aria_label"
    ROLE = "role"
    TEXT = "text"
    CUSTOM = "custom"


class AssertionType(str, Enum):
    """Types of assertions found in tests"""
    EQUALS = "equals"
    NOT_EQUALS = "not_equals"
    TRUE = "true"
    FALSE = "false"
    NULL = "null"
    NOT_NULL = "not_null"
    CONTAINS = "contains"
    NOT_CONTAINS = "not_contains"
    VISIBLE = "visible"
    NOT_VISIBLE = "not_visible"
    ENABLED = "enabled"
    DISABLED = "disabled"
    EXISTS = "exists"
    COUNT = "count"
    URL = "url"
    TITLE = "title"
    TEXT_CONTENT = "text_content"
    ATTRIBUTE = "attribute"
    CUSTOM = "custom"


@dataclass
class Locator:
    """Represents an element locator"""
    name: str  # Variable/method name
    locator_type: LocatorType
    value: str  # The actual locator string
    element_description: str = ""  # Human-readable description
    page_name: str = ""  # Which page this belongs to
    confidence: float = 1.0  # How confident we are in this locator
    
    # Metadata
    file_path: str = ""
    line_number: int = 0
    original_code: str = ""


@dataclass
class Assertion:
    """Represents a test assertion"""
    assertion_type: AssertionType
    expected_value: str
    actual_expression: str
    description: str = ""  # Inferred business rule
    
    # Metadata
    file_path: str = ""
    line_number: int = 0
    original_code: str = ""
    
    def to_requirement(self) -> str:
        """Convert assertion to a requirement statement"""
        if self.assertion_type == AssertionType.EQUALS:
            return f"System shall display '{self.expected_value}'"
        elif self.assertion_type == AssertionType.TRUE:
            return f"System shall ensure {self.actual_expression}"
        elif self.assertion_type == AssertionType.VISIBLE:
            return f"System shall display {self.actual_expression}"
        elif self.assertion_type == AssertionType.CONTAINS:
            return f"System shall include '{self.expected_value}' in {self.actual_expression}"
        elif self.assertion_type == AssertionType.URL:
            return f"System shall navigate to URL containing '{self.expected_value}'"
        elif self.assertion_type == AssertionType.TITLE:
            return f"Page title shall be '{self.expected_value}'"
        else:
            return f"System shall verify: {self.description or self.original_code}"


@dataclass
class TestStep:
    """Represents a single step in a test"""
    action: str  # click, fill, navigate, etc.
    target: str  # Element or URL
    value: str = ""  # Input value if any
    description: str = ""  # Human-readable description
    wait_condition: str = ""  # Any wait before this step
    
    # Metadata
    line_number: int = 0
    original_code: str = ""


@dataclass
class TestMethod:
    """Represents a test method/function"""
    name: str
    description: str = ""
    class_name: str = ""
    file_path: str = ""
    
    # Test content
    steps: List[TestStep] = field(default_factory=list)
    assertions: List[Assertion] = field(default_factory=list)
    
    # Test metadata
    annotations: List[str] = field(default_factory=list)  # @Test, @pytest.mark, etc.
    tags: List[str] = field(default_factory=list)  # smoke, regression, etc.
    priority: str = "medium"
    data_driven: bool = False
    data_source: str = ""
    
    # Dependencies
    depends_on: List[str] = field(default_factory=list)
    setup_method: str = ""
    teardown_method: str = ""
    
    def to_test_case_title(self) -> str:
        """Convert test method name to readable title"""
        # testLoginWithValidCredentials -> Login With Valid Credentials
        name = self.name
        if name.startswith("test_"):
            name = name[5:]
        elif name.startswith("test"):
            name = name[4:]
        
        # Convert camelCase to Title Case
        result = []
        for i, char in enumerate(name):
            if char.isupper() and i > 0:
                result.append(' ')
            result.append(char)
        
        return ''.join(result).replace('_', ' ').title()


@dataclass
class PageObject:
    """Represents a Page Object class"""
    name: str
    file_path: str = ""
    url_pattern: str = ""  # URL this page maps to
    description: str = ""
    
    # Elements
    locators: List[Locator] = field(default_factory=list)
    
    # Methods (actions on this page)
    action_methods: List[str] = field(default_factory=list)  # login(), addToCart()
    verification_methods: List[str] = field(default_factory=list)  # isLoggedIn()
    
    # Inferred information
    entity: str = ""  # User, Product, Cart, etc.
    operations: List[str] = field(default_factory=list)  # CRUD operations
    
    def infer_entity(self) -> str:
        """Infer the business entity from page name"""
        name = self.name.replace("Page", "").replace("Screen", "")
        # LoginPage -> User/Auth, ProductPage -> Product, CartPage -> Cart
        entity_map = {
            "Login": "Authentication",
            "Register": "User",
            "SignUp": "User",
            "Product": "Product",
            "Cart": "Cart",
            "Checkout": "Order",
            "Order": "Order",
            "Payment": "Payment",
            "Profile": "User",
            "Account": "User",
            "Search": "Search",
            "Home": "Navigation",
            "Dashboard": "Dashboard",
        }
        for key, entity in entity_map.items():
            if key.lower() in name.lower():
                return entity
        return name


@dataclass
class UserFlow:
    """Represents a user journey/flow"""
    name: str
    description: str = ""
    priority: str = "medium"  # critical, high, medium, low
    
    # Flow definition
    pages: List[str] = field(default_factory=list)  # Ordered list of pages
    steps: List[TestStep] = field(default_factory=list)
    
    # Business context
    preconditions: List[str] = field(default_factory=list)
    postconditions: List[str] = field(default_factory=list)
    
    # Source
    source_tests: List[str] = field(default_factory=list)  # Test methods that cover this flow


@dataclass
class BusinessRule:
    """Represents an inferred business rule"""
    rule_id: str
    description: str
    category: str = ""  # Validation, Access Control, Business Logic, etc.
    priority: str = "medium"
    
    # Source
    source_assertions: List[Assertion] = field(default_factory=list)
    source_tests: List[str] = field(default_factory=list)
    
    # Generated requirement
    requirement_text: str = ""


@dataclass
class FrameworkInfo:
    """Information about the detected framework"""
    framework_type: FrameworkType
    language: str  # java, python, javascript, typescript
    version: str = ""
    
    # Project structure
    test_directory: str = ""
    page_object_directory: str = ""
    config_files: List[str] = field(default_factory=list)
    
    # Dependencies
    dependencies: List[str] = field(default_factory=list)
    
    # Patterns used
    uses_page_objects: bool = False
    uses_data_driven: bool = False
    uses_bdd: bool = False
    uses_reporting: bool = False


@dataclass
class DomainModel:
    """The complete domain model extracted from the framework"""
    # Application info
    application_name: str = ""
    domain: str = ""  # e-commerce, banking, healthcare, etc.
    application_type: str = ""  # web, mobile, api
    base_url: str = ""
    
    # Extracted elements
    pages: List[PageObject] = field(default_factory=list)
    entities: List[str] = field(default_factory=list)
    operations: Dict[str, List[str]] = field(default_factory=dict)  # entity -> [operations]
    
    # Test information
    test_methods: List[TestMethod] = field(default_factory=list)
    user_flows: List[UserFlow] = field(default_factory=list)
    
    # Business rules
    business_rules: List[BusinessRule] = field(default_factory=list)
    
    # All locators (for element repository)
    all_locators: List[Locator] = field(default_factory=list)
    
    # Statistics
    total_tests: int = 0
    total_pages: int = 0
    total_locators: int = 0
    total_assertions: int = 0
    
    # Confidence scores
    domain_confidence: float = 0.0
    extraction_confidence: float = 0.0
    
    def get_coverage_summary(self) -> Dict[str, Any]:
        """Get a summary of what's covered by tests"""
        return {
            "pages_covered": len(self.pages),
            "entities_identified": len(self.entities),
            "user_flows": len(self.user_flows),
            "business_rules": len(self.business_rules),
            "total_tests": self.total_tests,
            "total_assertions": self.total_assertions,
        }


@dataclass
class AnalysisResult:
    """Complete result of framework analysis"""
    # Status
    success: bool
    error_message: str = ""
    
    # Timing
    started_at: datetime = field(default_factory=datetime.now)
    completed_at: Optional[datetime] = None
    duration_seconds: float = 0
    
    # Framework info
    framework_info: Optional[FrameworkInfo] = None
    
    # Domain model
    domain_model: Optional[DomainModel] = None
    
    # Files processed
    files_processed: int = 0
    files_with_errors: List[str] = field(default_factory=list)
    
    # Warnings
    warnings: List[str] = field(default_factory=list)
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for API response"""
        return {
            "success": self.success,
            "error_message": self.error_message,
            "duration_seconds": self.duration_seconds,
            "framework_info": {
                "type": self.framework_info.framework_type.value if self.framework_info else None,
                "language": self.framework_info.language if self.framework_info else None,
            } if self.framework_info else None,
            "domain_model": {
                "application_name": self.domain_model.application_name if self.domain_model else None,
                "domain": self.domain_model.domain if self.domain_model else None,
                "coverage": self.domain_model.get_coverage_summary() if self.domain_model else None,
            } if self.domain_model else None,
            "files_processed": self.files_processed,
            "warnings": self.warnings,
        }

