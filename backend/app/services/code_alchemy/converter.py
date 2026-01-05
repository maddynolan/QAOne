"""
CodeAlchemy Test Case Converter
===============================

Converts test methods from various frameworks into EXECUTABLE Builder test cases.

KEY REQUIREMENT: Converted tests MUST be runnable, not just documentation!

Conversion Pipeline:
1. Parse original test method (from Framework Analyzer)
2. Convert selectors to Playwright format
3. Map actions to executable commands
4. Transform assertions to runnable verifications
5. Preserve test data for data-driven tests
6. Output Builder-compatible test case

Supported Source Frameworks:
- Selenium (Java, Python, C#) → Playwright Python
- Cypress (JavaScript) → Playwright Python
- Playwright (TypeScript) → Playwright Python
- Robot Framework → Playwright Python
- TestNG/JUnit assertions → Playwright assertions
"""

import re
import logging
from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass

from .models import AlchemyTestCase, AlchemyTestStep

logger = logging.getLogger(__name__)


@dataclass
class SelectorMapping:
    """Maps source selector to Playwright selector"""
    original: str
    playwright: str
    locator_type: str
    confidence: float = 1.0


class TestCaseConverter:
    """
    Converts framework-specific test methods to executable Builder test cases.
    
    The output MUST be runnable by the Flowstral Engine / Playwright executor.
    """
    
    # =========================================================================
    # SELENIUM SELECTOR CONVERSIONS
    # =========================================================================
    
    SELENIUM_TO_PLAYWRIGHT = {
        # By.ID -> get_by_test_id or locator with id
        r'By\.id\(["\']([^"\']+)["\']\)': lambda m: f'locator("#{m.group(1)}")',
        r'By\.ID,\s*["\']([^"\']+)["\']': lambda m: f'locator("#{m.group(1)}")',
        
        # By.name -> locator with name attribute
        r'By\.name\(["\']([^"\']+)["\']\)': lambda m: f'locator("[name=\\"{m.group(1)}\\"]")',
        r'By\.NAME,\s*["\']([^"\']+)["\']': lambda m: f'locator("[name=\\"{m.group(1)}\\"]")',
        
        # By.className -> locator with class
        r'By\.className\(["\']([^"\']+)["\']\)': lambda m: f'locator(".{m.group(1)}")',
        r'By\.CLASS_NAME,\s*["\']([^"\']+)["\']': lambda m: f'locator(".{m.group(1)}")',
        
        # By.cssSelector -> locator
        r'By\.cssSelector\(["\']([^"\']+)["\']\)': lambda m: f'locator("{m.group(1)}")',
        r'By\.CSS_SELECTOR,\s*["\']([^"\']+)["\']': lambda m: f'locator("{m.group(1)}")',
        
        # By.xpath -> locator with xpath
        r'By\.xpath\(["\']([^"\']+)["\']\)': lambda m: f'locator("xpath={m.group(1)}")',
        r'By\.XPATH,\s*["\']([^"\']+)["\']': lambda m: f'locator("xpath={m.group(1)}")',
        
        # By.linkText -> get_by_role link
        r'By\.linkText\(["\']([^"\']+)["\']\)': lambda m: f'get_by_role("link", name="{m.group(1)}")',
        r'By\.LINK_TEXT,\s*["\']([^"\']+)["\']': lambda m: f'get_by_role("link", name="{m.group(1)}")',
        
        # By.partialLinkText -> get_by_role link with partial
        r'By\.partialLinkText\(["\']([^"\']+)["\']\)': lambda m: f'get_by_text("{m.group(1)}")',
        
        # By.tagName -> locator
        r'By\.tagName\(["\']([^"\']+)["\']\)': lambda m: f'locator("{m.group(1)}")',
    }
    
    # =========================================================================
    # CYPRESS SELECTOR CONVERSIONS (applied directly, not as regex)
    # =========================================================================
    
    # =========================================================================
    # ACTION MAPPINGS (All frameworks to Playwright)
    # =========================================================================
    
    ACTION_PATTERNS = {
        # Navigation
        "navigate": [
            r'(?:driver\.get|page\.goto|cy\.visit|browser\.url)\(["\']([^"\']+)["\']\)',
            r'navigate\(\)\.to\(["\']([^"\']+)["\']\)',
            r'open\(["\']([^"\']+)["\']\)',
        ],
        
        # Click actions
        "click": [
            r'\.click\(\)',
            r'\.submit\(\)',
            r'\.doubleClick\(\)',
            r'\.dblclick\(\)',
        ],
        
        # Text input
        "fill": [
            r'\.sendKeys\(["\']([^"\']+)["\']\)',
            r'\.type\(["\']([^"\']+)["\']\)',
            r'\.fill\(["\']([^"\']+)["\']\)',
            r'\.clear\(\)\.type\(["\']([^"\']+)["\']\)',
            r'\.setValue\(["\']([^"\']+)["\']\)',
            r'Input Text\s+\S+\s+([^\n]+)',  # Robot Framework
        ],
        
        # Clear input
        "clear": [
            r'\.clear\(\)',
        ],
        
        # Select/dropdown
        "select": [
            r'\.selectByVisibleText\(["\']([^"\']+)["\']\)',
            r'\.selectByValue\(["\']([^"\']+)["\']\)',
            r'\.select\(["\']([^"\']+)["\']\)',
            r'Select From List By Label\s+\S+\s+([^\n]+)',  # Robot Framework
        ],
        
        # Hover
        "hover": [
            r'\.hover\(\)',
            r'\.moveToElement\(',
            r'Mouse Over\s+',  # Robot Framework
        ],
        
        # Wait
        "wait": [
            r'\.waitForSelector\(',
            r'\.waitForElementVisible\(',
            r'WebDriverWait\(',
            r'\.should\(["\']be\.visible["\']\)',
            r'Wait Until Element Is Visible\s+',  # Robot Framework
        ],
        
        # Keyboard
        "press": [
            r'\.press\(["\']([^"\']+)["\']\)',
            r'\.sendKeys\(Keys\.([A-Z_]+)\)',
            r'Press Keys\s+\S+\s+([^\n]+)',  # Robot Framework
        ],
        
        # Scroll
        "scroll": [
            r'\.scrollIntoView\(',
            r'\.scrollTo\(',
            r'Scroll Element Into View\s+',  # Robot Framework
        ],
        
        # Upload file
        "upload": [
            r'\.setInputFiles\(',
            r'\.attachFile\(',
            r'Choose File\s+',  # Robot Framework
        ],
    }
    
    # =========================================================================
    # ASSERTION MAPPINGS
    # =========================================================================
    
    ASSERTION_PATTERNS = {
        # Visibility assertions
        "visible": [
            r'(?:assert|expect).*(?:isDisplayed|to_be_visible|be\.visible|should.*visible)',
            r'\.should\(["\']be\.visible["\']\)',
            r'expect\(.*\)\.toBeVisible\(\)',
            r'Element Should Be Visible\s+',  # Robot Framework
        ],
        
        # Text content assertions
        "text": [
            r'(?:assert|expect).*(?:getText|to_have_text|have\.text|text\(\))',
            r'\.should\(["\']have\.text["\'],\s*["\']([^"\']+)["\']\)',
            r'expect\(.*\)\.toHaveText\(["\']([^"\']+)["\']\)',
            r'Element Text Should Be\s+\S+\s+([^\n]+)',  # Robot Framework
        ],
        
        # Value assertions
        "value": [
            r'(?:assert|expect).*(?:getAttribute.*value|to_have_value|have\.value)',
            r'\.should\(["\']have\.value["\'],\s*["\']([^"\']+)["\']\)',
            r'expect\(.*\)\.toHaveValue\(["\']([^"\']+)["\']\)',
            r'Textfield Value Should Be\s+\S+\s+([^\n]+)',  # Robot Framework
        ],
        
        # URL assertions
        "url": [
            r'(?:assert|expect).*(?:getCurrentUrl|url|to_have_url)',
            r'\.should\(["\']include["\'],\s*["\']([^"\']+)["\']\)',
            r'expect\(page\)\.toHaveURL\(["\']([^"\']+)["\']\)',
            r'Location Should Be\s+([^\n]+)',  # Robot Framework
        ],
        
        # Title assertions
        "title": [
            r'(?:assert|expect).*(?:getTitle|title|to_have_title)',
            r'expect\(page\)\.toHaveTitle\(["\']([^"\']+)["\']\)',
            r'Title Should Be\s+([^\n]+)',  # Robot Framework
        ],
        
        # Element exists/count
        "exists": [
            r'(?:assert|expect).*(?:findElement|toExist|exist)',
            r'\.should\(["\']exist["\']\)',
            r'Page Should Contain Element\s+',  # Robot Framework
        ],
        
        # Enabled/disabled
        "enabled": [
            r'(?:assert|expect).*(?:isEnabled|to_be_enabled|be\.enabled)',
            r'\.should\(["\']be\.enabled["\']\)',
            r'Element Should Be Enabled\s+',  # Robot Framework
        ],
        
        # Contains text
        "contains": [
            r'(?:assert|expect).*(?:contains|toContain|include)',
            r'\.should\(["\']contain["\'],\s*["\']([^"\']+)["\']\)',
            r'Page Should Contain\s+([^\n]+)',  # Robot Framework
        ],
        
        # Equality
        "equals": [
            r'(?:assert|Assert)(?:Equals|Equal|That)?\s*\([^,]+,\s*["\']([^"\']+)["\']\)',
            r'assertEquals\(["\']([^"\']+)["\'],',
            r'expect\(.*\)\.toBe\(["\']([^"\']+)["\']\)',
            r'Should Be Equal\s+\S+\s+([^\n]+)',  # Robot Framework
        ],
        
        # True/False
        "true": [
            r'(?:assert|Assert)True\(',
            r'expect\(.*\)\.toBeTruthy\(\)',
        ],
        "false": [
            r'(?:assert|Assert)False\(',
            r'expect\(.*\)\.toBeFalsy\(\)',
        ],
    }
    
    def __init__(self):
        self.conversion_stats = {
            "total_methods": 0,
            "successful_conversions": 0,
            "partial_conversions": 0,
            "failed_conversions": 0,
            "actions_converted": 0,
            "selectors_converted": 0,
            "assertions_converted": 0,
        }
    
    def convert_test_method(
        self,
        test_method: Dict[str, Any],
        framework_type: str,
        language: str,
        repository_url: str = "",
        branch: str = ""
    ) -> AlchemyTestCase:
        """
        Convert a single test method to an executable Builder test case.
        
        Args:
            test_method: Parsed test method from Framework Analyzer
            framework_type: Source framework (selenium-java, cypress, etc.)
            language: Programming language
            repository_url: Source repository URL
            branch: Source branch
            
        Returns:
            AlchemyTestCase ready for execution in Builder
        """
        self.conversion_stats["total_methods"] += 1
        
        # Extract basic info
        method_name = test_method.get("name", "")
        class_name = test_method.get("class_name", "")
        file_path = test_method.get("file_path", "")
        
        # Convert method name to human-readable title
        title = self._method_name_to_title(method_name)
        
        # Extract and convert steps
        steps = self._convert_steps(
            test_method.get("steps", []),
            framework_type,
            language
        )
        
        # Extract and convert assertions
        assertion_steps = self._convert_assertions(
            test_method.get("assertions", []),
            framework_type
        )
        
        # Merge steps and assertions in order
        all_steps = steps + assertion_steps
        
        # Determine priority from annotations/tags
        priority = self._determine_priority(test_method)
        
        # Extract tags
        tags = self._extract_tags(test_method)
        
        # Generate description
        description = self._generate_description(test_method, title)
        
        # Create the test case
        test_case = AlchemyTestCase(
            name=title,
            description=description,
            priority=priority,
            tags=tags,
            steps=all_steps,
            original_method_name=method_name,
            original_class_name=class_name,
            original_file_path=file_path,
            framework=framework_type,
            language=language,
            source_repository=repository_url,
            source_branch=branch
        )
        
        # Update stats
        if all_steps:
            self.conversion_stats["successful_conversions"] += 1
        else:
            self.conversion_stats["partial_conversions"] += 1
        
        return test_case
    
    def _convert_steps(
        self,
        steps: List[Dict],
        framework_type: str,
        language: str
    ) -> List[AlchemyTestStep]:
        """Convert steps from source framework to Playwright-compatible steps."""
        converted_steps = []
        
        for step in steps:
            action = step.get("action", "").lower()
            target = step.get("target", "")
            value = step.get("value", "")
            original_code = step.get("original_code", "")
            description = step.get("description", "")
            
            # Convert selector to Playwright format
            playwright_selector = self._convert_selector(
                target, framework_type, language
            )
            
            # Map action to Builder action type
            builder_action = self._map_action(action, original_code)
            
            # Generate human-readable description if not present
            if not description:
                description = self._generate_step_description(
                    builder_action, playwright_selector, value
                )
            
            converted_step = AlchemyTestStep(
                action=builder_action,
                selector=playwright_selector,
                value=value,
                description=description,
                original_code=original_code,
                locator_type=self._detect_locator_type(playwright_selector)
            )
            
            converted_steps.append(converted_step)
            self.conversion_stats["actions_converted"] += 1
        
        return converted_steps
    
    def _convert_selector(
        self,
        selector: str,
        framework_type: str,
        language: str
    ) -> str:
        """
        Convert any selector format to Playwright Python format.
        
        This is CRITICAL for test execution!
        """
        if not selector:
            return ""
        
        self.conversion_stats["selectors_converted"] += 1
        
        # Already in Playwright Python format
        if selector.startswith("get_by_") or selector.startswith("locator("):
            return selector
        
        # Convert Playwright TypeScript to Python
        if "getBy" in selector:
            return self._convert_playwright_ts_to_python(selector)
        
        # Convert based on framework
        if "selenium" in framework_type.lower():
            return self._convert_selenium_selector(selector, language)
        elif "cypress" in framework_type.lower():
            return self._convert_cypress_selector(selector)
        elif "robot" in framework_type.lower():
            return self._convert_robot_selector(selector)
        
        # Default: assume CSS selector
        if selector.startswith("#") or selector.startswith(".") or selector.startswith("["):
            return f'locator("{selector}")'
        
        # If it looks like a simple ID
        if re.match(r'^[a-zA-Z][a-zA-Z0-9_-]*$', selector):
            return f'locator("#{selector}")'
        
        return f'locator("{selector}")'
    
    def _convert_selenium_selector(self, selector: str, language: str) -> str:
        """Convert Selenium selector to Playwright."""
        # Try each pattern
        for pattern, converter in self.SELENIUM_TO_PLAYWRIGHT.items():
            match = re.search(pattern, selector)
            if match:
                return converter(match)
        
        # Handle Java PageFactory @FindBy
        findby_match = re.search(r'@FindBy\((\w+)\s*=\s*["\']([^"\']+)["\']\)', selector)
        if findby_match:
            locator_type = findby_match.group(1).lower()
            value = findby_match.group(2)
            
            if locator_type == "id":
                return f'locator("#{value}")'
            elif locator_type == "name":
                return f'locator("[name=\\"{value}\\"]")'
            elif locator_type == "classname":
                return f'locator(".{value}")'
            elif locator_type == "css":
                return f'locator("{value}")'
            elif locator_type == "xpath":
                return f'locator("xpath={value}")'
        
        # Default fallback
        return f'locator("{selector}")'
    
    def _convert_cypress_selector(self, selector: str) -> str:
        """Convert Cypress selector to Playwright format."""
        if not selector:
            return ""
        
        # If it's already a simple CSS selector (not a cy.xxx call), just wrap it
        if not selector.startswith("cy.") and not selector.startswith("text="):
            # Check for data-testid pattern
            testid_match = re.search(r'\[data-testid=["\']?([^"\'\]]+)["\']?\]', selector)
            if testid_match:
                return f'get_by_test_id("{testid_match.group(1)}")'
            return f'locator("{selector}")'
        
        # Handle text=xxx pattern (from our extraction)
        if selector.startswith("text="):
            text = selector[5:]
            return f'get_by_text("{text}")'
        
        # Extract selector from cy.get('...')
        cy_match = re.search(r"cy\.get\(['\"]([^'\"]+)['\"]\)", selector)
        if cy_match:
            inner = cy_match.group(1)
            # Check for data-testid
            testid_match = re.search(r'\[data-testid=["\']?([^"\'\]]+)["\']?\]', inner)
            if testid_match:
                return f'get_by_test_id("{testid_match.group(1)}")'
            return f'locator("{inner}")'
        
        # Handle cy.contains
        contains_match = re.search(r"cy\.contains\(['\"]([^'\"]+)['\"]\)", selector)
        if contains_match:
            return f'get_by_text("{contains_match.group(1)}")'
        
        # Default: return as locator
        return f'locator("{selector}")'
    
    def _convert_robot_selector(self, selector: str) -> str:
        """Convert Robot Framework selector to Playwright."""
        # Robot Framework uses various prefixes
        if selector.startswith("id:") or selector.startswith("id="):
            return f'locator("#{selector[3:]}")'
        elif selector.startswith("name:") or selector.startswith("name="):
            return f'locator("[name=\\"{selector[5:]}\\"]")'
        elif selector.startswith("class:"):
            return f'locator(".{selector[6:]}")'
        elif selector.startswith("css:") or selector.startswith("css="):
            return f'locator("{selector[4:]}")'
        elif selector.startswith("xpath:") or selector.startswith("xpath="):
            return f'locator("xpath={selector[6:]}")'
        elif selector.startswith("link:"):
            return f'get_by_role("link", name="{selector[5:]}")'
        elif selector.startswith("//"):
            return f'locator("xpath={selector}")'
        
        return f'locator("{selector}")'
    
    def _convert_playwright_ts_to_python(self, selector: str) -> str:
        """Convert Playwright TypeScript to Python."""
        conversions = [
            (r'getByRole\(["\'](\w+)["\'](?:,\s*\{\s*name:\s*["\']([^"\']+)["\']\s*\})?\)', 
             lambda m: f'get_by_role("{m.group(1)}", name="{m.group(2)}")' if m.group(2) else f'get_by_role("{m.group(1)}")'),
            (r'getByText\(["\']([^"\']+)["\']\)', lambda m: f'get_by_text("{m.group(1)}")'),
            (r'getByLabel\(["\']([^"\']+)["\']\)', lambda m: f'get_by_label("{m.group(1)}")'),
            (r'getByPlaceholder\(["\']([^"\']+)["\']\)', lambda m: f'get_by_placeholder("{m.group(1)}")'),
            (r'getByTestId\(["\']([^"\']+)["\']\)', lambda m: f'get_by_test_id("{m.group(1)}")'),
            (r'getByTitle\(["\']([^"\']+)["\']\)', lambda m: f'get_by_title("{m.group(1)}")'),
            (r'getByAltText\(["\']([^"\']+)["\']\)', lambda m: f'get_by_alt_text("{m.group(1)}")'),
        ]
        
        result = selector
        for pattern, converter in conversions:
            result = re.sub(pattern, converter, result)
        
        return result.replace("page.", "")
    
    def _convert_assertions(
        self,
        assertions: List[Dict],
        framework_type: str
    ) -> List[AlchemyTestStep]:
        """Convert assertions to executable assertion steps."""
        assertion_steps = []
        
        for assertion in assertions:
            assertion_type = assertion.get("assertion_type", "")
            expected_value = assertion.get("expected_value", "")
            actual_expression = assertion.get("actual_expression", "")
            original_code = assertion.get("original_code", "")
            
            # Detect assertion type from code if not provided
            if not assertion_type:
                assertion_type = self._detect_assertion_type(original_code)
            
            # Extract selector from assertion if present
            selector = self._extract_selector_from_assertion(actual_expression, original_code)
            
            # Generate description
            description = self._generate_assertion_description(
                assertion_type, selector, expected_value
            )
            
            step = AlchemyTestStep(
                action="assert",
                selector=selector,
                value="",
                description=description,
                original_code=original_code,
                assert_type=assertion_type,
                expected_value=expected_value
            )
            
            assertion_steps.append(step)
            self.conversion_stats["assertions_converted"] += 1
        
        return assertion_steps
    
    def _detect_assertion_type(self, code: str) -> str:
        """Detect assertion type from code."""
        code_lower = code.lower()
        
        for assert_type, patterns in self.ASSERTION_PATTERNS.items():
            for pattern in patterns:
                if re.search(pattern, code, re.IGNORECASE):
                    return assert_type
        
        return "custom"
    
    def _extract_selector_from_assertion(self, expression: str, code: str) -> str:
        """Extract and convert selector from assertion expression."""
        # Look for common patterns
        patterns = [
            r'findElement\(([^)]+)\)',
            r'locator\(["\']([^"\']+)["\']\)',
            r'get_by_\w+\([^)]+\)',
            r'cy\.get\(["\']([^"\']+)["\']\)',
            r'page\.locator\(["\']([^"\']+)["\']\)',
        ]
        
        for pattern in patterns:
            match = re.search(pattern, code)
            if match:
                selector = match.group(1) if match.lastindex else match.group(0)
                return self._convert_selector(selector, "unknown", "unknown")
        
        return expression
    
    def _map_action(self, action: str, original_code: str = "") -> str:
        """Map source action to Builder action type."""
        action_lower = action.lower()
        
        # Direct mappings
        direct_map = {
            "navigate": "navigate",
            "goto": "navigate",
            "get": "navigate",
            "visit": "navigate",
            "open": "navigate",
            "click": "click",
            "submit": "click",
            "doubleclick": "click",
            "dblclick": "click",
            "type": "fill",
            "fill": "fill",
            "sendkeys": "fill",
            "input": "fill",
            "clear": "clear",
            "select": "select",
            "selectbyvisibletext": "select",
            "selectbyvalue": "select",
            "hover": "hover",
            "moveto": "hover",
            "wait": "wait",
            "pause": "wait",
            "sleep": "wait",
            "press": "press",
            "keypress": "press",
            "scroll": "scroll",
            "scrollto": "scroll",
            "scrollintoview": "scroll",
            "upload": "upload",
            "attachfile": "upload",
            "setinputfiles": "upload",
            "assert": "assert",
            "verify": "assert",
            "expect": "assert",
            "should": "assert",
        }
        
        if action_lower in direct_map:
            return direct_map[action_lower]
        
        # Try to detect from original code
        if original_code:
            code_lower = original_code.lower()
            for builder_action, patterns in self.ACTION_PATTERNS.items():
                for pattern in patterns:
                    if re.search(pattern, original_code, re.IGNORECASE):
                        return builder_action
        
        # Default to custom action
        return action_lower if action_lower else "custom"
    
    def _detect_locator_type(self, selector: str) -> str:
        """Detect the type of locator."""
        if selector.startswith("get_by_role"):
            return "role"
        elif selector.startswith("get_by_text"):
            return "text"
        elif selector.startswith("get_by_label"):
            return "label"
        elif selector.startswith("get_by_placeholder"):
            return "placeholder"
        elif selector.startswith("get_by_test_id"):
            return "testid"
        elif "xpath=" in selector:
            return "xpath"
        elif selector.startswith("locator") and "#" in selector:
            return "id"
        elif selector.startswith("locator") and "." in selector:
            return "class"
        elif selector.startswith("locator") and "[name=" in selector:
            return "name"
        else:
            return "css"
    
    def _method_name_to_title(self, method_name: str) -> str:
        """Convert method name to human-readable title."""
        # Remove common prefixes
        name = method_name
        prefixes = ["test_", "test", "verify_", "verify", "check_", "check", "should_", "should"]
        for prefix in prefixes:
            if name.lower().startswith(prefix):
                name = name[len(prefix):]
                break
        
        # Convert camelCase to Title Case
        result = []
        for i, char in enumerate(name):
            if char.isupper() and i > 0:
                result.append(' ')
            result.append(char)
        
        title = ''.join(result).replace('_', ' ').strip()
        return title.title() if title else method_name
    
    def _determine_priority(self, test_method: Dict) -> str:
        """Determine test priority from annotations and tags."""
        annotations = test_method.get("annotations", [])
        tags = test_method.get("tags", [])
        name = test_method.get("name", "").lower()
        
        # Check annotations for priority
        for annotation in annotations:
            ann_lower = annotation.lower()
            if "critical" in ann_lower or "p0" in ann_lower or "priority=0" in ann_lower:
                return "critical"
            elif "high" in ann_lower or "p1" in ann_lower or "priority=1" in ann_lower:
                return "high"
            elif "low" in ann_lower or "p3" in ann_lower or "priority=3" in ann_lower:
                return "low"
        
        # Check tags
        for tag in tags:
            tag_lower = tag.lower()
            if tag_lower in ["critical", "smoke", "sanity"]:
                return "critical"
            elif tag_lower in ["high", "regression"]:
                return "high"
            elif tag_lower in ["low", "exploratory"]:
                return "low"
        
        # Infer from test name
        if any(word in name for word in ["login", "auth", "payment", "checkout", "critical"]):
            return "high"
        
        return "medium"
    
    def _extract_tags(self, test_method: Dict) -> List[str]:
        """Extract tags from test method."""
        tags = list(test_method.get("tags", []))
        annotations = test_method.get("annotations", [])
        
        # Extract tags from annotations
        for annotation in annotations:
            # @Tag("smoke")
            tag_match = re.search(r'@Tag\(["\']([^"\']+)["\']\)', annotation)
            if tag_match:
                tags.append(tag_match.group(1))
            
            # @pytest.mark.smoke
            pytest_match = re.search(r'@pytest\.mark\.(\w+)', annotation)
            if pytest_match:
                tags.append(pytest_match.group(1))
            
            # @smoke, @regression
            simple_tag = re.search(r'@(\w+)$', annotation)
            if simple_tag and simple_tag.group(1).lower() not in ["test", "before", "after"]:
                tags.append(simple_tag.group(1))
        
        return list(set(tags))
    
    def _generate_description(self, test_method: Dict, title: str) -> str:
        """Generate a human-readable description."""
        existing_desc = test_method.get("description", "")
        if existing_desc:
            return existing_desc
        
        # Generate from title
        return f"Verify that {title.lower()}"
    
    def _generate_step_description(
        self,
        action: str,
        selector: str,
        value: str
    ) -> str:
        """Generate human-readable step description."""
        # Extract meaningful name from selector
        element_name = self._extract_element_name(selector)
        
        descriptions = {
            "navigate": f"Navigate to {value}" if value else "Navigate to page",
            "click": f"Click on {element_name}",
            "fill": f"Enter '{value}' in {element_name}" if value else f"Enter text in {element_name}",
            "clear": f"Clear {element_name}",
            "select": f"Select '{value}' from {element_name}" if value else f"Select option from {element_name}",
            "hover": f"Hover over {element_name}",
            "wait": f"Wait for {element_name} to be visible",
            "press": f"Press {value} key" if value else "Press key",
            "scroll": f"Scroll to {element_name}",
            "upload": f"Upload file to {element_name}",
        }
        
        return descriptions.get(action, f"Perform {action} on {element_name}")
    
    def _generate_assertion_description(
        self,
        assert_type: str,
        selector: str,
        expected_value: str
    ) -> str:
        """Generate human-readable assertion description."""
        element_name = self._extract_element_name(selector)
        
        descriptions = {
            "visible": f"Verify {element_name} is visible",
            "text": f"Verify {element_name} has text '{expected_value}'" if expected_value else f"Verify {element_name} text",
            "value": f"Verify {element_name} has value '{expected_value}'" if expected_value else f"Verify {element_name} value",
            "url": f"Verify URL contains '{expected_value}'" if expected_value else "Verify page URL",
            "title": f"Verify page title is '{expected_value}'" if expected_value else "Verify page title",
            "exists": f"Verify {element_name} exists",
            "enabled": f"Verify {element_name} is enabled",
            "contains": f"Verify page contains '{expected_value}'" if expected_value else "Verify page content",
            "equals": f"Verify value equals '{expected_value}'" if expected_value else "Verify value",
        }
        
        return descriptions.get(assert_type, f"Verify {assert_type}")
    
    def _extract_element_name(self, selector: str) -> str:
        """Extract a human-readable element name from selector."""
        if not selector:
            return "element"
        
        # From role selectors
        role_match = re.search(r'get_by_role\(["\'](\w+)["\'](?:,\s*name=["\']([^"\']+)["\']\))?', selector)
        if role_match:
            role = role_match.group(1)
            name = role_match.group(2) if role_match.lastindex >= 2 else None
            return f"'{name}' {role}" if name else role
        
        # From text selectors
        text_match = re.search(r'get_by_text\(["\']([^"\']+)["\']\)', selector)
        if text_match:
            return f"'{text_match.group(1)}' text"
        
        # From label selectors
        label_match = re.search(r'get_by_label\(["\']([^"\']+)["\']\)', selector)
        if label_match:
            return f"'{label_match.group(1)}' field"
        
        # From placeholder selectors
        placeholder_match = re.search(r'get_by_placeholder\(["\']([^"\']+)["\']\)', selector)
        if placeholder_match:
            return f"'{placeholder_match.group(1)}' input"
        
        # From test ID
        testid_match = re.search(r'get_by_test_id\(["\']([^"\']+)["\']\)', selector)
        if testid_match:
            return testid_match.group(1).replace("-", " ").replace("_", " ")
        
        # From CSS locator
        css_match = re.search(r'locator\(["\']([^"\']+)["\']\)', selector)
        if css_match:
            css = css_match.group(1)
            
            # ID selector
            if css.startswith("#"):
                return css[1:].replace("-", " ").replace("_", " ")
            
            # Class selector
            if css.startswith("."):
                return css[1:].replace("-", " ").replace("_", " ")
            
            # Name attribute
            name_match = re.search(r'\[name=["\']?([^"\']+)["\']?\]', css)
            if name_match:
                return name_match.group(1).replace("-", " ").replace("_", " ") + " field"
            
            # Data-testid
            testid_match = re.search(r'\[data-testid=["\']?([^"\']+)["\']?\]', css)
            if testid_match:
                return testid_match.group(1).replace("-", " ").replace("_", " ")
        
        return "element"
    
    def get_conversion_stats(self) -> Dict:
        """Get conversion statistics."""
        return self.conversion_stats.copy()
    
    def reset_stats(self):
        """Reset conversion statistics."""
        self.conversion_stats = {
            "total_methods": 0,
            "successful_conversions": 0,
            "partial_conversions": 0,
            "failed_conversions": 0,
            "actions_converted": 0,
            "selectors_converted": 0,
            "assertions_converted": 0,
        }

