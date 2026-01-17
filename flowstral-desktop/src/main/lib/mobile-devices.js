/**
 * Mobile Device Profiles for QAAI
 * 
 * Comprehensive device profiles for mobile web emulation.
 * These work with Playwright's device emulation to simulate
 * mobile browsers without needing real devices.
 * 
 * Usage:
 *   const { MOBILE_DEVICES, getDevice } = require('./mobile-devices');
 *   const device = getDevice('iPhone 14 Pro');
 *   const context = await browser.newContext(device);
 */

// =============================================================================
// iOS DEVICES
// =============================================================================

const IOS_DEVICES = {
  // iPhone 15 Series (2023)
  'iPhone 15 Pro Max': {
    viewport: { width: 430, height: 932 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    defaultBrowserType: 'webkit',
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
  },
  'iPhone 15 Pro': {
    viewport: { width: 393, height: 852 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    defaultBrowserType: 'webkit',
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
  },
  'iPhone 15': {
    viewport: { width: 393, height: 852 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    defaultBrowserType: 'webkit',
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
  },
  
  // iPhone 14 Series (2022)
  'iPhone 14 Pro Max': {
    viewport: { width: 430, height: 932 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    defaultBrowserType: 'webkit',
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1'
  },
  'iPhone 14 Pro': {
    viewport: { width: 393, height: 852 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    defaultBrowserType: 'webkit',
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1'
  },
  'iPhone 14': {
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    defaultBrowserType: 'webkit',
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1'
  },
  
  // iPhone 13 Series
  'iPhone 13 Pro Max': {
    viewport: { width: 428, height: 926 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    defaultBrowserType: 'webkit',
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1'
  },
  'iPhone 13 Pro': {
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    defaultBrowserType: 'webkit',
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1'
  },
  'iPhone 13': {
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    defaultBrowserType: 'webkit',
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1'
  },
  'iPhone 13 Mini': {
    viewport: { width: 375, height: 812 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    defaultBrowserType: 'webkit',
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1'
  },
  
  // iPhone 12 Series
  'iPhone 12 Pro Max': {
    viewport: { width: 428, height: 926 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    defaultBrowserType: 'webkit',
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1'
  },
  'iPhone 12 Pro': {
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    defaultBrowserType: 'webkit',
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1'
  },
  'iPhone 12': {
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    defaultBrowserType: 'webkit',
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1'
  },
  
  // iPhone SE / Older
  'iPhone SE (3rd Gen)': {
    viewport: { width: 375, height: 667 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    defaultBrowserType: 'webkit',
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1'
  },
  'iPhone SE': {
    viewport: { width: 375, height: 667 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    defaultBrowserType: 'webkit',
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1'
  },
  'iPhone 11': {
    viewport: { width: 414, height: 896 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    defaultBrowserType: 'webkit',
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 13_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.0 Mobile/15E148 Safari/604.1'
  },
  
  // iPad Series
  'iPad Pro 12.9': {
    viewport: { width: 1024, height: 1366 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    defaultBrowserType: 'webkit',
    userAgent: 'Mozilla/5.0 (iPad; CPU OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1'
  },
  'iPad Pro 11': {
    viewport: { width: 834, height: 1194 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    defaultBrowserType: 'webkit',
    userAgent: 'Mozilla/5.0 (iPad; CPU OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1'
  },
  'iPad Air': {
    viewport: { width: 820, height: 1180 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    defaultBrowserType: 'webkit',
    userAgent: 'Mozilla/5.0 (iPad; CPU OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1'
  },
  'iPad Mini': {
    viewport: { width: 768, height: 1024 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    defaultBrowserType: 'webkit',
    userAgent: 'Mozilla/5.0 (iPad; CPU OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1'
  },
  'iPad': {
    viewport: { width: 810, height: 1080 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    defaultBrowserType: 'webkit',
    userAgent: 'Mozilla/5.0 (iPad; CPU OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1'
  }
};

// =============================================================================
// ANDROID DEVICES
// =============================================================================

const ANDROID_DEVICES = {
  // Google Pixel Series
  'Pixel 8 Pro': {
    viewport: { width: 412, height: 915 },
    deviceScaleFactor: 2.625,
    isMobile: true,
    hasTouch: true,
    defaultBrowserType: 'chromium',
    userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36'
  },
  'Pixel 8': {
    viewport: { width: 412, height: 915 },
    deviceScaleFactor: 2.625,
    isMobile: true,
    hasTouch: true,
    defaultBrowserType: 'chromium',
    userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36'
  },
  'Pixel 7 Pro': {
    viewport: { width: 412, height: 915 },
    deviceScaleFactor: 2.625,
    isMobile: true,
    hasTouch: true,
    defaultBrowserType: 'chromium',
    userAgent: 'Mozilla/5.0 (Linux; Android 13; Pixel 7 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Mobile Safari/537.36'
  },
  'Pixel 7': {
    viewport: { width: 412, height: 915 },
    deviceScaleFactor: 2.625,
    isMobile: true,
    hasTouch: true,
    defaultBrowserType: 'chromium',
    userAgent: 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Mobile Safari/537.36'
  },
  'Pixel 6 Pro': {
    viewport: { width: 412, height: 892 },
    deviceScaleFactor: 3.5,
    isMobile: true,
    hasTouch: true,
    defaultBrowserType: 'chromium',
    userAgent: 'Mozilla/5.0 (Linux; Android 12; Pixel 6 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.0.0 Mobile Safari/537.36'
  },
  'Pixel 6': {
    viewport: { width: 412, height: 915 },
    deviceScaleFactor: 2.625,
    isMobile: true,
    hasTouch: true,
    defaultBrowserType: 'chromium',
    userAgent: 'Mozilla/5.0 (Linux; Android 12; Pixel 6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.0.0 Mobile Safari/537.36'
  },
  'Pixel 5': {
    viewport: { width: 393, height: 851 },
    deviceScaleFactor: 2.75,
    isMobile: true,
    hasTouch: true,
    defaultBrowserType: 'chromium',
    userAgent: 'Mozilla/5.0 (Linux; Android 11; Pixel 5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.0.0 Mobile Safari/537.36'
  },
  
  // Samsung Galaxy S Series
  'Galaxy S24 Ultra': {
    viewport: { width: 412, height: 915 },
    deviceScaleFactor: 3.5,
    isMobile: true,
    hasTouch: true,
    defaultBrowserType: 'chromium',
    userAgent: 'Mozilla/5.0 (Linux; Android 14; SM-S928B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36'
  },
  'Galaxy S24+': {
    viewport: { width: 412, height: 915 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    defaultBrowserType: 'chromium',
    userAgent: 'Mozilla/5.0 (Linux; Android 14; SM-S926B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36'
  },
  'Galaxy S24': {
    viewport: { width: 360, height: 780 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    defaultBrowserType: 'chromium',
    userAgent: 'Mozilla/5.0 (Linux; Android 14; SM-S921B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36'
  },
  'Galaxy S23 Ultra': {
    viewport: { width: 412, height: 915 },
    deviceScaleFactor: 3.5,
    isMobile: true,
    hasTouch: true,
    defaultBrowserType: 'chromium',
    userAgent: 'Mozilla/5.0 (Linux; Android 13; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Mobile Safari/537.36'
  },
  'Galaxy S23': {
    viewport: { width: 360, height: 780 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    defaultBrowserType: 'chromium',
    userAgent: 'Mozilla/5.0 (Linux; Android 13; SM-S911B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Mobile Safari/537.36'
  },
  'Galaxy S22 Ultra': {
    viewport: { width: 412, height: 915 },
    deviceScaleFactor: 3.5,
    isMobile: true,
    hasTouch: true,
    defaultBrowserType: 'chromium',
    userAgent: 'Mozilla/5.0 (Linux; Android 12; SM-S908B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.0.0 Mobile Safari/537.36'
  },
  'Galaxy S21': {
    viewport: { width: 360, height: 800 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    defaultBrowserType: 'chromium',
    userAgent: 'Mozilla/5.0 (Linux; Android 11; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.0.0 Mobile Safari/537.36'
  },
  
  // Samsung Galaxy A Series (Mid-range - very popular)
  'Galaxy A54': {
    viewport: { width: 360, height: 800 },
    deviceScaleFactor: 2.625,
    isMobile: true,
    hasTouch: true,
    defaultBrowserType: 'chromium',
    userAgent: 'Mozilla/5.0 (Linux; Android 13; SM-A546B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Mobile Safari/537.36'
  },
  'Galaxy A34': {
    viewport: { width: 360, height: 800 },
    deviceScaleFactor: 2.625,
    isMobile: true,
    hasTouch: true,
    defaultBrowserType: 'chromium',
    userAgent: 'Mozilla/5.0 (Linux; Android 13; SM-A346B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Mobile Safari/537.36'
  },
  
  // Samsung Galaxy Tab
  'Galaxy Tab S9': {
    viewport: { width: 800, height: 1280 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    defaultBrowserType: 'chromium',
    userAgent: 'Mozilla/5.0 (Linux; Android 13; SM-X710) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36'
  },
  'Galaxy Tab S8': {
    viewport: { width: 800, height: 1280 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    defaultBrowserType: 'chromium',
    userAgent: 'Mozilla/5.0 (Linux; Android 12; SM-X700) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.0.0 Safari/537.36'
  },
  
  // OnePlus
  'OnePlus 12': {
    viewport: { width: 412, height: 915 },
    deviceScaleFactor: 3.5,
    isMobile: true,
    hasTouch: true,
    defaultBrowserType: 'chromium',
    userAgent: 'Mozilla/5.0 (Linux; Android 14; CPH2573) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36'
  },
  'OnePlus 11': {
    viewport: { width: 412, height: 915 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    defaultBrowserType: 'chromium',
    userAgent: 'Mozilla/5.0 (Linux; Android 13; CPH2449) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Mobile Safari/537.36'
  },
  
  // Xiaomi
  'Xiaomi 14 Pro': {
    viewport: { width: 412, height: 915 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    defaultBrowserType: 'chromium',
    userAgent: 'Mozilla/5.0 (Linux; Android 14; 2311DRK48C) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36'
  },
  'Redmi Note 13 Pro': {
    viewport: { width: 393, height: 873 },
    deviceScaleFactor: 2.75,
    isMobile: true,
    hasTouch: true,
    defaultBrowserType: 'chromium',
    userAgent: 'Mozilla/5.0 (Linux; Android 13; 23090RA98G) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Mobile Safari/537.36'
  }
};

// =============================================================================
// DEVICE CATEGORIES FOR UI
// =============================================================================

const DEVICE_CATEGORIES = {
  'Popular': [
    'iPhone 15 Pro Max',
    'iPhone 14 Pro',
    'Pixel 8',
    'Galaxy S24',
    'iPad Pro 11'
  ],
  'iOS - iPhone': [
    'iPhone 15 Pro Max',
    'iPhone 15 Pro',
    'iPhone 15',
    'iPhone 14 Pro Max',
    'iPhone 14 Pro',
    'iPhone 14',
    'iPhone 13 Pro Max',
    'iPhone 13',
    'iPhone SE (3rd Gen)',
    'iPhone 11'
  ],
  'iOS - iPad': [
    'iPad Pro 12.9',
    'iPad Pro 11',
    'iPad Air',
    'iPad Mini',
    'iPad'
  ],
  'Android - Google': [
    'Pixel 8 Pro',
    'Pixel 8',
    'Pixel 7 Pro',
    'Pixel 7',
    'Pixel 6',
    'Pixel 5'
  ],
  'Android - Samsung': [
    'Galaxy S24 Ultra',
    'Galaxy S24+',
    'Galaxy S24',
    'Galaxy S23 Ultra',
    'Galaxy S23',
    'Galaxy A54',
    'Galaxy Tab S9'
  ],
  'Android - Other': [
    'OnePlus 12',
    'OnePlus 11',
    'Xiaomi 14 Pro',
    'Redmi Note 13 Pro'
  ]
};

// =============================================================================
// COMBINED DEVICES
// =============================================================================

const MOBILE_DEVICES = {
  ...IOS_DEVICES,
  ...ANDROID_DEVICES
};

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Get a device profile by name
 * @param {string} deviceName - Name of the device
 * @returns {object|null} Device profile or null if not found
 */
function getDevice(deviceName) {
  return MOBILE_DEVICES[deviceName] || null;
}

/**
 * Get all device names
 * @returns {string[]} Array of device names
 */
function getDeviceNames() {
  return Object.keys(MOBILE_DEVICES);
}

/**
 * Get devices by platform
 * @param {'ios'|'android'} platform 
 * @returns {object} Devices for the platform
 */
function getDevicesByPlatform(platform) {
  return platform === 'ios' ? IOS_DEVICES : ANDROID_DEVICES;
}

/**
 * Get device categories for UI rendering
 * @returns {object} Categories with device arrays
 */
function getDeviceCategories() {
  return DEVICE_CATEGORIES;
}

/**
 * Check if a device is iOS
 * @param {string} deviceName 
 * @returns {boolean}
 */
function isIOS(deviceName) {
  return deviceName in IOS_DEVICES;
}

/**
 * Check if a device is Android
 * @param {string} deviceName 
 * @returns {boolean}
 */
function isAndroid(deviceName) {
  return deviceName in ANDROID_DEVICES;
}

/**
 * Get the recommended browser type for a device
 * @param {string} deviceName 
 * @returns {'webkit'|'chromium'|'firefox'}
 */
function getRecommendedBrowser(deviceName) {
  const device = MOBILE_DEVICES[deviceName];
  return device?.defaultBrowserType || 'chromium';
}

/**
 * Create a custom device profile
 * @param {object} options 
 * @returns {object} Custom device profile
 */
function createCustomDevice(options) {
  return {
    viewport: { 
      width: options.width || 375, 
      height: options.height || 812 
    },
    deviceScaleFactor: options.deviceScaleFactor || 2,
    isMobile: true,
    hasTouch: true,
    defaultBrowserType: options.browserType || 'chromium',
    userAgent: options.userAgent || 'Mozilla/5.0 (Linux; Android 13; Custom Device) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Mobile Safari/537.36'
  };
}

// =============================================================================
// NETWORK PRESETS (for mobile network simulation)
// =============================================================================

const NETWORK_PRESETS = {
  '5G': {
    offline: false,
    downloadThroughput: 100 * 1024 * 1024 / 8, // 100 Mbps
    uploadThroughput: 50 * 1024 * 1024 / 8,    // 50 Mbps
    latency: 10
  },
  '4G LTE': {
    offline: false,
    downloadThroughput: 50 * 1024 * 1024 / 8,  // 50 Mbps
    uploadThroughput: 10 * 1024 * 1024 / 8,    // 10 Mbps
    latency: 20
  },
  '4G': {
    offline: false,
    downloadThroughput: 20 * 1024 * 1024 / 8,  // 20 Mbps
    uploadThroughput: 5 * 1024 * 1024 / 8,     // 5 Mbps
    latency: 50
  },
  '3G': {
    offline: false,
    downloadThroughput: 1.5 * 1024 * 1024 / 8, // 1.5 Mbps
    uploadThroughput: 750 * 1024 / 8,          // 750 Kbps
    latency: 100
  },
  '2G': {
    offline: false,
    downloadThroughput: 250 * 1024 / 8,        // 250 Kbps
    uploadThroughput: 50 * 1024 / 8,           // 50 Kbps
    latency: 300
  },
  'Slow 3G': {
    offline: false,
    downloadThroughput: 500 * 1024 / 8,        // 500 Kbps
    uploadThroughput: 100 * 1024 / 8,          // 100 Kbps
    latency: 400
  },
  'Offline': {
    offline: true,
    downloadThroughput: 0,
    uploadThroughput: 0,
    latency: 0
  }
};

/**
 * Get network preset
 * @param {string} presetName 
 * @returns {object|null}
 */
function getNetworkPreset(presetName) {
  return NETWORK_PRESETS[presetName] || null;
}

module.exports = {
  MOBILE_DEVICES,
  IOS_DEVICES,
  ANDROID_DEVICES,
  DEVICE_CATEGORIES,
  NETWORK_PRESETS,
  getDevice,
  getDeviceNames,
  getDevicesByPlatform,
  getDeviceCategories,
  isIOS,
  isAndroid,
  getRecommendedBrowser,
  createCustomDevice,
  getNetworkPreset
};
