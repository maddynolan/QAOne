"""
Enhanced Playwright Script Generator with Enterprise Features

Phase 1: Reliability
- Self-Healing Locators - fallback selectors when primary fails
- Smart Waits - wait for spinners/loading to complete
- Screenshot on Failure - capture state when test fails
- Better Error Messages - show which step failed and why

Phase 2: Enhanced Recording
- Assertion Generation - auto-generate expect() statements
- Hover Actions - record tooltip/menu triggers
- Drag & Drop - record drag actions
- File Upload - handle file input elements

Phase 3: Enterprise Features
- Page Object Model - generate POM classes from recording
- Data-Driven Tests - parameterize recorded values
- Visual Regression - screenshot comparison
- Cross-Browser Config - Chrome, Firefox, Safari, Edge
"""

import logging
import json
import re
from typing import Dict, List, Any, Optional, Tuple
from datetime import datetime

logger = logging.getLogger(__name__)


class EnhancedScriptGenerator:
    """Enhanced script generator with self-healing, smart waits, and enterprise features"""
    
    def __init__(self, options: Dict[str, Any] = None):
        self.options = {
            "language": "python",
            "includeComments": True,
            "selfHealing": True,
            "smartWaits": True,
            "screenshotOnFailure": True,
            "generateAssertions": True,
            "pageObjectModel": False,
            "dataDriven": False,
            "visualRegression": False,
            "crossBrowser": False,
            **(options or {})
        }
    
    def generate(self, actions: List[Dict[str, Any]], metadata: Dict[str, Any] = None) -> Dict[str, Any]:
        """
        Generate enhanced Playwright script with all features.
        
        Returns:
            Dict with 'script', 'page_objects', 'test_data', etc.
        """
        metadata = metadata or {}
        
        logger.info(f"[EnhancedGenerator] Starting generation with {len(actions)} actions")
        logger.debug(f"[EnhancedGenerator] Options: {self.options}")
        
        # Extract start URL
        start_url = self._extract_start_url(actions, metadata)
        logger.info(f"[EnhancedGenerator] Start URL: {start_url}")
        
        result = {
            "script": "",
            "page_objects": {},
            "test_data": [],
            "config": {},
            "metadata": {
                "generated_at": datetime.now().isoformat(),
                "action_count": len(actions),
                "features": list(k for k, v in self.options.items() if v),
            }
        }
        
        # Generate main test script
        result["script"] = self._generate_script(actions, start_url, metadata)
        
        # Generate Page Object Model if enabled
        if self.options["pageObjectModel"]:
            result["page_objects"] = self._generate_page_objects(actions, metadata)
        
        # Generate test data for data-driven tests
        if self.options["dataDriven"]:
            result["test_data"] = self._generate_test_data(actions)
        
        # Generate cross-browser config
        if self.options["crossBrowser"]:
            result["config"] = self._generate_cross_browser_config()
        
        return result
    
    def _extract_start_url(self, actions: List[Dict[str, Any]], metadata: Dict[str, Any]) -> str:
        """Extract the starting URL from actions or metadata"""
        # Try metadata first
        start_url = metadata.get("startUrl") or metadata.get("start_url")
        
        # Look for first navigate action
        if not start_url or start_url == "about:blank":
            for action in actions:
                if action.get("type") == "navigate":
                    url = action.get("url", "")
                    if url and url != "about:blank":
                        start_url = url
                        break
        
        return start_url or "about:blank"
    
    def _generate_script(self, actions: List[Dict[str, Any]], start_url: str, metadata: Dict[str, Any]) -> str:
        """Generate the main test script with all enhancements"""
        lang = self.options.get("language", "python").lower()
        # Handle both legacy names (python, typescript) and new names (playwright-python, playwright-typescript)
        is_python = lang in ("python", "playwright-python")
        
        if is_python:
            return self._generate_python_script(actions, start_url, metadata)
        else:
            return self._generate_typescript_script(actions, start_url, metadata)
    
    def _generate_python_script(self, actions: List[Dict[str, Any]], start_url: str, metadata: Dict[str, Any]) -> str:
        """Generate enhanced Python Playwright script"""
        script = []
        
        # Imports
        script.append("import pytest")
        script.append("from playwright.sync_api import Page, expect")
        script.append("import os")
        script.append("from datetime import datetime")
        script.append("")
        
        # Helper functions for self-healing
        if self.options["selfHealing"]:
            script.append(self._generate_self_healing_helpers_python())
        
        # Helper functions for smart waits
        if self.options["smartWaits"]:
            script.append(self._generate_smart_wait_helpers_python())
        
        # Helper for screenshots
        if self.options["screenshotOnFailure"]:
            script.append(self._generate_screenshot_helper_python())
        
        # Test function
        test_name = self._to_snake_case(metadata.get("title", "recorded_test"))
        script.append(f"")
        script.append(f"def test_{test_name}(page: Page):")
        script.append(f'    """')
        script.append(f'    {metadata.get("title", "Recorded Test")}')
        script.append(f'    Generated: {datetime.now().isoformat()}')
        script.append(f'    URL: {start_url}')
        script.append(f'    """')
        script.append(f'    # Test setup')
        script.append(f'    errors = []')
        script.append(f'    screenshot_dir = "screenshots"')
        script.append(f'    os.makedirs(screenshot_dir, exist_ok=True)')
        script.append(f'    ')
        
        # Navigate to start URL
        script.append(f'    # Navigate to starting URL')
        script.append(f'    page.goto("{self._escape_string(start_url)}")')
        
        if self.options["smartWaits"]:
            script.append(f'    wait_for_page_ready(page)')
        else:
            script.append(f'    page.wait_for_load_state("domcontentloaded")')
        
        script.append(f'    ')
        
        # Process actions
        navigate_idx = self._find_first_navigate_idx(actions)
        actions_to_process = [a for i, a in enumerate(actions) if i != navigate_idx]
        
        logger.info(f"[EnhancedGenerator] Processing {len(actions_to_process)} actions (skipped navigate at idx {navigate_idx})")
        
        for i, action in enumerate(actions_to_process):
            step_num = i + 1
            action_type = action.get("type", "unknown")
            logger.debug(f"[EnhancedGenerator] Processing step {step_num}: {action_type} - {action.get('description', '')[:50]}")
            action_code = self._generate_python_action_enhanced(action, step_num)
            if action_code and action_code.strip():
                script.append(action_code)
                logger.debug(f"[EnhancedGenerator] Generated code for step {step_num}")
            else:
                logger.warning(f"[EnhancedGenerator] No code generated for step {step_num} ({action_type})")
        
        # Test cleanup and summary
        script.append(f'    ')
        script.append(f'    # Test summary')
        script.append(f'    if errors:')
        script.append(f'        pytest.fail(f"Test completed with {{len(errors)}} error(s): {{errors}}")')
        script.append(f'    ')
        
        return "\n".join(script)
    
    def _generate_self_healing_helpers_python(self) -> str:
        """Generate self-healing locator helper functions for Python"""
        return '''
# ==================== Self-Healing Locators ====================
def try_selectors(page, selectors: list, action: str = "click", value: str = None, timeout: int = 10000):
    """
    Try multiple selectors until one works. Self-healing locator strategy.
    
    Args:
        page: Playwright page object
        selectors: List of selector dictionaries with 'method' and 'args'
        action: Action to perform ('click', 'fill', 'check', etc.)
        value: Value for fill action
        timeout: Timeout per selector attempt
    
    Returns:
        The working selector string for logging
    """
    last_error = None
    
    for selector_info in selectors:
        try:
            method = selector_info.get("method", "locator")
            args = selector_info.get("args", [])
            selector_str = selector_info.get("selector", str(args))
            
            # Build locator based on method
            if method == "get_by_role":
                element = page.get_by_role(args[0], name=args[1] if len(args) > 1 else None)
            elif method == "get_by_text":
                element = page.get_by_text(args[0], exact=args[1] if len(args) > 1 else False)
            elif method == "get_by_label":
                element = page.get_by_label(args[0])
            elif method == "get_by_placeholder":
                element = page.get_by_placeholder(args[0])
            elif method == "get_by_test_id":
                element = page.get_by_test_id(args[0])
            elif method == "locator_first":
                element = page.locator(args[0]).first
            else:
                element = page.locator(args[0])
            
            # Wait for element
            element.wait_for(state="visible", timeout=timeout)
            
            # Perform action
            if action == "click":
                element.click(force=True)
            elif action == "fill":
                element.fill(value or "")
            elif action == "check":
                element.click(force=True)  # Use click for Salesforce
            elif action == "select":
                element.select_option(value)
            elif action == "hover":
                element.hover()
            
            return selector_str  # Success!
            
        except Exception as e:
            last_error = e
            continue
    
    # All selectors failed
    raise Exception(f"All {len(selectors)} selectors failed. Last error: {last_error}")

'''
    
    def _generate_smart_wait_helpers_python(self) -> str:
        """Generate smart wait helper functions for Python"""
        return '''
# ==================== Smart Waits ====================
def wait_for_page_ready(page, timeout: int = 30000):
    """Wait for page to be fully loaded and interactive"""
    page.wait_for_load_state("domcontentloaded", timeout=timeout)
    
    # Wait for common loading indicators to disappear
    spinners = [
        ".slds-spinner",           # Salesforce
        ".loading-spinner",        # Generic
        "[class*='spinner']",      # Generic
        "[class*='loading']",      # Generic
        ".aura-waiting",           # Salesforce Aura
        "[aria-busy='true']",      # ARIA
    ]
    
    for spinner in spinners:
        try:
            spinner_el = page.locator(spinner).first
            if spinner_el.is_visible():
                spinner_el.wait_for(state="hidden", timeout=10000)
        except:
            pass  # Spinner not found or already hidden
    
    # Small delay for JavaScript rendering
    page.wait_for_timeout(500)

def wait_for_element_stable(page, selector: str, timeout: int = 10000):
    """Wait for element to be stable (not moving/changing)"""
    element = page.locator(selector).first
    element.wait_for(state="visible", timeout=timeout)
    
    # Wait for element to be stable (bounding box not changing)
    prev_box = None
    stable_count = 0
    
    for _ in range(10):
        try:
            box = element.bounding_box()
            if box == prev_box:
                stable_count += 1
                if stable_count >= 2:
                    return element
            else:
                stable_count = 0
            prev_box = box
            page.wait_for_timeout(100)
        except:
            break
    
    return element

'''
    
    def _generate_screenshot_helper_python(self) -> str:
        """Generate screenshot helper for Python"""
        return '''
# ==================== Screenshot Helpers ====================
def take_screenshot(page, name: str, screenshot_dir: str = "screenshots"):
    """Take a screenshot with timestamp"""
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"{screenshot_dir}/{name}_{timestamp}.png"
    page.screenshot(path=filename, full_page=True)
    return filename

def screenshot_on_error(func):
    """Decorator to take screenshot on test failure"""
    def wrapper(page, *args, **kwargs):
        try:
            return func(page, *args, **kwargs)
        except Exception as e:
            take_screenshot(page, f"error_{func.__name__}")
            raise
    return wrapper

'''
    
    def _generate_python_action_enhanced(self, action: Dict[str, Any], step_num: int) -> str:
        """Generate enhanced Python action code with self-healing and smart waits"""
        action_type = action.get("type", "")
        description = action.get("description", "")
        
        logger.debug(f"[EnhancedGenerator] _generate_python_action_enhanced: type={action_type}, desc={description[:30] if description else 'None'}")
        
        # Skip empty action types
        if not action_type:
            logger.warning(f"[EnhancedGenerator] Skipping action with no type at step {step_num}")
            return ""
        
        lines = []
        
        # Step comment
        lines.append(f"    # Step {step_num}: {description or action_type}")
        
        # Build selectors list for self-healing
        selectors = self._build_selector_fallbacks(action)
        
        if action_type == "click":
            if self.options["selfHealing"] and len(selectors) > 1:
                lines.append(f"    try:")
                lines.append(f"        selector_used = try_selectors(page, {selectors}, action='click')")
                lines.append(f"    except Exception as e:")
                lines.append(f"        errors.append(f'Step {step_num} failed: {{e}}')")
                if self.options["screenshotOnFailure"]:
                    lines.append(f"        take_screenshot(page, 'step_{step_num}_error', screenshot_dir)")
            else:
                selector = self._get_primary_selector(action)
                lines.append(f"    page.{selector}.click(force=True)")
            
            if self.options["smartWaits"]:
                lines.append(f"    wait_for_page_ready(page)")
        
        elif action_type in ["fill", "type", "input"]:
            value = action.get("value", "")
            if self.options["selfHealing"] and len(selectors) > 1:
                lines.append(f"    try:")
                lines.append(f"        selector_used = try_selectors(page, {selectors}, action='fill', value='{self._escape_string(value)}')")
                lines.append(f"    except Exception as e:")
                lines.append(f"        errors.append(f'Step {step_num} failed: {{e}}')")
            else:
                selector = self._get_primary_selector(action)
                lines.append(f"    page.{selector}.fill('{self._escape_string(value)}')")
        
        elif action_type == "check":
            if self.options["selfHealing"] and len(selectors) > 1:
                lines.append(f"    try:")
                lines.append(f"        selector_used = try_selectors(page, {selectors}, action='check')")
                lines.append(f"    except Exception as e:")
                lines.append(f"        errors.append(f'Step {step_num} failed: {{e}}')")
            else:
                selector = self._get_primary_selector(action)
                lines.append(f"    page.{selector}.click(force=True)")
        
        elif action_type == "navigate":
            url = action.get("url", "")
            if url and url != "about:blank":
                lines.append(f"    page.goto('{self._escape_string(url)}')")
                if self.options["smartWaits"]:
                    lines.append(f"    wait_for_page_ready(page)")
        
        elif action_type == "hover":
            selector = self._get_primary_selector(action)
            lines.append(f"    page.{selector}.hover()")
        
        elif action_type == "select":
            value = action.get("value", "")
            selector = self._get_primary_selector(action)
            lines.append(f"    page.{selector}.select_option('{self._escape_string(value)}')")
        
        elif action_type == "upload":
            files = action.get("files", "")
            selector = self._get_primary_selector(action)
            lines.append(f"    page.{selector}.set_input_files('{self._escape_string(files)}')")
        
        elif action_type == "drag":
            source = action.get("sourceSelector", "")
            target = action.get("targetSelector", "")
            lines.append(f"    page.drag_and_drop('{source}', '{target}')")
        
        elif action_type == "new_tab":
            # Handle popup/new tab - use context.pages to get all open pages
            url = action.get("url", "")
            lines.append(f"    # New tab/popup opened - get reference to it")
            lines.append(f"    page.wait_for_timeout(1000)  # Wait for popup to open")
            lines.append(f"    all_pages = page.context.pages")
            lines.append(f"    popup = all_pages[-1] if len(all_pages) > 1 else page")
            lines.append(f"    popup.wait_for_load_state('domcontentloaded')")
            if url and url != 'about:blank':
                lines.append(f"    # Expected URL: {url}")
        
        elif action_type == "switch_tab":
            # Handle tab switching - switch context to the target page
            lines.append(f"    # Switch to another tab/page")
            lines.append(f"    all_pages = page.context.pages")
            lines.append(f"    # Use index to switch: all_pages[0] = original, all_pages[-1] = newest")
        
        elif action_type == "close_tab":
            # Handle tab close
            lines.append(f"    # Close the popup/tab")
            lines.append(f"    if 'popup' in dir() and popup != page:")
            lines.append(f"        popup.close()")
            lines.append(f"    # popup.close()")
        
        else:
            # Unhandled action type - log and try generic click
            logger.warning(f"[EnhancedGenerator] Unhandled action type: {action_type}")
            selector = self._get_primary_selector(action)
            if selector and selector != 'locator("body")':
                lines.append(f"    # Unhandled action type: {action_type}")
                lines.append(f"    page.{selector}.click(force=True)")
        
        # Add assertion if enabled
        if self.options["generateAssertions"] and action.get("expectedText"):
            expected = action.get("expectedText")
            lines.append(f"    expect(page.get_by_text('{self._escape_string(expected)}')).to_be_visible()")
        
        lines.append("")
        return "\n".join(lines)
    
    def _build_selector_fallbacks(self, action: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Build list of fallback selectors for self-healing"""
        selectors = []
        
        # Extract all available selector info
        description = action.get("description", "")
        name = action.get("name", "")
        value = action.get("value", "")
        aria_label = action.get("ariaLabel") or action.get("aria-label", "")
        test_id = action.get("testId") or action.get("data-testid", "")
        title = action.get("title", "")
        placeholder = action.get("placeholder", "")
        inner_text = action.get("innerText", "")
        tag_name = action.get("tagName", "").lower()
        input_type = action.get("inputType") or action.get("elementType", "")
        
        # Extract text from description
        text_match = re.search(r'["\']([^"\']+)["\']', description)
        desc_text = text_match.group(1) if text_match else ""
        
        # Skip truncated text (contains "...")
        if "..." in desc_text or "…" in desc_text:
            logger.debug(f"[EnhancedGenerator] Skipping truncated text: {desc_text[:30]}")
            desc_text = ""
        
        # Priority 1: Test ID (most stable)
        if test_id:
            selectors.append({
                "method": "get_by_test_id",
                "args": [test_id],
                "selector": f"test_id:{test_id}"
            })
        
        # Priority 2: Role + name (semantic)
        if desc_text and len(desc_text) < 50:
            if tag_name == "button" or input_type == "button":
                selectors.append({
                    "method": "get_by_role",
                    "args": ["button", desc_text],
                    "selector": f"role:button[{desc_text}]"
                })
            elif tag_name == "a":
                selectors.append({
                    "method": "get_by_role",
                    "args": ["link", desc_text],
                    "selector": f"role:link[{desc_text}]"
                })
        
        # Priority 3: Label (for form fields)
        if aria_label:
            selectors.append({
                "method": "get_by_label",
                "args": [aria_label],
                "selector": f"label:{aria_label}"
            })
        
        # Priority 4: Placeholder
        if placeholder:
            selectors.append({
                "method": "get_by_placeholder",
                "args": [placeholder],
                "selector": f"placeholder:{placeholder}"
            })
        
        # Priority 5: For radio/checkbox, TEXT is most reliable - put it FIRST
        action_type = action.get("type", "")
        is_radio_checkbox = input_type in ["radio", "checkbox"] or action_type in ["check", "uncheck"]
        
        if is_radio_checkbox and desc_text and len(desc_text) < 50:
            # For radio/checkbox, get_by_text is the most reliable selector
            # Insert at the BEGINNING of the list (highest priority)
            selectors.insert(0, {
                "method": "get_by_text",
                "args": [desc_text, True],  # exact=True
                "selector": f"text:{desc_text}"
            })
        elif desc_text and len(desc_text) < 50:
            # For other elements, add text as a fallback
            selectors.append({
                "method": "get_by_text",
                "args": [desc_text, True],  # exact=True
                "selector": f"text:{desc_text}"
            })
        
        # Priority 6: Name attribute (use single quotes to avoid nested quote issues)
        # For radio buttons/checkboxes with name, need to be more specific
        if name:
            # For radio/checkbox, combine name with value if available
            if is_radio_checkbox:
                if value:
                    selectors.append({
                        "method": "locator",
                        "args": [f"[name='{name}'][value='{value}']"],
                        "selector": f"name:{name}[value={value}]"
                    })
                else:
                    # Add .first to avoid strict mode violation - but this is LOW priority for radio/checkbox
                    selectors.append({
                        "method": "locator_first",
                        "args": [f"[name='{name}']"],
                        "selector": f"name:{name}"
                    })
            else:
                selectors.append({
                    "method": "locator",
                    "args": [f"[name='{name}']"],
                    "selector": f"name:{name}"
                })
        
        # Priority 7: Title
        if title:
            selectors.append({
                "method": "locator",
                "args": [f"[title='{title}']"],
                "selector": f"title:{title}"
            })
        
        # Priority 8: Image-specific selectors
        if tag_name == "img":
            alt = action.get("alt", "")
            src = action.get("src", "")
            if alt:
                selectors.insert(0, {  # High priority for images with alt
                    "method": "get_by_role",
                    "args": ["img", alt],
                    "selector": f"role:img[{alt}]"
                })
            elif src:
                # Use part of src for identification
                src_part = src.split("/")[-1].split("?")[0]  # Get filename
                if src_part and len(src_part) > 3:
                    selectors.append({
                        "method": "locator",
                        "args": [f"img[src*='{src_part}']"],
                        "selector": f"img:src*={src_part}"
                    })
        
        # Fallback: CSS selector from original
        original_selector = self._get_original_selector(action)
        if original_selector and original_selector not in [s.get("args", [""])[0] for s in selectors]:
            # If it's a generic tag-only selector, add .first to avoid strict mode
            generic_tags = ["img", "span", "div", "a", "button", "input", "p", "li", "td", "tr"]
            if original_selector.lower() in generic_tags:
                selectors.append({
                    "method": "locator_first",
                    "args": [original_selector],
                    "selector": f"css:{original_selector}"
                })
            else:
                selectors.append({
                    "method": "locator",
                    "args": [original_selector],
                    "selector": f"css:{original_selector}"
                })
        
        # If still no selectors, add a generic one with .first
        if not selectors:
            selectors.append({
                "method": "locator_first",
                "args": ["body"],
                "selector": "body"
            })
        
        return selectors
    
    def _get_primary_selector(self, action: Dict[str, Any]) -> str:
        """Get the primary selector for an action"""
        selectors = self._build_selector_fallbacks(action)
        if selectors:
            s = selectors[0]
            method = s.get("method", "locator")
            args = s.get("args", [])
            
            if method == "get_by_role":
                if len(args) > 1:
                    return f'get_by_role("{self._escape_for_python(args[0])}", name="{self._escape_for_python(args[1])}")'
                return f'get_by_role("{self._escape_for_python(args[0])}")'
            elif method == "get_by_text":
                return f'get_by_text("{self._escape_for_python(args[0])}", exact=True)'
            elif method == "get_by_label":
                return f'get_by_label("{self._escape_for_python(args[0])}")'
            elif method == "get_by_placeholder":
                return f'get_by_placeholder("{self._escape_for_python(args[0])}")'
            elif method == "get_by_test_id":
                return f'get_by_test_id("{self._escape_for_python(args[0])}")'
            elif method == "locator_first":
                # Add .first to avoid strict mode violations
                selector = args[0] if args else "body"
                formatted = self._format_locator_selector(selector)
                return f'{formatted}.first'
            else:
                selector = args[0] if args else "body"
                # Use single quotes if selector contains double quotes
                return self._format_locator_selector(selector)
        
        return 'locator("body")'
    
    def _format_locator_selector(self, selector: str) -> str:
        """Format selector for page.locator() with proper quote handling"""
        if not selector:
            return 'locator("body")'
        
        # Skip JavaScript-style selectors that aren't valid CSS
        if selector.startswith("locator(") or selector.startswith("getBy") or ".getBy" in selector:
            # Try to extract a simpler selector from JS syntax
            # e.g., "locator('lightning-radio-group').getByText('18-35')" -> just use the text
            text_match = re.search(r"getByText\(['\"]([^'\"]+)['\"]\)", selector)
            if text_match:
                text = self._escape_for_python(text_match.group(1))
                return f'get_by_text("{text}", exact=True)'
            # Otherwise return a generic selector
            return 'locator("body")'
        
        # If selector contains double quotes, use single quotes outside
        if '"' in selector:
            escaped = selector.replace("'", "\\'")
            return f"locator('{escaped}')"
        else:
            return f'locator("{selector}")'
    
    def _escape_for_python(self, text: str) -> str:
        """Escape text for use in Python string literals (double quoted)"""
        if not text:
            return ""
        return text.replace('\\', '\\\\').replace('"', '\\"').replace('\n', '\\n').replace('\r', '\\r')
    
    def _get_original_selector(self, action: Dict[str, Any]) -> str:
        """Extract original selector from action, filtering out invalid JS-style selectors"""
        selector = action.get("selector", {})
        raw_selector = ""
        
        if isinstance(selector, str):
            raw_selector = selector
        elif isinstance(selector, dict):
            raw_selector = selector.get("selector") or selector.get("playwright", "").replace("page.", "")
        
        # Filter out JavaScript-style selectors that aren't valid CSS
        if raw_selector:
            # Skip if it looks like JS Playwright syntax
            if any(pattern in raw_selector for pattern in [
                "locator(",
                "getBy",
                ".get_by",
                "getByRole",
                "getByText",
                "getByLabel",
                "getByPlaceholder",
                "getByTestId",
            ]):
                logger.debug(f"Filtering out JS-style selector: {raw_selector}")
                return ""
            
            # Skip overly generic selectors
            if raw_selector in [".slds-checkbox_faux", ".slds-radio_faux", "span", "div", "input"]:
                return ""
        
        return raw_selector
    
    def _find_first_navigate_idx(self, actions: List[Dict[str, Any]]) -> int:
        """Find index of first navigate action with valid URL"""
        for i, action in enumerate(actions):
            if action.get("type") == "navigate":
                url = action.get("url", "")
                if url and url != "about:blank":
                    return i
        return -1
    
    # ==================== Page Object Model ====================
    
    def _generate_page_objects(self, actions: List[Dict[str, Any]], metadata: Dict[str, Any]) -> Dict[str, str]:
        """Generate Page Object Model classes from actions"""
        pages = {}
        
        # Group actions by URL/page
        current_page = "HomePage"
        page_actions = {current_page: []}
        
        for action in actions:
            if action.get("type") == "navigate":
                url = action.get("url", "")
                if url:
                    # Extract page name from URL
                    page_name = self._url_to_page_name(url)
                    if page_name not in page_actions:
                        page_actions[page_name] = []
                    current_page = page_name
            else:
                page_actions[current_page].append(action)
        
        # Generate POM class for each page
        for page_name, actions in page_actions.items():
            pages[page_name] = self._generate_pom_class(page_name, actions)
        
        return pages
    
    def _generate_pom_class(self, page_name: str, actions: List[Dict[str, Any]]) -> str:
        """Generate a single Page Object Model class"""
        lines = [
            f"class {page_name}:",
            f'    """Page Object for {page_name}"""',
            f"    ",
            f"    def __init__(self, page):",
            f"        self.page = page",
            f"    ",
        ]
        
        # Generate element locators
        elements = {}
        for action in actions:
            name = self._action_to_element_name(action)
            selector = self._get_primary_selector(action)
            if name and name not in elements:
                elements[name] = selector
        
        # Add element properties
        for name, selector in elements.items():
            lines.append(f"    @property")
            lines.append(f"    def {name}(self):")
            lines.append(f"        return self.page.{selector}")
            lines.append(f"    ")
        
        # Generate action methods
        for action in actions:
            method = self._generate_pom_method(action)
            if method:
                lines.append(method)
        
        return "\n".join(lines)
    
    def _url_to_page_name(self, url: str) -> str:
        """Convert URL to page class name"""
        from urllib.parse import urlparse
        parsed = urlparse(url)
        path = parsed.path.strip("/").replace("-", "_").replace("/", "_")
        if not path:
            return "HomePage"
        return "".join(word.capitalize() for word in path.split("_")) + "Page"
    
    def _action_to_element_name(self, action: Dict[str, Any]) -> str:
        """Convert action to element name for POM"""
        description = action.get("description", "")
        text_match = re.search(r'["\']([^"\']+)["\']', description)
        if text_match:
            text = text_match.group(1)
            return self._to_snake_case(text) + "_element"
        return None
    
    def _generate_pom_method(self, action: Dict[str, Any]) -> str:
        """Generate POM method for an action"""
        action_type = action.get("type", "")
        description = action.get("description", "")
        
        method_name = self._to_snake_case(description or action_type)
        element_name = self._action_to_element_name(action)
        
        if not element_name:
            return ""
        
        if action_type == "click":
            return f"""    def {method_name}(self):
        self.{element_name}.click()
        return self
    """
        elif action_type in ["fill", "type", "input"]:
            return f"""    def {method_name}(self, value: str):
        self.{element_name}.fill(value)
        return self
    """
        
        return ""
    
    # ==================== Data-Driven Tests ====================
    
    def _generate_test_data(self, actions: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Extract test data for data-driven tests"""
        test_data = []
        
        for action in actions:
            if action.get("type") in ["fill", "type", "input"]:
                field_name = action.get("name") or self._action_to_element_name(action) or "field"
                value = action.get("value", "")
                test_data.append({
                    "field": field_name,
                    "value": value,
                    "type": "input"
                })
            elif action.get("type") == "select":
                field_name = action.get("name") or "dropdown"
                value = action.get("value", "")
                test_data.append({
                    "field": field_name,
                    "value": value,
                    "type": "select"
                })
        
        return test_data
    
    # ==================== Cross-Browser Config ====================
    
    def _generate_cross_browser_config(self) -> Dict[str, Any]:
        """Generate cross-browser configuration"""
        return {
            "browsers": ["chromium", "firefox", "webkit"],
            "playwright_config": """
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 12'] },
    },
  ],
});
""",
            "pytest_config": """
# pytest.ini
[pytest]
addopts = --browser chromium --browser firefox --browser webkit
"""
        }
    
    # ==================== TypeScript Generation ====================
    
    def _generate_typescript_script(self, actions: List[Dict[str, Any]], start_url: str, metadata: Dict[str, Any]) -> str:
        """Generate enhanced TypeScript Playwright script"""
        script = []
        
        script.append("import { test, expect, Page } from '@playwright/test';")
        script.append("")
        
        # Helper functions
        if self.options["selfHealing"]:
            script.append(self._generate_self_healing_helpers_ts())
        
        if self.options["smartWaits"]:
            script.append(self._generate_smart_wait_helpers_ts())
        
        # Test
        test_name = metadata.get("title", "recorded test")
        script.append(f"test('{test_name}', async ({{ page }}) => {{")
        script.append(f"  // Navigate to starting URL")
        script.append(f"  await page.goto('{self._escape_string(start_url)}');")
        
        if self.options["smartWaits"]:
            script.append(f"  await waitForPageReady(page);")
        
        script.append("")
        
        # Process actions
        navigate_idx = self._find_first_navigate_idx(actions)
        actions_to_process = [a for i, a in enumerate(actions) if i != navigate_idx]
        
        for i, action in enumerate(actions_to_process):
            action_code = self._generate_ts_action(action, i + 1)
            if action_code:
                script.append(action_code)
        
        script.append("});")
        
        return "\n".join(script)
    
    def _generate_self_healing_helpers_ts(self) -> str:
        """Generate self-healing helpers for TypeScript"""
        return """
// Self-healing locator helper
async function trySelectors(page: Page, selectors: Array<{method: string, args: any[]}>, action: string = 'click', value?: string) {
  for (const sel of selectors) {
    try {
      let element;
      switch (sel.method) {
        case 'getByRole':
          element = page.getByRole(sel.args[0], { name: sel.args[1] });
          break;
        case 'getByText':
          element = page.getByText(sel.args[0], { exact: sel.args[1] });
          break;
        case 'getByLabel':
          element = page.getByLabel(sel.args[0]);
          break;
        default:
          element = page.locator(sel.args[0]);
      }
      
      await element.waitFor({ state: 'visible', timeout: 10000 });
      
      if (action === 'click') await element.click({ force: true });
      else if (action === 'fill') await element.fill(value || '');
      
      return;
    } catch (e) {
      continue;
    }
  }
  throw new Error('All selectors failed');
}
"""
    
    def _generate_smart_wait_helpers_ts(self) -> str:
        """Generate smart wait helpers for TypeScript"""
        return """
// Smart wait for page ready
async function waitForPageReady(page: Page) {
  await page.waitForLoadState('domcontentloaded');
  
  const spinners = ['.slds-spinner', '.loading-spinner', '[class*="spinner"]'];
  for (const spinner of spinners) {
    try {
      const el = page.locator(spinner).first();
      if (await el.isVisible()) {
        await el.waitFor({ state: 'hidden', timeout: 10000 });
      }
    } catch {}
  }
  
  await page.waitForTimeout(500);
}
"""
    
    def _generate_ts_action(self, action: Dict[str, Any], step_num: int) -> str:
        """Generate TypeScript action code"""
        action_type = action.get("type", "")
        description = action.get("description", "")
        
        lines = []
        lines.append(f"  // Step {step_num}: {description or action_type}")
        
        selector = self._get_primary_selector(action).replace('get_by_', 'getBy').replace('"', "'")
        
        if action_type == "click":
            lines.append(f"  await page.{selector}.click({{ force: true }});")
        elif action_type in ["fill", "type", "input"]:
            value = action.get("value", "")
            lines.append(f"  await page.{selector}.fill('{self._escape_string(value)}');")
        elif action_type == "check":
            lines.append(f"  await page.{selector}.click({{ force: true }});")
        elif action_type == "navigate":
            url = action.get("url", "")
            if url and url != "about:blank":
                lines.append(f"  await page.goto('{self._escape_string(url)}');")
        
        lines.append("")
        return "\n".join(lines)
    
    # ==================== Utilities ====================
    
    def _escape_string(self, s: str) -> str:
        """Escape string for code"""
        if not s:
            return ""
        return s.replace("\\", "\\\\").replace("'", "\\'").replace('"', '\\"').replace("\n", "\\n")
    
    def _to_snake_case(self, s: str) -> str:
        """Convert to snake_case"""
        s = re.sub(r'[^a-zA-Z0-9]+', '_', s.lower())
        return re.sub(r'^_|_$', '', s)[:50]

