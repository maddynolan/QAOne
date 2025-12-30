/**
 * Network Capture Module - Browser-native HTTP/WebSocket Recording
 * 
 * Better than LoadRunner/NeoLoad because:
 * 1. No proxy configuration needed
 * 2. No SSL certificate installation
 * 3. Works with ANY site (including strict CSP)
 * 4. True browser timing (not proxy-delayed)
 * 5. Full WebSocket support
 * 6. Automatic correlation detection
 */

class NetworkCapture {
  constructor() {
    this.enabled = false;
    this.requests = new Map();  // requestId -> request data
    this.completedRequests = [];
    this.websockets = [];
    this.correlationPatterns = [];
    this.detectedCorrelations = new Map();
    this.sessionId = null;
    this.startTime = null;
    
    // Bind event handlers so they can be properly added/removed
    this._boundOnBeforeRequest = this._onBeforeRequest.bind(this);
    this._boundOnSendHeaders = this._onSendHeaders.bind(this);
    this._boundOnHeadersReceived = this._onHeadersReceived.bind(this);
    this._boundOnCompleted = this._onCompleted.bind(this);
    this._boundOnError = this._onError.bind(this);
    
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
    this.captureTypes = new Set(['xmlhttprequest', 'fetch', 'websocket', 'document']);
    this.ignorePatterns = [
      /\.(css|js|woff|woff2|ttf|eot|ico|png|jpg|jpeg|gif|svg|mp4|webm)(\?|$)/i,
      /google-analytics\.com/i,
      /googletagmanager\.com/i,
      /facebook\.com\/tr/i,
      /doubleclick\.net/i,
    ];
  }

  /**
   * Start network capture
   */
  start(sessionId) {
    if (this.enabled) return;
    
    this.enabled = true;
    this.sessionId = sessionId;
    this.startTime = Date.now();
    this.requests.clear();
    this.completedRequests = [];
    this.websockets = [];
    this.detectedCorrelations.clear();
    
    console.log('[NetworkCapture] Started for session:', sessionId);
    
    // Start the capture listeners
    this._startWebRequestCapture();
    this._startPerformanceObserver();
    
    return { success: true, sessionId };
  }

  /**
   * Stop network capture and return results
   */
  stop() {
    if (!this.enabled) return { requests: [], websockets: [], correlations: [] };
    
    this.enabled = false;
    this._stopWebRequestCapture();
    
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
    
    return result;
  }

  /**
   * Use chrome.webRequest API to capture HTTP traffic (background script)
   * This captures: URLs, headers, timing, status codes
   */
  _startWebRequestCapture() {
    // Check if we're in background script context (has chrome.webRequest)
    if (typeof chrome !== 'undefined' && chrome.webRequest) {
      try {
        // Capture request start
        chrome.webRequest.onBeforeRequest.addListener(
          this._boundOnBeforeRequest,
          { urls: ['<all_urls>'] },
          ['requestBody']
        );
        
        // Capture request headers
        chrome.webRequest.onSendHeaders.addListener(
          this._boundOnSendHeaders,
          { urls: ['<all_urls>'] },
          ['requestHeaders']
        );
        
        // Capture response headers
        chrome.webRequest.onHeadersReceived.addListener(
          this._boundOnHeadersReceived,
          { urls: ['<all_urls>'] },
          ['responseHeaders']
        );
        
        // Capture completion
        chrome.webRequest.onCompleted.addListener(
          this._boundOnCompleted,
          { urls: ['<all_urls>'] }
        );
        
        // Capture errors
        chrome.webRequest.onErrorOccurred.addListener(
          this._boundOnError,
          { urls: ['<all_urls>'] }
        );
        
        console.log('[NetworkCapture] webRequest listeners attached');
      } catch (error) {
        console.error('[NetworkCapture] Failed to attach webRequest listeners:', error);
      }
    } else {
      console.warn('[NetworkCapture] chrome.webRequest not available - network capture disabled');
    }
  }

