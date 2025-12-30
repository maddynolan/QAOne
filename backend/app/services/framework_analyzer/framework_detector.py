"""
Framework Detector

Analyzes code and project structure to identify:
- Automation framework type
- Programming language
- Design patterns used
- Dependencies
"""

import re
import logging
from typing import List, Dict, Any, Optional, Tuple
from pathlib import Path
from collections import Counter

from .models import FrameworkType, FrameworkInfo
from .code_parser import ParsedFile

logger = logging.getLogger(__name__)


class FrameworkDetector:
    """
    Detects automation framework type and characteristics from code.
    """
    
    # Framework indicators in imports/dependencies
    FRAMEWORK_INDICATORS = {
        FrameworkType.SELENIUM_JAVA: {
            "imports": ["org.openqa.selenium", "WebDriver", "WebElement", "By."],
            "files": ["pom.xml"],
            "patterns": ["@FindBy", "PageFactory", "WebDriverWait"],
        },
        FrameworkType.SELENIUM_PYTHON: {
            "imports": ["selenium", "webdriver", "from selenium"],
            "files": ["requirements.txt", "setup.py"],
            "patterns": ["By.ID", "By.XPATH", "WebDriverWait"],
        },
        FrameworkType.SELENIUM_CSHARP: {
            "imports": ["OpenQA.Selenium", "IWebDriver", "IWebElement"],
            "files": [".csproj", "packages.config"],
            "patterns": ["FindElement", "WebDriverWait"],
        },
        FrameworkType.CYPRESS: {
            "imports": ["cypress"],
            "files": ["cypress.json", "cypress.config.js", "cypress.config.ts"],
            "patterns": ["cy.get", "cy.visit", "cy.contains", "describe(", "it("],
        },
        FrameworkType.PLAYWRIGHT_PYTHON: {
            "imports": ["playwright", "from playwright"],
            "files": ["requirements.txt", "setup.py"],
            "patterns": ["page.goto", "page.locator", "get_by_role", "get_by_text"],
        },
        FrameworkType.PLAYWRIGHT_TYPESCRIPT: {
            "imports": ["@playwright/test", "playwright"],
            "files": ["playwright.config.ts", "playwright.config.js"],
            "patterns": ["page.goto", "page.locator", "getByRole", "getByText"],
        },
        FrameworkType.TESTNG: {
            "imports": ["org.testng", "TestNG"],
            "files": ["testng.xml"],
            "patterns": ["@Test", "@BeforeMethod", "@AfterMethod", "@DataProvider"],
        },
        FrameworkType.JUNIT: {
            "imports": ["org.junit", "junit"],
            "files": [],
            "patterns": ["@Test", "@Before", "@After", "@BeforeClass"],
        },
        FrameworkType.PYTEST: {
            "imports": ["pytest", "import pytest"],
            "files": ["pytest.ini", "conftest.py", "pyproject.toml"],
            "patterns": ["def test_", "@pytest.fixture", "@pytest.mark"],
        },
        FrameworkType.ROBOT_FRAMEWORK: {
            "imports": ["robot", "Robot Framework"],
            "files": ["robot.yaml", ".robot"],
            "patterns": ["*** Test Cases ***", "*** Keywords ***", "${", "Library"],
        },
        FrameworkType.CUCUMBER: {
            "imports": ["cucumber", "io.cucumber"],
            "files": [".feature"],
            "patterns": ["Feature:", "Scenario:", "Given", "When", "Then", "@Given", "@When", "@Then"],
        },
    }
    
    # Design pattern indicators
    PATTERN_INDICATORS = {
        "page_objects": [
            r"class\s+\w+Page",
            r"PageFactory",
            r"@FindBy",
            r"Page Object",
        ],
        "data_driven": [
            r"@DataProvider",
            r"@pytest\.mark\.parametrize",
            r"Scenario Outline",
            r"Examples:",
            r"\.csv",
            r"\.xlsx",
        ],
        "bdd": [
            r"Feature:",
            r"Scenario:",
            r"Given.*When.*Then",
            r"@Given",
            r"@When",
            r"@Then",
        ],
        "reporting": [
            r"ExtentReports",
            r"Allure",
            r"pytest-html",
            r"mochawesome",
        ],
    }
    
    def __init__(self):
        self.detected_frameworks: List[FrameworkType] = []
        self.confidence_scores: Dict[FrameworkType, float] = {}
    
    def detect_from_files(self, parsed_files: List[ParsedFile]) -> FrameworkInfo:
        """
        Detect framework type from parsed files.
        Returns the most likely framework with confidence score.
        """
        scores = Counter()
        all_imports = []
        all_patterns = []
        languages = Counter()
        
        for pf in parsed_files:
            all_imports.extend(pf.imports)
            languages[pf.language] += 1
            
            # Check for framework-specific patterns in the file content
            # (We need to re-read or store content for this)
        
        # Score each framework based on imports
        for framework, indicators in self.FRAMEWORK_INDICATORS.items():
            for imp in all_imports:
                for indicator in indicators["imports"]:
                    if indicator.lower() in imp.lower():
                        scores[framework] += 10
        
        # Determine most likely framework
        if scores:
            most_likely = scores.most_common(1)[0]
            framework_type = most_likely[0]
            confidence = min(most_likely[1] / 50.0, 1.0)  # Normalize to 0-1
        else:
            framework_type = FrameworkType.UNKNOWN
            confidence = 0.0
        
        # Determine language
        language = languages.most_common(1)[0][0] if languages else "unknown"
        
        # Detect design patterns
        uses_page_objects = any(
            any(re.search(pattern, '\n'.join(pf.imports)) for pattern in self.PATTERN_INDICATORS["page_objects"])
            for pf in parsed_files
        )
        
        uses_bdd = any(
            pf.language == "gherkin" or 
            any(re.search(pattern, '\n'.join(pf.imports)) for pattern in self.PATTERN_INDICATORS["bdd"])
            for pf in parsed_files
        )
        
        # Build framework info
        return FrameworkInfo(
            framework_type=framework_type,
            language=language,
            uses_page_objects=uses_page_objects,
            uses_bdd=uses_bdd,
            dependencies=[imp for imp in all_imports[:20]],  # Top 20 imports
        )
    
    def detect_from_directory(self, directory_path: str) -> FrameworkInfo:
        """
        Detect framework type by analyzing directory structure and files.
        """
        path = Path(directory_path)
        scores = Counter()
        config_files = []
        test_directory = ""
        page_object_directory = ""
        
        # Check for framework-specific files
        for framework, indicators in self.FRAMEWORK_INDICATORS.items():
            for file_pattern in indicators["files"]:
                matches = list(path.rglob(file_pattern))
                if matches:
                    scores[framework] += 20
                    config_files.extend([str(m) for m in matches[:5]])
        
        # Check directory structure
        common_test_dirs = ["test", "tests", "src/test", "e2e", "integration", "spec"]
        for test_dir in common_test_dirs:
            test_path = path / test_dir
            if test_path.exists():
                test_directory = str(test_path)
                break
        
        # Check for page objects directory
        common_po_dirs = ["pages", "pageobjects", "page_objects", "screens"]
        for po_dir in common_po_dirs:
            for found in path.rglob(po_dir):
                if found.is_dir():
                    page_object_directory = str(found)
                    break
        
        # Read package.json for JS projects
        package_json = path / "package.json"
        if package_json.exists():
            try:
                import json
                with open(package_json) as f:
                    pkg = json.load(f)
                    deps = pkg.get("dependencies", {})
                    dev_deps = pkg.get("devDependencies", {})
                    all_deps = {**deps, **dev_deps}
                    
                    if "cypress" in all_deps:
                        scores[FrameworkType.CYPRESS] += 30
                    if "@playwright/test" in all_deps:
                        scores[FrameworkType.PLAYWRIGHT_TYPESCRIPT] += 30
                    if "selenium-webdriver" in all_deps:
                        scores[FrameworkType.SELENIUM_JAVA] += 10  # Could be JS Selenium
            except Exception as e:
                logger.warning(f"Failed to read package.json: {e}")
        
        # Read requirements.txt for Python projects
        requirements_txt = path / "requirements.txt"
        if requirements_txt.exists():
            try:
                with open(requirements_txt) as f:
                    content = f.read().lower()
                    if "selenium" in content:
                        scores[FrameworkType.SELENIUM_PYTHON] += 30
                    if "playwright" in content:
                        scores[FrameworkType.PLAYWRIGHT_PYTHON] += 30
                    if "pytest" in content:
                        scores[FrameworkType.PYTEST] += 20
                    if "robot" in content:
                        scores[FrameworkType.ROBOT_FRAMEWORK] += 30
            except Exception as e:
                logger.warning(f"Failed to read requirements.txt: {e}")
        
        # Read pom.xml for Java projects
        pom_xml = path / "pom.xml"
        if pom_xml.exists():
            try:
                with open(pom_xml) as f:
                    content = f.read().lower()
                    if "selenium" in content:
                        scores[FrameworkType.SELENIUM_JAVA] += 30
                    if "testng" in content:
                        scores[FrameworkType.TESTNG] += 25
                    if "junit" in content:
                        scores[FrameworkType.JUNIT] += 25
                    if "cucumber" in content:
                        scores[FrameworkType.CUCUMBER] += 25
            except Exception as e:
                logger.warning(f"Failed to read pom.xml: {e}")
        
        # Determine most likely framework
        if scores:
            most_likely = scores.most_common(1)[0]
            framework_type = most_likely[0]
        else:
            framework_type = FrameworkType.UNKNOWN
        
        # Determine language from framework
        language_map = {
            FrameworkType.SELENIUM_JAVA: "java",
            FrameworkType.SELENIUM_PYTHON: "python",
            FrameworkType.SELENIUM_CSHARP: "csharp",
            FrameworkType.CYPRESS: "javascript",
            FrameworkType.PLAYWRIGHT_PYTHON: "python",
            FrameworkType.PLAYWRIGHT_TYPESCRIPT: "typescript",
            FrameworkType.TESTNG: "java",
            FrameworkType.JUNIT: "java",
            FrameworkType.PYTEST: "python",
            FrameworkType.ROBOT_FRAMEWORK: "robot",
            FrameworkType.CUCUMBER: "gherkin",
        }
        language = language_map.get(framework_type, "unknown")
        
        return FrameworkInfo(
            framework_type=framework_type,
            language=language,
            test_directory=test_directory,
            page_object_directory=page_object_directory,
            config_files=config_files,
            uses_page_objects=bool(page_object_directory),
        )
    
    def detect_from_code(self, code: str, file_extension: str = ".java") -> FrameworkInfo:
        """
        Detect framework type from a code snippet.
        """
        scores = Counter()
        
        # Determine language from file extension first
        ext_to_lang = {
            ".java": "java",
            ".py": "python",
            ".js": "javascript",
            ".ts": "typescript",
            ".cs": "csharp",
            ".robot": "robot",
            ".feature": "gherkin",
        }
        language = ext_to_lang.get(file_extension, "unknown")
        
        # Filter frameworks by language compatibility
        language_frameworks = {
            "java": [FrameworkType.SELENIUM_JAVA, FrameworkType.TESTNG, FrameworkType.JUNIT, FrameworkType.CUCUMBER],
            "python": [FrameworkType.SELENIUM_PYTHON, FrameworkType.PLAYWRIGHT_PYTHON, FrameworkType.PYTEST, FrameworkType.ROBOT_FRAMEWORK],
            "javascript": [FrameworkType.CYPRESS, FrameworkType.PLAYWRIGHT_TYPESCRIPT],
            "typescript": [FrameworkType.CYPRESS, FrameworkType.PLAYWRIGHT_TYPESCRIPT],
            "csharp": [FrameworkType.SELENIUM_CSHARP],
            "robot": [FrameworkType.ROBOT_FRAMEWORK],
            "gherkin": [FrameworkType.CUCUMBER],
        }
        
        compatible_frameworks = language_frameworks.get(language, list(self.FRAMEWORK_INDICATORS.keys()))
        
        for framework, indicators in self.FRAMEWORK_INDICATORS.items():
            # Skip frameworks not compatible with detected language
            if framework not in compatible_frameworks:
                continue
                
            # Check imports (higher weight for specific imports)
            for imp in indicators["imports"]:
                if imp.lower() in code.lower():
                    scores[framework] += 10
            
            # Check patterns with more specific matching
            for pattern in indicators["patterns"]:
                # Use word boundary matching for annotation patterns
                if pattern.startswith("@"):
                    # For annotations, match the exact annotation
                    if re.search(rf'{re.escape(pattern)}(?:\(|$|\s)', code):
                        scores[framework] += 20
                elif pattern.lower() in code.lower():
                    scores[framework] += 15
        
        # Special handling for Selenium + TestNG/JUnit combinations
        if language == "java":
            has_selenium = any(imp in code for imp in ["org.openqa.selenium", "WebDriver", "WebElement"])
            has_testng = "@Test" in code and "org.testng" in code
            has_junit = "@Test" in code and "org.junit" in code
            
            if has_selenium:
                if has_testng:
                    # Selenium + TestNG → report as Selenium Java (with TestNG runner)
                    scores[FrameworkType.SELENIUM_JAVA] += 30
                elif has_junit:
                    scores[FrameworkType.SELENIUM_JAVA] += 30
                else:
                    scores[FrameworkType.SELENIUM_JAVA] += 20
        
        if scores:
            most_likely = scores.most_common(1)[0]
            framework_type = most_likely[0]
        else:
            framework_type = FrameworkType.UNKNOWN
        
        return FrameworkInfo(
            framework_type=framework_type,
            language=language,
            uses_page_objects="Page" in code or "page" in code.lower(),
            uses_data_driven="DataProvider" in code or "parametrize" in code,
            uses_bdd="Feature:" in code or "Scenario:" in code,
        )
    
    def get_framework_summary(self, framework_info: FrameworkInfo) -> Dict[str, Any]:
        """
        Get a human-readable summary of the detected framework.
        """
        framework_names = {
            FrameworkType.SELENIUM_JAVA: "Selenium WebDriver (Java)",
            FrameworkType.SELENIUM_PYTHON: "Selenium WebDriver (Python)",
            FrameworkType.SELENIUM_CSHARP: "Selenium WebDriver (C#)",
            FrameworkType.CYPRESS: "Cypress",
            FrameworkType.PLAYWRIGHT_PYTHON: "Playwright (Python)",
            FrameworkType.PLAYWRIGHT_TYPESCRIPT: "Playwright (TypeScript)",
            FrameworkType.TESTNG: "TestNG",
            FrameworkType.JUNIT: "JUnit",
            FrameworkType.PYTEST: "PyTest",
            FrameworkType.ROBOT_FRAMEWORK: "Robot Framework",
            FrameworkType.CUCUMBER: "Cucumber/BDD",
            FrameworkType.UNKNOWN: "Unknown Framework",
        }
        
        patterns_used = []
        if framework_info.uses_page_objects:
            patterns_used.append("Page Object Model")
        if framework_info.uses_data_driven:
            patterns_used.append("Data-Driven Testing")
        if framework_info.uses_bdd:
            patterns_used.append("BDD/Gherkin")
        if framework_info.uses_reporting:
            patterns_used.append("Test Reporting")
        
        return {
            "framework_name": framework_names.get(framework_info.framework_type, "Unknown"),
            "framework_type": framework_info.framework_type.value,
            "language": framework_info.language,
            "patterns_used": patterns_used,
            "test_directory": framework_info.test_directory,
            "page_object_directory": framework_info.page_object_directory,
            "config_files": framework_info.config_files,
        }

