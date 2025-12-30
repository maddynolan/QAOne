"""
COMPREHENSIVE SALESFORCE AUTOMATION HELPER
==========================================
Robust automation for ALL Salesforce Lightning elements.
Handles: Shadow DOM, dynamic loading, custom components, modals, etc.

Usage in generated tests:
    from salesforce_automation_helper import SalesforceHelper
    sf = SalesforceHelper(page)
    sf.click("App Launcher")
    sf.fill("Search apps", "Accounts")
"""

import re
import time
from typing import Optional, List, Dict, Any, Tuple
from playwright.sync_api import Page, Locator, expect


class SalesforceHelper:
    """
    Comprehensive Salesforce Lightning automation helper.
    Handles all common UI patterns with self-healing selectors.
    """
    
    # ==================== SALESFORCE ELEMENT SELECTORS ====================
    # These are the most reliable selectors for Salesforce Lightning components
    
    ELEMENT_SELECTORS = {
        # App Launcher
        'app_launcher_button': [
            'div.slds-icon-waffle',
            'button[class*="appLauncher"]',
            '[data-aura-class*="appLauncher"]',
            '.slds-context-bar__icon-action',
            'one-app-launcher-header button',
        ],
        'app_launcher_search': [
            'one-app-launcher-menu input[type="search"]',
            'one-app-launcher-menu input[placeholder*="Search"]',
            'input[placeholder*="Search apps and items"]',
            'input[placeholder*="Search Apps"]',
            '.slds-modal input[type="search"]',
            '[data-aura-class*="appLauncher"] input',
            'lightning-input[class*="search"] input',
            'input.slds-input[placeholder*="Search"]',
        ],
        'app_launcher_modal': [
            'one-app-launcher-menu',
            'div.slds-modal[aria-label*="App Launcher"]',
            'section.slds-modal',
            '[role="dialog"][aria-label*="App"]',
        ],
        
        # Global Search
        'global_search': [
            'button[aria-label*="Search"]',
            'lightning-primitive-icon[icon-name*="search"]',
            '.slds-global-header__item_search',
            'one-appnav lightning-grouped-combobox input',
        ],
        
        # Navigation
        'nav_item': [
            'one-app-nav-bar-item-root a',
            '.slds-context-bar__item a',
            'li.oneConsoleNav a',
        ],
        
        # Modals and Dialogs
        'modal_container': [
            'section.slds-modal',
            'div.slds-modal__container',
            '[role="dialog"]',
            '[role="alertdialog"]',
            'lightning-modal',
        ],
        'modal_close': [
            'button.slds-modal__close',
            'lightning-button-icon[icon-name="utility:close"]',
            '[title="Close"]',
        ],
        
        # Buttons
        'button': [
            'lightning-button button',
            'button.slds-button',
            'lightning-button-icon button',
            '[data-aura-rendered-by] button',
        ],
        
        # Inputs
        'text_input': [
            'lightning-input input',
            'lightning-textarea textarea',
            'input.slds-input',
            'textarea.slds-textarea',
            'lightning-grouped-combobox input',
        ],
        
        # Lookups and Comboboxes
        'lookup_input': [
            'lightning-lookup lightning-base-combobox input',
            'lightning-grouped-combobox input',
            'lightning-base-combobox input',
            'input[role="combobox"]',
        ],
        'lookup_result': [
            'lightning-base-combobox-item',
            'li[role="option"]',
            '.slds-listbox__item',
        ],
        
        # Picklists/Dropdowns
        'picklist': [
            'lightning-combobox button',
            'lightning-base-combobox button',
            'select.slds-select',
            '[role="listbox"]',
        ],
        'picklist_option': [
            'lightning-base-combobox-item',
            'li[role="option"]',
            'option',
        ],
        
        # Checkboxes and Radio Buttons
        'checkbox': [
            'lightning-input[type="checkbox"] input',
            'lightning-primitive-input-checkbox input',
            'input[type="checkbox"]',
            '.slds-checkbox input',
        ],
        'radio': [
            'lightning-input[type="radio"] input',
            'lightning-radio-group input',
            'input[type="radio"]',
            '.slds-radio input',
        ],
        
        # Date Pickers
        'date_input': [
            'lightning-datepicker input',
            'lightning-input[type="date"] input',
            'input[type="date"]',
        ],
        
        # Tables/Lists
        'table_row': [
            'lightning-datatable tr',
            'table.slds-table tr',
            'tbody tr[data-row-key-value]',
        ],
        'list_item': [
            'lightning-formatted-text',
            '.slds-listbox__option',
            'li.slds-item',
        ],
        
        # Tabs
        'tab': [
            'lightning-tab-bar li',
            'ul.slds-tabs_default__nav li',
            '[role="tab"]',
        ],
        
        # Toasts/Notifications
        'toast': [
            'lightning-notification-toast',
            '.slds-notify_toast',
            '.forceToastMessage',
        ],
        
        # Spinners/Loading
        'spinner': [
            'lightning-spinner',
            '.slds-spinner_container',
            '.slds-spinner',
            '[data-aura-class*="spinner"]',
            '[aria-busy="true"]',
        ],
    }
    
    # ==================== INITIALIZATION ====================
    
    def __init__(self, page: Page, timeout: int = 30000):
        """Initialize with Playwright page and default timeout."""
        self.page = page
        self.timeout = timeout
        self.default_wait = 500  # ms between retries
        self.max_retries = 5
        
    # ==================== CORE UTILITIES ====================
    
    def is_salesforce(self) -> bool:
        """Detect if current page is Salesforce."""
        url = self.page.url.lower()
        return any(x in url for x in [
            'salesforce.com', 'force.com', 'lightning.force',
            'my.salesforce', 'visualforce', '.lightning.'
        ])
    
    def wait_for_salesforce_ready(self, timeout: int = None):
        """Wait for Salesforce page to be fully loaded and interactive."""
        timeout = timeout or self.timeout
        
        # 1. Wait for basic page load
        try:
            self.page.wait_for_load_state("domcontentloaded", timeout=timeout)
        except:
            pass
        
        # 2. Wait for all spinners to disappear
        self._wait_for_no_spinners(timeout=min(timeout, 15000))
        
        # 3. Wait for Lightning to be ready (check for Aura framework)
        try:
            self.page.wait_for_function(
                """() => {
                    return window.$A !== undefined || 
                           document.querySelector('lightning-app') !== null ||
                           document.querySelector('one-app') !== null;
                }""",
                timeout=min(timeout, 10000)
            )
        except:
            pass
        
        # 4. Small buffer for final rendering
        self.page.wait_for_timeout(300)
    
    def _wait_for_no_spinners(self, timeout: int = 15000):
        """Wait for all Salesforce spinners to disappear."""
        start_time = time.time()
        while (time.time() - start_time) * 1000 < timeout:
            spinners_visible = False
            for selector in self.ELEMENT_SELECTORS['spinner']:
                try:
                    if self.page.locator(selector).first.is_visible(timeout=500):
                        spinners_visible = True
                        break
                except:
                    continue
            
            if not spinners_visible:
                return
            
            self.page.wait_for_timeout(500)
        
    # ==================== SMART ELEMENT FINDING ====================
    
    def find_element(
        self, 
        description: str, 
        element_type: str = None,
        custom_selectors: List[str] = None,
        timeout: int = None
    ) -> Optional[Locator]:
        """
        Smart element finder with multiple strategies.
        
        Args:
            description: Human-readable description (e.g., "App Launcher", "Save button")
            element_type: Optional type hint (e.g., "button", "input", "link")
            custom_selectors: Additional selectors to try
            timeout: Override default timeout
            
        Returns:
            Locator if found, None otherwise
        """
        timeout = timeout or self.timeout
        desc_lower = description.lower()
        
        # Build list of selectors to try
        selectors_to_try = []
        
        # 1. Add custom selectors first (highest priority)
        if custom_selectors:
            selectors_to_try.extend(custom_selectors)
        
        # 2. Add element-type-specific selectors
        if element_type:
            type_selectors = self.ELEMENT_SELECTORS.get(element_type, [])
            selectors_to_try.extend(type_selectors)
        
        # 3. Auto-detect element type from description
        selectors_to_try.extend(self._get_selectors_from_description(desc_lower))
        
        # 4. Add generic text-based selectors
        selectors_to_try.extend([
            f'text="{description}"',
            f'text={description}',
            f'[title="{description}"]',
            f'[aria-label="{description}"]',
            f'[data-label="{description}"]',
            f'[placeholder*="{description}"]',
            f'button:has-text("{description}")',
            f'a:has-text("{description}")',
            f'span:has-text("{description}")',
        ])
        
        # 5. Add role-based selectors
        if element_type == 'button' or 'button' in desc_lower or 'click' in desc_lower:
            selectors_to_try.append(f'role=button[name="{description}"]')
        if element_type == 'link' or 'link' in desc_lower:
            selectors_to_try.append(f'role=link[name="{description}"]')
        if 'search' in desc_lower:
            selectors_to_try.append('role=searchbox')
        
        # Remove duplicates while preserving order
        seen = set()
        unique_selectors = []
        for s in selectors_to_try:
            if s not in seen:
                seen.add(s)
                unique_selectors.append(s)
        
        # Try each selector with retries
        for retry in range(self.max_retries):
            if retry > 0:
                self.page.wait_for_timeout(self.default_wait * retry)
            
            for selector in unique_selectors:
                try:
                    locator = self.page.locator(selector)
                    if locator.count() > 0:
                        # Verify it's visible
                        try:
                            locator.first.wait_for(state="visible", timeout=2000)
                            return locator.first
                        except:
                            continue
                except:
                    continue
        
        return None
    
    def _get_selectors_from_description(self, desc_lower: str) -> List[str]:
        """Get relevant selectors based on element description."""
        selectors = []
        
        # App Launcher
        if 'app launcher' in desc_lower or 'waffle' in desc_lower:
            selectors.extend(self.ELEMENT_SELECTORS['app_launcher_button'])
            selectors.extend(self.ELEMENT_SELECTORS['app_launcher_modal'])
        
        # Search
        if 'search' in desc_lower:
            if 'app' in desc_lower:
                selectors.extend(self.ELEMENT_SELECTORS['app_launcher_search'])
            selectors.extend(self.ELEMENT_SELECTORS['global_search'])
        
        # Modal
        if 'modal' in desc_lower or 'dialog' in desc_lower or 'popup' in desc_lower:
            selectors.extend(self.ELEMENT_SELECTORS['modal_container'])
        
        # Close
        if 'close' in desc_lower:
            selectors.extend(self.ELEMENT_SELECTORS['modal_close'])
        
        # Button
        if 'button' in desc_lower or 'save' in desc_lower or 'submit' in desc_lower or 'cancel' in desc_lower:
            selectors.extend(self.ELEMENT_SELECTORS['button'])
        
        # Input
        if 'input' in desc_lower or 'fill' in desc_lower or 'type' in desc_lower or 'enter' in desc_lower:
            selectors.extend(self.ELEMENT_SELECTORS['text_input'])
        
        # Lookup
        if 'lookup' in desc_lower or 'account' in desc_lower or 'contact' in desc_lower:
            selectors.extend(self.ELEMENT_SELECTORS['lookup_input'])
        
        # Picklist
        if 'picklist' in desc_lower or 'dropdown' in desc_lower or 'select' in desc_lower:
            selectors.extend(self.ELEMENT_SELECTORS['picklist'])
        
        # Checkbox
        if 'checkbox' in desc_lower or 'check' in desc_lower:
            selectors.extend(self.ELEMENT_SELECTORS['checkbox'])
        
        # Tab
        if 'tab' in desc_lower:
            selectors.extend(self.ELEMENT_SELECTORS['tab'])
        
        return selectors
    
    # ==================== HIGH-LEVEL ACTIONS ====================
    
    def click(
        self, 
        description: str, 
        element_type: str = None,
        custom_selectors: List[str] = None,
        wait_after: bool = True
    ) -> bool:
        """
        Smart click with multiple strategies.
        
        Args:
            description: What to click (e.g., "App Launcher", "Save", "Next")
            element_type: Optional type hint
            custom_selectors: Additional selectors
            wait_after: Wait for page stability after click
            
        Returns:
            True if successful
        """
        print(f"🔍 Looking for: {description}")
        
        element = self.find_element(description, element_type, custom_selectors)
        
        if not element:
            print(f"   [FAIL] Could not find: {description}")
            raise Exception(f"Element not found: {description}")
        
        # Try multiple click strategies
        strategies = [
            lambda: element.click(force=True, no_wait_after=True, timeout=10000),
            lambda: element.dispatch_event('click'),
            lambda: self.page.evaluate('(el) => el.click()', element.element_handle()),
        ]
        
        for i, strategy in enumerate(strategies):
            try:
                strategy()
                print(f"   [+] Clicked: {description}")
                
                if wait_after:
                    self.wait_for_salesforce_ready(timeout=15000)
                
                return True
            except Exception as e:
                if i == len(strategies) - 1:
                    print(f"   [FAIL] Click failed: {str(e)[:50]}")
                    raise
                continue
        
        return False
    
    def fill(
        self, 
        description: str, 
        value: str,
        element_type: str = 'text_input',
        custom_selectors: List[str] = None,
        press_enter: bool = False
    ) -> bool:
        """
        Smart fill with multiple strategies for Salesforce custom inputs.
        
        Args:
            description: Field description (e.g., "Search apps", "Account Name")
            value: Value to fill
            element_type: Type hint (default: text_input)
            custom_selectors: Additional selectors
            press_enter: Press Enter after filling
            
        Returns:
            True if successful
        """
        print(f"🔍 Looking for input: {description}")
        
        element = self.find_element(description, element_type, custom_selectors)
        
        if not element:
            print(f"   [FAIL] Could not find input: {description}")
            raise Exception(f"Input not found: {description}")
        
        # Try multiple fill strategies (Salesforce custom components need special handling)
        strategies = [
            # Strategy 1: Click + fill with timeout
            lambda: self._fill_strategy_click_fill(element, value),
            # Strategy 2: Click + clear + type
            lambda: self._fill_strategy_click_type(element, value),
            # Strategy 3: Triple-click to select all + type
            lambda: self._fill_strategy_select_type(element, value),
            # Strategy 4: Direct keyboard input
            lambda: self._fill_strategy_keyboard(element, value),
            # Strategy 5: JavaScript setValue
            lambda: self._fill_strategy_js(element, value),
        ]
        
        for i, strategy in enumerate(strategies):
            try:
                strategy()
                print(f"   [+] Filled with: {value[:30]}{'...' if len(value) > 30 else ''}")
                
                if press_enter:
                    self.page.keyboard.press('Enter')
                    self.page.wait_for_timeout(500)
                
                return True
            except Exception as e:
                if i == len(strategies) - 1:
                    print(f"   [FAIL] Fill failed: {str(e)[:50]}")
                    raise
                continue
        
        return False
    
    def _fill_strategy_click_fill(self, element: Locator, value: str):
        """Click to focus, then fill."""
        element.click(timeout=3000)
        self.page.wait_for_timeout(200)
        element.fill(value, timeout=5000)
    
    def _fill_strategy_click_type(self, element: Locator, value: str):
        """Click, clear, then type character by character."""
        element.click(timeout=3000)
        self.page.wait_for_timeout(200)
        element.fill('')  # Clear
        element.type(value, delay=30)
    
    def _fill_strategy_select_type(self, element: Locator, value: str):
        """Triple-click to select all, then type."""
        element.click(click_count=3, timeout=3000)
        self.page.wait_for_timeout(100)
        self.page.keyboard.type(value)
    
    def _fill_strategy_keyboard(self, element: Locator, value: str):
        """Focus and use keyboard directly."""
        element.focus()
        self.page.keyboard.press('Control+a')
        self.page.keyboard.type(value)
    
    def _fill_strategy_js(self, element: Locator, value: str):
        """Use JavaScript to set value."""
        element.click(timeout=3000)
        self.page.evaluate(
            """([el, val]) => {
                el.value = val;
                el.dispatchEvent(new Event('input', { bubbles: true }));
                el.dispatchEvent(new Event('change', { bubbles: true }));
            }""",
            [element.element_handle(), value]
        )
    
    def select_option(
        self, 
        description: str, 
        option: str,
        custom_selectors: List[str] = None
    ) -> bool:
        """
        Select option from picklist/dropdown.
        
        Args:
            description: Picklist description
            option: Option to select
            
        Returns:
            True if successful
        """
        print(f"🔍 Looking for picklist: {description}")
        
        # Find and click the picklist to open it
        element = self.find_element(description, 'picklist', custom_selectors)
        
        if not element:
            raise Exception(f"Picklist not found: {description}")
        
        element.click(timeout=5000)
        self.page.wait_for_timeout(500)
        
        # Find and click the option
        option_selectors = [
            f'lightning-base-combobox-item[data-value="{option}"]',
            f'li[role="option"]:has-text("{option}")',
            f'.slds-listbox__option:has-text("{option}")',
            f'option:has-text("{option}")',
            f'text="{option}"',
        ]
        
        for selector in option_selectors:
            try:
                opt = self.page.locator(selector).first
                if opt.is_visible(timeout=2000):
                    opt.click()
                    print(f"   [+] Selected: {option}")
                    return True
            except:
                continue
        
        raise Exception(f"Option not found: {option}")
    
    def lookup(
        self, 
        description: str, 
        search_text: str,
        select_first: bool = True
    ) -> bool:
        """
        Handle Salesforce lookup fields.
        
        Args:
            description: Lookup field description
            search_text: Text to search for
            select_first: Automatically select first result
            
        Returns:
            True if successful
        """
        print(f"🔍 Looking for lookup: {description}")
        
        # Find the lookup input
        element = self.find_element(description, 'lookup_input')
        
        if not element:
            raise Exception(f"Lookup not found: {description}")
        
        # Click and type to search
        element.click(timeout=3000)
        self.page.wait_for_timeout(300)
        element.fill(search_text)
        
        # Wait for results
        self.page.wait_for_timeout(1500)
        self._wait_for_no_spinners(timeout=10000)
        
        if select_first:
            # Click first result
            result_selectors = self.ELEMENT_SELECTORS['lookup_result']
            for selector in result_selectors:
                try:
                    result = self.page.locator(selector).first
                    if result.is_visible(timeout=2000):
                        result.click()
                        print(f"   [+] Selected first result for: {search_text}")
                        return True
                except:
                    continue
        
        return True
    
    def wait_for_toast(self, expected_text: str = None, timeout: int = 10000) -> bool:
        """Wait for Salesforce toast notification."""
        for selector in self.ELEMENT_SELECTORS['toast']:
            try:
                toast = self.page.locator(selector)
                toast.wait_for(state="visible", timeout=timeout)
                
                if expected_text:
                    expect(toast).to_contain_text(expected_text, timeout=5000)
                
                print(f"   [+] Toast appeared: {toast.text_content()[:50]}")
                return True
            except:
                continue
        
        return False
    
    # ==================== APP LAUNCHER SPECIFIC ====================
    
    def open_app_launcher(self) -> bool:
        """Open Salesforce App Launcher."""
        return self.click("App Launcher", element_type='app_launcher_button')
    
    def search_app_launcher(self, search_text: str) -> bool:
        """Search in App Launcher."""
        # First ensure App Launcher modal is visible
        for modal_sel in self.ELEMENT_SELECTORS['app_launcher_modal']:
            try:
                modal = self.page.locator(modal_sel)
                if modal.count() > 0:
                    modal.first.wait_for(state="visible", timeout=5000)
                    break
            except:
                continue
        
        self.page.wait_for_timeout(500)
        
        # Find and fill search
        return self.fill(
            "Search apps and items",
            search_text,
            element_type='app_launcher_search',
            custom_selectors=self.ELEMENT_SELECTORS['app_launcher_search']
        )
    
    def select_app(self, app_name: str) -> bool:
        """Select an app from App Launcher results."""
        self.page.wait_for_timeout(1000)
        
        app_selectors = [
            f'one-app-launcher-menu-item a:has-text("{app_name}")',
            f'lightning-formatted-text:has-text("{app_name}")',
            f'[data-name="{app_name}"]',
            f'text="{app_name}"',
        ]
        
        for selector in app_selectors:
            try:
                app = self.page.locator(selector).first
                if app.is_visible(timeout=3000):
                    app.click()
                    print(f"   [+] Selected app: {app_name}")
                    self.wait_for_salesforce_ready()
                    return True
            except:
                continue
        
        raise Exception(f"App not found: {app_name}")


