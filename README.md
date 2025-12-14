# Flowstral Engine

**Enterprise-grade Playwright script generator with auto-healing locators for 25+ enterprise applications**

Flowstral is designed to work with your recorder tool to generate robust, self-healing Playwright test scripts that handle the unique challenges of enterprise web applications like Salesforce, Workday, ServiceNow, SAP, and more.

## Features

- **🔍 Automatic Application Detection**: Identifies 25+ enterprise applications and applies appropriate strategies
- **🔧 Auto-Healing Locators**: Generates multiple locator strategies with automatic fallback
- **🌑 Shadow DOM Support**: Full support for Shadow DOM piercing (Salesforce Lightning, ServiceNow, etc.)
- **🖼️ Frame Handling**: Robust iframe navigation for complex multi-frame applications
- **⏱️ Smart Wait Strategies**: Application-specific wait conditions that know when the app is ready
- **📝 Clean Script Generation**: Produces readable, maintainable Playwright scripts
- **🏗️ Page Object Model**: Optional POM generation for better test organization
- **🩹 Runtime Healing**: Self-healing capabilities during test execution

## Supported Applications

| Application | Shadow DOM | Special Handling |
|-------------|------------|------------------|
| Salesforce Lightning | ✅ | LWC components, Aura |
| Workday | ✅ | UXI widgets |
| ServiceNow | ✅ | Now components |
| SAP Fiori/UI5 | ❌ | UI5 controls |
| Pega | ❌ | Constellation UI |
| Oracle Fusion | ❌ | ADF framework |
| Dynamics 365 | ❌ | PCF controls |
| NetSuite | ❌ | ExtJS widgets |
| SuccessFactors | ❌ | BizX platform |
| Concur | ❌ | Travel/Expense |
| Veeva | ✅ | Vault/CRM (Lightning-based) |
| Coupa | ❌ | Procurement |
| Ariba | ❌ | Sourcing |
| Zendesk | ❌ | Garden components |
| HubSpot | ❌ | React-based |
| Zoho | ✅ | ZC components |
| Jira | ❌ | Atlaskit |
| Confluence | ❌ | Atlaskit |
| Anaplan | ❌ | Grid controls |
| Monday.com | ❌ | Board UI |
| Asana | ❌ | Task UI |
| Tableau | ❌ | Visualizations |
| Power BI | ❌ | Report visuals |
| Freshworks | ❌ | Support widgets |
| Snowflake | ❌ | Worksheets |

## Installation

```bash
npm install flowstral-engine
```

## Quick Start

```typescript
import { createFlowstral } from 'flowstral-engine';

// Initialize Flowstral
const flowstral = createFlowstral({
  generatePageObjects: true,
  includeAutoHealing: true,
});

// Start recording
const session = flowstral.startRecording('My Test');

// Get injection scripts for your recorder
const scripts = flowstral.getInjectionScripts();

// Inject into browser and record...

// Stop and generate script
const result = await flowstral.stopRecording();
console.log(result.script);
```

## Architecture

### 1. Application Detection

Flowstral automatically detects which enterprise application is being tested:

```typescript
import { ApplicationDetector } from 'flowstral-engine';

const detector = new ApplicationDetector();
const script = detector.getDetectionScript();

// Inject into browser, then process results:
const fingerprint = detector.detectApplication(detectionContext);
// Returns: { application: 'salesforce', confidence: 95, shadowDomEnabled: true, ... }
```

### 2. Auto-Healing Locator Engine

Generates multiple locator strategies with automatic prioritization:

```typescript
import { AutoHealingLocatorEngine } from 'flowstral-engine';

const engine = new AutoHealingLocatorEngine(fingerprint);
const locator = engine.generateAutoHealingLocator(element);

// Returns:
// {
//   primary: { type: 'data-attribute', playwrightCode: "page.locator('[data-automation-id=\"save\"]')", ... },
//   fallbacks: [
//     { type: 'role', playwrightCode: "page.getByRole('button', { name: 'Save' })", ... },
//     { type: 'text', playwrightCode: "page.getByText('Save')", ... },
//     ...
//   ],
//   elementSignature: { tagName: 'BUTTON', textContent: 'Save', ... }
// }
```

### 3. Application-Specific Handlers

Each application has custom handling for its unique challenges:

