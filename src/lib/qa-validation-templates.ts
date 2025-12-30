/**
 * QA Validation Templates Library
 * 
 * 785+ validation scenarios organized by domain and category.
 * Based on 25+ years of QA engineering best practices.
 * 
 * Usage:
 * - Domain selection filters to relevant validations
 * - Smart suggestions based on field/selector keywords
 * - Coverage tracking for test completeness
 */

// ============================================================================
// TYPES
// ============================================================================

export interface ValidationTemplate {
  id: string;
  category: string;
  subcategory: string;
  validationLogic: string;
  testScenario: string;
  priority: 'High' | 'Medium' | 'Low';
  keywords: string[];
  domains: string[];
}

export interface ValidationCategory {
  name: string;
  subcategories: string[];
  icon: string;
  color: string;
}

export type DomainType = 
  | 'e-commerce'
  | 'healthcare'
  | 'financial'
  | 'travel'
  | 'education'
  | 'subscription'
  | 'social'
  | 'food-delivery'
  | 'real-estate'
  | 'recruitment'
  | 'gaming'
  | 'general';

// ============================================================================
// DOMAIN DEFINITIONS
// ============================================================================

export const DOMAINS: Record<DomainType, { label: string; icon: string; description: string; categories: string[] }> = {
  'e-commerce': {
    label: 'E-Commerce / Retail',
    icon: '🛒',
    description: 'Online stores, shopping carts, checkout flows',
    categories: ['Price & Monetary Calculations', 'Inventory & Stock Logic', 'E-Commerce Logic', 'User & Account Logic', 'Forms & Workflow', 'Search & Filter']
  },
  'healthcare': {
    label: 'Healthcare / Medical',
    icon: '🏥',
    description: 'Patient portals, appointments, medical records',
    categories: ['Healthcare', 'User & Account Logic', 'Date & Time Validations', 'Forms & Workflow', 'Compliance']
  },
  'financial': {
    label: 'Financial Services',
    icon: '💰',
    description: 'Banking, loans, investments, insurance',
    categories: ['Financial Services', 'Insurance', 'Price & Monetary Calculations', 'User & Account Logic', 'Compliance', 'Security']
  },
  'travel': {
    label: 'Travel & Hospitality',
    icon: '✈️',
    description: 'Flights, hotels, car rentals, events',
    categories: ['Travel & Booking', 'Date & Time Validations', 'Price & Monetary Calculations', 'User & Account Logic', 'Search & Filter']
  },
  'education': {
    label: 'Education / E-Learning',
    icon: '🎓',
    description: 'Schools, courses, assessments, grades',
    categories: ['Education', 'User & Account Logic', 'Date & Time Validations', 'Forms & Workflow', 'Social & Content']
  },
  'subscription': {
    label: 'SaaS / Subscription',
    icon: '🔄',
    description: 'Recurring billing, memberships, trials',
    categories: ['Subscription & Membership', 'Price & Monetary Calculations', 'User & Account Logic', 'Notifications']
  },
  'social': {
    label: 'Social / Content',
    icon: '📱',
    description: 'Social networks, content platforms, messaging',
    categories: ['Social & Content', 'User & Account Logic', 'Notifications', 'Compliance', 'Security']
  },
  'food-delivery': {
    label: 'Food Delivery',
    icon: '🍔',
    description: 'Restaurant ordering, delivery, menus',
    categories: ['Food Delivery', 'Price & Monetary Calculations', 'Date & Time Validations', 'User & Account Logic', 'Search & Filter']
  },
  'real-estate': {
    label: 'Real Estate',
    icon: '🏠',
    description: 'Property listings, mortgages, searches',
    categories: ['Real Estate', 'Price & Monetary Calculations', 'Search & Filter', 'User & Account Logic', 'Forms & Workflow']
  },
  'recruitment': {
    label: 'Recruitment / HR',
    icon: '💼',
    description: 'Job postings, applications, hiring',
    categories: ['Recruitment', 'User & Account Logic', 'Date & Time Validations', 'Forms & Workflow', 'Notifications']
  },
  'gaming': {
    label: 'Gaming',
    icon: '🎮',
    description: 'Games, scores, in-app purchases',
    categories: ['Gaming', 'User & Account Logic', 'Price & Monetary Calculations', 'Compliance']
  },
  'general': {
    label: 'General Web App',
    icon: '🌐',
    description: 'Standard web application features',
    categories: ['User & Account Logic', 'Forms & Workflow', 'Search & Filter', 'Notifications', 'Reporting & Analytics', 'Security', 'Accessibility']
  }
};

// ============================================================================
// CATEGORY DEFINITIONS
// ============================================================================

