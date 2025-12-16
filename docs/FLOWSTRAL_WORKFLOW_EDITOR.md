# Unified Test Builder (Workflow Editor)

> **Visual Test Case Builder with Multi-Export Capabilities**  
> Last Updated: December 2024

## Overview

The Unified Test Builder (`UnifiedWorkflowEditor.tsx`) is the primary interface for creating, editing, and executing test cases in QAAI. It replaces the legacy workflow editor with a more powerful, user-friendly experience.

### Key Features

| Feature | Description |
|---------|-------------|
| **No-Code / Code View** | Toggle between human-readable and technical views |
| **Multi-Export** | Export to Automation, API, Database, Performance, Manual |
| **Save / Save As** | Update existing test cases or create new ones |
| **Assertion Builder** | Structured UI for defining expected results |
| **Preconditions** | Import other test cases as setup steps |
| **Documentation** | Export to ISTQB, Gherkin/BDD, Markdown formats |
| **Duplicate Handling** | Detect and target specific elements with nth() |
| **Failure Detection** | Screenshots, error messages, failed step identification |

---

## Getting Started

### Accessing the Builder

1. **From Sidebar**: Click "Test Builder" in the navigation
2. **From Recorder**: Click "Open in Builder" after recording
3. **Direct URL**: Navigate to `/builder`

### Creating a Test Case

1. Enter a **Test Case Name** and **Description**
2. Set **Priority** (Critical, High, Medium, Low)
3. Add **Tags** for organization
4. Add steps using the "Add Step" button
5. Configure each step's action and target
6. Click **Save** to persist

---

## Views

### No-Code View (Default)

Human-readable test case display:

```
Step 1: Navigate to https://example.com
Step 2: Click: Login button
Step 3: Enter text "user@example.com" in Email field
Step 4: Enter text "password123" in Password field
Step 5: Click: Submit button
Step 6: Verify: Dashboard page loads
```

**Hidden in No-Code View:**
- Technical selectors (`getByRole`, CSS selectors)
- Framework-specific syntax
- Locator details

### Code View

Technical view with full selector details:

```
Step 1: Navigate
  URL: https://example.com

Step 2: Click
  Target: Login button
  Selector: page.getByRole('button', { name: 'Login' })

Step 3: Input
  Target: Email field
  Selector: page.getByLabel('Email')
  Value: user@example.com
```

---

## Step Types

### Navigate
Go to a URL.

| Property | Description |
|----------|-------------|
| URL | Target URL to navigate to |
| Expected Result | Optional verification after navigation |

### Click
Click on an element.

| Property | Description |
|----------|-------------|
| Target | Human-readable element description |
| Selector | Playwright locator (hidden in No-Code) |
| Element Index | For duplicate elements (0-indexed) |
| Expected Result | Optional verification after click |

### Input
Enter text in a field.

| Property | Description |
|----------|-------------|
| Target | Field description |
| Selector | Playwright locator |
| Value | Text to enter |
| Test Data | Auto-generated based on field type |

### Wait
Wait for time or element.

| Property | Description |
|----------|-------------|
| Duration | Milliseconds to wait (for time) |
| Selector | Element to wait for (for element) |

### Assert
Verify a condition.

| Property | Description |
|----------|-------------|
| Type | Assertion type (visible, text_contains, etc.) |
| Target | Element to verify |
| Expected Value | Expected state/content |

### API
Make an API call.

| Property | Description |
|----------|-------------|
| Method | GET, POST, PUT, DELETE |
| URL | API endpoint |
| Headers | Request headers |
| Body | Request payload |
| Expected Status | Expected response code |

### Database
Execute a database query.

| Property | Description |
|----------|-------------|
| Query | SQL query to execute |
| Connection | Database connection string |
| Expected Result | Expected query result |

---

## Assertion Builder

The Assertion Builder provides a structured UI for defining expected results that automatically generate verification code.

