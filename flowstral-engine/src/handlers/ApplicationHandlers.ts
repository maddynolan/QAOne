/**
 * Flowstral - Application-Specific Handlers
 * Custom logic for handling unique challenges of each enterprise application
 */

import {
  EnterpriseApplication,
  ApplicationConfig,
  ApplicationFingerprint,
  RecordedElement,
  LocatorStrategy,
  WaitCondition,
  ComponentPattern,
} from '../types';

/**
 * Base Application Handler
 */
export abstract class ApplicationHandler {
  protected app: EnterpriseApplication;
  protected config: ApplicationConfig;

  constructor(app: EnterpriseApplication, config: ApplicationConfig) {
    this.app = app;
    this.config = config;
  }

  abstract getShadowDomPiercingScript(): string;
  abstract getCustomWaitConditions(): WaitCondition[];
  abstract transformElement(element: RecordedElement): RecordedElement;
  abstract getFrameHandlingCode(framePath: string[]): string;
  abstract getStabilityWaitCode(): string;
  abstract getComponentInteractionCode(component: ComponentPattern, action: string): string;

  getConfig(): ApplicationConfig {
    return this.config;
  }
}

/**
 * Salesforce Lightning Handler
 */
export class SalesforceHandler extends ApplicationHandler {
  constructor() {
    super('salesforce', {
      application: 'salesforce',
      shadowDomStrategy: {
        enabled: true,
        piercing: true,
        hostSelectors: ['lightning-', 'c-', 'force-'],
        traversalMethod: 'locator-chain',
      },
      waitStrategies: [
        {
          trigger: 'navigation',
          waitFor: { type: 'networkidle', timeout: 30000 },
          description: 'Wait for Lightning page load',
        },
        {
          trigger: 'click',
          waitFor: { type: 'stable', timeout: 5000 },
          description: 'Wait for Aura re-render',
        },
      ],
      locatorPriorities: ['data-attribute', 'role', 'text', 'label', 'aria', 'testid', 'css', 'xpath'],
      customSelectors: [
        {
          name: 'lightning-input',
          pattern: /lightning-input/,
          locatorTemplate: "lightning-input[data-target-selection-name='$name'] input",
          priority: 90,
        },
        {
          name: 'lightning-button',
          pattern: /lightning-button/,
          locatorTemplate: "lightning-button[name='$name']",
          priority: 90,
        },
      ],
      frameHandling: {
        hasIframes: true,
        frameIdentifiers: [
          { name: 'vfFrameId' },
          { src: /visualforce/i },
        ],
        nestedFrameStrategy: 'sequential',
      },
      componentPatterns: [
        {
          name: 'lightning-combobox',
          selector: 'lightning-combobox',
          innerElementStrategies: ['role', 'data-attribute'],
          waitAfterInteraction: 500,
        },
        {
          name: 'lightning-datepicker',
          selector: 'lightning-datepicker, lightning-calendar',
          innerElementStrategies: ['role', 'text'],
          waitAfterInteraction: 300,
        },
        {
          name: 'lightning-lookup',
          selector: 'lightning-lookup, lightning-base-combobox',
          innerElementStrategies: ['role', 'text', 'data-attribute'],
          waitAfterInteraction: 1000,
        },
        {
          name: 'lightning-modal',
          selector: 'lightning-modal, section[role="dialog"]',
          innerElementStrategies: ['role', 'text'],
          waitAfterInteraction: 500,
        },
      ],
      antiPatterns: [
        {
          description: 'Avoid using Aura IDs',
          pattern: /data-aura-rendered-by="[^"]+"/,
          alternative: 'Use data-target-selection-name or aria-label',
          reason: 'Aura IDs change with each render',
        },
      ],
      stabilityWait: 500,
      networkIdleTimeout: 10000,
    });
  }

  getShadowDomPiercingScript(): string {
    return `
    async function pierceSalesforceShadowDom(page, selectors) {
      const result = await page.evaluate((sels) => {
        function traverseShadow(root, selector) {
          // Try direct query first
          let element = root.querySelector(selector);
          if (element) return element;
          
          // Search through shadow roots
          const allElements = root.querySelectorAll('*');
          for (const el of allElements) {
            if (el.shadowRoot) {
              element = traverseShadow(el.shadowRoot, selector);
              if (element) return element;
            }
          }
          return null;
        }
        
        let current = document;
        for (const sel of sels) {
          current = traverseShadow(current, sel);
          if (!current) return null;
        }
        return current;
      }, selectors);
      
      return result;
    }
    `;
  }

  getCustomWaitConditions(): WaitCondition[] {
    return [
      {
        type: 'custom',
        customCondition: `
          await page.waitForFunction(() => {
            // Wait for Lightning to finish rendering
            const spinners = document.querySelectorAll('lightning-spinner');
            const loading = document.querySelector('[data-aura-state="LOADING"]');
            return spinners.length === 0 && !loading;
          }, { timeout: 30000 });
        `,
      },
      {
        type: 'custom',
        customCondition: `
          await page.waitForFunction(() => {
            // Wait for all Aura actions to complete
            return !window.$A?.clientService?.inFlightXHRs?.();
          }, { timeout: 30000 });
        `,
      },
    ];
  }

  transformElement(element: RecordedElement): RecordedElement {
    // Transform Salesforce-specific elements
    const transformed = { ...element };

    // Extract meaningful data from Aura component IDs
    if (element.dataAttributes['data-aura-rendered-by']) {
      // Try to find more stable attributes
      const targetSelectionName = element.dataAttributes['data-target-selection-name'];
      if (targetSelectionName) {
        transformed.dataAttributes['stable-id'] = targetSelectionName;
      }
    }

    // Handle Lightning Web Component slots
    if (element.tagName.toLowerCase().includes('slot')) {
      transformed.tagName = element.parentInfo?.tagName || element.tagName;
    }

    return transformed;
  }

  getFrameHandlingCode(framePath: string[]): string {
    let code = 'const frame = page';
    for (const frame of framePath) {
      if (frame.includes('vf')) {
        code += `.frameLocator('iframe[name*="vf"]')`;
      } else {
        code += `.frameLocator('iframe[src*="${frame}"]')`;
      }
    }
    return code;
  }

  getStabilityWaitCode(): string {
    return `
    // Salesforce stability wait
    await page.waitForLoadState('networkidle');
    await page.waitForFunction(() => {
      const spinners = document.querySelectorAll('lightning-spinner, .slds-spinner');
      return spinners.length === 0;
    });
    await page.waitForTimeout(500); // Additional buffer for Aura re-renders
    `;
  }

  getComponentInteractionCode(component: ComponentPattern, action: string): string {
    switch (component.name) {
      case 'lightning-combobox':
        return `
          // Lightning Combobox interaction
          await locator.click();
          await page.waitForSelector('lightning-base-combobox-item', { state: 'visible' });
          ${action}
          await page.waitForTimeout(${component.waitAfterInteraction});
        `;
      case 'lightning-lookup':
        return `
          // Lightning Lookup interaction
          await locator.locator('input').fill(searchText);
          await page.waitForTimeout(500); // Wait for search
          await page.waitForSelector('lightning-base-combobox-item', { state: 'visible' });
          ${action}
          await page.waitForTimeout(${component.waitAfterInteraction});
        `;
      case 'lightning-datepicker':
        return `
          // Lightning Datepicker interaction
          await locator.click();
          await page.waitForSelector('lightning-calendar', { state: 'visible' });
          ${action}
          await page.waitForTimeout(${component.waitAfterInteraction});
        `;
      default:
        return action;
    }
  }
}

/**
 * Workday Handler
 */
