/**
 * Assertion Helper Functions
 *
 * Extracted from UnifiedWorkflowEditor.tsx.
 * Pure functions for generating assertion descriptions, expected results,
 * and step-type-specific assertion definitions.
 */

import type { StepAssertion, StepType } from '../types/workflow-editor.types';

// ============================================================================
// ASSERTION DESCRIPTION HELPERS
// ============================================================================

/**
 * Generate assertion description text from a single assertion
 */
export function getAssertionDescription(assertion: StepAssertion, stepSelector?: string): string {
  const target = assertion.target || stepSelector || 'element';
  const expected = assertion.expected || '';

  switch (assertion.type) {
    case 'element_visible': return `Element "${target}" should be visible`;
    case 'element_hidden': return `Element "${target}" should be hidden`;
    case 'element_enabled': return `Element "${target}" should be enabled`;
    case 'element_disabled': return `Element "${target}" should be disabled`;
    case 'text_contains': return `Page should contain text "${expected}"`;
    case 'text_equals': return `Element text should equal "${expected}"`;
    case 'value_contains': return `Input value should contain "${expected}"`;
    case 'value_equals': return `Input value should be "${expected}"`;
    case 'url_contains': return `URL should contain "${expected}"`;
    case 'url_equals': return `URL should be "${expected}"`;
    case 'title_contains': return `Page title should contain "${expected}"`;
    case 'count_equals': return `Element count should be ${expected}`;
    case 'toast_message': return `Toast message "${expected}" should appear`;
    case 'attribute_equals': return `Attribute should equal "${expected}"`;
    case 'page_title': return `Page title should be "${expected}"`;
    default: return expected || 'Verification should pass';
  }
}

/**
 * Generate expected result text from multiple assertions
 */
export function generateExpectedResultFromAssertions(assertions: StepAssertion[], stepSelector?: string): string {
  if (!assertions || assertions.length === 0) return '';

  const descriptions = assertions
    .filter(a => a.enabled)
    .map(a => getAssertionDescription(a, stepSelector));

  if (descriptions.length === 0) return '';
  if (descriptions.length === 1) return descriptions[0];
  return descriptions.map((d, i) => `${i + 1}. ${d}`).join('\n');
}

// ============================================================================
// ASSERTION BUILDER HELPERS
// ============================================================================

export function getAssertionSuggestions(stepType: StepType, assertionType: string) {
  const suggestions: Record<string, { expectedResult: string }> = {
    element_visible: { expectedResult: 'Element should be visible on the page' },
    element_hidden: { expectedResult: 'Element should not be visible' },
    text_contains: { expectedResult: 'Text should contain the expected value' },
    text_equals: { expectedResult: 'Text should match exactly' },
    url_contains: { expectedResult: 'URL should contain the expected path' },
    url_equals: { expectedResult: 'URL should match exactly' },
    value_equals: { expectedResult: 'Input value should match' },
    element_enabled: { expectedResult: 'Element should be enabled and interactive' },
    element_disabled: { expectedResult: 'Element should be disabled' },
    count_equals: { expectedResult: 'Number of matching elements should equal expected count' },
    page_title: { expectedResult: 'Page title should match' },
    toast_message: { expectedResult: 'Toast/notification should appear with message' },
  };
  return suggestions[assertionType] || { expectedResult: '' };
}

