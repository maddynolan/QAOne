/**
 * BrowserBridge - Handles communication between browser and Flowstral engine
 * Supports Chrome extension, WebSocket, and postMessage protocols
 */

import { FlowstralEngine } from './FlowstralEngine';
import { SessionManager } from './SessionManager';
import { RecordedAction, RecordedElement, ApplicationFingerprint } from '../types';

export interface BridgeMessage {
  type: string;
  payload: any;
  sessionId?: string;
  timestamp: number;
  id: string;
}

export interface BridgeConfig {
  protocol: 'extension' | 'websocket' | 'postmessage';
  websocketUrl?: string;
  debug?: boolean;
}

/**
 * Abstract base class for browser communication
 */
export abstract class BrowserBridge {
  protected engine: FlowstralEngine;
  protected sessionManager: SessionManager;
  protected debug: boolean;
  protected messageHandlers: Map<string, (message: BridgeMessage) => Promise<any>>;

  constructor(engine: FlowstralEngine, sessionManager: SessionManager, debug = false) {
    this.engine = engine;
    this.sessionManager = sessionManager;
    this.debug = debug;
    this.messageHandlers = new Map();
    this.registerDefaultHandlers();
  }

  protected log(...args: any[]): void {
    if (this.debug) {
      console.log('[Flowstral Bridge]', ...args);
    }
  }

  abstract connect(): Promise<void>;
  abstract disconnect(): void;
  abstract send(message: BridgeMessage): void;

  /**
   * Register default message handlers
   */
  protected registerDefaultHandlers(): void {
    // Start recording
    this.on('startRecording', async (msg) => {
      const session = this.sessionManager.createSession(msg.payload.name);
      const scripts = this.engine.getInjectionScripts();
      return { sessionId: session.id, scripts };
    });

    // Stop recording
    this.on('stopRecording', async (msg) => {
      const session = await this.sessionManager.stopSession();
      const result = this.engine.endSession(session.id);
      return result;
    });

    // Pause recording
    this.on('pauseRecording', async () => {
      this.sessionManager.pauseSession();
      return { status: 'paused' };
    });

    // Resume recording
    this.on('resumeRecording', async () => {
      this.sessionManager.resumeSession();
      return { status: 'recording' };
    });

    // Application detected
    this.on('applicationDetected', async (msg) => {
      const sessionId = msg.sessionId!;
      const fingerprint = this.engine.processDetectionResult(sessionId, msg.payload);
      this.sessionManager.updateSession({ application: fingerprint.application });
      return { fingerprint };
    });

    // Action recorded
    this.on('actionRecorded', async (msg) => {
      const sessionId = msg.sessionId!;
      const action = this.engine.processAction(sessionId, msg.payload);
      this.sessionManager.addAction(action);
      return { actionId: action.id };
    });

    // Element collected
    this.on('elementCollected', async (msg) => {
      const sessionId = msg.sessionId!;
      const element = this.engine.processElement(sessionId, msg.payload);
      this.sessionManager.addElement(element);
      return { elementId: element.id };
    });

    // Get session status
    this.on('getStatus', async () => {
      const session = this.sessionManager.getActiveSession();
      return {
        isRecording: session?.status === 'recording',
        isPaused: session?.status === 'paused',
        sessionId: session?.id,
        actionCount: session?.actions.length || 0
      };
    });

    // Get generated script
    this.on('getScript', async (msg) => {
      const session = await this.sessionManager.loadSession(msg.payload.sessionId);
      if (!session) throw new Error('Session not found');
      const script = this.engine.generateScript(session);
      return { script };
    });

    // Get page object
    this.on('getPageObject', async (msg) => {
      const session = await this.sessionManager.loadSession(msg.payload.sessionId);
      if (!session) throw new Error('Session not found');
      const pageObject = this.engine.generatePageObject(session);
      return { pageObject };
    });

    // List sessions
    this.on('listSessions', async () => {
      const sessions = await this.sessionManager.listSessions();
      return { sessions };
    });

    // Delete session
    this.on('deleteSession', async (msg) => {
      await this.sessionManager.deleteSession(msg.payload.sessionId);
      return { deleted: true };
    });

    // Export session
    this.on('exportSession', async (msg) => {
      const data = await this.sessionManager.exportSession(
        msg.payload.sessionId, 
        msg.payload.format || 'json'
      );
      return { data };
    });
  }

  /**
   * Register a message handler
   */
  on(type: string, handler: (message: BridgeMessage) => Promise<any>): void {
    this.messageHandlers.set(type, handler);
  }

  /**
   * Handle incoming message
   */
  protected async handleMessage(message: BridgeMessage): Promise<any> {
    this.log('Received:', message.type, message.payload);

    const handler = this.messageHandlers.get(message.type);
    if (!handler) {
      throw new Error(`Unknown message type: ${message.type}`);
    }

    try {
      const result = await handler(message);
      return { success: true, data: result };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }
}

/**
 * Chrome Extension Bridge
 * Uses chrome.runtime messaging
 */
export class ExtensionBridge extends BrowserBridge {
  private port: any = null;

