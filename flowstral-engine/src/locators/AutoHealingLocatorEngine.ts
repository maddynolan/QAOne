/**
 * Flowstral - Auto-Healing Locator Engine
 * Generates robust, self-healing locators for enterprise applications
 */

import {
  RecordedElement,
  LocatorStrategy,
  LocatorType,
  AutoHealingLocator,
  ElementSignature,
  EnterpriseApplication,
  ApplicationFingerprint,
  ShadowPathSegment,
  StableAttribute,
  ContextualHint,
  ParentElementInfo,
} from '../types';

/**
 * Locator priority configuration per application
 */
const APPLICATION_LOCATOR_PRIORITIES: Record<EnterpriseApplication, LocatorType[]> = {
  salesforce: ['data-attribute', 'role', 'text', 'label', 'aria', 'testid', 'css', 'xpath'],
  workday: ['data-attribute', 'testid', 'role', 'label', 'text', 'aria', 'css', 'xpath'],
  servicenow: ['data-attribute', 'testid', 'role', 'text', 'label', 'aria', 'css', 'xpath'],
  sap: ['data-attribute', 'role', 'label', 'text', 'aria', 'testid', 'css', 'xpath'],
  pega: ['testid', 'data-attribute', 'role', 'label', 'text', 'aria', 'css', 'xpath'],
  'oracle-fusion': ['data-attribute', 'role', 'label', 'text', 'aria', 'css', 'xpath'],
  dynamics365: ['data-attribute', 'aria', 'role', 'label', 'text', 'testid', 'css', 'xpath'],
  netsuite: ['data-attribute', 'role', 'label', 'text', 'aria', 'css', 'xpath'],
  successfactors: ['data-attribute', 'testid', 'role', 'label', 'text', 'aria', 'css', 'xpath'],
  concur: ['data-attribute', 'testid', 'role', 'label', 'text', 'aria', 'css', 'xpath'],
  veeva: ['data-attribute', 'testid', 'role', 'label', 'text', 'aria', 'css', 'xpath'],
  coupa: ['testid', 'data-attribute', 'role', 'label', 'text', 'aria', 'css', 'xpath'],
  ariba: ['data-attribute', 'role', 'label', 'text', 'aria', 'testid', 'css', 'xpath'],
  zendesk: ['data-attribute', 'testid', 'role', 'label', 'text', 'aria', 'css', 'xpath'],
  hubspot: ['testid', 'data-attribute', 'role', 'label', 'text', 'aria', 'css', 'xpath'],
  zoho: ['data-attribute', 'testid', 'role', 'label', 'text', 'aria', 'css', 'xpath'],
  freshworks: ['testid', 'data-attribute', 'role', 'label', 'text', 'aria', 'css', 'xpath'],
  anaplan: ['testid', 'data-attribute', 'role', 'label', 'text', 'aria', 'css', 'xpath'],
  snowflake: ['testid', 'data-attribute', 'role', 'label', 'text', 'aria', 'css', 'xpath'],
  tableau: ['data-attribute', 'testid', 'role', 'label', 'text', 'aria', 'css', 'xpath'],
  'power-bi': ['testid', 'data-attribute', 'role', 'label', 'text', 'aria', 'css', 'xpath'],
  jira: ['testid', 'data-attribute', 'role', 'label', 'text', 'aria', 'css', 'xpath'],
  confluence: ['testid', 'data-attribute', 'role', 'label', 'text', 'aria', 'css', 'xpath'],
  monday: ['testid', 'data-attribute', 'role', 'label', 'text', 'aria', 'css', 'xpath'],
  asana: ['testid', 'data-attribute', 'role', 'label', 'text', 'aria', 'css', 'xpath'],
  unknown: ['role', 'text', 'label', 'testid', 'data-attribute', 'aria', 'css', 'xpath'],
};

/**
 * Stable data attributes per application
 */
