/**
 * Element Picker - Visual element selection for fixing failed steps
 * 
 * Allows users to click on any element in the browser to:
 * 1. Highlight elements on hover
 * 2. Capture element info on click
 * 3. Generate multiple selector strategies
 * 4. Test selectors before saving
 * 
 * @author Flowstral
 * @version 1.0.0
 */

const { ElementRecipe } = require('./element-recipe');

/**
 * Element Picker class - manages the picker overlay and element capture
 */
class ElementPicker {
  constructor(page) {
    this.page = page;
    this.active = false;
    this.pickedElement = null;
    this.onElementPicked = null;
  }

  /**
   * Start element picker mode
   * Injects overlay and event listeners into the page
   */
  async start(callback) {
    if (!this.page || this.page.isClosed()) {
      throw new Error('No browser page available');
    }

    this.active = true;
    this.onElementPicked = callback;

    // Inject the picker script
    await this.page.evaluate(() => {
      // Remove any existing picker
      if (window.__flowstralPicker) {
        window.__flowstralPicker.cleanup();
      }

      window.__flowstralPicker = {
        active: true,
        hoveredElement: null,
        highlightOverlay: null,
        infoPanel: null,

        // Create highlight overlay
        createHighlight: function() {
          const overlay = document.createElement('div');
          overlay.id = '__flowstral-picker-highlight';
          overlay.style.cssText = `
            position: fixed;
            pointer-events: none;
            z-index: 2147483646;
            border: 2px solid #3b82f6;
            background: rgba(59, 130, 246, 0.15);
            border-radius: 4px;
            transition: all 0.1s ease;
            box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.3);
          `;
          document.body.appendChild(overlay);
          return overlay;
        },

        // Create info panel (shows element info on hover)
        createInfoPanel: function() {
          const panel = document.createElement('div');
          panel.id = '__flowstral-picker-info';
          panel.style.cssText = `
            position: fixed;
            bottom: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
            color: #e2e8f0;
            padding: 12px 20px;
            border-radius: 12px;
            font-family: system-ui, -apple-system, sans-serif;
            font-size: 13px;
            z-index: 2147483647;
            box-shadow: 0 8px 32px rgba(0,0,0,0.4), 0 0 0 1px rgba(59, 130, 246, 0.3);
            max-width: 500px;
            text-align: center;
          `;
          panel.innerHTML = '🎯 <strong>Click any element</strong> to select it • <kbd style="background:#374151;padding:2px 6px;border-radius:4px;font-size:11px">ESC</kbd> to cancel';
          document.body.appendChild(panel);
          return panel;
        },

        // Get element info
        getElementInfo: function(element) {
          if (!element) return null;

          const rect = element.getBoundingClientRect();
          const computedStyle = window.getComputedStyle(element);
          
          // Get all attributes
          const attributes = {};
          for (const attr of element.attributes) {
            attributes[attr.name] = attr.value;
          }

          // Get text content (cleaned)
          let text = '';
          if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
            text = element.value || element.placeholder || '';
          } else {
            text = element.innerText?.trim().substring(0, 100) || '';
          }

          // Generate multiple selectors
          const selectors = this.generateSelectors(element);

          return {
            tag: element.tagName.toLowerCase(),
            id: element.id || null,
            className: element.className || null,
            text: text,
            attributes: attributes,
            role: element.getAttribute('role') || this.inferRole(element),
            ariaLabel: element.getAttribute('aria-label'),
            dataTestId: element.getAttribute('data-testid') || element.getAttribute('data-test-id'),
            name: element.getAttribute('name'),
            type: element.getAttribute('type'),
            href: element.getAttribute('href'),
            placeholder: element.getAttribute('placeholder'),
            boundingBox: {
              x: rect.x,
              y: rect.y,
              width: rect.width,
              height: rect.height
            },
            isVisible: computedStyle.display !== 'none' && computedStyle.visibility !== 'hidden',
            selectors: selectors,
            outerHTML: element.outerHTML.substring(0, 500)
          };
        },

        // Infer role from element
        inferRole: function(element) {
          const tag = element.tagName.toLowerCase();
          const type = element.getAttribute('type');
          
          const roleMap = {
            'button': 'button',
            'a': 'link',
            'input': type === 'checkbox' ? 'checkbox' : type === 'radio' ? 'radio' : 'textbox',
            'select': 'combobox',
            'textarea': 'textbox',
            'nav': 'navigation',
            'main': 'main',
            'header': 'banner',
            'footer': 'contentinfo',
            'form': 'form',
            'table': 'table',
            'img': 'img'
          };
          
          return roleMap[tag] || null;
        },

        // Generate multiple selector strategies
        generateSelectors: function(element) {
          const selectors = [];
          const tag = element.tagName.toLowerCase();

          // 1. data-testid (highest reliability)
          const testId = element.getAttribute('data-testid') || element.getAttribute('data-test-id');
          if (testId) {
            selectors.push({
              type: 'data-testid',
              selector: `[data-testid="${testId}"]`,
              reliability: 5,
              description: 'Test ID (most stable)'
            });
          }

          // 2. ID (if not dynamic)
          if (element.id && !this.isDynamicId(element.id)) {
            selectors.push({
              type: 'id',
              selector: `#${element.id}`,
              reliability: 4,
              description: 'Element ID'
            });
          }

          // 3. Name attribute
          const name = element.getAttribute('name');
          if (name) {
            selectors.push({
              type: 'name',
              selector: `${tag}[name="${name}"]`,
              reliability: 4,
              description: 'Name attribute'
            });
          }

          // 4. aria-label
          const ariaLabel = element.getAttribute('aria-label');
          if (ariaLabel) {
            selectors.push({
              type: 'aria-label',
              selector: `[aria-label="${ariaLabel}"]`,
              reliability: 4,
              description: 'ARIA label'
            });
          }

          // 5. Role + text combination
          const role = element.getAttribute('role') || this.inferRole(element);
          const text = element.innerText?.trim().substring(0, 50);
          if (role && text) {
            selectors.push({
              type: 'role-text',
              selector: `getByRole('${role}', { name: '${text.replace(/'/g, "\\'")}' })`,
              reliability: 3,
              description: `${role} with text "${text.substring(0, 20)}..."`
            });
          }

          // 6. Text content
          if (text && text.length > 0 && text.length < 50) {
            selectors.push({
              type: 'text',
              selector: `text="${text}"`,
              reliability: 3,
              description: 'Visible text'
            });
          }

          // 7. CSS class combination (if unique-ish)
          if (element.className && typeof element.className === 'string') {
            const classes = element.className.split(' ').filter(c => c && !this.isDynamicClass(c)).slice(0, 3);
            if (classes.length > 0) {
              selectors.push({
                type: 'css-class',
                selector: `${tag}.${classes.join('.')}`,
                reliability: 2,
                description: 'CSS classes'
              });
            }
          }

          // 8. Unique CSS path (as fallback)
          const cssPath = this.getCssPath(element);
          if (cssPath) {
            selectors.push({
              type: 'css-path',
              selector: cssPath,
              reliability: 1,
              description: 'CSS path (least stable)'
            });
          }

          // Sort by reliability
          return selectors.sort((a, b) => b.reliability - a.reliability);
        },

        // Check if ID looks dynamic
        isDynamicId: function(id) {
          return /[0-9a-f]{8,}|_\d+$|\d{6,}|uuid|guid/i.test(id);
        },

        // Check if class looks dynamic
        isDynamicClass: function(className) {
          return /^[a-z]{1,3}[0-9a-f]{4,}|__\w+|css-\w+/i.test(className);
        },

        // Get CSS path to element
        getCssPath: function(element) {
          const path = [];
          let current = element;
          
          while (current && current !== document.body && path.length < 5) {
            let selector = current.tagName.toLowerCase();
            
            if (current.id && !this.isDynamicId(current.id)) {
              path.unshift(`#${current.id}`);
              break;
            }
            
            // Add nth-child if needed for disambiguation
            const parent = current.parentElement;
            if (parent) {
              const siblings = Array.from(parent.children).filter(c => c.tagName === current.tagName);
              if (siblings.length > 1) {
                const index = siblings.indexOf(current) + 1;
                selector += `:nth-child(${index})`;
              }
            }
            
            path.unshift(selector);
            current = current.parentElement;
          }
          
          return path.join(' > ');
        },

        // Handle mouse move
        handleMouseMove: function(e) {
          if (!this.active) return;
          
          // Don't highlight our own UI elements
          if (e.target.id?.startsWith('__flowstral-picker')) return;
          
          const rect = e.target.getBoundingClientRect();
          
          if (!this.highlightOverlay) {
            this.highlightOverlay = this.createHighlight();
          }
          
          this.highlightOverlay.style.left = rect.left + 'px';
          this.highlightOverlay.style.top = rect.top + 'px';
          this.highlightOverlay.style.width = rect.width + 'px';
          this.highlightOverlay.style.height = rect.height + 'px';
          
          this.hoveredElement = e.target;
        },

        // Handle click
        handleClick: function(e) {
          if (!this.active) return;
          
          // Don't capture clicks on our UI
          if (e.target.id?.startsWith('__flowstral-picker')) return;
          
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          
          const info = this.getElementInfo(e.target);
          
          // Send to Electron via console
          console.log('__FLOWSTRAL_ELEMENT_PICKED__:' + JSON.stringify(info));
          
          return false;
        },

        // Handle keydown (ESC to cancel)
        handleKeyDown: function(e) {
          if (e.key === 'Escape') {
            console.log('__FLOWSTRAL_PICKER_CANCELLED__');
          }
        },

        // Start picking
        start: function() {
          this.active = true;
          this.highlightOverlay = this.createHighlight();
          this.infoPanel = this.createInfoPanel();
          
          this._boundMouseMove = this.handleMouseMove.bind(this);
          this._boundClick = this.handleClick.bind(this);
          this._boundKeyDown = this.handleKeyDown.bind(this);
          
          document.addEventListener('mousemove', this._boundMouseMove, true);
          document.addEventListener('click', this._boundClick, true);
          document.addEventListener('keydown', this._boundKeyDown, true);
        },

        // Cleanup
        cleanup: function() {
          this.active = false;
          
          if (this.highlightOverlay) {
            this.highlightOverlay.remove();
            this.highlightOverlay = null;
          }
          
          if (this.infoPanel) {
            this.infoPanel.remove();
            this.infoPanel = null;
          }
          
          document.removeEventListener('mousemove', this._boundMouseMove, true);
          document.removeEventListener('click', this._boundClick, true);
          document.removeEventListener('keydown', this._boundKeyDown, true);
        }
      };

      // Start immediately
      window.__flowstralPicker.start();
    });

