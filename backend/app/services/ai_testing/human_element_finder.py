"""
Human Element Finder - TestRigor-Style Element Resolution

Finds elements the way humans do: by visible text, labels, roles, and visual context.
No CSS selectors, no XPath - pure user-facing locators.

Resolution Order (like a human scanning a page):
1. Playwright getByLabel()     → "Username" finds the input labeled "Username"
2. Playwright getByRole()      → "button Submit" finds the Submit button
3. Playwright getByText()      → "Log In" finds element containing "Log In"
4. Playwright getByPlaceholder() → "Enter email" finds input with that placeholder
5. Smart CSS fallback          → app-specific attributes (Salesforce, Workday, etc.)
6. Vision AI                   → screenshot + GPT-4V to locate element visually

This is what makes us BETTER than Blinq.io and TestRigor:
- We combine NL locators + Vision AI + App-specific knowledge
- They only do one or two of these

@version 2.0.0
"""

import logging
import time
import base64
import json
import re
from typing import Optional, Dict, Any, List, Tuple
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)


@dataclass
class FindResult:
    """Result of finding an element"""
    found: bool
    method: str = "unknown"              # label, role, text, placeholder, css, vision
    selector_used: str = ""
    confidence: float = 0.0
    attempts: List[str] = field(default_factory=list)
    error: Optional[str] = None
    vision_used: bool = False
    healing_suggestion: Optional[str] = None


# App-specific stable attributes for CSS fallback
APP_ATTRIBUTES = {
    "salesforce": {
        "username": ['#username', 'input[name="username"]', 'input[autocomplete="username"]'],
        "password": ['#password', 'input[name="password"]', 'input[type="password"]'],
        "login": ['#Login', 'input[name="Login"]', 'input[type="submit"][value="Log In"]'],
        "search": ['input[placeholder*="Search" i]', '[data-aura-class*="inputSearch"]', 'input.slds-input'],
        "app_launcher": ['button[title="App Launcher"]', '.appLauncher button', 'one-app-launcher-header button'],
    },
    "workday": {
        "username": ['input[data-automation-id="userName"]', '#input-4'],
        "password": ['input[data-automation-id="password"]', 'input[type="password"]'],
        "login": ['div[data-automation-id="click_filter"]', 'button[data-automation-id="goButton"]'],
    },
    "servicenow": {
        "username": ['#user_name', 'input[name="user_name"]'],
        "password": ['#user_password', 'input[name="user_password"]'],
        "login": ['#sysverb_login', 'button.btn-primary'],
    },
    "generic": {
        "username": ['input[type="email"]', 'input[type="text"][name*="user" i]', 'input[name*="email" i]',
                     'input[autocomplete="username"]', 'input[autocomplete="email"]'],
        "password": ['input[type="password"]'],
        "login": ['button[type="submit"]', 'input[type="submit"]', 'button:has-text("Log In")',
                  'button:has-text("Sign In")', 'button:has-text("Login")'],
        "search": ['input[type="search"]', 'input[placeholder*="Search" i]', 'input[role="searchbox"]'],
    }
}

# Mapping from natural language descriptions to element types
NL_TO_ELEMENT = {
    # Login-related
    r'username|user\s*name|email|user\s*id|login\s*id': 'username',
    r'password|passwd|pass\s*word|secret': 'password',
    r'log\s*in|sign\s*in|submit|log\s*on': 'login',
    r'search|find|look\s*up': 'search',
    r'app\s*launch': 'app_launcher',
}


