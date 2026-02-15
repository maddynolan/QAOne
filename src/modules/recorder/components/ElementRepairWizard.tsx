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
  Type,
  RotateCcw,
  SkipForward,
  MonitorPlay,
  X as CloseIcon
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { autoFixStep, type AutoFixResult } from '@/modules/recorder/lib/aiEnhancements';

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

interface FailureState {
  stepIndex: number;
  step: any;
  error: string;
  screenshot: string | null;
  url: string | null;
}

interface ElementRepairWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  action: RecordedAction | null;
  actionIndex: number;
  onSave: (updates: { manualSelector?: string; manualText?: string }) => void;
  // NEW: Enhanced repair capabilities
  failureState?: FailureState | null;
  browserKeptOpen?: boolean;
  onReopenBrowser?: () => Promise<{ success: boolean; error?: string }>;
  onRetryStep?: (updates: { manualSelector?: string; manualText?: string }) => Promise<{ success: boolean; error?: string; message?: string }>;
  onResumeFromHere?: (options?: { skipFailedStep?: boolean; updatedSteps?: any[] }) => Promise<{ success: boolean; error?: string }>;
  onCloseBrowser?: () => Promise<{ success: boolean }>;
}

// Tab type
type TabType = 'picker' | 'debug' | 'ai' | 'manual';

