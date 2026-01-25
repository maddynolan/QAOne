# QAAI PWA Testing Guide

## Overview

QAAI now includes comprehensive Progressive Web App (PWA) testing capabilities. Test manifest validation, service workers, offline functionality, and cache storage without leaving the platform.

## What Are PWAs?

Progressive Web Apps are web applications that provide app-like experiences:

| Feature | Description |
|---------|-------------|
| **Installable** | Can be installed on devices like native apps |
| **Offline-First** | Work without network using Service Workers |
| **Cross-Platform** | Single codebase runs everywhere |
| **Background Tasks** | Push notifications, background sync |

## Quick Start

### Using the Test Builder

Add PWA testing steps in the Test Builder:

1. **PWA Audit** - Comprehensive check of all PWA criteria
2. **Check Manifest** - Validate web app manifest
3. **Check Service Worker** - Verify SW registration
4. **Test Offline** - Verify offline functionality
5. **Check Cache** - Verify cached resources

### Using IPC Channels (From Renderer)

```javascript
// Run comprehensive PWA audit
const audit = await window.flowstral.invoke('pwa-audit', {
  checkManifest: true,
  checkServiceWorker: true,
  checkOffline: true,
  checkCache: true,
  expectedElements: ['body', '.main-content'],
  expectedText: ['Welcome']
});

console.log(`PWA Score: ${audit.score}/100`);
console.log(`Installable: ${audit.categories.manifest?.valid}`);
```

### Using Action Handlers (In Tests)

```javascript
// In your test steps
const steps = [
  { type: 'goto', url: 'https://your-pwa.com' },
  { type: 'wait', value: 2000 },
  { 
    type: 'pwaAudit',
    expectedElements: ['body', '#app'],
    expectedText: ['Home']
  }
];
```

## Available Actions

### 1. PWA Audit (`pwaAudit` / `validatePwa`)

Comprehensive PWA validation that checks all criteria:

```javascript
{
  type: 'pwaAudit',
  checkManifest: true,       // Check manifest.json (default: true)
  checkServiceWorker: true,  // Check SW registration (default: true)
  checkOffline: true,        // Test offline mode (default: true)
  checkCache: true,          // Verify cache storage (default: true)
  expectedElements: ['body', '.app'],  // Elements that should exist offline
  expectedText: ['Welcome'],           // Text that should exist offline
  expectedCachedUrls: ['/app.js']      // URLs that should be cached
}
```

**Returns:**
```javascript
{
  success: true,
  score: 85,           // 0-100 score
  passed: true,        // true if score >= 75
  categories: {
    manifest: { valid: true, issues: [], warnings: [] },
    serviceWorker: { registered: true, ready: true },
    offline: { offlineCapable: true },
    cache: { success: true, resourceCheck: {...} }
  },
  summary: {
    status: 'PASS',
    checks: [...]
  }
}
```

### 2. Check Manifest (`checkManifest` / `validateManifest`)

Validates the Web App Manifest (manifest.json):

```javascript
{ type: 'checkManifest' }
```

**Validates:**
- Required fields (name, icons, start_url, display)
- Icon sizes (192x192, 512x512 required)
- Display mode (standalone, fullscreen, etc.)
- Theme and background colors
- Scope and start URL

**Returns:**
```javascript
{
  success: true,
  valid: true,
  manifestUrl: 'https://example.com/manifest.json',
  score: 85,
  issues: [],
  warnings: ['Missing recommended field: "description"'],
  manifest: {
    name: 'My PWA',
    short_name: 'PWA',
    display: 'standalone',
    icons: 5
  }
}
```

### 3. Check Service Worker (`checkServiceWorker` / `serviceWorkerStatus`)

Checks if a service worker is registered and active:

```javascript
{ type: 'checkServiceWorker' }
```

**Returns:**
```javascript
{
  success: true,
  supported: true,
  registered: true,
  ready: true,
  count: 1,
  registrations: [{
    scope: 'https://example.com/',
    active: { state: 'activated', scriptURL: '...' }
  }]
}
```

### 4. Wait for Service Worker (`waitForServiceWorker`)

Waits for a service worker to reach a specific state:

```javascript
{
  type: 'waitForServiceWorker',
  state: 'activated',  // 'installing', 'installed', 'activating', 'activated'
  timeout: 30000
}
```

### 5. Test Offline (`testOffline` / `offlineTest`)

Tests PWA offline functionality:

```javascript
{
  type: 'testOffline',
  expectedElements: ['body', '#app', '.header'],  // Must be visible offline
  expectedText: ['Welcome', 'Offline'],           // Must be visible offline
  expectedUrls: ['/about', '/contact'],           // Must be navigable offline
  skipReload: false  // If true, tests current state without reload
}
```

**Returns:**
```javascript
{
  success: true,
  offlineCapable: true,
  elementChecks: [
    { selector: 'body', visible: true, passed: true },
    { selector: '#app', visible: true, passed: true }
  ],
  textChecks: [
    { text: 'Welcome', visible: true, passed: true }
  ],
  urlChecks: [
    { url: '/about', accessible: true, passed: true }
  ]
}
```

### 6. Check Cache (`checkCache` / `verifyCache`)

Verifies cache storage contents:

```javascript
{
  type: 'checkCache',
  checkResources: true,       // Check critical resources (default: true)
  checkStyles: true,          // Check CSS files (default: true)
  checkScripts: true,         // Check JS files (default: true)
  checkImages: false,         // Check images (default: false)
  checkFonts: false,          // Check fonts (default: false)
  expectedUrls: ['/app.js', '/styles.css']  // Specific URLs to verify
}
```

