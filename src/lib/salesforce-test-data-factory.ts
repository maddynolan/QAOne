/**
 * Salesforce Test Data Factory
 * 
 * Advanced test data generation specifically for Salesforce objects.
 * Supports:
 * - All standard objects (Account, Contact, Lead, Opportunity, Case, etc.)
 * - Custom objects
 * - Relationship handling (Master-Detail, Lookup)
 * - Industry-specific data (Healthcare, Finance, Retail, etc.)
 * - Configurable data volume
 * - Smart picklist value selection
 * - Realistic data patterns
 */

// ============================================================================
// TYPES
// ============================================================================

export interface FieldDefinition {
  name: string;
  label: string;
  type: 'string' | 'email' | 'phone' | 'url' | 'number' | 'currency' | 'percent' | 'date' | 'datetime' | 'boolean' | 'picklist' | 'multipicklist' | 'reference' | 'textarea' | 'address' | 'id';
  required?: boolean;
  maxLength?: number;
  precision?: number;
  scale?: number;
  picklistValues?: string[];
  referenceTo?: string;
  defaultValue?: any;
  pattern?: string;
  industry?: string[];
}

export interface ObjectTemplate {
  apiName: string;
  label: string;
  labelPlural: string;
  description: string;
  fields: FieldDefinition[];
  childRelationships?: { object: string; field: string; }[];
  recordTypes?: string[];
}

export interface DataGenerationConfig {
  objectName: string;
  count: number;
  industry?: 'healthcare' | 'finance' | 'retail' | 'technology' | 'manufacturing' | 'generic';
  includeRelated?: boolean;
  relatedCounts?: { [objectName: string]: number };
  customValues?: { [fieldName: string]: any };
  recordType?: string;
}

export interface GeneratedRecord {
  object: string;
  data: { [key: string]: any };
  relatedRecords?: GeneratedRecord[];
}

// ============================================================================
// DATA PATTERNS
// ============================================================================

const COMPANY_NAMES = [
  'Acme Corporation', 'GlobalTech Solutions', 'Pinnacle Industries', 'Summit Enterprises',
  'Horizon Partners', 'Nexus Technologies', 'Vertex Systems', 'Catalyst Group',
  'Momentum Consulting', 'Apex Dynamics', 'Stellar Innovations', 'Quantum Analytics',
  'Fusion Networks', 'Prism Technologies', 'Eclipse Software', 'Vanguard Industries',
  'Titan Corporation', 'Nova Solutions', 'Atlas Group', 'Zenith Partners'
];

const FIRST_NAMES = [
  'James', 'Mary', 'John', 'Patricia', 'Robert', 'Jennifer', 'Michael', 'Linda',
  'William', 'Elizabeth', 'David', 'Barbara', 'Richard', 'Susan', 'Joseph', 'Jessica',
  'Thomas', 'Sarah', 'Charles', 'Karen', 'Christopher', 'Nancy', 'Daniel', 'Lisa',
  'Matthew', 'Betty', 'Anthony', 'Margaret', 'Mark', 'Sandra', 'Donald', 'Ashley',
  'Steven', 'Kimberly', 'Paul', 'Emily', 'Andrew', 'Donna', 'Joshua', 'Michelle'
];

const LAST_NAMES = [
  'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis',
  'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson',
  'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin', 'Lee', 'Perez', 'Thompson',
  'White', 'Harris', 'Sanchez', 'Clark', 'Ramirez', 'Lewis', 'Robinson', 'Walker',
  'Young', 'Allen', 'King', 'Wright', 'Scott', 'Torres', 'Nguyen', 'Hill', 'Flores'
];

const STREETS = [
  'Main Street', 'Oak Avenue', 'Park Road', 'Cedar Lane', 'Maple Drive',
  'Washington Boulevard', 'Lincoln Way', 'Jefferson Street', 'Madison Avenue',
  'Market Street', 'Broadway', 'Industrial Drive', 'Commerce Way', 'Tech Park Drive',
  'Innovation Boulevard', 'Enterprise Way', 'Business Center Drive', 'Corporate Plaza'
];

// City-State pairs to ensure valid combinations for State/Country picklists
const CITY_STATE_PAIRS = [
  { city: 'San Francisco', state: 'CA' },
  { city: 'Los Angeles', state: 'CA' },
  { city: 'San Diego', state: 'CA' },
  { city: 'New York', state: 'NY' },
  { city: 'Chicago', state: 'IL' },
  { city: 'Houston', state: 'TX' },
  { city: 'Dallas', state: 'TX' },
  { city: 'Austin', state: 'TX' },
  { city: 'San Antonio', state: 'TX' },
  { city: 'Phoenix', state: 'AZ' },
  { city: 'Philadelphia', state: 'PA' },
  { city: 'Seattle', state: 'WA' },
  { city: 'Denver', state: 'CO' },
  { city: 'Boston', state: 'MA' },
  { city: 'Atlanta', state: 'GA' },
  { city: 'Miami', state: 'FL' },
  { city: 'Detroit', state: 'MI' },
  { city: 'Minneapolis', state: 'MN' },
  { city: 'Portland', state: 'OR' },
];

const CITIES = CITY_STATE_PAIRS.map(p => p.city);
const STATES = [...new Set(CITY_STATE_PAIRS.map(p => p.state))];

const INDUSTRIES = [
  'Technology', 'Healthcare', 'Finance', 'Manufacturing', 'Retail', 'Education',
  'Energy', 'Real Estate', 'Transportation', 'Telecommunications', 'Media',
  'Hospitality', 'Construction', 'Agriculture', 'Government', 'Nonprofit'
];

