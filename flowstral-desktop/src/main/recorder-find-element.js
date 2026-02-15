/**
 * Extracted: _findElement and findElementWithRetry methods from PlaywrightRecorder
 * Multi-strategy element finding with fallbacks + retry wrapper.
 *
 * Receives `recorder` (the PlaywrightRecorder instance) as first param instead of `this`.
 */

// Module-level utility functions (copied from playwright-recorder.js)
const cssEscape = (value) => {
  if (value == null) return '';
  const string = String(value);
  const length = string.length;
  let result = '';
  for (let i = 0; i < length; i++) {
    const char = string.charAt(i);
    const code = string.charCodeAt(i);
    if (code === 0x0000) {
      result += '\uFFFD';
      continue;
    }
    if (
      (code >= 0x0001 && code <= 0x001F) ||
      code === 0x007F ||
      (i === 0 && code >= 0x0030 && code <= 0x0039) ||
      (i === 1 && code >= 0x0030 && code <= 0x0039 && string.charCodeAt(0) === 0x002D)
    ) {
      result += '\\' + code.toString(16) + ' ';
      continue;
    }
    if (i === 0 && code === 0x002D && length === 1) {
      result += '\\' + char;
      continue;
    }
    if (
      code >= 0x0080 ||
      code === 0x002D ||
      code === 0x005F ||
      (code >= 0x0030 && code <= 0x0039) ||
      (code >= 0x0041 && code <= 0x005A) ||
      (code >= 0x0061 && code <= 0x007A)
    ) {
      result += char;
      continue;
    }
    result += '\\' + char;
  }
  return result;
};

