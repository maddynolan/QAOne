/**
 * Cloud Connector
 * 
 * Manages WebSocket connection to Flowstral Cloud or On-Prem server.
 * Handles real-time communication, action streaming, and remote control.
 */

const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');

class CloudConnector {
  constructor(options = {}) {
    this.serverUrl = options.serverUrl || 'https://qaone-production.up.railway.app';
    this.deviceId = options.deviceId;
    this.licenseKey = options.licenseKey;
    this.onMessage = options.onMessage || (() => {});
    this.onStatusChange = options.onStatusChange || (() => {});
    
    this.ws = null;
    this.connected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
    this.reconnectDelay = 1000;
    this.heartbeatInterval = null;
    this.messageQueue = [];
    this.pendingRequests = new Map();
  }

  /**
   * Get WebSocket URL from HTTP URL
   */
  getWebSocketUrl() {
    const url = new URL(this.serverUrl);
    const protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${url.host}/ws/agent`;
  }

  /**
   * Connect to the server
   */
  async connect() {
    if (this.connected) {
      return true;
    }

    return new Promise((resolve, reject) => {
      try {
        const wsUrl = this.getWebSocketUrl();
        console.log(`[Cloud] Connecting to ${wsUrl}...`);

        this.ws = new WebSocket(wsUrl, {
          headers: {
            'X-Device-ID': this.deviceId,
            'X-License-Key': this.licenseKey,
            'X-Agent-Version': require('../../package.json').version
          }
        });

        this.ws.on('open', () => {
          console.log('[Cloud] Connected');
          this.connected = true;
          this.reconnectAttempts = 0;
          this.onStatusChange('connected');
          
          // Send registration message
          this.send({
            type: 'register',
            data: {
              deviceId: this.deviceId,
              platform: process.platform,
              version: require('../../package.json').version
            }
          });

          // Start heartbeat
          this.startHeartbeat();
          
          // Flush queued messages
          this.flushQueue();
          
          resolve(true);
        });

        this.ws.on('message', (data) => {
          try {
            const message = JSON.parse(data.toString());
            this.handleMessage(message);
          } catch (error) {
            console.error('[Cloud] Invalid message:', error);
          }
        });

        this.ws.on('close', (code, reason) => {
          console.log(`[Cloud] Disconnected: ${code} ${reason}`);
          this.connected = false;
          this.onStatusChange('disconnected');
          this.stopHeartbeat();
          
          // Attempt reconnection
          if (code !== 1000 && this.reconnectAttempts < this.maxReconnectAttempts) {
            this.scheduleReconnect();
          }
        });

        this.ws.on('error', (error) => {
          console.error('[Cloud] Error:', error.message);
          this.onStatusChange('error');
          reject(error);
        });

      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Disconnect from server
   */
  async disconnect() {
    this.stopHeartbeat();
    
    if (this.ws) {
      this.ws.close(1000, 'User disconnect');
      this.ws = null;
    }
    
    this.connected = false;
    this.onStatusChange('disconnected');
  }

  /**
   * Send a message to the server
   */
  send(message) {
    const msg = {
      id: uuidv4(),
      timestamp: Date.now(),
      ...message
    };

    if (this.connected && this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    } else {
      // Queue message for later
      this.messageQueue.push(msg);
    }

    return msg.id;
  }

  /**
   * Send and wait for response
   */
  async request(message, timeout = 30000) {
    return new Promise((resolve, reject) => {
      const id = this.send({ ...message, expectResponse: true });
      
      const timer = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error('Request timeout'));
      }, timeout);

      this.pendingRequests.set(id, { resolve, reject, timer });
    });
  }

  /**
   * Handle incoming message
   */
  handleMessage(message) {
    // Handle response to pending request
    if (message.responseToId && this.pendingRequests.has(message.responseToId)) {
      const { resolve, timer } = this.pendingRequests.get(message.responseToId);
      clearTimeout(timer);
      this.pendingRequests.delete(message.responseToId);
      resolve(message);
      return;
    }

    // Handle different message types
    switch (message.type) {
      case 'pong':
        // Heartbeat response, ignore
        break;
        
      case 'start-recording':
      case 'stop-recording':
      case 'execute-test':
      case 'execute-step':
        this.onMessage(message);
        break;
        
      case 'config-update':
        console.log('[Cloud] Config update received');
        this.onMessage(message);
        break;
        
      case 'force-disconnect':
        console.log('[Cloud] Force disconnect received');
        this.disconnect();
        break;
        
      default:
        this.onMessage(message);
    }
  }

  /**
   * Send recorded action to cloud
   */
  sendAction(action) {
    this.send({
      type: 'action',
      data: action
    });
  }

  /**
   * Send status update to cloud
   */
  sendStatus(status, data = {}) {
    this.send({
      type: 'status',
      status,
      data
    });
  }

  /**
   * Send screenshot to cloud
   */
  sendScreenshot(screenshot) {
    this.send({
      type: 'screenshot',
      data: screenshot
    });
  }

  /**
   * Start heartbeat to keep connection alive
   */
  startHeartbeat() {
    this.stopHeartbeat();
    
    this.heartbeatInterval = setInterval(() => {
      if (this.connected) {
        this.send({ type: 'ping' });
      }
    }, 30000);
  }

  /**
   * Stop heartbeat
   */
  stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  /**
   * Flush queued messages
   */
  flushQueue() {
    while (this.messageQueue.length > 0 && this.connected) {
      const msg = this.messageQueue.shift();
      this.ws.send(JSON.stringify(msg));
    }
  }

  /**
   * Schedule reconnection
   */
  scheduleReconnect() {
    this.reconnectAttempts++;
    const delay = Math.min(this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1), 30000);
    
    console.log(`[Cloud] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
    this.onStatusChange('reconnecting');
    
    setTimeout(() => {
      this.connect().catch(() => {
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
          this.scheduleReconnect();
        } else {
          console.log('[Cloud] Max reconnection attempts reached');
          this.onStatusChange('failed');
        }
      });
    }, delay);
  }

  /**
   * Check if connected
   */
  isConnected() {
    return this.connected;
  }
}

module.exports = CloudConnector;

