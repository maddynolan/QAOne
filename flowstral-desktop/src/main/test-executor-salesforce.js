/**
 * Salesforce API Helpers & Test Data Generators
 * Extracted from test-executor.js for modularity.
 *
 * These are standalone functions that operate on a page + context
 * (Playwright browser context) to interact with Salesforce APIs.
 *
 * Usage in TestExecutor:
 *   const sf = require('./test-executor-salesforce');
 *   const session = await sf.getSalesforceSession(this.context, this.page);
 *   const result = await sf.sfApiCall(this.context, this.page, 'GET', '/query?q=...');
 */

/**
 * Extract Salesforce session info from browser cookies.
 * @param {import('playwright').BrowserContext} context - Playwright browser context
 * @param {import('playwright').Page} page - Playwright page
 * @returns {Promise<{accessToken: string, instanceUrl: string, apiVersion: string}>}
 */
async function getSalesforceSession(context, page) {
  try {
    const cookies = await context.cookies();
    const sidCookie = cookies.find(c => c.name === 'sid');

    if (!sidCookie) {
      throw new Error('Not logged into Salesforce - no session cookie found');
    }

    // Get instance URL from current page URL
    const currentUrl = page.url();
    const urlMatch = currentUrl.match(/(https:\/\/[^\/]+)/);
    const instanceUrl = urlMatch ? urlMatch[1] : null;

    if (!instanceUrl) {
      throw new Error('Could not determine Salesforce instance URL');
    }

    console.log(`[SF API] Session found, instance: ${instanceUrl}`);

    return {
      accessToken: sidCookie.value,
      instanceUrl: instanceUrl,
      apiVersion: 'v59.0'
    };
  } catch (error) {
    console.error('[SF API] Failed to get session:', error);
    throw error;
  }
}

/**
 * Make authenticated Salesforce REST API call.
 * @param {import('playwright').BrowserContext} context - Playwright browser context
 * @param {import('playwright').Page} page - Playwright page
 * @param {string} method - HTTP method (GET, POST, PATCH, DELETE)
 * @param {string} endpoint - API endpoint path or full URL
 * @param {Object|null} body - Request body for POST/PATCH
 * @returns {Promise<Object>} Parsed JSON response
 */
async function sfApiCall(context, page, method, endpoint, body = null) {
  const session = await getSalesforceSession(context, page);

  const url = endpoint.startsWith('http')
    ? endpoint
    : `${session.instanceUrl}/services/data/${session.apiVersion}${endpoint}`;

  console.log(`[SF API] ${method} ${url}`);

  const options = {
    method,
    headers: {
      'Authorization': `Bearer ${session.accessToken}`,
      'Content-Type': 'application/json',
    }
  };

  if (body && (method === 'POST' || method === 'PATCH')) {
    options.body = JSON.stringify(body);
  }

  // Execute fetch in browser context (to use same session)
  const result = await page.evaluate(async ({ url, options }) => {
    try {
      const response = await fetch(url, options);
      const text = await response.text();
      return {
        ok: response.ok,
        status: response.status,
        data: text ? JSON.parse(text) : null
      };
    } catch (error) {
      return { ok: false, error: error.message };
    }
  }, { url, options });

  if (!result.ok) {
    console.error('[SF API] Error:', result);
    throw new Error(`SF API Error: ${result.status} - ${JSON.stringify(result.data || result.error)}`);
  }

  return result.data;
}

/**
 * Generate random test data for Salesforce objects.
 * @param {string} objectType - Salesforce object API name (Account, Contact, Lead, etc.)
 * @returns {Object} Field-value map for creating a test record
 */
function generateTestData(objectType) {
  const random = Math.random().toString(36).substring(7);

  const dataGenerators = {
    'Account': {
      Name: `Test Account ${random}`,
      Description: `Auto-generated test account at ${new Date().toISOString()}`,
      Industry: 'Technology',
      Type: 'Prospect'
    },
    'Contact': {
      FirstName: `Test`,
      LastName: `Contact ${random}`,
      Email: `test.${random}@example.com`,
      Phone: `555-${Math.floor(Math.random() * 9000) + 1000}`
    },
    'Lead': {
      FirstName: `Test`,
      LastName: `Lead ${random}`,
      Company: `Test Company ${random}`,
      Email: `lead.${random}@example.com`,
      Status: 'Open - Not Contacted'
    },
    'Opportunity': {
      Name: `Test Opportunity ${random}`,
      StageName: 'Prospecting',
      CloseDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      Amount: Math.floor(Math.random() * 100000) + 1000
    },
    'Case': {
      Subject: `Test Case ${random}`,
      Description: `Auto-generated test case`,
      Status: 'New',
      Priority: 'Medium',
      Origin: 'Web'
    }
  };

  return dataGenerators[objectType] || { Name: `Test ${objectType} ${random}` };
}

/**
 * Non-createable fields that must be removed when cloning Salesforce records.
 * @type {string[]}
 */
const NON_CREATEABLE_FIELDS = [
  'Id', 'IsDeleted', 'CreatedDate', 'CreatedById', 'LastModifiedDate',
  'LastModifiedById', 'SystemModstamp', 'LastActivityDate', 'LastViewedDate',
  'LastReferencedDate', 'attributes'
];

/**
 * Salesforce object ID prefix to object type mapping.
 * @type {Object<string, string>}
 */
const ID_PREFIX_MAP = {
  '001': 'Account',
  '003': 'Contact',
  '00Q': 'Lead',
  '006': 'Opportunity',
  '500': 'Case'
};

module.exports = {
  getSalesforceSession,
  sfApiCall,
  generateTestData,
  NON_CREATEABLE_FIELDS,
  ID_PREFIX_MAP
};
