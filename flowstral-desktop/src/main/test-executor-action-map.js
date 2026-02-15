/**
 * Action Type Normalization Map
 * Extracted from test-executor.js for modularity.
 *
 * Maps all known action type variations (QWord, camelCase, snake_case, aliases)
 * to their canonical action type used in the executor's switch statement.
 */

/**
 * Map of normalized (lowercase, no separators) action names to canonical types.
 * @type {Object<string, string>}
 */
const ACTION_MAP = {
  // Click actions
  'clicktext': 'ClickText',
  'click': 'ClickElement',
  'clickelement': 'ClickElement',

  // Input actions
  'fill': 'Fill',
  'type': 'Fill',
  'input': 'Fill',
  'entertext': 'Fill',

  // Navigation
  'goto': 'GoTo',
  'navigate': 'GoTo',
  'open': 'GoTo',
  'openurl': 'GoTo',

  // Select
  'select': 'Select',
  'dropdown': 'Select',
  'selectoption': 'Select',

  // Assertions
  'assert': 'AssertText',
  'asserttext': 'AssertText',
  'verify': 'AssertText',
  'verifytext': 'AssertText',
  'assertelement': 'AssertElement',
  'asserturl': 'AssertUrl',
  'asserttitle': 'AssertTitle',

  // Wait
  'wait': 'Wait',
  'pause': 'Wait',
  'sleep': 'Wait',
  'waitforelement': 'WaitForElement',
  'waitfortext': 'WaitForText',

  // Hover
  'hover': 'Hover',
  'mouseover': 'Hover',

  // Screenshot
  'screenshot': 'Screenshot',
  'capture': 'Screenshot',

  // Check/Uncheck
  'check': 'Check',
  'checkbox': 'Check',
  'uncheck': 'Uncheck',

  // Scroll
  'scroll': 'Scroll',
  'scrollinto': 'Scroll',

  // Extract
  'extract': 'Extract',
  'storevariable': 'Extract',
  'store': 'Extract',

  // Keyboard
  'press': 'Press',
  'keyboard': 'Press',
  'keypress': 'Press',

  // Custom
  'execute': 'Execute',
  'custom': 'Execute',
  'script': 'Execute',

  // Salesforce-specific actions
  'executesoql': 'ExecuteSOQL',
  'soql': 'ExecuteSOQL',
  'query': 'ExecuteSOQL',
  'executeapex': 'ExecuteApex',
  'apex': 'ExecuteApex',
  'restapicall': 'RestApiCall',
  'apicall': 'RestApiCall',
  'createtestdata': 'CreateTestData',
  'datafactory': 'CreateTestData',
  'clonerecord': 'CloneRecord',
  'clone': 'CloneRecord',
  'deleterecord': 'DeleteRecord',
  'triggerflow': 'TriggerFlow',
  'flow': 'TriggerFlow',
  'managepermissionset': 'ManagePermissionSet',
  'permissionset': 'ManagePermissionSet',
  'navigateto': 'NavigateTo',
  'assertvalidation': 'AssertValidation',
  'assertfieldvalue': 'AssertFieldValue',
  // New SF Tools
  'runapextest': 'RunApexTest',
  'apextest': 'RunApexTest',
  'createrecord': 'CreateRecord',
  'bulkload': 'BulkLoad',
  'bulk': 'BulkLoad',
  'runreport': 'RunReport',
  'report': 'RunReport',

  // New SF Tools Step Types (from UnifiedWorkflowEditor)
  'sfconnect': 'sf_connect',
  'sf_connect': 'sf_connect',
  'sfquery': 'sf_query',
  'sf_query': 'sf_query',
  'sfassert': 'sf_assert',
  'sf_assert': 'sf_assert',
  'sfmetadataassert': 'sf_metadata_assert',
  'sf_metadata_assert': 'sf_metadata_assert',
  'sfloginas': 'sf_login_as',
  'sf_login_as': 'sf_login_as',
  'sfcreaterecord': 'sf_create_record',
  'sf_create_record': 'sf_create_record',
  'sfnavigate': 'sf_navigate',
  'sf_navigate': 'sf_navigate',

  // Specific SF assertion types (from test data files)
  'sf_soql': 'sf_query',
  'sfsoql': 'sf_query',
  // Note: 'executesoql' already mapped above to ExecuteSOQL
  'sf_assert_soql': 'sf_assert_soql',
  'sfassertsoql': 'sf_assert_soql',
  'assertsoql': 'sf_assert_soql',
  'sf_assert_field_exists': 'sf_assert_field_exists',
  'sfassertfieldexists': 'sf_assert_field_exists',
  'assertfieldexists': 'sf_assert_field_exists',
  'sf_assert_field_value': 'sf_assert_field_value',
  'sfassertfieldvalue': 'sf_assert_field_value',
  // Note: 'assertfieldvalue' already mapped above to AssertFieldValue
  'sf_assert_picklist': 'sf_assert_picklist',
  'sfassertpicklist': 'sf_assert_picklist',
  'assertpicklist': 'sf_assert_picklist',
  'sf_assert_validation_rule': 'sf_assert_validation_rule',
  'sfassertvalidationrule': 'sf_assert_validation_rule',
  'assertvalidationrule': 'sf_assert_validation_rule',
  'sf_assert_flow': 'sf_assert_flow',
  'sfassertflow': 'sf_assert_flow',
  'assertflow': 'sf_assert_flow',
  'sf_assert_record_type': 'sf_assert_record_type',
  'sfassertrecordtype': 'sf_assert_record_type',
  'assertrecordtype': 'sf_assert_record_type',
  // Note: 'createrecord' already mapped above to CreateRecord
  'restapi': 'sf_rest_api',
  'sf_rest_api': 'sf_rest_api',
  'sfrestapi': 'sf_rest_api',
  // Note: 'apex' already mapped above to ExecuteApex
  'sf_apex': 'sf_apex',
  'sfapex': 'sf_apex',
  // Note: 'executeapex' already mapped above to ExecuteApex
};

/**
 * Normalize an action type string to its canonical form.
 * @param {string} actionType - Raw action type (QWord, camelCase, snake_case, etc.)
 * @returns {string} Canonical action type, or original if no mapping found
 */
function normalizeActionType(actionType) {
  if (!actionType) return '';

  const normalized = actionType.toLowerCase().replace(/[_\s-]/g, '');
  return ACTION_MAP[normalized] || actionType; // Return original if no mapping found
}

module.exports = { normalizeActionType, ACTION_MAP };
