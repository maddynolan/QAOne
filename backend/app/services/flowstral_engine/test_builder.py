"""
FLOWSTRAL TEST BUILDER
======================
Converts recorded actions or test case definitions into robust,
self-healing Playwright tests using the Flowstral Engine.

This is the integration layer that connects:
- Browser Extension recordings
- Unified Workflow Editor test cases
- Flowstral Engine code generation

Usage:
    builder = FlowstralTestBuilder()
    test_code = builder.build_from_recording(recording_data)
    # or
    test_code = builder.build_from_test_case(test_case)
"""

import re
import os
from typing import List, Dict, Any, Optional
from datetime import datetime


class FlowstralTestBuilder:
    """
    Builds robust Playwright tests using the Flowstral Engine.
    
    Key Features:
    - Converts raw recordings to intent-based code
    - Detects Salesforce patterns and uses specialized methods
    - Generates self-contained, portable test files
    - Includes persistent session support for MFA bypass
    """
    
    def __init__(self, app_type: str = "auto"):
        self.app_type = app_type
        self.detected_patterns = []
    
    def build_from_recording(self, recording_data: Dict) -> str:
        """
        Build test from browser extension recording.
        
        Args:
            recording_data: Data from browser extension with actions array
            
        Returns:
            Complete Python test file content
        """
        actions = recording_data.get('actions', [])
        url = recording_data.get('url', '')
        name = recording_data.get('name', f'recording_{datetime.now().strftime("%Y%m%d_%H%M%S")}')
        
        # Detect app type from URL
        if self.app_type == "auto":
            self.app_type = self._detect_app_type(url)
        
        # Convert actions to steps
        steps = self._convert_actions_to_steps(actions)
        
        # Generate the test
        return self._generate_test_file(name, steps, url)
    
    def build_from_test_case(self, test_case: Dict) -> str:
        """
        Build test from Unified Workflow Editor test case.
        
        Args:
            test_case: Test case definition with steps
            
        Returns:
            Complete Python test file content
        """
        steps = test_case.get('steps', [])
        name = test_case.get('name', test_case.get('title', 'test_case'))
        url = test_case.get('startUrl', '')
        
        # Detect app type
        if self.app_type == "auto":
            self.app_type = self._detect_app_type(url)
        
        # Convert test case steps to engine steps
        engine_steps = self._convert_test_case_steps(steps)
        
        return self._generate_test_file(name, engine_steps, url)
    
    def _detect_app_type(self, url: str) -> str:
        """Detect application type from URL."""
        url_lower = url.lower()
        
        if any(x in url_lower for x in ['salesforce.com', 'force.com', '.my.salesforce']):
            return "salesforce"
        elif 'service-now.com' in url_lower:
            return "servicenow"
        elif 'workday.com' in url_lower:
            return "workday"
        elif 'sap.com' in url_lower or 'fiori' in url_lower:
            return "sap_fiori"
        elif 'dynamics.com' in url_lower:
            return "dynamics365"
        
        return "generic"
    
    def _convert_actions_to_steps(self, actions: List[Dict]) -> List[Dict]:
        """Convert raw recorded actions to engine steps."""
        steps = []
        
        for action in actions:
            action_type = action.get('type', '').lower()
            
            if action_type == 'navigate':
                steps.append({
                    'action': 'navigate',
                    'url': action.get('url', ''),
                    'description': f"Navigate to {action.get('url', '')}"
                })
                
            elif action_type == 'click':
                step = self._convert_click_action(action)
                steps.append(step)
                
            elif action_type in ['fill', 'input', 'type']:
                step = self._convert_fill_action(action)
                steps.append(step)
                
            elif action_type == 'hover':
                steps.append({
                    'action': 'hover',
                    'description': action.get('description', 'Hover'),
                    'selector_hint': action.get('selector', ''),
                    'skip_on_fail': True
                })
                
            elif action_type == 'keypress':
                steps.append({
                    'action': 'press_key',
                    'key': action.get('key', 'Enter'),
                    'description': f"Press {action.get('key', 'Enter')}"
                })
        
        return steps
    
    def _convert_click_action(self, action: Dict) -> Dict:
        """Convert a click action, detecting Salesforce patterns."""
        description = action.get('description', action.get('text', 'Click'))
        selector = action.get('selector', '')
        text = action.get('text', '')
        
        desc_lower = description.lower()
        
        # Detect Salesforce App Launcher
        if self.app_type == "salesforce":
            if 'app launcher' in desc_lower or 'waffle' in desc_lower or 'slds-icon-waffle' in selector:
                # Check if there's a subsequent search/fill action
                self.detected_patterns.append('app_launcher')
                return {
                    'action': 'sf_app_launcher_click',
                    'description': 'Click App Launcher',
                }
            
            # Detect tab clicks
            if any(tab in desc_lower for tab in ['details', 'related', 'activity', 'news']):
                tab_name = text or description.replace('Click', '').replace('"', '').strip()
                return {
                    'action': 'sf_click_tab',
                    'tab_name': tab_name,
                    'description': f'Click {tab_name} tab'
                }
            
            # Detect Save button
            if 'save' in desc_lower and 'button' in desc_lower:
                return {
                    'action': 'sf_save',
                    'description': 'Save record'
                }
        
        # Default click
        return {
            'action': 'click',
            'text': text or self._extract_text_from_description(description),
            'role': self._infer_role(description, selector),
            'selector_hint': selector,
            'description': description
        }
    
    def _convert_fill_action(self, action: Dict) -> Dict:
        """Convert a fill action, detecting Salesforce patterns."""
        description = action.get('description', '')
        value = action.get('value', '')
        selector = action.get('selector', '')
        label = action.get('label', '')
        placeholder = action.get('placeholder', '')
        
        desc_lower = description.lower()
        
        # Detect Salesforce App Launcher search
        if self.app_type == "salesforce":
            if 'search apps' in desc_lower or 'app launcher' in desc_lower:
                return {
                    'action': 'sf_open_app',
                    'app_name': value,
                    'description': f'Open {value} from App Launcher'
                }
            
            # Detect Global Search
            if 'search' in desc_lower and not 'app' in desc_lower:
                return {
                    'action': 'sf_global_search',
                    'search_text': value,
                    'description': f'Search for {value}'
                }
        
        # Default fill
        return {
            'action': 'fill',
            'value': value,
            'label': label or self._extract_label_from_description(description),
            'placeholder': placeholder,
            'selector_hint': selector,
            'description': description
        }
    
    def _convert_test_case_steps(self, steps: List[Dict]) -> List[Dict]:
        """Convert Unified Workflow Editor steps to engine steps."""
        engine_steps = []
        last_action = None
        
        for i, step in enumerate(steps):
            step_type = step.get('type', step.get('action', '')).lower()
            
            if step_type == 'navigate':
                engine_steps.append({
                    'action': 'navigate',
                    'url': step.get('url', step.get('value', '')),
                    'description': step.get('name', 'Navigate')
                })
                
            elif step_type == 'click':
                converted = self._convert_click_action(step)
                
                # Dedupe: Skip consecutive App Launcher clicks (often misrecorded duplicates)
                if converted.get('action') == 'sf_app_launcher_click':
                    if last_action == 'sf_app_launcher_click':
                        continue  # Skip duplicate App Launcher click
                    # Also skip if next step is a fill in App Launcher search - sf_open_app handles both
                    if i + 1 < len(steps):
                        next_step = steps[i + 1]
                        next_desc = (next_step.get('name', '') + next_step.get('description', '')).lower()
                        if 'search apps' in next_desc or 'search items' in next_desc:
                            continue  # sf_open_app will handle both click and fill
                
                # Dedupe: Skip hover-like clicks that are non-essential
                desc_lower = step.get('name', '').lower()
                if 'hover' in desc_lower:
                    engine_steps.append({
                        'action': 'hover',
                        'description': step.get('name', 'Hover'),
                        'selector_hint': step.get('selector', ''),
                        'skip_on_fail': True
                    })
                    last_action = 'hover'
                    continue
                
                engine_steps.append(converted)
                last_action = converted.get('action')
                
            elif step_type in ['fill', 'input', 'type']:
                converted = self._convert_fill_action(step)
                engine_steps.append(converted)
                last_action = converted.get('action')
                
            elif step_type == 'hover':
                engine_steps.append({
                    'action': 'hover',
                    'description': step.get('name', 'Hover'),
                    'selector_hint': step.get('selector', ''),
                    'skip_on_fail': True
                })
                
            elif step_type == 'wait':
                engine_steps.append({
                    'action': 'wait',
                    'milliseconds': int(step.get('value', 1000)),
                    'description': f"Wait {step.get('value', 1000)}ms"
                })
                
            elif step_type == 'assertion':
                engine_steps.append({
                    'action': 'assert',
                    'assertion_type': step.get('assertionType', 'visible'),
                    'expected': step.get('expected', ''),
                    'selector_hint': step.get('selector', ''),
                    'description': step.get('name', 'Assertion')
                })
        
        return engine_steps
    
    def _extract_text_from_description(self, description: str) -> str:
        """Extract clickable text from description."""
        # Look for quoted text
        match = re.search(r'"([^"]+)"', description)
        if match:
            return match.group(1)
        
        # Remove common prefixes
        text = description.replace('Click', '').replace('click', '').strip()
        return text
    
    def _extract_label_from_description(self, description: str) -> str:
        """Extract field label from description."""
        # Look for "Fill X:" pattern
        match = re.search(r'Fill\s+([^:]+):', description)
        if match:
            return match.group(1).strip()
        
        return ""
    
    def _infer_role(self, description: str, selector: str) -> Optional[str]:
        """Infer ARIA role from description and selector."""
        desc_lower = description.lower()
        selector_lower = selector.lower()
        
        if 'button' in desc_lower or 'button' in selector_lower:
            return 'button'
        elif 'link' in desc_lower or '<a' in selector_lower:
            return 'link'
        elif 'tab' in desc_lower:
            return 'tab'
        elif 'checkbox' in desc_lower or 'checkbox' in selector_lower:
            return 'checkbox'
        
        return None
    
    def _generate_test_file(self, name: str, steps: List[Dict], start_url: str, style: str = "keywords") -> str:
        """
        Generate the complete test file.
        
        Args:
            name: Test name
            steps: Test steps
            start_url: Starting URL
            style: Code style - "keywords" (Copado-style readable) or "engine" (full engine)
        """
        safe_name = self._sanitize_name(name)
        
        if style == "keywords":
            return self._generate_keyword_style_test(safe_name, name, steps, start_url)
        
        lines = []
        
        # Header
        lines.extend([
            '"""',
            f'Test: {name}',
            f'Generated by Flowstral Engine',
            f'App Type: {self.app_type}',
            f'Generated: {datetime.now().isoformat()}',
            '"""',
            '',
            'import sys',
            'import os',
            'import time',
            'import re',
            'from typing import Optional, List',
            'from playwright.sync_api import sync_playwright, Page, Locator',
            'import pytest',
            '',
        ])
        
        # Embedded Engine (for portability)
        lines.extend(self._get_embedded_engine())
        
        # Fixture
        lines.extend(self._get_browser_fixture())
        
        # Test function
        lines.extend(self._generate_test_function(safe_name, steps, start_url))
        
        # Main block
        lines.extend([
            '',
            'if __name__ == "__main__":',
            '    import subprocess',
            '    exit_code = subprocess.call(["python", "-m", "pytest", __file__, "-v", "-s", "--tb=short"])',
            '    sys.exit(exit_code)',
        ])
        
        return '\n'.join(lines)
    
    def _sanitize_name(self, name: str) -> str:
        """Sanitize test name for Python."""
        name = re.sub(r'[^a-zA-Z0-9_]', '_', name.lower())
        name = re.sub(r'_+', '_', name)
        if name[0].isdigit():
            name = 'test_' + name
        return name
    
    def _generate_keyword_style_test(self, safe_name: str, name: str, steps: List[Dict], start_url: str) -> str:
        """
        Generate Copado-style readable test using text-based keywords.
        
        This produces clean, readable tests like:
            click_text("Log In")
            type_text("Username", "john@example.com")
            verify_text("Welcome")
        """
        lines = []
        
        # Header
        lines.extend([
            '"""',
            f'Test: {name}',
            '',
            'Generated by Flowstral - Copado-style Keyword Test',
            'Uses text-based locators for maximum readability and resilience.',
            '',
            f'App Type: {self.app_type}',
            f'Generated: {datetime.now().isoformat()}',
            '"""',
            '',
            'import sys',
            'import time',
            'from playwright.sync_api import sync_playwright, Page',
            '',
            '',
            '# ============================================================',
            '# FLOWSTRAL KEYWORDS - Text-based test automation',
            '# ============================================================',
            '',
            'def click_text(page: Page, text: str, timeout: int = 30000):',
            '    """Click element containing text."""',
            '    strategies = [',
            '        f"text={text}",',
            '        f"role=button[name=\\"{text}\\"]",',
            '        f"role=link[name=\\"{text}\\"]",',
            '        f"[aria-label*=\\"{text}\\" i]",',
            '        f"[title*=\\"{text}\\" i]",',
            '        f"button:has-text(\\"{text}\\")",',
            '        f"a:has-text(\\"{text}\\")",',
            '        f"lightning-button:has-text(\\"{text}\\")",',
            '        f".slds-button:has-text(\\"{text}\\")",',
            '    ]',
            '    for sel in strategies:',
            '        try:',
            '            loc = page.locator(sel)',
            '            if loc.count() > 0:',
            '                loc.first.click(timeout=timeout)',
            '                print(f"[ClickText] Clicked: {text}")',
            '                return',
            '        except: pass',
            '    raise Exception(f"ClickText failed: {text}")',
            '',
            '',
            'def type_text(page: Page, label: str, value: str, timeout: int = 30000):',
            '    """Type into input identified by label/placeholder."""',
            '    strategies = [',
            '        f"input[placeholder*=\\"{label}\\" i]",',
            '        f"input[aria-label*=\\"{label}\\" i]",',
            '        f"input[name*=\\"{label}\\" i]",',
            '        f"label:has-text(\\"{label}\\") input",',
            '        f"lightning-input:has-text(\\"{label}\\") input",',
            '        f"textarea[placeholder*=\\"{label}\\" i]",',
            '    ]',
            '    for sel in strategies:',
            '        try:',
            '            loc = page.locator(sel).first',
            '            if loc.count() > 0:',
            '                loc.clear(timeout=5000)',
            '                loc.fill(value, timeout=timeout)',
            '                print(f"[TypeText] Typed into: {label}")',
            '                return',
            '        except: pass',
            '    raise Exception(f"TypeText failed: {label}")',
            '',
            '',
            'def verify_text(page: Page, text: str, timeout: int = 30000):',
            '    """Verify text exists on page."""',
            '    page.wait_for_selector(f"text={text}", timeout=timeout)',
            '    print(f"[VerifyText] Found: {text}")',
            '',
            '',
            'def wait_for_ready(page: Page, timeout: int = 15000):',
            '    """Wait for page to be ready."""',
            '    try: page.wait_for_load_state("domcontentloaded", timeout=timeout)',
            '    except: pass',
            '    # Wait for Salesforce spinners to disappear',
            '    spinners = ["lightning-spinner", ".slds-spinner", "[aria-busy=\'true\']"]',
            '    start = time.time()',
            '    while (time.time() - start) < (timeout / 1000):',
            '        has_spinner = False',
            '        for s in spinners:',
            '            try:',
            '                if page.locator(s).is_visible(timeout=500): has_spinner = True; break',
            '            except: pass',
            '        if not has_spinner: break',
            '        time.sleep(0.3)',
            '    time.sleep(0.3)',
            '',
            '',
            '# ============================================================',
            f'# TEST: {name}',
            '# ============================================================',
            '',
            f'def test_{safe_name}():',
            '    """',
            f'    {name}',
            '    """',
            '    with sync_playwright() as p:',
            '        # Launch browser with persistent context for MFA',
            '        import os',
            '        user_data = os.path.expanduser("~/.flowstral/browser_data")',
            '        os.makedirs(user_data, exist_ok=True)',
            '        ',
            '        context = p.chromium.launch_persistent_context(',
            '            user_data,',
            '            headless=False,',
            '            viewport={"width": 1280, "height": 720}',
            '        )',
            '        page = context.pages[0] if context.pages else context.new_page()',
            '        ',
            '        try:',
            f'            # Navigate to starting URL',
            f'            page.goto("{start_url}")',
            '            wait_for_ready(page)',
            '            ',
        ])
        
        # Generate steps using keywords
        for i, step in enumerate(steps, 1):
            action = step.get('action', '')
            desc = step.get('description', '')
            
            # Clean description for comments (remove unicode)
            clean_desc = re.sub(r'[^\x00-\x7F]', '', desc)[:50]
            lines.append(f'            # Step {i}: {clean_desc}')
            
            if action == 'navigate':
                url = step.get('url', '')
                lines.append(f'            page.goto("{url}")')
                lines.append('            wait_for_ready(page)')
                
            elif action in ['click', 'sf_app_launcher_click']:
                text = step.get('text', '')
                if not text:
                    text = self._extract_text_from_description(desc)
                if text:
                    # Escape quotes
                    text = text.replace('"', '\\"')
                    lines.append(f'            click_text(page, "{text}")')
                    lines.append('            wait_for_ready(page)')
                else:
                    hint = step.get('selector_hint', '')
                    if hint:
                        lines.append(f'            page.locator("{hint}").click()')
                        lines.append('            wait_for_ready(page)')
                    else:
                        lines.append(f'            # TODO: Add selector for: {clean_desc}')
                
            elif action == 'sf_open_app':
                app = step.get('app_name', 'Accounts')
                lines.extend([
                    '            # Open app from App Launcher',
                    '            click_text(page, "App Launcher")',
                    '            wait_for_ready(page)',
                    f'            type_text(page, "Search apps", "{app}")',
                    '            time.sleep(1)',
                    f'            click_text(page, "{app}")',
                    '            wait_for_ready(page)',
                ])
                
            elif action == 'sf_global_search':
                search_text = step.get('search_text', '')
                lines.extend([
                    '            # Global search',
                    '            click_text(page, "Search")',
                    f'            type_text(page, "Search", "{search_text}")',
                    '            page.keyboard.press("Enter")',
                    '            wait_for_ready(page)',
                ])
                
            elif action == 'sf_click_tab':
                tab = step.get('tab_name', 'Details')
                lines.append(f'            click_text(page, "{tab}")')
                lines.append('            wait_for_ready(page)')
                
            elif action in ['fill', 'sf_fill']:
                value = step.get('value', '')
                label = step.get('label', '')
                if not label:
                    label = self._extract_label_from_description(desc)
                if label:
                    # Escape quotes
                    label = label.replace('"', '\\"')
                    value = value.replace('"', '\\"')
                    lines.append(f'            type_text(page, "{label}", "{value}")')
                else:
                    hint = step.get('selector_hint', '')
                    if hint:
                        value = value.replace('"', '\\"')
                        lines.append(f'            page.locator("{hint}").fill("{value}")')
                    else:
                        lines.append(f'            # TODO: Add selector for fill: {clean_desc}')
                
            elif action == 'hover':
                # Skip hovers or make them non-blocking
                lines.append(f'            # Hover (skipping): {clean_desc}')
                lines.append('            pass')
                
            elif action == 'wait':
                ms = step.get('milliseconds', 1000)
                lines.append(f'            time.sleep({ms / 1000})')
                
            elif action == 'press_key':
                key = step.get('key', 'Enter')
                lines.append(f'            page.keyboard.press("{key}")')
                
            elif action == 'assert':
                expected = step.get('expected', '')
                if expected:
                    lines.append(f'            verify_text(page, "{expected}")')
            
            lines.append('')
        
        # End test
        lines.extend([
            '            print("[TEST PASSED]")',
            '            ',
            '        except Exception as e:',
            '            print(f"[TEST FAILED] {e}")',
            '            page.screenshot(path="failure_screenshot.png")',
            '            raise',
            '        finally:',
            '            context.close()',
            '',
            '',
            'if __name__ == "__main__":',
            '    import subprocess',
            '    exit_code = subprocess.call(["python", "-m", "pytest", __file__, "-v", "-s", "--tb=short"])',
            '    sys.exit(exit_code)',
        ])
        
        return '\n'.join(lines)
    
    def _get_embedded_engine(self) -> List[str]:
        """Get embedded FlowstralEngine code."""
        # Read the demo engine code and return it
        # For now, return a simplified version
        return [
            '# ============================================================',
            '# FLOWSTRAL ENGINE (embedded for portability)',
            '# ============================================================',
            '',
            'class FlowstralEngine:',
            '    """Robust automation engine."""',
            '    ',
            '    def __init__(self, page: Page, app_type: str = "salesforce", verbose: bool = True):',
            '        self.page = page',
            '        self.app_type = app_type',
            '        self.verbose = verbose',
            '        self.loading_selectors = ["lightning-spinner", ".slds-spinner", "[aria-busy=\'true\']"]',
            '    ',
            '    def _log(self, msg: str):',
            '        if self.verbose: print(f"[FLOWSTRAL] {msg}")',
            '    ',
            '    def wait_for_ready(self, timeout: int = 15000):',
            '        try: self.page.wait_for_load_state("domcontentloaded", timeout=timeout)',
            '        except: pass',
            '        start = time.time()',
            '        while (time.time() - start) < (timeout / 1000):',
            '            has_spinner = any(self.page.locator(s).is_visible(timeout=500) for s in self.loading_selectors if self._safe_check(s))',
            '            if not has_spinner: break',
            '            time.sleep(0.3)',
            '        time.sleep(0.2)',
            '    ',
            '    def _safe_check(self, selector):',
            '        try: return self.page.locator(selector).count() > 0',
            '        except: return False',
            '    ',
            '    def _find(self, text=None, role=None, label=None, placeholder=None, title=None, selector_hint=None, timeout=10000):',
            '        strategies = []',
            '        if role and text: strategies.append(self.page.get_by_role(role, name=text))',
            '        if label: strategies.append(self.page.get_by_label(label))',
            '        if placeholder: strategies.append(self.page.get_by_placeholder(placeholder))',
            '        if text: strategies.append(self.page.get_by_text(text, exact=True)); strategies.append(self.page.get_by_text(text))',
            '        if title: strategies.append(self.page.get_by_title(title))',
            '        if selector_hint:',
            '            try: strategies.append(self.page.locator(selector_hint))',
            '            except: pass',
            '        for loc in strategies:',
            '            try:',
            '                if loc.count() > 0 and loc.first.is_visible(timeout=2000): return loc.first',
            '            except: pass',
            '        return None',
            '    ',
            '    def navigate(self, url: str):',
            '        self._log(f"Navigate: {url}")',
            '        self.page.goto(url)',
            '        self.wait_for_ready()',
            '    ',
            '    def click(self, text=None, role=None, label=None, title=None, selector_hint=None, description=None, timeout=10000):',
            '        desc = description or text or label or "element"',
            '        self._log(f"Click: {desc}")',
            '        self.wait_for_ready(timeout=5000)',
            '        for attempt in range(3):',
            '            el = self._find(text=text, role=role, label=label, title=title, selector_hint=selector_hint, timeout=timeout)',
            '            if el:',
            '                try:',
            '                    el.scroll_into_view_if_needed()',
            '                    el.click(force=True, timeout=5000)',
            '                    self._log(f"   [+] Clicked")',
            '                    self.wait_for_ready(timeout=5000)',
            '                    return True',
            '                except: pass',
            '            if attempt < 2: self._log(f"   [RETRY {attempt+1}]"); time.sleep(2)',
            '        raise Exception(f"Element not found: {desc}")',
            '    ',
            '    def fill(self, value, label=None, placeholder=None, selector_hint=None, description=None, timeout=10000):',
            '        desc = description or label or placeholder or "input"',
            '        self._log(f"Fill: {desc}")',
            '        self.wait_for_ready(timeout=5000)',
            '        for attempt in range(3):',
            '            el = self._find(label=label, placeholder=placeholder, selector_hint=selector_hint, timeout=timeout)',
            '            if el:',
            '                try:',
            '                    el.scroll_into_view_if_needed()',
            '                    el.click(timeout=2000)',
            '                    el.fill(value, timeout=3000)',
            '                    self._log(f"   [+] Filled")',
            '                    return True',
            '                except: pass',
            '            if attempt < 2: self._log(f"   [RETRY {attempt+1}]"); time.sleep(1.5)',
            '        raise Exception(f"Input not found: {desc}")',
            '    ',
            '    def hover(self, text=None, selector_hint=None, skip_on_fail=True):',
            '        try:',
            '            el = self._find(text=text, selector_hint=selector_hint, timeout=3000)',
            '            if el: el.hover(timeout=2000)',
            '        except:',
            '            if not skip_on_fail: raise',
            '    ',
            '    def sf_open_app(self, app_name: str):',
            '        self._log(f"[SF] Open app: {app_name}")',
            '        waffle_sels = ["div.slds-icon-waffle", "button.slds-icon-waffle", ".appLauncher button"]',
            '        for sel in waffle_sels:',
            '            try:',
            '                w = self.page.locator(sel).first',
            '                if w.is_visible(timeout=2000): w.click(force=True); break',
            '            except: pass',
            '        time.sleep(1)',
            '        search_sels = ["one-app-launcher-menu input[type=\'search\']", "input[placeholder*=\'Search apps\']"]',
            '        for sel in search_sels:',
            '            try:',
            '                s = self.page.locator(sel).first',
            '                if s.is_visible(timeout=3000): s.click(); s.fill(app_name); break',
            '            except: pass',
            '        time.sleep(0.5)',
            '        result_sels = [f\'one-app-launcher-menu-item a:has-text("{app_name}")\', f\'p.slds-truncate:has-text("{app_name}")\']',
            '        for sel in result_sels:',
            '            try:',
            '                r = self.page.locator(sel).first',
            '                if r.is_visible(timeout=2000): r.click(); self._log(f"   [+] Opened: {app_name}"); self.wait_for_ready(); return',
            '            except: pass',
            '    ',
            '    def sf_global_search(self, text: str):',
            '        self._log(f"[SF] Search: {text}")',
            '        search_btns = [\'button[title="Search"]\', \'[aria-label="Search"]\']',
            '        for sel in search_btns:',
            '            try:',
            '                b = self.page.locator(sel).first',
            '                if b.is_visible(timeout=2000): b.click(force=True); break',
            '            except: pass',
            '        time.sleep(0.5)',
            '        search_inputs = [\'input[placeholder*="Search"]\', \'.slds-combobox__input\']',
            '        for sel in search_inputs:',
            '            try:',
            '                i = self.page.locator(sel).first',
            '                if i.is_visible(timeout=3000): i.click(); i.fill(text); self.page.keyboard.press("Enter"); self.wait_for_ready(); return',
            '            except: pass',
            '    ',
            '    def sf_click_tab(self, tab_name: str):',
            '        self._log(f"[SF] Click tab: {tab_name}")',
            '        tab_sels = [f\'a[data-label="{tab_name}"]\', f\'[role="tab"]:has-text("{tab_name}")\']',
            '        for sel in tab_sels:',
            '            try:',
            '                t = self.page.locator(sel).first',
            '                if t.is_visible(timeout=2000): t.click(); return',
            '            except: pass',
            '    ',
            '    def sf_save(self):',
            '        self.click(text="Save", role="button", description="Save")',
            '',
            '',
        ]
    
    def _get_browser_fixture(self) -> List[str]:
        """Get pytest fixture for persistent browser."""
        return [
            '# ============================================================',
            '# BROWSER FIXTURE (with persistent session for MFA bypass)',
            '# ============================================================',
            '',
            '@pytest.fixture(scope="function")',
            'def browser_context():',
            '    """Persistent browser context - remembers MFA verification."""',
            '    user_data_dir = os.path.join(os.environ.get("TEMP", "/tmp"), "playwright_salesforce_session")',
            '    os.makedirs(user_data_dir, exist_ok=True)',
            '    print(f"\\n[SESSION] Using: {user_data_dir}")',
            '    ',
            '    with sync_playwright() as p:',
            '        context = p.chromium.launch_persistent_context(',
            '            user_data_dir,',
            '            headless=False,',
            '            slow_mo=100,',
            '            viewport={"width": 1920, "height": 1080}',
            '        )',
            '        yield context',
            '        context.close()',
            '',
            '',
        ]
    
    def _generate_test_function(self, name: str, steps: List[Dict], start_url: str) -> List[str]:
        """Generate the test function."""
        lines = [
            '# ============================================================',
            '# TEST',
            '# ============================================================',
            '',
            f'def test_{name}(browser_context):',
            f'    """Auto-generated test: {name}"""',
            '    page = browser_context.pages[0] if browser_context.pages else browser_context.new_page()',
            f'    engine = FlowstralEngine(page, app_type="{self.app_type}")',
            '    ',
            '    step_num = 0',
            '    ',
            '    try:',
        ]
        
        # Add login handling for Salesforce
        if self.app_type == "salesforce" and start_url:
            lines.extend([
                f'        # Navigate to start URL',
                f'        engine.navigate("{start_url}")',
                '        ',
                '        # Check if already logged in',
                '        time.sleep(2)',
                '        if "lightning" not in page.url.lower():',
                '            # Handle login if needed',
                '            if page.locator("[name=\'username\']").count() > 0:',
                '                print("Login required - please log in manually if MFA is needed")',
                '                # Wait for login to complete',
                '                for _ in range(120):',
                '                    if "lightning" in page.url.lower(): break',
                '                    time.sleep(1)',
                '        ',
                '        engine.wait_for_ready()',
                '        ',
            ])
        
        # Generate step code
        for i, step in enumerate(steps, 1):
            lines.append(f'        # Step {i}: {step.get("description", step.get("action", ""))}')
            lines.append(f'        step_num = {i}')
            lines.append(f'        print(f"[Step {i}] {step.get("description", step.get("action", ""))}")')
            lines.extend(self._generate_step_code(step))
            lines.append('')
        
        # Success and error handling
        lines.extend([
            '        print("\\n[SUCCESS] All steps completed!")',
            '        ',
            '    except Exception as e:',
            '        print(f"\\n[FAIL] Step {step_num} failed: {e}")',
            '        page.screenshot(path=f"failure_step_{step_num}.png")',
            '        raise',
            '    ',
            '    finally:',
            '        time.sleep(3)',
        ])
        
        return lines
    
    def _generate_step_code(self, step: Dict) -> List[str]:
        """Generate code for a single step."""
        action = step.get('action', '')
        indent = '        '
        
        if action == 'navigate':
            return [f'{indent}engine.navigate("{step.get("url", "")}")']
            
        elif action == 'click':
            args = []
            if step.get('text'): args.append(f'text="{step["text"]}"')
            if step.get('role'): args.append(f'role="{step["role"]}"')
            if step.get('selector_hint'): args.append(f'selector_hint="{step["selector_hint"]}"')
            args.append(f'description="{step.get("description", "Click")}"')
            return [f'{indent}engine.click({", ".join(args)})']
            
        elif action == 'fill':
            args = [f'"{step.get("value", "")}"']
            if step.get('label'): args.append(f'label="{step["label"]}"')
            if step.get('placeholder'): args.append(f'placeholder="{step["placeholder"]}"')
            if step.get('selector_hint'): args.append(f'selector_hint="{step["selector_hint"]}"')
            args.append(f'description="{step.get("description", "Fill")}"')
            return [f'{indent}engine.fill({", ".join(args)})']
            
        elif action == 'hover':
            return [f'{indent}engine.hover(selector_hint="{step.get("selector_hint", "")}", skip_on_fail=True)']
            
        elif action == 'sf_open_app':
            return [f'{indent}engine.sf_open_app("{step.get("app_name", "")}")']
            
        elif action == 'sf_global_search':
            return [f'{indent}engine.sf_global_search("{step.get("search_text", "")}")']
            
        elif action == 'sf_click_tab':
            return [f'{indent}engine.sf_click_tab("{step.get("tab_name", "")}")']
            
        elif action == 'sf_save':
            return [f'{indent}engine.sf_save()']
            
        elif action == 'wait':
            return [f'{indent}time.sleep({step.get("milliseconds", 1000) / 1000})']
            
        elif action == 'press_key':
            return [f'{indent}engine.page.keyboard.press("{step.get("key", "Enter")}")']
            
        elif action == 'assert':
            # Basic assertion support
            return [f'{indent}# Assertion: {step.get("description", "")}']
        
        return [f'{indent}# Unknown action: {action}']


# ============================================================
# CONVENIENCE FUNCTIONS
# ============================================================

def build_test_from_recording(recording_data: Dict, app_type: str = "auto") -> str:
    """Build test from browser extension recording."""
    builder = FlowstralTestBuilder(app_type)
    return builder.build_from_recording(recording_data)


def build_test_from_test_case(test_case: Dict, app_type: str = "auto") -> str:
    """Build test from Unified Workflow Editor test case."""
    builder = FlowstralTestBuilder(app_type)
    return builder.build_from_test_case(test_case)

