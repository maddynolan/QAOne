"""
Standalone axe-core scanner script - runs in separate process
to avoid Windows asyncio subprocess issues with Playwright
"""

import sys
import json


def run_axe_scan(url: str, component_selector: str = None):
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
            
            # Configure axe options
            axe_options = {
                "runOnly": {
                    "type": "tag",
                    "values": ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"]
                }
            }
            
            # Run axe-core scan
            if component_selector:
                axe_result = page.evaluate(f"""
                    async () => {{
                        const element = document.querySelector('{component_selector}');
                        if (!element) return {{ violations: [], error: 'Component not found' }};
                        return await axe.run(element, {json.dumps(axe_options)});
                    }}
                """)
            else:
                axe_result = page.evaluate(f"""
                    async () => {{
                        return await axe.run(document, {json.dumps(axe_options)});
                    }}
                """)
            
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
    component_selector = sys.argv[2] if len(sys.argv) > 2 else None
    
    result = run_axe_scan(url, component_selector)
    print(json.dumps(result))

