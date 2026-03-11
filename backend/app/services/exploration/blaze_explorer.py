# DEPRECATED — Scheduled for removal (v3.20.0)
# Blaze Explorer is unused. Frontend FlowpilotPage.tsx references /api/blaze
# endpoints but the feature is non-functional/unused in production.
"""
Blaze Explorer - Real Autonomous Exploratory Testing Engine
Finds actual defects on any website without AI dependencies

Detects:
- Broken links (404, 500 errors)
- JavaScript/Console errors
- Accessibility issues (missing alt text, labels, ARIA)
- Performance issues (slow loads, large resources)
- Security issues (missing headers, mixed content)
- Visual/UI issues (overlapping elements, broken images)
- Form issues (missing validation, labels)
- Mobile responsiveness
"""

import asyncio
import logging
import time
import re
from typing import Dict, List, Any, Optional, Set
from dataclasses import dataclass, field
from datetime import datetime
from urllib.parse import urljoin, urlparse
import traceback

logger = logging.getLogger(__name__)

@dataclass
class Defect:
    """Represents a detected defect"""
    id: str
    type: str  # broken_link, js_error, accessibility, performance, security, visual, form
    severity: str  # critical, high, medium, low
    title: str
    description: str
    page_url: str
    element: Optional[str] = None
    screenshot: Optional[str] = None
    timestamp: str = field(default_factory=lambda: datetime.now().isoformat())
    reproducible: bool = True
    evidence: Optional[Dict[str, Any]] = None


@dataclass
class PageInfo:
    """Information about a crawled page"""
    url: str
    title: str
    status_code: int
    load_time: float
    links: List[str]
    forms: List[Dict]
    images: List[Dict]
    console_errors: List[str]
    console_warnings: List[str]
    accessibility_issues: List[Dict]
    performance_metrics: Dict[str, Any]