export class WorkdayHandler extends ApplicationHandler {
  constructor() {
    super('workday', {
      application: 'workday',
      shadowDomStrategy: {
        enabled: true,
        piercing: true,
        hostSelectors: ['wd-'],
        traversalMethod: 'locator-chain',
      },
      waitStrategies: [
        {
          trigger: 'navigation',
          waitFor: { type: 'networkidle', timeout: 60000 },
          description: 'Wait for Workday page load',
        },
        {
          trigger: 'click',
          waitFor: { type: 'stable', timeout: 10000 },
          description: 'Wait for async update',
        },
      ],
      locatorPriorities: ['data-attribute', 'testid', 'role', 'label', 'text', 'aria', 'css', 'xpath'],
      customSelectors: [
        {
          name: 'workday-input',
          pattern: /data-automation-id=".*input.*"/i,
          locatorTemplate: "[data-automation-id='$id']",
          priority: 95,
        },
      ],
      frameHandling: {
        hasIframes: true,
        frameIdentifiers: [
          { src: /wd-ui/i },
        ],
        nestedFrameStrategy: 'sequential',
      },
      componentPatterns: [
        {
          name: 'wd-popup',
          selector: 'wd-popup, [role="dialog"]',
          innerElementStrategies: ['data-attribute', 'role'],
          waitAfterInteraction: 500,
        },
        {
          name: 'wd-dropdown',
          selector: '[data-automation-widget="dropdown"]',
          innerElementStrategies: ['data-attribute', 'text'],
          waitAfterInteraction: 300,
        },
      ],
      antiPatterns: [],
      stabilityWait: 1000,
      networkIdleTimeout: 30000,
    });
  }

  getShadowDomPiercingScript(): string {
    return `
    async function pierceWorkdayShadowDom(page, selector) {
      return await page.locator(selector).first();
    }
    `;
  }

  getCustomWaitConditions(): WaitCondition[] {
    return [
      {
        type: 'custom',
        customCondition: `
          await page.waitForFunction(() => {
            // Wait for Workday spinners to disappear
            const spinners = document.querySelectorAll('[data-automation-widget="spinner"], .wd-loading');
            return spinners.length === 0;
          }, { timeout: 60000 });
        `,
      },
    ];
  }

  transformElement(element: RecordedElement): RecordedElement {
    const transformed = { ...element };
    
    // Workday uses data-automation-id extensively
    if (element.dataAttributes['data-automation-id']) {
      transformed.dataAttributes['stable-id'] = element.dataAttributes['data-automation-id'];
    }

    return transformed;
  }

  getFrameHandlingCode(framePath: string[]): string {
    return `const frame = page.frameLocator('iframe').first()`;
  }

  getStabilityWaitCode(): string {
    return `
    // Workday stability wait
    await page.waitForLoadState('networkidle');
    await page.waitForFunction(() => {
      const spinners = document.querySelectorAll('[data-automation-widget="spinner"]');
      return spinners.length === 0;
    }, { timeout: 60000 });
    await page.waitForTimeout(1000);
    `;
  }

  getComponentInteractionCode(component: ComponentPattern, action: string): string {
    return action;
  }
}

/**
 * ServiceNow Handler
 */
export class ServiceNowHandler extends ApplicationHandler {
  constructor() {
    super('servicenow', {
      application: 'servicenow',
      shadowDomStrategy: {
        enabled: true,
        piercing: true,
        hostSelectors: ['now-', 'sn-'],
        traversalMethod: 'locator-chain',
      },
      waitStrategies: [
        {
          trigger: 'navigation',
          waitFor: { type: 'networkidle', timeout: 30000 },
          description: 'Wait for ServiceNow page load',
        },
      ],
      locatorPriorities: ['data-attribute', 'testid', 'role', 'text', 'label', 'aria', 'css', 'xpath'],
      customSelectors: [
        {
          name: 'now-input',
          pattern: /now-input/,
          locatorTemplate: "now-input[label='$label']",
          priority: 90,
        },
        {
          name: 'now-button',
          pattern: /now-button/,
          locatorTemplate: "now-button[label='$label']",
          priority: 90,
        },
      ],
      frameHandling: {
        hasIframes: true,
        frameIdentifiers: [
          { name: 'gsft_main' },
          { src: /nav_to\.do/i },
        ],
        nestedFrameStrategy: 'sequential',
      },
      componentPatterns: [
        {
          name: 'now-dropdown',
          selector: 'now-dropdown',
          innerElementStrategies: ['data-attribute', 'text'],
          waitAfterInteraction: 300,
        },
        {
          name: 'now-modal',
          selector: 'now-modal, [role="dialog"]',
          innerElementStrategies: ['role', 'text'],
          waitAfterInteraction: 500,
        },
      ],
      antiPatterns: [],
      stabilityWait: 500,
      networkIdleTimeout: 15000,
    });
  }

  getShadowDomPiercingScript(): string {
    return `
    async function pierceServiceNowShadowDom(page, selectors) {
      // ServiceNow Seismic components use shadow DOM
      const result = await page.evaluate((sels) => {
        function findInShadow(root, selector) {
          let element = root.querySelector(selector);
          if (element) return element;
          
          const hosts = root.querySelectorAll('*');
          for (const host of hosts) {
            if (host.shadowRoot) {
              element = findInShadow(host.shadowRoot, selector);
              if (element) return element;
            }
          }
          return null;
        }
        
        let current = document;
        for (const sel of sels) {
          current = findInShadow(current, sel);
          if (!current) break;
        }
        return !!current;
      }, selectors);
      
      return result;
    }
    `;
  }

  getCustomWaitConditions(): WaitCondition[] {
    return [
      {
        type: 'custom',
        customCondition: `
          await page.waitForFunction(() => {
            // Wait for NOW loading states
            const loading = document.querySelector('.loading, now-loading');
            return !loading;
          }, { timeout: 30000 });
        `,
      },
    ];
  }

  transformElement(element: RecordedElement): RecordedElement {
    return element;
  }

  getFrameHandlingCode(framePath: string[]): string {
    if (framePath.includes('gsft_main')) {
      return `const frame = page.frameLocator('[name="gsft_main"]')`;
    }
    return `const frame = page.frameLocator('iframe').first()`;
  }

  getStabilityWaitCode(): string {
    return `
    // ServiceNow stability wait
    await page.waitForLoadState('domcontentloaded');
    await page.waitForFunction(() => !document.querySelector('.loading'));
    await page.waitForTimeout(500);
    `;
  }

  getComponentInteractionCode(component: ComponentPattern, action: string): string {
    return action;
  }
}

/**
 * SAP Fiori/UI5 Handler
 */
export class SAPHandler extends ApplicationHandler {
  constructor() {
    super('sap', {
      application: 'sap',
      shadowDomStrategy: {
        enabled: true,
        piercing: true,
        hostSelectors: ['ui5-'],
        traversalMethod: 'locator-chain',
      },
      waitStrategies: [
        {
          trigger: 'navigation',
          waitFor: { type: 'networkidle', timeout: 30000 },
          description: 'Wait for UI5 bootstrap',
        },
      ],
      locatorPriorities: ['data-attribute', 'role', 'label', 'text', 'aria', 'testid', 'css', 'xpath'],
      customSelectors: [
        {
          name: 'sap-input',
          pattern: /sap\.m\.Input/,
          locatorTemplate: "[data-sap-ui-type='sap.m.Input']",
          priority: 85,
        },
      ],
      frameHandling: {
        hasIframes: true,
        frameIdentifiers: [],
        nestedFrameStrategy: 'sequential',
      },
      componentPatterns: [
        {
          name: 'ui5-select',
          selector: 'ui5-select, [data-sap-ui-type*="Select"]',
          innerElementStrategies: ['data-attribute', 'role'],
          waitAfterInteraction: 500,
        },
        {
          name: 'ui5-dialog',
          selector: 'ui5-dialog, [role="dialog"]',
          innerElementStrategies: ['role', 'text'],
          waitAfterInteraction: 300,
        },
      ],
      antiPatterns: [
        {
          description: 'Avoid auto-generated IDs',
          pattern: /^__[a-z]+\d+-/,
          alternative: 'Use stable custom data attributes',
          reason: 'SAP UI5 generates IDs dynamically',
        },
      ],
      stabilityWait: 500,
      networkIdleTimeout: 15000,
    });
  }

  getShadowDomPiercingScript(): string {
    return `
    async function pierceSAPShadowDom(page, selector) {
      // UI5 web components use shadow DOM
      return await page.locator(\`\${selector}\`).first();
    }
    `;
  }