# ==================== HELPER FUNCTION FOR GENERATED TESTS ====================

def create_salesforce_helper(page: Page) -> SalesforceHelper:
    """Create a SalesforceHelper instance for the page."""
    return SalesforceHelper(page)


# ==================== INLINE CODE FOR GENERATED TESTS ====================
# This code gets injected into generated test files

SALESFORCE_HELPER_INLINE = '''
# ==================== SALESFORCE AUTOMATION HELPER (INLINE) ====================
class SalesforceHelper:
    """Comprehensive Salesforce Lightning automation helper."""
    
    ELEMENT_SELECTORS = {
        'app_launcher_button': ['div.slds-icon-waffle', 'button[class*="appLauncher"]', '.slds-context-bar__icon-action'],
        'app_launcher_search': [
            'one-app-launcher-menu input[type="search"]', 'one-app-launcher-menu input[placeholder*="Search"]',
            'input[placeholder*="Search apps and items"]', 'input[placeholder*="Search Apps"]',
            '.slds-modal input[type="search"]', 'input.slds-input[placeholder*="Search"]',
        ],
        'app_launcher_modal': ['one-app-launcher-menu', 'section.slds-modal', '[role="dialog"]'],
        'spinner': ['lightning-spinner', '.slds-spinner_container', '.slds-spinner', '[aria-busy="true"]'],
        'text_input': ['lightning-input input', 'input.slds-input', 'textarea.slds-textarea'],
        'button': ['lightning-button button', 'button.slds-button'],
    }
    
    def __init__(self, page):
        self.page = page
        self.timeout = 30000
        self.max_retries = 5
    
    def wait_for_salesforce_ready(self, timeout=15000):
        """Wait for Salesforce page to be fully loaded."""
        try:
            self.page.wait_for_load_state("domcontentloaded", timeout=timeout)
        except:
            pass
        # Wait for spinners to disappear
        for spinner in self.ELEMENT_SELECTORS['spinner']:
            try:
                self.page.locator(spinner).wait_for(state="hidden", timeout=5000)
            except:
                pass
        self.page.wait_for_timeout(300)
    
    def find_element(self, description, element_type=None, custom_selectors=None):
        """Smart element finder with multiple strategies."""
        desc_lower = description.lower()
        selectors = list(custom_selectors or [])
        
        # Add type-specific selectors
        if element_type and element_type in self.ELEMENT_SELECTORS:
            selectors.extend(self.ELEMENT_SELECTORS[element_type])
        
        # Auto-detect from description
        if 'app launcher' in desc_lower or 'waffle' in desc_lower:
            selectors.extend(self.ELEMENT_SELECTORS['app_launcher_button'])
        if 'search' in desc_lower:
            selectors.extend(self.ELEMENT_SELECTORS['app_launcher_search'])
        
        # Generic selectors
        selectors.extend([
            f'text="{description}"', f'[title="{description}"]', f'[aria-label="{description}"]',
            f'[placeholder*="{description}"]', f'button:has-text("{description}")',
        ])
        
        # Try each selector with retries
        for retry in range(self.max_retries):
            if retry > 0:
                self.page.wait_for_timeout(1000 * retry)
            for sel in selectors:
                try:
                    loc = self.page.locator(sel)
                    if loc.count() > 0:
                        loc.first.wait_for(state="visible", timeout=3000)
                        return loc.first
                except:
                    continue
        return None
    
    def click(self, description, element_type=None, custom_selectors=None, wait_after=True):
        """Smart click with multiple strategies."""
        print(f"🔍 [SF] Looking for: {description}")
        el = self.find_element(description, element_type, custom_selectors)
        if not el:
            raise Exception(f"Element not found: {description}")
        
        strategies = [
            lambda: el.click(force=True, no_wait_after=True, timeout=10000),
            lambda: el.dispatch_event('click'),
            lambda: self.page.evaluate('(e) => e.click()', el.element_handle()),
        ]
        for strat in strategies:
            try:
                strat()
                print(f"   [+] Clicked: {description}")
                if wait_after:
                    self.wait_for_salesforce_ready()
                return True
            except:
                continue
        raise Exception(f"Click failed: {description}")
    
    def fill(self, description, value, element_type='text_input', custom_selectors=None, press_enter=False):
        """Smart fill with multiple strategies for Salesforce custom inputs."""
        print(f"🔍 [SF] Looking for input: {description}")
        el = self.find_element(description, element_type, custom_selectors)
        if not el:
            raise Exception(f"Input not found: {description}")
        
        strategies = [
            # Strategy 1: Click + fill
            lambda: (el.click(timeout=3000), self.page.wait_for_timeout(200), el.fill(value, timeout=5000)),
            # Strategy 2: Click + type
            lambda: (el.click(timeout=3000), self.page.wait_for_timeout(200), el.type(value, delay=30)),
            # Strategy 3: Triple-click + keyboard
            lambda: (el.click(click_count=3, timeout=3000), self.page.keyboard.type(value)),
            # Strategy 4: Focus + keyboard
            lambda: (el.focus(), self.page.keyboard.press('Control+a'), self.page.keyboard.type(value)),
        ]
        for strat in strategies:
            try:
                strat()
                print(f"   [+] Filled: {value[:30]}...")
                if press_enter:
                    self.page.keyboard.press('Enter')
                return True
            except:
                continue
        raise Exception(f"Fill failed: {description}")
    
    def open_app_launcher(self):
        return self.click("App Launcher", element_type='app_launcher_button')
    
    def search_app_launcher(self, text):
        # Wait for modal
        for sel in self.ELEMENT_SELECTORS['app_launcher_modal']:
            try:
                self.page.locator(sel).first.wait_for(state="visible", timeout=5000)
                break
            except:
                continue
        self.page.wait_for_timeout(500)
        return self.fill("Search apps", text, custom_selectors=self.ELEMENT_SELECTORS['app_launcher_search'])
    
    def select_app(self, name):
        self.page.wait_for_timeout(1000)
        for sel in [f'one-app-launcher-menu-item a:has-text("{name}")', f'text="{name}"']:
            try:
                app = self.page.locator(sel).first
                if app.is_visible(timeout=3000):
                    app.click()
                    print(f"   [+] Selected: {name}")
                    self.wait_for_salesforce_ready()
                    return True
            except:
                continue
        raise Exception(f"App not found: {name}")

# Create helper instance
sf = SalesforceHelper(page)
'''

