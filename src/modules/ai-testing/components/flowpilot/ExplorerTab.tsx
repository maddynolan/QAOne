/**
 * ExplorerTab — Autonomous crawling + defect detection.
 * Full-width layout: URL + config, progress, stats, defect cards, test generation.
 */
import React, { useState, useRef, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { API_BASE_URL } from '@/lib/api-config';
import {
  Play,
  Square,
  Globe,
  Bug,
  Clock,
  Layers,
  AlertCircle,
  Download,
  FlaskConical,
  Save,
} from 'lucide-react';
import { ExecutionProgress } from './ExecutionProgress';
import { DefectCard } from './DefectCard';
import { ExplorerConfigPanel } from './ExplorerConfig';
import type { ExplorerConfig, ExplorationResult, ExplorationDefect, GeneratedTestSuite } from './types';
import { DEFAULT_EXPLORER_CONFIG } from './types';

interface ExplorerTabProps {
  aiAvailable: boolean;
  theme: string;
}

export function ExplorerTab({ aiAvailable, theme }: ExplorerTabProps) {
  const [targetUrl, setTargetUrl] = useState('');
  const [config, setConfig] = useState<ExplorerConfig>({ ...DEFAULT_EXPLORER_CONFIG });
  const [configExpanded, setConfigExpanded] = useState(false);

  // Execution state
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [currentPhase, setCurrentPhase] = useState('');
  const [currentStep, setCurrentStep] = useState('');

  // Results
  const [result, setResult] = useState<ExplorationResult | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);

  const inputCn = cn("h-9", theme === 'light' ? "bg-white border-gray-200" : "bg-gray-800 border-gray-700");

  // ---- Execute Explorer (SSE) ----

  const handleExecute = useCallback(async () => {
    const url = targetUrl.trim();
    if (!url) return;

    setIsProcessing(true);
    setError(null);
    setProgress(0);
    setCurrentPhase('Starting exploration...');
    setCurrentStep(`Crawling ${url}`);
    setResult(null);
    setSessionId(null);

    // Build auth config
    let auth: any = undefined;
    if (config.authType !== 'none') {
      auth = { type: config.authType };
      if (config.authType === 'bearer') auth.token = config.bearerToken;
      else if (config.authType === 'cookie') auth.cookies = config.cookieJson;
      else if (config.authType === 'basic') {
        auth.username = config.basicUsername;
        auth.password = config.basicPassword;
      } else if (config.authType === 'form_login') {
        auth.login_url = config.loginUrl;
        auth.username = config.loginUsername;
        auth.password = config.loginPassword;
        auth.username_selector = config.usernameSelector;
        auth.password_selector = config.passwordSelector;
        auth.submit_selector = config.submitSelector;
      }
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const response = await fetch(`${API_BASE_URL}/api/blaze/start-stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url,
          max_pages: config.maxPages,
          max_depth: config.maxDepth,
          concurrency: config.concurrency,
          delay_ms: 200,
          headless: true,
          auth,
        }),
        signal: controller.signal,
      });

      if (!response.ok) throw new Error(`Failed to start exploration: ${response.status}`);

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response stream');

      const decoder = new TextDecoder();
      let buffer = '';
      const collectedDefects: ExplorationDefect[] = [];
      let pagesVisited = 0;
      let pagesQueued = 0;
      let sid = '';

      setCurrentPhase('Exploring...');
      setCurrentStep(`Crawling ${url} with ${config.concurrency} concurrent browser(s)`);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const event = JSON.parse(line.slice(6));

            switch (event.type) {
              case 'session':
                sid = event.session_id;
                setSessionId(sid);
                break;

              case 'page_visited':
                pagesVisited++;
                setCurrentStep(`Analyzing: ${event.url || ''}`);
                setProgress(Math.min(95, (pagesVisited / config.maxPages) * 100));
                break;

              case 'defect_found':
                if (event.defect) {
                  collectedDefects.push(event.defect);
                  setResult(prev => ({
                    session_id: sid,
                    status: 'running',
                    progress: Math.min(95, (pagesVisited / config.maxPages) * 100),
                    pages_visited: pagesVisited,
                    defects_found: collectedDefects.length,
                    defects: [...collectedDefects],
                    current_activity: prev?.current_activity || '',
                    duration: prev?.duration || 0,
                    pages_queued: pagesQueued,
                    generated_tests: null,
                  }));
                }
                break;

              case 'progress':
                pagesVisited = event.pages_visited || pagesVisited;
                pagesQueued = event.pages_queued || pagesQueued;
                setProgress(Math.min(95, (pagesVisited / config.maxPages) * 100));
                break;

              case 'complete': {
                setCurrentPhase('Complete');
                setProgress(100);
                const summary = event.summary || {};
                setResult({
                  session_id: sid,
                  status: 'completed',
                  progress: 100,
                  pages_visited: summary.pages_visited || pagesVisited,
                  defects_found: summary.total_defects || collectedDefects.length,
                  defects: event.defects || collectedDefects,
                  current_activity: 'Exploration complete',
                  duration: summary.duration_seconds || 0,
                  pages_queued: 0,
                  summary,
                  generated_tests: null,
                });
                break;
              }

              case 'error':
                setError(event.error || 'Exploration error');
                setCurrentPhase('Error');
                break;

              case 'stopped':
                setCurrentPhase('Stopped');
                break;
            }
          } catch {
            // Ignore malformed SSE events
          }
        }
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        setError(err.message || 'Execution failed');
      }
    } finally {
      setIsProcessing(false);
    }
  }, [targetUrl, config]);

  const handleStop = useCallback(() => {
    if (abortControllerRef.current) abortControllerRef.current.abort();
    setIsProcessing(false);
    setCurrentPhase('Stopped');
  }, []);

  // ---- Generate test suite from exploration ----

  const handleGenerateTests = useCallback(async () => {
    if (!sessionId) return;
    setCurrentStep('Generating test suite...');
    try {
      const response = await fetch(`${API_BASE_URL}/api/blaze/generate-tests/${sessionId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!response.ok) throw new Error(`Failed: ${response.status}`);
      const data: GeneratedTestSuite = await response.json();
      setResult(prev => prev ? { ...prev, generated_tests: data } : prev);
      setCurrentStep(`Generated ${data.test_count} test cases`);
    } catch (err: any) {
      setCurrentStep(`Test generation failed: ${err.message || 'Network error'}`);
    }
  }, [sessionId]);

  // ---- Save all generated tests ----

  const handleSaveAllTests = useCallback(async (tests: GeneratedTestSuite['tests']) => {
    let savedCount = 0;
    for (const test of tests) {
      try {
        const response = await fetch(`${API_BASE_URL}/test-cases`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(test),
        });
        if (response.ok) savedCount++;
      } catch { /* continue */ }
    }
    setCurrentStep(`Saved ${savedCount}/${tests.length} test cases to repository`);
  }, []);

  // ---- Severity counts ----

  const severityCounts = (result?.defects || []).reduce<Record<string, number>>((acc, d) => {
    acc[d.severity] = (acc[d.severity] || 0) + 1;
    return acc;
  }, {});

  const severityBadges = [
    { key: 'critical', label: 'Critical', color: 'bg-red-500/10 text-red-500' },
    { key: 'high', label: 'High', color: 'bg-orange-500/10 text-orange-500' },
    { key: 'medium', label: 'Medium', color: 'bg-amber-500/10 text-amber-500' },
    { key: 'low', label: 'Low', color: 'bg-blue-500/10 text-blue-500' },
  ];

  return (
    <div className="space-y-4">
      {/* URL + Controls */}
      <div className={cn(
        "rounded-xl border p-4",
        theme === 'light' ? "bg-white border-gray-200" : "bg-gray-900 border-gray-800"
      )}>
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <Input
              value={targetUrl}
              onChange={(e) => setTargetUrl(e.target.value)}
              placeholder="https://example.com"
              className={inputCn}
              disabled={isProcessing}
            />
          </div>
          {isProcessing ? (
            <Button onClick={handleStop} variant="destructive" size="sm" className="h-9">
              <Square className="w-4 h-4 mr-1" /> Stop
            </Button>
          ) : (
            <Button
              onClick={handleExecute}
              disabled={!targetUrl.trim()}
              size="sm"
              className="h-9 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white"
            >
              <Play className="w-4 h-4 mr-1" /> Explore
            </Button>
          )}
        </div>

        <div className="mt-3">
          <ExplorerConfigPanel
            config={config}
            onChange={setConfig}
            expanded={configExpanded}
            onToggle={() => setConfigExpanded(!configExpanded)}
            disabled={isProcessing}
            theme={theme}
          />
        </div>
      </div>

      {/* Progress */}
      {(isProcessing || currentPhase) && (
        <ExecutionProgress phase={currentPhase} step={currentStep} progress={progress} theme={theme} />
      )}

      {/* Error */}
      {error && (
        <div className={cn(
          "rounded-lg border px-4 py-3 text-sm flex items-center gap-2",
          theme === 'light' ? "bg-red-50 border-red-200 text-red-700" : "bg-red-500/10 border-red-500/30 text-red-400"
        )}>
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Stats Grid */}
      {result && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard icon={Globe} label="Pages" value={result.pages_visited} theme={theme} />
          <StatCard icon={Bug} label="Defects" value={result.defects_found} theme={theme} />
          <StatCard icon={Clock} label="Duration" value={`${Math.round(result.duration)}s`} theme={theme} />
          <StatCard icon={Layers} label="Depth" value={config.maxDepth} theme={theme} />
        </div>
      )}

      {/* Severity Badges */}
      {result && result.defects.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {severityBadges.map(({ key, label, color }) =>
            severityCounts[key] ? (
              <Badge key={key} className={cn("text-xs border-0", color)}>
                {label}: {severityCounts[key]}
              </Badge>
            ) : null
          )}
        </div>
      )}

      {/* Defect Cards */}
      {result && result.defects.length > 0 && (
        <div className="space-y-3">
          <h3 className={cn("text-sm font-semibold", theme === 'light' ? 'text-gray-900' : 'text-white')}>
            Defects Found ({result.defects.length})
          </h3>
          <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
            {result.defects.slice(0, 50).map((defect, i) => (
              <DefectCard key={defect.id || i} defect={defect} theme={theme} />
            ))}
          </div>
        </div>
      )}

      {/* Generate Test Suite */}
      {result && result.status === 'completed' && !result.generated_tests && sessionId && (
        <div className={cn(
          "rounded-xl border p-4 flex items-center justify-between",
          theme === 'light' ? "bg-white border-gray-200" : "bg-gray-900 border-gray-800"
        )}>
          <div>
            <h4 className={cn("text-sm font-semibold", theme === 'light' ? 'text-gray-900' : 'text-white')}>
              Generate Test Suite
            </h4>
            <p className={cn("text-xs mt-0.5", theme === 'light' ? 'text-gray-500' : 'text-gray-400')}>
              Create regression tests from discovered pages and defects
            </p>
          </div>
          <Button
            onClick={handleGenerateTests}
            size="sm"
            className="h-8 bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 text-white"
          >
            <FlaskConical className="w-3.5 h-3.5 mr-1" /> Generate Tests
          </Button>
        </div>
      )}

      {/* Generated Tests */}
      {result?.generated_tests && (
        <div className={cn(
          "rounded-xl border p-4 space-y-3",
          theme === 'light' ? "bg-white border-gray-200" : "bg-gray-900 border-gray-800"
        )}>
          <div className="flex items-center justify-between">
            <h4 className={cn("text-sm font-semibold", theme === 'light' ? 'text-gray-900' : 'text-white')}>
              Generated Tests ({result.generated_tests.test_count})
            </h4>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs"
              onClick={() => handleSaveAllTests(result.generated_tests!.tests)}
            >
              <Save className="w-3 h-3 mr-1" /> Save All to Repository
            </Button>
          </div>

          <div className="flex gap-2">
            <Badge className="text-[10px] border-0 bg-green-500/10 text-green-500">
              Smoke: {result.generated_tests.summary.smoke_tests}
            </Badge>
            <Badge className="text-[10px] border-0 bg-blue-500/10 text-blue-500">
              Form: {result.generated_tests.summary.form_tests}
            </Badge>
            <Badge className="text-[10px] border-0 bg-purple-500/10 text-purple-500">
              Regression: {result.generated_tests.summary.regression_tests}
            </Badge>
          </div>

          <div className="space-y-1.5 max-h-48 overflow-y-auto">
            {result.generated_tests.tests.map((test, i) => (
              <div
                key={i}
                className={cn(
                  "flex items-center justify-between px-3 py-2 rounded-lg text-xs",
                  theme === 'light' ? 'bg-gray-50' : 'bg-gray-800/50'
                )}
              >
                <span className={theme === 'light' ? 'text-gray-700' : 'text-gray-300'}>{test.title}</span>
                <Badge className="text-[10px] border-0 bg-gray-500/10 text-gray-500">{test.priority}</Badge>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ---- Small stat card ----

function StatCard({ icon: Icon, label, value, theme }: { icon: any; label: string; value: string | number; theme: string }) {
  return (
    <div className={cn(
      "rounded-lg border px-4 py-3",
      theme === 'light' ? "bg-white border-gray-200" : "bg-gray-900 border-gray-800"
    )}>
      <div className="flex items-center gap-2">
        <Icon className={cn("w-4 h-4", theme === 'light' ? 'text-gray-400' : 'text-gray-500')} />
        <span className={cn("text-xs", theme === 'light' ? 'text-gray-500' : 'text-gray-400')}>{label}</span>
      </div>
      <div className={cn("text-xl font-bold mt-1 tabular-nums", theme === 'light' ? 'text-gray-900' : 'text-white')}>
        {value}
      </div>
    </div>
  );
}
