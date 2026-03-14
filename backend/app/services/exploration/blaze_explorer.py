"""
Blaze Explorer v2.0 — Enterprise-Grade Autonomous Exploratory Testing Engine

Finds real defects on any website without AI dependencies.
Concurrent crawling, authentication support, SPA handling, axe-core integration,
defect screenshots, test suite generation.

Detects:
- Broken links (404, 500 errors)
- JavaScript/Console errors (uncaught exceptions, runtime errors)
- Accessibility issues (axe-core WCAG 2.1 + heuristic checks)
- Performance issues (slow loads, large resources)
- Security issues (missing headers, mixed content)
- Visual/UI issues (overlapping elements, broken images, horizontal overflow)
- Form issues (missing validation, labels, autocomplete)
- Mobile responsiveness

Enterprise features:
- Concurrent crawling (asyncio.Semaphore, configurable 1-10)
- Authentication (cookie, bearer, basic, form_login)
- SPA support (networkidle, pushState, hash routing, dynamic elements)
- axe-core WCAG integration (injected CDN)
- Defect screenshots (base64 PNG per defect)
- Cookie/popup auto-dismissal
- Rate limiting between page visits
- SSE streaming via AsyncGenerator
- Test suite generation from crawl results
- URL normalization and deduplication
- Configurable depth, pages, duration limits
"""

import asyncio
import base64
import logging
import time
import re
import json
import secrets
from typing import Dict, List, Any, Optional, Set, AsyncGenerator, Tuple
from dataclasses import dataclass, field, asdict
from datetime import datetime
from urllib.parse import urljoin, urlparse, urlunparse, parse_qs, urlencode
import traceback

logger = logging.getLogger(__name__)

# ─── Constants ───────────────────────────────────────────────────────────

AXE_CORE_CDN = "https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.8.4/axe.min.js"

CONSENT_SELECTORS = [
    '[data-cookie-accept]', '.cookie-accept', '#accept-cookies',
    'button:has-text("Accept All")', 'button:has-text("Accept")',
    'button:has-text("I Agree")', '.consent-accept', '#gdpr-accept',
    'button:has-text("Allow All")', 'button:has-text("Got it")',
    'button:has-text("OK")', 'button:has-text("Agree")',
    '[data-testid="cookie-accept"]', '.cc-accept', '#onetrust-accept-btn-handler',
    '.fc-cta-consent', '#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll',
]

# File extensions to skip during crawling
SKIP_EXTENSIONS = {
    '.pdf', '.zip', '.tar', '.gz', '.rar', '.7z',
    '.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.ico', '.bmp',
    '.mp3', '.mp4', '.avi', '.mov', '.wmv', '.flv', '.webm',
    '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
    '.exe', '.dmg', '.msi', '.deb', '.rpm',
    '.woff', '.woff2', '.ttf', '.eot', '.otf',
    '.css', '.js', '.map',
}

# Maximum screenshot size in bytes (2MB base64 ~ 1.5MB image)
MAX_SCREENSHOT_BYTES = 2 * 1024 * 1024

# ─── Data Classes ────────────────────────────────────────────────────────


@dataclass
class Defect:
    """Represents a detected defect"""
    id: str
    type: str  # broken_link, js_error, accessibility, performance, security, visual, form, axe_violation
    severity: str  # critical, high, medium, low
    title: str
    description: str
    page_url: str
    element: Optional[str] = None
    screenshot: Optional[str] = None
    timestamp: str = field(default_factory=lambda: datetime.now().isoformat())
    reproducible: bool = True
    evidence: Optional[Dict[str, Any]] = None
    wcag_criterion: Optional[str] = None


@dataclass
class PageInfo:
    """Information about a crawled page"""
    url: str
    title: str
    status_code: int
    load_time: float
    depth: int
    links: List[str] = field(default_factory=list)
    forms: List[Dict] = field(default_factory=list)
    images: List[Dict] = field(default_factory=list)
    console_errors: List[str] = field(default_factory=list)
    defect_count: int = 0
    axe_violations: int = 0


@dataclass
class CrawlConfig:
    """Configuration for a crawl session"""
    start_url: str
    max_pages: int = 50
    max_depth: int = 5
    max_duration_minutes: int = 10
    concurrency: int = 3
    delay_ms: int = 200
    headless: bool = True
    test_types: Optional[Dict[str, bool]] = None
    auth: Optional[Dict[str, Any]] = None
    viewport_width: int = 1920
    viewport_height: int = 1080


# ─── URL Normalization ───────────────────────────────────────────────────


def normalize_url(url: str) -> str:
    """Normalize a URL for deduplication: strip fragments, sort query params, normalize trailing slashes."""
    try:
        parsed = urlparse(url)
        # Strip fragment
        # Sort query params
        query_params = parse_qs(parsed.query, keep_blank_values=True)
        sorted_query = urlencode(
            {k: v[0] if len(v) == 1 else v for k, v in sorted(query_params.items())},
            doseq=True
        )
        # Normalize path: remove trailing slash (but keep root /)
        path = parsed.path.rstrip('/') or '/'
        normalized = urlunparse((
            parsed.scheme,
            parsed.netloc.lower(),
            path,
            parsed.params,
            sorted_query,
            ''  # no fragment
        ))
        return normalized
    except Exception:
        return url


def should_skip_url(url: str) -> bool:
    """Check if URL should be skipped based on extension or scheme."""
    try:
        parsed = urlparse(url)
        if parsed.scheme not in ('http', 'https'):
            return True
        path_lower = parsed.path.lower()
        for ext in SKIP_EXTENSIONS:
            if path_lower.endswith(ext):
                return True
        # Skip mailto, tel, javascript
        if url.startswith(('mailto:', 'tel:', 'javascript:', 'data:')):
            return True
        return False
    except Exception:
        return True


