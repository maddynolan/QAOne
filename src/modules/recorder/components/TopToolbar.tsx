/**
 * TopToolbar - Run/Export toolbar at the top of the recorder page.
 *
 * Extracted from PlaywrightRecorderPage.tsx to reduce file size.
 */

import React from "react";
import {
  Play, Download, Settings,
  ChevronDown, Layers, Bug,
  Activity, Zap,
  RotateCcw, Eye, Scan, Gauge,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface TopToolbarProps {
  isRecording: boolean;
  isPaused: boolean;
  actions: any[];
  showRunMenu: boolean;
  setShowRunMenu: (show: boolean) => void;
  handleRunTest: (debug: boolean, fresh: boolean) => void;
  handleExportToBuilder: () => void;
  setShowAIGenerator: (show: boolean) => void;
  setShowAIExplorer: (show: boolean) => void;
  setShowAIFlowExplorer: (show: boolean) => void;
  handleQuickApiTest: () => void;
  handleQuickLoadTest: () => void;
  captureForApiTest: boolean;
  captureForLoadTest: boolean;
  capturedNetworkRequests: any[];
  exportCapturedAsPostman: () => void;
  exportCapturedAsHAR: () => void;
  handleExport?: (format: string) => void;
  playbackSpeed: string;
  setPlaybackSpeed: (speed: any) => void;
  highlightElements: boolean;
  setHighlightElements: (highlight: boolean) => void;
  keepBrowserOpenOnFailure: boolean;
  setKeepBrowserOpenOnFailure: (keep: boolean) => void;
}

export default function TopToolbar({
  isRecording,
  isPaused,
  actions,
  showRunMenu,
  setShowRunMenu,
  handleRunTest,
  handleExportToBuilder,
  handleQuickApiTest,
  handleQuickLoadTest,
  captureForApiTest,
  captureForLoadTest,
  capturedNetworkRequests,
  exportCapturedAsPostman,
  exportCapturedAsHAR,
  playbackSpeed,
  setPlaybackSpeed,
  highlightElements,
  setHighlightElements,
  keepBrowserOpenOnFailure,
  setKeepBrowserOpenOnFailure,
}: TopToolbarProps) {
  return (
    <div className="h-12 min-h-[48px] shrink-0 bg-card border-b border-gray-200 dark:border-border flex items-center justify-between px-4 overflow-visible">
      <div className="flex items-center gap-2 shrink-0">
        {isRecording && (
          <div className="flex items-center gap-2 px-3 py-1 bg-red-500/20 rounded-full border border-red-500/30">
            <div className={cn("w-2 h-2 rounded-full", isPaused ? "bg-amber-500" : "bg-red-500 animate-pulse")} />
            <span className="text-xs text-foreground">Ready</span>
            <span className="text-xs text-muted-foreground">&bull;</span>
            <span className="text-xs text-foreground">{actions.length} steps</span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <Button variant="ghost" size="sm" className="h-8 px-3 text-xs text-muted-foreground hover:text-foreground">
          <Settings className="h-3.5 w-3.5 mr-1.5" />
        </Button>
        {/* Run / Debug Dropdown */}
        <Popover open={showRunMenu} onOpenChange={setShowRunMenu}>
          <PopoverTrigger asChild>
            <Button
              size="sm"
              className="h-8 px-4 text-xs bg-primary hover:bg-primary/90"
              disabled={actions.length === 0}
            >
              <Play className="h-3.5 w-3.5 mr-1.5 fill-current" />
              Run
              <ChevronDown className="h-3 w-3 ml-1.5" />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-64 p-1">
            <button
              onClick={() => handleRunTest(false, false)}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded hover:bg-primary/10 text-left transition-colors"
            >
              <Play className="h-4 w-4 text-primary" />
              <div>
                <div className="font-medium">Run</div>
                <div className="text-[10px] text-muted-foreground">Execute with saved state</div>
              </div>
            </button>
            <button
              onClick={() => handleRunTest(false, true)}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded hover:bg-primary/10 text-left transition-colors"
            >
              <RotateCcw className="h-4 w-4 text-primary" />
              <div>
                <div className="font-medium">Fresh Run</div>
                <div className="text-[10px] text-muted-foreground">Clean browser, no cache</div>
              </div>
            </button>
            <button
              onClick={() => handleRunTest(true, false)}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded hover:bg-amber-500/10 text-left transition-colors"
            >
              <Bug className="h-4 w-4 text-amber-500" />
              <div>
                <div className="font-medium">Debug</div>
                <div className="text-[10px] text-muted-foreground">Pause, edit, step-by-step</div>
              </div>
            </button>

            {/* Separator */}
            <div className="h-px bg-border my-1" />

            {/* Playback Speed Selector */}
            <div className="px-3 py-2">
              <div className="flex items-center gap-2 mb-1.5">
                <Gauge className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium text-xs">Playback Speed</span>
              </div>
              <div className="flex gap-1">
                {(['0.25x', '0.5x', '1x', '2x'] as const).map((speed) => (
                  <button
                    key={speed}
                    onClick={() => setPlaybackSpeed(speed)}
                    className={cn(
                      "flex-1 px-2 py-1 text-[10px] rounded transition-colors",
                      playbackSpeed === speed
                        ? "bg-primary/20 text-primary border border-primary/30"
                        : "bg-secondary/50 hover:bg-secondary text-muted-foreground"
                    )}
                  >
                    {speed}
                  </button>
                ))}
              </div>
            </div>

            {/* Highlight Elements Toggle */}
            <div
              className="w-full flex items-center justify-between px-3 py-2 text-sm cursor-pointer hover:bg-secondary/50 rounded transition-colors"
              onClick={() => setHighlightElements(!highlightElements)}
            >
              <div className="flex items-center gap-2">
                <Scan className="h-4 w-4 text-muted-foreground" />
                <div>
                  <div className="font-medium text-xs">Highlight Elements</div>
                  <div className="text-[10px] text-muted-foreground">Visual indicator during run</div>
                </div>
              </div>
              <Switch
                checked={highlightElements}
                onCheckedChange={setHighlightElements}
                className="ml-2"
              />
            </div>

            {/* Keep Browser Open Toggle */}
            <div
              className="w-full flex items-center justify-between px-3 py-2 text-sm cursor-pointer hover:bg-secondary/50 rounded transition-colors"
              onClick={() => setKeepBrowserOpenOnFailure(!keepBrowserOpenOnFailure)}
            >
              <div className="flex items-center gap-2">
                <Eye className="h-4 w-4 text-muted-foreground" />
                <div>
                  <div className="font-medium text-xs">Keep Browser Open</div>
                  <div className="text-[10px] text-muted-foreground">On failure, for debugging</div>
                </div>
              </div>
              <Switch
                checked={keepBrowserOpenOnFailure}
                onCheckedChange={setKeepBrowserOpenOnFailure}
                className="ml-2"
              />
            </div>
          </PopoverContent>
        </Popover>
        <Button
          onClick={handleExportToBuilder}
          size="sm"
          className="h-8 px-4 text-xs bg-primary hover:bg-primary/90"
          disabled={actions.length === 0}
        >
          <Layers className="h-3.5 w-3.5 mr-1.5" />
          Builder
        </Button>
        {/* Quick API Test */}
        {captureForApiTest && !isRecording && actions.length > 0 && (
          <Button
            onClick={handleQuickApiTest}
            size="sm"
            variant="outline"
            className="h-8 px-3 text-xs"
            title={capturedNetworkRequests.length > 0
              ? `Test ${capturedNetworkRequests.length} captured requests in API tab`
              : "Open API tab to test recorded endpoints"
            }
          >
            <Zap className="h-3.5 w-3.5 mr-1" />
            API {capturedNetworkRequests.length > 0 && `(${capturedNetworkRequests.length})`}
          </Button>
        )}
        {/* Quick Load Test */}
        {captureForLoadTest && !isRecording && actions.length > 0 && (
          <Button
            onClick={handleQuickLoadTest}
            size="sm"
            variant="outline"
            className="h-8 px-3 text-xs"
            title={capturedNetworkRequests.length > 0
              ? `Load test ${capturedNetworkRequests.length} captured requests in Perf tab`
              : "Open Perf tab to load test recorded endpoints"
            }
          >
            <Activity className="h-3.5 w-3.5 mr-1" />
            Perf {capturedNetworkRequests.length > 0 && `(${capturedNetworkRequests.length})`}
          </Button>
        )}
        {capturedNetworkRequests.length > 0 && !isRecording && (
          <>
            <Button
              variant="outline"
              size="sm"
              className="h-8 px-2 text-xs"
              onClick={exportCapturedAsPostman}
              title="Download captured requests as Postman Collection"
            >
              <Download className="h-3 w-3 mr-1" />
              Postman
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8 px-2 text-xs"
              onClick={exportCapturedAsHAR}
              title="Download captured requests as HAR"
            >
              <Download className="h-3 w-3 mr-1" />
              HAR
            </Button>
          </>
        )}
        {/* Export menu removed — use Builder to export test cases */}
      </div>
    </div>
  );
}
