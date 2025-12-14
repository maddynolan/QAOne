/**
 * Flowstral - Complete Usage Example
 * Demonstrates how to use the Flowstral engine with your recorder tool
 */

// Playwright types - using any for build, types available at runtime
// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const chromium: any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Browser = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Page = any;

import {
  FlowstralEngine,
  ApplicationDetector,
  AutoHealingLocatorEngine,
  ApplicationHandlerFactory,
  PlaywrightScriptGenerator,
  createTestUtilities,
  createHealingRuntime,
  RecordingSession,
  ApplicationFingerprint,
  RecordedElement,
  RecordedAction,
} from '../src';

// ============================================================================
// PART 1: Basic Usage - Detecting Applications and Generating Scripts
// ============================================================================

async function basicUsageExample() {
  console.log('=== Basic Usage Example ===\n');

  // 1. Initialize the engine
  const engine = new FlowstralEngine({
    generatePageObjects: true,
    includeAutoHealing: true,
    includeComments: true,
  });

  // 2. Start a recording session
  const sessionId = `session_${Date.now()}`;
  const context = engine.startSession(sessionId, 'https://example.salesforce.com');

  // 3. Get injection scripts to inject into the browser
  const scripts = engine.getInjectionScripts();
  console.log('Injection scripts ready:');
  console.log('- Detector script length:', scripts.detector.length);
  console.log('- Collector script length:', scripts.collector.length);
  console.log('- Recorder script length:', scripts.recorder.length);

  // 4. Simulate detection result (in real usage, this comes from the browser)
  const detectionData = {
    application: 'salesforce',
    confidence: 95,
    version: 'Lightning',
    patterns: ['lightning-', 'force-', 'c-'],
    shadowDom: true,
    dynamicPatterns: ['data-aura-rendered-by'],
  };
  const fingerprint = engine.processDetectionResult(sessionId, detectionData);
  console.log('\nDetected application:', fingerprint);

  // 5. Simulate some recorded actions
  const sampleElement: RecordedElement = {
    tagName: 'BUTTON',
    id: '',
    className: 'slds-button slds-button_brand',
    name: '',
    type: 'button',
    text: 'Save',
    placeholder: '',
    ariaLabel: 'Save Record',
    ariaLabelledBy: '',
    ariaDescribedBy: '',
    role: 'button',
    dataAttributes: {
      'data-aura-rendered-by': 'abc123',
      'data-target-selection-name': 'saveButton',
    },
    customAttributes: {},
    xpath: '//button[@class="slds-button slds-button_brand"]',
    cssSelector: 'button.slds-button.slds-button_brand',
    shadowPath: [
      {
        hostSelector: 'lightning-record-form',
        shadowSelector: 'lightning-button',
        depth: 1,
      },
    ],
    boundingRect: { x: 100, y: 200, width: 80, height: 32 },
    isVisible: true,
    isEnabled: true,
    parentInfo: {
      tagName: 'DIV',
      className: 'slds-modal__footer',
      level: 1,
    },
    siblings: [],
    nearbyLabels: [],
    timestamp: Date.now(),
  };

  // 6. Process the element
  const processedElement = engine.processElement(sessionId, sampleElement);
  console.log('\nProcessed element with locators');

  // 7. Process an action
  const action = engine.processAction(sessionId, {
    id: 'action_1',
    type: 'click',
    elementId: processedElement.id,
    timestamp: Date.now(),
    value: null,
  });
  console.log('Processed action:', action.type);

  // 8. End session and generate script
  const result = engine.endSession(sessionId);
  console.log('\n=== Generated Script Preview ===');
  console.log(result.script.substring(0, 500) + '...\n');

  if (result.pageObject) {
    console.log('=== Generated Page Object Preview ===');
    console.log(result.pageObject.substring(0, 500) + '...\n');
  }

  return result;
}

// ============================================================================
// PART 2: Using Auto-Healing Locators
// ============================================================================

