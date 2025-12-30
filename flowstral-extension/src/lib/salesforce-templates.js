/**
 * Salesforce Standard Object Templates for Browser Extension
 * 
 * Pre-built test case templates for creating standard Salesforce objects.
 * Mirrors the app's salesforce-templates.ts but in vanilla JavaScript.
 */

// ============================================================================
// SALESFORCE SMART FILL TYPES
// ============================================================================

const SALESFORCE_SMART_FILL_TYPES = {
  accountName: { generator: 'company', examples: ['Acme Corp', 'Global Tech'] },
  firstName: { generator: 'firstName', examples: ['John', 'Jane'] },
  lastName: { generator: 'lastName', examples: ['Smith', 'Johnson'] },
  email: { generator: 'email', examples: ['john@example.com'] },
  phone: { generator: 'phone', examples: ['(415) 555-1234'] },
  street: { generator: 'street', examples: ['123 Main St'] },
  city: { generator: 'city', examples: ['San Francisco', 'New York'] },
  state: { generator: 'state', examples: ['CA', 'NY'] },
  postalCode: { generator: 'zipCode', examples: ['94105'] },
  country: { generator: 'country', examples: ['United States'] },
  website: { generator: 'url', examples: ['https://www.example.com'] },
  currency: { generator: 'currency', examples: ['100000'] },
  annualRevenue: { generator: 'currency', examples: ['1000000'] },
  amount: { generator: 'currency', examples: ['50000'] },
  employees: { generator: 'number', examples: ['250'] },
  percent: { generator: 'percent', examples: ['50'] },
  title: { generator: 'jobTitle', examples: ['CEO', 'Manager'] },
  department: { generator: 'text', examples: ['Sales', 'Marketing'] },
  date: { generator: 'date', examples: ['2025-01-15'] },
  futureDate: { generator: 'futureDate', examples: ['2025-06-30'] },
  caseSubject: { generator: 'text', examples: ['Login Issue', 'Feature Request'] },
  caseDescription: { generator: 'textarea', examples: ['Customer reported...'] },
  opportunityName: { generator: 'text', examples: ['Q1 Enterprise Deal'] },
  text: { generator: 'text', examples: ['Test Value'] },
  textarea: { generator: 'textarea', examples: ['Test description...'] },
  description: { generator: 'textarea', examples: ['Description text...'] },
  picklist: { generator: 'picklist', examples: [] },
  lookup: { generator: 'lookup', examples: [] },
  salutation: { generator: 'picklist', examples: ['Mr.', 'Ms.', 'Mrs.'] },
  leadSource: { generator: 'picklist', examples: ['Web', 'Phone', 'Partner'] },
  leadStatus: { generator: 'picklist', examples: ['Open - Not Contacted'] },
  rating: { generator: 'picklist', examples: ['Hot', 'Warm', 'Cold'] },
  stageName: { generator: 'picklist', examples: ['Prospecting', 'Qualification'] },
  caseStatus: { generator: 'picklist', examples: ['New', 'Working', 'Closed'] },
  casePriority: { generator: 'picklist', examples: ['Low', 'Medium', 'High'] },
  caseOrigin: { generator: 'picklist', examples: ['Phone', 'Email', 'Web'] },
  caseType: { generator: 'picklist', examples: ['Problem', 'Feature Request'] },
  industry: { generator: 'picklist', examples: ['Technology', 'Healthcare'] },
  accountType: { generator: 'picklist', examples: ['Customer - Direct', 'Prospect'] },
};

// ============================================================================
// SALESFORCE TEMPLATES
// ============================================================================