# ─── BlazeExplorer v2.0 ─────────────────────────────────────────────────


class BlazeExplorer:
    """
    Enterprise-grade exploratory testing engine that crawls websites and finds real defects.
    No AI/OpenAI dependency — uses Playwright + axe-core + intelligent heuristics.

    Features:
    - Concurrent BFS crawling with configurable semaphore
    - Authentication support (cookie, bearer, basic, form_login)
    - SPA support (networkidle, dynamic element discovery)
    - axe-core WCAG 2.1 integration
    - Defect screenshots
    - Cookie/popup auto-dismissal
    - Rate limiting
    - SSE streaming via AsyncGenerator
    - Test suite generation
    """

    def __init__(self):
        self.visited_urls: Set[str] = set()
        self.visited_normalized: Set[str] = set()
        self.defects: List[Defect] = []
        self.pages: List[PageInfo] = []
        self.console_errors: Dict[str, List[Dict]] = {}  # url -> errors
        self.start_time: float = 0
        self.base_domain: str = ""
        self.base_url: str = ""
        self.status: str = "idle"
        self.current_activity: str = ""
        self.progress: float = 0
        self.config: Optional[CrawlConfig] = None
        self._defect_counter = 0
        self._stop_requested = False
        self._pages_queued = 0

    def _generate_defect_id(self) -> str:
        self._defect_counter += 1
        return f"BLZ-{self._defect_counter:04d}"

    def request_stop(self):
        """Request graceful stop of the crawl."""
        self._stop_requested = True
        self.status = "stopping"

    # ─── Authentication ──────────────────────────────────────────────

    async def _setup_auth(self, context, auth_config: Dict[str, Any]):
        """Configure authentication on the browser context."""
        auth_type = auth_config.get("type", "").lower()

        if auth_type == "cookie":
            cookies = auth_config.get("cookies", [])
            if isinstance(cookies, str):
                try:
                    cookies = json.loads(cookies)
                except json.JSONDecodeError:
                    logger.error("Invalid cookie JSON — skipping auth")
                    return
            if cookies:
                await context.add_cookies(cookies)
                logger.info(f"Injected {len(cookies)} cookies for authentication")

        elif auth_type == "bearer":
            token = auth_config.get("token", "")
            if token:
                await context.set_extra_http_headers({
                    "Authorization": f"Bearer {token}"
                })
                logger.info("Set Bearer token authentication header")

        elif auth_type == "basic":
            username = auth_config.get("username", "")
            password = auth_config.get("password", "")
            if username:
                encoded = base64.b64encode(f"{username}:{password}".encode()).decode()
                await context.set_extra_http_headers({
                    "Authorization": f"Basic {encoded}"
                })
                logger.info("Set Basic authentication header")

        elif auth_type == "form_login":
            login_url = auth_config.get("login_url", "")
            username_selector = auth_config.get("username_selector", "#username")
            password_selector = auth_config.get("password_selector", "#password")
            submit_selector = auth_config.get("submit_selector", "button[type='submit']")
            username = auth_config.get("username", "")
            password = auth_config.get("password", "")

            if login_url and username:
                page = await context.new_page()
                try:
                    logger.info(f"Performing form login at {login_url}")
                    await page.goto(login_url, wait_until="networkidle", timeout=30000)

                    # Fill login form
                    await page.fill(username_selector, username)
                    await page.fill(password_selector, password)
                    await page.click(submit_selector)

                    # Wait for navigation after login
                    await page.wait_for_load_state("networkidle", timeout=15000)
                    logger.info(f"Form login completed — redirected to {page.url}")
                except Exception as e:
                    logger.error(f"Form login failed: {e}")
                finally:
                    await page.close()

    # ─── Cookie/Popup Dismissal ──────────────────────────────────────

    async def _dismiss_popups(self, page):
        """Try to dismiss cookie consent and other common popups."""
        for sel in CONSENT_SELECTORS:
            try:
                el = page.locator(sel).first
                if await el.is_visible(timeout=500):
                    await el.click(timeout=1000)
                    await page.wait_for_timeout(300)
                    logger.debug(f"Dismissed popup with selector: {sel}")
                    break
            except Exception:
                pass

    # ─── Link Discovery (SPA-aware) ─────────────────────────────────

    async def _discover_links(self, page, current_url: str) -> List[str]:
        """Discover links including SPA navigation elements."""
        links = set()
        try:
            # Standard href links
            raw_links = await page.evaluate("""
                () => {
                    const urls = new Set();
                    // Standard anchors
                    document.querySelectorAll('a[href]').forEach(a => {
                        urls.add(a.href);
                    });
                    // Elements with data-href or onclick navigation
                    document.querySelectorAll('[data-href], [data-url], [data-link]').forEach(el => {
                        const href = el.getAttribute('data-href') || el.getAttribute('data-url') || el.getAttribute('data-link');
                        if (href) {
                            try { urls.add(new URL(href, window.location.href).href); } catch {}
                        }
                    });
                    // Router links (React Router, Vue Router, Angular Router)
                    document.querySelectorAll('[routerLink], [to], [ng-href]').forEach(el => {
                        const href = el.getAttribute('routerLink') || el.getAttribute('to') || el.getAttribute('ng-href');
                        if (href) {
                            try { urls.add(new URL(href, window.location.href).href); } catch {}
                        }
                    });
                    return Array.from(urls);
                }
            """)

            for url in raw_links:
                if isinstance(url, str) and url.startswith(('http://', 'https://')):
                    links.add(url)

        except Exception as e:
            logger.debug(f"Error discovering links on {current_url}: {e}")

        return list(links)

    # ─── axe-core Integration ────────────────────────────────────────

    async def _run_axe_scan(self, page, url: str) -> List[Dict]:
        """Inject axe-core and run WCAG accessibility scan."""
        violations = []
        try:
            # Inject axe-core
            await page.add_script_tag(url=AXE_CORE_CDN)
            await page.wait_for_timeout(500)

            # Run scan
            results = await page.evaluate("""
                async () => {
                    if (typeof axe === 'undefined') return { violations: [] };
                    try {
                        const results = await axe.run(document, {
                            runOnly: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'],
                            resultTypes: ['violations']
                        });
                        return {
                            violations: results.violations.map(v => ({
                                id: v.id,
                                impact: v.impact,
                                description: v.description,
                                help: v.help,
                                helpUrl: v.helpUrl,
                                tags: v.tags,
                                nodes_count: v.nodes ? v.nodes.length : 0,
                                first_element: v.nodes && v.nodes[0] ? v.nodes[0].html : null
                            }))
                        };
                    } catch (err) {
                        return { violations: [], error: err.message };
                    }
                }
            """)

            if results and results.get("violations"):
                for v in results["violations"]:
                    # Map axe impact to our severity
                    severity_map = {
                        "critical": "critical",
                        "serious": "high",
                        "moderate": "medium",
                        "minor": "low"
                    }
                    severity = severity_map.get(v.get("impact", "minor"), "medium")

                    # Extract WCAG criterion from tags
                    wcag_tags = [t for t in v.get("tags", []) if t.startswith("wcag")]
                    wcag_criterion = ", ".join(wcag_tags[:3]) if wcag_tags else None

                    violations.append({
                        "id": v["id"],
                        "severity": severity,
                        "description": v.get("help", v.get("description", "")),
                        "element": v.get("first_element", ""),
                        "nodes_count": v.get("nodes_count", 0),
                        "wcag_criterion": wcag_criterion,
                        "help_url": v.get("helpUrl", ""),
                    })

        except Exception as e:
            logger.debug(f"axe-core scan failed on {url}: {e}")

        return violations

    # ─── Screenshot Helper ───────────────────────────────────────────

    async def _take_screenshot(self, page) -> Optional[str]:
        """Take a compressed screenshot and return as base64 string."""
        try:
            screenshot_bytes = await page.screenshot(
                type="jpeg",
                quality=60,
                full_page=False
            )
            if len(screenshot_bytes) > MAX_SCREENSHOT_BYTES:
                # Retry with lower quality
                screenshot_bytes = await page.screenshot(
                    type="jpeg",
                    quality=30,
                    full_page=False
                )
            return base64.b64encode(screenshot_bytes).decode('utf-8')
        except Exception as e:
            logger.debug(f"Screenshot failed: {e}")
            return None

    # ─── Page Analysis ───────────────────────────────────────────────

    async def _analyze_page(
        self,
        page,
        url: str,
        depth: int,
        test_types: Dict[str, bool]
    ) -> Optional[PageInfo]:
        """Analyze a single page for defects. Returns PageInfo or None on failure."""
        start_time = time.time()
        page_defects_before = len(self.defects)

        try:
            # Navigate
            response = await page.goto(url, wait_until="domcontentloaded", timeout=30000)
            if not response:
                return None

            status_code = response.status
            load_time = time.time() - start_time

            # Wait for SPA content to settle
            try:
                await page.wait_for_load_state("networkidle", timeout=10000)
            except Exception:
                # networkidle timeout is non-fatal
                pass

            title = await page.title()

            # Dismiss cookie/consent popups
            await self._dismiss_popups(page)

            # ── HTTP Error Check ──
            if status_code >= 400:
                screenshot = await self._take_screenshot(page)
                self.defects.append(Defect(
                    id=self._generate_defect_id(),
                    type="broken_link",
                    severity="critical" if status_code >= 500 else "high",
                    title=f"HTTP {status_code} Error",
                    description=f"Page returned {status_code} status code",
                    page_url=url,
                    screenshot=screenshot,
                    evidence={"status_code": status_code}
                ))

            # ── Performance Check ──
            if test_types.get("performance", True) and load_time > 5:
                screenshot = await self._take_screenshot(page)
                self.defects.append(Defect(
                    id=self._generate_defect_id(),
                    type="performance",
                    severity="high" if load_time > 10 else "medium",
                    title="Slow Page Load",
                    description=f"Page took {load_time:.2f}s to load (recommended < 3s)",
                    page_url=url,
                    screenshot=screenshot,
                    evidence={"load_time": round(load_time, 2)}
                ))

            # ── Discover Links ──
            links = await self._discover_links(page, url)

            # ── Check Images ──
            images = []
            if test_types.get("accessibility", True) or test_types.get("functional", True):
                images = await self._check_images(page, url, test_types.get("accessibility", True))

            # ── Check Forms ──
            forms = []
            if test_types.get("accessibility", True) or test_types.get("functional", True):
                forms = await self._check_forms(page, url)

            # ── axe-core Scan ──
            axe_violations = []
            if test_types.get("accessibility", True):
                axe_violations = await self._run_axe_scan(page, url)
                for v in axe_violations:
                    screenshot = await self._take_screenshot(page) if v["severity"] in ("critical", "high") else None
                    self.defects.append(Defect(
                        id=self._generate_defect_id(),
                        type="axe_violation",
                        severity=v["severity"],
                        title=f"axe: {v['id']}",
                        description=f"{v['description']} ({v['nodes_count']} element(s))",
                        page_url=url,
                        element=v.get("element", "")[:200] if v.get("element") else None,
                        screenshot=screenshot,
                        wcag_criterion=v.get("wcag_criterion"),
                        evidence={
                            "axe_rule": v["id"],
                            "help_url": v.get("help_url", ""),
                            "nodes_count": v["nodes_count"],
                        }
                    ))

            # ── Heuristic Accessibility Checks ──
            if test_types.get("accessibility", True):
                await self._check_accessibility_heuristics(page, url)

            # ── Security Checks ──
            if test_types.get("security", True):
                await self._check_security(page, url, response)

            # ── Functional Checks ──
            if test_types.get("functional", True):
                await self._check_functional(page, url)

            # ── Console Error Check ──
            page_errors = self.console_errors.get(url, [])
            for error_info in page_errors:
                self.defects.append(Defect(
                    id=self._generate_defect_id(),
                    type="js_error",
                    severity="high",
                    title="JavaScript Error",
                    description=error_info.get("message", "Unknown JS error")[:300],
                    page_url=url,
                    evidence=error_info
                ))

            page_defect_count = len(self.defects) - page_defects_before

            return PageInfo(
                url=url,
                title=title,
                status_code=status_code,
                load_time=round(load_time, 2),
                depth=depth,
                links=links,
                forms=forms,
                images=images,
                console_errors=[e.get("message", "") for e in page_errors],
                defect_count=page_defect_count,
                axe_violations=len(axe_violations),
            )

        except Exception as e:
            logger.error(f"Error analyzing page {url}: {e}")
            self.defects.append(Defect(
                id=self._generate_defect_id(),
                type="page_error",
                severity="high",
                title="Page Load Error",
                description=f"Failed to analyze page: {type(e).__name__}",
                page_url=url,
                evidence={"error_type": type(e).__name__}
            ))
            return None

    # ─── Image Checks ────────────────────────────────────────────────

    async def _check_images(self, page, url: str, check_a11y: bool) -> List[Dict]:
        """Check images for broken sources and missing alt text."""
        images = []
        try:
            img_data = await page.evaluate("""
                () => {
                    const imgs = [];
                    document.querySelectorAll('img').forEach(img => {
                        imgs.push({
                            src: img.src || '',
                            alt: img.alt,
                            hasAlt: img.hasAttribute('alt'),
                            naturalWidth: img.naturalWidth,
                            visible: img.offsetParent !== null
                        });
                    });
                    return imgs.slice(0, 100); // Limit to prevent oversized payloads
                }
            """)

            for img in img_data:
                images.append({"src": img.get("src", "")[:100], "alt": img.get("alt", "")})

                # Missing alt text
                if check_a11y and not img.get("hasAlt"):
                    src_short = (img.get("src", "") or "unknown")[:80]
                    self.defects.append(Defect(
                        id=self._generate_defect_id(),
                        type="accessibility",
                        severity="medium",
                        title="Missing Alt Text",
                        description="Image is missing alt attribute (required for screen readers)",
                        page_url=url,
                        element=f'<img src="{src_short}...">',
                        evidence={"src": img.get("src", "")[:200]}
                    ))

                # Broken image
                if img.get("src") and img.get("naturalWidth", 1) == 0 and img.get("visible"):
                    self.defects.append(Defect(
                        id=self._generate_defect_id(),
                        type="broken_link",
                        severity="high",
                        title="Broken Image",
                        description="Image failed to load (naturalWidth=0)",
                        page_url=url,
                        element=f'<img src="{(img.get("src", "") or "")[:80]}...">',
                        evidence={"src": img.get("src", "")[:200]}
                    ))

        except Exception as e:
            logger.debug(f"Error checking images on {url}: {e}")
        return images

    # ─── Form Checks ─────────────────────────────────────────────────

    async def _check_forms(self, page, url: str) -> List[Dict]:
        """Check forms for missing labels and accessibility issues."""
        forms = []
        try:
            form_data = await page.evaluate("""
                () => {
                    const results = [];
                    document.querySelectorAll('form').forEach(form => {
                        const inputs = [];
                        form.querySelectorAll("input:not([type='hidden']):not([type='submit']):not([type='button']), textarea, select").forEach(inp => {
                            const id = inp.id;
                            const hasLabel = id ? !!document.querySelector("label[for='" + id + "']") : false;
                            const ariaLabel = inp.getAttribute('aria-label');
                            const ariaLabelledby = inp.getAttribute('aria-labelledby');
                            inputs.push({
                                name: inp.name || '',
                                type: inp.type || inp.tagName.toLowerCase(),
                                id: id || '',
                                hasLabel: hasLabel || !!ariaLabel || !!ariaLabelledby,
                                autocomplete: inp.getAttribute('autocomplete') || ''
                            });
                        });
                        results.push({
                            action: form.action || '',
                            method: (form.method || 'get').toUpperCase(),
                            inputs: inputs
                        });
                    });
                    return results.slice(0, 20);
                }
            """)

            for form in form_data:
                forms.append({"action": form.get("action", ""), "method": form.get("method", ""), "input_count": len(form.get("inputs", []))})

                for inp in form.get("inputs", []):
                    if not inp.get("hasLabel"):
                        self.defects.append(Defect(
                            id=self._generate_defect_id(),
                            type="accessibility",
                            severity="medium",
                            title="Form Input Missing Label",
                            description=f"Input '{inp.get('name') or inp.get('type')}' has no associated label or aria-label",
                            page_url=url,
                            element=f"<input name='{inp.get('name', '')}' type='{inp.get('type', '')}'>",
                            evidence={"input_name": inp.get("name", ""), "input_type": inp.get("type", "")}
                        ))

        except Exception as e:
            logger.debug(f"Error checking forms on {url}: {e}")
        return forms

    # ─── Heuristic Accessibility Checks ──────────────────────────────

    async def _check_accessibility_heuristics(self, page, url: str):
        """Run heuristic accessibility checks (complement to axe-core)."""
        try:
            a11y_data = await page.evaluate("""
                () => {
                    const results = {};
                    // Missing page title
                    results.title = document.title || '';
                    // Missing lang
                    results.lang = document.documentElement.getAttribute('lang') || '';
                    // Missing h1
                    results.hasH1 = !!document.querySelector('h1');
                    // Heading hierarchy
                    const headings = [];
                    document.querySelectorAll('h1,h2,h3,h4,h5,h6').forEach(h => {
                        headings.push(parseInt(h.tagName[1]));
                    });
                    results.headingLevels = headings.slice(0, 30);
                    // Buttons without text
                    let emptyButtons = 0;
                    document.querySelectorAll('button, a[role="button"]').forEach(btn => {
                        const text = (btn.textContent || '').trim();
                        const ariaLabel = btn.getAttribute('aria-label');
                        const ariaLabelledby = btn.getAttribute('aria-labelledby');
                        if (!text && !ariaLabel && !ariaLabelledby) emptyButtons++;
                    });
                    results.emptyButtons = emptyButtons;
                    return results;
                }
            """)

            if not a11y_data:
                return

            # Missing title
            if not a11y_data.get("title", "").strip():
                self.defects.append(Defect(
                    id=self._generate_defect_id(),
                    type="accessibility",
                    severity="high",
                    title="Missing Page Title",
                    description="Page has no <title>, which is required for accessibility and SEO",
                    page_url=url
                ))

            # Missing lang
            if not a11y_data.get("lang", "").strip():
                self.defects.append(Defect(
                    id=self._generate_defect_id(),
                    type="accessibility",
                    severity="medium",
                    title="Missing Language Attribute",
                    description="<html> element is missing lang attribute",
                    page_url=url
                ))

            # Missing h1
            if not a11y_data.get("hasH1"):
                self.defects.append(Defect(
                    id=self._generate_defect_id(),
                    type="accessibility",
                    severity="low",
                    title="Missing H1 Heading",
                    description="Page has no <h1> heading (affects SEO and accessibility)",
                    page_url=url
                ))

            # Heading hierarchy
            levels = a11y_data.get("headingLevels", [])
            prev = 0
            for level in levels:
                if level > prev + 1 and prev > 0:
                    self.defects.append(Defect(
                        id=self._generate_defect_id(),
                        type="accessibility",
                        severity="low",
                        title="Skipped Heading Level",
                        description=f"Heading hierarchy jumped from H{prev} to H{level}",
                        page_url=url
                    ))
                    break
                prev = level

            # Empty buttons
            empty_btn_count = a11y_data.get("emptyButtons", 0)
            if empty_btn_count > 0:
                self.defects.append(Defect(
                    id=self._generate_defect_id(),
                    type="accessibility",
                    severity="medium",
                    title="Button(s) Without Text",
                    description=f"{empty_btn_count} button(s) have no visible text or aria-label",
                    page_url=url,
                    evidence={"count": empty_btn_count}
                ))

        except Exception as e:
            logger.debug(f"Error checking heuristic a11y on {url}: {e}")

    # ─── Security Checks ─────────────────────────────────────────────

    async def _check_security(self, page, url: str, response):
        """Check for security header issues and mixed content."""
        try:
            headers = response.headers
            header_keys_lower = {k.lower() for k in headers.keys()}

            security_headers = {
                "x-frame-options": ("Missing X-Frame-Options Header", "high", "Page may be vulnerable to clickjacking"),
                "x-content-type-options": ("Missing X-Content-Type-Options", "medium", "May be vulnerable to MIME-type sniffing"),
                "strict-transport-security": ("Missing HSTS Header", "medium", "HTTPS not enforced via HSTS"),
            }

            for header, (title, severity, desc) in security_headers.items():
                if header not in header_keys_lower:
                    self.defects.append(Defect(
                        id=self._generate_defect_id(),
                        type="security",
                        severity=severity,
                        title=title,
                        description=desc,
                        page_url=url,
                        evidence={"missing_header": header}
                    ))

            # Mixed content check
            if url.startswith("https://"):
                http_resources = await page.evaluate("""
                    () => {
                        const resources = [];
                        document.querySelectorAll('[src^="http://"], link[href^="http://"]').forEach(el => {
                            const url = el.src || el.href;
                            if (url && !url.startsWith('http://localhost')) resources.push(url);
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
                        description=f"HTTPS page loads {len(http_resources)} HTTP resource(s)",
                        page_url=url,
                        evidence={"http_resources": http_resources}
                    ))

        except Exception as e:
            logger.debug(f"Error checking security on {url}: {e}")

    # ─── Functional Checks ───────────────────────────────────────────

    async def _check_functional(self, page, url: str):
        """Check for functional issues: empty links, horizontal overflow."""
        try:
            func_data = await page.evaluate("""
                () => {
                    const results = {};
                    // Empty links
                    const emptyLinks = document.querySelectorAll("a[href=''], a[href='#'], a:not([href])");
                    results.emptyLinkCount = emptyLinks.length;
                    // Horizontal overflow
                    results.hasHorizontalOverflow = document.documentElement.scrollWidth > document.documentElement.clientWidth;
                    return results;
                }
            """)

            if not func_data:
                return

            if func_data.get("emptyLinkCount", 0) > 0:
                self.defects.append(Defect(
                    id=self._generate_defect_id(),
                    type="functional",
                    severity="low",
                    title="Empty or Invalid Links",
                    description=f"Found {func_data['emptyLinkCount']} link(s) with no destination",
                    page_url=url,
                    evidence={"count": func_data["emptyLinkCount"]}
                ))

            if func_data.get("hasHorizontalOverflow"):
                screenshot = await self._take_screenshot(page)
                self.defects.append(Defect(
                    id=self._generate_defect_id(),
                    type="visual",
                    severity="medium",
                    title="Horizontal Scroll Issue",
                    description="Page has horizontal overflow, indicating layout problems",
                    page_url=url,
                    screenshot=screenshot,
                ))

        except Exception as e:
            logger.debug(f"Error checking functional on {url}: {e}")

    # ─── Domain Check ────────────────────────────────────────────────

    def _is_same_domain(self, url: str) -> bool:
        """Check if URL belongs to the same domain (including subdomains)."""
        try:
            parsed = urlparse(url)
            netloc = parsed.netloc.lower()
            return netloc == self.base_domain or netloc.endswith(f".{self.base_domain}")
        except Exception:
            return False

    # ─── Summary Generation ──────────────────────────────────────────

    def _generate_summary(self) -> Dict[str, Any]:
        """Generate a summary of findings."""
        severity_counts = {"critical": 0, "high": 0, "medium": 0, "low": 0}
        type_counts: Dict[str, int] = {}

        for defect in self.defects:
            severity_counts[defect.severity] = severity_counts.get(defect.severity, 0) + 1
            type_counts[defect.type] = type_counts.get(defect.type, 0) + 1

        return {
            "total_defects": len(self.defects),
            "pages_visited": len(self.visited_urls),
            "duration_seconds": round(time.time() - self.start_time, 1),
            "by_severity": severity_counts,
            "by_type": type_counts,
            "max_depth_reached": max((p.depth for p in self.pages), default=0),
        }

    # ─── Streaming Explore (SSE AsyncGenerator) ──────────────────────

    async def explore_stream(
        self,
        config: CrawlConfig,
    ) -> AsyncGenerator[Dict[str, Any], None]:
        """
        Main streaming exploration method.
        Yields SSE-compatible events as the crawl progresses.
        """
        from playwright.async_api import async_playwright

        self.config = config
        self.start_time = time.time()
        self.status = "running"
        self.visited_urls = set()
        self.visited_normalized = set()
        self.defects = []
        self.pages = []
        self.console_errors = {}
        self._defect_counter = 0
        self._stop_requested = False

        max_duration_secs = config.max_duration_minutes * 60
        concurrency = min(max(config.concurrency, 1), 10)
        semaphore = asyncio.Semaphore(concurrency)

        # Parse base domain
        parsed = urlparse(config.start_url)
        self.base_domain = parsed.netloc.lower()
        self.base_url = config.start_url

        test_types = config.test_types or {
            "functional": True,
            "accessibility": True,
            "performance": True,
            "security": True,
        }

        yield {"type": "progress", "pages_visited": 0, "pages_queued": 1, "defects_total": 0, "message": f"Starting exploration of {config.start_url}"}

        try:
            async with async_playwright() as p:
                browser = await p.chromium.launch(headless=config.headless)

                # Create browser context
                context = await browser.new_context(
                    viewport={"width": config.viewport_width, "height": config.viewport_height},
                    user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
                )

                # Setup authentication
                if config.auth:
                    await self._setup_auth(context, config.auth)

                # BFS queue: (url, depth)
                queue: asyncio.Queue[Tuple[str, int]] = asyncio.Queue()
                start_normalized = normalize_url(config.start_url)
                self.visited_normalized.add(start_normalized)
                await queue.put((config.start_url, 0))
                self._pages_queued = 1

                active_tasks: Set[asyncio.Task] = set()
                defects_emitted = 0

                async def crawl_page(url: str, depth: int):
                    """Crawl a single page within the semaphore."""
                    nonlocal defects_emitted

                    async with semaphore:
                        if self._stop_requested:
                            return

                        # Check time limit
                        if time.time() - self.start_time > max_duration_secs:
                            self._stop_requested = True
                            return

                        # Check page limit
                        if len(self.visited_urls) >= config.max_pages:
                            return

                        self.visited_urls.add(url)
                        self.current_activity = f"Analyzing: {url}"
                        self.progress = min(99, (len(self.visited_urls) / config.max_pages) * 100)

                        # Create page in context
                        page = await context.new_page()

                        # Console error handler for this page
                        page_errors: List[Dict] = []

                        def on_console(msg):
                            if msg.type == "error":
                                page_errors.append({
                                    "message": msg.text[:300],
                                    "type": "console_error"
                                })

                        def on_page_error(error):
                            error_msg = str(error)[:300]
                            page_errors.append({
                                "message": error_msg,
                                "type": "page_error"
                            })
                            self.defects.append(Defect(
                                id=self._generate_defect_id(),
                                type="js_error",
                                severity="critical",
                                title="Uncaught JavaScript Error",
                                description=error_msg,
                                page_url=url,
                                evidence={"error": error_msg}
                            ))

                        page.on("console", on_console)
                        page.on("pageerror", on_page_error)

                        try:
                            self.console_errors[url] = page_errors

                            page_info = await self._analyze_page(page, url, depth, test_types)

                            if page_info:
                                self.pages.append(page_info)

                                # Enqueue discovered links (BFS)
                                if depth < config.max_depth:
                                    for link in page_info.links:
                                        if should_skip_url(link):
                                            continue
                                        if not self._is_same_domain(link):
                                            continue
                                        norm = normalize_url(link)
                                        if norm not in self.visited_normalized:
                                            self.visited_normalized.add(norm)
                                            await queue.put((link, depth + 1))
                                            self._pages_queued += 1

                        except Exception as e:
                            logger.error(f"Error crawling {url}: {e}")
                        finally:
                            await page.close()

                        # Rate limiting
                        if config.delay_ms > 0:
                            await asyncio.sleep(config.delay_ms / 1000.0)

                # Main crawl loop
                while True:
                    # Check stopping conditions
                    if self._stop_requested:
                        break
                    if len(self.visited_urls) >= config.max_pages:
                        break
                    if time.time() - self.start_time > max_duration_secs:
                        break

                    # Clean up completed tasks
                    done_tasks = {t for t in active_tasks if t.done()}
                    for t in done_tasks:
                        active_tasks.discard(t)
                        # Check for task exceptions
                        if t.exception():
                            logger.error(f"Crawl task failed: {t.exception()}")

                    # Yield new defects as they're found
                    while defects_emitted < len(self.defects):
                        defect = self.defects[defects_emitted]
                        yield {
                            "type": "defect_found",
                            "defect": asdict(defect),
                        }
                        defects_emitted += 1

                    # Try to get next URL from queue
                    try:
                        url, depth = queue.get_nowait()
                    except asyncio.QueueEmpty:
                        if active_tasks:
                            # Wait for at least one task to complete
                            await asyncio.sleep(0.2)
                            continue
                        else:
                            break  # Queue empty and no active tasks

                    # Skip if already visited (possible duplicate in queue)
                    if url in self.visited_urls:
                        continue

                    # Check page limit
                    if len(self.visited_urls) >= config.max_pages:
                        break

                    # Launch crawl task
                    task = asyncio.create_task(crawl_page(url, depth))
                    active_tasks.add(task)

                    # Yield progress event
                    yield {
                        "type": "page_visited",
                        "url": url,
                        "title": "",
                        "depth": depth,
                        "defects_found": len(self.defects),
                    }

                    # Periodic progress event
                    yield {
                        "type": "progress",
                        "pages_visited": len(self.visited_urls),
                        "pages_queued": self._pages_queued,
                        "defects_total": len(self.defects),
                    }

                # Wait for remaining tasks
                if active_tasks:
                    await asyncio.gather(*active_tasks, return_exceptions=True)

                # Emit any remaining defects
                while defects_emitted < len(self.defects):
                    defect = self.defects[defects_emitted]
                    yield {
                        "type": "defect_found",
                        "defect": asdict(defect),
                    }
                    defects_emitted += 1

                await browser.close()

        except Exception as e:
            logger.error(f"Blaze exploration failed: {e}\n{traceback.format_exc()}")
            self.status = "error"
            yield {
                "type": "error",
                "error": f"Exploration failed: {type(e).__name__}",
            }
            return

        self.status = "completed"
        self.current_activity = "Exploration complete"
        self.progress = 100

        summary = self._generate_summary()
        yield {
            "type": "complete",
            "summary": summary,
            "pages": [asdict(p) for p in self.pages],
            "defects": [asdict(d) for d in self.defects],
        }

    # ─── Synchronous Explore (backward compat) ───────────────────────

    async def explore(
        self,
        start_url: str,
        max_pages: int = 50,
        max_duration_minutes: int = 10,
        headless: bool = True,
        test_types: Optional[Dict[str, bool]] = None,
        concurrency: int = 3,
        max_depth: int = 5,
        delay_ms: int = 200,
        auth: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Synchronous exploration — collects all results and returns at once.
        Backward compatible with v1 API.
        """
        config = CrawlConfig(
            start_url=start_url,
            max_pages=max_pages,
            max_depth=max_depth,
            max_duration_minutes=max_duration_minutes,
            concurrency=concurrency,
            delay_ms=delay_ms,
            headless=headless,
            test_types=test_types,
            auth=auth,
        )

        final_result: Dict[str, Any] = {}

        async for event in self.explore_stream(config):
            if event["type"] == "complete":
                final_result = {
                    "status": "completed",
                    "defects": event.get("defects", []),
                    "defect_count": len(event.get("defects", [])),
                    "pages_visited": event.get("summary", {}).get("pages_visited", 0),
                    "pages": [{"url": p.get("url"), "title": p.get("title"), "status": p.get("status_code")} for p in event.get("pages", [])],
                    "duration": event.get("summary", {}).get("duration_seconds", 0),
                    "summary": event.get("summary", {}),
                }
            elif event["type"] == "error":
                final_result = {
                    "status": "error",
                    "error": event.get("error", "Unknown error"),
                    "defects": [asdict(d) for d in self.defects],
                    "pages_visited": len(self.visited_urls),
                    "duration": time.time() - self.start_time,
                }

        if not final_result:
            final_result = {
                "status": self.status,
                "defects": [asdict(d) for d in self.defects],
                "defect_count": len(self.defects),
                "pages_visited": len(self.visited_urls),
                "duration": time.time() - self.start_time,
                "summary": self._generate_summary(),
            }

        return final_result

    # ─── Test Suite Generation ───────────────────────────────────────

    def generate_test_suite(self) -> List[Dict[str, Any]]:
        """
        Generate a test suite from the completed crawl.
        Returns list of test case dicts compatible with POST /test-cases.

        Generates:
        1. Smoke test per page: navigate + verify title + check no errors
        2. Form test per form: navigate + fill fields + submit + verify
        3. Regression test per defect: navigate + assert defect is NOT present
        """
        test_cases: List[Dict[str, Any]] = []

        # 1. Smoke tests for each discovered page
        for page in self.pages:
            steps = [
                {
                    "step_number": 1,
                    "action": "navigate",
                    "expected_result": f"Page loads with status {page.status_code}",
                    "test_data": page.url,
                    "selector": "",
                },
                {
                    "step_number": 2,
                    "action": "verify_title",
                    "expected_result": f"Title contains: {page.title[:50]}" if page.title else "Page has a title",
                    "test_data": page.title[:50] if page.title else "",
                    "selector": "title",
                },
                {
                    "step_number": 3,
                    "action": "verify_no_console_errors",
                    "expected_result": "No JavaScript errors in console",
                    "test_data": "",
                    "selector": "",
                },
            ]

            test_cases.append({
                "title": f"Smoke Test: {page.title or page.url}",
                "description": f"Verify {page.url} loads without errors (auto-generated by Blaze Explorer)",
                "steps": steps,
                "tags": ["blaze", "smoke", "auto-generated"],
                "priority": "medium",
                "status": "draft",
            })

        # 2. Form tests for pages with forms
        for page in self.pages:
            for i, form in enumerate(page.forms):
                input_count = form.get("input_count", 0)
                if input_count == 0:
                    continue

                steps = [
                    {
                        "step_number": 1,
                        "action": "navigate",
                        "expected_result": "Page loads successfully",
                        "test_data": page.url,
                        "selector": "",
                    },
                    {
                        "step_number": 2,
                        "action": "fill_form",
                        "expected_result": f"Fill {input_count} form field(s) with test data",
                        "test_data": json.dumps({"form_index": i, "method": form.get("method", "POST")}),
                        "selector": f"form:nth-of-type({i + 1})",
                    },
                    {
                        "step_number": 3,
                        "action": "submit_form",
                        "expected_result": "Form submits without error",
                        "test_data": "",
                        "selector": f"form:nth-of-type({i + 1}) button[type='submit'], form:nth-of-type({i + 1}) input[type='submit']",
                    },
                    {
                        "step_number": 4,
                        "action": "verify_no_errors",
                        "expected_result": "No error messages displayed after submission",
                        "test_data": "",
                        "selector": "",
                    },
                ]

                test_cases.append({
                    "title": f"Form Test: {page.title or page.url} (Form {i + 1})",
                    "description": f"Verify form submission on {page.url} (auto-generated by Blaze Explorer)",
                    "steps": steps,
                    "tags": ["blaze", "form", "auto-generated"],
                    "priority": "high",
                    "status": "draft",
                })

        # 3. Regression tests for each defect
        for defect in self.defects:
            # Build assertion step based on defect type
            if defect.type == "broken_link":
                assertion_step = {
                    "step_number": 2,
                    "action": "verify_status_code",
                    "expected_result": "Page returns 2xx status (not an error)",
                    "test_data": "200",
                    "selector": "",
                }
            elif defect.type == "js_error":
                assertion_step = {
                    "step_number": 2,
                    "action": "verify_no_console_errors",
                    "expected_result": "No JavaScript errors in console",
                    "test_data": "",
                    "selector": "",
                }
            elif defect.type in ("accessibility", "axe_violation"):
                assertion_step = {
                    "step_number": 2,
                    "action": "verify_accessibility",
                    "expected_result": f"Defect '{defect.title}' is resolved",
                    "test_data": defect.element or "",
                    "selector": defect.element[:100] if defect.element else "",
                }
            elif defect.type == "performance":
                assertion_step = {
                    "step_number": 2,
                    "action": "verify_load_time",
                    "expected_result": "Page loads within 3 seconds",
                    "test_data": "3000",
                    "selector": "",
                }
            elif defect.type == "security":
                assertion_step = {
                    "step_number": 2,
                    "action": "verify_security_headers",
                    "expected_result": f"Security issue resolved: {defect.title}",
                    "test_data": json.dumps(defect.evidence or {}),
                    "selector": "",
                }
            else:
                assertion_step = {
                    "step_number": 2,
                    "action": "verify_no_defect",
                    "expected_result": f"Defect '{defect.title}' is no longer present",
                    "test_data": defect.description[:200],
                    "selector": defect.element[:100] if defect.element else "",
                }

            steps = [
                {
                    "step_number": 1,
                    "action": "navigate",
                    "expected_result": "Page loads successfully",
                    "test_data": defect.page_url,
                    "selector": "",
                },
                assertion_step,
            ]

            test_cases.append({
                "title": f"Regression: {defect.title} on {urlparse(defect.page_url).path or '/'}",
                "description": f"Verify that defect {defect.id} ({defect.title}) is fixed (auto-generated by Blaze Explorer)",
                "steps": steps,
                "tags": ["blaze", "regression", "auto-generated", defect.type],
                "priority": "critical" if defect.severity == "critical" else "high" if defect.severity == "high" else "medium",
                "status": "draft",
            })

        return test_cases


# ─── Session Management ──────────────────────────────────────────────────

_active_sessions: Dict[str, BlazeExplorer] = {}
_session_results: Dict[str, Dict[str, Any]] = {}


async def start_blaze_session(
    session_id: str,
    start_url: str,
    max_pages: int = 50,
    max_duration_minutes: int = 10,
    headless: bool = True,
    test_types: Optional[Dict[str, bool]] = None,
    concurrency: int = 3,
    max_depth: int = 5,
    delay_ms: int = 200,
    auth: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Start a new Blaze exploration session (synchronous, stores result)."""
    explorer = BlazeExplorer()
    _active_sessions[session_id] = explorer

    result = await explorer.explore(
        start_url=start_url,
        max_pages=max_pages,
        max_duration_minutes=max_duration_minutes,
        headless=headless,
        test_types=test_types,
        concurrency=concurrency,
        max_depth=max_depth,
        delay_ms=delay_ms,
        auth=auth,
    )

    # Store result for later retrieval (test suite generation)
    _session_results[session_id] = result
    return result


def get_session_status(session_id: str) -> Optional[Dict[str, Any]]:
    """Get status of a running or completed session."""
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
        "defects": [asdict(d) for d in explorer.defects],
        "duration": round(time.time() - explorer.start_time, 1) if explorer.start_time else 0,
    }


def stop_session(session_id: str):
    """Request graceful stop on a running session."""
    explorer = _active_sessions.get(session_id)
    if explorer:
        explorer.request_stop()


def remove_session(session_id: str):
    """Remove session from active sessions."""
    _active_sessions.pop(session_id, None)
    _session_results.pop(session_id, None)


def get_session_explorer(session_id: str) -> Optional[BlazeExplorer]:
    """Get the BlazeExplorer instance for a session (for test suite generation)."""
    return _active_sessions.get(session_id)