    console.log('[ElementPicker] Started element picker mode');
  }

  /**
   * Stop element picker mode
   */
  async stop() {
    if (!this.page || this.page.isClosed()) return;

    this.active = false;

    await this.page.evaluate(() => {
      if (window.__flowstralPicker) {
        window.__flowstralPicker.cleanup();
      }
    }).catch(() => {});

    console.log('[ElementPicker] Stopped element picker mode');
  }

  /**
   * Test a selector to see if it finds elements
   */
  async testSelector(selector) {
    if (!this.page || this.page.isClosed()) {
      return { success: false, error: 'No browser page' };
    }

    try {
      let count = 0;
      let isVisible = false;
      let elementInfo = null;

      // Handle different selector types
      if (selector.startsWith('getByRole')) {
        // Parse getByRole selector
        const match = selector.match(/getByRole\('(\w+)',\s*\{\s*name:\s*'(.+)'\s*\}\)/);
        if (match) {
          const [, role, name] = match;
          const locator = this.page.getByRole(role, { name: name.replace(/\\'/g, "'") });
          count = await locator.count();
          if (count > 0) {
            isVisible = await locator.first().isVisible().catch(() => false);
          }
        }
      } else if (selector.startsWith('text=')) {
        const text = selector.replace('text=', '').replace(/^"(.*)"$/, '$1');
        const locator = this.page.getByText(text, { exact: false });
        count = await locator.count();
        if (count > 0) {
          isVisible = await locator.first().isVisible().catch(() => false);
        }
      } else {
        // CSS selector
        const locator = this.page.locator(selector);
        count = await locator.count();
        if (count > 0) {
          isVisible = await locator.first().isVisible().catch(() => false);
          
          // Get element info
          elementInfo = await locator.first().evaluate(el => ({
            tag: el.tagName.toLowerCase(),
            text: el.innerText?.substring(0, 100),
            id: el.id,
            className: el.className
          })).catch(() => null);
        }
      }

      return {
        success: count > 0,
        count,
        isVisible,
        elementInfo,
        message: count > 0 
          ? `Found ${count} element(s)${isVisible ? ' (visible)' : ' (not visible)'}`
          : 'No elements found'
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        message: `Error: ${error.message}`
      };
    }
  }

  /**
   * Highlight an element by selector (for preview)
   */
  async highlightElement(selector, duration = 2000) {
    if (!this.page || this.page.isClosed()) return;

    try {
      await this.page.evaluate(({ selector, duration }) => {
        const highlight = document.createElement('div');
        highlight.style.cssText = `
          position: fixed;
          pointer-events: none;
          z-index: 2147483646;
          border: 3px solid #22c55e;
          background: rgba(34, 197, 94, 0.2);
          border-radius: 4px;
          transition: opacity 0.3s;
        `;

        let element;
        if (selector.startsWith('text=')) {
          const text = selector.replace('text=', '').replace(/^"(.*)"$/, '$1');
          element = Array.from(document.body.querySelectorAll('*')).find(el => 
            el.innerText?.includes(text)
          );
        } else {
          element = document.querySelector(selector);
        }

        if (element) {
          const rect = element.getBoundingClientRect();
          highlight.style.left = rect.left + 'px';
          highlight.style.top = rect.top + 'px';
          highlight.style.width = rect.width + 'px';
          highlight.style.height = rect.height + 'px';
          document.body.appendChild(highlight);

          // Scroll into view
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });

          setTimeout(() => {
            highlight.style.opacity = '0';
            setTimeout(() => highlight.remove(), 300);
          }, duration);
        }
      }, { selector, duration });
    } catch (e) {
      console.error('[ElementPicker] Failed to highlight:', e.message);
    }
  }
}

module.exports = { ElementPicker };
