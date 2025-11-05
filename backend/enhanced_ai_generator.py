"""
Enhanced AI Test Generator
Generates actual code (Playwright, API tests) and manual test steps
"""

import re
from typing import Dict, List, Any, Optional

# Real test websites for demos
TEST_WEBSITES = {
    "saucedemo": {
        "url": "https://www.saucedemo.com",
        "type": "e-commerce",
        "features": ["login", "shopping", "checkout"]
    },
    "parabank": {
        "url": "https://parabank.parasoft.com",
        "type": "banking",
        "features": ["login", "account", "transfer"]
    },
    "demoblaze": {
        "url": "https://www.demoblaze.com",
        "type": "e-commerce",
        "features": ["shopping", "cart", "checkout"]
    }
}

def generate_playwright_code(requirements: str, context: Dict[str, Any]) -> str:
    """Generate actual Playwright test code"""
    
    app_url = context.get("app_url", "https://www.saucedemo.com")
    test_name = requirements[:50].replace(" ", "_")
    
    # Detect test website type
    website_type = "generic"
    for site_name, site_info in TEST_WEBSITES.items():
        if site_name in app_url.lower() or site_info["url"] in app_url:
            website_type = site_info["type"]
            break
    
    code_template = f'''import {{ test, expect }} from '@playwright/test';

test.describe('{requirements[:50]}', () => {{
  test('{requirements}', async ({{ page }}) => {{
    // Navigate to application
    await page.goto('{app_url}');
'''
    
    # Generate code based on requirements
    requirements_lower = requirements.lower()
    
    if "login" in requirements_lower or "authentication" in requirements_lower:
        if "saucedemo" in app_url:
            code_template += '''    // Login steps
    await page.fill('[data-test="username"]', 'standard_user');
    await page.fill('[data-test="password"]', 'secret_sauce');
    await page.click('[data-test="login-button"]');
    
    // Verify login success
    await expect(page.locator('.inventory_container')).toBeVisible();
'''
        else:
            code_template += '''    // Login steps
    await page.fill('input[name="username"], #username', 'testuser');
    await page.fill('input[name="password"], #password', 'password123');
    await page.click('button[type="submit"], .login-button');
    
    // Verify login success
    await expect(page.locator('.dashboard, .welcome')).toBeVisible();
'''
    
    if "checkout" in requirements_lower or "cart" in requirements_lower:
        if "saucedemo" in app_url:
            code_template += '''    // Add item to cart
    await page.click('[data-test="add-to-cart-sauce-labs-backpack"]');
    await page.click('.shopping_cart_link');
    
    // Proceed to checkout
    await page.click('[data-test="checkout"]');
    
    // Fill checkout information
    await page.fill('[data-test="firstName"]', 'John');
    await page.fill('[data-test="lastName"]', 'Doe');
    await page.fill('[data-test="postalCode"]', '12345');
    await page.click('[data-test="continue"]');
    await page.click('[data-test="finish"]');
    
    // Verify order completion
    await expect(page.locator('[data-test="complete-header"]')).toContainText('Thank you');
'''
        else:
            code_template += '''    // Add item to cart
    await page.click('.add-to-cart, [data-testid="add-to-cart"]');
    await page.click('.cart-icon, #cart');
    
    // Proceed to checkout
    await page.click('#checkout, .checkout-btn');
    
    // Fill checkout information
    await page.fill('input[name="firstName"], #firstName', 'John');
    await page.fill('input[name="lastName"], #lastName', 'Doe');
    await page.fill('input[name="email"], #email', 'john.doe@example.com');
    await page.fill('input[name="address"], #address', '123 Main St');
    await page.fill('input[name="zip"], #zipCode', '12345');
    await page.click('button[type="submit"], #submit-order');
    
    // Verify order completion
    await expect(page.locator('.order-confirmation, .success')).toBeVisible();
'''
    
    if "search" in requirements_lower:
        code_template += '''    // Search functionality
    await page.fill('input[type="search"], #search-input', 'laptop');
    await page.click('button[type="submit"], .search-button');
    
    // Verify search results
    await expect(page.locator('.search-results, .product-list')).toBeVisible();
'''
    
    # Default generic test
    if not any(keyword in requirements_lower for keyword in ["login", "checkout", "cart", "search"]):
        code_template += '''    // Verify page loaded
    await expect(page).toHaveTitle(/.*/);
    
    // Add your test steps here
'''
    
    code_template += '''  }});
}});
'''
    
    return code_template

