# Flowstral Universal Automation Engine

## 🎯 Overview

The **Flowstral Engine** is a robust, self-healing automation engine designed to handle 25+ enterprise applications with first-class support for **Salesforce Lightning**.

### Why This Matters

Traditional test automation fails on enterprise apps because:
- **Brittle selectors**: `[data-aura-rendered-by="123:0"]` changes every deployment
- **Dynamic frameworks**: Salesforce Lightning, ServiceNow, SAP Fiori all load async
- **Complex components**: Shadow DOM, iframes, custom web components
- **Fixed timeouts**: `wait_for_timeout(5000)` is unreliable

The Flowstral Engine solves this with:
- **Intent-based finding**: "Find the Save button" not "Find `#btn_123`"
- **Smart waiting**: Detect actual page state, not arbitrary delays
- **App plugins**: Deep knowledge of each enterprise app's UI framework
- **Self-healing**: Learn from successes and failures

---

## 🏗️ Architecture

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                         FLOWSTRAL ENGINE CORE                                 │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│  ┌─────────────────────┐  ┌─────────────────────┐  ┌─────────────────────┐  │
│  │   SmartElementFinder │  │  IntelligentWaiter  │  │ SelfHealingController│  │
│  │                      │  │                     │  │                     │  │
│  │ • Intent-based search│  │ • Framework-aware   │  │ • Records successes │  │
│  │ • ML-inspired scoring│  │ • Spinner detection │  │ • Suggests fixes    │  │
│  │ • Multiple strategies│  │ • State verification│  │ • Learns over time  │  │
│  └─────────────────────┘  └─────────────────────┘  └─────────────────────┘  │
│                                                                               │
├──────────────────────────────────────────────────────────────────────────────┤
│                          APP INTELLIGENCE PLUGINS                             │
├──────────┬────────────┬────────────┬────────────┬────────────┬───────────────┤
│Salesforce│ ServiceNow │  Workday   │ SAP Fiori  │  Oracle    │   + 20 more   │
│(LWC/Aura)│ (Angular)  │ (Custom)   │ (SAPUI5)   │   (JET)    │               │
├──────────┴────────────┴────────────┴────────────┴────────────┴───────────────┤
│                                                                               │
│  ┌─────────────────────┐  ┌─────────────────────┐  ┌─────────────────────┐  │
│  │   Code Generator    │  │     REST API        │  │    Test Runner      │  │
│  │                      │  │                     │  │                     │  │
│  │ • Intent-based code │  │ • /flowstral/*      │  │ • Pytest integration│  │
│  │ • Self-contained    │  │ • Plugin management │  │ • Report generation │  │
│  └─────────────────────┘  └─────────────────────┘  └─────────────────────┘  │
│                                                                               │
├──────────────────────────────────────────────────────────────────────────────┤
│                              PLAYWRIGHT DRIVER                                │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## 📁 File Structure

```
backend/app/services/flowstral_engine/
├── __init__.py                 # Package exports
├── engine.py                   # Main FlowstralEngine class
├── smart_finder.py             # SmartElementFinder - intent-based finding
├── intelligent_waiter.py       # IntelligentWaiter - state-aware waiting  
├── self_healer.py              # SelfHealingController - learning system
├── code_generator.py           # Generates Python test code
│
└── plugins/
    ├── __init__.py
    ├── salesforce_plugin.py    # Salesforce Lightning (LWC/Aura)
    └── enterprise_apps.py      # ServiceNow, Workday, SAP, Oracle, etc.
```

---

## 🔧 Core Components

### 1. SmartElementFinder

**Purpose**: Find elements by INTENT, not selectors.

```python
# Old way (fragile)
page.locator('[data-aura-rendered-by="123:0"]').click()

# Flowstral way (robust)
engine.click(text="Save", role="button")
```

**How it works**:
1. **Semantic locators first**: Uses Playwright's `get_by_role`, `get_by_label`, `get_by_text`
2. **App component shortcuts**: Knows Salesforce buttons are `.slds-button`
3. **Scoring all candidates**: Scores every element against the intent
4. **Confidence threshold**: Only accepts matches above 25% confidence

### 2. IntelligentWaiter

**Purpose**: Wait for page to be ACTUALLY ready.

```python
# Old way (unreliable)
page.wait_for_timeout(5000)

# Flowstral way (smart)
engine.wait_for_ready()  # Detects actual state
```

**How it works**:
1. Waits for `domcontentloaded` (not `networkidle` which fails on SPAs)
2. Detects loading spinners for each app type
3. Checks framework readiness (Aura's `$A`, SAPUI5's `sap.ui.getCore()`)
4. Brief stabilization delay

### 3. SelfHealingController

**Purpose**: Learn from test runs and improve over time.

**How it works**:
1. Records every successful element find
2. Tracks which strategies worked best
3. Suggests alternative selectors when primary fails
4. Exports/imports knowledge between test runs

---

## 🏢 Supported Enterprise Apps

| App | Framework | Status | Plugin |
|-----|-----------|--------|--------|
| **Salesforce** | Lightning (LWC/Aura) | ✅ Full Support | `SalesforcePlugin` |
| **ServiceNow** | Angular/Seismic | ✅ Plugin Ready | `ServiceNowPlugin` |
| **Workday** | Custom | ✅ Plugin Ready | `WorkdayPlugin` |
| **SAP Fiori** | SAPUI5 | ✅ Plugin Ready | `SAPFioriPlugin` |
| **Oracle Cloud** | Oracle JET | ✅ Plugin Ready | `OracleCloudPlugin` |
| **Dynamics 365** | Power Apps | ✅ Plugin Ready | `Dynamics365Plugin` |
| **Zendesk** | Garden | ✅ Plugin Ready | `ZendeskPlugin` |
| **HubSpot** | React | ✅ Plugin Ready | `HubSpotPlugin` |
| **Atlassian** | Atlaskit | ✅ Plugin Ready | `AtlassianPlugin` |
| **NetSuite** | Custom | ✅ Plugin Ready | `NetSuitePlugin` |
| **Generic Web** | Any | ✅ Base Support | `BaseAppPlugin` |

---

## 🔌 Salesforce Plugin Deep Dive

The Salesforce Plugin has comprehensive knowledge of 30+ Lightning component types:

### Component Categories

#### Navigation
- `app_launcher_button` - Waffle icon
- `app_launcher_modal` - App launcher modal
- `app_launcher_search` - Search within App Launcher
- `global_search_button` - Global search icon
- `tab_bar`, `nav_item` - Navigation tabs

#### Record Pages
- `record_header` - Record page header
- `record_tab` - Details/Related/Activity tabs
- `record_form` - Edit forms

#### Forms & Inputs
- `lightning_input` - Text inputs, textareas
- `lightning_button` - All button types
- `modal`, `modal_footer` - Modal dialogs

#### Tables
- `data_table` - Lightning datatable
- `table_row`, `table_cell` - Table elements

### High-Level Methods

```python
# Open an app from App Launcher
engine.sf_open_app("Accounts")

# Use global search
engine.sf_global_search("Acme Corp")

# Click record tabs
engine.sf_click_tab("Details")

# Save record
engine.sf_save()
```

---

## 📡 REST API

### Endpoints

```
POST /flowstral/generate     - Generate test code from steps
GET  /flowstral/plugins      - List available app plugins
POST /flowstral/detect-app   - Detect app type from URL
GET  /flowstral/component-library/{app}  - Get component selectors
GET  /flowstral/salesforce/selectors     - Get all Salesforce selectors
POST /flowstral/convert-steps            - Convert steps to engine format
```

### Example: Generate Test

```bash
curl -X POST http://localhost:8000/flowstral/generate \
  -H "Content-Type: application/json" \
  -d '{
    "test_name": "AccountTest",
    "app_type": "salesforce",
    "steps": [
      {"action": "navigate", "url": "https://login.salesforce.com"},
      {"action": "fill", "description": "Username", "value": "user@example.com"},
      {"action": "click", "description": "Login"}
    ]
  }'
```

---

## 🎯 Usage Examples

### Basic Test with Engine

```python
from playwright.sync_api import sync_playwright
from flowstral_engine import FlowstralEngine

with sync_playwright() as p:
    browser = p.chromium.launch(headless=False)
    page = browser.new_page()
    
    # Initialize engine
    engine = FlowstralEngine(page, app_type="salesforce")
    
    # Navigate
    engine.navigate("https://login.salesforce.com")
    
    # Login
    engine.fill("user@example.com", label="Username")
    engine.fill("password123", label="Password")
    engine.click(text="Log In", role="button")
    
    # Use Salesforce-specific methods
    engine.sf_open_app("Accounts")
    engine.sf_global_search("Acme Corp")
    engine.sf_click_tab("Details")
    
    browser.close()
```

### Generated Test (Portable)

Tests generated by the engine are self-contained - they include an embedded copy
of the engine so they can run anywhere without dependencies:

```python
# Generated test - no external dependencies!
def test_account_test(browser_context):
    page = browser_context.new_page()
    engine = FlowstralEngine(page, app_type="salesforce")  # Embedded in file
    
    engine.navigate("https://login.salesforce.com")
    engine.fill("user@example.com", label="Username")
    engine.click(text="Log In", role="button")
    engine.sf_open_app("Accounts")
```

---

## 🚀 Migration Guide

### From Raw Playwright to Flowstral Engine

**Before (Fragile)**:
```python
page.locator('[data-aura-rendered-by="123:0"]').click()
page.wait_for_timeout(5000)
page.locator('input#username').fill('user@example.com')
```

**After (Robust)**:
```python
engine.click(text="Save", role="button")
engine.wait_for_ready()
engine.fill("user@example.com", label="Username")
```

---

## 📊 Comparison with Industry Tools

| Feature | Flowstral Engine | Testim.io | Provar | Raw Playwright |
|---------|-----------------|-----------|--------|----------------|
| Intent-based finding | ✅ | ✅ | ✅ | ❌ |
| Salesforce-specific | ✅ | ❌ | ✅ | ❌ |
| Self-healing | ✅ | ✅ | ✅ | ❌ |
| Multi-app support | ✅ 25+ apps | ✅ | ❌ SF only | ✅ Generic |
| Open source | ✅ | ❌ | ❌ | ✅ |
| Self-contained tests | ✅ | ❌ | ❌ | ✅ |

---

## 🔮 Future Enhancements

1. **Visual Testing** - Screenshot comparison for UI changes
2. **AI Element Detection** - ML model for element identification
3. **API Testing Integration** - Use APIs for data, UI for validation
4. **Cloud Execution** - Distributed test execution
5. **Natural Language Tests** - "Login and create a new Account"

---

## 📞 Support

For issues or feature requests, contact the Flowstral team or create an issue
in the repository.

**Built with ❤️ for enterprise automation**

