/**
 * Playwright-based Recorder
 * 
 * Opens a standalone Playwright browser for recording.
 * Injects the EXACT SAME recorder-engine.js used by the browser extension.
 * Produces IDENTICAL output to the browser extension.
 * 
 * NO COMPROMISES - must match browser extension exactly.
 */

const playwright = require('playwright');
const { chromium, firefox, webkit } = playwright;
const path = require('path');
const fs = require('fs');
const { EventEmitter } = require('events');

// cssEscape polyfill for Node.js (browser API not available in Electron main process)
// Based on https://drafts.csswg.org/cssom/#serialize-an-identifier
const cssEscape = (value) => {
  if (value == null) return '';
  const string = String(value);
  const length = string.length;
  let result = '';
  for (let i = 0; i < length; i++) {
    const char = string.charAt(i);
    const code = string.charCodeAt(i);
    // If the character is NULL, use replacement character
    if (code === 0x0000) {
      result += '\uFFFD';
      continue;
    }
    if (
      (code >= 0x0001 && code <= 0x001F) || // C0 controls
      code === 0x007F || // DEL
      (i === 0 && code >= 0x0030 && code <= 0x0039) || // digit at start
      (i === 1 && code >= 0x0030 && code <= 0x0039 && string.charCodeAt(0) === 0x002D) // digit after hyphen at start
    ) {
      result += '\\' + code.toString(16) + ' ';
      continue;
    }
    if (i === 0 && code === 0x002D && length === 1) {
      result += '\\' + char;
      continue;
    }
    if (
      code >= 0x0080 ||
      code === 0x002D || // hyphen
      code === 0x005F || // underscore
      (code >= 0x0030 && code <= 0x0039) || // digit
      (code >= 0x0041 && code <= 0x005A) || // uppercase
      (code >= 0x0061 && code <= 0x007A) // lowercase
    ) {
      result += char;
      continue;
    }
    result += '\\' + char;
  }
  return result;
};

/**
 * Sanitize object for logging - masks sensitive fields
 * @param {object} obj - Object to sanitize
 * @returns {object} - Copy with sensitive values masked
 */
function sanitizeForLog(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  const sensitive = ['password', 'passwd', 'secret', 'token', 'securityToken', 'security_token',
    'api_key', 'apikey', 'access_token', 'refresh_token', 'client_secret', 'private_key'];
  const sanitized = { ...obj };
  for (const key of Object.keys(sanitized)) {
    if (sensitive.some(s => key.toLowerCase().includes(s.toLowerCase()))) {
      sanitized[key] = '[MASKED]';
    }
  }
  return sanitized;
}

// ============================================================
// TEXT NORMALIZATION UTILITIES (Module-level for use everywhere)
// Critical for matching recorded text against page text
// Handles: apostrophe variants (', ', etc.), quote variants, whitespace
// ============================================================
const normalizeTextForMatching = (text) => {
  // CRITICAL: Handle null, undefined, AND non-string types (arrays, objects)
  if (!text || typeof text !== 'string') return '';
  return text
    .replace(/[\u2018\u2019\u201B\u2032\u0060\u00B4\u02BC]/g, "'") // All apostrophe variants to straight
    .replace(/[\u201C\u201D\u201E\u201F\u2033]/g, '"')              // All quote variants to straight
    .replace(/\s+/g, ' ')                                          // Normalize whitespace
    .trim();
};

// Extract element text from description like 'Click "Submit"' -> 'Submit'
const extractTextFromDescription = (description) => {
  if (!description) return '';
  const match = description.match(/(?:Click|Fill|Select|Type|Check|Uncheck|Press|Toggle)\s*"([^"]+)"/i);
  if (match) return match[1];
  // Also try single quotes
  const matchSingle = description.match(/(?:Click|Fill|Select|Type|Check|Uncheck|Press|Toggle)\s*'([^']+)'/i);
  if (matchSingle) return matchSingle[1];
  return description; // Return full description as fallback
};

// Get the best label for an action from all available sources
const getActionLabel = (action) => {
  // Priority order: label > text > selectorObj.text > recipe.what.text > extracted from description
  let label = action.label || 
              action.text || 
              action.selectorObj?.text ||
              action.recipe?.what?.text ||
              action.args?.[0];
  
  // If still no label, try extracting from description
  if (!label && action.description) {
    label = extractTextFromDescription(action.description);
  }
  
  // Normalize the label for matching
  return normalizeTextForMatching(label || '');
};

// Path to shared recorder engine (SINGLE SOURCE OF TRUTH)
const RECORDER_ENGINE_PATH = path.join(__dirname, '../../../flowstral-extension/src/lib/recorder-engine.js');

// V2 Recipe-based recorder (more robust element identification)
const { getRecipeClickCaptureScript, recipeActionToLegacy, legacyActionToRecipe } = require('./lib/recipe-recorder-integration');
const { SmartFinder, ActionExecutor } = require('./lib/smart-finder');

// Refactored handler modules (extracted for maintainability)
const ActionHandlers = require('./lib/action-handlers');
const { getManualOverrideSelector, getLockedSelector } = require('./lib/override-and-locked');
// V2 Simplified playback: Playwright-native element finding with parallel racing
const { SimpleStepExecutor } = require('./lib/simple-step-executor');
const TabManager = require('./lib/tab-manager');
const SalesforceHandlers = require('./lib/salesforce-handlers');
const { executeAssertion: executeAssertionHandler } = require('./lib/assertion-handlers');

// Confidence System - Calculate and report step reliability
const { ConfidenceCalculator } = require('./lib/confidence');
const { MetadataCollector } = require('./lib/step-metadata');
const { ScreenshotManager } = require('./lib/screenshots');

// Mobile testing support (Phase 1: Emulation, Phase 2: Maestro)
const { MOBILE_DEVICES, getDevice, getDeviceCategories, NETWORK_PRESETS, getNetworkPreset } = require('./lib/mobile-devices');

// Extracted injected scripts (large string templates)
const { getOverlayScript } = require('./recorder-overlay-script');
const { getClickCaptureScript } = require('./recorder-click-capture-script');
const { getRecorderScript } = require('./recorder-injected-script');

// ============================================================
// BROWSER LAUNCH HELPER - Tries Playwright browsers, then system Chrome/Edge
// Required because packaged app may not have Playwright browsers bundled
// ============================================================
async function launchBrowserWithFallback(launchOptions, userDataDir = null, browserType = 'chromium') {
  // Select the browser engine based on browserType
  const browserEngine = browserType === 'firefox' ? firefox : browserType === 'webkit' ? webkit : chromium;
  // Only chromium supports channel variants (chrome, msedge); others use null channel
  const channels = browserType === 'chromium' ? [null, 'chrome', 'msedge', 'chromium'] : [null];
  let lastError = null;

  for (const channel of channels) {
    try {
      const opts = { ...launchOptions };
      if (channel) {
        console.log(`[PlaywrightRecorder] Trying to launch ${browserType} with channel: ${channel}`);
        opts.channel = channel;
      }

      let context;
      if (userDataDir && browserType === 'chromium') {
        // Persistent context only supported well on Chromium
        context = await browserEngine.launchPersistentContext(userDataDir, opts);
      } else {
        const browser = await browserEngine.launch(opts);
        context = await browser.newContext(launchOptions);
        context._browser = browser;
      }

      console.log(`[PlaywrightRecorder] Successfully launched ${browserType}${channel ? ` with channel: ${channel}` : ''}`);
      return context;
    } catch (error) {
      lastError = error;
      console.log(`[PlaywrightRecorder] Failed to launch ${browserType}${channel ? ` with channel ${channel}` : ''}: ${error.message}`);
    }
  }

  throw new Error(`Failed to launch ${browserType} browser. Last error: ${lastError?.message}`);
}

class PlaywrightRecorder extends EventEmitter {
  constructor(options = {}) {
    super();
    this.browser = null;
    this.context = null;
    this.page = null;
    this.recording = false;
    this.paused = false;
    this.actions = [];
    this.manualActions = []; // Steps added manually (from suggestions) - these persist
    this.startUrl = null;
    this.pollInterval = null;
    this.suggestionInterval = null;
    this.lastProcessedIndex = 0;
    this.seenActionIds = new Set();
    this.lastSuggestionHash = '';
    
    // Debug mode state
    this._debugMode = false;
    this._testPaused = false;
    this._pausedAtStep = -1;
    this._pauseResolver = null;
    this._stopRequested = false;
    this._currentTestSteps = [];
    this._stepByStep = false;
    
    // ========== MOBILE TESTING CONFIGURATION ==========
    // Backward compatible: null = desktop mode (default)
    this.mobileDevice = options.mobileDevice || null; // e.g., 'iPhone 15 Pro', 'Pixel 8'
    this.mobileNetwork = options.mobileNetwork || null; // e.g., '4G', '3G', 'Slow 3G'
    this.isMobileMode = false; // Set to true when running in mobile emulation
    
    // V2 Recipe-based recorder (more robust element identification)
    // ENABLED: Better element finding on modern frameworks (Radix, Salesforce, etc.)
    this.useRecipeRecorder = options.useRecipeRecorder !== false; // ENABLED by default
    this.recipeActions = []; // Actions captured by v2 recorder
    this.smartFinder = null; // SmartFinder instance for playback
    this.useSmartFinderForPlayback = options.useSmartFinderForPlayback !== false; // Use SmartFinder during playback
    
    // CRITICAL: Track when interactions happen to suppress navigation events
    // Navigation events can fire BEFORE click is fully processed, causing duplicate actions
    this._lastInteractionTimestamp = 0; // Timestamp of last click/select/fill START
    
    // ========== V2 SIMPLE PLAYBACK ==========
    // Uses Playwright-native auto-wait instead of manual count()+isVisible() snapshots
    // Parallel strategy racing instead of sequential waterfall
    // Set to true for 3-10x faster element finding on happy path
    this.useSimplePlayback = options.useSimplePlayback !== false; // Default: ON (opt-out)
    this._simpleStepExecutor = null; // Lazy-initialized per test run
    
    // AI Vision Fallback - LAST RESORT when all deterministic strategies fail
    this.enableAIFallback = options.enableAIFallback !== false; // Default: enabled
    this.aiCallsThisRun = 0;
    this.maxAICallsPerRun = options.maxAICallsPerRun || 5; // Budget per test run
    
    // Load recorder engine code once
    this.recorderEngineCode = '';
    try {
      this.recorderEngineCode = fs.readFileSync(RECORDER_ENGINE_PATH, 'utf8');
      console.log('[PlaywrightRecorder] Loaded recorder-engine.js');
    } catch (e) {
      console.error('[PlaywrightRecorder] Failed to load recorder-engine.js:', e.message);
    }
    
    // ========== CONFIDENCE SYSTEM ==========
    // Track reliability of element identification for each step
    this.confidenceCalculator = new ConfidenceCalculator({ debug: options.debugConfidence });
    this.metadataCollector = new MetadataCollector({ debug: options.debugConfidence });
    this.screenshotManager = new ScreenshotManager({ debug: options.debugConfidence });
    this._stepMetadata = new Map(); // stepIndex -> metadata
  }

  // ===========================================================================
  // MOBILE TESTING METHODS (Phase 1: Emulation)
  // Backward compatible: All existing code continues to work unchanged
  // ===========================================================================
  
  /**
   * Configure mobile device emulation
   * Call this BEFORE start() to record/test in mobile mode
   * @param {string} deviceName - Name of device (e.g., 'iPhone 15 Pro', 'Pixel 8')
   * @param {object} options - Additional options
   * @returns {object} Device configuration
   */
  setMobileDevice(deviceName, options = {}) {
    const device = getDevice(deviceName);
    
    if (!device) {
      console.warn(`[PlaywrightRecorder] Unknown device: ${deviceName}`);
      console.log('[PlaywrightRecorder] Available devices:', Object.keys(MOBILE_DEVICES).slice(0, 10).join(', ') + '...');
      return null;
    }
    
    this.mobileDevice = {
      name: deviceName,
      config: { ...device },
      // Custom overrides
      ...(options.geolocation && { geolocation: options.geolocation }),
      ...(options.permissions && { permissions: options.permissions })
    };
    
    this.isMobileMode = true;
    
    console.log(`[PlaywrightRecorder] Mobile mode: ${deviceName}`);
    console.log(`[PlaywrightRecorder] Viewport: ${device.viewport.width}x${device.viewport.height}`);
    
    return this.mobileDevice;
  }
  
  /**
   * Configure network throttling for mobile testing
   * @param {string} networkPreset - Network preset (e.g., '4G', '3G', 'Slow 3G')
   */
  setMobileNetwork(networkPreset) {
    const preset = getNetworkPreset(networkPreset);
    
    if (!preset) {
      console.warn(`[PlaywrightRecorder] Unknown network preset: ${networkPreset}`);
      console.log('[PlaywrightRecorder] Available presets:', Object.keys(NETWORK_PRESETS).join(', '));
      return null;
    }
    
    this.mobileNetwork = { name: networkPreset, config: preset };
    console.log(`[PlaywrightRecorder] Network throttling: ${networkPreset}`);
    
    return this.mobileNetwork;
  }
  
  /**
   * Clear mobile configuration (return to desktop mode)
   */
  clearMobileDevice() {
    this.mobileDevice = null;
    this.mobileNetwork = null;
    this.isMobileMode = false;
    console.log('[PlaywrightRecorder] Reset to desktop mode');
  }
  
  /**
   * Get mobile context options for Playwright
   * @returns {object} Context options for mobile emulation
   */
  getMobileContextOptions() {
    if (!this.mobileDevice) {
      return {}; // Desktop mode - no special options
    }
    
    const device = this.mobileDevice.config;
    return {
      viewport: device.viewport,
      deviceScaleFactor: device.deviceScaleFactor,
      isMobile: device.isMobile,
      hasTouch: device.hasTouch,
      userAgent: device.userAgent,
      // Optional extras
      ...(this.mobileDevice.geolocation && { 
        geolocation: this.mobileDevice.geolocation,
        permissions: ['geolocation']
      }),
      ...(this.mobileDevice.permissions && { permissions: this.mobileDevice.permissions })
    };
  }
  
  /**
   * Apply network throttling to the context
   * @param {object} context - Playwright browser context
   */
  async applyMobileNetwork(context) {
    if (!this.mobileNetwork || !context) return;
    
    try {
      const page = context.pages()[0];
      if (!page) return;
      
      const cdpSession = await context.newCDPSession(page);
      await cdpSession.send('Network.enable');
      await cdpSession.send('Network.emulateNetworkConditions', this.mobileNetwork.config);
      console.log(`[PlaywrightRecorder] Applied network throttling: ${this.mobileNetwork.name}`);
    } catch (e) {
      console.log('[PlaywrightRecorder] Could not apply network conditions:', e.message);
    }
  }
  
  /**
   * Get available devices for UI display
   * @returns {object} Device categories and all devices
   */
  static getAvailableDevices() {
    return {
      categories: getDeviceCategories(),
      devices: MOBILE_DEVICES,
      networks: NETWORK_PRESETS
    };
  }
  
  /**
   * Check if currently in mobile mode
   * @returns {boolean}
   */
  isInMobileMode() {
    return this.isMobileMode && this.mobileDevice !== null;
  }
  
  /**
   * Get current mobile configuration
   * @returns {object|null}
   */
  getMobileConfig() {
    if (!this.isMobileMode) return null;
    
    return {
      device: this.mobileDevice?.name,
      viewport: this.mobileDevice?.config?.viewport,
      userAgent: this.mobileDevice?.config?.userAgent,
      network: this.mobileNetwork?.name
    };
  }

  /**
   * Get the browser overlay - ENHANCED with categories, duplicate warnings, and execute
   * Shadow DOM isolated, matches extension's robust suggest panel
   */
  _getOverlayScript() {
    return getOverlayScript();
  }

