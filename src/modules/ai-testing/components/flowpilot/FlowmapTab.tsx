/**
 * FlowmapTab — Application capability mapping via BFS crawl + LLM analysis.
 * Full-width layout: URL input, progress, page list with badges, AI analysis.
 */
import React, { useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { API_BASE_URL } from '@/lib/api-config';
import { apiClient } from '@/lib/api-client';
import {
  Play,
  Map,
  Globe,
  MousePointer,
  FileInput,
  Database,
  ExternalLink,
  AlertCircle,
  Brain,
} from 'lucide-react';
import { ExecutionProgress } from './ExecutionProgress';
import type { FlowmapResult, CapabilityPage } from './types';

interface FlowmapTabProps {
  aiAvailable: boolean;
  theme: string;
}

export function FlowmapTab({ aiAvailable, theme }: FlowmapTabProps) {
  const [targetUrl, setTargetUrl] = useState('');

  // Execution state
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [currentPhase, setCurrentPhase] = useState('');
  const [currentStep, setCurrentStep] = useState('');

  // Results
  const [result, setResult] = useState<FlowmapResult | null>(null);

  const inputCn = cn("h-9", theme === 'light' ? "bg-white border-gray-200" : "bg-gray-800 border-gray-700");

  const handleExecute = useCallback(async () => {
    const url = targetUrl.trim();
    if (!url) return;

    setIsProcessing(true);
    setError(null);
    setProgress(0);
    setResult(null);
    setCurrentPhase('Mapping application...');
    setCurrentStep(`Crawling ${url} -- discovering pages, entities, and actions`);

    try {
      const response = await apiClient.post('/api/exploration/start', {
        base_url: url,
        max_depth: 3,
        max_pages: 30,
        headless: true,
        screenshot: true,
      });

      const data = response.data;
      setResult(data);
      setProgress(100);
      setCurrentPhase('Complete');
      setCurrentStep(`Discovered ${data.total_pages || 0} pages`);
    } catch (err: any) {
      const msg = err.response?.data?.detail || err.message || 'Mapping failed';
      setError(msg);
    } finally {
      setIsProcessing(false);
    }
  }, [targetUrl]);

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
          <Button
            onClick={handleExecute}
            disabled={!targetUrl.trim() || isProcessing}
            size="sm"
            className="h-9 bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600 text-white"
          >
            <Play className="w-4 h-4 mr-1" /> {isProcessing ? 'Mapping...' : 'Map Application'}
          </Button>
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

      {/* Results */}
      {result && (
        <>
          {/* Summary */}
          <div className={cn(
            "rounded-xl border p-4",
            theme === 'light' ? "bg-white border-gray-200" : "bg-gray-900 border-gray-800"
          )}>
            <div className="flex items-center gap-2 mb-3">
              <Map className={cn("w-5 h-5", theme === 'light' ? 'text-teal-600' : 'text-teal-400')} />
              <h3 className={cn("text-sm font-semibold", theme === 'light' ? 'text-gray-900' : 'text-white')}>
                Application Map ({result.total_pages} pages)
              </h3>
            </div>

            <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
              {(result.pages || []).map((page, i) => (
                <PageRow key={page.id || i} page={page} theme={theme} />
              ))}
            </div>
          </div>

          {/* AI Analysis */}
          {result.llm_analysis && (
            <div className={cn(
              "rounded-xl border p-4",
              theme === 'light' ? "bg-white border-gray-200" : "bg-gray-900 border-gray-800"
            )}>
              <div className="flex items-center gap-2 mb-3">
                <Brain className={cn("w-5 h-5", theme === 'light' ? 'text-purple-600' : 'text-purple-400')} />
                <h3 className={cn("text-sm font-semibold", theme === 'light' ? 'text-gray-900' : 'text-white')}>
                  AI Analysis
                </h3>
              </div>
              <div className={cn(
                "text-sm whitespace-pre-wrap leading-relaxed",
                theme === 'light' ? 'text-gray-600' : 'text-gray-300'
              )}>
                {typeof result.llm_analysis === 'string'
                  ? result.llm_analysis
                  : result.llm_analysis.summary || JSON.stringify(result.llm_analysis, null, 2)}
              </div>
            </div>
          )}

          {!aiAvailable && !result.llm_analysis && (
            <div className={cn(
              "rounded-lg border px-4 py-3 text-sm flex items-center gap-2",
              theme === 'light' ? "bg-amber-50 border-amber-200 text-amber-700" : "bg-amber-500/10 border-amber-500/30 text-amber-400"
            )}>
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              Enable AI in Settings for enhanced analysis of discovered pages.
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ---- Page row with badge counts ----

function PageRow({ page, theme }: { page: CapabilityPage; theme: string }) {
  return (
    <div className={cn(
      "flex items-center gap-3 px-3 py-2.5 rounded-lg",
      theme === 'light' ? 'bg-gray-50 hover:bg-gray-100' : 'bg-gray-800/50 hover:bg-gray-800'
    )}>
      <Globe className={cn("w-4 h-4 flex-shrink-0", theme === 'light' ? 'text-teal-500' : 'text-teal-400')} />
      <div className="flex-1 min-w-0">
        <div className={cn("text-sm font-medium truncate", theme === 'light' ? 'text-gray-900' : 'text-white')}>
          {page.title || new URL(page.url).pathname}
        </div>
        <div className={cn("text-[10px] truncate", theme === 'light' ? 'text-gray-400' : 'text-gray-500')}>
          {page.url}
        </div>
      </div>
      <div className="flex gap-1.5 flex-shrink-0">
        {page.buttons?.length > 0 && (
          <Badge className="text-[10px] border-0 bg-blue-500/10 text-blue-500">
            <MousePointer className="w-2.5 h-2.5 mr-0.5" /> {page.buttons.length}
          </Badge>
        )}
        {page.forms?.length > 0 && (
          <Badge className="text-[10px] border-0 bg-green-500/10 text-green-500">
            <FileInput className="w-2.5 h-2.5 mr-0.5" /> {page.forms.length}
          </Badge>
        )}
        {page.entities?.length > 0 && (
          <Badge className="text-[10px] border-0 bg-purple-500/10 text-purple-500">
            <Database className="w-2.5 h-2.5 mr-0.5" /> {page.entities.length}
          </Badge>
        )}
      </div>
    </div>
  );
}
