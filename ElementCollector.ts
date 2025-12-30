/**
 * Flowstral - Element Collector
 * Browser-side script for collecting rich element metadata
 */

import {
  RecordedElement,
  ShadowPathSegment,
  BoundingRect,
  ParentElementInfo,
  SiblingInfo,
  LabelInfo,
} from '../types';

/**
 * Element Collector - Injects into page to collect element data
 */
export class ElementCollector {
  /**
   * Get injection script for browser execution
   */
  static getInjectionScript(): string {
    return `
(function() {
  window.__flowstralCollector = {
    
    /**
     * Collect comprehensive element data
     */
    collectElement: function(element) {
      if (!element || !(element instanceof Element)) {
        return null;
      }

      const data = {
        tagName: element.tagName,
        id: element.id || undefined,
        className: element.className || undefined,
        name: element.getAttribute('name') || undefined,
        type: element.getAttribute('type') || undefined,
        text: this.getVisibleText(element),
        placeholder: element.getAttribute('placeholder') || undefined,
        ariaLabel: element.getAttribute('aria-label') || undefined,
        ariaLabelledBy: element.getAttribute('aria-labelledby') || undefined,
        ariaDescribedBy: element.getAttribute('aria-describedby') || undefined,
        role: element.getAttribute('role') || this.getImplicitRole(element),
        dataAttributes: this.collectDataAttributes(element),
        customAttributes: this.collectCustomAttributes(element),
        xpath: this.getXPath(element),
        cssSelector: this.getCssSelector(element),
        shadowPath: this.getShadowPath(element),
        boundingRect: this.getBoundingRect(element),
        isVisible: this.isElementVisible(element),
        isEnabled: !element.disabled,
        parentInfo: this.getParentInfo(element),
        siblings: this.getSiblingInfo(element),
        nearbyLabels: this.findNearbyLabels(element),
        framePath: this.getFramePath(element),
        timestamp: Date.now()
      };

      return data;
    },

    /**
     * Get visible text content
     */
    getVisibleText: function(element) {
      // Get direct text content, not including children
      let text = '';
      
      // For inputs, get value
      if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
        return element.value || element.placeholder || '';
      }
      
      // For select, get selected option text
      if (element.tagName === 'SELECT') {
        return element.options[element.selectedIndex]?.text || '';
      }
      
      // Get text content
      const clone = element.cloneNode(true);
      const scripts = clone.querySelectorAll('script, style');
      scripts.forEach(s => s.remove());
      text = clone.textContent || '';
      
      // Normalize whitespace
      text = text.replace(/\\s+/g, ' ').trim();
      
      // Limit length
      return text.substring(0, 200);
    },

    /**
     * Get implicit ARIA role
     */
    getImplicitRole: function(element) {
      const tagRoles = {
        'A': element.hasAttribute('href') ? 'link' : null,
        'ARTICLE': 'article',
        'ASIDE': 'complementary',
        'BUTTON': 'button',
        'DATALIST': 'listbox',
        'DD': 'definition',
        'DETAILS': 'group',
        'DIALOG': 'dialog',
        'DT': 'term',
        'FIELDSET': 'group',
        'FIGURE': 'figure',
        'FOOTER': 'contentinfo',
        'FORM': 'form',
        'H1': 'heading',
        'H2': 'heading',
        'H3': 'heading',
        'H4': 'heading',
        'H5': 'heading',
        'H6': 'heading',
        'HEADER': 'banner',
        'HR': 'separator',
        'IMG': 'img',
        'INPUT': this.getInputRole(element),
        'LI': 'listitem',
        'MAIN': 'main',
        'MENU': 'menu',
        'NAV': 'navigation',
        'OL': 'list',
        'OPTGROUP': 'group',
        'OPTION': 'option',
        'OUTPUT': 'status',
        'PROGRESS': 'progressbar',
        'SECTION': 'region',
        'SELECT': element.hasAttribute('multiple') ? 'listbox' : 'combobox',
        'TABLE': 'table',
        'TBODY': 'rowgroup',
        'TD': 'cell',
        'TEXTAREA': 'textbox',
        'TFOOT': 'rowgroup',
        'TH': 'columnheader',
        'THEAD': 'rowgroup',
        'TR': 'row',
        'UL': 'list'
      };
      
      return tagRoles[element.tagName] || null;
    },

    /**
     * Get input role based on type
     */
    getInputRole: function(element) {
      if (element.tagName !== 'INPUT') return null;
      
      const typeRoles = {
        'button': 'button',
        'checkbox': 'checkbox',
        'email': 'textbox',
        'image': 'button',
        'number': 'spinbutton',
        'password': 'textbox',
        'radio': 'radio',
        'range': 'slider',
        'reset': 'button',
        'search': 'searchbox',
        'submit': 'button',
        'tel': 'textbox',
        'text': 'textbox',
        'url': 'textbox'
      };
      
      const type = element.type || 'text';
      return typeRoles[type] || 'textbox';
    },

    /**
     * Collect all data-* attributes
     */
    collectDataAttributes: function(element) {
      const attrs = {};
      
      for (const attr of element.attributes) {
        if (attr.name.startsWith('data-')) {
          attrs[attr.name] = attr.value;
        }
      }
      
      return attrs;
    },

    /**
     * Collect application-specific custom attributes
     */
    collectCustomAttributes: function(element) {
      const attrs = {};
      const customPatterns = [
        /^ng-/,      // Angular
        /^v-/,       // Vue
        /^:?\\[/,    // React binding
        /^x-/,       // Alpine.js
        /^wire:/,    // Livewire
        /^hx-/,      // HTMX
        /^aria-/,    // ARIA (for completeness)
        // Enterprise app patterns
        /^aura-/,
        /^lightning-/,
        /^sap-/,
        /^wd-/,
        /^now-/,
        /^sn-/,
        /^pega-/,
        /^af:/,
        /^awname/
      ];
      
      for (const attr of element.attributes) {
        if (customPatterns.some(p => p.test(attr.name))) {
          attrs[attr.name] = attr.value;
        }
      }
      
      return attrs;
    },

    /**
     * Get robust XPath
     */
    getXPath: function(element) {
      if (element.id && !this.isDynamicId(element.id)) {
        return '//*[@id="' + element.id + '"]';
      }
      
      const parts = [];
      let current = element;
      
      while (current && current.nodeType === Node.ELEMENT_NODE) {
        let index = 0;
        let sibling = current.previousSibling;
        
        while (sibling) {
          if (sibling.nodeType === Node.ELEMENT_NODE && 
              sibling.tagName === current.tagName) {
            index++;
          }
          sibling = sibling.previousSibling;
        }
        
        const tagName = current.tagName.toLowerCase();
        const indexStr = index > 0 ? '[' + (index + 1) + ']' : '';
        parts.unshift(tagName + indexStr);
        
        current = current.parentElement;
      }
      
      return '/' + parts.join('/');
    },

    /**
     * Check if ID is dynamic
     */
    isDynamicId: function(id) {
      const patterns = [
        /^[a-f0-9]{8}-[a-f0-9]{4}-/i,  // UUID
        /^\\d+$/,                        // Pure numbers
        /_\\d+$/,                        // Ending with underscore + numbers
        /^ember\\d+/,                    // Ember.js
        /^__[a-z]+\\d+-/,               // SAP UI5
        /^j_id\\d+/,                    // JSF
        /^:0:/,                          // Oracle ADF
        /^gwt-uid-/                     // GWT
      ];
      
      return patterns.some(p => p.test(id));
    },

    /**
     * Get CSS selector
     */
    getCssSelector: function(element) {
      if (element.id && !this.isDynamicId(element.id)) {
        return '#' + CSS.escape(element.id);
      }
      
      const parts = [];
      let current = element;
      
      while (current && current.nodeType === Node.ELEMENT_NODE && current !== document.body) {
        let selector = current.tagName.toLowerCase();
        
        // Add stable classes
        if (current.className) {
          const classes = Array.from(current.classList)
            .filter(c => !this.isDynamicClass(c))
            .slice(0, 2);
          if (classes.length > 0) {
            selector += '.' + classes.map(c => CSS.escape(c)).join('.');
          }
        }
        
        // Add index if needed
        if (current.parentElement) {
          const siblings = Array.from(current.parentElement.children)
            .filter(c => c.tagName === current.tagName);
          if (siblings.length > 1) {
            const index = siblings.indexOf(current) + 1;
            selector += ':nth-of-type(' + index + ')';
          }
        }
        
        parts.unshift(selector);
        current = current.parentElement;
      }
      
      return parts.join(' > ');
    },

    /**
     * Check if class is dynamic
     */
    isDynamicClass: function(className) {
      const patterns = [
        /^[a-z]{1,3}\\d{4,}/i,  // Short prefix + many numbers
        /_[a-f0-9]{6,}/i,        // Hashed classes
        /^css-/,                  // CSS-in-JS
        /^sc-/,                   // Styled components
        /^emotion-/,             // Emotion
        /--\\d+$/                 // BEM with numbers
      ];
      
      return patterns.some(p => p.test(className));
    },

    /**
     * Get shadow DOM path
     */
    getShadowPath: function(element) {
      const path = [];
      let current = element;
      let depth = 0;
      
      while (current) {
        const root = current.getRootNode();
        
        if (root instanceof ShadowRoot) {
          const host = root.host;
          const hostSelector = this.getSimpleSelector(host);
          const shadowSelector = this.getSimpleSelector(current);
          
          path.unshift({
            hostSelector: hostSelector,
            shadowSelector: shadowSelector,
            depth: depth
          });
          
          current = host;
          depth++;
        } else {
          break;
        }
      }
      
      return path.length > 0 ? path : undefined;
    },

    /**
     * Get simple selector for an element
     */
    getSimpleSelector: function(element) {
      if (element.id && !this.isDynamicId(element.id)) {
        return '#' + element.id;
      }
      
      let selector = element.tagName.toLowerCase();
      
      // Add stable data attributes
      const stableAttrs = ['data-testid', 'data-automation-id', 'data-test-id', 'name'];
      for (const attr of stableAttrs) {
        const value = element.getAttribute(attr);
        if (value) {
          selector += '[' + attr + '="' + value + '"]';
          break;
        }
      }
      
      return selector;
    },

    /**
     * Get bounding rectangle
     */
    getBoundingRect: function(element) {
      const rect = element.getBoundingClientRect();
      return {
        x: Math.round(rect.x),
        y: Math.round(rect.y),
        width: Math.round(rect.width),
        height: Math.round(rect.height)
      };
    },

    /**
     * Check if element is visible
     */
    isElementVisible: function(element) {
      const style = window.getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      
      return style.display !== 'none' &&
             style.visibility !== 'hidden' &&
             style.opacity !== '0' &&
             rect.width > 0 &&
             rect.height > 0;
    },

    /**
     * Get parent element info
     */
    getParentInfo: function(element) {
      const parent = element.parentElement;
      if (!parent || parent === document.body) {
        return undefined;
      }
      
      return {
        tagName: parent.tagName,
        id: parent.id || undefined,
        className: parent.className || undefined,
        role: parent.getAttribute('role') || undefined,
        level: 1
      };
    },

    /**
     * Get sibling information
     */
    getSiblingInfo: function(element) {
      const siblings = [];
      const parent = element.parentElement;
      
      if (!parent) return siblings;
      
      const children = Array.from(parent.children);
      const index = children.indexOf(element);
      
      // Get siblings before
      for (let i = Math.max(0, index - 3); i < index; i++) {
        const sib = children[i];
        siblings.push({
          position: 'before',
          tagName: sib.tagName,
          text: this.getVisibleText(sib).substring(0, 50),
          index: i
        });
      }
      
      // Get siblings after
      for (let i = index + 1; i < Math.min(children.length, index + 4); i++) {
        const sib = children[i];
        siblings.push({
          position: 'after',
          tagName: sib.tagName,
          text: this.getVisibleText(sib).substring(0, 50),
          index: i
        });
      }
      
      return siblings;
    },

    /**
     * Find nearby labels
     */
    findNearbyLabels: function(element) {
      const labels = [];
      const rect = element.getBoundingClientRect();
      
      // Check for associated label
      if (element.id) {
        const label = document.querySelector('label[for="' + element.id + '"]');
        if (label) {
          labels.push({
            text: label.textContent.trim(),
            position: 'left',
            distance: 0,
            forAttribute: element.id
          });
        }
      }
      
      // Check for wrapping label
      const wrappingLabel = element.closest('label');
      if (wrappingLabel) {
        const labelText = wrappingLabel.textContent.replace(element.textContent || '', '').trim();
        if (labelText) {
          labels.push({
            text: labelText,
            position: 'left',
            distance: 0
          });
        }
      }
      
      // Find nearby text elements
      const allLabels = document.querySelectorAll('label, .label, [class*="label"], legend, th');
      
      for (const label of allLabels) {
        if (labels.length >= 5) break;
        
        const labelRect = label.getBoundingClientRect();
        const distance = Math.sqrt(
          Math.pow(labelRect.x - rect.x, 2) + 
          Math.pow(labelRect.y - rect.y, 2)
        );
        
        if (distance < 200 && distance > 0) {
          let position;
          if (labelRect.right < rect.left) position = 'left';
          else if (labelRect.left > rect.right) position = 'right';
          else if (labelRect.bottom < rect.top) position = 'above';
          else position = 'below';
          
          labels.push({
            text: label.textContent.trim().substring(0, 100),
            position: position,
            distance: Math.round(distance)
          });
        }
      }
      
      return labels.sort((a, b) => a.distance - b.distance).slice(0, 5);
    },

    /**
     * Get frame path for element in iframe
     */
    getFramePath: function(element) {
      const path = [];
      let currentWindow = element.ownerDocument.defaultView;
      
      while (currentWindow && currentWindow !== window.top) {
        try {
          const frame = currentWindow.frameElement;
          if (frame) {
            const identifier = frame.id || frame.name || 
              frame.getAttribute('src') || 'iframe';
            path.unshift(identifier);
          }
        } catch (e) {
          // Cross-origin frame
          path.unshift('cross-origin');
        }
        currentWindow = currentWindow.parent;
      }
      
      return path.length > 0 ? path : undefined;
    }
  };
  
  // Return collector interface
  return window.__flowstralCollector;
})();
`;
  }