const LEAD_SOURCES = [
  'Web', 'Phone Inquiry', 'Partner Referral', 'Purchased List', 'Trade Show',
  'Employee Referral', 'External Referral', 'Public Relations', 'Direct Mail',
  'Social Media', 'Advertisement', 'Webinar', 'Other'
];

const CASE_REASONS = [
  'Installation', 'Equipment Complexity', 'Performance', 'Breakdown',
  'Equipment Design', 'Feedback', 'Other'
];

const CASE_TYPES = ['Problem', 'Feature Request', 'Question'];

const CASE_PRIORITIES = ['Low', 'Medium', 'High'];

const OPPORTUNITY_STAGES = [
  'Prospecting', 'Qualification', 'Needs Analysis', 'Value Proposition',
  'Id. Decision Makers', 'Perception Analysis', 'Proposal/Price Quote',
  'Negotiation/Review', 'Closed Won', 'Closed Lost'
];

const OPPORTUNITY_TYPES = ['Existing Customer - Upgrade', 'Existing Customer - Replacement', 'Existing Customer - Downgrade', 'New Customer'];

// Industry-specific data
const HEALTHCARE_DATA = {
  companies: ['HealthFirst Medical', 'MedTech Solutions', 'CarePoint Systems', 'BioLife Labs', 'Wellness Partners'],
  titles: ['Chief Medical Officer', 'Director of Nursing', 'Healthcare Administrator', 'Clinical Director', 'Medical Director'],
  products: ['Medical Equipment', 'Healthcare Software', 'Diagnostic Tools', 'Patient Monitoring', 'Telehealth Platform']
};

const FINANCE_DATA = {
  companies: ['Capital Investments', 'Wealth Advisory Group', 'Financial Solutions Inc', 'Asset Management Corp', 'Investment Partners'],
  titles: ['Portfolio Manager', 'Financial Advisor', 'Investment Analyst', 'Risk Manager', 'CFO'],
  products: ['Investment Platform', 'Risk Management', 'Trading Software', 'Compliance Tools', 'Financial Analytics']
};

const TECHNOLOGY_DATA = {
  companies: ['CloudTech Systems', 'DataDriven Inc', 'AI Solutions', 'CyberSecure Corp', 'DevOps Partners'],
  titles: ['CTO', 'VP Engineering', 'Software Architect', 'DevOps Manager', 'IT Director'],
  products: ['Cloud Platform', 'SaaS Solution', 'Enterprise Software', 'Security Suite', 'Data Analytics']
};

// ============================================================================
// STANDARD OBJECT TEMPLATES
// ============================================================================

