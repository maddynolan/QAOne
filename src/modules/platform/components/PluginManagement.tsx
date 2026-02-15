/**
 * Plugin Management Component
 * 
 * Allows users to:
 * 1. View their current license tier and expiration
 * 2. See which plugins are available based on license
 * 3. Enable/disable plugins to declutter the UI
 * 4. Upgrade to higher tiers for more features
 * 
 * COMPARISON WITH COMPETITOR LICENSING MODELS:
 * 
 * | Tool        | Model              | Pros                    | Cons                    |
 * |-------------|--------------------|-----------------------|-------------------------|
 * | Tricentis   | Per-module pricing | Pay for what you need | Complex pricing         |
 * | Katalon     | Tiered plans       | Simple tiers          | All-or-nothing per tier |
 * | SmartBear   | Base + add-ons     | Flexible              | Can get expensive       |
 * | mabl        | Single product     | Simple                | Limited customization   |
 * 
 * QAAI uses a hybrid: Tiered plans with per-plugin visibility toggle
 */

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  useLandingPlugins,
  pluginMetadata,
  tierInfo,
  type PluginKey,
  type LicenseTier,
} from '@/contexts/LandingPluginsContext';
import {
  Globe,
  Activity,
  Accessibility,
  Smartphone,
  Eye,
  Cloud,
  Bot,
  Wand2,
  BarChart3,
  Shield,
  Plug,
  Lock,
  Check,
  Crown,
  Sparkles,
  ChevronRight,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';

// Icon mapping
const iconMap: Record<string, React.ElementType> = {
  Globe,
  Activity,
  Accessibility,
  Smartphone,
  Eye,
  Cloud,
  Bot,
  Wand2,
  BarChart3,
  Shield,
  Plug,
};

// Tier badge colors
const tierColors: Record<LicenseTier, string> = {
  free: 'bg-gray-100 text-gray-700 border-gray-300',
  starter: 'bg-blue-100 text-blue-700 border-blue-300',
  professional: 'bg-purple-100 text-purple-700 border-purple-300',
  enterprise: 'bg-amber-100 text-amber-700 border-amber-300',
};

interface PluginCardProps {
  pluginKey: PluginKey;
  isLicensed: boolean;
  isEnabled: boolean;
  onToggle: (enabled: boolean) => void;
  currentTier: LicenseTier;
}

function PluginCard({ pluginKey, isLicensed, isEnabled, onToggle, currentTier }: PluginCardProps) {
  const meta = pluginMetadata[pluginKey];
  const Icon = iconMap[meta.icon] || Globe;
  const requiredTier = meta.tier;
  const tierOrder: LicenseTier[] = ['free', 'starter', 'professional', 'enterprise'];
  const needsUpgrade = tierOrder.indexOf(currentTier) < tierOrder.indexOf(requiredTier);

  return (
    <div
      className={cn(
        "relative flex items-start gap-4 p-4 rounded-lg border transition-all",
        isLicensed && isEnabled
          ? "bg-card border-primary/20 shadow-sm"
          : isLicensed
          ? "bg-muted/30 border-border"
          : "bg-muted/10 border-dashed border-muted-foreground/30 opacity-60"
      )}
    >
      {/* Icon */}
      <div
        className={cn(
          "flex items-center justify-center w-10 h-10 rounded-lg shrink-0",
          isLicensed && isEnabled
            ? "bg-primary/10 text-primary"
            : "bg-muted text-muted-foreground"
        )}
      >
        <Icon className="w-5 h-5" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <h4 className="font-medium text-sm">{meta.label}</h4>
          <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0", tierColors[requiredTier])}>
            {tierInfo[requiredTier].label}
          </Badge>
          {meta.category === 'ai' && (
            <Badge className="text-[10px] px-1.5 py-0 bg-gradient-to-r from-violet-500 to-purple-500 text-white border-0">
              <Sparkles className="w-2.5 h-2.5 mr-0.5" />
              AI
            </Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground line-clamp-2">{meta.description}</p>
      </div>

      {/* Toggle / Lock */}
      <div className="shrink-0 flex items-center">
        {isLicensed ? (
          <Switch
            checked={isEnabled}
            onCheckedChange={onToggle}
            aria-label={`Toggle ${meta.label}`}
          />
        ) : (
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Lock className="w-4 h-4" />
            <span className="text-xs">Upgrade</span>
          </div>
        )}
      </div>

      {/* Locked overlay indicator */}
      {!isLicensed && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/50 rounded-lg cursor-pointer hover:bg-background/70 transition-colors">
          <Button variant="outline" size="sm" className="text-xs">
            <Crown className="w-3 h-3 mr-1" />
            Requires {tierInfo[requiredTier].label}
          </Button>
        </div>
      )}
    </div>
  );
}

export function PluginManagement() {
  const { plugins, setPlugin, license, isLicensed, isEnabled } = useLandingPlugins();
  const [showAllPlugins, setShowAllPlugins] = useState(false);

  // Group plugins by category
  const categories = {
    testing: {
      label: 'Testing Modules',
      description: 'Core testing capabilities',
      plugins: ['api', 'perf', 'a11y', 'mobile', 'visual'] as PluginKey[],
    },
    platform: {
      label: 'Platform Extensions',
      description: 'Specialized platform integrations',
      plugins: ['salesforce', 'alchemy'] as PluginKey[],
    },
    ai: {
      label: 'AI & Automation',
      description: 'AI-powered features',
      plugins: ['flowpilot'] as PluginKey[],
    },
    enterprise: {
      label: 'Enterprise Features',
      description: 'Advanced enterprise capabilities',
      plugins: ['analytics', 'secrets', 'integrations'] as PluginKey[],
    },
  };

  const handleToggle = (key: PluginKey, enabled: boolean) => {
    setPlugin(key, enabled);
    toast.success(`${pluginMetadata[key].label} ${enabled ? 'enabled' : 'disabled'}`);
  };

  const enabledCount = Object.values(plugins).filter(Boolean).length;
  const licensedCount = Object.keys(pluginMetadata).filter(k => isLicensed(k as PluginKey)).length;

  return (
    <div className="space-y-6">
      {/* License Status Card */}
      <Card className={cn(
        "border-2",
        license.tier === 'enterprise' ? "border-amber-300 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30" :
        license.tier === 'professional' ? "border-purple-300 bg-gradient-to-br from-purple-50 to-violet-50 dark:from-purple-950/30 dark:to-violet-950/30" :
        license.tier === 'starter' ? "border-blue-300 bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-950/30 dark:to-cyan-950/30" :
        "border-gray-300"
      )}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={cn(
                "w-10 h-10 rounded-full flex items-center justify-center",
                license.tier === 'enterprise' ? "bg-amber-500 text-white" :
                license.tier === 'professional' ? "bg-purple-500 text-white" :
                license.tier === 'starter' ? "bg-blue-500 text-white" :
                "bg-gray-500 text-white"
              )}>
                <Crown className="w-5 h-5" />
              </div>
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  {tierInfo[license.tier].label} License
                  {license.tier === 'enterprise' && <Sparkles className="w-4 h-4 text-amber-500" />}
                </CardTitle>
                <CardDescription>{tierInfo[license.tier].description}</CardDescription>
              </div>
            </div>
            {license.tier !== 'enterprise' && (
              <Button variant="default" size="sm" className="bg-gradient-to-r from-violet-600 to-purple-600">
                <Crown className="w-4 h-4 mr-1" />
                Upgrade
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-6 text-sm">
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4 text-green-500" />
              <span><strong>{licensedCount}</strong> plugins available</span>
            </div>
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-blue-500" />
              <span><strong>{enabledCount}</strong> plugins enabled</span>
            </div>
            {license.expiresAt && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <AlertCircle className="w-4 h-4" />
                <span>Expires: {new Date(license.expiresAt).toLocaleDateString()}</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            Object.keys(pluginMetadata).forEach(key => {
              if (isLicensed(key as PluginKey)) {
                setPlugin(key as PluginKey, true);
              }
            });
            toast.success('All licensed plugins enabled');
          }}
        >
          <Check className="w-4 h-4 mr-1" />
          Enable All
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            Object.keys(pluginMetadata).forEach(key => {
              setPlugin(key as PluginKey, false);
            });
            toast.success('All plugins disabled - showing core only');
          }}
        >
          <RefreshCw className="w-4 h-4 mr-1" />
          Core Only
        </Button>
        <div className="flex-1" />
        <span className="text-xs text-muted-foreground">
          Disabled plugins are hidden from navigation
        </span>
      </div>

      {/* Plugin Categories */}
      {Object.entries(categories).map(([categoryKey, category]) => (
        <Card key={categoryKey}>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{category.label}</CardTitle>
            <CardDescription>{category.description}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3">
              {category.plugins.map(pluginKey => (
                <PluginCard
                  key={pluginKey}
                  pluginKey={pluginKey}
                  isLicensed={isLicensed(pluginKey)}
                  isEnabled={isEnabled(pluginKey)}
                  onToggle={(enabled) => handleToggle(pluginKey, enabled)}
                  currentTier={license.tier}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      ))}

      {/* Tier Comparison */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">License Tiers Comparison</CardTitle>
          <CardDescription>Compare features across different license tiers</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-4">
            {(['free', 'starter', 'professional', 'enterprise'] as LicenseTier[]).map(tier => {
              const info = tierInfo[tier];
              const isCurrent = tier === license.tier;
              
              return (
                <div
                  key={tier}
                  className={cn(
                    "p-4 rounded-lg border-2 transition-all",
                    isCurrent
                      ? "border-primary bg-primary/5 shadow-sm"
                      : "border-border hover:border-primary/30"
                  )}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Badge className={cn("text-xs", tierColors[tier])}>
                      {info.label}
                    </Badge>
                    {isCurrent && (
                      <Badge variant="default" className="text-[10px] px-1">Current</Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mb-3">{info.description}</p>
                  <div className="space-y-1">
                    <p className="text-xs font-medium">Includes:</p>
                    <ul className="text-xs text-muted-foreground space-y-0.5">
                      <li className="flex items-center gap-1">
                        <Check className="w-3 h-3 text-green-500" />
                        Core (Record, Build, Tests)
                      </li>
                      {info.plugins.slice(0, 4).map(p => (
                        <li key={p} className="flex items-center gap-1">
                          <Check className="w-3 h-3 text-green-500" />
                          {pluginMetadata[p].label}
                        </li>
                      ))}
                      {info.plugins.length > 4 && (
                        <li className="text-primary">+{info.plugins.length - 4} more</li>
                      )}
                    </ul>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Core Features Note */}
      <div className="flex items-start gap-3 p-4 bg-muted/50 rounded-lg">
        <AlertCircle className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
        <div className="text-sm text-muted-foreground">
          <p className="font-medium text-foreground mb-1">Core Features (Always Available)</p>
          <p>
            <strong>Record & Playback</strong>, <strong>Test Builder</strong>, <strong>Test Repository</strong>, 
            <strong> Dashboard</strong>, and <strong>Settings</strong> are always available regardless of license tier.
            Plugins add specialized testing capabilities on top of the core platform.
          </p>
        </div>
      </div>
    </div>
  );
}

export default PluginManagement;
