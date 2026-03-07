/**
 * RecordingControlsPanel - URL bar, device/network selection, recording buttons, linking status bar.
 *
 * Extracted from PlaywrightRecorderPage.tsx to reduce file size.
 */

import React from "react";
import {
  Play, Square, Pause, Globe, Loader2,
  Circle, Eye, Sparkles, X,
  Accessibility, Scan, Link2, Smartphone, Wifi, Monitor,
  ChevronRight, Layers, Video,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getDeviceName } from "@/modules/recorder/constants/recorderConstants";

interface RecordingControlsPanelProps {
  url: string;
  setUrl: (url: string) => void;
  currentUrl: string | null;
  isRecording: boolean;
  isStarting: boolean;
  isPaused: boolean;
  handleStartRecording: () => void;
  handleStopRecording: () => void;
  handlePauseResume: () => void;
  handleA11yScan: () => void;
  isA11yScanning: boolean;
  a11yIssues: any[];
  handleCaptureVisualCheckpoint: () => void;
  isCapturingVisual: boolean;
  visualCheckpoints: number;
  selectedMobileDevice: string;
  setSelectedMobileDevice: (device: string) => void;
  selectedNetwork: string;
  setSelectedNetwork: (network: string) => void;
  deviceCategories: Record<string, { id: string; name: string }[]>;
  networkPresets: { id: string; name: string }[];
  captureForLoadTest: boolean;
  setCaptureForLoadTest: (capture: boolean) => void;
  captureForApiTest: boolean;
  setCaptureForApiTest: (capture: boolean) => void;
  capturedNetworkRequests: any[];
  selectedTestCase: any;
  setSelectedTestCase: (tc: any) => void;
  setMode: (mode: string) => void;
  setShowTestPicker: (show: boolean) => void;
  // Browser selection
  selectedBrowser: 'chromium' | 'firefox' | 'webkit';
  setSelectedBrowser: (browser: 'chromium' | 'firefox' | 'webkit') => void;
  // Linking status bar props
  mode: string;
  stepLinks: Record<number, any>;
  stepAutomation: Record<number, any>;
  currentStepIndex: number;
  setCurrentStepIndex: (idx: number) => void;
  setRightPanelTab: (tab: string) => void;
  recordForStepContext: any;
}

