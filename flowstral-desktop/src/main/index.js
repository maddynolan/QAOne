/**
 * Flowstral Desktop v2.0 - Full On-Prem Platform
 * 
 * Architecture:
 * - Main window loads embedded React web app
 * - Navigation between Dashboard, Test Builder, Recorder, etc.
 * - Recorder view has docked BrowserView for recording
 * - Local SQLite storage with optional server sync
 * - Auto-start backend service option
 */

const { app, BrowserWindow, BrowserView, ipcMain, dialog, shell, Tray, Menu, nativeImage, session, globalShortcut } = require('electron');
const path = require('path');
const fs = require('fs');
const Store = require('electron-store');
const { autoUpdater } = require('electron-updater');
const { v4: uuidv4 } = require('uuid');

// ═══════════════════════════════════════════════════════════════════════════
// Single Instance Lock - Ensures only one instance runs at a time
// This also helps the installer close the app cleanly during updates
// ═══════════════════════════════════════════════════════════════════════════
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  // Another instance is running - quit this one
  console.log('[App] Another instance is running, quitting...');
  app.quit();
} else {
  // We got the lock - handle second instance attempts
  app.on('second-instance', (event, commandLine, workingDirectory) => {
    console.log('[App] Second instance attempted, focusing existing window');
    // Someone tried to run a second instance, focus our window instead
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

// Local modules
const LicenseManager = require('./license');
const BrowserController = require('./browser-controller');
const CloudConnector = require('./cloud-connector');
const RecorderEngine = require('./recorder');
const EmbeddedBrowser = require('./embedded-browser');
const PlaywrightRecorder = require('./playwright-recorder');
const LocalStorage = require('./local-storage');
const TestExecutor = require('./test-executor');
const { registerDiagnosticsIPC, getDiagnosticsCollector } = require('./lib/diagnostics-collector');

// Extracted modules (for modularity — same logic, just in separate files)
const { mapQWordToStepType, getBestCssSelector, buildSelectorObj, deduplicateAndFilterSteps } = require('./index-export-helpers');
const licenseHelpers = require('./index-license-helpers');

// Playwright recorder instance (standalone browser)
let playwrightRecorder = null;

// Configuration store
const store = new Store({
  name: 'flowstral-config',
  encryptionKey: 'flowstral-secure-key-2024',
  defaults: {
    serverUrl: 'https://qaone-production.up.railway.app',
    licenseKey: '',
    deviceId: '',
    mode: 'personal', // personal, team, enterprise
    preferences: {
      launchOnStartup: true,
      minimizeToTray: true,
      browserType: 'chromium',
      headless: false,
      viewport: { width: 1280, height: 720 }
    }
  }
});

// Global references
let mainWindow = null;
let webappView = null;  // BrowserView for React webapp
let tray = null;
let browserController = null;
let cloudConnector = null;
let localStorage = null; // Local data storage
let recorderEngine = null;
let licenseManager = null;
let embeddedBrowser = null;
let currentView = 'webapp'; // 'webapp' or 'recorder'
let lastNavigationTime = 0; // Debounce navigation
const NAVIGATION_DEBOUNCE_MS = 1000; // 1 second debounce

// License enforcement state
let isLicenseValid = false;
let licenseExpiresAt = null;
let licenseType = null;
let licenseFeatures = null;
let storedLicenseKey = null;

// License helper functions (delegated to extracted module)
// init() is called after sendToWebapp is defined (see below)
function sendLicenseStatusToWebapp() {
  licenseHelpers.sendLicenseStatusToWebapp();
}

function checkLicenseForFeature(feature = 'basic') {
  return licenseHelpers.checkLicenseForFeature(feature);
}

// Helper to send IPC to webapp (handles both BrowserView and direct main window loading)
function sendToWebapp(channel, ...args) {
  const target = webappView?.webContents || mainWindow?.webContents;
  if (target) {
    console.log(`[IPC] Sending ${channel} to webapp (via ${webappView ? 'BrowserView' : 'mainWindow'})`);
    target.send(channel, ...args);
  } else {
    console.warn(`[IPC] Cannot send ${channel} - no webapp target available (webappView: ${!!webappView}, mainWindow: ${!!mainWindow})`);
  }
}

// NOTE: licenseHelpers.init() is called after licenseManager is created in app.whenReady()

// Device ID for licensing
function getDeviceId() {
  let deviceId = store.get('deviceId');
  if (!deviceId) {
    deviceId = `FD-${uuidv4()}`;
    store.set('deviceId', deviceId);
  }
  return deviceId;
}

// Get webapp path (bundled, dev server, or cloud)
// Returns { url, filePath } — use filePath with loadFile() for local, url with loadURL() for remote
function getWebappUrl() {
  const isDev = process.argv.includes('--dev');
  
  // Check environment variable for custom port
  const devPort = process.env.FLOWSTRAL_DEV_PORT || '8080';
  
  if (isDev) {
    // In dev mode, load from Vite dev server
    return { url: `http://localhost:${devPort}`, filePath: null };
  }
  
  // In production, first try bundled webapp
  const webappPath = path.join(__dirname, '../../webapp/index.html');
  if (fs.existsSync(webappPath)) {
    console.log('[App] Found bundled webapp at:', webappPath);
    return { url: null, filePath: webappPath };
  }
  
  // No bundled webapp - load from cloud (flowstral.com)
  console.log('[App] No bundled webapp found, loading from flowstral.com...');
  return { url: 'https://flowstral.com', filePath: null };
}

// Track if we're showing license page
let showingLicensePage = false;

// Get titlebar colors based on system theme
function getTitleBarColors() {
  const { nativeTheme } = require('electron');
  const isDark = nativeTheme.shouldUseDarkColors;
  return {
    color: isDark ? '#0a0a0f' : '#f8f9fc',
    symbolColor: isDark ? '#e5e7eb' : '#374151',
    backgroundColor: isDark ? '#0a0a0f' : '#f8f9fc'
  };
}

// Create main window - may show license page first
function createWindow() {
  const theme = getTitleBarColors();
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    title: 'Flowstral Desktop',
    icon: path.join(__dirname, '../../assets/icon.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js') // Always use preload.js initially
    },
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: theme.color,
      symbolColor: theme.symbolColor,
      height: 40
    },
    backgroundColor: theme.backgroundColor
  });

  // Initially load a simple loading screen while we check license
  mainWindow.loadFile(path.join(__dirname, '../renderer/license.html'));
  showingLicensePage = true;
  console.log('[App] Showing license page - will check license validity');
}

// Load the main webapp after license is validated
function loadWebapp() {
  if (!mainWindow) return;
  
  showingLicensePage = false;
  const webapp = getWebappUrl();
  const isLocalWebapp = !!webapp.filePath;
  
  console.log('[App] Loading webapp:', isLocalWebapp ? webapp.filePath : webapp.url);
  console.log('[App] Is local webapp:', isLocalWebapp);
  
  if (isLocalWebapp) {
    mainWindow.loadFile(path.join(__dirname, '../renderer/shell.html'));
    createWebappView();
  } else {
    // Load cloud webapp directly in main window
    // Need to create a new BrowserWindow with webapp-preload for full API access
    console.log('[App] Creating new window with webapp-preload for cloud webapp...');
    
    // Close the old main window (which has preload.js for license page)
    const oldWindow = mainWindow;
    
    // Create new window with webapp-preload.js
    const webappTheme = getTitleBarColors();
    mainWindow = new BrowserWindow({
      width: 1400,
      height: 900,
      minWidth: 1000,
      minHeight: 700,
      title: 'Flowstral Desktop',
      icon: path.join(__dirname, '../../assets/icon.png'),
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, 'webapp-preload.js') // Use webapp preload for full API access
      },
      titleBarStyle: 'hidden',
      titleBarOverlay: {
        color: webappTheme.color,
        symbolColor: webappTheme.symbolColor,
        height: 32
      },
      show: false // Don't show until ready
    });
    
    // Close old window
    oldWindow?.close();
    
    // Show when ready
    mainWindow.once('ready-to-show', () => {
      mainWindow.show();
    });
    
    mainWindow.webContents.on('did-finish-load', () => {
      console.log('[App] Cloud webapp finished loading, will send license status...');
      
      // Send with retry to ensure React receives it
      const sendWithRetry = (attempt = 1) => {
        console.log(`[App] Sending license status to cloud webapp (attempt ${attempt})`);
        sendLicenseStatusToWebapp();
        if (attempt < 3) {
          setTimeout(() => sendWithRetry(attempt + 1), 500);
        }
      };
      
      // Initial delay for React to hydrate
      setTimeout(() => sendWithRetry(), 300);
    });
    
    mainWindow.loadURL(webapp.url);
  }

  // Handle close to tray
  mainWindow.on('close', (event) => {
    if (store.get('preferences.minimizeToTray') && !app.isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
    webappView = null;
  });

  // Handle window resize
  mainWindow.on('resize', () => {
    updateViewBounds();
  });
}

// Create the webapp BrowserView
function createWebappView() {
  if (!mainWindow) return;

  // Create persistent session for webapp
  const persistentSession = session.fromPartition('persist:flowstral-webapp');

  webappView = new BrowserView({
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'webapp-preload.js'),
      session: persistentSession
    }
  });

  mainWindow.addBrowserView(webappView);
  
  // Set initial bounds (below navigation bar)
  updateViewBounds();

  // Load webapp — use loadFile for local, loadURL for remote
  const webapp = getWebappUrl();
  if (webapp.filePath) {
    console.log('[App] Loading webapp via loadFile:', webapp.filePath);
    webappView.webContents.loadFile(webapp.filePath);
  } else {
    console.log('[App] Loading webapp via loadURL:', webapp.url);
    webappView.webContents.loadURL(webapp.url);
  }

  // Handle webapp navigation
  webappView.webContents.on('did-navigate', (event, url) => {
    console.log('[Webapp] Navigated to:', url);
    // Update navigation time to prevent immediate re-navigation
    lastNavigationTime = Date.now();
    mainWindow?.webContents.send('webapp-url-changed', url);
  });

  // Handle new window requests (open links in same view)
  webappView.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://localhost') || url.includes('flowstral')) {
      webappView.webContents.loadURL(url);
    } else {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  // Focus webapp when it finishes loading; inject landing plugins so landing page shows correct sections
  webappView.webContents.on('did-finish-load', () => {
    webappView?.webContents.focus();
    const landingPlugins = store.get('landingPlugins');
    if (landingPlugins && typeof landingPlugins === 'object') {
      webappView.webContents.executeJavaScript(`
        try {
          localStorage.setItem('flowstral_landing_plugins', JSON.stringify(${JSON.stringify(landingPlugins)}));
        } catch (e) {}
      `).catch(() => {});
    }
    
    // Send license status after webapp loads with delay to ensure React has mounted
    // React hydration takes time, so we wait a bit and also retry
    console.log('[App] Webapp BrowserView finished loading, will send license status...');
    
    const sendWithRetry = (attempt = 1) => {
      console.log(`[App] Sending license status to webapp (attempt ${attempt})`);
      sendLicenseStatusToWebapp();
      
      // Retry a couple times to ensure React receives it
      if (attempt < 3) {
        setTimeout(() => sendWithRetry(attempt + 1), 500);
      }
    };
    
    // Initial delay for React to hydrate
    setTimeout(() => sendWithRetry(), 300);
  });
  
  // Enable opening DevTools for webapp with Ctrl+Shift+I when focused on webapp
  webappView.webContents.on('before-input-event', (event, input) => {
    if (input.control && input.shift && input.key.toLowerCase() === 'i') {
      webappView?.webContents.openDevTools({ mode: 'detach' });
      event.preventDefault();
    }
  });
}

// Update view bounds based on current view mode
function updateViewBounds() {
  if (!mainWindow) return;
  
  const [width, height] = mainWindow.getContentSize();
  const navHeight = 32; // Height of minimal title bar (for window drag)
  
  if (currentView === 'webapp' && webappView) {
    webappView.setBounds({
      x: 0,
      y: navHeight,
      width: width,
      height: height - navHeight
    });
    webappView.setAutoResize({ width: true, height: true });
  } else if (currentView === 'recorder') {
    // Recorder mode: webapp (recorder controls) on left, embedded browser on right
    // Use narrower panel (320px) to give browser more space for proper Salesforce rendering
    const leftPanelWidth = 320;
    const browserWidth = width - leftPanelWidth;
    
    // Ensure browser has minimum width for Salesforce Lightning (900px ideal)
    // If window is too narrow, browser takes priority
    const minBrowserWidth = 900;
    const actualLeftPanel = browserWidth >= minBrowserWidth ? leftPanelWidth : Math.max(0, width - minBrowserWidth);
    const actualBrowserWidth = width - actualLeftPanel;
    
    if (webappView) {
      webappView.setBounds({
        x: 0,
        y: navHeight,
        width: actualLeftPanel,
        height: height - navHeight
      });
      webappView.setAutoResize({ width: false, height: true });
    }
    
    if (embeddedBrowser?.view) {
      embeddedBrowser.setBounds({
        x: actualLeftPanel,
        y: navHeight,
        width: actualBrowserWidth,
        height: height - navHeight
      });
      // Log the browser dimensions for debugging
      console.log('[Recorder] Browser bounds:', actualBrowserWidth, 'x', height - navHeight);
    }
  }
}

// Switch to webapp view
function showWebappView() {
  currentView = 'webapp';
  
  // Hide embedded browser if visible
  if (embeddedBrowser?.view) {
    mainWindow?.removeBrowserView(embeddedBrowser.view);
  }
  
  // Show webapp full width
  updateViewBounds();
  
  mainWindow?.webContents.send('view-changed', 'webapp');
}

// Switch to recorder view (Playwright - standalone browser, webapp takes full width)
function showRecorderView() {
  console.log('[App] showRecorderView called - stack trace:', new Error().stack);
  
  // Don't navigate if we're already at a different page (user may have navigated away)
  if (webappView) {
    const currentUrl = webappView.webContents.getURL();
    // Only navigate to recorder if we're not already there or at another valid page
    if (currentUrl.includes('/builder') || currentUrl.includes('/test-cases') || currentUrl.includes('/settings')) {
      console.log('[App] User is on a different page, not redirecting to recorder:', currentUrl);
      return;
    }
  }
  
  // Since we use Playwright (standalone browser), webapp takes full width
  // No embedded BrowserView needed
  currentView = 'webapp'; // Keep webapp full width since browser is standalone
  
  // Remove any embedded browser if it exists
  if (embeddedBrowser?.view) {
    mainWindow?.removeBrowserView(embeddedBrowser.view);
  }
  
  // Give webapp full width (no split view - Playwright opens in separate window)
  updateViewBounds();
  
  // Navigate to Playwright recorder page
  navigateWebapp('/playwright-recorder');
  
  // Focus the webapp view so inputs are interactive
  setTimeout(() => {
    webappView?.webContents.focus();
  }, 100);
  
  mainWindow?.webContents.send('view-changed', 'recorder');
}