export function generateExpectedResultText(assertionType: string, value: string, target?: string): string {
  const targetText = target ? ` for "${target}"` : '';
  const valueText = value ? `"${value}"` : '';

  // Comprehensive mapping of all assertion types to expected result descriptions
  const assertionDescriptions: Record<string, string> = {
    // Navigate assertions
    'page_loaded': 'Page should load successfully without errors',
    'url_equals': `URL should be ${valueText}`,
    'url_contains': `URL should contain ${valueText}`,
    'title_equals': `Page title should be ${valueText}`,
    'title_contains': `Page title should contain ${valueText}`,
    'no_errors': 'No error messages should be displayed',
    'loading_complete': 'Loading indicators should disappear',
    'load_time_under': `Page should load within ${valueText}`,

    // Click assertions
    'element_visible': `Element${targetText} should be visible`,
    'element_hidden': `Element${targetText} should be hidden`,
    'element_selected': `Element${targetText} should be selected`,
    'element_expanded': `Section${targetText} should expand`,
    'url_changed': 'Browser URL should change',
    'new_tab_opens': 'Link should open in new tab',
    'toast_success': `Success message should appear: ${valueText}`,
    'toast_error': `Error message should appear: ${valueText}`,
    'toast_info': `Info message should appear: ${valueText}`,
    'toast_message': `Should see message: ${valueText}`,
    'confirmation_dialog': 'Confirmation dialog should appear',
    'form_submitted': 'Form should submit successfully',
    'form_reset': 'Form should reset all fields',
    'download_starts': 'File download should begin',

    // Input assertions
    'value_accepted': 'Field should accept the input value',
    'value_equals': `Input value should be ${valueText}${targetText}`,
    'value_contains': `Input should contain ${valueText}${targetText}`,
    'value_formatted': 'Input should be auto-formatted correctly',
    'character_count': 'Character counter should be displayed',
    'no_validation_error': 'No validation errors should appear',
    'validation_error_shown': `Validation error should show: ${valueText}`,
    'field_valid': `Field${targetText} should be marked as valid`,
    'field_invalid': `Field${targetText} should be marked as invalid`,
    'placeholder_hidden': 'Placeholder text should disappear',
    'helper_text_shown': 'Helper text should be displayed',
    'password_masked': 'Password should be masked',
    'dependent_field_enabled': `Related field${targetText} should become enabled`,
    'suggestions_shown': 'Autocomplete suggestions should appear',
    'live_search_results': 'Search results should update',

    // Select assertions
    'option_selected': `Option ${valueText} should be selected`,
    'dropdown_closed': 'Dropdown should close after selection',
    'selected_text_shown': 'Selected option text should be displayed',
    'dependent_dropdown_updated': `Related dropdown${targetText} options should update`,
    'dependent_field_shown': `Related field${targetText} should appear`,
    'dependent_field_hidden': `Related field${targetText} should disappear`,
    'form_section_enabled': 'Form section should become enabled',
    'price_updated': `Price${targetText} should recalculate`,
    'quantity_updated': 'Quantity should adjust',

    // Hover assertions
    'tooltip_shown': `Tooltip should appear: ${valueText}`,
    'dropdown_opens': 'Dropdown menu should open',
    'preview_shown': 'Preview should appear',
    'cursor_changes': 'Cursor style should change',
    'element_highlighted': `Element${targetText} should be highlighted`,

    // Wait assertions
    'element_appears': `Element${targetText} should appear`,
    'element_disappears': `Element${targetText} should disappear`,
    'text_appears': `Text ${valueText} should appear`,
    'network_idle': 'All network requests should complete',
    'animation_complete': 'Animation should finish',

    // API assertions
    'status_200': 'API should return 200 OK',
    'status_201': 'API should return 201 Created',
    'status_code': `API should return status code ${valueText}`,
    'status_2xx': 'API should return success status (2xx)',
    'status_4xx': 'API should return client error (4xx)',
    'body_contains': `Response body should contain ${valueText}`,
    'body_equals': `Response body should equal ${valueText}`,
    'json_path_equals': `JSON path should equal ${valueText}`,
    'json_path_exists': `JSON path ${valueText} should exist`,
    'array_length': `Array length should be ${valueText}`,
    'not_empty': 'Response should not be empty',
    'header_present': `Response should have header ${valueText}`,
    'header_equals': `Header should have value ${valueText}`,
    'cookie_set': `Cookie ${valueText} should be set`,
    'response_time_under': `Response time should be under ${valueText}`,

    // Assert assertions
    'element_exists': `Element${targetText} should exist in DOM`,
    'text_contains': `Page should contain text ${valueText}`,
    'text_not_contains': `Page should NOT contain text ${valueText}`,
    'element_text_equals': `Element${targetText} text should be ${valueText}`,
    'count_equals': `Should find exactly ${value} elements${targetText}`,
    'count_greater': `Should find more than ${value} elements${targetText}`,
    'count_less': `Should find fewer than ${value} elements${targetText}`,

    // Database assertions
    'row_count': `Query should return ${value} rows`,
    'row_count_greater': 'Query should return at least one row',
    'no_rows': 'Query should return no rows',
    'column_value': `Column value should be ${valueText}`,

    // Screenshot assertions
    'screenshot_taken': 'Screenshot should be saved',
    'visual_match': 'Screenshot should match baseline',

    // Upload assertions
    'file_accepted': 'File should be accepted',
    'upload_preview_shown': 'File preview should be displayed',
    'progress_complete': 'Upload progress should reach 100%',
    'upload_error': `Upload error should show: ${valueText}`,

    // Salesforce assertions
    'record_count': `Query should return ${value} records`,
    'field_value': `Field should have value ${valueText}`,
    'record_exists': 'Record should exist',
    'record_not_exists': 'Record should not exist',
    'field_equals': `Field should equal ${valueText}`,
    'field_not_empty': 'Field should have a value',
    'record_type': `Record type should be ${valueText}`,

    // Legacy/generic
    'text_equals': `Text should equal ${valueText}${targetText}`,
    'element_enabled': `Element${targetText} should be enabled`,
    'element_disabled': `Element${targetText} should be disabled`,
    'page_title': `Page title should be ${valueText}`,
    'attribute_equals': `Attribute should equal ${valueText}`,
  };

  return assertionDescriptions[assertionType] || value || 'Verify expected result';
}

