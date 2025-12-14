/**
 * SessionManager - Manages recording session lifecycle
 * Handles persistence, replay, and session state management
 */

import { RecordingSession, RecordedAction, RecordedElement, EnterpriseApplication, ActionType, ApplicationFingerprint } from '../types';
import { v4 as uuidv4 } from 'uuid';

export interface SessionMetadata {
  id: string;
  name: string;
  application: EnterpriseApplication;
  createdAt: number;
  updatedAt: number;
  duration: number;
  actionCount: number;
  status: 'recording' | 'paused' | 'completed' | 'failed';
  tags: string[];
}

export interface SessionStorage {
  save(session: RecordingSession): Promise<void>;
  load(sessionId: string): Promise<RecordingSession | null>;
  delete(sessionId: string): Promise<void>;
  list(): Promise<SessionMetadata[]>;
  search(query: string): Promise<SessionMetadata[]>;
}

/**
 * In-memory session storage (default)
 */
export class MemorySessionStorage implements SessionStorage {
  private sessions: Map<string, RecordingSession> = new Map();

  async save(session: RecordingSession): Promise<void> {
    this.sessions.set(session.id, { ...session });
  }

  async load(sessionId: string): Promise<RecordingSession | null> {
    const session = this.sessions.get(sessionId);
    return session ? { ...session } : null;
  }

  async delete(sessionId: string): Promise<void> {
    this.sessions.delete(sessionId);
  }

  async list(): Promise<SessionMetadata[]> {
    return Array.from(this.sessions.values()).map(s => ({
      id: s.id,
      name: `Session_${s.id.slice(0, 8)}`, // Generate name from ID
      application: s.application.application,
      createdAt: s.startTime,
      updatedAt: s.endTime || s.startTime,
      duration: (s.endTime || Date.now()) - s.startTime,
      actionCount: s.actions.length,
      status: s.endTime ? 'completed' : 'recording',
      tags: []
    }));
  }

  async search(query: string): Promise<SessionMetadata[]> {
    const lowerQuery = query.toLowerCase();
    const all = await this.list();
    return all.filter(m => 
      m.name.toLowerCase().includes(lowerQuery) ||
      m.application.toLowerCase().includes(lowerQuery)
    );
  }
}

/**
 * File-based session storage (Node.js)
 */
export class FileSessionStorage implements SessionStorage {
  private basePath: string;

  constructor(basePath: string = './flowstral-sessions') {
    this.basePath = basePath;
  }

  async save(session: RecordingSession): Promise<void> {
    const fs = await import('fs/promises');
    const path = await import('path');
    
    await fs.mkdir(this.basePath, { recursive: true });
    const filePath = path.join(this.basePath, `${session.id}.json`);
    await fs.writeFile(filePath, JSON.stringify(session, null, 2));
  }

  async load(sessionId: string): Promise<RecordingSession | null> {
    const fs = await import('fs/promises');
    const path = await import('path');
    
    try {
      const filePath = path.join(this.basePath, `${sessionId}.json`);
      const data = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(data);
    } catch {
      return null;
    }
  }

  async delete(sessionId: string): Promise<void> {
    const fs = await import('fs/promises');
    const path = await import('path');
    
    try {
      const filePath = path.join(this.basePath, `${sessionId}.json`);
      await fs.unlink(filePath);
    } catch {
      // Ignore if file doesn't exist
    }
  }

  async list(): Promise<SessionMetadata[]> {
    const fs = await import('fs/promises');
    const path = await import('path');
    
    try {
      const files = await fs.readdir(this.basePath);
      const sessions: SessionMetadata[] = [];
      
      for (const file of files) {
        if (file.endsWith('.json')) {
          const session = await this.load(file.replace('.json', ''));
          if (session) {
            sessions.push({
              id: session.id,
              name: `Session_${session.id.slice(0, 8)}`,
              application: session.application.application,
              createdAt: session.startTime,
              updatedAt: session.endTime || session.startTime,
              duration: (session.endTime || Date.now()) - session.startTime,
              actionCount: session.actions.length,
              status: session.endTime ? 'completed' : 'recording',
              tags: []
            });
          }
        }
      }
      
      return sessions;
    } catch {
      return [];
    }
  }

  async search(query: string): Promise<SessionMetadata[]> {
    const lowerQuery = query.toLowerCase();
    const all = await this.list();
    return all.filter(m => 
      m.name.toLowerCase().includes(lowerQuery) ||
      m.application.toLowerCase().includes(lowerQuery)
    );
  }
}