### Assertion Types

| Type | Description | Generated Code |
|------|-------------|----------------|
| `element_visible` | Element is visible | `expect(page.locator).to_be_visible()` |
| `element_hidden` | Element is hidden | `expect(page.locator).to_be_hidden()` |
| `text_contains` | Text contains value | `expect(page.locator).to_contain_text()` |
| `text_equals` | Text exactly matches | `expect(page.locator).to_have_text()` |
| `url_contains` | URL contains string | `expect(page).to_have_url(re.compile())` |
| `url_equals` | URL exactly matches | `expect(page).to_have_url()` |
| `page_title` | Page title matches | `expect(page).to_have_title()` |
| `input_value` | Input has value | `expect(page.locator).to_have_value()` |

### Quick Suggestions

Based on step type, the builder suggests common assertions:

**After Navigate:**
- Page loads successfully
- URL contains expected path
- Page title is correct

**After Click:**
- Element appears/disappears
- Modal opens
- Navigation occurs

**After Input:**
- Value is entered
- Validation message appears
- Button becomes enabled

---

## Duplicate Element Handling

When multiple elements match a selector (e.g., multiple "Create account" buttons), the builder helps you target the correct one.

### Detection

The recorder's Suggest tab shows duplicates:

```
✓ Create account (1 of 4) ⚠️ 4 found
✓ Create account (2 of 4) ⚠️ 4 found
✓ Create account (3 of 4) ⚠️ 4 found
✓ Create account (4 of 4) ⚠️ 4 found
```

### Element Index Selector

In the step editor, use the "Element Index" dropdown to specify which element to target (0-indexed):

| Element Index | Targets |
|---------------|---------|
| 0 | First element |
| 1 | Second element |
| 2 | Third element |
| ... | ... |

### Generated Code

```python
# Without element index (defaults to first)
element = page.get_by_role("button", name="Create account")
element.first.click()

# With element index = 2 (third element)
element = page.get_by_role("button", name="Create account")
if element.count() > 1:
    print(f"⚠️ Multiple elements found ({element.count()}), clicking index 2")
element.nth(2).click()
```

---

## Export Formats

### Automation (Playwright Python)

```python
import pytest
from playwright.sync_api import sync_playwright, expect

def test_login_flow():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False)
        page = browser.new_page()
        
        # Step 1: Navigate
        page.goto("https://example.com")
        
        # Step 2: Click Login
        page.get_by_role("button", name="Login").click()
        
        # Step 3: Enter email
        page.get_by_label("Email").fill("user@example.com")
        
        # Assertion
        expect(page).to_have_url(re.compile(r".*dashboard.*"))
        
        browser.close()
```

### API (Python Requests)

```python
import requests

def test_api_flow():
    # Step 1: Login API
    response = requests.post(
        "https://api.example.com/login",
        json={"email": "user@example.com", "password": "password123"}
    )
    assert response.status_code == 200
    token = response.json()["token"]
    
    # Step 2: Get user profile
    response = requests.get(
        "https://api.example.com/profile",
        headers={"Authorization": f"Bearer {token}"}
    )
    assert response.status_code == 200
```

### Performance (K6)

```javascript
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
    vus: 10,
    duration: '30s',
};

export default function() {
    const res = http.get('https://example.com');
    check(res, {
        'status is 200': (r) => r.status === 200,
        'response time < 500ms': (r) => r.timings.duration < 500,
    });
    sleep(1);
}
```

### ISTQB Format

```
Test Case ID: TC-001
Test Case Name: User Login Flow
Priority: High
Preconditions: User account exists

Test Steps:
| Step # | Action | Expected Result |
|--------|--------|-----------------|
| 1 | Navigate to https://example.com | Page loads successfully |
| 2 | Click Login button | Login form appears |
| 3 | Enter email: user@example.com | Email is entered |
| 4 | Enter password: ******** | Password is entered |
| 5 | Click Submit | User is logged in |

Postconditions: User session is active
```

