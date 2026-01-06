/**
 * Email Validator - Block Personal Email Domains
 * Only allow business/work emails for registration
 */

// Comprehensive list of personal email domains to block
const PERSONAL_EMAIL_DOMAINS = [
  // Google
  'gmail.com', 'googlemail.com', 'google.com',
  
  // Microsoft
  'outlook.com', 'hotmail.com', 'live.com', 'msn.com', 'windowslive.com',
  'outlook.co.uk', 'hotmail.co.uk', 'live.co.uk',
  'outlook.fr', 'hotmail.fr', 'live.fr',
  'outlook.de', 'hotmail.de', 'live.de',
  'outlook.es', 'hotmail.es', 'live.es',
  'outlook.it', 'hotmail.it', 'live.it',
  'outlook.jp', 'hotmail.co.jp', 'live.jp',
  'outlook.in', 'hotmail.in', 'live.in',
  'outlook.com.br', 'hotmail.com.br',
  'outlook.com.au', 'hotmail.com.au',
  
  // Yahoo
  'yahoo.com', 'yahoo.co.uk', 'yahoo.fr', 'yahoo.de', 'yahoo.es',
  'yahoo.it', 'yahoo.co.jp', 'yahoo.in', 'yahoo.com.br', 'yahoo.com.au',
  'yahoo.ca', 'yahoo.co.in', 'yahoo.co.id', 'ymail.com', 'rocketmail.com',
  'yahoomail.com',
  
  // AOL
  'aol.com', 'aol.co.uk', 'aol.fr', 'aol.de', 'aim.com', 'netscape.net',
  
  // Apple
  'icloud.com', 'me.com', 'mac.com',
  
  // Proton
  'protonmail.com', 'protonmail.ch', 'proton.me', 'pm.me',
  
  // Other popular personal
  'mail.com', 'email.com', 'usa.com', 'europe.com',
  'gmx.com', 'gmx.net', 'gmx.de', 'gmx.at', 'gmx.ch',
  'web.de', 'freenet.de', 't-online.de',
  'yandex.com', 'yandex.ru', 'ya.ru',
  'mail.ru', 'inbox.ru', 'list.ru', 'bk.ru',
  'zoho.com', 'zohomail.com',
  'tutanota.com', 'tutanota.de', 'tutamail.com', 'tuta.io',
  'fastmail.com', 'fastmail.fm',
  'hushmail.com', 'hush.com', 'hush.ai',
  'posteo.de', 'posteo.net',
  'mailbox.org',
  'disroot.org',
  'cock.li', 'airmail.cc',
  'mailfence.com',
  'runbox.com',
  'kolabnow.com',
  'startmail.com',
  'countermail.com',
  
  // Temporary/disposable email services
  'mailinator.com', 'guerrillamail.com', 'guerrillamail.org', 'guerrillamail.net',
  'tempmail.com', 'temp-mail.org', '10minutemail.com', '10minutemail.net',
  'throwaway.email', 'throwawaymail.com', 'disposablemail.com',
  'fakeinbox.com', 'fakemailgenerator.com', 'getnada.com', 'getairmail.com',
  'maildrop.cc', 'mailnesia.com', 'mintemail.com', 'mohmal.com',
  'mytrashmail.com', 'sharklasers.com', 'spamgourmet.com', 'tempail.com',
  'trashmail.com', 'trashmail.net', 'yopmail.com', 'yopmail.fr',
  'dispostable.com', 'mailcatch.com', 'emailondeck.com',
  'burnermail.io', 'jetable.org', 'spambox.us', 'tempr.email',
  'throwaway.email', 'tmpmail.org', 'tmpmail.net',
  
  // Regional personal email
  'qq.com', '163.com', '126.com', 'sina.com', 'sina.cn', 'sohu.com',
  'aliyun.com', 'foxmail.com',
  'naver.com', 'daum.net', 'hanmail.net',
  'rediffmail.com', 'sify.com',
  'bol.com.br', 'uol.com.br', 'ig.com.br', 'terra.com.br',
  'orange.fr', 'wanadoo.fr', 'laposte.net', 'sfr.fr', 'free.fr',
  'libero.it', 'virgilio.it', 'alice.it', 'tin.it',
  'seznam.cz', 'centrum.cz', 'atlas.cz',
  'wp.pl', 'o2.pl', 'interia.pl', 'onet.pl', 'poczta.fm',
  'rambler.ru', 'tut.by',
  'bigpond.com', 'optusnet.com.au',
  'rogers.com', 'shaw.ca', 'sympatico.ca',
  'comcast.net', 'verizon.net', 'att.net', 'sbcglobal.net', 'bellsouth.net',
  'cox.net', 'charter.net', 'earthlink.net', 'juno.com', 'netzero.net',
  
  // Generic catch-alls
  'email.com', 'mail.com', 'inbox.com', 'mymail.com',
];