// Navigate webapp to a specific route
function navigateWebapp(route) {
  // Get the target webContents (webappView for BrowserView, or mainWindow for cloud webapp)
  const target = webappView?.webContents || mainWindow?.webContents;
  if (!target) {
    console.warn('[App] Cannot navigate - no webapp target');
    return;
  }
  
  // Debounce navigation to prevent rapid multiple navigations
  const now = Date.now();
  if (now - lastNavigationTime < NAVIGATION_DEBOUNCE_MS) {
    console.log('[App] Navigation debounced for', route, '- too soon after last navigation');
    return;
  }
  
  const webapp = getWebappUrl();
  
  // Prevent unnecessary navigation if already at this route
  const currentUrl = target.getURL();
  if (currentUrl.includes(route)) {
    console.log('[App] Already at', route, '- skipping navigation');
    return;
  }
  
  lastNavigationTime = now;
  if (webapp.filePath) {
    const basePath = webapp.filePath.replace(/index\.html$/, '');
    const fullPath = path.join(basePath, 'index.html');
    console.log('[App] Navigating webapp to:', fullPath, '#', route);
    target.loadFile(fullPath, { hash: route });
  } else {
    const fullUrl = `${webapp.url}${route}`;
    console.log('[App] Navigating webapp to:', fullUrl);
    target.loadURL(fullUrl);
  }
}

// Create system tray
function createTray() {
  try {
    const iconPath = path.join(__dirname, '../../assets/tray-icon.png');
    if (!fs.existsSync(iconPath)) {
      console.log('[Tray] Icon not found, skipping tray');
      return;
    }
    tray = new Tray(iconPath);
  } catch (error) {
    console.log('[Tray] Failed to create:', error.message);
    return;
  }
  
  const contextMenu = Menu.buildFromTemplate([
    { 
      label: 'Open Flowstral', 
      click: () => {
        mainWindow?.show();
        mainWindow?.focus();
      }
    },
    { type: 'separator' },
    {
      label: 'Dashboard',
      click: () => {
        mainWindow?.show();
        showWebappView();
        navigateWebapp('/');
      }
    },
    {
      label: 'Test Builder',
      click: () => {
        mainWindow?.show();
        showWebappView();
        navigateWebapp('/test-cases/builder');
      }
    },
    {
      label: 'Recorder',
      click: () => {
        mainWindow?.show();
        showRecorderView();
      }
    },
    { type: 'separator' },
    { 
      label: 'Quit', 
      click: () => {
        app.isQuitting = true;
        app.quit();
      }
    }
  ]);
  
  tray.setToolTip('Flowstral Desktop');
  tray.setContextMenu(contextMenu);
  
  tray.on('click', () => {
    if (mainWindow) {
      mainWindow.isVisible() ? mainWindow.hide() : mainWindow.show();
    }
  });
}

// Initialize services
async function initializeServices() {
  const deviceId = getDeviceId();
  const serverUrl = store.get('serverUrl');
  const licenseKey = store.get('licenseKey');

  // Initialize local storage
  localStorage = new LocalStorage();
  console.log('[Init] Local storage initialized');

  // Initialize license manager
  licenseManager = new LicenseManager({
    serverUrl,
    deviceId,
    store
  });

  // Wire up license helpers module with references to shared state
  licenseHelpers.init({
    licenseManager: licenseManager,
    getStoredLicenseKey: () => storedLicenseKey,
    sendToWebapp: sendToWebapp
  });

  // Initialize browser controller
  browserController = new BrowserController({
    browserType: store.get('preferences.browserType') || 'chromium',
    headless: false,
    viewport: store.get('preferences.viewport') || { width: 1280, height: 720 }
  });

  // Initialize cloud connector
  cloudConnector = new CloudConnector({
    serverUrl,
    deviceId,
    licenseKey,
    onMessage: handleCloudMessage,
    onStatusChange: (status) => {
      mainWindow?.webContents.send('connection-status', status);
    }
  });

  // Initialize recorder engine
  recorderEngine = new RecorderEngine({
    browserController,
    onAction: (action) => {
      mainWindow?.webContents.send('action-recorded', action);
    },
    onScreenshot: (screenshot) => {
      mainWindow?.webContents.send('screenshot', screenshot);
    }
  });

  console.log('[Init] Services initialized');

  // Check for --reset-license flag (for testing fresh install experience)
  const shouldResetLicense = process.argv.includes('--reset-license');
  if (shouldResetLicense) {
    console.log('[License] --reset-license flag detected, clearing stored license');
    store.set('licenseKey', '');
    store.delete('licenseCache');
  }
  
  // Validate license and track state
  const effectiveLicenseKey = shouldResetLicense ? '' : licenseKey;
  storedLicenseKey = effectiveLicenseKey; // Store for sendLicenseStatusToWebapp
  
  // DEBUG: Log license state
  console.log('[License] ========================================');
  console.log('[License] Stored license key:', licenseKey ? `${licenseKey.substring(0, 15)}...` : 'NONE');
  console.log('[License] Effective license key:', effectiveLicenseKey ? `${effectiveLicenseKey.substring(0, 15)}...` : 'NONE');
  console.log('[License] License cache:', store.get('licenseCache') ? 'EXISTS' : 'NONE');
  console.log('[License] Config file path:', store.path);
  console.log('[License] ========================================');
  
  // IMPORTANT: If no license key, ensure all license state is cleared
  if (!effectiveLicenseKey) {
    console.log('[License] No license key - ensuring clean state');
    store.delete('licenseCache');
    isLicenseValid = false;
    licenseExpiresAt = null;
    licenseType = null;
    licenseFeatures = null;
    // Clear license manager state too
    if (licenseManager) {
      licenseManager.licenseInfo = null;
    }
  }
  
  if (effectiveLicenseKey) {
    const validationResult = await licenseManager.validate(licenseKey);
    isLicenseValid = validationResult.valid;
    licenseExpiresAt = validationResult.expiresAt;
    licenseType = validationResult.type;
    licenseFeatures = validationResult.features;
    
    console.log(`[License] Validation result: valid=${isLicenseValid}, type=${licenseType}, expires=${licenseExpiresAt}`);
    
    if (isLicenseValid) {
      // License validated — now register activation with server
      // Activation MUST succeed for the app to load (prevents revoked/over-limit keys)
      console.log('[License] Registering activation with server...');
      try {
        const activateResult = await licenseManager.activate(effectiveLicenseKey);
        if (activateResult && activateResult.success === false) {
          // Server explicitly rejected activation (revoked, limit reached, not found)
          console.log('[License] Activation REJECTED by server:', activateResult.error);
          isLicenseValid = false;
          // Clear the cached license so next launch doesn't try the same key
          licenseManager.store?.delete('licenseCache');
        } else {
          console.log('[License] Activation registered successfully');
        }
      } catch (activateErr) {
        // Network error — allow cached license to work (offline grace period)
        console.log('[License] Activation request failed (network error, allowing offline grace):', activateErr.message);
      }
      
      if (isLicenseValid) {
        // Proceed to load webapp
        console.log('[License] Valid license found, loading webapp...');
        loadWebapp();
      } else {
        console.log('[License] License was valid but activation was rejected — staying on license page');
      }
    } else {
      // License exists but is invalid/expired - stay on license page
      const reason = validationResult.error || 'Invalid license';
      console.log('[License] Warning: License not valid -', reason);
      console.log('[License] Staying on license page');
    }
  } else {
    // No license key - user needs to activate, stay on license page
    console.log('[License] ========================================');
    console.log('[License] NO LICENSE KEY - staying on license page');
    console.log('[License] isLicenseValid:', isLicenseValid);
    console.log('[License] showingLicensePage:', showingLicensePage);
    console.log('[License] ========================================');
    isLicenseValid = false;
  }
}

// Handle messages from cloud
function handleCloudMessage(message) {
  switch (message.type) {
    case 'start-recording':
      showRecorderView();
      break;
    case 'stop-recording':
      embeddedBrowser?.stopRecording();
      break;
    case 'execute-test':
      executeTest(message.data);
      break;
  }
}

// Execute a test
async function executeTest(testData) {
  try {
    mainWindow?.webContents.send('execution-status', { status: 'running', test: testData.name });
    
    for (let i = 0; i < testData.steps.length; i++) {
      const step = testData.steps[i];
      mainWindow?.webContents.send('step-status', { index: i, status: 'running', step });
      
      await recorderEngine.executeStep(step);
      
      mainWindow?.webContents.send('step-status', { index: i, status: 'passed', step });
    }
    
    mainWindow?.webContents.send('execution-status', { status: 'passed', test: testData.name });
  } catch (error) {
    mainWindow?.webContents.send('execution-status', { status: 'failed', error: error.message });
  }
}

// ============================================================================
// IPC Handlers
// ============================================================================

// Navigation handlers
ipcMain.handle('navigate-to', (event, route) => {
  navigateWebapp(route);
  return true;
});

ipcMain.handle('show-webapp', () => {
  showWebappView();
  return true;
});

ipcMain.handle('show-recorder', () => {
  showRecorderView();
  return true;
});

ipcMain.handle('get-current-view', () => {
  return currentView;
});

ipcMain.handle('focus-webapp', () => {
  if (webappView) {
    webappView.webContents.focus();
    return true;
  }
  return false;
});

// Open webapp DevTools (for debugging the React app)
ipcMain.handle('open-webapp-devtools', () => {
  if (webappView) {
    webappView.webContents.openDevTools({ mode: 'detach' });
    return true;
  }
  return false;
});

// Configuration handlers
ipcMain.handle('get-config', () => {
  return {
    serverUrl: store.get('serverUrl'),
    deviceId: getDeviceId(),
    mode: store.get('mode'),
    preferences: store.get('preferences'),
    version: app.getVersion()
  };
});

ipcMain.handle('set-config', (event, config) => {
  if (config.serverUrl) store.set('serverUrl', config.serverUrl);
  if (config.mode) store.set('mode', config.mode);
  if (config.preferences) store.set('preferences', { ...store.get('preferences'), ...config.preferences });
  return true;
});

// Landing page optional plugins (API, Perf, A11y, Mobile) — what to show on landing
const defaultLandingPlugins = { api: true, perf: true, a11y: true, mobile: true };
ipcMain.handle('get-landing-plugins', () => {
  return store.get('landingPlugins') || defaultLandingPlugins;
});
ipcMain.handle('set-landing-plugins', (event, plugins) => {
  if (plugins && typeof plugins === 'object') {
    store.set('landingPlugins', { ...defaultLandingPlugins, ...plugins });
  }
  return true;
});

// License handlers
ipcMain.handle('activate-license', async (event, licenseKey) => {
  store.set('licenseKey', licenseKey);
  const result = await licenseManager.validate(licenseKey);
  if (result.valid) {
    await licenseManager.activate(licenseKey);
    // Update global state
    isLicenseValid = true;
    storedLicenseKey = licenseKey;
    licenseExpiresAt = result.expiresAt;
    licenseType = result.type;
    licenseFeatures = result.features;
    console.log('[License] Activated successfully:', licenseType);
  }
  return result;
});

ipcMain.handle('deactivate-license', async () => {
  await licenseManager.deactivate();
  store.set('licenseKey', '');
  // Clear global state
  isLicenseValid = false;
  storedLicenseKey = null;
  licenseExpiresAt = null;
  licenseType = null;
  licenseFeatures = null;
  console.log('[License] Deactivated');
  return true;
});

// Debug: Force show license page (for testing)
ipcMain.handle('debug-clear-license-and-restart', async () => {
  console.log('[Debug] Clearing license and restarting app...');
  store.set('licenseKey', '');
  store.delete('licenseCache');
  app.relaunch();
  app.quit();
  return true;
});

ipcMain.handle('get-license-info', async () => {
  // Only return license info if we have a valid license
  if (!isLicenseValid) {
    console.log('[License] get-license-info called but isLicenseValid=false');
    return { valid: false, message: 'No valid license' };
  }
  
  const info = licenseManager?.getInfo();
  console.log('[License] get-license-info returning:', info ? `valid=${info.valid}` : 'null');
  return info || { valid: false, message: 'No license info' };
});

// Handle successful license activation from license.html page
ipcMain.handle('license-activated', async () => {
  console.log('[License] License activated from license page, loading webapp...');
  if (showingLicensePage && isLicenseValid) {
    loadWebapp();
    return true;
  }
  return false;
});

// Server connection handlers
ipcMain.handle('connect-server', async () => {
  try {
    await cloudConnector.connect();
    return cloudConnector.isConnected();
  } catch (error) {
    console.log('[Server] Connection failed:', error.message);
    return false;
  }
});

ipcMain.handle('disconnect-server', async () => {
  await cloudConnector.disconnect();
  return true;
});

// Embedded Browser handlers
ipcMain.handle('embedded-browser-show', async (event, bounds) => {
  try {
    if (!embeddedBrowser) {
      embeddedBrowser = new EmbeddedBrowser({
        mainWindow,
        onAction: (action) => {
          mainWindow?.webContents.send('action-recorded', action);
          sendToWebapp('action-recorded', action);
        },
        onUrlChange: (url) => {
          mainWindow?.webContents.send('browser-url-changed', url);
        }
      });
    }
    
    if (!embeddedBrowser.mainWindow && mainWindow) {
      embeddedBrowser.setMainWindow(mainWindow);
    }
    
    embeddedBrowser.create();
    const success = embeddedBrowser.attach(bounds);
    
    return success;
  } catch (error) {
    console.error('[EmbeddedBrowser] Show failed:', error.message);
    return false;
  }
});

ipcMain.handle('embedded-browser-hide', async () => {
  try {
    embeddedBrowser?.detach();
    return true;
  } catch (error) {
    return false;
  }
});

ipcMain.handle('embedded-browser-navigate', async (event, url) => {
  try {
    return await embeddedBrowser?.navigate(url);
  } catch (error) {
    return null;
  }
});

ipcMain.handle('embedded-browser-start-recording', async () => {
  try {
    embeddedBrowser?.startRecording();
    mainWindow?.webContents.send('recording-status', { recording: true });
    return true;
  } catch (error) {
    return false;
  }
});

ipcMain.handle('embedded-browser-stop-recording', async () => {
  try {
    const actions = embeddedBrowser?.stopRecording() || [];
    mainWindow?.webContents.send('recording-status', { recording: false, actions });
    return actions;
  } catch (error) {
    return [];
  }
});

ipcMain.handle('embedded-browser-get-actions', () => {
  return embeddedBrowser?.getActions() || [];
});

ipcMain.handle('embedded-browser-clear-actions', () => {
  embeddedBrowser?.clearActions();
  return true;
});

ipcMain.handle('embedded-browser-back', () => {
  embeddedBrowser?.goBack();
  return true;
});

ipcMain.handle('embedded-browser-forward', () => {
  embeddedBrowser?.goForward();
  return true;
});

ipcMain.handle('embedded-browser-refresh', () => {
  embeddedBrowser?.refresh();
  return true;
});

ipcMain.handle('embedded-browser-zoom', (event, factor) => {
  embeddedBrowser?.setZoom(factor);
  return true;
});

ipcMain.handle('embedded-browser-get-zoom', () => {
  return embeddedBrowser?.view?.webContents?.getZoomFactor() || 1.0;
});

// ============================================================================
// PLAYWRIGHT RECORDER (Standalone Browser - NO DOCKING)
// Opens a separate Playwright browser window for recording
// Uses EXACT SAME recorder-engine.js as browser extension
// ============================================================================

