/**
 * API Configuration — Centralized URL management for the extension
 * ================================================================
 *
 * All extension components (background, sidepanel, content) should
 * use these functions instead of hardcoded URLs.
 *
 * URLs are read from chrome.storage.local with sensible defaults.
 * The sidepanel Settings modal writes to chrome.storage.local,
 * and background.js listens for changes via chrome.storage.onChanged.
 */

// Defaults — used when chrome.storage has no saved value
const DEFAULT_SERVER_URL = 'http://localhost:8000';
const DEFAULT_FRONTEND_URL = 'http://localhost:8080';

// In-memory cache (updated on storage change)
let _cachedServerUrl = DEFAULT_SERVER_URL;
let _cachedFrontendUrl = DEFAULT_FRONTEND_URL;
let _initialized = false;

/**
 * Initialize the config by reading from chrome.storage.local.
 * Call this once at startup (background.js init, sidepanel init).
 * Safe to call multiple times — only reads storage on first call.
 */
async function initApiConfig() {
  if (_initialized) return;
  try {
    const settings = await chrome.storage.local.get([
      'flowstral_server_url',
      'flowstral_frontend_url',
    ]);
    if (settings.flowstral_server_url) {
      _cachedServerUrl = settings.flowstral_server_url;
    }
    if (settings.flowstral_frontend_url) {
      _cachedFrontendUrl = settings.flowstral_frontend_url;
    }
    _initialized = true;
    console.log('[ApiConfig] Initialized — server:', _cachedServerUrl, 'frontend:', _cachedFrontendUrl);
  } catch (err) {
    console.warn('[ApiConfig] Could not read storage, using defaults:', err.message);
    _initialized = true;
  }
}

/**
 * Listen for storage changes so background.js picks up sidepanel settings changes.
 * Call this in background.js service worker init.
 */
function listenForConfigChanges() {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    if (changes.flowstral_server_url?.newValue) {
      _cachedServerUrl = changes.flowstral_server_url.newValue;
      console.log('[ApiConfig] Server URL updated:', _cachedServerUrl);
    }
    if (changes.flowstral_frontend_url?.newValue) {
      _cachedFrontendUrl = changes.flowstral_frontend_url.newValue;
      console.log('[ApiConfig] Frontend URL updated:', _cachedFrontendUrl);
    }
  });
}

/**
 * Get the backend server URL (e.g. http://localhost:8000 or https://qaone-production.up.railway.app).
 * Returns cached value — call initApiConfig() once at startup.
 */
function getServerUrl() {
  return _cachedServerUrl;
}

/**
 * Get the frontend app URL (e.g. http://localhost:8080).
 */
function getFrontendUrl() {
  return _cachedFrontendUrl;
}

/**
 * Build a full API URL from a path.
 * Example: apiUrl('/api/flowstral/save-session') → 'http://localhost:8000/api/flowstral/save-session'
 */
function apiUrl(path) {
  return `${_cachedServerUrl}${path}`;
}

// Export for use in different contexts:
// - Background service worker: importScripts() then use directly
// - Sidepanel: <script src="..."> then use directly
// - Both: global functions available after load
if (typeof self !== 'undefined') {
  self.initApiConfig = initApiConfig;
  self.listenForConfigChanges = listenForConfigChanges;
  self.getServerUrl = getServerUrl;
  self.getFrontendUrl = getFrontendUrl;
  self.apiUrl = apiUrl;
}
