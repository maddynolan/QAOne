/**
 * Test Data Generation Utilities
 *
 * Extracted from UnifiedWorkflowEditor.tsx.
 * Pure functions for generating synthetic test data (names, emails, addresses, etc.).
 */

// ============================================================================
// FIELD TYPE DETECTION
// ============================================================================

/**
 * Smart field type detection - matches field label/name to appropriate data type
 * Handles formats like "Input: *Year", "*Day", "First name", etc.
 * Returns the detected type and any constraints
 */
export function detectFieldType(fieldText: string): { type: string; constraints?: Record<string, any> } {
  // Clean the text: remove "Input:", "*", ":", leading/trailing spaces
  const text = fieldText
    .replace(/^input\s*:\s*/i, '')  // Remove "Input: "
    .replace(/^\*+/, '')             // Remove leading asterisks
    .replace(/[:\*]+/g, ' ')         // Replace colons and asterisks with spaces
    .trim()
    .toLowerCase();

  // === DATE COMPONENTS (must check FIRST - before anything else) ===
  // Day of month (1-31)
  if (/^day$/i.test(text) || /\bday\b/i.test(text) && !/birth.*day|holiday|today/i.test(text)) {
    return { type: 'day', constraints: { minValue: 1, maxValue: 28 } };
  }
  // Month (1-12)
  if (/^month$/i.test(text) || /\bmonth\b/i.test(text) && !/monthly/i.test(text)) {
    return { type: 'month', constraints: { minValue: 1, maxValue: 12 } };
  }
  // Year
  if (/^year$/i.test(text) || /\byear\b/i.test(text) && !/yearly/i.test(text)) {
    return { type: 'birth_year', constraints: { minAge: 18, maxAge: 80 } };
  }
  if (/expir.*year|exp.*year/i.test(text)) {
    return { type: 'expiry_year', constraints: { minValue: new Date().getFullYear(), maxValue: new Date().getFullYear() + 10 } };
  }

  // === NAMES ===
  if (/^first\s*name$|^first$|fname|given/i.test(text)) {
    return { type: 'first_name' };
  }
  if (/^middle\s*name$|^middle$|mname/i.test(text)) {
    return { type: 'middle_name' };
  }
  if (/^last\s*name$|^last$|lname|surname|family/i.test(text)) {
    return { type: 'last_name' };
  }
  if (/^full\s*name$|^name$/i.test(text) && !/user|company|org|file/i.test(text)) {
    return { type: 'full_name' };
  }

  // === CONTACT INFO ===
  if (/email|e-mail/i.test(text)) {
    return { type: 'email' };
  }
  if (/phone|tel|mobile|cell/i.test(text)) {
    return { type: 'phone' };
  }

  // === ADDRESS COMPONENTS ===
  if (/street|address\s*1|address\s*line|^addr/i.test(text) && !/email/i.test(text)) {
    return { type: 'street_address' };
  }
  if (/address\s*2|^apt$|suite|unit/i.test(text)) {
    return { type: 'address_line2' };
  }
  if (/^city$|city/i.test(text)) {
    return { type: 'city' };
  }
  if (/^state$|state|province/i.test(text)) {
    return { type: 'state' };
  }
  if (/zip|postal/i.test(text)) {
    return { type: 'zip' };
  }
  if (/country/i.test(text)) {
    return { type: 'country' };
  }

  // === FINANCIAL ===
  if (/card\s*number|credit\s*card/i.test(text)) {
    return { type: 'credit_card' };
  }
  if (/cvv|cvc|security\s*code/i.test(text)) {
    return { type: 'cvv', constraints: { length: 3 } };
  }
  if (/expir.*month|exp.*month/i.test(text)) {
    return { type: 'expiry_month', constraints: { minValue: 1, maxValue: 12 } };
  }
  if (/amount|price|cost|total|balance/i.test(text)) {
    return { type: 'currency', constraints: { minValue: 1, maxValue: 1000 } };
  }

  // === IDENTITY ===
  if (/ssn|social\s*security/i.test(text)) {
    return { type: 'ssn' };
  }
  if (/^age$/i.test(text)) {
    return { type: 'age', constraints: { minValue: 18, maxValue: 80 } };
  }
  if (/gender|sex/i.test(text)) {
    return { type: 'gender' };
  }

  // === ACCOUNT ===
  if (/username|user\s*name|user\s*id|^login$/i.test(text)) {
    return { type: 'username' };
  }
  if (/password|pwd|^pass$/i.test(text)) {
    return { type: 'password' };
  }

  // === BUSINESS ===
  if (/company|org|business|employer/i.test(text)) {
    return { type: 'company' };
  }
  if (/job|title|position|occupation/i.test(text) && !/user/i.test(text)) {
    return { type: 'job_title' };
  }

  // === WEB ===
  if (/url|website|link|homepage/i.test(text)) {
    return { type: 'url' };
  }

  // === TEXT FIELDS ===
  if (/description|comment|note|message|bio|about/i.test(text)) {
    return { type: 'paragraph' };
  }

  // === NUMBERS ===
  if (/qty|quantity|count|^number$|^num$/i.test(text)) {
    return { type: 'number', constraints: { minValue: 1, maxValue: 100 } };
  }

  // === FULL DATE ===
  if (/^date$|dob|birth|birthday/i.test(text)) {
    return { type: 'date' };
  }

  // Default - generic text
  return { type: 'text' };
}

