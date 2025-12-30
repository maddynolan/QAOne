"""
Flowstral Keywords Library - QWeb-style text-based test automation keywords.

Inspired by Copado's QWeb library, these keywords use text and labels instead of 
CSS selectors, making tests more readable and resilient to UI changes.

Usage:
    click_text(page, "Submit")
    type_text(page, "Username", "john@example.com")
    verify_text(page, "Welcome")
"""

from playwright.sync_api import Page, Locator, TimeoutError as PlaywrightTimeout
from typing import Optional, List
import re


class FlowstralKeywords:
    """
    Text-based keyword library for human-readable test automation.
    
    Example test:
        keywords = FlowstralKeywords(page)
        keywords.click_text("App Launcher")
        keywords.type_text("Search apps", "Accounts")
        keywords.click_text("Accounts")
        keywords.verify_text("Recently Viewed")
    """
    
    def __init__(self, page: Page, timeout: int = 30000):
        self.page = page
        self.timeout = timeout
    
    def click_text(self, text: str, exact: bool = False, index: int = 0, timeout: Optional[int] = None) -> None:
        """
        Click an element containing the specified text.
        
        Args:
            text: Text to find and click
            exact: If True, match exact text only
            index: If multiple matches, click the nth one (0-based)
            timeout: Override default timeout (ms)
        
        Examples:
            click_text("Submit")
            click_text("Log In", exact=True)
            click_text("Edit", index=1)  # Click second "Edit" button
        """
        timeout = timeout or self.timeout
        
        # Try multiple strategies
        strategies = [
            # Playwright's text selector
            f"text={text}" if not exact else f"text=\"{text}\"",
            # Role-based with name
            f"role=button[name=\"{text}\"]",
            f"role=link[name=\"{text}\"]",
            f"role=tab[name=\"{text}\"]",
            f"role=menuitem[name=\"{text}\"]",
            # Aria label
            f"[aria-label*=\"{text}\" i]",
            # Title attribute
            f"[title*=\"{text}\" i]",
            # Data attributes common in Salesforce
            f"[data-label*=\"{text}\" i]",
            # Button/link containing text
            f"button:has-text(\"{text}\")",
            f"a:has-text(\"{text}\")",
            f"[role='button']:has-text(\"{text}\")",
            # Salesforce-specific
            f"lightning-button:has-text(\"{text}\")",
            f".slds-button:has-text(\"{text}\")",
        ]
        
        for selector in strategies:
            try:
                locator = self.page.locator(selector)
                count = locator.count()
                if count > index:
                    locator.nth(index).click(timeout=timeout)
                    print(f"[ClickText] Clicked '{text}' using: {selector}")
                    return
            except Exception:
                continue
        
        raise Exception(f"ClickText failed: No element found with text '{text}'")
    
    def type_text(self, label: str, value: str, clear: bool = True, timeout: Optional[int] = None) -> None:
        """
        Find an input by its label and type a value.
        
        Args:
            label: Label text, placeholder, or aria-label of the input
            value: Value to type
            clear: If True, clear the field before typing
            timeout: Override default timeout (ms)
        
        Examples:
            type_text("Username", "john@example.com")
            type_text("Search apps and items", "Accounts")
            type_text("Phone", "555-1234")
        """
        timeout = timeout or self.timeout
        
        # Strategies to find input by label
        strategies = [
            # Placeholder match
            f"input[placeholder*=\"{label}\" i]",
            f"textarea[placeholder*=\"{label}\" i]",
            # Aria-label match
            f"input[aria-label*=\"{label}\" i]",
            f"textarea[aria-label*=\"{label}\" i]",
            # Name attribute match
            f"input[name*=\"{label}\" i]",
            # Label association
            f"label:has-text(\"{label}\") input",
            f"label:has-text(\"{label}\") + input",
            f"label:has-text(\"{label}\") ~ input",
            # Salesforce Lightning inputs
            f"lightning-input:has-text(\"{label}\") input",
            f"lightning-textarea:has-text(\"{label}\") textarea",
            f"lightning-combobox:has-text(\"{label}\") input",
            # Generic nearby input strategy
            f"*:has-text(\"{label}\") >> input",
            f"*:has-text(\"{label}\") >> textarea",
            # Data-label (Salesforce)
            f"[data-label*=\"{label}\" i] input",
        ]
        
        for selector in strategies:
            try:
                locator = self.page.locator(selector).first
                if locator.count() > 0:
                    if clear:
                        locator.clear(timeout=timeout)
                    locator.fill(value, timeout=timeout)
                    print(f"[TypeText] Typed '{value[:20]}...' into '{label}' using: {selector}")
                    return
            except Exception:
                continue
        
        raise Exception(f"TypeText failed: No input found for label '{label}'")
    
    def verify_text(self, text: str, timeout: Optional[int] = None) -> None:
        """
        Verify that text exists on the page.
        
        Args:
            text: Text to verify exists
            timeout: How long to wait for text to appear
        
        Examples:
            verify_text("Welcome")
            verify_text("Successfully saved")
        """
        timeout = timeout or self.timeout
        
        try:
            self.page.wait_for_selector(f"text={text}", timeout=timeout)
            print(f"[VerifyText] Found: '{text}'")
        except PlaywrightTimeout:
            raise Exception(f"VerifyText failed: Text '{text}' not found on page")
    
    def verify_no_text(self, text: str, timeout: int = 5000) -> None:
        """
        Verify that text does NOT exist on the page.
        
        Args:
            text: Text that should not be present
            timeout: How long to check
        """
        try:
            self.page.wait_for_selector(f"text={text}", timeout=timeout)
            raise Exception(f"VerifyNoText failed: Text '{text}' was found but shouldn't exist")
        except PlaywrightTimeout:
            print(f"[VerifyNoText] Confirmed '{text}' not present")
    
    def click_element(self, selector: str, timeout: Optional[int] = None) -> None:
        """
        Click an element using a CSS/XPath selector (fallback for complex cases).
        
        Args:
            selector: CSS or XPath selector
            timeout: Override default timeout
        
        Examples:
            click_element("//input[@name='Submit']")
            click_element(".btn-primary")
        """
        timeout = timeout or self.timeout
        self.page.locator(selector).click(timeout=timeout)
        print(f"[ClickElement] Clicked: {selector}")
    
    def write_text(self, selector: str, value: str, clear: bool = True, timeout: Optional[int] = None) -> None:
        """
        Write text to a specific element (fallback for complex cases).
        
        Args:
            selector: CSS or XPath selector
            value: Value to type
            clear: Clear field first
        """
        timeout = timeout or self.timeout
        locator = self.page.locator(selector)
        if clear:
            locator.clear(timeout=timeout)
        locator.fill(value, timeout=timeout)
        print(f"[WriteText] Wrote to {selector}")
    
    def select_option(self, label: str, option: str, timeout: Optional[int] = None) -> None:
        """
        Select an option from a dropdown by label.
        
        Args:
            label: Label of the dropdown
            option: Option text to select
        """
        timeout = timeout or self.timeout
        
        strategies = [
            f"select[aria-label*=\"{label}\" i]",
            f"label:has-text(\"{label}\") + select",
            f"label:has-text(\"{label}\") ~ select",
            f"lightning-combobox:has-text(\"{label}\")",
        ]
        
        for selector in strategies:
            try:
                locator = self.page.locator(selector).first
                if locator.count() > 0:
                    # Try standard select
                    try:
                        locator.select_option(label=option, timeout=timeout)
                        print(f"[SelectOption] Selected '{option}' in '{label}'")
                        return
                    except:
                        # Lightning combobox - click to open, then click option
                        locator.click(timeout=timeout)
                        self.page.wait_for_timeout(500)
                        self.click_text(option, timeout=5000)
                        return
            except:
                continue
        
        raise Exception(f"SelectOption failed: No dropdown found for '{label}'")
    
    def hover_text(self, text: str, timeout: Optional[int] = None) -> None:
        """
        Hover over an element containing text.
        """
        timeout = timeout or self.timeout
        
        strategies = [
            f"text={text}",
            f"[aria-label*=\"{text}\" i]",
            f"[title*=\"{text}\" i]",
        ]
        
        for selector in strategies:
            try:
                locator = self.page.locator(selector).first
                if locator.count() > 0:
                    locator.hover(timeout=timeout)
                    print(f"[HoverText] Hovered '{text}'")
                    return
            except:
                continue
        
        raise Exception(f"HoverText failed: No element found with text '{text}'")
    
    def wait_for_text(self, text: str, timeout: Optional[int] = None) -> None:
        """
        Wait for text to appear on the page.
        """
        timeout = timeout or self.timeout
        self.page.wait_for_selector(f"text={text}", timeout=timeout)
        print(f"[WaitForText] '{text}' appeared")
    
    def wait_until_loaded(self, timeout: Optional[int] = None) -> None:
        """
        Wait for page to be fully loaded (network idle).
        """
        timeout = timeout or self.timeout
        self.page.wait_for_load_state("networkidle", timeout=timeout)
        print("[WaitUntilLoaded] Page loaded")
    
    def press_key(self, key: str) -> None:
        """
        Press a keyboard key.
        
        Args:
            key: Key to press (Enter, Tab, Escape, etc.)
        """
        self.page.keyboard.press(key)
        print(f"[PressKey] Pressed {key}")
    
    def take_screenshot(self, name: str = "screenshot") -> str:
        """
        Take a screenshot.
        
        Returns:
            Path to saved screenshot
        """
        path = f"{name}.png"
        self.page.screenshot(path=path)
        print(f"[Screenshot] Saved: {path}")
        return path