const normalizeTextForMatching = (text) => {
  if (!text || typeof text !== 'string') return '';
  return text
    .replace(/[\u2018\u2019\u201B\u2032\u0060\u00B4\u02BC]/g, "'")
    .replace(/[\u201C\u201D\u201E\u201F\u2033]/g, '"')
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

// Required modules
const { getManualOverrideSelector, getLockedSelector } = require('./lib/override-and-locked');
const { SmartFinder } = require('./lib/smart-finder');
const { legacyActionToRecipe } = require('./lib/recipe-recorder-integration');


/**
 * Multi-strategy element finding with fallbacks.
 * @param {Object} recorder - The PlaywrightRecorder instance
 * @param {Object} action - The action containing element info
 * @param {Object} scope - The page or frame to search within
 * @returns {Promise<{locator, strategy}|null>}
 */
async function _findElement(recorder, action, scope) {
    const timeout = 5000;
    // Use the provided scope (page or iframe) - fallback to recorder.page for backwards compat
    const searchScope = scope || recorder.page;
    const strategies = [];
    // FIXED: Use comprehensive label extraction with normalization
    const label = getActionLabel(action);

    // Clean the label for matching (already normalized by getActionLabel)
    const cleanLabel = (label || '').replace(/"/g, '').trim();
    const cleanLabelNormalized = cleanLabel; // Already normalized

    // ============================================================
    // MANUAL OVERRIDE - User-specified selector takes HIGHEST priority
    // When automation fails, users can specify exactly how to find the element
    // ============================================================
    const manualOverride = getManualOverrideSelector(action);
    if (manualOverride) {
      console.log(`[PlaywrightRecorder] 🎯 MANUAL OVERRIDE: Using user-specified selector: "${manualOverride}"`);
      try {
        const manualLocator = searchScope.locator(manualOverride);
        const count = await manualLocator.count();
        if (count > 0) {
          console.log(`[PlaywrightRecorder] ✅ Manual override found ${count} element(s)`);
          return { locator: manualLocator.first(), strategy: { type: 'MANUAL-OVERRIDE' } };
        } else {
          console.log(`[PlaywrightRecorder] ⚠️ Manual override selector found 0 elements, falling back to auto-detection`);
        }
      } catch (e) {
        console.log(`[PlaywrightRecorder] ⚠️ Manual override selector error: ${e.message}, falling back to auto-detection`);
      }
    }

    // Create regex pattern that matches any apostrophe variant
    const createApostropheFlexRegex = (text) => {
      const escaped = text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const flexible = escaped.replace(/['\u2018\u2019\u201B\u2032\u0060\u00B4]/g, "['\u2018\u2019\u201B\u2032\u0060\u00B4']");
      return new RegExp(flexible, 'i');
    };

    const isFillAction = action.type === 'fill' || action.type === 'type' || action.inputType;

    // CRITICAL: Extract element index for duplicate elements (e.g., multiple "Add to Cart" buttons)
    // action.args[1] contains the 0-based index of which matching element to click
    const elementIndex = typeof action.args?.[1] === 'number' ? action.args[1] : 0;
    if (elementIndex > 0) {
      console.log(`[PlaywrightRecorder] Element index specified: ${elementIndex} (will click ${elementIndex + 1}${recorder._ordinal(elementIndex + 1).slice(-2)} matching element)`);
    }

    // Helper to get element at specific index from a locator
    const getAtIndex = (locator) => elementIndex === 0 ? locator.first() : locator.nth(elementIndex);

    // Normalize selector - could be a string or object with selector property
    const selectorStr = typeof action.selector === 'string'
      ? action.selector
      : (action.selector?.selector || action.selectorObj?.selector || '');

    // ========== EXTRACT ALL RECORDED ELEMENT ATTRIBUTES ==========
    // These are the stable identifiers captured during recording
    const selectorObj = action.selectorObj || action.selector || {};
    const rawElement = action.raw?.element || action.element || {};

    // Extract all available attributes from multiple sources
    const testId = selectorObj.testId || rawElement.testId || action.testId ||
                   selectorObj['data-testid'] || rawElement['data-testid'];
    const name = selectorObj.name || rawElement.name || action.name;
    const id = selectorObj.id || rawElement.id || action.id;
    const ariaLabel = selectorObj.ariaLabel || rawElement.ariaLabel || action.ariaLabel;
    const placeholder = selectorObj.placeholder || rawElement.placeholder || action.placeholder;
    const title = selectorObj.title || rawElement.title || action.title;
    const role = selectorObj.role || rawElement.role || action.role;
    const href = selectorObj.href || rawElement.href || action.href;
    const className = selectorObj.className || rawElement.className || action.className;

    console.log(`[PlaywrightRecorder] Finding element: "${cleanLabel}" (selector: ${selectorStr}, fill: ${isFillAction})`);
    console.log(`[PlaywrightRecorder] Recorded attributes: testId=${testId}, name=${name}, id=${id}, ariaLabel=${ariaLabel}`);

    // ════════════════════════════════════════════════════════════════════════════
    // ENTERPRISE-GRADE ELEMENT FINDING - PRIORITY ORDER:
    // 1. data-testid (most stable - explicitly added for testing)
    // 2. name attribute (stable - used by forms)
    // 3. id attribute (stable if not dynamic)
    // 4. aria-label (stable - accessibility)
    // 5. role + name combination (semantic)
    // 6. CSS selector from recording
    // 7. Text-based fallbacks (least reliable)
    // ════════════════════════════════════════════════════════════════════════════

    // ========== HIGHEST PRIORITY: TEST IDs ==========
    // data-testid is the GOLD STANDARD for test automation - always try first
    if (testId) {
      strategies.push({ type: 'testid-exact', value: `[data-testid="${testId}"]` });
      strategies.push({ type: 'testid-getby', value: `getByTestId:${testId}` });
      // Also try common variations
      strategies.push({ type: 'testid-alt', value: `[data-test-id="${testId}"]` });
      strategies.push({ type: 'testid-cy', value: `[data-cy="${testId}"]` });
      strategies.push({ type: 'testid-qa', value: `[data-qa="${testId}"]` });
    }

    // ========== HIGH PRIORITY: NAME ATTRIBUTE ==========
    // name attribute is stable and commonly used for form elements
    if (name) {
      strategies.push({ type: 'name-exact', value: `[name="${name}"]` });
      strategies.push({ type: 'name-button', value: `button[name="${name}"]` });
      strategies.push({ type: 'name-input', value: `input[name="${name}"]` });
    }

    // ========== HIGH PRIORITY: ID ATTRIBUTE ==========
    // Only use if it doesn't look dynamic
    if (id && !recorder._isDynamicId(id)) {
      strategies.push({ type: 'id-exact', value: `#${cssEscape(id)}` });
    }

    // ========== HIGH PRIORITY: ARIA-LABEL ==========
    // Accessibility attributes are typically stable
    if (ariaLabel) {
      strategies.push({ type: 'aria-exact', value: `[aria-label="${ariaLabel}"]` });
      strategies.push({ type: 'aria-getby', value: `getByLabel:${ariaLabel}` });
    }

    // ========== MEDIUM PRIORITY: TITLE ATTRIBUTE ==========
    if (title) {
      strategies.push({ type: 'title-exact', value: `[title="${title}"]` });
      strategies.push({ type: 'title-getby', value: `getByTitle:${title}` });
    }

    // ========== MEDIUM PRIORITY: ROLE + NAME ==========
    if (role && cleanLabel) {
      strategies.push({ type: 'role-name', value: `getByRole:${role}:${cleanLabel}` });
    }

    // ========== MEDIUM PRIORITY: HREF FOR LINKS ==========
    if (href && !isFillAction) {
      strategies.push({ type: 'href-exact', value: `a[href="${href}"]` });
      strategies.push({ type: 'href-contains', value: `a[href*="${href.split('/').pop()}"]` });
    }

    // ========== MEDIUM PRIORITY: RECORDED CSS SELECTOR ==========
    if (selectorStr && !selectorStr.includes('text=')) {
      strategies.push({ type: 'css-selector', value: selectorStr });
    }


    // 2. For fill actions, prioritize input-specific selectors FIRST
    if (isFillAction && cleanLabel) {
      const lowerLabel = cleanLabel.toLowerCase();

      // SALESFORCE LOGIN PAGE - Very specific selectors for username/password
      if (lowerLabel.includes('username') || lowerLabel.includes('user name') || lowerLabel.includes('email')) {
        strategies.push({ type: 'sf-username', value: `#username` });
        strategies.push({ type: 'sf-username-name', value: `input[name="username"]` });
        strategies.push({ type: 'sf-username-type', value: `input[type="email"]` });
        strategies.push({ type: 'sf-username-autocomplete', value: `input[autocomplete="username"]` });
        strategies.push({ type: 'sf-login-email', value: `input[id*="username" i]` });
      }
      if (lowerLabel.includes('password') || lowerLabel.includes('pwd')) {
        strategies.push({ type: 'sf-password', value: `#password` });
        strategies.push({ type: 'sf-password-name', value: `input[name="pw"]` });
        // Only use bare input[type="password"] for login pages (single password field)
        // NOT for registration/confirm-password pages where there are multiple password fields
        const isConfirmOrNew = lowerLabel.includes('confirm') || lowerLabel.includes('verify') ||
                               lowerLabel.includes('re-enter') || lowerLabel.includes('retype') ||
                               lowerLabel.includes('new password') || lowerLabel.includes('create');
        if (!isConfirmOrNew) {
          strategies.push({ type: 'sf-password-type', value: `input[type="password"]` });
        }
        strategies.push({ type: 'sf-password-autocomplete', value: `input[autocomplete="current-password"]` });
        strategies.push({ type: 'sf-login-password', value: `input[id*="password" i]` });
      }

      // LIST VIEW search - "Search this list..." - MUST come first!
      if (lowerLabel.includes('this list') || lowerLabel.includes('search this')) {
        strategies.push({ type: 'sf-listview-search', value: `input[placeholder*="Search this list" i]` });
        strategies.push({ type: 'sf-listview-search2', value: `lst-list-view-manager-header input[type="search"]` });
        strategies.push({ type: 'sf-listview-search3', value: `lightning-list-header input[type="search"]` });
        strategies.push({ type: 'sf-listview-search4', value: `.listViewContent input[placeholder*="Search" i]` });
        strategies.push({ type: 'sf-listview-search5', value: `input[name="Account-search-input"]` });
        strategies.push({ type: 'sf-listview-search6', value: `input[name*="-search-input"]` });
      }

      // App Launcher search - "Search apps and items..."
      if (lowerLabel.includes('apps') || lowerLabel.includes('items') || lowerLabel.includes('app launcher')) {
        strategies.push({ type: 'sf-app-search', value: `one-app-launcher-search input` });
        strategies.push({ type: 'sf-app-search2', value: `input[placeholder*="Search apps" i]` });
        strategies.push({ type: 'sf-app-search3', value: `input[placeholder*="apps and items" i]` });
      }

      // Global/Salesforce search (fallback for generic "search")
      if (lowerLabel.includes('search') || lowerLabel.includes('find')) {
        strategies.push({ type: 'sf-search-combobox', value: `lightning-base-combobox input` });
        strategies.push({ type: 'sf-search-aria', value: `input[aria-label*="Search" i]` });
        // Generic search selector LAST (matches multiple)
        strategies.push({ type: 'sf-global-search', value: `input[placeholder*="Search" i]` });
      }

      // ========== PLAYWRIGHT'S SHADOW DOM-PIERCING METHODS (These auto-pierce!) ==========
      // These are the most reliable for Shadow DOM - same approach as Autify, Katalon
      strategies.push({ type: 'getByLabel', value: `getByLabel:${cleanLabel}` });
      strategies.push({ type: 'getByPlaceholder', value: `getByPlaceholder:${cleanLabel}` });
      strategies.push({ type: 'getByTitle', value: `getByTitle:${cleanLabel}` });
      strategies.push({ type: 'getByRole-textbox', value: `getByRole:textbox:${cleanLabel}` });
      // Direct input/textarea targeting via label
      strategies.push({ type: 'label-input', value: `label:has-text("${cleanLabel}") >> input` });
      strategies.push({ type: 'label-textarea', value: `label:has-text("${cleanLabel}") >> textarea` });
      // Salesforce Lightning components - very specific selectors
      strategies.push({ type: 'lightning-input', value: `lightning-input[label="${cleanLabel}"] input` });
      strategies.push({ type: 'lightning-input-field', value: `lightning-input-field[field-label="${cleanLabel}"] input` });
      strategies.push({ type: 'lightning-textarea', value: `lightning-textarea[label="${cleanLabel}"] textarea` });
      strategies.push({ type: 'lightning-combobox', value: `lightning-combobox[label="${cleanLabel}"] input` });
      strategies.push({ type: 'lightning-grouped', value: `lightning-grouped-combobox[label="${cleanLabel}"] input` });
      // Standard HTML attributes
      strategies.push({ type: 'placeholder', value: `input[placeholder="${cleanLabel}"]` });
      strategies.push({ type: 'placeholder-contains', value: `input[placeholder*="${cleanLabel}" i]` });
      strategies.push({ type: 'textarea-placeholder', value: `textarea[placeholder="${cleanLabel}"]` });
      strategies.push({ type: 'name', value: `input[name="${cleanLabel}"]` });
      strategies.push({ type: 'name-contains', value: `input[name*="${cleanLabel}" i]` });
      strategies.push({ type: 'aria-label-input', value: `input[aria-label="${cleanLabel}"]` });
      strategies.push({ type: 'aria-label-input-contains', value: `input[aria-label*="${cleanLabel}" i]` });
      // Salesforce form rows - find input inside the row with matching label
      // NOTE: .slds-form-element is a small container, so has-text is safe here
      strategies.push({ type: 'sf-form-row', value: `.slds-form-element:has-text("${cleanLabel}") input` });
      strategies.push({ type: 'sf-form-row-textarea', value: `.slds-form-element:has-text("${cleanLabel}") textarea` });
      // NOTE: Removed div:has-text("label") >> input strategies.
      // has-text matches ANY ancestor containing the text (including the form container),
      // so >> input always finds the FIRST input on the page (e.g., Mobile Number on Flipkart).
    }

    // 3. For non-fill actions, add click-oriented strategies
    if (!isFillAction && cleanLabel) {
      const lowerLabel = cleanLabel.toLowerCase();

      // SALESFORCE-SPECIFIC CLICK TARGETS
      // App Launcher (9-dots icon)
      if (lowerLabel.includes('app launcher') || lowerLabel.includes('waffle') || lowerLabel === 'apps') {
        strategies.push({ type: 'sf-app-launcher', value: `button[title="App Launcher"]` });
        strategies.push({ type: 'sf-app-launcher-class', value: `.slds-icon-waffle` });
        strategies.push({ type: 'sf-app-launcher-one', value: `one-app-launcher-header button` });
        strategies.push({ type: 'sf-app-launcher-force', value: `[data-aura-class="forceModuleSwitcher"] button` });
      }

      // Login button
      if (lowerLabel.includes('log in') || lowerLabel.includes('login') || lowerLabel.includes('sign in')) {
        strategies.push({ type: 'sf-login-btn', value: `#Login` });
        strategies.push({ type: 'sf-login-btn-name', value: `input[name="Login"]` });
        strategies.push({ type: 'sf-login-btn-type', value: `input[type="submit"]` });
        strategies.push({ type: 'sf-login-btn-value', value: `input[value*="Log In" i]` });
        strategies.push({ type: 'sf-login-button', value: `button:has-text("Log In")` });
      }

      // Profile/User Menu
      if (lowerLabel.includes('profile') || lowerLabel.includes('user') || lowerLabel.includes('view profile')) {
        strategies.push({ type: 'sf-profile-btn', value: `[data-id="userProfileMenu"]` });
        strategies.push({ type: 'sf-profile-trigger', value: `.profileTrigger` });
        strategies.push({ type: 'sf-profile-title', value: `button[title*="View profile" i]` });
      }

      // Logout
      if (lowerLabel.includes('logout') || lowerLabel.includes('log out') || lowerLabel.includes('sign out')) {
        strategies.push({ type: 'sf-logout-link', value: `a:has-text("Log Out")` });
        strategies.push({ type: 'sf-logout-menuitem', value: `[role="menuitem"]:has-text("Log Out")` });
      }

      // Tabs (Details, Related, etc.)
      if (lowerLabel === 'details' || lowerLabel === 'related' || lowerLabel === 'news' || lowerLabel === 'activity') {
        strategies.push({ type: 'sf-tab', value: `a[role="tab"]:has-text("${cleanLabel}")` });
        strategies.push({ type: 'sf-tab-link', value: `lightning-tab[label="${cleanLabel}"]` });
        strategies.push({ type: 'sf-tab-slds', value: `.slds-tabs_default__item a:has-text("${cleanLabel}")` });
      }

      // New button (for record creation)
      if (lowerLabel === 'new' || lowerLabel.includes('new ')) {
        strategies.push({ type: 'sf-new-btn', value: `button[name="New"]` });
        strategies.push({ type: 'sf-new-action', value: `[title="New"]` });
        strategies.push({ type: 'sf-new-text', value: `a:has-text("New")` });
        strategies.push({ type: 'sf-new-list', value: `runtime_platform_actions-action-renderer button:has-text("New")` });
      }

      // ========== PLAYWRIGHT'S SHADOW DOM-PIERCING METHODS (These auto-pierce!) ==========
      // Using getBy* methods which automatically pierce shadow DOM
      strategies.push({ type: 'getByRole-button', value: `getByRole:button:${cleanLabel}` });
      strategies.push({ type: 'getByRole-link', value: `getByRole:link:${cleanLabel}` });
      strategies.push({ type: 'getByRole-tab', value: `getByRole:tab:${cleanLabel}` });
      strategies.push({ type: 'getByRole-menuitem', value: `getByRole:menuitem:${cleanLabel}` });
      strategies.push({ type: 'getByText', value: `getByText:${cleanLabel}` });
      strategies.push({ type: 'getByTitle', value: `getByTitle:${cleanLabel}` });

      // APOSTROPHE FIX: Add strategies with normalized apostrophes if different
      if (cleanLabelNormalized !== cleanLabel) {
        strategies.push({ type: 'getByRole-button-apostrophe', value: `getByRole:button:${cleanLabelNormalized}` });
        strategies.push({ type: 'getByRole-link-apostrophe', value: `getByRole:link:${cleanLabelNormalized}` });
        strategies.push({ type: 'getByText-apostrophe', value: `getByText:${cleanLabelNormalized}` });
      }

      // APOSTROPHE FIX: Add regex-based apostrophe-flexible strategies
      strategies.push({ type: 'getByRoleRegex-link', value: `getByRoleRegex:link:${cleanLabel}` });
      strategies.push({ type: 'getByText-apostrophe-flex', value: `getByTextRegex:${cleanLabel}` });

      // Exact text match
      strategies.push({ type: 'exact-text', value: `text="${cleanLabel}"` });
      // Case-insensitive exact match
      strategies.push({ type: 'text-insensitive', value: `text="${cleanLabel}" >> visible=true` });
      // Role-based matching (CSS-style, less reliable for shadow DOM)
      strategies.push({ type: 'role-button', value: `role=button[name="${cleanLabel}"]` });
      strategies.push({ type: 'role-link', value: `role=link[name="${cleanLabel}"]` });
      strategies.push({ type: 'role-tab', value: `role=tab[name="${cleanLabel}"]` });
      strategies.push({ type: 'role-menuitem', value: `role=menuitem[name="${cleanLabel}"]` });
      strategies.push({ type: 'role-option', value: `role=option[name="${cleanLabel}"]` });
      // Aria-label match
      strategies.push({ type: 'aria-label-exact', value: `[aria-label="${cleanLabel}"]` });
      strategies.push({ type: 'aria-label-contains', value: `[aria-label*="${cleanLabel}" i]` });
      // Title attribute
      strategies.push({ type: 'title', value: `[title="${cleanLabel}"]` });
      strategies.push({ type: 'title-contains', value: `[title*="${cleanLabel}" i]` });
      // Partial text match (looser)
      strategies.push({ type: 'text-partial', value: `text=${cleanLabel}` });
      // Contains text (for nested elements) - only for click actions
      strategies.push({ type: 'has-text', value: `button:has-text("${cleanLabel}")` });
      strategies.push({ type: 'has-text-a', value: `a:has-text("${cleanLabel}")` });
      strategies.push({ type: 'has-text-span', value: `span:has-text("${cleanLabel}")` });
      strategies.push({ type: 'has-text-div', value: `div:has-text("${cleanLabel}") >> visible=true` });

      // KEYWORD EXTRACTION: Find key phrases (proper nouns, product names)
      // e.g., "Go To Saver's Switch" → try "Saver's Switch" (the unique product name)
      const keyPhrases = cleanLabel
        .split(/\s+(?:to|the|a|an|with|for|on|in|and|or|of)\s+/i) // Split on common words
        .filter(phrase => phrase.length > 3)
        .map(phrase => phrase.trim());

      for (const keyPhrase of keyPhrases) {
        if (keyPhrase.length >= 5 && keyPhrase !== cleanLabel) {
          // Try with apostrophe-flexible regex
          strategies.push({ type: 'keyword-link', value: `getByRoleRegex:link:${keyPhrase}` });
          strategies.push({ type: 'keyword-text', value: `getByTextRegex:${keyPhrase}` });
          strategies.push({ type: 'has-text-keyword', value: `a:has-text("${keyPhrase}")` });
          strategies.push({ type: 'has-text-keyword-norm', value: `a:has-text("${normalizeTextForMatching(keyPhrase)}")` });
        }
      }
    }

    // 4. Try ID if available
    if (action.id) {
      strategies.unshift({ type: 'id', value: `#${cssEscape(action.id)}` });
    }

    // ========== PHASE 1: Try all defined strategies ==========
    for (const strategy of strategies) {
      try {
        let locator;
        let baseLocator; // Base locator before applying index

        // Handle special Playwright locator methods (THESE AUTOMATICALLY PIERCE SHADOW DOM)
        // CRITICAL FIX: Use getAtIndex() instead of .first() to respect elementIndex
        if (strategy.value.startsWith('getByTestId:')) {
          // HIGHEST PRIORITY: data-testid - most reliable selector
          const testIdValue = strategy.value.replace('getByTestId:', '');
          baseLocator = searchScope.getByTestId(testIdValue);
          locator = getAtIndex(baseLocator);
        } else if (strategy.value.startsWith('getByRoleRegex:')) {
          // APOSTROPHE FIX: Use regex for role name that matches any apostrophe variant
          const parts = strategy.value.replace('getByRoleRegex:', '').split(':');
          if (parts.length === 2) {
            const flexRegex = createApostropheFlexRegex(parts[1]);
            baseLocator = searchScope.getByRole(parts[0], { name: flexRegex });
            locator = getAtIndex(baseLocator);
          }
        } else if (strategy.value.startsWith('getByTextRegex:')) {
          // APOSTROPHE FIX: Use regex that matches any apostrophe variant
          const text = strategy.value.replace('getByTextRegex:', '');
          const flexRegex = createApostropheFlexRegex(text);
          baseLocator = searchScope.getByText(flexRegex);
          locator = getAtIndex(baseLocator);
        } else if (strategy.value.startsWith('getByText:')) {
          const text = strategy.value.replace('getByText:', '');
          baseLocator = searchScope.getByText(text, { exact: true });
          locator = getAtIndex(baseLocator);
        } else if (strategy.value.startsWith('getByLabel:')) {
          const labelText = strategy.value.replace('getByLabel:', '');
          baseLocator = searchScope.getByLabel(labelText);
          locator = getAtIndex(baseLocator);
        } else if (strategy.value.startsWith('getByRole:textbox:')) {
          const name = strategy.value.replace('getByRole:textbox:', '');
          baseLocator = searchScope.getByRole('textbox', { name });
          locator = getAtIndex(baseLocator);
        } else if (strategy.value.startsWith('getByRole:button:')) {
          const name = strategy.value.replace('getByRole:button:', '');
          baseLocator = searchScope.getByRole('button', { name });
          locator = getAtIndex(baseLocator);
        } else if (strategy.value.startsWith('getByRole:link:')) {
          const name = strategy.value.replace('getByRole:link:', '');
          baseLocator = searchScope.getByRole('link', { name });
          locator = getAtIndex(baseLocator);
        } else if (strategy.value.startsWith('getByRole:tab:')) {
          const name = strategy.value.replace('getByRole:tab:', '');
          baseLocator = searchScope.getByRole('tab', { name });
          locator = getAtIndex(baseLocator);
        } else if (strategy.value.startsWith('getByRole:menuitem:')) {
          const name = strategy.value.replace('getByRole:menuitem:', '');
          baseLocator = searchScope.getByRole('menuitem', { name });
          locator = getAtIndex(baseLocator);
        } else if (strategy.value.startsWith('getByRole:')) {
          // Generic getByRole handler for role-name strategies
          const parts = strategy.value.replace('getByRole:', '').split(':');
          if (parts.length === 2) {
            baseLocator = searchScope.getByRole(parts[0], { name: parts[1] });
          } else {
            baseLocator = searchScope.getByRole(parts[0]);
          }
          locator = getAtIndex(baseLocator);
        } else if (strategy.value.startsWith('getByPlaceholder:')) {
          const placeholder = strategy.value.replace('getByPlaceholder:', '');
          baseLocator = searchScope.getByPlaceholder(placeholder);
          locator = getAtIndex(baseLocator);
        } else if (strategy.value.startsWith('getByTitle:')) {
          const title = strategy.value.replace('getByTitle:', '');
          baseLocator = searchScope.getByTitle(title);
          locator = getAtIndex(baseLocator);
        } else {
          baseLocator = searchScope.locator(strategy.value);
          locator = getAtIndex(baseLocator);
        }

        if (!locator) continue; // Skip if locator wasn't created
        const count = await locator.count().catch(() => 0);
        if (count > 0) {
          // isVisible() is an instant boolean check - no timeout needed
          const isVisible = await locator.isVisible().catch(() => false);
          if (isVisible) {
            // For fill actions, validate that the element is actually fillable
            if (isFillAction) {
              const isFillable = await locator.evaluate(el => {
                const tagName = el.tagName.toLowerCase();
                const isInput = tagName === 'input';
                const isTextarea = tagName === 'textarea';
                const isSelect = tagName === 'select';
                const isContentEditable = el.isContentEditable || el.getAttribute('contenteditable') === 'true';
                // Also check for readonly
                const isReadonly = el.hasAttribute('readonly') || el.getAttribute('aria-readonly') === 'true';
                return (isInput || isTextarea || isSelect || isContentEditable) && !isReadonly;
              }).catch(() => false);

              if (!isFillable) {
                console.log(`[PlaywrightRecorder] ✗ Element found but not fillable: ${strategy.type}`);
                continue; // Try next strategy
              }
            }

            console.log(`[PlaywrightRecorder] ✓ Found element using ${strategy.type}: ${strategy.value}`);
            return { locator, strategy };
          }
        }
      } catch (e) {
        // Try next strategy
      }
    }

    // ========== PHASE 2: SHADOW DOM DEEP SEARCH (Last Resort) ==========
    // This is the nuclear option - search through ALL shadow roots using evaluate
    console.log(`[PlaywrightRecorder] Trying deep Shadow DOM search for: "${cleanLabel}"`);

    try {
      const shadowResult = await recorder.page.evaluate((params) => {
        const { label, isFill } = params;
        const cleanLabel = label.toLowerCase();

        // Deep query function
        function deepQuery(root, results, visited) {
          if (visited.has(root)) return;
          visited.add(root);

          // Search in this root
          try {
            const allElements = root.querySelectorAll('*');
            allElements.forEach(el => {
              // Check various attributes
              const text = (el.textContent || '').trim().toLowerCase();
              const ariaLabel = (el.getAttribute('aria-label') || '').toLowerCase();
              const title = (el.getAttribute('title') || '').toLowerCase();
              const placeholder = (el.getAttribute('placeholder') || '').toLowerCase();
              const name = (el.getAttribute('name') || '').toLowerCase();
              const tag = (el.tagName || '').toLowerCase();

              // Check if matches
              const matches = text.includes(cleanLabel) ||
                             ariaLabel.includes(cleanLabel) ||
                             title.includes(cleanLabel) ||
                             placeholder.includes(cleanLabel) ||
                             name.includes(cleanLabel);

              if (matches) {
                // For fill actions, only return fillable elements
                if (isFill) {
                  if (tag === 'input' || tag === 'textarea' || tag === 'select' || el.isContentEditable) {
                    results.push({
                      tag: tag,
                      id: el.id,
                      name: el.getAttribute('name'),
                      placeholder: el.getAttribute('placeholder'),
                      ariaLabel: el.getAttribute('aria-label'),
                      title: el.getAttribute('title'),
                      // Create a unique path for this element
                      path: getElementPath(el)
                    });
                  }
                } else {
                  results.push({
                    tag: tag,
                    id: el.id,
                    text: text.substring(0, 50),
                    ariaLabel: ariaLabel,
                    title: title,
                    role: el.getAttribute('role'),
                    path: getElementPath(el)
                  });
                }
              }

              // Recurse into shadow root
              if (el.shadowRoot) {
                deepQuery(el.shadowRoot, results, visited);
              }
            });
          } catch(e) {}
        }

        // Generate a locatable path for an element
        function getElementPath(el) {
          const parts = [];
          let current = el;
          let shadowDepth = 0;

          while (current && current !== document.body) {
            const tag = current.tagName.toLowerCase();
            const id = current.id;
            const nth = getNthOfType(current);

            if (id && !/^(lwc|aura)-/i.test(id)) {
              parts.unshift('#' + id);
              break; // ID is unique enough
            } else {
              parts.unshift(tag + (nth > 0 ? ':nth-of-type(' + (nth + 1) + ')' : ''));
            }

            // Check if we crossed a shadow boundary
            const root = current.getRootNode();
            if (root !== document && root.host) {
              parts.unshift('>>'); // Shadow boundary marker
              current = root.host;
              shadowDepth++;
            } else {
              current = current.parentElement;
            }

            if (parts.length > 10) break; // Limit depth
          }

          return { selector: parts.join(' > '), shadowDepth };
        }

        function getNthOfType(el) {
          let n = 0;
          let sibling = el.previousElementSibling;
          while (sibling) {
            if (sibling.tagName === el.tagName) n++;
            sibling = sibling.previousElementSibling;
          }
          return n;
        }

        const results = [];
        deepQuery(document, results, new WeakSet());
        return results;
      }, { label: cleanLabel, isFill: isFillAction });

      if (shadowResult && shadowResult.length > 0) {
        // Try to locate the first found element
        const found = shadowResult[0];
        console.log(`[PlaywrightRecorder] Deep search found ${shadowResult.length} candidates:`, found);

        // Build locator from the found element info
        // Use getAtIndex to respect elementIndex for duplicate elements
        let locator;
        if (found.id && !/^(lwc|aura)-/i.test(found.id)) {
          locator = getAtIndex(searchScope.locator(`#${cssEscape(found.id)}`));
        } else if (found.ariaLabel) {
          locator = getAtIndex(searchScope.getByLabel(found.ariaLabel));
        } else if (found.placeholder) {
          locator = getAtIndex(searchScope.getByPlaceholder(found.placeholder));
        } else if (found.title) {
          locator = getAtIndex(searchScope.getByTitle(found.title));
        } else if (found.name) {
          locator = getAtIndex(searchScope.locator(`[name="${found.name}"]`));
        }

        if (locator) {
          const count = await locator.count().catch(() => 0);
          if (count > 0) {
            console.log(`[PlaywrightRecorder] ✓ Found via deep Shadow DOM search`);
            return { locator, strategy: { type: 'deep-shadow-search', value: 'evaluated' } };
          }
        }
      }
    } catch (e) {
      console.log(`[PlaywrightRecorder] Deep Shadow DOM search failed:`, e.message);
    }

    console.log(`[PlaywrightRecorder] ✗ Could not find element: "${cleanLabel}"`);
    return null;
}


/**
 * Find element with retry - wraps the element finding logic with retries.
 * @param {Object} recorder - The PlaywrightRecorder instance
 * @param {Object} action - The action containing element info
 * @returns {Promise<{locator, strategy}|null>}
 */
async function findElementWithRetry(recorder, action) {
    const label = getActionLabel(action); // FIXED: Use comprehensive normalized extraction

    try {
      return await recorder.retryWithBackoff(async () => {
        // Check page is still valid
        if (!recorder.page || recorder.page.isClosed()) {
          throw new Error('Page is closed');
        }

        // Get the appropriate scope (page or iframe)
        const scope = await recorder._getFrameScope(action);
        const isIframe = scope !== recorder.page;
        if (isIframe) {
          console.log('[PlaywrightRecorder] Searching within iframe context');
        }

        // Try SmartFinder first
        console.log('[PlaywrightRecorder] ========== ELEMENT FINDING DEBUG ==========');
        console.log('[PlaywrightRecorder] Action data:', JSON.stringify({
          type: action.type,
          text: action.text,
          label: action.label,
          'args[0]': action.args?.[0],
          'selectorObj.text': action.selectorObj?.text,
          'element.text': action.element?.text,
          recipe: action.recipe,
          manualOverride: action.selectorObj?.manualOverride || action.manualOverride,
        }, null, 2));

        if (recorder.useSmartFinderForPlayback) {
          // Re-create SmartFinder if scope changed (e.g., switched to/from iframe)
          const smartFinderTarget = isIframe ? scope : recorder.page;
          if (!recorder.smartFinder || (isIframe && recorder.smartFinder.page !== smartFinderTarget)) {
            recorder.smartFinder = new SmartFinder(smartFinderTarget, { debug: true, timeout: 8000 });
          }

          // FAST PATH: Skip heavy waits when a locked selector is available
          // Locked selectors are already proven to work, no need to wait for full DOM settle
          const _hasLockedSelector = !!(getLockedSelector(action));
          if (!_hasLockedSelector) {
            await recorder.page.waitForLoadState('domcontentloaded').catch(() => {});
            // Wait for framework hydration (reduced from 300ms, Playwright auto-wait handles most cases)
            await recorder.page.waitForTimeout(100);
          } else {
            // Minimal wait for locked selectors - just ensure page isn't mid-navigation
            await recorder.page.waitForTimeout(50);
          }

          // ═══════════════════════════════════════════════════════════════════
          // OPTIMIZED SELECTOR: User-locked selector from "Lock Locators"
          // Try this FIRST with very short timeout - it should work instantly
          // This travels with the test case, works across environments
          // Supports: CSS selectors, role=xxx[name="yyy"], aria-label, etc.
          // ═══════════════════════════════════════════════════════════════════
          const optimizedSelector = getLockedSelector(action);
          if (optimizedSelector) {
            console.log(`[PlaywrightRecorder] ⚡ Trying LOCKED selector: ${optimizedSelector}`);
            try {
              let locator;

              // Handle role=xxx[name="yyy"] format (from Lock Locators)
              const roleMatch = optimizedSelector.match(/^role=(\w+)\[name="(.+)"\]$/);
              if (roleMatch) {
                const [, role, name] = roleMatch;
                console.log(`[PlaywrightRecorder] ⚡ Using getByRole('${role}', { name: '${name}' })`);
                locator = scope.getByRole(role, { name: name });
              } else {
                // Regular CSS selector
                locator = scope.locator(optimizedSelector);
              }

              // Quick 150ms check - locked selectors should work instantly
              const found = await Promise.race([
                locator.count().then(c => c > 0),
                new Promise(resolve => setTimeout(() => resolve(false), 150))
              ]);

              if (found) {
                const isVisible = await locator.first().isVisible().catch(() => false);
                if (isVisible) {
                  console.log(`[PlaywrightRecorder] ⚡ LOCKED selector SUCCESS - instant find!`);
                  // Track working selector for Lock Locators feature
                  recorder._lastWorkingSelector = optimizedSelector;
                  recorder._lastStrategyType = 'LockedSelector';
                  return { locator: locator.first(), strategy: { type: 'LockedSelector' } };
                }
              }
              console.log(`[PlaywrightRecorder] Locked selector not found, trying Quick Scan...`);
              // Flag that locked selector failed - we'll need to heal it
              recorder._lockedSelectorFailed = true;
            } catch (e) {
              console.log(`[PlaywrightRecorder] Locked selector failed: ${e.message}, trying Quick Scan...`);
              recorder._lockedSelectorFailed = true;
            }
          }

          // ═══════════════════════════════════════════════════════════════════
          // QUICK SCAN: Fast text/role/aria-label checks BEFORE heavy SmartFinder
          // These use Playwright's built-in locators (auto-pierce shadow DOM)
          // Each check takes <100ms - total ~500ms vs SmartFinder's 5-15s
          // ═══════════════════════════════════════════════════════════════════
          const quickScanLabel = label || action.text || action.selectorObj?.text || action.args?.[0] || '';
          if (quickScanLabel && !isIframe) {
            console.log(`[PlaywrightRecorder] 🔍 Quick Scan for: "${quickScanLabel}"`);
            const quickScanStart = Date.now();

            // Build quick scan strategies based on action type
            const isFillAction = ['fill', 'type', 'input'].includes((action.type || '').toLowerCase());
            const quickStrategies = [];

            if (isFillAction) {
              // For fill actions: try input-specific locators
              quickStrategies.push({ name: 'getByLabel', fn: () => scope.getByLabel(quickScanLabel) });
              quickStrategies.push({ name: 'getByPlaceholder', fn: () => scope.getByPlaceholder(quickScanLabel) });
              quickStrategies.push({ name: 'getByRole-textbox', fn: () => scope.getByRole('textbox', { name: quickScanLabel }) });
              quickStrategies.push({ name: 'aria-label-input', fn: () => scope.locator(`input[aria-label="${quickScanLabel}"]`) });
              quickStrategies.push({ name: 'name-input', fn: () => scope.locator(`input[name="${quickScanLabel}"]`) });
            } else {
              // For click actions: try role-based locators first (guaranteed interactive), text-based last
              quickStrategies.push({ name: 'getByRole-button', fn: () => scope.getByRole('button', { name: quickScanLabel }) });
              quickStrategies.push({ name: 'getByRole-link', fn: () => scope.getByRole('link', { name: quickScanLabel }) });
              quickStrategies.push({ name: 'getByRole-menuitem', fn: () => scope.getByRole('menuitem', { name: quickScanLabel }) });
              quickStrategies.push({ name: 'getByRole-tab', fn: () => scope.getByRole('tab', { name: quickScanLabel }) });
              quickStrategies.push({ name: 'getByTitle', fn: () => scope.getByTitle(quickScanLabel) });
              quickStrategies.push({ name: 'aria-label', fn: () => scope.locator(`[aria-label="${quickScanLabel}"]`) });
              quickStrategies.push({ name: 'title-attr', fn: () => scope.locator(`[title="${quickScanLabel}"]`) });
              // getByText LAST: can match non-interactive elements (spans, divs), needs interactivity guard
              quickStrategies.push({ name: 'getByText', fn: () => scope.getByText(quickScanLabel, { exact: false }), needsInteractivityCheck: true });
            }

            for (const qs of quickStrategies) {
              try {
                const qsLocator = qs.fn();
                const qsFound = await Promise.race([
                  qsLocator.count().then(c => c > 0),
                  new Promise(resolve => setTimeout(() => resolve(false), 250))
                ]);
                if (qsFound) {
                  const qsVisible = await qsLocator.first().isVisible().catch(() => false);
                  if (qsVisible) {
                    // Interactivity guard: getByText can match non-interactive elements (span, div, p)
                    if (qs.needsInteractivityCheck) {
                      const isInteractive = await qsLocator.first().evaluate(el => {
                        const tag = el.tagName.toLowerCase();
                        const interactiveTags = ['a', 'button', 'input', 'select', 'textarea', 'summary', 'details'];
                        if (interactiveTags.includes(tag)) return true;
                        if (el.getAttribute('role') && ['button', 'link', 'tab', 'menuitem', 'checkbox', 'radio', 'switch', 'option'].includes(el.getAttribute('role'))) return true;
                        if (el.getAttribute('onclick') || el.getAttribute('tabindex') !== null) return true;
                        if (el.closest('a, button')) return true;
                        return false;
                      }).catch(() => false);
                      if (!isInteractive) {
                        console.log(`[PlaywrightRecorder] 🔍 Quick Scan SKIP "${qs.name}" - matched non-interactive element`);
                        continue;
                      }
                    }
                    const quickMs = Date.now() - quickScanStart;
                    console.log(`[PlaywrightRecorder] 🔍 Quick Scan HIT: "${qs.name}" in ${quickMs}ms`);
                    // Track for Lock Locators
                    const qsSelectorStr = qs.name.startsWith('getByRole-')
                      ? `role=${qs.name.replace('getByRole-', '')}[name="${quickScanLabel}"]`
                      : qs.name === 'getByText' ? `text="${quickScanLabel}"`
                      : qs.name === 'getByTitle' ? `[title="${quickScanLabel}"]`
                      : qs.name === 'getByLabel' ? `getByLabel:${quickScanLabel}`
                      : qs.name === 'getByPlaceholder' ? `getByPlaceholder:${quickScanLabel}`
                      : `[aria-label="${quickScanLabel}"]`;
                    recorder._lastWorkingSelector = qsSelectorStr;
                    recorder._lastStrategyType = `QuickScan-${qs.name}`;

                    // Self-healing: if locked selector failed, report for auto-update
                    const needsHealing = recorder._lockedSelectorFailed && qsSelectorStr;
                    recorder._lockedSelectorFailed = false;

                    return {
                      locator: qsLocator.first(),
                      strategy: { type: `QuickScan-${qs.name}`, value: qsSelectorStr },
                      healed: needsHealing,
                      newSelector: needsHealing ? qsSelectorStr : null
                    };
                  }
                }
              } catch (e) {
                // Quick scan strategy failed - try next one
              }
            }
            const quickMs = Date.now() - quickScanStart;
            console.log(`[PlaywrightRecorder] 🔍 Quick Scan MISS (${quickMs}ms), falling through to SmartFinder...`);
          }

          const recipe = legacyActionToRecipe(action);
          console.log('[PlaywrightRecorder] Recipe for SmartFinder:', JSON.stringify(recipe, null, 2));

          // For iframes, we need to search within the frame
          let locator;
          if (isIframe) {
            // Try to find within iframe using basic selectors
            const testId = recipe.which?.testId;
            const text = recipe.what?.text;
            const role = recipe.what?.role;

            if (testId) {
              locator = scope.locator(`[data-testid="${testId}"]`);
            } else if (role && text) {
              locator = scope.getByRole(role, { name: text });
            } else if (text) {
              locator = scope.getByText(text);
            } else if (recipe.which?.id) {
              locator = scope.locator(`#${recipe.which.id}`);
            }

            if (locator && await locator.count() > 0) {
              return { locator, strategy: { type: 'SmartFinder-iframe' } };
            }
          } else {
            console.log('[PlaywrightRecorder] Calling SmartFinder.find()...');
            try {
              locator = await recorder.smartFinder.find(recipe);
              console.log('[PlaywrightRecorder] SmartFinder result:', locator ? 'FOUND' : 'NOT FOUND');
              if (locator) {
                // Check if SmartFinder already clicked the element directly
                // This happens for Salesforce "New" buttons where we use direct element access
                if (locator.__directClickComplete) {
                  console.log('[PlaywrightRecorder] SmartFinder already performed the click directly');
                  return {
                    locator: null,
                    strategy: { type: 'SmartFinder-DirectClick' },
                    alreadyClicked: true  // Signal that no further click is needed
                  };
                }
                // Check if SmartFinder returned a direct click signal (coordinate-based fallback)
                if (locator.__useDirectClick && locator.coords) {
                  console.log(`[PlaywrightRecorder] SmartFinder requesting direct coordinate click at (${locator.coords.x}, ${locator.coords.y})`);
                  return {
                    locator: null,
                    strategy: { type: 'SmartFinder-DirectCoordinates' },
                    useDirectClick: true,
                    coords: locator.coords
                  };
                }
                // Track what SmartFinder used for Lock Locators
                const sfStrategy = recorder.smartFinder?.lastSuccessfulStrategy || 'SmartFinder';
                const sfSelector = recorder.smartFinder?.lastSuccessfulSelector || null;
                recorder._lastWorkingSelector = sfSelector;
                recorder._lastStrategyType = sfStrategy;

                // SELF-HEALING: If locked selector failed but SmartFinder worked,
                // flag this so frontend can auto-update the optimizedSelector
                const needsHealing = recorder._lockedSelectorFailed && sfSelector;
                recorder._lockedSelectorFailed = false; // Reset for next step

                return {
                  locator,
                  strategy: { type: 'SmartFinder', value: sfStrategy },
                  // Self-healing data: frontend should update step's optimizedSelector
                  healed: needsHealing,
                  newSelector: needsHealing ? sfSelector : null
                };
              }
            } catch (sfError) {
              console.error('[PlaywrightRecorder] SmartFinder threw error:', sfError.message);
            }
          }
        } else {
          console.log('[PlaywrightRecorder] useSmartFinderForPlayback is DISABLED');
        }

        // Fallback to legacy finder
        console.log('[PlaywrightRecorder] SmartFinder failed, trying legacy _findElement...');
        const result = await _findElement(recorder, action, scope);
        if (result) {
          // Set for Lock Locators: legacy find doesn't set _lastWorkingSelector elsewhere
          const selectorUsed = result.strategy?.value;
          if (selectorUsed && typeof selectorUsed === 'string') {
            recorder._lastWorkingSelector = selectorUsed;
            recorder._lastStrategyType = result.strategy?.type || 'legacy';
          }
          return result;
        }

        throw new Error(`Element not found: "${label}"`);
      }, { maxRetries: 3, description: `Find "${label}"` });
    } catch (e) {
      console.log(`[PlaywrightRecorder] findElementWithRetry failed:`, e.message);
      return null; // All retries failed
    }
}

module.exports = { _findElement, findElementWithRetry };
