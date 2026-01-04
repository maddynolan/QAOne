/**
 * AI Service Configuration Component
 * Uses AIContext for global state management
 * Allows users to enable/disable AI and set API key
 */

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Sparkles, Settings, CheckCircle, AlertCircle, Eye, EyeOff, Loader2, Zap } from 'lucide-react';
import { useAI, AI_FEATURE_AREAS, type AIFeatureId } from '@/contexts/AIContext';
import { toast } from 'sonner';

interface AIConfigProps {
  onConfigChange?: (config: any) => void;
}

export const AIConfiguration = ({ onConfigChange }: AIConfigProps) => {
  const { config, status, updateConfig, toggleFeature, isFeatureEnabled, testConnection } = useAI();
  const [showApiKey, setShowApiKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState(config.apiKey);

  const handleTestConnection = async () => {
    setTesting(true);
    try {
      const success = await testConnection();
      if (success) {
        toast.success('✅ AI Service Connected!');
      } else {
        toast.error('❌ Connection failed - check API key');
      }
    } catch (error) {
      toast.error('Connection test failed');
    } finally {
      setTesting(false);
    }
  };

  const handleSaveApiKey = () => {
    updateConfig({ apiKey: apiKeyInput });
    // Also save to backend for server-side calls
    saveApiKeyToBackend(apiKeyInput);
    toast.success('API key saved!');
  };

  const saveApiKeyToBackend = async (apiKey: string) => {
    try {
      await fetch('http://localhost:8000/api/ai/vision/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: apiKey,
          model: config.model,
          provider: config.provider
        })
      });
    } catch (error) {
      console.error('Failed to save API key to backend:', error);
    }
  };

  const featureGroups = {
    'Test Generation': ['test_case_generation', 'test_step_suggestions', 'gherkin_generation'],
    'Self-Healing & Locators': ['self_healing', 'smart_locators'],
    'API & Performance': ['api_test_generation', 'api_mock_generation', 'perf_analysis', 'load_pattern_suggestions'],
    'Visual & Accessibility': ['visual_analysis', 'a11y_suggestions'],
    'Defects & Code': ['defect_analysis', 'defect_triage', 'code_generation', 'code_optimization'],
    'Smart Assistants': ['chat_assistant', 'smart_fill', 'requirement_analysis']
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-purple-500" />
              AI Configuration
            </CardTitle>
            <CardDescription>
              Enable AI-powered features across the platform (GPT-4o-mini)
            </CardDescription>
          </div>
          <Badge 
            variant={config.enabled ? (status.connected ? 'default' : 'secondary') : 'outline'}
            className={`flex items-center gap-1 ${config.enabled && status.connected ? 'bg-green-500/20 text-green-400 border-green-500/30' : ''}`}
          >
            {config.enabled && status.connected && <CheckCircle className="h-3 w-3" />}
            {config.enabled && !status.connected && <AlertCircle className="h-3 w-3" />}
            {!config.enabled && <Settings className="h-3 w-3" />}
            {config.enabled ? (status.connected ? 'Connected' : 'Disconnected') : 'Disabled'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Master Toggle */}
        <div className="flex items-center justify-between p-4 bg-gradient-to-r from-purple-500/10 to-blue-500/10 rounded-lg border border-purple-500/20">
          <div className="space-y-0.5">
            <Label htmlFor="ai-enabled" className="text-base font-semibold flex items-center gap-2">
              <Zap className="h-4 w-4 text-yellow-500" />
              Enable AI Features
            </Label>
            <p className="text-sm text-muted-foreground">
              When enabled, AI buttons appear throughout the app
            </p>
          </div>
          <Switch
            id="ai-enabled"
            checked={config.enabled}
            onCheckedChange={(enabled) => updateConfig({ enabled })}
          />
        </div>

        {config.enabled && (
          <>
            <Separator />
            
            {/* API Key Input */}
            <div className="space-y-3">
              <Label>OpenAI API Key</Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input
                    type={showApiKey ? 'text' : 'password'}
                    placeholder="sk-..."
                    value={apiKeyInput}
                    onChange={(e) => setApiKeyInput(e.target.value)}
                  />
                  <button
                    type="button"
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    onClick={() => setShowApiKey(!showApiKey)}
                  >
                    {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <Button onClick={handleSaveApiKey} variant="outline">
                  Save
                </Button>
                <Button onClick={handleTestConnection} variant="outline" disabled={testing || !apiKeyInput}>
                  {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Model: <span className="font-mono">{config.model}</span> • 
                {status.latency && ` Latency: ${status.latency}ms`}
                {config.costTracking && ` • Requests: ${config.requestCount}`}
              </p>
            </div>

            <Separator />

            {/* Feature Toggles */}
            <div className="space-y-4">
              <Label className="text-base">AI Features</Label>
              <p className="text-sm text-muted-foreground -mt-2">
                Enable/disable specific AI capabilities
              </p>
              
              <div className="grid gap-4">
                {Object.entries(featureGroups).map(([groupName, featureIds]) => (
                  <div key={groupName} className="space-y-2">
                    <Label className="text-sm font-medium text-muted-foreground">{groupName}</Label>
                    <div className="grid gap-2 pl-2">
                      {featureIds.map(featureId => {
                        const feature = Object.values(AI_FEATURE_AREAS).find(f => f.id === featureId);
                        if (!feature) return null;
                        
                        return (
                          <div key={featureId} className="flex items-center justify-between py-1">
                            <div className="flex items-center gap-2">
                              <span>{feature.icon}</span>
                              <span className="text-sm">{feature.name}</span>
                            </div>
                            <Switch
                              checked={isFeatureEnabled(featureId as AIFeatureId)}
                              onCheckedChange={(enabled) => toggleFeature(featureId as AIFeatureId, enabled)}
                              disabled={!status.connected}
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <Separator />

            {/* Status Summary */}
            <div className="bg-muted/50 p-4 rounded-lg">
              <h4 className="font-semibold mb-2 flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-purple-500" />
                AI Status
              </h4>
              <div className="text-sm space-y-1 text-muted-foreground">
                {status.connected ? (
                  <>
                    <p>✅ Connected to OpenAI ({config.model})</p>
                    <p>🔌 {config.enabledFeatures.size} features enabled</p>
                    <p>⚡ Ready for AI-assisted testing</p>
                  </>
                ) : (
                  <>
                    <p>⏳ Not connected - add API key above</p>
                    <p>💡 AI features will appear once connected</p>
                  </>
                )}
              </div>
            </div>
          </>
        )}

        {!config.enabled && (
          <div className="bg-muted/30 p-4 rounded-lg text-center">
            <p className="text-muted-foreground">
              Enable AI to unlock smart test generation, self-healing, and more
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
