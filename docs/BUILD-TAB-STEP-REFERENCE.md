# Build Tab - Complete Step Reference Guide

> **Purpose:** Detailed usage guide for every step type in the Build tab with realistic examples

---

## Table of Contents

1. [UI Actions](#1-ui-actions)
2. [Verify](#2-verify)
3. [Wait](#3-wait)
4. [Data](#4-data)
5. [Logic](#5-logic)
6. [Backend (API & DB)](#6-backend-api--db)
7. [Advanced](#7-advanced)
8. [Evidence](#8-evidence)
9. [Salesforce (Plugin)](#9-salesforce-plugin)

---

## 1. UI Actions

The foundation of UI testing - interactions users perform on web pages.

### Navigate

**Purpose:** Go to a URL

```yaml
Step: Navigate
URL: https://app.example.com/login
```

**Example Use Cases:**
- Start test at specific page
- Navigate between app sections
- Test deep links

---

### Click

**Purpose:** Click on an element (button, link, checkbox, etc.)

```yaml
Step: Click
Target: "Login" | "#submit-btn" | "[data-testid='submit']"
```

**Best Practices:**
- Use visible text when possible ("Login")
- Fallback to test-id for dynamic elements
- Avoid brittle CSS selectors

---

### Type Text (Input)

**Purpose:** Enter text into an input field

```yaml
Step: Type Text
Target: "#email" | "Email address"
Value: "test@example.com"
Clear First: Yes  # Optional - clears existing text
```

**Example:** Login form
```
1. Navigate → https://app.com/login
2. Type Text → Email field → "user@test.com"
3. Type Text → Password field → "SecurePass123!"
4. Click → "Sign In"
```

---

### Select Option

**Purpose:** Choose from dropdown/select menu

```yaml
Step: Select Option
Target: "#country-select"
Value: "United States"  # By visible text
# OR
Index: 5  # By position (0-indexed)
```

---

### Hover

**Purpose:** Mouse hover to trigger menus/tooltips

```yaml
Step: Hover
Target: "Profile Menu"
```

**Use Case:** Reveal dropdown menu before clicking sub-item

---

### Upload File

**Purpose:** Upload a file via file input

```yaml
Step: Upload File
Target: "#file-input"
File Path: "C:\test-data\invoice.pdf"  # Or relative path
```

---

### Press Keys (Keyboard)

**Purpose:** Keyboard shortcuts and special keys

```yaml
Step: Press Keys
Keys: "Ctrl+S"  # Save
# OR
Keys: "Enter"   # Submit form
# OR
Keys: "Escape"  # Close modal
```

**Common Keys:**
- `Enter`, `Tab`, `Escape`, `Backspace`, `Delete`
- `ArrowUp`, `ArrowDown`, `ArrowLeft`, `ArrowRight`
- `Ctrl+A` (select all), `Ctrl+C` (copy), `Ctrl+V` (paste)
- `F5` (refresh), `F11` (fullscreen)

---

## 2. Verify

Assertions that validate your application is working correctly.

### Element Visible

**Purpose:** Check that an element exists and is visible

```yaml
Step: Element Visible
Target: "Welcome, John!"
# OR
Target: "#success-message"
```

**When to Use:**
- After login, verify dashboard appears
- After form submit, verify success message
- Check error messages appear

---

### Text Content

**Purpose:** Verify specific text appears on page

```yaml
Step: Text Content
Target: "#order-total"
Expected Text: "$199.99"
Match Type: Exact | Contains | Regex
```

**Example:**
```yaml
# Verify order confirmation
Step: Text Content
Target: ".confirmation-message"
Expected: "Order #12345 confirmed"
Match Type: Contains
```

---

### Field Value

**Purpose:** Check the value inside an input field

```yaml
Step: Field Value
Target: "#email-input"
Expected Value: "user@example.com"
```

**Use Case:** Verify form pre-fills with user data

---

### URL Contains

**Purpose:** Verify the current URL

```yaml
Step: URL Contains
Expected: "/dashboard"
# OR
Expected: "order_id=12345"
```

**Use Case:** Verify navigation happened correctly

---

### Page Title

**Purpose:** Check the browser tab title

```yaml
Step: Page Title
Expected: "Dashboard - MyApp"
```

---

### Element Count

**Purpose:** Count elements matching a selector

```yaml
Step: Element Count
Target: ".cart-item"
Expected Count: 3
Operator: Equals | GreaterThan | LessThan
```

**Example:**
```yaml
# Verify cart has items
Step: Element Count
Target: "[data-testid='cart-item']"
Expected: 1
Operator: GreaterThan  # At least 1 item
```

---

### Computed Assert (Math/Formula)

**Purpose:** Mathematical assertions using variables

```yaml
Step: Computed Assert
Expression: "${subtotal} + ${tax}"
Expected: "${total}"
Tolerance: 0.01  # For floating point
```

**Example: Price Calculation**
```yaml
# Extract values first
1. Extract to Variable → ".subtotal" → subtotal
2. Extract to Variable → ".tax" → tax  
3. Extract to Variable → ".total" → total
4. Computed Assert → "${subtotal} + ${tax}" = "${total}"
```

---

### Email Received ✉️

**Purpose:** Verify an email was received (requires email service integration)

**How It Works:**
1. Configure email inbox (Gmail API, Mailinator, temp email)
2. Perform action that triggers email (signup, reset password)
3. Step checks inbox for matching email

```yaml
Step: Email Received
Inbox: "test-inbox@mailinator.com"  # Or configured inbox
Subject Contains: "Verify your email"
From: "noreply@example.com"
Wait Timeout: 60s  # Max time to wait
```

**Realistic Example - Password Reset:**
```yaml
Test: Password Reset Flow

1. Navigate → https://app.com/forgot-password
2. Type Text → Email → "test@mailinator.com"
3. Click → "Send Reset Link"
4. Wait → 5s
5. Email Received:
   - Inbox: mailinator (configured)
   - Subject: "Reset your password"
   - Wait: 30s
6. Extract from Email → Reset link URL
7. Navigate → ${resetLink}
8. Type Text → New Password → "NewPass123!"
9. Click → "Update Password"
10. Text Content → "Password updated successfully"
```

**Configuration Required:**
```json
// In Settings → Integrations → Email
{
  "provider": "mailinator",  // or "gmail", "outlook"
  "api_key": "xxx",
  "inbox_prefix": "qaai-test-"
}
```

---

### File Downloaded

**Purpose:** Verify a file was downloaded

```yaml
Step: File Downloaded
Filename: "report.pdf"  # Or pattern: "report_*.pdf"
Timeout: 30s
Min Size: 1KB  # Optional - verify not empty
```

**Example - Export Feature:**
```yaml
1. Navigate → /reports
2. Click → "Export to PDF"
3. File Downloaded:
   - Filename: "sales_report_*.pdf"
   - Min Size: 10KB
   - Timeout: 15s
```

**How It Works:**
- Monitors browser's download directory
- Waits for file matching pattern
- Validates file exists and meets criteria

---

## 3. Wait

Timing and synchronization steps.

### Wait Time

**Purpose:** Fixed delay (use sparingly!)

```yaml
Step: Wait Time
Duration: 2000  # milliseconds
```

**When to Use:**
- Animation completion
- Rate-limited APIs
- Debounced inputs

**Better Alternative:** Use "Wait for Element" when possible

---

### Wait for Element

**Purpose:** Wait until element appears

```yaml
Step: Wait for Element
Target: "#loading-complete"
Timeout: 10s
State: Visible | Hidden | Attached | Detached
```

**Example:**
```yaml
# Wait for loading spinner to disappear
Step: Wait for Element
Target: ".loading-spinner"
State: Hidden
Timeout: 30s
```

---

### Wait for Text

**Purpose:** Wait until specific text appears

```yaml
Step: Wait for Text
Text: "Upload complete"
Target: ".status-message"  # Optional - search within
Timeout: 60s
```

**Use Case:** Long-running operations

---

### Wait for Network

**Purpose:** Wait until network is idle (no pending requests)

```yaml
Step: Wait for Network
Idle Time: 500ms  # No requests for this duration
Timeout: 10s
```

**Use Case:** After page load, ensure all AJAX calls complete

---

## 4. Data

Variables, extraction, and test data.

### Set Variable

**Purpose:** Store a value for later use

```yaml
Step: Set Variable
Name: orderId
Value: "ORD-12345"
# OR dynamic
Value: "${timestamp}-order"
```

**Built-in Variables:**
- `${timestamp}` - Current Unix timestamp
- `${date}` - Current date (YYYY-MM-DD)
- `${random}` - Random string
- `${uuid}` - UUID v4

---

### Extract from Page

**Purpose:** Get text from an element and store in variable

```yaml
Step: Extract from Page
Target: "#confirmation-number"
Variable: orderNumber
```

**Example - Order Flow:**
```yaml
1. Click → "Place Order"
2. Wait for Text → "Order confirmed"
3. Extract from Page → "#order-id" → orderNumber
4. Log → "Order placed: ${orderNumber}"
```

---

### Extract to Variable

**Purpose:** Extract element value, attribute, or property

```yaml
Step: Extract to Variable
Target: "#price-display"
Extract: Text | Value | Attribute | InnerHTML
Attribute Name: "data-price"  # If extracting attribute
Variable: itemPrice
```

---

### Generate Data

**Purpose:** Create random/fake test data

```yaml
Step: Generate Data
Type: Email | Name | Phone | Address | Company | UUID
Variable: testEmail
```

**Available Types:**
| Type | Example Output |
|------|---------------|
| Email | john.doe.a1b2@test.com |
| FirstName | John |
| LastName | Smith |
| FullName | John Smith |
| Phone | (555) 123-4567 |
| Address | 123 Main St, City, ST 12345 |
| Company | Acme Corp |
| UUID | 550e8400-e29b-41d4-a716-446655440000 |
| Number | 12345 (configurable range) |
| Date | 2024-01-15 |

**Example - Registration:**
```yaml
1. Generate Data → Email → testEmail
2. Generate Data → FullName → testName
3. Navigate → /register
4. Type Text → Name field → ${testName}
5. Type Text → Email field → ${testEmail}
6. Click → "Register"
```

---

### Use Data Row

**Purpose:** Data-driven testing with CSV/Excel data

```yaml
Step: Use Data Row
Dataset: "users.csv"
Row: 1  # Or "next" for iteration
```

**Dataset Example (users.csv):**
```csv
email,password,expectedName
john@test.com,Pass123,John Doe
jane@test.com,Pass456,Jane Smith
admin@test.com,Admin789,Administrator
```

**Test Using Data:**
```yaml
1. Use Data Row → users.csv → Row 1
2. Navigate → /login
3. Type Text → Email → ${email}
4. Type Text → Password → ${password}
5. Click → "Login"
6. Text Content → "${expectedName}"
```

---

## 5. Logic

Control flow and modular testing.

### If / Then (Condition)

**Purpose:** Conditional execution based on element or variable

```yaml
Step: If / Then
Condition: Element Visible | Variable Equals | Variable Contains
Target: ".cookie-banner"  # For element condition
Then: [steps to execute if true]
Else: [steps to execute if false]  # Optional
```

**Example - Handle Cookie Banner:**
```yaml
Step: If / Then
Condition: Element Visible
Target: "#cookie-accept"
Then:
  - Click → "#cookie-accept"
```

---

### Loop

**Purpose:** Repeat steps multiple times

```yaml
Step: Loop
Type: Count | ForEach | While
Count: 5  # For count-based
Items: "${productList}"  # For forEach
Condition: "Element Visible: .next-page"  # For while
Steps:
  - [steps to repeat]
```

**Example - Pagination:**
```yaml
Step: Loop
Type: While
Condition: Element Visible - ".next-button"
Steps:
  - Extract from Page → ".results" → pageData
  - Click → ".next-button"
  - Wait → 1s
```

---

### Reusable Module

**Purpose:** Import shared steps (DRY principle)

```yaml
Step: Reusable Module
Module: "Login Flow"
Parameters:
  username: "testuser"
  password: "testpass"
```

**Creating a Module:**
1. Build a test with common steps
2. Save as Module (right-click → Save as Module)
3. Use in other tests

**Common Modules:**
- Login
- Logout
- Add to Cart
- Checkout
- Search

---

### Group Steps

**Purpose:** Organize related steps together

```yaml
Step: Group
Name: "User Registration"
Steps:
  - Type Text → Name
  - Type Text → Email
  - Type Text → Password
  - Click → Submit
```

---

### Switch Frame

**Purpose:** Enter an iframe

```yaml
Step: Switch Frame
Target: "#payment-iframe"  # Selector
# OR
Index: 0  # First iframe
# OR
Name: "payment-frame"
```

**After iframe work:**
```yaml
Step: Switch Frame
Target: "main"  # Return to main document
```

---

### New Tab

**Purpose:** Handle new browser tabs/windows

```yaml
Step: New Tab
Action: Switch | Close | Open
URL: "https://new-page.com"  # For Open
```

**Example - External Link:**
```yaml
1. Click → "Open in new tab" link
2. New Tab → Switch  # Switches to new tab
3. Text Content → "External page content"
4. New Tab → Close  # Closes and returns to original
```

---

### Handle Alert

**Purpose:** Handle JavaScript alerts/confirms/prompts

```yaml
Step: Handle Alert
Action: Accept | Dismiss | GetText
Input: "My response"  # For prompt dialogs
```

---

## 6. Backend (API & DB)

### API Request

**Purpose:** Make HTTP requests

```yaml
Step: API Request
Method: GET | POST | PUT | DELETE | PATCH
URL: https://api.example.com/users
Headers:
  Authorization: "Bearer ${token}"
  Content-Type: "application/json"
Body: |
  {
    "name": "Test User",
    "email": "test@example.com"
  }
Store Response: apiResponse
```

**Example - Create and Verify:**
```yaml
1. API Request:
   - POST → /api/users
   - Body: {"name": "John"}
   - Store: createResponse
   
2. Extract Value:
   - From: ${createResponse}
   - Path: $.id
   - To: userId
   
3. API Request:
   - GET → /api/users/${userId}
   - Store: getResponse
   
4. Validate Response:
   - Response: ${getResponse}
   - Status: 200
   - Body contains: "John"
```

---

### Validate Response

**Purpose:** Assert API response meets criteria

```yaml
Step: Validate Response
Response: ${apiResponse}
Status Code: 200
Headers:
  Content-Type: "application/json"
Body:
  - Path: $.success → Equals: true
  - Path: $.data.items → Count: GreaterThan 0
  - Path: $.data.total → Type: Number
```

**JSON Path Examples:**
| Path | Meaning |
|------|---------|
| `$.name` | Root level "name" field |
| `$.data.user.email` | Nested field |
| `$.items[0].id` | First item's id |
| `$.items[*].price` | All prices in array |
| `$.items.length` | Array length |

---

### Extract Value (from API)

**Purpose:** Get specific value from API response

```yaml
Step: Extract Value
From: ${apiResponse}
Path: $.data.token
Variable: authToken
```

---

### Database Query

**Purpose:** Execute SQL query

```yaml
Step: Database Query
Connection: "postgres-prod"  # Configured connection
Query: |
  SELECT * FROM users 
  WHERE email = '${testEmail}'
Store Result: dbResult
```

**Connection Configuration (Settings → Integrations → Databases):**
```json
{
  "name": "postgres-prod",
  "type": "postgres",
  "host": "db.example.com",
  "port": 5432,
  "database": "myapp",
  "username": "readonly_user",
  "password": "****"
}
```

---

### Validate Data (DB)

**Purpose:** Assert database state

```yaml
Step: Validate Data
Result: ${dbResult}
Assertions:
  - Row Count: 1
  - Field "status": "active"
  - Field "created_at": NotNull
```

**Example - E2E with DB Verification:**
```yaml
1. Generate Data → Email → testEmail
2. Navigate → /register
3. Type Text → Email → ${testEmail}
4. Click → "Register"
5. Wait for Text → "Registration successful"

# Verify in database
6. Database Query:
   - SELECT * FROM users WHERE email = '${testEmail}'
   - Store: newUser
   
7. Validate Data:
   - Row Count: 1
   - Field "email": "${testEmail}"
   - Field "status": "pending"
```

---

## 7. Advanced

### Smart Select

**Purpose:** Find element by text/attribute dynamically

```yaml
Step: Smart Select
Find By: Text | Attribute | Contains | Index
Criteria: "Add to Cart"  # For text
Parent: ".product-card"  # Optional - search within
Store: foundElement
```

**Example - Find Product:**
```yaml
Step: Smart Select
Find By: Contains
Criteria: "iPhone 15"
Parent: ".product-grid"
Action: Click
```

---

### Find in Table

**Purpose:** Find row in a table by column value

```yaml
Step: Find in Table
Table: "#orders-table"
Find Column: "Order ID"
Find Value: "ORD-12345"
Action: Click Row | Extract Row | Get Cell
Target Column: "Status"  # For Get Cell
```

**Example:**
```yaml
1. Navigate → /orders
2. Find in Table:
   - Table: "#orders-table"
   - Find: "Order ID" = "ORD-12345"
   - Extract Row → orderRow
3. Assert:
   - ${orderRow.Status} = "Delivered"
```

---

### Extract from Table

**Purpose:** Get data from table row/cell

```yaml
Step: Extract from Table
Table: ".data-table"
Row: 1  # Or "found" after Find in Table
Columns: ["Name", "Price", "Quantity"]
Variable: rowData
```

---

### Assert Table

**Purpose:** Verify table contents

```yaml
Step: Assert Table
Table: "#results-table"
Assertions:
  - Row Count: GreaterThan 0
  - Column "Status" Contains: "Active"
  - Cell [1, "Price"]: "$99.99"
```

---

### Drag & Drop

**Purpose:** Drag element to target

```yaml
Step: Drag & Drop
Source: "#draggable-item"
Target: "#drop-zone"
```

---

### Slider

**Purpose:** Set slider/range input value

```yaml
Step: Slider
Target: "#price-range"
Value: 75  # Percentage or actual value
```

---

### Date Picker

**Purpose:** Select date from date picker

```yaml
Step: Date Picker
Target: "#departure-date"
Date: "2024-03-15"
# OR
Date: "today + 7 days"
```

---

### Multi-Select

**Purpose:** Select multiple options

```yaml
Step: Multi-Select
Target: "#categories"
Values: ["Electronics", "Books", "Clothing"]
```

---

### PDF Content

**Purpose:** Verify PDF file contents

```yaml
Step: PDF Content
File: "${downloadPath}/report.pdf"  # Downloaded file
# OR
URL: "https://example.com/invoice.pdf"
Assertions:
  - Contains Text: "Invoice #12345"
  - Contains Text: "Total: $199.99"
  - Page Count: 2
```

**How It Works:**
1. Downloads or opens PDF
2. Extracts text content
3. Runs text assertions

**Example - Invoice Verification:**
```yaml
1. Click → "Download Invoice"
2. File Downloaded → invoice.pdf
3. PDF Content:
   - File: downloads/invoice.pdf
   - Contains: "Invoice #${orderNumber}"
   - Contains: "${customerName}"
   - Contains: "Total: ${orderTotal}"
```

---

## 8. Evidence

### Screenshot

**Purpose:** Capture screen state

```yaml
Step: Screenshot
Name: "after-login"
Full Page: Yes | No
Element: "#specific-element"  # Optional - screenshot element only
```

---

### Visual Compare

**Purpose:** Compare against baseline image

```yaml
Step: Visual Compare
Baseline: "homepage-baseline.png"
Threshold: 0.1  # 10% difference allowed
Ignore Regions: 
  - "#dynamic-ad"
  - ".timestamp"
```

---

### Log Message

**Purpose:** Add entry to test log

```yaml
Step: Log Message
Level: Info | Warning | Error
Message: "User ${userId} logged in successfully"
```

---

### Note / Comment

**Purpose:** Add documentation to test

```yaml
Step: Note
Text: |
  This section tests the checkout flow.
  Prerequisites: User must be logged in.
```

---

### Manual Step

**Purpose:** Instruction for manual execution

```yaml
Step: Manual Step
Action: "Verify the email appears in the inbox"
Expected: "Email with subject 'Welcome' is received"
```

---

### Checkpoint

**Purpose:** Mark verification point

```yaml
Step: Checkpoint
Name: "Login Complete"
Pass Criteria: "Dashboard is visible"
```

---

## 9. Salesforce (Plugin)

### SF Connect

**Purpose:** Authenticate to Salesforce org

```yaml
Step: SF Connect
Org: "Production"  # Configured org
# OR
Username: "admin@company.com"
Password: "${sfPassword}"
Security Token: "${sfToken}"
```

---

### SF Navigate

**Purpose:** Navigate within Salesforce

```yaml
Step: SF Navigate
To: Record | Tab | App | Setup
Object: "Account"
Record ID: "001xx000003DGb0AAG"
```

---

### SOQL Query

**Purpose:** Run Salesforce query

```yaml
Step: SOQL Query
Query: |
  SELECT Id, Name, Email 
  FROM Contact 
  WHERE AccountId = '${accountId}'
Store: contacts
```

---

### SF Assert

**Purpose:** Verify Salesforce record

```yaml
Step: SF Assert
Object: "Opportunity"
Record ID: "${oppId}"
Field: "StageName"
Expected: "Closed Won"
```

---

## Quick Reference Card

| Category | Most Used Steps |
|----------|----------------|
| **UI Actions** | Navigate, Click, Type Text, Select |
| **Verify** | Element Visible, Text Content, URL Contains |
| **Wait** | Wait for Element, Wait for Network |
| **Data** | Set Variable, Extract from Page, Generate Data |
| **Logic** | If/Then, Loop, Reusable Module |
| **Backend** | API Request, Validate Response, DB Query |
| **Advanced** | Find in Table, Smart Select |
| **Evidence** | Screenshot, Log Message |

---

*Document maintained by QAAI team. Last updated: January 31, 2026*
