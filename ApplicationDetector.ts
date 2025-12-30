/**
 * Flowstral - Application Detection Engine
 * Identifies enterprise applications and their specific configurations
 */

import {
  EnterpriseApplication,
  ApplicationFingerprint,
  DetectionMethod,
} from '../types';

interface DetectionRule {
  application: EnterpriseApplication;
  urlPatterns: RegExp[];
  domSignatures: DomSignature[];
  metaTags: MetaTagRule[];
  globalObjects: string[];
  cssVariables: string[];
  customElements: string[];
  frameworkIndicators: string[];
}

interface DomSignature {
  selector: string;
  attribute?: string;
  valuePattern?: RegExp;
}

interface MetaTagRule {
  name?: string;
  property?: string;
  contentPattern: RegExp;
}

/**
 * Enterprise Application Detection Rules
 */
const DETECTION_RULES: DetectionRule[] = [
  // Salesforce / Lightning
  {
    application: 'salesforce',
    urlPatterns: [
      /\.lightning\.force\.com/i,
      /\.salesforce\.com/i,
      /\.force\.com/i,
      /\.my\.salesforce\.com/i,
      /\.visualforce\.com/i,
    ],
    domSignatures: [
      { selector: 'lightning-primitive-icon' },
      { selector: '[data-aura-rendered-by]' },
      { selector: 'aura-component' },
      { selector: '[data-component-id]', attribute: 'data-component-id', valuePattern: /^[a-z]+:[a-zA-Z]+$/ },
      { selector: 'lightning-input' },
      { selector: 'lightning-button' },
      { selector: 'force-record-layout' },
    ],
    metaTags: [],
    globalObjects: ['$A', 'Aura', 'sforce', 'Sfdc'],
    cssVariables: ['--lwc-', '--slds-'],
    customElements: ['lightning-', 'aura-', 'force-', 'c-'],
    frameworkIndicators: ['LWC', 'Aura', 'Lightning'],
  },

  // Workday
  {
    application: 'workday',
    urlPatterns: [
      /\.workday\.com/i,
      /\.myworkday\.com/i,
      /\.workdaygov\.com/i,
    ],
    domSignatures: [
      { selector: '[data-automation-id]' },
      { selector: 'wd-icon' },
      { selector: '[data-uxi-widget-type]' },
      { selector: 'wd-popup' },
      { selector: '[data-automation-widget]' },
    ],
    metaTags: [],
    globalObjects: ['workday', 'WD'],
    cssVariables: ['--wd-'],
    customElements: ['wd-'],
    frameworkIndicators: ['Workday'],
  },

  // ServiceNow
  {
    application: 'servicenow',
    urlPatterns: [
      /\.service-now\.com/i,
      /\.servicenow\.com/i,
      /\.servicenowservices\.com/i,
    ],
    domSignatures: [
      { selector: '[data-sn-]' },
      { selector: 'sn-' },
      { selector: '[now-]' },
      { selector: '[sn-atf-]' },
      { selector: 'now-dropdown' },
      { selector: 'now-input' },
      { selector: 'now-button' },
      { selector: '[data-testid^="@now-"]' },
    ],
    metaTags: [
      { name: 'application-name', contentPattern: /ServiceNow/i },
    ],
    globalObjects: ['NOW', 'GlideRecord', 'g_form', 'GlideAjax'],
    cssVariables: ['--now-'],
    customElements: ['now-', 'sn-'],
    frameworkIndicators: ['ServiceNow', 'Seismic'],
  },

  // SAP (Fiori / UI5)
  {
    application: 'sap',
    urlPatterns: [
      /\.sap\.com/i,
      /fiori.*\.com/i,
      /\/sap\/bc\//i,
      /\.sapcloud\.com/i,
    ],
    domSignatures: [
      { selector: '[data-sap-ui]' },
      { selector: '[id^="__"]', attribute: 'id', valuePattern: /^__[a-z]+\d+-/ },
      { selector: 'ui5-' },
      { selector: '.sapUi' },
      { selector: '[data-sap-ui-area]' },
      { selector: 'sap.m.' },
    ],
    metaTags: [],
    globalObjects: ['sap', 'SAPUI5', 'SAP'],
    cssVariables: ['--sapUi', '--sap-'],
    customElements: ['ui5-'],
    frameworkIndicators: ['UI5', 'Fiori', 'SAP'],
  },

  // Pega
  {
    application: 'pega',
    urlPatterns: [
      /\.pega\.com/i,
      /\/prweb\//i,
      /\/prpc\//i,
      /pega.*cloud/i,
    ],
    domSignatures: [
      { selector: '[data-test-id]' },
      { selector: '[data-ui-meta]' },
      { selector: '[node_name]' },
      { selector: '[data-pega-]' },
      { selector: 'pega-' },
      { selector: '[py-]' },
    ],
    metaTags: [],
    globalObjects: ['pega', 'pyActivity'],
    cssVariables: [],
    customElements: ['pega-'],
    frameworkIndicators: ['Pega', 'Constellation'],
  },

  // Oracle Fusion
  {
    application: 'oracle-fusion',
    urlPatterns: [
      /\.oraclecloud\.com/i,
      /\.oracleapps\.com/i,
      /fusion.*oracle/i,
    ],
    domSignatures: [
      { selector: '[id^="pt1:"]' },
      { selector: '[id*=":oracle.adf."]' },
      { selector: 'af:' },
      { selector: '.AFStretchWidth' },
      { selector: '[data-afr-]' },
    ],
    metaTags: [],
    globalObjects: ['AdfPage', 'AdfRichUIPeer'],
    cssVariables: [],
    customElements: [],
    frameworkIndicators: ['Oracle ADF', 'Fusion'],
  },

  // Microsoft Dynamics 365
  {
    application: 'dynamics365',
    urlPatterns: [
      /\.dynamics\.com/i,
      /\.crm\d*\.dynamics\.com/i,
      /dynamics365/i,
    ],
    domSignatures: [
      { selector: '[data-id]', attribute: 'data-id', valuePattern: /^MscrmControls\./ },
      { selector: '[data-lp-id]' },
      { selector: '[aria-label*="Dynamics"]' },
      { selector: '#AppLandingPage' },
    ],
    metaTags: [],
    globalObjects: ['Xrm', 'Mscrm', 'Microsoft.Dynamics'],
    cssVariables: [],
    customElements: [],
    frameworkIndicators: ['Dynamics', 'PowerApps'],
  },

  // NetSuite
  {
    application: 'netsuite',
    urlPatterns: [
      /\.netsuite\.com/i,
      /\.netledger\.com/i,
      /system\.netsuite\.com/i,
    ],
    domSignatures: [
      { selector: '[data-nlc-]' },
      { selector: '[id^="ns"]' },
      { selector: '.ns-' },
      { selector: '[data-ns-type]' },
    ],
    metaTags: [],
    globalObjects: ['NS', 'nlapiGetFieldValue'],
    cssVariables: [],
    customElements: [],
    frameworkIndicators: ['NetSuite', 'SuiteScript'],
  },

  // SAP SuccessFactors
  {
    application: 'successfactors',
    urlPatterns: [
      /\.successfactors\.com/i,
      /\.successfactors\.eu/i,
      /performancemanager/i,
    ],
    domSignatures: [
      { selector: '[data-automation-id]' },
      { selector: '[data-sf-]' },
      { selector: '.sf-' },
      { selector: '[id^="bizx"]' },
    ],
    metaTags: [],
    globalObjects: ['BizXPlatform', 'sfp'],
    cssVariables: [],
    customElements: [],
    frameworkIndicators: ['SuccessFactors', 'BizX'],
  },

  // Concur
  {
    application: 'concur',
    urlPatterns: [
      /\.concursolutions\.com/i,
      /\.concur\.com/i,
      /us\.concursolutions\.com/i,
    ],
    domSignatures: [
      { selector: '[data-concur-]' },
      { selector: '[data-automation-id]' },
      { selector: '.cnqr-' },
    ],
    metaTags: [],
    globalObjects: ['concur', 'Concur'],
    cssVariables: [],
    customElements: [],
    frameworkIndicators: ['Concur'],
  },

  // Veeva
  {
    application: 'veeva',
    urlPatterns: [
      /\.veevavault\.com/i,
      /\.veevanetwork\.com/i,
      /veeva.*cloud/i,
    ],
    domSignatures: [
      { selector: '[data-veeva-]' },
      { selector: '[veevaapp]' },
      { selector: '.veeva-' },
      { selector: '[data-vv-]' },
    ],
    metaTags: [],
    globalObjects: ['Veeva', 'VeevaVault'],
    cssVariables: [],
    customElements: ['veeva-'],
    frameworkIndicators: ['Veeva'],
  },

  // Coupa
  {
    application: 'coupa',
    urlPatterns: [
      /\.coupahost\.com/i,
      /\.coupa\.com/i,
    ],
    domSignatures: [
      { selector: '[data-coupa-]' },
      { selector: '[data-testid^="coupa-"]' },
      { selector: '.coupa-' },
    ],
    metaTags: [],
    globalObjects: ['Coupa'],
    cssVariables: [],
    customElements: [],
    frameworkIndicators: ['Coupa'],
  },

  // SAP Ariba
  {
    application: 'ariba',
    urlPatterns: [
      /\.ariba\.com/i,
      /procurement\.ariba\.com/i,
      /service\.ariba\.com/i,
    ],
    domSignatures: [
      { selector: '[data-ariba-]' },
      { selector: '[awname]' },
      { selector: 'aw-' },
      { selector: '[aid]' },
    ],
    metaTags: [],
    globalObjects: ['ariba', 'AribaWeb'],
    cssVariables: [],
    customElements: ['aw-'],
    frameworkIndicators: ['Ariba'],
  },

  // Zendesk
  {
    application: 'zendesk',
    urlPatterns: [
      /\.zendesk\.com/i,
      /\.zopim\.com/i,
    ],
    domSignatures: [
      { selector: '[data-garden-]' },
      { selector: '[data-test-id]' },
      { selector: 'garden-' },
    ],
    metaTags: [],
    globalObjects: ['zE', 'Zendesk'],
    cssVariables: ['--zd-'],
    customElements: [],
    frameworkIndicators: ['Zendesk', 'Garden'],
  },

  // HubSpot
  {
    application: 'hubspot',
    urlPatterns: [
      /\.hubspot\.com/i,
      /app\.hubspot\.com/i,
    ],
    domSignatures: [
      { selector: '[data-selenium-test]' },
      { selector: '[data-unit-test]' },
      { selector: '[data-test-id]' },
      { selector: '.UIButton' },
    ],
    metaTags: [],
    globalObjects: ['HubSpot', 'hubspot'],
    cssVariables: [],
    customElements: [],
    frameworkIndicators: ['HubSpot'],
  },

  // Zoho
  {
    application: 'zoho',
    urlPatterns: [
      /\.zoho\.com/i,
      /\.zohocrm\.com/i,
      /crm\.zoho\.com/i,
    ],
    domSignatures: [
      { selector: '[data-zs-]' },
      { selector: '[lyte-]' },
      { selector: 'lyte-' },
      { selector: '[data-zcqa-]' },
    ],
    metaTags: [],
    globalObjects: ['ZOHO', 'Lyte'],
    cssVariables: [],
    customElements: ['lyte-'],
    frameworkIndicators: ['Zoho', 'Lyte'],
  },

  // Freshworks
  {
    application: 'freshworks',
    urlPatterns: [
      /\.freshworks\.com/i,
      /\.freshdesk\.com/i,
      /\.freshservice\.com/i,
      /\.freshsales\.io/i,
    ],
    domSignatures: [
      { selector: '[data-test-id]' },
      { selector: '[data-fw-]' },
      { selector: 'fw-' },
    ],
    metaTags: [],
    globalObjects: ['Freshworks', 'FW'],
    cssVariables: [],
    customElements: ['fw-'],
    frameworkIndicators: ['Freshworks'],
  },

  // Anaplan
  {
    application: 'anaplan',
    urlPatterns: [
      /\.anaplan\.com/i,
      /app\.anaplan\.com/i,
    ],
    domSignatures: [
      { selector: '[data-test-id]' },
      { selector: '[data-anaplan-]' },
      { selector: '.anaplan-' },
    ],
    metaTags: [],
    globalObjects: ['Anaplan', 'anaplan'],
    cssVariables: [],
    customElements: [],
    frameworkIndicators: ['Anaplan'],
  },

  // Snowflake
  {
    application: 'snowflake',
    urlPatterns: [
      /\.snowflakecomputing\.com/i,
      /app\.snowflake\.com/i,
    ],
    domSignatures: [
      { selector: '[data-testid]' },
      { selector: '[data-sf-]' },
    ],
    metaTags: [],
    globalObjects: ['Snowflake'],
    cssVariables: [],
    customElements: [],
    frameworkIndicators: ['Snowflake'],
  },

  // Tableau
  {
    application: 'tableau',
    urlPatterns: [
      /\.tableau\.com/i,
      /tableau.*server/i,
      /\.tableaucloud\.com/i,
    ],
    domSignatures: [
      { selector: 'tableau-viz' },
      { selector: '[data-tb-test-id]' },
      { selector: '.tab-' },
    ],
    metaTags: [],
    globalObjects: ['tableau', 'tableauSoftware'],
    cssVariables: [],
    customElements: ['tableau-'],
    frameworkIndicators: ['Tableau'],
  },

  // Power BI
  {
    application: 'power-bi',
    urlPatterns: [
      /app\.powerbi\.com/i,
      /\.powerbi\.com/i,
    ],
    domSignatures: [
      { selector: '[data-testid]' },
      { selector: '.visual-' },
      { selector: '[pbi-]' },
    ],
    metaTags: [],
    globalObjects: ['powerbi', 'PBI'],
    cssVariables: [],
    customElements: [],
    frameworkIndicators: ['Power BI'],
  },

  // Jira
  {
    application: 'jira',
    urlPatterns: [
      /\.atlassian\.net.*jira/i,
      /\.atlassian\.com.*jira/i,
      /jira\./i,
    ],
    domSignatures: [
      { selector: '[data-testid]' },
      { selector: '[data-ds--]' },
      { selector: 'ak-' },
    ],
    metaTags: [],
    globalObjects: ['JIRA', 'AJS'],
    cssVariables: ['--ds-'],
    customElements: ['ak-'],
    frameworkIndicators: ['Jira', 'Atlassian'],
  },

  // Confluence
  {
    application: 'confluence',
    urlPatterns: [
      /\.atlassian\.net.*wiki/i,
      /\.atlassian\.com.*wiki/i,
      /confluence\./i,
    ],
    domSignatures: [
      { selector: '[data-testid]' },
      { selector: '[data-ds--]' },
      { selector: 'ak-' },
    ],
    metaTags: [],
    globalObjects: ['Confluence', 'AJS'],
    cssVariables: ['--ds-'],
    customElements: ['ak-'],
    frameworkIndicators: ['Confluence', 'Atlassian'],
  },

  // Monday.com
  {
    application: 'monday',
    urlPatterns: [
      /\.monday\.com/i,
    ],
    domSignatures: [
      { selector: '[data-testid]' },
      { selector: '[data-monday-]' },
    ],
    metaTags: [],
    globalObjects: ['monday'],
    cssVariables: [],
    customElements: [],
    frameworkIndicators: ['Monday'],
  },

  // Asana
  {
    application: 'asana',
    urlPatterns: [
      /app\.asana\.com/i,
      /\.asana\.com/i,
    ],
    domSignatures: [
      { selector: '[data-testid]' },
      { selector: '[aria-label]' },
    ],
    metaTags: [],
    globalObjects: ['asana', 'Asana'],
    cssVariables: [],
    customElements: [],
    frameworkIndicators: ['Asana'],
  },
];

