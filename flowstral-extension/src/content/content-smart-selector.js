/**
 * Enhanced Smart Selector
 * Multi-strategy selector generation for 25+ enterprise apps
 * Uses shared SmartSelector from recorder-engine.js if available
 * Extracted from content.js for modularity
 *
 * Depends on: AppSelectorConfig, ComputerVision, shared engine functions
 * Exposes: window._FlowstralEnhancedSmartSelector
 */

(function() {
  'use strict';

  class EnhancedSmartSelector {
    constructor() {
      // These will be set by the IIFE via setDeps()
      this._SharedSmartSelector = null;
      this._sharedDetectApp = null;
      this._sharedIsDynamic = null;
      this._AppSelectorConfig = null;
      this._ComputerVision = null;

      this._sharedSelector = null;
      this.currentApp = 'generic';
      this.appConfig = {};
      this.computerVision = null;
      this.useVisualLocators = false;
    }

    /**
     * Set dependencies and initialize. Called by the IIFE after construction.
     */
    setDeps(deps) {
      this._SharedSmartSelector = deps.SharedSmartSelector;
      this._sharedDetectApp = deps.sharedDetectApp;
      this._sharedIsDynamic = deps.sharedIsDynamic;
      this._AppSelectorConfig = deps.AppSelectorConfig;
      this._ComputerVision = deps.ComputerVision;

      // Initialize
      if (this._SharedSmartSelector) {
        this._sharedSelector = new this._SharedSmartSelector();
        this._sharedSelector.detectAndSetApp();
        this.currentApp = this._sharedSelector.currentApp;
        this.appConfig = this._sharedSelector.appConfig;
        console.log('[Recorder] Using shared SmartSelector, app:', this.currentApp);
      } else {
        this._sharedSelector = null;
        this.currentApp = 'generic';
        this.appConfig = (this._AppSelectorConfig || {}).generic || {};
      }
      this.computerVision = this._ComputerVision ? new this._ComputerVision() : null;
    }

    setApp(appKey) {
      if (this._sharedSelector) {
        this._sharedSelector.setApp(appKey);
        this.currentApp = this._sharedSelector.currentApp;
        this.appConfig = this._sharedSelector.appConfig;
        return;
      }
      const AppSelectorConfig = this._AppSelectorConfig || {};
      if (AppSelectorConfig[appKey]) {
        this.currentApp = appKey;
        this.appConfig = AppSelectorConfig[appKey];
        console.log(`[Recorder] App set to: ${this.appConfig.name}`);
      }
    }

    detectApp() {
      if (this._sharedDetectApp) {
        const app = this._sharedDetectApp();
        this.setApp(app);
        return app;
      }

      const url = window.location.href;
      const w = window;
      const d = document;
      const AppSelectorConfig = this._AppSelectorConfig || {};

      if (d.querySelector('[class*="lwc-"]') || d.querySelector('lightning-')) {
        this.setApp('salesforce-lwc');
        return 'salesforce-lwc';
      }

      if (d.querySelector('[data-aura-rendered-by]') || w.Aura || w.$A) {
        this.setApp('salesforce-aura');
        return 'salesforce-aura';
      }

      if (d.querySelector('[data-automation-id]') && d.querySelector('wd-')) {
        this.setApp('workday');
        return 'workday';
      }

      if (w.Xrm || w.Mscrm || d.querySelector('[data-id*="fieldControl"]')) {
        this.setApp('dynamics365');
        return 'dynamics365';
      }

      if (w.g_form || w.GlideRecord || d.querySelector('[id^="sys_"]')) {
        this.setApp('servicenow');
        return 'servicenow';
      }

      if (w.sap?.ui?.getCore || d.querySelector('[id^="__xmlview"]')) {
        this.setApp('sap-ui5');
        return 'sap-ui5';
      }

      for (const [key, config] of Object.entries(AppSelectorConfig)) {
        if (key === 'generic' || key === 'salesforce-lwc' || key === 'salesforce-aura' ||
            key === 'sap-ui5') continue;

        for (const pattern of config.detectPatterns || []) {
          if (pattern.test(url)) {
            if (config.detectElements) {
              const hasElement = config.detectElements.some(sel => {
                try {
                  return d.querySelector(sel) !== null;
                } catch (e) {
                  return false;
                }
              });
              if (hasElement) {
                this.setApp(key);
                return key;
              }
            } else {
              this.setApp(key);
              return key;
            }
          }
        }
      }

      this.setApp('generic');
      return 'generic';
    }

    enableVisualLocators(enabled) {
      this.useVisualLocators = enabled;
    }

    getBestSelector(element) {
      const tagName = element?.tagName?.toLowerCase();
      if (!element || tagName === 'body' || tagName === 'html') {
        console.warn('[Selector] Cannot generate selector for:', tagName || 'null element');
        const activeEl = document.activeElement;
        if (activeEl && activeEl !== document.body && activeEl.tagName) {
          console.log('[Selector] Using activeElement instead:', activeEl.tagName);
          element = activeEl;
        } else {
          return {
            selector: '[SELECTOR_NEEDED]',
            playwright: 'locator("[SELECTOR_NEEDED]")',
            type: 'error',
            confidence: 0,
            primary: { selector: '[SELECTOR_NEEDED]', playwright: 'locator("[SELECTOR_NEEDED]")', confidence: 0 },
            fallbacks: [],
            app: this.currentApp,
            appName: this.appConfig?.name || 'unknown',
          };
        }
      }

      const selectors = [];
      const isSalesforceApp = ['salesforce', 'salesforce-lwc', 'salesforce-aura'].includes(this.currentApp);

      if (isSalesforceApp) {
        this.addSalesforceOptimizedSelectors(element, selectors);
      }

      this.addAppSpecificSelectors(element, selectors);
      this.addTestAttributes(element, selectors);
      this.addAriaSelectors(element, selectors);
      this.addFormSelectors(element, selectors);
      this.addIdSelector(element, selectors);
      this.addTextSelectors(element, selectors);
      this.addCssSelectors(element, selectors);

      this.rankSelectors(selectors, element);

      const best = selectors.find(s => s.uniqueMatch) || selectors[0] || {
        selector: this.buildFallbackSelector(element),
        playwright: `locator('${this.buildFallbackSelector(element)}')`,
        type: 'fallback',
        confidence: 10,
      };

      const fallbackCandidates = selectors
        .filter(s => s !== best)
        .sort((a, b) => (b.confidence || 0) - (a.confidence || 0))
        .slice(0, 6);

      const title = element.getAttribute('title');
      if (title && title.length > 0 && title.length < 50) {
        const titleSelector = {
          type: 'title',
          selector: `[title="${this.escape(title)}"]`,
          playwright: `locator('[title="${this.escape(title)}"]')`,
          confidence: 90,
          description: `By title: ${title}`,
        };
        if (!fallbackCandidates.some(s => s.selector === titleSelector.selector)) {
          fallbackCandidates.unshift(titleSelector);
        }
      }

      return {
        primary: best,
        fallbacks: fallbackCandidates,
        app: this.currentApp,
        appName: this.appConfig.name,
        visualFingerprint: this.useVisualLocators && this.computerVision ? this.computerVision.captureFingerprint(element) : null,
        ...best,
      };
    }

    addSalesforceOptimizedSelectors(element, selectors) {
      const tag = element.tagName.toLowerCase();
      const role = element.getAttribute('role');
      const ariaLabel = element.getAttribute('aria-label');
      const title = element.getAttribute('title');
      const nameAttr = element.getAttribute('name');
      const valueAttr = element.getAttribute('value');
      const visibleText = this.getVisibleText(element);
      const classes = Array.from(element.classList || []);
      const hasSLDS = classes.some(c => c.startsWith('slds-'));

      if (visibleText && visibleText.length >= 2 && visibleText.length <= 80) {
        if (tag === 'button' || role === 'button' || hasSLDS) {
          selectors.push({
            type: 'role',
            selector: `getByRole('button', { name: '${this.escape(visibleText)}' })`,
            playwright: `getByRole('button', { name: '${this.escape(visibleText)}' })`,
            confidence: 1,
            description: `SF Button by text`
          });
        }
        if (tag === 'a' || role === 'link') {
          selectors.push({
            type: 'role',
            selector: `getByRole('link', { name: '${this.escape(visibleText)}' })`,
            playwright: `getByRole('link', { name: '${this.escape(visibleText)}' })`,
            confidence: 1,
            description: `SF Link by text`
          });
        }
        selectors.push({
          type: 'text',
          selector: null,
          playwright: `getByText('${this.escape(visibleText)}', { exact: true })`,
          confidence: 2,
          description: `SF Text exact`
        });
      }

      if (ariaLabel && ariaLabel.length > 1 && ariaLabel.length < 100) {
        selectors.push({
          type: 'label',
          selector: null,
          playwright: `getByLabel('${this.escape(ariaLabel)}')`,
          confidence: 2,
          description: `SF aria-label`
        });
      }

      if (nameAttr && !this.isDynamic(nameAttr)) {
        selectors.push({
          type: 'attribute',
          selector: `[name="${this.escape(nameAttr)}"]`,
          playwright: `locator('[name="${this.escape(nameAttr)}"]')`,
          confidence: 3,
          description: `SF name`
        });
      }

      if ((element.type === 'radio' || element.type === 'checkbox') && valueAttr && !this.isDynamic(valueAttr)) {
        selectors.push({
          type: 'attribute',
          selector: `input[value="${this.escape(valueAttr)}"]`,
          playwright: `locator('input[value="${this.escape(valueAttr)}"]')`,
          confidence: 2,
          description: `SF input value`
        });
      }

      if (title && title.length > 1) {
        selectors.push({
          type: 'attribute',
          selector: `[title="${this.escape(title)}"]`,
          playwright: `locator('[title="${this.escape(title)}"]')`,
          confidence: 3,
          description: `SF title`
        });
      }

      const sfAttrs = [
        'data-target-selection-name',
        'data-field',
        'field-name',
        'data-record-id',
        'data-object-api-name'
      ];
      sfAttrs.forEach(attr => {
        const val = element.getAttribute(attr);
        if (val && !this.isDynamic(val)) {
          selectors.push({
            type: 'sf-attribute',
            selector: `[${attr}="${this.escape(val)}"]`,
            playwright: `locator('[${attr}="${this.escape(val)}"]')`,
            confidence: 3,
            description: `SF ${attr}`
          });
        }
      });

      const lwcParent = this.findLWCParent(element);
      if (lwcParent && visibleText && visibleText.length <= 80) {
        const tagName = lwcParent.tagName.toLowerCase();
        selectors.push({
          type: 'lwc-text',
          selector: null,
          playwright: `locator('${tagName}').getByText('${this.escape(visibleText)}')`,
          confidence: 4,
          description: `LWC parent text`
        });
      }

      if (hasSLDS) {
        const stable = classes.find(c => c.startsWith('slds-') && c.length > 6 && !this.isDynamic(c));
        if (stable) {
          selectors.push({
            type: 'slds',
            selector: `.${stable}`,
            playwright: `locator('.${stable}')`,
            confidence: 8,
            description: `SF SLDS class`
          });
        }
      }
    }

    findLWCParent(element) {
      let current = element;
      while (current && current !== document.body) {
        if (current.tagName && current.tagName.toLowerCase().startsWith('lightning-')) {
          return current;
        }
        current = current.parentElement;
      }
      return null;
    }

    addAppSpecificSelectors(element, selectors) {
      const strategies = this.appConfig.strategies || [];

      for (const strategy of strategies) {
        const value = element.getAttribute(strategy.attr);
        if (value) {
          if (this.isProblematicSelector(value, strategy.attr)) {
            continue;
          }

          const selector = `[${strategy.attr}="${this.escape(value)}"]`;
          const playwrightCode = typeof strategy.playwright === 'function'
            ? strategy.playwright(value)
            : (strategy.useTestId
                ? `getByTestId('${this.escape(value)}')`
                : `locator('[${strategy.attr}="${this.escape(value)}"]')`);

          selectors.push({
            type: `app-${this.currentApp}`,
            selector: selector,
            playwright: playwrightCode,
            confidence: strategy.priority,
            description: `${this.appConfig.name}: ${strategy.attr}`,
          });
        }
      }

      if (this.currentApp === 'salesforce-lwc' || this.currentApp === 'salesforce-aura') {
        const tagName = element.tagName.toLowerCase();
        const title = element.getAttribute('title');
        const ariaLabel = element.getAttribute('aria-label');

        if (title === 'App Launcher' || ariaLabel === 'App Launcher' ||
            element.closest('[title="App Launcher"]') ||
            element.closest('[aria-label="App Launcher"]')) {
          selectors.push({
            type: 'salesforce-app-launcher',
            selector: 'button[title="App Launcher"]',
            playwright: `locator('button[title="App Launcher"]')`,
            confidence: 100,
            description: 'Salesforce: App Launcher button',
          });
          selectors.push({
            type: 'salesforce-app-launcher-fallback',
            selector: '[aria-label="App Launcher"]',
            playwright: `get_by_role('button', name='App Launcher')`,
            confidence: 95,
            description: 'Salesforce: App Launcher by role',
          });
          selectors.push({
            type: 'salesforce-app-launcher-css',
            selector: '.appLauncher button, .slds-icon-waffle_container button',
            playwright: `locator('.appLauncher button, .slds-icon-waffle_container button')`,
            confidence: 85,
            description: 'Salesforce: App Launcher by class',
          });
        }

        if (tagName.startsWith('lightning-')) {
          const name = element.getAttribute('name');
          const label = element.getAttribute('label');
          if (name) {
            selectors.push({
              type: 'app-salesforce-lwc-component',
              selector: `${tagName}[name="${this.escape(name)}"]`,
              playwright: `locator('${tagName}[name="${this.escape(name)}"]')`,
              confidence: 95,
              description: `Salesforce LWC: ${tagName} with name`,
            });
          }
          if (label) {
            selectors.push({
              type: 'app-salesforce-lwc-component',
              selector: `${tagName}[label="${this.escape(label)}"]`,
              playwright: `locator('${tagName}[label="${this.escape(label)}"]')`,
              confidence: 90,
              description: `Salesforce LWC: ${tagName} with label`,
            });
          }
        }

        if (tagName === 'lightning-radio-group' || element.closest('lightning-radio-group')) {
          const text = this.getVisibleText(element);
          if (text && text.length < 50) {
            selectors.push({
              type: 'app-salesforce-lwc-radio',
              selector: null,
              playwright: `locator('lightning-radio-group').getByText('${this.escape(text)}')`,
              confidence: 85,
              description: `Salesforce LWC: Radio group by text`,
            });
          }
        }
      }

      const tagName = element.tagName.toLowerCase();
      if (this.appConfig.tagPrefix && tagName.startsWith(this.appConfig.tagPrefix)) {
        const label = element.getAttribute('label') || element.getAttribute('name');
        if (label) {
          selectors.push({
            type: `app-${this.currentApp}-component`,
            selector: `${tagName}[label="${this.escape(label)}"]`,
            playwright: `locator('${tagName}[label="${this.escape(label)}"]')`,
            confidence: 90,
            description: `${this.appConfig.name} component: ${tagName}`,
          });
        }
      }

      if (this.appConfig.classPrefix) {
        const classes = Array.from(element.classList);
        for (const prefix of this.appConfig.classPrefix) {
          const matchingClass = classes.find(c => c.startsWith(prefix));
          if (matchingClass) {
            const text = (element.textContent || '').trim().substring(0, 30);
            if (text) {
              selectors.push({
                type: `app-${this.currentApp}-class`,
                selector: `.${matchingClass}`,
                playwright: `locator('.${matchingClass}').filter({ hasText: '${this.escape(text)}' })`,
                confidence: 70,
                description: `${this.appConfig.name} class: ${matchingClass}`,
              });
            }
          }
        }
      }

      if (this.appConfig.idPrefix && element.id?.startsWith(this.appConfig.idPrefix)) {
        selectors.push({
          type: `app-${this.currentApp}-id`,
          selector: `#${element.id}`,
          playwright: `locator('#${this.escape(element.id)}')`,
          confidence: 95,
          description: `${this.appConfig.name} ID: ${element.id}`,
        });
      }
    }

    addTestAttributes(element, selectors) {
      const testAttrs = ['data-testid', 'data-test-id', 'data-test', 'data-cy', 'data-qa'];

      for (const attr of testAttrs) {
        const value = element.getAttribute(attr);
        if (value) {
          selectors.push({
            type: 'test-attr',
            selector: `[${attr}="${this.escape(value)}"]`,
            playwright: attr === 'data-testid'
              ? `getByTestId('${this.escape(value)}')`
              : `locator('[${attr}="${this.escape(value)}"]')`,
            confidence: 95,
            description: `Test ID: ${value}`,
          });
        }
      }
    }

    addAriaSelectors(element, selectors) {
      const ariaLabel = element.getAttribute('aria-label');
      if (ariaLabel) {
        selectors.push({
          type: 'aria-label',
          selector: `[aria-label="${this.escape(ariaLabel)}"]`,
          playwright: `getByLabel('${this.escape(ariaLabel)}')`,
          confidence: 85,
          description: `ARIA: ${ariaLabel}`,
        });
      }

      const role = element.getAttribute('role') || this.getImplicitRole(element);
      if (role) {
        const name = this.getAccessibleName(element);
        if (name && name.length < 50) {
          selectors.push({
            type: 'role',
            playwright: `getByRole('${role}', { name: '${this.escape(name)}' })`,
            confidence: 80,
            description: `Role: ${role} "${name}"`,
          });
        }
      }
    }

    addFormSelectors(element, selectors) {
      const placeholder = element.getAttribute('placeholder');
      if (placeholder) {
        selectors.push({
          type: 'placeholder',
          selector: `[placeholder="${this.escape(placeholder)}"]`,
          playwright: `getByPlaceholder('${this.escape(placeholder)}')`,
          confidence: 75,
          description: `Placeholder: ${placeholder}`,
        });
      }

      const name = element.getAttribute('name');
      if (name && !this.isDynamic(name)) {
        selectors.push({
          type: 'name',
          selector: `[name="${this.escape(name)}"]`,
          playwright: `locator('[name="${this.escape(name)}"]')`,
          confidence: 70,
          description: `Name: ${name}`,
        });
      }
    }

    addIdSelector(element, selectors) {
      const id = element.id;
      if (id) {
        if (this.isProblematicSelector(id, 'id')) {
          return;
        }

        if (this.isDynamic(id)) {
          return;
        }

        selectors.push({
          type: 'id',
          selector: `#${this.escapeCSS(id)}`,
          playwright: `locator('#${this.escape(id)}')`,
          confidence: 65,
          description: `ID: ${id}`,
        });
      }
    }

    addTextSelectors(element, selectors) {
      const tagName = element.tagName.toLowerCase();
      const role = element.getAttribute('role');
      const text = (element.textContent || '').trim().substring(0, 50);

      if (['button', 'a'].includes(tagName) || role === 'button' || role === 'link') {
        if (text && text.length < 40) {
          const roleType = tagName === 'a' || role === 'link' ? 'link' : 'button';
          selectors.push({
            type: 'text',
            playwright: `getByRole('${roleType}', { name: '${this.escape(text)}' })`,
            confidence: 60,
            description: `Text: "${text}"`,
          });
        }
      }

      if (tagName === 'span' && text && text.length > 0 && text.length < 40) {
        const isSalesforceRadioLabel = element.classList.contains('slds-radio_faux') ||
                                        element.classList.contains('slds-checkbox_faux') ||
                                        element.closest('lightning-radio-group') ||
                                        element.closest('lightning-checkbox-group');

        if (isSalesforceRadioLabel || element.closest('label')) {
          selectors.push({
            type: 'text-span',
            playwright: `getByText('${this.escape(text)}', { exact: true })`,
            confidence: 85,
            description: `Text: "${text}"`,
          });

          const parentSelector = this.getParentContext(element);
          if (parentSelector) {
            selectors.push({
              type: 'text-filtered',
              playwright: `locator('${parentSelector}').filter({ hasText: '${this.escape(text)}' })`,
              confidence: 80,
              description: `Filtered: "${text}"`,
            });
          }
        }
      }

      if (tagName === 'img') {
        const alt = element.getAttribute('alt');
        if (alt) {
          selectors.push({
            type: 'alt',
            selector: `img[alt="${this.escape(alt)}"]`,
            playwright: `getByAltText('${this.escape(alt)}')`,
            confidence: 60,
            description: `Alt: ${alt}`,
          });
        }
      }
    }

    getParentContext(element) {
      const radioGroup = element.closest('lightning-radio-group');
      if (radioGroup) {
        const name = radioGroup.getAttribute('name');
        if (name) return `lightning-radio-group[name="${this.escape(name)}"]`;
      }

      const checkboxGroup = element.closest('lightning-checkbox-group');
      if (checkboxGroup) {
        const name = checkboxGroup.getAttribute('name');
        if (name) return `lightning-checkbox-group[name="${this.escape(name)}"]`;
      }

      const label = element.closest('label');
      if (label) {
        const forAttr = label.getAttribute('for');
        if (forAttr) return `label[for="${this.escape(forAttr)}"]`;
      }

      return null;
    }

    addCssSelectors(element, selectors) {
      const cssSelector = this.buildStableCssSelector(element);
      if (cssSelector) {
        selectors.push({
          type: 'css',
          selector: cssSelector,
          playwright: `locator('${this.escape(cssSelector)}')`,
          confidence: 45,
          description: `CSS: ${cssSelector}`,
        });
      }
    }

    addVisualSelector(element, selectors) {
      if (!this.computerVision) return;
      const fingerprint = this.computerVision.captureFingerprint(element);
      if (fingerprint) {
        selectors.push({
          type: 'visual',
          visualFingerprint: fingerprint,
          playwright: `// Visual locator: ${fingerprint.tagName} at ${fingerprint.position.quadrant}`,
          confidence: 30,
          description: `Visual: ${fingerprint.position.quadrant} (${fingerprint.bounds.width}x${fingerprint.bounds.height})`,
        });

        this.computerVision.highlightElement(element);
      }
    }

    rankSelectors(selectors, element) {
      for (const sel of selectors) {
        if (sel.selector) {
          try {
            const matches = document.querySelectorAll(sel.selector);
            sel.uniqueMatch = matches.length === 1 && matches[0] === element;
            sel.matchCount = matches.length;
            if (!sel.uniqueMatch && sel.matchCount > 1) {
              sel.confidence *= 0.5;
            }
          } catch (e) {
            sel.uniqueMatch = false;
          }
        } else {
          sel.uniqueMatch = true;
        }
      }
      selectors.sort((a, b) => b.confidence - a.confidence);
    }

    buildStableCssSelector(element) {
      const tag = element.tagName.toLowerCase();
      const classes = Array.from(element.classList)
        .filter(c => !this.isDynamic(c))
        .slice(0, 2);

      if (classes.length === 0) return null;

      const selector = `${tag}.${classes.join('.')}`;
      try {
        const matches = document.querySelectorAll(selector);
        if (matches.length === 1 && matches[0] === element) {
          return selector;
        }
        return null;
      } catch (e) {}
      return null;
    }

    buildFallbackSelector(element) {
      const tag = element.tagName?.toLowerCase() || 'unknown';

      if (tag === 'body' || tag === 'html' || tag === 'document' || !element.tagName) {
        console.warn('[Selector] Rejecting invalid element:', tag);
        return 'input';
      }

      if (tag === 'input' || tag === 'textarea' || tag === 'select') {
        const type = element.getAttribute('type') || 'text';
        const name = element.getAttribute('name');
        const placeholder = element.getAttribute('placeholder');
        const id = element.id;

        if (name && !this.isDynamic(name)) {
          return `${tag}[name="${this.escape(name)}"]`;
        }
        if (id && !this.isDynamic(id)) {
          return `#${this.escapeCSS(id)}`;
        }
        if (placeholder) {
          return `${tag}[placeholder="${this.escape(placeholder)}"]`;
        }
        return `${tag}[type="${type}"]`;
      }

      const text = this.getVisibleText(element);
      if (text && text.length > 2 && text.length < 50) {
        try {
          const matches = document.querySelectorAll(`*:not(script):not(style)`);
          let textMatches = 0;
          for (const el of matches) {
            const elText = (el.textContent || '').trim();
            if (elText === text) textMatches++;
          }
          if (textMatches <= 3) {
            return `text="${this.escape(text)}"`;
          }
        } catch (e) {}
      }

      let current = element;
      let depth = 0;
      while (current && current !== document.body && depth < 5) {
        const id = current.id;
        const name = current.getAttribute('name');
        const dataTestId = current.getAttribute('data-testid');

        if (id && !this.isDynamic(id)) {
          const relPath = this.getRelativePath(element, current);
          if (relPath && relPath !== 'body' && relPath !== 'html') {
            return `#${this.escapeCSS(id)} ${relPath}`;
          }
        }
        if (name && !this.isDynamic(name)) {
          const relPath = this.getRelativePath(element, current);
          if (relPath && relPath !== 'body' && relPath !== 'html') {
            return `[name="${this.escape(name)}"] ${relPath}`;
          }
        }
        if (dataTestId && !this.isDynamic(dataTestId)) {
          const relPath = this.getRelativePath(element, current);
          if (relPath && relPath !== 'body' && relPath !== 'html') {
            return `[data-testid="${this.escape(dataTestId)}"] ${relPath}`;
          }
        }

        current = current.parentElement;
        depth++;
      }

      const role = element.getAttribute('role');
      if (role) {
        return `${tag}[role="${role}"]`;
      }

      if (tag === 'body' || tag === 'html') {
        return 'div';
      }

      return `${tag}:first-of-type`;
    }

    getRelativePath(target, ancestor) {
      const tag = target.tagName.toLowerCase();
      const directChild = target.parentElement === ancestor;
      if (directChild) {
        return tag;
      }

      const parentTag = target.parentElement?.tagName.toLowerCase() || '';
      if (parentTag && target.parentElement?.parentElement === ancestor) {
        return `${parentTag} ${tag}`;
      }

      return tag;
    }

    getVisibleText(element) {
      if (!element) return '';

      if (element.tagName.toLowerCase() === 'input') {
        const id = element.id;
        if (id) {
          const label = document.querySelector(`label[for="${id}"]`);
          if (label) return (label.textContent || '').trim();
        }
      }

      if (element.tagName.toLowerCase() === 'label') {
        const clone = element.cloneNode(true);
        const inputs = clone.querySelectorAll('input, select, textarea');
        inputs.forEach(input => input.remove());
        return (clone.textContent || '').trim();
      }

      const directText = Array.from(element.childNodes)
        .filter(n => n.nodeType === Node.TEXT_NODE)
        .map(n => n.textContent.trim())
        .join(' ')
        .trim();

      if (directText) return directText;

      return (element.textContent || '').trim().substring(0, 50);
    }

    getImplicitRole(el) {
      const map = { button: 'button', a: 'link', input: 'textbox', select: 'combobox', textarea: 'textbox' };
      return map[el.tagName.toLowerCase()];
    }

    getAccessibleName(el) {
      return el.getAttribute('aria-label') || el.getAttribute('title') ||
             (el.textContent || '').trim().substring(0, 50);
    }

    isDynamic(str) {
      if (!str) return false;

      // Use shared isDynamic if available
      if (this._sharedIsDynamic) {
        return this._sharedIsDynamic(str);
      }

      if (this.currentApp === 'salesforce-lwc' || this.currentApp === 'salesforce') {
        if (/^(radio|checkbox|input)-\d+(-\d+)?$/.test(str)) {
          return true;
        }
      }

      if (this.currentApp === 'sap-ui5' || this.currentApp === 'sap') {
        if (/^__xmlview\d+--/.test(str) || /^__button\d+$/.test(str) || /^__clone\d+$/.test(str)) {
          return true;
        }
      }

      const patterns = [
        /^[a-f0-9]{8,}$/i, /^\d{6,}$/, /^:r[0-9a-z]+:$/,
        /^ember\d+$/, /^ng-/, /^vue-/, /^react-/,
        /^css-[a-z0-9]+$/i, /^sc-[a-z]+$/i, /^_[a-z0-9]{5,}$/i,
        /^gwt-uid-\d+$/,
        /^ext-comp-\d+$/,
        /^wd-[A-F0-9-]+$/i,
      ];
      return patterns.some(p => p.test(str));
    }

    isProblematicSelector(value, attrType) {
      if (!value) return false;

      if (attrType === 'data-id' && /^\d{1,4}$/.test(value)) {
        console.log(`[Flowstral] Skipping simple numeric data-id: ${value}`);
        return true;
      }

      if (this.appConfig.avoidPatterns) {
        for (const pattern of this.appConfig.avoidPatterns) {
          if (pattern.test(value)) {
            return true;
          }
        }
      }

      if (this.currentApp === 'salesforce-lwc' || this.currentApp === 'salesforce') {
        if (attrType === 'id' && (/^(radio|checkbox|input)-\d+-\d+$/.test(value) ||
            /^(radio|checkbox|input)-\d+$/.test(value))) {
          return true;
        }
        if (attrType === 'class' && /^lwc-[a-z0-9]+$/i.test(value)) {
          return true;
        }
      }

      return false;
    }

    escape(str) {
      return (str || '').replace(/['\\]/g, '\\$&').replace(/\n/g, '\\n');
    }

    escapeCSS(str) {
      return (str || '').replace(/([!"#$%&'()*+,./:;<=>?@[\]^`{|}~])/g, '\\$1');
    }
  }

  window._FlowstralEnhancedSmartSelector = EnhancedSmartSelector;
})();
