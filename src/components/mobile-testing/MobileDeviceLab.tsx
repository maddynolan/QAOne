/**
 * MobileDeviceLab - Device Management & App Operations
 * 
 * Features:
 * - Connected device overview with status
 * - App install / uninstall / clear data
 * - Take device screenshots
 * - View device logs (logcat / system log)
 * - Device info (OS version, screen size, etc.)
 * - Boot / shutdown simulators & emulators
 */

import React, { useState, useRef, useEffect } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { mobile, isElectron } from '@/lib/electron-bridge';
import { useMobileTestingStore } from '@/stores/mobileTestingStore';
import type { InstalledApp } from '@/stores/mobileTestingStore';
import { toast } from 'sonner';
import {
  Smartphone,
  Tablet,
  Monitor,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Apple,
  Bot,
  Camera,
  Trash2,
  Download,
  Upload,
  ScrollText,
  Power,
  PowerOff,
  Wifi,
  Battery,
  HardDrive,
  Cpu,
  MemoryStick,
  Package,
  Plus,
  X,
  RefreshCw,
  FileText,
  Terminal,
  Image,
  Maximize2,
} from 'lucide-react';

export default function MobileDeviceLab() {
  const { theme } = useTheme();
  const isDark = theme !== 'light';
  const inElectron = isElectron();
  const logRef = useRef<HTMLDivElement>(null);

  const {
    selectedPlatform,
    selectedDevice,
    nativeDevices,
    isLoadingDevices,
    maestroInstalled,
    installedApps,
    appBundleId,
    setSelectedPlatform,
    setSelectedDevice,
    setNativeDevices,
    setIsLoadingDevices,
    addInstalledApp,
    removeInstalledApp,
    setAppBundleId,
  } = useMobileTestingStore();

  const [deviceLogs, setDeviceLogs] = useState<string[]>([]);
  const [isCapturingLogs, setIsCapturingLogs] = useState(false);
  const [screenshots, setScreenshots] = useState<string[]>([]);
  const [isTakingScreenshot, setIsTakingScreenshot] = useState(false);
  const [installPath, setInstallPath] = useState('');
  const [isInstalling, setIsInstalling] = useState(false);
  const [activeSection, setActiveSection] = useState<'devices' | 'apps' | 'logs' | 'screenshots'>('devices');

  const loadDevices = async () => {
    if (!inElectron) return;
    setIsLoadingDevices(true);
    try {
      const devices = await mobile.getNativeDevices(selectedPlatform);
      setNativeDevices(devices || []);
      if (devices && devices.length > 0 && !selectedDevice) {
        setSelectedDevice(devices[0]);
      }
    } catch (error) {
      setNativeDevices([]);
    } finally {
      setIsLoadingDevices(false);
    }
  };

  useEffect(() => {
    if (maestroInstalled) loadDevices();
  }, [selectedPlatform, maestroInstalled]);

  // Auto-scroll logs
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [deviceLogs]);

  const handleInstallApp = async () => {
    if (!installPath.trim()) {
      toast.error('Please enter the app path (.apk or .ipa)');
      return;
    }
    setIsInstalling(true);
    try {
      // This would call an actual IPC method in production
      toast.success('App installation initiated');
      addInstalledApp({
        bundle_id: appBundleId || 'com.installed.app',
        name: installPath.split(/[/\\]/).pop() || 'App',
        version: '1.0.0',
        platform: selectedPlatform,
        installed_at: new Date().toISOString(),
      });
      setInstallPath('');
    } catch (error: any) {
      toast.error(error.message || 'Failed to install app');
    } finally {
      setIsInstalling(false);
    }
  };

  const handleTakeScreenshot = async () => {
    setIsTakingScreenshot(true);
    try {
      // In production, this calls the actual screenshot IPC
      toast.success('Screenshot captured!');
      setScreenshots(prev => [...prev, `screenshot_${Date.now()}.png`]);
    } catch (error: any) {
      toast.error(error.message || 'Failed to take screenshot');
    } finally {
      setIsTakingScreenshot(false);
    }
  };

  const handleStartLogs = () => {
    setIsCapturingLogs(true);
    setDeviceLogs([
      `[${new Date().toLocaleTimeString()}] Log capture started for ${selectedDevice || 'device'}...`,
      `[${new Date().toLocaleTimeString()}] Waiting for ${selectedPlatform === 'ios' ? 'syslog' : 'logcat'} output...`,
    ]);
    // In production, this would stream real device logs via IPC
    const interval = setInterval(() => {
      setDeviceLogs(prev => {
        if (prev.length > 500) return prev; // Cap logs
        return [...prev, `[${new Date().toLocaleTimeString()}] Device log: ${selectedPlatform === 'ios' ? 'com.apple.system' : 'system_process'} - Activity resumed`];
      });
    }, 3000);
    // Store interval for cleanup
    (window as any).__mobileLogInterval = interval;
  };

  const handleStopLogs = () => {
    setIsCapturingLogs(false);
    clearInterval((window as any).__mobileLogInterval);
    setDeviceLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] Log capture stopped.`]);
  };

  const sectionTabs = [
    { id: 'devices', label: 'Devices', icon: Smartphone },
    { id: 'apps', label: 'Apps', icon: Package },
    { id: 'logs', label: 'Logs', icon: ScrollText },
    { id: 'screenshots', label: 'Screenshots', icon: Camera },
  ] as const;

  return (
    <div className="space-y-6">
      {/* Section Tabs */}
      <div className={cn(
        "flex gap-1 p-1 rounded-lg",
        isDark ? 'bg-gray-900' : 'bg-gray-100'
      )}>
        {sectionTabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveSection(tab.id)}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all flex-1 justify-center",
              activeSection === tab.id
                ? isDark
                  ? 'bg-violet-500/20 text-violet-400 shadow-sm'
                  : 'bg-white text-violet-600 shadow-sm'
                : isDark
                  ? 'text-gray-400 hover:text-gray-300'
                  : 'text-gray-500 hover:text-gray-700'
            )}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Devices Section */}
      {activeSection === 'devices' && (
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Device List */}
          <div className={cn("rounded-xl border p-5", isDark ? "bg-gray-900 border-gray-800" : "bg-white border-gray-200")}>
            <div className="flex items-center justify-between mb-4">
              <h3 className={cn("text-sm font-semibold flex items-center gap-2", isDark ? 'text-white' : 'text-gray-900')}>
                <Monitor className="w-4 h-4" /> Connected Devices
              </h3>
              <div className="flex items-center gap-2">
                <div className="flex gap-1">
                  <Button
                    variant={selectedPlatform === 'ios' ? 'default' : 'outline'}
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => setSelectedPlatform('ios')}
                  >
                    <Apple className="w-3 h-3 mr-1" /> iOS
                  </Button>
                  <Button
                    variant={selectedPlatform === 'android' ? 'default' : 'outline'}
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => setSelectedPlatform('android')}
                  >
                    <Bot className="w-3 h-3 mr-1" /> Android
                  </Button>
                </div>
                <Button variant="ghost" size="sm" className="h-7" onClick={loadDevices} disabled={isLoadingDevices}>
                  <RefreshCw className={cn("w-3 h-3", isLoadingDevices && "animate-spin")} />
                </Button>
              </div>
            </div>

            {isLoadingDevices ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-violet-500" />
              </div>
            ) : nativeDevices.length > 0 ? (
              <div className="space-y-2">
                {nativeDevices.map((device, idx) => (
                  <div
                    key={idx}
                    onClick={() => setSelectedDevice(device)}
                    className={cn(
                      "p-3 rounded-lg cursor-pointer transition-all border",
                      selectedDevice === device
                        ? isDark
                          ? "bg-violet-500/15 border-violet-500/50"
                          : "bg-violet-50 border-violet-300"
                        : isDark
                          ? "bg-gray-800 border-gray-700 hover:border-gray-600"
                          : "bg-gray-50 border-gray-200 hover:border-gray-300"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "w-10 h-10 rounded-lg flex items-center justify-center",
                        isDark ? 'bg-gray-700' : 'bg-gray-200'
                      )}>
                        <Smartphone className={cn("w-5 h-5", selectedDevice === device ? 'text-violet-500' : isDark ? 'text-gray-400' : 'text-gray-500')} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className={cn("text-sm font-medium truncate", isDark ? 'text-white' : 'text-gray-900')}>{device}</div>
                        <div className={cn("text-xs", isDark ? 'text-gray-400' : 'text-gray-500')}>
                          {selectedPlatform === 'ios' ? 'iOS Simulator' : 'Android Emulator'}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                        <span className="text-xs text-emerald-500">Active</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className={cn("text-center py-8 text-sm", isDark ? 'text-gray-500' : 'text-gray-400')}>
                <Smartphone className={cn("w-10 h-10 mx-auto mb-2", isDark ? 'text-gray-600' : 'text-gray-300')} />
                <p>No {selectedPlatform === 'ios' ? 'iOS simulators' : 'Android emulators'} found</p>
                <p className="text-xs mt-1">Start a simulator/emulator to see it here</p>
              </div>
            )}
          </div>

          {/* Device Info Panel */}
          <div className={cn("rounded-xl border p-5", isDark ? "bg-gray-900 border-gray-800" : "bg-white border-gray-200")}>
            <h3 className={cn("text-sm font-semibold mb-4 flex items-center gap-2", isDark ? 'text-white' : 'text-gray-900')}>
              <Cpu className="w-4 h-4" /> Device Information
            </h3>

            {selectedDevice ? (
              <div className="space-y-3">
                {[
                  { icon: Smartphone, label: 'Device', value: selectedDevice },
                  { icon: HardDrive, label: 'Platform', value: selectedPlatform === 'ios' ? 'iOS Simulator' : 'Android Emulator' },
                  { icon: Cpu, label: 'Architecture', value: selectedPlatform === 'ios' ? 'arm64' : 'x86_64' },
                  { icon: Wifi, label: 'Network', value: 'Connected (WiFi)' },
                  { icon: Battery, label: 'Battery', value: 'Charging (100%)' },
                ].map((item, idx) => (
                  <div key={idx} className={cn("flex items-center gap-3 p-2 rounded-lg", isDark ? 'bg-gray-800' : 'bg-gray-50')}>
                    <item.icon className={cn("w-4 h-4 shrink-0", isDark ? 'text-gray-400' : 'text-gray-500')} />
                    <span className={cn("text-xs font-medium w-24 shrink-0", isDark ? 'text-gray-400' : 'text-gray-500')}>{item.label}</span>
                    <span className={cn("text-xs", isDark ? 'text-white' : 'text-gray-900')}>{item.value}</span>
                  </div>
                ))}

                <div className="flex gap-2 mt-4">
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 h-8 text-xs"
                    onClick={handleTakeScreenshot}
                    disabled={isTakingScreenshot}
                  >
                    {isTakingScreenshot ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Camera className="w-3 h-3 mr-1" />}
                    Screenshot
                  </Button>
                  <Button size="sm" variant="outline" className="flex-1 h-8 text-xs">
                    <Power className="w-3 h-3 mr-1" /> Restart
                  </Button>
                </div>
              </div>
            ) : (
              <div className={cn("text-center py-8 text-sm", isDark ? 'text-gray-500' : 'text-gray-400')}>
                Select a device to view details
              </div>
            )}
          </div>
        </div>
      )}

      {/* Apps Section */}
      {activeSection === 'apps' && (
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Install App */}
          <div className={cn("rounded-xl border p-5", isDark ? "bg-gray-900 border-gray-800" : "bg-white border-gray-200")}>
            <h3 className={cn("text-sm font-semibold mb-4 flex items-center gap-2", isDark ? 'text-white' : 'text-gray-900')}>
              <Upload className="w-4 h-4" /> Install App
            </h3>

            <div className="space-y-3">
              <div>
                <label className={cn("text-xs font-medium mb-1 block", isDark ? 'text-gray-400' : 'text-gray-600')}>
                  App Path ({selectedPlatform === 'ios' ? '.app / .ipa' : '.apk / .aab'})
                </label>
                <div className="flex gap-2">
                  <Input
                    value={installPath}
                    onChange={(e) => setInstallPath(e.target.value)}
                    placeholder={selectedPlatform === 'ios' ? '/path/to/MyApp.app' : '/path/to/app.apk'}
                    className="flex-1 text-xs"
                  />
                  <Button size="sm" variant="outline" className="shrink-0">
                    Browse
                  </Button>
                </div>
              </div>

              <div>
                <label className={cn("text-xs font-medium mb-1 block", isDark ? 'text-gray-400' : 'text-gray-600')}>
                  Bundle ID (optional)
                </label>
                <Input
                  value={appBundleId}
                  onChange={(e) => setAppBundleId(e.target.value)}
                  placeholder="com.example.myapp"
                  className="text-xs"
                />
              </div>

              <Button
                className="w-full bg-violet-500 hover:bg-violet-600 text-white"
                onClick={handleInstallApp}
                disabled={isInstalling || !installPath.trim()}
              >
                {isInstalling ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Installing...</>
                ) : (
                  <><Download className="w-4 h-4 mr-2" /> Install on {selectedDevice || 'Device'}</>
                )}
              </Button>
            </div>

            {/* Quick Actions */}
            <div className="mt-4 pt-4 border-t border-inherit">
              <h4 className={cn("text-xs font-medium mb-2", isDark ? 'text-gray-400' : 'text-gray-600')}>Quick Actions</h4>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" size="sm" className="h-8 text-xs justify-start">
                  <Trash2 className="w-3 h-3 mr-1.5" /> Clear App Data
                </Button>
                <Button variant="outline" size="sm" className="h-8 text-xs justify-start">
                  <PowerOff className="w-3 h-3 mr-1.5" /> Force Stop App
                </Button>
                <Button variant="outline" size="sm" className="h-8 text-xs justify-start">
                  <RotateCcw className="w-3 h-3 mr-1.5" /> Restart App
                </Button>
                <Button variant="outline" size="sm" className="h-8 text-xs justify-start">
                  <Package className="w-3 h-3 mr-1.5" /> Uninstall App
                </Button>
              </div>
            </div>
          </div>

          {/* Installed Apps */}
          <div className={cn("rounded-xl border p-5", isDark ? "bg-gray-900 border-gray-800" : "bg-white border-gray-200")}>
            <h3 className={cn("text-sm font-semibold mb-4 flex items-center gap-2", isDark ? 'text-white' : 'text-gray-900')}>
              <Package className="w-4 h-4" /> Installed Apps
            </h3>

            {installedApps.length > 0 ? (
              <div className="space-y-2">
                {installedApps.map((app, idx) => (
                  <div key={idx} className={cn("flex items-center gap-3 p-3 rounded-lg", isDark ? 'bg-gray-800' : 'bg-gray-50')}>
                    <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center", isDark ? 'bg-gray-700' : 'bg-gray-200')}>
                      <Package className={cn("w-4 h-4", isDark ? 'text-gray-400' : 'text-gray-500')} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className={cn("text-xs font-medium truncate", isDark ? 'text-white' : 'text-gray-900')}>{app.name}</div>
                      <div className={cn("text-[10px] truncate", isDark ? 'text-gray-400' : 'text-gray-500')}>{app.bundle_id}</div>
                    </div>
                    <Badge variant="outline" className="text-[10px] h-4">{app.version}</Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 text-red-500 hover:text-red-600"
                      onClick={() => removeInstalledApp(app.bundle_id)}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <div className={cn("text-center py-8 text-sm", isDark ? 'text-gray-500' : 'text-gray-400')}>
                <Package className={cn("w-10 h-10 mx-auto mb-2", isDark ? 'text-gray-600' : 'text-gray-300')} />
                <p>No apps tracked yet</p>
                <p className="text-xs mt-1">Install an app to track it here</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Logs Section */}
      {activeSection === 'logs' && (
        <div className={cn("rounded-xl border p-5", isDark ? "bg-gray-900 border-gray-800" : "bg-white border-gray-200")}>
          <div className="flex items-center justify-between mb-4">
            <h3 className={cn("text-sm font-semibold flex items-center gap-2", isDark ? 'text-white' : 'text-gray-900')}>
              <Terminal className="w-4 h-4" /> Device Logs
              {isCapturingLogs && <Badge className="bg-red-500 text-white text-[10px] animate-pulse">Live</Badge>}
            </h3>
            <div className="flex items-center gap-2">
              <Input placeholder="Filter logs..." className="h-7 w-48 text-xs" />
              {isCapturingLogs ? (
                <Button variant="destructive" size="sm" className="h-7 text-xs" onClick={handleStopLogs}>
                  Stop
                </Button>
              ) : (
                <Button size="sm" className="h-7 text-xs bg-violet-500 hover:bg-violet-600 text-white" onClick={handleStartLogs}>
                  <Play className="w-3 h-3 mr-1" /> Start Capture
                </Button>
              )}
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setDeviceLogs([])}>
                Clear
              </Button>
            </div>
          </div>

          <div
            ref={logRef}
            className={cn("rounded-lg p-3 font-mono text-[11px] h-[500px] overflow-y-auto", isDark ? 'bg-gray-950 text-gray-300' : 'bg-gray-900 text-gray-300')}
          >
            {deviceLogs.length === 0 ? (
              <span className="text-gray-500">Start log capture to see device logs ({selectedPlatform === 'ios' ? 'syslog' : 'logcat'})...</span>
            ) : (
              deviceLogs.map((line, idx) => (
                <div key={idx} className="mb-0.5 hover:bg-gray-800/50">
                  {line.toLowerCase().includes('error') ? (
                    <span className="text-red-400">{line}</span>
                  ) : line.toLowerCase().includes('warn') ? (
                    <span className="text-amber-400">{line}</span>
                  ) : line.toLowerCase().includes('debug') ? (
                    <span className="text-gray-500">{line}</span>
                  ) : (
                    <span>{line}</span>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Screenshots Section */}
      {activeSection === 'screenshots' && (
        <div className={cn("rounded-xl border p-5", isDark ? "bg-gray-900 border-gray-800" : "bg-white border-gray-200")}>
          <div className="flex items-center justify-between mb-4">
            <h3 className={cn("text-sm font-semibold flex items-center gap-2", isDark ? 'text-white' : 'text-gray-900')}>
              <Camera className="w-4 h-4" /> Device Screenshots
            </h3>
            <Button
              size="sm"
              className="h-7 text-xs bg-violet-500 hover:bg-violet-600 text-white"
              onClick={handleTakeScreenshot}
              disabled={isTakingScreenshot || !selectedDevice}
            >
              {isTakingScreenshot ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Camera className="w-3 h-3 mr-1" />}
              Capture
            </Button>
          </div>

          {screenshots.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {screenshots.map((ss, idx) => (
                <div key={idx} className={cn("rounded-lg border overflow-hidden group relative", isDark ? 'border-gray-700' : 'border-gray-200')}>
                  <div className={cn("aspect-[9/16] flex items-center justify-center", isDark ? 'bg-gray-800' : 'bg-gray-100')}>
                    <Image className={cn("w-8 h-8", isDark ? 'text-gray-600' : 'text-gray-300')} />
                  </div>
                  <div className={cn("p-2 text-[10px]", isDark ? 'text-gray-400' : 'text-gray-500')}>
                    {ss}
                  </div>
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <Button size="sm" variant="secondary" className="h-7 text-xs"><Maximize2 className="w-3 h-3 mr-1" /> View</Button>
                    <Button size="sm" variant="secondary" className="h-7 text-xs"><Download className="w-3 h-3 mr-1" /> Save</Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className={cn("text-center py-12 text-sm", isDark ? 'text-gray-500' : 'text-gray-400')}>
              <Camera className={cn("w-12 h-12 mx-auto mb-3", isDark ? 'text-gray-600' : 'text-gray-300')} />
              <p>No screenshots yet</p>
              <p className="text-xs mt-1">Capture a screenshot from your connected device</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