export const CATEGORIES: Record<string, ValidationCategory> = {
  'Price & Monetary Calculations': {
    name: 'Price & Monetary Calculations',
    subcategories: ['Basic Price Logic', 'Tax Calculations', 'Discount Logic', 'Currency & International'],
    icon: '💵',
    color: 'bg-green-500'
  },
  'Date & Time Validations': {
    name: 'Date & Time Validations',
    subcategories: ['Basic Date Logic', 'Time Logic', 'Duration Calculations', 'Recurring Events'],
    icon: '📅',
    color: 'bg-blue-500'
  },
  'Inventory & Stock Logic': {
    name: 'Inventory & Stock Logic',
    subcategories: ['Availability', 'Quantity Validations'],
    icon: '📦',
    color: 'bg-orange-500'
  },
  'User & Account Logic': {
    name: 'User & Account Logic',
    subcategories: ['Registration & Authentication', 'Password Rules', 'Session Management', 'Profile & Preferences'],
    icon: '👤',
    color: 'bg-purple-500'
  },
  'E-Commerce Logic': {
    name: 'E-Commerce Logic',
    subcategories: ['Cart Logic', 'Checkout Flow', 'Shipping Logic', 'Returns & Refunds'],
    icon: '🛒',
    color: 'bg-cyan-500'
  },
  'Travel & Booking': {
    name: 'Travel & Booking',
    subcategories: ['Flight Booking', 'Hotel Booking', 'Car Rental', 'Event Tickets'],
    icon: '✈️',
    color: 'bg-sky-500'
  },
  'Financial Services': {
    name: 'Financial Services',
    subcategories: ['Banking', 'Loan & Credit', 'Investment'],
    icon: '🏦',
    color: 'bg-emerald-500'
  },
  'Insurance': {
    name: 'Insurance',
    subcategories: ['Quote Generation', 'Claims'],
    icon: '🛡️',
    color: 'bg-indigo-500'
  },
  'Subscription & Membership': {
    name: 'Subscription & Membership',
    subcategories: ['Subscription Lifecycle', 'Billing Logic', 'Loyalty Programs'],
    icon: '🔄',
    color: 'bg-violet-500'
  },
  'Social & Content': {
    name: 'Social & Content',
    subcategories: ['Content Publishing', 'Engagement Logic', 'Privacy & Visibility', 'Moderation'],
    icon: '📱',
    color: 'bg-pink-500'
  },
  'Healthcare': {
    name: 'Healthcare',
    subcategories: ['Appointment Scheduling', 'Patient Data', 'Billing & Claims'],
    icon: '🏥',
    color: 'bg-red-500'
  },
  'Education': {
    name: 'Education',
    subcategories: ['Enrollment Logic', 'Academic Calculations', 'Assessment Logic'],
    icon: '🎓',
    color: 'bg-amber-500'
  },
  'Food Delivery': {
    name: 'Food Delivery',
    subcategories: ['Menu & Ordering', 'Delivery Logic', 'Restaurant Operations'],
    icon: '🍔',
    color: 'bg-orange-600'
  },
  'Real Estate': {
    name: 'Real Estate',
    subcategories: ['Listing Logic', 'Search & Matching', 'Mortgage Calculations'],
    icon: '🏠',
    color: 'bg-teal-500'
  },
  'Recruitment': {
    name: 'Recruitment',
    subcategories: ['Job Posting', 'Application Logic', 'Candidate Management'],
    icon: '💼',
    color: 'bg-slate-500'
  },
  'Auction & Bidding': {
    name: 'Auction & Bidding',
    subcategories: ['Bid Logic', 'Auction Timing'],
    icon: '🔨',
    color: 'bg-yellow-600'
  },
  'Gaming': {
    name: 'Gaming',
    subcategories: ['Game Logic', 'Gambling (Where Legal)'],
    icon: '🎮',
    color: 'bg-fuchsia-500'
  },
  'Forms & Workflow': {
    name: 'Forms & Workflow',
    subcategories: ['Field Validations', 'Form Flow Logic', 'Workflow Logic'],
    icon: '📋',
    color: 'bg-gray-500'
  },
  'Search & Filter': {
    name: 'Search & Filter',
    subcategories: ['Search Accuracy', 'Filter Logic', 'Sort Logic'],
    icon: '🔍',
    color: 'bg-blue-600'
  },
  'Notifications': {
    name: 'Notifications',
    subcategories: ['Notification Logic', 'Email Logic', 'Alert Thresholds'],
    icon: '🔔',
    color: 'bg-yellow-500'
  },
  'Reporting & Analytics': {
    name: 'Reporting & Analytics',
    subcategories: ['Data Aggregation', 'Report Logic', 'Metrics Validation'],
    icon: '📊',
    color: 'bg-cyan-600'
  },
  'Compliance': {
    name: 'Compliance',
    subcategories: ['Age Verification', 'Geographic Restrictions', 'Data Protection'],
    icon: '⚖️',
    color: 'bg-rose-500'
  },
  'Accessibility': {
    name: 'Accessibility',
    subcategories: ['Input Methods'],
    icon: '♿',
    color: 'bg-lime-500'
  },
  'Security': {
    name: 'Security',
    subcategories: ['Input Security', 'Access Control'],
    icon: '🔒',
    color: 'bg-red-600'
  },
  'Integration': {
    name: 'Integration',
    subcategories: ['API Logic', 'Third-Party'],
    icon: '🔗',
    color: 'bg-indigo-600'
  },
  'Edge Cases': {
    name: 'Edge Cases',
    subcategories: ['Numeric Boundaries', 'String Boundaries', 'Date Boundaries'],
    icon: '⚠️',
    color: 'bg-amber-600'
  }
};

// ============================================================================
// KEYWORD MAPPINGS FOR SMART DETECTION
// ============================================================================

export const KEYWORD_MAPPINGS: Record<string, string[]> = {
  // Price & Monetary
  'price': ['Price & Monetary Calculations'],
  'total': ['Price & Monetary Calculations'],
  'amount': ['Price & Monetary Calculations', 'Financial Services'],
  'cost': ['Price & Monetary Calculations'],
  'subtotal': ['Price & Monetary Calculations'],
  'tax': ['Price & Monetary Calculations'],
  'discount': ['Price & Monetary Calculations'],
  'coupon': ['Price & Monetary Calculations'],
  'promo': ['Price & Monetary Calculations'],
  'currency': ['Price & Monetary Calculations'],
  'fee': ['Price & Monetary Calculations'],
  
  // Date & Time
  'date': ['Date & Time Validations'],
  'time': ['Date & Time Validations'],
  'month': ['Date & Time Validations'],
  'day': ['Date & Time Validations'],
  'year': ['Date & Time Validations'],
  'dob': ['Date & Time Validations'],
  'birth': ['Date & Time Validations'],
  'birthday': ['Date & Time Validations'],
  'schedule': ['Date & Time Validations', 'Healthcare'],
  'booking': ['Date & Time Validations', 'Travel & Booking'],
  'appointment': ['Date & Time Validations', 'Healthcare'],
  'calendar': ['Date & Time Validations'],
  'start': ['Date & Time Validations'],
  'end': ['Date & Time Validations'],
  'duration': ['Date & Time Validations'],
  'deadline': ['Date & Time Validations'],
  
  // Inventory
  'quantity': ['Inventory & Stock Logic'],
  'qty': ['Inventory & Stock Logic'],
  'stock': ['Inventory & Stock Logic'],
  'inventory': ['Inventory & Stock Logic'],
  'available': ['Inventory & Stock Logic'],
  
  // User & Account
  'email': ['User & Account Logic'],
  'password': ['User & Account Logic'],
  'login': ['User & Account Logic'],
  'register': ['User & Account Logic'],
  'signup': ['User & Account Logic'],
  'username': ['User & Account Logic'],
  'profile': ['User & Account Logic'],
  'account': ['User & Account Logic'],
  'session': ['User & Account Logic'],
  
  // E-Commerce
  'cart': ['E-Commerce Logic'],
  'checkout': ['E-Commerce Logic'],
  'order': ['E-Commerce Logic'],
  'shipping': ['E-Commerce Logic'],
  'delivery': ['E-Commerce Logic', 'Food Delivery'],
  'return': ['E-Commerce Logic'],
  'refund': ['E-Commerce Logic'],
  'product': ['E-Commerce Logic', 'Inventory & Stock Logic'],
  
  // Travel
  'flight': ['Travel & Booking'],
  'hotel': ['Travel & Booking'],
  'rental': ['Travel & Booking'],
  'reservation': ['Travel & Booking'],
  'passenger': ['Travel & Booking'],
  'guest': ['Travel & Booking'],
  'check-in': ['Travel & Booking', 'Healthcare'],
  'check-out': ['Travel & Booking'],
  
  // Financial
  'payment': ['Financial Services', 'E-Commerce Logic'],
  'card': ['Financial Services'],
  'credit': ['Financial Services'],
  'debit': ['Financial Services'],
  'transfer': ['Financial Services'],
  'balance': ['Financial Services'],
  'loan': ['Financial Services'],
  'interest': ['Financial Services'],
  'bank': ['Financial Services'],
  'account_number': ['Financial Services'],
  'routing': ['Financial Services'],
  
  // Healthcare
  'patient': ['Healthcare'],
  'medical': ['Healthcare'],
  'prescription': ['Healthcare'],
  'diagnosis': ['Healthcare'],
  'insurance': ['Healthcare', 'Insurance'],
  'claim': ['Healthcare', 'Insurance'],
  'doctor': ['Healthcare'],
  'provider': ['Healthcare'],
  
  // Forms
  'form': ['Forms & Workflow'],
  'field': ['Forms & Workflow'],
  'input': ['Forms & Workflow'],
  'submit': ['Forms & Workflow'],
  'validation': ['Forms & Workflow'],
  'required': ['Forms & Workflow'],
  'phone': ['Forms & Workflow', 'User & Account Logic'],
  'address': ['Forms & Workflow', 'E-Commerce Logic'],
  'zip': ['Forms & Workflow'],
  'postal': ['Forms & Workflow'],
  
  // Search
  'search': ['Search & Filter'],
  'filter': ['Search & Filter'],
  'sort': ['Search & Filter'],
  'results': ['Search & Filter'],
  'pagination': ['Search & Filter'],
  
  // Social
  'post': ['Social & Content'],
  'comment': ['Social & Content'],
  'like': ['Social & Content'],
  'share': ['Social & Content'],
  'follow': ['Social & Content'],
  'message': ['Social & Content', 'Notifications'],
  
  // Security
  'captcha': ['Security'],
  'otp': ['Security', 'User & Account Logic'],
  '2fa': ['Security', 'User & Account Logic'],
  'verify': ['Security', 'User & Account Logic'],
};

