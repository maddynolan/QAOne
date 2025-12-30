"""
FLOWSTRAL ENGINE DEMO
=====================
Demonstrates the robust Salesforce automation using the new Flowstral Engine.

MODES:
------
1. STANDALONE (default): Launches external Playwright browser
   Run: python -m pytest tests/demo_flowstral_engine.py -v -s

2. DOCKED/EMBEDDED: Uses Electron BrowserView docked in QAAI desktop app
   Run: Launch flowstral-desktop app, then use the embedded browser panel
   
The docked mode (like Copado CRT) embeds the browser directly in the Electron
app window using BrowserView - no separate browser window!
"""

import sys
import os
import time
import re
import json
from typing import Optional, List, Union
from playwright.sync_api import sync_playwright, Page, Locator
import pytest


# ============================================================
# EXECUTION MODE
# ============================================================
# Set to "embedded" to use docked browser in Electron app
# Set to "standalone" for separate Playwright browser window
EXECUTION_MODE = os.environ.get("FLOWSTRAL_MODE", "standalone")


# ============================================================
# EMBEDDED BROWSER BRIDGE (for docked mode in Electron app)
# ============================================================

class EmbeddedBrowserBridge:
    """
    Bridge to control the docked browser in Flowstral Desktop Electron app.
    
    In docked mode, the browser is a BrowserView attached to the Electron window
    (like Copado CRT). This bridge communicates via WebSocket to control it.
    
    Usage:
        1. Launch flowstral-desktop app
        2. The app exposes WebSocket on localhost:9222
        3. This bridge sends commands to control the embedded browser
    """
    
    def __init__(self, ws_url: str = "ws://localhost:9222", verbose: bool = True):
        self.ws_url = ws_url
        self.verbose = verbose
        self.ws = None
        self._connected = False
        
    def _log(self, msg: str):
        if self.verbose:
            print(f"[EMBEDDED] {msg}")
    
    def connect(self):
        """Connect to Flowstral Desktop's embedded browser."""
        try:
            import websocket
            self.ws = websocket.create_connection(self.ws_url, timeout=5)
            self._connected = True
            self._log(f"Connected to docked browser at {self.ws_url}")
            return True
        except ImportError:
            self._log("ERROR: websocket-client not installed. Run: pip install websocket-client")
            return False
        except Exception as e:
            self._log(f"ERROR: Could not connect to Flowstral Desktop: {e}")
            self._log("Make sure flowstral-desktop app is running!")
            return False
    
    def disconnect(self):
        """Disconnect from the embedded browser."""
        if self.ws:
            self.ws.close()
            self._connected = False
    
    def _send_command(self, command: str, params: dict = None) -> dict:
        """Send command to embedded browser and get response."""
        if not self._connected:
            raise Exception("Not connected to embedded browser")
        
        msg = json.dumps({"command": command, "params": params or {}})
        self.ws.send(msg)
        response = json.loads(self.ws.recv())
        return response
    
    def navigate(self, url: str):
        """Navigate the embedded browser to URL."""
        self._log(f"Navigate: {url}")
        return self._send_command("navigate", {"url": url})
    
    def click(self, selector: str = None, text: str = None):
        """Click element in embedded browser."""
        self._log(f"Click: {selector or text}")
        return self._send_command("click", {"selector": selector, "text": text})
    
    def fill(self, value: str, selector: str = None, label: str = None):
        """Fill input in embedded browser."""
        self._log(f"Fill: {selector or label} = {value[:20]}...")
        return self._send_command("fill", {"value": value, "selector": selector, "label": label})
    
    def start_recording(self):
        """Start recording actions in embedded browser."""
        self._log("Start recording")
        return self._send_command("startRecording")
    
    def stop_recording(self):
        """Stop recording and get actions."""
        self._log("Stop recording")
        return self._send_command("stopRecording")
    
    def get_actions(self) -> List[dict]:
        """Get recorded actions."""
        result = self._send_command("getActions")
        return result.get("actions", [])
    
    def execute_script(self, script: str):
        """Execute JavaScript in embedded browser."""
        return self._send_command("executeScript", {"script": script})
    
    def screenshot(self, path: str = None):
        """Take screenshot of embedded browser."""
        return self._send_command("screenshot", {"path": path})
    
    @property
    def is_connected(self) -> bool:
        return self._connected