  getCustomWaitConditions(): WaitCondition[] {
    return [
      {
        type: 'custom',
        customCondition: `
          await page.waitForFunction(() => {
            // Wait for SAP UI5 to be ready
            return window.sap && window.sap.ui && window.sap.ui.getCore().isInitialized();
          }, { timeout: 30000 });
        `,
      },
      {
        type: 'custom',
        customCondition: `
          await page.waitForFunction(() => {
            // Wait for busy indicators
            const busy = document.querySelectorAll('[aria-busy="true"], .sapUiLocalBusyIndicator');
            return busy.length === 0;
          }, { timeout: 30000 });
        `,
      },
    ];
  }

  transformElement(element: RecordedElement): RecordedElement {
    const transformed = { ...element };
    
    // SAP uses auto-generated IDs starting with __
    if (element.id && element.id.startsWith('__')) {
      // Try to use sap-ui-type instead
      const sapType = element.dataAttributes['data-sap-ui-type'];
      if (sapType) {
        transformed.customAttributes['sap-type'] = sapType;
      }
    }

    return transformed;
  }

  getFrameHandlingCode(framePath: string[]): string {
    return `const frame = page`;
  }

  getStabilityWaitCode(): string {
    return `
    // SAP UI5 stability wait
    await page.waitForFunction(() => {
      if (!window.sap?.ui?.getCore) return false;
      return !window.sap.ui.getCore().getUIDirty();
    }, { timeout: 30000 });
    await page.waitForTimeout(500);
    `;
  }

  getComponentInteractionCode(component: ComponentPattern, action: string): string {
    return action;
  }
}

/**
 * Pega Handler
 */
export class PegaHandler extends ApplicationHandler {
  constructor() {
    super('pega', {
      application: 'pega',
      shadowDomStrategy: {
        enabled: false,
        piercing: false,
        hostSelectors: [],
        traversalMethod: 'evaluate',
      },
      waitStrategies: [
        {
          trigger: 'navigation',
          waitFor: { type: 'networkidle', timeout: 30000 },
          description: 'Wait for Pega page load',
        },
      ],
      locatorPriorities: ['testid', 'data-attribute', 'role', 'label', 'text', 'aria', 'css', 'xpath'],
      customSelectors: [
        {
          name: 'pega-input',
          pattern: /data-test-id/,
          locatorTemplate: "[data-test-id='$id']",
          priority: 95,
        },
      ],
      frameHandling: {
        hasIframes: true,
        frameIdentifiers: [
          { name: 'PegaGadget' },
          { src: /prweb/i },
        ],
        nestedFrameStrategy: 'sequential',
      },
      componentPatterns: [
        {
          name: 'pega-modal',
          selector: '[role="dialog"], .modal-dialog',
          innerElementStrategies: ['testid', 'role'],
          waitAfterInteraction: 500,
        },
      ],
      antiPatterns: [],
      stabilityWait: 500,
      networkIdleTimeout: 15000,
    });
  }

  getShadowDomPiercingScript(): string {
    return '// Pega does not use shadow DOM';
  }

  getCustomWaitConditions(): WaitCondition[] {
    return [
      {
        type: 'custom',
        customCondition: `
          await page.waitForFunction(() => {
            const spinners = document.querySelectorAll('.loading-indicator, .pega-loading');
            return spinners.length === 0;
          }, { timeout: 30000 });
        `,
      },
    ];
  }

  transformElement(element: RecordedElement): RecordedElement {
    return element;
  }

  getFrameHandlingCode(framePath: string[]): string {
    return `const frame = page.frameLocator('iframe[name*="PegaGadget"]')`;
  }

  getStabilityWaitCode(): string {
    return `
    // Pega stability wait
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);
    `;
  }

  getComponentInteractionCode(component: ComponentPattern, action: string): string {
    return action;
  }
}

/**
 * Oracle Fusion Handler
 */
export class OracleFusionHandler extends ApplicationHandler {
  constructor() {
    super('oracle-fusion', {
      application: 'oracle-fusion',
      shadowDomStrategy: {
        enabled: false,
        piercing: false,
        hostSelectors: [],
        traversalMethod: 'evaluate',
      },
      waitStrategies: [
        {
          trigger: 'navigation',
          waitFor: { type: 'networkidle', timeout: 60000 },
          description: 'Wait for ADF page load',
        },
      ],
      locatorPriorities: ['data-attribute', 'role', 'label', 'text', 'aria', 'css', 'xpath'],
      customSelectors: [],
      frameHandling: {
        hasIframes: true,
        frameIdentifiers: [],
        nestedFrameStrategy: 'sequential',
      },
      componentPatterns: [
        {
          name: 'adf-dialog',
          selector: '[role="dialog"], .af_dialog',
          innerElementStrategies: ['role', 'text'],
          waitAfterInteraction: 500,
        },
      ],
      antiPatterns: [
        {
          description: 'Avoid ADF auto-generated IDs',
          pattern: /pt1:|:oracle\.adf\./,
          alternative: 'Use text or label based locators',
          reason: 'Oracle ADF generates complex dynamic IDs',
        },
      ],
      stabilityWait: 1000,
      networkIdleTimeout: 30000,
    });
  }

  getShadowDomPiercingScript(): string {
    return '// Oracle Fusion does not use shadow DOM';
  }

  getCustomWaitConditions(): WaitCondition[] {
    return [
      {
        type: 'custom',
        customCondition: `
          await page.waitForFunction(() => {
            // Wait for ADF busy state
            const busy = document.querySelector('.AFBusyIndicator, [af\\\\:message]');
            return !busy;
          }, { timeout: 60000 });
        `,
      },
    ];
  }

  transformElement(element: RecordedElement): RecordedElement {
    const transformed = { ...element };
    
    // Oracle Fusion has complex IDs like "pt1:r1:0:t1:2:cl1"
    if (element.id && element.id.includes(':')) {
      // Strip the instance-specific parts
      const parts = element.id.split(':');
      const stableId = parts.filter(p => !p.match(/^\d+$/)).join(':');
      if (stableId) {
        transformed.customAttributes['stable-partial-id'] = stableId;
      }
    }

    return transformed;
  }

  getFrameHandlingCode(framePath: string[]): string {
    return `const frame = page`;
  }

  getStabilityWaitCode(): string {
    return `
    // Oracle Fusion stability wait
    await page.waitForFunction(() => {
      if (window.AdfPage) {
        return !window.AdfPage.PAGE.isBusy();
      }
      return true;
    }, { timeout: 60000 });
    await page.waitForTimeout(1000);
    `;
  }

  getComponentInteractionCode(component: ComponentPattern, action: string): string {
    return action;
  }
}

/**
 * Dynamics 365 Handler
 */
export class Dynamics365Handler extends ApplicationHandler {
  constructor() {
    super('dynamics365', {
      application: 'dynamics365',
      shadowDomStrategy: {
        enabled: false,
        piercing: false,
        hostSelectors: [],
        traversalMethod: 'evaluate',
      },
      waitStrategies: [
        {
          trigger: 'navigation',
          waitFor: { type: 'networkidle', timeout: 30000 },
          description: 'Wait for Dynamics 365 load',
        },
      ],
      locatorPriorities: ['data-attribute', 'aria', 'role', 'label', 'text', 'testid', 'css', 'xpath'],
      customSelectors: [
        {
          name: 'dynamics-control',
          pattern: /data-id="MscrmControls/,
          locatorTemplate: "[data-id='$id']",
          priority: 90,
        },
      ],
      frameHandling: {
        hasIframes: true,
        frameIdentifiers: [
          { src: /dynamics/i },
        ],
        nestedFrameStrategy: 'sequential',
      },
      componentPatterns: [
        {
          name: 'dynamics-lookup',
          selector: '[data-id*="LookupResultsDropdown"]',
          innerElementStrategies: ['data-attribute', 'role'],
          waitAfterInteraction: 500,
        },
      ],
      antiPatterns: [],
      stabilityWait: 500,
      networkIdleTimeout: 15000,
    });
  }

  getShadowDomPiercingScript(): string {
    return '// Dynamics 365 does not use shadow DOM';
  }

