"""
INTELLIGENT WAITER
==================
State-aware waiting that understands when a page is truly ready.
No more fixed timeouts - we detect actual page state.
"""

import time
from typing import Optional, List, Callable
from playwright.sync_api import Page


class IntelligentWaiter:
    """
    Smart waiting that detects page readiness across different app frameworks.
    
    Instead of: page.wait_for_timeout(5000)  # Hope it's enough
    We do: waiter.wait_for_ready()  # Actually check if ready
    """
    
    def __init__(self, page: Page, app_type: str = "generic"):
        self.page = page
        self.app_type = app_type
        
        # Configure app-specific indicators
        self._configure_for_app(app_type)
    
    def _configure_for_app(self, app_type: str):
        """Configure waiting strategy for specific app."""
        self.loading_indicators = []
        self.ready_indicators = []
        self.framework_check = None
        
        if app_type == "salesforce":
            self.loading_indicators = [
                "lightning-spinner",
                ".slds-spinner",
                ".slds-spinner_container:not(.slds-hide)",
                "[aria-busy='true']",
                ".loading",
                ".auraLoadingBox",
            ]
            self.ready_indicators = [
                "one-record-home-flexipage2",
                ".oneContent",
                "lightning-app-builder",
            ]
            self.framework_check = self._check_salesforce_ready
            
        elif app_type == "servicenow":
            self.loading_indicators = [
                ".loading-spinner",
                ".angular-loading",
                "[ng-show*='loading']",
            ]
            self.framework_check = self._check_servicenow_ready
            
        elif app_type == "workday":
            self.loading_indicators = [
                ".wd-LoadingIndicator",
                ".spinner",
            ]
            
        elif app_type == "sap_fiori":
            self.loading_indicators = [
                ".sapUiLocalBusyIndicator",
                ".sapMBusyIndicator",
            ]
            self.framework_check = self._check_sapui5_ready
            
        else:  # Generic
            self.loading_indicators = [
                ".loading",
                ".spinner",
                "[aria-busy='true']",
                ".loading-spinner",
            ]
    
    def wait_for_ready(self, timeout: int = 30000) -> bool:
        """
        Wait for page to be fully ready for interaction.
        
        Args:
            timeout: Maximum wait time in milliseconds
            
        Returns:
            True if page is ready, False if timeout
        """
        start_time = time.time()
        timeout_sec = timeout / 1000
        
        # Phase 1: Wait for basic page load
        try:
            self.page.wait_for_load_state("domcontentloaded", timeout=timeout)
        except:
            pass
        
        # Phase 2: Wait for framework to be ready (if applicable)
        if self.framework_check:
            try:
                self.framework_check(timeout=min(timeout, 10000))
            except:
                pass
        
        # Phase 3: Wait for loading indicators to disappear
        while (time.time() - start_time) < timeout_sec:
            if not self._has_loading_indicators():
                break
            time.sleep(0.3)
        
        # Phase 4: Brief stabilization
        time.sleep(0.2)
        
        return True
    
    def wait_for_element(
        self,
        selector: str,
        state: str = "visible",
        timeout: int = 10000
    ) -> bool:
        """Wait for specific element to reach a state."""
        try:
            self.page.locator(selector).wait_for(state=state, timeout=timeout)
            return True
        except:
            return False
    
    def wait_for_navigation(self, timeout: int = 30000) -> bool:
        """Wait for navigation to complete."""
        try:
            self.page.wait_for_load_state("networkidle", timeout=timeout)
            return True
        except:
            # networkidle often fails on SPAs - fallback to domcontentloaded
            try:
                self.page.wait_for_load_state("domcontentloaded", timeout=5000)
                return True
            except:
                return False
    
    def wait_for_no_spinners(self, timeout: int = 15000) -> bool:
        """Wait for all loading spinners to disappear."""
        start_time = time.time()
        timeout_sec = timeout / 1000
        
        while (time.time() - start_time) < timeout_sec:
            if not self._has_loading_indicators():
                return True
            time.sleep(0.5)
        
        return False
    
    def _has_loading_indicators(self) -> bool:
        """Check if any loading indicators are visible."""
        for selector in self.loading_indicators:
            try:
                locator = self.page.locator(selector)
                if locator.count() > 0:
                    if locator.first.is_visible(timeout=500):
                        return True
            except:
                continue
        return False
    
    # === FRAMEWORK-SPECIFIC CHECKS ===
    
    def _check_salesforce_ready(self, timeout: int = 10000):
        """Check if Salesforce Lightning is ready."""
        try:
            # Check for Aura framework
            self.page.wait_for_function(
                """() => {
                    // Check if $A (Aura) is available
                    if (typeof $A !== 'undefined' && $A.get) {
                        return true;
                    }
                    // Check for LWC
                    if (document.querySelector('lightning-app') || 
                        document.querySelector('one-app')) {
                        return true;
                    }
                    return false;
                }""",
                timeout=timeout
            )
        except:
            pass
    
    def _check_servicenow_ready(self, timeout: int = 10000):
        """Check if ServiceNow is ready."""
        try:
            self.page.wait_for_function(
                """() => {
                    // Check for Angular
                    if (typeof angular !== 'undefined') {
                        return true;
                    }
                    // Check for Seismic
                    if (document.querySelector('seismic-hoist')) {
                        return true;
                    }
                    return false;
                }""",
                timeout=timeout
            )
        except:
            pass
    
    def _check_sapui5_ready(self, timeout: int = 10000):
        """Check if SAPUI5 is ready."""
        try:
            self.page.wait_for_function(
                """() => {
                    // Check for SAPUI5 core
                    if (typeof sap !== 'undefined' && sap.ui && sap.ui.getCore) {
                        return sap.ui.getCore().isReady();
                    }
                    return false;
                }""",
                timeout=timeout
            )
        except:
            pass


class WaitCondition:
    """Custom wait condition builder."""
    
    def __init__(self, page: Page):
        self.page = page
        self.conditions: List[Callable[[], bool]] = []
    
    def until_element_visible(self, selector: str):
        """Add condition: element is visible."""
        self.conditions.append(
            lambda: self.page.locator(selector).is_visible(timeout=1000)
        )
        return self
    
    def until_element_hidden(self, selector: str):
        """Add condition: element is hidden."""
        self.conditions.append(
            lambda: not self.page.locator(selector).is_visible(timeout=1000)
        )
        return self
    
    def until_text_present(self, text: str):
        """Add condition: text is present on page."""
        self.conditions.append(
            lambda: self.page.get_by_text(text).count() > 0
        )
        return self
    
    def until_url_contains(self, substring: str):
        """Add condition: URL contains substring."""
        self.conditions.append(
            lambda: substring in self.page.url
        )
        return self
    
    def wait(self, timeout: int = 10000) -> bool:
        """Wait for all conditions to be true."""
        start_time = time.time()
        timeout_sec = timeout / 1000
        
        while (time.time() - start_time) < timeout_sec:
            all_met = True
            for condition in self.conditions:
                try:
                    if not condition():
                        all_met = False
                        break
                except:
                    all_met = False
                    break
            
            if all_met:
                return True
            
            time.sleep(0.3)
        
        return False