const SALESFORCE_TEMPLATES = [
  // ========== ACCOUNT ==========
  {
    apiName: 'Account',
    label: 'Account',
    pluralLabel: 'Accounts',
    icon: '🏢',
    description: 'Create a new Account (Company)',
    category: 'sales',
    fields: [
      { apiName: 'Name', label: 'Account Name', type: 'text', required: true, smartFillType: 'accountName' },
      { apiName: 'Type', label: 'Type', type: 'picklist', required: false, smartFillType: 'accountType',
        picklistValues: ['Prospect', 'Customer - Direct', 'Customer - Channel', 'Partner'] },
      { apiName: 'Industry', label: 'Industry', type: 'picklist', required: false, smartFillType: 'industry',
        picklistValues: ['Technology', 'Healthcare', 'Finance', 'Manufacturing', 'Retail'] },
      { apiName: 'Phone', label: 'Phone', type: 'phone', required: false, smartFillType: 'phone' },
      { apiName: 'Website', label: 'Website', type: 'url', required: false, smartFillType: 'website' },
      { apiName: 'AnnualRevenue', label: 'Annual Revenue', type: 'currency', required: false, smartFillType: 'annualRevenue' },
      { apiName: 'NumberOfEmployees', label: 'Employees', type: 'number', required: false, smartFillType: 'employees' },
      { apiName: 'Description', label: 'Description', type: 'textarea', required: false, smartFillType: 'description' },
      { apiName: 'BillingStreet', label: 'Billing Street', type: 'text', required: false, smartFillType: 'street' },
      { apiName: 'BillingCity', label: 'Billing City', type: 'text', required: false, smartFillType: 'city' },
      { apiName: 'BillingState', label: 'Billing State', type: 'text', required: false, smartFillType: 'state' },
      { apiName: 'BillingPostalCode', label: 'Billing Zip', type: 'text', required: false, smartFillType: 'postalCode' },
    ],
    appLauncher: 'Accounts'
  },

  // ========== CONTACT ==========
  {
    apiName: 'Contact',
    label: 'Contact',
    pluralLabel: 'Contacts',
    icon: '👤',
    description: 'Create a new Contact (Person)',
    category: 'sales',
    fields: [
      { apiName: 'Salutation', label: 'Salutation', type: 'picklist', required: false, smartFillType: 'salutation',
        picklistValues: ['Mr.', 'Ms.', 'Mrs.', 'Dr.', 'Prof.'] },
      { apiName: 'FirstName', label: 'First Name', type: 'text', required: false, smartFillType: 'firstName' },
      { apiName: 'LastName', label: 'Last Name', type: 'text', required: true, smartFillType: 'lastName' },
      { apiName: 'Title', label: 'Title', type: 'text', required: false, smartFillType: 'title' },
      { apiName: 'Department', label: 'Department', type: 'text', required: false, smartFillType: 'department' },
      { apiName: 'Email', label: 'Email', type: 'email', required: false, smartFillType: 'email' },
      { apiName: 'Phone', label: 'Phone', type: 'phone', required: false, smartFillType: 'phone' },
      { apiName: 'MobilePhone', label: 'Mobile', type: 'phone', required: false, smartFillType: 'phone' },
      { apiName: 'MailingStreet', label: 'Mailing Street', type: 'text', required: false, smartFillType: 'street' },
      { apiName: 'MailingCity', label: 'Mailing City', type: 'text', required: false, smartFillType: 'city' },
      { apiName: 'MailingState', label: 'Mailing State', type: 'text', required: false, smartFillType: 'state' },
      { apiName: 'MailingPostalCode', label: 'Mailing Zip', type: 'text', required: false, smartFillType: 'postalCode' },
    ],
    appLauncher: 'Contacts'
  },

  // ========== LEAD ==========
  {
    apiName: 'Lead',
    label: 'Lead',
    pluralLabel: 'Leads',
    icon: '🎯',
    description: 'Create a new Lead',
    category: 'sales',
    fields: [
      { apiName: 'Salutation', label: 'Salutation', type: 'picklist', required: false, smartFillType: 'salutation',
        picklistValues: ['Mr.', 'Ms.', 'Mrs.', 'Dr.'] },
      { apiName: 'FirstName', label: 'First Name', type: 'text', required: false, smartFillType: 'firstName' },
      { apiName: 'LastName', label: 'Last Name', type: 'text', required: true, smartFillType: 'lastName' },
      { apiName: 'Company', label: 'Company', type: 'text', required: true, smartFillType: 'accountName' },
      { apiName: 'Title', label: 'Title', type: 'text', required: false, smartFillType: 'title' },
      { apiName: 'Email', label: 'Email', type: 'email', required: false, smartFillType: 'email' },
      { apiName: 'Phone', label: 'Phone', type: 'phone', required: false, smartFillType: 'phone' },
      { apiName: 'LeadSource', label: 'Lead Source', type: 'picklist', required: false, smartFillType: 'leadSource',
        picklistValues: ['Web', 'Phone Inquiry', 'Partner Referral', 'Trade Show', 'Advertisement'] },
      { apiName: 'Status', label: 'Lead Status', type: 'picklist', required: true, smartFillType: 'leadStatus',
        picklistValues: ['Open - Not Contacted', 'Working - Contacted', 'Closed - Converted', 'Closed - Not Converted'] },
      { apiName: 'Rating', label: 'Rating', type: 'picklist', required: false, smartFillType: 'rating',
        picklistValues: ['Hot', 'Warm', 'Cold'] },
      { apiName: 'Industry', label: 'Industry', type: 'picklist', required: false, smartFillType: 'industry',
        picklistValues: ['Technology', 'Healthcare', 'Finance', 'Manufacturing', 'Retail'] },
    ],
    appLauncher: 'Leads'
  },

  // ========== OPPORTUNITY ==========
  {
    apiName: 'Opportunity',
    label: 'Opportunity',
    pluralLabel: 'Opportunities',
    icon: '💰',
    description: 'Create a new Opportunity',
    category: 'sales',
    fields: [
      { apiName: 'Name', label: 'Opportunity Name', type: 'text', required: true, smartFillType: 'opportunityName' },
      { apiName: 'CloseDate', label: 'Close Date', type: 'date', required: true, smartFillType: 'futureDate' },
      { apiName: 'StageName', label: 'Stage', type: 'picklist', required: true, smartFillType: 'stageName',
        picklistValues: ['Prospecting', 'Qualification', 'Needs Analysis', 'Proposal/Price Quote', 'Negotiation/Review', 'Closed Won', 'Closed Lost'] },
      { apiName: 'Amount', label: 'Amount', type: 'currency', required: false, smartFillType: 'amount' },
      { apiName: 'Probability', label: 'Probability (%)', type: 'percent', required: false, smartFillType: 'percent' },
      { apiName: 'LeadSource', label: 'Lead Source', type: 'picklist', required: false, smartFillType: 'leadSource',
        picklistValues: ['Web', 'Phone Inquiry', 'Partner Referral', 'Trade Show', 'Advertisement'] },
      { apiName: 'Type', label: 'Type', type: 'picklist', required: false, smartFillType: 'picklist',
        picklistValues: ['New Customer', 'Existing Customer - Upgrade', 'Existing Customer - Replacement'] },
      { apiName: 'NextStep', label: 'Next Step', type: 'text', required: false, smartFillType: 'text' },
      { apiName: 'Description', label: 'Description', type: 'textarea', required: false, smartFillType: 'description' },
    ],
    appLauncher: 'Opportunities'
  },

  // ========== CASE ==========
  {
    apiName: 'Case',
    label: 'Case',
    pluralLabel: 'Cases',
    icon: '📋',
    description: 'Create a new Case (Support)',
    category: 'service',
    fields: [
      { apiName: 'Subject', label: 'Subject', type: 'text', required: true, smartFillType: 'caseSubject' },
      { apiName: 'Description', label: 'Description', type: 'textarea', required: false, smartFillType: 'caseDescription' },
      { apiName: 'Status', label: 'Status', type: 'picklist', required: true, smartFillType: 'caseStatus',
        picklistValues: ['New', 'Working', 'Escalated', 'Closed'] },
      { apiName: 'Priority', label: 'Priority', type: 'picklist', required: false, smartFillType: 'casePriority',
        picklistValues: ['Low', 'Medium', 'High', 'Critical'] },
      { apiName: 'Origin', label: 'Case Origin', type: 'picklist', required: true, smartFillType: 'caseOrigin',
        picklistValues: ['Phone', 'Email', 'Web', 'Chat'] },
      { apiName: 'Type', label: 'Type', type: 'picklist', required: false, smartFillType: 'caseType',
        picklistValues: ['Problem', 'Feature Request', 'Question'] },
      { apiName: 'Reason', label: 'Case Reason', type: 'picklist', required: false, smartFillType: 'picklist',
        picklistValues: ['Installation', 'Performance', 'Breakdown', 'Feedback', 'Other'] },
    ],
    appLauncher: 'Cases'
  },

  // ========== TASK ==========
  {
    apiName: 'Task',
    label: 'Task',
    pluralLabel: 'Tasks',
    icon: '✅',
    description: 'Create a new Task',
    category: 'common',
    fields: [
      { apiName: 'Subject', label: 'Subject', type: 'text', required: true, smartFillType: 'text' },
      { apiName: 'ActivityDate', label: 'Due Date', type: 'date', required: false, smartFillType: 'futureDate' },
      { apiName: 'Priority', label: 'Priority', type: 'picklist', required: false, smartFillType: 'picklist',
        picklistValues: ['Low', 'Normal', 'High'] },
      { apiName: 'Status', label: 'Status', type: 'picklist', required: false, smartFillType: 'picklist',
        picklistValues: ['Not Started', 'In Progress', 'Completed', 'Waiting on someone else', 'Deferred'] },
      { apiName: 'Description', label: 'Comments', type: 'textarea', required: false, smartFillType: 'description' },
    ],
    appLauncher: 'Tasks'
  },

  // ========== EVENT ==========
  {
    apiName: 'Event',
    label: 'Event',
    pluralLabel: 'Events',
    icon: '📅',
    description: 'Create a new Event',
    category: 'common',
    fields: [
      { apiName: 'Subject', label: 'Subject', type: 'text', required: true, smartFillType: 'text' },
      { apiName: 'Location', label: 'Location', type: 'text', required: false, smartFillType: 'text' },
      { apiName: 'StartDateTime', label: 'Start Date/Time', type: 'datetime', required: true, smartFillType: 'futureDate' },
      { apiName: 'EndDateTime', label: 'End Date/Time', type: 'datetime', required: true, smartFillType: 'futureDate' },
      { apiName: 'Description', label: 'Description', type: 'textarea', required: false, smartFillType: 'description' },
    ],
    appLauncher: 'Calendar'
  },

  // ========== CAMPAIGN ==========
  {
    apiName: 'Campaign',
    label: 'Campaign',
    pluralLabel: 'Campaigns',
    icon: '📢',
    description: 'Create a new Campaign',
    category: 'marketing',
    fields: [
      { apiName: 'Name', label: 'Campaign Name', type: 'text', required: true, smartFillType: 'text' },
      { apiName: 'Type', label: 'Type', type: 'picklist', required: false, smartFillType: 'picklist',
        picklistValues: ['Conference', 'Webinar', 'Trade Show', 'Email', 'Telemarketing', 'Other'] },
      { apiName: 'Status', label: 'Status', type: 'picklist', required: false, smartFillType: 'picklist',
        picklistValues: ['Planned', 'In Progress', 'Completed', 'Aborted'] },
      { apiName: 'StartDate', label: 'Start Date', type: 'date', required: false, smartFillType: 'date' },
      { apiName: 'EndDate', label: 'End Date', type: 'date', required: false, smartFillType: 'futureDate' },
      { apiName: 'BudgetedCost', label: 'Budgeted Cost', type: 'currency', required: false, smartFillType: 'currency' },
      { apiName: 'ExpectedRevenue', label: 'Expected Revenue', type: 'currency', required: false, smartFillType: 'currency' },
      { apiName: 'Description', label: 'Description', type: 'textarea', required: false, smartFillType: 'description' },
    ],
    appLauncher: 'Campaigns'
  },
];

