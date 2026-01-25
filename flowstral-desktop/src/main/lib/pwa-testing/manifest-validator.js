/**
 * PWA Manifest Validator
 * 
 * Validates Web App Manifest (manifest.json) for PWA compliance.
 * Checks required fields, icons, display modes, and installability criteria.
 * 
 * @module pwa-testing/manifest-validator
 */

/**
 * Required manifest fields for PWA installability
 */
const REQUIRED_FIELDS = ['name', 'icons', 'start_url', 'display'];

/**
 * Recommended manifest fields for a complete PWA
 */
const RECOMMENDED_FIELDS = [
  'short_name',
  'description', 
  'theme_color',
  'background_color',
  'scope',
  'lang',
  'orientation'
];

/**
 * Required icon sizes for PWA installability
 */
const REQUIRED_ICON_SIZES = ['192x192', '512x512'];

/**
 * Valid display modes
 */
const VALID_DISPLAY_MODES = ['fullscreen', 'standalone', 'minimal-ui', 'browser'];

/**
 * Validate a PWA manifest object
 * 
 * @param {Object} manifest - The manifest object to validate
 * @returns {Object} Validation result with valid flag, score, and issues
 */
function validateManifest(manifest) {
  const issues = [];
  const warnings = [];
  const info = [];
  
  if (!manifest || typeof manifest !== 'object') {
    return {
      valid: false,
      score: 0,
      issues: ['Manifest is empty or invalid'],
      warnings: [],
      info: [],
      manifest: null
    };
  }
  
  // Check required fields
  for (const field of REQUIRED_FIELDS) {
    if (!manifest[field]) {
      issues.push(`Missing required field: "${field}"`);
    }
  }
  
  // Check recommended fields
  for (const field of RECOMMENDED_FIELDS) {
    if (!manifest[field]) {
      warnings.push(`Missing recommended field: "${field}"`);
    }
  }
  
  // Validate name
  if (manifest.name) {
    if (manifest.name.length > 45) {
      warnings.push(`Name is too long (${manifest.name.length} chars). Recommended: 45 chars max`);
    }
    info.push(`App name: "${manifest.name}"`);
  }
  
  // Validate short_name
  if (manifest.short_name) {
    if (manifest.short_name.length > 12) {
      warnings.push(`Short name is too long (${manifest.short_name.length} chars). Recommended: 12 chars max`);
    }
  }
  
  // Validate icons
  if (manifest.icons && Array.isArray(manifest.icons)) {
    const iconSizes = manifest.icons.map(icon => icon.sizes).filter(Boolean);
    
    for (const requiredSize of REQUIRED_ICON_SIZES) {
      if (!iconSizes.some(size => size.includes(requiredSize))) {
        issues.push(`Missing required icon size: ${requiredSize}`);
      }
    }
    
    // Check for maskable icon (recommended for Android)
    const hasMaskable = manifest.icons.some(icon => 
      icon.purpose && icon.purpose.includes('maskable')
    );
    if (!hasMaskable) {
      warnings.push('No maskable icon found. Recommended for Android adaptive icons');
    }
    
    info.push(`Icons found: ${manifest.icons.length} (sizes: ${iconSizes.join(', ')})`);
  } else {
    issues.push('Icons array is missing or invalid');
  }
  
  // Validate display mode
  if (manifest.display) {
    if (!VALID_DISPLAY_MODES.includes(manifest.display)) {
      issues.push(`Invalid display mode: "${manifest.display}". Valid: ${VALID_DISPLAY_MODES.join(', ')}`);
    } else {
      info.push(`Display mode: ${manifest.display}`);
      
      if (manifest.display === 'browser') {
        warnings.push('Display mode "browser" does not provide app-like experience');
      }
    }
  }
  
  // Validate start_url
  if (manifest.start_url) {
    if (!manifest.start_url.startsWith('/') && !manifest.start_url.startsWith('http')) {
      warnings.push(`start_url should be absolute or start with "/": "${manifest.start_url}"`);
    }
    info.push(`Start URL: ${manifest.start_url}`);
  }
  
  // Validate theme_color and background_color (should be valid CSS colors)
  const colorRegex = /^#([0-9A-Fa-f]{3}){1,2}$|^rgb\(|^rgba\(|^hsl\(|^hsla\(/;
  
  if (manifest.theme_color) {
    if (!colorRegex.test(manifest.theme_color) && !CSS_NAMED_COLORS.includes(manifest.theme_color.toLowerCase())) {
      warnings.push(`theme_color may be invalid: "${manifest.theme_color}"`);
    }
    info.push(`Theme color: ${manifest.theme_color}`);
  }
  
  if (manifest.background_color) {
    if (!colorRegex.test(manifest.background_color) && !CSS_NAMED_COLORS.includes(manifest.background_color.toLowerCase())) {
      warnings.push(`background_color may be invalid: "${manifest.background_color}"`);
    }
  }
  
  // Validate scope
  if (manifest.scope) {
    info.push(`Scope: ${manifest.scope}`);
  }
  
  // Validate orientation
  if (manifest.orientation) {
    const validOrientations = ['any', 'natural', 'landscape', 'portrait', 'portrait-primary', 'portrait-secondary', 'landscape-primary', 'landscape-secondary'];
    if (!validOrientations.includes(manifest.orientation)) {
      warnings.push(`Unknown orientation: "${manifest.orientation}"`);
    }
  }
  
  // Calculate score
  const requiredScore = REQUIRED_FIELDS.filter(f => manifest[f]).length / REQUIRED_FIELDS.length;
  const recommendedScore = RECOMMENDED_FIELDS.filter(f => manifest[f]).length / RECOMMENDED_FIELDS.length;
  const iconScore = manifest.icons && REQUIRED_ICON_SIZES.every(size => 
    manifest.icons.some(icon => icon.sizes && icon.sizes.includes(size))
  ) ? 1 : 0;
  
  // Weighted score: 60% required, 20% recommended, 20% icons
  const score = Math.round((requiredScore * 60 + recommendedScore * 20 + iconScore * 20));
  
  return {
    valid: issues.length === 0,
    score,
    issues,
    warnings,
    info,
    manifest: {
      name: manifest.name,
      short_name: manifest.short_name,
      start_url: manifest.start_url,
      display: manifest.display,
      theme_color: manifest.theme_color,
      background_color: manifest.background_color,
      icons: manifest.icons?.length || 0,
      scope: manifest.scope
    }
  };
}

