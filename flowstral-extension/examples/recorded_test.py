import pytest
from playwright.sync_api import Page, expect


def test_complete_checkout_flow(page: Page):
    """
    E-commerce Checkout Flow
    Recorded on: 2024-01-15T14:30:00.000Z
    Starting URL: https://demo.store.com/
    
    This test demonstrates the quality of generated Python scripts from
    Playwright Recorder Pro. Notice the smart selectors and intelligent waits.
    """
    # Navigate to starting URL
    page.goto("https://demo.store.com/")
    page.wait_for_load_state("networkidle")

    # Click "Shop Now" button on hero banner
    page.get_by_role("button", name="Shop Now").click()
    page.wait_for_load_state("domcontentloaded")

    # Click product card for "Premium Headphones"
    page.get_by_role("link", name="Premium Headphones").click()
    page.wait_for_load_state("networkidle")

    # Select color option
    page.get_by_label("Color").select_option(label="Midnight Black")

    # Fill quantity input
    page.get_by_label("Quantity").fill("2")

    # Click "Add to Cart" button
    page.get_by_role("button", name="Add to Cart").click()
    page.wait_for_load_state("domcontentloaded")

    # Assert cart badge shows correct count
    expect(page.get_by_test_id("cart-count")).to_have_text("2")

    # Click cart icon to open cart
    page.get_by_role("button", name="View Cart").click()
    page.wait_for_load_state("domcontentloaded")

    # Click "Proceed to Checkout" button
    page.get_by_role("button", name="Proceed to Checkout").click()
    page.wait_for_load_state("networkidle")

    # Fill shipping information
    # Fill "First Name" input
    page.get_by_label("First Name").fill("John")

    # Fill "Last Name" input
    page.get_by_label("Last Name").fill("Doe")

    # Fill "Email" input
    page.get_by_label("Email").fill("john.doe@example.com")

    # Fill "Address" input
    page.get_by_label("Street Address").fill("123 Main Street")

    # Fill "City" input
    page.get_by_label("City").fill("San Francisco")

    # Select state
    page.get_by_label("State").select_option(label="California")

    # Fill "ZIP Code" input
    page.get_by_label("ZIP Code").fill("94102")

    # Click "Continue to Payment" button
    page.get_by_role("button", name="Continue to Payment").click()
    page.wait_for_load_state("networkidle")

    # Fill payment information (in iframe)
    payment_frame = page.frame_locator('[data-testid="payment-iframe"]')
    
    # Fill card number
    payment_frame.get_by_label("Card Number").fill("4111111111111111")

    # Fill expiry date
    payment_frame.get_by_label("Expiry").fill("12/25")

    # Fill CVV
    payment_frame.get_by_label("CVV").fill("123")

    # Click "Place Order" button
    page.get_by_role("button", name="Place Order").click()
    page.wait_for_load_state("networkidle")

    # Assert order confirmation
    expect(page.get_by_role("heading", name="Order Confirmed!")).to_be_visible()
    expect(page.get_by_test_id("order-number")).to_be_visible()

    # Take screenshot on completion
    page.screenshot(path="test-results/checkout-complete.png", full_page=True)


def test_login_form_validation(page: Page):
    """
    Login with validation errors
    Demonstrates error handling scenarios
    """
    page.goto("https://demo.store.com/login")
    page.wait_for_load_state("networkidle")

    # Submit empty form to trigger validation
    page.get_by_role("button", name="Sign In").click()

    # Assert validation errors appear
    expect(page.get_by_text("Email is required")).to_be_visible()
    expect(page.get_by_text("Password is required")).to_be_visible()

    # Fill invalid email
    page.get_by_label("Email").fill("invalid-email")
    page.get_by_role("button", name="Sign In").click()

    # Assert email format error
    expect(page.get_by_text("Please enter a valid email")).to_be_visible()

    # Fill valid credentials
    page.get_by_label("Email").fill("user@example.com")
    page.get_by_label("Password").fill("password123")

    # Click "Sign In" button
    page.get_by_role("button", name="Sign In").click()
    page.wait_for_load_state("networkidle")

    # Assert successful login
    expect(page).to_have_url(".*dashboard")
    expect(page.get_by_text("Welcome back")).to_be_visible()


def test_search_and_filter_products(page: Page):
    """
    Search and filter products
    Demonstrates complex user interactions
    """
    page.goto("https://demo.store.com/products")
    page.wait_for_load_state("networkidle")

    # Use search functionality
    page.get_by_placeholder("Search products...").fill("headphones")
    page.get_by_placeholder("Search products...").press("Enter")
    page.wait_for_load_state("networkidle")

    # Apply price filter
    page.get_by_label("Min Price").fill("50")
    page.get_by_label("Max Price").fill("200")
    page.get_by_role("button", name="Apply Filters").click()
    page.wait_for_load_state("domcontentloaded")

    # Check category filter
    page.get_by_label("Wireless").check()
    page.wait_for_load_state("domcontentloaded")

    # Sort by price
    page.get_by_label("Sort by").select_option(label="Price: Low to High")
    page.wait_for_load_state("domcontentloaded")

    # Hover over first product to see quick view
    page.get_by_test_id("product-card").first.hover()
    expect(page.get_by_role("button", name="Quick View")).to_be_visible()

    # Click quick view
    page.get_by_role("button", name="Quick View").click()
    
    # Assert modal appears
    expect(page.get_by_role("dialog")).to_be_visible()

    # Press Escape to close modal
    page.keyboard.press("Escape")
    expect(page.get_by_role("dialog")).not_to_be_visible()
