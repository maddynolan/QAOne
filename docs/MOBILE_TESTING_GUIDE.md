# QAAI Mobile Testing Pack

## Overview

The QAAI Mobile Testing Pack provides comprehensive mobile testing capabilities without requiring a device cloud. It supports:

1. **Mobile Web Emulation** (Phase 1) - Test responsive web apps using 50+ real device profiles
2. **Native App Testing** (Phase 2) - Test iOS/Android native apps via Maestro integration

## Key Features

### Mobile Web Emulation

- 50+ real device profiles (iPhone, iPad, Pixel, Galaxy, OnePlus, Xiaomi)
- Accurate viewport, user agent, touch events, and device scale
- Network throttling (5G, 4G, 3G, 2G, Slow 3G, Offline)
- Record once, run on any device
- Zero configuration - works out of the box

### Native App Testing (Maestro)

- Test iOS and Android native apps
- Run on simulators/emulators (no real devices needed)
- YAML-based test flows
- Automatic conversion from QAAI steps
- Support for common gestures (tap, swipe, scroll)

## Quick Start

### Mobile Web Testing

1. **Select a Device** - Use the device selector dropdown in the recorder UI
2. **Start Recording** - Record your test as normal
3. **Run Test** - Tests automatically use the selected device emulation

```javascript
// Programmatic usage
const { playwrightRecorder } = require('./playwright-recorder');

// Set mobile device before recording/testing
playwrightRecorder.setMobileDevice('iPhone 15 Pro');
playwrightRecorder.setMobileNetwork('4G');

// Start recording in mobile mode
await playwrightRecorder.start('https://your-app.com');

// Run test in mobile mode
await playwrightRecorder.runTest({ steps, url });

// Clear mobile settings (return to desktop)
playwrightRecorder.clearMobileDevice();
```

### Native App Testing

1. **Install Maestro** (one-time setup):
   ```bash
   curl -Ls "https://get.maestro.mobile.dev" | bash
   ```

2. **Start Android Emulator** or **iOS Simulator**

3. **Run Native App Test**:
   ```javascript
   const { MaestroRunner } = require('./lib/maestro-integration');
   
   const runner = new MaestroRunner({
     appId: 'com.example.myapp',
     platform: 'android' // or 'ios'
   });
   
   await runner.runTest(qaaiSteps);
   ```

## Available Devices

### iOS Devices

| Device | Viewport | Scale |
|--------|----------|-------|
| iPhone 15 Pro Max | 430×932 | 3x |
| iPhone 15 Pro | 393×852 | 3x |
| iPhone 15 | 393×852 | 3x |
| iPhone 14 Pro Max | 430×932 | 3x |
| iPhone 14 Pro | 393×852 | 3x |
| iPhone 14 | 390×844 | 3x |
| iPhone 13 Pro Max | 428×926 | 3x |
| iPhone 13 | 390×844 | 3x |
| iPhone SE (3rd Gen) | 375×667 | 2x |
| iPad Pro 12.9 | 1024×1366 | 2x |
| iPad Pro 11 | 834×1194 | 2x |
| iPad Air | 820×1180 | 2x |
| iPad Mini | 768×1024 | 2x |

### Android Devices

| Device | Viewport | Scale |
|--------|----------|-------|
| Pixel 8 Pro | 412×915 | 2.625x |
| Pixel 8 | 412×915 | 2.625x |
| Pixel 7 Pro | 412×915 | 2.625x |
| Galaxy S24 Ultra | 412×915 | 3.5x |
| Galaxy S24+ | 412×915 | 3x |
| Galaxy S24 | 360×780 | 3x |
| Galaxy S23 Ultra | 412×915 | 3.5x |
| Galaxy A54 | 360×800 | 2.625x |
| Galaxy Tab S9 | 800×1280 | 2x |
| OnePlus 12 | 412×915 | 3.5x |
| Xiaomi 14 Pro | 412×915 | 3x |
| Redmi Note 13 Pro | 393×873 | 2.75x |

## Network Throttling Presets

| Preset | Download | Upload | Latency |
|--------|----------|--------|---------|
| 5G | 100 Mbps | 50 Mbps | 10ms |
| 4G LTE | 50 Mbps | 10 Mbps | 20ms |
| 4G | 20 Mbps | 5 Mbps | 50ms |
| 3G | 1.5 Mbps | 750 Kbps | 100ms |
| 2G | 250 Kbps | 50 Kbps | 300ms |
| Slow 3G | 500 Kbps | 100 Kbps | 400ms |
| Offline | 0 | 0 | N/A |

## API Reference

### PlaywrightRecorder Mobile Methods