  /**
   * Launch browser and start recording
   */
  async start(url, options = {}) {
    if (this.browser) {
      await this.stop();
    }

    const browserType = options.browserType || 'chromium';
    console.log(`[PlaywrightRecorder] Starting ${browserType} browser...`);
    
    // Use persistent browser context to maintain login sessions (avoid OTP prompts)
    const { app } = require('electron');
    const path = require('path');
    const userDataDir = path.join(app.getPath('userData'), 'playwright-browser-data');
    
    // Get mobile emulation options if configured (backward compatible: desktop by default)
    const mobileOptions = this.getMobileContextOptions();
    const isMobile = this.isInMobileMode();
    
    if (isMobile) {
      console.log(`[PlaywrightRecorder] Mobile mode: ${this.mobileDevice.name}`);
      console.log(`[PlaywrightRecorder] Viewport: ${mobileOptions.viewport.width}x${mobileOptions.viewport.height}`);
    }
    
    // ═══════════════════════════════════════════════════════════════════
    // STEALTH MODE: Anti-bot detection measures
    // Many retail sites (Walmart, Kohl's, Target) use Akamai/Cloudflare
    // bot protection that detects Playwright. These args help evade detection.
    // ═══════════════════════════════════════════════════════════════════
    const stealthArgs = [
      '--start-maximized',
      '--disable-blink-features=AutomationControlled',
      '--disable-features=BlockInsecurePrivateNetworkRequests',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--disable-gpu',
      '--window-size=1920,1080',
      '--hide-scrollbars',
      '--mute-audio',
      // Critical for bot detection evasion
      '--disable-backgrounding-occluded-windows',
      '--disable-renderer-backgrounding',
      '--disable-background-timer-throttling',
      '--disable-ipc-flooding-protection',
      '--password-store=basic',
      '--use-mock-keychain',
      '--force-color-profile=srgb',
      // Prevent WebDriver detection
      '--disable-infobars',
      '--enable-features=NetworkService,NetworkServiceInProcess',
    ];
    
    // Launch browser with PERSISTENT context (keeps cookies, localStorage, auth)
    // MOBILE SUPPORT: Merges mobile options when configured, otherwise uses desktop defaults
    // Uses fallback to system Chrome/Edge if Playwright browsers not available
    // CROSS-BROWSER: browserType can be 'chromium', 'firefox', or 'webkit'
    this.context = await launchBrowserWithFallback({
      headless: false,
      // Mobile: use device viewport, Desktop: full window
      viewport: isMobile ? mobileOptions.viewport : null,
      // Mobile: use device user agent, Desktop: Chrome UA
      userAgent: isMobile ? mobileOptions.userAgent : 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
      // Chromium-only args (Firefox/WebKit ignore these)
      ...(browserType === 'chromium' && { args: stealthArgs }),
      // Mobile-specific options
      ...(isMobile && {
        deviceScaleFactor: mobileOptions.deviceScaleFactor,
        isMobile: mobileOptions.isMobile,
        hasTouch: mobileOptions.hasTouch,
        ...(mobileOptions.geolocation && { geolocation: mobileOptions.geolocation }),
        ...(mobileOptions.permissions && { permissions: mobileOptions.permissions })
      }),
      // HTTPS error handling — disabled for security hardening
      ignoreHTTPSErrors: false,
    }, userDataDir, browserType);
    
    // ═══════════════════════════════════════════════════════════════════
    // STEALTH SCRIPT: Patch navigator.webdriver and other detection vectors
    // This runs BEFORE any page scripts, making detection much harder
    // ═══════════════════════════════════════════════════════════════════
    await this.context.addInitScript(() => {
      // Remove webdriver property
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined,
      });
      
      // Overwrite the 'plugins' property to use a custom getter
      Object.defineProperty(navigator, 'plugins', {
        get: () => [
          { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer', description: 'Portable Document Format' },
          { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai', description: '' },
          { name: 'Native Client', filename: 'internal-nacl-plugin', description: '' },
        ],
      });
      
      // Overwrite the 'languages' property
      Object.defineProperty(navigator, 'languages', {
        get: () => ['en-US', 'en'],
      });
      
      // Override permissions
      const originalQuery = window.navigator.permissions.query;
      window.navigator.permissions.query = (parameters) => (
        parameters.name === 'notifications' ?
          Promise.resolve({ state: Notification.permission }) :
          originalQuery(parameters)
      );
      
      // Mask Chrome-specific properties
      window.chrome = {
        runtime: {},
        loadTimes: function() {},
        csi: function() {},
        app: {},
      };
      
      // Pass WebGL vendor/renderer check
      const getParameter = WebGLRenderingContext.prototype.getParameter;
      WebGLRenderingContext.prototype.getParameter = function(parameter) {
        if (parameter === 37445) return 'Intel Inc.';
        if (parameter === 37446) return 'Intel Iris OpenGL Engine';
        return getParameter.call(this, parameter);
      };
      
      console.log('[Flowstral Stealth] Anti-detection patches applied');
    });
    
    // With persistent context, use pages() or newPage()
    // Get existing page or create new one
    const pages = this.context.pages();
    this.page = pages.length > 0 ? pages[0] : await this.context.newPage();

    // ═══════════════════════════════════════════════════════════════════
    // SECURITY: Clear stored session data at the start of each trace
    // Prevents auth token/cookie leakage between recording sessions
    // ═══════════════════════════════════════════════════════════════════
    try {
      await this.context.clearCookies();
      console.log('[PlaywrightRecorder] Cleared cookies for session isolation');
    } catch (e) {
      // clearCookies may not be available on persistent contexts
      console.log('[PlaywrightRecorder] Cookie clearing skipped:', e.message);
    }

    // ============================================================
    // CROSS-DOMAIN CLICK/INPUT REPORTING VIA CONSOLE LOGS
    // This approach is more reliable than exposeFunction because:
    // 1. Works across page navigations and subdomains
    // 2. Doesn't fail on subsequent recordings
    // 3. page.on('console') captures messages from ALL pages
    // ============================================================
    this.pendingClicks = []; // Store pending clicks in main process memory
    this.pendingInputs = []; // Store pending inputs in main process memory
    
    // Setup console listener for main page
    this._setupConsoleListenerForPage(this.page, 0);
    
    console.log('[PlaywrightRecorder] Console-based click/input capture enabled');
    
    // ============================================================
    // CONTEXT-LEVEL SCRIPT INJECTION - CRITICAL FOR MULTI-TAB!
    // Using context.addInitScript instead of page.addInitScript ensures
    // scripts are injected into ALL new pages/tabs in this context,
    // including cross-subdomain navigations (e.g., tx.my.xcel -> www.xcel)
    // ============================================================
    
    // Inject recorder script at CONTEXT level - will apply to ALL pages!
    await this.context.addInitScript(this._getRecorderScript());
    console.log('[PlaywrightRecorder] Recorder script added to CONTEXT (all pages)');
    
    // Inject minimal recording indicator at CONTEXT level
    await this.context.addInitScript(this._getOverlayScript());
    
    // CRITICAL: Inject click capture at CONTEXT level for multi-tab recording!
    await this.context.addInitScript(this._getClickCaptureScript());
    console.log('[PlaywrightRecorder] Click capture added to CONTEXT (all pages)');
    
    // V2: Add Recipe recorder at context level too
    if (this.useRecipeRecorder) {
      await this.context.addInitScript(getRecipeClickCaptureScript());
      console.log('[PlaywrightRecorder] Recipe recorder added to CONTEXT (all pages)');
    }
    
    // Also inject into current page immediately (addInitScript only affects NEW navigations)
    await this.page.addInitScript(this._getRecorderScript());
    await this.page.addInitScript(this._getOverlayScript());
    await this.page.addInitScript(this._getClickCaptureScript());

    // Navigate to URL
    this.startUrl = url;
    // CLEAR all actions for a fresh recording - no carryover from previous sessions
    this.actions = [];
    this.manualActions = []; // Also clear manual actions
    this.recording = true;
    this.paused = false;
    this.lastProcessedIndex = 0;
    this.seenActionIds = new Set();
    this.lastSuggestionHash = ''; // Reset suggestion hash

    if (url) {
      await this.page.goto(url, { waitUntil: 'domcontentloaded' });
      
      // Inject click capture script IMMEDIATELY after page loads
      try {
        await this.page.evaluate(this._getClickCaptureScript());
        console.log('[PlaywrightRecorder] Click capture injected into initial page');
      } catch (e) {
        console.warn('[PlaywrightRecorder] Could not inject click capture:', e.message);
      }
      
      // Record initial navigation
      this._addAction({
        type: 'navigate',
        url: url,
        timestamp: Date.now(),
        description: `Navigate to ${new URL(url).hostname}`
      });
    }

    // Start polling for actions from the page
    // NOTE: In recipe mode, ONLY the CDP/recipe polling system handles actions.
    // The legacy poller would create a dual-system race condition where fills
    // from __flowstralActions__ arrive before clicks from __flowstralRecipeActions,
    // causing incorrect action ordering. Recipe captures everything (clicks, fills,
    // selects, checks, keyboard, file uploads, drag-drop), so legacy is redundant.
    if (!this.useRecipeRecorder) {
      this._startPolling();
    }
    
    // Start polling for suggestions (auto-refresh)
    this._startSuggestionPolling();
    
    // Overlay polling disabled
    // this._startOverlayPolling();

    // Handle page close - but NOT during test runs!
    this.page.on('close', () => {
      console.log('[PlaywrightRecorder] Page closed');
      // CRITICAL: Don't stop if we're running a test (test manages its own browser)
      if (!this._isRunningTest) {
        this.stop();
      }
    });
    
    // Handle JavaScript dialogs (alert, confirm, prompt)
    // Auto-accept by default during playback, record during recording
    this.page.on('dialog', async (dialog) => {
      const dialogType = dialog.type(); // 'alert', 'confirm', 'prompt', 'beforeunload'
      const message = dialog.message();
      console.log(`[PlaywrightRecorder] Dialog detected: ${dialogType} - "${message.substring(0, 50)}"`);
      
      if (this.recording && !this._isRunningTest) {
        // During recording, record the dialog and auto-accept
        this._addAction({
          type: 'dialog',
          dialogType: dialogType,
          message: message,
          action: 'accept', // Default action
          timestamp: Date.now(),
          description: `Handle ${dialogType}: "${message.substring(0, 30)}..."`
        });
      }
      
      // Auto-accept dialogs (can be customized per step later)
      try {
        if (dialogType === 'prompt') {
          await dialog.accept(''); // Accept with empty string for prompts
        } else {
          await dialog.accept();
        }
        console.log(`[PlaywrightRecorder] Dialog auto-accepted`);
      } catch (e) {
        console.log(`[PlaywrightRecorder] Dialog handling error:`, e.message);
      }
    });
    
    // ============================================================
    // MULTI-TAB/WINDOW CONTEXT MANAGEMENT
    // Track all pages, detect switches, handle closes
    // ============================================================
    
    // Initialize page tracking
    this._pages = [this.page]; // Track all pages
    this._currentPageIndex = 0; // Index of active page
    this._pageUrls = [this.page.url()]; // URLs for identification
    
    // Handle new tabs/popups
    this.context.on('page', async (newPage) => {
      const newUrl = newPage.url();
      const newPageIndex = this._pages.length;
      
      console.log(`[PlaywrightRecorder] New tab/popup opened: ${newUrl} (index: ${newPageIndex})`);
      
      // Add to tracking
      this._pages.push(newPage);
      this._pageUrls.push(newUrl);
      
      // NOTE: Don't add newTab action here - we'll determine if it's cross-origin 
      // below and add the appropriate action type (newTab or crossOriginPlaceholder)
      
      // Listen for this page being closed
      newPage.on('close', () => {
        const closedIndex = this._pages.indexOf(newPage);
        console.log(`[PlaywrightRecorder] Tab closed: index ${closedIndex}`);
        
        if (this.recording && !this._isRunningTest) {
          // ═══════════════════════════════════════════════════════════════
          // CRITICAL FIX: Flush any buffered actions for this tab BEFORE
          // recording closeTab/switchTab. Without this, actions captured
          // via CDP console (pendingClicks/pendingInputs) appear AFTER
          // the closeTab action, causing wrong step ordering.
          // ═══════════════════════════════════════════════════════════════
          this._flushPendingActionsForTab(closedIndex);
          
          this._addAction({
            type: 'closeTab',
            tabIndex: closedIndex,
            timestamp: Date.now(),
            description: `Closed tab ${closedIndex}`
          });
        }
        
        // Remove from tracking
        if (closedIndex !== -1) {
          this._pages.splice(closedIndex, 1);
          this._pageUrls.splice(closedIndex, 1);
          
          // ═══════════════════════════════════════════════════════════════
          // FIX: Update tab indices in pending data after splice.
          // When a tab is removed, all higher-indexed tabs shift down by 1.
          // Without this, pending clicks/inputs reference stale indices.
          // ═══════════════════════════════════════════════════════════════
          this._adjustTabIndicesAfterClose(closedIndex);
          
          // If closed tab was current, switch back to first tab
          if (this._currentPageIndex >= closedIndex) {
            this._currentPageIndex = Math.max(0, this._currentPageIndex - 1);
            this.page = this._pages[this._currentPageIndex];
            
            if (this.recording && !this._isRunningTest && this._pages.length > 0) {
              this._addAction({
                type: 'switchTab',
                tabIndex: this._currentPageIndex,
                timestamp: Date.now(),
                description: `Switched to tab ${this._currentPageIndex}`
              });
            }
          }
        }
      });
      
      // Listen for navigation within this new page
      // NOTE: This is NOT a tab switch - user is just clicking links inside the tab
      // We should NOT record switchTab here - that's handled by focus detection
      newPage.on('framenavigated', async (frame) => {
        if (frame === newPage.mainFrame() && this._pages.includes(newPage)) {
          const newUrl = frame.url();
          const pageIndex = this._pages.indexOf(newPage);
          
          // Just update the URL in our tracking - NOT a tab switch
          if (this._pageUrls && pageIndex < this._pageUrls.length) {
            this._pageUrls[pageIndex] = newUrl;
          }
          
          console.log(`[PlaywrightRecorder] Tab ${pageIndex} navigated to: ${newUrl.substring(0, 50)}`);
          
          // Try to re-inject recorder after navigation (will fail cross-origin)
          if (this.recording && !this._isRunningTest) {
            try {
              await this._injectClickCaptureScript(newPage);
            } catch (e) {
              // Cross-origin, expected
            }
          }
        }
      });
      
      // Setup recording for new page
      if (this.recording && !this._isRunningTest) {
        try {
          await newPage.waitForLoadState('domcontentloaded').catch(() => {});
          
          const newPageUrl = newPage.url();
          console.log('[PlaywrightRecorder] New tab URL:', newPageUrl);
          
          // Try JavaScript injection for element capture (will fail on cross-origin)
          let isCrossOrigin = false;
          try {
            await newPage.evaluate(this._getRecorderScript());
            await newPage.evaluate(this._getClickCaptureScript());
            if (this.useRecipeRecorder) {
              await newPage.evaluate(getRecipeClickCaptureScript());
            }
            console.log('[PlaywrightRecorder] JS recorder injected into new tab (same-origin)');
            
            // CRITICAL: Add console listener to capture actions from new tab!
            // Without this, actions in the new tab are NOT recorded
            this._setupConsoleListenerForPage(newPage, newPageIndex);
            
            // Same-origin tab - record as regular newTab
            this._addAction({
              type: 'newTab',
              url: newPageUrl,
              tabIndex: newPageIndex,
              timestamp: Date.now(),
              description: `New tab opened: ${newPageUrl.substring(0, 50)}`
            });
          } catch (e) {
            isCrossOrigin = true;
            console.log('[PlaywrightRecorder] Cross-origin tab detected:', newPageUrl);
            console.log('[PlaywrightRecorder] Note: context.addInitScript should still work for this tab!');
            
            // IMPORTANT: Even though direct evaluate() failed, context.addInitScript
            // might have already injected our scripts! Set up the console listener
            // to capture any actions from the context-level scripts.
            this._setupConsoleListenerForPage(newPage, newPageIndex);
            console.log('[PlaywrightRecorder] Console listener set up for cross-origin tab (for context-level scripts)');
            
            // Record as newTab - with context.addInitScript we CAN capture actions!
            this._addAction({
              type: 'newTab',
              url: newPageUrl,
              tabIndex: newPageIndex,
              timestamp: Date.now(),
              description: `New tab opened: ${newPageUrl.substring(0, 50)}`,
              isCrossOrigin: true // Flag for debugging
            });
            
            // ALSO try CDP capture as additional backup
            try {
              await this._setupCDPCaptureForPage(newPage, newPageIndex);
              console.log('[PlaywrightRecorder] CDP capture enabled as backup for cross-origin tab');
            } catch (cdpError) {
              console.log('[PlaywrightRecorder] CDP capture also failed:', cdpError.message);
              // That's OK - context.addInitScript + console listener should work
            }
          }
        } catch (e) {
          console.log('[PlaywrightRecorder] Could not setup new tab:', e.message);
        }
      }
    });
    
    // ============================================================
    // DETECT TAB FOCUS CHANGES (user switches between tabs)
    // This is critical for recording when user returns to parent tab
    // ============================================================
    this._setupTabFocusDetection();
    
    // Handle popup windows opened via window.open()
    // Note: This is in ADDITION to context.on('page') which handles all new pages
    this.page.on('popup', async (popup) => {
      const popupUrl = popup.url();
      console.log(`[PlaywrightRecorder] Popup window: ${popupUrl}`);
      
      // Wait for popup to load
      await popup.waitForLoadState('domcontentloaded', { timeout: 5000 }).catch(() => {});
      
      // Try to inject recorder into popup
      if (this.recording && !this._isRunningTest) {
        try {
          await popup.evaluate(this._getRecorderScript());
          await popup.evaluate(this._getClickCaptureScript());
          if (this.useRecipeRecorder) {
            await popup.evaluate(getRecipeClickCaptureScript());
          }
          console.log('[PlaywrightRecorder] Recorder injected into popup window');
        } catch (e) {
          console.log('[PlaywrightRecorder] Could not inject into popup (may be cross-origin):', e.message);
        }
      }
    });

    // Handle downloads
    this.page.on('download', async (download) => {
      const suggestedFilename = download.suggestedFilename();
      console.log(`[PlaywrightRecorder] Download started: ${suggestedFilename}`);
      
      if (this.recording && !this._isRunningTest) {
        this._addAction({
          type: 'download',
          filename: suggestedFilename,
          url: download.url(),
          timestamp: Date.now(),
          description: `Download: ${suggestedFilename}`
        });
      }
      
      // Let downloads proceed naturally - don't block
    });

    // Handle navigation
    this.page.on('framenavigated', async (frame) => {
      if (frame === this.page.mainFrame()) {
        const newUrl = frame.url();
        
        // CRITICAL: Only record navigations while actively recording, NOT during test runs!
        if (this.recording && !this._isRunningTest && this._shouldRecordNavigation(newUrl)) {
          this._addAction({
            type: 'navigate',
            url: newUrl,
            timestamp: Date.now(),
            description: `Navigate to ${new URL(newUrl).hostname}`
          });
        }
        
        // Re-inject recorder script after navigation (only if recording)
        if (this.recording && !this._isRunningTest) {
          try {
            await this.page.evaluate(this._getRecorderScript());
            await this._injectClickCaptureScript();
          } catch (e) {
            // Page might be navigating, ignore
          }
        }
        
        // Emit navigation event for auto-refresh suggestions
        this.emit('navigation', { url: newUrl });
      }
    });

    // ============================================================
    // CDP-BASED CLICK CAPTURE - WORKS WITH SHADOW DOM!
    // This is how Playwright's codegen and commercial tools work.
    // It captures clicks at the BROWSER level, not JavaScript level.
    // ============================================================
    await this._setupCDPClickCapture();

    console.log('[PlaywrightRecorder] Recording started');
    this.emit('started', { url });
    
    return { success: true };
  }
  
  /**
   * Setup CDP-based click capture for a page (works for cross-origin!)
   * Uses Chrome DevTools Protocol to capture clicks at browser level
   * @param {Page} page - Playwright page
   * @param {number} pageIndex - Index of the page
   */
  async _setupCDPCaptureForPage(page, pageIndex) {
    console.log(`[PlaywrightRecorder] Setting up CDP capture for page ${pageIndex}`);
    
    // Create CDP session for this page
    const cdpSession = await page.context().newCDPSession(page);
    
    // Enable DOM domain to get element info
    await cdpSession.send('DOM.enable');
    await cdpSession.send('Runtime.enable');
    
    // Track this CDP session
    if (!this._cdpSessions) this._cdpSessions = new Map();
    this._cdpSessions.set(pageIndex, cdpSession);
    
    // Listen for clicks using page events (Playwright captures these even cross-origin)
    page.on('click', async () => {
      // This doesn't exist in Playwright, but we can use other approaches
    });
    
    // Alternative: Poll for DOM changes and use Input coordinates
    // When user clicks, we can detect the focused element
    page.on('framenavigated', async (frame) => {
      if (frame === page.mainFrame()) {
        console.log(`[PlaywrightRecorder] Cross-origin page ${pageIndex} navigated:`, frame.url().substring(0, 50));
      }
    });
    
    // Use keyboard events to track interactions
    page.keyboard.on?.('keydown', () => {
      // Not available in Playwright
    });
    
    // WORKAROUND: Track page URL changes and focused elements via CDP
    cdpSession.on('DOM.documentUpdated', async () => {
      // Document was updated (navigation or dynamic content)
      console.log(`[PlaywrightRecorder] DOM updated in cross-origin tab ${pageIndex}`);
    });
    
    // The real trick: Use Runtime.evaluate with CDP (bypasses same-origin!)
    // CDP has higher privileges than page.evaluate()
    try {
      // Inject a minimal click listener via CDP Runtime.evaluate
      await cdpSession.send('Runtime.evaluate', {
        expression: `
          (function() {
            if (window.__flowstralCDPCapture) return;
            window.__flowstralCDPCapture = true;
            window.__flowstralCDPActions = [];
            
            // CRITICAL: Fix Salesforce text extraction issues
            // Salesforce sometimes renders text with missing characters (e.g., "Li t" instead of "List")
            function getCleanText(el) {
              if (!el) return '';
              
              // Priority 1: title attribute (most reliable)
              var title = el.getAttribute('title');
              if (title && title.length > 1 && title.length < 100) return title;
              
              // Priority 2: aria-label
              var ariaLabel = el.getAttribute('aria-label');
              if (ariaLabel && ariaLabel.length > 1 && ariaLabel.length < 100) return ariaLabel;
              
              // Priority 3: data-label (Salesforce-specific)
              var dataLabel = el.getAttribute('data-label');
              if (dataLabel && dataLabel.length > 1) return dataLabel;
              
              // Priority 4: Look for title/aria-label in child elements
              var childWithTitle = el.querySelector('[title]');
              if (childWithTitle) {
                var childTitle = childWithTitle.getAttribute('title');
                if (childTitle && childTitle.length > 1 && childTitle.length < 100) return childTitle;
              }
              
              // Priority 5: innerText (respects visibility) with cleanup
              var text = (el.innerText || el.textContent || '').trim();
              
              // Fix common Salesforce text issues:
              // Pattern: "Li t" should be "List", "U er" should be "User"
              // This happens when text is split across spans with hidden characters
              // First normalize all whitespace types (nbsp, thin space, etc.) to regular space
              // NOTE: Using \\s and \\b because this is inside a template literal string!
              text = text.replace(/[\\u00A0\\u2000-\\u200A\\u202F\\u205F\\u3000]/g, ' ');
              text = text
                .replace(/Li\\s+t\\b/g, 'List')
                .replace(/U\\s+er\\b/g, 'User')
                .replace(/Pa\\s+word\\b/g, 'Password')
                .replace(/Ca\\s+e\\b/g, 'Case')
                .replace(/Ta\\s+k\\b/g, 'Task')
                .replace(/A\\s+et\\b/g, 'Asset')
                .replace(/Campa\\s+gn\\b/g, 'Campaign')
                .replace(/Rec\\s+ently\\b/g, 'Recently')
                .replace(/View\\s+ed\\b/g, 'Viewed')
                .replace(/Act\\s+ive\\b/g, 'Active')
                .replace(/\\s{2,}/g, ' '); // Collapse multiple spaces
              
              return text.substring(0, 100);
            }
            
            document.addEventListener('click', function(e) {
              var target = e.target;
              var path = e.composedPath ? e.composedPath() : [target];
              var best = path[0];
              
              // Get element info with clean text extraction
              var info = {
                type: 'click',
                text: getCleanText(best),
                tag: best.tagName,
                id: best.id,
                className: best.className,
                href: best.href || best.getAttribute('href'),
                ariaLabel: best.getAttribute('aria-label'),
                title: best.getAttribute('title'),
                timestamp: Date.now(),
                tabIndex: ${pageIndex}
              };
              
              window.__flowstralCDPActions.push(info);
              console.log('__FLOWSTRAL_CDP_CLICK__:' + JSON.stringify(info));
            }, true);
            
            // Also capture inputs
            document.addEventListener('input', function(e) {
              var target = e.target;
              if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
                var info = {
                  type: 'input',
                  value: target.value,
                  name: target.name,
                  id: target.id,
                  placeholder: target.placeholder,
                  timestamp: Date.now(),
                  tabIndex: ${pageIndex}
                };
                window.__flowstralCDPActions.push(info);
              }
            }, true);
            
            console.log('[Flowstral] CDP capture injected into cross-origin tab');
          })();
        `,
        awaitPromise: false
      });
      
      console.log('[PlaywrightRecorder] CDP Runtime.evaluate succeeded for cross-origin tab!');
      
      // Set up console listener for this page too
      this._setupConsoleListenerForPage(page, pageIndex);
      
    } catch (evalError) {
      console.log('[PlaywrightRecorder] CDP Runtime.evaluate failed:', evalError.message);
      throw evalError;
    }
  }
  
