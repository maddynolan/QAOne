# App-Specific Playwright Locator Strategies

## Overview

This guide covers 20 application frameworks that require special locator handling. Generic HTML apps using standard semantic markup don't need special strategies—Playwright's default `getByRole`, `getByText`, `getByLabel` work perfectly.

**When do you need app-specific strategies?**
- Dynamically generated IDs/classes
- Shadow DOM encapsulation
- Framework-specific data attributes
- Hash-based class names that change on rebuild
- Complex component hierarchies

---

## 1. Salesforce Lightning Web Components (LWC)

### Problematic Patterns
```html
<!-- AVOID: Dynamic hash-based classes -->
<li class="lwc-59kp5sov61j slds-is-relative slds-list__item">

<!-- AVOID: Auto-generated IDs that change -->
<input id="radio-1-71" type="radio">

<!-- AVOID: Generic SLDS classes matching multiple elements -->
<span class="slds-radio_faux">
```

### Root Causes
- LWC generates unique hash suffixes for scoped CSS (`lwc-XXXXXXXX`)
- Radio/checkbox IDs are auto-generated with counters
- SLDS (Salesforce Lightning Design System) uses generic utility classes

### Recommended Locators
```javascript
// ✅ Use data-id attributes (stable in LWC)
page.locator('[data-id="31"]')

// ✅ Use name attributes (bound to Salesforce fields)
page.locator('[name="Brain_Injury_Concussion_or_Surgery__c"]')

// ✅ Use title attributes
page.locator('[title="Join the donor registry"]')

// ✅ Use data-menuitem-id for navigation
page.locator('[data-menuitem-id="Get_involved"]')

// ✅ Use aria-label for accessibility-labeled elements
page.locator('[aria-label="Get involved"]')

// ✅ Combine stable parent + text content
page.locator('lightning-radio-group').getByText('18-35')

// ✅ Use lightning-* component selectors with filtering
page.locator('lightning-input[data-field="firstName"]')

// ✅ For SLDS buttons, use text or type
page.locator('button:has-text("Next")')
page.getByRole('button', { name: 'Next' })
```

### Configuration Detection
```javascript
const isLWC = await page.locator('[class*="lwc-"], lightning-').first().isVisible()
  .catch(() => false);
```

---

## 2. Salesforce Aura/Lightning (Classic Lightning)

### Problematic Patterns
```html
<!-- AVOID: Aura-generated IDs -->
<div id="123:45;a" data-aura-rendered-by="456:0">

<!-- AVOID: Aura class prefixes with random suffixes -->
<div class="uiInput uiInputText uiInput--default">

<!-- AVOID: globalId references -->
<input data-aura-rendered-by="789:0">
```

### Root Causes
- Aura uses `globalId` system with colon-separated IDs
- `data-aura-rendered-by` references are session-specific
- Component instances get unique numeric prefixes

### Recommended Locators
```javascript
// ✅ Use aura:id (if developers set it - most stable)
page.locator('[data-aura-id="myButton"]')

// ✅ Use class combinations without random parts
page.locator('.uiButton.forceActionButton')

// ✅ Use data-refid for record references
page.locator('[data-refid="recordId"]')

// ✅ Target force: namespaced components
page.locator('force-record-layout-item[field-label="Account Name"]')

// ✅ Use text content within known containers
page.locator('.slds-form-element__label:has-text("Email")')
  .locator('..').locator('input')

// ✅ Use data-interactive-lib-uid sparingly (more stable than aura IDs)
page.locator('[data-interactive-lib-uid]').filter({ hasText: 'Submit' })
```

---

## 3. Angular (v2+)

### Problematic Patterns
```html
<!-- AVOID: _ngcontent hash attributes -->
<div _ngcontent-abc-c42 class="container">

<!-- AVOID: _nghost attributes -->
<app-header _nghost-abc-c15>

<!-- AVOID: ng-reflect attributes (debug mode only) -->
<input ng-reflect-model="value">

<!-- AVOID: Dynamic class hashes from Angular CLI -->
<div class="header_abc123">
```

### Root Causes
- Angular's ViewEncapsulation adds `_ngcontent-XXX` attributes
- These hashes change on every build
- `ng-reflect-*` only exists in development mode

### Recommended Locators
```javascript
// ✅ Use data-testid (requires dev team cooperation)
page.locator('[data-testid="login-button"]')
page.getByTestId('login-button')

// ✅ Use component tag names (stable)
page.locator('app-login-form input[type="email"]')

// ✅ Use formControlName (Angular Reactive Forms)
page.locator('[formcontrolname="email"]')
page.locator('[formcontrolname="password"]')

// ✅ Use Angular CDK attributes
page.locator('[cdkfocusinitial]')
page.locator('[cdkdrag]')

// ✅ Use mat- prefixed attributes for Angular Material
page.locator('mat-form-field').filter({ hasText: 'Username' }).locator('input')
page.locator('[matinput][placeholder="Search"]')

// ✅ Use aria attributes (Angular Material uses them extensively)
page.locator('[aria-label="Toggle menu"]')

// ✅ Use ng-container markers via data attributes
page.locator('[data-cy="submit-section"]')
```

### Configuration Detection
```javascript
const isAngular = await page.evaluate(() => 
  !!(window.ng || document.querySelector('[_ngcontent-]') || 
     document.querySelector('[ng-version]'))
);
```

---

## 4. React