// Common typos of personal domains
const PERSONAL_EMAIL_TYPOS = [
  'gmial.com', 'gmal.com', 'gamil.com', 'gnail.com', 'gmail.co',
  'outlok.com', 'outllook.com', 'hotmal.com', 'hotmial.com',
  'yaho.com', 'yahooo.com', 'yhoo.com',
];

// All blocked domains
const ALL_BLOCKED_DOMAINS = new Set([
  ...PERSONAL_EMAIL_DOMAINS,
  ...PERSONAL_EMAIL_TYPOS,
]);

export interface EmailValidationResult {
  isValid: boolean;
  isBusinessEmail: boolean;
  domain: string;
  error?: string;
}

/**
 * Validate email format
 */
export function isValidEmailFormat(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Extract domain from email
 */
export function getEmailDomain(email: string): string {
  return email.split('@')[1]?.toLowerCase() || '';
}

/**
 * Check if email is from a personal domain
 */
export function isPersonalEmail(email: string): boolean {
  const domain = getEmailDomain(email);
  return ALL_BLOCKED_DOMAINS.has(domain);
}

/**
 * Check if email is from a business domain
 */
export function isBusinessEmail(email: string): boolean {
  if (!isValidEmailFormat(email)) return false;
  return !isPersonalEmail(email);
}

/**
 * Full email validation for signup
 */
export function validateBusinessEmail(email: string): EmailValidationResult {
  const normalizedEmail = email.toLowerCase().trim();
  
  // Check format
  if (!isValidEmailFormat(normalizedEmail)) {
    return {
      isValid: false,
      isBusinessEmail: false,
      domain: '',
      error: 'Please enter a valid email address',
    };
  }
  
  const domain = getEmailDomain(normalizedEmail);
  
  // Check if personal email
  if (isPersonalEmail(normalizedEmail)) {
    return {
      isValid: false,
      isBusinessEmail: false,
      domain,
      error: 'Please use your work email. Personal emails (Gmail, Yahoo, etc.) are not accepted.',
    };
  }
  
  // Check for suspicious patterns (like test@test.com)
  const suspiciousPatterns = [
    /^test@/i,
    /^admin@/i,
    /^user@/i,
    /^demo@/i,
    /^example@/i,
    /^sample@/i,
    /^fake@/i,
    /^asdf@/i,
    /^qwerty@/i,
  ];
  
  for (const pattern of suspiciousPatterns) {
    if (pattern.test(normalizedEmail)) {
      return {
        isValid: false,
        isBusinessEmail: false,
        domain,
        error: 'Please use a valid work email address',
      };
    }
  }
  
  // Check domain validity (should have at least one dot after @)
  if (!domain.includes('.') || domain.split('.').pop()!.length < 2) {
    return {
      isValid: false,
      isBusinessEmail: false,
      domain,
      error: 'Please enter a valid email domain',
    };
  }
  
  return {
    isValid: true,
    isBusinessEmail: true,
    domain,
  };
}

/**
 * Get list of blocked domains for display
 */
export function getBlockedDomainsPreview(): string[] {
  return ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'icloud.com', 'and 200+ more'];
}

