/**
 * Mobile Device Selector Component
 * 
 * Provides UI for selecting mobile device emulation and viewing
 * mobile testing configuration. Part of QAAI's Mobile Testing Pack.
 * 
 * Features:
 * - Device dropdown with 50+ real device profiles
 * - Network throttling presets (5G, 4G, 3G, Slow 3G)
 * - Real-time configuration display
 * - Native app testing status (Maestro)
 */

import React, { useState, useEffect, useCallback } from 'react';
import { 
  Smartphone, 
  Tablet, 
  Monitor, 
  Wifi, 
  WifiOff, 
  ChevronDown,
  Check,
  X,
  Loader2,
  Apple,
  RefreshCw
} from 'lucide-react';

// Type definitions
interface DeviceConfig {
  viewport: { width: number; height: number };
  deviceScaleFactor: number;
  isMobile: boolean;
  hasTouch: boolean;
  defaultBrowserType: string;
  userAgent: string;
}

interface DeviceCategories {
  [category: string]: string[];
}

interface DevicesData {
  categories: DeviceCategories;
  devices: { [name: string]: DeviceConfig };
  networks: { [name: string]: object };
}

interface MobileConfig {
  device: string | null;
  viewport: { width: number; height: number } | null;
  userAgent: string | null;
  network: string | null;
}

interface MaestroStatus {
  installed: boolean;
  version: string | null;
  androidAvailable: boolean;
  iosAvailable: boolean;
  errors: string[];
}

interface MobileDeviceSelectorProps {
  onDeviceChange?: (device: string | null, network: string | null) => void;
  showNetworkOptions?: boolean;
  showMaestroStatus?: boolean;
  compact?: boolean;
  className?: string;
}

// Declare the flowstral global for TypeScript
declare global {
  interface Window {
    flowstral?: {
      mobile?: {
        getDevices: () => Promise<{ success: boolean; devices: DevicesData }>;
        setDevice: (deviceName: string | null, network?: string | null) => Promise<{ success: boolean; config: MobileConfig }>;
        getConfig: () => Promise<{ success: boolean; config: MobileConfig | null; isMobile: boolean }>;
        clearDevice: () => Promise<{ success: boolean }>;
        checkMaestro: () => Promise<MaestroStatus & { success: boolean }>;
      };
    };
  }
}

// Android icon component (Lucide doesn't have one)
const AndroidIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
    <path d="M17.523 15.3414C17.523 15.6414 17.28 15.8844 16.98 15.8844H16.23V17.9334C16.23 18.5334 15.75 19.0134 15.15 19.0134C14.55 19.0134 14.07 18.5334 14.07 17.9334V15.8844H9.93V17.9334C9.93 18.5334 9.45 19.0134 8.85 19.0134C8.25 19.0134 7.77 18.5334 7.77 17.9334V15.8844H7.02C6.72 15.8844 6.477 15.6414 6.477 15.3414V8.91341H17.523V15.3414ZM5.727 8.91341C5.127 8.91341 4.647 9.39341 4.647 9.99341V14.5134C4.647 15.1134 5.127 15.5934 5.727 15.5934C6.327 15.5934 6.807 15.1134 6.807 14.5134V9.99341C6.807 9.39341 6.327 8.91341 5.727 8.91341ZM18.273 8.91341C17.673 8.91341 17.193 9.39341 17.193 9.99341V14.5134C17.193 15.1134 17.673 15.5934 18.273 15.5934C18.873 15.5934 19.353 15.1134 19.353 14.5134V9.99341C19.353 9.39341 18.873 8.91341 18.273 8.91341ZM15.87 4.02341L16.917 2.04341C16.995 1.89341 16.941 1.71341 16.791 1.63541C16.641 1.55741 16.461 1.61141 16.383 1.76141L15.318 3.77141C14.268 3.30341 13.074 3.03341 11.799 3.03341C10.524 3.03341 9.33 3.30341 8.28 3.77141L7.215 1.76141C7.137 1.61141 6.957 1.55741 6.807 1.63541C6.657 1.71341 6.603 1.89341 6.681 2.04341L7.728 4.02341C5.616 5.13341 4.176 7.29341 4.176 9.81341H19.422C19.422 7.29341 17.982 5.13341 15.87 4.02341ZM9.45 7.29341H8.55V6.39341H9.45V7.29341ZM15.45 7.29341H14.55V6.39341H15.45V7.29341Z"/>
  </svg>
);

