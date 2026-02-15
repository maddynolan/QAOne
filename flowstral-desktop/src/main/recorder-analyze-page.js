/**
 * Extracted analyzePage method from PlaywrightRecorder
 *
 * Analyzes the current page and returns structured suggestions about
 * interactive elements (buttons, inputs, links, etc.) with Shadow DOM support.
 *
 * @param {PlaywrightRecorder} recorder - The recorder instance (replaces `this`)
 * @returns {Promise<{success: boolean, suggestions: Array, counts: Object, error?: string}>}
 */
async function analyzePage(recorder) {
    if (!recorder.page || recorder.page.isClosed()) {
      return { success: false, suggestions: [], error: 'No browser page' };
    }

    try {
      const suggestions = await recorder.page.evaluate(() => {
        const results = [];
        const seen = new Set();
        const seenLabels = new Map(); // Track labels to detect duplicates
        const labelCounts = new Map(); // Count total occurrences of each label

        // ======== COMPREHENSIVE SHADOW DOM QUERY (Industry Standard Approach) ========
        // Based on: Autify, Katalon, Playwright's native Shadow DOM piercing
        // This implementation mirrors what commercial tools do internally

        /**
         * Deep query selector that automatically pierces ALL Shadow DOM boundaries
         * Similar to Playwright's native shadow-piercing and query-selector-shadow-dom npm package
         * Works recursively through unlimited nesting depth
         */
        function deepQueryAll(selector) {
          const found = [];
          const visitedRoots = new WeakSet();

          function traverse(root) {
            if (visitedRoots.has(root)) return;
            visitedRoots.add(root);

            try {
              // Query in current root
              const elements = root.querySelectorAll(selector);
              elements.forEach(el => {
                if (!seen.has(el)) found.push(el);
              });
            } catch(e) {}

            // COMPREHENSIVE: Search ALL shadow roots at all depths
            const allElements = root.querySelectorAll ? root.querySelectorAll('*') : [];
            allElements.forEach(el => {
              // Check open shadow roots
              if (el.shadowRoot) {
                traverse(el.shadowRoot);
              }
              // Also check for closed shadow roots via special properties (some frameworks expose these)
              if (el._shadowRoot) {
                traverse(el._shadowRoot);
              }
            });

            // Also check slots for distributed content
            const slots = root.querySelectorAll ? root.querySelectorAll('slot') : [];
            slots.forEach(slot => {
              try {
                const assigned = slot.assignedElements ? slot.assignedElements({ flatten: true }) : [];
                assigned.forEach(el => {
                  if (!seen.has(el)) {
                    try {
                      if (el.matches && el.matches(selector)) {
                        found.push(el);
                      }
                    } catch(e) {}
                  }
                  // Recurse into assigned elements
              if (el.shadowRoot) traverse(el.shadowRoot);
                });
              } catch(e) {}
            });
          }

          // Start from document
          traverse(document);

          // Also search from document.body in case of detached trees
          if (document.body && !visitedRoots.has(document.body)) {
            traverse(document.body);
          }

          return found;
        }

        /**
         * Find a single element by ANY selector strategy, automatically piercing Shadow DOM
         * This is the key function that makes automation work like commercial tools
         */
        function deepQueryOne(selector) {
          const results = deepQueryAll(selector);
          return results.length > 0 ? results[0] : null;
        }

        /**
         * Query using a path of selectors, each segment piercing into the next shadow root
         * Example: "one-app-launcher-menu >>> lightning-input >>> input"
         * The >>> is the shadow-piercing combinator (like Playwright's >> but for shadow DOM)
         */
        function deepQueryPath(selectorPath) {
          const segments = selectorPath.split('>>>').map(s => s.trim());
          let currentRoots = [document];

          for (const segment of segments) {
            const nextRoots = [];
            for (const root of currentRoots) {
              try {
                const elements = root.querySelectorAll(segment);
                elements.forEach(el => {
                  // Add the element itself
                  nextRoots.push(el);
                  // If it has a shadow root, add that too for next iteration
                  if (el.shadowRoot) {
                    nextRoots.push(el.shadowRoot);
                  }
                });
              } catch(e) {}

              // Also search shadow root if current root has one
              if (root.shadowRoot) {
                try {
                  const shadowElements = root.shadowRoot.querySelectorAll(segment);
                  shadowElements.forEach(el => {
                    nextRoots.push(el);
                    if (el.shadowRoot) nextRoots.push(el.shadowRoot);
                  });
                } catch(e) {}
              }
            }
            currentRoots = nextRoots;
            if (currentRoots.length === 0) break;
          }

          // Return elements (not shadow roots)
          return currentRoots.filter(r => r.nodeType === 1);
        }

        /**
         * Get the shadow path to an element for debugging and selector generation
         */
        function getShadowPath(element) {
          const path = [];
          let current = element;

          while (current && current !== document.body) {
            const tag = (current.tagName || '').toLowerCase();
            const id = current.id;
            const className = (current.className || '').toString().split(' ')[0];

            let part = tag;
            if (id && !/^(lwc|aura)-/i.test(id)) part += '#' + id;
            else if (className && !/^(lwc|slds-)/i.test(className)) part += '.' + className;

            path.unshift(part);

            // Check if we're in a shadow root
            const root = current.getRootNode();
            if (root !== document && root.host) {
              path.unshift('>>>'); // Shadow boundary marker
              current = root.host;
            } else {
              current = current.parentElement;
            }
          }

          return path.join(' ');
        }

        // ======== VISIBILITY CHECK ========
        function isVisible(el) {
          if (!el) return false;
          try {
            // IMPORTANT: Skip elements inside the flowstral overlay
            // This prevents "Add to steps", "Execute action" etc from appearing
            if (isInsideFlowstralOverlay(el)) return false;

            const rect = el.getBoundingClientRect();
            if (rect.width === 0 || rect.height === 0) return false;
            // Check if in viewport
            if (rect.top > window.innerHeight * 2 || rect.bottom < -100) return false;
            const style = window.getComputedStyle(el);
            return style.display !== 'none' &&
                   style.visibility !== 'hidden' &&
                   parseFloat(style.opacity) > 0;
          } catch(e) {
            return false;
          }
        }

        // ======== CHECK IF ELEMENT IS INSIDE FLOWSTRAL OVERLAY ========
        function isInsideFlowstralOverlay(el) {
          if (!el) return false;
          try {
            // Check if element is inside our overlay by traversing up
            let current = el;
            while (current && current !== document.body && current !== document.documentElement) {
              // Check for overlay container ID or class
              if (current.id === 'flowstral-overlay-container' ||
                  current.id === 'flowstral-overlay' ||
                  (current.className && typeof current.className === 'string' &&
                   (current.className.includes('flowstral-overlay') ||
                    current.className.includes('fl-overlay') ||
                    current.className.includes('fl-panel')))) {
                return true;
              }
              // Check for shadow host with our overlay
              if (current.getRootNode() !== document) {
                const host = current.getRootNode().host;
                if (host && (host.id === 'flowstral-overlay-container' || host.id === 'flowstral-overlay')) {
                  return true;
                }
              }
              current = current.parentElement;
            }
            return false;
          } catch(e) {
            return false;
          }
        }

        // ======== GET VISIBLE TEXT (NO DUPLICATES) ========
        function getVisibleText(el) {
          try {
            const text = (el.textContent || el.innerText || '').trim();
            let normalized = text.replace(/\\s+/g, ' ');
            // Fix repeated words (common in React/LWC)
            const words = normalized.split(' ');
            if (words.length >= 2 && words[0] === words[1]) {
              normalized = words.slice(1).join(' ');
            }
            return normalized.length > 60 ? normalized.substring(0, 57) + '...' : normalized;
          } catch(e) {
            return '';
          }
        }

        // ======== GET BEST LABEL ========
        function getLabel(el) {
          // Priority: aria-label > title > placeholder > name > id > visible text
          const aria = el.getAttribute && el.getAttribute('aria-label');
          if (aria && aria.length > 0 && aria.length < 60) return aria.trim();

          const title = el.getAttribute && el.getAttribute('title');
          if (title && title.length > 0 && title.length < 60) return title.trim();

          const placeholder = el.getAttribute && el.getAttribute('placeholder');
          if (placeholder && placeholder.length > 0) return placeholder.trim();

          const name = el.name || el.getAttribute && el.getAttribute('name');
          if (name && name.length > 0) return name;

          if (el.id && el.id.length > 0 && !/^(lwc|aura)-/i.test(el.id) && !/^\\d+$/.test(el.id)) return el.id;

          const text = getVisibleText(el);
          if (text && text.length > 0) return text;

          return el.tagName ? el.tagName.toLowerCase() : 'element';
        }

        // ======== GET INPUT LABEL (ENHANCED FOR LIGHTNING) ========
        function getInputLabel(el) {
          // Check for associated label element
          if (el.id) {
            const label = document.querySelector('label[for="' + el.id.replace(/"/g, '\\\\"') + '"]');
            if (label) {
              const labelText = getVisibleText(label);
              if (labelText) return labelText;
            }
          }
          // Check parent label
          const parentLabel = el.closest('label');
          if (parentLabel) {
            const labelText = getVisibleText(parentLabel).replace(getVisibleText(el), '').trim();
            if (labelText.length > 0) return labelText;
          }
          // Lightning components - check multiple patterns
          const lwc = el.closest('lightning-input, lightning-combobox, lightning-textarea, lightning-select, lightning-datepicker, lightning-input-field, lightning-dual-listbox, lightning-radio-group, lightning-checkbox-group');
          if (lwc) {
            // Try multiple label selectors
            const labelSelectors = ['.slds-form-element__label', 'label', '.slds-radio__label', '.slds-checkbox__label', '[class*="label"]'];
            for (const sel of labelSelectors) {
              const lwcLabel = lwc.querySelector(sel);
              if (lwcLabel) {
                const text = getVisibleText(lwcLabel);
                if (text && text.length > 0) return text;
              }
            }
            // Try aria-label on the component itself
            const compAriaLabel = lwc.getAttribute('aria-label') || lwc.getAttribute('label');
            if (compAriaLabel) return compAriaLabel;
          }
          // ServiceNow / SAP patterns
          const sysDisplay = el.closest('[id^="sys_display"]');
          if (sysDisplay) {
            const fieldName = el.name || el.id;
            if (fieldName && fieldName.includes('.')) {
              return fieldName.split('.').pop().replace(/_/g, ' ');
            }
          }
          // Fallback
          return el.placeholder || el.getAttribute('aria-label') || el.name || el.id || 'input';
        }

        // ======== GENERATE BEST SELECTOR ========
        function getBestSelector(el) {
          // Uniqueness guard: only return a selector if it matches exactly 1 element.
          // This prevents issues like Flipkart where data-testid="test-input" is shared
          // across ALL inputs — without this check, Playwright picks the first match.
          function isUnique(sel) {
            try { return document.querySelectorAll(sel).length === 1; }
            catch(e) { return true; } // trust it if querySelectorAll fails (e.g. pseudo-selectors)
          }

          // Test ID - highest priority (but only if unique on the page)
          const testId = el.getAttribute && (el.getAttribute('data-testid') || el.getAttribute('data-test-id') || el.getAttribute('data-automation-id') || el.getAttribute('data-cy'));
          if (testId) {
            const sel = '[data-testid="' + testId + '"]';
            if (isUnique(sel)) return sel;
          }

          // Meaningful ID (not dynamic)
          if (el.id && !/^(lwc|aura)-/i.test(el.id) && !/^\\d+$/.test(el.id) && !/[0-9]{8,}/.test(el.id) && !el.id.includes(':')) {
            const sel = '#' + CSS.escape(el.id);
            if (isUnique(sel)) return sel;
          }

          // Name attribute
          const name = el.name || el.getAttribute && el.getAttribute('name');
          if (name) {
            const sel = '[name="' + name.replace(/"/g, '\\\\"') + '"]';
            if (isUnique(sel)) return sel;
          }

          // Aria label
          const aria = el.getAttribute && el.getAttribute('aria-label');
          if (aria) {
            const sel = '[aria-label="' + aria.replace(/"/g, '\\\\"') + '"]';
            if (isUnique(sel)) return sel;
          }

          // Title
          const title = el.getAttribute && el.getAttribute('title');
          if (title && title.length < 50) {
            const sel = '[title="' + title.replace(/"/g, '\\\\"') + '"]';
            if (isUnique(sel)) return sel;
          }

          // Placeholder
          const placeholder = el.getAttribute && el.getAttribute('placeholder');
          if (placeholder) {
            const sel = '[placeholder="' + placeholder.replace(/"/g, '\\\\"') + '"]';
            if (isUnique(sel)) return sel;
          }

          // Role + text for accessible elements
          const role = el.getAttribute && el.getAttribute('role');
          if (role === 'button' || role === 'link' || role === 'menuitem') {
            const text = getVisibleText(el);
            if (text && text.length < 40) return null; // Will use text-based approach
          }

          return null;
        }

        // First pass: count all labels to detect duplicates
        function countLabel(label, type) {
          const key = type + ':' + (label || '').toLowerCase();
          labelCounts.set(key, (labelCounts.get(key) || 0) + 1);
        }

        // Helper to add result with duplicate tracking (like extension)
        function addResult(item) {
          const key = item.type + ':' + (item.label || '').toLowerCase();
          const count = seenLabels.get(key) || 0;
          seenLabels.set(key, count + 1);

          // Get total duplicates for this label
          const totalDuplicates = labelCounts.get(key) || 1;

          // Add duplicate tracking info
          item.duplicateIndex = count;
          item.totalDuplicates = totalDuplicates;
          item.hasDuplicates = totalDuplicates > 1;

          results.push(item);
        }

        // Helper to determine element category (like extension)
        function getElementCategory(el, role) {
          const tagName = (el.tagName || '').toLowerCase();
          if (role === 'tab') return 'tab';
          if (role === 'menuitem' || role === 'menuitemcheckbox' || role === 'menuitemradio') return 'menuitem';
          if (role === 'option' || role === 'listbox') return 'option';
          if (role === 'button') return 'button';
          if (tagName === 'button' || tagName === 'input') return 'button';
          if (tagName === 'a') return 'link';
          if (tagName === 'div' || tagName === 'li' || tagName === 'article') return 'card';
          return 'button';
        }

        // Helper to get element location (header, footer, nav, etc.)
        function getElementLocation(el) {
          let current = el;
          while (current && current !== document.body) {
            const tag = (current.tagName || '').toLowerCase();
            const role = current.getAttribute && current.getAttribute('role');
            const className = (current.className || '').toString().toLowerCase();
            const id = (current.id || '').toLowerCase();

            if (tag === 'header' || role === 'banner' || className.includes('header') || id.includes('header')) return 'header';
            if (tag === 'footer' || role === 'contentinfo' || className.includes('footer')) return 'footer';
            if (tag === 'nav' || role === 'navigation' || className.includes('nav')) return 'nav';
            if (tag === 'aside' || role === 'complementary' || className.includes('sidebar')) return 'sidebar';
            if (tag === 'main' || role === 'main') return 'main';

            current = current.parentElement;
          }
          return 'body';
        }

        // ======== FIRST PASS: COUNT ALL LABELS FOR DUPLICATE DETECTION ========
        const buttonSelectors = 'button, [role="button"], input[type="submit"], input[type="button"], .slds-button, lightning-button, lightning-button-icon, .btn, [class*="button"]';
        const allButtons = deepQueryAll(buttonSelectors);
        allButtons.forEach(el => { if (isVisible(el)) countLabel(getLabel(el), 'click'); });

        const allClickables = deepQueryAll('[role="option"], [role="menuitem"], [role="tab"], [role="treeitem"], [tabindex="0"], [onclick]');
        allClickables.forEach(el => { if (isVisible(el)) countLabel(getLabel(el), 'click'); });

        const allLinks = deepQueryAll('a[href]');
        allLinks.forEach(el => { if (isVisible(el)) countLabel(getVisibleText(el), 'click'); });

        // ======== COLLECT SALESFORCE-SPECIFIC ELEMENTS FIRST ========
        // App Launcher (9-dots icon)
        const appLauncherSelectors = [
          'button[title="App Launcher"]',
          '[data-aura-class="forceModuleSwitcher"]',
          'one-app-launcher-header button',
          'div.appLauncher button',
          '.slds-icon-waffle'
        ];
        appLauncherSelectors.forEach(sel => {
          try {
            document.querySelectorAll(sel).forEach(el => {
              if (!isVisible(el) || seen.has(el)) return;
              seen.add(el);
              const title = el.getAttribute('title') || 'App Launcher';
              addResult({
                type: 'click',
                element: 'button',
                label: title,
                text: title,
                tagName: (el.tagName || '').toLowerCase(),
                selector: '[title="App Launcher"]',
                action: 'Click',
                description: 'Click App Launcher',
                location: 'header',
                sfCategory: 'appLauncher'
              });
            });
          } catch(e) {}
        });

        // Profile/User Menu
        const profileSelectors = [
          'button[class*="userProfile"]',
          '[data-aura-class="uiPopupTrigger"][class*="profileTrigger"]',
          'one-app-nav-bar-item-root[data-id="profile"]',
          '[data-id="userProfileMenu"]',
          'button[title*="View profile"]',
          '.profileTrigger'
        ];
        profileSelectors.forEach(sel => {
          try {
            document.querySelectorAll(sel).forEach(el => {
              if (!isVisible(el) || seen.has(el)) return;
              seen.add(el);
              const title = el.getAttribute('title') || el.getAttribute('aria-label') || 'User Profile Menu';
              addResult({
                type: 'click',
                element: 'button',
                label: title,
                text: title,
                tagName: (el.tagName || '').toLowerCase(),
                selector: getBestSelector(el),
                action: 'Click',
                description: 'Click "' + title + '"',
                location: 'header',
                sfCategory: 'profileMenu'
              });
            });
          } catch(e) {}
        });

        // Lightning Tabs (record details, related lists, etc.)
        const tabSelectors = [
          'lightning-tab',
          'a[role="tab"]',
          'li[role="presentation"] a',
          '.slds-tabs_default__item a',
          '[data-tab-name] a',
          'lightning-tabset a[role="tab"]'
        ];
        tabSelectors.forEach(sel => {
          try {
            document.querySelectorAll(sel).forEach(el => {
              if (!isVisible(el) || seen.has(el)) return;
              seen.add(el);
              const title = el.getAttribute('title') || el.getAttribute('aria-label') || el.textContent.trim();
              if (!title || title.length > 60) return;
              addResult({
                type: 'click',
                element: 'tab',
                label: title,
                text: title,
                tagName: (el.tagName || '').toLowerCase(),
                role: 'tab',
                selector: getBestSelector(el),
                action: 'Select Tab',
                description: 'Select Tab "' + title + '"',
                sfCategory: 'tab'
              });
            });
          } catch(e) {}
        });

        // ======== COLLECT BUTTONS ========
        allButtons.forEach(el => {
          if (!isVisible(el) || seen.has(el)) return;
          seen.add(el);

          const label = getLabel(el);
          if (!label || label.length < 1 || label.length > 80) return;

          const role = el.getAttribute && el.getAttribute('role');
          const element = getElementCategory(el, role);
          const location = getElementLocation(el);

          addResult({
            type: 'click',
            element: element,
            label: label,
            text: label,
            tagName: (el.tagName || '').toLowerCase(),
            role: role,
            selector: getBestSelector(el),
            action: 'Click',
            description: 'Click "' + label + '"',
            location: location,
            id: el.id || null
          });
        });

        // ======== COLLECT CLICKABLE ELEMENTS (menus, tabs, options) ========
        const clickableSelectors = '[role="option"], [role="menuitem"], [role="menuitemcheckbox"], [role="menuitemradio"], [role="tab"], [role="treeitem"], [role="gridcell"], [tabindex="0"], [onclick], [data-action], [class*="clickable"], [class*="selectable"]';
        const clickables = deepQueryAll(clickableSelectors);

        clickables.forEach(el => {
          if (!isVisible(el) || seen.has(el)) return;
          seen.add(el);

          const label = getLabel(el);
          if (!label || label.length < 1 || label.length > 80) return;

          const role = el.getAttribute && el.getAttribute('role');
          const element = getElementCategory(el, role);
          const location = getElementLocation(el);
          const actionLabel = role === 'tab' ? 'Select Tab' : role === 'option' ? 'Select Option' : 'Click';

          addResult({
            type: 'click',
            element: element,
            label: label,
            text: label,
            tagName: (el.tagName || '').toLowerCase(),
            role: role,
            selector: getBestSelector(el),
            action: actionLabel,
            description: actionLabel + ' "' + label + '"',
            location: location
          });
        });

        // ======== COLLECT LINKS ========
        allLinks.forEach(el => {
          if (!isVisible(el) || seen.has(el)) return;
          seen.add(el);

          const text = getVisibleText(el);
          if (!text || text.length < 1 || text.length > 60) return;

          const href = el.getAttribute('href');
          if (href && (href.startsWith('javascript:') || href === '#')) return;

          const location = getElementLocation(el);
          const locationLabel = location !== 'body' && location !== 'main' ? ' [' + location + ']' : '';

          addResult({
            type: 'click',
            element: 'link',
            label: text,
            text: text,
            tagName: 'a',
            href: href,
            selector: getBestSelector(el),
            action: 'Click',
            description: 'Click link "' + text + '"' + locationLabel,
            location: location
          });
        });

        // ======== COLLECT TEXT INPUTS (Enhanced for Shadow DOM) ========
        const textInputs = deepQueryAll('input[type="text"], input[type="email"], input[type="password"], input[type="search"], input[type="tel"], input[type="url"], input[type="number"], input:not([type]), textarea');

        textInputs.forEach(el => {
          if (!isVisible(el) || seen.has(el)) return;
          seen.add(el);

          const label = getInputLabel(el);
          const type = (el.type || 'text').toLowerCase();

          // getBestSelector now validates uniqueness — only returns selectors that match
          // exactly 1 element on the page. No complex fallbacks needed.
          const selector = getBestSelector(el);

          addResult({
            type: 'fill',
            element: 'input',
              label: label,
            text: label,
            tagName: (el.tagName || '').toLowerCase(),
              inputType: type,
            selector: selector,
            selectorObj: {
              selector: selector,
              text: label,
              inputType: type,
              placeholder: el.getAttribute && el.getAttribute('placeholder') || null,
              ariaLabel: el.getAttribute && el.getAttribute('aria-label') || null,
              name: el.name || el.getAttribute && el.getAttribute('name') || null,
              id: el.id || null
            },
            action: 'Fill',
            description: 'Fill "' + label + '" field'
          });
        });

        // ======== COLLECT SALESFORCE SEARCH INPUTS (Deep Shadow DOM) ========
        // App Launcher search, Global Search, etc. use deeply nested Shadow DOM
        function findInputsInShadow(root, results) {
          try {
            // Find direct inputs
            root.querySelectorAll('input[type="text"], input[type="search"], input[placeholder*="Search" i], input[aria-label*="Search" i]').forEach(inp => {
              if (isVisible(inp) && !seen.has(inp)) {
                results.push(inp);
              }
            });
            // Recurse into shadow roots
            root.querySelectorAll('*').forEach(el => {
              if (el.shadowRoot) {
                findInputsInShadow(el.shadowRoot, results);
              }
            });
          } catch(e) {}
        }

        // Search in Lightning components that typically contain search
        const searchHosts = [
          'one-app-launcher-search',
          'one-app-launcher-menu',
          'one-app-launcher-header',
          'lightning-lookup',
          'lightning-base-combobox',
          'lightning-grouped-combobox',
          'one-global-search',
          'search-input',
          'forceSearch-searchbox',
          '[class*="search"]',
          '[class*="appLauncher"]',
          '[data-component-id*="appLauncher"]'
        ];

        searchHosts.forEach(selector => {
          try {
            document.querySelectorAll(selector).forEach(host => {
              const shadowInputs = [];
              if (host.shadowRoot) {
                findInputsInShadow(host.shadowRoot, shadowInputs);
              }
              // Also check direct children
              findInputsInShadow(host, shadowInputs);

              shadowInputs.forEach(inp => {
                if (seen.has(inp)) return;
                seen.add(inp);

                const placeholder = inp.placeholder || inp.getAttribute('aria-label') || inp.getAttribute('title') || '';
                const label = placeholder || 'Search';

                addResult({
                  type: 'fill',
                  element: 'input',
                  label: label,
                  text: label,
                  tagName: 'input',
                  inputType: inp.type || 'search',
                  selector: getBestSelector(inp) || getBestSelector(host),
                  action: 'Fill',
                  description: 'Fill "' + label + '" search field',
                  isShadowDOM: true,
                  hostElement: (host.tagName || '').toLowerCase()
                });
              });
            });
          } catch(e) {}
        });

        // Also find the currently focused input (often App Launcher search)
        try {
          const activeEl = document.activeElement;
          if (activeEl && activeEl.shadowRoot) {
            const focusedInput = activeEl.shadowRoot.querySelector('input:focus');
            if (focusedInput && !seen.has(focusedInput) && isVisible(focusedInput)) {
              seen.add(focusedInput);
              const label = focusedInput.placeholder || focusedInput.getAttribute('aria-label') || 'Search';
              addResult({
                type: 'fill',
                element: 'input',
                label: label,
                text: label,
                tagName: 'input',
                inputType: focusedInput.type || 'text',
                selector: getBestSelector(focusedInput),
                action: 'Fill',
                description: 'Fill "' + label + '" (focused)',
                isFocused: true
              });
            }
          }
        } catch(e) {}

        // ======== COLLECT SELECT DROPDOWNS ========
        const selects = deepQueryAll('select');
        selects.forEach(el => {
          if (!isVisible(el) || seen.has(el)) return;
          seen.add(el);

          const label = getInputLabel(el);
          const options = Array.from(el.options || []).slice(0, 10).map(o => o.text.trim()).filter(t => t);

          addResult({
              type: 'select',
              label: label,
              tagName: 'select',
            selector: getBestSelector(el),
              options: options,
              action: 'Select',
              description: 'Select from "' + label + '"'
            });
        });

        // ======== COLLECT COMBOBOXES (Lightning/ARIA) ========
        const comboboxes = deepQueryAll('[role="combobox"], lightning-combobox, [role="listbox"], lightning-picklist, lightning-select, [class*="combobox"]');
        comboboxes.forEach(el => {
          if (!isVisible(el) || seen.has(el)) return;
          seen.add(el);

          // For Lightning components, get the internal input
          const internalInput = el.querySelector('input, [role="textbox"]');
          if (internalInput && seen.has(internalInput)) return;
          if (internalInput) seen.add(internalInput);

          const label = getInputLabel(el);
          if (!label || label.length > 60) return;

          addResult({
            type: 'select',
              label: label,
            tagName: (el.tagName || '').toLowerCase(),
            role: 'combobox',
            selector: getBestSelector(el),
            action: 'Select',
            description: 'Select from "' + label + '"'
          });
        });

        // ======== COLLECT CHECKBOXES ========
        const checkboxes = deepQueryAll('input[type="checkbox"], [role="checkbox"], lightning-input[type="checkbox"]');
        checkboxes.forEach(el => {
          if (!isVisible(el) || seen.has(el)) return;
          seen.add(el);

          const label = getInputLabel(el);

          addResult({
            type: 'checkbox',
            label: label,
            tagName: (el.tagName || '').toLowerCase(),
            inputType: 'checkbox',
            selector: getBestSelector(el),
            action: 'Check',
            description: 'Check "' + label + '"'
          });
        });

        // ======== COLLECT RADIO BUTTONS ========
        const radios = deepQueryAll('input[type="radio"], [role="radio"], lightning-input[type="radio"]');
        radios.forEach(el => {
          if (!isVisible(el) || seen.has(el)) return;
          seen.add(el);

          const label = getInputLabel(el);

          addResult({
            type: 'radio',
            label: label,
            tagName: (el.tagName || '').toLowerCase(),
            inputType: 'radio',
            selector: getBestSelector(el),
            action: 'Select',
            description: 'Select "' + label + '"'
          });
        });

        // ======== COLLECT DATE INPUTS ========
        const dateInputs = deepQueryAll('input[type="date"], input[type="datetime-local"], input[type="time"], lightning-datepicker, lightning-input[type="date"]');
        dateInputs.forEach(el => {
          if (!isVisible(el) || seen.has(el)) return;
          seen.add(el);

          const label = getInputLabel(el);

          addResult({
            type: 'fill',
            label: label,
            tagName: (el.tagName || '').toLowerCase(),
            inputType: 'date',
            selector: getBestSelector(el),
            action: 'Fill',
            description: 'Fill date "' + label + '"'
          });
        });

        // ======== COLLECT FILE INPUTS ========
        const fileInputs = deepQueryAll('input[type="file"], lightning-file-upload');
        fileInputs.forEach(el => {
          if (!isVisible(el) || seen.has(el)) return;
          seen.add(el);

          const label = getInputLabel(el);

          addResult({
            type: 'upload',
            label: label,
            tagName: (el.tagName || '').toLowerCase(),
            inputType: 'file',
            selector: getBestSelector(el),
            action: 'Upload',
            description: 'Upload file to "' + label + '"'
          });
        });

        // ======== COLLECT HEADINGS (for assertions) - NO LIMIT ========
        const headings = deepQueryAll('h1, h2, h3, h4, h5, h6, [role="heading"]');
        headings.forEach(el => {
          if (!isVisible(el) || seen.has(el)) return;
          seen.add(el);

          const text = getVisibleText(el);
          if (!text || text.length < 2 || text.length > 80) return;

          addResult({
            type: 'heading',
            label: text,
            tagName: (el.tagName || '').toLowerCase(),
            selector: getBestSelector(el),
            action: 'Assert',
            description: 'Assert heading "' + text + '"'
          });
        });

        // ======== SALESFORCE DETAIL PAGE ELEMENTS ========
        // Record fields (output fields on detail pages)
        const recordFields = deepQueryAll('lightning-output-field, lightning-formatted-text, lightning-formatted-name, lightning-formatted-email, lightning-formatted-phone, lightning-formatted-url, lightning-formatted-date-time, .slds-output, .slds-form-element__static, [data-output-element-id]');
        recordFields.forEach(el => {
          if (!isVisible(el) || seen.has(el)) return;
          seen.add(el);

          const label = getInputLabel(el);
          const value = getVisibleText(el);
          if (!label && !value) return;

          addResult({
            type: 'heading',  // Use as assertion element
            label: label || value,
            value: value,
            tagName: (el.tagName || '').toLowerCase(),
            selector: getBestSelector(el),
            action: 'Assert',
            description: 'Assert field "' + (label || value) + '"'
          });
        });

        // Lightning card headers and titles
        const cardHeaders = deepQueryAll('lightning-card .slds-card__header, .slds-card__header-title, lightning-tile .slds-tile__title, .slds-section__title, .slds-page-header__title');
        cardHeaders.forEach(el => {
          if (!isVisible(el) || seen.has(el)) return;
          seen.add(el);

          const text = getVisibleText(el);
          if (!text || text.length < 2) return;

          addResult({
            type: 'heading',
            label: text,
            tagName: (el.tagName || '').toLowerCase(),
            selector: getBestSelector(el),
            action: 'Assert',
            description: 'Assert title "' + text + '"'
          });
        });

        // Related lists and tabs
        const relatedLists = deepQueryAll('lightning-tab, .slds-tabs__item a, [role="tablist"] [role="tab"], lightning-tabset lightning-tab-bar button');
        relatedLists.forEach(el => {
          if (!isVisible(el) || seen.has(el)) return;
          seen.add(el);

          const text = getVisibleText(el);
          if (!text || text.length < 1) return;

          addResult({
            type: 'click',
            label: text,
            tagName: (el.tagName || '').toLowerCase(),
            role: 'tab',
            selector: getBestSelector(el),
            action: 'Click',
            description: 'Click tab "' + text + '"'
          });
        });

        // Actions menus/dropdowns
        const actionMenus = deepQueryAll('[role="menu"] [role="menuitem"], lightning-menu-item, .slds-dropdown__item a, .slds-dropdown__list li, lightning-button-menu lightning-menu-item');
        actionMenus.forEach(el => {
          if (!isVisible(el) || seen.has(el)) return;
          seen.add(el);

          const text = getVisibleText(el);
          if (!text || text.length < 1 || text.length > 60) return;

          addResult({
            type: 'click',
            label: text,
            tagName: (el.tagName || '').toLowerCase(),
            role: 'menuitem',
            selector: getBestSelector(el),
            action: 'Click',
            description: 'Click menu "' + text + '"'
          });
        });

        // Data table cells and links
        const tableCells = deepQueryAll('lightning-datatable a, table td a, .slds-table a, lightning-formatted-url a, [data-navigate="enable"]');
        tableCells.forEach(el => {
          if (!isVisible(el) || seen.has(el)) return;
          seen.add(el);

          const text = getVisibleText(el);
          if (!text || text.length < 1 || text.length > 80) return;

          addResult({
            type: 'click',
            label: text,
            tagName: (el.tagName || '').toLowerCase(),
            selector: getBestSelector(el),
            action: 'Click',
            description: 'Click record "' + text + '"'
          });
        });

        // ======== COLLECT TOGGLE SWITCHES ========
        const toggles = deepQueryAll('[role="switch"], lightning-input[type="toggle"], .slds-checkbox_toggle, [class*="toggle-switch"]');
        toggles.forEach(el => {
          if (!isVisible(el) || seen.has(el)) return;
          seen.add(el);

          const label = getLabel(el);

          addResult({
            type: 'toggle',
            label: label,
            tagName: (el.tagName || '').toLowerCase(),
            role: 'switch',
            selector: getBestSelector(el),
            action: 'Toggle',
            description: 'Toggle "' + label + '"'
          });
        });

        // ======== COLLECT SLIDERS ========
        const sliders = deepQueryAll('input[type="range"], [role="slider"]');
        sliders.forEach(el => {
          if (!isVisible(el) || seen.has(el)) return;
          seen.add(el);

          const label = getInputLabel(el);

          addResult({
            type: 'slider',
            label: label,
            tagName: (el.tagName || '').toLowerCase(),
            inputType: 'range',
            selector: getBestSelector(el),
            action: 'Slide',
            description: 'Adjust "' + label + '"'
          });
        });

        // ======== COLLECT NAVIGATION/MENU ITEMS ========
        const navItems = deepQueryAll('nav a, [role="navigation"] a, .nav-link, .menu-item, [class*="sidebar"] a, [class*="nav-item"]');
        navItems.forEach(el => {
          if (!isVisible(el) || seen.has(el)) return;
          seen.add(el);

          const text = getVisibleText(el);
          if (!text || text.length < 1) return;

          addResult({
            type: 'click',
            label: text,
            tagName: (el.tagName || '').toLowerCase(),
            selector: getBestSelector(el),
            action: 'Navigate',
            description: 'Navigate to "' + text + '"'
          });
        });

        // Sort by type priority: inputs first, then buttons, then others
        const typePriority = { fill: 1, select: 2, checkbox: 3, radio: 3, click: 4, heading: 5 };
        results.sort((a, b) => (typePriority[a.type] || 10) - (typePriority[b.type] || 10));

        // Calculate counts by element type
        const counts = {
          buttons: results.filter(r => r.element === 'button').length,
          links: results.filter(r => r.element === 'link').length,
          inputs: results.filter(r => r.type === 'fill' || r.type === 'select').length,
          tabs: results.filter(r => r.element === 'tab').length,
          cards: results.filter(r => r.element === 'card').length,
          menus: results.filter(r => r.element === 'menuitem').length,
          headings: results.filter(r => r.type === 'heading').length,
          total: results.length
        };

        return { suggestions: results, counts };
      });

      console.log('[PlaywrightRecorder] Analyze found', suggestions.suggestions?.length || 0, 'elements:', suggestions.counts);

      // ALWAYS update the browser overlay with the same suggestions
      // This ensures the webapp and overlay are always in sync
      try {
        await recorder.page.evaluate((sugs) => {
          if (window.__flowstralShowSuggestions__) {
            window.__flowstralShowSuggestions__(sugs);
          }
        }, suggestions.suggestions || []);
        console.log('[PlaywrightRecorder] Overlay synced with', suggestions.suggestions?.length || 0, 'suggestions');
      } catch (e) {
        // Overlay update failed, but we still return the suggestions
      }

      return {
        success: true,
        suggestions: suggestions.suggestions || [],
        counts: suggestions.counts || {}
      };
    } catch (error) {
      console.error('[PlaywrightRecorder] Analyze failed:', error.message);
      return { success: false, suggestions: [], counts: {}, error: error.message };
    }
  }

module.exports = { analyzePage };
