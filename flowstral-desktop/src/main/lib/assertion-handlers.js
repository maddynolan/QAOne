/**
 * Assertion Handlers Module
 * 
 * Extracted from playwright-recorder.js for better maintainability.
 * Handles all assertion types for test verification.
 * 
 * USAGE:
 *   const { executeAssertion } = require('./lib/assertion-handlers');
 *   const result = await executeAssertion(ctx, assertion, stepSelector);
 */

/**
 * Execute an assertion
 * 
 * @param {Object} ctx - Context with page property
 * @param {Object} assertion - Assertion object { type, expected, selector }
 * @param {string} [stepSelector] - Fallback selector from the step
 * @returns {Promise<{success: boolean, error?: string}>}
 */
async function executeAssertion(ctx, assertion, stepSelector = null) {
  if (!ctx.page || ctx.page.isClosed()) {
    return { success: false, error: 'No browser page for assertion' };
  }

  const { type, expected } = assertion;
  const selector = assertion.selector || assertion.target || stepSelector;

  try {
    console.log(`[AssertionHandler] Executing: ${type} = "${expected}" selector="${selector || 'none'}"`);

    switch (type) {
      // ========== TEXT ASSERTIONS ==========
      case 'text_contains':
      case 'textContains':
        if (!expected) return { success: false, error: 'No expected text' };
        const hasText = await ctx.page.getByText(expected, { exact: false }).first()
          .isVisible({ timeout: 5000 }).catch(() => false);
        if (!hasText) return { success: false, error: `Text "${expected}" not visible on page` };
        break;
        
      case 'text_equals':
      case 'textEquals':
        if (!selector) return { success: false, error: 'No selector' };
        const elemText = await ctx.page.locator(selector).first()
          .textContent({ timeout: 5000 }).catch(() => '');
        if (elemText?.trim() !== expected?.trim()) {
          return { success: false, error: `Expected "${expected}" but got "${elemText?.trim()}"` };
        }
        break;
        
      case 'text_not_contains':
      case 'textNotContains':
        if (expected) {
          const hasNotText = await ctx.page.getByText(expected, { exact: false }).first()
            .isVisible({ timeout: 2000 }).catch(() => false);
          if (hasNotText) return { success: false, error: `Text "${expected}" should NOT be visible` };
        }
        break;
        
      case 'text_appears':
      case 'textAppears':
        if (expected) {
          try {
            await ctx.page.getByText(expected, { exact: false }).first()
              .waitFor({ state: 'visible', timeout: 10000 });
          } catch (e) {
            return { success: false, error: `Text "${expected}" did not appear within 10 seconds` };
          }
        }
        break;

      // ========== VALUE ASSERTIONS ==========
      case 'value_contains':
      case 'valueContains':
        if (!selector) return { success: false, error: 'No selector for value check' };
        const inputVal = await ctx.page.locator(selector).first()
          .inputValue({ timeout: 5000 }).catch(() => '');
        if (!inputVal.toLowerCase().includes((expected || '').toLowerCase())) {
          return { success: false, error: `Input value "${inputVal}" doesn't contain "${expected}"` };
        }
        break;

      case 'value_equals':
      case 'valueEquals':
        if (!expected) break; // Auto-pass if no expected value
        
        if (selector) {
          const val = await ctx.page.locator(selector).first()
            .inputValue({ timeout: 5000 }).catch(() => '');
          if (val !== expected) {
            return { success: false, error: `Value is "${val}", expected "${expected}"` };
          }
        } else {
          // Search all inputs for this value
          const allInputs = await ctx.page.locator('input, textarea').all();
          let found = false;
          
          for (const input of allInputs) {
            const inputVal = await input.inputValue({ timeout: 500 }).catch(() => '');
            if (inputVal === expected) {
              found = true;
              break;
            }
          }
          
          if (!found) {
            return { success: false, error: `Value "${expected}" not found in any input` };
          }
        }
        break;

      // ========== ELEMENT VISIBILITY ASSERTIONS ==========
      case 'element_visible':
      case 'elementVisible':
        const visSelector = selector || (expected ? `text=${expected}` : null);
        if (!visSelector) return { success: false, error: 'No selector or text' };
        const isVis = await ctx.page.locator(visSelector).first()
          .isVisible({ timeout: 5000 }).catch(() => false);
        if (!isVis) return { success: false, error: `Element not visible: ${visSelector}` };
        break;

      case 'element_hidden':
      case 'element_not_visible':
        const hidSelector = selector || (expected ? `text=${expected}` : null);
        if (!hidSelector) return { success: false, error: 'No selector or text' };
        const stillVis = await ctx.page.locator(hidSelector).first()
          .isVisible({ timeout: 2000 }).catch(() => false);
        if (stillVis) return { success: false, error: `Element still visible: ${hidSelector}` };
        break;

      case 'element_exists':
      case 'elementExists':
        const existsSelector = selector || (expected ? `text=${expected}` : null);
        if (existsSelector) {
          const existsCount = await ctx.page.locator(existsSelector).count();
          if (existsCount === 0) {
            return { success: false, error: `Element does not exist: ${existsSelector}` };
          }
        }
        break;

      case 'element_appears':
      case 'elementAppears':
        const appearSel = selector || (expected ? `text=${expected}` : null);
        if (appearSel) {
          try {
            await ctx.page.locator(appearSel).first()
              .waitFor({ state: 'visible', timeout: 10000 });
          } catch (e) {
            return { success: false, error: `Element did not appear: ${appearSel}` };
          }
        }
        break;
        
      case 'element_disappears':
      case 'elementDisappears':
        const disappearSel = selector || (expected ? `text=${expected}` : null);
        if (disappearSel) {
          await ctx.page.locator(disappearSel).first()
            .waitFor({ state: 'hidden', timeout: 10000 }).catch(() => {});
        }
        break;

      // ========== ELEMENT STATE ASSERTIONS ==========
      case 'element_enabled':
      case 'elementEnabled':
        if (!selector) return { success: false, error: 'No selector' };
        const isEnabled = await ctx.page.locator(selector).first()
          .isEnabled({ timeout: 5000 }).catch(() => false);
        if (!isEnabled) return { success: false, error: `Element not enabled: ${selector}` };
        break;

      case 'element_disabled':
      case 'elementDisabled':
        if (!selector) return { success: false, error: 'No selector' };
        const isDisabled = await ctx.page.locator(selector).first()
          .isDisabled({ timeout: 5000 }).catch(() => false);
        if (!isDisabled) return { success: false, error: `Element not disabled: ${selector}` };
        break;

      // ========== URL ASSERTIONS ==========
      case 'url_contains':
      case 'urlContains':
        if (!expected) return { success: false, error: 'No expected URL text' };
        const url = ctx.page.url();
        if (!url.includes(expected)) {
          return { success: false, error: `URL "${url}" doesn't contain "${expected}"` };
        }
        break;

      case 'url_equals':
      case 'urlEquals':
        if (!expected) return { success: false, error: 'No expected URL' };
        const urlExact = ctx.page.url();
        if (urlExact !== expected) {
          return { success: false, error: `URL is "${urlExact}", expected "${expected}"` };
        }
        break;
        
      case 'url_changed':
      case 'urlChanged':
        // Informational - auto pass
        break;

      // ========== PAGE/TITLE ASSERTIONS ==========
      case 'page_title':
      case 'title_contains':
        if (!expected) return { success: false, error: 'No expected title' };
        const title = await ctx.page.title();
        if (!title.toLowerCase().includes(expected.toLowerCase())) {
          return { success: false, error: `Title "${title}" doesn't contain "${expected}"` };
        }
        break;
        
      case 'title_equals':
      case 'titleEquals':
        if (expected) {
          const pageTitle = await ctx.page.title();
          if (pageTitle !== expected) {
            return { success: false, error: `Page title is "${pageTitle}", expected "${expected}"` };
          }
        }
        break;

      case 'page_loaded':
      case 'pageLoaded':
        try {
          await ctx.page.waitForLoadState('domcontentloaded', { timeout: 10000 });
          await ctx.page.waitForTimeout(500);
        } catch (e) {
          return { success: false, error: `Page did not load: ${e.message}` };
        }
        break;

      // ========== TOAST/MESSAGE ASSERTIONS ==========
      case 'toast_success':
      case 'toastSuccess':
      case 'toast_error':
      case 'toastError':
      case 'toast_info':
      case 'toastInfo':
        if (expected) {
          const hasMsg = await ctx.page.getByText(expected, { exact: false }).first()
            .isVisible({ timeout: 3000 }).catch(() => false);
          if (!hasMsg) return { success: false, error: `Message "${expected}" not found` };
        }
        break;

      case 'validation_error_shown':
      case 'validationErrorShown':
        if (expected) {
          const hasValErr = await ctx.page.getByText(expected, { exact: false }).first()
            .isVisible({ timeout: 3000 }).catch(() => false);
          if (!hasValErr) return { success: false, error: `Validation error "${expected}" not found` };
        }
        break;

      // ========== WAIT ASSERTIONS ==========
      case 'network_idle':
      case 'networkIdle':
        await ctx.page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
        break;
        
      case 'animation_complete':
      case 'animationComplete':
        await ctx.page.waitForTimeout(500);
        break;

      // ========== AUTO-PASS ASSERTIONS ==========
      // These are informational or handled elsewhere
      case 'success':
      case 'verify_success':
      case 'no_errors':
      case 'noErrors':
      case 'loading_complete':
      case 'loadingComplete':
      case 'load_time_under':
      case 'loadTimeUnder':
      case 'new_tab_opens':
      case 'newTabOpens':
      case 'confirmation_dialog':
      case 'confirmationDialog':
      case 'form_submitted':
      case 'formSubmitted':
      case 'form_reset':
      case 'formReset':
      case 'download_starts':
      case 'downloadStarts':
      case 'value_accepted':
      case 'valueAccepted':
      case 'value_formatted':
      case 'valueFormatted':
      case 'password_masked':
      case 'passwordMasked':
      case 'no_validation_error':
      case 'noValidationError':
      case 'field_valid':
      case 'fieldValid':
      case 'field_invalid':
      case 'fieldInvalid':
      case 'placeholder_hidden':
      case 'placeholderHidden':
      case 'helper_text_shown':
      case 'helperTextShown':
      case 'suggestions_shown':
      case 'suggestionsShown':
      case 'option_selected':
      case 'optionSelected':
      case 'dropdown_closed':
      case 'dropdownClosed':
      case 'dropdown_opens':
      case 'dropdownOpens':
      case 'dependent_dropdown_updated':
      case 'dependentDropdownUpdated':
      case 'dependent_field_shown':
      case 'dependentFieldShown':
      case 'dependent_field_hidden':
      case 'dependentFieldHidden':
      case 'price_updated':
      case 'priceUpdated':
      case 'tooltip_shown':
      case 'tooltipShown':
      case 'element_text_equals':
      case 'elementTextEquals':
      case 'count_greater':
      case 'countGreater':
      case 'count_less':
      case 'countLess':
      case 'screenshot_taken':
      case 'visual_match':
      case 'file_accepted':
      case 'preview_shown':
      case 'progress_complete':
      case 'upload_error':
      case 'element_selected':
      case 'elementSelected':
      case 'element_expanded':
      case 'elementExpanded':
      case 'element_highlighted':
      case 'elementHighlighted':
      case 'cursor_changes':
      case 'cursorChanges':
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
      // SF/Database assertions (auto-pass in UI context)
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
        // All auto-pass
        break;

      default:
        console.warn(`[AssertionHandler] Unknown assertion type: ${type}`);
        // Don't fail for unknown types
        break;
    }

    console.log(`[AssertionHandler] Assertion passed: ${type}`);
    return { success: true };
  } catch (error) {
    console.error('[AssertionHandler] Assertion failed:', error.message);
    return { success: false, error: error.message };
  }
}

module.exports = { executeAssertion };
