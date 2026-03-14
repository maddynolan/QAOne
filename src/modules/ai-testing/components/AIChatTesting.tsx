/**
 * AIChatTesting - The Magic Input Box
 * 
 * The simplest AI testing interface ever built.
 * User describes what to test in plain English, AI does everything.
 * 
 * @version 1.0.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useAI } from '@/contexts/AIContext';
import {
  Play,
  Square,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  AlertCircle,
  Loader2,
  Download,
  MessageSquare,
  Eye,
  Sparkles,
  Zap,
  RefreshCw,
  Settings,
  Save,
} from 'lucide-react';

// Types
interface TestStep {
  action: string;
  target: string;
  value?: string;
  success: boolean;
  error?: string;
  screenshot?: string;
  method?: string;       // How element was found (label, role, text, vision_ai, etc.)
  healed?: boolean;      // Was this step healed by AI?
  description?: string;  // Human-readable step description
}

interface TestResult {
  id: string;
  name: string;
  description: string;
  status: 'passed' | 'failed' | 'warning' | 'running';
  steps: TestStep[];
  duration: number;
  screenshot?: string;
}

interface AIEvent {
  type: 'phase' | 'step' | 'screenshot' | 'test_complete' | 'complete' | 'error' | 'intent' | 'plan';
  phase?: string;
  message?: string;
  screenshot?: string;
  result?: TestResult;
  data?: any;
  tests?: number;
  error?: string;
}

// API Base URL - centralized config
import { API_BASE_URL } from '@/lib/api-config';

const API_BASE = API_BASE_URL;
console.log('[AIChatTesting] API_BASE =', API_BASE, 'hostname =', window.location.hostname);

export function AIChatTesting() {
  const { config: aiConfig } = useAI();
  const aiAvailable = aiConfig.enabled && aiConfig.hasApiKey;
  const [input, setInput] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [currentPhase, setCurrentPhase] = useState('');
  const [currentStep, setCurrentStep] = useState('');
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<TestResult[]>([]);
  const [liveScreenshot, setLiveScreenshot] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedTest, setExpandedTest] = useState<string | null>(null);
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState<{role: 'user' | 'ai', content: string}[]>([]);
  
  const abortControllerRef = useRef<AbortController | null>(null);

  // Example prompts for inspiration
  const examplePrompts = [
    "Test login on https://example.com with valid and invalid credentials",
    "Check if the shopping cart works - add items, remove items, checkout",
    "Verify user registration flow with form validation",
    "Test the search functionality with different queries",
    "Check responsive design on the homepage"
  ];

  const startTesting = async () => {
    if (!input.trim()) return;
    
    setIsRunning(true);
    setResults([]);
    setError(null);
    setProgress(0);
    setCurrentPhase('Starting...');
    setLiveScreenshot(null);
    
    abortControllerRef.current = new AbortController();
    
    try {
      const response = await fetch(`${API_BASE}/api/ai-testing/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instruction: input }),
        signal: abortControllerRef.current.signal
      });
      
      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }
      
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response stream');
      }
      
      const decoder = new TextDecoder();
      let buffer = '';
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        
        // Process complete events (SSE format: data: {...}\n\n)
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const event: AIEvent = JSON.parse(line.slice(6));
              handleEvent(event);
            } catch (e) {
              console.error('Failed to parse event:', line);
            }
          }
        }
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        setError(err.message || 'Testing failed');
        console.error('Testing error:', err);
      }
    } finally {
      setIsRunning(false);
      setCurrentPhase('');
      setCurrentStep('');
    }
  };

  const handleEvent = (event: AIEvent) => {
    switch (event.type) {
      case 'phase':
        setCurrentPhase(event.message || event.phase || '');
        // Update progress based on phase
        const phases = ['understanding', 'preparing', 'exploring', 'planning', 'executing', 'complete'];
        const phaseIndex = phases.indexOf(event.phase || '');
        if (phaseIndex >= 0) {
          setProgress((phaseIndex / phases.length) * 100);
        }
        break;
        
      case 'step':
        setCurrentStep(event.message || '');
        break;
        
      case 'screenshot':
        if (event.screenshot) {
          setLiveScreenshot(event.screenshot);
        }
        break;
        
      case 'test_complete':
        if (event.result) {
          setResults(prev => [...prev, event.result!]);
        }
        break;
        
      case 'plan':
        if (event.tests) {
          setCurrentStep(`Planning ${event.tests} tests...`);
        }
        break;
        
      case 'complete':
        setProgress(100);
        setCurrentPhase('Complete!');
        break;
        
      case 'error':
        setError(event.error || 'Unknown error');
        break;
    }
  };

  const stopTesting = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setIsRunning(false);
  };

  const [isRerunning, setIsRerunning] = useState<string | null>(null);

  const rerunWithFix = async (test: TestResult) => {
    if (!test || test.status !== 'failed') return;
    
    setIsRerunning(test.id);
    setChatMessages(prev => [...prev, { 
      role: 'user', 
      content: `Re-run "${test.name}" with AI-generated fixes` 
    }]);
    
    try {
      const response = await fetch(`${API_BASE}/api/ai-testing/rerun-with-fix`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          original_instruction: input,
          failed_test: {
            name: test.name,
            steps: test.steps,
            screenshot: test.screenshot
          }
        })
      });
      
      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }
      
      // Stream the new test results
      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response stream');
      
      const decoder = new TextDecoder();
      let buffer = '';
      
      setChatMessages(prev => [...prev, { role: 'ai', content: 'Re-running test with improved selectors...' }]);
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const event: AIEvent = JSON.parse(line.slice(6));
              
              if (event.type === 'step') {
                setCurrentStep(event.message || '');
              } else if (event.type === 'test_complete' && event.result) {
                // Replace the failed test with the new result
                setResults(prev => prev.map(r => 
                  r.id === test.id ? { ...event.result!, id: test.id } : r
                ));
                
                const status = event.result.status === 'passed' ? '✅ PASSED' : '❌ FAILED';
                setChatMessages(prev => [...prev, { 
                  role: 'ai', 
                  content: `Re-run complete: ${status}\n\n${event.result.status === 'passed' 
                    ? 'The AI fix worked! The test now passes.' 
                    : `Still failing. The AI tried alternative selectors but the element couldn't be found. This may require manual investigation.`}`
                }]);
              } else if (event.type === 'fix_applied') {
                setChatMessages(prev => [...prev, { 
                  role: 'ai', 
                  content: `🔧 Applied fix: ${event.message}` 
                }]);
              }
            } catch (e) {
              console.error('Failed to parse event:', line);
            }
          }
        }
      }
    } catch (err: any) {
      setChatMessages(prev => [...prev, { 
        role: 'ai', 
        content: `Failed to re-run: ${err.message}. Try running a new test with more specific selectors.` 
      }]);
    } finally {
      setIsRerunning(null);
      setCurrentStep('');
    }
  };

  const askAboutFailure = async (test: TestResult) => {
    if (!test || test.status !== 'failed') return;
    
    const failedStep = test.steps.find(s => !s.success);
    const question = `Why did the test "${test.name}" fail at step "${failedStep?.action} ${failedStep?.target}"?`;
    
    setChatMessages(prev => [...prev, { role: 'user', content: question }]);
    
    try {
      // Call AI to analyze the failure
      const response = await fetch(`${API_BASE}/api/ai-testing/explain`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          test_name: test.name,
          failed_step: failedStep,
          all_steps: test.steps,
          screenshot: test.screenshot
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        setChatMessages(prev => [...prev, { 
          role: 'ai', 
          content: `**Why it failed:** ${data.explanation}

**Possible causes:**
${data.possible_causes?.map((c: string, i: number) => `${i+1}. ${c}`).join('\n') || '- Unknown'}

**Suggested fixes:**
${data.suggested_fixes?.map((f: string, i: number) => `${i+1}. ${f}`).join('\n') || '- Try different selectors'}

Would you like me to re-run with these fixes applied?`
        }]);
      } else {
        throw new Error('Failed to get explanation');
      }
    } catch (err) {
      // Fallback to generic failure analysis
      const errorMsg = failedStep?.error || 'Element not found';
      let suggestions = '';

      if (errorMsg.toLowerCase().includes('not found') || errorMsg.toLowerCase().includes('no match')) {
        suggestions = `Possible causes:
1. The element selector does not match the actual DOM structure
2. The element has not loaded yet (timing issue)
3. The page structure changed since the test was designed
4. The element is inside an iframe or shadow DOM

Suggested fixes:
1. Try more generic selectors (getByRole, getByText, getByLabel)
2. Add explicit waits for element visibility
3. Check if the element is in an iframe
4. Use data-testid attributes if available`;
      } else if (errorMsg.toLowerCase().includes('timeout')) {
        suggestions = `Possible causes:
1. The page is loading slowly
2. A network request is blocking rendering
3. JavaScript has not finished executing
4. The element is hidden or conditionally rendered

Suggested fixes:
1. Increase the timeout duration
2. Wait for network idle state before interacting
3. Check element visibility before clicking
4. Add retry logic with exponential backoff`;
      } else if (errorMsg.toLowerCase().includes('denied') || errorMsg.toLowerCase().includes('blocked')) {
        suggestions = `Possible causes:
1. Security challenge (CAPTCHA, bot detection) was triggered
2. IP address is blocked or rate-limited
3. Authentication session expired
4. The application blocks automated browser access

Suggested fixes:
1. Use a stealth browser configuration
2. Whitelist your IP in the application settings
3. Use API-based authentication before UI testing
4. Add delays between actions to avoid rate limiting`;
      } else {
        suggestions = `Possible causes:
1. The selector may have changed
2. The page may not have loaded completely
3. The element may be dynamically rendered
4. There may be a timing or state issue

Suggested fixes:
1. Update the selector to match the current DOM
2. Add waits for element visibility
3. Check if the element is in an iframe
4. Try using text-based or role-based selectors`;
      }

      setChatMessages(prev => [...prev, {
        role: 'ai',
        content: `The test failed at: **${failedStep?.action} "${failedStep?.target}"**

Error: ${errorMsg}

${suggestions}

Would you like me to re-run this test with AI-generated fixes?`
      }]);
    }
  };

  const downloadReport = () => {
    const report = {
      timestamp: new Date().toISOString(),
      instruction: input,
      results: results,
      summary: {
        total: results.length,
        passed: results.filter(r => r.status === 'passed').length,
        failed: results.filter(r => r.status === 'failed').length
      }
    };
    
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ai-test-report-${Date.now()}.json`;
    a.click();
  };

  const [savingTestCase, setSavingTestCase] = useState<string | null>(null);

  const saveAsTestCase = async (test: TestResult) => {
    setSavingTestCase(test.id);
    try {
      const testCase = {
        title: test.name,
        description: test.description || `AI-generated test: ${input}`,
        steps: test.steps.map((s, i) => ({
          step_number: i + 1,
          action: s.action,
          expected_result: s.success ? 'Pass' : `Fail: ${s.error || 'Unknown'}`,
          test_data: s.value || '',
          selector: s.target,
        })),
        tags: ['ai-generated', 'flowpilot'],
        priority: 'medium',
        status: 'draft',
      };

      const response = await fetch(`${API_BASE}/test-cases`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(testCase),
      });

      if (response.ok) {
        setChatMessages(prev => [...prev, {
          role: 'ai',
          content: `Saved "${test.name}" as a test case. You can find it in the Test Repository.`,
        }]);
      } else {
        const errData = await response.json().catch(() => ({}));
        setChatMessages(prev => [...prev, {
          role: 'ai',
          content: `Failed to save test case: ${errData.detail || response.statusText}`,
        }]);
      }
    } catch (err: any) {
      setChatMessages(prev => [...prev, {
        role: 'ai',
        content: `Failed to save: ${err.message || 'Network error'}`,
      }]);
    } finally {
      setSavingTestCase(null);
    }
  };

  const passedCount = results.filter(r => r.status === 'passed').length;
  const failedCount = results.filter(r => r.status === 'failed').length;

  return (
    <div className="space-y-6">
      {/* The Magic Input */}
      <Card className="border-2 border-primary/20 shadow-lg">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-2xl">
            <Sparkles className="w-6 h-6 text-primary" />
            What would you like to test?
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!aiAvailable && (
            <div className="mb-4 p-4 rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-500/30 dark:bg-amber-500/10">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-amber-700 dark:text-amber-300">
                    AI is not configured
                  </p>
                  <p className="text-sm text-amber-600/80 dark:text-amber-400/80 mt-1">
                    AI Chat Testing requires an AI provider and API key to function.
                  </p>
                  <a
                    href="/settings?tab=ai"
                    className="inline-flex items-center gap-1 mt-2 text-sm font-medium text-amber-700 dark:text-amber-300 hover:underline"
                  >
                    <Settings className="w-3.5 h-3.5" />
                    Configure AI in Settings
                  </a>
                </div>
              </div>
            </div>
          )}
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={!aiAvailable
              ? "AI must be configured before you can start testing..."
              : "Describe what you want to test in plain English...\n\nExamples:\n\u2022 Test login on https://myapp.com with valid and invalid credentials\n\u2022 Check if the shopping cart works properly\n\u2022 Verify that users can complete the checkout process\n\u2022 Test the search functionality with different queries"
            }
            rows={5}
            className="text-lg mb-4 resize-none"
            disabled={isRunning || !aiAvailable}
          />

          {/* Quick Examples */}
          {!isRunning && !input && aiAvailable && (
            <div className="mb-4">
              <p className="text-sm text-muted-foreground mb-2">Try an example:</p>
              <div className="flex flex-wrap gap-2">
                {examplePrompts.slice(0, 3).map((prompt, i) => (
                  <Button
                    key={i}
                    variant="outline"
                    size="sm"
                    onClick={() => setInput(prompt)}
                    className="text-xs"
                  >
                    {prompt.substring(0, 40)}...
                  </Button>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-3">
            {!isRunning ? (
              <Button
                onClick={startTesting}
                disabled={!input.trim() || !aiAvailable}
                size="lg"
                className="flex-1 h-12 text-lg"
                title={!aiAvailable ? "Configure AI in Settings to enable testing" : undefined}
              >
                <Zap className="w-5 h-5 mr-2" />
                Start AI Testing
              </Button>
            ) : (
              <Button
                onClick={stopTesting}
                variant="destructive"
                size="lg"
                className="flex-1 h-12 text-lg"
              >
                <Square className="w-5 h-5 mr-2" />
                Stop Testing
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Progress & Live View */}
      {isRunning && (
        <Card className="border-primary/30">
          <CardContent className="pt-6">
            {/* Progress Bar */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {currentPhase}
                </span>
                <span className="text-sm text-muted-foreground">{Math.round(progress)}%</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
            
            {/* Current Step */}
            {currentStep && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                {currentStep}
              </div>
            )}
            
            {/* Live Screenshot */}
            {liveScreenshot && (
              <div className="rounded-lg overflow-hidden border shadow-inner">
                <div className="bg-muted px-3 py-1 text-xs flex items-center gap-2">
                  <Eye className="w-3 h-3" />
                  Live View
                </div>
                <img 
                  src={`data:image/png;base64,${liveScreenshot}`}
                  alt="Live test view"
                  className="w-full"
                />
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Error Display */}
      {error && (
        <Card className="border-destructive bg-destructive/5">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3 text-destructive">
              <XCircle className="w-5 h-5" />
              <span className="font-medium">{error}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Results */}
      {results.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                Test Results
                <Badge variant={failedCount > 0 ? 'destructive' : 'default'}>
                  {passedCount} passed, {failedCount} failed
                </Badge>
              </CardTitle>
              <Button variant="outline" size="sm" onClick={downloadReport}>
                <Download className="w-4 h-4 mr-2" />
                Download Report
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {results.map((result) => (
                <div 
                  key={result.id}
                  className={`border rounded-lg p-4 cursor-pointer transition-colors ${
                    result.status === 'passed' 
                      ? 'border-green-200 bg-green-50/50 hover:bg-green-50' 
                      : result.status === 'failed'
                      ? 'border-red-200 bg-red-50/50 hover:bg-red-50'
                      : 'border-yellow-200 bg-yellow-50/50 hover:bg-yellow-50'
                  }`}
                  onClick={() => setExpandedTest(expandedTest === result.id ? null : result.id)}
                >
                  {/* Test Header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {result.status === 'passed' ? (
                        <CheckCircle2 className="w-5 h-5 text-green-600" />
                      ) : result.status === 'failed' ? (
                        <XCircle className="w-5 h-5 text-red-600" />
                      ) : (
                        <AlertTriangle className="w-5 h-5 text-yellow-600" />
                      )}
                      <div>
                        <p className="font-medium">{result.name}</p>
                        <p className="text-sm text-muted-foreground">{result.description}</p>
                      </div>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {result.duration.toFixed(1)}s
                    </div>
                  </div>
                  
                  {/* Expanded View */}
                  {expandedTest === result.id && (
                    <div className="mt-4 pt-4 border-t">
                      {/* Steps */}
                      <div className="space-y-2 mb-4">
                        {result.steps.map((step, i) => (
                          <div 
                            key={i}
                            className={`flex items-start gap-2 text-sm p-2 rounded ${
                              step.success 
                                ? step.healed ? 'bg-yellow-100/50 border-l-2 border-yellow-500' : 'bg-green-100/50' 
                                : step.error?.includes('Skipped') ? 'bg-gray-100/50' : 'bg-red-100/50'
                            }`}
                          >
                            {step.success ? (
                              step.healed ? (
                                <Sparkles className="w-4 h-4 text-yellow-600 flex-shrink-0 mt-0.5" />
                              ) : (
                                <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                              )
                            ) : (
                              step.error?.includes('Skipped') ? (
                                <AlertTriangle className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
                              ) : (
                                <XCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                              )
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-medium">
                                  {step.description || `${step.action} "${step.target}"`}
                                </span>
                                {step.method && step.method !== 'failed' && step.method !== 'simulation' && (
                                  <Badge variant="outline" className="text-xs px-1.5 py-0">
                                    {step.method.replace('app_specific_', '').replace('_', ' ')}
                                  </Badge>
                                )}
                                {step.healed && (
                                  <Badge className="text-xs px-1.5 py-0 bg-yellow-500">
                                    AI Healed
                                  </Badge>
                                )}
                              </div>
                              {step.value && !step.value.includes('****') && step.action === 'fill' && (
                                <span className="text-xs text-muted-foreground">
                                  Value: "{step.value}"
                                </span>
                              )}
                              {step.error && !step.error.includes('Skipped') && (
                                <div className="text-red-600 text-xs mt-1">
                                  {step.error}
                                </div>
                              )}
                              {step.error?.includes('Skipped') && (
                                <span className="text-gray-400 text-xs">Skipped - previous step failed</span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                      
                      {/* Screenshot */}
                      {result.screenshot && (
                        <div className="rounded-lg overflow-hidden border mb-4">
                          <img 
                            src={`data:image/png;base64,${result.screenshot}`}
                            alt={`Screenshot for ${result.name}`}
                            className="w-full"
                          />
                        </div>
                      )}
                      
                      {/* Test Actions */}
                      <div className="flex gap-2 flex-wrap">
                        {/* Save as Test Case — available for all tests */}
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={savingTestCase === result.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            saveAsTestCase(result);
                          }}
                        >
                          {savingTestCase === result.id ? (
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          ) : (
                            <Save className="w-4 h-4 mr-2" />
                          )}
                          {savingTestCase === result.id ? 'Saving...' : 'Save as Test Case'}
                        </Button>

                        {/* Failure-specific actions */}
                        {result.status === 'failed' && (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                askAboutFailure(result);
                              }}
                            >
                              <MessageSquare className="w-4 h-4 mr-2" />
                              Why did this fail?
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={isRerunning === result.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                rerunWithFix(result);
                              }}
                            >
                              {isRerunning === result.id ? (
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              ) : (
                                <RefreshCw className="w-4 h-4 mr-2" />
                              )}
                              {isRerunning === result.id ? 'Re-running...' : 'Re-run with AI fix'}
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Chat Panel for Debugging */}
      {chatMessages.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <MessageSquare className="w-5 h-5" />
              AI Assistant
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4 mb-4">
              {chatMessages.map((msg, i) => (
                <div 
                  key={i}
                  className={`p-3 rounded-lg ${
                    msg.role === 'user' 
                      ? 'bg-primary/10 ml-8' 
                      : 'bg-muted mr-8'
                  }`}
                >
                  <p className="text-sm font-medium mb-1">
                    {msg.role === 'user' ? 'You' : 'AI'}
                  </p>
                  <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                </div>
              ))}
            </div>
            
            <div className="flex gap-2">
              <Textarea
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Ask about the test results..."
                rows={2}
                className="flex-1"
              />
              <Button
                onClick={async () => {
                  if (!chatInput.trim()) return;
                  const userMsg = chatInput.trim();
                  setChatMessages(prev => [...prev, { role: 'user', content: userMsg }]);
                  setChatInput('');
                  try {
                    const context = results.length > 0
                      ? `Test results: ${results.map(r => `${r.name}: ${r.status} (${r.steps.length} steps)`).join('; ')}`
                      : 'No test results yet.';
                    const res = await fetch(`${API_BASE}/api/ai-testing/explain`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ question: userMsg, context }),
                    });
                    if (res.ok) {
                      const data = await res.json();
                      setChatMessages(prev => [...prev, { role: 'ai', content: data.explanation || data.answer || 'No response from AI.' }]);
                    } else {
                      setChatMessages(prev => [...prev, { role: 'ai', content: 'Sorry, AI analysis is not available right now. Please check your backend connection.' }]);
                    }
                  } catch {
                    setChatMessages(prev => [...prev, { role: 'ai', content: 'Failed to reach AI service. Make sure the backend is running.' }]);
                  }
                }}
              >
                Send
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default AIChatTesting;
