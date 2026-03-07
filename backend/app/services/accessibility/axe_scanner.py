"""
Standalone axe-core scanner script - runs in separate process
to avoid Windows asyncio subprocess issues with Playwright
"""

import sys
import json


def _build_wcag_tags(wcag_level: str = "AA", wcag_version: str = "2.1") -> list:
    """Build axe-core WCAG tag list from level and version parameters.

    axe-core tags: wcag2a, wcag2aa, wcag2aaa, wcag21a, wcag21aa, wcag22aa, best-practice
    """
    tags = ["best-practice"]
    level = wcag_level.upper()
    version = wcag_version.strip()

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


def run_axe_scan(url: str, component_selector: str = None, wcag_level: str = "AA", wcag_version: str = "2.1"):
    """Run axe-core scan using Playwright sync API"""
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        return {"violations": [], "html": "", "error": "Playwright not installed"}

    violations = []
    html_content = ""

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context()
            page = context.new_page()

            # Navigate to URL with timeout
            page.goto(url, timeout=30000, wait_until="networkidle")

            # Get HTML content
            html_content = page.content()

            # Inject and run axe-core
            page.add_script_tag(url="https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.8.4/axe.min.js")

            # Wait for axe to load
            page.wait_for_function("typeof axe !== 'undefined'", timeout=10000)

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
            
            browser.close()
            
    except Exception as e:
        return {"violations": [], "html": html_content, "error": str(e)}
    
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