# ============================================================
# FLOWSTRAL ENGINE (embedded for portability)
# ============================================================

class FlowstralEngine:
    """Robust automation engine for Salesforce and enterprise apps."""
    
    def __init__(self, page: Page, app_type: str = "salesforce", verbose: bool = True):
        self.page = page
        self.app_type = app_type
        self.verbose = verbose
        self._configure_app()
    
    def _log(self, msg: str):
        if self.verbose:
            print(f"[FLOWSTRAL] {msg}")
    
    def _configure_app(self):
        """Configure for specific app type."""
        if self.app_type == "salesforce":
            self.loading_selectors = [
                "lightning-spinner", ".slds-spinner",
                ".slds-spinner_container:not(.slds-hide)", "[aria-busy='true']"
            ]
            self.component_selectors = {
                "app_launcher": [
                    "div.slds-icon-waffle", 
                    "button.slds-icon-waffle", 
                    ".appLauncher button",
                    "[title='App Launcher']",
                    "one-app-launcher-header button",
                    ".slds-context-bar__icon-action"
                ],
                "app_launcher_search": [
                    "one-app-launcher-menu input[type='search']", 
                    "input[placeholder*='Search apps']",
                    "input[placeholder*='Search Apps']",
                    ".appLauncherMenu input"
                ],
                "save_button": [
                    "button[name='SaveEdit']", 
                    "button:has-text('Save')", 
                    ".slds-modal__footer button:has-text('Save')"
                ],
            }
        else:
            self.loading_selectors = [".loading", ".spinner", "[aria-busy='true']"]
            self.component_selectors = {}
    
    # === WAITING ===
    
    def wait_for_ready(self, timeout: int = 15000):
        """Wait for page to be ready."""
        try:
            self.page.wait_for_load_state("domcontentloaded", timeout=timeout)
        except:
            pass
        
        # Wait for spinners to disappear
        start = time.time()
        while (time.time() - start) < (timeout / 1000):
            has_spinner = False
            for sel in self.loading_selectors:
                try:
                    if self.page.locator(sel).is_visible(timeout=500):
                        has_spinner = True
                        break
                except:
                    pass
            if not has_spinner:
                break
            time.sleep(0.3)
        
        time.sleep(0.2)
    
    # === ELEMENT FINDING ===
    
    def _find_element(self, 
                      text: str = None, 
                      role: str = None, 
                      label: str = None,
                      placeholder: str = None,
                      title: str = None,
                      selector_hint: str = None,
                      component: str = None,
                      timeout: int = 10000) -> Optional[Locator]:
        """Find element using smart strategies."""
        strategies = []
        
        # Strategy 1: App-specific component
        if component and component in self.component_selectors:
            for sel in self.component_selectors[component]:
                strategies.append(("component", self.page.locator(sel)))
        
        # Strategy 2: Role + name (most reliable)
        if role and text:
            strategies.append(("role+text", self.page.get_by_role(role, name=text)))
            strategies.append(("role+text_contains", self.page.get_by_role(role, name=re.compile(text, re.IGNORECASE))))
        
        # Strategy 3: Label-based (for inputs)
        if label:
            strategies.append(("label", self.page.get_by_label(label)))
            strategies.append(("label_contains", self.page.get_by_label(re.compile(label, re.IGNORECASE))))
        
        # Strategy 4: Placeholder
        if placeholder:
            strategies.append(("placeholder", self.page.get_by_placeholder(placeholder)))
            strategies.append(("placeholder_contains", self.page.get_by_placeholder(re.compile(placeholder, re.IGNORECASE))))
        
        # Strategy 5: Text content
        if text:
            strategies.append(("text_exact", self.page.get_by_text(text, exact=True)))
            strategies.append(("text_contains", self.page.get_by_text(text)))
        
        # Strategy 6: Title attribute
        if title:
            strategies.append(("title", self.page.get_by_title(title)))
        
        # Strategy 7: Selector hint (fallback)
        if selector_hint:
            try:
                if selector_hint.startswith("page."):
                    strategies.append(("hint", eval(selector_hint)))
                else:
                    strategies.append(("hint", self.page.locator(selector_hint)))
            except:
                pass
        
        # Try each strategy
        for name, locator in strategies:
            try:
                if locator.count() > 0:
                    if locator.first.is_visible(timeout=2000):
                        self._log(f"   Found via: {name}")
                        return locator.first
                    elif locator.count() > 1:
                        # Try visible filter
                        visible = locator.locator("visible=true")
                        if visible.count() > 0:
                            self._log(f"   Found via: {name} (visible)")
                            return visible.first
            except:
                continue
        
        return None
    
    # === ACTIONS ===
    
    def click(self, 
              text: str = None,
              role: str = None,
              label: str = None,
              title: str = None,
              component: str = None,
              selector_hint: str = None,
              timeout: int = 10000,
              description: str = None) -> bool:
        """Click an element by intent."""
        desc = description or text or label or "element"
        self._log(f"Click: {desc}")
        
        self.wait_for_ready(timeout=5000)
        
        # Retry loop
        for attempt in range(3):
            element = self._find_element(
                text=text, role=role, label=label, title=title,
                component=component, selector_hint=selector_hint, timeout=timeout
            )
            
            if not element:
                if attempt < 2:
                    self._log(f"   [RETRY {attempt+1}] Waiting 2s...")
                    time.sleep(2)
                    continue
                raise Exception(f"Element not found: {desc}")
            
            try:
                element.scroll_into_view_if_needed()
            except:
                pass
            
            try:
                element.click(force=True, timeout=5000)
                self._log(f"   [+] Clicked")
                self.wait_for_ready(timeout=5000)
                return True
            except Exception as e:
                if attempt < 2:
                    self._log(f"   [RETRY {attempt+1}] Click failed, retrying...")
                    time.sleep(1)
                    continue
                raise
        
        return False
    
    def fill(self,
             value: str,
             label: str = None,
             placeholder: str = None,
             role: str = "textbox",
             selector_hint: str = None,
             timeout: int = 10000,
             description: str = None) -> bool:
        """Fill an input field."""
        desc = description or label or placeholder or "input"
        self._log(f"Fill: {desc} = '{value[:30]}...'" if len(value) > 30 else f"Fill: {desc} = '{value}'")
        
        self.wait_for_ready(timeout=5000)
        
        for attempt in range(3):
            element = self._find_element(
                label=label, placeholder=placeholder, role=role,
                selector_hint=selector_hint, timeout=timeout
            )
            
            if not element:
                if attempt < 2:
                    self._log(f"   [RETRY {attempt+1}] Waiting 1.5s...")
                    time.sleep(1.5)
                    continue
                raise Exception(f"Input not found: {desc}")
            
            try:
                element.scroll_into_view_if_needed()
            except:
                pass
            
            # Try multiple fill strategies
            strategies = [
                lambda: self._fill_click_fill(element, value),
                lambda: self._fill_click_type(element, value),
                lambda: self._fill_focus_type(element, value),
            ]
            
            for strategy in strategies:
                try:
                    strategy()
                    self._log(f"   [+] Filled")
                    return True
                except:
                    continue
            
            if attempt < 2:
                time.sleep(1)
        
        raise Exception(f"Could not fill: {desc}")
    
    def _fill_click_fill(self, element: Locator, value: str):
        element.click(timeout=2000)
        time.sleep(0.1)
        element.fill("", timeout=1000)
        element.fill(value, timeout=3000)
    
    def _fill_click_type(self, element: Locator, value: str):
        element.click(timeout=2000)
        self.page.keyboard.press("Control+a")
        element.type(value, delay=30)
    
    def _fill_focus_type(self, element: Locator, value: str):
        element.focus()
        self.page.keyboard.press("Control+a")
        self.page.keyboard.type(value)
    
    def navigate(self, url: str):
        """Navigate to URL."""
        self._log(f"Navigate: {url}")
        self.page.goto(url)
        self.wait_for_ready()
    
    def hover(self, text: str = None, selector_hint: str = None, skip_on_fail: bool = True):
        """Hover over element (non-critical, skips on failure)."""
        try:
            element = self._find_element(text=text, selector_hint=selector_hint, timeout=3000)
            if element:
                element.hover(timeout=2000)
                self._log(f"   Hovered: {text or 'element'}")
        except:
            if skip_on_fail:
                self._log(f"   [SKIP] Hover - non-critical")
            else:
                raise
    
    # === SALESFORCE-SPECIFIC ===
    
    def sf_open_app(self, app_name: str):
        """Open Salesforce app from App Launcher."""
        self._log(f"[SF] Opening app: {app_name}")
        
        # Find and click waffle icon with multiple selectors
        waffle_selectors = [
            'div.slds-icon-waffle',
            'button.slds-icon-waffle',
            '.appLauncher button',
            '[title="App Launcher"]',
            'one-app-launcher-header button',
            '.slds-context-bar__icon-action',
        ]
        
        waffle_clicked = False
        for sel in waffle_selectors:
            try:
                waffle = self.page.locator(sel).first
                if waffle.is_visible(timeout=2000):
                    waffle.click(force=True)
                    self._log(f"   [+] Clicked waffle via: {sel}")
                    waffle_clicked = True
                    break
            except:
                continue
        
        if not waffle_clicked:
            raise Exception("App Launcher (waffle) not found")
        
        time.sleep(1)
        
        # Wait for modal and search
        modal_found = False
        for _ in range(15):
            modal = self.page.locator("one-app-launcher-menu, .slds-modal, div.appLauncherMenu")
            if modal.count() > 0:
                try:
                    if modal.first.is_visible(timeout=1000):
                        modal_found = True
                        self._log("   [+] App Launcher modal opened")
                        break
                except:
                    pass
            time.sleep(0.5)
        
        if not modal_found:
            self._log("   [WARN] Modal not detected, continuing anyway...")
        
        time.sleep(0.5)
        
        # Fill search with multiple selector attempts
        search_selectors = [
            'one-app-launcher-menu input[type="search"]',
            'input[placeholder*="Search apps"]',
            'input[placeholder*="Search Apps"]',
            '.appLauncherMenu input',
            'one-app-launcher-search-bar input',
        ]
        
        search_filled = False
        for sel in search_selectors:
            try:
                search = self.page.locator(sel).first
                if search.is_visible(timeout=2000):
                    search.click()
                    time.sleep(0.2)
                    search.fill(app_name)
                    self._log(f"   [+] Filled search via: {sel}")
                    search_filled = True
                    break
            except:
                continue
        
        if not search_filled:
            self._log("   [WARN] Could not fill search, trying to find app directly...")
        
        time.sleep(0.5)
        
        # Click result
        result_selectors = [
            f'one-app-launcher-menu-item a:has-text("{app_name}")',
            f'p.slds-truncate:has-text("{app_name}")',
            f'mark:has-text("{app_name}")',
            f'lightning-formatted-text:has-text("{app_name}")',
            f'a:has-text("{app_name}")',
        ]
        for sel in result_selectors:
            try:
                result = self.page.locator(sel).first
                if result.is_visible(timeout=2000):
                    result.click()
                    self._log(f"   [+] Selected: {app_name}")
                    self.wait_for_ready()
                    return True
            except:
                continue
        
        raise Exception(f"App not found: {app_name}")
    
    def sf_global_search(self, text: str):
        """Use Salesforce global search."""
        self._log(f"[SF] Global search: {text}")
        
        # Try multiple selectors to find and click global search
        search_button_selectors = [
            'button[title="Search"]',
            '.slds-global-actions__item button[title*="Search"]',
            'lightning-global-search button',
            '[aria-label="Search"]',
            '.forceSearchDesktopHeader button',
        ]
        
        search_clicked = False
        for sel in search_button_selectors:
            try:
                btn = self.page.locator(sel).first
                if btn.is_visible(timeout=2000):
                    btn.click(force=True)
                    self._log(f"   [+] Clicked search via: {sel}")
                    search_clicked = True
                    break
            except:
                continue
        
        if not search_clicked:
            self._log("   [WARN] Search button not found, trying direct input...")
        
        time.sleep(0.5)
        
        # Fill search input
        search_input_selectors = [
            'input[placeholder*="Search"]',
            'input.search-input',
            'div.assistantPanel input',
            'lightning-input-field input[type="search"]',
            '.slds-combobox__input',
        ]
        
        for sel in search_input_selectors:
            try:
                search = self.page.locator(sel).first
                if search.is_visible(timeout=3000):
                    search.click()
                    time.sleep(0.2)
                    search.fill(text)
                    self._log(f"   [+] Filled search via: {sel}")
                    self.page.keyboard.press("Enter")
                    self.wait_for_ready()
                    return True
            except:
                continue
        
        raise Exception("Search input not found")
    
    def sf_click_tab(self, tab_name: str):
        """Click a Salesforce record tab."""
        self._log(f"[SF] Click tab: {tab_name}")
        tab_selectors = [
            f'a[data-label="{tab_name}"]',
            f'[role="tab"]:has-text("{tab_name}")',
            f'lightning-tab-bar a:has-text("{tab_name}")',
        ]
        for sel in tab_selectors:
            try:
                tab = self.page.locator(sel).first
                if tab.is_visible(timeout=2000):
                    tab.click()
                    self._log(f"   [+] Clicked tab: {tab_name}")
                    return True
            except:
                continue
        raise Exception(f"Tab not found: {tab_name}")
    
    def sf_save(self):
        """Click Salesforce Save button."""
        self.click(component="save_button", text="Save", role="button", description="Save")


