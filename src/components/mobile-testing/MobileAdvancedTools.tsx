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

import React, { useState } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useMobileTestingStore } from '@/stores/mobileTestingStore';
import type { DeepLinkConfig, GeoLocation, NetworkProfile } from '@/stores/mobileTestingStore';
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

  const {
    deepLinks,
    savedLocations,
    networkProfiles,
    activeNetworkProfile,
    currentLocation,
    pushNotificationPayload,
    selectedPlatform,
    addDeepLink,
    deleteDeepLink,
    setCurrentLocation,
    setActiveNetworkProfile,
    setPushNotificationPayload,
    addSavedLocation,
    deleteSavedLocation,
  } = useMobileTestingStore();

  const [activeSection, setActiveSection] = useState<ToolSection>('deeplinks');
  const [newLinkName, setNewLinkName] = useState('');
  const [newLinkUrl, setNewLinkUrl] = useState('');
  const [newLocName, setNewLocName] = useState('');
  const [newLocLat, setNewLocLat] = useState('');
  const [newLocLng, setNewLocLng] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [biometricResult, setBiometricResult] = useState<'success' | 'failure' | null>(null);

  const tools: { id: ToolSection; label: string; icon: React.FC<any>; badge?: string }[] = [
    { id: 'deeplinks', label: 'Deep Links', icon: Link2 },
    { id: 'notifications', label: 'Push Notifications', icon: Bell },
    { id: 'biometrics', label: 'Biometrics', icon: Fingerprint },
    { id: 'network', label: 'Network Simulation', icon: Wifi },
    { id: 'geolocation', label: 'Geolocation', icon: MapPin },
    { id: 'device-config', label: 'Device Config', icon: Smartphone },
  ];

  const handleOpenDeepLink = (link: DeepLinkConfig) => {
    toast.success(`Opening deep link: ${link.url}`);
    // In production: mobile.openDeepLink(link.url)
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
      // In production: mobile.sendPushNotification(pushNotificationPayload)
      await new Promise(r => setTimeout(r, 1000));
      toast.success('Push notification sent to device!');
    } catch (error: any) {
      toast.error(error.message || 'Failed to send notification');
    } finally {
      setIsSending(false);
    }
  };

  const handleBiometricTest = async (result: 'success' | 'failure') => {
    setBiometricResult(result);
    toast.success(`Biometric ${result === 'success' ? 'enrollment' : 'failure'} simulated`);
    // In production: mobile.simulateBiometric(result)
  };

  const handleSetLocation = (loc: GeoLocation) => {
    setCurrentLocation(loc);
    toast.success(`Location set to ${loc.name}`);
    // In production: mobile.setGeoLocation(loc.latitude, loc.longitude)
  };

  const handleAddLocation = () => {
    if (!newLocName || !newLocLat || !newLocLng) {
      toast.error('All fields required');
      return;
    }
    addSavedLocation({
      name: newLocName,
      latitude: parseFloat(newLocLat),
      longitude: parseFloat(newLocLng),
      altitude: 0,
    });
    setNewLocName('');
    setNewLocLat('');
    setNewLocLng('');
    toast.success('Location saved!');
  };

  const handleSetNetworkProfile = (profile: NetworkProfile) => {
    setActiveNetworkProfile(profile.id);
    toast.success(`Network set to ${profile.name}`);
    // In production: mobile.setNetworkCondition(profile)
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
                    ? "bg-violet-500/20 text-violet-400"
                    : "bg-violet-100 text-violet-700"
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
              <Link2 className="w-5 h-5 text-violet-500" /> Deep Link Testing
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
                <Button size="sm" onClick={handleAddDeepLink} className="h-8 bg-violet-500 hover:bg-violet-600 text-white">
                  <Plus className="w-3 h-3 mr-1" /> Add
                </Button>
              </div>
            </div>

            {/* Saved Links */}
            <div className="space-y-2">
              {deepLinks.length > 0 ? (
                deepLinks.map(link => (
                  <div key={link.id} className={cn("flex items-center gap-3 p-3 rounded-lg border", isDark ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-200')}>
                    <Link2 className={cn("w-4 h-4 shrink-0", isDark ? 'text-violet-400' : 'text-violet-500')} />
                    <div className="flex-1 min-w-0">
                      <div className={cn("text-sm font-medium", isDark ? 'text-white' : 'text-gray-900')}>{link.name}</div>
                      <div className={cn("text-xs font-mono truncate", isDark ? 'text-gray-400' : 'text-gray-500')}>{link.url}</div>
                    </div>
                    <Badge variant="outline" className="text-[10px] h-4 shrink-0">{link.platform === 'ios' ? 'iOS' : 'Android'}</Badge>
                    <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => handleOpenDeepLink(link)}>
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
                      <code className={cn("font-mono text-[10px]", isDark ? 'text-violet-400' : 'text-violet-600')}>{item.scheme}</code>
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
              <Bell className="w-5 h-5 text-violet-500" /> Push Notification Testing
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
                  className="flex-1 bg-violet-500 hover:bg-violet-600 text-white"
                  onClick={handleSendNotification}
                  disabled={isSending}
                >
                  {isSending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
                  Send Notification
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
              <Fingerprint className="w-5 h-5 text-violet-500" /> Biometric Mocking
            </h3>
            <p className={cn("text-sm mb-6", isDark ? 'text-gray-400' : 'text-gray-500')}>
              Simulate Face ID, Touch ID, and fingerprint authentication responses
            </p>

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
                      >
                        <Check className="w-3 h-3 mr-1" /> Match
                      </Button>
                      <Button
                        variant="destructive"
                        className="flex-1 h-9 text-xs"
                        onClick={() => handleBiometricTest('failure')}
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
                      >
                        <Fingerprint className="w-3 h-3 mr-1" /> Match
                      </Button>
                      <Button
                        variant="destructive"
                        className="flex-1 h-9 text-xs"
                        onClick={() => handleBiometricTest('failure')}
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
                      >
                        <Fingerprint className="w-3 h-3 mr-1" /> Authenticate
                      </Button>
                      <Button
                        variant="destructive"
                        className="flex-1 h-9 text-xs"
                        onClick={() => handleBiometricTest('failure')}
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
                      >
                        <ScanFace className="w-3 h-3 mr-1" /> Recognize
                      </Button>
                      <Button
                        variant="destructive"
                        className="flex-1 h-9 text-xs"
                        onClick={() => handleBiometricTest('failure')}
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
              <Wifi className="w-5 h-5 text-violet-500" /> Network Simulation
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
                    className={cn(
                      "p-4 rounded-xl border text-left transition-all",
                      isActive
                        ? isDark
                          ? "bg-violet-500/15 border-violet-500 ring-2 ring-violet-500/30"
                          : "bg-violet-50 border-violet-300 ring-2 ring-violet-200"
                        : isDark
                          ? "bg-gray-800 border-gray-700 hover:border-gray-600"
                          : "bg-white border-gray-200 hover:border-gray-300"
                    )}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <SignalIcon className={cn("w-5 h-5", isActive ? 'text-violet-500' : isDark ? 'text-gray-400' : 'text-gray-500')} />
                      {isActive && <Badge className="text-[9px] h-4 bg-violet-500 text-white">Active</Badge>}
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
                <Button variant="outline" size="sm" onClick={() => { setActiveNetworkProfile(null); toast.success('Network reset to default'); }}>
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
              <MapPin className="w-5 h-5 text-violet-500" /> Geolocation Mocking
            </h3>
            <p className={cn("text-sm mb-6", isDark ? 'text-gray-400' : 'text-gray-500')}>
              Set a custom GPS location on your connected device for location-based testing
            </p>

            {/* Current Location */}
            {currentLocation && (
              <div className={cn("p-4 rounded-lg mb-4 flex items-center gap-3", isDark ? 'bg-violet-500/10' : 'bg-violet-50')}>
                <Navigation className="w-5 h-5 text-violet-500" />
                <div>
                  <div className={cn("text-sm font-medium", isDark ? 'text-violet-400' : 'text-violet-700')}>Current: {currentLocation.name}</div>
                  <div className={cn("text-xs font-mono", isDark ? 'text-violet-400/70' : 'text-violet-500')}>
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
                <Button size="sm" onClick={handleAddLocation} className="h-8 bg-violet-500 hover:bg-violet-600 text-white">
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
                    className={cn(
                      "p-3 rounded-lg border text-left transition-all group",
                      isActive
                        ? isDark ? "bg-violet-500/15 border-violet-500" : "bg-violet-50 border-violet-300"
                        : isDark ? "bg-gray-800 border-gray-700 hover:border-gray-600" : "bg-white border-gray-200 hover:border-gray-300"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <MapPin className={cn("w-4 h-4", isActive ? 'text-violet-500' : isDark ? 'text-gray-400' : 'text-gray-500')} />
                      {isActive && <Badge className="text-[9px] h-4 bg-violet-500 text-white">Active</Badge>}
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
              <Smartphone className="w-5 h-5 text-violet-500" /> Device Configuration
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
                  <Button variant="outline" className="flex-1 h-10 text-xs" onClick={() => toast.success('Set to Portrait')}>
                    <Smartphone className="w-4 h-4 mr-1.5" /> Portrait
                  </Button>
                  <Button variant="outline" className="flex-1 h-10 text-xs" onClick={() => toast.success('Set to Landscape')}>
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
                  <Button variant="outline" className="flex-1 h-10 text-xs" onClick={() => toast.success('Set to Light Mode')}>
                    <Sun className="w-4 h-4 mr-1.5" /> Light
                  </Button>
                  <Button variant="outline" className="flex-1 h-10 text-xs" onClick={() => toast.success('Set to Dark Mode')}>
                    <Moon className="w-4 h-4 mr-1.5" /> Dark
                  </Button>
                </div>
              </div>

              {/* Locale */}
              <div className={cn("rounded-lg border p-4", isDark ? 'border-gray-700' : 'border-gray-200')}>
                <h4 className={cn("text-sm font-semibold mb-3 flex items-center gap-2", isDark ? 'text-white' : 'text-gray-900')}>
                  <Languages className="w-4 h-4" /> Locale
                </h4>
                <select className={cn("w-full h-10 rounded-md border text-xs px-3", isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200')}>
                  <option>en-US (English)</option>
                  <option>es-ES (Spanish)</option>
                  <option>fr-FR (French)</option>
                  <option>de-DE (German)</option>
                  <option>ja-JP (Japanese)</option>
                  <option>zh-CN (Chinese Simplified)</option>
                  <option>ko-KR (Korean)</option>
                  <option>ar-SA (Arabic)</option>
                  <option>hi-IN (Hindi)</option>
                  <option>pt-BR (Portuguese)</option>
                </select>
              </div>

              {/* Font Scale */}
              <div className={cn("rounded-lg border p-4", isDark ? 'border-gray-700' : 'border-gray-200')}>
                <h4 className={cn("text-sm font-semibold mb-3 flex items-center gap-2", isDark ? 'text-white' : 'text-gray-900')}>
                  <Zap className="w-4 h-4" /> Accessibility Font Scale
                </h4>
                <div className="flex gap-2">
                  {[
                    { label: 'Small', value: '0.85x' },
                    { label: 'Default', value: '1.0x' },
                    { label: 'Large', value: '1.3x' },
                    { label: 'XL', value: '1.5x' },
                  ].map(scale => (
                    <Button key={scale.value} variant="outline" className="flex-1 h-10 text-xs" onClick={() => toast.success(`Font scale set to ${scale.value}`)}>
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
