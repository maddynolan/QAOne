/**
 * GeneratorTab — Momentic-style split-pane: prompt left, browser right.
 * Integrates Self-Healer as "Re-run with Fix" button on failed tests.
 */
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { API_BASE_URL } from '@/lib/api-config';
import {
  Play,
  Square,
  FileText,
  History,
  ChevronDown,
  ChevronUp,
  Clock,
  Trash2,
  AlertCircle,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';
import { LiveBrowserView } from '../../components/LiveBrowserView';
import { ExecutionProgress } from './ExecutionProgress';
import { TestResultCard } from './TestResultCard';
import { TestStepList } from './TestStepList';
import { FlowpilotSettingsPopover } from './FlowpilotSettings';
import type { TestResult, FlowpilotSettings, HistoryEntry, SSEEvent } from './types';
import { loadSettings, saveSettings, loadHistory, saveHistory, MAX_HISTORY_ENTRIES, DEFAULT_SETTINGS } from './types';

interface GeneratorTabProps {
  aiAvailable: boolean;
  theme: string;
}

export function GeneratorTab({ aiAvailable, theme }: GeneratorTabProps) {
  // Input state
  const [goal, setGoal] = useState('');
  const [targetUrl, setTargetUrl] = useState('');
  const [testFormat, setTestFormat] = useState<'natural' | 'gherkin' | 'steps'>('natural');

  // Execution state
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentPhase, setCurrentPhase] = useState('');
  const [currentStep, setCurrentStep] = useState('');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Results
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [liveScreenshot, setLiveScreenshot] = useState<string | null>(null);
  const [streamSessionId, setStreamSessionId] = useState<string | null>(null);
  const [expandedTest, setExpandedTest] = useState<string | null>(null);

  // Settings & history
  const [settings, setSettings] = useState<FlowpilotSettings>(loadSettings);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>(loadHistory);
  const [historyExpanded, setHistoryExpanded] = useState(false);

  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => { saveSettings(settings); }, [settings]);

  // ---- SSE Stream Reader ----

  const handleSSEEvent = useCallback((event: SSEEvent) => {
    switch (event.type) {
      case 'phase': {
        const msg = event.message || event.phase || '';
        setCurrentPhase(msg);
        const phases = ['understanding', 'preparing', 'exploring', 'planning', 'executing', 'complete'];
        const idx = phases.indexOf(event.phase || '');
        if (idx >= 0) setProgress(Math.round((idx / (phases.length - 1)) * 100));
        break;
      }
      case 'intent':
        if (event.data) setCurrentStep(`Detected: ${event.data.url || 'app'} -- ${event.data.actions || 0} actions planned`);
        break;
      case 'step':
        setCurrentStep(event.message || '');
        break;
      case 'screenshot':
        if (event.screenshot) setLiveScreenshot(event.screenshot);
        break;
      case 'test_complete':
        if (event.result) setTestResults(prev => [...prev, event.result!]);
        break;
      case 'plan':
        if (event.tests) setCurrentStep(`Planning ${event.tests} test(s)...`);
        break;
      case 'stream_session':
        if (event.session_id) setStreamSessionId(event.session_id);
        break;
      case 'complete':
        setProgress(100);
        setCurrentPhase('Complete');
        setStreamSessionId(null);
        break;
      case 'error':
        setError(event.error || 'Unknown error');
        break;
    }
  }, []);

  const streamSSE = useCallback(async (url: string, body: any) => {
    const controller = new AbortController();
    abortControllerRef.current = controller;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(`Server error ${response.status}: ${text}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response stream');

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const event: SSEEvent = JSON.parse(line.slice(6));
            handleSSEEvent(event);
          } catch (e) {
            console.error('[Generator] Failed to parse SSE event:', line);
          }
        }
      }
    }
  }, [handleSSEEvent]);

  // ---- Execute ----

  const executeGenerator = useCallback(async (rerunTest?: TestResult) => {
    const instruction = goal + (targetUrl.trim() ? ` on ${targetUrl}` : '');
    if (!instruction.trim() && !rerunTest) return;

    setIsProcessing(true);
    setError(null);
    setProgress(0);
    setCurrentPhase('Starting...');
    setCurrentStep('');
    setTestResults([]);
    setLiveScreenshot(null);
    setStreamSessionId(null);

    try {
      if (rerunTest) {
        // Self-Healer mode: re-run with fix
        await streamSSE(`${API_BASE_URL}/api/ai-testing/rerun-with-fix`, {
          original_instruction: instruction || rerunTest.name,
          failed_test: {
            name: rerunTest.name,
            steps: rerunTest.steps,
            screenshot: rerunTest.screenshot,
          },
          headless: settings.headless,
        });
      } else {
        await streamSSE(`${API_BASE_URL}/api/ai-testing/start`, {
          instruction,
          format: testFormat,
          headless: settings.headless,
        });
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        setError(err.message || 'Execution failed');
        console.error('[Generator] Error:', err);
      }
    } finally {
      setIsProcessing(false);

      // Save to history
      setTimeout(() => {
        setTestResults((currentResults) => {
          if (currentResults.length > 0) {
            const passed = currentResults.filter(r => r.status === 'passed').length;
            const failed = currentResults.filter(r => r.status === 'failed').length;
            const totalDuration = currentResults.reduce((sum, r) => sum + (r.duration || 0), 0);
            const entry: HistoryEntry = {
              id: `hist_${Date.now()}`,
              timestamp: new Date().toISOString(),
              instruction: instruction || rerunTest?.name || '',
              agentId: rerunTest ? 'self-healer' : 'generator',
              results: currentResults.map(r => ({ ...r, screenshot: undefined })),
              passed, failed,
              total: currentResults.length,
              duration: totalDuration,
            };
            setHistory(prev => {
              const updated = [entry, ...prev].slice(0, MAX_HISTORY_ENTRIES);
              saveHistory(updated);
              return updated;
            });
          }
          return currentResults;
        });
      }, 500);
    }
  }, [goal, targetUrl, testFormat, streamSSE, settings.headless]);

  const handleStop = useCallback(() => {
    if (abortControllerRef.current) abortControllerRef.current.abort();
    setIsProcessing(false);
    setCurrentPhase('Stopped');
  }, []);

  const saveAsTestCase = useCallback(async (test: TestResult) => {
    try {
      const testCase = {
        title: test.name,
        description: test.description || `Generated by Flowpilot: ${goal}`,
        steps: test.steps.map((s, i) => ({
          step_number: i + 1,
          action: s.action,
          expected_result: s.success ? 'Pass' : `Fail: ${s.error || 'Unknown'}`,
          test_data: s.value || '',
          selector: s.selector_used || s.target,
        })),
        tags: ['flowpilot', 'ai-generated'],
        priority: 'medium',
        status: 'draft',
      };
      const response = await fetch(`${API_BASE_URL}/test-cases`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(testCase),
      });
      if (response.ok) {
        setCurrentStep(`Saved "${test.name}" as test case`);
      }
    } catch (err: any) {
      console.error('[Generator] Failed to save test case:', err);
    }
  }, [goal]);

  const canExecute = !isProcessing && aiAvailable && !!goal.trim();

  // ---- Render ----

  return (
    <ResizablePanelGroup direction="horizontal" className="h-full min-h-[600px]">
      {/* Left Pane — Prompt & Controls */}
      <ResizablePanel defaultSize={35} minSize={25} maxSize={50}>
        <div className={cn(
          "h-full flex flex-col overflow-y-auto p-4 space-y-4 border-r",
          theme === 'light' ? "bg-white border-gray-200" : "bg-gray-950 border-gray-800"
        )}>
          {/* Target URL */}
          <div className="space-y-1.5">
            <label className={cn("text-xs font-medium", theme === 'light' ? 'text-gray-600' : 'text-gray-400')}>
              Target URL
            </label>
            <Input
              value={targetUrl}
              onChange={(e) => setTargetUrl(e.target.value)}
              placeholder="https://example.com"
              className={cn("h-9", theme === 'light' ? "bg-gray-50 border-gray-200" : "bg-gray-900 border-gray-800")}
              disabled={isProcessing}
            />
          </div>

          {/* Test Goal */}
          <div className="space-y-1.5 flex-1 flex flex-col">
            <div className="flex items-center justify-between">
              <label className={cn("text-xs font-medium", theme === 'light' ? 'text-gray-600' : 'text-gray-400')}>
                Test Goal <span className="text-red-400">*</span>
              </label>
              <Select value={testFormat} onValueChange={(v: 'natural' | 'gherkin' | 'steps') => setTestFormat(v)}>
                <SelectTrigger className={cn("w-[140px] h-7 text-[11px]", theme === 'light' ? "bg-gray-50 border-gray-200" : "bg-gray-900 border-gray-800")}>
                  <FileText className="w-3 h-3 mr-1" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="natural">Natural Language</SelectItem>
                  <SelectItem value="gherkin">Gherkin (BDD)</SelectItem>
                  <SelectItem value="steps">Step-by-Step</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Textarea
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              placeholder={
                testFormat === 'gherkin'
                  ? "Feature: User Authentication\n  Scenario: Login with valid credentials\n    Given I navigate to the login page\n    When I fill email with \"user@example.com\"\n    And I fill password\n    And I click Login\n    Then I see the Dashboard"
                  : testFormat === 'steps'
                  ? "1. Navigate to the login page\n2. Enter email\n3. Enter password\n4. Click Login\n5. Verify dashboard loads"
                  : "Describe what to test in plain English...\n\nExample: Test login with invalid credentials and verify error message appears"
              }
              rows={10}
              className={cn(
                "flex-1 min-h-[200px] resize-none",
                testFormat === 'gherkin' ? "font-mono text-xs" : "text-sm",
                theme === 'light' ? "bg-gray-50 border-gray-200" : "bg-gray-900 border-gray-800"
              )}
              disabled={isProcessing}
            />
          </div>

          {/* Action Row */}
          <div className="flex items-center gap-2">
            {!isProcessing ? (
              <Button
                onClick={() => executeGenerator()}
                disabled={!canExecute}
                className="flex-1 h-9 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white border-0"
              >
                <Play className="w-4 h-4 mr-2" /> Execute
              </Button>
            ) : (
              <Button
                onClick={handleStop}
                variant="destructive"
                className="flex-1 h-9"
              >
                <Square className="w-4 h-4 mr-2" /> Stop
              </Button>
            )}
            <FlowpilotSettingsPopover
              settings={settings}
              onChange={setSettings}
              open={settingsOpen}
              onOpenChange={setSettingsOpen}
              theme={theme}
            />
          </div>

          {/* AI not available warning */}
          {!aiAvailable && (
            <div className={cn(
              "px-3 py-2 rounded-lg border text-xs flex items-center gap-2",
              theme === 'light' ? "bg-amber-50 border-amber-200 text-amber-700" : "bg-amber-500/10 border-amber-500/30 text-amber-400"
            )}>
              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
              <span>Configure AI in <a href="/settings?tab=ai" className="underline">Settings</a> to enable.</span>
            </div>
          )}

          {/* Progress */}
          {isProcessing && (
            <ExecutionProgress phase={currentPhase} step={currentStep} progress={progress} theme={theme} />
          )}

          {/* Error */}
          {error && (
            <div className={cn(
              "px-3 py-2 rounded-lg border text-xs flex items-center gap-2",
              theme === 'light' ? "bg-red-50 border-red-200 text-red-700" : "bg-red-500/10 border-red-500/30 text-red-400"
            )}>
              <XCircle className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="truncate">{error}</span>
            </div>
          )}

          {/* History */}
          {history.length > 0 && (
            <div className={cn(
              "rounded-lg border",
              theme === 'light' ? "border-gray-200" : "border-gray-800"
            )}>
              <button
                onClick={() => setHistoryExpanded(!historyExpanded)}
                className={cn(
                  "w-full flex items-center justify-between px-3 py-2 text-left",
                  theme === 'light' ? 'hover:bg-gray-50' : 'hover:bg-gray-800/50'
                )}
              >
                <span className={cn("text-xs font-medium flex items-center gap-1.5", theme === 'light' ? 'text-gray-600' : 'text-gray-400')}>
                  <History className="w-3.5 h-3.5" /> History ({history.length})
                </span>
                {historyExpanded ? <ChevronUp className="w-3.5 h-3.5 text-gray-400" /> : <ChevronDown className="w-3.5 h-3.5 text-gray-400" />}
              </button>
              {historyExpanded && (
                <div className={cn(
                  "border-t px-2 py-2 space-y-1 max-h-[200px] overflow-y-auto",
                  theme === 'light' ? 'border-gray-100' : 'border-gray-800'
                )}>
                  {history.slice(0, 10).map((entry) => (
                    <div
                      key={entry.id}
                      className={cn(
                        "flex items-center gap-2 px-2 py-1.5 rounded text-xs cursor-pointer",
                        theme === 'light' ? 'hover:bg-gray-50' : 'hover:bg-gray-800/50'
                      )}
                      onClick={() => {
                        setGoal(entry.instruction.replace(/ on https?:\/\/\S+$/, ''));
                        const urlMatch = entry.instruction.match(/ on (https?:\/\/\S+)$/);
                        if (urlMatch) setTargetUrl(urlMatch[1]);
                      }}
                    >
                      {entry.failed > 0 ? (
                        <XCircle className="w-3 h-3 text-red-400 flex-shrink-0" />
                      ) : (
                        <CheckCircle2 className="w-3 h-3 text-green-400 flex-shrink-0" />
                      )}
                      <span className={cn("flex-1 truncate", theme === 'light' ? 'text-gray-700' : 'text-gray-300')}>
                        {entry.instruction}
                      </span>
                      <span className="text-gray-400 flex-shrink-0 flex items-center gap-1">
                        <Clock className="w-2.5 h-2.5" />
                        {new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  ))}
                  {history.length > 0 && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="w-full h-6 text-[10px] text-red-400"
                      onClick={() => { setHistory([]); saveHistory([]); }}
                    >
                      <Trash2 className="w-2.5 h-2.5 mr-1" /> Clear History
                    </Button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </ResizablePanel>

      <ResizableHandle withHandle />

      {/* Right Pane — Browser + Results */}
      <ResizablePanel defaultSize={65} minSize={40}>
        <div className={cn(
          "h-full flex flex-col overflow-y-auto",
          theme === 'light' ? "bg-gray-50" : "bg-gray-950"
        )}>
          {/* Live Browser View */}
          <div className="flex-shrink-0 p-4 pb-2">
            <LiveBrowserView
              sessionId={streamSessionId || undefined}
              fallbackScreenshot={liveScreenshot || undefined}
              currentStep={currentStep}
              className="rounded-xl border shadow-sm overflow-hidden"
            />
          </div>

          {/* Live Steps (during execution) */}
          {isProcessing && testResults.length === 0 && (
            <div className="px-4 pb-2">
              <div className={cn(
                "rounded-lg border p-3",
                theme === 'light' ? "bg-white border-gray-200" : "bg-gray-900 border-gray-800"
              )}>
                <p className={cn("text-xs font-medium mb-2", theme === 'light' ? 'text-gray-600' : 'text-gray-400')}>
                  Executing...
                </p>
                {currentStep && (
                  <div className={cn("text-xs px-2 py-1 rounded", theme === 'light' ? 'bg-gray-50 text-gray-600' : 'bg-gray-800 text-gray-300')}>
                    {currentStep}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Test Results */}
          {testResults.length > 0 && (
            <div className="px-4 pb-4 space-y-2">
              <div className="flex items-center gap-2 mb-1">
                <h3 className={cn("text-xs font-semibold", theme === 'light' ? 'text-gray-700' : 'text-gray-300')}>
                  Test Results
                </h3>
                <Badge className="text-[10px] border-0 bg-green-500/10 text-green-500">
                  {testResults.filter(t => t.status === 'passed').length} passed
                </Badge>
                {testResults.some(t => t.status === 'failed') && (
                  <Badge className="text-[10px] border-0 bg-red-500/10 text-red-500">
                    {testResults.filter(t => t.status === 'failed').length} failed
                  </Badge>
                )}
              </div>
              {testResults.map((test) => (
                <TestResultCard
                  key={test.id}
                  test={test}
                  expanded={expandedTest === test.id}
                  onToggle={() => setExpandedTest(expandedTest === test.id ? null : test.id)}
                  onSave={saveAsTestCase}
                  onRerunWithFix={(t) => executeGenerator(t)}
                  theme={theme}
                />
              ))}
            </div>
          )}

          {/* Empty state */}
          {!isProcessing && testResults.length === 0 && !error && (
            <div className="flex-1 flex items-center justify-center p-8">
              <div className="text-center space-y-2">
                <div className={cn(
                  "w-16 h-16 rounded-2xl mx-auto flex items-center justify-center",
                  theme === 'light' ? 'bg-amber-50' : 'bg-amber-500/10'
                )}>
                  <Play className="w-7 h-7 text-amber-500" />
                </div>
                <p className={cn("text-sm font-medium", theme === 'light' ? 'text-gray-700' : 'text-gray-300')}>
                  Ready to test
                </p>
                <p className={cn("text-xs max-w-[300px]", theme === 'light' ? 'text-gray-400' : 'text-gray-500')}>
                  Describe your test goal on the left and click Execute. The AI will navigate a real browser and report results here.
                </p>
              </div>
            </div>
          )}
        </div>
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