export const STANDARD_OBJECT_TEMPLATES: ObjectTemplate[] = [
  {
    apiName: 'Account',
    label: 'Account',
    labelPlural: 'Accounts',
    description: 'Organization or company you do business with',
    fields: [
      { name: 'Name', label: 'Account Name', type: 'string', required: true, maxLength: 255 },
      { name: 'Type', label: 'Type', type: 'picklist', picklistValues: ['Prospect', 'Customer - Direct', 'Customer - Channel', 'Channel Partner / Reseller', 'Installation Partner', 'Technology Partner', 'Other'] },
      { name: 'Industry', label: 'Industry', type: 'picklist', picklistValues: INDUSTRIES },
      { name: 'AnnualRevenue', label: 'Annual Revenue', type: 'currency' },
      { name: 'NumberOfEmployees', label: 'Employees', type: 'number' },
      { name: 'Phone', label: 'Phone', type: 'phone' },
      { name: 'Fax', label: 'Fax', type: 'phone' },
      { name: 'Website', label: 'Website', type: 'url' },
      { name: 'Description', label: 'Description', type: 'textarea' },
      { name: 'BillingStreet', label: 'Billing Street', type: 'string' },
      { name: 'BillingCity', label: 'Billing City', type: 'string' },
      { name: 'BillingState', label: 'Billing State', type: 'string' },
      { name: 'BillingPostalCode', label: 'Billing Postal Code', type: 'string' },
      { name: 'BillingCountry', label: 'Billing Country', type: 'string' },
      { name: 'ShippingStreet', label: 'Shipping Street', type: 'string' },
      { name: 'ShippingCity', label: 'Shipping City', type: 'string' },
      { name: 'ShippingState', label: 'Shipping State', type: 'string' },
      { name: 'ShippingPostalCode', label: 'Shipping Postal Code', type: 'string' },
      { name: 'ShippingCountry', label: 'Shipping Country', type: 'string' },
      { name: 'Rating', label: 'Rating', type: 'picklist', picklistValues: ['Hot', 'Warm', 'Cold'] },
      { name: 'Ownership', label: 'Ownership', type: 'picklist', picklistValues: ['Public', 'Private', 'Subsidiary', 'Other'] },
      { name: 'AccountSource', label: 'Account Source', type: 'picklist', picklistValues: LEAD_SOURCES },
    ],
    childRelationships: [
      { object: 'Contact', field: 'AccountId' },
      { object: 'Opportunity', field: 'AccountId' },
      { object: 'Case', field: 'AccountId' },
    ]
  },
  {
    apiName: 'Contact',
    label: 'Contact',
    labelPlural: 'Contacts',
    description: 'Individual associated with an account',
    fields: [
      { name: 'FirstName', label: 'First Name', type: 'string', maxLength: 40 },
      { name: 'LastName', label: 'Last Name', type: 'string', required: true, maxLength: 80 },
      { name: 'AccountId', label: 'Account', type: 'reference', referenceTo: 'Account' },
      { name: 'Title', label: 'Title', type: 'string', maxLength: 128 },
      { name: 'Department', label: 'Department', type: 'string', maxLength: 80 },
      { name: 'Email', label: 'Email', type: 'email' },
      { name: 'Phone', label: 'Phone', type: 'phone' },
      { name: 'MobilePhone', label: 'Mobile', type: 'phone' },
      { name: 'Fax', label: 'Fax', type: 'phone' },
      { name: 'MailingStreet', label: 'Mailing Street', type: 'string' },
      { name: 'MailingCity', label: 'Mailing City', type: 'string' },
      { name: 'MailingState', label: 'Mailing State', type: 'string' },
      { name: 'MailingPostalCode', label: 'Mailing Postal Code', type: 'string' },
      { name: 'MailingCountry', label: 'Mailing Country', type: 'string' },
      { name: 'Birthdate', label: 'Birthdate', type: 'date' },
      { name: 'Description', label: 'Description', type: 'textarea' },
      { name: 'LeadSource', label: 'Lead Source', type: 'picklist', picklistValues: LEAD_SOURCES },
    ]
  },
  {
    apiName: 'Lead',
    label: 'Lead',
    labelPlural: 'Leads',
    description: 'Prospective customer or sales opportunity',
    fields: [
      { name: 'FirstName', label: 'First Name', type: 'string', maxLength: 40 },
      { name: 'LastName', label: 'Last Name', type: 'string', required: true, maxLength: 80 },
      { name: 'Company', label: 'Company', type: 'string', required: true, maxLength: 255 },
      { name: 'Title', label: 'Title', type: 'string', maxLength: 128 },
      { name: 'Email', label: 'Email', type: 'email' },
      { name: 'Phone', label: 'Phone', type: 'phone' },
      { name: 'MobilePhone', label: 'Mobile', type: 'phone' },
      { name: 'Website', label: 'Website', type: 'url' },
      { name: 'Street', label: 'Street', type: 'string' },
      { name: 'City', label: 'City', type: 'string' },
      { name: 'State', label: 'State', type: 'string' },
      { name: 'PostalCode', label: 'Postal Code', type: 'string' },
      { name: 'Country', label: 'Country', type: 'string' },
      { name: 'Status', label: 'Status', type: 'picklist', required: true, picklistValues: ['Open - Not Contacted', 'Working - Contacted', 'Closed - Converted', 'Closed - Not Converted'] },
      { name: 'LeadSource', label: 'Lead Source', type: 'picklist', picklistValues: LEAD_SOURCES },
      { name: 'Industry', label: 'Industry', type: 'picklist', picklistValues: INDUSTRIES },
      { name: 'AnnualRevenue', label: 'Annual Revenue', type: 'currency' },
      { name: 'NumberOfEmployees', label: 'Employees', type: 'number' },
      { name: 'Rating', label: 'Rating', type: 'picklist', picklistValues: ['Hot', 'Warm', 'Cold'] },
      { name: 'Description', label: 'Description', type: 'textarea' },
    ]
  },
  {
    apiName: 'Opportunity',
    label: 'Opportunity',
    labelPlural: 'Opportunities',
    description: 'Potential revenue-generating event',
    fields: [
      { name: 'Name', label: 'Opportunity Name', type: 'string', required: true, maxLength: 120 },
      { name: 'AccountId', label: 'Account', type: 'reference', referenceTo: 'Account' },
      { name: 'Amount', label: 'Amount', type: 'currency' },
      { name: 'CloseDate', label: 'Close Date', type: 'date', required: true },
      { name: 'StageName', label: 'Stage', type: 'picklist', required: true, picklistValues: OPPORTUNITY_STAGES },
      { name: 'Probability', label: 'Probability (%)', type: 'percent' },
      { name: 'Type', label: 'Type', type: 'picklist', picklistValues: OPPORTUNITY_TYPES },
      { name: 'LeadSource', label: 'Lead Source', type: 'picklist', picklistValues: LEAD_SOURCES },
      { name: 'NextStep', label: 'Next Step', type: 'string', maxLength: 255 },
      { name: 'Description', label: 'Description', type: 'textarea' },
      { name: 'ForecastCategoryName', label: 'Forecast Category', type: 'picklist', picklistValues: ['Omitted', 'Pipeline', 'Best Case', 'Commit', 'Closed'] },
    ]
  },
  {
    apiName: 'Case',
    label: 'Case',
    labelPlural: 'Cases',
    description: 'Customer issue or feedback',
    fields: [
      { name: 'Subject', label: 'Subject', type: 'string', maxLength: 255 },
      { name: 'AccountId', label: 'Account', type: 'reference', referenceTo: 'Account' },
      { name: 'ContactId', label: 'Contact', type: 'reference', referenceTo: 'Contact' },
      { name: 'Status', label: 'Status', type: 'picklist', required: true, picklistValues: ['New', 'Working', 'Escalated', 'Closed'] },
      { name: 'Priority', label: 'Priority', type: 'picklist', picklistValues: CASE_PRIORITIES },
      { name: 'Origin', label: 'Case Origin', type: 'picklist', picklistValues: ['Phone', 'Email', 'Web'] },
      { name: 'Type', label: 'Type', type: 'picklist', picklistValues: CASE_TYPES },
      { name: 'Reason', label: 'Case Reason', type: 'picklist', picklistValues: CASE_REASONS },
      { name: 'Description', label: 'Description', type: 'textarea' },
      { name: 'SuppliedName', label: 'Name', type: 'string', maxLength: 80 },
      { name: 'SuppliedEmail', label: 'Email', type: 'email' },
      { name: 'SuppliedPhone', label: 'Phone', type: 'phone' },
      { name: 'SuppliedCompany', label: 'Company', type: 'string', maxLength: 80 },
    ]
  },
  {
    apiName: 'Task',
    label: 'Task',
    labelPlural: 'Tasks',
    description: 'Action item or to-do',
    fields: [
      { name: 'Subject', label: 'Subject', type: 'picklist', required: true, picklistValues: ['Call', 'Email', 'Send Letter', 'Send Quote', 'Other'] },
      { name: 'WhoId', label: 'Name', type: 'reference', referenceTo: 'Contact,Lead' },
      { name: 'WhatId', label: 'Related To', type: 'reference', referenceTo: 'Account,Opportunity,Case' },
      { name: 'ActivityDate', label: 'Due Date', type: 'date' },
      { name: 'Status', label: 'Status', type: 'picklist', required: true, picklistValues: ['Not Started', 'In Progress', 'Completed', 'Waiting on someone else', 'Deferred'] },
      { name: 'Priority', label: 'Priority', type: 'picklist', picklistValues: ['Low', 'Normal', 'High'] },
      { name: 'Description', label: 'Comments', type: 'textarea' },
    ]
  },
  {
    apiName: 'Event',
    label: 'Event',
    labelPlural: 'Events',
    description: 'Calendar event or meeting',
    fields: [
      { name: 'Subject', label: 'Subject', type: 'picklist', required: true, picklistValues: ['Call', 'Meeting', 'Email', 'Other'] },
      { name: 'WhoId', label: 'Name', type: 'reference', referenceTo: 'Contact,Lead' },
      { name: 'WhatId', label: 'Related To', type: 'reference', referenceTo: 'Account,Opportunity,Case' },
      { name: 'StartDateTime', label: 'Start', type: 'datetime', required: true },
      { name: 'EndDateTime', label: 'End', type: 'datetime', required: true },
      { name: 'Location', label: 'Location', type: 'string', maxLength: 255 },
      { name: 'Description', label: 'Description', type: 'textarea' },
      { name: 'IsAllDayEvent', label: 'All-Day Event', type: 'boolean' },
    ]
  },
  {
    apiName: 'Campaign',
    label: 'Campaign',
    labelPlural: 'Campaigns',
    description: 'Marketing campaign',
    fields: [
      { name: 'Name', label: 'Campaign Name', type: 'string', required: true, maxLength: 80 },
      { name: 'Type', label: 'Type', type: 'picklist', picklistValues: ['Conference', 'Webinar', 'Trade Show', 'Public Relations', 'Partners', 'Referral Program', 'Advertisement', 'Banner Ads', 'Direct Mail', 'Email', 'Telemarketing', 'Other'] },
      { name: 'Status', label: 'Status', type: 'picklist', picklistValues: ['Planned', 'In Progress', 'Completed', 'Aborted'] },
      { name: 'StartDate', label: 'Start Date', type: 'date' },
      { name: 'EndDate', label: 'End Date', type: 'date' },
      { name: 'BudgetedCost', label: 'Budgeted Cost', type: 'currency' },
      { name: 'ActualCost', label: 'Actual Cost', type: 'currency' },
      { name: 'ExpectedRevenue', label: 'Expected Revenue', type: 'currency' },
      { name: 'ExpectedResponse', label: 'Expected Response (%)', type: 'percent' },
      { name: 'NumberSent', label: 'Num Sent', type: 'number' },
      { name: 'Description', label: 'Description', type: 'textarea' },
      { name: 'IsActive', label: 'Active', type: 'boolean' },
    ]
  },
  {
    apiName: 'Product2',
    label: 'Product',
    labelPlural: 'Products',
    description: 'Product or service you sell',
    fields: [
      { name: 'Name', label: 'Product Name', type: 'string', required: true, maxLength: 255 },
      { name: 'ProductCode', label: 'Product Code', type: 'string', maxLength: 255 },
      { name: 'Description', label: 'Product Description', type: 'textarea' },
      { name: 'Family', label: 'Product Family', type: 'picklist', picklistValues: ['Hardware', 'Software', 'Service', 'Support', 'Training'] },
      { name: 'IsActive', label: 'Active', type: 'boolean' },
    ]
  },
  {
    apiName: 'Contract',
    label: 'Contract',
    labelPlural: 'Contracts',
    description: 'Agreement with customer',
    fields: [
      { name: 'AccountId', label: 'Account', type: 'reference', required: true, referenceTo: 'Account' },
      { name: 'Status', label: 'Status', type: 'picklist', picklistValues: ['Draft', 'In Approval Process', 'Activated', 'Terminated', 'Expired'] },
      { name: 'StartDate', label: 'Contract Start Date', type: 'date' },
      { name: 'ContractTerm', label: 'Contract Term (months)', type: 'number' },
      { name: 'Description', label: 'Description', type: 'textarea' },
      { name: 'BillingStreet', label: 'Billing Street', type: 'string' },
      { name: 'BillingCity', label: 'Billing City', type: 'string' },
      { name: 'BillingState', label: 'Billing State', type: 'string' },
      { name: 'BillingPostalCode', label: 'Billing Postal Code', type: 'string' },
      { name: 'BillingCountry', label: 'Billing Country', type: 'string' },
    ]
  }
];

