/**
 * SmartSelector - Generates multiple selector strategies and ranks them by reliability
 * This is the key differentiator that makes scripts more reliable than Tosca
 */

class SmartSelector {
  constructor() {
    // Priority order for selector strategies (higher = more reliable)
    this.selectorPriority = {
      'data-testid': 100,
      'data-test': 95,
      'data-cy': 95,
      'data-qa': 90,
      'aria-label': 85,
      'aria-labelledby': 80,
      'role-text': 75,
      'placeholder': 70,
      'name': 65,
      'id': 60, // IDs can be dynamic, so lower priority
      'text-content': 55,
      'css-stable': 50,
      'css-nth': 30,
      'xpath': 20,
    };
  }

  /**
   * Generate all possible selectors for an element and rank them
   */
  generateSelectors(element) {
    const selectors = [];

    // 1. Data attributes (most reliable for testing)
    this.addDataAttributeSelectors(element, selectors);

    // 2. ARIA attributes (great for accessibility-first apps)
    this.addAriaSelectors(element, selectors);

    // 3. Form-specific attributes
    this.addFormSelectors(element, selectors);

    // 4. ID selector (with dynamic ID detection)
    this.addIdSelector(element, selectors);

    // 5. Text-based selectors
    this.addTextSelectors(element, selectors);

    // 6. CSS selectors (various strategies)
    this.addCssSelectors(element, selectors);

    // 7. XPath as fallback
    this.addXPathSelector(element, selectors);

    // Sort by priority and uniqueness score
    return this.rankSelectors(selectors, element);
  }

  addDataAttributeSelectors(element, selectors) {
    const dataAttrs = ['data-testid', 'data-test', 'data-test-id', 'data-cy', 'data-qa', 'data-automation'];
    
    for (const attr of dataAttrs) {
      const value = element.getAttribute(attr);
      if (value) {
        selectors.push({
          type: attr.includes('testid') ? 'data-testid' : 'data-test',
          selector: `[${attr}="${this.escapeSelector(value)}"]`,
          playwright: `getByTestId('${this.escapeString(value)}')`,
          confidence: this.selectorPriority['data-testid'],
          description: `Test ID: ${value}`
        });
      }
    }
  }

  addAriaSelectors(element, selectors) {
    // aria-label
    const ariaLabel = element.getAttribute('aria-label');
    if (ariaLabel) {
      selectors.push({
        type: 'aria-label',
        selector: `[aria-label="${this.escapeSelector(ariaLabel)}"]`,
        playwright: `getByLabel('${this.escapeString(ariaLabel)}')`,
        confidence: this.selectorPriority['aria-label'],
        description: `ARIA Label: ${ariaLabel}`
      });
    }

    // role + name combination
    const role = element.getAttribute('role') || this.getImplicitRole(element);
    if (role) {
      const accessibleName = this.getAccessibleName(element);
      if (accessibleName) {
        selectors.push({
          type: 'role-text',
          selector: `[role="${role}"]`,
          playwright: `getByRole('${role}', { name: '${this.escapeString(accessibleName)}' })`,
          confidence: this.selectorPriority['role-text'],
          description: `Role: ${role} with name: ${accessibleName}`
        });
      }
    }
  }

  addFormSelectors(element, selectors) {
    const tagName = element.tagName.toLowerCase();

    // Placeholder text
    const placeholder = element.getAttribute('placeholder');
    if (placeholder) {
      selectors.push({
        type: 'placeholder',
        selector: `[placeholder="${this.escapeSelector(placeholder)}"]`,
        playwright: `getByPlaceholder('${this.escapeString(placeholder)}')`,
        confidence: this.selectorPriority['placeholder'],
        description: `Placeholder: ${placeholder}`
      });
    }

    // Name attribute
    const name = element.getAttribute('name');
    if (name) {
      selectors.push({
        type: 'name',
        selector: `[name="${this.escapeSelector(name)}"]`,
        playwright: `locator('[name="${this.escapeString(name)}"]')`,
        confidence: this.selectorPriority['name'],
        description: `Name attribute: ${name}`
      });
    }

    // Label association
    const id = element.getAttribute('id');
    if (id) {
      const label = document.querySelector(`label[for="${id}"]`);
      if (label) {
        const labelText = label.textContent.trim();
        selectors.push({
          type: 'aria-labelledby',
          selector: `#${this.escapeSelector(id)}`,
          playwright: `getByLabel('${this.escapeString(labelText)}')`,
          confidence: this.selectorPriority['aria-labelledby'],
          description: `Label: ${labelText}`
        });
      }
    }
  }

