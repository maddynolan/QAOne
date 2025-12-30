"""
Multi-Framework Test Script Converter
Converts recorded actions to various test automation frameworks.

Supported Frameworks:
- Playwright (Python, TypeScript, Java, C#)
- Selenium (Java, Python, C#, JavaScript)
- Cypress (JavaScript, TypeScript)
- Robot Framework
- TestCafe
- Puppeteer
"""

import logging
import re
import json
from typing import Dict, List, Any, Optional
from datetime import datetime

logger = logging.getLogger(__name__)


class FrameworkConverter:
    """
    Converts recorded browser actions to multiple test framework formats.
    """
    
    SUPPORTED_FRAMEWORKS = {
        # Playwright variants
        "playwright-python": "Playwright (Python)",
        "playwright-typescript": "Playwright (TypeScript)",
        "playwright-java": "Playwright (Java)",
        "playwright-csharp": "Playwright (C#)",
        # Selenium variants
        "selenium-java": "Selenium (Java)",
        "selenium-python": "Selenium (Python)",
        "selenium-csharp": "Selenium (C#)",
        "selenium-javascript": "Selenium (JavaScript)",
        # Other frameworks
        "cypress": "Cypress (JavaScript)",
        "cypress-typescript": "Cypress (TypeScript)",
        "robot-framework": "Robot Framework",
        "testcafe": "TestCafe",
        "puppeteer": "Puppeteer",
        # Legacy aliases (for backward compatibility)
        "python": "Playwright (Python)",
        "typescript": "Playwright (TypeScript)",
    }
    
    # Map legacy names to new names
    LEGACY_FRAMEWORK_MAP = {
        "python": "playwright-python",
        "typescript": "playwright-typescript",
    }
    
    def __init__(self):
        self.indent = "    "
    
    def convert(
        self,
        actions: List[Dict[str, Any]],
        framework: str,
        metadata: Dict[str, Any] = None,
        options: Dict[str, Any] = None
    ) -> Dict[str, Any]:
        """
        Convert actions to specified framework.
        
        Returns:
            Dict with 'script', 'page_objects' (if applicable), 'dependencies', 'setup_instructions'
        """
        metadata = metadata or {}
        options = options or {}
        
        # Handle legacy framework names
        if framework in self.LEGACY_FRAMEWORK_MAP:
            framework = self.LEGACY_FRAMEWORK_MAP[framework]
        
        if framework not in self.SUPPORTED_FRAMEWORKS:
            return {
                "error": f"Unsupported framework: {framework}",
                "supported": list(self.SUPPORTED_FRAMEWORKS.keys())
            }
        
        converter_method = getattr(self, f"_convert_{framework.replace('-', '_')}", None)
        
        if not converter_method:
            return self._convert_generic(actions, framework, metadata, options)
        
        return converter_method(actions, metadata, options)
    
    def get_supported_frameworks(self) -> Dict[str, str]:
        """Return list of supported frameworks"""
        return self.SUPPORTED_FRAMEWORKS.copy()
    
    # ==================== PLAYWRIGHT ====================
    
    def _convert_playwright_python(self, actions: List[Dict], metadata: Dict, options: Dict) -> Dict:
        """Convert to Playwright Python (pytest-playwright)"""
        start_url = self._get_start_url(actions, metadata)
        
        script = f'''"""
Test: {metadata.get('name', 'Recorded Test')}
Generated: {datetime.now().isoformat()}
Framework: Playwright (Python)
"""
import pytest
from playwright.sync_api import Page, expect


class Test{self._to_class_name(metadata.get('name', 'Recorded'))}:
    """Test class for {metadata.get('name', 'recorded actions')}"""
    
    def test_recorded_flow(self, page: Page):
        """Test the recorded user flow"""
        # Navigate to start page
        page.goto("{start_url}")
        page.wait_for_load_state("domcontentloaded")
        
{self._generate_playwright_python_actions(actions, 2)}
'''
        
        page_objects = self._generate_pom_python(actions, metadata) if options.get("pageObjectModel") else {}
        
        return {
            "script": script,
            "page_objects": page_objects,
            "dependencies": ["pytest", "pytest-playwright", "playwright"],
            "setup_instructions": "pip install pytest pytest-playwright && playwright install",
            "framework": "playwright-python"
        }
    
    def _convert_playwright_typescript(self, actions: List[Dict], metadata: Dict, options: Dict) -> Dict:
        """Convert to Playwright TypeScript"""
        start_url = self._get_start_url(actions, metadata)
        
        script = f'''/**
 * Test: {metadata.get('name', 'Recorded Test')}
 * Generated: {datetime.now().isoformat()}
 * Framework: Playwright (TypeScript)
 */
import {{ test, expect, Page }} from '@playwright/test';

test.describe('{metadata.get('name', 'Recorded Test')}', () => {{
  test('should complete the recorded flow', async ({{ page }}) => {{
    // Navigate to start page
    await page.goto('{start_url}');
    await page.waitForLoadState('domcontentloaded');
    
{self._generate_playwright_ts_actions(actions, 2)}
  }});
}});
'''
        
        return {
            "script": script,
            "dependencies": ["@playwright/test"],
            "setup_instructions": "npm install -D @playwright/test && npx playwright install",
            "framework": "playwright-typescript"
        }
    
    def _convert_playwright_java(self, actions: List[Dict], metadata: Dict, options: Dict) -> Dict:
        """Convert to Playwright Java"""
        start_url = self._get_start_url(actions, metadata)
        class_name = self._to_class_name(metadata.get('name', 'RecordedTest'))
        
        script = f'''/**
 * Test: {metadata.get('name', 'Recorded Test')}
 * Generated: {datetime.now().isoformat()}
 * Framework: Playwright (Java)
 */
package tests;

import com.microsoft.playwright.*;
import org.junit.jupiter.api.*;
import static org.junit.jupiter.api.Assertions.*;

public class {class_name} {{
    private Playwright playwright;
    private Browser browser;
    private Page page;

    @BeforeEach
    void setUp() {{
        playwright = Playwright.create();
        browser = playwright.chromium().launch();
        page = browser.newPage();
    }}

    @AfterEach
    void tearDown() {{
        browser.close();
        playwright.close();
    }}

    @Test
    void testRecordedFlow() {{
        // Navigate to start page
        page.navigate("{start_url}");
        page.waitForLoadState(LoadState.DOMCONTENTLOADED);
        
{self._generate_playwright_java_actions(actions, 2)}
    }}
}}
'''
        
        return {
            "script": script,
            "dependencies": ["com.microsoft.playwright:playwright:1.40.0", "org.junit.jupiter:junit-jupiter:5.9.3"],
            "setup_instructions": "Add dependencies to pom.xml and run: mvn exec:java -e -D exec.mainClass=com.microsoft.playwright.CLI -D exec.args=\"install\"",
            "framework": "playwright-java"
        }
    
    def _convert_playwright_csharp(self, actions: List[Dict], metadata: Dict, options: Dict) -> Dict:
        """Convert to Playwright C#"""
        start_url = self._get_start_url(actions, metadata)
        class_name = self._to_class_name(metadata.get('name', 'RecordedTest'))
        
        script = f'''/**
 * Test: {metadata.get('name', 'Recorded Test')}
 * Generated: {datetime.now().isoformat()}
 * Framework: Playwright (C#)
 */
using Microsoft.Playwright;
using Microsoft.Playwright.NUnit;
using NUnit.Framework;

namespace Tests;

[TestFixture]
public class {class_name} : PageTest
{{
    [Test]
    public async Task TestRecordedFlow()
    {{
        // Navigate to start page
        await Page.GotoAsync("{start_url}");
        await Page.WaitForLoadStateAsync(LoadState.DOMContentLoaded);
        
{self._generate_playwright_csharp_actions(actions, 2)}
    }}
}}
'''
        
        return {
            "script": script,
            "dependencies": ["Microsoft.Playwright.NUnit"],
            "setup_instructions": "dotnet add package Microsoft.Playwright.NUnit && pwsh bin/Debug/net6.0/playwright.ps1 install",
            "framework": "playwright-csharp"
        }
    
    # ==================== SELENIUM ====================
    
    def _convert_selenium_java(self, actions: List[Dict], metadata: Dict, options: Dict) -> Dict:
        """Convert to Selenium Java"""
        start_url = self._get_start_url(actions, metadata)
        class_name = self._to_class_name(metadata.get('name', 'RecordedTest'))
        
        script = f'''/**
 * Test: {metadata.get('name', 'Recorded Test')}
 * Generated: {datetime.now().isoformat()}
 * Framework: Selenium (Java)
 */
package tests;

import org.openqa.selenium.*;
import org.openqa.selenium.chrome.ChromeDriver;
import org.openqa.selenium.support.ui.*;
import org.junit.jupiter.api.*;
import java.time.Duration;

import static org.junit.jupiter.api.Assertions.*;

public class {class_name} {{
    private WebDriver driver;
    private WebDriverWait wait;

    @BeforeEach
    void setUp() {{
        driver = new ChromeDriver();
        wait = new WebDriverWait(driver, Duration.ofSeconds(10));
        driver.manage().window().maximize();
    }}

    @AfterEach
    void tearDown() {{
        if (driver != null) {{
            driver.quit();
        }}
    }}

    @Test
    void testRecordedFlow() {{
        // Navigate to start page
        driver.get("{start_url}");
        
{self._generate_selenium_java_actions(actions, 2)}
    }}
    
    private WebElement waitForElement(By locator) {{
        return wait.until(ExpectedConditions.elementToBeClickable(locator));
    }}
}}
'''
        
        return {
            "script": script,
            "dependencies": ["org.seleniumhq.selenium:selenium-java:4.15.0", "org.junit.jupiter:junit-jupiter:5.9.3"],
            "setup_instructions": "Add dependencies to pom.xml. Download ChromeDriver matching your Chrome version.",
            "framework": "selenium-java"
        }
    
    def _convert_selenium_python(self, actions: List[Dict], metadata: Dict, options: Dict) -> Dict:
        """Convert to Selenium Python"""
        start_url = self._get_start_url(actions, metadata)
        
        script = f'''"""
Test: {metadata.get('name', 'Recorded Test')}
Generated: {datetime.now().isoformat()}
Framework: Selenium (Python)
"""
import pytest
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.service import Service
from webdriver_manager.chrome import ChromeDriverManager


class Test{self._to_class_name(metadata.get('name', 'Recorded'))}:
    """Test class for {metadata.get('name', 'recorded actions')}"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        self.driver = webdriver.Chrome(service=Service(ChromeDriverManager().install()))
        self.driver.maximize_window()
        self.wait = WebDriverWait(self.driver, 10)
        yield
        self.driver.quit()
    
    def test_recorded_flow(self):
        """Test the recorded user flow"""
        # Navigate to start page
        self.driver.get("{start_url}")
        
{self._generate_selenium_python_actions(actions, 2)}
    
    def wait_for_element(self, locator):
        return self.wait.until(EC.element_to_be_clickable(locator))
'''
        
        return {
            "script": script,
            "dependencies": ["selenium", "pytest", "webdriver-manager"],
            "setup_instructions": "pip install selenium pytest webdriver-manager",
            "framework": "selenium-python"
        }
    
    def _convert_selenium_csharp(self, actions: List[Dict], metadata: Dict, options: Dict) -> Dict:
        """Convert to Selenium C#"""
        start_url = self._get_start_url(actions, metadata)
        class_name = self._to_class_name(metadata.get('name', 'RecordedTest'))
        
        script = f'''/**
 * Test: {metadata.get('name', 'Recorded Test')}
 * Generated: {datetime.now().isoformat()}
 * Framework: Selenium (C#)
 */
using NUnit.Framework;
using OpenQA.Selenium;
using OpenQA.Selenium.Chrome;
using OpenQA.Selenium.Support.UI;
using SeleniumExtras.WaitHelpers;

namespace Tests;

[TestFixture]
public class {class_name}
{{
    private IWebDriver driver;
    private WebDriverWait wait;

    [SetUp]
    public void SetUp()
    {{
        driver = new ChromeDriver();
        wait = new WebDriverWait(driver, TimeSpan.FromSeconds(10));
        driver.Manage().Window.Maximize();
    }}

    [TearDown]
    public void TearDown()
    {{
        driver?.Quit();
    }}

    [Test]
    public void TestRecordedFlow()
    {{
        // Navigate to start page
        driver.Navigate().GoToUrl("{start_url}");
        
{self._generate_selenium_csharp_actions(actions, 2)}
    }}
    
    private IWebElement WaitForElement(By locator)
    {{
        return wait.Until(ExpectedConditions.ElementToBeClickable(locator));
    }}
}}
'''
        
        return {
            "script": script,
            "dependencies": ["Selenium.WebDriver", "NUnit", "SeleniumExtras.WaitHelpers"],
            "setup_instructions": "dotnet add package Selenium.WebDriver && dotnet add package NUnit && dotnet add package SeleniumExtras.WaitHelpers",
            "framework": "selenium-csharp"
        }
    
    # ==================== CYPRESS ====================
    
    def _convert_cypress(self, actions: List[Dict], metadata: Dict, options: Dict) -> Dict:
        """Convert to Cypress JavaScript"""
        start_url = self._get_start_url(actions, metadata)
        
        script = f'''/**
 * Test: {metadata.get('name', 'Recorded Test')}
 * Generated: {datetime.now().isoformat()}
 * Framework: Cypress
 */
describe('{metadata.get('name', 'Recorded Test')}', () => {{
  beforeEach(() => {{
    // Visit the starting page
    cy.visit('{start_url}');
  }});

  it('should complete the recorded flow', () => {{
{self._generate_cypress_actions(actions, 2)}
  }});
}});
'''
        
        return {
            "script": script,
            "dependencies": ["cypress"],
            "setup_instructions": "npm install cypress --save-dev && npx cypress open",
            "framework": "cypress"
        }
    
    def _convert_cypress_typescript(self, actions: List[Dict], metadata: Dict, options: Dict) -> Dict:
        """Convert to Cypress TypeScript"""
        result = self._convert_cypress(actions, metadata, options)
        result["framework"] = "cypress-typescript"
        result["dependencies"].append("typescript")
        return result
    
    # ==================== ROBOT FRAMEWORK ====================
    
    def _convert_robot_framework(self, actions: List[Dict], metadata: Dict, options: Dict) -> Dict:
        """Convert to Robot Framework"""
        start_url = self._get_start_url(actions, metadata)
        
        script = f'''*** Settings ***
Documentation    {metadata.get('name', 'Recorded Test')}
...              Generated: {datetime.now().isoformat()}
Library          SeleniumLibrary
Test Setup       Open Browser    {start_url}    chrome
Test Teardown    Close Browser

*** Test Cases ***
{metadata.get('name', 'Recorded Test').replace(' ', '_')}
    [Documentation]    Test the recorded user flow
{self._generate_robot_actions(actions, 1)}
'''
        
        return {
            "script": script,
            "dependencies": ["robotframework", "robotframework-seleniumlibrary"],
            "setup_instructions": "pip install robotframework robotframework-seleniumlibrary && robot tests/",
            "framework": "robot-framework"
        }
    
    # ==================== TESTCAFE ====================
    
    def _convert_testcafe(self, actions: List[Dict], metadata: Dict, options: Dict) -> Dict:
        """Convert to TestCafe"""
        start_url = self._get_start_url(actions, metadata)
        
        script = f'''/**
 * Test: {metadata.get('name', 'Recorded Test')}
 * Generated: {datetime.now().isoformat()}
 * Framework: TestCafe
 */
import {{ Selector }} from 'testcafe';

fixture('{metadata.get('name', 'Recorded Test')}')
    .page('{start_url}');

test('should complete the recorded flow', async t => {{
{self._generate_testcafe_actions(actions, 1)}
}});
'''
        
        return {
            "script": script,
            "dependencies": ["testcafe"],
            "setup_instructions": "npm install -g testcafe && testcafe chrome tests/",
            "framework": "testcafe"
        }
    
    # ==================== PUPPETEER ====================
    
    def _convert_puppeteer(self, actions: List[Dict], metadata: Dict, options: Dict) -> Dict:
        """Convert to Puppeteer"""
        start_url = self._get_start_url(actions, metadata)
        
        script = f'''/**
 * Test: {metadata.get('name', 'Recorded Test')}
 * Generated: {datetime.now().isoformat()}
 * Framework: Puppeteer
 */
const puppeteer = require('puppeteer');

describe('{metadata.get('name', 'Recorded Test')}', () => {{
  let browser;
  let page;

  beforeAll(async () => {{
    browser = await puppeteer.launch({{ headless: false }});
    page = await browser.newPage();
  }});

  afterAll(async () => {{
    await browser.close();
  }});

  test('should complete the recorded flow', async () => {{
    await page.goto('{start_url}');
    await page.waitForNavigation({{ waitUntil: 'domcontentloaded' }});
    
{self._generate_puppeteer_actions(actions, 2)}
  }});
}});
'''
        
        return {
            "script": script,
            "dependencies": ["puppeteer", "jest"],
            "setup_instructions": "npm install puppeteer jest && npx jest",
            "framework": "puppeteer"
        }
    
    # ==================== HELPER METHODS ====================
    
    def _get_start_url(self, actions: List[Dict], metadata: Dict) -> str:
        """Extract start URL from actions or metadata"""
        url = metadata.get("startUrl") or metadata.get("start_url")
        if not url or url == "about:blank":
            for action in actions:
                if action.get("type") == "navigate" and action.get("url"):
                    return action["url"]
        return url or "https://example.com"
    
    def _to_class_name(self, name: str) -> str:
        """Convert name to valid class name"""
        # Remove special chars, capitalize words
        clean = re.sub(r'[^a-zA-Z0-9\s]', '', name)
        return ''.join(word.capitalize() for word in clean.split())
    
    def _get_selector(self, action: Dict) -> Dict[str, str]:
        """Get best selector from action"""
        selector = action.get("selector", {})
        if isinstance(selector, str):
            return {"css": selector}
        
        # Priority: data-testid > name > aria-label > id > css
        if selector.get("testId"):
            return {"testid": selector["testId"]}
        if selector.get("name"):
            return {"name": selector["name"]}
        if selector.get("ariaLabel"):
            return {"aria": selector["ariaLabel"]}
        if selector.get("id") and not re.match(r'^[a-f0-9-]{8,}$', selector["id"]):
            return {"id": selector["id"]}
        if selector.get("css"):
            return {"css": selector["css"]}
        
        # Fallback to description text
        desc = action.get("description", "")
        text_match = re.search(r'["\']([^"\']+)["\']', desc)
        if text_match:
            return {"text": text_match.group(1)}
        
        return {"css": "body"}
    
    def _generate_pom_python(self, actions: List[Dict], metadata: Dict) -> Dict[str, str]:
        """Generate Python Page Object classes"""
        pages = {}
        current_page = "HomePage"
        page_elements = {current_page: {}}
        
        for action in actions:
            if action.get("type") == "navigate":
                url = action.get("url", "")
                if url:
                    page_name = self._url_to_page_name(url)
                    if page_name not in page_elements:
                        page_elements[page_name] = {}
                    current_page = page_name
            else:
                sel = self._get_selector(action)
                name = self._action_to_element_name(action)
                if name:
                    page_elements[current_page][name] = sel
        
        for page_name, elements in page_elements.items():
            if elements:
                pages[page_name] = self._create_pom_class_python(page_name, elements)
        
        return pages
    
    def _create_pom_class_python(self, page_name: str, elements: Dict) -> str:
        """Create Python POM class"""
        lines = [
            f'"""Page Object: {page_name}"""',
            f"from playwright.sync_api import Page, Locator",
            f"",
            f"class {page_name}:",
            f'    """Page Object for {page_name}"""',
            f"    ",
            f"    def __init__(self, page: Page):",
            f"        self.page = page",
            f"    ",
        ]
        
        for name, sel in elements.items():
            locator = self._selector_to_playwright_python(sel)
            lines.extend([
                f"    @property",
                f"    def {name}(self) -> Locator:",
                f"        return self.page.{locator}",
                f"    ",
            ])
        
        return "\n".join(lines)
    
    def _selector_to_playwright_python(self, sel: Dict) -> str:
        """Convert selector dict to Playwright Python locator"""
        if "testid" in sel:
            return f'get_by_test_id("{sel["testid"]}")'
        if "name" in sel:
            return f'locator(\'[name="{sel["name"]}"]\')' 
        if "aria" in sel:
            return f'get_by_label("{sel["aria"]}")'
        if "id" in sel:
            return f'locator("#{sel["id"]}")'
        if "text" in sel:
            return f'get_by_text("{sel["text"]}")'
        return f'locator("{sel.get("css", "body")}")'
    
    def _url_to_page_name(self, url: str) -> str:
        """Convert URL to page class name"""
        from urllib.parse import urlparse
        parsed = urlparse(url)
        path = parsed.path.strip("/").replace("-", "_").replace("/", "_")
        if not path:
            return "HomePage"
        return "".join(word.capitalize() for word in path.split("_")) + "Page"
    
    def _action_to_element_name(self, action: Dict) -> str:
        """Convert action to element name"""
        desc = action.get("description", "")
        text_match = re.search(r'["\']([^"\']+)["\']', desc)
        if text_match:
            text = text_match.group(1)
            return self._to_snake_case(text) + "_element"
        action_type = action.get("type", "element")
        return f"{action_type}_element"
    
    def _to_snake_case(self, text: str) -> str:
        """Convert text to snake_case"""
        clean = re.sub(r'[^a-zA-Z0-9\s]', '', text)
        return '_'.join(clean.lower().split())[:30]
    
    # ==================== ACTION GENERATORS ====================
    # (Implement per-framework action generation)
    
    def _generate_playwright_python_actions(self, actions: List[Dict], indent_level: int) -> str:
        """Generate Playwright Python actions"""
        lines = []
        indent = self.indent * indent_level
        
        for action in actions:
            action_type = action.get("type", "")
            desc = action.get("description", "")
            sel = self._get_selector(action)
            locator = self._selector_to_playwright_python(sel)
            
            if action_type == "click":
                lines.append(f'{indent}# {desc}')
                lines.append(f'{indent}page.{locator}.click()')
            elif action_type in ["fill", "type", "input"]:
                value = action.get("value", "")
                lines.append(f'{indent}# {desc}')
                lines.append(f'{indent}page.{locator}.fill("{value}")')
            elif action_type == "check":
                lines.append(f'{indent}# {desc}')
                lines.append(f'{indent}page.{locator}.check()')
            elif action_type == "select":
                value = action.get("value", "")
                lines.append(f'{indent}# {desc}')
                lines.append(f'{indent}page.{locator}.select_option("{value}")')
            elif action_type == "navigate" and action.get("url"):
                # Skip duplicate navigations
                pass
        
        return '\n'.join(lines)
    
    def _generate_playwright_ts_actions(self, actions: List[Dict], indent_level: int) -> str:
        """Generate Playwright TypeScript actions"""
        lines = []
        indent = self.indent * indent_level
        
        for action in actions:
            action_type = action.get("type", "")
            desc = action.get("description", "")
            sel = self._get_selector(action)
            locator = self._selector_to_playwright_ts(sel)
            
            if action_type == "click":
                lines.append(f'{indent}// {desc}')
                lines.append(f'{indent}await page.{locator}.click();')
            elif action_type in ["fill", "type", "input"]:
                value = action.get("value", "")
                lines.append(f'{indent}// {desc}')
                lines.append(f'{indent}await page.{locator}.fill("{value}");')
            elif action_type == "check":
                lines.append(f'{indent}// {desc}')
                lines.append(f'{indent}await page.{locator}.check();')
        
        return '\n'.join(lines)
    
    def _selector_to_playwright_ts(self, sel: Dict) -> str:
        """Convert selector to Playwright TS"""
        if "testid" in sel:
            return f'getByTestId("{sel["testid"]}")'
        if "name" in sel:
            return f'locator(\'[name="{sel["name"]}"]\')' 
        if "aria" in sel:
            return f'getByLabel("{sel["aria"]}")'
        if "text" in sel:
            return f'getByText("{sel["text"]}")'
        return f'locator("{sel.get("css", "body")}")'
    
    def _generate_playwright_java_actions(self, actions: List[Dict], indent_level: int) -> str:
        """Generate Playwright Java actions"""
        lines = []
        indent = self.indent * indent_level
        
        for action in actions:
            action_type = action.get("type", "")
            desc = action.get("description", "")
            sel = self._get_selector(action)
            locator = self._selector_to_playwright_java(sel)
            
            if action_type == "click":
                lines.append(f'{indent}// {desc}')
                lines.append(f'{indent}page.{locator}.click();')
            elif action_type in ["fill", "type", "input"]:
                value = action.get("value", "")
                lines.append(f'{indent}// {desc}')
                lines.append(f'{indent}page.{locator}.fill("{value}");')
        
        return '\n'.join(lines)
    
    def _selector_to_playwright_java(self, sel: Dict) -> str:
        """Convert selector to Playwright Java"""
        if "testid" in sel:
            return f'getByTestId("{sel["testid"]}")'
        if "name" in sel:
            return f'locator("[name=\\"{sel["name"]}\\"]")' 
        if "text" in sel:
            return f'getByText("{sel["text"]}")'
        return f'locator("{sel.get("css", "body")}")'
    
    def _generate_playwright_csharp_actions(self, actions: List[Dict], indent_level: int) -> str:
        """Generate Playwright C# actions"""
        lines = []
        indent = self.indent * indent_level
        
        for action in actions:
            action_type = action.get("type", "")
            desc = action.get("description", "")
            sel = self._get_selector(action)
            locator = self._selector_to_playwright_csharp(sel)
            
            if action_type == "click":
                lines.append(f'{indent}// {desc}')
                lines.append(f'{indent}await Page.{locator}.ClickAsync();')
            elif action_type in ["fill", "type", "input"]:
                value = action.get("value", "")
                lines.append(f'{indent}// {desc}')
                lines.append(f'{indent}await Page.{locator}.FillAsync("{value}");')
        
        return '\n'.join(lines)
    
    def _selector_to_playwright_csharp(self, sel: Dict) -> str:
        """Convert selector to Playwright C#"""
        if "testid" in sel:
            return f'GetByTestId("{sel["testid"]}")'
        if "name" in sel:
            return f'Locator("[name=\\"{sel["name"]}\\"]")' 
        if "text" in sel:
            return f'GetByText("{sel["text"]}")'
        return f'Locator("{sel.get("css", "body")}")'
    
    def _generate_selenium_java_actions(self, actions: List[Dict], indent_level: int) -> str:
        """Generate Selenium Java actions"""
        lines = []
        indent = self.indent * indent_level
        
        for action in actions:
            action_type = action.get("type", "")
            desc = action.get("description", "")
            sel = self._get_selector(action)
            by = self._selector_to_selenium_java(sel)
            
            if action_type == "click":
                lines.append(f'{indent}// {desc}')
                lines.append(f'{indent}waitForElement({by}).click();')
            elif action_type in ["fill", "type", "input"]:
                value = action.get("value", "")
                lines.append(f'{indent}// {desc}')
                lines.append(f'{indent}waitForElement({by}).sendKeys("{value}");')
        
        return '\n'.join(lines)
    
    def _selector_to_selenium_java(self, sel: Dict) -> str:
        """Convert selector to Selenium Java By"""
        if "testid" in sel:
            return f'By.cssSelector("[data-testid=\\"{sel["testid"]}\\"]")'
        if "name" in sel:
            return f'By.name("{sel["name"]}")'
        if "id" in sel:
            return f'By.id("{sel["id"]}")'
        if "text" in sel:
            return f'By.xpath("//*[contains(text(), \\"{sel["text"]}\\")]")'
        return f'By.cssSelector("{sel.get("css", "body")}")'
    
    def _generate_selenium_python_actions(self, actions: List[Dict], indent_level: int) -> str:
        """Generate Selenium Python actions"""
        lines = []
        indent = self.indent * indent_level
        
        for action in actions:
            action_type = action.get("type", "")
            desc = action.get("description", "")
            sel = self._get_selector(action)
            by = self._selector_to_selenium_python(sel)
            
            if action_type == "click":
                lines.append(f'{indent}# {desc}')
                lines.append(f'{indent}self.wait_for_element({by}).click()')
            elif action_type in ["fill", "type", "input"]:
                value = action.get("value", "")
                lines.append(f'{indent}# {desc}')
                lines.append(f'{indent}self.wait_for_element({by}).send_keys("{value}")')
        
        return '\n'.join(lines)
    
    def _selector_to_selenium_python(self, sel: Dict) -> str:
        """Convert selector to Selenium Python"""
        if "testid" in sel:
            return f'(By.CSS_SELECTOR, "[data-testid=\\"{sel["testid"]}\\"]")'
        if "name" in sel:
            return f'(By.NAME, "{sel["name"]}")'
        if "id" in sel:
            return f'(By.ID, "{sel["id"]}")'
        if "text" in sel:
            return f'(By.XPATH, "//*[contains(text(), \\"{sel["text"]}\\")]")'
        return f'(By.CSS_SELECTOR, "{sel.get("css", "body")}")'
    
    def _generate_selenium_csharp_actions(self, actions: List[Dict], indent_level: int) -> str:
        """Generate Selenium C# actions"""
        lines = []
        indent = self.indent * indent_level
        
        for action in actions:
            action_type = action.get("type", "")
            desc = action.get("description", "")
            sel = self._get_selector(action)
            by = self._selector_to_selenium_csharp(sel)
            
            if action_type == "click":
                lines.append(f'{indent}// {desc}')
                lines.append(f'{indent}WaitForElement({by}).Click();')
            elif action_type in ["fill", "type", "input"]:
                value = action.get("value", "")
                lines.append(f'{indent}// {desc}')
                lines.append(f'{indent}WaitForElement({by}).SendKeys("{value}");')
        
        return '\n'.join(lines)
    
    def _selector_to_selenium_csharp(self, sel: Dict) -> str:
        """Convert selector to Selenium C#"""
        if "testid" in sel:
            return f'By.CssSelector("[data-testid=\\"{sel["testid"]}\\"]")'
        if "name" in sel:
            return f'By.Name("{sel["name"]}")'
        if "id" in sel:
            return f'By.Id("{sel["id"]}")'
        return f'By.CssSelector("{sel.get("css", "body")}")'
    
    def _generate_cypress_actions(self, actions: List[Dict], indent_level: int) -> str:
        """Generate Cypress actions"""
        lines = []
        indent = self.indent * indent_level
        
        for action in actions:
            action_type = action.get("type", "")
            desc = action.get("description", "")
            sel = self._get_selector(action)
            locator = self._selector_to_cypress(sel)
            
            if action_type == "click":
                lines.append(f'{indent}// {desc}')
                lines.append(f'{indent}{locator}.click();')
            elif action_type in ["fill", "type", "input"]:
                value = action.get("value", "")
                lines.append(f'{indent}// {desc}')
                lines.append(f'{indent}{locator}.type("{value}");')
            elif action_type == "check":
                lines.append(f'{indent}// {desc}')
                lines.append(f'{indent}{locator}.check();')
        
        return '\n'.join(lines)
    
    def _selector_to_cypress(self, sel: Dict) -> str:
        """Convert selector to Cypress"""
        if "testid" in sel:
            return f'cy.get("[data-testid=\\"{sel["testid"]}\\"]")'
        if "text" in sel:
            return f'cy.contains("{sel["text"]}")'
        if "name" in sel:
            return f'cy.get("[name=\\"{sel["name"]}\\"]")'
        return f'cy.get("{sel.get("css", "body")}")'
    
    def _generate_robot_actions(self, actions: List[Dict], indent_level: int) -> str:
        """Generate Robot Framework actions"""
        lines = []
        indent = "    " * indent_level
        
        for action in actions:
            action_type = action.get("type", "")
            desc = action.get("description", "")
            sel = self._get_selector(action)
            locator = self._selector_to_robot(sel)
            
            if action_type == "click":
                lines.append(f'{indent}# {desc}')
                lines.append(f'{indent}Click Element    {locator}')
            elif action_type in ["fill", "type", "input"]:
                value = action.get("value", "")
                lines.append(f'{indent}# {desc}')
                lines.append(f'{indent}Input Text    {locator}    {value}')
        
        return '\n'.join(lines)
    
    def _selector_to_robot(self, sel: Dict) -> str:
        """Convert selector to Robot Framework locator"""
        if "testid" in sel:
            return f'css:[data-testid="{sel["testid"]}"]'
        if "name" in sel:
            return f'name:{sel["name"]}'
        if "id" in sel:
            return f'id:{sel["id"]}'
        return f'css:{sel.get("css", "body")}'
    
    def _generate_testcafe_actions(self, actions: List[Dict], indent_level: int) -> str:
        """Generate TestCafe actions"""
        lines = []
        indent = self.indent * indent_level
        
        for action in actions:
            action_type = action.get("type", "")
            desc = action.get("description", "")
            sel = self._get_selector(action)
            selector = self._selector_to_testcafe(sel)
            
            if action_type == "click":
                lines.append(f'{indent}// {desc}')
                lines.append(f'{indent}await t.click({selector});')
            elif action_type in ["fill", "type", "input"]:
                value = action.get("value", "")
                lines.append(f'{indent}// {desc}')
                lines.append(f'{indent}await t.typeText({selector}, "{value}");')
        
        return '\n'.join(lines)
    
    def _selector_to_testcafe(self, sel: Dict) -> str:
        """Convert selector to TestCafe Selector"""
        if "testid" in sel:
            return f'Selector("[data-testid=\\"{sel["testid"]}\\"]")'
        if "text" in sel:
            return f'Selector("*").withText("{sel["text"]}")'
        if "name" in sel:
            return f'Selector("[name=\\"{sel["name"]}\\"]")'
        return f'Selector("{sel.get("css", "body")}")'
    
    def _generate_puppeteer_actions(self, actions: List[Dict], indent_level: int) -> str:
        """Generate Puppeteer actions"""
        lines = []
        indent = self.indent * indent_level
        
        for action in actions:
            action_type = action.get("type", "")
            desc = action.get("description", "")
            sel = self._get_selector(action)
            selector = self._selector_to_puppeteer(sel)
            
            if action_type == "click":
                lines.append(f'{indent}// {desc}')
                lines.append(f'{indent}await page.click({selector});')
            elif action_type in ["fill", "type", "input"]:
                value = action.get("value", "")
                lines.append(f'{indent}// {desc}')
                lines.append(f'{indent}await page.type({selector}, "{value}");')
        
        return '\n'.join(lines)
    
    def _selector_to_puppeteer(self, sel: Dict) -> str:
        """Convert selector to Puppeteer selector"""
        if "testid" in sel:
            return f'"[data-testid=\\"{sel["testid"]}\\"]"'
        if "name" in sel:
            return f'"[name=\\"{sel["name"]}\\"]"'
        return f'"{sel.get("css", "body")}"'
    
    def _convert_generic(self, actions: List[Dict], framework: str, metadata: Dict, options: Dict) -> Dict:
        """Generic fallback converter"""
        return {
            "error": f"Framework {framework} not fully implemented",
            "actions": actions,
            "framework": framework
        }


# Singleton instance
_converter = None

def get_framework_converter() -> FrameworkConverter:
    """Get or create the framework converter singleton"""
    global _converter
    if _converter is None:
        _converter = FrameworkConverter()
    return _converter

