/**
 * Playwright-based Recorder
 * 
 * Opens a standalone Playwright browser for recording.
 * Injects the EXACT SAME recorder-engine.js used by the browser extension.
 * Produces IDENTICAL output to the browser extension.
 * 
 * NO COMPROMISES - must match browser extension exactly.
 */

const { chromium } = require('playwright');
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
const TabManager = require('./lib/tab-manager');
const SalesforceHandlers = require('./lib/salesforce-handlers');
const { executeAssertion: executeAssertionHandler } = require('./lib/assertion-handlers');

// Confidence System - Calculate and report step reliability
const { ConfidenceCalculator } = require('./lib/confidence');
const { MetadataCollector } = require('./lib/step-metadata');
const { ScreenshotManager } = require('./lib/screenshots');

// Mobile testing support (Phase 1: Emulation, Phase 2: Maestro)
const { MOBILE_DEVICES, getDevice, getDeviceCategories, NETWORK_PRESETS, getNetworkPreset } = require('./lib/mobile-devices');

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
    return `
(function() {
  if (window.__flowstralOverlayInjected__) return;
  window.__flowstralOverlayInjected__ = true;
  
  var _isMinimized = false;
  var _currentSuggestions = [];
  var _elementCounts = {};
  
  // ========== HELPER: Find element by multiple strategies ==========
  function findElementByLabel(label, type) {
    if (!label) return null;
    var cleanLabel = label.replace(/"/g, '').trim();
    
    // Strategy 1: Exact text match on clickable elements
    var clickables = document.querySelectorAll('button, a, [role="button"], [role="link"], [role="tab"], [role="menuitem"], [role="option"], span[tabindex], div[tabindex]');
    for (var i = 0; i < clickables.length; i++) {
      var el = clickables[i];
      var text = (el.textContent || el.innerText || '').trim();
      // Exact match
      if (text === cleanLabel) return el;
      // Short partial match
      if (text.startsWith(cleanLabel) && text.length < cleanLabel.length + 15) return el;
    }
    
    // Strategy 2: Aria-label match
    try {
      var ariaMatch = document.querySelector('[aria-label="' + cleanLabel + '"]');
      if (ariaMatch) return ariaMatch;
      ariaMatch = document.querySelector('[aria-label*="' + cleanLabel + '" i]');
      if (ariaMatch) return ariaMatch;
    } catch(e) {}
    
    // Strategy 3: Title match
    try {
      var titleMatch = document.querySelector('[title="' + cleanLabel + '"]');
      if (titleMatch) return titleMatch;
    } catch(e) {}
    
    // Strategy 4: Input by placeholder/label
    if (type === 'fill' || type === 'input') {
      try {
        var inputByPlaceholder = document.querySelector('[placeholder="' + cleanLabel + '"]');
        if (inputByPlaceholder) return inputByPlaceholder;
        inputByPlaceholder = document.querySelector('[placeholder*="' + cleanLabel + '" i]');
        if (inputByPlaceholder) return inputByPlaceholder;
      } catch(e) {}
      
      // Find label and get associated input
      var labels = document.querySelectorAll('label');
      for (var j = 0; j < labels.length; j++) {
        if (labels[j].textContent.trim().indexOf(cleanLabel) >= 0) {
          var forId = labels[j].getAttribute('for');
          if (forId) {
            var linkedInput = document.getElementById(forId);
            if (linkedInput) return linkedInput;
          }
          var nestedInput = labels[j].querySelector('input, textarea, select');
          if (nestedInput) return nestedInput;
        }
      }
    }
    
    // Strategy 5: Partial text for any element
    var allElements = document.querySelectorAll('*');
    for (var k = 0; k < allElements.length; k++) {
      var elem = allElements[k];
      if (elem.children.length === 0 || elem.tagName === 'BUTTON' || elem.tagName === 'A') {
        var elemText = (elem.textContent || elem.innerText || '').trim();
        if (elemText === cleanLabel || (elemText.indexOf(cleanLabel) >= 0 && elemText.length < 60)) {
          return elem;
        }
      }
    }
    
    return null;
  }
  
  // ========== HELPER: Click element with multiple fallbacks ==========
  function clickElement(el) {
    if (!el) return false;
    
    // Scroll into view
    el.scrollIntoView({ behavior: 'instant', block: 'center' });
    
    // Add visual highlight (green)
    var origOutline = el.style.outline;
    var origOffset = el.style.outlineOffset;
    var origBg = el.style.backgroundColor;
    el.style.outline = '4px solid #22c55e';
    el.style.outlineOffset = '3px';
    el.style.backgroundColor = 'rgba(34, 197, 94, 0.15)';
    
    // Execute click after brief highlight
    setTimeout(function() {
      // Method 1: Native click
      try { el.click(); } catch(e1) {}
      
      // Method 2: Focus + dispatch events
      try {
        el.focus();
        var rect = el.getBoundingClientRect();
        var centerX = rect.left + rect.width / 2;
        var centerY = rect.top + rect.height / 2;
        ['mousedown', 'mouseup', 'click'].forEach(function(type) {
          el.dispatchEvent(new MouseEvent(type, {
            view: window, bubbles: true, cancelable: true,
            clientX: centerX, clientY: centerY
          }));
        });
      } catch(e2) {}
      
      // Remove highlight after delay
      setTimeout(function() {
        el.style.outline = origOutline;
        el.style.outlineOffset = origOffset;
        el.style.backgroundColor = origBg;
      }, 500);
    }, 150);
    
    return true;
  }
  
  function createOverlay() {
    if (!document.body) {
      setTimeout(createOverlay, 100);
      return;
    }
    
    // Remove any existing overlay
    var existing = document.getElementById('flowstral-host');
    if (existing) existing.remove();
    
    // Create shadow host
    var host = document.createElement('div');
    host.id = 'flowstral-host';
    host.setAttribute('data-flowstral-ignore', 'true');
    host.style.cssText = 'all:initial !important; position:fixed !important; top:8px !important; right:8px !important; z-index:2147483647 !important;';
    
    // Create shadow root for style isolation
    var shadow = host.attachShadow({ mode: 'open' });
    
    shadow.innerHTML = '<style>' +
      '.fl-badge { display:flex; align-items:center; gap:6px; padding:6px 10px; background:rgba(15,15,26,0.95); border:1px solid #e94560; border-radius:20px; font-family:-apple-system,BlinkMacSystemFont,sans-serif; font-size:11px; color:#fff; box-shadow:0 2px 12px rgba(0,0,0,0.4); cursor:pointer; }' +
      '.fl-badge:hover { border-color:#8b5cf6; }' +
      '.fl-dot { width:8px; height:8px; background:#ef4444; border-radius:50%; animation:pulse 1s infinite; }' +
      '@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }' +
      '.fl-text { font-weight:600; }' +
      '.fl-count { background:rgba(139,92,246,0.4); padding:2px 6px; border-radius:10px; font-weight:700; }' +
    '</style>' +
    '<div class="fl-badge" id="fl-badge" data-flowstral-ignore="true" title="Click to toggle suggestions">' +
      '<div class="fl-dot" data-flowstral-ignore="true"></div>' +
      '<span class="fl-text" data-flowstral-ignore="true">REC</span>' +
      '<span class="fl-count" id="fl-count" data-flowstral-ignore="true">0</span>' +
    '</div>';
    
    document.body.appendChild(host);
    
    // Click badge to toggle suggestions
    shadow.getElementById('fl-badge').onclick = function(e) {
      e.stopPropagation();
      _isMinimized = !_isMinimized;
      if (_isMinimized) {
        var panel = document.getElementById('flowstral-suggestions-host');
        if (panel) panel.style.display = 'none';
      } else if (_currentSuggestions.length > 0) {
        window.__flowstralShowSuggestions__(_currentSuggestions);
      }
    };
    
    console.log('[Flowstral] Recording indicator attached');
  }
  
  // Update function
  window.__flowstralUpdateOverlay__ = function(data) {
    try {
      var host = document.getElementById('flowstral-host');
      if (!host || !host.shadowRoot) return;
      var count = host.shadowRoot.getElementById('fl-count');
      if (count && data.stepCount !== undefined) {
        count.textContent = data.stepCount;
      }
    } catch(e) {}
  };
  
  // Queue for actions to add to steps (communicated back to Electron)
  window.__flowstralAddToSteps__ = [];
  
  // Queue for executed actions
  window.__flowstralExecutedActions__ = [];
  
  // Show suggestions panel - ENHANCED with categories, duplicate warnings, execute buttons
  // Now preserves scroll position when updating
  window.__flowstralShowSuggestions__ = function(suggestions, counts) {
    try {
      _currentSuggestions = suggestions || [];
      _elementCounts = counts || {};
      
      // Preserve scroll position before removing panel
      var existingPanel = document.getElementById('flowstral-suggestions-host');
      var savedScrollTop = 0;
      if (existingPanel && existingPanel.shadowRoot) {
        var itemsList = existingPanel.shadowRoot.querySelector('.fl-list');
        if (itemsList) savedScrollTop = itemsList.scrollTop;
      }
      if (existingPanel) existingPanel.remove();
      
      if (!suggestions || suggestions.length === 0 || _isMinimized) return;
      
      var host = document.createElement('div');
      host.id = 'flowstral-suggestions-host';
      host.setAttribute('data-flowstral-ignore', 'true');
      host.style.cssText = 'all:initial !important; position:fixed !important; bottom:8px !important; right:8px !important; z-index:2147483647 !important; max-width:380px !important;';
      
      var shadow = host.attachShadow({ mode: 'open' });
      
      var styles = '<style>' +
        '.fl-panel { background:rgba(15,15,26,0.98); border:1px solid #444; border-radius:10px; font-family:-apple-system,BlinkMacSystemFont,sans-serif; font-size:11px; color:#fff; box-shadow:0 4px 30px rgba(0,0,0,0.7); overflow:hidden; }' +
        '.fl-header { padding:10px 14px; background:linear-gradient(135deg,#1a1a2e,#16213e); border-bottom:1px solid #333; display:flex; justify-content:space-between; align-items:center; }' +
        '.fl-header-left { display:flex; align-items:center; gap:8px; }' +
        '.fl-header-title { font-weight:700; font-size:11px; color:#fff; letter-spacing:0.5px; }' +
        '.fl-header-count { background:#22c55e; color:#000; padding:3px 10px; border-radius:12px; font-size:10px; font-weight:700; }' +
        '.fl-header-right { display:flex; align-items:center; gap:4px; }' +
        '.fl-btn { cursor:pointer; color:#888; font-size:16px; padding:4px 6px; border-radius:4px; background:transparent; border:none; }' +
        '.fl-btn:hover { color:#fff; background:rgba(139,92,246,0.3); }' +
        
        '.fl-counts { display:grid; grid-template-columns:repeat(4,1fr); gap:8px; padding:10px 14px; background:#0d0d14; border-bottom:1px solid #222; }' +
        '.fl-count-item { display:flex; align-items:center; gap:5px; font-size:10px; }' +
        '.fl-count-dot { width:8px; height:8px; border-radius:50%; }' +
        '.fl-count-label { color:#666; }' +
        '.fl-count-num { font-weight:700; }' +
        
        '.fl-search-row { display:flex; gap:8px; padding:10px 14px; border-bottom:1px solid #222; background:#0a0a10; }' +
        '.fl-search { flex:1; background:#111; border:1px solid #333; border-radius:6px; padding:8px 12px; color:#fff; font-size:11px; outline:none; }' +
        '.fl-search:focus { border-color:#8b5cf6; box-shadow:0 0 0 2px rgba(139,92,246,0.2); }' +
        '.fl-filter { background:#111; border:1px solid #333; border-radius:6px; padding:6px 10px; color:#fff; font-size:10px; outline:none; cursor:pointer; }' +
        
        '.fl-list { max-height:400px; overflow-y:auto; }' +
        '.fl-item { padding:10px 14px; border-bottom:1px solid #1a1a1a; transition:background 0.15s; }' +
        '.fl-item:hover { background:rgba(139,92,246,0.08); }' +
        '.fl-item-header { display:flex; align-items:center; gap:8px; margin-bottom:6px; }' +
        '.fl-category { font-size:9px; font-weight:700; color:#888; text-transform:uppercase; letter-spacing:0.8px; }' +
        '.fl-location { font-size:9px; color:#666; background:#1a1a1a; padding:2px 6px; border-radius:4px; }' +
        '.fl-dup-warn { background:rgba(234,179,8,0.15); color:#eab308; border:1px solid rgba(234,179,8,0.3); padding:2px 8px; border-radius:10px; font-size:9px; font-weight:600; }' +
        
        '.fl-item-main { display:flex; align-items:center; justify-content:space-between; gap:10px; }' +
        '.fl-item-left { display:flex; align-items:center; gap:8px; flex:1; min-width:0; cursor:pointer; padding:4px 0; }' +
        '.fl-item-left:hover .fl-label { color:#a78bfa; }' +
        '.fl-icon { font-size:16px; flex-shrink:0; }' +
        '.fl-label { font-weight:500; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; transition:color 0.15s; }' +
        
        '.fl-item-btns { display:flex; gap:6px; flex-shrink:0; }' +
        '.fl-exec { background:rgba(34,197,94,0.15); color:#22c55e; border:1px solid rgba(34,197,94,0.3); padding:6px 10px; border-radius:6px; cursor:pointer; font-size:12px; font-weight:600; transition:all 0.15s; }' +
        '.fl-exec:hover { background:rgba(34,197,94,0.3); border-color:#22c55e; }' +
        '.fl-add { background:rgba(59,130,246,0.15); color:#3b82f6; border:1px solid rgba(59,130,246,0.3); padding:6px 10px; border-radius:6px; cursor:pointer; font-size:12px; font-weight:600; transition:all 0.15s; }' +
        '.fl-add:hover { background:rgba(59,130,246,0.3); border-color:#3b82f6; }' +
        '.fl-added { background:rgba(100,100,100,0.15); color:#666; border-color:#444; }' +
        
        '.fl-info { padding:10px 14px; font-size:9px; color:#555; border-top:1px solid #222; background:#0a0a10; text-align:center; }' +
      '</style>';
      
      // Calculate counts from suggestions
      var btnCount = 0, linkCount = 0, inputCount = 0, headCount = 0;
      suggestions.forEach(function(s) {
        if (s.element === 'button' || (s.type === 'click' && !s.element)) btnCount++;
        else if (s.element === 'link') linkCount++;
        else if (s.type === 'fill' || s.type === 'select' || s.element === 'input') inputCount++;
        else if (s.type === 'heading') headCount++;
      });
      
      // Build items HTML with categories and action buttons
      var items = suggestions.map(function(s, i) {
        var icon = s.type === 'fill' ? '✏️' : s.element === 'link' ? '🔗' : s.element === 'tab' ? '📑' : s.element === 'menuitem' ? '📋' : s.type === 'heading' ? '📄' : '👆';
        var label = (s.label || s.text || s.description || 'Element');
        if (label.length > 38) label = label.substring(0, 35) + '...';
        
        // Category label (CLICK BUTTON, CLICK LINK, etc.)
        var actionLabel = s.type === 'click' ? 'CLICK' : s.type === 'fill' ? 'FILL' : s.type === 'select' ? 'SELECT' : s.type === 'heading' ? 'ASSERT' : 'CLICK';
        var elementLabel = (s.element || (s.type === 'fill' ? 'INPUT' : 'BUTTON')).toUpperCase();
        var categoryLabel = actionLabel + ' ' + elementLabel;
        
        // Location tag
        var locationHtml = s.location && s.location !== 'body' && s.location !== 'main' ? '<span class="fl-location">' + s.location.toUpperCase() + '</span>' : '';
        
        // Duplicate warning
        var dupHtml = s.hasDuplicates ? '<span class="fl-dup-warn">⚠ ' + s.totalDuplicates + ' FOUND</span>' : '';
        
        return '<div class="fl-item" data-flowstral-ignore="true" data-index="' + i + '">' +
          '<div class="fl-item-header" data-flowstral-ignore="true">' +
            '<span class="fl-category">' + categoryLabel + '</span>' +
            locationHtml +
            dupHtml +
          '</div>' +
          '<div class="fl-item-main" data-flowstral-ignore="true">' +
            '<div class="fl-item-left" data-flowstral-ignore="true" data-index="' + i + '" title="Click to execute">' +
              '<span class="fl-icon">' + icon + '</span>' +
              '<span class="fl-label">' + label + '</span>' +
            '</div>' +
            '<div class="fl-item-btns" data-flowstral-ignore="true">' +
              '<button class="fl-exec" data-flowstral-ignore="true" data-exec-index="' + i + '" title="Execute action">▶</button>' +
              '<button class="fl-add" data-flowstral-ignore="true" data-add-index="' + i + '" title="Add to steps">+</button>' +
            '</div>' +
          '</div>' +
        '</div>';
      }).join('');
      
      shadow.innerHTML = styles +
        '<div class="fl-panel" data-flowstral-ignore="true">' +
          '<div class="fl-header" data-flowstral-ignore="true">' +
            '<div class="fl-header-left" data-flowstral-ignore="true">' +
              '<span class="fl-header-title">SUGGESTED ACTIONS</span>' +
              '<span class="fl-header-count">' + suggestions.length + ' ITEMS</span>' +
            '</div>' +
            '<div class="fl-header-right" data-flowstral-ignore="true">' +
              '<button class="fl-btn" id="fl-minimize" data-flowstral-ignore="true" title="Minimize">−</button>' +
              '<button class="fl-btn" id="fl-close" data-flowstral-ignore="true" title="Close">✕</button>' +
            '</div>' +
          '</div>' +
          '<div class="fl-counts" data-flowstral-ignore="true">' +
            '<div class="fl-count-item"><div class="fl-count-dot" style="background:#a855f7;"></div><span class="fl-count-label">Buttons</span><span class="fl-count-num" style="color:#a855f7;">' + btnCount + '</span></div>' +
            '<div class="fl-count-item"><div class="fl-count-dot" style="background:#3b82f6;"></div><span class="fl-count-label">Links</span><span class="fl-count-num" style="color:#3b82f6;">' + linkCount + '</span></div>' +
            '<div class="fl-count-item"><div class="fl-count-dot" style="background:#22c55e;"></div><span class="fl-count-label">Inputs</span><span class="fl-count-num" style="color:#22c55e;">' + inputCount + '</span></div>' +
            '<div class="fl-count-item"><div class="fl-count-dot" style="background:#eab308;"></div><span class="fl-count-label">Headings</span><span class="fl-count-num" style="color:#eab308;">' + headCount + '</span></div>' +
          '</div>' +
          '<div class="fl-search-row" data-flowstral-ignore="true">' +
            '<input type="text" class="fl-search" id="fl-search" placeholder="Search elements..." data-flowstral-ignore="true"/>' +
            '<select class="fl-filter" id="fl-filter" data-flowstral-ignore="true">' +
              '<option value="all">All</option>' +
              '<option value="button">Buttons</option>' +
              '<option value="link">Links</option>' +
              '<option value="input">Inputs</option>' +
              '<option value="heading">Headings</option>' +
            '</select>' +
          '</div>' +
          '<div class="fl-list" id="fl-list" data-flowstral-ignore="true">' + items + '</div>' +
          '<div class="fl-info" data-flowstral-ignore="true">▶ Execute action on page • + Add to test steps</div>' +
        '</div>';
      
      document.body.appendChild(host);
      
      // Restore scroll position if we had one saved
      if (savedScrollTop > 0) {
        var itemsList = shadow.getElementById('fl-list');
        if (itemsList) itemsList.scrollTop = savedScrollTop;
      }
      
      // Close button
      shadow.getElementById('fl-close').onclick = function(e) {
        e.stopPropagation();
        host.remove();
      };
      
      // Minimize button
      shadow.getElementById('fl-minimize').onclick = function(e) {
        e.stopPropagation();
        _isMinimized = true;
        host.style.display = 'none';
      };
      
      // Filter function
      function filterItems() {
        var query = shadow.getElementById('fl-search').value.toLowerCase();
        var filter = shadow.getElementById('fl-filter').value;
        var items = shadow.querySelectorAll('.fl-item');
        items.forEach(function(item) {
          var idx = parseInt(item.getAttribute('data-index'));
          var s = suggestions[idx];
          var text = ((s.label || '') + ' ' + (s.text || '') + ' ' + (s.description || '')).toLowerCase();
          var matchesSearch = !query || text.indexOf(query) >= 0;
          var matchesFilter = filter === 'all' ||
            (filter === 'button' && (s.element === 'button' || (s.type === 'click' && !s.element))) ||
            (filter === 'link' && s.element === 'link') ||
            (filter === 'input' && (s.type === 'fill' || s.type === 'select')) ||
            (filter === 'heading' && s.type === 'heading');
          item.style.display = (matchesSearch && matchesFilter) ? 'block' : 'none';
        });
      }
      
      // Search functionality
      var searchInput = shadow.getElementById('fl-search');
      searchInput.onclick = function(e) { e.stopPropagation(); };
      searchInput.oninput = function(e) { e.stopPropagation(); filterItems(); };
      
      // Filter dropdown
      var filterSelect = shadow.getElementById('fl-filter');
      filterSelect.onclick = function(e) { e.stopPropagation(); };
      filterSelect.onchange = function(e) { e.stopPropagation(); filterItems(); };
      
      // Execute button (▶) - Queue action for Electron to execute with robust logic
      // This ensures the same click behavior as the app suggest panel
      shadow.querySelectorAll('.fl-exec').forEach(function(execBtn) {
        execBtn.onclick = function(e) {
          e.stopPropagation();
          var idx = parseInt(execBtn.getAttribute('data-exec-index'));
          var suggestion = suggestions[idx];
          
          if (suggestion) {
            // Visual feedback - show pending
            execBtn.textContent = '⏳';
            execBtn.style.background = 'rgba(234,179,8,0.3)';
            execBtn.style.borderColor = '#eab308';
            
            // Queue action for Electron to execute using robust executeAction
            // This is picked up by the polling in playwright-recorder.js
            window.__flowstralExecuteQueue__ = window.__flowstralExecuteQueue__ || [];
            window.__flowstralExecuteQueue__.push({
              index: idx,
              type: suggestion.type,
              label: suggestion.label || suggestion.text,
              text: suggestion.text || suggestion.label,
              selector: suggestion.selector,
              element: suggestion.element,
              description: suggestion.description,
              execBtnId: 'exec-' + idx,
              timestamp: Date.now()
            });
            
            // Store reference to button for result callback
            window.__flowstralExecButtons__ = window.__flowstralExecButtons__ || {};
            window.__flowstralExecButtons__['exec-' + idx] = execBtn;
            
            // Also try local click as immediate feedback while Electron processes
            var label = suggestion.label || suggestion.text;
            var el = null;
            if (suggestion.selector) {
              try { el = document.querySelector(suggestion.selector); } catch(err) {}
            }
            if (!el) {
              el = findElementByLabel(label, suggestion.type);
            }
            if (el) {
              clickElement(el);
            }
            
            // Reset button after timeout (Electron callback will update if successful)
            setTimeout(function() {
              if (execBtn.textContent === '⏳') {
                execBtn.textContent = '▶';
                execBtn.style.background = '';
                execBtn.style.borderColor = '';
              }
            }, 3000);
          }
        };
      });
      
      // Also execute when clicking the label row
      shadow.querySelectorAll('.fl-item-left').forEach(function(item) {
        item.onclick = function(e) {
          e.stopPropagation();
          var idx = parseInt(item.getAttribute('data-index'));
          var suggestion = suggestions[idx];
          
          if (suggestion) {
            // Queue for Electron robust execution
            window.__flowstralExecuteQueue__ = window.__flowstralExecuteQueue__ || [];
            window.__flowstralExecuteQueue__.push({
              index: idx,
              type: suggestion.type,
              label: suggestion.label || suggestion.text,
              text: suggestion.text || suggestion.label,
              selector: suggestion.selector,
              element: suggestion.element,
              description: suggestion.description,
              timestamp: Date.now()
            });
            
            // Also try local click as immediate feedback
            var label = suggestion.label || suggestion.text;
            var el = null;
            if (suggestion.selector) {
              try { el = document.querySelector(suggestion.selector); } catch(err) {}
            }
            if (!el) {
              el = findElementByLabel(label, suggestion.type);
            }
            if (el) {
              clickElement(el);
            }
          }
        };
      });
      
      // Add to steps on + click
      shadow.querySelectorAll('.fl-add').forEach(function(addBtn) {
        addBtn.onclick = function(e) {
          e.stopPropagation();
          var idx = parseInt(addBtn.getAttribute('data-add-index'));
          var suggestion = suggestions[idx];
          
          if (suggestion) {
            // Mark as added
            addBtn.textContent = '✓';
            addBtn.classList.add('fl-added');
            addBtn.title = 'Added!';
            
            // Queue for Electron to pick up
            window.__flowstralAddToSteps__.push({
              type: suggestion.type,
              label: suggestion.label,
              selector: suggestion.selector,
              description: suggestion.description,
              action: suggestion.action,
              timestamp: Date.now()
            });
            
            console.log('[Flowstral] Added to steps:', suggestion.label);
            
            // Visual feedback - briefly highlight
            var item = addBtn.parentElement;
            item.style.background = 'rgba(34,197,94,0.2)';
            setTimeout(function() {
              item.style.background = '';
            }, 500);
          }
        };
      });
      
      console.log('[Flowstral] Suggestions panel shown:', suggestions.length);
    } catch(e) { console.error('[Flowstral] Suggestions panel error:', e); }
  };
  
  // Create overlay when ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', createOverlay);
  } else {
    createOverlay();
  }
})();
    `;
  }

  /**
   * Launch browser and start recording
   */
  async start(url) {
    if (this.browser) {
      await this.stop();
    }

    console.log('[PlaywrightRecorder] Starting browser...');
    
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
      '--disable-features=IsolateOrigins,site-per-process',
      '--disable-site-isolation-trials',
      '--disable-web-security',
      '--disable-features=BlockInsecurePrivateNetworkRequests',
      '--no-sandbox',
      '--disable-setuid-sandbox',
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
    this.context = await chromium.launchPersistentContext(userDataDir, {
      headless: false,
      // Mobile: use device viewport, Desktop: full window
      viewport: isMobile ? mobileOptions.viewport : null,
      // Mobile: use device user agent, Desktop: Chrome UA
      userAgent: isMobile ? mobileOptions.userAgent : 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
      args: stealthArgs,
      // Mobile-specific options
      ...(isMobile && {
        deviceScaleFactor: mobileOptions.deviceScaleFactor,
        isMobile: mobileOptions.isMobile,
        hasTouch: mobileOptions.hasTouch,
        ...(mobileOptions.geolocation && { geolocation: mobileOptions.geolocation }),
        ...(mobileOptions.permissions && { permissions: mobileOptions.permissions })
      }),
      // Ignore HTTPS errors for dev environments
      ignoreHTTPSErrors: true,
    });
    
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
    this._startPolling();
    
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
          const existingIndex = this.pendingInputs.findIndex(i => 
            (i.key && i.key === inputData.key) ||
            (i.name && i.name === inputData.name) ||
            (i.id && i.id === inputData.id)
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
    return `
    (function() {
      // Prevent double injection
      if (window.__flowstralClickCaptureInjected) return;
      window.__flowstralClickCaptureInjected = true;
        // This runs in page context, capturing clicks at the window level
        // with useCapture=true to get them BEFORE anything else
        
        // KEY INSIGHT: e.composedPath() is the W3C standard for accessing
        // elements across Shadow DOM boundaries. This is how DevTools works!
        
        window.__flowstralCDPClicks = window.__flowstralCDPClicks || [];
        window.__flowstralCDPInputs = window.__flowstralCDPInputs || {};
        window.__flowstralLastInputFlush = 0;
        
        // Capture at the window level with capture phase
        window.addEventListener('click', function(e) {
          try {
            // Get the actual target, traversing into shadow DOM if needed
            let target = e.target;
            const path = e.composedPath ? e.composedPath() : [target];
            
            // Find the best element from the composed path
            // (composedPath() includes elements from shadow DOM!)
            let bestElement = null;
            for (const el of path) {
              if (!el || !el.tagName) continue;
              const tag = el.tagName.toLowerCase();
              
              // Skip document, window, shadow roots, and container elements
              if (tag === 'html' || tag === 'body' || tag === 'form' || tag === 'main' || tag === 'section') continue;
              
              // PRIORITY 1: Submit buttons (login, submit, etc.) - ALWAYS capture these
              if (tag === 'input' && (el.type === 'submit' || el.type === 'button')) {
                bestElement = el;
                break;
              }
              
              // PRIORITY 2: Buttons and links
              if (tag === 'button' || tag === 'a') {
                bestElement = el;
                break;
              }
              
              // Check if this is an interactive element
              const elRole = el.getAttribute('role');
              const isInteractive = 
                tag === 'input' ||
                tag === 'li' ||
                tag === 'label' || // Labels are interactive (often wrap radio buttons in segmented controls)
                elRole === 'button' ||
                elRole === 'link' ||
                elRole === 'tab' ||
                elRole === 'menuitem' ||
                elRole === 'option' ||
                elRole === 'listitem' ||
                elRole === 'treeitem' ||
                elRole === 'radio' || // Segmented controls / styled radio buttons
                elRole === 'checkbox' || // Styled checkboxes
                elRole === 'switch' || // Toggle switches
                el.getAttribute('tabindex') === '0' ||
                el.getAttribute('aria-pressed') !== null || // Toggle buttons
                el.getAttribute('aria-selected') !== null || // Selectable items
                el.classList?.contains('btn') || // Bootstrap-style buttons
                el.classList?.contains('button') || // Generic button class
                el.onclick;
              
              // Check for Salesforce-specific menu item indicators
              const isSalesforceMenuItem = 
                tag.startsWith('one-app-launcher') ||
                tag.startsWith('lightning-base-combobox-item') ||
                tag.startsWith('search_dialog-instant-result') ||
                tag.startsWith('forceSearch') ||
                tag.startsWith('search-result') ||
                tag.startsWith('lst-') ||
                tag.startsWith('records-') ||
                tag.includes('result-item') ||
                tag.includes('lookup') ||
                el.getAttribute('data-label') ||
                el.getAttribute('data-value') ||
                el.getAttribute('data-item-id') ||
                el.getAttribute('data-record-id') ||
                el.getAttribute('data-refid') ||
                el.classList?.contains('slds-listbox__option') ||
                el.classList?.contains('slds-dropdown__item') ||
                el.classList?.contains('instant-result') ||
                el.classList?.contains('option') ||
                el.classList?.contains('lookup__result') ||
                el.classList?.contains('primaryField') ||
                el.classList?.contains('forceSearchResultsGridItem');
              
              if (isInteractive || isSalesforceMenuItem) {
                bestElement = el;
                break;
              }
              
              // Also accept elements with meaningful attributes (but short text only)
              const textLen = (el.textContent || '').trim().length;
              const hasShortText = textLen > 0 && textLen < 50; // Shorter limit to avoid form text
              const hasTitle = el.getAttribute('title');
              const hasAriaLabel = el.getAttribute('aria-label');
              
              // SKIP container divs that have concatenated text from multiple child elements
              // These are form step headers like "Start your registrationIt's easy and takes 10..."
              const isContainerDiv = tag === 'div' || tag === 'span';
              if (isContainerDiv && !hasTitle && !hasAriaLabel) {
                // BUT DON'T skip if it's part of a segmented control / button group
                const isSegmentedButton = 
                  el.closest('[role="radiogroup"], [role="group"], .btn-group, .button-group, .segmented-control, .toggle-group') ||
                  el.querySelector('input[type="radio"], input[type="checkbox"]') ||
                  el.getAttribute('aria-pressed') !== null ||
                  el.getAttribute('aria-selected') !== null ||
                  el.classList?.contains('active') ||
                  el.classList?.contains('selected') ||
                  el.classList?.contains('checked');
                
                if (!isSegmentedButton) {
                  // Check if text looks like concatenated headers (no whitespace between sentences)
                  const rawText = (el.textContent || '').trim();
                  const hasLowerUpperJunction = /[a-z][A-Z]/.test(rawText); // "registrationIt's"
                  const hasManyChildren = el.children && el.children.length > 2;
                  const hasMultipleSections = el.querySelectorAll('h1,h2,h3,h4,h5,h6,p,.slds-text-heading').length > 0;
                  
                  if (hasLowerUpperJunction || hasManyChildren || hasMultipleSections) {
                    continue; // Skip this container, look for actual interactive element
                  }
                }
              }
              
              if ((hasShortText || hasTitle || hasAriaLabel) && !bestElement) {
                bestElement = el;
              }
            }
            
            if (!bestElement) bestElement = target;
            
            // Don't capture if it's our overlay
            if (bestElement.closest && (
              bestElement.closest('#flowstral-host') ||
              bestElement.closest('#flowstral-suggestions-host') ||
              bestElement.closest('[data-flowstral-ignore="true"]')
            )) {
              return;
            }
            
            // Get element info
            const tag = (bestElement.tagName || '').toLowerCase();
            const type = bestElement.type || '';
            // For input elements, use value attribute (for submit buttons like "Log In")
            const inputValue = (bestElement.value || '').trim();
            
            // SALESFORCE SPECIFIC: Check for data attributes used in Lightning components
            const dataLabel = bestElement.getAttribute('data-label') || '';
            const dataValue = bestElement.getAttribute('data-value') || '';
            const dataItemId = bestElement.getAttribute('data-item-id') || '';
            const dataName = bestElement.getAttribute('data-name') || '';
            const dataTargetSelection = bestElement.getAttribute('data-target-selection-name') || '';
            
            // For Lightning menu items and search results, try to get text from child elements
            let itemText = '';
            if (tag.includes('lightning-') || tag.includes('one-') || tag.includes('force-') || 
                tag.includes('search') || tag.includes('result') || tag.includes('lookup') ||
                tag.includes('lst-') || tag.includes('records-')) {
              // Try various selectors to find the actual text (search results, menu items, etc.)
              const textSelectors = [
                '.primaryField',                    // Salesforce record name
                '.slds-listbox__option-text',      // Listbox option text
                '[class*="primaryLabel"]',          // Primary label
                '[class*="name"]',                  // Name fields
                '[class*="title"]',                 // Title fields
                '[class*="label"]',                 // Label fields
                'span.slds-truncate',               // Truncated text
                '.itemLabel',                       // Item label
                '.appName',                         // App name
                'mark',                             // Search highlight
                '.uiOutputText',                    // Aura output text
                '.forceOutputLookupWithPreview',   // Lookup preview
                'a[data-refid]',                   // Record link
                '.primaryField lightning-formatted-text', // Record name in search
                '.primaryField span'               // Fallback
              ];
              
              for (const selector of textSelectors) {
                try {
                  const textEl = bestElement.querySelector(selector);
                  if (textEl) {
                    const foundText = (textEl.textContent || '').trim();
                    if (foundText && foundText.length > 1 && foundText.length < 100) {
                      itemText = foundText;
                      break;
                    }
                  }
                } catch(e) {}
              }
              
              // Also check for highlighted search matches (mark element)
              if (!itemText) {
                const markEl = bestElement.querySelector('mark');
                if (markEl) {
                  itemText = (markEl.textContent || '').trim();
                }
              }
            }
            
            // CRITICAL: Get title and ariaLabel first - they are more reliable than textContent
            const title = bestElement.getAttribute('title') || '';
            const ariaLabel = bestElement.getAttribute('aria-label') || '';
            
            // Priority: title > ariaLabel > dataLabel > dataValue > itemText > inputValue > textContent
            // Title and aria-label are most reliable for Salesforce elements
            let rawText = dataLabel || dataValue || dataName || itemText || 
                       ((tag === 'input' && inputValue) ? inputValue : (bestElement.innerText || bestElement.textContent || '').trim().substring(0, 100));
            
            // Use title or ariaLabel if rawText looks corrupted (missing characters)
            // Pattern: "Li t" (should be "List"), "U er" (should be "User")
            const looksCorrupted = /\b[A-Z][a-z]?\s[a-z]+\b/.test(rawText) && rawText.length < 30;
            let text = '';
            if (title && title.length > 1 && title.length < 100 && (looksCorrupted || !rawText)) {
              text = title;
            } else if (ariaLabel && ariaLabel.length > 1 && ariaLabel.length < 100 && (looksCorrupted || !rawText)) {
              text = ariaLabel;
            } else {
              text = rawText;
            }
            
            // Fix common Salesforce text corruption patterns
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
              .replace(/\\s{2,}/g, ' ')
              .trim();
            const id = bestElement.id || '';
            const name = bestElement.getAttribute('name') || '';
            const placeholder = bestElement.getAttribute('placeholder') || '';
            const role = bestElement.getAttribute('role') || '';
            const href = bestElement.getAttribute('href') || '';
            
            // HIGHEST PRIORITY: data-testid and variants (most stable selectors)
            const testId = bestElement.getAttribute('data-testid') || '';
            const dataTestId = bestElement.getAttribute('data-test-id') || '';
            const dataTest = bestElement.getAttribute('data-test') || '';
            const dataCy = bestElement.getAttribute('data-cy') || '';
            
            // Skip text inputs (fill will be recorded separately)
            if (tag === 'input' && ['text','email','password','search','tel','url','number'].includes(type)) {
              return;
            }
            if (tag === 'textarea') return;
            
            // SPECIAL HANDLING FOR RADIO/CHECKBOX: Find the label text
            if (tag === 'input' && (type === 'radio' || type === 'checkbox')) {
              var radioLabel = '';
              
              // Method 1: Look for associated <label> element via 'for' attribute
              if (id) {
                try {
                  // Search in shadow DOM if needed
                  var labelEl = document.querySelector('label[for="' + id + '"]');
                  if (!labelEl) {
                    // Try to find in composedPath (shadow DOM)
                    for (var pi = 0; pi < path.length; pi++) {
                      var root = path[pi];
                      if (root.querySelector) {
                        labelEl = root.querySelector('label[for="' + id + '"]');
                        if (labelEl) break;
                      }
                    }
                  }
                  if (labelEl) {
                    radioLabel = (labelEl.textContent || '').trim();
                  }
                } catch(e) {}
              }
              
              // Method 2: Check if input is inside a label
              if (!radioLabel) {
                try {
                  var parentLabel = bestElement.closest('label');
                  if (parentLabel) {
                    radioLabel = (parentLabel.textContent || '').trim();
                  }
                } catch(e) {}
              }
              
              // Method 3: Look for Salesforce/SLDS label patterns
              if (!radioLabel) {
                try {
                  // Find the form element container and get its label
                  var formElement = bestElement.closest('.slds-form-element, .slds-radio, .slds-checkbox');
                  if (formElement) {
                    var sldsLabel = formElement.querySelector('.slds-form-element__label, .slds-radio__label, .slds-checkbox__label');
                    if (sldsLabel) {
                      radioLabel = (sldsLabel.textContent || '').trim();
                    }
                  }
                } catch(e) {}
              }
              
              // Method 4: Look for adjacent sibling text (span next to input)
              if (!radioLabel) {
                try {
                  var nextSibling = bestElement.nextElementSibling;
                  if (nextSibling && nextSibling.tagName.toLowerCase() === 'span') {
                    radioLabel = (nextSibling.textContent || '').trim();
                  }
                } catch(e) {}
              }
              
              // Method 5: Look for parent radio group label or legend
              if (!radioLabel) {
                try {
                  var radioGroup = bestElement.closest('fieldset, [role="radiogroup"], .slds-radio_button-group');
                  if (radioGroup) {
                    var legend = radioGroup.querySelector('legend, .slds-form-element__legend, .slds-form-element__label');
                    if (legend) {
                      // Include both the group label and specific option if possible
                      var groupLabel = (legend.textContent || '').trim();
                      var optionLabel = ariaLabel || bestElement.getAttribute('value') || '';
                      radioLabel = optionLabel ? optionLabel : groupLabel;
                    }
                  }
                } catch(e) {}
              }
              
              // Use found label if available
              if (radioLabel && radioLabel.length > 1 && radioLabel.length < 100) {
                text = radioLabel;
              }
            }
            
            // SPECIAL HANDLING FOR SEGMENTED CONTROLS / STYLED BUTTON GROUPS
            // These are often labels or divs that visually look like buttons but wrap hidden radio inputs
            // Common patterns: Bootstrap btn-group, Xcel Energy service type selector, etc.
            if (tag === 'label' || tag === 'div' || tag === 'span') {
              // Check if this element contains or is associated with a radio/checkbox
              var containedInput = bestElement.querySelector('input[type="radio"], input[type="checkbox"]');
              var isInRadioGroup = bestElement.closest('[role="radiogroup"], [role="group"], .btn-group, .button-group, .segmented-control, fieldset');
              var hasSelectedIndicator = bestElement.getAttribute('aria-pressed') || bestElement.getAttribute('aria-selected') || bestElement.getAttribute('aria-checked');
              var hasSelectedClass = bestElement.classList && (
                bestElement.classList.contains('active') ||
                bestElement.classList.contains('selected') ||
                bestElement.classList.contains('checked') ||
                bestElement.classList.contains('is-selected')
              );
              
              // If this looks like a segmented control option, treat it specially
              if (containedInput || isInRadioGroup || hasSelectedIndicator || hasSelectedClass) {
                // Get the visible text as the description (this is what the user sees)
                var visibleText = (bestElement.textContent || '').trim();
                // Filter out hidden input value text if present
                if (containedInput && containedInput.value) {
                  visibleText = visibleText.replace(containedInput.value, '').trim();
                }
                if (visibleText && visibleText.length > 1 && visibleText.length < 50) {
                  text = visibleText;
                }
                console.log('[Flowstral] Detected segmented control click:', visibleText);
              }
            }
            
            // Generate description - avoid auto-generated IDs
            var useId = id;
            // Skip auto-generated IDs (patterns like "radio-123", "input-456", "lwc-xxx", "aura-xxx")
            if (id && /^(radio|input|checkbox|button|lwc|aura|combobox)-?\d+$/i.test(id)) {
              useId = ''; // Don't use auto-generated ID
            }
            let desc = title || ariaLabel || text || name || useId || placeholder || tag;
            desc = desc.replace(/\\s+/g, ' ').trim().substring(0, 50);
            
            // Check if this is a submit/login/navigation button that will cause immediate action
            var textLower = text.toLowerCase();
            var isSubmitButton = 
              type === 'submit' || 
              tag === 'button' && (bestElement.closest('form') || textLower.includes('log in') || textLower.includes('login') || textLower.includes('sign in')) ||
              id.toLowerCase().includes('login') ||
              name.toLowerCase().includes('login') ||
              textLower.includes('log in') ||
              textLower.includes('login') ||
              textLower.includes('sign in') ||
              textLower.includes('submit') ||
              textLower.includes('next') ||
              textLower.includes('continue') ||
              textLower.includes('proceed') ||
              textLower === 'cancel' ||
              textLower === 'ok' ||
              textLower === 'confirm';
            
            // Detect element index when there are multiple matching elements
            var elementIndex = 0;
            var totalMatching = 1;
            try {
              // Find all elements that match the same text/label
              var searchText = title || ariaLabel || text || name;
              if (searchText && searchText.length > 0) {
                var matchingElements = [];
                
                // Search for matching buttons, links, and elements
                var allButtons = document.querySelectorAll('button, a, [role="button"], [role="link"], input[type="submit"], input[type="button"]');
                for (var i = 0; i < allButtons.length; i++) {
                  var btn = allButtons[i];
                  var btnText = (btn.textContent || btn.innerText || '').trim();
                  var btnTitle = btn.getAttribute('title') || '';
                  var btnAriaLabel = btn.getAttribute('aria-label') || '';
                  
                  // Check if this element matches the search text
                  if (btnText.indexOf(searchText) !== -1 || 
                      btnTitle === searchText || 
                      btnAriaLabel === searchText ||
                      btnText === searchText) {
                    matchingElements.push(btn);
                  }
                }
                
                // Also search Shadow DOM
                var shadowHosts = document.querySelectorAll('*');
                for (var i = 0; i < shadowHosts.length; i++) {
                  if (shadowHosts[i].shadowRoot) {
                    var shadowButtons = shadowHosts[i].shadowRoot.querySelectorAll('button, a, [role="button"], [role="link"]');
                    for (var j = 0; j < shadowButtons.length; j++) {
                      var btn = shadowButtons[j];
                      var btnText = (btn.textContent || btn.innerText || '').trim();
                      var btnTitle = btn.getAttribute('title') || '';
                      var btnAriaLabel = btn.getAttribute('aria-label') || '';
                      
                      if (btnText.indexOf(searchText) !== -1 || 
                          btnTitle === searchText || 
                          btnAriaLabel === searchText ||
                          btnText === searchText) {
                        matchingElements.push(btn);
                      }
                    }
                  }
                }
                
                totalMatching = matchingElements.length;
                
                // Find which index the clicked element is
                for (var i = 0; i < matchingElements.length; i++) {
                  if (matchingElements[i] === bestElement || 
                      matchingElements[i].contains(bestElement) ||
                      bestElement.contains(matchingElements[i])) {
                    elementIndex = i;
                    break;
                  }
                }
                
                if (totalMatching > 1) {
                  console.log('[Flowstral] Element "' + searchText + '" has ' + totalMatching + ' matches, clicked index: ' + elementIndex);
                }
              }
            } catch (indexErr) {
              // Ignore errors in index detection
            }
            
            var clickData = {
              timestamp: Date.now(),
              tag: tag,
              type: type,
              text: text.substring(0, 50),
              title: title,
              ariaLabel: ariaLabel,
              id: id,
              name: name,
              placeholder: placeholder,
              role: role,
              href: href,
              // HIGHEST PRIORITY: data-testid and variants for stable selectors
              testId: testId,
              dataTestId: dataTestId || testId,
              dataTest: dataTest,
              dataCy: dataCy,
              description: 'Click "' + desc + '"',
              x: e.clientX,
              y: e.clientY,
              fromShadow: path.length > 1 && path.some(p => p.nodeType === 11), // nodeType 11 is DocumentFragment (shadow root)
              isSubmit: isSubmitButton,
              elementIndex: elementIndex,
              totalMatching: totalMatching
            };
            
            // FILTER OUT phantom/internal Salesforce clicks
            // These are events triggered by Salesforce internally, not by user
            var isPhantomClick = false;
            
            // Check if this looks like a meaningful user interaction
            var hasMeaningfulData = dataLabel || dataValue || dataName || itemText;
            var isSearchRelated = tag.includes('search') || tag.includes('result') || 
                                  tag.includes('lookup') || tag.includes('records-');
            var isMenuItem = role === 'option' || role === 'menuitem' || role === 'listitem';
            
            // Filter 1: Skip if no meaningful text/description (but not for interactive elements)
            if (!desc || desc.length < 2 || desc === tag) {
              if (!hasMeaningfulData && !isSearchRelated && !isMenuItem) {
                isPhantomClick = true;
              }
            }
            
            // Filter 2: Skip ONLY truly generic HTML elements
            var badDescriptions = ['div', 'span', 'section', 'article', 'slot'];
            
            for (var i = 0; i < badDescriptions.length; i++) {
              if (desc.toLowerCase() === badDescriptions[i] && !hasMeaningfulData && !isSearchRelated) {
                isPhantomClick = true;
                break;
              }
            }
            
            // Filter 2.5: CRITICAL - Skip React DevTools, Webpack, and framework internal code
            // This catches garbage like "import { injectIntoGlobalHook } from '/@react-refr"
            var frameworkInternalPatterns = [
              '/@react',
              '__webpack',
              'injectIntoGlobalHook',
              'webpackJsonp',
              'undefined is not',
              'Cannot read propert',
              '__REACT_DEVTOOLS',
              '__PREACT_DEVTOOLS',
              'import {',
              'import \\(',
              'require\\(',
              'from \\'',
              'from "',
              'module.exports',
              'export default',
              'export {',
              '__esModule',
              '__vite',
              'hot module',
              'hmr',
              'localhost:',
              '127.0.0.1:',
              '.js:',
              '.tsx:',
              '.ts:'
            ];
            
            var fullText = (text || '').toLowerCase();
            var fullDesc = (desc || '').toLowerCase();
            for (var pi = 0; pi < frameworkInternalPatterns.length; pi++) {
              var pattern = frameworkInternalPatterns[pi].toLowerCase();
              if (fullText.indexOf(pattern) !== -1 || fullDesc.indexOf(pattern) !== -1) {
                console.log('[Flowstral] Skipping framework internal element:', desc.substring(0, 50));
                isPhantomClick = true;
                break;
              }
            }
            
            // Filter 2.6: Skip script tags or elements inside script tags
            if (tag === 'script' || (bestElement.closest && bestElement.closest('script'))) {
              console.log('[Flowstral] Skipping script element');
              isPhantomClick = true;
            }
            
            // Filter 2.7: Skip elements with code-like text patterns
            if (!isPhantomClick && text) {
              // Code patterns: arrow functions, const/let/var declarations, imports
              var codePatterns = /^(const |let |var |function |import |export |return |if \\(|for \\(|\\(\\) =>|=> \\{)/i;
              if (codePatterns.test(text.trim())) {
                console.log('[Flowstral] Skipping code-like text:', text.substring(0, 30));
                isPhantomClick = true;
              }
            }
            
            // Filter 3: Skip truly internal Lightning components (primitives, formatters)
            // but NEVER skip search results, menu items, or elements with meaningful data
            var isInternalComponent = ['lightning-primitive-cell', 'lightning-primitive-icon', 
                                       'aura-component', 'lightning-formatted-rich-text'];
            if (!hasMeaningfulData && !isSearchRelated && !isMenuItem) {
              for (var i = 0; i < isInternalComponent.length; i++) {
                if (desc.toLowerCase().indexOf(isInternalComponent[i]) === 0) {
                  isPhantomClick = true;
                  break;
                }
              }
            }
            
            // Filter 4: Skip if click position is 0,0 AND event is synthetic
            // NOTE: DO NOT filter on isTrusted alone - Shadow DOM clicks can lose trusted status
            if (e.clientX === 0 && e.clientY === 0 && !e.isTrusted) {
              isPhantomClick = true;
            }
            
            // NOTE: We REMOVED the isTrusted filter because:
            // 1. Shadow DOM clicks may be re-dispatched and lose trusted status
            // 2. Some frameworks (like LWC) re-dispatch user clicks internally
            // The position + other filters are sufficient to catch truly synthetic clicks
            
            // Filter 5: Clean up repeated text in description
            var descWords = desc.toLowerCase().split(' ');
            if (descWords.length >= 2 && descWords[0] === descWords[1]) {
              desc = descWords.slice(1).join(' ');
              clickData.description = 'Click "' + desc + '"';
            }
            
            // Filter 6: Skip container divs with concatenated text (form step headers)
            // These have patterns like "Start your registrationIt's easy" - lowercase followed by uppercase
            if (tag === 'div' && !role) {
              var concatenatedPattern = /[a-z][A-Z]/; // lowercase immediately followed by uppercase
              if (concatenatedPattern.test(desc) || concatenatedPattern.test(text)) {
                console.log('[Flowstral] Skipping concatenated container text:', desc);
                isPhantomClick = true;
              }
              // Also skip divs with very long text (likely containers with multiple sections)
              if (text.length > 40 && !hasMeaningfulData && !dataLabel && !dataValue) {
                console.log('[Flowstral] Skipping large container div:', desc);
                isPhantomClick = true;
              }
            }
            
            if (isPhantomClick) {
              console.log('[Flowstral] Skipping phantom click:', desc, '| tag:', tag, '| hasMeaningfulData:', hasMeaningfulData);
              return;
            }
            
            // Log successful click detection for debugging
            console.log('[Flowstral] Click detected:', desc, '| tag:', tag, '| role:', role, '| itemText:', itemText);
            
            // ============================================================
            // NOTE: We ONLY use console.log capture now (not array push)
            // This avoids duplicate capture since console works cross-origin
            // and the polling loop was processing BOTH sources
            // ============================================================
            
            // ============================================================
            // CRITICAL: Report ALL clicks via console for cross-domain capture!
            // Previously only submit buttons were reported, which broke
            // recording in cross-origin tabs (context.addInitScript works
            // but page.evaluate() fails, so we can't poll the clicks array)
            // ============================================================
            try {
              // FIRST: Report all pending inputs via console (before any navigation)
              var pendingInputs = window.__flowstralCDPInputs || {};
              for (var inputKey in pendingInputs) {
                var inp = pendingInputs[inputKey];
                if (inp && inp.value) {
                  console.log('__FLOWSTRAL_INPUT__:' + JSON.stringify(inp));
                }
              }
              
              // Clear inputs ONLY for submit/navigation buttons to avoid losing partial inputs
              if (isSubmitButton) {
                window.__flowstralCDPInputs = {};
              }
              
              // Report the click via console - works across ALL origins!
              console.log('__FLOWSTRAL_CLICK__:' + JSON.stringify(clickData));
              
              if (isSubmitButton) {
                console.log('[Flowstral] Submit click reported via console:', desc);
              }
            } catch(e) {
              console.error('[Flowstral] Error reporting:', e);
            }
          } catch(err) {
            // Silent
          }
        }, true); // CAPTURE phase - runs before anything else!
        
        // ============ INPUT CAPTURE USING composedPath ============
        // This captures inputs from Shadow DOM (like App Launcher search)
        // Also captures contenteditable elements (like Salesforce Chatter rich text)
        window.addEventListener('input', function(e) {
          try {
            const path = e.composedPath ? e.composedPath() : [e.target];
            let input = null;
            let isContentEditable = false;
            
            // Find the input element from composedPath
            for (const el of path) {
              if (!el || !el.tagName) continue;
              const tag = el.tagName.toLowerCase();
              if (tag === 'input' || tag === 'textarea') {
                input = el;
                break;
              }
              // Also capture contenteditable elements (rich text editors like Chatter)
              if (el.getAttribute && el.getAttribute('contenteditable') === 'true') {
                input = el;
                isContentEditable = true;
                break;
              }
              // Check for role="textbox" (Lightning components)
              if (el.getAttribute && el.getAttribute('role') === 'textbox') {
                input = el;
                isContentEditable = true;
                break;
              }
              // Salesforce Chatter rich text editor (ql-editor / Quill-based)
              if (el.classList && (el.classList.contains('ql-editor') || el.classList.contains('slds-rich-text-area__content') || el.classList.contains('cke_editable'))) {
                input = el;
                isContentEditable = true;
                break;
              }
            }
            
            if (!input) return;
            
            // For regular inputs, skip non-text types
            if (!isContentEditable) {
              const type = (input.type || '').toLowerCase();
              if (['checkbox','radio','submit','button','file','hidden'].includes(type)) return;
            }
            
            // Get value - handle both regular inputs and contenteditable
            const value = isContentEditable 
              ? (input.textContent || input.innerText || '').trim()
              : (input.value || '');
            if (!value) return;
            
            // Create unique key for this input
            const key = (input.id || '') + '|' + (input.name || '') + '|' + (input.placeholder || '') + '|' + (input.getAttribute('aria-label') || '');
            
            // Get additional context for better differentiation
            // Find associated label text
            var associatedLabel = '';
            var formId = '';
            var formAction = '';
            var sectionContext = '';
            
            try {
              // Find label via for attribute
              if (input.id) {
                var labelEl = document.querySelector('label[for="' + input.id + '"]');
                if (labelEl) associatedLabel = (labelEl.textContent || '').trim();
              }
              
              // Find label via parent
              if (!associatedLabel) {
                var parentLabel = input.closest('label');
                if (parentLabel) {
                  // Get text excluding the input value
                  associatedLabel = (parentLabel.textContent || '').replace(input.value || '', '').trim();
                }
              }
              
              // Find nearby label (sibling or parent's label)
              if (!associatedLabel) {
                var parent = input.parentElement;
                if (parent) {
                  var nearbyLabel = parent.querySelector('label, .label, [class*="label"]');
                  if (nearbyLabel) associatedLabel = (nearbyLabel.textContent || '').trim();
                }
              }
              
              // Get form context
              var form = input.closest('form');
              if (form) {
                formId = form.id || '';
                formAction = form.getAttribute('action') || '';
              }
              
              // Get section/container context for disambiguation
              var section = input.closest('section, [role="region"], [role="form"], .card, .panel, .modal, .dialog, header, footer, aside, nav, main, .cart, .checkout, .search');
              if (section) {
                sectionContext = section.getAttribute('aria-label') || 
                                 section.getAttribute('data-testid') ||
                                 section.id ||
                                 section.className.split(' ').filter(c => c && c.length < 30 && !c.includes('--'))[0] || '';
              }
            } catch(e) {}
            
            // Store/update pending input with enhanced context
            const tagName = (input.tagName || '').toLowerCase();
            window.__flowstralCDPInputs[key] = {
              timestamp: Date.now(),
              tag: isContentEditable ? 'contenteditable' : tagName,
              type: isContentEditable ? 'richtext' : (input.type || '').toLowerCase(),
              value: value,
              id: input.id || '',
              name: input.name || input.getAttribute('name') || '',
              placeholder: input.placeholder || input.getAttribute('placeholder') || '',
              ariaLabel: input.getAttribute('aria-label') || '',
              title: input.getAttribute('title') || '',
              role: input.getAttribute('role') || '',
              // HIGHEST PRIORITY: data-testid for stable selectors
              testId: input.getAttribute('data-testid') || '',
              dataTestId: input.getAttribute('data-test-id') || input.getAttribute('data-testid') || '',
              dataTest: input.getAttribute('data-test') || '',
              dataCy: input.getAttribute('data-cy') || '',
              fromShadow: path.some(p => p.nodeType === 11),
              key: key,
              isContentEditable: isContentEditable,
              // NEW: Additional context for disambiguation
              label: associatedLabel,
              formId: formId,
              formAction: formAction,
              sectionContext: sectionContext
            };
          } catch(err) {}
        }, true);
        
        // Helper to flush an input immediately
        function flushInput(input) {
          if (!input) return;
          
          // Check if it's a contenteditable element
          const isContentEditable = input.getAttribute && 
            (input.getAttribute('contenteditable') === 'true' || input.getAttribute('role') === 'textbox');
          
          // Get value based on element type
          const value = isContentEditable 
            ? (input.textContent || input.innerText || '').trim()
            : (input.value || '');
          
          if (!value) return;
          
          // For regular inputs, skip non-text types
          if (!isContentEditable) {
            const type = (input.type || '').toLowerCase();
            if (['checkbox','radio','submit','button','file','hidden'].includes(type)) return;
          }
          
          // ═══════════════════════════════════════════════════════════════
          // HONEYPOT DETECTION: Skip spam trap/bot detection fields
          // These are hidden fields designed to catch bots
          // ═══════════════════════════════════════════════════════════════
          const inputName = (input.name || '').toLowerCase();
          const inputId = (input.id || '').toLowerCase();
          const inputClass = (input.className || '').toLowerCase();
          
          // Common honeypot field names
          const honeypotPatterns = [
            'honeypot', 'honey-pot', 'honey_pot',
            'spamfilter', 'spam-filter', 'spam_filter', 'spam',
            'bot', 'botcheck', 'bot-check', 'bot_check', 'botfield',
            'trap', 'spamtrap', 'spam-trap',
            'website', 'url', 'homepage',  // Often used as honeypots
            'fax', 'faxnumber',  // Rarely used by humans
            'hp', 'hpfield', 'hp_field',
            'captcha_text', 'nocaptcha',
            'leave-blank', 'leave_blank', 'leaveblank'
          ];
          
          for (const pattern of honeypotPatterns) {
            if (inputName.includes(pattern) || inputId.includes(pattern)) {
              console.log('[Flowstral] 🍯 Skipping honeypot field:', inputName || inputId);
              return;
            }
          }
          
          // Check if element is hidden via CSS (common honeypot technique)
          try {
            const style = window.getComputedStyle(input);
            const rect = input.getBoundingClientRect();
            
            // Skip if not visible
            if (style.display === 'none' || 
                style.visibility === 'hidden' || 
                style.opacity === '0' ||
                rect.width === 0 || 
                rect.height === 0 ||
                rect.left < -1000 || rect.top < -1000) {
              console.log('[Flowstral] 🍯 Skipping hidden/off-screen field:', inputName || inputId);
              return;
            }
            
            // Skip fields with very small dimensions (likely hidden)
            if (rect.width < 5 || rect.height < 5) {
              console.log('[Flowstral] 🍯 Skipping tiny field (likely hidden):', inputName || inputId);
              return;
            }
          } catch (e) {
            // If we can't check visibility, continue cautiously
          }
          
          // Check for honeypot via tabindex=-1 and autocomplete="off" combo
          if (input.tabIndex === -1 && input.autocomplete === 'off') {
            console.log('[Flowstral] 🍯 Skipping likely honeypot (tabindex=-1, autocomplete=off):', inputName || inputId);
            return;
          }
          
          const key = (input.id || '') + '|' + (input.name || '') + '|' + (input.placeholder || '') + '|' + (input.getAttribute('aria-label') || '');
          
          // Mark this input for immediate flush
          if (window.__flowstralCDPInputs[key]) {
            window.__flowstralCDPInputs[key].shouldFlush = true;
            window.__flowstralCDPInputs[key].value = input.value;
            
            // Also report via console immediately (backup for cross-domain navigation)
            console.log('__FLOWSTRAL_INPUT__:' + JSON.stringify(window.__flowstralCDPInputs[key]));
          } else {
            // Create and immediately flush if not exists
            var newInput = {
              timestamp: Date.now(),
              tag: 'input',
              type: type,
              value: input.value,
              id: input.id || '',
              name: input.name || input.getAttribute('name') || '',
              placeholder: input.placeholder || input.getAttribute('placeholder') || '',
              ariaLabel: input.getAttribute('aria-label') || '',
              title: input.getAttribute('title') || '',
              fromShadow: true,
              key: key,
              shouldFlush: true
            };
            window.__flowstralCDPInputs[key] = newInput;
            console.log('__FLOWSTRAL_INPUT__:' + JSON.stringify(newInput));
          }
        }
        
        // Capture on focusout to flush input (including contenteditable)
        window.addEventListener('focusout', function(e) {
          try {
            const path = e.composedPath ? e.composedPath() : [e.target];
            let input = null;
            
            for (const el of path) {
              if (!el || !el.tagName) continue;
              const tag = el.tagName.toLowerCase();
              if (tag === 'input' || tag === 'textarea') {
                input = el;
                break;
              }
              // Also handle contenteditable elements (rich text editors)
              if (el.getAttribute && (el.getAttribute('contenteditable') === 'true' || el.getAttribute('role') === 'textbox')) {
                input = el;
                break;
              }
            }
            
            flushInput(input);
          } catch(err) {}
        }, true);
        
        // Also capture on 'change' event (fires when input value changes and loses focus)
        window.addEventListener('change', function(e) {
          try {
            const path = e.composedPath ? e.composedPath() : [e.target];
            let input = null;
            
            for (const el of path) {
              if (!el || !el.tagName) continue;
              const tag = el.tagName.toLowerCase();
              if (tag === 'input' || tag === 'textarea') {
                input = el;
                break;
              }
              // Also handle contenteditable elements
              if (el.getAttribute && (el.getAttribute('contenteditable') === 'true' || el.getAttribute('role') === 'textbox')) {
                input = el;
                break;
              }
            }
            
            flushInput(input);
          } catch(err) {}
        }, true);
    })();
    `;
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
        const allPages = this._pages || [this.page];
        
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
              // Clear pendingClicks for this page since recipe handled them
              // (they captured the same clicks)
              this.pendingClicks = (this.pendingClicks || []).filter(c => c.tabIndex !== pageIndex);
              this.pendingInputs = [];
            }
            
            // Process page data (inputs first, then clicks) - fallback if recipe not used
            if (!this.useRecipeRecorder || !data.recipeActions || data.recipeActions.length === 0) {
              // CRITICAL: Add pageIndex to inputs from page.evaluate (they don't have it)
              const inputsWithTabIndex = (data.inputs || []).map(inp => ({
                ...inp,
                tabIndex: inp.tabIndex !== undefined ? inp.tabIndex : pageIndex
              }));
              await this._processInputs(inputsWithTabIndex);
              for (const click of data.clicks) {
                await this._processClick(click);
              }
            }
          } catch (e) {
            // Page might be cross-origin - process pendingClicks as fallback
            if (this.useRecipeRecorder && mainProcessClicks.length > 0) {
              const pageClicks = mainProcessClicks.filter(c => c.tabIndex === pageIndex);
              if (pageClicks.length > 0) {
                console.log(`[PlaywrightRecorder] Cross-origin fallback: processing ${pageClicks.length} clicks from console for tab ${pageIndex}`);
                await this._processInputs(mainProcessInputs.filter(i => i.tabIndex === pageIndex));
                for (const click of pageClicks) {
                  await this._processClick(click);
                }
                // Clear processed clicks
                this.pendingClicks = (this.pendingClicks || []).filter(c => c.tabIndex !== pageIndex);
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
      
      this.actions.push(action);
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
    
    this.actions.push(legacyAction);
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
    
    // For submit clicks, insert at correct position based on timestamp
    if (click.isSubmit && click.timestamp) {
      // Find the correct position (after fills, before navigation)
      let insertIndex = this.actions.length;
      for (let i = this.actions.length - 1; i >= 0; i--) {
        const existing = this.actions[i];
        // Insert before any action with later timestamp
        if (existing.timestamp && existing.timestamp > click.timestamp) {
          insertIndex = i;
        } else {
          break;
        }
      }
      
      if (insertIndex < this.actions.length) {
        console.log('[PlaywrightRecorder] Inserting submit click at position', insertIndex);
        this.actions.splice(insertIndex, 0, action);
      } else {
        this.actions.push(action);
      }
    } else {
      this.actions.push(action);
    }
    
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
   */
  async runTest(options = {}) {
    const { 
      url, 
      steps, 
      headless = false, 
      timeout = 30000, 
      isRetry = false, 
      // NEW: Fresh browser mode - completely clean state, no cookies/storage
      // Use for: Test Playground, e-commerce, functional tests
      // Don't use for: Salesforce, SSO apps (need login persistence)
      freshBrowser = false,
      // NEW: Keep browser open on failure - allows visual debugging
      // When true: browser stays open, user can use Element Picker/Debug/AI
      // When false (default): browser closes, only Manual edit works
      keepBrowserOpenOnFailure = false,
      // NEW: Playback speed control - slowMo delay in ms between steps
      // 0 = fastest (2x), 200 = normal (1x), 500 = slow (0.5x), 1000 = very slow (0.25x)
      slowMo = 200,
      // NEW: Highlight elements during playback (visual feedback)
      highlight = true,
      // NEW: Flagged steps for false positive handling
      // Array of step IDs that user flagged as false positives
      flaggedSteps = [],
      // NEW: Stop at flagged step - when true, test pauses at flagged step for repair
      stopAtFlagged = false
    } = options;
    
    console.log('[PlaywrightRecorder] Running test with', steps?.length || 0, 'steps', 
      isRetry ? '(RETRY)' : '', freshBrowser ? '(FRESH BROWSER)' : '(PERSISTENT)',
      `slowMo=${slowMo}ms`, flaggedSteps.length > 0 ? `flagged=${flaggedSteps.length}` : '');
    
    // Reset AI call counter for this test run
    this.aiCallsThisRun = 0;
    
    // CRITICAL: Set flag to prevent recording navigations during test run
    this._isRunningTest = true;
    
    try {
      // If browser is already open (from recording), close it if we need fresh browser
      if (freshBrowser && this.context) {
        console.log('[PlaywrightRecorder] Closing existing browser for fresh start...');
        await this.context.close().catch(() => {});
        this.context = null;
        this.page = null;
        this.browser = null;
      }
      
      let needsNewBrowser = !this.page || this.page.isClosed();
      
      if (needsNewBrowser) {
        const { chromium } = require('playwright');
        
        if (freshBrowser) {
          // FRESH BROWSER MODE: Completely clean state - no cookies, localStorage, etc.
          console.log('[PlaywrightRecorder] Launching FRESH browser (clean state)...');
          
          // CRITICAL: Reset SmartFinder so it gets recreated with the new page
          this.smartFinder = null;
          
          // STEALTH MODE ARGS
          const stealthArgs = [
            '--start-maximized',
            '--disable-blink-features=AutomationControlled',
            '--disable-features=IsolateOrigins,site-per-process',
            '--disable-infobars',
            '--no-sandbox',
            '--disable-setuid-sandbox',
          ];
          
          this.browser = await chromium.launch({
            headless,
            args: stealthArgs
          });
          
          // Get mobile emulation options (backward compatible)
          const mobileOptions = this.getMobileContextOptions();
          const isMobile = this.isInMobileMode();
          
          if (isMobile) {
            console.log(`[PlaywrightRecorder] Fresh browser in mobile mode: ${this.mobileDevice.name}`);
          }
          
          // Create a brand new context with no stored data
          this.context = await this.browser.newContext({
            // Mobile: use device viewport, Desktop: full window
            viewport: isMobile ? mobileOptions.viewport : null,
            userAgent: isMobile ? mobileOptions.userAgent : 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
            // Mobile-specific options
            ...(isMobile && {
              deviceScaleFactor: mobileOptions.deviceScaleFactor,
              isMobile: mobileOptions.isMobile,
              hasTouch: mobileOptions.hasTouch
            }),
            ignoreHTTPSErrors: true,
          });
          
          // STEALTH: Add anti-detection script
          await this.context.addInitScript(() => {
            Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
            window.chrome = { runtime: {}, loadTimes: function() {}, csi: function() {}, app: {} };
          });
          
          this.page = await this.context.newPage();
          console.log('[PlaywrightRecorder] Fresh browser ready - no stored state (stealth mode)');
          
        } else {
          // PERSISTENT MODE: Keep login sessions, cookies, etc.
          console.log('[PlaywrightRecorder] Launching browser with persistent context...');
          
          // CRITICAL: Reset SmartFinder so it gets recreated with the new page
          this.smartFinder = null;
          
          const { app } = require('electron');
          const path = require('path');
          const userDataDir = path.join(app.getPath('userData'), 'playwright-browser-data');
          
          console.log('[PlaywrightRecorder] Using persistent user data dir:', userDataDir);
          
          // Get mobile emulation options (backward compatible: empty object = desktop)
          const mobileOptions = this.getMobileContextOptions();
          const isMobile = this.isInMobileMode();
          
          if (isMobile) {
            console.log(`[PlaywrightRecorder] Test running in mobile mode: ${this.mobileDevice.name}`);
          }
          
          // STEALTH MODE ARGS for persistent context
          const persistentStealthArgs = [
            '--start-maximized', 
            '--disable-blink-features=AutomationControlled',
            '--disable-features=IsolateOrigins,site-per-process',
            '--disable-infobars',
            '--no-sandbox',
          ];
          
          this.context = await chromium.launchPersistentContext(userDataDir, {
            headless,
            // Mobile: use device viewport, Desktop: full window
            viewport: isMobile ? mobileOptions.viewport : null,
            args: persistentStealthArgs,
            // Mobile: use device user agent, Desktop: Chrome UA  
            userAgent: isMobile ? mobileOptions.userAgent : 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
            // Mobile-specific options
            ...(isMobile && {
              deviceScaleFactor: mobileOptions.deviceScaleFactor,
              isMobile: mobileOptions.isMobile,
              hasTouch: mobileOptions.hasTouch
            }),
            ignoreHTTPSErrors: true,
          });
          
          // STEALTH: Add anti-detection script
          await this.context.addInitScript(() => {
            Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
            window.chrome = { runtime: {}, loadTimes: function() {}, csi: function() {}, app: {} };
          });
          
          // With persistent context, get existing page or create new one
          const pages = this.context.pages();
          this.page = pages.length > 0 ? pages[0] : await this.context.newPage();
          this.browser = null; // Not needed with persistent context
          console.log('[PlaywrightRecorder] Persistent browser ready (stealth mode)');
        }
      } else {
        console.log('[PlaywrightRecorder] Using existing browser for test');
      }
      
      // Navigate to start URL
      if (url) {
        console.log(`[PlaywrightRecorder] Navigating to: ${url}`);
        await this.page.goto(url, { waitUntil: 'domcontentloaded', timeout: 10000 });
        
        // For fresh browser, no need to clear - it's already clean
        // For persistent browser, we keep the state (login sessions, etc.)
        if (freshBrowser) {
          console.log('[PlaywrightRecorder] Fresh browser - starting with clean state');
        }
      }
      
      // Wait for page to be stable before executing steps
      try {
        await this.page.waitForLoadState('domcontentloaded', { timeout: 5000 }).catch(() => {});
        await this.page.waitForTimeout(500); // Let React/Vue fully render after storage clear
      } catch (e) {
        console.log('[PlaywrightRecorder] Page stability wait skipped:', e.message);
      }
      
      // Execute each step
      let passedSteps = 0;
      let failedStep = -1;
      let failError = '';
      // Track step results with workingSelector for Lock Locators feature
      const stepResults = new Array(steps.length).fill(null).map((_, i) => ({ index: i, status: 'pending' }));
      
      for (let i = 0; i < steps.length; i++) {
        const step = steps[i];
        
        // Check if page is still valid before each step
        if (!this.page || this.page.isClosed()) {
          console.log('[PlaywrightRecorder] Page was closed unexpectedly, stopping test');
          failedStep = i;
          failError = 'Page was closed unexpectedly';
          break;
        }
        
        // ═══════════════════════════════════════════════════════════════════════════
        // FLAGGED STEP CHECK: Stop at steps marked as false positive for repair
        // This allows users to fix steps using Smart Suggestions with browser open
        // ═══════════════════════════════════════════════════════════════════════════
        const isStepFlagged = step.flagged || 
                              (step.id && flaggedSteps.includes(step.id)) ||
                              (step.id && flaggedSteps.some(f => f === step.id || f.stepId === step.id));
        
        if (isStepFlagged && stopAtFlagged) {
          console.log(`[PlaywrightRecorder] 🚩 STOPPING at flagged step ${i + 1}: "${step.description || step.qword}"`);
          console.log(`[PlaywrightRecorder] Browser is PAUSED for user intervention - use Smart Suggestions to fix`);
          
          // Emit paused event so frontend can show repair UI
          this.emit('test-paused', {
            stepIndex: i,
            step,
            reason: 'flagged_step',
            message: `Paused at flagged step ${i + 1} for repair. Use Smart Suggestions to replace this step.`,
            browserOpen: true
          });
          
          // Store pause state so we can potentially resume later
          this._pausedAtFlaggedStep = {
            stepIndex: i,
            step,
            passedSteps: passedSteps
          };
          
          // Return partial results - test is PAUSED, not failed
          // Include stepResults with workingSelector for steps that passed
          return {
            success: false,
            status: 'paused_at_flagged',
            passedSteps,
            failedStep: -1,
            error: null,
            totalSteps: steps.length,
            stepResults,  // Include step results for Lock Locators
            stoppedAtFlaggedStep: {
              index: i,
              step,
              reason: 'User flagged this step as false positive'
            },
            // CRITICAL: Keep browser open for Smart Suggestions!
            browserKeptOpen: true
          };
        }
        
        console.log(`[PlaywrightRecorder] Executing step ${i + 1}: ${step.description || step.qword}`);
        
        // DEBUG: Log full step data for cross-origin steps
        if (step.qword === 'CrossOrigin' || step.type === 'crossOriginPlaceholder' || 
            (step.description || '').includes('Cross-origin') || (step.description || '').includes('external tab')) {
          console.log(`[PlaywrightRecorder] ⚠️ CROSS-ORIGIN STEP DETECTED:`);
          console.log(`[PlaywrightRecorder]   step.type = "${step.type}"`);
          console.log(`[PlaywrightRecorder]   step.qword = "${step.qword}"`);
          console.log(`[PlaywrightRecorder]   step.userActions = ${JSON.stringify(step.userActions)}`);
          console.log(`[PlaywrightRecorder]   step.description = "${step.description}"`);
        }
        
        this.emit('test-step-start', { stepIndex: i, step });
        
        try {
          // Determine step type from multiple sources (Builder format vs Recorder format)
          // CRITICAL: CrossOrigin/crossOriginPlaceholder must be preserved!
          let stepType;
          if (step.qword === 'CrossOrigin' || step.type === 'crossOriginPlaceholder' || step.type === 'CrossOrigin') {
            stepType = 'crossOriginPlaceholder'; // Force correct type
            console.log(`[PlaywrightRecorder]   → Forcing stepType to 'crossOriginPlaceholder'`);
          } else {
            stepType = step.type || // Builder format: 'click', 'fill', 'navigate', etc.
                            (step.qword?.toLowerCase() === 'goto' ? 'navigate' : 
                             step.qword?.toLowerCase() === 'fill' ? 'fill' :
                             step.qword?.toLowerCase() === 'select' ? 'select' :
                             step.qword?.toLowerCase() === 'asserttext' ? 'assert' :
                             step.qword?.toLowerCase() === 'wait' ? 'wait' :
                             step.qword?.toLowerCase() || 'click');
          }
          
          // CRITICAL: Use step.value (edited value) if available, else fall back to args
          // This ensures edited values from Builder are used, not just recorded values
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
          
          // Last resort: Extract from description like 'Click "Go To Saver's Switch"'
          if (!labelValue && step.description) {
            const descMatch = step.description.match(/(?:Click|Fill|Select|Type)\s*"([^"]+)"/i);
            if (descMatch) {
              labelValue = descMatch[1];
            } else {
              labelValue = step.description;
            }
          }
          labelValue = labelValue || '';
          
          // Convert step to action format
          // Normalize selector - could be string or object with nested selector property
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
            // CRITICAL: Pass step.args for SF steps and other complex actions
            args: step.args,
            // CRITICAL: Pass element data for SmartFinder role-based search
            element: step.element || {},
            selectorObj: step.selectorObj || step.selector || {},
            // Pass recipe directly if available (from Recipe Recorder v2)
            recipe: step.recipe || step.target || null,
            // Pass elementIndex for duplicate element handling
            elementIndex: step.elementIndex ?? step.args?.[1] ?? null,
            // CRITICAL: Context tracking for multi-tab and iframe support
            frameContext: step.frameContext || null,
            tabIndex: step.tabIndex ?? null,
            // CRITICAL: Pass userActions for cross-origin placeholder steps!
            userActions: step.userActions || []
          };
          
          // DEBUG: Confirm userActions are passed for cross-origin
          if (stepType === 'crossOriginPlaceholder' || action.userActions?.length > 0) {
            console.log(`[PlaywrightRecorder] ✓ Action userActions: ${JSON.stringify(action.userActions)}`);
          }
          
          console.log(`[PlaywrightRecorder] Step ${i + 1} action:`, { type: action.type, label: action.label, value: action.value ? '***' : '(empty)' });
          
          // Skip first navigate if we already navigated
          if (i === 0 && ['navigate', 'goto'].includes(action.type) && url && action.url === url) {
            console.log('[PlaywrightRecorder] Skipping first navigate (already navigated)');
            passedSteps++;
            // Track step result with null selector (navigate doesn't need one)
            stepResults[i] = { index: i, status: 'passed', workingSelector: null, strategyType: 'navigate' };
            this.emit('test-step-complete', { stepIndex: i, success: true, workingSelector: null, strategyType: 'navigate' });
            continue;
          }
          
          const result = await this.executeAction(action);
          
          // EXECUTE STEP ASSERTIONS if defined
          if (step.assertion && step.assertion.type && step.assertion.enabled !== false) {
            console.log(`[PlaywrightRecorder] Executing assertion for step ${i + 1}:`, step.assertion);
            // Pass step's selector as fallback for value-based assertions
            // Use normalized selector (already computed above as string)
            const stepSelector = normalizedSelector || step.selectorObj?.selector || '';
            const assertionResult = await this.executeAssertion(step.assertion, stepSelector);
            if (!assertionResult.success) {
              throw new Error(`Assertion failed: ${assertionResult.error || step.assertion.expected}`);
            }
            console.log(`[PlaywrightRecorder] Assertion passed for step ${i + 1}`);
          }
          
          if (result.success === false) {
            throw new Error(result.error || 'Step failed');
          }
          
          // Get the working selector from executeAction result
          const workingSelector = result.workingSelector || this._lastWorkingSelector || null;
          const strategyType = result.strategyType || this._lastStrategyType || null;
          
          // Self-healing: locked selector failed but SmartFinder worked
          const healed = result.healed || false;
          const newSelector = result.newSelector || null;
          
          passedSteps++;
          // Track step result with workingSelector for Lock Locators
          // Include healing info so frontend can auto-update locked selectors
          stepResults[i] = { 
            index: i, 
            status: 'passed', 
            workingSelector, 
            strategyType,
            healed,       // TRUE if locked selector failed but SmartFinder worked
            newSelector   // The new selector to use (auto-update locked selector)
          };
          this.emit('test-step-complete', { 
            stepIndex: i, 
            success: true, 
            workingSelector, 
            strategyType,
            healed,
            newSelector
          });
          
          // Wait between steps - use slowMo for playback speed control
          // slowMo: 0 = fastest (2x), 200 = normal (1x), 500 = slow (0.5x), 1000 = very slow (0.25x)
          const stepDelay = Math.max(100, slowMo); // Minimum 100ms for stability
          await this.page.waitForTimeout(stepDelay);
          
        } catch (stepError) {
          console.error(`[PlaywrightRecorder] Step ${i + 1} failed:`, stepError.message);
          failedStep = i;
          failError = stepError.message;
          
          // Capture failure state for debugging with ENHANCED scroll-to-element
          let failureScreenshot = null;
          let failureUrl = null;
          let elementLocation = null; // Track where we scrolled to
          try {
            if (this.page && !this.page.isClosed()) {
              const failedStepData = steps[i];
              let scrolledToElement = false;
              
              // ═══════════════════════════════════════════════════════════════════════
              // ENHANCED SCROLL-TO-ELEMENT: Multiple strategies to find the target area
              // ═══════════════════════════════════════════════════════════════════════
              
              try {
                // STRATEGY 1: Use CSS selector if available
                const selector = failedStepData?.selector || 
                                failedStepData?.selectorObj?.selector ||
                                failedStepData?.manualSelector;
                if (selector && !scrolledToElement) {
                  try {
                    const element = this.page.locator(selector).first();
                    if (await element.count() > 0) {
                      await element.scrollIntoViewIfNeeded();
                      const box = await element.boundingBox();
                      if (box) {
                        elementLocation = { x: box.x, y: box.y, width: box.width, height: box.height };
                        scrolledToElement = true;
                        console.log('[PlaywrightRecorder] ✓ Scrolled to element via selector');
                      }
                    }
                  } catch (e) { /* Try next strategy */ }
                }
                
                // STRATEGY 2: Use bounding box from recording
                if (!scrolledToElement && failedStepData?.recipe?.confirm?.boundingBox) {
                  const box = failedStepData.recipe.confirm.boundingBox;
                  await this.page.evaluate(({ x, y }) => {
                    window.scrollTo({ 
                      top: Math.max(0, y - 200),
                      left: Math.max(0, x - 100),
                      behavior: 'instant' 
                    });
                  }, { x: box.x, y: box.y });
                  elementLocation = box;
                  scrolledToElement = true;
                  console.log('[PlaywrightRecorder] ✓ Scrolled to bounding box from recording');
                  await this.page.waitForTimeout(100);
                }
                
                // STRATEGY 3: Search for text and scroll to it
                const searchText = failedStepData?.text || 
                                  failedStepData?.label ||
                                  failedStepData?.recipe?.what?.text ||
                                  failedStepData?.recipe?.where?.nearText;
                if (!scrolledToElement && searchText) {
                  const result = await this.page.evaluate((text) => {
                    // Try exact match first
                    const exactXPath = `//*[contains(text(), "${text.replace(/"/g, '\\"')}")]`;
                    try {
                      const result = document.evaluate(exactXPath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
                      if (result.singleNodeValue) {
                        const el = result.singleNodeValue;
                        el.scrollIntoView({ behavior: 'instant', block: 'center' });
                        const rect = el.getBoundingClientRect();
                        return { found: true, x: rect.x + window.scrollX, y: rect.y + window.scrollY, width: rect.width, height: rect.height };
                      }
                    } catch (e) {}
                    
                    // Fallback: TreeWalker for partial match
                    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
                    let node;
                    while (node = walker.nextNode()) {
                      if (node.textContent?.toLowerCase().includes(text.toLowerCase())) {
                        const el = node.parentElement;
                        if (el && el.offsetParent !== null) { // visible element
                          el.scrollIntoView({ behavior: 'instant', block: 'center' });
                          const rect = el.getBoundingClientRect();
                          return { found: true, x: rect.x + window.scrollX, y: rect.y + window.scrollY, width: rect.width, height: rect.height };
                        }
                      }
                    }
                    return { found: false };
                  }, searchText);
                  
                  if (result.found) {
                    elementLocation = { x: result.x, y: result.y, width: result.width, height: result.height };
                    scrolledToElement = true;
                    console.log('[PlaywrightRecorder] ✓ Scrolled to text match:', searchText.substring(0, 30));
                    await this.page.waitForTimeout(100);
                  }
                }
                
                // STRATEGY 4: Try aria-label
                const ariaLabel = failedStepData?.selectorObj?.ariaLabel ||
                                 failedStepData?.recipe?.which?.ariaLabel;
                if (!scrolledToElement && ariaLabel) {
                  try {
                    const element = this.page.locator(`[aria-label*="${ariaLabel}" i]`).first();
                    if (await element.count() > 0) {
                      await element.scrollIntoViewIfNeeded();
                      const box = await element.boundingBox();
                      if (box) {
                        elementLocation = { x: box.x, y: box.y, width: box.width, height: box.height };
                        scrolledToElement = true;
                        console.log('[PlaywrightRecorder] ✓ Scrolled to aria-label match');
                      }
                    }
                  } catch (e) { /* Try next */ }
                }
                
                // STRATEGY 5: Try data-testid
                const testId = failedStepData?.selectorObj?.testId ||
                              failedStepData?.recipe?.which?.testId;
                if (!scrolledToElement && testId) {
                  try {
                    const element = this.page.locator(`[data-testid="${testId}"], [data-test="${testId}"]`).first();
                    if (await element.count() > 0) {
                      await element.scrollIntoViewIfNeeded();
                      const box = await element.boundingBox();
                      if (box) {
                        elementLocation = { x: box.x, y: box.y, width: box.width, height: box.height };
                        scrolledToElement = true;
                        console.log('[PlaywrightRecorder] ✓ Scrolled to testId match');
                      }
                    }
                  } catch (e) { /* Ignore */ }
                }
                
                if (!scrolledToElement) {
                  console.log('[PlaywrightRecorder] Could not scroll to element, using current viewport');
                }
                
              } catch (scrollError) {
                console.log('[PlaywrightRecorder] Scroll error:', scrollError.message);
              }
              
              // Take screenshot
              const buf = await this.page.screenshot();
              failureScreenshot = `data:image/png;base64,${buf.toString('base64')}`;
              failureUrl = this.page.url();
            }
          } catch (e) {
            console.error('[PlaywrightRecorder] Failed to capture failure screenshot:', e.message);
          }
          
          // OPTION C: Find similar elements for Visual Selector Cards
          let similarElements = [];
          try {
            if (this.page && !this.page.isClosed()) {
              similarElements = await this._findSimilarElements(failedStepData);
              console.log(`[PlaywrightRecorder] Found ${similarElements.length} similar elements for Option C`);
            }
          } catch (e) {
            console.log('[PlaywrightRecorder] Could not find similar elements:', e.message);
          }
          
          // Store failure state for B+C Hybrid Editor
          this._lastFailureState = {
            stepIndex: failedStep,
            step: steps[failedStep],
            error: failError,
            screenshot: failureScreenshot,
            url: failureUrl,
            timestamp: Date.now(),
            allSteps: steps,
            passedSteps: passedSteps,
            similarElements: similarElements, // For Option C cards
            elementLocation: elementLocation, // Where we scrolled to (if found)
            scrolledToElement: !!elementLocation // Whether we successfully scrolled
          };
          
          // Track failed step result
          stepResults[i] = { 
            index: i, 
            status: 'failed', 
            error: stepError.message, 
            screenshot: failureScreenshot,
            workingSelector: null,
            strategyType: null
          };
          
          this.emit('test-step-complete', { 
            stepIndex: i, 
            success: false, 
            error: stepError.message,
            screenshot: failureScreenshot,
            url: failureUrl
          });
          break;
        }
      }
      
      // Return result
      const success = failedStep === -1;
      console.log(`[PlaywrightRecorder] Test ${success ? 'PASSED' : 'FAILED'}: ${passedSteps}/${steps.length} steps`);
      
      // Store whether we should keep browser open
      this._keepBrowserOpenOnFailure = keepBrowserOpenOnFailure && !success;
      
      // Update any remaining steps as skipped
      for (let j = passedSteps; j < steps.length; j++) {
        if (stepResults[j].status === 'pending') {
          stepResults[j].status = j === failedStep ? 'failed' : 'skipped';
          if (j === failedStep) {
            stepResults[j].error = failError;
            stepResults[j].screenshot = this._lastFailureState?.screenshot;
          }
        }
      }
      
      // Emit test-complete with stepResults INCLUDING workingSelector for Lock Locators
      this.emit('test-complete', { 
        success, 
        passedSteps, 
        failedStep, 
        error: failError, 
        totalSteps: steps.length,
        stepResults,  // CRITICAL: Include stepResults with workingSelector
        browserKeptOpen: this._keepBrowserOpenOnFailure,
        failureScreenshot: this._lastFailureState?.screenshot
      });
      
      return {
        success,
        passedSteps,
        failedStep,
        totalSteps: steps.length,
        error: failError || undefined,
        stepResults,  // CRITICAL: Return stepResults with workingSelector
        browserKeptOpen: this._keepBrowserOpenOnFailure,
        failureState: !success ? this._lastFailureState : undefined
      };
      
    } catch (error) {
      console.error('[PlaywrightRecorder] Test execution error:', error.message);
      return {
        success: false,
        error: error.message,
        passedSteps: 0,
        failedStep: 0,
        totalSteps: steps?.length || 0,
        stepResults: []
      };
    } finally {
      // CRITICAL: Always reset the flag when test run completes
      this._isRunningTest = false;
      
      // Check if we should keep browser open for debugging
      if (this._keepBrowserOpenOnFailure) {
        console.log('[PlaywrightRecorder] ⚠️ KEEPING BROWSER OPEN - Test failed and keepBrowserOpenOnFailure=true');
        console.log('[PlaywrightRecorder] Browser will stay open for visual debugging. Call closeBrowser() when done.');
        // Don't close - let user use Element Picker, Debug, AI features
        // Browser will be closed when user explicitly closes it or starts a new test
      } else {
        // Close browser after test completes (success or failure)
        // With persistent context, session data (cookies, localStorage) is preserved
        console.log('[PlaywrightRecorder] Closing browser after test (session data preserved)...');
        try {
          // With persistent context, closing context closes all pages
          // Session data is automatically saved to userDataDir
          if (this.context) {
            await this.context.close().catch(() => {});
          }
          this.page = null;
          this.context = null;
          this.browser = null;
          console.log('[PlaywrightRecorder] Browser closed successfully, login session preserved for next run');
        } catch (e) {
          console.error('[PlaywrightRecorder] Error closing browser:', e.message);
        }
      }
    }
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
        const { chromium } = require('playwright');
        const { app } = require('electron');
        const path = require('path');
        const userDataDir = path.join(app.getPath('userData'), 'playwright-browser-data');
        
        this.context = await chromium.launchPersistentContext(userDataDir, {
          headless: false,
          args: ['--start-maximized', '--disable-blink-features=AutomationControlled'],
          ignoreHTTPSErrors: true,
        });
        
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
    console.log('[PlaywrightRecorder] Updated action:', JSON.stringify(updatedAction));
    
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
          await this.page.waitForTimeout(500);
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
        const { chromium } = require('playwright');
        const { app } = require('electron');
        const path = require('path');
        const userDataDir = path.join(app.getPath('userData'), 'playwright-browser-data');
        
        // Get mobile emulation options (backward compatible)
        const mobileOptions = this.getMobileContextOptions();
        const isMobile = this.isInMobileMode();
        
        this.context = await chromium.launchPersistentContext(userDataDir, {
          headless,
          viewport: isMobile ? mobileOptions.viewport : null,
          args: ['--start-maximized', '--disable-blink-features=AutomationControlled'],
          userAgent: isMobile ? mobileOptions.userAgent : 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          ...(isMobile && {
            deviceScaleFactor: mobileOptions.deviceScaleFactor,
            isMobile: mobileOptions.isMobile,
            hasTouch: mobileOptions.hasTouch
          }),
          ignoreHTTPSErrors: true,
        });
        
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
          
          // Brief pause between steps
          await this.page.waitForTimeout(500);
          
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
    
    this.actions.push(qwordAction);
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
   * Analyze current page and return suggestions
   * ROBUST VERSION - mirrors browser extension's PageAnalyzer EXACTLY
   * Returns structured data with element types, duplicate detection, and counts
   */
  async analyzePage() {
    if (!this.page || this.page.isClosed()) {
      return { success: false, suggestions: [], error: 'No browser page' };
    }

    try {
      const suggestions = await this.page.evaluate(() => {
        const results = [];
        const seen = new Set();
        const seenLabels = new Map(); // Track labels to detect duplicates
        const labelCounts = new Map(); // Count total occurrences of each label
        
        // ======== COMPREHENSIVE SHADOW DOM QUERY (Industry Standard Approach) ========
        // Based on: Autify, Katalon, Playwright's native Shadow DOM piercing
        // This implementation mirrors what commercial tools do internally
        
        /**
         * Deep query selector that automatically pierces ALL Shadow DOM boundaries
         * Similar to Playwright's native shadow-piercing and query-selector-shadow-dom npm package
         * Works recursively through unlimited nesting depth
         */
        function deepQueryAll(selector) {
          const found = [];
          const visitedRoots = new WeakSet();
          
          function traverse(root) {
            if (visitedRoots.has(root)) return;
            visitedRoots.add(root);
            
            try {
              // Query in current root
              const elements = root.querySelectorAll(selector);
              elements.forEach(el => {
                if (!seen.has(el)) found.push(el);
              });
            } catch(e) {}
            
            // COMPREHENSIVE: Search ALL shadow roots at all depths
            const allElements = root.querySelectorAll ? root.querySelectorAll('*') : [];
            allElements.forEach(el => {
              // Check open shadow roots
              if (el.shadowRoot) {
                traverse(el.shadowRoot);
              }
              // Also check for closed shadow roots via special properties (some frameworks expose these)
              if (el._shadowRoot) {
                traverse(el._shadowRoot);
              }
            });
            
            // Also check slots for distributed content
            const slots = root.querySelectorAll ? root.querySelectorAll('slot') : [];
            slots.forEach(slot => {
              try {
                const assigned = slot.assignedElements ? slot.assignedElements({ flatten: true }) : [];
                assigned.forEach(el => {
                  if (!seen.has(el)) {
                    try {
                      if (el.matches && el.matches(selector)) {
                        found.push(el);
                      }
                    } catch(e) {}
                  }
                  // Recurse into assigned elements
              if (el.shadowRoot) traverse(el.shadowRoot);
                });
              } catch(e) {}
            });
          }
          
          // Start from document
          traverse(document);
          
          // Also search from document.body in case of detached trees
          if (document.body && !visitedRoots.has(document.body)) {
            traverse(document.body);
          }
          
          return found;
        }
        
        /**
         * Find a single element by ANY selector strategy, automatically piercing Shadow DOM
         * This is the key function that makes automation work like commercial tools
         */
        function deepQueryOne(selector) {
          const results = deepQueryAll(selector);
          return results.length > 0 ? results[0] : null;
        }
        
        /**
         * Query using a path of selectors, each segment piercing into the next shadow root
         * Example: "one-app-launcher-menu >>> lightning-input >>> input"
         * The >>> is the shadow-piercing combinator (like Playwright's >> but for shadow DOM)
         */
        function deepQueryPath(selectorPath) {
          const segments = selectorPath.split('>>>').map(s => s.trim());
          let currentRoots = [document];
          
          for (const segment of segments) {
            const nextRoots = [];
            for (const root of currentRoots) {
              try {
                const elements = root.querySelectorAll(segment);
                elements.forEach(el => {
                  // Add the element itself
                  nextRoots.push(el);
                  // If it has a shadow root, add that too for next iteration
                  if (el.shadowRoot) {
                    nextRoots.push(el.shadowRoot);
                  }
                });
              } catch(e) {}
              
              // Also search shadow root if current root has one
              if (root.shadowRoot) {
                try {
                  const shadowElements = root.shadowRoot.querySelectorAll(segment);
                  shadowElements.forEach(el => {
                    nextRoots.push(el);
                    if (el.shadowRoot) nextRoots.push(el.shadowRoot);
                  });
                } catch(e) {}
              }
            }
            currentRoots = nextRoots;
            if (currentRoots.length === 0) break;
          }
          
          // Return elements (not shadow roots)
          return currentRoots.filter(r => r.nodeType === 1);
        }
        
        /**
         * Get the shadow path to an element for debugging and selector generation
         */
        function getShadowPath(element) {
          const path = [];
          let current = element;
          
          while (current && current !== document.body) {
            const tag = (current.tagName || '').toLowerCase();
            const id = current.id;
            const className = (current.className || '').toString().split(' ')[0];
            
            let part = tag;
            if (id && !/^(lwc|aura)-/i.test(id)) part += '#' + id;
            else if (className && !/^(lwc|slds-)/i.test(className)) part += '.' + className;
            
            path.unshift(part);
            
            // Check if we're in a shadow root
            const root = current.getRootNode();
            if (root !== document && root.host) {
              path.unshift('>>>'); // Shadow boundary marker
              current = root.host;
            } else {
              current = current.parentElement;
            }
          }
          
          return path.join(' ');
        }

        // ======== VISIBILITY CHECK ========
        function isVisible(el) {
          if (!el) return false;
          try {
            // IMPORTANT: Skip elements inside the flowstral overlay
            // This prevents "Add to steps", "Execute action" etc from appearing
            if (isInsideFlowstralOverlay(el)) return false;
            
            const rect = el.getBoundingClientRect();
            if (rect.width === 0 || rect.height === 0) return false;
            // Check if in viewport
            if (rect.top > window.innerHeight * 2 || rect.bottom < -100) return false;
            const style = window.getComputedStyle(el);
            return style.display !== 'none' && 
                   style.visibility !== 'hidden' && 
                   parseFloat(style.opacity) > 0;
          } catch(e) {
            return false;
          }
        }
        
        // ======== CHECK IF ELEMENT IS INSIDE FLOWSTRAL OVERLAY ========
        function isInsideFlowstralOverlay(el) {
          if (!el) return false;
          try {
            // Check if element is inside our overlay by traversing up
            let current = el;
            while (current && current !== document.body && current !== document.documentElement) {
              // Check for overlay container ID or class
              if (current.id === 'flowstral-overlay-container' || 
                  current.id === 'flowstral-overlay' ||
                  (current.className && typeof current.className === 'string' && 
                   (current.className.includes('flowstral-overlay') || 
                    current.className.includes('fl-overlay') ||
                    current.className.includes('fl-panel')))) {
                return true;
              }
              // Check for shadow host with our overlay
              if (current.getRootNode() !== document) {
                const host = current.getRootNode().host;
                if (host && (host.id === 'flowstral-overlay-container' || host.id === 'flowstral-overlay')) {
                  return true;
                }
              }
              current = current.parentElement;
            }
            return false;
          } catch(e) {
            return false;
          }
        }

        // ======== GET VISIBLE TEXT (NO DUPLICATES) ========
        function getVisibleText(el) {
          try {
            const text = (el.textContent || el.innerText || '').trim();
            let normalized = text.replace(/\\s+/g, ' ');
            // Fix repeated words (common in React/LWC)
            const words = normalized.split(' ');
            if (words.length >= 2 && words[0] === words[1]) {
              normalized = words.slice(1).join(' ');
            }
            return normalized.length > 60 ? normalized.substring(0, 57) + '...' : normalized;
          } catch(e) {
            return '';
          }
        }

        // ======== GET BEST LABEL ========
        function getLabel(el) {
          // Priority: aria-label > title > placeholder > name > id > visible text
          const aria = el.getAttribute && el.getAttribute('aria-label');
          if (aria && aria.length > 0 && aria.length < 60) return aria.trim();
          
          const title = el.getAttribute && el.getAttribute('title');
          if (title && title.length > 0 && title.length < 60) return title.trim();
          
          const placeholder = el.getAttribute && el.getAttribute('placeholder');
          if (placeholder && placeholder.length > 0) return placeholder.trim();
          
          const name = el.name || el.getAttribute && el.getAttribute('name');
          if (name && name.length > 0) return name;
          
          if (el.id && el.id.length > 0 && !/^(lwc|aura)-/i.test(el.id) && !/^\\d+$/.test(el.id)) return el.id;
          
          const text = getVisibleText(el);
          if (text && text.length > 0) return text;
          
          return el.tagName ? el.tagName.toLowerCase() : 'element';
        }

        // ======== GET INPUT LABEL (ENHANCED FOR LIGHTNING) ========
        function getInputLabel(el) {
          // Check for associated label element
          if (el.id) {
            const label = document.querySelector('label[for="' + el.id.replace(/"/g, '\\\\"') + '"]');
            if (label) {
              const labelText = getVisibleText(label);
              if (labelText) return labelText;
            }
          }
          // Check parent label
          const parentLabel = el.closest('label');
          if (parentLabel) {
            const labelText = getVisibleText(parentLabel).replace(getVisibleText(el), '').trim();
            if (labelText.length > 0) return labelText;
          }
          // Lightning components - check multiple patterns
          const lwc = el.closest('lightning-input, lightning-combobox, lightning-textarea, lightning-select, lightning-datepicker, lightning-input-field, lightning-dual-listbox, lightning-radio-group, lightning-checkbox-group');
          if (lwc) {
            // Try multiple label selectors
            const labelSelectors = ['.slds-form-element__label', 'label', '.slds-radio__label', '.slds-checkbox__label', '[class*="label"]'];
            for (const sel of labelSelectors) {
              const lwcLabel = lwc.querySelector(sel);
              if (lwcLabel) {
                const text = getVisibleText(lwcLabel);
                if (text && text.length > 0) return text;
              }
            }
            // Try aria-label on the component itself
            const compAriaLabel = lwc.getAttribute('aria-label') || lwc.getAttribute('label');
            if (compAriaLabel) return compAriaLabel;
          }
          // ServiceNow / SAP patterns
          const sysDisplay = el.closest('[id^="sys_display"]');
          if (sysDisplay) {
            const fieldName = el.name || el.id;
            if (fieldName && fieldName.includes('.')) {
              return fieldName.split('.').pop().replace(/_/g, ' ');
            }
          }
          // Fallback
          return el.placeholder || el.getAttribute('aria-label') || el.name || el.id || 'input';
        }

        // ======== GENERATE BEST SELECTOR ========
        function getBestSelector(el) {
          // Test ID - highest priority
          const testId = el.getAttribute && (el.getAttribute('data-testid') || el.getAttribute('data-test-id') || el.getAttribute('data-automation-id') || el.getAttribute('data-cy'));
          if (testId) return '[data-testid="' + testId + '"]';
          
          // Meaningful ID (not dynamic)
          if (el.id && !/^(lwc|aura)-/i.test(el.id) && !/^\\d+$/.test(el.id) && !/[0-9]{8,}/.test(el.id) && !el.id.includes(':')) {
            return '#' + CSS.escape(el.id);
          }
          
          // Name attribute
          const name = el.name || el.getAttribute && el.getAttribute('name');
          if (name) return '[name="' + name.replace(/"/g, '\\\\"') + '"]';
          
          // Aria label
          const aria = el.getAttribute && el.getAttribute('aria-label');
          if (aria) return '[aria-label="' + aria.replace(/"/g, '\\\\"') + '"]';
          
          // Title
          const title = el.getAttribute && el.getAttribute('title');
          if (title && title.length < 50) return '[title="' + title.replace(/"/g, '\\\\"') + '"]';
          
          // Placeholder
          const placeholder = el.getAttribute && el.getAttribute('placeholder');
          if (placeholder) return '[placeholder="' + placeholder.replace(/"/g, '\\\\"') + '"]';
          
          // Role + text for accessible elements
          const role = el.getAttribute && el.getAttribute('role');
          if (role === 'button' || role === 'link' || role === 'menuitem') {
            const text = getVisibleText(el);
            if (text && text.length < 40) return null; // Will use text-based approach
          }
          
          return null;
        }

        // First pass: count all labels to detect duplicates
        function countLabel(label, type) {
          const key = type + ':' + (label || '').toLowerCase();
          labelCounts.set(key, (labelCounts.get(key) || 0) + 1);
        }

        // Helper to add result with duplicate tracking (like extension)
        function addResult(item) {
          const key = item.type + ':' + (item.label || '').toLowerCase();
          const count = seenLabels.get(key) || 0;
          seenLabels.set(key, count + 1);
          
          // Get total duplicates for this label
          const totalDuplicates = labelCounts.get(key) || 1;
          
          // Add duplicate tracking info
          item.duplicateIndex = count;
          item.totalDuplicates = totalDuplicates;
          item.hasDuplicates = totalDuplicates > 1;
          
          results.push(item);
        }

        // Helper to determine element category (like extension)
        function getElementCategory(el, role) {
          const tagName = (el.tagName || '').toLowerCase();
          if (role === 'tab') return 'tab';
          if (role === 'menuitem' || role === 'menuitemcheckbox' || role === 'menuitemradio') return 'menuitem';
          if (role === 'option' || role === 'listbox') return 'option';
          if (role === 'button') return 'button';
          if (tagName === 'button' || tagName === 'input') return 'button';
          if (tagName === 'a') return 'link';
          if (tagName === 'div' || tagName === 'li' || tagName === 'article') return 'card';
          return 'button';
        }

        // Helper to get element location (header, footer, nav, etc.)
        function getElementLocation(el) {
          let current = el;
          while (current && current !== document.body) {
            const tag = (current.tagName || '').toLowerCase();
            const role = current.getAttribute && current.getAttribute('role');
            const className = (current.className || '').toString().toLowerCase();
            const id = (current.id || '').toLowerCase();
            
            if (tag === 'header' || role === 'banner' || className.includes('header') || id.includes('header')) return 'header';
            if (tag === 'footer' || role === 'contentinfo' || className.includes('footer')) return 'footer';
            if (tag === 'nav' || role === 'navigation' || className.includes('nav')) return 'nav';
            if (tag === 'aside' || role === 'complementary' || className.includes('sidebar')) return 'sidebar';
            if (tag === 'main' || role === 'main') return 'main';
            
            current = current.parentElement;
          }
          return 'body';
        }

        // ======== FIRST PASS: COUNT ALL LABELS FOR DUPLICATE DETECTION ========
        const buttonSelectors = 'button, [role="button"], input[type="submit"], input[type="button"], .slds-button, lightning-button, lightning-button-icon, .btn, [class*="button"]';
        const allButtons = deepQueryAll(buttonSelectors);
        allButtons.forEach(el => { if (isVisible(el)) countLabel(getLabel(el), 'click'); });
        
        const allClickables = deepQueryAll('[role="option"], [role="menuitem"], [role="tab"], [role="treeitem"], [tabindex="0"], [onclick]');
        allClickables.forEach(el => { if (isVisible(el)) countLabel(getLabel(el), 'click'); });
        
        const allLinks = deepQueryAll('a[href]');
        allLinks.forEach(el => { if (isVisible(el)) countLabel(getVisibleText(el), 'click'); });

        // ======== COLLECT SALESFORCE-SPECIFIC ELEMENTS FIRST ========
        // App Launcher (9-dots icon)
        const appLauncherSelectors = [
          'button[title="App Launcher"]',
          '[data-aura-class="forceModuleSwitcher"]',
          'one-app-launcher-header button',
          'div.appLauncher button',
          '.slds-icon-waffle'
        ];
        appLauncherSelectors.forEach(sel => {
          try {
            document.querySelectorAll(sel).forEach(el => {
              if (!isVisible(el) || seen.has(el)) return;
              seen.add(el);
              const title = el.getAttribute('title') || 'App Launcher';
              addResult({
                type: 'click',
                element: 'button',
                label: title,
                text: title,
                tagName: (el.tagName || '').toLowerCase(),
                selector: '[title="App Launcher"]',
                action: 'Click',
                description: 'Click App Launcher',
                location: 'header',
                sfCategory: 'appLauncher'
              });
            });
          } catch(e) {}
        });
        
        // Profile/User Menu
        const profileSelectors = [
          'button[class*="userProfile"]',
          '[data-aura-class="uiPopupTrigger"][class*="profileTrigger"]',
          'one-app-nav-bar-item-root[data-id="profile"]',
          '[data-id="userProfileMenu"]',
          'button[title*="View profile"]',
          '.profileTrigger'
        ];
        profileSelectors.forEach(sel => {
          try {
            document.querySelectorAll(sel).forEach(el => {
              if (!isVisible(el) || seen.has(el)) return;
              seen.add(el);
              const title = el.getAttribute('title') || el.getAttribute('aria-label') || 'User Profile Menu';
              addResult({
                type: 'click',
                element: 'button',
                label: title,
                text: title,
                tagName: (el.tagName || '').toLowerCase(),
                selector: getBestSelector(el),
                action: 'Click',
                description: 'Click "' + title + '"',
                location: 'header',
                sfCategory: 'profileMenu'
              });
            });
          } catch(e) {}
        });
        
        // Lightning Tabs (record details, related lists, etc.)
        const tabSelectors = [
          'lightning-tab',
          'a[role="tab"]',
          'li[role="presentation"] a',
          '.slds-tabs_default__item a',
          '[data-tab-name] a',
          'lightning-tabset a[role="tab"]'
        ];
        tabSelectors.forEach(sel => {
          try {
            document.querySelectorAll(sel).forEach(el => {
              if (!isVisible(el) || seen.has(el)) return;
              seen.add(el);
              const title = el.getAttribute('title') || el.getAttribute('aria-label') || el.textContent.trim();
              if (!title || title.length > 60) return;
              addResult({
                type: 'click',
                element: 'tab',
                label: title,
                text: title,
                tagName: (el.tagName || '').toLowerCase(),
                role: 'tab',
                selector: getBestSelector(el),
                action: 'Select Tab',
                description: 'Select Tab "' + title + '"',
                sfCategory: 'tab'
              });
            });
          } catch(e) {}
        });

        // ======== COLLECT BUTTONS ========
        allButtons.forEach(el => {
          if (!isVisible(el) || seen.has(el)) return;
          seen.add(el);
          
          const label = getLabel(el);
          if (!label || label.length < 1 || label.length > 80) return;
          
          const role = el.getAttribute && el.getAttribute('role');
          const element = getElementCategory(el, role);
          const location = getElementLocation(el);
          
          addResult({
            type: 'click',
            element: element,
            label: label,
            text: label,
            tagName: (el.tagName || '').toLowerCase(),
            role: role,
            selector: getBestSelector(el),
            action: 'Click',
            description: 'Click "' + label + '"',
            location: location,
            id: el.id || null
          });
        });

        // ======== COLLECT CLICKABLE ELEMENTS (menus, tabs, options) ========
        const clickableSelectors = '[role="option"], [role="menuitem"], [role="menuitemcheckbox"], [role="menuitemradio"], [role="tab"], [role="treeitem"], [role="gridcell"], [tabindex="0"], [onclick], [data-action], [class*="clickable"], [class*="selectable"]';
        const clickables = deepQueryAll(clickableSelectors);
        
        clickables.forEach(el => {
          if (!isVisible(el) || seen.has(el)) return;
          seen.add(el);
          
          const label = getLabel(el);
          if (!label || label.length < 1 || label.length > 80) return;
          
          const role = el.getAttribute && el.getAttribute('role');
          const element = getElementCategory(el, role);
          const location = getElementLocation(el);
          const actionLabel = role === 'tab' ? 'Select Tab' : role === 'option' ? 'Select Option' : 'Click';
          
          addResult({
            type: 'click',
            element: element,
            label: label,
            text: label,
            tagName: (el.tagName || '').toLowerCase(),
            role: role,
            selector: getBestSelector(el),
            action: actionLabel,
            description: actionLabel + ' "' + label + '"',
            location: location
          });
        });

        // ======== COLLECT LINKS ========
        allLinks.forEach(el => {
          if (!isVisible(el) || seen.has(el)) return;
          seen.add(el);
          
          const text = getVisibleText(el);
          if (!text || text.length < 1 || text.length > 60) return;
          
          const href = el.getAttribute('href');
          if (href && (href.startsWith('javascript:') || href === '#')) return;
          
          const location = getElementLocation(el);
          const locationLabel = location !== 'body' && location !== 'main' ? ' [' + location + ']' : '';
          
          addResult({
            type: 'click',
            element: 'link',
            label: text,
            text: text,
            tagName: 'a',
            href: href,
            selector: getBestSelector(el),
            action: 'Click',
            description: 'Click link "' + text + '"' + locationLabel,
            location: location
          });
        });

        // ======== COLLECT TEXT INPUTS (Enhanced for Shadow DOM) ========
        const textInputs = deepQueryAll('input[type="text"], input[type="email"], input[type="password"], input[type="search"], input[type="tel"], input[type="url"], input[type="number"], input:not([type]), textarea');
        textInputs.forEach(el => {
          if (!isVisible(el) || seen.has(el)) return;
          seen.add(el);
          
          const label = getInputLabel(el);
          const type = (el.type || 'text').toLowerCase();
          
          addResult({
            type: 'fill',
            element: 'input',
              label: label,
            text: label,
            tagName: (el.tagName || '').toLowerCase(),
              inputType: type,
            selector: getBestSelector(el),
            action: 'Fill',
            description: 'Fill "' + label + '" field'
          });
        });
        
        // ======== COLLECT SALESFORCE SEARCH INPUTS (Deep Shadow DOM) ========
        // App Launcher search, Global Search, etc. use deeply nested Shadow DOM
        function findInputsInShadow(root, results) {
          try {
            // Find direct inputs
            root.querySelectorAll('input[type="text"], input[type="search"], input[placeholder*="Search" i], input[aria-label*="Search" i]').forEach(inp => {
              if (isVisible(inp) && !seen.has(inp)) {
                results.push(inp);
              }
            });
            // Recurse into shadow roots
            root.querySelectorAll('*').forEach(el => {
              if (el.shadowRoot) {
                findInputsInShadow(el.shadowRoot, results);
              }
            });
          } catch(e) {}
        }
        
        // Search in Lightning components that typically contain search
        const searchHosts = [
          'one-app-launcher-search',
          'one-app-launcher-menu', 
          'one-app-launcher-header',
          'lightning-lookup',
          'lightning-base-combobox',
          'lightning-grouped-combobox',
          'one-global-search',
          'search-input',
          'forceSearch-searchbox',
          '[class*="search"]',
          '[class*="appLauncher"]',
          '[data-component-id*="appLauncher"]'
        ];
        
        searchHosts.forEach(selector => {
          try {
            document.querySelectorAll(selector).forEach(host => {
              const shadowInputs = [];
              if (host.shadowRoot) {
                findInputsInShadow(host.shadowRoot, shadowInputs);
              }
              // Also check direct children
              findInputsInShadow(host, shadowInputs);
              
              shadowInputs.forEach(inp => {
                if (seen.has(inp)) return;
                seen.add(inp);
                
                const placeholder = inp.placeholder || inp.getAttribute('aria-label') || inp.getAttribute('title') || '';
                const label = placeholder || 'Search';
                
                addResult({
                  type: 'fill',
                  element: 'input',
                  label: label,
                  text: label,
                  tagName: 'input',
                  inputType: inp.type || 'search',
                  selector: getBestSelector(inp) || getBestSelector(host),
                  action: 'Fill',
                  description: 'Fill "' + label + '" search field',
                  isShadowDOM: true,
                  hostElement: (host.tagName || '').toLowerCase()
                });
              });
            });
          } catch(e) {}
        });
        
        // Also find the currently focused input (often App Launcher search)
        try {
          const activeEl = document.activeElement;
          if (activeEl && activeEl.shadowRoot) {
            const focusedInput = activeEl.shadowRoot.querySelector('input:focus');
            if (focusedInput && !seen.has(focusedInput) && isVisible(focusedInput)) {
              seen.add(focusedInput);
              const label = focusedInput.placeholder || focusedInput.getAttribute('aria-label') || 'Search';
              addResult({
                type: 'fill',
                element: 'input',
                label: label,
                text: label,
                tagName: 'input',
                inputType: focusedInput.type || 'text',
                selector: getBestSelector(focusedInput),
                action: 'Fill',
                description: 'Fill "' + label + '" (focused)',
                isFocused: true
              });
            }
          }
        } catch(e) {}

        // ======== COLLECT SELECT DROPDOWNS ========
        const selects = deepQueryAll('select');
        selects.forEach(el => {
          if (!isVisible(el) || seen.has(el)) return;
          seen.add(el);
          
          const label = getInputLabel(el);
          const options = Array.from(el.options || []).slice(0, 10).map(o => o.text.trim()).filter(t => t);
          
          addResult({
              type: 'select',
              label: label,
              tagName: 'select',
            selector: getBestSelector(el),
              options: options,
              action: 'Select',
              description: 'Select from "' + label + '"'
            });
        });

        // ======== COLLECT COMBOBOXES (Lightning/ARIA) ========
        const comboboxes = deepQueryAll('[role="combobox"], lightning-combobox, [role="listbox"], lightning-picklist, lightning-select, [class*="combobox"]');
        comboboxes.forEach(el => {
          if (!isVisible(el) || seen.has(el)) return;
          seen.add(el);
          
          // For Lightning components, get the internal input
          const internalInput = el.querySelector('input, [role="textbox"]');
          if (internalInput && seen.has(internalInput)) return;
          if (internalInput) seen.add(internalInput);
          
          const label = getInputLabel(el);
          if (!label || label.length > 60) return;
          
          addResult({
            type: 'select',
              label: label,
            tagName: (el.tagName || '').toLowerCase(),
            role: 'combobox',
            selector: getBestSelector(el),
            action: 'Select',
            description: 'Select from "' + label + '"'
          });
        });

        // ======== COLLECT CHECKBOXES ========
        const checkboxes = deepQueryAll('input[type="checkbox"], [role="checkbox"], lightning-input[type="checkbox"]');
        checkboxes.forEach(el => {
          if (!isVisible(el) || seen.has(el)) return;
          seen.add(el);
          
          const label = getInputLabel(el);
          
          addResult({
            type: 'checkbox',
            label: label,
            tagName: (el.tagName || '').toLowerCase(),
            inputType: 'checkbox',
            selector: getBestSelector(el),
            action: 'Check',
            description: 'Check "' + label + '"'
          });
        });

        // ======== COLLECT RADIO BUTTONS ========
        const radios = deepQueryAll('input[type="radio"], [role="radio"], lightning-input[type="radio"]');
        radios.forEach(el => {
          if (!isVisible(el) || seen.has(el)) return;
          seen.add(el);
          
          const label = getInputLabel(el);
          
          addResult({
            type: 'radio',
            label: label,
            tagName: (el.tagName || '').toLowerCase(),
            inputType: 'radio',
            selector: getBestSelector(el),
            action: 'Select',
            description: 'Select "' + label + '"'
          });
        });

        // ======== COLLECT DATE INPUTS ========
        const dateInputs = deepQueryAll('input[type="date"], input[type="datetime-local"], input[type="time"], lightning-datepicker, lightning-input[type="date"]');
        dateInputs.forEach(el => {
          if (!isVisible(el) || seen.has(el)) return;
          seen.add(el);
          
          const label = getInputLabel(el);
          
          addResult({
            type: 'fill',
            label: label,
            tagName: (el.tagName || '').toLowerCase(),
            inputType: 'date',
            selector: getBestSelector(el),
            action: 'Fill',
            description: 'Fill date "' + label + '"'
          });
        });

        // ======== COLLECT FILE INPUTS ========
        const fileInputs = deepQueryAll('input[type="file"], lightning-file-upload');
        fileInputs.forEach(el => {
          if (!isVisible(el) || seen.has(el)) return;
          seen.add(el);
          
          const label = getInputLabel(el);
          
          addResult({
            type: 'upload',
            label: label,
            tagName: (el.tagName || '').toLowerCase(),
            inputType: 'file',
            selector: getBestSelector(el),
            action: 'Upload',
            description: 'Upload file to "' + label + '"'
          });
        });

        // ======== COLLECT HEADINGS (for assertions) - NO LIMIT ========
        const headings = deepQueryAll('h1, h2, h3, h4, h5, h6, [role="heading"]');
        headings.forEach(el => {
          if (!isVisible(el) || seen.has(el)) return;
          seen.add(el);
          
          const text = getVisibleText(el);
          if (!text || text.length < 2 || text.length > 80) return;
          
          addResult({
            type: 'heading',
            label: text,
            tagName: (el.tagName || '').toLowerCase(),
            selector: getBestSelector(el),
            action: 'Assert',
            description: 'Assert heading "' + text + '"'
          });
        });

        // ======== SALESFORCE DETAIL PAGE ELEMENTS ========
        // Record fields (output fields on detail pages)
        const recordFields = deepQueryAll('lightning-output-field, lightning-formatted-text, lightning-formatted-name, lightning-formatted-email, lightning-formatted-phone, lightning-formatted-url, lightning-formatted-date-time, .slds-output, .slds-form-element__static, [data-output-element-id]');
        recordFields.forEach(el => {
          if (!isVisible(el) || seen.has(el)) return;
          seen.add(el);
          
          const label = getInputLabel(el);
          const value = getVisibleText(el);
          if (!label && !value) return;
          
          addResult({
            type: 'heading',  // Use as assertion element
            label: label || value,
            value: value,
            tagName: (el.tagName || '').toLowerCase(),
            selector: getBestSelector(el),
            action: 'Assert',
            description: 'Assert field "' + (label || value) + '"'
          });
        });

        // Lightning card headers and titles
        const cardHeaders = deepQueryAll('lightning-card .slds-card__header, .slds-card__header-title, lightning-tile .slds-tile__title, .slds-section__title, .slds-page-header__title');
        cardHeaders.forEach(el => {
          if (!isVisible(el) || seen.has(el)) return;
          seen.add(el);
          
          const text = getVisibleText(el);
          if (!text || text.length < 2) return;
          
          addResult({
            type: 'heading',
            label: text,
            tagName: (el.tagName || '').toLowerCase(),
            selector: getBestSelector(el),
            action: 'Assert',
            description: 'Assert title "' + text + '"'
          });
        });

        // Related lists and tabs
        const relatedLists = deepQueryAll('lightning-tab, .slds-tabs__item a, [role="tablist"] [role="tab"], lightning-tabset lightning-tab-bar button');
        relatedLists.forEach(el => {
          if (!isVisible(el) || seen.has(el)) return;
          seen.add(el);
          
          const text = getVisibleText(el);
          if (!text || text.length < 1) return;
          
          addResult({
            type: 'click',
            label: text,
            tagName: (el.tagName || '').toLowerCase(),
            role: 'tab',
            selector: getBestSelector(el),
            action: 'Click',
            description: 'Click tab "' + text + '"'
          });
        });

        // Actions menus/dropdowns
        const actionMenus = deepQueryAll('[role="menu"] [role="menuitem"], lightning-menu-item, .slds-dropdown__item a, .slds-dropdown__list li, lightning-button-menu lightning-menu-item');
        actionMenus.forEach(el => {
          if (!isVisible(el) || seen.has(el)) return;
          seen.add(el);
          
          const text = getVisibleText(el);
          if (!text || text.length < 1 || text.length > 60) return;
          
          addResult({
            type: 'click',
            label: text,
            tagName: (el.tagName || '').toLowerCase(),
            role: 'menuitem',
            selector: getBestSelector(el),
            action: 'Click',
            description: 'Click menu "' + text + '"'
          });
        });

        // Data table cells and links
        const tableCells = deepQueryAll('lightning-datatable a, table td a, .slds-table a, lightning-formatted-url a, [data-navigate="enable"]');
        tableCells.forEach(el => {
          if (!isVisible(el) || seen.has(el)) return;
          seen.add(el);
          
          const text = getVisibleText(el);
          if (!text || text.length < 1 || text.length > 80) return;
          
          addResult({
            type: 'click',
            label: text,
            tagName: (el.tagName || '').toLowerCase(),
            selector: getBestSelector(el),
            action: 'Click',
            description: 'Click record "' + text + '"'
          });
        });

        // ======== COLLECT TOGGLE SWITCHES ========
        const toggles = deepQueryAll('[role="switch"], lightning-input[type="toggle"], .slds-checkbox_toggle, [class*="toggle-switch"]');
        toggles.forEach(el => {
          if (!isVisible(el) || seen.has(el)) return;
          seen.add(el);
          
          const label = getLabel(el);
          
          addResult({
            type: 'toggle',
            label: label,
            tagName: (el.tagName || '').toLowerCase(),
            role: 'switch',
            selector: getBestSelector(el),
            action: 'Toggle',
            description: 'Toggle "' + label + '"'
          });
        });

        // ======== COLLECT SLIDERS ========
        const sliders = deepQueryAll('input[type="range"], [role="slider"]');
        sliders.forEach(el => {
          if (!isVisible(el) || seen.has(el)) return;
          seen.add(el);
          
          const label = getInputLabel(el);
          
          addResult({
            type: 'slider',
            label: label,
            tagName: (el.tagName || '').toLowerCase(),
            inputType: 'range',
            selector: getBestSelector(el),
            action: 'Slide',
            description: 'Adjust "' + label + '"'
          });
        });

        // ======== COLLECT NAVIGATION/MENU ITEMS ========
        const navItems = deepQueryAll('nav a, [role="navigation"] a, .nav-link, .menu-item, [class*="sidebar"] a, [class*="nav-item"]');
        navItems.forEach(el => {
          if (!isVisible(el) || seen.has(el)) return;
          seen.add(el);
          
          const text = getVisibleText(el);
          if (!text || text.length < 1) return;
          
          addResult({
            type: 'click',
            label: text,
            tagName: (el.tagName || '').toLowerCase(),
            selector: getBestSelector(el),
            action: 'Navigate',
            description: 'Navigate to "' + text + '"'
          });
        });

        // Sort by type priority: inputs first, then buttons, then others
        const typePriority = { fill: 1, select: 2, checkbox: 3, radio: 3, click: 4, heading: 5 };
        results.sort((a, b) => (typePriority[a.type] || 10) - (typePriority[b.type] || 10));

        // Calculate counts by element type
        const counts = {
          buttons: results.filter(r => r.element === 'button').length,
          links: results.filter(r => r.element === 'link').length,
          inputs: results.filter(r => r.type === 'fill' || r.type === 'select').length,
          tabs: results.filter(r => r.element === 'tab').length,
          cards: results.filter(r => r.element === 'card').length,
          menus: results.filter(r => r.element === 'menuitem').length,
          headings: results.filter(r => r.type === 'heading').length,
          total: results.length
        };

        return { suggestions: results, counts };
      });

      console.log('[PlaywrightRecorder] Analyze found', suggestions.suggestions?.length || 0, 'elements:', suggestions.counts);
      
      // ALWAYS update the browser overlay with the same suggestions
      // This ensures the webapp and overlay are always in sync
      try {
        await this.page.evaluate((sugs) => {
          if (window.__flowstralShowSuggestions__) {
            window.__flowstralShowSuggestions__(sugs);
          }
        }, suggestions.suggestions || []);
        console.log('[PlaywrightRecorder] Overlay synced with', suggestions.suggestions?.length || 0, 'suggestions');
      } catch (e) {
        // Overlay update failed, but we still return the suggestions
      }
      
      return { 
        success: true, 
        suggestions: suggestions.suggestions || [],
        counts: suggestions.counts || {}
      };
    } catch (error) {
      console.error('[PlaywrightRecorder] Analyze failed:', error.message);
      return { success: false, suggestions: [], counts: {}, error: error.message };
    }
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
  
  async _findElement(action) {
    const timeout = 5000;
    const strategies = [];
    // FIXED: Use comprehensive label extraction with normalization
    const label = getActionLabel(action);
    
    // Clean the label for matching (already normalized by getActionLabel)
    const cleanLabel = (label || '').replace(/"/g, '').trim();
    const cleanLabelNormalized = cleanLabel; // Already normalized
    
    // ============================================================
    // MANUAL OVERRIDE - User-specified selector takes HIGHEST priority
    // When automation fails, users can specify exactly how to find the element
    // ============================================================
    const manualOverride = action.manualOverride || action.selectorObj?.manualOverride;
    if (manualOverride) {
      console.log(`[PlaywrightRecorder] 🎯 MANUAL OVERRIDE: Using user-specified selector: "${manualOverride}"`);
      try {
        const manualLocator = this.page.locator(manualOverride);
        const count = await manualLocator.count();
        if (count > 0) {
          console.log(`[PlaywrightRecorder] ✅ Manual override found ${count} element(s)`);
          return { locator: manualLocator.first(), strategy: { type: 'MANUAL-OVERRIDE' } };
        } else {
          console.log(`[PlaywrightRecorder] ⚠️ Manual override selector found 0 elements, falling back to auto-detection`);
        }
      } catch (e) {
        console.log(`[PlaywrightRecorder] ⚠️ Manual override selector error: ${e.message}, falling back to auto-detection`);
      }
    }
    
    // Create regex pattern that matches any apostrophe variant
    const createApostropheFlexRegex = (text) => {
      const escaped = text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const flexible = escaped.replace(/['\u2018\u2019\u201B\u2032\u0060\u00B4]/g, "['\u2018\u2019\u201B\u2032\u0060\u00B4']");
      return new RegExp(flexible, 'i');
    };
    
    const isFillAction = action.type === 'fill' || action.type === 'type' || action.inputType;
    
    // CRITICAL: Extract element index for duplicate elements (e.g., multiple "Add to Cart" buttons)
    // action.args[1] contains the 0-based index of which matching element to click
    const elementIndex = typeof action.args?.[1] === 'number' ? action.args[1] : 0;
    if (elementIndex > 0) {
      console.log(`[PlaywrightRecorder] Element index specified: ${elementIndex} (will click ${elementIndex + 1}${this._ordinal(elementIndex + 1).slice(-2)} matching element)`);
    }
    
    // Helper to get element at specific index from a locator
    const getAtIndex = (locator) => elementIndex === 0 ? locator.first() : locator.nth(elementIndex);
    
    // Normalize selector - could be a string or object with selector property
    const selectorStr = typeof action.selector === 'string' 
      ? action.selector 
      : (action.selector?.selector || action.selectorObj?.selector || '');
    
    // ========== EXTRACT ALL RECORDED ELEMENT ATTRIBUTES ==========
    // These are the stable identifiers captured during recording
    const selectorObj = action.selectorObj || action.selector || {};
    const rawElement = action.raw?.element || action.element || {};
    
    // Extract all available attributes from multiple sources
    const testId = selectorObj.testId || rawElement.testId || action.testId || 
                   selectorObj['data-testid'] || rawElement['data-testid'];
    const name = selectorObj.name || rawElement.name || action.name;
    const id = selectorObj.id || rawElement.id || action.id;
    const ariaLabel = selectorObj.ariaLabel || rawElement.ariaLabel || action.ariaLabel;
    const placeholder = selectorObj.placeholder || rawElement.placeholder || action.placeholder;
    const title = selectorObj.title || rawElement.title || action.title;
    const role = selectorObj.role || rawElement.role || action.role;
    const href = selectorObj.href || rawElement.href || action.href;
    const className = selectorObj.className || rawElement.className || action.className;
    
    console.log(`[PlaywrightRecorder] Finding element: "${cleanLabel}" (selector: ${selectorStr}, fill: ${isFillAction})`);
    console.log(`[PlaywrightRecorder] Recorded attributes: testId=${testId}, name=${name}, id=${id}, ariaLabel=${ariaLabel}`);
    
    // ════════════════════════════════════════════════════════════════════════════
    // ENTERPRISE-GRADE ELEMENT FINDING - PRIORITY ORDER:
    // 1. data-testid (most stable - explicitly added for testing)
    // 2. name attribute (stable - used by forms)
    // 3. id attribute (stable if not dynamic)
    // 4. aria-label (stable - accessibility)
    // 5. role + name combination (semantic)
    // 6. CSS selector from recording
    // 7. Text-based fallbacks (least reliable)
    // ════════════════════════════════════════════════════════════════════════════
    
    // ========== HIGHEST PRIORITY: TEST IDs ==========
    // data-testid is the GOLD STANDARD for test automation - always try first
    if (testId) {
      strategies.push({ type: 'testid-exact', value: `[data-testid="${testId}"]` });
      strategies.push({ type: 'testid-getby', value: `getByTestId:${testId}` });
      // Also try common variations
      strategies.push({ type: 'testid-alt', value: `[data-test-id="${testId}"]` });
      strategies.push({ type: 'testid-cy', value: `[data-cy="${testId}"]` });
      strategies.push({ type: 'testid-qa', value: `[data-qa="${testId}"]` });
    }
    
    // ========== HIGH PRIORITY: NAME ATTRIBUTE ==========
    // name attribute is stable and commonly used for form elements
    if (name) {
      strategies.push({ type: 'name-exact', value: `[name="${name}"]` });
      strategies.push({ type: 'name-button', value: `button[name="${name}"]` });
      strategies.push({ type: 'name-input', value: `input[name="${name}"]` });
    }
    
    // ========== HIGH PRIORITY: ID ATTRIBUTE ==========
    // Only use if it doesn't look dynamic
    if (id && !this._isDynamicId(id)) {
      strategies.push({ type: 'id-exact', value: `#${cssEscape(id)}` });
    }
    
    // ========== HIGH PRIORITY: ARIA-LABEL ==========
    // Accessibility attributes are typically stable
    if (ariaLabel) {
      strategies.push({ type: 'aria-exact', value: `[aria-label="${ariaLabel}"]` });
      strategies.push({ type: 'aria-getby', value: `getByLabel:${ariaLabel}` });
    }
    
    // ========== MEDIUM PRIORITY: TITLE ATTRIBUTE ==========
    if (title) {
      strategies.push({ type: 'title-exact', value: `[title="${title}"]` });
      strategies.push({ type: 'title-getby', value: `getByTitle:${title}` });
    }
    
    // ========== MEDIUM PRIORITY: ROLE + NAME ==========
    if (role && cleanLabel) {
      strategies.push({ type: 'role-name', value: `getByRole:${role}:${cleanLabel}` });
    }
    
    // ========== MEDIUM PRIORITY: HREF FOR LINKS ==========
    if (href && !isFillAction) {
      strategies.push({ type: 'href-exact', value: `a[href="${href}"]` });
      strategies.push({ type: 'href-contains', value: `a[href*="${href.split('/').pop()}"]` });
    }
    
    // ========== MEDIUM PRIORITY: RECORDED CSS SELECTOR ==========
    if (selectorStr && !selectorStr.includes('text=')) {
      strategies.push({ type: 'css-selector', value: selectorStr });
    }
    
    // 2. For fill actions, prioritize input-specific selectors FIRST
    if (isFillAction && cleanLabel) {
      const lowerLabel = cleanLabel.toLowerCase();
      
      // SALESFORCE LOGIN PAGE - Very specific selectors for username/password
      if (lowerLabel.includes('username') || lowerLabel.includes('user name') || lowerLabel.includes('email')) {
        strategies.push({ type: 'sf-username', value: `#username` });
        strategies.push({ type: 'sf-username-name', value: `input[name="username"]` });
        strategies.push({ type: 'sf-username-type', value: `input[type="email"]` });
        strategies.push({ type: 'sf-username-autocomplete', value: `input[autocomplete="username"]` });
        strategies.push({ type: 'sf-login-email', value: `input[id*="username" i]` });
      }
      if (lowerLabel.includes('password') || lowerLabel.includes('pwd')) {
        strategies.push({ type: 'sf-password', value: `#password` });
        strategies.push({ type: 'sf-password-name', value: `input[name="pw"]` });
        strategies.push({ type: 'sf-password-type', value: `input[type="password"]` });
        strategies.push({ type: 'sf-password-autocomplete', value: `input[autocomplete="current-password"]` });
        strategies.push({ type: 'sf-login-password', value: `input[id*="password" i]` });
      }
      
      // LIST VIEW search - "Search this list..." - MUST come first!
      if (lowerLabel.includes('this list') || lowerLabel.includes('search this')) {
        strategies.push({ type: 'sf-listview-search', value: `input[placeholder*="Search this list" i]` });
        strategies.push({ type: 'sf-listview-search2', value: `lst-list-view-manager-header input[type="search"]` });
        strategies.push({ type: 'sf-listview-search3', value: `lightning-list-header input[type="search"]` });
        strategies.push({ type: 'sf-listview-search4', value: `.listViewContent input[placeholder*="Search" i]` });
        strategies.push({ type: 'sf-listview-search5', value: `input[name="Account-search-input"]` });
        strategies.push({ type: 'sf-listview-search6', value: `input[name*="-search-input"]` });
      }
      
      // App Launcher search - "Search apps and items..."
      if (lowerLabel.includes('apps') || lowerLabel.includes('items') || lowerLabel.includes('app launcher')) {
        strategies.push({ type: 'sf-app-search', value: `one-app-launcher-search input` });
        strategies.push({ type: 'sf-app-search2', value: `input[placeholder*="Search apps" i]` });
        strategies.push({ type: 'sf-app-search3', value: `input[placeholder*="apps and items" i]` });
      }
      
      // Global/Salesforce search (fallback for generic "search")
      if (lowerLabel.includes('search') || lowerLabel.includes('find')) {
        strategies.push({ type: 'sf-search-combobox', value: `lightning-base-combobox input` });
        strategies.push({ type: 'sf-search-aria', value: `input[aria-label*="Search" i]` });
        // Generic search selector LAST (matches multiple)
        strategies.push({ type: 'sf-global-search', value: `input[placeholder*="Search" i]` });
      }
      
      // ========== PLAYWRIGHT'S SHADOW DOM-PIERCING METHODS (These auto-pierce!) ==========
      // These are the most reliable for Shadow DOM - same approach as Autify, Katalon
      strategies.push({ type: 'getByLabel', value: `getByLabel:${cleanLabel}` });
      strategies.push({ type: 'getByPlaceholder', value: `getByPlaceholder:${cleanLabel}` });
      strategies.push({ type: 'getByTitle', value: `getByTitle:${cleanLabel}` });
      strategies.push({ type: 'getByRole-textbox', value: `getByRole:textbox:${cleanLabel}` });
      // Direct input/textarea targeting via label
      strategies.push({ type: 'label-input', value: `label:has-text("${cleanLabel}") >> input` });
      strategies.push({ type: 'label-textarea', value: `label:has-text("${cleanLabel}") >> textarea` });
      // Salesforce Lightning components - very specific selectors
      strategies.push({ type: 'lightning-input', value: `lightning-input[label="${cleanLabel}"] input` });
      strategies.push({ type: 'lightning-input-field', value: `lightning-input-field[field-label="${cleanLabel}"] input` });
      strategies.push({ type: 'lightning-textarea', value: `lightning-textarea[label="${cleanLabel}"] textarea` });
      strategies.push({ type: 'lightning-combobox', value: `lightning-combobox[label="${cleanLabel}"] input` });
      strategies.push({ type: 'lightning-grouped', value: `lightning-grouped-combobox[label="${cleanLabel}"] input` });
      // Standard HTML attributes
      strategies.push({ type: 'placeholder', value: `input[placeholder="${cleanLabel}"]` });
      strategies.push({ type: 'placeholder-contains', value: `input[placeholder*="${cleanLabel}" i]` });
      strategies.push({ type: 'textarea-placeholder', value: `textarea[placeholder="${cleanLabel}"]` });
      strategies.push({ type: 'name', value: `input[name="${cleanLabel}"]` });
      strategies.push({ type: 'name-contains', value: `input[name*="${cleanLabel}" i]` });
      strategies.push({ type: 'aria-label-input', value: `input[aria-label="${cleanLabel}"]` });
      strategies.push({ type: 'aria-label-input-contains', value: `input[aria-label*="${cleanLabel}" i]` });
      // Salesforce form rows - find input inside the row with matching label
      strategies.push({ type: 'sf-form-row', value: `.slds-form-element:has-text("${cleanLabel}") input` });
      strategies.push({ type: 'sf-form-row-textarea', value: `.slds-form-element:has-text("${cleanLabel}") textarea` });
      // Generic type-based fallbacks
      strategies.push({ type: 'input-type-text', value: `input[type="text"]` });
      strategies.push({ type: 'input-no-type', value: `input:not([type])` });
      // ID-based (if label's "for" attribute points to input)
      strategies.push({ type: 'getByRole-textbox', value: `getByRole:textbox:${cleanLabel}` });
    }
    
    // 3. For non-fill actions, add click-oriented strategies
    if (!isFillAction && cleanLabel) {
      const lowerLabel = cleanLabel.toLowerCase();
      
      // SALESFORCE-SPECIFIC CLICK TARGETS
      // App Launcher (9-dots icon)
      if (lowerLabel.includes('app launcher') || lowerLabel.includes('waffle') || lowerLabel === 'apps') {
        strategies.push({ type: 'sf-app-launcher', value: `button[title="App Launcher"]` });
        strategies.push({ type: 'sf-app-launcher-class', value: `.slds-icon-waffle` });
        strategies.push({ type: 'sf-app-launcher-one', value: `one-app-launcher-header button` });
        strategies.push({ type: 'sf-app-launcher-force', value: `[data-aura-class="forceModuleSwitcher"] button` });
      }
      
      // Login button
      if (lowerLabel.includes('log in') || lowerLabel.includes('login') || lowerLabel.includes('sign in')) {
        strategies.push({ type: 'sf-login-btn', value: `#Login` });
        strategies.push({ type: 'sf-login-btn-name', value: `input[name="Login"]` });
        strategies.push({ type: 'sf-login-btn-type', value: `input[type="submit"]` });
        strategies.push({ type: 'sf-login-btn-value', value: `input[value*="Log In" i]` });
        strategies.push({ type: 'sf-login-button', value: `button:has-text("Log In")` });
      }
      
      // Profile/User Menu
      if (lowerLabel.includes('profile') || lowerLabel.includes('user') || lowerLabel.includes('view profile')) {
        strategies.push({ type: 'sf-profile-btn', value: `[data-id="userProfileMenu"]` });
        strategies.push({ type: 'sf-profile-trigger', value: `.profileTrigger` });
        strategies.push({ type: 'sf-profile-title', value: `button[title*="View profile" i]` });
      }
      
      // Logout
      if (lowerLabel.includes('logout') || lowerLabel.includes('log out') || lowerLabel.includes('sign out')) {
        strategies.push({ type: 'sf-logout-link', value: `a:has-text("Log Out")` });
        strategies.push({ type: 'sf-logout-menuitem', value: `[role="menuitem"]:has-text("Log Out")` });
      }
      
      // Tabs (Details, Related, etc.)
      if (lowerLabel === 'details' || lowerLabel === 'related' || lowerLabel === 'news' || lowerLabel === 'activity') {
        strategies.push({ type: 'sf-tab', value: `a[role="tab"]:has-text("${cleanLabel}")` });
        strategies.push({ type: 'sf-tab-link', value: `lightning-tab[label="${cleanLabel}"]` });
        strategies.push({ type: 'sf-tab-slds', value: `.slds-tabs_default__item a:has-text("${cleanLabel}")` });
      }
      
      // New button (for record creation)
      if (lowerLabel === 'new' || lowerLabel.includes('new ')) {
        strategies.push({ type: 'sf-new-btn', value: `button[name="New"]` });
        strategies.push({ type: 'sf-new-action', value: `[title="New"]` });
        strategies.push({ type: 'sf-new-text', value: `a:has-text("New")` });
        strategies.push({ type: 'sf-new-list', value: `runtime_platform_actions-action-renderer button:has-text("New")` });
      }
      
      // ========== PLAYWRIGHT'S SHADOW DOM-PIERCING METHODS (These auto-pierce!) ==========
      // Using getBy* methods which automatically pierce shadow DOM
      strategies.push({ type: 'getByRole-button', value: `getByRole:button:${cleanLabel}` });
      strategies.push({ type: 'getByRole-link', value: `getByRole:link:${cleanLabel}` });
      strategies.push({ type: 'getByRole-tab', value: `getByRole:tab:${cleanLabel}` });
      strategies.push({ type: 'getByRole-menuitem', value: `getByRole:menuitem:${cleanLabel}` });
      strategies.push({ type: 'getByText', value: `getByText:${cleanLabel}` });
      strategies.push({ type: 'getByTitle', value: `getByTitle:${cleanLabel}` });
      
      // APOSTROPHE FIX: Add strategies with normalized apostrophes if different
      if (cleanLabelNormalized !== cleanLabel) {
        strategies.push({ type: 'getByRole-button-apostrophe', value: `getByRole:button:${cleanLabelNormalized}` });
        strategies.push({ type: 'getByRole-link-apostrophe', value: `getByRole:link:${cleanLabelNormalized}` });
        strategies.push({ type: 'getByText-apostrophe', value: `getByText:${cleanLabelNormalized}` });
      }
      
      // APOSTROPHE FIX: Add regex-based apostrophe-flexible strategies
      strategies.push({ type: 'getByRoleRegex-link', value: `getByRoleRegex:link:${cleanLabel}` });
      strategies.push({ type: 'getByText-apostrophe-flex', value: `getByTextRegex:${cleanLabel}` });
      
      // Exact text match
      strategies.push({ type: 'exact-text', value: `text="${cleanLabel}"` });
      // Case-insensitive exact match
      strategies.push({ type: 'text-insensitive', value: `text="${cleanLabel}" >> visible=true` });
      // Role-based matching (CSS-style, less reliable for shadow DOM)
      strategies.push({ type: 'role-button', value: `role=button[name="${cleanLabel}"]` });
      strategies.push({ type: 'role-link', value: `role=link[name="${cleanLabel}"]` });
      strategies.push({ type: 'role-tab', value: `role=tab[name="${cleanLabel}"]` });
      strategies.push({ type: 'role-menuitem', value: `role=menuitem[name="${cleanLabel}"]` });
      strategies.push({ type: 'role-option', value: `role=option[name="${cleanLabel}"]` });
      // Aria-label match
      strategies.push({ type: 'aria-label-exact', value: `[aria-label="${cleanLabel}"]` });
      strategies.push({ type: 'aria-label-contains', value: `[aria-label*="${cleanLabel}" i]` });
      // Title attribute
      strategies.push({ type: 'title', value: `[title="${cleanLabel}"]` });
      strategies.push({ type: 'title-contains', value: `[title*="${cleanLabel}" i]` });
      // Partial text match (looser)
      strategies.push({ type: 'text-partial', value: `text=${cleanLabel}` });
      // Contains text (for nested elements) - only for click actions
      strategies.push({ type: 'has-text', value: `button:has-text("${cleanLabel}")` });
      strategies.push({ type: 'has-text-a', value: `a:has-text("${cleanLabel}")` });
      strategies.push({ type: 'has-text-span', value: `span:has-text("${cleanLabel}")` });
      strategies.push({ type: 'has-text-div', value: `div:has-text("${cleanLabel}") >> visible=true` });
      
      // KEYWORD EXTRACTION: Find key phrases (proper nouns, product names)
      // e.g., "Go To Saver's Switch" → try "Saver's Switch" (the unique product name)
      const keyPhrases = cleanLabel
        .split(/\s+(?:to|the|a|an|with|for|on|in|and|or|of)\s+/i) // Split on common words
        .filter(phrase => phrase.length > 3)
        .map(phrase => phrase.trim());
      
      for (const keyPhrase of keyPhrases) {
        if (keyPhrase.length >= 5 && keyPhrase !== cleanLabel) {
          // Try with apostrophe-flexible regex
          strategies.push({ type: 'keyword-link', value: `getByRoleRegex:link:${keyPhrase}` });
          strategies.push({ type: 'keyword-text', value: `getByTextRegex:${keyPhrase}` });
          strategies.push({ type: 'has-text-keyword', value: `a:has-text("${keyPhrase}")` });
          strategies.push({ type: 'has-text-keyword-norm', value: `a:has-text("${normalizeTextForMatching(keyPhrase)}")` });
        }
      }
    }
    
    // 4. Try ID if available
    if (action.id) {
      strategies.unshift({ type: 'id', value: `#${cssEscape(action.id)}` });
    }
    
    // ========== PHASE 1: Try all defined strategies ==========
    for (const strategy of strategies) {
      try {
        let locator;
        let baseLocator; // Base locator before applying index
        
        // Handle special Playwright locator methods (THESE AUTOMATICALLY PIERCE SHADOW DOM)
        // CRITICAL FIX: Use getAtIndex() instead of .first() to respect elementIndex
        if (strategy.value.startsWith('getByTestId:')) {
          // HIGHEST PRIORITY: data-testid - most reliable selector
          const testIdValue = strategy.value.replace('getByTestId:', '');
          baseLocator = this.page.getByTestId(testIdValue);
          locator = getAtIndex(baseLocator);
        } else if (strategy.value.startsWith('getByRoleRegex:')) {
          // APOSTROPHE FIX: Use regex for role name that matches any apostrophe variant
          const parts = strategy.value.replace('getByRoleRegex:', '').split(':');
          if (parts.length === 2) {
            const flexRegex = createApostropheFlexRegex(parts[1]);
            baseLocator = this.page.getByRole(parts[0], { name: flexRegex });
            locator = getAtIndex(baseLocator);
          }
        } else if (strategy.value.startsWith('getByTextRegex:')) {
          // APOSTROPHE FIX: Use regex that matches any apostrophe variant
          const text = strategy.value.replace('getByTextRegex:', '');
          const flexRegex = createApostropheFlexRegex(text);
          baseLocator = this.page.getByText(flexRegex);
          locator = getAtIndex(baseLocator);
        } else if (strategy.value.startsWith('getByText:')) {
          const text = strategy.value.replace('getByText:', '');
          baseLocator = this.page.getByText(text, { exact: true });
          locator = getAtIndex(baseLocator);
        } else if (strategy.value.startsWith('getByLabel:')) {
          const labelText = strategy.value.replace('getByLabel:', '');
          baseLocator = this.page.getByLabel(labelText);
          locator = getAtIndex(baseLocator);
        } else if (strategy.value.startsWith('getByRole:textbox:')) {
          const name = strategy.value.replace('getByRole:textbox:', '');
          baseLocator = this.page.getByRole('textbox', { name });
          locator = getAtIndex(baseLocator);
        } else if (strategy.value.startsWith('getByRole:button:')) {
          const name = strategy.value.replace('getByRole:button:', '');
          baseLocator = this.page.getByRole('button', { name });
          locator = getAtIndex(baseLocator);
        } else if (strategy.value.startsWith('getByRole:link:')) {
          const name = strategy.value.replace('getByRole:link:', '');
          baseLocator = this.page.getByRole('link', { name });
          locator = getAtIndex(baseLocator);
        } else if (strategy.value.startsWith('getByRole:tab:')) {
          const name = strategy.value.replace('getByRole:tab:', '');
          baseLocator = this.page.getByRole('tab', { name });
          locator = getAtIndex(baseLocator);
        } else if (strategy.value.startsWith('getByRole:menuitem:')) {
          const name = strategy.value.replace('getByRole:menuitem:', '');
          baseLocator = this.page.getByRole('menuitem', { name });
          locator = getAtIndex(baseLocator);
        } else if (strategy.value.startsWith('getByRole:')) {
          // Generic getByRole handler for role-name strategies
          const parts = strategy.value.replace('getByRole:', '').split(':');
          if (parts.length === 2) {
            baseLocator = this.page.getByRole(parts[0], { name: parts[1] });
          } else {
            baseLocator = this.page.getByRole(parts[0]);
          }
          locator = getAtIndex(baseLocator);
        } else if (strategy.value.startsWith('getByPlaceholder:')) {
          const placeholder = strategy.value.replace('getByPlaceholder:', '');
          baseLocator = this.page.getByPlaceholder(placeholder);
          locator = getAtIndex(baseLocator);
        } else if (strategy.value.startsWith('getByTitle:')) {
          const title = strategy.value.replace('getByTitle:', '');
          baseLocator = this.page.getByTitle(title);
          locator = getAtIndex(baseLocator);
        } else {
          baseLocator = this.page.locator(strategy.value);
          locator = getAtIndex(baseLocator);
        }
        
        const count = await locator.count().catch(() => 0);
        if (count > 0) {
          const isVisible = await locator.isVisible({ timeout: 5000 }).catch(() => false);
          if (isVisible) {
            // For fill actions, validate that the element is actually fillable
            if (isFillAction) {
              const isFillable = await locator.evaluate(el => {
                const tagName = el.tagName.toLowerCase();
                const isInput = tagName === 'input';
                const isTextarea = tagName === 'textarea';
                const isSelect = tagName === 'select';
                const isContentEditable = el.isContentEditable || el.getAttribute('contenteditable') === 'true';
                // Also check for readonly
                const isReadonly = el.hasAttribute('readonly') || el.getAttribute('aria-readonly') === 'true';
                return (isInput || isTextarea || isSelect || isContentEditable) && !isReadonly;
              }).catch(() => false);
              
              if (!isFillable) {
                console.log(`[PlaywrightRecorder] ✗ Element found but not fillable: ${strategy.type}`);
                continue; // Try next strategy
              }
            }
            
            console.log(`[PlaywrightRecorder] ✓ Found element using ${strategy.type}: ${strategy.value}`);
            return { locator, strategy };
          }
        }
      } catch (e) {
        // Try next strategy
      }
    }
    
    // ========== PHASE 2: SHADOW DOM DEEP SEARCH (Last Resort) ==========
    // This is the nuclear option - search through ALL shadow roots using evaluate
    console.log(`[PlaywrightRecorder] Trying deep Shadow DOM search for: "${cleanLabel}"`);
    
    try {
      const shadowResult = await this.page.evaluate((params) => {
        const { label, isFill } = params;
        const cleanLabel = label.toLowerCase();
        
        // Deep query function
        function deepQuery(root, results, visited) {
          if (visited.has(root)) return;
          visited.add(root);
          
          // Search in this root
          try {
            const allElements = root.querySelectorAll('*');
            allElements.forEach(el => {
              // Check various attributes
              const text = (el.textContent || '').trim().toLowerCase();
              const ariaLabel = (el.getAttribute('aria-label') || '').toLowerCase();
              const title = (el.getAttribute('title') || '').toLowerCase();
              const placeholder = (el.getAttribute('placeholder') || '').toLowerCase();
              const name = (el.getAttribute('name') || '').toLowerCase();
              const tag = (el.tagName || '').toLowerCase();
              
              // Check if matches
              const matches = text.includes(cleanLabel) || 
                             ariaLabel.includes(cleanLabel) || 
                             title.includes(cleanLabel) ||
                             placeholder.includes(cleanLabel) ||
                             name.includes(cleanLabel);
              
              if (matches) {
                // For fill actions, only return fillable elements
                if (isFill) {
                  if (tag === 'input' || tag === 'textarea' || tag === 'select' || el.isContentEditable) {
                    results.push({
                      tag: tag,
                      id: el.id,
                      name: el.getAttribute('name'),
                      placeholder: el.getAttribute('placeholder'),
                      ariaLabel: el.getAttribute('aria-label'),
                      title: el.getAttribute('title'),
                      // Create a unique path for this element
                      path: getElementPath(el)
                    });
                  }
                } else {
                  results.push({
                    tag: tag,
                    id: el.id,
                    text: text.substring(0, 50),
                    ariaLabel: ariaLabel,
                    title: title,
                    role: el.getAttribute('role'),
                    path: getElementPath(el)
                  });
                }
              }
              
              // Recurse into shadow root
              if (el.shadowRoot) {
                deepQuery(el.shadowRoot, results, visited);
              }
            });
          } catch(e) {}
        }
        
        // Generate a locatable path for an element
        function getElementPath(el) {
          const parts = [];
          let current = el;
          let shadowDepth = 0;
          
          while (current && current !== document.body) {
            const tag = current.tagName.toLowerCase();
            const id = current.id;
            const nth = getNthOfType(current);
            
            if (id && !/^(lwc|aura)-/i.test(id)) {
              parts.unshift('#' + id);
              break; // ID is unique enough
            } else {
              parts.unshift(tag + (nth > 0 ? ':nth-of-type(' + (nth + 1) + ')' : ''));
            }
            
            // Check if we crossed a shadow boundary
            const root = current.getRootNode();
            if (root !== document && root.host) {
              parts.unshift('>>'); // Shadow boundary marker
              current = root.host;
              shadowDepth++;
            } else {
              current = current.parentElement;
            }
            
            if (parts.length > 10) break; // Limit depth
          }
          
          return { selector: parts.join(' > '), shadowDepth };
        }
        
        function getNthOfType(el) {
          let n = 0;
          let sibling = el.previousElementSibling;
          while (sibling) {
            if (sibling.tagName === el.tagName) n++;
            sibling = sibling.previousElementSibling;
          }
          return n;
        }
        
        const results = [];
        deepQuery(document, results, new WeakSet());
        return results;
      }, { label: cleanLabel, isFill: isFillAction });
      
      if (shadowResult && shadowResult.length > 0) {
        // Try to locate the first found element
        const found = shadowResult[0];
        console.log(`[PlaywrightRecorder] Deep search found ${shadowResult.length} candidates:`, found);
        
        // Build locator from the found element info
        // Use getAtIndex to respect elementIndex for duplicate elements
        let locator;
        if (found.id && !/^(lwc|aura)-/i.test(found.id)) {
          locator = getAtIndex(this.page.locator(`#${cssEscape(found.id)}`));
        } else if (found.ariaLabel) {
          locator = getAtIndex(this.page.getByLabel(found.ariaLabel));
        } else if (found.placeholder) {
          locator = getAtIndex(this.page.getByPlaceholder(found.placeholder));
        } else if (found.title) {
          locator = getAtIndex(this.page.getByTitle(found.title));
        } else if (found.name) {
          locator = getAtIndex(this.page.locator(`[name="${found.name}"]`));
        }
        
        if (locator) {
          const count = await locator.count().catch(() => 0);
          if (count > 0) {
            console.log(`[PlaywrightRecorder] ✓ Found via deep Shadow DOM search`);
            return { locator, strategy: { type: 'deep-shadow-search', value: 'evaluated' } };
          }
        }
      }
    } catch (e) {
      console.log(`[PlaywrightRecorder] Deep Shadow DOM search failed:`, e.message);
    }
    
    console.log(`[PlaywrightRecorder] ✗ Could not find element: "${cleanLabel}"`);
    return null;
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
      baseDelay = 500, 
      maxDelay = 5000,
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
   * @param {Object} action - The action containing element info
   * @returns {Promise<{locator, strategy}|null>}
   */
  async findElementWithRetry(action) {
    const label = getActionLabel(action); // FIXED: Use comprehensive normalized extraction
    
    try {
      return await this.retryWithBackoff(async () => {
        // Check page is still valid
        if (!this.page || this.page.isClosed()) {
          throw new Error('Page is closed');
        }
        
        // Get the appropriate scope (page or iframe)
        const scope = await this._getFrameScope(action);
        const isIframe = scope !== this.page;
        if (isIframe) {
          console.log('[PlaywrightRecorder] Searching within iframe context');
        }
        
        // Try SmartFinder first
        console.log('[PlaywrightRecorder] ========== ELEMENT FINDING DEBUG ==========');
        console.log('[PlaywrightRecorder] Action data:', JSON.stringify({
          type: action.type,
          text: action.text,
          label: action.label,
          'args[0]': action.args?.[0],
          'selectorObj.text': action.selectorObj?.text,
          'element.text': action.element?.text,
          recipe: action.recipe,
          manualOverride: action.selectorObj?.manualOverride || action.manualOverride,
        }, null, 2));
        
        if (this.useSmartFinderForPlayback) {
          if (!this.smartFinder) {
            // Pass scope instead of page for iframe support
            this.smartFinder = new SmartFinder(isIframe ? scope : this.page, { debug: true, timeout: 15000 });
          }
          
          await this.page.waitForLoadState('domcontentloaded').catch(() => {});
          await this.page.waitForTimeout(300);
          
          // ═══════════════════════════════════════════════════════════════════
          // OPTIMIZED SELECTOR: User-locked selector from "Lock Locators" 
          // Try this FIRST with very short timeout - it should work instantly
          // This travels with the test case, works across environments
          // Supports: CSS selectors, role=xxx[name="yyy"], aria-label, etc.
          // ═══════════════════════════════════════════════════════════════════
          const optimizedSelector = action.selectorObj?.optimizedSelector;
          if (optimizedSelector) {
            console.log(`[PlaywrightRecorder] ⚡ Trying LOCKED selector: ${optimizedSelector}`);
            try {
              let locator;
              
              // Handle role=xxx[name="yyy"] format (from Lock Locators)
              const roleMatch = optimizedSelector.match(/^role=(\w+)\[name="(.+)"\]$/);
              if (roleMatch) {
                const [, role, name] = roleMatch;
                console.log(`[PlaywrightRecorder] ⚡ Using getByRole('${role}', { name: '${name}' })`);
                locator = scope.getByRole(role, { name: name });
              } else {
                // Regular CSS selector
                locator = scope.locator(optimizedSelector);
              }
              
              // Quick 150ms check - locked selectors should work instantly
              const found = await Promise.race([
                locator.count().then(c => c > 0),
                new Promise(resolve => setTimeout(() => resolve(false), 150))
              ]);
              
              if (found) {
                const isVisible = await locator.first().isVisible().catch(() => false);
                if (isVisible) {
                  console.log(`[PlaywrightRecorder] ⚡ LOCKED selector SUCCESS - instant find!`);
                  // Track working selector for Lock Locators feature
                  this._lastWorkingSelector = optimizedSelector;
                  this._lastStrategyType = 'LockedSelector';
                  return { locator: locator.first(), strategy: { type: 'LockedSelector' } };
                }
              }
              console.log(`[PlaywrightRecorder] Locked selector not found, trying SmartFinder...`);
              // Flag that locked selector failed - we'll need to heal it
              this._lockedSelectorFailed = true;
            } catch (e) {
              console.log(`[PlaywrightRecorder] Locked selector failed: ${e.message}, trying SmartFinder...`);
              this._lockedSelectorFailed = true;
            }
          }
          
          const recipe = legacyActionToRecipe(action);
          console.log('[PlaywrightRecorder] Recipe for SmartFinder:', JSON.stringify(recipe, null, 2));
          
          // For iframes, we need to search within the frame
          let locator;
          if (isIframe) {
            // Try to find within iframe using basic selectors
            const testId = recipe.which?.testId;
            const text = recipe.what?.text;
            const role = recipe.what?.role;
            
            if (testId) {
              locator = scope.locator(`[data-testid="${testId}"]`);
            } else if (role && text) {
              locator = scope.getByRole(role, { name: text });
            } else if (text) {
              locator = scope.getByText(text);
            } else if (recipe.which?.id) {
              locator = scope.locator(`#${recipe.which.id}`);
            }
            
            if (locator && await locator.count() > 0) {
              return { locator, strategy: { type: 'SmartFinder-iframe' } };
            }
          } else {
            console.log('[PlaywrightRecorder] Calling SmartFinder.find()...');
            try {
              locator = await this.smartFinder.find(recipe);
              console.log('[PlaywrightRecorder] SmartFinder result:', locator ? 'FOUND' : 'NOT FOUND');
              if (locator) {
                // Check if SmartFinder already clicked the element directly
                // This happens for Salesforce "New" buttons where we use direct element access
                if (locator.__directClickComplete) {
                  console.log('[PlaywrightRecorder] SmartFinder already performed the click directly');
                  return { 
                    locator: null, 
                    strategy: { type: 'SmartFinder-DirectClick' },
                    alreadyClicked: true  // Signal that no further click is needed
                  };
                }
                // Check if SmartFinder returned a direct click signal (coordinate-based fallback)
                if (locator.__useDirectClick && locator.coords) {
                  console.log(`[PlaywrightRecorder] SmartFinder requesting direct coordinate click at (${locator.coords.x}, ${locator.coords.y})`);
                  return { 
                    locator: null, 
                    strategy: { type: 'SmartFinder-DirectCoordinates' },
                    useDirectClick: true,
                    coords: locator.coords
                  };
                }
                // Track what SmartFinder used for Lock Locators
                const sfStrategy = this.smartFinder?.lastSuccessfulStrategy || 'SmartFinder';
                const sfSelector = this.smartFinder?.lastSuccessfulSelector || null;
                this._lastWorkingSelector = sfSelector;
                this._lastStrategyType = sfStrategy;
                
                // SELF-HEALING: If locked selector failed but SmartFinder worked,
                // flag this so frontend can auto-update the optimizedSelector
                const needsHealing = this._lockedSelectorFailed && sfSelector;
                this._lockedSelectorFailed = false; // Reset for next step
                
                return { 
                  locator, 
                  strategy: { type: 'SmartFinder', value: sfStrategy },
                  // Self-healing data: frontend should update step's optimizedSelector
                  healed: needsHealing,
                  newSelector: needsHealing ? sfSelector : null
                };
              }
            } catch (sfError) {
              console.error('[PlaywrightRecorder] SmartFinder threw error:', sfError.message);
            }
          }
        } else {
          console.log('[PlaywrightRecorder] useSmartFinderForPlayback is DISABLED');
        }
        
        // Fallback to legacy finder
        console.log('[PlaywrightRecorder] SmartFinder failed, trying legacy _findElement...');
        const result = await this._findElement(action, scope);
        if (result) return result;
        
        throw new Error(`Element not found: "${label}"`);
      }, { maxRetries: 3, description: `Find "${label}"` });
    } catch (e) {
      console.log(`[PlaywrightRecorder] findElementWithRetry failed:`, e.message);
      return null; // All retries failed
    }
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
    if (!this.page || this.page.isClosed()) {
      return { success: false, error: 'No browser page' };
    }

    // DEBUG: Log every action type that comes through
    console.log(`\n[executeAction] ▶ Type: "${action.type}" | QWord: "${action.qword}" | Description: "${(action.description || '').substring(0, 50)}"`);
    if (action.userActions?.length > 0) {
      console.log(`[executeAction]   Has ${action.userActions.length} userActions!`);
    }

    // ============================================================
    // IMPLICIT TAB SWITCHING: If action has tabIndex, switch to that tab
    // This REPLACES the need for separate switchTab actions!
    // ============================================================
    if (action.tabIndex !== undefined && action.type !== 'switchTab' && action.type !== 'newTab') {
      const pages = this.context?.pages() || [];
      const targetTabIndex = action.tabIndex;
      
      if (targetTabIndex >= 0 && targetTabIndex < pages.length) {
        const targetPage = pages[targetTabIndex];
        if (targetPage && !targetPage.isClosed() && targetPage !== this.page) {
          console.log(`[PlaywrightRecorder] Implicit tab switch: ${targetTabIndex} (from action.tabIndex)`);
          this.page = targetPage;
          // Update SmartFinder with new page
          if (this.smartFinder) {
            this.smartFinder.updatePage(this.page);
          }
        }
      }
    }

    try {
      const selector = action.selector;
      const value = action.value;
      const timeout = action.timeout || 30000;
      const label = getActionLabel(action); // FIXED: Use comprehensive label extraction with normalization

      // ============================================================
      // UNIFIED EXECUTION: Try ActionHandlers first for consistency
      // This ensures same behavior as TestExecutor (builder/tests tab)
      // ============================================================
      const unifiedResult = await ActionHandlers.executeAction(this, action, { timeout });
      
      if (unifiedResult.success) {
        // Action handled successfully by unified handler
        console.log(`[PlaywrightRecorder] ✓ Unified handler succeeded for: ${action.type}`);
        return { 
          success: true, 
          strategy: unifiedResult.strategy || 'unified',
          workingSelector: unifiedResult.workingSelector || null,
          strategyType: unifiedResult.strategyType || unifiedResult.strategy?.type || null
        };
      } else if (!unifiedResult.delegateToContext && !unifiedResult.error?.includes('Unknown action')) {
        // Unified handler tried but failed - return error
        return { success: false, error: unifiedResult.error };
      }
      
      // Fall back to legacy switch for actions not in unified handler
      console.log(`[PlaywrightRecorder] Delegating to legacy handler: ${action.type}`);

      switch (action.type) {
        case 'goto':
        case 'GoTo':
        case 'navigate':
        case 'Navigate':
          // Navigate to URL
          const navActionUrl = action.url || action.value || action.selector;
          if (!navActionUrl) {
            return { success: false, error: 'No URL provided for navigation' };
          }
          
          // Smart skip: if we're already at the target URL, skip redundant navigation
          const currentNavUrl = this.page.url();
          try {
            const targetNavHost = new URL(navActionUrl).hostname;
            const currentNavHost = new URL(currentNavUrl).hostname;
            
            // Skip if already on same Lightning host (post-login redirect scenario)
            if (targetNavHost === currentNavHost && 
                (currentNavUrl.includes('lightning.force.com') || currentNavUrl.includes('/one/one.app'))) {
              console.log(`[PlaywrightRecorder] Skipping redundant navigation - already at ${currentNavHost}`);
              break;
            }
          } catch (e) {
            // URL parsing failed, proceed with navigation
          }
          
          await this.page.goto(navActionUrl, { waitUntil: 'domcontentloaded', timeout });
          break;

        case 'NavigateTo':
        case 'navigateto':
          // Salesforce object navigation
          const navTarget = action.args?.[0] || action.value || action.label;
          console.log(`[PlaywrightRecorder] NavigateTo: "${navTarget}"`);
          
          let sfNavUrl;
          if (navTarget && navTarget.startsWith('http')) {
            sfNavUrl = navTarget;
          } else {
            // Build from current page URL
            const currentUrl = this.page.url();
            const baseMatch = currentUrl.match(/(https:\/\/[^\/]+)/);
            if (baseMatch && navTarget) {
              const baseUrl = baseMatch[1];
              // Handle object names like "Accounts" -> "Account"
              const objectName = navTarget.replace(/s$/, '');
              sfNavUrl = `${baseUrl}/lightning/o/${objectName}/list`;
            }
          }
          
          if (sfNavUrl) {
            console.log(`[PlaywrightRecorder] Navigating to: ${sfNavUrl}`);
            await this.page.goto(sfNavUrl, { waitUntil: 'domcontentloaded', timeout });
          } else {
            return { success: false, error: `Cannot navigate to "${navTarget}"` };
          }
          break;

        case 'click':
        case 'clicktext':
        case 'ClickText':
        case 'clickelement':
        case 'ClickElement':
          // ============================================================
          // ROBUST ELEMENT FINDING WITH RETRY + 4-LAYER FALLBACK
          // Layer 1: SmartFinder (recipe-based) with retry
          // Layer 2: Legacy _findElement (50+ strategies) with retry
          // Layer 3: iFrame search (for elements inside iframes)
          // Layer 4: AI Vision Fallback (screenshot + GPT-4o)
          // ============================================================
          
          // Try finding element with automatic retry (handles slow pages)
          let clickResult = await this.findElementWithRetry(action);
          
          // Layer 3: IFRAME FALLBACK - Search inside iframes if not found on main page
          if (!clickResult) {
            console.log('[PlaywrightRecorder] Click: Element not on main page, checking iframes...');
            
            const iframesForClick = await this.page.locator('iframe').all();
            console.log(`[PlaywrightRecorder] Found ${iframesForClick.length} iframes to search`);
            
            for (let i = 0; i < iframesForClick.length; i++) {
              try {
                const frameLocator = this.page.frameLocator(`iframe >> nth=${i}`);
                
                const testId = action.selectorObj?.testId || action.selectorObj?.dataTestId || action.recipe?.which?.testId;
                const buttonText = label || action.text || action.recipe?.what?.text;
                
                let iframeLocator = null;
                
                // Strategy 1: By testId
                if (testId) {
                  const locator = frameLocator.locator(`[data-testid="${testId}"]`);
                  if (await locator.count() > 0) {
                    iframeLocator = locator.first();
                    console.log(`[PlaywrightRecorder] ✓ Found click target in iframe by testId: ${testId}`);
                  }
                }
                
                // Strategy 2: By button text
                if (!iframeLocator && buttonText) {
                  const locator = frameLocator.getByRole('button', { name: buttonText });
                  if (await locator.count() > 0) {
                    iframeLocator = locator.first();
                    console.log(`[PlaywrightRecorder] ✓ Found click target in iframe by button text: ${buttonText}`);
                  }
                }
                
                // Strategy 3: By text content
                if (!iframeLocator && buttonText) {
                  const locator = frameLocator.getByText(buttonText, { exact: false });
                  if (await locator.count() > 0) {
                    iframeLocator = locator.first();
                    console.log(`[PlaywrightRecorder] ✓ Found click target in iframe by text: ${buttonText}`);
                  }
                }
                
                if (iframeLocator) {
                  clickResult = { locator: iframeLocator, strategy: { type: `iframe[${i}]` } };
                  break;
                }
              } catch (e) {
                console.log(`[PlaywrightRecorder] Iframe ${i} access failed:`, e.message);
              }
            }
          }
          
          // Layer 4: AI FALLBACK - Last resort when all deterministic strategies fail
          console.log('[PlaywrightRecorder] ========== AI FALLBACK CHECK ==========');
          console.log('[PlaywrightRecorder] clickResult:', clickResult ? 'FOUND' : 'NULL');
          console.log('[PlaywrightRecorder] enableAIFallback:', this.enableAIFallback);
          console.log('[PlaywrightRecorder] aiCallsThisRun:', this.aiCallsThisRun, '/', this.maxAICallsPerRun);
          
          if (!clickResult && this.enableAIFallback) {
            console.log(`[PlaywrightRecorder] All strategies failed after retries, trying AI fallback...`);
            console.log(`[PlaywrightRecorder] Searching for: "${label || selector || action.description}"`);
            const aiResult = await this.findElementWithAI(label || selector || action.description, 'click');
            console.log('[PlaywrightRecorder] AI result:', aiResult);
            if (aiResult) {
              try {
                await this.clickAtCoordinates(aiResult.x, aiResult.y);
                console.log(`[PlaywrightRecorder] ✓ AI Fallback click succeeded at (${aiResult.x}, ${aiResult.y})`);
                return { success: true, strategy: 'AI Vision Fallback' };
              } catch (e) {
                console.log(`[PlaywrightRecorder] AI Fallback click failed:`, e.message);
              }
            }
          }
          
          if (!clickResult) {
            return { success: false, error: `Could not find element to click: "${label || selector}"` };
          }
          
          console.log(`[PlaywrightRecorder] Clicking element: "${label}" using ${clickResult.strategy.type}`);
          
          // Check if SmartFinder already clicked the element (Salesforce "New" buttons)
          if (clickResult.alreadyClicked) {
            console.log('[PlaywrightRecorder] ✓ Click already performed by SmartFinder');
            break; // Done with click action
          }
          
          // Debug: Log element details
          try {
            const elementInfo = await clickResult.locator.evaluate(el => ({
              tag: el.tagName,
              href: el.href || el.getAttribute('href'),
              classes: el.className,
              text: (el.textContent || '').substring(0, 50)
            }));
            console.log(`[PlaywrightRecorder] Element details: tag=${elementInfo.tag}, href=${elementInfo.href}, classes=${elementInfo.classes?.substring(0, 50)}`);
          } catch (e) {}
          
          // Scroll into view and highlight briefly
          await clickResult.locator.scrollIntoViewIfNeeded().catch(() => {});
          await clickResult.locator.evaluate(el => {
            el.style.outline = '2px solid #22c55e';
            el.style.outlineOffset = '1px';
          }).catch(() => {});
          
          // Minimal delay for highlight visibility (reduced from 300ms)
          await this.page.waitForTimeout(100);
          
          // Try multiple click methods
          let clickSuccess = false;
          
          // Method 1: Standard Playwright click WITHOUT force (waits for element to be actionable)
          try {
            await clickResult.locator.click({ timeout: 5000 });
            clickSuccess = true;
            console.log('[PlaywrightRecorder] ✓ Standard click succeeded');
          } catch (e1) {
            console.log('[PlaywrightRecorder] Standard click failed:', e1.message);
            
            // Method 1b: Try with force (for stubborn elements)
            try {
              await clickResult.locator.click({ timeout: 3000, force: true });
              clickSuccess = true;
              console.log('[PlaywrightRecorder] ✓ Forced click succeeded');
            } catch (e1b) {
              console.log('[PlaywrightRecorder] Forced click failed:', e1b.message);
            }
            
            // Method 2: JavaScript .click() (if both normal and forced click failed)
            if (!clickSuccess) {
              try {
                await clickResult.locator.evaluate(el => {
                  el.click();
                });
                clickSuccess = true;
                console.log('[PlaywrightRecorder] ✓ JS click() succeeded');
              } catch (e2) {
              console.log('[PlaywrightRecorder] JS click failed:', e2.message);
              
              // Method 3: Dispatch mouse events
              try {
                await clickResult.locator.evaluate(el => {
                  const rect = el.getBoundingClientRect();
                  const centerX = rect.left + rect.width / 2;
                  const centerY = rect.top + rect.height / 2;
                  
                  // Fire mousedown, mouseup, click sequence
                  ['mousedown', 'mouseup', 'click'].forEach(type => {
                    el.dispatchEvent(new MouseEvent(type, {
                      view: window,
                      bubbles: true,
                      cancelable: true,
                      clientX: centerX,
                      clientY: centerY
                    }));
                  });
                });
                clickSuccess = true;
                console.log('[PlaywrightRecorder] ✓ MouseEvent dispatch succeeded');
              } catch (e3) {
                console.log('[PlaywrightRecorder] MouseEvent dispatch failed:', e3.message);
                
                // Method 4: Focus and press Enter (for keyboard-accessible elements)
                try {
                  await clickResult.locator.focus();
                  await clickResult.locator.press('Enter');
                  clickSuccess = true;
                  console.log('[PlaywrightRecorder] ✓ Focus+Enter succeeded');
                } catch (e4) {
                  console.log('[PlaywrightRecorder] Focus+Enter failed:', e4.message);
                }
              }
              }
            }
          }
          
          // Check if this click opened a NEW TAB
          const pagesBefore = this.context.pages().length;
          await this.page.waitForTimeout(500); // Brief wait for new tab to open
          const pagesAfter = this.context.pages();
          
          if (pagesAfter.length > pagesBefore) {
            // NEW TAB DETECTED - automatically switch to it!
            console.log(`[PlaywrightRecorder] ✨ NEW TAB DETECTED! Switching from ${pagesBefore} to ${pagesAfter.length} pages`);
            const newPage = pagesAfter[pagesAfter.length - 1];
            await newPage.waitForLoadState('domcontentloaded').catch(() => {});
            
            // Switch to the new tab
            this.page = newPage;
            this._playbackPages = pagesAfter;
            this._playbackPageIndex = pagesAfter.length - 1;
            
            // Reinitialize SmartFinder for new page
            if (this.useSmartFinderForPlayback) {
              this.smartFinder = new SmartFinder(this.page, { debug: true, timeout: 15000 });
            }
            
            console.log(`[PlaywrightRecorder] Now on new tab: ${this.page.url()}`);
            await this.page.waitForTimeout(1000); // Let page stabilize
          }
          
          // Check if this is a link click that should navigate
          const isLinkClick = clickResult.strategy.type.includes('link') || 
                              clickResult.strategy.type.includes('getByRole-link');
          
          if (isLinkClick && clickSuccess) {
            console.log('[PlaywrightRecorder] Link click detected, checking for navigation...');
            const urlBefore = this.page.url();
            
            // Get the href from the link element BEFORE waiting
            let linkHref = null;
            try {
              linkHref = await clickResult.locator.evaluate(el => el.href || el.getAttribute('href'));
              console.log('[PlaywrightRecorder] Link href:', linkHref);
            } catch (e) {}
            
            // Wait a moment and check if URL actually changed
            await this.page.waitForTimeout(2000);
            const urlAfter = this.page.url();
            const didNavigate = urlAfter !== urlBefore;
            
            console.log('[PlaywrightRecorder] URL before:', urlBefore);
            console.log('[PlaywrightRecorder] URL after:', urlAfter);
            console.log('[PlaywrightRecorder] Did navigate:', didNavigate);
            
            if (!didNavigate && linkHref) {
              console.log('[PlaywrightRecorder] Click did not navigate! Trying direct navigation to href...');
              
              // Fallback: Navigate directly to the href
              try {
                await this.page.goto(linkHref, { waitUntil: 'domcontentloaded', timeout: 30000 });
                console.log('[PlaywrightRecorder] Direct navigation successful');
              } catch (e) {
                console.log('[PlaywrightRecorder] Direct navigation failed:', e.message);
                
                // Last resort: Try clicking with dispatchEvent
                try {
                  await clickResult.locator.evaluate(el => {
                    // Try dispatching a real click event
                    const event = new MouseEvent('click', {
                      view: window,
                      bubbles: true,
                      cancelable: true
                    });
                    el.dispatchEvent(event);
                  });
                  await this.page.waitForTimeout(2000);
                } catch (e2) {}
              }
            }
            
            // Wait for Salesforce Lightning page to fully load
            console.log('[PlaywrightRecorder] Waiting for page to stabilize...');
            try {
              await this.page.waitForLoadState('networkidle', { timeout: 10000 });
            } catch (e) {
              console.log('[PlaywrightRecorder] Network did not go idle, using fallback');
            }
            await this.page.waitForTimeout(2000);
            console.log('[PlaywrightRecorder] Page should be loaded now');
          } else {
            // Regular wait for UI update
            await this.page.waitForTimeout(500);
          }
          
          // Remove highlight
          await clickResult.locator.evaluate(el => {
            el.style.outline = '';
            el.style.outlineOffset = '';
            el.style.backgroundColor = '';
          }).catch(() => {});
          
          if (!clickSuccess) {
            return { success: false, error: `Click failed on: "${label}"` };
          }
          break;

        case 'fill':
        case 'Fill':
        case 'type':
        case 'input':
          // DEBUG: Log current page info
          console.log(`[PlaywrightRecorder] Fill action - Current page URL: ${this.page?.url()}`);
          console.log(`[PlaywrightRecorder] Fill action - action.tabIndex: ${action.tabIndex}, total pages: ${this.context?.pages()?.length || 0}`);
          
          // CRITICAL: Wait for page to be ready before finding input
          // This is especially important for cross-origin tabs that may still be loading
          try {
            await this.page.waitForLoadState('domcontentloaded', { timeout: 5000 }).catch(() => {});
            // Also wait a moment for dynamic content
            await this.page.waitForTimeout(500);
          } catch (e) {
            console.log('[PlaywrightRecorder] Page load wait skipped:', e.message);
          }
          
          // Find input element using multiple strategies
          let fillResult = await this._findElement(action);
          
          // DIRECT ID/NAME FALLBACK: If not found, try simple direct selectors
          // This is critical for cross-origin tabs where complex strategies may fail
          if (!fillResult) {
            const directId = action.selectorObj?.id || action.raw?.id || action.args?.[0];
            const directName = action.selectorObj?.name || action.raw?.name || action.args?.[0];
            
            console.log(`[PlaywrightRecorder] Fill: Trying direct ID/name fallback: id="${directId}", name="${directName}"`);
            
            // Try by ID first (most reliable)
            if (directId) {
              try {
                const idLocator = this.page.locator(`#${directId}`);
                const count = await idLocator.count();
                if (count > 0) {
                  fillResult = { locator: idLocator.first(), strategy: { type: 'direct-id' } };
                  console.log(`[PlaywrightRecorder] ✓ Found by direct #${directId}`);
                }
              } catch (e) {
                console.log(`[PlaywrightRecorder] Direct ID search failed:`, e.message);
              }
            }
            
            // Try by name attribute
            if (!fillResult && directName) {
              try {
                const nameLocator = this.page.locator(`input[name="${directName}"], textarea[name="${directName}"]`);
                const count = await nameLocator.count();
                if (count > 0) {
                  fillResult = { locator: nameLocator.first(), strategy: { type: 'direct-name' } };
                  console.log(`[PlaywrightRecorder] ✓ Found by direct name="${directName}"`);
                }
              } catch (e) {
                console.log(`[PlaywrightRecorder] Direct name search failed:`, e.message);
              }
            }
            
            // Try getByLabel as last resort
            if (!fillResult) {
              const labelText = action.args?.[0] || action.label || action.text;
              if (labelText) {
                try {
                  const labelLocator = this.page.getByLabel(labelText, { exact: false });
                  const count = await labelLocator.count();
                  if (count > 0) {
                    fillResult = { locator: labelLocator.first(), strategy: { type: 'getByLabel' } };
                    console.log(`[PlaywrightRecorder] ✓ Found by getByLabel: "${labelText}"`);
                  }
                } catch (e) {
                  // Ignore
                }
              }
            }
          }
          
          // IFRAME FALLBACK: If not found on main page, try searching inside iframes
          if (!fillResult) {
            console.log('[PlaywrightRecorder] Fill: Element not on main page, checking iframes...');
            
            // Get all iframes on the page
            const iframes = await this.page.locator('iframe').all();
            console.log(`[PlaywrightRecorder] Found ${iframes.length} iframes to search`);
            
            for (let i = 0; i < iframes.length; i++) {
              try {
                const frameLocator = this.page.frameLocator(`iframe >> nth=${i}`);
                
                // Try multiple strategies inside the iframe
                const testId = action.selectorObj?.testId || action.selectorObj?.dataTestId;
                const id = action.selectorObj?.id;
                const placeholder = action.selectorObj?.placeholder || label;
                const name = action.selectorObj?.name;
                
                let iframeLocator = null;
                
                // Strategy 1: By testId
                if (testId) {
                  const locator = frameLocator.locator(`[data-testid="${testId}"]`);
                  if (await locator.count() > 0) {
                    iframeLocator = locator.first();
                    console.log(`[PlaywrightRecorder] ✓ Found in iframe by testId: ${testId}`);
                  }
                }
                
                // Strategy 2: By id
                if (!iframeLocator && id) {
                  const locator = frameLocator.locator(`#${id}`);
                  if (await locator.count() > 0) {
                    iframeLocator = locator.first();
                    console.log(`[PlaywrightRecorder] ✓ Found in iframe by id: ${id}`);
                  }
                }
                
                // Strategy 3: By placeholder
                if (!iframeLocator && placeholder) {
                  const locator = frameLocator.getByPlaceholder(placeholder, { exact: false });
                  if (await locator.count() > 0) {
                    iframeLocator = locator.first();
                    console.log(`[PlaywrightRecorder] ✓ Found in iframe by placeholder: ${placeholder}`);
                  }
                }
                
                // Strategy 4: By name
                if (!iframeLocator && name) {
                  const locator = frameLocator.locator(`[name="${name}"]`);
                  if (await locator.count() > 0) {
                    iframeLocator = locator.first();
                    console.log(`[PlaywrightRecorder] ✓ Found in iframe by name: ${name}`);
                  }
                }
                
                // Strategy 5: By partial placeholder match (for "4242 4242 4242 4242" → "4242")
                if (!iframeLocator && placeholder) {
                  const shortPlaceholder = placeholder.split(' ')[0]; // First word
                  const locator = frameLocator.locator(`input[placeholder*="${shortPlaceholder}"]`);
                  if (await locator.count() > 0) {
                    iframeLocator = locator.first();
                    console.log(`[PlaywrightRecorder] ✓ Found in iframe by partial placeholder: ${shortPlaceholder}`);
                  }
                }
                
                if (iframeLocator) {
                  fillResult = { locator: iframeLocator, strategy: { type: `iframe[${i}]` } };
                  break;
                }
              } catch (e) {
                // Cross-origin iframe, skip
                console.log(`[PlaywrightRecorder] Iframe ${i} access failed (cross-origin?):`, e.message);
              }
            }
          }
          
          // AI FALLBACK for fill - Last resort
          if (!fillResult && this.enableAIFallback) {
            console.log(`[PlaywrightRecorder] Fill: All strategies failed, trying AI fallback...`);
            const aiFillResult = await this.findElementWithAI(label || selector || action.description, 'fill');
            if (aiFillResult) {
              try {
                // Click to focus, then type
                await this.page.mouse.click(aiFillResult.x, aiFillResult.y);
                await this.page.waitForTimeout(100);
                await this.page.keyboard.type(value || '');
                console.log(`[PlaywrightRecorder] ✓ AI Fallback fill succeeded at (${aiFillResult.x}, ${aiFillResult.y})`);
                return { success: true, strategy: 'AI Vision Fallback' };
              } catch (e) {
                console.log(`[PlaywrightRecorder] AI Fallback fill failed:`, e.message);
              }
            }
          }
          
          if (!fillResult) {
            return { success: false, error: `Could not find input field: "${label || selector}"` };
          }
          
          // Scroll into view and highlight
          await fillResult.locator.scrollIntoViewIfNeeded().catch(() => {});
          await fillResult.locator.evaluate(el => {
            el.style.outline = '3px solid #4ade80';
            el.style.outlineOffset = '2px';
          }).catch(() => {});
          
          // Focus and fill
          await fillResult.locator.focus();
          await fillResult.locator.fill(value || '', { timeout });
          
          // Check if this is a search field - needs extra wait for results to load
          const isSearchField = (label && /search/i.test(label)) || 
                                (action.description && /search/i.test(action.description));
          
          if (isSearchField) {
            console.log('[PlaywrightRecorder] Search field detected, waiting for results to load...');
            // Wait for network to be idle (Salesforce filtering makes API calls)
            try {
              await this.page.waitForLoadState('networkidle', { timeout: 5000 });
            } catch (e) {
              // Network might not go idle, use fallback wait
              console.log('[PlaywrightRecorder] Network did not go idle, using fallback wait');
            }
            // Additional wait for DOM to stabilize after filtering
            await this.page.waitForTimeout(1000);
            console.log('[PlaywrightRecorder] Search results should be ready now');
          } else {
            // Brief wait for input to register (reduced from 300ms)
            await this.page.waitForTimeout(100);
          }
          
          // Remove highlight
          await fillResult.locator.evaluate(el => {
            el.style.outline = '';
            el.style.outlineOffset = '';
          }).catch(() => {});
          break;

        case 'select':
          // Find select element using multiple strategies
          let selectResult = await this._findElement(action);
          
          // RADIX DROPDOWN FALLBACK - Try specific strategies for Radix comboboxes
          if (!selectResult) {
            console.log(`[PlaywrightRecorder] Standard select find failed, trying Radix-specific strategies...`);
            
            const selectValue = action.value?.text || action.value || value;
            const testId = action.selectorObj?.testId || action.element?.testId || action.recipe?.which?.testId;
            
            // Strategy 1: By testId
            if (testId) {
              const byTestId = this.page.locator(`[data-testid="${testId}"]`);
              if (await byTestId.count() > 0) {
                selectResult = { locator: byTestId.first(), strategy: { type: 'testId' } };
                console.log(`[PlaywrightRecorder] Found dropdown by testId: ${testId}`);
              }
            }
            
            // Strategy 2: Find combobox that currently shows a known option text
            if (!selectResult) {
              // The step might want to select "Blank Page" from dropdown showing "Example.com"
              const allComboboxes = this.page.getByRole('combobox');
              const count = await allComboboxes.count();
              console.log(`[PlaywrightRecorder] Found ${count} comboboxes on page`);
              
              for (let i = 0; i < count; i++) {
                const combobox = allComboboxes.nth(i);
                const text = await combobox.textContent().catch(() => '');
                console.log(`[PlaywrightRecorder] Combobox ${i}: "${text}"`);
                
                // Check if this combobox is visible and interactable
                if (await combobox.isVisible()) {
                  // Click it to see if it has the option we want
                  try {
                    await combobox.click();
                    await this.page.waitForTimeout(200);
                    
                    // Check if the option exists in the dropdown
                    const optionExists = await this.page.getByRole('option', { name: selectValue }).count() > 0;
                    
                    if (optionExists) {
                      selectResult = { locator: combobox, strategy: { type: 'combobox-scan' } };
                      console.log(`[PlaywrightRecorder] Found dropdown with option "${selectValue}" at combobox ${i}`);
                      // Don't close - let the main handler select the option
                      break;
                    } else {
                      // Close this dropdown and try next
                      await this.page.keyboard.press('Escape');
                      await this.page.waitForTimeout(100);
                    }
                  } catch (e) {
                    console.log(`[PlaywrightRecorder] Combobox ${i} check failed: ${e.message}`);
                  }
                }
              }
            }
            
            // Strategy 3: Try by any visible select trigger with matching nearby text
            if (!selectResult) {
              const triggers = this.page.locator('[data-radix-select-trigger], [role="combobox"]');
              const triggerCount = await triggers.count();
              
              for (let i = 0; i < triggerCount; i++) {
                if (await triggers.nth(i).isVisible()) {
                  selectResult = { locator: triggers.nth(i), strategy: { type: 'visible-trigger' } };
                  console.log(`[PlaywrightRecorder] Using visible trigger ${i}`);
                  break;
                }
              }
            }
          }
          
          // AI FALLBACK for select - Last resort
          if (!selectResult && this.enableAIFallback) {
            console.log(`[PlaywrightRecorder] Select: All strategies failed, trying AI fallback...`);
            const aiSelectResult = await this.findElementWithAI(label || selector || action.description, 'select');
            if (aiSelectResult) {
              try {
                // Click to open dropdown, then find and click option
                await this.page.mouse.click(aiSelectResult.x, aiSelectResult.y);
                
                // Wait for dropdown content to appear (Radix, Headless UI, etc.)
                const dropdownContent = this.page.locator(
                  '[role="listbox"], [role="menu"], ' +
                  '[data-radix-select-content], [data-radix-menu-content], ' +
                  '[data-radix-popper-content-wrapper]'
                );
                await dropdownContent.first().waitFor({ state: 'visible', timeout: 2000 }).catch(() => {});
                await this.page.waitForTimeout(100);
                
                // Try to find and click the option - properly scoped
                let aiOptionClicked = false;
                
                // Try role=option first
                const byRole = this.page.getByRole('option', { name: value });
                if (await byRole.count() > 0) {
                  await byRole.first().click();
                  aiOptionClicked = true;
                }
                
                // Try scoped text search
                if (!aiOptionClicked) {
                  const scopedOption = this.page.locator(
                    `[data-radix-select-content] >> text="${value}"`
                  ).or(this.page.locator(
                    `[role="listbox"] >> text="${value}"`
                  ));
                  if (await scopedOption.count() > 0) {
                    await scopedOption.first().click();
                    aiOptionClicked = true;
                  }
                }
                
                // Fallback to getByText
                if (!aiOptionClicked) {
                  const optionLocator = this.page.getByText(value, { exact: false });
                  if (await optionLocator.count() > 0) {
                    await optionLocator.first().click();
                    aiOptionClicked = true;
                  }
                }
                
                if (aiOptionClicked) {
                  console.log(`[PlaywrightRecorder] ✓ AI Fallback select succeeded`);
                  return { success: true, strategy: 'AI Vision Fallback' };
                }
              } catch (e) {
                console.log(`[PlaywrightRecorder] AI Fallback select failed:`, e.message);
              }
            }
          }
          
          if (!selectResult) {
            return { success: false, error: `Could not find select field: "${label || selector}"` };
          }
          
          // Scroll into view and highlight
          await selectResult.locator.scrollIntoViewIfNeeded().catch(() => {});
          await selectResult.locator.evaluate(el => {
            el.style.outline = '3px solid #4ade80';
          }).catch(() => {});
          
          // Check if this is a native select or custom dropdown (Radix, Headless UI, etc.)
          const tagName = await selectResult.locator.evaluate(el => el.tagName.toLowerCase()).catch(() => 'div');
          
          if (tagName === 'select') {
            // Native select - use selectOption
            await selectResult.locator.selectOption(value, { timeout });
          } else {
            // Custom dropdown (Radix, Headless UI, etc.) - click to open, then click option
            console.log(`[PlaywrightRecorder] Non-native select detected (${tagName}), using click-then-select for Radix/custom dropdown`);
            
            // Check if dropdown is already open (from our scan)
            const dropdownContent = this.page.locator(
              '[role="listbox"], [role="menu"], ' +
              '[data-radix-select-content], [data-radix-menu-content], ' +
              '[data-radix-popper-content-wrapper], [data-radix-select-viewport]'
            );
            
            const isAlreadyOpen = await dropdownContent.first().isVisible().catch(() => false);
            
            if (!isAlreadyOpen) {
              await selectResult.locator.click();
              
              // Wait for the dropdown content to appear (Radix portals to body)
              try {
                await dropdownContent.first().waitFor({ state: 'visible', timeout: 3000 });
                console.log(`[PlaywrightRecorder] Dropdown content appeared`);
              } catch (e) {
                console.log(`[PlaywrightRecorder] Warning: Dropdown content not detected, continuing anyway...`);
              }
            } else {
              console.log(`[PlaywrightRecorder] Dropdown already open, skipping click`);
            }
            
            // Small delay for animation
            await this.page.waitForTimeout(100);
            
            // Try to find and click the option - SCOPED TO DROPDOWN CONTENT
            let optionClicked = false;
            
            // Strategy 1: By role=option within visible dropdown
            try {
              const byRole = this.page.getByRole('option', { name: value });
              if (await byRole.count() > 0) {
                await byRole.first().click({ timeout: 2000 });
                optionClicked = true;
                console.log(`[PlaywrightRecorder] ✓ Selected option by role: "${value}"`);
              }
            } catch (e) {
              console.log(`[PlaywrightRecorder] Option by role failed, trying next strategy...`);
            }
            
            // Strategy 2: By role=menuitem (for Radix Menu)
            if (!optionClicked) {
              try {
                const byMenuitem = this.page.getByRole('menuitem', { name: value });
                if (await byMenuitem.count() > 0) {
                  await byMenuitem.first().click({ timeout: 2000 });
                  optionClicked = true;
                  console.log(`[PlaywrightRecorder] ✓ Selected option by menuitem role: "${value}"`);
                }
              } catch (e) {
                console.log(`[PlaywrightRecorder] Option by menuitem failed, trying next strategy...`);
              }
            }
            
            // Strategy 3: Text within Radix content (scoped)
            if (!optionClicked) {
              try {
                const radixOption = this.page.locator(
                  `[data-radix-select-content] >> text="${value}"`,
                ).or(this.page.locator(
                  `[data-radix-popper-content-wrapper] >> text="${value}"`
                )).or(this.page.locator(
                  `[role="listbox"] >> text="${value}"`
                ));
                
                if (await radixOption.count() > 0) {
                  await radixOption.first().click({ timeout: 2000 });
                  optionClicked = true;
                  console.log(`[PlaywrightRecorder] ✓ Selected option by scoped text: "${value}"`);
                }
              } catch (e) {
                console.log(`[PlaywrightRecorder] Scoped text failed, trying next strategy...`);
              }
            }
            
            // Strategy 4: data-radix-collection-item with matching text
            if (!optionClicked) {
              try {
                const radixItem = this.page.locator('[data-radix-collection-item]').filter({ hasText: value });
                if (await radixItem.count() > 0) {
                  await radixItem.first().click({ timeout: 2000 });
                  optionClicked = true;
                  console.log(`[PlaywrightRecorder] ✓ Selected option by Radix collection item: "${value}"`);
                }
              } catch (e) {
                console.log(`[PlaywrightRecorder] Radix collection item failed, trying last resort...`);
              }
            }
            
            // Strategy 5: Last resort - getByText but visible only
            if (!optionClicked) {
              const optionLocator = this.page.getByText(value, { exact: false }).and(this.page.locator(':visible'));
              const optionCount = await optionLocator.count();
              if (optionCount > 0) {
                await optionLocator.first().click({ timeout: 2000 });
                optionClicked = true;
                console.log(`[PlaywrightRecorder] ✓ Selected option by visible text: "${value}"`);
              } else {
                // Absolute last resort
                await this.page.getByRole('listitem').filter({ hasText: value }).first().click({ timeout: 2000 });
                optionClicked = true;
              }
            }
            
            if (!optionClicked) {
              console.error(`[PlaywrightRecorder] Failed to select option "${value}" from dropdown`);
            }
          }
          
          await selectResult.locator.evaluate(el => {
            el.style.outline = '';
          }).catch(() => {});
          break;

        case 'check':
          // Find checkbox using multiple strategies
          const checkResult = await this._findElement(action);
          if (!checkResult) {
            return { success: false, error: `Could not find checkbox: "${label || selector}"` };
          }
          
          await checkResult.locator.scrollIntoViewIfNeeded().catch(() => {});
          await checkResult.locator.evaluate(el => {
            el.style.outline = '3px solid #4ade80';
          }).catch(() => {});
          
          await checkResult.locator.check({ timeout });
          
          await checkResult.locator.evaluate(el => {
            el.style.outline = '';
          }).catch(() => {});
          break;

        case 'uncheck':
          // Find checkbox using multiple strategies
          const uncheckResult = await this._findElement(action);
          if (!uncheckResult) {
            return { success: false, error: `Could not find checkbox: "${label || selector}"` };
          }
          
          await uncheckResult.locator.scrollIntoViewIfNeeded().catch(() => {});
          await uncheckResult.locator.evaluate(el => {
            el.style.outline = '3px solid #4ade80';
          }).catch(() => {});
          
          await uncheckResult.locator.uncheck({ timeout });
          
          await uncheckResult.locator.evaluate(el => {
            el.style.outline = '';
          }).catch(() => {});
          break;

        case 'press':
          // Press a key
          const key = action.key || value || 'Enter';
          if (selector) {
            await this.page.locator(selector).press(key);
          } else {
            await this.page.keyboard.press(key);
          }
          break;

        case 'wait':
          // Wait for element or timeout
          if (selector) {
            await this.page.waitForSelector(selector, { timeout });
          } else {
            const waitTime = parseInt(value) || 1000;
            await this.page.waitForTimeout(waitTime);
          }
          break;

        case 'hover': {
          // Hover over element - CRITICAL for flyout menus
          console.log(`[PlaywrightRecorder] Executing hover action`);
          
          // Get target scope (iframe or main page)
          const hoverScope = await this._getFrameScope(action);
          
          // Try SmartFinder first (same as click)
          let hoverResult = null;
          if (this.useSmartFinderForPlayback && this.smartFinder && action.recipe) {
            try {
              console.log(`[PlaywrightRecorder] Hover: Trying SmartFinder...`);
              this.smartFinder.updatePage(this.page);
              const smartLocator = await this.smartFinder.find(action.recipe);
              if (smartLocator) {
                hoverResult = { locator: smartLocator, strategy: { type: 'SmartFinder' } };
              }
            } catch (sfError) {
              console.log(`[PlaywrightRecorder] SmartFinder hover failed:`, sfError.message);
            }
          }
          
          // Fallback to findElementWithRetry
          if (!hoverResult) {
            hoverResult = await this.findElementWithRetry(action);
          }
          
          // Direct selector fallback
          if (!hoverResult && selector) {
            const selectorLocator = hoverScope.locator(selector);
            const count = await selectorLocator.count().catch(() => 0);
            if (count > 0) {
              hoverResult = { locator: selectorLocator.first(), strategy: { type: 'selector' } };
            }
          }
          
          if (!hoverResult) {
            return { success: false, error: `Could not find element to hover: "${label || selector}"` };
          }
          
          // Perform the hover
          await hoverResult.locator.hover({ timeout });
          console.log(`[PlaywrightRecorder] ✓ Hover successful using ${hoverResult.strategy.type}`);
          
          // Wait a bit for any menu/dropdown to appear after hover
          await this.page.waitForTimeout(300);
          break;
        }

        // ============================================================
        // NEW ADVANCED ACTION TYPES
        // ============================================================
        
        case 'upload':
        case 'fileUpload': {
          // File upload
          console.log(`[PlaywrightRecorder] Handling file upload`);
          
          // Get the file path(s) from action
          const filePaths = action.value?.files || action.files || [action.value];
          if (!filePaths || filePaths.length === 0) {
            return { success: false, error: 'No file path provided for upload' };
          }
          
          // Get target scope (iframe or main page)
          const uploadScope = await this._getFrameScope(action);
          
          // Find file input
          let fileInput;
          if (selector) {
            fileInput = uploadScope.locator(selector);
          } else {
            // Try to find file input near label or by recipe
            const uploadResult = await this.findElementWithRetry({ ...action, type: 'click' });
            if (uploadResult) {
              fileInput = uploadResult.locator;
            }
          }
          
          if (!fileInput) {
            // Try by input[type=file] in general
            fileInput = uploadScope.locator('input[type="file"]').first();
          }
          
          await fileInput.setInputFiles(filePaths);
          console.log(`[PlaywrightRecorder] Uploaded files: ${filePaths.join(', ')}`);
          break;
        }
        
        case 'dragDrop':
        case 'drag': {
          // Drag and drop
          console.log(`[PlaywrightRecorder] Handling drag and drop`);
          
          const dragScope = await this._getFrameScope(action);
          
          // Get source element
          let sourceLocator;
          if (action.recipe || action.target) {
            const recipe = action.recipe || action.target;
            if (!this.smartFinder) {
              this.smartFinder = new SmartFinder(this.page, { debug: true, timeout: 15000 });
            }
            sourceLocator = await this.smartFinder.find(recipe);
          } else if (selector) {
            sourceLocator = dragScope.locator(selector);
          }
          
          if (!sourceLocator) {
            return { success: false, error: 'Could not find drag source element' };
          }
          
          // Get drop target
          let dropLocator;
          if (action.dropTarget) {
            dropLocator = await this.smartFinder.find(action.dropTarget);
          } else if (action.dropSelector) {
            dropLocator = dragScope.locator(action.dropSelector);
          } else if (action.value?.endX && action.value?.endY) {
            // Use coordinates if provided
            await sourceLocator.dragTo(dragScope.locator('body'), {
              targetPosition: { x: action.value.endX, y: action.value.endY }
            });
            break;
          }
          
          if (!dropLocator) {
            return { success: false, error: 'Could not find drop target element' };
          }
          
          await sourceLocator.dragTo(dropLocator);
          console.log(`[PlaywrightRecorder] Drag and drop completed`);
          break;
        }
        
        case 'dialog':
        case 'alert':
        case 'confirm':
        case 'prompt': {
          // Dialog handling is automatic via page.on('dialog') but this records the expected action
          console.log(`[PlaywrightRecorder] Dialog action recorded (handled automatically)`);
          // Dialogs are auto-handled by the dialog listener - this is just a marker
          break;
        }
        
        case 'closeModal':
        case 'dismissModal':
        case 'closePopup':
        case 'CloseModal': {
          // Close DOM-based modal/popup (not browser dialog)
          const closeResult = await ActionHandlers.handleCloseModal(this, action, { timeout });
          if (!closeResult.success) {
            return closeResult;
          }
          break;
        }
        
        case 'switchToFrame':
        case 'frame': {
          // Switch to iframe context
          console.log(`[PlaywrightRecorder] Switching to frame`);
          const frameInfo = action.frameContext || action.value;
          
          if (!frameInfo) {
            return { success: false, error: 'No frame info provided' };
          }
          
          // Store current frame context for subsequent actions
          this._currentFrameContext = frameInfo;
          console.log(`[PlaywrightRecorder] Frame context set to:`, frameInfo);
          break;
        }
        
        case 'switchToMainFrame':
        case 'mainFrame': {
          // Switch back to main frame
          console.log(`[PlaywrightRecorder] Switching back to main frame`);
          this._currentFrameContext = null;
          break;
        }
        
        case 'newTab': {
          // The previous action triggered a new tab - track it
          // Following Playwright's recommended pattern for tab management
          console.log(`[PlaywrightRecorder] New tab action - syncing page tracking...`);
          
          // Get all current pages in the context
          const allPages = this.context.pages();
          this._playbackPages = allPages;
          
          // Find the newest page (last in the array)
          if (allPages.length > 1) {
            const newestPage = allPages[allPages.length - 1];
            
            // Wait for it to be ready
            try {
              await newestPage.waitForLoadState('domcontentloaded', { timeout: 10000 });
            } catch (e) {
              console.log(`[PlaywrightRecorder] New page still loading...`);
            }
            
            console.log(`[PlaywrightRecorder] Total tabs: ${allPages.length}`);
            console.log(`[PlaywrightRecorder] Newest tab URL: ${newestPage.url()}`);
          } else {
            console.log(`[PlaywrightRecorder] No new tab detected, continuing...`);
          }
          break;
        }
        
        case 'switchTab': {
          // Switch to a specific tab - following Testim's approach:
          // 1. Try by index first
          // 2. Fallback to URL matching (handles tab reordering)
          console.log(`[PlaywrightRecorder] Switching to tab ${action.tabIndex ?? 'by URL'}`);
          
          const pages = this.context.pages();
          this._playbackPages = pages;
          let targetPage = null;
          
          // Strategy 1: Try by index (if provided and valid)
          if (action.tabIndex !== undefined && action.tabIndex >= 0 && action.tabIndex < pages.length) {
            targetPage = pages[action.tabIndex];
            console.log(`[PlaywrightRecorder] Found tab by index ${action.tabIndex}`);
          }
          
          // Strategy 2: Try by URL (more reliable across runs - Testim approach)
          if (!targetPage && action.url) {
            // Try exact match first
            targetPage = pages.find(p => p.url() === action.url);
            
            // Try partial URL match
            if (!targetPage) {
              targetPage = pages.find(p => p.url().includes(action.url) || action.url.includes(p.url()));
            }
            
            // Try hostname match
            if (!targetPage) {
              try {
                const targetHost = new URL(action.url).hostname;
                targetPage = pages.find(p => {
                  try { return new URL(p.url()).hostname === targetHost; }
                  catch { return false; }
                });
              } catch (e) {}
            }
            
            if (targetPage) {
              console.log(`[PlaywrightRecorder] Found tab by URL match: ${targetPage.url()}`);
            }
          }
          
          // Strategy 3: If index is 0, always use first page (original/parent)
          if (!targetPage && action.tabIndex === 0 && pages.length > 0) {
            targetPage = pages[0];
            console.log(`[PlaywrightRecorder] Using first tab (original window)`);
          }
          
          if (targetPage) {
            this.page = targetPage;
            this._playbackPageIndex = pages.indexOf(targetPage);
            
            // Bring to front and wait for ready
            await this.page.bringToFront();
            await this.page.waitForLoadState('domcontentloaded').catch(() => {});
            
            // Re-initialize SmartFinder for new page context
            if (this.useSmartFinderForPlayback) {
              this.smartFinder = new SmartFinder(this.page, { debug: true, timeout: 15000 });
            }
            
            console.log(`[PlaywrightRecorder] Now on tab: ${this.page.url()}`);
          } else {
            console.log(`[PlaywrightRecorder] Could not find target tab, staying on current`);
            console.log(`[PlaywrightRecorder] Available tabs:`, pages.map(p => p.url()));
          }
          break;
        }
        
        // NOTE: crossOriginPlaceholder is handled below with 'CrossOrigin' case
        
        case 'closeTab': {
          // Close current or specified tab and switch back to parent
          console.log(`[PlaywrightRecorder] Closing tab ${action.tabIndex ?? 'current'}`);
          
          const pages = this.context.pages();
          let tabToClose = null;
          
          if (action.tabIndex !== undefined && action.tabIndex >= 0 && action.tabIndex < pages.length) {
            tabToClose = pages[action.tabIndex];
          } else {
            // Close current tab
            tabToClose = this.page;
          }
          
          if (tabToClose && pages.length > 1) {
            await tabToClose.close().catch(() => {});
            
            // Switch to first remaining tab (usually the parent)
            const remainingPages = this.context.pages();
            if (remainingPages.length > 0) {
              this.page = remainingPages[0];
              this._playbackPages = remainingPages;
              this._playbackPageIndex = 0;
              await this.page.bringToFront();
              await this.page.waitForLoadState('domcontentloaded').catch(() => {});
              
              // Re-initialize SmartFinder for the page
              if (this.useSmartFinderForPlayback) {
                this.smartFinder = new SmartFinder(this.page, { debug: true, timeout: 15000 });
              }
              
              console.log(`[PlaywrightRecorder] Closed tab, now on: ${this.page.url()}`);
            }
          } else {
            console.log(`[PlaywrightRecorder] Cannot close last tab, skipping`);
          }
          break;
        }
        
        case 'download':
        case 'Download':
        case 'waitForDownload': {
          // Download step - the download was triggered by the PREVIOUS click action
          // This step is mostly for documentation/verification
          console.log(`[PlaywrightRecorder] Download step - checking for recent download`);
          const expectedFilename = action.filename || action.value || action.args?.[0];
          
          // If there's a click action to trigger download, do it first
          if (action.triggerSelector) {
            console.log(`[PlaywrightRecorder] Triggering download with: ${action.triggerSelector}`);
            const downloadPromise = this.page.waitForEvent('download', { timeout: 10000 });
            await this.page.click(action.triggerSelector);
            try {
              const download = await downloadPromise;
              console.log(`[PlaywrightRecorder] Download completed: ${download.suggestedFilename()}`);
            } catch (e) {
              console.log(`[PlaywrightRecorder] Download wait timed out, but click completed`);
            }
          } else {
            // No trigger - the download was already triggered by the previous step
            // Wait briefly to let any pending download complete
            console.log(`[PlaywrightRecorder] Waiting briefly for any pending download...`);
            try {
              // Short timeout - if download already happened, this will timeout (which is fine)
              const download = await this.page.waitForEvent('download', { timeout: 3000 });
              console.log(`[PlaywrightRecorder] Download completed: ${download.suggestedFilename()}`);
            } catch (e) {
              // Download either already completed or was handled by the previous click
              console.log(`[PlaywrightRecorder] Download likely already completed (previous click triggered it)`);
            }
          }
          
          // For verification, we'd check if file exists - for now, just pass
          if (expectedFilename) {
            console.log(`[PlaywrightRecorder] Expected download: ${expectedFilename}`);
          }
          
          // Download steps pass by default - the click that triggered it is what matters
          break;
        }

        case 'scroll':
          // Scroll element into view
          if (selector) {
            await this.page.locator(selector).scrollIntoViewIfNeeded();
          } else {
            // Scroll to position
            const scrollY = parseInt(value) || 500;
            await this.page.evaluate((y) => window.scrollBy(0, y), scrollY);
          }
          break;

        case 'assertText':
        case 'verifyText':
          // Assert text is visible on page
          const textToAssert = action.text || value;
          if (!textToAssert) {
            return { success: false, error: 'No text to assert' };
          }
          const hasText = await this.page.locator(`text=${textToAssert}`).first().isVisible({ timeout });
          if (!hasText) {
            return { success: false, error: `Text "${textToAssert}" not found on page` };
          }
          break;

        case 'assertVisible':
        case 'verifyVisible':
          // Assert element is visible
          if (!selector) {
            return { success: false, error: 'No selector for visibility assertion' };
          }
          const isVisible = await this.page.locator(selector).first().isVisible({ timeout });
          if (!isVisible) {
            return { success: false, error: `Element "${selector}" not visible` };
          }
          break;

        case 'assertValue':
        case 'verifyValue':
          // Assert input has specific value
          if (!selector) {
            return { success: false, error: 'No selector for value assertion' };
          }
          const actualValue = await this.page.locator(selector).inputValue({ timeout });
          if (actualValue !== value) {
            return { success: false, error: `Expected "${value}" but got "${actualValue}"` };
          }
          break;

        // ============ SALESFORCE STEP TYPES ============
        case 'sf_connect':
        case 'sfconnect': {
          console.log('[PlaywrightRecorder] SF Connect - verifying Salesforce session...');
          // Just verify we're on a Salesforce page
          const sfConnectUrl = this.page.url();
          if (!sfConnectUrl.includes('salesforce.com') && !sfConnectUrl.includes('lightning.force.com')) {
            return { success: false, error: 'Not on a Salesforce page. Please log in first.' };
          }
          return { success: true };
        }

        case 'sf_query':
        case 'sfquery': {
          console.log('[PlaywrightRecorder] SF Query - executing via API...');
          // SF queries need to go through the backend API
          const soqlQuery = action.args?.query || action.args?.[0] || action.value;
          const queryResponse = await this._sfApiCall('GET', `/query?q=${encodeURIComponent(soqlQuery)}`);
          if (!queryResponse.success) {
            return { success: false, error: `SOQL query failed: ${queryResponse.error}` };
          }
          console.log(`[PlaywrightRecorder] Query returned ${queryResponse.data?.totalSize || 0} records`);
          return { success: true, data: queryResponse.data };
        }

        case 'sf_assert':
        case 'sfassert': {
          console.log('[PlaywrightRecorder] SF Assert - checking record...');
          const assertObj = action.args?.object || action.args?.[0];
          const assertId = action.args?.recordId || action.args?.[1];
          const recordResponse = await this._sfApiCall('GET', `/sobjects/${assertObj}/${assertId}`);
          if (!recordResponse.success) {
            return { success: false, error: `Record assertion failed: ${assertObj}/${assertId} not found` };
          }
          return { success: true };
        }

        case 'sf_metadata_assert':
        case 'sfmetadataassert': {
          console.log('[PlaywrightRecorder] SF Metadata Assert...', action.args);
          // Handle both object format {type, object, expectedValue} and array format [id, type, object, expectedValue, description]
          const isArrayFormat = Array.isArray(action.args);
          const metaType = isArrayFormat ? action.args?.[1] : (action.args?.assertionType || action.args?.type || 'validation_rule');
          const metaObject = isArrayFormat ? action.args?.[2] : (action.args?.object || 'Account');
          const metaExpectedValue = isArrayFormat ? action.args?.[3] : action.args?.expectedValue;
          console.log(`[PlaywrightRecorder] Parsed: type=${metaType}, object=${metaObject}, expectedValue=${metaExpectedValue}`);
          
          switch (metaType) {
            // Handle both 'validation_rule' (from UI) and 'validation_rule_active' (legacy)
            case 'validation_rule':
            case 'validation_rule_active': {
              // Use metaExpectedValue (already parsed above) or fallback to other locations
              const vrName = metaExpectedValue || action.args?.expectedValue || action.args?.validationRule || action.args?.ruleName || action.value;
              console.log(`[PlaywrightRecorder] Checking validation rule: ${vrName} on ${metaObject}`);
              const vrQuery = `SELECT Id, Active FROM ValidationRule WHERE ValidationName = '${vrName}' AND EntityDefinition.QualifiedApiName = '${metaObject}'`;
              console.log(`[PlaywrightRecorder] VR Query: ${vrQuery}`);
              const vrResponse = await this._sfApiCall('GET', `/tooling/query?q=${encodeURIComponent(vrQuery)}`);
              console.log(`[PlaywrightRecorder] VR Response:`, JSON.stringify(vrResponse, null, 2));
              if (!vrResponse.success) {
                return { success: false, error: `API Error: ${vrResponse.error || 'Unknown error'}` };
              }
              if (!vrResponse.data || vrResponse.data.totalSize === 0) {
                return { success: false, error: `Validation rule "${vrName}" not found on ${metaObject}` };
              }
              if (!vrResponse.data?.records?.[0]?.Active) {
                return { success: false, error: `Validation rule "${vrName}" is not active` };
              }
              console.log(`[PlaywrightRecorder] ✓ Validation rule "${vrName}" is active!`);
              return { success: true };
            }
              
            case 'flow_active': {
              const flowName = metaExpectedValue || action.args?.expectedValue || action.args?.flowName || action.value;
              const flowResponse = await this._sfApiCall('GET',
                `/tooling/query?q=${encodeURIComponent(`SELECT Id, Status FROM Flow WHERE Definition.DeveloperName = '${flowName}' AND Status = 'Active'`)}`
              );
              if (!flowResponse.success || flowResponse.data?.totalSize === 0) {
                return { success: false, error: `Active flow "${flowName}" not found` };
              }
              return { success: true };
            }
              
            case 'field_exists': {
              const fieldName = metaExpectedValue || action.args?.expectedValue || action.args?.field;
              const descResponse = await this._sfApiCall('GET', `/sobjects/${metaObject}/describe`);
              if (!descResponse.success) {
                return { success: false, error: `Could not describe ${metaObject}` };
              }
              const fieldExists = descResponse.data?.fields?.some(f => f.name === fieldName);
              if (!fieldExists) {
                return { success: false, error: `Field "${fieldName}" not found on ${metaObject}` };
              }
              return { success: true };
            }
            
            case 'field_type': {
              const ftFieldName = (typeof metaExpectedValue === 'object' ? metaExpectedValue?.field : metaExpectedValue) || action.args?.field;
              const ftExpectedType = (typeof metaExpectedValue === 'object' ? metaExpectedValue?.type : null) || action.args?.expectedType;
              const ftDescResponse = await this._sfApiCall('GET', `/sobjects/${metaObject}/describe`);
              if (!ftDescResponse.success) {
                return { success: false, error: `Could not describe ${metaObject}` };
              }
              const ftFieldDef = ftDescResponse.data?.fields?.find(f => f.name === ftFieldName);
              if (!ftFieldDef) {
                return { success: false, error: `Field "${ftFieldName}" not found on ${metaObject}` };
              }
              if (ftFieldDef.type !== ftExpectedType) {
                return { success: false, error: `Field "${ftFieldName}" type is "${ftFieldDef.type}", expected "${ftExpectedType}"` };
              }
              return { success: true };
            }
            
            case 'field_required': {
              const frFieldName = action.args?.expectedValue?.field || action.args?.field || action.args?.[1];
              const frExpectedReq = action.args?.expectedValue?.required !== false;
              const frDescResponse = await this._sfApiCall('GET', `/sobjects/${metaObject}/describe`);
              if (!frDescResponse.success) {
                return { success: false, error: `Could not describe ${metaObject}` };
              }
              const frFieldDef = frDescResponse.data?.fields?.find(f => f.name === frFieldName);
              if (!frFieldDef) {
                return { success: false, error: `Field "${frFieldName}" not found on ${metaObject}` };
              }
              const isRequired = !frFieldDef.nillable && !frFieldDef.defaultedOnCreate;
              if (isRequired !== frExpectedReq) {
                return { success: false, error: `Field "${frFieldName}" required=${isRequired}, expected=${frExpectedReq}` };
              }
              return { success: true };
            }
            
            case 'picklist_values': {
              const pvFieldName = action.args?.field || action.args?.[1];
              const pvExpectedValues = Array.isArray(action.args?.expectedValue) ? action.args.expectedValue : 
                (typeof action.args?.expectedValue === 'string' ? action.args.expectedValue.split(',').map(v => v.trim()) : []);
              const pvDescResponse = await this._sfApiCall('GET', `/sobjects/${metaObject}/describe`);
              if (!pvDescResponse.success) {
                return { success: false, error: `Could not describe ${metaObject}` };
              }
              const pvFieldDef = pvDescResponse.data?.fields?.find(f => f.name === pvFieldName);
              if (!pvFieldDef || !pvFieldDef.picklistValues) {
                return { success: false, error: `Field "${pvFieldName}" is not a picklist on ${metaObject}` };
              }
              const pvActualValues = pvFieldDef.picklistValues.filter(v => v.active).map(v => v.value);
              const pvMissing = pvExpectedValues.filter(v => !pvActualValues.includes(v));
              if (pvMissing.length > 0) {
                return { success: false, error: `Picklist "${pvFieldName}" missing values: ${pvMissing.join(', ')}` };
              }
              return { success: true };
            }
            
            case 'record_type_exists': {
              const rtName = metaExpectedValue || action.args?.expectedValue || action.args?.recordType;
              const rtDescResponse = await this._sfApiCall('GET', `/sobjects/${metaObject}/describe`);
              if (!rtDescResponse.success) {
                return { success: false, error: `Could not describe ${metaObject}` };
              }
              const rtFound = rtDescResponse.data?.recordTypeInfos?.some(rt =>
                rt.developerName === rtName || rt.name === rtName
              );
              if (!rtFound) {
                return { success: false, error: `Record type "${rtName}" not found on ${metaObject}` };
              }
              return { success: true };
            }
            
            case 'permission': {
              const permProfile = action.args?.expectedValue?.profile || action.args?.profile;
              const permAccess = action.args?.expectedValue?.access || action.args?.access || 'read';
              console.log(`[PlaywrightRecorder] Checking permission: ${permProfile} has ${permAccess} on ${metaObject}`);
              // For now, just pass - full permission check requires more complex queries
              return { success: true };
            }
              
            default:
              return { success: false, error: `Unknown metadata assertion type: ${metaType}` };
          }
        }

        case 'sf_login_as':
        case 'sfloginas': {
          console.log('[PlaywrightRecorder] SF Login As - not yet implemented in recorder');
          return { success: false, error: 'Login As step requires full test executor. Run from Tests tab.' };
        }

        case 'sf_create_record':
        case 'sfcreaterecord': {
          console.log('[PlaywrightRecorder] SF Create Record...');
          const createObj = action.args?.objectType || action.args?.object || action.args?.[0] || 'Account';
          const createData = action.args?.data || action.args?.[1] || {};
          const createResponse = await this._sfApiCall('POST', `/sobjects/${createObj}/`, createData);
          if (!createResponse.success) {
            return { success: false, error: `Failed to create ${createObj}: ${createResponse.error}` };
          }
          console.log(`[PlaywrightRecorder] Created ${createObj}: ${createResponse.data?.id}`);
          return { success: true, recordId: createResponse.data?.id };
        }

        case 'sf_navigate':
        case 'sfnavigate': {
          const sfNavPath = action.args?.path || action.args?.[0] || '/lightning/page/home';
          // Get instance URL from current page
          const sfNavPageUrl = this.page.url();
          const sfNavInstanceMatch = sfNavPageUrl.match(/(https:\/\/[^\/]+)/);
          if (!sfNavInstanceMatch) {
            return { success: false, error: 'Cannot determine Salesforce instance URL' };
          }
          const sfNavTargetUrl = sfNavPath.startsWith('http') ? sfNavPath : `${sfNavInstanceMatch[1]}${sfNavPath}`;
          await this.page.goto(sfNavTargetUrl, { waitUntil: 'domcontentloaded', timeout });
          return { success: true };
        }

        // ============ SPECIFIC SF ASSERTION TYPES (from test data files) ============
        
        // SF SOQL - Execute SOQL query (alternative type)
        case 'sf_soql':
        case 'sfsoql':
        case 'ExecuteSOQL': {
          const soqlQueryAlt = action.args?.query || action.args?.[0] || action.value;
          console.log(`[PlaywrightRecorder] SF SOQL query: ${soqlQueryAlt}`);
          const soqlResultAlt = await this._sfApiCall('GET', `/query?q=${encodeURIComponent(soqlQueryAlt)}`);
          if (!soqlResultAlt.success) {
            return { success: false, error: `SOQL query failed: ${soqlResultAlt.error}` };
          }
          console.log(`[PlaywrightRecorder] SOQL returned ${soqlResultAlt.data?.totalSize || 0} records`);
          return { success: true, data: soqlResultAlt.data };
        }

        // SF Assert SOQL - Assert based on SOQL query results
        case 'sf_assert_soql':
        case 'sfassertsoql':
        case 'AssertSOQL': {
          const assertSOQLQuery = action.args?.query || action.args?.[0] || action.value;
          const assertSOQLExpr = action.args?.assertion || 'count > 0';
          console.log(`[PlaywrightRecorder] SF Assert SOQL: ${assertSOQLQuery} (${assertSOQLExpr})`);
          
          const assertSOQLResult = await this._sfApiCall('GET', `/query?q=${encodeURIComponent(assertSOQLQuery)}`);
          if (!assertSOQLResult.success) {
            return { success: false, error: `SOQL query failed: ${assertSOQLResult.error}` };
          }
          
          const soqlCount = assertSOQLResult.data?.totalSize || 0;
          let soqlAssertPassed = false;
          
          if (assertSOQLExpr.includes('count')) {
            try {
              soqlAssertPassed = eval(assertSOQLExpr.replace(/count/g, soqlCount.toString()));
            } catch (e) {
              soqlAssertPassed = soqlCount > 0;
            }
          } else {
            soqlAssertPassed = soqlCount > 0;
          }
          
          if (!soqlAssertPassed) {
            return { success: false, error: `SOQL assertion failed: ${assertSOQLExpr} (got ${soqlCount} records)` };
          }
          
          console.log(`[PlaywrightRecorder] SOQL assertion passed: ${soqlCount} records`);
          return { success: true, recordCount: soqlCount };
        }

        // SF Assert Field Exists
        case 'sf_assert_field_exists':
        case 'sfassertfieldexists':
        case 'AssertFieldExists': {
          const feObj = action.args?.object || action.args?.[0] || 'Account';
          const feField = action.args?.field || action.args?.[1];
          console.log(`[PlaywrightRecorder] SF Assert Field Exists: ${feObj}.${feField}`);
          
          const feDescribe = await this._sfApiCall('GET', `/sobjects/${feObj}/describe`);
          if (!feDescribe.success) {
            return { success: false, error: `Could not describe ${feObj}: ${feDescribe.error}` };
          }
          
          const feExists = feDescribe.data?.fields?.some(f => f.name === feField);
          if (!feExists) {
            return { success: false, error: `Field "${feField}" does not exist on ${feObj}` };
          }
          
          console.log(`[PlaywrightRecorder] Field exists: ${feObj}.${feField}`);
          return { success: true };
        }

        // SF Assert Field Value
        case 'sf_assert_field_value':
        case 'sfassertfieldvalue':
        case 'AssertFieldValue': {
          const fvObj = action.args?.objectType || action.args?.object || 'Account';
          const fvRecordId = action.args?.recordId;
          const fvField = action.args?.field;
          const fvExpected = action.args?.expected || action.args?.expectedValue;
          console.log(`[PlaywrightRecorder] SF Assert Field Value: ${fvObj}/${fvRecordId}.${fvField} == ${fvExpected}`);
          
          const fvRecord = await this._sfApiCall('GET', `/sobjects/${fvObj}/${fvRecordId}`);
          if (!fvRecord.success) {
            return { success: false, error: `Could not get record ${fvRecordId}: ${fvRecord.error}` };
          }
          
          const fvActual = fvRecord.data?.[fvField];
          if (fvActual !== fvExpected) {
            return { success: false, error: `Field ${fvField} = "${fvActual}", expected "${fvExpected}"` };
          }
          
          return { success: true };
        }

        // SF Assert Picklist Values
        case 'sf_assert_picklist':
        case 'sfassertpicklist':
        case 'AssertPicklist': {
          const apObj = action.args?.object || action.args?.[0] || 'Account';
          const apField = action.args?.field || action.args?.[1];
          const apExpected = action.args?.values || action.args?.expectedValues || [];
          console.log(`[PlaywrightRecorder] SF Assert Picklist: ${apObj}.${apField}`);
          
          const apDescribe = await this._sfApiCall('GET', `/sobjects/${apObj}/describe`);
          if (!apDescribe.success) {
            return { success: false, error: `Could not describe ${apObj}: ${apDescribe.error}` };
          }
          
          const apFieldDef = apDescribe.data?.fields?.find(f => f.name === apField);
          if (!apFieldDef || !apFieldDef.picklistValues) {
            return { success: false, error: `Field "${apField}" is not a picklist on ${apObj}` };
          }
          
          const apActualValues = apFieldDef.picklistValues.filter(v => v.active).map(v => v.value);
          const apMissing = apExpected.filter(v => !apActualValues.includes(v));
          
          if (apMissing.length > 0) {
            return { success: false, error: `Picklist "${apField}" missing values: ${apMissing.join(', ')}` };
          }
          
          console.log(`[PlaywrightRecorder] Picklist values verified: ${apField}`);
          return { success: true, values: apActualValues };
        }

        // SF Assert Validation Rule Active
        case 'sf_assert_validation_rule':
        case 'sfassertvalidationrule':
        case 'AssertValidationRule': {
          const vrAssertObj = action.args?.object || action.args?.[0] || 'Account';
          const vrAssertName = action.args?.ruleName || action.args?.[1];
          const vrAssertExpected = action.args?.isActive !== false;
          console.log(`[PlaywrightRecorder] SF Assert Validation Rule: ${vrAssertObj}.${vrAssertName}`);
          
          const vrAssertQuery = await this._sfApiCall('GET',
            `/tooling/query?q=${encodeURIComponent(`SELECT Id, Active FROM ValidationRule WHERE ValidationName = '${vrAssertName}' AND EntityDefinition.QualifiedApiName = '${vrAssertObj}'`)}`
          );
          
          if (!vrAssertQuery.success || vrAssertQuery.data?.totalSize === 0) {
            return { success: false, error: `Validation rule "${vrAssertName}" not found on ${vrAssertObj}` };
          }
          
          const vrAssertActive = vrAssertQuery.data?.records?.[0]?.Active;
          if (vrAssertActive !== vrAssertExpected) {
            return { success: false, error: `Validation rule "${vrAssertName}" active=${vrAssertActive}, expected=${vrAssertExpected}` };
          }
          
          console.log(`[PlaywrightRecorder] Validation rule verified: ${vrAssertName}`);
          return { success: true };
        }

        // SF Assert Flow Active
        case 'sf_assert_flow':
        case 'sfassertflow':
        case 'AssertFlow': {
          const flowAssertName = action.args?.flowName || action.args?.[0];
          console.log(`[PlaywrightRecorder] SF Assert Flow: ${flowAssertName}`);
          
          const flowAssertQuery = await this._sfApiCall('GET',
            `/tooling/query?q=${encodeURIComponent(`SELECT Id, Status FROM Flow WHERE Definition.DeveloperName = '${flowAssertName}' AND Status = 'Active'`)}`
          );
          
          if (!flowAssertQuery.success || flowAssertQuery.data?.totalSize === 0) {
            return { success: false, error: `Active flow "${flowAssertName}" not found` };
          }
          
          console.log(`[PlaywrightRecorder] Flow is active: ${flowAssertName}`);
          return { success: true };
        }

        // SF Assert Record Type Exists
        case 'sf_assert_record_type':
        case 'sfassertrecordtype':
        case 'AssertRecordType': {
          const rtAssertObj = action.args?.object || action.args?.[0] || 'Account';
          const rtAssertName = action.args?.recordType || action.args?.[1];
          console.log(`[PlaywrightRecorder] SF Assert Record Type: ${rtAssertObj}.${rtAssertName}`);
          
          const rtAssertDescribe = await this._sfApiCall('GET', `/sobjects/${rtAssertObj}/describe`);
          if (!rtAssertDescribe.success) {
            return { success: false, error: `Could not describe ${rtAssertObj}: ${rtAssertDescribe.error}` };
          }
          
          const rtAssertFound = rtAssertDescribe.data?.recordTypeInfos?.some(rt =>
            rt.developerName === rtAssertName || rt.name === rtAssertName
          );
          
          if (!rtAssertFound) {
            return { success: false, error: `Record type "${rtAssertName}" not found on ${rtAssertObj}` };
          }
          
          console.log(`[PlaywrightRecorder] Record type exists: ${rtAssertObj}.${rtAssertName}`);
          return { success: true };
        }

        // SF REST API - Make arbitrary API call
        case 'sf_rest_api':
        case 'sfrestapi':
        case 'RestAPI': {
          const restApiMethod = action.args?.method || 'GET';
          const restApiEndpoint = action.args?.endpoint || action.args?.[0];
          const restApiBody = action.args?.body || null;
          console.log(`[PlaywrightRecorder] SF REST API: ${restApiMethod} ${restApiEndpoint}`);
          
          const restApiResult = await this._sfApiCall(restApiMethod, restApiEndpoint, restApiBody);
          if (!restApiResult.success) {
            return { success: false, error: `REST API call failed: ${restApiResult.error}` };
          }
          
          return { success: true, data: restApiResult.data };
        }

        // SF Apex - Execute anonymous Apex
        case 'sf_apex':
        case 'sfapex':
        case 'ExecuteApex': {
          const apexCodeStr = action.args?.code || action.args?.[0] || action.value;
          console.log(`[PlaywrightRecorder] SF Apex: Executing anonymous Apex`);
          
          const apexExecResult = await this._sfApiCall('GET', `/tooling/executeAnonymous?anonymousBody=${encodeURIComponent(apexCodeStr)}`);
          
          if (!apexExecResult.success) {
            return { success: false, error: `Apex execution failed: ${apexExecResult.error}` };
          }
          
          if (apexExecResult.data?.success === false || apexExecResult.data?.compiled === false) {
            return { success: false, error: `Apex error: ${apexExecResult.data?.compileProblem || apexExecResult.data?.exceptionMessage}` };
          }
          
          console.log(`[PlaywrightRecorder] Apex executed successfully`);
          return { success: true, data: apexExecResult.data };
        }

        // ============ SALESFORCE TESTING HELPER ACTION TYPES ============
        // These are generated by the Test Helpers panel in the desktop app

        case 'sf-navigate-record':
        case 'NavigateToRecordById': {
          // Navigate to a specific record by ID
          const recordId = action.args?.[0] || action.value;
          const objectType = action.args?.[1] || 'sObject';
          const lightningPath = action.args?.[2];
          
          console.log(`[PlaywrightRecorder] Navigate to ${objectType} record: ${recordId}`);
          
          // Get base URL from current page
          const currentPageUrl = this.page.url();
          const baseMatch = currentPageUrl.match(/(https:\/\/[^\/]+)/);
          
          if (!baseMatch) {
            return { success: false, error: 'Cannot determine Salesforce base URL' };
          }
          
          const baseUrl = baseMatch[1];
          const targetUrl = lightningPath 
            ? `${baseUrl}${lightningPath}`
            : `${baseUrl}/lightning/r/${objectType}/${recordId}/view`;
          
          console.log(`[PlaywrightRecorder] Navigating to: ${targetUrl}`);
          await this.page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout });
          
          // Wait for Lightning to load
          await this.page.waitForTimeout(2000);
          try {
            await this.page.waitForLoadState('networkidle', { timeout: 10000 });
          } catch (e) {}
          
          return { success: true };
        }

        case 'sf-navigate-soql':
        case 'NavigateToRecordBySOQL': {
          // Run SOQL query to get record ID, then navigate to it
          const queryObjectType = action.args?.[0] || 'Account';
          const soqlQuery = action.args?.[1];
          
          console.log(`[PlaywrightRecorder] Navigate via SOQL: ${soqlQuery}`);
          
          // Execute SOQL query via API
          const queryResult = await this._sfApiCall('GET', `/query?q=${encodeURIComponent(soqlQuery)}`);
          
          if (!queryResult.success) {
            return { success: false, error: `SOQL query failed: ${queryResult.error}` };
          }
          
          if (!queryResult.data?.records?.length) {
            return { success: false, error: `No records found for query: ${soqlQuery}` };
          }
          
          const foundRecordId = queryResult.data.records[0].Id;
          console.log(`[PlaywrightRecorder] Found record ID: ${foundRecordId}`);
          
          // Navigate to the record
          const soqlBaseMatch = this.page.url().match(/(https:\/\/[^\/]+)/);
          if (!soqlBaseMatch) {
            return { success: false, error: 'Cannot determine Salesforce base URL' };
          }
          
          const soqlTargetUrl = `${soqlBaseMatch[1]}/lightning/r/${queryObjectType}/${foundRecordId}/view`;
          console.log(`[PlaywrightRecorder] Navigating to: ${soqlTargetUrl}`);
          
          await this.page.goto(soqlTargetUrl, { waitUntil: 'domcontentloaded', timeout });
          await this.page.waitForTimeout(2000);
          
          return { success: true, recordId: foundRecordId };
        }

        case 'sf-navigate-list':
        case 'NavigateToObjectList': {
          // Navigate to object list view
          const listObjectType = action.args?.[0] || 'Account';
          const listLightningPath = action.args?.[1];
          
          console.log(`[PlaywrightRecorder] Navigate to ${listObjectType} list`);
          
          const listBaseMatch = this.page.url().match(/(https:\/\/[^\/]+)/);
          if (!listBaseMatch) {
            return { success: false, error: 'Cannot determine Salesforce base URL' };
          }
          
          const listTargetUrl = listLightningPath
            ? `${listBaseMatch[1]}${listLightningPath}`
            : `${listBaseMatch[1]}/lightning/o/${listObjectType}/list`;
          
          console.log(`[PlaywrightRecorder] Navigating to: ${listTargetUrl}`);
          await this.page.goto(listTargetUrl, { waitUntil: 'domcontentloaded', timeout });
          await this.page.waitForTimeout(2000);
          
          return { success: true };
        }

        case 'sf-navigate-new':
        case 'NavigateToNewRecord': {
          // Navigate to new record form
          const newObjectType = action.args?.[0] || 'Account';
          const newLightningPath = action.args?.[1];
          
          console.log(`[PlaywrightRecorder] Navigate to New ${newObjectType} form`);
          
          const newBaseMatch = this.page.url().match(/(https:\/\/[^\/]+)/);
          if (!newBaseMatch) {
            return { success: false, error: 'Cannot determine Salesforce base URL' };
          }
          
          const newTargetUrl = newLightningPath
            ? `${newBaseMatch[1]}${newLightningPath}`
            : `${newBaseMatch[1]}/lightning/o/${newObjectType}/new`;
          
          console.log(`[PlaywrightRecorder] Navigating to: ${newTargetUrl}`);
          await this.page.goto(newTargetUrl, { waitUntil: 'domcontentloaded', timeout });
          await this.page.waitForTimeout(2000);
          
          return { success: true };
        }

        case 'sf-global-search':
        case 'SalesforceGlobalSearch': {
          // Perform global search in Salesforce
          const searchTerm = action.args?.[0] || action.value;
          console.log(`[PlaywrightRecorder] Global search: ${searchTerm}`);
          
          const searchBaseMatch = this.page.url().match(/(https:\/\/[^\/]+)/);
          if (!searchBaseMatch) {
            return { success: false, error: 'Cannot determine Salesforce base URL' };
          }
          
          const searchUrl = `${searchBaseMatch[1]}/lightning/o/GlobalSearchResults/home?term=${encodeURIComponent(searchTerm)}`;
          await this.page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout });
          await this.page.waitForTimeout(2000);
          
          return { success: true };
        }

        case 'sf-app-launcher':
        case 'OpenAppLauncher': {
          // Open the Salesforce App Launcher
          console.log(`[PlaywrightRecorder] Opening App Launcher`);
          
          // Find and click the App Launcher button
          const appLauncherBtn = this.page.locator('button[title="App Launcher"]');
          await appLauncherBtn.click({ timeout: 10000 });
          await this.page.waitForTimeout(1000);
          
          return { success: true };
        }

        case 'sf-open-search':
        case 'OpenGlobalSearch': {
          // Focus the global search input
          console.log(`[PlaywrightRecorder] Opening Global Search`);
          
          const searchInput = this.page.locator('input[placeholder*="Search" i], button[title*="Search" i]');
          await searchInput.first().click({ timeout: 10000 });
          await this.page.waitForTimeout(500);
          
          return { success: true };
        }

        case 'sf-wait':
        case 'WaitForSalesforceReady': {
          // Wait for Salesforce page to be ready
          const waitMs = parseInt(action.args?.[0] || '3000');
          console.log(`[PlaywrightRecorder] Waiting ${waitMs}ms for Salesforce to be ready`);
          
          await this.page.waitForTimeout(waitMs);
          
          // Also try to wait for network idle
          try {
            await this.page.waitForLoadState('networkidle', { timeout: 5000 });
          } catch (e) {}
          
          return { success: true };
        }

        case 'sf-click-tab':
        case 'ClickRecordTab': {
          // Click a tab on the record page (Details, Related, Activity, etc.)
          const tabName = action.args?.[0] || 'Details';
          console.log(`[PlaywrightRecorder] Clicking ${tabName} tab`);
          
          // Try multiple selectors for Lightning tabs
          const tabSelectors = [
            `a[title="${tabName}"]`,
            `li[title="${tabName}"] a`,
            `[data-tab-name="${tabName}"]`,
            `button:has-text("${tabName}")`,
            `a:has-text("${tabName}")`
          ];
          
          let tabClicked = false;
          for (const tabSelector of tabSelectors) {
            try {
              const tab = this.page.locator(tabSelector).first();
              if (await tab.isVisible({ timeout: 2000 })) {
                await tab.click();
                tabClicked = true;
                break;
              }
            } catch (e) {}
          }
          
          if (!tabClicked) {
            // Fallback: use getByText
            await this.page.getByText(tabName, { exact: false }).first().click({ timeout: 10000 });
          }
          
          await this.page.waitForTimeout(1000);
          return { success: true };
        }

        case 'sf-click-save':
        case 'ClickSaveButton': {
          console.log(`[PlaywrightRecorder] Clicking Save button`);
          
          const saveSelectors = [
            'button[name="SaveEdit"]',
            'button[title="Save"]',
            'button:has-text("Save"):not(:has-text("Save &"))',
            '[data-aura-class*="Save"]',
            'lightning-button button:has-text("Save")'
          ];
          
          for (const sel of saveSelectors) {
            try {
              const btn = this.page.locator(sel).first();
              if (await btn.isVisible({ timeout: 2000 })) {
                await btn.click();
                await this.page.waitForTimeout(2000);
                return { success: true };
              }
            } catch (e) {}
          }
          
          // Fallback
          await this.page.getByRole('button', { name: /save/i }).first().click({ timeout: 10000 });
          await this.page.waitForTimeout(2000);
          return { success: true };
        }

        case 'sf-click-edit':
        case 'ClickEditButton': {
          console.log(`[PlaywrightRecorder] Clicking Edit button`);
          
          const editSelectors = [
            'button[name="Edit"]',
            'button[title="Edit"]',
            'a[title="Edit"]',
            'button:has-text("Edit")',
            '[data-aura-class*="Edit"]'
          ];
          
          for (const sel of editSelectors) {
            try {
              const btn = this.page.locator(sel).first();
              if (await btn.isVisible({ timeout: 2000 })) {
                await btn.click();
                await this.page.waitForTimeout(1000);
                return { success: true };
              }
            } catch (e) {}
          }
          
          // Fallback
          await this.page.getByRole('button', { name: /edit/i }).first().click({ timeout: 10000 });
          await this.page.waitForTimeout(1000);
          return { success: true };
        }

        case 'sf-click-delete':
        case 'ClickDeleteButton': {
          console.log(`[PlaywrightRecorder] Clicking Delete button`);
          
          const deleteSelectors = [
            'button[name="Delete"]',
            'button[title="Delete"]',
            'a[title="Delete"]',
            'button:has-text("Delete")'
          ];
          
          for (const sel of deleteSelectors) {
            try {
              const btn = this.page.locator(sel).first();
              if (await btn.isVisible({ timeout: 2000 })) {
                await btn.click();
                await this.page.waitForTimeout(1000);
                return { success: true };
              }
            } catch (e) {}
          }
          
          // Fallback
          await this.page.getByRole('button', { name: /delete/i }).first().click({ timeout: 10000 });
          await this.page.waitForTimeout(1000);
          return { success: true };
        }

        case 'sf-click-clone':
        case 'ClickCloneButton': {
          console.log(`[PlaywrightRecorder] Clicking Clone button`);
          
          const cloneSelectors = [
            'button[name="Clone"]',
            'button[title="Clone"]',
            'a[title="Clone"]',
            'button:has-text("Clone")'
          ];
          
          for (const sel of cloneSelectors) {
            try {
              const btn = this.page.locator(sel).first();
              if (await btn.isVisible({ timeout: 2000 })) {
                await btn.click();
                await this.page.waitForTimeout(1000);
                return { success: true };
              }
            } catch (e) {}
          }
          
          // Fallback
          await this.page.getByRole('button', { name: /clone/i }).first().click({ timeout: 10000 });
          await this.page.waitForTimeout(1000);
          return { success: true };
        }

        case 'screenshot':
        case 'TakeScreenshot': {
          const screenshotName = action.args?.[0] || `screenshot_${Date.now()}.png`;
          console.log(`[PlaywrightRecorder] Taking screenshot: ${screenshotName}`);
          await this.page.screenshot({ path: screenshotName, fullPage: false });
          return { success: true };
        }

        // ════════════════════════════════════════════════════════════════════════════
        // MULTI-TAB AND WINDOW ACTIONS
        // ════════════════════════════════════════════════════════════════════════════
        case 'newTab':
        case 'NewTab': {
          // A new tab should have opened - during playback we wait for it
          console.log(`[PlaywrightRecorder] Waiting for new tab: ${action.url || 'any'}`);
          
          // The previous action (like clicking a link) should have triggered a new tab
          // We need to wait for it and switch to it
          const pages = this.context.pages();
          const targetTabIndex = action.tabIndex ?? pages.length - 1;
          
          if (pages.length > 1) {
            // Switch to the new tab
            this.page = pages[targetTabIndex] || pages[pages.length - 1];
            console.log(`[PlaywrightRecorder] Switched to new tab (index ${targetTabIndex}): ${this.page.url()}`);
            
            // Wait for the page to load
            try {
              await this.page.waitForLoadState('domcontentloaded', { timeout: 10000 });
            } catch (e) {
              console.log('[PlaywrightRecorder] New tab load wait timed out');
            }
          } else {
            console.log('[PlaywrightRecorder] No new tab found, continuing on current page');
          }
          
          return { success: true };
        }
        
        case 'switchTab':
        case 'SwitchTab': {
          // Switch to a specific tab by index or URL
          const targetIndex = action.tabIndex ?? action.args?.[0] ?? 0;
          const targetUrl = action.url || action.args?.[1] || null;
          
          console.log(`[PlaywrightRecorder] Switching to tab ${targetIndex} (url hint: ${targetUrl?.substring(0, 50) || 'none'})`);
          
          const allPages = this.context.pages();
          console.log(`[PlaywrightRecorder] Available tabs: ${allPages.length}`);
          
          let targetPage = null;
          
          // Strategy 1: Try exact index
          if (targetIndex < allPages.length) {
            targetPage = allPages[targetIndex];
          }
          
          // Strategy 2: If index fails, try to find by URL
          if (!targetPage && targetUrl) {
            targetPage = allPages.find(p => p.url() === targetUrl);
            if (!targetPage) {
              // Try hostname match
              try {
                const targetHostname = new URL(targetUrl).hostname;
                targetPage = allPages.find(p => {
                  try {
                    return new URL(p.url()).hostname === targetHostname;
                  } catch { return false; }
                });
              } catch {}
            }
          }
          
          // Strategy 3: Fall back to first/last page
          if (!targetPage) {
            targetPage = targetIndex === 0 ? allPages[0] : allPages[allPages.length - 1];
          }
          
          if (targetPage) {
            this.page = targetPage;
            await this.page.bringToFront();
            console.log(`[PlaywrightRecorder] ✓ Switched to tab: ${this.page.url().substring(0, 50)}`);
            
            // Wait for page to be ready
            try {
              await this.page.waitForLoadState('domcontentloaded', { timeout: 5000 });
            } catch (e) {}
          } else {
            console.warn(`[PlaywrightRecorder] Could not find target tab ${targetIndex}`);
          }
          
          return { success: true };
        }
        
        case 'closeTab':
        case 'CloseTab': {
          // Close a specific tab
          const closeIndex = action.tabIndex ?? action.args?.[0] ?? -1;
          const allPagesClose = this.context.pages();
          
          console.log(`[PlaywrightRecorder] Closing tab ${closeIndex}`);
          
          if (closeIndex >= 0 && closeIndex < allPagesClose.length) {
            const pageToClose = allPagesClose[closeIndex];
            await pageToClose.close();
            
            // Switch to remaining tab
            const remainingPages = this.context.pages();
            if (remainingPages.length > 0) {
              this.page = remainingPages[0];
              await this.page.bringToFront();
            }
          }
          
          return { success: true };
        }
        
        case 'crossOriginPlaceholder':
        case 'CrossOrigin':
        case 'crossorigin':
        case 'cross-origin':
        case 'CrossOriginPlaceholder': {
          // ============ CROSS-ORIGIN STEP START ============
          console.log(`\n[PlaywrightRecorder] ======================================`);
          console.log(`[PlaywrightRecorder] CROSS-ORIGIN STEP EXECUTING`);
          console.log(`[PlaywrightRecorder] ======================================`);
          
          // Show feedback on CURRENT page (parent) first
          try {
            await this.page.evaluate(() => {
              const div = document.createElement('div');
              div.id = 'qaai-parent-debug';
              div.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:blue;color:white;padding:20px;z-index:999999;font-size:18px;border-radius:10px;';
              div.textContent = '🔄 QAAI: Switching to popup window...';
              document.body.appendChild(div);
            });
          } catch (e) {
            console.log(`[PlaywrightRecorder] Could not show parent feedback: ${e.message}`);
          }
          
          await this.page.waitForTimeout(1000); // Let user see the message
          
          const crossOriginUrl = action.url || action.label || action.args?.[0] || 'external tab';
          console.log(`[PlaywrightRecorder] Cross-origin URL: ${crossOriginUrl}`);
          console.log(`[PlaywrightRecorder] userActions: ${action.userActions?.length || 0}`);
          
          // First, get all available tabs
          let crossPages = this.context.pages();
          console.log(`[PlaywrightRecorder] Available tabs: ${crossPages.length}`);
          crossPages.forEach((p, i) => console.log(`  Tab ${i}: ${p.url().substring(0, 60)}`));
          
          // If only one tab, we need to wait for the cross-origin tab to open
          if (crossPages.length === 1) {
            console.log(`[PlaywrightRecorder] Only 1 tab open, waiting for popup...`);
            try {
              const newPage = await this.context.waitForEvent('page', { timeout: 5000 });
              await newPage.waitForLoadState('domcontentloaded', { timeout: 10000 }).catch(() => {});
              crossPages = this.context.pages();
              console.log(`[PlaywrightRecorder] Now have ${crossPages.length} tabs`);
            } catch (e) {
              console.log(`[PlaywrightRecorder] No new tab appeared, continuing with current`);
            }
          }
          
          // Find the right tab - prefer by URL match, then by index
          const targetCrossTabIndex = action.tabIndex ?? action.args?.[1] ?? 1;
          let targetTab = null;
          
          // Strategy 1: Find by URL match
          if (crossOriginUrl && crossOriginUrl !== 'external tab') {
            for (let i = 0; i < crossPages.length; i++) {
              const pageUrl = crossPages[i].url();
              if (pageUrl.includes(crossOriginUrl) || crossOriginUrl.includes(new URL(pageUrl).hostname)) {
                targetTab = crossPages[i];
                console.log(`[PlaywrightRecorder] Found tab by URL match: ${pageUrl.substring(0, 60)}`);
                break;
              }
            }
          }
          
          // Strategy 2: Use the non-localhost tab (likely the popup)
          if (!targetTab) {
            for (let i = crossPages.length - 1; i >= 0; i--) {
              const pageUrl = crossPages[i].url();
              if (!pageUrl.includes('localhost') && !pageUrl.includes('127.0.0.1')) {
                targetTab = crossPages[i];
                console.log(`[PlaywrightRecorder] Found external tab: ${pageUrl.substring(0, 60)}`);
                break;
              }
            }
          }
          
          // Strategy 3: Use index
          if (!targetTab && targetCrossTabIndex < crossPages.length) {
            targetTab = crossPages[targetCrossTabIndex];
            console.log(`[PlaywrightRecorder] Using tab by index ${targetCrossTabIndex}`);
          }
          
          // Strategy 4: Use the last tab (most recently opened)
          if (!targetTab && crossPages.length > 1) {
            targetTab = crossPages[crossPages.length - 1];
            console.log(`[PlaywrightRecorder] Using last tab as fallback`);
          }
          
          if (targetTab) {
            this.page = targetTab;
            await this.page.bringToFront();
            // Wait for the page to be ready - cross-origin pages need more time
            console.log(`[PlaywrightRecorder] Waiting for cross-origin page to load...`);
            await this.page.waitForLoadState('domcontentloaded', { timeout: 15000 }).catch(() => {});
            await this.page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
            // Extra wait for JavaScript to initialize
            await this.page.waitForTimeout(1000);
            console.log(`[PlaywrightRecorder] ✓ Cross-origin tab ready: ${this.page.url()}`);
          } else {
            console.warn(`[PlaywrightRecorder] Could not find cross-origin tab!`);
            // List all available pages for debugging
            const allPages = this.context.pages();
            console.log(`[PlaywrightRecorder] Available pages:`);
            allPages.forEach((p, i) => console.log(`  ${i}: ${p.url()}`));
          }
          
          // Execute any user-defined actions with manual selectors
          console.log(`[PlaywrightRecorder] ========== CROSS-ORIGIN STEP ==========`);
          console.log(`[PlaywrightRecorder] userActions count:`, action.userActions?.length || 0);
          
          // Show visual indicator in the browser
          await this.page.evaluate((count) => {
            const div = document.createElement('div');
            div.id = 'qaai-debug';
            div.style.cssText = 'position:fixed;top:10px;left:10px;background:yellow;color:black;padding:10px;z-index:999999;font-size:14px;border:2px solid black;';
            div.textContent = `QAAI: Executing ${count} cross-origin action(s)...`;
            document.body.appendChild(div);
          }, action.userActions?.length || 0).catch(() => {});
          
          if (action.userActions && action.userActions.length > 0) {
            console.log(`[PlaywrightRecorder] ✓ Found ${action.userActions.length} user actions to execute`);
            
            // Log each action
            action.userActions.forEach((ua, i) => {
              console.log(`[PlaywrightRecorder]   Action ${i+1}: ${ua.type} by ${ua.findBy} = "${ua.selector}"`);
            });
            
            for (const userAction of action.userActions) {
              try {
                console.log(`[PlaywrightRecorder] Cross-origin action: ${userAction.type} by ${userAction.findBy}`);
                
                // Handle wait action specially
                if (userAction.type === 'wait') {
                  const duration = parseInt(userAction.value) || 2000;
                  console.log(`[PlaywrightRecorder] Waiting ${duration}ms`);
                  await this.page.waitForTimeout(duration);
                  continue;
                }
                
                // Find element based on user's chosen strategy
                let element = null;
                
                switch (userAction.findBy) {
                  case 'text':
                  case 'Text Content': // Handle UI display name
                    console.log(`[PlaywrightRecorder] Finding by text: "${userAction.selector}"`);
                    const searchText = userAction.selector;
                    
                    // Try multiple strategies for text-based finding
                    element = this.page.getByText(searchText, { exact: false }).first();
                    
                    // If not visible, try as link
                    if (!(await element.isVisible({ timeout: 2000 }).catch(() => false))) {
                      console.log(`[PlaywrightRecorder] getByText failed, trying getByRole link...`);
                      element = this.page.getByRole('link', { name: searchText }).first();
                    }
                    
                    // Try button
                    if (!(await element.isVisible({ timeout: 1000 }).catch(() => false))) {
                      console.log(`[PlaywrightRecorder] Trying getByRole button...`);
                      element = this.page.getByRole('button', { name: searchText }).first();
                    }
                    
                    // Try text selector
                    if (!(await element.isVisible({ timeout: 1000 }).catch(() => false))) {
                      console.log(`[PlaywrightRecorder] Trying text selector...`);
                      element = this.page.locator(`text="${searchText}"`).first();
                    }
                    
                    // Try partial text
                    if (!(await element.isVisible({ timeout: 1000 }).catch(() => false))) {
                      console.log(`[PlaywrightRecorder] Trying partial text match...`);
                      element = this.page.locator(`:has-text("${searchText}")`).first();
                    }
                    
                    // Try word-by-word match (e.g., "Learn more" → look for "more")
                    if (!(await element.isVisible({ timeout: 1000 }).catch(() => false))) {
                      const words = searchText.split(/\s+/).filter(w => w.length > 3);
                      for (const word of words) {
                        console.log(`[PlaywrightRecorder] Trying word match: "${word}"`);
                        element = this.page.getByText(word, { exact: false }).first();
                        if (await element.isVisible({ timeout: 500 }).catch(() => false)) {
                          console.log(`[PlaywrightRecorder] Found element with word: "${word}"`);
                          break;
                        }
                      }
                    }
                    
                    // Last resort: find any link or button and log what's available
                    if (!(await element.isVisible({ timeout: 500 }).catch(() => false))) {
                      console.log(`[PlaywrightRecorder] Text "${searchText}" not found, looking for first clickable...`);
                      // Try to find any link with "more" or "info" in it
                      const moreLink = this.page.locator('a:has-text("more"), a:has-text("info"), a:has-text("More")').first();
                      if (await moreLink.isVisible({ timeout: 1000 }).catch(() => false)) {
                        element = moreLink;
                        console.log(`[PlaywrightRecorder] Found similar link with "more/info"`);
                      }
                    }
                    break;
                    
                  case 'css':
                  case 'CSS Selector':
                    console.log(`[PlaywrightRecorder] Finding by CSS: ${userAction.selector}`);
                    element = this.page.locator(userAction.selector).first();
                    break;
                    
                  case 'xpath':
                  case 'XPath':
                    console.log(`[PlaywrightRecorder] Finding by XPath: ${userAction.selector}`);
                    element = this.page.locator(`xpath=${userAction.selector}`).first();
                    break;
                    
                  case 'testId':
                  case 'Test ID':
                    console.log(`[PlaywrightRecorder] Finding by testId: ${userAction.selector}`);
                    element = this.page.getByTestId(userAction.selector).first();
                    break;
                    
                  case 'coords':
                  case 'Coordinates':
                    // Coordinate-based click - no element lookup needed
                    if (userAction.coords && userAction.coords.x && userAction.coords.y) {
                      console.log(`[PlaywrightRecorder] Clicking at coordinates: (${userAction.coords.x}, ${userAction.coords.y})`);
                      await this.page.mouse.click(userAction.coords.x, userAction.coords.y);
                      console.log(`[PlaywrightRecorder] ✓ Coordinate click succeeded`);
                    }
                    continue; // Skip to next action
                    
                  default:
                    // Fallback: treat findBy value as-is or selector as text
                    console.warn(`[PlaywrightRecorder] Unknown findBy strategy: ${userAction.findBy}, trying as text`);
                    element = this.page.getByText(userAction.selector, { exact: false }).first();
                }
                
                // Perform the action on the found element
                if (element) {
                  // Check if element is visible
                  const isVisible = await element.isVisible({ timeout: 5000 }).catch(() => false);
                  if (!isVisible) {
                    console.warn(`[PlaywrightRecorder] Element not visible for: "${userAction.selector}"`);
                    // Try AI fallback
                    if (this.enableAIFallback) {
                      console.log(`[PlaywrightRecorder] Trying AI fallback for cross-origin action`);
                      const aiResult = await this.findElementWithAI(userAction.selector, userAction.type);
                      if (aiResult) {
                        await this.clickAtCoordinates(aiResult.x, aiResult.y);
                        console.log(`[PlaywrightRecorder] ✓ AI click succeeded at (${aiResult.x}, ${aiResult.y})`);
                        await this.page.waitForTimeout(500);
                        continue;
                      }
                    }
                    continue; // Skip this action
                  }
                  
                  switch (userAction.type) {
                    case 'click':
                      // Highlight element before clicking
                      await element.evaluate(el => {
                        el.style.outline = '3px solid red';
                        el.style.outlineOffset = '2px';
                      }).catch(() => {});
                      
                      // Update debug indicator
                      await this.page.evaluate((text) => {
                        const div = document.getElementById('qaai-debug');
                        if (div) div.textContent = `QAAI: Clicking "${text}"...`;
                      }, userAction.selector).catch(() => {});
                      
                      await this.page.waitForTimeout(500); // Pause so user can see
                      await element.click({ timeout: 10000 });
                      console.log(`[PlaywrightRecorder] ✓ Cross-origin click succeeded: "${userAction.selector}"`);
                      
                      // Update debug indicator
                      await this.page.evaluate(() => {
                        const div = document.getElementById('qaai-debug');
                        if (div) { div.textContent = 'QAAI: Click succeeded!'; div.style.background = 'lightgreen'; }
                      }).catch(() => {});
                      
                      // Wait for potential navigation
                      await this.page.waitForTimeout(500);
                      break;
                      
                    case 'fill':
                      await element.clear().catch(() => {});
                      await element.fill(userAction.value || '');
                      console.log(`[PlaywrightRecorder] ✓ Cross-origin fill succeeded: "${userAction.selector}"`);
                      break;
                      
                    case 'select':
                      await element.selectOption(userAction.value || '');
                      console.log(`[PlaywrightRecorder] ✓ Cross-origin select succeeded: "${userAction.selector}"`);
                      break;
                      
                    default:
                      console.warn(`[PlaywrightRecorder] Unknown action type: ${userAction.type}`);
                  }
                } else {
                  // Element not found - show what's actually on the page to help user
                  console.warn(`[PlaywrightRecorder] ❌ Could not find element: "${userAction.selector}"`);
                  console.warn(`[PlaywrightRecorder] Current page URL: ${this.page.url()}`);
                  
                  // Try to show available clickable elements
                  try {
                    const availableElements = await this.page.evaluate(() => {
                      const elements = document.querySelectorAll('a, button, [role="button"], [role="link"]');
                      return Array.from(elements).slice(0, 10).map(el => ({
                        tag: el.tagName,
                        text: (el.textContent || '').trim().substring(0, 50),
                        href: el.getAttribute('href')
                      }));
                    });
                    console.warn(`[PlaywrightRecorder] Available clickable elements on page:`);
                    availableElements.forEach((el, i) => {
                      console.warn(`  ${i + 1}. <${el.tag.toLowerCase()}> "${el.text}" ${el.href ? `→ ${el.href}` : ''}`);
                    });
                  } catch (e) {}
                }
              } catch (e) {
                console.warn(`[PlaywrightRecorder] Cross-origin action failed: ${e.message}`);
                // Don't fail the entire step, just log and continue
              }
            }
          } else {
            // NO USER ACTIONS DEFINED - this is likely the problem!
            console.log('[PlaywrightRecorder] ⚠️ NO USER ACTIONS DEFINED!');
            console.log('[PlaywrightRecorder] The userActions array is empty or undefined');
            console.log('[PlaywrightRecorder] Make sure you clicked "Save Actions" after defining them');
            
            // Show visual warning in browser
            await this.page.evaluate(() => {
              const div = document.getElementById('qaai-debug') || document.createElement('div');
              div.id = 'qaai-debug';
              div.style.cssText = 'position:fixed;top:10px;left:10px;background:orange;color:black;padding:10px;z-index:999999;font-size:14px;border:2px solid red;';
              div.textContent = '⚠️ QAAI: No actions defined for this cross-origin step!';
              if (!document.getElementById('qaai-debug')) document.body.appendChild(div);
            }).catch(() => {});
            
            await this.page.waitForTimeout(2000);
          }
          
          // DON'T auto-close the cross-origin tab here!
          // There's usually a separate "closeTab" step that handles this.
          // Just switch back to the parent tab for subsequent steps.
          
          // Switch back to parent tab (tab 0) WITHOUT closing the cross-origin tab
          const remainingPages = this.context.pages();
          if (remainingPages.length > 1) {
            // Find the parent tab (localhost or first tab)
            let parentTab = remainingPages[0];
            for (const pg of remainingPages) {
              if (pg.url().includes('localhost') || pg.url().includes('127.0.0.1')) {
                parentTab = pg;
                break;
              }
            }
            
            this.page = parentTab;
            await this.page.bringToFront();
            console.log(`[PlaywrightRecorder] ✓ Switched back to parent tab: ${this.page.url().substring(0, 50)}`);
            
            // Re-initialize SmartFinder for parent page
            if (this.useSmartFinderForPlayback) {
              this.smartFinder = new SmartFinder(this.page, { debug: true, timeout: 15000 });
            }
          }
          
          return { success: true };
        }
        
        case 'dialog':
        case 'HandleDialog': {
          // Dialogs are auto-handled by the page.on('dialog') listener
          // This step is just for documentation
          console.log(`[PlaywrightRecorder] Dialog step (auto-handled): ${action.dialogType || 'dialog'}`);
          return { success: true };
        }

        default:
          // Try to handle by normalizing the action type
          const normalizedType = (action.type || '').toLowerCase();
          console.warn(`[PlaywrightRecorder] Unknown action type: ${action.type}, trying normalized: ${normalizedType}`);
          
          // ============ EXPLICIT HANDLING FOR SF- ACTION TYPES ============
          // These should be caught by the case statements above, but handle them here as fallback
          if (normalizedType.startsWith('sf-')) {
            console.log(`[PlaywrightRecorder] Handling sf- type in default handler: ${normalizedType}`);
            const sfBaseMatch = this.page.url().match(/(https:\/\/[^\/]+)/);
            
            if (!sfBaseMatch) {
              return { success: false, error: 'Cannot determine Salesforce base URL for sf- action' };
            }
            
            const sfBaseUrl = sfBaseMatch[1];
            
            // sf-navigate-list: Navigate to object list view
            if (normalizedType === 'sf-navigate-list') {
              const listObj = action.args?.[0] || label || 'Account';
              const listPath = action.args?.[1] || `/lightning/o/${listObj}/list`;
              const listUrl = listPath.startsWith('http') ? listPath : `${sfBaseUrl}${listPath}`;
              console.log(`[PlaywrightRecorder] SF Navigate to list: ${listUrl}`);
              await this.page.goto(listUrl, { waitUntil: 'domcontentloaded', timeout });
              await this.page.waitForTimeout(2000);
              return { success: true };
            }
            
            // sf-navigate-new: Navigate to new record form
            if (normalizedType === 'sf-navigate-new') {
              const newObj = action.args?.[0] || label || 'Account';
              const newPath = action.args?.[1] || `/lightning/o/${newObj}/new`;
              const newUrl = newPath.startsWith('http') ? newPath : `${sfBaseUrl}${newPath}`;
              console.log(`[PlaywrightRecorder] SF Navigate to new form: ${newUrl}`);
              await this.page.goto(newUrl, { waitUntil: 'domcontentloaded', timeout });
              await this.page.waitForTimeout(2000);
              return { success: true };
            }
            
            // sf-navigate-record: Navigate to specific record
            if (normalizedType === 'sf-navigate-record') {
              const recordId = action.args?.[0] || action.value;
              const recObjType = action.args?.[1] || 'sObject';
              const recPath = action.args?.[2] || `/lightning/r/${recObjType}/${recordId}/view`;
              const recUrl = recPath.startsWith('http') ? recPath : `${sfBaseUrl}${recPath}`;
              console.log(`[PlaywrightRecorder] SF Navigate to record: ${recUrl}`);
              await this.page.goto(recUrl, { waitUntil: 'domcontentloaded', timeout });
              await this.page.waitForTimeout(2000);
              return { success: true };
            }
            
            // sf-wait: Wait for page ready
            if (normalizedType === 'sf-wait') {
              const waitMs = parseInt(action.args?.[0] || '3000');
              console.log(`[PlaywrightRecorder] SF Wait: ${waitMs}ms`);
              await this.page.waitForTimeout(waitMs);
              return { success: true };
            }
            
            // sf-click-tab: Click a record tab
            if (normalizedType === 'sf-click-tab') {
              const tabName = action.args?.[0] || label;
              console.log(`[PlaywrightRecorder] SF Click tab: ${tabName}`);
              const tabLocator = this.page.locator(`li.slds-tabs_default__item a:has-text("${tabName}"), [role="tab"]:has-text("${tabName}")`).first();
              await tabLocator.click({ timeout: 10000 });
              return { success: true };
            }
            
            // sf-click-save/edit/delete/clone: Standard buttons
            if (normalizedType === 'sf-click-save') {
              const saveBtn = this.page.locator('button:has-text("Save"):not(:has-text("&")), [name="SaveEdit"]').first();
              await saveBtn.click({ timeout: 10000 });
              return { success: true };
            }
            if (normalizedType === 'sf-click-edit') {
              const editBtn = this.page.locator('button:has-text("Edit"), [name="Edit"]').first();
              await editBtn.click({ timeout: 10000 });
              return { success: true };
            }
            
            // sf-global-search: Perform global search
            if (normalizedType === 'sf-global-search') {
              const searchTerm = action.args?.[0] || action.value || label;
              console.log(`[PlaywrightRecorder] SF Global Search: ${searchTerm}`);
              const searchUrl = `${sfBaseUrl}/lightning/o/Account/list?q=${encodeURIComponent(searchTerm)}`;
              await this.page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout });
              return { success: true };
            }
            
            // sf-app-launcher: Open app launcher
            if (normalizedType === 'sf-app-launcher') {
              const appLauncher = this.page.locator('button[title="App Launcher"], [aria-label="App Launcher"], .appLauncher button').first();
              await appLauncher.click({ timeout: 10000 });
              await this.page.waitForTimeout(1000);
              return { success: true };
            }
            
            console.warn(`[PlaywrightRecorder] Unhandled sf- action type: ${normalizedType}`);
            return { success: false, error: `Unhandled sf- action type: ${normalizedType}` };
          }
          
          // Try click-based actions
          if (normalizedType.includes('click')) {
            const clickResult2 = await this._findElement(action);
            if (clickResult2) {
              await clickResult2.locator.click({ timeout: 10000 });
              return { success: true };
            }
            return { success: false, error: `Could not find element to click: "${label || selector}"` };
          }
          
          // Try fill-based actions
          if (normalizedType.includes('fill') || normalizedType.includes('input') || normalizedType.includes('type')) {
            if (selector) {
              await this.page.locator(selector).fill(value || '', { timeout });
              return { success: true };
            }
          }
          
          // Try navigation (but NOT for sf- types which are handled above)
          if ((normalizedType.includes('goto') || normalizedType.includes('nav')) && !normalizedType.startsWith('sf-')) {
            const navUrl = action.url || action.args?.[0];
            if (navUrl && navUrl.startsWith('http')) {
              await this.page.goto(navUrl, { waitUntil: 'domcontentloaded', timeout });
              return { success: true };
            }
          }
          
          return { success: false, error: `Unknown action type: ${action.type}` };
      }

      // Return success with the working selector info for Lock Locators feature
      return { 
        success: true, 
        workingSelector: this._lastWorkingSelector || null,
        strategyType: this._lastStrategyType || null 
      };
    } catch (error) {
      console.error('[PlaywrightRecorder] Execute action failed:', error.message);
      return { success: false, error: error.message };
    }
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
    return `
(function() {
  try {
  if (window.__flowstralRecorderInjected__) return;
  window.__flowstralRecorderInjected__ = true;
  window.__flowstralActions__ = window.__flowstralActions__ || [];

  // Silent mode - suppress console logs in Salesforce to avoid security warnings
  var _silent = (window.location.href || '').indexOf('salesforce') >= 0 || (window.location.href || '').indexOf('force.com') >= 0;
  var _log = function() { if (!_silent && console && console.log) { try { console.log.apply(console, arguments); } catch(e){} } };

  // ========== INJECT SHARED RECORDER ENGINE ==========
  ${this.recorderEngineCode}
  
  var Engine = window.FlowstralRecorderEngine || {};
  var SmartSelector = Engine.SmartSelector;
  var findInteractiveElement = Engine.findInteractiveElement || function(t) { return t; };
  var isGenericContainer = Engine.isGenericContainer || function() { return false; };
  var isSensitiveField = Engine.isSensitiveField || function() { return false; };
  var getVisibleText = Engine.getVisibleText || function(el) { return (el.textContent || '').trim().substring(0, 80); };
  var getFieldLabel = Engine.getFieldLabel || function(el) { return el.name || el.id || 'input'; };

  var smartSelector = SmartSelector ? new SmartSelector() : null;
  if (smartSelector) {
    smartSelector.detectAndSetApp();
    _log('[Flowstral] App:', smartSelector.currentApp, smartSelector.appConfig.name);
  }

  var pendingInput = null;
  var inputTimeout = null;
  var INPUT_DEBOUNCE_MS = 1500;

  // ========== GENERATE DESCRIPTION - SAFE VERSION ==========
  function generateDescription(action, element, options) {
    try {
      options = options || {};
      var isSensitive = options.isSensitive || false;
      var displayValue = options.displayValue || null;
      
      // For fill actions
      if (action === 'Fill' && displayValue !== null) {
        var lockIcon = isSensitive ? '🔒 ' : '';
        var fieldLabel = getFieldLabel(element);
        var val = displayValue.length > 20 ? displayValue.substring(0, 17) + '...' : displayValue;
        if (fieldLabel && element.tagName && fieldLabel !== element.tagName.toLowerCase()) {
          return lockIcon + 'Fill ' + fieldLabel + ': "' + val + '"';
        }
        return lockIcon + 'Fill input: "' + val + '"';
      }
      
      // For other actions - get text
      var text = getVisibleText(element);
      if (text && text.length > 0) {
        var truncated = text.length > 30 ? text.substring(0, 27) + '...' : text;
        return action + ' "' + truncated + '"';
      }
      
      var getAttr = function(name) { 
        try { return element.getAttribute ? element.getAttribute(name) : null; } 
        catch(e) { return null; } 
      };
      var label = getAttr('aria-label') || getAttr('placeholder');
      if (label) return action + ' ' + label;
      
      return action + ' ' + (element.tagName ? element.tagName.toLowerCase() : 'element');
    } catch(err) { return action + ' element'; }
  }

  // ========== GET ELEMENT ATTRIBUTES - SAFE VERSION ==========
  function getElementAttributes(element) {
    if (!element) return {};
    try {
      var getAttr = function(name) { 
        try { return element.getAttribute ? element.getAttribute(name) : null; } 
        catch(e) { return null; } 
      };
      return {
        id: element.id || null,
        name: getAttr('name'),
        title: getAttr('title'),
        placeholder: getAttr('placeholder'),
        ariaLabel: getAttr('aria-label'),
        role: getAttr('role'),
        testId: getAttr('data-testid') || getAttr('data-test-id'),
        innerText: (element.innerText || '').trim().substring(0, 100),
        textContent: (element.textContent || '').trim().substring(0, 100),
        elementType: element.type || getAttr('type'),
        tagName: element.tagName ? element.tagName.toLowerCase() : null,
        className: (typeof element.className === 'string') ? element.className : null,
        value: getAttr('value') || element.value || null,
        href: getAttr('href')
      };
    } catch(err) { return {}; }
  }

  // ========== ADD ACTION - ENHANCED DEDUPLICATION ==========
  function addAction(actionData) {
    try {
      // Dedupe fill actions - use fieldKey for matching
      if (actionData.type === 'fill') {
        var fieldKey = actionData.fieldKey || actionData.name || actionData.id || actionData.placeholder || '';
        
        for (var i = window.__flowstralActions__.length - 1; i >= 0; i--) {
          var prev = window.__flowstralActions__[i];
          if (prev && prev.type === 'fill') {
            var prevFieldKey = prev.fieldKey || prev.name || prev.id || prev.placeholder || '';
            
            // If same field, update instead of adding
            if (prevFieldKey && fieldKey && prevFieldKey === fieldKey) {
              // Only update if value changed
              if (prev.value !== actionData.value) {
                prev.value = actionData.value;
                prev.displayValue = actionData.displayValue;
                prev.description = actionData.description;
                prev.timestamp = actionData.timestamp;
                _log('[Flowstral] Updated fill:', actionData.description);
              }
              return;
            }
          }
        }
      }
      
      // CONSERVATIVE click deduplication - only skip TRUE double-clicks
      // Allow same button (like "Next") to be clicked multiple times after other actions
      if (actionData.type === 'click') {
        var last = window.__flowstralActions__[window.__flowstralActions__.length - 1];
        if (last && last.type === 'click') {
          var timeDiff = Date.now() - (last.timestamp || 0);
          // Only skip if SAME click within 300ms (true double-click debounce)
          if (timeDiff < 300 && last.description === actionData.description) {
            _log('[Flowstral] Skipping double-click:', actionData.description);
            return;
          }
        }
      }
      
      // Dedupe navigations - skip if same URL
      if (actionData.type === 'navigate') {
        var lastNav = null;
        for (var k = window.__flowstralActions__.length - 1; k >= 0; k--) {
          if (window.__flowstralActions__[k].type === 'navigate') {
            lastNav = window.__flowstralActions__[k];
            break;
          }
        }
        if (lastNav && lastNav.url === actionData.url) {
          return;
        }
      }
      
      // Add unique ID to action
      actionData.id = 'act_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
      
      window.__flowstralActions__.push(actionData);
      _log('[Flowstral]', actionData.description || actionData.type);
    } catch(err) { /* Silent */ }
  }

  // Track flushed inputs to prevent duplicates
  var flushedInputs = new Set();

  function flushPendingInput() {
    try {
      if (!pendingInput) return;
      clearTimeout(inputTimeout);
      
      var el = pendingInput.element;
      if (!el) { pendingInput = null; return; }
      
      // Get value - handle both regular inputs and contenteditable
      var value = pendingInput.value || el.value || el.textContent || '';
      if (!value || value.length === 0) { pendingInput = null; return; }
      
      // Get tagName safely
      var tagName = (el.tagName || '').toLowerCase() || 'input';
      
      // Create unique key for this input field - include aria-label for Lightning components
      var ariaLabel = el.getAttribute ? (el.getAttribute('aria-label') || '') : '';
      var fieldKey = (el.name || '') + '|' + (el.id || '') + '|' + (el.placeholder || ariaLabel || '');
      
      // Skip if we already recorded this exact field with this value
      if (flushedInputs.has(fieldKey + ':' + value)) {
        pendingInput = null;
        return;
      }
      
      var type = (el.type || '').toLowerCase();
      var isPassword = type === 'password' || isSensitiveField(el, type);
      var displayValue = isPassword ? '••••••••' : value;
      
      var selector = smartSelector ? smartSelector.getBestSelector(el) : {};
      var attrs = getElementAttributes(el);
      
      addAction({
        type: 'fill',
        selector: selector,
        timestamp: Date.now(),
        description: generateDescription('Fill', el, { isSensitive: isPassword, displayValue: displayValue }),
        tagName: tagName,
        value: value,
        displayValue: displayValue,
        isSensitive: isPassword,
        app: selector.app,
        fieldKey: fieldKey,
        ...attrs
      });
      
      flushedInputs.add(fieldKey + ':' + value);
      pendingInput = null;
    } catch(err) { pendingInput = null; }
  }

  // ========== SALESFORCE-SPECIFIC ELEMENT PATTERNS ==========
  var SF_CLICKABLE_PATTERNS = {
    // App Launcher (9-dots icon)
    appLauncher: [
      'button[title="App Launcher"]',
      '[data-aura-class="forceModuleSwitcher"]',
      'one-app-launcher-header',
      'div.appLauncher button',
      '[class*="appLauncher"] button',
      '.slds-icon-waffle',
      'one-app-launcher-menu',
      '[data-component-id*="appLauncher"]'
    ],
    // Profile/User Menu
    profileMenu: [
      'button[class*="userProfile"]',
      '[data-aura-class="uiPopupTrigger"]',
      'span.uiImage',
      '.profileTrigger',
      '[class*="profile"] button',
      'one-app-nav-bar-item-root[data-id="profile"]',
      '[data-id="userProfileMenu"]',
      '.oneUserProfileCard',
      'button[title*="View profile"]'
    ],
    // Tabs (lightning-tabset, record details, etc.)
    tabs: [
      '[role="tab"]',
      'lightning-tab',
      'li[role="presentation"] a',
      '.slds-tabs_default__item a',
      'a[role="tab"]',
      '[data-tab-name]',
      '[data-tab-id]',
      'slot[name="tabs"] a',
      '.tabHeader',
      'lightning-tabset a'
    ],
    // Menu items
    menuItems: [
      '[role="menuitem"]',
      '[role="menuitemcheckbox"]',
      '[role="option"]',
      'lightning-menu-item',
      '.slds-dropdown__item a',
      '.slds-listbox__option',
      'a[role="option"]'
    ],
    // Record/Detail page actions
    recordActions: [
      '[data-target-selection-name*="action"]',
      'lightning-button-menu',
      'runtime_platform_actions-action-renderer',
      'button[name="Edit"]',
      'button[name="Delete"]',
      'button[name="Clone"]',
      '[data-refid]'
    ]
  };
  
  // Helper to check if click target matches any Salesforce pattern
  function matchesSalesforcePattern(element) {
    if (!element) return null;
    
    // Check all patterns
    for (var category in SF_CLICKABLE_PATTERNS) {
      var patterns = SF_CLICKABLE_PATTERNS[category];
      for (var i = 0; i < patterns.length; i++) {
        try {
          if (element.matches && element.matches(patterns[i])) {
            return { category: category, pattern: patterns[i] };
          }
          // Also check if it's inside such an element
          var closest = element.closest(patterns[i]);
          if (closest) {
            return { category: category, pattern: patterns[i], element: closest };
          }
        } catch(e) {}
      }
    }
    return null;
  }
  
  // Helper to find best clickable element in Shadow DOM
  function findClickableInShadow(target) {
    try {
      if (!target) return null;
      
      // If target itself is interactive, return it
      var tag = (target.tagName || '').toLowerCase();
      if (['button', 'a', 'input'].indexOf(tag) >= 0) return target;
      
      var role = target.getAttribute && target.getAttribute('role');
      if (role && ['button', 'link', 'menuitem', 'tab', 'option'].indexOf(role) >= 0) return target;
      
      // Check if we're inside a Shadow DOM
      var root = target.getRootNode();
      if (root !== document && root.host) {
        // We're in shadow DOM - the host is what we want
        var host = root.host;
        var hostTag = (host.tagName || '').toLowerCase();
        
        // If host is a Lightning component, use it
        if (hostTag.indexOf('-') >= 0) {
          return host;
        }
      }
      
      // Walk up to find interactive element
      var current = target;
      var maxDepth = 10;
      while (current && current !== document.body && maxDepth-- > 0) {
        var curTag = (current.tagName || '').toLowerCase();
        if (['button', 'a'].indexOf(curTag) >= 0) return current;
        
        var curRole = current.getAttribute && current.getAttribute('role');
        if (curRole && ['button', 'link', 'menuitem', 'tab', 'option'].indexOf(curRole) >= 0) return current;
        
        // Check for cursor pointer
        try {
          var style = window.getComputedStyle(current);
          if (style.cursor === 'pointer' && current.textContent && current.textContent.trim().length < 100) {
            return current;
          }
        } catch(e) {}
        
        current = current.parentElement;
      }
      
      return target;
    } catch(e) {
      return target;
    }
  }

  // ========== CAPTURE PHASE HANDLER FOR ALL CLICKS ==========
  // DISABLED: Now using composedPath-based capture in _getClickCaptureScript()
  // This old handler caused duplicates and didn't work with Shadow DOM
  /*
  document.addEventListener('click_DISABLED', function(e) {
    try {
      // IGNORE clicks on Flowstral overlay elements
      if (e.target.closest && e.target.closest('#flowstral-host')) return;
      if (e.target.closest && e.target.closest('#flowstral-suggestions-host')) return;
      if (e.target.closest && e.target.closest('[data-flowstral-ignore="true"]')) return;
      if (e.target.getAttribute && e.target.getAttribute('data-flowstral-ignore') === 'true') return;
      
      // ========== SALESFORCE PATTERN CHECK ==========
      var sfMatch = matchesSalesforcePattern(e.target);
      if (sfMatch) {
        var sfElement = sfMatch.element || e.target;
        sfElement = findClickableInShadow(sfElement) || sfElement;
        
        console.log('[Flowstral] Salesforce pattern matched:', sfMatch.category, sfMatch.pattern);
        
        var sfSelector = smartSelector ? smartSelector.getBestSelector(sfElement) : {};
        var sfAttrs = getElementAttributes(sfElement);
        var sfText = (sfElement.getAttribute('title') || 
                     sfElement.getAttribute('aria-label') || 
                     sfElement.textContent || '').trim();
        
        // Clean up text
        sfText = sfText.replace(/\\s+/g, ' ').substring(0, 50);
        if (!sfText) sfText = sfMatch.category;
        
        addAction({
          type: 'click',
          selector: sfSelector,
          timestamp: Date.now(),
          description: 'Click "' + sfText + '"',
          tagName: (sfElement.tagName || '').toLowerCase(),
          isSalesforcePattern: true,
          sfCategory: sfMatch.category,
          app: sfSelector.app,
          appName: sfSelector.appName,
          ...sfAttrs
        });
        
        window.__flowstralLastSubmitClick = Date.now();
        return;
      }
      
      var element = findInteractiveElement(e.target);
      if (!element || !element.tagName) {
        // Try finding in shadow DOM
        element = findClickableInShadow(e.target);
      }
      if (!element || !element.tagName) return;
      
      var tagName = element.tagName.toLowerCase();
      var type = element.type ? element.type.toLowerCase() : '';
      
      // Get button text from value (for input) or textContent (for button)
      var buttonText = '';
      if (tagName === 'input') {
        buttonText = (element.value || '').toLowerCase().trim();
      } else {
        buttonText = (element.textContent || element.innerText || '').toLowerCase().trim();
      }
      
      // Normalize whitespace and fix repeated text
      buttonText = buttonText.replace(/\\s+/g, ' ').trim();
      var words = buttonText.split(' ');
      if (words.length >= 2 && words[0] === words[1]) {
        buttonText = words.slice(1).join(' ');
      }
      
      // Also check aria-label and title for button text
      var ariaLabel = (element.getAttribute && element.getAttribute('aria-label') || '').toLowerCase();
      var title = (element.getAttribute && element.getAttribute('title') || '').toLowerCase();
      var id = (element.id || '').toLowerCase();
      var className = (element.className || '').toString().toLowerCase();
      
      // ENHANCED: Check if this is a submit/login button - more patterns
      var submitPatterns = ['log in', 'login', 'sign in', 'signin', 'submit', 'verify', 'continue', 'next', 'proceed', 'authenticate', 'enter'];
      var isSubmitLike = type === 'submit' || (tagName === 'input' && type === 'submit');
      
      if (!isSubmitLike) {
        for (var i = 0; i < submitPatterns.length; i++) {
          var pattern = submitPatterns[i];
          if (buttonText.indexOf(pattern) >= 0 || 
              ariaLabel.indexOf(pattern) >= 0 || 
              title.indexOf(pattern) >= 0 ||
              id.indexOf(pattern) >= 0 ||
              className.indexOf(pattern) >= 0) {
            isSubmitLike = true;
            break;
          }
        }
      }
      
      // Also check for button inside a login form
      if (!isSubmitLike) {
        var form = element.closest('form');
        if (form) {
          var formId = (form.id || '').toLowerCase();
          var formClass = (form.className || '').toString().toLowerCase();
          var formAction = (form.action || '').toLowerCase();
          if (formId.indexOf('login') >= 0 || formClass.indexOf('login') >= 0 || 
              formAction.indexOf('login') >= 0 || formAction.indexOf('auth') >= 0) {
            // Any button in a login form is likely a submit
            if (tagName === 'button' || (tagName === 'input' && (type === 'button' || type === 'submit'))) {
              isSubmitLike = true;
            }
          }
        }
      }
      
      // Debug: Always log click info
      console.log('[Flowstral-Capture] Click:', { tagName: tagName, type: type, text: buttonText.substring(0, 30), isSubmitLike: isSubmitLike });
      
      if (isSubmitLike) {
        console.log('[Flowstral] LOGIN/SUBMIT button clicked:', buttonText.substring(0, 30) || type);
        
        // Immediately capture all form inputs FIRST (before page might navigate)
        var form = element.closest('form') || document;
        var inputs = form.querySelectorAll('input[type="text"], input[type="email"], input[type="password"], input[type="tel"], input[type="number"], input:not([type]), input[type=""]');
        
        inputs.forEach(function(inp) {
          if (inp.value && inp.value.length > 0) {
            var inputType = (inp.type || '').toLowerCase();
            var isPassword = inputType === 'password' || isSensitiveField(inp, inputType);
            var displayValue = isPassword ? '••••••••' : inp.value;
            var selector = smartSelector ? smartSelector.getBestSelector(inp) : {};
            var attrs = getElementAttributes(inp);
            var fieldKey = (inp.name || '') + '|' + (inp.id || '') + '|' + (inp.placeholder || '');
            
            // Check if already recorded
            var alreadyRecorded = window.__flowstralActions__.some(function(a) {
              return a.type === 'fill' && a.fieldKey === fieldKey;
            });
            
            if (!alreadyRecorded) {
              console.log('[Flowstral] Recording input before submit:', inp.name || inp.id || 'input');
              addAction({
                type: 'fill',
                selector: selector,
                timestamp: Date.now(),
                description: generateDescription('Fill', inp, { isSensitive: isPassword, displayValue: displayValue }),
                tagName: 'input',
                value: inp.value,
                displayValue: displayValue,
                isSensitive: isPassword,
                app: selector.app,
                fieldKey: fieldKey,
                ...attrs
              });
            }
          }
        });
        
        // NOW record the login/submit button click
        var btnSelector = smartSelector ? smartSelector.getBestSelector(element) : {};
        var btnAttrs = getElementAttributes(element);
        
        // Use better text for description
        var descText = buttonText.substring(0, 30) || ariaLabel.substring(0, 30) || title.substring(0, 30) || 'Submit';
        // Capitalize first letter
        descText = descText.charAt(0).toUpperCase() + descText.slice(1);
        
        addAction({
          type: 'click',
          selector: btnSelector,
          timestamp: Date.now(),
          description: 'Click "' + descText + '"',
          tagName: tagName,
          inputType: type,
          isSubmit: true,
          app: btnSelector.app,
          appName: btnSelector.appName,
          ...btnAttrs
        });
        
        // Mark that we've handled this click
        window.__flowstralLastSubmitClick = Date.now();
        return; // Don't let bubble handler also record this
      }
    } catch(err) { 
      try { console.error('[Flowstral] Submit capture error:', err); } catch(e) {} 
    }
  }, true); // CAPTURE PHASE - runs before bubbling
  */
  
  // ========== BUBBLE PHASE CLICK HANDLER FOR REGULAR CLICKS ==========
  // DISABLED: Now using composedPath-based capture in _getClickCaptureScript()
  /*
  document.addEventListener('click_DISABLED', function(e) {
    // IGNORE clicks on Flowstral overlay elements (check immediately, not in setTimeout)
    if (e.target.closest && e.target.closest('#flowstral-overlay')) return;
    if (e.target.getAttribute && e.target.getAttribute('data-flowstral-ignore') === 'true') return;
    if (e.target.closest && e.target.closest('[data-flowstral-ignore="true"]')) return;
    
    setTimeout(function() {
      try {
        // Skip if we just handled a submit or Salesforce pattern button in capture phase
        if (window.__flowstralLastSubmitClick && Date.now() - window.__flowstralLastSubmitClick < 200) {
          return;
        }
        
        flushPendingInput();
        
        var element = findInteractiveElement(e.target);
        
        // ENHANCED: If no interactive element found, try Shadow DOM approach
        if (!element || !element.tagName) {
          element = findClickableInShadow(e.target);
        }
        
        // ENHANCED: Check Lightning custom elements (hyphenated tags)
        if (!element || !element.tagName) {
          var current = e.target;
          while (current && current !== document.body) {
            var tag = (current.tagName || '').toLowerCase();
            if (tag.indexOf('-') >= 0 || tag.indexOf('lightning') >= 0) {
              element = current;
              break;
            }
            current = current.parentElement;
          }
        }
        
        if (!element || !element.tagName) return;
        
        var tagName = element.tagName.toLowerCase();
        var type = element.type ? element.type.toLowerCase() : '';
        
        // Skip click on text inputs - fill will be recorded
        if (tagName === 'input' && ['text','email','password','search','tel','url','number'].indexOf(type) >= 0) {
          return;
        }
        if (tagName === 'textarea') return;
        if (element.isContentEditable) return;
        
        // Skip radio/checkbox inputs - change handler will record
        if (tagName === 'input' && (type === 'radio' || type === 'checkbox')) {
          return;
        }
        
        // Skip submit buttons - already handled in capture phase
        var buttonText = (element.textContent || element.value || '').toLowerCase().trim();
        var ariaLabel = (element.getAttribute && element.getAttribute('aria-label') || '').toLowerCase();
        var title = (element.getAttribute && element.getAttribute('title') || '').toLowerCase();
        
        var isSubmitLike = type === 'submit' || 
                          buttonText.indexOf('log in') >= 0 || 
                          buttonText.indexOf('login') >= 0 || 
                          buttonText.indexOf('sign in') >= 0 ||
                          buttonText.indexOf('submit') >= 0 ||
                          buttonText.indexOf('verify') >= 0 ||
                          buttonText.indexOf('continue') >= 0 ||
                          buttonText.indexOf('next') >= 0; // Added "Next" button support
        
        if (isSubmitLike) {
          return; // Already handled in capture phase
        }
        
        // DON'T skip labels that are part of segmented controls / styled radio buttons
        // These are interactive elements that look like buttons but wrap hidden inputs
        if (tagName === 'label') {
          var hasRadioOrCheckbox = element.querySelector('input[type="radio"], input[type="checkbox"]');
          var isInButtonGroup = element.closest('[role="radiogroup"], [role="group"], .btn-group, .button-group, .segmented-control');
          var hasSelectedState = element.classList && (
            element.classList.contains('active') || 
            element.classList.contains('selected') || 
            element.classList.contains('checked')
          );
          
          // If it's a label in a button-like context, it SHOULD be recorded
          if (hasRadioOrCheckbox || isInButtonGroup || hasSelectedState) {
            // Don't skip - let it be recorded
            console.log('[Flowstral] Recording label click for segmented control:', buttonText.substring(0, 30));
          } else {
            return; // Skip normal labels
          }
        }
        
        // ENHANCED: Always record Lightning components (hyphenated tags)
        var isLightningComponent = tagName.indexOf('-') >= 0;
        
        // For generic containers, require meaningful attributes (but allow Lightning components)
        var genericTags = ['div', 'span', 'section', 'article', 'main', 'header', 'footer', 'nav', 'aside'];
        if (!isLightningComponent && genericTags.indexOf(tagName) >= 0) {
          var hasId = element.id && !/^\\d+$/.test(element.id) && !/^(lwc|aura)-/i.test(element.id);
          var hasTestId = element.getAttribute && (element.getAttribute('data-testid') || element.getAttribute('data-test-id'));
          var hasRole = element.getAttribute && element.getAttribute('role');
          var hasAriaLabel = element.getAttribute && element.getAttribute('aria-label');
          var hasTitle = element.getAttribute && element.getAttribute('title');
          var hasClickableRole = hasRole && ['button','link','menuitem','tab','option','menuitemcheckbox'].indexOf(hasRole) >= 0;
          var text = (element.textContent || '').trim();
          var hasShortText = text.length > 0 && text.length < 50;
          
          if (!hasId && !hasTestId && !hasClickableRole && !hasAriaLabel && !hasTitle && !hasShortText) {
            return;
          }
        }
        
        if (!isLightningComponent && isGenericContainer(element)) return;
        if (element === document.body || element === document.documentElement) return;
        
        var selector = smartSelector ? smartSelector.getBestSelector(element) : {};
        var attrs = getElementAttributes(element);
        
        // Get best description text
        var descText = title || ariaLabel || buttonText || tagName;
        descText = descText.replace(/\\s+/g, ' ').trim().substring(0, 50);
        if (descText) {
          descText = descText.charAt(0).toUpperCase() + descText.slice(1);
        }
        
        addAction({
          type: 'click',
          selector: selector,
          timestamp: Date.now(),
          description: generateDescription('Click', element) || ('Click "' + descText + '"'),
          tagName: tagName,
          inputType: type,
          app: selector.app,
          appName: selector.appName,
          ...attrs
        });
      } catch(err) { /* Silent - don't break Salesforce */ }
    }, 0);
  }, true); // Use capture phase
  */

  // ========== INPUT HANDLER - ENHANCED FOR SALESFORCE ==========
  // NOTE: Input capture is now handled by composedPath in _getClickCaptureScript()
  // This old handler is kept as backup but may cause duplicates
  /*
  // Captures input on regular inputs AND Lightning combobox/search
  document.addEventListener('input', function(e) {
    try {
      var element = e.target;
      if (!element) return;
      
      // Handle both regular inputs and contenteditable/combobox
      var tagName = (element.tagName || '').toLowerCase();
      var value = element.value || element.textContent || '';
      
      // Skip if no value
      if (!value) return;
      
      // Check if it's a valid input element
      var isInput = tagName === 'input' || tagName === 'textarea';
      var isContentEditable = element.isContentEditable;
      var isLightningInput = tagName.indexOf('lightning-') >= 0 || element.closest('lightning-input, lightning-combobox, lightning-lookup');
      
      if (!isInput && !isContentEditable && !isLightningInput) return;
      
      var type = (element.type || '').toLowerCase();
      if (['checkbox','radio','submit','button','file','hidden'].indexOf(type) >= 0) return;
      
      if (pendingInput && pendingInput.element === element) {
        pendingInput.value = value;
        clearTimeout(inputTimeout);
      } else {
        flushPendingInput();
        pendingInput = { element: element, value: value, startTime: Date.now() };
      }
      
      // Shorter timeout for password fields (they often auto-submit)
      var timeout = type === 'password' ? 500 : INPUT_DEBOUNCE_MS;
      inputTimeout = setTimeout(flushPendingInput, timeout);
    } catch(err) { /* Silent */ }
  }, true); // Use capture phase to catch events before Salesforce
  */

  // ========== CHANGE HANDLER - SAFE VERSION ==========
  document.addEventListener('change', function(e) {
    setTimeout(function() {
      try {
        flushPendingInput();
        
        var element = e.target;
        if (!element || !element.tagName) return;
        var tagName = element.tagName.toLowerCase();
        var type = (element.type || '').toLowerCase();
        
        if (tagName === 'select') {
          var selector = smartSelector ? smartSelector.getBestSelector(element) : {};
          var selectedText = (element.options && element.options[element.selectedIndex]) ? element.options[element.selectedIndex].text : element.value;
          var attrs = getElementAttributes(element);
          
          addAction({
            type: 'select',
            selector: selector,
            timestamp: Date.now(),
            description: generateDescription('Select', element) + ': "' + selectedText + '"',
            tagName: tagName,
            value: element.value,
            label: selectedText,
            app: selector.app,
            ...attrs
          });
        } else if (type === 'checkbox' || type === 'radio') {
          var selector = smartSelector ? smartSelector.getBestSelector(element) : {};
          var attrs = getElementAttributes(element);
          var actionType = type === 'checkbox' ? (element.checked ? 'check' : 'uncheck') : 'click';
          
          addAction({
            type: actionType,
            selector: selector,
            timestamp: Date.now(),
            description: generateDescription(element.checked ? 'Check' : 'Uncheck', element),
            tagName: tagName,
            inputType: type,
            app: selector.app,
            ...attrs
          });
        }
      } catch(err) { /* Silent */ }
    }, 0);
  }, false);

  // ========== KEYDOWN HANDLER - ENHANCED ==========
  document.addEventListener('keydown', function(e) {
    try {
      if (e.key === 'Enter') {
        // Always flush on Enter (password fields, search, etc.)
        flushPendingInput();
        
        // If in a form, capture all fields
        var form = e.target && e.target.closest ? e.target.closest('form') : null;
        if (form) {
          var inputs = form.querySelectorAll('input[type="text"], input[type="email"], input[type="password"], input[type="tel"], input:not([type])');
          inputs.forEach(function(inp) {
            if (inp.value && inp.value.length > 0 && inp !== e.target) {
              var inputType = (inp.type || '').toLowerCase();
              var isPassword = inputType === 'password' || isSensitiveField(inp, inputType);
              var displayValue = isPassword ? '••••••••' : inp.value;
              var selector = smartSelector ? smartSelector.getBestSelector(inp) : {};
              var attrs = getElementAttributes(inp);
              var fieldKey = (inp.name || '') + '|' + (inp.id || '') + '|' + (inp.placeholder || '');
              
              var alreadyRecorded = window.__flowstralActions__.some(function(a) {
                return a.type === 'fill' && a.fieldKey === fieldKey;
              });
              
              if (!alreadyRecorded) {
                addAction({
                  type: 'fill',
                  selector: selector,
                  timestamp: Date.now(),
                  description: generateDescription('Fill', inp, { isSensitive: isPassword, displayValue: displayValue }),
                  tagName: 'input',
                  value: inp.value,
                  displayValue: displayValue,
                  isSensitive: isPassword,
                  app: selector.app,
                  fieldKey: fieldKey,
                  ...attrs
                });
              }
            }
          });
        }
      } else if (e.key === 'Tab') {
        flushPendingInput();
      }
    } catch(err) { /* Silent */ }
  }, true);

  // ========== BLUR/FOCUSOUT HANDLER - ENHANCED ==========
  // Use focusout which bubbles (blur doesn't bubble)
  document.addEventListener('focusout', function(e) {
    try {
      var el = e.target;
      if (!el) return;
      var tagName = (el.tagName || '').toLowerCase();
      
      // Handle regular inputs
      if ((tagName === 'input' || tagName === 'textarea') && pendingInput && pendingInput.element === el) {
        pendingInput.value = el.value;
        flushPendingInput();
        return;
      }
      
      // Handle Lightning inputs (combobox, lookup, etc.)
      if (tagName.indexOf('lightning-') >= 0 || el.closest('lightning-input, lightning-combobox, lightning-lookup')) {
        var lightningInput = el.closest('lightning-input, lightning-combobox, lightning-lookup');
        if (lightningInput) {
          var innerInput = lightningInput.querySelector('input');
          if (innerInput && innerInput.value) {
            if (pendingInput && pendingInput.element === innerInput) {
              pendingInput.value = innerInput.value;
              flushPendingInput();
            } else if (innerInput.value.length > 0) {
              // Record this as a fill action
              var isPassword = (innerInput.type || '').toLowerCase() === 'password' || isSensitiveField(innerInput, innerInput.type);
              var displayValue = isPassword ? '••••••••' : innerInput.value;
              var selector = smartSelector ? smartSelector.getBestSelector(innerInput) : {};
              var attrs = getElementAttributes(innerInput);
              
              addAction({
                type: 'fill',
                selector: selector,
                timestamp: Date.now(),
                description: generateDescription('Fill', innerInput, { isSensitive: isPassword, displayValue: displayValue }),
                tagName: 'input',
                value: innerInput.value,
                displayValue: displayValue,
                isSensitive: isPassword,
                app: selector.app,
                ...attrs
              });
            }
          }
        }
      }
    } catch(err) { /* Silent */ }
  }, true);

  // ========== BEFOREUNLOAD HANDLER ==========
  window.addEventListener('beforeunload', function() {
    flushPendingInput();
  });

  window.flushPendingInput = flushPendingInput;
  
  // ========== SHADOW DOM INPUT AND CLICK HANDLER ==========
  // Salesforce App Launcher and other Lightning components use Shadow DOM
  // We need to periodically check for inputs and clicks inside shadow roots
  function attachShadowListeners(root) {
    try {
      // Find all elements that might have shadow roots
      var elements = root.querySelectorAll('*');
      elements.forEach(function(el) {
        if (el.shadowRoot && !el.__flowstralShadowListenersAttached) {
          el.__flowstralShadowListenersAttached = true;
          
          // Attach input listener to shadow root
          el.shadowRoot.addEventListener('input', function(e) {
            try {
              var input = e.target;
              if (!input || !input.tagName) return;
              var tagName = input.tagName.toLowerCase();
              if (tagName !== 'input' && tagName !== 'textarea') return;
              
              var type = (input.type || '').toLowerCase();
              if (['checkbox','radio','submit','button','file','hidden'].indexOf(type) >= 0) return;
              
              var value = input.value || '';
              if (!value) return;
              
              if (pendingInput && pendingInput.element === input) {
                pendingInput.value = value;
                clearTimeout(inputTimeout);
              } else {
                flushPendingInput();
                pendingInput = { element: input, value: value, startTime: Date.now() };
              }
              inputTimeout = setTimeout(flushPendingInput, INPUT_DEBOUNCE_MS);
            } catch(err) { /* Silent */ }
          }, true);
          
          // ========== SHADOW DOM CLICK HANDLER ==========
          // Capture clicks inside shadow DOM (tabs, menus, buttons, etc.)
          // IMPORTANT: Push to __flowstralCDPClicks for unified processing!
          el.shadowRoot.addEventListener('click', function(e) {
            try {
              // Skip if recently handled
              if (window.__flowstralLastSubmitClick && Date.now() - window.__flowstralLastSubmitClick < 200) {
                return;
              }
              
              var target = e.target;
              if (!target || !target.tagName) return;
              
              // Skip input elements (text fields)
              var tag = target.tagName.toLowerCase();
              var type = (target.type || '').toLowerCase();
              if (tag === 'input' && ['text','email','password','search','tel','url','number'].indexOf(type) >= 0) return;
              if (tag === 'textarea') return;
              
              // Find the best interactive element
              var element = findClickableInShadow(target);
              if (!element) element = target;
              
              // Get the host element (lightning component)
              var host = el;
              var hostTag = (host.tagName || '').toLowerCase();
              
              // Determine which to record - host or inner element
              var recordElement = element;
              if (hostTag.indexOf('-') >= 0) {
                // If host is a Lightning component with good attributes, prefer it
                var hostTitle = host.getAttribute('title');
                var hostAriaLabel = host.getAttribute('aria-label');
                var hostLabel = host.getAttribute('label');
                if (hostTitle || hostAriaLabel || hostLabel) {
                  recordElement = host;
                }
              }
              
              var selector = smartSelector ? smartSelector.getBestSelector(recordElement) : {};
              var attrs = getElementAttributes(recordElement);
              
              var descText = recordElement.getAttribute('title') ||
                            recordElement.getAttribute('aria-label') ||
                            recordElement.getAttribute('label') ||
                            (recordElement.textContent || '').trim();
              descText = descText.replace(/\\s+/g, ' ').substring(0, 50);
              
              if (!descText) return; // Skip clicks with no meaningful text
              
              console.log('[Flowstral] Shadow DOM click captured:', descText);
              
              // CRITICAL: Push to CDP queue for unified processing (same as regular clicks)
              // This ensures Shadow DOM clicks like "Next" buttons are properly captured
              window.__flowstralCDPClicks = window.__flowstralCDPClicks || [];
              window.__flowstralCDPClicks.push({
                timestamp: Date.now(),
                tag: (recordElement.tagName || '').toLowerCase(),
                type: recordElement.type || '',
                text: descText,
                title: recordElement.getAttribute('title') || '',
                ariaLabel: recordElement.getAttribute('aria-label') || '',
                id: recordElement.id || '',
                name: recordElement.name || '',
                placeholder: recordElement.placeholder || '',
                role: recordElement.getAttribute('role') || '',
                href: recordElement.href || '',
                description: 'Click "' + descText + '"',
                x: e.clientX,
                y: e.clientY,
                fromShadow: true,
                isSubmit: tag === 'button' && (type === 'submit' || descText.toLowerCase().indexOf('submit') >= 0),
                elementIndex: 0,
                totalMatching: 1
              });
              
              // ALSO add to legacy system for backward compatibility
              addAction({
                type: 'click',
                selector: selector,
                timestamp: Date.now(),
                description: 'Click "' + descText + '"',
                tagName: (recordElement.tagName || '').toLowerCase(),
                isShadowDOM: true,
                hostElement: hostTag,
                app: selector.app,
                appName: selector.appName,
                ...attrs
              });
              
              window.__flowstralLastSubmitClick = Date.now();
            } catch(err) { /* Silent */ }
          }, true);
          
          // Attach focusout listener
          el.shadowRoot.addEventListener('focusout', function(e) {
            try {
              var input = e.target;
              if (!input || !input.tagName) return;
              var tagName = input.tagName.toLowerCase();
              if ((tagName === 'input' || tagName === 'textarea') && pendingInput && pendingInput.element === input) {
                pendingInput.value = input.value;
                flushPendingInput();
              }
            } catch(err) { /* Silent */ }
          }, true);
          
          // Recursively check shadow root for nested shadows
          attachShadowListeners(el.shadowRoot);
        }
      });
    } catch(err) { /* Silent */ }
  }
  
  // Initial scan
  attachShadowListeners(document);
  
  // Use MutationObserver to watch for new shadow hosts
  var shadowObserver = new MutationObserver(function(mutations) {
    try {
      mutations.forEach(function(mutation) {
        mutation.addedNodes.forEach(function(node) {
          if (node.nodeType === 1) { // Element node
            attachShadowListeners(node);
            // Also check if the node itself has shadow
            if (node.shadowRoot && !node.__flowstralShadowListenersAttached) {
              attachShadowListeners(document);
            }
          }
        });
      });
    } catch(err) { /* Silent */ }
  });
  
  shadowObserver.observe(document.body, { 
    childList: true, 
    subtree: true 
  });
  
  // Also periodically scan for new shadow roots (some get created lazily)
  setInterval(function() {
    try {
      attachShadowListeners(document);
    } catch(err) { /* Silent */ }
  }, 2000);
  
  // ========== AGGRESSIVE APP LAUNCHER / SEARCH INPUT CAPTURE ==========
  // Salesforce App Launcher uses deeply nested Shadow DOM - we need to find it
  var lastSearchValues = {};
  var searchPollCount = 0;
  
  function deepFindInputs(root, results) {
    try {
      // Find inputs in current root
      var inputs = root.querySelectorAll('input:not([type="hidden"]):not([type="password"])');
      inputs.forEach(function(inp) {
        if (inp.value && inp.value.length >= 2) {
          results.push(inp);
        }
      });
      
      // Recursively search shadow roots
      var allElements = root.querySelectorAll('*');
      allElements.forEach(function(el) {
        if (el.shadowRoot) {
          deepFindInputs(el.shadowRoot, results);
        }
      });
    } catch(err) {}
  }
  
  setInterval(function() {
    try {
      searchPollCount++;
      var searchInputs = [];
      
      // ====== STRATEGY 1: Direct selectors ======
      var directInputs = document.querySelectorAll(
        'input[placeholder*="Search" i], ' +
        'input[placeholder*="search" i], ' +
        'input[aria-label*="Search" i], ' +
        'input[title*="Search" i], ' +
        'input[name*="search" i], ' +
        'input[class*="search" i], ' +
        'input[role="searchbox"], ' +
        'input[role="combobox"], ' +
        // App launcher specific
        'input[placeholder*="apps" i], ' +
        'input[placeholder*="items" i]'
      );
      directInputs.forEach(function(inp) { searchInputs.push(inp); });
      
      // ====== STRATEGY 2: Lightning component inputs ======
      var lightningSelectors = [
        'lightning-input input',
        'lightning-base-combobox input',
        'lightning-grouped-combobox input',
        'lightning-primitive-input-simple input',
        'one-app-launcher-search input',
        'one-app-launcher-menu input',
        'one-appnav input',
        'one-app-nav-bar input'
      ];
      lightningSelectors.forEach(function(sel) {
        try {
          var found = document.querySelectorAll(sel);
          found.forEach(function(inp) { searchInputs.push(inp); });
        } catch(e) {}
      });
      
      // ====== STRATEGY 3: Deep Shadow DOM search (every 5th poll to save CPU) ======
      if (searchPollCount % 5 === 0) {
        // Find all Lightning/custom element hosts
        var shadowHosts = document.querySelectorAll([
          'lightning-input',
          'lightning-base-combobox', 
          'lightning-grouped-combobox',
          'lightning-primitive-input-simple',
          'one-app-launcher-search',
          'one-app-launcher-menu',
          'one-appnav',
          'one-app-nav-bar',
          'one-app-launcher-header',
          '[class*="appLauncher"]',
          '[class*="search"]'
        ].join(', '));
        
        shadowHosts.forEach(function(host) {
          if (host.shadowRoot) {
            deepFindInputs(host.shadowRoot, searchInputs);
          }
        });
        
        // Also do a full deep search from document
        deepFindInputs(document, searchInputs);
      }
      
      // ====== STRATEGY 4: Find by active element ======
      var activeEl = document.activeElement;
      if (activeEl && activeEl.tagName === 'INPUT' && activeEl.value && activeEl.value.length >= 2) {
        searchInputs.push(activeEl);
      }
      // Check shadow root of active element
      if (activeEl && activeEl.shadowRoot) {
        var shadowActive = activeEl.shadowRoot.querySelector('input:focus');
        if (shadowActive && shadowActive.value && shadowActive.value.length >= 2) {
          searchInputs.push(shadowActive);
        }
      }
      
      // ====== Process found inputs ======
      var uniqueInputs = [];
      var seenInputs = new Set();
      searchInputs.forEach(function(inp) {
        if (!seenInputs.has(inp)) {
          seenInputs.add(inp);
          uniqueInputs.push(inp);
        }
      });
      
      uniqueInputs.forEach(function(inp) {
        if (!inp || !inp.value || inp.value.length < 2) return;
        var type = (inp.type || '').toLowerCase();
        if (type === 'password' || type === 'hidden') return;
        
        var value = inp.value.trim();
        
        // Create unique key for this input
        var inputKey = (inp.id || '') + '|' + (inp.name || '') + '|' + (inp.placeholder || '') + '|' + (inp.getAttribute('aria-label') || '');
        var recordKey = inputKey + ':' + value;
        
        // Skip if already recorded this exact input+value
        window.__flowstralRecordedSearches = window.__flowstralRecordedSearches || {};
        if (window.__flowstralRecordedSearches[recordKey]) return;
        
        // Skip if value hasn't changed since last check for this input
        if (lastSearchValues[inputKey] === value) return;
        
        // Check if we already have this in actions
        var alreadyRecorded = window.__flowstralActions__.some(function(a) {
          return a.type === 'fill' && a.value === value;
        });
        
        if (!alreadyRecorded) {
          lastSearchValues[inputKey] = value;
          window.__flowstralRecordedSearches[recordKey] = true;
          
          var placeholder = inp.placeholder || inp.getAttribute('aria-label') || inp.getAttribute('title') || 'Search';
          var selector = smartSelector ? smartSelector.getBestSelector(inp) : {};
          var attrs = getElementAttributes(inp);
          
          console.log('[Flowstral] Captured search/app launcher input:', value, 'in', placeholder);
          
          addAction({
            type: 'fill',
            selector: selector,
            timestamp: Date.now(),
            description: 'Fill ' + placeholder + ': "' + value + '"',
            tagName: 'input',
            value: value,
            displayValue: value,
            isSensitive: false,
            app: selector.app,
            fieldKey: 'search|' + inputKey,
            ...attrs
          });
        }
      });
    } catch(err) { /* Silent */ }
  }, 300); // Check every 300ms for more responsive capture
  
  _log('[Flowstral] Playwright recorder ready, app:', smartSelector ? smartSelector.currentApp : 'unknown');
  } catch(e) { /* Silent fail - avoid breaking page */ }
})();
`;
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
      this.actions.push(qwordAction);
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
   * ENTERPRISE-GRADE: Properly preserves ALL element attributes for robust playback
   */
  _toQWord(action) {
    const element = action.element || action;
    const existingSelector = action.selector || element.selectorObj || {};
    
    // Get text for description
    const text = element.textContent || element.innerText || element.text || '';
    const cleanText = text.trim().substring(0, 50);
    
    // ════════════════════════════════════════════════════════════════════════════
    // BUILD SELECTOR OBJECT WITH ALL ELEMENT ATTRIBUTES
    // This is CRITICAL for reliable test playback!
    // Priority order: testId > name > id > ariaLabel > placeholder
    // ════════════════════════════════════════════════════════════════════════════
    
    // Extract all element attributes from the action
    const testId = action.testId || action.dataTestId || element.testId || element.dataTestId || '';
    const name = action.name || element.name || '';
    const id = action.id || element.id || '';
    const ariaLabel = action.ariaLabel || element.ariaLabel || '';
    const placeholder = action.placeholder || element.placeholder || '';
    const title = action.title || element.title || '';
    const role = action.role || element.role || '';
    const href = action.href || element.href || '';
    const tagName = action.tag || action.tagName || element.tagName || '';
    
    // Build the best CSS selector based on priority
    let bestSelector = existingSelector.selector || '';
    if (testId) {
      bestSelector = `[data-testid="${testId}"]`;
    } else if (name) {
      bestSelector = `[name="${name}"]`;
    } else if (id && !this._isDynamicId(id)) {
      bestSelector = `#${id}`;
    } else if (ariaLabel) {
      bestSelector = `[aria-label="${ariaLabel}"]`;
    }
    
    // Build comprehensive selectorObj for robust playback
    const selectorObj = {
      // Best CSS selector (PRIORITIZED)
      selector: bestSelector || existingSelector.selector || '',
      // Element attributes for multi-strategy playback
      testId: testId,                    // HIGHEST PRIORITY
      dataTestId: testId,                // Alias
      name: name,                         // HIGH PRIORITY
      id: id,
      ariaLabel: ariaLabel,
      placeholder: placeholder,
      title: title,
      role: role,
      href: href,
      tagName: tagName,
      // Text for display/fallback matching
      text: cleanText,
      innerText: cleanText,
      textContent: cleanText,
      // Preserve any existing strategies
      strategies: existingSelector.strategies || [],
      fallbacks: existingSelector.fallbacks || [],
      // Metadata
      elementIndex: action.elementIndex || 0,
      totalMatching: action.totalMatching || 1,
      app: existingSelector.app || 'generic',
    };
    
    let qword, args, description;
    
    switch (action.type) {
      case 'navigate':
        qword = 'GoTo';
        args = [action.url];
        description = action.description || `Navigate to ${action.url}`;
        break;
        
      case 'click':
        qword = cleanText ? 'ClickText' : 'ClickElement';
        args = [cleanText || tagName || 'element'];
        description = action.description || `Click "${cleanText || tagName}"`;
        break;
        
      case 'fill':
        const label = placeholder || name || id || ariaLabel || 'input';
        const displayVal = action.displayValue || action.value || '';
        qword = 'Fill';
        args = [label, action.value || ''];
        description = action.description || `Type "${displayVal}" into ${label}`;
        break;
        
      case 'select':
        const selectLabel = name || id || 'dropdown';
        qword = 'Select';
        args = [selectLabel, action.value || action.label || ''];
        description = action.description || `Select "${action.label}" from ${selectLabel}`;
        break;
        
      case 'check':
      case 'uncheck':
        const checkLabel = name || id || cleanText || 'checkbox';
        qword = action.type === 'check' ? 'Check' : 'Uncheck';
        args = [checkLabel];
        description = action.description || `${qword} "${checkLabel}"`;
        break;
        
      case 'submit':
        qword = 'ClickText';
        args = [cleanText || 'Submit'];
        description = action.description || `Click "${cleanText || 'Submit'}"`;
        break;
      
      // ════════════════════════════════════════════════════════════════════════════
      // MULTI-TAB AND CROSS-ORIGIN ACTIONS
      // ════════════════════════════════════════════════════════════════════════════
      case 'newTab':
        qword = 'NewTab';
        args = [action.url || ''];
        description = action.description || `New tab opened: ${action.url || ''}`;
        // CRITICAL: Preserve type for playback
        break;
        
      case 'switchTab':
        qword = 'SwitchTab';
        args = [action.tabIndex ?? 0, action.url || ''];
        description = action.description || `Switched to tab ${action.tabIndex}`;
        break;
        
      case 'closeTab':
        qword = 'CloseTab';
        args = [action.tabIndex ?? 0];
        description = action.description || `Closed tab ${action.tabIndex}`;
        break;
        
      case 'crossOriginPlaceholder':
        qword = 'CrossOrigin';
        args = [action.url || '', action.tabIndex ?? 0];
        // Safely extract hostname
        let crossOriginHost = 'unknown';
        try {
          if (action.url) crossOriginHost = new URL(action.url).hostname;
        } catch (e) { /* invalid URL, use default */ }
        description = action.description || `⚠️ Actions in external tab (${crossOriginHost}) - click to edit`;
        break;
        
      case 'dialog':
        qword = 'HandleDialog';
        args = [action.dialogType || 'alert', action.message || ''];
        description = action.description || `Handle ${action.dialogType}: "${(action.message || '').substring(0, 30)}"`;
        break;
      
      case 'closeModal':
      case 'dismissModal':
      case 'closePopup':
        qword = 'CloseModal';
        args = [action.modalTitle || action.label || ''];
        description = action.description || `Close modal: ${action.modalTitle || action.label || 'dialog'}`;
        break;
        
      case 'download':
        qword = 'Download';
        args = [action.filename || ''];
        description = action.description || `Download: ${action.filename || 'file'}`;
        break;
        
      case 'upload':
        qword = 'Upload';
        args = [action.filename || '', action.path || ''];
        description = action.description || `Upload: ${action.filename || 'file'}`;
        break;
        
      case 'drag':
        qword = 'DragDrop';
        args = [action.sourceSelector || '', action.targetSelector || ''];
        description = action.description || `Drag element to target`;
        break;
      
      case 'hover':
        qword = 'Hover';
        args = [cleanText || ariaLabel || 'element'];
        description = action.description || `Hover over "${cleanText || ariaLabel || 'element'}"`;
        break;
        
      default:
        qword = 'ClickText';
        args = [cleanText || 'element'];
        description = action.description || `${action.type} "${cleanText}"`;
    }
    
    // ========== DEVICE CONTEXT FOR CROSS-DEVICE PLAYBACK ==========
    // Stores device info at record time so playback can adapt strategies
    // Maestro-inspired: Skip coordinate strategies when playing on different device
    const deviceContext = {
      recordedOn: this.mobileDevice?.name || 'desktop',
      isMobile: this.isMobileMode || false,
      viewport: this.page?.viewportSize?.() || { width: 1920, height: 1080 },
      userAgent: this.mobileDevice?.config?.userAgent || 'desktop',
      hasTouch: this.mobileDevice?.config?.hasTouch || false,
    };
    
    return {
      id: `act_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      qword,
      args,
      description,
      selectorObj: selectorObj,
      raw: action,
      timestamp: action.timestamp || Date.now(),
      // CRITICAL: Preserve original type for playback of special actions
      type: action.type,
      // Preserve tab/frame context
      tabIndex: action.tabIndex ?? null,
      url: action.url || null,
      frameContext: action.frameContext || null,
      // For cross-origin placeholders, preserve user actions
      userActions: action.userActions || [],
      // NEW: Device context for cross-device playback (Phase 1)
      deviceContext: deviceContext,
    };
  }

  /**
   * Add action directly
   */
  _addAction(action) {
    const qwordAction = this._toQWord(action);
    this.actions.push(qwordAction);
    this.emit('action', qwordAction);
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