// ============================================================================
// COMPREHENSIVE STEP-TYPE SPECIFIC ASSERTIONS
// ============================================================================

/**
 * Context-aware assertion definitions for each step type
 * Provides meaningful expected results that testers actually need
 */
export const STEP_TYPE_ASSERTIONS: Record<string, {
  category: string;
  assertions: Array<{
    type: string;
    label: string;
    description: string;
    placeholder?: string;
    needsValue?: boolean;
    needsTarget?: boolean;
    icon?: string;
  }>;
}[]> = {
  // NAVIGATE - Page load expectations
  navigate: [
    {
      category: 'Page Load',
      assertions: [
        { type: 'page_loaded', label: 'Page loads successfully', description: 'Page should load without errors', icon: 'check' },
        { type: 'url_equals', label: 'URL is correct', description: 'Browser URL matches expected', needsValue: true, placeholder: '/dashboard', icon: 'link' },
        { type: 'url_contains', label: 'URL contains', description: 'URL contains expected path', needsValue: true, placeholder: '/products', icon: 'link' },
        { type: 'title_equals', label: 'Page title is', description: 'Document title matches', needsValue: true, placeholder: 'Home Page', icon: 'doc' },
        { type: 'title_contains', label: 'Page title contains', description: 'Title contains text', needsValue: true, placeholder: 'Dashboard', icon: 'doc' },
      ]
    },
    {
      category: 'Visual',
      assertions: [
        { type: 'element_visible', label: 'Key element visible', description: 'Main content is visible', needsTarget: true, placeholder: 'header, .main-content', icon: 'check' },
        { type: 'no_errors', label: 'No error messages', description: 'No error banners or alerts', icon: 'warning' },
        { type: 'loading_complete', label: 'Loading finished', description: 'Spinners/loaders gone', icon: 'timer' },
      ]
    },
    {
      category: 'Performance',
      assertions: [
        { type: 'load_time_under', label: 'Load time under', description: 'Page loads within time', needsValue: true, placeholder: '3000ms', icon: 'bolt' },
      ]
    }
  ],

  // CLICK - Action result expectations
  click: [
    {
      category: 'Immediate Effect',
      assertions: [
        { type: 'element_visible', label: 'Element appears', description: 'New content becomes visible', needsTarget: true, placeholder: '.modal, .dropdown', icon: 'check' },
        { type: 'element_hidden', label: 'Element disappears', description: 'Content is hidden/removed', needsTarget: true, placeholder: '.loading', icon: 'x' },
        { type: 'element_selected', label: 'Item selected', description: 'Element shows selected state', icon: 'checkbox' },
        { type: 'element_expanded', label: 'Section expands', description: 'Collapsible section opens', icon: 'expand' },
      ]
    },
    {
      category: 'Navigation',
      assertions: [
        { type: 'url_changed', label: 'Page navigates', description: 'Browser URL changes', icon: 'link' },
        { type: 'url_contains', label: 'Navigates to', description: 'New URL contains', needsValue: true, placeholder: '/success', icon: 'link' },
        { type: 'new_tab_opens', label: 'Opens new tab', description: 'Link opens in new tab', icon: 'external' },
      ]
    },
    {
      category: 'Feedback',
      assertions: [
        { type: 'toast_success', label: 'Success message', description: 'Green success toast/alert', needsValue: true, placeholder: 'Saved successfully', icon: 'check' },
        { type: 'toast_error', label: 'Error message', description: 'Error notification appears', needsValue: true, placeholder: 'Please try again', icon: 'x' },
        { type: 'toast_info', label: 'Info message', description: 'Information toast appears', needsValue: true, placeholder: 'Processing...', icon: 'info' },
        { type: 'confirmation_dialog', label: 'Confirmation appears', description: 'Confirm/cancel dialog shows', icon: 'question' },
      ]
    },
    {
      category: 'Form Actions',
      assertions: [
        { type: 'form_submitted', label: 'Form submits', description: 'Form data sent successfully', icon: 'upload' },
        { type: 'form_reset', label: 'Form resets', description: 'All fields cleared', icon: 'refresh' },
        { type: 'download_starts', label: 'Download starts', description: 'File download begins', icon: 'download' },
      ]
    }
  ],

  // INPUT - Field validation expectations
  input: [
    {
      category: 'Value Acceptance',
      assertions: [
        { type: 'value_accepted', label: 'Value entered', description: 'Field accepts the input', icon: 'check' },
        { type: 'value_equals', label: 'Value is', description: 'Field value matches', needsValue: true, icon: '=' },
        { type: 'value_formatted', label: 'Value formatted', description: 'Input auto-formatted (phone, card)', icon: 'sparkle' },
        { type: 'character_count', label: 'Character count', description: 'Shows character counter', icon: '#' },
      ]
    },
    {
      category: 'Validation',
      assertions: [
        { type: 'no_validation_error', label: 'No validation errors', description: 'Field passes validation', icon: 'check' },
        { type: 'validation_error_shown', label: 'Validation error shows', description: 'Error message displayed', needsValue: true, placeholder: 'Required field', icon: 'warning' },
        { type: 'field_valid', label: 'Field marked valid', description: 'Green checkmark/border', icon: 'check' },
        { type: 'field_invalid', label: 'Field marked invalid', description: 'Red border/highlight', icon: 'x' },
      ]
    },
    {
      category: 'Visual Feedback',
      assertions: [
        { type: 'placeholder_hidden', label: 'Placeholder hidden', description: 'Placeholder disappears on input', icon: 'ghost' },
        { type: 'helper_text_shown', label: 'Helper text shown', description: 'Help text appears below', icon: 'info' },
        { type: 'password_masked', label: 'Password masked', description: 'Characters shown as dots', icon: 'lock' },
      ]
    },
    {
      category: 'Related Updates',
      assertions: [
        { type: 'dependent_field_enabled', label: 'Related field enabled', description: 'Another field becomes active', needsTarget: true, icon: 'unlock' },
        { type: 'suggestions_shown', label: 'Suggestions appear', description: 'Autocomplete dropdown shows', icon: 'list' },
        { type: 'live_search_results', label: 'Search results update', description: 'Results refresh as you type', icon: 'search' },
      ]
    }
  ],

  // SELECT - Dropdown expectations
  select: [
    {
      category: 'Selection',
      assertions: [
        { type: 'option_selected', label: 'Option selected', description: 'Selected value is set', needsValue: true, icon: 'check' },
        { type: 'dropdown_closed', label: 'Dropdown closes', description: 'Menu closes after selection', icon: 'up' },
        { type: 'selected_text_shown', label: 'Selection displayed', description: 'Shows selected option text', icon: 'text' },
      ]
    },
    {
      category: 'Cascading Changes',
      assertions: [
        { type: 'dependent_dropdown_updated', label: 'Related dropdown updates', description: 'Child dropdown options change', needsTarget: true, placeholder: '#city-select', icon: 'link' },
        { type: 'dependent_field_shown', label: 'Related field appears', description: 'Conditional field becomes visible', needsTarget: true, icon: 'eye' },
        { type: 'dependent_field_hidden', label: 'Related field hidden', description: 'Conditional field disappears', needsTarget: true, icon: 'ghost' },
        { type: 'form_section_enabled', label: 'Form section enabled', description: 'Part of form becomes active', icon: 'unlock' },
      ]
    },
    {
      category: 'Calculations',
      assertions: [
        { type: 'price_updated', label: 'Price recalculates', description: 'Price/total changes', needsTarget: true, placeholder: '.total-price', icon: 'dollar' },
        { type: 'quantity_updated', label: 'Quantity adjusts', description: 'Count/quantity changes', icon: 'hash' },
      ]
    }
  ],

  // HOVER - Hover state expectations
  hover: [
    {
      category: 'Hover Effects',
      assertions: [
        { type: 'tooltip_shown', label: 'Tooltip appears', description: 'Hover tooltip is displayed', needsValue: true, placeholder: 'Help text...', icon: 'chat' },
        { type: 'dropdown_opens', label: 'Menu opens', description: 'Dropdown menu appears', icon: 'down' },
        { type: 'preview_shown', label: 'Preview appears', description: 'Image/content preview shows', icon: 'image' },
        { type: 'cursor_changes', label: 'Cursor changes', description: 'Mouse cursor changes style', icon: 'pointer' },
        { type: 'element_highlighted', label: 'Element highlighted', description: 'Visual highlight effect', icon: 'sparkle' },
      ]
    }
  ],

  // WAIT - Synchronization expectations
  wait: [
    {
      category: 'Wait Completion',
      assertions: [
        { type: 'element_appears', label: 'Element appears', description: 'Target element becomes visible', needsTarget: true, icon: 'check' },
        { type: 'element_disappears', label: 'Element disappears', description: 'Loading indicator gone', needsTarget: true, icon: 'x' },
        { type: 'text_appears', label: 'Text appears', description: 'Expected text visible', needsValue: true, icon: 'text' },
        { type: 'network_idle', label: 'Network idle', description: 'All API calls complete', icon: 'wifi' },
        { type: 'animation_complete', label: 'Animation done', description: 'CSS animation finished', icon: 'film' },
      ]
    }
  ],

  // API - API response expectations
  api: [
    {
      category: 'Response Status',
      assertions: [
        { type: 'status_200', label: 'Success (200)', description: 'Returns 200 OK', icon: 'check' },
        { type: 'status_201', label: 'Created (201)', description: 'Returns 201 Created', icon: 'check' },
        { type: 'status_code', label: 'Status code is', description: 'Returns specific status', needsValue: true, placeholder: '200', icon: 'hash' },
        { type: 'status_2xx', label: 'Success (2xx)', description: 'Any success status', icon: 'check' },
        { type: 'status_4xx', label: 'Client error (4xx)', description: 'Returns 4xx error', icon: 'warning' },
      ]
    },
    {
      category: 'Response Body',
      assertions: [
        { type: 'body_contains', label: 'Body contains', description: 'Response includes text', needsValue: true, placeholder: '"success": true', icon: 'text' },
        { type: 'body_equals', label: 'Body equals', description: 'Exact response match', needsValue: true, icon: '=' },
        { type: 'json_path_equals', label: 'JSON path value', description: 'Specific field equals', needsValue: true, placeholder: '$.data.id = 123', icon: 'target' },
        { type: 'json_path_exists', label: 'JSON path exists', description: 'Field exists in response', needsValue: true, placeholder: '$.data.items', icon: 'question' },
        { type: 'array_length', label: 'Array has items', description: 'Array length matches', needsValue: true, placeholder: '$.items.length = 10', icon: 'chart' },
        { type: 'not_empty', label: 'Response not empty', description: 'Body is not empty', icon: 'box' },
        { type: 'json_schema', label: 'Validates schema', description: 'Response matches JSON Schema', needsValue: true, placeholder: '{"type":"object","properties":{}}', icon: 'list' },
        { type: 'response_type', label: 'Response type is', description: 'Content-Type matches', needsValue: true, placeholder: 'application/json', icon: 'doc' },
      ]
    },
    {
      category: 'Headers',
      assertions: [
        { type: 'header_present', label: 'Header exists', description: 'Response has header', needsValue: true, placeholder: 'Content-Type', icon: 'list' },
        { type: 'header_equals', label: 'Header value is', description: 'Header has value', needsValue: true, placeholder: 'Content-Type: application/json', icon: '=' },
        { type: 'cookie_set', label: 'Cookie is set', description: 'Response sets cookie', needsValue: true, placeholder: 'session_id', icon: 'cookie' },
      ]
    },
    {
      category: 'Performance',
      assertions: [
        { type: 'response_time_under', label: 'Response time under', description: 'Responds within ms', needsValue: true, placeholder: '500ms', icon: 'bolt' },
      ]
    }
  ],

  // ASSERT / VERIFY
  assert: [
    {
      category: 'Visibility',
      assertions: [
        { type: 'element_visible', label: 'Element visible', description: 'Element is displayed', needsTarget: true, icon: 'check' },
        { type: 'element_hidden', label: 'Element hidden', description: 'Element not visible', needsTarget: true, icon: 'x' },
        { type: 'element_exists', label: 'Element exists', description: 'Element in DOM', needsTarget: true, icon: 'doc' },
      ]
    },
    {
      category: 'Content',
      assertions: [
        { type: 'text_contains', label: 'Page contains text', description: 'Text visible on page', needsValue: true, icon: 'text' },
        { type: 'text_not_contains', label: 'Page NOT contains', description: 'Text NOT on page', needsValue: true, icon: 'no' },
        { type: 'element_text_equals', label: 'Element text is', description: 'Element has exact text', needsValue: true, needsTarget: true, icon: '=' },
      ]
    },
    {
      category: 'Counts',
      assertions: [
        { type: 'count_equals', label: 'Element count is', description: 'Number of elements', needsValue: true, needsTarget: true, placeholder: '5', icon: '#' },
        { type: 'count_greater', label: 'Count greater than', description: 'More than N elements', needsValue: true, needsTarget: true, icon: '>' },
        { type: 'count_less', label: 'Count less than', description: 'Fewer than N elements', needsValue: true, needsTarget: true, icon: '<' },
      ]
    }
  ],

  // DATABASE
  db_query: [
    {
      category: 'Query Results',
      assertions: [
        { type: 'row_count', label: 'Row count is', description: 'Query returns N rows', needsValue: true, placeholder: '1', icon: '#' },
        { type: 'row_count_greater', label: 'Has rows', description: 'Query returns rows', icon: 'check' },
        { type: 'no_rows', label: 'No rows returned', description: 'Query returns empty', icon: 'empty' },
        { type: 'column_value', label: 'Column value is', description: 'Field has value', needsValue: true, placeholder: 'status = active', icon: '=' },
      ]
    }
  ],

  // SCREENSHOT
  screenshot: [
    {
      category: 'Screenshot',
      assertions: [
        { type: 'screenshot_taken', label: 'Screenshot saved', description: 'Image file created', icon: 'check' },
        { type: 'visual_match', label: 'Matches baseline', description: 'No visual differences', icon: 'target' },
      ]
    }
  ],

  // UPLOAD
  upload: [
    {
      category: 'Upload',
      assertions: [
        { type: 'file_accepted', label: 'File accepted', description: 'Upload succeeds', icon: 'check' },
        { type: 'preview_shown', label: 'Preview displayed', description: 'File preview appears', icon: 'image' },
        { type: 'progress_complete', label: 'Upload complete', description: 'Progress reaches 100%', icon: 'check' },
        { type: 'upload_error', label: 'Error shown', description: 'Upload error displayed', needsValue: true, placeholder: 'File too large', icon: 'warning' },
      ]
    }
  ],

  // SALESFORCE specific
  sf_query: [
    {
      category: 'SOQL Results',
      assertions: [
        { type: 'record_count', label: 'Record count is', description: 'Query returns N records', needsValue: true, icon: '#' },
        { type: 'field_value', label: 'Field value is', description: 'Record field equals', needsValue: true, placeholder: 'Status = Active', icon: '=' },
        { type: 'record_exists', label: 'Record exists', description: 'At least one record', icon: 'check' },
        { type: 'record_not_exists', label: 'Record not exists', description: 'No matching records', icon: 'x' },
      ]
    }
  ],

  sf_assert: [
    {
      category: 'Salesforce',
      assertions: [
        { type: 'field_equals', label: 'Field equals', description: 'Record field matches', needsValue: true, icon: '=' },
        { type: 'field_not_empty', label: 'Field has value', description: 'Field is populated', icon: 'check' },
        { type: 'record_type', label: 'Record type is', description: 'Matches record type', needsValue: true, icon: 'tag' },
      ]
    }
  ],
};