### Problematic Patterns
```html
<!-- AVOID: CSS Modules hash classes -->
<div class="Button_primary__3xk2d">

<!-- AVOID: Styled-components generated classes -->
<button class="sc-bdfBwQ iUQHUv">

<!-- AVOID: Emotion CSS classes -->
<div class="css-1a2b3c4">

<!-- AVOID: Numeric keys in IDs -->
<div id="react-select-2-input">
```

### Root Causes
- CSS-in-JS solutions generate unique class hashes
- React doesn't enforce ID conventions
- Third-party component libraries have their own patterns

### Recommended Locators
```javascript
// ✅ Use data-testid (React Testing Library convention)
page.getByTestId('submit-button')
page.locator('[data-testid="user-profile"]')

// ✅ Use aria roles and labels (React best practice)
page.getByRole('button', { name: 'Submit' })
page.getByRole('textbox', { name: 'Email' })

// ✅ For React Select, use stable parts
page.locator('[class*="react-select"]').filter({ hasText: 'Choose...' })
page.locator('[id$="-input"]').filter({ has: page.locator('[class*="select"]') })

// ✅ Use data-* attributes from component libraries
page.locator('[data-state="open"]')  // Radix UI
page.locator('[data-slot="input"]')  // NextUI

// ✅ Target by component structure
page.locator('[class*="Modal"] [class*="Header"]')

// ✅ For MUI (Material-UI)
page.locator('.MuiButton-root:has-text("Save")')
page.locator('.MuiTextField-root').filter({ hasText: 'Email' }).locator('input')
page.locator('[data-testid="PersonIcon"]')

// ✅ For Ant Design
page.locator('.ant-btn-primary:has-text("Submit")')
page.locator('.ant-form-item').filter({ hasText: 'Username' }).locator('input')

// ✅ For Chakra UI
page.locator('[data-chakra-component="CButton"]:has-text("Save")')
```

### Configuration Detection
```javascript
const isReact = await page.evaluate(() => 
  !!(document.querySelector('[data-reactroot]') || 
     document.querySelector('[data-reactid]') ||
     window.__REACT_DEVTOOLS_GLOBAL_HOOK__)
);
```

---

## 5. Vue.js

### Problematic Patterns
```html
<!-- AVOID: Scoped CSS data attributes -->
<div data-v-7ba5bd90 class="container">

<!-- AVOID: Vue-generated IDs -->
<input id="input-123">

<!-- AVOID: Transition class names -->
<div class="fade-enter-active fade-enter-to">
```

### Root Causes
- Scoped styles add `data-v-XXXX` attributes (hash changes per build)
- Vue's transition system adds/removes dynamic classes
- v-for generated elements often lack stable identifiers

### Recommended Locators
```javascript
// ✅ Use data-testid or data-test (Vue community convention)
page.locator('[data-test="login-form"]')
page.locator('[data-testid="submit-btn"]')

// ✅ Use ref attribute if exposed to DOM (Vue 3)
page.locator('[ref="emailInput"]')

// ✅ Use data-cy (Cypress convention, works in Playwright)
page.locator('[data-cy="nav-menu"]')

// ✅ For Vuetify
page.locator('.v-btn:has-text("Submit")')
page.locator('.v-text-field').filter({ hasText: 'Email' }).locator('input')
page.locator('[data-no-activator]')  // Vuetify menus

// ✅ For Element Plus / Element UI
page.locator('.el-button--primary:has-text("Confirm")')
page.locator('.el-form-item').filter({ hasText: 'Username' }).locator('input')

// ✅ For Quasar
page.locator('.q-btn:has-text("Save")')
page.locator('[data-qid="my-input"]')

// ✅ For PrimeVue
page.locator('.p-button:has-text("Submit")')
page.locator('[data-pc-name="inputtext"]')

// ✅ Use component tag names (custom elements)
page.locator('my-custom-button:has-text("Click")')
```

### Configuration Detection
```javascript
const isVue = await page.evaluate(() => 
  !!(window.__VUE__ || window.Vue || 
     document.querySelector('[data-v-]') ||
     document.querySelector('[data-server-rendered]'))
);
```

---

## 6. SAP UI5 / Fiori

### Problematic Patterns
```html
<!-- AVOID: View-prefixed generated IDs -->
<input id="__xmlview0--myInput-inner">
<button id="__button0">

<!-- AVOID: Generated container IDs -->
<div id="__xmlview0--page-cont">

<!-- AVOID: Random numeric suffixes -->
<div id="__item0-__clone42">
```

### Root Causes
- XML views generate `__xmlview{N}--` prefixes
- Clone operations add `__clone{N}` suffixes
- Controls generate sequential `__controltype{N}` IDs

### Recommended Locators
```javascript
// ✅ Use stable ID suffix (after the --)
page.locator('[id$="--myInput"]')
page.locator('[id*="--searchField"]')

// ✅ Use sap.ui.core.CustomData (data-* attributes)
page.locator('[data-sap-ui="customId"]')
page.locator('[data-custom-key="myValue"]')

// ✅ Use control-specific attributes
page.locator('[data-sap-ui-type="sap.m.Button"]:has-text("Save")')

// ✅ For standard Fiori elements
page.locator('.sapMBtn:has-text("Save")')
page.locator('.sapMInputBaseInner[placeholder="Search"]')

// ✅ Use title attribute (common in Fiori)
page.locator('[title="Edit"]')
page.locator('[title="Delete Item"]')

// ✅ Target by aria for accessibility-focused apps
page.locator('[aria-describedby*="--label"]')

// ✅ Use semantic structure
page.locator('.sapMPageHeader').locator('button:has-text("Back")')

// ✅ For tables, use column-based selection
page.locator('.sapMListTblCell:has-text("John")').locator('..').locator('button')
```