### Gherkin/BDD

```gherkin
Feature: User Login

  Scenario: Successful login with valid credentials
    Given I navigate to "https://example.com"
    When I click the "Login" button
    And I enter "user@example.com" in the "Email" field
    And I enter "password123" in the "Password" field
    And I click the "Submit" button
    Then I should see the dashboard
```

### Markdown

```markdown
# Test Case: User Login Flow

**Priority:** High  
**Tags:** login, authentication, smoke

## Description
Verify that users can log in with valid credentials.

## Steps

1. **Navigate** to https://example.com
   - *Expected:* Page loads successfully

2. **Click** Login button
   - *Expected:* Login form appears

3. **Enter** email: user@example.com
   - *Expected:* Email is entered

4. **Enter** password: ********
   - *Expected:* Password is entered

5. **Click** Submit
   - *Expected:* User is logged in, redirected to dashboard
```

---

## Preconditions (Import Test Cases)

Reuse common test flows by importing them as preconditions.

### How to Import

1. Click "Import Test Case" button
2. Select test case from the list
3. Enable/disable preconditions as needed
4. Preconditions run before main test steps

### Example

```
Preconditions:
  ✓ TC-001: Login as Admin (enabled)
  ○ TC-002: Navigate to Settings (disabled)

Test Steps:
  1. Click "Create User" button
  2. Enter user details
  3. Click Save
```

### Generated Code

```python
def test_create_user():
    # Precondition: TC-001 Login as Admin
    login_as_admin(page)
    
    # Main test steps
    page.get_by_role("button", name="Create User").click()
    # ...
```

---

## Save / Save As

### Save (Update)

When editing an existing test case:
- Click "Save" to update the existing record
- Uses PUT request to `/test-cases/{id}`

### Save As (Create New)

To create a copy or new test case:
- Click dropdown arrow next to Save
- Select "Save As..."
- Enter new name
- Creates new test case via POST

---

## Test Execution

### Running a Test

1. Click "Run Test" button
2. Watch real-time progress
3. View results (pass/fail, screenshots, errors)

### Failure Detection

The builder parses execution output for:

| Pattern | Detection |
|---------|-----------|
| `TEST FAILED` | Overall failure |
| `Step X FAILED` | Specific step failure |
| `Traceback` | Python exception |
| `screenshot saved` | Failure screenshot path |
| `Error:` | Error message |

### Results Display

```
❌ Test failed at step 3
Error: Element not found: getByRole('button', name='Submit')
📸 Screenshot: failure_step_3_login_20241215_123456.png
```

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| Ctrl+S | Save test case |
| Ctrl+Shift+S | Save As |
| Ctrl+Enter | Run test |
| Ctrl+E | Toggle Code/No-Code view |

---

## Troubleshooting

### Test fails with "multiple elements found"

**Solution:** Use the Element Index dropdown to specify which element to click.

### Assertions not generating code

**Solution:** Ensure assertion type, target, and value are all filled in.

### Preconditions not running

**Solution:** Make sure preconditions are enabled (checkbox checked).

### Save creates new instead of updating

**Solution:** The test case must have been saved previously. Use "Save As" for new copies.

---

## File Reference

| File | Purpose |
|------|---------|
| `src/pages/UnifiedWorkflowEditor.tsx` | Main builder component (~3100 lines) |
| `src/lib/results-ingestion-service.ts` | Test results persistence |
| `flowstral-extension/src/sidepanel/sidepanel.js` | Recorder integration |

---

## Related Documentation

- [Architecture](./ARCHITECTURE.md) - System overview
- [Flowstral Extension](./FLOWSTRAL_EXTENSION.md) - Recorder details
- [Frontend Reference](./FRONTEND_REFERENCE.md) - Component documentation
- [Implementation Status](./IMPLEMENTATION_STATUS.md) - Feature status


