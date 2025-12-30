"""
ENTERPRISE APP PLUGINS
======================
Plugin architecture for 25+ enterprise applications.

Each plugin provides:
- Component selectors specific to that app
- Custom waiting logic for the app's framework
- High-level actions (e.g., ServiceNow incident creation)
"""

from typing import Optional, List, Dict
from playwright.sync_api import Page, Locator
import time


class BaseAppPlugin:
    """Base class for all app plugins."""
    
    APP_NAME = "generic"
    FRAMEWORK = "unknown"
    
    # Override in subclasses
    LOADING_SELECTORS = [".loading", ".spinner", "[aria-busy='true']"]
    COMPONENTS = {}
    
    def __init__(self, page: Page):
        self.page = page
    
    def find_component(self, intent) -> Optional[Locator]:
        """Find an app-specific component. Override in subclasses."""
        return None
    
    def wait_for_ready(self, timeout: int = 15000):
        """Wait for app to be ready. Override for custom logic."""
        try:
            self.page.wait_for_load_state("domcontentloaded", timeout=timeout)
        except:
            pass
        
        # Wait for loading indicators to disappear
        start = time.time()
        while (time.time() - start) < (timeout / 1000):
            has_loading = False
            for sel in self.LOADING_SELECTORS:
                try:
                    if self.page.locator(sel).is_visible(timeout=500):
                        has_loading = True
                        break
                except:
                    pass
            if not has_loading:
                break
            time.sleep(0.3)
    
    def _find_with_selectors(self, selectors: List[str]) -> Optional[Locator]:
        """Try multiple selectors and return first visible match."""
        for selector in selectors:
            try:
                locator = self.page.locator(selector)
                if locator.count() > 0 and locator.first.is_visible(timeout=2000):
                    return locator.first
            except:
                continue
        return None


# ============================================================
# SERVICENOW PLUGIN
# ============================================================

class ServiceNowPlugin(BaseAppPlugin):
    """
    ServiceNow automation plugin.
    Supports: Angular-based UI, Seismic framework.
    """
    
    APP_NAME = "servicenow"
    FRAMEWORK = "angular/seismic"
    
    LOADING_SELECTORS = [
        ".loading-spinner",
        ".angular-loading",
        "[ng-show*='loading']",
        ".loading-indicator",
        "sn-loading-indicator",
    ]
    
    COMPONENTS = {
        'navigator': [
            'sn-aside-body',
            '.navpage-nav',
            '#nav_west_center',
        ],
        'search': [
            '#sysparm_search',
            'input[placeholder*="Search"]',
            'sn-search input',
        ],
        'form_save': [
            '#sysverb_insert_and_stay',
            '#sysverb_insert',
            'button[name="sysverb_insert"]',
        ],
        'form_update': [
            '#sysverb_update_and_stay',
            '#sysverb_update',
        ],
        'incident_form': [
            'table[name="incident"]',
            '[data-table-name="incident"]',
        ],
    }
    
    def create_incident(self, short_description: str, caller: str = None):
        """Create a new incident."""
        # Navigate to incident form
        self.page.goto('/incident.do?sys_id=-1')
        self.wait_for_ready()
        
        # Fill short description
        short_desc_input = self._find_with_selectors([
            '#incident\\.short_description',
            'input[name="incident.short_description"]',
        ])
        if short_desc_input:
            short_desc_input.fill(short_description)
        
        # Fill caller if provided
        if caller:
            caller_input = self._find_with_selectors([
                '#sys_display\\.incident\\.caller_id',
                'input[name="incident.caller_id"]',
            ])
            if caller_input:
                caller_input.fill(caller)
    
    def submit_form(self):
        """Submit the current form."""
        save_btn = self._find_with_selectors(self.COMPONENTS['form_save'])
        if save_btn:
            save_btn.click()
            self.wait_for_ready()


# ============================================================
# WORKDAY PLUGIN
# ============================================================

class WorkdayPlugin(BaseAppPlugin):
    """
    Workday automation plugin.
    Supports: Workday's custom framework.
    """
    
    APP_NAME = "workday"
    FRAMEWORK = "workday_custom"
    
    LOADING_SELECTORS = [
        ".wd-LoadingIndicator",
        ".wd-LoadingIndicatorContainer",
        ".spinner",
        "[data-automation-loading='true']",
    ]
    
    COMPONENTS = {
        'search': [
            '[data-automation-id="globalSearchInput"]',
            'input[aria-label*="Search"]',
        ],
        'menu': [
            '[data-automation-id="menuItem"]',
            '.wd-MenuItem',
        ],
        'button': [
            '[data-automation-id*="button"]',
            '.wd-Button',
        ],
        'input': [
            '[data-automation-id*="textInput"]',
            '.wd-TextInput input',
        ],
    }
    
    def global_search(self, text: str):
        """Use Workday global search."""
        search = self._find_with_selectors(self.COMPONENTS['search'])
        if search:
            search.click()
            search.fill(text)
            self.page.keyboard.press("Enter")
            self.wait_for_ready()