  /**
   * Collect element at point
   */
  static getCollectAtPointScript(x: number, y: number): string {
    return `
(function() {
  const element = document.elementFromPoint(${x}, ${y});
  if (element && window.__flowstralCollector) {
    return window.__flowstralCollector.collectElement(element);
  }
  return null;
})();
`;
  }

  /**
   * Collect element by selector
   */
  static getCollectBySelectorScript(selector: string): string {
    return `
(function() {
  const element = document.querySelector('${selector.replace(/'/g, "\\'")}');
  if (element && window.__flowstralCollector) {
    return window.__flowstralCollector.collectElement(element);
  }
  return null;
})();
`;
  }
}

/**
 * Shadow DOM Walker - Traverses shadow DOM boundaries
 */
export class ShadowDOMWalker {
  static getWalkerScript(): string {
    return `
(function() {
  window.__shadowWalker = {
    /**
     * Find element across shadow boundaries
     */
    findElement: function(root, selector) {
      // Try direct query first
      let element = root.querySelector(selector);
      if (element) return element;
      
      // Walk shadow trees
      const walker = document.createTreeWalker(
        root,
        NodeFilter.SHOW_ELEMENT,
        null,
        false
      );
      
      let node;
      while (node = walker.nextNode()) {
        if (node.shadowRoot) {
          element = this.findElement(node.shadowRoot, selector);
          if (element) return element;
        }
      }
      
      return null;
    },
    
    /**
     * Get all shadow hosts
     */
    getShadowHosts: function(root) {
      const hosts = [];
      const walker = document.createTreeWalker(
        root || document,
        NodeFilter.SHOW_ELEMENT,
        null,
        false
      );
      
      let node;
      while (node = walker.nextNode()) {
        if (node.shadowRoot) {
          hosts.push({
            tagName: node.tagName,
            selector: this.getSelector(node),
            childCount: node.shadowRoot.childElementCount
          });
        }
      }
      
      return hosts;
    },
    
    /**
     * Get selector for shadow host
     */
    getSelector: function(element) {
      if (element.id) return '#' + element.id;
      
      let selector = element.tagName.toLowerCase();
      const attrs = ['data-testid', 'data-automation-id', 'name'];
      
      for (const attr of attrs) {
        const value = element.getAttribute(attr);
        if (value) {
          return selector + '[' + attr + '="' + value + '"]';
        }
      }
      
      return selector;
    }
  };
  
  return window.__shadowWalker;
})();
`;
  }
}