// ============================================================================
// DATA GENERATION CLASS
// ============================================================================

export class SalesforceTestDataFactory {
  private usedEmails: Set<string> = new Set();
  private usedPhones: Set<string> = new Set();
  private companyIndex: number = 0;
  private currentCityState: { city: string; state: string } | null = null;
  
  constructor() {
    this.reset();
  }

  reset() {
    this.usedEmails = new Set();
    this.usedPhones = new Set();
    this.companyIndex = 0;
    this.currentCityState = null;
  }
  
  // Get a matched city-state pair (ensures state picklist compatibility)
  private getCityStatePair(): { city: string; state: string } {
    if (!this.currentCityState) {
      this.currentCityState = CITY_STATE_PAIRS[Math.floor(Math.random() * CITY_STATE_PAIRS.length)];
    }
    return this.currentCityState;
  }
  
  // Reset city-state pair for next record
  private resetCityState() {
    this.currentCityState = null;
  }

  // ========== UTILITY FUNCTIONS ==========

  private random(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  private pick<T>(array: T[]): T {
    return array[Math.floor(Math.random() * array.length)];
  }

  private pickMultiple<T>(array: T[], count: number): T[] {
    const shuffled = [...array].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, Math.min(count, array.length));
  }

  private generateUniqueEmail(firstName: string, lastName: string, company: string): string {
    const domains = ['company.com', 'corp.com', 'business.com', 'org.net', 'enterprise.com'];
    const domain = company.toLowerCase().replace(/[^a-z0-9]/g, '') + '.com';
    let email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}@${domain}`;
    let counter = 1;
    while (this.usedEmails.has(email)) {
      email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}${counter}@${domain}`;
      counter++;
    }
    this.usedEmails.add(email);
    return email;
  }

  private generateUniquePhone(): string {
    let phone: string;
    do {
      phone = `(${this.random(200, 999)}) ${this.random(200, 999)}-${this.random(1000, 9999)}`;
    } while (this.usedPhones.has(phone));
    this.usedPhones.add(phone);
    return phone;
  }

  private generatePostalCode(): string {
    return `${this.random(10000, 99999)}`;
  }

  private generateDate(daysFromNow: { min: number; max: number }): string {
    const date = new Date();
    date.setDate(date.getDate() + this.random(daysFromNow.min, daysFromNow.max));
    return date.toISOString().split('T')[0];
  }

  private generateDateTime(daysFromNow: { min: number; max: number }): string {
    const date = new Date();
    date.setDate(date.getDate() + this.random(daysFromNow.min, daysFromNow.max));
    date.setHours(this.random(8, 18), this.random(0, 59), 0, 0);
    return date.toISOString();
  }

  private generateCurrency(min: number, max: number): number {
    return Math.round(this.random(min, max) / 100) * 100;
  }

  // ========== FIELD VALUE GENERATORS ==========

  generateFieldValue(field: FieldDefinition, context: { industry?: string; company?: string } = {}): any {
    switch (field.type) {
      case 'string':
        return this.generateStringValue(field, context);
      case 'email':
        return this.generateUniqueEmail(
          this.pick(FIRST_NAMES),
          this.pick(LAST_NAMES),
          context.company || this.pick(COMPANY_NAMES)
        );
      case 'phone':
        return this.generateUniquePhone();
      case 'url':
        const urlCompany = context.company || this.pick(COMPANY_NAMES);
        return `https://www.${urlCompany.toLowerCase().replace(/[^a-z0-9]/g, '')}.com`;
      case 'number':
        return this.random(1, 10000);
      case 'currency':
        return this.generateCurrency(10000, 10000000);
      case 'percent':
        return this.random(0, 100);
      case 'date':
        return this.generateDate({ min: -30, max: 90 });
      case 'datetime':
        return this.generateDateTime({ min: 0, max: 30 });
      case 'boolean':
        return Math.random() > 0.5;
      case 'picklist':
        if (field.picklistValues && field.picklistValues.length > 0) {
          return this.pick(field.picklistValues);
        }
        return null;
      case 'multipicklist':
        if (field.picklistValues && field.picklistValues.length > 0) {
          return this.pickMultiple(field.picklistValues, this.random(1, 3)).join(';');
        }
        return null;
      case 'textarea':
        return this.generateDescription(field.name);
      case 'reference':
        return null; // Will be filled with actual ID later
      default:
        return null;
    }
  }

  private generateStringValue(field: FieldDefinition, context: { industry?: string; company?: string }): string {
    const name = field.name.toLowerCase();
    
    if (name.includes('name') && name.includes('first')) {
      return this.pick(FIRST_NAMES);
    }
    if (name.includes('name') && name.includes('last')) {
      return this.pick(LAST_NAMES);
    }
    if (name === 'name' || name.includes('accountname') || name.includes('company')) {
      const company = COMPANY_NAMES[this.companyIndex % COMPANY_NAMES.length];
      this.companyIndex++;
      return company;
    }
    if (name.includes('street')) {
      return `${this.random(100, 9999)} ${this.pick(STREETS)}`;
    }
    if (name.includes('city')) {
      return this.getCityStatePair().city;
    }
    if (name.includes('state')) {
      return this.getCityStatePair().state;
    }
    if (name.includes('postal') || name.includes('zip')) {
      return this.generatePostalCode();
    }
    if (name.includes('country')) {
      return 'US'; // Use ISO code for State/Country picklist compatibility
    }
    if (name.includes('title')) {
      const titles = ['CEO', 'CFO', 'CTO', 'VP Sales', 'VP Marketing', 'Director', 'Manager', 'Senior Analyst', 'Consultant'];
      return this.pick(titles);
    }
    if (name.includes('department')) {
      const depts = ['Sales', 'Marketing', 'Engineering', 'Finance', 'Operations', 'HR', 'IT', 'Legal'];
      return this.pick(depts);
    }
    if (name.includes('subject')) {
      return `Follow up on ${context.company || 'opportunity'}`;
    }
    if (name.includes('step') || name.includes('next')) {
      const steps = ['Schedule demo', 'Send proposal', 'Follow up call', 'Technical review', 'Contract negotiation'];
      return this.pick(steps);
    }
    if (name.includes('location')) {
      return `${this.pick(CITIES)}, ${this.pick(STATES)}`;
    }
    
    return `Test ${field.label}`;
  }

  private generateDescription(fieldName: string): string {
    const descriptions = [
      'This is a test record created for demonstration purposes.',
      'Sample data for testing and validation.',
      'Auto-generated test data entry.',
      'Test record to verify system functionality.',
      'Created by automated test data factory.'
    ];
    return this.pick(descriptions);
  }

  // ========== RECORD GENERATORS ==========

  generateRecord(
    template: ObjectTemplate,
    config: Partial<DataGenerationConfig> = {},
    parentRefs: { [objectName: string]: string } = {}
  ): { [key: string]: any } {
    // Reset city-state pair for each new record to ensure consistency
    this.resetCityState();
    
    const record: { [key: string]: any } = {};
    const company = this.pick(COMPANY_NAMES);
    const context = { industry: config.industry, company };

    for (const field of template.fields) {
      // Skip if custom value provided
      if (config.customValues && field.name in config.customValues) {
        record[field.name] = config.customValues[field.name];
        continue;
      }

      // Handle reference fields
      if (field.type === 'reference' && field.referenceTo) {
        const refObjects = field.referenceTo.split(',');
        for (const refObj of refObjects) {
          if (parentRefs[refObj.trim()]) {
            record[field.name] = parentRefs[refObj.trim()];
            break;
          }
        }
        continue;
      }

      // Generate value based on field type
      const value = this.generateFieldValue(field, context);
      if (value !== null) {
        record[field.name] = value;
      }
    }

    return record;
  }

  generateRecords(config: DataGenerationConfig): GeneratedRecord[] {
    this.reset();
    const template = STANDARD_OBJECT_TEMPLATES.find(t => t.apiName === config.objectName);
    if (!template) {
      throw new Error(`Unknown object: ${config.objectName}`);
    }

    const records: GeneratedRecord[] = [];
    for (let i = 0; i < config.count; i++) {
      const data = this.generateRecord(template, config);
      records.push({
        object: config.objectName,
        data,
      });
    }

    return records;
  }

  // ========== RELATED RECORDS ==========

  generateRelatedSet(config: {
    parentObject: string;
    parentCount: number;
    childConfigs: Array<{ object: string; countPerParent: number }>;
    industry?: string;
  }): GeneratedRecord[] {
    this.reset();
    const allRecords: GeneratedRecord[] = [];
    
    // Generate parent records
    const parentTemplate = STANDARD_OBJECT_TEMPLATES.find(t => t.apiName === config.parentObject);
    if (!parentTemplate) {
      throw new Error(`Unknown object: ${config.parentObject}`);
    }

    for (let i = 0; i < config.parentCount; i++) {
      const parentData = this.generateRecord(parentTemplate, { industry: config.industry });
      const parentRecord: GeneratedRecord = {
        object: config.parentObject,
        data: parentData,
        relatedRecords: []
      };

      // Generate child records
      for (const childConfig of config.childConfigs) {
        const childTemplate = STANDARD_OBJECT_TEMPLATES.find(t => t.apiName === childConfig.object);
        if (!childTemplate) continue;

        for (let j = 0; j < childConfig.countPerParent; j++) {
          const childData = this.generateRecord(childTemplate, { industry: config.industry });
          parentRecord.relatedRecords!.push({
            object: childConfig.object,
            data: childData,
          });
        }
      }

      allRecords.push(parentRecord);
    }

    return allRecords;
  }

  // ========== DATA SEEDING TEMPLATES ==========

  getSeedingTemplates(): Array<{
    name: string;
    description: string;
    objects: Array<{ object: string; count: number }>;
  }> {
    return [
      {
        name: 'Sales Pipeline',
        description: 'Accounts with Contacts and Opportunities',
        objects: [
          { object: 'Account', count: 10 },
          { object: 'Contact', count: 30 },
          { object: 'Opportunity', count: 20 },
        ]
      },
      {
        name: 'Service Desk',
        description: 'Accounts with Contacts and Cases',
        objects: [
          { object: 'Account', count: 5 },
          { object: 'Contact', count: 15 },
          { object: 'Case', count: 25 },
        ]
      },
      {
        name: 'Marketing Campaigns',
        description: 'Campaigns with Leads',
        objects: [
          { object: 'Campaign', count: 5 },
          { object: 'Lead', count: 50 },
        ]
      },
      {
        name: 'Full CRM',
        description: 'Complete CRM data set',
        objects: [
          { object: 'Account', count: 20 },
          { object: 'Contact', count: 60 },
          { object: 'Lead', count: 30 },
          { object: 'Opportunity', count: 40 },
          { object: 'Case', count: 25 },
          { object: 'Task', count: 50 },
          { object: 'Event', count: 30 },
          { object: 'Campaign', count: 10 },
        ]
      },
      {
        name: 'Minimal Test Set',
        description: 'Small data set for quick testing',
        objects: [
          { object: 'Account', count: 3 },
          { object: 'Contact', count: 5 },
          { object: 'Opportunity', count: 3 },
        ]
      },
    ];
  }

  // ========== SCHEMA-AWARE DATA GENERATION ==========
  
  // Fields to ALWAYS skip - these cause validation issues
  private readonly ALWAYS_SKIP_FIELDS = new Set([
    // Address fields with State/Country picklists
    'BillingStateCode', 'BillingCountryCode', 'BillingState', 'BillingCountry',
    'BillingStreet', 'BillingCity', 'BillingPostalCode',
    'ShippingStateCode', 'ShippingCountryCode', 'ShippingState', 'ShippingCountry',
    'ShippingStreet', 'ShippingCity', 'ShippingPostalCode',
    'MailingStateCode', 'MailingCountryCode', 'MailingState', 'MailingCountry',
    'MailingStreet', 'MailingCity', 'MailingPostalCode',
    'OtherStateCode', 'OtherCountryCode', 'OtherState', 'OtherCountry',
    'OtherStreet', 'OtherCity', 'OtherPostalCode',
    // Geo fields
    'BillingLatitude', 'BillingLongitude', 'BillingGeocodeAccuracy',
    'ShippingLatitude', 'ShippingLongitude', 'ShippingGeocodeAccuracy',
    'MailingLatitude', 'MailingLongitude', 'MailingGeocodeAccuracy',
    'OtherLatitude', 'OtherLongitude',
    // Numeric fields with strict limits
    'NumberOfLocations', 'NumberOfEmployees', 'AnnualRevenue',
    // Other problematic fields
    'PhotoUrl', 'Jigsaw', 'CleanStatus', 'DunsNumber', 'NaicsCode',
    'NaicsDesc', 'YearStarted', 'SicDesc', 'DandbCompanyId', 'OperatingHoursId',
    'Sic', 'TickerSymbol', 'Tradestyle', 'Site',
    // Compound address field
    'BillingAddress', 'ShippingAddress', 'MailingAddress', 'OtherAddress',
    // External IDs and system fields
    'JigsawCompanyId', 'AccountNumber', 'DandBCompanyId',
  ]);

  /**
   * Generate records using live schema metadata from Salesforce
   * This ensures picklist values, state/country codes, and field constraints are valid
   */
  generateRecordsWithSchema(
    objectName: string,
    count: number,
    schemaFields: Array<{
      name: string;
      type: string;
      picklistValues?: Array<{ value: string; label: string; active: boolean }>;
      referenceTo?: string[];
      required?: boolean;
      createable?: boolean;
      maxLength?: number;
      defaultValue?: any;
    }>,
    customValues?: { [fieldName: string]: any }
  ): GeneratedRecord[] {
    this.reset();
    const records: GeneratedRecord[] = [];
    
    // Build picklist value map for quick lookup
    const picklistMap: { [fieldName: string]: string[] } = {};
    for (const field of schemaFields) {
      if (field.picklistValues && field.picklistValues.length > 0) {
        const activeValues = field.picklistValues
          .filter(pv => pv.active)
          .map(pv => pv.value);
        if (activeValues.length > 0) {
          picklistMap[field.name] = activeValues;
        }
      }
    }
    
    console.log('Schema picklist map:', Object.keys(picklistMap));
    console.log('Fields to skip:', Array.from(this.ALWAYS_SKIP_FIELDS));
    
    for (let i = 0; i < count; i++) {
      this.resetCityState();
      const record: { [key: string]: any } = {};
      
      for (const field of schemaFields) {
        // Skip non-createable fields
        if (field.createable === false) continue;
        
        // Skip Id and system fields
        if (field.name === 'Id' || field.name.endsWith('__pc')) continue;
        
        // ALWAYS skip problematic fields - no exceptions
        if (this.ALWAYS_SKIP_FIELDS.has(field.name)) {
          continue;
        }
        
        // Double-check: skip ANY field with problematic keywords
        const lowerName = field.name.toLowerCase();
        if (lowerName.includes('state') || lowerName.includes('country') || 
            lowerName.includes('street') || lowerName.includes('city') || 
            lowerName.includes('postal') || lowerName.includes('address') ||
            lowerName.includes('billing') || lowerName.includes('shipping') ||
            lowerName.includes('mailing') || lowerName.includes('geocode') ||
            lowerName.includes('latitude') || lowerName.includes('longitude') ||
            lowerName.includes('numberof') || lowerName.includes('annualrevenue') ||
            lowerName.includes('jigsaw') || lowerName.includes('dandb') ||
            lowerName.includes('duns') || lowerName.includes('naics') ||
            lowerName.includes('sic')) {
          continue;
        }
        
        // Use custom value if provided
        if (customValues && field.name in customValues) {
          record[field.name] = customValues[field.name];
          continue;
        }
        
        // Generate value based on field type and metadata
        const value = this.generateSchemaAwareValue(field, picklistMap);
        if (value !== null && value !== undefined) {
          record[field.name] = value;
        }
      }
      
      // Log first record's fields for debugging
      if (i === 0) {
        console.log('Generated record fields:', Object.keys(record));
      }
      
      records.push({ object: objectName, data: record });
    }
    
    return records;
  }
  
  private generateSchemaAwareValue(
    field: {
      name: string;
      type: string;
      picklistValues?: Array<{ value: string; label: string; active: boolean }>;
      maxLength?: number;
    },
    picklistMap: { [fieldName: string]: string[] }
  ): any {
    const name = field.name.toLowerCase();
    const type = field.type.toLowerCase();
    
    // Use picklist values from schema if available
    if (picklistMap[field.name] && picklistMap[field.name].length > 0) {
      return this.pick(picklistMap[field.name]);
    }
    
    // Handle specific field types
    switch (type) {
      case 'string':
      case 'text':
        const strValue = this.generateSchemaStringValue(field.name, field.maxLength);
        return strValue; // May be null for address fields
      
      case 'email':
        return this.generateUniqueEmail(
          this.pick(FIRST_NAMES),
          this.pick(LAST_NAMES),
          this.pick(COMPANY_NAMES)
        );
      
      case 'phone':
        return this.generateUniquePhone();
      
      case 'url':
        return `https://www.example${this.random(1, 999)}.com`;
      
      case 'currency':
        return this.generateCurrency(1000, 100000);
      
      case 'double':
        // Small decimal values for most double fields
        return Math.round(this.random(1, 100) * 100) / 100;
      
      case 'percent':
        return this.random(0, 100);
      
      case 'int':
      case 'integer':
        // Small integers - most SF fields have limits
        return this.random(1, 100);
      
      case 'date':
        return this.generateDate({ min: -30, max: 90 });
      
      case 'datetime':
        return this.generateDateTime({ min: 0, max: 30 });
      
      case 'boolean':
        return Math.random() > 0.5;
      
      case 'textarea':
        return this.generateDescription(field.name);
      
      case 'picklist':
      case 'multipicklist':
        // Already handled above, but in case empty
        return null;
      
      case 'reference':
      case 'id':
        // Skip - needs actual record IDs
        return null;
      
      case 'address':
        // Skip compound fields - individual fields will be populated
        return null;
      
      default:
        return null;
    }
  }
  
  private generateSchemaStringValue(fieldName: string, maxLength?: number): string | null {
    const name = fieldName.toLowerCase();
    let value: string | null = '';
    
    // Skip ALL address-related fields
    if (name.includes('state') || name.includes('country') || name.includes('province') ||
        name.includes('street') || name.includes('city') || name.includes('postal') || 
        name.includes('zip') || name.includes('address')) {
      return null;
    }
    
    // Skip business identifiers
    if (name.includes('sic') || name.includes('ticker') || name.includes('duns') || 
        name.includes('naics') || name.includes('tradestyle')) {
      return null;
    }
    
    if (name.includes('name') && name.includes('first')) {
      value = this.pick(FIRST_NAMES);
    } else if (name.includes('name') && name.includes('last')) {
      value = this.pick(LAST_NAMES);
    } else if (name === 'name' || name.includes('accountname') || name.includes('company')) {
      const company = COMPANY_NAMES[this.companyIndex % COMPANY_NAMES.length];
      this.companyIndex++;
      value = company;
    } else if (name.includes('title')) {
      const titles = ['CEO', 'CFO', 'CTO', 'VP Sales', 'VP Marketing', 'Director', 'Manager'];
      value = this.pick(titles);
    } else if (name.includes('department')) {
      const depts = ['Sales', 'Marketing', 'Engineering', 'Finance', 'Operations', 'HR', 'IT'];
      value = this.pick(depts);
    } else if (name.includes('description')) {
      value = this.generateDescription(fieldName);
    } else if (name.includes('subject')) {
      value = `Follow up - ${new Date().toLocaleDateString()}`;
    } else if (name.includes('website')) {
      value = `https://www.example${this.random(1, 999)}.com`;
    } else {
      value = `Test ${fieldName} ${this.random(1, 9999)}`;
    }
    
    // Truncate to max length if specified
    if (value && maxLength && value.length > maxLength) {
      value = value.slice(0, maxLength);
    }
    
    return value;
  }

  // ========== CSV EXPORT ==========

  recordsToCSV(records: GeneratedRecord[]): string {
    if (records.length === 0) return '';
    
    const allKeys = new Set<string>();
    records.forEach(r => Object.keys(r.data).forEach(k => allKeys.add(k)));
    const headers = Array.from(allKeys);
    
    const rows = records.map(r => 
      headers.map(h => {
        const value = r.data[h];
        if (value === null || value === undefined) return '';
        if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return String(value);
      }).join(',')
    );

    return [headers.join(','), ...rows].join('\n');
  }

  // ========== COMPOSITE REQUEST FORMAT ==========

  toCompositeRequest(records: GeneratedRecord[]): any[] {
    const requests: any[] = [];
    
    const flatRecords = this.flattenRecords(records);
    flatRecords.forEach((record, index) => {
      requests.push({
        method: 'POST',
        url: `/services/data/v59.0/sobjects/${record.object}`,
        referenceId: `ref${index}`,
        body: record.data,
      });
    });

    return requests;
  }

  private flattenRecords(records: GeneratedRecord[]): GeneratedRecord[] {
    const flat: GeneratedRecord[] = [];
    for (const record of records) {
      flat.push({ object: record.object, data: record.data });
      if (record.relatedRecords) {
        flat.push(...this.flattenRecords(record.relatedRecords));
      }
    }
    return flat;
  }
}

// Export singleton instance
export const testDataFactory = new SalesforceTestDataFactory();