  getCustomWaitConditions(): WaitCondition[] {
    return [
      {
        type: 'custom',
        customCondition: `
          await page.waitForFunction(() => {
            // Wait for Xrm to be ready
            return window.Xrm && !document.querySelector('.ms-Spinner');
          }, { timeout: 30000 });
        `,
      },
    ];
  }

  transformElement(element: RecordedElement): RecordedElement {
    return element;
  }

  getFrameHandlingCode(framePath: string[]): string {
    return `const frame = page`;
  }

  getStabilityWaitCode(): string {
    return `
    // Dynamics 365 stability wait
    await page.waitForLoadState('networkidle');
    await page.waitForFunction(() => !document.querySelector('.ms-Spinner'));
    await page.waitForTimeout(500);
    `;
  }

  getComponentInteractionCode(component: ComponentPattern, action: string): string {
    return action;
  }
}

/**
 * NetSuite Handler
 */
export class NetSuiteHandler extends ApplicationHandler {
  constructor() {
    super('netsuite', {
      application: 'netsuite',
      shadowDomStrategy: {
        enabled: false,
        piercing: false,
        hostSelectors: [],
        traversalMethod: 'evaluate',
      },
      waitStrategies: [
        {
          trigger: 'navigation',
          waitFor: { type: 'networkidle', timeout: 60000 },
          description: 'Wait for NetSuite page load',
        },
        {
          trigger: 'click',
          waitFor: { type: 'stable', timeout: 5000 },
          description: 'Wait for ExtJS component refresh',
        },
      ],
      locatorPriorities: ['data-attribute', 'role', 'label', 'text', 'aria', 'css', 'xpath'],
      customSelectors: [
        {
          name: 'netsuite-field',
          pattern: /id=".*_fs_lbl"/,
          locatorTemplate: "[id$='_fs_lbl']",
          priority: 85,
        },
      ],
      frameHandling: {
        hasIframes: true,
        frameIdentifiers: [
          { name: 'main' },
          { src: /servlet/i },
        ],
        nestedFrameStrategy: 'sequential',
      },
      componentPatterns: [
        {
          name: 'netsuite-dropdown',
          selector: '[id*="inpt_"][type="text"]',
          innerElementStrategies: ['data-attribute', 'text'],
          waitAfterInteraction: 500,
        },
        {
          name: 'netsuite-popup',
          selector: '.dropdownDiv',
          innerElementStrategies: ['text', 'data-attribute'],
          waitAfterInteraction: 300,
        },
      ],
      antiPatterns: [
        {
          description: 'Avoid NetSuite dynamic row IDs',
          pattern: /row\d+|nlrow\d+/,
          alternative: 'Use text or relative position',
          reason: 'Row IDs change with data',
        },
      ],
      stabilityWait: 800,
      networkIdleTimeout: 30000,
    });
  }

  getShadowDomPiercingScript(): string {
    return '// NetSuite does not use shadow DOM';
  }

  getCustomWaitConditions(): WaitCondition[] {
    return [
      {
        type: 'custom',
        customCondition: `
          await page.waitForFunction(() => {
            // Wait for NetSuite specific loading indicators
            const loading = document.querySelector('.ns-loading, #loading');
            const mask = document.querySelector('.x-mask, .ext-el-mask');
            return !loading && !mask;
          }, { timeout: 60000 });
        `,
      },
    ];
  }

  transformElement(element: RecordedElement): RecordedElement {
    const transformed = { ...element };
    
    // NetSuite uses predictable ID patterns for form fields
    if (element.id && element.id.includes('_')) {
      const fieldName = element.id.split('_')[0];
      transformed.customAttributes['netsuite-field'] = fieldName;
    }

    return transformed;
  }

  getFrameHandlingCode(framePath: string[]): string {
    let code = 'const frame = page';
    for (const frame of framePath) {
      code += `.frameLocator('iframe[name="${frame}"], iframe[src*="${frame}"]')`;
    }
    return code;
  }

  getStabilityWaitCode(): string {
    return `
    // NetSuite stability wait
    await page.waitForLoadState('networkidle');
    await page.waitForFunction(() => {
      const loading = document.querySelector('.ns-loading, #loading, .x-mask');
      return !loading;
    });
    await page.waitForTimeout(800);
    `;
  }

  getComponentInteractionCode(component: ComponentPattern, action: string): string {
    if (component.name === 'netsuite-dropdown') {
      return `
        // NetSuite dropdown interaction
        await locator.click();
        await page.waitForSelector('.dropdownDiv', { state: 'visible' });
        ${action}
        await page.waitForTimeout(${component.waitAfterInteraction});
      `;
    }
    return action;
  }
}

/**
 * SuccessFactors Handler
 */
export class SuccessFactorsHandler extends ApplicationHandler {
  constructor() {
    super('successfactors', {
      application: 'successfactors',
      shadowDomStrategy: {
        enabled: false,
        piercing: false,
        hostSelectors: [],
        traversalMethod: 'evaluate',
      },
      waitStrategies: [
        {
          trigger: 'navigation',
          waitFor: { type: 'networkidle', timeout: 45000 },
          description: 'Wait for SuccessFactors page load',
        },
      ],
      locatorPriorities: ['data-attribute', 'testid', 'role', 'label', 'text', 'aria', 'css', 'xpath'],
      customSelectors: [
        {
          name: 'sf-automation',
          pattern: /data-automation-id/,
          locatorTemplate: "[data-automation-id='$id']",
          priority: 95,
        },
      ],
      frameHandling: {
        hasIframes: true,
        frameIdentifiers: [],
        nestedFrameStrategy: 'sequential',
      },
      componentPatterns: [
        {
          name: 'sf-datepicker',
          selector: '[data-automation-id*="date"]',
          innerElementStrategies: ['data-attribute', 'role'],
          waitAfterInteraction: 500,
        },
      ],
      antiPatterns: [
        {
          description: 'Avoid BizX generated IDs',
          pattern: /bizx\d+/,
          alternative: 'Use data-automation-id',
          reason: 'BizX IDs are session-specific',
        },
      ],
      stabilityWait: 600,
      networkIdleTimeout: 20000,
    });
  }

  getShadowDomPiercingScript(): string {
    return '// SuccessFactors does not use shadow DOM';
  }

  getCustomWaitConditions(): WaitCondition[] {
    return [
      {
        type: 'custom',
        customCondition: `
          await page.waitForFunction(() => {
            const spinner = document.querySelector('.bx-spinner, .sfp-loading');
            return !spinner;
          }, { timeout: 45000 });
        `,
      },
    ];
  }

  transformElement(element: RecordedElement): RecordedElement {
    return element;
  }

  getFrameHandlingCode(framePath: string[]): string {
    return `const frame = page`;
  }

  getStabilityWaitCode(): string {
    return `
    // SuccessFactors stability wait
    await page.waitForLoadState('networkidle');
    await page.waitForFunction(() => !document.querySelector('.bx-spinner, .sfp-loading'));
    await page.waitForTimeout(600);
    `;
  }

  getComponentInteractionCode(component: ComponentPattern, action: string): string {
    return action;
  }
}

/**
 * Coupa Handler
 */
export class CoupaHandler extends ApplicationHandler {
  constructor() {
    super('coupa', {
      application: 'coupa',
      shadowDomStrategy: {
        enabled: false,
        piercing: false,
        hostSelectors: [],
        traversalMethod: 'evaluate',
      },
      waitStrategies: [
        {
          trigger: 'navigation',
          waitFor: { type: 'networkidle', timeout: 30000 },
          description: 'Wait for Coupa page load',
        },
      ],
      locatorPriorities: ['testid', 'data-attribute', 'role', 'label', 'text', 'aria', 'css', 'xpath'],
      customSelectors: [
        {
          name: 'coupa-field',
          pattern: /data-coupa-/,
          locatorTemplate: "[data-coupa-$name='$value']",
          priority: 90,
        },
      ],
      frameHandling: {
        hasIframes: false,
        frameIdentifiers: [],
        nestedFrameStrategy: 'sequential',
      },
      componentPatterns: [
        {
          name: 'coupa-select',
          selector: '.coupa-select, [data-coupa-select]',
          innerElementStrategies: ['data-attribute', 'text'],
          waitAfterInteraction: 400,
        },
      ],
      antiPatterns: [],
      stabilityWait: 500,
      networkIdleTimeout: 15000,
    });
  }