const STABLE_DATA_ATTRIBUTES: Record<EnterpriseApplication, string[]> = {
  salesforce: ['data-aura-rendered-by', 'data-component-id', 'data-target-selection-name', 'data-refid'],
  workday: ['data-automation-id', 'data-automation-widget', 'data-uxi-widget-type'],
  servicenow: ['data-sn-', 'sn-atf-', 'data-testid'],
  sap: ['data-sap-ui', 'data-sap-ui-area', 'data-sap-ui-type'],
  pega: ['data-test-id', 'data-ui-meta', 'node_name', 'data-pega-'],
  'oracle-fusion': ['data-afr-', 'af:id'],
  dynamics365: ['data-id', 'data-lp-id'],
  netsuite: ['data-nlc-', 'data-ns-type'],
  successfactors: ['data-automation-id', 'data-sf-'],
  concur: ['data-concur-', 'data-automation-id'],
  veeva: ['data-veeva-', 'data-vv-'],
  coupa: ['data-coupa-', 'data-testid'],
  ariba: ['awname', 'aid', 'data-ariba-'],
  zendesk: ['data-garden-', 'data-test-id'],
  hubspot: ['data-selenium-test', 'data-unit-test', 'data-test-id'],
  zoho: ['data-zs-', 'data-zcqa-'],
  freshworks: ['data-test-id', 'data-fw-'],
  anaplan: ['data-test-id', 'data-anaplan-'],
  snowflake: ['data-testid', 'data-sf-'],
  tableau: ['data-tb-test-id'],
  'power-bi': ['data-testid', 'pbi-'],
  jira: ['data-testid', 'data-ds--'],
  confluence: ['data-testid', 'data-ds--'],
  monday: ['data-testid', 'data-monday-'],
  asana: ['data-testid'],
  unknown: ['data-testid', 'data-test-id', 'data-cy', 'data-qa'],
};

/**
 * Auto-Healing Locator Engine
 */
export class AutoHealingLocatorEngine {
  private application: EnterpriseApplication;
  private fingerprint: ApplicationFingerprint;
  private locatorPriorities: LocatorType[];
  private stableAttributes: string[];

  constructor(fingerprint: ApplicationFingerprint) {
    this.application = fingerprint.application;
    this.fingerprint = fingerprint;
    this.locatorPriorities = APPLICATION_LOCATOR_PRIORITIES[this.application];
    this.stableAttributes = STABLE_DATA_ATTRIBUTES[this.application];
  }

  /**
   * Generates a complete auto-healing locator for an element
   */
  generateAutoHealingLocator(element: RecordedElement): AutoHealingLocator {
    const strategies = this.generateAllStrategies(element);
    const sortedStrategies = this.rankStrategies(strategies);
    const elementSignature = this.createElementSignature(element);

    return {
      primary: sortedStrategies[0],
      fallbacks: sortedStrategies.slice(1),
      elementSignature,
      healingMetadata: {
        lastValidated: Date.now(),
        healingAttempts: 0,
        successfulHeals: 0,
      },
    };
  }

  /**
   * Generates all possible locator strategies for an element
   */
  private generateAllStrategies(element: RecordedElement): LocatorStrategy[] {
    const strategies: LocatorStrategy[] = [];

    // Handle Shadow DOM elements first
    if (element.shadowPath && element.shadowPath.length > 0) {
      const shadowStrategy = this.generateShadowDomStrategy(element);
      if (shadowStrategy) strategies.push(shadowStrategy);
    }

    // Role-based locators (most stable)
    const roleStrategy = this.generateRoleStrategy(element);
    if (roleStrategy) strategies.push(roleStrategy);

    // Text-based locators
    const textStrategy = this.generateTextStrategy(element);
    if (textStrategy) strategies.push(textStrategy);

    // Label-based locators
    const labelStrategy = this.generateLabelStrategy(element);
    if (labelStrategy) strategies.push(labelStrategy);

    // Placeholder-based locators
    const placeholderStrategy = this.generatePlaceholderStrategy(element);
    if (placeholderStrategy) strategies.push(placeholderStrategy);

    // Test ID locators
    const testIdStrategy = this.generateTestIdStrategy(element);
    if (testIdStrategy) strategies.push(testIdStrategy);

    // Application-specific data attribute locators
    const dataAttrStrategies = this.generateDataAttributeStrategies(element);
    strategies.push(...dataAttrStrategies);

    // ARIA-based locators
    const ariaStrategies = this.generateAriaStrategies(element);
    strategies.push(...ariaStrategies);

    // CSS selector locators
    const cssStrategy = this.generateCssStrategy(element);
    if (cssStrategy) strategies.push(cssStrategy);

    // XPath locators (last resort)
    const xpathStrategy = this.generateXPathStrategy(element);
    if (xpathStrategy) strategies.push(xpathStrategy);

    // Chained/filtered locators for complex scenarios
    const chainedStrategies = this.generateChainedStrategies(element);
    strategies.push(...chainedStrategies);

    return strategies;
  }