  async connect(): Promise<void> {
    // This runs in the extension background script
    if (typeof chrome !== 'undefined' && chrome.runtime) {
      chrome.runtime.onConnect.addListener((port: any) => {
        this.log('Content script connected');
        this.port = port;

        port.onMessage.addListener(async (message: BridgeMessage) => {
          const response = await this.handleMessage(message);
          port.postMessage({ ...response, id: message.id });
        });

        port.onDisconnect.addListener(() => {
          this.log('Content script disconnected');
          this.port = null;
        });
      });
    }
  }

  disconnect(): void {
    if (this.port) {
      this.port.disconnect();
      this.port = null;
    }
  }

  send(message: BridgeMessage): void {
    if (this.port) {
      this.port.postMessage(message);
    }
  }

  /**
   * Get content script for injection
   */
  getContentScript(): string {
    const scripts = this.engine.getInjectionScripts();
    return `
(function() {
  // Inject detector
  ${scripts.detector}
  
  // Inject element collector
  ${scripts.collector}
  
  // Inject recorder
  ${scripts.recorder}
  
  // Bridge to extension
  const port = chrome.runtime.connect({ name: 'flowstral' });
  let sessionId = null;
  
  window.__flowstralBridge = {
    sendAction: function(action) {
      port.postMessage({
        type: 'actionRecorded',
        sessionId: sessionId,
        payload: action,
        timestamp: Date.now(),
        id: 'action_' + Date.now()
      });
    },
    
    sendElement: function(element) {
      port.postMessage({
        type: 'elementCollected',
        sessionId: sessionId,
        payload: element,
        timestamp: Date.now(),
        id: 'element_' + Date.now()
      });
    }
  };
  
  port.onMessage.addListener(function(message) {
    if (message.type === 'startRecording') {
      sessionId = message.sessionId;
      
      // Detect application
      const fingerprint = window.__flowstralDetector.detect();
      port.postMessage({
        type: 'applicationDetected',
        sessionId: sessionId,
        payload: fingerprint,
        timestamp: Date.now(),
        id: 'detect_' + Date.now()
      });
      
      // Start recording
      window.__flowstralRecorder.start(sessionId);
    }
    
    if (message.type === 'stopRecording') {
      const result = window.__flowstralRecorder.stop();
      port.postMessage({
        type: 'recordingComplete',
        sessionId: sessionId,
        payload: result,
        timestamp: Date.now(),
        id: 'complete_' + Date.now()
      });
      sessionId = null;
    }
  });
})();
`;
  }
}

/**
 * WebSocket Bridge
 * For server-based recording
 */
export class WebSocketBridge extends BrowserBridge {
  private ws: WebSocket | null = null;
  private url: string;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private pendingRequests: Map<string, { resolve: Function; reject: Function }> = new Map();

  constructor(engine: FlowstralEngine, sessionManager: SessionManager, url: string, debug = false) {
    super(engine, sessionManager, debug);
    this.url = url;
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.url);

      this.ws.onopen = () => {
        this.log('WebSocket connected');
        this.reconnectAttempts = 0;
        resolve();
      };

      this.ws.onclose = () => {
        this.log('WebSocket closed');
        this.attemptReconnect();
      };

      this.ws.onerror = (error) => {
        this.log('WebSocket error:', error);
        reject(error);
      };

