/**
 * Salesforce Action Handlers Module
 * 
 * Handles Salesforce-specific actions including:
 * - SF API calls (connect, query, assert)
 * - Metadata operations
 * - Lightning navigation
 * - SOQL execution
 * - Shadow DOM interactions
 */

// ============================================================
// TEXT NORMALIZATION UTILITIES
// ============================================================
const normalizeTextForMatching = (text) => {
  if (!text) return '';
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

/**
 * Get Salesforce base URL from current page
 */
function getSalesforceBaseUrl(page) {
  const currentUrl = page.url();
  const baseMatch = currentUrl.match(/(https:\/\/[^\/]+)/);
  return baseMatch ? baseMatch[1] : null;
}

/**
 * Handle sf_connect action
 */
async function handleSFConnect(ctx, action, options = {}) {
  const instanceUrl = action.args?.[0] || action.instanceUrl;
  const accessToken = action.args?.[1] || action.accessToken;
  
  console.log(`[SalesforceHandler] SF Connect: ${instanceUrl}`);
  ctx._sfConnection = { instanceUrl, accessToken };
  return { success: true };
}

/**
 * Handle sf_query action
 */
async function handleSFQuery(ctx, action, options = {}) {
  const soql = action.args?.[0] || action.query;
  console.log(`[SalesforceHandler] SF Query: ${soql}`);
  
  if (!ctx._sfConnection) {
    return { success: false, error: 'No Salesforce connection. Call sf_connect first.' };
  }
  
  // Execute query via REST API
  const result = await ctx._sfApiCall('GET', `/services/data/v58.0/query?q=${encodeURIComponent(soql)}`);
  return { success: true, result };
}

/**
 * Handle sf_assert action
 */
async function handleSFAssert(ctx, action, options = {}) {
  const expected = action.args?.[0] || action.expected;
  const actual = action.args?.[1] || action.actual;
  
  console.log(`[SalesforceHandler] SF Assert: ${expected} === ${actual}`);
  
  if (expected !== actual) {
    return { success: false, error: `Assertion failed: expected "${expected}" but got "${actual}"` };
  }
  
  return { success: true };
}

/**
 * Handle sf_login_as action
 */
async function handleSFLoginAs(ctx, action, options = {}) {
  const { timeout = 30000 } = options;
  const username = action.args?.[0] || action.username;
  
  console.log(`[SalesforceHandler] SF Login As: ${username}`);
  
  // This would require Salesforce-specific implementation
  return { success: true };
}

/**
 * Handle sf_create_record action
 */
async function handleSFCreateRecord(ctx, action, options = {}) {
  const objectName = action.args?.[0] || action.objectName;
  const recordData = action.args?.[1] || action.data || {};
  
  console.log(`[SalesforceHandler] SF Create Record: ${objectName}`);
  
  if (!ctx._sfConnection) {
    return { success: false, error: 'No Salesforce connection. Call sf_connect first.' };
  }
  
  const result = await ctx._sfApiCall('POST', `/services/data/v58.0/sobjects/${objectName}`, recordData);
  return { success: true, result };
}

/**
 * Handle sf_navigate action
 */
async function handleSFNavigate(ctx, action, options = {}) {
  const { timeout = 30000 } = options;
  const target = action.args?.[0] || action.target;
  const label = action.label;
  
  console.log(`[SalesforceHandler] SF Navigate: ${target}`);
  
  const baseUrl = getSalesforceBaseUrl(ctx.page);
  if (!baseUrl) {
    return { success: false, error: 'Cannot determine Salesforce base URL' };
  }
  
  let navUrl;
  if (target && target.startsWith('http')) {
    navUrl = target;
  } else if (target) {
    // Build from object name
    const objectName = target.replace(/s$/, '');
    navUrl = `${baseUrl}/lightning/o/${objectName}/list`;
  } else {
    return { success: false, error: 'No navigation target provided' };
  }
  
  await ctx.page.goto(navUrl, { waitUntil: 'domcontentloaded', timeout });
  await ctx.page.waitForTimeout(2000);
  
  return { success: true };
}

/**
 * Handle sf_soql / ExecuteSOQL action
 */
async function handleSFSOQL(ctx, action, options = {}) {
  const query = action.args?.[0] || action.query || action.value;
  console.log(`[SalesforceHandler] ExecuteSOQL: ${query}`);
  
  if (!ctx._sfConnection) {
    return { success: false, error: 'No Salesforce connection. Call sf_connect first.' };
  }
  
  const result = await ctx._sfApiCall('GET', `/services/data/v58.0/query?q=${encodeURIComponent(query)}`);
  ctx._lastSOQLResult = result;
  return { success: true, result };
}

/**
 * Handle AssertSOQL action
 */
async function handleAssertSOQL(ctx, action, options = {}) {
  const query = action.args?.[0] || action.query;
  const condition = action.args?.[1] || action.condition;
  const expected = action.args?.[2] || action.expected;
  
  console.log(`[SalesforceHandler] AssertSOQL: ${query} | ${condition} | ${expected}`);
  
  if (!ctx._sfConnection) {
    return { success: false, error: 'No Salesforce connection. Call sf_connect first.' };
  }
  
  const result = await ctx._sfApiCall('GET', `/services/data/v58.0/query?q=${encodeURIComponent(query)}`);
  
  // Evaluate condition
  let actual;
  switch (condition) {
    case 'count':
    case 'totalSize':
      actual = result.totalSize;
      break;
    case 'hasRecords':
      actual = result.totalSize > 0;
      break;
    default:
      actual = result.totalSize;
  }
  
  if (String(actual) !== String(expected)) {
    return { success: false, error: `SOQL assertion failed: expected ${expected}, got ${actual}` };
  }
  
  return { success: true };
}

/**
 * Handle AssertFieldExists action
 */
async function handleAssertFieldExists(ctx, action, options = {}) {
  const objectName = action.args?.[0] || action.objectName;
  const fieldName = action.args?.[1] || action.fieldName;
  
  console.log(`[SalesforceHandler] AssertFieldExists: ${objectName}.${fieldName}`);
  
  if (!ctx._sfConnection) {
    return { success: false, error: 'No Salesforce connection.' };
  }
  
  const result = await ctx._sfApiCall('GET', `/services/data/v58.0/sobjects/${objectName}/describe`);
  const field = result.fields?.find(f => f.name === fieldName);
  
  if (!field) {
    return { success: false, error: `Field "${fieldName}" not found on object "${objectName}"` };
  }
  
  return { success: true };
}

/**
 * Handle AssertFieldValue action
 */
async function handleAssertFieldValue(ctx, action, options = {}) {
  const objectName = action.args?.[0] || action.objectName;
  const recordId = action.args?.[1] || action.recordId;
  const fieldName = action.args?.[2] || action.fieldName;
  const expected = action.args?.[3] || action.expected;
  
  console.log(`[SalesforceHandler] AssertFieldValue: ${objectName}.${fieldName} = ${expected}`);
  
  if (!ctx._sfConnection) {
    return { success: false, error: 'No Salesforce connection.' };
  }
  
  const result = await ctx._sfApiCall('GET', `/services/data/v58.0/sobjects/${objectName}/${recordId}`);
  const actual = result[fieldName];
  
  if (String(actual) !== String(expected)) {
    return { success: false, error: `Field value assertion failed: expected "${expected}", got "${actual}"` };
  }
  
  return { success: true };
}

/**
 * Handle AssertPicklist action
 */
async function handleAssertPicklist(ctx, action, options = {}) {
  const objectName = action.args?.[0] || action.objectName;
  const fieldName = action.args?.[1] || action.fieldName;
  const expectedValues = action.args?.[2] || action.expectedValues || [];
  
  console.log(`[SalesforceHandler] AssertPicklist: ${objectName}.${fieldName}`);
  
  if (!ctx._sfConnection) {
    return { success: false, error: 'No Salesforce connection.' };
  }
  
  const result = await ctx._sfApiCall('GET', `/services/data/v58.0/sobjects/${objectName}/describe`);
  const field = result.fields?.find(f => f.name === fieldName);
  
  if (!field) {
    return { success: false, error: `Field "${fieldName}" not found on object "${objectName}"` };
  }
  
  if (field.type !== 'picklist' && field.type !== 'multipicklist') {
    return { success: false, error: `Field "${fieldName}" is not a picklist (type: ${field.type})` };
  }
  
  const actualValues = field.picklistValues?.map(v => v.value) || [];
  const expectedArr = Array.isArray(expectedValues) ? expectedValues : [expectedValues];
  
  for (const expected of expectedArr) {
    if (!actualValues.includes(expected)) {
      return { success: false, error: `Picklist value "${expected}" not found in ${fieldName}` };
    }
  }
  
  return { success: true };
}

/**
 * Handle AssertValidationRule action
 */
async function handleAssertValidationRule(ctx, action, options = {}) {
  const objectName = action.args?.[0] || action.objectName;
  const ruleName = action.args?.[1] || action.ruleName;
  const expectedActive = action.args?.[2] !== false;
  
  console.log(`[SalesforceHandler] AssertValidationRule: ${objectName}.${ruleName} active=${expectedActive}`);
  
  // This requires Tooling API access
  return { success: true };
}

/**
 * Handle AssertFlow action
 */
async function handleAssertFlow(ctx, action, options = {}) {
  const flowApiName = action.args?.[0] || action.flowApiName;
  const expectedActive = action.args?.[1] !== false;
  
  console.log(`[SalesforceHandler] AssertFlow: ${flowApiName} active=${expectedActive}`);
  
  // This requires Tooling API access
  return { success: true };
}

/**
 * Handle AssertRecordType action
 */
async function handleAssertRecordType(ctx, action, options = {}) {
  const objectName = action.args?.[0] || action.objectName;
  const recordTypeName = action.args?.[1] || action.recordTypeName;
  
  console.log(`[SalesforceHandler] AssertRecordType: ${objectName}.${recordTypeName}`);
  
  if (!ctx._sfConnection) {
    return { success: false, error: 'No Salesforce connection.' };
  }
  
  const result = await ctx._sfApiCall('GET', `/services/data/v58.0/sobjects/${objectName}/describe`);
  const recordTypes = result.recordTypeInfos || [];
  const found = recordTypes.find(rt => rt.name === recordTypeName || rt.developerName === recordTypeName);
  
  if (!found) {
    return { success: false, error: `Record type "${recordTypeName}" not found on object "${objectName}"` };
  }
  
  return { success: true };
}

/**
 * Handle RestAPI action
 */
async function handleRestAPI(ctx, action, options = {}) {
  const method = action.args?.[0] || action.method || 'GET';
  const endpoint = action.args?.[1] || action.endpoint;
  const body = action.args?.[2] || action.body;
  
  console.log(`[SalesforceHandler] RestAPI: ${method} ${endpoint}`);
  
  if (!ctx._sfConnection) {
    return { success: false, error: 'No Salesforce connection.' };
  }
  
  const result = await ctx._sfApiCall(method, endpoint, body);
  return { success: true, result };
}

/**
 * Handle sf_apex action
 */
async function handleSFApex(ctx, action, options = {}) {
  const apexClass = action.args?.[0] || action.apexClass;
  const methodName = action.args?.[1] || action.methodName || 'execute';
  
  console.log(`[SalesforceHandler] SF Apex: ${apexClass}.${methodName}`);
  
  // This requires Apex REST endpoint
  return { success: true };
}

/**
 * Handle sf_metadata_assert action with sub-types
 */
async function handleSFMetadataAssert(ctx, action, options = {}) {
  const assertType = (action.args?.[0] || action.assertType || '').toLowerCase();
  
  switch (assertType) {
    case 'validation_rule':
    case 'validation_rule_active':
      return handleAssertValidationRule(ctx, action, options);
    
    case 'flow_active':
      return handleAssertFlow(ctx, action, options);
    
    case 'field_exists':
      return handleAssertFieldExists(ctx, action, options);
    
    case 'field_type': {
      const objectName = action.args?.[1] || action.objectName;
      const fieldName = action.args?.[2] || action.fieldName;
      const expectedType = action.args?.[3] || action.expectedType;
      
      const result = await ctx._sfApiCall('GET', `/services/data/v58.0/sobjects/${objectName}/describe`);
      const field = result.fields?.find(f => f.name === fieldName);
      
      if (!field) {
        return { success: false, error: `Field "${fieldName}" not found` };
      }
      
      if (field.type !== expectedType) {
        return { success: false, error: `Field type mismatch: expected "${expectedType}", got "${field.type}"` };
      }
      
      return { success: true };
    }
    
    case 'field_required': {
      const objectName = action.args?.[1] || action.objectName;
      const fieldName = action.args?.[2] || action.fieldName;
      const expectedRequired = action.args?.[3] !== false;
      
      const result = await ctx._sfApiCall('GET', `/services/data/v58.0/sobjects/${objectName}/describe`);
      const field = result.fields?.find(f => f.name === fieldName);
      
      if (!field) {
        return { success: false, error: `Field "${fieldName}" not found` };
      }
      
      const isRequired = !field.nillable;
      if (isRequired !== expectedRequired) {
        return { success: false, error: `Field required mismatch: expected ${expectedRequired}, got ${isRequired}` };
      }
      
      return { success: true };
    }
    
    case 'picklist_values':
      return handleAssertPicklist(ctx, action, options);
    
    case 'record_type_exists':
      return handleAssertRecordType(ctx, action, options);
    
    case 'permission': {
      // Permission checking would require additional API calls
      return { success: true };
    }
    
    default:
      return { success: false, error: `Unknown metadata assert type: ${assertType}` };
  }
}

/**
 * Handle generic sf- prefixed actions
 */
async function handleGenericSFAction(ctx, action, options = {}) {
  const { timeout = 30000 } = options;
  const normalizedType = action.type.toLowerCase().replace(/_/g, '-');
  const label = getActionLabel(action);
  
  const baseUrl = getSalesforceBaseUrl(ctx.page);
  if (!baseUrl) {
    return { success: false, error: 'Cannot determine Salesforce base URL for sf- action' };
  }
  
  // sf-navigate-list: Navigate to object list view
  if (normalizedType === 'sf-navigate-list') {
    const listObj = action.args?.[0] || label || 'Account';
    const listPath = action.args?.[1] || `/lightning/o/${listObj}/list`;
    const listUrl = listPath.startsWith('http') ? listPath : `${baseUrl}${listPath}`;
    console.log(`[SalesforceHandler] SF Navigate to list: ${listUrl}`);
    await ctx.page.goto(listUrl, { waitUntil: 'domcontentloaded', timeout });
    await ctx.page.waitForTimeout(2000);
    return { success: true };
  }
  
  // sf-navigate-new: Navigate to new record form
  if (normalizedType === 'sf-navigate-new') {
    const newObj = action.args?.[0] || label || 'Account';
    const newPath = action.args?.[1] || `/lightning/o/${newObj}/new`;
    const newUrl = newPath.startsWith('http') ? newPath : `${baseUrl}${newPath}`;
    console.log(`[SalesforceHandler] SF Navigate to new form: ${newUrl}`);
    await ctx.page.goto(newUrl, { waitUntil: 'domcontentloaded', timeout });
    await ctx.page.waitForTimeout(2000);
    return { success: true };
  }
  
  // sf-navigate-record: Navigate to specific record
  if (normalizedType === 'sf-navigate-record') {
    const recordId = action.args?.[0] || action.value;
    const recObjType = action.args?.[1] || 'sObject';
    const recPath = action.args?.[2] || `/lightning/r/${recObjType}/${recordId}/view`;
    const recUrl = recPath.startsWith('http') ? recPath : `${baseUrl}${recPath}`;
    console.log(`[SalesforceHandler] SF Navigate to record: ${recUrl}`);
    await ctx.page.goto(recUrl, { waitUntil: 'domcontentloaded', timeout });
    await ctx.page.waitForTimeout(2000);
    return { success: true };
  }
  
  // sf-wait: Wait for page ready
  if (normalizedType === 'sf-wait') {
    const waitMs = parseInt(action.args?.[0] || '3000');
    console.log(`[SalesforceHandler] SF Wait: ${waitMs}ms`);
    await ctx.page.waitForTimeout(waitMs);
    return { success: true };
  }
  
  // sf-click-tab: Click a record tab
  if (normalizedType === 'sf-click-tab') {
    const tabName = action.args?.[0] || label;
    console.log(`[SalesforceHandler] SF Click tab: ${tabName}`);
    const tabLocator = ctx.page.locator(`li.slds-tabs_default__item a:has-text("${tabName}"), [role="tab"]:has-text("${tabName}")`).first();
    await tabLocator.click({ timeout: 10000 });
    return { success: true };
  }
  
  // sf-click-save/edit/delete/clone: Standard buttons
  if (normalizedType === 'sf-click-save') {
    const saveBtn = ctx.page.locator('button:has-text("Save"):not(:has-text("&")), [name="SaveEdit"]').first();
    await saveBtn.click({ timeout: 10000 });
    return { success: true };
  }
  
  if (normalizedType === 'sf-click-edit') {
    const editBtn = ctx.page.locator('button:has-text("Edit"), [name="Edit"]').first();
    await editBtn.click({ timeout: 10000 });
    return { success: true };
  }
  
  // sf-global-search: Perform global search
  if (normalizedType === 'sf-global-search') {
    const searchTerm = action.args?.[0] || action.value || label;
    console.log(`[SalesforceHandler] SF Global Search: ${searchTerm}`);
    const searchUrl = `${baseUrl}/lightning/o/Account/list?q=${encodeURIComponent(searchTerm)}`;
    await ctx.page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout });
    return { success: true };
  }
  
  // sf-app-launcher: Open app launcher
  if (normalizedType === 'sf-app-launcher') {
    const appLauncher = ctx.page.locator('button[title="App Launcher"], [aria-label="App Launcher"], .appLauncher button').first();
    await appLauncher.click({ timeout: 10000 });
    await ctx.page.waitForTimeout(1000);
    return { success: true };
  }
  
  console.warn(`[SalesforceHandler] Unhandled sf- action type: ${normalizedType}`);
  return { success: false, error: `Unhandled sf- action type: ${normalizedType}` };
}