export default function RecordingControlsPanel({
  url,
  setUrl,
  currentUrl,
  isRecording,
  isStarting,
  isPaused,
  handleStartRecording,
  handleStopRecording,
  handlePauseResume,
  handleA11yScan,
  isA11yScanning,
  a11yIssues,
  handleCaptureVisualCheckpoint,
  isCapturingVisual,
  visualCheckpoints,
  selectedMobileDevice,
  setSelectedMobileDevice,
  selectedNetwork,
  setSelectedNetwork,
  deviceCategories,
  networkPresets,
  captureForLoadTest,
  setCaptureForLoadTest,
  captureForApiTest,
  setCaptureForApiTest,
  capturedNetworkRequests,
  selectedTestCase,
  setSelectedTestCase,
  setMode,
  setShowTestPicker,
  selectedBrowser,
  setSelectedBrowser,
  mode,
  stepLinks,
  stepAutomation,
  currentStepIndex,
  setCurrentStepIndex,
  setRightPanelTab,
  recordForStepContext,
}: RecordingControlsPanelProps) {
  return (
    <>
      {/* URL Bar */}
      <div className="p-3 border-b border-border">
        {/* Device & Network Selection - Only show when NOT recording */}
        {!isRecording && (
          <div className="space-y-2 mb-2">
            {/* Row 1: Device, Network, Mobile Badge */}
            <div className="flex gap-2 items-center">
              <Select value={selectedMobileDevice} onValueChange={setSelectedMobileDevice}>
                <SelectTrigger className="h-8 w-[200px] text-xs">
                  {selectedMobileDevice === 'desktop' ? (
                    <Monitor className="h-3.5 w-3.5 mr-1.5" />
                  ) : (
                    <Smartphone className="h-3.5 w-3.5 mr-1.5" />
                  )}
                  <SelectValue placeholder="Device">{getDeviceName(selectedMobileDevice)}</SelectValue>
                </SelectTrigger>
                <SelectContent className="max-h-[400px]">
                  <SelectItem value="desktop" className="text-xs">
                    <span className="flex items-center gap-2">Desktop (Default)</span>
                  </SelectItem>
                  {Object.entries(deviceCategories).map(([category, devices]) => (
                    <div key={category}>
                      <div className="px-2 py-1.5 text-[10px] text-muted-foreground font-semibold bg-muted/50 sticky top-0">
                        {category} ({devices.length})
                      </div>
                      {devices.map(device => (
                        <SelectItem key={device.id} value={device.id} className="text-xs pl-4">
                          {category.includes('iOS') ? '' : ''} {device.name}
                        </SelectItem>
                      ))}
                    </div>
                  ))}
                </SelectContent>
              </Select>

              {selectedMobileDevice !== 'desktop' && (
                <Select value={selectedNetwork} onValueChange={setSelectedNetwork}>
                  <SelectTrigger className="h-8 w-[130px] text-xs">
                    <Wifi className="h-3.5 w-3.5 mr-1.5" />
                    <SelectValue placeholder="Network" />
                  </SelectTrigger>
                  <SelectContent>
                    {networkPresets.map(network => (
                      <SelectItem key={network.id} value={network.id} className="text-xs">
                        {network.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              {selectedMobileDevice !== 'desktop' && (
                <Badge variant="outline" className="h-8 px-2 text-[10px] bg-sky-500/10 text-sky-500 border-sky-500/30">
                  <Smartphone className="h-3 w-3 mr-1" />
                  Mobile Mode
                </Badge>
              )}

              {/* Spacer */}
              <div className="flex-1" />

              {/* Browser Engine Selector — always visible */}
              <div className="flex items-center gap-1.5">
                <Label className="text-[10px] text-muted-foreground whitespace-nowrap font-medium">Browser:</Label>
                <Select value={selectedBrowser} onValueChange={(v) => setSelectedBrowser(v as 'chromium' | 'firefox' | 'webkit')}>
                  <SelectTrigger className={cn(
                    "h-8 w-[160px] text-xs font-medium",
                    selectedBrowser === 'firefox' && "border-orange-500/50 bg-orange-500/5 text-orange-600",
                    selectedBrowser === 'webkit' && "border-blue-500/50 bg-blue-500/5 text-blue-600"
                  )}>
                    <Globe className="h-3.5 w-3.5 mr-1.5" />
                    <SelectValue placeholder="Browser" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="chromium" className="text-xs">Chromium (Default)</SelectItem>
                    <SelectItem value="firefox" className="text-xs">Firefox</SelectItem>
                    <SelectItem value="webkit" className="text-xs">WebKit (Safari)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        )}

        {/* Show active device during recording */}
        {isRecording && selectedMobileDevice !== 'desktop' && (
          <div className="flex items-center gap-2 mb-2 p-2 bg-sky-500/10 rounded-lg border border-sky-500/30">
            <Smartphone className="h-4 w-4 text-sky-500" />
            <span className="text-xs text-sky-500 font-medium">
              Recording on {getDeviceName(selectedMobileDevice)}
            </span>
            {selectedNetwork !== 'none' && (
              <Badge variant="outline" className="text-[10px] h-5 bg-violet-500/10 text-violet-400 border-violet-500/30">
                <Wifi className="h-3 w-3 mr-1" />
                {networkPresets.find(n => n.id === selectedNetwork)?.name}
              </Badge>
            )}
          </div>
        )}

        <div className="flex items-center gap-2 p-2 bg-secondary rounded-lg border border-border">
          <Globe className="h-4 w-4 text-muted-foreground shrink-0" />
          <Input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://..."
            disabled={isRecording}
            className="h-7 bg-transparent border-0 text-sm p-0 focus-visible:ring-0"
          />
        </div>

        {/* Network Capture Toggles - Only show when NOT recording */}
        {!isRecording && (
          <div className="mt-2 p-2 bg-muted/50 rounded-lg border border-border">
            <p className="text-xs text-muted-foreground mb-2">Also capture network traffic for:</p>
            <div className="flex gap-4">
              <div className="flex items-center gap-2">
                <Switch
                  id="capture-load"
                  checked={captureForLoadTest}
                  onCheckedChange={setCaptureForLoadTest}
                  className="scale-75"
                />
                <Label htmlFor="capture-load" className="text-xs cursor-pointer flex items-center gap-1">
                  Load Testing
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="capture-api"
                  checked={captureForApiTest}
                  onCheckedChange={setCaptureForApiTest}
                  className="scale-75"
                />
                <Label htmlFor="capture-api" className="text-xs cursor-pointer flex items-center gap-1">
                  API Testing
                </Label>
              </div>
            </div>
            {(captureForLoadTest || captureForApiTest) && (
              <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-1">
                HTTP traffic will be captured during recording
              </p>
            )}
          </div>
        )}

        {/* Show capture status during recording */}
        {isRecording && (captureForLoadTest || captureForApiTest) && (
          <div className="mt-2 p-2 bg-emerald-500/10 rounded-lg border border-emerald-500/30">
            <div className="flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400">
              <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
              Capturing network traffic ({capturedNetworkRequests.length} requests)
              {captureForLoadTest && <Badge variant="outline" className="text-[10px] h-4">Load</Badge>}
              {captureForApiTest && <Badge variant="outline" className="text-[10px] h-4">API</Badge>}
            </div>
          </div>
        )}
      </div>

      {/* Recording Controls */}
      <div className="p-3 border-b border-border space-y-2">
        {/* Selected Test Info (Automate Existing mode) */}
        {selectedTestCase && (
          <div className="p-2 bg-purple-500/10 border border-purple-500/30 rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-purple-400" />
                <span className="text-sm font-medium text-purple-300">Automating:</span>
                <span className="text-sm text-foreground truncate max-w-[200px]">{selectedTestCase.name}</span>
                <Badge className="bg-purple-500/20 text-purple-400 text-[10px]">
                  {selectedTestCase.steps?.length || 0} steps
                </Badge>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSelectedTestCase(null);
                  setMode('new');
                }}
                className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          </div>
        )}

        {/* Recording Buttons */}
        <div className="flex gap-2">
          {!isRecording ? (
            <>
              <Button
                onClick={handleStartRecording}
                disabled={isStarting || !url.startsWith('http')}
                className="flex-1 h-10 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 font-medium"
              >
                {isStarting ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Circle className="h-4 w-4 mr-2 fill-current" />
                )}
                Start Trace
              </Button>
              {!selectedTestCase ? (
                <Button
                  onClick={() => setShowTestPicker(true)}
                  variant="outline"
                  className="flex-1 h-10 border-purple-500/50 text-purple-400 hover:bg-purple-500/10"
                >
                  <Sparkles className="h-4 w-4 mr-2" />
                  Automate Existing
                </Button>
              ) : (
                <Button
                  onClick={() => setShowTestPicker(true)}
                  variant="outline"
                  className="h-10 px-3 border-border text-muted-foreground hover:text-foreground"
                >
                  Change
                </Button>
              )}
            </>
          ) : (
            <>
              <Button onClick={handleStopRecording} className="flex-1 h-10 bg-red-600 hover:bg-red-700">
                <Square className="h-4 w-4 mr-2 fill-current" />
                Stop
              </Button>
              <Button
                onClick={handlePauseResume}
                className={cn(
                  "w-28 h-10",
                  isPaused
                    ? "bg-emerald-600 hover:bg-emerald-700"
                    : "bg-primary hover:bg-primary/90"
                )}
              >
                {isPaused ? (
                  <>
                    <Play className="h-4 w-4 mr-2" />
                    Resume
                  </>
                ) : (
                  <>
                    <Pause className="h-4 w-4 mr-2" />
                    Pause
                  </>
                )}
              </Button>
              <Button
                onClick={handleA11yScan}
                disabled={isA11yScanning || !currentUrl}
                variant="outline"
                className={cn(
                  "h-10 px-3 border-blue-500/50 hover:bg-blue-500/10",
                  a11yIssues.length > 0 && a11yIssues.some(p => p.summary.total > 0)
                    ? "text-amber-400 border-amber-500/50"
                    : "text-blue-400"
                )}
                title="Scan current page for accessibility issues"
              >
                {isA11yScanning ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Accessibility className="h-4 w-4" />
                )}
                <span className="ml-1.5 text-xs">A11y</span>
                {a11yIssues.length > 0 && (
                  <Badge
                    variant="secondary"
                    className={cn(
                      "ml-1 h-5 min-w-5 px-1 text-xs",
                      a11yIssues.reduce((acc: number, p: any) => acc + p.summary.critical, 0) > 0
                        ? "bg-red-500/20 text-red-400"
                        : a11yIssues.reduce((acc: number, p: any) => acc + p.summary.serious, 0) > 0
                        ? "bg-orange-500/20 text-orange-400"
                        : "bg-blue-500/20 text-blue-400"
                    )}
                  >
                    {a11yIssues.reduce((acc: number, p: any) => acc + p.summary.total, 0)}
                  </Badge>
                )}
              </Button>
              <Button
                onClick={handleCaptureVisualCheckpoint}
                disabled={isCapturingVisual || !currentUrl}
                variant="outline"
                className="h-10 px-3 border-violet-500/50 hover:bg-violet-500/10 text-violet-400"
                title="Capture visual checkpoint for regression testing"
              >
                {isCapturingVisual ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
                <span className="ml-1.5 text-xs">Visual</span>
                {visualCheckpoints > 0 && (
                  <Badge
                    variant="secondary"
                    className="ml-1 h-5 min-w-5 px-1 text-xs bg-violet-500/20 text-violet-400"
                  >
                    {visualCheckpoints}
                  </Badge>
                )}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Compact Linking Status Bar - Only in 'existing' mode */}
      {mode === 'existing' && selectedTestCase && (
        <div className="border-b border-border bg-purple-500/5">
          {/* Compact Status Bar */}
          <div className="px-4 py-2.5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Link2 className="h-4 w-4 text-purple-400" />
                <span className="text-sm font-medium text-purple-300">Automating:</span>
              </div>

              {/* Progress indicator */}
              <div className="flex items-center gap-2">
                <div className="w-24 h-1.5 bg-purple-500/20 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-purple-500 to-emerald-500 transition-all duration-300"
                    style={{
                      width: `${((Object.keys(stepLinks).length || Object.keys(stepAutomation).length) / (selectedTestCase.steps?.length || 1)) * 100}%`
                    }}
                  />
                </div>
                <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30 text-xs">
                  {Object.keys(stepLinks).length || Object.keys(stepAutomation).length}/{selectedTestCase.steps?.length || 0}
                </Badge>
              </div>
            </div>

            {/* Quick action to open Automate tab */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setRightPanelTab('automate')}
              className="h-7 px-3 text-xs border-purple-500/30 text-purple-400 hover:bg-purple-500/10"
            >
              <Layers className="h-3 w-3 mr-1.5" />
              View All Steps
              <ChevronRight className="h-3 w-3 ml-1" />
            </Button>
          </div>

          {/* Current Step Indicator */}
          {selectedTestCase.steps && selectedTestCase.steps[currentStepIndex] && (
            <div className="px-4 py-2 bg-purple-500/10 border-t border-purple-500/20 flex items-center gap-3">
              <div className="flex items-center justify-center w-6 h-6 rounded bg-purple-500 text-white text-xs font-bold">
                {String(currentStepIndex + 1).padStart(2, '0')}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-purple-200 truncate">
                  {selectedTestCase.steps[currentStepIndex].name || selectedTestCase.steps[currentStepIndex].description || `Step ${currentStepIndex + 1}`}
                </p>
                <p className="text-[10px] text-muted-foreground truncate">
                  {stepLinks[currentStepIndex]?.actions.length
                    ? `${stepLinks[currentStepIndex].actions.length} action(s) linked`
                    : 'Select recorded actions to link'}
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  // Go to next unlinked step
                  const steps = selectedTestCase.steps || [];
                  for (let i = currentStepIndex + 1; i < steps.length; i++) {
                    if (!stepLinks[i] || stepLinks[i].actions.length === 0) {
                      setCurrentStepIndex(i);
                      return;
                    }
                  }
                  // Wrap to beginning if no unlinked found
                  for (let i = 0; i < currentStepIndex; i++) {
                    if (!stepLinks[i] || stepLinks[i].actions.length === 0) {
                      setCurrentStepIndex(i);
                      return;
                    }
                  }
                }}
                className="h-6 px-2 text-xs text-purple-400 hover:bg-purple-500/20"
              >
                Next Step
                <ChevronRight className="h-3 w-3 ml-1" />
              </Button>
            </div>
          )}

          {/* Recording for specific step context */}
          {recordForStepContext && (
            <div className="px-3 py-2 bg-blue-500/10 border-t border-blue-500/30">
              <div className="flex items-center gap-2 text-xs">
                <Video className="h-3 w-3 text-blue-400 animate-pulse" />
                <span className="text-blue-300">
                  Recording for: <strong>{recordForStepContext.stepName}</strong>
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}