  /**
   * Setup console listener for a page to capture recorded actions
   * CRITICAL: Must be called for EACH page (main + new tabs) to capture actions!
   * @param {Page} page - Playwright page to listen to
   * @param {number} pageIndex - Index of the page in our tracking array
   */
  _setupConsoleListenerForPage(page, pageIndex) {
    console.log(`[PlaywrightRecorder] Setting up console listener for page ${pageIndex}`);
    
    // Listen for special console messages to capture clicks/inputs
    page.on('console', (msg) => {
      const text = msg.text();
      
      // Check for click report (from same-origin JS injection)
      if (text.startsWith('__FLOWSTRAL_CLICK__:')) {
        try {
          const clickData = JSON.parse(text.substring('__FLOWSTRAL_CLICK__:'.length));
          console.log(`[PlaywrightRecorder] Click reported via console (tab ${pageIndex}):`, clickData.description);
          clickData.tabIndex = pageIndex;
          this.pendingClicks.push(clickData);
        } catch (e) {
          console.error('[PlaywrightRecorder] Failed to parse click data:', e.message);
        }
      }
      
      // Check for CDP click report (from cross-origin CDP injection)
      if (text.startsWith('__FLOWSTRAL_CDP_CLICK__:')) {
        try {
          const cdpClickData = JSON.parse(text.substring('__FLOWSTRAL_CDP_CLICK__:'.length));
          console.log(`[PlaywrightRecorder] 🌐 CROSS-ORIGIN CLICK captured (tab ${pageIndex}):`, cdpClickData.text?.substring(0, 30));
          
          // Convert CDP format to standard format
          const clickData = {
            type: 'click',
            text: cdpClickData.text,
            description: `Click "${cdpClickData.text?.substring(0, 50) || cdpClickData.tag}"`,
            element: {
              tagName: cdpClickData.tag,
              id: cdpClickData.id,
              className: cdpClickData.className,
              ariaLabel: cdpClickData.ariaLabel,
              href: cdpClickData.href
            },
            selectorObj: {
              text: cdpClickData.text,
              id: cdpClickData.id,
              ariaLabel: cdpClickData.ariaLabel,
              tag: cdpClickData.tag
            },
            tabIndex: pageIndex,
            timestamp: cdpClickData.timestamp,
            isCrossOrigin: true
          };
          
          this.pendingClicks.push(clickData);
        } catch (e) {
          console.error('[PlaywrightRecorder] Failed to parse CDP click data:', e.message);
        }
      }
      
      // Check for input report
      if (text.startsWith('__FLOWSTRAL_INPUT__:')) {
        try {
          const inputData = JSON.parse(text.substring('__FLOWSTRAL_INPUT__:'.length));
          console.log(`[PlaywrightRecorder] Input reported via console (tab ${pageIndex}):`, inputData.name || inputData.id);
          inputData.tabIndex = pageIndex;
          // FIX: Also match on tabIndex to prevent cross-tab overwrites.
          // Without this, an input in tab 1 with name="amount" would
          // overwrite an input in tab 0 with the same name.
          const existingIndex = this.pendingInputs.findIndex(i => 
            i.tabIndex === pageIndex && (
              (i.key && i.key === inputData.key) ||
              (i.name && i.name === inputData.name) ||
              (i.id && i.id === inputData.id)
            )
          );
          if (existingIndex !== -1) {
            this.pendingInputs[existingIndex] = inputData;
          } else {
            this.pendingInputs.push(inputData);
          }
        } catch (e) {
          console.error('[PlaywrightRecorder] Failed to parse input data:', e.message);
        }
      }
    });
    
    // Also listen for debug messages
    page.on('console', msg => {
      if (msg.text().includes('[Flowstral]') || msg.text().includes('[Recorder]')) {
        console.log(`[Page ${pageIndex}]`, msg.text());
      }
    });
  }
  
  /**
   * Get the click capture script as a string (for injection)
   */
  _getClickCaptureScript() {
    return getClickCaptureScript();
  }

  /**
   * Inject the click capture script into a page
   * @param {Page} targetPage - The page to inject into (defaults to this.page)
   */
  async _injectClickCaptureScript(targetPage = null) {
    const page = targetPage || this.page;
    if (!page || page.isClosed()) return;
    try {
      await page.evaluate(this._getClickCaptureScript());
      if (this.useRecipeRecorder) {
        await page.evaluate(getRecipeClickCaptureScript());
      }
    } catch (e) {
      // Page might be navigating or cross-origin
      console.log('[PlaywrightRecorder] Click capture injection skipped:', e.message);
    }
  }
  
  /**
   * Setup CDP (Chrome DevTools Protocol) based click capture.
   * Uses composedPath() which is the W3C standard for Shadow DOM.
   */
  async _setupCDPClickCapture() {
    if (!this.page) return;
    
    try {
      // Install click capture via addInitScript (runs before page loads)
      await this.page.addInitScript(this._getClickCaptureScript());
      
      // V2: Also inject recipe-based recorder for better element identification
      if (this.useRecipeRecorder) {
        await this.page.addInitScript(getRecipeClickCaptureScript());
        console.log('[PlaywrightRecorder] V2 Recipe recorder enabled');
      }
      
      // Also inject immediately into current page
      await this._injectClickCaptureScript();
      
      // V2: Also inject recipe recorder immediately
      if (this.useRecipeRecorder) {
        try {
          await this.page.evaluate(getRecipeClickCaptureScript());
        } catch (e) {
          // Page might be navigating
        }
      }
      
      // Poll for CDP clicks and inputs, add them to actions
      this._cdpClickInterval = setInterval(async () => {
        if (!this.recording || !this.page || this.page.isClosed()) return;
        
        // FIRST: Get pending data from MAIN PROCESS (works across subdomains!)
        // Get but DON'T clear yet - we'll clear after successful processing
        const mainProcessClicks = [...(this.pendingClicks || [])];
        const mainProcessInputs = [...(this.pendingInputs || [])];
        
        // ============================================================
        // CRITICAL: When Recipe recorder is enabled, DON'T process pendingClicks
        // here - Recipe captures the same clicks with better element info.
        // Only use pendingClicks as fallback for cross-origin pages where
        // page.evaluate fails (we'll process them after checking recipe actions)
        // ============================================================
        if (mainProcessClicks.length > 0 && !this.useRecipeRecorder) {
          console.log('[PlaywrightRecorder] Retrieved', mainProcessClicks.length, 'clicks from main process (non-recipe mode)');
          // Process main process clicks IMMEDIATELY (before page.evaluate which might fail)
          await this._processInputs(mainProcessInputs);
          for (const click of mainProcessClicks) {
            await this._processClick(click);
          }
          // NOW clear since we've processed them
          this.pendingClicks = [];
          this.pendingInputs = [];
        }
        
        // THEN: Poll ALL pages for clicks (not just current page)
        // This enables multi-tab recording!
        // FIX: Snapshot the array to prevent corruption if close handler
        // modifies _pages during this async iteration
        const allPages = [...(this._pages || [this.page])];
        
        for (let pageIndex = 0; pageIndex < allPages.length; pageIndex++) {
          const targetPage = allPages[pageIndex];
          if (!targetPage || targetPage.isClosed()) continue;
          
          try {
            const data = await targetPage.evaluate(() => {
              let clicks = window.__flowstralCDPClicks || [];
              window.__flowstralCDPClicks = [];
              
              // V2: Get recipe actions (new format)
              let recipeActions = window.__flowstralRecipeActions || [];
              window.__flowstralRecipeActions = [];
              
              // Process inputs - flush those that should be flushed, are stale, or have been around for 300ms
              const inputs = [];
              const now = Date.now();
              const pendingInputs = window.__flowstralCDPInputs || {};
              
              for (const key in pendingInputs) {
                const inp = pendingInputs[key];
                // More aggressive flushing:
                // 1. Explicitly marked for flush (focusout)
                // 2. Idle for 300ms (reduced from 500ms)
                // 3. Has substantial value (3+ chars) - likely user finished typing
                const hasSubstantialValue = inp.value && inp.value.length >= 3;
                const isStale = now - inp.timestamp > 300;
                
                if (inp.shouldFlush || (isStale && inp.value) || (hasSubstantialValue && isStale)) {
                  inputs.push(inp);
                  delete pendingInputs[key];
                }
              }
              
              return { clicks, inputs, recipeActions };
            });
            
            // If this is a different page than current, update context (but DON'T add switchTab)
            // Actions already have tabIndex which is used for implicit tab switching during playback
            if (data.clicks.length > 0 || data.recipeActions.length > 0) {
              if (pageIndex !== this._currentPageIndex) {
                console.log(`[PlaywrightRecorder] Action detected in tab ${pageIndex}, updating context (no SwitchTab needed)`);
                this._currentPageIndex = pageIndex;
                this.page = targetPage;
                // Update focus tracking
                this._lastDetectedFocusTab = pageIndex;
                this._focusDetectedAt = Date.now();
              }
            }
          
            // V2: Process recipe actions (these have better element info)
            if (this.useRecipeRecorder && data.recipeActions && data.recipeActions.length > 0) {
              for (const recipeAction of data.recipeActions) {
                // CRITICAL: Pass pageIndex for implicit tab switching during playback
                await this._processRecipeAction(recipeAction, pageIndex);
              }
              // Clear pendingClicks for this page - recipe click capture is reliable.
              // FIX: Filter per-tab instead of clearing all. Global clear loses
              // inputs from other tabs that haven't been processed yet.
              this.pendingClicks = (this.pendingClicks || []).filter(c => c.tabIndex !== pageIndex);
              
              // CRITICAL FIX: Only clear pendingInputs if recipe actually captured FILL
              // actions for this tab. If recipe only had clicks (fills still debouncing
              // at 1500ms), keep pendingInputs as a safety net. Without this, fills are
              // lost when: recipe captures click → pendingInputs cleared → page navigates
              // before recipe debounce fires → fill never captured.
              const recipeHadFills = data.recipeActions.some(a => a.type === 'fill');
              if (recipeHadFills) {
                this.pendingInputs = (this.pendingInputs || []).filter(i => i.tabIndex !== pageIndex);
              }
              
              // CRITICAL: When recipe had clicks but NO fills, process data.inputs as
              // safety net. The fills might still be debouncing in recipe (1500ms), but
              // the page-level CDP inputs (data.inputs) captured them immediately.
              // Without this, data.inputs is thrown away because the else-if below
              // only runs when recipe had NO actions at all.
              // _processInputs deduplicates by field key, so no risk of double recording.
              if (!recipeHadFills && data.inputs && data.inputs.length > 0) {
                const inputsWithTabIndex = data.inputs.map(inp => ({
                  ...inp,
                  tabIndex: inp.tabIndex !== undefined ? inp.tabIndex : pageIndex
                }));
                console.log(`[PlaywrightRecorder] Safety-net: processing ${inputsWithTabIndex.length} page-level inputs for tab ${pageIndex} (recipe had clicks but no fills)`);
                await this._processInputs(inputsWithTabIndex);
              }
            }
            
            // Process page data (inputs first, then clicks)
            // Tiered approach:
            //   - Recipe OFF: process all CDP inputs/clicks normally
            //   - Recipe ON + recipe had actions this cycle: handled above (fills safety net added)
            //   - Recipe ON + NO recipe actions this cycle: safety-net for stale pendingInputs
            //     and page-level data.inputs
            if (!this.useRecipeRecorder) {
              // Non-recipe mode: process CDP inputs normally
              const inputsWithTabIndex = (data.inputs || []).map(inp => ({
                ...inp,
                tabIndex: inp.tabIndex !== undefined ? inp.tabIndex : pageIndex
              }));
              await this._processInputs(inputsWithTabIndex);
              for (const click of data.clicks) {
                await this._processClick(click);
              }
            } else if (!data.recipeActions || data.recipeActions.length === 0) {
              // Recipe mode but no recipe actions this cycle.
              // TWO safety nets to catch fills that recipe missed:
              
              // Safety net 1: Process page-level CDP inputs (data.inputs) that were
              // flushed from window.__flowstralCDPInputs by page.evaluate().
              // These are thrown away every cycle in recipe mode unless we process them.
              // _processInputs deduplicates by field key, so no risk of double recording.
              if (data.inputs && data.inputs.length > 0) {
                const inputsWithTabIndex = data.inputs.map(inp => ({
                  ...inp,
                  tabIndex: inp.tabIndex !== undefined ? inp.tabIndex : pageIndex
                }));
                console.log(`[PlaywrightRecorder] Safety-net: processing ${inputsWithTabIndex.length} page-level inputs for tab ${pageIndex} (recipe had no actions)`);
                await this._processInputs(inputsWithTabIndex);
              }
              
              // Safety net 2: Process stale main-process pendingInputs (>2s old).
              // These come from __FLOWSTRAL_INPUT__ console messages.
              const now = Date.now();
              const staleInputs = (this.pendingInputs || []).filter(
                i => i.tabIndex === pageIndex && (now - (i.timestamp || 0)) > 2000
              );
              if (staleInputs.length > 0) {
                console.log(`[PlaywrightRecorder] Safety-net: processing ${staleInputs.length} stale inputs for tab ${pageIndex} (recipe missed them)`);
                await this._processInputs(staleInputs);
                // Remove only the stale ones we just processed
                this.pendingInputs = (this.pendingInputs || []).filter(
                  i => i.tabIndex !== pageIndex || (now - (i.timestamp || 0)) <= 2000
                );
              }
            }
          } catch (e) {
            // Page is cross-origin - page.evaluate failed.
            // Fall back to console-based capture (pendingClicks/pendingInputs).
            if (this.useRecipeRecorder) {
              const pageClicks = mainProcessClicks.filter(c => c.tabIndex === pageIndex);
              const pageInputs = mainProcessInputs.filter(i => i.tabIndex === pageIndex);
              
              // Process inputs even without clicks (fills-only interactions)
              if (pageInputs.length > 0) {
                console.log(`[PlaywrightRecorder] Cross-origin fallback: processing ${pageInputs.length} inputs for tab ${pageIndex}`);
                await this._processInputs(pageInputs);
              }
              if (pageClicks.length > 0) {
                console.log(`[PlaywrightRecorder] Cross-origin fallback: processing ${pageClicks.length} clicks for tab ${pageIndex}`);
                for (const click of pageClicks) {
                  await this._processClick(click);
                }
              }
              // Clear BOTH processed clicks AND inputs for this tab
              if (pageClicks.length > 0 || pageInputs.length > 0) {
                this.pendingClicks = (this.pendingClicks || []).filter(c => c.tabIndex !== pageIndex);
                this.pendingInputs = (this.pendingInputs || []).filter(i => i.tabIndex !== pageIndex);
              }
            }
          }
        } // End of page loop
      }, 100); // Check every 100ms for responsive capture
      
      console.log('[PlaywrightRecorder] CDP click capture enabled');
      
    } catch (error) {
      console.error('[PlaywrightRecorder] Failed to setup CDP click capture:', error.message);
      // Fall back to JS-based capture (already set up)
    }
  }

  /**
   * Flush any pending clicks and inputs for a specific tab.
   * Called BEFORE recording closeTab to ensure correct action ordering.
   * 
   * Without this, the sequence would be:
   *   closeTab → switchTab → [click actions from closed tab]
   * With this fix:
   *   [click actions] → [fill actions] → closeTab → switchTab
   */
  _flushPendingActionsForTab(tabIndex) {
    if (tabIndex < 0) return; // Guard: invalid tab index
    
    const tabClicks = (this.pendingClicks || []).filter(c => c.tabIndex === tabIndex);
    const tabInputs = (this.pendingInputs || []).filter(i => i.tabIndex === tabIndex);
    
    if (tabClicks.length === 0 && tabInputs.length === 0) return;
    
    console.log(`[PlaywrightRecorder] Flushing ${tabClicks.length} clicks, ${tabInputs.length} inputs for closing tab ${tabIndex}`);
    
    try {
      // Process inputs first (fills that happened in the closing tab)
      // NOTE: _processInputs and _processClick are async but execute synchronously
      // (no real awaits inside them), so this.actions.push() happens immediately.
      if (tabInputs.length > 0) {
        // Ensure tabIndex is set for proper tracking
        for (const input of tabInputs) {
          input.tabIndex = input.tabIndex !== undefined ? input.tabIndex : tabIndex;
        }
        this._processInputs(tabInputs);
      }
      
      // Process clicks
      for (const click of tabClicks) {
        this._processClick(click);
      }
    } catch (e) {
      console.error(`[PlaywrightRecorder] Error flushing actions for tab ${tabIndex}:`, e.message);
    }
    
    // Always remove flushed items from pending queues (even if processing errored)
    this.pendingClicks = (this.pendingClicks || []).filter(c => c.tabIndex !== tabIndex);
    this.pendingInputs = (this.pendingInputs || []).filter(i => i.tabIndex !== tabIndex);
  }

  /**
   * After a tab is removed (splice), adjust tabIndex in all pending data.
   * When tab N is removed, tabs N+1, N+2, ... shift down to N, N+1, ...
   * Without this, pending data references stale/wrong tab indices.
   */
  _adjustTabIndicesAfterClose(closedIndex) {
    if (this.pendingClicks) {
      for (const click of this.pendingClicks) {
        if (click.tabIndex > closedIndex) {
          click.tabIndex--;
        }
      }
    }
    if (this.pendingInputs) {
      for (const input of this.pendingInputs) {
        if (input.tabIndex > closedIndex) {
          input.tabIndex--;
        }
      }
    }
  }