  getShadowDomPiercingScript(): string {
    return '// Coupa does not use shadow DOM';
  }

  getCustomWaitConditions(): WaitCondition[] {
    return [
      {
        type: 'custom',
        customCondition: `
          await page.waitForFunction(() => {
            const loading = document.querySelector('.coupa-loading, .spinner');
            return !loading;
          }, { timeout: 30000 });
        `,
      },
    ];
  }

  transformElement(element: RecordedElement): RecordedElement {
    return element;
  }

  getFrameHandlingCode(framePath: string[]): string {
    return `const frame = page`;
  }

  getStabilityWaitCode(): string {
    return `
    // Coupa stability wait
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);
    `;
  }

  getComponentInteractionCode(component: ComponentPattern, action: string): string {
    return action;
  }
}

/**
 * Ariba Handler
 */
export class AribaHandler extends ApplicationHandler {
  constructor() {
    super('ariba', {
      application: 'ariba',
      shadowDomStrategy: {
        enabled: false,
        piercing: false,
        hostSelectors: [],
        traversalMethod: 'evaluate',
      },
      waitStrategies: [
        {
          trigger: 'navigation',
          waitFor: { type: 'networkidle', timeout: 45000 },
          description: 'Wait for Ariba page load',
        },
      ],
      locatorPriorities: ['data-attribute', 'role', 'label', 'text', 'aria', 'testid', 'css', 'xpath'],
      customSelectors: [
        {
          name: 'ariba-awname',
          pattern: /awname/,
          locatorTemplate: "[awname='$name']",
          priority: 95,
        },
        {
          name: 'ariba-aid',
          pattern: /aid/,
          locatorTemplate: "[aid='$id']",
          priority: 90,
        },
      ],
      frameHandling: {
        hasIframes: true,
        frameIdentifiers: [
          { src: /Sourcing|Contract|Procurement/i },
        ],
        nestedFrameStrategy: 'sequential',
      },
      componentPatterns: [
        {
          name: 'ariba-chooser',
          selector: '[awname*="Chooser"], .w-chooser',
          innerElementStrategies: ['data-attribute', 'text'],
          waitAfterInteraction: 600,
        },
        {
          name: 'ariba-popup',
          selector: '.awpop, .w-popup',
          innerElementStrategies: ['data-attribute', 'text'],
          waitAfterInteraction: 400,
        },
      ],
      antiPatterns: [
        {
          description: 'Avoid Ariba session-specific IDs',
          pattern: /_\d{10,}/,
          alternative: 'Use awname attribute',
          reason: 'Timestamp-based IDs change each session',
        },
      ],
      stabilityWait: 700,
      networkIdleTimeout: 25000,
    });
  }

  getShadowDomPiercingScript(): string {
    return '// Ariba does not use shadow DOM';
  }

  getCustomWaitConditions(): WaitCondition[] {
    return [
      {
        type: 'custom',
        customCondition: `
          await page.waitForFunction(() => {
            const loading = document.querySelector('.awbusy, .aw-loading, .w-busy');
            return !loading;
          }, { timeout: 45000 });
        `,
      },
    ];
  }

  transformElement(element: RecordedElement): RecordedElement {
    const transformed = { ...element };
    
    // Prefer awname over id for Ariba elements
    if (element.customAttributes['awname']) {
      transformed.dataAttributes['stable-awname'] = element.customAttributes['awname'];
    }

    return transformed;
  }

  getFrameHandlingCode(framePath: string[]): string {
    let code = 'const frame = page';
    for (const frame of framePath) {
      code += `.frameLocator('iframe[src*="${frame}"]')`;
    }
    return code;
  }

  getStabilityWaitCode(): string {
    return `
    // Ariba stability wait
    await page.waitForLoadState('networkidle');
    await page.waitForFunction(() => {
      const busy = document.querySelector('.awbusy, .aw-loading');
      return !busy;
    });
    await page.waitForTimeout(700);
    `;
  }

  getComponentInteractionCode(component: ComponentPattern, action: string): string {
    if (component.name === 'ariba-chooser') {
      return `
        // Ariba Chooser interaction
        await locator.click();
        await page.waitForSelector('.awpop, .w-popup', { state: 'visible' });
        ${action}
        await page.waitForTimeout(${component.waitAfterInteraction});
      `;
    }
    return action;
  }
}

/**
 * Concur Handler
 */
export class ConcurHandler extends ApplicationHandler {
  constructor() {
    super('concur', {
      application: 'concur',
      shadowDomStrategy: {
        enabled: false,
        piercing: false,
        hostSelectors: [],
        traversalMethod: 'evaluate',
      },
      waitStrategies: [
        {
          trigger: 'navigation',
          waitFor: { type: 'networkidle', timeout: 40000 },
          description: 'Wait for Concur page load',
        },
      ],
      locatorPriorities: ['data-attribute', 'testid', 'role', 'label', 'text', 'aria', 'css', 'xpath'],
      customSelectors: [
        {
          name: 'concur-field',
          pattern: /data-concur-/,
          locatorTemplate: "[data-concur-$name='$value']",
          priority: 90,
        },
      ],
      frameHandling: {
        hasIframes: true,
        frameIdentifiers: [
          { src: /expensereports|travelrequest/i },
        ],
        nestedFrameStrategy: 'sequential',
      },
      componentPatterns: [
        {
          name: 'concur-dropdown',
          selector: '.cnqr-select, [data-concur-dropdown]',
          innerElementStrategies: ['data-attribute', 'text'],
          waitAfterInteraction: 400,
        },
      ],
      antiPatterns: [],
      stabilityWait: 600,
      networkIdleTimeout: 20000,
    });
  }

  getShadowDomPiercingScript(): string {
    return '// Concur does not use shadow DOM';
  }

  getCustomWaitConditions(): WaitCondition[] {
    return [
      {
        type: 'custom',
        customCondition: `
          await page.waitForFunction(() => {
            const loading = document.querySelector('.cnqr-loading, .concur-spinner');
            return !loading;
          }, { timeout: 40000 });
        `,
      },
    ];
  }

  transformElement(element: RecordedElement): RecordedElement {
    return element;
  }

  getFrameHandlingCode(framePath: string[]): string {
    let code = 'const frame = page';
    for (const frame of framePath) {
      code += `.frameLocator('iframe[src*="${frame}"]')`;
    }
    return code;
  }

  getStabilityWaitCode(): string {
    return `
    // Concur stability wait
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(600);
    `;
  }

  getComponentInteractionCode(component: ComponentPattern, action: string): string {
    return action;
  }
}

/**
 * Veeva Handler (Salesforce-based)
 */
export class VeevaHandler extends ApplicationHandler {
  constructor() {
    super('veeva', {
      application: 'veeva',
      shadowDomStrategy: {
        enabled: true, // Veeva uses Salesforce Lightning
        piercing: true,
        hostSelectors: ['lightning-', 'c-', 'veeva-'],
        traversalMethod: 'locator-chain',
      },
      waitStrategies: [
        {
          trigger: 'navigation',
          waitFor: { type: 'networkidle', timeout: 45000 },
          description: 'Wait for Veeva Vault page load',
        },
      ],
      locatorPriorities: ['data-attribute', 'testid', 'role', 'text', 'label', 'aria', 'css', 'xpath'],
      customSelectors: [
        {
          name: 'veeva-field',
          pattern: /data-veeva-/,
          locatorTemplate: "[data-veeva-$name='$value']",
          priority: 95,
        },
      ],
      frameHandling: {
        hasIframes: true,
        frameIdentifiers: [],
        nestedFrameStrategy: 'sequential',
      },
      componentPatterns: [
        {
          name: 'veeva-vault-modal',
          selector: '.vault-modal, [data-veeva-modal]',
          innerElementStrategies: ['data-attribute', 'role', 'text'],
          waitAfterInteraction: 500,
        },
      ],
      antiPatterns: [],
      stabilityWait: 700,
      networkIdleTimeout: 25000,
    });
  }

