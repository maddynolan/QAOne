/**
 * AI Service Configuration Component
 * Settings > AI tab — backend-synced configuration with BYOK support.
 *
 * Sections:
 *   1. AI Master Toggle Card (hero)
 *   2. Provider Configuration (provider, model, BYOK key, endpoint, test)
 *   3. Feature Toggles (grouped by category)
 *   4. Usage & Budget
 */

import { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sparkles,
  CheckCircle,
  AlertCircle,
  Loader2,
  Zap,
  Key,
  Trash2,
  Shield,
  Server,
  Activity,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { useAI, AI_FEATURE_AREAS, type AIFeatureId } from '@/contexts/AIContext';
import { useTheme } from '@/contexts/ThemeContext';
import { cn } from '@/lib/utils';
import { API_BASE_URL } from '@/lib/api-config';
import { toast } from 'sonner';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PROVIDER_OPTIONS = [
  { value: 'openai', label: 'OpenAI', description: 'GPT-4o, GPT-4o-mini' },
  { value: 'anthropic', label: 'Anthropic Claude', description: 'Claude Sonnet, Haiku' },
  { value: 'custom', label: 'Custom / Azure', description: 'Custom endpoint' },
] as const;

const MODEL_OPTIONS: Record<string, { value: string; label: string }[]> = {
  openai: [
    { value: 'gpt-4o-mini', label: 'GPT-4o-mini (recommended)' },
    { value: 'gpt-4o', label: 'GPT-4o' },
    { value: 'gpt-4', label: 'GPT-4' },
  ],
  anthropic: [
    { value: 'claude-sonnet-4', label: 'Claude Sonnet 4' },
    { value: 'claude-3.5-sonnet', label: 'Claude 3.5 Sonnet' },
    { value: 'claude-3-haiku', label: 'Claude 3 Haiku' },
  ],
  custom: [],
};

const FEATURE_GROUPS: Record<string, AIFeatureId[]> = {
  'Test Generation': ['test_case_generation', 'test_step_suggestions', 'gherkin_generation', 'requirement_analysis'],
  'Self-Healing & Locators': ['self_healing', 'smart_locators'],
  'API & Performance': ['api_test_generation', 'api_mock_generation', 'perf_analysis', 'load_pattern_suggestions'],
  'Visual & Accessibility': ['visual_analysis', 'a11y_suggestions'],
  'Defects & Code': ['defect_analysis', 'defect_triage', 'code_generation', 'code_optimization'],
  'Salesforce': ['sf_test_generation', 'sf_data_generation'],
  'Assistants': ['chat_assistant', 'smart_fill'],
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Whether the active provider has a stored key */
function providerHasKey(
  provider: string,
  hasApiKey: boolean,
  hasAnthropicKey: boolean,
): boolean {
  if (provider === 'openai') return hasApiKey;
  if (provider === 'anthropic') return hasAnthropicKey;
  // custom providers use the openai key slot
  return hasApiKey;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface AIConfigProps {
  onConfigChange?: (config: any) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const AIConfiguration = ({ onConfigChange }: AIConfigProps) => {
  const { theme } = useTheme();
  const {
    config,
    status,
    updateConfig,
    toggleFeature,
    isFeatureEnabled,
    testConnection,
    storeApiKey,
    deleteApiKey,
  } = useAI();

  // Local UI state
  const [testing, setTesting] = useState(false);
  const [savingKey, setSavingKey] = useState(false);
  const [deletingKey, setDeletingKey] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [customModelInput, setCustomModelInput] = useState(config.model);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(Object.keys(FEATURE_GROUPS)));

  // Derived
  const activeProviderHasKey = providerHasKey(config.provider, config.hasApiKey, config.hasAnthropicKey);
  const featureTogglesEnabled = config.enabled && activeProviderHasKey;
  const models = MODEL_OPTIONS[config.provider] ?? [];
  const requestPct = config.maxRequestsPerDay > 0
    ? Math.min(100, (config.requestsToday / config.maxRequestsPerDay) * 100)
    : 0;

  // Map provider value to the key slot name used on the backend
  const keyProviderSlot = config.provider === 'custom' ? 'openai' : config.provider;

  // Theme-aware class helpers
  const isDark = theme === 'dark';
  const cardClass = cn(isDark ? "border-gray-700 bg-gray-900/50" : "border-gray-200 bg-white");
  const labelClass = cn("text-sm", isDark ? "text-gray-300" : "text-gray-700");
  const mutedTextClass = cn(isDark ? "text-gray-400" : "text-gray-500");
  const bodyTextClass = cn(isDark ? "text-gray-200" : "text-gray-900");
  const subtleTextClass = cn(isDark ? "text-gray-500" : "text-gray-400");
  const inputClass = cn(isDark ? "bg-gray-800 border-gray-700 text-gray-200" : "bg-white border-gray-200 text-gray-900");
  const selectContentClass = cn(isDark ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200");
  const selectItemClass = cn(isDark ? "text-gray-200" : "text-gray-900");
  const separatorClass = cn(isDark ? "bg-gray-700" : "bg-gray-200");
  const innerBorderClass = cn(isDark ? "border-gray-700/50" : "border-gray-200");

  // -----------------------------------------------------------------------
  // Handlers
  // -----------------------------------------------------------------------

  const handleTestConnection = async () => {
    setTesting(true);
    try {
      const success = await testConnection();
      if (success) {
        toast.success('AI service connected successfully');
      } else {
        toast.error('Connection failed -- check your API key and provider settings');
      }
    } catch {
      toast.error('Connection test failed');
    } finally {
      setTesting(false);
    }
  };

  const handleSaveKey = async () => {
    if (!apiKeyInput.trim()) return;
    setSavingKey(true);
    try {
      const ok = await storeApiKey(keyProviderSlot, apiKeyInput.trim());
      if (ok) {
        toast.success('API key stored securely on the server');
        setApiKeyInput('');
      } else {
        toast.error('Failed to store API key');
      }
    } catch {
      toast.error('Error storing API key');
    } finally {
      setSavingKey(false);
    }
  };

  const handleDeleteKey = async () => {
    setDeletingKey(true);
    try {
      const ok = await deleteApiKey(keyProviderSlot);
      if (ok) {
        toast.success('API key removed');
      } else {
        toast.error('Failed to remove API key');
      }
    } catch {
      toast.error('Error removing API key');
    } finally {
      setDeletingKey(false);
    }
  };

  const handleProviderChange = (provider: string) => {
    const newProvider = provider as 'openai' | 'anthropic' | 'custom';
    const defaultModel = (MODEL_OPTIONS[newProvider]?.[0]?.value) || config.model;
    updateConfig({ provider: newProvider, model: defaultModel });
  };

  const handleModelChange = (model: string) => {
    updateConfig({ model });
  };

  const toggleGroup = (groupName: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupName)) {
        next.delete(groupName);
      } else {
        next.add(groupName);
      }
      return next;
    });
  };

  // Count enabled features
  const enabledFeatureCount = useMemo(() => {
    return Object.values(AI_FEATURE_AREAS).filter(f => config.enabledFeatures.has(f.id)).length;
  }, [config.enabledFeatures]);

  // -----------------------------------------------------------------------
  // Status badge
  // -----------------------------------------------------------------------
  const statusBadge = (() => {
    if (!config.enabled) {
      return (
        <Badge variant="outline" className={cn(isDark ? "text-gray-400 border-gray-600" : "text-gray-500 border-gray-300")}>
          Disabled
        </Badge>
      );
    }
    if (status.connected) {
      return (
        <Badge className={cn(
          "flex items-center gap-1",
          isDark ? "bg-green-500/20 text-green-400 border border-green-500/30" : "bg-green-50 text-green-700 border border-green-200"
        )}>
          <CheckCircle className="h-3 w-3" />
          Connected
        </Badge>
      );
    }
    if (!activeProviderHasKey) {
      return (
        <Badge className={cn(
          "flex items-center gap-1",
          isDark ? "bg-amber-500/20 text-amber-400 border border-amber-500/30" : "bg-amber-50 text-amber-700 border border-amber-200"
        )}>
          <Key className="h-3 w-3" />
          Not Configured
        </Badge>
      );
    }
    return (
      <Badge className={cn(
        "flex items-center gap-1",
        isDark ? "bg-red-500/20 text-red-400 border border-red-500/30" : "bg-red-50 text-red-700 border border-red-200"
      )}>
        <AlertCircle className="h-3 w-3" />
        Error
      </Badge>
    );
  })();

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------
  return (
    <div className="space-y-6 w-full">
      {/* ================================================================
          1. AI Master Toggle Card (Hero)
          ================================================================ */}
      <Card className={cardClass}>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Sparkles className="h-5 w-5 text-purple-500" />
                AI Configuration
              </CardTitle>
              <CardDescription className={mutedTextClass}>
                Configure AI-powered features across the platform
              </CardDescription>
            </div>
            {statusBadge}
          </div>
        </CardHeader>
        <CardContent>
          <div className={cn(
            "flex items-center justify-between p-4 rounded-lg border",
            isDark
              ? "bg-gradient-to-r from-purple-500/10 to-blue-500/10 border-purple-500/20"
              : "bg-gradient-to-r from-purple-50 to-blue-50 border-purple-200"
          )}>
            <div className="space-y-0.5">
              <Label htmlFor="ai-master-toggle" className={cn("text-base font-semibold flex items-center gap-2", bodyTextClass)}>
                <Zap className="h-4 w-4 text-yellow-500" />
                Enable AI Features
              </Label>
              <p className={cn("text-sm", mutedTextClass)}>
                When enabled, AI buttons appear throughout the app
              </p>
            </div>
            <Switch
              id="ai-master-toggle"
              checked={config.enabled}
              onCheckedChange={(enabled) => updateConfig({ enabled })}
            />
          </div>

          {/* Summary when connected */}
          {config.enabled && status.connected && (
            <div className={cn("mt-3 flex items-center gap-3 text-sm", mutedTextClass)}>
              <span className="flex items-center gap-1">
                <Server className="h-3.5 w-3.5" />
                {PROVIDER_OPTIONS.find(p => p.value === config.provider)?.label || config.provider}
              </span>
              <span className={subtleTextClass}>|</span>
              <span className={cn("font-mono", bodyTextClass)}>{config.model}</span>
              {status.latency && (
                <>
                  <span className={subtleTextClass}>|</span>
                  <span>{status.latency}ms</span>
                </>
              )}
            </div>
          )}

          {!config.enabled && (
            <div className={cn(
              "mt-4 p-4 rounded-lg text-center border",
              isDark ? "bg-gray-800/50 border-gray-700/50" : "bg-gray-50 border-gray-200"
            )}>
              <p className={mutedTextClass}>
                Enable AI to unlock smart test generation, self-healing selectors, and more
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Only render remaining sections when AI is enabled */}
      {config.enabled && (
        <>
          {/* ================================================================
              2. Provider Configuration
              ================================================================ */}
          <Card className={cardClass}>
            <CardHeader className="pb-4">
              <CardTitle className="text-base flex items-center gap-2">
                <Server className={cn("h-4 w-4", isDark ? "text-blue-400" : "text-blue-600")} />
                Provider & Model
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* Provider selector */}
              <div className="space-y-2">
                <Label className={labelClass}>Provider</Label>
                <Select value={config.provider} onValueChange={handleProviderChange}>
                  <SelectTrigger className={inputClass}>
                    <SelectValue placeholder="Select provider" />
                  </SelectTrigger>
                  <SelectContent className={selectContentClass}>
                    {PROVIDER_OPTIONS.map(opt => (
                      <SelectItem key={opt.value} value={opt.value} className={selectItemClass}>
                        <div className="flex flex-col">
                          <span>{opt.label}</span>
                          <span className={cn("text-xs", subtleTextClass)}>{opt.description}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Model selector */}
              <div className="space-y-2">
                <Label className={labelClass}>Model</Label>
                {models.length > 0 ? (
                  <Select value={config.model} onValueChange={handleModelChange}>
                    <SelectTrigger className={inputClass}>
                      <SelectValue placeholder="Select model" />
                    </SelectTrigger>
                    <SelectContent className={selectContentClass}>
                      {models.map(m => (
                        <SelectItem key={m.value} value={m.value} className={selectItemClass}>
                          {m.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    value={customModelInput}
                    onChange={e => setCustomModelInput(e.target.value)}
                    onBlur={() => {
                      if (customModelInput.trim() && customModelInput !== config.model) {
                        updateConfig({ model: customModelInput.trim() });
                      }
                    }}
                    placeholder="e.g. gpt-4o-mini or custom-model-id"
                    className={cn(inputClass, "placeholder:text-gray-400 dark:placeholder:text-gray-500")}
                  />
                )}
              </div>

              {/* Custom endpoint (custom/Azure only) */}
              {config.provider === 'custom' && (
                <div className="space-y-2">
                  <Label className={labelClass}>Custom Endpoint</Label>
                  <Input
                    value={config.endpoint || ''}
                    onChange={e => updateConfig({ endpoint: e.target.value })}
                    placeholder="https://your-deployment.openai.azure.com/v1"
                    className={cn(inputClass, "placeholder:text-gray-400 dark:placeholder:text-gray-500 font-mono text-sm")}
                  />
                </div>
              )}

              <Separator className={separatorClass} />

              {/* API Key management */}
              <div className="space-y-3">
                <Label className={cn("flex items-center gap-2 text-sm", isDark ? "text-gray-300" : "text-gray-700")}>
                  <Key className="h-4 w-4" />
                  API Key
                  {activeProviderHasKey && (
                    <Badge variant="outline" className={cn(
                      "text-xs ml-1",
                      isDark ? "bg-green-500/10 text-green-400 border-green-500/30" : "bg-green-50 text-green-700 border-green-200"
                    )}>
                      <Shield className="h-3 w-3 mr-1" />
                      Key stored securely
                    </Badge>
                  )}
                </Label>

                {activeProviderHasKey ? (
                  /* Key exists — show status + remove */
                  <div className="space-y-3">
                    <div className={cn(
                      "p-3 rounded-lg border",
                      isDark ? "bg-green-500/5 border-green-500/20" : "bg-green-50 border-green-200"
                    )}>
                      <p className={cn("text-sm font-mono", isDark ? "text-green-400" : "text-green-700")}>
                        ********...****
                      </p>
                      <p className={cn("text-xs mt-1", subtleTextClass)}>
                        Stored on the server. The key is never sent to the browser.
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        onClick={handleDeleteKey}
                        variant="outline"
                        size="sm"
                        disabled={deletingKey}
                        className={cn(isDark ? "text-red-400 border-red-500/30 hover:bg-red-500/10" : "text-red-600 border-red-200 hover:bg-red-50")}
                      >
                        {deletingKey ? (
                          <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4 mr-1" />
                        )}
                        Remove Key
                      </Button>
                      <Button
                        onClick={handleTestConnection}
                        variant="outline"
                        size="sm"
                        disabled={testing}
                      >
                        {testing ? (
                          <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                        ) : (
                          <CheckCircle className="h-4 w-4 mr-1" />
                        )}
                        Test Connection
                      </Button>
                    </div>
                  </div>
                ) : (
                  /* No key — show input */
                  <div className="space-y-3">
                    <div className="flex gap-2">
                      <Input
                        type="password"
                        value={apiKeyInput}
                        onChange={e => setApiKeyInput(e.target.value)}
                        placeholder={config.provider === 'anthropic' ? 'sk-ant-...' : 'sk-...'}
                        className={cn("flex-1 font-mono text-sm", inputClass, "placeholder:text-gray-400 dark:placeholder:text-gray-500")}
                        onKeyDown={e => {
                          if (e.key === 'Enter') handleSaveKey();
                        }}
                      />
                      <Button
                        onClick={handleSaveKey}
                        disabled={savingKey || !apiKeyInput.trim()}
                        className="bg-purple-600 hover:bg-purple-700 text-white"
                      >
                        {savingKey ? (
                          <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                        ) : (
                          <Key className="h-4 w-4 mr-1" />
                        )}
                        Save Key
                      </Button>
                    </div>
                    <p className={cn("text-xs", subtleTextClass)}>
                      Your key is sent directly to the backend and stored encrypted. It is never persisted in the browser.
                    </p>
                  </div>
                )}
              </div>

              {/* Connection status */}
              {status.error && (
                <div className={cn(
                  "p-3 rounded-lg border",
                  isDark ? "bg-red-500/10 border-red-500/20" : "bg-red-50 border-red-200"
                )}>
                  <p className={cn("text-sm", isDark ? "text-red-400" : "text-red-600")}>{status.error}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* ================================================================
              3. Feature Toggles
              ================================================================ */}
          <Card className={cardClass}>
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Sparkles className={cn("h-4 w-4", isDark ? "text-purple-400" : "text-purple-600")} />
                  AI Features
                </CardTitle>
                <span className={cn("text-xs", subtleTextClass)}>
                  {enabledFeatureCount}/{Object.keys(AI_FEATURE_AREAS).length} enabled
                </span>
              </div>
              <CardDescription className={mutedTextClass}>
                Enable or disable specific AI capabilities
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-1">
              {!featureTogglesEnabled && (
                <div className={cn(
                  "mb-4 p-3 rounded-lg border",
                  isDark ? "bg-amber-500/10 border-amber-500/20" : "bg-amber-50 border-amber-200"
                )}>
                  <p className={cn("text-sm", isDark ? "text-amber-400" : "text-amber-700")}>
                    {!activeProviderHasKey
                      ? 'Store an API key above to enable feature toggles.'
                      : 'Connect to the AI provider to enable feature toggles.'}
                  </p>
                </div>
              )}

              {Object.entries(FEATURE_GROUPS).map(([groupName, featureIds]) => {
                const isExpanded = expandedGroups.has(groupName);
                const groupEnabled = featureIds.filter(id => config.enabledFeatures.has(id)).length;

                return (
                  <div key={groupName} className={cn("border rounded-lg overflow-hidden", innerBorderClass)}>
                    {/* Group header */}
                    <button
                      type="button"
                      onClick={() => toggleGroup(groupName)}
                      className={cn(
                        "w-full flex items-center justify-between px-4 py-2.5 transition-colors",
                        isDark ? "hover:bg-gray-800/50" : "hover:bg-gray-50"
                      )}
                    >
                      <div className="flex items-center gap-2">
                        {isExpanded
                          ? <ChevronDown className={cn("h-4 w-4", subtleTextClass)} />
                          : <ChevronRight className={cn("h-4 w-4", subtleTextClass)} />}
                        <span className={cn("text-sm font-medium", isDark ? "text-gray-300" : "text-gray-700")}>{groupName}</span>
                      </div>
                      <span className={cn("text-xs", subtleTextClass)}>{groupEnabled}/{featureIds.length}</span>
                    </button>

                    {/* Feature rows */}
                    {isExpanded && (
                      <div className={cn("border-t", innerBorderClass)}>
                        {featureIds.map(featureId => {
                          const feature = Object.values(AI_FEATURE_AREAS).find(f => f.id === featureId);
                          if (!feature) return null;

                          return (
                            <div
                              key={featureId}
                              className={cn(
                                "flex items-center justify-between px-4 py-2 pl-10",
                                isDark ? "hover:bg-gray-800/30" : "hover:bg-gray-50"
                              )}
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="text-sm shrink-0">{feature.icon}</span>
                                <div className="min-w-0">
                                  <span className={cn("text-sm block truncate", bodyTextClass)}>{feature.name}</span>
                                  <span className={cn("text-xs block truncate", subtleTextClass)}>{feature.description}</span>
                                </div>
                              </div>
                              <Switch
                                checked={isFeatureEnabled(featureId)}
                                onCheckedChange={(enabled) => toggleFeature(featureId, enabled)}
                                disabled={!featureTogglesEnabled}
                                className="shrink-0 ml-3"
                              />
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {/* ================================================================
              4. Usage & Budget
              ================================================================ */}
          <Card className={cardClass}>
            <CardHeader className="pb-4">
              <CardTitle className="text-base flex items-center gap-2">
                <Activity className={cn("h-4 w-4", isDark ? "text-cyan-400" : "text-cyan-600")} />
                Usage & Budget
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Requests today */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className={mutedTextClass}>Requests today</span>
                  <span className={cn("font-mono", bodyTextClass)}>
                    {config.requestsToday} / {config.maxRequestsPerDay}
                  </span>
                </div>
                <Progress value={requestPct} className="h-2" />
              </div>

              {/* Cost tracking */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className={mutedTextClass}>Estimated cost (session)</span>
                  <span className={cn("font-mono", bodyTextClass)}>
                    ${config.totalCost.toFixed(4)}
                  </span>
                </div>
              </div>

              {/* Total requests */}
              <div className="flex items-center justify-between text-sm">
                <span className={mutedTextClass}>Total requests (all time)</span>
                <span className={cn("font-mono", bodyTextClass)}>{config.requestCount}</span>
              </div>

              <Separator className={separatorClass} />

              {/* Budget tracking toggle */}
              <div className="flex items-center justify-between">
                <div>
                  <Label className={labelClass}>Cost Tracking</Label>
                  <p className={cn("text-xs", subtleTextClass)}>Track estimated token costs</p>
                </div>
                <Switch
                  checked={config.costTracking}
                  onCheckedChange={(costTracking) => updateConfig({ costTracking })}
                />
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};