  /**
   * Shadow DOM Strategy Generation
   */
  private generateShadowDomStrategy(element: RecordedElement): LocatorStrategy | null {
    if (!element.shadowPath || element.shadowPath.length === 0) return null;

    const segments = element.shadowPath;
    let playwrightCode = 'page';

    // Build the shadow DOM traversal chain
    for (const segment of segments) {
      playwrightCode += `.locator('${this.escapeSelector(segment.hostSelector)}')`;
      
      // For Salesforce Lightning Web Components
      if (this.application === 'salesforce') {
        playwrightCode += `.locator('${this.escapeSelector(segment.shadowSelector)}')`;
      } else {
        // Generic shadow DOM piercing
        playwrightCode += `.locator('>>> ${this.escapeSelector(segment.shadowSelector)}')`;
      }
    }

    return {
      type: 'shadow-locator',
      value: JSON.stringify(segments),
      priority: 90,
      confidence: 85,
      isStable: true,
      isSemantic: false,
      applicationSpecific: true,
      requiresShadowDom: true,
      playwrightCode,
    };
  }

  /**
   * Role-based Strategy Generation
   */
  private generateRoleStrategy(element: RecordedElement): LocatorStrategy | null {
    const role = element.role || this.inferRole(element);
    if (!role) return null;

    let playwrightCode = `page.getByRole('${role}'`;
    const options: string[] = [];

    // Add name option if available
    const accessibleName = element.ariaLabel || element.text;
    if (accessibleName && accessibleName.length < 100) {
      options.push(`name: '${this.escapeString(accessibleName)}'`);
    }

    // Add exact match for stability
    if (options.length > 0) {
      options.push('exact: true');
    }

    if (options.length > 0) {
      playwrightCode += `, { ${options.join(', ')} }`;
    }
    playwrightCode += ')';

    return {
      type: 'role',
      value: role,
      priority: this.getPriorityForType('role'),
      confidence: 95,
      isStable: true,
      isSemantic: true,
      applicationSpecific: false,
      requiresShadowDom: false,
      playwrightCode,
    };
  }

  /**
   * Infer ARIA role from element
   */
  private inferRole(element: RecordedElement): string | null {
    const tagRoleMap: Record<string, string> = {
      button: 'button',
      a: 'link',
      input: this.getInputRole(element),
      select: 'combobox',
      textarea: 'textbox',
      table: 'table',
      tr: 'row',
      th: 'columnheader',
      td: 'cell',
      ul: 'list',
      li: 'listitem',
      nav: 'navigation',
      main: 'main',
      header: 'banner',
      footer: 'contentinfo',
      aside: 'complementary',
      dialog: 'dialog',
      article: 'article',
      section: 'region',
      form: 'form',
      img: 'img',
      h1: 'heading',
      h2: 'heading',
      h3: 'heading',
      h4: 'heading',
      h5: 'heading',
      h6: 'heading',
    };

    return tagRoleMap[element.tagName.toLowerCase()] || null;
  }

  private getInputRole(element: RecordedElement): string {
    const type = element.type?.toLowerCase() || 'text';
    const inputRoleMap: Record<string, string> = {
      text: 'textbox',
      password: 'textbox',
      email: 'textbox',
      tel: 'textbox',
      url: 'textbox',
      search: 'searchbox',
      checkbox: 'checkbox',
      radio: 'radio',
      button: 'button',
      submit: 'button',
      reset: 'button',
      number: 'spinbutton',
      range: 'slider',
    };
    return inputRoleMap[type] || 'textbox';
  }

  /**
   * Text-based Strategy Generation
   */
  private generateTextStrategy(element: RecordedElement): LocatorStrategy | null {
    if (!element.text || element.text.trim().length === 0 || element.text.length > 100) {
      return null;
    }

    const text = element.text.trim();
    const playwrightCode = `page.getByText('${this.escapeString(text)}', { exact: true })`;

    return {
      type: 'text',
      value: text,
      priority: this.getPriorityForType('text'),
      confidence: 80,
      isStable: this.isTextStable(text),
      isSemantic: true,
      applicationSpecific: false,
      requiresShadowDom: false,
      playwrightCode,
    };
  }

