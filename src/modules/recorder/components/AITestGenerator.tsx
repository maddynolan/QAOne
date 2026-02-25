/**
 * AI Test Generator Component
 * 
 * A modal that uses AI to automatically generate test cases from the current page.
 * Uses accessibility snapshots (like MCP browser tools) and GPT-4o-mini for analysis.
 */

import { useState, useEffect, useCallback } from 'react';
import { 
  Sparkles, Loader2, CheckCircle, XCircle, Play, Save, 
  ChevronDown, ChevronRight, Wand2, Eye, RefreshCw, 
  FileText, Zap, AlertTriangle, Copy, ExternalLink,
  Bot, Brain, Layers, Target, Route
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useAI } from '@/contexts/AIContext';

interface GeneratedTest {
  id: string;
  name: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  pageUrl: string;
  steps: Array<{
    id: string;
    qword: string;
    args: string[];
    description: string;
  }>;
  generated: boolean;
  generatedAt: string;
}

interface PageAnalysis {
  pageType: string;
  pageDescription: string;
  elements: Array<{
    type: string;
    name: string;
    purpose: string;
    testable: boolean;
  }>;
}

interface AITestGeneratorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTestsGenerated?: (tests: GeneratedTest[]) => void;
}

export function AITestGenerator({ open, onOpenChange, onTestsGenerated }: AITestGeneratorProps) {
  const { config, status } = useAI();
  
  // State
  const [isGenerating, setIsGenerating] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState('');
  const [currentUrl, setCurrentUrl] = useState('');
  const [analysis, setAnalysis] = useState<PageAnalysis | null>(null);
  const [generatedTests, setGeneratedTests] = useState<GeneratedTest[]>([]);
  const [expandedTests, setExpandedTests] = useState<Set<string>>(new Set());
  const [selectedTests, setSelectedTests] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  // Listen for progress events from main process
  useEffect(() => {
    if (!open) return;
    
    const handleProgress = (_event: any, data: any) => {
      console.log('[AIGenerator] Progress:', data);
      
      switch (data.type) {
        case 'page_start':
          setProgressMessage(`Analyzing ${data.url}...`);
          setProgress(10);
          break;
        case 'analyzing':
          setProgressMessage('AI is analyzing the page structure...');
          setProgress(40);
          break;
        case 'page_complete':
          setProgressMessage(`Generated ${data.testsGenerated} tests for ${data.pageType} page`);
          setProgress(80);
          break;
        case 'crawl_complete':
          setProgressMessage(`Done! Generated ${data.testsGenerated} tests from ${data.pagesVisited} pages`);
          setProgress(100);
          break;
        case 'progress':
          setProgress((data.visited / data.maxPages) * 100);
          setProgressMessage(`Visited ${data.visited}/${data.maxPages} pages, ${data.testsGenerated} tests generated`);
          break;
      }
    };
    
    const handleTest = (_event: any, test: GeneratedTest) => {
      console.log('[AIGenerator] Test generated:', test.name);
      setGeneratedTests(prev => [...prev, test]);
    };
    
    const handleError = (_event: any, data: any) => {
      console.error('[AIGenerator] Error:', data);
      toast.error(`Error: ${data.error}`);
    };
    
    // @ts-ignore - Electron API
    window.electronAPI?.on('ai-generator-progress', handleProgress);
    // @ts-ignore
    window.electronAPI?.on('ai-generator-test', handleTest);
    // @ts-ignore
    window.electronAPI?.on('ai-generator-error', handleError);
    
    return () => {
      // @ts-ignore
      window.electronAPI?.removeListener?.('ai-generator-progress', handleProgress);
      // @ts-ignore
      window.electronAPI?.removeListener?.('ai-generator-test', handleTest);
      // @ts-ignore
      window.electronAPI?.removeListener?.('ai-generator-error', handleError);
    };
  }, [open]);

  // Analyze current page
  const handleAnalyze = useCallback(async () => {
    if (!config.hasApiKey) {
      toast.error('OpenAI API key not configured. Go to Settings to add it.');
      return;
    }

    setIsAnalyzing(true);
    setError(null);
    setAnalysis(null);

    try {
      // @ts-ignore - Electron API
      const result = await window.electronAPI?.invoke('ai-analyze-page', {
        model: config.model
      });
      
      if (result?.success) {
        setCurrentUrl(result.url);
        setAnalysis(result.analysis);
        toast.success(`Analyzed: ${result.analysis.pageType} page`);
      } else {
        setError(result?.error || 'Failed to analyze page');
        toast.error(result?.error || 'Failed to analyze page');
      }
    } catch (err: any) {
      setError(err.message);
      toast.error(err.message);
    } finally {
      setIsAnalyzing(false);
    }
  }, [config.hasApiKey, config.model]);

  // Generate tests for current page
  const handleGenerate = useCallback(async () => {
    if (!config.hasApiKey) {
      toast.error('OpenAI API key not configured. Go to Settings to add it.');
      return;
    }

    setIsGenerating(true);
    setError(null);
    setProgress(0);
    setProgressMessage('Starting...');
    setGeneratedTests([]);

    try {
      // @ts-ignore - Electron API
      const result = await window.electronAPI?.invoke('ai-generate-current-page', {
        model: config.model
      });
      
      if (result?.success) {
        setCurrentUrl(result.url);
        setAnalysis(result.analysis);
        setGeneratedTests(result.tests || []);
        setProgress(100);
        setProgressMessage(`Generated ${result.tests?.length || 0} test cases!`);
        
        // Auto-select all tests
        setSelectedTests(new Set(result.tests?.map((t: GeneratedTest) => t.id) || []));
        
        toast.success(`Generated ${result.tests?.length || 0} test cases!`);
      } else {
        setError(result?.error || 'Failed to generate tests');
        toast.error(result?.error || 'Failed to generate tests');
      }
    } catch (err: any) {
      setError(err.message);
      toast.error(err.message);
    } finally {
      setIsGenerating(false);
    }
  }, [config.hasApiKey, config.model]);

  // Save selected tests
  const handleSaveTests = useCallback(() => {
    const testsToSave = generatedTests.filter(t => selectedTests.has(t.id));
    
    if (testsToSave.length === 0) {
      toast.error('No tests selected');
      return;
    }
    
    onTestsGenerated?.(testsToSave);
    toast.success(`Saved ${testsToSave.length} test cases to library`);
    onOpenChange(false);
  }, [generatedTests, selectedTests, onTestsGenerated, onOpenChange]);

  // Toggle test expansion
  const toggleExpanded = (testId: string) => {
    setExpandedTests(prev => {
      const next = new Set(prev);
      if (next.has(testId)) {
        next.delete(testId);
      } else {
        next.add(testId);
      }
      return next;
    });
  };

  // Toggle test selection
  const toggleSelected = (testId: string) => {
    setSelectedTests(prev => {
      const next = new Set(prev);
      if (next.has(testId)) {
        next.delete(testId);
      } else {
        next.add(testId);
      }
      return next;
    });
  };

  // Select/deselect all
  const toggleSelectAll = () => {
    if (selectedTests.size === generatedTests.length) {
      setSelectedTests(new Set());
    } else {
      setSelectedTests(new Set(generatedTests.map(t => t.id)));
    }
  };

  const priorityColors = {
    high: 'bg-red-500/20 text-red-400 border-red-500/30',
    medium: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    low: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-gradient-to-br from-violet-500/20 to-purple-500/20 border border-violet-500/30">
              <Bot className="h-5 w-5 text-violet-400" />
            </div>
            AI Test Generator
          </DialogTitle>
          <DialogDescription>
            Automatically generate test cases using AI analysis of the current page
          </DialogDescription>
        </DialogHeader>

        {/* AI Status Warning */}
        {!config.enabled && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 text-sm">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>AI features are disabled. Enable them in Settings to use this feature.</span>
          </div>
        )}

        {!config.hasApiKey && config.enabled && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 text-sm">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>OpenAI API key not configured. Add it in Settings.</span>
          </div>
        )}

        {/* Main Content */}
        <div className="flex-1 overflow-hidden flex flex-col gap-4">
          {/* Action Buttons */}
          <div className="flex items-center gap-3">
            <Button
              onClick={handleAnalyze}
              disabled={!config.enabled || !config.hasApiKey || isAnalyzing || isGenerating}
              variant="outline"
              className="gap-2"
            >
              {isAnalyzing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
              Analyze Page
            </Button>
            
            <Button
              onClick={handleGenerate}
              disabled={!config.enabled || !config.hasApiKey || isGenerating}
              className="gap-2 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700"
            >
              {isGenerating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Wand2 className="h-4 w-4" />
              )}
              Generate Tests
            </Button>
            
            {currentUrl && (
              <div className="flex-1 text-right text-xs text-muted-foreground truncate">
                {currentUrl}
              </div>
            )}
          </div>

          {/* Progress Bar */}
          {(isGenerating || isAnalyzing) && (
            <div className="space-y-2">
              <Progress value={progress} className="h-2" />
              <p className="text-xs text-muted-foreground text-center">{progressMessage}</p>
            </div>
          )}

          {/* Analysis Results */}
          {analysis && (
            <div className="p-4 rounded-lg bg-card border border-border">
              <div className="flex items-center gap-2 mb-3">
                <Brain className="h-4 w-4 text-violet-400" />
                <span className="font-medium">Page Analysis</span>
                <Badge variant="outline" className="ml-auto">
                  {analysis.pageType}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground mb-3">{analysis.pageDescription}</p>
              
              <div className="flex flex-wrap gap-2">
                {analysis.elements?.slice(0, 8).map((el, i) => (
                  <Badge 
                    key={i} 
                    variant="secondary" 
                    className={cn(
                      "text-xs",
                      el.testable ? "bg-emerald-500/20 text-emerald-400" : "bg-gray-500/20 text-gray-400"
                    )}
                  >
                    {el.type}: {el.name}
                  </Badge>
                ))}
                {(analysis.elements?.length || 0) > 8 && (
                  <Badge variant="secondary" className="text-xs">
                    +{(analysis.elements?.length || 0) - 8} more
                  </Badge>
                )}
              </div>
            </div>
          )}

          {/* Generated Tests */}
          {generatedTests.length > 0 && (
            <div className="flex-1 overflow-hidden flex flex-col">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">
                  Generated Tests ({generatedTests.length})
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={toggleSelectAll}
                  className="text-xs h-7"
                >
                  {selectedTests.size === generatedTests.length ? 'Deselect All' : 'Select All'}
                </Button>
              </div>
              
              <ScrollArea className="flex-1 pr-4">
                <div className="space-y-2">
                  {generatedTests.map(test => (
                    <Collapsible
                      key={test.id}
                      open={expandedTests.has(test.id)}
                      onOpenChange={() => toggleExpanded(test.id)}
                    >
                      <div className={cn(
                        "p-3 rounded-lg border transition-colors",
                        selectedTests.has(test.id) 
                          ? "bg-violet-500/10 border-violet-500/30" 
                          : "bg-card border-border hover:border-violet-500/20"
                      )}>
                        <div className="flex items-start gap-3">
                          {/* Checkbox */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleSelected(test.id);
                            }}
                            className={cn(
                              "mt-0.5 w-4 h-4 rounded border-2 flex items-center justify-center transition-colors",
                              selectedTests.has(test.id)
                                ? "bg-violet-500 border-violet-500"
                                : "border-gray-500 hover:border-violet-400"
                            )}
                          >
                            {selectedTests.has(test.id) && (
                              <CheckCircle className="h-3 w-3 text-white" />
                            )}
                          </button>
                          
                          {/* Test Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-medium text-sm truncate">{test.name}</span>
                              <Badge className={cn("text-[10px]", priorityColors[test.priority])}>
                                {test.priority}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground line-clamp-2">
                              {test.description}
                            </p>
                          </div>
                          
                          {/* Expand Button */}
                          <CollapsibleTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                              {expandedTests.has(test.id) ? (
                                <ChevronDown className="h-4 w-4" />
                              ) : (
                                <ChevronRight className="h-4 w-4" />
                              )}
                            </Button>
                          </CollapsibleTrigger>
                        </div>
                        
                        {/* Steps */}
                        <CollapsibleContent>
                          <div className="mt-3 pt-3 border-t border-border/50">
                            <div className="text-xs font-medium text-muted-foreground mb-2">
                              Steps ({test.steps.length})
                            </div>
                            <div className="space-y-1">
                              {test.steps.map((step, i) => (
                                <div 
                                  key={step.id}
                                  className="flex items-center gap-2 text-xs p-2 rounded bg-background/50"
                                >
                                  <span className="w-5 h-5 rounded-full bg-violet-500/20 text-violet-400 flex items-center justify-center text-[10px] font-medium">
                                    {i + 1}
                                  </span>
                                  <Badge variant="outline" className="text-[10px] font-mono">
                                    {step.qword}
                                  </Badge>
                                  <span className="text-muted-foreground truncate flex-1">
                                    {step.description}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </CollapsibleContent>
                      </div>
                    </Collapsible>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}

          {/* Empty State */}
          {!isGenerating && !analysis && generatedTests.length === 0 && (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
              <div className="p-4 rounded-full bg-violet-500/10 mb-4">
                <Sparkles className="h-8 w-8 text-violet-400" />
              </div>
              <h3 className="font-semibold mb-2">AI-Powered Test Generation</h3>
              <p className="text-sm text-muted-foreground max-w-md mb-4">
                Click "Generate Tests" to let AI analyze the current page and automatically 
                create comprehensive test cases including happy paths, validation tests, and edge cases.
              </p>
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Target className="h-3.5 w-3.5" />
                  Auto-detect elements
                </div>
                <div className="flex items-center gap-1">
                  <Route className="h-3.5 w-3.5" />
                  Generate workflows
                </div>
                <div className="flex items-center gap-1">
                  <Layers className="h-3.5 w-3.5" />
                  Multiple test types
                </div>
              </div>
            </div>
          )}

          {/* Error Display */}
          {error && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
              <XCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSaveTests}
            disabled={selectedTests.size === 0}
            className="gap-2"
          >
            <Save className="h-4 w-4" />
            Save {selectedTests.size > 0 ? `(${selectedTests.size})` : ''} Tests
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default AITestGenerator;
