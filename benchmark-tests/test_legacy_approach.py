"""
Legacy Test Approach - Demonstrates Failure Modes
These tests use brittle selectors (Layer 4/5) that break easily.
"""

from playwright.sync_api import sync_playwright, expect
import time

BASE_URL = "http://localhost:8080/benchmark-app/index.html"

def test_scenario_1_legacy():
    """Scenario 1: Trading Portal - FAILS due to dynamic ID"""
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False)
        page = browser.new_page()
        page.goto(BASE_URL)
        
        # Click to open modal
        page.click("text=Open Order Modal")
        time.sleep(1)
        
        # Select asset
        page.select_option("#asset-select", "AAPL")
        time.sleep(0.5)
        
        # Enter price - THIS TRIGGERS RE-RENDER
        page.fill("#order-price", "150.00")
        time.sleep(0.5)
        
        # Try to click submit - FAILS because ID changed!
        # Legacy approach uses the ID directly
        page.click("#submit-btn-dynamic")  # ❌ This ID no longer exists!
        
        browser.close()

def test_scenario_2_legacy():
    """Scenario 2: CMS - FAILS due to pixel coordinates"""
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False)
        page = browser.new_page()
        page.goto(BASE_URL)
        
        # Legacy approach uses pixel coordinates
        source = page.locator("text=Image Block")
        target = page.locator("text=Drop blocks here")
        
        # Get bounding boxes
        source_box = source.bounding_box()
        target_box = target.bounding_box()
        
        # Drag using pixel coordinates - BREAKS if window size changes!
        page.mouse.move(source_box['x'] + source_box['width']/2, source_box['y'] + source_box['height']/2)
        page.mouse.down()
        page.mouse.move(target_box['x'] + target_box['width']/2, target_box['y'] + target_box['height']/2)
        page.mouse.up()
        
        browser.close()

def test_scenario_3_legacy():
    """Scenario 3: CRM - FAILS due to XPath indexing"""
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False)
        page = browser.new_page()
        page.goto(BASE_URL)
        
        # Filter
        page.select_option("#status-filter", "open")
        time.sleep(1)
        
        # Legacy approach uses XPath with index - BREAKS with virtualization!
        # Try to click 10th row
        page.click("//tr[10]/td[4]/button")  # ❌ Row 10 might not be in DOM!
        
        browser.close()

def test_scenario_4_legacy():
    """Scenario 4: Insurance - FAILS due to race condition"""
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False)
        page = browser.new_page()
        page.goto(BASE_URL)
        
        # Enter amount
        page.fill("#coverage-amount", "100000")
        
        # Legacy approach clicks immediately - BREAKS if button still disabled!
        page.click("#next-btn")  # ❌ Race condition - button might be disabled!
        
        browser.close()

def test_scenario_5_legacy():
    """Scenario 5: iFrame - FAILS due to generic ID"""
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False)
        page = browser.new_page()
        page.goto(BASE_URL)
        
        # Load iframe
        page.click("text=Load Consent Form")
        time.sleep(2)
        
        # Legacy approach uses generic ID - BREAKS!
        frame = page.frame_locator("#frame-async")  # ❌ Generic ID might change
        frame.locator("#consent-checkbox").check()
        
        browser.close()

if __name__ == "__main__":
    print("Running Legacy Tests (These will fail)...")
    try:
        test_scenario_1_legacy()
    except Exception as e:
        print(f"❌ Scenario 1 Failed: {e}")
    
    try:
        test_scenario_2_legacy()
    except Exception as e:
        print(f"❌ Scenario 2 Failed: {e}")
    
    try:
        test_scenario_3_legacy()
    except Exception as e:
        print(f"❌ Scenario 3 Failed: {e}")
    
    try:
        test_scenario_4_legacy()
    except Exception as e:
        print(f"❌ Scenario 4 Failed: {e}")
    
    try:
        test_scenario_5_legacy()
    except Exception as e:
        print(f"❌ Scenario 5 Failed: {e}")

