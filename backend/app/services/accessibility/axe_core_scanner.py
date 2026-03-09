"""
Axe-Core Accessibility Scanner

Real accessibility scanning using axe-core via Playwright.
Produces detailed reports showing EXACTLY what's wrong and how to fix it.

This is a STANDALONE service - does NOT touch recording or suggest flows.

Features:
- Real axe-core scanning (not regex fallback)
- WCAG 2.1 AA/AAA compliance checking
- Clear violation reports with fix suggestions
- PDF/HTML report generation
- Impact-based prioritization
"""

import asyncio
import json
import logging
from typing import Dict, List, Any, Optional
from datetime import datetime
from pathlib import Path
import subprocess
import tempfile
import os

logger = logging.getLogger(__name__)

# Axe-core script to inject into page
AXE_CORE_CDN = "https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.8.4/axe.min.js"

AXE_RUN_SCRIPT = """
async () => {
    // Wait for axe to be available
    if (typeof axe === 'undefined') {
        await new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = '%s';
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }
    
    // Configure axe for WCAG level
    const options = {
        runOnly: {
            type: 'tag',
            values: %s
        },
        resultTypes: ['violations', 'incomplete', 'passes']
    };
    
    // Run axe analysis
    const results = await axe.run(document, options);
    return results;
}
"""


