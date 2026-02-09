# Feature: Mobile Testing
> Native app testing via Maestro (iOS/Android), device emulation with 50+ profiles, network throttling, and responsive viewport testing — running entirely through the Electron desktop app with no backend API.

---

## Table of Contents

1. [Overview](#1-overview)
2. [Architecture](#2-architecture)
3. [Frontend Code Audit](#3-frontend-code-audit)
4. [Backend Code Audit](#4-backend-code-audit)
5. [UI Walkthrough](#5-ui-walkthrough)
6. [Electron IPC API](#6-electron-ipc-api)
7. [Configuration](#7-configuration)
8. [Known Gaps & TODOs](#8-known-gaps--todos)

---

## 1. Overview

Mobile Testing in Flowstral covers two modes:

| Mode | Implementation | Status |
|------|---------------|--------|
| **Mobile Web Testing** | Device emulation in Playwright (viewport, user-agent, touch) via Electron IPC | **Fully implemented** |
| **Native App Testing** | Maestro CLI for iOS Simulator / Android Emulator via Electron IPC | **Frontend implemented, depends on Maestro installation** |

**Important:** Mobile testing has **zero backend API**. All functionality runs through the Electron desktop app's IPC bridge. The backend has no dedicated mobile router or service.

---

## 2. Architecture

```
MobileTestingPage.tsx (952 lines)
    │
    ├── Native App Testing
    │       │
    │       ▼
    │   Electron IPC: window.flowstral.mobile.*
    │       ├── checkMaestro() → checks installation
    │       ├── getNativeDevices() → list iOS/Android emulators
    │       ├── runNativeTest(yaml) → execute Maestro YAML flow
    │       ├── startStudio() → launch Maestro Studio for recording
    │       └── stopStudio() → stop Maestro Studio
    │
    ├── Mobile Web Testing
    │       │
    │       ▼
    │   MobileDeviceSelector.tsx (532 lines)
    │       ├── getDevices() → 50+ device profiles
    │       ├── setDevice(name, network) → apply emulation
    │       └── clearDevice() → reset to desktop
    │           │
    │           ▼
    │       Playwright browser with viewport/UA override
    │
    └── Navigation Links
            ├── → Record tab (mobile web recording)
            └── → Performance tab (PWA load testing)
```

**No backend communication whatsoever.** All mobile functionality is Electron-only.

---

## 3. Frontend Code Audit

### Pages

| File | Lines | Status | Role |
|------|-------|--------|------|
| `src/pages/MobileTestingPage.tsx` | 952 | **Fully implemented (frontend)** | Native app testing: Maestro check, device listing, YAML flow editor, test execution, Maestro Studio recording. Navigation cards to mobile web and PWA testing. |

**Key State Variables:**
- `maestroInstalled`, `devices` (iOS/Android emulators), `selectedDevice`, `selectedPlatform`
- `testCode` (YAML flow), `isRunning`, `testResult`, `studioRunning`
- `showInstallGuide`, `showSetupGuide`

**Key Functions:**
- `checkMaestro()` — Checks Maestro installation via `mobile.checkMaestro()`
- `loadNativeDevices()` — Lists available emulators via `mobile.getNativeDevices()`
- `handleRunTest()` — Parses YAML, runs via `mobile.runNativeTest()`
- `handleStartStudio()` / `handleStopStudio()` — Maestro Studio lifecycle
- `checkStudioStatus()` — Polls studio running state
- `copyInstallCommand()` — Copies `curl -Ls "https://get.maestro.mobile.dev" | bash` to clipboard

### Components

| File | Lines | Status | Role |
|------|-------|--------|------|
| `src/components/MobileDeviceSelector.tsx` | 532 | **Fully implemented** | Reusable device selector: categorized device dropdown, network throttling (None/5G/4G/3G/Slow 3G/Offline), Maestro status indicator. Compact and full display modes. |

### Libraries

| File | Lines | Status | Role |
|------|-------|--------|------|
| `src/lib/electron-bridge.ts` (mobile namespace) | ~50 | **Fully implemented** | 12 IPC methods for mobile: `getDevices`, `setDevice`, `getConfig`, `clearDevice`, `checkMaestro`, `getNativeDevices`, `runNativeTest`, `startRecording`, `stopRecording`, `startStudio`, `stopStudio`, `getStudioStatus`. Browser fallback returns empty/false. |

---

## 4. Backend Code Audit

**There are NO dedicated mobile routers or services in the backend.**

The word "mobile" appears only incidentally in:
- `performance/lighthouse_service.py` — Lighthouse mobile form-factor audits
- `performance/workload_models.py` — Mobile user-agent strings for load testing
- `ai_testing/ai_testing_orchestrator.py` — Generates a responsive/mobile viewport test case

Mobile testing is **100% an Electron/desktop feature** with no REST API, no persistence, and no server-side logic.

---

## 5. UI Walkthrough

### Setting Up Maestro (Native Testing)

1. Navigate to **Mobile Testing** from the sidebar.
2. If Maestro is not installed, a setup guide appears.
3. Click **Copy Install Command** — copies the Maestro installation curl command.
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

4. Click **Run Test** — executes via Electron IPC.
5. View results: pass/fail, duration, step details.

### Recording with Maestro Studio

1. Click **Start Studio** — launches Maestro Studio in the background.
2. Interact with the emulator — Studio records your actions.
3. Click **Stop Studio** — recorded YAML is captured.
4. Edit the YAML flow as needed, then run it.

### Mobile Web Testing (Device Emulation)

1. Open the **Recorder** page.
2. In the top bar, click the **device selector**.
3. Choose a device (iPhone 15 Pro, Galaxy S24, Pixel 8, etc.).
4. Select network condition (4G, 3G, Slow 3G).
5. Start recording — Playwright opens with the device viewport, user-agent, and touch emulation.

---

## 6. Electron IPC API

All mobile functionality goes through `window.flowstral.mobile.*`:

| Method | IPC Channel | Description |
|--------|------------|-------------|
| `getDevices()` | `mobile-get-devices` | Get 50+ device profiles (viewport, UA, touch, DPR) |
| `setDevice(name, network)` | `mobile-set-device` | Apply device emulation to Playwright |
| `getConfig()` | `mobile-get-config` | Get current mobile config |
| `clearDevice()` | `mobile-clear-device` | Reset to desktop mode |
| `checkMaestro()` | `mobile-check-maestro` | Check Maestro CLI installation |
| `getNativeDevices()` | `mobile-get-native-devices` | List available iOS/Android emulators |
| `runNativeTest(yaml)` | `mobile-run-native-test` | Execute Maestro YAML flow |
| `startRecording()` | `playwright-recorder-start` | Start mobile web recording |
| `stopRecording()` | `playwright-recorder-stop` | Stop mobile web recording |
| `startStudio()` | `mobile-start-studio` | Launch Maestro Studio |
| `stopStudio()` | `mobile-stop-studio` | Stop Maestro Studio |
| `getStudioStatus()` | `mobile-studio-status` | Check if Studio is running |

**Browser fallback:** When running in the web app (not Electron), all mobile methods return empty arrays, `false`, or no-op. Mobile testing is desktop-only.

---

## 7. Configuration

### Prerequisites

| Requirement | Purpose | Status |
|-------------|---------|--------|
| **Electron desktop app** | Required for all mobile IPC | Required |
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
| Offline | 0 | 0 | ∞ |

---

## 8. Known Gaps & TODOs

### What's Real vs. Aspirational

| Feature | Status | Details |
|---------|--------|---------|
| **Mobile web emulation** (viewport, UA, touch) | **Real** | Works via Playwright device emulation |
| **Device selector with 50+ profiles** | **Real** | Loaded from Electron, applied via IPC |
| **Network throttling** | **Real** | Applied via Playwright network conditions |
| **Maestro native testing** | **Real (if Maestro installed)** | Delegates to Maestro CLI via IPC |
| **Maestro Studio recording** | **Real (if Maestro installed)** | Launches studio, captures YAML |
| **Real device testing** | **Not implemented** | Listed as "Coming Soon" |
| **Appium integration** | **Not implemented** | Listed as "Coming Soon" |
| **Push notification testing** | **Not implemented** | Listed as "Coming Soon" |
| **Biometric mocking** | **Not implemented** | Listed as "Coming Soon" |
| **Deep link testing** | **Not implemented** | Listed as "Coming Soon" |
| **Mobile accessibility** | **Not implemented** | Listed as "Coming Soon" |

### Architecture Concerns

| Issue | Details |
|-------|---------|
| **No backend API** | All mobile logic is Electron-only. Web app users have no mobile testing capability. |
| **No persistence** | Test results, device configs, and YAML flows are not saved to any backend or database. |
| **YAML parsing is simplified** | Splits on lines starting with `-` rather than using a proper YAML parser. |
| **Platform limitation** | iOS simulator testing only works on macOS (Xcode requirement). |
| **Maestro dependency** | Third-party CLI that must be separately installed and maintained. |

---

*Last updated: 2026-02-08*
*Generated by code audit of the Flowstral mobile testing feature.*