  addIdSelector(element, selectors) {
    const id = element.getAttribute('id');
    if (id && !this.isDynamicId(id)) {
      selectors.push({
        type: 'id',
        selector: `#${this.escapeSelector(id)}`,
        playwright: `locator('#${this.escapeString(id)}')`,
        confidence: this.selectorPriority['id'],
        description: `ID: ${id}`
      });
    }
  }

  addTextSelectors(element, selectors) {
    const tagName = element.tagName.toLowerCase();
    
    // Button and link text
    if (['button', 'a'].includes(tagName) || element.getAttribute('role') === 'button') {
      const text = this.getVisibleText(element);
      if (text && text.length < 100) {
        const isExact = text.length < 30;
        selectors.push({
          type: 'text-content',
          selector: null,
          playwright: isExact 
            ? `getByRole('${tagName === 'a' ? 'link' : 'button'}', { name: '${this.escapeString(text)}' })`
            : `getByText('${this.escapeString(text.substring(0, 50))}')`,
          confidence: this.selectorPriority['text-content'],
          description: `Text: ${text.substring(0, 50)}`
        });
      }
    }

    // Alt text for images
    if (tagName === 'img') {
      const alt = element.getAttribute('alt');
      if (alt) {
        selectors.push({
          type: 'text-content',
          selector: `img[alt="${this.escapeSelector(alt)}"]`,
          playwright: `getByAltText('${this.escapeString(alt)}')`,
          confidence: this.selectorPriority['text-content'],
          description: `Alt text: ${alt}`
        });
      }
    }

    // Title attribute
    const title = element.getAttribute('title');
    if (title) {
      selectors.push({
        type: 'text-content',
        selector: `[title="${this.escapeSelector(title)}"]`,
        playwright: `getByTitle('${this.escapeString(title)}')`,
        confidence: this.selectorPriority['text-content'] - 5,
        description: `Title: ${title}`
      });
    }
  }

  addCssSelectors(element, selectors) {
    // Try to build a stable CSS selector using tag + classes
    const stableSelector = this.buildStableCssSelector(element);
    if (stableSelector) {
      selectors.push({
        type: 'css-stable',
        selector: stableSelector,
        playwright: `locator('${this.escapeString(stableSelector)}')`,
        confidence: this.selectorPriority['css-stable'],
        description: `CSS: ${stableSelector}`
      });
    }

    // nth-child based selector (less reliable but always works)
    const nthSelector = this.buildNthChildSelector(element);
    selectors.push({
      type: 'css-nth',
      selector: nthSelector,
      playwright: `locator('${this.escapeString(nthSelector)}')`,
      confidence: this.selectorPriority['css-nth'],
      description: `CSS (nth): ${nthSelector}`
    });
  }

  addXPathSelector(element, selectors) {
    const xpath = this.buildXPath(element);
    selectors.push({
      type: 'xpath',
      selector: xpath,
      playwright: `locator('xpath=${xpath}')`,
      confidence: this.selectorPriority['xpath'],
      description: `XPath: ${xpath}`
    });
  }

  /**
   * Rank selectors by reliability and uniqueness
   */
  rankSelectors(selectors, element) {
    // Test uniqueness of each selector
    for (const sel of selectors) {
      if (sel.selector) {
        try {
          const matches = document.querySelectorAll(sel.selector);
          sel.uniqueMatch = matches.length === 1 && matches[0] === element;
          sel.matchCount = matches.length;
        } catch (e) {
          sel.uniqueMatch = false;
          sel.matchCount = 0;
        }
      } else {
        // For Playwright-specific selectors, assume they work
        sel.uniqueMatch = true;
        sel.matchCount = 1;
      }

      // Adjust confidence based on uniqueness
      if (!sel.uniqueMatch) {
        sel.confidence *= 0.5;
      }
    }

    // Sort by confidence (descending)
    selectors.sort((a, b) => b.confidence - a.confidence);

    return selectors;
  }

  /**
   * Get the best selector for Playwright
   */
  getBestSelector(element) {
    const selectors = this.generateSelectors(element);
    const best = selectors.find(s => s.uniqueMatch) || selectors[0];
    
    return {
      primary: best,
      fallbacks: selectors.slice(1, 4).filter(s => s.uniqueMatch),
      all: selectors
    };
  }

