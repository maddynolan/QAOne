"""
FLOWSTRAL AUTOMATION ENGINE
============================
The main entry point for robust test automation.

Usage:
    engine = FlowstralEngine(page, app_type="salesforce")
    
    engine.click(text="Save", role="button")
    engine.fill(label="Account Name", value="Acme Corp")
    engine.select(label="Industry", option="Technology")
"""

from typing import Optional, Dict, Any, List
from playwright.sync_api import Page

from .smart_finder import SmartElementFinder, ElementIntent
from .intelligent_waiter import IntelligentWaiter
from .self_healer import SelfHealingController


class FlowstralEngine:
    """
    Universal automation engine that works across 25+ enterprise applications.
    
    Features:
    - Smart Element Finding (intent-based, not selector-based)
    - Intelligent Waiting (state-aware, not timeout-based)
    - Self-Healing (learns from successes and failures)
    - App Plugins (Salesforce, ServiceNow, Workday, SAP, etc.)
    """
    
    # Supported application types
    SUPPORTED_APPS = [
        "salesforce", "servicenow", "workday", "sap_fiori", "oracle",
        "dynamics365", "zendesk", "hubspot", "atlassian", "generic"
    ]
    
    def __init__(
        self,
        page: Page,
        app_type: str = "auto",
        enable_healing: bool = True,
        healing_storage: Optional[str] = None,
        verbose: bool = True
    ):
        """
        Initialize the Flowstral Engine.
        
        Args:
            page: Playwright page instance
            app_type: Application type ("salesforce", "servicenow", etc.) or "auto" to detect
            enable_healing: Enable self-healing learning
            healing_storage: Path to store healing data
            verbose: Print debug information
        """
        self.page = page
        self.verbose = verbose
        
        # Auto-detect app type if needed
        if app_type == "auto":
            app_type = self._detect_app_type()
        
        self.app_type = app_type
        
        # Load app-specific plugin
        self.app_plugin = self._load_app_plugin(app_type)
        
        # Initialize core components
        self.finder = SmartElementFinder(page, self.app_plugin)
        self.waiter = IntelligentWaiter(page, app_type)
        
        if enable_healing:
            self.healer = SelfHealingController(healing_storage)
        else:
            self.healer = None
        
        self._log(f"Flowstral Engine initialized for: {app_type}")
    
    def _log(self, message: str):
        """Print log message if verbose mode."""
        if self.verbose:
            print(f"[FLOWSTRAL] {message}")
    
    def _detect_app_type(self) -> str:
        """Auto-detect the application type from the current page."""
        url = self.page.url.lower()
        
        # Salesforce detection
        if any(x in url for x in ['salesforce.com', 'force.com', 'lightning.force', '.my.salesforce']):
            return "salesforce"
        
        # ServiceNow detection
        if 'service-now.com' in url or 'servicenow' in url:
            return "servicenow"
        
        # Workday detection
        if 'workday.com' in url or 'myworkday' in url:
            return "workday"
        
        # SAP Fiori detection
        if 'sap.com' in url or 'fiori' in url:
            return "sap_fiori"
        
        # Oracle detection
        if 'oracle' in url or 'oraclecloud' in url:
            return "oracle"
        
        # Dynamics 365 detection
        if 'dynamics.com' in url or 'crm.dynamics' in url:
            return "dynamics365"
        
        return "generic"
    
    def _load_app_plugin(self, app_type: str):
        """Load application-specific plugin."""
        if app_type == "salesforce":
            from .plugins.salesforce_plugin import SalesforcePlugin
            return SalesforcePlugin(self.page)
        
        # Other plugins can be added here
        return None
    
    # ==================== CORE ACTIONS ====================
    
    def click(
        self,
        description: str = None,
        text: str = None,
        role: str = None,
        label: str = None,
        title: str = None,
        component: str = None,
        near: str = None,
        timeout: int = 10000,
        **kwargs
    ) -> bool:
        """
        Click an element by intent.
        
        Args:
            description: Human description of the element
            text: Text content to match
            role: ARIA role (button, link, tab, etc.)
            label: Associated label or aria-label
            title: Title attribute
            component: App-specific component type
            near: Text that should be near the element
            timeout: Max time to find element
            
        Returns:
            True if click succeeded
        """
        intent = ElementIntent(
            description=description or text or label or "element",
            text=text,
            role=role,
            label=label,
            title=title,
            near_text=near,
            component_type=component,
            **{k: v for k, v in kwargs.items() if hasattr(ElementIntent, k)}
        )
        
        self._log(f"Click: {intent.description}")
        
        # Wait for page to be ready first
        self.waiter.wait_for_ready(timeout=5000)
        
        try:
            # Find the element
            element = self.finder.find(intent, timeout=timeout)
            
            # Scroll into view
            try:
                element.scroll_into_view_if_needed()
            except:
                pass
            
            # Click with retry
            for attempt in range(3):
                try:
                    element.click(force=True, timeout=5000)
                    self._log(f"   [+] Clicked successfully")
                    
                    # Record success for healing
                    if self.healer:
                        self.healer.record_success(
                            intent_dict=intent.__dict__,
                            strategy="smart_finder",
                            selector=str(element),
                            attributes={},
                            context={"url": self.page.url, "app": self.app_type}
                        )
                    
                    # Wait for any resulting changes
                    self.waiter.wait_for_ready(timeout=5000)
                    return True
                    
                except Exception as e:
                    if attempt < 2:
                        self.page.wait_for_timeout(500)
                        continue
                    raise
            
        except Exception as e:
            self._log(f"   [FAIL] Click failed: {str(e)[:100]}")
            
            if self.healer:
                self.healer.record_failure(
                    intent_dict=intent.__dict__,
                    failed_selectors=[],
                    context={"url": self.page.url, "app": self.app_type}
                )
            
            raise
    
    def fill(
        self,
        value: str,
        description: str = None,
        label: str = None,
        placeholder: str = None,
        role: str = "textbox",
        component: str = None,
        clear_first: bool = True,
        timeout: int = 10000,
        **kwargs
    ) -> bool:
        """
        Fill an input field by intent.
        
        Args:
            value: Value to fill
            description: Human description
            label: Field label
            placeholder: Placeholder text
            role: ARIA role (default: textbox)
            component: App-specific component type
            clear_first: Clear field before filling
            timeout: Max time to find element
            
        Returns:
            True if fill succeeded
        """
        intent = ElementIntent(
            description=description or label or placeholder or "input field",
            label=label,
            placeholder=placeholder,
            role=role,
            component_type=component,
            **{k: v for k, v in kwargs.items() if hasattr(ElementIntent, k)}
        )
        
        self._log(f"Fill: {intent.description} = '{value[:30]}{'...' if len(value) > 30 else ''}'")
        
        # Wait for page to be ready
        self.waiter.wait_for_ready(timeout=5000)
        
        try:
            element = self.finder.find(intent, timeout=timeout)
            
            # Scroll into view
            try:
                element.scroll_into_view_if_needed()
            except:
                pass
            
            # Try multiple fill strategies
            strategies = [
                ("click_fill", lambda: self._fill_click_fill(element, value, clear_first)),
                ("click_type", lambda: self._fill_click_type(element, value, clear_first)),
                ("focus_type", lambda: self._fill_focus_type(element, value)),
                ("js_value", lambda: self._fill_js_value(element, value)),
            ]
            
            for strategy_name, strategy_fn in strategies:
                try:
                    strategy_fn()
                    self._log(f"   [+] Filled successfully (strategy: {strategy_name})")
                    
                    if self.healer:
                        self.healer.record_success(
                            intent_dict=intent.__dict__,
                            strategy=strategy_name,
                            selector=str(element),
                            attributes={},
                            context={"url": self.page.url, "app": self.app_type}
                        )
                    
                    return True
                    
                except Exception as e:
                    continue
            
            raise Exception("All fill strategies failed")
            
        except Exception as e:
            self._log(f"   [FAIL] Fill failed: {str(e)[:100]}")
            raise
    
    def _fill_click_fill(self, element, value: str, clear_first: bool):
        """Strategy 1: Click then fill."""
        element.click(timeout=3000)
        self.page.wait_for_timeout(200)
        if clear_first:
            element.fill("", timeout=2000)
        element.fill(value, timeout=5000)
    
    def _fill_click_type(self, element, value: str, clear_first: bool):
        """Strategy 2: Click then type."""
        element.click(timeout=3000)
        self.page.wait_for_timeout(200)
        if clear_first:
            self.page.keyboard.press("Control+a")
        element.type(value, delay=30)
    
    def _fill_focus_type(self, element, value: str):
        """Strategy 3: Focus then keyboard type."""
        element.focus()
        self.page.keyboard.press("Control+a")
        self.page.keyboard.type(value)
    
    def _fill_js_value(self, element, value: str):
        """Strategy 4: Set value via JavaScript."""
        element.evaluate(f"""(el) => {{
            el.value = '{value}';
            el.dispatchEvent(new Event('input', {{ bubbles: true }}));
            el.dispatchEvent(new Event('change', {{ bubbles: true }}));
        }}""")
    
    def select(
        self,
        option: str,
        description: str = None,
        label: str = None,
        role: str = "combobox",
        timeout: int = 10000,
        **kwargs
    ) -> bool:
        """
        Select an option from a dropdown.
        
        Args:
            option: Option to select (text or value)
            description: Human description
            label: Field label
            role: ARIA role
            timeout: Max time to find element
            
        Returns:
            True if selection succeeded
        """
        intent = ElementIntent(
            description=description or label or "dropdown",
            label=label,
            role=role,
            **{k: v for k, v in kwargs.items() if hasattr(ElementIntent, k)}
        )
        
        self._log(f"Select: {intent.description} = '{option}'")
        
        self.waiter.wait_for_ready(timeout=5000)
        
        try:
            element = self.finder.find(intent, timeout=timeout)
            
            # Click to open dropdown
            element.click(timeout=3000)
            self.page.wait_for_timeout(500)
            
            # Find and click option
            option_selectors = [
                f'[role="option"]:has-text("{option}")',
                f'li:has-text("{option}")',
                f'option:has-text("{option}")',
                f'.slds-listbox__option:has-text("{option}")',
            ]
            
            for sel in option_selectors:
                try:
                    opt = self.page.locator(sel).first
                    if opt.is_visible(timeout=2000):
                        opt.click()
                        self._log(f"   [+] Selected: {option}")
                        return True
                except:
                    continue
            
            # Fallback: try select_option
            try:
                element.select_option(label=option)
                self._log(f"   [+] Selected: {option}")
                return True
            except:
                pass
            
            raise Exception(f"Option '{option}' not found")
            
        except Exception as e:
            self._log(f"   [FAIL] Select failed: {str(e)[:100]}")
            raise
    
    def wait(self, milliseconds: int = 1000):
        """Wait for specified time (use sparingly)."""
        self.page.wait_for_timeout(milliseconds)
    
    def wait_for_ready(self, timeout: int = 30000):
        """Wait for page to be fully ready."""
        self.waiter.wait_for_ready(timeout)
    
    def navigate(self, url: str, wait_for_ready: bool = True):
        """Navigate to URL."""
        self._log(f"Navigate: {url}")
        self.page.goto(url)
        if wait_for_ready:
            self.waiter.wait_for_ready()
    
    # ==================== APP-SPECIFIC HELPERS ====================
    
    def salesforce_app_launcher(self, app_name: str):
        """Salesforce: Open app from App Launcher."""
        if self.app_plugin and hasattr(self.app_plugin, 'open_app'):
            return self.app_plugin.open_app(app_name)
        raise NotImplementedError("Salesforce plugin not loaded")
    
    def salesforce_global_search(self, search_text: str):
        """Salesforce: Use global search."""
        if self.app_plugin and hasattr(self.app_plugin, 'global_search'):
            return self.app_plugin.global_search(search_text)
        raise NotImplementedError("Salesforce plugin not loaded")

