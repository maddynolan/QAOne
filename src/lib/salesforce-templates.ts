/**
 * Salesforce Standard Object Templates
 * 
 * Pre-built test case templates for creating standard Salesforce objects.
 * Each template includes:
 * - Required fields
 * - Common fields
 * - Smart fill type mappings
 * - Step-by-step instructions
 * 
 * Supports: Lightning Experience, Classic, and various Salesforce editions
 */

// ============================================================================
// SALESFORCE FIELD TYPES & SMART FILL MAPPINGS
// ============================================================================

export type SalesforceFieldType = 
  | 'text' | 'textarea' | 'email' | 'phone' | 'url' | 'currency' | 'number' | 'percent'
  | 'date' | 'datetime' | 'checkbox' | 'picklist' | 'multipicklist' | 'lookup' | 'reference'
  | 'address' | 'name' | 'autonumber';

export interface SalesforceField {
  apiName: string;
  label: string;
  type: SalesforceFieldType;
  required: boolean;
  smartFillType: string; // Maps to our synthetic data generator
  defaultValue?: string;
  picklistValues?: string[];
  lookupObject?: string;
  placeholder?: string;
  helpText?: string;
  maxLength?: number;
  // Lightning-specific selectors
  selectors: {
    lightning: string;
    classic?: string;
    lwc?: string;
  };
}

export interface SalesforceObjectTemplate {
  apiName: string;
  label: string;
  pluralLabel: string;
  icon: string;
  description: string;
  category: 'sales' | 'service' | 'marketing' | 'common';
  fields: SalesforceField[];
  // Navigation
  navigationSteps: {
    lightning: string[];
    classic: string[];
    appLauncher?: string;
  };
  // Verification
  verificationSteps: string[];
  // Related objects commonly created with this
  relatedObjects?: string[];
}

// ============================================================================
// SMART FILL TYPE MAPPINGS FOR SALESFORCE
// ============================================================================

export const SALESFORCE_SMART_FILL_TYPES: Record<string, {
  generator: string;
  examples: string[];
  description: string;
}> = {
  // Account-specific
  'accountName': {
    generator: 'company',
    examples: ['Acme Corporation', 'Global Tech Inc', 'Enterprise Solutions LLC'],
    description: 'Company/Organization name'
  },
  'accountType': {
    generator: 'picklist',
    examples: ['Customer - Direct', 'Customer - Channel', 'Partner', 'Prospect'],
    description: 'Account classification'
  },
  'industry': {
    generator: 'picklist',
    examples: ['Technology', 'Healthcare', 'Finance', 'Manufacturing', 'Retail'],
    description: 'Business industry'
  },
  'annualRevenue': {
    generator: 'currency',
    examples: ['1000000', '5000000', '10000000'],
    description: 'Annual revenue in dollars'
  },
  'employees': {
    generator: 'number',
    examples: ['50', '250', '1000', '5000'],
    description: 'Number of employees'
  },
  'website': {
    generator: 'url',
    examples: ['https://www.example.com', 'https://www.company.io'],
    description: 'Company website URL'
  },
  'tickerSymbol': {
    generator: 'text',
    examples: ['ACME', 'GLBL', 'ENTS'],
    description: 'Stock ticker symbol'
  },
  
  // Contact-specific
  'salutation': {
    generator: 'picklist',
    examples: ['Mr.', 'Ms.', 'Mrs.', 'Dr.', 'Prof.'],
    description: 'Name prefix'
  },
  'firstName': {
    generator: 'firstName',
    examples: ['John', 'Jane', 'Michael', 'Sarah'],
    description: 'First name'
  },
  'lastName': {
    generator: 'lastName',
    examples: ['Smith', 'Johnson', 'Williams', 'Brown'],
    description: 'Last name'
  },
  'title': {
    generator: 'jobTitle',
    examples: ['CEO', 'Sales Manager', 'VP of Engineering', 'Director'],
    description: 'Job title'
  },
  'department': {
    generator: 'text',
    examples: ['Sales', 'Marketing', 'Engineering', 'Finance', 'HR'],
    description: 'Department name'
  },
  'birthdate': {
    generator: 'birthDate',
    examples: ['1985-03-15', '1990-07-22', '1978-11-08'],
    description: 'Date of birth'
  },
  
  // Lead-specific
  'leadSource': {
    generator: 'picklist',
    examples: ['Web', 'Phone Inquiry', 'Partner Referral', 'Trade Show', 'Advertisement'],
    description: 'How the lead was acquired'
  },
  'leadStatus': {
    generator: 'picklist',
    examples: ['Open - Not Contacted', 'Working - Contacted', 'Closed - Converted', 'Closed - Not Converted'],
    description: 'Current lead status'
  },
  'rating': {
    generator: 'picklist',
    examples: ['Hot', 'Warm', 'Cold'],
    description: 'Lead quality rating'
  },
  
  // Opportunity-specific
  'opportunityName': {
    generator: 'text',
    examples: ['Enterprise License Deal', 'Q4 Expansion', 'New Business - Acme'],
    description: 'Opportunity name'
  },
  'stageName': {
    generator: 'picklist',
    examples: ['Prospecting', 'Qualification', 'Needs Analysis', 'Proposal/Price Quote', 'Negotiation/Review', 'Closed Won', 'Closed Lost'],
    description: 'Sales stage'
  },
  'amount': {
    generator: 'currency',
    examples: ['25000', '100000', '500000'],
    description: 'Deal amount'
  },
  'probability': {
    generator: 'percent',
    examples: ['10', '25', '50', '75', '90'],
    description: 'Win probability percentage'
  },
  'closeDate': {
    generator: 'futureDate',
    examples: ['2025-03-31', '2025-06-30', '2025-12-31'],
    description: 'Expected close date'
  },
  'forecastCategory': {
    generator: 'picklist',
    examples: ['Pipeline', 'Best Case', 'Commit', 'Closed'],
    description: 'Forecast category'
  },
  
  // Case-specific
  'caseSubject': {
    generator: 'text',
    examples: ['Login Issue', 'Feature Request', 'Billing Question', 'Technical Support'],
    description: 'Case subject line'
  },
  'caseDescription': {
    generator: 'textarea',
    examples: ['Customer reported issue with...', 'Request for assistance with...'],
    description: 'Detailed case description'
  },
  'caseStatus': {
    generator: 'picklist',
    examples: ['New', 'Working', 'Escalated', 'Closed'],
    description: 'Current case status'
  },
  'casePriority': {
    generator: 'picklist',
    examples: ['Low', 'Medium', 'High', 'Critical'],
    description: 'Case priority level'
  },
  'caseOrigin': {
    generator: 'picklist',
    examples: ['Phone', 'Email', 'Web', 'Chat'],
    description: 'How the case was submitted'
  },
  'caseType': {
    generator: 'picklist',
    examples: ['Problem', 'Feature Request', 'Question'],
    description: 'Type of case'
  },
  
  // Address fields
  'street': {
    generator: 'street',
    examples: ['123 Main Street', '456 Oak Avenue', '789 Tech Park Drive'],
    description: 'Street address'
  },
  'city': {
    generator: 'city',
    examples: ['San Francisco', 'New York', 'Austin', 'Seattle'],
    description: 'City name'
  },
  'state': {
    generator: 'state',
    examples: ['CA', 'NY', 'TX', 'WA'],
    description: 'State/Province'
  },
  'postalCode': {
    generator: 'zipCode',
    examples: ['94105', '10001', '78701', '98101'],
    description: 'Postal/ZIP code'
  },
  'country': {
    generator: 'country',
    examples: ['United States', 'Canada', 'United Kingdom'],
    description: 'Country'
  },
  
  // Common fields
  'email': {
    generator: 'email',
    examples: ['john.doe@example.com', 'jane.smith@company.org'],
    description: 'Email address'
  },
  'phone': {
    generator: 'phone',
    examples: ['(415) 555-1234', '(212) 555-5678'],
    description: 'Phone number'
  },
  'mobilePhone': {
    generator: 'phone',
    examples: ['(415) 555-9876', '(212) 555-4321'],
    description: 'Mobile phone number'
  },
  'fax': {
    generator: 'phone',
    examples: ['(415) 555-0000', '(212) 555-0001'],
    description: 'Fax number'
  },
  'description': {
    generator: 'textarea',
    examples: ['Detailed description of the record...'],
    description: 'General description field'
  }
};

