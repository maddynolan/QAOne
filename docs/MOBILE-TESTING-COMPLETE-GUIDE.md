# Mobile Testing Complete Guide

> **Purpose:** Comprehensive mobile testing capabilities in QAAI

---

## 1. Mobile Testing Types

| Type | Tool | Location in QAAI |
|------|------|------------------|
| **Mobile Web** | Playwright Device Emulation | Record tab → Device dropdown |
| **Native iOS/Android** | Maestro | Mobile tab |
| **PWA Load Testing** | k6/Custom | Performance tab → PWA Load preset |
| **Real Device Cloud** | BrowserStack/Sauce Labs | Coming Soon |

---

## 2. Mobile Web Testing (Already Supported)

### How to Test Mobile Web

1. Go to **Record** tab
2. Click **Device** dropdown (top-right of browser)
3. Select from 50+ mobile profiles:
   - iPhone 14/15 Pro Max
   - Samsung Galaxy S23
   - iPad Pro
   - Pixel 7
   - etc.

### What This Does

```javascript
// Playwright sets viewport, user agent, touch events
await page.setViewportSize({ width: 390, height: 844 });
await page.emulate(devices['iPhone 14 Pro']);
```

### Mobile-Specific Features

- Touch simulation (tap, swipe, pinch)
- Geolocation mocking
- Network throttling (3G, 4G)
- Offline mode testing
- Responsive breakpoint testing

---

## 3. PWA Load Testing

### Where: Performance Tab → PWA Load Preset

The "PWA Load" preset tests:
- Initial document load
- Service worker registration
- App shell caching
- Manifest fetch
- Offline capability

### API Endpoint

```bash
# Test PWA performance
POST /api/performance/pwa/performance
{
  "url": "https://your-pwa.example.com",
  "duration": "30s",
  "vus": 50
}
```

### Custom PWA Load Script

```javascript
// In Performance tab → Custom Script
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  vus: 100,
  duration: '60s',
  thresholds: {
    http_req_duration: ['p(95)<1500'], // 1.5s for mobile
  }
};

export default function() {
  // Test PWA start URL
  const startUrl = http.get('https://your-pwa.com/');
  check(startUrl, {
    'PWA loads': (r) => r.status === 200,
    'Has service worker': (r) => r.body.includes('serviceWorker'),
  });
  
  // Test manifest
  const manifest = http.get('https://your-pwa.com/manifest.json');
  check(manifest, {
    'Manifest exists': (r) => r.status === 200,
    'Has icons': (r) => JSON.parse(r.body).icons?.length > 0,
  });
  
  // Test service worker
  const sw = http.get('https://your-pwa.com/service-worker.js');
  check(sw, {
    'SW exists': (r) => r.status === 200,
  });
  
  sleep(1);
}
```

### Lighthouse PWA Audit

```bash
# In Performance tab → Lighthouse
POST /api/performance/lighthouse/run
{
  "url": "https://your-pwa.com",
  "categories": ["performance", "pwa"],
  "device": "mobile"
}
```

---

## 4. Native App Testing with Maestro

### Prerequisites

```bash
# Install Maestro (Mac/Linux)
curl -Ls "https://get.maestro.mobile.dev" | bash

# Windows (via WSL)
wsl curl -Ls "https://get.maestro.mobile.dev" | bash
```

### iOS Simulator Setup

```bash
# List simulators
xcrun simctl list devices

# Boot simulator
xcrun simctl boot "iPhone 15 Pro"

# Install app
xcrun simctl install booted /path/to/app.app
```

### Android Emulator Setup

```bash
# List emulators
emulator -list-avds

# Start emulator
emulator -avd Pixel_7_API_34

# Install APK
adb install /path/to/app.apk
```

### Maestro Flow Example

```yaml
appId: com.myapp.bundle
---
# Launch and wait
- launchApp
- waitForAnimationToEnd

# Login flow
- tapOn: "Sign In"
- inputText:
    id: "email-input"
    text: "test@example.com"
- inputText:
    id: "password-input"
    text: "Password123!"
- tapOn: "Submit"

# Verify login
- assertVisible: "Welcome"
- assertVisible: "Dashboard"

# Navigate
- tapOn: "Profile"
- assertVisible: "Account Settings"

# Swipe
- swipe:
    direction: UP
    duration: 500

# Screenshot
- takeScreenshot: "final_state"
```

### Recording with Maestro Studio

1. Start simulator/emulator
2. Click "Start Recording" in Mobile tab
3. Interact with your app
4. Actions are recorded as YAML
5. Export and run

---

## 5. What's NOT Supported Yet

| Feature | Status | Alternative |
|---------|--------|-------------|
| Real iOS Devices | ❌ | Use BrowserStack/Sauce Labs |
| Real Android Devices | ❌ | Use BrowserStack/Sauce Labs |
| Push Notifications | ❌ | Manual testing |
| Biometrics (Face ID, etc.) | ❌ | Maestro supports mocking |
| Deep Linking | ⚠️ Partial | Maestro `openLink` command |
| App Store Screenshots | ❌ | Maestro `takeScreenshot` |

---

## 6. Mobile Performance Metrics

### Core Web Vitals (Mobile)

| Metric | Good | Needs Work | Poor |
|--------|------|------------|------|
| LCP (Largest Contentful Paint) | ≤2.5s | ≤4.0s | >4.0s |
| FID (First Input Delay) | ≤100ms | ≤300ms | >300ms |
| CLS (Cumulative Layout Shift) | ≤0.1 | ≤0.25 | >0.25 |
| INP (Interaction to Next Paint) | ≤200ms | ≤500ms | >500ms |

### How to Test

```bash
# Lighthouse mobile audit
POST /api/performance/lighthouse/run
{
  "url": "https://your-site.com",
  "device": "mobile",
  "throttling": {
    "cpuSlowdownMultiplier": 4,
    "downloadThroughputKbps": 1600,
    "uploadThroughputKbps": 750,
    "rttMs": 150
  }
}
```

---

## 7. Mobile Testing Best Practices

### 1. Test on Multiple Viewports

```javascript
const mobileViewports = [
  { width: 375, height: 667 },  // iPhone SE
  { width: 390, height: 844 },  // iPhone 14
  { width: 412, height: 915 },  // Pixel 7
  { width: 768, height: 1024 }, // iPad
];
```

### 2. Network Conditions

```javascript
// Simulate slow 3G
await page.route('**/*', route => {
  setTimeout(() => route.continue(), 1500);
});
```

### 3. Touch Events

```javascript
// Tap
await page.tap('#button');

// Swipe
await page.touchscreen.swipe(200, 500, 200, 100);

// Pinch (zoom)
await page.touchscreen.pinch(200, 200, 0.5);
```

### 4. Offline Testing

```javascript
await context.setOffline(true);
// Test offline behavior
await context.setOffline(false);
```

---

## 8. Roadmap: Coming Features

### Q1 2026
- [ ] BrowserStack real device integration
- [ ] Appium support for native apps
- [ ] Deep link testing

### Q2 2026
- [ ] Push notification testing
- [ ] Biometric mocking
- [ ] Mobile app performance profiling

### Q3 2026
- [ ] Visual regression on mobile
- [ ] Accessibility on mobile (VoiceOver, TalkBack)
- [ ] Mobile CI/CD templates

---

*Document maintained by QAAI team. Last updated: January 31, 2026*