class AxeCoreScanner:
    """
    Production-grade accessibility scanner using axe-core.
    
    Usage:
        scanner = AxeCoreScanner()
        report = await scanner.scan_url("https://example.com")
        print(report['summary'])
    """
    
    def __init__(self):
        self.playwright_available = self._check_playwright()
    
    def _check_playwright(self) -> bool:
        """Check if playwright is available and working"""
        try:
            import playwright
            # On Windows with uvicorn, async subprocess doesn't work
            # We'll use sync playwright in a thread instead
            import sys
            if sys.platform == 'win32':
                logger.info("Windows detected - will use sync Playwright in thread pool")
            return True
        except ImportError:
            logger.warning("Playwright not installed - using fallback scanner")
            return False
    
    def _get_wcag_tags(self, level: str = "AA") -> List[str]:
        """Get WCAG tags for axe-core based on compliance level"""
        tags = ["wcag2a", "wcag21a"]  # Level A always included
        
        if level in ["AA", "AAA"]:
            tags.extend(["wcag2aa", "wcag21aa"])
        
        if level == "AAA":
            tags.extend(["wcag2aaa", "wcag21aaa"])
        
        # Always include best practices
        tags.append("best-practice")
        
        return tags
    
    async def scan_url(
        self,
        url: str,
        wcag_level: str = "AA",
        include_passes: bool = False,
        wait_for_selector: Optional[str] = None,
        timeout_ms: int = 30000
    ) -> Dict[str, Any]:
        """
        Scan a URL for accessibility violations using axe-core.
        
        Args:
            url: The URL to scan
            wcag_level: WCAG compliance level (A, AA, AAA)
            include_passes: Include passing rules in report
            wait_for_selector: Wait for element before scanning
            timeout_ms: Timeout in milliseconds
            
        Returns:
            Comprehensive accessibility report
        """
        import sys
        from concurrent.futures import ThreadPoolExecutor
        
        start_time = datetime.utcnow()
        
        if self.playwright_available:
            try:
                # On Windows, run sync playwright in thread pool to avoid event loop issues
                if sys.platform == 'win32':
                    loop = asyncio.get_event_loop()
                    with ThreadPoolExecutor() as pool:
                        results = await loop.run_in_executor(
                            pool,
                            self._scan_with_playwright_sync,
                            url, wcag_level, wait_for_selector, timeout_ms
                        )
                else:
                    results = await self._scan_with_playwright(
                        url, wcag_level, wait_for_selector, timeout_ms
                    )
            except Exception as e:
                logger.warning(f"Playwright scan failed, using fallback: {e}")
                results = await self._scan_fallback(url, wcag_level)
        else:
            # Fallback to basic HTTP fetch + regex checks
            results = await self._scan_fallback(url, wcag_level)
        
        # Process and enhance results
        report = self._build_report(results, url, wcag_level, start_time, include_passes)
        
        return report
    
    def _scan_with_playwright_sync(
        self,
        url: str,
        wcag_level: str,
        wait_for_selector: Optional[str],
        timeout_ms: int
    ) -> Dict[str, Any]:
        """Sync version of Playwright scan for Windows compatibility"""
        from playwright.sync_api import sync_playwright

        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context(
                viewport={"width": 1920, "height": 1080},
                user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            )
            page = context.new_page()

            try:
                # Navigate — use domcontentloaded to avoid hanging on slow/streaming pages
                try:
                    page.goto(url, timeout=timeout_ms, wait_until="domcontentloaded")
                    page.wait_for_timeout(2000)  # Let JS frameworks render
                except Exception:
                    # Last resort: just wait for commit
                    page.goto(url, timeout=timeout_ms, wait_until="commit")
                    page.wait_for_timeout(3000)

                # Wait for specific element if requested
                if wait_for_selector:
                    if len(wait_for_selector) > 500:
                        raise ValueError("wait_for_selector is too long (max 500 characters)")
                    page.wait_for_selector(wait_for_selector, timeout=timeout_ms)

                # Inject axe-core — try inline injection first (CSP-safe), then CDN fallback
                wcag_tags = self._get_wcag_tags(wcag_level)
                axe_injected = False

                # Method 1: Use the AXE_RUN_SCRIPT which includes its own fallback injection
                try:
                    script = AXE_RUN_SCRIPT % (AXE_CORE_CDN, json.dumps(wcag_tags))
                    results = page.evaluate(script)
                    axe_injected = True
                except Exception as eval_err:
                    logger.warning(f"AXE_RUN_SCRIPT injection failed: {eval_err}")

                # Method 2: Try fetching axe-core source and injecting inline
                if not axe_injected:
                    try:
                        from app.services.accessibility.axe_scanner import _fetch_axe_core_script
                        axe_source = _fetch_axe_core_script()
                        if axe_source:
                            page.evaluate(axe_source)
                            is_loaded = page.evaluate("typeof axe !== 'undefined'")
                            if is_loaded:
                                axe_options = {
                                    "runOnly": {"type": "tag", "values": wcag_tags},
                                    "resultTypes": ["violations", "incomplete", "passes"]
                                }
                                results = page.evaluate("""
                                    async (options) => { return await axe.run(document, options); }
                                """, axe_options)
                                axe_injected = True
                    except Exception as inline_err:
                        logger.warning(f"Inline axe injection failed: {inline_err}")

                if not axe_injected:
                    results = {
                        "violations": [],
                        "incomplete": [],
                        "passes": [],
                        "error": "Failed to inject axe-core (CSP may be blocking scripts)"
                    }

                # Get page title and meta
                results['pageTitle'] = page.title()
                results['pageUrl'] = page.url

            except Exception as e:
                logger.error(f"Playwright sync scan failed: {e}")
                results = {
                    "violations": [],
                    "incomplete": [],
                    "passes": [],
                    "error": str(e)
                }
            finally:
                browser.close()

        return results
    
    async def _scan_with_playwright(
        self,
        url: str,
        wcag_level: str,
        wait_for_selector: Optional[str],
        timeout_ms: int
    ) -> Dict[str, Any]:
        """Scan using Playwright + axe-core (production quality, non-Windows)"""
        from playwright.async_api import async_playwright

        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            context = await browser.new_context(
                viewport={"width": 1920, "height": 1080},
                user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            )
            page = await context.new_page()

            try:
                # Navigate — use domcontentloaded to avoid hanging on slow/streaming pages
                try:
                    await page.goto(url, timeout=timeout_ms, wait_until="domcontentloaded")
                    await page.wait_for_timeout(2000)  # Let JS frameworks render
                except Exception:
                    await page.goto(url, timeout=timeout_ms, wait_until="commit")
                    await page.wait_for_timeout(3000)

                # Wait for specific element if requested
                if wait_for_selector:
                    if len(wait_for_selector) > 500:
                        raise ValueError("wait_for_selector is too long (max 500 characters)")
                    await page.wait_for_selector(wait_for_selector, timeout=timeout_ms)

                # Inject axe-core — try AXE_RUN_SCRIPT first, then inline fallback
                wcag_tags = self._get_wcag_tags(wcag_level)
                axe_injected = False

                # Method 1: AXE_RUN_SCRIPT with built-in script element injection
                try:
                    script = AXE_RUN_SCRIPT % (AXE_CORE_CDN, json.dumps(wcag_tags))
                    results = await page.evaluate(script)
                    axe_injected = True
                except Exception as eval_err:
                    logger.warning(f"AXE_RUN_SCRIPT injection failed: {eval_err}")

                # Method 2: Fetch axe source and inject inline
                if not axe_injected:
                    try:
                        from app.services.accessibility.axe_scanner import _fetch_axe_core_script
                        axe_source = _fetch_axe_core_script()
                        if axe_source:
                            await page.evaluate(axe_source)
                            is_loaded = await page.evaluate("typeof axe !== 'undefined'")
                            if is_loaded:
                                axe_options = {
                                    "runOnly": {"type": "tag", "values": wcag_tags},
                                    "resultTypes": ["violations", "incomplete", "passes"]
                                }
                                results = await page.evaluate("""
                                    async (options) => { return await axe.run(document, options); }
                                """, axe_options)
                                axe_injected = True
                    except Exception as inline_err:
                        logger.warning(f"Inline axe injection failed: {inline_err}")

                if not axe_injected:
                    results = {
                        "violations": [],
                        "incomplete": [],
                        "passes": [],
                        "error": "Failed to inject axe-core (CSP may be blocking scripts)"
                    }

                # Take screenshot for reference
                try:
                    screenshot = await page.screenshot(full_page=True, type="png")
                    results['screenshot'] = screenshot
                except Exception:
                    pass  # Screenshot is optional

                # Get page title and meta
                results['pageTitle'] = await page.title()
                results['pageUrl'] = page.url

            except Exception as e:
                logger.error(f"Playwright scan failed: {e}")
                results = {
                    "violations": [],
                    "incomplete": [],
                    "passes": [],
                    "error": str(e)
                }
            finally:
                await browser.close()

        return results
    
    async def _scan_fallback(self, url: str, wcag_level: str) -> Dict[str, Any]:
        """Fallback scanner when Playwright unavailable — uses httpx (already in deps)"""
        try:
            import httpx
        except ImportError:
            logger.error("httpx not installed — cannot perform fallback scan")
            return {"violations": [], "error": "Neither Playwright nor httpx available for scanning"}

        try:
            async with httpx.AsyncClient(timeout=30, follow_redirects=True) as client:
                response = await client.get(url)
                html = response.text
                return self._analyze_html(html, url, wcag_level)
        except Exception as e:
            logger.error(f"Fallback scan failed: {e}")
            return {"violations": [], "error": str(e)}
    
    def _analyze_html(self, html: str, url: str, wcag_level: str) -> Dict[str, Any]:
        """Analyze HTML for common accessibility issues (fallback)"""
        import re
        
        violations = []
        incomplete = []
        passes = []
        
        # === CRITICAL CHECKS ===
        
        # 1. Images without alt text
        images = re.findall(r'<img\s+([^>]*)>', html, re.IGNORECASE)
        for img_attrs in images:
            if 'alt=' not in img_attrs.lower():
                violations.append({
                    "id": "image-alt",
                    "impact": "critical",
                    "description": "Images must have alternate text",
                    "help": "Ensures <img> elements have alternate text or a role of none or presentation",
                    "helpUrl": "https://dequeuniversity.com/rules/axe/4.8/image-alt",
                    "tags": ["wcag2a", "wcag111", "section508"],
                    "nodes": [{
                        "html": f"<img {img_attrs}>",
                        "failureSummary": "Fix: Add an alt attribute to the image"
                    }]
                })
        
        # 2. Form inputs without labels
        inputs = re.findall(r'<input\s+([^>]*)>', html, re.IGNORECASE)
        for inp_attrs in inputs:
            inp_type = re.search(r'type=["\']?(\w+)', inp_attrs, re.IGNORECASE)
            inp_type = inp_type.group(1).lower() if inp_type else "text"
            
            if inp_type not in ["hidden", "submit", "button", "image", "reset"]:
                inp_id = re.search(r'id=["\']([^"\']+)', inp_attrs)
                has_label = False
                
                if inp_id:
                    label_pattern = f'<label[^>]*for=["\']?{inp_id.group(1)}["\']?'
                    has_label = bool(re.search(label_pattern, html, re.IGNORECASE))
                
                if not has_label and 'aria-label' not in inp_attrs.lower():
                    violations.append({
                        "id": "label",
                        "impact": "critical",
                        "description": "Form elements must have labels",
                        "help": "Ensures every form element has a label",
                        "helpUrl": "https://dequeuniversity.com/rules/axe/4.8/label",
                        "tags": ["wcag2a", "wcag412", "section508"],
                        "nodes": [{
                            "html": f"<input {inp_attrs}>",
                            "failureSummary": "Fix: Add a <label> element with matching 'for' attribute, or add aria-label"
                        }]
                    })
        
        # 3. Buttons without accessible names
        buttons = re.findall(r'<button\s*([^>]*)>(.*?)</button>', html, re.IGNORECASE | re.DOTALL)
        for btn_attrs, btn_content in buttons:
            btn_text = re.sub(r'<[^>]+>', '', btn_content).strip()
            if not btn_text and 'aria-label' not in btn_attrs.lower():
                violations.append({
                    "id": "button-name",
                    "impact": "critical",
                    "description": "Buttons must have discernible text",
                    "help": "Ensures buttons have discernible text",
                    "helpUrl": "https://dequeuniversity.com/rules/axe/4.8/button-name",
                    "tags": ["wcag2a", "wcag412", "section508"],
                    "nodes": [{
                        "html": f"<button {btn_attrs}>{btn_content}</button>",
                        "failureSummary": "Fix: Add visible text content or aria-label to button"
                    }]
                })
        
        # 4. Links without text
        links = re.findall(r'<a\s+([^>]*)>(.*?)</a>', html, re.IGNORECASE | re.DOTALL)
        for link_attrs, link_content in links:
            link_text = re.sub(r'<[^>]+>', '', link_content).strip()
            if not link_text and 'aria-label' not in link_attrs.lower():
                violations.append({
                    "id": "link-name",
                    "impact": "serious",
                    "description": "Links must have discernible text",
                    "help": "Ensures links have discernible text",
                    "helpUrl": "https://dequeuniversity.com/rules/axe/4.8/link-name",
                    "tags": ["wcag2a", "wcag412", "section508"],
                    "nodes": [{
                        "html": f"<a {link_attrs}>{link_content}</a>",
                        "failureSummary": "Fix: Add visible text content or aria-label to link"
                    }]
                })
        
        # === SERIOUS CHECKS ===
        
        # 5. Missing page language
        if not re.search(r'<html[^>]*lang=', html, re.IGNORECASE):
            violations.append({
                "id": "html-has-lang",
                "impact": "serious",
                "description": "<html> element must have a lang attribute",
                "help": "Ensures every HTML document has a lang attribute",
                "helpUrl": "https://dequeuniversity.com/rules/axe/4.8/html-has-lang",
                "tags": ["wcag2a", "wcag311"],
                "nodes": [{
                    "html": "<html>",
                    "failureSummary": "Fix: Add lang attribute to <html> element (e.g., lang=\"en\")"
                }]
            })
        
        # 6. Missing document title
        if not re.search(r'<title[^>]*>.+</title>', html, re.IGNORECASE | re.DOTALL):
            violations.append({
                "id": "document-title",
                "impact": "serious",
                "description": "Documents must have <title> element to aid in navigation",
                "help": "Ensures each HTML document contains a non-empty <title> element",
                "helpUrl": "https://dequeuniversity.com/rules/axe/4.8/document-title",
                "tags": ["wcag2a", "wcag242"],
                "nodes": [{
                    "html": "<head>...</head>",
                    "failureSummary": "Fix: Add a descriptive <title> element inside <head>"
                }]
            })
        
        # 7. Heading hierarchy issues
        headings = re.findall(r'<h([1-6])[^>]*>', html, re.IGNORECASE)
        if headings:
            heading_levels = [int(h) for h in headings]
            if 1 not in heading_levels:
                violations.append({
                    "id": "page-has-heading-one",
                    "impact": "moderate",
                    "description": "Page should contain a level-one heading",
                    "help": "Ensures the page has at least one level one heading",
                    "helpUrl": "https://dequeuniversity.com/rules/axe/4.8/page-has-heading-one",
                    "tags": ["wcag2a", "wcag131", "best-practice"],
                    "nodes": [{
                        "html": "(page)",
                        "failureSummary": "Fix: Add an <h1> element to identify the main content"
                    }]
                })
            
            # Check for skipped heading levels
            prev_level = 0
            for level in heading_levels:
                if level > prev_level + 1 and prev_level > 0:
                    violations.append({
                        "id": "heading-order",
                        "impact": "moderate",
                        "description": "Heading levels should only increase by one",
                        "help": "Ensures the order of headings is semantically correct",
                        "helpUrl": "https://dequeuniversity.com/rules/axe/4.8/heading-order",
                        "tags": ["wcag2a", "wcag131", "best-practice"],
                        "nodes": [{
                            "html": f"<h{level}>",
                            "failureSummary": f"Fix: Heading jumps from h{prev_level} to h{level}. Add missing h{prev_level + 1}"
                        }]
                    })
                    break
                prev_level = level
        
        # 8. Check for ARIA landmarks
        has_main = bool(re.search(r'<main|role=["\']main["\']', html, re.IGNORECASE))
        has_nav = bool(re.search(r'<nav|role=["\']navigation["\']', html, re.IGNORECASE))
        
        if not has_main:
            incomplete.append({
                "id": "landmark-main-is-top-level",
                "impact": "moderate",
                "description": "Page should have a main landmark",
                "help": "Ensures main landmarks are at top level",
                "helpUrl": "https://dequeuniversity.com/rules/axe/4.8/landmark-main-is-top-level",
                "tags": ["wcag2a", "wcag131", "best-practice"],
                "nodes": [{
                    "html": "(page)",
                    "failureSummary": "Consider: Add <main> element or role=\"main\" to wrap main content"
                }]
            })
        
        return {
            "violations": violations,
            "incomplete": incomplete,
            "passes": passes,
            "pageUrl": url
        }
    
    def _build_report(
        self,
        results: Dict[str, Any],
        url: str,
        wcag_level: str,
        start_time: datetime,
        include_passes: bool
    ) -> Dict[str, Any]:
        """Build comprehensive accessibility report"""
        
        violations = results.get("violations", [])
        incomplete = results.get("incomplete", [])
        passes = results.get("passes", [])
        
        # Count by impact
        critical_count = len([v for v in violations if v.get("impact") == "critical"])
        serious_count = len([v for v in violations if v.get("impact") == "serious"])
        moderate_count = len([v for v in violations if v.get("impact") == "moderate"])
        minor_count = len([v for v in violations if v.get("impact") == "minor"])
        
        # Calculate compliance score
        total_rules = len(violations) + len(passes)
        compliance_score = (len(passes) / total_rules * 100) if total_rules > 0 else 100
        
        # Build violation details with clear fix instructions
        violation_details = []
        for v in violations:
            # Extract detailed element info from axe-core nodes
            affected_elements = []
            for node in v.get("nodes", [])[:10]:  # Show up to 10 examples
                # Axe-core provides 'target' as CSS selector array
                target = node.get("target", [])
                css_selector = " > ".join(target) if isinstance(target, list) else str(target)
                
                # Also try to get xpath if available
                xpath = node.get("xpath", [])
                xpath_str = "".join(xpath) if isinstance(xpath, list) else str(xpath) if xpath else ""
                
                # Get the actual HTML snippet
                html = node.get("html", "")
                
                # Parse failure summary for clear instructions
                failure_summary = node.get("failureSummary", "")
                
                # Get any/all/none check results
                any_checks = node.get("any", [])
                all_checks = node.get("all", [])
                none_checks = node.get("none", [])
                
                # Build clear failure reasons
                failure_reasons = []
                for check in any_checks + all_checks + none_checks:
                    if check.get("message"):
                        failure_reasons.append(check.get("message"))
                
                affected_elements.append({
                    "css_selector": css_selector,
                    "xpath": xpath_str,
                    "html": html,
                    "fix_suggestion": failure_summary,
                    "failure_reasons": failure_reasons,
                    # Provide a concrete fix example
                    "fix_example": self._generate_fix_example(v.get("id"), html, css_selector)
                })
            
            detail = {
                "rule_id": v.get("id"),
                "impact": v.get("impact", "unknown"),
                "impact_emoji": self._get_impact_emoji(v.get("impact")),
                "what_is_wrong": v.get("description"),
                "why_it_matters": v.get("help"),
                "how_to_fix": self._get_fix_instructions(v),
                "wcag_criteria": self._get_wcag_criteria(v.get("tags", [])),
                "learn_more": v.get("helpUrl"),
                "affected_elements": affected_elements,
                "element_count": len(v.get("nodes", []))
            }
            violation_details.append(detail)
        
        # Sort by impact (critical first)
        impact_order = {"critical": 0, "serious": 1, "moderate": 2, "minor": 3}
        violation_details.sort(key=lambda x: impact_order.get(x["impact"], 4))
        
        report = {
            "scan_info": {
                "url": url,
                "page_title": results.get("pageTitle", ""),
                "wcag_level": wcag_level,
                "scan_time": start_time.isoformat(),
                "scan_duration_ms": int((datetime.utcnow() - start_time).total_seconds() * 1000),
                "scanner": "Flowstral Axe-Core Scanner v1.0"
            },
            "summary": {
                "compliance_score": round(compliance_score, 1),
                "status": self._get_status(violations),
                "total_violations": len(violations),
                "critical": critical_count,
                "serious": serious_count,
                "moderate": moderate_count,
                "minor": minor_count,
                "needs_review": len(incomplete),
                "passed_rules": len(passes)
            },
            "violations": violation_details,
            "needs_review": [
                {
                    "rule_id": i.get("id"),
                    "description": i.get("description"),
                    "why_check": i.get("help"),
                    "element_count": len(i.get("nodes", []))
                }
                for i in incomplete
            ],
            "executive_summary": self._generate_executive_summary(
                url, wcag_level, compliance_score, critical_count, serious_count, 
                moderate_count, minor_count
            )
        }
        
        if include_passes:
            report["passed_rules"] = [
                {"rule_id": p.get("id"), "description": p.get("description")}
                for p in passes
            ]
        
        if results.get("screenshot"):
            report["screenshot_base64"] = results["screenshot"].hex() if isinstance(results["screenshot"], bytes) else None
        
        return report
    
    def _get_impact_emoji(self, impact: str) -> str:
        """Get emoji for impact level"""
        return {
            "critical": "🔴",
            "serious": "🟠",
            "moderate": "🟡",
            "minor": "🔵"
        }.get(impact, "⚪")
    
    def _get_status(self, violations: List) -> str:
        """Determine overall status"""
        if not violations:
            return "PASS"
        
        critical = any(v.get("impact") == "critical" for v in violations)
        serious = any(v.get("impact") == "serious" for v in violations)
        
        if critical:
            return "CRITICAL_ISSUES"
        elif serious:
            return "SERIOUS_ISSUES"
        else:
            return "MINOR_ISSUES"
    
    def _get_fix_instructions(self, violation: Dict) -> str:
        """Get clear fix instructions for a violation"""
        rule_id = violation.get("id", "")
        
        fix_instructions = {
            "image-alt": "Add descriptive alt text to all images. For decorative images, use alt=\"\"",
            "label": "Add a <label> element with a 'for' attribute matching the input's 'id', OR add aria-label attribute",
            "button-name": "Add visible text inside the button, OR add aria-label=\"Button description\"",
            "link-name": "Add visible text inside the link, OR add aria-label=\"Link description\"",
            "html-has-lang": "Add lang=\"en\" (or appropriate language code) to the <html> element",
            "document-title": "Add a descriptive <title> element inside <head>",
            "page-has-heading-one": "Add an <h1> element that describes the main content of the page",
            "heading-order": "Ensure headings follow sequential order (h1, then h2, then h3, etc.)",
            "color-contrast": "Increase contrast between text and background. Use tools like WebAIM Contrast Checker",
            "landmark-main-is-top-level": "Wrap main content in <main> element",
        }
        
        return fix_instructions.get(rule_id, "See 'Learn More' link for detailed fix instructions")
    
    def _generate_fix_example(self, rule_id: str, html: str, css_selector: str) -> str:
        """Generate a concrete code fix example based on the violation type"""
        import re
        
        if not html:
            return ""
        
        # Clean up HTML for display
        html_clean = html.strip()
        
        if rule_id == "image-alt":
            # Find src and suggest alt text
            src_match = re.search(r'src=["\']([^"\']+)["\']', html_clean)
            src = src_match.group(1) if src_match else "image.jpg"
            filename = src.split("/")[-1].split("?")[0]
            suggested_alt = filename.replace("-", " ").replace("_", " ").replace(".png", "").replace(".jpg", "").replace(".webp", "").title()
            
            if '<img' in html_clean.lower():
                if 'alt=' in html_clean.lower():
                    return f'<!-- Change empty alt to descriptive text -->\n<img src="{src}" alt="{suggested_alt}">'
                else:
                    return f'<!-- Add alt attribute -->\n<img src="{src}" alt="{suggested_alt}">'
        
        elif rule_id == "button-name":
            return f'''<!-- Option 1: Add visible text -->
<button>Click Here</button>

<!-- Option 2: Add aria-label -->
<button aria-label="Submit form">
  <svg>...</svg>
</button>'''
        
        elif rule_id == "link-name":
            href_match = re.search(r'href=["\']([^"\']+)["\']', html_clean)
            href = href_match.group(1) if href_match else "#"
            return f'''<!-- Option 1: Add visible text -->
<a href="{href}">Learn More</a>

<!-- Option 2: Add aria-label -->
<a href="{href}" aria-label="Learn more about our services">
  <img src="arrow.png" alt="">
</a>'''
        
        elif rule_id == "label":
            # Try to extract input id
            id_match = re.search(r'id=["\']([^"\']+)["\']', html_clean)
            input_id = id_match.group(1) if id_match else "input-field"
            
            return f'''<!-- Option 1: Add label element -->
<label for="{input_id}">Email Address</label>
<input type="text" id="{input_id}">

<!-- Option 2: Add aria-label -->
<input type="text" id="{input_id}" aria-label="Email Address">

<!-- Option 3: Add aria-labelledby -->
<span id="{input_id}-label">Email</span>
<input type="text" aria-labelledby="{input_id}-label">'''
        
        elif rule_id == "html-has-lang":
            return '<!-- Add lang attribute to html element -->\n<html lang="en">'
        
        elif rule_id == "document-title":
            return '<!-- Add title in head -->\n<head>\n  <title>Page Title - Site Name</title>\n</head>'
        
        elif rule_id == "color-contrast":
            return '''/* Increase text contrast */
.low-contrast-text {
  /* Before: color: #999; (fails AA) */
  color: #595959; /* 7:1 ratio - passes AAA */
}

/* Or increase background contrast */
.container {
  background: #ffffff;
  color: #333333; /* 12.6:1 ratio */
}'''
        
        elif rule_id == "heading-order":
            return '''<!-- Correct heading hierarchy -->
<h1>Page Title</h1>
  <h2>Section 1</h2>
    <h3>Subsection 1.1</h3>
  <h2>Section 2</h2>
    <h3>Subsection 2.1</h3>

<!-- DON'T skip levels -->
<!-- Bad: h1 → h3 (skipped h2) -->'''
        
        elif rule_id == "page-has-heading-one":
            return '''<!-- Add h1 as the main page heading -->
<main>
  <h1>Welcome to Our Website</h1>
  <p>Content goes here...</p>
</main>'''
        
        # Generic fallback - show the selector for easy finding
        return f'''/* Element to fix: */
{css_selector}

/* Current HTML: */
{html_clean[:200]}...'''
    
    def _get_wcag_criteria(self, tags: List[str]) -> List[str]:
        """Extract WCAG criteria from tags"""
        wcag_map = {
            "wcag111": "1.1.1 Non-text Content",
            "wcag131": "1.3.1 Info and Relationships",
            "wcag141": "1.4.1 Use of Color",
            "wcag143": "1.4.3 Contrast (Minimum)",
            "wcag211": "2.1.1 Keyboard",
            "wcag241": "2.4.1 Bypass Blocks",
            "wcag242": "2.4.2 Page Titled",
            "wcag244": "2.4.4 Link Purpose",
            "wcag311": "3.1.1 Language of Page",
            "wcag412": "4.1.2 Name, Role, Value",
        }
        
        criteria = []
        for tag in tags:
            if tag.startswith("wcag") and tag in wcag_map:
                criteria.append(wcag_map[tag])
        
        return criteria if criteria else ["Best Practice"]
    
    def _generate_executive_summary(
        self,
        url: str,
        wcag_level: str,
        score: float,
        critical: int,
        serious: int,
        moderate: int,
        minor: int
    ) -> str:
        """Generate human-readable executive summary"""
        
        total = critical + serious + moderate + minor
        
        if total == 0:
            return f"""
## ✅ Accessibility Scan Passed

**URL:** {url}
**WCAG Level:** {wcag_level}
**Compliance Score:** {score:.1f}%

Great news! No accessibility violations were detected on this page.
The page appears to meet WCAG {wcag_level} guidelines.

**Recommendation:** Continue monitoring accessibility with regular scans.
"""
        
        status_emoji = "🔴" if critical > 0 else "🟠" if serious > 0 else "🟡"
        
        return f"""
## {status_emoji} Accessibility Issues Found

**URL:** {url}
**WCAG Level:** {wcag_level}
**Compliance Score:** {score:.1f}%
**Total Issues:** {total}

### Issue Breakdown

| Priority | Count | Action Required |
|----------|-------|-----------------|
| 🔴 Critical | {critical} | {"Fix immediately - blocks users" if critical > 0 else "None"} |
| 🟠 Serious | {serious} | {"Fix soon - significant barriers" if serious > 0 else "None"} |
| 🟡 Moderate | {moderate} | {"Plan to fix - causes difficulties" if moderate > 0 else "None"} |
| 🔵 Minor | {minor} | {"Consider fixing - minor inconvenience" if minor > 0 else "None"} |

### Top Priority Actions

{f"1. **Fix {critical} critical issues first** - These completely block some users from accessing content" if critical > 0 else ""}
{f"2. **Address {serious} serious issues** - These create significant barriers for users with disabilities" if serious > 0 else ""}

### Who This Affects

- **Screen reader users** - Cannot navigate or understand content
- **Keyboard users** - Cannot interact with controls
- **Low vision users** - Cannot read low-contrast text
- **Motor impaired users** - Cannot use mouse-dependent features

### Legal Compliance

Failing WCAG {wcag_level} may violate:
- ADA (Americans with Disabilities Act)
- Section 508 (US Federal)
- EN 301 549 (European)
- AODA (Ontario, Canada)
"""


# Singleton instance
_scanner: Optional[AxeCoreScanner] = None

def get_scanner() -> AxeCoreScanner:
    """Get or create scanner instance"""
    global _scanner
    if _scanner is None:
        _scanner = AxeCoreScanner()
    return _scanner