// ============================================================================
// RANDOM DATA POOLS
// ============================================================================

/**
 * Large datasets for random generation (1000+ unique combinations)
 */
export const RANDOM_DATA = {
  // 100 first names (male + female) = 100 options
  firstNames: [
    'James', 'Mary', 'John', 'Patricia', 'Robert', 'Jennifer', 'Michael', 'Linda', 'William', 'Elizabeth',
    'David', 'Barbara', 'Richard', 'Susan', 'Joseph', 'Jessica', 'Thomas', 'Sarah', 'Charles', 'Karen',
    'Christopher', 'Nancy', 'Daniel', 'Lisa', 'Matthew', 'Betty', 'Anthony', 'Margaret', 'Mark', 'Sandra',
    'Donald', 'Ashley', 'Steven', 'Kimberly', 'Paul', 'Emily', 'Andrew', 'Donna', 'Joshua', 'Michelle',
    'Kenneth', 'Dorothy', 'Kevin', 'Carol', 'Brian', 'Amanda', 'George', 'Melissa', 'Edward', 'Deborah',
    'Ronald', 'Stephanie', 'Timothy', 'Rebecca', 'Jason', 'Sharon', 'Jeffrey', 'Laura', 'Ryan', 'Cynthia',
    'Jacob', 'Kathleen', 'Gary', 'Amy', 'Nicholas', 'Angela', 'Eric', 'Shirley', 'Jonathan', 'Anna',
    'Stephen', 'Brenda', 'Larry', 'Pamela', 'Justin', 'Emma', 'Scott', 'Nicole', 'Brandon', 'Helen',
    'Benjamin', 'Samantha', 'Samuel', 'Katherine', 'Raymond', 'Christine', 'Gregory', 'Debra', 'Frank', 'Rachel',
    'Alexander', 'Carolyn', 'Patrick', 'Janet', 'Jack', 'Catherine', 'Dennis', 'Maria', 'Jerry', 'Heather',
  ],
  // 100 last names = 100 options (100 x 100 = 10,000 name combinations)
  lastNames: [
    'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez',
    'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson', 'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin',
    'Lee', 'Perez', 'Thompson', 'White', 'Harris', 'Sanchez', 'Clark', 'Ramirez', 'Lewis', 'Robinson',
    'Walker', 'Young', 'Allen', 'King', 'Wright', 'Scott', 'Torres', 'Nguyen', 'Hill', 'Flores',
    'Green', 'Adams', 'Nelson', 'Baker', 'Hall', 'Rivera', 'Campbell', 'Mitchell', 'Carter', 'Roberts',
    'Gomez', 'Phillips', 'Evans', 'Turner', 'Diaz', 'Parker', 'Cruz', 'Edwards', 'Collins', 'Reyes',
    'Stewart', 'Morris', 'Morales', 'Murphy', 'Cook', 'Rogers', 'Gutierrez', 'Ortiz', 'Morgan', 'Cooper',
    'Peterson', 'Bailey', 'Reed', 'Kelly', 'Howard', 'Ramos', 'Kim', 'Cox', 'Ward', 'Richardson',
    'Watson', 'Brooks', 'Chavez', 'Wood', 'James', 'Bennett', 'Gray', 'Mendoza', 'Ruiz', 'Hughes',
    'Price', 'Alvarez', 'Castillo', 'Sanders', 'Patel', 'Myers', 'Long', 'Ross', 'Foster', 'Jimenez',
  ],
  // 20 email domains
  emailDomains: [
    'gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'icloud.com',
    'test.com', 'example.com', 'demo.org', 'sample.net', 'testmail.io',
    'mailtest.com', 'qatest.org', 'automation.io', 'testdata.com', 'mockmail.net',
    'tempmail.org', 'testuser.com', 'demouser.net', 'sampledata.io', 'autotest.com',
  ],
  // 50 street names
  streetNames: [
    'Main', 'Oak', 'Maple', 'Cedar', 'Pine', 'Elm', 'Washington', 'Park', 'Lake', 'Hill',
    'Walnut', 'Sunset', 'River', 'Spring', 'Forest', 'Church', 'Highland', 'Valley', 'Meadow', 'Grove',
    'Willow', 'Cherry', 'Lincoln', 'Jefferson', 'Franklin', 'Jackson', 'Adams', 'Madison', 'Monroe', 'Wilson',
    'Broadway', 'Central', 'First', 'Second', 'Third', 'Fourth', 'Fifth', 'Mill', 'Bridge', 'School',
    'North', 'South', 'East', 'West', 'College', 'Market', 'Harbor', 'Center', 'Vista', 'Ridge',
  ],
  // 20 street types
  streetTypes: ['Street', 'Avenue', 'Boulevard', 'Drive', 'Lane', 'Road', 'Court', 'Place', 'Way', 'Circle',
    'Terrace', 'Trail', 'Parkway', 'Commons', 'Square', 'Loop', 'Run', 'Path', 'Crossing', 'Heights'],
  // 100 cities (US + international)
  cities: [
    'New York', 'Los Angeles', 'Chicago', 'Houston', 'Phoenix', 'Philadelphia', 'San Antonio', 'San Diego',
    'Dallas', 'San Jose', 'Austin', 'Jacksonville', 'Fort Worth', 'Columbus', 'Charlotte', 'San Francisco',
    'Indianapolis', 'Seattle', 'Denver', 'Washington', 'Boston', 'Nashville', 'Baltimore', 'Oklahoma City',
    'Louisville', 'Portland', 'Las Vegas', 'Milwaukee', 'Albuquerque', 'Tucson', 'Fresno', 'Sacramento',
    'Mesa', 'Kansas City', 'Atlanta', 'Miami', 'Oakland', 'Minneapolis', 'Cleveland', 'Tampa',
    'London', 'Paris', 'Tokyo', 'Sydney', 'Toronto', 'Berlin', 'Madrid', 'Rome', 'Amsterdam', 'Vienna',
    'Dublin', 'Barcelona', 'Munich', 'Prague', 'Brussels', 'Stockholm', 'Copenhagen', 'Oslo', 'Helsinki', 'Zurich',
    'Singapore', 'Hong Kong', 'Seoul', 'Shanghai', 'Beijing', 'Mumbai', 'Delhi', 'Bangkok', 'Dubai', 'Cairo',
    'Mexico City', 'S\u00e3o Paulo', 'Buenos Aires', 'Lima', 'Bogot\u00e1', 'Santiago', 'Johannesburg', 'Lagos', 'Nairobi', 'Cape Town',
    'Melbourne', 'Brisbane', 'Perth', 'Auckland', 'Wellington', 'Vancouver', 'Montreal', 'Calgary', 'Ottawa', 'Edmonton',
    'Manchester', 'Birmingham', 'Glasgow', 'Liverpool', 'Leeds', 'Bristol', 'Sheffield', 'Edinburgh', 'Cardiff', 'Belfast',
  ],
  // 50 US states
  states: [
    'Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California', 'Colorado', 'Connecticut', 'Delaware', 'Florida', 'Georgia',
    'Hawaii', 'Idaho', 'Illinois', 'Indiana', 'Iowa', 'Kansas', 'Kentucky', 'Louisiana', 'Maine', 'Maryland',
    'Massachusetts', 'Michigan', 'Minnesota', 'Mississippi', 'Missouri', 'Montana', 'Nebraska', 'Nevada', 'New Hampshire', 'New Jersey',
    'New Mexico', 'New York', 'North Carolina', 'North Dakota', 'Ohio', 'Oklahoma', 'Oregon', 'Pennsylvania', 'Rhode Island', 'South Carolina',
    'South Dakota', 'Tennessee', 'Texas', 'Utah', 'Vermont', 'Virginia', 'Washington', 'West Virginia', 'Wisconsin', 'Wyoming',
  ],
  // State abbreviations
  stateAbbreviations: [
    'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA', 'HI', 'ID', 'IL', 'IN', 'IA',
    'KS', 'KY', 'LA', 'ME', 'MD', 'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
    'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC', 'SD', 'TN', 'TX', 'UT', 'VT',
    'VA', 'WA', 'WV', 'WI', 'WY',
  ],
  // 50 company name prefixes
  companyPrefixes: [
    'Global', 'Tech', 'Digital', 'Advanced', 'Smart', 'Prime', 'Elite', 'Pro', 'Next', 'First',
    'United', 'National', 'American', 'Pacific', 'Atlantic', 'Sunrise', 'Sunset', 'Golden', 'Silver', 'Blue',
    'Green', 'Red', 'Alpha', 'Beta', 'Omega', 'Delta', 'Summit', 'Peak', 'Apex', 'Core',
    'Dynamic', 'Innovative', 'Creative', 'Strategic', 'Premier', 'Superior', 'Ultimate', 'Quantum', 'Fusion', 'Synergy',
    'Vertex', 'Pinnacle', 'Horizon', 'Zenith', 'Nova', 'Stellar', 'Cosmic', 'Infinity', 'Vision', 'Future',
  ],
  // 30 company suffixes
  companySuffixes: [
    'Solutions', 'Technologies', 'Systems', 'Services', 'Industries', 'Enterprises', 'Group', 'Corp', 'Inc', 'LLC',
    'Partners', 'Associates', 'Consulting', 'Labs', 'Works', 'Studio', 'Agency', 'Network', 'Media', 'Digital',
    'Software', 'Hardware', 'Electronics', 'Dynamics', 'Innovations', 'Ventures', 'Holdings', 'International', 'Global', 'Worldwide',
  ],
  // 20 job titles
  jobTitles: [
    'Software Engineer', 'Product Manager', 'Data Analyst', 'UX Designer', 'DevOps Engineer',
    'QA Engineer', 'Project Manager', 'Business Analyst', 'Marketing Manager', 'Sales Representative',
    'HR Manager', 'Financial Analyst', 'Operations Manager', 'Technical Lead', 'Architect',
    'Consultant', 'Director', 'Vice President', 'CEO', 'CTO',
  ],
  // Words for generating text
  words: [
    'test', 'sample', 'demo', 'example', 'automation', 'quality', 'data', 'input', 'output', 'result',
    'user', 'admin', 'system', 'process', 'workflow', 'action', 'event', 'task', 'item', 'record',
    'alpha', 'beta', 'gamma', 'delta', 'epsilon', 'zeta', 'eta', 'theta', 'iota', 'kappa',
  ],
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/** Pick random item from array */
export const randomPick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

/** Generate random string of given length */
export const randomString = (length: number, chars = 'abcdefghijklmnopqrstuvwxyz0123456789'): string => {
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

// ============================================================================
// SMART VALUE GENERATION
// ============================================================================

/**
 * Generate synthetic test data based on field name/type
 * Uses smart detection and RANDOM_DATA for variety
 */
export function generateTestValue(fieldNameOrTarget: string): string {
  const detected = detectFieldType(fieldNameOrTarget);
  return generateSmartValue(detected.type, fieldNameOrTarget, detected.constraints);
}

/**
 * Generate smart test values based on detected type
 * Supports constraints for bounded values (day, month, year, numbers)
 */
export function generateSmartValue(type: string, fieldHint: string = '', constraints?: Record<string, any>): string {
  const randomNum = Math.floor(Math.random() * 100000);
  const currentYear = new Date().getFullYear();
  const c = constraints || {};

  switch (type) {
    // === AUTO-DETECT (uses smart detection) ===
    case 'auto': {
      const detected = detectFieldType(fieldHint);
      return generateSmartValue(detected.type, fieldHint, detected.constraints);
    }

    // === DATE COMPONENTS ===
    case 'day': {
      const min = c.minValue ?? 1;
      const max = c.maxValue ?? 28; // Safe default
      return String(Math.floor(Math.random() * (max - min + 1)) + min).padStart(2, '0');
    }

    case 'month': {
      const min = c.minValue ?? 1;
      const max = c.maxValue ?? 12;
      return String(Math.floor(Math.random() * (max - min + 1)) + min).padStart(2, '0');
    }

    case 'year':
    case 'birth_year': {
      const minAge = c.minAge ?? 18;
      const maxAge = c.maxAge ?? 80;
      const maxYear = currentYear - minAge;
      const minYear = currentYear - maxAge;
      return String(Math.floor(Math.random() * (maxYear - minYear + 1)) + minYear);
    }

    case 'expiry_year': {
      const min = c.minValue ?? currentYear;
      const max = c.maxValue ?? (currentYear + 10);
      return String(Math.floor(Math.random() * (max - min + 1)) + min);
    }

    case 'expiry_month': {
      return String(Math.floor(Math.random() * 12) + 1).padStart(2, '0');
    }

    // === NAMES ===
    case 'full_name':
    case 'name':
      return `${randomPick(RANDOM_DATA.firstNames)} ${randomPick(RANDOM_DATA.lastNames)}`;

    case 'first_name':
      return randomPick(RANDOM_DATA.firstNames);

    case 'middle_name':
      // Use first names as middle names, or initials
      return Math.random() > 0.5 ? randomPick(RANDOM_DATA.firstNames) : randomPick(RANDOM_DATA.firstNames).charAt(0);

    case 'last_name':
      return randomPick(RANDOM_DATA.lastNames);

    // === EMAIL (customizable) ===
    case 'email': {
      const emailFirst = randomPick(RANDOM_DATA.firstNames).toLowerCase();
      const emailLast = randomPick(RANDOM_DATA.lastNames).toLowerCase();
      const emailNum = Math.floor(Math.random() * 1000);
      const domain = c.domain ?? randomPick(RANDOM_DATA.emailDomains);
      const prefix = c.prefix ?? '';

      const formats = [
        `${prefix}${emailFirst}${emailNum}@${domain}`,
        `${prefix}${emailFirst}.${emailLast}@${domain}`,
        `${prefix}${emailFirst}_${emailLast}${emailNum}@${domain}`,
        `${prefix}test.${emailFirst}${emailNum}@${domain}`,
      ];
      return randomPick(formats);
    }

    // === PHONE ===
    case 'phone': {
      const areaCodes = ['201', '212', '310', '312', '404', '415', '503', '602', '650', '702'];
      const format = c.format ?? 'us';
      if (format === 'international') {
        return `+1 ${randomPick(areaCodes)} ${Math.floor(Math.random() * 900) + 100} ${Math.floor(Math.random() * 9000) + 1000}`;
      }
      return `(${randomPick(areaCodes)}) ${Math.floor(Math.random() * 900) + 100}-${Math.floor(Math.random() * 9000) + 1000}`;
    }

    // === ADDRESS ===
    case 'street_address':
    case 'address':
      return `${Math.floor(Math.random() * 9999) + 1} ${randomPick(RANDOM_DATA.streetNames)} ${randomPick(RANDOM_DATA.streetTypes)}`;

    case 'address_line2': {
      const aptTypes = ['Apt', 'Suite', 'Unit', '#'];
      return `${randomPick(aptTypes)} ${Math.floor(Math.random() * 999) + 1}`;
    }

    case 'city':
      return randomPick(RANDOM_DATA.cities);

    case 'state':
      return randomPick(RANDOM_DATA.states);

    case 'state_abbr':
      return randomPick(RANDOM_DATA.stateAbbreviations);

    case 'zip':
      return String(Math.floor(Math.random() * 90000) + 10000);

    case 'country':
      return randomPick(['United States', 'Canada', 'United Kingdom', 'Australia', 'Germany', 'France']);

    // === FINANCIAL ===
    case 'credit_card':
      return `4111 ${Math.floor(Math.random() * 9000) + 1000} ${Math.floor(Math.random() * 9000) + 1000} ${Math.floor(Math.random() * 9000) + 1000}`;

    case 'cvv': {
      const len = c.length ?? 3;
      return String(Math.floor(Math.random() * Math.pow(10, len))).padStart(len, '0');
    }

    case 'currency':
    case 'amount': {
      const min = c.minValue ?? 1;
      const max = c.maxValue ?? 1000;
      const value = Math.floor(Math.random() * (max - min + 1)) + min;
      return value.toFixed(2);
    }

    // === IDENTITY ===
    case 'ssn':
      return `${Math.floor(Math.random() * 900) + 100}-${Math.floor(Math.random() * 90) + 10}-${Math.floor(Math.random() * 9000) + 1000}`;

    case 'age': {
      const min = c.minValue ?? 18;
      const max = c.maxValue ?? 80;
      return String(Math.floor(Math.random() * (max - min + 1)) + min);
    }

    case 'gender':
      return randomPick(['Male', 'Female', 'Other', 'Prefer not to say']);

    // === ACCOUNT ===
    case 'username':
      return `${randomPick(RANDOM_DATA.firstNames).toLowerCase()}${Math.floor(Math.random() * 10000)}`;

    case 'password': {
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%';
      const pwLen = c.length ?? 12;
      let pw = '';
      for (let i = 0; i < pwLen; i++) pw += chars.charAt(Math.floor(Math.random() * chars.length));
      return pw;
    }

    // === BUSINESS ===
    case 'company':
      return `${randomPick(RANDOM_DATA.companyPrefixes)} ${randomPick(RANDOM_DATA.companySuffixes)}`;

    case 'job_title':
      return randomPick(RANDOM_DATA.jobTitles);

    // === WEB ===
    case 'url':
      return `https://www.${randomPick(RANDOM_DATA.companyPrefixes).toLowerCase().replace(/\s/g, '')}.com`;

    case 'ip_address':
      return `${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}`;

    // === DATES ===
    case 'date':
      return new Date().toISOString().split('T')[0];

    case 'date_future': {
      const days = Math.floor(Math.random() * 365) + 1;
      const d = new Date();
      d.setDate(d.getDate() + days);
      return d.toISOString().split('T')[0];
    }

    case 'date_past': {
      const days = Math.floor(Math.random() * 365) + 1;
      const d = new Date();
      d.setDate(d.getDate() - days);
      return d.toISOString().split('T')[0];
    }

    // === NUMBERS ===
    case 'number': {
      const min = c.minValue ?? 1;
      const max = c.maxValue ?? 100;
      return String(Math.floor(Math.random() * (max - min + 1)) + min);
    }

    // === TEXT ===
    case 'paragraph':
    case 'lorem': {
      const words = ['lorem', 'ipsum', 'dolor', 'sit', 'amet', 'consectetur', 'adipiscing', 'elit', 'sed', 'tempor'];
      return Array.from({length: 15}, () => randomPick(words)).join(' ') + '.';
    }

    case 'text':
    default:
      // For unknown types, generate sensible text
      return `Test_${randomPick(RANDOM_DATA.words)}_${Math.floor(Math.random() * 1000)}`;
  }
}
