"""
Standalone axe-core scanner script - runs in separate process
to avoid Windows asyncio subprocess issues with Playwright
"""

import sys
import json
import logging

logger = logging.getLogger(__name__)

# Valid parameter values for input validation
VALID_WCAG_LEVELS = {"A", "AA", "AAA"}
VALID_WCAG_VERSIONS = {"2.0", "2.1", "2.2"}


def _build_wcag_tags(wcag_level: str = "AA", wcag_version: str = "2.1") -> list:
    """Build axe-core WCAG tag list from level and version parameters.

    axe-core tags: wcag2a, wcag2aa, wcag2aaa, wcag21a, wcag21aa, wcag22aa, best-practice
    """
    tags = ["best-practice"]
    level = wcag_level.upper() if wcag_level.upper() in VALID_WCAG_LEVELS else "AA"
    version = wcag_version.strip() if wcag_version.strip() in VALID_WCAG_VERSIONS else "2.1"

    # WCAG 2.0 base tags
    tags.append("wcag2a")
    if level in ("AA", "AAA"):
        tags.append("wcag2aa")
    if level == "AAA":
        tags.append("wcag2aaa")

    # WCAG 2.1 additional tags
    if version in ("2.1", "2.2"):
        tags.append("wcag21a")
        if level in ("AA", "AAA"):
            tags.append("wcag21aa")

    # WCAG 2.2 additional tags
    if version == "2.2":
        tags.append("wcag22aa")

    return tags


def _fetch_axe_core_script():
    """Fetch axe-core JS source and cache it for inline injection.
    This avoids CSP issues that block CDN script tags on many websites."""
    import urllib.request
    import os

    cache_path = os.path.join(os.path.dirname(__file__), ".axe_core_cache.js")

    # Use cached version if it exists and is non-empty
    if os.path.exists(cache_path) and os.path.getsize(cache_path) > 1000:
        try:
            with open(cache_path, "r", encoding="utf-8") as f:
                return f.read()
        except (IOError, OSError) as read_err:
            logger.warning(f"Failed to read axe-core cache: {read_err}")
            pass

    # Download from CDN
    cdn_urls = [
        "https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.8.4/axe.min.js",
        "https://unpkg.com/axe-core@4.8.4/axe.min.js",
    ]
    for cdn_url in cdn_urls:
        try:
            req = urllib.request.Request(cdn_url, headers={"User-Agent": "Flowstral-Scanner/1.0"})
            with urllib.request.urlopen(req, timeout=15) as resp:
                script_content = resp.read().decode("utf-8")
                if len(script_content) > 1000:
                    # Cache for future use
                    try:
                        with open(cache_path, "w", encoding="utf-8") as f:
                            f.write(script_content)
                    except Exception:
                        pass
                    return script_content
        except Exception as cdn_err:
            logger.warning(f"Failed to fetch axe-core from {cdn_url}: {cdn_err}")
            continue

    return None


def run_axe_scan(url: str, component_selector: str = None, wcag_level: str = "AA", wcag_version: str = "2.1"):
    """Run axe-core scan using Playwright sync API"""
    # Validate inputs
    if not url or not isinstance(url, str):
        return {"violations": [], "html": "", "error": "URL is required"}
    if len(url) > 2048:
        return {"violations": [], "html": "", "error": "URL exceeds maximum length (2048 characters)"}
    if wcag_level.upper() not in VALID_WCAG_LEVELS:
        wcag_level = "AA"
    if wcag_version.strip() not in VALID_WCAG_VERSIONS:
        wcag_version = "2.1"
    if component_selector and len(component_selector) > 500:
        return {"violations": [], "html": "", "error": "Component selector exceeds maximum length (500 characters)"}

    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        return {"violations": [], "html": "", "error": "Playwright not installed. Install with: pip install playwright && python -m playwright install chromium"}

    violations = []
    html_content = ""

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            try:
                context = browser.new_context(
                    viewport={"width": 1920, "height": 1080},
                    user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
                )
                page = context.new_page()

                # Navigate to URL — use domcontentloaded instead of networkidle to avoid
                # hanging on pages with long-polling, SSE, or slow third-party scripts.
                # Then wait a short additional time for JS rendering.
                try:
                    page.goto(url, timeout=30000, wait_until="domcontentloaded")
                    # Give JS frameworks a moment to render
                    page.wait_for_timeout(2000)
                except Exception as nav_err:
                    # If domcontentloaded also fails, try with commit (bare minimum)
                    try:
                        page.goto(url, timeout=30000, wait_until="commit")
                        page.wait_for_timeout(3000)
                    except Exception:
                        return {"violations": [], "html": "", "error": f"Failed to navigate to URL: {str(nav_err)[:200]}"}

                # Get HTML content
                html_content = page.content()

                # Inject axe-core — try inline injection first (bypasses CSP), then CDN fallback
                axe_injected = False

                # Method 1: Inline injection (CSP-safe — uses page.evaluate to inject script content directly)
                axe_source = _fetch_axe_core_script()
                if axe_source:
                    try:
                        page.evaluate(axe_source)
                        # Verify it loaded
                        is_loaded = page.evaluate("typeof axe !== 'undefined'")
                        if is_loaded:
                            axe_injected = True
                    except Exception as inline_err:
                        logger.debug(f"Inline axe injection failed, trying CDN: {inline_err}")

                # Method 2: CDN script tag (works when CSP allows it)
                if not axe_injected:
                    try:
                        page.add_script_tag(url="https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.8.4/axe.min.js")
                        page.wait_for_function("typeof axe !== 'undefined'", timeout=10000)
                        axe_injected = True
                    except Exception as cdn_err:
                        logger.debug(f"CDN axe injection failed: {cdn_err}")

                if not axe_injected:
                    return {"violations": [], "html": html_content, "error": "Failed to inject axe-core (CSP may be blocking scripts). HTML content was captured for basic analysis."}

                # Build WCAG tag list based on level and version
                wcag_tags = _build_wcag_tags(wcag_level, wcag_version)

                # Configure axe options
                axe_options = {
                    "runOnly": {
                        "type": "tag",
                        "values": wcag_tags
                    }
                }

                # Run axe-core scan
                if component_selector:
                    axe_result = page.evaluate("""
                        async ([selector, options]) => {
                            const element = document.querySelector(selector);
                            if (!element) return { violations: [], error: 'Component not found' };
                            return await axe.run(element, options);
                        }
                    """, [component_selector, axe_options])
                else:
                    axe_result = page.evaluate("""
                        async (options) => {
                            return await axe.run(document, options);
                        }
                    """, axe_options)

                violations = axe_result.get("violations", [])

            finally:
                # Always close browser to prevent resource leaks
                try:
                    browser.close()
                except Exception:
                    pass

    except Exception as e:
        # Do not leak internal error details — log full error, return sanitized message
        logger.error(f"Axe-core scan error: {e}", exc_info=True)
        return {"violations": [], "html": html_content, "error": "Axe-core scanner encountered an unexpected error"}

    return {"violations": violations, "html": html_content}


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"error": "URL required"}))
        sys.exit(1)

    url = sys.argv[1]
    component_selector = sys.argv[2] if len(sys.argv) > 2 and sys.argv[2] != "None" else None
    wcag_level = sys.argv[3] if len(sys.argv) > 3 else "AA"
    wcag_version = sys.argv[4] if len(sys.argv) > 4 else "2.1"

    result = run_axe_scan(url, component_selector, wcag_level, wcag_version)
    print(json.dumps(result))

