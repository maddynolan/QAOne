/**
 * Background Script Generators
 * Generates Playwright TypeScript and Python scripts from recorded actions
 * Extracted from background.js for modularity
 *
 * All functions use the bg* prefix from background-utils.js:
 * bgEscapeString, bgEscapeStringDouble, bgEscapeStringSingleQuote,
 * bgIsRedundant, bgGetSelectorString, bgNormalizeSelector, bgGenerateSelectorFromActionData
 */

function bgGenerateScript(state, options) {
  const config = {
    language: 'typescript',
    includeComments: true,
    generateAssertions: true,
    usePageObjectModel: false,
    ...options,
  };

  const actions = state.actions;
  const metadata = state.metadata;

  if (actions.length === 0) {
    return config.language === 'python'
      ? '# No actions recorded'
      : '// No actions recorded';
  }

  if (config.language === 'python') {
    return bgGeneratePythonScript(actions, metadata, config);
  } else {
    return bgGenerateTypeScriptScript(actions, metadata, config);
  }
}

function bgGenerateTypeScriptScript(actions, metadata, config) {
  // Fix starting URL - skip extension URLs
  let startUrl = metadata.startUrl || 'about:blank';
  if (startUrl.startsWith('chrome-extension://') || startUrl.startsWith('chrome://')) {
    const firstNav = actions.find(a => a.type === 'navigate' && a.url &&
      !a.url.startsWith('chrome-extension://') && !a.url.startsWith('chrome://'));
    if (firstNav) {
      startUrl = firstNav.url;
    } else {
      startUrl = 'about:blank';
    }
  }

  let script = `import { test, expect, Page, BrowserContext } from '@playwright/test';

/**
 * ${metadata.title || 'Recorded Test'}
 * Recorded on: ${new Date(metadata.timestamp).toISOString()}
 * Starting URL: ${startUrl}
 */

// Helper: Wait for page to be ready
async function waitForPageReady(page: Page) {
  try {
    await page.waitForLoadState('domcontentloaded');
  } catch {}

  // Wait for spinners to disappear
  const spinners = ['.slds-spinner', '.loading-spinner', '[class*="spinner"]', '[aria-busy="true"]'];
  for (const spinner of spinners) {
    try {
      const el = page.locator(spinner).first();
      if (await el.isVisible({ timeout: 1000 })) {
        await el.waitFor({ state: 'hidden', timeout: 10000 });
      }
    } catch {}
  }
  await page.waitForTimeout(500);
}

// Helper: Click and handle new tab if opened
async function clickAndHandleNewTab(context: BrowserContext, page: Page, selector: string): Promise<Page> {
  const initialPages = context.pages().length;

  await page.locator(selector).click({ force: true });
  await page.waitForTimeout(1000);

  const currentPages = context.pages();
  if (currentPages.length > initialPages) {
    const newPage = currentPages[currentPages.length - 1];
    await newPage.waitForLoadState('domcontentloaded');
    await waitForPageReady(newPage);
    return newPage;
  }

  return page;
}

test('${bgEscapeStringSingleQuote(metadata.title || 'Recorded test')}', async ({ page, context }) => {
  // Navigate to starting URL
  await page.goto('${bgEscapeStringSingleQuote(startUrl)}');
  await waitForPageReady(page);

`;

  // First pass: remove obvious duplicates and invalid actions
  const cleanedActions = [];
  for (let i = 0; i < actions.length; i++) {
    const action = actions[i];
    const prev = i > 0 ? cleanedActions[cleanedActions.length - 1] : null;

    if (bgIsRedundant(action, prev, bgGetSelectorString, bgGetActionPriority)) continue;

    // Skip fill on radio/checkbox (should never happen, but double-check)
    if (action.type === 'fill' && action.tagName === 'input' &&
        (action.inputType === 'radio' || action.inputType === 'checkbox')) {
      continue;
    }

    cleanedActions.push(action);
  }

  // Second pass: generate script from cleaned actions
  let previousAction = null;
  for (let i = 0; i < cleanedActions.length; i++) {
    const action = cleanedActions[i];
    const nextAction = i < cleanedActions.length - 1 ? cleanedActions[i + 1] : null;

    if (config.includeComments && action.description) {
      script += `  // ${action.description}\n`;
    }

    const actionCode = bgGenerateTypeScriptAction(action);
    if (actionCode && actionCode.trim()) { // Only add if action code is not empty
      script += actionCode;
      script += bgGenerateTypeScriptWait(action, nextAction);
      script += '\n';
    }
    previousAction = action;
  }

  script += `  // Test complete
});
`;

  return script;
}