```javascript
// Set mobile device
setMobileDevice(deviceName: string, options?: object): DeviceConfig

// Set network throttling
setMobileNetwork(presetName: string): NetworkConfig

// Clear mobile settings
clearMobileDevice(): void

// Check if in mobile mode
isInMobileMode(): boolean

// Get current mobile config
getMobileConfig(): MobileConfig

// Get available devices (static)
PlaywrightRecorder.getAvailableDevices(): DevicesData
```

### MobileTestRunner Class

```javascript
const { MobileTestRunner, TEST_TARGETS } = require('./lib/mobile-test-runner');

const runner = new MobileTestRunner(playwrightRecorder, {
  debug: true
});

// Run test on specific target
await runner.runTest(steps, {
  targets: [TEST_TARGETS.MOBILE_WEB],
  device: 'iPhone 15 Pro',
  network: '4G'
});

// Run on multiple targets
await runner.runTest(steps, {
  targets: [
    TEST_TARGETS.DESKTOP,
    TEST_TARGETS.MOBILE_WEB,
    TEST_TARGETS.NATIVE_ANDROID
  ],
  parallel: true
});
```

### MaestroRunner Class

```javascript
const { MaestroRunner, validateMaestroSetup } = require('./lib/maestro-integration');

// Check Maestro installation
const status = validateMaestroSetup();
console.log(status.installed, status.version);

// Create runner
const runner = new MaestroRunner({
  appId: 'com.example.app',
  platform: 'android',
  deviceId: 'emulator-5554' // optional
});

// Run test
const result = await runner.runTest(qaaiSteps, { appId });

// List available devices
const devices = await runner.listDevices();
```

## UI Components

### MobileDeviceSelector

React component for device selection:

```tsx
import { MobileDeviceSelector } from '@/components/MobileDeviceSelector';

<MobileDeviceSelector
  onDeviceChange={(device, network) => console.log(device, network)}
  showNetworkOptions={true}
  showMaestroStatus={true}
  compact={false}
/>
```

Props:
- `onDeviceChange`: Callback when device/network changes
- `showNetworkOptions`: Show network throttling options (default: true)
- `showMaestroStatus`: Show Maestro installation status (default: false)
- `compact`: Use compact button mode (default: false)

## IPC Channels

### From Renderer to Main

```javascript
// Get available devices
window.flowstral.mobile.getDevices()

// Set device
window.flowstral.mobile.setDevice('iPhone 15 Pro', '4G')

// Get current config
window.flowstral.mobile.getConfig()

// Clear device
window.flowstral.mobile.clearDevice()

// Check Maestro
window.flowstral.mobile.checkMaestro()

// Run native test
window.flowstral.mobile.runNativeTest({ steps, appId, platform })

// Get native devices
window.flowstral.mobile.getNativeDevices('android')
```

### Events from Main to Renderer

- `mobile-native-test-step` - Native test step completed
- `mobile-native-test-progress` - Test progress update
- `mobile-native-test-error` - Test error occurred

## Backward Compatibility

The mobile testing features are fully backward compatible:

1. **Default is Desktop** - If no device is set, tests run in desktop mode exactly as before
2. **Same API** - All existing recording and playback APIs work unchanged
3. **Graceful Degradation** - If mobile API is not available (e.g., web browser), components show appropriate messages

## Maestro Action Mapping

QAAI actions are automatically converted to Maestro commands:

| QAAI Action | Maestro Command |
|-------------|-----------------|
| ClickText | tapOn: "text" |
| ClickElement | tapOn: { id: "testId" } |
| Fill | tapOn + inputText |
| Select | tapOn + waitForAnimationToEnd + tapOn |
| AssertText | assertVisible: "text" |
| Wait | wait: { milliseconds: N } |
| Scroll | scroll: DIRECTION |
| Press (Enter) | pressKey: Enter |
| Press (Back) | pressKey: Back |

## Troubleshooting

### Mobile Web Issues

**Q: Viewport looks wrong**
A: Clear browser cache or use fresh browser mode

**Q: Touch events not working**
A: Ensure device has `hasTouch: true` in config

**Q: Network throttling not applied**
A: CDP session may have disconnected; restart recording

### Maestro Issues

**Q: Maestro not found**
A: Run installation command: `curl -Ls "https://get.maestro.mobile.dev" | bash`

**Q: No emulator found**
A: Start Android emulator: `emulator -avd YourAVDName`

**Q: iOS simulator not working**
A: Requires macOS with Xcode installed

## Version History

- **v1.0.0** (2026-01-17)
  - Initial release
  - 50+ device profiles
  - Network throttling
  - Maestro integration
  - React UI component
