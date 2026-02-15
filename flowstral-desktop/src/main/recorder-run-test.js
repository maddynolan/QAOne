/**
 * Extracted: runTest method from PlaywrightRecorder
 * Test execution loop — runs through recorded steps and executes them.
 *
 * Receives `recorder` (the PlaywrightRecorder instance) as first param instead of `this`.
 */

const path = require('path');
const fs = require('fs');
const { SimpleStepExecutor } = require('./lib/simple-step-executor');

async function runTest(recorder, options = {}) {
    const {
      url,
      steps,
      headless = false,
      timeout = 30000,
      isRetry = false,
      // NEW: Fresh browser mode - completely clean state, no cookies/storage
      // Use for: Test Playground, e-commerce, functional tests
      // Don't use for: Salesforce, SSO apps (need login persistence)
      freshBrowser = false,
      // NEW: Keep browser open on failure - allows visual debugging
      // When true: browser stays open, user can use Element Picker/Debug/AI
      // When false (default): browser closes, only Manual edit works
      keepBrowserOpenOnFailure = false,
      // NEW: Playback speed control - slowMo delay in ms between steps
      // 0 = fastest (2x), 200 = normal (1x), 500 = slow (0.5x), 1000 = very slow (0.25x)
      slowMo = 0,
      // NEW: Highlight elements during playback (visual feedback)
      highlight = true,
      // NEW: Flagged steps for false positive handling
      // Array of step IDs that user flagged as false positives
      flaggedSteps = [],
      // NEW: Stop at flagged step - when true, test pauses at flagged step for repair
      stopAtFlagged = false,
      // V2 SIMPLE PLAYBACK: Use Playwright-native element finding for 3-10x faster playback
      // When true: parallel strategy racing with auto-wait (no manual count/isVisible snapshots)
      // When false: existing 4-layer waterfall (Quick Scan → SmartFinder → Legacy → AI)
      useSimplePlayback = recorder.useSimplePlayback || false
    } = options;

    console.log('[PlaywrightRecorder] Running test with', steps?.length || 0, 'steps',
      isRetry ? '(RETRY)' : '', freshBrowser ? '(FRESH BROWSER)' : '(PERSISTENT)',
      `slowMo=${slowMo}ms`, flaggedSteps.length > 0 ? `flagged=${flaggedSteps.length}` : '',
      useSimplePlayback ? '⚡ SIMPLE-PLAYBACK' : '');

    // Reset AI call counter for this test run
    recorder.aiCallsThisRun = 0;
    // Reset SimpleStepExecutor for this test run
    recorder._simpleStepExecutor = null;
    // Reset AI Step Guarantor for this test run
    const { resetAIStepGuarantor } = require('./lib/ai-step-guarantor');
    resetAIStepGuarantor();

    // CRITICAL: Set flag to prevent recording navigations during test run
    recorder._isRunningTest = true;

    try {
      // If browser is already open (from recording), close it if we need fresh browser
      if (freshBrowser && recorder.context) {
        console.log('[PlaywrightRecorder] Closing existing browser for fresh start...');
        await recorder.context.close().catch(() => {});
        recorder.context = null;
        recorder.page = null;
        recorder.browser = null;
      }

      let needsNewBrowser = !recorder.page || recorder.page.isClosed();

      if (needsNewBrowser) {
        const { chromium } = require('playwright');

        if (freshBrowser) {
          // FRESH BROWSER MODE: Completely clean state - no cookies, localStorage, etc.
          console.log('[PlaywrightRecorder] Launching FRESH browser (clean state)...');

          // CRITICAL: Reset SmartFinder so it gets recreated with the new page
          recorder.smartFinder = null;

          // STEALTH MODE ARGS
          const stealthArgs = [
            '--start-maximized',
            '--disable-blink-features=AutomationControlled',
            '--disable-features=IsolateOrigins,site-per-process',
            '--disable-infobars',
            '--no-sandbox',
            '--disable-setuid-sandbox',
          ];

          // Get mobile emulation options (backward compatible)
          const mobileOptions = recorder.getMobileContextOptions();
          const isMobile = recorder.isInMobileMode();

          if (isMobile) {
            console.log(`[PlaywrightRecorder] Fresh browser in mobile mode: ${recorder.mobileDevice.name}`);
          }

          // Launch browser with fallback to system Chrome/Edge
          // Uses helper that tries Playwright browsers first, then falls back
          const launchOpts = {
            headless,
            args: stealthArgs,
            // Mobile: use device viewport, Desktop: full window
            viewport: isMobile ? mobileOptions.viewport : null,
            userAgent: isMobile ? mobileOptions.userAgent : 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
            // Mobile-specific options
            ...(isMobile && {
              deviceScaleFactor: mobileOptions.deviceScaleFactor,
              isMobile: mobileOptions.isMobile,
              hasTouch: mobileOptions.hasTouch
            }),
            ignoreHTTPSErrors: true,
          };

          // launchBrowserWithFallback is a module-level function in the original file
          // We need to call it via the recorder's module scope
          const { launchBrowserWithFallback } = require('./playwright-recorder-helpers');
          recorder.context = await launchBrowserWithFallback(launchOpts, null);
          recorder.browser = recorder.context._browser || null;

          // STEALTH: Add anti-detection script
          await recorder.context.addInitScript(() => {
            Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
            window.chrome = { runtime: {}, loadTimes: function() {}, csi: function() {}, app: {} };
          });

          recorder.page = await recorder.context.newPage();
          console.log('[PlaywrightRecorder] Fresh browser ready - no stored state (stealth mode)');

        } else {
          // PERSISTENT MODE: Keep login sessions, cookies, etc.
          console.log('[PlaywrightRecorder] Launching browser with persistent context...');

          // CRITICAL: Reset SmartFinder so it gets recreated with the new page
          recorder.smartFinder = null;

          const { app } = require('electron');
          const userDataDir = path.join(app.getPath('userData'), 'playwright-browser-data');

          console.log('[PlaywrightRecorder] Using persistent user data dir:', userDataDir);

          // Get mobile emulation options (backward compatible: empty object = desktop)
          const mobileOptions = recorder.getMobileContextOptions();
          const isMobile = recorder.isInMobileMode();

          if (isMobile) {
            console.log(`[PlaywrightRecorder] Test running in mobile mode: ${recorder.mobileDevice.name}`);
          }

          // STEALTH MODE ARGS for persistent context
          const persistentStealthArgs = [
            '--start-maximized',
            '--disable-blink-features=AutomationControlled',
            '--disable-features=IsolateOrigins,site-per-process',
            '--disable-infobars',
            '--no-sandbox',
          ];

          // Use fallback helper for system Chrome/Edge when Playwright browsers not bundled
          const { launchBrowserWithFallback } = require('./playwright-recorder-helpers');
          recorder.context = await launchBrowserWithFallback({
            headless,
            // Mobile: use device viewport, Desktop: full window
            viewport: isMobile ? mobileOptions.viewport : null,
            args: persistentStealthArgs,
            // Mobile: use device user agent, Desktop: Chrome UA
            userAgent: isMobile ? mobileOptions.userAgent : 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
            // Mobile-specific options
            ...(isMobile && {
              deviceScaleFactor: mobileOptions.deviceScaleFactor,
              isMobile: mobileOptions.isMobile,
              hasTouch: mobileOptions.hasTouch
            }),
            ignoreHTTPSErrors: true,
          }, userDataDir);

          // STEALTH: Add anti-detection script
          await recorder.context.addInitScript(() => {
            Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
            window.chrome = { runtime: {}, loadTimes: function() {}, csi: function() {}, app: {} };
          });

          // With persistent context, get existing page or create new one
          const pages = recorder.context.pages();
          recorder.page = pages.length > 0 ? pages[0] : await recorder.context.newPage();
          recorder.browser = null; // Not needed with persistent context
          console.log('[PlaywrightRecorder] Persistent browser ready (stealth mode)');
        }
      } else {
        console.log('[PlaywrightRecorder] Using existing browser for test');
      }

      // Navigate to start URL
      if (url) {
        console.log(`[PlaywrightRecorder] Navigating to: ${url}`);
        await recorder.page.goto(url, { waitUntil: 'domcontentloaded', timeout: 10000 });

        // For fresh browser, no need to clear - it's already clean
        // For persistent browser, we keep the state (login sessions, etc.)
        if (freshBrowser) {
          console.log('[PlaywrightRecorder] Fresh browser - starting with clean state');
        }
      }

      // Wait for page to be stable before executing steps
      try {
        await recorder.page.waitForLoadState('domcontentloaded', { timeout: 5000 }).catch(() => {});
        await recorder.page.waitForTimeout(300); // One-time settle for initial page load (reduced from 500ms)
      } catch (e) {
        console.log('[PlaywrightRecorder] Page stability wait skipped:', e.message);
      }

      // Execute each step
      let passedSteps = 0;
      let failedStep = -1;
      let failError = '';
      // Track step results with workingSelector for Lock Locators feature
      const stepResults = new Array(steps.length).fill(null).map((_, i) => ({ index: i, status: 'pending' }));

      for (let i = 0; i < steps.length; i++) {
        const step = steps[i];

        // Check if page is still valid before each step
        if (!recorder.page || recorder.page.isClosed()) {
          console.log('[PlaywrightRecorder] Page was closed unexpectedly, stopping test');
          failedStep = i;
          failError = 'Page was closed unexpectedly';
          break;
        }

        // ═══════════════════════════════════════════════════════════════════════════
        // FLAGGED STEP CHECK: Stop at steps marked as false positive for repair
        // This allows users to fix steps using Smart Suggestions with browser open
        // ═══════════════════════════════════════════════════════════════════════════
        const isStepFlagged = step.flagged ||
                              (step.id && flaggedSteps.includes(step.id)) ||
                              (step.id && flaggedSteps.some(f => f === step.id || f.stepId === step.id));

        if (isStepFlagged && stopAtFlagged) {
          console.log(`[PlaywrightRecorder] 🚩 STOPPING at flagged step ${i + 1}: "${step.description || step.qword}"`);
          console.log(`[PlaywrightRecorder] Browser is PAUSED for user intervention - use Smart Suggestions to fix`);

          // Emit paused event so frontend can show repair UI
          recorder.emit('test-paused', {
            stepIndex: i,
            step,
            reason: 'flagged_step',
            message: `Paused at flagged step ${i + 1} for repair. Use Smart Suggestions to replace this step.`,
            browserOpen: true
          });

          // Store pause state so we can potentially resume later
          recorder._pausedAtFlaggedStep = {
            stepIndex: i,
            step,
            passedSteps: passedSteps
          };

          // Return partial results - test is PAUSED, not failed
          // Include stepResults with workingSelector for steps that passed
          return {
            success: false,
            status: 'paused_at_flagged',
            passedSteps,
            failedStep: -1,
            error: null,
            totalSteps: steps.length,
            stepResults,  // Include step results for Lock Locators
            stoppedAtFlaggedStep: {
              index: i,
              step,
              reason: 'User flagged this step as false positive'
            },
            // CRITICAL: Keep browser open for Smart Suggestions!
            browserKeptOpen: true
          };
        }

        console.log(`[PlaywrightRecorder] Executing step ${i + 1}: ${step.description || step.qword}`);

        // DEBUG: Log full step data for cross-origin steps
        if (step.qword === 'CrossOrigin' || step.type === 'crossOriginPlaceholder' ||
            (step.description || '').includes('Cross-origin') || (step.description || '').includes('external tab')) {
          console.log(`[PlaywrightRecorder] ⚠️ CROSS-ORIGIN STEP DETECTED:`);
          console.log(`[PlaywrightRecorder]   step.type = "${step.type}"`);
          console.log(`[PlaywrightRecorder]   step.qword = "${step.qword}"`);
          console.log(`[PlaywrightRecorder]   step.userActions = ${JSON.stringify(step.userActions)}`);
          console.log(`[PlaywrightRecorder]   step.description = "${step.description}"`);
        }

        recorder.emit('test-step-start', { stepIndex: i, step });

        try {
          // Determine step type from multiple sources (Builder format vs Recorder format)
          // CRITICAL: CrossOrigin/crossOriginPlaceholder must be preserved!
          let stepType;
          if (step.qword === 'CrossOrigin' || step.type === 'crossOriginPlaceholder' || step.type === 'CrossOrigin') {
            stepType = 'crossOriginPlaceholder'; // Force correct type
            console.log(`[PlaywrightRecorder]   → Forcing stepType to 'crossOriginPlaceholder'`);
          } else {
            stepType = step.type || // Builder format: 'click', 'fill', 'navigate', etc.
                            (step.qword?.toLowerCase() === 'goto' ? 'navigate' :
                             step.qword?.toLowerCase() === 'fill' ? 'fill' :
                             step.qword?.toLowerCase() === 'select' ? 'select' :
                             step.qword?.toLowerCase() === 'asserttext' ? 'assert' :
                             step.qword?.toLowerCase() === 'wait' ? 'wait' :
                             step.qword?.toLowerCase() || 'click');
          }

          // CRITICAL: Use step.value (edited value) if available, else fall back to args
          // This ensures edited values from Builder are used, not just recorded values
          const fillValue = step.value || step.args?.[1] || '';
          const urlValue = step.url || step.args?.[0] || '';

          // CRITICAL FIX: Check ALL possible sources of element text
          // CDP-recorded: args[0] has the text
          // Recipe-recorded: text, label, selectorObj.text, element.text have the text
          let labelValue = step.target ||
                           step.args?.[0] ||
                           step.text ||                    // Recipe recorder stores here
                           step.label ||                   // Recipe recorder stores here
                           step.selectorObj?.text ||       // Recipe recorder stores here
                           step.element?.text;             // Recipe recorder stores here

          // Last resort: Extract from description like 'Click "Go To Saver's Switch"'
          if (!labelValue && step.description) {
            const descMatch = step.description.match(/(?:Click|Fill|Select|Type)\s*"([^"]+)"/i);
            if (descMatch) {
              labelValue = descMatch[1];
            } else {
              labelValue = step.description;
            }
          }
          labelValue = labelValue || '';

          // Convert step to action format
          // Normalize selector - could be string or object with nested selector property
          const normalizedSelector = typeof step.selector === 'string'
            ? step.selector
            : (step.selector?.selector || step.selectorObj?.selector || '');

          const action = {
            type: stepType,
            label: labelValue,
            text: labelValue,
            value: fillValue,
            url: ['navigate', 'goto'].includes(stepType) ? urlValue : undefined,
            selector: normalizedSelector,
            timeout,
            // CRITICAL: Pass step.args for SF steps and other complex actions
            args: step.args,
            // CRITICAL: Pass element data for SmartFinder role-based search
            element: step.element || {},
            selectorObj: step.selectorObj || step.selector || {},
            // Pass recipe directly if available (from Recipe Recorder v2)
            recipe: step.recipe || step.target || null,
            // Pass elementIndex for duplicate element handling
            elementIndex: step.elementIndex ?? step.args?.[1] ?? null,
            // CRITICAL: Context tracking for multi-tab and iframe support
            frameContext: step.frameContext || null,
            tabIndex: step.tabIndex ?? null,
            // CRITICAL: Pass userActions for cross-origin placeholder steps!
            userActions: step.userActions || []
          };

          // DEBUG: Confirm userActions are passed for cross-origin
          if (stepType === 'crossOriginPlaceholder' || action.userActions?.length > 0) {
            console.log(`[PlaywrightRecorder] ✓ Action userActions: ${JSON.stringify(action.userActions)}`);
          }

          console.log(`[PlaywrightRecorder] Step ${i + 1} action:`, { type: action.type, label: action.label, value: action.value ? '***' : '(empty)' });

          // ═══════════════════════════════════════════════════════════════════
          // CRITICAL: Reset selector tracking for each step to prevent stale
          // selectors from a previous step leaking into the current one.
          // Without this, step N's _lastWorkingSelector can be incorrectly
          // attributed to step N+1, causing inconsistent Lock Locators counts.
          // ═══════════════════════════════════════════════════════════════════
          recorder._lastWorkingSelector = null;
          recorder._lastStrategyType = null;
          recorder._lockedSelectorFailed = false;

          // Skip first navigate if we already navigated
          if (i === 0 && ['navigate', 'goto'].includes(action.type) && url && action.url === url) {
            console.log('[PlaywrightRecorder] Skipping first navigate (already navigated)');
            passedSteps++;
            // Track step result with null selector (navigate doesn't need one)
            stepResults[i] = { index: i, status: 'passed', workingSelector: null, strategyType: 'navigate' };
            recorder.emit('test-step-complete', { stepIndex: i, success: true, workingSelector: null, strategyType: 'navigate' });
            continue;
          }

          // ═══════════════════════════════════════════════════════════════════
          // V2 SIMPLE PLAYBACK: Use Playwright-native element finding
          // When enabled, uses parallel strategy racing with auto-wait
          // instead of sequential waterfall with manual count()+isVisible()
          // Falls back to existing executeAction for non-element actions
          // ═══════════════════════════════════════════════════════════════════
          let result;
          if (useSimplePlayback) {
            // Lazy-init SimpleStepExecutor for this test run
            if (!recorder._simpleStepExecutor) {
              recorder._simpleStepExecutor = new SimpleStepExecutor(recorder);
              console.log('[PlaywrightRecorder] ⚡ V2 Simple Playback ENABLED — Playwright-native execution');
            }
            result = await recorder._simpleStepExecutor.executeAction(action);
          } else {
            result = await recorder.executeAction(action);
          }

          // EXECUTE STEP ASSERTIONS if defined
          if (step.assertion && step.assertion.type && step.assertion.enabled !== false) {
            console.log(`[PlaywrightRecorder] Executing assertion for step ${i + 1}:`, step.assertion);
            // Pass step's selector as fallback for value-based assertions
            // Use normalized selector (already computed above as string)
            const stepSelector = normalizedSelector || step.selectorObj?.selector || '';
            const assertionResult = await recorder.executeAssertion(step.assertion, stepSelector);
            if (!assertionResult.success) {
              throw new Error(`Assertion failed: ${assertionResult.error || step.assertion.expected}`);
            }
            console.log(`[PlaywrightRecorder] Assertion passed for step ${i + 1}`);
          }

          if (result.success === false) {
            throw new Error(result.error || 'Step failed');
          }

          // Get the working selector from executeAction result
          let workingSelector = result.workingSelector || recorder._lastWorkingSelector || null;
          let strategyType = result.strategyType || recorder._lastStrategyType || null;

          // LAST RESORT: If no selector was captured, build one from the step's label/description.
          // This catches Salesforce Lightning elements and other shadow DOM components
          // where DOM attributes are inaccessible but the action label matches the visible text.
          if (!workingSelector) {
            const so = action.selectorObj || step.selectorObj || {};
            const stepLabel = action.label || action.text || so.text || action.args?.[0] || step.description || step.name || '';
            const actionType = (action.type || action.qword || '').toLowerCase();
            const isNavStep = actionType === 'navigate' || actionType === 'goto' || actionType === 'navigation';
            if (!isNavStep && stepLabel.length > 1 && stepLabel.length < 80) {
              // Try to extract quoted text first (e.g. 'Click "Accounts"' → 'Accounts')
              const quotedMatch = stepLabel.match(/[""](.+?)[""]|'(.+?)'/);
              const cleanLabel = quotedMatch ? (quotedMatch[1] || quotedMatch[2]) : stepLabel;
              if (cleanLabel && cleanLabel.length > 1) {
                workingSelector = `text="${cleanLabel}"`;
                strategyType = 'description-text';
                console.log(`[PlaywrightRecorder] Lock Locators last-resort: text="${cleanLabel}"`);
              }
            }
          }

          // Self-healing: locked selector failed but SmartFinder worked
          const healed = result.healed || false;
          const newSelector = result.newSelector || null;

          // AI Step Guarantor flags
          const aiResolved = result.aiResolved || false;
          const aiDetails = result.aiDetails || null;

          passedSteps++;
          // Track step result with workingSelector for Lock Locators
          // Include healing info so frontend can auto-update locked selectors
          // Include AI flags so frontend shows AI badges on AI-assisted steps
          stepResults[i] = {
            index: i,
            status: 'passed',
            workingSelector,
            strategyType,
            healed,       // TRUE if locked selector failed but SmartFinder worked
            newSelector,  // The new selector to use (auto-update locked selector)
            aiResolved,   // AI resolution type: false | 'ai-dom' | 'ai-vision' | 'ai-corrected' | 'ai-verified'
            aiDetails     // AI details: { method, latencyMs, reason, model, estimatedCost }
          };
          recorder.emit('test-step-complete', {
            stepIndex: i,
            success: true,
            workingSelector,
            strategyType,
            healed,
            newSelector,
            aiResolved,
            aiDetails
          });

          // Wait between steps - use slowMo for playback speed control
          // slowMo: 0 = fastest (2x), 200 = normal (1x), 500 = slow (0.5x), 1000 = very slow (0.25x)
          // FAST PATH: Minimal delay when locked selector was used (proven reliable, less variance)
          const usedLockedSelector = (strategyType === 'LockedSelector' || strategyType === 'already-locked' || strategyType === 'locked-selector');
          const usedQuickScan = strategyType && strategyType.startsWith('QuickScan-');
          const usedSimplePlayback = useSimplePlayback && strategyType && !strategyType.startsWith('healed-');
          const minDelay = (usedLockedSelector || usedQuickScan || usedSimplePlayback) ? 30 : 100;
          const stepDelay = Math.max(minDelay, slowMo);
          await recorder.page.waitForTimeout(stepDelay);

        } catch (stepError) {
          console.error(`[PlaywrightRecorder] Step ${i + 1} failed:`, stepError.message);
          failedStep = i;
          failError = stepError.message;

          // Capture failure state for debugging with ENHANCED scroll-to-element
          let failureScreenshot = null;
          let failureUrl = null;
          let elementLocation = null; // Track where we scrolled to
          try {
            if (recorder.page && !recorder.page.isClosed()) {
              const failedStepData = steps[i];
              let scrolledToElement = false;

              // ═══════════════════════════════════════════════════════════════════════
              // ENHANCED SCROLL-TO-ELEMENT: Multiple strategies to find the target area
              // ═══════════════════════════════════════════════════════════════════════

              try {
                // STRATEGY 1: Use CSS selector if available
                const selector = failedStepData?.selector ||
                                failedStepData?.selectorObj?.selector ||
                                failedStepData?.manualSelector;
                if (selector && !scrolledToElement) {
                  try {
                    const element = recorder.page.locator(selector).first();
                    if (await element.count() > 0) {
                      await element.scrollIntoViewIfNeeded();
                      const box = await element.boundingBox();
                      if (box) {
                        elementLocation = { x: box.x, y: box.y, width: box.width, height: box.height };
                        scrolledToElement = true;
                        console.log('[PlaywrightRecorder] ✓ Scrolled to element via selector');
                      }
                    }
                  } catch (e) { /* Try next strategy */ }
                }

                // STRATEGY 2: Use bounding box from recording
                if (!scrolledToElement && failedStepData?.recipe?.confirm?.boundingBox) {
                  const box = failedStepData.recipe.confirm.boundingBox;
                  await recorder.page.evaluate(({ x, y }) => {
                    window.scrollTo({
                      top: Math.max(0, y - 200),
                      left: Math.max(0, x - 100),
                      behavior: 'instant'
                    });
                  }, { x: box.x, y: box.y });
                  elementLocation = box;
                  scrolledToElement = true;
                  console.log('[PlaywrightRecorder] ✓ Scrolled to bounding box from recording');
                  await recorder.page.waitForTimeout(100);
                }

                // STRATEGY 3: Search for text and scroll to it
                const searchText = failedStepData?.text ||
                                  failedStepData?.label ||
                                  failedStepData?.recipe?.what?.text ||
                                  failedStepData?.recipe?.where?.nearText;
                if (!scrolledToElement && searchText) {
                  const result = await recorder.page.evaluate((text) => {
                    // Try exact match first
                    const exactXPath = `//*[contains(text(), "${text.replace(/"/g, '\\"')}")]`;
                    try {
                      const result = document.evaluate(exactXPath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
                      if (result.singleNodeValue) {
                        const el = result.singleNodeValue;
                        el.scrollIntoView({ behavior: 'instant', block: 'center' });
                        const rect = el.getBoundingClientRect();
                        return { found: true, x: rect.x + window.scrollX, y: rect.y + window.scrollY, width: rect.width, height: rect.height };
                      }
                    } catch (e) {}

                    // Fallback: TreeWalker for partial match
                    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
                    let node;
                    while (node = walker.nextNode()) {
                      if (node.textContent?.toLowerCase().includes(text.toLowerCase())) {
                        const el = node.parentElement;
                        if (el && el.offsetParent !== null) { // visible element
                          el.scrollIntoView({ behavior: 'instant', block: 'center' });
                          const rect = el.getBoundingClientRect();
                          return { found: true, x: rect.x + window.scrollX, y: rect.y + window.scrollY, width: rect.width, height: rect.height };
                        }
                      }
                    }
                    return { found: false };
                  }, searchText);

                  if (result.found) {
                    elementLocation = { x: result.x, y: result.y, width: result.width, height: result.height };
                    scrolledToElement = true;
                    console.log('[PlaywrightRecorder] ✓ Scrolled to text match:', searchText.substring(0, 30));
                    await recorder.page.waitForTimeout(100);
                  }
                }

                // STRATEGY 4: Try aria-label
                const ariaLabel = failedStepData?.selectorObj?.ariaLabel ||
                                 failedStepData?.recipe?.which?.ariaLabel;
                if (!scrolledToElement && ariaLabel) {
                  try {
                    const element = recorder.page.locator(`[aria-label*="${ariaLabel}" i]`).first();
                    if (await element.count() > 0) {
                      await element.scrollIntoViewIfNeeded();
                      const box = await element.boundingBox();
                      if (box) {
                        elementLocation = { x: box.x, y: box.y, width: box.width, height: box.height };
                        scrolledToElement = true;
                        console.log('[PlaywrightRecorder] ✓ Scrolled to aria-label match');
                      }
                    }
                  } catch (e) { /* Try next */ }
                }

                // STRATEGY 5: Try data-testid
                const testId = failedStepData?.selectorObj?.testId ||
                              failedStepData?.recipe?.which?.testId;
                if (!scrolledToElement && testId) {
                  try {
                    const element = recorder.page.locator(`[data-testid="${testId}"], [data-test="${testId}"]`).first();
                    if (await element.count() > 0) {
                      await element.scrollIntoViewIfNeeded();
                      const box = await element.boundingBox();
                      if (box) {
                        elementLocation = { x: box.x, y: box.y, width: box.width, height: box.height };
                        scrolledToElement = true;
                        console.log('[PlaywrightRecorder] ✓ Scrolled to testId match');
                      }
                    }
                  } catch (e) { /* Ignore */ }
                }

                if (!scrolledToElement) {
                  console.log('[PlaywrightRecorder] Could not scroll to element, using current viewport');
                }

              } catch (scrollError) {
                console.log('[PlaywrightRecorder] Scroll error:', scrollError.message);
              }

              // Take screenshot
              const buf = await recorder.page.screenshot();
              failureScreenshot = `data:image/png;base64,${buf.toString('base64')}`;
              failureUrl = recorder.page.url();
            }
          } catch (e) {
            console.error('[PlaywrightRecorder] Failed to capture failure screenshot:', e.message);
          }

          // OPTION C: Find similar elements for Visual Selector Cards
          let similarElements = [];
          try {
            if (recorder.page && !recorder.page.isClosed()) {
              similarElements = await recorder._findSimilarElements(failedStepData);
              console.log(`[PlaywrightRecorder] Found ${similarElements.length} similar elements for Option C`);
            }
          } catch (e) {
            console.log('[PlaywrightRecorder] Could not find similar elements:', e.message);
          }

          // Store failure state for B+C Hybrid Editor
          recorder._lastFailureState = {
            stepIndex: failedStep,
            step: steps[failedStep],
            error: failError,
            screenshot: failureScreenshot,
            url: failureUrl,
            timestamp: Date.now(),
            allSteps: steps,
            passedSteps: passedSteps,
            similarElements: similarElements, // For Option C cards
            elementLocation: elementLocation, // Where we scrolled to (if found)
            scrolledToElement: !!elementLocation // Whether we successfully scrolled
          };

          // Track failed step result
          stepResults[i] = {
            index: i,
            status: 'failed',
            error: stepError.message,
            screenshot: failureScreenshot,
            workingSelector: null,
            strategyType: null
          };

          recorder.emit('test-step-complete', {
            stepIndex: i,
            success: false,
            error: stepError.message,
            screenshot: failureScreenshot,
            url: failureUrl
          });
          break;
        }
      }

      // Return result
      const success = failedStep === -1;
      console.log(`[PlaywrightRecorder] Test ${success ? 'PASSED' : 'FAILED'}: ${passedSteps}/${steps.length} steps`);

      // Store whether we should keep browser open
      recorder._keepBrowserOpenOnFailure = keepBrowserOpenOnFailure && !success;

      // Update any remaining steps as skipped
      for (let j = passedSteps; j < steps.length; j++) {
        if (stepResults[j].status === 'pending') {
          stepResults[j].status = j === failedStep ? 'failed' : 'skipped';
          if (j === failedStep) {
            stepResults[j].error = failError;
            stepResults[j].screenshot = recorder._lastFailureState?.screenshot;
          }
        }
      }

      // ═══════════════════════════════════════════════════════════════════
      // AI STEP GUARANTOR: Print run summary
      // ═══════════════════════════════════════════════════════════════════
      try {
        const { getAIStepGuarantor } = require('./lib/ai-step-guarantor');
        const guarantor = getAIStepGuarantor();
        const aiStats = guarantor.getStats();
        const aiSteps = stepResults.filter(s => s.aiResolved);
        if (aiSteps.length > 0 || aiStats.verificationsRun > 0) {
          console.log('\n' + guarantor.generateSummary());
          console.log(`[AI Guarantor] Steps with AI: ${aiSteps.map(s => `#${s.index + 1}(${s.aiResolved})`).join(', ') || 'none'}`);
        }
      } catch (e) {
        // AI Guarantor not available — skip summary
      }

      // Emit test-complete with stepResults INCLUDING workingSelector for Lock Locators
      recorder.emit('test-complete', {
        success,
        passedSteps,
        failedStep,
        error: failError,
        totalSteps: steps.length,
        stepResults,  // CRITICAL: Include stepResults with workingSelector + aiResolved flags
        browserKeptOpen: recorder._keepBrowserOpenOnFailure,
        failureScreenshot: recorder._lastFailureState?.screenshot
      });

      // ═══════════════════════════════════════════════════════════════════
      // DIAGNOSTIC LOG: Write Lock Locators summary to file for debugging
      // File: <userData>/lock-locators-log.txt (append mode)
      // ═══════════════════════════════════════════════════════════════════
      try {
        const { app } = require('electron');
        const logPath = path.join(app.getPath('userData'), 'lock-locators-log.txt');
        const timestamp = new Date().toISOString();
        const lockable = stepResults.filter(s => {
          const t = (steps[s.index]?.type || steps[s.index]?.action || '').toLowerCase();
          return t !== 'navigate' && t !== 'goto' && t !== 'navigation';
        });
        const locked = lockable.filter(s => s.workingSelector);
        const unlocked = lockable.filter(s => !s.workingSelector);

        let logEntry = `\n${'='.repeat(70)}\n`;
        logEntry += `[${timestamp}] Test ${success ? 'PASSED' : 'FAILED'} — ${passedSteps}/${steps.length} steps\n`;
        logEntry += `Lock Locators: ${locked.length} lockable, ${unlocked.length} could NOT lock\n\n`;

        for (const sr of stepResults) {
          const step = steps[sr.index] || {};
          const desc = step.description || step.name || step.label || step.text || `Step ${sr.index + 1}`;
          const type = step.type || step.action || step.qword || '?';
          logEntry += `  Step ${sr.index + 1} [${type}] "${desc.substring(0, 50)}"\n`;
          logEntry += `    status: ${sr.status}`;
          if (sr.workingSelector) {
            logEntry += ` | selector: ${sr.workingSelector} (${sr.strategyType})`;
          } else {
            logEntry += ` | selector: NONE`;
          }
          logEntry += `\n`;
        }
        logEntry += `${'='.repeat(70)}\n`;

        fs.appendFileSync(logPath, logEntry, 'utf8');
        console.log(`[PlaywrightRecorder] Lock Locators log written to: ${logPath}`);
      } catch (logErr) {
        console.warn('[PlaywrightRecorder] Could not write lock-locators-log:', logErr.message);
      }

      return {
        success,
        passedSteps,
        failedStep,
        totalSteps: steps.length,
        error: failError || undefined,
        stepResults,  // CRITICAL: Return stepResults with workingSelector
        browserKeptOpen: recorder._keepBrowserOpenOnFailure,
        failureState: !success ? recorder._lastFailureState : undefined
      };

    } catch (error) {
      console.error('[PlaywrightRecorder] Test execution error:', error.message);
      return {
        success: false,
        error: error.message,
        passedSteps: 0,
        failedStep: 0,
        totalSteps: steps?.length || 0,
        stepResults: []
      };
    } finally {
      // CRITICAL: Always reset the flag when test run completes
      recorder._isRunningTest = false;

      // Check if we should keep browser open for debugging
      if (recorder._keepBrowserOpenOnFailure) {
        console.log('[PlaywrightRecorder] ⚠️ KEEPING BROWSER OPEN - Test failed and keepBrowserOpenOnFailure=true');
        console.log('[PlaywrightRecorder] Browser will stay open for visual debugging. Call closeBrowser() when done.');
        // Don't close - let user use Element Picker, Debug, AI features
        // Browser will be closed when user explicitly closes it or starts a new test
      } else {
        // Close browser after test completes (success or failure)
        // With persistent context, session data (cookies, localStorage) is preserved
        console.log('[PlaywrightRecorder] Closing browser after test (session data preserved)...');
        try {
          // With persistent context, closing context closes all pages
          // Session data is automatically saved to userDataDir
          if (recorder.context) {
            await recorder.context.close().catch(() => {});
          }
          recorder.page = null;
          recorder.context = null;
          recorder.browser = null;
          console.log('[PlaywrightRecorder] Browser closed successfully, login session preserved for next run');
        } catch (e) {
          console.error('[PlaywrightRecorder] Error closing browser:', e.message);
        }
      }
    }
}

module.exports = { runTest };