**Returns:**
```javascript
{
  success: true,
  cacheCount: 2,
  totalEntries: 45,
  cacheNames: ['workbox-precache-v2', 'runtime-cache'],
  resourceCheck: {
    checks: {
      styles: { total: 3, cached: 3, percentage: 100 },
      scripts: { total: 5, cached: 5, percentage: 100 }
    }
  },
  urlCheck: {
    allCached: true,
    checks: [{ url: '/app.js', cached: true }]
  }
}
```

### 7. Check Installability (`checkInstallability` / `pwaInstallable`)

Checks if PWA meets all installability criteria:

```javascript
{ type: 'checkInstallability' }
```

**Returns:**
```javascript
{
  success: true,
  installable: true,
  criteria: {
    hasManifest: true,
    hasServiceWorker: true,
    isHttps: true,
    hasRequiredIcons: true,
    hasValidStartUrl: true,
    hasValidDisplayMode: true
  },
  issues: []
}
```

## IPC Channels Reference

Available from the renderer process:

| Channel | Description |
|---------|-------------|
| `pwa-audit` | Run comprehensive PWA audit |
| `pwa-check-manifest` | Validate manifest |
| `pwa-check-service-worker` | Check SW status |
| `pwa-wait-for-service-worker` | Wait for SW state |
| `pwa-test-offline` | Test offline functionality |
| `pwa-check-cache` | Verify cache storage |
| `pwa-check-installability` | Check installability |
| `pwa-clear-caches` | Clear all caches |
| `pwa-get-cache-info` | Get detailed cache info |
| `pwa-unregister-service-workers` | Unregister all SWs |
| `pwa-go-offline` | Manually go offline |
| `pwa-go-online` | Restore network |

## Example Usage

### Example: Comprehensive PWA Test

```javascript
const pwaTestSteps = [
  // Navigate to PWA
  { type: 'goto', url: 'https://your-pwa.com' },
  
  // Wait for app to load
  { type: 'wait', value: 3000 },
  
  // Run comprehensive audit
  {
    type: 'pwaAudit',
    expectedElements: ['body', '#root', '.app-header'],
    expectedText: ['Welcome to My App']
  },
  
  // Verify specific cache contents
  {
    type: 'checkCache',
    expectedUrls: ['/static/js/main.js', '/static/css/main.css']
  }
];
```

### Example: Offline-Specific Test

```javascript
const offlineTestSteps = [
  // Navigate and wait for SW
  { type: 'goto', url: 'https://your-pwa.com' },
  { type: 'waitForServiceWorker', state: 'activated', timeout: 30000 },
  
  // Test specific offline functionality
  {
    type: 'testOffline',
    expectedElements: ['body', '.offline-banner'],
    expectedText: ['You are offline', 'Cached content'],
    expectedUrls: ['/', '/about']
  }
];
```

## Scoring Criteria

The PWA Audit score (0-100) is based on:

| Category | Points | Criteria |
|----------|--------|----------|
| **Manifest** | 25 | Valid manifest with required fields |
| **Service Worker** | 25 | Registered and ready |
| **Offline** | 30 | Works offline (elements visible) |
| **Cache** | 20 | Critical resources cached |

**Pass Threshold:** 75 points

## Best Practices

### 1. Test After Service Worker Activation

```javascript
// Wait for SW before testing
{ type: 'waitForServiceWorker', state: 'activated' }
```

### 2. Specify Expected Offline Content

```javascript
// Be specific about what should work offline
{
  type: 'testOffline',
  expectedElements: [
    'body',
    '.app-shell',
    '.navigation',
    '.cached-content'
  ],
  expectedText: [
    'Offline Mode',
    'Cached Data'
  ]
}
```

### 3. Verify Critical Resources Are Cached

```javascript
// Check your essential assets
{
  type: 'checkCache',
  expectedUrls: [
    '/static/js/main.bundle.js',
    '/static/css/app.css',
    '/manifest.json',
    '/offline.html'
  ]
}
```

### 4. Clean State Testing

```javascript
// Clear caches before testing fresh install experience
await window.flowstral.invoke('pwa-clear-caches');
await window.flowstral.invoke('pwa-unregister-service-workers');
// Then reload and test
```

## Troubleshooting

### "No page available"

Start recording first before running PWA tests. The tests need an active page.

### "CDP session not available"

Offline testing requires CDP (Chrome DevTools Protocol). Ensure you're using Chromium-based browser.

### Service Worker Not Registering

- Ensure the site is served over HTTPS (or localhost)
- Check the console for SW registration errors
- Use `checkServiceWorker` to see detailed status

### Offline Test Fails Unexpectedly

- Ensure service worker is fully activated first
- Verify your SW actually caches the resources you're checking
- Use `getCacheInfo` to see what's actually cached

## File Locations

```
flowstral-desktop/src/main/lib/pwa-testing/
├── index.js              # Main module exports
├── manifest-validator.js # Manifest validation
├── service-worker-utils.js # SW detection/status
├── offline-tester.js     # Offline mode testing
└── cache-verifier.js     # Cache storage verification

flowstral-desktop/src/main/ipc/
└── pwa-handlers.js       # IPC handlers

flowstral-desktop/src/main/lib/
└── action-handlers.js    # PWA action handlers (integrated)
```

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | Jan 2026 | Initial PWA testing support |