// ============================================================================
// DATA GENERATORS
// ============================================================================

function randomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomNum(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

const dataGenerators = {
  company: () => `${randomItem(['Acme', 'Global', 'Premier', 'Elite', 'Dynamic', 'Innovative'])} ${randomItem(['Corp', 'Inc', 'LLC', 'Solutions', 'Technologies', 'Group'])}`,
  firstName: () => randomItem(['John', 'Jane', 'Michael', 'Sarah', 'David', 'Emily', 'Robert', 'Jennifer', 'William', 'Lisa']),
  lastName: () => randomItem(['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Martinez', 'Anderson']),
  email: () => `test.user${randomNum(1000, 9999)}@example.com`,
  phone: () => `(${randomNum(200, 999)}) ${randomNum(200, 999)}-${randomNum(1000, 9999)}`,
  street: () => `${randomNum(100, 9999)} ${randomItem(['Main', 'Oak', 'Maple', 'Cedar', 'Tech', 'Commerce'])} ${randomItem(['St', 'Ave', 'Dr', 'Ln', 'Blvd'])}`,
  city: () => randomItem(['San Francisco', 'New York', 'Austin', 'Seattle', 'Chicago', 'Boston', 'Denver', 'Los Angeles']),
  state: () => randomItem(['CA', 'NY', 'TX', 'WA', 'IL', 'MA', 'CO', 'FL']),
  zipCode: () => `${randomNum(10000, 99999)}`,
  country: () => 'United States',
  url: () => `https://www.${randomItem(['acme', 'global', 'premier', 'company', 'enterprise'])}.com`,
  currency: () => `${randomNum(10000, 500000)}`,
  number: () => `${randomNum(10, 5000)}`,
  percent: () => `${randomNum(10, 90)}`,
  jobTitle: () => randomItem(['CEO', 'CTO', 'CFO', 'VP Sales', 'Director', 'Manager', 'Senior Engineer', 'Consultant']),
  text: () => `Test ${randomItem(['Value', 'Data', 'Entry', 'Input'])} ${randomNum(1000, 9999)}`,
  textarea: () => `Test description for automated testing. Generated at ${new Date().toISOString().split('T')[0]}. Reference: ${randomNum(10000, 99999)}`,
  date: () => new Date().toISOString().split('T')[0],
  futureDate: () => {
    const d = new Date();
    d.setDate(d.getDate() + randomNum(30, 90));
    return d.toISOString().split('T')[0];
  },
  picklist: (field) => field?.picklistValues?.[0] || '',
  lookup: () => '',
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Generate test data for a template
 */
function generateTestDataForTemplate(template) {
  const data = {};
  
  template.fields.forEach(field => {
    const generator = dataGenerators[field.smartFillType];
    if (generator) {
      data[field.apiName] = typeof generator === 'function' 
        ? (field.smartFillType === 'picklist' ? generator(field) : generator())
        : '';
    }
  });
  
  return data;
}

/**
 * Regenerate a single field value
 */
function regenerateFieldValue(field) {
  const generator = dataGenerators[field.smartFillType];
  if (generator) {
    return field.smartFillType === 'picklist' ? generator(field) : generator();
  }
  return '';
}

/**
 * Convert template to executable steps
 */
function templateToSteps(template, testData, options = {}) {
  const {
    includeNavigation = true,
    includeVerification = true,
    selectedFields = null
  } = options;
  
  const steps = [];
  let stepOrder = 1;
  
  // Navigation steps
  if (includeNavigation) {
    // App Launcher
    steps.push({
      id: `step_nav_${stepOrder}`,
      order: stepOrder++,
      type: 'click',
      action: 'click',
      name: 'Open App Launcher',
      description: 'Click App Launcher',
      selector: 'button.slds-icon-waffle, [data-key="appLauncher"]',
      selectorStrategy: 'role',
      roleName: 'button',
      roleOptions: { name: 'App Launcher' }
    });
    
    // Search
    steps.push({
      id: `step_nav_${stepOrder}`,
      order: stepOrder++,
      type: 'fill',
      action: 'fill',
      name: `Search for ${template.pluralLabel}`,
      description: `Type "${template.appLauncher}" in search`,
      selector: 'input[placeholder*="Search"]',
      value: template.appLauncher
    });
    
    // Select from results
    steps.push({
      id: `step_nav_${stepOrder}`,
      order: stepOrder++,
      type: 'click',
      action: 'click',
      name: `Select ${template.pluralLabel}`,
      description: `Click "${template.pluralLabel}"`,
      selector: `a[data-label="${template.pluralLabel}"]`,
      text: template.pluralLabel
    });
    
    // Click New
    steps.push({
      id: `step_nav_${stepOrder}`,
      order: stepOrder++,
      type: 'click',
      action: 'click',
      name: 'Click New button',
      description: 'Click "New" button',
      selector: 'button[name="New"], a[title="New"]',
      selectorStrategy: 'role',
      roleName: 'button',
      roleOptions: { name: 'New' }
    });
  }
  
  // Field steps
  const fieldsToProcess = selectedFields 
    ? template.fields.filter(f => selectedFields.includes(f.apiName))
    : template.fields.filter(f => f.required || testData[f.apiName]);
    
  fieldsToProcess.forEach(field => {
    const value = testData[field.apiName];
    if (!value && !field.required) return;
    
    if (field.type === 'picklist') {
      // Open picklist
      steps.push({
        id: `step_field_${stepOrder}`,
        order: stepOrder++,
        type: 'click',
        action: 'click',
        name: `Open ${field.label} dropdown`,
        description: `Click ${field.label} picklist`,
        selector: `button[name="${field.apiName}"], lightning-combobox[field-name="${field.apiName}"]`,
        fieldApiName: field.apiName,
        fieldLabel: field.label
      });
      
      // Select option
      steps.push({
        id: `step_field_${stepOrder}`,
        order: stepOrder++,
        type: 'click',
        action: 'click',
        name: `Select ${field.label}: ${value}`,
        description: `Select "${value}"`,
        selector: `lightning-base-combobox-item[data-value="${value}"], span[title="${value}"]`,
        value: value,
        selectorStrategy: 'role',
        roleName: 'option',
        roleOptions: { name: value }
      });
    } else if (field.type !== 'lookup') {
      // Text fields
      steps.push({
        id: `step_field_${stepOrder}`,
        order: stepOrder++,
        type: 'fill',
        action: 'fill',
        name: `Fill ${field.label}`,
        description: `Enter "${value}" in ${field.label}`,
        selector: `input[name="${field.apiName}"], lightning-input[field-name="${field.apiName}"] input, textarea[name="${field.apiName}"]`,
        value: value,
        fieldApiName: field.apiName,
        fieldLabel: field.label,
        selectorStrategy: 'label',
        labelText: field.label
      });
    }
  });
  
  // Save
  steps.push({
    id: `step_save_${stepOrder}`,
    order: stepOrder++,
    type: 'click',
    action: 'click',
    name: 'Save record',
    description: 'Click Save button',
    selector: 'button[name="SaveEdit"], button[title="Save"]',
    selectorStrategy: 'role',
    roleName: 'button',
    roleOptions: { name: 'Save' }
  });
  
  // Verification
  if (includeVerification) {
    steps.push({
      id: `step_verify_${stepOrder}`,
      order: stepOrder++,
      type: 'assert',
      action: 'assertVisible',
      name: 'Verify success toast',
      description: `Verify "${template.label}" created`,
      selector: '.toastMessage, .slds-notify__content',
      isAssertion: true
    });
  }
  
  return steps;
}

/**
 * Get template by API name
 */
function getTemplate(apiName) {
  return SALESFORCE_TEMPLATES.find(t => t.apiName === apiName);
}

/**
 * Get templates by category
 */
function getTemplatesByCategory(category) {
  return SALESFORCE_TEMPLATES.filter(t => t.category === category);
}

/**
 * Get all template names for display
 */
function getAllTemplateNames() {
  return SALESFORCE_TEMPLATES.map(t => ({
    apiName: t.apiName,
    label: t.label,
    icon: t.icon,
    category: t.category,
    description: t.description,
    requiredFieldCount: t.fields.filter(f => f.required).length,
    totalFieldCount: t.fields.length
  }));
}

/**
 * Check if URL is a Salesforce page
 */
function isSalesforceUrl(url) {
  return url && (
    url.includes('salesforce.com') ||
    url.includes('force.com') ||
    url.includes('lightning.force.com') ||
    url.includes('.my.salesforce.com')
  );
}

/**
 * Detect which Salesforce object the user is on
 */
function detectSalesforceObject(url) {
  if (!isSalesforceUrl(url)) return null;
  
  // Try to detect from URL patterns
  const patterns = [
    { pattern: /\/lightning\/o\/Account\//i, object: 'Account' },
    { pattern: /\/lightning\/o\/Contact\//i, object: 'Contact' },
    { pattern: /\/lightning\/o\/Lead\//i, object: 'Lead' },
    { pattern: /\/lightning\/o\/Opportunity\//i, object: 'Opportunity' },
    { pattern: /\/lightning\/o\/Case\//i, object: 'Case' },
    { pattern: /\/lightning\/o\/Task\//i, object: 'Task' },
    { pattern: /\/lightning\/o\/Event\//i, object: 'Event' },
    { pattern: /\/lightning\/o\/Campaign\//i, object: 'Campaign' },
  ];
  
  for (const { pattern, object } of patterns) {
    if (pattern.test(url)) {
      return object;
    }
  }
  
  return null;
}

// Export for use in extension
if (typeof window !== 'undefined') {
  window.SalesforceTemplates = {
    TEMPLATES: SALESFORCE_TEMPLATES,
    SMART_FILL_TYPES: SALESFORCE_SMART_FILL_TYPES,
    getTemplate,
    getTemplatesByCategory,
    getAllTemplateNames,
    generateTestDataForTemplate,
    regenerateFieldValue,
    templateToSteps,
    isSalesforceUrl,
    detectSalesforceObject
  };
}




