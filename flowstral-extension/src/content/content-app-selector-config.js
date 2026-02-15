/**
 * App Selector Configurations
 * Enterprise app-specific selector strategies for 25+ applications
 * Extracted from content.js for modularity
 *
 * Exposes: window._FlowstralAppSelectorConfig
 */

(function() {
  'use strict';

  window._FlowstralAppSelectorConfig = {
    'salesforce-lwc': {
      name: 'Salesforce LWC',
      detectPatterns: [/force\.com/i, /salesforce\.com/i, /lightning\.force/i],
      detectElements: ['[class*="lwc-"]', 'lightning-'],
      strategies: [
        { attr: 'name', priority: 100, playwright: (val) => `locator('[name="${val}"]')` },
        { attr: 'title', priority: 95, playwright: (val) => `locator('[title="${val}"]')` },
        { attr: 'aria-label', priority: 90, playwright: (val) => `getByLabel('${val}')` },
        { attr: 'data-target-selection-name', priority: 85, playwright: (val) => `locator('[data-target-selection-name="${val}"]')` },
        { attr: 'field-name', priority: 80, playwright: (val) => `locator('[field-name="${val}"]')` },
      ],
      avoidPatterns: [/lwc-[a-z0-9]+/i, /radio-\d+(-\d+)?/, /checkbox-\d+(-\d+)?/, /input-\d+/, /^\d{1,4}$/],
      tagPrefix: 'lightning-',
      customWait: 'domcontentloaded',
    },
    'salesforce-aura': {
      name: 'Salesforce Aura',
      detectPatterns: [/force\.com/i, /salesforce\.com/i],
      detectElements: ['[data-aura-rendered-by]'],
      strategies: [
        { attr: 'data-aura-id', priority: 100, playwright: (val) => `locator('[data-aura-id="${val}"]')` },
        { attr: 'name', priority: 95, playwright: (val) => `locator('[name="${val}"]')` },
        { attr: 'title', priority: 90, playwright: (val) => `locator('[title="${val}"]')` },
      ],
      avoidPatterns: [/data-aura-rendered-by/, /\d+:\d+;[a-z]/, /globalId;\d+/],
      customWait: 'domcontentloaded',
    },
    salesforce: {
      name: 'Salesforce',
      detectPatterns: [/force\.com/i, /salesforce\.com/i, /lightning\.force/i],
      strategies: [
        { attr: 'name', priority: 100, playwright: (val) => `locator('[name="${val}"]')` },
        { attr: 'title', priority: 95, playwright: (val) => `locator('[title="${val}"]')` },
        { attr: 'aria-label', priority: 90, playwright: (val) => `getByLabel('${val}')` },
        { attr: 'data-aura-id', priority: 85, playwright: (val) => `locator('[data-aura-id="${val}"]')` },
      ],
      avoidPatterns: [/lwc-[a-z0-9]+/i, /radio-\d+(-\d+)?/, /checkbox-\d+(-\d+)?/, /^\d{1,4}$/],
      tagPrefix: 'lightning-',
      customWait: 'domcontentloaded',
    },
    servicenow: {
      name: 'ServiceNow',
      detectPatterns: [/service-now\.com/i, /servicenow\.com/i],
      detectElements: ['[id^="sys_"]', '[class*="glide"]'],
      strategies: [
        { attr: 'name', priority: 100, playwright: (val) => {
          if (val.includes('.')) return `locator('[name="${val}"]')`;
          return `locator('[name*="${val}"]')`;
        }},
        { attr: 'data-field', priority: 95, playwright: (val) => `locator('[data-field="${val}"]')` },
        { attr: 'aria-label', priority: 90, playwright: (val) => `locator('[aria-label="${val}"]')` },
        { attr: 'id', priority: 85, playwright: (val) => {
          if (val.includes('sys_display.') && val.includes('.')) {
            const parts = val.split('.');
            return `locator('[id^="sys_display."][id$=".${parts[parts.length-1]}"]')`;
          }
          return `locator('[id$=".${val}"]')`;
        }},
      ],
      avoidPatterns: [/sys_display\.[^"]+\.\d+/],
      tagPrefix: 'now-',
      frameSelector: 'iframe[name="gsft_main"]',
      customWait: 'domcontentloaded',
    },
    workday: {
      name: 'Workday',
      detectPatterns: [/workday\.com/i, /myworkday\.com/i],
      detectElements: ['[data-automation-id]', 'wd-'],
      strategies: [
        { attr: 'data-automation-id', priority: 100, playwright: (val) => `locator('[data-automation-id="${val}"]')` },
        { attr: 'data-automation-label', priority: 95, playwright: (val) => `locator('[data-automation-label="${val}"]')` },
        { attr: 'data-uxi-widget-type', priority: 90, playwright: (val) => `locator('[data-uxi-widget-type="${val}"]')` },
      ],
      avoidPatterns: [/wd-[A-F0-9-]+/i],
      shadowDomApps: true,
      customWait: 'networkidle',
    },
    'sap-ui5': {
      name: 'SAP UI5 / Fiori',
      detectPatterns: [/sap\.com/i, /fiori/i, /sapcloud/i],
      detectElements: ['[id^="__xmlview"]', '[data-sap-ui]'],
      strategies: [
        { attr: 'id', priority: 100, playwright: (val) => {
          if (val.includes('--')) {
            const suffix = val.split('--').pop();
            return `locator('[id$="--${suffix}"]')`;
          }
          return `locator('[id="${val}"]')`;
        }},
        { attr: 'data-sap-ui', priority: 95, playwright: (val) => `locator('[data-sap-ui="${val}"]')` },
        { attr: 'title', priority: 90, playwright: (val) => `locator('[title="${val}"]')` },
      ],
      avoidPatterns: [/__xmlview\d+--/, /__button\d+/, /__clone\d+/],
      classPrefix: ['sapM', 'sapUi'],
      customWait: 'networkidle',
    },
    sap: {
      name: 'SAP',
      detectPatterns: [/sap\.com/i, /fiori/i, /sapcloud/i],
      strategies: [
        { attr: 'data-sap-ui', priority: 100, playwright: (val) => `locator('[data-sap-ui="${val}"]')` },
        { attr: 'title', priority: 90, playwright: (val) => `locator('[title="${val}"]')` },
      ],
      classPrefix: ['sapM', 'sapUi'],
      customWait: 'networkidle',
    },
    oracle: {
      name: 'Oracle',
      detectPatterns: [/oracle\.com/i, /oraclecloud\.com/i],
      strategies: [
        { attr: 'data-afr-fgridcol', priority: 100 },
        { attr: 'label-hint', priority: 90 },
      ],
      tagPrefix: 'oj-',
      customWait: 'networkidle',
    },
    dynamics365: {
      name: 'Microsoft Dynamics 365',
      detectPatterns: [/dynamics\.com/i, /crm\.dynamics/i],
      detectElements: ['[data-id*="fieldControl"]', '[class*="MscrmControls"]'],
      strategies: [
        { attr: 'data-id', priority: 100, playwright: (val) => `locator('[data-id="${val}"]')` },
        { attr: 'data-control-name', priority: 95, playwright: (val) => `locator('[data-control-name="${val}"]')` },
        { attr: 'aria-label', priority: 90, playwright: (val) => `locator('[aria-label="${val}"]')` },
      ],
      avoidPatterns: [/id-[a-f0-9-]{36}/i, /MscrmControls\.\w+_\d+/],
      customWait: 'networkidle',
    },
    jira: {
      name: 'Jira / Atlassian',
      detectPatterns: [/atlassian\.net/i, /jira\./i, /confluence\./i],
      strategies: [
        { attr: 'data-testid', priority: 100, useTestId: true },
        { attr: 'data-test-id', priority: 95 },
        { attr: 'data-item-title', priority: 90 },
      ],
      customWait: 'networkidle',
    },
    zendesk: {
      name: 'Zendesk',
      detectPatterns: [/zendesk\.com/i],
      strategies: [
        { attr: 'data-test-id', priority: 100 },
        { attr: 'data-garden-id', priority: 95 },
      ],
      customWait: 'networkidle',
    },
    hubspot: {
      name: 'HubSpot',
      detectPatterns: [/hubspot\.com/i, /hs-sites\.com/i],
      strategies: [
        { attr: 'data-selenium-test', priority: 100 },
        { attr: 'data-test-id', priority: 95 },
        { attr: 'data-button-use', priority: 90 },
      ],
      customWait: 'networkidle',
    },
    netsuite: {
      name: 'NetSuite',
      detectPatterns: [/netsuite\.com/i, /app\.netsuite/i],
      strategies: [
        { attr: 'data-ns-field-type', priority: 95 },
      ],
      idPrefix: 'custpage_',
      frameSelector: 'iframe[name="main"]',
      customWait: 'networkidle',
    },
    shopify: {
      name: 'Shopify',
      detectPatterns: [/shopify\.com/i, /myshopify\.com/i],
      strategies: [
        { attr: 'data-testid', priority: 100, useTestId: true },
      ],
      classPrefix: ['Polaris-'],
      customWait: 'networkidle',
    },
    slack: {
      name: 'Slack',
      detectPatterns: [/slack\.com/i, /app\.slack/i],
      strategies: [
        { attr: 'data-qa', priority: 100 },
        { attr: 'data-qa-action', priority: 95 },
      ],
      customWait: 'networkidle',
    },
    monday: {
      name: 'Monday.com',
      detectPatterns: [/monday\.com/i],
      strategies: [
        { attr: 'data-testid', priority: 100, useTestId: true },
        { attr: 'data-automationid', priority: 95 },
      ],
      customWait: 'networkidle',
    },
    quickbooks: {
      name: 'QuickBooks',
      detectPatterns: [/quickbooks\.intuit\.com/i, /qbo\.intuit/i],
      strategies: [
        { attr: 'data-automation', priority: 100 },
        { attr: 'data-cy', priority: 95 },
        { attr: 'data-automation-id', priority: 90 },
      ],
      customWait: 'networkidle',
    },
    freshdesk: {
      name: 'Freshdesk',
      detectPatterns: [/freshdesk\.com/i, /freshworks\.com/i],
      strategies: [
        { attr: 'data-aid', priority: 100 },
        { attr: 'data-testid', priority: 95, useTestId: true },
      ],
      customWait: 'networkidle',
    },
    zoho: {
      name: 'Zoho',
      detectPatterns: [/zoho\.com/i],
      strategies: [
        { attr: 'data-zcqa', priority: 100 },
        { attr: 'lyte-att', priority: 90 },
      ],
      customWait: 'domcontentloaded',
    },
    powerapps: {
      name: 'Power Apps',
      detectPatterns: [/powerapps\.com/i, /make\.powerapps/i],
      strategies: [
        { attr: 'data-control-name', priority: 100 },
      ],
      classPrefix: ['appmagic-'],
      customWait: 'networkidle',
    },
    coupa: {
      name: 'Coupa',
      detectPatterns: [/coupahost\.com/i, /coupa\.com/i],
      strategies: [
        { attr: 'data-object-name', priority: 100 },
        { attr: 'data-field', priority: 95 },
      ],
      customWait: 'networkidle',
    },
    anaplan: {
      name: 'Anaplan',
      detectPatterns: [/anaplan\.com/i],
      strategies: [
        { attr: 'data-testid', priority: 100, useTestId: true },
        { attr: 'data-test', priority: 95 },
      ],
      customWait: 'networkidle',
    },
    successfactors: {
      name: 'SAP SuccessFactors',
      detectPatterns: [/successfactors\.com/i, /sapsf\.com/i],
      strategies: [
        { attr: 'data-automation-id', priority: 100 },
        { attr: 'data-help-id', priority: 90 },
      ],
      customWait: 'networkidle',
    },
    // Frontend Frameworks
    angular: {
      name: 'Angular',
      detectPatterns: [/angular/i],
      detectElements: ['[ng-reflect-', '[_ngcontent-', '[_nghost-'],
      strategies: [
        { attr: 'data-cy', priority: 100 },
        { attr: 'data-testid', priority: 95, useTestId: true },
        { attr: 'formcontrolname', priority: 90, playwright: (val) => `locator('[formcontrolname="${val}"]')` },
        { attr: 'name', priority: 85, playwright: (val) => `locator('[name="${val}"]')` },
        { attr: 'ng-reflect-name', priority: 80, playwright: (val) => `locator('[ng-reflect-name="${val}"]')` },
      ],
      avoidPatterns: [/_ngcontent-\w+-c\d+/, /_nghost-\w+-c\d+/],
      customWait: 'networkidle',
    },
    react: {
      name: 'React',
      detectPatterns: [],
      detectElements: ['[data-reactroot]', '[data-reactid]'],
      strategies: [
        { attr: 'data-testid', priority: 100, useTestId: true },
        { attr: 'data-test', priority: 95 },
        { attr: 'data-cy', priority: 90 },
        { attr: 'name', priority: 85, playwright: (val) => `locator('[name="${val}"]')` },
        { attr: 'aria-label', priority: 80, playwright: (val) => `getByLabel('${val}')` },
      ],
      customWait: 'networkidle',
    },
    vue: {
      name: 'Vue.js',
      detectPatterns: [],
      detectElements: ['[data-v-', '[v-model]'],
      strategies: [
        { attr: 'data-testid', priority: 100, useTestId: true },
        { attr: 'data-test', priority: 95 },
        { attr: 'data-cy', priority: 90 },
        { attr: 'name', priority: 85, playwright: (val) => `locator('[name="${val}"]')` },
      ],
      avoidPatterns: [/data-v-[a-f0-9]+/],
      customWait: 'networkidle',
    },
    svelte: {
      name: 'Svelte',
      detectPatterns: [],
      detectElements: ['[class*="svelte-"]'],
      strategies: [
        { attr: 'data-testid', priority: 100, useTestId: true },
        { attr: 'data-test', priority: 95 },
        { attr: 'name', priority: 90, playwright: (val) => `locator('[name="${val}"]')` },
      ],
      avoidPatterns: [/svelte-[a-z0-9]+/],
      customWait: 'networkidle',
    },
    // Additional Enterprise Apps
    veeva: {
      name: 'Veeva Vault',
      detectPatterns: [/veeva\.com/i, /vault\.com/i],
      strategies: [
        { attr: 'data-component-id', priority: 100 },
        { attr: 'data-field-name', priority: 95 },
        { attr: 'name', priority: 90, playwright: (val) => `locator('[name="${val}"]')` },
      ],
      customWait: 'networkidle',
    },
    pega: {
      name: 'Pega',
      detectPatterns: [/pega\.com/i, /prpc/i],
      detectElements: ['[data-test-id*="pega"]', '[class*="pega-"]'],
      strategies: [
        { attr: 'data-test-id', priority: 100 },
        { attr: 'data-node-id', priority: 95 },
        { attr: 'data-ctl', priority: 90 },
        { attr: 'name', priority: 85, playwright: (val) => `locator('[name="${val}"]')` },
      ],
      avoidPatterns: [/pzButton[A-Z0-9]+/],
      customWait: 'networkidle',
    },
    appian: {
      name: 'Appian',
      detectPatterns: [/appian\.com/i],
      detectElements: ['[data-appian-]'],
      strategies: [
        { attr: 'data-appian-element', priority: 100 },
        { attr: 'data-testid', priority: 95, useTestId: true },
        { attr: 'aria-label', priority: 90, playwright: (val) => `getByLabel('${val}')` },
      ],
      customWait: 'networkidle',
    },
    outsystems: {
      name: 'OutSystems',
      detectPatterns: [/outsystems/i],
      detectElements: ['[osui-', '[data-block]'],
      strategies: [
        { attr: 'data-input', priority: 100 },
        { attr: 'data-button', priority: 95 },
        { attr: 'name', priority: 90, playwright: (val) => `locator('[name="${val}"]')` },
        { attr: 'id', priority: 85, playwright: (val) => {
          if (val.includes('_')) {
            const suffix = val.split('_').pop();
            return `locator('[id$="_${suffix}"]')`;
          }
          return `locator('[id="${val}"]')`;
        }},
      ],
      avoidPatterns: [/wt\d+_\d+/],
      customWait: 'networkidle',
    },
    mendix: {
      name: 'Mendix',
      detectPatterns: [/mendix/i, /mxapp/i],
      strategies: [
        { attr: 'data-widget-name', priority: 100 },
        { attr: 'mx-name', priority: 95 },
        { attr: 'name', priority: 90, playwright: (val) => `locator('[name="${val}"]')` },
      ],
      customWait: 'networkidle',
    },
    generic: {
      name: 'Generic',
      detectPatterns: [],
      strategies: [
        { attr: 'data-testid', priority: 100, useTestId: true },
        { attr: 'data-test-id', priority: 95 },
        { attr: 'data-cy', priority: 90 },
        { attr: 'data-test', priority: 85 },
        { attr: 'name', priority: 80, playwright: (val) => `locator('[name="${val}"]')` },
        { attr: 'aria-label', priority: 75, playwright: (val) => `getByLabel('${val}')` },
      ],
      customWait: 'networkidle',
    },
  };
})();
