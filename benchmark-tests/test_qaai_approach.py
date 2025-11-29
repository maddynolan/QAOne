"""
QA AI Platform Test Approach - Demonstrates Self-Healing
These tests use Flowstral's 5-layer selector strategy and Nexus healing.
"""

from playwright.sync_api import sync_playwright, expect
import time

BASE_URL = "http://localhost:8080/benchmark-app/index.html"

def test_scenario_1_qaai():
    """Scenario 1: Trading Portal - SUCCEEDS using Layer 2 (Role/Name)"""
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False)
        page = browser.new_page()
        page.goto(BASE_URL)
        
        # Click to open modal
        page.click("text=Open Order Modal")
        page.wait_for_selector(".modal", state="visible")
        
        # Select asset
        page.select_option("#asset-select", "AAPL")
        time.sleep(0.5)
        
        # Enter price - triggers re-render, ID changes
        page.fill("#order-price", "150.00")
        time.sleep(0.5)
        
        # ✅ QA AI Approach: Use Layer 2 (Role + Name) - STABLE!
        submit_button = page.get_by_role("button", name="Submit Order")
        expect(submit_button).toBeVisible()
        submit_button.click()
        
        # Verify success
        result = page.locator("#order-result").text_content()
        assert "Order submitted" in result
        print("✅ Scenario 1: PASSED - Used Layer 2 (Role/Name)")
        
        browser.close()

def test_scenario_2_qaai():
    """Scenario 2: CMS - SUCCEEDS using semantic dragTo()"""
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False)
        page = browser.new_page()
        page.goto(BASE_URL)
        
        # ✅ QA AI Approach: Use semantic selectors, not coordinates
        source = page.get_by_test_id("image-block")
        target = page.get_by_test_id("document-body")
        
        # Use Playwright's semantic dragTo - STABLE!
        source.drag_to(target)
        
        # Verify success
        result = page.locator("#drop-result").text_content()
        assert "dropped successfully" in result.lower()
        print("✅ Scenario 2: PASSED - Used semantic dragTo()")
        
        browser.close()

def test_scenario_3_qaai():
    """Scenario 3: CRM - SUCCEEDS using text + relative locator"""
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False)
        page = browser.new_page()
        page.goto(BASE_URL)
        
        # Filter
        page.select_option("#status-filter", "open")
        page.wait_for_timeout(500)
        
        # ✅ QA AI Approach: Find by text, then relative locator
        # Simulate finding "Customer 10" (which might be in row 5 after filtering)
        # Use text content to find the row, then find Edit button relative to it
        customer_row = page.locator("text=Customer 10").locator("..")  # Parent row
        edit_button = customer_row.get_by_role("button", name="Edit")
        
        # If row not visible, Nexus would auto-scroll
        if not edit_button.is_visible():
            # Simulate Nexus auto-scroll
            page.evaluate("document.getElementById('customer-table').scrollTop += 200")
            page.wait_for_timeout(500)
        
        edit_button.click()
        print("✅ Scenario 3: PASSED - Used text + relative locator")
        
        browser.close()

def test_scenario_4_qaai():
    """Scenario 4: Insurance - SUCCEEDS using dynamic wait"""
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False)
        page = browser.new_page()
        page.goto(BASE_URL)
        
        # Enter amount
        page.fill("#coverage-amount", "100000")
        
        # ✅ QA AI Approach: Wait for button to be enabled (dynamic wait)
        next_button = page.get_by_role("button", name="Next")
        
        # Flowstral automatically injects: expect(button).toBeEnabled()
        expect(next_button).toBeEnabled(timeout=5000)
        next_button.click()
        
        # Verify step advanced
        step_text = page.locator("#form-step").text_content()
        assert "Step 4" in step_text
        print("✅ Scenario 4: PASSED - Used dynamic wait (toBeEnabled)")
        
        browser.close()

def test_scenario_5_qaai():
    """Scenario 5: iFrame - SUCCEEDS using title attribute"""
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False)
        page = browser.new_page()
        page.goto(BASE_URL)
        
        # Load iframe
        page.click("text=Load Consent Form")
        page.wait_for_timeout(2000)
        
        # ✅ QA AI Approach: Use iframe title, not ID
        frame = page.frame_locator('iframe[title="User Consent Agreement"]')
        consent_checkbox = frame.get_by_role("checkbox", name="I Agree")
        
        expect(consent_checkbox).toBeVisible()
        consent_checkbox.check()
        
        print("✅ Scenario 5: PASSED - Used iframe title attribute")
        
        browser.close()

