"""
DOM Recorder Service - Records DOM snapshots and user interactions
Phase 2.2: Automation Agent Enhancement
"""

import logging
from typing import Dict, List, Any, Optional
from datetime import datetime
from uuid import uuid4
import json

logger = logging.getLogger(__name__)


class DOMRecorder:
    """
    Service for recording DOM snapshots and user interactions
    Used for test generation from recordings
    """
    
    def __init__(self):
        pass
    
    def parse_recording(self, recording_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Parse a recording from browser extension or Playwright
        Expected format:
        {
            "url": "...",
            "title": "...",
            "snapshots": [
                {
                    "timestamp": 1234567890,
                    "dom": "...",
                    "screenshot": "base64...",
                    "interactions": [
                        {"type": "click", "selector": "...", "timestamp": 1234567890},
                        {"type": "type", "selector": "...", "value": "...", "timestamp": 1234567891}
                    ]
                }
            ],
            "metadata": {
                "browser": "chrome",
                "viewport": {"width": 1920, "height": 1080}
            }
        }
        """
        return {
            "recording_id": str(uuid4()),
            "url": recording_data.get("url", ""),
            "title": recording_data.get("title", ""),
            "snapshots": recording_data.get("snapshots", []),
            "metadata": recording_data.get("metadata", {}),
            "created_at": datetime.utcnow().isoformat(),
            "parsed_at": datetime.utcnow().isoformat()
        }
    
    def extract_test_steps(self, recording: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Extract test steps from a recording"""
        steps = []
        
        for snapshot in recording.get("snapshots", []):
            for interaction in snapshot.get("interactions", []):
                step = {
                    "action": interaction.get("type", "unknown"),
                    "selector": interaction.get("selector", ""),
                    "value": interaction.get("value", ""),
                    "timestamp": interaction.get("timestamp", 0),
                    "expected_result": self._infer_expected_result(interaction)
                }
                steps.append(step)
        
        return steps
    
    def _infer_expected_result(self, interaction: Dict[str, Any]) -> str:
        """Infer expected result from interaction"""
        interaction_type = interaction.get("type", "")
        
        if interaction_type == "click":
            return "Element is clicked and action is triggered"
        elif interaction_type == "type":
            return f"Text '{interaction.get('value', '')}' is entered into field"
        elif interaction_type == "navigate":
            return f"Page navigates to {interaction.get('url', '')}"
        elif interaction_type == "select":
            return f"Option '{interaction.get('value', '')}' is selected"
        else:
            return "Action completes successfully"
    
    def _generate_from_template(self, recording: Dict[str, Any]) -> str:
        """
        Generate Playwright code using deterministic templates (no LLM).
        Template-based generation for 80-90% of cases.
        """
        steps = self.extract_test_steps(recording)
        title = recording.get('title', 'Recorded Test')
        url = recording.get('url', '')
        
        code_lines = [
            "import { test, expect } from '@playwright/test';",
            "",
            f"test('{title}', async ({{ page }}) => {{"
        ]
        
        # Add navigation if URL available
        if url:
            code_lines.append(f"  await page.goto('{url}');")
            code_lines.append("")
        
        # Generate code for each step using templates
        for i, step in enumerate(steps, 1):
            action = step.get('action', '')
            selector = step.get('selector', '')
            value = step.get('value', '')
            expected = step.get('expected_result', '')
            
            code_lines.append(f"  // Step {i}: {action}")
            
            # Template-based code generation
            if action == 'click':
                if selector:
                    locator = self._build_robust_locator(selector)
                    code_lines.append(f"  await page.locator('{locator}').click();")
            
            elif action == 'type' or action == 'input':
                if selector:
                    locator = self._build_robust_locator(selector)
                    if value:
                        # Check if parameterized
                        if value.startswith('{{') and value.endswith('}}'):
                            code_lines.append(f"  await page.locator('{locator}').fill({value});")
                        else:
                            code_lines.append(f"  await page.locator('{locator}').fill('{value}');")
                    else:
                        code_lines.append(f"  await page.locator('{locator}').fill('{{{{test_data.value}}}}');")
            
            elif action == 'submit':
                if selector:
                    locator = self._build_robust_locator(selector)
                    code_lines.append(f"  await page.locator('{locator}').press('Enter');")
                else:
                    code_lines.append("  await page.keyboard.press('Enter');")
            
            elif action == 'select':
                if selector and value:
                    locator = self._build_robust_locator(selector)
                    code_lines.append(f"  await page.locator('{locator}').selectOption('{value}');")
            
            elif action == 'navigate':
                if value or selector:
                    url_to_nav = value or selector
                    code_lines.append(f"  await page.goto('{url_to_nav}');")
            
            # Add assertion if expected result mentions navigation
            if 'navigate' in expected.lower() or 'redirect' in expected.lower():
                # Try to extract URL from expected result
                import re
                url_match = re.search(r'to\s+([^\s]+)', expected, re.I)
                if url_match:
                    url_pattern = url_match.group(1)
                    code_lines.append(f"  await expect(page).toHaveURL(/.*{re.escape(url_pattern)}.*/);")
            
            code_lines.append("")
        
        code_lines.append("});")
        
        return "\n".join(code_lines)
    
    def _build_robust_locator(self, selector: str) -> str:
        """
        Build robust locator using selector strategy.
        Priority: data-test-id > aria-label > id > name > class > text > xpath
        """
        # If already a good selector, use it
        if selector.startswith("[data-test-id=") or selector.startswith("#") or selector.startswith("."):
            return selector
        
        # Try to improve selector
        import re
        if "data-test-id" in selector:
            match = re.search(r'data-test-id=["\']([^"\']+)["\']', selector)
            if match:
                return f"[data-test-id='{match.group(1)}']"
        
        # Check for aria-label
        if "aria-label" in selector:
            match = re.search(r'aria-label=["\']([^"\']+)["\']', selector)
            if match:
                return f"[aria-label='{match.group(1)}']"
        
        # Check for id
        if "id=" in selector:
            match = re.search(r'id=["\']([^"\']+)["\']', selector)
            if match:
                return f"#{match.group(1)}"
        
        return selector
    
    def generate_playwright_code(self, recording: Dict[str, Any], use_template: bool = True) -> str:
        """
        Generate Playwright test code from recording.
        
        Args:
            recording: Recording data
            use_template: If True, use deterministic template-based generation (faster, no LLM)
                         If False, use existing logic
        """
        if use_template:
            return self._generate_from_template(recording)
        
        # Original LLM-based generation (fallback)
        steps = self.extract_test_steps(recording)
        
        code_lines = [
            "import { test, expect } from '@playwright/test';",
            "",
            f"test('{recording.get('title', 'Recorded Test')}', async ({ page }) => {{"
        ]
        
        # Add navigation
        if recording.get("url"):
            code_lines.append(f"  await page.goto('{recording['url']}');")
        
        # Add steps
        for step in steps:
            action = step.get("action", "")
            selector = step.get("selector", "")
            value = step.get("value", "")
            
            if action == "click":
                code_lines.append(f"  await page.click('{selector}');")
            elif action == "type":
                code_lines.append(f"  await page.fill('{selector}', '{value}');")
            elif action == "select":
                code_lines.append(f"  await page.selectOption('{selector}', '{value}');")
            elif action == "navigate":
                code_lines.append(f"  await page.goto('{value}');")
        
        code_lines.append("});")
        
        return "\n".join(code_lines)

