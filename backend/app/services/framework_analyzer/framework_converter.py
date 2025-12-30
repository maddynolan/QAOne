"""
Framework Code Converter

Converts automation code between frameworks:
- Selenium Java → Playwright Python/TypeScript
- Selenium Python → Playwright Python
- Cypress → Playwright TypeScript
- Any framework → Playwright (recommended)
"""

import re
import logging
from typing import List, Dict, Any, Optional
from datetime import datetime

from .models import (
    DomainModel, PageObject, TestMethod, Locator, LocatorType,
    FrameworkType, FrameworkInfo, TestStep
)

logger = logging.getLogger(__name__)


class FrameworkCodeConverter:
    """
    Converts automation code between different frameworks.
    Primary target is modern Playwright for robustness.
    """
    
    # Locator conversion mappings
    LOCATOR_CONVERSIONS = {
        LocatorType.ID: {
            "playwright-python": 'page.locator("#{value}")',
            "playwright-typescript": 'page.locator("#{value}")',
            "cypress": 'cy.get("#{value}")',
            "selenium-python": 'driver.find_element(By.ID, "{value}")',
        },
        LocatorType.CSS_SELECTOR: {
            "playwright-python": 'page.locator("{value}")',
            "playwright-typescript": 'page.locator("{value}")',
            "cypress": 'cy.get("{value}")',
            "selenium-python": 'driver.find_element(By.CSS_SELECTOR, "{value}")',
        },
        LocatorType.XPATH: {
            "playwright-python": 'page.locator("{value}")',
            "playwright-typescript": 'page.locator("{value}")',
            "cypress": 'cy.xpath("{value}")',
            "selenium-python": 'driver.find_element(By.XPATH, "{value}")',
        },
        LocatorType.DATA_TESTID: {
            "playwright-python": 'page.get_by_test_id("{value}")',
            "playwright-typescript": 'page.getByTestId("{value}")',
            "cypress": 'cy.get("[data-testid=\'{value}\']")',
            "selenium-python": 'driver.find_element(By.CSS_SELECTOR, "[data-testid=\'{value}\']")',
        },
        LocatorType.TEXT: {
            "playwright-python": 'page.get_by_text("{value}")',
            "playwright-typescript": 'page.getByText("{value}")',
            "cypress": 'cy.contains("{value}")',
            "selenium-python": 'driver.find_element(By.XPATH, "//*[contains(text(), \'{value}\')]")',
        },
        LocatorType.ROLE: {
            "playwright-python": 'page.get_by_role("{value}")',
            "playwright-typescript": 'page.getByRole("{value}")',
            "cypress": 'cy.get("[role=\'{value}\']")',
            "selenium-python": 'driver.find_element(By.CSS_SELECTOR, "[role=\'{value}\']")',
        },
    }
    
    # Action conversion mappings
    ACTION_CONVERSIONS = {
        "click": {
            "playwright-python": ".click()",
            "playwright-typescript": ".click()",
            "cypress": ".click()",
            "selenium-python": ".click()",
        },
        "fill": {
            "playwright-python": '.fill("{value}")',
            "playwright-typescript": '.fill("{value}")',
            "cypress": '.type("{value}")',
            "selenium-python": '.send_keys("{value}")',
        },
        "type": {
            "playwright-python": '.type("{value}")',
            "playwright-typescript": '.type("{value}")',
            "cypress": '.type("{value}")',
            "selenium-python": '.send_keys("{value}")',
        },
        "clear": {
            "playwright-python": ".clear()",
            "playwright-typescript": ".clear()",
            "cypress": ".clear()",
            "selenium-python": ".clear()",
        },
        "check": {
            "playwright-python": ".check()",
            "playwright-typescript": ".check()",
            "cypress": ".check()",
            "selenium-python": ".click()",
        },
        "select": {
            "playwright-python": '.select_option("{value}")',
            "playwright-typescript": '.selectOption("{value}")',
            "cypress": '.select("{value}")',
            "selenium-python": 'Select(element).select_by_visible_text("{value}")',
        },
    }
    
    def __init__(self, domain_model: DomainModel, source_framework: FrameworkInfo):
        self.domain_model = domain_model
        self.source_framework = source_framework
    
    def convert_to_framework(
        self,
        target_framework: str = "playwright-python",
        include_page_objects: bool = True,
        include_fixtures: bool = True,
    ) -> Dict[str, str]:
        """
        Convert the entire framework to the target framework.
        
        Args:
            target_framework: Target framework ("playwright-python", "playwright-typescript", "cypress")
            include_page_objects: Generate Page Object classes
            include_fixtures: Generate test fixtures/setup
            
        Returns:
            Dict mapping file names to generated code content
        """
        files = {}
        
        if target_framework == "playwright-python":
            files = self._convert_to_playwright_python(include_page_objects, include_fixtures)
        elif target_framework == "playwright-typescript":
            files = self._convert_to_playwright_typescript(include_page_objects, include_fixtures)
        elif target_framework == "cypress":
            files = self._convert_to_cypress(include_page_objects, include_fixtures)
        elif target_framework == "selenium-python":
            files = self._convert_to_selenium_python(include_page_objects, include_fixtures)
        else:
            files = self._convert_to_playwright_python(include_page_objects, include_fixtures)
        
        return files
    
    def _convert_to_playwright_python(
        self,
        include_page_objects: bool,
        include_fixtures: bool,
    ) -> Dict[str, str]:
        """Convert to Playwright Python."""
        files = {}
        
        # Generate conftest.py (fixtures)
        if include_fixtures:
            files["conftest.py"] = self._generate_playwright_python_conftest()
        
        # Generate Page Objects
        if include_page_objects:
            for page in self.domain_model.pages:
                filename = f"pages/{self._to_snake_case(page.name)}.py"
                files[filename] = self._generate_playwright_python_page_object(page)
            
            # Generate pages/__init__.py
            page_imports = [f"from .{self._to_snake_case(p.name)} import {p.name}" for p in self.domain_model.pages]
            files["pages/__init__.py"] = '\n'.join(page_imports)
        
        # Generate test files
        test_content = self._generate_playwright_python_tests()
        files["tests/test_converted.py"] = test_content
        
        # Generate requirements.txt
        files["requirements.txt"] = self._generate_requirements_txt()
        
        # Generate README
        files["README.md"] = self._generate_readme("playwright-python")
        
        return files
    
    def _generate_playwright_python_conftest(self) -> str:
        """Generate pytest conftest.py with fixtures."""
        return f'''"""
Playwright Test Configuration
Generated: {datetime.now().strftime('%Y-%m-%d %H:%M')}
Domain: {self.domain_model.domain}
"""

import pytest
from playwright.sync_api import Page, Browser, BrowserContext
from typing import Generator


@pytest.fixture(scope="session")
def browser_context_args(browser_context_args):
    """Configure browser context."""
    return {{
        **browser_context_args,
        "viewport": {{"width": 1920, "height": 1080}},
        "ignore_https_errors": True,
    }}


@pytest.fixture(scope="function")
def page(page: Page) -> Generator[Page, None, None]:
    """Page fixture with automatic screenshot on failure."""
    yield page
    # Could add automatic screenshot on failure here


@pytest.fixture(scope="session")
def base_url() -> str:
    """Base URL for the application."""
    return "{self.domain_model.base_url or 'http://localhost:3000'}"


# Page Object fixtures
{self._generate_page_object_fixtures()}
'''
    
    def _generate_page_object_fixtures(self) -> str:
        """Generate fixtures for Page Objects."""
        fixtures = []
        for page in self.domain_model.pages:
            snake_name = self._to_snake_case(page.name)
            fixtures.append(f'''
@pytest.fixture
def {snake_name}(page: Page):
    """Fixture for {page.name}."""
    from pages.{snake_name} import {page.name}
    return {page.name}(page)
''')
        return '\n'.join(fixtures)
    
    def _generate_playwright_python_page_object(self, page: PageObject) -> str:
        """Generate a Playwright Python Page Object class."""
        snake_name = self._to_snake_case(page.name)
        
        # Generate locator properties
        locator_code = []
        for loc in page.locators:
            prop_name = self._to_snake_case(loc.name)
            locator_value = self._convert_locator(loc, "playwright-python")
            locator_code.append(f'''
    @property
    def {prop_name}(self):
        """{loc.element_description or loc.name}"""
        return {locator_value}
''')
        
        # Generate action methods
        method_code = []
        for method in page.action_methods:
            method_snake = self._to_snake_case(method)
            method_code.append(f'''
    def {method_snake}(self, *args, **kwargs):
        """Perform {method} action."""
        # TODO: Implement based on original logic
        pass
''')
        
        return f'''"""
{page.name} Page Object
Entity: {page.entity}
"""

from playwright.sync_api import Page, Locator, expect


class {page.name}:
    """Page Object for {page.name}."""
    
    def __init__(self, page: Page):
        self.page = page
        self.url = "{page.url_pattern or '/'}"
    
    def navigate(self):
        """Navigate to this page."""
        self.page.goto(self.url)
        return self
    
    def wait_for_load(self):
        """Wait for page to be fully loaded."""
        self.page.wait_for_load_state("networkidle")
        return self
{''.join(locator_code)}
{''.join(method_code)}
'''
    
    def _generate_playwright_python_tests(self) -> str:
        """Generate Playwright Python test file."""
        test_methods = []
        
        for test in self.domain_model.test_methods:
            test_name = self._to_snake_case(test.name)
            if not test_name.startswith("test_"):
                test_name = f"test_{test_name}"
            
            # Generate test steps
            steps = []
            for step in test.steps:
                step_code = self._convert_step_to_playwright_python(step)
                if step_code:
                    steps.append(f"    {step_code}")
            
            # Generate assertions
            assertions = []
            for assertion in test.assertions:
                assertion_code = self._convert_assertion_to_playwright_python(assertion)
                if assertion_code:
                    assertions.append(f"    {assertion_code}")
            
            steps_code = '\n'.join(steps) if steps else "    # TODO: Add test steps"
            assertions_code = '\n'.join(assertions) if assertions else "    # TODO: Add assertions"
            
            test_methods.append(f'''
def {test_name}(page):
    """
    {test.to_test_case_title()}
    Priority: {test.priority}
    Original: {test.name}
    """
{steps_code}
    
    # Assertions
{assertions_code}
''')
        
        return f'''"""
Converted Test Suite
Generated: {datetime.now().strftime('%Y-%m-%d %H:%M')}
Source Framework: {self.source_framework.framework_type.value}
Domain: {self.domain_model.domain}
"""

import pytest
from playwright.sync_api import Page, expect

{''.join(test_methods)}
'''
    
    def _convert_step_to_playwright_python(self, step: TestStep) -> str:
        """Convert a test step to Playwright Python code."""
        action = step.action.lower()
        
        if "click" in action:
            target = step.target or "button"
            return f'page.locator("{target}").click()'
        elif "fill" in action or "type" in action:
            target = step.target or "input"
            value = step.value or ""
            return f'page.locator("{target}").fill("{value}")'
        elif "navigate" in action or "goto" in action:
            url = step.target or "/"
            return f'page.goto("{url}")'
        elif "wait" in action:
            return 'page.wait_for_load_state("networkidle")'
        else:
            return f'# {step.description or step.action}'
    
    def _convert_assertion_to_playwright_python(self, assertion) -> str:
        """Convert an assertion to Playwright Python code."""
        from .models import AssertionType
        
        if assertion.assertion_type == AssertionType.VISIBLE:
            return f'expect(page.locator("{assertion.actual_expression}")).to_be_visible()'
        elif assertion.assertion_type == AssertionType.TEXT_CONTENT:
            return f'expect(page.locator("body")).to_contain_text("{assertion.expected_value}")'
        elif assertion.assertion_type == AssertionType.URL:
            return f'expect(page).to_have_url("{assertion.expected_value}")'
        elif assertion.assertion_type == AssertionType.TITLE:
            return f'expect(page).to_have_title("{assertion.expected_value}")'
        elif assertion.assertion_type == AssertionType.EQUALS:
            return f'assert {assertion.actual_expression} == "{assertion.expected_value}"'
        else:
            return f'# Assertion: {assertion.description}'
    
    def _convert_to_playwright_typescript(
        self,
        include_page_objects: bool,
        include_fixtures: bool,
    ) -> Dict[str, str]:
        """Convert to Playwright TypeScript."""
        files = {}
        
        # Generate playwright.config.ts
        files["playwright.config.ts"] = self._generate_playwright_ts_config()
        
        # Generate Page Objects
        if include_page_objects:
            for page in self.domain_model.pages:
                filename = f"pages/{self._to_kebab_case(page.name)}.ts"
                files[filename] = self._generate_playwright_ts_page_object(page)
        
        # Generate test file
        files["tests/converted.spec.ts"] = self._generate_playwright_ts_tests()
        
        # Generate package.json
        files["package.json"] = self._generate_package_json()
        
        return files
    
    def _generate_playwright_ts_config(self) -> str:
        """Generate Playwright TypeScript config."""
        return f'''import {{ defineConfig, devices }} from '@playwright/test';

export default defineConfig({{
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {{
    baseURL: '{self.domain_model.base_url or "http://localhost:3000"}',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  }},
  projects: [
    {{ name: 'chromium', use: {{ ...devices['Desktop Chrome'] }} }},
    {{ name: 'firefox', use: {{ ...devices['Desktop Firefox'] }} }},
    {{ name: 'webkit', use: {{ ...devices['Desktop Safari'] }} }},
  ],
}});
'''
    
    def _generate_playwright_ts_page_object(self, page: PageObject) -> str:
        """Generate a Playwright TypeScript Page Object class."""
        locator_props = []
        for loc in page.locators:
            camel_name = self._to_camel_case(loc.name)
            locator_value = self._convert_locator(loc, "playwright-typescript")
            locator_props.append(f'''
  get {camel_name}() {{
    return {locator_value};
  }}
''')
        
        return f'''import {{ Page, Locator, expect }} from '@playwright/test';

export class {page.name} {{
  readonly page: Page;
  readonly url = '{page.url_pattern or "/"}';

  constructor(page: Page) {{
    this.page = page;
  }}

  async navigate() {{
    await this.page.goto(this.url);
    return this;
  }}
{''.join(locator_props)}
}}
'''
    
    def _generate_playwright_ts_tests(self) -> str:
        """Generate Playwright TypeScript tests."""
        tests = []
        
        for test in self.domain_model.test_methods:
            test_name = test.to_test_case_title()
            tests.append(f'''
  test('{test_name}', async ({{ page }}) => {{
    // TODO: Implement test
    // Original: {test.name}
    // Priority: {test.priority}
  }});
''')
        
        return f'''import {{ test, expect }} from '@playwright/test';

test.describe('{self.domain_model.domain.title()} Tests', () => {{
{''.join(tests)}
}});
'''
    
    def _convert_to_cypress(
        self,
        include_page_objects: bool,
        include_fixtures: bool,
    ) -> Dict[str, str]:
        """Convert to Cypress."""
        files = {}
        
        # Generate cypress.config.js
        files["cypress.config.js"] = f'''const {{ defineConfig }} = require('cypress');

module.exports = defineConfig({{
  e2e: {{
    baseUrl: '{self.domain_model.base_url or "http://localhost:3000"}',
    supportFile: 'cypress/support/e2e.js',
    specPattern: 'cypress/e2e/**/*.cy.js',
  }},
}});
'''
        
        # Generate test file
        files["cypress/e2e/converted.cy.js"] = self._generate_cypress_tests()
        
        return files
    
    def _generate_cypress_tests(self) -> str:
        """Generate Cypress tests."""
        tests = []
        
        for test in self.domain_model.test_methods:
            test_name = test.to_test_case_title()
            tests.append(f'''
  it('{test_name}', () => {{
    // TODO: Implement test
    // Original: {test.name}
    // Priority: {test.priority}
  }});
''')
        
        return f'''describe('{self.domain_model.domain.title()} Tests', () => {{
  beforeEach(() => {{
    cy.visit('/');
  }});
{''.join(tests)}
}});
'''
    
    def _convert_to_selenium_python(
        self,
        include_page_objects: bool,
        include_fixtures: bool,
    ) -> Dict[str, str]:
        """Convert to Selenium Python."""
        files = {}
        
        # Generate conftest.py
        files["conftest.py"] = self._generate_selenium_python_conftest()
        
        # Generate Page Objects
        if include_page_objects:
            for page in self.domain_model.pages:
                filename = f"pages/{self._to_snake_case(page.name)}.py"
                files[filename] = self._generate_selenium_python_page_object(page)
        
        # Generate tests
        files["tests/test_converted.py"] = self._generate_selenium_python_tests()
        
        return files
    
    def _generate_selenium_python_conftest(self) -> str:
        """Generate Selenium Python conftest."""
        return f'''"""
Selenium Test Configuration
Generated: {datetime.now().strftime('%Y-%m-%d %H:%M')}
"""

import pytest
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from webdriver_manager.chrome import ChromeDriverManager


@pytest.fixture(scope="function")
def driver():
    """WebDriver fixture."""
    options = webdriver.ChromeOptions()
    options.add_argument("--start-maximized")
    
    driver = webdriver.Chrome(
        service=Service(ChromeDriverManager().install()),
        options=options
    )
    
    yield driver
    driver.quit()


@pytest.fixture
def base_url():
    """Base URL fixture."""
    return "{self.domain_model.base_url or 'http://localhost:3000'}"
'''
    
    def _generate_selenium_python_page_object(self, page: PageObject) -> str:
        """Generate Selenium Python Page Object."""
        return f'''"""
{page.name} Page Object
"""

from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC


class {page.name}:
    """Page Object for {page.name}."""
    
    URL = "{page.url_pattern or '/'}"
    
    def __init__(self, driver):
        self.driver = driver
        self.wait = WebDriverWait(driver, 10)
    
    def navigate(self):
        """Navigate to this page."""
        self.driver.get(self.URL)
        return self
'''
    
    def _generate_selenium_python_tests(self) -> str:
        """Generate Selenium Python tests."""
        return f'''"""
Converted Test Suite - Selenium Python
Generated: {datetime.now().strftime('%Y-%m-%d %H:%M')}
"""

import pytest
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC


class TestConverted:
    """Converted test class."""
    
    def test_placeholder(self, driver, base_url):
        """Placeholder test."""
        driver.get(base_url)
        assert True
'''
    
    # ==================== UTILITY METHODS ====================
    
    def _convert_locator(self, locator: Locator, target: str) -> str:
        """Convert a locator to the target framework."""
        conversion = self.LOCATOR_CONVERSIONS.get(locator.locator_type, {})
        template = conversion.get(target, 'page.locator("{value}")')
        return template.format(value=locator.value)
    
    def _to_snake_case(self, name: str) -> str:
        """Convert to snake_case."""
        # Insert underscore before uppercase letters
        s1 = re.sub('(.)([A-Z][a-z]+)', r'\1_\2', name)
        return re.sub('([a-z0-9])([A-Z])', r'\1_\2', s1).lower()
    
    def _to_camel_case(self, name: str) -> str:
        """Convert to camelCase."""
        components = name.split('_')
        return components[0].lower() + ''.join(x.title() for x in components[1:])
    
    def _to_kebab_case(self, name: str) -> str:
        """Convert to kebab-case."""
        return self._to_snake_case(name).replace('_', '-')
    
    def _generate_requirements_txt(self) -> str:
        """Generate Python requirements.txt."""
        return '''# Playwright Test Dependencies
playwright>=1.40.0
pytest>=7.4.0
pytest-playwright>=0.4.0
pytest-html>=4.0.0
'''
    
    def _generate_package_json(self) -> str:
        """Generate Node.js package.json."""
        return f'''{{
  "name": "{self.domain_model.domain.lower().replace(' ', '-')}-tests",
  "version": "1.0.0",
  "description": "Converted automation tests",
  "scripts": {{
    "test": "playwright test",
    "test:headed": "playwright test --headed",
    "report": "playwright show-report"
  }},
  "devDependencies": {{
    "@playwright/test": "^1.40.0",
    "typescript": "^5.0.0"
  }}
}}
'''
    
    def _generate_readme(self, target_framework: str) -> str:
        """Generate README for the converted framework."""
        return f'''# {self.domain_model.domain.title()} - Converted Test Suite

## Overview

This test suite was automatically converted from {self.source_framework.framework_type.value} to {target_framework}.

**Domain:** {self.domain_model.domain}
**Original Tests:** {self.domain_model.total_tests}
**Pages:** {self.domain_model.total_pages}
**Generated:** {datetime.now().strftime('%Y-%m-%d %H:%M')}

## Getting Started

### Installation

```bash
# Install dependencies
pip install -r requirements.txt

# Install Playwright browsers
playwright install
```

### Running Tests

```bash
# Run all tests
pytest

# Run with HTML report
pytest --html=report.html

# Run specific test
pytest tests/test_converted.py::test_name
```

## Structure

```
├── conftest.py          # Test fixtures
├── pages/               # Page Objects
│   └── *.py
├── tests/               # Test files
│   └── test_*.py
├── requirements.txt     # Dependencies
└── README.md
```

## Notes

- Review and update locators as needed
- Add proper wait strategies for dynamic content
- Configure base URL in conftest.py
'''

