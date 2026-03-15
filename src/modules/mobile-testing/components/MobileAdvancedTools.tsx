/**
 * MobileAdvancedTools - Advanced Mobile Testing Capabilities
 * 
 * Features:
 * - Deep Link Testing - Test universal links & app links
 * - Push Notification Testing - Send test notifications
 * - Biometric Mocking - Face ID, Touch ID, Fingerprint
 * - Network Simulation - Throttle network conditions
 * - Geolocation Mocking - Set custom GPS coordinates
 * - Orientation & Locale - Test rotation & language changes
 */

import React, { useState, useMemo } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useMobileTestingStore } from '@/modules/mobile-testing/store/mobileTestingStore';
import type { DeepLinkConfig, GeoLocation, NetworkProfile } from '@/modules/mobile-testing/store/mobileTestingStore';
import { mobile, isElectron } from '@/lib/electron-bridge';
import { toast } from 'sonner';
import {
  Link2,
  Bell,
  Fingerprint,
  Wifi,
  WifiOff,
  MapPin,
  RotateCw,
  Globe,
  Plus,
  Trash2,
  Play,
  Send,
  Check,
  X,
  Copy,
  Signal,
  SignalLow,
  SignalMedium,
  SignalHigh,
  Smartphone,
  Navigation,
  Languages,
  Sun,
  Moon,
  ScanFace,
  ShieldCheck,
  Activity,
  Zap,
  Loader2,
} from 'lucide-react';

type ToolSection = 'deeplinks' | 'notifications' | 'biometrics' | 'network' | 'geolocation' | 'device-config';