async function autoHealingExample() {
  console.log('\n=== Auto-Healing Locator Example ===\n');

  // Create fingerprint for the application
  const fingerprint: ApplicationFingerprint = {
    application: 'salesforce',
    confidence: 95,
    detectionMethod: 'dom-signature',
    shadowDomEnabled: true,
    lightningEnabled: true,
    customComponents: ['lightning-button', 'lightning-input', 'c-custom-component'],
  };

  // Initialize locator engine
  const locatorEngine = new AutoHealingLocatorEngine(fingerprint);

  // Sample element
  const element: RecordedElement = {
    tagName: 'INPUT',
    id: '',
    className: 'slds-input',
    name: 'firstName',
    type: 'text',
    text: '',
    placeholder: 'Enter first name',
    ariaLabel: 'First Name',
    ariaLabelledBy: '',
    ariaDescribedBy: '',
    role: 'textbox',
    dataAttributes: {
      'data-automation-id': 'firstName-input',
    },
    customAttributes: {},
    xpath: '//input[@name="firstName"]',
    cssSelector: 'input.slds-input[name="firstName"]',
    boundingRect: { x: 200, y: 300, width: 300, height: 40 },
    isVisible: true,
    isEnabled: true,
    timestamp: Date.now(),
  };

  // Generate auto-healing locator
  const locator = locatorEngine.generateAutoHealingLocator(element);

  console.log('Primary locator:', locator.primary.type, '-', locator.primary.playwrightCode);
  console.log('\nFallback strategies:');
  locator.fallbacks.slice(0, 5).forEach((fb, i) => {
    console.log(`  ${i + 1}. ${fb.type}: ${fb.playwrightCode}`);
  });

  console.log('\nElement signature:', JSON.stringify(locator.elementSignature, null, 2));

  return locator;
}

// ============================================================================
// PART 3: Application-Specific Handlers
// ============================================================================

async function applicationHandlersExample() {
  console.log('\n=== Application Handlers Example ===\n');

  const applications = [
    'salesforce',
    'workday',
    'servicenow',
    'sap',
    'dynamics365',
    'netsuite',
  ] as const;

  for (const app of applications) {
    const fingerprint: ApplicationFingerprint = {
      application: app,
      confidence: 95,
      detectionMethod: 'dom-signature',
      shadowDomEnabled: app === 'salesforce' || app === 'servicenow',
    };

    const handler = ApplicationHandlerFactory.getHandler(fingerprint);
    const config = handler.getConfig();

    console.log(`\n${app.toUpperCase()}:`);
    console.log(`  Shadow DOM: ${config.shadowDomStrategy.enabled}`);
    console.log(`  Stability wait: ${config.stabilityWait}ms`);
    console.log(`  Locator priorities: ${config.locatorPriorities.slice(0, 4).join(', ')}...`);
    console.log(`  Custom selectors: ${config.customSelectors.length}`);
  }
}

// ============================================================================
// PART 4: Runtime Healing with Test Utilities
// ============================================================================

async function runtimeHealingExample() {
  console.log('\n=== Runtime Healing Example ===\n');

  // This example shows how to use healing runtime during test execution
  // Note: In a real scenario, you would have an actual browser instance

  const browser: Browser = await chromium.launch({ headless: true });
  const page: Page = await browser.newPage();

  try {
    // Navigate to a test page
    await page.goto('https://example.com');

    // Create test utilities
    const fingerprint: ApplicationFingerprint = {
      application: 'unknown',
      confidence: 100,
      detectionMethod: 'url-pattern',
      shadowDomEnabled: false,
    };

    const utils = createTestUtilities(page, fingerprint);
    const healingRuntime = createHealingRuntime(page, fingerprint);

    // Wait for application to be ready
    await utils.wait.waitForApplicationReady(10000);

    // Use retry utility
    const result = await utils.retry.retry(
      async () => {
        const element = page.locator('h1');
        return await element.textContent();
      },
      { maxRetries: 3, baseDelay: 500 }
    );

    console.log('Page title:', result);

    // Get healing stats (empty in this example)
    const stats = healingRuntime.getHealingStats();
    console.log('Healing stats:', stats);

  } finally {
    await browser.close();
  }
}

// ============================================================================
// PART 5: Generating Production-Ready Test Scripts
// ============================================================================