  getShadowDomPiercingScript(): string {
    // Inherit from Salesforce handler
    return new SalesforceHandler().getShadowDomPiercingScript();
  }

  getCustomWaitConditions(): WaitCondition[] {
    return [
      {
        type: 'custom',
        customCondition: `
          await page.waitForFunction(() => {
            const spinners = document.querySelectorAll('lightning-spinner, .veeva-loading');
            return spinners.length === 0;
          }, { timeout: 45000 });
        `,
      },
    ];
  }

  transformElement(element: RecordedElement): RecordedElement {
    // Use Salesforce transformation logic
    return new SalesforceHandler().transformElement(element);
  }

  getFrameHandlingCode(framePath: string[]): string {
    return new SalesforceHandler().getFrameHandlingCode(framePath);
  }

  getStabilityWaitCode(): string {
    return `
    // Veeva stability wait (Lightning-based)
    await page.waitForLoadState('networkidle');
    await page.waitForFunction(() => {
      const spinners = document.querySelectorAll('lightning-spinner, .veeva-loading');
      return spinners.length === 0;
    });
    await page.waitForTimeout(700);
    `;
  }

  getComponentInteractionCode(component: ComponentPattern, action: string): string {
    return action;
  }
}

/**
 * Zendesk Handler
 */
export class ZendeskHandler extends ApplicationHandler {
  constructor() {
    super('zendesk', {
      application: 'zendesk',
      shadowDomStrategy: {
        enabled: false,
        piercing: false,
        hostSelectors: [],
        traversalMethod: 'evaluate',
      },
      waitStrategies: [
        {
          trigger: 'navigation',
          waitFor: { type: 'networkidle', timeout: 30000 },
          description: 'Wait for Zendesk page load',
        },
      ],
      locatorPriorities: ['data-attribute', 'testid', 'role', 'label', 'text', 'aria', 'css', 'xpath'],
      customSelectors: [
        {
          name: 'garden-element',
          pattern: /data-garden-/,
          locatorTemplate: "[data-garden-$name='$value']",
          priority: 90,
        },
      ],
      frameHandling: {
        hasIframes: true,
        frameIdentifiers: [
          { src: /apps\/frame/i },
        ],
        nestedFrameStrategy: 'sequential',
      },
      componentPatterns: [
        {
          name: 'garden-dropdown',
          selector: '[data-garden-id*="dropdown"]',
          innerElementStrategies: ['data-attribute', 'text'],
          waitAfterInteraction: 300,
        },
      ],
      antiPatterns: [],
      stabilityWait: 400,
      networkIdleTimeout: 15000,
    });
  }

  getShadowDomPiercingScript(): string {
    return '// Zendesk Garden does not use shadow DOM';
  }

  getCustomWaitConditions(): WaitCondition[] {
    return [
      {
        type: 'custom',
        customCondition: `
          await page.waitForFunction(() => {
            const loading = document.querySelector('[data-garden-id*="loading"], .loading-indicator');
            return !loading;
          }, { timeout: 30000 });
        `,
      },
    ];
  }

  transformElement(element: RecordedElement): RecordedElement {
    return element;
  }

  getFrameHandlingCode(framePath: string[]): string {
    let code = 'const frame = page';
    for (const frame of framePath) {
      code += `.frameLocator('iframe[src*="${frame}"]')`;
    }
    return code;
  }

  getStabilityWaitCode(): string {
    return `
    // Zendesk stability wait
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(400);
    `;
  }

  getComponentInteractionCode(component: ComponentPattern, action: string): string {
    return action;
  }
}

/**
 * HubSpot Handler
 */
export class HubSpotHandler extends ApplicationHandler {
  constructor() {
    super('hubspot', {
      application: 'hubspot',
      shadowDomStrategy: {
        enabled: false,
        piercing: false,
        hostSelectors: [],
        traversalMethod: 'evaluate',
      },
      waitStrategies: [
        {
          trigger: 'navigation',
          waitFor: { type: 'networkidle', timeout: 30000 },
          description: 'Wait for HubSpot page load',
        },
      ],
      locatorPriorities: ['testid', 'data-attribute', 'role', 'label', 'text', 'aria', 'css', 'xpath'],
      customSelectors: [
        {
          name: 'hubspot-selenium',
          pattern: /data-selenium-test/,
          locatorTemplate: "[data-selenium-test='$value']",
          priority: 95,
        },
      ],
      frameHandling: {
        hasIframes: false,
        frameIdentifiers: [],
        nestedFrameStrategy: 'sequential',
      },
      componentPatterns: [
        {
          name: 'hubspot-dropdown',
          selector: '[data-selenium-test*="dropdown"], .UISelect',
          innerElementStrategies: ['data-attribute', 'text'],
          waitAfterInteraction: 400,
        },
      ],
      antiPatterns: [],
      stabilityWait: 400,
      networkIdleTimeout: 15000,
    });
  }

  getShadowDomPiercingScript(): string {
    return '// HubSpot does not use shadow DOM';
  }

  getCustomWaitConditions(): WaitCondition[] {
    return [];
  }

  transformElement(element: RecordedElement): RecordedElement {
    return element;
  }

  getFrameHandlingCode(framePath: string[]): string {
    return `const frame = page`;
  }

  getStabilityWaitCode(): string {
    return `
    // HubSpot stability wait
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(400);
    `;
  }

  getComponentInteractionCode(component: ComponentPattern, action: string): string {
    return action;
  }
}

/**
 * Zoho Handler
 */
export class ZohoHandler extends ApplicationHandler {
  constructor() {
    super('zoho', {
      application: 'zoho',
      shadowDomStrategy: {
        enabled: true,
        piercing: true,
        hostSelectors: ['zc-'],
        traversalMethod: 'locator-chain',
      },
      waitStrategies: [
        {
          trigger: 'navigation',
          waitFor: { type: 'networkidle', timeout: 30000 },
          description: 'Wait for Zoho page load',
        },
      ],
      locatorPriorities: ['data-attribute', 'testid', 'role', 'label', 'text', 'aria', 'css', 'xpath'],
      customSelectors: [
        {
          name: 'zoho-zs',
          pattern: /data-zs-/,
          locatorTemplate: "[data-zs-$name='$value']",
          priority: 90,
        },
      ],
      frameHandling: {
        hasIframes: false,
        frameIdentifiers: [],
        nestedFrameStrategy: 'sequential',
      },
      componentPatterns: [],
      antiPatterns: [],
      stabilityWait: 500,
      networkIdleTimeout: 15000,
    });
  }

  getShadowDomPiercingScript(): string {
    return `
    async function pierceZohoShadowDom(page, selectors) {
      return await page.evaluate((sels) => {
        function traverse(root, sel) {
          let el = root.querySelector(sel);
          if (el) return el;
          for (const node of root.querySelectorAll('*')) {
            if (node.shadowRoot) {
              el = traverse(node.shadowRoot, sel);
              if (el) return el;
            }
          }
          return null;
        }
        let current = document;
        for (const s of sels) {
          current = traverse(current, s);
          if (!current) return null;
        }
        return current;
      }, selectors);
    }
    `;
  }

  getCustomWaitConditions(): WaitCondition[] {
    return [];
  }

  transformElement(element: RecordedElement): RecordedElement {
    return element;
  }

  getFrameHandlingCode(framePath: string[]): string {
    return `const frame = page`;
  }

  getStabilityWaitCode(): string {
    return `
    // Zoho stability wait
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);
    `;
  }

  getComponentInteractionCode(component: ComponentPattern, action: string): string {
    return action;
  }
}

/**
 * Jira Handler
 */
