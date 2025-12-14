/**
 * FlowstralEngine - Main orchestrator for the Flowstral recorder
 * Integrates all modules: detection, locator generation, handlers, and script generation
 */

import { 
  ApplicationFingerprint, 
  RecordedElement, 
  AutoHealingLocator,
  RecordingSession,
  EnterpriseApplication,
  RecordedAction,
  ActionType
} from '../types';
import { ApplicationDetector } from '../detection/ApplicationDetector';
import { AutoHealingLocatorEngine } from '../locators/AutoHealingLocatorEngine';
import { ApplicationHandlerFactory } from '../handlers/ApplicationHandlers';
import { PlaywrightScriptGenerator, PageObjectGenerator } from '../generator/PlaywrightScriptGenerator';
import { ElementCollector } from '../collector/ElementCollector';

export interface FlowstralConfig {
  // Locator generation settings
  maxFallbackStrategies: number;
  preferredLocatorTypes: string[];
  avoidDynamicSelectors: boolean;
  
  // Script generation settings
  generatePageObjects: boolean;
  includeComments: boolean;
  includeAutoHealing: boolean;
  testFramework: 'playwright' | 'cypress' | 'puppeteer';
  
  // Recording settings
  captureScreenshots: boolean;
  captureNetworkRequests: boolean;
  waitForNetworkIdle: boolean;
  defaultTimeout: number;
  
  // Application-specific overrides
  applicationOverrides: Partial<Record<EnterpriseApplication, Partial<FlowstralConfig>>>;
}

const DEFAULT_CONFIG: FlowstralConfig = {
  maxFallbackStrategies: 5,
  preferredLocatorTypes: ['role', 'text', 'label', 'testid', 'data-attribute'],
  avoidDynamicSelectors: true,
  generatePageObjects: true,
  includeComments: true,
  includeAutoHealing: true,
  testFramework: 'playwright',
  captureScreenshots: false,
  captureNetworkRequests: false,
  waitForNetworkIdle: true,
  defaultTimeout: 30000,
  applicationOverrides: {}
};

export interface RecordingContext {
  session: RecordingSession;
  fingerprint: ApplicationFingerprint;
  elements: Map<string, RecordedElement>;
  locators: Map<string, AutoHealingLocator>;
  actions: RecordedAction[];
}

export class FlowstralEngine {
  private config: FlowstralConfig;
  private detector: ApplicationDetector;
  private locatorEngine: AutoHealingLocatorEngine;
  private scriptGenerator: PlaywrightScriptGenerator;
  private pageObjectGenerator: PageObjectGenerator;
  private activeContexts: Map<string, RecordingContext>;

  constructor(config: Partial<FlowstralConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.detector = new ApplicationDetector();
    // Initialize with default fingerprint - will be updated when session starts
    const defaultFingerprint: ApplicationFingerprint = {
      application: 'unknown',
      confidence: 0,
      detectionMethod: 'dom-signature',
      shadowDomEnabled: false
    };
    this.locatorEngine = new AutoHealingLocatorEngine(defaultFingerprint);
    this.scriptGenerator = new PlaywrightScriptGenerator(defaultFingerprint);
    this.pageObjectGenerator = new PageObjectGenerator(defaultFingerprint);
    this.activeContexts = new Map();
  }

  /**
   * Start a new recording session
   */
  startSession(sessionId: string, initialUrl: string): RecordingContext {
    const defaultFingerprint: ApplicationFingerprint = {
      application: 'unknown',
      confidence: 0,
      detectionMethod: 'dom-signature',
      shadowDomEnabled: false
    };
    
    const session: RecordingSession = {
      id: sessionId,
      startTime: Date.now(),
      actions: [],
      pageTransitions: [],
      errors: [],
      application: defaultFingerprint,
      baseUrl: initialUrl,
      metadata: {
        browserType: 'unknown',
        browserVersion: 'unknown',
        viewportSize: { width: 1920, height: 1080 },
        userAgent: 'unknown',
        locale: 'en-US',
        timezone: 'UTC'
      }
    };

    const context: RecordingContext = {
      session,
      fingerprint: defaultFingerprint,
      elements: new Map(),
      locators: new Map(),
      actions: []
    };

    this.activeContexts.set(sessionId, context);
    return context;
  }

  /**
   * Get browser injection scripts for recording
   */
  getInjectionScripts(): { detector: string; collector: string; recorder: string } {
    // ApplicationDetector doesn't have getBrowserScript, return empty string for now
    // The detector script would be generated separately if needed
    return {
      detector: this.detector.getDetectionScript(),
      collector: ElementCollector.getInjectionScript(),
      recorder: this.getRecorderScript()
    };
  }

