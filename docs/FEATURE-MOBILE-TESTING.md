# Feature: Mobile Testing
> Native app testing via Maestro (iOS/Android), device emulation with 50+ profiles, network throttling, and responsive viewport testing -- running through the Electron desktop app with server persistence for flows, folders, and test runs.

---

## Table of Contents

1. [Overview](#1-overview)
2. [Architecture](#2-architecture)
3. [Frontend Code Audit](#3-frontend-code-audit)
4. [Backend Code Audit](#4-backend-code-audit)
5. [UI Walkthrough](#5-ui-walkthrough)
6. [Electron IPC API](#6-electron-ipc-api)
7. [Configuration](#7-configuration)
8. [8-Tab Hub](#8-8-tab-hub)
9. [Robustness Improvements (v3.19.0)](#9-robustness-improvements-v3190)
10. [Known Gaps & TODOs](#10-known-gaps--todos)

---

## 1. Overview

Mobile Testing in Flowstral covers two modes:

| Mode | Implementation | Status |
|------|---------------|--------|
| **Mobile Web Testing** | Device emulation in Playwright (viewport, user-agent, touch) via Electron IPC | **Fully implemented** |
| **Native App Testing** | Maestro CLI for iOS Simulator / Android Emulator via Electron IPC | **Frontend implemented, depends on Maestro installation** |

**Important:** Mobile device operations run through the Electron desktop app's IPC bridge. Server persistence for flows, folders, and test runs is available via `/api/mobile/*` backend endpoints (v3.13.2+). The web app provides management UI with localStorage as offline fallback.

---

## 2. Architecture

```
MobileTestingPage.tsx (194 lines, 8-tab hub)
    |
    +-- MobileTestStudio.tsx (573 lines)
    |       |-- YAML editor with validation
    |       |-- Maestro Studio start/stop
    |       |-- Real-time console output
    |       +-- Run test with IPC
    |
    +-- MobileTestFlows.tsx (710 lines)
    |       |-- CRUD with folders, tags, priority
    |       |-- Import/export YAML
    |       |-- Run via mobile.runNativeTest()
    |       +-- Delete confirmation dialogs
    |
    +-- MobileDeviceLab.tsx (590+ lines)
    |       |-- Device list with platform filtering
    |       |-- App install/uninstall via IPC
    |       |-- Live log streaming (logcat/syslog) with filter
    |       |-- Screenshots with view/save/download
    |       +-- Quick actions (clear data, force stop, uninstall)
    |
    +-- MobileTestRuns.tsx (390+ lines)
    |       |-- Execution history with stats
    |       |-- Filter by status/platform/search
    |       |-- Re-run with correct IPC signature
    |       +-- Detailed run reports
    |
    +-- MobileInspector.tsx (550+ lines)
    |       |-- Android XML hierarchy parser
    |       |-- iOS text hierarchy parser
    |       |-- Deep recursive search
    |       +-- Maestro selector generation
    |
    +-- MobileAdvancedTools.tsx (770+ lines)
    |       |-- Deep links with try/catch
    |       |-- Push notifications
    |       |-- Biometrics with error handling
    |       |-- Geolocation with lat/lng validation
    |       |-- Network conditioning
    |       +-- Device config (orientation, appearance, locale, font scale)
    |
    +-- MobileAppProfiler.tsx
    |       +-- CPU/memory/battery/FPS monitoring, crash logs
    |
    +-- MobileDeviceMatrix.tsx
            +-- Parallel testing across device/OS combinations
```

### State Management

**Zustand Store:** `src/modules/mobile-testing/store/mobileTestingStore.ts`
- Middleware: `devtools` + `subscribeWithSelector` + `persist` (localStorage) + `immer`
- Individual selectors pattern (never destructure whole store)
- Pure computed functions (`computeFilteredFlows`, `computeTestRunStats`) used with `useMemo`
- Studio output capped at 5000 lines (trims to 3000 on overflow)
- Test runs capped at 500 entries with `keepTestHistory` day-based cleanup
- Server sync via `/api/mobile/*` endpoints (v3.13.2+)

---

## 3. Frontend Code Audit

### Pages

| File | Lines | Purpose |
|------|-------|---------|
| `src/modules/mobile-testing/pages/MobileTestingPage.tsx` | 194 | 8-tab hub with badge indicators (REC, Running, flow count, pass/fail stats) |

### Components

| File | Lines | Purpose |
|------|-------|---------|
| `MobileTestStudio.tsx` | 573+ | Maestro Studio recording, YAML editor with validation, run tests, real-time console |
| `MobileTestFlows.tsx` | 710 | Flow CRUD, folders, import/export YAML, templates, run via IPC, delete confirmation |
| `MobileDeviceLab.tsx` | 590+ | Device management, app install/uninstall, log streaming with filter, screenshots with view/save |
| `MobileTestRuns.tsx` | 390+ | Execution history, stats dashboard, filtering, re-run with correct IPC signature |
| `MobileInspector.tsx` | 550+ | Android XML + iOS text hierarchy parsers, deep recursive search, selector generation |
| `MobileAdvancedTools.tsx` | 770+ | Deep links, push, biometrics, geo, network, device config -- all with error handling |
| `MobileAppProfiler.tsx` | -- | CPU/memory/battery/FPS monitoring, crash logs, media injection |
| `MobileDeviceMatrix.tsx` | -- | Parallel testing across device/OS combinations |
| `MobileDeviceSelector.tsx` | 532 | Device emulation selection (50+ profiles, network throttling) |

### Store

| File | Lines | Purpose |
|------|-------|---------|
| `mobileTestingStore.ts` | 684+ | Zustand store with persist + immer + subscribeWithSelector; manages all mobile state |

### Barrel Export

| File | Purpose |
|------|---------|
| `src/modules/mobile-testing/components/index.ts` | Exports all 8 sub-module components |

---

## 4. Backend Code Audit

### Mobile Flow API (v3.13.2+)

| File | Prefix | Endpoints | Purpose |
|------|--------|-----------|---------|
| `backend/app/routers/test_management/mobile_flows_api.py` | `/api/mobile` | 8 | Server persistence for flows, folders, test runs |

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/mobile/flows` | GET | List all flows for a project |
| `/api/mobile/flows` | POST | Create/update a flow |
| `/api/mobile/flows/{id}` | DELETE | Delete a flow |
| `/api/mobile/sync` | POST | Bulk sync flows/folders/runs from localStorage to PostgreSQL |
| `/api/mobile/folders` | GET | List folders |
| `/api/mobile/folders` | POST | Create/update a folder |
| `/api/mobile/runs` | GET | List test runs |
| `/api/mobile/runs` | POST | Record a test run |

---

## 5. UI Walkthrough

### Setting Up Maestro (Native Testing)

1. Navigate to **Mobile Testing** from the sidebar.
2. If Maestro is not installed, a setup guide appears.
3. Click **Copy Install Command** -- copies the Maestro installation curl command.
4. Run in terminal: `curl -Ls "https://get.maestro.mobile.dev" | bash`
5. For Android: ensure `ANDROID_HOME` is set and an emulator is running.
6. For iOS: ensure Xcode is installed and a simulator is booted.
7. Click **Refresh** to detect Maestro installation.

### Running a Native App Test

1. Select platform (iOS or Android) from the tabs.
2. Select a device from the detected emulators.
3. Write or edit a Maestro YAML flow in the editor:

```yaml
appId: com.example.app
---
- launchApp
- tapOn: "Login"
- inputText:
    id: "email"
    text: "test@example.com"
- tapOn: "Submit"
- assertVisible: "Welcome"
```

4. Click **Run Test** -- YAML is validated before execution (checks for empty flow, missing steps, formatting issues).
5. View results: pass/fail, duration, step details.
6. Stop running tests with the stop button (sends IPC cancellation).

### Recording with Maestro Studio

1. Click **Start Studio** -- launches Maestro Studio in the background.
2. Interact with the emulator -- Studio records your actions.
3. Click **Stop Studio** -- recorded YAML is captured.
4. Edit the YAML flow as needed, then run it.

---

## 6. Electron IPC API

All mobile functionality goes through `window.flowstral.mobile.*`:

| Method | IPC Channel | Description |
|--------|------------|-------------|
| `checkMaestro()` | `mobile-check-maestro` | Check Maestro CLI installation |
| `getNativeDevices(platform)` | `mobile-get-native-devices` | List available iOS/Android emulators |
| `runNativeTest(steps, appId, platform, deviceId)` | `mobile-run-native-test` | Execute test with positional args |
| `startStudio()` | `mobile-start-studio` | Launch Maestro Studio |
| `stopStudio()` | `mobile-stop-studio` | Stop Maestro Studio |
| `getStudioStatus()` | `mobile-studio-status` | Check if Studio is running |
| `takeScreenshot(platform, deviceId)` | `mobile-screenshot` | Capture device screenshot, return base64 |
| `startLogs(platform, deviceId)` | `mobile-start-logs` | Start log streaming (logcat/syslog) |
| `stopLogs()` | `mobile-stop-logs` | Stop log streaming |
| `installApp(path, platform, deviceId)` | `mobile-install-app` | Install APK/IPA on device |
| `uninstallApp(bundleId, platform, deviceId)` | `mobile-uninstall-app` | Uninstall app from device |
| `browseForApp()` | `mobile-browse-app` | Open file dialog for APK/IPA |
| `getHierarchy(platform, deviceId)` | `mobile-get-hierarchy` | Get element tree (XML or text) |
| `openDeepLink(platform, deviceId, url)` | `mobile-open-deep-link` | Open deep link / URL scheme |
| `sendPush(platform, deviceId, payload, bundleId)` | `mobile-send-push` | Send push notification |
| `simulateBiometric(platform, deviceId, result)` | `mobile-simulate-biometric` | Simulate biometric auth |
| `setGeoLocation(platform, deviceId, lat, lng)` | `mobile-set-geolocation` | Set GPS coordinates |
| `setNetworkCondition(platform, deviceId, profile)` | `mobile-set-network` | Set network conditions |
| `setOrientation(platform, deviceId, orientation)` | `mobile-set-orientation` | Set portrait/landscape |
| `setAppearance(platform, deviceId, mode)` | `mobile-set-appearance` | Set dark/light mode |
| `setLocale(platform, deviceId, locale)` | `mobile-set-locale` | Set device locale |
| `setFontScale(platform, deviceId, scale)` | `mobile-set-font-scale` | Set accessibility font scale |

**Event Channels:** `mobile-log-line` (log streaming), `mobile-studio-output` (studio output).

**Browser fallback:** When running in the web app (not Electron), all mobile methods return `{ success: false, error: 'Not available in browser' }`.

---

## 7. Configuration

### Prerequisites

| Requirement | Purpose | Status |
|-------------|---------|--------|
| **Electron desktop app** | Required for all device IPC | Required |
| **Maestro CLI** | Native app testing | Optional (install via curl) |
| **Android SDK / ANDROID_HOME** | Android emulator access | Optional |
| **Xcode + iOS Simulator** | iOS simulator access | Optional (macOS only) |

### Network Throttling Profiles

| Profile | Download | Upload | Latency |
|---------|----------|--------|---------|
| None | Unlimited | Unlimited | 0ms |
| 5G | ~100 Mbps | ~50 Mbps | 10ms |
| 4G | ~20 Mbps | ~10 Mbps | 50ms |
| 3G | ~1.5 Mbps | ~750 Kbps | 100ms |
| Slow 3G | ~500 Kbps | ~250 Kbps | 300ms |
| Offline | 0 | 0 | -- |

---

## 8. 8-Tab Hub

MobileTestingPage is a hub with 8 tabs (expanded from 6 in v3.13.2):

| Tab | Component | Purpose |
|-----|-----------|---------|
| Test Studio | `MobileTestStudio.tsx` | Maestro Studio recording, YAML editor with validation, real-time console |
| Test Flows | `MobileTestFlows.tsx` | Saved flow CRUD, folders, import/export YAML, templates, delete confirmation |
| Device Lab | `MobileDeviceLab.tsx` | Screenshots with view/save, log streaming with filter, app install/uninstall, quick actions |
| Test Runs | `MobileTestRuns.tsx` | Execution history, stats, filtering, re-run with correct IPC |
| Inspector | `MobileInspector.tsx` | Element hierarchy via Android XML + iOS text parsers, deep recursive search |
| Advanced Tools | `MobileAdvancedTools.tsx` | Deep links, push, biometrics, geo with validation, network, device config |
| App Profiler | `MobileAppProfiler.tsx` | CPU/memory/battery/FPS monitoring, crash logs, media injection |
| Device Matrix | `MobileDeviceMatrix.tsx` | Parallel testing across device/OS combinations |

### 20+ IPC Handlers

All mobile operations flow through: MaestroRunner -> IPC handler -> preload -> electron-bridge -> React component.

**MaestroRunner** (`flowstral-desktop/src/main/lib/maestro-integration.js`): 14 device methods including takeScreenshot, startLogCapture, installApp, uninstallApp, getElementHierarchy, openDeepLink, sendPushNotification, simulateBiometric, setGeoLocation, setNetworkCondition, setOrientation, setAppearance, setLocale, setFontScale.

### Zustand Store

`src/modules/mobile-testing/store/mobileTestingStore.ts` with `devtools` + `subscribeWithSelector` + `persist` + `immer` middleware.

Key state: activeTab, isStudioRunning, maestroInstalled, nativeDevices, selectedPlatform, selectedDevice, appBundleId, flows, folders, testRuns, studioOutput, deepLinks, savedLocations, networkProfiles, activeNetworkProfile, currentLocation, pushNotificationPayload.

### Advanced Tools (ALL Fully Implemented)

Deep links, push notifications, biometrics, geolocation, network conditioning, orientation, appearance (dark/light), locale, font scale -- all wired to real device commands via adb (Android) and xcrun simctl (iOS).

---

## 9. Robustness Improvements (v3.19.0)

Comprehensive bug fixes and robustness improvements across all 7 component files and the Zustand store:

### MobileTestRuns.tsx
- **Fixed `group` class** for hover-revealed action buttons (re-run, delete) -- buttons were invisible
- **Fixed `runNativeTest` call signature** -- was passing an object `{ yaml, platform, appBundleId, flowName }` instead of positional args `(steps, appId, platform, deviceId)` matching the electron-bridge API
- **Fixed output type** -- `output: result?.output || ''` changed to `output: result?.output || []` to match `MobileTestRun.output: string[]` type
- **Added `selectedDevice` selector** from store for re-run device resolution

### MobileAdvancedTools.tsx
- **Added try/catch** to `handleOpenDeepLink` -- was missing error handling for IPC failures
- **Added try/catch** to `handleBiometricTest` -- was missing error handling
- **Added lat/lng validation** to `handleAddLocation` -- validates NaN, latitude range (-90 to 90), longitude range (-180 to 180)

### MobileInspector.tsx
- **Fixed shallow search** -- `renderTree` search filter only checked immediate children; now uses recursive `subtreeMatchesQuery()` for deep tree search
- **Added iOS text hierarchy parser** -- `parseIosTextHierarchy()` parses `xcrun simctl` text output into `ElementNode` tree instead of falling back to sample data
- **Extracted `nodeMatchesQuery` helper** for cleaner search logic

### MobileDeviceLab.tsx
- **Wired up Quick Action buttons** -- Clear App Data, Force Stop, Restart, Uninstall now have onClick handlers with IPC calls
- **Connected log filter input** -- log filter state + filtered display using `logFilter` state variable
- **Added screenshot View handler** -- opens modal viewer overlay for full-size screenshot
- **Added screenshot Save handler** -- downloads base64 screenshots as PNG files
- **Replaced hardcoded device info** -- Architecture, Network, Battery now show platform-aware values instead of hardcoded strings

### MobileTestStudio.tsx
- **Added YAML validation before run** -- validates non-empty flow, checks for step lines starting with "-", detects formatting issues with line-level error messages
- **Fixed stop button** -- now sends IPC cancellation via `mobile.stopStudio()` instead of only setting `setIsRunningTest(false)`, plus adds "Test cancelled by user" to output

### MobileTestFlows.tsx
- **Added delete confirmation dialog** -- `window.confirm()` before deleting flows to prevent accidental data loss
- **Removed unused `showMenu` state** from FlowItem component

### Store (mobileTestingStore.ts)
- **Capped `studioOutput` array** -- limits to 5000 lines, trims to 3000 on overflow to prevent memory bloat
- **Enforced `keepTestHistory` cleanup** -- `addTestRun` now enforces both a 500-entry hard cap and purges runs older than `keepTestHistory` days (default 30)

---

## 10. Known Gaps & TODOs

### What's Real vs. Aspirational

| Feature | Status | Details |
|---------|--------|---------|
| **Mobile web emulation** (viewport, UA, touch) | **Real** | Works via Playwright device emulation |
| **Device selector with 50+ profiles** | **Real** | Loaded from Electron, applied via IPC |
| **Network throttling** | **Real** | Applied via Playwright network conditions |
| **Maestro native testing** | **Real (if Maestro installed)** | Delegates to Maestro CLI via IPC |
| **Maestro Studio recording** | **Real (if Maestro installed)** | Launches studio, captures YAML |
| **Push notification testing** | **Fully implemented (v3.11.6)** | Wired to adb broadcast / xcrun simctl push |
| **Biometric mocking** | **Fully implemented (v3.11.6)** | Wired to adb broadcast / xcrun simctl notifyutil |
| **Deep link testing** | **Fully implemented (v3.11.6)** | Wired to adb am start / xcrun simctl openurl |
| **Server persistence** | **Implemented (v3.13.2)** | Flows, folders, runs sync to PostgreSQL via `/api/mobile/*` |
| **Element Inspector (Android)** | **Fully implemented** | uiautomator dump XML parser |
| **Element Inspector (iOS)** | **Implemented (v3.19.0)** | Text-based hierarchy parser |
| **Real device testing** | **Not implemented** | Listed as "Coming Soon" |
| **Appium integration** | **Not implemented** | Listed as "Coming Soon" |
| **Mobile accessibility** | **Not implemented** | Listed as "Coming Soon" |
| **App Profiler** | **UI implemented** | CPU/memory/battery/FPS monitoring UI |
| **Device Matrix** | **UI implemented** | Parallel testing UI |

### Architecture Concerns

| Issue | Details |
|-------|---------|
| **Electron-dependent** | Device operations require Electron desktop app. Web app users have management UI only. |
| **YAML parsing is simplified** | Splits on lines starting with `-` rather than using a proper YAML parser library. |
| **Platform limitation** | iOS simulator testing only works on macOS (Xcode requirement). |
| **Maestro dependency** | Third-party CLI that must be separately installed and maintained. |

---

*Last updated: 2026-03-08*
*Generated by code audit and robustness improvement pass of the Flowstral mobile testing module.*
