/**
 * Page Analyzer - Agentic Page Understanding (Phases 1-4)
 * Supports 25+ enterprise apps with Shadow DOM traversal
 * Extracted from content.js for modularity
 *
 * Depends on: AppSelectorConfig, SyntheticDataGenerator (passed via constructor/setDeps)
 * Exposes: window._FlowstralPageAnalyzer
 */

(function() {
  'use strict';

  class PageAnalyzer {
    constructor(smartSelector) {
      this.smartSelector = smartSelector;
      this.lastAnalysis = null;
      this.analysisCache = new Map();
      // These are set by the IIFE after construction via setDeps()
      this._appSelectorConfig = null;
      this._syntheticDataGenerator = null;
    }

    /**
     * Set dependencies that are only available inside the IIFE
     */
    setDeps(appSelectorConfig, syntheticDataGenerator) {
      this._appSelectorConfig = appSelectorConfig;
      this._syntheticDataGenerator = syntheticDataGenerator;
    }

    /**
     * Deep query that pierces Shadow DOM - works for Salesforce, Workday, etc.
     */
    deepQuery(selector) {
      const results = [];
      const search = (root) => {
        try {
          results.push(...root.querySelectorAll(selector));
        } catch (e) {}
        // Traverse shadow roots
        root.querySelectorAll('*').forEach(el => {
          if (el.shadowRoot) {
            search(el.shadowRoot);
          }
        });
      };
      search(document);
      return results.filter(el => this.isVisible(el));
    }

    /**
     * Check if element is visible
     */
    isVisible(el) {
      if (!el) return false;
      try {
        const rect = el.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return false;
        const style = window.getComputedStyle(el);
        return style.display !== 'none' &&
               style.visibility !== 'hidden' &&
               style.opacity !== '0';
      } catch (e) {
        return false;
      }
    }

    /**
     * Main analysis method - returns complete page understanding
     */
    analyze() {
      const startTime = performance.now();

      // Detect app type using existing smart selector
      const appType = this.smartSelector?.currentApp || 'generic';
      const AppSelectorConfig = this._appSelectorConfig || {};
      const appConfig = AppSelectorConfig[appType] || AppSelectorConfig.generic || {};

      // Collect all interactive elements with Shadow DOM support
      const buttons = this.collectButtons();
      const links = this.collectLinks();
      const inputs = this.collectInputs();
      const headings = this.collectHeadings();

      // Classify page type
      const pageType = this.classifyPageType();

      // Build analysis result
      const analysis = {
        url: window.location.href,
        title: document.title,
        pageType,
        appType,
        appName: appConfig.name || 'Generic',

        // Element collections with selectors
        buttons,
        links,
        inputs,
        headings,

        // Summary counts
        counts: {
          buttons: buttons.length,
          links: links.length,
          inputs: inputs.length,
          headings: headings.length,
          total: buttons.length + links.length + inputs.length + headings.length
        },

        // Performance
        timing: (performance.now() - startTime).toFixed(2) + 'ms',
        analyzedAt: Date.now()
      };

      this.lastAnalysis = analysis;
      return analysis;
    }

    /**
     * Collect all buttons AND clickable elements with FULL selector data
     */
    collectButtons() {
      const standardButtons = this.deepQuery('button, [role="button"], input[type="submit"], input[type="button"], a.btn, a.button, .slds-button');

      const clickableElements = this.deepQuery([
        '[role="option"]',
        '[role="menuitem"]',
        '[role="listitem"]',
        '[role="tab"]',
        '[role="radio"]',
        '[role="checkbox"]',
        '[tabindex="0"]',
        '[onclick]',
        '[data-action]',
        '[data-click]',
        '[data-testid*="button"]',
        '[data-testid*="card"]',
        '[data-testid*="option"]',
        '.card[class*="clickable"]',
        '.card[class*="selectable"]',
        'div[class*="option"]',
        'div[class*="choice"]',
        'div[class*="select"]',
        'li[class*="option"]',
        'li[class*="item"][class*="click"]',
      ].join(', '));

      const cursorPointerElements = Array.from(document.querySelectorAll('div, li, span, article, section'))
        .filter(el => {
          if (!this.isVisible(el)) return false;
          const style = window.getComputedStyle(el);
          const hasCursor = style.cursor === 'pointer';
          const hasText = this.getElementText(el)?.length > 0 && this.getElementText(el)?.length < 80;
          const hasNoClickableChildren = !el.querySelector('button, a, [role="button"]');
          return hasCursor && hasText && hasNoClickableChildren;
        });

      const allElements = [...standardButtons, ...clickableElements, ...cursorPointerElements];
      const seen = new Set();
      const uniqueElements = allElements.filter(el => {
        if (seen.has(el)) return false;
        seen.add(el);
        return true;
      });

      const seenTexts = new Map();

      return uniqueElements.slice(0, 150).map(el => {
        const text = this.getElementText(el);
        if (!text || text.length > 80) return null;

        const count = seenTexts.get(text) || 0;
        seenTexts.set(text, count + 1);

        const fullSelector = this.smartSelector ? this.smartSelector.getBestSelector(el) : null;

        const tagName = el.tagName.toLowerCase();
        const role = el.getAttribute('role');
        let elementType = 'button';
        if (role === 'option' || role === 'radio' || role === 'checkbox') elementType = 'option';
        else if (role === 'tab') elementType = 'tab';
        else if (role === 'menuitem') elementType = 'menuitem';
        else if (tagName === 'div' || tagName === 'li') elementType = 'card';

        return {
          text,
          duplicateIndex: count,
          tagName,
          elementType,
          selectorObj: fullSelector,
          selector: fullSelector?.playwright ? `page.${fullSelector.playwright}` : this.generateSelector(el, 'button', text),
          ariaLabel: el.getAttribute('aria-label'),
          disabled: el.disabled || el.getAttribute('aria-disabled') === 'true',
          id: el.id,
          className: el.className,
          name: el.name,
          role,
          parentId: el.parentElement?.id,
          parentClass: el.parentElement?.className?.split(' ')[0],
        };
      }).filter(Boolean);
    }

    /**
     * Collect all links with FULL selector data
     */
    collectLinks() {
      const elements = this.deepQuery('a[href]');
      const seenTexts = new Map();

      return elements.filter(el => {
        const text = this.getElementText(el);
        return text && text.length > 0 && text.length < 60 && !text.toLowerCase().includes('skip');
      }).slice(0, 100).map(el => {
        const text = this.getElementText(el);

        const count = seenTexts.get(text) || 0;
        seenTexts.set(text, count + 1);

        const fullSelector = this.smartSelector ? this.smartSelector.getBestSelector(el) : null;

        return {
          text,
          duplicateIndex: count,
          href: el.getAttribute('href'),
          selectorObj: fullSelector,
          selector: fullSelector?.playwright ? `page.${fullSelector.playwright}` : this.generateSelector(el, 'link', text),
          id: el.id,
          className: el.className,
          ariaLabel: el.getAttribute('aria-label'),
          parentId: el.parentElement?.id,
          parentClass: el.parentElement?.className?.split(' ')[0],
          location: this.getElementLocation(el),
        };
      }).filter(Boolean);
    }

    /**
     * Determine element location (header, footer, nav, main, etc.)
     */
    getElementLocation(el) {
      let current = el;
      while (current && current !== document.body) {
        const tag = current.tagName?.toLowerCase();
        const role = current.getAttribute('role');
        const className = (current.className || '').toString().toLowerCase();
        const id = (current.id || '').toLowerCase();

        if (tag === 'header' || role === 'banner' ||
            className.includes('header') || className.includes('masthead') ||
            id.includes('header') || id.includes('masthead')) {
          return 'header';
        }

        if (tag === 'footer' || role === 'contentinfo' ||
            className.includes('footer') || className.includes('site-footer') ||
            className.includes('bottom') || className.includes('copyright') ||
            id.includes('footer') || id.includes('bottom')) {
          return 'footer';
        }

        if (tag === 'nav' || role === 'navigation' ||
            className.includes('nav') || className.includes('menu') ||
            className.includes('navigation') || id.includes('nav')) {
          return 'nav';
        }

        if (tag === 'main' || role === 'main' ||
            className.includes('main-content') || id === 'main' || id === 'content') {
          return 'main';
        }

        if (tag === 'aside' || role === 'complementary' ||
            className.includes('sidebar') || className.includes('aside')) {
          return 'sidebar';
        }

        current = current.parentElement;
      }
      return 'body';
    }

    /**
     * Collect all form inputs with FULL selector data
     */
    collectInputs() {
      const standardInputs = this.deepQuery('input:not([type="hidden"]):not([type="submit"]):not([type="button"]), select, textarea');
      const roleRadios = this.deepQuery('[role="radio"]');
      const roleCheckboxes = this.deepQuery('[role="checkbox"]');

      const results = [];
      const seenLabels = new Map();
      const syntheticDataGenerator = this._syntheticDataGenerator;

      standardInputs.slice(0, 50).forEach(el => {
        const label = this.getInputLabel(el);
        const type = el.type || el.tagName.toLowerCase();

        const labelKey = (label || '').toLowerCase();
        const count = seenLabels.get(labelKey) || 0;
        if (labelKey) seenLabels.set(labelKey, count + 1);

        const fullSelector = this.smartSelector ? this.smartSelector.getBestSelector(el) : null;

        let actionType = 'fill';
        if (type === 'radio' || type === 'checkbox') {
          actionType = 'click';
        } else if (type === 'select' || el.tagName.toLowerCase() === 'select') {
          actionType = 'select';
        }

        const dataAnalysis = syntheticDataGenerator ? syntheticDataGenerator.analyzeElement(el) : { fieldType: 'text', suggestedValue: '', confidence: 0, alternatives: [] };

        results.push({
          label: label || el.name || el.placeholder || 'unlabeled',
          type,
          actionType,
          tagName: el.tagName.toLowerCase(),
          name: el.name,
          id: el.id,
          className: el.className,
          placeholder: el.placeholder,
          required: el.required,
          value: el.value?.substring(0, 50),
          selectorObj: fullSelector,
          selector: fullSelector?.playwright ? `page.${fullSelector.playwright}` : this.generateInputSelector(el, label),
          syntheticData: {
            detectedType: dataAnalysis.fieldType,
            suggestedValue: dataAnalysis.suggestedValue,
            confidence: dataAnalysis.confidence,
            alternatives: dataAnalysis.alternatives
          }
        });
      });

      roleRadios.slice(0, 30).forEach(el => {
        const label = el.textContent?.trim() || el.getAttribute('aria-label') || el.getAttribute('data-value');
        if (!label || label.length > 50) return;

        const labelKey = label.toLowerCase();
        const count = seenLabels.get(labelKey) || 0;
        seenLabels.set(labelKey, count + 1);

        const fullSelector = this.smartSelector ? this.smartSelector.getBestSelector(el) : null;

        results.push({
          label,
          type: 'radio',
          actionType: 'click',
          tagName: el.tagName.toLowerCase(),
          role: 'radio',
          ariaChecked: el.getAttribute('aria-checked'),
          selectorObj: fullSelector,
          selector: fullSelector?.playwright ? `page.${fullSelector.playwright}` : `page.getByRole('radio', { name: '${this.escapeSelector(label)}' })`,
          id: el.id,
          className: el.className,
        });
      });

      roleCheckboxes.slice(0, 30).forEach(el => {
        const label = el.textContent?.trim() || el.getAttribute('aria-label');
        if (!label || label.length > 50) return;

        const labelKey = label.toLowerCase();
        const count = seenLabels.get(labelKey) || 0;
        seenLabels.set(labelKey, count + 1);

        const fullSelector = this.smartSelector ? this.smartSelector.getBestSelector(el) : null;

        results.push({
          label,
          type: 'checkbox',
          actionType: 'click',
          tagName: el.tagName.toLowerCase(),
          role: 'checkbox',
          ariaChecked: el.getAttribute('aria-checked'),
          selectorObj: fullSelector,
          selector: fullSelector?.playwright ? `page.${fullSelector.playwright}` : `page.getByRole('checkbox', { name: '${this.escapeSelector(label)}' })`,
          id: el.id,
          className: el.className,
        });
      });

      // Process Salesforce Lightning comboboxes and custom dropdowns
      const comboboxes = this.deepQuery([
        'lightning-combobox',
        'lightning-picklist',
        '[role="combobox"]',
        '[part="combobox"]',
        '.slds-combobox',
        '.slds-dropdown-trigger',
        '[data-type="picklist"]',
        '.combobox-container',
        '[class*="combobox"]',
        '[class*="dropdown"][class*="trigger"]'
      ].join(', '));

      comboboxes.slice(0, 30).forEach(el => {
        let label = el.getAttribute('label') ||
                    el.getAttribute('aria-label') ||
                    el.getAttribute('placeholder') ||
                    el.querySelector('label')?.textContent?.trim() ||
                    el.closest('.slds-form-element')?.querySelector('label')?.textContent?.trim() ||
                    el.closest('[class*="form-element"]')?.querySelector('label')?.textContent?.trim();

        if (!label && el.id) {
          const labelEl = document.querySelector(`label[for="${el.id}"]`);
          if (labelEl) label = labelEl.textContent?.trim();
        }

        if (!label || label.length > 60) return;

        const labelKey = label.toLowerCase();
        if (seenLabels.has(labelKey)) return;
        seenLabels.set(labelKey, 1);

        const fullSelector = this.smartSelector ? this.smartSelector.getBestSelector(el) : null;

        results.push({
          label,
          type: 'combobox',
          actionType: 'click',
          tagName: el.tagName.toLowerCase(),
          role: el.getAttribute('role') || 'combobox',
          selectorObj: fullSelector,
          selector: fullSelector?.playwright ? `page.${fullSelector.playwright}` : `page.getByRole('combobox', { name: '${this.escapeSelector(label)}' })`,
          id: el.id,
          className: el.className,
          elementType: 'dropdown',
        });
      });

      return results;
    }

    /**
     * Collect all headings with Playwright selectors
     */
    collectHeadings() {
      const elements = this.deepQuery('h1, h2, h3, h4, h5, h6, [role="heading"]');
      const seenTexts = new Map();

      return elements.slice(0, 30).map(el => {
        const text = this.getElementText(el);
        if (!text || text.length > 80) return null;

        const count = seenTexts.get(text) || 0;
        seenTexts.set(text, count + 1);

        const level = el.tagName.toLowerCase().replace('h', '') || el.getAttribute('aria-level') || '2';

        const fullSelector = this.smartSelector ? this.smartSelector.getBestSelector(el) : null;

        return {
          text,
          level,
          duplicateIndex: count,
          selectorObj: fullSelector,
          selector: fullSelector?.playwright ? `page.${fullSelector.playwright}` : `page.getByRole('heading', { name: '${this.escapeSelector(text)}' })`,
          location: this.getElementLocation(el),
        };
      }).filter(Boolean);
    }

    /**
     * Generate Playwright selector for interactive element
     */
    generateSelector(el, role, text) {
      if (text && text.length < 50) {
        return `page.getByRole('${role}', { name: '${this.escapeSelector(text)}' })`;
      }

      const ariaLabel = el.getAttribute('aria-label');
      if (ariaLabel) {
        return `page.getByLabel('${this.escapeSelector(ariaLabel)}')`;
      }

      const testId = el.getAttribute('data-testid') || el.getAttribute('data-test-id');
      if (testId) {
        return `page.getByTestId('${this.escapeSelector(testId)}')`;
      }

      if (this.smartSelector) {
        const sel = this.smartSelector.getBestSelector(el);
        if (sel?.playwright) {
          return `page.${sel.playwright}`;
        }
      }

      return `page.getByRole('${role}', { name: '${this.escapeSelector(text || '')}' })`;
    }

    /**
     * Generate Playwright selector for input element
     */
    generateInputSelector(el, label) {
      if (label && label.length < 50) {
        return `page.getByLabel('${this.escapeSelector(label)}')`;
      }

      const placeholder = el.getAttribute('placeholder');
      if (placeholder) {
        return `page.getByPlaceholder('${this.escapeSelector(placeholder)}')`;
      }

      const name = el.getAttribute('name');
      if (name) {
        return `page.locator('[name="${this.escapeSelector(name)}"]')`;
      }

      const ariaLabel = el.getAttribute('aria-label');
      if (ariaLabel) {
        return `page.getByLabel('${this.escapeSelector(ariaLabel)}')`;
      }

      const type = el.type || 'text';
      return `page.locator('input[type="${type}"]')`;
    }

    /**
     * Get accessible text from element
     */
    getElementText(el) {
      if (!el) return '';

      const ariaLabel = el.getAttribute('aria-label');
      if (ariaLabel) return ariaLabel.trim();

      const title = el.getAttribute('title');
      if (title) return title.trim();

      let text = '';

      if (el.tagName === 'INPUT') {
        text = el.value || el.placeholder || '';
      } else {
        text = (el.textContent || '').trim();
      }

      text = text.replace(/\s+/g, ' ').trim();

      return text.substring(0, 60);
    }

    /**
     * Get label for input element
     */
    getInputLabel(el) {
      const ariaLabel = el.getAttribute('aria-label');
      if (ariaLabel) return ariaLabel;

      const id = el.id;
      if (id) {
        const label = document.querySelector(`label[for="${id}"]`);
        if (label) return (label.textContent || '').trim();
      }

      const parentLabel = el.closest('label');
      if (parentLabel) {
        const clone = parentLabel.cloneNode(true);
        const inputs = clone.querySelectorAll('input, select, textarea');
        inputs.forEach(i => i.remove());
        return (clone.textContent || '').trim();
      }

      const labelledBy = el.getAttribute('aria-labelledby');
      if (labelledBy) {
        const labelEl = document.getElementById(labelledBy);
        if (labelEl) return (labelEl.textContent || '').trim();
      }

      return el.placeholder || el.name || null;
    }

    /**
     * Classify page type based on content
     */
    classifyPageType() {
      const url = window.location.pathname.toLowerCase();
      const pageText = (document.body?.innerText || '').toLowerCase();

      if (/login|signin|auth/.test(url)) return 'login';
      if (/dashboard|home|overview/.test(url)) return 'dashboard';
      if (/settings|preferences|config/.test(url)) return 'settings';
      if (/search|find|results/.test(url)) return 'search';
      if (/new|create|add/.test(url)) return 'create-form';
      if (/edit|update|modify/.test(url)) return 'edit-form';
      if (/details|view|show/.test(url)) return 'detail';
      if (/list|index|all/.test(url)) return 'list';

      const hasLoginForm = pageText.includes('password') && (pageText.includes('login') || pageText.includes('sign in'));
      const hasForm = document.querySelector('form') !== null;
      const hasTable = document.querySelector('table, [role="grid"]') !== null;
      const hasSearch = document.querySelector('[type="search"], [role="searchbox"]') !== null;

      if (hasLoginForm) return 'login';
      if (hasTable) return 'list';
      if (hasSearch) return 'search';
      if (hasForm) return 'form';

      return 'generic';
    }

    /**
     * Generate Playwright assertion code for page validation
     */
    generateAssertions(maxAssertions = 10) {
      const analysis = this.lastAnalysis || this.analyze();
      const assertions = [];

      analysis.headings.slice(0, 3).forEach(h => {
        assertions.push({
          type: 'assert',
          action: 'toBeVisible',
          selector: h.selector,
          playwright: `await expect(${h.selector}).toBeVisible();`,
          python: `expect(${h.selector.replace('page.', 'page.')}).to_be_visible()`,
          description: `Heading: "${h.text}"`
        });
      });

      analysis.buttons.slice(0, 4).forEach(b => {
        if (!b.disabled) {
          assertions.push({
            type: 'assert',
            action: 'toBeVisible',
            selector: b.selector,
            playwright: `await expect(${b.selector}).toBeVisible();`,
            python: `expect(${b.selector.replace('page.', 'page.').replace(/getBy/g, 'get_by_').replace(/([A-Z])/g, '_$1').toLowerCase()}).to_be_visible()`,
            description: `Button: "${b.text}"`
          });
        }
      });

      analysis.links.slice(0, 3).forEach(l => {
        assertions.push({
          type: 'assert',
          action: 'toBeVisible',
          selector: l.selector,
          playwright: `await expect(${l.selector}).toBeVisible();`,
          python: `expect(${l.selector.replace('page.', 'page.').replace(/getBy/g, 'get_by_').replace(/([A-Z])/g, '_$1').toLowerCase()}).to_be_visible()`,
          description: `Link: "${l.text}"`
        });
      });

      return assertions.slice(0, maxAssertions);
    }

    /**
     * Escape special characters for selector strings
     */
    escapeSelector(str) {
      if (!str) return '';
      return str
        .replace(/\\/g, '\\\\')
        .replace(/'/g, "\\'")
        .replace(/"/g, '\\"')
        .replace(/\n/g, ' ')
        .trim();
    }
  }

  window._FlowstralPageAnalyzer = PageAnalyzer;
})();