/**
 * Fetch and validate manifest from a page
 * 
 * @param {Page} page - Playwright page object
 * @returns {Promise<Object>} Validation result
 */
async function validateManifestFromPage(page) {
  try {
    // Find manifest link
    const manifestUrl = await page.evaluate(() => {
      const link = document.querySelector('link[rel="manifest"]');
      if (!link) return null;
      
      // Resolve relative URLs
      const href = link.getAttribute('href');
      if (!href) return null;
      
      try {
        return new URL(href, document.baseURI).href;
      } catch (e) {
        return href;
      }
    });
    
    if (!manifestUrl) {
      return {
        valid: false,
        score: 0,
        issues: ['No manifest link found in page (<link rel="manifest">)'],
        warnings: [],
        info: [],
        manifestUrl: null,
        manifest: null
      };
    }
    
    // Fetch manifest
    const response = await page.request.get(manifestUrl);
    
    if (!response.ok()) {
      return {
        valid: false,
        score: 0,
        issues: [`Failed to fetch manifest: HTTP ${response.status()}`],
        warnings: [],
        info: [],
        manifestUrl,
        manifest: null
      };
    }
    
    const contentType = response.headers()['content-type'] || '';
    if (!contentType.includes('json') && !contentType.includes('manifest')) {
      // Some servers serve with wrong content-type, try to parse anyway
    }
    
    let manifest;
    try {
      manifest = await response.json();
    } catch (e) {
      return {
        valid: false,
        score: 0,
        issues: [`Invalid JSON in manifest: ${e.message}`],
        warnings: [],
        info: [],
        manifestUrl,
        manifest: null
      };
    }
    
    // Validate the manifest
    const result = validateManifest(manifest);
    result.manifestUrl = manifestUrl;
    
    return result;
    
  } catch (error) {
    return {
      valid: false,
      score: 0,
      issues: [`Error validating manifest: ${error.message}`],
      warnings: [],
      info: [],
      manifestUrl: null,
      manifest: null
    };
  }
}

/**
 * Check if page meets PWA installability criteria
 * 
 * @param {Page} page - Playwright page object
 * @returns {Promise<Object>} Installability check result
 */
