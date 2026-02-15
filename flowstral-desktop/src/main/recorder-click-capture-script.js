/**
 * Click capture script for injection into browser pages.
 * Captures click events, input changes, and other user interactions.
 */

function getClickCaptureScript() {
    return `
    (function() {
      // Prevent double injection
      if (window.__flowstralClickCaptureInjected) return;
      window.__flowstralClickCaptureInjected = true;
        // This runs in page context, capturing clicks at the window level
        // with useCapture=true to get them BEFORE anything else
        
        // KEY INSIGHT: e.composedPath() is the W3C standard for accessing
        // elements across Shadow DOM boundaries. This is how DevTools works!
        
        window.__flowstralCDPClicks = window.__flowstralCDPClicks || [];
        window.__flowstralCDPInputs = window.__flowstralCDPInputs || {};
        window.__flowstralLastInputFlush = 0;
        
        // Capture at the window level with capture phase
        window.addEventListener('click', function(e) {
          try {
            // Get the actual target, traversing into shadow DOM if needed
            let target = e.target;
            const path = e.composedPath ? e.composedPath() : [target];
            
            // Find the best element from the composed path
            // (composedPath() includes elements from shadow DOM!)
            let bestElement = null;
            for (const el of path) {
              if (!el || !el.tagName) continue;
              const tag = el.tagName.toLowerCase();
              
              // Skip document, window, shadow roots, and container elements
              if (tag === 'html' || tag === 'body' || tag === 'form' || tag === 'main' || tag === 'section') continue;
              
              // PRIORITY 1: Submit buttons (login, submit, etc.) - ALWAYS capture these
              if (tag === 'input' && (el.type === 'submit' || el.type === 'button')) {
                bestElement = el;
                break;
              }
              
              // PRIORITY 2: Buttons and links
              if (tag === 'button' || tag === 'a') {
                bestElement = el;
                break;
              }
              
              // Check if this is an interactive element
              const elRole = el.getAttribute('role');
              const isInteractive = 
                tag === 'input' ||
                tag === 'li' ||
                tag === 'label' || // Labels are interactive (often wrap radio buttons in segmented controls)
                elRole === 'button' ||
                elRole === 'link' ||
                elRole === 'tab' ||
                elRole === 'menuitem' ||
                elRole === 'option' ||
                elRole === 'listitem' ||
                elRole === 'treeitem' ||
                elRole === 'radio' || // Segmented controls / styled radio buttons
                elRole === 'checkbox' || // Styled checkboxes
                elRole === 'switch' || // Toggle switches
                el.getAttribute('tabindex') === '0' ||
                el.getAttribute('aria-pressed') !== null || // Toggle buttons
                el.getAttribute('aria-selected') !== null || // Selectable items
                el.classList?.contains('btn') || // Bootstrap-style buttons
                el.classList?.contains('button') || // Generic button class
                el.onclick;
              
              // Check for Salesforce-specific menu item indicators
              const isSalesforceMenuItem = 
                tag.startsWith('one-app-launcher') ||
                tag.startsWith('lightning-base-combobox-item') ||
                tag.startsWith('search_dialog-instant-result') ||
                tag.startsWith('forceSearch') ||
                tag.startsWith('search-result') ||
                tag.startsWith('lst-') ||
                tag.startsWith('records-') ||
                tag.includes('result-item') ||
                tag.includes('lookup') ||
                el.getAttribute('data-label') ||
                el.getAttribute('data-value') ||
                el.getAttribute('data-item-id') ||
                el.getAttribute('data-record-id') ||
                el.getAttribute('data-refid') ||
                el.classList?.contains('slds-listbox__option') ||
                el.classList?.contains('slds-dropdown__item') ||
                el.classList?.contains('instant-result') ||
                el.classList?.contains('option') ||
                el.classList?.contains('lookup__result') ||
                el.classList?.contains('primaryField') ||
                el.classList?.contains('forceSearchResultsGridItem');
              
              if (isInteractive || isSalesforceMenuItem) {
                bestElement = el;
                break;
              }
              
              // Also accept elements with meaningful attributes (but short text only)
              const textLen = (el.textContent || '').trim().length;
              const hasShortText = textLen > 0 && textLen < 50; // Shorter limit to avoid form text
              const hasTitle = el.getAttribute('title');
              const hasAriaLabel = el.getAttribute('aria-label');
              
              // SKIP container divs that have concatenated text from multiple child elements
              // These are form step headers like "Start your registrationIt's easy and takes 10..."
              const isContainerDiv = tag === 'div' || tag === 'span';
              if (isContainerDiv && !hasTitle && !hasAriaLabel) {
                // BUT DON'T skip if it's part of a segmented control / button group
                const isSegmentedButton = 
                  el.closest('[role="radiogroup"], [role="group"], .btn-group, .button-group, .segmented-control, .toggle-group') ||
                  el.querySelector('input[type="radio"], input[type="checkbox"]') ||
                  el.getAttribute('aria-pressed') !== null ||
                  el.getAttribute('aria-selected') !== null ||
                  el.classList?.contains('active') ||
                  el.classList?.contains('selected') ||
                  el.classList?.contains('checked');
                
                if (!isSegmentedButton) {
                  // Check if text looks like concatenated headers (no whitespace between sentences)
                  const rawText = (el.textContent || '').trim();
                  const hasLowerUpperJunction = /[a-z][A-Z]/.test(rawText); // "registrationIt's"
                  const hasManyChildren = el.children && el.children.length > 2;
                  const hasMultipleSections = el.querySelectorAll('h1,h2,h3,h4,h5,h6,p,.slds-text-heading').length > 0;
                  
                  if (hasLowerUpperJunction || hasManyChildren || hasMultipleSections) {
                    continue; // Skip this container, look for actual interactive element
                  }
                }
              }
              
              if ((hasShortText || hasTitle || hasAriaLabel) && !bestElement) {
                bestElement = el;
              }
            }
            
            if (!bestElement) bestElement = target;
            
            // Don't capture if it's our overlay
            if (bestElement.closest && (
              bestElement.closest('#flowstral-host') ||
              bestElement.closest('#flowstral-suggestions-host') ||
              bestElement.closest('[data-flowstral-ignore="true"]')
            )) {
              return;
            }
            
            // Get element info
            const tag = (bestElement.tagName || '').toLowerCase();
            const type = bestElement.type || '';
            // For input elements, use value attribute (for submit buttons like "Log In")
            const inputValue = (bestElement.value || '').trim();
            
            // SALESFORCE SPECIFIC: Check for data attributes used in Lightning components
            const dataLabel = bestElement.getAttribute('data-label') || '';
            const dataValue = bestElement.getAttribute('data-value') || '';
            const dataItemId = bestElement.getAttribute('data-item-id') || '';
            const dataName = bestElement.getAttribute('data-name') || '';
            const dataTargetSelection = bestElement.getAttribute('data-target-selection-name') || '';
            
            // For Lightning menu items and search results, try to get text from child elements
            let itemText = '';
            if (tag.includes('lightning-') || tag.includes('one-') || tag.includes('force-') || 
                tag.includes('search') || tag.includes('result') || tag.includes('lookup') ||
                tag.includes('lst-') || tag.includes('records-')) {
              // Try various selectors to find the actual text (search results, menu items, etc.)
              const textSelectors = [
                '.primaryField',                    // Salesforce record name
                '.slds-listbox__option-text',      // Listbox option text
                '[class*="primaryLabel"]',          // Primary label
                '[class*="name"]',                  // Name fields
                '[class*="title"]',                 // Title fields
                '[class*="label"]',                 // Label fields
                'span.slds-truncate',               // Truncated text
                '.itemLabel',                       // Item label
                '.appName',                         // App name
                'mark',                             // Search highlight
                '.uiOutputText',                    // Aura output text
                '.forceOutputLookupWithPreview',   // Lookup preview
                'a[data-refid]',                   // Record link
                '.primaryField lightning-formatted-text', // Record name in search
                '.primaryField span'               // Fallback
              ];
              
              for (const selector of textSelectors) {
                try {
                  const textEl = bestElement.querySelector(selector);
                  if (textEl) {
                    const foundText = (textEl.textContent || '').trim();
                    if (foundText && foundText.length > 1 && foundText.length < 100) {
                      itemText = foundText;
                      break;
                    }
                  }
                } catch(e) {}
              }
              
              // Also check for highlighted search matches (mark element)
              if (!itemText) {
                const markEl = bestElement.querySelector('mark');
                if (markEl) {
                  itemText = (markEl.textContent || '').trim();
                }
              }
            }
            
            // CRITICAL: Get title and ariaLabel first - they are more reliable than textContent
            const title = bestElement.getAttribute('title') || '';
            const ariaLabel = bestElement.getAttribute('aria-label') || '';
            
            // Priority: title > ariaLabel > dataLabel > dataValue > itemText > inputValue > textContent
            // Title and aria-label are most reliable for Salesforce elements
            let rawText = dataLabel || dataValue || dataName || itemText || 
                       ((tag === 'input' && inputValue) ? inputValue : (bestElement.innerText || bestElement.textContent || '').trim().substring(0, 100));
            
            // Use title or ariaLabel if rawText looks corrupted (missing characters)
            // Pattern: "Li t" (should be "List"), "U er" (should be "User")
            const looksCorrupted = /\b[A-Z][a-z]?\s[a-z]+\b/.test(rawText) && rawText.length < 30;
            let text = '';
            if (title && title.length > 1 && title.length < 100 && (looksCorrupted || !rawText)) {
              text = title;
            } else if (ariaLabel && ariaLabel.length > 1 && ariaLabel.length < 100 && (looksCorrupted || !rawText)) {
              text = ariaLabel;
            } else {
              text = rawText;
            }
            
            // Fix common Salesforce text corruption patterns
            // First normalize all whitespace types (nbsp, thin space, etc.) to regular space
            // NOTE: Using \\s and \\b because this is inside a template literal string!
            text = text.replace(/[\\u00A0\\u2000-\\u200A\\u202F\\u205F\\u3000]/g, ' ');
            text = text
              .replace(/Li\\s+t\\b/g, 'List')
              .replace(/U\\s+er\\b/g, 'User')
              .replace(/Pa\\s+word\\b/g, 'Password')
              .replace(/Ca\\s+e\\b/g, 'Case')
              .replace(/Ta\\s+k\\b/g, 'Task')
              .replace(/A\\s+et\\b/g, 'Asset')
              .replace(/Campa\\s+gn\\b/g, 'Campaign')
              .replace(/Rec\\s+ently\\b/g, 'Recently')
              .replace(/View\\s+ed\\b/g, 'Viewed')
              .replace(/Act\\s+ive\\b/g, 'Active')
              .replace(/\\s{2,}/g, ' ')
              .trim();
            const id = bestElement.id || '';
            const name = bestElement.getAttribute('name') || '';
            const placeholder = bestElement.getAttribute('placeholder') || '';
            const role = bestElement.getAttribute('role') || '';
            const href = bestElement.getAttribute('href') || '';
            
            // HIGHEST PRIORITY: data-testid and variants (most stable selectors)
            const testId = bestElement.getAttribute('data-testid') || '';
            const dataTestId = bestElement.getAttribute('data-test-id') || '';
            const dataTest = bestElement.getAttribute('data-test') || '';
            const dataCy = bestElement.getAttribute('data-cy') || '';
            
            // Skip text inputs (fill will be recorded separately)
            if (tag === 'input' && ['text','email','password','search','tel','url','number'].includes(type)) {
              return;
            }
            if (tag === 'textarea') return;
            
            // SPECIAL HANDLING FOR RADIO/CHECKBOX: Find the label text
            if (tag === 'input' && (type === 'radio' || type === 'checkbox')) {
              var radioLabel = '';
              
              // Method 1: Look for associated <label> element via 'for' attribute
              if (id) {
                try {
                  // Search in shadow DOM if needed
                  var labelEl = document.querySelector('label[for="' + id + '"]');
                  if (!labelEl) {
                    // Try to find in composedPath (shadow DOM)
                    for (var pi = 0; pi < path.length; pi++) {
                      var root = path[pi];
                      if (root.querySelector) {
                        labelEl = root.querySelector('label[for="' + id + '"]');
                        if (labelEl) break;
                      }
                    }
                  }
                  if (labelEl) {
                    radioLabel = (labelEl.textContent || '').trim();
                  }
                } catch(e) {}
              }
              
              // Method 2: Check if input is inside a label
              if (!radioLabel) {
                try {
                  var parentLabel = bestElement.closest('label');
                  if (parentLabel) {
                    radioLabel = (parentLabel.textContent || '').trim();
                  }
                } catch(e) {}
              }
              
              // Method 3: Look for Salesforce/SLDS label patterns
              if (!radioLabel) {
                try {
                  // Find the form element container and get its label
                  var formElement = bestElement.closest('.slds-form-element, .slds-radio, .slds-checkbox');
                  if (formElement) {
                    var sldsLabel = formElement.querySelector('.slds-form-element__label, .slds-radio__label, .slds-checkbox__label');
                    if (sldsLabel) {
                      radioLabel = (sldsLabel.textContent || '').trim();
                    }
                  }
                } catch(e) {}
              }
              
              // Method 4: Look for adjacent sibling text (span next to input)
              if (!radioLabel) {
                try {
                  var nextSibling = bestElement.nextElementSibling;
                  if (nextSibling && nextSibling.tagName.toLowerCase() === 'span') {
                    radioLabel = (nextSibling.textContent || '').trim();
                  }
                } catch(e) {}
              }
              
              // Method 5: Look for parent radio group label or legend
              if (!radioLabel) {
                try {
                  var radioGroup = bestElement.closest('fieldset, [role="radiogroup"], .slds-radio_button-group');
                  if (radioGroup) {
                    var legend = radioGroup.querySelector('legend, .slds-form-element__legend, .slds-form-element__label');
                    if (legend) {
                      // Include both the group label and specific option if possible
                      var groupLabel = (legend.textContent || '').trim();
                      var optionLabel = ariaLabel || bestElement.getAttribute('value') || '';
                      radioLabel = optionLabel ? optionLabel : groupLabel;
                    }
                  }
                } catch(e) {}
              }
              
              // Use found label if available
              if (radioLabel && radioLabel.length > 1 && radioLabel.length < 100) {
                text = radioLabel;
              }
            }
            
            // SPECIAL HANDLING FOR SEGMENTED CONTROLS / STYLED BUTTON GROUPS
            // These are often labels or divs that visually look like buttons but wrap hidden radio inputs
            // Common patterns: Bootstrap btn-group, Xcel Energy service type selector, etc.
            if (tag === 'label' || tag === 'div' || tag === 'span') {
              // Check if this element contains or is associated with a radio/checkbox
              var containedInput = bestElement.querySelector('input[type="radio"], input[type="checkbox"]');
              var isInRadioGroup = bestElement.closest('[role="radiogroup"], [role="group"], .btn-group, .button-group, .segmented-control, fieldset');
              var hasSelectedIndicator = bestElement.getAttribute('aria-pressed') || bestElement.getAttribute('aria-selected') || bestElement.getAttribute('aria-checked');
              var hasSelectedClass = bestElement.classList && (
                bestElement.classList.contains('active') ||
                bestElement.classList.contains('selected') ||
                bestElement.classList.contains('checked') ||
                bestElement.classList.contains('is-selected')
              );
              
              // If this looks like a segmented control option, treat it specially
              if (containedInput || isInRadioGroup || hasSelectedIndicator || hasSelectedClass) {
                // Get the visible text as the description (this is what the user sees)
                var visibleText = (bestElement.textContent || '').trim();
                // Filter out hidden input value text if present
                if (containedInput && containedInput.value) {
                  visibleText = visibleText.replace(containedInput.value, '').trim();
                }
                if (visibleText && visibleText.length > 1 && visibleText.length < 50) {
                  text = visibleText;
                }
                console.log('[Flowstral] Detected segmented control click:', visibleText);
              }
            }
            
            // Generate description - avoid auto-generated IDs
            var useId = id;
            // Skip auto-generated IDs (patterns like "radio-123", "input-456", "lwc-xxx", "aura-xxx")
            if (id && /^(radio|input|checkbox|button|lwc|aura|combobox)-?\d+$/i.test(id)) {
              useId = ''; // Don't use auto-generated ID
            }
            let desc = title || ariaLabel || text || name || useId || placeholder || tag;
            desc = desc.replace(/\\s+/g, ' ').trim().substring(0, 50);
            
            // Check if this is a submit/login/navigation button that will cause immediate action
            var textLower = text.toLowerCase();
            var isSubmitButton = 
              type === 'submit' || 
              tag === 'button' && (bestElement.closest('form') || textLower.includes('log in') || textLower.includes('login') || textLower.includes('sign in')) ||
              id.toLowerCase().includes('login') ||
              name.toLowerCase().includes('login') ||
              textLower.includes('log in') ||
              textLower.includes('login') ||
              textLower.includes('sign in') ||
              textLower.includes('submit') ||
              textLower.includes('next') ||
              textLower.includes('continue') ||
              textLower.includes('proceed') ||
              textLower === 'cancel' ||
              textLower === 'ok' ||
              textLower === 'confirm';
            
            // Detect element index when there are multiple matching elements
            var elementIndex = 0;
            var totalMatching = 1;
            try {
              // Find all elements that match the same text/label
              var searchText = title || ariaLabel || text || name;
              if (searchText && searchText.length > 0) {
                var matchingElements = [];
                
                // Search for matching buttons, links, and elements
                var allButtons = document.querySelectorAll('button, a, [role="button"], [role="link"], input[type="submit"], input[type="button"]');
                for (var i = 0; i < allButtons.length; i++) {
                  var btn = allButtons[i];
                  var btnText = (btn.textContent || btn.innerText || '').trim();
                  var btnTitle = btn.getAttribute('title') || '';
                  var btnAriaLabel = btn.getAttribute('aria-label') || '';
                  
                  // Check if this element matches the search text
                  if (btnText.indexOf(searchText) !== -1 || 
                      btnTitle === searchText || 
                      btnAriaLabel === searchText ||
                      btnText === searchText) {
                    matchingElements.push(btn);
                  }
                }
                
                // Also search Shadow DOM
                var shadowHosts = document.querySelectorAll('*');
                for (var i = 0; i < shadowHosts.length; i++) {
                  if (shadowHosts[i].shadowRoot) {
                    var shadowButtons = shadowHosts[i].shadowRoot.querySelectorAll('button, a, [role="button"], [role="link"]');
                    for (var j = 0; j < shadowButtons.length; j++) {
                      var btn = shadowButtons[j];
                      var btnText = (btn.textContent || btn.innerText || '').trim();
                      var btnTitle = btn.getAttribute('title') || '';
                      var btnAriaLabel = btn.getAttribute('aria-label') || '';
                      
                      if (btnText.indexOf(searchText) !== -1 || 
                          btnTitle === searchText || 
                          btnAriaLabel === searchText ||
                          btnText === searchText) {
                        matchingElements.push(btn);
                      }
                    }
                  }
                }
                
                totalMatching = matchingElements.length;
                
                // Find which index the clicked element is
                for (var i = 0; i < matchingElements.length; i++) {
                  if (matchingElements[i] === bestElement || 
                      matchingElements[i].contains(bestElement) ||
                      bestElement.contains(matchingElements[i])) {
                    elementIndex = i;
                    break;
                  }
                }
                
                if (totalMatching > 1) {
                  console.log('[Flowstral] Element "' + searchText + '" has ' + totalMatching + ' matches, clicked index: ' + elementIndex);
                }
              }
            } catch (indexErr) {
              // Ignore errors in index detection
            }
            
            var clickData = {
              timestamp: Date.now(),
              tag: tag,
              type: type,
              text: text.substring(0, 50),
              title: title,
              ariaLabel: ariaLabel,
              id: id,
              name: name,
              placeholder: placeholder,
              role: role,
              href: href,
              // HIGHEST PRIORITY: data-testid and variants for stable selectors
              testId: testId,
              dataTestId: dataTestId || testId,
              dataTest: dataTest,
              dataCy: dataCy,
              description: 'Click "' + desc + '"',
              x: e.clientX,
              y: e.clientY,
              fromShadow: path.length > 1 && path.some(p => p.nodeType === 11), // nodeType 11 is DocumentFragment (shadow root)
              isSubmit: isSubmitButton,
              elementIndex: elementIndex,
              totalMatching: totalMatching
            };
            
            // FILTER OUT phantom/internal Salesforce clicks
            // These are events triggered by Salesforce internally, not by user
            var isPhantomClick = false;
            
            // Check if this looks like a meaningful user interaction
            var hasMeaningfulData = dataLabel || dataValue || dataName || itemText;
            var isSearchRelated = tag.includes('search') || tag.includes('result') || 
                                  tag.includes('lookup') || tag.includes('records-');
            var isMenuItem = role === 'option' || role === 'menuitem' || role === 'listitem';
            
            // Filter 1: Skip if no meaningful text/description (but not for interactive elements)
            if (!desc || desc.length < 2 || desc === tag) {
              if (!hasMeaningfulData && !isSearchRelated && !isMenuItem) {
                isPhantomClick = true;
              }
            }
            
            // Filter 2: Skip ONLY truly generic HTML elements
            var badDescriptions = ['div', 'span', 'section', 'article', 'slot'];
            
            for (var i = 0; i < badDescriptions.length; i++) {
              if (desc.toLowerCase() === badDescriptions[i] && !hasMeaningfulData && !isSearchRelated) {
                isPhantomClick = true;
                break;
              }
            }
            
            // Filter 2.5: CRITICAL - Skip React DevTools, Webpack, and framework internal code
            // This catches garbage like "import { injectIntoGlobalHook } from '/@react-refr"
            var frameworkInternalPatterns = [
              '/@react',
              '__webpack',
              'injectIntoGlobalHook',
              'webpackJsonp',
              'undefined is not',
              'Cannot read propert',
              '__REACT_DEVTOOLS',
              '__PREACT_DEVTOOLS',
              'import {',
              'import \\(',
              'require\\(',
              'from \\'',
              'from "',
              'module.exports',
              'export default',
              'export {',
              '__esModule',
              '__vite',
              'hot module',
              'hmr',
              'localhost:',
              '127.0.0.1:',
              '.js:',
              '.tsx:',
              '.ts:'
            ];
            
            var fullText = (text || '').toLowerCase();
            var fullDesc = (desc || '').toLowerCase();
            for (var pi = 0; pi < frameworkInternalPatterns.length; pi++) {
              var pattern = frameworkInternalPatterns[pi].toLowerCase();
              if (fullText.indexOf(pattern) !== -1 || fullDesc.indexOf(pattern) !== -1) {
                console.log('[Flowstral] Skipping framework internal element:', desc.substring(0, 50));
                isPhantomClick = true;
                break;
              }
            }
            
            // Filter 2.6: Skip script tags or elements inside script tags
            if (tag === 'script' || (bestElement.closest && bestElement.closest('script'))) {
              console.log('[Flowstral] Skipping script element');
              isPhantomClick = true;
            }
            
            // Filter 2.7: Skip elements with code-like text patterns
            if (!isPhantomClick && text) {
              // Code patterns: arrow functions, const/let/var declarations, imports
              var codePatterns = /^(const |let |var |function |import |export |return |if \\(|for \\(|\\(\\) =>|=> \\{)/i;
              if (codePatterns.test(text.trim())) {
                console.log('[Flowstral] Skipping code-like text:', text.substring(0, 30));
                isPhantomClick = true;
              }
            }
            
            // Filter 3: Skip truly internal Lightning components (primitives, formatters)
            // but NEVER skip search results, menu items, or elements with meaningful data
            var isInternalComponent = ['lightning-primitive-cell', 'lightning-primitive-icon', 
                                       'aura-component', 'lightning-formatted-rich-text'];
            if (!hasMeaningfulData && !isSearchRelated && !isMenuItem) {
              for (var i = 0; i < isInternalComponent.length; i++) {
                if (desc.toLowerCase().indexOf(isInternalComponent[i]) === 0) {
                  isPhantomClick = true;
                  break;
                }
              }
            }
            
            // Filter 4: Skip if click position is 0,0 AND event is synthetic
            // NOTE: DO NOT filter on isTrusted alone - Shadow DOM clicks can lose trusted status
            if (e.clientX === 0 && e.clientY === 0 && !e.isTrusted) {
              isPhantomClick = true;
            }
            
            // NOTE: We REMOVED the isTrusted filter because:
            // 1. Shadow DOM clicks may be re-dispatched and lose trusted status
            // 2. Some frameworks (like LWC) re-dispatch user clicks internally
            // The position + other filters are sufficient to catch truly synthetic clicks
            
            // Filter 5: Clean up repeated text in description
            var descWords = desc.toLowerCase().split(' ');
            if (descWords.length >= 2 && descWords[0] === descWords[1]) {
              desc = descWords.slice(1).join(' ');
              clickData.description = 'Click "' + desc + '"';
            }
            
            // Filter 6: Skip container divs with concatenated text (form step headers)
            // These have patterns like "Start your registrationIt's easy" - lowercase followed by uppercase
            if (tag === 'div' && !role) {
              var concatenatedPattern = /[a-z][A-Z]/; // lowercase immediately followed by uppercase
              if (concatenatedPattern.test(desc) || concatenatedPattern.test(text)) {
                console.log('[Flowstral] Skipping concatenated container text:', desc);
                isPhantomClick = true;
              }
              // Also skip divs with very long text (likely containers with multiple sections)
              if (text.length > 40 && !hasMeaningfulData && !dataLabel && !dataValue) {
                console.log('[Flowstral] Skipping large container div:', desc);
                isPhantomClick = true;
              }
            }
            
            if (isPhantomClick) {
              console.log('[Flowstral] Skipping phantom click:', desc, '| tag:', tag, '| hasMeaningfulData:', hasMeaningfulData);
              return;
            }
            
            // Log successful click detection for debugging
            console.log('[Flowstral] Click detected:', desc, '| tag:', tag, '| role:', role, '| itemText:', itemText);
            
            // ============================================================
            // NOTE: We ONLY use console.log capture now (not array push)
            // This avoids duplicate capture since console works cross-origin
            // and the polling loop was processing BOTH sources
            // ============================================================
            
            // ============================================================
            // CRITICAL: Report ALL clicks via console for cross-domain capture!
            // Previously only submit buttons were reported, which broke
            // recording in cross-origin tabs (context.addInitScript works
            // but page.evaluate() fails, so we can't poll the clicks array)
            // ============================================================
            try {
              // FIRST: Report all pending inputs via console (before any navigation)
              var pendingInputs = window.__flowstralCDPInputs || {};
              for (var inputKey in pendingInputs) {
                var inp = pendingInputs[inputKey];
                if (inp && inp.value) {
                  console.log('__FLOWSTRAL_INPUT__:' + JSON.stringify(inp));
                }
              }
              
              // Clear inputs ONLY for submit/navigation buttons to avoid losing partial inputs
              if (isSubmitButton) {
                window.__flowstralCDPInputs = {};
              }
              
              // Report the click via console - works across ALL origins!
              console.log('__FLOWSTRAL_CLICK__:' + JSON.stringify(clickData));
              
              if (isSubmitButton) {
                console.log('[Flowstral] Submit click reported via console:', desc);
              }
            } catch(e) {
              console.error('[Flowstral] Error reporting:', e);
            }
          } catch(err) {
            // Silent
          }
        }, true); // CAPTURE phase - runs before anything else!
        
        // ============ INPUT CAPTURE USING composedPath ============
        // This captures inputs from Shadow DOM (like App Launcher search)
        // Also captures contenteditable elements (like Salesforce Chatter rich text)
        window.addEventListener('input', function(e) {
          try {
            const path = e.composedPath ? e.composedPath() : [e.target];
            let input = null;
            let isContentEditable = false;
            
            // Find the input element from composedPath
            for (const el of path) {
              if (!el || !el.tagName) continue;
              const tag = el.tagName.toLowerCase();
              if (tag === 'input' || tag === 'textarea') {
                input = el;
                break;
              }
              // Also capture contenteditable elements (rich text editors like Chatter)
              if (el.getAttribute && el.getAttribute('contenteditable') === 'true') {
                input = el;
                isContentEditable = true;
                break;
              }
              // Check for role="textbox" (Lightning components)
              if (el.getAttribute && el.getAttribute('role') === 'textbox') {
                input = el;
                isContentEditable = true;
                break;
              }
              // Salesforce Chatter rich text editor (ql-editor / Quill-based)
              if (el.classList && (el.classList.contains('ql-editor') || el.classList.contains('slds-rich-text-area__content') || el.classList.contains('cke_editable'))) {
                input = el;
                isContentEditable = true;
                break;
              }
            }
            
            if (!input) return;
            
            // For regular inputs, skip non-text types
            if (!isContentEditable) {
              const type = (input.type || '').toLowerCase();
              if (['checkbox','radio','submit','button','file','hidden'].includes(type)) return;
            }
            
            // Get value - handle both regular inputs and contenteditable
            const value = isContentEditable 
              ? (input.textContent || input.innerText || '').trim()
              : (input.value || '');
            if (!value) return;
            
            // Create unique key for this input
            const key = (input.id || '') + '|' + (input.name || '') + '|' + (input.placeholder || '') + '|' + (input.getAttribute('aria-label') || '');
            
            // Get additional context for better differentiation
            // Find associated label text
            var associatedLabel = '';
            var formId = '';
            var formAction = '';
            var sectionContext = '';
            
            try {
              // Find label via for attribute
              if (input.id) {
                var labelEl = document.querySelector('label[for="' + input.id + '"]');
                if (labelEl) associatedLabel = (labelEl.textContent || '').trim();
              }
              
              // Find label via parent
              if (!associatedLabel) {
                var parentLabel = input.closest('label');
                if (parentLabel) {
                  // Get text excluding the input value
                  associatedLabel = (parentLabel.textContent || '').replace(input.value || '', '').trim();
                }
              }
              
              // Find nearby label (sibling or parent's label)
              if (!associatedLabel) {
                var parent = input.parentElement;
                if (parent) {
                  var nearbyLabel = parent.querySelector('label, .label, [class*="label"]');
                  if (nearbyLabel) associatedLabel = (nearbyLabel.textContent || '').trim();
                }
              }
              
              // Get form context
              var form = input.closest('form');
              if (form) {
                formId = form.id || '';
                formAction = form.getAttribute('action') || '';
              }
              
              // Get section/container context for disambiguation
              var section = input.closest('section, [role="region"], [role="form"], .card, .panel, .modal, .dialog, header, footer, aside, nav, main, .cart, .checkout, .search');
              if (section) {
                sectionContext = section.getAttribute('aria-label') || 
                                 section.getAttribute('data-testid') ||
                                 section.id ||
                                 section.className.split(' ').filter(c => c && c.length < 30 && !c.includes('--'))[0] || '';
              }
            } catch(e) {}
            
            // Store/update pending input with enhanced context
            const tagName = (input.tagName || '').toLowerCase();
            window.__flowstralCDPInputs[key] = {
              timestamp: Date.now(),
              tag: isContentEditable ? 'contenteditable' : tagName,
              type: isContentEditable ? 'richtext' : (input.type || '').toLowerCase(),
              value: value,
              id: input.id || '',
              name: input.name || input.getAttribute('name') || '',
              placeholder: input.placeholder || input.getAttribute('placeholder') || '',
              ariaLabel: input.getAttribute('aria-label') || '',
              title: input.getAttribute('title') || '',
              role: input.getAttribute('role') || '',
              // HIGHEST PRIORITY: data-testid for stable selectors
              testId: input.getAttribute('data-testid') || '',
              dataTestId: input.getAttribute('data-test-id') || input.getAttribute('data-testid') || '',
              dataTest: input.getAttribute('data-test') || '',
              dataCy: input.getAttribute('data-cy') || '',
              fromShadow: path.some(p => p.nodeType === 11),
              key: key,
              isContentEditable: isContentEditable,
              // NEW: Additional context for disambiguation
              label: associatedLabel,
              formId: formId,
              formAction: formAction,
              sectionContext: sectionContext
            };
          } catch(err) {}
        }, true);
        
        // Helper to flush an input immediately
        function flushInput(input) {
          if (!input) return;
          
          // Check if it's a contenteditable element
          const isContentEditable = input.getAttribute && 
            (input.getAttribute('contenteditable') === 'true' || input.getAttribute('role') === 'textbox');
          
          // Get value based on element type
          const value = isContentEditable 
            ? (input.textContent || input.innerText || '').trim()
            : (input.value || '');
          
          if (!value) return;
          
          // For regular inputs, skip non-text types
          if (!isContentEditable) {
            const type = (input.type || '').toLowerCase();
            if (['checkbox','radio','submit','button','file','hidden'].includes(type)) return;
          }
          
          // ═══════════════════════════════════════════════════════════════
          // HONEYPOT DETECTION: Skip spam trap/bot detection fields
          // These are hidden fields designed to catch bots
          // ═══════════════════════════════════════════════════════════════
          const inputName = (input.name || '').toLowerCase();
          const inputId = (input.id || '').toLowerCase();
          const inputClass = (input.className || '').toLowerCase();
          
          // Common honeypot field names
          const honeypotPatterns = [
            'honeypot', 'honey-pot', 'honey_pot',
            'spamfilter', 'spam-filter', 'spam_filter', 'spam',
            'bot', 'botcheck', 'bot-check', 'bot_check', 'botfield',
            'trap', 'spamtrap', 'spam-trap',
            'website', 'url', 'homepage',  // Often used as honeypots
            'fax', 'faxnumber',  // Rarely used by humans
            'hp', 'hpfield', 'hp_field',
            'captcha_text', 'nocaptcha',
            'leave-blank', 'leave_blank', 'leaveblank'
          ];
          
          for (const pattern of honeypotPatterns) {
            if (inputName.includes(pattern) || inputId.includes(pattern)) {
              console.log('[Flowstral] 🍯 Skipping honeypot field:', inputName || inputId);
              return;
            }
          }
          
          // Check if element is hidden via CSS (common honeypot technique)
          try {
            const style = window.getComputedStyle(input);
            const rect = input.getBoundingClientRect();
            
            // Skip if not visible
            if (style.display === 'none' || 
                style.visibility === 'hidden' || 
                style.opacity === '0' ||
                rect.width === 0 || 
                rect.height === 0 ||
                rect.left < -1000 || rect.top < -1000) {
              console.log('[Flowstral] 🍯 Skipping hidden/off-screen field:', inputName || inputId);
              return;
            }
            
            // Skip fields with very small dimensions (likely hidden)
            if (rect.width < 5 || rect.height < 5) {
              console.log('[Flowstral] 🍯 Skipping tiny field (likely hidden):', inputName || inputId);
              return;
            }
          } catch (e) {
            // If we can't check visibility, continue cautiously
          }
          
          // Check for honeypot via tabindex=-1 and autocomplete="off" combo
          if (input.tabIndex === -1 && input.autocomplete === 'off') {
            console.log('[Flowstral] 🍯 Skipping likely honeypot (tabindex=-1, autocomplete=off):', inputName || inputId);
            return;
          }
          
          const key = (input.id || '') + '|' + (input.name || '') + '|' + (input.placeholder || '') + '|' + (input.getAttribute('aria-label') || '');
          
          // Mark this input for immediate flush
          if (window.__flowstralCDPInputs[key]) {
            window.__flowstralCDPInputs[key].shouldFlush = true;
            window.__flowstralCDPInputs[key].value = input.value;
            
            // Also report via console immediately (backup for cross-domain navigation)
            console.log('__FLOWSTRAL_INPUT__:' + JSON.stringify(window.__flowstralCDPInputs[key]));
          } else {
            // Create and immediately flush if not exists
            var newInput = {
              timestamp: Date.now(),
              tag: 'input',
              type: type,
              value: input.value,
              id: input.id || '',
              name: input.name || input.getAttribute('name') || '',
              placeholder: input.placeholder || input.getAttribute('placeholder') || '',
              ariaLabel: input.getAttribute('aria-label') || '',
              title: input.getAttribute('title') || '',
              fromShadow: true,
              key: key,
              shouldFlush: true
            };
            window.__flowstralCDPInputs[key] = newInput;
            console.log('__FLOWSTRAL_INPUT__:' + JSON.stringify(newInput));
          }
        }
        
        // Capture on focusout to flush input (including contenteditable)
        window.addEventListener('focusout', function(e) {
          try {
            const path = e.composedPath ? e.composedPath() : [e.target];
            let input = null;
            
            for (const el of path) {
              if (!el || !el.tagName) continue;
              const tag = el.tagName.toLowerCase();
              if (tag === 'input' || tag === 'textarea') {
                input = el;
                break;
              }
              // Also handle contenteditable elements (rich text editors)
              if (el.getAttribute && (el.getAttribute('contenteditable') === 'true' || el.getAttribute('role') === 'textbox')) {
                input = el;
                break;
              }
            }
            
            flushInput(input);
          } catch(err) {}
        }, true);
        
        // Also capture on 'change' event (fires when input value changes and loses focus)
        window.addEventListener('change', function(e) {
          try {
            const path = e.composedPath ? e.composedPath() : [e.target];
            let input = null;
            
            for (const el of path) {
              if (!el || !el.tagName) continue;
              const tag = el.tagName.toLowerCase();
              if (tag === 'input' || tag === 'textarea') {
                input = el;
                break;
              }
              // Also handle contenteditable elements
              if (el.getAttribute && (el.getAttribute('contenteditable') === 'true' || el.getAttribute('role') === 'textbox')) {
                input = el;
                break;
              }
            }
            
            flushInput(input);
          } catch(err) {}
        }, true);
    })();
    `;
}

module.exports = { getClickCaptureScript };