  /**
   * Label-based Strategy Generation
   */
  private generateLabelStrategy(element: RecordedElement): LocatorStrategy | null {
    // Check for associated label
    const labelText = this.findAssociatedLabel(element);
    if (!labelText) return null;

    const playwrightCode = `page.getByLabel('${this.escapeString(labelText)}')`;

    return {
      type: 'label',
      value: labelText,
      priority: this.getPriorityForType('label'),
      confidence: 90,
      isStable: true,
      isSemantic: true,
      applicationSpecific: false,
      requiresShadowDom: false,
      playwrightCode,
    };
  }

  private findAssociatedLabel(element: RecordedElement): string | null {
    // Check for nearby labels
    if (element.nearbyLabels && element.nearbyLabels.length > 0) {
      const forLabel = element.nearbyLabels.find(l => l.forAttribute === element.id);
      if (forLabel) return forLabel.text;
      
      // Return closest label
      const closest = element.nearbyLabels.sort((a, b) => a.distance - b.distance)[0];
      if (closest && closest.distance < 100) {
        return closest.text;
      }
    }

    // Check aria-labelledby
    if (element.ariaLabel) {
      return element.ariaLabel;
    }

    return null;
  }

  /**
   * Placeholder-based Strategy Generation
   */
  private generatePlaceholderStrategy(element: RecordedElement): LocatorStrategy | null {
    if (!element.placeholder) return null;

    const playwrightCode = `page.getByPlaceholder('${this.escapeString(element.placeholder)}')`;

    return {
      type: 'placeholder',
      value: element.placeholder,
      priority: this.getPriorityForType('placeholder') || 50,
      confidence: 85,
      isStable: true,
      isSemantic: true,
      applicationSpecific: false,
      requiresShadowDom: false,
      playwrightCode,
    };
  }

  /**
   * Test ID Strategy Generation
   */
  private generateTestIdStrategy(element: RecordedElement): LocatorStrategy | null {
    const testIdAttrs = ['data-testid', 'data-test-id', 'data-cy', 'data-qa', 'data-automation-id'];
    
    for (const attr of testIdAttrs) {
      const value = element.dataAttributes[attr];
      if (value) {
        const playwrightCode = `page.getByTestId('${this.escapeString(value)}')`;
        
        return {
          type: 'testid',
          value,
          priority: this.getPriorityForType('testid'),
          confidence: 95,
          isStable: true,
          isSemantic: false,
          applicationSpecific: false,
          requiresShadowDom: false,
          playwrightCode,
        };
      }
    }

    return null;
  }

  /**
   * Application-specific Data Attribute Strategies
   */
  private generateDataAttributeStrategies(element: RecordedElement): LocatorStrategy[] {
    const strategies: LocatorStrategy[] = [];

    for (const attrPattern of this.stableAttributes) {
      // Handle prefix patterns
      if (attrPattern.endsWith('-')) {
        for (const [attr, value] of Object.entries(element.dataAttributes)) {
          if (attr.startsWith(attrPattern.slice(0, -1))) {
            strategies.push(this.createDataAttrStrategy(attr, value));
          }
        }
      } else {
        const value = element.dataAttributes[attrPattern] || 
                      element.customAttributes[attrPattern];
        if (value) {
          strategies.push(this.createDataAttrStrategy(attrPattern, value));
        }
      }
    }

    return strategies;
  }

  private createDataAttrStrategy(attr: string, value: string): LocatorStrategy {
    const playwrightCode = `page.locator('[${attr}="${this.escapeSelector(value)}"]')`;

    return {
      type: 'data-attribute',
      value: `${attr}=${value}`,
      priority: this.getPriorityForType('data-attribute'),
      confidence: 90,
      isStable: true,
      isSemantic: false,
      applicationSpecific: true,
      requiresShadowDom: false,
      playwrightCode,
    };
  }

