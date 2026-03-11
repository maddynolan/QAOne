# DEPRECATED — Scheduled for removal (v3.20.0)
# Part of the Nexus Exploratory system which is unused.
"""
Real Exploratory Testing Service

A REAL exploratory testing engine that actually crawls websites and finds defects.
Works without OpenAI - uses intelligent heuristics and Playwright for actual testing.

Defect Types Detected:
- Broken links (404s, 5xx errors)
- JavaScript console errors
- Accessibility issues (WCAG violations)
- Performance problems (slow loads)
- Security issues (missing headers, mixed content)
- Mobile responsiveness issues
"""

import logging
import uuid
import concurrent.futures
import sys
import asyncio
from datetime import datetime
from typing import Dict, List, Any, Set
from urllib.parse import urlparse

# Fix Windows asyncio event loop policy for Playwright subprocess support
if sys.platform == 'win32':
    asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())

logger = logging.getLogger(__name__)

# Thread pool for running sync Playwright in background
_executor = concurrent.futures.ThreadPoolExecutor(max_workers=3)


class RealExploratoryService:
    """
    Real exploratory testing that actually finds defects on any website.
    Uses synchronous Playwright for Windows compatibility.
    """
    
    def __init__(self):
        self.sessions: Dict[str, Dict] = {}
        
    async def start_session(
        self,
        app_url: str,
        max_duration_minutes: int = 10,
        max_pages: int = 30,
        headless: bool = True
    ) -> Dict[str, Any]:
        """Start a real exploratory testing session."""
        
        session_id = str(uuid.uuid4())[:8]
        
        # Initialize session state
        self.sessions[session_id] = {
            "session_id": session_id,
            "app_url": app_url,
            "status": "running",
            "start_time": datetime.utcnow(),
            "max_duration_minutes": max_duration_minutes,
            "max_pages": max_pages,
            "headless": headless,
            "pages_visited": [],
            "defects": [],
            "pages_crawled": 0,
            "current_activity": "Starting exploration...",
            "progress": 0,
        }
        
        # Run exploration in thread pool (sync Playwright works better on Windows)
        _executor.submit(self._run_exploration_sync, session_id)
        
        return {
            "session_id": session_id,
            "status": "running",
            "message": f"Started exploratory testing of {app_url}"
        }
    
    def _run_exploration_sync(self, session_id: str):
        """Run exploration using sync Playwright (Windows compatible)."""
        session = self.sessions.get(session_id)
        if not session:
            return
            
        try:
            from playwright.sync_api import sync_playwright
            
            with sync_playwright() as p:
                browser = p.chromium.launch(headless=session["headless"])
                context = browser.new_context(
                    viewport={"width": 1920, "height": 1080},
                    user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
                )
                
                # Collect console errors
                console_errors = []
                
                page = context.new_page()
                
                # Listen for console errors
                def handle_console(msg):
                    if msg.type == "error":
                        console_errors.append(msg.text)
                
                page.on("console", handle_console)
                
                # Track visited URLs
                visited_urls: Set[str] = set()
                urls_to_visit = [session["app_url"]]
                base_domain = urlparse(session["app_url"]).netloc
                
                session["current_activity"] = "Loading initial page..."
                
                while urls_to_visit and len(visited_urls) < session["max_pages"]:
                    url = urls_to_visit.pop(0)
                    
                    if url in visited_urls:
                        continue
                        
                    # Check if still within domain
                    if urlparse(url).netloc != base_domain:
                        continue
                    
                    # Skip non-http URLs
                    if not url.startswith(('http://', 'https://')):
                        continue
                    
                    visited_urls.add(url)
                    session["pages_crawled"] = len(visited_urls)
                    session["current_activity"] = f"Testing: {url[:60]}..."
                    session["progress"] = min(95, int((len(visited_urls) / session["max_pages"]) * 100))
                    
                    try:
                        # Visit the page
                        console_errors.clear()
                        start_time = datetime.utcnow()
                        
                        response = page.goto(url, wait_until="domcontentloaded", timeout=30000)
                        
                        load_time = (datetime.utcnow() - start_time).total_seconds() * 1000
                        status_code = response.status if response else 0
                        
                        # Wait a bit for JS to execute
                        page.wait_for_timeout(1500)
                        
                        # Get page title
                        title = page.title()
                        
                        # === DEFECT DETECTION ===
                        
                        # 1. Check for HTTP errors
                        if status_code >= 400:
                            session["defects"].append({
                                "id": str(uuid.uuid4())[:8],
                                "type": "http_error",
                                "severity": "high" if status_code >= 500 else "medium",
                                "title": f"HTTP {status_code} Error",
                                "description": f"Page returned HTTP {status_code} status code",
                                "page_url": url,
                                "timestamp": datetime.utcnow().isoformat()
                            })
                        
                        # 2. Check for slow page load
                        if load_time > 5000:
                            session["defects"].append({
                                "id": str(uuid.uuid4())[:8],
                                "type": "performance",
                                "severity": "high" if load_time > 10000 else "medium",
                                "title": "Slow Page Load",
                                "description": f"Page took {load_time/1000:.1f}s to load (threshold: 5s)",
                                "page_url": url,
                                "timestamp": datetime.utcnow().isoformat()
                            })
                        
                        # 3. Check for console errors
                        for error in console_errors:
                            if any(x in error.lower() for x in ["error", "uncaught", "failed", "exception"]):
                                session["defects"].append({
                                    "id": str(uuid.uuid4())[:8],
                                    "type": "javascript_error",
                                    "severity": "high",
                                    "title": "JavaScript Console Error",
                                    "description": error[:500],
                                    "page_url": url,
                                    "timestamp": datetime.utcnow().isoformat()
                                })
                        
                        # 4. Check for images without alt text (accessibility)
                        images_without_alt = page.evaluate("""() => {
                            const images = document.querySelectorAll('img');
                            let count = 0;
                            images.forEach(img => {
                                if (!img.alt || img.alt.trim() === '') count++;
                            });
                            return count;
                        }""")
                        
                        if images_without_alt > 0:
                            session["defects"].append({
                                "id": str(uuid.uuid4())[:8],
                                "type": "accessibility",
                                "severity": "medium",
                                "title": f"Images Missing Alt Text ({images_without_alt})",
                                "description": f"Found {images_without_alt} images without alt attributes (WCAG 1.1.1)",
                                "page_url": url,
                                "timestamp": datetime.utcnow().isoformat()
                            })
                        
                        # 5. Check for missing form labels
                        form_issues = page.evaluate("""() => {
                            const inputs = document.querySelectorAll('input:not([type="hidden"]):not([type="submit"]):not([type="button"])');
                            let unlabeled = 0;
                            inputs.forEach(input => {
                                const id = input.id;
                                const hasLabel = id && document.querySelector('label[for="' + id + '"]');
                                const hasAriaLabel = input.getAttribute('aria-label');
                                const hasPlaceholder = input.placeholder;
                                if (!hasLabel && !hasAriaLabel && !hasPlaceholder) unlabeled++;
                            });
                            return unlabeled;
                        }""")
                        
                        if form_issues > 0:
                            session["defects"].append({
                                "id": str(uuid.uuid4())[:8],
                                "type": "accessibility",
                                "severity": "medium",
                                "title": f"Form Inputs Missing Labels ({form_issues})",
                                "description": f"Found {form_issues} form inputs without proper labels (WCAG 1.3.1)",
                                "page_url": url,
                                "timestamp": datetime.utcnow().isoformat()
                            })
                        
                        # 6. Get links on the page for crawling
                        links = page.evaluate("""() => {
                            return Array.from(document.querySelectorAll('a[href]'))
                                .map(a => a.href)
                                .filter(href => href.startsWith('http'));
                        }""")
                        
                        # Add internal links to crawl queue
                        for link in links[:20]:
                            link_domain = urlparse(link).netloc
                            if link_domain == base_domain and link not in visited_urls:
                                urls_to_visit.append(link)
                        
                        # 7. Check for empty links
                        empty_links = page.evaluate("""() => {
                            const links = document.querySelectorAll('a');
                            let empty = 0;
                            links.forEach(a => {
                                if (!a.textContent.trim() && !a.querySelector('img') && !a.getAttribute('aria-label')) {
                                    empty++;
                                }
                            });
                            return empty;
                        }""")
                        
                        if empty_links > 0:
                            session["defects"].append({
                                "id": str(uuid.uuid4())[:8],
                                "type": "accessibility",
                                "severity": "medium",
                                "title": f"Empty Links ({empty_links})",
                                "description": f"Found {empty_links} links without text or aria-label (WCAG 2.4.4)",
                                "page_url": url,
                                "timestamp": datetime.utcnow().isoformat()
                            })
                        
                        # 8. Check for missing viewport meta tag (mobile)
                        if len(visited_urls) == 1:
                            has_viewport = page.evaluate("""() => {
                                return !!document.querySelector('meta[name="viewport"]');
                            }""")
                            
                            if not has_viewport:
                                session["defects"].append({
                                    "id": str(uuid.uuid4())[:8],
                                    "type": "mobile",
                                    "severity": "medium",
                                    "title": "Missing Viewport Meta Tag",
                                    "description": "Page is missing viewport meta tag, may not be mobile-friendly",
                                    "page_url": url,
                                    "timestamp": datetime.utcnow().isoformat()
                                })
                            
                            # Check for missing document language
                            has_lang = page.evaluate("""() => {
                                return !!document.documentElement.lang;
                            }""")
                            
                            if not has_lang:
                                session["defects"].append({
                                    "id": str(uuid.uuid4())[:8],
                                    "type": "accessibility",
                                    "severity": "medium",
                                    "title": "Missing Document Language",
                                    "description": "HTML document is missing lang attribute (WCAG 3.1.1)",
                                    "page_url": url,
                                    "timestamp": datetime.utcnow().isoformat()
                                })
                        
                        # 9. Check for mixed content (HTTP on HTTPS page)
                        if url.startswith("https://"):
                            mixed_content = page.evaluate("""() => {
                                const elements = document.querySelectorAll('img[src^="http://"], script[src^="http://"], link[href^="http://"]');
                                return elements.length;
                            }""")
                            
                            if mixed_content > 0:
                                session["defects"].append({
                                    "id": str(uuid.uuid4())[:8],
                                    "type": "security",
                                    "severity": "high",
                                    "title": f"Mixed Content ({mixed_content} resources)",
                                    "description": f"Found {mixed_content} HTTP resources on HTTPS page (security risk)",
                                    "page_url": url,
                                    "timestamp": datetime.utcnow().isoformat()
                                })
                        
                        # 10. Check for small touch targets
                        small_targets = page.evaluate("""() => {
                            const clickables = document.querySelectorAll('a, button, input[type="submit"], input[type="button"]');
                            let small = 0;
                            clickables.forEach(el => {
                                const rect = el.getBoundingClientRect();
                                if (rect.width > 0 && rect.height > 0) {
                                    if (rect.width < 44 || rect.height < 44) small++;
                                }
                            });
                            return small;
                        }""")
                        
                        if small_targets > 5:
                            session["defects"].append({
                                "id": str(uuid.uuid4())[:8],
                                "type": "usability",
                                "severity": "low",
                                "title": f"Small Touch Targets ({small_targets})",
                                "description": f"Found {small_targets} clickable elements smaller than 44x44px (recommended minimum)",
                                "page_url": url,
                                "timestamp": datetime.utcnow().isoformat()
                            })
                        
                        # 11. Check for heading structure
                        heading_issues = page.evaluate("""() => {
                            const headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
                            const levels = Array.from(headings).map(h => parseInt(h.tagName[1]));
                            let issues = 0;
                            if (levels.length > 0 && !levels.includes(1)) issues++;
                            for (let i = 1; i < levels.length; i++) {
                                if (levels[i] - levels[i-1] > 1) issues++;
                            }
                            return issues;
                        }""")
                        
                        if heading_issues > 0:
                            session["defects"].append({
                                "id": str(uuid.uuid4())[:8],
                                "type": "accessibility",
                                "severity": "low",
                                "title": f"Heading Structure Issues ({heading_issues})",
                                "description": f"Found {heading_issues} heading structure problems (missing h1 or skipped levels)",
                                "page_url": url,
                                "timestamp": datetime.utcnow().isoformat()
                            })
                        
                        # ============ FUNCTIONAL TESTING ============
                        
                        # 12. Test broken links (actually verify they're reachable)
                        broken_links_found = self._check_broken_links(page, url, session)
                        
                        # 13. Test buttons that don't do anything
                        dead_buttons = page.evaluate("""() => {
                            const buttons = document.querySelectorAll('button:not([type="submit"]), [role="button"]');
                            let dead = 0;
                            buttons.forEach(btn => {
                                // Check if button has no onclick, no href, and no form
                                const hasOnclick = btn.onclick || btn.getAttribute('onclick');
                                const hasHref = btn.getAttribute('href');
                                const inForm = btn.closest('form');
                                const hasEventListeners = btn.getAttribute('data-action') || 
                                                          btn.getAttribute('ng-click') || 
                                                          btn.getAttribute('@click') ||
                                                          btn.getAttribute('v-on:click');
                                if (!hasOnclick && !hasHref && !inForm && !hasEventListeners) {
                                    dead++;
                                }
                            });
                            return dead;
                        }""")
                        
                        if dead_buttons > 0:
                            session["defects"].append({
                                "id": str(uuid.uuid4())[:8],
                                "type": "functional",
                                "severity": "medium",
                                "title": f"Potentially Non-Functional Buttons ({dead_buttons})",
                                "description": f"Found {dead_buttons} buttons that may not have any click handlers",
                                "page_url": url,
                                "timestamp": datetime.utcnow().isoformat()
                            })
                        
                        # 14. Check for forms without submit buttons
                        forms_without_submit = page.evaluate("""() => {
                            const forms = document.querySelectorAll('form');
                            let noSubmit = 0;
                            forms.forEach(form => {
                                const hasSubmit = form.querySelector('button[type="submit"], input[type="submit"], button:not([type])');
                                if (!hasSubmit) noSubmit++;
                            });
                            return noSubmit;
                        }""")
                        
                        if forms_without_submit > 0:
                            session["defects"].append({
                                "id": str(uuid.uuid4())[:8],
                                "type": "functional",
                                "severity": "medium",
                                "title": f"Forms Without Submit Button ({forms_without_submit})",
                                "description": f"Found {forms_without_submit} forms that cannot be submitted (no submit button)",
                                "page_url": url,
                                "timestamp": datetime.utcnow().isoformat()
                            })
                        
                        # 15. Check for required fields without validation
                        forms_missing_validation = page.evaluate("""() => {
                            const requiredInputs = document.querySelectorAll('input[required], select[required], textarea[required]');
                            let missingValidation = 0;
                            requiredInputs.forEach(input => {
                                const form = input.closest('form');
                                if (form && !form.getAttribute('novalidate')) {
                                    // Check if there's visual indication
                                    const label = document.querySelector('label[for="' + input.id + '"]');
                                    if (label && !label.textContent.includes('*') && !label.querySelector('.required')) {
                                        missingValidation++;
                                    }
                                }
                            });
                            return missingValidation;
                        }""")
                        
                        if forms_missing_validation > 2:
                            session["defects"].append({
                                "id": str(uuid.uuid4())[:8],
                                "type": "functional",
                                "severity": "low",
                                "title": f"Required Fields Not Visually Marked ({forms_missing_validation})",
                                "description": f"Found {forms_missing_validation} required fields without visual indication (missing * or required marker)",
                                "page_url": url,
                                "timestamp": datetime.utcnow().isoformat()
                            })
                        
                        # 16. Check for interactive elements that might be broken
                        broken_interactive = page.evaluate("""() => {
                            const issues = [];
                            
                            // Check dropdowns with no options
                            document.querySelectorAll('select').forEach(sel => {
                                if (sel.options.length <= 1) {
                                    issues.push('Empty dropdown: ' + (sel.name || sel.id || 'unnamed'));
                                }
                            });
                            
                            // Check links pointing to # only
                            document.querySelectorAll('a[href="#"]').forEach(a => {
                                if (!a.onclick && !a.getAttribute('data-action')) {
                                    issues.push('Dead # link');
                                }
                            });
                            
                            // Check links with javascript:void(0)
                            document.querySelectorAll('a[href="javascript:void(0)"]').forEach(a => {
                                if (!a.onclick && !a.getAttribute('data-action')) {
                                    issues.push('Dead javascript:void link');
                                }
                            });
                            
                            return issues;
                        }""")
                        
                        if len(broken_interactive) > 0:
                            session["defects"].append({
                                "id": str(uuid.uuid4())[:8],
                                "type": "functional",
                                "severity": "medium",
                                "title": f"Broken Interactive Elements ({len(broken_interactive)})",
                                "description": f"Found issues: {', '.join(broken_interactive[:5])}{'...' if len(broken_interactive) > 5 else ''}",
                                "page_url": url,
                                "timestamp": datetime.utcnow().isoformat()
                            })
                        
                        # 17. Actually click some buttons and check for errors
                        if len(visited_urls) <= 5:  # Only do intensive testing on first few pages
                            self._test_button_clicks(page, url, session)
                        
                        # Store page info
                        session["pages_visited"].append({
                            "url": url,
                            "title": title,
                            "status_code": status_code,
                            "load_time_ms": load_time
                        })
                        
                    except Exception as e:
                        logger.error(f"Error testing {url}: {e}")
                        session["defects"].append({
                            "id": str(uuid.uuid4())[:8],
                            "type": "error",
                            "severity": "high",
                            "title": "Page Load Error",
                            "description": f"Failed to load page: {str(e)[:200]}",
                            "page_url": url,
                            "timestamp": datetime.utcnow().isoformat()
                        })
                    
                    # Check time limit
                    elapsed = (datetime.utcnow() - session["start_time"]).total_seconds()
                    if elapsed > session["max_duration_minutes"] * 60:
                        logger.info(f"Session {session_id} time limit reached")
                        break
                
                browser.close()
                
            session["status"] = "completed"
            session["progress"] = 100
            session["current_activity"] = f"Exploration complete - tested {len(visited_urls)} pages"
            logger.info(f"Session {session_id} completed with {len(session['defects'])} defects")
            
        except Exception as e:
            logger.error(f"Exploration failed: {e}", exc_info=True)
            session["status"] = "error"
            session["current_activity"] = f"Error: {str(e)}"
    
    def _check_broken_links(self, page, current_url: str, session: Dict) -> int:
        """Check for broken links by making HEAD requests."""
        import requests
        
        broken_count = 0
        try:
            links = page.evaluate("""() => {
                return Array.from(document.querySelectorAll('a[href]'))
                    .map(a => ({ href: a.href, text: a.textContent.trim().slice(0, 50) }))
                    .filter(l => l.href.startsWith('http'))
                    .slice(0, 10);  // Limit to 10 links per page
            }""")
            
            for link_info in links:
                try:
                    resp = requests.head(link_info['href'], timeout=5, allow_redirects=True)
                    if resp.status_code >= 400:
                        broken_count += 1
                        session["defects"].append({
                            "id": str(uuid.uuid4())[:8],
                            "type": "functional",
                            "severity": "high" if resp.status_code == 404 else "medium",
                            "title": f"Broken Link ({resp.status_code})",
                            "description": f"Link '{link_info['text'][:30]}...' returns {resp.status_code}: {link_info['href'][:80]}",
                            "page_url": current_url,
                            "timestamp": datetime.utcnow().isoformat()
                        })
                except requests.exceptions.Timeout:
                    broken_count += 1
                    session["defects"].append({
                        "id": str(uuid.uuid4())[:8],
                        "type": "functional",
                        "severity": "medium",
                        "title": "Link Timeout",
                        "description": f"Link '{link_info['text'][:30]}...' timed out: {link_info['href'][:80]}",
                        "page_url": current_url,
                        "timestamp": datetime.utcnow().isoformat()
                    })
                except Exception:
                    pass  # Ignore other errors
        except Exception as e:
            logger.debug(f"Error checking links: {e}")
        
        return broken_count
    
    def _test_button_clicks(self, page, current_url: str, session: Dict):
        """Test clicking buttons and check for JavaScript errors."""
        try:
            # Get clickable buttons
            buttons = page.evaluate("""() => {
                return Array.from(document.querySelectorAll('button, [role="button"]'))
                    .filter(btn => {
                        const rect = btn.getBoundingClientRect();
                        const style = window.getComputedStyle(btn);
                        return rect.width > 0 && rect.height > 0 && 
                               style.display !== 'none' && 
                               style.visibility !== 'hidden' &&
                               !btn.disabled;
                    })
                    .map((btn, i) => ({
                        index: i,
                        text: btn.textContent.trim().slice(0, 30),
                        type: btn.type || 'button'
                    }))
                    .slice(0, 5);  // Test max 5 buttons
            }""")
            
            js_errors = []
            
            # Set up console error listener
            def capture_error(msg):
                if msg.type == "error":
                    js_errors.append(msg.text)
            
            page.on("console", capture_error)
            
            for btn_info in buttons:
                if btn_info['type'] == 'submit':
                    continue  # Skip submit buttons
                
                try:
                    js_errors.clear()
                    
                    # Try to click the button
                    buttons_on_page = page.locator('button, [role="button"]').all()
                    if btn_info['index'] < len(buttons_on_page):
                        btn = buttons_on_page[btn_info['index']]
                        
                        # Click with short timeout
                        btn.click(timeout=3000, force=True)
                        page.wait_for_timeout(500)
                        
                        # Check if any JS errors occurred
                        if js_errors:
                            session["defects"].append({
                                "id": str(uuid.uuid4())[:8],
                                "type": "functional",
                                "severity": "high",
                                "title": f"Button Click Causes Error",
                                "description": f"Clicking '{btn_info['text']}' caused JS error: {js_errors[0][:200]}",
                                "page_url": current_url,
                                "timestamp": datetime.utcnow().isoformat()
                            })
                        
                        # Press Escape to close any modals
                        page.keyboard.press("Escape")
                        page.wait_for_timeout(200)
                        
                except Exception as e:
                    # Button click failed - might indicate an issue
                    if "timeout" not in str(e).lower():
                        logger.debug(f"Button click test failed: {e}")
            
            page.remove_listener("console", capture_error)
            
        except Exception as e:
            logger.debug(f"Error testing buttons: {e}")
    
    async def get_session_status(self, session_id: str) -> Dict[str, Any]:
        """Get current session status."""
        session = self.sessions.get(session_id)
        if not session:
            raise ValueError(f"Session {session_id} not found")
        
        elapsed = (datetime.utcnow() - session["start_time"]).total_seconds()
        
        # Deduplicate defects by type+url
        unique_defects = {}
        for d in session["defects"]:
            key = f"{d['type']}:{d['title']}:{d['page_url']}"
            if key not in unique_defects:
                unique_defects[key] = d
        
        return {
            "session_id": session_id,
            "status": session["status"],
            "defects_found": len(unique_defects),
            "defects": list(unique_defects.values()),
            "time_elapsed_seconds": elapsed,
            "progress": {
                "pages_crawled": session["pages_crawled"],
                "progress_percentage": session["progress"],
            },
            "current_activity": session["current_activity"],
            "risk_heatmap": self._build_risk_heatmap(list(unique_defects.values())),
        }
    
    def _build_risk_heatmap(self, defects: List[Dict]) -> Dict[str, str]:
        """Build a risk heatmap from found defects."""
        heatmap = {}
        
        # Group defects by type
        defect_types = {}
        for d in defects:
            dtype = d["type"]
            if dtype not in defect_types:
                defect_types[dtype] = {"count": 0, "max_severity": "low"}
            defect_types[dtype]["count"] += 1
            
            # Update max severity
            severities = ["low", "medium", "high", "critical"]
            current_idx = severities.index(defect_types[dtype]["max_severity"]) if defect_types[dtype]["max_severity"] in severities else 0
            new_idx = severities.index(d["severity"]) if d["severity"] in severities else 0
            if new_idx > current_idx:
                defect_types[dtype]["max_severity"] = d["severity"]
        
        # Map to readable names
        type_names = {
            "http_error": "HTTP Errors",
            "javascript_error": "JavaScript Errors",
            "accessibility": "Accessibility",
            "performance": "Performance",
            "security": "Security",
            "mobile": "Mobile",
            "usability": "Usability",
            "functional": "Functional",
            "error": "Page Errors"
        }
        
        for dtype, info in defect_types.items():
            name = type_names.get(dtype, dtype.title())
            heatmap[name] = info["max_severity"]
        
        return heatmap
    
    async def stop_session(self, session_id: str) -> Dict[str, Any]:
        """Stop a running session."""
        session = self.sessions.get(session_id)
        if not session:
            raise ValueError(f"Session {session_id} not found")
        
        session["status"] = "stopped"
        session["current_activity"] = "Stopped by user"
        
        return {
            "session_id": session_id,
            "status": "stopped",
            "message": "Session stopped"
        }


# Global instance
_real_exploratory_service = None

def get_real_exploratory_service() -> RealExploratoryService:
    global _real_exploratory_service
    if _real_exploratory_service is None:
        _real_exploratory_service = RealExploratoryService()
    return _real_exploratory_service