# ============================================================
# SAP FIORI PLUGIN
# ============================================================

class SAPFioriPlugin(BaseAppPlugin):
    """
    SAP Fiori automation plugin.
    Supports: SAPUI5 framework.
    """
    
    APP_NAME = "sap_fiori"
    FRAMEWORK = "sapui5"
    
    LOADING_SELECTORS = [
        ".sapUiLocalBusyIndicator",
        ".sapMBusyIndicator",
        ".sapUiBusy",
    ]
    
    COMPONENTS = {
        'shell_header': [
            '.sapUshellShellHead',
            '#shell-header',
        ],
        'search': [
            '.sapUshellShellHeadSearchContainer input',
            '#searchFieldInShell-input',
        ],
        'tile': [
            '.sapUshellTile',
            '.sapMGT',
        ],
        'button': [
            '.sapMBtn',
            'button.sapUiBtn',
        ],
        'input': [
            '.sapMInput input',
            '.sapMInputBaseInner',
        ],
        'table': [
            '.sapUiTable',
            '.sapMList',
        ],
    }
    
    def wait_for_ready(self, timeout: int = 15000):
        """Wait for SAPUI5 to be ready."""
        try:
            self.page.wait_for_function(
                """() => {
                    if (typeof sap !== 'undefined' && sap.ui && sap.ui.getCore) {
                        return sap.ui.getCore().isReady();
                    }
                    return true;
                }""",
                timeout=timeout
            )
        except:
            pass
        
        super().wait_for_ready(timeout)


# ============================================================
# ORACLE CLOUD PLUGIN
# ============================================================

class OracleCloudPlugin(BaseAppPlugin):
    """
    Oracle Cloud (JET) automation plugin.
    Supports: Oracle JET framework.
    """
    
    APP_NAME = "oracle"
    FRAMEWORK = "oracle_jet"
    
    LOADING_SELECTORS = [
        ".oj-progress-spinner",
        "[data-bind*='loading']",
        ".loading-overlay",
    ]
    
    COMPONENTS = {
        'navigation': [
            'oj-navigation-list',
            '.oj-navigationlist',
        ],
        'button': [
            'oj-button',
            '.oj-button',
        ],
        'input': [
            'oj-input-text input',
            '.oj-inputtext-input',
        ],
        'table': [
            'oj-table',
            '.oj-table',
        ],
    }


# ============================================================
# MICROSOFT DYNAMICS 365 PLUGIN
# ============================================================

class Dynamics365Plugin(BaseAppPlugin):
    """
    Microsoft Dynamics 365 automation plugin.
    Supports: Power Apps / Unified Interface.
    """
    
    APP_NAME = "dynamics365"
    FRAMEWORK = "power_apps"
    
    LOADING_SELECTORS = [
        ".ms-Spinner",
        "[data-id='progressIndicator']",
        ".loading-container",
    ]
    
    COMPONENTS = {
        'sitemap': [
            '[data-id="sitemap-launcher"]',
            '.nav-bar-item',
        ],
        'search': [
            '[data-id="quickFind_text"]',
            'input[aria-label*="Search"]',
        ],
        'form': [
            '[data-id="editFormRoot"]',
            '.form-selector',
        ],
        'save': [
            '[data-id="quickCreateSaveAndCloseBtn"]',
            '[data-id="save-command"]',
        ],
        'grid': [
            '[data-id="entity_control"]',
            '.ag-body-viewport',
        ],
    }
    
    def navigate_to_entity(self, entity_name: str):
        """Navigate to an entity (e.g., Accounts, Contacts)."""
        sitemap = self._find_with_selectors(self.COMPONENTS['sitemap'])
        if sitemap:
            sitemap.click()
        
        # Find and click entity
        entity_link = self.page.locator(f'[aria-label="{entity_name}"], [title="{entity_name}"]')
        if entity_link.count() > 0:
            entity_link.first.click()
            self.wait_for_ready()


# ============================================================
# ZENDESK PLUGIN
# ============================================================

class ZendeskPlugin(BaseAppPlugin):
    """
    Zendesk automation plugin.
    Supports: Garden design system.
    """
    
    APP_NAME = "zendesk"
    FRAMEWORK = "garden"
    
    LOADING_SELECTORS = [
        "[data-garden-id='loaders.skeleton']",
        ".garden-loader",
        ".spinner",
    ]
    
    COMPONENTS = {
        'ticket_form': [
            '[data-test-id="ticket-form"]',
            '.ticket_form',
        ],
        'submit': [
            '[data-test-id="submit-button"]',
            'button[type="submit"]',
        ],
        'search': [
            '[data-test-id="search-input"]',
            '#search-input',
        ],
    }


# ============================================================
# HUBSPOT PLUGIN
# ============================================================