// ============================================================================
// STANDARD OBJECT TEMPLATES
// ============================================================================

export const SALESFORCE_TEMPLATES: SalesforceObjectTemplate[] = [
  // ========== ACCOUNT ==========
  {
    apiName: 'Account',
    label: 'Account',
    pluralLabel: 'Accounts',
    icon: '🏢',
    description: 'Create a new Account (Company/Organization)',
    category: 'sales',
    fields: [
      {
        apiName: 'Name',
        label: 'Account Name',
        type: 'text',
        required: true,
        smartFillType: 'accountName',
        maxLength: 255,
        selectors: {
          lightning: 'input[name="Name"], lightning-input[field-name="Name"] input',
          classic: 'input[id*="Name"]',
          lwc: 'lightning-input-field[field-name="Name"] input'
        }
      },
      {
        apiName: 'Type',
        label: 'Type',
        type: 'picklist',
        required: false,
        smartFillType: 'accountType',
        picklistValues: ['Prospect', 'Customer - Direct', 'Customer - Channel', 'Channel Partner / Reseller', 'Installation Partner', 'Technology Partner', 'Other'],
        selectors: {
          lightning: 'lightning-combobox[field-name="Type"], button[name="Type"]',
          classic: 'select[id*="Type"]',
          lwc: 'lightning-combobox[data-field="Type"]'
        }
      },
      {
        apiName: 'Industry',
        label: 'Industry',
        type: 'picklist',
        required: false,
        smartFillType: 'industry',
        picklistValues: ['Agriculture', 'Apparel', 'Banking', 'Biotechnology', 'Chemicals', 'Communications', 'Construction', 'Consulting', 'Education', 'Electronics', 'Energy', 'Engineering', 'Entertainment', 'Environmental', 'Finance', 'Food & Beverage', 'Government', 'Healthcare', 'Hospitality', 'Insurance', 'Machinery', 'Manufacturing', 'Media', 'Not For Profit', 'Recreation', 'Retail', 'Shipping', 'Technology', 'Telecommunications', 'Transportation', 'Utilities', 'Other'],
        selectors: {
          lightning: 'lightning-combobox[field-name="Industry"], button[name="Industry"]',
          classic: 'select[id*="Industry"]',
          lwc: 'lightning-combobox[data-field="Industry"]'
        }
      },
      {
        apiName: 'Phone',
        label: 'Phone',
        type: 'phone',
        required: false,
        smartFillType: 'phone',
        selectors: {
          lightning: 'input[name="Phone"], lightning-input[field-name="Phone"] input',
          classic: 'input[id*="Phone"]',
          lwc: 'lightning-input-field[field-name="Phone"] input'
        }
      },
      {
        apiName: 'Website',
        label: 'Website',
        type: 'url',
        required: false,
        smartFillType: 'website',
        selectors: {
          lightning: 'input[name="Website"], lightning-input[field-name="Website"] input',
          classic: 'input[id*="Website"]',
          lwc: 'lightning-input-field[field-name="Website"] input'
        }
      },
      {
        apiName: 'AnnualRevenue',
        label: 'Annual Revenue',
        type: 'currency',
        required: false,
        smartFillType: 'annualRevenue',
        selectors: {
          lightning: 'input[name="AnnualRevenue"], lightning-input[field-name="AnnualRevenue"] input',
          classic: 'input[id*="AnnualRevenue"]',
          lwc: 'lightning-input-field[field-name="AnnualRevenue"] input'
        }
      },
      {
        apiName: 'NumberOfEmployees',
        label: 'Employees',
        type: 'number',
        required: false,
        smartFillType: 'employees',
        selectors: {
          lightning: 'input[name="NumberOfEmployees"], lightning-input[field-name="NumberOfEmployees"] input',
          classic: 'input[id*="NumberOfEmployees"]',
          lwc: 'lightning-input-field[field-name="NumberOfEmployees"] input'
        }
      },
      {
        apiName: 'Description',
        label: 'Description',
        type: 'textarea',
        required: false,
        smartFillType: 'description',
        selectors: {
          lightning: 'textarea[name="Description"], lightning-textarea[field-name="Description"] textarea',
          classic: 'textarea[id*="Description"]',
          lwc: 'lightning-textarea[data-field="Description"] textarea'
        }
      },
      {
        apiName: 'BillingStreet',
        label: 'Billing Street',
        type: 'text',
        required: false,
        smartFillType: 'street',
        selectors: {
          lightning: 'textarea[name="BillingStreet"], lightning-input-address[field-name="BillingAddress"] input[name="street"]',
          classic: 'textarea[id*="BillingStreet"]',
          lwc: 'lightning-input-address textarea[name="street"]'
        }
      },
      {
        apiName: 'BillingCity',
        label: 'Billing City',
        type: 'text',
        required: false,
        smartFillType: 'city',
        selectors: {
          lightning: 'input[name="BillingCity"], lightning-input-address input[name="city"]',
          classic: 'input[id*="BillingCity"]',
          lwc: 'lightning-input-address input[name="city"]'
        }
      },
      {
        apiName: 'BillingState',
        label: 'Billing State/Province',
        type: 'text',
        required: false,
        smartFillType: 'state',
        selectors: {
          lightning: 'input[name="BillingState"], lightning-input-address input[name="province"]',
          classic: 'input[id*="BillingState"]',
          lwc: 'lightning-input-address input[name="province"]'
        }
      },
      {
        apiName: 'BillingPostalCode',
        label: 'Billing Zip/Postal Code',
        type: 'text',
        required: false,
        smartFillType: 'postalCode',
        selectors: {
          lightning: 'input[name="BillingPostalCode"], lightning-input-address input[name="postalCode"]',
          classic: 'input[id*="BillingPostalCode"]',
          lwc: 'lightning-input-address input[name="postalCode"]'
        }
      },
      {
        apiName: 'BillingCountry',
        label: 'Billing Country',
        type: 'text',
        required: false,
        smartFillType: 'country',
        selectors: {
          lightning: 'input[name="BillingCountry"], lightning-input-address input[name="country"]',
          classic: 'input[id*="BillingCountry"]',
          lwc: 'lightning-input-address input[name="country"]'
        }
      }
    ],
    navigationSteps: {
      lightning: [
        'Click App Launcher (9 dots icon)',
        'Search for "Accounts"',
        'Click "Accounts" from results',
        'Click "New" button'
      ],
      classic: [
        'Click "Accounts" tab',
        'Click "New" button'
      ],
      appLauncher: 'Accounts'
    },
    verificationSteps: [
      'Verify Account Name appears in the header',
      'Verify toast message "Account was created"',
      'Verify record detail page displays'
    ],
    relatedObjects: ['Contact', 'Opportunity', 'Case']
  },

  // ========== CONTACT ==========
  {
    apiName: 'Contact',
    label: 'Contact',
    pluralLabel: 'Contacts',
    icon: '👤',
    description: 'Create a new Contact (Individual Person)',
    category: 'sales',
    fields: [
      {
        apiName: 'Salutation',
        label: 'Salutation',
        type: 'picklist',
        required: false,
        smartFillType: 'salutation',
        picklistValues: ['Mr.', 'Ms.', 'Mrs.', 'Dr.', 'Prof.'],
        selectors: {
          lightning: 'lightning-combobox[field-name="Salutation"], button[name="Salutation"]',
          classic: 'select[id*="Salutation"]',
          lwc: 'lightning-combobox[data-field="Salutation"]'
        }
      },
      {
        apiName: 'FirstName',
        label: 'First Name',
        type: 'text',
        required: false,
        smartFillType: 'firstName',
        selectors: {
          lightning: 'input[name="firstName"], lightning-input[field-name="FirstName"] input',
          classic: 'input[id*="firstName"]',
          lwc: 'lightning-input-field[field-name="FirstName"] input'
        }
      },
      {
        apiName: 'LastName',
        label: 'Last Name',
        type: 'text',
        required: true,
        smartFillType: 'lastName',
        selectors: {
          lightning: 'input[name="lastName"], lightning-input[field-name="LastName"] input',
          classic: 'input[id*="lastName"]',
          lwc: 'lightning-input-field[field-name="LastName"] input'
        }
      },
      {
        apiName: 'AccountId',
        label: 'Account',
        type: 'lookup',
        required: false,
        smartFillType: 'lookup',
        lookupObject: 'Account',
        selectors: {
          lightning: 'lightning-input-field[field-name="AccountId"] input, lightning-grouped-combobox input',
          classic: 'input[id*="Account"]',
          lwc: 'lightning-lookup[field-name="AccountId"] input'
        }
      },
      {
        apiName: 'Title',
        label: 'Title',
        type: 'text',
        required: false,
        smartFillType: 'title',
        selectors: {
          lightning: 'input[name="Title"], lightning-input[field-name="Title"] input',
          classic: 'input[id*="Title"]',
          lwc: 'lightning-input-field[field-name="Title"] input'
        }
      },
      {
        apiName: 'Department',
        label: 'Department',
        type: 'text',
        required: false,
        smartFillType: 'department',
        selectors: {
          lightning: 'input[name="Department"], lightning-input[field-name="Department"] input',
          classic: 'input[id*="Department"]',
          lwc: 'lightning-input-field[field-name="Department"] input'
        }
      },
      {
        apiName: 'Email',
        label: 'Email',
        type: 'email',
        required: false,
        smartFillType: 'email',
        selectors: {
          lightning: 'input[name="Email"], lightning-input[field-name="Email"] input',
          classic: 'input[id*="Email"]',
          lwc: 'lightning-input-field[field-name="Email"] input'
        }
      },
      {
        apiName: 'Phone',
        label: 'Phone',
        type: 'phone',
        required: false,
        smartFillType: 'phone',
        selectors: {
          lightning: 'input[name="Phone"], lightning-input[field-name="Phone"] input',
          classic: 'input[id*="Phone"]',
          lwc: 'lightning-input-field[field-name="Phone"] input'
        }
      },
      {
        apiName: 'MobilePhone',
        label: 'Mobile',
        type: 'phone',
        required: false,
        smartFillType: 'mobilePhone',
        selectors: {
          lightning: 'input[name="MobilePhone"], lightning-input[field-name="MobilePhone"] input',
          classic: 'input[id*="MobilePhone"]',
          lwc: 'lightning-input-field[field-name="MobilePhone"] input'
        }
      },
      {
        apiName: 'Birthdate',
        label: 'Birthdate',
        type: 'date',
        required: false,
        smartFillType: 'birthdate',
        selectors: {
          lightning: 'input[name="Birthdate"], lightning-input[field-name="Birthdate"] input',
          classic: 'input[id*="Birthdate"]',
          lwc: 'lightning-input-field[field-name="Birthdate"] input'
        }
      },
      {
        apiName: 'MailingStreet',
        label: 'Mailing Street',
        type: 'text',
        required: false,
        smartFillType: 'street',
        selectors: {
          lightning: 'textarea[name="MailingStreet"], lightning-input-address input[name="street"]',
          classic: 'textarea[id*="MailingStreet"]',
          lwc: 'lightning-input-address textarea[name="street"]'
        }
      },
      {
        apiName: 'MailingCity',
        label: 'Mailing City',
        type: 'text',
        required: false,
        smartFillType: 'city',
        selectors: {
          lightning: 'input[name="MailingCity"], lightning-input-address input[name="city"]',
          classic: 'input[id*="MailingCity"]',
          lwc: 'lightning-input-address input[name="city"]'
        }
      },
      {
        apiName: 'MailingState',
        label: 'Mailing State/Province',
        type: 'text',
        required: false,
        smartFillType: 'state',
        selectors: {
          lightning: 'input[name="MailingState"], lightning-input-address input[name="province"]',
          classic: 'input[id*="MailingState"]',
          lwc: 'lightning-input-address input[name="province"]'
        }
      },
      {
        apiName: 'MailingPostalCode',
        label: 'Mailing Zip/Postal Code',
        type: 'text',
        required: false,
        smartFillType: 'postalCode',
        selectors: {
          lightning: 'input[name="MailingPostalCode"], lightning-input-address input[name="postalCode"]',
          classic: 'input[id*="MailingPostalCode"]',
          lwc: 'lightning-input-address input[name="postalCode"]'
        }
      }
    ],
    navigationSteps: {
      lightning: [
        'Click App Launcher (9 dots icon)',
        'Search for "Contacts"',
        'Click "Contacts" from results',
        'Click "New" button'
      ],
      classic: [
        'Click "Contacts" tab',
        'Click "New" button'
      ],
      appLauncher: 'Contacts'
    },
    verificationSteps: [
      'Verify Contact Name appears in the header',
      'Verify toast message "Contact was created"',
      'Verify record detail page displays'
    ],
    relatedObjects: ['Account', 'Opportunity', 'Case']
  },

  // ========== LEAD ==========
  {
    apiName: 'Lead',
    label: 'Lead',
    pluralLabel: 'Leads',
    icon: '🎯',
    description: 'Create a new Lead (Potential Customer)',
    category: 'sales',
    fields: [
      {
        apiName: 'Salutation',
        label: 'Salutation',
        type: 'picklist',
        required: false,
        smartFillType: 'salutation',
        picklistValues: ['Mr.', 'Ms.', 'Mrs.', 'Dr.', 'Prof.'],
        selectors: {
          lightning: 'lightning-combobox[field-name="Salutation"], button[name="Salutation"]',
          classic: 'select[id*="Salutation"]'
        }
      },
      {
        apiName: 'FirstName',
        label: 'First Name',
        type: 'text',
        required: false,
        smartFillType: 'firstName',
        selectors: {
          lightning: 'input[name="firstName"], lightning-input[field-name="FirstName"] input',
          classic: 'input[id*="firstName"]'
        }
      },
      {
        apiName: 'LastName',
        label: 'Last Name',
        type: 'text',
        required: true,
        smartFillType: 'lastName',
        selectors: {
          lightning: 'input[name="lastName"], lightning-input[field-name="LastName"] input',
          classic: 'input[id*="lastName"]'
        }
      },
      {
        apiName: 'Company',
        label: 'Company',
        type: 'text',
        required: true,
        smartFillType: 'accountName',
        selectors: {
          lightning: 'input[name="Company"], lightning-input[field-name="Company"] input',
          classic: 'input[id*="Company"]'
        }
      },
      {
        apiName: 'Title',
        label: 'Title',
        type: 'text',
        required: false,
        smartFillType: 'title',
        selectors: {
          lightning: 'input[name="Title"], lightning-input[field-name="Title"] input',
          classic: 'input[id*="Title"]'
        }
      },
      {
        apiName: 'Email',
        label: 'Email',
        type: 'email',
        required: false,
        smartFillType: 'email',
        selectors: {
          lightning: 'input[name="Email"], lightning-input[field-name="Email"] input',
          classic: 'input[id*="Email"]'
        }
      },
      {
        apiName: 'Phone',
        label: 'Phone',
        type: 'phone',
        required: false,
        smartFillType: 'phone',
        selectors: {
          lightning: 'input[name="Phone"], lightning-input[field-name="Phone"] input',
          classic: 'input[id*="Phone"]'
        }
      },
      {
        apiName: 'LeadSource',
        label: 'Lead Source',
        type: 'picklist',
        required: false,
        smartFillType: 'leadSource',
        picklistValues: ['Web', 'Phone Inquiry', 'Partner Referral', 'Purchased List', 'Trade Show', 'Advertisement', 'Employee Referral', 'External Referral', 'Other'],
        selectors: {
          lightning: 'lightning-combobox[field-name="LeadSource"], button[name="LeadSource"]',
          classic: 'select[id*="LeadSource"]'
        }
      },
      {
        apiName: 'Status',
        label: 'Lead Status',
        type: 'picklist',
        required: true,
        smartFillType: 'leadStatus',
        picklistValues: ['Open - Not Contacted', 'Working - Contacted', 'Closed - Converted', 'Closed - Not Converted'],
        selectors: {
          lightning: 'lightning-combobox[field-name="Status"], button[name="Status"]',
          classic: 'select[id*="Status"]'
        }
      },
      {
        apiName: 'Rating',
        label: 'Rating',
        type: 'picklist',
        required: false,
        smartFillType: 'rating',
        picklistValues: ['Hot', 'Warm', 'Cold'],
        selectors: {
          lightning: 'lightning-combobox[field-name="Rating"], button[name="Rating"]',
          classic: 'select[id*="Rating"]'
        }
      },
      {
        apiName: 'Industry',
        label: 'Industry',
        type: 'picklist',
        required: false,
        smartFillType: 'industry',
        picklistValues: ['Technology', 'Healthcare', 'Finance', 'Manufacturing', 'Retail', 'Other'],
        selectors: {
          lightning: 'lightning-combobox[field-name="Industry"], button[name="Industry"]',
          classic: 'select[id*="Industry"]'
        }
      },
      {
        apiName: 'AnnualRevenue',
        label: 'Annual Revenue',
        type: 'currency',
        required: false,
        smartFillType: 'annualRevenue',
        selectors: {
          lightning: 'input[name="AnnualRevenue"], lightning-input[field-name="AnnualRevenue"] input',
          classic: 'input[id*="AnnualRevenue"]'
        }
      },
      {
        apiName: 'NumberOfEmployees',
        label: 'No. of Employees',
        type: 'number',
        required: false,
        smartFillType: 'employees',
        selectors: {
          lightning: 'input[name="NumberOfEmployees"], lightning-input[field-name="NumberOfEmployees"] input',
          classic: 'input[id*="NumberOfEmployees"]'
        }
      }
    ],
    navigationSteps: {
      lightning: [
        'Click App Launcher (9 dots icon)',
        'Search for "Leads"',
        'Click "Leads" from results',
        'Click "New" button'
      ],
      classic: [
        'Click "Leads" tab',
        'Click "New" button'
      ],
      appLauncher: 'Leads'
    },
    verificationSteps: [
      'Verify Lead Name appears in the header',
      'Verify toast message "Lead was created"',
      'Verify record detail page displays'
    ],
    relatedObjects: ['Account', 'Contact', 'Opportunity']
  },

  // ========== OPPORTUNITY ==========
  {
    apiName: 'Opportunity',
    label: 'Opportunity',
    pluralLabel: 'Opportunities',
    icon: '💰',
    description: 'Create a new Opportunity (Sales Deal)',
    category: 'sales',
    fields: [
      {
        apiName: 'Name',
        label: 'Opportunity Name',
        type: 'text',
        required: true,
        smartFillType: 'opportunityName',
        selectors: {
          lightning: 'input[name="Name"], lightning-input[field-name="Name"] input',
          classic: 'input[id*="Name"]'
        }
      },
      {
        apiName: 'AccountId',
        label: 'Account Name',
        type: 'lookup',
        required: false,
        smartFillType: 'lookup',
        lookupObject: 'Account',
        selectors: {
          lightning: 'lightning-input-field[field-name="AccountId"] input, lightning-grouped-combobox input',
          classic: 'input[id*="Account"]'
        }
      },
      {
        apiName: 'CloseDate',
        label: 'Close Date',
        type: 'date',
        required: true,
        smartFillType: 'closeDate',
        selectors: {
          lightning: 'input[name="CloseDate"], lightning-input[field-name="CloseDate"] input',
          classic: 'input[id*="CloseDate"]'
        }
      },
      {
        apiName: 'StageName',
        label: 'Stage',
        type: 'picklist',
        required: true,
        smartFillType: 'stageName',
        picklistValues: ['Prospecting', 'Qualification', 'Needs Analysis', 'Value Proposition', 'Id. Decision Makers', 'Perception Analysis', 'Proposal/Price Quote', 'Negotiation/Review', 'Closed Won', 'Closed Lost'],
        selectors: {
          lightning: 'lightning-combobox[field-name="StageName"], button[name="StageName"]',
          classic: 'select[id*="StageName"]'
        }
      },
      {
        apiName: 'Amount',
        label: 'Amount',
        type: 'currency',
        required: false,
        smartFillType: 'amount',
        selectors: {
          lightning: 'input[name="Amount"], lightning-input[field-name="Amount"] input',
          classic: 'input[id*="Amount"]'
        }
      },
      {
        apiName: 'Probability',
        label: 'Probability (%)',
        type: 'percent',
        required: false,
        smartFillType: 'probability',
        selectors: {
          lightning: 'input[name="Probability"], lightning-input[field-name="Probability"] input',
          classic: 'input[id*="Probability"]'
        }
      },
      {
        apiName: 'LeadSource',
        label: 'Lead Source',
        type: 'picklist',
        required: false,
        smartFillType: 'leadSource',
        picklistValues: ['Web', 'Phone Inquiry', 'Partner Referral', 'Trade Show', 'Advertisement', 'Other'],
        selectors: {
          lightning: 'lightning-combobox[field-name="LeadSource"], button[name="LeadSource"]',
          classic: 'select[id*="LeadSource"]'
        }
      },
      {
        apiName: 'Type',
        label: 'Type',
        type: 'picklist',
        required: false,
        smartFillType: 'picklist',
        picklistValues: ['Existing Customer - Upgrade', 'Existing Customer - Replacement', 'Existing Customer - Downgrade', 'New Customer'],
        selectors: {
          lightning: 'lightning-combobox[field-name="Type"], button[name="Type"]',
          classic: 'select[id*="Type"]'
        }
      },
      {
        apiName: 'NextStep',
        label: 'Next Step',
        type: 'text',
        required: false,
        smartFillType: 'text',
        selectors: {
          lightning: 'input[name="NextStep"], lightning-input[field-name="NextStep"] input',
          classic: 'input[id*="NextStep"]'
        }
      },
      {
        apiName: 'Description',
        label: 'Description',
        type: 'textarea',
        required: false,
        smartFillType: 'description',
        selectors: {
          lightning: 'textarea[name="Description"], lightning-textarea[field-name="Description"] textarea',
          classic: 'textarea[id*="Description"]'
        }
      }
    ],
    navigationSteps: {
      lightning: [
        'Click App Launcher (9 dots icon)',
        'Search for "Opportunities"',
        'Click "Opportunities" from results',
        'Click "New" button'
      ],
      classic: [
        'Click "Opportunities" tab',
        'Click "New" button'
      ],
      appLauncher: 'Opportunities'
    },
    verificationSteps: [
      'Verify Opportunity Name appears in the header',
      'Verify toast message "Opportunity was created"',
      'Verify record detail page displays',
      'Verify Stage path shows current stage'
    ],
    relatedObjects: ['Account', 'Contact', 'Quote', 'Product']
  },

  // ========== CASE ==========
  {
    apiName: 'Case',
    label: 'Case',
    pluralLabel: 'Cases',
    icon: '📋',
    description: 'Create a new Case (Support Ticket)',
    category: 'service',
    fields: [
      {
        apiName: 'ContactId',
        label: 'Contact Name',
        type: 'lookup',
        required: false,
        smartFillType: 'lookup',
        lookupObject: 'Contact',
        selectors: {
          lightning: 'lightning-input-field[field-name="ContactId"] input, lightning-grouped-combobox input',
          classic: 'input[id*="Contact"]'
        }
      },
      {
        apiName: 'AccountId',
        label: 'Account Name',
        type: 'lookup',
        required: false,
        smartFillType: 'lookup',
        lookupObject: 'Account',
        selectors: {
          lightning: 'lightning-input-field[field-name="AccountId"] input',
          classic: 'input[id*="Account"]'
        }
      },
      {
        apiName: 'Subject',
        label: 'Subject',
        type: 'text',
        required: true,
        smartFillType: 'caseSubject',
        selectors: {
          lightning: 'input[name="Subject"], lightning-input[field-name="Subject"] input',
          classic: 'input[id*="Subject"]'
        }
      },
      {
        apiName: 'Description',
        label: 'Description',
        type: 'textarea',
        required: false,
        smartFillType: 'caseDescription',
        selectors: {
          lightning: 'textarea[name="Description"], lightning-textarea[field-name="Description"] textarea',
          classic: 'textarea[id*="Description"]'
        }
      },
      {
        apiName: 'Status',
        label: 'Status',
        type: 'picklist',
        required: true,
        smartFillType: 'caseStatus',
        picklistValues: ['New', 'Working', 'Escalated', 'Closed'],
        selectors: {
          lightning: 'lightning-combobox[field-name="Status"], button[name="Status"]',
          classic: 'select[id*="Status"]'
        }
      },
      {
        apiName: 'Priority',
        label: 'Priority',
        type: 'picklist',
        required: false,
        smartFillType: 'casePriority',
        picklistValues: ['Low', 'Medium', 'High', 'Critical'],
        selectors: {
          lightning: 'lightning-combobox[field-name="Priority"], button[name="Priority"]',
          classic: 'select[id*="Priority"]'
        }
      },
      {
        apiName: 'Origin',
        label: 'Case Origin',
        type: 'picklist',
        required: true,
        smartFillType: 'caseOrigin',
        picklistValues: ['Phone', 'Email', 'Web', 'Chat'],
        selectors: {
          lightning: 'lightning-combobox[field-name="Origin"], button[name="Origin"]',
          classic: 'select[id*="Origin"]'
        }
      },
      {
        apiName: 'Type',
        label: 'Type',
        type: 'picklist',
        required: false,
        smartFillType: 'caseType',
        picklistValues: ['Problem', 'Feature Request', 'Question'],
        selectors: {
          lightning: 'lightning-combobox[field-name="Type"], button[name="Type"]',
          classic: 'select[id*="Type"]'
        }
      },
      {
        apiName: 'Reason',
        label: 'Case Reason',
        type: 'picklist',
        required: false,
        smartFillType: 'picklist',
        picklistValues: ['Installation', 'Equipment Complexity', 'Performance', 'Breakdown', 'Equipment Design', 'Feedback', 'Other'],
        selectors: {
          lightning: 'lightning-combobox[field-name="Reason"], button[name="Reason"]',
          classic: 'select[id*="Reason"]'
        }
      }
    ],
    navigationSteps: {
      lightning: [
        'Click App Launcher (9 dots icon)',
        'Search for "Cases"',
        'Click "Cases" from results',
        'Click "New" button'
      ],
      classic: [
        'Click "Cases" tab',
        'Click "New" button'
      ],
      appLauncher: 'Cases'
    },
    verificationSteps: [
      'Verify Case Number appears in the header',
      'Verify toast message "Case was created"',
      'Verify record detail page displays',
      'Verify Case Status shows in Path'
    ],
    relatedObjects: ['Account', 'Contact']
  },

  // ========== TASK ==========
  {
    apiName: 'Task',
    label: 'Task',
    pluralLabel: 'Tasks',
    icon: '✅',
    description: 'Create a new Task (To-Do Item)',
    category: 'common',
    fields: [
      {
        apiName: 'Subject',
        label: 'Subject',
        type: 'text',
        required: true,
        smartFillType: 'text',
        selectors: {
          lightning: 'input[name="Subject"], lightning-input[field-name="Subject"] input, lightning-combobox[field-name="Subject"]',
          classic: 'input[id*="Subject"]'
        }
      },
      {
        apiName: 'WhoId',
        label: 'Name (Contact/Lead)',
        type: 'lookup',
        required: false,
        smartFillType: 'lookup',
        lookupObject: 'Contact',
        selectors: {
          lightning: 'lightning-input-field[field-name="WhoId"] input',
          classic: 'input[id*="WhoId"]'
        }
      },
      {
        apiName: 'WhatId',
        label: 'Related To',
        type: 'lookup',
        required: false,
        smartFillType: 'lookup',
        lookupObject: 'Account',
        selectors: {
          lightning: 'lightning-input-field[field-name="WhatId"] input',
          classic: 'input[id*="WhatId"]'
        }
      },
      {
        apiName: 'ActivityDate',
        label: 'Due Date',
        type: 'date',
        required: false,
        smartFillType: 'futureDate',
        selectors: {
          lightning: 'input[name="ActivityDate"], lightning-input[field-name="ActivityDate"] input',
          classic: 'input[id*="ActivityDate"]'
        }
      },
      {
        apiName: 'Priority',
        label: 'Priority',
        type: 'picklist',
        required: false,
        smartFillType: 'picklist',
        picklistValues: ['Low', 'Normal', 'High'],
        selectors: {
          lightning: 'lightning-combobox[field-name="Priority"], button[name="Priority"]',
          classic: 'select[id*="Priority"]'
        }
      },
      {
        apiName: 'Status',
        label: 'Status',
        type: 'picklist',
        required: false,
        smartFillType: 'picklist',
        picklistValues: ['Not Started', 'In Progress', 'Completed', 'Waiting on someone else', 'Deferred'],
        selectors: {
          lightning: 'lightning-combobox[field-name="Status"], button[name="Status"]',
          classic: 'select[id*="Status"]'
        }
      },
      {
        apiName: 'Description',
        label: 'Comments',
        type: 'textarea',
        required: false,
        smartFillType: 'description',
        selectors: {
          lightning: 'textarea[name="Description"], lightning-textarea[field-name="Description"] textarea',
          classic: 'textarea[id*="Description"]'
        }
      }
    ],
    navigationSteps: {
      lightning: [
        'Click App Launcher (9 dots icon)',
        'Search for "Tasks"',
        'Click "Tasks" from results',
        'Click "New Task" button'
      ],
      classic: [
        'Navigate to a record',
        'Click "New Task" in Activity section'
      ],
      appLauncher: 'Tasks'
    },
    verificationSteps: [
      'Verify Task Subject appears',
      'Verify toast message shows task was created',
      'Verify task appears in activity timeline'
    ],
    relatedObjects: ['Contact', 'Account', 'Opportunity', 'Lead']
  },

  // ========== EVENT ==========
  {
    apiName: 'Event',
    label: 'Event',
    pluralLabel: 'Events',
    icon: '📅',
    description: 'Create a new Event (Calendar Meeting)',
    category: 'common',
    fields: [
      {
        apiName: 'Subject',
        label: 'Subject',
        type: 'text',
        required: true,
        smartFillType: 'text',
        selectors: {
          lightning: 'input[name="Subject"], lightning-input[field-name="Subject"] input, lightning-combobox[field-name="Subject"]',
          classic: 'input[id*="Subject"]'
        }
      },
      {
        apiName: 'WhoId',
        label: 'Name (Contact/Lead)',
        type: 'lookup',
        required: false,
        smartFillType: 'lookup',
        lookupObject: 'Contact',
        selectors: {
          lightning: 'lightning-input-field[field-name="WhoId"] input',
          classic: 'input[id*="WhoId"]'
        }
      },
      {
        apiName: 'WhatId',
        label: 'Related To',
        type: 'lookup',
        required: false,
        smartFillType: 'lookup',
        lookupObject: 'Account',
        selectors: {
          lightning: 'lightning-input-field[field-name="WhatId"] input',
          classic: 'input[id*="WhatId"]'
        }
      },
      {
        apiName: 'Location',
        label: 'Location',
        type: 'text',
        required: false,
        smartFillType: 'text',
        selectors: {
          lightning: 'input[name="Location"], lightning-input[field-name="Location"] input',
          classic: 'input[id*="Location"]'
        }
      },
      {
        apiName: 'StartDateTime',
        label: 'Start Date/Time',
        type: 'datetime',
        required: true,
        smartFillType: 'futureDateTime',
        selectors: {
          lightning: 'input[name="StartDateTime"], lightning-input[field-name="StartDateTime"] input',
          classic: 'input[id*="StartDateTime"]'
        }
      },
      {
        apiName: 'EndDateTime',
        label: 'End Date/Time',
        type: 'datetime',
        required: true,
        smartFillType: 'futureDateTime',
        selectors: {
          lightning: 'input[name="EndDateTime"], lightning-input[field-name="EndDateTime"] input',
          classic: 'input[id*="EndDateTime"]'
        }
      },
      {
        apiName: 'Description',
        label: 'Description',
        type: 'textarea',
        required: false,
        smartFillType: 'description',
        selectors: {
          lightning: 'textarea[name="Description"], lightning-textarea[field-name="Description"] textarea',
          classic: 'textarea[id*="Description"]'
        }
      }
    ],
    navigationSteps: {
      lightning: [
        'Click App Launcher (9 dots icon)',
        'Search for "Calendar"',
        'Click "Calendar" from results',
        'Click "New Event" button'
      ],
      classic: [
        'Navigate to a record',
        'Click "New Event" in Activity section'
      ],
      appLauncher: 'Calendar'
    },
    verificationSteps: [
      'Verify Event Subject appears',
      'Verify toast message shows event was created',
      'Verify event appears in calendar'
    ],
    relatedObjects: ['Contact', 'Account', 'Opportunity', 'Lead']
  },

  // ========== CAMPAIGN ==========
  {
    apiName: 'Campaign',
    label: 'Campaign',
    pluralLabel: 'Campaigns',
    icon: '📢',
    description: 'Create a new Campaign (Marketing Campaign)',
    category: 'marketing',
    fields: [
      {
        apiName: 'Name',
        label: 'Campaign Name',
        type: 'text',
        required: true,
        smartFillType: 'text',
        selectors: {
          lightning: 'input[name="Name"], lightning-input[field-name="Name"] input',
          classic: 'input[id*="Name"]'
        }
      },
      {
        apiName: 'Type',
        label: 'Type',
        type: 'picklist',
        required: false,
        smartFillType: 'picklist',
        picklistValues: ['Conference', 'Webinar', 'Trade Show', 'Public Relations', 'Partners', 'Referral Program', 'Advertisement', 'Banner Ads', 'Direct Mail', 'Email', 'Telemarketing', 'Other'],
        selectors: {
          lightning: 'lightning-combobox[field-name="Type"], button[name="Type"]',
          classic: 'select[id*="Type"]'
        }
      },
      {
        apiName: 'Status',
        label: 'Status',
        type: 'picklist',
        required: false,
        smartFillType: 'picklist',
        picklistValues: ['Planned', 'In Progress', 'Completed', 'Aborted'],
        selectors: {
          lightning: 'lightning-combobox[field-name="Status"], button[name="Status"]',
          classic: 'select[id*="Status"]'
        }
      },
      {
        apiName: 'StartDate',
        label: 'Start Date',
        type: 'date',
        required: false,
        smartFillType: 'date',
        selectors: {
          lightning: 'input[name="StartDate"], lightning-input[field-name="StartDate"] input',
          classic: 'input[id*="StartDate"]'
        }
      },
      {
        apiName: 'EndDate',
        label: 'End Date',
        type: 'date',
        required: false,
        smartFillType: 'futureDate',
        selectors: {
          lightning: 'input[name="EndDate"], lightning-input[field-name="EndDate"] input',
          classic: 'input[id*="EndDate"]'
        }
      },
      {
        apiName: 'BudgetedCost',
        label: 'Budgeted Cost',
        type: 'currency',
        required: false,
        smartFillType: 'currency',
        selectors: {
          lightning: 'input[name="BudgetedCost"], lightning-input[field-name="BudgetedCost"] input',
          classic: 'input[id*="BudgetedCost"]'
        }
      },
      {
        apiName: 'ExpectedRevenue',
        label: 'Expected Revenue',
        type: 'currency',
        required: false,
        smartFillType: 'currency',
        selectors: {
          lightning: 'input[name="ExpectedRevenue"], lightning-input[field-name="ExpectedRevenue"] input',
          classic: 'input[id*="ExpectedRevenue"]'
        }
      },
      {
        apiName: 'ExpectedResponse',
        label: 'Expected Response (%)',
        type: 'percent',
        required: false,
        smartFillType: 'percent',
        selectors: {
          lightning: 'input[name="ExpectedResponse"], lightning-input[field-name="ExpectedResponse"] input',
          classic: 'input[id*="ExpectedResponse"]'
        }
      },
      {
        apiName: 'Description',
        label: 'Description',
        type: 'textarea',
        required: false,
        smartFillType: 'description',
        selectors: {
          lightning: 'textarea[name="Description"], lightning-textarea[field-name="Description"] textarea',
          classic: 'textarea[id*="Description"]'
        }
      }
    ],
    navigationSteps: {
      lightning: [
        'Click App Launcher (9 dots icon)',
        'Search for "Campaigns"',
        'Click "Campaigns" from results',
        'Click "New" button'
      ],
      classic: [
        'Click "Campaigns" tab',
        'Click "New" button'
      ],
      appLauncher: 'Campaigns'
    },
    verificationSteps: [
      'Verify Campaign Name appears in header',
      'Verify toast message "Campaign was created"',
      'Verify record detail page displays'
    ],
    relatedObjects: ['Lead', 'Contact']
  }
];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get template by API name
 */