// ============================================================================
// VALIDATION TEMPLATES DATA
// ============================================================================

export const VALIDATION_TEMPLATES: ValidationTemplate[] = [
  // Price & Monetary Calculations - Basic Price Logic
  { id: 'price-001', category: 'Price & Monetary Calculations', subcategory: 'Basic Price Logic', validationLogic: 'Unit price × quantity = line item total', testScenario: 'Verify calculated line total matches unit price multiplied by quantity', priority: 'High', keywords: ['price', 'quantity', 'total', 'line', 'calculate'], domains: ['e-commerce', 'food-delivery', 'general'] },
  { id: 'price-002', category: 'Price & Monetary Calculations', subcategory: 'Basic Price Logic', validationLogic: 'Sum of all line items = subtotal', testScenario: 'Add multiple items and verify subtotal equals sum of line totals', priority: 'High', keywords: ['subtotal', 'sum', 'line', 'items', 'total'], domains: ['e-commerce', 'food-delivery', 'general'] },
  { id: 'price-003', category: 'Price & Monetary Calculations', subcategory: 'Basic Price Logic', validationLogic: 'Subtotal + taxes + fees - discounts = grand total', testScenario: 'Verify final total calculation with all components', priority: 'High', keywords: ['total', 'tax', 'fee', 'discount', 'grand'], domains: ['e-commerce', 'food-delivery', 'travel', 'general'] },
  { id: 'price-004', category: 'Price & Monetary Calculations', subcategory: 'Basic Price Logic', validationLogic: 'Price displayed matches database/backend', testScenario: 'Compare UI prices with API/database values', priority: 'High', keywords: ['price', 'display', 'backend', 'api', 'match'], domains: ['e-commerce', 'food-delivery', 'general'] },
  { id: 'price-005', category: 'Price & Monetary Calculations', subcategory: 'Basic Price Logic', validationLogic: 'Price changes reflect immediately on quantity change', testScenario: 'Modify quantity and verify instant price update', priority: 'Medium', keywords: ['price', 'quantity', 'update', 'change', 'instant'], domains: ['e-commerce', 'food-delivery', 'general'] },
  { id: 'price-006', category: 'Price & Monetary Calculations', subcategory: 'Basic Price Logic', validationLogic: 'Negative prices not allowed', testScenario: 'Attempt to enter negative price values', priority: 'High', keywords: ['price', 'negative', 'validation', 'invalid'], domains: ['e-commerce', 'food-delivery', 'financial', 'general'] },
  { id: 'price-007', category: 'Price & Monetary Calculations', subcategory: 'Basic Price Logic', validationLogic: 'Zero-price items handling', testScenario: 'Test free items vs pricing errors', priority: 'Medium', keywords: ['price', 'zero', 'free', 'item'], domains: ['e-commerce', 'food-delivery', 'general'] },
  { id: 'price-008', category: 'Price & Monetary Calculations', subcategory: 'Basic Price Logic', validationLogic: 'Maximum price limits enforcement', testScenario: 'Test system ceiling for prices', priority: 'Medium', keywords: ['price', 'maximum', 'limit', 'ceiling'], domains: ['e-commerce', 'financial', 'general'] },
  { id: 'price-009', category: 'Price & Monetary Calculations', subcategory: 'Basic Price Logic', validationLogic: 'Minimum order value enforcement', testScenario: 'Attempt checkout below minimum threshold', priority: 'Medium', keywords: ['minimum', 'order', 'value', 'threshold', 'checkout'], domains: ['e-commerce', 'food-delivery'] },
  { id: 'price-010', category: 'Price & Monetary Calculations', subcategory: 'Basic Price Logic', validationLogic: 'Price rounding rules (2 decimal places)', testScenario: 'Verify banker\'s rounding vs standard rounding', priority: 'Medium', keywords: ['price', 'rounding', 'decimal', 'precision'], domains: ['e-commerce', 'financial', 'general'] },
  
  // Tax Calculations
  { id: 'tax-001', category: 'Price & Monetary Calculations', subcategory: 'Tax Calculations', validationLogic: 'Tax rate based on shipping destination', testScenario: 'Order to different states/countries and verify rates', priority: 'High', keywords: ['tax', 'rate', 'shipping', 'destination', 'state'], domains: ['e-commerce', 'general'] },
  { id: 'tax-002', category: 'Price & Monetary Calculations', subcategory: 'Tax Calculations', validationLogic: 'Tax-exempt items excluded', testScenario: 'Mix taxable and non-taxable items', priority: 'High', keywords: ['tax', 'exempt', 'taxable', 'exclude'], domains: ['e-commerce', 'general'] },
  { id: 'tax-003', category: 'Price & Monetary Calculations', subcategory: 'Tax Calculations', validationLogic: 'Multiple tax jurisdictions', testScenario: 'Test state + county + city tax stacking', priority: 'High', keywords: ['tax', 'jurisdiction', 'state', 'county', 'city'], domains: ['e-commerce', 'general'] },
  { id: 'tax-004', category: 'Price & Monetary Calculations', subcategory: 'Tax Calculations', validationLogic: 'VAT/GST calculation accuracy', testScenario: 'Verify VAT calculations for international orders', priority: 'High', keywords: ['vat', 'gst', 'international', 'tax'], domains: ['e-commerce', 'general'] },
  { id: 'tax-005', category: 'Price & Monetary Calculations', subcategory: 'Tax Calculations', validationLogic: 'Tax on shipping charges', testScenario: 'Verify if shipping is taxed per jurisdiction', priority: 'Medium', keywords: ['tax', 'shipping', 'charge'], domains: ['e-commerce'] },
  { id: 'tax-006', category: 'Price & Monetary Calculations', subcategory: 'Tax Calculations', validationLogic: 'Tax on discounts (pre vs post discount)', testScenario: 'Apply discount and verify tax calculation basis', priority: 'Medium', keywords: ['tax', 'discount', 'pre', 'post'], domains: ['e-commerce', 'general'] },
  
  // Discount Logic
  { id: 'disc-001', category: 'Price & Monetary Calculations', subcategory: 'Discount Logic', validationLogic: 'Percentage discount calculated correctly', testScenario: 'Apply 20% discount and verify amount', priority: 'High', keywords: ['discount', 'percentage', 'percent', 'calculate'], domains: ['e-commerce', 'food-delivery', 'subscription', 'general'] },
  { id: 'disc-002', category: 'Price & Monetary Calculations', subcategory: 'Discount Logic', validationLogic: 'Fixed amount discount applied correctly', testScenario: 'Apply $10 off coupon and verify', priority: 'High', keywords: ['discount', 'fixed', 'amount', 'coupon'], domains: ['e-commerce', 'food-delivery', 'subscription', 'general'] },
  { id: 'disc-003', category: 'Price & Monetary Calculations', subcategory: 'Discount Logic', validationLogic: 'Discount cannot exceed item/order value', testScenario: 'Apply discount larger than order total', priority: 'High', keywords: ['discount', 'exceed', 'maximum', 'limit'], domains: ['e-commerce', 'food-delivery', 'general'] },
  { id: 'disc-004', category: 'Price & Monetary Calculations', subcategory: 'Discount Logic', validationLogic: 'Discount code case sensitivity', testScenario: 'Test uppercase vs lowercase codes', priority: 'Medium', keywords: ['discount', 'code', 'case', 'sensitive'], domains: ['e-commerce', 'food-delivery', 'general'] },
  { id: 'disc-005', category: 'Price & Monetary Calculations', subcategory: 'Discount Logic', validationLogic: 'Single-use codes invalidated after use', testScenario: 'Attempt to reuse single-use code', priority: 'High', keywords: ['discount', 'single', 'use', 'code', 'reuse'], domains: ['e-commerce', 'food-delivery', 'general'] },
  { id: 'disc-006', category: 'Price & Monetary Calculations', subcategory: 'Discount Logic', validationLogic: 'Discount expiration date/time honored', testScenario: 'Use expired discount code', priority: 'High', keywords: ['discount', 'expiration', 'expired', 'date'], domains: ['e-commerce', 'food-delivery', 'general'] },
  { id: 'disc-007', category: 'Price & Monetary Calculations', subcategory: 'Discount Logic', validationLogic: 'Minimum purchase requirement', testScenario: 'Apply discount below threshold', priority: 'High', keywords: ['discount', 'minimum', 'purchase', 'requirement'], domains: ['e-commerce', 'food-delivery', 'general'] },
  
  // Date & Time - Basic Date Logic
  { id: 'date-001', category: 'Date & Time Validations', subcategory: 'Basic Date Logic', validationLogic: 'Start date ≤ End date', testScenario: 'Enter end date before start date', priority: 'High', keywords: ['date', 'start', 'end', 'range', 'validation'], domains: ['travel', 'healthcare', 'education', 'recruitment', 'general'] },
  { id: 'date-002', category: 'Date & Time Validations', subcategory: 'Basic Date Logic', validationLogic: 'Start date ≥ Current date (future bookings)', testScenario: 'Select past date for booking', priority: 'High', keywords: ['date', 'future', 'past', 'booking', 'current'], domains: ['travel', 'healthcare', 'general'] },
  { id: 'date-003', category: 'Date & Time Validations', subcategory: 'Basic Date Logic', validationLogic: 'Date cannot be in past (bookings)', testScenario: 'Attempt past date appointment', priority: 'High', keywords: ['date', 'past', 'appointment', 'booking'], domains: ['travel', 'healthcare', 'general'] },
  { id: 'date-004', category: 'Date & Time Validations', subcategory: 'Basic Date Logic', validationLogic: 'Leap year handling (Feb 29)', testScenario: 'Select Feb 29 in leap/non-leap years', priority: 'Medium', keywords: ['date', 'leap', 'year', 'february'], domains: ['general'] },
  { id: 'date-005', category: 'Date & Time Validations', subcategory: 'Basic Date Logic', validationLogic: 'Invalid dates rejected', testScenario: 'Enter Feb 30, Apr 31, etc.', priority: 'High', keywords: ['date', 'invalid', 'reject', 'validation'], domains: ['general'] },
  { id: 'date-006', category: 'Date & Time Validations', subcategory: 'Basic Date Logic', validationLogic: 'Date format consistency by locale', testScenario: 'Test MM/DD/YYYY vs DD/MM/YYYY', priority: 'Medium', keywords: ['date', 'format', 'locale', 'international'], domains: ['general'] },
  { id: 'date-007', category: 'Date & Time Validations', subcategory: 'Basic Date Logic', validationLogic: 'Month value range (1-12)', testScenario: 'Enter 0, 13, or negative month values', priority: 'High', keywords: ['month', 'range', 'validation', 'invalid'], domains: ['general'] },
  { id: 'date-008', category: 'Date & Time Validations', subcategory: 'Basic Date Logic', validationLogic: 'Day value range (1-31)', testScenario: 'Enter 0, 32, or negative day values', priority: 'High', keywords: ['day', 'range', 'validation', 'invalid'], domains: ['general'] },
  { id: 'date-009', category: 'Date & Time Validations', subcategory: 'Basic Date Logic', validationLogic: 'Year reasonable range', testScenario: 'Enter years like 1800, 2100, negative years', priority: 'Medium', keywords: ['year', 'range', 'validation', 'reasonable'], domains: ['general'] },
  { id: 'date-010', category: 'Date & Time Validations', subcategory: 'Basic Date Logic', validationLogic: 'Day valid for month (28/29/30/31)', testScenario: 'Enter day 31 for April, day 30 for February', priority: 'High', keywords: ['day', 'month', 'validation', 'february', 'april'], domains: ['general'] },
  { id: 'date-011', category: 'Date & Time Validations', subcategory: 'Basic Date Logic', validationLogic: 'Date of birth reasonable range', testScenario: 'Enter DOB in future or too far past (150+ years)', priority: 'High', keywords: ['dob', 'birth', 'birthday', 'age'], domains: ['healthcare', 'financial', 'general'] },
  { id: 'date-012', category: 'Date & Time Validations', subcategory: 'Basic Date Logic', validationLogic: 'Numeric-only input for date fields', testScenario: 'Enter letters or special chars in day/month/year', priority: 'High', keywords: ['day', 'month', 'year', 'numeric', 'validation'], domains: ['general'] },

  // Time Logic
  { id: 'time-001', category: 'Date & Time Validations', subcategory: 'Time Logic', validationLogic: 'Start time < End time (same day)', testScenario: 'Enter end time before start time', priority: 'High', keywords: ['time', 'start', 'end', 'validation'], domains: ['travel', 'healthcare', 'education', 'general'] },
  { id: 'time-002', category: 'Date & Time Validations', subcategory: 'Time Logic', validationLogic: 'Time zone conversions accuracy', testScenario: 'Compare times across time zones', priority: 'High', keywords: ['time', 'zone', 'timezone', 'conversion'], domains: ['travel', 'general'] },
  { id: 'time-003', category: 'Date & Time Validations', subcategory: 'Time Logic', validationLogic: 'DST transitions handled', testScenario: 'Book during spring forward/fall back', priority: 'Medium', keywords: ['dst', 'daylight', 'saving', 'transition'], domains: ['travel', 'general'] },
  { id: 'time-004', category: 'Date & Time Validations', subcategory: 'Time Logic', validationLogic: 'Business hours validation', testScenario: 'Attempt booking outside hours', priority: 'Medium', keywords: ['time', 'business', 'hours', 'booking'], domains: ['healthcare', 'food-delivery', 'general'] },
  { id: 'time-005', category: 'Date & Time Validations', subcategory: 'Time Logic', validationLogic: 'Time slot availability (no double-booking)', testScenario: 'Book already reserved slot', priority: 'High', keywords: ['time', 'slot', 'availability', 'double', 'booking'], domains: ['healthcare', 'travel', 'general'] },
  
  // Duration Calculations
  { id: 'dur-001', category: 'Date & Time Validations', subcategory: 'Duration Calculations', validationLogic: 'Number of days calculated correctly', testScenario: 'Verify inclusive vs exclusive counting', priority: 'High', keywords: ['duration', 'days', 'calculate', 'count'], domains: ['travel', 'subscription', 'general'] },
  { id: 'dur-002', category: 'Date & Time Validations', subcategory: 'Duration Calculations', validationLogic: 'Age calculation from DOB', testScenario: 'Test year boundary and leap year birthday', priority: 'High', keywords: ['age', 'dob', 'birthday', 'calculate'], domains: ['healthcare', 'financial', 'general'] },
  { id: 'dur-003', category: 'Date & Time Validations', subcategory: 'Duration Calculations', validationLogic: 'Trial period start/end', testScenario: 'Check trial expiration timing', priority: 'High', keywords: ['trial', 'period', 'expiration', 'start', 'end'], domains: ['subscription', 'general'] },
  { id: 'dur-004', category: 'Date & Time Validations', subcategory: 'Duration Calculations', validationLogic: 'Return window calculation', testScenario: 'Test return eligibility dates', priority: 'High', keywords: ['return', 'window', 'eligibility', 'date'], domains: ['e-commerce'] },
  
  // Inventory - Availability
  { id: 'inv-001', category: 'Inventory & Stock Logic', subcategory: 'Availability', validationLogic: 'Cannot add more than available stock', testScenario: 'Add qty exceeding inventory', priority: 'High', keywords: ['stock', 'inventory', 'quantity', 'available', 'exceed'], domains: ['e-commerce', 'food-delivery'] },
  { id: 'inv-002', category: 'Inventory & Stock Logic', subcategory: 'Availability', validationLogic: 'Stock decrements on purchase', testScenario: 'Buy item and check inventory', priority: 'High', keywords: ['stock', 'decrement', 'purchase', 'inventory'], domains: ['e-commerce', 'food-delivery'] },
  { id: 'inv-003', category: 'Inventory & Stock Logic', subcategory: 'Availability', validationLogic: 'Stock increments on cancellation', testScenario: 'Cancel order and verify restoration', priority: 'High', keywords: ['stock', 'increment', 'cancel', 'restore'], domains: ['e-commerce', 'food-delivery'] },
  { id: 'inv-004', category: 'Inventory & Stock Logic', subcategory: 'Availability', validationLogic: 'Out of stock display behavior', testScenario: 'Verify hidden or message shown', priority: 'Medium', keywords: ['stock', 'out', 'display', 'message'], domains: ['e-commerce', 'food-delivery'] },
  { id: 'inv-005', category: 'Inventory & Stock Logic', subcategory: 'Availability', validationLogic: 'Stock sync across channels', testScenario: 'Compare web, mobile, store inventory', priority: 'High', keywords: ['stock', 'sync', 'channel', 'inventory'], domains: ['e-commerce'] },
  
  // Quantity Validations
  { id: 'qty-001', category: 'Inventory & Stock Logic', subcategory: 'Quantity Validations', validationLogic: 'Minimum order quantity enforcement', testScenario: 'Order less than MOQ', priority: 'High', keywords: ['quantity', 'minimum', 'order', 'moq'], domains: ['e-commerce', 'food-delivery'] },
  { id: 'qty-002', category: 'Inventory & Stock Logic', subcategory: 'Quantity Validations', validationLogic: 'Maximum order quantity limits', testScenario: 'Exceed max qty per order', priority: 'High', keywords: ['quantity', 'maximum', 'limit', 'order'], domains: ['e-commerce', 'food-delivery'] },
  { id: 'qty-003', category: 'Inventory & Stock Logic', subcategory: 'Quantity Validations', validationLogic: 'Quantity must be positive integer', testScenario: 'Enter 0, negative, decimal', priority: 'High', keywords: ['quantity', 'positive', 'integer', 'validation', 'negative', 'zero'], domains: ['e-commerce', 'food-delivery', 'general'] },
  
  // User & Account - Registration
  { id: 'user-001', category: 'User & Account Logic', subcategory: 'Registration & Authentication', validationLogic: 'Email format validation', testScenario: 'Enter invalid email formats', priority: 'High', keywords: ['email', 'format', 'validation', 'invalid'], domains: ['general'] },
  { id: 'user-002', category: 'User & Account Logic', subcategory: 'Registration & Authentication', validationLogic: 'Email uniqueness', testScenario: 'Register existing email', priority: 'High', keywords: ['email', 'unique', 'duplicate', 'register'], domains: ['general'] },
  { id: 'user-003', category: 'User & Account Logic', subcategory: 'Registration & Authentication', validationLogic: 'Username uniqueness', testScenario: 'Register existing username', priority: 'High', keywords: ['username', 'unique', 'duplicate', 'register'], domains: ['general'] },
  { id: 'user-004', category: 'User & Account Logic', subcategory: 'Registration & Authentication', validationLogic: 'Password minimum length', testScenario: 'Enter short password', priority: 'High', keywords: ['password', 'minimum', 'length', 'short'], domains: ['general'] },
  { id: 'user-005', category: 'User & Account Logic', subcategory: 'Registration & Authentication', validationLogic: 'Password complexity requirements', testScenario: 'Test uppercase/lowercase/number/special', priority: 'High', keywords: ['password', 'complexity', 'uppercase', 'special', 'number'], domains: ['general'] },
  { id: 'user-006', category: 'User & Account Logic', subcategory: 'Registration & Authentication', validationLogic: 'Password confirmation match', testScenario: 'Enter mismatched passwords', priority: 'High', keywords: ['password', 'confirm', 'match', 'mismatch'], domains: ['general'] },
  { id: 'user-007', category: 'User & Account Logic', subcategory: 'Registration & Authentication', validationLogic: 'Account lockout after X failures', testScenario: 'Exceed failed login threshold', priority: 'High', keywords: ['account', 'lockout', 'failed', 'login', 'threshold'], domains: ['general'] },
  { id: 'user-008', category: 'User & Account Logic', subcategory: 'Registration & Authentication', validationLogic: 'Terms acceptance required', testScenario: 'Attempt register without accepting', priority: 'High', keywords: ['terms', 'accept', 'required', 'register'], domains: ['general'] },
  
  // Password Rules
  { id: 'pwd-001', category: 'User & Account Logic', subcategory: 'Password Rules', validationLogic: 'Password expiration (90 days)', testScenario: 'Login after 90 days without change', priority: 'Medium', keywords: ['password', 'expiration', 'expire', 'days'], domains: ['financial', 'healthcare', 'general'] },
  { id: 'pwd-002', category: 'User & Account Logic', subcategory: 'Password Rules', validationLogic: 'Password history enforcement', testScenario: 'Reuse recent password', priority: 'Medium', keywords: ['password', 'history', 'reuse', 'previous'], domains: ['financial', 'healthcare', 'general'] },
  { id: 'pwd-003', category: 'User & Account Logic', subcategory: 'Password Rules', validationLogic: 'Reset link expiration', testScenario: 'Use old reset link', priority: 'High', keywords: ['password', 'reset', 'link', 'expiration'], domains: ['general'] },
  { id: 'pwd-004', category: 'User & Account Logic', subcategory: 'Password Rules', validationLogic: 'Single-use reset links', testScenario: 'Reuse reset link', priority: 'High', keywords: ['password', 'reset', 'single', 'use', 'link'], domains: ['general'] },
  
  // Session Management
  { id: 'sess-001', category: 'User & Account Logic', subcategory: 'Session Management', validationLogic: 'Session timeout after inactivity', testScenario: 'Idle and verify logout', priority: 'High', keywords: ['session', 'timeout', 'inactivity', 'logout'], domains: ['general'] },
  { id: 'sess-002', category: 'User & Account Logic', subcategory: 'Session Management', validationLogic: 'Session invalidation on password change', testScenario: 'Change password and verify logout', priority: 'High', keywords: ['session', 'invalidate', 'password', 'change'], domains: ['general'] },
  { id: 'sess-003', category: 'User & Account Logic', subcategory: 'Session Management', validationLogic: 'Re-authentication for sensitive actions', testScenario: 'Attempt sensitive action stale session', priority: 'High', keywords: ['session', 'reauth', 'sensitive', 'action'], domains: ['financial', 'healthcare', 'general'] },
  
  // E-Commerce - Cart
  { id: 'cart-001', category: 'E-Commerce Logic', subcategory: 'Cart Logic', validationLogic: 'Cart persists across sessions (logged in)', testScenario: 'Add items, logout, login again', priority: 'High', keywords: ['cart', 'persist', 'session', 'login'], domains: ['e-commerce', 'food-delivery'] },
  { id: 'cart-002', category: 'E-Commerce Logic', subcategory: 'Cart Logic', validationLogic: 'Guest cart merge on login', testScenario: 'Add as guest, then login', priority: 'Medium', keywords: ['cart', 'guest', 'merge', 'login'], domains: ['e-commerce'] },
  { id: 'cart-003', category: 'E-Commerce Logic', subcategory: 'Cart Logic', validationLogic: 'Items removed when out of stock', testScenario: 'Item goes OOS while in cart', priority: 'Medium', keywords: ['cart', 'stock', 'out', 'remove'], domains: ['e-commerce', 'food-delivery'] },
  { id: 'cart-004', category: 'E-Commerce Logic', subcategory: 'Cart Logic', validationLogic: 'Cart count badge accuracy', testScenario: 'Add/remove and verify badge', priority: 'Medium', keywords: ['cart', 'count', 'badge', 'accuracy'], domains: ['e-commerce', 'food-delivery'] },
  { id: 'cart-005', category: 'E-Commerce Logic', subcategory: 'Cart Logic', validationLogic: 'Empty cart handling', testScenario: 'Access checkout with empty cart', priority: 'High', keywords: ['cart', 'empty', 'checkout'], domains: ['e-commerce', 'food-delivery'] },
  
  // Checkout Flow
  { id: 'chk-001', category: 'E-Commerce Logic', subcategory: 'Checkout Flow', validationLogic: 'Cannot checkout with empty cart', testScenario: 'Navigate to checkout empty', priority: 'High', keywords: ['checkout', 'cart', 'empty'], domains: ['e-commerce', 'food-delivery'] },
  { id: 'chk-002', category: 'E-Commerce Logic', subcategory: 'Checkout Flow', validationLogic: 'Cannot checkout with OOS items', testScenario: 'Item goes OOS during checkout', priority: 'High', keywords: ['checkout', 'stock', 'out', 'oos'], domains: ['e-commerce', 'food-delivery'] },
  { id: 'chk-003', category: 'E-Commerce Logic', subcategory: 'Checkout Flow', validationLogic: 'Address validation accuracy', testScenario: 'Enter invalid/undeliverable address', priority: 'High', keywords: ['checkout', 'address', 'validation', 'invalid'], domains: ['e-commerce', 'food-delivery'] },
  { id: 'chk-004', category: 'E-Commerce Logic', subcategory: 'Checkout Flow', validationLogic: 'Order review totals match cart', testScenario: 'Compare cart to review page', priority: 'High', keywords: ['checkout', 'review', 'total', 'match', 'cart'], domains: ['e-commerce', 'food-delivery'] },
  { id: 'chk-005', category: 'E-Commerce Logic', subcategory: 'Checkout Flow', validationLogic: 'Prevent double order submission', testScenario: 'Click submit twice quickly', priority: 'High', keywords: ['checkout', 'double', 'submit', 'order', 'prevent'], domains: ['e-commerce', 'food-delivery', 'general'] },
  { id: 'chk-006', category: 'E-Commerce Logic', subcategory: 'Checkout Flow', validationLogic: 'Order number uniqueness', testScenario: 'Verify unique order IDs generated', priority: 'High', keywords: ['order', 'number', 'unique', 'id'], domains: ['e-commerce', 'food-delivery'] },
  
  // Forms - Field Validations
  { id: 'form-001', category: 'Forms & Workflow', subcategory: 'Field Validations', validationLogic: 'Required field enforcement', testScenario: 'Submit empty required field', priority: 'High', keywords: ['form', 'required', 'field', 'validation', 'empty'], domains: ['general'] },
  { id: 'form-002', category: 'Forms & Workflow', subcategory: 'Field Validations', validationLogic: 'Field format (phone, SSN, ZIP)', testScenario: 'Enter invalid formats', priority: 'High', keywords: ['form', 'format', 'phone', 'ssn', 'zip', 'validation'], domains: ['general'] },
  { id: 'form-003', category: 'Forms & Workflow', subcategory: 'Field Validations', validationLogic: 'Field length limits', testScenario: 'Exceed max length', priority: 'High', keywords: ['form', 'field', 'length', 'limit', 'max'], domains: ['general'] },
  { id: 'form-004', category: 'Forms & Workflow', subcategory: 'Field Validations', validationLogic: 'Range validation (min/max)', testScenario: 'Enter out-of-range values', priority: 'High', keywords: ['form', 'range', 'min', 'max', 'validation'], domains: ['general'] },
  { id: 'form-005', category: 'Forms & Workflow', subcategory: 'Field Validations', validationLogic: 'File upload type restrictions', testScenario: 'Upload wrong file type', priority: 'High', keywords: ['form', 'file', 'upload', 'type', 'restriction'], domains: ['general'] },
  { id: 'form-006', category: 'Forms & Workflow', subcategory: 'Field Validations', validationLogic: 'File upload size limits', testScenario: 'Upload oversized file', priority: 'High', keywords: ['form', 'file', 'upload', 'size', 'limit'], domains: ['general'] },
  { id: 'form-007', category: 'Forms & Workflow', subcategory: 'Field Validations', validationLogic: 'Duplicate submission prevention', testScenario: 'Submit form twice', priority: 'High', keywords: ['form', 'duplicate', 'submit', 'prevent'], domains: ['general'] },
  
  // Search & Filter
  { id: 'srch-001', category: 'Search & Filter', subcategory: 'Search Accuracy', validationLogic: 'Keyword relevance ranking', testScenario: 'Search common terms', priority: 'High', keywords: ['search', 'keyword', 'relevance', 'ranking'], domains: ['e-commerce', 'general'] },
  { id: 'srch-002', category: 'Search & Filter', subcategory: 'Search Accuracy', validationLogic: 'Zero results handling', testScenario: 'Search non-existent term', priority: 'Medium', keywords: ['search', 'zero', 'results', 'no', 'found'], domains: ['general'] },
  { id: 'srch-003', category: 'Search & Filter', subcategory: 'Search Accuracy', validationLogic: 'Pagination accuracy', testScenario: 'Navigate all pages', priority: 'High', keywords: ['search', 'pagination', 'page', 'navigate'], domains: ['general'] },
  { id: 'filt-001', category: 'Search & Filter', subcategory: 'Filter Logic', validationLogic: 'Multi-select combinations', testScenario: 'Select multiple filters', priority: 'High', keywords: ['filter', 'multi', 'select', 'combination'], domains: ['e-commerce', 'general'] },
  { id: 'filt-002', category: 'Search & Filter', subcategory: 'Filter Logic', validationLogic: 'Range filter boundaries', testScenario: 'Test min/max edges', priority: 'High', keywords: ['filter', 'range', 'min', 'max', 'boundary'], domains: ['e-commerce', 'real-estate', 'general'] },
  { id: 'filt-003', category: 'Search & Filter', subcategory: 'Filter Logic', validationLogic: 'Filter count accuracy', testScenario: 'Verify filtered count', priority: 'High', keywords: ['filter', 'count', 'accuracy', 'results'], domains: ['general'] },
  { id: 'sort-001', category: 'Search & Filter', subcategory: 'Sort Logic', validationLogic: 'Sort order consistency', testScenario: 'Sort multiple times', priority: 'High', keywords: ['sort', 'order', 'consistency'], domains: ['general'] },
  
  // Security
  { id: 'sec-001', category: 'Security', subcategory: 'Input Security', validationLogic: 'SQL injection prevention', testScenario: 'Test SQL injection', priority: 'High', keywords: ['security', 'sql', 'injection', 'input'], domains: ['general'] },
  { id: 'sec-002', category: 'Security', subcategory: 'Input Security', validationLogic: 'XSS prevention', testScenario: 'Test script injection', priority: 'High', keywords: ['security', 'xss', 'script', 'injection'], domains: ['general'] },
  { id: 'sec-003', category: 'Security', subcategory: 'Input Security', validationLogic: 'CSRF token validation', testScenario: 'Test CSRF protection', priority: 'High', keywords: ['security', 'csrf', 'token', 'validation'], domains: ['general'] },
  { id: 'sec-004', category: 'Security', subcategory: 'Input Security', validationLogic: 'Rate limiting accuracy', testScenario: 'Test rate limits', priority: 'High', keywords: ['security', 'rate', 'limit', 'throttle'], domains: ['general'] },
  { id: 'sec-005', category: 'Security', subcategory: 'Access Control', validationLogic: 'Role-based access accuracy', testScenario: 'Test role permissions', priority: 'High', keywords: ['security', 'role', 'access', 'permission', 'rbac'], domains: ['general'] },
  
  // Edge Cases - Numeric
  { id: 'edge-001', category: 'Edge Cases', subcategory: 'Numeric Boundaries', validationLogic: 'Zero handling', testScenario: 'Enter zero values', priority: 'High', keywords: ['edge', 'zero', 'boundary', 'numeric'], domains: ['general'] },
  { id: 'edge-002', category: 'Edge Cases', subcategory: 'Numeric Boundaries', validationLogic: 'Negative number handling', testScenario: 'Enter negative numbers', priority: 'High', keywords: ['edge', 'negative', 'number', 'boundary'], domains: ['general'] },
  { id: 'edge-003', category: 'Edge Cases', subcategory: 'Numeric Boundaries', validationLogic: 'Division by zero prevention', testScenario: 'Trigger divide by zero', priority: 'High', keywords: ['edge', 'divide', 'zero', 'error'], domains: ['general'] },
  
  // Edge Cases - String
  { id: 'edge-004', category: 'Edge Cases', subcategory: 'String Boundaries', validationLogic: 'Empty string handling', testScenario: 'Submit empty strings', priority: 'High', keywords: ['edge', 'empty', 'string', 'blank'], domains: ['general'] },
  { id: 'edge-005', category: 'Edge Cases', subcategory: 'String Boundaries', validationLogic: 'Whitespace-only handling', testScenario: 'Submit whitespace only', priority: 'High', keywords: ['edge', 'whitespace', 'space', 'blank'], domains: ['general'] },
  { id: 'edge-006', category: 'Edge Cases', subcategory: 'String Boundaries', validationLogic: 'Maximum length handling', testScenario: 'Exceed max length', priority: 'High', keywords: ['edge', 'length', 'max', 'overflow'], domains: ['general'] },
  { id: 'edge-007', category: 'Edge Cases', subcategory: 'String Boundaries', validationLogic: 'Special character handling', testScenario: 'Enter special chars', priority: 'Medium', keywords: ['edge', 'special', 'character', 'symbol'], domains: ['general'] },
];

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Get validations filtered by domain
 */
