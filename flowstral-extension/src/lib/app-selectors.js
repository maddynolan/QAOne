/**
 * AppSelectorConfig - Application-specific selector strategies for enterprise apps
 * Each app has unique DOM patterns, attributes, and quirks
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
      {
        name: 'now-component',
        priority: 85,
        extract: (el) => {
          const tag = el.tagName.toLowerCase();
          if (tag.startsWith('now-')) {
            const label = el.getAttribute('label') || el.getAttribute('config-label');
            return label ? { tag, label } : null;
          }
          return null;
        },
        format: (val) => `${val.tag}[label="${val.label}"]`,
        playwright: (val) => `locator('${val.tag}[label="${val.label}"]')`,
      },
      {
        name: 'glide-element',
        priority: 80,
        extract: (el) => el.getAttribute('glide_element'),
        format: (val) => `[glide_element="${val}"]`,
        playwright: (val) => `locator('[glide_element="${val}"]')`,
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
      {
        name: 'sap-binding',
        priority: 85,
        extract: (el) => el.getAttribute('data-sap-ui-binding'),
        format: (val) => `[data-sap-ui-binding*="${val}"]`,
        playwright: (val) => `locator('[data-sap-ui-binding*="${val}"]')`,
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
      {
        name: 'adf-id',
        priority: 90,
        extract: (el) => {
          const id = el.id;
          if (id && !id.match(/:\d+:/)) return id;
          return null;
        },
        format: (val) => `#${val}`,
        playwright: (val) => `locator('#${val}')`,
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
      {
        name: 'aria-label-dynamics',
        priority: 85,
        extract: (el) => el.getAttribute('aria-label'),
        format: (val) => `[aria-label="${val}"]`,
        playwright: (val) => `getByLabel('${val}')`,
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
      {
        name: 'data-item-title',
        priority: 90,
        extract: (el) => el.getAttribute('data-item-title'),
        format: (val) => `[data-item-title="${val}"]`,
        playwright: (val) => `locator('[data-item-title="${val}"]')`,
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
      {
        name: 'garden-component',
        priority: 90,
        extract: (el) => {
          const gardenId = el.getAttribute('data-garden-id');
          const text = el.textContent?.trim().substring(0, 30);
          return gardenId && text ? { id: gardenId, text } : null;
        },
        format: (val) => `[data-garden-id="${val.id}"]:has-text("${val.text}")`,
        playwright: (val) => `locator('[data-garden-id="${val.id}"]').filter({ hasText: '${val.text}' })`,
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
      {
        name: 'data-button-use',
        priority: 90,
        extract: (el) => el.getAttribute('data-button-use'),
        format: (val) => `[data-button-use="${val}"]`,
        playwright: (val) => `locator('[data-button-use="${val}"]')`,
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
  // MONDAY.COM
  // ============================================================================
  monday: {
    name: 'Monday.com',
    detectPatterns: [
      /monday\.com/i,
    ],
    detectElements: [
      '[data-testid]',
      '.monday-style-',
      '[data-automationid]',
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
        name: 'data-automationid',
        priority: 95,
        extract: (el) => el.getAttribute('data-automationid'),
        format: (val) => `[data-automationid="${val}"]`,
        playwright: (val) => `locator('[data-automationid="${val}"]')`,
      },
    ],
    waitStrategy: 'monday-ready',
    customWait: `await page.waitForLoadState('networkidle');`,
  },

  // ============================================================================
  // QUICKBOOKS
  // ============================================================================
  quickbooks: {
    name: 'QuickBooks',
    detectPatterns: [
      /quickbooks\.intuit\.com/i,
      /qbo\.intuit/i,
    ],
    detectElements: [
      '[data-automation]',
      '[data-cy]',
      '.ids-',
      '[data-automation-id]',
    ],
    selectorStrategies: [
      {
        name: 'data-automation',
        priority: 100,
        extract: (el) => el.getAttribute('data-automation'),
        format: (val) => `[data-automation="${val}"]`,
        playwright: (val) => `locator('[data-automation="${val}"]')`,
      },
      {
        name: 'data-cy',
        priority: 95,
        extract: (el) => el.getAttribute('data-cy'),
        format: (val) => `[data-cy="${val}"]`,
        playwright: (val) => `locator('[data-cy="${val}"]')`,
      },
      {
        name: 'data-automation-id',
        priority: 90,
        extract: (el) => el.getAttribute('data-automation-id'),
        format: (val) => `[data-automation-id="${val}"]`,
        playwright: (val) => `locator('[data-automation-id="${val}"]')`,
      },
    ],
    waitStrategy: 'quickbooks-ready',
    customWait: `await page.waitForSelector('[data-automation]', { state: 'visible' });`,
  },

  // ============================================================================
  // FRESHDESK / FRESHWORKS
  // ============================================================================
  freshdesk: {
    name: 'Freshdesk / Freshworks',
    detectPatterns: [
      /freshdesk\.com/i,
      /freshworks\.com/i,
      /freshservice\.com/i,
    ],
    detectElements: [
      '[data-testid]',
      '[data-aid]',
      '.ember-',
      '[data-controller]',
    ],
    selectorStrategies: [
      {
        name: 'data-aid',
        priority: 100,
        extract: (el) => el.getAttribute('data-aid'),
        format: (val) => `[data-aid="${val}"]`,
        playwright: (val) => `locator('[data-aid="${val}"]')`,
      },
      {
        name: 'data-testid',
        priority: 95,
        extract: (el) => el.getAttribute('data-testid'),
        format: (val) => `[data-testid="${val}"]`,
        playwright: (val) => `getByTestId('${val}')`,
      },
    ],
    waitStrategy: 'freshdesk-ready',
    customWait: `await page.waitForLoadState('networkidle');`,
  },

  // ============================================================================
  // ZOHO
  // ============================================================================
  zoho: {
    name: 'Zoho',
    detectPatterns: [
      /zoho\.com/i,
      /zohocdn\.com/i,
    ],
    detectElements: [
      '[data-zcqa]',
      '[lyte-']',
      '.zc-',
      '[data-reactid]',
    ],
    selectorStrategies: [
      {
        name: 'data-zcqa',
        priority: 100,
        extract: (el) => el.getAttribute('data-zcqa'),
        format: (val) => `[data-zcqa="${val}"]`,
        playwright: (val) => `locator('[data-zcqa="${val}"]')`,
      },
      {
        name: 'lyte-att',
        priority: 90,
        extract: (el) => el.getAttribute('lyte-att'),
        format: (val) => `[lyte-att="${val}"]`,
        playwright: (val) => `locator('[lyte-att="${val}"]')`,
      },
    ],
    waitStrategy: 'zoho-ready',
    customWait: `await page.waitForLoadState('domcontentloaded');`,
  },

  // ============================================================================
  // POWER APPS / POWER PLATFORM
  // ============================================================================
  powerapps: {
    name: 'Microsoft Power Apps',
    detectPatterns: [
      /powerapps\.com/i,
      /make\.powerapps/i,
      /apps\.powerapps/i,
    ],
    detectElements: [
      '[data-control-name]',
      '.appmagic-',
      '[data-bind]',
    ],
    selectorStrategies: [
      {
        name: 'data-control-name',
        priority: 100,
        extract: (el) => el.getAttribute('data-control-name'),
        format: (val) => `[data-control-name="${val}"]`,
        playwright: (val) => `locator('[data-control-name="${val}"]')`,
      },
      {
        name: 'appmagic-control',
        priority: 90,
        extract: (el) => {
          const classes = Array.from(el.classList);
          const appClass = classes.find(c => c.startsWith('appmagic-'));
          return appClass || null;
        },
        format: (val) => `.${val}`,
        playwright: (val) => `locator('.${val}')`,
      },
    ],
    waitStrategy: 'powerapps-ready',
    customWait: `await page.waitForFunction(() => window.PowerAppsClient);`,
  },

  // ============================================================================
  // COUPA
  // ============================================================================
  coupa: {
    name: 'Coupa',
    detectPatterns: [
      /coupahost\.com/i,
      /coupa\.com/i,
    ],
    detectElements: [
      '[data-object-name]',
      '[data-field]',
      '.coupa-',
    ],
    selectorStrategies: [
      {
        name: 'data-object-name',
        priority: 100,
        extract: (el) => el.getAttribute('data-object-name'),
        format: (val) => `[data-object-name="${val}"]`,
        playwright: (val) => `locator('[data-object-name="${val}"]')`,
      },
      {
        name: 'data-field',
        priority: 95,
        extract: (el) => el.getAttribute('data-field'),
        format: (val) => `[data-field="${val}"]`,
        playwright: (val) => `locator('[data-field="${val}"]')`,
      },
    ],
    waitStrategy: 'coupa-ready',
    customWait: `await page.waitForLoadState('networkidle');`,
  },

  // ============================================================================
  // ANAPLAN
  // ============================================================================
  anaplan: {
    name: 'Anaplan',
    detectPatterns: [
      /anaplan\.com/i,
      /app\.anaplan/i,
    ],
    detectElements: [
      '[data-testid]',
      '[data-test]',
      '.anaplan-',
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
        name: 'data-test',
        priority: 95,
        extract: (el) => el.getAttribute('data-test'),
        format: (val) => `[data-test="${val}"]`,
        playwright: (val) => `locator('[data-test="${val}"]')`,
      },
    ],
    waitStrategy: 'anaplan-ready',
    customWait: `await page.waitForSelector('[data-testid]', { state: 'visible' });`,
  },
};

// Export for use
if (typeof window !== 'undefined') {
  window.AppSelectorConfig = AppSelectorConfig;
}

if (typeof module !== 'undefined') {
  module.exports = { AppSelectorConfig };
}