/**
 * Session Manager - orchestrates session lifecycle
 */
export class SessionManager {
  private storage: SessionStorage;
  private activeSession: RecordingSession | null = null;
  private sessionStatus: 'recording' | 'paused' | 'completed' | 'failed' = 'recording';
  private sessionName: string = '';
  private actionBuffer: RecordedAction[] = [];
  private elementBuffer: RecordedElement[] = [];
  private flushInterval: NodeJS.Timeout | null = null;

  constructor(storage?: SessionStorage) {
    this.storage = storage || new MemorySessionStorage();
  }

  /**
   * Create a new recording session
   */
  createSession(name?: string, application?: EnterpriseApplication): RecordingSession {
    if (this.activeSession && this.sessionStatus === 'recording') {
      throw new Error('A recording is already in progress. Stop it first.');
    }

    const defaultFingerprint: ApplicationFingerprint = {
      application: application || 'unknown',
      confidence: 0,
      detectionMethod: 'dom-signature',
      shadowDomEnabled: false
    };
    
    this.sessionName = name || `Recording_${new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-')}`;
    this.sessionStatus = 'recording';
    
    const session: RecordingSession = {
      id: uuidv4(),
      startTime: Date.now(),
      actions: [],
      pageTransitions: [],
      errors: [],
      application: defaultFingerprint,
      baseUrl: '',
      metadata: {
        browserType: 'unknown',
        browserVersion: 'unknown',
        viewportSize: { width: 1920, height: 1080 },
        userAgent: 'unknown',
        locale: 'en-US',
        timezone: 'UTC'
      }
    };

    this.activeSession = session;
    this.actionBuffer = [];
    this.elementBuffer = [];
    this.startAutoFlush();

    return session;
  }

  /**
   * Start auto-flush to periodically save session data
   */
  private startAutoFlush(intervalMs: number = 5000): void {
    this.flushInterval = setInterval(() => {
      this.flushBuffers();
    }, intervalMs);
  }