def generate_manual_test_steps(requirements: str, context: Dict[str, Any]) -> List[Dict[str, str]]:
    """Generate manual test steps in natural language"""
    
    requirements_lower = requirements.lower()
    app_url = context.get("app_url", "https://www.saucedemo.com")
    
    steps = []
    
    if "login" in requirements_lower:
        steps.extend([
            {
                "step_number": len(steps) + 1,
                "action": f"Navigate to {app_url}",
                "expected_result": "Application home page loads successfully",
                "notes": "Wait for page to fully load"
            },
            {
                "step_number": len(steps) + 2,
                "action": "Locate and enter username in the username field",
                "expected_result": "Username field accepts input",
                "notes": "Use standard_user for saucedemo.com"
            },
            {
                "step_number": len(steps) + 3,
                "action": "Enter password in the password field",
                "expected_result": "Password field accepts input and masks characters",
                "notes": "Use secret_sauce for saucedemo.com"
            },
            {
                "step_number": len(steps) + 4,
                "action": "Click the Login button",
                "expected_result": "User is redirected to dashboard/inventory page",
                "notes": "Verify successful login"
            },
            {
                "step_number": len(steps) + 5,
                "action": "Verify user is logged in successfully",
                "expected_result": "Dashboard or inventory page is displayed with user-specific content",
                "notes": "Check for login confirmation elements"
            }
        ])
    
    if "checkout" in requirements_lower or "cart" in requirements_lower:
        steps.extend([
            {
                "step_number": len(steps) + 1,
                "action": "Add a product to the shopping cart",
                "expected_result": "Product is added to cart and cart icon shows item count",
                "notes": "Select any available product"
            },
            {
                "step_number": len(steps) + 2,
                "action": "Click on the shopping cart icon",
                "expected_result": "Cart page displays with added items",
                "notes": "Verify all items are visible"
            },
            {
                "step_number": len(steps) + 3,
                "action": "Click Checkout button",
                "expected_result": "Checkout form is displayed",
                "notes": "Wait for form to load"
            },
            {
                "step_number": len(steps) + 4,
                "action": "Fill in shipping information (First Name, Last Name, ZIP code)",
                "expected_result": "All required fields accept input",
                "notes": "Use test data: John, Doe, 12345"
            },
            {
                "step_number": len(steps) + 5,
                "action": "Click Continue button",
                "expected_result": "Review page displays order summary",
                "notes": "Verify order details are correct"
            },
            {
                "step_number": len(steps) + 6,
                "action": "Click Finish button to complete order",
                "expected_result": "Order confirmation page displays success message",
                "notes": "Verify 'Thank you' or confirmation message"
            }
        ])
    
    return steps

def generate_api_test_code(requirements: str, context: Dict[str, Any]) -> str:
    """Generate API test code"""
    
    api_base_url = context.get("api_url", "https://api.example.com")
    requirements_lower = requirements.lower()
    
    code_template = f'''import {{ test, expect }} from '@playwright/test';

test.describe('API Tests - {requirements[:50]}', () => {{
  const baseURL = '{api_base_url}';
  
  test('{requirements}', async ({{ request }}) => {{
'''
    
    if "login" in requirements_lower or "authentication" in requirements_lower:
        code_template += '''    // Login API test
    const loginResponse = await request.post(`${baseURL}/auth/login`, {
      data: {
        username: 'testuser',
        password: 'password123'
      }
    });
    
    expect(loginResponse.ok()).toBeTruthy();
    const loginBody = await loginResponse.json();
    expect(loginBody).toHaveProperty('token');
    const token = loginBody.token;
'''
    
    if "get" in requirements_lower or "fetch" in requirements_lower:
        code_template += f'''    // GET request test
    const getResponse = await request.get(`${{baseURL}}/users`, {{
      headers: {{
        'Authorization': `Bearer ${{token}}`
      }}
    }});
    
    expect(getResponse.ok()).toBeTruthy();
    const users = await getResponse.json();
    expect(Array.isArray(users)).toBeTruthy();
'''
    
    if "post" in requirements_lower or "create" in requirements_lower:
        code_template += f'''    // POST request test
    const postResponse = await request.post(`${{baseURL}}/users`, {{
      data: {{
        name: 'John Doe',
        email: 'john.doe@example.com'
      }},
      headers: {{
        'Authorization': `Bearer ${{token}}`,
        'Content-Type': 'application/json'
      }}
    }});
    
    expect(postResponse.ok()).toBeTruthy();
    const newUser = await postResponse.json();
    expect(newUser).toHaveProperty('id');
'''
    
    code_template += '''  });
});
'''
    
    return code_template

def get_suggested_test_websites(requirements: str) -> List[Dict[str, str]]:
    """Suggest test websites based on requirements"""
    
    requirements_lower = requirements.lower()
    suggestions = []
    
    for site_name, site_info in TEST_WEBSITES.items():
        if any(feature in requirements_lower for feature in site_info["features"]):
            suggestions.append({
                "name": site_name.title(),
                "url": site_info["url"],
                "type": site_info["type"],
                "features": ", ".join(site_info["features"])
            })
    
    if not suggestions:
        suggestions.append({
            "name": "SauceDemo",
            "url": "https://www.saucedemo.com",
            "type": "e-commerce",
            "features": "login, shopping, checkout"
        })
    
    return suggestions




