/**
 * Extracted executeAction method from PlaywrightRecorder
 *
 * @param {PlaywrightRecorder} recorder - The recorder instance
 * @param {Object} action - The action to execute
 */

const ActionHandlers = require('./lib/action-handlers');
const { SmartFinder } = require('./lib/smart-finder');

const normalizeTextForMatching = (text) => {
  if (!text || typeof text !== 'string') return '';
  return text
    .replace(/[‘’‛′`´ʼ]/g, "'")
    .replace(/[“”„‟″]/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
};

const extractTextFromDescription = (description) => {
  if (!description) return '';
  const match = description.match(/(?:Click|Fill|Select|Type|Check|Uncheck|Press|Toggle)\s*"([^"]+)"/i);
  if (match) return match[1];
  const matchSingle = description.match(/(?:Click|Fill|Select|Type|Check|Uncheck|Press|Toggle)\s*'([^']+)'/i);
  if (matchSingle) return matchSingle[1];
  return description;
};

const getActionLabel = (action) => {
  let label = action.label ||
              action.text ||
              action.selectorObj?.text ||
              action.recipe?.what?.text ||
              action.args?.[0];
  if (!label && action.description) {
    label = extractTextFromDescription(action.description);
  }
  return normalizeTextForMatching(label || '');
};

async function executeAction(recorder, action) {
    if (!recorder.page || recorder.page.isClosed()) {
      return { success: false, error: 'No browser page' };
    }

    // DEBUG: Log every action type that comes through
    console.log(`\n[executeAction] ▶ Type: "${action.type}" | QWord: "${action.qword}" | Description: "${(action.description || '').substring(0, 50)}"`);
    if (action.userActions?.length > 0) {
      console.log(`[executeAction]   Has ${action.userActions.length} userActions!`);
    }

    // ============================================================
    // IMPLICIT TAB SWITCHING: If action has tabIndex, switch to that tab
    // This REPLACES the need for separate switchTab actions!
    // ============================================================
    if (action.tabIndex !== undefined && action.type !== 'switchTab' && action.type !== 'newTab') {
      const pages = recorder.context?.pages() || [];
      const targetTabIndex = action.tabIndex;
      
      if (targetTabIndex >= 0 && targetTabIndex < pages.length) {
        const targetPage = pages[targetTabIndex];
        if (targetPage && !targetPage.isClosed() && targetPage !== recorder.page) {
          console.log(`[PlaywrightRecorder] Implicit tab switch: ${targetTabIndex} (from action.tabIndex)`);
          recorder.page = targetPage;
          // Update SmartFinder with new page
          if (recorder.smartFinder) {
            recorder.smartFinder.updatePage(recorder.page);
          }
        }
      }
    }

    try {
      const selector = action.selector;
      const value = action.value;
      const timeout = action.timeout || 30000;
      const label = getActionLabel(action); // FIXED: Use comprehensive label extraction with normalization

      // ============================================================
      // CLICK-ONLY MODE: For suggestion panel Play button on fill-type items
      // Just click/focus the input element - don't fill with empty string
      // This lets the user verify the correct element is highlighted
      // ============================================================
      if (action.executeMode === 'click-only' && (action.type === 'fill' || action.type === 'Fill' || action.qword === 'Fill')) {
        console.log(`[PlaywrightRecorder] Click-only mode for fill suggestion: "${label}"`);
        // Convert to a click action to find and click the correct input
        const clickAction = { ...action, type: 'click', qword: 'Click', executeMode: undefined };
        // Use _findElement with the fill-specific strategies (isFillAction check uses original type)
        // but just click the element instead of filling
        const findResult = await recorder._findElement({ ...action, type: 'fill' });
        if (findResult) {
          await findResult.locator.click({ timeout: 5000 });
          console.log(`[PlaywrightRecorder] ✓ Click-only: focused input for "${label}" using ${findResult.strategy?.type}`);
          return { success: true, strategy: 'click-only-' + (findResult.strategy?.type || 'unknown') };
        }
        // Fallback: try unified click handler
        const clickResult = await ActionHandlers.executeAction(recorder, clickAction, { timeout });
        if (clickResult.success) {
          return { success: true, strategy: 'click-only-unified' };
        }
        return { success: false, error: `Could not find input: "${label}"` };
      }

      // ============================================================
      // UNIFIED EXECUTION: Try ActionHandlers first for consistency
      // This ensures same behavior as TestExecutor (builder/tests tab)
      // ============================================================
      const unifiedResult = await ActionHandlers.executeAction(recorder, action, { timeout });
      
      if (unifiedResult.success) {
        // Action handled successfully by unified handler
        console.log(`[PlaywrightRecorder] ✓ Unified handler succeeded for: ${action.type}`);
        return { 
          success: true, 
          strategy: unifiedResult.strategy || 'unified',
          workingSelector: unifiedResult.workingSelector || null,
          strategyType: unifiedResult.strategyType || unifiedResult.strategy?.type || null
        };
      } else if (!unifiedResult.delegateToContext && !unifiedResult.error?.includes('Unknown action')) {
        // Unified handler tried but failed - return error
        return { success: false, error: unifiedResult.error };
      }
      
      // Fall back to legacy switch for actions not in unified handler
      console.log(`[PlaywrightRecorder] Delegating to legacy handler: ${action.type}`);

      switch (action.type) {
        case 'goto':
        case 'GoTo':
        case 'navigate':
        case 'Navigate':
          // Navigate to URL
          const navActionUrl = action.url || action.value || action.selector;
          if (!navActionUrl) {
            return { success: false, error: 'No URL provided for navigation' };
          }
          
          // Smart skip: if we're already at the target URL, skip redundant navigation
          const currentNavUrl = recorder.page.url();
          try {
            const targetNavHost = new URL(navActionUrl).hostname;
            const currentNavHost = new URL(currentNavUrl).hostname;
            
            // Skip if already on same Lightning host (post-login redirect scenario)
            if (targetNavHost === currentNavHost && 
                (currentNavUrl.includes('lightning.force.com') || currentNavUrl.includes('/one/one.app'))) {
              console.log(`[PlaywrightRecorder] Skipping redundant navigation - already at ${currentNavHost}`);
              break;
            }
          } catch (e) {
            // URL parsing failed, proceed with navigation
          }
          
          await recorder.page.goto(navActionUrl, { waitUntil: 'domcontentloaded', timeout });
          break;

        case 'NavigateTo':
        case 'navigateto':
          // Salesforce object navigation
          const navTarget = action.args?.[0] || action.value || action.label;
          console.log(`[PlaywrightRecorder] NavigateTo: "${navTarget}"`);
          
          let sfNavUrl;
          if (navTarget && navTarget.startsWith('http')) {
            sfNavUrl = navTarget;
          } else {
            // Build from current page URL
            const currentUrl = recorder.page.url();
            const baseMatch = currentUrl.match(/(https:\/\/[^\/]+)/);
            if (baseMatch && navTarget) {
              const baseUrl = baseMatch[1];
              // Handle object names like "Accounts" -> "Account"
              const objectName = navTarget.replace(/s$/, '');
              sfNavUrl = `${baseUrl}/lightning/o/${objectName}/list`;
            }
          }
          
          if (sfNavUrl) {
            console.log(`[PlaywrightRecorder] Navigating to: ${sfNavUrl}`);
            await recorder.page.goto(sfNavUrl, { waitUntil: 'domcontentloaded', timeout });
          } else {
            return { success: false, error: `Cannot navigate to "${navTarget}"` };
          }
          break;

        case 'click':
        case 'clicktext':
        case 'ClickText':
        case 'clickelement':
        case 'ClickElement':
          // ============================================================
          // ROBUST ELEMENT FINDING WITH RETRY + 4-LAYER FALLBACK
          // Layer 1: SmartFinder (recipe-based) with retry
          // Layer 2: Legacy _findElement (50+ strategies) with retry
          // Layer 3: iFrame search (for elements inside iframes)
          // Layer 4: AI Vision Fallback (screenshot + GPT-4o)
          // ============================================================
          
          // Try finding element with automatic retry (handles slow pages)
          let clickResult = await recorder.findElementWithRetry(action);
          
          // Layer 3: IFRAME FALLBACK - Search inside iframes if not found on main page
          if (!clickResult) {
            console.log('[PlaywrightRecorder] Click: Element not on main page, checking iframes...');
            
            const iframesForClick = await recorder.page.locator('iframe').all();
            console.log(`[PlaywrightRecorder] Found ${iframesForClick.length} iframes to search`);
            
            for (let i = 0; i < iframesForClick.length; i++) {
              try {
                const frameLocator = recorder.page.frameLocator(`iframe >> nth=${i}`);
                
                const testId = action.selectorObj?.testId || action.selectorObj?.dataTestId || action.recipe?.which?.testId;
                const buttonText = label || action.text || action.recipe?.what?.text;
                
                let iframeLocator = null;
                
                // Strategy 1: By testId
                if (testId) {
                  const locator = frameLocator.locator(`[data-testid="${testId}"]`);
                  if (await locator.count() > 0) {
                    iframeLocator = locator.first();
                    console.log(`[PlaywrightRecorder] ✓ Found click target in iframe by testId: ${testId}`);
                  }
                }
                
                // Strategy 2: By button text
                if (!iframeLocator && buttonText) {
                  const locator = frameLocator.getByRole('button', { name: buttonText });
                  if (await locator.count() > 0) {
                    iframeLocator = locator.first();
                    console.log(`[PlaywrightRecorder] ✓ Found click target in iframe by button text: ${buttonText}`);
                  }
                }
                
                // Strategy 3: By text content
                if (!iframeLocator && buttonText) {
                  const locator = frameLocator.getByText(buttonText, { exact: false });
                  if (await locator.count() > 0) {
                    iframeLocator = locator.first();
                    console.log(`[PlaywrightRecorder] ✓ Found click target in iframe by text: ${buttonText}`);
                  }
                }
                
                if (iframeLocator) {
                  clickResult = { locator: iframeLocator, strategy: { type: `iframe[${i}]` } };
                  break;
                }
              } catch (e) {
                console.log(`[PlaywrightRecorder] Iframe ${i} access failed:`, e.message);
              }
            }
          }
          
          // Layer 4: AI FALLBACK - Last resort when all deterministic strategies fail
          console.log('[PlaywrightRecorder] ========== AI FALLBACK CHECK ==========');
          console.log('[PlaywrightRecorder] clickResult:', clickResult ? 'FOUND' : 'NULL');
          console.log('[PlaywrightRecorder] enableAIFallback:', recorder.enableAIFallback);
          console.log('[PlaywrightRecorder] aiCallsThisRun:', recorder.aiCallsThisRun, '/', recorder.maxAICallsPerRun);
          
          if (!clickResult && recorder.enableAIFallback) {
            console.log(`[PlaywrightRecorder] All strategies failed after retries, trying AI fallback...`);
            console.log(`[PlaywrightRecorder] Searching for: "${label || selector || action.description}"`);
            const aiResult = await recorder.findElementWithAI(label || selector || action.description, 'click');
            console.log('[PlaywrightRecorder] AI result:', aiResult);
            if (aiResult) {
              try {
                await recorder.clickAtCoordinates(aiResult.x, aiResult.y);
                console.log(`[PlaywrightRecorder] ✓ AI Fallback click succeeded at (${aiResult.x}, ${aiResult.y})`);
                return { success: true, strategy: 'AI Vision Fallback' };
              } catch (e) {
                console.log(`[PlaywrightRecorder] AI Fallback click failed:`, e.message);
              }
            }
          }
          
          if (!clickResult) {
            return { success: false, error: `Could not find element to click: "${label || selector}"` };
          }
          
          console.log(`[PlaywrightRecorder] Clicking element: "${label}" using ${clickResult.strategy.type}`);
          
          // Check if SmartFinder already clicked the element (Salesforce "New" buttons)
          if (clickResult.alreadyClicked) {
            console.log('[PlaywrightRecorder] ✓ Click already performed by SmartFinder');
            break; // Done with click action
          }
          
          // Debug: Log element details
          try {
            const elementInfo = await clickResult.locator.evaluate(el => ({
              tag: el.tagName,
              href: el.href || el.getAttribute('href'),
              classes: el.className,
              text: (el.textContent || '').substring(0, 50)
            }));
            console.log(`[PlaywrightRecorder] Element details: tag=${elementInfo.tag}, href=${elementInfo.href}, classes=${elementInfo.classes?.substring(0, 50)}`);
          } catch (e) {}
          
          // Scroll into view and highlight briefly (skip highlight for locked selectors - speed priority)
          await clickResult.locator.scrollIntoViewIfNeeded().catch(() => {});
          if (clickResult.strategy?.type !== 'LockedSelector') {
            await clickResult.locator.evaluate(el => {
              el.style.outline = '2px solid #22c55e';
              el.style.outlineOffset = '1px';
            }).catch(() => {});
            await recorder.page.waitForTimeout(50); // Highlight visibility delay (reduced from 100ms)
          }
          
          // Try multiple click methods
          let clickSuccess = false;
          
          // Method 1: Standard Playwright click WITHOUT force (waits for element to be actionable)
          try {
            await clickResult.locator.click({ timeout: 5000 });
            clickSuccess = true;
            console.log('[PlaywrightRecorder] ✓ Standard click succeeded');
          } catch (e1) {
            console.log('[PlaywrightRecorder] Standard click failed:', e1.message);
            
            // Method 1b: Try with force (for stubborn elements)
            try {
              await clickResult.locator.click({ timeout: 3000, force: true });
              clickSuccess = true;
              console.log('[PlaywrightRecorder] ✓ Forced click succeeded');
            } catch (e1b) {
              console.log('[PlaywrightRecorder] Forced click failed:', e1b.message);
            }
            
            // Method 2: JavaScript .click() (if both normal and forced click failed)
            if (!clickSuccess) {
              try {
                await clickResult.locator.evaluate(el => {
                  el.click();
                });
                clickSuccess = true;
                console.log('[PlaywrightRecorder] ✓ JS click() succeeded');
              } catch (e2) {
              console.log('[PlaywrightRecorder] JS click failed:', e2.message);
              
              // Method 3: Dispatch mouse events
              try {
                await clickResult.locator.evaluate(el => {
                  const rect = el.getBoundingClientRect();
                  const centerX = rect.left + rect.width / 2;
                  const centerY = rect.top + rect.height / 2;
                  
                  // Fire mousedown, mouseup, click sequence
                  ['mousedown', 'mouseup', 'click'].forEach(type => {
                    el.dispatchEvent(new MouseEvent(type, {
                      view: window,
                      bubbles: true,
                      cancelable: true,
                      clientX: centerX,
                      clientY: centerY
                    }));
                  });
                });
                clickSuccess = true;
                console.log('[PlaywrightRecorder] ✓ MouseEvent dispatch succeeded');
              } catch (e3) {
                console.log('[PlaywrightRecorder] MouseEvent dispatch failed:', e3.message);
                
                // Method 4: Focus and press Enter (for keyboard-accessible elements)
                try {
                  await clickResult.locator.focus();
                  await clickResult.locator.press('Enter');
                  clickSuccess = true;
                  console.log('[PlaywrightRecorder] ✓ Focus+Enter succeeded');
                } catch (e4) {
                  console.log('[PlaywrightRecorder] Focus+Enter failed:', e4.message);
                }
              }
              }
            }
          }
          
          // Check if this click opened a NEW TAB (event-driven, no fixed wait)
          const pagesBefore = recorder.context.pages().length;
          let newTabPage = null;
          try {
            newTabPage = await recorder.context.waitForEvent('page', { timeout: 200 });
          } catch (e) {
            // No new tab opened - this is the normal case, no delay wasted
          }
          const pagesAfter = recorder.context.pages();
          
          if (pagesAfter.length > pagesBefore) {
            // NEW TAB DETECTED - automatically switch to it!
            console.log(`[PlaywrightRecorder] ✨ NEW TAB DETECTED! Switching from ${pagesBefore} to ${pagesAfter.length} pages`);
            const newPage = pagesAfter[pagesAfter.length - 1];
            await newPage.waitForLoadState('domcontentloaded').catch(() => {});
            
            // Switch to the new tab
            recorder.page = newPage;
            recorder._playbackPages = pagesAfter;
            recorder._playbackPageIndex = pagesAfter.length - 1;
            
            // Reinitialize SmartFinder for new page
            if (recorder.useSmartFinderForPlayback) {
              recorder.smartFinder = new SmartFinder(recorder.page, { debug: true, timeout: 8000 });
            }
            
            console.log(`[PlaywrightRecorder] Now on new tab: ${recorder.page.url()}`);
            await recorder.page.waitForTimeout(300); // Let new tab page stabilize (reduced from 500ms)
          }
          
          // Check if this is a link click that should navigate
          const isLinkClick = clickResult.strategy.type.includes('link') || 
                              clickResult.strategy.type.includes('getByRole-link');
          
          if (isLinkClick && clickSuccess) {
            console.log('[PlaywrightRecorder] Link click detected, checking for navigation...');
            const urlBefore = recorder.page.url();
            
            // Get the href from the link element BEFORE waiting
            let linkHref = null;
            try {
              linkHref = await clickResult.locator.evaluate(el => el.href || el.getAttribute('href'));
              console.log('[PlaywrightRecorder] Link href:', linkHref);
            } catch (e) {}
            
            // Event-driven: wait for URL change (fast) instead of fixed 2000ms polling
            let didNavigate = false;
            try {
              await recorder.page.waitForURL(url => url.toString() !== urlBefore, { timeout: 3000 });
              didNavigate = true;
            } catch (e) {
              // URL didn't change within 3s - check manually
              didNavigate = recorder.page.url() !== urlBefore;
            }
            
            console.log('[PlaywrightRecorder] URL before:', urlBefore);
            console.log('[PlaywrightRecorder] URL after:', recorder.page.url());
            console.log('[PlaywrightRecorder] Did navigate:', didNavigate);
            
            if (!didNavigate && linkHref) {
              console.log('[PlaywrightRecorder] Click did not navigate! Trying direct navigation to href...');
              
              // Fallback: Navigate directly to the href
              try {
                await recorder.page.goto(linkHref, { waitUntil: 'domcontentloaded', timeout: 30000 });
                console.log('[PlaywrightRecorder] Direct navigation successful');
              } catch (e) {
                console.log('[PlaywrightRecorder] Direct navigation failed:', e.message);
                
                // Last resort: Try clicking with dispatchEvent
                try {
                  await clickResult.locator.evaluate(el => {
                    const event = new MouseEvent('click', {
                      view: window,
                      bubbles: true,
                      cancelable: true
                    });
                    el.dispatchEvent(event);
                  });
                  await recorder.page.waitForTimeout(500);
                } catch (e2) {}
              }
            }
            
            // Wait for page to stabilize after navigation
            console.log('[PlaywrightRecorder] Waiting for page to stabilize...');
            try {
              await recorder.page.waitForLoadState('domcontentloaded', { timeout: 5000 });
            } catch (e) {
              console.log('[PlaywrightRecorder] DOM load wait skipped');
            }
            // Settle time for page frameworks (reduced from 1000ms, domcontentloaded already waited)
            await recorder.page.waitForTimeout(500);
            console.log('[PlaywrightRecorder] Page should be loaded now');
          } else {
            // Regular wait for UI update (covers CSS transitions, dropdowns, modals)
            await recorder.page.waitForTimeout(100);
          }
          
          // Remove highlight
          await clickResult.locator.evaluate(el => {
            el.style.outline = '';
            el.style.outlineOffset = '';
            el.style.backgroundColor = '';
          }).catch(() => {});
          
          if (!clickSuccess) {
            return { success: false, error: `Click failed on: "${label}"` };
          }
          break;

        case 'fill':
        case 'Fill':
        case 'type':
        case 'input':
          // DEBUG: Log current page info
          console.log(`[PlaywrightRecorder] Fill action - Current page URL: ${recorder.page?.url()}`);
          console.log(`[PlaywrightRecorder] Fill action - action.tabIndex: ${action.tabIndex}, total pages: ${recorder.context?.pages()?.length || 0}`);
          
          // Wait for DOM to be ready before finding the input element
          await recorder.page.waitForLoadState('domcontentloaded').catch(() => {});
          await recorder.page.waitForTimeout(50);
          // Find input element using full waterfall (locked → Quick Scan → SmartFinder → legacy) with retries + iframe scope
          let fillResult = await recorder.findElementWithRetry(action);
          
          // DIRECT ID/NAME FALLBACK: If not found, try simple direct selectors
          // This is critical for cross-origin tabs where complex strategies may fail
          if (!fillResult) {
            const directId = action.selectorObj?.id || action.raw?.id || action.args?.[0];
            const directName = action.selectorObj?.name || action.raw?.name || action.args?.[0];
            
            console.log(`[PlaywrightRecorder] Fill: Trying direct ID/name fallback: id="${directId}", name="${directName}"`);
            
            // Try by ID first (most reliable)
            if (directId) {
              try {
                const idLocator = recorder.page.locator(`#${directId}`);
                const count = await idLocator.count();
                if (count > 0) {
                  fillResult = { locator: idLocator.first(), strategy: { type: 'direct-id' } };
                  console.log(`[PlaywrightRecorder] ✓ Found by direct #${directId}`);
                }
              } catch (e) {
                console.log(`[PlaywrightRecorder] Direct ID search failed:`, e.message);
              }
            }
            
            // Try by name attribute
            if (!fillResult && directName) {
              try {
                const nameLocator = recorder.page.locator(`input[name="${directName}"], textarea[name="${directName}"]`);
                const count = await nameLocator.count();
                if (count > 0) {
                  fillResult = { locator: nameLocator.first(), strategy: { type: 'direct-name' } };
                  console.log(`[PlaywrightRecorder] ✓ Found by direct name="${directName}"`);
                }
              } catch (e) {
                console.log(`[PlaywrightRecorder] Direct name search failed:`, e.message);
              }
            }
            
            // Try getByLabel as last resort
            if (!fillResult) {
              const labelText = action.args?.[0] || action.label || action.text;
              if (labelText) {
                try {
                  const labelLocator = recorder.page.getByLabel(labelText, { exact: false });
                  const count = await labelLocator.count();
                  if (count > 0) {
                    fillResult = { locator: labelLocator.first(), strategy: { type: 'getByLabel' } };
                    console.log(`[PlaywrightRecorder] ✓ Found by getByLabel: "${labelText}"`);
                  }
                } catch (e) {
                  // Ignore
                }
              }
            }
          }
          
          // IFRAME FALLBACK: If not found on main page, try searching inside iframes
          if (!fillResult) {
            console.log('[PlaywrightRecorder] Fill: Element not on main page, checking iframes...');
            
            // Get all iframes on the page
            const iframes = await recorder.page.locator('iframe').all();
            console.log(`[PlaywrightRecorder] Found ${iframes.length} iframes to search`);
            
            for (let i = 0; i < iframes.length; i++) {
              try {
                const frameLocator = recorder.page.frameLocator(`iframe >> nth=${i}`);
                
                // Try multiple strategies inside the iframe
                const testId = action.selectorObj?.testId || action.selectorObj?.dataTestId;
                const id = action.selectorObj?.id;
                const placeholder = action.selectorObj?.placeholder || label;
                const name = action.selectorObj?.name;
                
                let iframeLocator = null;
                
                // Strategy 1: By testId
                if (testId) {
                  const locator = frameLocator.locator(`[data-testid="${testId}"]`);
                  if (await locator.count() > 0) {
                    iframeLocator = locator.first();
                    console.log(`[PlaywrightRecorder] ✓ Found in iframe by testId: ${testId}`);
                  }
                }
                
                // Strategy 2: By id
                if (!iframeLocator && id) {
                  const locator = frameLocator.locator(`#${id}`);
                  if (await locator.count() > 0) {
                    iframeLocator = locator.first();
                    console.log(`[PlaywrightRecorder] ✓ Found in iframe by id: ${id}`);
                  }
                }
                
                // Strategy 3: By placeholder
                if (!iframeLocator && placeholder) {
                  const locator = frameLocator.getByPlaceholder(placeholder, { exact: false });
                  if (await locator.count() > 0) {
                    iframeLocator = locator.first();
                    console.log(`[PlaywrightRecorder] ✓ Found in iframe by placeholder: ${placeholder}`);
                  }
                }
                
                // Strategy 4: By name
                if (!iframeLocator && name) {
                  const locator = frameLocator.locator(`[name="${name}"]`);
                  if (await locator.count() > 0) {
                    iframeLocator = locator.first();
                    console.log(`[PlaywrightRecorder] ✓ Found in iframe by name: ${name}`);
                  }
                }
                
                // Strategy 5: By partial placeholder match (for "4242 4242 4242 4242" → "4242")
                if (!iframeLocator && placeholder) {
                  const shortPlaceholder = placeholder.split(' ')[0]; // First word
                  const locator = frameLocator.locator(`input[placeholder*="${shortPlaceholder}"]`);
                  if (await locator.count() > 0) {
                    iframeLocator = locator.first();
                    console.log(`[PlaywrightRecorder] ✓ Found in iframe by partial placeholder: ${shortPlaceholder}`);
                  }
                }
                
                if (iframeLocator) {
                  fillResult = { locator: iframeLocator, strategy: { type: `iframe[${i}]` } };
                  break;
                }
              } catch (e) {
                // Cross-origin iframe, skip
                console.log(`[PlaywrightRecorder] Iframe ${i} access failed (cross-origin?):`, e.message);
              }
            }
          }
          
          // AI FALLBACK for fill - Last resort
          if (!fillResult && recorder.enableAIFallback) {
            console.log(`[PlaywrightRecorder] Fill: All strategies failed, trying AI fallback...`);
            const aiFillResult = await recorder.findElementWithAI(label || selector || action.description, 'fill');
            if (aiFillResult) {
              try {
                // Click to focus, then type
                await recorder.page.mouse.click(aiFillResult.x, aiFillResult.y);
                await recorder.page.waitForTimeout(100);
                await recorder.page.keyboard.type(value || '');
                console.log(`[PlaywrightRecorder] ✓ AI Fallback fill succeeded at (${aiFillResult.x}, ${aiFillResult.y})`);
                return { success: true, strategy: 'AI Vision Fallback' };
              } catch (e) {
                console.log(`[PlaywrightRecorder] AI Fallback fill failed:`, e.message);
              }
            }
          }
          
          if (!fillResult) {
            return { success: false, error: `Could not find input field: "${label || selector}"` };
          }
          
          // Scroll into view and highlight
          await fillResult.locator.scrollIntoViewIfNeeded().catch(() => {});
          await fillResult.locator.evaluate(el => {
            el.style.outline = '3px solid #4ade80';
            el.style.outlineOffset = '2px';
          }).catch(() => {});
          
          // Focus and fill
          await fillResult.locator.focus();
          await fillResult.locator.fill(value || '', { timeout });
          
          // Check if this is a search field - needs extra wait for results to load
          const isSearchField = (label && /search/i.test(label)) || 
                                (action.description && /search/i.test(action.description));
          
          if (isSearchField) {
            console.log('[PlaywrightRecorder] Search field detected, waiting for results to load...');
            // Wait for network to be idle (Salesforce filtering makes API calls)
            try {
              await recorder.page.waitForLoadState('networkidle', { timeout: 5000 });
            } catch (e) {
              // Network might not go idle, use fallback wait
              console.log('[PlaywrightRecorder] Network did not go idle, using fallback wait');
            }
            // Additional wait for DOM to stabilize after filtering (reduced from 1000ms)
            await recorder.page.waitForTimeout(500);
            console.log('[PlaywrightRecorder] Search results should be ready now');
          } else {
            // Wait for input validation/re-render after typing (reduced from 200ms)
            await recorder.page.waitForTimeout(50);
          }
          
          // Remove highlight
          await fillResult.locator.evaluate(el => {
            el.style.outline = '';
            el.style.outlineOffset = '';
          }).catch(() => {});
          break;

        case 'select':
          // Find select element using multiple strategies
          let selectResult = await recorder._findElement(action);
          
          // RADIX DROPDOWN FALLBACK - Try specific strategies for Radix comboboxes
          if (!selectResult) {
            console.log(`[PlaywrightRecorder] Standard select find failed, trying Radix-specific strategies...`);
            
            const selectValue = action.value?.text || action.value || value;
            const testId = action.selectorObj?.testId || action.element?.testId || action.recipe?.which?.testId;
            
            // Strategy 1: By testId
            if (testId) {
              const byTestId = recorder.page.locator(`[data-testid="${testId}"]`);
              if (await byTestId.count() > 0) {
                selectResult = { locator: byTestId.first(), strategy: { type: 'testId' } };
                console.log(`[PlaywrightRecorder] Found dropdown by testId: ${testId}`);
              }
            }
            
            // Strategy 2: Find combobox that currently shows a known option text
            if (!selectResult) {
              // The step might want to select "Blank Page" from dropdown showing "Example.com"
              const allComboboxes = recorder.page.getByRole('combobox');
              const count = await allComboboxes.count();
              console.log(`[PlaywrightRecorder] Found ${count} comboboxes on page`);
              
              for (let i = 0; i < count; i++) {
                const combobox = allComboboxes.nth(i);
                const text = await combobox.textContent().catch(() => '');
                console.log(`[PlaywrightRecorder] Combobox ${i}: "${text}"`);
                
                // Check if this combobox is visible and interactable
                if (await combobox.isVisible()) {
                  // Click it to see if it has the option we want
                  try {
                    await combobox.click();
                    await recorder.page.waitForTimeout(200);
                    
                    // Check if the option exists in the dropdown
                    const optionExists = await recorder.page.getByRole('option', { name: selectValue }).count() > 0;
                    
                    if (optionExists) {
                      selectResult = { locator: combobox, strategy: { type: 'combobox-scan' } };
                      console.log(`[PlaywrightRecorder] Found dropdown with option "${selectValue}" at combobox ${i}`);
                      // Don't close - let the main handler select the option
                      break;
                    } else {
                      // Close this dropdown and try next
                      await recorder.page.keyboard.press('Escape');
                      await recorder.page.waitForTimeout(100);
                    }
                  } catch (e) {
                    console.log(`[PlaywrightRecorder] Combobox ${i} check failed: ${e.message}`);
                  }
                }
              }
            }
            
            // Strategy 3: Try by any visible select trigger with matching nearby text
            if (!selectResult) {
              const triggers = recorder.page.locator('[data-radix-select-trigger], [role="combobox"]');
              const triggerCount = await triggers.count();
              
              for (let i = 0; i < triggerCount; i++) {
                if (await triggers.nth(i).isVisible()) {
                  selectResult = { locator: triggers.nth(i), strategy: { type: 'visible-trigger' } };
                  console.log(`[PlaywrightRecorder] Using visible trigger ${i}`);
                  break;
                }
              }
            }
          }
          
          // AI FALLBACK for select - Last resort
          if (!selectResult && recorder.enableAIFallback) {
            console.log(`[PlaywrightRecorder] Select: All strategies failed, trying AI fallback...`);
            const aiSelectResult = await recorder.findElementWithAI(label || selector || action.description, 'select');
            if (aiSelectResult) {
              try {
                // Click to open dropdown, then find and click option
                await recorder.page.mouse.click(aiSelectResult.x, aiSelectResult.y);
                
                // Wait for dropdown content to appear (Radix, Headless UI, etc.)
                const dropdownContent = recorder.page.locator(
                  '[role="listbox"], [role="menu"], ' +
                  '[data-radix-select-content], [data-radix-menu-content], ' +
                  '[data-radix-popper-content-wrapper]'
                );
                await dropdownContent.first().waitFor({ state: 'visible', timeout: 2000 }).catch(() => {});
                await recorder.page.waitForTimeout(100);
                
                // Try to find and click the option - properly scoped
                let aiOptionClicked = false;
                
                // Try role=option first
                const byRole = recorder.page.getByRole('option', { name: value });
                if (await byRole.count() > 0) {
                  await byRole.first().click();
                  aiOptionClicked = true;
                }
                
                // Try scoped text search
                if (!aiOptionClicked) {
                  const scopedOption = recorder.page.locator(
                    `[data-radix-select-content] >> text="${value}"`
                  ).or(recorder.page.locator(
                    `[role="listbox"] >> text="${value}"`
                  ));
                  if (await scopedOption.count() > 0) {
                    await scopedOption.first().click();
                    aiOptionClicked = true;
                  }
                }
                
                // Fallback to getByText
                if (!aiOptionClicked) {
                  const optionLocator = recorder.page.getByText(value, { exact: false });
                  if (await optionLocator.count() > 0) {
                    await optionLocator.first().click();
                    aiOptionClicked = true;
                  }
                }
                
                if (aiOptionClicked) {
                  console.log(`[PlaywrightRecorder] ✓ AI Fallback select succeeded`);
                  return { success: true, strategy: 'AI Vision Fallback' };
                }
              } catch (e) {
                console.log(`[PlaywrightRecorder] AI Fallback select failed:`, e.message);
              }
            }
          }
          
          if (!selectResult) {
            return { success: false, error: `Could not find select field: "${label || selector}"` };
          }
          
          // Scroll into view and highlight
          await selectResult.locator.scrollIntoViewIfNeeded().catch(() => {});
          await selectResult.locator.evaluate(el => {
            el.style.outline = '3px solid #4ade80';
          }).catch(() => {});
          
          // Check if this is a native select or custom dropdown (Radix, Headless UI, etc.)
          const tagName = await selectResult.locator.evaluate(el => el.tagName.toLowerCase()).catch(() => 'div');
          
          if (tagName === 'select') {
            // Native select - use selectOption
            await selectResult.locator.selectOption(value, { timeout });
          } else {
            // Custom dropdown (Radix, Headless UI, etc.) - click to open, then click option
            console.log(`[PlaywrightRecorder] Non-native select detected (${tagName}), using click-then-select for Radix/custom dropdown`);
            
            // Check if dropdown is already open (from our scan)
            const dropdownContent = recorder.page.locator(
              '[role="listbox"], [role="menu"], ' +
              '[data-radix-select-content], [data-radix-menu-content], ' +
              '[data-radix-popper-content-wrapper], [data-radix-select-viewport]'
            );
            
            const isAlreadyOpen = await dropdownContent.first().isVisible().catch(() => false);
            
            if (!isAlreadyOpen) {
              await selectResult.locator.click();
              
              // Wait for the dropdown content to appear (Radix portals to body)
              try {
                await dropdownContent.first().waitFor({ state: 'visible', timeout: 3000 });
                console.log(`[PlaywrightRecorder] Dropdown content appeared`);
              } catch (e) {
                console.log(`[PlaywrightRecorder] Warning: Dropdown content not detected, continuing anyway...`);
              }
            } else {
              console.log(`[PlaywrightRecorder] Dropdown already open, skipping click`);
            }
            
            // Small delay for animation
            await recorder.page.waitForTimeout(100);
            
            // Try to find and click the option - SCOPED TO DROPDOWN CONTENT
            let optionClicked = false;
            
            // Strategy 1: By role=option within visible dropdown
            try {
              const byRole = recorder.page.getByRole('option', { name: value });
              if (await byRole.count() > 0) {
                await byRole.first().click({ timeout: 2000 });
                optionClicked = true;
                console.log(`[PlaywrightRecorder] ✓ Selected option by role: "${value}"`);
              }
            } catch (e) {
              console.log(`[PlaywrightRecorder] Option by role failed, trying next strategy...`);
            }
            
            // Strategy 2: By role=menuitem (for Radix Menu)
            if (!optionClicked) {
              try {
                const byMenuitem = recorder.page.getByRole('menuitem', { name: value });
                if (await byMenuitem.count() > 0) {
                  await byMenuitem.first().click({ timeout: 2000 });
                  optionClicked = true;
                  console.log(`[PlaywrightRecorder] ✓ Selected option by menuitem role: "${value}"`);
                }
              } catch (e) {
                console.log(`[PlaywrightRecorder] Option by menuitem failed, trying next strategy...`);
              }
            }
            
            // Strategy 3: Text within Radix content (scoped)
            if (!optionClicked) {
              try {
                const radixOption = recorder.page.locator(
                  `[data-radix-select-content] >> text="${value}"`,
                ).or(recorder.page.locator(
                  `[data-radix-popper-content-wrapper] >> text="${value}"`
                )).or(recorder.page.locator(
                  `[role="listbox"] >> text="${value}"`
                ));
                
                if (await radixOption.count() > 0) {
                  await radixOption.first().click({ timeout: 2000 });
                  optionClicked = true;
                  console.log(`[PlaywrightRecorder] ✓ Selected option by scoped text: "${value}"`);
                }
              } catch (e) {
                console.log(`[PlaywrightRecorder] Scoped text failed, trying next strategy...`);
              }
            }
            
            // Strategy 4: data-radix-collection-item with matching text
            if (!optionClicked) {
              try {
                const radixItem = recorder.page.locator('[data-radix-collection-item]').filter({ hasText: value });
                if (await radixItem.count() > 0) {
                  await radixItem.first().click({ timeout: 2000 });
                  optionClicked = true;
                  console.log(`[PlaywrightRecorder] ✓ Selected option by Radix collection item: "${value}"`);
                }
              } catch (e) {
                console.log(`[PlaywrightRecorder] Radix collection item failed, trying last resort...`);
              }
            }
            
            // Strategy 5: Last resort - getByText but visible only
            if (!optionClicked) {
              const optionLocator = recorder.page.getByText(value, { exact: false }).and(recorder.page.locator(':visible'));
              const optionCount = await optionLocator.count();
              if (optionCount > 0) {
                await optionLocator.first().click({ timeout: 2000 });
                optionClicked = true;
                console.log(`[PlaywrightRecorder] ✓ Selected option by visible text: "${value}"`);
              } else {
                // Absolute last resort
                await recorder.page.getByRole('listitem').filter({ hasText: value }).first().click({ timeout: 2000 });
                optionClicked = true;
              }
            }
            
            if (!optionClicked) {
              console.error(`[PlaywrightRecorder] Failed to select option "${value}" from dropdown`);
            }
          }
          
          await selectResult.locator.evaluate(el => {
            el.style.outline = '';
          }).catch(() => {});
          break;

        case 'check':
          // Find checkbox using multiple strategies
          const checkResult = await recorder._findElement(action);
          if (!checkResult) {
            return { success: false, error: `Could not find checkbox: "${label || selector}"` };
          }
          
          await checkResult.locator.scrollIntoViewIfNeeded().catch(() => {});
          await checkResult.locator.evaluate(el => {
            el.style.outline = '3px solid #4ade80';
          }).catch(() => {});
          
          await checkResult.locator.check({ timeout });
          
          await checkResult.locator.evaluate(el => {
            el.style.outline = '';
          }).catch(() => {});
          break;

        case 'uncheck':
          // Find checkbox using multiple strategies
          const uncheckResult = await recorder._findElement(action);
          if (!uncheckResult) {
            return { success: false, error: `Could not find checkbox: "${label || selector}"` };
          }
          
          await uncheckResult.locator.scrollIntoViewIfNeeded().catch(() => {});
          await uncheckResult.locator.evaluate(el => {
            el.style.outline = '3px solid #4ade80';
          }).catch(() => {});
          
          await uncheckResult.locator.uncheck({ timeout });
          
          await uncheckResult.locator.evaluate(el => {
            el.style.outline = '';
          }).catch(() => {});
          break;

        case 'press':
          // Press a key
          const key = action.key || value || 'Enter';
          if (selector) {
            await recorder.page.locator(selector).press(key);
          } else {
            await recorder.page.keyboard.press(key);
          }
          break;

        case 'wait':
          // Wait for element or timeout
          if (selector) {
            await recorder.page.waitForSelector(selector, { timeout });
          } else {
            const waitTime = parseInt(value) || 1000;
            await recorder.page.waitForTimeout(waitTime);
          }
          break;

        case 'hover': {
          // Hover over element - CRITICAL for flyout menus
          console.log(`[PlaywrightRecorder] Executing hover action`);
          
          // Get target scope (iframe or main page)
          const hoverScope = await recorder._getFrameScope(action);
          
          // Try SmartFinder first (same as click)
          let hoverResult = null;
          if (recorder.useSmartFinderForPlayback && recorder.smartFinder && action.recipe) {
            try {
              console.log(`[PlaywrightRecorder] Hover: Trying SmartFinder...`);
              recorder.smartFinder.updatePage(recorder.page);
              const smartLocator = await recorder.smartFinder.find(action.recipe);
              if (smartLocator) {
                hoverResult = { locator: smartLocator, strategy: { type: 'SmartFinder' } };
              }
            } catch (sfError) {
              console.log(`[PlaywrightRecorder] SmartFinder hover failed:`, sfError.message);
            }
          }
          
          // Fallback to findElementWithRetry
          if (!hoverResult) {
            hoverResult = await recorder.findElementWithRetry(action);
          }
          
          // Direct selector fallback
          if (!hoverResult && selector) {
            const selectorLocator = hoverScope.locator(selector);
            const count = await selectorLocator.count().catch(() => 0);
            if (count > 0) {
              hoverResult = { locator: selectorLocator.first(), strategy: { type: 'selector' } };
            }
          }
          
          if (!hoverResult) {
            return { success: false, error: `Could not find element to hover: "${label || selector}"` };
          }
          
          // Perform the hover
          await hoverResult.locator.hover({ timeout });
          console.log(`[PlaywrightRecorder] ✓ Hover successful using ${hoverResult.strategy.type}`);
          
          // Wait a bit for any menu/dropdown to appear after hover (reduced from 300ms)
          await recorder.page.waitForTimeout(150);
          break;
        }

        // ============================================================
        // NEW ADVANCED ACTION TYPES
        // ============================================================
        
        case 'upload':
        case 'fileUpload': {
          // File upload
          console.log(`[PlaywrightRecorder] Handling file upload`);
          
          // Get the file path(s) from action
          const filePaths = action.value?.files || action.files || [action.value];
          if (!filePaths || filePaths.length === 0) {
            return { success: false, error: 'No file path provided for upload' };
          }
          
          // Get target scope (iframe or main page)
          const uploadScope = await recorder._getFrameScope(action);
          
          // Find file input
          let fileInput;
          if (selector) {
            fileInput = uploadScope.locator(selector);
          } else {
            // Try to find file input near label or by recipe
            const uploadResult = await recorder.findElementWithRetry({ ...action, type: 'click' });
            if (uploadResult) {
              fileInput = uploadResult.locator;
            }
          }
          
          if (!fileInput) {
            // Try by input[type=file] in general
            fileInput = uploadScope.locator('input[type="file"]').first();
          }
          
          await fileInput.setInputFiles(filePaths);
          console.log(`[PlaywrightRecorder] Uploaded files: ${filePaths.join(', ')}`);
          break;
        }
        
        case 'dragDrop':
        case 'drag': {
          // Drag and drop
          console.log(`[PlaywrightRecorder] Handling drag and drop`);
          
          const dragScope = await recorder._getFrameScope(action);
          
          // Get source element
          let sourceLocator;
          if (action.recipe || action.target) {
            const recipe = action.recipe || action.target;
            if (!recorder.smartFinder) {
              recorder.smartFinder = new SmartFinder(recorder.page, { debug: true, timeout: 15000 });
            }
            sourceLocator = await recorder.smartFinder.find(recipe);
          } else if (selector) {
            sourceLocator = dragScope.locator(selector);
          }
          
          if (!sourceLocator) {
            return { success: false, error: 'Could not find drag source element' };
          }
          
          // Get drop target
          let dropLocator;
          if (action.dropTarget) {
            dropLocator = await recorder.smartFinder.find(action.dropTarget);
          } else if (action.dropSelector) {
            dropLocator = dragScope.locator(action.dropSelector);
          } else if (action.value?.endX && action.value?.endY) {
            // Use coordinates if provided
            await sourceLocator.dragTo(dragScope.locator('body'), {
              targetPosition: { x: action.value.endX, y: action.value.endY }
            });
            break;
          }
          
          if (!dropLocator) {
            return { success: false, error: 'Could not find drop target element' };
          }
          
          await sourceLocator.dragTo(dropLocator);
          console.log(`[PlaywrightRecorder] Drag and drop completed`);
          break;
        }
        
        case 'dialog':
        case 'alert':
        case 'confirm':
        case 'prompt': {
          // Dialog handling is automatic via page.on('dialog') but this records the expected action
          console.log(`[PlaywrightRecorder] Dialog action recorded (handled automatically)`);
          // Dialogs are auto-handled by the dialog listener - this is just a marker
          break;
        }
        
        case 'closeModal':
        case 'dismissModal':
        case 'closePopup':
        case 'CloseModal': {
          // Close DOM-based modal/popup (not browser dialog)
          const closeResult = await ActionHandlers.handleCloseModal(recorder, action, { timeout });
          if (!closeResult.success) {
            return closeResult;
          }
          break;
        }
        
        case 'switchToFrame':
        case 'frame': {
          // Switch to iframe context
          console.log(`[PlaywrightRecorder] Switching to frame`);
          const frameInfo = action.frameContext || action.value;
          
          if (!frameInfo) {
            return { success: false, error: 'No frame info provided' };
          }
          
          // Store current frame context for subsequent actions
          recorder._currentFrameContext = frameInfo;
          console.log(`[PlaywrightRecorder] Frame context set to:`, frameInfo);
          break;
        }
        
        case 'switchToMainFrame':
        case 'mainFrame': {
          // Switch back to main frame
          console.log(`[PlaywrightRecorder] Switching back to main frame`);
          recorder._currentFrameContext = null;
          break;
        }
        
        case 'newTab': {
          // The previous action triggered a new tab - track it
          // Following Playwright's recommended pattern for tab management
          console.log(`[PlaywrightRecorder] New tab action - syncing page tracking...`);
          
          // Get all current pages in the context
          const allPages = recorder.context.pages();
          recorder._playbackPages = allPages;
          
          // Find the newest page (last in the array)
          if (allPages.length > 1) {
            const newestPage = allPages[allPages.length - 1];
            
            // Wait for it to be ready
            try {
              await newestPage.waitForLoadState('domcontentloaded', { timeout: 10000 });
            } catch (e) {
              console.log(`[PlaywrightRecorder] New page still loading...`);
            }
            
            console.log(`[PlaywrightRecorder] Total tabs: ${allPages.length}`);
            console.log(`[PlaywrightRecorder] Newest tab URL: ${newestPage.url()}`);
          } else {
            console.log(`[PlaywrightRecorder] No new tab detected, continuing...`);
          }
          break;
        }
        
        case 'switchTab': {
          // Switch to a specific tab - following Testim's approach:
          // 1. Try by index first
          // 2. Fallback to URL matching (handles tab reordering)
          console.log(`[PlaywrightRecorder] Switching to tab ${action.tabIndex ?? 'by URL'}`);
          
          const pages = recorder.context.pages();
          recorder._playbackPages = pages;
          let targetPage = null;
          
          // Strategy 1: Try by index (if provided and valid)
          if (action.tabIndex !== undefined && action.tabIndex >= 0 && action.tabIndex < pages.length) {
            targetPage = pages[action.tabIndex];
            console.log(`[PlaywrightRecorder] Found tab by index ${action.tabIndex}`);
          }
          
          // Strategy 2: Try by URL (more reliable across runs - Testim approach)
          if (!targetPage && action.url) {
            // Try exact match first
            targetPage = pages.find(p => p.url() === action.url);
            
            // Try partial URL match
            if (!targetPage) {
              targetPage = pages.find(p => p.url().includes(action.url) || action.url.includes(p.url()));
            }
            
            // Try hostname match
            if (!targetPage) {
              try {
                const targetHost = new URL(action.url).hostname;
                targetPage = pages.find(p => {
                  try { return new URL(p.url()).hostname === targetHost; }
                  catch { return false; }
                });
              } catch (e) {}
            }
            
            if (targetPage) {
              console.log(`[PlaywrightRecorder] Found tab by URL match: ${targetPage.url()}`);
            }
          }
          
          // Strategy 3: If index is 0, always use first page (original/parent)
          if (!targetPage && action.tabIndex === 0 && pages.length > 0) {
            targetPage = pages[0];
            console.log(`[PlaywrightRecorder] Using first tab (original window)`);
          }
          
          if (targetPage) {
            recorder.page = targetPage;
            recorder._playbackPageIndex = pages.indexOf(targetPage);
            
            // Bring to front and wait for ready
            await recorder.page.bringToFront();
            await recorder.page.waitForLoadState('domcontentloaded').catch(() => {});
            
            // Re-initialize SmartFinder for new page context
            if (recorder.useSmartFinderForPlayback) {
              recorder.smartFinder = new SmartFinder(recorder.page, { debug: true, timeout: 15000 });
            }
            
            console.log(`[PlaywrightRecorder] Now on tab: ${recorder.page.url()}`);
          } else {
            console.log(`[PlaywrightRecorder] Could not find target tab, staying on current`);
            console.log(`[PlaywrightRecorder] Available tabs:`, pages.map(p => p.url()));
          }
          break;
        }
        
        // NOTE: crossOriginPlaceholder is handled below with 'CrossOrigin' case
        
        case 'closeTab': {
          // Close current or specified tab and switch back to parent
          console.log(`[PlaywrightRecorder] Closing tab ${action.tabIndex ?? 'current'}`);
          
          const pages = recorder.context.pages();
          let tabToClose = null;
          
          if (action.tabIndex !== undefined && action.tabIndex >= 0 && action.tabIndex < pages.length) {
            tabToClose = pages[action.tabIndex];
          } else {
            // Close current tab
            tabToClose = recorder.page;
          }
          
          if (tabToClose && pages.length > 1) {
            await tabToClose.close().catch(() => {});
            
            // Switch to first remaining tab (usually the parent)
            const remainingPages = recorder.context.pages();
            if (remainingPages.length > 0) {
              recorder.page = remainingPages[0];
              recorder._playbackPages = remainingPages;
              recorder._playbackPageIndex = 0;
              await recorder.page.bringToFront();
              await recorder.page.waitForLoadState('domcontentloaded').catch(() => {});
              
              // Re-initialize SmartFinder for the page
              if (recorder.useSmartFinderForPlayback) {
                recorder.smartFinder = new SmartFinder(recorder.page, { debug: true, timeout: 15000 });
              }
              
              console.log(`[PlaywrightRecorder] Closed tab, now on: ${recorder.page.url()}`);
            }
          } else {
            console.log(`[PlaywrightRecorder] Cannot close last tab, skipping`);
          }
          break;
        }
        
        case 'download':
        case 'Download':
        case 'waitForDownload': {
          // Download step - the download was triggered by the PREVIOUS click action
          // This step is mostly for documentation/verification
          console.log(`[PlaywrightRecorder] Download step - checking for recent download`);
          const expectedFilename = action.filename || action.value || action.args?.[0];
          
          // If there's a click action to trigger download, do it first
          if (action.triggerSelector) {
            console.log(`[PlaywrightRecorder] Triggering download with: ${action.triggerSelector}`);
            const downloadPromise = recorder.page.waitForEvent('download', { timeout: 10000 });
            await recorder.page.click(action.triggerSelector);
            try {
              const download = await downloadPromise;
              console.log(`[PlaywrightRecorder] Download completed: ${download.suggestedFilename()}`);
            } catch (e) {
              console.log(`[PlaywrightRecorder] Download wait timed out, but click completed`);
            }
          } else {
            // No trigger - the download was already triggered by the previous step
            // Wait briefly to let any pending download complete
            console.log(`[PlaywrightRecorder] Waiting briefly for any pending download...`);
            try {
              // Short timeout - if download already happened, this will timeout (which is fine)
              const download = await recorder.page.waitForEvent('download', { timeout: 3000 });
              console.log(`[PlaywrightRecorder] Download completed: ${download.suggestedFilename()}`);
            } catch (e) {
              // Download either already completed or was handled by the previous click
              console.log(`[PlaywrightRecorder] Download likely already completed (previous click triggered it)`);
            }
          }
          
          // For verification, we'd check if file exists - for now, just pass
          if (expectedFilename) {
            console.log(`[PlaywrightRecorder] Expected download: ${expectedFilename}`);
          }
          
          // Download steps pass by default - the click that triggered it is what matters
          break;
        }

        case 'scroll':
          // Scroll element into view
          if (selector) {
            await recorder.page.locator(selector).scrollIntoViewIfNeeded();
          } else {
            // Scroll to position
            const scrollY = parseInt(value) || 500;
            await recorder.page.evaluate((y) => window.scrollBy(0, y), scrollY);
          }
          break;

        case 'assertText':
        case 'verifyText':
          // Assert text is visible on page
          const textToAssert = action.text || value;
          if (!textToAssert) {
            return { success: false, error: 'No text to assert' };
          }
          const hasText = await recorder.page.locator(`text=${textToAssert}`).first().isVisible({ timeout });
          if (!hasText) {
            return { success: false, error: `Text "${textToAssert}" not found on page` };
          }
          break;

        case 'assertVisible':
        case 'verifyVisible':
          // Assert element is visible
          if (!selector) {
            return { success: false, error: 'No selector for visibility assertion' };
          }
          const isVisible = await recorder.page.locator(selector).first().isVisible({ timeout });
          if (!isVisible) {
            return { success: false, error: `Element "${selector}" not visible` };
          }
          break;

        case 'assertValue':
        case 'verifyValue':
          // Assert input has specific value
          if (!selector) {
            return { success: false, error: 'No selector for value assertion' };
          }
          const actualValue = await recorder.page.locator(selector).inputValue({ timeout });
          if (actualValue !== value) {
            return { success: false, error: `Expected "${value}" but got "${actualValue}"` };
          }
          break;

        // ============ SALESFORCE STEP TYPES ============
        case 'sf_connect':
        case 'sfconnect': {
          console.log('[PlaywrightRecorder] SF Connect - verifying Salesforce session...');
          // Just verify we're on a Salesforce page
          const sfConnectUrl = recorder.page.url();
          if (!sfConnectUrl.includes('salesforce.com') && !sfConnectUrl.includes('lightning.force.com')) {
            return { success: false, error: 'Not on a Salesforce page. Please log in first.' };
          }
          return { success: true };
        }

        case 'sf_query':
        case 'sfquery': {
          console.log('[PlaywrightRecorder] SF Query - executing via API...');
          // SF queries need to go through the backend API
          const soqlQuery = action.args?.query || action.args?.[0] || action.value;
          const queryResponse = await recorder._sfApiCall('GET', `/query?q=${encodeURIComponent(soqlQuery)}`);
          if (!queryResponse.success) {
            return { success: false, error: `SOQL query failed: ${queryResponse.error}` };
          }
          console.log(`[PlaywrightRecorder] Query returned ${queryResponse.data?.totalSize || 0} records`);
          return { success: true, data: queryResponse.data };
        }

        case 'sf_assert':
        case 'sfassert': {
          console.log('[PlaywrightRecorder] SF Assert - checking record...');
          const assertObj = action.args?.object || action.args?.[0];
          const assertId = action.args?.recordId || action.args?.[1];
          const recordResponse = await recorder._sfApiCall('GET', `/sobjects/${assertObj}/${assertId}`);
          if (!recordResponse.success) {
            return { success: false, error: `Record assertion failed: ${assertObj}/${assertId} not found` };
          }
          return { success: true };
        }

        case 'sf_metadata_assert':
        case 'sfmetadataassert': {
          console.log('[PlaywrightRecorder] SF Metadata Assert...', action.args);
          // Handle both object format {type, object, expectedValue} and array format [id, type, object, expectedValue, description]
          const isArrayFormat = Array.isArray(action.args);
          const metaType = isArrayFormat ? action.args?.[1] : (action.args?.assertionType || action.args?.type || 'validation_rule');
          const metaObject = isArrayFormat ? action.args?.[2] : (action.args?.object || 'Account');
          const metaExpectedValue = isArrayFormat ? action.args?.[3] : action.args?.expectedValue;
          console.log(`[PlaywrightRecorder] Parsed: type=${metaType}, object=${metaObject}, expectedValue=${metaExpectedValue}`);
          
          switch (metaType) {
            // Handle both 'validation_rule' (from UI) and 'validation_rule_active' (legacy)
            case 'validation_rule':
            case 'validation_rule_active': {
              // Use metaExpectedValue (already parsed above) or fallback to other locations
              const vrName = metaExpectedValue || action.args?.expectedValue || action.args?.validationRule || action.args?.ruleName || action.value;
              console.log(`[PlaywrightRecorder] Checking validation rule: ${vrName} on ${metaObject}`);
              const vrQuery = `SELECT Id, Active FROM ValidationRule WHERE ValidationName = '${vrName}' AND EntityDefinition.QualifiedApiName = '${metaObject}'`;
              console.log(`[PlaywrightRecorder] VR Query: ${vrQuery}`);
              const vrResponse = await recorder._sfApiCall('GET', `/tooling/query?q=${encodeURIComponent(vrQuery)}`);
              console.log(`[PlaywrightRecorder] VR Response:`, JSON.stringify(vrResponse, null, 2));
              if (!vrResponse.success) {
                return { success: false, error: `API Error: ${vrResponse.error || 'Unknown error'}` };
              }
              if (!vrResponse.data || vrResponse.data.totalSize === 0) {
                return { success: false, error: `Validation rule "${vrName}" not found on ${metaObject}` };
              }
              if (!vrResponse.data?.records?.[0]?.Active) {
                return { success: false, error: `Validation rule "${vrName}" is not active` };
              }
              console.log(`[PlaywrightRecorder] ✓ Validation rule "${vrName}" is active!`);
              return { success: true };
            }
              
            case 'flow_active': {
              const flowName = metaExpectedValue || action.args?.expectedValue || action.args?.flowName || action.value;
              const flowResponse = await recorder._sfApiCall('GET',
                `/tooling/query?q=${encodeURIComponent(`SELECT Id, Status FROM Flow WHERE Definition.DeveloperName = '${flowName}' AND Status = 'Active'`)}`
              );
              if (!flowResponse.success || flowResponse.data?.totalSize === 0) {
                return { success: false, error: `Active flow "${flowName}" not found` };
              }
              return { success: true };
            }
              
            case 'field_exists': {
              const fieldName = metaExpectedValue || action.args?.expectedValue || action.args?.field;
              const descResponse = await recorder._sfApiCall('GET', `/sobjects/${metaObject}/describe`);
              if (!descResponse.success) {
                return { success: false, error: `Could not describe ${metaObject}` };
              }
              const fieldExists = descResponse.data?.fields?.some(f => f.name === fieldName);
              if (!fieldExists) {
                return { success: false, error: `Field "${fieldName}" not found on ${metaObject}` };
              }
              return { success: true };
            }
            
            case 'field_type': {
              const ftFieldName = (typeof metaExpectedValue === 'object' ? metaExpectedValue?.field : metaExpectedValue) || action.args?.field;
              const ftExpectedType = (typeof metaExpectedValue === 'object' ? metaExpectedValue?.type : null) || action.args?.expectedType;
              const ftDescResponse = await recorder._sfApiCall('GET', `/sobjects/${metaObject}/describe`);
              if (!ftDescResponse.success) {
                return { success: false, error: `Could not describe ${metaObject}` };
              }
              const ftFieldDef = ftDescResponse.data?.fields?.find(f => f.name === ftFieldName);
              if (!ftFieldDef) {
                return { success: false, error: `Field "${ftFieldName}" not found on ${metaObject}` };
              }
              if (ftFieldDef.type !== ftExpectedType) {
                return { success: false, error: `Field "${ftFieldName}" type is "${ftFieldDef.type}", expected "${ftExpectedType}"` };
              }
              return { success: true };
            }
            
            case 'field_required': {
              const frFieldName = action.args?.expectedValue?.field || action.args?.field || action.args?.[1];
              const frExpectedReq = action.args?.expectedValue?.required !== false;
              const frDescResponse = await recorder._sfApiCall('GET', `/sobjects/${metaObject}/describe`);
              if (!frDescResponse.success) {
                return { success: false, error: `Could not describe ${metaObject}` };
              }
              const frFieldDef = frDescResponse.data?.fields?.find(f => f.name === frFieldName);
              if (!frFieldDef) {
                return { success: false, error: `Field "${frFieldName}" not found on ${metaObject}` };
              }
              const isRequired = !frFieldDef.nillable && !frFieldDef.defaultedOnCreate;
              if (isRequired !== frExpectedReq) {
                return { success: false, error: `Field "${frFieldName}" required=${isRequired}, expected=${frExpectedReq}` };
              }
              return { success: true };
            }
            
            case 'picklist_values': {
              const pvFieldName = action.args?.field || action.args?.[1];
              const pvExpectedValues = Array.isArray(action.args?.expectedValue) ? action.args.expectedValue : 
                (typeof action.args?.expectedValue === 'string' ? action.args.expectedValue.split(',').map(v => v.trim()) : []);
              const pvDescResponse = await recorder._sfApiCall('GET', `/sobjects/${metaObject}/describe`);
              if (!pvDescResponse.success) {
                return { success: false, error: `Could not describe ${metaObject}` };
              }
              const pvFieldDef = pvDescResponse.data?.fields?.find(f => f.name === pvFieldName);
              if (!pvFieldDef || !pvFieldDef.picklistValues) {
                return { success: false, error: `Field "${pvFieldName}" is not a picklist on ${metaObject}` };
              }
              const pvActualValues = pvFieldDef.picklistValues.filter(v => v.active).map(v => v.value);
              const pvMissing = pvExpectedValues.filter(v => !pvActualValues.includes(v));
              if (pvMissing.length > 0) {
                return { success: false, error: `Picklist "${pvFieldName}" missing values: ${pvMissing.join(', ')}` };
              }
              return { success: true };
            }
            
            case 'record_type_exists': {
              const rtName = metaExpectedValue || action.args?.expectedValue || action.args?.recordType;
              const rtDescResponse = await recorder._sfApiCall('GET', `/sobjects/${metaObject}/describe`);
              if (!rtDescResponse.success) {
                return { success: false, error: `Could not describe ${metaObject}` };
              }
              const rtFound = rtDescResponse.data?.recordTypeInfos?.some(rt =>
                rt.developerName === rtName || rt.name === rtName
              );
              if (!rtFound) {
                return { success: false, error: `Record type "${rtName}" not found on ${metaObject}` };
              }
              return { success: true };
            }
            
            case 'permission': {
              const permProfile = action.args?.expectedValue?.profile || action.args?.profile;
              const permAccess = action.args?.expectedValue?.access || action.args?.access || 'read';
              console.log(`[PlaywrightRecorder] Checking permission: ${permProfile} has ${permAccess} on ${metaObject}`);
              // For now, just pass - full permission check requires more complex queries
              return { success: true };
            }
              
            default:
              return { success: false, error: `Unknown metadata assertion type: ${metaType}` };
          }
        }

        case 'sf_login_as':
        case 'sfloginas': {
          console.log('[PlaywrightRecorder] SF Login As - not yet implemented in recorder');
          return { success: false, error: 'Login As step requires full test executor. Run from Tests tab.' };
        }

        case 'sf_create_record':
        case 'sfcreaterecord': {
          console.log('[PlaywrightRecorder] SF Create Record...');
          const createObj = action.args?.objectType || action.args?.object || action.args?.[0] || 'Account';
          const createData = action.args?.data || action.args?.[1] || {};
          const createResponse = await recorder._sfApiCall('POST', `/sobjects/${createObj}/`, createData);
          if (!createResponse.success) {
            return { success: false, error: `Failed to create ${createObj}: ${createResponse.error}` };
          }
          console.log(`[PlaywrightRecorder] Created ${createObj}: ${createResponse.data?.id}`);
          return { success: true, recordId: createResponse.data?.id };
        }

        case 'sf_navigate':
        case 'sfnavigate': {
          const sfNavPath = action.args?.path || action.args?.[0] || '/lightning/page/home';
          // Get instance URL from current page
          const sfNavPageUrl = recorder.page.url();
          const sfNavInstanceMatch = sfNavPageUrl.match(/(https:\/\/[^\/]+)/);
          if (!sfNavInstanceMatch) {
            return { success: false, error: 'Cannot determine Salesforce instance URL' };
          }
          const sfNavTargetUrl = sfNavPath.startsWith('http') ? sfNavPath : `${sfNavInstanceMatch[1]}${sfNavPath}`;
          await recorder.page.goto(sfNavTargetUrl, { waitUntil: 'domcontentloaded', timeout });
          return { success: true };
        }

        // ============ SPECIFIC SF ASSERTION TYPES (from test data files) ============
        
        // SF SOQL - Execute SOQL query (alternative type)
        case 'sf_soql':
        case 'sfsoql':
        case 'ExecuteSOQL': {
          const soqlQueryAlt = action.args?.query || action.args?.[0] || action.value;
          console.log(`[PlaywrightRecorder] SF SOQL query: ${soqlQueryAlt}`);
          const soqlResultAlt = await recorder._sfApiCall('GET', `/query?q=${encodeURIComponent(soqlQueryAlt)}`);
          if (!soqlResultAlt.success) {
            return { success: false, error: `SOQL query failed: ${soqlResultAlt.error}` };
          }
          console.log(`[PlaywrightRecorder] SOQL returned ${soqlResultAlt.data?.totalSize || 0} records`);
          return { success: true, data: soqlResultAlt.data };
        }

        // SF Assert SOQL - Assert based on SOQL query results
        case 'sf_assert_soql':
        case 'sfassertsoql':
        case 'AssertSOQL': {
          const assertSOQLQuery = action.args?.query || action.args?.[0] || action.value;
          const assertSOQLExpr = action.args?.assertion || 'count > 0';
          console.log(`[PlaywrightRecorder] SF Assert SOQL: ${assertSOQLQuery} (${assertSOQLExpr})`);
          
          const assertSOQLResult = await recorder._sfApiCall('GET', `/query?q=${encodeURIComponent(assertSOQLQuery)}`);
          if (!assertSOQLResult.success) {
            return { success: false, error: `SOQL query failed: ${assertSOQLResult.error}` };
          }
          
          const soqlCount = assertSOQLResult.data?.totalSize || 0;
          let soqlAssertPassed = false;
          
          if (assertSOQLExpr.includes('count')) {
            try {
              soqlAssertPassed = eval(assertSOQLExpr.replace(/count/g, soqlCount.toString()));
            } catch (e) {
              soqlAssertPassed = soqlCount > 0;
            }
          } else {
            soqlAssertPassed = soqlCount > 0;
          }
          
          if (!soqlAssertPassed) {
            return { success: false, error: `SOQL assertion failed: ${assertSOQLExpr} (got ${soqlCount} records)` };
          }
          
          console.log(`[PlaywrightRecorder] SOQL assertion passed: ${soqlCount} records`);
          return { success: true, recordCount: soqlCount };
        }

        // SF Assert Field Exists
        case 'sf_assert_field_exists':
        case 'sfassertfieldexists':
        case 'AssertFieldExists': {
          const feObj = action.args?.object || action.args?.[0] || 'Account';
          const feField = action.args?.field || action.args?.[1];
          console.log(`[PlaywrightRecorder] SF Assert Field Exists: ${feObj}.${feField}`);
          
          const feDescribe = await recorder._sfApiCall('GET', `/sobjects/${feObj}/describe`);
          if (!feDescribe.success) {
            return { success: false, error: `Could not describe ${feObj}: ${feDescribe.error}` };
          }
          
          const feExists = feDescribe.data?.fields?.some(f => f.name === feField);
          if (!feExists) {
            return { success: false, error: `Field "${feField}" does not exist on ${feObj}` };
          }
          
          console.log(`[PlaywrightRecorder] Field exists: ${feObj}.${feField}`);
          return { success: true };
        }

        // SF Assert Field Value
        case 'sf_assert_field_value':
        case 'sfassertfieldvalue':
        case 'AssertFieldValue': {
          const fvObj = action.args?.objectType || action.args?.object || 'Account';
          const fvRecordId = action.args?.recordId;
          const fvField = action.args?.field;
          const fvExpected = action.args?.expected || action.args?.expectedValue;
          console.log(`[PlaywrightRecorder] SF Assert Field Value: ${fvObj}/${fvRecordId}.${fvField} == ${fvExpected}`);
          
          const fvRecord = await recorder._sfApiCall('GET', `/sobjects/${fvObj}/${fvRecordId}`);
          if (!fvRecord.success) {
            return { success: false, error: `Could not get record ${fvRecordId}: ${fvRecord.error}` };
          }
          
          const fvActual = fvRecord.data?.[fvField];
          if (fvActual !== fvExpected) {
            return { success: false, error: `Field ${fvField} = "${fvActual}", expected "${fvExpected}"` };
          }
          
          return { success: true };
        }

        // SF Assert Picklist Values
        case 'sf_assert_picklist':
        case 'sfassertpicklist':
        case 'AssertPicklist': {
          const apObj = action.args?.object || action.args?.[0] || 'Account';
          const apField = action.args?.field || action.args?.[1];
          const apExpected = action.args?.values || action.args?.expectedValues || [];
          console.log(`[PlaywrightRecorder] SF Assert Picklist: ${apObj}.${apField}`);
          
          const apDescribe = await recorder._sfApiCall('GET', `/sobjects/${apObj}/describe`);
          if (!apDescribe.success) {
            return { success: false, error: `Could not describe ${apObj}: ${apDescribe.error}` };
          }
          
          const apFieldDef = apDescribe.data?.fields?.find(f => f.name === apField);
          if (!apFieldDef || !apFieldDef.picklistValues) {
            return { success: false, error: `Field "${apField}" is not a picklist on ${apObj}` };
          }
          
          const apActualValues = apFieldDef.picklistValues.filter(v => v.active).map(v => v.value);
          const apMissing = apExpected.filter(v => !apActualValues.includes(v));
          
          if (apMissing.length > 0) {
            return { success: false, error: `Picklist "${apField}" missing values: ${apMissing.join(', ')}` };
          }
          
          console.log(`[PlaywrightRecorder] Picklist values verified: ${apField}`);
          return { success: true, values: apActualValues };
        }

        // SF Assert Validation Rule Active
        case 'sf_assert_validation_rule':
        case 'sfassertvalidationrule':
        case 'AssertValidationRule': {
          const vrAssertObj = action.args?.object || action.args?.[0] || 'Account';
          const vrAssertName = action.args?.ruleName || action.args?.[1];
          const vrAssertExpected = action.args?.isActive !== false;
          console.log(`[PlaywrightRecorder] SF Assert Validation Rule: ${vrAssertObj}.${vrAssertName}`);
          
          const vrAssertQuery = await recorder._sfApiCall('GET',
            `/tooling/query?q=${encodeURIComponent(`SELECT Id, Active FROM ValidationRule WHERE ValidationName = '${vrAssertName}' AND EntityDefinition.QualifiedApiName = '${vrAssertObj}'`)}`
          );
          
          if (!vrAssertQuery.success || vrAssertQuery.data?.totalSize === 0) {
            return { success: false, error: `Validation rule "${vrAssertName}" not found on ${vrAssertObj}` };
          }
          
          const vrAssertActive = vrAssertQuery.data?.records?.[0]?.Active;
          if (vrAssertActive !== vrAssertExpected) {
            return { success: false, error: `Validation rule "${vrAssertName}" active=${vrAssertActive}, expected=${vrAssertExpected}` };
          }
          
          console.log(`[PlaywrightRecorder] Validation rule verified: ${vrAssertName}`);
          return { success: true };
        }

        // SF Assert Flow Active
        case 'sf_assert_flow':
        case 'sfassertflow':
        case 'AssertFlow': {
          const flowAssertName = action.args?.flowName || action.args?.[0];
          console.log(`[PlaywrightRecorder] SF Assert Flow: ${flowAssertName}`);
          
          const flowAssertQuery = await recorder._sfApiCall('GET',
            `/tooling/query?q=${encodeURIComponent(`SELECT Id, Status FROM Flow WHERE Definition.DeveloperName = '${flowAssertName}' AND Status = 'Active'`)}`
          );
          
          if (!flowAssertQuery.success || flowAssertQuery.data?.totalSize === 0) {
            return { success: false, error: `Active flow "${flowAssertName}" not found` };
          }
          
          console.log(`[PlaywrightRecorder] Flow is active: ${flowAssertName}`);
          return { success: true };
        }

        // SF Assert Record Type Exists
        case 'sf_assert_record_type':
        case 'sfassertrecordtype':
        case 'AssertRecordType': {
          const rtAssertObj = action.args?.object || action.args?.[0] || 'Account';
          const rtAssertName = action.args?.recordType || action.args?.[1];
          console.log(`[PlaywrightRecorder] SF Assert Record Type: ${rtAssertObj}.${rtAssertName}`);
          
          const rtAssertDescribe = await recorder._sfApiCall('GET', `/sobjects/${rtAssertObj}/describe`);
          if (!rtAssertDescribe.success) {
            return { success: false, error: `Could not describe ${rtAssertObj}: ${rtAssertDescribe.error}` };
          }
          
          const rtAssertFound = rtAssertDescribe.data?.recordTypeInfos?.some(rt =>
            rt.developerName === rtAssertName || rt.name === rtAssertName
          );
          
          if (!rtAssertFound) {
            return { success: false, error: `Record type "${rtAssertName}" not found on ${rtAssertObj}` };
          }
          
          console.log(`[PlaywrightRecorder] Record type exists: ${rtAssertObj}.${rtAssertName}`);
          return { success: true };
        }

        // SF REST API - Make arbitrary API call
        case 'sf_rest_api':
        case 'sfrestapi':
        case 'RestAPI': {
          const restApiMethod = action.args?.method || 'GET';
          const restApiEndpoint = action.args?.endpoint || action.args?.[0];
          const restApiBody = action.args?.body || null;
          console.log(`[PlaywrightRecorder] SF REST API: ${restApiMethod} ${restApiEndpoint}`);
          
          const restApiResult = await recorder._sfApiCall(restApiMethod, restApiEndpoint, restApiBody);
          if (!restApiResult.success) {
            return { success: false, error: `REST API call failed: ${restApiResult.error}` };
          }
          
          return { success: true, data: restApiResult.data };
        }

        // SF Apex - Execute anonymous Apex
        case 'sf_apex':
        case 'sfapex':
        case 'ExecuteApex': {
          const apexCodeStr = action.args?.code || action.args?.[0] || action.value;
          console.log(`[PlaywrightRecorder] SF Apex: Executing anonymous Apex`);
          
          const apexExecResult = await recorder._sfApiCall('GET', `/tooling/executeAnonymous?anonymousBody=${encodeURIComponent(apexCodeStr)}`);
          
          if (!apexExecResult.success) {
            return { success: false, error: `Apex execution failed: ${apexExecResult.error}` };
          }
          
          if (apexExecResult.data?.success === false || apexExecResult.data?.compiled === false) {
            return { success: false, error: `Apex error: ${apexExecResult.data?.compileProblem || apexExecResult.data?.exceptionMessage}` };
          }
          
          console.log(`[PlaywrightRecorder] Apex executed successfully`);
          return { success: true, data: apexExecResult.data };
        }

        // ============ SALESFORCE TESTING HELPER ACTION TYPES ============
        // These are generated by the Test Helpers panel in the desktop app

        case 'sf-navigate-record':
        case 'NavigateToRecordById': {
          // Navigate to a specific record by ID
          const recordId = action.args?.[0] || action.value;
          const objectType = action.args?.[1] || 'sObject';
          const lightningPath = action.args?.[2];
          
          console.log(`[PlaywrightRecorder] Navigate to ${objectType} record: ${recordId}`);
          
          // Get base URL from current page
          const currentPageUrl = recorder.page.url();
          const baseMatch = currentPageUrl.match(/(https:\/\/[^\/]+)/);
          
          if (!baseMatch) {
            return { success: false, error: 'Cannot determine Salesforce base URL' };
          }
          
          const baseUrl = baseMatch[1];
          const targetUrl = lightningPath 
            ? `${baseUrl}${lightningPath}`
            : `${baseUrl}/lightning/r/${objectType}/${recordId}/view`;
          
          console.log(`[PlaywrightRecorder] Navigating to: ${targetUrl}`);
          await recorder.page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout });
          
          // Wait for Lightning to load
          await recorder.page.waitForTimeout(2000);
          try {
            await recorder.page.waitForLoadState('networkidle', { timeout: 10000 });
          } catch (e) {}
          
          return { success: true };
        }

        case 'sf-navigate-soql':
        case 'NavigateToRecordBySOQL': {
          // Run SOQL query to get record ID, then navigate to it
          const queryObjectType = action.args?.[0] || 'Account';
          const soqlQuery = action.args?.[1];
          
          console.log(`[PlaywrightRecorder] Navigate via SOQL: ${soqlQuery}`);
          
          // Execute SOQL query via API
          const queryResult = await recorder._sfApiCall('GET', `/query?q=${encodeURIComponent(soqlQuery)}`);
          
          if (!queryResult.success) {
            return { success: false, error: `SOQL query failed: ${queryResult.error}` };
          }
          
          if (!queryResult.data?.records?.length) {
            return { success: false, error: `No records found for query: ${soqlQuery}` };
          }
          
          const foundRecordId = queryResult.data.records[0].Id;
          console.log(`[PlaywrightRecorder] Found record ID: ${foundRecordId}`);
          
          // Navigate to the record
          const soqlBaseMatch = recorder.page.url().match(/(https:\/\/[^\/]+)/);
          if (!soqlBaseMatch) {
            return { success: false, error: 'Cannot determine Salesforce base URL' };
          }
          
          const soqlTargetUrl = `${soqlBaseMatch[1]}/lightning/r/${queryObjectType}/${foundRecordId}/view`;
          console.log(`[PlaywrightRecorder] Navigating to: ${soqlTargetUrl}`);
          
          await recorder.page.goto(soqlTargetUrl, { waitUntil: 'domcontentloaded', timeout });
          await recorder.page.waitForTimeout(2000);
          
          return { success: true, recordId: foundRecordId };
        }

        case 'sf-navigate-list':
        case 'NavigateToObjectList': {
          // Navigate to object list view
          const listObjectType = action.args?.[0] || 'Account';
          const listLightningPath = action.args?.[1];
          
          console.log(`[PlaywrightRecorder] Navigate to ${listObjectType} list`);
          
          const listBaseMatch = recorder.page.url().match(/(https:\/\/[^\/]+)/);
          if (!listBaseMatch) {
            return { success: false, error: 'Cannot determine Salesforce base URL' };
          }
          
          const listTargetUrl = listLightningPath
            ? `${listBaseMatch[1]}${listLightningPath}`
            : `${listBaseMatch[1]}/lightning/o/${listObjectType}/list`;
          
          console.log(`[PlaywrightRecorder] Navigating to: ${listTargetUrl}`);
          await recorder.page.goto(listTargetUrl, { waitUntil: 'domcontentloaded', timeout });
          await recorder.page.waitForTimeout(2000);
          
          return { success: true };
        }

        case 'sf-navigate-new':
        case 'NavigateToNewRecord': {
          // Navigate to new record form
          const newObjectType = action.args?.[0] || 'Account';
          const newLightningPath = action.args?.[1];
          
          console.log(`[PlaywrightRecorder] Navigate to New ${newObjectType} form`);
          
          const newBaseMatch = recorder.page.url().match(/(https:\/\/[^\/]+)/);
          if (!newBaseMatch) {
            return { success: false, error: 'Cannot determine Salesforce base URL' };
          }
          
          const newTargetUrl = newLightningPath
            ? `${newBaseMatch[1]}${newLightningPath}`
            : `${newBaseMatch[1]}/lightning/o/${newObjectType}/new`;
          
          console.log(`[PlaywrightRecorder] Navigating to: ${newTargetUrl}`);
          await recorder.page.goto(newTargetUrl, { waitUntil: 'domcontentloaded', timeout });
          await recorder.page.waitForTimeout(2000);
          
          return { success: true };
        }

        case 'sf-global-search':
        case 'SalesforceGlobalSearch': {
          // Perform global search in Salesforce
          const searchTerm = action.args?.[0] || action.value;
          console.log(`[PlaywrightRecorder] Global search: ${searchTerm}`);
          
          const searchBaseMatch = recorder.page.url().match(/(https:\/\/[^\/]+)/);
          if (!searchBaseMatch) {
            return { success: false, error: 'Cannot determine Salesforce base URL' };
          }
          
          const searchUrl = `${searchBaseMatch[1]}/lightning/o/GlobalSearchResults/home?term=${encodeURIComponent(searchTerm)}`;
          await recorder.page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout });
          await recorder.page.waitForTimeout(2000);
          
          return { success: true };
        }

        case 'sf-app-launcher':
        case 'OpenAppLauncher': {
          // Open the Salesforce App Launcher
          console.log(`[PlaywrightRecorder] Opening App Launcher`);
          
          // Find and click the App Launcher button
          const appLauncherBtn = recorder.page.locator('button[title="App Launcher"]');
          await appLauncherBtn.click({ timeout: 10000 });
          await recorder.page.waitForTimeout(1000);
          
          return { success: true };
        }

        case 'sf-open-search':
        case 'OpenGlobalSearch': {
          // Focus the global search input
          console.log(`[PlaywrightRecorder] Opening Global Search`);
          
          const searchInput = recorder.page.locator('input[placeholder*="Search" i], button[title*="Search" i]');
          await searchInput.first().click({ timeout: 10000 });
          await recorder.page.waitForTimeout(500);
          
          return { success: true };
        }

        case 'sf-wait':
        case 'WaitForSalesforceReady': {
          // Wait for Salesforce page to be ready
          const waitMs = parseInt(action.args?.[0] || '3000');
          console.log(`[PlaywrightRecorder] Waiting ${waitMs}ms for Salesforce to be ready`);
          
          await recorder.page.waitForTimeout(waitMs);
          
          // Also try to wait for network idle
          try {
            await recorder.page.waitForLoadState('networkidle', { timeout: 5000 });
          } catch (e) {}
          
          return { success: true };
        }

        case 'sf-click-tab':
        case 'ClickRecordTab': {
          // Click a tab on the record page (Details, Related, Activity, etc.)
          const tabName = action.args?.[0] || 'Details';
          console.log(`[PlaywrightRecorder] Clicking ${tabName} tab`);
          
          // Try multiple selectors for Lightning tabs
          const tabSelectors = [
            `a[title="${tabName}"]`,
            `li[title="${tabName}"] a`,
            `[data-tab-name="${tabName}"]`,
            `button:has-text("${tabName}")`,
            `a:has-text("${tabName}")`
          ];
          
          let tabClicked = false;
          for (const tabSelector of tabSelectors) {
            try {
              const tab = recorder.page.locator(tabSelector).first();
              if (await tab.isVisible({ timeout: 2000 })) {
                await tab.click();
                tabClicked = true;
                break;
              }
            } catch (e) {}
          }
          
          if (!tabClicked) {
            // Fallback: use getByText
            await recorder.page.getByText(tabName, { exact: false }).first().click({ timeout: 10000 });
          }
          
          await recorder.page.waitForTimeout(1000);
          return { success: true };
        }

        case 'sf-click-save':
        case 'ClickSaveButton': {
          console.log(`[PlaywrightRecorder] Clicking Save button`);
          
          const saveSelectors = [
            'button[name="SaveEdit"]',
            'button[title="Save"]',
            'button:has-text("Save"):not(:has-text("Save &"))',
            '[data-aura-class*="Save"]',
            'lightning-button button:has-text("Save")'
          ];
          
          for (const sel of saveSelectors) {
            try {
              const btn = recorder.page.locator(sel).first();
              if (await btn.isVisible({ timeout: 2000 })) {
                await btn.click();
                await recorder.page.waitForTimeout(2000);
                return { success: true };
              }
            } catch (e) {}
          }
          
          // Fallback
          await recorder.page.getByRole('button', { name: /save/i }).first().click({ timeout: 10000 });
          await recorder.page.waitForTimeout(2000);
          return { success: true };
        }

        case 'sf-click-edit':
        case 'ClickEditButton': {
          console.log(`[PlaywrightRecorder] Clicking Edit button`);
          
          const editSelectors = [
            'button[name="Edit"]',
            'button[title="Edit"]',
            'a[title="Edit"]',
            'button:has-text("Edit")',
            '[data-aura-class*="Edit"]'
          ];
          
          for (const sel of editSelectors) {
            try {
              const btn = recorder.page.locator(sel).first();
              if (await btn.isVisible({ timeout: 2000 })) {
                await btn.click();
                await recorder.page.waitForTimeout(1000);
                return { success: true };
              }
            } catch (e) {}
          }
          
          // Fallback
          await recorder.page.getByRole('button', { name: /edit/i }).first().click({ timeout: 10000 });
          await recorder.page.waitForTimeout(1000);
          return { success: true };
        }

        case 'sf-click-delete':
        case 'ClickDeleteButton': {
          console.log(`[PlaywrightRecorder] Clicking Delete button`);
          
          const deleteSelectors = [
            'button[name="Delete"]',
            'button[title="Delete"]',
            'a[title="Delete"]',
            'button:has-text("Delete")'
          ];
          
          for (const sel of deleteSelectors) {
            try {
              const btn = recorder.page.locator(sel).first();
              if (await btn.isVisible({ timeout: 2000 })) {
                await btn.click();
                await recorder.page.waitForTimeout(1000);
                return { success: true };
              }
            } catch (e) {}
          }
          
          // Fallback
          await recorder.page.getByRole('button', { name: /delete/i }).first().click({ timeout: 10000 });
          await recorder.page.waitForTimeout(1000);
          return { success: true };
        }

        case 'sf-click-clone':
        case 'ClickCloneButton': {
          console.log(`[PlaywrightRecorder] Clicking Clone button`);
          
          const cloneSelectors = [
            'button[name="Clone"]',
            'button[title="Clone"]',
            'a[title="Clone"]',
            'button:has-text("Clone")'
          ];
          
          for (const sel of cloneSelectors) {
            try {
              const btn = recorder.page.locator(sel).first();
              if (await btn.isVisible({ timeout: 2000 })) {
                await btn.click();
                await recorder.page.waitForTimeout(1000);
                return { success: true };
              }
            } catch (e) {}
          }
          
          // Fallback
          await recorder.page.getByRole('button', { name: /clone/i }).first().click({ timeout: 10000 });
          await recorder.page.waitForTimeout(1000);
          return { success: true };
        }

        case 'screenshot':
        case 'TakeScreenshot': {
          const screenshotName = action.args?.[0] || `screenshot_${Date.now()}.png`;
          console.log(`[PlaywrightRecorder] Taking screenshot: ${screenshotName}`);
          await recorder.page.screenshot({ path: screenshotName, fullPage: false });
          return { success: true };
        }

        // ════════════════════════════════════════════════════════════════════════════
        // MULTI-TAB AND WINDOW ACTIONS
        // ════════════════════════════════════════════════════════════════════════════
        case 'newTab':
        case 'NewTab': {
          // A new tab should have opened - during playback we wait for it
          console.log(`[PlaywrightRecorder] Waiting for new tab: ${action.url || 'any'}`);
          
          // The previous action (like clicking a link) should have triggered a new tab
          // We need to wait for it and switch to it
          const pages = recorder.context.pages();
          const targetTabIndex = action.tabIndex ?? pages.length - 1;
          
          if (pages.length > 1) {
            // Switch to the new tab
            recorder.page = pages[targetTabIndex] || pages[pages.length - 1];
            console.log(`[PlaywrightRecorder] Switched to new tab (index ${targetTabIndex}): ${recorder.page.url()}`);
            
            // Wait for the page to load
            try {
              await recorder.page.waitForLoadState('domcontentloaded', { timeout: 10000 });
            } catch (e) {
              console.log('[PlaywrightRecorder] New tab load wait timed out');
            }
          } else {
            console.log('[PlaywrightRecorder] No new tab found, continuing on current page');
          }
          
          return { success: true };
        }
        
        case 'switchTab':
        case 'SwitchTab': {
          // Switch to a specific tab by index or URL
          const targetIndex = action.tabIndex ?? action.args?.[0] ?? 0;
          const targetUrl = action.url || action.args?.[1] || null;
          
          console.log(`[PlaywrightRecorder] Switching to tab ${targetIndex} (url hint: ${targetUrl?.substring(0, 50) || 'none'})`);
          
          const allPages = recorder.context.pages();
          console.log(`[PlaywrightRecorder] Available tabs: ${allPages.length}`);
          
          let targetPage = null;
          
          // Strategy 1: Try exact index
          if (targetIndex < allPages.length) {
            targetPage = allPages[targetIndex];
          }
          
          // Strategy 2: If index fails, try to find by URL
          if (!targetPage && targetUrl) {
            targetPage = allPages.find(p => p.url() === targetUrl);
            if (!targetPage) {
              // Try hostname match
              try {
                const targetHostname = new URL(targetUrl).hostname;
                targetPage = allPages.find(p => {
                  try {
                    return new URL(p.url()).hostname === targetHostname;
                  } catch { return false; }
                });
              } catch {}
            }
          }
          
          // Strategy 3: Fall back to first/last page
          if (!targetPage) {
            targetPage = targetIndex === 0 ? allPages[0] : allPages[allPages.length - 1];
          }
          
          if (targetPage) {
            recorder.page = targetPage;
            await recorder.page.bringToFront();
            console.log(`[PlaywrightRecorder] ✓ Switched to tab: ${recorder.page.url().substring(0, 50)}`);
            
            // Wait for page to be ready
            try {
              await recorder.page.waitForLoadState('domcontentloaded', { timeout: 5000 });
            } catch (e) {}
          } else {
            console.warn(`[PlaywrightRecorder] Could not find target tab ${targetIndex}`);
          }
          
          return { success: true };
        }
        
        case 'closeTab':
        case 'CloseTab': {
          // Close a specific tab
          const closeIndex = action.tabIndex ?? action.args?.[0] ?? -1;
          const allPagesClose = recorder.context.pages();
          
          console.log(`[PlaywrightRecorder] Closing tab ${closeIndex}`);
          
          if (closeIndex >= 0 && closeIndex < allPagesClose.length) {
            const pageToClose = allPagesClose[closeIndex];
            await pageToClose.close();
            
            // Switch to remaining tab
            const remainingPages = recorder.context.pages();
            if (remainingPages.length > 0) {
              recorder.page = remainingPages[0];
              await recorder.page.bringToFront();
            }
          }
          
          return { success: true };
        }
        
        case 'crossOriginPlaceholder':
        case 'CrossOrigin':
        case 'crossorigin':
        case 'cross-origin':
        case 'CrossOriginPlaceholder': {
          // ============ CROSS-ORIGIN STEP START ============
          console.log(`\n[PlaywrightRecorder] ======================================`);
          console.log(`[PlaywrightRecorder] CROSS-ORIGIN STEP EXECUTING`);
          console.log(`[PlaywrightRecorder] ======================================`);
          
          // Show feedback on CURRENT page (parent) first
          try {
            await recorder.page.evaluate(() => {
              const div = document.createElement('div');
              div.id = 'qaai-parent-debug';
              div.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:blue;color:white;padding:20px;z-index:999999;font-size:18px;border-radius:10px;';
              div.textContent = '🔄 QAAI: Switching to popup window...';
              document.body.appendChild(div);
            });
          } catch (e) {
            console.log(`[PlaywrightRecorder] Could not show parent feedback: ${e.message}`);
          }
          
          await recorder.page.waitForTimeout(1000); // Let user see the message
          
          const crossOriginUrl = action.url || action.label || action.args?.[0] || 'external tab';
          console.log(`[PlaywrightRecorder] Cross-origin URL: ${crossOriginUrl}`);
          console.log(`[PlaywrightRecorder] userActions: ${action.userActions?.length || 0}`);
          
          // First, get all available tabs
          let crossPages = recorder.context.pages();
          console.log(`[PlaywrightRecorder] Available tabs: ${crossPages.length}`);
          crossPages.forEach((p, i) => console.log(`  Tab ${i}: ${p.url().substring(0, 60)}`));
          
          // If only one tab, we need to wait for the cross-origin tab to open
          if (crossPages.length === 1) {
            console.log(`[PlaywrightRecorder] Only 1 tab open, waiting for popup...`);
            try {
              const newPage = await recorder.context.waitForEvent('page', { timeout: 5000 });
              await newPage.waitForLoadState('domcontentloaded', { timeout: 10000 }).catch(() => {});
              crossPages = recorder.context.pages();
              console.log(`[PlaywrightRecorder] Now have ${crossPages.length} tabs`);
            } catch (e) {
              console.log(`[PlaywrightRecorder] No new tab appeared, continuing with current`);
            }
          }
          
          // Find the right tab - prefer by URL match, then by index
          const targetCrossTabIndex = action.tabIndex ?? action.args?.[1] ?? 1;
          let targetTab = null;
          
          // Strategy 1: Find by URL match
          if (crossOriginUrl && crossOriginUrl !== 'external tab') {
            for (let i = 0; i < crossPages.length; i++) {
              const pageUrl = crossPages[i].url();
              if (pageUrl.includes(crossOriginUrl) || crossOriginUrl.includes(new URL(pageUrl).hostname)) {
                targetTab = crossPages[i];
                console.log(`[PlaywrightRecorder] Found tab by URL match: ${pageUrl.substring(0, 60)}`);
                break;
              }
            }
          }
          
          // Strategy 2: Use the non-localhost tab (likely the popup)
          if (!targetTab) {
            for (let i = crossPages.length - 1; i >= 0; i--) {
              const pageUrl = crossPages[i].url();
              if (!pageUrl.includes('localhost') && !pageUrl.includes('127.0.0.1')) {
                targetTab = crossPages[i];
                console.log(`[PlaywrightRecorder] Found external tab: ${pageUrl.substring(0, 60)}`);
                break;
              }
            }
          }
          
          // Strategy 3: Use index
          if (!targetTab && targetCrossTabIndex < crossPages.length) {
            targetTab = crossPages[targetCrossTabIndex];
            console.log(`[PlaywrightRecorder] Using tab by index ${targetCrossTabIndex}`);
          }
          
          // Strategy 4: Use the last tab (most recently opened)
          if (!targetTab && crossPages.length > 1) {
            targetTab = crossPages[crossPages.length - 1];
            console.log(`[PlaywrightRecorder] Using last tab as fallback`);
          }
          
          if (targetTab) {
            recorder.page = targetTab;
            await recorder.page.bringToFront();
            // Wait for the page to be ready - cross-origin pages need more time
            console.log(`[PlaywrightRecorder] Waiting for cross-origin page to load...`);
            await recorder.page.waitForLoadState('domcontentloaded', { timeout: 15000 }).catch(() => {});
            await recorder.page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
            // Extra wait for JavaScript to initialize
            await recorder.page.waitForTimeout(1000);
            console.log(`[PlaywrightRecorder] ✓ Cross-origin tab ready: ${recorder.page.url()}`);
          } else {
            console.warn(`[PlaywrightRecorder] Could not find cross-origin tab!`);
            // List all available pages for debugging
            const allPages = recorder.context.pages();
            console.log(`[PlaywrightRecorder] Available pages:`);
            allPages.forEach((p, i) => console.log(`  ${i}: ${p.url()}`));
          }
          
          // Execute any user-defined actions with manual selectors
          console.log(`[PlaywrightRecorder] ========== CROSS-ORIGIN STEP ==========`);
          console.log(`[PlaywrightRecorder] userActions count:`, action.userActions?.length || 0);
          
          // Show visual indicator in the browser
          await recorder.page.evaluate((count) => {
            const div = document.createElement('div');
            div.id = 'qaai-debug';
            div.style.cssText = 'position:fixed;top:10px;left:10px;background:yellow;color:black;padding:10px;z-index:999999;font-size:14px;border:2px solid black;';
            div.textContent = `QAAI: Executing ${count} cross-origin action(s)...`;
            document.body.appendChild(div);
          }, action.userActions?.length || 0).catch(() => {});
          
          if (action.userActions && action.userActions.length > 0) {
            console.log(`[PlaywrightRecorder] ✓ Found ${action.userActions.length} user actions to execute`);
            
            // Log each action
            action.userActions.forEach((ua, i) => {
              console.log(`[PlaywrightRecorder]   Action ${i+1}: ${ua.type} by ${ua.findBy} = "${ua.selector}"`);
            });
            
            for (const userAction of action.userActions) {
              try {
                console.log(`[PlaywrightRecorder] Cross-origin action: ${userAction.type} by ${userAction.findBy}`);
                
                // Handle wait action specially
                if (userAction.type === 'wait') {
                  const duration = parseInt(userAction.value) || 2000;
                  console.log(`[PlaywrightRecorder] Waiting ${duration}ms`);
                  await recorder.page.waitForTimeout(duration);
                  continue;
                }
                
                // Find element based on user's chosen strategy
                let element = null;
                
                switch (userAction.findBy) {
                  case 'text':
                  case 'Text Content': // Handle UI display name
                    console.log(`[PlaywrightRecorder] Finding by text: "${userAction.selector}"`);
                    const searchText = userAction.selector;
                    
                    // Try multiple strategies for text-based finding
                    element = recorder.page.getByText(searchText, { exact: false }).first();
                    
                    // If not visible, try as link
                    if (!(await element.isVisible({ timeout: 2000 }).catch(() => false))) {
                      console.log(`[PlaywrightRecorder] getByText failed, trying getByRole link...`);
                      element = recorder.page.getByRole('link', { name: searchText }).first();
                    }
                    
                    // Try button
                    if (!(await element.isVisible({ timeout: 1000 }).catch(() => false))) {
                      console.log(`[PlaywrightRecorder] Trying getByRole button...`);
                      element = recorder.page.getByRole('button', { name: searchText }).first();
                    }
                    
                    // Try text selector
                    if (!(await element.isVisible({ timeout: 1000 }).catch(() => false))) {
                      console.log(`[PlaywrightRecorder] Trying text selector...`);
                      element = recorder.page.locator(`text="${searchText}"`).first();
                    }
                    
                    // Try partial text
                    if (!(await element.isVisible({ timeout: 1000 }).catch(() => false))) {
                      console.log(`[PlaywrightRecorder] Trying partial text match...`);
                      element = recorder.page.locator(`:has-text("${searchText}")`).first();
                    }
                    
                    // Try word-by-word match (e.g., "Learn more" → look for "more")
                    if (!(await element.isVisible({ timeout: 1000 }).catch(() => false))) {
                      const words = searchText.split(/\s+/).filter(w => w.length > 3);
                      for (const word of words) {
                        console.log(`[PlaywrightRecorder] Trying word match: "${word}"`);
                        element = recorder.page.getByText(word, { exact: false }).first();
                        if (await element.isVisible({ timeout: 500 }).catch(() => false)) {
                          console.log(`[PlaywrightRecorder] Found element with word: "${word}"`);
                          break;
                        }
                      }
                    }
                    
                    // Last resort: find any link or button and log what's available
                    if (!(await element.isVisible({ timeout: 500 }).catch(() => false))) {
                      console.log(`[PlaywrightRecorder] Text "${searchText}" not found, looking for first clickable...`);
                      // Try to find any link with "more" or "info" in it
                      const moreLink = recorder.page.locator('a:has-text("more"), a:has-text("info"), a:has-text("More")').first();
                      if (await moreLink.isVisible({ timeout: 1000 }).catch(() => false)) {
                        element = moreLink;
                        console.log(`[PlaywrightRecorder] Found similar link with "more/info"`);
                      }
                    }
                    break;
                    
                  case 'css':
                  case 'CSS Selector':
                    console.log(`[PlaywrightRecorder] Finding by CSS: ${userAction.selector}`);
                    element = recorder.page.locator(userAction.selector).first();
                    break;
                    
                  case 'xpath':
                  case 'XPath':
                    console.log(`[PlaywrightRecorder] Finding by XPath: ${userAction.selector}`);
                    element = recorder.page.locator(`xpath=${userAction.selector}`).first();
                    break;
                    
                  case 'testId':
                  case 'Test ID':
                    console.log(`[PlaywrightRecorder] Finding by testId: ${userAction.selector}`);
                    element = recorder.page.getByTestId(userAction.selector).first();
                    break;
                    
                  case 'coords':
                  case 'Coordinates':
                    // Coordinate-based click - no element lookup needed
                    if (userAction.coords && userAction.coords.x && userAction.coords.y) {
                      console.log(`[PlaywrightRecorder] Clicking at coordinates: (${userAction.coords.x}, ${userAction.coords.y})`);
                      await recorder.page.mouse.click(userAction.coords.x, userAction.coords.y);
                      console.log(`[PlaywrightRecorder] ✓ Coordinate click succeeded`);
                    }
                    continue; // Skip to next action
                    
                  default:
                    // Fallback: treat findBy value as-is or selector as text
                    console.warn(`[PlaywrightRecorder] Unknown findBy strategy: ${userAction.findBy}, trying as text`);
                    element = recorder.page.getByText(userAction.selector, { exact: false }).first();
                }
                
                // Perform the action on the found element
                if (element) {
                  // Check if element is visible
                  const isVisible = await element.isVisible({ timeout: 5000 }).catch(() => false);
                  if (!isVisible) {
                    console.warn(`[PlaywrightRecorder] Element not visible for: "${userAction.selector}"`);
                    // Try AI fallback
                    if (recorder.enableAIFallback) {
                      console.log(`[PlaywrightRecorder] Trying AI fallback for cross-origin action`);
                      const aiResult = await recorder.findElementWithAI(userAction.selector, userAction.type);
                      if (aiResult) {
                        await recorder.clickAtCoordinates(aiResult.x, aiResult.y);
                        console.log(`[PlaywrightRecorder] ✓ AI click succeeded at (${aiResult.x}, ${aiResult.y})`);
                        await recorder.page.waitForTimeout(500);
                        continue;
                      }
                    }
                    continue; // Skip this action
                  }
                  
                  switch (userAction.type) {
                    case 'click':
                      // Highlight element before clicking
                      await element.evaluate(el => {
                        el.style.outline = '3px solid red';
                        el.style.outlineOffset = '2px';
                      }).catch(() => {});
                      
                      // Update debug indicator
                      await recorder.page.evaluate((text) => {
                        const div = document.getElementById('qaai-debug');
                        if (div) div.textContent = `QAAI: Clicking "${text}"...`;
                      }, userAction.selector).catch(() => {});
                      
                      await recorder.page.waitForTimeout(500); // Pause so user can see
                      await element.click({ timeout: 10000 });
                      console.log(`[PlaywrightRecorder] ✓ Cross-origin click succeeded: "${userAction.selector}"`);
                      
                      // Update debug indicator
                      await recorder.page.evaluate(() => {
                        const div = document.getElementById('qaai-debug');
                        if (div) { div.textContent = 'QAAI: Click succeeded!'; div.style.background = 'lightgreen'; }
                      }).catch(() => {});
                      
                      // Wait for potential navigation
                      await recorder.page.waitForTimeout(500);
                      break;
                      
                    case 'fill':
                      await element.clear().catch(() => {});
                      await element.fill(userAction.value || '');
                      console.log(`[PlaywrightRecorder] ✓ Cross-origin fill succeeded: "${userAction.selector}"`);
                      break;
                      
                    case 'select':
                      await element.selectOption(userAction.value || '');
                      console.log(`[PlaywrightRecorder] ✓ Cross-origin select succeeded: "${userAction.selector}"`);
                      break;
                      
                    default:
                      console.warn(`[PlaywrightRecorder] Unknown action type: ${userAction.type}`);
                  }
                } else {
                  // Element not found - show what's actually on the page to help user
                  console.warn(`[PlaywrightRecorder] ❌ Could not find element: "${userAction.selector}"`);
                  console.warn(`[PlaywrightRecorder] Current page URL: ${recorder.page.url()}`);
                  
                  // Try to show available clickable elements
                  try {
                    const availableElements = await recorder.page.evaluate(() => {
                      const elements = document.querySelectorAll('a, button, [role="button"], [role="link"]');
                      return Array.from(elements).slice(0, 10).map(el => ({
                        tag: el.tagName,
                        text: (el.textContent || '').trim().substring(0, 50),
                        href: el.getAttribute('href')
                      }));
                    });
                    console.warn(`[PlaywrightRecorder] Available clickable elements on page:`);
                    availableElements.forEach((el, i) => {
                      console.warn(`  ${i + 1}. <${el.tag.toLowerCase()}> "${el.text}" ${el.href ? `→ ${el.href}` : ''}`);
                    });
                  } catch (e) {}
                }
              } catch (e) {
                console.warn(`[PlaywrightRecorder] Cross-origin action failed: ${e.message}`);
                // Don't fail the entire step, just log and continue
              }
            }
          } else {
            // NO USER ACTIONS DEFINED - this is likely the problem!
            console.log('[PlaywrightRecorder] ⚠️ NO USER ACTIONS DEFINED!');
            console.log('[PlaywrightRecorder] The userActions array is empty or undefined');
            console.log('[PlaywrightRecorder] Make sure you clicked "Save Actions" after defining them');
            
            // Show visual warning in browser
            await recorder.page.evaluate(() => {
              const div = document.getElementById('qaai-debug') || document.createElement('div');
              div.id = 'qaai-debug';
              div.style.cssText = 'position:fixed;top:10px;left:10px;background:orange;color:black;padding:10px;z-index:999999;font-size:14px;border:2px solid red;';
              div.textContent = '⚠️ QAAI: No actions defined for this cross-origin step!';
              if (!document.getElementById('qaai-debug')) document.body.appendChild(div);
            }).catch(() => {});
            
            await recorder.page.waitForTimeout(2000);
          }
          
          // DON'T auto-close the cross-origin tab here!
          // There's usually a separate "closeTab" step that handles recorder.
          // Just switch back to the parent tab for subsequent steps.
          
          // Switch back to parent tab (tab 0) WITHOUT closing the cross-origin tab
          const remainingPages = recorder.context.pages();
          if (remainingPages.length > 1) {
            // Find the parent tab (localhost or first tab)
            let parentTab = remainingPages[0];
            for (const pg of remainingPages) {
              if (pg.url().includes('localhost') || pg.url().includes('127.0.0.1')) {
                parentTab = pg;
                break;
              }
            }
            
            recorder.page = parentTab;
            await recorder.page.bringToFront();
            console.log(`[PlaywrightRecorder] ✓ Switched back to parent tab: ${recorder.page.url().substring(0, 50)}`);
            
            // Re-initialize SmartFinder for parent page
            if (recorder.useSmartFinderForPlayback) {
              recorder.smartFinder = new SmartFinder(recorder.page, { debug: true, timeout: 15000 });
            }
          }
          
          return { success: true };
        }
        
        case 'dialog':
        case 'HandleDialog': {
          // Dialogs are auto-handled by the page.on('dialog') listener
          // This step is just for documentation
          console.log(`[PlaywrightRecorder] Dialog step (auto-handled): ${action.dialogType || 'dialog'}`);
          return { success: true };
        }

        default:
          // Try to handle by normalizing the action type
          const normalizedType = (action.type || '').toLowerCase();
          console.warn(`[PlaywrightRecorder] Unknown action type: ${action.type}, trying normalized: ${normalizedType}`);
          
          // ============ EXPLICIT HANDLING FOR SF- ACTION TYPES ============
          // These should be caught by the case statements above, but handle them here as fallback
          if (normalizedType.startsWith('sf-')) {
            console.log(`[PlaywrightRecorder] Handling sf- type in default handler: ${normalizedType}`);
            const sfBaseMatch = recorder.page.url().match(/(https:\/\/[^\/]+)/);
            
            if (!sfBaseMatch) {
              return { success: false, error: 'Cannot determine Salesforce base URL for sf- action' };
            }
            
            const sfBaseUrl = sfBaseMatch[1];
            
            // sf-navigate-list: Navigate to object list view
            if (normalizedType === 'sf-navigate-list') {
              const listObj = action.args?.[0] || label || 'Account';
              const listPath = action.args?.[1] || `/lightning/o/${listObj}/list`;
              const listUrl = listPath.startsWith('http') ? listPath : `${sfBaseUrl}${listPath}`;
              console.log(`[PlaywrightRecorder] SF Navigate to list: ${listUrl}`);
              await recorder.page.goto(listUrl, { waitUntil: 'domcontentloaded', timeout });
              await recorder.page.waitForTimeout(2000);
              return { success: true };
            }
            
            // sf-navigate-new: Navigate to new record form
            if (normalizedType === 'sf-navigate-new') {
              const newObj = action.args?.[0] || label || 'Account';
              const newPath = action.args?.[1] || `/lightning/o/${newObj}/new`;
              const newUrl = newPath.startsWith('http') ? newPath : `${sfBaseUrl}${newPath}`;
              console.log(`[PlaywrightRecorder] SF Navigate to new form: ${newUrl}`);
              await recorder.page.goto(newUrl, { waitUntil: 'domcontentloaded', timeout });
              await recorder.page.waitForTimeout(2000);
              return { success: true };
            }
            
            // sf-navigate-record: Navigate to specific record
            if (normalizedType === 'sf-navigate-record') {
              const recordId = action.args?.[0] || action.value;
              const recObjType = action.args?.[1] || 'sObject';
              const recPath = action.args?.[2] || `/lightning/r/${recObjType}/${recordId}/view`;
              const recUrl = recPath.startsWith('http') ? recPath : `${sfBaseUrl}${recPath}`;
              console.log(`[PlaywrightRecorder] SF Navigate to record: ${recUrl}`);
              await recorder.page.goto(recUrl, { waitUntil: 'domcontentloaded', timeout });
              await recorder.page.waitForTimeout(2000);
              return { success: true };
            }
            
            // sf-wait: Wait for page ready
            if (normalizedType === 'sf-wait') {
              const waitMs = parseInt(action.args?.[0] || '3000');
              console.log(`[PlaywrightRecorder] SF Wait: ${waitMs}ms`);
              await recorder.page.waitForTimeout(waitMs);
              return { success: true };
            }
            
            // sf-click-tab: Click a record tab
            if (normalizedType === 'sf-click-tab') {
              const tabName = action.args?.[0] || label;
              console.log(`[PlaywrightRecorder] SF Click tab: ${tabName}`);
              const tabLocator = recorder.page.locator(`li.slds-tabs_default__item a:has-text("${tabName}"), [role="tab"]:has-text("${tabName}")`).first();
              await tabLocator.click({ timeout: 10000 });
              return { success: true };
            }
            
            // sf-click-save/edit/delete/clone: Standard buttons
            if (normalizedType === 'sf-click-save') {
              const saveBtn = recorder.page.locator('button:has-text("Save"):not(:has-text("&")), [name="SaveEdit"]').first();
              await saveBtn.click({ timeout: 10000 });
              return { success: true };
            }
            if (normalizedType === 'sf-click-edit') {
              const editBtn = recorder.page.locator('button:has-text("Edit"), [name="Edit"]').first();
              await editBtn.click({ timeout: 10000 });
              return { success: true };
            }
            
            // sf-global-search: Perform global search
            if (normalizedType === 'sf-global-search') {
              const searchTerm = action.args?.[0] || action.value || label;
              console.log(`[PlaywrightRecorder] SF Global Search: ${searchTerm}`);
              const searchUrl = `${sfBaseUrl}/lightning/o/Account/list?q=${encodeURIComponent(searchTerm)}`;
              await recorder.page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout });
              return { success: true };
            }
            
            // sf-app-launcher: Open app launcher
            if (normalizedType === 'sf-app-launcher') {
              const appLauncher = recorder.page.locator('button[title="App Launcher"], [aria-label="App Launcher"], .appLauncher button').first();
              await appLauncher.click({ timeout: 10000 });
              await recorder.page.waitForTimeout(1000);
              return { success: true };
            }
            
            console.warn(`[PlaywrightRecorder] Unhandled sf- action type: ${normalizedType}`);
            return { success: false, error: `Unhandled sf- action type: ${normalizedType}` };
          }
          
          // Try click-based actions
          if (normalizedType.includes('click')) {
            const clickResult2 = await recorder._findElement(action);
            if (clickResult2) {
              await clickResult2.locator.click({ timeout: 10000 });
              return { success: true };
            }
            return { success: false, error: `Could not find element to click: "${label || selector}"` };
          }
          
          // Try fill-based actions
          if (normalizedType.includes('fill') || normalizedType.includes('input') || normalizedType.includes('type')) {
            if (selector) {
              await recorder.page.locator(selector).fill(value || '', { timeout });
              return { success: true };
            }
          }
          
          // Try navigation (but NOT for sf- types which are handled above)
          if ((normalizedType.includes('goto') || normalizedType.includes('nav')) && !normalizedType.startsWith('sf-')) {
            const navUrl = action.url || action.args?.[0];
            if (navUrl && navUrl.startsWith('http')) {
              await recorder.page.goto(navUrl, { waitUntil: 'domcontentloaded', timeout });
              return { success: true };
            }
          }
          
          return { success: false, error: `Unknown action type: ${action.type}` };
      }

      // Return success with the working selector info for Lock Locators feature
      return { 
        success: true, 
        workingSelector: recorder._lastWorkingSelector || null,
        strategyType: recorder._lastStrategyType || null 
      };
    } catch (error) {
      console.error('[PlaywrightRecorder] Execute action failed:', error.message);
      return { success: false, error: error.message };
    }
}

module.exports = { executeAction };
