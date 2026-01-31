/**
 * Optional plugin selections for the landing page (API, Perf, A11y, Mobile).
 * Used by web and desktop to show/hide sections and feature cards.
 * 
 * Supports license-based access control:
 * - Each plugin can be enabled/disabled by user preference
 * - Each plugin can be licensed/unlicensed based on tenant license
 * - Only licensed plugins can be enabled
 * - Unlicensed plugins show lock icon with upgrade prompt
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'flowstral_landing_plugins';
const LICENSE_STORAGE_KEY = 'flowstral_license_info';

export type PluginKey = 'api' | 'perf' | 'a11y' | 'mobile';

export type LandingPlugins = {
  api: boolean;
  perf: boolean;
  a11y: boolean;
  mobile: boolean;
};

export type LicenseTier = 'free' | 'starter' | 'professional' | 'enterprise';

export type LicenseInfo = {
  tier: LicenseTier;
  licensedPlugins: PluginKey[];
  expiresAt?: string;
  tenantId?: string;
};

// Default plugins (all enabled for display, but license controls access)
const defaultPlugins: LandingPlugins = {
  api: true,
  perf: true,
  a11y: true,
  mobile: true,
};

// Default license (enterprise has all, free tier has none)
const defaultLicense: LicenseInfo = {
  tier: 'enterprise',
  licensedPlugins: ['api', 'perf', 'a11y', 'mobile'],
};

// Plugin metadata for UI display
export const pluginMetadata: Record<PluginKey, {
  label: string;
  description: string;
  icon: string;
  tier: LicenseTier; // Minimum tier required
}> = {
  api: {
    label: 'API Testing',
    description: 'REST, GraphQL, SOAP testing with security scanning',
    icon: 'Globe',
    tier: 'starter',
  },
  perf: {
    label: 'Performance Testing',
    description: 'Load testing with 10k+ VUs, SRM, Lighthouse integration',
    icon: 'Activity',
    tier: 'professional',
  },
  a11y: {
    label: 'Accessibility Testing',
    description: 'WCAG 2.1 A/AA/AAA scanning with remediation guidance',
    icon: 'Accessibility',
    tier: 'starter',
  },
  mobile: {
    label: 'Mobile Testing',
    description: '50+ device profiles, network throttling, native app support',
    icon: 'Smartphone',
    tier: 'professional',
  },
};

// Tier hierarchy for comparison
const tierOrder: LicenseTier[] = ['free', 'starter', 'professional', 'enterprise'];

function tierAtLeast(current: LicenseTier, required: LicenseTier): boolean {
  return tierOrder.indexOf(current) >= tierOrder.indexOf(required);
}

function loadFromStorage(): LandingPlugins {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<LandingPlugins>;
      return { ...defaultPlugins, ...parsed };
    }
  } catch (_) {}
  return { ...defaultPlugins };
}

function saveToStorage(plugins: LandingPlugins) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(plugins));
  } catch (_) {}
}

function loadLicenseFromStorage(): LicenseInfo {
  try {
    const raw = localStorage.getItem(LICENSE_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<LicenseInfo>;
      return { ...defaultLicense, ...parsed };
    }
  } catch (_) {}
  return { ...defaultLicense };
}

function saveLicenseToStorage(license: LicenseInfo) {
  try {
    localStorage.setItem(LICENSE_STORAGE_KEY, JSON.stringify(license));
  } catch (_) {}
}

type LandingPluginsContextValue = {
  // Plugin visibility preferences
  plugins: LandingPlugins;
  setPlugin: (key: PluginKey, value: boolean) => void;
  setPlugins: (plugins: Partial<LandingPlugins>) => void;
  isEnabled: (key: PluginKey) => boolean;
  
  // License information
  license: LicenseInfo;
  setLicense: (license: Partial<LicenseInfo>) => void;
  isLicensed: (key: PluginKey) => boolean;
  canEnable: (key: PluginKey) => boolean;
  getRequiredTier: (key: PluginKey) => LicenseTier;
  
  // Combined check (enabled AND licensed)
  isAvailable: (key: PluginKey) => boolean;
};

const LandingPluginsContext = createContext<LandingPluginsContextValue | null>(null);

export function LandingPluginsProvider({ children }: { children: React.ReactNode }) {
  const [plugins, setPluginsState] = useState<LandingPlugins>(defaultPlugins);
  const [license, setLicenseState] = useState<LicenseInfo>(defaultLicense);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    // In Electron, prefer desktop-provided plugins and license if available
    const win = typeof window !== 'undefined' ? window : null;
    const electron = win && (win as unknown as { 
      electronAPI?: { 
        getLandingPlugins?: () => Promise<LandingPlugins | null>;
        getLicenseInfo?: () => Promise<LicenseInfo | null>;
      } 
    }).electronAPI;
    
    if (electron?.getLandingPlugins) {
      Promise.all([
        electron.getLandingPlugins().catch(() => null),
        electron.getLicenseInfo?.().catch(() => null),
      ]).then(([desktopPlugins, desktopLicense]) => {
        if (desktopPlugins) {
          setPluginsState((prev) => ({ ...prev, ...desktopPlugins }));
        } else {
          setPluginsState(loadFromStorage());
        }
        if (desktopLicense) {
          setLicenseState((prev) => ({ ...prev, ...desktopLicense }));
        } else {
          setLicenseState(loadLicenseFromStorage());
        }
        setHydrated(true);
      }).catch(() => {
        setPluginsState(loadFromStorage());
        setLicenseState(loadLicenseFromStorage());
        setHydrated(true);
      });
    } else {
      setPluginsState(loadFromStorage());
      setLicenseState(loadLicenseFromStorage());
      setHydrated(true);
    }
  }, []);

  const isLicensed = useCallback((key: PluginKey) => {
    return license.licensedPlugins.includes(key);
  }, [license]);

  const canEnable = useCallback((key: PluginKey) => {
    return isLicensed(key);
  }, [isLicensed]);

  const getRequiredTier = useCallback((key: PluginKey) => {
    return pluginMetadata[key].tier;
  }, []);

  const setPlugin = useCallback((key: PluginKey, value: boolean) => {
    // Only allow enabling if licensed
    if (value && !isLicensed(key)) {
      console.warn(`Cannot enable plugin "${key}" - not licensed`);
      return;
    }
    
    setPluginsState((prev) => {
      const next = { ...prev, [key]: value };
      saveToStorage(next);
      if (typeof window !== 'undefined' && (window as unknown as { electronAPI?: { setLandingPlugins?: (p: LandingPlugins) => Promise<void> } }).electronAPI?.setLandingPlugins) {
        (window as unknown as { electronAPI: { setLandingPlugins: (p: LandingPlugins) => Promise<void> } }).electronAPI.setLandingPlugins(next).catch(() => {});
      }
      return next;
    });
  }, [isLicensed]);

  const setPlugins = useCallback((partial: Partial<LandingPlugins>) => {
    setPluginsState((prev) => {
      // Filter out any unlicensed plugins being enabled
      const filtered = { ...partial };
      for (const key of Object.keys(filtered) as PluginKey[]) {
        if (filtered[key] && !isLicensed(key)) {
          delete filtered[key];
        }
      }
      
      const next = { ...prev, ...filtered };
      saveToStorage(next);
      if (typeof window !== 'undefined' && (window as unknown as { electronAPI?: { setLandingPlugins?: (p: LandingPlugins) => Promise<void> } }).electronAPI?.setLandingPlugins) {
        (window as unknown as { electronAPI: { setLandingPlugins: (p: LandingPlugins) => Promise<void> } }).electronAPI.setLandingPlugins(next).catch(() => {});
      }
      return next;
    });
  }, [isLicensed]);

  const setLicense = useCallback((partial: Partial<LicenseInfo>) => {
    setLicenseState((prev) => {
      const next = { ...prev, ...partial };
      saveLicenseToStorage(next);
      
      // Also sync to Electron if available
      if (typeof window !== 'undefined' && (window as unknown as { electronAPI?: { setLicenseInfo?: (l: LicenseInfo) => Promise<void> } }).electronAPI?.setLicenseInfo) {
        (window as unknown as { electronAPI: { setLicenseInfo: (l: LicenseInfo) => Promise<void> } }).electronAPI.setLicenseInfo(next).catch(() => {});
      }
      return next;
    });
  }, []);

  const isEnabled = useCallback((key: PluginKey) => plugins[key], [plugins]);
  
  const isAvailable = useCallback((key: PluginKey) => {
    return isEnabled(key) && isLicensed(key);
  }, [isEnabled, isLicensed]);

  const value: LandingPluginsContextValue = {
    plugins,
    setPlugin,
    setPlugins,
    isEnabled,
    license,
    setLicense,
    isLicensed,
    canEnable,
    getRequiredTier,
    isAvailable,
  };

  if (!hydrated) {
    return <>{children}</>;
  }

  return (
    <LandingPluginsContext.Provider value={value}>
      {children}
    </LandingPluginsContext.Provider>
  );
}

export function useLandingPlugins() {
  const ctx = useContext(LandingPluginsContext);
  if (!ctx) {
    // Return safe defaults when used outside provider
    return {
      plugins: defaultPlugins,
      setPlugin: () => {},
      setPlugins: () => {},
      isEnabled: () => true,
      license: defaultLicense,
      setLicense: () => {},
      isLicensed: () => true,
      canEnable: () => true,
      getRequiredTier: (key: PluginKey) => pluginMetadata[key].tier,
      isAvailable: () => true,
    };
  }
  return ctx;
}

/**
 * Hook to get plugin info with license status
 */
export function usePluginInfo(key: PluginKey) {
  const { isEnabled, isLicensed, canEnable, getRequiredTier, license } = useLandingPlugins();
  
  return {
    key,
    ...pluginMetadata[key],
    enabled: isEnabled(key),
    licensed: isLicensed(key),
    canEnable: canEnable(key),
    requiredTier: getRequiredTier(key),
    currentTier: license.tier,
    needsUpgrade: !isLicensed(key),
  };
}