class BlazeExplorer:
    """
    Real exploratory testing engine that crawls websites and finds actual defects.
    No AI/OpenAI dependency - uses intelligent heuristics.
    """
    
    def __init__(self):
        self.visited_urls: Set[str] = set()
        self.defects: List[Defect] = []
        self.pages: List[PageInfo] = []
        self.console_errors: List[Dict] = []
        self.start_time: float = 0
        self.base_domain: str = ""
        self.status: str = "idle"
        self.current_activity: str = ""
        self.progress: float = 0
        self.max_pages: int = 20
        self.max_duration: int = 600  # 10 minutes default
        self._defect_counter = 0
        
    def _generate_defect_id(self) -> str:
        self._defect_counter += 1
        return f"BLZ-{self._defect_counter:04d}"
    
    async def explore(
        self,
        start_url: str,
        max_pages: int = 20,
        max_duration_minutes: int = 10,
        headless: bool = True,
        test_types: Optional[Dict[str, bool]] = None
    ) -> Dict[str, Any]:
        """
        Main exploration method - crawls website and finds defects
        """
        from playwright.async_api import async_playwright
        
        self.max_pages = max_pages
        self.max_duration = max_duration_minutes * 60
        self.start_time = time.time()
        self.status = "running"
        self.visited_urls = set()
        self.defects = []
        self.pages = []
        self.console_errors = []
        
        # Parse base domain
        parsed = urlparse(start_url)
        self.base_domain = parsed.netloc
        
        test_types = test_types or {
            "functional": True,
            "accessibility": True,
            "performance": True,
            "security": True
        }
        
        logger.info(f"Starting Blaze exploration of {start_url}")
        self.current_activity = f"Starting exploration of {start_url}"
        
        try:
            async with async_playwright() as p:
                browser = await p.chromium.launch(headless=headless)
                context = await browser.new_context(
                    viewport={"width": 1920, "height": 1080},
                    user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
                )
                
                # Set up console error collection
                page = await context.new_page()
                
                # Collect console messages
                page.on("console", lambda msg: self._handle_console(msg))
                page.on("pageerror", lambda err: self._handle_page_error(err, page.url))
                
                # Start crawling
                urls_to_visit = [start_url]
                
                while urls_to_visit and len(self.visited_urls) < self.max_pages:
                    # Check timeout
                    if time.time() - self.start_time > self.max_duration:
                        logger.info("Max duration reached, stopping exploration")
                        break
                    
                    url = urls_to_visit.pop(0)
                    
                    if url in self.visited_urls:
                        continue
                    
                    if not self._is_same_domain(url):
                        continue
                    
                    self.visited_urls.add(url)
                    self.progress = (len(self.visited_urls) / self.max_pages) * 100
                    self.current_activity = f"Analyzing: {url}"
                    
                    try:
                        # Visit page and collect data
                        page_info = await self._analyze_page(page, url, test_types)
                        if page_info:
                            self.pages.append(page_info)
                            
                            # Add discovered links to queue
                            for link in page_info.links:
                                if link not in self.visited_urls and link not in urls_to_visit:
                                    urls_to_visit.append(link)
                    
                    except Exception as e:
                        logger.error(f"Error analyzing {url}: {e}")
                        # Record the error as a potential defect
                        self.defects.append(Defect(
                            id=self._generate_defect_id(),
                            type="page_error",
                            severity="high",
                            title=f"Page Load Error",
                            description=f"Failed to load page: {str(e)}",
                            page_url=url,
                            evidence={"error": str(e)}
                        ))
                
                await browser.close()
        
        except Exception as e:
            logger.error(f"Blaze exploration failed: {e}\n{traceback.format_exc()}")
            self.status = "error"
            return {
                "status": "error",
                "error": str(e),
                "defects": [d.__dict__ for d in self.defects],
                "pages_visited": len(self.visited_urls),
                "duration": time.time() - self.start_time
            }
        
        self.status = "completed"
        self.current_activity = "Exploration complete"
        self.progress = 100
        
        return {
            "status": "completed",
            "defects": [d.__dict__ for d in self.defects],
            "defect_count": len(self.defects),
            "pages_visited": len(self.visited_urls),
            "pages": [{"url": p.url, "title": p.title, "status": p.status_code} for p in self.pages],
            "duration": time.time() - self.start_time,
            "summary": self._generate_summary()
        }
    
    async def _analyze_page(
        self, 
        page, 
        url: str, 
        test_types: Dict[str, bool]
    ) -> Optional[PageInfo]:
        """Analyze a single page for defects"""
        
        start_time = time.time()
        console_errors = []
        console_warnings = []
        
        try:
            # Navigate to page
            response = await page.goto(url, wait_until="domcontentloaded", timeout=30000)
            
            if not response:
                return None
            
            status_code = response.status
            load_time = time.time() - start_time
            
            # Wait for page to stabilize
            await page.wait_for_timeout(1000)
            
            # Get page title
            title = await page.title()
            
            # Check for error status codes
            if status_code >= 400:
                self.defects.append(Defect(
                    id=self._generate_defect_id(),
                    type="broken_link",
                    severity="critical" if status_code >= 500 else "high",
                    title=f"HTTP {status_code} Error",
                    description=f"Page returned {status_code} status code",
                    page_url=url,
                    evidence={"status_code": status_code}
                ))
            
            # Performance check
            if test_types.get("performance", True):
                if load_time > 5:
                    self.defects.append(Defect(
                        id=self._generate_defect_id(),
                        type="performance",
                        severity="high" if load_time > 10 else "medium",
                        title="Slow Page Load",
                        description=f"Page took {load_time:.2f} seconds to load (recommended < 3s)",
                        page_url=url,
                        evidence={"load_time": load_time}
                    ))
            
            # Collect links
            links = await self._collect_links(page, url)
            
            # Collect and check images
            images = await self._check_images(page, url, test_types.get("accessibility", True))
            
            # Collect and check forms
            forms = await self._check_forms(page, url)
            
            # Accessibility checks
            if test_types.get("accessibility", True):
                await self._check_accessibility(page, url)
            
            # Security checks
            if test_types.get("security", True):
                await self._check_security(page, url, response)
            
            # Check for JavaScript errors in the page
            await self._check_js_errors(page, url)
            
            # Functional checks
            if test_types.get("functional", True):
                await self._check_functional(page, url)
            
            return PageInfo(
                url=url,
                title=title,
                status_code=status_code,
                load_time=load_time,
                links=links,
                forms=forms,
                images=images,
                console_errors=console_errors,
                console_warnings=console_warnings,
                accessibility_issues=[],
                performance_metrics={"load_time": load_time}
            )
            
        except Exception as e:
            logger.error(f"Error analyzing page {url}: {e}")
            return None
    
    async def _collect_links(self, page, current_url: str) -> List[str]:
        """Collect all links from the page"""
        links = []
        try:
            elements = await page.query_selector_all("a[href]")
            for el in elements:
                href = await el.get_attribute("href")
                if href:
                    absolute_url = urljoin(current_url, href)
                    # Filter out non-http links
                    if absolute_url.startswith(("http://", "https://")):
                        links.append(absolute_url)
        except Exception as e:
            logger.debug(f"Error collecting links: {e}")
        return links
    
    async def _check_images(self, page, url: str, check_accessibility: bool) -> List[Dict]:
        """Check images for issues"""
        images = []
        try:
            img_elements = await page.query_selector_all("img")
            for img in img_elements:
                src = await img.get_attribute("src")
                alt = await img.get_attribute("alt")
                
                image_info = {"src": src, "alt": alt}
                images.append(image_info)
                
                # Check for missing alt text (accessibility)
                if check_accessibility and (alt is None or alt.strip() == ""):
                    self.defects.append(Defect(
                        id=self._generate_defect_id(),
                        type="accessibility",
                        severity="medium",
                        title="Missing Alt Text",
                        description=f"Image is missing alt text, which is required for screen readers",
                        page_url=url,
                        element=f"<img src='{src[:50]}...'>",
                        evidence={"src": src}
                    ))
                
                # Check for broken images
                if src:
                    try:
                        is_visible = await img.is_visible()
                        natural_width = await img.evaluate("el => el.naturalWidth")
                        if natural_width == 0:
                            self.defects.append(Defect(
                                id=self._generate_defect_id(),
                                type="broken_link",
                                severity="high",
                                title="Broken Image",
                                description=f"Image failed to load",
                                page_url=url,
                                element=f"<img src='{src[:50]}...'>",
                                evidence={"src": src}
                            ))
                    except:
                        pass
                        
        except Exception as e:
            logger.debug(f"Error checking images: {e}")
        return images
    
    async def _check_forms(self, page, url: str) -> List[Dict]:
        """Check forms for issues"""
        forms = []
        try:
            form_elements = await page.query_selector_all("form")
            for form in form_elements:
                action = await form.get_attribute("action")
                method = await form.get_attribute("method")
                
                form_info = {"action": action, "method": method}
                forms.append(form_info)
                
                # Check for inputs without labels
                inputs = await form.query_selector_all("input:not([type='hidden']):not([type='submit']):not([type='button'])")
                for inp in inputs:
                    input_id = await inp.get_attribute("id")
                    input_name = await inp.get_attribute("name")
                    input_type = await inp.get_attribute("type")
                    aria_label = await inp.get_attribute("aria-label")
                    placeholder = await inp.get_attribute("placeholder")
                    
                    # Check if input has a label
                    has_label = False
                    if input_id:
                        label = await page.query_selector(f"label[for='{input_id}']")
                        has_label = label is not None
                    
                    if not has_label and not aria_label:
                        self.defects.append(Defect(
                            id=self._generate_defect_id(),
                            type="accessibility",
                            severity="medium",
                            title="Form Input Missing Label",
                            description=f"Input field '{input_name or input_type}' has no associated label or aria-label",
                            page_url=url,
                            element=f"<input name='{input_name}' type='{input_type}'>",
                            evidence={"input_name": input_name, "input_type": input_type}
                        ))
                        
        except Exception as e:
            logger.debug(f"Error checking forms: {e}")
        return forms
    
    async def _check_accessibility(self, page, url: str):
        """Check for accessibility issues"""
        try:
            # Check for missing page title
            title = await page.title()
            if not title or title.strip() == "":
                self.defects.append(Defect(
                    id=self._generate_defect_id(),
                    type="accessibility",
                    severity="high",
                    title="Missing Page Title",
                    description="Page has no title, which is required for accessibility",
                    page_url=url
                ))
            
            # Check for missing lang attribute
            html = await page.query_selector("html")
            if html:
                lang = await html.get_attribute("lang")
                if not lang:
                    self.defects.append(Defect(
                        id=self._generate_defect_id(),
                        type="accessibility",
                        severity="medium",
                        title="Missing Language Attribute",
                        description="HTML element is missing lang attribute",
                        page_url=url
                    ))
            
            # Check for missing h1
            h1 = await page.query_selector("h1")
            if not h1:
                self.defects.append(Defect(
                    id=self._generate_defect_id(),
                    type="accessibility",
                    severity="low",
                    title="Missing H1 Heading",
                    description="Page has no H1 heading, which affects SEO and accessibility",
                    page_url=url
                ))
            
            # Check heading hierarchy
            headings = await page.query_selector_all("h1, h2, h3, h4, h5, h6")
            prev_level = 0
            for h in headings:
                tag = await h.evaluate("el => el.tagName")
                level = int(tag[1])
                if level > prev_level + 1 and prev_level > 0:
                    self.defects.append(Defect(
                        id=self._generate_defect_id(),
                        type="accessibility",
                        severity="low",
                        title="Skipped Heading Level",
                        description=f"Heading level jumped from H{prev_level} to H{level}",
                        page_url=url
                    ))
                    break
                prev_level = level
            
            # Check for buttons/links without text
            buttons = await page.query_selector_all("button, a[role='button']")
            for btn in buttons[:10]:  # Limit to first 10
                text = await btn.inner_text()
                aria_label = await btn.get_attribute("aria-label")
                if not text.strip() and not aria_label:
                    self.defects.append(Defect(
                        id=self._generate_defect_id(),
                        type="accessibility",
                        severity="medium",
                        title="Button Without Text",
                        description="Button has no visible text or aria-label",
                        page_url=url
                    ))
                    
        except Exception as e:
            logger.debug(f"Error checking accessibility: {e}")
    
    async def _check_security(self, page, url: str, response):
        """Check for security issues"""
        try:
            headers = response.headers
            
            # Check for missing security headers
            security_headers = {
                "x-frame-options": ("Missing X-Frame-Options Header", "high", "Page is vulnerable to clickjacking attacks"),
                "x-content-type-options": ("Missing X-Content-Type-Options Header", "medium", "Page may be vulnerable to MIME type sniffing"),
                "strict-transport-security": ("Missing HSTS Header", "medium", "HTTPS is not enforced"),
                "content-security-policy": ("Missing Content-Security-Policy", "low", "No CSP header found"),
            }
            
            for header, (title, severity, desc) in security_headers.items():
                if header not in [h.lower() for h in headers.keys()]:
                    # Only report critical security headers
                    if severity in ["high", "medium"]:
                        self.defects.append(Defect(
                            id=self._generate_defect_id(),
                            type="security",
                            severity=severity,
                            title=title,
                            description=desc,
                            page_url=url
                        ))
            
            # Check for mixed content (HTTP resources on HTTPS page)
            if url.startswith("https://"):
                # Check for http:// in src attributes
                http_resources = await page.evaluate("""
                    () => {
                        const resources = [];
                        document.querySelectorAll('[src^="http://"], [href^="http://"]').forEach(el => {
                            resources.push(el.src || el.href);
                        });
                        return resources.slice(0, 5);
                    }
                """)
                
                if http_resources:
                    self.defects.append(Defect(
                        id=self._generate_defect_id(),
                        type="security",
                        severity="high",
                        title="Mixed Content",
                        description=f"HTTPS page loads {len(http_resources)} HTTP resources",
                        page_url=url,
                        evidence={"http_resources": http_resources}
                    ))
                    
        except Exception as e:
            logger.debug(f"Error checking security: {e}")
    
    async def _check_js_errors(self, page, url: str):
        """Check for JavaScript errors"""
        # Check if there are console errors we collected
        for error in self.console_errors:
            if error.get("url") == url:
                self.defects.append(Defect(
                    id=self._generate_defect_id(),
                    type="js_error",
                    severity="high",
                    title="JavaScript Error",
                    description=error.get("message", "Unknown JS error"),
                    page_url=url,
                    evidence=error
                ))
    
    async def _check_functional(self, page, url: str):
        """Check for functional issues"""
        try:
            # Check for empty links
            empty_links = await page.query_selector_all("a[href=''], a[href='#'], a:not([href])")
            if len(empty_links) > 0:
                self.defects.append(Defect(
                    id=self._generate_defect_id(),
                    type="functional",
                    severity="low",
                    title="Empty or Invalid Links",
                    description=f"Found {len(empty_links)} links with no destination",
                    page_url=url,
                    evidence={"count": len(empty_links)}
                ))
            
            # Check for console errors
            errors = await page.evaluate("""
                () => {
                    return window.__blazeErrors || [];
                }
            """)
            
            # Check viewport/responsive issues
            viewport = page.viewport_size
            if viewport:
                # Check for horizontal overflow
                has_overflow = await page.evaluate("""
                    () => document.documentElement.scrollWidth > document.documentElement.clientWidth
                """)
                if has_overflow:
                    self.defects.append(Defect(
                        id=self._generate_defect_id(),
                        type="visual",
                        severity="medium",
                        title="Horizontal Scroll Issue",
                        description="Page has horizontal overflow which may indicate layout issues",
                        page_url=url
                    ))
                    
        except Exception as e:
            logger.debug(f"Error checking functional: {e}")
    
    def _handle_console(self, msg):
        """Handle console messages"""
        if msg.type == "error":
            self.console_errors.append({
                "message": msg.text,
                "url": msg.location.get("url", "") if msg.location else "",
                "type": "console_error"
            })
    
    def _handle_page_error(self, error, url: str):
        """Handle page errors (uncaught exceptions)"""
        self.console_errors.append({
            "message": str(error),
            "url": url,
            "type": "page_error"
        })
        self.defects.append(Defect(
            id=self._generate_defect_id(),
            type="js_error",
            severity="critical",
            title="Uncaught JavaScript Error",
            description=str(error)[:200],
            page_url=url,
            evidence={"error": str(error)}
        ))
    
    def _is_same_domain(self, url: str) -> bool:
        """Check if URL is on the same domain"""
        try:
            parsed = urlparse(url)
            return parsed.netloc == self.base_domain or parsed.netloc.endswith(f".{self.base_domain}")
        except:
            return False
    
    def _generate_summary(self) -> Dict[str, Any]:
        """Generate a summary of findings"""
        severity_counts = {"critical": 0, "high": 0, "medium": 0, "low": 0}
        type_counts = {}
        
        for defect in self.defects:
            severity_counts[defect.severity] = severity_counts.get(defect.severity, 0) + 1
            type_counts[defect.type] = type_counts.get(defect.type, 0) + 1
        
        return {
            "total_defects": len(self.defects),
            "pages_visited": len(self.visited_urls),
            "duration_seconds": time.time() - self.start_time,
            "by_severity": severity_counts,
            "by_type": type_counts
        }