# ============================================================
# TEST FIXTURES
# ============================================================

@pytest.fixture(scope="function")
def embedded_browser():
    """
    Connect to DOCKED browser in Flowstral Desktop Electron app.
    
    This mode embeds the browser directly in the app window (like Copado CRT)
    instead of launching a separate browser window.
    
    Prerequisites:
    1. flowstral-desktop app must be running
    2. WebSocket server enabled on localhost:9222
    """
    print("\n" + "="*60)
    print("DOCKED BROWSER MODE (Electron BrowserView)")
    print("="*60)
    print("This mode uses the browser embedded in Flowstral Desktop app.")
    print("No separate browser window - it's docked in the app panel!")
    print("="*60 + "\n")
    
    bridge = EmbeddedBrowserBridge(verbose=True)
    
    if not bridge.connect():
        pytest.skip("Flowstral Desktop app not running. Launch it first or use standalone mode.")
    
    yield bridge
    
    bridge.disconnect()


@pytest.fixture(scope="function")
def browser_context():
    """
    Create PERSISTENT browser context for standalone mode.
    This remembers cookies, localStorage, and MFA verification between runs!
    """
    # Use persistent context to bypass MFA on subsequent runs
    user_data_dir = os.path.join(os.environ.get('TEMP', '/tmp'), 'playwright_salesforce_session')
    os.makedirs(user_data_dir, exist_ok=True)
    
    print(f"\n[BROWSER] STANDALONE MODE - Using persistent session at: {user_data_dir}")
    print("[BROWSER] First run will require MFA. Subsequent runs will remember the session.\n")
    
    with sync_playwright() as p:
        # Launch with persistent context - remembers cookies, localStorage, MFA verification
        context = p.chromium.launch_persistent_context(
            user_data_dir,
            headless=False,
            slow_mo=100,
            viewport={"width": 1920, "height": 1080}
        )
        yield context
        context.close()


