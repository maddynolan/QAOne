/**
 * License Gate Component
 * 
 * Blocks access to the entire app until a valid license is entered.
 * Shows license status and activation form.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Shield, Key, AlertTriangle, CheckCircle, Loader2, Clock, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

interface LicenseInfo {
  valid: boolean;
  key?: string;
  type?: string;
  expiresAt?: string;
  features?: string[];
  message?: string;
}

interface LicenseGateProps {
  children: React.ReactNode;
}

export function LicenseGate({ children }: LicenseGateProps) {
  const [licenseStatus, setLicenseStatus] = useState<LicenseInfo | null>(null);
  const [isChecking, setIsChecking] = useState(true);
  const [licenseKey, setLicenseKey] = useState('');
  const [isActivating, setIsActivating] = useState(false);
  const [daysLeft, setDaysLeft] = useState<number | null>(null);
  const [isElectronApp, setIsElectronApp] = useState<boolean | null>(null);

  // Detect if running in Electron - check user agent first (always reliable)
  const isElectronByUserAgent = useCallback(() => {
    return navigator.userAgent.toLowerCase().includes('electron');
  }, []);

  // Check if Electron APIs are available
  const hasElectronAPIs = useCallback(() => {
    const hasFlowstral = !!(window as any).flowstral;
    const hasElectronAPI = !!(window as any).electronAPI;
    const hasPlatform = !!(window as any).platform?.isElectron;
    return hasFlowstral || hasElectronAPI || hasPlatform;
  }, []);

  // Check license status from backend
  const checkLicenseStatus = useCallback(async () => {
    try {
      const flowstral = (window as any).flowstral;
      const electronAPI = (window as any).electronAPI;
      
      console.log('[LicenseGate] Checking license status...');
      const info = await (flowstral?.getLicenseInfo?.() || electronAPI?.getLicenseInfo?.());
      
      console.log('[LicenseGate] License info received:', info);
      
      if (info && info.valid) {
        setLicenseStatus(info);
        if (info.expiresAt) {
          const days = Math.ceil((new Date(info.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
          setDaysLeft(days > 0 ? days : 0);
        }
      } else {
        // No valid license
        setLicenseStatus({ valid: false, message: info?.message || 'No valid license' });
      }
    } catch (error) {
      console.error('[LicenseGate] Error checking license:', error);
      setLicenseStatus({ valid: false, message: 'Failed to check license' });
    } finally {
      setIsChecking(false);
    }
  }, []);

  // Initialize - detect Electron and check license with retry
  useEffect(() => {
    let attempts = 0;
    const maxAttempts = 25; // Try for up to 5 seconds (200ms * 25)
    const isDefinitelyElectron = isElectronByUserAgent();
    
    console.log(`[LicenseGate] Initial check - userAgent says Electron: ${isDefinitelyElectron}`);
    
    // If NOT in Electron (web browser), allow immediately
    if (!isDefinitelyElectron) {
      console.log('[LicenseGate] Running in web browser, allowing access');
      setIsElectronApp(false);
      setLicenseStatus({ valid: true, type: 'web' });
      setIsChecking(false);
      return;
    }
    
    // We ARE in Electron - must wait for APIs and check license
    setIsElectronApp(true);
    
    const waitForAPIsAndCheck = async () => {
      attempts++;
      
      const hasAPIs = hasElectronAPIs();
      console.log(`[LicenseGate] Waiting for APIs, attempt ${attempts}/${maxAttempts}: hasAPIs=${hasAPIs}`);
      
      if (hasAPIs) {
        console.log('[LicenseGate] Electron APIs ready, checking license...');
        await checkLicenseStatus();
        return;
      }
      
      if (attempts < maxAttempts) {
        // Wait and retry - preload may not be ready yet
        await new Promise(resolve => setTimeout(resolve, 200));
        return waitForAPIsAndCheck();
      }
      
      // After all attempts, APIs still not available - show error, don't allow access!
      console.error('[LicenseGate] Electron APIs not available after 5 seconds');
      setLicenseStatus({ valid: false, message: 'App initialization error. Please restart.' });
      setIsChecking(false);
    };
    
    waitForAPIsAndCheck();
  }, [isElectronByUserAgent, hasElectronAPIs, checkLicenseStatus]);

  // Listen for license events
  useEffect(() => {
    if (isElectronApp === null || !isElectronApp) return;

    const flowstral = (window as any).flowstral;
    const electronAPI = (window as any).electronAPI;

    const handleLicenseStatus = (data: LicenseInfo) => {
      console.log('[LicenseGate] License status event:', data);
      setLicenseStatus(data);
      setIsChecking(false);
      
      if (data.expiresAt) {
        const days = Math.ceil((new Date(data.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
        setDaysLeft(days > 0 ? days : 0);
      }
    };

    const handleLicenseBlocked = (data: any) => {
      console.log('[LicenseGate] License blocked:', data);
      toast.error(data.message || 'License required');
      setLicenseStatus({ valid: false, message: data.message });
    };

    const handleExpiringSoon = (data: any) => {
      console.log('[LicenseGate] License expiring soon:', data);
      setDaysLeft(data.daysLeft);
      toast.warning(`Your license expires in ${data.daysLeft} day(s)`, { duration: 10000 });
    };

    // Subscribe to events
    flowstral?.on?.('license-status', handleLicenseStatus);
    flowstral?.on?.('license-blocked', handleLicenseBlocked);
    flowstral?.on?.('license-expiring-soon', handleExpiringSoon);
    electronAPI?.on?.('license-status', handleLicenseStatus);
    electronAPI?.on?.('license-blocked', handleLicenseBlocked);
    electronAPI?.on?.('license-expiring-soon', handleExpiringSoon);

    return () => {
      flowstral?.off?.('license-status', handleLicenseStatus);
      flowstral?.off?.('license-blocked', handleLicenseBlocked);
      flowstral?.off?.('license-expiring-soon', handleExpiringSoon);
      electronAPI?.off?.('license-status', handleLicenseStatus);
      electronAPI?.off?.('license-blocked', handleLicenseBlocked);
      electronAPI?.off?.('license-expiring-soon', handleExpiringSoon);
    };
  }, [isElectronApp]);

  // Handle license activation
  const handleActivate = async () => {
    if (!licenseKey.trim()) {
      toast.error('Please enter a license key');
      return;
    }

    setIsActivating(true);
    try {
      const flowstral = (window as any).flowstral;
      const electronAPI = (window as any).electronAPI;
      
      console.log('[LicenseGate] Activating license:', licenseKey.trim());
      
      const result = await (
        flowstral?.activateLicense?.(licenseKey.trim()) || 
        electronAPI?.activateLicense?.(licenseKey.trim())
      );

      console.log('[LicenseGate] Activation result:', result);

      if (result?.valid) {
        toast.success('License activated successfully!');
        setLicenseStatus(result);
        if (result.expiresAt) {
          const days = Math.ceil((new Date(result.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
          setDaysLeft(days > 0 ? days : 0);
        }
      } else {
        toast.error(result?.error || 'Invalid license key');
      }
    } catch (error: any) {
      console.error('[LicenseGate] Activation error:', error);
      toast.error(error.message || 'Failed to activate license');
    } finally {
      setIsActivating(false);
    }
  };

  // Loading state - ALWAYS show this until we have a definitive answer
  // This prevents any flash of content before license is verified
  if (isChecking || licenseStatus === null) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 mb-6">
            <Shield className="w-10 h-10 text-white" />
          </div>
          <Loader2 className="w-8 h-8 text-blue-500 animate-spin mx-auto mb-4" />
          <p className="text-slate-400">Verifying license...</p>
          <p className="text-slate-500 text-sm mt-2">Please wait</p>
        </div>
      </div>
    );
  }

  // Dismissible banner state — remembers per session so user isn't nagged after closing
  const [bannerDismissed, setBannerDismissed] = useState(() => {
    try { return sessionStorage.getItem('license-banner-dismissed') === 'true'; } catch { return false; }
  });

  const showBanner = daysLeft !== null && daysLeft <= 7 && !bannerDismissed;

  const dismissBanner = useCallback(() => {
    setBannerDismissed(true);
    try { sessionStorage.setItem('license-banner-dismissed', 'true'); } catch {}
  }, []);

  // Valid license - show app
  if (licenseStatus?.valid) {
    return (
      <>
        {/* License expiry warning banner — dismissible */}
        {showBanner && (
          <div className={`fixed top-0 left-0 right-0 z-50 px-4 py-2 text-center text-sm font-medium flex items-center justify-center ${
            daysLeft <= 3 ? 'bg-red-500 text-white' : 'bg-amber-500 text-black'
          }`}>
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 flex-shrink-0" />
              <span>
                {daysLeft === 0
                  ? 'Your license expires today!'
                  : `Your license expires in ${daysLeft} day${daysLeft! > 1 ? 's' : ''}`
                }
              </span>
              <span className="opacity-75">Please renew to continue using the app.</span>
            </div>
            <button
              onClick={dismissBanner}
              className={`absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-md transition-colors ${
                daysLeft <= 3
                  ? 'hover:bg-red-600 text-white/80 hover:text-white'
                  : 'hover:bg-amber-600 text-black/60 hover:text-black'
              }`}
              aria-label="Dismiss banner"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
        {/* Add top padding when banner is shown */}
        <div className={showBanner ? 'pt-10' : ''}>
          {children}
        </div>
      </>
    );
  }

  // No valid license - show activation screen
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        {/* Logo */}
        <div className="text-center mb-8">
          <img src="/flowstral-logo.svg" alt="Flowstral" className="w-20 h-20 rounded-2xl mx-auto mb-4" />
          <h1 className="text-3xl font-bold text-white mb-2">Flowstral Desktop</h1>
          <p className="text-slate-400">Test Automation Platform</p>
        </div>

        {/* License Card */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 backdrop-blur-sm">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 rounded-lg bg-amber-500/10">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">License Required</h2>
              <p className="text-sm text-slate-400">Enter your license key to continue</p>
            </div>
          </div>

          {/* License Input */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                License Key
              </label>
              <div className="relative">
                <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                <Input
                  type="text"
                  placeholder="FLOWSTRAL-XXXXX-XXXXX-XXXXX-XXXXX"
                  value={licenseKey}
                  onChange={(e) => setLicenseKey(e.target.value.toUpperCase())}
                  className="pl-10 bg-slate-900/50 border-slate-600 text-white placeholder:text-slate-500 font-mono"
                  onKeyDown={(e) => e.key === 'Enter' && handleActivate()}
                />
              </div>
            </div>

            <Button
              onClick={handleActivate}
              disabled={isActivating || !licenseKey.trim()}
              className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white"
            >
              {isActivating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Activating...
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Activate License
                </>
              )}
            </Button>
          </div>

          {/* Help Text */}
          <div className="mt-6 pt-6 border-t border-slate-700">
            <p className="text-sm text-slate-400 text-center">
              Don't have a license key?{' '}
              <a 
                href="https://flowstral.com/pricing" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-blue-400 hover:text-blue-300 underline"
              >
                Get one here
              </a>
            </p>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-slate-500 text-sm mt-6">
          Trial licenses are valid for 14 days
        </p>
      </div>
    </div>
  );
}