/**
 * Get assertion categories and options for a specific step type
 */
export function getAssertionsForStepType(stepType: StepType): typeof STEP_TYPE_ASSERTIONS[string] {
  // Return step-specific assertions, or generic ones for unknown types
  return STEP_TYPE_ASSERTIONS[stepType] || STEP_TYPE_ASSERTIONS['assert'] || [];
}

/**
 * Check if step type should show the generic assertion builder
 * (Complex verify steps have their own specialized UI)
 */
export function shouldShowGenericAssertions(stepType: StepType): boolean {
  // Steps with their own specialized verification UI
  const typesWithSpecializedUI = ['email_verify', 'pdf_verify', 'file_verify'];
  // Documentation/utility steps that don't need assertions
  const utilitySteps = ['note', 'checkpoint', 'module'];
  return !typesWithSpecializedUI.includes(stepType) && !utilitySteps.includes(stepType);
}

export function getQuickSuggestions(stepType: StepType): Array<{ label: string; type: string; expected?: string; text: string }> {
  // Get the first few most common assertions for this step type
  const stepAssertions = STEP_TYPE_ASSERTIONS[stepType];
  if (!stepAssertions || stepAssertions.length === 0) {
    // Fallback to generic suggestions
    return [
      { label: 'Element visible', type: 'element_visible', text: 'Element should be visible' },
      { label: 'Text contains', type: 'text_contains', text: 'Page contains expected text' },
    ];
  }

  // Collect first 2 assertions from each category
  const suggestions: Array<{ label: string; type: string; expected?: string; text: string }> = [];
  for (const category of stepAssertions) {
    for (const assertion of category.assertions.slice(0, 2)) {
      suggestions.push({
        label: assertion.label,
        type: assertion.type,
        expected: assertion.placeholder || '',
        text: assertion.description,
      });
      if (suggestions.length >= 6) break;
    }
    if (suggestions.length >= 6) break;
  }

  return suggestions;
}