def test_salesforce_embedded(embedded_browser):
    """
    Demo test using DOCKED browser in Flowstral Desktop Electron app.
    
    This is the Copado CRT-style experience where the browser is embedded
    directly in the application window - no separate browser window!
    
    Prerequisites:
    - Flowstral Desktop app must be running
    - Browser panel should be visible in the app
    
    Run with: FLOWSTRAL_MODE=embedded python -m pytest tests/demo_flowstral_engine.py::test_salesforce_embedded -v -s
    """
    bridge = embedded_browser
    
    # Configuration
    SF_URL = "https://orgfarm-bac28d1362-dev-ed.develop.my.salesforce.com"
    SF_USERNAME = "madhanvarmah858@agentforce.com"
    SF_PASSWORD = "Tenet@July2020"
    
    try:
        print("\n" + "="*60)
        print("Step 1: Navigate to Salesforce (in docked browser)")
        print("="*60)
        bridge.navigate(SF_URL)
        time.sleep(3)
        
        print("\n" + "="*60)
        print("Step 2: Login")
        print("="*60)
        bridge.fill(SF_USERNAME, selector="[name='username']")
        bridge.fill(SF_PASSWORD, selector="[name='pw']")
        bridge.click(selector="[name='Login']")
        
        print("\n[INFO] If MFA is required, complete it in the docked browser panel")
        print("[INFO] The session will be remembered for future runs")
        time.sleep(10)  # Wait for login/MFA
        
        print("\n" + "="*60)
        print("Step 3: Start Recording")
        print("="*60)
        bridge.start_recording()
        
        print("\n[INFO] Now interact with Salesforce in the docked browser...")
        print("[INFO] All actions will be recorded automatically!")
        print("[INFO] Press Ctrl+C when done or wait 60 seconds")
        
        # Wait and collect recorded actions
        for i in range(60):
            time.sleep(1)
            actions = bridge.get_actions()
            if actions:
                print(f"[RECORDED] {len(actions)} actions so far...")
        
        print("\n" + "="*60)
        print("Step 4: Stop Recording")
        print("="*60)
        bridge.stop_recording()
        actions = bridge.get_actions()
        
        print(f"\n[SUCCESS] Recorded {len(actions)} actions!")
        for i, action in enumerate(actions):
            print(f"  {i+1}. {action.get('type', 'unknown')}: {action.get('element', {}).get('text', '')[:40]}")
        
    except KeyboardInterrupt:
        print("\n[INFO] Recording stopped by user")
        bridge.stop_recording()
        actions = bridge.get_actions()
        print(f"[SUCCESS] Captured {len(actions)} actions")
    
    except Exception as e:
        print(f"\n[ERROR] Test failed: {e}")
        raise