function bgGeneratePythonScript(actions, metadata, config) {
  const testName = bgToSnakeCase(metadata.title || 'recorded_test');

  // Fix starting URL - skip extension URLs
  let startUrl = metadata.startUrl || 'about:blank';
  if (startUrl.startsWith('chrome-extension://') || startUrl.startsWith('chrome://')) {
    const firstNav = actions.find(a => a.type === 'navigate' && a.url &&
      !a.url.startsWith('chrome-extension://') && !a.url.startsWith('chrome://'));
    if (firstNav) {
      startUrl = firstNav.url;
    } else {
      startUrl = 'about:blank';
    }
  }

  let script = `import pytest
from playwright.sync_api import Page, expect, BrowserContext
import time


# ==================== Smart Helpers ====================
def wait_for_page_ready(page, timeout: int = 10000):
    """Wait for page to be fully loaded and interactive - NON-BLOCKING"""
    try:
        page.wait_for_load_state("domcontentloaded", timeout=timeout)
    except:
        pass  # Continue even if page is still loading

    # Wait for common loading indicators to disappear (with SHORT timeout)
    spinners = [
        ".slds-spinner",           # Salesforce
        ".loading-spinner",        # Generic
    ]

    for spinner in spinners:
        try:
            spinner_el = page.locator(spinner).first
            if spinner_el.is_visible(timeout=500):
                spinner_el.wait_for(state="hidden", timeout=5000)
        except:
            pass  # Spinner not found or already hidden - continue

    # Small delay for JavaScript rendering
    page.wait_for_timeout(300)


def safe_click(page, *selectors, timeout=10000):
    """Try multiple selectors until one works - self-healing click"""
    last_error = None
    for selector in selectors:
        try:
            element = page.locator(selector).first
            element.wait_for(state="visible", timeout=timeout)
            element.scroll_into_view_if_needed()
            element.click(force=True, no_wait_after=True)
            return True
        except Exception as e:
            last_error = e
            continue

    # If all selectors failed, raise the last error
    if last_error:
        raise last_error
    return False


def click_and_handle_new_tab(context, page, selector, force=True):
    """Click element and switch to new tab if one opens"""
    # Get current page count
    initial_pages = len(context.pages)

    # Click the element (no_wait_after to avoid navigation timeout)
    page.locator(selector).click(force=force, no_wait_after=True)

    # Wait briefly for potential new tab
    page.wait_for_timeout(1000)

    # Check if new tab opened
    current_pages = context.pages
    if len(current_pages) > initial_pages:
        # Switch to the new tab
        new_page = current_pages[-1]
        new_page.wait_for_load_state("domcontentloaded")
        wait_for_page_ready(new_page)
        return new_page

    return page


def test_${testName}(page: Page, context: BrowserContext):
    """
    ${metadata.title || 'Recorded Test'}
    Recorded on: ${new Date(metadata.timestamp).toISOString()}
    Starting URL: ${startUrl}

    Note: Uses 'context' fixture to handle multi-tab scenarios
    """
    # Navigate to starting URL
    page.goto("${bgEscapeStringDouble(startUrl)}")
    wait_for_page_ready(page)

`;

  let previousAction = null;

  // First pass: remove obvious duplicates and useless actions
  const cleanedActions = [];
  const seenNavigateUrls = new Set(); // Track ALL navigate URLs, not just last one
  const seenActionSignatures = new Set(); // Track action signatures to prevent duplicates

  for (let i = 0; i < actions.length; i++) {
    const action = actions[i];
    const prev = i > 0 ? cleanedActions[cleanedActions.length - 1] : null;

    // CRITICAL: Skip useless click/hover actions on generic elements with no real selector
    if ((action.type === 'click' || action.type === 'hover') && action.tagName) {
      const tag = action.tagName.toLowerCase();
      const genericTags = ['div', 'span', 'body', 'html', 'section', 'article', 'main', 'header', 'footer', 'nav'];

      const selectorStr = action.selector?.playwright || action.selector?.selector ||
                           action.selector?.primary?.playwright || action.selector?.primary?.selector || '';

      const isTooSimple = !selectorStr ||
                           selectorStr === tag ||
                           selectorStr === `locator("${tag}")` ||
                           selectorStr === `locator('${tag}')` ||
                           selectorStr.match(/^locator\s*\(\s*['"]?(div|span|body|section)['"]?\s*\)$/i);

      if (genericTags.includes(tag) && isTooSimple) {
        console.log(`[Flowstral] Skipping useless action: ${action.type} ${tag} (no meaningful selector)`);
        continue;
      }
    }

    // CRITICAL: Create signature to detect duplicate action sequences
    const actionSig = `${action.type}_${bgNormalizeSelector(bgGetSelectorString(action.selector) || action.description || '')}`;

    // Skip if we've seen this exact action recently (within last 20 actions)
    let recentDuplicate = false;
    const recentSigs = Array.from(seenActionSignatures).slice(-20);
    if (recentSigs.includes(actionSig) && action.type !== 'navigate') {
      console.log(`[Flowstral] Skipping repeated action: ${action.type} (seen before in sequence)`);
      recentDuplicate = true;
    }
    seenActionSignatures.add(actionSig);

    if (recentDuplicate && cleanedActions.length > 10) {
      continue;
    }

    // Skip duplicate navigations to the same URL (check all previous navigations)
    if (action.type === 'navigate') {
      if (seenNavigateUrls.has(action.url)) {
        console.log(`[Flowstral] Skipping duplicate navigation to: ${action.url}`);
        continue;
      }
      seenNavigateUrls.add(action.url);
    }

    // Skip data-id selectors - they're extension-generated and won't work in real tests
    const selectorStr = action.selector?.playwright ||
                       action.selector?.selector ||
                       action.selector?.primary?.playwright ||
                       action.selector?.primary?.selector ||
                       '';

    const dataIdMatch = selectorStr.match(/\[data-id="(\d+)"\]/);
    if (dataIdMatch && dataIdMatch[1].length <= 3 && !selectorStr.includes('data-control-name')) {
      console.log(`[Flowstral] Detected extension-generated data-id selector: ${selectorStr}`);

      const fallbacks = action.selector?.fallbacks || [];
      let foundFallback = false;

      for (const fallback of fallbacks) {
        const fbStr = fallback?.playwright || fallback?.selector || '';
        const fbDataIdMatch = fbStr.match(/\[data-id="(\d+)"\]/);
        if (!fbDataIdMatch || (fbDataIdMatch[1].length > 3) || fbStr.includes('data-control-name')) {
          console.log(`[Flowstral] Using fallback selector: ${fbStr}`);
          action.selector = fallback;
          foundFallback = true;
          break;
        }
      }

      if (!foundFallback && action.selector?.primary) {
        const primaryStr = action.selector.primary?.playwright || action.selector.primary?.selector || '';
        const primaryDataIdMatch = primaryStr.match(/\[data-id="(\d+)"\]/);
        if (!primaryDataIdMatch || (primaryDataIdMatch[1].length > 3) || primaryStr.includes('data-control-name')) {
          console.log(`[Flowstral] Using primary selector: ${primaryStr}`);
          action.selector = action.selector.primary;
          foundFallback = true;
        }
      }

      if (!foundFallback) {
        const selectorObj = action.selector || {};
        if (selectorObj.name && !selectorObj.name.match(/^\d+$/)) {
          action.selector = { playwright: `locator('[name="${selectorObj.name}"]')`, selector: `[name="${selectorObj.name}"]` };
          foundFallback = true;
          console.log(`[Flowstral] Using name attribute from selector: ${selectorObj.name}`);
        } else if (selectorObj.title) {
          action.selector = { playwright: `locator('[title="${selectorObj.title}"]')`, selector: `[title="${selectorObj.title}"]` };
          foundFallback = true;
          console.log(`[Flowstral] Using title attribute from selector: ${selectorObj.title}`);
        }
      }

      if (!foundFallback) {
        console.log(`[Flowstral] No valid fallback selector found, generating selector from action data`);
        const generatedSelector = bgGenerateSelectorFromActionData(action);
        if (generatedSelector) {
          console.log(`[Flowstral] Generated selector from action data: ${generatedSelector}`);
          action.selector = { playwright: generatedSelector, selector: generatedSelector };
        } else {
          const selectorData = action.selector || {};
          if (selectorData.name) {
            action.selector = { playwright: `locator('[name="${selectorData.name}"]')`, selector: `[name="${selectorData.name}"]` };
            console.log(`[Flowstral] Using name attribute: ${selectorData.name}`);
          } else if (selectorData.title) {
            action.selector = { playwright: `locator('[title="${selectorData.title}"]')`, selector: `[title="${selectorData.title}"]` };
            console.log(`[Flowstral] Using title attribute: ${selectorData.title}`);
          } else {
            console.log(`[Flowstral] Could not generate selector, skipping action`);
            continue;
          }
        }
      }
    }

    if (bgIsRedundant(action, prev, bgGetSelectorString, bgGetActionPriority)) continue;

    // Skip empty actions (filtered out fills on radio/checkbox)
    if (action.type === 'fill' && action.tagName === 'input' &&
        (action.inputType === 'radio' || action.inputType === 'checkbox')) {
      continue;
    }

    // CRITICAL: Skip actions with invalid selectors (visual locator comments)
    const selectorPlaywright = action.selector?.playwright || action.selector?.primary?.playwright;
    const isVisualLocator = selectorPlaywright && (
      selectorPlaywright.trim().startsWith('//') ||
      selectorPlaywright.includes('Visual locator:')
    );

    if (isVisualLocator) {
      const fallbacksList = action.selector?.fallbacks || action.selector?.primary?.fallbacks || [];

      let validFallback = fallbacksList.find(f => {
        const fbPlaywright = f.playwright || f.primary?.playwright;
        return fbPlaywright && !fbPlaywright.trim().startsWith('//') && !fbPlaywright.includes('Visual locator:');
      });

      if (validFallback) {
        action.selector = validFallback;
      } else {
        validFallback = fallbacksList.find(f => f.selector || f.primary?.selector);
        if (validFallback) {
          action.selector = { selector: validFallback.selector || validFallback.primary?.selector };
        } else if (action.selector?.selector) {
          action.selector = { selector: action.selector.selector };
        } else if (action.selector?.primary?.selector) {
          action.selector = { selector: action.selector.primary.selector };
        } else {
          console.warn(`[Flowstral] Action ${action.type} has no valid selector, using fallback locator("body")`);
          action.selector = { selector: 'body' };
        }
      }
    }

    cleanedActions.push(action);
  }

  // Second pass: generate script from cleaned actions
  for (let i = 0; i < cleanedActions.length; i++) {
    const action = cleanedActions[i];
    const nextAction = i < cleanedActions.length - 1 ? cleanedActions[i + 1] : null;

    if (config.includeComments && action.description) {
      script += `    # ${action.description}\n`;
    }

    const actionCode = bgGeneratePythonAction(action);
    if (actionCode) { // Only add if action code is not empty
      script += actionCode;
      script += bgGeneratePythonWait(action, nextAction);
      script += '\n';
    }
    previousAction = action;
  }

  script += `    # Test complete
`;

  // CRITICAL: Post-process to remove any visual locator comments that slipped through
  script = script.replace(/page\.\s*\/\/\s*Visual\s+locator[^\n]*\.(click|fill|check|uncheck|select|press|dblclick|hover|wait_for_load_state)\(/gi, 'page.locator("body").$1(');
  script = script.replace(/page\.\s*\/\/[^.]*\.(click|fill|check|uncheck|select|press|dblclick|hover|wait_for_load_state)\(/gi, 'page.locator("body").$1(');
  script = script.replace(/^\s*page\.\s*\/\/\s*Visual\s+locator[^\n]*$/gim, '');
  script = script.replace(/^\s*page\.\s*\/\/[^\n]*$/gim, '');
  script = script.replace(/^\s*.*Visual\s+locator.*$/gim, '');
  script = script.replace(/^\s*\/\/\s*Visual[^\n]*$/gim, '');
  script = script.replace(/page\.([^.]*\/\/\s*Visual\s+locator[^.]*)\.[a-z_]+\(/gi, 'page.locator("body").click(');

  return script;
}

function bgGenerateTypeScriptAction(action) {
  const selector = bgFormatTypeScriptSelector(action.selector);

  switch (action.type) {
    case 'click': {
      const isLink = action.element === 'link' || action.tagName === 'a' || action.href;
      const mightOpenNewTab = isLink || action.opensNewTab || action.opens_new_tab;

      if (mightOpenNewTab) {
        return `  // Click (auto-handles new tab if opened)
  page = await clickAndHandleNewTab(context, page, '${selector}');
`;
      }

      let clickCode = `  await page.${selector}.click({ force: true, noWaitAfter: true });\n`;
      clickCode += `  await waitForPageReady(page);\n`;
      return clickCode;
    }

    case 'dblclick':
      return `  await page.${selector}.dblclick();\n`;

    case 'switchToParent':
      return `  // Switch back to parent/original tab
  const pages = context.pages();
  if (pages.length > 1) {
    page = pages[0]; // Switch to first (parent) page
    await page.bringToFront();
  }
`;

    case 'closeTab':
      return `  // Close current tab and switch to parent
  await page.close();
  const remainingPages = context.pages();
  if (remainingPages.length > 0) {
    page = remainingPages[0];
    await page.bringToFront();
  }
`;

    case 'fill':
      if (action.tagName === 'input' && (action.inputType === 'radio' || action.inputType === 'checkbox')) {
        return '';
      }
      return `  await page.${selector}.fill('${bgEscapeStringSingleQuote(action.value || '')}');\n`;

    case 'type':
      return `  await page.${selector}.type('${bgEscapeStringSingleQuote(action.value || '')}');\n`;

    case 'select':
      if (action.label) {
        return `  await page.${selector}.selectOption({ label: '${bgEscapeStringSingleQuote(action.label)}' });\n`;
      }
      return `  await page.${selector}.selectOption('${bgEscapeStringSingleQuote(action.value || '')}');\n`;

    case 'check':
      return `  await page.${selector}.check();\n`;

    case 'uncheck':
      return `  await page.${selector}.uncheck();\n`;

    case 'press':
      return `  await page.${selector}.press('${action.key}');\n`;

    case 'keyboard':
      return `  await page.keyboard.${action.method}('${action.key}');\n`;

    case 'navigate':
      return `  await page.goto('${bgEscapeStringSingleQuote(action.url)}');\n`;

    case 'upload':
      return `  await page.${selector}.setInputFiles(['${bgEscapeStringSingleQuote(action.files)}']);\n`;

    case 'hover':
      return `  await page.${selector}.hover();\n`;

    case 'assert': {
      const assertSelector = bgFormatTypeScriptSelector(action.selector);
      return `  await expect(page.${assertSelector}).toBeVisible();\n`;
    }

    default:
      return `  // Unhandled action: ${action.type}\n`;
  }
}

function bgGeneratePythonAction(action) {
  const selector = bgFormatPythonSelector(action.selector);

  if (!selector && action.type !== 'navigate' && action.type !== 'keyboard') {
    console.log('[Flowstral] Skipping action with no valid selector:', action.type, action.description);
    return '';
  }

  const isSalesforce = (action.app || '').includes('salesforce');
  const isRadioOrCheckbox = action.type === 'check' || action.type === 'uncheck';

  switch (action.type) {
    case 'click': {
      const isLink = action.element === 'link' || action.tagName === 'a' || action.href;
      const mightOpenNewTab = isLink || action.opensNewTab || action.opens_new_tab;

      if (mightOpenNewTab) {
        return `    # Click (auto-handles new tab if opened)
    page = click_and_handle_new_tab(context, page, "${selector}")
`;
      }

      const opts = ['force=True', 'no_wait_after=True', 'timeout=10000'];
      if (action.button && action.button !== 'left') {
        opts.push(`button="${action.button}"`);
      }
      if (action.modifiers && action.modifiers.length) {
        opts.push(`modifiers=[${action.modifiers.map(m => `"${m}"`).join(', ')}]`);
      }
      const args = opts.join(', ');
      return `    page.${selector}.click(${args})
    page.wait_for_timeout(500)  # Brief pause for UI update
`;
    }

    case 'dblclick':
      return `    page.${selector}.dblclick()\n`;

    case 'switchToParent':
      return `    # Switch back to parent/original tab
    pages = context.pages
    if len(pages) > 1:
        page = pages[0]  # Switch to first (parent) page
        page.bring_to_front()
`;

    case 'closeTab':
      return `    # Close current tab and switch to parent
    page.close()
    remaining_pages = context.pages
    if len(remaining_pages) > 0:
        page = remaining_pages[0]
        page.bring_to_front()
`;

    case 'fill': {
      if (action.tagName === 'input' && (action.inputType === 'radio' || action.inputType === 'checkbox')) {
        return '';
      }

      const desc = (action.description || action.text || '').toLowerCase();
      const placeholder = (action.placeholder || '').toLowerCase();
      const isAppLauncherSearch = desc.includes('search apps') || placeholder.includes('search apps') ||
                                    desc.includes('app launcher') || placeholder.includes('search items');

      if (isAppLauncherSearch || isSalesforce) {
        return `    # ROBUST: Wait for modal/input with fallback selectors + multiple fill strategies
    _fill_done = False
    _search_selectors = [
        '${selector}',
        'input[placeholder*="Search apps"]',
        'input[placeholder*="Search Apps"]',
        'one-app-launcher-menu input',
        'input.slds-input[placeholder*="Search"]',
        '[role="searchbox"]',
        'input[type="search"]',
    ]
    for _attempt in range(3):
        for _sel in _search_selectors:
            try:
                _el = page.locator(_sel)
                if _el.count() > 0:
                    _el.first.wait_for(state="visible", timeout=3000)
                    # Strategy 1: Click to focus, then fill with short timeout
                    try:
                        _el.first.click(timeout=2000)
                        page.wait_for_timeout(300)
                        _el.first.fill("${bgEscapeStringDouble(action.value || '')}", timeout=5000)
                        _fill_done = True
                    except:
                        # Strategy 2: Use type() for custom Salesforce components
                        try:
                            _el.first.click(timeout=2000)
                            page.wait_for_timeout(300)
                            _el.first.type("${bgEscapeStringDouble(action.value || '')}", delay=50)
                            _fill_done = True
                        except:
                            # Strategy 3: Use keyboard directly
                            _el.first.click(timeout=2000)
                            page.keyboard.type("${bgEscapeStringDouble(action.value || '')}")
                            _fill_done = True
                    break
            except:
                continue
        if _fill_done:
            break
        page.wait_for_timeout(2000)  # Wait and retry
    if not _fill_done:
        raise Exception("Could not fill input after retries")\n`;
      }

      return `    # Wait for input to be ready
    try:
        page.${selector}.wait_for(state="visible", timeout=10000)
    except:
        pass  # Continue even if wait times out
    page.${selector}.fill("${bgEscapeStringDouble(action.value || '')}")\n`;
    }

    case 'type':
      return `    # Wait for input to be ready
    try:
        page.${selector}.wait_for(state="visible", timeout=10000)
    except:
        pass
    page.${selector}.type("${bgEscapeStringDouble(action.value || '')}")\n`;

    case 'select':
      if (action.label) {
        return `    page.${selector}.select_option(label="${bgEscapeStringDouble(action.label)}")\n`;
      }
      return `    page.${selector}.select_option("${bgEscapeStringDouble(action.value || '')}")\n`;

    case 'check': {
      if (isSalesforce && bgIsInteractiveSelector(action.selector)) {
        return `    page.${selector}.click(force=True, no_wait_after=True)\n`;
      }
      return `    page.${selector}.check()\n`;
    }

    case 'uncheck': {
      if (isSalesforce && bgIsInteractiveSelector(action.selector)) {
        return `    page.${selector}.click(force=True, no_wait_after=True)\n`;
      }
      return `    page.${selector}.uncheck()\n`;
    }

    case 'press':
      return `    page.${selector}.press("${action.key}")\n`;

    case 'keyboard':
      return `    page.keyboard.${action.method}("${action.key}")\n`;

    case 'navigate':
      return `    page.goto("${bgEscapeStringDouble(action.url)}")\n`;

    case 'upload':
      return `    page.${selector}.set_input_files(["${bgEscapeStringDouble(action.files)}"])\n`;

    case 'hover':
      return `    # HOVER (non-critical)\n    try:\n        page.${selector}.hover(timeout=2000)\n    except:\n        pass  # Hovers are non-critical\n`;

    case 'assert': {
      const assertSelector = bgFormatPythonSelector(action.selector);
      return `    expect(page.${assertSelector}).to_be_visible()\n`;
    }

    default:
      return `    # Unhandled action: ${action.type}\n`;
  }
}

function bgGenerateTypeScriptWait(action, nextAction) {
  let code = '';

  if (action.type === 'navigate') {
    code += `  await page.waitForLoadState('networkidle');\n`;
    return code;
  }

  if (action.type === 'fill' || action.type === 'type') {
    return code;
  }

  if (action.type === 'check' || action.type === 'uncheck') {
    return code;
  }

  if (action.triggersNavigation) {
    code += `  await page.waitForLoadState('networkidle');\n`;
  } else if (action.type === 'click' && action.mightTriggerChange && nextAction) {
    if (nextAction.type !== action.type || bgGetSelectorString(nextAction.selector) !== bgGetSelectorString(action.selector)) {
      code += `  await page.waitForLoadState('domcontentloaded');\n`;
    }
  }

  return code;
}

function bgGeneratePythonWait(action, nextAction) {
  let code = '';

  if (action.type === 'navigate') {
    code += `    try:\n`;
    code += `        page.wait_for_load_state("domcontentloaded", timeout=15000)\n`;
    code += `    except:\n`;
    code += `        pass  # Continue even if page is still loading\n`;
    return code;
  }

  if (action.type === 'fill' || action.type === 'type') {
    return code;
  }

  if (action.type === 'check' || action.type === 'uncheck') {
    return code;
  }

  if (action.triggersNavigation) {
    code += `    try:\n`;
    code += `        page.wait_for_load_state("domcontentloaded", timeout=15000)\n`;
    code += `    except:\n`;
    code += `        pass  # Continue even if page is still loading\n`;
  } else if (action.type === 'click' && action.mightTriggerChange && nextAction) {
    if (nextAction.type !== action.type || bgGetSelectorString(nextAction.selector) !== bgGetSelectorString(action.selector)) {
      code += `    try:\n`;
      code += `        page.wait_for_load_state("domcontentloaded", timeout=10000)\n`;
      code += `    except:\n`;
      code += `        pass\n`;
    }
  }

  // CRITICAL: Add extra wait after login button clicks
  const desc = (action.description || '').toLowerCase();
  const text = (action.text || '').toLowerCase();
  const selectorStr = JSON.stringify(action.selector || {}).toLowerCase();

  if (action.type === 'click' && (
    desc.includes('log in') || desc.includes('login') || desc.includes('sign in') ||
    text.includes('log in') || text.includes('login') || text.includes('sign in')
  )) {
    code += `    # Wait for post-login page load (Salesforce Lightning needs extra time)\n`;
    code += `    try:\n`;
    code += `        page.wait_for_load_state("domcontentloaded", timeout=15000)\n`;
    code += `    except:\n`;
    code += `        pass  # Continue - Salesforce makes continuous API calls\n`;
    code += `    page.wait_for_timeout(5000)  # Extra wait for Lightning Experience\n`;
  }

  // CRITICAL: Add wait for App Launcher modal after clicking waffle icon
  if (action.type === 'click' && (
    desc.includes('app launcher') || desc.includes('applauncher') ||
    text.includes('app launcher') || text.includes('applauncher') ||
    selectorStr.includes('waffle') || selectorStr.includes('app-launcher') ||
    selectorStr.includes('slds-icon-waffle')
  )) {
    code += `    # Wait for App Launcher modal to open\n`;
    code += `    try:\n`;
    code += `        page.locator('div.slds-modal__content, div.appLauncherMenu, one-app-launcher-menu').wait_for(state="visible", timeout=10000)\n`;
    code += `    except:\n`;
    code += `        pass  # Modal might use different selector\n`;
    code += `    page.wait_for_timeout(1500)  # Wait for search input to be interactive\n`;
  }

  return code;
}

function bgFormatTypeScriptSelector(selectorData) {
  if (!selectorData) return "locator('body')";

  if (selectorData.playwright) {
    const playwright = selectorData.playwright;
    if (playwright.trim().startsWith('//')) {
      if (selectorData.selector) {
        return `locator('${bgEscapeStringSingleQuote(selectorData.selector)}')`;
      }
      if (selectorData.fallbacks && selectorData.fallbacks.length > 0) {
        const fallback = selectorData.fallbacks[0];
        if (fallback.playwright && !fallback.playwright.trim().startsWith('//')) {
          return fallback.playwright;
        }
        if (fallback.selector) {
          return `locator('${bgEscapeStringSingleQuote(fallback.selector)}')`;
        }
      }
      return "locator('body')";
    }
    return playwright;
  }

  if (selectorData.selector) {
    return `locator('${bgEscapeStringSingleQuote(selectorData.selector)}')`;
  }

  if (typeof selectorData === 'string') {
    return `locator('${bgEscapeStringSingleQuote(selectorData)}')`;
  }

  return "locator('body')";
}

function bgFormatPythonSelector(selectorData) {
  if (!selectorData) return null;

  const isUselessSelector = (str) => {
    if (!str || typeof str !== 'string') return true;
    const trimmed = str.trim().toLowerCase();
    const uselessPatterns = [
      /^(div|span|body|html|section|article|main|header|footer|nav|aside|p|ul|li|table|tr|td)$/,
      /^locator\s*\(\s*['"]?(div|span|body|section|article|main|header|footer|nav)['"]?\s*\)$/,
    ];
    return uselessPatterns.some(p => p.test(trimmed));
  };

  const isVisualLocatorStr = (str) => {
    if (!str || typeof str !== 'string') return false;
    const trimmed = str.trim();
    return trimmed.startsWith('//') || trimmed.includes('Visual locator:') || trimmed.startsWith('page.//');
  };

  const isSimpleDataId = (str) => {
    if (!str || typeof str !== 'string') return false;
    const dataIdMatch = str.match(/\[data-id="(\d+)"\]/);
    if (dataIdMatch && dataIdMatch[1].length <= 3 && !str.includes('data-control-name')) {
      return true;
    }
    return false;
  };

  const primarySel = selectorData.playwright || selectorData.selector || '';
  if (isUselessSelector(primarySel)) {
    if (selectorData.fallbacks && selectorData.fallbacks.length > 0) {
      for (const fallback of selectorData.fallbacks) {
        const fbSel = fallback.playwright || fallback.selector || '';
        if (!isUselessSelector(fbSel) && !isVisualLocatorStr(fbSel)) {
          selectorData = fallback;
          break;
        }
      }
    }

    const newSel = selectorData.playwright || selectorData.selector || '';
    if (isUselessSelector(newSel)) {
      console.log('[Flowstral] Skipping useless selector:', primarySel);
      return null;
    }
  }

  if (selectorData.playwright) {
    const playwright = selectorData.playwright;
    if (isVisualLocatorStr(playwright)) {
      if (selectorData.selector && !isVisualLocatorStr(selectorData.selector)) {
        return `locator("${bgEscapeStringDouble(selectorData.selector)}")`;
      }
      if (selectorData.fallbacks && selectorData.fallbacks.length > 0) {
        for (const fallback of selectorData.fallbacks) {
          if (fallback.playwright && !isVisualLocatorStr(fallback.playwright)) {
            return bgConvertToPythonSelector(fallback.playwright);
          }
          if (fallback.selector && !isVisualLocatorStr(fallback.selector)) {
            return `locator("${bgEscapeStringDouble(fallback.selector)}")`;
          }
        }
      }
      return 'locator("body")';
    }
    if (isVisualLocatorStr(playwright) || isSimpleDataId(playwright)) {
      if (selectorData.fallbacks && selectorData.fallbacks.length > 0) {
        for (const fallback of selectorData.fallbacks) {
          if (fallback.playwright && !isVisualLocatorStr(fallback.playwright) && !isSimpleDataId(fallback.playwright)) {
            return bgConvertToPythonSelector(fallback.playwright);
          }
          if (fallback.selector && !isVisualLocatorStr(fallback.selector) && !isSimpleDataId(fallback.selector)) {
            return `locator("${bgEscapeStringDouble(fallback.selector)}")`;
          }
        }
      }
      if (selectorData.primary && !isSimpleDataId(selectorData.primary.selector || selectorData.primary.playwright || '')) {
        if (selectorData.primary.playwright) {
          return bgConvertToPythonSelector(selectorData.primary.playwright);
        }
        if (selectorData.primary.selector) {
          return `locator("${bgEscapeStringDouble(selectorData.primary.selector)}")`;
        }
      }
      return 'locator("body")';
    }
    return bgConvertToPythonSelector(playwright);
  }

  if (selectorData.selector) {
    if (isVisualLocatorStr(selectorData.selector) || isSimpleDataId(selectorData.selector)) {
      if (selectorData.fallbacks && selectorData.fallbacks.length > 0) {
        for (const fallback of selectorData.fallbacks) {
          if (fallback.playwright && !isVisualLocatorStr(fallback.playwright) && !isSimpleDataId(fallback.playwright)) {
            return bgConvertToPythonSelector(fallback.playwright);
          }
          if (fallback.selector && !isVisualLocatorStr(fallback.selector) && !isSimpleDataId(fallback.selector)) {
            return `locator("${bgEscapeStringDouble(fallback.selector)}")`;
          }
        }
      }
      if (selectorData.primary && !isSimpleDataId(selectorData.primary.selector || selectorData.primary.playwright || '')) {
        if (selectorData.primary.playwright) {
          return bgConvertToPythonSelector(selectorData.primary.playwright);
        }
        if (selectorData.primary.selector) {
          return `locator("${bgEscapeStringDouble(selectorData.primary.selector)}")`;
        }
      }
      return 'locator("body")';
    }
    return `locator("${bgEscapeStringDouble(selectorData.selector)}")`;
  }

  if (typeof selectorData === 'string') {
    if (isVisualLocatorStr(selectorData) || isSimpleDataId(selectorData)) {
      return 'locator("body")';
    }
    return `locator("${bgEscapeStringDouble(selectorData)}")`;
  }

  return 'locator("body")';
}

function bgConvertToPythonSelector(tsSelector) {
  if (!tsSelector || typeof tsSelector !== 'string') {
    return 'locator("body")';
  }

  const trimmed = tsSelector.trim();
  if (trimmed.startsWith('//') || trimmed.includes('Visual locator:') || trimmed.startsWith('page.//')) {
    return 'locator("body")';
  }

  let result = tsSelector
    .replace(/getByTestId\(/g, 'get_by_test_id(')
    .replace(/getByRole\(/g, 'get_by_role(')
    .replace(/getByLabel\(/g, 'get_by_label(')
    .replace(/getByPlaceholder\(/g, 'get_by_placeholder(')
    .replace(/getByText\(/g, 'get_by_text(')
    .replace(/getByAltText\(/g, 'get_by_alt_text(')
    .replace(/getByTitle\(/g, 'get_by_title(');

  result = result.replace(/\{\s*name:\s*['"]([^'"]+)['"]\s*\}/g, "name='$1'");
  result = result.replace(/\{\s*hasText:\s*['"]([^'"]+)['"]\s*\}/g, "has_text='$1'");

  if (!result.includes('"')) {
    result = result.replace(/'/g, '"');
  }

  result = result.replace(/\.filter\(\s*\{\s*name:\s*['"]([^'"]+)['"]\s*\}\s*\)/g, ".filter(name='$1')");
  result = result.replace(/\.filter\(\s*\{\s*hasText:\s*['"]([^'"]+)['"]\s*\}\s*\)/g, ".filter(has_text='$1')");

  return result;
}

/**
 * Check if a selector targets an interactive element (button, link, etc.)
 * Used to decide whether to use click() instead of check() for Salesforce
 */
function bgIsInteractiveSelector(selector) {
  if (!selector) return false;
  const selectorStr = bgGetSelectorString(selector).toLowerCase();
  return selectorStr.includes('button') ||
         selectorStr.includes('role') ||
         selectorStr.includes('label') ||
         selectorStr.includes('text');
}