export function getTemplate(apiName: string): SalesforceObjectTemplate | undefined {
  return SALESFORCE_TEMPLATES.find(t => t.apiName === apiName);
}

/**
 * Get templates by category
 */
export function getTemplatesByCategory(category: string): SalesforceObjectTemplate[] {
  return SALESFORCE_TEMPLATES.filter(t => t.category === category);
}

/**
 * Get all required fields for a template
 */
export function getRequiredFields(template: SalesforceObjectTemplate): SalesforceField[] {
  return template.fields.filter(f => f.required);
}

/**
 * Generate test data for a template
 */
export function generateTestDataForTemplate(template: SalesforceObjectTemplate): Record<string, string> {
  const data: Record<string, string> = {};
  
  template.fields.forEach(field => {
    const smartFillConfig = SALESFORCE_SMART_FILL_TYPES[field.smartFillType];
    if (smartFillConfig) {
      data[field.apiName] = generateValueForType(field.smartFillType, field);
    }
  });
  
  return data;
}

/**
 * Generate a value for a specific smart fill type
 */
export function generateValueForType(smartFillType: string, field?: SalesforceField): string {
  const generators: Record<string, () => string> = {
    accountName: () => `${randomItem(['Acme', 'Global', 'Premier', 'Elite', 'Dynamic'])} ${randomItem(['Corp', 'Inc', 'LLC', 'Solutions', 'Technologies'])}`,
    company: () => `${randomItem(['Acme', 'Global', 'Premier', 'Elite', 'Dynamic'])} ${randomItem(['Corp', 'Inc', 'LLC', 'Solutions', 'Technologies'])}`,
    firstName: () => randomItem(['John', 'Jane', 'Michael', 'Sarah', 'David', 'Emily', 'Robert', 'Jennifer']),
    lastName: () => randomItem(['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis']),
    email: () => `test.user${Math.floor(Math.random() * 10000)}@example.com`,
    phone: () => `(${randomNum(200, 999)}) ${randomNum(200, 999)}-${randomNum(1000, 9999)}`,
    street: () => `${randomNum(100, 9999)} ${randomItem(['Main', 'Oak', 'Maple', 'Cedar', 'Tech'])} ${randomItem(['St', 'Ave', 'Dr', 'Ln', 'Blvd'])}`,
    city: () => randomItem(['San Francisco', 'New York', 'Austin', 'Seattle', 'Chicago', 'Boston', 'Denver']),
    state: () => randomItem(['CA', 'NY', 'TX', 'WA', 'IL', 'MA', 'CO']),
    postalCode: () => `${randomNum(10000, 99999)}`,
    country: () => 'United States',
    website: () => `https://www.${randomItem(['acme', 'global', 'premier', 'company'])}.com`,
    currency: () => `${randomNum(10000, 1000000)}`,
    annualRevenue: () => `${randomNum(100000, 10000000)}`,
    amount: () => `${randomNum(5000, 500000)}`,
    employees: () => `${randomNum(10, 5000)}`,
    percent: () => `${randomNum(10, 90)}`,
    probability: () => `${randomNum(10, 90)}`,
    title: () => randomItem(['CEO', 'CTO', 'VP Sales', 'Director', 'Manager', 'Engineer', 'Consultant']),
    jobTitle: () => randomItem(['CEO', 'CTO', 'VP Sales', 'Director', 'Manager', 'Engineer', 'Consultant']),
    department: () => randomItem(['Sales', 'Marketing', 'Engineering', 'Finance', 'HR', 'Operations']),
    date: () => new Date().toISOString().split('T')[0],
    futureDate: () => {
      const d = new Date();
      d.setDate(d.getDate() + randomNum(30, 90));
      return d.toISOString().split('T')[0];
    },
    birthDate: () => {
      const year = randomNum(1960, 2000);
      const month = randomNum(1, 12).toString().padStart(2, '0');
      const day = randomNum(1, 28).toString().padStart(2, '0');
      return `${year}-${month}-${day}`;
    },
    opportunityName: () => `${randomItem(['Q1', 'Q2', 'Q3', 'Q4'])} ${randomItem(['Enterprise', 'Growth', 'Expansion', 'Renewal'])} - ${randomItem(['Acme', 'Global', 'Tech'])}`,
    caseSubject: () => randomItem(['Login Issue', 'Feature Request', 'Billing Question', 'Technical Support', 'Integration Help']),
    caseDescription: () => `Customer reported an issue with ${randomItem(['login', 'performance', 'features', 'billing'])}. Please assist.`,
    text: () => `Test ${randomItem(['Value', 'Data', 'Entry', 'Input'])} ${randomNum(1000, 9999)}`,
    textarea: () => `This is a test description generated for automated testing purposes. Reference ID: ${randomNum(10000, 99999)}`,
    description: () => `Test description for automated testing. Generated at ${new Date().toISOString()}`,
    lookup: () => '', // Lookups require special handling
    picklist: () => field?.picklistValues?.[0] || '',
    salutation: () => randomItem(['Mr.', 'Ms.', 'Mrs.', 'Dr.']),
    accountType: () => randomItem(['Customer - Direct', 'Prospect', 'Partner']),
    industry: () => randomItem(['Technology', 'Healthcare', 'Finance', 'Manufacturing', 'Retail']),
    leadSource: () => randomItem(['Web', 'Phone Inquiry', 'Partner Referral', 'Trade Show']),
    leadStatus: () => 'Open - Not Contacted',
    rating: () => randomItem(['Hot', 'Warm', 'Cold']),
    stageName: () => 'Prospecting',
    closeDate: () => {
      const d = new Date();
      d.setDate(d.getDate() + randomNum(30, 90));
      return d.toISOString().split('T')[0];
    },
    forecastCategory: () => 'Pipeline',
    caseStatus: () => 'New',
    casePriority: () => randomItem(['Low', 'Medium', 'High']),
    caseOrigin: () => randomItem(['Phone', 'Email', 'Web']),
    caseType: () => randomItem(['Problem', 'Feature Request', 'Question']),
    mobilePhone: () => `(${randomNum(200, 999)}) ${randomNum(200, 999)}-${randomNum(1000, 9999)}`,
    fax: () => `(${randomNum(200, 999)}) ${randomNum(200, 999)}-${randomNum(1000, 9999)}`,
    url: () => `https://www.example${randomNum(1, 100)}.com`,
    tickerSymbol: () => randomItem(['ACME', 'GLBL', 'TECH', 'PRMI']),
    futureDateTime: () => {
      const d = new Date();
      d.setDate(d.getDate() + randomNum(1, 30));
      d.setHours(randomNum(9, 17), 0, 0, 0);
      return d.toISOString();
    },
    birthdate: () => {
      const year = randomNum(1960, 2000);
      const month = randomNum(1, 12).toString().padStart(2, '0');
      const day = randomNum(1, 28).toString().padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
  };
  
  const generator = generators[smartFillType];
  return generator ? generator() : '';
}

// Helper functions
function randomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomNum(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Convert template to test case steps
 */
export function templateToTestSteps(
  template: SalesforceObjectTemplate,
  testData: Record<string, string>,
  options: {
    includeNavigation?: boolean;
    includeVerification?: boolean;
    fieldsToInclude?: string[];
  } = {}
): any[] {
  const steps: any[] = [];
  const {
    includeNavigation = true,
    includeVerification = true,
    fieldsToInclude
  } = options;
  
  let stepOrder = 1;
  
  // Navigation steps
  if (includeNavigation) {
    // App Launcher step
    steps.push({
      id: `step_nav_${stepOrder}`,
      order: stepOrder++,
      type: 'click',
      name: 'Open App Launcher',
      description: 'Click App Launcher (9 dots icon)',
      selector: 'button.slds-icon-waffle, [data-key="appLauncher"], .appLauncher',
      selectorObj: {
        playwright: 'page.getByRole("button", { name: "App Launcher" })'
      }
    });
    
    // Search for object
    steps.push({
      id: `step_nav_${stepOrder}`,
      order: stepOrder++,
      type: 'fill',
      name: `Search for ${template.pluralLabel}`,
      description: `Search for "${template.pluralLabel}" in App Launcher`,
      selector: 'input[placeholder*="Search"], input.slds-input',
      selectorObj: {
        playwright: `page.getByPlaceholder("Search apps and items...")`
      },
      value: template.navigationSteps.appLauncher || template.pluralLabel
    });
    
    // Click on result
    steps.push({
      id: `step_nav_${stepOrder}`,
      order: stepOrder++,
      type: 'click',
      name: `Select ${template.pluralLabel}`,
      description: `Click "${template.pluralLabel}" from search results`,
      selector: `a[data-label="${template.pluralLabel}"], span:text("${template.pluralLabel}")`,
      selectorObj: {
        playwright: `page.getByText("${template.pluralLabel}", { exact: true }).first()`
      }
    });
    
    // Click New button
    steps.push({
      id: `step_nav_${stepOrder}`,
      order: stepOrder++,
      type: 'click',
      name: 'Click New button',
      description: 'Click "New" button to create record',
      selector: 'button[name="New"], a[title="New"]',
      selectorObj: {
        playwright: 'page.getByRole("button", { name: "New" })'
      }
    });
  }
  
  // Field fill steps
  const fieldsToProcess = fieldsToInclude 
    ? template.fields.filter(f => fieldsToInclude.includes(f.apiName))
    : template.fields.filter(f => f.required || testData[f.apiName]);
    
  fieldsToProcess.forEach(field => {
    const value = testData[field.apiName];
    if (!value && !field.required) return;
    
    if (field.type === 'picklist') {
      // Click to open picklist
      steps.push({
        id: `step_field_${stepOrder}`,
        order: stepOrder++,
        type: 'click',
        name: `Open ${field.label} dropdown`,
        description: `Click to open ${field.label} picklist`,
        selector: field.selectors.lightning,
        selectorObj: {
          playwright: `page.getByLabel("${field.label}").or(page.locator('button[name="${field.apiName}"]'))`
        }
      });
      
      // Select option
      steps.push({
        id: `step_field_${stepOrder}`,
        order: stepOrder++,
        type: 'click',
        name: `Select ${field.label}: ${value}`,
        description: `Select "${value}" from ${field.label} dropdown`,
        selector: `lightning-base-combobox-item[data-value="${value}"], span[title="${value}"]`,
        selectorObj: {
          playwright: `page.getByRole("option", { name: "${value}" })`
        },
        value: value
      });
    } else if (field.type === 'lookup') {
      // Lookup fields need special handling
      steps.push({
        id: `step_field_${stepOrder}`,
        order: stepOrder++,
        type: 'fill',
        name: `Search ${field.label}`,
        description: `Search for ${field.lookupObject} in ${field.label} field`,
        selector: field.selectors.lightning,
        selectorObj: {
          playwright: `page.getByLabel("${field.label}").or(page.locator('lightning-input-field[field-name="${field.apiName}"] input'))`
        },
        value: value || 'Search...',
        isLookup: true,
        lookupObject: field.lookupObject
      });
    } else if (field.type === 'checkbox') {
      steps.push({
        id: `step_field_${stepOrder}`,
        order: stepOrder++,
        type: 'check',
        name: `Check ${field.label}`,
        description: `${value === 'true' ? 'Check' : 'Uncheck'} ${field.label} checkbox`,
        selector: field.selectors.lightning,
        selectorObj: {
          playwright: `page.getByLabel("${field.label}")`
        },
        value: value
      });
    } else {
      // Text, number, currency, date, etc.
      steps.push({
        id: `step_field_${stepOrder}`,
        order: stepOrder++,
        type: 'fill',
        name: `Fill ${field.label}`,
        description: `Enter "${value}" in ${field.label} field`,
        selector: field.selectors.lightning,
        selectorObj: {
          playwright: `page.getByLabel("${field.label}").or(page.locator('input[name="${field.apiName}"]'))`
        },
        value: value
      });
    }
  });
  
  // Save button
  steps.push({
    id: `step_save_${stepOrder}`,
    order: stepOrder++,
    type: 'click',
    name: 'Save record',
    description: 'Click Save button to create the record',
    selector: 'button[name="SaveEdit"], button[title="Save"]',
    selectorObj: {
      playwright: 'page.getByRole("button", { name: "Save" }).first()'
    }
  });
  
  // Verification steps
  if (includeVerification) {
    steps.push({
      id: `step_verify_${stepOrder}`,
      order: stepOrder++,
      type: 'assert',
      name: 'Verify success toast',
      description: `Verify toast message "${template.label} was created"`,
      selector: '.toastMessage, .slds-notify__content',
      selectorObj: {
        playwright: `page.getByText("${template.label}").or(page.locator('.toastMessage'))`
      },
      isAssertion: true,
      assertType: 'visible'
    });
  }
  
  return steps;
}

/**
 * Get all template names for quick access
 */
export function getAllTemplateNames(): Array<{ apiName: string; label: string; icon: string; category: string }> {
  return SALESFORCE_TEMPLATES.map(t => ({
    apiName: t.apiName,
    label: t.label,
    icon: t.icon,
    category: t.category
  }));
}