// Legacy function for backwards compatibility
export function getQuickSuggestionsLegacy(stepType: StepType): Array<{ label: string; type: string; expected?: string; text: string }> {
  const baseSuggestions = {
    navigate: [
      { label: 'Page loads', type: 'page_loaded', text: 'Page should load successfully' },
      { label: 'URL matches', type: 'url_contains', expected: '/', text: 'URL should be correct' },
      { label: 'Title correct', type: 'title_contains', expected: '', text: 'Page title should be correct' },
    ],
    click: [
      { label: 'Element appears', type: 'element_visible', text: 'Expected element should appear after click' },
      { label: 'Page changes', type: 'url_changed', text: 'Should navigate to new page' },
      { label: 'Modal opens', type: 'element_visible', text: 'Modal/dialog should open' },
      { label: 'Success message', type: 'toast_success', expected: 'Success', text: 'Success message should appear' },
    ],
    input: [
      { label: 'Value accepted', type: 'value_accepted', text: 'Input should accept the value' },
      { label: 'No errors', type: 'no_validation_error', text: 'No validation errors should appear' },
      { label: 'Validation shows', type: 'validation_error_shown', text: 'Validation message should appear' },
    ],
    select: [
      { label: 'Option selected', type: 'option_selected', text: 'Selected option should be set' },
      { label: 'Form updates', type: 'dependent_dropdown_updated', text: 'Dependent fields should update' },
    ],
    wait: [
      { label: 'Element ready', type: 'element_appears', text: 'Element should be ready for interaction' },
    ],
    assert: [
      { label: 'Condition met', type: 'custom', text: 'Assertion condition should be true' },
    ],
    api: [
      { label: 'Status 200', type: 'status_200', expected: '200', text: 'API should return success status' },
      { label: 'Response valid', type: 'body_contains', text: 'Response should contain expected data' },
    ],
    db_query: [
      { label: 'Records found', type: 'count_equals', expected: '1', text: 'Query should return expected records' },
      { label: 'Data matches', type: 'custom', text: 'Query results should match expected data' },
    ],
  };

  return baseSuggestions[stepType as keyof typeof baseSuggestions] || [
    { label: 'Verify success', type: 'element_visible', text: 'Step should complete successfully' },
  ];
}
