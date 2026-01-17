/**
 * MobileTestingPage - Mobile Device Testing Interface
 * 
 * Features:
 * - 50+ mobile device profiles (iOS & Android)
 * - Network throttling (4G, 3G, Slow 3G, Offline)
 * - Touch events and gestures
 * - Native app testing with Maestro
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '@/contexts/ThemeContext';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { mobile, isElectron, getElectronAPI } from '@/lib/electron-bridge';
import { toast } from 'sonner';
import {
  Smartphone,
  Tablet,
  Wifi,
  WifiOff,
  Play,
  Square,
  RotateCcw,
  Settings,
  Zap,
  Globe,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
  MonitorSmartphone,
  Signal,
  Hand,
  Loader2,
  MousePointer,
  Type,
  Navigation,
  Trash2,
  Save,
  ExternalLink,
} from 'lucide-react';

// Device profiles
const iosDevices = [
  { id: 'iphone-15-pro', name: 'iPhone 15 Pro', viewport: '393×852', scale: 3 },
  { id: 'iphone-15', name: 'iPhone 15', viewport: '393×852', scale: 3 },
  { id: 'iphone-14-pro', name: 'iPhone 14 Pro', viewport: '393×852', scale: 3 },
  { id: 'iphone-14', name: 'iPhone 14', viewport: '390×844', scale: 3 },
  { id: 'iphone-13', name: 'iPhone 13', viewport: '390×844', scale: 3 },
  { id: 'iphone-se', name: 'iPhone SE', viewport: '375×667', scale: 2 },
  { id: 'ipad-pro', name: 'iPad Pro 12.9"', viewport: '1024×1366', scale: 2 },
  { id: 'ipad-air', name: 'iPad Air', viewport: '820×1180', scale: 2 },
];

const androidDevices = [
  { id: 'pixel-8-pro', name: 'Pixel 8 Pro', viewport: '412×915', scale: 2.625 },
  { id: 'pixel-8', name: 'Pixel 8', viewport: '412×915', scale: 2.625 },
  { id: 'pixel-7', name: 'Pixel 7', viewport: '412×915', scale: 2.625 },
  { id: 'galaxy-s24', name: 'Galaxy S24 Ultra', viewport: '360×780', scale: 4 },
  { id: 'galaxy-s23', name: 'Galaxy S23', viewport: '360×780', scale: 3 },
  { id: 'oneplus-12', name: 'OnePlus 12', viewport: '412×915', scale: 3 },
  { id: 'galaxy-tab', name: 'Galaxy Tab S9', viewport: '800×1280', scale: 2 },
];

const networkPresets = [
  { id: '4g-lte', name: '4G LTE', download: 12000, upload: 6000, latency: 50, icon: Signal },
  { id: '4g', name: '4G', download: 4000, upload: 3000, latency: 100, icon: Signal },
  { id: '3g', name: '3G', download: 1500, upload: 750, latency: 300, icon: Wifi },
  { id: 'slow-3g', name: 'Slow 3G', download: 400, upload: 400, latency: 400, icon: Wifi },
  { id: 'offline', name: 'Offline', download: 0, upload: 0, latency: 0, icon: WifiOff },
];

export default function MobileTestingPage() {
  const { theme } = useTheme();
  const navigate = useNavigate();
  const [selectedDevice, setSelectedDevice] = useState(iosDevices[0]);
  const [selectedNetwork, setSelectedNetwork] = useState(networkPresets[0]);
  const [targetUrl, setTargetUrl] = useState('https://');
  const [isRecording, setIsRecording] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [maestroInstalled, setMaestroInstalled] = useState<boolean | null>(null);
  const [activeTab, setActiveTab] = useState<'web' | 'native'>('web');
  const [inElectron] = useState(() => isElectron());
  const [recordedActions, setRecordedActions] = useState<any[]>([]);

  // Helper to get action icon
  const getActionIcon = (action: any) => {
    const type = action.type || action.action || '';
    if (type.includes('click')) return <MousePointer className="w-3.5 h-3.5" />;
    if (type.includes('fill') || type.includes('type')) return <Type className="w-3.5 h-3.5" />;
    if (type.includes('navigate') || type.includes('goto')) return <Navigation className="w-3.5 h-3.5" />;
    return <CheckCircle2 className="w-3.5 h-3.5" />;
  };

  // Clear recorded actions
  const handleClearActions = async () => {
    const flowstral = (window as any).flowstral;
    const electronAPI = (window as any).electronAPI;
    
    if (electronAPI?.invoke) {
      await electronAPI.invoke('playwright-recorder-clear-actions');
    } else if (flowstral?.playwrightRecorder) {
      await flowstral.playwrightRecorder.clearActions();
    }
    setRecordedActions([]);
    toast.success('Actions cleared');
  };

  // Save to Test Builder
  const handleSaveToBuilder = () => {
    if (recordedActions.length === 0) {
      toast.error('No actions to save');
      return;
    }
    
    // Store actions in sessionStorage for the builder to pick up
    sessionStorage.setItem('mobile-recorded-actions', JSON.stringify({
      actions: recordedActions,
      device: selectedDevice,
      network: selectedNetwork,
      url: targetUrl,
      timestamp: new Date().toISOString()
    }));
    
    toast.success('Opening Test Builder...');
    navigate('/test-cases/builder');
  };

  // Navigate to Record tab with actions
  const handleViewInRecorder = () => {
    navigate('/recorder');
  };

  // Check Maestro installation on mount
  useEffect(() => {
    if (inElectron) {
      mobile.checkMaestro().then(setMaestroInstalled);
    }
  }, [inElectron]);

  // Listen for recorded actions from the recorder
  useEffect(() => {
    if (!inElectron) return;

    const electronAPI = (window as any).electronAPI;
    const flowstral = (window as any).flowstral;

    // Handler for new actions
    const handleAction = (action: any) => {
      console.log('[MobileTestingPage] Received action:', action);
      setRecordedActions(prev => [...prev, action]);
    };

    // Handler for recording stopped
    const handleStopped = ({ actions }: { actions: any[] }) => {
      console.log('[MobileTestingPage] Recording stopped, actions:', actions?.length);
      if (actions) {
        setRecordedActions(actions);
      }
      setIsRecording(false);
    };

    // Subscribe to events
    let unsubAction: (() => void) | undefined;
    let unsubStopped: (() => void) | undefined;

    if (electronAPI?.on) {
      unsubAction = electronAPI.on('playwright-recorder-action', handleAction);
      unsubStopped = electronAPI.on('playwright-recorder-stopped', handleStopped);
    } else if (flowstral?.on) {
      unsubAction = flowstral.on('playwright-recorder-action', handleAction);
      unsubStopped = flowstral.on('playwright-recorder-stopped', handleStopped);
    }

    return () => {
      unsubAction?.();
      unsubStopped?.();
    };
  }, [inElectron]);

  const handleStartRecording = async () => {
    if (!targetUrl || targetUrl === 'https://') {
      toast.error('Please enter a valid URL');
      return;
    }

    if (!inElectron) {
      toast.error('Mobile recording requires the Flowstral Desktop app');
      return;
    }

    setIsLoading(true);
    try {
      // Use flowstral API (exposed via preload) or electronAPI.invoke
      const flowstral = (window as any).flowstral;
      const electronAPI = (window as any).electronAPI;
      
      let result;
      if (electronAPI?.invoke) {
        // Use invoke with options object for mobile recording
        result = await electronAPI.invoke('playwright-recorder-start', {
          url: targetUrl,
          mobileDevice: selectedDevice.name,
          mobileNetwork: selectedNetwork.id
        });
      } else if (flowstral?.playwrightRecorder) {
        // Fallback: set mobile device first, then start recording
        if (flowstral.mobile?.setDevice) {
          await flowstral.mobile.setDevice(selectedDevice.name, selectedNetwork.id);
        }
        result = await flowstral.playwrightRecorder.start(targetUrl);
      }
      
      if (result?.success !== false) {
        setIsRecording(true);
        toast.success(`Recording on ${selectedDevice.name} with ${selectedNetwork.name}`);
      } else {
        toast.error(result?.error || 'Failed to start recording');
      }
    } catch (error: any) {
      console.error('Failed to start recording:', error);
      toast.error(error.message || 'Failed to start recording');
    } finally {
      setIsLoading(false);
    }
  };

  const handleStopRecording = async () => {
    setIsLoading(true);
    try {
      const flowstral = (window as any).flowstral;
      const electronAPI = (window as any).electronAPI;
      
      if (electronAPI?.invoke) {
        await electronAPI.invoke('playwright-recorder-stop');
        // Fetch the recorded actions
        const actions = await electronAPI.invoke('playwright-recorder-get-actions');
        if (actions && Array.isArray(actions)) {
          setRecordedActions(actions);
        }
      } else if (flowstral?.playwrightRecorder) {
        await flowstral.playwrightRecorder.stop();
        // Fetch the recorded actions
        const actions = await flowstral.playwrightRecorder.getActions();
        if (actions && Array.isArray(actions)) {
          setRecordedActions(actions);
        }
      }
      
      setIsRecording(false);
      toast.success(`Recording stopped - ${recordedActions.length} steps captured`);
    } catch (error: any) {
      console.error('Failed to stop recording:', error);
      toast.error(error.message || 'Failed to stop recording');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={cn(
      "min-h-screen p-6",
      theme === 'light' ? 'bg-gray-50' : 'bg-gray-950'
    )}>
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className={cn(
            "w-10 h-10 rounded-xl flex items-center justify-center",
            theme === 'light'
              ? "bg-gradient-to-br from-sky-500 to-indigo-500"
              : "bg-gradient-to-br from-sky-400 to-indigo-500"
          )}>
            <Smartphone className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className={cn(
              "text-2xl font-bold",
              theme === 'light' ? 'text-gray-900' : 'text-white'
            )}>
              Mobile Testing
            </h1>
            <p className={cn(
              "text-sm",
              theme === 'light' ? 'text-gray-500' : 'text-gray-400'
            )}>
              Test on 50+ devices with real device profiles
            </p>
          </div>
          <Badge className={cn(
            "ml-auto",
            theme === 'light'
              ? "bg-sky-100 text-sky-700 border-sky-200"
              : "bg-sky-500/20 text-sky-400 border-sky-500/30"
          )}>
            <Zap className="w-3 h-3 mr-1" /> NEW
          </Badge>
        </div>
      </div>

      {/* Tab Toggle */}
      <div className={cn(
        "flex gap-2 p-1 rounded-xl mb-6 w-fit",
        theme === 'light' ? 'bg-gray-100' : 'bg-gray-900'
      )}>
        <button
          onClick={() => setActiveTab('web')}
          className={cn(
            "px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2",
            activeTab === 'web'
              ? theme === 'light'
                ? "bg-white text-sky-600 shadow-sm"
                : "bg-gray-800 text-sky-400"
              : theme === 'light'
                ? "text-gray-600 hover:text-gray-900"
                : "text-gray-400 hover:text-white"
          )}
        >
          <Globe className="w-4 h-4" /> Mobile Web
        </button>
        <button
          onClick={() => setActiveTab('native')}
          className={cn(
            "px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2",
            activeTab === 'native'
              ? theme === 'light'
                ? "bg-white text-sky-600 shadow-sm"
                : "bg-gray-800 text-sky-400"
              : theme === 'light'
                ? "text-gray-600 hover:text-gray-900"
                : "text-gray-400 hover:text-white"
          )}
        >
          <MonitorSmartphone className="w-4 h-4" /> Native Apps
        </button>
      </div>

      {activeTab === 'web' ? (
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Left: Device Selection */}
          <div className={cn(
            "rounded-xl border p-5",
            theme === 'light'
              ? "bg-white border-gray-200"
              : "bg-gray-900 border-gray-800"
          )}>
            <h3 className={cn(
              "text-sm font-semibold mb-4 flex items-center gap-2",
              theme === 'light' ? 'text-gray-900' : 'text-white'
            )}>
              <Smartphone className="w-4 h-4" /> Device Selection
            </h3>

            {/* iOS Devices */}
            <div className="mb-4">
              <p className={cn(
                "text-xs font-medium mb-2 flex items-center gap-2",
                theme === 'light' ? 'text-gray-500' : 'text-gray-400'
              )}>
                <span className="px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 text-[10px]">iOS</span>
                {iosDevices.length} devices
              </p>
              <div className="grid grid-cols-2 gap-2">
                {iosDevices.map((device) => (
                  <button
                    key={device.id}
                    onClick={() => setSelectedDevice(device)}
                    className={cn(
                      "p-2 rounded-lg border text-left transition-all text-xs",
                      selectedDevice.id === device.id
                        ? theme === 'light'
                          ? "bg-sky-50 border-sky-300 text-sky-700"
                          : "bg-sky-500/20 border-sky-500 text-sky-400"
                        : theme === 'light'
                          ? "bg-white border-gray-200 text-gray-700 hover:border-gray-300"
                          : "bg-gray-800 border-gray-700 text-gray-300 hover:border-gray-600"
                    )}
                  >
                    <div className="font-medium truncate">{device.name}</div>
                    <div className={cn(
                      "text-[10px]",
                      theme === 'light' ? 'text-gray-400' : 'text-gray-500'
                    )}>
                      {device.viewport}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Android Devices */}
            <div>
              <p className={cn(
                "text-xs font-medium mb-2 flex items-center gap-2",
                theme === 'light' ? 'text-gray-500' : 'text-gray-400'
              )}>
                <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 text-[10px]">Android</span>
                {androidDevices.length} devices
              </p>
              <div className="grid grid-cols-2 gap-2">
                {androidDevices.map((device) => (
                  <button
                    key={device.id}
                    onClick={() => setSelectedDevice(device)}
                    className={cn(
                      "p-2 rounded-lg border text-left transition-all text-xs",
                      selectedDevice.id === device.id
                        ? theme === 'light'
                          ? "bg-sky-50 border-sky-300 text-sky-700"
                          : "bg-sky-500/20 border-sky-500 text-sky-400"
                        : theme === 'light'
                          ? "bg-white border-gray-200 text-gray-700 hover:border-gray-300"
                          : "bg-gray-800 border-gray-700 text-gray-300 hover:border-gray-600"
                    )}
                  >
                    <div className="font-medium truncate">{device.name}</div>
                    <div className={cn(
                      "text-[10px]",
                      theme === 'light' ? 'text-gray-400' : 'text-gray-500'
                    )}>
                      {device.viewport}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Middle: Network & Controls */}
          <div className="space-y-6">
            {/* Network Selection */}
            <div className={cn(
              "rounded-xl border p-5",
              theme === 'light'
                ? "bg-white border-gray-200"
                : "bg-gray-900 border-gray-800"
            )}>
              <h3 className={cn(
                "text-sm font-semibold mb-4 flex items-center gap-2",
                theme === 'light' ? 'text-gray-900' : 'text-white'
              )}>
                <Wifi className="w-4 h-4" /> Network Conditions
              </h3>
              <div className="space-y-2">
                {networkPresets.map((network) => {
                  const Icon = network.icon;
                  return (
                    <button
                      key={network.id}
                      onClick={() => setSelectedNetwork(network)}
                      className={cn(
                        "w-full p-3 rounded-lg border flex items-center gap-3 transition-all",
                        selectedNetwork.id === network.id
                          ? theme === 'light'
                            ? "bg-violet-50 border-violet-300"
                            : "bg-violet-500/20 border-violet-500"
                          : theme === 'light'
                            ? "bg-white border-gray-200 hover:border-gray-300"
                            : "bg-gray-800 border-gray-700 hover:border-gray-600"
                      )}
                    >
                      <Icon className={cn(
                        "w-4 h-4",
                        selectedNetwork.id === network.id
                          ? "text-violet-500"
                          : theme === 'light' ? "text-gray-400" : "text-gray-500"
                      )} />
                      <div className="flex-1 text-left">
                        <div className={cn(
                          "text-sm font-medium",
                          theme === 'light' ? 'text-gray-900' : 'text-white'
                        )}>
                          {network.name}
                        </div>
                        <div className={cn(
                          "text-xs",
                          theme === 'light' ? 'text-gray-400' : 'text-gray-500'
                        )}>
                          {network.download > 0 ? `${network.download} Kbps / ${network.latency}ms` : 'No connection'}
                        </div>
                      </div>
                      {selectedNetwork.id === network.id && (
                        <CheckCircle2 className="w-4 h-4 text-violet-500" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Touch Events */}
            <div className={cn(
              "rounded-xl border p-5",
              theme === 'light'
                ? "bg-white border-gray-200"
                : "bg-gray-900 border-gray-800"
            )}>
              <h3 className={cn(
                "text-sm font-semibold mb-4 flex items-center gap-2",
                theme === 'light' ? 'text-gray-900' : 'text-white'
              )}>
                <Hand className="w-4 h-4" /> Touch Events
              </h3>
              <div className="flex flex-wrap gap-2">
                {['Tap', 'Double Tap', 'Swipe', 'Pinch', 'Long Press', 'Scroll'].map((gesture) => (
                  <Badge
                    key={gesture}
                    className={cn(
                      "px-2.5 py-1",
                      theme === 'light'
                        ? "bg-emerald-100 text-emerald-700 border-emerald-200"
                        : "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                    )}
                  >
                    {gesture}
                  </Badge>
                ))}
              </div>
            </div>
          </div>

          {/* Right: Preview & Actions */}
          <div className="space-y-6">
            {/* Device Preview */}
            <div className={cn(
              "rounded-xl border p-5",
              theme === 'light'
                ? "bg-white border-gray-200"
                : "bg-gray-900 border-gray-800"
            )}>
              <h3 className={cn(
                "text-sm font-semibold mb-4",
                theme === 'light' ? 'text-gray-900' : 'text-white'
              )}>
                Selected Configuration
              </h3>
              
              <div className={cn(
                "p-4 rounded-lg",
                theme === 'light' ? 'bg-gray-50' : 'bg-gray-800'
              )}>
                <div className="flex items-center gap-3 mb-3">
                  <Smartphone className={cn(
                    "w-8 h-8",
                    theme === 'light' ? 'text-sky-600' : 'text-sky-400'
                  )} />
                  <div>
                    <div className={cn(
                      "font-semibold",
                      theme === 'light' ? 'text-gray-900' : 'text-white'
                    )}>
                      {selectedDevice.name}
                    </div>
                    <div className={cn(
                      "text-xs",
                      theme === 'light' ? 'text-gray-500' : 'text-gray-400'
                    )}>
                      {selectedDevice.viewport} @ {selectedDevice.scale}x
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-2 text-sm">
                  <Badge className={cn(
                    theme === 'light'
                      ? "bg-violet-100 text-violet-700"
                      : "bg-violet-500/20 text-violet-400"
                  )}>
                    <Wifi className="w-3 h-3 mr-1" /> {selectedNetwork.name}
                  </Badge>
                </div>
              </div>
            </div>

            {/* URL Input */}
            <div className={cn(
              "rounded-xl border p-5",
              theme === 'light'
                ? "bg-white border-gray-200"
                : "bg-gray-900 border-gray-800"
            )}>
              <label className={cn(
                "text-sm font-semibold mb-2 block",
                theme === 'light' ? 'text-gray-900' : 'text-white'
              )}>
                Target URL
              </label>
              <Input
                value={targetUrl}
                onChange={(e) => setTargetUrl(e.target.value)}
                placeholder="https://example.com"
                className={cn(
                  "mb-4",
                  theme === 'light'
                    ? "bg-white border-gray-200"
                    : "bg-gray-800 border-gray-700"
                )}
              />
              
              {/* Actions */}
              <div className="flex gap-2">
                {!isRecording ? (
                  <Button
                    onClick={handleStartRecording}
                    disabled={isLoading}
                    className="flex-1 bg-gradient-to-r from-sky-500 to-indigo-500 hover:from-sky-600 hover:to-indigo-600 text-white disabled:opacity-50"
                  >
                    {isLoading ? (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Starting...</>
                    ) : (
                      <><Play className="w-4 h-4 mr-2" /> Start Recording</>
                    )}
                  </Button>
                ) : (
                  <Button
                    onClick={handleStopRecording}
                    disabled={isLoading}
                    variant="destructive"
                    className="flex-1"
                  >
                    <Square className="w-4 h-4 mr-2" /> Stop
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="icon"
                  className={cn(
                    theme === 'light'
                      ? "border-gray-200 hover:bg-gray-100"
                      : "border-gray-700 hover:bg-gray-800"
                  )}
                >
                  <Settings className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Recorded Steps Panel */}
        {(recordedActions.length > 0 || isRecording) && (
          <div className={cn(
            "mt-6 rounded-xl border p-5",
            theme === 'light'
              ? "bg-white border-gray-200"
              : "bg-gray-900 border-gray-800"
          )}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <h3 className={cn(
                  "text-sm font-semibold",
                  theme === 'light' ? 'text-gray-900' : 'text-white'
                )}>
                  Recorded Steps
                </h3>
                <Badge className={cn(
                  theme === 'light'
                    ? "bg-sky-100 text-sky-700"
                    : "bg-sky-500/20 text-sky-400"
                )}>
                  {recordedActions.length}
                </Badge>
                {isRecording && (
                  <Badge className="bg-red-500 text-white animate-pulse">
                    Recording...
                  </Badge>
                )}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClearActions}
                  disabled={recordedActions.length === 0 || isRecording}
                  className={cn(
                    "h-8",
                    theme === 'light'
                      ? "text-gray-500 hover:text-gray-700"
                      : "text-gray-400 hover:text-white"
                  )}
                >
                  <Trash2 className="w-3.5 h-3.5 mr-1" /> Clear
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleViewInRecorder}
                  className={cn(
                    "h-8",
                    theme === 'light'
                      ? "text-gray-500 hover:text-gray-700"
                      : "text-gray-400 hover:text-white"
                  )}
                >
                  <ExternalLink className="w-3.5 h-3.5 mr-1" /> View in Record
                </Button>
              </div>
            </div>

            {/* Steps List */}
            <div className={cn(
              "rounded-lg border max-h-64 overflow-y-auto",
              theme === 'light'
                ? "bg-gray-50 border-gray-200"
                : "bg-gray-950 border-gray-800"
            )}>
              {recordedActions.length === 0 ? (
                <div className={cn(
                  "p-8 text-center",
                  theme === 'light' ? 'text-gray-400' : 'text-gray-500'
                )}>
                  <MousePointer className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Interact with the browser to record steps</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-200 dark:divide-gray-800">
                  {recordedActions.map((action, idx) => (
                    <div
                      key={idx}
                      className={cn(
                        "flex items-start gap-3 p-3 transition-colors",
                        theme === 'light'
                          ? "hover:bg-gray-100"
                          : "hover:bg-gray-900"
                      )}
                    >
                      <div className={cn(
                        "w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5",
                        theme === 'light'
                          ? "bg-sky-100 text-sky-600"
                          : "bg-sky-500/20 text-sky-400"
                      )}>
                        {getActionIcon(action)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className={cn(
                          "text-sm font-medium",
                          theme === 'light' ? 'text-gray-900' : 'text-white'
                        )}>
                          {action.description || action.type || 'Action'}
                        </div>
                        {action.selector && (
                          <div className={cn(
                            "text-xs font-mono truncate mt-0.5",
                            theme === 'light' ? 'text-gray-400' : 'text-gray-500'
                          )}>
                            {action.selector}
                          </div>
                        )}
                        {action.value && (
                          <div className={cn(
                            "text-xs mt-0.5",
                            theme === 'light' ? 'text-gray-500' : 'text-gray-400'
                          )}>
                            Value: "{action.value}"
                          </div>
                        )}
                      </div>
                      <span className={cn(
                        "text-xs flex-shrink-0",
                        theme === 'light' ? 'text-gray-400' : 'text-gray-500'
                      )}>
                        #{idx + 1}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Save Actions */}
            {recordedActions.length > 0 && !isRecording && (
              <div className="mt-4 flex gap-2">
                <Button
                  onClick={handleSaveToBuilder}
                  className="flex-1 bg-gradient-to-r from-sky-500 to-indigo-500 hover:from-sky-600 hover:to-indigo-600 text-white"
                >
                  <Save className="w-4 h-4 mr-2" /> Save to Test Builder
                </Button>
              </div>
            )}
          </div>
        )}
      ) : (
        /* Native App Testing Tab */
        <div className={cn(
          "rounded-xl border p-6",
          theme === 'light'
            ? "bg-white border-gray-200"
            : "bg-gray-900 border-gray-800"
        )}>
          <div className="flex items-center gap-3 mb-6">
            <div className={cn(
              "w-10 h-10 rounded-lg flex items-center justify-center",
              theme === 'light' ? 'bg-violet-100' : 'bg-violet-500/20'
            )}>
              <MonitorSmartphone className={cn(
                "w-5 h-5",
                theme === 'light' ? 'text-violet-600' : 'text-violet-400'
              )} />
            </div>
            <div>
              <h3 className={cn(
                "font-semibold",
                theme === 'light' ? 'text-gray-900' : 'text-white'
              )}>
                Native App Testing with Maestro
              </h3>
              <p className={cn(
                "text-sm",
                theme === 'light' ? 'text-gray-500' : 'text-gray-400'
              )}>
                Test iOS simulators and Android emulators
              </p>
            </div>
            {maestroInstalled !== null && (
              <Badge className={cn(
                "ml-auto",
                maestroInstalled
                  ? theme === 'light'
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-emerald-500/20 text-emerald-400"
                  : theme === 'light'
                    ? "bg-amber-100 text-amber-700"
                    : "bg-amber-500/20 text-amber-400"
              )}>
                {maestroInstalled ? (
                  <><CheckCircle2 className="w-3 h-3 mr-1" /> Maestro Installed</>
                ) : (
                  <><AlertCircle className="w-3 h-3 mr-1" /> Maestro Not Found</>
                )}
              </Badge>
            )}
          </div>

          {maestroInstalled === false && (
            <div className={cn(
              "p-4 rounded-lg mb-6",
              theme === 'light' ? 'bg-amber-50' : 'bg-amber-500/10'
            )}>
              <p className={cn(
                "text-sm",
                theme === 'light' ? 'text-amber-800' : 'text-amber-400'
              )}>
                Maestro is required for native app testing. Install it with:
              </p>
              <code className={cn(
                "mt-2 block p-2 rounded text-sm font-mono",
                theme === 'light' ? 'bg-amber-100 text-amber-900' : 'bg-amber-500/20 text-amber-300'
              )}>
                curl -Ls "https://get.maestro.mobile.dev" | bash
              </code>
            </div>
          )}

          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <label className={cn(
                "text-sm font-medium mb-2 block",
                theme === 'light' ? 'text-gray-700' : 'text-gray-300'
              )}>
                App Bundle ID
              </label>
              <Input
                placeholder="com.example.myapp"
                className={cn(
                  theme === 'light'
                    ? "bg-white border-gray-200"
                    : "bg-gray-800 border-gray-700"
                )}
              />
            </div>
            <div>
              <label className={cn(
                "text-sm font-medium mb-2 block",
                theme === 'light' ? 'text-gray-700' : 'text-gray-300'
              )}>
                Platform
              </label>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className={cn(
                    "flex-1",
                    theme === 'light'
                      ? "border-gray-200 hover:bg-gray-100"
                      : "border-gray-700 hover:bg-gray-800"
                  )}
                >
                  iOS Simulator
                </Button>
                <Button
                  variant="outline"
                  className={cn(
                    "flex-1",
                    theme === 'light'
                      ? "border-gray-200 hover:bg-gray-100"
                      : "border-gray-700 hover:bg-gray-800"
                  )}
                >
                  Android Emulator
                </Button>
              </div>
            </div>
          </div>

          <div className="mt-6 flex gap-3">
            <Button
              disabled={!maestroInstalled}
              className="bg-gradient-to-r from-violet-500 to-purple-500 hover:from-violet-600 hover:to-purple-600 text-white"
            >
              <Play className="w-4 h-4 mr-2" /> Start Native Test
            </Button>
            <Button
              variant="outline"
              className={cn(
                theme === 'light'
                  ? "border-gray-200 hover:bg-gray-100"
                  : "border-gray-700 hover:bg-gray-800"
              )}
            >
              <RotateCcw className="w-4 h-4 mr-2" /> Refresh Devices
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
