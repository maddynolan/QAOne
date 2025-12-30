/**
 * AppSelectorConfig - Application-specific selector strategies for enterprise apps
 * Each app has unique DOM patterns, attributes, and quirks
 * 
 * COPIED from flowstral-extension for parity between web and desktop
 */

const AppSelectorConfig = {
  // ============================================================================
  // SALESFORCE
  // ============================================================================
  salesforce: {
    name: 'Salesforce',
    detectPatterns: [
      /force\.com/i,
      /salesforce\.com/i,
      /lightning\.force/i,
      /\.my\.salesforce/i,
    ],
    detectElements: [
      'lightning-button',
      'lightning-input',
      '[data-aura-rendered-by]',
      '.slds-',
    ],
    selectorStrategies: [
      {
        name: 'data-aura-class',
        priority: 100,
        extract: (el) => el.getAttribute('data-aura-class'),
        format: (val) => `[data-aura-class="${val}"]`,
        playwright: (val) => `locator('[data-aura-class="${val}"]')`,
      },
      {
        name: 'data-target-selection-name',
        priority: 95,
        extract: (el) => el.getAttribute('data-target-selection-name'),
        format: (val) => `[data-target-selection-name="${val}"]`,
        playwright: (val) => `locator('[data-target-selection-name="${val}"]')`,
      },
      {
        name: 'lightning-component',
        priority: 90,
        extract: (el) => {
          const tag = el.tagName.toLowerCase();
          if (tag.startsWith('lightning-')) {
            const label = el.getAttribute('label') || el.getAttribute('name');
            return label ? { tag, label } : null;
          }
          return null;
        },
        format: (val) => `${val.tag}[label="${val.label}"]`,
        playwright: (val) => `locator('${val.tag}[label="${val.label}"]')`,
      },
      {
        name: 'data-refid',
        priority: 85,
        extract: (el) => el.getAttribute('data-refid'),
        format: (val) => `[data-refid="${val}"]`,
        playwright: (val) => `locator('[data-refid="${val}"]')`,
      },
      {
        name: 'slds-class',
        priority: 70,
        extract: (el) => {
          const classes = Array.from(el.classList).filter(c => c.startsWith('slds-'));
          return classes.length > 0 ? classes.slice(0, 2).join('.') : null;
        },
        format: (val) => `.${val}`,
        playwright: (val) => `locator('.${val}')`,
      },
    ],
    waitStrategy: 'aura-ready',
    customWait: `await page.waitForFunction(() => window.$A && window.$A.get);`,
  },

  // ============================================================================
  // SERVICENOW
  // ============================================================================
  servicenow: {
    name: 'ServiceNow',
    detectPatterns: [
      /service-now\.com/i,
      /servicenow\.com/i,
      /\.servicenow\./i,
    ],
    detectElements: [
      '[data-sn-component]',
      '[sys_id]',
      '.sn-widget',
      '[now-button]',
    ],
    selectorStrategies: [
      {
        name: 'data-sn-component',
        priority: 100,
        extract: (el) => el.getAttribute('data-sn-component'),
        format: (val) => `[data-sn-component="${val}"]`,
        playwright: (val) => `locator('[data-sn-component="${val}"]')`,
      },
      {
        name: 'sys_id',
        priority: 95,
        extract: (el) => el.getAttribute('sys_id'),
        format: (val) => `[sys_id="${val}"]`,
        playwright: (val) => `locator('[sys_id="${val}"]')`,
      },
      {
        name: 'field-name',
        priority: 90,
        extract: (el) => el.getAttribute('field') || el.getAttribute('name'),
        format: (val) => `[field="${val}"], [name="${val}"]`,
        playwright: (val) => `locator('[field="${val}"]')`,
      },
    ],
    waitStrategy: 'angular-ready',
    customWait: `await page.waitForFunction(() => !document.querySelector('.loading-icon'));`,
    frameHandling: {
      detect: () => document.querySelector('iframe[name="gsft_main"]'),
      selector: 'iframe[name="gsft_main"]',
    },
  },

  // ============================================================================
  // WORKDAY
  // ============================================================================
  workday: {
    name: 'Workday',
    detectPatterns: [
      /workday\.com/i,
      /myworkday\.com/i,
      /wd\d+\.myworkday/i,
    ],
    detectElements: [
      '[data-automation-id]',
      '[data-uxi-widget-type]',
      '.WDGK',
      '.WDG-',
    ],
    selectorStrategies: [
      {
        name: 'data-automation-id',
        priority: 100,
        extract: (el) => el.getAttribute('data-automation-id'),
        format: (val) => `[data-automation-id="${val}"]`,
        playwright: (val) => `locator('[data-automation-id="${val}"]')`,
      },
      {
        name: 'data-uxi-widget-type',
        priority: 90,
        extract: (el) => {
          const type = el.getAttribute('data-uxi-widget-type');
          const label = el.getAttribute('data-automation-label');
          return type && label ? { type, label } : null;
        },
        format: (val) => `[data-uxi-widget-type="${val.type}"][data-automation-label="${val.label}"]`,
        playwright: (val) => `locator('[data-uxi-widget-type="${val.type}"][data-automation-label="${val.label}"]')`,
      },
      {
        name: 'workday-label',
        priority: 85,
        extract: (el) => el.getAttribute('data-automation-label'),
        format: (val) => `[data-automation-label="${val}"]`,
        playwright: (val) => `locator('[data-automation-label="${val}"]')`,
      },
    ],
    waitStrategy: 'workday-ready',
    customWait: `await page.waitForSelector('[data-automation-id]', { state: 'visible' });`,
  },

  // ============================================================================
  // SAP (UI5/Fiori)
  // ============================================================================
  sap: {
    name: 'SAP',
    detectPatterns: [
      /sap\.com/i,
      /fiori/i,
      /sapcloud/i,
      /hana\.ondemand/i,
    ],
    detectElements: [
      '[data-sap-ui]',
      '.sapM',
      '.sapUi',
      '[data-sap-ui-id]',
    ],
    selectorStrategies: [
      {
        name: 'data-sap-ui-id',
        priority: 100,
        extract: (el) => {
          const id = el.getAttribute('data-sap-ui') || el.id;
          // Filter out dynamic parts
          if (id && !id.match(/__\w+\d+$/)) return id;
          return null;
        },
        format: (val) => `[data-sap-ui="${val}"]`,
        playwright: (val) => `locator('[data-sap-ui="${val}"]')`,
      },
      {
        name: 'sap-component',
        priority: 90,
        extract: (el) => {
          const classes = Array.from(el.classList);
          const sapClass = classes.find(c => c.startsWith('sapM') || c.startsWith('sapUi'));
          const text = el.textContent?.trim().substring(0, 30);
          return sapClass && text ? { class: sapClass, text } : null;
        },
        format: (val) => `.${val.class}:has-text("${val.text}")`,
        playwright: (val) => `locator('.${val.class}').filter({ hasText: '${val.text}' })`,
      },
    ],
    waitStrategy: 'sap-ui5-ready',
    customWait: `await page.waitForFunction(() => window.sap && window.sap.ui && window.sap.ui.getCore().isInitialized());`,
  },

  // ============================================================================
  // ORACLE (ADF/JET)
  // ============================================================================
  oracle: {
    name: 'Oracle',
    detectPatterns: [
      /oracle\.com/i,
      /oraclecloud\.com/i,
      /\.ocp\.oraclecloud/i,
    ],
    detectElements: [
      '[data-afr-]',
      '.af_',
      '.oj-',
      '[data-oj-]',
    ],
    selectorStrategies: [
      {
        name: 'data-afr-fgridcol',
        priority: 100,
        extract: (el) => el.getAttribute('data-afr-fgridcol'),
        format: (val) => `[data-afr-fgridcol="${val}"]`,
        playwright: (val) => `locator('[data-afr-fgridcol="${val}"]')`,
      },
      {
        name: 'oracle-jet',
        priority: 95,
        extract: (el) => {
          const tag = el.tagName.toLowerCase();
          if (tag.startsWith('oj-')) {
            const label = el.getAttribute('label-hint') || el.getAttribute('label');
            return label ? { tag, label } : null;
          }
          return null;
        },
        format: (val) => `${val.tag}[label-hint="${val.label}"]`,
        playwright: (val) => `locator('${val.tag}[label-hint="${val.label}"]')`,
      },
    ],
    waitStrategy: 'oracle-ready',
    customWait: `await page.waitForFunction(() => !document.querySelector('.af_panelSplitter_blocked'));`,
  },

  // ============================================================================
  // MICROSOFT DYNAMICS 365
  // ============================================================================
  dynamics365: {
    name: 'Microsoft Dynamics 365',
    detectPatterns: [
      /dynamics\.com/i,
      /crm\.dynamics/i,
      /\.dynamics\.com/i,
    ],
    detectElements: [
      '[data-id]',
      '[data-lp-id]',
      '.pa-',
      '[data-control-name]',
    ],
    selectorStrategies: [
      {
        name: 'data-id',
        priority: 100,
        extract: (el) => el.getAttribute('data-id'),
        format: (val) => `[data-id="${val}"]`,
        playwright: (val) => `locator('[data-id="${val}"]')`,
      },
      {
        name: 'data-lp-id',
        priority: 95,
        extract: (el) => el.getAttribute('data-lp-id'),
        format: (val) => `[data-lp-id="${val}"]`,
        playwright: (val) => `locator('[data-lp-id="${val}"]')`,
      },
      {
        name: 'data-control-name',
        priority: 90,
        extract: (el) => el.getAttribute('data-control-name'),
        format: (val) => `[data-control-name="${val}"]`,
        playwright: (val) => `locator('[data-control-name="${val}"]')`,
      },
    ],
    waitStrategy: 'dynamics-ready',
    customWait: `await page.waitForSelector('[data-id]', { state: 'visible' });`,
  },

  // ============================================================================
  // JIRA / ATLASSIAN
  // ============================================================================
  jira: {
    name: 'Jira / Atlassian',
    detectPatterns: [
      /atlassian\.net/i,
      /jira\./i,
      /confluence\./i,
      /bitbucket\./i,
    ],
    detectElements: [
      '[data-testid]',
      '[data-test-id]',
      '.css-',
      '[data-vc]',
    ],
    selectorStrategies: [
      {
        name: 'data-testid',
        priority: 100,
        extract: (el) => el.getAttribute('data-testid'),
        format: (val) => `[data-testid="${val}"]`,
        playwright: (val) => `getByTestId('${val}')`,
      },
      {
        name: 'data-test-id',
        priority: 95,
        extract: (el) => el.getAttribute('data-test-id'),
        format: (val) => `[data-test-id="${val}"]`,
        playwright: (val) => `locator('[data-test-id="${val}"]')`,
      },
    ],
    waitStrategy: 'atlassian-ready',
    customWait: `await page.waitForLoadState('networkidle');`,
  },

  // ============================================================================
  // ZENDESK
  // ============================================================================
  zendesk: {
    name: 'Zendesk',
    detectPatterns: [
      /zendesk\.com/i,
      /\.zendesk\./i,
    ],
    detectElements: [
      '[data-test-id]',
      '[data-garden-id]',
      '.StyledButton',
      '[data-baseweb]',
    ],
    selectorStrategies: [
      {
        name: 'data-test-id',
        priority: 100,
        extract: (el) => el.getAttribute('data-test-id'),
        format: (val) => `[data-test-id="${val}"]`,
        playwright: (val) => `locator('[data-test-id="${val}"]')`,
      },
      {
        name: 'data-garden-id',
        priority: 95,
        extract: (el) => el.getAttribute('data-garden-id'),
        format: (val) => `[data-garden-id="${val}"]`,
        playwright: (val) => `locator('[data-garden-id="${val}"]')`,
      },
    ],
    waitStrategy: 'zendesk-ready',
    customWait: `await page.waitForSelector('[data-garden-id]', { state: 'visible' });`,
  },

  // ============================================================================
  // HUBSPOT
  // ============================================================================
  hubspot: {
    name: 'HubSpot',
    detectPatterns: [
      /hubspot\.com/i,
      /hs-sites\.com/i,
      /hubspotusercontent/i,
    ],
    detectElements: [
      '[data-selenium-test]',
      '[data-test-id]',
      '.private-button',
      '.uiButton',
    ],
    selectorStrategies: [
      {
        name: 'data-selenium-test',
        priority: 100,
        extract: (el) => el.getAttribute('data-selenium-test'),
        format: (val) => `[data-selenium-test="${val}"]`,
        playwright: (val) => `locator('[data-selenium-test="${val}"]')`,
      },
      {
        name: 'data-test-id',
        priority: 95,
        extract: (el) => el.getAttribute('data-test-id'),
        format: (val) => `[data-test-id="${val}"]`,
        playwright: (val) => `locator('[data-test-id="${val}"]')`,
      },
    ],
    waitStrategy: 'hubspot-ready',
    customWait: `await page.waitForLoadState('networkidle');`,
  },

  // ============================================================================
  // NETSUITE
  // ============================================================================
  netsuite: {
    name: 'NetSuite',
    detectPatterns: [
      /netsuite\.com/i,
      /\.ns\.com/i,
      /app\.netsuite/i,
    ],
    detectElements: [
      '[id^="custpage_"]',
      '[id^="nlcinputid"]',
      '.uir-',
      '[data-ns-field-type]',
    ],
    selectorStrategies: [
      {
        name: 'custpage-id',
        priority: 100,
        extract: (el) => {
          const id = el.id;
          if (id && id.startsWith('custpage_')) return id;
          return null;
        },
        format: (val) => `#${val}`,
        playwright: (val) => `locator('#${val}')`,
      },
      {
        name: 'data-ns-field',
        priority: 95,
        extract: (el) => el.getAttribute('data-ns-field-type'),
        format: (val) => `[data-ns-field-type="${val}"]`,
        playwright: (val) => `locator('[data-ns-field-type="${val}"]')`,
      },
      {
        name: 'netsuite-name',
        priority: 90,
        extract: (el) => el.getAttribute('name'),
        format: (val) => `[name="${val}"]`,
        playwright: (val) => `locator('[name="${val}"]')`,
      },
    ],
    waitStrategy: 'netsuite-ready',
    customWait: `await page.waitForFunction(() => !document.getElementById('loading'));`,
    frameHandling: {
      detect: () => document.querySelector('iframe[name="main"]'),
      selector: 'iframe[name="main"]',
    },
  },

  // ============================================================================
  // SHOPIFY
  // ============================================================================
  shopify: {
    name: 'Shopify',
    detectPatterns: [
      /shopify\.com/i,
      /myshopify\.com/i,
      /admin\.shopify/i,
    ],
    detectElements: [
      '[data-polaris-unstyled]',
      '.Polaris-',
      '[data-primary-action]',
    ],
    selectorStrategies: [
      {
        name: 'polaris-testid',
        priority: 100,
        extract: (el) => el.getAttribute('data-testid'),
        format: (val) => `[data-testid="${val}"]`,
        playwright: (val) => `getByTestId('${val}')`,
      },
      {
        name: 'polaris-component',
        priority: 90,
        extract: (el) => {
          const classes = Array.from(el.classList);
          const polarisClass = classes.find(c => c.startsWith('Polaris-'));
          return polarisClass || null;
        },
        format: (val) => `.${val}`,
        playwright: (val) => `locator('.${val}')`,
      },
    ],
    waitStrategy: 'shopify-ready',
    customWait: `await page.waitForSelector('.Polaris-Frame', { state: 'visible' });`,
  },

  // ============================================================================
  // SLACK
  // ============================================================================
  slack: {
    name: 'Slack',
    detectPatterns: [
      /slack\.com/i,
      /app\.slack/i,
    ],
    detectElements: [
      '[data-qa]',
      '[data-qa-action]',
      '.c-button',
      '[data-stringify-type]',
    ],
    selectorStrategies: [
      {
        name: 'data-qa',
        priority: 100,
        extract: (el) => el.getAttribute('data-qa'),
        format: (val) => `[data-qa="${val}"]`,
        playwright: (val) => `locator('[data-qa="${val}"]')`,
      },
      {
        name: 'data-qa-action',
        priority: 95,
        extract: (el) => el.getAttribute('data-qa-action'),
        format: (val) => `[data-qa-action="${val}"]`,
        playwright: (val) => `locator('[data-qa-action="${val}"]')`,
      },
    ],
    waitStrategy: 'slack-ready',
    customWait: `await page.waitForSelector('[data-qa]', { state: 'visible' });`,
  },

  // ============================================================================
  // GENERIC (fallback)
  // ============================================================================
  generic: {
    name: 'Generic',
    detectPatterns: [],
    detectElements: [],
    selectorStrategies: [],
    waitStrategy: 'domcontentloaded',
    customWait: `await page.waitForLoadState('domcontentloaded');`,
  },
};

/**
 * Detect which app is currently being used
 */
function detectApp(url) {
  for (const [key, config] of Object.entries(AppSelectorConfig)) {
    if (key === 'generic') continue;
    
    // Check URL patterns
    for (const pattern of config.detectPatterns) {
      if (pattern.test(url)) {
        return { key, config };
      }
    }
  }
  
  return { key: 'generic', config: AppSelectorConfig.generic };
}

/**
 * Detect app from DOM elements
 */
function detectAppFromDOM() {
  for (const [key, config] of Object.entries(AppSelectorConfig)) {
    if (key === 'generic') continue;
    
    // Check for characteristic elements
    for (const selector of config.detectElements) {
      if (document.querySelector(selector)) {
        return { key, config };
      }
    }
  }
  
  return { key: 'generic', config: AppSelectorConfig.generic };
}

// Export for Node.js
if (typeof module !== 'undefined') {
  module.exports = { AppSelectorConfig, detectApp, detectAppFromDOM };
}

// Export for browser
if (typeof window !== 'undefined') {
  window.AppSelectorConfig = AppSelectorConfig;
  window.detectApp = detectApp;
  window.detectAppFromDOM = detectAppFromDOM;
}