```typescript
import { ApplicationHandlerFactory } from 'flowstral-engine';

const handler = ApplicationHandlerFactory.getHandler(fingerprint);

// Get shadow DOM piercing script
const shadowScript = handler.getShadowDomPiercingScript();

// Get stability wait code
const waitCode = handler.getStabilityWaitCode();

// Get component interaction code
const interactionCode = handler.getComponentInteractionCode(
  component,
  'await element.click()'
);
```

### 4. Script Generation

Generate clean, production-ready Playwright scripts:

```typescript
import { PlaywrightScriptGenerator, PageObjectGenerator } from 'flowstral-engine';

const scriptGen = new PlaywrightScriptGenerator(fingerprint);
const script = scriptGen.generateScript(session);

const pageObjGen = new PageObjectGenerator(fingerprint);
const pageObject = pageObjGen.generatePageObject(session);
```

### 5. Runtime Healing

Self-healing capabilities during test execution:

```typescript
import { createHealingRuntime, createTestUtilities } from 'flowstral-engine';

const healing = createHealingRuntime(page, fingerprint);
const utils = createTestUtilities(page, fingerprint);

// Wait for application-specific loading to complete
await utils.wait.waitForApplicationReady();

// Find element with auto-healing
const element = await healing.findWithHealing(autoHealingLocator);

// Get healing statistics
const stats = healing.getHealingStats();
const suggestions = healing.suggestImprovements();
```

## Locator Strategy Priority

For each application, Flowstral uses a customized priority order:

### Salesforce Lightning
1. `data-target-selection-name` attributes
2. Role-based (`getByRole`)
3. Text-based (`getByText`)
4. Label-based (`getByLabel`)
5. ARIA attributes
6. Test ID attributes
7. CSS selectors
8. XPath (last resort)

### Workday
1. `data-automation-id` attributes
2. `data-uxi-widget-type` attributes
3. Role-based
4. Label-based
5. Text-based
6. CSS selectors

### ServiceNow
1. `data-testid` attributes
2. `sn-atf-*` attributes
3. Role-based
4. Text-based
5. CSS selectors

## Shadow DOM Handling

For applications using Shadow DOM (Salesforce, ServiceNow, Workday), Flowstral:

1. **Records shadow paths**: Tracks the complete path through shadow boundaries
2. **Generates piercing selectors**: Creates locators that work through shadow DOM
3. **Provides fallback strategies**: Multiple ways to reach shadow DOM elements

```typescript
// Generated locator for Salesforce Lightning component
page.locator('lightning-record-form')
    .locator('lightning-input-field[data-field-id="Name"]')
    .locator('input');

// Or using evaluate for complex scenarios
await page.evaluate(() => {
  const host = document.querySelector('lightning-record-form');
  const shadow = host.shadowRoot;
  const input = shadow.querySelector('lightning-input-field');
  return input.shadowRoot.querySelector('input');
});
```

## Wait Strategies

Each application has custom wait conditions:

```typescript
// Salesforce: Wait for Lightning to finish rendering
await page.waitForFunction(() => {
  const spinners = document.querySelectorAll('lightning-spinner');
  const loading = document.querySelector('[data-aura-state="LOADING"]');
  return spinners.length === 0 && !loading;
});

// Workday: Wait for UXI components
await page.waitForFunction(() => {
  const spinners = document.querySelectorAll('.wd-spinner');
  return spinners.length === 0;
});

// SAP Fiori: Wait for UI5 busy indicator
await page.waitForFunction(() => {
  return !sap.ui.core.BusyIndicator.isOpen();
});
```

## Anti-Patterns

Flowstral automatically avoids unstable locators:

| Pattern | Reason | Alternative |
|---------|--------|-------------|
| Aura rendered-by IDs | Change every render | Use data-target-selection-name |
| SAP __id prefixes | Session-specific | Use text or label |
| Oracle ADF pt1: IDs | Dynamic | Use role or text |
| React/Angular hashes | Build-specific | Use test IDs or roles |
| Ember view IDs | Instance-specific | Use data attributes |

## Generated Script Example