  /**
   * Main recorder script to inject into the browser
   */
  private getRecorderScript(): string {
    return `
(function() {
  'use strict';
  
  if (window.__flowstralRecorder) return;
  
  window.__flowstralRecorder = {
    sessionId: null,
    isRecording: false,
    actionQueue: [],
    elementCache: new Map(),
    
    // Start recording
    start: function(sessionId) {
      this.sessionId = sessionId;
      this.isRecording = true;
      this.actionQueue = [];
      this.elementCache.clear();
      this.attachListeners();
      console.log('[Flowstral] Recording started:', sessionId);
    },
    
    // Stop recording
    stop: function() {
      this.isRecording = false;
      this.detachListeners();
      const result = {
        sessionId: this.sessionId,
        actions: [...this.actionQueue],
        elements: Array.from(this.elementCache.values())
      };
      console.log('[Flowstral] Recording stopped. Actions:', this.actionQueue.length);
      return result;
    },
    
    // Attach event listeners
    attachListeners: function() {
      document.addEventListener('click', this.handleClick.bind(this), true);
      document.addEventListener('input', this.handleInput.bind(this), true);
      document.addEventListener('change', this.handleChange.bind(this), true);
      document.addEventListener('keydown', this.handleKeydown.bind(this), true);
      document.addEventListener('focus', this.handleFocus.bind(this), true);
    },
    
    // Detach event listeners
    detachListeners: function() {
      document.removeEventListener('click', this.handleClick.bind(this), true);
      document.removeEventListener('input', this.handleInput.bind(this), true);
      document.removeEventListener('change', this.handleChange.bind(this), true);
      document.removeEventListener('keydown', this.handleKeydown.bind(this), true);
      document.removeEventListener('focus', this.handleFocus.bind(this), true);
    },
    
    // Generate unique element ID
    generateElementId: function(element) {
      const tag = element.tagName.toLowerCase();
      const id = element.id || '';
      const classes = Array.from(element.classList).slice(0, 3).join('.');
      const text = (element.textContent || '').trim().substring(0, 20);
      return \`\${tag}_\${id}_\${classes}_\${text}\`.replace(/[^a-zA-Z0-9_]/g, '_');
    },
    
    // Collect element data using injected collector
    collectElement: function(element) {
      if (!element || element === document.body || element === document.documentElement) {
        return null;
      }
      
      const elementId = this.generateElementId(element);
      
      if (!this.elementCache.has(elementId)) {
        // Use the injected element collector
        if (window.__flowstralElementCollector) {
          const data = window.__flowstralElementCollector.collect(element);
          data.elementId = elementId;
          this.elementCache.set(elementId, data);
        }
      }
      
      return elementId;
    },
    
    // Record an action
    recordAction: function(type, element, data = {}) {
      if (!this.isRecording) return;
      
      const elementId = this.collectElement(element);
      
      const action = {
        id: \`action_\${Date.now()}_\${Math.random().toString(36).substr(2, 9)}\`,
        type: type,
        elementId: elementId,
        timestamp: Date.now(),
        url: window.location.href,
        ...data
      };
      
      this.actionQueue.push(action);
      
      // Send to extension/backend
      if (window.__flowstralBridge) {
        window.__flowstralBridge.sendAction(action);
      }
      
      console.log('[Flowstral] Recorded:', type, elementId);
    },
    
    // Handle click events
    handleClick: function(event) {
      const target = event.target;
      
      // Skip if it's a synthetic click or inside recorder UI
      if (event.__flowstralSynthetic || target.closest('.flowstral-ui')) {
        return;
      }
      
      // Determine click type
      let clickType = 'click';
      if (event.detail === 2) clickType = 'dblclick';
      if (event.button === 2) clickType = 'rightclick';
      
      this.recordAction(clickType, target, {
        button: event.button,
        x: event.clientX,
        y: event.clientY
      });
    },
    
    // Handle input events (typing)
    handleInput: function(event) {
      const target = event.target;
      
      if (!['INPUT', 'TEXTAREA'].includes(target.tagName)) return;
      if (target.type === 'password') return; // Skip passwords for security
      
      // Debounce typing - we'll record the final value on change/blur
      clearTimeout(target.__flowstralInputTimer);
      target.__flowstralInputTimer = setTimeout(() => {
        this.recordAction('fill', target, {
          value: target.value,
          inputType: target.type
        });
      }, 500);
    },
    
    // Handle change events (dropdowns, checkboxes, etc.)
    handleChange: function(event) {
      const target = event.target;
      
      if (target.tagName === 'SELECT') {
        const selectedOptions = Array.from(target.selectedOptions).map(o => o.value);
        this.recordAction('select', target, {
          values: selectedOptions,
          labels: Array.from(target.selectedOptions).map(o => o.textContent)
        });
      } else if (target.type === 'checkbox' || target.type === 'radio') {
        this.recordAction(target.checked ? 'check' : 'uncheck', target, {
          checked: target.checked
        });
      } else if (target.type === 'file') {
        this.recordAction('upload', target, {
          files: Array.from(target.files || []).map(f => f.name)
        });
      }
    },
    
    // Handle keyboard events
    handleKeydown: function(event) {
      // Record special key combinations
      const specialKeys = ['Enter', 'Tab', 'Escape', 'Backspace', 'Delete', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
      
      if (specialKeys.includes(event.key) || event.ctrlKey || event.metaKey || event.altKey) {
        const modifiers = [];
        if (event.ctrlKey) modifiers.push('Control');
        if (event.metaKey) modifiers.push('Meta');
        if (event.altKey) modifiers.push('Alt');
        if (event.shiftKey) modifiers.push('Shift');
        
        this.recordAction('keypress', event.target, {
          key: event.key,
          code: event.code,
          modifiers: modifiers
        });
      }
    },
    
    // Handle focus events for navigation tracking
    handleFocus: function(event) {
      // Track focus for form filling context
      const target = event.target;
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) {
        target.__flowstralFocusTime = Date.now();
      }
    }
  };
  
  console.log('[Flowstral] Recorder script loaded');
})();
`;
  }