export const MobileDeviceSelector: React.FC<MobileDeviceSelectorProps> = ({
  onDeviceChange,
  showNetworkOptions = true,
  showMaestroStatus = false,
  compact = false,
  className = ''
}) => {
  // State
  const [devices, setDevices] = useState<DevicesData | null>(null);
  const [currentConfig, setCurrentConfig] = useState<MobileConfig | null>(null);
  const [selectedDevice, setSelectedDevice] = useState<string | null>(null);
  const [selectedNetwork, setSelectedNetwork] = useState<string | null>(null);
  const [maestroStatus, setMaestroStatus] = useState<MaestroStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load devices and current config on mount
  useEffect(() => {
    loadDevicesAndConfig();
    if (showMaestroStatus) {
      checkMaestroStatus();
    }
  }, [showMaestroStatus]);

  const loadDevicesAndConfig = async () => {
    try {
      setLoading(true);
      setError(null);

      if (!window.flowstral?.mobile) {
        setError('Mobile API not available. Run in Electron app.');
        return;
      }

      // Load available devices
      const devicesResult = await window.flowstral.mobile.getDevices();
      if (devicesResult.success) {
        setDevices(devicesResult.devices);
      }

      // Load current configuration
      const configResult = await window.flowstral.mobile.getConfig();
      if (configResult.success && configResult.config) {
        setCurrentConfig(configResult.config);
        setSelectedDevice(configResult.config.device);
        setSelectedNetwork(configResult.config.network);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load mobile devices');
    } finally {
      setLoading(false);
    }
  };

  const checkMaestroStatus = async () => {
    try {
      if (!window.flowstral?.mobile) return;
      
      const result = await window.flowstral.mobile.checkMaestro();
      if (result.success) {
        setMaestroStatus(result);
      }
    } catch (err) {
      console.error('Failed to check Maestro status:', err);
    }
  };

  const handleDeviceSelect = useCallback(async (deviceName: string | null) => {
    try {
      setApplying(true);
      setSelectedDevice(deviceName);

      if (!window.flowstral?.mobile) return;

      const result = await window.flowstral.mobile.setDevice(deviceName, selectedNetwork);
      if (result.success) {
        setCurrentConfig(result.config);
        onDeviceChange?.(deviceName, selectedNetwork);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to set device');
    } finally {
      setApplying(false);
      setIsOpen(false);
    }
  }, [selectedNetwork, onDeviceChange]);

  const handleNetworkSelect = useCallback(async (networkName: string | null) => {
    try {
      setApplying(true);
      setSelectedNetwork(networkName);

      if (!window.flowstral?.mobile) return;

      const result = await window.flowstral.mobile.setDevice(selectedDevice, networkName);
      if (result.success) {
        setCurrentConfig(result.config);
        onDeviceChange?.(selectedDevice, networkName);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to set network');
    } finally {
      setApplying(false);
    }
  }, [selectedDevice, onDeviceChange]);

  const handleClearDevice = useCallback(async () => {
    try {
      setApplying(true);
      
      if (!window.flowstral?.mobile) return;

      await window.flowstral.mobile.clearDevice();
      setSelectedDevice(null);
      setSelectedNetwork(null);
      setCurrentConfig(null);
      onDeviceChange?.(null, null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to clear device');
    } finally {
      setApplying(false);
    }
  }, [onDeviceChange]);

  // Get icon for device
  const getDeviceIcon = (deviceName: string | null) => {
    if (!deviceName) return <Monitor className="w-4 h-4" />;
    const lower = deviceName.toLowerCase();
    if (lower.includes('ipad') || lower.includes('tab')) {
      return <Tablet className="w-4 h-4" />;
    }
    return <Smartphone className="w-4 h-4" />;
  };

  // Get platform icon
  const getPlatformIcon = (deviceName: string) => {
    const lower = deviceName.toLowerCase();
    if (lower.includes('iphone') || lower.includes('ipad')) {
      return <Apple className="w-3 h-3" />;
    }
    return <AndroidIcon className="w-3 h-3" />;
  };

  // Render loading state
  if (loading) {
    return (
      <div className={`flex items-center gap-2 text-muted-foreground ${className}`}>
        <Loader2 className="w-4 h-4 animate-spin" />
        <span className="text-sm">Loading devices...</span>
      </div>
    );
  }

  // Render error state
  if (error) {
    return (
      <div className={`flex items-center gap-2 text-destructive ${className}`}>
        <X className="w-4 h-4" />
        <span className="text-sm">{error}</span>
        <button onClick={loadDevicesAndConfig} className="text-primary hover:underline text-sm">
          Retry
        </button>
      </div>
    );
  }

  // Compact mode - just a button with current state
  if (compact) {
    return (
      <div className={`relative ${className}`}>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-md border transition-colors
            ${selectedDevice 
              ? 'bg-primary/10 border-primary text-primary' 
              : 'bg-background border-border hover:bg-muted'
            }`}
        >
          {getDeviceIcon(selectedDevice)}
          <span className="text-sm font-medium">
            {selectedDevice || 'Desktop'}
          </span>
          <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>

        {/* Dropdown */}
        {isOpen && devices && (
          <div className="absolute top-full left-0 mt-1 z-50 w-64 bg-popover border border-border rounded-lg shadow-lg overflow-hidden">
            <div className="max-h-80 overflow-y-auto">
              {/* Desktop option */}
              <button
                onClick={() => handleDeviceSelect(null)}
                className="w-full flex items-center gap-2 px-3 py-2 hover:bg-muted text-left"
              >
                <Monitor className="w-4 h-4" />
                <span className="flex-1">Desktop</span>
                {!selectedDevice && <Check className="w-4 h-4 text-primary" />}
              </button>
              
              <div className="border-t border-border my-1" />

              {/* Device categories */}
              {Object.entries(devices.categories).map(([category, deviceNames]) => (
                <div key={category}>
                  <div className="px-3 py-1 text-xs font-semibold text-muted-foreground bg-muted/50">
                    {category}
                  </div>
                  {deviceNames.map(name => (
                    <button
                      key={name}
                      onClick={() => handleDeviceSelect(name)}
                      className="w-full flex items-center gap-2 px-3 py-2 hover:bg-muted text-left"
                    >
                      {getDeviceIcon(name)}
                      <span className="flex-1 text-sm">{name}</span>
                      {getPlatformIcon(name)}
                      {selectedDevice === name && <Check className="w-4 h-4 text-primary" />}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // Full mode - expanded panel
  return (
    <div className={`space-y-4 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Smartphone className="w-4 h-4" />
          Mobile Testing
        </h3>
        <button
          onClick={loadDevicesAndConfig}
          className="p-1 hover:bg-muted rounded"
          title="Refresh"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Current Configuration */}
      {currentConfig && currentConfig.device && (
        <div className="bg-primary/10 border border-primary/20 rounded-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-primary">
              {currentConfig.device}
            </span>
            <button
              onClick={handleClearDevice}
              disabled={applying}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Clear
            </button>
          </div>
          {currentConfig.viewport && (
            <div className="text-xs text-muted-foreground">
              {currentConfig.viewport.width} × {currentConfig.viewport.height}
              {currentConfig.network && ` • ${currentConfig.network}`}
            </div>
          )}
        </div>
      )}

      {/* Device Selection */}
      <div className="space-y-2">
        <label className="text-xs text-muted-foreground">Device</label>
        <div className="relative">
          <button
            onClick={() => setIsOpen(!isOpen)}
            disabled={applying}
            className="w-full flex items-center justify-between px-3 py-2 bg-background border border-border rounded-md hover:bg-muted disabled:opacity-50"
          >
            <span className="flex items-center gap-2">
              {applying ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                getDeviceIcon(selectedDevice)
              )}
              {selectedDevice || 'Desktop (Default)'}
            </span>
            <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
          </button>

          {/* Dropdown */}
          {isOpen && devices && (
            <div className="absolute top-full left-0 right-0 mt-1 z-50 bg-popover border border-border rounded-lg shadow-lg overflow-hidden">
              <div className="max-h-60 overflow-y-auto">
                {/* Desktop option */}
                <button
                  onClick={() => handleDeviceSelect(null)}
                  className="w-full flex items-center gap-2 px-3 py-2 hover:bg-muted text-left"
                >
                  <Monitor className="w-4 h-4" />
                  <span className="flex-1">Desktop (Default)</span>
                  {!selectedDevice && <Check className="w-4 h-4 text-primary" />}
                </button>
                
                <div className="border-t border-border my-1" />

                {/* Device categories */}
                {Object.entries(devices.categories).map(([category, deviceNames]) => (
                  <div key={category}>
                    <div className="px-3 py-1 text-xs font-semibold text-muted-foreground bg-muted/50 sticky top-0">
                      {category}
                    </div>
                    {deviceNames.map(name => {
                      const device = devices.devices[name];
                      return (
                        <button
                          key={name}
                          onClick={() => handleDeviceSelect(name)}
                          className="w-full flex items-center gap-2 px-3 py-2 hover:bg-muted text-left"
                        >
                          {getDeviceIcon(name)}
                          <div className="flex-1 min-w-0">
                            <div className="text-sm truncate">{name}</div>
                            {device && (
                              <div className="text-xs text-muted-foreground">
                                {device.viewport.width} × {device.viewport.height}
                              </div>
                            )}
                          </div>
                          {getPlatformIcon(name)}
                          {selectedDevice === name && <Check className="w-4 h-4 text-primary" />}
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Network Selection */}
      {showNetworkOptions && devices?.networks && (
        <div className="space-y-2">
          <label className="text-xs text-muted-foreground">Network Throttling</label>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => handleNetworkSelect(null)}
              disabled={applying}
              className={`px-3 py-1 rounded-md text-sm transition-colors ${
                !selectedNetwork
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted hover:bg-muted/80'
              }`}
            >
              <Wifi className="w-3 h-3 inline mr-1" />
              None
            </button>
            {Object.keys(devices.networks).map(network => (
              <button
                key={network}
                onClick={() => handleNetworkSelect(network)}
                disabled={applying}
                className={`px-3 py-1 rounded-md text-sm transition-colors ${
                  selectedNetwork === network
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted hover:bg-muted/80'
                }`}
              >
                {network === 'Offline' ? (
                  <WifiOff className="w-3 h-3 inline mr-1" />
                ) : (
                  <Wifi className="w-3 h-3 inline mr-1" />
                )}
                {network}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Maestro Status */}
      {showMaestroStatus && maestroStatus && (
        <div className="space-y-2 pt-2 border-t border-border">
          <label className="text-xs text-muted-foreground">Native App Testing</label>
          <div className="bg-muted rounded-md p-3">
            <div className="flex items-center gap-2 mb-2">
              {maestroStatus.installed ? (
                <>
                  <Check className="w-4 h-4 text-green-500" />
                  <span className="text-sm text-green-500">Maestro Installed</span>
                  {maestroStatus.version && (
                    <span className="text-xs text-muted-foreground">
                      v{maestroStatus.version}
                    </span>
                  )}
                </>
              ) : (
                <>
                  <X className="w-4 h-4 text-destructive" />
                  <span className="text-sm text-destructive">Maestro Not Installed</span>
                </>
              )}
            </div>
            
            {maestroStatus.installed && (
              <div className="flex gap-4 text-xs">
                <div className="flex items-center gap-1">
                  <AndroidIcon className="w-3 h-3" />
                  <span className={maestroStatus.androidAvailable ? 'text-green-500' : 'text-muted-foreground'}>
                    Android {maestroStatus.androidAvailable ? '✓' : '✗'}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <Apple className="w-3 h-3" />
                  <span className={maestroStatus.iosAvailable ? 'text-green-500' : 'text-muted-foreground'}>
                    iOS {maestroStatus.iosAvailable ? '✓' : '✗'}
                  </span>
                </div>
              </div>
            )}

            {!maestroStatus.installed && (
              <div className="text-xs text-muted-foreground mt-1">
                Install: <code className="bg-background px-1 rounded">curl -Ls "https://get.maestro.mobile.dev" | bash</code>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default MobileDeviceSelector;
