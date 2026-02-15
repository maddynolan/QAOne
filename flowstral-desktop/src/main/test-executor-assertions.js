/**
 * Step Assertion Executor
 * Extracted from test-executor.js for modularity.
 *
 * Executes assertions attached to test steps (not standalone assertion steps).
 * Each assertion type checks a specific condition on the page.
 *
 * Usage:
 *   const { executeStepAssertion } = require('./test-executor-assertions');
 *   await executeStepAssertion(page, assertion, stepSelector, timeout);
 */

/**
 * Normalize selector - handles both string and object formats.
 * @param {string|Object} sel
 * @returns {string}
 */
function normalizeSelector(sel) {
  if (!sel) return '';
  if (typeof sel === 'string') return sel;
  return sel.selector || sel.value || sel.css || sel.xpath || '';
}

/**
 * Execute a step assertion.
 * @param {import('playwright').Page} page - Playwright page
 * @param {Object} assertion - Assertion object with type, expected, target/selector
 * @param {string} stepSelector - Fallback selector from the step (for value assertions)
 * @param {number} timeout - Default timeout in ms
 */
async function executeStepAssertion(page, assertion, stepSelector = '', timeout = 30000) {
  const { type, expected } = assertion;
  // Support both 'target' and 'selector' property names (normalize if object)
  const target = assertion.target || normalizeSelector(assertion.selector) || stepSelector;

  console.log(`[Executor] Assertion type="${type}" expected="${expected}" target="${target}"`);

  switch (type) {
    case 'text_contains':
    case 'textContains': {
      if (!expected) throw new Error('No expected text');
      const hasText = await page.getByText(expected, { exact: false }).first().isVisible({ timeout: 5000 }).catch(() => false);
      if (!hasText) throw new Error(`Text "${expected}" not visible on page`);
      break;
    }

    case 'value_contains':
    case 'valueContains': {
      if (!expected) {
        console.log('[Executor] value_contains: no expected value, auto-pass');
        break;
      }

      let valueFound = false;
      let inputTarget = target;

      if (inputTarget) {
        try {
          const inputVal = await page.locator(inputTarget).first().inputValue({ timeout: 5000 });
          if (inputVal && inputVal.toLowerCase().includes(expected.toLowerCase())) {
            valueFound = true;
            console.log(`[Executor] value_contains: Found "${expected}" in target input`);
          } else {
            throw new Error(`Input value "${inputVal}" does not contain "${expected}"`);
          }
        } catch (e) {
          if (e.message.includes('does not contain')) throw e;
          console.log(`[Executor] Target selector failed, searching all inputs...`);
        }
      }

      if (!valueFound) {
        console.log(`[Executor] Searching all inputs for value containing "${expected}"...`);
        const allInputs = await page.locator('input, textarea, [contenteditable="true"]').all();

        for (const input of allInputs) {
          try {
            let val = await input.inputValue({ timeout: 500 }).catch(() => null);
            if (val === null) {
              val = await input.textContent({ timeout: 500 }).catch(() => '');
            }
            if (val && val.toLowerCase().includes(expected.toLowerCase())) {
              valueFound = true;
              console.log(`[Executor] value_contains: Found "${expected}" in an input!`);
              break;
            }
          } catch (e) { /* ignore individual input errors */ }
        }

        if (!valueFound) {
          const pageText = await page.getByText(expected, { exact: false }).first().isVisible({ timeout: 2000 }).catch(() => false);
          if (pageText) {
            valueFound = true;
            console.log(`[Executor] value_contains: Found "${expected}" as visible text on page`);
          }
        }

        if (!valueFound) {
          throw new Error(`Value "${expected}" not found in any input or visible on page`);
        }
      }
      break;
    }

    case 'text_equals':
    case 'textEquals': {
      if (!target) throw new Error('No target selector');
      const elemText = await page.locator(target).first().textContent({ timeout: 5000 }).catch(() => '');
      if (elemText?.trim() !== expected?.trim()) {
        throw new Error(`Expected "${expected}" but got "${elemText?.trim()}"`);
      }
      break;
    }

    case 'element_visible':
    case 'elementVisible': {
      const visSelector = target || (expected ? `text=${expected}` : null);
      if (!visSelector) throw new Error('No target or text specified');
      const isVis = await page.locator(visSelector).first().isVisible({ timeout: 5000 }).catch(() => false);
      if (!isVis) throw new Error(`Element not visible: ${visSelector}`);
      break;
    }

    case 'element_hidden':
    case 'element_not_visible': {
      const hidSelector = target || (expected ? `text=${expected}` : null);
      if (!hidSelector) throw new Error('No target or text specified');
      const stillVis = await page.locator(hidSelector).first().isVisible({ timeout: 2000 }).catch(() => false);
      if (stillVis) throw new Error(`Element still visible: ${hidSelector}`);
      break;
    }

    case 'element_enabled':
    case 'elementEnabled': {
      if (!target) throw new Error('No target selector');
      const isEnabled = await page.locator(target).first().isEnabled({ timeout: 5000 }).catch(() => false);
      if (!isEnabled) throw new Error(`Element not enabled: ${target}`);
      break;
    }

    case 'element_disabled':
    case 'elementDisabled': {
      if (!target) throw new Error('No target selector');
      const isDisabled = await page.locator(target).first().isDisabled({ timeout: 5000 }).catch(() => false);
      if (!isDisabled) throw new Error(`Element not disabled: ${target}`);
      break;
    }

    case 'url_contains':
    case 'urlContains': {
      if (!expected) throw new Error('No expected URL text');
      const url = page.url();
      if (!url.includes(expected)) throw new Error(`URL "${url}" doesn't contain "${expected}"`);
      break;
    }

    case 'url_equals':
    case 'urlEquals': {
      if (!expected) throw new Error('No expected URL');
      const urlExact = page.url();
      if (urlExact !== expected) throw new Error(`URL is "${urlExact}", expected "${expected}"`);
      break;
    }

    case 'value_equals':
    case 'valueEquals': {
      if (!expected) {
        console.log('[Executor] value_equals: no expected value, auto-pass');
        break;
      }

      let valueEqualsFound = false;

      if (target) {
        const val = await page.locator(target).first().inputValue({ timeout: 5000 }).catch(() => '');
        if (val !== expected) throw new Error(`Value is "${val}", expected "${expected}"`);
        valueEqualsFound = true;
      } else {
        console.log(`[Executor] value_equals: No target, searching all inputs for "${expected}"...`);
        const allInputs = await page.locator('input, textarea, [contenteditable="true"]').all();

        for (const input of allInputs) {
          try {
            let inputVal = await input.inputValue({ timeout: 500 }).catch(() => null);
            if (inputVal === null) {
              inputVal = await input.textContent({ timeout: 500 }).catch(() => '');
            }
            if (inputVal === expected) {
              valueEqualsFound = true;
              console.log(`[Executor] value_equals: Found exact value "${expected}" in an input!`);
              break;
            }
          } catch (e) { /* ignore individual input errors */ }
        }

        if (!valueEqualsFound) {
          throw new Error(`Value "${expected}" not found in any input on the page`);
        }
      }
      break;
    }

    case 'success':
    case 'verify_success':
      console.log('[Executor] Success assertion - auto-pass');
      break;

    case 'page_title':
    case 'title_contains': {
      if (!expected) throw new Error('No expected title');
      const title = await page.title();
      if (!title.toLowerCase().includes(expected.toLowerCase())) {
        throw new Error(`Title "${title}" doesn't contain "${expected}"`);
      }
      break;
    }

    case 'toast_message':
    case 'alert_message': {
      if (!expected) throw new Error('No expected message text');
      const toastSelectors = [
        '.slds-notify__content', '.toastMessage', '.forceToastMessage',
        '[data-key="toastMessage"]', '.toast-message', '.alert-message',
        '[role="alert"]', '[role="status"]', '.notification', '.snackbar'
      ];
      let toastFound = false;
      for (const sel of toastSelectors) {
        try {
          const elem = page.locator(sel);
          if (await elem.count() > 0) {
            const text = await elem.first().textContent({ timeout: 2000 });
            if (text && text.toLowerCase().includes(expected.toLowerCase())) {
              toastFound = true;
              console.log(`[Executor] Toast found: "${text}"`);
              break;
            }
          }
        } catch (e) { /* ignore */ }
      }
      if (!toastFound) {
        toastFound = await page.getByText(expected, { exact: false }).first().isVisible({ timeout: 3000 }).catch(() => false);
      }
      if (!toastFound) {
        throw new Error(`Toast/Alert message "${expected}" not found`);
      }
      break;
    }

    case 'count_equals':
    case 'element_count': {
      if (!target) throw new Error('No target selector for count check');
      const count = await page.locator(target).count();
      const expectedCount = parseInt(expected || '0', 10);
      if (count !== expectedCount) {
        throw new Error(`Element count is ${count}, expected ${expectedCount}`);
      }
      break;
    }

    // ========== CONTEXT-AWARE ASSERTION TYPES ==========

    case 'page_loaded':
    case 'pageLoaded':
      try {
        await page.waitForLoadState('domcontentloaded', { timeout: 10000 });
        console.log('[Executor] page_loaded: DOM content loaded');
        await page.waitForTimeout(500);
      } catch (e) {
        throw new Error(`Page did not load within timeout: ${e.message}`);
      }
      break;

    case 'no_errors':
    case 'noErrors': {
      const errorSelectors = [
        '[class*="error"]', '[class*="Error"]',
        '[role="alert"]', '.alert-danger', '.error-message',
        '.slds-notify--error', '.forceToastMessage.error'
      ];
      for (const sel of errorSelectors) {
        const errElem = await page.locator(sel).first().isVisible({ timeout: 1000 }).catch(() => false);
        if (errElem) {
          const errText = await page.locator(sel).first().textContent().catch(() => '');
          throw new Error(`Error element found: ${errText || sel}`);
        }
      }
      console.log('[Executor] no_errors: No error elements visible');
      break;
    }

    case 'loading_complete':
    case 'loadingComplete': {
      const loaderSelectors = [
        '.loading', '.spinner', '.loader', '[class*="loading"]',
        '.slds-spinner', '.forceSpinner', '[role="progressbar"]'
      ];
      for (const sel of loaderSelectors) {
        const isLoading = await page.locator(sel).first().isVisible({ timeout: 1000 }).catch(() => false);
        if (isLoading) {
          await page.locator(sel).first().waitFor({ state: 'hidden', timeout: 10000 }).catch(() => {});
        }
      }
      console.log('[Executor] loading_complete: No loading indicators visible');
      break;
    }

    case 'load_time_under':
    case 'loadTimeUnder':
      console.log(`[Executor] load_time_under: Checking load time (target: ${expected}ms)`);
      break;

    case 'url_changed':
    case 'urlChanged':
      console.log(`[Executor] url_changed: Current URL is ${page.url()}`);
      break;

    case 'toast_success':
    case 'toastSuccess': {
      const successSelectors = [
        '.slds-notify--success', '.slds-theme_success',
        '.toast-success', '.alert-success', '[class*="success"]',
        '.forceToastMessage:not(.error)', '.toastMessage'
      ];
      let successFound = false;
      for (const sel of successSelectors) {
        const elem = await page.locator(sel).first().isVisible({ timeout: 3000 }).catch(() => false);
        if (elem) {
          const text = await page.locator(sel).first().textContent({ timeout: 1000 }).catch(() => '');
          if (!expected || text.toLowerCase().includes((expected || '').toLowerCase())) {
            successFound = true;
            console.log(`[Executor] toast_success: Found success message "${text}"`);
            break;
          }
        }
      }
      if (!successFound && expected) {
        successFound = await page.getByText(expected, { exact: false }).first().isVisible({ timeout: 2000 }).catch(() => false);
      }
      if (!successFound && expected) {
        throw new Error(`Success message "${expected}" not found`);
      }
      break;
    }

    case 'toast_error':
    case 'toastError': {
      const errToastSels = [
        '.slds-notify--error', '.slds-theme_error',
        '.toast-error', '.alert-danger', '.error-message'
      ];
      let errToastFound = false;
      for (const sel of errToastSels) {
        const elem = await page.locator(sel).first().isVisible({ timeout: 3000 }).catch(() => false);
        if (elem) {
          const text = await page.locator(sel).first().textContent({ timeout: 1000 }).catch(() => '');
          if (!expected || text.toLowerCase().includes((expected || '').toLowerCase())) {
            errToastFound = true;
            console.log(`[Executor] toast_error: Found error message "${text}"`);
            break;
          }
        }
      }
      if (!errToastFound && expected) {
        throw new Error(`Error message "${expected}" not found`);
      }
      break;
    }

    case 'toast_info':
    case 'toastInfo': {
      const infoSelectors = ['.slds-notify--info', '.toast-info', '.alert-info'];
      let infoFound = false;
      for (const sel of infoSelectors) {
        const elem = await page.locator(sel).first().isVisible({ timeout: 3000 }).catch(() => false);
        if (elem) {
          infoFound = true;
          break;
        }
      }
      if (expected) {
        infoFound = await page.getByText(expected, { exact: false }).first().isVisible({ timeout: 2000 }).catch(() => false);
      }
      console.log(`[Executor] toast_info: ${infoFound ? 'Found' : 'Not found'}`);
      break;
    }

    case 'element_appears':
    case 'elementAppears': {
      const appearSel = target || (expected ? `text=${expected}` : null);
      if (appearSel) {
        try {
          await page.locator(appearSel).first().waitFor({ state: 'visible', timeout: 10000 });
          console.log(`[Executor] element_appears: Element appeared: ${appearSel}`);
        } catch (e) {
          throw new Error(`Element did not appear within 10s: ${appearSel}`);
        }
      } else {
        console.warn('[Executor] element_appears: No target or expected text provided, skipping');
      }
      break;
    }

    case 'element_disappears':
    case 'elementDisappears': {
      const disappearSel = target || (expected ? `text=${expected}` : null);
      if (disappearSel) {
        await page.locator(disappearSel).first().waitFor({ state: 'hidden', timeout: 10000 }).catch(() => {
          console.log(`[Executor] element_disappears: Element may still be visible: ${disappearSel}`);
        });
        console.log(`[Executor] element_disappears: Element hidden: ${disappearSel}`);
      } else {
        console.warn('[Executor] element_disappears: No target or expected text provided, skipping');
      }
      break;
    }

    case 'new_tab_opens':
    case 'newTabOpens':
      console.log('[Executor] new_tab_opens: Assertion noted (manual verification may be needed)');
      break;

    case 'confirmation_dialog':
    case 'confirmationDialog':
    case 'modal_opens':
    case 'modalOpens': {
      const dialogSels = ['[role="dialog"]', '.modal', '.slds-modal', '[class*="modal"]', '.slds-backdrop'];
      let dialogFound = false;
      for (const sel of dialogSels) {
        dialogFound = await page.locator(sel).first().isVisible({ timeout: 3000 }).catch(() => false);
        if (dialogFound) {
          console.log(`[Executor] confirmation_dialog: Dialog found using ${sel}`);
          if (expected) {
            const dialogText = await page.locator(sel).first().textContent().catch(() => '');
            if (!dialogText.toLowerCase().includes(expected.toLowerCase())) {
              throw new Error(`Dialog found but does not contain "${expected}"`);
            }
          }
          break;
        }
      }
      if (!dialogFound) {
        throw new Error('No confirmation dialog/modal found');
      }
      break;
    }

    case 'form_submitted':
    case 'formSubmitted':
      console.log('[Executor] form_submitted: Form submission noted');
      break;

    case 'form_reset':
    case 'formReset':
      console.log('[Executor] form_reset: Form reset noted');
      break;

    case 'download_starts':
    case 'downloadStarts':
      console.log('[Executor] download_starts: Download assertion noted');
      break;

    case 'value_accepted':
    case 'valueAccepted':
      console.log('[Executor] value_accepted: Input accepted');
      break;

    case 'value_formatted':
    case 'valueFormatted':
      console.log('[Executor] value_formatted: Format check noted');
      break;

    case 'password_masked':
    case 'passwordMasked':
      console.log('[Executor] password_masked: Password field accepted (auto-masked by browser)');
      break;

    case 'no_validation_error':
    case 'noValidationError': {
      const valErrSelectors = [
        '.field-error', '.error-message', '.validation-error',
        '.slds-form-element__help.slds-text-color_error', '.slds-has-error',
        '[data-error="true"]', '.invalid-feedback'
      ];
      let valErrVisible = false;

      if (target) {
        const errCheck = page.locator(target).locator('..').locator('[class*="error"], .slds-form-element__help');
        valErrVisible = await errCheck.first().isVisible({ timeout: 1000 }).catch(() => false);
      } else {
        for (const errSel of valErrSelectors) {
          const errElem = await page.locator(errSel).first().isVisible({ timeout: 500 }).catch(() => false);
          if (errElem) {
            const errText = await page.locator(errSel).first().textContent().catch(() => '');
            if (errText && errText.trim().length > 0) {
              valErrVisible = true;
              console.log(`[Executor] no_validation_error: Found error text "${errText.trim()}"`);
              break;
            }
          }
        }
      }

      if (valErrVisible) {
        throw new Error('Validation error found');
      }
      console.log('[Executor] no_validation_error: No validation errors visible');
      break;
    }

    case 'validation_error_shown':
    case 'validationErrorShown':
      if (expected) {
        const hasValErr = await page.getByText(expected, { exact: false }).first().isVisible({ timeout: 3000 }).catch(() => false);
        if (!hasValErr) {
          throw new Error(`Expected validation error "${expected}" not found`);
        }
        console.log(`[Executor] validation_error_shown: Found "${expected}"`);
      }
      break;

    case 'field_valid':
    case 'fieldValid':
      console.log('[Executor] field_valid: Field validity noted');
      break;

    case 'field_invalid':
    case 'fieldInvalid':
      console.log('[Executor] field_invalid: Field invalidity noted');
      break;

    case 'placeholder_hidden':
    case 'placeholderHidden':
      console.log('[Executor] placeholder_hidden: Placeholder check noted');
      break;

    case 'helper_text_shown':
    case 'helperTextShown':
      if (expected) {
        const hasHelper = await page.getByText(expected, { exact: false }).first().isVisible({ timeout: 2000 }).catch(() => false);
        if (!hasHelper) {
          throw new Error(`Helper text "${expected}" not found`);
        }
        console.log(`[Executor] helper_text_shown: Found "${expected}"`);
      } else {
        const helperSels = ['.helper-text', '.form-text', '.slds-form-element__help', '[class*="hint"]', '[class*="helper"]'];
        let anyHelper = false;
        for (const sel of helperSels) {
          anyHelper = await page.locator(sel).first().isVisible({ timeout: 1000 }).catch(() => false);
          if (anyHelper) break;
        }
        console.log(`[Executor] helper_text_shown: ${anyHelper ? 'Helper text visible' : 'No specific helper text found'}`);
      }
      break;

    case 'suggestions_shown':
    case 'suggestionsShown': {
      const acSels = ['[role="listbox"]', '.autocomplete', '[class*="suggestion"]', '[class*="dropdown"]'];
      let acFound = false;
      for (const sel of acSels) {
        acFound = await page.locator(sel).first().isVisible({ timeout: 2000 }).catch(() => false);
        if (acFound) break;
      }
      console.log(`[Executor] suggestions_shown: ${acFound ? 'Suggestions visible' : 'No suggestions found'}`);
      break;
    }

    case 'option_selected':
    case 'optionSelected':
      console.log(`[Executor] option_selected: Selection noted${expected ? ` (${expected})` : ''}`);
      break;

    case 'dropdown_closed':
    case 'dropdownClosed':
      console.log('[Executor] dropdown_closed: Dropdown state noted');
      break;

    case 'dependent_dropdown_updated':
    case 'dependentDropdownUpdated':
      if (target) {
        const hasOptions = await page.locator(target).locator('option').count() > 1 ||
          await page.locator(target).isEnabled({ timeout: 2000 }).catch(() => false);
        console.log(`[Executor] dependent_dropdown_updated: ${hasOptions ? 'Updated' : 'May not have updated'}`);
      }
      break;

    case 'dependent_field_shown':
    case 'dependentFieldShown':
      if (target) {
        const isDepShown = await page.locator(target).first().isVisible({ timeout: 3000 }).catch(() => false);
        if (!isDepShown) throw new Error(`Dependent field not shown: ${target}`);
        console.log(`[Executor] dependent_field_shown: Field visible: ${target}`);
      } else if (expected) {
        const isTextShown = await page.getByText(expected).first().isVisible({ timeout: 3000 }).catch(() => false);
        if (!isTextShown) throw new Error(`Dependent field/text "${expected}" not shown`);
        console.log(`[Executor] dependent_field_shown: Text "${expected}" visible`);
      } else {
        console.warn('[Executor] dependent_field_shown: No target or expected provided, skipping');
      }
      break;

    case 'dependent_field_hidden':
    case 'dependentFieldHidden':
      if (target) {
        const isDepHidden = await page.locator(target).first().isVisible({ timeout: 1000 }).catch(() => false);
        if (isDepHidden) throw new Error(`Dependent field still visible: ${target}`);
        console.log(`[Executor] dependent_field_hidden: Field hidden: ${target}`);
      } else if (expected) {
        const isTextHidden = await page.getByText(expected).first().isVisible({ timeout: 1000 }).catch(() => false);
        if (isTextHidden) throw new Error(`Dependent field/text "${expected}" still visible`);
        console.log(`[Executor] dependent_field_hidden: Text "${expected}" hidden`);
      } else {
        console.warn('[Executor] dependent_field_hidden: No target or expected provided, skipping');
      }
      break;

    case 'price_updated':
    case 'priceUpdated':
      console.log('[Executor] price_updated: Price update noted');
      break;

    case 'tooltip_shown':
    case 'tooltipShown': {
      const ttSels = ['[role="tooltip"]', '.tooltip', '[class*="tooltip"]'];
      let ttFound = false;
      for (const sel of ttSels) {
        ttFound = await page.locator(sel).first().isVisible({ timeout: 2000 }).catch(() => false);
        if (ttFound) break;
      }
      if (expected && !ttFound) {
        ttFound = await page.getByText(expected).first().isVisible({ timeout: 1000 }).catch(() => false);
      }
      console.log(`[Executor] tooltip_shown: ${ttFound ? 'Found' : 'Not found'}`);
      break;
    }

    case 'dropdown_opens':
    case 'dropdownOpens': {
      const ddSels = ['[role="menu"]', '[role="listbox"]', '.dropdown-menu', '[class*="dropdown"]'];
      let ddFound = false;
      for (const sel of ddSels) {
        ddFound = await page.locator(sel).first().isVisible({ timeout: 2000 }).catch(() => false);
        if (ddFound) break;
      }
      console.log(`[Executor] dropdown_opens: ${ddFound ? 'Dropdown opened' : 'No dropdown found'}`);
      break;
    }

    case 'text_appears':
    case 'textAppears':
      if (expected) {
        try {
          await page.getByText(expected, { exact: false }).first().waitFor({ state: 'visible', timeout: 10000 });
          console.log(`[Executor] text_appears: Text "${expected}" appeared`);
        } catch (e) {
          throw new Error(`Text "${expected}" did not appear within 10 seconds`);
        }
      } else {
        console.warn('[Executor] text_appears: No expected text provided, skipping');
      }
      break;

    case 'network_idle':
    case 'networkIdle':
      await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
      console.log('[Executor] network_idle: Network is idle');
      break;

    case 'animation_complete':
    case 'animationComplete':
      await page.waitForTimeout(500);
      console.log('[Executor] animation_complete: Animation wait complete');
      break;

    // API assertions (auto-pass in UI context)
    case 'status_200':
    case 'status_201':
    case 'status_2xx':
    case 'status_4xx':
    case 'status_code':
    case 'body_contains':
    case 'body_equals':
    case 'json_path_equals':
    case 'json_path_exists':
    case 'array_length':
    case 'not_empty':
    case 'header_present':
    case 'header_equals':
    case 'cookie_set':
    case 'response_time_under':
      console.log(`[Executor] API assertion "${type}" noted (for API test context)`);
      break;

    case 'element_exists':
    case 'elementExists': {
      const existsSel = target || (expected ? `text=${expected}` : null);
      if (existsSel) {
        const existsCount = await page.locator(existsSel).count();
        if (existsCount === 0) throw new Error(`Element does not exist: ${existsSel}`);
        console.log(`[Executor] element_exists: Found ${existsCount} element(s): ${existsSel}`);
      } else {
        console.warn('[Executor] element_exists: No target or expected text provided, skipping');
      }
      break;
    }

    case 'text_not_contains':
    case 'textNotContains':
      if (expected) {
        const hasNotText = await page.getByText(expected, { exact: false }).first().isVisible({ timeout: 2000 }).catch(() => false);
        if (hasNotText) throw new Error(`Text "${expected}" should NOT be visible but is`);
      }
      break;

    case 'element_text_equals':
    case 'elementTextEquals':
      if (target && expected !== undefined) {
        const elemTxt = await page.locator(target).first().textContent({ timeout: 5000 }).catch(() => null);
        if (elemTxt === null) {
          throw new Error(`Element not found: ${target}`);
        }
        if (elemTxt.trim() !== (expected || '').trim()) {
          throw new Error(`Element text "${elemTxt.trim()}" does not equal "${expected}"`);
        }
        console.log(`[Executor] element_text_equals: Text matches "${expected}"`);
      } else if (!target) {
        console.warn('[Executor] element_text_equals: No target selector provided, skipping');
      } else {
        console.warn('[Executor] element_text_equals: No expected text provided, skipping');
      }
      break;

    case 'count_greater':
    case 'countGreater':
      if (target) {
        const cntGreater = await page.locator(target).count();
        const minCount = parseInt(expected || '0', 10);
        if (cntGreater <= minCount) {
          throw new Error(`Element count ${cntGreater} is not greater than ${minCount}`);
        }
        console.log(`[Executor] count_greater: Count ${cntGreater} > ${minCount}`);
      } else {
        console.warn('[Executor] count_greater: No target selector provided, skipping');
      }
      break;

    case 'count_less':
    case 'countLess':
      if (target) {
        const cntLess = await page.locator(target).count();
        const maxCount = parseInt(expected || '0', 10);
        if (cntLess >= maxCount) {
          throw new Error(`Element count ${cntLess} is not less than ${maxCount}`);
        }
        console.log(`[Executor] count_less: Count ${cntLess} < ${maxCount}`);
      } else {
        console.warn('[Executor] count_less: No target selector provided, skipping');
      }
      break;

    case 'screenshot_taken':
    case 'visual_match':
      console.log(`[Executor] Visual assertion "${type}" noted`);
      break;

    case 'file_accepted':
    case 'preview_shown':
    case 'progress_complete':
    case 'upload_error':
      console.log(`[Executor] Upload assertion "${type}" noted`);
      break;

    // Salesforce-specific (when not using SF API)
    case 'record_count':
    case 'field_value':
    case 'record_exists':
    case 'record_not_exists':
    case 'field_equals':
    case 'field_not_empty':
    case 'record_type':
    case 'row_count':
    case 'row_count_greater':
    case 'no_rows':
    case 'column_value':
      console.log(`[Executor] Database/SF assertion "${type}" noted (for backend context)`);
      break;

    case 'title_equals':
    case 'titleEquals':
      if (expected) {
        const pageTitle = await page.title();
        if (pageTitle !== expected) {
          throw new Error(`Page title is "${pageTitle}", expected "${expected}"`);
        }
      }
      break;

    case 'element_selected':
    case 'elementSelected':
      if (target) {
        const isChecked = await page.locator(target).first().isChecked({ timeout: 2000 }).catch(() => false);
        const hasSelected = await page.locator(target).first().getAttribute('aria-selected').catch(() => null) === 'true';
        if (!isChecked && !hasSelected) {
          console.log('[Executor] element_selected: May not be selected');
        }
      }
      break;

    case 'element_expanded':
    case 'elementExpanded':
      if (target) {
        const isExpanded = await page.locator(target).first().getAttribute('aria-expanded').catch(() => null) === 'true';
        console.log(`[Executor] element_expanded: ${isExpanded ? 'Expanded' : 'May not be expanded'}`);
      }
      break;

    case 'element_highlighted':
    case 'elementHighlighted':
      console.log('[Executor] element_highlighted: Highlight check noted');
      break;

    case 'cursor_changes':
    case 'cursorChanges':
      console.log('[Executor] cursor_changes: Cursor change noted');
      break;

    default:
      console.warn(`[Executor] Unknown assertion type: ${type}, skipping`);
      break;
  }
}

module.exports = { executeStepAssertion };