  /**
   * Setup tab focus detection to capture when user switches between tabs
   * This polls to detect which tab has focus and records switchTab actions
   * Uses debouncing to avoid recording momentary focus changes
   */
  _setupTabFocusDetection() {
    // Track focus state for debouncing
    this._lastDetectedFocusTab = null;
    this._focusDetectedAt = 0;
    const FOCUS_DEBOUNCE_MS = 2500; // Must stay focused for 2.5s to record switch (increased to reduce noise)
    
    // Poll every 1000ms to detect tab focus changes (slower to reduce noise)
    this._tabFocusInterval = setInterval(async () => {
      if (!this.recording || this._isRunningTest || !this._pages || this._pages.length <= 1) {
        return;
      }
      
      try {
        // Find which page currently has focus
        for (let i = 0; i < this._pages.length; i++) {
          const page = this._pages[i];
          if (!page || page.isClosed()) continue;
          
          try {
            const hasFocus = await page.evaluate(() => document.hasFocus()).catch(() => false);
            
            if (hasFocus) {
              const now = Date.now();
              
              // If this is a NEW focus (different from what we detected before)
              if (this._lastDetectedFocusTab !== i) {
                this._lastDetectedFocusTab = i;
                this._focusDetectedAt = now;
                // Don't record yet - wait for debounce
                break;
              }
              
              // If same focus AND we've been focused long enough AND it's different from current
              if (i !== this._currentPageIndex && (now - this._focusDetectedAt) >= FOCUS_DEBOUNCE_MS) {
                // Check if RECENT actions (last 5) already came from or switched to this tab
                // This prevents duplicate switchTab - actions now include tabIndex
                // NOTE: After _toQWord(), actions have 'qword' not 'type', so check both
                const recentActions = this.actions.slice(-5);
                const alreadyHasActionFromTab = recentActions.some(a => 
                  (a.qword === 'SwitchTab' && a.tabIndex === i) ||
                  (a.type === 'switchTab' && a.tabIndex === i) ||  // Before _toQWord conversion
                  (a.tabIndex === i) // Any action from this tab is enough
                );
                
                if (alreadyHasActionFromTab) {
                  // Just update tracking without adding duplicate switchTab
                  // The action already indicates the tab context
                  console.log(`[PlaywrightRecorder] Skipping switchTab - recent action already from tab ${i}`);
                  this._currentPageIndex = i;
                  this.page = page;
                  break;
                }
                
                // CRITICAL: Suppress rapid back-and-forth tab switching (within 3 seconds)
                // This prevents confusing sequences like: switch to tab 0, switch to tab 1
                const recentSwitchTab = this.actions.filter(a => 
                  a.qword === 'SwitchTab' || a.type === 'switchTab'
                ).slice(-1)[0];
                
                if (recentSwitchTab && (now - (recentSwitchTab.timestamp || 0)) < 3000) {
                  // We just recorded a switchTab recently - suppress this one
                  // This prevents back-and-forth noise when user is working across tabs
                  console.log(`[PlaywrightRecorder] Skipping switchTab - recent switch ${now - recentSwitchTab.timestamp}ms ago`);
                  this._currentPageIndex = i;
                  this.page = page;
                  break;
                }
                
                // ============================================================
                // DISABLED: Don't record SwitchTab actions automatically
                // Actions already have tabIndex which is used for implicit tab switching
                // Recording SwitchTab just adds noise and confuses the test
                // ============================================================
                console.log(`[PlaywrightRecorder] Tab focus changed: ${this._currentPageIndex} → ${i} (NOT recording SwitchTab - using implicit tabIndex)`);
                
                // Just update tracking without adding switchTab action
                this._currentPageIndex = i;
                this.page = page;
                
                // Re-inject click capture if returning to same-origin page
                try {
                  await this._injectClickCaptureScript(page);
                } catch (e) {
                  // Cross-origin, can't inject
                }
              }
              
              break; // Only one tab can have focus
            }
          } catch (e) {
            // Page might be navigating or closed
          }
        }
      } catch (e) {
        // Ignore errors during focus detection
      }
    }, 1000); // Slower polling
  }

  /**
   * Check if an input looks like a honeypot/spam trap field
   */
  _isHoneypotField(inp) {
    const name = (inp.name || '').toLowerCase();
    const id = (inp.id || '').toLowerCase();
    
    // Common honeypot field name patterns
    const honeypotPatterns = [
      'honeypot', 'honey-pot', 'honey_pot',
      'spamfilter', 'spam-filter', 'spam_filter', 'spam',
      'bot', 'botcheck', 'bot-check', 'bot_check', 'botfield',
      'trap', 'spamtrap', 'spam-trap',
      'hp', 'hpfield', 'hp_field',
      'captcha_text', 'nocaptcha',
      'leave-blank', 'leave_blank', 'leaveblank'
    ];
    
    for (const pattern of honeypotPatterns) {
      if (name.includes(pattern) || id.includes(pattern)) {
        console.log('[PlaywrightRecorder] 🍯 Filtering honeypot field:', name || id);
        return true;
      }
    }
    
    return false;
  }