ipcMain.handle('playwright-recorder-start', async (event, arg) => {
  try {
    // LICENSE CHECK - Recording requires valid license
    const licenseCheck = checkLicenseForFeature('recording');
    if (!licenseCheck.allowed) {
      console.log('[PlaywrightRecorder] License check failed:', licenseCheck.reason);
      sendToWebapp('license-blocked', { 
        feature: 'recording', 
        reason: licenseCheck.reason,
        message: licenseCheck.message 
      });
      return { success: false, error: licenseCheck.message, licenseError: true };
    }
    
    // Handle both old (url-only string) and new (options object) call formats for backward compatibility
    let actualUrl, device, network, browserType;

    if (typeof arg === 'string') {
      // Old format: just a URL string
      actualUrl = arg;
      device = null;
      network = null;
      browserType = 'chromium';
    } else if (arg && typeof arg === 'object') {
      // New format: options object with url, mobileDevice, mobileNetwork, browserType
      actualUrl = arg.url;
      device = arg.mobileDevice;
      network = arg.mobileNetwork;
      browserType = arg.browserType || 'chromium';
    } else {
      throw new Error('Invalid argument: expected URL string or options object');
    }

    console.log('[PlaywrightRecorder] Starting with URL:', actualUrl);
    if (device) console.log('[PlaywrightRecorder] Mobile device:', device);
    if (network) console.log('[PlaywrightRecorder] Network:', network);
    if (browserType !== 'chromium') console.log('[PlaywrightRecorder] Browser type:', browserType);
    
    if (!playwrightRecorder) {
      playwrightRecorder = new PlaywrightRecorder();
    }
    
    // ALWAYS set up recording event listeners (prevents stale listeners issue)
    setupRecordingEvents(playwrightRecorder);
    
    // Configure mobile device if specified (backward compatible: no device = desktop mode)
    if (device) {
      playwrightRecorder.setMobileDevice(device);
    } else {
      playwrightRecorder.clearMobileDevice(); // Ensure desktop mode
    }
    
    // Configure network throttling if specified
    if (network) {
      playwrightRecorder.setMobileNetwork(network);
    }
    
    await playwrightRecorder.start(actualUrl, { browserType });

    // Include mobile config in status for UI display
    const mobileConfig = playwrightRecorder.getMobileConfig();
    sendToWebapp('recording-status', { 
      recording: true, 
      mode: 'playwright',
      mobile: mobileConfig
    });
    return { success: true, mobile: mobileConfig };
  } catch (error) {
    console.error('[PlaywrightRecorder] Start failed:', error.message);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('playwright-recorder-stop', async () => {
  try {
    if (!playwrightRecorder) return { success: false, actions: [] };
    
    const result = await playwrightRecorder.stop();
    sendToWebapp('recording-status', { recording: false, mode: 'playwright' });
    return { success: true, actions: result.actions };
  } catch (error) {
    console.error('[PlaywrightRecorder] Stop failed:', error.message);
    return { success: false, error: error.message, actions: [] };
  }
});

ipcMain.handle('playwright-recorder-get-actions', () => {
  return playwrightRecorder?.getActions() || [];
});

ipcMain.handle('playwright-recorder-clear-actions', () => {
  playwrightRecorder?.clearActions();
  return true;
});

ipcMain.handle('playwright-recorder-is-recording', () => {
  return playwrightRecorder?.isRecording() || false;
});

ipcMain.handle('playwright-recorder-pause', () => {
  if (!playwrightRecorder) return { success: false, error: 'Recorder not started' };
  return playwrightRecorder.pause();
});

ipcMain.handle('playwright-recorder-resume', () => {
  if (!playwrightRecorder) return { success: false, error: 'Recorder not started' };
  return playwrightRecorder.resume();
});

ipcMain.handle('playwright-recorder-is-paused', () => {
  return playwrightRecorder?.isPaused() || false;
});

ipcMain.handle('playwright-recorder-add-manual-action', async (event, action) => {
  if (!playwrightRecorder) {
    return { success: false, error: 'Recorder not started' };
  }
  return playwrightRecorder.addManualAction(action);
});

// Analyze page and return suggestions (Playwright recorder)
ipcMain.handle('playwright-recorder-analyze', async () => {
  if (!playwrightRecorder) {
    return { success: false, suggestions: [], error: 'Recorder not started' };
  }
  return await playwrightRecorder.analyzePage();
});

// Switch to a specific tab for context (Smart Suggestions)
ipcMain.handle('playwright-recorder-switch-tab-context', async (event, tabIndex) => {
  if (!playwrightRecorder) {
    return { success: false, error: 'Recorder not started' };
  }
  return await playwrightRecorder.switchToTabForContext(tabIndex);
});

// Execute a suggestion action (Playwright recorder)
ipcMain.handle('playwright-recorder-execute-action', async (event, action) => {
  if (!playwrightRecorder) {
    return { success: false, error: 'Recorder not started' };
  }
  return await playwrightRecorder.executeAction(action);
});

// Run test with steps (Playwright recorder) - uses existing browser if available
ipcMain.handle('playwright-recorder-run-test', async (event, options) => {
  try {
    // LICENSE CHECK - Playback requires valid license
    const licenseCheck = checkLicenseForFeature('playback');
    if (!licenseCheck.allowed) {
      console.log('[PlaywrightRecorder] License check failed for playback:', licenseCheck.reason);
      sendToWebapp('license-blocked', { 
        feature: 'playback', 
        reason: licenseCheck.reason,
        message: licenseCheck.message 
      });
      return { success: false, error: licenseCheck.message, licenseError: true };
    }
    
    if (!playwrightRecorder) {
      playwrightRecorder = new PlaywrightRecorder();
    }
    
    // ALWAYS ensure test events are set up (even if recorder existed from recording)
    // This ensures progress tracking works regardless of how recorder was created
    setupRecorderEvents(playwrightRecorder);
    
    // Check if debug mode requested
    if (options.debugMode) {
      return await playwrightRecorder.runTestDebug(options);
    }
    
    return await playwrightRecorder.runTest(options);
  } catch (error) {
    console.error('[IPC] Run test error:', error);
    return { success: false, error: error.message };
  }
});

// Helper to set up recorder events (including debug mode events)
// Prevents duplicate listeners by removing existing ones first
function setupRecorderEvents(recorder) {
  // Remove any existing listeners to prevent duplicates
  recorder.removeAllListeners('test-step-start');
  recorder.removeAllListeners('test-step-complete');
  recorder.removeAllListeners('test-complete');
  recorder.removeAllListeners('test-paused');
  recorder.removeAllListeners('test-resumed');
  recorder.removeAllListeners('test-stopped');
  recorder.removeAllListeners('test-runner:step-failed');
  recorder.removeAllListeners('test-step-healing');

  // Test execution feedback - sends events to frontend
  recorder.on('test-step-start', ({ stepIndex, step, isRetry }) => {
    console.log(`[Events] Step ${stepIndex + 1} started`);
    sendToWebapp('playwright-test-step-start', { stepIndex, step, isRetry });
    sendToWebapp('test-runner:step-start', { index: stepIndex, step, isRetry });
  });
  
  recorder.on('test-step-complete', ({ stepIndex, success, error, isRetry, workingSelector, strategyType, healed, newSelector }) => {
    console.log(`[Events] Step ${stepIndex + 1} complete: ${success ? '✓' : '✗'}${workingSelector ? ` [${strategyType}]` : ''}`);
    sendToWebapp('playwright-test-step-complete', { stepIndex, success, error, isRetry, workingSelector, strategyType, healed, newSelector });
    sendToWebapp('test-runner:step-complete', { index: stepIndex, status: success ? 'passed' : 'failed', error, isRetry, workingSelector, strategyType, healed, newSelector });
  });
  
  recorder.on('test-complete', ({ success, passedSteps, failedStep, error, stepResults, totalSteps, browserKeptOpen, failureScreenshot }) => {
    console.log(`[Events] Test complete: ${success ? 'PASSED' : 'FAILED'} (${passedSteps}/${totalSteps || stepResults?.length || 0} steps)`);
    // CRITICAL: Include stepResults with workingSelector for Lock Locators feature
    sendToWebapp('playwright-test-complete', { success, passedSteps, failedStep, error, stepResults, totalSteps, browserKeptOpen, failureScreenshot });
    sendToWebapp('test-runner:test-complete', { success, passedSteps, failedStep, error, stepResults, totalSteps, browserKeptOpen, failureScreenshot });
  });
  
  // Debug mode events
  recorder.on('test-paused', ({ stepIndex, step, error }) => {
    console.log(`[Events] Test paused at step ${stepIndex + 1}`);
    sendToWebapp('playwright-test-paused', { stepIndex, reason: 'debug', step, error });
    sendToWebapp('test-runner:test-paused', { stepIndex, step, error });
  });
  
  recorder.on('test-resumed', ({ stepIndex }) => {
    console.log(`[Events] Test resumed from step ${stepIndex + 1}`);
    sendToWebapp('test-runner:test-resumed', { stepIndex });
  });
  
  recorder.on('test-stopped', ({ stepIndex }) => {
    console.log(`[Events] Test stopped at step ${stepIndex + 1}`);
    sendToWebapp('test-runner:test-stopped', { stepIndex });
  });
  
  recorder.on('test-runner:step-failed', ({ index, error, screenshot, isRetry }) => {
    sendToWebapp('test-runner:step-failed', { index, error, screenshot, isRetry });
  });

  // Resilient healing: emitted when auto-heal is in progress
  recorder.on('test-step-healing', ({ stepIndex, error }) => {
    console.log(`[Events] Step ${stepIndex + 1} healing in progress...`);
    sendToWebapp('playwright-test-step-healing', { stepIndex, error });
  });
}

// Helper to set up recording events (live action streaming during recording)
// Prevents duplicate listeners by removing existing ones first
function setupRecordingEvents(recorder) {
  // Remove any existing listeners to prevent duplicates
  recorder.removeAllListeners('action');
  recorder.removeAllListeners('stopped');
  recorder.removeAllListeners('paused');
  recorder.removeAllListeners('resumed');
  recorder.removeAllListeners('crossOriginTab');
  recorder.removeAllListeners('suggestions');
  recorder.removeAllListeners('navigation');
  
  // Forward recorded actions to webapp in real-time
  recorder.on('action', (action) => {
    console.log('[PlaywrightRecorder] Forwarding action to webapp:', action.description);
    sendToWebapp('playwright-recorder-action', action);
  });
  
  // When actions are reordered (timestamp-based insertion), send full list to frontend
  recorder.on('actions-reordered', (actions) => {
    console.log('[PlaywrightRecorder] Actions reordered, sending full list:', actions?.length);
    sendToWebapp('playwright-recorder-actions-refresh', { actions });
  });
  
  recorder.on('stopped', ({ actions }) => {
    console.log('[PlaywrightRecorder] Forwarding stopped event, actions:', actions?.length);
    sendToWebapp('playwright-recorder-stopped', { actions });
  });
  
  recorder.on('paused', () => {
    console.log('[PlaywrightRecorder] Forwarding paused event');
    sendToWebapp('playwright-recorder-paused');
  });
  
  // Forward cross-origin tab event so UI can prompt user
  recorder.on('crossOriginTab', (data) => {
    console.log('[PlaywrightRecorder] Cross-origin tab detected:', data.url);
    sendToWebapp('playwright-recorder-cross-origin', data);
  });
  
  recorder.on('resumed', () => {
    console.log('[PlaywrightRecorder] Forwarding resumed event');
    sendToWebapp('playwright-recorder-resumed');
  });
  
  recorder.on('suggestions', ({ suggestions }) => {
    console.log('[PlaywrightRecorder] Auto-refresh suggestions:', suggestions?.length);
    sendToWebapp('playwright-recorder-suggestions', { suggestions });
  });
  
  recorder.on('navigation', ({ url }) => {
    console.log('[PlaywrightRecorder] Navigation detected:', url);
    sendToWebapp('playwright-recorder-navigation', { url });
  });
  
  console.log('[PlaywrightRecorder] Recording event listeners set up');
}

// Debug mode: Pause test
ipcMain.handle('playwright-recorder-pause-test', async () => {
  try {
    if (!playwrightRecorder) return { success: false, error: 'No recorder' };
    return playwrightRecorder.pauseTest();
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Debug mode: Resume test
ipcMain.handle('playwright-recorder-resume-test', async (event, options) => {
  try {
    if (!playwrightRecorder) return { success: false, error: 'No recorder' };
    return playwrightRecorder.resumeTest(options);
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Debug mode: Skip step
ipcMain.handle('playwright-recorder-skip-step', async (event, options) => {
  try {
    if (!playwrightRecorder) return { success: false, error: 'No recorder' };
    return playwrightRecorder.skipStep(options);
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Debug mode: Retry step
ipcMain.handle('playwright-recorder-retry-step', async (event, options) => {
  try {
    if (!playwrightRecorder) return { success: false, error: 'No recorder' };
    return await playwrightRecorder.retryStep(options);
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Debug mode: Stop test
ipcMain.handle('playwright-recorder-stop-test', async (event, options) => {
  try {
    if (!playwrightRecorder) return { success: false, error: 'No recorder' };
    return await playwrightRecorder.stopTest(options);
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// ============================================================================
// FAILURE REPAIR IPC HANDLERS
// Help users fix failed steps with browser-assisted debugging
// ============================================================================

// Get the last failure state (screenshot, URL, step info)
ipcMain.handle('playwright-recorder-get-failure-state', async () => {
  try {
    if (!playwrightRecorder) return { success: false, error: 'No recorder' };
    const state = playwrightRecorder.getLastFailureState();
    if (!state) return { success: false, error: 'No failure state saved' };
    return { success: true, state };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Re-open browser to the failed state (for visual debugging)
ipcMain.handle('playwright-recorder-reopen-to-failure', async () => {
  try {
    if (!playwrightRecorder) return { success: false, error: 'No recorder' };
    return await playwrightRecorder.reopenToFailedState();
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Retry just the failed step with an updated action
ipcMain.handle('playwright-recorder-retry-failed-step', async (event, updatedAction) => {
  try {
    if (!playwrightRecorder) return { success: false, error: 'No recorder' };
    return await playwrightRecorder.retryFailedStep(updatedAction);
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Resume test execution from the failed step
ipcMain.handle('playwright-recorder-resume-from-failure', async (event, options) => {
  try {
    if (!playwrightRecorder) return { success: false, error: 'No recorder' };
    return await playwrightRecorder.resumeFromFailedStep(options);
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Manually close the browser (when done debugging)
ipcMain.handle('playwright-recorder-close-browser', async () => {
  try {
    if (!playwrightRecorder) return { success: false, error: 'No recorder' };
    return await playwrightRecorder.closeBrowser();
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Check if browser is currently open
ipcMain.handle('playwright-recorder-is-browser-open', async () => {
  try {
    if (!playwrightRecorder) return { open: false };
    const page = playwrightRecorder.page;
    return { open: page && !page.isClosed() };
  } catch (error) {
    return { open: false };
  }
});

// ============================================================================
// ELEMENT PICKER & DEBUG IPC HANDLERS
// For fixing failed steps with visual element selection
// ============================================================================

const { ElementPicker } = require('./lib/element-picker');
const { DebugCollector } = require('./lib/debug-collector');

let elementPicker = null;
let debugCollector = null;

// Start element picker mode
ipcMain.handle('element-picker-start', async () => {
  try {
    if (!playwrightRecorder || !playwrightRecorder.page) {
      return { success: false, error: 'No browser page available. Start recording first.' };
    }

    // Create picker if needed
    if (!elementPicker) {
      elementPicker = new ElementPicker(playwrightRecorder.page);
    }

    // Set up console listener for picked elements
    const page = playwrightRecorder.page;
    
    return new Promise((resolve) => {
      const consoleHandler = async (msg) => {
        const text = msg.text();
        
        if (text.startsWith('__FLOWSTRAL_ELEMENT_PICKED__:')) {
          const jsonStr = text.replace('__FLOWSTRAL_ELEMENT_PICKED__:', '');
          try {
            const elementInfo = JSON.parse(jsonStr);
            await elementPicker.stop();
            page.off('console', consoleHandler);
            sendToWebapp('element-picker:picked', elementInfo);
            resolve({ success: true, elementInfo });
          } catch (e) {
            resolve({ success: false, error: 'Failed to parse element info' });
          }
        } else if (text === '__FLOWSTRAL_PICKER_CANCELLED__') {
          await elementPicker.stop();
          page.off('console', consoleHandler);
          sendToWebapp('element-picker:cancelled');
          resolve({ success: false, cancelled: true });
        }
      };

      page.on('console', consoleHandler);
      
      elementPicker.start().then(() => {
        sendToWebapp('element-picker:started');
      }).catch((err) => {
        page.off('console', consoleHandler);
        resolve({ success: false, error: err.message });
      });
      
      // Timeout after 60 seconds
      setTimeout(() => {
        page.off('console', consoleHandler);
        elementPicker.stop().catch(() => {});
        resolve({ success: false, error: 'Picker timeout' });
      }, 60000);
    });
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Stop element picker mode
ipcMain.handle('element-picker-stop', async () => {
  try {
    if (elementPicker) {
      await elementPicker.stop();
    }
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Test a selector
ipcMain.handle('element-picker-test-selector', async (event, selector) => {
  try {
    if (!playwrightRecorder || !playwrightRecorder.page) {
      return { success: false, error: 'No browser page available' };
    }

    if (!elementPicker) {
      elementPicker = new ElementPicker(playwrightRecorder.page);
    }

    return await elementPicker.testSelector(selector);
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Highlight an element by selector (for preview)
ipcMain.handle('element-picker-highlight', async (event, selector) => {
  try {
    if (!playwrightRecorder || !playwrightRecorder.page) {
      return { success: false, error: 'No browser page available' };
    }

    if (!elementPicker) {
      elementPicker = new ElementPicker(playwrightRecorder.page);
    }

    await elementPicker.highlightElement(selector, 2000);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Capture failure debug info
ipcMain.handle('debug-capture-failure', async (event, { action, strategiesAttempted, error }) => {
  try {
    if (!playwrightRecorder || !playwrightRecorder.page) {
      return { success: false, error: 'No browser page available' };
    }

    if (!debugCollector) {
      debugCollector = new DebugCollector(playwrightRecorder.page);
    }

    const result = await debugCollector.captureFailureState(action, strategiesAttempted, error);
    if (result.success) {
      const formatted = debugCollector.formatDebugForDisplay(result.debug);
      return { success: true, debug: formatted };
    }
    return result;
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Get last failure debug info
ipcMain.handle('debug-get-last-failure', async () => {
  try {
    if (!debugCollector) {
      return { success: false, error: 'No debug info available' };
    }

    const debug = debugCollector.getLastFailureDebug();
    if (debug) {
      const formatted = debugCollector.formatDebugForDisplay(debug);
      return { success: true, debug: formatted };
    }
    return { success: false, error: 'No failure debug captured' };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Analyze failure and get fix suggestions
ipcMain.handle('debug-analyze-failure', async (event, { action, strategiesAttempted }) => {
  try {
    if (!playwrightRecorder || !playwrightRecorder.page) {
      return { success: false, error: 'No browser page available' };
    }

    if (!debugCollector) {
      debugCollector = new DebugCollector(playwrightRecorder.page);
    }

    const suggestions = await debugCollector.analyzeFaillureAndSuggest(action, strategiesAttempted);
    return { success: true, suggestions };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// AI-assisted element finding
ipcMain.handle('ai-find-element', async (event, description) => {
  try {
    if (!playwrightRecorder || !playwrightRecorder.page) {
      return { success: false, error: 'No browser page available' };
    }

    // Use existing AI fallback
    const AIFallback = require('./lib/ai-fallback');
    const result = await AIFallback.findElementWithAI(playwrightRecorder, description, 'click');
    
    if (result && result.x !== undefined) {
      // Get element at coordinates
      const elementInfo = await playwrightRecorder.page.evaluate(({ x, y }) => {
        const el = document.elementFromPoint(x, y);
        if (!el) return null;
        
        return {
          tag: el.tagName.toLowerCase(),
          text: el.innerText?.substring(0, 100),
          selector: el.id ? `#${el.id}` : (el.className ? `.${el.className.split(' ')[0]}` : el.tagName.toLowerCase()),
          confidence: 0.85
        };
      }, { x: result.x, y: result.y });

      return {
        success: true,
        coordinates: result,
        elementInfo,
        message: `Found element at (${result.x}, ${result.y})`
      };
    }

    return { success: false, error: 'AI could not find the element' };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// ============================================================================
// STRATEGY MEMORY IPC HANDLERS
// For clearing cached element-finding strategies that may have gone bad
// ============================================================================

const { getStrategyMemory } = require('./lib/strategy-memory');

// Clear all strategy memory (reset learning)
ipcMain.handle('strategy-memory-clear-all', async () => {
  try {
    const memory = getStrategyMemory();
    const count = memory.clearAll();
    return { success: true, clearedCount: count };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Clear strategy memory entries matching a pattern
ipcMain.handle('strategy-memory-clear-pattern', async (event, pattern) => {
  try {
    const memory = getStrategyMemory();
    const count = memory.clearByPattern(pattern);
    return { success: true, clearedCount: count };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Get strategy memory stats
ipcMain.handle('strategy-memory-stats', async () => {
  try {
    const memory = getStrategyMemory();
    return { 
      success: true, 
      entryCount: memory.memory.size,
      strategyStats: memory.strategyStats
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// ============================================================================
// MOBILE TESTING IPC HANDLERS
// Phase 1: Mobile Web Emulation (Playwright devices)
// Phase 2: Native App Testing (Maestro integration)
// ============================================================================

// Get available mobile devices for UI dropdown
ipcMain.handle('mobile-get-devices', async () => {
  try {
    const PlaywrightRecorder = require('./playwright-recorder');
    return {
      success: true,
      devices: PlaywrightRecorder.getAvailableDevices()
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Set mobile device for recording/testing
ipcMain.handle('mobile-set-device', async (event, { deviceName, network }) => {
  try {
    if (!playwrightRecorder) {
      return { success: false, error: 'No recorder initialized. Start recording first.' };
    }
    
    if (deviceName) {
      const device = playwrightRecorder.setMobileDevice(deviceName);
      if (!device) {
        return { success: false, error: `Unknown device: ${deviceName}` };
      }
    } else {
      playwrightRecorder.clearMobileDevice();
    }
    
    if (network) {
      playwrightRecorder.setMobileNetwork(network);
    }
    
    return { 
      success: true, 
      config: playwrightRecorder.getMobileConfig()
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Get current mobile configuration
ipcMain.handle('mobile-get-config', async () => {
  try {
    if (!playwrightRecorder) {
      return { success: true, config: null, isMobile: false };
    }
    return { 
      success: true, 
      config: playwrightRecorder.getMobileConfig(),
      isMobile: playwrightRecorder.isInMobileMode()
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Clear mobile device (return to desktop mode)
ipcMain.handle('mobile-clear-device', async () => {
  try {
    if (playwrightRecorder) {
      playwrightRecorder.clearMobileDevice();
    }
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Check Maestro availability for native app testing
ipcMain.handle('mobile-check-maestro', async () => {
  try {
    const { validateMaestroSetup } = require('./lib/maestro-integration');
    const status = validateMaestroSetup();
    return { success: true, ...status };
  } catch (error) {
    return { success: false, error: error.message, installed: false };
  }
});

// Run test on native app via Maestro
ipcMain.handle('mobile-run-native-test', async (event, { steps, appId, platform, deviceId }) => {
  try {
    const { MaestroRunner } = require('./lib/maestro-integration');
    
    const runner = new MaestroRunner({
      appId,
      platform: platform || 'android',
      deviceId,
      debug: true,
      onStep: (step) => {
        sendToWebapp('mobile-native-test-step', step);
      },
      onProgress: (progress) => {
        sendToWebapp('mobile-native-test-progress', progress);
      },
      onError: (error) => {
        sendToWebapp('mobile-native-test-error', error);
      }
    });
    
    const result = await runner.runTest(steps, { appId, platform, deviceId });
    return result;
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Get available native devices (emulators/simulators)
ipcMain.handle('mobile-get-native-devices', async (event, platform) => {
  try {
    const { MaestroRunner } = require('./lib/maestro-integration');
    const runner = new MaestroRunner({ platform: platform || 'android' });
    const devices = await runner.listDevices();
    return { success: true, devices };
  } catch (error) {
    return { success: false, error: error.message, devices: [] };
  }
});

// Store Maestro Studio runner instance globally
let maestroStudioRunner = null;

// Start Maestro Studio - Interactive native app recorder
ipcMain.handle('mobile-start-studio', async (event, { deviceId } = {}) => {
  try {
    const { MaestroRunner } = require('./lib/maestro-integration');
    
    // Create or reuse runner
    if (!maestroStudioRunner) {
      maestroStudioRunner = new MaestroRunner({
        deviceId,
        debug: true,
        onStudioOutput: (output) => {
          sendToWebapp('mobile-studio-output', output);
        }
      });
    }
    
    const result = await maestroStudioRunner.startStudio(deviceId);
    
    // Open Studio in default browser
    if (result.success && result.url) {
      const { shell } = require('electron');
      shell.openExternal(result.url);
    }
    
    return result;
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Stop Maestro Studio
ipcMain.handle('mobile-stop-studio', async () => {
  try {
    if (maestroStudioRunner) {
      maestroStudioRunner.stopStudio();
      return { success: true };
    }
    return { success: false, error: 'Studio not running' };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Check if Maestro Studio is running
ipcMain.handle('mobile-studio-status', async () => {
  try {
    return { 
      success: true, 
      running: maestroStudioRunner?.isStudioRunning() || false,
      url: 'http://localhost:9999'
    };
  } catch (error) {
    return { success: false, running: false };
  }
});

// ============================================================================
// MOBILE DEVICE LAB IPC HANDLERS (screenshots, logs, app install, hierarchy)
// ============================================================================

// Store log capture process globally
let mobileLogProcess = null;

// Take device screenshot
ipcMain.handle('mobile-screenshot', async (event, { platform, deviceId } = {}) => {
  try {
    const { MaestroRunner } = require('./lib/maestro-integration');
    const runner = new MaestroRunner({ platform: platform || 'android', deviceId });
    const result = await runner.takeScreenshot(deviceId);
    if (!result.success) return result;
    // Read file and return as base64 for display
    const imageData = fs.readFileSync(result.path);
    return { success: true, path: result.path, filename: result.filename, base64: imageData.toString('base64') };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Start device log capture (streaming)
ipcMain.handle('mobile-start-logs', async (event, { platform, deviceId, filter } = {}) => {
  try {
    if (mobileLogProcess) { mobileLogProcess.kill(); mobileLogProcess = null; }
    const { MaestroRunner } = require('./lib/maestro-integration');
    const runner = new MaestroRunner({ platform: platform || 'android' });
    mobileLogProcess = runner.startLogCapture(deviceId, filter);
    mobileLogProcess.stdout.on('data', (data) => {
      sendToWebapp('mobile-log-line', data.toString());
    });
    mobileLogProcess.stderr.on('data', (data) => {
      sendToWebapp('mobile-log-line', data.toString());
    });
    mobileLogProcess.on('close', () => { mobileLogProcess = null; });
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Stop device log capture
ipcMain.handle('mobile-stop-logs', async () => {
  try {
    if (mobileLogProcess) { mobileLogProcess.kill(); mobileLogProcess = null; }
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Install app on device
ipcMain.handle('mobile-install-app', async (event, { appPath, platform, deviceId } = {}) => {
  try {
    const { MaestroRunner } = require('./lib/maestro-integration');
    const runner = new MaestroRunner({ platform: platform || 'android' });
    return await runner.installApp(appPath, deviceId);
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Uninstall app from device
ipcMain.handle('mobile-uninstall-app', async (event, { bundleId, platform, deviceId } = {}) => {
  try {
    const { MaestroRunner } = require('./lib/maestro-integration');
    const runner = new MaestroRunner({ platform: platform || 'android' });
    return await runner.uninstallApp(bundleId, deviceId);
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Browse for app file (file dialog)
ipcMain.handle('mobile-browse-app', async () => {
  try {
    const { dialog } = require('electron');
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile'],
      filters: [{ name: 'Mobile Apps', extensions: ['apk', 'aab', 'ipa', 'app'] }]
    });
    if (result.canceled) return { success: false, canceled: true };
    return { success: true, path: result.filePaths[0] };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Get element hierarchy for inspector
ipcMain.handle('mobile-get-hierarchy', async (event, { platform, deviceId } = {}) => {
  try {
    const { MaestroRunner } = require('./lib/maestro-integration');
    const runner = new MaestroRunner({ platform: platform || 'android' });
    return await runner.getElementHierarchy(deviceId);
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// ==== Mobile Advanced Tools IPC Handlers ====

// Open deep link on device
ipcMain.handle('mobile-open-deep-link', async (event, { platform, deviceId, url } = {}) => {
  try {
    const { MaestroRunner } = require('./lib/maestro-integration');
    const runner = new MaestroRunner({ platform: platform || 'android' });
    return await runner.openDeepLink(url, deviceId);
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Send push notification to device
ipcMain.handle('mobile-send-push', async (event, { platform, deviceId, payload, bundleId } = {}) => {
  try {
    const { MaestroRunner } = require('./lib/maestro-integration');
    const runner = new MaestroRunner({ platform: platform || 'android' });
    return await runner.sendPushNotification(payload, bundleId, deviceId);
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Simulate biometric result
ipcMain.handle('mobile-simulate-biometric', async (event, { platform, deviceId, result } = {}) => {
  try {
    const { MaestroRunner } = require('./lib/maestro-integration');
    const runner = new MaestroRunner({ platform: platform || 'android' });
    return await runner.simulateBiometric(result, deviceId);
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Set device geolocation
ipcMain.handle('mobile-set-geolocation', async (event, { platform, deviceId, latitude, longitude } = {}) => {
  try {
    const { MaestroRunner } = require('./lib/maestro-integration');
    const runner = new MaestroRunner({ platform: platform || 'android' });
    return await runner.setGeoLocation(latitude, longitude, deviceId);
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Set network condition
ipcMain.handle('mobile-set-network', async (event, { platform, deviceId, profile } = {}) => {
  try {
    const { MaestroRunner } = require('./lib/maestro-integration');
    const runner = new MaestroRunner({ platform: platform || 'android' });
    return await runner.setNetworkCondition(profile, deviceId);
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Set device orientation
ipcMain.handle('mobile-set-orientation', async (event, { platform, deviceId, orientation } = {}) => {
  try {
    const { MaestroRunner } = require('./lib/maestro-integration');
    const runner = new MaestroRunner({ platform: platform || 'android' });
    return await runner.setOrientation(orientation, deviceId);
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Set device appearance (dark/light mode)
ipcMain.handle('mobile-set-appearance', async (event, { platform, deviceId, mode } = {}) => {
  try {
    const { MaestroRunner } = require('./lib/maestro-integration');
    const runner = new MaestroRunner({ platform: platform || 'android' });
    return await runner.setAppearance(mode, deviceId);
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Set device locale
ipcMain.handle('mobile-set-locale', async (event, { platform, deviceId, locale } = {}) => {
  try {
    const { MaestroRunner } = require('./lib/maestro-integration');
    const runner = new MaestroRunner({ platform: platform || 'android' });
    return await runner.setLocale(locale, deviceId);
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Set font scale
ipcMain.handle('mobile-set-font-scale', async (event, { platform, deviceId, scale } = {}) => {
  try {
    const { MaestroRunner } = require('./lib/maestro-integration');
    const runner = new MaestroRunner({ platform: platform || 'android' });
    return await runner.setFontScale(scale, deviceId);
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Debug mode: Run single step
ipcMain.handle('playwright-recorder-run-single-step', async (event, options) => {
  try {
    if (!playwrightRecorder) return { success: false, error: 'No recorder' };
    return await playwrightRecorder.runSingleStep(options);
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Debug mode: Get test status
ipcMain.handle('playwright-recorder-get-test-status', async () => {
  try {
    if (!playwrightRecorder) return { isRunning: false, isPaused: false, currentStep: -1, debugMode: false };
    return playwrightRecorder.getTestStatus();
  } catch (error) {
    return { isRunning: false, isPaused: false, currentStep: -1, debugMode: false };
  }
});

// ============================================================================
// NETWORK CAPTURE (ported from browser extension)
// ============================================================================

const NetworkCapture = require('./lib/network-capture');
let networkCapture = null;

// Start network capture
ipcMain.handle('network-capture-start', async (event, sessionId) => {
  try {
    // Get webContents from embedded browser or playwright recorder
    let webContents = null;
    
    if (playwrightRecorder?.page) {
      // Use playwright page's webContents equivalent
      console.log('[IPC] Starting network capture for Playwright page');
      // Note: For Playwright, we'll inject capture script instead
      return { success: true, note: 'Playwright uses injected capture' };
    }
    
    if (embeddedBrowser?.view?.webContents) {
      webContents = embeddedBrowser.view.webContents;
    }
    
    if (!webContents) {
      return { success: false, error: 'No browser to capture' };
    }
    
    networkCapture = new NetworkCapture();
    
    // Forward events to renderer
    networkCapture.on('request-start', (data) => {
      sendToWebapp('network-request-start', data);
    });
    networkCapture.on('request-complete', (data) => {
      sendToWebapp('network-request-complete', data);
    });
    networkCapture.on('websocket-created', (data) => {
      sendToWebapp('network-websocket-created', data);
    });
    
    return await networkCapture.start(webContents, sessionId);
  } catch (error) {
    console.error('[IPC] Network capture start error:', error);
    return { success: false, error: error.message };
  }
});

// Stop network capture
ipcMain.handle('network-capture-stop', async () => {
  try {
    if (!networkCapture) {
      return { requests: [], websockets: [], correlations: [] };
    }
    
    const result = await networkCapture.stop();
    networkCapture = null;
    return result;
  } catch (error) {
    console.error('[IPC] Network capture stop error:', error);
    return { success: false, error: error.message };
  }
});

// Get network capture status
ipcMain.handle('network-capture-status', async () => {
  if (!networkCapture) {
    return { enabled: false, requestCount: 0 };
  }
  return networkCapture.getStatus();
});

// Export as HAR
ipcMain.handle('network-capture-export-har', async () => {
  if (!networkCapture) {
    return { success: false, error: 'No capture running' };
  }
  return networkCapture.exportAsHAR();
});

// Link user action to network requests
ipcMain.handle('network-capture-link-action', async (event, { timestamp, type, description }) => {
  if (!networkCapture) {
    return [];
  }
  return networkCapture.linkUserAction(timestamp, type, description);
});

// ============================================================================
// END NETWORK CAPTURE
// ============================================================================

// ============================================================================
// AI TEST GENERATOR
// ============================================================================

const { AITestGenerator } = require('./lib/ai-test-generator');

// Generate tests for current page using AI
ipcMain.handle('ai-generate-current-page', async (event, options = {}) => {
  try {
    const { apiKey, model } = options;
    
    if (!apiKey) {
      return { success: false, error: 'OpenAI API key is required' };
    }
    
    if (!playwrightRecorder || !playwrightRecorder.page) {
      return { success: false, error: 'No active recording session. Start a recording first.' };
    }
    
    const url = playwrightRecorder.page.url();
    
    const generator = new AITestGenerator(playwrightRecorder.page, {
      apiKey,
      model: model || 'gpt-4o-mini',
      debug: true,
      
      onProgress: (progress) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('ai-generator-progress', progress);
          sendToWebapp('ai-generator-progress', progress);
        }
      },
      
      onTestGenerated: (test) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('ai-generator-test', test);
          sendToWebapp('ai-generator-test', test);
        }
      }
    });
    
    const result = await generator.generateForCurrentPage();
    
    return {
      success: true,
      url,
      analysis: result.analysis,
      tests: result.tests || []
    };
    
  } catch (error) {
    console.error('[AIGenerator] Error:', error);
    return { success: false, error: error.message };
  }
});

// Analyze page without generating tests
ipcMain.handle('ai-analyze-page', async (event, options = {}) => {
  try {
    const { apiKey, model } = options;
    
    if (!apiKey) {
      return { success: false, error: 'OpenAI API key is required' };
    }
    
    if (!playwrightRecorder || !playwrightRecorder.page) {
      return { success: false, error: 'No active recording session. Start a recording first.' };
    }
    
    const generator = new AITestGenerator(playwrightRecorder.page, {
      apiKey,
      model: model || 'gpt-4o-mini',
      debug: true
    });
    
    const snapshot = await generator.getAccessibilitySnapshot();
    const url = playwrightRecorder.page.url();
    const analysis = await generator.analyzePage(snapshot, url);
    
    return {
      success: true,
      url,
      snapshot,
      analysis
    };
    
  } catch (error) {
    console.error('[AIGenerator] Analysis error:', error);
    return { success: false, error: error.message };
  }
});

// Generate tests for a specific URL with optional crawling
ipcMain.handle('ai-generate-tests', async (event, options = {}) => {
  try {
    const { url, apiKey, model, maxPages, crawl } = options;
    
    if (!url) {
      return { success: false, error: 'URL is required' };
    }
    
    if (!apiKey) {
      return { success: false, error: 'OpenAI API key is required' };
    }
    
    if (!playwrightRecorder || !playwrightRecorder.page) {
      return { success: false, error: 'No active recording session. Start a recording first.' };
    }
    
    const generator = new AITestGenerator(playwrightRecorder.page, {
      apiKey,
      model: model || 'gpt-4o-mini',
      maxPages: maxPages || 10,
      debug: true,
      
      onProgress: (progress) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('ai-generator-progress', progress);
          sendToWebapp('ai-generator-progress', progress);
        }
      },
      
      onTestGenerated: (test) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('ai-generator-test', test);
          sendToWebapp('ai-generator-test', test);
        }
      }
    });
    
    let result;
    if (crawl) {
      result = await generator.crawlAndGenerate(url);
    } else {
      await playwrightRecorder.page.goto(url, { waitUntil: 'domcontentloaded' });
      result = await generator.generateForCurrentPage();
    }
    
    return { 
      success: true, 
      tests: result.tests || [],
      pagesVisited: result.pagesVisited || [url],
      errors: result.errors || []
    };
    
  } catch (error) {
    console.error('[AIGenerator] Error:', error);
    return { success: false, error: error.message };
  }
});

// ============================================================================
// END AI TEST GENERATOR
// ============================================================================

// ============================================================================
// AI EXPLORER AGENT - Autonomous Test Discovery
// ============================================================================

const { AIExplorerAgent } = require('./lib/ai-explorer-agent');

let currentExplorerAgent = null;

// Start autonomous exploration
ipcMain.handle('ai-explorer-start', async (event, options = {}) => {
  try {
    const { startUrl, maxActions, maxPages, apiKey, model, testData } = options;
    
    // Get the actual API key - if '***env***' marker, fetch from backend
    let actualApiKey = apiKey ? apiKey.trim() : '';
    
    if (actualApiKey === '***env***' || actualApiKey.includes('***env') || !actualApiKey) {
      // Key is stored on backend server - fetch it
      console.log('[AIExplorer IPC] Fetching API key from backend...');
      try {
        const axios = require('axios');
        const response = await axios.get('http://127.0.0.1:8000/api/ai/vision/config/internal-key');
        if (response.data && response.data.key) {
          actualApiKey = response.data.key;
          console.log('[AIExplorer IPC] Got API key from backend');
        } else if (process.env.OPENAI_API_KEY) {
          actualApiKey = process.env.OPENAI_API_KEY;
          console.log('[AIExplorer IPC] Using API key from environment variable');
        }
      } catch (err) {
        console.log('[AIExplorer IPC] Could not fetch from backend, trying env:', err.message);
        actualApiKey = process.env.OPENAI_API_KEY || '';
      }
    }
    
    // Show first 8 chars of API key for debugging (safe to show prefix)
    const keyPreview = actualApiKey ? `${actualApiKey.substring(0, 8)}...${actualApiKey.slice(-4)}` : 'none';
    console.log('[AIExplorer IPC] Starting with:', { startUrl, maxActions, apiKeyPreview: keyPreview, hasRecorder: !!playwrightRecorder, hasPage: !!playwrightRecorder?.page });
    
    if (!actualApiKey) {
      console.log('[AIExplorer IPC] No API key');
      return { success: false, error: 'OpenAI API key not found. Make sure the backend is running at localhost:8000 with OPENAI_API_KEY configured.' };
    }
    
    if (!playwrightRecorder || !playwrightRecorder.page) {
      console.log('[AIExplorer IPC] No recorder or page');
      return { success: false, error: 'No active recording session. Start a recording first.' };
    }
    
    // Create agent
    currentExplorerAgent = new AIExplorerAgent(playwrightRecorder.page, {
      apiKey: actualApiKey,
      model: model || 'gpt-4o-mini',
      maxActions: maxActions || 50,
      maxPages: maxPages || 5,
      testData: testData || undefined,
      debug: true,
      
      // Progress callbacks - send to renderer
      onProgress: (progress) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('ai-explorer-progress', progress);
        }
      },
      
      onAction: (action) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('ai-explorer-action', action);
        }
      },
      
      onTestDiscovered: (test) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('ai-explorer-test-discovered', test);
        }
      },
      
      onError: (error) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('ai-explorer-error', error);
        }
      },
      
      onStateChange: (state) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('ai-explorer-state-change', state);
        }
      }
    });
    
    // Start exploration
    const result = await currentExplorerAgent.explore(startUrl);
    
    currentExplorerAgent = null;
    return result;
    
  } catch (error) {
    console.error('[AIExplorer] Start error:', error);
    return { success: false, error: error.message };
  }
});

// Stop current exploration
ipcMain.handle('ai-explorer-stop', async (event) => {
  try {
    if (currentExplorerAgent) {
      currentExplorerAgent.stop();
      currentExplorerAgent = null;
      return { success: true };
    }
    return { success: false, error: 'No exploration running' };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Get exploration status
ipcMain.handle('ai-explorer-status', async (event) => {
  return {
    running: !!currentExplorerAgent,
    actionCount: currentExplorerAgent?.actionCount || 0,
    testsDiscovered: currentExplorerAgent?.discoveredTests?.length || 0
  };
});

// ============================================================================
// END AI EXPLORER AGENT
// ============================================================================

// ============================================================================
// AI FLOW EXPLORER - Full Flow Discovery
// ============================================================================

const { AIFlowExplorer } = require('./lib/ai-flow-explorer');

let currentFlowExplorer = null;

// Start flow exploration
ipcMain.handle('flow-explorer-start', async (event, options = {}) => {
  try {
    const { startUrl, maxPages, apiKey, model, testData } = options;
    
    // Get the actual API key
    let actualApiKey = apiKey ? apiKey.trim() : '';
    
    if (actualApiKey === '***env***' || actualApiKey.includes('***env') || !actualApiKey) {
      console.log('[FlowExplorer IPC] Fetching API key from backend...');
      try {
        const axios = require('axios');
        const response = await axios.get('http://127.0.0.1:8000/api/ai/vision/config/internal-key');
        if (response.data && response.data.key) {
          actualApiKey = response.data.key;
          console.log('[FlowExplorer IPC] Got API key from backend');
        } else if (process.env.OPENAI_API_KEY) {
          actualApiKey = process.env.OPENAI_API_KEY;
        }
      } catch (err) {
        actualApiKey = process.env.OPENAI_API_KEY || '';
      }
    }
    
    if (!actualApiKey) {
      return { success: false, error: 'No API key found' };
    }
    
    if (!playwrightRecorder || !playwrightRecorder.page) {
      return { success: false, error: 'No active recording session' };
    }
    
    currentFlowExplorer = new AIFlowExplorer(playwrightRecorder.page, {
      apiKey: actualApiKey,
      model: model || 'gpt-4o-mini',
      maxPages: maxPages || 50,
      testData: testData || {},
      debug: true,
      
      onProgress: (progress) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('flow-explorer-progress', progress);
        }
      },
      
      onPageDiscovered: (page) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('flow-explorer-page-discovered', page);
        }
      },
      
      onTestGenerated: (test) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('flow-explorer-test-generated', test);
        }
      },
      
      onError: (error) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('flow-explorer-error', error);
        }
      }
    });
    
    const result = await currentFlowExplorer.explore(startUrl);
    currentFlowExplorer = null;
    return result;
    
  } catch (error) {
    console.error('[FlowExplorer] Start error:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('flow-explorer-stop', async (event) => {
  if (currentFlowExplorer) {
    currentFlowExplorer.stop();
    currentFlowExplorer = null;
  }
  return { success: true };
});

ipcMain.handle('flow-explorer-automate-manual', async (event, options = {}) => {
  try {
    const { description, apiKey, testData } = options;
    
    let actualApiKey = apiKey ? apiKey.trim() : '';
    if (actualApiKey === '***env***' || !actualApiKey) {
      try {
        const axios = require('axios');
        const response = await axios.get('http://127.0.0.1:8000/api/ai/vision/config/internal-key');
        if (response.data && response.data.key) actualApiKey = response.data.key;
        else if (process.env.OPENAI_API_KEY) actualApiKey = process.env.OPENAI_API_KEY;
      } catch { actualApiKey = process.env.OPENAI_API_KEY || ''; }
    }
    
    if (!playwrightRecorder || !playwrightRecorder.page) {
      return { success: false, error: 'No active recording session' };
    }
    
    const explorer = new AIFlowExplorer(playwrightRecorder.page, {
      apiKey: actualApiKey,
      testData: testData || {},
      debug: true
    });
    
    const result = await explorer.automateManualTestCase(description);
    return result;
    
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// ============================================================================
// END AI FLOW EXPLORER
// ============================================================================

// ============================================================================
// AI GOAL AGENT - Execute goals in natural language
// ============================================================================

const { AIGoalAgent } = require('./lib/ai-goal-agent');

let currentGoalAgent = null;

ipcMain.handle('goal-agent-execute', async (event, options = {}) => {
  try {
    const { goal, startUrl, apiKey, testData, maxSteps } = options;
    
    console.log('[GoalAgent] Received execute request');
    console.log('[GoalAgent] Goal:', goal);
    console.log('[GoalAgent] Start URL:', startUrl);
    
    if (!goal) {
      console.log('[GoalAgent] ERROR: No goal provided');
      return { success: false, error: 'No goal provided' };
    }
    
    // Get API key
    let actualApiKey = apiKey ? apiKey.trim() : '';
    if (actualApiKey === '***env***' || !actualApiKey) {
      try {
        const axios = require('axios');
        const response = await axios.get('http://127.0.0.1:8000/api/ai/vision/config/internal-key');
        if (response.data && response.data.key) actualApiKey = response.data.key;
        else if (process.env.OPENAI_API_KEY) actualApiKey = process.env.OPENAI_API_KEY;
      } catch { actualApiKey = process.env.OPENAI_API_KEY || ''; }
    }
    
    if (!actualApiKey) {
      console.log('[GoalAgent] ERROR: No API key available');
      return { success: false, error: 'No API key available. Set OPENAI_API_KEY or configure in settings.' };
    }
    
    console.log('[GoalAgent] API key available: yes');
    
    // If no active browser, launch one
    let page = null;
    let needsCleanup = false;
    
    if (playwrightRecorder && playwrightRecorder.page && !playwrightRecorder.page.isClosed()) {
      console.log('[GoalAgent] Using existing browser page');
      page = playwrightRecorder.page;
    } else {
      console.log('[GoalAgent] No active browser, launching new one...');
      try {
        const { chromium } = require('playwright');
        const path = require('path');
        const { app } = require('electron');
        const userDataDir = path.join(app.getPath('userData'), 'playwright-browser-data');
        
        const context = await chromium.launchPersistentContext(userDataDir, {
          headless: false,
          viewport: null,
          args: ['--start-maximized', '--disable-blink-features=AutomationControlled'],
          ignoreHTTPSErrors: true
        });
        
        const pages = context.pages();
        page = pages.length > 0 ? pages[0] : await context.newPage();
        needsCleanup = true; // We'll need to close this after
        
        // Store for cleanup
        page._goalAgentContext = context;
        
        console.log('[GoalAgent] Browser launched successfully');
      } catch (launchError) {
        console.error('[GoalAgent] Failed to launch browser:', launchError);
        return { success: false, error: 'Failed to launch browser: ' + launchError.message };
      }
    }
    
    console.log('[GoalAgent] Starting goal execution:', goal);
    console.log('[GoalAgent] Test data:', testData);
    console.log('[GoalAgent] PlaywrightRecorder available:', !!playwrightRecorder);
    
    currentGoalAgent = new AIGoalAgent(page, {
      apiKey: actualApiKey,
      testData: testData || {},
      maxSteps: maxSteps || 50,
      debug: true,
      // CRITICAL: Pass PlaywrightRecorder for proper action execution & recording
      // This enables the Goal Agent to use our existing system that handles:
      // Radix dropdowns, Shadow DOM, tabs, modals, iframes, element indexes
      playwrightRecorder: playwrightRecorder,
      
      onStep: (stepInfo) => {
        console.log('[GoalAgent] Step:', stepInfo.step, '-', stepInfo.action?.description || stepInfo.action?.target);
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('goal-agent-step', stepInfo);
        }
      },
      
      onProgress: (progress) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('goal-agent-progress', progress);
        }
      },
      
      onGoalAchieved: () => {
        console.log('[GoalAgent] Goal achieved!');
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('goal-agent-complete', { success: true });
        }
      },
      
      onError: (error) => {
        console.error('[GoalAgent] Error callback:', error);
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('goal-agent-error', error);
        }
      }
    });
    
    const result = await currentGoalAgent.executeGoal(goal, startUrl);
    currentGoalAgent = null;
    
    console.log('[GoalAgent] Execution complete:', result.success ? 'SUCCESS' : 'INCOMPLETE');
    console.log('[GoalAgent] Steps taken:', result.steps?.length || 0);
    
    // Cleanup if we launched our own browser
    if (needsCleanup && page._goalAgentContext) {
      console.log('[GoalAgent] Closing browser...');
      try {
        await page._goalAgentContext.close();
      } catch (e) {
        console.log('[GoalAgent] Browser close error (may already be closed):', e.message);
      }
    }
    
    return result;
    
  } catch (error) {
    console.error('[GoalAgent] Error:', error.message);
    console.error('[GoalAgent] Stack:', error.stack);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('goal-agent-stop', async (event) => {
  if (currentGoalAgent) {
    currentGoalAgent.stop();
    currentGoalAgent = null;
  }
  return { success: true };
});

// ============================================================================
// END AI GOAL AGENT
// ============================================================================

// Execute a suggestion action in the browser (click, fill, etc.)
ipcMain.handle('embedded-browser-execute-action', async (event, action) => {
  if (!embeddedBrowser?.view) return { success: false, error: 'No browser' };
  
  try {
    const result = await embeddedBrowser.view.webContents.executeJavaScript(`
      (function() {
        const action = ${JSON.stringify(action)};
        console.log('[Flowstral] Executing action:', action.qword, action.args);
        
        // Deep query for Shadow DOM support (like web extension)
        function deepQuery(selector) {
          const results = [];
          
          function traverse(root) {
            try {
              const elements = root.querySelectorAll(selector);
              for (let i = 0; i < elements.length; i++) {
                results.push(elements[i]);
              }
            } catch(e) {}
            
            // Traverse shadow roots
            const allElements = root.querySelectorAll('*');
            for (let j = 0; j < allElements.length; j++) {
              if (allElements[j].shadowRoot) {
                traverse(allElements[j].shadowRoot);
              }
            }
          }
          
          traverse(document);
          return results;
        }
        
        // SALESFORCE-SPECIFIC ELEMENT FINDER
        function findSalesforceElement(text) {
          // App Launcher (waffle icon)
          if (text === 'App Launcher' || text.toLowerCase().includes('app launcher')) {
            const selectors = [
              'button[title="App Launcher"]',
              '[aria-label="App Launcher"]',
              '.appLauncher button',
              '.slds-icon-waffle_container button',
              '[data-aura-class*="appLauncher"]',
              'one-app-launcher-header button',
              '.oneAppLauncherHeader button'
            ];
            for (const sel of selectors) {
              const el = document.querySelector(sel) || deepQuery(sel)[0];
              if (el) return el;
            }
          }
          
          // Setup (gear icon)
          if (text === 'Setup' || text.toLowerCase() === 'setup') {
            const selectors = [
              'button[title="Setup"]',
              'a[title="Setup"]',
              '[aria-label="Setup"]',
              'a[href*="/lightning/setup"]',
              '.setupGear button',
              '[data-aura-class*="setup"] button'
            ];
            for (const sel of selectors) {
              const el = document.querySelector(sel) || deepQuery(sel)[0];
              if (el) return el;
            }
          }
          
          // User Profile / View Profile
          if (text.includes('Profile') || text.includes('Avatar') || text.includes('User')) {
            const selectors = [
              'button[class*="avatar"]',
              '[class*="profileTrigger"] button',
              '.uiImage[class*="photo"]',
              'a[href*="/profilephoto/"]',
              '[data-aura-class*="profile"]'
            ];
            for (const sel of selectors) {
              const el = document.querySelector(sel) || deepQuery(sel)[0];
              if (el) return el;
            }
          }
          
          // Notifications
          if (text === 'Notifications' || text.toLowerCase().includes('notification')) {
            const selectors = [
              'button[title*="notification" i]',
              '[aria-label*="notification" i]',
              '.notification button'
            ];
            for (const sel of selectors) {
              const el = document.querySelector(sel) || deepQuery(sel)[0];
              if (el) return el;
            }
          }
          
          // Help
          if (text === 'Help') {
            const selectors = [
              'button[title="Help"]',
              '[aria-label="Help"]'
            ];
            for (const sel of selectors) {
              const el = document.querySelector(sel) || deepQuery(sel)[0];
              if (el) return el;
            }
          }
          
          return null;
        }
        
        function findElement(selector, text) {
          // FIRST: Try Salesforce-specific elements
          const sfEl = findSalesforceElement(text);
          if (sfEl) return sfEl;
          
          // Normalize selector - could be string or object
          const selectorStr = typeof selector === 'string' 
            ? selector 
            : (selector?.selector || '');
          
          // Try selector first
          if (selectorStr && selectorStr !== 'element' && !selectorStr.includes('undefined')) {
            try {
              const el = document.querySelector(selectorStr) || deepQuery(selectorStr)[0];
              if (el) return el;
            } catch(e) {}
          }
          
          // Find by text content
          if (text) {
            // Try title attribute (critical for Salesforce icons)
            const byTitle = document.querySelector('[title="' + text + '"]') || 
                           document.querySelector('button[title="' + text + '"]') ||
                           document.querySelector('a[title="' + text + '"]');
            if (byTitle) return byTitle;
            
            // Try aria-label
            const byAria = document.querySelector('[aria-label="' + text + '"]') ||
                          document.querySelector('button[aria-label="' + text + '"]');
            if (byAria) return byAria;
            
            // Buttons and links
            const clickables = document.querySelectorAll('button, a, [role="button"], [role="menuitem"], [role="tab"], [role="link"], input[type="submit"], input[type="button"], .slds-button, lightning-button');
            for (const el of clickables) {
              const elText = (el.innerText || el.value || el.title || el.getAttribute('aria-label') || '').trim();
              if (elText === text) {
                if (el.offsetParent !== null || el.offsetWidth > 0) return el;
              }
            }
            
            // Partial match
            for (const el of clickables) {
              const elText = (el.innerText || el.value || el.title || el.getAttribute('aria-label') || '').trim();
              if (elText.includes(text) || text.includes(elText)) {
                if (el.offsetParent !== null || el.offsetWidth > 0) return el;
              }
            }
            
            // Shadow DOM traversal
            const shadowElements = deepQuery('button, a, [role="button"]');
            for (const el of shadowElements) {
              const elText = (el.innerText || el.value || el.title || el.getAttribute('aria-label') || '').trim();
              if (elText === text || elText.includes(text)) return el;
            }
            
            // Any element with matching text
            const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
            while (walker.nextNode()) {
              if (walker.currentNode.textContent.trim() === text) {
                const parent = walker.currentNode.parentElement;
                if (parent && (parent.offsetParent !== null || parent.offsetWidth > 0)) return parent;
              }
            }
          }
          
          return null;
        }
        
        function findInput(label) {
          // By placeholder
          let el = document.querySelector('input[placeholder*="' + label + '" i], textarea[placeholder*="' + label + '" i]');
          if (el) return el;
          
          // By name
          el = document.querySelector('input[name*="' + label + '" i], textarea[name*="' + label + '" i]');
          if (el) return el;
          
          // By aria-label
          el = document.querySelector('input[aria-label*="' + label + '" i], textarea[aria-label*="' + label + '" i]');
          if (el) return el;
          
          // By id
          el = document.querySelector('input[id*="' + label + '" i], textarea[id*="' + label + '" i]');
          if (el) return el;
          
          // Salesforce Lightning inputs
          const lightningInputs = deepQuery('lightning-input input, lightning-textarea textarea, lightning-input-field input');
          for (const inp of lightningInputs) {
            const lblAttr = inp.closest('lightning-input')?.getAttribute('label') ||
                           inp.closest('lightning-input-field')?.getAttribute('label') ||
                           inp.placeholder || inp.name;
            if (lblAttr && lblAttr.toLowerCase().includes(label.toLowerCase())) {
              return inp;
            }
          }
          
          // By associated label
          const labels = document.querySelectorAll('label');
          for (const lbl of labels) {
            if (lbl.innerText.toLowerCase().includes(label.toLowerCase())) {
              if (lbl.htmlFor) {
                el = document.getElementById(lbl.htmlFor);
                if (el) return el;
              }
              el = lbl.querySelector('input, textarea');
              if (el) return el;
            }
          }
          
          return null;
        }
        
        try {
          if (action.qword === 'ClickText' || action.qword === 'ClickElement') {
            const text = action.args[0];
            const selector = action.selector;
            const el = findElement(selector, text);
            
            if (el) {
              el.scrollIntoView({ behavior: 'smooth', block: 'center' });
              return new Promise((resolve) => {
                setTimeout(() => {
                  el.click();
                  // Highlight briefly
                  const oldOutline = el.style.outline;
                  el.style.outline = '3px solid #00D9FF';
                  setTimeout(() => { el.style.outline = oldOutline; }, 500);
                  resolve({ success: true, element: el.tagName, text: text });
                }, 150);
              });
            }
            return { success: false, error: 'Element not found: ' + text };
          }
          
          if (action.qword === 'Fill') {
            const label = action.args[0];
            const value = action.args[1] || '';
            const el = findInput(label);
            
            if (el) {
              el.scrollIntoView({ behavior: 'smooth', block: 'center' });
              el.focus();
              el.value = value;
              el.dispatchEvent(new Event('input', { bubbles: true }));
              el.dispatchEvent(new Event('change', { bubbles: true }));
              // Highlight briefly
              const oldOutline = el.style.outline;
              el.style.outline = '3px solid #00D9FF';
              setTimeout(() => { el.style.outline = oldOutline; }, 500);
              return { success: true, element: el.tagName };
            }
            return { success: false, error: 'Input not found: ' + label };
          }
          
          if (action.qword === 'AssertText') {
            const text = action.args[0];
            const found = document.body.innerText.includes(text);
            return { success: found, found: found };
          }
          
          return { success: false, error: 'Unknown action: ' + action.qword };
        } catch (err) {
          return { success: false, error: err.message };
        }
      })();
    `);
    
    // If successful, also record the action
    if (result.success && embeddedBrowser.recording) {
      embeddedBrowser.recordAction({
        type: action.qword === 'Fill' ? 'fill' : 'click',
        element: {
          text: action.args[0],
          selectors: action.selector ? [{ type: 'custom', value: action.selector, confidence: 0.9 }] : []
        },
        value: action.args[1],
        timestamp: Date.now()
      });
    }
    
    return result;
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Add a recorded action manually (from suggestions)
ipcMain.handle('embedded-browser-add-action', (event, action) => {
  if (!embeddedBrowser) return false;
  
  const enrichedAction = {
    id: `act_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    qword: action.qword,
    args: action.args,
    selector: action.selector ? { value: action.selector, type: 'custom', confidence: 0.9 } : null,
    description: action.description,
    timestamp: Date.now()
  };
  
  embeddedBrowser.actions.push(enrichedAction);
  return enrichedAction;
});

ipcMain.handle('embedded-browser-resize', (event, bounds) => {
  embeddedBrowser?.setBounds(bounds);
  return true;
});

ipcMain.handle('embedded-browser-suggest', async () => {
  if (!embeddedBrowser?.view) return { suggestions: [], categories: {}, timing: '0ms', counts: {} };
  
  const startTime = Date.now();
  
  try {
    const result = await embeddedBrowser.view.webContents.executeJavaScript(`
      (function() {
        const startTime = performance.now();
        const suggestions = [];
        const seen = new Set();
        const counts = { buttons: 0, links: 0, inputs: 0, dropdowns: 0, navigation: 0, menus: 0, checkboxes: 0, assertions: 0 };
        
        function addSuggestion(type, qword, args, description, element, selector, category) {
          const key = qword + ':' + args.join('|');
          if (seen.has(key)) return;
          if (!args[0] || args[0].length === 0) return;
          seen.add(key);
          
          const cat = category || type;
          if (counts[cat] !== undefined) counts[cat]++;
          
          suggestions.push({ 
            type, 
            qword, 
            args, 
            description, 
            element, 
            selector, 
            category: cat,
            // Add selectorObj for robust execution
            selectorObj: {
              primary: selector,
              type: selector ? (selector.startsWith('#') ? 'id' : 
                              selector.startsWith('[name=') ? 'name' :
                              selector.startsWith('[data-testid=') ? 'testid' : 'css') : 'text',
              value: selector || args[0],
              text: args[0]
            }
          });
        }
        
        function getLabel(el) {
          // Try multiple strategies to find a good label
          if (el.getAttribute('aria-label')) return el.getAttribute('aria-label');
          if (el.placeholder) return el.placeholder;
          if (el.title) return el.title;
          if (el.name) return el.name;
          if (el.id) return el.id;
          
          // Check for associated label
          const label = document.querySelector('label[for="' + el.id + '"]');
          if (label) return label.innerText.trim();
          
          // Check parent label
          const parentLabel = el.closest('label');
          if (parentLabel) {
            const labelText = parentLabel.innerText.replace(el.value || '', '').trim();
            if (labelText) return labelText;
          }
          
          return null;
        }
        
        // ============ CLICKABLE ELEMENTS ============
        
        // 1. BUTTONS (highest priority)
        document.querySelectorAll('button:not([disabled]), [role="button"]:not([aria-disabled="true"]), input[type="submit"], input[type="button"]').forEach(el => {
          if (!el.offsetParent || el.offsetWidth === 0) return;
          const text = (el.innerText || el.value || el.title || el.getAttribute('aria-label') || '').trim();
          if (text && text.length > 0 && text.length < 60 && !text.includes('\\n\\n')) {
            const selector = el.id ? '#' + el.id : (el.getAttribute('data-testid') ? '[data-testid="' + el.getAttribute('data-testid') + '"]' : null);
            addSuggestion('click', 'ClickText', [text], 'Click "' + text + '"', 'button', selector, 'buttons');
          }
        });
        
        // 2. LINKS
        document.querySelectorAll('a[href]').forEach(el => {
          if (!el.offsetParent || el.offsetWidth === 0) return;
          const text = (el.innerText || el.title || el.getAttribute('aria-label') || '').trim();
          if (text && text.length > 1 && text.length < 50 && !text.includes('\\n')) {
            addSuggestion('click', 'ClickText', [text], 'Click "' + text + '"', 'link', null, 'links');
          }
        });
        
        // 3. SALESFORCE-SPECIFIC BUTTONS
        document.querySelectorAll('.slds-button, .uiButton, lightning-button, [data-aura-class*="uiButton"]').forEach(el => {
          if (!el.offsetParent || el.offsetWidth === 0) return;
          const text = (el.innerText || el.value || el.title || '').trim();
          if (text && text.length > 0 && text.length < 50 && !seen.has('ClickText:' + text)) {
            addSuggestion('click', 'ClickText', [text], 'Click "' + text + '"', 'slds-button', null, 'buttons');
          }
        });
        
        // ============ SALESFORCE LIGHTNING HEADER (critical elements) ============
        // Note: Salesforce header elements are fixed positioned, so offsetParent checks don't work
        // Instead we check offsetWidth/offsetHeight to verify visibility
        
        function isElementVisible(el) {
          if (!el) return false;
          const rect = el.getBoundingClientRect();
          // Check if element has any size and is within viewport
          return rect.width > 0 && rect.height > 0 && rect.top >= 0 && rect.top < window.innerHeight;
        }
        
        // App Launcher (waffle icon) - PRIORITY - Multiple selectors to find it
        const appLauncherSelectors = [
          'button[title="App Launcher"]',
          '[aria-label="App Launcher"]',
          '[class*="appLauncher"] button',
          '.slds-icon-waffle_container button',
          'one-app-launcher-header button',
          '.oneAppLauncherHeader button',
          '[data-aura-class*="appLauncher"]'
        ];
        let foundAppLauncher = false;
        for (const sel of appLauncherSelectors) {
          if (foundAppLauncher) break;
          try {
            const el = document.querySelector(sel);
            if (el && isElementVisible(el)) {
              addSuggestion('click', 'ClickElement', ['App Launcher'], 'Open App Launcher', 'appLauncher', sel, 'navigation');
              foundAppLauncher = true;
            }
          } catch(e) {}
        }
        
        // Setup (gear icon) - PRIORITY
        const setupSelectors = [
          'button[title="Setup"]',
          'a[title="Setup"]',
          '[aria-label="Setup"]',
          'a[href*="/lightning/setup"]',
          '.setupGear button',
          '[class*="setup"] button'
        ];
        let foundSetup = false;
        for (const sel of setupSelectors) {
          if (foundSetup) break;
          try {
            const el = document.querySelector(sel);
            if (el && isElementVisible(el)) {
              addSuggestion('click', 'ClickElement', ['Setup'], 'Open Setup', 'setup', sel, 'navigation');
              foundSetup = true;
            }
          } catch(e) {}
        }
        
        // User Profile / View Profile - PRIORITY
        const profileSelectors = [
          'button[class*="avatar"]',
          'button[class*="profile"]',
          '[class*="profileTrigger"] button',
          'img[class*="photo"]',
          '.userProfile button',
          '.uiImage[class*="photo"]'
        ];
        let foundProfile = false;
        for (const sel of profileSelectors) {
          if (foundProfile) break;
          try {
            const el = document.querySelector(sel);
            if (el && isElementVisible(el)) {
              const parent = el.closest('button, a, [role="button"]') || el;
              const label = parent.getAttribute('aria-label') || parent.title || 'User Profile';
              addSuggestion('click', 'ClickElement', [label || 'User Profile'], 'Open User Menu', 'profile', sel, 'navigation');
              foundProfile = true;
            }
          } catch(e) {}
        }
        
        // Global Search - PRIORITY
        const searchSelectors = [
          'input[placeholder*="Search" i]',
          '.slds-global-header__item_search input',
          '[class*="globalSearch"] input',
          '[aria-label*="Search" i]'
        ];
        let foundSearch = false;
        for (const sel of searchSelectors) {
          if (foundSearch) break;
          try {
            const el = document.querySelector(sel);
            if (el && isElementVisible(el)) {
              const placeholder = el.placeholder || el.getAttribute('aria-label') || 'Search';
              addSuggestion('fill', 'Fill', [placeholder, ''], 'Search in Salesforce', 'search', sel, 'navigation');
              foundSearch = true;
            }
          } catch(e) {}
        }
        
        // Notifications bell
        const notificationSelectors = [
          'button[title*="notification" i]',
          '[aria-label*="notification" i]',
          '.notification button'
        ];
        for (const sel of notificationSelectors) {
          try {
            const el = document.querySelector(sel);
            if (el && isElementVisible(el)) {
              addSuggestion('click', 'ClickElement', ['Notifications'], 'Open Notifications', 'notifications', sel, 'navigation');
              break;
            }
          } catch(e) {}
        }
        
        // Help icon
        const helpSelectors = [
          'button[title="Help"]',
          '[aria-label="Help"]',
          '.help button'
        ];
        for (const sel of helpSelectors) {
          try {
            const el = document.querySelector(sel);
            if (el && isElementVisible(el)) {
              addSuggestion('click', 'ClickElement', ['Help'], 'Open Help', 'help', sel, 'navigation');
              break;
            }
          } catch(e) {}
        }
        
        // ============ INPUT ELEMENTS ============
        
        // 4. TEXT INPUTS
        document.querySelectorAll('input[type="text"], input[type="email"], input[type="tel"], input[type="url"], input[type="search"], input[type="number"], input:not([type]), textarea').forEach(el => {
          if (!el.offsetParent || el.offsetWidth === 0 || el.disabled || el.readOnly) return;
          const label = getLabel(el);
          if (label) {
            const selector = el.id ? '#' + el.id : (el.name ? '[name="' + el.name + '"]' : null);
            addSuggestion('fill', 'Fill', [label, ''], 'Type into "' + label + '"', 'input', selector, 'inputs');
          }
        });
        
        // 5. PASSWORD INPUTS
        document.querySelectorAll('input[type="password"]').forEach(el => {
          if (!el.offsetParent || el.offsetWidth === 0 || el.disabled) return;
          const label = getLabel(el) || 'password';
          const selector = el.id ? '#' + el.id : (el.name ? '[name="' + el.name + '"]' : null);
          addSuggestion('fill', 'Fill', [label, ''], 'Enter password in "' + label + '"', 'password', selector, 'inputs');
        });
        
        // 6. SALESFORCE INPUTS
        document.querySelectorAll('lightning-input input, lightning-textarea textarea, [data-aura-class*="uiInput"] input').forEach(el => {
          if (!el.offsetParent || el.offsetWidth === 0 || el.disabled) return;
          const label = getLabel(el);
          if (label && !seen.has('Fill:' + label + '|')) {
            addSuggestion('fill', 'Fill', [label, ''], 'Type into "' + label + '"', 'lightning-input', null, 'inputs');
          }
        });
        
        // ============ SELECT/DROPDOWN ============
        
        // 7. STANDARD SELECTS
        document.querySelectorAll('select:not([disabled])').forEach(el => {
          if (!el.offsetParent || el.offsetWidth === 0) return;
          const label = getLabel(el) || 'dropdown';
          const selector = el.id ? '#' + el.id : (el.name ? '[name="' + el.name + '"]' : null);
          addSuggestion('select', 'Select', [label, ''], 'Select from "' + label + '"', 'select', selector, 'dropdowns');
        });
        
        // 8. COMBOBOXES
        document.querySelectorAll('[role="combobox"], [role="listbox"], lightning-combobox, lightning-picklist').forEach(el => {
          if (!el.offsetParent || el.offsetWidth === 0) return;
          const label = el.getAttribute('aria-label') || el.getAttribute('label') || 'dropdown';
          addSuggestion('click', 'ClickText', [label], 'Open "' + label + '"', 'combobox', null, 'dropdowns');
        });
        
        // ============ NAVIGATION ============
        
        // 9. TABS
        document.querySelectorAll('[role="tab"], .slds-tabs_default__item a, .slds-tabs__nav-link').forEach(el => {
          if (!el.offsetParent) return;
          const text = (el.innerText || el.getAttribute('aria-label') || '').trim();
          if (text && text.length > 0 && text.length < 40) {
            addSuggestion('click', 'ClickText', [text], 'Click tab "' + text + '"', 'tab', null, 'navigation');
          }
        });
        
        // 10. MENU ITEMS
        document.querySelectorAll('[role="menuitem"], [role="option"], .slds-dropdown__item a, .slds-listbox__option').forEach(el => {
          if (!el.offsetParent) return;
          const text = (el.innerText || '').trim();
          if (text && text.length > 0 && text.length < 50) {
            addSuggestion('click', 'ClickText', [text], 'Select "' + text + '"', 'menuitem', null, 'menus');
          }
        });
        
        // ============ CHECKBOXES & TOGGLES ============
        
        // 11. CHECKBOXES
        document.querySelectorAll('input[type="checkbox"]:not([disabled]), [role="checkbox"]:not([aria-disabled="true"])').forEach(el => {
          if (!el.offsetParent) return;
          const label = getLabel(el) || el.closest('label')?.innerText?.trim() || 'checkbox';
          if (label && label.length < 50) {
            addSuggestion('click', 'ClickText', [label], 'Toggle "' + label + '"', 'checkbox', null, 'checkboxes');
          }
        });
        
        // ============ ASSERTIONS ============
        
        // 12. PAGE HEADERS
        document.querySelectorAll('h1, h2, .slds-page-header__title, .slds-card__header-title').forEach(el => {
          if (!el.offsetParent) return;
          const text = (el.innerText || '').trim().substring(0, 60);
          if (text && text.length > 2) {
            addSuggestion('assert', 'AssertText', [text], 'Verify "' + text + '"', 'header', null, 'assertions');
          }
        });
        
        // 13. RECORD NAMES (Salesforce)
        document.querySelectorAll('.slds-page-header__name-title h1, .entityNameTitle, lightning-formatted-name').forEach(el => {
          if (!el.offsetParent) return;
          const text = (el.innerText || '').trim();
          if (text && text.length > 0) {
            addSuggestion('assert', 'AssertText', [text], 'Verify record "' + text + '"', 'record', null, 'assertions');
          }
        });
        
        // 14. SUCCESS/ERROR MESSAGES
        document.querySelectorAll('.slds-notify, .toastMessage, [role="alert"], .slds-theme_success, .slds-theme_error').forEach(el => {
          if (!el.offsetParent) return;
          const text = (el.innerText || '').trim().substring(0, 60);
          if (text && text.length > 0) {
            addSuggestion('assert', 'AssertText', [text], 'Verify message "' + text + '"', 'toast', null, 'assertions');
          }
        });
        
        const duration = (performance.now() - startTime).toFixed(1);
        console.log('[Flowstral Suggest] Found ' + suggestions.length + ' suggestions in ' + duration + 'ms');
        
        // Group by category
        const categories = {};
        suggestions.forEach(s => {
          if (!categories[s.category]) categories[s.category] = [];
          categories[s.category].push(s);
        });
        
        return { 
          suggestions, 
          categories, 
          counts, 
          timing: duration + 'ms',
          total: suggestions.length 
        };
      })();
    `);
    
    const duration = Date.now() - startTime;
    console.log('[EmbeddedBrowser] Found', result?.total || 0, 'suggestions in', duration + 'ms');
    
    return result || { suggestions: [], categories: {}, counts: {}, timing: duration + 'ms', total: 0 };
  } catch (error) {
    console.error('[EmbeddedBrowser] Suggest failed:', error.message);
    return { suggestions: [], categories: {}, counts: {}, timing: '0ms', total: 0, error: error.message };
  }
});

// Export handlers
ipcMain.handle('export-flowstral-test', (event, testName) => {
  return embeddedBrowser?.exportAsFlowstralTest(testName);
});

ipcMain.handle('export-robot-framework', (event, testName) => {
  return embeddedBrowser?.exportAsRobotFramework(testName);
});

ipcMain.handle('export-playwright', () => {
  return embeddedBrowser?.exportAsPlaywright();
});

// Export test case to builder - accepts either testName (for embeddedBrowser) or full testCase object
ipcMain.handle('export-to-test-builder', async (event, testNameOrData) => {
  try {
    let testCase;
    
    // Check if we received a full test case object (from PlaywrightRecorderPage)
    if (typeof testNameOrData === 'object' && testNameOrData.steps) {
      console.log('[Export] Received test case object with', testNameOrData.steps.length, 'steps');
      
      // Deduplicate fills and filter phantom actions (delegated to extracted module)
      const renumberedSteps = deduplicateAndFilterSteps(testNameOrData.steps);

      testCase = {
        ...testNameOrData,
        steps: renumberedSteps
      };
    } else {
      // Legacy: Get data from embeddedBrowser using testName
      const testName = testNameOrData;
      const testData = embeddedBrowser?.exportAsFlowstralTest(testName);
      if (!testData || testData.steps.length === 0) {
        // Try playwrightRecorder as fallback
        const pwActions = playwrightRecorder?.getActions() || [];
        if (pwActions.length === 0) {
          return { success: false, error: 'No steps to export' };
        }
        // Convert playwright actions to test case
        testCase = {
          id: `tc_${Date.now()}`,
          name: testName || 'Recorded Test',
          description: `Recorded on ${new Date().toISOString()}`,
          steps: pwActions.map((action, idx) => ({
            id: action.id || `step_${Date.now()}_${idx}`,
            type: action.qword === 'GoTo' ? 'navigate' : action.qword === 'Fill' ? 'input' : 'click',
            name: action.description || `Step ${idx + 1}`,
            url: action.qword === 'GoTo' ? action.args?.[0] : '',
            selector: action.selectorObj?.selector || '',
            selectorObj: action.selectorObj,
            value: action.qword === 'Fill' ? action.args?.[1] : '',
            qword: action.qword,
            args: action.args,
            enabled: true,
          })),
          metadata: { source: 'playwright-recorder' }
        };
      } else {
        testCase = testData;
      }
    }
    
    console.log('[Export] Exporting', testCase.steps?.length, 'steps to Test Builder');
    
    // Navigate to Test Builder with the test data
    showWebappView();
    
    // If we already have a properly formatted test case (from PlaywrightRecorderPage), use it directly
    if (testCase.steps && testCase.steps.length > 0 && testCase.steps[0].type) {
      console.log('[Export] Using pre-formatted test case, skipping conversion');
      
      // Encode the test case as base64 URL parameter for reliable transfer
      const dataToInject = JSON.stringify(testCase);
      const encodedData = Buffer.from(dataToInject).toString('base64');
      
      const webapp = getWebappUrl();
      const dataParam = encodeURIComponent(encodedData);
      
      console.log('[Export] Navigating to builder with encoded data');
      
      // Navigate with data in URL - use webappView if available, otherwise mainWindow
      const target = webappView?.webContents || mainWindow?.webContents;
      if (target) {
        if (webapp.filePath) {
          const basePath = webapp.filePath.replace(/index\.html$/, '');
          await target.loadFile(path.join(basePath, 'index.html'), { 
            hash: `/test-cases/builder?data=${dataParam}` 
          });
        } else {
          await target.loadURL(`${webapp.url}/test-cases/builder?data=${dataParam}`);
        }
        console.log('[Export] Successfully exported test case:', testCase.name);
        return { success: true, testCase };
      } else {
        console.error('[Export] No webapp target available');
        return { success: false, error: 'No webapp target available' };
      }
    }
    
    // Legacy path: Build test case from raw step data (embeddedBrowser format)
    // This only runs if testCase doesn't have properly typed steps
    console.log('[Export] Converting raw step data to test case format');
    const testData = testCase; // Save original data for conversion
    
    // getBestCssSelector() and buildSelectorObj() are imported from ./index-export-helpers.js

    // Build the test case in the format Test Builder expects
    const formattedTestCase = {
      id: `tc_${Date.now()}`,
      name: testData.name || 'Recorded Test',
      description: testData.description || `Recorded on ${new Date().toISOString()}`,
      tags: ['recorded', 'desktop'],
      steps: testData.steps.map((step, idx) => {
        const enrichedSelectorObj = buildSelectorObj(step);
        const cssSelector = getBestCssSelector(step);
        
        // For Fill steps, ensure we have a proper CSS selector
        let finalSelector = cssSelector;
        if (step.qword === 'Fill' && !finalSelector) {
          // Build selector from element attributes - check multiple sources
          const el = step.raw?.element || {};
          const selectorObj = step.selectorObj || {};
          const name = el.name || selectorObj.name || '';
          const id = el.id || selectorObj.id || '';
          const placeholder = el.placeholder || selectorObj.placeholder || '';
          
          // Also try to extract from args[0] if it looks like a field name
          const argName = step.args?.[0] || '';
          
          if (name) {
            finalSelector = `[name="${name}"]`;
          } else if (id) {
            finalSelector = `#${id}`;
          } else if (placeholder) {
            finalSelector = `[placeholder="${placeholder}"]`;
          } else if (argName && !argName.includes(' ')) {
            // If args[0] is a simple name like "username" or "pw", use it as name selector
            finalSelector = `[name="${argName}"]`;
          }
          
          console.log('[Export] Fill step selector:', { name, id, placeholder, argName, finalSelector });
        }
        
        return {
          id: step.id || `step_${Date.now()}_${idx}`,
          type: mapQWordToStepType(step.qword),
          name: step.name || step.description || `Step ${idx + 1}`,
          // Handle different step types
          url: step.qword === 'GoTo' ? step.args[0] : '',
          // CRITICAL: Use CSS selector for Fill steps
          selector: finalSelector || cssSelector,
          selectorObj: enrichedSelectorObj,
          // For Fill: target should also be the CSS selector for the test runner
          target: step.qword === 'Fill' ? (finalSelector || step.args[0]) : '',
          value: step.qword === 'Fill' ? step.args[1] : (step.args?.[0] || ''),
          qword: step.qword,
          args: step.args,
          displayArgs: step.displayArgs,
          enabled: true,
          expectedResult: step.qword === 'GoTo' ? 'Page loads successfully' : 
                          step.qword === 'Fill' ? 'Value entered successfully' :
                          step.qword === 'ClickText' ? 'Element clicked successfully' : '',
        };
      }),
      variables: [],
      settings: { timeout: 30000, retries: 0 },
      metadata: { 
        createdAt: new Date().toISOString(), 
        source: 'flowstral-desktop',
        recordedSteps: testData.steps.length
      },
    };
    
    // Inject into webapp's localStorage
    const timestamp2 = Date.now().toString();
    await webappView?.webContents.executeJavaScript(`
      localStorage.setItem('unified_test_case', ${JSON.stringify(JSON.stringify(formattedTestCase))});
      localStorage.setItem('unified_test_case_timestamp', '${timestamp2}');
      console.log('[Flowstral Desktop] Exported test case:', ${JSON.stringify(formattedTestCase.name)}, 'with', ${formattedTestCase.steps.length}, 'steps');
    `);
    
    // Navigate to builder
    navigateWebapp('/test-cases/builder');
    
    console.log('[Export] Successfully exported test case:', formattedTestCase.name);
    return { success: true, testCase: formattedTestCase };
  } catch (error) {
    console.error('[Export] Failed:', error.message);
    return { success: false, error: error.message };
  }
});

// mapQWordToStepType is imported from ./index-export-helpers.js

// Utility handlers
ipcMain.handle('check-updates', async () => {
  return await autoUpdater.checkForUpdates();
});

ipcMain.handle('install-update', () => {
  autoUpdater.quitAndInstall();
});

ipcMain.handle('open-external', (event, url) => {
  shell.openExternal(url);
});

ipcMain.handle('open-devtools', () => {
  webappView?.webContents.openDevTools({ mode: 'detach' });
});

// ============================================================================
// Local Storage IPC Handlers
// ============================================================================

// Test Cases
ipcMain.handle('local-storage-get-test-cases', () => {
  return localStorage?.getTestCases() || [];
});

ipcMain.handle('local-storage-save-test-case', (event, testCase) => {
  return localStorage?.saveTestCase(testCase);
});

ipcMain.handle('local-storage-delete-test-case', (event, id) => {
  return localStorage?.deleteTestCase(id);
});

// Test Runs
ipcMain.handle('local-storage-get-test-runs', () => {
  return localStorage?.getTestRuns() || [];
});

ipcMain.handle('local-storage-save-test-run', (event, testRun) => {
  return localStorage?.saveTestRun(testRun);
});

// Recording Sessions
ipcMain.handle('local-storage-get-recording-sessions', () => {
  return localStorage?.getRecordingSessions() || [];
});

ipcMain.handle('local-storage-save-recording-session', (event, session) => {
  return localStorage?.saveRecordingSession(session);
});

// Elements
ipcMain.handle('local-storage-get-elements', () => {
  return localStorage?.getElements() || [];
});

ipcMain.handle('local-storage-save-element', (event, element) => {
  return localStorage?.saveElement(element);
});

// Test Results
ipcMain.handle('local-storage-get-test-results', () => {
  return localStorage?.getTestResults() || [];
});

ipcMain.handle('local-storage-save-test-result', (event, result) => {
  return localStorage?.saveTestResult(result);
});

// Sync
ipcMain.handle('local-storage-get-pending-sync', () => {
  return localStorage?.getAllPendingSync() || {};
});

ipcMain.handle('local-storage-mark-synced', (event, { collection, ids }) => {
  return localStorage?.markAsSynced(collection, ids);
});

// Import/Export
ipcMain.handle('local-storage-export-all', () => {
  return localStorage?.exportAll();
});

ipcMain.handle('local-storage-import-all', async (event, data) => {
  return localStorage?.importAll(data);
});

ipcMain.handle('local-storage-import-file', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Import Test Data',
    filters: [{ name: 'JSON', extensions: ['json'] }],
    properties: ['openFile']
  });
  
  if (result.canceled || !result.filePaths.length) {
    return { success: false, canceled: true };
  }
  
  try {
    const filePath = result.filePaths[0];
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    localStorage?.importAll(data);
    return { success: true, filePath };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('local-storage-export-file', async () => {
  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Export Test Data',
    defaultPath: `flowstral-export-${new Date().toISOString().split('T')[0]}.json`,
    filters: [{ name: 'JSON', extensions: ['json'] }]
  });
  
  if (result.canceled || !result.filePath) {
    return { success: false, canceled: true };
  }
  
  try {
    const data = localStorage?.exportAll();
    fs.writeFileSync(result.filePath, JSON.stringify(data, null, 2), 'utf8');
    return { success: true, filePath: result.filePath };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// ============================================================================
// Test Execution IPC Handlers
// ============================================================================

let currentTestExecutor = null;

ipcMain.handle('execute-test', async (event, testData) => {
  try {
    // Clean up any existing executor
    if (currentTestExecutor) {
      await currentTestExecutor.cleanup();
    }
    
    const preferences = store.get('preferences') || {};
    
    currentTestExecutor = new TestExecutor({
      browserType: preferences.browserType || 'chromium',
      headless: preferences.headless ?? false,
      viewport: preferences.viewport || { width: 1280, height: 720 },
      timeout: testData.settings?.timeout || 30000,
      capturePassScreenshots: preferences.capturePassScreenshots ?? false, // Disabled by default to reduce flickering
      onStepStart: (index, step) => {
        // Send to both old channel (index) and new channel (stepIndex) for compatibility
        mainWindow?.webContents.send('test-step-start', { index, step });
        sendToWebapp('test-step-start', { index, step });
        // Also send to playwright-specific channels with stepIndex
        mainWindow?.webContents.send('playwright-test-step-start', { stepIndex: index, step });
        sendToWebapp('playwright-test-step-start', { stepIndex: index, step });
      },
      onStepComplete: (index, step, result) => {
        const success = result?.status === 'passed';
        // Send to both old and new channels
        mainWindow?.webContents.send('test-step-complete', { index, step, result });
        sendToWebapp('test-step-complete', { index, step, result });
        // Also send to playwright-specific channels with Lock Locators data
        mainWindow?.webContents.send('playwright-test-step-complete', { 
          stepIndex: index, 
          success, 
          error: result?.error,
          screenshot: result?.screenshot,
          // Lock Locators data
          workingSelector: result?.workingSelector,
          strategyType: result?.strategyType,
          // Self-healing data
          healed: result?.healed,
          newSelector: result?.newSelector
        });
        sendToWebapp('playwright-test-step-complete', { 
          stepIndex: index, 
          success, 
          error: result?.error,
          screenshot: result?.screenshot,
          // Lock Locators data
          workingSelector: result?.workingSelector,
          strategyType: result?.strategyType,
          // Self-healing data
          healed: result?.healed,
          newSelector: result?.newSelector
        });
      },
      onStepFlagged: (index, step) => {
        // Send flagged step notification to frontend
        console.log(`[Execute] 🚩 Step ${index + 1} flagged: "${step.name || step.label}"`);
        mainWindow?.webContents.send('test-step-flagged', { 
          index, 
          step,
          reason: step.flagReason || 'Flagged for review',
          status: 'paused_at_flagged'
        });
        sendToWebapp('test-step-flagged', { 
          index, 
          step,
          reason: step.flagReason || 'Flagged for review',
          status: 'paused_at_flagged'
        });
        // Also send to playwright-specific channel
        mainWindow?.webContents.send('playwright-test-paused', { 
          stepIndex: index, 
          reason: 'flagged',
          flagReason: step.flagReason || 'Flagged for review'
        });
        sendToWebapp('playwright-test-paused', { 
          stepIndex: index, 
          reason: 'flagged',
          flagReason: step.flagReason || 'Flagged for review'
        });
      },
      onTestComplete: (results) => {
        mainWindow?.webContents.send('test-complete', results);
        sendToWebapp('test-complete', results);
        // Also send to playwright-specific channel
        mainWindow?.webContents.send('playwright-test-complete', { 
          success: results.status === 'passed',
          steps: results.steps 
        });
        sendToWebapp('playwright-test-complete', { 
          success: results.status === 'passed',
          steps: results.steps 
        });
        
        // Save results to local storage
        localStorage?.saveTestResult({
          testId: testData.id,
          testName: testData.name,
          ...results
        });
      }
    });
    
    const results = await currentTestExecutor.executeTest(testData);
    return results;
    
  } catch (error) {
    console.error('[Execute] Error:', error);
    return { status: 'error', error: error.message };
  }
});

ipcMain.handle('cancel-test', async () => {
  try {
    if (currentTestExecutor) {
      await currentTestExecutor.cleanup();
      currentTestExecutor = null;
    }
    return true;
  } catch (error) {
    return false;
  }
});

ipcMain.handle('execute-test-headless', async (event, testData) => {
  try {
    const executor = new TestExecutor({
      browserType: 'chromium',
      headless: true,
      timeout: testData.settings?.timeout || 30000,
    });
    
    const results = await executor.executeTest(testData);
    
    // Save results
    localStorage?.saveTestResult({
      testId: testData.id,
      testName: testData.name,
      headless: true,
      ...results
    });
    
    return results;
  } catch (error) {
    return { status: 'error', error: error.message };
  }
});

// Auto-updater events
autoUpdater.on('update-available', (info) => {
  mainWindow?.webContents.send('update-available', info);
});

autoUpdater.on('update-downloaded', (info) => {
  mainWindow?.webContents.send('update-downloaded', info);
});

// ============================================================================
// App Lifecycle
// ============================================================================

app.whenReady().then(async () => {
  createWindow();
  await initializeServices();
  createTray();

  // Update titlebar when system theme changes
  const { nativeTheme } = require('electron');
  nativeTheme.on('updated', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      const theme = getTitleBarColors();
      mainWindow.setTitleBarOverlay({ color: theme.color, symbolColor: theme.symbolColor });
      mainWindow.setBackgroundColor(theme.backgroundColor);
    }
  });
  
  // Register diagnostics IPC handlers for remote support
  registerDiagnosticsIPC(ipcMain);
  console.log('[App] Diagnostics collector initialized');
  
  // Register global shortcut to open webapp DevTools (F12)
  globalShortcut.register('F12', () => {
    if (webappView) {
      webappView.webContents.openDevTools({ mode: 'detach' });
    } else {
      mainWindow?.webContents.openDevTools({ mode: 'detach' });
    }
  });
  
  // Also register Ctrl+Shift+D for webapp DevTools specifically
  globalShortcut.register('CommandOrControl+Shift+D', () => {
    if (webappView) {
      webappView.webContents.openDevTools({ mode: 'detach' });
    }
  });
  
  // Check for updates in production
  if (!process.argv.includes('--dev')) {
    autoUpdater.checkForUpdatesAndNotify();
  }
  
  console.log('[App] Flowstral Desktop v2.0 ready');
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    if (!store.get('preferences.minimizeToTray')) {
      app.quit();
    }
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.on('before-quit', async () => {
  app.isQuitting = true;
  await browserController?.close();
  await cloudConnector?.disconnect();
  embeddedBrowser?.destroy();
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
});

module.exports = { app };
