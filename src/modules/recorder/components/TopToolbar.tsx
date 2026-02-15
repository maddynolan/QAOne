/**
 * TopToolbar - Run/Export/AI toolbar at the top of the recorder page.
 *
 * Extracted from PlaywrightRecorderPage.tsx to reduce file size.
 */

import React from "react";
import {
  Play, Download, Settings, Code,
  ChevronDown, Sparkles, Layers, Bug,
  Activity, Zap, Bot, Network,
  RotateCcw, Eye, Scan, Gauge,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  handleExport: (format: string) => void;
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
  setShowAIGenerator,
  setShowAIExplorer,
  setShowAIFlowExplorer,
  handleQuickApiTest,
  handleQuickLoadTest,
  captureForApiTest,
  captureForLoadTest,
  capturedNetworkRequests,
  exportCapturedAsPostman,
  exportCapturedAsHAR,
  handleExport,
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
        <Button variant="ghost" size="sm" className="h-8 px-3 text-xs text-muted-foreground hover:text-foreground">
          <Code className="h-3.5 w-3.5 mr-1.5" />
          Code
        </Button>
        {/* Run / Debug Dropdown */}
        <Popover open={showRunMenu} onOpenChange={setShowRunMenu}>
          <PopoverTrigger asChild>
            <Button
              size="sm"
              className="h-8 px-4 text-xs bg-emerald-600 hover:bg-emerald-700"
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
              className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded hover:bg-emerald-500/20 text-left transition-colors"
            >
              <Play className="h-4 w-4 text-emerald-400" />
              <div>
                <div className="font-medium">Run</div>
                <div className="text-[10px] text-muted-foreground">Execute with saved state</div>
              </div>
            </button>
            <button
              onClick={() => handleRunTest(false, true)}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded hover:bg-cyan-500/20 text-left transition-colors"
            >
              <RotateCcw className="h-4 w-4 text-cyan-400" />
              <div>
                <div className="font-medium">Fresh Run</div>
                <div className="text-[10px] text-muted-foreground">Clean browser, no cache</div>
              </div>
            </button>
            <button
              onClick={() => handleRunTest(true, false)}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded hover:bg-amber-500/20 text-left transition-colors"
            >
              <Bug className="h-4 w-4 text-amber-400" />
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
                <Gauge className="h-4 w-4 text-purple-400" />
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
                        ? "bg-purple-500/30 text-purple-300 border border-purple-500/50"
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
                <Scan className="h-4 w-4 text-yellow-400" />
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
                <Eye className="h-4 w-4 text-blue-400" />
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
        {/* AI Test Generator */}
        <Button
          onClick={() => setShowAIGenerator(true)}
          size="sm"
          className="h-8 px-3 text-xs bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700"
          disabled={!isRecording}
          title="AI-powered test generation"
        >
          <Bot className="h-3.5 w-3.5 mr-1" />
          AI
        </Button>
        {/* AI Explorer Agent */}
        <Button
          onClick={() => {
            console.log('[Explorer] Button clicked, isRecording:', isRecording);
            setShowAIExplorer(true);
          }}
          size="sm"
          className="h-8 px-3 text-xs bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
          title="AI Agent: Autonomous exploration and test discovery"
        >
          <Sparkles className="h-3.5 w-3.5 mr-1" />
          Explorer
        </Button>
        {/* AI Flow Explorer */}
        <Button
          onClick={() => {
            console.log('[FlowExplorer] Button clicked');
            setShowAIFlowExplorer(true);
          }}
          size="sm"
          className="h-8 px-3 text-xs bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-700 hover:to-cyan-700"
          title="AI Flow Explorer: Discover ALL flows, pages, and hidden elements"
        >
          <Network className="h-3.5 w-3.5 mr-1" />
          Flow Map
        </Button>
        {/* Quick API Test */}
        {captureForApiTest && !isRecording && actions.length > 0 && (
          <Button
            onClick={handleQuickApiTest}
            size="sm"
            className="h-8 px-3 text-xs bg-violet-600 hover:bg-violet-700"
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
            className="h-8 px-3 text-xs bg-orange-600 hover:bg-orange-700"
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
              className="h-8 px-2 text-xs border-violet-500/50 text-violet-400 hover:bg-violet-500/20"
              onClick={exportCapturedAsPostman}
              title="Download captured requests as Postman Collection"
            >
              <Download className="h-3 w-3 mr-1" />
              Postman
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8 px-2 text-xs border-amber-500/50 text-amber-400 hover:bg-amber-500/20"
              onClick={exportCapturedAsHAR}
              title="Download captured requests as HAR"
            >
              <Download className="h-3 w-3 mr-1" />
              HAR
            </Button>
          </>
        )}
        <Select onValueChange={handleExport}>
          <SelectTrigger className="h-8 w-[100px] text-xs border-white/20 bg-transparent">
            <Download className="h-3.5 w-3.5 mr-1" />
            <SelectValue placeholder="Export" />
          </SelectTrigger>
          <SelectContent className="bg-secondary border-border">
            <SelectItem value="playwright" className="text-xs">Playwright</SelectItem>
            <SelectItem value="cypress" className="text-xs">Cypress</SelectItem>
            <SelectItem value="selenium" className="text-xs">Selenium</SelectItem>
            <SelectItem value="robot" className="text-xs">Robot Framework</SelectItem>
            <SelectItem value="json" className="text-xs">JSON</SelectItem>
            <SelectItem value="csv" className="text-xs">CSV</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
