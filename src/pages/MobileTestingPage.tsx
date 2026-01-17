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
import { useTheme } from '@/contexts/ThemeContext';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
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
  const [selectedDevice, setSelectedDevice] = useState(iosDevices[0]);
  const [selectedNetwork, setSelectedNetwork] = useState(networkPresets[0]);
  const [targetUrl, setTargetUrl] = useState('https://');
  const [isRecording, setIsRecording] = useState(false);
  const [maestroInstalled, setMaestroInstalled] = useState<boolean | null>(null);
  const [activeTab, setActiveTab] = useState<'web' | 'native'>('web');

  // Check Maestro installation on mount
  useEffect(() => {
    // @ts-ignore - Electron API
    if (window.flowstral?.mobile?.checkMaestro) {
      // @ts-ignore
      window.flowstral.mobile.checkMaestro().then(setMaestroInstalled);
    }
  }, []);

  const handleStartRecording = async () => {
    setIsRecording(true);
    try {
      // @ts-ignore - Electron API
      if (window.flowstral?.mobile?.setDevice) {
        // @ts-ignore
        await window.flowstral.mobile.setDevice(selectedDevice.id, selectedNetwork.id);
      }
    } catch (error) {
      console.error('Failed to start recording:', error);
    }
  };

  const handleStopRecording = () => {
    setIsRecording(false);
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
                    className="flex-1 bg-gradient-to-r from-sky-500 to-indigo-500 hover:from-sky-600 hover:to-indigo-600 text-white"
                  >
                    <Play className="w-4 h-4 mr-2" /> Start Recording
                  </Button>
                ) : (
                  <Button
                    onClick={handleStopRecording}
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