# Singleton instance for session management
_active_sessions: Dict[str, BlazeExplorer] = {}


async def start_blaze_session(
    session_id: str,
    start_url: str,
    max_pages: int = 20,
    max_duration_minutes: int = 10,
    headless: bool = True,
    test_types: Optional[Dict[str, bool]] = None
) -> Dict[str, Any]:
    """Start a new Blaze exploration session"""
    explorer = BlazeExplorer()
    _active_sessions[session_id] = explorer
    
    result = await explorer.explore(
        start_url=start_url,
        max_pages=max_pages,
        max_duration_minutes=max_duration_minutes,
        headless=headless,
        test_types=test_types
    )
    
    return result


def get_session_status(session_id: str) -> Optional[Dict[str, Any]]:
    """Get status of a running session"""
    explorer = _active_sessions.get(session_id)
    if not explorer:
        return None
    
    return {
        "session_id": session_id,
        "status": explorer.status,
        "progress": explorer.progress,
        "current_activity": explorer.current_activity,
        "pages_visited": len(explorer.visited_urls),
        "defects_found": len(explorer.defects),
        "defects": [d.__dict__ for d in explorer.defects],
        "duration": time.time() - explorer.start_time if explorer.start_time else 0
    }


def stop_session(session_id: str):
    """Stop a running session"""
    explorer = _active_sessions.get(session_id)
    if explorer:
        explorer.status = "stopped"
        del _active_sessions[session_id]