### Configuration Detection
```javascript
const isSAPUI5 = await page.evaluate(() => 
  !!(window.sap?.ui?.getCore || document.querySelector('[data-sap-ui]') ||
     document.querySelector('[id^="__xmlview"]'))
);
```

---

## 7. Oracle APEX

### Problematic Patterns
```html
<!-- PARTIALLY STABLE: apex_ prefixes (region IDs are usually stable) -->
<div id="apex_region_123">

<!-- AVOID: IR (Interactive Report) generated IDs -->
<input id="apexir_SEARCH_FIELD">

<!-- AVOID: Session-specific IDs -->
<span id="P10_ITEM_123_LABEL">
```

### Root Causes
- Page item IDs include page number (P{N}_)
- Interactive reports/grids generate dynamic IDs
- Some IDs include session counters

### Recommended Locators
```javascript
// ✅ Use page item names (P{page}_{name} is a convention)
page.locator('#P10_EMPLOYEE_NAME')
page.locator('[name="P10_EMAIL"]')

// ✅ Use static region IDs (set by developer)
page.locator('#employee_region')
page.locator('[data-region-id="main-content"]')

// ✅ Use Universal Theme classes (stable)
page.locator('.t-Button--hot:has-text("Submit")')
page.locator('.t-Form-fieldContainer').filter({ hasText: 'Name' }).locator('input')

// ✅ Use apex-specific classes
page.locator('.apex-item-text[data-item="P10_NAME"]')

// ✅ For Interactive Reports
page.locator('.a-IRR-search-field')
page.locator('.a-IRR-button--go')

// ✅ For Interactive Grids
page.locator('.a-GV-cell').filter({ hasText: 'Search' })
page.locator('[data-column-id="ENAME"]')

// ✅ Use header text for column identification
page.locator('th:has-text("Employee")').locator('..').locator('td').nth(1)

// ✅ For buttons, use data-action
page.locator('[data-action="CREATE"]')
page.locator('[data-action="DELETE"]')
```

### Configuration Detection
```javascript
const isAPEX = await page.evaluate(() => 
  !!(window.apex || document.querySelector('[id^="apex"]') ||
     document.querySelector('.apex-item-wrapper'))
);
```

---

## 8. ServiceNow

### Problematic Patterns
```html
<!-- AVOID: Instance-specific sys_id -->
<input id="sys_display.incident.caller_id">

<!-- AVOID: g_form/glide generated elements -->
<span id="status.incident.state" class="glide_form">

<!-- AVOID: Dynamic widget IDs -->
<div id="sp_widget_12345">
```

### Root Causes
- Glide forms use `sys_` prefixes with table.field patterns
- Service Portal widgets generate random IDs
- UI Scripts can modify DOM unpredictably

### Recommended Locators
```javascript
// ✅ Use field name patterns (table.field is stable)
page.locator('[id$=".caller_id"]')
page.locator('[name="incident.short_description"]')

// ✅ Use sys_display for reference fields
page.locator('[id^="sys_display."][id$=".assigned_to"]')

// ✅ Use glide form structure
page.locator('.form-group').filter({ hasText: 'Priority' }).locator('select')

// ✅ Use data-field attributes in forms
page.locator('[data-field="short_description"]')

// ✅ For Service Portal widgets, use widget name
page.locator('[widget-id="widget-cool-clock"]')
page.locator('.sp-page-container [data-widget="list"]')

// ✅ Use NOW UI components (newer ServiceNow)
page.locator('now-button:has-text("Save")')
page.locator('now-input[label="Name"]')
page.locator('[component-id*="now-input"]')

// ✅ For lists, use column headers
page.locator('.list_header_cell:has-text("Number")')
page.locator('[data-column-name="number"]')

// ✅ Use aria labels (ServiceNow is accessibility-focused)
page.locator('[aria-label="Create new record"]')
```

### Configuration Detection
```javascript
const isServiceNow = await page.evaluate(() => 
  !!(window.g_form || window.GlideRecord ||
     document.querySelector('[class*="glide"]') ||
     document.querySelector('[id^="sys_"]'))
);
```

---

## 9. Workday

### Problematic Patterns
```html
<!-- AVOID: UUID-based IDs -->
<div id="wd-UUID123-456-789">

<!-- AVOID: Instance counters -->
<button id="button-0-1-2">

<!-- HEAVY SHADOW DOM: Many components encapsulated -->
<wd-button>
  #shadow-root (open)
    <button>Click</button>
</wd-button>
```

### Root Causes
- Extensive Shadow DOM usage
- UUID-based identifiers
- Custom web components with internal structure

### Recommended Locators
```javascript
// ✅ Use data-automation-id (Workday's primary test hook)
page.locator('[data-automation-id="promptOption"]')
page.locator('[data-automation-id="searchBox"]')
page.locator('[data-automation-id="wd-CommandButton_uic_okButton"]')

// ✅ Pierce Shadow DOM when needed
page.locator('wd-button >> button:has-text("OK")')
page.locator('wd-popup >> [data-automation-id="promptOption"]')

// ✅ Use data-uxi-widget-type
page.locator('[data-uxi-widget-type="commandbutton"]')
page.locator('[data-uxi-widget-type="textinput"]')

// ✅ For tables and grids
page.locator('[data-automation-id="gridCell"]').filter({ hasText: 'John' })

// ✅ Use data-automation-label
page.locator('[data-automation-label="Employee Name"]')

// ✅ For navigation
page.locator('[data-automation-id="globalSearchInput"]')
page.locator('[data-automation-id="worklet"]')

// ✅ Handle frames (Workday uses iframes)
const frame = page.frameLocator('[data-automation-id="mainFrame"]');
frame.locator('[data-automation-id="saveButton"]')
```