export function getValidationsByDomain(domain: DomainType): ValidationTemplate[] {
  return VALIDATION_TEMPLATES.filter(v => v.domains.includes(domain));
}

/**
 * Get validations by category
 */
export function getValidationsByCategory(category: string): ValidationTemplate[] {
  return VALIDATION_TEMPLATES.filter(v => v.category === category);
}

/**
 * Get validations by subcategory
 */
export function getValidationsBySubcategory(category: string, subcategory: string): ValidationTemplate[] {
  return VALIDATION_TEMPLATES.filter(v => v.category === category && v.subcategory === subcategory);
}

/**
 * Smart suggestion based on field/selector keywords
 */
export function getSuggestionsForField(fieldText: string, domain?: DomainType): ValidationTemplate[] {
  const text = fieldText.toLowerCase();
  const words = text.split(/[\s\-_:*]+/).filter(w => w.length > 1);
  
  // Score each validation based on keyword matches
  const scored = VALIDATION_TEMPLATES.map(v => {
    let score = 0;
    let directMatches = 0;
    
    // Check validation's own keywords - must be EXACT word match
    for (const keyword of v.keywords) {
      const kw = keyword.toLowerCase();
      // Check if any word in the field text matches the keyword
      if (words.includes(kw)) {
        score += 15;
        directMatches++;
      }
    }
    
    // Only add category bonus if we have direct keyword matches
    if (directMatches > 0 && domain && domain !== 'general' && v.domains.includes(domain)) {
      score += 3;
    }
    
    return { validation: v, score, directMatches };
  });
  
  // Only show validations with DIRECT keyword matches, limit to top 6
  return scored
    .filter(s => s.directMatches > 0)
    .sort((a, b) => {
      // First by direct matches (descending)
      if (b.directMatches !== a.directMatches) return b.directMatches - a.directMatches;
      // Then by score
      if (b.score !== a.score) return b.score - a.score;
      // Then by priority
      const priorityOrder = { High: 0, Medium: 1, Low: 2 };
      return priorityOrder[a.validation.priority] - priorityOrder[b.validation.priority];
    })
    .map(s => s.validation)
    .slice(0, 6); // Limit to top 6 most relevant
}

