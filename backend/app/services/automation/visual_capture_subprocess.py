"""
Visual Testing Screenshot Capture — Subprocess Script

Runs Playwright in a separate process to avoid Windows asyncio event loop
incompatibilities with uvicorn. Outputs JSON to stdout.

Usage:
    python visual_capture_subprocess.py <url> <viewport_width> <viewport_height> <full_page> [wait_for_selector]
"""

import sys
import json
import base64


def capture(url: str, viewport_width: int, viewport_height: int, full_page: bool, wait_for_selector: str = None):
    """Capture a screenshot using Playwright sync API (runs in its own process)."""
    from playwright.sync_api import sync_playwright

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            viewport={"width": viewport_width, "height": viewport_height}
        )
        page = context.new_page()

        # Navigate — try networkidle first (fast sites), fall back to domcontentloaded
        try:
            page.goto(url, wait_until="networkidle", timeout=15000)
        except Exception:
            page.goto(url, wait_until="domcontentloaded", timeout=30000)

        # Wait for specific selector if requested
        if wait_for_selector and wait_for_selector != "None":
            page.wait_for_selector(wait_for_selector, timeout=10000)

        # Allow time for CSS animations, lazy-loaded images
        page.wait_for_timeout(2000)

        # Capture screenshot
        screenshot_bytes = page.screenshot(full_page=full_page)

        browser.close()

    return screenshot_bytes


def main():
    if len(sys.argv) < 5:
        print(json.dumps({"error": "Usage: visual_capture_subprocess.py <url> <viewport_w> <viewport_h> <full_page> [wait_for_selector]"}))
        sys.exit(1)

    url = sys.argv[1]
    viewport_width = int(sys.argv[2])
    viewport_height = int(sys.argv[3])
    full_page = sys.argv[4].lower() == "true"
    wait_for_selector = sys.argv[5] if len(sys.argv) > 5 else None

    try:
        screenshot_bytes = capture(url, viewport_width, viewport_height, full_page, wait_for_selector)
        result = {
            "success": True,
            "screenshot_base64": base64.b64encode(screenshot_bytes).decode("utf-8"),
            "size": len(screenshot_bytes),
        }
        print(json.dumps(result))
    except Exception as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(1)


if __name__ == "__main__":
    main()