/**
 * Application Detector Class
 */
export class ApplicationDetector {
  /**
   * Detects the enterprise application from the current page
   */
  detectApplication(context: DetectionContext): ApplicationFingerprint {
    let bestMatch: ApplicationFingerprint | null = null;
    let highestConfidence = 0;

    for (const rule of DETECTION_RULES) {
      const result = this.evaluateRule(rule, context);
      if (result.confidence > highestConfidence) {
        highestConfidence = result.confidence;
        bestMatch = result;
      }
    }

    return bestMatch || {
      application: 'unknown',
      confidence: 0,
      detectionMethod: 'dom-signature',
      shadowDomEnabled: false,
    };
  }

  /**
   * Evaluates a single detection rule
   */
  private evaluateRule(rule: DetectionRule, context: DetectionContext): ApplicationFingerprint {
    const scores: { method: DetectionMethod; score: number }[] = [];

    // URL Pattern matching
    const urlScore = this.evaluateUrlPatterns(rule.urlPatterns, context.url);
    if (urlScore > 0) {
      scores.push({ method: 'url-pattern', score: urlScore * 30 });
    }

    // DOM Signature matching
    const domScore = this.evaluateDomSignatures(rule.domSignatures, context.domElements);
    if (domScore > 0) {
      scores.push({ method: 'dom-signature', score: domScore * 25 });
    }

    // Global Objects check
    const globalScore = this.evaluateGlobalObjects(rule.globalObjects, context.globalObjects);
    if (globalScore > 0) {
      scores.push({ method: 'global-objects', score: globalScore * 20 });
    }

    // Custom Elements check
    const customElementScore = this.evaluateCustomElements(rule.customElements, context.customElements);
    if (customElementScore > 0) {
      scores.push({ method: 'custom-elements', score: customElementScore * 15 });
    }

    // CSS Variables check
    const cssScore = this.evaluateCssVariables(rule.cssVariables, context.cssVariables);
    if (cssScore > 0) {
      scores.push({ method: 'css-variables', score: cssScore * 10 });
    }

    const totalScore = scores.reduce((sum, s) => sum + s.score, 0);
    const confidence = Math.min(100, totalScore);
    const primaryMethod = scores.sort((a, b) => b.score - a.score)[0]?.method || 'dom-signature';

    // Determine if shadow DOM is enabled
    const shadowDomEnabled = this.checkShadowDomUsage(rule, context);
    const lightningEnabled = rule.application === 'salesforce' && 
      context.customElements.some(el => el.startsWith('lightning-') || el.startsWith('c-'));

    return {
      application: rule.application,
      confidence,
      detectionMethod: primaryMethod,
      shadowDomEnabled,
      lightningEnabled,
      customComponents: this.extractCustomComponents(rule, context),
    };
  }