# Standalone functions for simpler usage
def click_text(page: Page, text: str, **kwargs) -> None:
    """Click element containing text."""
    FlowstralKeywords(page).click_text(text, **kwargs)

def type_text(page: Page, label: str, value: str, **kwargs) -> None:
    """Type into input identified by label."""
    FlowstralKeywords(page).type_text(label, value, **kwargs)

def verify_text(page: Page, text: str, **kwargs) -> None:
    """Verify text exists on page."""
    FlowstralKeywords(page).verify_text(text, **kwargs)

def click_element(page: Page, selector: str, **kwargs) -> None:
    """Click element by selector."""
    FlowstralKeywords(page).click_element(selector, **kwargs)

def write_text(page: Page, selector: str, value: str, **kwargs) -> None:
    """Write to element by selector."""
    FlowstralKeywords(page).write_text(selector, value, **kwargs)

def select_option(page: Page, label: str, option: str, **kwargs) -> None:
    """Select dropdown option."""
    FlowstralKeywords(page).select_option(label, option, **kwargs)

def hover_text(page: Page, text: str, **kwargs) -> None:
    """Hover over element with text."""
    FlowstralKeywords(page).hover_text(text, **kwargs)

def wait_for_text(page: Page, text: str, **kwargs) -> None:
    """Wait for text to appear."""
    FlowstralKeywords(page).wait_for_text(text, **kwargs)

def press_key(page: Page, key: str) -> None:
    """Press keyboard key."""
    FlowstralKeywords(page).press_key(key)

