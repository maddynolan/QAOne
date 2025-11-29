"""
Remote Browser Grid Service
Supports Selenium Grid, Moon (K8s Playwright grid), BrowserStack, and SauceLabs.
"""

import logging
from typing import Dict, Any, Optional
from enum import Enum
import os

logger = logging.getLogger(__name__)


class GridProvider(Enum):
    """Supported grid providers"""
    SELENIUM_GRID = "selenium_grid"
    MOON = "moon"
    BROWSERSTACK = "browserstack"
    SAUCELABS = "saucelabs"
    LOCAL = "local"


class RemoteGridService:
    """
    Service for managing remote browser grid connections.
    Supports multiple providers and automatic failover.
    """
    
    def __init__(self):
        self.grid_config = self._load_grid_config()
    
    def _load_grid_config(self) -> Dict[str, Any]:
        """Load grid configuration from environment variables"""
        provider = os.getenv("GRID_PROVIDER", "local")
        
        config = {
            "provider": provider,
            "selenium_grid": {
                "hub_url": os.getenv("SELENIUM_GRID_HUB_URL", "http://localhost:4444"),
                "capabilities": {}
            },
            "moon": {
                "hub_url": os.getenv("MOON_HUB_URL", "http://localhost:4444"),
                "capabilities": {}
            },
            "browserstack": {
                "username": os.getenv("BROWSERSTACK_USERNAME", ""),
                "access_key": os.getenv("BROWSERSTACK_ACCESS_KEY", ""),
                "hub_url": "https://hub.browserstack.com/wd/hub"
            },
            "saucelabs": {
                "username": os.getenv("SAUCELABS_USERNAME", ""),
                "access_key": os.getenv("SAUCELABS_ACCESS_KEY", ""),
                "hub_url": "https://ondemand.saucelabs.com/wd/hub"
            }
        }
        
        return config
    
    def get_playwright_ws_endpoint(
        self,
        browser: str = "chromium",
        environment: str = "staging"
    ) -> Optional[str]:
        """
        Get Playwright WebSocket endpoint for remote grid connection.
        
        For Playwright, we use browser.connect() instead of browser.launch()
        when connecting to a remote grid.
        """
        provider = self.grid_config.get("provider", "local")
        
        if provider == "local":
            return None  # Use local browser
        
        # For Moon (K8s Playwright grid)
        if provider == "moon":
            moon_url = self.grid_config["moon"]["hub_url"]
            # Moon typically exposes Playwright endpoints
            return f"ws://{moon_url.replace('http://', '').replace('https://', '')}/playwright/{browser}"
        
        # For Selenium Grid with Playwright (if supported)
        if provider == "selenium_grid":
            selenium_url = self.grid_config["selenium_grid"]["hub_url"]
            # Selenium Grid doesn't natively support Playwright, but some implementations do
            return f"ws://{selenium_url.replace('http://', '').replace('https://', '')}/playwright/{browser}"
        
        # BrowserStack and SauceLabs don't support Playwright WebSocket directly
        # They use Selenium WebDriver protocol
        return None
    
    def get_selenium_capabilities(
        self,
        browser: str = "chrome",
        environment: str = "staging"
    ) -> Dict[str, Any]:
        """
        Get Selenium capabilities for remote grid.
        Used when Playwright WebSocket is not available.
        """
        provider = self.grid_config.get("provider", "local")
        
        capabilities = {
            "browserName": browser,
            "version": "latest",
            "platform": "ANY"
        }
        
        if provider == "browserstack":
            bs_config = self.grid_config["browserstack"]
            capabilities.update({
                "browserstack.user": bs_config["username"],
                "browserstack.key": bs_config["access_key"],
                "browserstack.local": "false",
                "browserstack.debug": "true"
            })
        
        elif provider == "saucelabs":
            sl_config = self.grid_config["saucelabs"]
            capabilities.update({
                "username": sl_config["username"],
                "accessKey": sl_config["access_key"]
            })
        
        return capabilities
    
    def should_use_remote_grid(self) -> bool:
        """Check if remote grid should be used"""
        provider = self.grid_config.get("provider", "local")
        return provider != "local"
    
    def get_connection_string(self, browser: str = "chromium") -> Optional[str]:
        """Get connection string for remote grid"""
        if not self.should_use_remote_grid():
            return None
        
        ws_endpoint = self.get_playwright_ws_endpoint(browser)
        if ws_endpoint:
            return ws_endpoint
        
        # Fallback to Selenium Grid URL
        provider = self.grid_config.get("provider", "local")
        if provider == "selenium_grid":
            return self.grid_config["selenium_grid"]["hub_url"]
        elif provider == "browserstack":
            return self.grid_config["browserstack"]["hub_url"]
        elif provider == "saucelabs":
            return self.grid_config["saucelabs"]["hub_url"]
        
        return None


# Global instance
_remote_grid_service = None

def get_remote_grid_service() -> RemoteGridService:
    """Get or create global RemoteGridService instance"""
    global _remote_grid_service
    if _remote_grid_service is None:
        _remote_grid_service = RemoteGridService()
    return _remote_grid_service

