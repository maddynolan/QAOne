"""
Utility classes and functions for the Playwright Recorder API.
Contains PlaywrightScriptGenerator, TestCaseGenerator, and helper functions.
"""

import logging
import re
from typing import Dict, List, Any, Optional
from datetime import datetime

logger = logging.getLogger(__name__)


class PlaywrightScriptGenerator:
    """Python implementation of PlaywrightGenerator based on the JS version"""

    def __init__(self, options: Dict[str, Any] = None):
        self.options = {
            "includeComments": True,
            "generateAssertions": False,
            "language": "typescript",
            **({} if options is None else options)
        }

    def generate(self, actions: List[Dict[str, Any]], metadata: Dict[str, Any]) -> str:
        """Generate Playwright script from actions"""
        if not actions:
            return self._empty_script()

        # Extract start URL from metadata or first navigate action
        # BUT don't skip click actions that happen before navigation!
        start_url = metadata.get("startUrl") or metadata.get("start_url")
        navigate_idx_to_skip = -1  # Index of navigate action to skip (will be in page.goto)

        # Find the first navigate action with a valid URL
        for i, action in enumerate(actions):
            if action.get("type") == "navigate" and action.get("url"):
                url = action.get("url", "")
                if url and url != "about:blank":
                    # Use this as start URL if we don't have one
                    if not start_url or start_url == "about:blank":
                        start_url = url
                    # Mark this specific navigate action to skip (it becomes page.goto in setup)
                    navigate_idx_to_skip = i
                    break

        # Fallback: try to get URL from any action's url field
        if not start_url or start_url == "about:blank":
            for action in actions:
                if action.get("url") and action.get("url") != "about:blank":
                    start_url = action.get("url")
                    break

        # Final fallback
        if not start_url or start_url == "about:blank":
            start_url = "about:blank"

        # Filter actions: keep all EXCEPT the first navigate that becomes page.goto
        # This preserves clicks that happen BEFORE navigation (like "Get involved")
        actions_to_process = []
        for i, action in enumerate(actions):
            if i == navigate_idx_to_skip:
                continue  # Skip only this specific navigate action
            actions_to_process.append(action)

        metadata_with_url = {**metadata, "startUrl": start_url}

        script = self._generate_imports()
        script += self._generate_test_setup(metadata_with_url)
        script += self._generate_test_body(actions_to_process, metadata_with_url)
        script += self._generate_test_teardown()

        return self._format_script(script)

    def _empty_script(self) -> str:
        if self.options["language"] == "python":
            return "# No actions recorded\n"
        return "// No actions recorded\n"

    def _generate_imports(self) -> str:
        if self.options["language"] == "python":
            # For pytest-playwright, only import expect - page fixture is provided by conftest
            return "from playwright.sync_api import expect\n\n\n"
        return "import { test, expect } from '@playwright/test';\n\n"

    def _generate_test_setup(self, metadata: Dict[str, Any]) -> str:
        start_url = metadata.get("startUrl") or metadata.get("start_url") or "about:blank"
        title = metadata.get("title") or "Recorded Test"
        timestamp = metadata.get("timestamp") or datetime.now().isoformat()

        if self.options["language"] == "python":
            test_name = self._to_snake_case(title)
            # Use page fixture without type hint to avoid needing Page import
            script = f'def test_{test_name}(page):\n'
            if self.options["includeComments"]:
                script += f'    """\n    {title}\n    Recorded on: {timestamp}\n    Starting URL: {start_url}\n    """\n'
            script += f'    page.goto("{self._escape_string(start_url)}")\n'
            # Use domcontentloaded instead of networkidle - faster and less flaky
            script += '    page.wait_for_load_state("domcontentloaded")\n\n'
        else:
            script = f"test('{self._escape_string(title)}', async ({{ page }}) => {{\n"
            if self.options["includeComments"]:
                script += f"  // Recorded on: {timestamp}\n"
                script += f"  // Starting URL: {start_url}\n"
            script += f"  await page.goto('{self._escape_string(start_url)}');\n"
            script += "  await page.waitForLoadState('domcontentloaded');\n\n"

        return script

    def _generate_test_body(self, actions: List[Dict[str, Any]], metadata: Dict[str, Any] = None) -> str:
        body = ""
        previous_action = None
        is_python = self.options.get("language") == "python"
        metadata = metadata or {}

        # Pre-process: filter out redundant click actions before checkboxes
        filtered_actions = self._filter_redundant_label_clicks(actions)

        for i, action in enumerate(filtered_actions):
            # Skip redundant actions
            if self._is_redundant(action, previous_action):
                continue

            action_type = action.get("type", "")

            # Skip navigate actions that are just internal navigations (no URL change)
            # But don't skip if it's the first navigation or has a valid URL
            if action_type == "navigate":
                url = action.get("url", "")
                # Reconstruct URL from description if missing/blank
                if not url or url == "about:blank":
                    description = action.get("description", "")
                    path_match = re.search(r'/s?/[^\s]+', description)
                    if path_match:
                        path = path_match.group(0)
                        base_url = metadata.get("startUrl") or metadata.get("start_url") or ""
                        if base_url:
                            try:
                                from urllib.parse import urljoin, urlparse
                                parsed = urlparse(base_url)
                                base = f"{parsed.scheme}://{parsed.netloc}"
                                url = urljoin(base, path)
                            except Exception:
                                url = path
                        else:
                            url = path
                        action["url"] = url
                # If still no URL, skip only if this is not the first action
                if (not url or url == "about:blank") and i > 0:
                    continue

            # Try to build the best selector possible - PASS FULL ACTION
            selector = self._format_selector(action.get("selector"), action)

            # ALWAYS try to improve selector from description if available, especially for clicks
            # This ensures actions with text in description get proper selectors even if original selector is generic
            description = action.get("description", "")
            if description and action_type == "click":
                # Try to extract text from description - handle both single and double quotes
                # Pattern 1: "Click 'Text'" or "Click "Text"" - most common
                text_match = re.search(r'Click\s+["\']([^"\']+)["\']', description, re.IGNORECASE)
                if not text_match:
                    # Pattern 2: "Click Text" (no quotes, starts with capital)
                    text_match = re.search(r'Click\s+([A-Z][A-Za-z\s]+)', description, re.IGNORECASE)
                if not text_match:
                    # Pattern 3: More flexible - any text after Click (but skip generic words)
                    text_match = re.search(r'Click\s+([A-Za-z][A-Za-z\s]+)', description, re.IGNORECASE)

                if text_match:
                    text = text_match.group(1).strip()
                    # Clean up text (remove trailing quotes, dots, etc.)
                    text = text.rstrip('"\'.,;:')
                    # Skip generic words
                    generic_words = ["input", "button", "element", "field", "checkbox", "radio", "link", "text", "label", "span", "div", "select", "textarea"]
                    if text.lower() not in generic_words and len(text) > 1 and len(text) < 50:
                        input_type = action.get("inputType", "") or action.get("elementType", "")
                        tag_name = action.get("tagName", "").lower()

                        # For buttons, use getByRole
                        if tag_name == "button" or input_type == "button":
                            selector = f'get_by_role("button", name="{self._escape_string(text)}")' if is_python else f"getByRole('button', {{ name: '{self._escape_string(text)}' }})"
                        # For links, use getByRole
                        elif tag_name == "a":
                            selector = f'get_by_role("link", name="{self._escape_string(text)}")' if is_python else f"getByRole('link', {{ name: '{self._escape_string(text)}' }})"
                        # For other clicks, use getByText
                        else:
                            selector = f'get_by_text("{self._escape_string(text)}")' if is_python else f"getByText('{self._escape_string(text)}')"

            # If we still couldn't get a good selector, try to generate from description
            # Check if selector is generic/fallback (body, or fragile selector)
            is_fallback = selector in ['locator("body")', "locator('body')"] or self._is_fragile_selector(selector)

            if is_fallback:
                text = None
                # Try to extract text from description (quoted or unquoted)
                text_match = re.search(r'["\']([^"\']+)["\']', description)
                if not text_match:
                    text_match = re.search(r'(?:Click|Check|Fill|Select)\s+([A-Z][^"\']+)', description, re.IGNORECASE)
                if text_match:
                    candidate = text_match.group(1).strip().rstrip('"\'.,;:')
                    generic_words = ["input", "button", "element", "field", "checkbox", "radio", "link", "text", "label", "span", "div", "select", "textarea"]
                    if candidate.lower() not in generic_words and 1 < len(candidate) < 80:
                        text = candidate

                input_type = action.get("inputType", "") or action.get("elementType", "")
                tag_name = action.get("tagName", "").lower()

                if text:
                    if action_type in ["check", "uncheck"] or input_type in ["radio", "checkbox"]:
                        selector = f'get_by_label("{text}")' if is_python else f"getByLabel('{text}')"
                    elif action_type == "click" and (tag_name == "button" or input_type == "button"):
                        selector = f'get_by_role("button", name="{text}")' if is_python else f"getByRole('button', {{ name: '{text}' }})"
                    elif action_type == "click" and tag_name == "a":
                        selector = f'get_by_role("link", name="{text}")' if is_python else f"getByRole('link', {{ name: '{text}' }})"
                    elif action_type == "click":
                        selector = f'get_by_text("{text}")' if is_python else f"getByText('{text}')"
                    elif action_type in ["fill", "type", "input"]:
                        selector = f'get_by_label("{text}")' if is_python else f"getByLabel('{text}')"

                # If still fallback for check/uncheck, try name-based selector (most reliable for Salesforce)
                # Don't use innerText - it's often wrong or truncated for checkboxes
                if (action_type in ["check", "uncheck"] or input_type in ["radio", "checkbox"]) and (selector in ['locator("body")', "locator('body')"] or self._is_fragile_selector(selector)):
                    name_val = action.get("name")
                    value_val = action.get("value")

                    # For checkboxes/radios, prefer name-based selectors (stable Salesforce field names)
                    if name_val and value_val:
                        n = self._escape_string(name_val)
                        v = self._escape_string(value_val)
                        selector = f'locator("[name=\\"{n}\\"][value=\\"{v}\\"]").first' if is_python else f"locator('[name=\"{n}\"][value=\"{v}\"]').first"
                    elif name_val:
                        n = self._escape_string(name_val)
                        selector = f'locator("[name=\\"{n}\\"]").first' if is_python else f"locator('[name=\"{n}\"]').first"

                # Final guard: if still generic, handle based on action type
                if selector in ['locator("body")', "locator('body')"] or self._is_fragile_selector(selector):
                    # For FILL actions, "body" selector makes NO SENSE - skip the action
                    if action_type in ["fill", "type", "input"]:
                        if is_python:
                            body += f"    # SKIPPED: Cannot fill text into body element. Action: {description or action_type}\n"
                            body += f"    # Original value: {action.get('value', 'N/A')}\n"
                            body += f"    # TODO: Manually add the correct input selector\n"
                        else:
                            body += f"  // SKIPPED: Cannot fill text into body element. Action: {description or action_type}\n"
                            body += f"  // Original value: {action.get('value', 'N/A')}\n"
                            body += f"  // TODO: Manually add the correct input selector\n"
                        continue  # Skip this action entirely

                    # For other actions (click), keep the fallback comment
                    if is_python:
                        body += f"    # Fallback selector used; could not determine robust selector for: {description or action_type}\n"
                    else:
                        body += f"  // Fallback selector used; could not determine robust selector for: {description or action_type}\n"
                    selector = 'locator("body")' if is_python else "locator('body')"

            # Add comment
            if self.options["includeComments"] and action.get("description"):
                comment = action["description"]
                if is_python:
                    body += f"    # {comment}\n"
                else:
                    body += f"  // {comment}\n"

            # Update the action with the resolved selector for code generation
            action["_resolved_selector"] = selector

            # Generate action code
            body += self._generate_action_code(action)

            # Add wait if needed
            body += self._generate_wait_code(action)

            body += "\n"
            previous_action = action

        return body

    def _filter_redundant_label_clicks(self, actions: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Filter out redundant actions:
        1. Click actions that precede checkbox/radio check actions
        2. Hover actions that are followed by clicks on the same element

        In Salesforce LWC, clicking a checkbox triggers:
        1. Click on .slds-checkbox_faux (the visual element)
        2. Check on input[name="..."] (the actual input)

        We only want to keep ONE action - the check with good text-based selector.
        """
        filtered = []
        skip_indices = set()

        # FIRST PASS: Filter out hovers followed by clicks
        for i, action in enumerate(actions):
            action_type = action.get("type", "")

            # If this is a hover, check if followed by a click on same/similar element
            if action_type == "hover":
                hover_desc = action.get("description", "").lower()
                hover_text = ""
                text_match = re.search(r'["\']([^"\']+)["\']', hover_desc)
                if text_match:
                    hover_text = text_match.group(1).lower()

                # Look ahead for clicks within next 3 actions
                for j in range(i + 1, min(i + 4, len(actions))):
                    next_action = actions[j]
                    next_type = next_action.get("type", "")

                    if next_type == "click":
                        click_desc = next_action.get("description", "").lower()
                        click_text = ""
                        click_match = re.search(r'["\']([^"\']+)["\']', click_desc)
                        if click_match:
                            click_text = click_match.group(1).lower()

                        # If hover and click have similar text, skip the hover
                        if hover_text and click_text and (hover_text in click_text or click_text in hover_text):
                            skip_indices.add(i)
                            break

                        # If same selector, skip the hover
                        hover_sel = self._get_selector_string(action.get("selector", {}))
                        click_sel = self._get_selector_string(next_action.get("selector", {}))
                        if hover_sel and click_sel and hover_sel == click_sel:
                            skip_indices.add(i)
                            break

                        # If they happened within 2 seconds and on similar elements, skip hover
                        hover_time = action.get("timestamp", 0)
                        click_time = next_action.get("timestamp", 0)
                        if click_time - hover_time < 2000:
                            # Check if both are on links/buttons (hover shouldn't be recorded on these)
                            hover_tag = action.get("tagName", "").lower()
                            click_tag = next_action.get("tagName", "").lower()
                            if hover_tag in ["a", "button"] or click_tag in ["a", "button"]:
                                skip_indices.add(i)
                                break
                    elif next_type not in ["hover", "navigate"]:
                        # Found a different action type - stop looking
                        break

        # SECOND PASS: Process remaining actions
        for i, action in enumerate(actions):
            if i in skip_indices:
                continue

            action_type = action.get("type", "")

            # Get selector info for this action
            selector = action.get("selector", {})
            raw_sel = ""
            if isinstance(selector, str):
                raw_sel = selector
            elif isinstance(selector, dict):
                raw_sel = selector.get("selector") or selector.get("playwright") or selector.get("primary", {}).get("selector") or ""
            raw_sel = str(raw_sel).lower() if raw_sel else ""

            # Check if this is a click on SLDS faux elements (checkbox/radio visual elements)
            is_slds_faux_click = action_type == "click" and (
                ".slds-checkbox_faux" in raw_sel or
                ".slds-radio_faux" in raw_sel or
                "slds-checkbox_faux" in raw_sel or
                "slds-radio_faux" in raw_sel
            )

            # Check if this is a generic span/label click
            is_generic_click = action_type == "click" and (
                raw_sel in ["span", "label", "div", "input"] or
                action.get("tagName", "").lower() in ["span", "label"] and "Click span" in action.get("description", "")
            )

            # If this is a SLDS faux click or generic click, check if followed by check/uncheck
            if is_slds_faux_click or is_generic_click:
                # Look ahead for check/uncheck within next 2 actions
                for j in range(i + 1, min(i + 3, len(actions))):
                    next_action = actions[j]
                    next_type = next_action.get("type", "")

                    if next_type in ["check", "uncheck"]:
                        # Found a check action - skip this click
                        click_time = action.get("timestamp", 0)
                        check_time = next_action.get("timestamp", 0)

                        # Skip if within 2 seconds (generous for slow pages)
                        if check_time - click_time < 2000:
                            skip_indices.add(i)  # Skip the click
                            break
                    elif next_type == "click":
                        # Another click - might be another checkbox, continue looking
                        continue
                    else:
                        # Different action type - stop looking
                        break

            # Also check: click immediately followed by check on same element
            if action_type == "click" and i + 1 < len(actions):
                next_action = actions[i + 1]
                next_type = next_action.get("type", "")

                if next_type in ["check", "uncheck"]:
                    click_selector = self._get_selector_string(action.get("selector", {}))
                    check_selector = self._get_selector_string(next_action.get("selector", {}))

                    # If selectors match exactly, skip the click
                    if click_selector and check_selector and click_selector == check_selector:
                        click_time = action.get("timestamp", 0)
                        check_time = next_action.get("timestamp", 0)
                        if check_time - click_time < 1000:
                            skip_indices.add(i)

            if i not in skip_indices:
                filtered.append(action)

        return filtered

    def _get_selector_string(self, selector_data: Any) -> str:
        """Extract selector string for comparison"""
        if not selector_data:
            return ""
        if isinstance(selector_data, str):
            return selector_data
        if isinstance(selector_data, dict):
            return selector_data.get("selector") or selector_data.get("playwright") or selector_data.get("primary", {}).get("selector") or ""
        return ""

    def _generate_action_code(self, action: Dict[str, Any]) -> str:
        action_type = action.get("type", "")

        # Use pre-resolved selector if available, otherwise format from scratch
        selector = action.get("_resolved_selector") or self._format_selector(action.get("selector"), action)

        if self.options["language"] == "python":
            return self._generate_python_action(action_type, selector, action)
        else:
            return self._generate_typescript_action(action_type, selector, action)

    def _generate_typescript_action(self, action_type: str, selector: str, action: Dict[str, Any]) -> str:
        # GUARD: Never generate fill actions with body selector - it's always wrong
        if action_type in ["fill", "type", "input"]:
            if "locator('body')" in selector or selector.strip() == "locator('body').first":
                return f"  // SKIPPED: Cannot fill into body element. Value was: {action.get('value', 'N/A')}\n"

        if action_type == "click":
            # Wait for element to be visible before clicking
            # Use noWaitAfter to avoid navigation timeout issues (e.g., after login button click)
            return f"  await page.{selector}.waitFor({{ state: 'visible', timeout: 10000 }});\n  await page.{selector}.click({{ noWaitAfter: true }});\n"
        elif action_type in ["fill", "type", "input"]:
            value = action.get("value", "")
            return f"  await page.{selector}.waitFor({{ state: 'visible', timeout: 10000 }});\n  await page.{selector}.fill('{self._escape_string(value)}');\n"
        elif action_type == "select":
            label = action.get("label")
            value = action.get("value", "")
            if label:
                return f"  await page.{selector}.waitFor({{ state: 'visible', timeout: 10000 }});\n  await page.{selector}.selectOption({{ label: '{self._escape_string(label)}' }});\n"
            return f"  await page.{selector}.waitFor({{ state: 'visible', timeout: 10000 }});\n  await page.{selector}.selectOption('{self._escape_string(value)}');\n"
        elif action_type == "check":
            return f"  await page.{selector}.waitFor({{ state: 'visible', timeout: 10000 }});\n  await page.{selector}.check();\n"
        elif action_type == "uncheck":
            return f"  await page.{selector}.waitFor({{ state: 'visible', timeout: 10000 }});\n  await page.{selector}.uncheck();\n"
        elif action_type == "navigate":
            url = action.get("url", "")
            # Skip about:blank navigations
            if url and url != "about:blank":
                return f"  await page.goto('{self._escape_string(url)}');\n"
            return ""
        elif action_type == "press":
            key = action.get("key", "")
            return f"  await page.{selector}.press('{key}');\n"
        elif action_type == "hover":
            # Hover is non-blocking - skip if it fails
            return f"  try {{ await page.{selector}.hover(); }} catch (e) {{ console.log('Hover skipped:', e.message); }}\n"
        else:
            return f"  // Unhandled action: {action_type}\n"

    def _generate_python_action(self, action_type: str, selector: str, action: Dict[str, Any]) -> str:
        """
        Generate Python Playwright action code with Salesforce-optimized handling.
        For Salesforce LWC:
        - Uses force=True for checkbox/radio clicks (shadow DOM elements)
        - Adds proper waits for async component rendering
        - Handles combobox multi-step interactions
        """
        # Ensure selector uses Python syntax
        selector = self._convert_to_python_selector(selector)

        # GUARD: Never generate fill actions with body selector - it's always wrong
        if action_type in ["fill", "type", "input"]:
            if 'locator("body")' in selector or selector.strip() == 'locator("body").first':
                return f"    # SKIPPED: Cannot fill into body element. Value was: {action.get('value', 'N/A')}\n"

        # Detect Salesforce/LWC context
        tag_name = str(action.get("tagName", "")).lower()
        class_name = str(action.get("className", "") or action.get("class", "")).lower()
        app_key = (action.get("app") or action.get("appName") or "").lower()

        is_salesforce = (
            app_key.startswith("salesforce") or
            tag_name.startswith("lightning-") or
            "slds" in class_name or
            "aura" in class_name
        )

        selector_lower = selector.lower()
        selector_is_textlike = any(k in selector_lower for k in [
            "get_by_text", "get_by_role", "get_by_label",
            "get_by_placeholder", "get_by_test_id"
        ])

        # Check if this is a shadow DOM element that needs force click
        needs_force_click = is_salesforce and (
            selector_is_textlike or
            "lightning-radio-group" in selector_lower or
            "lightning-checkbox" in selector_lower or
            "slds-radio" in selector_lower or
            "slds-checkbox" in selector_lower or
            "slds-radio_faux" in selector_lower or
            "slds-checkbox_faux" in selector_lower
        )

        # Playwright Python locators auto-wait, but we add explicit wait for reliability
        # CRITICAL: Use no_wait_after=True to avoid navigation timeout issues (e.g., after login button click)
        if action_type == "click":
            # For Salesforce, add small delay for async rendering
            if is_salesforce:
                wait_code = f"    page.{selector}.wait_for(state=\"visible\", timeout=15000)\n"
                if needs_force_click:
                    return f"{wait_code}    page.{selector}.click(force=True, no_wait_after=True)\n"
                return f"{wait_code}    page.{selector}.click(no_wait_after=True)\n"
            return f"    page.{selector}.wait_for(state=\"visible\", timeout=10000)\n    page.{selector}.click(no_wait_after=True)\n"

        elif action_type in ["fill", "type", "input"]:
            value = action.get("value", "")
            # For Salesforce inputs, clear first then fill
            if is_salesforce and "lightning-input" in tag_name:
                return f"    page.{selector}.wait_for(state=\"visible\", timeout=15000)\n    page.{selector}.fill(\"{self._escape_string(value)}\")\n"
            return f"    page.{selector}.wait_for(state=\"visible\", timeout=10000)\n    page.{selector}.fill(\"{self._escape_string(value)}\")\n"

        elif action_type == "select":
            # For Salesforce combobox, it's a multi-step interaction:
            # 1. Click to open dropdown
            # 2. Wait for options
            # 3. Select option
            label = action.get("label")
            value = action.get("value", "")

            if is_salesforce and ("lightning-combobox" in tag_name or "combobox" in selector_lower):
                option_text = self._escape_string(label or value)
                return f"""    # Salesforce Combobox Selection
    page.{selector}.click(no_wait_after=True)
    page.wait_for_selector(".slds-listbox__option", timeout=10000)
    page.get_by_role("option", name="{option_text}").click(no_wait_after=True)
"""

            if label:
                return f"    page.{selector}.wait_for(state=\"visible\", timeout=10000)\n    page.{selector}.select_option(label=\"{self._escape_string(label)}\")\n"
            return f"    page.{selector}.wait_for(state=\"visible\", timeout=10000)\n    page.{selector}.select_option(\"{self._escape_string(value)}\")\n"

        elif action_type == "check":
            # For Salesforce/LWC: ALWAYS click the visible label/text, never use .check() on hidden inputs
            # The actual <input> is hidden inside shadow DOM

            # For Salesforce with name-based selectors, use the selector as-is with click(force=True)
            # Don't try to convert field names to labels - the mapping is unreliable
            # The name selector will find the checkbox, and force=True handles the hidden input
            if is_salesforce:
                # Add .first to handle multiple matches (common with radio groups)
                if '[name="' in selector and '.first' not in selector:
                    selector = selector.rstrip('")')  + '").first' if selector.endswith('")') else selector + '.first'
                return f"    page.{selector}.click(force=True, no_wait_after=True)\n"

            if needs_force_click:
                return f"    page.{selector}.click(force=True, no_wait_after=True)\n"

            # Standard checkbox check for non-Salesforce
            return f"    page.{selector}.check()\n"

        elif action_type == "uncheck":
            # For Salesforce/LWC: ALWAYS click the visible label/text
            if is_salesforce:
                # Add .first to handle multiple matches
                if '[name="' in selector and '.first' not in selector:
                    selector = selector.rstrip('")')  + '").first' if selector.endswith('")') else selector + '.first'
                return f"    page.{selector}.click(force=True)\n"

            if needs_force_click:
                return f"    page.{selector}.click(force=True)\n"

            # Standard uncheck for non-Salesforce
            return f"    page.{selector}.uncheck()\n"

        elif action_type == "navigate":
            url = action.get("url", "")
            # Skip about:blank navigations
            if url and url != "about:blank":
                if is_salesforce:
                    # Salesforce: Use domcontentloaded + wait for LWC components
                    # networkidle is BAD for Salesforce - constant background requests cause timeouts
                    return f"""    page.goto("{self._escape_string(url)}")
    page.wait_for_load_state("domcontentloaded")
    # Wait for Salesforce LWC components to render
    page.wait_for_timeout(1000)  # Brief wait for Aura/LWC initialization
"""
                return f"    page.goto(\"{self._escape_string(url)}\")\n"
            return ""

        elif action_type == "press":
            key = action.get("key", "")
            return f"    page.{selector}.press(\"{key}\")\n"

        elif action_type == "hover":
            # Hover is non-blocking - skip if it fails (wrapped in try/except)
            return f"""    try:
        page.{selector}.hover()
    except Exception as _hover_err:
        print(f"[SKIP] Hover failed: {{str(_hover_err)[:50]}}")
"""

        else:
            return f"    # Unhandled action: {action_type}\n"

    def _generate_wait_code(self, action: Dict[str, Any]) -> str:
        """
        Generate appropriate wait code after actions.

        For Salesforce LWC:
        - AVOID networkidle (constant background requests cause timeouts)
        - Use domcontentloaded + brief timeout for LWC initialization
        - Wait for specific elements when possible
        """
        wait_code = ""
        is_python = self.options["language"] == "python"

        # Detect Salesforce context
        tag_name = str(action.get("tagName", "")).lower()
        class_name = str(action.get("className", "") or action.get("class", "")).lower()
        app_key = (action.get("app") or action.get("appName") or "").lower()
        is_salesforce = (
            app_key.startswith("salesforce") or
            tag_name.startswith("lightning-") or
            "slds" in class_name
        )

        if action.get("type") == "navigate" or action.get("triggersNavigation"):
            if is_python:
                wait_code = "    page.wait_for_load_state(\"domcontentloaded\")\n"
            else:
                wait_code = "  await page.waitForLoadState('domcontentloaded');\n"
        elif action.get("mightTriggerChange"):
            # For Salesforce, add a small timeout for LWC re-rendering
            if is_salesforce:
                if is_python:
                    wait_code = "    page.wait_for_load_state(\"domcontentloaded\")\n"
                else:
                    wait_code = "  await page.waitForLoadState('domcontentloaded');\n"
            else:
                if is_python:
                    wait_code = "    page.wait_for_load_state(\"domcontentloaded\")\n"
                else:
                    wait_code = "  await page.waitForLoadState('domcontentloaded');\n"

        return wait_code

    def _generate_test_teardown(self) -> str:
        if self.options["language"] == "python":
            return ""
        return "});\n"

    def _format_selector(self, selector_data: Any, action: Dict[str, Any] = None) -> str:
        """Format selector for Playwright with improved fallback handling"""
        is_python = self.options.get("language") == "python"
        action = action or {}

        if not selector_data:
            # Try to build selector from action attributes
            better_sel = self._build_selector_from_action(action)
            if better_sel:
                return better_sel
            return "locator('body')" if not is_python else 'locator("body")'

        # If it's already a Playwright locator string
        if isinstance(selector_data, str):
            # Handle text-based selector from improved fallback
            if selector_data.startswith('text="') or selector_data.startswith("text='"):
                # Convert text="..." to getByText(...)
                text_match = re.match(r'text=["\']([^"\']+)["\']', selector_data)
                if text_match:
                    text = self._escape_string(text_match.group(1))
                    if is_python:
                        return f'get_by_text("{text}")'
                    return f"getByText('{text}')"

            # Check if it's a fragile selector
            if self._is_fragile_selector(selector_data):
                return "locator('body')" if not is_python else 'locator("body")'

            # Convert JavaScript Playwright syntax to Python if needed
            if is_python:
                selector_data = self._convert_to_python_selector(selector_data)

            if selector_data.startswith("page.") or "getBy" in selector_data or "get_by" in selector_data or "locator(" in selector_data:
                return selector_data.replace("page.", "")

            # Use proper quoting for Python
            if is_python:
                return self._format_python_locator(selector_data)
            return f"locator('{self._escape_string(selector_data)}')"

        # If it's a dict with selector data
        if isinstance(selector_data, dict):
            # First, try to use better selectors if available
            playwright_sel = selector_data.get("playwright", "")

            # Check if the primary selector is fragile
            is_fragile = False
            raw_selector = selector_data.get("selector", "")
            if self._is_fragile_selector(raw_selector) or self._is_fragile_selector(playwright_sel):
                is_fragile = True

            # Try fallback selectors first if primary is fragile
            if is_fragile:
                fallbacks = selector_data.get("fallbacks", [])
                for fb in fallbacks:
                    fb_playwright = fb.get("playwright", "")
                    fb_selector = fb.get("selector", "")
                    if fb_playwright and not self._is_fragile_selector(fb_playwright):
                        if is_python:
                            fb_playwright = self._convert_to_python_selector(fb_playwright)
                        if fb_playwright.startswith("page."):
                            return fb_playwright.replace("page.", "")
                        return fb_playwright
                    if fb_selector and not self._is_fragile_selector(fb_selector):
                        if is_python:
                            return self._format_python_locator(fb_selector)
                        return f"locator('{self._escape_string(fb_selector)}')"

                # Try to build a better selector from available data
                better_sel = self._build_better_selector(selector_data, action)
                if better_sel:
                    return better_sel

            # Use the playwright property if available and not fragile
            if playwright_sel and not self._is_fragile_selector(playwright_sel):
                if is_python:
                    playwright_sel = self._convert_to_python_selector(playwright_sel)
                if playwright_sel.startswith("page."):
                    return playwright_sel.replace("page.", "")
                return playwright_sel

            # Use raw selector if available and not fragile
            if raw_selector and not self._is_fragile_selector(raw_selector):
                if is_python:
                    return self._format_python_locator(raw_selector)
                return f"locator('{self._escape_string(raw_selector)}')"

            # Last resort - try to build from description or other data
            better_sel = self._build_better_selector(selector_data, action)
            if better_sel:
                return better_sel

        # Final attempt - try action attributes directly
        better_sel = self._build_selector_from_action(action)
        if better_sel:
            return better_sel

        return "locator('body')" if not is_python else 'locator("body")'

    def _is_fragile_selector(self, selector: str) -> bool:
        """Check if a selector is fragile and likely to break"""
        if not selector:
            return True

        # Normalize selector for comparison
        selector_lower = selector.strip().lower()

        # Single generic HTML tags that are too broad
        generic_tags = [
            'div', 'span', 'p', 'a', 'button', 'input', 'label',
            'li', 'ul', 'ol', 'table', 'tr', 'td', 'th', 'form',
            'section', 'article', 'header', 'footer', 'main', 'nav',
            'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'img', 'svg', 'i', 'b'
        ]

        # Check if selector is just a single generic tag
        if selector_lower in generic_tags:
            return True

        # SALESFORCE-SPECIFIC: These SLDS classes match MANY elements - NEVER use alone
        # .slds-checkbox_faux, .slds-radio_faux match ALL checkboxes/radios on page
        slds_fragile = [
            '.slds-checkbox_faux',
            '.slds-radio_faux',
            '.slds-checkbox',
            '.slds-radio',
            '.slds-button',
            '.slds-input',
            '.slds-form-element',
            'locator(".slds-checkbox_faux")',
            'locator(".slds-radio_faux")',
            "locator('.slds-checkbox_faux')",
            "locator('.slds-radio_faux')",
        ]

        for fragile in slds_fragile:
            if fragile in selector_lower:
                # Check if it has text filter - if so, it's OK
                if '.filter(' in selector_lower or 'hastext' in selector_lower or 'has_text' in selector_lower:
                    continue
                # Check if combined with getByText - OK
                if 'get_by_text' in selector_lower or 'getbytext' in selector_lower:
                    continue
                return True

        # Patterns that indicate fragile selectors
        fragile_patterns = [
            r':nth-of-type\(\d+\)',  # nth-of-type is position-dependent
            r':nth-child\(\d+\)',    # nth-child is position-dependent
            r'> span > label > span',  # Generic nested spans
            r'div:nth-of-type\(\d+\) >',  # Starts with position-dependent div
            r'^div > ',              # Starts with bare div
            r'^span > ',             # Starts with bare span
            r'^\s*$',                # Empty or whitespace
            r'// Visual locator',    # Visual locator comments (not real selectors)
            r'^locator\([\'"]?(div|span|input|button|label|p|a)[\'"]?\)$',  # locator with just a tag
        ]

        for pattern in fragile_patterns:
            if re.search(pattern, selector, re.IGNORECASE):
                return True

        return False

    def _convert_to_python_selector(self, selector: str) -> str:
        """Convert JavaScript Playwright selector syntax to Python"""
        # Convert getByText('...', { exact: true }) to get_by_text("...", exact=True)
        selector = re.sub(
            r"getByText\('([^']+)',\s*\{\s*exact:\s*true\s*\}\)",
            r'get_by_text("\1", exact=True)',
            selector
        )
        selector = re.sub(
            r'getByText\("([^"]+)",\s*\{\s*exact:\s*true\s*\}\)',
            r'get_by_text("\1", exact=True)',
            selector
        )

        # Convert getByRole('button', { name: '...' }) to get_by_role("button", name="...")
        selector = re.sub(
            r"getByRole\('([^']+)',\s*\{\s*name:\s*'([^']+)'\s*\}\)",
            r'get_by_role("\1", name="\2")',
            selector
        )
        selector = re.sub(
            r'getByRole\("([^"]+)",\s*\{\s*name:\s*"([^"]+)"\s*\}\)',
            r'get_by_role("\1", name="\2")',
            selector
        )

        # Convert basic getByText('...') to get_by_text("...")
        selector = re.sub(r"getByText\('([^']+)'\)", r'get_by_text("\1")', selector)
        selector = re.sub(r'getByText\("([^"]+)"\)', r'get_by_text("\1")', selector)

        # Convert getByLabel('...') to get_by_label("...")
        selector = re.sub(r"getByLabel\('([^']+)'\)", r'get_by_label("\1")', selector)
        selector = re.sub(r'getByLabel\("([^"]+)"\)', r'get_by_label("\1")', selector)

        # Convert getByRole('...') to get_by_role("...")
        selector = re.sub(r"getByRole\('([^']+)'\)", r'get_by_role("\1")', selector)
        selector = re.sub(r'getByRole\("([^"]+)"\)', r'get_by_role("\1")', selector)

        # Convert getByPlaceholder('...') to get_by_placeholder("...")
        selector = re.sub(r"getByPlaceholder\('([^']+)'\)", r'get_by_placeholder("\1")', selector)
        selector = re.sub(r'getByPlaceholder\("([^"]+)"\)', r'get_by_placeholder("\1")', selector)

        # Convert getByTestId('...') to get_by_test_id("...")
        selector = re.sub(r"getByTestId\('([^']+)'\)", r'get_by_test_id("\1")', selector)
        selector = re.sub(r'getByTestId\("([^"]+)"\)', r'get_by_test_id("\1")', selector)

        # Convert filter({ hasText: '...' }) to filter(has_text="...") for Python
        # This is critical - TypeScript uses { hasText: '...' } but Python uses has_text="..."
        # Handle the full filter syntax: .filter({ hasText: 'text' })
        def convert_filter(match):
            # Extract the text value - match group 1 should be the text
            text = match.group(1)
            # Escape quotes for Python string
            text = text.replace('\\"', '"').replace('"', '\\"')
            return f'.filter(has_text="{text}")'

        # Pattern 1: .filter({ hasText: 'text' }) with single quotes
        selector = re.sub(
            r"\.filter\(\s*\{\s*hasText:\s*'([^']+)'\s*\}\)",
            convert_filter,
            selector
        )
        # Pattern 2: .filter({ hasText: "text" }) with double quotes
        selector = re.sub(
            r'\.filter\(\s*\{\s*hasText:\s*"([^"]+)"\s*\}\)',
            convert_filter,
            selector
        )
        # Pattern 3: More flexible pattern that handles whitespace variations
        selector = re.sub(
            r"\.filter\(\s*\{\s*hasText\s*:\s*['\"]([^'\"]+)['\"]\s*\}\)",
            convert_filter,
            selector
        )

        # Convert locator('...') - handle quotes properly
        # If inner string contains double quotes, keep single quotes outside
        def fix_locator_quotes(match):
            inner = match.group(1)
            if '"' in inner:
                # Keep single quotes if inner has double quotes
                return f"locator('{inner}')"
            else:
                # Otherwise use double quotes
                return f'locator("{inner}")'

        selector = re.sub(r"locator\('([^']+)'\)", fix_locator_quotes, selector)

        return selector

    def is_dynamic(self, value: str) -> bool:
        """
        Check if a value appears to be dynamically generated (should be avoided as selector).
        Implements the DYNAMIC ID PATTERNS TO ALWAYS AVOID from Salesforce Locator Guide.
        """
        if not value:
            return True

        value_lower = value.lower()

        # Dynamic ID patterns that change on every page load/refresh
        dynamic_patterns = [
            # LWC component IDs - random hashes
            r'^lwc-[a-z0-9]+$',           # lwc-2nj244ovceg
            r'^lwc[a-z0-9]+$',            # lwc2nj244ovceg (no dash)

            # Radio/Checkbox/Input IDs with numbers
            r'^radio-\d+$',               # radio-51
            r'^radio-\d+-\d+$',           # radio-1-51
            r'^checkbox-\d+$',            # checkbox-23
            r'^checkbox-\d+-\d+$',        # checkbox-1-23
            r'^input-\d+$',               # input-42
            r'^input-\d+-\d+$',           # input-1-42

            # Pure numeric data-ids
            r'^\d+$',                      # 31, 1, etc.

            # Aura IDs
            r'^globalId;\d+$',            # globalId;123
            r'[a-z0-9]+:[a-z0-9]+',       # namespace:component format
        ]

        for pattern in dynamic_patterns:
            if re.match(pattern, value, re.IGNORECASE):
                return True

        # String patterns that indicate dynamic values
        dynamic_strings = [
            'ember',                       # Ember.js IDs
            'react-',                      # React IDs
            'ng-',                         # Angular IDs
            '_ngcontent',                  # Angular content
            'uuid',                        # UUIDs
            'guid',                        # GUIDs
            'data-aura-rendered-by',       # Aura rendering
            'css-',                        # CSS-in-JS
        ]

        for pattern in dynamic_strings:
            if pattern in value_lower:
                return True

        # Check for hash-like patterns (random alphanumeric strings)
        # e.g., xyz123abc, 2nj244ovceg
        if re.match(r'^[a-z0-9]{8,}$', value_lower) and not value.isdigit():
            # Looks like a hash if it's 8+ chars of mixed letters/numbers
            has_letters = any(c.isalpha() for c in value)
            has_numbers = any(c.isdigit() for c in value)
            if has_letters and has_numbers:
                return True

        return False

    def _build_salesforce_selector(self, combined: Dict[str, Any], action_type: str, input_type: str, tag_name: str) -> Optional[str]:
        """
        Build Salesforce-optimized selector following the Ultimate Salesforce Locator Priority:
        1. Text Content (buttons, links, options)
        2. Label Association (form fields)
        3. Name/Field Attribute (inputs)
        4. Accessibility Attributes
        5. Stable Data Attributes
        6. Class Names (SLDS classes only)
        7. AVOID: Dynamic IDs, numeric data-ids, lwc-* hashes
        """
        is_python = self.options.get("language") == "python"

        text_content = combined.get("innerText", "") or combined.get("textContent", "")
        aria_label = combined.get("ariaLabel") or combined.get("aria-label") or ""
        name_attr = combined.get("name") or ""
        value_attr = combined.get("value") or ""
        title_attr = combined.get("title") or ""
        role_attr = (combined.get("role") or "").lower()
        placeholder = combined.get("placeholder") or ""
        field_name = combined.get("field-name") or combined.get("fieldName") or ""
        data_field = combined.get("data-field") or combined.get("dataField") or ""
        class_name = combined.get("className") or combined.get("class") or ""

        # PRIORITY 1: Text Content (best for buttons, links, options)
        # But NOT for checkboxes/radios - their innerText is often wrong
        if text_content and 1 < len(text_content.strip()) <= 80:
            txt = self._escape_string(text_content.strip())

            # LWC Buttons
            if tag_name in ["button", "lightning-button"] or role_attr == "button":
                return f'get_by_role("button", name="{txt}")' if is_python else f"getByRole('button', {{ name: '{txt}' }})"

            # Navigation Menu Items / Links
            if tag_name in ["a", "lightning-navigation-item"] or role_attr == "link":
                return f'get_by_role("link", name="{txt}")' if is_python else f"getByRole('link', {{ name: '{txt}' }})"

            # Radio Button Groups - ONLY use text if from lightning-radio-group container
            if tag_name == "lightning-radio-group":
                return f'get_by_text("{txt}", exact=True)' if is_python else f"getByText('{txt}', {{ exact: true }})"

            # For check/uncheck on input elements, prefer name-based selector (see below)
            if action_type in ["check", "uncheck"] or input_type in ["radio", "checkbox"]:
                pass
            else:
                # Combobox Options
                if role_attr == "option" or tag_name == "lightning-base-combobox-item":
                    return f'get_by_role("option", name="{txt}")' if is_python else f"getByRole('option', {{ name: '{txt}' }})"

                # Modal Dialogs - buttons inside
                if role_attr == "dialog":
                    return f'get_by_role("dialog").get_by_role("button", name="{txt}")' if is_python else f"getByRole('dialog').getByRole('button', {{ name: '{txt}' }})"

                # Generic text-based selector (not for checkboxes)
                return f'get_by_text("{txt}", exact=True)' if is_python else f"getByText('{txt}', {{ exact: true }})"

        # PRIORITY 2: Label Association (best for form fields)
        if aria_label and 1 < len(aria_label.strip()) <= 100 and not self.is_dynamic(aria_label):
            lbl = self._escape_string(aria_label.strip())

            # Checkboxes
            if input_type == "checkbox" or tag_name == "lightning-input" and "checkbox" in class_name.lower():
                return f'get_by_label("{lbl}")' if is_python else f"getByLabel('{lbl}')"

            # Combobox / Dropdown
            if role_attr == "combobox" or tag_name == "lightning-combobox":
                return f'get_by_role("combobox", name="{lbl}")' if is_python else f"getByRole('combobox', {{ name: '{lbl}' }})"

            # Generic label
            return f'get_by_label("{lbl}")' if is_python else f"getByLabel('{lbl}')"

        # Placeholder (for lookup fields, inputs)
        if placeholder and 1 < len(placeholder.strip()) <= 100 and not self.is_dynamic(placeholder):
            ph = self._escape_string(placeholder.strip())
            return f'get_by_placeholder("{ph}")' if is_python else f"getByPlaceholder('{ph}')"

        # PRIORITY 3: Name/Field Attribute (stable API names)
        if field_name and not self.is_dynamic(field_name):
            fn = self._escape_string(field_name)
            if tag_name == "lightning-datepicker":
                return f'locator("lightning-datepicker[field-name=\\"{fn}\\"] input")' if is_python else f"locator('lightning-datepicker[field-name=\"{fn}\"] input')"
            return f'locator("[field-name=\\"{fn}\\"]")' if is_python else f"locator('[field-name=\"{fn}\"]')"

        if data_field and not self.is_dynamic(data_field):
            df = self._escape_string(data_field)
            return f'locator("[data-field=\\"{df}\\"]")' if is_python else f"locator('[data-field=\"{df}\"]')"

        if name_attr and not self.is_dynamic(name_attr):
            n = self._escape_string(name_attr)

            if tag_name == "lightning-input":
                return f'locator("lightning-input[name=\\"{n}\\"]").locator("input")' if is_python else f"locator('lightning-input[name=\"{n}\"]').locator('input')"

            if input_type == "radio":
                if value_attr and not self.is_dynamic(value_attr):
                    v = self._escape_string(value_attr)
                    return f'locator("input[value=\\"{v}\\"]").first' if is_python else f"locator('input[value=\"{v}\"]').first"
                return f'locator("[name=\\"{n}\\"]").first' if is_python else f"locator('[name=\"{n}\"]').first"

            if input_type == "checkbox":
                return f'locator("input[name=\\"{n}\\"]").first' if is_python else f"locator('input[name=\"{n}\"]').first"

            return f'locator("[name=\\"{n}\\"]")' if is_python else f"locator('[name=\"{n}\"]')"

        # PRIORITY 4: Accessibility Attributes
        if title_attr and not self.is_dynamic(title_attr):
            t = self._escape_string(title_attr)
            return f'locator("[title=\\"{t}\\"]")' if is_python else f"locator('[title=\"{t}\"]')"

        if role_attr and text_content and role_attr in ["button", "link", "dialog", "checkbox", "radio", "combobox", "option", "tab", "menuitem"]:
            txt = self._escape_string(text_content.strip())
            return f'get_by_role("{role_attr}", name="{txt}")' if is_python else f"getByRole('{role_attr}', {{ name: '{txt}' }})"

        # PRIORITY 5: Stable Data Attributes (Salesforce-specific)
        stable_attrs = [
            "data-target-selection-name",
            "data-record-id",
            "data-object-api-name",
            "data-testid",
            "data-automation-id",
            "data-row-key-value",
            "data-label",
        ]

        for attr in stable_attrs:
            val = combined.get(attr) or combined.get(attr.replace("-", "_"))
            if val and not self.is_dynamic(val):
                esc = self._escape_string(val)
                return f'locator("[{attr}=\\"{esc}\\"]")' if is_python else f"locator('[{attr}=\"{esc}\"]')"

        # PRIORITY 6: SLDS Class Names (use with caution, only stable ones)
        if class_name:
            stable_slds = [
                "slds-button_brand",
                "slds-button_destructive",
                "slds-button_neutral",
                "slds-button_success",
                "slds-input",
                "slds-checkbox",
                "slds-radio",
            ]
            for slds_class in stable_slds:
                if slds_class in class_name:
                    if text_content and len(text_content.strip()) > 1:
                        txt = self._escape_string(text_content.strip())
                        return f'locator(".{slds_class}").filter(has_text="{txt}")' if is_python else f"locator('.{slds_class}').filter({{ hasText: '{txt}' }})"

        if "slds-radio_faux" in class_name or "slds-checkbox_faux" in class_name:
            if text_content:
                txt = self._escape_string(text_content.strip())
                return f'get_by_text("{txt}", exact=True)' if is_python else f"getByText('{txt}', {{ exact: true }})"

        return None

    def _build_better_selector(self, selector_data: dict, action: Dict[str, Any] = None) -> Optional[str]:
        """Try to build a better selector from available data"""
        is_python = self.options.get("language") == "python"
        action = action or {}

        # Combine selector_data and action for attribute lookup
        combined = {}
        if isinstance(selector_data, dict):
            combined.update(selector_data)
        combined.update(action)

        elem_attrs = action.get("elementAttrs", {})
        if elem_attrs:
            combined.update(elem_attrs)

        action_type = combined.get("type", "")
        input_type = combined.get("inputType", "") or combined.get("elementType", "")
        tag_name = combined.get("tagName", "").lower()
        class_name = combined.get("className", "") or combined.get("class", "")

        # Try using data-testid first (most stable)
        test_id = combined.get("testId") or combined.get("data-testid")
        if test_id and not self.is_dynamic(test_id):
            if is_python:
                return f'get_by_test_id("{test_id}")'
            return f"getByTestId('{test_id}')"

        # Detect if this is Salesforce/LWC
        app_key = (combined.get("app") or combined.get("appKey") or combined.get("appName") or "").lower()
        is_salesforce = (
            app_key.startswith("salesforce") or
            tag_name.startswith("lightning-") or
            "slds" in class_name.lower() or
            "aura" in class_name.lower()
        )

        # SALESFORCE LWC - Apply comprehensive locator strategy
        if is_salesforce:
            sf_selector = self._build_salesforce_selector(combined, action_type, input_type, tag_name)
            if sf_selector:
                return sf_selector

        # For radio buttons and checkboxes, prioritize label/text-based selectors
        if input_type in ["radio", "checkbox"] or action_type in ["check", "uncheck"]:
            inner_text = combined.get("innerText", "") or combined.get("textContent", "")
            description = combined.get("description", "")
            aria_label = combined.get("ariaLabel") or combined.get("aria-label")
            name = combined.get("name")
            value = combined.get("value")

            candidates = []
            if inner_text and 1 < len(inner_text.strip()) < 100:
                candidates.append(inner_text.strip())
            if aria_label and 1 < len(aria_label.strip()) < 100:
                candidates.append(aria_label.strip())
            desc_match = re.search(r'"([^"]+)"', description or "")
            if desc_match:
                candidates.append(desc_match.group(1).strip())

            for cand in candidates:
                text = self._escape_string(cand)
                if is_python:
                    return f'get_by_text("{text}", exact=True)'
                return f"getByText('{text}', {{ exact: true }})"

            if name and value:
                escaped_value = self._escape_string(value)
                if is_python:
                    return f'locator("input[value=\\"{escaped_value}\\"]").first'
                return f"locator('input[value=\"{escaped_value}\"]').first"

            if name:
                escaped_name = self._escape_string(name)
                if is_python:
                    return f'locator("[name=\\"{escaped_name}\\"]").first'
                return f"locator('[name=\"{escaped_name}\"]').first"

        # Try using name attribute
        name = combined.get("name")
        if name:
            if input_type in ["radio", "checkbox"]:
                value = combined.get("value")
                if value:
                    escaped_name = self._escape_string(name)
                    escaped_value = self._escape_string(value)
                    if is_python:
                        return f'locator("[name=\\"{escaped_name}\\"][value=\\"{escaped_value}\\"]").first'
                    return f"locator('[name=\"{escaped_name}\"][value=\"{escaped_value}\"]').first"
                description = combined.get("description", "")
                text_match = re.search(r'"([^"]+)"', description)
                if text_match:
                    text = text_match.group(1)
                    if len(text) > 1 and len(text) < 50:
                        escaped_text = self._escape_string(text)
                        if is_python:
                            return f'get_by_label("{escaped_text}")'
                        return f"getByLabel('{escaped_text}')"
                inner_text = combined.get("innerText", combined.get("textContent", ""))
                if inner_text and len(inner_text.strip()) > 1 and len(inner_text.strip()) < 50:
                    text = self._escape_string(inner_text.strip())
                    if is_python:
                        return f'get_by_label("{text}")'
                    return f"getByLabel('{text}')"
                for_attr = combined.get("forAttr") or combined.get("for")
                if for_attr:
                    pass

                escaped_name = self._escape_string(name)
                if is_python:
                    return f'locator("[name=\\"{escaped_name}\\"]").first'
                return f"locator('[name=\"{escaped_name}\"]').first"
            else:
                escaped_name = self._escape_string(name)
                if is_python:
                    return f'locator("[name=\\"{escaped_name}\\"]")'
                return f"locator('[name=\"{escaped_name}\"]')"

        # Try using id attribute (avoid dynamic IDs)
        id_val = combined.get("id")
        if id_val:
            dynamic_patterns = [
                r"^radio-\d+$",
                r"^checkbox-\d+$",
                r"^input-\d+$",
                r"^radio-\d+-\d+$",
                r"^checkbox-\d+-\d+$",
            ]
            is_dynamic_id = False
            for pattern in dynamic_patterns:
                if isinstance(pattern, str) and pattern.startswith("^"):
                    if re.match(pattern, id_val, re.IGNORECASE):
                        is_dynamic_id = True
                        break
                elif isinstance(pattern, str):
                    if pattern in id_val.lower():
                        is_dynamic_id = True
                        break

            if not is_dynamic_id:
                other_dynamic = ["ember", "react-", "ng-", "_ngcontent", "uuid", "guid", ":"]
                for pattern in other_dynamic:
                    if pattern in id_val.lower():
                        is_dynamic_id = True
                        break

            if is_dynamic_id:
                description = combined.get("description", "")
                if description:
                    if action_type in ["check", "uncheck"] or input_type in ["radio", "checkbox"]:
                        text_match = re.search(r'"([^"]+)"', description)
                        if text_match:
                            text = text_match.group(1)
                            if len(text) > 1 and len(text) < 50:
                                escaped_text = self._escape_string(text)
                                if input_type == "checkbox":
                                    if is_python:
                                        return f'get_by_label("{escaped_text}")'
                                    return f"getByLabel('{escaped_text}')"
                                elif input_type == "radio":
                                    if is_python:
                                        return f'get_by_role("radio", name="{escaped_text}")'
                                    return f"getByRole('radio', {{ name: '{escaped_text}' }})"
                return None

            if is_python:
                return f'locator("#{id_val}")'
            return f"locator('#{id_val}')"

        # Try using aria-label
        aria_label = combined.get("ariaLabel") or combined.get("aria-label")
        if aria_label:
            label = self._escape_string(aria_label)
            if is_python:
                return f'get_by_label("{label}")'
            return f"getByLabel('{label}')"

        # Try using title attribute
        title = combined.get("title")
        if title:
            escaped_title = self._escape_string(title)
            if is_python:
                return f'locator("[title=\\"{escaped_title}\\"]")'
            return f"locator('[title=\"{escaped_title}\"]')"

        # Try role-based selector for buttons
        role = combined.get("role", "").lower()
        if role == "button" or tag_name == "button":
            btn_text = combined.get("innerText", combined.get("textContent", ""))
            if btn_text and len(btn_text.strip()) > 0 and len(btn_text.strip()) < 50:
                btn_text = self._escape_string(btn_text.strip())
                if is_python:
                    return f'get_by_role("button", name="{btn_text}")'
                return f"getByRole('button', {{ name: '{btn_text}' }})"

        # Try role-based selector for links
        if role == "link" or tag_name == "a":
            link_text = combined.get("innerText", combined.get("textContent", ""))
            if link_text and len(link_text.strip()) > 0 and len(link_text.strip()) < 50:
                link_text = self._escape_string(link_text.strip())
                if is_python:
                    return f'get_by_role("link", name="{link_text}")'
                return f"getByRole('link', {{ name: '{link_text}' }})"

        # Try using innerText for text-based selector
        inner_text = combined.get("innerText", combined.get("textContent", ""))
        if inner_text and len(inner_text.strip()) > 1 and len(inner_text.strip()) < 50:
            text = self._escape_string(inner_text.strip())
            if is_python:
                return f'get_by_text("{text}")'
            return f"getByText('{text}')"

        # Try to use description to build a text-based selector
        description = combined.get("description", "")

        text_match = re.search(r'"([^"]+)"', description)
        if text_match:
            text = text_match.group(1)
            if len(text) > 1 and len(text) < 50:
                escaped_text = self._escape_string(text)

                if input_type in ["radio", "checkbox"] or action_type in ["check", "uncheck"]:
                    if is_python:
                        return f'get_by_label("{escaped_text}")'
                    return f"getByLabel('{escaped_text}')"
                elif tag_name == "button" or role == "button":
                    if is_python:
                        return f'get_by_role("button", name="{escaped_text}")'
                    return f"getByRole('button', {{ name: '{escaped_text}' }})"
                else:
                    if is_python:
                        return f'get_by_text("{escaped_text}")'
                    return f"getByText('{escaped_text}')"

        # Try using innerText/textContent for links
        if tag_name == "a":
            text = combined.get("innerText", combined.get("textContent", ""))
            if text and len(text.strip()) > 0 and len(text.strip()) < 50:
                text = text.strip()
                if is_python:
                    return f'get_by_role("link", name="{self._escape_string(text)}")'
                return f"getByRole('link', {{ name: '{self._escape_string(text)}' }})"

        return None

    def _build_selector_from_action(self, action: Dict[str, Any]) -> Optional[str]:
        """Build selector directly from action's element attributes"""
        if not action:
            return None
        return self._build_better_selector({}, action)

    def _is_redundant(self, action: Dict[str, Any], previous: Optional[Dict[str, Any]]) -> bool:
        """Check if action is redundant (duplicate click within 100ms)"""
        if not previous:
            return False

        if action.get("type") == "click" and previous.get("type") == "click":
            if action.get("timestamp", 0) - previous.get("timestamp", 0) < 100:
                return action.get("selector") == previous.get("selector")

        return False

    def _format_script(self, script: str) -> str:
        """Clean up extra blank lines"""
        return re.sub(r'\n{3,}', '\n\n', script)

    def _escape_string(self, s: str) -> str:
        """Escape string for JavaScript/Python"""
        if not s:
            return ""
        return s.replace("\\", "\\\\").replace("'", "\\'").replace('"', '\\"').replace("\n", "\\n").replace("\r", "\\r")

    def _salesforce_field_to_label(self, field_name: str) -> str:
        """
        Convert Salesforce API field name to human-readable label.
        """
        if not field_name:
            return ""

        name = field_name.rstrip('__c').rstrip('__C')
        name = name.replace('_', ' ')
        name = re.sub(r'([a-z])([A-Z])', r'\1 \2', name)
        name = name.strip()
        if name:
            name = name[0].upper() + name[1:].lower()

        return name

    def _format_python_locator(self, selector: str) -> str:
        """Format a locator string for Python, handling quote escaping properly"""
        if not selector:
            return 'locator("body")'

        if '"' in selector and "'" not in selector:
            return f"locator('{selector}')"
        elif "'" in selector and '"' not in selector:
            return f'locator("{selector}")'
        elif '"' in selector and "'" in selector:
            escaped = selector.replace('"', '\\"')
            return f'locator("{escaped}")'
        else:
            return f"locator('{selector}')"

    def _to_snake_case(self, s: str) -> str:
        """Convert to snake_case for Python function names"""
        s = re.sub(r'[^a-zA-Z0-9]+', '_', s.lower())
        return re.sub(r'^_|_$', '', s)[:50]


class TestCaseGenerator:
    """Generate manual test cases in various formats"""

    def generate(self, actions: List[Dict[str, Any]], format_type: str, test_name: str, app_type: str) -> str:
        if format_type == "istqb":
            return self._generate_istqb(actions, test_name, app_type)
        elif format_type == "gherkin":
            return self._generate_gherkin(actions, test_name, app_type)
        elif format_type == "markdown":
            return self._generate_markdown(actions, test_name, app_type)
        else:
            return self._generate_markdown(actions, test_name, app_type)

    def _generate_istqb(self, actions: List[Dict[str, Any]], test_name: str, app_type: str) -> str:
        """Generate ISTQB format test case"""
        border = '\u2550' * 76
        tc_id = f"TC_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        # Pre-compute repeated characters for Python 3.9 f-string compatibility
        dbl_line_38 = '\u2550' * 38
        dbl_line_31 = '\u2550' * 31
        sgl_line_38 = '\u2500' * 38
        sgl_line_31 = '\u2500' * 31
        spaces_32 = ' ' * 32
        spaces_15 = ' ' * 15

        output = f"""
\u2554{border}\u2557
\u2551{'TEST CASE SPECIFICATION'.center(76)}\u2551
\u2560{border}\u2563
\u2551 Test Case ID    : {tc_id:<56}\u2551
\u2551 Title           : {test_name[:56]:<56}\u2551
\u2551 App Type        : {app_type:<56}\u2551
\u2551 Priority        : {'Medium':<56}\u2551
\u2551 Estimated Time  : {str(max(1, len(actions) // 4)) + ' minutes':<56}\u2551
\u2560{border}\u2563
\u2551 PRECONDITIONS                                                                \u2551
\u2560{border}\u2563
\u2551 1. Application is accessible and functional                                  \u2551
\u2551 2. User has valid credentials (if required)                                  \u2551
\u2551 3. Test environment is stable                                                \u2551
\u2560{border}\u2563
\u2551 TEST STEPS                                                                   \u2551
\u2560\u2550\u2550\u2550\u2550\u2550\u2566{dbl_line_38}\u2566{dbl_line_31}\u2563
\u2551 #   \u2551 ACTION{spaces_32}\u2551 EXPECTED RESULT{spaces_15}\u2551
\u2560\u2550\u2550\u2550\u2550\u2550\u256c{sgl_line_38}\u256c{sgl_line_31}\u2563
"""

        for i, action in enumerate(actions):
            action_text = self._format_action_text(action)[:36].ljust(36)
            expected = self._format_expected_result(action)[:29].ljust(29)
            output += f"\u2551 {str(i + 1).ljust(3)} \u2551 {action_text} \u2551 {expected} \u2551\n"

        output += f"""\u2560\u2550\u2550\u2550\u2550\u2550\u2569{dbl_line_38}\u2569{dbl_line_31}\u2563
\u2551 POSTCONDITIONS                                                               \u2551
\u2560{border}\u2563
\u2551 1. System returns to stable state                                            \u2551
\u2551 2. No error messages displayed                                               \u2551
\u2551 3. Data integrity maintained                                                 \u2551
\u255a{border}\u255d
"""
        return output

    def _generate_gherkin(self, actions: List[Dict[str, Any]], test_name: str, app_type: str) -> str:
        """Generate Gherkin/Cucumber format test case"""
        feature_name = test_name.replace('-', ' ').replace('_', ' ')

        output = f"""@automated @{app_type.replace('-', '_')}
Feature: {feature_name}
  As a user
  I want to complete the workflow
  So that I can achieve my goal

  Background:
    Given the application is accessible
    And all prerequisites are met

  @smoke @e2e
  Scenario: {test_name}
"""

        is_first = True
        for action in actions:
            if action.get("type") == "navigate" and not is_first:
                continue

            if action.get("type") == "navigate":
                keyword = "Given"
            else:
                keyword = "When" if is_first else "And"
                is_first = False

            step = self._format_gherkin_step(action)
            output += f"    {keyword} {step}\n"

        output += f"""
  # Step Definitions Reference (pytest-bdd or behave)
  # This scenario was auto-generated from recorded actions
  # Review and adjust steps as needed for your test framework
"""
        return output

    def _generate_markdown(self, actions: List[Dict[str, Any]], test_name: str, app_type: str) -> str:
        """Generate Markdown format test case"""
        tc_id = f"TC_{datetime.now().strftime('%Y%m%d_%H%M%S')}"

        output = f"""# Test Case: {test_name}

## Overview

| Property | Value |
|----------|-------|
| **Test ID** | {tc_id} |
| **App Type** | {app_type} |
| **Generated** | {datetime.now().isoformat()} |
| **Steps** | {len(actions)} |

## Preconditions

- Application is accessible
- User has required permissions
- Test environment is stable

## Test Steps

| # | Action | Test Data | Expected Result |
|---|--------|-----------|-----------------|
"""

        for i, action in enumerate(actions):
            action_text = self._format_action_text(action)
            data = action.get("value", "-") or "-"
            expected = self._format_expected_result(action)
            output += f"| {i + 1} | {action_text} | {data} | {expected} |\n"

        output += f"""
## Postconditions

- System returns to stable state
- No error messages displayed
- Data integrity maintained

## Automation Notes

- This test case was auto-generated from browser recording
- Review and adjust expected results for your specific requirements
- Add assertions as needed for validation
"""
        return output

    def _extract_text_from_description(self, description: str) -> str:
        """Extract meaningful text from action description"""
        match = re.search(r'["\']([^"\']+)["\']', description)
        if match:
            return match.group(1)
        for prefix in ['Click ', 'Check ', 'Select ', 'Enter ', 'Fill ', 'Hover ', 'Navigate to ']:
            if description.startswith(prefix):
                return description[len(prefix):].strip()
        return description

    def _extract_element_name(self, action: Dict[str, Any]) -> str:
        """Extract element name from action for better descriptions"""
        description = action.get("description", "")
        if description:
            text = self._extract_text_from_description(description)
            if text and text.lower() not in ['span', 'input', 'element', 'button', 'link']:
                return text

        inner_text = action.get("innerText", "")
        if inner_text and len(inner_text) < 50:
            return inner_text.strip()

        aria_label = action.get("ariaLabel") or action.get("aria-label", "")
        if aria_label:
            return aria_label

        name = action.get("name", "")
        if name:
            readable = name.replace('__c', '').replace('_', ' ').title()
            return readable

        placeholder = action.get("placeholder", "")
        if placeholder:
            return placeholder

        title = action.get("title", "")
        if title:
            return title

        return ""

    def _format_action_text(self, action: Dict[str, Any]) -> str:
        action_type = action.get("type", "")
        element_name = self._extract_element_name(action)
        url = action.get("url", "")

        if action_type == "navigate":
            if url:
                from urllib.parse import urlparse
                parsed = urlparse(url)
                path = parsed.path or "home page"
                return f'Navigate to "{path}"'
            return "Navigate to page"

        elif action_type == "click":
            if element_name:
                return f'Click "{element_name[:40]}"'
            tag = action.get("tagName", "").lower()
            if tag == "button":
                return "Click button"
            elif tag == "a":
                return "Click link"
            return "Click element"

        elif action_type in ["fill", "type", "input"]:
            value = action.get("value", "")
            if element_name:
                return f'Enter value in "{element_name[:30]}"'
            elif value:
                display_val = value[:20] + "..." if len(value) > 20 else value
                return f'Enter "{display_val}"'
            return "Enter text in field"

        elif action_type == "check":
            if element_name:
                return f'Check "{element_name[:40]}"'
            return "Check checkbox/radio"

        elif action_type == "uncheck":
            if element_name:
                return f'Uncheck "{element_name[:40]}"'
            return "Uncheck checkbox"

        elif action_type == "select":
            value = action.get("value", "") or action.get("label", "")
            if value:
                return f'Select "{value[:30]}"'
            return "Select option from dropdown"

        elif action_type == "hover":
            if element_name:
                return f'Hover over "{element_name[:40]}"'
            return "Hover over element"

        elif action_type == "press":
            key = action.get("key", "")
            return f"Press {key} key"

        elif action_type == "upload":
            files = action.get("files", "")
            if files:
                return f'Upload file(s): {files[:30]}'
            return "Upload file"

        elif action_type == "drag":
            return "Drag element"

        else:
            return action_type.capitalize() if action_type else "Action"

    def _format_expected_result(self, action: Dict[str, Any]) -> str:
        action_type = action.get("type", "")
        element_name = self._extract_element_name(action)
        url = action.get("url", "")

        if action_type == "navigate":
            if url:
                from urllib.parse import urlparse
                parsed = urlparse(url)
                return f'Page "{parsed.path or "/"}" loads'
            return "Page loads successfully"

        elif action_type == "click":
            tag = action.get("tagName", "").lower()
            triggers_nav = action.get("triggersNavigation", False)

            if triggers_nav:
                return "Navigation occurs"
            elif tag == "button":
                if element_name and "next" in element_name.lower():
                    return "Proceeds to next step"
                elif element_name and "submit" in element_name.lower():
                    return "Form is submitted"
                return "Button action completes"
            elif tag == "a":
                return "Link navigation occurs"
            elif element_name:
                return f'"{element_name[:25]}" responds'
            return "Click action completes"

        elif action_type in ["fill", "type", "input"]:
            value = action.get("value", "")
            if element_name:
                return f'"{element_name[:20]}" shows "{value[:15]}"' if value else f'"{element_name[:25]}" accepts input'
            return f'Field shows "{value[:20]}"' if value else "Field accepts input"

        elif action_type == "check":
            if element_name:
                return f'"{element_name[:30]}" is checked'
            return "Checkbox/radio is selected"

        elif action_type == "uncheck":
            if element_name:
                return f'"{element_name[:30]}" is unchecked'
            return "Checkbox is deselected"

        elif action_type == "select":
            value = action.get("value", "") or action.get("label", "")
            if value:
                return f'"{value[:25]}" is selected'
            return "Option is selected"

        elif action_type == "hover":
            return "Tooltip/menu appears (if any)"

        elif action_type == "press":
            key = action.get("key", "")
            if key == "Enter":
                return "Form submits / action triggers"
            elif key == "Escape":
                return "Modal/popup closes"
            elif key == "Tab":
                return "Focus moves to next field"
            return f"{key} action completes"

        elif action_type == "upload":
            return "File is uploaded successfully"

        elif action_type == "drag":
            return "Element is moved to target"

        else:
            return "Action completes successfully"

    def _format_gherkin_step(self, action: Dict[str, Any]) -> str:
        action_type = action.get("type", "")
        description = action.get("description", "")

        if action_type == "navigate":
            return "I am on the application page"
        elif action_type == "click":
            text = description.replace('Click "', '').replace('"', '')[:30] if description.startswith('Click') else "the element"
            return f'I click on "{text}"'
        elif action_type in ["fill", "type", "input"]:
            value = action.get("value", "value")
            return f'I enter "{value}" in the input field'
        elif action_type == "check":
            text = description.replace('Check "', '').replace('"', '')[:30] if description.startswith('Check') else "option"
            return f'I select the "{text}"'
        elif action_type == "uncheck":
            return "I deselect the option"
        elif action_type == "select":
            value = action.get("value", "value")
            return f'I choose "{value}" from the dropdown'
        elif action_type == "press":
            key = action.get("key", "key")
            return f'I press the "{key}" key'
        else:
            return f"I perform {action_type} action"


def _sanitize_test_name(name: str) -> str:
    """
    Sanitize test name to be a valid Python/TypeScript identifier.
    Removes special characters like /, :, ,, - and converts to snake_case.
    """
    if not name:
        return "recorded_test"
    # Replace all non-alphanumeric characters with underscores
    sanitized = re.sub(r'[^a-zA-Z0-9]+', '_', name.lower())
    # Remove leading/trailing underscores and limit length
    sanitized = re.sub(r'^_+|_+$', '', sanitized)[:50]
    return sanitized or "recorded_test"


def _map_action_to_node_type(action_type: str) -> str:
    """Map action type to workflow node type"""
    mapping = {
        "navigate": "navigate",
        "click": "click",
        "fill": "input",
        "type": "input",
        "input": "input",
        "check": "click",
        "uncheck": "click",
        "select": "input",
        "hover": "click",
        "wait": "wait",
        "assert": "assert",
        "scroll": "click",
        "upload": "input",
        "drag": "click",
    }
    return mapping.get(action_type, "click")


def _map_node_type_to_action(node_type: str) -> str:
    """Map workflow node type to action type"""
    mapping = {
        "navigate": "navigate",
        "click": "click",
        "input": "fill",
        "wait": "wait",
        "assert": "assert",
        "condition": "click",
        "loop": "click",
    }
    return mapping.get(node_type, "click")


def _extract_selector_string(action: Dict[str, Any]) -> str:
    """Extract selector string from action"""
    selector = action.get("selector", {})
    if isinstance(selector, str):
        return selector
    if isinstance(selector, dict):
        return selector.get("selector") or selector.get("playwright", "")
    return ""
