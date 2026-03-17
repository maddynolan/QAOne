/**
 * Live Browser Stream WebSocket Hook
 *
 * Connects to the backend live-stream WebSocket and receives binary JPEG frames
 * at ~8 FPS. Uses double-buffered rendering (preload into hidden Image, swap
 * ObjectURL on onload) to prevent flicker.
 *
 * @example
 *   const { frameUrl, isConnected, isStreaming, frameCount, connect, disconnect, setFps }
 *     = useLiveBrowserStream(sessionId);
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { API_BASE_URL } from '@/lib/api-config';

export interface LiveStreamState {
  /** Current frame as an ObjectURL (or null before first frame) */
  frameUrl: string | null;
  /** WebSocket is connected */
  isConnected: boolean;
  /** Frames are actively arriving */
  isStreaming: boolean;
  /** Total frames received */
  frameCount: number;
  /** Connect to the stream */
  connect: () => void;
  /** Disconnect from the stream */
  disconnect: () => void;
  /** Adjust frame rate (1-15) */
  setFps: (fps: number) => void;
  /** Adjust JPEG quality (30-90) */
  setQuality: (quality: number) => void;
}

function buildWsUrl(sessionId: string): string {
  const wsBase = API_BASE_URL.replace('http://', 'ws://').replace('https://', 'wss://');
  return `${wsBase}/api/ai-testing/live-stream/${sessionId}`;
}

export function useLiveBrowserStream(sessionId: string | null): LiveStreamState {
  const [frameUrl, setFrameUrl] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [frameCount, setFrameCount] = useState(0);

  const wsRef = useRef<WebSocket | null>(null);
  const prevUrlRef = useRef<string | null>(null);
  const frameCountRef = useRef(0);
  const lastFrameTimeRef = useRef(0);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Clean up previous ObjectURL to avoid memory leaks
  const revokeOldUrl = useCallback(() => {
    if (prevUrlRef.current) {
      URL.revokeObjectURL(prevUrlRef.current);
      prevUrlRef.current = null;
    }
  }, []);

  const disconnect = useCallback(() => {
    // Clear reconnect timer
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    // Clear ping interval
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = null;
    }
    // Close WebSocket
    if (wsRef.current) {
      wsRef.current.onclose = null; // Prevent reconnect on intentional close
      wsRef.current.close();
      wsRef.current = null;
    }
    setIsConnected(false);
    setIsStreaming(false);
    revokeOldUrl();
  }, [revokeOldUrl]);

  const connect = useCallback(() => {
    if (!sessionId) return;

    // Don't reconnect if already connected to this session
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      return;
    }

    disconnect(); // Clean up any existing connection

    const url = buildWsUrl(sessionId);
    const ws = new WebSocket(url);
    ws.binaryType = 'blob'; // Zero-copy blob reception

    ws.onopen = () => {
      setIsConnected(true);
      frameCountRef.current = 0;
      setFrameCount(0);

      // Start ping interval (every 25s to stay within 30s heartbeat)
      pingIntervalRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'ping' }));
        }
      }, 25000);
    };

    ws.onmessage = (event) => {
      if (event.data instanceof Blob) {
        // Binary frame: JPEG image data
        const newUrl = URL.createObjectURL(event.data);

        // Double-buffered rendering: preload frame before displaying
        const img = new Image();
        img.onload = () => {
          revokeOldUrl();
          prevUrlRef.current = newUrl;
          setFrameUrl(newUrl);
          frameCountRef.current += 1;
          setFrameCount(frameCountRef.current);
          lastFrameTimeRef.current = Date.now();
          setIsStreaming(true);
        };
        img.onerror = () => {
          // Revoke failed blob URL
          URL.revokeObjectURL(newUrl);
        };
        img.src = newUrl;
      } else {
        // Text message: JSON control/status message
        try {
          const msg = JSON.parse(event.data);
          switch (msg.type) {
            case 'connected':
              // Server acknowledged connection
              break;
            case 'heartbeat':
            case 'pong':
              // Keep-alive, no action needed
              break;
            case 'error':
              console.warn('[LiveStream] Server error:', msg.message);
              break;
            case 'fps_updated':
            case 'quality_updated':
              // Confirmation of settings change
              break;
          }
        } catch {
          // Ignore malformed messages
        }
      }
    };

    ws.onclose = (event) => {
      setIsConnected(false);
      setIsStreaming(false);

      // Clear ping interval
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
        pingIntervalRef.current = null;
      }

      // Auto-reconnect on unexpected close (not code 1000 = normal)
      if (event.code !== 1000 && sessionId) {
        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, 2000);
      }
    };

    ws.onerror = () => {
      // onclose will fire after onerror, reconnect handled there
    };

    wsRef.current = ws;
  }, [sessionId, disconnect, revokeOldUrl]);

  const setFps = useCallback((fps: number) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'set_fps', fps: Math.max(1, Math.min(15, fps)) }));
    }
  }, []);

  const setQuality = useCallback((quality: number) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'set_quality', quality: Math.max(30, Math.min(90, quality)) }));
    }
  }, []);

  // Auto-detect stale stream (no frames for 5s = not streaming)
  useEffect(() => {
    if (!isStreaming) return;

    const checkInterval = setInterval(() => {
      if (Date.now() - lastFrameTimeRef.current > 5000) {
        setIsStreaming(false);
      }
    }, 3000);

    return () => clearInterval(checkInterval);
  }, [isStreaming]);

  // Auto-connect when sessionId changes
  useEffect(() => {
    if (sessionId) {
      connect();
    } else {
      disconnect();
    }

    return () => {
      disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      revokeOldUrl();
      disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    frameUrl,
    isConnected,
    isStreaming,
    frameCount,
    connect,
    disconnect,
    setFps,
    setQuality,
  };
}
