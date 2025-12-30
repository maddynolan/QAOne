"""
SALESFORCE PLUGIN
=================
Deep knowledge of Salesforce Lightning Web Components (LWC) and Aura.

This plugin understands:
- Lightning component structure
- Salesforce-specific selectors
- App Launcher, Global Search, Record Pages
- Modal/drawer handling
- Dynamic Aura framework
"""

import time
from typing import Optional, List, Dict, Any
from playwright.sync_api import Page, Locator


class SalesforcePlugin:
    """
    Salesforce-specific automation intelligence.
    
    Understands:
    - Lightning Web Components (LWC)
    - Aura Components
    - SLDS (Salesforce Lightning Design System)
    - Salesforce page structures
    """
    
    # ==================== COMPONENT SELECTORS ====================
    # Comprehensive selectors for ALL major Salesforce Lightning components
    
    COMPONENTS = {
        # App Launcher
        'app_launcher_button': [
            'div.slds-icon-waffle',
            'button.slds-icon-waffle',
            '.appLauncher button',
            '[title="App Launcher"]',
            'one-app-launcher-header button',
        ],
        'app_launcher_modal': [
            'one-app-launcher-menu',
            '.appLauncherMenu',
            'div.slds-app-launcher',
        ],
        'app_launcher_search': [
            'one-app-launcher-menu input[type="search"]',
            'one-app-launcher-menu input[placeholder*="Search"]',
            'input.slds-input[placeholder*="Search apps"]',
            '.appLauncherMenu input',
        ],
        'app_launcher_item': [
            'one-app-launcher-menu-item a',
            'lightning-formatted-text',
            '.slds-app-launcher__tile-body a',
        ],
        
        # Global Search
        'global_search_button': [
            'button.slds-global-actions__item[title="Search"]',
            '[title="Search"]',
            'lightning-global-search button',
        ],
        'global_search_input': [
            'lightning-input-field input[type="search"]',
            'input[placeholder*="Search"]',
            '.search-input-container input',
            'div.assistantPanel input',
        ],
        'global_search_results': [
            'search_dialog-instant-result-item',
            '.slds-listbox__option',
            'li[data-aura-class="searchResultsListOption"]',
        ],
        
        # Navigation
        'tab_bar': [
            '.slds-context-bar__secondary nav',
            '.slds-context-bar',
            'one-app-nav-bar',
        ],
        'nav_item': [
            'one-app-nav-bar-item-root a',
            '.slds-context-bar__item a',
            '[data-tab-value]',
        ],
        
        # Record Pages
        'record_header': [
            'records-record-layout-event-broker',
            'records-lwc-highlights-panel',
            '.slds-page-header',
        ],
        'record_tab': [
            'lightning-tab-bar a[role="tab"]',
            '[role="tablist"] a',
            'a[data-tab-value]',
        ],
        'detail_tab': [
            'a[data-label="Details"]',
            '[role="tab"]:has-text("Details")',
            'lightning-tab-bar a:has-text("Details")',
        ],
        'related_tab': [
            'a[data-label="Related"]',
            '[role="tab"]:has-text("Related")',
        ],
        
        # Forms and Inputs
        'lightning_input': [
            'lightning-input input',
            'lightning-input textarea',
            'lightning-textarea textarea',
            'lightning-combobox input',
        ],
        'lightning_button': [
            'lightning-button button',
            'button.slds-button',
            '[data-aura-class="uiButton"]',
        ],
        'record_form': [
            'records-record-edit-form',
            'lightning-record-edit-form',
            'records-form',
        ],
        
        # Modals
        'modal': [
            'section[role="dialog"]',
            '.slds-modal',
            'lightning-modal',
        ],
        'modal_header': [
            '.slds-modal__header h2',
            'lightning-modal-header',
        ],
        'modal_footer': [
            '.slds-modal__footer',
            'lightning-modal-footer',
        ],
        'modal_close': [
            '.slds-modal__close',
            'button[title="Close"]',
        ],
        
        # Buttons
        'save_button': [
            'button[name="SaveEdit"]',
            'lightning-button[name="SaveEdit"] button',
            'button:has-text("Save")',
            '.slds-modal__footer button:has-text("Save")',
        ],
        'edit_button': [
            'button[name="Edit"]',
            'button[title^="Edit"]',
            'lightning-button[name="Edit"] button',
        ],
        'new_button': [
            'button[name="New"]',
            'button:has-text("New")',
            'li.slds-button_last button',
        ],
        'cancel_button': [
            'button[name="CancelEdit"]',
            'button:has-text("Cancel")',
        ],
        
        # Tables/Lists
        'data_table': [
            'lightning-datatable',
            'table.slds-table',
            'lst-list-view-manager-wrapper',
        ],
        'table_row': [
            'lightning-datatable tbody tr',
            'table.slds-table tbody tr',
        ],
        'table_cell': [
            'lightning-primitive-cell-factory',
            'td.slds-cell',
        ],
        
        # Toasts/Notifications
        'toast': [
            'div.toastContainer',
            'lightning-toast',
            '.forceToastMessage',
        ],
        'toast_close': [
            '.toastClose',
            'lightning-button-icon.slds-notify__close',
        ],
        
        # Spinners/Loading
        'spinner': [
            'lightning-spinner',
            '.slds-spinner_container:not(.slds-hide)',
            '.slds-spinner',
            '.loading',
        ],
    }
    
    # ==================== INITIALIZATION ====================
    
    def __init__(self, page: Page):
        self.page = page
    
    # ==================== COMPONENT FINDING ====================
    
    def find_component(self, intent) -> Optional[Locator]:
        """
        Find a Salesforce component based on intent.
        Returns None if not a recognized Salesforce pattern.
        """
        desc = (intent.description or "").lower()
        component_type = intent.component_type
        
        # App Launcher detection
        if component_type == "app_launcher" or "app launcher" in desc or "waffle" in desc:
            return self._find_with_selectors(self.COMPONENTS['app_launcher_button'])
        
        # Global Search detection
        if "search" in desc and ("global" in desc or "search..." in desc):
            return self._find_with_selectors(self.COMPONENTS['global_search_button'])
        
        # Tab detection
        if intent.role == "tab":
            tab_name = intent.text or intent.label
            if tab_name:
                return self._find_tab(tab_name)
        
        # Save button detection
        if "save" in desc and (intent.role == "button" or "button" in desc):
            return self._find_with_selectors(self.COMPONENTS['save_button'])
        
        # Edit button detection
        if ("edit" in desc) and (intent.role == "button"):
            # Check if it's an inline edit button
            if intent.label:
                return self._find_inline_edit(intent.label)
            return self._find_with_selectors(self.COMPONENTS['edit_button'])
        
        # New button detection
        if "new" in desc and intent.role == "button":
            return self._find_with_selectors(self.COMPONENTS['new_button'])
        
        return None
    
    def _find_with_selectors(self, selectors: List[str]) -> Optional[Locator]:
        """Try multiple selectors and return first match."""
        for selector in selectors:
            try:
                locator = self.page.locator(selector)
                if locator.count() > 0 and locator.first.is_visible(timeout=2000):
                    return locator.first
            except:
                continue
        return None
    
    def _find_tab(self, tab_name: str) -> Optional[Locator]:
        """Find a tab by name."""
        selectors = [
            f'a[data-label="{tab_name}"]',
            f'[role="tab"]:has-text("{tab_name}")',
            f'lightning-tab-bar a:has-text("{tab_name}")',
            f'a[title="{tab_name}"]',
        ]
        return self._find_with_selectors(selectors)
    
    def _find_inline_edit(self, field_name: str) -> Optional[Locator]:
        """Find inline edit button for a field."""
        selectors = [
            f'button[title="Edit {field_name}"]',
            f'button[aria-label="Edit {field_name}"]',
            f'lightning-button-icon[title="Edit {field_name}"] button',
        ]
        return self._find_with_selectors(selectors)
    
    # ==================== HIGH-LEVEL ACTIONS ====================
    
    def open_app(self, app_name: str) -> bool:
        """Open an app from App Launcher."""
        print(f"[SALESFORCE] Opening app: {app_name}")
        
        # 1. Click the waffle icon
        waffle = self._find_with_selectors(self.COMPONENTS['app_launcher_button'])
        if not waffle:
            raise Exception("App Launcher button not found")
        
        waffle.click()
        self.page.wait_for_timeout(500)
        
        # 2. Wait for modal to appear
        self._wait_for_app_launcher_modal()
        
        # 3. Search for app
        search_input = self._wait_for_search_input()
        if not search_input:
            raise Exception("App Launcher search input not found")
        
        # 4. Fill search and select app
        self._fill_salesforce_input(search_input, app_name)
        self.page.wait_for_timeout(500)
        
        # 5. Click the app result
        result_selectors = [
            f'one-app-launcher-menu-item a:has-text("{app_name}")',
            f'a.slds-app-launcher__tile-figure:has-text("{app_name}")',
            f'p.slds-truncate:has-text("{app_name}")',
            f'mark:has-text("{app_name}")',
        ]
        
        for selector in result_selectors:
            try:
                result = self.page.locator(selector).first
                if result.is_visible(timeout=2000):
                    result.click()
                    print(f"[SALESFORCE] App '{app_name}' selected")
                    self._wait_for_navigation()
                    return True
            except:
                continue
        
        raise Exception(f"App '{app_name}' not found in launcher")
    
    def global_search(self, search_text: str) -> bool:
        """Perform a global search."""
        print(f"[SALESFORCE] Global search: {search_text}")
        
        # 1. Click global search
        search_button = self._find_with_selectors(self.COMPONENTS['global_search_button'])
        if search_button:
            search_button.click()
            self.page.wait_for_timeout(500)
        
        # 2. Find and fill search input
        search_selectors = [
            'input[placeholder*="Search"]',
            'input.search-input',
            'div.assistantPanel input',
            'lightning-input-field input',
        ]
        
        search_input = self._find_with_selectors(search_selectors)
        if not search_input:
            raise Exception("Global search input not found")
        
        self._fill_salesforce_input(search_input, search_text)
        
        # 3. Press Enter
        self.page.keyboard.press("Enter")
        
        self._wait_for_navigation()
        return True
    
    def click_record_tab(self, tab_name: str) -> bool:
        """Click a tab on a record page."""
        print(f"[SALESFORCE] Clicking tab: {tab_name}")
        
        tab = self._find_tab(tab_name)
        if not tab:
            raise Exception(f"Tab '{tab_name}' not found")
        
        tab.click()
        self.page.wait_for_timeout(500)
        return True
    
    def edit_field(self, field_name: str, value: str) -> bool:
        """Edit a field on a record page."""
        print(f"[SALESFORCE] Editing field: {field_name} = {value}")
        
        # Click edit button for the field
        edit_button = self._find_inline_edit(field_name)
        if not edit_button:
            raise Exception(f"Edit button for '{field_name}' not found")
        
        edit_button.click()
        self.page.wait_for_timeout(500)
        
        # Find the input that appeared
        input_selectors = [
            f'lightning-input[field-name="{field_name}"] input',
            f'input[name="{field_name}"]',
            f'lightning-input input',  # More generic fallback
        ]
        
        input_el = self._find_with_selectors(input_selectors)
        if not input_el:
            raise Exception(f"Input for '{field_name}' not found after clicking edit")
        
        self._fill_salesforce_input(input_el, value)
        return True
    
    def save_record(self) -> bool:
        """Click the Save button."""
        print(f"[SALESFORCE] Saving record")
        
        save_button = self._find_with_selectors(self.COMPONENTS['save_button'])
        if not save_button:
            raise Exception("Save button not found")
        
        save_button.click()
        
        # Wait for toast or form to close
        self._wait_for_save_complete()
        return True
    
    def wait_for_record_load(self, timeout: int = 10000) -> bool:
        """Wait for a record page to fully load."""
        start = time.time()
        timeout_sec = timeout / 1000
        
        while (time.time() - start) < timeout_sec:
            # Check for record header
            if self._find_with_selectors(self.COMPONENTS['record_header']):
                return True
            
            # Check for spinners
            spinner = self._find_with_selectors(self.COMPONENTS['spinner'])
            if not spinner:
                return True
            
            time.sleep(0.5)
        
        return False
    
    # ==================== INTERNAL HELPERS ====================
    
    def _wait_for_app_launcher_modal(self, timeout: int = 10000) -> bool:
        """Wait for App Launcher modal to appear."""
        start = time.time()
        while (time.time() - start) < (timeout / 1000):
            modal = self._find_with_selectors(self.COMPONENTS['app_launcher_modal'])
            if modal:
                return True
            self.page.wait_for_timeout(300)
        
        # Modal not visible, try clicking waffle again
        waffle = self._find_with_selectors(self.COMPONENTS['app_launcher_button'])
        if waffle:
            waffle.click()
            self.page.wait_for_timeout(1000)
        
        return self._find_with_selectors(self.COMPONENTS['app_launcher_modal']) is not None
    
    def _wait_for_search_input(self, timeout: int = 10000) -> Optional[Locator]:
        """Wait for App Launcher search input to be ready."""
        start = time.time()
        while (time.time() - start) < (timeout / 1000):
            search_input = self._find_with_selectors(self.COMPONENTS['app_launcher_search'])
            if search_input:
                try:
                    search_input.wait_for(state="visible", timeout=2000)
                    return search_input
                except:
                    pass
            self.page.wait_for_timeout(300)
        return None
    
    def _fill_salesforce_input(self, element: Locator, value: str) -> bool:
        """Fill a Salesforce input using multiple strategies."""
        strategies = [
            # Strategy 1: Click + Clear + Fill
            lambda: self._strategy_click_fill(element, value),
            # Strategy 2: Click + Type
            lambda: self._strategy_click_type(element, value),
            # Strategy 3: Focus + Keyboard
            lambda: self._strategy_focus_keyboard(element, value),
            # Strategy 4: JavaScript
            lambda: self._strategy_js_fill(element, value),
        ]
        
        for i, strategy in enumerate(strategies):
            try:
                strategy()
                return True
            except Exception as e:
                if i == len(strategies) - 1:
                    raise
                continue
        
        return False
    
    def _strategy_click_fill(self, element: Locator, value: str):
        element.click(timeout=2000)
        self.page.wait_for_timeout(100)
        element.fill("", timeout=2000)
        element.fill(value, timeout=2000)
    
    def _strategy_click_type(self, element: Locator, value: str):
        element.click(timeout=2000)
        self.page.wait_for_timeout(100)
        self.page.keyboard.press("Control+a")
        element.type(value, delay=30)
    
    def _strategy_focus_keyboard(self, element: Locator, value: str):
        element.focus()
        self.page.keyboard.press("Control+a")
        self.page.keyboard.type(value)
    
    def _strategy_js_fill(self, element: Locator, value: str):
        element.evaluate(f"""(el) => {{
            el.value = '{value}';
            el.dispatchEvent(new Event('input', {{ bubbles: true }}));
            el.dispatchEvent(new Event('change', {{ bubbles: true }}));
            el.dispatchEvent(new Event('blur', {{ bubbles: true }}));
        }}""")
    
    def _wait_for_navigation(self, timeout: int = 30000):
        """Wait for navigation/page load."""
        try:
            self.page.wait_for_load_state("domcontentloaded", timeout=timeout)
        except:
            pass
        
        # Wait for spinners to disappear
        start = time.time()
        while (time.time() - start) < (timeout / 1000):
            if not self._find_with_selectors(self.COMPONENTS['spinner']):
                break
            self.page.wait_for_timeout(500)
        
        self.page.wait_for_timeout(500)
    
    def _wait_for_save_complete(self, timeout: int = 15000):
        """Wait for save operation to complete."""
        start = time.time()
        timeout_sec = timeout / 1000
        
        while (time.time() - start) < timeout_sec:
            # Check for success toast
            toast = self.page.locator('.toastContainer .toastMessage')
            if toast.count() > 0:
                try:
                    if toast.is_visible(timeout=1000):
                        return True
                except:
                    pass
            
            # Check if modal closed (for modal edits)
            modal = self._find_with_selectors(self.COMPONENTS['modal'])
            if not modal:
                return True
            
            # Check for spinners
            spinner = self._find_with_selectors(self.COMPONENTS['spinner'])
            if not spinner:
                return True
            
            self.page.wait_for_timeout(500)
        
        return False
    
    # ==================== UTILITY METHODS ====================
    
    def is_modal_open(self) -> bool:
        """Check if a modal is currently open."""
        return self._find_with_selectors(self.COMPONENTS['modal']) is not None
    
    def close_modal(self) -> bool:
        """Close any open modal."""
        close_button = self._find_with_selectors(self.COMPONENTS['modal_close'])
        if close_button:
            close_button.click()
            return True
        return False
    
    def dismiss_toast(self) -> bool:
        """Dismiss any toast notification."""
        close_button = self._find_with_selectors(self.COMPONENTS['toast_close'])
        if close_button:
            close_button.click()
            return True
        return False
    
    def get_page_type(self) -> str:
        """Detect what type of Salesforce page we're on."""
        url = self.page.url.lower()
        
        if 'login' in url or 'secur/verify' in url:
            return 'login'
        elif '/lightning/o/' in url:
            return 'list_view'
        elif '/lightning/r/' in url:
            return 'record_page'
        elif 'lightning/n/' in url:
            return 'custom_tab'
        elif 'lightning/page/home' in url:
            return 'home'
        elif 'setup' in url:
            return 'setup'
        else:
            return 'unknown'