function generateProductionScript() {
  console.log('\n=== Production Script Generation ===\n');

  // Create a mock recording session
  const session: RecordingSession = {
    id: 'session_123',
    startTime: Date.now() - 60000,
    endTime: Date.now(),
    application: {
      application: 'workday',
      confidence: 92,
      detectionMethod: 'dom-signature',
      shadowDomEnabled: true,
    },
    baseUrl: 'https://mycompany.workday.com',
    actions: [
      {
        id: 'action_1',
        type: 'navigate',
        targetUrl: 'https://mycompany.workday.com/d/home',
        timestamp: Date.now() - 50000,
      },
      {
        id: 'action_2',
        type: 'click',
        element: {
          tagName: 'BUTTON',
          text: 'Time Off',
          ariaLabel: 'Time Off',
          role: 'button',
          dataAttributes: { 'data-automation-id': 'timeOffButton' },
          customAttributes: {},
          xpath: '//button[@data-automation-id="timeOffButton"]',
          cssSelector: '[data-automation-id="timeOffButton"]',
          boundingRect: { x: 100, y: 150, width: 120, height: 40 },
          isVisible: true,
          isEnabled: true,
          timestamp: Date.now() - 45000,
        },
        timestamp: Date.now() - 45000,
      },
      {
        id: 'action_3',
        type: 'fill',
        value: '2024-03-15',
        element: {
          tagName: 'INPUT',
          type: 'date',
          placeholder: 'Start Date',
          ariaLabel: 'Start Date',
          dataAttributes: { 'data-automation-id': 'startDate' },
          customAttributes: {},
          xpath: '//input[@data-automation-id="startDate"]',
          cssSelector: '[data-automation-id="startDate"]',
          boundingRect: { x: 200, y: 300, width: 200, height: 40 },
          isVisible: true,
          isEnabled: true,
          timestamp: Date.now() - 40000,
        },
        timestamp: Date.now() - 40000,
      },
      {
        id: 'action_4',
        type: 'click',
        element: {
          tagName: 'BUTTON',
          text: 'Submit',
          ariaLabel: 'Submit Request',
          role: 'button',
          dataAttributes: { 'data-automation-id': 'submitButton' },
          customAttributes: {},
          xpath: '//button[@data-automation-id="submitButton"]',
          cssSelector: '[data-automation-id="submitButton"]',
          boundingRect: { x: 400, y: 500, width: 100, height: 40 },
          isVisible: true,
          isEnabled: true,
          timestamp: Date.now() - 30000,
        },
        timestamp: Date.now() - 30000,
      },
    ],
    pageTransitions: [
      {
        fromUrl: 'https://mycompany.workday.com/d/home',
        toUrl: 'https://mycompany.workday.com/d/timeoff',
        timestamp: Date.now() - 44000,
        type: 'spa-route',
      },
    ],
    errors: [],
    metadata: {
      browserType: 'chromium',
      browserVersion: '120.0.0',
      viewportSize: { width: 1920, height: 1080 },
      userAgent: 'Mozilla/5.0...',
      locale: 'en-US',
      timezone: 'America/New_York',
    },
  };

  // Generate script
  const fingerprint = session.application as ApplicationFingerprint;
  const generator = new PlaywrightScriptGenerator(fingerprint);
  const script = generator.generateScript(session);

  console.log('Generated script:');
  console.log(script.code);

  return script;
}

// ============================================================================
// PART 6: Shadow DOM Handling for Salesforce
// ============================================================================

async function shadowDomExample() {
  console.log('\n=== Shadow DOM Handling Example ===\n');

  const salesforceHandler = ApplicationHandlerFactory.getHandler({
    application: 'salesforce',
    confidence: 95,
    detectionMethod: 'dom-signature',
    shadowDomEnabled: true,
    lightningEnabled: true,
  });

  // Get shadow DOM piercing script
  const piercingScript = salesforceHandler.getShadowDomPiercingScript();
  console.log('Shadow DOM Piercing Script:');
  console.log(piercingScript);

  // Get stability wait code
  const stabilityCode = salesforceHandler.getStabilityWaitCode();
  console.log('\nStability Wait Code:');
  console.log(stabilityCode);

  // Get custom wait conditions
  const waitConditions = salesforceHandler.getCustomWaitConditions();
  console.log('\nCustom Wait Conditions:', waitConditions.length);
}

// ============================================================================
// Main execution
// ============================================================================

async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║       FLOWSTRAL - Enterprise Playwright Script Generator   ║');
  console.log('║                    Complete Usage Examples                  ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  try {
    await basicUsageExample();
    await autoHealingExample();
    await applicationHandlersExample();
    await shadowDomExample();
    generateProductionScript();
    
    // Skip runtime example if no browser is available
    // await runtimeHealingExample();

    console.log('\n✓ All examples completed successfully!');
  } catch (error) {
    console.error('Error running examples:', error);
    process.exit(1);
  }
}

// Run if executed directly
main().catch(console.error);

export {
  basicUsageExample,
  autoHealingExample,
  applicationHandlersExample,
  runtimeHealingExample,
  generateProductionScript,
  shadowDomExample,
};