      this.ws.onmessage = async (event) => {
        const message: BridgeMessage = JSON.parse(event.data);
        
        // Check if this is a response to a pending request
        if (this.pendingRequests.has(message.id)) {
          const { resolve } = this.pendingRequests.get(message.id)!;
          this.pendingRequests.delete(message.id);
          resolve(message.payload);
          return;
        }

        // Otherwise handle as incoming command
        const response = await this.handleMessage(message);
        this.ws?.send(JSON.stringify({ ...response, id: message.id }));
      };
    });
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = Math.pow(2, this.reconnectAttempts) * 1000;
      this.log(`Reconnecting in ${delay}ms...`);
      setTimeout(() => this.connect(), delay);
    }
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  send(message: BridgeMessage): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  /**
   * Send and wait for response
   */
  async sendAsync(type: string, payload: any, sessionId?: string): Promise<any> {
    return new Promise((resolve, reject) => {
      const message: BridgeMessage = {
        type,
        payload,
        sessionId,
        timestamp: Date.now(),
        id: `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      };

      this.pendingRequests.set(message.id, { resolve, reject });
      this.send(message);

      // Timeout after 30 seconds
      setTimeout(() => {
        if (this.pendingRequests.has(message.id)) {
          this.pendingRequests.delete(message.id);
          reject(new Error('Request timed out'));
        }
      }, 30000);
    });
  }
}

/**
 * PostMessage Bridge
 * For iframe/popup communication
 */
export class PostMessageBridge extends BrowserBridge {
  private targetWindow: Window | null = null;
  private targetOrigin: string = '*';

  constructor(
    engine: FlowstralEngine, 
    sessionManager: SessionManager, 
    targetWindow?: Window,
    targetOrigin?: string,
    debug = false
  ) {
    super(engine, sessionManager, debug);
    this.targetWindow = targetWindow || null;
    this.targetOrigin = targetOrigin || '*';
  }

  async connect(): Promise<void> {
    window.addEventListener('message', this.onMessage.bind(this));
    this.log('PostMessage bridge connected');
  }

  disconnect(): void {
    window.removeEventListener('message', this.onMessage.bind(this));
  }

  private async onMessage(event: MessageEvent): Promise<void> {
    // Verify origin if specified
    if (this.targetOrigin !== '*' && event.origin !== this.targetOrigin) {
      return;
    }

    const message = event.data;
    if (!message || !message.type || !message.type.startsWith('flowstral:')) {
      return;
    }

    // Remove prefix
    const bridgeMessage: BridgeMessage = {
      ...message,
      type: message.type.replace('flowstral:', '')
    };

    const response = await this.handleMessage(bridgeMessage);
    
    // Reply to source window
    (event.source as Window)?.postMessage({
      type: `flowstral:response`,
      id: bridgeMessage.id,
      ...response
    }, event.origin);
  }

  send(message: BridgeMessage): void {
    const target = this.targetWindow || window.parent;
    target.postMessage({
      ...message,
      type: `flowstral:${message.type}`
    }, this.targetOrigin);
  }
}

/**
 * Factory for creating appropriate bridge
 */
export function createBridge(
  config: BridgeConfig,
  engine: FlowstralEngine,
  sessionManager: SessionManager
): BrowserBridge {
  switch (config.protocol) {
    case 'extension':
      return new ExtensionBridge(engine, sessionManager, config.debug);
    
    case 'websocket':
      if (!config.websocketUrl) {
        throw new Error('WebSocket URL required');
      }
      return new WebSocketBridge(engine, sessionManager, config.websocketUrl, config.debug);
    
    case 'postmessage':
      return new PostMessageBridge(engine, sessionManager, undefined, undefined, config.debug);
    
    default:
      throw new Error(`Unknown protocol: ${config.protocol}`);
  }
}

/**
 * Browser-side client for communicating with Flowstral
 * Inject this into the page being recorded
 */
export const FlowstralClient = `
(function() {
  'use strict';
  
  if (window.__flowstralClient) return;
  
  window.__flowstralClient = {
    sessionId: null,
    protocol: null,
    ws: null,
    port: null,
    
    // Initialize client
    init: function(config) {
      this.protocol = config.protocol || 'postmessage';
      
      if (this.protocol === 'websocket' && config.websocketUrl) {
        this.initWebSocket(config.websocketUrl);
      } else if (this.protocol === 'extension') {
        this.initExtension();
      }
      
      console.log('[Flowstral Client] Initialized with protocol:', this.protocol);
    },
    
    // WebSocket initialization
    initWebSocket: function(url) {
      this.ws = new WebSocket(url);
      this.ws.onopen = () => console.log('[Flowstral Client] WebSocket connected');
      this.ws.onmessage = (event) => this.handleMessage(JSON.parse(event.data));
      this.ws.onerror = (error) => console.error('[Flowstral Client] WebSocket error:', error);
    },
    
    // Chrome extension initialization
    initExtension: function() {
      if (typeof chrome !== 'undefined' && chrome.runtime) {
        this.port = chrome.runtime.connect({ name: 'flowstral-page' });
        this.port.onMessage.addListener((msg) => this.handleMessage(msg));
      }
    },
    
    // Handle incoming messages
    handleMessage: function(message) {
      if (message.type === 'startRecording') {
        this.sessionId = message.sessionId;
        this.startRecording();
      } else if (message.type === 'stopRecording') {
        this.stopRecording();
      }
    },
    
    // Start recording
    startRecording: function() {
      // Inject and start recorder
      if (window.__flowstralRecorder) {
        window.__flowstralRecorder.start(this.sessionId);
      }
      
      // Detect application
      if (window.__flowstralDetector) {
        const fingerprint = window.__flowstralDetector.detect();
        this.send('applicationDetected', fingerprint);
      }
    },
    
    // Stop recording
    stopRecording: function() {
      if (window.__flowstralRecorder) {
        const result = window.__flowstralRecorder.stop();
        this.send('recordingComplete', result);
      }
    },
    
    // Send message
    send: function(type, payload) {
      const message = {
        type: type,
        sessionId: this.sessionId,
        payload: payload,
        timestamp: Date.now(),
        id: 'msg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9)
      };
      
      if (this.protocol === 'websocket' && this.ws) {
        this.ws.send(JSON.stringify(message));
      } else if (this.protocol === 'extension' && this.port) {
        this.port.postMessage(message);
      } else {
        window.parent.postMessage({ ...message, type: 'flowstral:' + type }, '*');
      }
    }
  };
})();
`;