### Configuration Detection
```javascript
const isWorkday = await page.evaluate(() => 
  !!(document.querySelector('[data-automation-id]') &&
     (document.querySelector('wd-') || window.wd))
);
```

---

## 10. Microsoft Dynamics 365

### Problematic Patterns
```html
<!-- AVOID: GUID-based IDs -->
<div id="id-5d3a7b2c-1234-5678-9abc-def012345678">

<!-- AVOID: MscrmControls generated IDs -->
<div id="MscrmControls.Containers.EntityForm_123">

<!-- AVOID: Deep nested fieldControl IDs -->
<input id="header_fullname_fieldControl">
```

### Root Causes
- Entity IDs are GUIDs
- PCF (Power Apps Component Framework) generates complex IDs
- Multiple control wrappers around inputs

### Recommended Locators
```javascript
// ✅ Use data-id (Dynamics primary locator)
page.locator('[data-id="name.fieldControl-text-box-text"]')
page.locator('[data-id="form-selector"]')

// ✅ Use data-control-name
page.locator('[data-control-name="fullname"]')
page.locator('[data-control-name="emailaddress1"]')

// ✅ Use field logical names
page.locator('[data-lp-id*="telephone1"]')

// ✅ Use aria-label (Dynamics is accessible)
page.locator('[aria-label="Account Name"]')
page.locator('[aria-label="Save (CTRL+S)"]')

// ✅ For grids, use column headers
page.locator('[data-id="entity_control"] [aria-label="Name"]')

// ✅ For command bar
page.locator('[data-id="OverflowButton"]')
page.locator('[data-id="edit"]')  // Edit button in command bar

// ✅ Use section references
page.locator('[data-id="section-general"]')
page.locator('[data-id="tab-section-header"]')

// ✅ For lookups
page.locator('[data-id="primarycontactid.fieldControl-LookupResultsDropdown"]')

// ✅ For subgrids
page.locator('[data-id="contactssubgrid"]').locator('[aria-label*="New"]')
```

### Configuration Detection
```javascript
const isDynamics365 = await page.evaluate(() => 
  !!(window.Xrm || window.Mscrm ||
     document.querySelector('[data-id*="fieldControl"]') ||
     document.querySelector('[class*="MscrmControls"]'))
);
```

---

## 11. Pega Platform

### Problematic Patterns
```html
<!-- AVOID: Instance-specific IDs -->
<div id="pzLayout_1234567890">

<!-- AVOID: Thread-dependent references -->
<input id="pyInput_1_1_1">

<!-- AVOID: Hash-based generated IDs -->
<span id="RULE-HTML-SECTION-ABC123">
```

### Root Causes
- Clipboard pages generate dynamic IDs
- Thread/requestor references in IDs
- Section and harness rules have versioned IDs

### Recommended Locators
```javascript
// ✅ Use data-test-id (Pega's test hook)
page.locator('[data-test-id="201712180947130378"]')
page.locator('[data-test-id="searchButton"]')

// ✅ Use data-py attributes (py = property)
page.locator('[data-py="pyLabel"]')
page.locator('[data-py="pyCaption"]')

// ✅ Use pyTemplateLabel for field identification
page.locator('[pyTemplateLabel="Name"]')

// ✅ Use data-ref for property references
page.locator('[data-ref="pyWorkPage.pyLabel"]')

// ✅ For standard Pega UI elements
page.locator('.pzButton:has-text("Submit")')
page.locator('.pzTextInput[placeholder*="Search"]')

// ✅ Use node_name for sections
page.locator('[node_name="pyDetails"]')

// ✅ Use data-ctl for control type
page.locator('[data-ctl="Dropdown"]')
page.locator('[data-ctl="RadioButtons"]')

// ✅ For grids, use column identification
page.locator('[data-column="1"]').filter({ hasText: 'John' })

// ✅ Use title attribute (common in Pega)
page.locator('[title="Refresh"]')
page.locator('[title="Add Item"]')
```

### Configuration Detection
```javascript
const isPega = await page.evaluate(() => 
  !!(window.pega || document.querySelector('[class^="pz"]') ||
     document.querySelector('[data-test-id]') ||
     document.querySelector('[node_name]'))
);
```

---

## 12. Appian

### Problematic Patterns
```html
<!-- AVOID: Component instance IDs -->
<div id="COMPONENT_123_456">

<!-- AVOID: Grid cell indices -->
<td id="cell_1_2_3">

<!-- AVOID: UUID-like IDs -->
<input id="a1b2c3d4-5678-90ab-cdef">
```