  // Helper methods
  escapeSelector(str) {
    return str.replace(/["\\]/g, '\\$&');
  }

  escapeString(str) {
    return str.replace(/['\\]/g, '\\$&');
  }

  isDynamicId(id) {
    // Detect common patterns for dynamic IDs
    const dynamicPatterns = [
      /^[a-f0-9]{8,}$/i,           // Hex strings
      /^\d{6,}$/,                   // Long numbers
      /^:r[0-9a-z]+:$/,            // React IDs
      /_[a-z0-9]{6,}$/i,           // Suffix patterns
      /^ember\d+$/,                 // Ember IDs
      /^ng-/,                       // Angular IDs
      /^vue-/,                      // Vue IDs
      /-\d{10,}$/,                  // Timestamp suffixes
    ];
    
    return dynamicPatterns.some(pattern => pattern.test(id));
  }

  getVisibleText(element) {
    // Get text content, excluding hidden elements
    const text = element.textContent || '';
    return text.trim().replace(/\s+/g, ' ');
  }

  getAccessibleName(element) {
    // Try various sources for accessible name
    return element.getAttribute('aria-label') ||
           element.getAttribute('title') ||
           this.getVisibleText(element);
  }

  getImplicitRole(element) {
    const roleMap = {
      'button': 'button',
      'a': 'link',
      'input': this.getInputRole(element),
      'select': 'combobox',
      'textarea': 'textbox',
      'img': 'img',
      'nav': 'navigation',
      'main': 'main',
      'header': 'banner',
      'footer': 'contentinfo',
      'form': 'form',
      'table': 'table',
      'ul': 'list',
      'ol': 'list',
      'li': 'listitem',
    };
    return roleMap[element.tagName.toLowerCase()];
  }

  getInputRole(element) {
    const type = element.getAttribute('type') || 'text';
    const roleMap = {
      'button': 'button',
      'submit': 'button',
      'reset': 'button',
      'checkbox': 'checkbox',
      'radio': 'radio',
      'range': 'slider',
      'search': 'searchbox',
    };
    return roleMap[type] || 'textbox';
  }

  buildStableCssSelector(element) {
    const tagName = element.tagName.toLowerCase();
    const classes = Array.from(element.classList)
      .filter(c => !this.isDynamicClass(c))
      .slice(0, 3);
    
    if (classes.length === 0) return null;

    const selector = `${tagName}.${classes.join('.')}`;
    
    // Verify it's unique enough
    try {
      const matches = document.querySelectorAll(selector);
      if (matches.length <= 3) {
        return selector;
      }
    } catch (e) {
      return null;
    }
    
    return null;
  }

  isDynamicClass(className) {
    const dynamicPatterns = [
      /^[a-z]{1,3}[A-Z][a-zA-Z0-9]{5,}$/,  // CSS modules
      /^css-[a-z0-9]+$/i,                    // Emotion
      /^sc-[a-z]+$/i,                        // Styled components
      /^_[a-z0-9]{5,}$/i,                    // Various CSS-in-JS
      /^svelte-[a-z0-9]+$/i,                 // Svelte
    ];
    return dynamicPatterns.some(p => p.test(className));
  }

  buildNthChildSelector(element) {
    const path = [];
    let current = element;
    
    while (current && current !== document.body) {
      const tagName = current.tagName.toLowerCase();
      const parent = current.parentElement;
      
      if (parent) {
        const siblings = Array.from(parent.children).filter(
          c => c.tagName.toLowerCase() === tagName
        );
        
        if (siblings.length > 1) {
          const index = siblings.indexOf(current) + 1;
          path.unshift(`${tagName}:nth-of-type(${index})`);
        } else {
          path.unshift(tagName);
        }
      } else {
        path.unshift(tagName);
      }
      
      current = parent;
      
      // Limit depth to keep selector manageable
      if (path.length >= 5) break;
    }
    
    return path.join(' > ');
  }

  buildXPath(element) {
    const parts = [];
    let current = element;
    
    while (current && current.nodeType === Node.ELEMENT_NODE) {
      let index = 1;
      let sibling = current.previousSibling;
      
      while (sibling) {
        if (sibling.nodeType === Node.ELEMENT_NODE && 
            sibling.tagName === current.tagName) {
          index++;
        }
        sibling = sibling.previousSibling;
      }
      
      const tagName = current.tagName.toLowerCase();
      parts.unshift(`${tagName}[${index}]`);
      current = current.parentNode;
      
      if (current === document.body) {
        parts.unshift('body');
        break;
      }
      
      if (parts.length >= 6) break;
    }
    
    return '//' + parts.join('/');
  }
}

// Export for use in content script
if (typeof window !== 'undefined') {
  window.SmartSelector = SmartSelector;
}