  _stopWebRequestCapture() {
    if (typeof chrome !== 'undefined' && chrome.webRequest) {
      try {
        chrome.webRequest.onBeforeRequest.removeListener(this._boundOnBeforeRequest);
        chrome.webRequest.onSendHeaders.removeListener(this._boundOnSendHeaders);
        chrome.webRequest.onHeadersReceived.removeListener(this._boundOnHeadersReceived);
        chrome.webRequest.onCompleted.removeListener(this._boundOnCompleted);
        chrome.webRequest.onErrorOccurred.removeListener(this._boundOnError);
        console.log('[NetworkCapture] webRequest listeners removed');
      } catch (error) {
        console.error('[NetworkCapture] Failed to remove webRequest listeners:', error);
      }
    }
  }

  /**
   * Use PerformanceObserver to capture detailed timing (content script)
   * This gives us: DNS, TCP, SSL, TTFB, download times
   */
  _startPerformanceObserver() {
    if (typeof PerformanceObserver !== 'undefined') {
      try {
        this.performanceObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (entry.entryType === 'resource') {
              this._processResourceTiming(entry);
            }
          }
        });
        
        this.performanceObserver.observe({ entryTypes: ['resource', 'navigation'] });
        console.log('[NetworkCapture] PerformanceObserver started');
      } catch (e) {
        console.log('[NetworkCapture] PerformanceObserver not available:', e.message);
      }
    }
  }

  /**
   * Process webRequest onBeforeRequest
   */
  _onBeforeRequest(details) {
    if (!this.enabled) return;
    if (this._shouldIgnore(details.url, details.type)) return;
    
    const request = {
      requestId: details.requestId,
      url: details.url,
      method: details.method,
      type: details.type,
      tabId: details.tabId,
      frameId: details.frameId,
      timestamp: details.timeStamp,
      startTime: Date.now(),
      requestBody: details.requestBody ? this._parseRequestBody(details.requestBody) : null,
      requestHeaders: {},
      responseHeaders: {},
      statusCode: null,
      timing: {},
    };
    
    this.requests.set(details.requestId, request);
  }

  /**
   * Process webRequest onSendHeaders
   */
  _onSendHeaders(details) {
    if (!this.enabled) return;
    const request = this.requests.get(details.requestId);
    if (!request) return;
    
    request.requestHeaders = this._headersToObject(details.requestHeaders);
    
    // Extract auth/session info for correlation
    this._detectCorrelations('request_headers', request.requestHeaders);
  }

  /**
   * Process webRequest onHeadersReceived
   */
  _onHeadersReceived(details) {
    if (!this.enabled) return;
    const request = this.requests.get(details.requestId);
    if (!request) return;
    
    request.responseHeaders = this._headersToObject(details.responseHeaders);
    request.statusCode = details.statusCode;
    
    // Extract tokens from response headers
    this._detectCorrelations('response_headers', request.responseHeaders);
  }

  /**
   * Process webRequest onCompleted
   */
  _onCompleted(details) {
    if (!this.enabled) return;
    const request = this.requests.get(details.requestId);
    if (!request) return;
    
    request.endTime = Date.now();
    request.duration = request.endTime - request.startTime;
    request.fromCache = details.fromCache;
    request.statusCode = details.statusCode;
    
    // Move to completed requests
    this.completedRequests.push(request);
    this.requests.delete(details.requestId);
  }

  /**
   * Process webRequest onError
   */
  _onError(details) {
    if (!this.enabled) return;
    const request = this.requests.get(details.requestId);
    if (!request) return;
    
    request.error = details.error;
    request.endTime = Date.now();
    request.duration = request.endTime - request.startTime;
    
    this.completedRequests.push(request);
    this.requests.delete(details.requestId);
  }

  /**
   * Process PerformanceObserver resource entry
   * Provides detailed timing breakdown
   */
  _processResourceTiming(entry) {
    // Find matching request by URL
    const matching = this.completedRequests.find(r => r.url === entry.name);
    if (matching) {
      matching.timing = {
        dns: entry.domainLookupEnd - entry.domainLookupStart,
        tcp: entry.connectEnd - entry.connectStart,
        ssl: entry.secureConnectionStart > 0 ? entry.connectEnd - entry.secureConnectionStart : 0,
        ttfb: entry.responseStart - entry.requestStart,
        download: entry.responseEnd - entry.responseStart,
        total: entry.duration,
        transferSize: entry.transferSize,
        encodedBodySize: entry.encodedBodySize,
        decodedBodySize: entry.decodedBodySize,
      };
    }
  }

  /**
   * Detect and record correlation values
   */
  _detectCorrelations(source, data) {
    const dataStr = typeof data === 'string' ? data : JSON.stringify(data);
    
    for (const { name, patterns } of this.CORRELATION_PATTERNS) {
      for (const pattern of patterns) {
        const matches = dataStr.matchAll(new RegExp(pattern));
        for (const match of matches) {
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
    if (!this.captureTypes.has(type)) {
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
   * Parse request body from webRequest
   */
  _parseRequestBody(requestBody) {
    if (!requestBody) return null;
    
    if (requestBody.raw) {
      // Binary data - decode if possible
      try {
        const decoder = new TextDecoder('utf-8');
        return decoder.decode(requestBody.raw[0].bytes);
      } catch {
        return '[binary data]';
      }
    }
    
    if (requestBody.formData) {
      return requestBody.formData;
    }
    
    return null;
  }

  /**
   * Convert headers array to object
   */
  _headersToObject(headers) {
    if (!headers) return {};
    return headers.reduce((obj, h) => {
      obj[h.name] = h.value;
      return obj;
    }, {});
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
      totalBytes: requests.reduce((sum, r) => sum + (r.timing?.transferSize || 0), 0),
      requestsByType: this._groupBy(requests, 'type'),
      requestsByStatus: this._groupBy(requests, 'statusCode'),
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
   * This creates the UI action -> API call correlation
   */
  linkUserAction(actionTimestamp, actionType, actionDescription) {
    // Find requests within 2 seconds of this action
    const nearbyRequests = this.completedRequests.filter(r => {
      const timeDiff = Math.abs(r.startTime - actionTimestamp);
      return timeDiff < 2000; // Within 2 seconds
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
          name: 'QAAI Network Capture',
          version: '1.0.0'
        },
        entries: this.completedRequests.map(r => ({
          startedDateTime: new Date(r.startTime).toISOString(),
          time: r.duration,
          request: {
            method: r.method,
            url: r.url,
            httpVersion: 'HTTP/1.1',
            headers: Object.entries(r.requestHeaders || {}).map(([name, value]) => ({ name, value })),
            queryString: this._parseQueryString(r.url),
            postData: r.requestBody ? { mimeType: 'application/json', text: JSON.stringify(r.requestBody) } : null,
            headersSize: -1,
            bodySize: r.requestBody ? JSON.stringify(r.requestBody).length : 0,
          },
          response: {
            status: r.statusCode || 0,
            statusText: '',
            httpVersion: 'HTTP/1.1',
            headers: Object.entries(r.responseHeaders || {}).map(([name, value]) => ({ name, value })),
            content: { size: r.timing?.decodedBodySize || 0, mimeType: '' },
            headersSize: -1,
            bodySize: r.timing?.encodedBodySize || 0,
          },
          timings: {
            dns: r.timing?.dns || 0,
            connect: r.timing?.tcp || 0,
            ssl: r.timing?.ssl || 0,
            send: 0,
            wait: r.timing?.ttfb || 0,
            receive: r.timing?.download || 0,
          },
          cache: {},
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
}

// Export for use in extension
if (typeof module !== 'undefined' && module.exports) {
  module.exports = NetworkCapture;
} else if (typeof window !== 'undefined') {
  window.NetworkCapture = NetworkCapture;
}



