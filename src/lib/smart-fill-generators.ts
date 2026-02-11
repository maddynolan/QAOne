/**
 * Smart Fill Generators Library
 * 
 * Centralized collection of all data generators for form filling.
 * Searchable, categorized, with examples and descriptions.
 * 
 * ENHANCED: Now supports backend API integration for unlimited unique data (10,000+)
 * using Python Faker library when available.
 */

export interface SmartFillGenerator {
  id: string;
  name: string;
  category: string;
  description: string;
  example: () => string;  // Function to generate example
  generate: (constraints?: Record<string, any>) => string;
  keywords: string[];     // For search
  constraints?: {
    label: string;
    type: 'number' | 'text' | 'select';
    key: string;
    default: any;
    options?: { label: string; value: any }[];
  }[];
  // Backend mapping for unlimited data generation
  backendType?: string;  // Maps to TestDataGenerator type
  supportsUnlimited?: boolean;  // If true, can generate 10,000+ unique values via API
}

export interface GeneratorCategory {
  id: string;
  name: string;
  icon: string;
  color: string;
}

// ============================================================================
// BACKEND API INTEGRATION
// ============================================================================

import { API_BASE_URL } from '@/lib/api-config';

/**
 * Generate data using backend TestDataGenerator (with Faker support)
 * Use this for large batches (10,000+) to avoid frontend pool exhaustion
 */
export async function generateFromBackend(
  dataType: string,
  count: number = 1,
  options: Record<string, any> = {},
  ensureUnique: boolean = true
): Promise<string[]> {
  try {
    if (count === 1) {
      // Single value - use simple endpoint
      const response = await fetch(`${API_BASE_URL}/api/v2/testing/datagen/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          data_type: dataType,
          count: 1,
          options,
        }),
      });
      
      if (!response.ok) throw new Error('Backend generation failed');
      const data = await response.json();
      return Array.isArray(data.values) ? data.values : [data.value];
    } else {
      // Batch generation - use optimized endpoint
      const response = await fetch(`${API_BASE_URL}/api/v2/testing/datagen/batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          data_type: dataType,
          count,
          ensure_unique: ensureUnique,
          options,
        }),
      });
      
      if (!response.ok) throw new Error('Backend batch generation failed');
      const data = await response.json();
      return data.values || [];
    }
  } catch (error) {
    console.error('Backend generation error:', error);
    throw error;
  }
}

/**
 * Check if backend has Faker enabled for unlimited data
 */