### Root Causes
- SAIL (Appian's UI language) generates positional IDs
- Component reuse creates duplicate structures
- Record grids have dynamic cell IDs

### Recommended Locators
```javascript
// ✅ Use data-testid (Appian standard)
page.locator('[data-testid="submitButton"]')
page.locator('[data-testid="employeeNameField"]')

// ✅ Use label associations
page.locator('label:has-text("Employee Name")').locator('+ input')

// ✅ Use SAIL component classes with text
page.locator('.TextField:has-text("Name")').locator('input')
page.locator('.DropdownField').filter({ hasText: 'Status' })

// ✅ For grids, use header text
page.locator('.GridHeader:has-text("Name")').locator('..').locator('td')

// ✅ Use aria-label (Appian is accessibility-compliant)
page.locator('[aria-label="Search employees"]')

// ✅ For record links
page.locator('[data-link-type="record"]')

// ✅ For buttons in specific sections
page.locator('.Section').filter({ hasText: 'Employee Details' })
  .locator('button:has-text("Save")')

// ✅ Use placeholder text
page.locator('[placeholder="Enter name..."]')
```

### Configuration Detection
```javascript
const isAppian = await page.evaluate(() => 
  !!(window.Appian || document.querySelector('.AnchoredSection') ||
     document.querySelector('[class*="SailComponent"]'))
);
```

---

## 13. OutSystems

### Problematic Patterns
```html
<!-- AVOID: Instance-specific IDs -->
<div id="b1-Input_Name">

<!-- AVOID: Block-prefixed IDs -->
<input id="MainContent_wtForm_Input1">

<!-- AVOID: Numeric suffixes -->
<span id="RichWidgets_wt23">
```

### Root Causes
- Web blocks prefix IDs with their names
- Widgets add `wt` + number suffixes
- Screen aggregates create dynamic IDs

### Recommended Locators
```javascript
// ✅ Use data-* attributes (OutSystems supports custom attributes)
page.locator('[data-widget="Input"]')
page.locator('[data-test-id="login-button"]')

// ✅ Use OSBlockWidget attribute
page.locator('[osblockwidget="MainContent"]')

// ✅ Use stable ID suffixes
page.locator('[id$="Input_Email"]')
page.locator('[id$="Button_Submit"]')

// ✅ Use OutSystems class patterns
page.locator('.ThemeGrid_Container input[type="text"]')
page.locator('.Button.Is_Primary')

// ✅ For tables, use data-column
page.locator('[data-column="Name"]')

// ✅ Use name attribute (more stable in OutSystems)
page.locator('[name$="Input_Username"]')

// ✅ For Reactive Web apps (newer OutSystems)
page.locator('osui-dropdown')
page.locator('[data-osui-widget="DropDown"]')

// ✅ Use form structure
page.locator('.Form').filter({ hasText: 'Login' }).locator('input[type="password"]')
```

### Configuration Detection
```javascript
const isOutSystems = await page.evaluate(() => 
  !!(document.querySelector('[osblockwidget]') ||
     document.querySelector('[id*="_wt"]') ||
     window.OsApplicationInfo)
);
```

---

## 14. Mendix

### Problematic Patterns
```html
<!-- AVOID: mxui generated IDs -->
<div id="mxui_widget_NumberInput_123">

<!-- AVOID: Widget instance numbers -->
<input id="NumberInput_widget_123">

<!-- AVOID: Path-based IDs -->
<div id="mxui_widget_DataView_1/container/form">
```

### Root Causes
- Widgets get sequential IDs
- DataView paths create long nested IDs
- Class names include build-time hashes

### Recommended Locators
```javascript
// ✅ Use mx- prefixed attributes (Mendix standard)
page.locator('[mx-name="textBox1"]')
page.locator('[mx-name="saveButton"]')

// ✅ Use class attribute markers
page.locator('.mx-textbox').filter({ hasText: 'Name' })
page.locator('.mx-button:has-text("Submit")')

// ✅ Use widget-specific classes
page.locator('.mx-dateinput input')
page.locator('.mx-dropdown select')

// ✅ For data grids
page.locator('.mx-datagrid-head-cell:has-text("Name")')
page.locator('.mx-datagrid-row').filter({ hasText: 'John' })

// ✅ Use data-mendix-id (if enabled)
page.locator('[data-mendix-id="button-save"]')

// ✅ For page containers
page.locator('.mx-page[class*="Home"]')
page.locator('.mx-layoutcontainer-wrapper')

// ✅ Use label associations
page.locator('label.mx-control-label:has-text("Email")').locator('..').locator('input')

// ✅ For pop-ups/modals
page.locator('.modal-dialog').locator('.mx-button:has-text("OK")')
```

### Configuration Detection
```javascript
const isMendix = await page.evaluate(() => 
  !!(window.mx || window.mendix ||
     document.querySelector('[mx-name]') ||
     document.querySelector('[class^="mx-"]'))
);
```

---

## 15. Oracle JET (JavaScript Extension Toolkit)

### Problematic Patterns
```html
<!-- AVOID: Generated ojXXX IDs -->
<div id="oj-input-text-1234">

<!-- AVOID: Instance counters -->
<oj-table id="table__1__">

<!-- AVOID: Slot-based content moves -->
<div slot="main" id="generated_456">
```

### Root Causes
- JET components generate sequential IDs
- Custom elements with Shadow DOM
- Dynamic slot assignments

### Recommended Locators
```javascript
// ✅ Use component data-oj-* attributes
page.locator('[data-oj-binding-provider]')
page.locator('oj-input-text[value.bind="name"]')

// ✅ Use label-hint attribute (JET pattern)
page.locator('oj-input-text[label-hint="Employee Name"]')
page.locator('oj-select-single[label-hint="Department"]')

// ✅ Use data-oj-context
page.locator('[data-oj-context]').filter({ hasText: 'Name' })

// ✅ For JET tables
page.locator('oj-table[aria-label="Employee List"]')
page.locator('oj-table').locator('[data-oj-column-header="name"]')

// ✅ Use slot names
page.locator('[slot="header"]').locator('h1')

// ✅ For navigation
page.locator('oj-navigation-list[id="nav"]')
page.locator('oj-navigation-list-item-content:has-text("Dashboard")')

// ✅ Pierce into JET custom elements
page.locator('oj-button >> button:has-text("Save")')

// ✅ Use chroming attribute
page.locator('oj-button[chroming="callToAction"]')
```

### Configuration Detection
```javascript
const isOracleJET = await page.evaluate(() => 
  !!(window.oj || window.Oracle?.jet ||
     document.querySelector('oj-') ||
     document.querySelector('[data-oj-binding-provider]'))
);
```

---

## 16. Vaadin

### Problematic Patterns
```html
<!-- AVOID: Generated node IDs -->
<vaadin-button id="button-123">

<!-- AVOID: Shadow DOM internal elements -->
<vaadin-text-field>
  #shadow-root
    <input slot="input">
</vaadin-text-field>

<!-- AVOID: Flow-generated IDs -->
<div id="flow-container-1234">
```

### Root Causes
- Heavy Shadow DOM usage
- Server-driven UI updates generate dynamic IDs
- Flow framework (server-side) adds own identifiers

### Recommended Locators
```javascript
// ✅ Use id attribute (if developer-assigned)
page.locator('vaadin-button#submitButton')

// ✅ Use theme attribute (Vaadin theming)
page.locator('vaadin-button[theme="primary"]')
page.locator('vaadin-button[theme*="icon"]')

// ✅ Pierce Shadow DOM
page.locator('vaadin-text-field[label="Name"] >> input')
page.locator('vaadin-combo-box >> input')

// ✅ Use label attribute
page.locator('vaadin-text-field[label="Email"]')
page.locator('vaadin-date-picker[label="Start Date"]')

// ✅ For Vaadin Grid
page.locator('vaadin-grid').locator('vaadin-grid-cell-content:has-text("John")')

// ✅ Use placeholder
page.locator('vaadin-text-field[placeholder="Search..."]')

// ✅ For dialogs
page.locator('vaadin-dialog-overlay').locator('vaadin-button:has-text("OK")')

// ✅ Use slot names
page.locator('[slot="navbar"]').locator('vaadin-button')

// ✅ Combine component + text
page.locator('vaadin-button:has-text("Save")')
page.locator('vaadin-menu-bar-item:has-text("File")')
```

### Configuration Detection
```javascript
const isVaadin = await page.evaluate(() => 
  !!(window.Vaadin || document.querySelector('vaadin-') ||
     document.querySelector('[class^="vaadin-"]'))
);
```

---

## 17. ExtJS / Sencha

### Problematic Patterns
```html
<!-- AVOID: Auto-generated component IDs -->
<div id="ext-comp-1234">
<div id="button-1015-btnEl">

<!-- AVOID: Instance counters -->
<table id="gridview-1052">

<!-- AVOID: Element role suffixes -->
<input id="textfield-1021-inputEl">
```

### Root Causes
- ExtJS generates `{xtype}-{number}` IDs
- Element roles append suffixes (-btnEl, -inputEl, etc.)
- Sequential numbering changes with component order

### Recommended Locators
```javascript
// ✅ Use itemId (ExtJS best practice)
page.locator('[data-itemid="submitButton"]')

// ✅ Use reference (Ext.ComponentQuery style)
page.locator('[data-ref="loginForm"]')

// ✅ Use data-qtip (ExtJS tooltip)
page.locator('[data-qtip="Save changes"]')

// ✅ Use x- prefixed classes (stable by design)
page.locator('.x-btn-primary:has-text("Save")')
page.locator('.x-form-field[placeholder="Username"]')

// ✅ For grids, use column headers
page.locator('.x-column-header:has-text("Name")')
page.locator('.x-grid-row').filter({ hasText: 'John' })

// ✅ Use componentCls (custom class set by dev)
page.locator('.my-custom-button')

// ✅ For combos/selects
page.locator('.x-form-trigger').filter({ has: page.locator('.x-form-text[placeholder="Select..."]') })

// ✅ Use aria-label
page.locator('[aria-label="Search field"]')

// ✅ For panels, use title
page.locator('.x-panel').filter({ has: page.locator('.x-title-text:has-text("Details")') })

// ✅ Navigate from stable parent
page.locator('[id$="-body"]').filter({ hasText: 'Employee Form' }).locator('input')
```

### Configuration Detection
```javascript
const isExtJS = await page.evaluate(() => 
  !!(window.Ext || document.querySelector('[class^="x-"]') ||
     document.querySelector('[id^="ext-"]'))
);
```

---

## 18. GWT (Google Web Toolkit)

### Problematic Patterns
```html
<!-- AVOID: gwt-uid generated IDs -->
<div id="gwt-uid-1234">

<!-- AVOID: Debug IDs (not in production) -->
<div id="gwt-debug-myWidget">

<!-- AVOID: Obfuscated class names -->
<div class="GFLP4DLAB">
```

### Root Causes
- GWT compiles Java to JavaScript, obfuscating names
- gwt-uid IDs are generated at runtime
- Debug IDs only exist in development mode

### Recommended Locators
```javascript
// ✅ Use gwt-debug IDs (if available in test environment)
page.locator('[id^="gwt-debug-"]')
page.locator('#gwt-debug-submitButton')

// ✅ Use ensureDebugId() data attributes
page.locator('[data-debugid="loginForm"]')

// ✅ Use standard GWT class names (stable across compiles)
page.locator('.gwt-Button:has-text("Submit")')
page.locator('.gwt-TextBox[title="Username"]')
page.locator('.gwt-ListBox')

// ✅ For GWT tables
page.locator('.gwt-FlexTable').locator('td:has-text("Name")')

// ✅ Use title attribute (often set in GWT)
page.locator('[title="Click to save"]')

// ✅ Use aria attributes
page.locator('[aria-label="Main menu"]')

// ✅ For dialogs
page.locator('.gwt-DialogBox').locator('.gwt-Button:has-text("OK")')

// ✅ Navigate by structure
page.locator('.gwt-SplitLayoutPanel').locator('.gwt-HTML:has-text("Dashboard")')

// ✅ For rich text editor
page.locator('.gwt-RichTextArea').locator('iframe')
```

### Configuration Detection
```javascript
const isGWT = await page.evaluate(() => 
  !!(window.__gwt_activeModules || window.gwtOnLoad ||
     document.querySelector('[id^="gwt-uid"]') ||
     document.querySelector('[class^="gwt-"]'))
);
```

---

## 19. Apache Wicket

### Problematic Patterns
```html
<!-- AVOID: Path-based wicket IDs -->
<span wicket:id="1a:2b:3c">

<!-- AVOID: Markup-id with counters -->
<div id="id1234">

<!-- AVOID: Versioned form IDs -->
<form id="form:1">
```

### Root Causes
- Wicket uses path-based component addressing
- Auto-generated markup IDs are sequential
- Form versioning adds `:N` suffixes

### Recommended Locators
```javascript
// ✅ Use wicket:id attribute directly
page.locator('[wicket\\:id="submitButton"]')  // Note: escape the colon
page.locator('[wicket\\:id="emailField"]')

// ✅ Use wicketpath attribute (hierarchical)
page.locator('[wicketpath="form_email"]')

// ✅ Use name attribute (Wicket forms)
page.locator('[name="email"]')
page.locator('input[name="password"]')

// ✅ For Wicket Ajax components
page.locator('[data-wicket-ajax-callback]')

// ✅ Use class patterns (often stable)
page.locator('.wicket-modal').locator('button:has-text("Close")')

// ✅ For feedback panels
page.locator('.feedbackPanel').locator('li')

// ✅ Navigate from labeled elements
page.locator('label:has-text("Username")').locator('..').locator('input')

// ✅ For DataTable/DataView
page.locator('table.dataview').locator('tr:has-text("John")')

// ✅ Use title attribute
page.locator('[title="Submit form"]')
```

### Configuration Detection
```javascript
const isWicket = await page.evaluate(() => 
  !!(window.Wicket || document.querySelector('[wicket\\:id]') ||
     document.querySelector('[wicketpath]'))
);
```

---

## 20. Liferay

### Problematic Patterns
```html
<!-- AVOID: Portlet instance IDs -->
<div id="portlet_INSTANCE_abc123">

<!-- AVOID: Instance-prefixed inputs -->
<input id="_INSTANCE_xyz_name">

<!-- AVOID: Alloy UI generated IDs -->
<span id="aui_3_11_0_1_123">
```

### Root Causes
- Portlet instances get unique `_INSTANCE_` identifiers
- Multiple instances of same portlet on page
- AlloyUI (jQuery-like library) generates IDs

### Recommended Locators
```javascript
// ✅ Use data-qa-id (Liferay test attribute)
page.locator('[data-qa-id="submit-button"]')

// ✅ Use name attribute without instance prefix
page.locator('[name$="firstName"]')
page.locator('[name$="_name"]')

// ✅ Use portlet-specific ID suffix
page.locator('[id$="_name"]')
page.locator('[id*="INSTANCE"][id$="submitBtn"]')

// ✅ Use class names (Liferay theme classes are stable)
page.locator('.btn-primary:has-text("Save")')
page.locator('.form-control[placeholder="Name"]')

// ✅ For Liferay Commerce
page.locator('.product-card').filter({ hasText: 'Product Name' })

// ✅ For Liferay 7.x+ with React
page.locator('[data-senna-track]')
page.locator('.lfr-portal-tooltip')

// ✅ Use portlet container + internal selector
page.locator('.portlet-boundary').filter({ hasText: 'Web Content' })
  .locator('input[type="text"]')

// ✅ For Clay components (Liferay's design system)
page.locator('.clay-btn--primary')
page.locator('.clay-dropdown-toggle')

// ✅ Use aria-label
page.locator('[aria-label="Toggle navigation"]')

// ✅ For asset publisher
page.locator('.asset-entry').filter({ hasText: 'Article Title' })
```

### Configuration Detection
```javascript
const isLiferay = await page.evaluate(() => 
  !!(window.Liferay || window.AUI ||
     document.querySelector('[id*="_INSTANCE_"]') ||
     document.querySelector('.portlet-boundary'))
);
```

---

## Universal Helper Function

```javascript
// Unified app detection and locator strategy helper
async function detectAppAndGetStrategy(page) {
  const appType = await page.evaluate(() => {
    // Detection logic for all frameworks
    if (window.sap?.ui?.getCore) return 'sap-ui5';
    if (window.Ext) return 'extjs';
    if (window.ng || document.querySelector('[ng-version]')) return 'angular';
    if (window.__VUE__ || document.querySelector('[data-v-]')) return 'vue';
    if (document.querySelector('[data-reactroot]')) return 'react';
    if (document.querySelector('[class*="lwc-"]') || document.querySelector('lightning-')) return 'salesforce-lwc';
    if (window.Xrm || document.querySelector('[data-id*="fieldControl"]')) return 'dynamics365';
    if (window.g_form || document.querySelector('[id^="sys_"]')) return 'servicenow';
    if (document.querySelector('[data-automation-id]') && document.querySelector('wd-')) return 'workday';
    if (window.pega || document.querySelector('[data-test-id]')) return 'pega';
    if (window.Appian) return 'appian';
    if (document.querySelector('[osblockwidget]')) return 'outsystems';
    if (window.mx || document.querySelector('[mx-name]')) return 'mendix';
    if (window.oj || document.querySelector('oj-')) return 'oracle-jet';
    if (window.Vaadin || document.querySelector('vaadin-')) return 'vaadin';
    if (window.__gwt_activeModules) return 'gwt';
    if (document.querySelector('[wicket\\:id]')) return 'wicket';
    if (window.Liferay || document.querySelector('[id*="_INSTANCE_"]')) return 'liferay';
    if (window.apex || document.querySelector('[id^="apex"]')) return 'oracle-apex';
    if (document.querySelector('[data-aura-rendered-by]')) return 'salesforce-aura';
    return 'generic';
  });
  
  return {
    appType,
    preferredAttributes: getPreferredAttributes(appType),
    avoidPatterns: getAvoidPatterns(appType)
  };
}

function getPreferredAttributes(appType) {
  const attributes = {
    'salesforce-lwc': ['data-id', 'name', 'title', 'data-menuitem-id'],
    'salesforce-aura': ['data-aura-id', 'data-refid', 'class'],
    'angular': ['data-testid', 'formcontrolname', 'aria-label', 'mat-'],
    'react': ['data-testid', 'aria-label', 'role'],
    'vue': ['data-test', 'data-testid', 'data-cy'],
    'sap-ui5': ['id$="--"', 'data-sap-ui', 'title'],
    'dynamics365': ['data-id', 'data-control-name', 'aria-label'],
    'servicenow': ['name*="."', 'data-field', 'aria-label'],
    'workday': ['data-automation-id', 'data-automation-label'],
    'pega': ['data-test-id', 'data-ref', 'node_name'],
    'appian': ['data-testid', 'aria-label', 'placeholder'],
    'outsystems': ['data-widget', 'id$="Input_"', 'name$="Input_"'],
    'mendix': ['mx-name', 'class^="mx-"', 'data-mendix-id'],
    'oracle-jet': ['label-hint', 'data-oj-binding-provider', 'aria-label'],
    'vaadin': ['label', 'theme', 'placeholder'],
    'extjs': ['data-itemid', 'data-ref', 'data-qtip', 'class^="x-"'],
    'gwt': ['id^="gwt-debug-"', 'class^="gwt-"', 'title'],
    'wicket': ['wicket:id', 'wicketpath', 'name'],
    'liferay': ['data-qa-id', 'name$="_"', 'class*="clay-"'],
    'oracle-apex': ['id*="P"', 'data-item', 'data-action'],
    'generic': ['data-testid', 'aria-label', 'name', 'title']
  };
  return attributes[appType] || attributes['generic'];
}

function getAvoidPatterns(appType) {
  const patterns = {
    'salesforce-lwc': [/lwc-[a-z0-9]+/i, /radio-\d+-\d+/, /slds-[a-z_]+$/],
    'angular': [/_ngcontent-[a-z]+-c\d+/, /_nghost/, /ng-reflect-/],
    'react': [/sc-[a-zA-Z]+/, /css-[a-z0-9]+/, /Button_[a-z]+__[a-z0-9]+/i],
    'vue': [/data-v-[a-f0-9]+/],
    'sap-ui5': [/__xmlview\d+--/, /__button\d+/, /__clone\d+/],
    'extjs': [/ext-comp-\d+/, /-\d+-\w+El$/],
    'gwt': [/gwt-uid-\d+/, /^[A-Z0-9]{10}$/],
    'generic': []
  };
  return patterns[appType] || [];
}
```

---

## Summary Table

| Framework | Primary Locator | Secondary Locator | Avoid |
|-----------|----------------|-------------------|-------|
| Salesforce LWC | `data-id`, `name` | `title`, `aria-label` | `lwc-*` classes, `radio-N-N` IDs |
| Salesforce Aura | `data-aura-id` | `data-refid`, classes | `data-aura-rendered-by`, `:` IDs |
| Angular | `data-testid`, `formcontrolname` | `aria-label` | `_ngcontent-*`, `ng-reflect-*` |
| React | `data-testid` | `aria-*`, `role` | CSS-in-JS classes |
| Vue | `data-test`, `data-cy` | Component tags | `data-v-*` attributes |
| SAP UI5 | `id$="--name"` | `data-sap-ui`, `title` | `__xmlview*`, `__button*` |
| Oracle APEX | `P{n}_*` IDs, `data-action` | classes | IR dynamic IDs |
| ServiceNow | `name`, `data-field` | `aria-label` | `sys_` dynamic IDs |
| Workday | `data-automation-id` | Shadow DOM pierce | UUID IDs |
| Dynamics 365 | `data-id`, `data-control-name` | `aria-label` | GUID IDs |
| Pega | `data-test-id`, `data-ref` | `node_name` | `pzLayout_*` IDs |
| Appian | `data-testid` | `aria-label` | `COMPONENT_*` IDs |
| OutSystems | `data-widget`, `id$="Input_"` | `name` | `wt*` suffixes |
| Mendix | `mx-name` | `class^="mx-"` | `mxui_widget_*` IDs |
| Oracle JET | `label-hint` | `data-oj-*` | `oj-*-N` IDs |
| Vaadin | `label`, `theme` | Shadow pierce | `flow-*` IDs |
| ExtJS | `data-itemid`, `data-ref` | `x-*` classes | `ext-comp-*` IDs |
| GWT | `gwt-debug-*` | `gwt-*` classes | `gwt-uid-*` IDs |
| Wicket | `wicket:id`, `wicketpath` | `name` | Path-based IDs |
| Liferay | `data-qa-id` | `name$="_"` | `_INSTANCE_*` IDs |
