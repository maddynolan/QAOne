/**
 * Plugin/Module Management System
 * 
 * Controls which features are available based on:
 * 1. License tier (free, starter, professional, enterprise)
 * 2. User preference (can hide licensed features they don't need)
 * 
 * ARCHITECTURE COMPARISON WITH COMPETITORS:
 * 
 * | Tool          | Model                    | QAAI Equivalent           |
 * |---------------|--------------------------|---------------------------|
 * | Tricentis     | Module-based purchase    | Plugin tiers              |
 * | Katalon       | Free + paid tiers        | License tiers             |
 * | SmartBear     | Base + add-ons           | Core + plugins            |
 * | mabl          | All-in-one, feature-gated| Single product + plugins  |
 * 
 * QAAI MODEL:
 * - CORE: Record, Build, Tests, Dashboard, Settings (always available)
 * - PLUGINS: API, Perf, A11y, Mobile, Visual, SF, Flowpilot, Alchemy, etc.
 * - Each plugin has a minimum tier requirement
 * - Users can hide plugins they don't need (declutter UI)
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import traceLogger from '@/lib/trace-logger';

const STORAGE_KEY = 'flowstral_plugins';
const LICENSE_STORAGE_KEY = 'flowstral_license_info';

// All available plugin keys
export type PluginKey = 
  | 'api' 
  | 'perf' 
  | 'a11y' 
  | 'mobile' 
  | 'visual' 
  | 'salesforce' 
  | 'flowpilot' 
  | 'alchemy'
  | 'analytics'
  | 'secrets'
  | 'integrations';

export type LandingPlugins = Record<PluginKey, boolean>;

export type LicenseTier = 'free' | 'starter' | 'professional' | 'enterprise';

export type LicenseInfo = {
  tier: LicenseTier;
  licensedPlugins: PluginKey[];
  expiresAt?: string;
  tenantId?: string;
  maxUsers?: number;
  features?: string[];
};

// Default plugins - enterprise shows all, others are tier-gated
const defaultPlugins: LandingPlugins = {
  api: true,
  perf: true,
  a11y: true,
  mobile: true,
  visual: true,
  salesforce: true,
  flowpilot: true,
  alchemy: true,
  analytics: true,
  secrets: true,
  integrations: true,
};

// Default license (enterprise has all)
const defaultLicense: LicenseInfo = {
  tier: 'enterprise',
  licensedPlugins: ['api', 'perf', 'a11y', 'mobile', 'visual', 'salesforce', 'flowpilot', 'alchemy', 'analytics', 'secrets', 'integrations'],
};

// Plugin metadata for UI display
export const pluginMetadata: Record<PluginKey, {
  label: string;
  description: string;
  icon: string;
  tier: LicenseTier;
  category: 'testing' | 'platform' | 'ai' | 'enterprise';
  navPath?: string; // Navigation path if this plugin adds a tab
}> = {
  api: {
    label: 'API Testing',
    description: 'REST, GraphQL, SOAP, Mock Server, Security Scanning, 10K+ data generation',
    icon: 'Globe',
    tier: 'starter',
    category: 'testing',
    navPath: '/api',
  },
  perf: {
    label: 'Performance Testing',
    description: 'Load testing with 10k+ VUs, k6-style checks, SRM, Lighthouse integration',
    icon: 'Activity',
    tier: 'professional',
    category: 'testing',
    navPath: '/performance',
  },
  a11y: {
    label: 'Accessibility Testing',
    description: 'WCAG 2.1 A/AA/AAA scanning with remediation guidance',
    icon: 'Accessibility',
    tier: 'starter',
    category: 'testing',
    navPath: '/accessibility',
  },
  mobile: {
    label: 'Mobile Testing',
    description: '50+ device profiles, network throttling, responsive testing',
    icon: 'Smartphone',
    tier: 'professional',
    category: 'testing',
    navPath: '/mobile',
  },
  visual: {
    label: 'Visual Testing',
    description: 'Screenshot comparison, visual regression, 6 testing modes',
    icon: 'Eye',
    tier: 'starter',
    category: 'testing',
    navPath: '/visual-testing',
  },
  salesforce: {
    label: 'Salesforce',
    description: 'Native Salesforce testing with 20+ specialized tools',
    icon: 'Cloud',
    tier: 'professional',
    category: 'platform',
    navPath: '/salesforce',
  },
  flowpilot: {
    label: 'Flowpilot (AI)',
    description: 'Goal-based AI testing - describe what to test, AI does the rest',
    icon: 'Bot',
    tier: 'professional',
    category: 'ai',
    navPath: '/flowpilot',
  },
  alchemy: {
    label: 'Code Alchemy',
    description: 'Import existing test repos, convert between frameworks',
    icon: 'Wand2',
    tier: 'starter',
    category: 'platform',
    navPath: '/code-alchemy',
  },
  analytics: {
    label: 'Advanced Analytics',
    description: 'Flaky test detection, trend analysis, strategy effectiveness',
    icon: 'BarChart3',
    tier: 'starter',
    category: 'enterprise',
    navPath: '/analytics',
  },
  secrets: {
    label: 'Secrets Vault',
    description: 'Secure credential storage, environment variables, API keys',
    icon: 'Shield',
    tier: 'professional',
    category: 'enterprise',
    navPath: '/secrets',
  },
  integrations: {
    label: 'Integrations',
    description: 'Jira, Azure DevOps, GitHub, Slack, CI/CD pipelines',
    icon: 'Plug',
    tier: 'starter',
    category: 'enterprise',
    navPath: '/integrations',
  },
};

// Tier hierarchy for comparison
export const tierInfo: Record<LicenseTier, {
  label: string;
  description: string;
  color: string;
  plugins: PluginKey[];
}> = {
  free: {
    label: 'Free',
    description: 'Core Record & Playback only',
    color: 'gray',
    plugins: [], // No plugins, just core
  },
  starter: {
    label: 'Starter',
    description: 'Essential testing plugins',
    color: 'blue',
    plugins: ['api', 'a11y', 'visual', 'alchemy', 'analytics', 'integrations'],
  },
  professional: {
    label: 'Professional',
    description: 'Full testing suite',
    color: 'purple',
    plugins: ['api', 'perf', 'a11y', 'mobile', 'visual', 'salesforce', 'flowpilot', 'alchemy', 'analytics', 'secrets', 'integrations'],
  },
  enterprise: {
    label: 'Enterprise',
    description: 'Everything + priority support',
    color: 'amber',
    plugins: ['api', 'perf', 'a11y', 'mobile', 'visual', 'salesforce', 'flowpilot', 'alchemy', 'analytics', 'secrets', 'integrations'],
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
      traceLogger.warn(`Cannot enable plugin "${key}" - not licensed`);
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