export default function MobileAdvancedTools() {
  const { theme } = useTheme();
  const isDark = theme !== 'light';
  const inElectron = isElectron();

  // Individual selectors
  const deepLinks = useMobileTestingStore(s => s.deepLinks);
  const savedLocations = useMobileTestingStore(s => s.savedLocations);
  const networkProfiles = useMobileTestingStore(s => s.networkProfiles);
  const activeNetworkProfile = useMobileTestingStore(s => s.activeNetworkProfile);
  const currentLocation = useMobileTestingStore(s => s.currentLocation);
  const pushNotificationPayload = useMobileTestingStore(s => s.pushNotificationPayload);
  const selectedPlatform = useMobileTestingStore(s => s.selectedPlatform);
  const selectedDevice = useMobileTestingStore(s => s.selectedDevice);
  const appBundleId = useMobileTestingStore(s => s.appBundleId);
  const addDeepLink = useMobileTestingStore(s => s.addDeepLink);
  const deleteDeepLink = useMobileTestingStore(s => s.deleteDeepLink);
  const setCurrentLocation = useMobileTestingStore(s => s.setCurrentLocation);
  const setActiveNetworkProfile = useMobileTestingStore(s => s.setActiveNetworkProfile);
  const setPushNotificationPayload = useMobileTestingStore(s => s.setPushNotificationPayload);
  const addSavedLocation = useMobileTestingStore(s => s.addSavedLocation);
  const deleteSavedLocation = useMobileTestingStore(s => s.deleteSavedLocation);

  const [activeSection, setActiveSection] = useState<ToolSection>('deeplinks');
  const [newLinkName, setNewLinkName] = useState('');
  const [newLinkUrl, setNewLinkUrl] = useState('');
  const [newLocName, setNewLocName] = useState('');
  const [newLocLat, setNewLocLat] = useState('');
  const [newLocLng, setNewLocLng] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [biometricResult, setBiometricResult] = useState<'success' | 'failure' | null>(null);
  const [selectedLocale, setSelectedLocale] = useState('en-US');

  const tools = useMemo<{ id: ToolSection; label: string; icon: React.FC<{ className?: string }>; badge?: string }[]>(() => [
    { id: 'deeplinks', label: 'Deep Links', icon: Link2 },
    { id: 'notifications', label: 'Push Notifications', icon: Bell },
    { id: 'biometrics', label: 'Biometrics', icon: Fingerprint },
    { id: 'network', label: 'Network Simulation', icon: Wifi },
    { id: 'geolocation', label: 'Geolocation', icon: MapPin },
    { id: 'device-config', label: 'Device Config', icon: Smartphone },
  ], []);

  const handleOpenDeepLink = async (link: DeepLinkConfig) => {
    try {
      const deviceId = selectedDevice;
      const result = await mobile.openDeepLink(selectedPlatform, deviceId, link.url);
      if (result.success) {
        toast.success(`Deep link opened: ${link.url}`);
      } else {
        toast.error(result.error || `Failed to open deep link: ${link.url}`);
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to open deep link');
    }
  };

  const handleAddDeepLink = () => {
    if (!newLinkName.trim() || !newLinkUrl.trim()) {
      toast.error('Name and URL are required');
      return;
    }
    addDeepLink({
      name: newLinkName,
      url: newLinkUrl,
      platform: selectedPlatform,
      description: '',
    });
    setNewLinkName('');
    setNewLinkUrl('');
    toast.success('Deep link saved!');
  };

  const handleSendNotification = async () => {
    setIsSending(true);
    try {
      const deviceId = selectedDevice;
      const result = await mobile.sendPush(selectedPlatform, deviceId, pushNotificationPayload, appBundleId);
      if (result.success) {
        toast.success('Push notification sent to device!');
      } else {
        toast.error(result.error || 'Failed to send notification');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to send notification');
    } finally {
      setIsSending(false);
    }
  };

  const handleBiometricTest = async (result: 'success' | 'failure') => {
    setBiometricResult(result);
    try {
      const deviceId = selectedDevice;
      const res = await mobile.simulateBiometric(selectedPlatform, deviceId, result);
      if (res.success) {
        toast.success(`Biometric ${result === 'success' ? 'authentication' : 'failure'} simulated on device`);
      } else {
        toast.error(res.error || 'Failed to simulate biometric');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to simulate biometric');
    }
  };

  const handleSetLocation = async (loc: GeoLocation) => {
    setCurrentLocation(loc);
    try {
      const result = await mobile.setGeoLocation(selectedPlatform, selectedDevice, loc.latitude, loc.longitude);
      if (result.success) {
        toast.success(`Location set to ${loc.name}`);
      } else {
        toast.error(result.error || `Failed to set location to ${loc.name}`);
      }
    } catch (error: any) {
      toast.error(error.message || `Failed to set location to ${loc.name}`);
    }
  };

  const handleAddLocation = () => {
    if (!newLocName || !newLocLat || !newLocLng) {
      toast.error('All fields required');
      return;
    }
    const lat = parseFloat(newLocLat);
    const lng = parseFloat(newLocLng);
    if (isNaN(lat) || isNaN(lng)) {
      toast.error('Latitude and longitude must be valid numbers');
      return;
    }
    if (lat < -90 || lat > 90) {
      toast.error('Latitude must be between -90 and 90');
      return;
    }
    if (lng < -180 || lng > 180) {
      toast.error('Longitude must be between -180 and 180');
      return;
    }
    addSavedLocation({
      name: newLocName,
      latitude: lat,
      longitude: lng,
      altitude: 0,
    });
    setNewLocName('');
    setNewLocLat('');
    setNewLocLng('');
    toast.success('Location saved!');
  };

  const handleSetNetworkProfile = async (profile: NetworkProfile) => {
    setActiveNetworkProfile(profile.id);
    try {
      const result = await mobile.setNetworkCondition(selectedPlatform, selectedDevice, profile);
      if (result.success) {
        toast.success(`Network set to ${profile.name}`);
        if (result.note) toast.info(result.note);
      } else {
        toast.error(result.error || `Failed to set network to ${profile.name}`);
      }
    } catch (error: any) {
      toast.error(error.message || `Failed to set network to ${profile.name}`);
    }
  };

  return (
    <div className="flex gap-6 h-[calc(100vh-220px)]">
      {/* Left: Tool Selector */}
      <div className={cn(
        "w-56 shrink-0 rounded-xl border p-3",
        isDark ? "bg-gray-900 border-gray-800" : "bg-white border-gray-200"
      )}>
        <h3 className={cn("text-sm font-semibold mb-3 px-2", isDark ? 'text-white' : 'text-gray-900')}>
          Advanced Tools
        </h3>
        <div className="space-y-1">
          {tools.map(tool => (
            <button
              key={tool.id}
              onClick={() => setActiveSection(tool.id)}
              className={cn(
                "w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-all text-left",
                activeSection === tool.id
                  ? isDark
                    ? "bg-primary/20 text-primary"
                    : "bg-primary/10 text-primary"
                  : isDark
                    ? "text-gray-400 hover:text-gray-300 hover:bg-gray-800"
                    : "text-gray-600 hover:text-gray-800 hover:bg-gray-100"
              )}
            >
              <tool.icon className="w-4 h-4" />
              {tool.label}
              {tool.badge && <Badge className="ml-auto text-[9px] h-4">{tool.badge}</Badge>}
            </button>
          ))}
        </div>
      </div>

      {/* Right: Tool Content */}
      <div className="flex-1 min-w-0">
        {/* Deep Links */}
        {activeSection === 'deeplinks' && (
          <div className={cn("rounded-xl border p-5 h-full overflow-y-auto", isDark ? "bg-gray-900 border-gray-800" : "bg-white border-gray-200")}>
            <h3 className={cn("text-lg font-semibold mb-1 flex items-center gap-2", isDark ? 'text-white' : 'text-gray-900')}>
              <Link2 className="w-5 h-5 text-primary" /> Deep Link Testing
            </h3>
            <p className={cn("text-sm mb-6", isDark ? 'text-gray-400' : 'text-gray-500')}>
              Test universal links, app links, and custom URL schemes on your app
            </p>

            {/* Add New */}
            <div className={cn("p-4 rounded-lg mb-4", isDark ? 'bg-gray-800' : 'bg-gray-50')}>
              <h4 className={cn("text-xs font-medium mb-3", isDark ? 'text-gray-300' : 'text-gray-700')}>Add Deep Link</h4>
              <div className="grid grid-cols-[1fr_2fr_auto] gap-2">
                <Input value={newLinkName} onChange={(e) => setNewLinkName(e.target.value)} placeholder="Name" className="h-8 text-xs" />
                <Input value={newLinkUrl} onChange={(e) => setNewLinkUrl(e.target.value)} placeholder="myapp://screen/profile or https://app.com/deep/link" className="h-8 text-xs" />
                <Button size="sm" onClick={handleAddDeepLink} className="h-8 bg-primary hover:bg-primary/90 text-primary-foreground">
                  <Plus className="w-3 h-3 mr-1" /> Add
                </Button>
              </div>
            </div>

            {/* Saved Links */}
            <div className="space-y-2">
              {deepLinks.length > 0 ? (
                deepLinks.map(link => (
                  <div key={link.id} className={cn("flex items-center gap-3 p-3 rounded-lg border", isDark ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-200')}>
                    <Link2 className={cn("w-4 h-4 shrink-0", isDark ? 'text-primary' : 'text-primary')} />
                    <div className="flex-1 min-w-0">
                      <div className={cn("text-sm font-medium", isDark ? 'text-white' : 'text-gray-900')}>{link.name}</div>
                      <div className={cn("text-xs font-mono truncate", isDark ? 'text-gray-400' : 'text-gray-500')}>{link.url}</div>
                    </div>
                    <Badge variant="outline" className="text-[10px] h-4 shrink-0">{link.platform === 'ios' ? 'iOS' : 'Android'}</Badge>
                    <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => handleOpenDeepLink(link)} disabled={!inElectron} title={!inElectron ? 'Requires Flowstral Desktop App' : undefined}>
                      <Play className="w-3 h-3 mr-1" /> Open
                    </Button>
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-500" onClick={() => deleteDeepLink(link.id)}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                ))
              ) : (
                <div className={cn("text-center py-8 text-sm", isDark ? 'text-gray-500' : 'text-gray-400')}>
                  No saved deep links. Add one above.
                </div>
              )}
            </div>

            {/* Common URL Schemes */}
            <div className="mt-6">
              <h4 className={cn("text-xs font-medium mb-3", isDark ? 'text-gray-300' : 'text-gray-700')}>Common URL Schemes</h4>
              <div className="grid grid-cols-2 gap-2 text-xs">
                {[
                  { scheme: 'tel:+1234567890', desc: 'Phone call' },
                  { scheme: 'mailto:test@test.com', desc: 'Email' },
                  { scheme: 'sms:+1234567890', desc: 'SMS' },
                  { scheme: 'maps://maps.apple.com', desc: 'Apple Maps' },
                  { scheme: 'geo:37.7749,-122.4194', desc: 'Google Maps' },
                  { scheme: 'fb://profile', desc: 'Facebook' },
                  { scheme: 'twitter://timeline', desc: 'Twitter/X' },
                  { scheme: 'instagram://app', desc: 'Instagram' },
                ].map((item, idx) => (
                  <div key={idx} className={cn("p-2 rounded flex items-center justify-between", isDark ? 'bg-gray-800' : 'bg-gray-50')}>
                    <div>
                      <code className={cn("font-mono text-[10px]", isDark ? 'text-primary' : 'text-primary')}>{item.scheme}</code>
                      <p className={cn("text-[10px]", isDark ? 'text-gray-500' : 'text-gray-400')}>{item.desc}</p>
                    </div>
                    <button onClick={() => { navigator.clipboard.writeText(item.scheme); toast.success('Copied!'); }}>
                      <Copy className="w-3 h-3 text-muted-foreground" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Push Notifications */}
        {activeSection === 'notifications' && (
          <div className={cn("rounded-xl border p-5 h-full overflow-y-auto", isDark ? "bg-gray-900 border-gray-800" : "bg-white border-gray-200")}>
            <h3 className={cn("text-lg font-semibold mb-1 flex items-center gap-2", isDark ? 'text-white' : 'text-gray-900')}>
              <Bell className="w-5 h-5 text-primary" /> Push Notification Testing
            </h3>
            <p className={cn("text-sm mb-6", isDark ? 'text-gray-400' : 'text-gray-500')}>
              Send test push notifications to your connected device
            </p>

            {/* Payload Editor */}
            <div className="space-y-4">
              <div>
                <label className={cn("text-xs font-medium mb-2 block", isDark ? 'text-gray-300' : 'text-gray-700')}>
                  Notification Payload (JSON)
                </label>
                <Textarea
                  value={pushNotificationPayload}
                  onChange={(e) => setPushNotificationPayload(e.target.value)}
                  rows={12}
                  className={cn("font-mono text-xs", isDark ? "bg-gray-950 border-gray-700" : "bg-gray-50 border-gray-200")}
                />
              </div>

              <div className="flex gap-2">
                <Button
                  className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground"
                  onClick={handleSendNotification}
                  disabled={isSending || !inElectron}
                  title={!inElectron ? 'Requires Flowstral Desktop App' : undefined}
                >
                  {isSending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
                  {!inElectron ? 'Desktop App Required' : 'Send Notification'}
                </Button>
              </div>

              {/* Quick Templates */}
              <div>
                <h4 className={cn("text-xs font-medium mb-3", isDark ? 'text-gray-300' : 'text-gray-700')}>Quick Templates</h4>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: 'Simple Alert', payload: { aps: { alert: { title: "Hello", body: "Test notification" }, badge: 1, sound: "default" } } },
                    { label: 'Silent Push', payload: { aps: { "content-available": 1 }, data: { type: "sync" } } },
                    { label: 'Rich Media', payload: { aps: { alert: { title: "Photo", body: "New photo shared" }, "mutable-content": 1 }, media_url: "https://example.com/photo.jpg" } },
                    { label: 'Action Buttons', payload: { aps: { alert: { title: "Order", body: "Your order is ready" }, category: "ORDER_CATEGORY" }, order_id: "12345" } },
                  ].map((tmpl, idx) => (
                    <Button
                      key={idx}
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs justify-start"
                      onClick={() => setPushNotificationPayload(JSON.stringify(tmpl.payload, null, 2))}
                    >
                      <Bell className="w-3 h-3 mr-1.5" /> {tmpl.label}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Biometrics */}
        {activeSection === 'biometrics' && (
          <div className={cn("rounded-xl border p-5 h-full overflow-y-auto", isDark ? "bg-gray-900 border-gray-800" : "bg-white border-gray-200")}>
            <h3 className={cn("text-lg font-semibold mb-1 flex items-center gap-2", isDark ? 'text-white' : 'text-gray-900')}>
              <Fingerprint className="w-5 h-5 text-primary" /> Biometric Mocking
            </h3>
            <p className={cn("text-sm mb-6", isDark ? 'text-gray-400' : 'text-gray-500')}>
              Simulate Face ID, Touch ID, and fingerprint authentication responses
            </p>

            {!inElectron && (
              <div className={cn("p-3 rounded-lg mb-4 text-xs", isDark ? 'bg-amber-500/10 text-amber-400' : 'bg-amber-50 text-amber-700')}>
                ⚠️ Biometric simulation requires the Flowstral Desktop App with a connected device or simulator.
              </div>
            )}

            <div className="grid md:grid-cols-2 gap-6">
              {/* iOS */}
              <div className={cn("rounded-lg border p-5", isDark ? 'border-gray-700' : 'border-gray-200')}>
                <div className="flex items-center gap-2 mb-4">
                  <ScanFace className={cn("w-5 h-5", isDark ? 'text-gray-300' : 'text-gray-800')} />
                  <h4 className={cn("text-sm font-semibold", isDark ? 'text-white' : 'text-gray-900')}>iOS Biometrics</h4>
                </div>

                <div className="space-y-3">
                  <div className="space-y-2">
                    <label className={cn("text-xs font-medium", isDark ? 'text-gray-400' : 'text-gray-600')}>Face ID</label>
                    <div className="flex gap-2">
                      <Button
                        className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white h-9 text-xs"
                        onClick={() => handleBiometricTest('success')}
                        disabled={!inElectron}
                        title={!inElectron ? 'Requires Flowstral Desktop App' : undefined}
                      >
                        <Check className="w-3 h-3 mr-1" /> Match
                      </Button>
                      <Button
                        variant="destructive"
                        className="flex-1 h-9 text-xs"
                        onClick={() => handleBiometricTest('failure')}
                        disabled={!inElectron}
                        title={!inElectron ? 'Requires Flowstral Desktop App' : undefined}
                      >
                        <X className="w-3 h-3 mr-1" /> No Match
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className={cn("text-xs font-medium", isDark ? 'text-gray-400' : 'text-gray-600')}>Touch ID</label>
                    <div className="flex gap-2">
                      <Button
                        className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white h-9 text-xs"
                        onClick={() => handleBiometricTest('success')}
                        disabled={!inElectron}
                        title={!inElectron ? 'Requires Flowstral Desktop App' : undefined}
                      >
                        <Fingerprint className="w-3 h-3 mr-1" /> Match
                      </Button>
                      <Button
                        variant="destructive"
                        className="flex-1 h-9 text-xs"
                        onClick={() => handleBiometricTest('failure')}
                        disabled={!inElectron}
                        title={!inElectron ? 'Requires Flowstral Desktop App' : undefined}
                      >
                        <X className="w-3 h-3 mr-1" /> No Match
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Android */}
              <div className={cn("rounded-lg border p-5", isDark ? 'border-gray-700' : 'border-gray-200')}>
                <div className="flex items-center gap-2 mb-4">
                  <Fingerprint className={cn("w-5 h-5", isDark ? 'text-gray-300' : 'text-gray-800')} />
                  <h4 className={cn("text-sm font-semibold", isDark ? 'text-white' : 'text-gray-900')}>Android Biometrics</h4>
                </div>

                <div className="space-y-3">
                  <div className="space-y-2">
                    <label className={cn("text-xs font-medium", isDark ? 'text-gray-400' : 'text-gray-600')}>Fingerprint</label>
                    <div className="flex gap-2">
                      <Button
                        className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white h-9 text-xs"
                        onClick={() => handleBiometricTest('success')}
                        disabled={!inElectron}
                        title={!inElectron ? 'Requires Flowstral Desktop App' : undefined}
                      >
                        <Fingerprint className="w-3 h-3 mr-1" /> Authenticate
                      </Button>
                      <Button
                        variant="destructive"
                        className="flex-1 h-9 text-xs"
                        onClick={() => handleBiometricTest('failure')}
                        disabled={!inElectron}
                        title={!inElectron ? 'Requires Flowstral Desktop App' : undefined}
                      >
                        <X className="w-3 h-3 mr-1" /> Reject
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className={cn("text-xs font-medium", isDark ? 'text-gray-400' : 'text-gray-600')}>Face Unlock</label>
                    <div className="flex gap-2">
                      <Button
                        className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white h-9 text-xs"
                        onClick={() => handleBiometricTest('success')}
                        disabled={!inElectron}
                        title={!inElectron ? 'Requires Flowstral Desktop App' : undefined}
                      >
                        <ScanFace className="w-3 h-3 mr-1" /> Recognize
                      </Button>
                      <Button
                        variant="destructive"
                        className="flex-1 h-9 text-xs"
                        onClick={() => handleBiometricTest('failure')}
                        disabled={!inElectron}
                        title={!inElectron ? 'Requires Flowstral Desktop App' : undefined}
                      >
                        <X className="w-3 h-3 mr-1" /> Reject
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {biometricResult && (
              <div className={cn(
                "mt-4 p-4 rounded-lg flex items-center gap-3",
                biometricResult === 'success'
                  ? isDark ? 'bg-emerald-500/10' : 'bg-emerald-50'
                  : isDark ? 'bg-red-500/10' : 'bg-red-50'
              )}>
                <ShieldCheck className={cn("w-5 h-5", biometricResult === 'success' ? 'text-emerald-500' : 'text-red-500')} />
                <span className={cn("text-sm", biometricResult === 'success' ? 'text-emerald-500' : 'text-red-500')}>
                  Biometric {biometricResult === 'success' ? 'authentication succeeded' : 'authentication failed'} (simulated)
                </span>
              </div>
            )}
          </div>
        )}

        {/* Network Simulation */}
        {activeSection === 'network' && (
          <div className={cn("rounded-xl border p-5 h-full overflow-y-auto", isDark ? "bg-gray-900 border-gray-800" : "bg-white border-gray-200")}>
            <h3 className={cn("text-lg font-semibold mb-1 flex items-center gap-2", isDark ? 'text-white' : 'text-gray-900')}>
              <Wifi className="w-5 h-5 text-primary" /> Network Simulation
            </h3>
            <p className={cn("text-sm mb-6", isDark ? 'text-gray-400' : 'text-gray-500')}>
              Simulate different network conditions to test app behavior under various connectivity scenarios
            </p>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {networkProfiles.map(profile => {
                const isActive = activeNetworkProfile === profile.id;
                const getSignalIcon = () => {
                  if (profile.download_kbps === 0) return WifiOff;
                  if (profile.download_kbps < 200) return SignalLow;
                  if (profile.download_kbps < 2000) return SignalMedium;
                  return SignalHigh;
                };
                const SignalIcon = getSignalIcon();

                return (
                  <button
                    key={profile.id}
                    onClick={() => handleSetNetworkProfile(profile)}
                    disabled={!inElectron}
                    title={!inElectron ? 'Requires Flowstral Desktop App' : undefined}
                    className={cn(
                      "p-4 rounded-xl border text-left transition-all",
                      isActive
                        ? isDark
                          ? "bg-primary/15 border-primary ring-2 ring-primary/30"
                          : "bg-primary/10 border-primary/30 ring-2 ring-primary/20"
                        : isDark
                          ? "bg-gray-800 border-gray-700 hover:border-gray-600"
                          : "bg-white border-gray-200 hover:border-gray-300"
                    )}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <SignalIcon className={cn("w-5 h-5", isActive ? 'text-primary' : isDark ? 'text-gray-400' : 'text-gray-500')} />
                      {isActive && <Badge className="text-[9px] h-4 bg-primary/100 text-white">Active</Badge>}
                    </div>
                    <div className={cn("text-sm font-semibold mb-1", isDark ? 'text-white' : 'text-gray-900')}>{profile.name}</div>
                    <div className={cn("text-[10px] space-y-0.5", isDark ? 'text-gray-400' : 'text-gray-500')}>
                      <div>DL: {profile.download_kbps} kbps</div>
                      <div>UL: {profile.upload_kbps} kbps</div>
                      <div>Latency: {profile.latency_ms}ms</div>
                      {profile.packet_loss > 0 && <div>Loss: {profile.packet_loss}%</div>}
                    </div>
                  </button>
                );
              })}
            </div>

            {activeNetworkProfile && (
              <div className="mt-4">
                <Button variant="outline" size="sm" disabled={!inElectron} title={!inElectron ? 'Requires Flowstral Desktop App' : undefined} onClick={async () => {
                  setActiveNetworkProfile(null);
                  const deviceId = selectedDevice;
                  // Enable wifi + data to restore default network
                  await mobile.setNetworkCondition(selectedPlatform, deviceId, { download_kbps: 50000, upload_kbps: 50000, latency_ms: 0, packet_loss: 0 });
                  toast.success('Network reset to default');
                }}>
                  <RotateCw className="w-3 h-3 mr-1" /> Reset to Default
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Geolocation */}
        {activeSection === 'geolocation' && (
          <div className={cn("rounded-xl border p-5 h-full overflow-y-auto", isDark ? "bg-gray-900 border-gray-800" : "bg-white border-gray-200")}>
            <h3 className={cn("text-lg font-semibold mb-1 flex items-center gap-2", isDark ? 'text-white' : 'text-gray-900')}>
              <MapPin className="w-5 h-5 text-primary" /> Geolocation Mocking
            </h3>
            <p className={cn("text-sm mb-6", isDark ? 'text-gray-400' : 'text-gray-500')}>
              Set a custom GPS location on your connected device for location-based testing
            </p>

            {/* Current Location */}
            {currentLocation && (
              <div className={cn("p-4 rounded-lg mb-4 flex items-center gap-3", isDark ? 'bg-primary/10' : 'bg-primary/10')}>
                <Navigation className="w-5 h-5 text-primary" />
                <div>
                  <div className={cn("text-sm font-medium", isDark ? 'text-primary' : 'text-primary')}>Current: {currentLocation.name}</div>
                  <div className={cn("text-xs font-mono", isDark ? 'text-primary/70' : 'text-primary')}>
                    {currentLocation.latitude.toFixed(4)}, {currentLocation.longitude.toFixed(4)}
                  </div>
                </div>
                <Button variant="ghost" size="sm" className="ml-auto h-7 text-xs" onClick={() => setCurrentLocation(null)}>
                  <X className="w-3 h-3 mr-1" /> Clear
                </Button>
              </div>
            )}

            {/* Add Custom Location */}
            <div className={cn("p-4 rounded-lg mb-4", isDark ? 'bg-gray-800' : 'bg-gray-50')}>
              <h4 className={cn("text-xs font-medium mb-3", isDark ? 'text-gray-300' : 'text-gray-700')}>Add Custom Location</h4>
              <div className="grid grid-cols-[2fr_1fr_1fr_auto] gap-2">
                <Input value={newLocName} onChange={(e) => setNewLocName(e.target.value)} placeholder="Name" className="h-8 text-xs" />
                <Input value={newLocLat} onChange={(e) => setNewLocLat(e.target.value)} placeholder="Latitude" type="number" step="0.0001" className="h-8 text-xs" />
                <Input value={newLocLng} onChange={(e) => setNewLocLng(e.target.value)} placeholder="Longitude" type="number" step="0.0001" className="h-8 text-xs" />
                <Button size="sm" onClick={handleAddLocation} className="h-8 bg-primary hover:bg-primary/90 text-primary-foreground">
                  <Plus className="w-3 h-3" />
                </Button>
              </div>
            </div>

            {/* Saved Locations */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {savedLocations.map(loc => {
                const isActive = currentLocation?.id === loc.id;
                return (
                  <button
                    key={loc.id}
                    onClick={() => handleSetLocation(loc)}
                    disabled={!inElectron}
                    title={!inElectron ? 'Requires Flowstral Desktop App' : undefined}
                    className={cn(
                      "p-3 rounded-lg border text-left transition-all group",
                      isActive
                        ? isDark ? "bg-primary/15 border-primary" : "bg-primary/10 border-primary/30"
                        : isDark ? "bg-gray-800 border-gray-700 hover:border-gray-600" : "bg-white border-gray-200 hover:border-gray-300"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <MapPin className={cn("w-4 h-4", isActive ? 'text-primary' : isDark ? 'text-gray-400' : 'text-gray-500')} />
                      {isActive && <Badge className="text-[9px] h-4 bg-primary/100 text-white">Active</Badge>}
                      <button
                        onClick={(e) => { e.stopPropagation(); deleteSavedLocation(loc.id); }}
                        className="opacity-0 group-hover:opacity-100 text-red-500"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                    <div className={cn("text-sm font-medium mt-2", isDark ? 'text-white' : 'text-gray-900')}>{loc.name}</div>
                    <div className={cn("text-[10px] font-mono mt-1", isDark ? 'text-gray-400' : 'text-gray-500')}>
                      {loc.latitude.toFixed(4)}, {loc.longitude.toFixed(4)}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Device Configuration */}
        {activeSection === 'device-config' && (
          <div className={cn("rounded-xl border p-5 h-full overflow-y-auto", isDark ? "bg-gray-900 border-gray-800" : "bg-white border-gray-200")}>
            <h3 className={cn("text-lg font-semibold mb-1 flex items-center gap-2", isDark ? 'text-white' : 'text-gray-900')}>
              <Smartphone className="w-5 h-5 text-primary" /> Device Configuration
            </h3>
            <p className={cn("text-sm mb-6", isDark ? 'text-gray-400' : 'text-gray-500')}>
              Control device settings like orientation, locale, appearance, and more
            </p>

            <div className="grid md:grid-cols-2 gap-6">
              {/* Orientation */}
              <div className={cn("rounded-lg border p-4", isDark ? 'border-gray-700' : 'border-gray-200')}>
                <h4 className={cn("text-sm font-semibold mb-3 flex items-center gap-2", isDark ? 'text-white' : 'text-gray-900')}>
                  <RotateCw className="w-4 h-4" /> Orientation
                </h4>
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1 h-10 text-xs" disabled={!inElectron} title={!inElectron ? 'Requires Flowstral Desktop App' : undefined} onClick={async () => {
                    try {
                      const r = await mobile.setOrientation(selectedPlatform, selectedDevice, 'portrait');
                      r.success ? toast.success('Set to Portrait') : toast.error(r.error || 'Failed');
                    } catch (e: any) { toast.error(e.message || 'Failed to set orientation'); }
                  }}>
                    <Smartphone className="w-4 h-4 mr-1.5" /> Portrait
                  </Button>
                  <Button variant="outline" className="flex-1 h-10 text-xs" disabled={!inElectron} title={!inElectron ? 'Requires Flowstral Desktop App' : undefined} onClick={async () => {
                    try {
                      const r = await mobile.setOrientation(selectedPlatform, selectedDevice, 'landscape');
                      r.success ? toast.success('Set to Landscape') : toast.error(r.error || 'Failed');
                    } catch (e: any) { toast.error(e.message || 'Failed to set orientation'); }
                  }}>
                    <Smartphone className="w-4 h-4 mr-1.5 rotate-90" /> Landscape
                  </Button>
                </div>
              </div>

              {/* Appearance */}
              <div className={cn("rounded-lg border p-4", isDark ? 'border-gray-700' : 'border-gray-200')}>
                <h4 className={cn("text-sm font-semibold mb-3 flex items-center gap-2", isDark ? 'text-white' : 'text-gray-900')}>
                  <Sun className="w-4 h-4" /> Appearance
                </h4>
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1 h-10 text-xs" disabled={!inElectron} title={!inElectron ? 'Requires Flowstral Desktop App' : undefined} onClick={async () => {
                    try {
                      const r = await mobile.setAppearance(selectedPlatform, selectedDevice, 'light');
                      r.success ? toast.success('Set to Light Mode') : toast.error(r.error || 'Failed');
                    } catch (e: any) { toast.error(e.message || 'Failed to set appearance'); }
                  }}>
                    <Sun className="w-4 h-4 mr-1.5" /> Light
                  </Button>
                  <Button variant="outline" className="flex-1 h-10 text-xs" disabled={!inElectron} title={!inElectron ? 'Requires Flowstral Desktop App' : undefined} onClick={async () => {
                    try {
                      const r = await mobile.setAppearance(selectedPlatform, selectedDevice, 'dark');
                      r.success ? toast.success('Set to Dark Mode') : toast.error(r.error || 'Failed');
                    } catch (e: any) { toast.error(e.message || 'Failed to set appearance'); }
                  }}>
                    <Moon className="w-4 h-4 mr-1.5" /> Dark
                  </Button>
                </div>
              </div>

              {/* Locale */}
              <div className={cn("rounded-lg border p-4", isDark ? 'border-gray-700' : 'border-gray-200')}>
                <h4 className={cn("text-sm font-semibold mb-3 flex items-center gap-2", isDark ? 'text-white' : 'text-gray-900')}>
                  <Languages className="w-4 h-4" /> Locale
                </h4>
                <div className="flex gap-2">
                  <select
                    value={selectedLocale}
                    onChange={(e) => setSelectedLocale(e.target.value)}
                    className={cn("flex-1 h-10 rounded-md border text-xs px-3", isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200')}
                  >
                    <option value="en-US">en-US (English)</option>
                    <option value="es-ES">es-ES (Spanish)</option>
                    <option value="fr-FR">fr-FR (French)</option>
                    <option value="de-DE">de-DE (German)</option>
                    <option value="ja-JP">ja-JP (Japanese)</option>
                    <option value="zh-CN">zh-CN (Chinese Simplified)</option>
                    <option value="ko-KR">ko-KR (Korean)</option>
                    <option value="ar-SA">ar-SA (Arabic)</option>
                    <option value="hi-IN">hi-IN (Hindi)</option>
                    <option value="pt-BR">pt-BR (Portuguese)</option>
                  </select>
                  <Button variant="outline" className="h-10 text-xs" disabled={!inElectron} title={!inElectron ? 'Requires Flowstral Desktop App' : undefined} onClick={async () => {
                    try {
                      const r = await mobile.setLocale(selectedPlatform, selectedDevice, selectedLocale);
                      if (r.success) {
                        toast.success(`Locale set to ${selectedLocale}`);
                        if (r.note) toast.info(r.note);
                      } else {
                        toast.error(r.error || 'Failed to set locale');
                      }
                    } catch (e: any) { toast.error(e.message || 'Failed to set locale'); }
                  }}>
                    Apply
                  </Button>
                </div>
              </div>

              {/* Font Scale */}
              <div className={cn("rounded-lg border p-4", isDark ? 'border-gray-700' : 'border-gray-200')}>
                <h4 className={cn("text-sm font-semibold mb-3 flex items-center gap-2", isDark ? 'text-white' : 'text-gray-900')}>
                  <Zap className="w-4 h-4" /> Accessibility Font Scale
                </h4>
                <div className="flex gap-2">
                  {[
                    { label: 'Small', value: 0.85 },
                    { label: 'Default', value: 1.0 },
                    { label: 'Large', value: 1.3 },
                    { label: 'XL', value: 1.5 },
                  ].map(scale => (
                    <Button key={scale.value} variant="outline" className="flex-1 h-10 text-xs" disabled={!inElectron} title={!inElectron ? 'Requires Flowstral Desktop App' : undefined} onClick={async () => {
                      try {
                        const r = await mobile.setFontScale(selectedPlatform, selectedDevice, scale.value);
                        r.success ? toast.success(`Font scale set to ${scale.value}x`) : toast.error(r.error || 'Failed');
                      } catch (e: any) { toast.error(e.message || 'Failed to set font scale'); }
                    }}>
                      {scale.label}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