  private evaluateUrlPatterns(patterns: RegExp[], url: string): number {
    for (const pattern of patterns) {
      if (pattern.test(url)) {
        return 1;
      }
    }
    return 0;
  }

  private evaluateDomSignatures(signatures: DomSignature[], elements: DomElement[]): number {
    let matchCount = 0;
    for (const sig of signatures) {
      const hasMatch = elements.some(el => {
        if (!this.selectorMatches(el, sig.selector)) return false;
        if (sig.attribute && sig.valuePattern) {
          const attrValue = el.attributes[sig.attribute];
          return attrValue && sig.valuePattern.test(attrValue);
        }
        return true;
      });
      if (hasMatch) matchCount++;
    }
    return signatures.length > 0 ? matchCount / signatures.length : 0;
  }

  private selectorMatches(element: DomElement, selector: string): boolean {
    // Simple selector matching - in real implementation, use proper CSS selector matching
    if (selector.startsWith('[')) {
      const attrMatch = selector.match(/\[([^\]=^~*|$]+)/);
      if (attrMatch) {
        return element.attributes.hasOwnProperty(attrMatch[1]);
      }
    }
    if (selector.startsWith('.')) {
      return element.classList.includes(selector.slice(1));
    }
    if (selector.endsWith('-')) {
      return element.tagName.toLowerCase().startsWith(selector);
    }
    return element.tagName.toLowerCase() === selector || 
           element.tagName.toLowerCase().startsWith(selector);
  }