def test_salesforce_demo(browser_context):
    """
    Demo test showing the Flowstral Engine in STANDALONE mode.
    
    This launches a SEPARATE browser window (not docked in app).
    
    This test:
    1. Logs into Salesforce (with MFA bypass via persistent session)
    2. Opens Accounts app
    3. Searches for an account
    4. Views account details
    
    FIRST RUN: Will ask for MFA code - enter it manually
    SUBSEQUENT RUNS: Will skip MFA (session remembered)
    
    Run with: python -m pytest tests/demo_flowstral_engine.py::test_salesforce_demo -v -s
    """
    # Get existing page or create new one
    page = browser_context.pages[0] if browser_context.pages else browser_context.new_page()
    engine = FlowstralEngine(page, app_type="salesforce")
    
    # Configuration - UPDATE THESE!
    SF_URL = "https://orgfarm-bac28d1362-dev-ed.develop.my.salesforce.com"
    SF_USERNAME = "madhanvarmah858@agentforce.com"
    SF_PASSWORD = "Tenet@July2020"
    
    try:
        # Step 1: Navigate to Salesforce
        print("\n" + "="*60)
        print("Step 1: Navigate to Salesforce")
        print("="*60)
        engine.navigate(SF_URL)
        
        # Check if we're already logged in (persistent session)
        time.sleep(2)
        current_url = page.url.lower()
        already_logged_in = 'lightning' in current_url or 'home' in current_url
        
        if already_logged_in:
            print("Already logged in from previous session! Skipping login...")
        else:
            # Step 2: Login
            print("\n" + "="*60)
            print("Step 2: Login")
            print("="*60)
            
            # Check if username field exists (we're on login page)
            username_field = page.locator("[name='username']")
            if username_field.count() > 0:
                engine.fill(SF_USERNAME, selector_hint="[name='username']", description="Username")
                engine.fill(SF_PASSWORD, selector_hint="[name='pw']", description="Password")
                engine.click(selector_hint="[name='Login']", text="Log In", role="button", description="Login Button")
                
                # Check if MFA is required
                time.sleep(3)
                mfa_input = page.locator("input[placeholder*='code'], input[name*='otp'], input[name*='verification']")
                if mfa_input.count() > 0:
                    print("\n" + "!"*60)
                    print("! MFA REQUIRED - Please enter the code manually in the browser !")
                    print("! The test will continue after you complete MFA...")
                    print("!"*60 + "\n")
                    
                    # Wait for MFA to complete (up to 2 minutes)
                    for i in range(120):
                        time.sleep(1)
                        if 'lightning' in page.url.lower() or 'home' in page.url.lower():
                            print("MFA completed! Continuing...")
                            break
                        if i % 10 == 0:
                            print(f"Waiting for MFA... ({i}s)")
            else:
                print("Login page not detected, may already be logged in...")
        
        # Wait for Salesforce Lightning to load
        print("Waiting for Salesforce Lightning to load...")
        time.sleep(5)
        engine.wait_for_ready(timeout=30000)
        
        # Extra wait for the header to appear
        try:
            engine.page.locator('.slds-global-header, one-app-launcher-header, .slds-icon-waffle').first.wait_for(state="visible", timeout=15000)
            print("Lightning header detected!")
        except:
            print("Header not detected, continuing anyway...")
        
        # Step 3: Open Accounts app
        print("\n" + "="*60)
        print("Step 3: Open Accounts via App Launcher")
        print("="*60)
        engine.sf_open_app("Accounts")
        
        # Step 4: Global search
        print("\n" + "="*60)
        print("Step 4: Search for account")
        print("="*60)
        engine.sf_global_search("Flowstral Test Account")
        
        # Step 5: Click on result
        print("\n" + "="*60)
        print("Step 5: Click on account")
        print("="*60)
        engine.click(text="Flowstral Test Account", role="link", description="Account link")
        
        # Step 6: Click Details tab
        print("\n" + "="*60)
        print("Step 6: Click Details tab")
        print("="*60)
        engine.sf_click_tab("Details")
        
        print("\n" + "="*60)
        print("[SUCCESS] All steps completed!")
        print("="*60)
        
    except Exception as e:
        print(f"\n[ERROR] Test failed: {e}")
        page.screenshot(path="failure_demo.png")
        raise
    
    finally:
        # Keep browser open for inspection
        print("\nBrowser will stay open for 10 seconds for inspection...")
        time.sleep(10)