export class JiraHandler extends ApplicationHandler {
  constructor() {
    super('jira', {
      application: 'jira',
      shadowDomStrategy: {
        enabled: false,
        piercing: false,
        hostSelectors: [],
        traversalMethod: 'evaluate',
      },
      waitStrategies: [
        {
          trigger: 'navigation',
          waitFor: { type: 'networkidle', timeout: 30000 },
          description: 'Wait for Jira page load',
        },
      ],
      locatorPriorities: ['testid', 'data-attribute', 'role', 'label', 'text', 'aria', 'css', 'xpath'],
      customSelectors: [
        {
          name: 'jira-testid',
          pattern: /data-testid/,
          locatorTemplate: "[data-testid='$value']",
          priority: 95,
        },
      ],
      frameHandling: {
        hasIframes: false,
        frameIdentifiers: [],
        nestedFrameStrategy: 'sequential',
      },
      componentPatterns: [
        {
          name: 'atlaskit-select',
          selector: '[data-ds--]',
          innerElementStrategies: ['testid', 'text'],
          waitAfterInteraction: 300,
        },
      ],
      antiPatterns: [],
      stabilityWait: 400,
      networkIdleTimeout: 15000,
    });
  }

  getShadowDomPiercingScript(): string {
    return '// Jira does not use shadow DOM';
  }

  getCustomWaitConditions(): WaitCondition[] {
    return [];
  }

  transformElement(element: RecordedElement): RecordedElement {
    return element;
  }

  getFrameHandlingCode(framePath: string[]): string {
    return `const frame = page`;
  }

  getStabilityWaitCode(): string {
    return `
    // Jira stability wait
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(400);
    `;
  }

  getComponentInteractionCode(component: ComponentPattern, action: string): string {
    return action;
  }
}

/**
 * Confluence Handler
 */
export class ConfluenceHandler extends ApplicationHandler {
  constructor() {
    super('confluence', {
      application: 'confluence',
      shadowDomStrategy: {
        enabled: false,
        piercing: false,
        hostSelectors: [],
        traversalMethod: 'evaluate',
      },
      waitStrategies: [
        {
          trigger: 'navigation',
          waitFor: { type: 'networkidle', timeout: 30000 },
          description: 'Wait for Confluence page load',
        },
      ],
      locatorPriorities: ['testid', 'data-attribute', 'role', 'label', 'text', 'aria', 'css', 'xpath'],
      customSelectors: [],
      frameHandling: {
        hasIframes: true,
        frameIdentifiers: [
          { src: /editor/i },
        ],
        nestedFrameStrategy: 'sequential',
      },
      componentPatterns: [],
      antiPatterns: [],
      stabilityWait: 500,
      networkIdleTimeout: 15000,
    });
  }

  getShadowDomPiercingScript(): string {
    return '// Confluence does not use shadow DOM';
  }

  getCustomWaitConditions(): WaitCondition[] {
    return [];
  }

  transformElement(element: RecordedElement): RecordedElement {
    return element;
  }

  getFrameHandlingCode(framePath: string[]): string {
    let code = 'const frame = page';
    for (const frame of framePath) {
      code += `.frameLocator('iframe[src*="${frame}"]')`;
    }
    return code;
  }

  getStabilityWaitCode(): string {
    return `
    // Confluence stability wait
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);
    `;
  }

  getComponentInteractionCode(component: ComponentPattern, action: string): string {
    return action;
  }
}

/**
 * Anaplan Handler
 */
export class AnaplanHandler extends ApplicationHandler {
  constructor() {
    super('anaplan', {
      application: 'anaplan',
      shadowDomStrategy: {
        enabled: false,
        piercing: false,
        hostSelectors: [],
        traversalMethod: 'evaluate',
      },
      waitStrategies: [
        {
          trigger: 'navigation',
          waitFor: { type: 'networkidle', timeout: 60000 },
          description: 'Wait for Anaplan model load',
        },
      ],
      locatorPriorities: ['testid', 'data-attribute', 'role', 'label', 'text', 'aria', 'css', 'xpath'],
      customSelectors: [
        {
          name: 'anaplan-cell',
          pattern: /data-cell-/,
          locatorTemplate: "[data-cell-row='$row'][data-cell-col='$col']",
          priority: 85,
        },
      ],
      frameHandling: {
        hasIframes: false,
        frameIdentifiers: [],
        nestedFrameStrategy: 'sequential',
      },
      componentPatterns: [
        {
          name: 'anaplan-grid',
          selector: '.anaplan-grid, [data-grid-id]',
          innerElementStrategies: ['data-attribute'],
          waitAfterInteraction: 500,
        },
      ],
      antiPatterns: [],
      stabilityWait: 800,
      networkIdleTimeout: 30000,
    });
  }

  getShadowDomPiercingScript(): string {
    return '// Anaplan does not use shadow DOM';
  }

  getCustomWaitConditions(): WaitCondition[] {
    return [
      {
        type: 'custom',
        customCondition: `
          await page.waitForFunction(() => {
            const loading = document.querySelector('.anaplan-loading, .model-loading');
            return !loading;
          }, { timeout: 60000 });
        `,
      },
    ];
  }

  transformElement(element: RecordedElement): RecordedElement {
    return element;
  }

  getFrameHandlingCode(framePath: string[]): string {
    return `const frame = page`;
  }

  getStabilityWaitCode(): string {
    return `
    // Anaplan stability wait
    await page.waitForLoadState('networkidle');
    await page.waitForFunction(() => !document.querySelector('.anaplan-loading'));
    await page.waitForTimeout(800);
    `;
  }

  getComponentInteractionCode(component: ComponentPattern, action: string): string {
    return action;
  }
}

/**
 * Monday.com Handler
 */
export class MondayHandler extends ApplicationHandler {
  constructor() {
    super('monday', {
      application: 'monday',
      shadowDomStrategy: {
        enabled: false,
        piercing: false,
        hostSelectors: [],
        traversalMethod: 'evaluate',
      },
      waitStrategies: [
        {
          trigger: 'navigation',
          waitFor: { type: 'networkidle', timeout: 30000 },
          description: 'Wait for Monday.com page load',
        },
      ],
      locatorPriorities: ['testid', 'data-attribute', 'role', 'label', 'text', 'aria', 'css', 'xpath'],
      customSelectors: [],
      frameHandling: {
        hasIframes: false,
        frameIdentifiers: [],
        nestedFrameStrategy: 'sequential',
      },
      componentPatterns: [],
      antiPatterns: [],
      stabilityWait: 400,
      networkIdleTimeout: 15000,
    });
  }

  getShadowDomPiercingScript(): string {
    return '// Monday.com does not use shadow DOM';
  }

  getCustomWaitConditions(): WaitCondition[] {
    return [];
  }

  transformElement(element: RecordedElement): RecordedElement {
    return element;
  }

  getFrameHandlingCode(framePath: string[]): string {
    return `const frame = page`;
  }

  getStabilityWaitCode(): string {
    return `
    // Monday.com stability wait
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(400);
    `;
  }

  getComponentInteractionCode(component: ComponentPattern, action: string): string {
    return action;
  }
}

/**
 * Asana Handler
 */
export class AsanaHandler extends ApplicationHandler {
  constructor() {
    super('asana', {
      application: 'asana',
      shadowDomStrategy: {
        enabled: false,
        piercing: false,
        hostSelectors: [],
        traversalMethod: 'evaluate',
      },
      waitStrategies: [
        {
          trigger: 'navigation',
          waitFor: { type: 'networkidle', timeout: 30000 },
          description: 'Wait for Asana page load',
        },
      ],
      locatorPriorities: ['testid', 'data-attribute', 'role', 'label', 'text', 'aria', 'css', 'xpath'],
      customSelectors: [],
      frameHandling: {
        hasIframes: false,
        frameIdentifiers: [],
        nestedFrameStrategy: 'sequential',
      },
      componentPatterns: [],
      antiPatterns: [],
      stabilityWait: 400,
      networkIdleTimeout: 15000,
    });
  }

  getShadowDomPiercingScript(): string {
    return '// Asana does not use shadow DOM';
  }

  getCustomWaitConditions(): WaitCondition[] {
    return [];
  }

  transformElement(element: RecordedElement): RecordedElement {
    return element;
  }

  getFrameHandlingCode(framePath: string[]): string {
    return `const frame = page`;
  }

  getStabilityWaitCode(): string {
    return `
    // Asana stability wait
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(400);
    `;
  }

