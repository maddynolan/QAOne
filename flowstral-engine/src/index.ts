/**
 * Flowstral - Enterprise Application Test Recorder
 * Main entry point
 */

// Core exports
export { FlowstralEngine, getFlowstralEngine, resetFlowstralEngine } from './core/FlowstralEngine';
export type { FlowstralConfig, RecordingContext } from './core/FlowstralEngine';

export { SessionManager, MemorySessionStorage, FileSessionStorage } from './core/SessionManager';
export type { SessionMetadata, SessionStorage } from './core/SessionManager';

export { 
  BrowserBridge, 
  ExtensionBridge, 
  WebSocketBridge, 
  PostMessageBridge,
  createBridge,
  FlowstralClient 
} from './core/BrowserBridge';
export type { BridgeMessage, BridgeConfig } from './core/BrowserBridge';

// Type exports
export * from './types';

// Detection
export { ApplicationDetector } from './detection/ApplicationDetector';

// Locators
export { AutoHealingLocatorEngine } from './locators/AutoHealingLocatorEngine';

// Locator Healing Runtime
export {
  LocatorHealingRuntime,
  createHealingRuntime,
} from './healing/LocatorHealingRuntime';
export type {
  HealingResult,
  ValidationResult,
  ElementMatch,
} from './healing/LocatorHealingRuntime';

// Test Utilities
export {
  WaitUtilities,
  ShadowDomUtilities,
  FrameUtilities,
  RetryUtilities,
  ScreenshotUtilities,
  createTestUtilities,
} from './utils/TestUtilities';

// Handlers - All 20+ Enterprise Applications
export { 
  ApplicationHandler,
  ApplicationHandlerFactory,
  SalesforceHandler,
  WorkdayHandler,
  ServiceNowHandler,
  SAPHandler,
  PegaHandler,
  OracleFusionHandler,
  Dynamics365Handler,
  NetSuiteHandler,
  SuccessFactorsHandler,
  ConcurHandler,
  VeevaHandler,
  CoupaHandler,
  AribaHandler,
  ZendeskHandler,
  HubSpotHandler,
  ZohoHandler,
  JiraHandler,
  ConfluenceHandler,
  AnaplanHandler,
  MondayHandler,
  AsanaHandler,
  TableauHandler,
  PowerBIHandler,
  GenericHandler
} from './handlers/ApplicationHandlers';

// Generator
export { PlaywrightScriptGenerator, PageObjectGenerator } from './generator/PlaywrightScriptGenerator';

// Collector
export { ElementCollector } from './collector/ElementCollector';

/**
 * Quick start helper
 */
export function createFlowstral(config?: Partial<import('./core/FlowstralEngine').FlowstralConfig>) {
  const engine = new (require('./core/FlowstralEngine').FlowstralEngine)(config);
  const sessionManager = new (require('./core/SessionManager').SessionManager)();
  
  return {
    engine,
    sessionManager,
    
    // Convenience methods
    startRecording: (name?: string) => {
      const session = sessionManager.createSession(name);
      engine.startSession(session.id, '');
      return session;
    },
    
    stopRecording: async () => {
      const session = await sessionManager.stopSession();
      return engine.endSession(session.id);
    },
    
    getInjectionScripts: () => engine.getInjectionScripts(),
    
    generateScript: (sessionId: string) => {
      const session = sessionManager.getActiveSession();
      if (session) return engine.generateScript(session);
      return null;
    }
  };
}

/**
 * Version info
 */
export const VERSION = '1.0.0';
export const SUPPORTED_APPLICATIONS = [
  'salesforce',
  'workday', 
  'servicenow',
  'sap',
  'pega',
  'oracle-fusion',
  'dynamics365',
  'netsuite',
  'successfactors',
  'concur',
  'veeva',
  'coupa',
  'ariba',
  'zendesk',
  'hubspot',
  'zoho',
  'freshworks',
  'anaplan',
  'snowflake',
  'tableau',
  'power-bi',
  'jira',
  'confluence',
  'monday',
  'asana'
] as const;
