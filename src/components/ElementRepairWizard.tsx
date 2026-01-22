/**
 * Element Repair Wizard - Fix failed steps with visual element selection
 * 
 * Three-tab interface:
 * 1. 📍 Pick Element - Visual element picker
 * 2. 🔍 Debug Info - Why it failed
 * 3. 🤖 AI Assist - AI-powered element finding
 * 
 * @author Flowstral
 * @version 1.0.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { 
  MousePointer2, 
  Bug, 
  Sparkles, 
  CheckCircle2, 
  XCircle, 
  Eye, 
  Copy, 
  Play,
  Loader2,
  Star,
  ChevronRight,
  AlertCircle,
  Lightbulb,
  Image as ImageIcon,
  RefreshCw,
  Type
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

// Types
interface ElementInfo {
  tag: string;
  id: string | null;
  className: string | null;
  text: string;
  role: string | null;
  ariaLabel: string | null;
  dataTestId: string | null;
  name: string | null;
  selectors: SelectorOption[];
  outerHTML: string;
  boundingBox: { x: number; y: number; width: number; height: number };
}

interface SelectorOption {
  type: string;
  selector: string;
  reliability: number;
  description: string;
}

interface DebugInfo {
  summary: string;
  error: string;
  strategiesSummary: Array<{
    strategy: string;
    selector: string;
    result: string;
    matchCount: number;
  }>;
  pageSummary: {
    url: string;
    title: string;
    loadState: string;
    buttons: number;
    hasLoader: boolean;
    hasModal: boolean;
  } | null;
  similarElements: Array<{
    text: string;
    reason: string;
    selector: string;
    visible: boolean;
  }>;
  screenshot: string | null;
}

interface FixSuggestion {
  type: string;
  title: string;
  description: string;
  fix: { type: string; [key: string]: any };
}

interface RecordedAction {
  type?: string;
  qword?: string;
  text?: string;
  label?: string;
  description?: string;
  selector?: string;
  selectorObj?: { selector?: string };
  recipe?: any;
  manualSelector?: string;
  manualText?: string;
}

interface ElementRepairWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  action: RecordedAction | null;
  actionIndex: number;
  onSave: (updates: { manualSelector?: string; manualText?: string }) => void;
}

// Tab type
type TabType = 'picker' | 'debug' | 'ai' | 'manual';

export default function ElementRepairWizard({
  open,
  onOpenChange,
  action,
  actionIndex,
  onSave
}: ElementRepairWizardProps) {
  const [activeTab, setActiveTab] = useState<TabType>('manual'); // Start with manual when browser might not be open
  const [isLoading, setIsLoading] = useState(false);
  
  // Element Picker state
  const [isPicking, setIsPicking] = useState(false);
  const [pickedElement, setPickedElement] = useState<ElementInfo | null>(null);
  const [selectedSelector, setSelectedSelector] = useState<string>('');
  const [manualTextOverride, setManualTextOverride] = useState<string>(''); // For text-based matching
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  
  // Debug state
  const [debugInfo, setDebugInfo] = useState<DebugInfo | null>(null);
  const [fixSuggestions, setFixSuggestions] = useState<FixSuggestion[]>([]);
  
  // AI state
  const [aiDescription, setAiDescription] = useState('');
  const [aiResults, setAiResults] = useState<Array<{ selector: string; confidence: number; reason: string }>>([]);
  const [isAiSearching, setIsAiSearching] = useState(false);
  
  // Browser availability check
  const [browserAvailable, setBrowserAvailable] = useState(false);

  // Get flowstral API
  const flowstral = (window as any).flowstral;
  
  // Check if browser is available
  useEffect(() => {
    const checkBrowser = async () => {
      try {
        if (flowstral?.elementPicker) {
          const status = await flowstral.getRecorderStatus?.();
          setBrowserAvailable(status?.browserReady || status?.hasPage || false);
        } else {
          setBrowserAvailable(false);
        }
      } catch {
        setBrowserAvailable(false);
      }
    };
    if (open) {
      checkBrowser();
    }
  }, [open, flowstral]);
  
  // Pre-populate manual fields from action
  useEffect(() => {
    if (open && action) {
      // Pre-populate selector if available
      const existingSelector = action.manualSelector || 
        action.selectorObj?.selector || 
        action.selector || '';
      setSelectedSelector(existingSelector);
      
      // Pre-populate text if available
      const existingText = action.manualText || 
        action.text || 
        action.label || 
        action.description?.replace(/^(Click|Fill|Select)\s+["']?/i, '').replace(/["']?$/, '') || '';
      setManualTextOverride(existingText);
    }
  }, [open, action]);

  // Load debug info when opening
  useEffect(() => {
    if (open && action) {
      loadDebugInfo();
    }
  }, [open, action]);

  // Clean up when closing
  useEffect(() => {
    if (!open) {
      setIsPicking(false);
      setPickedElement(null);
      setSelectedSelector('');
      setTestResult(null);
      setDebugInfo(null);
      setFixSuggestions([]);
      setAiDescription('');
      setAiResults([]);
    }
  }, [open]);

  // Load debug info
  const loadDebugInfo = async () => {
    if (!flowstral?.debug) return;
    
    try {
      setIsLoading(true);
      
      // Get last failure debug
      const debugResult = await flowstral.debug.getLastFailure();
      if (debugResult?.success) {
        setDebugInfo(debugResult.debug);
      }
      
      // Get fix suggestions
      const suggestResult = await flowstral.debug.analyzeFailure(action, []);
      if (suggestResult?.success) {
        setFixSuggestions(suggestResult.suggestions);
      }
    } catch (e) {
      console.error('Failed to load debug info:', e);
    } finally {
      setIsLoading(false);
    }
  };

  // Start element picker
  const startPicker = async () => {
    if (!flowstral?.elementPicker) {
      toast.error('Element picker not available');
      return;
    }

    setIsPicking(true);
    setPickedElement(null);
    toast.info('🎯 Click on any element in the browser to select it');

    try {
      const result = await flowstral.elementPicker.start();
      
      if (result?.success && result.elementInfo) {
        setPickedElement(result.elementInfo);
        // Auto-select best selector
        if (result.elementInfo.selectors?.length > 0) {
          setSelectedSelector(result.elementInfo.selectors[0].selector);
        }
        toast.success('✅ Element captured!');
      } else if (result?.cancelled) {
        toast.info('Picker cancelled');
      } else {
        toast.error(result?.error || 'Failed to pick element');
      }
    } catch (e: any) {
      toast.error(e.message || 'Picker failed');
    } finally {
      setIsPicking(false);
    }
  };

  // Stop element picker
  const stopPicker = async () => {
    if (flowstral?.elementPicker) {
      await flowstral.elementPicker.stop();
    }
    setIsPicking(false);
  };

  // Test a selector
  const testSelector = async (selector: string) => {
    if (!flowstral?.elementPicker || !selector) return;

    setTestResult(null);
    
    try {
      const result = await flowstral.elementPicker.testSelector(selector);
      setTestResult({
        success: result.success,
        message: result.message
      });
      
      // Highlight the element
      if (result.success) {
        await flowstral.elementPicker.highlight(selector);
      }
    } catch (e: any) {
      setTestResult({ success: false, message: e.message });
    }
  };

  // Copy selector to clipboard
  const copySelector = (selector: string) => {
    navigator.clipboard.writeText(selector);
    toast.success('Selector copied to clipboard');
  };

  // AI search
  const aiSearch = async () => {
    if (!flowstral?.debug || !aiDescription.trim()) return;

    setIsAiSearching(true);
    setAiResults([]);

    try {
      const result = await flowstral.debug.aiFindElement(aiDescription);
      
      if (result?.success && result.elementInfo) {
        setAiResults([{
          selector: result.elementInfo.selector,
          confidence: result.elementInfo.confidence || 0.85,
          reason: `Found via AI at coordinates (${result.coordinates.x}, ${result.coordinates.y})`
        }]);
        toast.success('AI found a matching element!');
      } else {
        toast.error(result?.error || 'AI could not find the element');
      }
    } catch (e: any) {
      toast.error(e.message || 'AI search failed');
    } finally {
      setIsAiSearching(false);
    }
  };

  // Save the fix
  const handleSave = () => {
    // Allow saving if we have selector, text override, or picked element
    if (!selectedSelector && !manualTextOverride && !pickedElement?.text) {
      toast.error('Please enter a selector or text to match');
      return;
    }

    onSave({
      manualSelector: selectedSelector || undefined,
      manualText: manualTextOverride || pickedElement?.text || undefined
    });

    toast.success('✅ Step updated! Changes will apply on next playback.');
    onOpenChange(false);
  };

  // Get reliability stars
  const getReliabilityStars = (reliability: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Star
        key={i}
        className={cn(
          'h-3 w-3',
          i < reliability ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground/30'
        )}
      />
    ));
  };

  // Render tab content
  const renderTabContent = () => {
    switch (activeTab) {
      case 'manual':
        return (
          <div className="space-y-4">
            {/* Instructions - always works without browser */}
            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-4">
              <p className="text-sm text-emerald-400 flex items-center gap-2">
                <Lightbulb className="h-4 w-4 flex-shrink-0" />
                <span>
                  <strong>Manual Edit</strong> - Edit selector or text directly. 
                  Works even when browser isn't open.
                </span>
              </p>
            </div>

            {/* Current Step Info */}
            {action && (
              <div className="bg-secondary/50 rounded-lg p-3">
                <p className="text-xs text-muted-foreground mb-1">Current Step</p>
                <p className="text-sm font-medium">
                  {action.type || action.qword}: {action.description || action.text || action.label}
                </p>
              </div>
            )}

            {/* Text Override */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                Text to Match
              </label>
              <Input
                value={manualTextOverride}
                onChange={(e) => setManualTextOverride(e.target.value)}
                placeholder='e.g., "Submit", "Opportunities", "Save"'
                className="text-sm"
              />
              <p className="text-xs text-muted-foreground">
                The exact text of the element (button label, link text, etc.)
              </p>
            </div>

            {/* Selector Override */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                CSS Selector (Advanced)
              </label>
              <Input
                value={selectedSelector}
                onChange={(e) => setSelectedSelector(e.target.value)}
                placeholder='e.g., #submit-btn, [data-testid="submit"], button.primary'
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Optional: CSS selector for precise element matching
              </p>
            </div>

            {/* Test Button - only if browser available */}
            {browserAvailable && selectedSelector && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => testSelector(selectedSelector)}
                className="w-full"
              >
                <Play className="h-3 w-3 mr-2" />
                Test Selector in Browser
              </Button>
            )}

            {/* Test Result */}
            {testResult && (
              <div className={cn(
                'flex items-center gap-2 p-2 rounded-lg text-sm',
                testResult.success ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
              )}>
                {testResult.success ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                {testResult.message}
              </div>
            )}

            {/* Tips */}
            <div className="bg-secondary/30 rounded-lg p-3">
              <p className="text-xs font-medium text-muted-foreground mb-2">💡 Tips:</p>
              <ul className="text-xs text-muted-foreground space-y-1 ml-4 list-disc">
                <li>Use exact text as it appears on the page</li>
                <li>For buttons, use the button label text</li>
                <li>CSS selectors like <code className="bg-secondary px-1 rounded">[data-testid="..."]</code> are most reliable</li>
                <li>Changes apply on next playback</li>
              </ul>
            </div>
          </div>
        );

      case 'picker':
        return (
          <div className="space-y-4">
            {/* Browser not available warning */}
            {!browserAvailable && (
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 mb-4">
                <p className="text-sm text-amber-400 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  <span>
                    <strong>Browser not open.</strong> Start recording or open a page first, 
                    or use the <strong>Manual Edit</strong> tab.
                  </span>
                </p>
              </div>
            )}
            
            {/* Instructions */}
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
              <p className="text-sm text-blue-400 flex items-center gap-2">
                <Lightbulb className="h-4 w-4 flex-shrink-0" />
                <span>
                  <strong>Click "Start Picking"</strong> then click on any element in the browser. 
                  We'll automatically generate the best selectors.
                </span>
              </p>
            </div>

            {/* Picker Button */}
            <div className="flex justify-center">
              <Button
                onClick={isPicking ? stopPicker : startPicker}
                size="lg"
                className={cn(
                  'w-full max-w-xs',
                  isPicking 
                    ? 'bg-red-500 hover:bg-red-600' 
                    : 'bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700'
                )}
              >
                {isPicking ? (
                  <>
                    <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                    Click Element... (ESC to cancel)
                  </>
                ) : (
                  <>
                    <MousePointer2 className="h-5 w-5 mr-2" />
                    Start Picking
                  </>
                )}
              </Button>
            </div>

            {/* Picked Element Info */}
            {pickedElement && (
              <div className="space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
                {/* Element preview */}
                <div className="bg-secondary/50 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground mb-1">Selected Element</p>
                  <div className="font-mono text-xs bg-background/50 rounded p-2 overflow-x-auto">
                    <code className="text-emerald-400">
                      &lt;{pickedElement.tag}
                      {pickedElement.id && <span className="text-orange-400"> id="{pickedElement.id}"</span>}
                      {pickedElement.className && <span className="text-purple-400"> class="{pickedElement.className.substring(0, 50)}..."</span>}
                      &gt;
                    </code>
                    <br />
                    <span className="text-foreground ml-4">{pickedElement.text?.substring(0, 60)}</span>
                  </div>
                </div>

                {/* Selectors */}
                <div>
                  <p className="text-xs text-muted-foreground mb-2">Generated Selectors (by reliability)</p>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {pickedElement.selectors?.map((sel, idx) => (
                      <div
                        key={idx}
                        className={cn(
                          'flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-colors',
                          selectedSelector === sel.selector
                            ? 'bg-blue-500/20 border-blue-500'
                            : 'bg-card/50 border-border hover:border-blue-500/50'
                        )}
                        onClick={() => setSelectedSelector(sel.selector)}
                      >
                        <div className="flex gap-0.5">
                          {getReliabilityStars(sel.reliability)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-mono truncate">{sel.selector}</p>
                          <p className="text-[10px] text-muted-foreground">{sel.description}</p>
                        </div>
                        <div className="flex gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            onClick={(e) => { e.stopPropagation(); copySelector(sel.selector); }}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            onClick={(e) => { e.stopPropagation(); testSelector(sel.selector); }}
                          >
                            <Play className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Test Result */}
                {testResult && (
                  <div className={cn(
                    'flex items-center gap-2 p-2 rounded-lg text-sm',
                    testResult.success ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
                  )}>
                    {testResult.success ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                    {testResult.message}
                  </div>
                )}
              </div>
            )}

            {/* Manual Input */}
            <div className="space-y-2 pt-2 border-t border-border">
              <p className="text-xs text-muted-foreground">Or enter manually:</p>
              <Input
                value={selectedSelector}
                onChange={(e) => setSelectedSelector(e.target.value)}
                placeholder='CSS selector: #submit-btn, [data-testid="submit"]'
                className="font-mono text-sm"
              />
              {selectedSelector && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => testSelector(selectedSelector)}
                  className="w-full"
                >
                  <Play className="h-3 w-3 mr-2" />
                  Test Selector
                </Button>
              )}
            </div>
          </div>
        );

      case 'debug':
        return (
          <div className="space-y-4">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : debugInfo ? (
              <>
                {/* Error Summary */}
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
                  <p className="text-sm text-red-400 font-medium">{debugInfo.summary}</p>
                  {debugInfo.error && (
                    <p className="text-xs text-red-400/80 mt-1">{debugInfo.error}</p>
                  )}
                </div>

                {/* Strategies Tried */}
                <div>
                  <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                    <Bug className="h-3 w-3" />
                    Strategies Attempted
                  </p>
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {debugInfo.strategiesSummary?.map((s, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-xs p-2 bg-secondary/30 rounded">
                        {s.result.startsWith('✅') ? (
                          <CheckCircle2 className="h-3 w-3 text-emerald-400 flex-shrink-0" />
                        ) : (
                          <XCircle className="h-3 w-3 text-red-400 flex-shrink-0" />
                        )}
                        <span className="font-medium">{s.strategy}</span>
                        <span className="text-muted-foreground truncate">{s.selector}</span>
                        <span className="ml-auto text-muted-foreground">
                          {s.matchCount > 0 ? `${s.matchCount} found` : 'None'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Page State */}
                {debugInfo.pageSummary && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-2">Page State</p>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="bg-secondary/30 rounded p-2">
                        <span className="text-muted-foreground">URL:</span>
                        <span className="ml-1 truncate">{debugInfo.pageSummary.url?.substring(0, 30)}...</span>
                      </div>
                      <div className="bg-secondary/30 rounded p-2">
                        <span className="text-muted-foreground">Buttons:</span>
                        <span className="ml-1">{debugInfo.pageSummary.buttons}</span>
                      </div>
                      {debugInfo.pageSummary.hasLoader && (
                        <div className="bg-amber-500/20 rounded p-2 text-amber-400">
                          ⏳ Page has loading indicator
                        </div>
                      )}
                      {debugInfo.pageSummary.hasModal && (
                        <div className="bg-purple-500/20 rounded p-2 text-purple-400">
                          📦 Modal dialog present
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Similar Elements */}
                {debugInfo.similarElements && debugInfo.similarElements.length > 0 && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-2">Similar Elements Found</p>
                    <div className="space-y-1 max-h-32 overflow-y-auto">
                      {debugInfo.similarElements.map((el, idx) => (
                        <div
                          key={idx}
                          className="flex items-center gap-2 text-xs p-2 bg-secondary/30 rounded cursor-pointer hover:bg-secondary/50"
                          onClick={() => setSelectedSelector(el.selector)}
                        >
                          <Badge variant="outline" className="text-[10px]">{el.reason}</Badge>
                          <span className="truncate flex-1">{el.text}</span>
                          {el.visible ? (
                            <Eye className="h-3 w-3 text-emerald-400" />
                          ) : (
                            <Eye className="h-3 w-3 text-muted-foreground opacity-50" />
                          )}
                          <ChevronRight className="h-3 w-3 text-muted-foreground" />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Screenshot */}
                {debugInfo.screenshot && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                      <ImageIcon className="h-3 w-3" />
                      Screenshot at Failure
                    </p>
                    <div className="rounded-lg overflow-hidden border border-border">
                      <img 
                        src={debugInfo.screenshot} 
                        alt="Failure screenshot" 
                        className="w-full h-auto max-h-48 object-contain bg-black"
                      />
                    </div>
                  </div>
                )}

                {/* Fix Suggestions */}
                {fixSuggestions.length > 0 && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                      <Lightbulb className="h-3 w-3" />
                      Suggested Fixes
                    </p>
                    <div className="space-y-2">
                      {fixSuggestions.map((sug, idx) => (
                        <div
                          key={idx}
                          className="flex items-start gap-3 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg cursor-pointer hover:bg-blue-500/20"
                          onClick={() => {
                            if (sug.fix.type === 'StartPicker') {
                              setActiveTab('picker');
                              startPicker();
                            } else if (sug.fix.type === 'UpdateText' && sug.fix.newText) {
                              setSelectedSelector(`text="${sug.fix.newText}"`);
                            }
                          }}
                        >
                          <AlertCircle className="h-4 w-4 text-blue-400 flex-shrink-0 mt-0.5" />
                          <div>
                            <p className="text-sm font-medium text-blue-400">{sug.title}</p>
                            <p className="text-xs text-blue-400/80">{sug.description}</p>
                          </div>
                          <ChevronRight className="h-4 w-4 text-blue-400 ml-auto" />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Bug className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No debug info available</p>
                <p className="text-xs">Run the test first to capture failure details</p>
              </div>
            )}
          </div>
        );

      case 'ai':
        return (
          <div className="space-y-4">
            {/* AI Instructions */}
            <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-4">
              <p className="text-sm text-purple-400 flex items-center gap-2">
                <Sparkles className="h-4 w-4 flex-shrink-0" />
                <span>
                  <strong>Describe what you're looking for</strong> in plain language. 
                  AI will analyze the page and find matching elements.
                </span>
              </p>
            </div>

            {/* Description Input */}
            <div className="space-y-2">
              <Textarea
                value={aiDescription}
                onChange={(e) => setAiDescription(e.target.value)}
                placeholder="e.g., The blue submit button at the bottom of the form, the login link in the navigation menu, the search input field..."
                className="min-h-[100px] resize-none"
              />
              <Button
                onClick={aiSearch}
                disabled={isAiSearching || !aiDescription.trim()}
                className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
              >
                {isAiSearching ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Searching...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Find with AI
                  </>
                )}
              </Button>
            </div>

            {/* AI Results */}
            {aiResults.length > 0 && (
              <div className="space-y-2 animate-in fade-in slide-in-from-bottom-2">
                <p className="text-xs text-muted-foreground">AI Found:</p>
                {aiResults.map((result, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-3 p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg"
                  >
                    <div className="flex-1">
                      <p className="text-sm font-mono">{result.selector}</p>
                      <p className="text-xs text-muted-foreground">{result.reason}</p>
                    </div>
                    <Badge className="bg-emerald-500/20 text-emerald-400">
                      {Math.round(result.confidence * 100)}% confident
                    </Badge>
                    <Button
                      size="sm"
                      onClick={() => {
                        setSelectedSelector(result.selector);
                        toast.success('Selector selected');
                      }}
                    >
                      Use This
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {/* Tips */}
            <div className="bg-secondary/30 rounded-lg p-3">
              <p className="text-xs font-medium text-muted-foreground mb-2">💡 Tips for better results:</p>
              <ul className="text-xs text-muted-foreground space-y-1 ml-4 list-disc">
                <li>Mention colors, position, or nearby text</li>
                <li>Describe what the element does</li>
                <li>Include any visible labels</li>
                <li>Specify if it's a button, link, input, etc.</li>
              </ul>
            </div>
          </div>
        );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-foreground flex items-center gap-2">
            <RefreshCw className="h-5 w-5 text-blue-400" />
            Fix Failed Step
          </DialogTitle>
          {action && (
            <p className="text-sm text-muted-foreground">
              Step {actionIndex + 1}: {action.type || action.qword} "{action.text || action.label || action.description}"
            </p>
          )}
        </DialogHeader>

        {/* Tabs */}
        <div className="flex gap-1 p-1 bg-secondary/50 rounded-lg">
          <button
            onClick={() => setActiveTab('manual')}
            className={cn(
              'flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors',
              activeTab === 'manual'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <Type className="h-4 w-4" />
            Manual
          </button>
          <button
            onClick={() => setActiveTab('picker')}
            className={cn(
              'flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors',
              activeTab === 'picker'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
              !browserAvailable && 'opacity-50'
            )}
          >
            <MousePointer2 className="h-4 w-4" />
            Pick
          </button>
          <button
            onClick={() => setActiveTab('debug')}
            className={cn(
              'flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors',
              activeTab === 'debug'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
              !browserAvailable && 'opacity-50'
            )}
          >
            <Bug className="h-4 w-4" />
            Debug
          </button>
          <button
            onClick={() => setActiveTab('ai')}
            className={cn(
              'flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors',
              activeTab === 'ai'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
              !browserAvailable && 'opacity-50'
            )}
          >
            <Sparkles className="h-4 w-4" />
            AI
          </button>
        </div>

        {/* Tab Content */}
        <div className="py-4 max-h-[60vh] overflow-y-auto">
          {renderTabContent()}
        </div>

        {/* Footer */}
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          {browserAvailable && selectedSelector && (
            <Button
              onClick={() => testSelector(selectedSelector)}
              variant="outline"
              className="border-blue-500/50 text-blue-400 hover:bg-blue-500/10"
            >
              <Play className="h-4 w-4 mr-2" />
              Test
            </Button>
          )}
          <Button
            onClick={handleSave}
            disabled={!selectedSelector && !manualTextOverride && !pickedElement}
            className="bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700"
          >
            <CheckCircle2 className="h-4 w-4 mr-2" />
            Save Fix
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