  private evaluateGlobalObjects(required: string[], available: string[]): number {
    const matches = required.filter(r => available.includes(r));
    return required.length > 0 ? matches.length / required.length : 0;
  }

  private evaluateCustomElements(required: string[], available: string[]): number {
    let matchCount = 0;
    for (const req of required) {
      if (available.some(a => a.startsWith(req) || a.includes(req))) {
        matchCount++;
      }
    }
    return required.length > 0 ? matchCount / required.length : 0;
  }

  private evaluateCssVariables(required: string[], available: string[]): number {
    let matchCount = 0;
    for (const req of required) {
      if (available.some(a => a.includes(req))) {
        matchCount++;
      }
    }
    return required.length > 0 ? matchCount / required.length : 0;
  }

  private checkShadowDomUsage(rule: DetectionRule, context: DetectionContext): boolean {
    // Applications known to use Shadow DOM extensively
    const shadowDomApps: EnterpriseApplication[] = [
      'salesforce', 'servicenow', 'sap', 'workday', 'zoho'
    ];
    
    if (shadowDomApps.includes(rule.application)) {
      return true;
    }

    // Check if any custom elements in context use shadow DOM
    return context.hasShadowDom || false;
  }

  private extractCustomComponents(rule: DetectionRule, context: DetectionContext): string[] {
    const components: string[] = [];
    for (const prefix of rule.customElements) {
      const matching = context.customElements.filter(el => 
        el.toLowerCase().startsWith(prefix.toLowerCase())
      );
      components.push(...matching);
    }
    return [...new Set(components)];
  }

