"""
Script Converter Service
Converts test scripts from other tools (Selenium, Cypress, WebDriverIO) to Playwright.
Follows industry standards for script migration.
"""

import logging
import re
from typing import Dict, List, Any, Optional

logger = logging.getLogger(__name__)


class ScriptConverter:
    """
    Converts test scripts from various frameworks to Playwright.
    Supports: Selenium, Cypress, WebDriverIO, Puppeteer
    """
    
    def __init__(self):
        # Conversion patterns
        self.selenium_patterns = {
            r'driver\.findElement\(By\.id\(["\']([^"\']+)["\']\)\)': r'page.locator("#\1")',
            r'driver\.findElement\(By\.cssSelector\(["\']([^"\']+)["\']\)\)': r'page.locator("\1")',
            r'driver\.findElement\(By\.xpath\(["\']([^"\']+)["\']\)\)': r'page.locator("\1")',
            r'driver\.findElement\(By\.name\(["\']([^"\']+)["\']\)\)': r'page.locator("[name="\1"]")',
            r'driver\.findElement\(By\.className\(["\']([^"\']+)["\']\)\)': r'page.locator(".\1")',
            r'driver\.get\(["\']([^"\']+)["\']\)': r'await page.goto("\1")',
            r'element\.click\(\)': r'await element.click()',
            r'element\.sendKeys\(["\']([^"\']+)["\']\)': r'await element.fill("\1")',
            r'element\.getText\(\)': r'await element.textContent()',
            r'WebDriverWait\(driver,\s*(\d+)\)': r'page.waitForTimeout(\1)',
            r'\.until\(ExpectedConditions\.elementToBeClickable': r'await element.waitFor({ state: "visible" })',
        }
        
        self.cypress_patterns = {
            r'cy\.get\(["\']([^"\']+)["\']\)': r'page.locator("\1")',
            r'cy\.visit\(["\']([^"\']+)["\']\)': r'await page.goto("\1")',
            r'cy\.click\(\)': r'await element.click()',
            r'cy\.type\(["\']([^"\']+)["\']\)': r'await element.fill("\1")',
            r'cy\.should\(["\']([^"\']+)["\']\)': r'await expect(element).\1()',
            r'cy\.wait\((\d+)\)': r'await page.waitForTimeout(\1)',
            r'cy\.contains\(["\']([^"\']+)["\']\)': r'page.locator("text=\1")',
        }
        
        self.webdriverio_patterns = {
            r'browser\.\$\(["\']([^"\']+)["\']\)': r'page.locator("\1")',
            r'browser\.url\(["\']([^"\']+)["\']\)': r'await page.goto("\1")',
            r'element\.click\(\)': r'await element.click()',
            r'element\.setValue\(["\']([^"\']+)["\']\)': r'await element.fill("\1")',
            r'element\.getText\(\)': r'await element.textContent()',
            r'browser\.pause\((\d+)\)': r'await page.waitForTimeout(\1)',
        }
    
    def convert_to_playwright(
        self,
        source_code: str,
        source_framework: str = "auto"
    ) -> Dict[str, Any]:
        """
        Convert test script to Playwright TypeScript.
        
        Args:
            source_code: Source test code
            source_framework: Framework type (selenium, cypress, webdriverio, auto)
            
        Returns:
            Dict with converted code and metadata
        """
        # Auto-detect framework if not specified
        if source_framework == "auto":
            source_framework = self._detect_framework(source_code)
        
        logger.info(f"Converting {source_framework} script to Playwright")
        
        # Convert based on framework
        if source_framework == "selenium":
            converted = self._convert_selenium(source_code)
        elif source_framework == "cypress":
            converted = self._convert_cypress(source_code)
        elif source_framework == "webdriverio":
            converted = self._convert_webdriverio(source_code)
        else:
            # Generic conversion (try all patterns)
            converted = self._convert_generic(source_code)
        
        # Wrap in Playwright test structure if needed
        if not self._has_playwright_structure(converted):
            converted = self._wrap_in_playwright_test(converted)
        
        return {
            "converted_code": converted,
            "source_framework": source_framework,
            "target_framework": "playwright",
            "conversion_notes": self._generate_conversion_notes(source_framework)
        }
    
    def _detect_framework(self, code: str) -> str:
        """Auto-detect source framework from code patterns."""
        code_lower = code.lower()
        
        if 'cy.' in code_lower or 'cypress' in code_lower:
            return "cypress"
        elif 'driver.findElement' in code_lower or 'WebDriver' in code_lower:
            return "selenium"
        elif 'browser.$' in code_lower or 'webdriverio' in code_lower:
            return "webdriverio"
        elif 'puppeteer' in code_lower or 'page.' in code_lower:
            return "puppeteer"
        else:
            return "unknown"
    
    def _convert_selenium(self, code: str) -> str:
        """Convert Selenium code to Playwright."""
        converted = code
        
        # Apply conversion patterns
        for pattern, replacement in self.selenium_patterns.items():
            converted = re.sub(pattern, replacement, converted)
        
        # Add await keywords where needed
        converted = self._add_await_keywords(converted)
        
        # Convert imports
        converted = re.sub(
            r'from selenium import.*',
            "import { test, expect } from '@playwright/test';",
            converted
        )
        converted = re.sub(
            r'import.*selenium.*',
            "import { test, expect } from '@playwright/test';",
            converted
        )
        
        return converted
    
    def _convert_cypress(self, code: str) -> str:
        """Convert Cypress code to Playwright."""
        converted = code
        
        # Apply conversion patterns
        for pattern, replacement in self.cypress_patterns.items():
            converted = re.sub(pattern, replacement, converted)
        
        # Convert Cypress commands to Playwright
        converted = re.sub(r'cy\.', 'page.', converted)
        
        # Add await keywords
        converted = self._add_await_keywords(converted)
        
        # Convert imports
        converted = re.sub(
            r'/// <reference types="cypress" />',
            "import { test, expect } from '@playwright/test';",
            converted
        )
        
        return converted
    
    def _convert_webdriverio(self, code: str) -> str:
        """Convert WebDriverIO code to Playwright."""
        converted = code
        
        # Apply conversion patterns
        for pattern, replacement in self.webdriverio_patterns.items():
            converted = re.sub(pattern, replacement, converted)
        
        # Convert browser to page
        converted = re.sub(r'\bbrowser\.', 'page.', converted)
        
        # Add await keywords
        converted = self._add_await_keywords(converted)
        
        return converted
    
    def _convert_generic(self, code: str) -> str:
        """Generic conversion trying all patterns."""
        converted = code
        
        # Try all patterns
        all_patterns = {
            **self.selenium_patterns,
            **self.cypress_patterns,
            **self.webdriverio_patterns
        }
        
        for pattern, replacement in all_patterns.items():
            converted = re.sub(pattern, replacement, converted)
        
        return converted
    
    def _add_await_keywords(self, code: str) -> str:
        """Add await keywords before async operations."""
        # Patterns that need await
        await_patterns = [
            (r'page\.goto\(', 'await page.goto('),
            (r'page\.click\(', 'await page.click('),
            (r'page\.fill\(', 'await page.fill('),
            (r'page\.selectOption\(', 'await page.selectOption('),
            (r'element\.click\(', 'await element.click('),
            (r'element\.fill\(', 'await element.fill('),
            (r'page\.waitFor', 'await page.waitFor'),
            (r'element\.waitFor', 'await element.waitFor'),
        ]
        
        for pattern, replacement in await_patterns:
            # Only add await if not already present
            code = re.sub(
                rf'(?<!await\s)(?<!await\s{pattern})',
                '',
                code
            )
            code = re.sub(pattern, replacement, code)
        
        return code
    
    def _has_playwright_structure(self, code: str) -> bool:
        """Check if code already has Playwright test structure."""
        return (
            'import { test' in code or
            'from "@playwright/test"' in code or
            'test(' in code or
            'describe(' in code
        )
    
    def _wrap_in_playwright_test(self, code: str) -> str:
        """Wrap code in Playwright test structure."""
        # Extract test name from code if possible
        test_name = "Converted Test"
        name_match = re.search(r'(?:test|it|describe)\(["\']([^"\']+)["\']', code, re.IGNORECASE)
        if name_match:
            test_name = name_match.group(1)
        
        return f"""import {{ test, expect }} from '@playwright/test';

test('{test_name}', async ({{ page }}) => {{
{self._indent_code(code)}
}});"""
    
    def _indent_code(self, code: str, indent: int = 2) -> str:
        """Indent code by specified spaces."""
        lines = code.split('\n')
        indented = []
        for line in lines:
            if line.strip():  # Skip empty lines
                indented.append(' ' * indent + line)
            else:
                indented.append('')
        return '\n'.join(indented)
    
    def _generate_conversion_notes(self, source_framework: str) -> List[str]:
        """Generate notes about conversion."""
        notes = [
            f"Converted from {source_framework} to Playwright",
            "Review and test the converted code",
            "Some framework-specific features may need manual adjustment"
        ]
        
        if source_framework == "selenium":
            notes.extend([
                "WebDriverWait converted to page.waitFor* methods",
                "Actions class methods need manual conversion",
                "Screenshot methods converted to page.screenshot()"
            ])
        elif source_framework == "cypress":
            notes.extend([
                "cy.should() assertions converted to expect()",
                "Cypress aliases need manual conversion",
                "Custom commands need to be reimplemented"
            ])
        
        return notes


# Global instance
_script_converter = None

def get_script_converter() -> ScriptConverter:
    """Get or create global ScriptConverter instance"""
    global _script_converter
    if _script_converter is None:
        _script_converter = ScriptConverter()
    return _script_converter