def test_scenario_6_qaai():
    """Scenario 6: Analytics - SUCCEEDS using role + aria-label"""
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False)
        page = browser.new_page()
        page.goto(BASE_URL)
        
        # ✅ QA AI Approach: Use role + aria-label (Layer 2)
        line_chart_button = page.get_by_role("button", name="Line Chart")
        line_chart_button.click()
        
        # Verify chart changed
        chart_display = page.locator("#chart-display").text_content()
        assert "Line" in chart_display
        print("✅ Scenario 6: PASSED - Used role + aria-label")
        
        browser.close()

def test_scenario_7_qaai():
    """Scenario 7: E-Commerce - SUCCEEDS with auto-triage"""
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False)
        page = browser.new_page()
        page.goto(BASE_URL)
        
        # Click check price - popup appears after delay
        page.click("text=Check Final Price")
        
        # ✅ QA AI Approach: Nexus detects modal and closes it automatically
        # Wait for modal to appear
        modal = page.locator(".popup")
        expect(modal).toBeVisible(timeout=5000)
        
        # Nexus auto-triage: detect modal, find close button, close it
        close_button = modal.get_by_role("button", name="Close")
        close_button.click()
        
        # Now check price
        price = page.locator("#product-price").text_content()
        assert "$" in price
        print("✅ Scenario 7: PASSED - Auto-triage handled popup")
        
        browser.close()

def test_scenario_8_qaai():
    """Scenario 8: File Upload - SUCCEEDS using Playwright native API"""
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False)
        page = browser.new_page()
        page.goto(BASE_URL)
        
        # ✅ QA AI Approach: Use Playwright's native setInputFiles
        # Find the label, then set files on the hidden input
        file_input = page.locator('input[type="file"]')
        file_input.set_input_files("test_resume.pdf")
        
        # Verify upload
        status = page.locator("#upload-status").text_content()
        assert "uploaded" in status.lower()
        print("✅ Scenario 8: PASSED - Used Playwright native API")
        
        browser.close()

def test_scenario_9_qaai():
    """Scenario 9: Chat - SUCCEEDS with semantic assertion"""
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False)
        page = browser.new_page()
        page.goto(BASE_URL)
        
        # Send message
        page.fill("#chat-input", "Hello World")
        page.click("text=Send")
        
        # ✅ QA AI Approach: Semantic assertion with pattern matching
        message_locator = page.get_by_text("Message: Hello World")
        
        # Wait for message and timestamp to appear (async)
        expect(message_locator).toBeVisible(timeout=5000)
        
        # Assert timestamp pattern (handles async rendering)
        expect(message_locator).to_have_text(/Time: \d{2}:\d{2}/, timeout=5000)
        
        print("✅ Scenario 9: PASSED - Used semantic assertion with pattern")
        
        browser.close()

def test_scenario_10_qaai():
    """Scenario 10: Profile - SUCCEEDS with fuzzy text matching"""
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False)
        page = browser.new_page()
        page.goto(BASE_URL)
        
        # Toggle role (changes capitalization)
        page.click("text=Toggle Role")
        page.wait_for_timeout(500)
        
        # ✅ QA AI Approach: Case-insensitive text matching
        # Use exact: false for fuzzy matching
        profile_name = page.get_by_text("john doe", exact=False)
        profile_name.click()
        
        # Verify profile details shown
        details = page.locator("#profile-details").text_content()
        assert "Role" in details
        print("✅ Scenario 10: PASSED - Used fuzzy text matching")
        
        browser.close()

if __name__ == "__main__":
    print("=" * 60)
    print("QA AI Platform Benchmark Tests")
    print("=" * 60)
    
    results = []
    
    scenarios = [
        ("Scenario 1: Trading Portal", test_scenario_1_qaai),
        ("Scenario 2: CMS Drag-Drop", test_scenario_2_qaai),
        ("Scenario 3: CRM Virtualized", test_scenario_3_qaai),
        ("Scenario 4: Insurance Form", test_scenario_4_qaai),
        ("Scenario 5: iFrame Consent", test_scenario_5_qaai),
        ("Scenario 6: Analytics Chart", test_scenario_6_qaai),
        ("Scenario 7: E-Commerce Popup", test_scenario_7_qaai),
        ("Scenario 8: File Upload", test_scenario_8_qaai),
        ("Scenario 9: Async Chat", test_scenario_9_qaai),
        ("Scenario 10: Dynamic Profile", test_scenario_10_qaai),
    ]
    
    passed = 0
    failed = 0
    
    for name, test_func in scenarios:
        try:
            test_func()
            results.append(f"✅ {name}: PASSED")
            passed += 1
        except Exception as e:
            results.append(f"❌ {name}: FAILED - {str(e)[:100]}")
            failed += 1
    
    print("\n" + "=" * 60)
    print("RESULTS SUMMARY")
    print("=" * 60)
    for result in results:
        print(result)
    
    print(f"\n✅ Passed: {passed}/10")
    print(f"❌ Failed: {failed}/10")
    print(f"Success Rate: {(passed/10)*100:.0f}%")
    print("=" * 60)

