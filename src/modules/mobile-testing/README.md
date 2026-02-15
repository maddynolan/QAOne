# Mobile Testing

Native mobile app testing via Maestro CLI with device lab management, test flow creation, execution tracking, and advanced device tools. Supports both iOS and Android platforms.

## Architecture

The module is built around a tabbed hub page (`MobileTestingPage`) with 6 specialized tabs, each rendered by a dedicated component. State is centralized in a Zustand store (`mobileTestingStore`).

1. **Studio** -- `MobileTestStudio` provides Maestro Studio recording with real-time console output and YAML flow editing.
2. **Flows** -- `MobileTestFlows` manages saved YAML test flows with folder organization, import/export, and templates.
3. **Device Lab** -- `MobileDeviceLab` manages connected devices with app install/uninstall, screenshots, and log viewing.
4. **Runs** -- `MobileTestRuns` tracks execution history with filtering, stats, and detailed reports.
5. **Inspector** -- `MobileInspector` provides element hierarchy visualization with selector generation and property inspection.
6. **Tools** -- `MobileAdvancedTools` offers deep links, push notifications, biometrics simulation, and network/geo mocking.

Device communication goes through the `electron-bridge` for native Electron capabilities.

## File Inventory

### Pages

| File | Lines | Purpose |
|------|-------|---------|
| `pages/MobileTestingPage.tsx` | 185 | Hub page with 6 tabs: Studio, Flows, Device Lab, Runs, Inspector, Tools |

### Components

| File | Lines | Purpose |
|------|-------|---------|
| `components/MobileTestFlows.tsx` | 709 | Saved flow management -- CRUD, folders, import/export YAML, templates |
| `components/MobileAdvancedTools.tsx` | 683 | Deep links, push notifications, biometrics, network/geo mocking |
| `components/MobileTestStudio.tsx` | 547 | Maestro Studio recording -- start/stop, YAML flow editor, real-time console |
| `components/MobileDeviceLab.tsx` | 545 | Device management -- install/uninstall apps, screenshots, logs |
| `components/MobileDeviceSelector.tsx` | 531 | Device emulation selection (50+ profiles, network throttling) |
| `components/MobileInspector.tsx` | 442 | Element hierarchy viewer -- selector generation, property inspection |
| `components/MobileTestRuns.tsx` | 347 | Execution history -- stats, filtering, detailed reports |
| `components/index.ts` | -- | Barrel export for all mobile testing components |

### Store

| File | Lines | Purpose |
|------|-------|---------|
| `store/mobileTestingStore.ts` | 683 | Zustand store -- activeTab, isStudioRunning, maestroInstalled, nativeDevices, selectedPlatform, appBundleId, flows, folders, testRuns, studioOutput |

### Module Entry

| File | Purpose |
|------|---------|
| `index.ts` | Barrel exports for pages, components, and store |

## API Endpoints Consumed

Mobile testing primarily communicates through the Electron bridge to local Maestro CLI rather than backend REST APIs. Device operations use IPC channels:

| Channel / Endpoint | Purpose |
|---------------------|---------|
| `maestro:start-studio` | Launch Maestro Studio for recording |
| `maestro:stop-studio` | Stop Maestro Studio |
| `maestro:run-flow` | Execute a YAML test flow |
| `maestro:list-devices` | List connected iOS/Android devices |
| `device:install-app` | Install app on connected device |
| `device:screenshot` | Capture device screenshot |
| `device:logs` | Stream device logs (logcat/syslog) |

## Key Types

```typescript
type MobilePlatform = 'ios' | 'android'
type FlowPriority = 'critical' | 'high' | 'medium' | 'low'
type TestRunStatus = 'passed' | 'failed' | 'running' | 'skipped' | 'error'
```

## Dependencies

- **Internal**: `@/lib/electron-bridge` (native device communication), `@/components/ui/*`
- **External**: React 18, Zustand, Tailwind CSS, Radix UI, Lucide icons
- **System**: Maestro CLI (must be installed separately), ADB (Android), Xcode tools (iOS)

## Testing Notes

- Maestro CLI must be installed and on PATH for studio and flow execution to work.
- Device lab features require physical devices or emulators connected via ADB/Xcode.
- YAML flow import/export should be tested with complex multi-step flows and edge cases (special characters, long commands).
- The `MobileDeviceSelector` contains 50+ device profiles; verify all profiles produce valid emulation configurations.
- Electron bridge IPC calls will fail gracefully in web mode (non-Electron); verify fallback behavior.
