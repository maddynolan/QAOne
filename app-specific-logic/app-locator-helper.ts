/**
 * App-Specific Locator Strategy Helper for Playwright
 * 
 * This module provides automatic detection of web application frameworks
 * and returns optimized locator strategies for each.
 */

import { Page, Locator } from '@playwright/test';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

type AppType = 
  | 'salesforce-lwc' | 'salesforce-aura' | 'angular' | 'react' | 'vue'
  | 'sap-ui5' | 'oracle-apex' | 'servicenow' | 'workday' | 'dynamics365'
  | 'pega' | 'appian' | 'outsystems' | 'mendix' | 'oracle-jet'
  | 'vaadin' | 'extjs' | 'gwt' | 'wicket' | 'liferay' | 'generic';

interface AppStrategy {
  appType: AppType;
  preferredSelectors: string[];
  avoidPatterns: RegExp[];
  shadowDomApps: boolean;
  customLocators: Record<string, (page: Page, identifier: string) => Locator>;
}

// ============================================================================
// APP DETECTION
// ============================================================================

export async function detectApp(page: Page): Promise<AppType> {
  return await page.evaluate(() => {
    const w = window as any;
    const d = document;
    
    // Salesforce LWC (check first - more specific)
    if (d.querySelector('[class*="lwc-"]') || d.querySelector('lightning-')) {
      return 'salesforce-lwc';
    }
    
    // Salesforce Aura/Lightning Classic
    if (d.querySelector('[data-aura-rendered-by]') || w.Aura || w.$A) {
      return 'salesforce-aura';
    }
    
    // Workday (check before generic React)
    if (d.querySelector('[data-automation-id]') && d.querySelector('wd-')) {
      return 'workday';
    }
    
    // Dynamics 365
    if (w.Xrm || w.Mscrm || d.querySelector('[data-id*="fieldControl"]')) {
      return 'dynamics365';
    }
    
    // ServiceNow
    if (w.g_form || w.GlideRecord || d.querySelector('[id^="sys_"]')) {
      return 'servicenow';
    }
    
    // SAP UI5/Fiori
    if (w.sap?.ui?.getCore || d.querySelector('[id^="__xmlview"]')) {
      return 'sap-ui5';
    }
    
    // Pega
    if (w.pega || d.querySelector('[data-test-id]') && d.querySelector('[class^="pz"]')) {
      return 'pega';
    }
    
    // Angular
    if (w.ng || d.querySelector('[ng-version]') || d.querySelector('[_ngcontent-]')) {
      return 'angular';
    }
    
    // Vue
    if (w.__VUE__ || w.Vue || d.querySelector('[data-v-]')) {
      return 'vue';
    }
    
    // React (generic detection - check after framework-specific)
    if (d.querySelector('[data-reactroot]') || d.querySelector('[data-reactid]') || w.__REACT_DEVTOOLS_GLOBAL_HOOK__) {
      return 'react';
    }
    
    // Oracle JET
    if (w.oj || d.querySelector('oj-')) {
      return 'oracle-jet';
    }
    
    // Vaadin
    if (w.Vaadin || d.querySelector('vaadin-')) {
      return 'vaadin';
    }
    
    // ExtJS/Sencha
    if (w.Ext || d.querySelector('[id^="ext-comp-"]')) {
      return 'extjs';
    }
    
    // GWT
    if (w.__gwt_activeModules || d.querySelector('[id^="gwt-uid"]')) {
      return 'gwt';
    }
    
    // Wicket
    if (w.Wicket || d.querySelector('[wicket\\:id]')) {
      return 'wicket';
    }
    
    // Liferay
    if (w.Liferay || w.AUI || d.querySelector('[id*="_INSTANCE_"]')) {
      return 'liferay';
    }
    
    // Oracle APEX
    if (w.apex || d.querySelector('[id^="apex"]')) {
      return 'oracle-apex';
    }
    
    // Appian
    if (w.Appian || d.querySelector('.SailComponent')) {
      return 'appian';
    }
    
    // OutSystems
    if (d.querySelector('[osblockwidget]') || w.OsApplicationInfo) {
      return 'outsystems';
    }
    
    // Mendix
    if (w.mx || w.mendix || d.querySelector('[mx-name]')) {
      return 'mendix';
    }
    
    return 'generic';
  });
}