  getComponentInteractionCode(component: ComponentPattern, action: string): string {
    return action;
  }
}

/**
 * Tableau Handler
 */
export class TableauHandler extends ApplicationHandler {
  constructor() {
    super('tableau', {
      application: 'tableau',
      shadowDomStrategy: {
        enabled: false,
        piercing: false,
        hostSelectors: [],
        traversalMethod: 'evaluate',
      },
      waitStrategies: [
        {
          trigger: 'navigation',
          waitFor: { type: 'networkidle', timeout: 60000 },
          description: 'Wait for Tableau visualization load',
        },
      ],
      locatorPriorities: ['data-attribute', 'testid', 'role', 'label', 'text', 'aria', 'css', 'xpath'],
      customSelectors: [
        {
          name: 'tableau-viz',
          pattern: /data-tb-test-id/,
          locatorTemplate: "[data-tb-test-id='$id']",
          priority: 90,
        },
      ],
      frameHandling: {
        hasIframes: true,
        frameIdentifiers: [
          { src: /tableau/i },
        ],
        nestedFrameStrategy: 'sequential',
      },
      componentPatterns: [
        {
          name: 'tableau-filter',
          selector: '[data-tb-test-id*="filter"]',
          innerElementStrategies: ['data-attribute'],
          waitAfterInteraction: 1000,
        },
      ],
      antiPatterns: [],
      stabilityWait: 1000,
      networkIdleTimeout: 30000,
    });
  }

  getShadowDomPiercingScript(): string {
    return '// Tableau does not use shadow DOM';
  }

  getCustomWaitConditions(): WaitCondition[] {
    return [
      {
        type: 'custom',
        customCondition: `
          await page.waitForFunction(() => {
            const loading = document.querySelector('.tab-loading, .tabLoadingIndicator');
            return !loading;
          }, { timeout: 60000 });
        `,
      },
    ];
  }

  transformElement(element: RecordedElement): RecordedElement {
    return element;
  }

  getFrameHandlingCode(framePath: string[]): string {
    let code = 'const frame = page';
    for (const frame of framePath) {
      code += `.frameLocator('iframe[src*="${frame}"]')`;
    }
    return code;
  }

  getStabilityWaitCode(): string {
    return `
    // Tableau stability wait
    await page.waitForLoadState('networkidle');
    await page.waitForFunction(() => !document.querySelector('.tab-loading'));
    await page.waitForTimeout(1000);
    `;
  }

  getComponentInteractionCode(component: ComponentPattern, action: string): string {
    if (component.name === 'tableau-filter') {
      return `
        // Tableau filter interaction
        ${action}
        // Wait for visualization update
        await page.waitForTimeout(${component.waitAfterInteraction});
      `;
    }
    return action;
  }
}

/**
 * Power BI Handler
 */
export class PowerBIHandler extends ApplicationHandler {
  constructor() {
    super('power-bi', {
      application: 'power-bi',
      shadowDomStrategy: {
        enabled: false,
        piercing: false,
        hostSelectors: [],
        traversalMethod: 'evaluate',
      },
      waitStrategies: [
        {
          trigger: 'navigation',
          waitFor: { type: 'networkidle', timeout: 60000 },
          description: 'Wait for Power BI report load',
        },
      ],
      locatorPriorities: ['testid', 'data-attribute', 'role', 'label', 'text', 'aria', 'css', 'xpath'],
      customSelectors: [],
      frameHandling: {
        hasIframes: true,
        frameIdentifiers: [
          { src: /powerbi/i },
        ],
        nestedFrameStrategy: 'sequential',
      },
      componentPatterns: [
        {
          name: 'powerbi-slicer',
          selector: '[data-testid*="slicer"]',
          innerElementStrategies: ['testid', 'text'],
          waitAfterInteraction: 800,
        },
      ],
      antiPatterns: [],
      stabilityWait: 800,
      networkIdleTimeout: 30000,
    });
  }

  getShadowDomPiercingScript(): string {
    return '// Power BI does not use shadow DOM';
  }

  getCustomWaitConditions(): WaitCondition[] {
    return [
      {
        type: 'custom',
        customCondition: `
          await page.waitForFunction(() => {
            const loading = document.querySelector('.pbi-loading, [data-loading="true"]');
            return !loading;
          }, { timeout: 60000 });
        `,
      },
    ];
  }

  transformElement(element: RecordedElement): RecordedElement {
    return element;
  }

  getFrameHandlingCode(framePath: string[]): string {
    let code = 'const frame = page';
    for (const frame of framePath) {
      code += `.frameLocator('iframe[src*="${frame}"]')`;
    }
    return code;
  }

  getStabilityWaitCode(): string {
    return `
    // Power BI stability wait
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(800);
    `;
  }

  getComponentInteractionCode(component: ComponentPattern, action: string): string {
    return action;
  }
}

/**
 * Application Handler Factory
 */
export class ApplicationHandlerFactory {
  private static handlers: Map<EnterpriseApplication, ApplicationHandler> = new Map();

  static getHandler(fingerprint: ApplicationFingerprint): ApplicationHandler {
    const app = fingerprint.application;
    
    if (!this.handlers.has(app)) {
      this.handlers.set(app, this.createHandler(app));
    }
    
    return this.handlers.get(app)!;
  }

  private static createHandler(app: EnterpriseApplication): ApplicationHandler {
    switch (app) {
      case 'salesforce':
        return new SalesforceHandler();
      case 'workday':
        return new WorkdayHandler();
      case 'servicenow':
        return new ServiceNowHandler();
      case 'sap':
        return new SAPHandler();
      case 'pega':
        return new PegaHandler();
      case 'oracle-fusion':
        return new OracleFusionHandler();
      case 'dynamics365':
        return new Dynamics365Handler();
      case 'netsuite':
        return new NetSuiteHandler();
      case 'successfactors':
        return new SuccessFactorsHandler();
      case 'concur':
        return new ConcurHandler();
      case 'veeva':
        return new VeevaHandler();
      case 'coupa':
        return new CoupaHandler();
      case 'ariba':
        return new AribaHandler();
      case 'zendesk':
        return new ZendeskHandler();
      case 'hubspot':
        return new HubSpotHandler();
      case 'zoho':
        return new ZohoHandler();
      case 'jira':
        return new JiraHandler();
      case 'confluence':
        return new ConfluenceHandler();
      case 'anaplan':
        return new AnaplanHandler();
      case 'monday':
        return new MondayHandler();
      case 'asana':
        return new AsanaHandler();
      case 'tableau':
        return new TableauHandler();
      case 'power-bi':
        return new PowerBIHandler();
      default:
        return new GenericHandler(app);
    }
  }
}

/**
 * Generic Handler for unknown applications
 */
export class GenericHandler extends ApplicationHandler {
  constructor(app: EnterpriseApplication) {
    super(app, {
      application: app,
      shadowDomStrategy: {
        enabled: false,
        piercing: false,
        hostSelectors: [],
        traversalMethod: 'evaluate',
      },
      waitStrategies: [
        {
          trigger: 'navigation',
          waitFor: { type: 'networkidle', timeout: 30000 },
          description: 'Wait for page load',
        },
      ],
      locatorPriorities: ['role', 'text', 'label', 'testid', 'data-attribute', 'aria', 'css', 'xpath'],
      customSelectors: [],
      frameHandling: {
        hasIframes: false,
        frameIdentifiers: [],
        nestedFrameStrategy: 'sequential',
      },
      componentPatterns: [],
      antiPatterns: [],
      stabilityWait: 500,
      networkIdleTimeout: 15000,
    });
  }

  getShadowDomPiercingScript(): string {
    return '';
  }

  getCustomWaitConditions(): WaitCondition[] {
    return [];
  }

  transformElement(element: RecordedElement): RecordedElement {
    return element;
  }

  getFrameHandlingCode(framePath: string[]): string {
    return `const frame = page`;
  }

  getStabilityWaitCode(): string {
    return `await page.waitForLoadState('networkidle');`;
  }

  getComponentInteractionCode(component: ComponentPattern, action: string): string {
    return action;
  }
}