  /**
   * ARIA-based Strategies
   */
  private generateAriaStrategies(element: RecordedElement): LocatorStrategy[] {
    const strategies: LocatorStrategy[] = [];

    // aria-label
    if (element.ariaLabel) {
      strategies.push({
        type: 'aria',
        value: `aria-label=${element.ariaLabel}`,
        priority: this.getPriorityForType('aria'),
        confidence: 90,
        isStable: true,
        isSemantic: true,
        applicationSpecific: false,
        requiresShadowDom: false,
        playwrightCode: `page.locator('[aria-label="${this.escapeSelector(element.ariaLabel)}"]')`,
      });
    }

    // aria-describedby (less reliable but useful as fallback)
    if (element.ariaDescribedBy) {
      strategies.push({
        type: 'aria',
        value: `aria-describedby=${element.ariaDescribedBy}`,
        priority: this.getPriorityForType('aria') - 10,
        confidence: 70,
        isStable: false,
        isSemantic: true,
        applicationSpecific: false,
        requiresShadowDom: false,
        playwrightCode: `page.locator('[aria-describedby="${this.escapeSelector(element.ariaDescribedBy)}"]')`,
      });
    }

    return strategies;
  }

  /**
   * CSS Selector Strategy
   */
  private generateCssStrategy(element: RecordedElement): LocatorStrategy | null {
    const selector = this.buildRobustCssSelector(element);
    if (!selector) return null;

    return {
      type: 'css',
      value: selector,
      priority: this.getPriorityForType('css'),
      confidence: 60,
      isStable: false,
      isSemantic: false,
      applicationSpecific: false,
      requiresShadowDom: false,
      playwrightCode: `page.locator('${this.escapeSelector(selector)}')`,
    };
  }

  private buildRobustCssSelector(element: RecordedElement): string | null {
    const parts: string[] = [];

    // Start with tag name
    parts.push(element.tagName.toLowerCase());

    // Add stable ID if present and not dynamic
    if (element.id && !this.isDynamicId(element.id)) {
      return `#${element.id}`;
    }

    // Add stable classes
    if (element.className) {
      const classes = element.className.split(' ').filter(c => 
        c && !this.isDynamicClass(c) && c.length > 2
      );
      if (classes.length > 0) {
        parts.push(`.${classes.slice(0, 3).join('.')}`);
      }
    }

    // Add name attribute for form elements
    if (element.name) {
      parts.push(`[name="${element.name}"]`);
    }

    // Add type for inputs
    if (element.type && element.tagName.toLowerCase() === 'input') {
      parts.push(`[type="${element.type}"]`);
    }

    return parts.join('');
  }

  /**
   * XPath Strategy (last resort)
   */
  private generateXPathStrategy(element: RecordedElement): LocatorStrategy | null {
    // Generate a robust XPath that uses multiple attributes
    const xpath = this.buildRobustXPath(element);
    if (!xpath) return null;

    return {
      type: 'xpath',
      value: xpath,
      priority: this.getPriorityForType('xpath'),
      confidence: 40,
      isStable: false,
      isSemantic: false,
      applicationSpecific: false,
      requiresShadowDom: false,
      playwrightCode: `page.locator('xpath=${xpath}')`,
    };
  }

  private buildRobustXPath(element: RecordedElement): string {
    const conditions: string[] = [];
    const tag = element.tagName.toLowerCase();

    // Use text content if available
    if (element.text && element.text.length < 50) {
      conditions.push(`contains(text(), "${this.escapeString(element.text)}")`);
    }

    // Use stable attributes
    for (const attr of ['name', 'type', 'placeholder']) {
      const value = (element as any)[attr];
      if (value) {
        conditions.push(`@${attr}="${value}"`);
      }
    }

    // Use data attributes
    for (const [attr, value] of Object.entries(element.dataAttributes).slice(0, 2)) {
      conditions.push(`@${attr}="${value}"`);
    }

    if (conditions.length === 0) {
      // Use position-based as last resort
      return element.xpath;
    }

    return `//${tag}[${conditions.join(' and ')}]`;
  }