// License status badge for use in other components
export function LicenseStatusBadge() {
  const [status, setStatus] = useState<{ valid: boolean; type?: string; daysLeft?: number } | null>(null);

  useEffect(() => {
    const checkStatus = async () => {
      const flowstral = (window as any).flowstral;
      const electronAPI = (window as any).electronAPI;
      
      try {
        const info = await (flowstral?.getLicenseInfo?.() || electronAPI?.getLicenseInfo?.());
        if (info) {
          let daysLeft = null;
          if (info.expiresAt) {
            daysLeft = Math.ceil((new Date(info.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
          }
          setStatus({ valid: info.valid, type: info.type, daysLeft });
        }
      } catch (e) {
        // Not in Electron
      }
    };
    
    checkStatus();
  }, []);

  if (!status) return null;

  return (
    <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium ${
      status.valid 
        ? status.daysLeft && status.daysLeft <= 7
          ? 'bg-amber-500/10 text-amber-400'
          : 'bg-emerald-500/10 text-emerald-400'
        : 'bg-red-500/10 text-red-400'
    }`}>
      {status.valid ? (
        <>
          <CheckCircle className="w-3 h-3" />
          {status.type === 'trial' ? 'Trial' : 'Licensed'}
          {status.daysLeft && status.daysLeft <= 7 && ` (${status.daysLeft}d left)`}
        </>
      ) : (
        <>
          <AlertTriangle className="w-3 h-3" />
          No License
        </>
      )}
    </div>
  );
}

export default LicenseGate;