  /**
   * Process input (fill) actions from captured data
   * Called BEFORE click processing to ensure correct order
   */
  async _processInputs(inputs) {
    for (const inp of inputs) {
      if (!inp.value || inp.value.length === 0) continue;
      
      // HONEYPOT FILTER: Skip spam trap fields
      if (this._isHoneypotField(inp)) continue;
      
      // Find existing action for this field (by field key, NOT by value)
      const fieldKey = inp.key || `${inp.name || ''}|${inp.id || ''}|${inp.placeholder || ''}`;
      const existingIndex = this.actions.findIndex(a => {
        if (a.qword !== 'Fill') return false;
        const actionFieldKey = a.raw?.key || `${a.raw?.name || ''}|${a.raw?.id || ''}|${a.raw?.placeholder || ''}`;
        return actionFieldKey === fieldKey ||
               (a.raw?.name && a.raw.name === inp.name) ||
               (a.raw?.id && a.raw.id === inp.id);
      });
      
      // If we have an existing fill for this field, UPDATE it with longer value
      if (existingIndex !== -1) {
        const existing = this.actions[existingIndex];
        const existingValue = existing.args?.[1] || '';
        // Only update if new value is longer (user continued typing)
        if (inp.value.length > existingValue.length) {
          // Use associatedLabel if no other identifiers exist
          const label = inp.placeholder || inp.ariaLabel || inp.associatedLabel || inp.name || inp.title || inp.id || 'input';
          const isPassword = inp.type === 'password';
          const displayValue = isPassword ? '••••••••' : inp.value;
          
          console.log('[PlaywrightRecorder] Updating Fill value:', label, 'from', existingValue.length, 'to', inp.value.length, 'chars');
          
          existing.args = [label, inp.value];
          existing.description = `Fill "${label}": "${displayValue}"`;
          existing.displayArgs = [label, displayValue];
          existing.raw = inp;
          this.emit('action', existing);
        }
        continue; // Skip creating duplicate action
      }
      
      // Check if exact same fill already exists
      const exactDuplicate = this.actions.some(a => 
        a.qword === 'Fill' && a.args?.[1] === inp.value
      );
      if (exactDuplicate) continue;
      
      // Determine label - CRITICAL: Use associatedLabel if no other identifiers exist
      // This handles fields like "Account Number" that have a <label> element but no placeholder/aria-label
      const label = inp.placeholder || inp.ariaLabel || inp.associatedLabel || inp.name || inp.title || inp.id || 'input';
      const isPassword = inp.type === 'password';
      const displayValue = isPassword ? '••••••••' : inp.value;
      
      console.log('[PlaywrightRecorder] CDP Fill captured:', label, '=', displayValue.substring(0, 20), inp.fromShadow ? '(from Shadow DOM)' : '');
      
      // Store the tabIndex from the input - used for implicit tab switching during playback
      const inputTabIndex = inp.tabIndex !== undefined ? inp.tabIndex : 0;
      
      // Update current tab tracking (so tab focus detection doesn't add redundant switchTab)
      if (inputTabIndex !== this._currentPageIndex && this._pages && this._pages[inputTabIndex]) {
        console.log(`[PlaywrightRecorder] Fill action from tab ${inputTabIndex}, updating current page index`);
        this._currentPageIndex = inputTabIndex;
        this.page = this._pages[inputTabIndex];
        this._lastDetectedFocusTab = inputTabIndex;
        this._focusDetectedAt = Date.now();
      }
      
      const action = {
        id: `cdp_fill_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        qword: 'Fill',
        args: [label, inp.value],
        description: `Fill "${label}": "${displayValue}"`,
        displayArgs: [label, displayValue],
        selectorObj: {
          // HIGHEST PRIORITY: data-testid for stable selectors
          testId: inp.testId || inp.dataTestId,
          dataTestId: inp.dataTestId || inp.testId,
          dataTest: inp.dataTest,
          dataCy: inp.dataCy,
          // Standard attributes
          tag: 'input',
          id: inp.id,
          name: inp.name,
          placeholder: inp.placeholder,
          ariaLabel: inp.ariaLabel,
          title: inp.title
        },
        raw: inp,
        timestamp: inp.timestamp,
        fromCDP: true,
        fromShadow: inp.fromShadow,
        isSensitive: isPassword,
        // CRITICAL: Store tabIndex for implicit tab switching during playback
        tabIndex: inputTabIndex
      };
      
      this._insertByTimestamp(action);
      this.emit('action', action);
    }
  }

  /**
   * V2: Process a recipe-based action (new format with ElementRecipe)
   * This provides better element identification for modern frameworks
   * 
   * DEDUPLICATION STRATEGY:
   * 1. Recipe actions take priority over CDP actions (better element identification)
   * 2. When Recipe records an action, mark it so CDP won't double-record
   * 3. Use both timestamp-based and text-based deduplication
   * 
   * @param {object} recipeAction - The recipe action to process
   * @param {number} pageIndex - The page/tab index this action was captured from
   */
  async _processRecipeAction(recipeAction, pageIndex = 0) {
    const { type, target, value, description, timestamp } = recipeAction;
    
    // CRITICAL: Mark that an interaction is happening RIGHT NOW
    // This suppresses navigation events that fire before the action is fully processed
    if (['click', 'fill', 'select', 'check', 'uncheck', 'dblclick', 'rightClick'].includes(type)) {
      this._lastInteractionTimestamp = Date.now();
    }
    
    // FILTER: Skip misidentified page title clicks
    // Recipe recorder sometimes misidentifies tab clicks as page title clicks
    const descText = description || target?.what?.text || '';
    if (descText.includes('Flowstral Test Playground') || 
        descText.includes('🧪') ||
        (descText.includes('Shopping Cart') && type === 'click' && !descText.includes('tab'))) {
      console.log('[PlaywrightRecorder] Skipping misidentified page title (recipe):', descText);
      return;
    }
    
    // FILTER: Skip modal header/title clicks
    // These are phantom clicks when user interacts with modal content, click bubbles to header.
    // Common patterns: "New [ObjectType]", "Edit [ObjectType]", "Create [ObjectType]"
    // Modal titles have role=heading in the recipe or landmark=dialog
    const whatRole = target?.what?.role || '';
    const whereLandmark = target?.where?.landmark || '';
    const elementText = target?.what?.text || '';
    
    // Detect Salesforce modal title patterns: "New Opportunity", "Edit Contact", "Create Campaign", etc.
    const sfModalTitlePatterns = [
      /^New\s+[A-Z][a-zA-Z]+$/,           // "New Opportunity", "New Contact"
      /^Edit\s+[A-Z][a-zA-Z]+$/,           // "Edit Opportunity", "Edit Contact"
      /^Create\s+[A-Z][a-zA-Z]+$/,         // "Create Campaign"
      /^Clone\s+[A-Z][a-zA-Z]+$/,          // "Clone Opportunity"
      /^Log\s+a\s+Call$/i,                 // "Log a Call"
      /^Send\s+an\s+Email$/i,              // "Send an Email"
    ];
    
    const isSfModalTitle = sfModalTitlePatterns.some(p => p.test(elementText));
    
    // Also check: if it's a heading inside a dialog/modal, skip it
    const isHeadingInDialog = (whatRole === 'heading' && 
                               (whereLandmark === 'dialog' || whereLandmark === 'complementary'));
    
    if (type === 'click' && (isSfModalTitle || isHeadingInDialog)) {
      console.log('[PlaywrightRecorder] Skipping modal title click (recipe):', elementText, 
                  '| role:', whatRole, '| landmark:', whereLandmark);
      return;
    }
    
    // Normalize the element text for consistent deduplication
    // Note: elementText is already declared above when checking modal patterns
    const normalizedText = this._normalizeClickText(elementText);
    
    // Generate multiple IDs to prevent BOTH Recipe and CDP from recording same action
    const roundedTimestamp = Math.floor(timestamp / 50) * 50;
    const actionId = `recipe_${roundedTimestamp}_${type}_${normalizedText}`;
    
    // CRITICAL: Also add CDP-style ID to prevent CDP from recording same action
    // This ensures cross-system deduplication works
    const cdpStyleId = `cdp_${roundedTimestamp}_Click "${elementText}"`;
    
    if (this.seenActionIds.has(actionId)) {
      console.log('[PlaywrightRecorder] Skipping duplicate recipe action (same 50ms window):', type, elementText);
      return;
    }
    
    // Mark both IDs as seen to prevent double-recording by CDP
    this.seenActionIds.add(actionId);
    this.seenActionIds.add(cdpStyleId);
    
    // Also mark nearby timestamps (±100ms) to catch timing variations
    const nearbyTimestamps = [roundedTimestamp - 50, roundedTimestamp + 50];
    for (const ts of nearbyTimestamps) {
      this.seenActionIds.add(`cdp_${ts}_Click "${elementText}"`);
      this.seenActionIds.add(`cdp_${ts}_${normalizedText}`);
    }
    
    // Store the raw recipe action
    this.recipeActions.push(recipeAction);
    
    // Convert to legacy format for backward compatibility with existing UI
    const legacyAction = recipeActionToLegacy(recipeAction);
    legacyAction.id = actionId;
    legacyAction.fromRecipe = true; // Mark as v2 recipe-based
    legacyAction.tabIndex = pageIndex; // CRITICAL: Track which tab for implicit switching during playback
    
    console.log('[PlaywrightRecorder] Recipe action:', type, description || elementText, `(tab ${pageIndex})`);
    
    // Check for duplicates in existing actions using normalized text comparison
    // Extended window to 1000ms to catch more duplicates
    const isDuplicate = this.actions.some(a => {
      // Same type and similar description within 1000ms (extended from 500ms)
      if (a.qword === legacyAction.qword && 
          Math.abs((a.timestamp || 0) - timestamp) < 1000) {
        // Check if it's the same element (using normalized text)
        const aText = a.args?.[0] || a.text || '';
        const normalizedAText = this._normalizeClickText(aText);
        return normalizedAText === normalizedText;
      }
      return false;
    });
    
    if (isDuplicate) {
      console.log('[PlaywrightRecorder] Skipping duplicate recipe action (normalized match):', elementText);
      return;
    }
    
    // ========== CONFIDENCE CALCULATION ==========
    // Calculate confidence score for this step based on element identification quality
    try {
      const recipe = target || {};
      const matchAnalysis = {
        totalMatches: recipe.which?.totalMatching || 1,
        usedPosition: recipe.which?.position || 1
      };
      
      const confidence = this.confidenceCalculator.calculate(recipe, matchAnalysis, {});
      
      // Add confidence data to the action
      legacyAction.confidence = confidence;
      legacyAction.matchAnalysis = matchAnalysis;
      
      // Log warning for low confidence
      if (confidence.level === 'LOW') {
        console.log(`[PlaywrightRecorder] ⚠️ LOW confidence (${confidence.score}%) for: ${description || elementText}`);
        console.log(`  Reasons: ${confidence.deductions?.join(', ') || 'Multiple matches or position-based selection'}`);
      } else if (confidence.level === 'MEDIUM') {
        console.log(`[PlaywrightRecorder] ℹ️ MEDIUM confidence (${confidence.score}%) for: ${description || elementText}`);
      }
    } catch (confError) {
      console.log('[PlaywrightRecorder] Confidence calculation error (non-critical):', confError.message);
      // Continue without confidence data if calculation fails
    }
    
    this._insertByTimestamp(legacyAction);
    this.emit('action', legacyAction);
  }

  /**
   * Normalize click text for deduplication - handles "Account Number" vs "Account Number *" vs "Account Number "
   */
  _normalizeClickText(text) {
    if (!text || typeof text !== 'string') return '';
    return text
      .replace(/[\u2018\u2019\u201B\u2032\u0060\u00B4\u02BC]/g, "'")  // Apostrophe variants
      .replace(/[\u201C\u201D\u201E\u201F\u2033]/g, '"')               // Quote variants
      .replace(/\s*\*+\s*$/g, '')                                      // Remove trailing asterisks (required field markers)
      .replace(/\s+/g, ' ')                                            // Collapse whitespace
      .trim();
  }

  /**
   * Process a single click action (CDP-based)
   * 
   * NOTE: Recipe recording takes priority over CDP for element identification.
   * If Recipe already recorded this action, we skip CDP recording.
   */
  async _processClick(click) {
    // CRITICAL: Mark that an interaction is happening RIGHT NOW
    // This suppresses navigation events that fire before the click is fully processed
    this._lastInteractionTimestamp = Date.now();
    
    // Normalize description for deduplication - handles variations like "Account Number" vs "Account Number *"
    const normalizedDesc = this._normalizeClickText(click.description);
    
    // Extract the element text from description for cross-system matching
    const textMatch = click.description?.match(/Click "([^"]+)"/);
    const elementText = textMatch ? textMatch[1] : (click.text || '');
    const normalizedElementText = this._normalizeClickText(elementText);
    
    // Deduplicate - use rounded timestamp (50ms window) AND normalized description
    const roundedTimestamp = Math.floor(click.timestamp / 50) * 50;
    const clickId = `cdp_${roundedTimestamp}_${normalizedDesc}`;
    
    // CRITICAL: Check if Recipe already recorded this action (cross-system deduplication)
    // Recipe adds both recipe_ and cdp_ style IDs to prevent double-recording
    if (this.seenActionIds.has(clickId)) {
      console.log('[PlaywrightRecorder] Skipping duplicate click (same 50ms window):', click.description);
      return;
    }
    
    // Also check for Recipe-style IDs (different timestamp windows)
    const nearbyTimestamps = [roundedTimestamp - 50, roundedTimestamp, roundedTimestamp + 50];
    for (const ts of nearbyTimestamps) {
      const recipeStyleId = `recipe_${ts}_click_${normalizedElementText}`;
      if (this.seenActionIds.has(recipeStyleId)) {
        console.log('[PlaywrightRecorder] Skipping CDP click - Recipe already captured:', click.description);
        return;
      }
    }
    
    this.seenActionIds.add(clickId);
    
    // Also check recent actions for same normalized text (within 1000ms) - extended from 500ms
    const lastActions = this.actions.slice(-5); // Check more recent actions
    for (const lastAction of lastActions) {
      const lastNormalizedDesc = this._normalizeClickText(lastAction.description);
      const lastText = this._normalizeClickText(lastAction.args?.[0] || lastAction.text || '');
      const timeDiff = Math.abs((lastAction.timestamp || 0) - click.timestamp);
      
      // Check both description and element text matches
      const textMatches = lastNormalizedDesc === normalizedDesc || lastText === normalizedElementText;
      
      if (textMatches && timeDiff < 1000 && (lastAction.qword === 'ClickText' || lastAction.type === 'click')) {
        console.log('[PlaywrightRecorder] Skipping variant duplicate click:', click.description, 'matches', lastAction.description || lastAction.text);
        return;
      }
    }
    
    // Only skip TRUE double-clicks: same element clicked twice within 200ms
    // This is very conservative to avoid filtering legitimate repeated clicks
    const lastAction = this.actions[this.actions.length - 1];
    if (lastAction && 
        lastAction.description === click.description && 
        lastAction.qword === 'ClickText' &&
        Math.abs((lastAction.timestamp || 0) - click.timestamp) < 200) {
      // This is a true double-click - skip it
      console.log('[PlaywrightRecorder] Skipping double-click:', click.description);
      return;
    }
    
    // Skip phantom/bad clicks
    const desc = click.description || '';
    if (!desc || desc === 'Click ""' || desc === 'Click "div"' || desc === 'Click "span"') {
      return;
    }
    
    // Skip clicks with concatenated text patterns (form step containers)
    // Pattern: lowercase immediately followed by uppercase like "registrationIt's"
    const concatenatedPattern = /[a-z][A-Z]/;
    const clickText = click.text || '';
    if (click.tag === 'div' && !click.role && concatenatedPattern.test(clickText)) {
      console.log('[PlaywrightRecorder] Skipping concatenated container click:', desc);
      return;
    }
    
    console.log('[PlaywrightRecorder] CDP Click captured:', click.description, click.fromShadow ? '(from Shadow DOM)' : '', click.isSubmit ? '(SUBMIT)' : '');
    
    // Extract best label for args - use text, title, ariaLabel, or extract from description
    let clickLabel = click.text || click.title || click.ariaLabel || click.name || click.id;
    // If still no label, try to extract from description (format: 'Click "Label"')
    if (!clickLabel && click.description) {
      const match = click.description.match(/Click "([^"]+)"/);
      if (match) clickLabel = match[1];
    }
    if (!clickLabel) clickLabel = 'element';
    
    // Include element index info for duplicate elements
    const hasMultipleMatching = click.totalMatching && click.totalMatching > 1;
    const elementIndex = click.elementIndex || 0;
    
    // Store the tabIndex from the click - used for implicit tab switching during playback
    // This REPLACES the need for separate switchTab actions
    const clickTabIndex = click.tabIndex !== undefined ? click.tabIndex : 0;
    
    // Update current tab tracking (so tab focus detection doesn't add redundant switchTab)
    if (clickTabIndex !== this._currentPageIndex && this._pages && this._pages[clickTabIndex]) {
      console.log(`[PlaywrightRecorder] Action from tab ${clickTabIndex}, updating current page index`);
      this._currentPageIndex = clickTabIndex;
      this.page = this._pages[clickTabIndex];
      this._lastDetectedFocusTab = clickTabIndex; // Prevent focus detection from adding duplicate
      this._focusDetectedAt = Date.now(); // Reset debounce timer
    }
    
    const action = {
      id: `cdp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      qword: 'ClickText',
      args: hasMultipleMatching ? [clickLabel, elementIndex] : [clickLabel],
      description: hasMultipleMatching 
        ? `${click.description} (${this._ordinal(elementIndex + 1)} of ${click.totalMatching})`
        : click.description,
      selectorObj: {
        // Highest priority selectors
        testId: click.testId || click.dataTestId,       // data-testid
        dataTestId: click.dataTestId || click.testId,   // alias
        dataTest: click.dataTest,                        // data-test
        // Standard attributes
        tag: click.tag,
        id: click.id,
        name: click.name,
        title: click.title,
        ariaLabel: click.ariaLabel,
        placeholder: click.placeholder,
        role: click.role,
        // Additional useful info
        text: clickLabel,                                // Store the text
        selector: click.selector,                        // CSS selector if available
        playwright: click.playwright,                    // Playwright selector if available
        // Fallbacks from recording
        fallbacks: click.fallbacks || [],
      },
      raw: click,
      timestamp: click.timestamp,
      fromCDP: true,
      fromShadow: click.fromShadow,
      isSubmit: click.isSubmit,
      elementIndex: hasMultipleMatching ? elementIndex : undefined,
      totalMatching: hasMultipleMatching ? click.totalMatching : undefined,
      // CRITICAL: Store tabIndex for implicit tab switching during playback
      // This REPLACES the need for separate switchTab actions!
      tabIndex: clickTabIndex
    };
    
    if (hasMultipleMatching) {
      console.log('[PlaywrightRecorder] Click has multiple matches:', clickLabel, 'index:', elementIndex, 'of', click.totalMatching);
    }
    
    // Use timestamp-based insertion for ALL clicks (not just submit)
    // This ensures clicks from different capture paths maintain correct ordering
    this._insertByTimestamp(action);
    this.emit('action', action);
  }

  /**
   * Convert number to ordinal string (1 -> "1st", 2 -> "2nd", etc.)
   */
  _ordinal(n) {
    const s = ['th', 'st', 'nd', 'rd'];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  }

  /**
   * Run test - executes steps in the EXISTING browser context (or launches new one)
   * This avoids the "browser already running" conflict
   * (Delegated to recorder-run-test.js)
   */
  async runTest(options = {}) {
    const { runTest: _runTest } = require('./recorder-run-test');
    return _runTest(this, options);
  }
  
  // ============================================================================
  // FAILURE REPAIR METHODS - Help users fix failed steps
  // ============================================================================
  
  /**
   * Get the last failure state for the B+C Hybrid Editor
   */
  getLastFailureState() {
    return this._lastFailureState || null;
  }
  
  /**
   * OPTION C: Find similar elements on the page for Visual Selector Cards
   * When a step fails, find elements that might be what the user wanted
   * @param {Object} failedStep - The step that failed
   * @returns {Array} Array of similar elements with id, text, selector, type
   */
  async _findSimilarElements(failedStep) {
    if (!this.page || this.page.isClosed()) return [];
    
    try {
      const stepType = failedStep?.type || failedStep?.qword || 'click';
      const targetText = failedStep?.text || failedStep?.label || '';
      const recipe = failedStep?.recipe;
      
      // Determine what type of elements to look for
      let elementType = 'any';
      if (recipe?.what?.role) {
        elementType = recipe.what.role;
      } else if (stepType.toLowerCase().includes('check')) {
        elementType = 'checkbox';
      } else if (stepType.toLowerCase().includes('fill') || stepType.toLowerCase().includes('type')) {
        elementType = 'textbox';
      } else if (stepType.toLowerCase().includes('select')) {
        elementType = 'combobox';
      }
      
      console.log(`[PlaywrightRecorder] Finding similar elements: type=${elementType}, text="${targetText}"`);
      
      // Find similar elements in the page
      const similarElements = await this.page.evaluate(({ elementType, targetText }) => {
        const results = [];
        const seenTexts = new Set();
        
        // Helper to get clean text
        const getCleanText = (el) => {
          // For inputs/checkboxes, try to find associated label
          if (el.type === 'checkbox' || el.type === 'radio') {
            // Check for label wrapping the input
            const parentLabel = el.closest('label');
            if (parentLabel) {
              return parentLabel.textContent?.trim() || '';
            }
            // Check for label with for attribute
            if (el.id) {
              const label = document.querySelector(`label[for="${el.id}"]`);
              if (label) return label.textContent?.trim() || '';
            }
            // Check for aria-label
            if (el.getAttribute('aria-label')) {
              return el.getAttribute('aria-label');
            }
            // Check for nearby text
            const nextText = el.nextSibling?.textContent?.trim() || 
                            el.nextElementSibling?.textContent?.trim() || '';
            if (nextText) return nextText;
          }
          return el.textContent?.trim() || el.getAttribute('aria-label') || '';
        };
        
        // Helper to build a selector
        const buildSelector = (el) => {
          if (el.id) return `#${el.id}`;
          if (el.getAttribute('data-testid')) return `[data-testid="${el.getAttribute('data-testid')}"]`;
          if (el.name) return `[name="${el.name}"]`;
          // Fall back to a more specific selector
          const tag = el.tagName.toLowerCase();
          const type = el.type ? `[type="${el.type}"]` : '';
          return `${tag}${type}`;
        };
        
        // Find elements based on type
        let elements = [];
        switch (elementType) {
          case 'checkbox':
            elements = document.querySelectorAll('input[type="checkbox"]');
            break;
          case 'radio':
            elements = document.querySelectorAll('input[type="radio"]');
            break;
          case 'textbox':
            elements = document.querySelectorAll('input[type="text"], input[type="email"], input[type="password"], textarea');
            break;
          case 'combobox':
            elements = document.querySelectorAll('select, [role="combobox"], [role="listbox"]');
            break;
          case 'button':
            elements = document.querySelectorAll('button, [role="button"], input[type="submit"], input[type="button"]');
            break;
          case 'link':
            elements = document.querySelectorAll('a[href]');
            break;
          default:
            // For 'any' or unknown, look for interactive elements near the viewport
            elements = document.querySelectorAll('button, a, input, select, [role="button"], [role="checkbox"], [role="link"], [onclick]');
        }
        
        // Convert to array and filter visible elements
        Array.from(elements).forEach((el, index) => {
          if (results.length >= 8) return; // Max 8 suggestions
          
          // Skip hidden elements
          const rect = el.getBoundingClientRect();
          if (rect.width === 0 || rect.height === 0) return;
          const style = window.getComputedStyle(el);
          if (style.display === 'none' || style.visibility === 'hidden') return;
          
          const text = getCleanText(el);
          if (!text || text.length > 50) return; // Skip empty or very long text
          if (seenTexts.has(text.toLowerCase())) return; // Skip duplicates
          seenTexts.add(text.toLowerCase());
          
          results.push({
            id: `similar-${index}`,
            text: text,
            selector: buildSelector(el),
            type: elementType !== 'any' ? elementType : (el.tagName.toLowerCase() === 'input' ? el.type : el.tagName.toLowerCase()),
            // Score by text similarity to target
            score: targetText ? (text.toLowerCase().includes(targetText.toLowerCase()) ? 2 : 0) : 1
          });
        });
        
        // Sort by score (most relevant first)
        results.sort((a, b) => b.score - a.score);
        
        return results.slice(0, 6); // Return top 6
      }, { elementType, targetText });
      
      return similarElements;
    } catch (e) {
      console.error('[PlaywrightRecorder] Error finding similar elements:', e.message);
      return [];
    }
  }
  
  /**
   * Re-open browser to the failed state (navigates to the URL where failure occurred)
   * Used when browser was closed but user wants to debug
   */
  async reopenToFailedState() {
    const failureState = this._lastFailureState;
    if (!failureState) {
      return { success: false, error: 'No failure state saved' };
    }
    
    console.log('[PlaywrightRecorder] Re-opening browser to failed state...');
    console.log('[PlaywrightRecorder] Failure URL:', failureState.url);
    
    try {
      // Launch browser if needed
      if (!this.page || this.page.isClosed()) {
        const { app } = require('electron');
        const path = require('path');
        const userDataDir = path.join(app.getPath('userData'), 'playwright-browser-data');
        
        // Use fallback helper for system Chrome/Edge when Playwright browsers not bundled
        this.context = await launchBrowserWithFallback({
          headless: false,
          args: ['--start-maximized', '--disable-blink-features=AutomationControlled'],
          ignoreHTTPSErrors: false,
        }, userDataDir);

        const pages = this.context.pages();
        this.page = pages.length > 0 ? pages[0] : await this.context.newPage();
      }
      
      // Navigate to the failure URL
      if (failureState.url) {
        await this.page.goto(failureState.url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      }
      
      // Re-play steps up to (but not including) the failed step to restore state
      if (failureState.passedSteps > 0 && failureState.allSteps) {
        console.log(`[PlaywrightRecorder] Re-playing ${failureState.passedSteps} passed steps to restore state...`);
        for (let i = 0; i < failureState.passedSteps; i++) {
          const step = failureState.allSteps[i];
          try {
            // Convert and execute step (simplified - navigate/click/fill)
            await this._executeStepInternal(step, 15000);
            console.log(`[PlaywrightRecorder] Restored step ${i + 1}/${failureState.passedSteps}`);
          } catch (e) {
            console.warn(`[PlaywrightRecorder] Could not restore step ${i + 1}: ${e.message}`);
            // Continue anyway - best effort restoration
          }
        }
      }
      
      this._keepBrowserOpenOnFailure = true; // Keep it open for debugging
      
      return { 
        success: true, 
        url: this.page.url(),
        failedStep: failureState.stepIndex,
        step: failureState.step
      };
    } catch (error) {
      console.error('[PlaywrightRecorder] Failed to reopen to failed state:', error.message);
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Retry just the failed step with an updated action
   * Used after user edits the step in ElementRepairWizard
   */
  async retryFailedStep(updatedAction) {
    const failureState = this._lastFailureState;
    if (!failureState) {
      return { success: false, error: 'No failure state saved' };
    }
    
    if (!this.page || this.page.isClosed()) {
      return { success: false, error: 'Browser not open. Use "Re-open Browser" first.' };
    }
    
    console.log('[PlaywrightRecorder] Retrying failed step with updated action...');
    console.log('[PlaywrightRecorder] Updated action:', JSON.stringify(sanitizeForLog(updatedAction)));
    
    try {
      // Merge updated action with original step
      const mergedAction = {
        ...failureState.step,
        ...updatedAction,
        // Override specific fields if provided
        manualSelector: updatedAction.manualSelector || failureState.step.manualSelector,
        manualText: updatedAction.manualText || failureState.step.manualText,
      };
      
      const result = await this.executeAction(mergedAction);
      
      if (result.success) {
        console.log('[PlaywrightRecorder] ✅ Step retry SUCCEEDED!');
        // Clear failure state on success
        this._lastFailureState = null;
        return { success: true, message: 'Step executed successfully!' };
      } else {
        console.log('[PlaywrightRecorder] ❌ Step retry FAILED:', result.error);
        return { success: false, error: result.error };
      }
    } catch (error) {
      console.error('[PlaywrightRecorder] Step retry error:', error.message);
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Record a replacement action for the failed step
   * Starts element picker mode and returns when user picks an element
   */
  async recordReplacementAction() {
    const failureState = this._lastFailureState;
    if (!failureState) {
      return { success: false, error: 'No failure state saved' };
    }
    
    if (!this.page || this.page.isClosed()) {
      return { success: false, error: 'Browser not open. Use "Re-open Browser" first.' };
    }
    
    console.log('[PlaywrightRecorder] Starting element picker for replacement action...');
    console.log('[PlaywrightRecorder] Original action type:', failureState.step.type || failureState.step.qword);
    
    // Return info about what we need - the actual picking is handled by elementPicker
    return {
      success: true,
      message: 'Click on the correct element in the browser',
      originalAction: failureState.step,
      stepIndex: failureState.stepIndex
    };
  }
  
  /**
   * Resume test execution from the failed step (after fixing)
   */
  async resumeFromFailedStep(options = {}) {
    const failureState = this._lastFailureState;
    if (!failureState) {
      return { success: false, error: 'No failure state saved' };
    }
    
    if (!this.page || this.page.isClosed()) {
      return { success: false, error: 'Browser not open. Use "Re-open Browser" first.' };
    }
    
    const { updatedSteps, skipFailedStep = false } = options;
    const steps = updatedSteps || failureState.allSteps;
    const startIndex = skipFailedStep ? failureState.stepIndex + 1 : failureState.stepIndex;
    
    console.log(`[PlaywrightRecorder] Resuming from step ${startIndex + 1}/${steps.length}`);
    
    let passedSteps = failureState.passedSteps;
    let failedStep = -1;
    let failError = '';
    
    try {
      for (let i = startIndex; i < steps.length; i++) {
        const step = steps[i];
        console.log(`[PlaywrightRecorder] Resume: Step ${i + 1}: ${step.description || step.qword}`);
        
        this.emit('test-step-start', { stepIndex: i, step });
        
        try {
          await this._executeStepInternal(step, 30000);
          passedSteps++;
          this.emit('test-step-complete', { stepIndex: i, success: true });
          await this.page.waitForTimeout(300); // Conservative delay for resume recovery
        } catch (stepError) {
          console.error(`[PlaywrightRecorder] Resume: Step ${i + 1} failed:`, stepError.message);
          failedStep = i;
          failError = stepError.message;
          
          // Capture new failure state
          let screenshot = null;
          try {
            const buf = await this.page.screenshot();
            screenshot = `data:image/png;base64,${buf.toString('base64')}`;
          } catch (e) {}
          
          this._lastFailureState = {
            stepIndex: failedStep,
            step: steps[failedStep],
            error: failError,
            screenshot,
            url: this.page.url(),
            timestamp: Date.now(),
            allSteps: steps,
            passedSteps
          };
          
          this.emit('test-step-complete', { stepIndex: i, success: false, error: failError, screenshot });
          break;
        }
      }
      
      const success = failedStep === -1;
      console.log(`[PlaywrightRecorder] Resume complete: ${success ? 'PASSED' : 'FAILED'}`);
      
      return {
        success,
        passedSteps,
        failedStep,
        totalSteps: steps.length,
        error: failError || undefined
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Close browser manually (when user is done debugging)
   */
  async closeBrowser() {
    console.log('[PlaywrightRecorder] Manually closing browser...');
    try {
      if (this.context) {
        await this.context.close().catch(() => {});
      }
      this.page = null;
      this.context = null;
      this.browser = null;
      this._keepBrowserOpenOnFailure = false;
      console.log('[PlaywrightRecorder] Browser closed manually');
      return { success: true };
    } catch (e) {
      console.error('[PlaywrightRecorder] Error closing browser:', e.message);
      return { success: false, error: e.message };
    }
  }

  // ============================================================================
  // DEBUG MODE METHODS
  // ============================================================================

  /**
   * Run test in debug mode - supports pause/resume/step-by-step
   */
  async runTestDebug(options = {}) {
    const { url, steps, headless = false, timeout = 30000, stepByStep = false } = options;
    
    console.log('[PlaywrightRecorder] Running test in DEBUG MODE with', steps?.length || 0, 'steps');
    
    this._isRunningTest = true;
    this._debugMode = true;
    this._stepByStep = stepByStep;
    this._stopRequested = false;
    this._testPaused = false;
    this._pausedAtStep = -1;
    this._currentTestSteps = steps || [];
    
    const stepResults = steps.map((_, idx) => ({
      index: idx,
      status: 'pending',
    }));
    
    try {
      // Launch browser if needed
      let needsNewBrowser = !this.page || this.page.isClosed();
      
      if (needsNewBrowser) {
        console.log('[PlaywrightRecorder] Launching browser for debug mode...');
        const { app } = require('electron');
        const path = require('path');
        const userDataDir = path.join(app.getPath('userData'), 'playwright-browser-data');
        
        // Get mobile emulation options (backward compatible)
        const mobileOptions = this.getMobileContextOptions();
        const isMobile = this.isInMobileMode();
        
        // Use fallback helper for system Chrome/Edge when Playwright browsers not bundled
        this.context = await launchBrowserWithFallback({
          headless,
          viewport: isMobile ? mobileOptions.viewport : null,
          args: ['--start-maximized', '--disable-blink-features=AutomationControlled'],
          userAgent: isMobile ? mobileOptions.userAgent : 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          ...(isMobile && {
            deviceScaleFactor: mobileOptions.deviceScaleFactor,
            isMobile: mobileOptions.isMobile,
            hasTouch: mobileOptions.hasTouch
          }),
          ignoreHTTPSErrors: false,
        }, userDataDir);
        
        const pages = this.context.pages();
        this.page = pages.length > 0 ? pages[0] : await this.context.newPage();
        this.browser = null;
      }
      
      // Navigate to URL if provided
      if (url) {
        const currentUrl = this.page.url();
        if (!currentUrl.includes(new URL(url).hostname)) {
          console.log('[PlaywrightRecorder] Debug: Navigating to:', url);
          await this.page.goto(url, { waitUntil: 'domcontentloaded', timeout });
        }
      }
      
      // Execute steps
      let passedSteps = 0;
      let failedStep = -1;
      let failError = '';
      
      for (let i = 0; i < steps.length; i++) {
        // Check if stop requested
        if (this._stopRequested) {
          console.log('[PlaywrightRecorder] Debug: Stop requested, aborting');
          for (let j = i; j < steps.length; j++) {
            stepResults[j] = { index: j, status: 'skipped' };
          }
          break;
        }
        
        // Check if step-by-step mode (pause before each step after first)
        if (this._stepByStep && i > 0) {
          this._testPaused = true;
          this._pausedAtStep = i;
          this.emit('test-paused', { stepIndex: i, step: steps[i] });
          
          await this._waitForResume();
          
          if (this._stopRequested) {
            for (let j = i; j < steps.length; j++) {
              stepResults[j] = { index: j, status: 'skipped' };
            }
            break;
          }
        }
        
        const step = steps[i];
        console.log(`[PlaywrightRecorder] Debug: Step ${i + 1}: ${step.description || step.qword}`);
        
        this.emit('test-step-start', { stepIndex: i, step });
        this.emit('test-runner:step-start', { index: i, step });
        
        const stepStart = Date.now();
        
        try {
          const stepInfo = await this._executeStepInternal(step, timeout);
          
          const duration = Date.now() - stepStart;
          const workingSelector = stepInfo?.workingSelector || this._lastWorkingSelector || null;
          const strategyType = stepInfo?.strategyType || this._lastStrategyType || null;
          
          stepResults[i] = { 
            index: i, 
            status: 'passed', 
            duration,
            // SIMPLE: Store the actual selector that worked for Lock Locators
            workingSelector,
            strategyType
          };
          passedSteps++;
          
          // Include workingSelector in event for frontend Lock Locators
          this.emit('test-step-complete', { stepIndex: i, success: true, workingSelector, strategyType });
          this.emit('test-runner:step-complete', { index: i, status: 'passed', duration, workingSelector, strategyType });
          
          // Brief pause between steps (reduced from 500ms)
          const debugStepDelay = (strategyType === 'LockedSelector' || strategyType === 'already-locked') ? 30 : 150;
          await this.page.waitForTimeout(debugStepDelay);
          
        } catch (stepError) {
          console.error(`[PlaywrightRecorder] Debug: Step ${i + 1} failed:`, stepError.message);
          
          const duration = Date.now() - stepStart;
          let screenshot = null;
          try {
            const buf = await this.page.screenshot();
            screenshot = `data:image/png;base64,${buf.toString('base64')}`;
          } catch (e) {}
          
          stepResults[i] = { index: i, status: 'failed', error: stepError.message, screenshot, duration };
          
          this.emit('test-step-complete', { stepIndex: i, success: false, error: stepError.message });
          this.emit('test-runner:step-failed', { index: i, error: stepError.message, screenshot });
          
          // In debug mode, pause on failure
          this._testPaused = true;
          this._pausedAtStep = i;
          this.emit('test-paused', { stepIndex: i, step, error: stepError.message });
          this.emit('test-runner:test-paused', { stepIndex: i, step, error: stepError.message });
          
          await this._waitForResume();
          
          if (this._stopRequested) {
            failedStep = i;
            failError = stepError.message;
            for (let j = i + 1; j < steps.length; j++) {
              stepResults[j] = { index: j, status: 'skipped' };
            }
            break;
          }
          
          // If they didn't stop, check if step was retried successfully
          if (stepResults[i].status === 'passed') {
            passedSteps++;
            continue;
          }
          
          // Otherwise mark as failed and continue (they skipped)
          if (stepResults[i].status === 'skipped') {
            continue;
          }
          
          failedStep = i;
          failError = stepError.message;
          break;
        }
      }
      
      const success = failedStep === -1 && !this._stopRequested;
      
      console.log(`[PlaywrightRecorder] Debug: Test ${success ? 'PASSED' : 'FAILED'}: ${passedSteps}/${steps.length}`);
      
      const result = {
        success,
        passedSteps,
        failedStep,
        totalSteps: steps.length,
        error: failError || undefined,
        stepResults
      };
      
      this.emit('test-complete', result);
      this.emit('test-runner:test-complete', result);
      
      return result;
      
    } catch (error) {
      console.error('[PlaywrightRecorder] Debug: Error:', error.message);
      return {
        success: false,
        error: error.message,
        passedSteps: 0,
        failedStep: 0,
        totalSteps: steps?.length || 0,
        stepResults
      };
    } finally {
      this._isRunningTest = false;
      this._debugMode = false;
      
      // In debug mode, DON'T close browser automatically - let user inspect
      // Browser will be closed when stopTest is called
      if (!this._testPaused) {
        console.log('[PlaywrightRecorder] Debug: Test complete, closing browser...');
        try {
          if (this.context) {
            await this.context.close().catch(() => {});
          }
          this.page = null;
          this.context = null;
          this.browser = null;
        } catch (e) {}
      }
    }
  }

  /**
   * Pause test execution (debug mode)
   */
  pauseTest() {
    if (!this._debugMode) {
      console.log('[PlaywrightRecorder] pauseTest: Not in debug mode');
      return { success: false, error: 'Not in debug mode' };
    }
    
    console.log('[PlaywrightRecorder] Test pause requested');
    this._testPaused = true;
    return { success: true };
  }

  /**
   * Resume test execution (debug mode)
   */
  resumeTest(options = {}) {
    if (!this._testPaused) {
      console.log('[PlaywrightRecorder] resumeTest: Not paused');
      return { success: false, error: 'Not paused' };
    }
    
    console.log('[PlaywrightRecorder] Resuming test from step', this._pausedAtStep);
    
    // Apply updated steps if provided
    if (options.steps) {
      this._currentTestSteps = options.steps;
    }
    
    this._testPaused = false;
    
    this.emit('test-resumed', { stepIndex: this._pausedAtStep });
    this.emit('test-runner:test-resumed', { stepIndex: this._pausedAtStep });
    
    // Unblock
    if (this._pauseResolver) {
      this._pauseResolver();
      this._pauseResolver = null;
    }
    
    return { success: true };
  }

  /**
   * Skip current step (debug mode)
   */
  skipStep(options = {}) {
    if (!this._testPaused) {
      return { success: false, error: 'Not paused' };
    }
    
    console.log('[PlaywrightRecorder] Skipping step', this._pausedAtStep);
    
    this._testPaused = false;
    
    // Unblock
    if (this._pauseResolver) {
      this._pauseResolver();
      this._pauseResolver = null;
    }
    
    return { success: true };
  }

  /**
   * Retry current step with optional updates (debug mode)
   */
  async retryStep(options = {}) {
    if (!this._testPaused || !this.page) {
      return { success: false, error: 'Not paused or no page' };
    }
    
    const stepIndex = this._pausedAtStep;
    const step = options.step || this._currentTestSteps[stepIndex];
    
    console.log('[PlaywrightRecorder] Retrying step', stepIndex);
    
    // Update step in list if provided
    if (options.step) {
      this._currentTestSteps[stepIndex] = options.step;
    }
    
    this.emit('test-step-start', { stepIndex, step, isRetry: true });
    this.emit('test-runner:step-start', { index: stepIndex, step, isRetry: true });
    
    const startTime = Date.now();
    
    try {
      await this._executeStepInternal(step, options.timeout || 30000);
      
      const duration = Date.now() - startTime;
      
      this.emit('test-step-complete', { stepIndex, success: true, isRetry: true });
      this.emit('test-runner:step-complete', { index: stepIndex, status: 'passed', duration, isRetry: true });
      
      return { success: true, index: stepIndex, status: 'passed', duration };
      
    } catch (error) {
      const duration = Date.now() - startTime;
      
      let screenshot = null;
      try {
        const buf = await this.page.screenshot();
        screenshot = `data:image/png;base64,${buf.toString('base64')}`;
      } catch (e) {}
      
      this.emit('test-step-complete', { stepIndex, success: false, error: error.message, isRetry: true });
      this.emit('test-runner:step-failed', { index: stepIndex, error: error.message, screenshot, isRetry: true });
      
      return { success: false, index: stepIndex, status: 'failed', error: error.message, screenshot, duration };
    }
  }

  /**
   * Stop test execution (debug mode)
   */
  async stopTest(options = {}) {
    console.log('[PlaywrightRecorder] Stop test requested');
    
    this._stopRequested = true;
    this._testPaused = false;
    
    // Unblock if waiting
    if (this._pauseResolver) {
      this._pauseResolver();
      this._pauseResolver = null;
    }
    
    this.emit('test-stopped', { stepIndex: this._pausedAtStep });
    this.emit('test-runner:test-stopped', { stepIndex: this._pausedAtStep });
    
    // Close browser if requested
    if (options.closeBrowser !== false) {
      try {
        if (this.context) {
          await this.context.close().catch(() => {});
        }
        this.page = null;
        this.context = null;
        this.browser = null;
        console.log('[PlaywrightRecorder] Browser closed');
      } catch (e) {}
    }
    
    return { success: true };
  }

  /**
   * Run a single step (for step-by-step mode)
   */
  async runSingleStep(options = {}) {
    const { step, index, timeout = 30000 } = options;
    
    if (!this.page || this.page.isClosed()) {
      return { success: false, error: 'No browser page' };
    }
    
    console.log('[PlaywrightRecorder] Running single step', index);
    
    this.emit('test-step-start', { stepIndex: index, step });
    this.emit('test-runner:step-start', { index, step });
    
    const startTime = Date.now();
    
    try {
      await this._executeStepInternal(step, timeout);
      
      const duration = Date.now() - startTime;
      
      this.emit('test-step-complete', { stepIndex: index, success: true });
      this.emit('test-runner:step-complete', { index, status: 'passed', duration });
      
      return { success: true, index, status: 'passed', duration };
      
    } catch (error) {
      const duration = Date.now() - startTime;
      
      let screenshot = null;
      try {
        const buf = await this.page.screenshot();
        screenshot = `data:image/png;base64,${buf.toString('base64')}`;
      } catch (e) {}
      
      this.emit('test-step-complete', { stepIndex: index, success: false, error: error.message });
      this.emit('test-runner:step-failed', { index, error: error.message, screenshot });
      
      return { success: false, index, status: 'failed', error: error.message, screenshot, duration };
    }
  }

  /**
   * Get test status (debug mode)
   */
  getTestStatus() {
    return {
      isRunning: this._isRunningTest || false,
      isPaused: this._testPaused || false,
      currentStep: this._pausedAtStep,
      debugMode: this._debugMode || false,
      stepByStep: this._stepByStep || false
    };
  }

  /**
   * Wait for resume signal (internal)
   */
  _waitForResume() {
    return new Promise((resolve) => {
      this._pauseResolver = resolve;
    });
  }

  /**
   * Execute a single step (internal helper)
   */
  async _executeStepInternal(step, timeout) {
    const stepType = step.type || 
                     (step.qword?.toLowerCase() === 'goto' ? 'navigate' :
                      step.qword?.toLowerCase() === 'fill' ? 'fill' :
                      step.qword?.toLowerCase() === 'select' ? 'select' :
                      step.qword?.toLowerCase() === 'asserttext' ? 'assert' :
                      step.qword?.toLowerCase() === 'wait' ? 'wait' :
                      step.qword?.toLowerCase() || 'click');
    
    const fillValue = step.value || step.args?.[1] || '';
    const urlValue = step.url || step.args?.[0] || '';
    
    // CRITICAL FIX: Check ALL possible sources of element text
    // CDP-recorded: args[0] has the text
    // Recipe-recorded: text, label, selectorObj.text, element.text have the text
    let labelValue = step.target || 
                     step.args?.[0] || 
                     step.text ||                    // Recipe recorder stores here
                     step.label ||                   // Recipe recorder stores here
                     step.selectorObj?.text ||       // Recipe recorder stores here
                     step.element?.text;             // Recipe recorder stores here
    
    // Last resort: Extract from description
    if (!labelValue && step.description) {
      const descMatch = step.description.match(/(?:Click|Fill|Select|Type)\s*"([^"]+)"/i);
      if (descMatch) {
        labelValue = descMatch[1];
      } else {
        labelValue = step.description;
      }
    }
    labelValue = labelValue || '';
    
    const normalizedSelector = typeof step.selector === 'string'
      ? step.selector
      : (step.selector?.selector || step.selectorObj?.selector || '');
    
    const action = {
      type: stepType,
      label: labelValue,
      text: labelValue,
      value: fillValue,
      url: ['navigate', 'goto'].includes(stepType) ? urlValue : undefined,
      selector: normalizedSelector,
      timeout,
      args: step.args,
      // CRITICAL: Pass element data for SmartFinder role-based search
      element: step.element || {},
      selectorObj: step.selectorObj || step.selector || {},
      recipe: step.recipe || step.target || null,
      elementIndex: step.elementIndex ?? step.args?.[1] ?? null,
      // CRITICAL: Context tracking for multi-tab and iframe support
      frameContext: step.frameContext || null,
      tabIndex: step.tabIndex ?? null
    };
    
    const result = await this.executeAction(action);
    
    if (result.success === false) {
      throw new Error(result.error || 'Step failed');
    }
    
    // Execute assertions if defined
    if (step.assertion && step.assertion.type && step.assertion.enabled !== false) {
      const assertionResult = await this.executeAssertion(step.assertion, normalizedSelector);
      if (!assertionResult.success) {
        throw new Error(`Assertion failed: ${assertionResult.error || step.assertion.expected}`);
      }
    }
    
    // Return the working selector info for Lock Locators feature
    return {
      workingSelector: result.workingSelector || null,
      strategyType: result.strategyType || result.strategy?.type || null
    };
  }

  // ============================================================================
  // END DEBUG MODE METHODS
  // ============================================================================

  /**
   * Execute action from browser overlay (called via IPC)
   * This allows the overlay to use the same robust click logic as the app
   */
  async executeOverlayAction(action) {
    console.log('[PlaywrightRecorder] Executing overlay action:', action.label || action.description);
    return await this.executeAction(action);
  }

  /**
   * Pause recording (actions still collected but not processed)
   */
  pause() {
    if (!this.recording) return { success: false, error: 'Not recording' };
    this.paused = true;
    this._updateOverlay();
    this.emit('paused');
    console.log('[PlaywrightRecorder] Recording paused');
    return { success: true };
  }

  /**
   * Resume recording
   */
  resume() {
    if (!this.recording) return { success: false, error: 'Not recording' };
    this.paused = false;
    this._updateOverlay();
    this.emit('resumed');
    console.log('[PlaywrightRecorder] Recording resumed');
    return { success: true };
  }

  /**
   * Update the browser overlay
   */
  async _updateOverlay() {
    if (!this.page || this.page.isClosed()) return;
    try {
      const status = this.paused ? 'paused' : (this.recording ? 'recording' : 'browsing');
      const lastAction = this.actions.length > 0 ? this.actions[this.actions.length - 1].description : '';
      await this.page.evaluate(`
        window.__flowstralUpdateOverlay__ && window.__flowstralUpdateOverlay__({
          stepCount: ${this.actions.length},
          lastAction: ${JSON.stringify(lastAction)},
          status: '${status}'
        });
      `);
    } catch (e) {}
  }

  /**
   * Poll for overlay button clicks
   */
  _startOverlayPolling() {
    if (this.overlayPollInterval) clearInterval(this.overlayPollInterval);
    
    this.overlayPollInterval = setInterval(async () => {
      if (!this.page || this.page.isClosed()) return;
      
      try {
        const result = await this.page.evaluate(`
          (function() {
            var pause = window.__flowstralPauseClicked__;
            var stop = window.__flowstralStopClicked__;
            window.__flowstralPauseClicked__ = false;
            window.__flowstralStopClicked__ = false;
            return { pause: pause, stop: stop };
          })()
        `);
        
        if (result.pause) {
          if (this.paused) {
            this.resume();
          } else {
            this.pause();
          }
        }
        if (result.stop) {
          this.stop();
        }
      } catch (e) {}
    }, 200);
  }

  /**
   * Start auto-refreshing suggestions
   */
  _startSuggestionPolling() {
    if (this.suggestionInterval) clearInterval(this.suggestionInterval);
    
    this.suggestionInterval = setInterval(async () => {
      if (!this.page || this.page.isClosed()) return;
      
      try {
        const suggestions = await this.analyzePage();
        if (suggestions.success && suggestions.suggestions) {
          // Create a hash using ALL suggestions count + first/last items for change detection
          const sugs = suggestions.suggestions;
          const hashParts = [
            sugs.length, // Total count matters
            sugs.slice(0, 5).map(s => s.label + s.type).join('|'), // First 5
            sugs.slice(-3).map(s => s.label + s.type).join('|') // Last 3
          ];
          const hash = hashParts.join('::');
          
          if (hash !== this.lastSuggestionHash) {
            this.lastSuggestionHash = hash;
            this.emit('suggestions', { suggestions: suggestions.suggestions });
            // NOTE: analyzePage() now handles overlay update, no need to duplicate here
          }
          
          // Update step count in browser
          try {
            await this._updateOverlay();
          } catch (e) {}
        }
        
        // Check for elements added via the + button in browser
        try {
          const addedSteps = await this.page.evaluate(() => {
            const steps = window.__flowstralAddToSteps__ || [];
            window.__flowstralAddToSteps__ = []; // Clear after reading
            return steps;
          });
          
          if (addedSteps && addedSteps.length > 0) {
            addedSteps.forEach(step => {
              this.addManualAction({
                qword: step.type === 'fill' ? 'Fill' : step.type === 'click' ? 'ClickText' : step.type === 'select' ? 'Select' : 'Click',
                args: [step.label],
                description: step.description || `${step.action || 'Click'} "${step.label}"`,
                selector: step.selector
              });
            });
          }
        } catch (e) {}
        
        // Check for actions to EXECUTE via the ▶ button in browser overlay
        // This uses the same robust executeAction as the app suggest panel
        try {
          const executeQueue = await this.page.evaluate(() => {
            const queue = window.__flowstralExecuteQueue__ || [];
            window.__flowstralExecuteQueue__ = []; // Clear after reading
            return queue;
          });
          
          if (executeQueue && executeQueue.length > 0) {
            for (const action of executeQueue) {
              console.log('[PlaywrightRecorder] Executing overlay action:', action.label);
              
              try {
                // Use the same robust executeAction that the app uses
                const result = await this.executeAction({
                  type: action.type || 'click',
                  label: action.label,
                  text: action.text,
                  selector: action.selector,
                  description: action.description
                });
                
                // Update the button in the overlay to show success/failure
                const success = result.success !== false;
                await this.page.evaluate(({ execBtnId, success }) => {
                  const buttons = window.__flowstralExecButtons__ || {};
                  const btn = buttons[execBtnId];
                  if (btn) {
                    btn.textContent = success ? '✓' : '✗';
                    btn.style.background = success ? 'rgba(34,197,94,0.4)' : 'rgba(239,68,68,0.3)';
                    btn.style.borderColor = success ? '#22c55e' : '#ef4444';
                    btn.style.color = success ? '#22c55e' : '#ef4444';
                    setTimeout(() => {
                      btn.textContent = '▶';
                      btn.style.background = '';
                      btn.style.borderColor = '';
                      btn.style.color = '';
                    }, 1500);
                  }
                }, { execBtnId: action.execBtnId, success }).catch(() => {});
                
                if (!success) {
                  console.log('[PlaywrightRecorder] Overlay action failed:', result.error);
                }
              } catch (execError) {
                console.log('[PlaywrightRecorder] Overlay action error:', execError.message);
              }
            }
          }
        } catch (e) {}
      } catch (e) {}
    }, 2000); // Refresh every 2 seconds for better responsiveness
  }

  /**
   * Stop recording and close browser
   */
  async stop() {
    this.recording = false;
    this.paused = false;
    this._stopPolling();
    
    // Stop CDP click capture
    if (this._cdpClickInterval) {
      clearInterval(this._cdpClickInterval);
      this._cdpClickInterval = null;
    }
    if (this._cdpClient) {
      try {
        await this._cdpClient.detach();
      } catch (e) {}
      this._cdpClient = null;
    }
    
    // Stop tab focus detection
    if (this._tabFocusInterval) {
      clearInterval(this._tabFocusInterval);
      this._tabFocusInterval = null;
    }
    
    // Stop overlay and suggestion polling
    if (this.overlayPollInterval) {
      clearInterval(this.overlayPollInterval);
      this.overlayPollInterval = null;
    }
    if (this.suggestionInterval) {
      clearInterval(this.suggestionInterval);
      this.suggestionInterval = null;
    }

    // Get final actions from page and update overlay
    if (this.page && !this.page.isClosed()) {
      try {
        // Update overlay to show "Stopped" status
        await this.page.evaluate(`
          if (window.__flowstralUpdateOverlay__) {
            window.__flowstralUpdateOverlay__({
              stepCount: ${this.actions.length},
              lastAction: 'Recording stopped',
              status: 'stopped'
            });
          }
        `);
        
        // CRITICAL: Force blur on any focused input to trigger flush
        await this.page.evaluate(`
          try {
            if (document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA')) {
              document.activeElement.blur();
            }
          } catch(e) {}
        `);
        
        // Small delay to ensure blur events are processed
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Flush any pending input from recorder script
        await this.page.evaluate('window.flushPendingInput && window.flushPendingInput()');
        
        // CRITICAL: Flush all pending CDP inputs AND scan for any unflushed input values
        try {
          const pendingCDPInputs = await this.page.evaluate(`
            (function() {
              var inputs = [];
              var seenKeys = new Set();
              
              // First get pending inputs
              var pendingInputs = window.__flowstralCDPInputs || {};
              for (var key in pendingInputs) {
                var inp = pendingInputs[key];
                if (inp && inp.value) {
                  inputs.push(inp);
                  seenKeys.add(key);
                }
              }
              window.__flowstralCDPInputs = {}; // Clear
              
              // ALSO: Scan all input fields for any values we might have missed
              try {
                var allInputs = document.querySelectorAll('input[type="text"], input[type="email"], input[type="password"], input[type="search"], input[type="tel"], input[type="url"], input:not([type]), textarea');
                for (var i = 0; i < allInputs.length; i++) {
                  var el = allInputs[i];
                  if (!el.value || el.value.length === 0) continue;
                  
                  var key = (el.id || '') + '|' + (el.name || '') + '|' + (el.placeholder || '') + '|' + (el.getAttribute('aria-label') || '');
                  if (seenKeys.has(key)) continue; // Already captured
                  
                  inputs.push({
                    timestamp: Date.now(),
                    tag: 'input',
                    type: (el.type || 'text').toLowerCase(),
                    value: el.value,
                    id: el.id || '',
                    name: el.name || el.getAttribute('name') || '',
                    placeholder: el.placeholder || el.getAttribute('placeholder') || '',
                    ariaLabel: el.getAttribute('aria-label') || '',
                    title: el.getAttribute('title') || '',
                    fromShadow: false,
                    key: key,
                    scannedOnStop: true
                  });
                }
                
                // CRITICAL: Scan contenteditable elements (Salesforce Chatter, rich text editors)
                var contenteditables = document.querySelectorAll('[contenteditable="true"], [role="textbox"], .ql-editor, .slds-rich-text-area__content, .cke_editable');
                for (var i = 0; i < contenteditables.length; i++) {
                  var el = contenteditables[i];
                  var value = (el.textContent || el.innerText || '').trim();
                  if (!value || value.length === 0) continue;
                  // Skip placeholder text like "Share an update..."
                  if (value.toLowerCase().includes('share an update') || value.toLowerCase().includes('type a message')) continue;
                  
                  var ariaLabel = el.getAttribute('aria-label') || '';
                  var placeholder = el.getAttribute('placeholder') || el.getAttribute('data-placeholder') || '';
                  var key = 'ce|' + (el.id || '') + '|' + ariaLabel + '|' + placeholder;
                  if (seenKeys.has(key)) continue;
                  
                  inputs.push({
                    timestamp: Date.now(),
                    tag: 'contenteditable',
                    type: 'richtext',
                    value: value,
                    id: el.id || '',
                    name: '',
                    placeholder: placeholder,
                    ariaLabel: ariaLabel,
                    title: el.getAttribute('title') || '',
                    fromShadow: false,
                    key: key,
                    scannedOnStop: true,
                    isContentEditable: true
                  });
                  seenKeys.add(key);
                }
                
                // Also scan Shadow DOM
                var shadowHosts = document.querySelectorAll('*');
                for (var i = 0; i < shadowHosts.length; i++) {
                  if (shadowHosts[i].shadowRoot) {
                    var shadowInputs = shadowHosts[i].shadowRoot.querySelectorAll('input[type="text"], input[type="email"], input[type="password"], input:not([type]), textarea');
                    for (var j = 0; j < shadowInputs.length; j++) {
                      var el = shadowInputs[j];
                      if (!el.value || el.value.length === 0) continue;
                      
                      var key = (el.id || '') + '|' + (el.name || '') + '|' + (el.placeholder || '') + '|' + (el.getAttribute('aria-label') || '');
                      if (seenKeys.has(key)) continue;
                      
                      inputs.push({
                        timestamp: Date.now(),
                        tag: 'input',
                        type: (el.type || 'text').toLowerCase(),
                        value: el.value,
                        id: el.id || '',
                        name: el.name || el.getAttribute('name') || '',
                        placeholder: el.placeholder || el.getAttribute('placeholder') || '',
                        ariaLabel: el.getAttribute('aria-label') || '',
                        title: el.getAttribute('title') || '',
                        fromShadow: true,
                        key: key,
                        scannedOnStop: true
                      });
                    }
                  }
                }
              } catch(scanErr) {}
              
              return inputs;
            })()
          `);
          
          if (pendingCDPInputs && pendingCDPInputs.length > 0) {
            console.log('[PlaywrightRecorder] Flushing', pendingCDPInputs.length, 'pending CDP inputs on stop');
            await this._processInputs(pendingCDPInputs);
          }
        } catch (e) {
          console.log('[PlaywrightRecorder] Could not flush CDP inputs:', e.message);
        }
        
        // Get all actions and process any new ones
        const result = await this.page.evaluate(`
          (function() {
            var actions = window.__flowstralActions__ || [];
            return {
              total: actions.length,
              actions: actions
            };
          })()
        `);
        
        if (result && result.total > this.lastProcessedIndex) {
          const newActions = result.actions.slice(this.lastProcessedIndex);
          this._processNewActions(newActions);
        }
        
        // Give user a moment to see the stopped status
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (e) {
        // Page might be closed
      }
    }

    // Close persistent context (session data is automatically preserved)
    if (this.context) {
      await this.context.close();
      this.context = null;
      this.page = null;
      this.browser = null;
      console.log('[PlaywrightRecorder] Browser closed, session data preserved');
    } else if (this.browser) {
      // Fallback for non-persistent context
      await this.browser.close();
      this.browser = null;
      this.context = null;
      this.page = null;
    }

    // Final deduplication pass - only remove TRUE duplicates (same action within 500ms)
    // IMPORTANT: DO NOT dedupe based on description alone - "Next" can be clicked multiple times!
    const uniqueActions = [];
    const seenFills = new Map(); // Track fills by field key
    const seenNavigations = new Map(); // Track navigation URLs to dedupe consecutive same-URL navigations
    
    for (let i = 0; i < this.actions.length; i++) {
      const action = this.actions[i];
      
      // For fill actions, only keep the LAST fill for each field
      if (action.qword === 'Fill') {
        const fieldKey = action.raw?.fieldKey || action.args?.[0] || '';
        seenFills.set(fieldKey, { action, index: i });
        continue; // Don't add yet - we'll add the last one later
      }
      
      // For navigate actions, skip consecutive duplicates to same URL
      if (action.type === 'navigate' || action.qword === 'GoTo') {
        const navUrl = action.url || action.args?.[0] || '';
        const lastNavUrl = seenNavigations.get('lastUrl');
        const lastNavTimestamp = seenNavigations.get('lastTimestamp') || 0;
        const navTimeDiff = Math.abs((action.timestamp || 0) - lastNavTimestamp);
        
        // Skip if same URL within 1 second
        if (lastNavUrl === navUrl && navTimeDiff < 1000) {
          console.log('[PlaywrightRecorder] Final dedupe: skipping duplicate navigation to:', navUrl);
          continue;
        }
        
        seenNavigations.set('lastUrl', navUrl);
        seenNavigations.set('lastTimestamp', action.timestamp || 0);
      }
      
      // For SwitchTab actions, aggressively skip redundant ones
      if (action.qword === 'SwitchTab') {
        const actionTabIndex = action.tabIndex ?? action.args?.[0];
        
        // Check if NEXT action (in original list) is from the same tab
        // If so, the switchTab is redundant - the action already implies the tab
        const nextAction = this.actions[i + 1];
        if (nextAction && nextAction.tabIndex === actionTabIndex) {
          console.log('[PlaywrightRecorder] Final dedupe: skipping SwitchTab - next action already from tab', actionTabIndex);
          continue;
        }
        
        // Check if PREVIOUS action (in unique list) is from the same tab
        const prevAction = uniqueActions[uniqueActions.length - 1];
        if (prevAction && (prevAction.tabIndex === actionTabIndex || 
            (prevAction.qword === 'SwitchTab' && (prevAction.tabIndex ?? prevAction.args?.[0]) === actionTabIndex))) {
          console.log('[PlaywrightRecorder] Final dedupe: skipping SwitchTab - already on tab', actionTabIndex);
          continue;
        }
        
        // Check if we already have ANY recent action from this tab (last 5 in unique list)
        const recentFromSameTab = uniqueActions.slice(-5).some(a => 
          a.tabIndex === actionTabIndex && a.qword !== 'SwitchTab' && a.qword !== 'NewTab'
        );
        if (recentFromSameTab) {
          console.log('[PlaywrightRecorder] Final dedupe: skipping SwitchTab - recent action from tab', actionTabIndex);
          continue;
        }
      }
      
      // For click/hover actions, check if it's a TRUE duplicate (same action within 500ms OR same timestamp)
      // Allow repeated clicks like "Next" buttons on multi-step forms!
      const prevAction = uniqueActions[uniqueActions.length - 1];
      const timeDiff = Math.abs((prevAction?.timestamp || 0) - (action.timestamp || 0));
      const isSameTimestamp = prevAction?.timestamp === action.timestamp;
      
      if (prevAction && 
          prevAction.description === action.description &&
          prevAction.qword === action.qword &&
          (timeDiff < 500 || isSameTimestamp)) {
        // Skip true double-click or same-timestamp duplicate
        console.log('[PlaywrightRecorder] Final dedupe: skipping duplicate:', action.description, 
                    isSameTimestamp ? '(same timestamp)' : `(${timeDiff}ms apart)`);
        continue;
      }
      
      // ────────────────────────────────────────────────────────────────
      // SMART HOVER FILTERING
      // Skip hover steps that are redundant:
      // 1. Hover right after a click on related element (click already opened the menu)
      // 2. Hover followed immediately by a click on the same element (click subsumes hover)
      // Keep hovers ONLY when they reveal content that wouldn't appear from a click
      // ────────────────────────────────────────────────────────────────
      const isHover = (action.qword || '').toLowerCase() === 'hover';
      if (isHover && prevAction) {
        const prevIsClick = ['ClickText', 'ClickElement', 'Click'].includes(prevAction.qword || '');
        const hoverText = (action.args?.[0] || action.description || '').toLowerCase();
        const prevText = (prevAction.args?.[0] || prevAction.description || '').toLowerCase();
        
        // Pattern 1: Click "Show Navigation Menu" → Hover "Navigation Menu" → Click "Item"
        // The hover is redundant because the click already opened the menu
        if (prevIsClick && timeDiff < 3000) {
          // Check if hover target is same/related to previous click target
          const textsOverlap = hoverText && prevText && (
            hoverText.includes(prevText.replace(/^click\s*/i, '').replace(/"/g, '').trim()) ||
            prevText.includes(hoverText.replace(/^hover\s*(over\s*)?/i, '').replace(/"/g, '').trim())
          );
          if (textsOverlap) {
            console.log('[PlaywrightRecorder] Final dedupe: skipping redundant hover after click:', action.description);
            continue;
          }
        }
        
        // Pattern 2: Hover "X" immediately followed by Click "X" (or child of X)
        // Look ahead to see if next action is a click
        const nextAction = actions[actions.indexOf(action) + 1] || sortedActions?.[sortedActions.indexOf(action) + 1];
        if (nextAction) {
          const nextIsClick = ['ClickText', 'ClickElement', 'Click'].includes(nextAction.qword || '');
          const nextText = (nextAction.args?.[0] || nextAction.description || '').toLowerCase();
          const nextTimeDiff = Math.abs((nextAction.timestamp || 0) - (action.timestamp || 0));
          
          if (nextIsClick && nextTimeDiff < 2000) {
            // If hover and click are on the same element, skip the hover
            if (hoverText === nextText || 
                nextText.includes(hoverText.replace(/^hover\s*(over\s*)?/i, '').replace(/"/g, '').trim())) {
              console.log('[PlaywrightRecorder] Final dedupe: skipping hover before click on same element:', action.description);
              continue;
            }
          }
        }
      }
      
      uniqueActions.push(action);
    }
    
    // Add the last fill for each field (sorted by original index)
    const fillsToAdd = Array.from(seenFills.values())
      .sort((a, b) => a.index - b.index)
      .map(f => f.action);
    
    // Insert fills at their original positions (approximately)
    for (const fill of fillsToAdd) {
      const insertIdx = uniqueActions.findIndex(a => (a.timestamp || 0) > (fill.timestamp || 0));
      if (insertIdx === -1) {
        uniqueActions.push(fill);
      } else {
        uniqueActions.splice(insertIdx, 0, fill);
      }
    }
    
    this.actions = uniqueActions;

    console.log('[PlaywrightRecorder] Recording stopped,', this.actions.length, 'actions');
    this.emit('stopped', { actions: this.actions });
    
    return { success: true, actions: this.actions };
  }

  /**
   * Add a manual action (from suggestions or user input)
   * These persist even after recording stops
   */
  addManualAction(action) {
    const qwordAction = {
      id: `manual_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      qword: action.qword || 'ClickText',
      args: action.args || [action.label || action.description],
      displayArgs: action.displayArgs,
      description: action.description,
      timestamp: Date.now(),
      selectorObj: action.selector ? { selector: action.selector } : undefined,
      isManual: true
    };
    
    this._insertByTimestamp(qwordAction);
    this.manualActions.push(qwordAction); // Also track in manual actions
    
    // Update overlay
    this._updateOverlay();
    
    // Emit action event
    this.emit('action', qwordAction);
    
    console.log('[PlaywrightRecorder] Manual action added:', qwordAction.description);
    return { success: true, action: qwordAction };
  }

  /**
   * Check if paused
   */
  isPaused() {
    return this.paused;
  }

  /**
   * Get current actions
   */
  getActions() {
    return this.actions;
  }

  /**
   * Clear actions
   */
  clearActions() {
    this.actions = [];
  }

  /**
   * Check if recording
   */
  isRecording() {
    return this.recording;
  }

  /**
   * Switch the active page context to a specific tab index.
   * Used when opening Smart Suggestions for a step on a different tab.
   * @param {number} tabIndex - The tab index to switch to
   * @returns {{ success: boolean, error?: string }}
   */
  async switchToTabForContext(tabIndex) {
    try {
      const pages = this._pages || this.context.pages();
      if (tabIndex < 0 || tabIndex >= pages.length) {
        console.log(`[PlaywrightRecorder] switchToTabForContext: tab ${tabIndex} out of range (have ${pages.length} tabs)`);
        return { success: false, error: `Tab ${tabIndex} not found (have ${pages.length} tabs)` };
      }
      const targetPage = pages[tabIndex];
      if (targetPage.isClosed()) {
        console.log(`[PlaywrightRecorder] switchToTabForContext: tab ${tabIndex} is closed`);
        return { success: false, error: `Tab ${tabIndex} is closed` };
      }
      this.page = targetPage;
      this._currentPageIndex = tabIndex;
      await this.page.bringToFront();
      console.log(`[PlaywrightRecorder] switchToTabForContext: switched to tab ${tabIndex} (${this.page.url().substring(0, 60)})`);
      return { success: true };
    } catch (e) {
      console.error(`[PlaywrightRecorder] switchToTabForContext error:`, e);
      return { success: false, error: e.message };
    }
  }

  /**
   * Analyze current page and return suggestions
   * ROBUST VERSION - mirrors browser extension's PageAnalyzer EXACTLY
   * Returns structured data with element types, duplicate detection, and counts
   */
  async analyzePage() {
    const { analyzePage: _analyzePage } = require('./recorder-analyze-page');
    return _analyzePage(this);
  }

  /**
   * Helper to highlight element before action (like extension does)
   */
  async _highlightAndScrollToElement(selector, textFallback) {
    try {
      // Find the element
      let locator;
      if (selector) {
        locator = this.page.locator(selector).first();
      } else if (textFallback) {
        locator = this.page.locator(`text=${textFallback}`).first();
      }
      
      if (locator) {
        // Scroll into view
        await locator.scrollIntoViewIfNeeded().catch(() => {});
        
        // Add highlight with bright green outline
        await locator.evaluate((el) => {
          el.style.outline = '2px solid #4ade80';
          el.style.outlineOffset = '1px';
        }).catch(() => {});
        
        // Minimal delay for highlight (reduced from 200ms)
        await this.page.waitForTimeout(50);
      }
    } catch (e) {
      // Ignore highlight errors
      console.log('[PlaywrightRecorder] Highlight failed:', e.message);
    }
  }
  
  /**
   * Helper to remove highlight after action
   */
  async _removeHighlight(selector, textFallback) {
    try {
      let locator;
      if (selector) {
        locator = this.page.locator(selector).first();
      } else if (textFallback) {
        locator = this.page.locator(`text=${textFallback}`).first();
      }
      
      if (locator) {
        await locator.evaluate((el) => {
          el.style.outline = '';
          el.style.outlineOffset = '';
        }).catch(() => {});
      }
    } catch (e) {
      // Ignore
    }
  }

  /**
   * Make Salesforce REST API call using session from browser cookies
   * @param {string} method - HTTP method (GET, POST, PATCH, DELETE)
   * @param {string} endpoint - API endpoint (e.g., /query?q=SELECT...)
   * @param {object} body - Request body for POST/PATCH
   * @returns {object} - { success: boolean, data: any, error: string }
   */
  async _sfApiCall(method, endpoint, body = null) {
    try {
      let accessToken = null;
      let instanceUrl = null;
      
      // Method 1: Try to get session cookie from browser
      if (this.context) {
        try {
          const cookies = await this.context.cookies();
          const sidCookie = cookies.find(c => c.name === 'sid');
          if (sidCookie) {
            accessToken = sidCookie.value;
            // Get instance URL from current page
            const currentUrl = this.page.url();
            const instanceMatch = currentUrl.match(/(https:\/\/[^\/]+\.(?:salesforce|force|develop\.my\.salesforce)\.com)/);
            if (instanceMatch) {
              instanceUrl = instanceMatch[1].replace('.lightning.force.com', '.my.salesforce.com');
              console.log(`[PlaywrightRecorder] SF API using browser session: ${instanceUrl}`);
            }
          }
        } catch (e) {
          console.log('[PlaywrightRecorder] Could not get browser session:', e.message);
        }
      }
      
      // Method 2: Fallback to stored credentials from backend config
      if (!accessToken || !instanceUrl) {
        try {
          const fs = require('fs');
          const path = require('path');
          const { app } = require('electron');
          
          // Try multiple paths for the credentials file
          const possiblePaths = [
            path.join(process.cwd(), 'backend', 'config', 'salesforce_credentials.json'),
            path.join(app.getAppPath(), '..', '..', 'backend', 'config', 'salesforce_credentials.json'),
            'C:\\QAAI\\backend\\config\\salesforce_credentials.json' // Hardcoded fallback for dev
          ];
          
          let credsPath = null;
          for (const p of possiblePaths) {
            if (fs.existsSync(p)) {
              credsPath = p;
              break;
            }
          }
          
          if (credsPath) {
            const creds = JSON.parse(fs.readFileSync(credsPath, 'utf8'));
            if (creds.access_token && creds.instance_url) {
              accessToken = creds.access_token;
              instanceUrl = creds.instance_url;
              console.log(`[PlaywrightRecorder] SF API using stored credentials from ${credsPath}`);
            }
          }
        } catch (e) {
          console.log('[PlaywrightRecorder] Could not load stored credentials:', e.message);
        }
      }
      
      if (!accessToken) {
        return { success: false, error: 'No Salesforce authentication available - please login via browser or configure credentials' };
      }
      
      if (!instanceUrl) {
        return { success: false, error: 'Could not determine Salesforce instance URL' };
      }
      
      // Build full URL
      const apiEndpoint = endpoint.startsWith('/services') ? endpoint : `/services/data/v59.0${endpoint}`;
      const fullUrl = `${instanceUrl}${apiEndpoint}`;
      
      console.log(`[PlaywrightRecorder] SF API ${method} ${fullUrl}`);
      
      // Use node https module
      const https = require('https');
      const url = require('url');
      
      return new Promise((resolve) => {
        const parsedUrl = new url.URL(fullUrl);
        const options = {
          hostname: parsedUrl.hostname,
          path: parsedUrl.pathname + parsedUrl.search,
          method,
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        };
        
        const req = https.request(options, (res) => {
          let data = '';
          res.on('data', chunk => data += chunk);
          res.on('end', () => {
            try {
              const jsonData = JSON.parse(data);
              if (res.statusCode >= 200 && res.statusCode < 300) {
                resolve({ success: true, data: jsonData });
              } else {
                console.log(`[PlaywrightRecorder] SF API error response:`, jsonData);
                resolve({ success: false, error: jsonData[0]?.message || JSON.stringify(jsonData), data: jsonData });
              }
            } catch (e) {
              if (res.statusCode >= 200 && res.statusCode < 300) {
                resolve({ success: true, data: null });
              } else {
                resolve({ success: false, error: `HTTP ${res.statusCode}: ${data}` });
              }
            }
          });
        });
        
        req.on('error', (e) => {
          resolve({ success: false, error: e.message });
        });
        
        if (body && (method === 'POST' || method === 'PATCH')) {
          req.write(JSON.stringify(body));
        }
        req.end();
      });
      
    } catch (error) {
      console.error('[PlaywrightRecorder] SF API call error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Try to find and interact with an element using multiple strategies
   * 
   * COMPREHENSIVE SHADOW DOM SUPPORT (Based on Playwright, Autify, Katalon best practices):
   * 1. Playwright's getByRole/getByLabel/getByText AUTOMATICALLY pierce Shadow DOM
   * 2. The >> operator chains through shadow roots
   * 3. Role-based selectors are the most reliable across Shadow DOM boundaries
   * 
   * Priority order:
   * 1. data-testid (most reliable)
   * 2. name attribute (stable)
   * 3. id attribute (if not dynamic)
   * 4. aria-label (accessibility)
   * 5. Playwright's semantic locators (getByRole, getByLabel) - pierce shadow DOM automatically
   * 6. Salesforce-specific selectors with shadow piercing
   * 7. CSS selectors with >> chaining for shadow DOM
   * 8. Fallback to generic text matching
   */
  
  // Helper to detect dynamic IDs that shouldn't be used for element finding
  _isDynamicId(id) {
    if (!id) return true;
    const dynamicPatterns = [
      /^[a-f0-9]{8,}$/i,           // Hex strings
      /^\d{6,}$/,                   // Long numbers
      /^:r[0-9a-z]+:$/,            // React IDs
      /_[a-z0-9]{6,}$/i,           // Suffix patterns
      /^ember\d+$/,                 // Ember IDs
      /^ng-/,                       // Angular IDs
      /^vue-/,                      // Vue IDs
      /-\d{10,}$/,                  // Timestamp suffixes
      /^(lwc|aura)-/i,             // Salesforce Lightning IDs
      /^radix-/i,                   // Radix UI IDs
      /^headlessui-/i,             // HeadlessUI IDs
      /^react-aria/i,              // React ARIA IDs
      /^mantine-/i,                // Mantine IDs
      /^chakra-/i,                 // Chakra UI IDs
    ];
    return dynamicPatterns.some(pattern => pattern.test(id));
  }
  
  async _findElement(action, scope) {
    const { _findElement: _findElementFn } = require('./recorder-find-element');
    return _findElementFn(this, action, scope);
  }

  /**
   * AI Vision Fallback - Find element by description using AI
   * This is the LAST RESORT when all deterministic strategies fail
   * @param {string} description - Human-readable element description
   * @param {string} actionType - 'click', 'fill', etc.
   * @returns {Promise<{x: number, y: number} | null>} - Coordinates or null if AI fails
   */
  async findElementWithAI(description, actionType = 'click') {
    if (!this.enableAIFallback) {
      console.log('[AI Fallback] AI fallback is disabled');
      return null;
    }
    
    if (this.aiCallsThisRun >= this.maxAICallsPerRun) {
      console.log(`[AI Fallback] Budget exhausted (${this.aiCallsThisRun}/${this.maxAICallsPerRun} calls used)`);
      return null;
    }
    
    try {
      console.log(`[AI Fallback] 🤖 Attempting AI vision for: "${description}"`);
      this.aiCallsThisRun++;
      
      // Take screenshot
      const screenshot = await this.page.screenshot({ type: 'png' });
      const screenshotBase64 = screenshot.toString('base64');
      
      // Get viewport dimensions (with fallback for headless/no-viewport modes)
      let viewport = await this.page.viewportSize();
      if (!viewport) {
        // Try to get from evaluate if viewportSize() returns null
        viewport = await this.page.evaluate(() => ({
          width: window.innerWidth || document.documentElement.clientWidth || 1920,
          height: window.innerHeight || document.documentElement.clientHeight || 1080
        })).catch(() => ({ width: 1920, height: 1080 }));
      }
      
      // Try to call AI service via backend API
      const backendUrl = process.env.BACKEND_URL || 'http://localhost:8000';
      
      try {
        const response = await fetch(`${backendUrl}/api/ai/vision/find-element`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            screenshot_base64: screenshotBase64,
            description: description,
            action_type: actionType,
            viewport: viewport,
            context: {
              url: this.page.url(),
              title: await this.page.title()
            }
          })
        });
        
        if (response.ok) {
          const result = await response.json();
          
          if (result.found && result.confidence > 0.7 && result.x && result.y) {
            console.log(`[AI Fallback] ✅ AI found element at (${result.x}, ${result.y}) with ${Math.round(result.confidence * 100)}% confidence`);
            return { x: result.x, y: result.y, confidence: result.confidence };
          }
        }
      } catch (e) {
        console.log('[AI Fallback] Backend AI service not available:', e.message);
      }
      
      // Fallback: OpenAI API directly if configured
      const openaiKey = process.env.OPENAI_API_KEY;
      if (openaiKey) {
        try {
          const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${openaiKey}`
            },
            body: JSON.stringify({
              model: 'gpt-4o-mini',
              messages: [
                {
                  role: 'system',
                  content: `You are a UI element locator. Given a screenshot and element description, return the PIXEL COORDINATES (x, y) of the CENTER of that element. 
                  
IMPORTANT: Return ONLY a JSON object in this exact format:
{"found": true, "x": 123, "y": 456, "confidence": 0.9}

If you cannot find the element, return:
{"found": false, "x": null, "y": null, "confidence": 0}

The viewport is ${viewport.width}x${viewport.height} pixels. Coordinates must be within this range.`
                },
                {
                  role: 'user',
                  content: [
                    {
                      type: 'text',
                      text: `Find the element for "${actionType}" action: "${description}"`
                    },
                    {
                      type: 'image_url',
                      image_url: { url: `data:image/png;base64,${screenshotBase64}` }
                    }
                  ]
                }
              ],
              max_tokens: 100
            })
          });
          
          if (openaiResponse.ok) {
            const openaiResult = await openaiResponse.json();
            const content = openaiResult.choices?.[0]?.message?.content || '';
            
            // Parse JSON response
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              const parsed = JSON.parse(jsonMatch[0]);
              if (parsed.found && parsed.x && parsed.y) {
                console.log(`[AI Fallback] ✅ OpenAI found element at (${parsed.x}, ${parsed.y})`);
                return { x: parsed.x, y: parsed.y, confidence: parsed.confidence || 0.8 };
              }
            }
          }
        } catch (e) {
          console.log('[AI Fallback] OpenAI API error:', e.message);
        }
      }
      
      console.log('[AI Fallback] AI could not find the element');
      return null;
      
    } catch (error) {
      console.error('[AI Fallback] Error:', error.message);
      return null;
    }
  }

  /**
   * Click at specific coordinates (used by AI fallback)
   */
  async clickAtCoordinates(x, y) {
    console.log(`[AI Fallback] Clicking at coordinates (${x}, ${y})`);
    await this.page.mouse.click(x, y);
    await this.page.waitForTimeout(200); // Let UI settle
  }

  /**
   * Retry with exponential backoff - handles transient failures
   * @param {Function} fn - Async function to retry
   * @param {Object} options - { maxRetries: 3, baseDelay: 500, maxDelay: 5000, description: 'action' }
   * @returns {Promise<any>} - Result of fn or throws after all retries
   */
  async retryWithBackoff(fn, options = {}) {
    const { 
      maxRetries = 3, 
      baseDelay = 200, 
      maxDelay = 2000,
      description = 'action'
    } = options;
    
    let lastError;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        
        if (attempt < maxRetries) {
          // Exponential backoff: 500ms, 1000ms, 2000ms, etc.
          const delay = Math.min(baseDelay * Math.pow(2, attempt - 1), maxDelay);
          console.log(`[Retry] ${description} failed (attempt ${attempt}/${maxRetries}), waiting ${delay}ms...`);
          console.log(`[Retry] Error: ${error.message}`);
          await this.page.waitForTimeout(delay);
          
          // Wait for page stability before retry
          await this.page.waitForLoadState('domcontentloaded').catch(() => {});
        }
      }
    }
    
    console.log(`[Retry] ${description} failed after ${maxRetries} attempts`);
    throw lastError;
  }

  /**
   * Find element with retry - wraps the element finding logic with retries
   * (Delegated to recorder-find-element.js)
   */
  async findElementWithRetry(action) {
    const { findElementWithRetry: _findElementWithRetry } = require('./recorder-find-element');
    return _findElementWithRetry(this, action);
  }

  /**
   * Get the frame scope for an action (main page or iframe)
   * Handles automatic frame switching based on action.frameContext
   * @param {Object} action - The action containing potential frameContext
   * @returns {Promise<Frame|Page>} - The page or frame locator to use
   */
  async _getFrameScope(action) {
    // Check for explicit frame context in action
    const frameInfo = action.frameContext || this._currentFrameContext;
    
    if (!frameInfo || !frameInfo.isIframe) {
      return this.page; // Main frame
    }
    
    console.log(`[PlaywrightRecorder] Switching to iframe:`, frameInfo);
    
    try {
      let frameLocator;
      
      // Priority 1: By ID
      if (frameInfo.id) {
        frameLocator = this.page.frameLocator(`#${frameInfo.id}`);
        if (await this._frameExists(frameLocator)) return frameLocator;
      }
      
      // Priority 2: By name
      if (frameInfo.name) {
        frameLocator = this.page.frameLocator(`iframe[name="${frameInfo.name}"]`);
        if (await this._frameExists(frameLocator)) return frameLocator;
      }
      
      // Priority 3: By test-id
      if (frameInfo.testId) {
        frameLocator = this.page.frameLocator(`[data-testid="${frameInfo.testId}"]`);
        if (await this._frameExists(frameLocator)) return frameLocator;
      }
      
      // Priority 4: By selector
      if (frameInfo.selector) {
        frameLocator = this.page.frameLocator(frameInfo.selector);
        if (await this._frameExists(frameLocator)) return frameLocator;
      }
      
      // Priority 5: Try to match by src URL
      if (frameInfo.src) {
        const frames = this.page.frames();
        for (const frame of frames) {
          if (frame.url().includes(frameInfo.src)) {
            // Return a frame locator that targets this specific frame
            // Note: We need to use frameLocator for proper Playwright API
            return this.page.frameLocator(`iframe[src*="${frameInfo.src.split('/').pop()}"]`);
          }
        }
      }
      
      console.warn('[PlaywrightRecorder] Could not find frame, using main page');
      return this.page;
    } catch (e) {
      console.error('[PlaywrightRecorder] Frame switching error:', e.message);
      return this.page;
    }
  }

  /**
   * Check if a frame locator points to an existing frame
   * @param {FrameLocator} frameLocator 
   * @returns {Promise<boolean>}
   */
  async _frameExists(frameLocator) {
    try {
      // Try to find any element in the frame to verify it exists
      const count = await frameLocator.locator('body').count();
      return count > 0;
    } catch (e) {
      return false;
    }
  }

  /**
   * Execute a suggested action or test step
   * Supports: goto, click, fill, select, check, uncheck, press, wait, assertText, assertVisible, assertValue
   * ROBUST VERSION - tries multiple selector strategies like the browser extension
   */
  async executeAction(action) {
    const { executeAction: _executeAction } = require('./recorder-execute-action');
    return _executeAction(this, action);
  }

  /**
   * Execute assertion - validates step assertions defined in the Builder
   * Supports: text_contains, text_equals, element_visible, element_not_visible, url_contains, value_equals
   * 
   * @param {Object} assertion - Assertion object
   * @param {string} [stepSelector] - Fallback selector from the step (for value assertions)
   */
  async executeAssertion(assertion, stepSelector = null) {
    // Delegate to shared assertion handler module (lib/assertion-handlers.js)
    return executeAssertionHandler(this, assertion, stepSelector);
  }

  // ============ PRIVATE METHODS ============
  // NOTE: Legacy assertion code (~416 lines) removed - now in lib/assertion-handlers.js

  /**
   * Get the recorder script to inject
   * This is the EXACT SAME logic as the browser extension
   */
  _getRecorderScript() {
    return getRecorderScript();
  }

  /**
   * Start polling for actions from the page
   * Uses index-based tracking to only process NEW actions
   */
  _startPolling() {
    this._stopPolling();
    
    this.pollInterval = setInterval(async () => {
      if (!this.recording || !this.page || this.page.isClosed()) return;
      if (this.paused) return; // Don't process actions when paused
      
      try {
        // Get action count and only fetch new ones
        const result = await this.page.evaluate(`
          (function() {
            var actions = window.__flowstralActions__ || [];
            return {
              total: actions.length,
              actions: actions
            };
          })()
        `);
        
        if (result && result.total > this.lastProcessedIndex) {
          // Only process actions after the last index we've seen
          const newActions = result.actions.slice(this.lastProcessedIndex);
          const countBefore = this.actions.length;
          this._processNewActions(newActions);
          this.lastProcessedIndex = result.total;
          
          // Update overlay if new actions were added
          if (this.actions.length > countBefore) {
            this._updateOverlay();
          }
        }
      } catch (e) {
        // Page might be navigating
      }
    }, 500); // Slower poll to reduce duplication risk
  }

  /**
   * Stop polling
   */
  _stopPolling() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }

  /**
   * Process only NEW actions (not seen before)
   */
  _processNewActions(newActions) {
    if (!Array.isArray(newActions) || newActions.length === 0) return;
    
    for (const action of newActions) {
      // Skip if action has an ID we've already seen
      if (action.id && this.seenActionIds.has(action.id)) {
        continue;
      }
      
      // Generate a content-based ID for extra deduplication
      const contentId = this._generateActionId(action);
      if (this.seenActionIds.has(contentId)) {
        continue;
      }
      
      // FILTER: Skip actions that are likely misidentified page title clicks
      // This happens when Recipe recorder sees a click but can't identify the element
      const desc = action.description || action.text || '';
      const isMisidentifiedPageTitle = 
        desc.includes('Flowstral Test Playground') || 
        desc.includes('🧪') ||
        (desc.includes('Shopping Cart') && action.type === 'click' && !desc.includes('tab'));
      
      if (isMisidentifiedPageTitle) {
        console.log('[PlaywrightRecorder] Skipping misidentified page title action:', desc);
        continue;
      }
      
      // Mark both IDs as seen
      if (action.id) this.seenActionIds.add(action.id);
      this.seenActionIds.add(contentId);
      
      const qwordAction = this._toQWord(action);
      this._insertByTimestamp(qwordAction);
      this.emit('action', qwordAction);
      
      console.log('[PlaywrightRecorder] Forwarding action to webapp:', qwordAction.description);
    }
  }

  /**
   * Generate a unique ID for an action based on its content
   */
  _generateActionId(action) {
    const type = action.type || '';
    const timestamp = action.timestamp || 0;
    const desc = action.description || '';
    const value = action.value || action.displayValue || '';
    
    // For fill actions, include field identifier
    if (type === 'fill') {
      const fieldKey = action.fieldKey || action.name || action.id || action.placeholder || '';
      return `${type}:${fieldKey}:${value.substring(0, 20)}`;
    }
    
    // For clicks, use description + approximate timestamp (within 1 second)
    if (type === 'click') {
      const timeWindow = Math.floor(timestamp / 1000);
      return `${type}:${desc}:${timeWindow}`;
    }
    
    // For navigation, use URL
    if (type === 'navigate') {
      return `${type}:${action.url || ''}`;
    }
    
    // Default: use type + timestamp
    return `${type}:${timestamp}:${desc}`;
  }

  /**
   * Convert action to QWord format (EXACT SAME as browser extension)
   * (Delegated to recorder-to-qword.js)
   */
  _toQWord(action) {
    const { _toQWord: _toQWordFn } = require('./recorder-to-qword');
    return _toQWordFn(this, action);
  }

  /**
   * Add action directly
   */
  _addAction(action) {
    const qwordAction = this._toQWord(action);
    this._insertByTimestamp(qwordAction);
    this.emit('action', qwordAction);
  }

  /**
   * Insert action at the correct position based on timestamp.
   * Multiple capture paths (recipe, CDP, legacy) can deliver actions
   * out of order. This ensures this.actions stays chronologically sorted.
   * 
   * Fast path: most actions arrive in order → simple push.
   * Slow path: out-of-order → splice into correct position (look back up to 30 actions).
   */
  _insertByTimestamp(action) {
    const ts = action.timestamp || Date.now();
    
    // Fast path: action is newer than the most recent → just push
    if (this.actions.length === 0 || (this.actions[this.actions.length - 1].timestamp || 0) <= ts) {
      this.actions.push(action);
      return;
    }
    
    // Out-of-order: find correct chronological position
    let insertAt = this.actions.length;
    const lookBack = Math.min(30, this.actions.length);
    for (let i = this.actions.length - 1; i >= this.actions.length - lookBack; i--) {
      if ((this.actions[i].timestamp || 0) > ts) {
        insertAt = i;
      } else {
        break;
      }
    }
    
    if (insertAt < this.actions.length) {
      console.log(`[PlaywrightRecorder] Reordering: "${action.description || action.qword}" inserted at position ${insertAt} (${this.actions.length} total)`);
      this.actions.splice(insertAt, 0, action);
      // Emit refresh so frontend can re-render with correct order
      this.emit('actions-reordered', this.actions);
    } else {
      this.actions.push(action);
    }
  }

  /**
   * Check if navigation should be recorded
   * 
   * CRITICAL FIX (Jan 2026): Most navigations are CAUSED by clicks/selects/fills.
   * We should NOT record navigations as separate steps because:
   * 1. The click/select action already represents the user's intent
   * 2. Recording navigation separately causes playback to navigate THEN try to click
   * 3. This breaks Salesforce Lightning where buttons trigger JS navigation (not <a> tags)
   */
  _shouldRecordNavigation(url) {
    if (!url) return false;
    
    // Skip intermediate auth/redirect pages
    const skipPatterns = [
      /\/secur\//i,
      /\/sessionserver/i,
      /\/identity\//i,
      /contentdoor/i,
      /\/auth\//i,
      /\/oauth\//i,
      /callback/i,
      /\/sso\//i,
      /aura\?/i,
      /\/apexpages\//i,
      // Salesforce Lightning internal routes
      /\/lightning\/r\//i,        // Record pages
      /\/lightning\/o\//i,        // Object list pages
      /\/lightning\/page\//i,     // Custom pages
      /\/lightning\/n\//i,        // Named pages
      /filterName=/i,             // List view filter changes
      /\?.*ws=/i,                 // Workspace routing
    ];
    
    if (skipPatterns.some(p => p.test(url))) {
      console.log('[PlaywrightRecorder] Skipping navigation - matches skip pattern:', url.substring(0, 60));
      return false;
    }
    
    // Skip if same as last recorded navigation
    const lastNav = this.actions.filter(a => a.qword === 'GoTo').pop();
    if (lastNav && lastNav.args[0] === url) return false;
    
    // ============================================================
    // CRITICAL FIX: SKIP ALL NAVIGATIONS AFTER ANY INTERACTIVE ACTION
    // If ANY click, select, or fill happened in the last 5 seconds,
    // the navigation is likely a RESULT of that action, not a new action.
    // 
    // In SPAs like Salesforce Lightning, React, Vue, Angular:
    // - Buttons trigger JS navigation (not <a> tags)
    // - Selecting dropdown options can navigate
    // - Form submissions navigate
    // All of these should be represented by the ACTION, not the navigation.
    // ============================================================
    const now = Date.now();
    const NAVIGATION_SUPPRESSION_WINDOW = 5000; // 5 seconds
    
    // CHECK 1: Is an interaction currently being processed?
    // Navigation events can fire BEFORE the click is added to this.actions
    if (this._lastInteractionTimestamp && (now - this._lastInteractionTimestamp) < NAVIGATION_SUPPRESSION_WINDOW) {
      console.log(`[PlaywrightRecorder] Skipping navigation - interaction in progress (${now - this._lastInteractionTimestamp}ms ago):`, url.substring(0, 60));
      return false;
    }
    
    // CHECK 2: Are there recent interactive actions already in the array?
    const recentInteractiveActions = this.actions.filter(a => {
      const isInteractive = 
        a.qword === 'ClickText' || 
        a.qword === 'Click' || 
        a.qword === 'ClickElement' ||
        a.qword === 'Select' ||
        a.qword === 'Fill' ||
        a.type === 'click' ||
        a.type === 'select' ||
        a.type === 'fill';
      
      const isRecent = (now - (a.timestamp || 0)) < NAVIGATION_SUPPRESSION_WINDOW;
      
      return isInteractive && isRecent;
    });
    
    if (recentInteractiveActions.length > 0) {
      const lastAction = recentInteractiveActions[recentInteractiveActions.length - 1];
      const timeSinceAction = now - (lastAction.timestamp || 0);
      console.log(`[PlaywrightRecorder] Skipping navigation - caused by recent ${lastAction.qword || lastAction.type} (${timeSinceAction}ms ago):`, url.substring(0, 60));
      return false;
    }
    
    // ============================================================
    // ALSO SKIP: Same-domain navigations within Salesforce
    // These are always caused by user interactions, not direct navigation
    // ============================================================
    try {
      const navUrl = new URL(url);
      const currentUrl = this.page ? new URL(this.page.url()) : null;
      
      // If navigating within same Salesforce org, skip
      if (currentUrl && navUrl.hostname === currentUrl.hostname) {
        // Check if this is a Lightning page change
        if (url.includes('lightning.force.com') || url.includes('/lightning/')) {
          console.log('[PlaywrightRecorder] Skipping same-org Lightning navigation:', url.substring(0, 60));
          return false;
        }
      }
    } catch (e) {
      // URL parsing failed, continue with other checks
    }
    
    // Only record navigation if it's:
    // 1. A completely new domain
    // 2. More than 5 seconds after any interactive action
    // 3. Not a Salesforce internal route
    console.log('[PlaywrightRecorder] Recording navigation (no recent interactions):', url.substring(0, 60));
    return true;
  }
  
  /**
   * Check if two URLs match (ignoring trailing slashes and minor differences)
   */
  _urlsMatch(url1, url2) {
    if (!url1 || !url2) return false;
    // Normalize: remove trailing slashes, lowercase
    const normalize = (u) => u.replace(/\/$/, '').toLowerCase();
    return normalize(url1) === normalize(url2);
  }
}

module.exports = PlaywrightRecorder;

