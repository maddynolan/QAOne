"""
Code Parser for Framework Analyzer

Parses automation code from different languages:
- Java (Selenium, TestNG, JUnit)
- Python (Selenium, Playwright, PyTest)
- JavaScript/TypeScript (Cypress, Playwright)
- Robot Framework
- Gherkin/Cucumber
"""

import re
import logging
from typing import List, Dict, Any, Optional, Tuple
from pathlib import Path
from dataclasses import dataclass

from .models import (
    Locator, LocatorType, Assertion, AssertionType,
    TestStep, TestMethod, PageObject, FrameworkType
)

logger = logging.getLogger(__name__)


@dataclass
class ParsedFile:
    """Result of parsing a single file"""
    file_path: str
    language: str
    page_objects: List[PageObject]
    test_methods: List[TestMethod]
    locators: List[Locator]
    imports: List[str]
    classes: List[str]
    errors: List[str]


class CodeParser:
    """
    Multi-language code parser for automation frameworks.
    Uses regex-based parsing with language-specific patterns.
    """
    
    # ==================== JAVA PATTERNS ====================
    JAVA_PATTERNS = {
        # Class detection
        "class": r"(?:public\s+)?class\s+(\w+)(?:\s+extends\s+(\w+))?(?:\s+implements\s+[\w,\s]+)?\s*\{",
        
        # Page Object patterns
        "page_object_class": r"class\s+(\w+(?:Page|Screen|View|Component))\s*(?:extends\s+\w+)?\s*\{",
        
        # Locator patterns
        "by_id": r'By\.id\s*\(\s*"([^"]+)"\s*\)',
        "by_name": r'By\.name\s*\(\s*"([^"]+)"\s*\)',
        "by_xpath": r'By\.xpath\s*\(\s*"([^"]+)"\s*\)',
        "by_css": r'By\.cssSelector\s*\(\s*"([^"]+)"\s*\)',
        "by_class": r'By\.className\s*\(\s*"([^"]+)"\s*\)',
        "by_link": r'By\.linkText\s*\(\s*"([^"]+)"\s*\)',
        "by_partial_link": r'By\.partialLinkText\s*\(\s*"([^"]+)"\s*\)',
        "by_tag": r'By\.tagName\s*\(\s*"([^"]+)"\s*\)',
        
        # WebElement declarations
        "webelement_field": r'(?:@FindBy\s*\([^)]+\)\s*)?(?:private|public|protected)?\s*WebElement\s+(\w+)',
        "findby_annotation": r'@FindBy\s*\(\s*(\w+)\s*=\s*"([^"]+)"\s*\)',
        
        # Test patterns
        "test_method": r'@Test(?:\s*\([^)]*\))?\s*(?:public\s+)?void\s+(\w+)\s*\(\s*\)',
        "test_annotation": r'@Test\s*(?:\(([^)]*)\))?',
        
        # Assertion patterns
        "assert_equals": r'(?:Assert\.)?assertEquals\s*\(\s*([^,]+)\s*,\s*([^)]+)\s*\)',
        "assert_true": r'(?:Assert\.)?assertTrue\s*\(\s*([^)]+)\s*\)',
        "assert_false": r'(?:Assert\.)?assertFalse\s*\(\s*([^)]+)\s*\)',
        "assert_null": r'(?:Assert\.)?assertNull\s*\(\s*([^)]+)\s*\)',
        "assert_not_null": r'(?:Assert\.)?assertNotNull\s*\(\s*([^)]+)\s*\)',
        
        # Action patterns
        "click": r'\.click\s*\(\s*\)',
        "send_keys": r'\.sendKeys\s*\(\s*([^)]+)\s*\)',
        "clear": r'\.clear\s*\(\s*\)',
        "submit": r'\.submit\s*\(\s*\)',
        "get_text": r'\.getText\s*\(\s*\)',
        "get_attribute": r'\.getAttribute\s*\(\s*"([^"]+)"\s*\)',
        "navigate": r'driver\.get\s*\(\s*"?([^")]+)"?\s*\)',
        
        # Wait patterns
        "explicit_wait": r'WebDriverWait\s*\([^)]+\)\.until\s*\([^)]+\)',
        "implicit_wait": r'driver\.manage\s*\(\s*\)\.timeouts\s*\(\s*\)\.implicitlyWait',
        
        # Page Factory
        "page_factory_init": r'PageFactory\.initElements\s*\([^)]+\)',
    }
    
    # ==================== PYTHON PATTERNS ====================
    PYTHON_PATTERNS = {
        # Class detection
        "class": r"class\s+(\w+)(?:\s*\([^)]*\))?\s*:",
        
        # Page Object patterns
        "page_object_class": r"class\s+(\w+(?:Page|Screen|View|Component))(?:\s*\([^)]*\))?\s*:",
        
        # Selenium locator patterns
        "by_id": r'By\.ID\s*,\s*["\']([^"\']+)["\']',
        "by_name": r'By\.NAME\s*,\s*["\']([^"\']+)["\']',
        "by_xpath": r'By\.XPATH\s*,\s*["\']([^"\']+)["\']',
        "by_css": r'By\.CSS_SELECTOR\s*,\s*["\']([^"\']+)["\']',
        "by_class": r'By\.CLASS_NAME\s*,\s*["\']([^"\']+)["\']',
        "by_link": r'By\.LINK_TEXT\s*,\s*["\']([^"\']+)["\']',
        
        # Playwright locator patterns
        "playwright_locator": r'(?:page|self\.page)\.locator\s*\(\s*["\']([^"\']+)["\']',
        "playwright_get_by_role": r'(?:page|self\.page)\.get_by_role\s*\(\s*["\'](\w+)["\']',
        "playwright_get_by_text": r'(?:page|self\.page)\.get_by_text\s*\(\s*["\']([^"\']+)["\']',
        "playwright_get_by_label": r'(?:page|self\.page)\.get_by_label\s*\(\s*["\']([^"\']+)["\']',
        "playwright_get_by_testid": r'(?:page|self\.page)\.get_by_test_id\s*\(\s*["\']([^"\']+)["\']',
        
        # Test patterns
        "pytest_test": r"def\s+(test_\w+)\s*\(",
        "pytest_fixture": r"@pytest\.fixture",
        "pytest_mark": r"@pytest\.mark\.(\w+)",
        
        # Assertion patterns
        "assert_equal": r"assert\s+([^=]+)\s*==\s*([^\n#]+)",
        "assert_in": r"assert\s+([^\s]+)\s+in\s+([^\n#]+)",
        "assert_true": r"assert\s+([^\n#]+)",
        
        # Action patterns
        "click": r"\.click\s*\(\s*\)",
        "fill": r"\.fill\s*\(\s*[\"']([^\"']+)[\"']\s*\)",
        "type": r"\.type\s*\(\s*[\"']([^\"']+)[\"']\s*\)",
        "goto": r"(?:page|self\.page)\.goto\s*\(\s*[\"']([^\"']+)[\"']\s*\)",
        
        # Wait patterns
        "wait_for_selector": r"\.wait_for_selector\s*\(",
        "wait_for_load": r"\.wait_for_load_state\s*\(",
    }
    
    # ==================== JAVASCRIPT/TYPESCRIPT PATTERNS ====================
    JS_PATTERNS = {
        # Class/function detection
        "class": r"class\s+(\w+)(?:\s+extends\s+\w+)?\s*\{",
        "function": r"(?:async\s+)?function\s+(\w+)\s*\(",
        "arrow_function": r"(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?\([^)]*\)\s*=>",
        
        # Cypress patterns
        "cy_visit": r"cy\.visit\s*\(\s*['\"]([^'\"]+)['\"]",
        "cy_get": r"cy\.get\s*\(\s*['\"]([^'\"]+)['\"]",
        "cy_find": r"\.find\s*\(\s*['\"]([^'\"]+)['\"]",
        "cy_contains": r"cy\.contains\s*\(\s*['\"]([^'\"]+)['\"]",
        "cy_click": r"\.click\s*\(\s*\)",
        "cy_type": r"\.type\s*\(\s*['\"]([^'\"]+)['\"]",
        "cy_should": r"\.should\s*\(\s*['\"]([^'\"]+)['\"]",
        
        # Test patterns
        "describe": r"describe\s*\(\s*['\"]([^'\"]+)['\"]",
        "it": r"it\s*\(\s*['\"]([^'\"]+)['\"]",
        "test": r"test\s*\(\s*['\"]([^'\"]+)['\"]",
        
        # Playwright JS patterns
        "pw_locator": r"page\.locator\s*\(\s*['\"]([^'\"]+)['\"]",
        "pw_get_by_role": r"page\.getByRole\s*\(\s*['\"](\w+)['\"]",
        "pw_get_by_text": r"page\.getByText\s*\(\s*['\"]([^'\"]+)['\"]",
        
        # Assertion patterns (Jest/Chai)
        "expect_to_be": r"expect\s*\([^)]+\)\.toBe\s*\(\s*([^)]+)\s*\)",
        "expect_to_equal": r"expect\s*\([^)]+\)\.toEqual\s*\(\s*([^)]+)\s*\)",
        "expect_to_contain": r"expect\s*\([^)]+\)\.toContain\s*\(\s*([^)]+)\s*\)",
    }
    
    # ==================== ROBOT FRAMEWORK PATTERNS ====================
    ROBOT_PATTERNS = {
        "test_case": r"\*\*\*\s*Test Cases\s*\*\*\*",
        "keyword": r"\*\*\*\s*Keywords\s*\*\*\*",
        "variable": r"\$\{(\w+)\}",
        "test_name": r"^([A-Z][^\n]+)$",
        "keyword_call": r"^\s{4}(\w[^\n]+)$",
    }
    
    # ==================== GHERKIN PATTERNS ====================
    GHERKIN_PATTERNS = {
        "feature": r"Feature:\s*(.+)",
        "scenario": r"Scenario:\s*(.+)",
        "scenario_outline": r"Scenario Outline:\s*(.+)",
        "given": r"Given\s+(.+)",
        "when": r"When\s+(.+)",
        "then": r"Then\s+(.+)",
        "and": r"And\s+(.+)",
        "examples": r"Examples:",
    }
    
    def __init__(self):
        self.parsed_files: List[ParsedFile] = []
        
    def detect_language(self, file_path: str) -> str:
        """Detect programming language from file extension"""
        ext = Path(file_path).suffix.lower()
        language_map = {
            ".java": "java",
            ".py": "python",
            ".js": "javascript",
            ".ts": "typescript",
            ".robot": "robot",
            ".feature": "gherkin",
            ".cs": "csharp",
        }
        return language_map.get(ext, "unknown")
    
    def parse_file(self, file_path: str, content: str = None) -> ParsedFile:
        """Parse a single file and extract automation elements"""
        language = self.detect_language(file_path)
        
        if content is None:
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    content = f.read()
            except Exception as e:
                logger.error(f"Failed to read file {file_path}: {e}")
                return ParsedFile(
                    file_path=file_path,
                    language=language,
                    page_objects=[],
                    test_methods=[],
                    locators=[],
                    imports=[],
                    classes=[],
                    errors=[str(e)]
                )
        
        # Parse based on language
        if language == "java":
            return self._parse_java(file_path, content)
        elif language == "python":
            return self._parse_python(file_path, content)
        elif language in ["javascript", "typescript"]:
            return self._parse_javascript(file_path, content)
        elif language == "robot":
            return self._parse_robot(file_path, content)
        elif language == "gherkin":
            return self._parse_gherkin(file_path, content)
        else:
            return ParsedFile(
                file_path=file_path,
                language=language,
                page_objects=[],
                test_methods=[],
                locators=[],
                imports=[],
                classes=[],
                errors=[f"Unsupported language: {language}"]
            )
    
    def _parse_java(self, file_path: str, content: str) -> ParsedFile:
        """Parse Java automation code"""
        page_objects = []
        test_methods = []
        locators = []
        imports = []
        classes = []
        errors = []
        
        lines = content.split('\n')
        
        try:
            # Extract imports
            for match in re.finditer(r'import\s+([\w.]+);', content):
                imports.append(match.group(1))
            
            # Extract class names
            for match in re.finditer(self.JAVA_PATTERNS["class"], content):
                class_name = match.group(1)
                classes.append(class_name)
                
                # Check if it's a Page Object
                if re.search(r'Page|Screen|View|Component', class_name):
                    po = self._extract_java_page_object(class_name, content, file_path)
                    if po:
                        page_objects.append(po)
            
            # Extract test methods
            for match in re.finditer(self.JAVA_PATTERNS["test_method"], content):
                method_name = match.group(1)
                test_method = self._extract_java_test_method(method_name, content, file_path)
                if test_method:
                    test_methods.append(test_method)
            
            # Extract all locators
            locators.extend(self._extract_java_locators(content, file_path))
            
        except Exception as e:
            errors.append(f"Java parsing error: {str(e)}")
            logger.error(f"Error parsing Java file {file_path}: {e}", exc_info=True)
        
        return ParsedFile(
            file_path=file_path,
            language="java",
            page_objects=page_objects,
            test_methods=test_methods,
            locators=locators,
            imports=imports,
            classes=classes,
            errors=errors
        )
    
    def _parse_python(self, file_path: str, content: str) -> ParsedFile:
        """Parse Python automation code"""
        page_objects = []
        test_methods = []
        locators = []
        imports = []
        classes = []
        errors = []
        
        try:
            # Extract imports
            for match in re.finditer(r'^(?:from\s+[\w.]+\s+)?import\s+(.+)$', content, re.MULTILINE):
                imports.append(match.group(1).strip())
            
            # Extract class names
            for match in re.finditer(self.PYTHON_PATTERNS["class"], content):
                class_name = match.group(1)
                classes.append(class_name)
                
                # Check if it's a Page Object
                if re.search(r'Page|Screen|View|Component', class_name):
                    po = self._extract_python_page_object(class_name, content, file_path)
                    if po:
                        page_objects.append(po)
            
            # Extract test methods (pytest)
            for match in re.finditer(self.PYTHON_PATTERNS["pytest_test"], content):
                method_name = match.group(1)
                test_method = self._extract_python_test_method(method_name, content, file_path)
                if test_method:
                    test_methods.append(test_method)
            
            # Extract all locators
            locators.extend(self._extract_python_locators(content, file_path))
            
        except Exception as e:
            errors.append(f"Python parsing error: {str(e)}")
            logger.error(f"Error parsing Python file {file_path}: {e}", exc_info=True)
        
        return ParsedFile(
            file_path=file_path,
            language="python",
            page_objects=page_objects,
            test_methods=test_methods,
            locators=locators,
            imports=imports,
            classes=classes,
            errors=errors
        )
    
    def _parse_javascript(self, file_path: str, content: str) -> ParsedFile:
        """Parse JavaScript/TypeScript automation code (Cypress, Playwright)"""
        page_objects = []
        test_methods = []
        locators = []
        imports = []
        classes = []
        errors = []
        
        try:
            # Extract imports
            for match in re.finditer(r"(?:import|require)\s*\(?['\"]([^'\"]+)['\"]", content):
                imports.append(match.group(1))
            
            # Extract describe blocks (test suites)
            for match in re.finditer(self.JS_PATTERNS["describe"], content):
                classes.append(match.group(1))
            
            # Better approach: Find all test definitions and extract their bodies by bracket matching
            # Pattern to find it(...) or test(...) start positions
            test_pattern = re.compile(r"(?:it|test)\s*\(\s*['\"]([^'\"]+)['\"]", re.MULTILINE)
            
            for match in test_pattern.finditer(content):
                test_name = match.group(1)
                start_pos = match.end()
                
                # Find the function body by looking for => or function, then matching braces
                remainder = content[start_pos:]
                
                # Look for arrow function or regular function
                func_match = re.search(r'(?:,\s*(?:async\s*)?\([^)]*\)\s*=>|,\s*(?:async\s*)?function\s*\([^)]*\))\s*\{', remainder)
                if func_match:
                    body_start = func_match.end() - 1  # Position of opening {
                    test_body = self._extract_function_body(remainder[body_start:])
                    
                    if test_body:
                        steps = self._extract_cypress_steps(test_body)
                        logger.debug(f"Test '{test_name}' extracted {len(steps)} steps from body length {len(test_body)}")
                        test_method = TestMethod(
                            name=test_name,
                            file_path=file_path,
                            description=test_name,
                            steps=steps,
                        )
                        test_methods.append(test_method)
                    else:
                        # Fallback: create test without steps
                        test_method = TestMethod(
                            name=test_name,
                            file_path=file_path,
                            description=test_name,
                            steps=[],
                        )
                        test_methods.append(test_method)
                else:
                    # Couldn't find function body, add test without steps
                    test_method = TestMethod(
                        name=test_name,
                        file_path=file_path,
                        description=test_name,
                        steps=[],
                    )
                    test_methods.append(test_method)
            
            # Extract Cypress locators
            locators.extend(self._extract_js_locators(content, file_path))
            
        except Exception as e:
            errors.append(f"JavaScript parsing error: {str(e)}")
            logger.error(f"Error parsing JS file {file_path}: {e}", exc_info=True)
        
        return ParsedFile(
            file_path=file_path,
            language="javascript",
            page_objects=page_objects,
            test_methods=test_methods,
            locators=locators,
            imports=imports,
            classes=classes,
            errors=errors
        )
    
    def _extract_function_body(self, content: str) -> str:
        """Extract function body by matching braces."""
        if not content or content[0] != '{':
            return ""
        
        depth = 0
        start = 0
        
        for i, char in enumerate(content):
            if char == '{':
                depth += 1
            elif char == '}':
                depth -= 1
                if depth == 0:
                    # Return body without outer braces
                    return content[1:i]
        
        return ""
    
    def _parse_robot(self, file_path: str, content: str) -> ParsedFile:
        """Parse Robot Framework files"""
        # Simplified Robot Framework parsing
        test_methods = []
        errors = []
        
        try:
            # Find test cases section
            in_test_cases = False
            current_test = None
            
            for line in content.split('\n'):
                if '*** Test Cases ***' in line:
                    in_test_cases = True
                    continue
                elif '***' in line:
                    in_test_cases = False
                    if current_test:
                        test_methods.append(current_test)
                        current_test = None
                
                if in_test_cases:
                    # New test case (starts at column 0)
                    if line and not line.startswith(' ') and not line.startswith('\t'):
                        if current_test:
                            test_methods.append(current_test)
                        current_test = TestMethod(
                            name=line.strip(),
                            file_path=file_path,
                            description=line.strip(),
                        )
            
            if current_test:
                test_methods.append(current_test)
                
        except Exception as e:
            errors.append(f"Robot Framework parsing error: {str(e)}")
        
        return ParsedFile(
            file_path=file_path,
            language="robot",
            page_objects=[],
            test_methods=test_methods,
            locators=[],
            imports=[],
            classes=[],
            errors=errors
        )
    
    def _parse_gherkin(self, file_path: str, content: str) -> ParsedFile:
        """Parse Gherkin/Cucumber feature files"""
        test_methods = []
        errors = []
        
        try:
            # Extract feature name
            feature_match = re.search(self.GHERKIN_PATTERNS["feature"], content)
            feature_name = feature_match.group(1) if feature_match else "Unknown Feature"
            
            # Extract scenarios
            for match in re.finditer(self.GHERKIN_PATTERNS["scenario"], content):
                scenario_name = match.group(1)
                test_methods.append(TestMethod(
                    name=scenario_name,
                    file_path=file_path,
                    description=f"Feature: {feature_name} - Scenario: {scenario_name}",
                    tags=["bdd", "gherkin"],
                ))
            
            # Extract scenario outlines
            for match in re.finditer(self.GHERKIN_PATTERNS["scenario_outline"], content):
                scenario_name = match.group(1)
                test_methods.append(TestMethod(
                    name=scenario_name,
                    file_path=file_path,
                    description=f"Feature: {feature_name} - Scenario Outline: {scenario_name}",
                    tags=["bdd", "gherkin", "data-driven"],
                    data_driven=True,
                ))
                
        except Exception as e:
            errors.append(f"Gherkin parsing error: {str(e)}")
        
        return ParsedFile(
            file_path=file_path,
            language="gherkin",
            page_objects=[],
            test_methods=test_methods,
            locators=[],
            imports=[],
            classes=[feature_name] if feature_match else [],
            errors=errors
        )
    
    # ==================== HELPER METHODS ====================
    
    def _extract_java_page_object(self, class_name: str, content: str, file_path: str) -> Optional[PageObject]:
        """Extract a Java Page Object class"""
        po = PageObject(
            name=class_name,
            file_path=file_path,
        )
        
        # Find methods in the class
        method_pattern = r'public\s+(?:void|String|boolean|WebElement|\w+)\s+(\w+)\s*\('
        for match in re.finditer(method_pattern, content):
            method_name = match.group(1)
            if method_name.startswith(('get', 'is', 'has', 'verify', 'check')):
                po.verification_methods.append(method_name)
            elif not method_name.startswith('__'):
                po.action_methods.append(method_name)
        
        # Infer entity
        po.entity = po.infer_entity()
        
        return po
    
    def _extract_python_page_object(self, class_name: str, content: str, file_path: str) -> Optional[PageObject]:
        """Extract a Python Page Object class"""
        po = PageObject(
            name=class_name,
            file_path=file_path,
        )
        
        # Find methods in the class
        method_pattern = r'def\s+(\w+)\s*\(self'
        for match in re.finditer(method_pattern, content):
            method_name = match.group(1)
            if method_name.startswith(('get_', 'is_', 'has_', 'verify_', 'check_')):
                po.verification_methods.append(method_name)
            elif not method_name.startswith('_'):
                po.action_methods.append(method_name)
        
        # Infer entity
        po.entity = po.infer_entity()
        
        return po
    
    def _extract_java_test_method(self, method_name: str, content: str, file_path: str) -> Optional[TestMethod]:
        """Extract a Java test method with steps"""
        # Find the method body (simplified - looks for method signature and extracts body)
        method_pattern = rf'(?:public|private|protected)?\s*void\s+{re.escape(method_name)}\s*\([^)]*\)\s*(?:throws\s+\w+(?:\s*,\s*\w+)*)?\s*\{{([^{{}}]*(?:\{{[^{{}}]*\}}[^{{}}]*)*)\}}'
        method_match = re.search(method_pattern, content, re.DOTALL)
        
        method_body = ""
        if method_match:
            method_body = method_match.group(1)
        
        # Extract steps from the method body
        steps = self._extract_selenium_java_steps(method_body)
        
        test = TestMethod(
            name=method_name,
            file_path=file_path,
            steps=steps,
        )
        
        # Find annotations
        annotations = re.findall(r'@(\w+)(?:\([^)]*\))?', content)
        test.annotations = [a for a in annotations if a in ['Test', 'BeforeMethod', 'AfterMethod', 'BeforeClass', 'AfterClass']]
        
        # Extract priority from @Test(priority=X)
        priority_match = re.search(rf'@Test\s*\([^)]*priority\s*=\s*(\d+)', content)
        if priority_match:
            priority_num = int(priority_match.group(1))
            test.priority = "critical" if priority_num <= 1 else "high" if priority_num <= 3 else "medium"
        
        return test
    
    def _extract_selenium_java_steps(self, method_body: str) -> List[TestStep]:
        """Extract Selenium Java commands as test steps"""
        steps = []
        
        if not method_body:
            return steps
        
        # driver.get("url") - navigation
        for match in re.finditer(r'driver\.get\s*\(\s*"([^"]+)"', method_body):
            steps.append(TestStep(
                action="navigate",
                target="",
                value=match.group(1),
                description=f"Navigate to {match.group(1)}",
                original_code=match.group(0),
            ))
        
        # driver.navigate().to("url") - navigation
        for match in re.finditer(r'driver\.navigate\(\)\.to\s*\(\s*"([^"]+)"', method_body):
            steps.append(TestStep(
                action="navigate",
                target="",
                value=match.group(1),
                description=f"Navigate to {match.group(1)}",
                original_code=match.group(0),
            ))
        
        # findElement(By.xxx("selector")).click() - click
        for match in re.finditer(r'findElement\s*\(\s*By\.(\w+)\s*\(\s*"([^"]+)"\s*\)\s*\)\.click\s*\(', method_body):
            locator_type, selector = match.group(1), match.group(2)
            steps.append(TestStep(
                action="click",
                target=selector,
                value="",
                description=f"Click on element ({locator_type}: {selector})",
                original_code=match.group(0),
            ))
        
        # findElement(By.xxx("selector")).sendKeys("value") - type
        for match in re.finditer(r'findElement\s*\(\s*By\.(\w+)\s*\(\s*"([^"]+)"\s*\)\s*\)\.sendKeys\s*\(\s*"([^"]+)"', method_body):
            locator_type, selector, value = match.group(1), match.group(2), match.group(3)
            steps.append(TestStep(
                action="fill",
                target=selector,
                value=value,
                description=f"Type '{value}' into element ({locator_type}: {selector})",
                original_code=match.group(0),
            ))
        
        # findElement(By.xxx("selector")).clear() - clear
        for match in re.finditer(r'findElement\s*\(\s*By\.(\w+)\s*\(\s*"([^"]+)"\s*\)\s*\)\.clear\s*\(', method_body):
            locator_type, selector = match.group(1), match.group(2)
            steps.append(TestStep(
                action="clear",
                target=selector,
                value="",
                description=f"Clear element ({locator_type}: {selector})",
                original_code=match.group(0),
            ))
        
        # Assert statements
        for match in re.finditer(r'(?:Assert|assertThat|assertEquals|assertTrue|assertFalse)\s*\.\s*(\w+)\s*\(([^;]+)\)', method_body):
            assert_method, args = match.group(1), match.group(2)
            steps.append(TestStep(
                action="assert",
                target="",
                value="",
                description=f"Assert {assert_method}: {args[:50]}",
                original_code=match.group(0),
            ))
        
        # Page object method calls
        for match in re.finditer(r'(\w+Page|\w+page)\.(\w+)\s*\(([^)]*)\)', method_body, re.IGNORECASE):
            page_obj, method, args = match.group(1), match.group(2), match.group(3)
            if method not in ['getClass', 'toString', 'equals', 'hashCode']:
                steps.append(TestStep(
                    action="custom",
                    target=f"{page_obj}.{method}",
                    value=args.strip() if args else "",
                    description=f"Call {page_obj}.{method}({args.strip()[:30] if args else ''})",
                    original_code=match.group(0),
                ))
        
        return steps
    
    def _extract_python_test_method(self, method_name: str, content: str, file_path: str) -> Optional[TestMethod]:
        """Extract a Python test method with steps"""
        # Find the method body
        method_pattern = rf'def\s+{re.escape(method_name)}\s*\([^)]*\):\s*\n((?:[ \t]+[^\n]*\n?)+)'
        method_match = re.search(method_pattern, content)
        
        method_body = ""
        if method_match:
            method_body = method_match.group(1)
        
        # Extract steps from the method body
        steps = self._extract_selenium_python_steps(method_body)
        
        test = TestMethod(
            name=method_name,
            file_path=file_path,
            steps=steps,
        )
        
        # Find pytest markers
        markers = re.findall(r'@pytest\.mark\.(\w+)', content)
        test.tags = markers
        
        if 'critical' in markers or 'smoke' in markers:
            test.priority = "critical"
        elif 'regression' in markers:
            test.priority = "high"
        
        return test
    
    def _extract_selenium_python_steps(self, method_body: str) -> List[TestStep]:
        """Extract Selenium/Playwright Python commands as test steps"""
        steps = []
        
        if not method_body:
            return steps
        
        # driver.get / page.goto - navigation
        for match in re.finditer(r'(?:driver|page|self\.driver|self\.page)\.(?:get|goto)\s*\(\s*["\']([^"\']+)["\']', method_body):
            steps.append(TestStep(
                action="navigate",
                target="",
                value=match.group(1),
                description=f"Navigate to {match.group(1)}",
                original_code=match.group(0),
            ))
        
        # find_element + click - element click
        for match in re.finditer(r'(?:driver|self\.driver)\.find_element\s*\(\s*(?:By\.)?(\w+)\s*,\s*["\']([^"\']+)["\']\s*\)\.click\s*\(', method_body):
            locator_type, selector = match.group(1), match.group(2)
            steps.append(TestStep(
                action="click",
                target=selector,
                value="",
                description=f"Click on element ({locator_type}: {selector})",
                original_code=match.group(0),
            ))
        
        # find_element + send_keys - text input
        for match in re.finditer(r'(?:driver|self\.driver)\.find_element\s*\(\s*(?:By\.)?(\w+)\s*,\s*["\']([^"\']+)["\']\s*\)\.send_keys\s*\(\s*["\']([^"\']+)["\']', method_body):
            locator_type, selector, value = match.group(1), match.group(2), match.group(3)
            steps.append(TestStep(
                action="fill",
                target=selector,
                value=value,
                description=f"Type '{value}' into element ({locator_type}: {selector})",
                original_code=match.group(0),
            ))
        
        # page.locator().click() - Playwright click
        for match in re.finditer(r'page\.locator\s*\(\s*["\']([^"\']+)["\']\s*\)\.click\s*\(', method_body):
            steps.append(TestStep(
                action="click",
                target=match.group(1),
                value="",
                description=f"Click on {match.group(1)}",
                original_code=match.group(0),
            ))
        
        # page.locator().fill() - Playwright fill
        for match in re.finditer(r'page\.locator\s*\(\s*["\']([^"\']+)["\']\s*\)\.fill\s*\(\s*["\']([^"\']+)["\']', method_body):
            steps.append(TestStep(
                action="fill",
                target=match.group(1),
                value=match.group(2),
                description=f"Type '{match.group(2)}' into {match.group(1)}",
                original_code=match.group(0),
            ))
        
        # assert / expect statements
        for match in re.finditer(r'assert\s+([^\n]+)', method_body):
            steps.append(TestStep(
                action="assert",
                target="",
                value="",
                description=f"Assert: {match.group(1)[:50]}",
                original_code=match.group(0),
            ))
        
        # Page object method calls (self.page.xxx or page_object.xxx)
        for match in re.finditer(r'(?:self\.)?(\w+_page|\w+page)\.(\w+)\s*\(([^)]*)\)', method_body, re.IGNORECASE):
            page_obj, method, args = match.group(1), match.group(2), match.group(3)
            if method not in ['__init__', 'setup', 'teardown']:
                steps.append(TestStep(
                    action="custom",
                    target=f"{page_obj}.{method}",
                    value=args.strip() if args else "",
                    description=f"Call {page_obj}.{method}({args.strip() if args else ''})",
                    original_code=match.group(0),
                ))
        
        return steps
    
    def _extract_java_locators(self, content: str, file_path: str) -> List[Locator]:
        """Extract all locators from Java code"""
        locators = []
        
        locator_patterns = [
            ("by_id", LocatorType.ID),
            ("by_name", LocatorType.NAME),
            ("by_xpath", LocatorType.XPATH),
            ("by_css", LocatorType.CSS_SELECTOR),
            ("by_class", LocatorType.CLASS_NAME),
            ("by_link", LocatorType.LINK_TEXT),
        ]
        
        for pattern_name, loc_type in locator_patterns:
            for match in re.finditer(self.JAVA_PATTERNS[pattern_name], content):
                locators.append(Locator(
                    name=f"element_{len(locators)}",
                    locator_type=loc_type,
                    value=match.group(1),
                    file_path=file_path,
                    original_code=match.group(0),
                ))
        
        # Extract @FindBy annotations
        for match in re.finditer(self.JAVA_PATTERNS["findby_annotation"], content):
            loc_type_str = match.group(1).lower()
            loc_type = LocatorType.CSS_SELECTOR
            if 'id' in loc_type_str:
                loc_type = LocatorType.ID
            elif 'xpath' in loc_type_str:
                loc_type = LocatorType.XPATH
            elif 'css' in loc_type_str:
                loc_type = LocatorType.CSS_SELECTOR
            elif 'name' in loc_type_str:
                loc_type = LocatorType.NAME
            
            locators.append(Locator(
                name=f"findby_{len(locators)}",
                locator_type=loc_type,
                value=match.group(2),
                file_path=file_path,
                original_code=match.group(0),
            ))
        
        return locators
    
    def _extract_python_locators(self, content: str, file_path: str) -> List[Locator]:
        """Extract all locators from Python code"""
        locators = []
        
        # Selenium locators
        selenium_patterns = [
            ("by_id", LocatorType.ID),
            ("by_name", LocatorType.NAME),
            ("by_xpath", LocatorType.XPATH),
            ("by_css", LocatorType.CSS_SELECTOR),
            ("by_class", LocatorType.CLASS_NAME),
        ]
        
        for pattern_name, loc_type in selenium_patterns:
            for match in re.finditer(self.PYTHON_PATTERNS[pattern_name], content):
                locators.append(Locator(
                    name=f"element_{len(locators)}",
                    locator_type=loc_type,
                    value=match.group(1),
                    file_path=file_path,
                    original_code=match.group(0),
                ))
        
        # Playwright locators
        for match in re.finditer(self.PYTHON_PATTERNS["playwright_locator"], content):
            locators.append(Locator(
                name=f"pw_locator_{len(locators)}",
                locator_type=LocatorType.CSS_SELECTOR,
                value=match.group(1),
                file_path=file_path,
                original_code=match.group(0),
            ))
        
        for match in re.finditer(self.PYTHON_PATTERNS["playwright_get_by_testid"], content):
            locators.append(Locator(
                name=f"pw_testid_{len(locators)}",
                locator_type=LocatorType.DATA_TESTID,
                value=match.group(1),
                file_path=file_path,
                original_code=match.group(0),
            ))
        
        return locators
    
    def _extract_cypress_steps(self, test_body: str) -> List[TestStep]:
        """Extract Cypress commands as test steps from test body"""
        steps = []
        
        # cy.visit - navigation
        for match in re.finditer(r"cy\.visit\s*\(\s*['\"]([^'\"]+)['\"]", test_body):
            steps.append(TestStep(
                action="navigate",
                target="",
                value=match.group(1),
                description=f"Navigate to {match.group(1)}",
                original_code=match.group(0),
            ))
        
        # cy.get(...).click() - click action
        for match in re.finditer(r"cy\.get\s*\(\s*['\"]([^'\"]+)['\"]\s*\)\.click\s*\(", test_body):
            steps.append(TestStep(
                action="click",
                target=match.group(1),
                value="",
                description=f"Click on {match.group(1)}",
                original_code=match.group(0),
            ))
        
        # cy.get(...).type('value') - type action
        for match in re.finditer(r"cy\.get\s*\(\s*['\"]([^'\"]+)['\"]\s*\)\.type\s*\(\s*['\"]([^'\"]+)['\"]", test_body):
            steps.append(TestStep(
                action="fill",
                target=match.group(1),
                value=match.group(2),
                description=f"Type '{match.group(2)}' into {match.group(1)}",
                original_code=match.group(0),
            ))
        
        # cy.contains(...).click() - click by text
        for match in re.finditer(r"cy\.contains\s*\(\s*['\"]([^'\"]+)['\"]\s*\)\.click\s*\(", test_body):
            steps.append(TestStep(
                action="click",
                target=f"text={match.group(1)}",
                value="",
                description=f"Click on text '{match.group(1)}'",
                original_code=match.group(0),
            ))
        
        # cy.get(...).should(...) - assertion
        for match in re.finditer(r"cy\.get\s*\(\s*['\"]([^'\"]+)['\"]\s*\)\.should\s*\(\s*['\"]([^'\"]+)['\"](?:\s*,\s*['\"]([^'\"]+)['\"])?\s*\)", test_body):
            selector = match.group(1)
            assertion_type = match.group(2)
            expected_value = match.group(3) or ""
            steps.append(TestStep(
                action="assert",
                target=selector,
                value=expected_value,
                description=f"Assert {selector} {assertion_type} {expected_value}".strip(),
                original_code=match.group(0),
            ))
        
        # cy.wait - wait action
        for match in re.finditer(r"cy\.wait\s*\(\s*(\d+|['\"]@[^'\"]+['\"])\s*\)", test_body):
            wait_value = match.group(1).strip("'\"")
            steps.append(TestStep(
                action="wait",
                target="",
                value=wait_value,
                description=f"Wait for {wait_value}",
                original_code=match.group(0),
            ))
        
        # cy.get(...).clear() - clear action
        for match in re.finditer(r"cy\.get\s*\(\s*['\"]([^'\"]+)['\"]\s*\)\.clear\s*\(", test_body):
            steps.append(TestStep(
                action="clear",
                target=match.group(1),
                value="",
                description=f"Clear {match.group(1)}",
                original_code=match.group(0),
            ))
        
        # cy.get(...).select('option') - select action
        for match in re.finditer(r"cy\.get\s*\(\s*['\"]([^'\"]+)['\"]\s*\)\.select\s*\(\s*['\"]([^'\"]+)['\"]", test_body):
            steps.append(TestStep(
                action="select",
                target=match.group(1),
                value=match.group(2),
                description=f"Select '{match.group(2)}' from {match.group(1)}",
                original_code=match.group(0),
            ))
        
        # cy.get(...).check() - checkbox
        for match in re.finditer(r"cy\.get\s*\(\s*['\"]([^'\"]+)['\"]\s*\)\.check\s*\(", test_body):
            steps.append(TestStep(
                action="check",
                target=match.group(1),
                value="",
                description=f"Check {match.group(1)}",
                original_code=match.group(0),
            ))
        
        return steps
    
    def _extract_js_locators(self, content: str, file_path: str) -> List[Locator]:
        """Extract all locators from JavaScript/TypeScript code"""
        locators = []
        
        # Cypress locators
        for match in re.finditer(self.JS_PATTERNS["cy_get"], content):
            locators.append(Locator(
                name=f"cy_element_{len(locators)}",
                locator_type=LocatorType.CSS_SELECTOR,
                value=match.group(1),
                file_path=file_path,
                original_code=match.group(0),
            ))
        
        # Playwright JS locators
        for match in re.finditer(self.JS_PATTERNS["pw_locator"], content):
            locators.append(Locator(
                name=f"pw_element_{len(locators)}",
                locator_type=LocatorType.CSS_SELECTOR,
                value=match.group(1),
                file_path=file_path,
                original_code=match.group(0),
            ))
        
        return locators
    
    def parse_directory(self, directory_path: str, extensions: List[str] = None) -> List[ParsedFile]:
        """Parse all automation files in a directory"""
        if extensions is None:
            extensions = ['.java', '.py', '.js', '.ts', '.robot', '.feature']
        
        parsed_files = []
        path = Path(directory_path)
        
        for ext in extensions:
            for file_path in path.rglob(f'*{ext}'):
                # Skip common non-test directories
                skip_dirs = ['node_modules', 'venv', '.git', '__pycache__', 'target', 'build']
                if any(skip_dir in str(file_path) for skip_dir in skip_dirs):
                    continue
                
                logger.info(f"Parsing file: {file_path}")
                parsed = self.parse_file(str(file_path))
                parsed_files.append(parsed)
                self.parsed_files.append(parsed)
        
        return parsed_files

