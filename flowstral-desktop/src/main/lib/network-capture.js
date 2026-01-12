/**
 * Network Capture Module for Desktop App - Electron-based HTTP/WebSocket Recording
 * 
 * Port of the browser extension's network-capture.js for Electron.
 * Uses Electron's webContents events and DevTools protocol instead of Chrome webRequest API.
 * 
 * Features:
 * 1. XHR/Fetch request capture
 * 2. WebSocket capture
 * 3. Request/response timing
 * 4. Automatic correlation detection (tokens, session IDs)
 * 5. HAR export
 */

const { EventEmitter } = require('events');

class NetworkCapture extends EventEmitter {
  constructor() {
    super();
    this.enabled = false;
    this.requests = new Map();  // requestId -> request data
    this.completedRequests = [];
    this.websockets = [];
    this.detectedCorrelations = new Map();
    this.sessionId = null;
    this.startTime = null;
    this.webContents = null;
    this.debuggerAttached = false;
    
    // Correlation patterns for auto-detection
    this.CORRELATION_PATTERNS = [
      { name: 'session_id', patterns: [/"session[_-]?id"\s*:\s*"([^"]+)"/gi, /sessionid=([^&;]+)/gi] },
      { name: 'auth_token', patterns: [/"(?:access_)?token"\s*:\s*"([^"]+)"/gi, /Bearer\s+([^\s"]+)/gi] },
      { name: 'csrf_token', patterns: [/"csrf[_-]?token"\s*:\s*"([^"]+)"/gi, /X-CSRF-TOKEN[:\s]+([^\s"]+)/gi] },
      { name: 'request_id', patterns: [/"request[_-]?id"\s*:\s*"([^"]+)"/gi, /X-Request-ID[:\s]+([^\s"]+)/gi] },
      { name: 'user_id', patterns: [/"user[_-]?id"\s*:\s*"([^"]+)"/gi] },
      { name: 'api_key', patterns: [/"api[_-]?key"\s*:\s*"([^"]+)"/gi, /X-API-KEY[:\s]+([^\s"]+)/gi] },
    ];
    
    // Request types to capture (filter out static assets by default)
    this.captureTypes = new Set(['XHR', 'Fetch', 'WebSocket', 'Document']);
    this.ignorePatterns = [
      /\.(css|js|woff|woff2|ttf|eot|ico|png|jpg|jpeg|gif|svg|mp4|webm)(\?|$)/i,
      /google-analytics\.com/i,
      /googletagmanager\.com/i,
      /facebook\.com\/tr/i,
      /doubleclick\.net/i,
    ];
  }

  /**
   * Start network capture for a webContents instance
   */
  async start(webContents, sessionId) {
    if (this.enabled) return { success: false, error: 'Already running' };
    
    this.enabled = true;
    this.webContents = webContents;
    this.sessionId = sessionId || `session_${Date.now()}`;
    this.startTime = Date.now();
    this.requests.clear();
    this.completedRequests = [];
    this.websockets = [];
    this.detectedCorrelations.clear();
    
    console.log('[NetworkCapture] Starting for session:', this.sessionId);
    
    try {
      // Attach debugger to capture network traffic
      await this._attachDebugger();
      
      // Enable network domain
      await this._sendDebuggerCommand('Network.enable', {});
      
      console.log('[NetworkCapture] Started successfully');
      return { success: true, sessionId: this.sessionId };
      
    } catch (error) {
      console.error('[NetworkCapture] Failed to start:', error.message);
      this.enabled = false;
      return { success: false, error: error.message };
    }
  }

  /**
   * Stop network capture and return results
   */
  async stop() {
    if (!this.enabled) {
      return { requests: [], websockets: [], correlations: [] };
    }
    
    this.enabled = false;
    
    try {
      // Disable network domain
      await this._sendDebuggerCommand('Network.disable', {}).catch(() => {});
      
      // Detach debugger
      await this._detachDebugger();
    } catch (e) {
      console.log('[NetworkCapture] Error during stop:', e.message);
    }
    
    const result = {
      sessionId: this.sessionId,
      startTime: this.startTime,
      endTime: Date.now(),
      duration: Date.now() - this.startTime,
      requests: [...this.completedRequests],
      websockets: [...this.websockets],
      correlations: Array.from(this.detectedCorrelations.entries()).map(([name, values]) => ({
        name,
        values: Array.from(values)
      })),
      statistics: this._calculateStatistics(),
    };
    
    console.log('[NetworkCapture] Stopped. Captured:', result.requests.length, 'requests');
    
    this.emit('capture-complete', result);
    
    return result;
  }

  /**
   * Attach Chrome DevTools Protocol debugger
   */
  async _attachDebugger() {
    if (this.debuggerAttached || !this.webContents) return;
    
    return new Promise((resolve, reject) => {
      try {
        this.webContents.debugger.attach('1.3');
        this.debuggerAttached = true;
        
        // Listen for debugger events
        this.webContents.debugger.on('message', (event, method, params) => {
          this._handleDebuggerMessage(method, params);
        });
        
        this.webContents.debugger.on('detach', (event, reason) => {
          console.log('[NetworkCapture] Debugger detached:', reason);
          this.debuggerAttached = false;
        });
        
        console.log('[NetworkCapture] Debugger attached');
        resolve();
        
      } catch (error) {
        if (error.message.includes('Another debugger is already attached')) {
          console.log('[NetworkCapture] Debugger already attached');
          this.debuggerAttached = true;
          resolve();
        } else {
          reject(error);
        }
      }
    });
  }

  /**
   * Detach debugger
   */
  async _detachDebugger() {
    if (!this.debuggerAttached || !this.webContents) return;
    
    try {
      this.webContents.debugger.detach();
      this.debuggerAttached = false;
      console.log('[NetworkCapture] Debugger detached');
    } catch (e) {
      console.log('[NetworkCapture] Debugger detach error:', e.message);
    }
  }

  /**
   * Send command via debugger
   */
  async _sendDebuggerCommand(method, params) {
    if (!this.webContents || !this.debuggerAttached) {
      throw new Error('Debugger not attached');
    }
    
    return new Promise((resolve, reject) => {
      this.webContents.debugger.sendCommand(method, params, (error, result) => {
        if (error) {
          reject(new Error(error.message || error));
        } else {
          resolve(result);
        }
      });
    });
  }

  /**
   * Handle debugger protocol messages
   */
  _handleDebuggerMessage(method, params) {
    if (!this.enabled) return;
    
    switch (method) {
      case 'Network.requestWillBeSent':
        this._onRequestWillBeSent(params);
        break;
        
      case 'Network.responseReceived':
        this._onResponseReceived(params);
        break;
        
      case 'Network.loadingFinished':
        this._onLoadingFinished(params);
        break;
        
      case 'Network.loadingFailed':
        this._onLoadingFailed(params);
        break;
        
      case 'Network.webSocketCreated':
        this._onWebSocketCreated(params);
        break;
        
      case 'Network.webSocketFrameSent':
      case 'Network.webSocketFrameReceived':
        this._onWebSocketFrame(params, method);
        break;
        
      case 'Network.webSocketClosed':
        this._onWebSocketClosed(params);
        break;
    }
  }

  /**
   * Network.requestWillBeSent
   */
  _onRequestWillBeSent(params) {
    const { requestId, request, timestamp, type, initiator } = params;
    
    if (this._shouldIgnore(request.url, type)) return;
    
    const requestData = {
      requestId,
      url: request.url,
      method: request.method,
      type: type || 'Other',
      timestamp: timestamp * 1000,
      startTime: Date.now(),
      requestHeaders: request.headers || {},
      postData: request.postData,
      initiator: initiator?.type,
      responseHeaders: {},
      statusCode: null,
      timing: {},
    };
    
    this.requests.set(requestId, requestData);
    
    // Detect correlations in request headers
    this._detectCorrelations('request_headers', requestData.requestHeaders);
    if (requestData.postData) {
      this._detectCorrelations('request_body', requestData.postData);
    }
    
    this.emit('request-start', requestData);
  }

  /**
   * Network.responseReceived
   */
  _onResponseReceived(params) {
    const { requestId, response, timestamp, type } = params;
    
    const requestData = this.requests.get(requestId);
    if (!requestData) return;
    
    requestData.statusCode = response.status;
    requestData.statusText = response.statusText;
    requestData.responseHeaders = response.headers || {};
    requestData.mimeType = response.mimeType;
    requestData.protocol = response.protocol;
    requestData.fromCache = response.fromDiskCache || response.fromServiceWorker;
    
    // Extract timing info
    if (response.timing) {
      requestData.timing = {
        dns: response.timing.dnsEnd - response.timing.dnsStart,
        tcp: response.timing.connectEnd - response.timing.connectStart,
        ssl: response.timing.sslEnd > 0 ? response.timing.sslEnd - response.timing.sslStart : 0,
        ttfb: response.timing.receiveHeadersEnd - response.timing.sendStart,
        send: response.timing.sendEnd - response.timing.sendStart,
      };
    }
    
    // Detect correlations in response headers
    this._detectCorrelations('response_headers', requestData.responseHeaders);
    
    this.emit('response-received', requestData);
  }

  /**
   * Network.loadingFinished
   */
  _onLoadingFinished(params) {
    const { requestId, timestamp, encodedDataLength } = params;
    
    const requestData = this.requests.get(requestId);
    if (!requestData) return;
    
    requestData.endTime = Date.now();
    requestData.duration = requestData.endTime - requestData.startTime;
    requestData.encodedDataLength = encodedDataLength;
    
    // Move to completed
    this.completedRequests.push(requestData);
    this.requests.delete(requestId);
    
    this.emit('request-complete', requestData);
  }

  /**
   * Network.loadingFailed
   */
  _onLoadingFailed(params) {
    const { requestId, timestamp, errorText, canceled } = params;
    
    const requestData = this.requests.get(requestId);
    if (!requestData) return;
    
    requestData.endTime = Date.now();
    requestData.duration = requestData.endTime - requestData.startTime;
    requestData.error = errorText;
    requestData.canceled = canceled;
    
    this.completedRequests.push(requestData);
    this.requests.delete(requestId);
    
    this.emit('request-failed', requestData);
  }

  /**
   * Network.webSocketCreated
   */
  _onWebSocketCreated(params) {
    const { requestId, url, initiator } = params;
    
    this.websockets.push({
      requestId,
      url,
      initiator: initiator?.type,
      createdAt: Date.now(),
      frames: [],
      closed: false,
    });
    
    this.emit('websocket-created', { requestId, url });
  }

  /**
   * WebSocket frame sent/received
   */
  _onWebSocketFrame(params, method) {
    const { requestId, timestamp, response } = params;
    
    const ws = this.websockets.find(w => w.requestId === requestId);
    if (!ws) return;
    
    ws.frames.push({
      direction: method === 'Network.webSocketFrameSent' ? 'sent' : 'received',
      timestamp: timestamp * 1000,
      opcode: response.opcode,
      payloadData: response.payloadData,
    });
    
    // Detect correlations in WebSocket data
    if (response.payloadData) {
      this._detectCorrelations('websocket', response.payloadData);
    }
  }

  /**
   * Network.webSocketClosed
   */
  _onWebSocketClosed(params) {
    const { requestId, timestamp } = params;
    
    const ws = this.websockets.find(w => w.requestId === requestId);
    if (!ws) return;
    
    ws.closed = true;
    ws.closedAt = timestamp * 1000;
    
    this.emit('websocket-closed', { requestId });
  }

  /**
   * Detect and record correlation values
   */
  _detectCorrelations(source, data) {
    const dataStr = typeof data === 'string' ? data : JSON.stringify(data);
    
    for (const { name, patterns } of this.CORRELATION_PATTERNS) {
      for (const pattern of patterns) {
        const regex = new RegExp(pattern.source, pattern.flags);
        let match;
        while ((match = regex.exec(dataStr)) !== null) {
          if (match[1] && match[1].length > 5) {
            if (!this.detectedCorrelations.has(name)) {
              this.detectedCorrelations.set(name, new Set());
            }
            this.detectedCorrelations.get(name).add(match[1]);
          }
        }
      }
    }
  }

  /**
   * Check if URL should be ignored
   */
  _shouldIgnore(url, type) {
    // Check type
    if (type && !this.captureTypes.has(type)) {
      return true;
    }
    
    // Check ignore patterns
    for (const pattern of this.ignorePatterns) {
      if (pattern.test(url)) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * Calculate statistics
   */
  _calculateStatistics() {
    const requests = this.completedRequests;
    if (requests.length === 0) return {};
    
    const durations = requests.map(r => r.duration).filter(d => d > 0);
    const successful = requests.filter(r => r.statusCode >= 200 && r.statusCode < 400);
    const failed = requests.filter(r => r.statusCode >= 400 || r.error);
    
    return {
      totalRequests: requests.length,
      successfulRequests: successful.length,
      failedRequests: failed.length,
      successRate: requests.length > 0 ? (successful.length / requests.length * 100).toFixed(1) : 0,
      avgDuration: durations.length > 0 ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : 0,
      minDuration: durations.length > 0 ? Math.min(...durations) : 0,
      maxDuration: durations.length > 0 ? Math.max(...durations) : 0,
      p50Duration: this._percentile(durations, 50),
      p90Duration: this._percentile(durations, 90),
      p95Duration: this._percentile(durations, 95),
      p99Duration: this._percentile(durations, 99),
      totalBytes: requests.reduce((sum, r) => sum + (r.encodedDataLength || 0), 0),
      requestsByType: this._groupBy(requests, 'type'),
      requestsByStatus: this._groupBy(requests, 'statusCode'),
      websocketCount: this.websockets.length,
      websocketFrames: this.websockets.reduce((sum, ws) => sum + ws.frames.length, 0),
    };
  }

  _percentile(arr, p) {
    if (arr.length === 0) return 0;
    const sorted = [...arr].sort((a, b) => a - b);
    const index = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
  }

  _groupBy(arr, key) {
    return arr.reduce((acc, item) => {
      const val = item[key];
      acc[val] = (acc[val] || 0) + 1;
      return acc;
    }, {});
  }

  /**
   * Link a user action to nearby HTTP requests
   */
  linkUserAction(actionTimestamp, actionType, actionDescription) {
    const nearbyRequests = this.completedRequests.filter(r => {
      const timeDiff = Math.abs(r.startTime - actionTimestamp);
      return timeDiff < 2000;
    });
    
    return nearbyRequests.map(r => ({
      ...r,
      triggeredBy: {
        type: actionType,
        description: actionDescription,
        timestamp: actionTimestamp,
      }
    }));
  }

  /**
   * Export as HAR (HTTP Archive) format
   */
  exportAsHAR() {
    return {
      log: {
        version: '1.2',
        creator: {
          name: 'QAAI Desktop Network Capture',
          version: '1.0.0'
        },
        entries: this.completedRequests.map(r => ({
          startedDateTime: new Date(r.startTime).toISOString(),
          time: r.duration,
          request: {
            method: r.method,
            url: r.url,
            httpVersion: r.protocol || 'HTTP/1.1',
            headers: Object.entries(r.requestHeaders || {}).map(([name, value]) => ({ name, value })),
            queryString: this._parseQueryString(r.url),
            postData: r.postData ? { mimeType: 'application/json', text: r.postData } : null,
            headersSize: -1,
            bodySize: r.postData ? r.postData.length : 0,
          },
          response: {
            status: r.statusCode || 0,
            statusText: r.statusText || '',
            httpVersion: r.protocol || 'HTTP/1.1',
            headers: Object.entries(r.responseHeaders || {}).map(([name, value]) => ({ name, value })),
            content: { size: r.encodedDataLength || 0, mimeType: r.mimeType || '' },
            headersSize: -1,
            bodySize: r.encodedDataLength || 0,
          },
          timings: {
            dns: r.timing?.dns || 0,
            connect: r.timing?.tcp || 0,
            ssl: r.timing?.ssl || 0,
            send: r.timing?.send || 0,
            wait: r.timing?.ttfb || 0,
            receive: 0,
          },
          cache: { fromCache: r.fromCache || false },
        })),
      },
    };
  }

  _parseQueryString(url) {
    try {
      const urlObj = new URL(url);
      return Array.from(urlObj.searchParams.entries()).map(([name, value]) => ({ name, value }));
    } catch {
      return [];
    }
  }

  /**
   * Get current capture status
   */
  getStatus() {
    return {
      enabled: this.enabled,
      sessionId: this.sessionId,
      requestCount: this.completedRequests.length,
      pendingCount: this.requests.size,
      websocketCount: this.websockets.length,
      duration: this.startTime ? Date.now() - this.startTime : 0,
    };
  }
}

module.exports = NetworkCapture;