async function checkInstallability(page) {
  const criteria = {
    hasManifest: false,
    hasServiceWorker: false,
    isHttps: false,
    hasRequiredIcons: false,
    hasValidStartUrl: false,
    hasValidDisplayMode: false
  };
  
  const issues = [];
  
  try {
    // Check HTTPS
    const url = page.url();
    criteria.isHttps = url.startsWith('https://') || url.includes('localhost') || url.includes('127.0.0.1');
    if (!criteria.isHttps) {
      issues.push('Page must be served over HTTPS (or localhost for development)');
    }
    
    // Check manifest
    const manifestResult = await validateManifestFromPage(page);
    criteria.hasManifest = !!manifestResult.manifestUrl;
    
    if (manifestResult.valid) {
      criteria.hasRequiredIcons = !manifestResult.issues.some(i => i.includes('icon'));
      criteria.hasValidStartUrl = !manifestResult.issues.some(i => i.includes('start_url'));
      criteria.hasValidDisplayMode = !manifestResult.issues.some(i => i.includes('display'));
    }
    
    // Check service worker
    const swStatus = await page.evaluate(async () => {
      if (!('serviceWorker' in navigator)) {
        return { supported: false, registered: false };
      }
      
      try {
        const registrations = await navigator.serviceWorker.getRegistrations();
        return {
          supported: true,
          registered: registrations.length > 0,
          count: registrations.length,
          scopes: registrations.map(r => r.scope)
        };
      } catch (e) {
        return { supported: true, registered: false, error: e.message };
      }
    });
    
    criteria.hasServiceWorker = swStatus.registered;
    if (!swStatus.supported) {
      issues.push('Service Workers not supported in this browser');
    } else if (!swStatus.registered) {
      issues.push('No service worker registered');
    }
    
    // Calculate installability
    const installable = criteria.hasManifest && 
                       criteria.hasServiceWorker && 
                       criteria.isHttps && 
                       criteria.hasRequiredIcons;
    
    return {
      installable,
      criteria,
      issues,
      manifestValidation: manifestResult
    };
    
  } catch (error) {
    return {
      installable: false,
      criteria,
      issues: [...issues, `Error checking installability: ${error.message}`],
      manifestValidation: null
    };
  }
}

// Common CSS named colors for validation
const CSS_NAMED_COLORS = [
  'aliceblue', 'antiquewhite', 'aqua', 'aquamarine', 'azure', 'beige', 'bisque',
  'black', 'blanchedalmond', 'blue', 'blueviolet', 'brown', 'burlywood', 'cadetblue',
  'chartreuse', 'chocolate', 'coral', 'cornflowerblue', 'cornsilk', 'crimson', 'cyan',
  'darkblue', 'darkcyan', 'darkgoldenrod', 'darkgray', 'darkgreen', 'darkgrey',
  'darkkhaki', 'darkmagenta', 'darkolivegreen', 'darkorange', 'darkorchid', 'darkred',
  'darksalmon', 'darkseagreen', 'darkslateblue', 'darkslategray', 'darkslategrey',
  'darkturquoise', 'darkviolet', 'deeppink', 'deepskyblue', 'dimgray', 'dimgrey',
  'dodgerblue', 'firebrick', 'floralwhite', 'forestgreen', 'fuchsia', 'gainsboro',
  'ghostwhite', 'gold', 'goldenrod', 'gray', 'green', 'greenyellow', 'grey',
  'honeydew', 'hotpink', 'indianred', 'indigo', 'ivory', 'khaki', 'lavender',
  'lavenderblush', 'lawngreen', 'lemonchiffon', 'lightblue', 'lightcoral', 'lightcyan',
  'lightgoldenrodyellow', 'lightgray', 'lightgreen', 'lightgrey', 'lightpink',
  'lightsalmon', 'lightseagreen', 'lightskyblue', 'lightslategray', 'lightslategrey',
  'lightsteelblue', 'lightyellow', 'lime', 'limegreen', 'linen', 'magenta', 'maroon',
  'mediumaquamarine', 'mediumblue', 'mediumorchid', 'mediumpurple', 'mediumseagreen',
  'mediumslateblue', 'mediumspringgreen', 'mediumturquoise', 'mediumvioletred',
  'midnightblue', 'mintcream', 'mistyrose', 'moccasin', 'navajowhite', 'navy',
  'oldlace', 'olive', 'olivedrab', 'orange', 'orangered', 'orchid', 'palegoldenrod',
  'palegreen', 'paleturquoise', 'palevioletred', 'papayawhip', 'peachpuff', 'peru',
  'pink', 'plum', 'powderblue', 'purple', 'rebeccapurple', 'red', 'rosybrown',
  'royalblue', 'saddlebrown', 'salmon', 'sandybrown', 'seagreen', 'seashell', 'sienna',
  'silver', 'skyblue', 'slateblue', 'slategray', 'slategrey', 'snow', 'springgreen',
  'steelblue', 'tan', 'teal', 'thistle', 'tomato', 'turquoise', 'violet', 'wheat',
  'white', 'whitesmoke', 'yellow', 'yellowgreen'
];

module.exports = {
  validateManifest,
  validateManifestFromPage,
  checkInstallability,
  REQUIRED_FIELDS,
  RECOMMENDED_FIELDS,
  REQUIRED_ICON_SIZES,
  VALID_DISPLAY_MODES
};
