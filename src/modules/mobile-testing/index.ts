/**
 * @module mobile-testing
 *
 * Native mobile app testing via Maestro CLI with device lab management.
 *
 * Features:
 * - Maestro Studio recording (start/stop, YAML flow editor)
 * - Test flow management (CRUD, folders, import/export YAML)
 * - Device lab management (install/uninstall apps, screenshots, logs)
 * - Element hierarchy viewer with selector generation
 * - Advanced tools (deep links, push notifications, biometrics, network/geo mocking)
 * - 50+ device emulation profiles with network throttling
 */

// Pages
export { default as MobileTestingPage } from './pages/MobileTestingPage';

// Components
export { default as MobileTestStudio } from './components/MobileTestStudio';
export { default as MobileTestFlows } from './components/MobileTestFlows';
export { default as MobileDeviceLab } from './components/MobileDeviceLab';
export { default as MobileTestRuns } from './components/MobileTestRuns';
export { default as MobileInspector } from './components/MobileInspector';
export { default as MobileAdvancedTools } from './components/MobileAdvancedTools';
export { default as MobileDeviceSelector } from './components/MobileDeviceSelector';

// Store
export { useMobileTestingStore } from './store/mobileTestingStore';