  /**
   * Process detection results from browser
   */
  processDetectionResult(sessionId: string, detectionData: any): ApplicationFingerprint {
    const context = this.activeContexts.get(sessionId);
    if (!context) {
      throw new Error(`No active session found: ${sessionId}`);
    }

    const fingerprint: ApplicationFingerprint = {
      application: (detectionData.application || 'unknown') as EnterpriseApplication,
      confidence: detectionData.confidence || 0,
      version: detectionData.version,
      detectionMethod: detectionData.detectionMethod || 'dom-signature',
      shadowDomEnabled: detectionData.shadowDom || false,
      lightningEnabled: detectionData.lightningEnabled,
      customComponents: detectionData.customComponents
    };

    context.fingerprint = fingerprint;
    context.session.application = fingerprint;
    
    // Update engines with new fingerprint
    this.locatorEngine = new AutoHealingLocatorEngine(fingerprint);
    this.scriptGenerator = new PlaywrightScriptGenerator(fingerprint);
    this.pageObjectGenerator = new PageObjectGenerator(fingerprint);

    console.log(`[Flowstral] Detected application: ${fingerprint.application} (${fingerprint.confidence}% confidence)`);

    return fingerprint;
  }

  /**
   * Process a recorded action from the browser
   */
  processAction(sessionId: string, actionData: any): RecordedAction {
    const context = this.activeContexts.get(sessionId);
    if (!context) {
      throw new Error(`No active session found: ${sessionId}`);
    }

    const action: RecordedAction = {
      id: actionData.id,
      type: actionData.type as ActionType,
      element: actionData.element,
      timestamp: actionData.timestamp,
      value: actionData.value,
      key: actionData.key,
      modifiers: actionData.modifiers,
      targetUrl: actionData.targetUrl,
      waitCondition: actionData.waitCondition,
      duration: actionData.duration,
      screenshot: actionData.screenshot
    };

    context.actions.push(action);
    context.session.actions.push(action);

    return action;
  }

  /**
   * Process collected element data from browser
   */
  processElement(sessionId: string, elementData: any): RecordedElement {
    const context = this.activeContexts.get(sessionId);
    if (!context) {
      throw new Error(`No active session found: ${sessionId}`);
    }

    // Get application-specific handler
    const handler = ApplicationHandlerFactory.getHandler(context.fingerprint);

    // Transform element data using handler
    const element = handler.transformElement(elementData);

    // Generate auto-healing locators
    const locator = this.locatorEngine.generateAutoHealingLocator(element);

    // Store in context
    if (element.id) {
      context.elements.set(element.id, element);
      context.locators.set(element.id, locator);
    }

    return element;
  }