export async function checkBackendCapabilities(): Promise<{
  fakerEnabled: boolean;
  maxUniqueCapability: string;
  availableTypes: string[];
}> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/v2/testing/datagen/stats`);
    if (!response.ok) throw new Error('Failed to fetch capabilities');
    const data = await response.json();
    return {
      fakerEnabled: data.stats?.faker_enabled || false,
      maxUniqueCapability: data.stats?.max_unique_capability || 'Limited',
      availableTypes: data.stats?.available_types || [],
    };
  } catch {
    return {
      fakerEnabled: false,
      maxUniqueCapability: 'Unknown (backend unavailable)',
      availableTypes: [],
    };
  }
}

/**
 * Generate batch with progress callback for large datasets
 */
export async function generateBatchWithProgress(
  dataType: string,
  count: number,
  onProgress?: (generated: number, total: number) => void,
  options: Record<string, any> = {}
): Promise<string[]> {
  const BATCH_SIZE = 1000;
  const results: string[] = [];
  
  for (let i = 0; i < count; i += BATCH_SIZE) {
    const batchCount = Math.min(BATCH_SIZE, count - i);
    const batch = await generateFromBackend(dataType, batchCount, options, true);
    results.push(...batch);
    
    if (onProgress) {
      onProgress(results.length, count);
    }
  }
  
  return results;
}

// ============================================================================
// CATEGORIES
// ============================================================================

export const GENERATOR_CATEGORIES: GeneratorCategory[] = [
  { id: 'personal', name: 'Personal Info', icon: '👤', color: 'bg-blue-500' },
  { id: 'contact', name: 'Contact', icon: '📧', color: 'bg-green-500' },
  { id: 'address', name: 'Address', icon: '🏠', color: 'bg-orange-500' },
  { id: 'datetime', name: 'Date & Time', icon: '📅', color: 'bg-purple-500' },
  { id: 'financial', name: 'Financial', icon: '💳', color: 'bg-emerald-500' },
  { id: 'account', name: 'Account', icon: '🔐', color: 'bg-red-500' },
  { id: 'business', name: 'Business', icon: '🏢', color: 'bg-slate-500' },
  { id: 'web', name: 'Web & Tech', icon: '🌐', color: 'bg-cyan-500' },
  { id: 'numbers', name: 'Numbers', icon: '🔢', color: 'bg-amber-500' },
  { id: 'text', name: 'Text', icon: '📝', color: 'bg-pink-500' },
];

// ============================================================================
// DATA POOLS
// ============================================================================

const FIRST_NAMES = ['James', 'Mary', 'John', 'Patricia', 'Robert', 'Jennifer', 'Michael', 'Linda', 'William', 'Elizabeth', 'David', 'Barbara', 'Richard', 'Susan', 'Joseph', 'Jessica', 'Thomas', 'Sarah', 'Charles', 'Karen', 'Christopher', 'Nancy', 'Daniel', 'Lisa', 'Matthew', 'Emily', 'Anthony', 'Ashley', 'Mark', 'Amanda', 'Donald', 'Melissa', 'Steven', 'Stephanie', 'Paul', 'Nicole', 'Andrew', 'Michelle', 'Joshua', 'Rebecca'];

const LAST_NAMES = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson', 'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin', 'Lee', 'Perez', 'Thompson', 'White', 'Harris', 'Sanchez', 'Clark', 'Ramirez', 'Lewis', 'Robinson'];

const MIDDLE_NAMES = ['James', 'Michael', 'William', 'David', 'John', 'Marie', 'Ann', 'Lynn', 'Rose', 'Grace', 'Lee', 'Ray', 'Jean', 'Mae', 'Louise'];

const EMAIL_DOMAINS = ['gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'icloud.com', 'proton.me', 'mail.com', 'aol.com'];

const STREET_NAMES = ['Main', 'Oak', 'Maple', 'Cedar', 'Pine', 'Elm', 'Washington', 'Park', 'Lake', 'Hill', 'Forest', 'River', 'Spring', 'Valley', 'Sunset'];

const STREET_TYPES = ['St', 'Ave', 'Blvd', 'Dr', 'Ln', 'Way', 'Rd', 'Ct', 'Pl', 'Cir'];

const CITIES = ['New York', 'Los Angeles', 'Chicago', 'Houston', 'Phoenix', 'Philadelphia', 'San Antonio', 'San Diego', 'Dallas', 'San Jose', 'Austin', 'Jacksonville', 'Fort Worth', 'Columbus', 'Charlotte', 'Seattle', 'Denver', 'Boston', 'Portland', 'Atlanta'];

const STATES = ['California', 'Texas', 'Florida', 'New York', 'Pennsylvania', 'Illinois', 'Ohio', 'Georgia', 'North Carolina', 'Michigan', 'New Jersey', 'Virginia', 'Washington', 'Arizona', 'Massachusetts', 'Tennessee', 'Indiana', 'Missouri', 'Maryland', 'Wisconsin'];

const STATE_ABBREVS = ['CA', 'TX', 'FL', 'NY', 'PA', 'IL', 'OH', 'GA', 'NC', 'MI', 'NJ', 'VA', 'WA', 'AZ', 'MA', 'TN', 'IN', 'MO', 'MD', 'WI'];

const COUNTRIES = ['United States', 'Canada', 'United Kingdom', 'Australia', 'Germany', 'France', 'Japan', 'Brazil', 'India', 'Mexico'];

const COMPANY_PREFIXES = ['Global', 'Tech', 'Prime', 'United', 'First', 'Best', 'Elite', 'Pro', 'Alpha', 'Summit', 'Apex', 'Nova', 'Quantum', 'Fusion', 'Nexus'];

const COMPANY_SUFFIXES = ['Solutions', 'Systems', 'Services', 'Group', 'Corp', 'Inc', 'LLC', 'Technologies', 'Industries', 'Enterprises', 'Partners', 'Associates'];

const JOB_TITLES = ['Software Engineer', 'Product Manager', 'Designer', 'Data Analyst', 'Marketing Manager', 'Sales Representative', 'Project Manager', 'Business Analyst', 'HR Manager', 'Account Executive', 'Operations Manager', 'Customer Success Manager', 'DevOps Engineer', 'Quality Assurance', 'Technical Writer'];

const LOREM_WORDS = ['lorem', 'ipsum', 'dolor', 'sit', 'amet', 'consectetur', 'adipiscing', 'elit', 'sed', 'do', 'eiusmod', 'tempor', 'incididunt', 'labore', 'dolore', 'magna', 'aliqua', 'enim', 'minim', 'veniam'];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

const pick = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
const randInt = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;
const padZero = (n: number) => n.toString().padStart(2, '0');

// ============================================================================
// GENERATORS
// ============================================================================

export const SMART_FILL_GENERATORS: SmartFillGenerator[] = [
  // ===== PERSONAL INFO =====
  {
    id: 'first_name',
    name: 'First Name',
    category: 'personal',
    description: 'Random first name (male or female)',
    example: () => pick(FIRST_NAMES),
    generate: () => pick(FIRST_NAMES),
    keywords: ['first', 'name', 'given', 'fname', 'firstname'],
    backendType: 'firstName',
    supportsUnlimited: true,
  },
  {
    id: 'last_name',
    name: 'Last Name',
    category: 'personal',
    description: 'Random last name / surname',
    example: () => pick(LAST_NAMES),
    generate: () => pick(LAST_NAMES),
    keywords: ['last', 'name', 'surname', 'family', 'lname', 'lastname'],
    backendType: 'lastName',
    supportsUnlimited: true,
  },
  {
    id: 'middle_name',
    name: 'Middle Name',
    category: 'personal',
    description: 'Random middle name or initial',
    example: () => pick(MIDDLE_NAMES),
    generate: () => pick(MIDDLE_NAMES),
    keywords: ['middle', 'name', 'mname'],
    backendType: 'firstName',  // Use first name as middle names
    supportsUnlimited: true,
  },
  {
    id: 'full_name',
    name: 'Full Name',
    category: 'personal',
    description: 'First and last name combined',
    example: () => `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`,
    generate: () => `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`,
    keywords: ['full', 'name', 'complete', 'fullname'],
    backendType: 'fullName',
    supportsUnlimited: true,
  },
  {
    id: 'full_name_with_middle',
    name: 'Full Name (with Middle)',
    category: 'personal',
    description: 'First, middle, and last name',
    example: () => `${pick(FIRST_NAMES)} ${pick(MIDDLE_NAMES)} ${pick(LAST_NAMES)}`,
    generate: () => `${pick(FIRST_NAMES)} ${pick(MIDDLE_NAMES)} ${pick(LAST_NAMES)}`,
    keywords: ['full', 'name', 'middle', 'complete'],
  },
  {
    id: 'gender',
    name: 'Gender',
    category: 'personal',
    description: 'Random gender option',
    example: () => pick(['Male', 'Female', 'Other']),
    generate: () => pick(['Male', 'Female', 'Other', 'Prefer not to say']),
    keywords: ['gender', 'sex'],
  },
  {
    id: 'age',
    name: 'Age',
    category: 'personal',
    description: 'Random age (18-80)',
    example: () => String(randInt(18, 80)),
    generate: (c) => String(randInt(c?.min ?? 18, c?.max ?? 80)),
    keywords: ['age', 'years', 'old'],
    constraints: [
      { label: 'Min Age', type: 'number', key: 'min', default: 18 },
      { label: 'Max Age', type: 'number', key: 'max', default: 80 },
    ],
  },
  {
    id: 'ssn',
    name: 'SSN (Fake)',
    category: 'personal',
    description: 'Fake Social Security Number (XXX-XX-XXXX)',
    example: () => `${randInt(100, 999)}-${randInt(10, 99)}-${randInt(1000, 9999)}`,
    generate: () => `${randInt(100, 999)}-${randInt(10, 99)}-${randInt(1000, 9999)}`,
    keywords: ['ssn', 'social', 'security', 'number'],
  },

  // ===== CONTACT =====
  {
    id: 'email',
    name: 'Email Address',
    category: 'contact',
    description: 'Random email (firstname.lastname@domain)',
    example: () => `${pick(FIRST_NAMES).toLowerCase()}.${pick(LAST_NAMES).toLowerCase()}${randInt(1, 99)}@gmail.com`,
    generate: (c) => {
      const first = pick(FIRST_NAMES).toLowerCase();
      const last = pick(LAST_NAMES).toLowerCase();
      const num = randInt(1, 999);
      const domain = c?.domain || pick(EMAIL_DOMAINS);
      const prefix = c?.prefix || '';
      return `${prefix}${first}.${last}${num}@${domain}`;
    },
    keywords: ['email', 'mail', 'address', 'e-mail'],
    constraints: [
      { label: 'Domain', type: 'text', key: 'domain', default: '' },
      { label: 'Prefix', type: 'text', key: 'prefix', default: '' },
    ],
    backendType: 'email',
    supportsUnlimited: true,
  },
  {
    id: 'email_test',
    name: 'Test Email',
    category: 'contact',
    description: 'Test email with test. prefix',
    example: () => `test.user${randInt(1, 999)}@example.com`,
    generate: () => `test.user${randInt(1, 9999)}@example.com`,
    keywords: ['email', 'test', 'example'],
    backendType: 'email',
    supportsUnlimited: true,
  },
  {
    id: 'phone_us',
    name: 'Phone (US)',
    category: 'contact',
    description: 'US phone number format',
    example: () => `(${randInt(200, 999)}) ${randInt(200, 999)}-${randInt(1000, 9999)}`,
    generate: () => `(${randInt(200, 999)}) ${randInt(200, 999)}-${randInt(1000, 9999)}`,
    keywords: ['phone', 'telephone', 'mobile', 'cell', 'us'],
    backendType: 'phone',
    supportsUnlimited: true,
  },
  {
    id: 'phone_intl',
    name: 'Phone (International)',
    category: 'contact',
    description: 'International phone with +1',
    example: () => `+1 ${randInt(200, 999)} ${randInt(200, 999)} ${randInt(1000, 9999)}`,
    generate: () => `+1 ${randInt(200, 999)} ${randInt(200, 999)} ${randInt(1000, 9999)}`,
    keywords: ['phone', 'international', 'mobile'],
  },

  // ===== ADDRESS =====
  {
    id: 'street_address',
    name: 'Street Address',
    category: 'address',
    description: 'Full street address (123 Main St)',
    example: () => `${randInt(100, 9999)} ${pick(STREET_NAMES)} ${pick(STREET_TYPES)}`,
    generate: () => `${randInt(100, 9999)} ${pick(STREET_NAMES)} ${pick(STREET_TYPES)}`,
    keywords: ['street', 'address', 'line1'],
    backendType: 'streetAddress',
    supportsUnlimited: true,
  },
  {
    id: 'address_line2',
    name: 'Address Line 2',
    category: 'address',
    description: 'Apartment/Suite number',
    example: () => `Apt ${randInt(1, 999)}`,
    generate: () => `${pick(['Apt', 'Suite', 'Unit', '#'])} ${randInt(1, 999)}`,
    keywords: ['address', 'line2', 'apt', 'apartment', 'suite', 'unit'],
  },
  {
    id: 'city',
    name: 'City',
    category: 'address',
    description: 'Random US city',
    example: () => pick(CITIES),
    generate: () => pick(CITIES),
    keywords: ['city', 'town'],
    backendType: 'city',
    supportsUnlimited: true,
  },
  {
    id: 'state',
    name: 'State (Full)',
    category: 'address',
    description: 'US state full name',
    example: () => pick(STATES),
    generate: () => pick(STATES),
    keywords: ['state', 'province', 'region'],
  },
  {
    id: 'state_abbr',
    name: 'State (Abbreviation)',
    category: 'address',
    description: 'US state abbreviation (CA, TX)',
    example: () => pick(STATE_ABBREVS),
    generate: () => pick(STATE_ABBREVS),
    keywords: ['state', 'abbr', 'abbreviation'],
  },
  {
    id: 'zip',
    name: 'ZIP Code',
    category: 'address',
    description: '5-digit ZIP code',
    example: () => String(randInt(10000, 99999)),
    generate: () => String(randInt(10000, 99999)),
    keywords: ['zip', 'postal', 'code', 'postcode'],
  },
  {
    id: 'zip_plus4',
    name: 'ZIP+4 Code',
    category: 'address',
    description: '9-digit ZIP code (12345-6789)',
    example: () => `${randInt(10000, 99999)}-${randInt(1000, 9999)}`,
    generate: () => `${randInt(10000, 99999)}-${randInt(1000, 9999)}`,
    keywords: ['zip', 'postal', 'plus4'],
  },
  {
    id: 'country',
    name: 'Country',
    category: 'address',
    description: 'Random country name',
    example: () => pick(COUNTRIES),
    generate: () => pick(COUNTRIES),
    keywords: ['country', 'nation'],
  },

  // ===== DATE & TIME =====
  {
    id: 'day',
    name: 'Day (1-31)',
    category: 'datetime',
    description: 'Day of month, padded (01-31)',
    example: () => padZero(randInt(1, 28)),
    generate: (c) => padZero(randInt(c?.min ?? 1, c?.max ?? 28)),
    keywords: ['day', 'dd', 'date'],
    constraints: [
      { label: 'Min', type: 'number', key: 'min', default: 1 },
      { label: 'Max', type: 'number', key: 'max', default: 28 },
    ],
  },
  {
    id: 'month',
    name: 'Month (1-12)',
    category: 'datetime',
    description: 'Month number, padded (01-12)',
    example: () => padZero(randInt(1, 12)),
    generate: (c) => padZero(randInt(c?.min ?? 1, c?.max ?? 12)),
    keywords: ['month', 'mm'],
    constraints: [
      { label: 'Min', type: 'number', key: 'min', default: 1 },
      { label: 'Max', type: 'number', key: 'max', default: 12 },
    ],
  },
  {
    id: 'month_name',
    name: 'Month Name',
    category: 'datetime',
    description: 'Full month name (January, February...)',
    example: () => pick(['January', 'March', 'July', 'October']),
    generate: () => pick(['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']),
    keywords: ['month', 'name'],
  },
  {
    id: 'year_birth',
    name: 'Birth Year (Age 18-80)',
    category: 'datetime',
    description: 'Year for someone aged 18-80',
    example: () => String(new Date().getFullYear() - randInt(18, 80)),
    generate: (c) => {
      const currentYear = new Date().getFullYear();
      const minAge = c?.minAge ?? 18;
      const maxAge = c?.maxAge ?? 80;
      return String(randInt(currentYear - maxAge, currentYear - minAge));
    },
    keywords: ['year', 'birth', 'dob', 'age'],
    constraints: [
      { label: 'Min Age', type: 'number', key: 'minAge', default: 18 },
      { label: 'Max Age', type: 'number', key: 'maxAge', default: 80 },
    ],
  },
  {
    id: 'year_current',
    name: 'Current Year',
    category: 'datetime',
    description: 'The current year',
    example: () => String(new Date().getFullYear()),
    generate: () => String(new Date().getFullYear()),
    keywords: ['year', 'current', 'today'],
  },
  {
    id: 'year_future',
    name: 'Future Year',
    category: 'datetime',
    description: 'Year in the future (1-10 years)',
    example: () => String(new Date().getFullYear() + randInt(1, 5)),
    generate: (c) => String(new Date().getFullYear() + randInt(c?.min ?? 1, c?.max ?? 10)),
    keywords: ['year', 'future', 'expiry'],
    constraints: [
      { label: 'Min Years', type: 'number', key: 'min', default: 1 },
      { label: 'Max Years', type: 'number', key: 'max', default: 10 },
    ],
  },
  {
    id: 'date_today',
    name: 'Today\'s Date',
    category: 'datetime',
    description: 'Current date (YYYY-MM-DD)',
    example: () => new Date().toISOString().split('T')[0],
    generate: () => new Date().toISOString().split('T')[0],
    keywords: ['date', 'today', 'current'],
  },
  {
    id: 'date_mmddyyyy',
    name: 'Date (MM/DD/YYYY)',
    category: 'datetime',
    description: 'Random date in US format',
    example: () => `${padZero(randInt(1, 12))}/${padZero(randInt(1, 28))}/${randInt(1990, 2020)}`,
    generate: () => `${padZero(randInt(1, 12))}/${padZero(randInt(1, 28))}/${randInt(1990, 2020)}`,
    keywords: ['date', 'mmddyyyy', 'us'],
  },
  {
    id: 'date_future',
    name: 'Future Date',
    category: 'datetime',
    description: 'Date 1-365 days from now',
    example: () => {
      const d = new Date();
      d.setDate(d.getDate() + randInt(1, 30));
      return d.toISOString().split('T')[0];
    },
    generate: (c) => {
      const d = new Date();
      d.setDate(d.getDate() + randInt(c?.minDays ?? 1, c?.maxDays ?? 365));
      return d.toISOString().split('T')[0];
    },
    keywords: ['date', 'future', 'upcoming'],
  },
  {
    id: 'time_24h',
    name: 'Time (24h)',
    category: 'datetime',
    description: 'Time in 24-hour format (HH:MM)',
    example: () => `${padZero(randInt(0, 23))}:${padZero(randInt(0, 59))}`,
    generate: () => `${padZero(randInt(0, 23))}:${padZero(randInt(0, 59))}`,
    keywords: ['time', '24h', 'hour', 'minute'],
  },
  {
    id: 'time_12h',
    name: 'Time (12h AM/PM)',
    category: 'datetime',
    description: 'Time in 12-hour format',
    example: () => `${randInt(1, 12)}:${padZero(randInt(0, 59))} ${pick(['AM', 'PM'])}`,
    generate: () => `${randInt(1, 12)}:${padZero(randInt(0, 59))} ${pick(['AM', 'PM'])}`,
    keywords: ['time', '12h', 'am', 'pm'],
  },

  // ===== FINANCIAL =====
  {
    id: 'credit_card',
    name: 'Credit Card (Test)',
    category: 'financial',
    description: 'Fake test credit card number',
    example: () => `4111 ${randInt(1000, 9999)} ${randInt(1000, 9999)} ${randInt(1000, 9999)}`,
    generate: () => `4111 ${randInt(1000, 9999)} ${randInt(1000, 9999)} ${randInt(1000, 9999)}`,
    keywords: ['credit', 'card', 'cc', 'visa'],
  },
  {
    id: 'cvv',
    name: 'CVV',
    category: 'financial',
    description: '3-digit security code',
    example: () => String(randInt(100, 999)),
    generate: () => String(randInt(100, 999)),
    keywords: ['cvv', 'cvc', 'security', 'code'],
  },
  {
    id: 'expiry_month',
    name: 'Expiry Month',
    category: 'financial',
    description: 'Card expiry month (01-12)',
    example: () => padZero(randInt(1, 12)),
    generate: () => padZero(randInt(1, 12)),
    keywords: ['expiry', 'exp', 'month', 'card'],
  },
  {
    id: 'expiry_year',
    name: 'Expiry Year',
    category: 'financial',
    description: 'Card expiry year (future)',
    example: () => String(new Date().getFullYear() + randInt(1, 5)),
    generate: () => String(new Date().getFullYear() + randInt(1, 5)),
    keywords: ['expiry', 'exp', 'year', 'card'],
  },
  {
    id: 'amount_usd',
    name: 'Amount (USD)',
    category: 'financial',
    description: 'Random dollar amount',
    example: () => `$${(randInt(100, 100000) / 100).toFixed(2)}`,
    generate: (c) => {
      const min = c?.min ?? 1;
      const max = c?.max ?? 1000;
      return `$${(randInt(min * 100, max * 100) / 100).toFixed(2)}`;
    },
    keywords: ['amount', 'price', 'cost', 'usd', 'dollar', 'money'],
    constraints: [
      { label: 'Min', type: 'number', key: 'min', default: 1 },
      { label: 'Max', type: 'number', key: 'max', default: 1000 },
    ],
  },
  {
    id: 'amount_plain',
    name: 'Amount (Number Only)',
    category: 'financial',
    description: 'Amount without currency symbol',
    example: () => (randInt(100, 100000) / 100).toFixed(2),
    generate: (c) => {
      const min = c?.min ?? 1;
      const max = c?.max ?? 1000;
      return (randInt(min * 100, max * 100) / 100).toFixed(2);
    },
    keywords: ['amount', 'price', 'number'],
  },

  // ===== ACCOUNT =====
  {
    id: 'username',
    name: 'Username',
    category: 'account',
    description: 'Random username (firstname + number)',
    example: () => `${pick(FIRST_NAMES).toLowerCase()}${randInt(1, 9999)}`,
    generate: () => `${pick(FIRST_NAMES).toLowerCase()}${randInt(1, 9999)}`,
    keywords: ['username', 'user', 'login', 'id'],
    backendType: 'username',
    supportsUnlimited: true,
  },
  {
    id: 'password_simple',
    name: 'Password (Simple)',
    category: 'account',
    description: 'Simple password for testing',
    example: () => 'Test1234!',
    generate: () => `Test${randInt(1000, 9999)}!`,
    keywords: ['password', 'pwd', 'pass', 'simple'],
  },
  {
    id: 'password_strong',
    name: 'Password (Strong)',
    category: 'account',
    description: 'Complex password with special chars',
    example: () => 'Qw3rty!@#2024',
    generate: () => {
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%';
      return Array.from({ length: 16 }, () => chars[randInt(0, chars.length - 1)]).join('');
    },
    keywords: ['password', 'strong', 'secure', 'complex'],
  },

  // ===== BUSINESS =====
  {
    id: 'company_name',
    name: 'Company Name',
    category: 'business',
    description: 'Random company name',
    example: () => `${pick(COMPANY_PREFIXES)} ${pick(COMPANY_SUFFIXES)}`,
    generate: () => `${pick(COMPANY_PREFIXES)} ${pick(COMPANY_SUFFIXES)}`,
    keywords: ['company', 'business', 'organization', 'org'],
    backendType: 'companyName',
    supportsUnlimited: true,
  },
  {
    id: 'job_title',
    name: 'Job Title',
    category: 'business',
    description: 'Random job title',
    example: () => pick(JOB_TITLES),
    generate: () => pick(JOB_TITLES),
    keywords: ['job', 'title', 'position', 'role', 'occupation'],
    backendType: 'jobTitle',
    supportsUnlimited: true,
  },
  {
    id: 'department',
    name: 'Department',
    category: 'business',
    description: 'Company department',
    example: () => pick(['Engineering', 'Marketing', 'Sales']),
    generate: () => pick(['Engineering', 'Marketing', 'Sales', 'HR', 'Finance', 'Operations', 'Support', 'Legal', 'Product']),
    keywords: ['department', 'dept', 'team'],
  },

  // ===== WEB & TECH =====
  {
    id: 'url',
    name: 'Website URL',
    category: 'web',
    description: 'Random website URL',
    example: () => `https://www.${pick(COMPANY_PREFIXES).toLowerCase()}.com`,
    generate: () => `https://www.${pick(COMPANY_PREFIXES).toLowerCase().replace(/\s/g, '')}.com`,
    keywords: ['url', 'website', 'link', 'web'],
  },
  {
    id: 'ip_address',
    name: 'IP Address',
    category: 'web',
    description: 'Random IPv4 address',
    example: () => `${randInt(1, 255)}.${randInt(0, 255)}.${randInt(0, 255)}.${randInt(0, 255)}`,
    generate: () => `${randInt(1, 255)}.${randInt(0, 255)}.${randInt(0, 255)}.${randInt(0, 255)}`,
    keywords: ['ip', 'address', 'ipv4'],
  },
  {
    id: 'uuid',
    name: 'UUID',
    category: 'web',
    description: 'Random UUID v4',
    example: () => 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    }),
    generate: () => 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    }),
    keywords: ['uuid', 'guid', 'id', 'unique'],
  },

  // ===== NUMBERS =====
  {
    id: 'number',
    name: 'Random Number',
    category: 'numbers',
    description: 'Random integer in range',
    example: () => String(randInt(1, 100)),
    generate: (c) => String(randInt(c?.min ?? 1, c?.max ?? 100)),
    keywords: ['number', 'integer', 'random', 'num'],
    constraints: [
      { label: 'Min', type: 'number', key: 'min', default: 1 },
      { label: 'Max', type: 'number', key: 'max', default: 100 },
    ],
  },
  {
    id: 'quantity',
    name: 'Quantity (1-10)',
    category: 'numbers',
    description: 'Small quantity for forms',
    example: () => String(randInt(1, 10)),
    generate: () => String(randInt(1, 10)),
    keywords: ['quantity', 'qty', 'count', 'amount'],
  },
  {
    id: 'percentage',
    name: 'Percentage',
    category: 'numbers',
    description: 'Random percentage (0-100)',
    example: () => `${randInt(0, 100)}%`,
    generate: () => `${randInt(0, 100)}%`,
    keywords: ['percentage', 'percent', '%'],
  },

  // ===== TEXT =====
  {
    id: 'text_short',
    name: 'Short Text',
    category: 'text',
    description: 'A few random words',
    example: () => `${pick(LOREM_WORDS)} ${pick(LOREM_WORDS)} ${pick(LOREM_WORDS)}`,
    generate: () => Array.from({ length: 3 }, () => pick(LOREM_WORDS)).join(' '),
    keywords: ['text', 'short', 'words'],
  },
  {
    id: 'text_sentence',
    name: 'Sentence',
    category: 'text',
    description: 'One complete sentence',
    example: () => 'Lorem ipsum dolor sit amet.',
    generate: () => Array.from({ length: randInt(5, 10) }, () => pick(LOREM_WORDS)).join(' ') + '.',
    keywords: ['text', 'sentence', 'lorem'],
  },
  {
    id: 'text_paragraph',
    name: 'Paragraph',
    category: 'text',
    description: 'A full paragraph of text',
    example: () => 'Lorem ipsum dolor sit amet, consectetur adipiscing elit...',
    generate: () => {
      const sentences = randInt(3, 5);
      return Array.from({ length: sentences }, () => 
        Array.from({ length: randInt(5, 12) }, () => pick(LOREM_WORDS)).join(' ') + '.'
      ).join(' ');
    },
    keywords: ['text', 'paragraph', 'lorem', 'long', 'description'],
  },
  {
    id: 'text_alphanumeric',
    name: 'Alphanumeric Code',
    category: 'text',
    description: 'Random letters and numbers',
    example: () => 'ABC123XYZ',
    generate: (c) => {
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
      const len = c?.length ?? 8;
      return Array.from({ length: len }, () => chars[randInt(0, chars.length - 1)]).join('');
    },
    keywords: ['alphanumeric', 'code', 'id', 'reference'],
    constraints: [
      { label: 'Length', type: 'number', key: 'length', default: 8 },
    ],
  },
];

// ============================================================================
// SEARCH FUNCTION
// ============================================================================

export function searchGenerators(query: string): SmartFillGenerator[] {
  if (!query.trim()) return SMART_FILL_GENERATORS;
  
  const q = query.toLowerCase().trim();
  const words = q.split(/\s+/);
  
  return SMART_FILL_GENERATORS.filter(gen => {
    const searchText = [
      gen.name,
      gen.description,
      gen.category,
      ...gen.keywords
    ].join(' ').toLowerCase();
    
    return words.every(word => searchText.includes(word));
  });
}

export function getGeneratorsByCategory(categoryId: string): SmartFillGenerator[] {
  return SMART_FILL_GENERATORS.filter(gen => gen.category === categoryId);
}

export function getGeneratorById(id: string): SmartFillGenerator | undefined {
  return SMART_FILL_GENERATORS.find(gen => gen.id === id);
}