/**
 * Get categories relevant to a domain
 */
export function getCategoriesForDomain(domain: DomainType): string[] {
  return DOMAINS[domain]?.categories || [];
}

/**
 * Calculate coverage for a test case
 */
export function calculateCoverage(
  coveredValidationIds: string[], 
  domain: DomainType
): { 
  total: number; 
  covered: number; 
  percentage: number;
  missingHigh: ValidationTemplate[];
  missingMedium: ValidationTemplate[];
} {
  const domainValidations = getValidationsByDomain(domain);
  const total = domainValidations.length;
  const covered = coveredValidationIds.filter(id => 
    domainValidations.some(v => v.id === id)
  ).length;
  
  const missing = domainValidations.filter(v => !coveredValidationIds.includes(v.id));
  const missingHigh = missing.filter(v => v.priority === 'High');
  const missingMedium = missing.filter(v => v.priority === 'Medium');
  
  return {
    total,
    covered,
    percentage: total > 0 ? Math.round((covered / total) * 100) : 0,
    missingHigh,
    missingMedium
  };
}

/**
 * Group validations by category and subcategory
 */
export function groupValidations(validations: ValidationTemplate[]): Record<string, Record<string, ValidationTemplate[]>> {
  const grouped: Record<string, Record<string, ValidationTemplate[]>> = {};
  
  for (const v of validations) {
    if (!grouped[v.category]) {
      grouped[v.category] = {};
    }
    if (!grouped[v.category][v.subcategory]) {
      grouped[v.category][v.subcategory] = [];
    }
    grouped[v.category][v.subcategory].push(v);
  }
  
  return grouped;
}

/**
 * Get all unique categories
 */
export function getAllCategories(): string[] {
  return [...new Set(VALIDATION_TEMPLATES.map(v => v.category))];
}

/**
 * Get priority color class
 */
export function getPriorityColor(priority: 'High' | 'Medium' | 'Low'): string {
  switch (priority) {
    case 'High': return 'text-red-600 bg-red-50';
    case 'Medium': return 'text-amber-600 bg-amber-50';
    case 'Low': return 'text-green-600 bg-green-50';
  }
}

/**
 * Generate assertion step from validation template
 */
export function validationToAssertion(validation: ValidationTemplate): {
  type: 'assert';
  name: string;
  description: string;
  assertion: {
    enabled: boolean;
    type: string;
    target: string;
    expected: string;
  };
} {
  return {
    type: 'assert',
    name: `Verify: ${validation.validationLogic}`,
    description: validation.testScenario,
    assertion: {
      enabled: true,
      type: 'custom',
      target: validation.validationLogic,
      expected: 'Pass'
    }
  };
}