  /**
   * Generate description for an action
   */
  private generateActionDescription(actionData: any): string {
    const descriptions: Record<string, (data: any) => string> = {
      click: (d) => `Click on element`,
      dblclick: (d) => `Double-click on element`,
      fill: (d) => `Type "${d.value}" into input`,
      select: (d) => `Select "${d.labels?.join(', ') || d.values?.join(', ')}"`,
      check: () => `Check checkbox`,
      uncheck: () => `Uncheck checkbox`,
      upload: (d) => `Upload file(s): ${d.files?.join(', ')}`,
      keypress: (d) => `Press ${d.modifiers?.length ? d.modifiers.join('+') + '+' : ''}${d.key}`,
      hover: () => `Hover over element`,
      navigate: (d) => `Navigate to ${d.url}`,
      wait: (d) => `Wait for ${d.condition}`
    };

    const generator = descriptions[actionData.type] || (() => `Perform ${actionData.type}`);
    return generator(actionData);
  }

  /**
   * End a recording session and generate scripts
   */
  endSession(sessionId: string): {
    session: RecordingSession;
    script: string;
    pageObject?: string;
  } {
    const context = this.activeContexts.get(sessionId);
    if (!context) {
      throw new Error(`No active session found: ${sessionId}`);
    }

    // Update session end time
    context.session.endTime = Date.now();

    // Generate script
    const generatedScript = this.scriptGenerator.generateScript(context.session);
    const script = generatedScript.code;

    // Generate page object if configured
    let pageObject: string | undefined;
    if (this.config.generatePageObjects && generatedScript.pageObjects) {
      // Page object generation would be handled separately
      pageObject = JSON.stringify(generatedScript.pageObjects, null, 2);
    }

    // Clean up
    this.activeContexts.delete(sessionId);

    return {
      session: context.session,
      script,
      pageObject
    };
  }

  /**
   * Get current session context
   */
  getContext(sessionId: string): RecordingContext | undefined {
    return this.activeContexts.get(sessionId);
  }

  /**
   * Generate script from existing session data
   */
  generateScript(session: RecordingSession): string {
    const generatedScript = this.scriptGenerator.generateScript(session);
    return generatedScript.code;
  }

  /**
   * Generate page object from existing session data
   */
  generatePageObject(session: RecordingSession): string {
    const generatedScript = this.scriptGenerator.generateScript(session);
    if (generatedScript.pageObjects && generatedScript.pageObjects.length > 0) {
      return JSON.stringify(generatedScript.pageObjects, null, 2);
    }
    return '';
  }

  /**
   * Regenerate locators for an element (for healing)
   */
  regenerateLocator(
    element: RecordedElement, 
    application: EnterpriseApplication
  ): AutoHealingLocator {
    const fingerprint: ApplicationFingerprint = {
      application,
      confidence: 100,
      detectionMethod: 'dom-signature',
      shadowDomEnabled: element.shadowPath !== undefined && element.shadowPath.length > 0
    };

    return this.locatorEngine.generateAutoHealingLocator(element);
  }

  /**
   * Get application-specific configuration
   */
  getApplicationConfig(application: EnterpriseApplication) {
    const fingerprint: ApplicationFingerprint = {
      application,
      confidence: 100,
      detectionMethod: 'dom-signature',
      shadowDomEnabled: false
    };
    const handler = ApplicationHandlerFactory.getHandler(fingerprint);
    return handler.getConfig();
  }

  /**
   * Update engine configuration
   */
  updateConfig(newConfig: Partial<FlowstralConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Get current configuration
   */
  getConfig(): FlowstralConfig {
    return { ...this.config };
  }

  /**
   * Export session to JSON
   */
  exportSession(sessionId: string): string {
    const context = this.activeContexts.get(sessionId);
    if (!context) {
      throw new Error(`No active session found: ${sessionId}`);
    }

    return JSON.stringify({
      session: context.session,
      fingerprint: context.fingerprint,
      elements: Array.from(context.elements.values()),
      locators: Array.from(context.locators.entries()).map(([id, loc]) => ({ elementId: id, locator: loc })),
      actions: context.actions
    }, null, 2);
  }

  /**
   * Import session from JSON
   */
  importSession(jsonData: string): RecordingContext {
    const data = JSON.parse(jsonData);
    
    const context: RecordingContext = {
      session: data.session,
      fingerprint: data.fingerprint,
      elements: new Map(data.elements.map((e: RecordedElement) => [e.id, e])),
      locators: new Map(data.locators.map((l: any) => [l.elementId, l.locator])),
      actions: data.actions
    };

    this.activeContexts.set(data.session.id, context);
    return context;
  }
}

/**
 * Singleton instance for convenience
 */
let engineInstance: FlowstralEngine | null = null;

export function getFlowstralEngine(config?: Partial<FlowstralConfig>): FlowstralEngine {
  if (!engineInstance) {
    engineInstance = new FlowstralEngine(config);
  }
  return engineInstance;
}

export function resetFlowstralEngine(): void {
  engineInstance = null;
}