export default function ElementRepairWizard({
  open,
  onOpenChange,
  action,
  actionIndex,
  onSave,
  // NEW props
  failureState,
  browserKeptOpen = false,
  onReopenBrowser,
  onRetryStep,
  onResumeFromHere,
  onCloseBrowser
}: ElementRepairWizardProps) {
  const [activeTab, setActiveTab] = useState<TabType>('manual'); // Start with manual when browser might not be open
  const [isLoading, setIsLoading] = useState(false);
  
  // Element Picker state
  const [isPicking, setIsPicking] = useState(false);
  const [pickedElement, setPickedElement] = useState<ElementInfo | null>(null);
  const [selectedSelector, setSelectedSelector] = useState<string>('');
  const [manualTextOverride, setManualTextOverride] = useState<string>(''); // For text-based matching
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  
  // NEW: Selector type selection (css, xpath, text, aria, ocr, coords, image)
  const [selectorType, setSelectorType] = useState<'css' | 'xpath' | 'text' | 'aria' | 'ocr' | 'coords' | 'image'>('css');
  const [showFallbackStrategies, setShowFallbackStrategies] = useState(false);
  
  // Debug state
  const [debugInfo, setDebugInfo] = useState<DebugInfo | null>(null);
  const [fixSuggestions, setFixSuggestions] = useState<FixSuggestion[]>([]);
  
  // AI state
  const [aiDescription, setAiDescription] = useState('');
  const [aiResults, setAiResults] = useState<Array<{ selector: string; confidence: number; reason: string }>>([]);
  const [isAiSearching, setIsAiSearching] = useState(false);
  
  // Browser availability check
  const [browserAvailable, setBrowserAvailable] = useState(false);
  
  // NEW: Retry/Resume state
  const [isRetrying, setIsRetrying] = useState(false);
  const [retryResult, setRetryResult] = useState<{ success: boolean; message: string } | null>(null);
  const [isReopening, setIsReopening] = useState(false);
  const [isResuming, setIsResuming] = useState(false);

  // Auto-Fix with AI state
  const [isAutoFixing, setIsAutoFixing] = useState(false);
  const [autoFixResult, setAutoFixResult] = useState<AutoFixResult | null>(null);
  const [autoFixProgress, setAutoFixProgress] = useState<string>('');

  // Get flowstral API
  const flowstral = (window as any).flowstral;
  
  // Check if browser is available
  useEffect(() => {
    const checkBrowser = async () => {
      try {
        // First check if browser was kept open after failure
        if (browserKeptOpen) {
          setBrowserAvailable(true);
          return;
        }
        // Then check via IPC
        if (flowstral?.playwrightRecorder?.isBrowserOpen) {
          const result = await flowstral.playwrightRecorder.isBrowserOpen();
          setBrowserAvailable(result?.open || false);
        } else if (flowstral?.elementPicker) {
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
  }, [open, flowstral, browserKeptOpen]);
  
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
      setAutoFixResult(null);
      setAutoFixProgress('');
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

  // Test a selector (supports multiple types)
  const testSelector = async (selector: string) => {
    if (!flowstral?.elementPicker || !selector) return;

    setTestResult(null);
    
    try {
      // Convert selector based on type for testing
      let testableSelector = selector;
      let message = '';
      
      switch (selectorType) {
        case 'xpath':
          // XPath is passed directly to test (Playwright supports it)
          testableSelector = `xpath=${selector}`;
          break;
        case 'text':
          // Convert to text selector
          testableSelector = `text=${selector}`;
          break;
        case 'aria':
          // Convert to aria-label selector
          testableSelector = `[aria-label*="${selector}" i]`;
          break;
        case 'coords':
          // Coordinates can't be tested via selector
          const coords = selector.split(',').map(s => parseInt(s.trim()));
          if (coords.length === 2 && !isNaN(coords[0]) && !isNaN(coords[1])) {
            setTestResult({
              success: true,
              message: `Coordinates (${coords[0]}, ${coords[1]}) will be clicked directly`
            });
            return;
          } else {
            setTestResult({
              success: false,
              message: 'Invalid coordinates. Use format: x,y (e.g., 150,300)'
            });
            return;
          }
        case 'ocr':
          // OCR text will be searched visually
          setTestResult({
            success: true,
            message: `OCR will search for visible text: "${selector}"`
          });
          return;
        case 'image':
          setTestResult({
            success: true,
            message: 'Image template matching configured'
          });
          return;
        default:
          // CSS selector as-is
          testableSelector = selector;
      }
      
      const result = await flowstral.elementPicker.testSelector(testableSelector);
      setTestResult({
        success: result.success,
        message: result.message || (result.success ? `Found ${result.count || 1} element(s)` : 'Element not found')
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

  // NEW: Re-open browser to failed state
  const handleReopenBrowser = async () => {
    if (!onReopenBrowser) {
      // Fallback to flowstral API
      if (flowstral?.playwrightRecorder?.reopenToFailure) {
        setIsReopening(true);
        try {
          const result = await flowstral.playwrightRecorder.reopenToFailure();
          if (result?.success) {
            setBrowserAvailable(true);
            toast.success('✅ Browser re-opened to failed state!');
          } else {
            toast.error(result?.error || 'Failed to re-open browser');
          }
        } catch (e: any) {
          toast.error(e.message || 'Failed to re-open browser');
        } finally {
          setIsReopening(false);
        }
      }
      return;
    }
    
    setIsReopening(true);
    try {
      const result = await onReopenBrowser();
      if (result?.success) {
        setBrowserAvailable(true);
        toast.success('✅ Browser re-opened to failed state!');
      } else {
        toast.error(result?.error || 'Failed to re-open browser');
      }
    } catch (e: any) {
      toast.error(e.message || 'Failed to re-open browser');
    } finally {
      setIsReopening(false);
    }
  };
  
  // NEW: Retry the failed step with current edits
  const handleRetryStep = async () => {
    const updates = {
      manualSelector: selectedSelector || undefined,
      manualText: manualTextOverride || pickedElement?.text || undefined
    };
    
    setIsRetrying(true);
    setRetryResult(null);
    
    try {
      let result;
      if (onRetryStep) {
        result = await onRetryStep(updates);
      } else if (flowstral?.playwrightRecorder?.retryFailedStep) {
        result = await flowstral.playwrightRecorder.retryFailedStep(updates);
      } else {
        throw new Error('Retry function not available');
      }
      
      if (result?.success) {
        setRetryResult({ success: true, message: result.message || 'Step executed successfully!' });
        toast.success('✅ Step retry succeeded!');
      } else {
        setRetryResult({ success: false, message: result?.error || 'Step failed' });
        toast.error(`❌ Step retry failed: ${result?.error || 'Unknown error'}`);
      }
    } catch (e: any) {
      setRetryResult({ success: false, message: e.message || 'Retry failed' });
      toast.error(e.message || 'Retry failed');
    } finally {
      setIsRetrying(false);
    }
  };
  
  // NEW: Resume test from this step (or skip it)
  const handleResume = async (skipFailedStep: boolean = false) => {
    setIsResuming(true);
    
    try {
      let result;
      if (onResumeFromHere) {
        result = await onResumeFromHere({ skipFailedStep });
      } else if (flowstral?.playwrightRecorder?.resumeFromFailure) {
        result = await flowstral.playwrightRecorder.resumeFromFailure({ skipFailedStep });
      } else {
        throw new Error('Resume function not available');
      }
      
      if (result?.success) {
        toast.success('✅ Test resumed and completed!');
        onOpenChange(false);
      } else {
        toast.error(`Test failed at another step: ${result?.error || 'Unknown error'}`);
      }
    } catch (e: any) {
      toast.error(e.message || 'Resume failed');
    } finally {
      setIsResuming(false);
    }
  };
  
  // NEW: Close browser manually
  const handleCloseBrowser = async () => {
    try {
      if (onCloseBrowser) {
        await onCloseBrowser();
      } else if (flowstral?.playwrightRecorder?.closeBrowser) {
        await flowstral.playwrightRecorder.closeBrowser();
      }
      setBrowserAvailable(false);
      toast.success('Browser closed');
    } catch (e: any) {
      toast.error(e.message || 'Failed to close browser');
    }
  };

  // Auto-Fix with AI — calls the healing orchestrator backend
  const handleAutoFix = async () => {
    if (!action || actionIndex === undefined) return;

    setIsAutoFixing(true);
    setAutoFixResult(null);
    setAutoFixProgress('Starting AI healing chain...');

    try {
      const failedSelector = action.manualSelector || action.selectorObj?.selector || action.selector || '';
      const errorMessage = failureState?.error || 'Element not found';

      // Extract screenshot base64 (strip data:image prefix if present)
      let screenshotB64: string | null = null;
      if (failureState?.screenshot) {
        screenshotB64 = failureState.screenshot.replace(/^data:image\/[a-z]+;base64,/, '');
      }

      setAutoFixProgress('Layer 1: Checking knowledge base...');

      const result = await autoFixStep({
        test_id: `recording_${Date.now()}`,
        step_id: `step_${actionIndex}`,
        step_index: actionIndex,
        step_label: action.text || action.label || action.description || `Step ${actionIndex + 1}`,
        failed_selector: failedSelector,
        error_message: errorMessage,
        step_info: {
          type: action.type || action.qword,
          text: action.text,
          label: action.label,
          selector: failedSelector,
        },
        screenshot_b64: screenshotB64,
        page_url: failureState?.url || undefined,
      });

      setAutoFixResult(result);

      if (result.success && result.fixed_selector) {
        // Auto-apply the healed selector
        setSelectedSelector(result.fixed_selector);
        setSelectorType('css');
        setAutoFixProgress(`Fixed using ${result.strategy_used || 'AI'} (${Math.round(result.confidence * 100)}% confidence)`);
        toast.success(`AI found a fix: ${result.strategy_used || 'healed selector'}`);
      } else {
        setAutoFixProgress(result.message || 'AI could not find a fix — try manual repair below');
        toast.info('AI healing tried all layers — use manual repair');
      }
    } catch (e: any) {
      setAutoFixProgress('AI auto-fix unavailable');
      toast.error(e.message || 'Auto-fix failed');
    } finally {
      setIsAutoFixing(false);
    }
  };

  // Save the fix
  const handleSave = () => {
    // Allow saving if we have selector, text override, or picked element
    if (!selectedSelector && !manualTextOverride && !pickedElement?.text) {
      toast.error('Please enter a selector or text to match');
      return;
    }

    // Build the selector based on type
    let finalSelector = selectedSelector;
    if (selectedSelector) {
      switch (selectorType) {
        case 'xpath':
          finalSelector = `xpath=${selectedSelector}`;
          break;
        case 'text':
          // For text type, store in manualText instead
          if (!manualTextOverride) {
            onSave({
              manualText: selectedSelector
            });
            return;
          }
          finalSelector = `text=${selectedSelector}`;
          break;
        case 'aria':
          finalSelector = `[aria-label*="${selectedSelector}" i]`;
          break;
        case 'coords':
          // Store coordinates for special handling
          finalSelector = `coords:${selectedSelector}`;
          break;
        case 'ocr':
          // Store OCR text for special handling  
          finalSelector = `ocr:${selectedSelector}`;
          break;
        case 'image':
          // Store image template path
          finalSelector = `image:${selectedSelector}`;
          break;
        default:
          // CSS selector as-is
          finalSelector = selectedSelector;
      }
    }

    onSave({
      manualSelector: finalSelector || undefined,
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

            {/* Selector Type Selector */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                Selector Type
              </label>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { type: 'css', label: 'CSS', icon: '#', hint: 'data-testid, class, id' },
                  { type: 'xpath', label: 'XPath', icon: '/', hint: '//button[@name]' },
                  { type: 'text', label: 'Text', icon: 'T', hint: 'Exact text match' },
                  { type: 'aria', label: 'Aria', icon: '♿', hint: 'aria-label' },
                ].map(({ type, label, icon, hint }) => (
                  <button
                    key={type}
                    onClick={() => setSelectorType(type as any)}
                    className={cn(
                      'flex flex-col items-center p-2 rounded-lg border text-xs transition-colors',
                      selectorType === type
                        ? 'bg-blue-500/20 border-blue-500 text-blue-400'
                        : 'bg-card/50 border-border hover:border-blue-500/50'
                    )}
                  >
                    <span className="font-mono text-lg mb-1">{icon}</span>
                    <span className="font-medium">{label}</span>
                    <span className="text-[10px] text-muted-foreground">{hint}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Selector Input based on type */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                {selectorType === 'css' && 'CSS Selector'}
                {selectorType === 'xpath' && 'XPath Expression'}
                {selectorType === 'text' && 'Text to Find'}
                {selectorType === 'aria' && 'Aria Label'}
              </label>
              <Input
                value={selectedSelector}
                onChange={(e) => setSelectedSelector(e.target.value)}
                placeholder={
                  selectorType === 'css' ? 'e.g., #submit-btn, [data-testid="submit"], button.primary' :
                  selectorType === 'xpath' ? 'e.g., //button[@type="submit"], //a[contains(text(), "Click")]' :
                  selectorType === 'text' ? 'e.g., Submit, Click Here, Login' :
                  'e.g., Submit form, Close dialog, Search'
                }
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                {selectorType === 'css' && 'Standard CSS selector for precise element matching'}
                {selectorType === 'xpath' && 'XPath for complex element paths (//tag[@attr="value"])'}
                {selectorType === 'text' && 'Find element by visible text content'}
                {selectorType === 'aria' && 'Find by accessibility label (best for buttons/links)'}
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
                Test {selectorType.toUpperCase()} Selector in Browser
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

            {/* Fallback Strategies Accordion */}
            <div className="border border-border rounded-lg overflow-hidden">
              <button
                onClick={() => setShowFallbackStrategies(!showFallbackStrategies)}
                className="w-full flex items-center justify-between p-3 bg-secondary/30 hover:bg-secondary/50 transition-colors"
              >
                <span className="text-sm font-medium flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-amber-400" />
                  Advanced Fallback Strategies
                </span>
                <ChevronRight className={cn('h-4 w-4 transition-transform', showFallbackStrategies && 'rotate-90')} />
              </button>
              {showFallbackStrategies && (
                <div className="p-3 space-y-3 bg-card/50">
                  <p className="text-xs text-muted-foreground">
                    Use these as last resort when standard selectors don't work:
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      onClick={() => {
                        setSelectorType('ocr');
                        toast.info('OCR requires typing the exact visible text');
                      }}
                      className="flex flex-col items-center p-2 rounded-lg border border-border hover:border-amber-500/50 text-xs"
                    >
                      <Eye className="h-5 w-5 mb-1 text-amber-400" />
                      <span className="font-medium">OCR Text</span>
                      <span className="text-[10px] text-muted-foreground">Visual text</span>
                    </button>
                    <button
                      onClick={() => {
                        setSelectorType('coords');
                        toast.info('Coordinates are fragile - use as last resort');
                      }}
                      className="flex flex-col items-center p-2 rounded-lg border border-border hover:border-red-500/50 text-xs"
                    >
                      <MousePointer2 className="h-5 w-5 mb-1 text-red-400" />
                      <span className="font-medium">Coordinates</span>
                      <span className="text-[10px] text-muted-foreground">X, Y position</span>
                    </button>
                    <button
                      onClick={() => {
                        setSelectorType('image');
                        toast.info('Image matching requires a template screenshot');
                      }}
                      className="flex flex-col items-center p-2 rounded-lg border border-border hover:border-purple-500/50 text-xs"
                    >
                      <ImageIcon className="h-5 w-5 mb-1 text-purple-400" />
                      <span className="font-medium">Image Match</span>
                      <span className="text-[10px] text-muted-foreground">Visual template</span>
                    </button>
                  </div>
                  {selectorType === 'coords' && (
                    <div className="bg-red-500/10 border border-red-500/30 rounded p-2">
                      <p className="text-xs text-red-400">
                        ⚠️ Coordinates break when window size changes. Only use if nothing else works.
                        Enter as: <code className="bg-background px-1 rounded">x,y</code> (e.g., 150,300)
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Tips */}
            <div className="bg-secondary/30 rounded-lg p-3">
              <p className="text-xs font-medium text-muted-foreground mb-2">💡 Selector Reliability (best → worst):</p>
              <ol className="text-xs text-muted-foreground space-y-1 ml-4 list-decimal">
                <li><strong>data-testid</strong> - Most stable, never changes</li>
                <li><strong>aria-label</strong> - Good for accessible elements</li>
                <li><strong>ID</strong> - Stable if unique</li>
                <li><strong>Text content</strong> - Works if text is unique</li>
                <li><strong>CSS class</strong> - Can change with UI updates</li>
                <li><strong>XPath</strong> - Powerful but fragile</li>
                <li><strong>Coordinates</strong> - Last resort only</li>
              </ol>
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

        {/* Auto-Fix with AI — prominent CTA above tabs */}
        <div className="relative">
          {!autoFixResult?.success && (
            <Button
              onClick={handleAutoFix}
              disabled={isAutoFixing || !action}
              className={cn(
                'w-full h-auto py-3 text-sm font-medium',
                'bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700',
                'disabled:opacity-50'
              )}
            >
              {isAutoFixing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {autoFixProgress || 'Running AI healing chain...'}
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Auto-Fix with AI
                </>
              )}
            </Button>
          )}

          {/* Auto-Fix Result */}
          {autoFixResult && (
            <div className={cn(
              'rounded-lg p-3 text-sm border',
              autoFixResult.success
                ? 'bg-emerald-500/10 border-emerald-500/30'
                : 'bg-amber-500/10 border-amber-500/30'
            )}>
              <div className="flex items-start gap-2">
                {autoFixResult.success ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-400 mt-0.5 shrink-0" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-amber-400 mt-0.5 shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className={autoFixResult.success ? 'text-emerald-400 font-medium' : 'text-amber-400 font-medium'}>
                    {autoFixResult.success ? 'AI Fixed!' : 'AI could not auto-fix'}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {autoFixProgress}
                  </p>
                  {/* Show what was tried */}
                  {autoFixResult.attempts && autoFixResult.attempts.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {autoFixResult.attempts.map((attempt, i) => (
                        <div key={i} className="flex items-center gap-2 text-xs">
                          {attempt.success ? (
                            <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                          ) : (
                            <XCircle className="h-3 w-3 text-red-400/60" />
                          )}
                          <span className="text-muted-foreground">
                            {attempt.strategy}: {attempt.success ? attempt.selector : 'no match'}
                          </span>
                          <span className="text-muted-foreground/50 ml-auto">
                            {attempt.duration_ms}ms
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                  {autoFixResult.success && autoFixResult.fixed_selector && (
                    <div className="mt-2 flex items-center gap-2">
                      <code className="text-xs bg-background/50 px-2 py-1 rounded text-emerald-300 truncate">
                        {autoFixResult.fixed_selector}
                      </code>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2"
                        onClick={() => copySelector(autoFixResult.fixed_selector!)}
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                  {!autoFixResult.success && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Use the manual tabs below to fix this step.
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

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

        {/* Browser Status Banner */}
        {!browserAvailable && failureState && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 mb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-amber-400" />
                <div>
                  <p className="text-sm font-medium text-amber-400">Browser Closed</p>
                  <p className="text-xs text-amber-400/80">Re-open to use Pick, Debug, and AI features</p>
                </div>
              </div>
              <Button
                onClick={handleReopenBrowser}
                disabled={isReopening}
                size="sm"
                className="bg-amber-500 hover:bg-amber-600 text-black"
              >
                {isReopening ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <MonitorPlay className="h-4 w-4 mr-1" />
                )}
                Re-open Browser
              </Button>
            </div>
          </div>
        )}
        
        {/* Browser Open Indicator */}
        {browserAvailable && (
          <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-2 mb-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              <span className="text-sm text-emerald-400">Browser open - All features available</span>
            </div>
            <Button
              onClick={handleCloseBrowser}
              size="sm"
              variant="ghost"
              className="h-6 text-xs text-muted-foreground hover:text-foreground"
            >
              <CloseIcon className="h-3 w-3 mr-1" />
              Close
            </Button>
          </div>
        )}
        
        {/* Failure Screenshot (if available) */}
        {failureState?.screenshot && activeTab === 'manual' && (
          <div className="mb-2">
            <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
              <ImageIcon className="h-3 w-3" /> Screenshot at failure
            </p>
            <div className="rounded-lg overflow-hidden border border-border max-h-32">
              <img 
                src={failureState.screenshot} 
                alt="Failure screenshot" 
                className="w-full h-auto object-contain bg-black"
              />
            </div>
          </div>
        )}

        {/* Tab Content */}
        <div className="py-4 max-h-[50vh] overflow-y-auto">
          {renderTabContent()}
        </div>
        
        {/* Retry Result */}
        {retryResult && (
          <div className={cn(
            'flex items-center gap-2 p-2 rounded-lg text-sm mb-2',
            retryResult.success ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
          )}>
            {retryResult.success ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
            {retryResult.message}
          </div>
        )}

        {/* Footer with enhanced actions */}
        <DialogFooter className="flex-col sm:flex-row gap-2">
          {/* Left side: Close/Cancel */}
          <div className="flex gap-2 flex-1">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
          </div>
          
          {/* Right side: Actions */}
          <div className="flex gap-2 flex-wrap justify-end">
            {/* Test Selector (if browser available) */}
            {browserAvailable && selectedSelector && (
              <Button
                onClick={() => testSelector(selectedSelector)}
                variant="outline"
                size="sm"
                className="border-blue-500/50 text-blue-400 hover:bg-blue-500/10"
              >
                <Play className="h-4 w-4 mr-1" />
                Test
              </Button>
            )}
            
            {/* Retry Step (if browser available and we have a fix) */}
            {browserAvailable && (selectedSelector || manualTextOverride) && (
              <Button
                onClick={handleRetryStep}
                disabled={isRetrying}
                variant="outline"
                size="sm"
                className="border-purple-500/50 text-purple-400 hover:bg-purple-500/10"
              >
                {isRetrying ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <RotateCcw className="h-4 w-4 mr-1" />
                )}
                Retry Step
              </Button>
            )}
            
            {/* Resume from Here (if browser available and retry succeeded) */}
            {browserAvailable && retryResult?.success && (
              <>
                <Button
                  onClick={() => handleResume(false)}
                  disabled={isResuming}
                  size="sm"
                  className="bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-600 hover:to-cyan-700"
                >
                  {isResuming ? (
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  ) : (
                    <Play className="h-4 w-4 mr-1" />
                  )}
                  Continue Test
                </Button>
              </>
            )}
            
            {/* Skip & Continue (alternative if they want to skip this step) */}
            {browserAvailable && failureState && !retryResult?.success && (
              <Button
                onClick={() => handleResume(true)}
                disabled={isResuming}
                variant="outline"
                size="sm"
                className="border-gray-500/50 text-gray-400 hover:bg-gray-500/10"
              >
                <SkipForward className="h-4 w-4 mr-1" />
                Skip & Continue
              </Button>
            )}
            
            {/* Save Fix */}
            <Button
              onClick={handleSave}
              disabled={!selectedSelector && !manualTextOverride && !pickedElement}
              className="bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700"
            >
              <CheckCircle2 className="h-4 w-4 mr-1" />
              Save Fix
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