```typescript
import { test, expect, Page, Locator } from '@playwright/test';

// Auto-healing locator helper
async function findWithHealing(
  page: Page,
  strategies: { locator: string; type: string }[],
  timeout: number = 10000
): Promise<Locator> {
  for (const strategy of strategies) {
    try {
      let locator: Locator;
      switch (strategy.type) {
        case 'role':
          locator = page.getByRole(strategy.locator as any);
          break;
        case 'text':
          locator = page.getByText(strategy.locator);
          break;
        default:
          locator = page.locator(strategy.locator);
      }
      await locator.waitFor({ state: 'visible', timeout: 2000 });
      return locator;
    } catch (e) {
      continue;
    }
  }
  throw new Error('Element not found');
}

// Workday stability wait
async function waitForWorkday(page: Page) {
  await page.waitForLoadState('networkidle');
  await page.waitForFunction(() => {
    const spinners = document.querySelectorAll('.wd-spinner');
    return spinners.length === 0;
  });
}

test.describe('Workday Automated Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
  });

  test('mycompany.workday.com - 12/6/2024', async ({ page }) => {
    // Navigate to application
    await page.goto('https://mycompany.workday.com/d/home');
    await waitForWorkday(page);

    // Click Time Off button
    const timeOffButton = await findWithHealing(page, [
      { locator: '[data-automation-id="timeOffButton"]', type: 'css' },
      { locator: 'button', type: 'role' },
      { locator: 'Time Off', type: 'text' },
    ]);
    await timeOffButton.click();
    await waitForWorkday(page);

    // Fill start date
    const startDate = await findWithHealing(page, [
      { locator: '[data-automation-id="startDate"]', type: 'css' },
      { locator: 'Start Date', type: 'label' },
    ]);
    await startDate.fill('2024-03-15');

    // Click Submit
    const submitButton = await findWithHealing(page, [
      { locator: '[data-automation-id="submitButton"]', type: 'css' },
      { locator: 'button', type: 'role' },
      { locator: 'Submit', type: 'text' },
    ]);
    await submitButton.click();
  });
});
```

## API Reference

### FlowstralEngine

```typescript
class FlowstralEngine {
  constructor(config?: Partial<FlowstralConfig>);
  startSession(sessionId: string, url: string): RecordingContext;
  processDetectionResult(sessionId: string, data: any): ApplicationFingerprint;
  processElement(sessionId: string, element: any): RecordedElement;
  processAction(sessionId: string, action: any): RecordedAction;
  endSession(sessionId: string): { session, script, pageObject? };
  getInjectionScripts(): { detector, collector, recorder };
}
```

### AutoHealingLocatorEngine

```typescript
class AutoHealingLocatorEngine {
  constructor(fingerprint: ApplicationFingerprint);
  generateAutoHealingLocator(element: RecordedElement): AutoHealingLocator;
}
```

### ApplicationHandlerFactory

```typescript
class ApplicationHandlerFactory {
  static getHandler(fingerprint: ApplicationFingerprint): ApplicationHandler;
}

abstract class ApplicationHandler {
  getShadowDomPiercingScript(): string;
  getCustomWaitConditions(): WaitCondition[];
  transformElement(element: RecordedElement): RecordedElement;
  getFrameHandlingCode(framePath: string[]): string;
  getStabilityWaitCode(): string;
  getComponentInteractionCode(component, action): string;
}
```

### LocatorHealingRuntime

```typescript
class LocatorHealingRuntime {
  constructor(page: Page, application: EnterpriseApplication);
  findWithHealing(locator: AutoHealingLocator, timeout?: number): Promise<Locator>;
  getHealingStats(): HealingStats;
  suggestImprovements(): Suggestion[];
  generateHealingReport(): string;
}
```

## Configuration

```typescript
interface FlowstralConfig {
  // Locator settings
  maxFallbackStrategies: number;        // Default: 5
  preferredLocatorTypes: string[];      // Default: ['role', 'text', 'label', 'testid']
  avoidDynamicSelectors: boolean;       // Default: true
  
  // Script settings
  generatePageObjects: boolean;         // Default: true
  includeComments: boolean;             // Default: true
  includeAutoHealing: boolean;          // Default: true
  testFramework: 'playwright';          // Currently only Playwright
  
  // Recording settings
  captureScreenshots: boolean;          // Default: false
  waitForNetworkIdle: boolean;          // Default: true
  defaultTimeout: number;               // Default: 30000
  
  // Application overrides
  applicationOverrides: {
    [app: string]: Partial<FlowstralConfig>
  };
}
```

## Contributing

Contributions are welcome! Please read our contributing guidelines and submit PRs to our GitHub repository.

## License

MIT License - see LICENSE file for details.

---

**Built for enterprise testing reliability** 🏢