  /**
   * Chained/Filtered Strategies for complex scenarios
   */
  private generateChainedStrategies(element: RecordedElement): LocatorStrategy[] {
    const strategies: LocatorStrategy[] = [];

    // Parent-child chain
    if (element.parentInfo) {
      const parentSelector = this.buildParentSelector(element.parentInfo);
      const childSelector = this.buildChildSelector(element);
      
      if (parentSelector && childSelector) {
        strategies.push({
          type: 'chained',
          value: `${parentSelector} >> ${childSelector}`,
          priority: 30,
          confidence: 70,
          isStable: true,
          isSemantic: false,
          applicationSpecific: false,
          requiresShadowDom: false,
          playwrightCode: `page.locator('${parentSelector}').locator('${childSelector}')`,
        });
      }
    }

    // Filtered by nth
    if (element.siblings && element.siblings.length > 0) {
      const baseSelector = this.buildRobustCssSelector(element);
      if (baseSelector) {
        const index = this.calculateElementIndex(element);
        strategies.push({
          type: 'nth',
          value: `${baseSelector}:nth(${index})`,
          priority: 20,
          confidence: 50,
          isStable: false,
          isSemantic: false,
          applicationSpecific: false,
          requiresShadowDom: false,
          playwrightCode: `page.locator('${baseSelector}').nth(${index})`,
        });
      }
    }

    // Filter by has-text
    if (element.text && element.text.length < 30) {
      const baseSelector = element.tagName.toLowerCase();
      strategies.push({
        type: 'filtered',
        value: `${baseSelector}:has-text("${element.text}")`,
        priority: 35,
        confidence: 65,
        isStable: true,
        isSemantic: true,
        applicationSpecific: false,
        requiresShadowDom: false,
        playwrightCode: `page.locator('${baseSelector}').filter({ hasText: '${this.escapeString(element.text)}' })`,
      });
    }

    return strategies;
  }

  private buildParentSelector(parent: ParentElementInfo): string | null {
    const parts: string[] = [parent.tagName.toLowerCase()];
    
    if (parent.id) {
      return `#${parent.id}`;
    }
    
    if (parent.role) {
      return `[role="${parent.role}"]`;
    }

    if (parent.className) {
      const classes = parent.className.split(' ').filter(c => !this.isDynamicClass(c));
      if (classes.length > 0) {
        parts.push(`.${classes[0]}`);
      }
    }

    return parts.join('');
  }

  private buildChildSelector(element: RecordedElement): string {
    if (element.role) {
      return `[role="${element.role}"]`;
    }
    return element.tagName.toLowerCase();
  }

  private calculateElementIndex(element: RecordedElement): number {
    if (!element.siblings) return 0;
    
    const beforeCount = element.siblings.filter(s => s.position === 'before').length;
    return beforeCount;
  }

  /**
   * Create element signature for healing
   */
  private createElementSignature(element: RecordedElement): ElementSignature {
    const stableAttributes = this.extractStableAttributes(element);
    const contextualHints = this.extractContextualHints(element);

    return {
      tagName: element.tagName,
      textContent: element.text?.substring(0, 100),
      visualPosition: {
        relativeToViewport: this.getViewportPosition(element.boundingRect),
        relativeToParent: this.getParentPosition(element),
        approximateLocation: {
          x: Math.round(element.boundingRect.x / 100) * 100,
          y: Math.round(element.boundingRect.y / 100) * 100,
        },
      },
      attributes: stableAttributes,
      contextualHints,
      semanticRole: element.role || this.inferRole(element) || undefined,
    };
  }

  private extractStableAttributes(element: RecordedElement): StableAttribute[] {
    const attributes: StableAttribute[] = [];

    // Application-specific stable attributes
    for (const attrPattern of this.stableAttributes) {
      if (attrPattern.endsWith('-')) {
        for (const [attr, value] of Object.entries(element.dataAttributes)) {
          if (attr.startsWith(attrPattern.slice(0, -1))) {
            attributes.push({ name: attr, value, stability: 'high' });
          }
        }
      } else {
        const value = element.dataAttributes[attrPattern];
        if (value) {
          attributes.push({ name: attrPattern, value, stability: 'high' });
        }
      }
    }

    // Standard stable attributes
    if (element.name) {
      attributes.push({ name: 'name', value: element.name, stability: 'high' });
    }
    if (element.type) {
      attributes.push({ name: 'type', value: element.type, stability: 'high' });
    }
    if (element.ariaLabel) {
      attributes.push({ name: 'aria-label', value: element.ariaLabel, stability: 'medium' });
    }
    if (element.placeholder) {
      attributes.push({ name: 'placeholder', value: element.placeholder, stability: 'medium' });
    }

    return attributes;
  }