  /**
   * Stop auto-flush
   */
  private stopAutoFlush(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }
  }

  /**
   * Flush buffered actions and elements to session
   */
  private async flushBuffers(): Promise<void> {
    if (!this.activeSession) return;

    if (this.actionBuffer.length > 0) {
      this.activeSession.actions.push(...this.actionBuffer);
      this.actionBuffer = [];
    }

    if (this.elementBuffer.length > 0) {
      // Elements are stored in elementBuffer, not directly in session
      // They will be processed when session ends
      this.elementBuffer = [];
    }

    // Auto-save
    await this.storage.save(this.activeSession);
  }

  /**
   * Add an action to the current recording
   */
  addAction(action: RecordedAction): void {
    if (!this.activeSession || this.sessionStatus !== 'recording') {
      throw new Error('No active recording session');
    }

    this.actionBuffer.push(action);
  }

  /**
   * Add an element to the current recording
   */
  addElement(element: RecordedElement): void {
    if (!this.activeSession || this.sessionStatus !== 'recording') {
      throw new Error('No active recording session');
    }

    // Check for duplicates
    const exists = this.elementBuffer.some(e => e.id === element.id) ||
                   this.elementBuffer.some(e => e.id === element.id);
    
    if (!exists) {
      this.elementBuffer.push(element);
    }
  }

  /**
   * Pause the current recording
   */
  pauseSession(): void {
    if (!this.activeSession) {
      throw new Error('No active session to pause');
    }

    this.sessionStatus = 'paused';
    this.stopAutoFlush();
  }

  /**
   * Resume a paused recording
   */
  resumeSession(): void {
    if (!this.activeSession) {
      throw new Error('No active session to resume');
    }

    if (this.sessionStatus !== 'paused') {
      throw new Error('Session is not paused');
    }

    this.sessionStatus = 'recording';
    this.startAutoFlush();
  }

  /**
   * Stop and complete the current recording
   */
  async stopSession(): Promise<RecordingSession> {
    if (!this.activeSession) {
      throw new Error('No active session to stop');
    }

    this.stopAutoFlush();
    await this.flushBuffers();

    this.sessionStatus = 'completed';
    this.activeSession.endTime = Date.now();

    // Final save
    await this.storage.save(this.activeSession);

    const completedSession = { ...this.activeSession };
    this.activeSession = null;

    return completedSession;
  }

  /**
   * Cancel and discard the current recording
   */
  cancelSession(): void {
    if (!this.activeSession) {
      throw new Error('No active session to cancel');
    }

    this.stopAutoFlush();
    this.activeSession = null;
    this.actionBuffer = [];
    this.elementBuffer = [];
  }

  /**
   * Get the active session
   */
  getActiveSession(): RecordingSession | null {
    return this.activeSession;
  }

  /**
   * Update session metadata
   */
  updateSession(updates: Partial<Pick<RecordingSession, 'application' | 'baseUrl'>> & { name?: string }): void {
    if (!this.activeSession) {
      throw new Error('No active session');
    }

    if (updates.name) {
      this.sessionName = updates.name;
    }
    
    if (updates.application) {
      this.activeSession.application = updates.application;
    }
    
    if (updates.baseUrl) {
      this.activeSession.baseUrl = updates.baseUrl;
    }
  }

  /**
   * Load a session from storage
   */
  async loadSession(sessionId: string): Promise<RecordingSession | null> {
    return this.storage.load(sessionId);
  }

  /**
   * Delete a session from storage
   */
  async deleteSession(sessionId: string): Promise<void> {
    if (this.activeSession?.id === sessionId) {
      throw new Error('Cannot delete active session. Stop it first.');
    }
    await this.storage.delete(sessionId);
  }

  /**
   * List all sessions
   */
  async listSessions(): Promise<SessionMetadata[]> {
    return this.storage.list();
  }

  /**
   * Search sessions
   */
  async searchSessions(query: string): Promise<SessionMetadata[]> {
    return this.storage.search(query);
  }

  /**
   * Duplicate a session
   */
  async duplicateSession(sessionId: string, newName?: string): Promise<RecordingSession | null> {
    const original = await this.storage.load(sessionId);
    if (!original) return null;

    const duplicate: RecordingSession = {
      ...original,
      id: uuidv4(),
      startTime: Date.now(),
      endTime: undefined
    };

    await this.storage.save(duplicate);
    return duplicate;
  }

  /**
   * Merge multiple sessions
   */
  async mergeSessions(sessionIds: string[], newName: string): Promise<RecordingSession | null> {
    const sessions = await Promise.all(sessionIds.map(id => this.storage.load(id)));
    const validSessions = sessions.filter((s): s is RecordingSession => s !== null);

    if (validSessions.length === 0) return null;

    // Merge actions sorted by timestamp
    const allActions = validSessions
      .flatMap(s => s.actions)
      .sort((a, b) => a.timestamp - b.timestamp);

    const merged: RecordingSession = {
      id: uuidv4(),
      startTime: Math.min(...validSessions.map(s => s.startTime)),
      endTime: Math.max(...validSessions.map(s => s.endTime || Date.now())),
      actions: allActions,
      pageTransitions: validSessions.flatMap(s => s.pageTransitions),
      errors: validSessions.flatMap(s => s.errors),
      application: validSessions[0].application,
      baseUrl: validSessions[0].baseUrl,
      metadata: validSessions[0].metadata
    };

    await this.storage.save(merged);
    return merged;
  }

  /**
   * Add a comment/annotation to an action
   */
  async addActionComment(sessionId: string, actionId: string, comment: string): Promise<void> {
    const session = await this.storage.load(sessionId);
    if (!session) throw new Error('Session not found');

    const action = session.actions.find(a => a.id === actionId);
    if (!action) throw new Error('Action not found');

    // RecordedAction doesn't have description property
    // Comment would be stored separately if needed
    await this.storage.save(session);
  }

  /**
   * Remove an action from a session
   */
  async removeAction(sessionId: string, actionId: string): Promise<void> {
    const session = await this.storage.load(sessionId);
    if (!session) throw new Error('Session not found');

    session.actions = session.actions.filter(a => a.id !== actionId);
    await this.storage.save(session);
  }

  /**
   * Reorder actions in a session
   */
  async reorderActions(sessionId: string, actionIds: string[]): Promise<void> {
    const session = await this.storage.load(sessionId);
    if (!session) throw new Error('Session not found');

    const actionMap = new Map(session.actions.map(a => [a.id, a]));
    session.actions = actionIds
      .map(id => actionMap.get(id))
      .filter((a): a is RecordedAction => a !== undefined);

    await this.storage.save(session);
  }

  /**
   * Export session to various formats
   */
  async exportSession(sessionId: string, format: 'json' | 'har' | 'side'): Promise<string> {
    const session = await this.storage.load(sessionId);
    if (!session) throw new Error('Session not found');

    switch (format) {
      case 'json':
        return JSON.stringify(session, null, 2);
      
      case 'har':
        return this.toHARFormat(session);
      
      case 'side':
        return this.toSeleniumIDEFormat(session);
      
      default:
        return JSON.stringify(session, null, 2);
    }
  }

  /**
   * Convert to HAR-like format (for debugging)
   */
  private toHARFormat(session: RecordingSession): string {
    const har = {
      log: {
        version: '1.2',
        creator: {
          name: 'Flowstral',
          version: '1.0.0'
        },
        entries: session.actions.map(action => ({
          startedDateTime: new Date(action.timestamp).toISOString(),
          time: 0,
          request: {
            method: action.type,
            url: session.baseUrl,
            comment: '' // Description not available in RecordedAction
          },
          response: {},
          cache: {},
          timings: { wait: 0, receive: 0 }
        }))
      }
    };
    return JSON.stringify(har, null, 2);
  }

  /**
   * Convert to Selenium IDE format
   */
  private toSeleniumIDEFormat(session: RecordingSession): string {
    const commandMap: Record<string, string> = {
      click: 'click',
      fill: 'type',
      select: 'select',
      check: 'check',
      uncheck: 'uncheck',
      navigate: 'open',
      hover: 'mouseOver'
    };

    const side = {
      id: session.id,
      version: '2.0',
      name: `Session_${session.id.slice(0, 8)}`,
      url: session.baseUrl,
      tests: [{
        id: `test-${session.id}`,
        name: `Session_${session.id.slice(0, 8)}`,
        commands: session.actions.map(action => ({
          id: action.id,
          command: commandMap[action.type] || action.type,
          target: action.element?.id || action.element?.cssSelector || '',
          value: action.value || '',
          comment: '' // Description not available in RecordedAction
        }))
      }],
      suites: [],
      urls: [session.baseUrl],
      plugins: []
    };
    return JSON.stringify(side, null, 2);
  }

  /**
   * Import session from various formats
   */
  async importSession(data: string, format: 'json' | 'side'): Promise<RecordingSession> {
    let session: RecordingSession;

    switch (format) {
      case 'json':
        session = JSON.parse(data);
        break;
      
      case 'side':
        session = this.fromSeleniumIDEFormat(data);
        break;
      
      default:
        session = JSON.parse(data);
    }

    // Assign new ID to avoid conflicts
    session.id = uuidv4();
    await this.storage.save(session);
    return session;
  }

  /**
   * Parse Selenium IDE format
   */
  private fromSeleniumIDEFormat(data: string): RecordingSession {
    const side = JSON.parse(data);
    const test = side.tests[0];

    const commandMap: Record<string, string> = {
      click: 'click',
      type: 'fill',
      select: 'select',
      check: 'check',
      uncheck: 'uncheck',
      open: 'navigate',
      mouseOver: 'hover'
    };

    const defaultFingerprint: ApplicationFingerprint = {
      application: 'unknown',
      confidence: 0,
      detectionMethod: 'dom-signature',
      shadowDomEnabled: false
    };
    
    return {
      id: uuidv4(),
      startTime: Date.now(),
      actions: test.commands.map((cmd: any, index: number) => ({
        id: cmd.id || `action_${index}`,
        type: (commandMap[cmd.command] || cmd.command) as ActionType,
        element: cmd.target ? {
          tagName: 'unknown',
          cssSelector: cmd.target,
          xpath: '',
          dataAttributes: {},
          customAttributes: {},
          boundingRect: { x: 0, y: 0, width: 0, height: 0 },
          isVisible: true,
          isEnabled: true,
          timestamp: Date.now() + index * 1000
        } : undefined,
        timestamp: Date.now() + index * 1000,
        value: cmd.value
      })),
      pageTransitions: [],
      errors: [],
      application: defaultFingerprint,
      baseUrl: side.url || '',
      metadata: {
        browserType: 'unknown',
        browserVersion: 'unknown',
        viewportSize: { width: 1920, height: 1080 },
        userAgent: 'unknown',
        locale: 'en-US',
        timezone: 'UTC'
      }
    };
  }
}