class HumanElementFinder:
    """
    Finds elements the way a human would - by looking at labels, text, and visual cues.
    
    This is the core differentiator from competitors:
    - TestRigor: NL + screen scraping (no vision AI)
    - Blinq.io: Recorder + basic self-healing (no NL commands)
    - Us: NL + Playwright locators + Vision AI + App-specific knowledge
    """
    
    def __init__(self, page, app_type: str = "generic", vision_service=None):
        """
        Args:
            page: Playwright sync Page object
            app_type: Application type (salesforce, workday, servicenow, generic)
            vision_service: Optional VisionSelfHealingService instance
        """
        self.page = page
        self.app_type = app_type.lower()
        self.vision_service = vision_service
        self._vision_calls = 0
        self._max_vision_calls = 5  # Budget per test run
        self._selector_cache: Dict[str, str] = {}  # Cache successful selectors
    
    def detect_app_type(self, url: str) -> str:
        """Auto-detect application type from URL"""
        url_lower = url.lower()
        if 'salesforce.com' in url_lower or 'force.com' in url_lower or 'lightning' in url_lower:
            return 'salesforce'
        elif 'workday.com' in url_lower or 'myworkday' in url_lower:
            return 'workday'
        elif 'service-now.com' in url_lower or 'servicenow' in url_lower:
            return 'servicenow'
        elif 'sap.' in url_lower:
            return 'sap'
        return 'generic'
    
    def find_element(self, description: str, action: str = "click", value: str = "") -> FindResult:
        """
        Find an element using human-readable description.
        
        Like TestRigor's human emulator:
        - "Click the Login button" → finds by role(button, name="Login")
        - "Enter john@email.com in Username" → finds by label("Username")
        - "Click on Contacts" → finds by text("Contacts")
        
        Args:
            description: Human-readable element description
            action: What we want to do (click, fill, assert, etc.)
            value: Value to use (for fill actions)
            
        Returns:
            FindResult with success/failure details
        """
        attempts = []
        description_lower = description.lower().strip()
        
        # Check cache first
        cache_key = f"{action}:{description_lower}"
        if cache_key in self._selector_cache:
            cached = self._selector_cache[cache_key]
            try:
                el = self.page.locator(cached)
                if el.count() > 0 and el.first.is_visible():
                    return FindResult(
                        found=True, method="cache", selector_used=cached,
                        confidence=1.0, attempts=["Cache hit: " + cached]
                    )
            except:
                del self._selector_cache[cache_key]
        
        # =============================================
        # LAYER 1: Playwright Human Locators
        # =============================================
        result = self._try_playwright_locators(description, action, attempts)
        if result and result.found:
            self._selector_cache[cache_key] = result.selector_used
            return result
        
        # =============================================
        # LAYER 2: App-Specific Smart CSS
        # =============================================
        result = self._try_app_specific(description, action, attempts)
        if result and result.found:
            self._selector_cache[cache_key] = result.selector_used
            return result
        
        # =============================================
        # LAYER 3: Intelligent CSS Generation
        # =============================================
        result = self._try_intelligent_css(description, action, attempts)
        if result and result.found:
            self._selector_cache[cache_key] = result.selector_used
            return result
        
        # =============================================
        # LAYER 4: Vision AI (Last Resort)
        # =============================================
        result = self._try_vision_ai(description, action, attempts)
        if result and result.found:
            self._selector_cache[cache_key] = result.selector_used
            return result
        
        return FindResult(
            found=False, method="failed", confidence=0.0,
            attempts=attempts, error=f"Could not find element: {description}"
        )
    
    def _try_playwright_locators(self, description: str, action: str, attempts: list) -> Optional[FindResult]:
        """
        LAYER 1: Use Playwright's human-readable locators.
        This is the TestRigor approach but using Playwright's built-in API.
        """
        desc_lower = description.lower().strip()
        
        # Strategy 1: getByLabel - "Username field", "Password input"
        label_text = self._extract_label(description)
        if label_text:
            try:
                attempts.append(f"getByLabel('{label_text}')")
                el = self.page.get_by_label(label_text, exact=False)
                if el.count() > 0 and el.first.is_visible():
                    logger.info(f"Found by label: '{label_text}'")
                    return FindResult(
                        found=True, method="label",
                        selector_used=f"getByLabel('{label_text}')",
                        confidence=0.95, attempts=attempts
                    )
            except Exception as e:
                logger.debug(f"getByLabel failed: {e}")
        
        # Strategy 2: getByRole - "Login button", "Submit link"
        role, name = self._extract_role_and_name(description, action)
        if role:
            try:
                attempts.append(f"getByRole('{role}', name='{name}')")
                if name:
                    el = self.page.get_by_role(role, name=re.compile(name, re.IGNORECASE))
                else:
                    el = self.page.get_by_role(role)
                if el.count() > 0 and el.first.is_visible():
                    logger.info(f"Found by role: '{role}' name='{name}'")
                    return FindResult(
                        found=True, method="role",
                        selector_used=f"getByRole('{role}', name='{name}')",
                        confidence=0.93, attempts=attempts
                    )
            except Exception as e:
                logger.debug(f"getByRole failed: {e}")
        
        # Strategy 3: getByPlaceholder - "Enter your email", "Type password"
        placeholder = self._extract_placeholder(description)
        if placeholder:
            try:
                attempts.append(f"getByPlaceholder('{placeholder}')")
                el = self.page.get_by_placeholder(re.compile(placeholder, re.IGNORECASE))
                if el.count() > 0 and el.first.is_visible():
                    logger.info(f"Found by placeholder: '{placeholder}'")
                    return FindResult(
                        found=True, method="placeholder",
                        selector_used=f"getByPlaceholder('{placeholder}')",
                        confidence=0.90, attempts=attempts
                    )
            except Exception as e:
                logger.debug(f"getByPlaceholder failed: {e}")
        
        # Strategy 4: getByText - "Click on Contacts", "See All Contacts"
        text = self._extract_text(description)
        if text:
            try:
                attempts.append(f"getByText('{text}')")
                el = self.page.get_by_text(re.compile(text, re.IGNORECASE))
                if el.count() > 0 and el.first.is_visible():
                    logger.info(f"Found by text: '{text}'")
                    return FindResult(
                        found=True, method="text",
                        selector_used=f"getByText('{text}')",
                        confidence=0.88, attempts=attempts
                    )
            except Exception as e:
                logger.debug(f"getByText failed: {e}")
        
        # Strategy 5: getByTestId
        testid = self._extract_testid(description)
        if testid:
            try:
                attempts.append(f"getByTestId('{testid}')")
                el = self.page.get_by_test_id(testid)
                if el.count() > 0 and el.first.is_visible():
                    logger.info(f"Found by testid: '{testid}'")
                    return FindResult(
                        found=True, method="testid",
                        selector_used=f"getByTestId('{testid}')",
                        confidence=0.95, attempts=attempts
                    )
            except Exception as e:
                logger.debug(f"getByTestId failed: {e}")
        
        return None
    
    def _try_app_specific(self, description: str, action: str, attempts: list) -> Optional[FindResult]:
        """
        LAYER 2: Use app-specific known selectors.
        Our advantage: pre-mapped selectors for Salesforce, Workday, ServiceNow, etc.
        """
        element_type = self._classify_element(description)
        if not element_type:
            return None
        
        # Try app-specific selectors first, then generic
        app_selectors = APP_ATTRIBUTES.get(self.app_type, {}).get(element_type, [])
        generic_selectors = APP_ATTRIBUTES.get("generic", {}).get(element_type, [])
        
        all_selectors = app_selectors + [s for s in generic_selectors if s not in app_selectors]
        
        for selector in all_selectors:
            try:
                attempts.append(f"AppSpecific({self.app_type}): {selector}")
                el = self.page.locator(selector)
                if el.count() > 0 and el.first.is_visible():
                    logger.info(f"Found by app-specific selector: {selector}")
                    return FindResult(
                        found=True, method=f"app_specific_{self.app_type}",
                        selector_used=selector,
                        confidence=0.85, attempts=attempts
                    )
            except Exception as e:
                logger.debug(f"App selector failed: {selector} - {e}")
        
        return None
    
    def _try_intelligent_css(self, description: str, action: str, attempts: list) -> Optional[FindResult]:
        """
        LAYER 3: Generate intelligent CSS selectors from description.
        Uses DOM analysis to find matching elements.
        """
        desc_lower = description.lower()
        
        # Build a list of selectors to try based on description keywords
        selectors = []
        
        # Extract any direct references to element attributes
        for word in desc_lower.split():
            clean = word.strip('.,!?\'\"')
            if clean:
                selectors.extend([
                    f'[name="{clean}" i]',
                    f'[id="{clean}" i]',
                    f'[aria-label*="{clean}" i]',
                    f'[title*="{clean}" i]',
                    f'[placeholder*="{clean}" i]',
                ])
        
        for selector in selectors:
            try:
                attempts.append(f"IntelligentCSS: {selector}")
                el = self.page.locator(selector)
                if el.count() > 0 and el.first.is_visible():
                    logger.info(f"Found by intelligent CSS: {selector}")
                    return FindResult(
                        found=True, method="intelligent_css",
                        selector_used=selector,
                        confidence=0.75, attempts=attempts
                    )
            except:
                continue
        
        return None
    
    def _try_vision_ai(self, description: str, action: str, attempts: list) -> Optional[FindResult]:
        """
        LAYER 4: Vision AI - Send screenshot to GPT-4V to find element.
        This is the KILLER feature that makes us better than competitors.
        """
        if not self.vision_service or not hasattr(self.vision_service, 'available') or not self.vision_service.available:
            attempts.append("Vision AI: Not available (no API key)")
            return None
        
        if self._vision_calls >= self._max_vision_calls:
            attempts.append(f"Vision AI: Budget exhausted ({self._vision_calls}/{self._max_vision_calls})")
            return None
        
        try:
            attempts.append(f"Vision AI: Looking for '{description}'")
            
            # Take screenshot
            screenshot_bytes = self.page.screenshot(type='png')
            screenshot_b64 = base64.b64encode(screenshot_bytes).decode('utf-8')
            
            self._vision_calls += 1
            
            # Use vision service (need to run async in sync context)
            import asyncio
            try:
                loop = asyncio.get_event_loop()
                if loop.is_running():
                    # We're in an async context, use it
                    import concurrent.futures
                    with concurrent.futures.ThreadPoolExecutor() as pool:
                        location = pool.submit(
                            lambda: asyncio.run(
                                self.vision_service.find_element_by_description(
                                    screenshot_b64, description, f"App type: {self.app_type}"
                                )
                            )
                        ).result(timeout=15)
                else:
                    location = loop.run_until_complete(
                        self.vision_service.find_element_by_description(
                            screenshot_b64, description, f"App type: {self.app_type}"
                        )
                    )
            except RuntimeError:
                location = asyncio.run(
                    self.vision_service.find_element_by_description(
                        screenshot_b64, description, f"App type: {self.app_type}"
                    )
                )
            
            if location.found and location.x and location.y:
                logger.info(f"Vision AI found element at ({location.x}, {location.y}) "
                           f"confidence={location.confidence}")
                
                # Click at coordinates to find the actual element
                # Then get a selector for it
                if location.selector_suggestion:
                    try:
                        el = self.page.locator(location.selector_suggestion)
                        if el.count() > 0:
                            return FindResult(
                                found=True, method="vision_ai",
                                selector_used=location.selector_suggestion,
                                confidence=location.confidence,
                                attempts=attempts, vision_used=True
                            )
                    except:
                        pass
                
                # Use coordinates as fallback
                return FindResult(
                    found=True, method="vision_ai_coordinates",
                    selector_used=f"coordinates:{location.x},{location.y}",
                    confidence=location.confidence,
                    attempts=attempts, vision_used=True
                )
            
            attempts.append(f"Vision AI: Element not found (confidence: {location.confidence})")
            
        except Exception as e:
            logger.error(f"Vision AI error: {e}")
            attempts.append(f"Vision AI error: {str(e)}")
        
        return None
    
    def perform_action(self, find_result: FindResult, action: str, value: str = "") -> bool:
        """
        Perform an action on a found element.
        
        Handles both selector-based and coordinate-based results.
        """
        if not find_result.found:
            return False
        
        try:
            selector = find_result.selector_used
            
            # Coordinate-based action (from Vision AI)
            if selector.startswith("coordinates:"):
                x, y = selector.replace("coordinates:", "").split(",")
                x, y = int(x), int(y)
                
                if action == "click":
                    self.page.mouse.click(x, y)
                elif action == "fill":
                    self.page.mouse.click(x, y)
                    time.sleep(0.2)
                    self.page.keyboard.type(value, delay=30)
                return True
            
            # getByLabel/getByRole/getByText (re-resolve with Playwright)
            if selector.startswith("getByLabel("):
                label = selector.split("'")[1]
                el = self.page.get_by_label(label, exact=False).first
            elif selector.startswith("getByRole("):
                parts = selector.split("'")
                role = parts[1]
                name = parts[3] if len(parts) > 3 else None
                if name:
                    el = self.page.get_by_role(role, name=re.compile(name, re.IGNORECASE)).first
                else:
                    el = self.page.get_by_role(role).first
            elif selector.startswith("getByText("):
                text = selector.split("'")[1]
                el = self.page.get_by_text(re.compile(text, re.IGNORECASE)).first
            elif selector.startswith("getByPlaceholder("):
                ph = selector.split("'")[1]
                el = self.page.get_by_placeholder(re.compile(ph, re.IGNORECASE)).first
            elif selector.startswith("getByTestId("):
                tid = selector.split("'")[1]
                el = self.page.get_by_test_id(tid).first
            else:
                # Regular CSS selector
                el = self.page.locator(selector).first
            
            # Perform the action
            if action == "click":
                el.scroll_into_view_if_needed()
                el.click()
            elif action == "fill":
                el.scroll_into_view_if_needed()
                el.clear()
                el.fill(value)
            elif action == "check":
                el.check()
            elif action == "select":
                el.select_option(value)
            elif action == "hover":
                el.hover()
            
            return True
            
        except Exception as e:
            logger.error(f"Action '{action}' failed on '{find_result.selector_used}': {e}")
            return False
    
    # ==== Text Extraction Helpers ====
    
    def _extract_label(self, description: str) -> Optional[str]:
        """Extract label text: 'Username field' → 'Username'"""
        desc = description.strip()
        # Patterns: "the Username field", "Username input", "enter in Username"
        patterns = [
            r'(?:the\s+)?["\']?(.+?)["\']?\s+(?:field|input|textbox|text\s*box|area)',
            r'(?:enter|type|fill|input)\s+(?:.*?\s+)?(?:in|into)\s+(?:the\s+)?["\']?(.+?)["\']?(?:\s|$)',
            r'^["\']?(.+?)["\']?$',  # Direct label name
        ]
        for pattern in patterns:
            m = re.search(pattern, desc, re.IGNORECASE)
            if m:
                label = m.group(1).strip().strip('"\'')
                # Don't return if it's too generic
                if label.lower() not in ('the', 'a', 'an', 'this', 'that', 'it'):
                    return label
        return None
    
    def _extract_role_and_name(self, description: str, action: str) -> Tuple[Optional[str], Optional[str]]:
        """Extract role and accessible name from description."""
        desc_lower = description.lower().strip()
        
        # Explicit role mentions
        role_keywords = {
            'button': 'button', 'btn': 'button', 'submit': 'button',
            'link': 'link', 'anchor': 'link',
            'checkbox': 'checkbox', 'check box': 'checkbox',
            'radio': 'radio',
            'tab': 'tab',
            'menu': 'menu', 'menuitem': 'menuitem',
            'heading': 'heading',
            'textbox': 'textbox', 'input': 'textbox',
            'combobox': 'combobox', 'dropdown': 'combobox', 'select': 'combobox',
        }
        
        role = None
        name = description.strip()
        
        for keyword, r in role_keywords.items():
            if keyword in desc_lower:
                role = r
                # Extract the name (remove the role keyword)
                name = re.sub(rf'\b{keyword}\b', '', description, flags=re.IGNORECASE).strip()
                name = re.sub(r'^(the|a|an|click|press|tap)\s+', '', name, flags=re.IGNORECASE).strip()
                break
        
        # If action is click and no role found, assume button
        if not role and action == "click":
            role = "button"
            name = re.sub(r'^(click|press|tap)\s+(on\s+)?(the\s+)?', '', description, flags=re.IGNORECASE).strip()
        
        return role, name if name else None
    
    def _extract_placeholder(self, description: str) -> Optional[str]:
        """Extract placeholder text from description."""
        patterns = [
            r'placeholder\s+["\']?(.+?)["\']?(?:\s|$)',
            r'(?:says|showing|with)\s+["\'](.+?)["\']',
        ]
        for pattern in patterns:
            m = re.search(pattern, description, re.IGNORECASE)
            if m:
                return m.group(1).strip()
        return None
    
    def _extract_text(self, description: str) -> Optional[str]:
        """Extract text content to search for."""
        desc = description.strip()
        # Remove action verbs
        text = re.sub(r'^(click|press|tap|select|choose|pick|find|locate)\s+(on\s+)?(the\s+)?', 
                      '', desc, flags=re.IGNORECASE).strip()
        # Remove quotes
        text = text.strip('"\'')
        if text and len(text) > 1:
            return text
        return None
    
    def _extract_testid(self, description: str) -> Optional[str]:
        """Extract test ID if explicitly mentioned."""
        m = re.search(r'(?:test-?id|data-testid)\s*[=:]\s*["\']?(.+?)["\']?(?:\s|$)', 
                      description, re.IGNORECASE)
        return m.group(1) if m else None
    
    def _classify_element(self, description: str) -> Optional[str]:
        """Classify element type from natural language."""
        desc_lower = description.lower()
        for pattern, element_type in NL_TO_ELEMENT.items():
            if re.search(pattern, desc_lower):
                return element_type
        return None