  private extractContextualHints(element: RecordedElement): ContextualHint[] {
    const hints: ContextualHint[] = [];

    // Nearby label text
    if (element.nearbyLabels) {
      for (const label of element.nearbyLabels.slice(0, 3)) {
        hints.push({
          type: 'nearby-text',
          value: label.text,
          reliability: 1 - (label.distance / 200),
        });
      }
    }

    // Parent context
    if (element.parentInfo) {
      hints.push({
        type: 'parent-context',
        value: `${element.parentInfo.tagName}${element.parentInfo.role ? `[role=${element.parentInfo.role}]` : ''}`,
        reliability: 0.7,
      });
    }

    // Form context
    if (element.name) {
      hints.push({
        type: 'form-context',
        value: element.name,
        reliability: 0.9,
      });
    }

    return hints;
  }

  private getViewportPosition(rect: { y: number }): 'top' | 'middle' | 'bottom' {
    if (rect.y < 300) return 'top';
    if (rect.y > 600) return 'bottom';
    return 'middle';
  }

  private getParentPosition(element: RecordedElement): 'first' | 'middle' | 'last' {
    if (!element.siblings || element.siblings.length === 0) return 'first';
    
    const beforeCount = element.siblings.filter(s => s.position === 'before').length;
    const afterCount = element.siblings.filter(s => s.position === 'after').length;
    
    if (beforeCount === 0) return 'first';
    if (afterCount === 0) return 'last';
    return 'middle';
  }

  /**
   * Rank strategies by priority and confidence
   */
  private rankStrategies(strategies: LocatorStrategy[]): LocatorStrategy[] {
    return strategies.sort((a, b) => {
      // First by priority order in application config
      const aPriorityIndex = this.locatorPriorities.indexOf(a.type);
      const bPriorityIndex = this.locatorPriorities.indexOf(b.type);
      
      if (aPriorityIndex !== bPriorityIndex) {
        const aIndex = aPriorityIndex === -1 ? 999 : aPriorityIndex;
        const bIndex = bPriorityIndex === -1 ? 999 : bPriorityIndex;
        return aIndex - bIndex;
      }

      // Then by confidence
      if (a.confidence !== b.confidence) {
        return b.confidence - a.confidence;
      }

      // Prefer stable locators
      if (a.isStable !== b.isStable) {
        return a.isStable ? -1 : 1;
      }

      // Prefer semantic locators
      if (a.isSemantic !== b.isSemantic) {
        return a.isSemantic ? -1 : 1;
      }

      return 0;
    });
  }

  private getPriorityForType(type: LocatorType): number {
    const index = this.locatorPriorities.indexOf(type);
    if (index === -1) return 0;
    return (this.locatorPriorities.length - index) * 10;
  }

  /**
   * Utility methods
   */
  private isDynamicId(id: string): boolean {
    // Common patterns for dynamic IDs
    const dynamicPatterns = [
      /^[a-f0-9]{8}-[a-f0-9]{4}-/i,  // UUID
      /^\d+$/,                         // Pure numbers
      /_\d+$/,                         // Ending with underscore + numbers
      /^ember\d+/,                     // Ember.js
      /^react-/,                       // React
      /^ng-/,                          // Angular
      /__[a-z]+\d+-/,                  // SAP UI5
      /^j_id\d+/,                      // JSF
    ];

    return dynamicPatterns.some(pattern => pattern.test(id));
  }

  private isDynamicClass(className: string): boolean {
    const dynamicPatterns = [
      /^[a-z]{1,3}\d{4,}/i,  // Short prefix + many numbers
      /_[a-f0-9]{6,}/i,       // Hashed classes
      /^css-/,                // CSS-in-JS
      /^sc-/,                 // Styled components
      /^emotion-/,            // Emotion
      /--\d+$/,               // BEM with numbers
    ];

    return dynamicPatterns.some(pattern => pattern.test(className));
  }

  private isTextStable(text: string): boolean {
    // Text containing numbers or dates is likely dynamic
    const unstablePatterns = [
      /\d{2,}/,              // Multiple digits
      /\$[\d,]+/,            // Currency
      /\d{1,2}\/\d{1,2}/,    // Dates
      /\d+%/,                // Percentages
    ];

    return !unstablePatterns.some(pattern => pattern.test(text));
  }

  private escapeString(str: string): string {
    return str
      .replace(/\\/g, '\\\\')
      .replace(/'/g, "\\'")
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r');
  }

  private escapeSelector(str: string): string {
    return str
      .replace(/\\/g, '\\\\')
      .replace(/'/g, "\\'")
      .replace(/"/g, '\\"');
  }
}