class HubSpotPlugin(BaseAppPlugin):
    """
    HubSpot automation plugin.
    Supports: HubSpot's React-based UI.
    """
    
    APP_NAME = "hubspot"
    FRAMEWORK = "react"
    
    LOADING_SELECTORS = [
        "[data-selenium-test='loading-spinner']",
        ".private-loading",
        ".UILoadingSpinner",
    ]
    
    COMPONENTS = {
        'navigation': [
            '[data-selenium-test="navigation"]',
            '.navigation-primary',
        ],
        'search': [
            '[data-selenium-test="search-input"]',
            '#global-search-input',
        ],
        'create_button': [
            '[data-selenium-test="create-button"]',
            '[data-button-use="primary"]',
        ],
    }


# ============================================================
# ATLASSIAN PLUGIN
# ============================================================

class AtlassianPlugin(BaseAppPlugin):
    """
    Atlassian (Jira/Confluence) automation plugin.
    Supports: Atlaskit design system.
    """
    
    APP_NAME = "atlassian"
    FRAMEWORK = "atlaskit"
    
    LOADING_SELECTORS = [
        "[data-testid='spinner']",
        ".css-1wits42",  # Atlaskit spinner
        "[role='progressbar']",
    ]
    
    COMPONENTS = {
        'navigation': [
            '[data-testid="navigation-apps"]',
            '#navigation-apps',
        ],
        'search': [
            '[data-testid="search-dialog-input"]',
            '#search-dialog-input',
        ],
        'create_button': [
            '[data-testid="create-button"]',
            '#createGlobalItem',
        ],
        'issue_detail': [
            '[data-testid="issue.views.issue-details.issue-layout"]',
            '.issue-view',
        ],
    }
    
    def create_issue(self, project: str, summary: str, issue_type: str = "Task"):
        """Create a Jira issue."""
        # Click create button
        create_btn = self._find_with_selectors(self.COMPONENTS['create_button'])
        if create_btn:
            create_btn.click()
            self.wait_for_ready()
        
        # Fill project
        project_input = self.page.locator('[data-testid="project-picker-trigger"]')
        if project_input.is_visible(timeout=3000):
            project_input.click()
            self.page.get_by_text(project).click()
        
        # Fill summary
        summary_input = self.page.locator('#summary-field')
        if summary_input.is_visible(timeout=3000):
            summary_input.fill(summary)


# ============================================================
# NETSUITE PLUGIN
# ============================================================

class NetSuitePlugin(BaseAppPlugin):
    """
    NetSuite automation plugin.
    """
    
    APP_NAME = "netsuite"
    FRAMEWORK = "netsuite"
    
    LOADING_SELECTORS = [
        "#div__spinner",
        ".ns-loading",
    ]
    
    COMPONENTS = {
        'navigation': [
            '#ns-header-menu-main',
            '.ns-menubar',
        ],
        'search': [
            '#_searchstring',
            'input[name="searchtype"]',
        ],
    }


# ============================================================
# PLUGIN REGISTRY
# ============================================================

PLUGIN_REGISTRY = {
    "salesforce": "SalesforcePlugin",  # Defined in salesforce_plugin.py
    "servicenow": ServiceNowPlugin,
    "workday": WorkdayPlugin,
    "sap_fiori": SAPFioriPlugin,
    "oracle": OracleCloudPlugin,
    "dynamics365": Dynamics365Plugin,
    "zendesk": ZendeskPlugin,
    "hubspot": HubSpotPlugin,
    "atlassian": AtlassianPlugin,
    "netsuite": NetSuitePlugin,
}


def get_plugin(app_type: str, page: Page):
    """Get the appropriate plugin for an app type."""
    if app_type == "salesforce":
        from .salesforce_plugin import SalesforcePlugin
        return SalesforcePlugin(page)
    
    plugin_class = PLUGIN_REGISTRY.get(app_type)
    if plugin_class and plugin_class != "SalesforcePlugin":
        return plugin_class(page)
    
    return BaseAppPlugin(page)


def detect_app_type(url: str) -> str:
    """Detect application type from URL."""
    url_lower = url.lower()
    
    patterns = {
        "salesforce": ["salesforce.com", "force.com", ".my.salesforce"],
        "servicenow": ["service-now.com", "servicenow"],
        "workday": ["workday.com", "myworkday"],
        "sap_fiori": ["sap.com", "fiori", "s4hana"],
        "oracle": ["oracle.com", "oraclecloud"],
        "dynamics365": ["dynamics.com", "crm.dynamics"],
        "zendesk": ["zendesk.com"],
        "hubspot": ["hubspot.com", "hs-app"],
        "atlassian": ["atlassian.net", "jira", "confluence"],
        "netsuite": ["netsuite.com"],
    }
    
    for app_type, keywords in patterns.items():
        if any(kw in url_lower for kw in keywords):
            return app_type
    
    return "generic"