  /**
   * Gets detection script to inject into page
   */
  getDetectionScript(): string {
    return `
    (function() {
      const context = {
        url: window.location.href,
        domElements: [],
        globalObjects: [],
        customElements: [],
        cssVariables: [],
        hasShadowDom: false
      };

      // Collect DOM elements with relevant attributes
      const relevantSelectors = [
        '[data-aura-rendered-by]', '[data-automation-id]', '[data-sn-]',
        '[data-sap-ui]', '[data-test-id]', '[data-testid]', '[data-garden-]',
        '[data-coupa-]', '[data-ariba-]', '[data-veeva-]', '[data-pega-]'
      ];
      
      relevantSelectors.forEach(sel => {
        try {
          document.querySelectorAll(sel).forEach(el => {
            context.domElements.push({
              tagName: el.tagName,
              classList: Array.from(el.classList),
              attributes: Array.from(el.attributes).reduce((acc, attr) => {
                acc[attr.name] = attr.value;
                return acc;
              }, {})
            });
          });
        } catch (e) {}
      });

      // Check global objects
      const globalChecks = ['$A', 'Aura', 'sforce', 'workday', 'NOW', 'sap', 'pega', 'Xrm', 'NS', 'zE', 'JIRA'];
      globalChecks.forEach(g => {
        try {
          if (window[g] !== undefined) {
            context.globalObjects.push(g);
          }
        } catch (e) {}
      });

      // Collect custom elements
      const customEls = new Set();
      document.querySelectorAll('*').forEach(el => {
        if (el.tagName.includes('-')) {
          customEls.add(el.tagName.toLowerCase());
        }
        if (el.shadowRoot) {
          context.hasShadowDom = true;
        }
      });
      context.customElements = Array.from(customEls);

      // Collect CSS variables
      const styles = getComputedStyle(document.documentElement);
      for (let i = 0; i < styles.length; i++) {
        const prop = styles[i];
        if (prop.startsWith('--')) {
          context.cssVariables.push(prop);
        }
      }

      return context;
    })();
    `;
  }
}

/**
 * Detection Context - data collected from the page
 */
export interface DetectionContext {
  url: string;
  domElements: DomElement[];
  globalObjects: string[];
  customElements: string[];
  cssVariables: string[];
  hasShadowDom: boolean;
}

export interface DomElement {
  tagName: string;
  classList: string[];
  attributes: Record<string, string>;
}