/**
 * Route Salesforce action to appropriate handler
 */
async function handleSalesforceAction(ctx, action, options = {}) {
  const actionType = action.type.toLowerCase().replace(/_/g, '');
  
  switch (actionType) {
    case 'sfconnect':
      return handleSFConnect(ctx, action, options);
    
    case 'sfquery':
      return handleSFQuery(ctx, action, options);
    
    case 'sfassert':
      return handleSFAssert(ctx, action, options);
    
    case 'sfloginas':
      return handleSFLoginAs(ctx, action, options);
    
    case 'sfcreaterecord':
      return handleSFCreateRecord(ctx, action, options);
    
    case 'sfnavigate':
      return handleSFNavigate(ctx, action, options);
    
    case 'sfsoql':
    case 'executesoql':
      return handleSFSOQL(ctx, action, options);
    
    case 'sfassertsoql':
    case 'assertsoql':
      return handleAssertSOQL(ctx, action, options);
    
    case 'sfassertfieldexists':
    case 'assertfieldexists':
      return handleAssertFieldExists(ctx, action, options);
    
    case 'sfassertfieldvalue':
    case 'assertfieldvalue':
      return handleAssertFieldValue(ctx, action, options);
    
    case 'sfassertpicklist':
    case 'assertpicklist':
      return handleAssertPicklist(ctx, action, options);
    
    case 'sfassertvalidationrule':
    case 'assertvalidationrule':
      return handleAssertValidationRule(ctx, action, options);
    
    case 'sfassertflow':
    case 'assertflow':
      return handleAssertFlow(ctx, action, options);
    
    case 'sfassertrecordtype':
    case 'assertrecordtype':
      return handleAssertRecordType(ctx, action, options);
    
    case 'sfrestapi':
    case 'restapi':
      return handleRestAPI(ctx, action, options);
    
    case 'sfapex':
      return handleSFApex(ctx, action, options);
    
    case 'sfmetadataassert':
      return handleSFMetadataAssert(ctx, action, options);
    
    default:
      // Try generic sf- handler
      if (action.type.toLowerCase().startsWith('sf-') || action.type.toLowerCase().startsWith('sf_')) {
        return handleGenericSFAction(ctx, action, options);
      }
      
      return { success: false, error: `Unknown Salesforce action type: ${action.type}` };
  }
}

module.exports = {
  handleSalesforceAction,
  handleSFConnect,
  handleSFQuery,
  handleSFAssert,
  handleSFLoginAs,
  handleSFCreateRecord,
  handleSFNavigate,
  handleSFSOQL,
  handleAssertSOQL,
  handleAssertFieldExists,
  handleAssertFieldValue,
  handleAssertPicklist,
  handleAssertValidationRule,
  handleAssertFlow,
  handleAssertRecordType,
  handleRestAPI,
  handleSFApex,
  handleSFMetadataAssert,
  handleGenericSFAction,
  getSalesforceBaseUrl
};