// ============================================================================
// STRATEGY CONFIGURATIONS
// ============================================================================

const strategies: Record<AppType, Omit<AppStrategy, 'appType'>> = {
  'salesforce-lwc': {
    preferredSelectors: ['[data-id]', '[name]', '[title]', '[data-menuitem-id]', '[aria-label]'],
    avoidPatterns: [/lwc-[a-z0-9]+/i, /radio-\d+-\d+/, /checkbox-\d+/],
    shadowDomApps: false,
    customLocators: {
      field: (page, name) => page.locator(`[name="${name}"]`),
      lightningInput: (page, label) => page.locator(`lightning-input[label="${label}"]`),
      lightningButton: (page, text) => page.locator(`lightning-button:has-text("${text}")`),
      menuItem: (page, id) => page.locator(`[data-menuitem-id="${id}"]`),
      dataId: (page, id) => page.locator(`[data-id="${id}"]`),
    }
  },
  
  'salesforce-aura': {
    preferredSelectors: ['[data-aura-id]', '[data-refid]', '[class*="force"]'],
    avoidPatterns: [/data-aura-rendered-by/, /\d+:\d+;[a-z]/],
    shadowDomApps: false,
    customLocators: {
      auraId: (page, id) => page.locator(`[data-aura-id="${id}"]`),
      forceComponent: (page, name) => page.locator(`force-${name}`),
    }
  },
  
  'angular': {
    preferredSelectors: ['[data-testid]', '[formcontrolname]', '[data-cy]', '[aria-label]'],
    avoidPatterns: [/_ngcontent-[a-z]+-c\d+/, /_nghost/, /ng-reflect-/],
    shadowDomApps: false,
    customLocators: {
      formControl: (page, name) => page.locator(`[formcontrolname="${name}"]`),
      testId: (page, id) => page.getByTestId(id),
      matInput: (page, label) => page.locator(`mat-form-field:has-text("${label}") input`),
      matButton: (page, text) => page.locator(`button[mat-button]:has-text("${text}")`),
    }
  },
  
  'react': {
    preferredSelectors: ['[data-testid]', '[aria-label]', '[role]'],
    avoidPatterns: [/sc-[a-zA-Z]+\s/, /css-[a-z0-9]+/, /_[a-z]+__[a-z0-9]+$/i],
    shadowDomApps: false,
    customLocators: {
      testId: (page, id) => page.getByTestId(id),
      muiButton: (page, text) => page.locator(`.MuiButton-root:has-text("${text}")`),
      muiInput: (page, label) => page.locator(`.MuiTextField-root:has-text("${label}") input`),
      antButton: (page, text) => page.locator(`.ant-btn:has-text("${text}")`),
    }
  },
  
  'vue': {
    preferredSelectors: ['[data-test]', '[data-testid]', '[data-cy]'],
    avoidPatterns: [/data-v-[a-f0-9]+/],
    shadowDomApps: false,
    customLocators: {
      testId: (page, id) => page.locator(`[data-test="${id}"]`),
      vuetifyBtn: (page, text) => page.locator(`.v-btn:has-text("${text}")`),
      elementBtn: (page, text) => page.locator(`.el-button:has-text("${text}")`),
    }
  },
  
  'sap-ui5': {
    preferredSelectors: ['[id$="--"]', '[data-sap-ui]', '[title]'],
    avoidPatterns: [/__xmlview\d+--/, /__button\d+/, /__clone\d+/],
    shadowDomApps: false,
    customLocators: {
      stableId: (page, suffix) => page.locator(`[id$="--${suffix}"]`),
      sapButton: (page, text) => page.locator(`.sapMBtn:has-text("${text}")`),
      sapInput: (page, placeholder) => page.locator(`.sapMInputBaseInner[placeholder="${placeholder}"]`),
    }
  },
  
  'oracle-apex': {
    preferredSelectors: ['[id^="P"]', '[data-item]', '[data-action]'],
    avoidPatterns: [/apexir_\w+_\d+/],
    shadowDomApps: false,
    customLocators: {
      pageItem: (page, name) => page.locator(`#${name}`),
      button: (page, text) => page.locator(`.t-Button:has-text("${text}")`),
      region: (page, id) => page.locator(`#${id}_region`),
    }
  },
  
  'servicenow': {
    preferredSelectors: ['[name]', '[data-field]', '[aria-label]'],
    avoidPatterns: [/sys_display\.[^"]+\.\d+/],
    shadowDomApps: false,
    customLocators: {
      field: (page, tableField) => page.locator(`[name="${tableField}"]`),
      sysDisplay: (page, field) => page.locator(`[id^="sys_display."][id$=".${field}"]`),
      nowButton: (page, text) => page.locator(`now-button:has-text("${text}")`),
    }
  },
  
  'workday': {
    preferredSelectors: ['[data-automation-id]', '[data-automation-label]', '[data-uxi-widget-type]'],
    avoidPatterns: [/wd-[A-F0-9-]+/i],
    shadowDomApps: true,
    customLocators: {
      automationId: (page, id) => page.locator(`[data-automation-id="${id}"]`),
      widgetType: (page, type) => page.locator(`[data-uxi-widget-type="${type}"]`),
      wdButton: (page, text) => page.locator(`wd-button >> button:has-text("${text}")`),
    }
  },
  
  'dynamics365': {
    preferredSelectors: ['[data-id]', '[data-control-name]', '[aria-label]'],
    avoidPatterns: [/id-[a-f0-9-]{36}/i, /MscrmControls\.\w+_\d+/],
    shadowDomApps: false,
    customLocators: {
      dataId: (page, id) => page.locator(`[data-id="${id}"]`),
      controlName: (page, name) => page.locator(`[data-control-name="${name}"]`),
      fieldControl: (page, field) => page.locator(`[data-id="${field}.fieldControl-text-box-text"]`),
    }
  },
  
  'pega': {
    preferredSelectors: ['[data-test-id]', '[data-ref]', '[node_name]', '[data-ctl]'],
    avoidPatterns: [/pzLayout_\d+/, /pyInput_\d+_\d+/],
    shadowDomApps: false,
    customLocators: {
      testId: (page, id) => page.locator(`[data-test-id="${id}"]`),
      nodeName: (page, name) => page.locator(`[node_name="${name}"]`),
      pzButton: (page, text) => page.locator(`.pzButton:has-text("${text}")`),
    }
  },
  
  'appian': {
    preferredSelectors: ['[data-testid]', '[aria-label]', '[placeholder]'],
    avoidPatterns: [/COMPONENT_\d+/],
    shadowDomApps: false,
    customLocators: {
      testId: (page, id) => page.locator(`[data-testid="${id}"]`),
      sailField: (page, label) => page.locator(`.TextField:has-text("${label}") input`),
    }
  },
  
  'outsystems': {
    preferredSelectors: ['[data-widget]', '[id$="Input_"]', '[name$="Input_"]'],
    avoidPatterns: [/wt\d+/, /_wtForm_/],
    shadowDomApps: false,
    customLocators: {
      widget: (page, type) => page.locator(`[data-widget="${type}"]`),
      inputSuffix: (page, name) => page.locator(`[id$="Input_${name}"]`),
    }
  },
  
  'mendix': {
    preferredSelectors: ['[mx-name]', '[class^="mx-"]', '[data-mendix-id]'],
    avoidPatterns: [/mxui_widget_\w+_\d+/],
    shadowDomApps: false,
    customLocators: {
      mxName: (page, name) => page.locator(`[mx-name="${name}"]`),
      mxInput: (page, label) => page.locator(`label.mx-control-label:has-text("${label}")`).locator('..').locator('input'),
    }
  },
  
  'oracle-jet': {
    preferredSelectors: ['[label-hint]', '[data-oj-binding-provider]', '[aria-label]'],
    avoidPatterns: [/oj-[a-z]+-\d+/],
    shadowDomApps: true,
    customLocators: {
      labelHint: (page, label) => page.locator(`[label-hint="${label}"]`),
      ojButton: (page, text) => page.locator(`oj-button >> button:has-text("${text}")`),
    }
  },
  
  'vaadin': {
    preferredSelectors: ['[label]', '[theme]', '[placeholder]'],
    avoidPatterns: [/flow-container-\d+/],
    shadowDomApps: true,
    customLocators: {
      label: (page, label) => page.locator(`[label="${label}"]`),
      vaadinButton: (page, text) => page.locator(`vaadin-button:has-text("${text}")`),
      vaadinField: (page, label) => page.locator(`vaadin-text-field[label="${label}"] >> input`),
    }
  },
  
  'extjs': {
    preferredSelectors: ['[data-itemid]', '[data-ref]', '[data-qtip]', '[class^="x-"]'],
    avoidPatterns: [/ext-comp-\d+/, /-\d+-\w+El$/],
    shadowDomApps: false,
    customLocators: {
      itemId: (page, id) => page.locator(`[data-itemid="${id}"]`),
      xButton: (page, text) => page.locator(`.x-btn:has-text("${text}")`),
      xField: (page, placeholder) => page.locator(`.x-form-field[placeholder="${placeholder}"]`),
    }
  },
  
  'gwt': {
    preferredSelectors: ['[id^="gwt-debug-"]', '[class^="gwt-"]', '[title]'],
    avoidPatterns: [/gwt-uid-\d+/, /^[A-Z0-9]{10}$/],
    shadowDomApps: false,
    customLocators: {
      debugId: (page, id) => page.locator(`#gwt-debug-${id}`),
      gwtButton: (page, text) => page.locator(`.gwt-Button:has-text("${text}")`),
    }
  },
  
  'wicket': {
    preferredSelectors: ['[wicket\\:id]', '[wicketpath]', '[name]'],
    avoidPatterns: [/id\d+/, /form:\d+/],
    shadowDomApps: false,
    customLocators: {
      wicketId: (page, id) => page.locator(`[wicket\\:id="${id}"]`),
      wicketPath: (page, path) => page.locator(`[wicketpath="${path}"]`),
    }
  },
  
  'liferay': {
    preferredSelectors: ['[data-qa-id]', '[name$="_"]', '[class*="clay-"]'],
    avoidPatterns: [/_INSTANCE_[a-zA-Z0-9]+/, /aui_\d+_\d+_\d+_\d+/],
    shadowDomApps: false,
    customLocators: {
      qaId: (page, id) => page.locator(`[data-qa-id="${id}"]`),
      clayButton: (page, text) => page.locator(`.clay-btn:has-text("${text}")`),
    }
  },
  
  'generic': {
    preferredSelectors: ['[data-testid]', '[aria-label]', '[name]', '[title]', '[placeholder]'],
    avoidPatterns: [],
    shadowDomApps: false,
    customLocators: {
      testId: (page, id) => page.getByTestId(id),
      role: (page, role) => page.getByRole(role as any),
    }
  }
};

// ============================================================================
// MAIN HELPER CLASS
// ============================================================================

export class AppLocator {
  private page: Page;
  private appType: AppType = 'generic';
  private strategy: AppStrategy | null = null;

  constructor(page: Page) {
    this.page = page;
  }

  async initialize(): Promise<AppType> {
    this.appType = await detectApp(this.page);
    this.strategy = {
      appType: this.appType,
      ...strategies[this.appType]
    };
    return this.appType;
  }

  getAppType(): AppType {
    return this.appType;
  }

  getStrategy(): AppStrategy | null {
    return this.strategy;
  }

  /**
   * Check if a selector contains problematic patterns for this app
   */
  isProblematicSelector(selector: string): boolean {
    if (!this.strategy) return false;
    return this.strategy.avoidPatterns.some(pattern => pattern.test(selector));
  }

  /**
   * Get app-specific custom locator
   */
  custom(name: string, identifier: string): Locator {
    if (!this.strategy || !this.strategy.customLocators[name]) {
      throw new Error(`Custom locator '${name}' not found for ${this.appType}`);
    }
    return this.strategy.customLocators[name](this.page, identifier);
  }

  /**
   * Smart locator that uses app-specific strategies
   */
  smart(options: {
    testId?: string;
    name?: string;
    label?: string;
    text?: string;
    title?: string;
    ariaLabel?: string;
    role?: string;
    placeholder?: string;
  }): Locator {
    // Priority based on app type
    switch (this.appType) {
      case 'salesforce-lwc':
        if (options.name) return this.page.locator(`[name="${options.name}"]`);
        if (options.testId) return this.page.locator(`[data-id="${options.testId}"]`);
        if (options.title) return this.page.locator(`[title="${options.title}"]`);
        break;
        
      case 'workday':
        if (options.testId) return this.page.locator(`[data-automation-id="${options.testId}"]`);
        if (options.label) return this.page.locator(`[data-automation-label="${options.label}"]`);
        break;
        
      case 'dynamics365':
        if (options.testId) return this.page.locator(`[data-id="${options.testId}"]`);
        if (options.name) return this.page.locator(`[data-control-name="${options.name}"]`);
        break;
        
      case 'angular':
        if (options.testId) return this.page.getByTestId(options.testId);
        if (options.name) return this.page.locator(`[formcontrolname="${options.name}"]`);
        break;
        
      case 'mendix':
        if (options.name) return this.page.locator(`[mx-name="${options.name}"]`);
        break;
        
      case 'pega':
        if (options.testId) return this.page.locator(`[data-test-id="${options.testId}"]`);
        break;
    }

    // Generic fallbacks
    if (options.testId) return this.page.getByTestId(options.testId);
    if (options.role && options.text) return this.page.getByRole(options.role as any, { name: options.text });
    if (options.label) return this.page.getByLabel(options.label);
    if (options.text) return this.page.getByText(options.text);
    if (options.ariaLabel) return this.page.locator(`[aria-label="${options.ariaLabel}"]`);
    if (options.placeholder) return this.page.locator(`[placeholder="${options.placeholder}"]`);
    if (options.title) return this.page.locator(`[title="${options.title}"]`);
    if (options.name) return this.page.locator(`[name="${options.name}"]`);

    throw new Error('No valid locator option provided');
  }

  /**
   * Get recommendations for a selector
   */
  getRecommendation(problematicSelector: string): string {
    const recommendations: string[] = [];
    
    if (this.strategy) {
      recommendations.push(`For ${this.appType}, prefer: ${this.strategy.preferredSelectors.join(', ')}`);
      
      if (this.strategy.shadowDomApps) {
        recommendations.push('This app uses Shadow DOM. Use >> to pierce shadow roots.');
      }
    }
    
    return recommendations.join('\n');
  }
}

// ============================================================================
// USAGE EXAMPLE
// ============================================================================

/*
import { test, expect } from '@playwright/test';
import { AppLocator } from './app-locator-helper';

test('example with app-specific locators', async ({ page }) => {
  await page.goto('https://my.nmdp.org/s/?language=en_US');
  
  // Initialize the helper - detects the app type
  const locator = new AppLocator(page);
  const appType = await locator.initialize();
  
  console.log(`Detected app: ${appType}`); // 'salesforce-lwc'
  
  // Use smart locators that adapt to the app
  await locator.smart({ name: 'Brain_Injury_Concussion_or_Surgery__c' }).check();
  
  // Or use custom app-specific locators
  await locator.custom('dataId', '31').click();
  await locator.custom('field', 'firstName').fill('John');
  
  // Check if a selector is problematic
  if (locator.isProblematicSelector('lwc-59kp5sov61j')) {
    console.log('Warning: This selector will be unstable!');
    console.log(locator.getRecommendation('lwc-59kp5sov61j'));
  }
});
*/

export default AppLocator;
