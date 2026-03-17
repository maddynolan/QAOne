/**
 * LiveBrowserView — Real-time browser viewport for Flowpilot AI agents.
 *
 * Shows a browser-chrome UI with:
 * - Traffic light dots + URL bar header
 * - Live JPEG frames from WebSocket at ~8 FPS (via useLiveBrowserStream)
 * - Connection status indicator (green pulse / yellow / gray)
 * - Current step overlay bar at bottom
 * - Fallback to SSE screenshot if WebSocket isn't connected
 * - Loading/offline placeholder states
 */

import React, { useMemo } from 'react';
import { useLiveBrowserStream } from '@/hooks/useLiveBrowserStream';
import { Monitor, WifiOff, Loader2, Eye, Wifi } from 'lucide-react';

interface LiveBrowserViewProps {
  /** Session ID for WebSocket connection (from stream_session SSE event) */
  sessionId: string | null;
  /** Fallback screenshot (base64 from SSE step events) when WS not available */
  fallbackScreenshot?: string | null;
  /** Current step description overlay */
  currentStep?: string | null;
  /** Current URL being tested */
  currentUrl?: string | null;
  /** Additional CSS class */
  className?: string;
}

export const LiveBrowserView: React.FC<LiveBrowserViewProps> = ({
  sessionId,
  fallbackScreenshot,
  currentStep,
  currentUrl,
  className = '',
}) => {
  const {
    frameUrl,
    isConnected,
    isStreaming,
    frameCount,
  } = useLiveBrowserStream(sessionId);

  // Determine which image source to show
  const displaySrc = useMemo(() => {
    if (frameUrl && isConnected) return frameUrl;
    if (fallbackScreenshot) {
      // Handle both raw base64 and data URI
      if (fallbackScreenshot.startsWith('data:')) return fallbackScreenshot;
      return `data:image/png;base64,${fallbackScreenshot}`;
    }
    return null;
  }, [frameUrl, isConnected, fallbackScreenshot]);

  // Connection status
  const status = isStreaming ? 'live' : isConnected ? 'connected' : sessionId ? 'connecting' : 'offline';

  return (
    <div className={`flex flex-col rounded-lg overflow-hidden border border-border bg-background shadow-sm ${className}`}>
      {/* Browser Chrome Header */}
      <div className="flex items-center gap-2 px-3 py-2 bg-muted/50 border-b border-border">
        {/* Traffic light dots */}
        <div className="flex gap-1.5">
          <div className="w-3 h-3 rounded-full bg-red-400" />
          <div className="w-3 h-3 rounded-full bg-yellow-400" />
          <div className="w-3 h-3 rounded-full bg-green-400" />
        </div>

        {/* URL bar */}
        <div className="flex-1 mx-2">
          <div className="flex items-center gap-2 px-3 py-1 rounded-md bg-background/80 border border-border text-xs text-muted-foreground font-mono truncate">
            <Monitor className="w-3 h-3 flex-shrink-0" />
            <span className="truncate">
              {currentUrl || 'about:blank'}
            </span>
          </div>
        </div>

        {/* Connection indicator */}
        <div className="flex items-center gap-1.5">
          {status === 'live' && (
            <>
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500" />
              </span>
              <span className="text-xs text-green-600 dark:text-green-400 font-medium">LIVE</span>
            </>
          )}
          {status === 'connected' && (
            <>
              <span className="relative flex h-2.5 w-2.5">
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-yellow-500" />
              </span>
              <span className="text-xs text-yellow-600 dark:text-yellow-400">Waiting...</span>
            </>
          )}
          {status === 'connecting' && (
            <>
              <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Connecting...</span>
            </>
          )}
          {status === 'offline' && (
            <>
              <WifiOff className="w-3 h-3 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Offline</span>
            </>
          )}

          {/* Frame counter (only when streaming) */}
          {isStreaming && frameCount > 0 && (
            <span className="text-[10px] text-muted-foreground ml-1 tabular-nums">
              {frameCount}f
            </span>
          )}
        </div>
      </div>

      {/* Viewport */}
      <div className="relative aspect-video bg-muted/30">
        {displaySrc ? (
          <img
            src={displaySrc}
            alt="Live browser view"
            className="w-full h-full object-contain"
            draggable={false}
          />
        ) : (
          /* Placeholder when no image */
          <div className="flex flex-col items-center justify-center w-full h-full gap-3 text-muted-foreground">
            {sessionId ? (
              <>
                <Loader2 className="w-8 h-8 animate-spin" />
                <span className="text-sm">Launching browser...</span>
              </>
            ) : (
              <>
                <Eye className="w-8 h-8 opacity-40" />
                <span className="text-sm">Browser view will appear here</span>
              </>
            )}
          </div>
        )}

        {/* Current step overlay */}
        {currentStep && (
          <div className="absolute bottom-0 left-0 right-0 bg-black/70 backdrop-blur-sm px-3 py-1.5">
            <p className="text-xs text-white truncate">
              {currentStep}
            </p>
          </div>
        )}

        {/* Live indicator badge (top-right) */}
        {isStreaming && (
          <div className="absolute top-2 right-2 flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-600/90 backdrop-blur-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
            <span className="text-[10px] text-white font-medium tracking-wider">LIVE</span>
          </div>
        )}

        {/* Fallback indicator (when showing SSE screenshot, not live) */}
        {!isStreaming && displaySrc && fallbackScreenshot && (
          <div className="absolute top-2 right-2 flex items-center gap-1 px-2 py-0.5 rounded-full bg-muted/80 backdrop-blur-sm">
            <Wifi className="w-3 h-3 text-muted-foreground" />
            <span className="text-[10px] text-muted-foreground">Screenshot</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default LiveBrowserView;
