// AI Service Configuration Component
// This allows easy switching between mock and real AI services

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Sparkles, Settings, CheckCircle, AlertCircle } from 'lucide-react';

interface AIConfigProps {
  onConfigChange?: (config: any) => void;
}

export const AIConfiguration = ({ onConfigChange }: AIConfigProps) => {
  const [useMockAI, setUseMockAI] = useState(true);
  const [mockDelay, setMockDelay] = useState(2000);
  const [successRate, setSuccessRate] = useState(0.95);
  const [aiStatus, setAIStatus] = useState<'mock' | 'real' | 'error'>('mock');

  useEffect(() => {
    // Check if we have a real AI API key configured
    const hasAPIKey = import.meta.env.VITE_LLM_API_KEY && 
                     import.meta.env.VITE_LLM_API_KEY !== '' &&
                     import.meta.env.VITE_LLM_API_KEY !== 'your-custom-llm-api-key';
    
    setUseMockAI(!hasAPIKey);
    setAIStatus(hasAPIKey ? 'real' : 'mock');
  }, []);

  const handleMockToggle = (enabled: boolean) => {
    setUseMockAI(enabled);
    setAIStatus(enabled ? 'mock' : 'real');
    
    if (onConfigChange) {
      onConfigChange({
        useMock: enabled,
        delay: mockDelay,
        successRate: successRate
      });
    }
  };

  const testAIConnection = async () => {
    try {
      // Test the AI service
      const { customLLMService } = await import('@/lib/custom-llm-service');
      
      const testRequest = {
        feature: 'Test Feature',
        description: 'This is a test to verify AI service connectivity',
        testType: 'api' as const,
        complexity: 'simple' as const
      };

      const response = await customLLMService.generateTestCase(testRequest);
      
      if (response && response.testCase) {
        setAIStatus('real');
        alert('✅ AI Service is working correctly!');
      } else {
        setAIStatus('error');
        alert('❌ AI Service returned invalid response');
      }
    } catch (error) {
      setAIStatus('error');
      alert(`❌ AI Service test failed: ${error}`);
    }
  };

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              AI Service Configuration
            </CardTitle>
            <CardDescription>
              Configure AI service for test generation and defect analysis
            </CardDescription>
          </div>
          <Badge 
            variant={aiStatus === 'mock' ? 'secondary' : aiStatus === 'real' ? 'default' : 'destructive'}
            className="flex items-center gap-1"
          >
            {aiStatus === 'mock' && <Sparkles className="h-3 w-3" />}
            {aiStatus === 'real' && <CheckCircle className="h-3 w-3" />}
            {aiStatus === 'error' && <AlertCircle className="h-3 w-3" />}
            {aiStatus === 'mock' ? 'Mock AI' : aiStatus === 'real' ? 'Real AI' : 'Error'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="mock-ai">Use Mock AI Service</Label>
              <p className="text-sm text-muted-foreground">
                Enable mock AI for development and testing
              </p>
            </div>
            <Switch
              id="mock-ai"
              checked={useMockAI}
              onCheckedChange={handleMockToggle}
            />
          </div>

          {useMockAI && (
            <div className="space-y-4 pl-6 border-l-2 border-muted">
              <div className="space-y-2">
                <Label htmlFor="mock-delay">Simulated Delay (ms)</Label>
                <input
                  id="mock-delay"
                  type="range"
                  min="500"
                  max="5000"
                  step="500"
                  value={mockDelay}
                  onChange={(e) => setMockDelay(Number(e.target.value))}
                  className="w-full"
                />
                <p className="text-sm text-muted-foreground">{mockDelay}ms</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="success-rate">Success Rate</Label>
                <input
                  id="success-rate"
                  type="range"
                  min="0.5"
                  max="1"
                  step="0.05"
                  value={successRate}
                  onChange={(e) => setSuccessRate(Number(e.target.value))}
                  className="w-full"
                />
                <p className="text-sm text-muted-foreground">{(successRate * 100).toFixed(0)}%</p>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label>Real AI Service Configuration</Label>
            <div className="text-sm text-muted-foreground space-y-1">
              <p>Endpoint: {import.meta.env.VITE_LLM_ENDPOINT || 'Not configured'}</p>
              <p>Model: {import.meta.env.VITE_LLM_MODEL || 'Not configured'}</p>
              <p>API Key: {import.meta.env.VITE_LLM_API_KEY ? '***configured***' : 'Not configured'}</p>
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          <Button onClick={testAIConnection} variant="outline">
            <CheckCircle className="h-4 w-4 mr-2" />
            Test AI Connection
          </Button>
          <Button 
            onClick={() => window.open('/docs', '_blank')} 
            variant="outline"
          >
            <Settings className="h-4 w-4 mr-2" />
            View API Docs
          </Button>
        </div>

        <div className="bg-muted p-4 rounded-lg">
          <h4 className="font-semibold mb-2">Current Status:</h4>
          <div className="text-sm space-y-1">
            {useMockAI ? (
              <>
                <p>✅ Using Mock AI Service for development</p>
                <p>📝 Generate realistic test cases and defect analysis</p>
                <p>⚡ Simulated delay: {mockDelay}ms</p>
                <p>🎯 Success rate: {(successRate * 100).toFixed(0)}%</p>
              </>
            ) : (
              <>
                <p>🔗 Using Real AI Service</p>
                <p>🤖 Connected to custom LLM endpoint</p>
                <p>⚡ Real-time AI responses</p>
                <p>🎯 Production-ready AI features</p>
              </>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};