if __name__ == "__main__":
    import subprocess
    
    print("""
╔═══════════════════════════════════════════════════════════════════╗
║             FLOWSTRAL ENGINE DEMO - SELECT MODE                   ║
╠═══════════════════════════════════════════════════════════════════╣
║                                                                   ║
║  1. STANDALONE MODE (separate browser window)                     ║
║     > python -m pytest tests/demo_flowstral_engine.py::test_salesforce_demo -v -s
║                                                                   ║
║  2. DOCKED MODE (browser embedded in Electron app)                ║
║     > First: Launch flowstral-desktop app                         ║
║     > Then:  FLOWSTRAL_MODE=embedded python -m pytest             ║
║              tests/demo_flowstral_engine.py::test_salesforce_embedded -v -s
║                                                                   ║
║  Docked mode = Copado CRT-style experience!                       ║
║  Browser appears IN the app window, not as separate window.       ║
║                                                                   ║
╚═══════════════════════════════════════════════════════════════════╝
""")
    
    # Default: run standalone mode
    if EXECUTION_MODE == "embedded":
        test_name = "test_salesforce_embedded"
    else:
        test_name = "test_salesforce_demo"
    
    exit_code = subprocess.call([
        "python", "-m", "pytest", 
        f"{__file__}::{test_name}", 
        "-v", "-s", "--tb=short"
    ])
    sys.exit(exit_code)

