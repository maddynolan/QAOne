/**
 * Simple Step Editor - B+C Hybrid
 * 
 * Option B: "Click the correct element in the browser" - instant re-record
 * Option C: Visual Selector Cards - show similar elements as clickable options
 * 
 * Key principles:
 * 1. Click in browser OR click a card → immediately saves (no extra button)
 * 2. Show failed screenshot with context
 * 3. Show similar elements as cards when available
 * 4. Skip as fallback
 * 
 * @author Flowstral
 * @version 3.0.0 - B+C Hybrid
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { 
  Loader2,
  CheckCircle2,
  XCircle,
  Crosshair,
  Image as ImageIcon,
  AlertTriangle,
  SkipForward,
  MousePointer2,
  Eye,
  Target,
  ChevronRight,
  Zap,
  RefreshCw
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

// Similar element detected on the page (for Option C cards)
interface SimilarElement {
  id: string;
  text: string;
  selector: string;
  thumbnail?: string; // Base64 mini-screenshot of the element
  confidence?: number; // How likely this is what user wanted
  type?: string; // checkbox, button, link, etc.
}

interface SimpleStepEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  step: {
    type?: string;
    qword?: string;
    text?: string;
    label?: string;
    description?: string;
    selector?: string;
    manualText?: string;  // Previously saved manual text
    manualSelector?: string; // Previously saved selector
  } | null;
  stepIndex: number;
  failureScreenshot?: string | null;
  failureError?: string;
  browserOpen?: boolean;
  // Similar elements detected on the page (for Option C)
  similarElements?: SimilarElement[];
  // Smart overlay suggestions from browser
  overlaySuggestions?: Array<{ text: string; selector: string; type: string }>;
  // Called when user picks an element (from browser click or card)
  onElementPicked: (element: { text?: string; selector?: string; selectorType?: string }) => void;
  // Called when user skips
  onSkip?: () => void;
  // Called to start browser picker
  onStartPicker?: () => Promise<{ success: boolean; text?: string; selector?: string; error?: string; cancelled?: boolean }>;
}

export default function SimpleStepEditor({
  open,
  onOpenChange,
  step,
  stepIndex,
  failureScreenshot,
  failureError,
  browserOpen = false,
  similarElements = [],
  overlaySuggestions = [],
  onElementPicked,
  onSkip,
  onStartPicker
}: SimpleStepEditorProps) {
  // === STATE ===
  const [isPicking, setIsPicking] = useState(false);
  const [pickSuccess, setPickSuccess] = useState(false);
  
  // Manual input state - pre-populated from step data
  const [manualText, setManualText] = useState('');
  const [selectorType, setSelectorType] = useState<'text' | 'css' | 'xpath' | 'aria' | 'ocr' | 'coords' | 'image'>('text');
  const [manualSelector, setManualSelector] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [exactMatch, setExactMatch] = useState(true); // Require exact text match
  const [showFallbackStrategies, setShowFallbackStrategies] = useState(false);

  // Get flowstral API
  const flowstral = (window as any).flowstral;
  
  // Helper to extract aria-label value from selector
  const extractAriaValue = (selector: string): string => {
    const match = selector.match(/\[aria-label[*]?=["']([^"']+)["']/);
    return match ? match[1] : '';
  };
  
  // Helper to get placeholder text for selector type
  const getSelectorPlaceholder = (type: string): string => {
    switch (type) {
      case 'css': return '#submit-btn, .btn-primary, [data-testid="login"]';
      case 'xpath': return '//button[text()="Submit"], //a[@href="/login"]';
      case 'aria': return 'Categories, Submit, Close Modal';
      default: return '';
    }
  };
  
  // Generate live preview of final selector
  const getFinalSelectorPreview = useCallback((): string => {
    const text = manualText.trim();
    const selector = manualSelector.trim();
    
    switch (selectorType) {
      case 'text':
        return text ? (exactMatch ? `text="${text}"` : `text=${text}`) : '';
      case 'css':
        return selector || '';
      case 'xpath':
        return selector ? (selector.startsWith('xpath=') ? selector : `xpath=${selector}`) : '';
      case 'aria':
        const ariaVal = selector || text;
        return ariaVal ? (exactMatch ? `[aria-label="${ariaVal}"]` : `[aria-label*="${ariaVal}" i]`) : '';
      case 'ocr':
        return selector || text ? `ocr:${selector || text}` : '';
      case 'coords':
        return selector ? `coords:${selector}` : '';
      default:
        return '';
    }
  }, [selectorType, manualText, manualSelector, exactMatch]);
  
  // Pre-populate manual fields when dialog opens
  useEffect(() => {
    if (open && step) {
      // Pre-populate manual text from existing step data
      const existingText = step.manualText || step.text || step.label || '';
      setManualText(existingText);
      
      // Pre-populate selector if available
      const existingSelector = step.manualSelector || step.selector || '';
      
      // Detect selector type from format and set appropriate values
      if (existingSelector.startsWith('xpath=')) {
        setSelectorType('xpath');
        setManualSelector(existingSelector.substring(6)); // Strip xpath= prefix
      } else if (existingSelector.startsWith('text=')) {
        setSelectorType('text');
        // For text type, we use manualText, not manualSelector
        const textVal = existingSelector.replace(/^text=["']?|["']?$/g, '');
        setManualText(textVal || existingText);
        setManualSelector('');
      } else if (existingSelector.includes('[aria-label')) {
        setSelectorType('aria');
        // Extract the aria-label value
        const ariaVal = extractAriaValue(existingSelector);
        setManualSelector(ariaVal || existingText);
      } else if (existingSelector.startsWith('ocr:')) {
        setSelectorType('ocr');
        setManualSelector(existingSelector.substring(4));
      } else if (existingSelector.startsWith('coords:')) {
        setSelectorType('coords');
        setManualSelector(existingSelector.substring(7));
      } else if (existingSelector) {
        // Default to CSS
        setSelectorType('css');
        setManualSelector(existingSelector);
      } else {
        // No selector, default to text with element text
        setSelectorType('text');
        setManualSelector('');
      }
      
      console.log('[SimpleStepEditor] Pre-populated:', { existingText, existingSelector, detectedType: selectorType });
    }
  }, [open, step]);
  
  // When selector type changes, reset selector field appropriately
  const handleSelectorTypeChange = useCallback((newType: typeof selectorType) => {
    const prevType = selectorType;
    setSelectorType(newType);
    
    // If switching to text type, clear selector (text type uses manualText)
    if (newType === 'text') {
      setManualSelector('');
      // If we had an aria label, use it as text
      if (prevType === 'aria' && manualSelector) {
        setManualText(manualSelector);
      }
    } 
    // If switching from text to aria, copy text to selector
    else if (prevType === 'text' && newType === 'aria' && manualText && !manualSelector) {
      setManualSelector(manualText);
    }
    // If switching to CSS/XPath from aria, format properly
    else if ((newType === 'css' || newType === 'xpath') && prevType === 'aria') {
      // Keep the selector as-is for manual editing
    }
  }, [selectorType, manualText, manualSelector]);

  // Reset state when dialog opens + debug logging
  useEffect(() => {
    if (open) {
      setIsPicking(false);
      setPickSuccess(false);
      // Debug: Log the state when dialog opens
      console.log('[SimpleStepEditor] Dialog opened with:', {
        browserOpen,
        step,
        stepIndex,
        similarElementsCount: similarElements?.length || 0,
        hasFailureScreenshot: !!failureScreenshot,
        hasOnStartPicker: !!onStartPicker,
        hasFlowstralPicker: !!(window as any).flowstral?.elementPicker?.start
      });
    }
  }, [open, browserOpen, step, stepIndex, similarElements, failureScreenshot, onStartPicker]);

  // === OPTION B: Click in Browser ===
  const handleStartPicker = useCallback(async () => {
    console.log('[SimpleStepEditor] Pick Element clicked. browserOpen:', browserOpen);
    
    if (!browserOpen) {
      toast.error('Browser not open. Run test with "Keep Browser Open on Failure" enabled first.');
      return;
    }

    setIsPicking(true);
    toast.info('🎯 Click on the correct element in the browser window', { duration: 10000 });

    try {
      let result;
      
      // Try multiple approaches to start the picker
      if (onStartPicker) {
        console.log('[SimpleStepEditor] Using onStartPicker callback');
        result = await onStartPicker();
      } else if (flowstral?.elementPicker?.start) {
        console.log('[SimpleStepEditor] Using flowstral.elementPicker.start()');
        result = await flowstral.elementPicker.start();
      } else if (flowstral?.playwrightRecorder?.startElementPicker) {
        console.log('[SimpleStepEditor] Using flowstral.playwrightRecorder.startElementPicker()');
        result = await flowstral.playwrightRecorder.startElementPicker();
      } else {
        console.error('[SimpleStepEditor] No picker method available!');
        toast.error('Element picker not available. Check console for details.');
        return;
      }

      console.log('[SimpleStepEditor] Picker result:', result);

      if (result?.success && (result.text || result.selector)) {
        // Immediately save - no extra button!
        setPickSuccess(true);
        onElementPicked({ text: result.text, selector: result.selector });
        toast.success('✅ Step fixed!');
        
        // Close dialog after brief success message
        setTimeout(() => {
          onOpenChange(false);
        }, 1000);
      } else if (result?.cancelled) {
        toast.info('Picking cancelled (pressed ESC)');
      } else {
        const errorMsg = result?.error || 'No element captured. Click on an element in the browser.';
        console.error('[SimpleStepEditor] Picker failed:', errorMsg);
        toast.error(errorMsg);
      }
    } catch (e: any) {
      console.error('[SimpleStepEditor] Picker exception:', e);
      toast.error(e.message || 'Picker failed unexpectedly');
    } finally {
      setIsPicking(false);
    }
  }, [browserOpen, onStartPicker, flowstral, onElementPicked, onOpenChange]);

  // === OPTION C: Click a Card ===
  const handleCardClick = useCallback((element: SimilarElement) => {
    // Immediately save - no extra button!
    setPickSuccess(true);
    onElementPicked({ text: element.text, selector: element.selector });
    toast.success(`✅ Using "${element.text}" - Step fixed!`);
    
    // Close dialog after brief success message
    setTimeout(() => {
      onOpenChange(false);
    }, 1000);
  }, [onElementPicked, onOpenChange]);

  // === Skip ===
  const handleSkip = useCallback(() => {
    if (onSkip) {
      onSkip();
    }
    toast.info('Step will be skipped');
    onOpenChange(false);
  }, [onSkip, onOpenChange]);

  // === Save Manual Fix ===
  const handleSaveManualFix = useCallback(() => {
    if (!manualText.trim() && !manualSelector.trim()) {
      toast.error('Please enter the text or selector first');
      return;
    }
    
    // Build the final selector based on type and options
    let finalSelector = '';
    let finalText = manualText.trim();
    
    switch (selectorType) {
      case 'text':
        // For text type, use exact match syntax if enabled
        if (exactMatch && finalText) {
          finalSelector = `text="${finalText}"`;  // Exact match
        } else if (finalText) {
          finalSelector = `text=${finalText}`;    // Partial match
        }
        break;
        
      case 'css':
        finalSelector = manualSelector.trim();
        break;
        
      case 'xpath':
        finalSelector = manualSelector.trim().startsWith('xpath=') 
          ? manualSelector.trim()
          : `xpath=${manualSelector.trim()}`;
        break;
        
      case 'aria':
        const ariaVal = manualSelector.trim() || finalText;
        finalSelector = exactMatch
          ? `[aria-label="${ariaVal}"]`
          : `[aria-label*="${ariaVal}" i]`;
        break;
        
      case 'ocr':
        finalSelector = `ocr:${manualSelector.trim() || finalText}`;
        break;
        
      case 'coords':
        const coords = manualSelector.trim();
        if (!/^\d+,\d+$/.test(coords)) {
          toast.error('Invalid coordinates. Use format: x,y (e.g., 150,300)');
          return;
        }
        finalSelector = `coords:${coords}`;
        break;
        
      case 'image':
        toast.info('Image template matching coming soon');
        return;
    }
    
    console.log('[SimpleStepEditor] Saving manual fix:', {
      text: finalText,
      selector: finalSelector,
      selectorType,
      exactMatch
    });
    
    onElementPicked({ 
      text: finalText,
      selector: finalSelector || undefined,
      selectorType
    });
    setPickSuccess(true);
    toast.success(`✅ Step fixed with ${selectorType.toUpperCase()} selector!`);
    setTimeout(() => onOpenChange(false), 1000);
  }, [manualText, manualSelector, selectorType, exactMatch, onElementPicked, onOpenChange]);

  // Get step display text
  const getStepDescription = () => {
    if (!step) return 'Unknown step';
    const action = step.type || step.qword || 'Action';
    const target = step.text || step.label || step.description || '';
    return `${action}: "${target}"`;
  };

  // Check if this might be a "previous step" issue
  const mightBePreviousStepIssue = failureError && stepIndex > 0 && (
    failureError.includes('not found') || 
    failureError.includes('timed out') ||
    failureError.includes('Could not find')
  );

  // Success state
  if (pickSuccess) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md bg-card border-border">
          <div className="flex flex-col items-center justify-center py-8 gap-4">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center">
              <CheckCircle2 className="h-8 w-8 text-emerald-400" />
            </div>
            <p className="text-lg font-medium text-emerald-400">Step Fixed!</p>
            <p className="text-sm text-muted-foreground">The fix will be used on the next run.</p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] bg-card border-border flex flex-col overflow-hidden">
        <DialogHeader className="shrink-0">
          <DialogTitle className="text-lg font-semibold flex items-center gap-2">
            <XCircle className="h-5 w-5 text-red-400" />
            Step {stepIndex + 1} Failed
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 overflow-y-auto pr-2 flex-1 min-h-0">
          {/* What Failed */}
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
            <p className="text-sm text-foreground font-medium">
              {getStepDescription()}
            </p>
            {failureError && (
              <p className="text-xs text-red-400/80 mt-1.5 font-mono">
                {failureError.length > 80 ? failureError.substring(0, 80) + '...' : failureError}
              </p>
            )}
          </div>

          {/* Warning: Previous step might be the issue */}
          {mightBePreviousStepIssue && (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-2.5 flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-400 mt-0.5 shrink-0" />
              <p className="text-xs text-amber-300">
                <span className="font-medium">Tip:</span> Sometimes the issue is actually in Step {stepIndex} 
                (e.g., clicking the wrong button earlier).
              </p>
            </div>
          )}

          {/* Screenshot */}
          {failureScreenshot && (
            <div className="rounded-lg overflow-hidden border border-border">
              <div className="bg-secondary/50 px-3 py-1.5 flex items-center gap-2 text-xs text-muted-foreground">
                <ImageIcon className="h-3 w-3" />
                Page at failure
              </div>
              <img 
                src={failureScreenshot} 
                alt="Failure screenshot" 
                className="w-full h-auto max-h-44 object-contain bg-black cursor-pointer"
                onClick={() => window.open(failureScreenshot, '_blank')}
                title="Click to view full size"
              />
            </div>
          )}

          {/* === OPTION B: Click in Browser === */}
          <div className="space-y-2">
            <p className="text-sm font-medium text-center">
              🎯 Click the correct element in the browser
            </p>
            <Button
              onClick={handleStartPicker}
              disabled={isPicking || !browserOpen}
              size="lg"
              className={cn(
                "w-full h-14 text-base font-medium",
                browserOpen 
                  ? "bg-blue-600 hover:bg-blue-700" 
                  : "bg-muted text-muted-foreground cursor-not-allowed"
              )}
            >
              {isPicking ? (
                <>
                  <Loader2 className="h-5 w-5 mr-3 animate-spin" />
                  Waiting for click...
                </>
              ) : (
                <>
                  <Crosshair className="h-5 w-5 mr-3" />
                  {browserOpen ? 'Pick Element' : 'Browser Not Open'}
                </>
              )}
            </Button>

            {!browserOpen && (
              <div className="text-xs text-amber-400 text-center space-y-1">
                <p>⚠️ Browser is closed. To use Pick Element:</p>
                <ol className="text-left list-decimal list-inside text-amber-300/80">
                  <li>Click the ▼ next to "Run Test"</li>
                  <li>Enable "Keep Browser Open on Failure"</li>
                  <li>Run the test again</li>
                </ol>
                <p className="text-muted-foreground">Or use the manual text entry below.</p>
              </div>
            )}
          </div>

          {/* === OPTION C: Visual Selector Cards === */}
          {similarElements.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">
                Did you mean one of these?
              </p>
              <div className="grid grid-cols-2 gap-2">
                {similarElements.slice(0, 6).map((element) => (
                  <button
                    key={element.id}
                    onClick={() => handleCardClick(element)}
                    className={cn(
                      "p-3 rounded-lg border text-left transition-all",
                      "bg-secondary/30 border-border",
                      "hover:bg-secondary hover:border-blue-500/50",
                      "focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                    )}
                  >
                    {element.thumbnail ? (
                      <img 
                        src={element.thumbnail} 
                        alt={element.text}
                        className="w-full h-12 object-contain rounded mb-2 bg-black/30"
                      />
                    ) : (
                      <div className="w-full h-12 rounded mb-2 bg-secondary/50 flex items-center justify-center">
                        <MousePointer2 className="h-5 w-5 text-muted-foreground" />
                      </div>
                    )}
                    <p className="text-sm font-medium truncate" title={element.text}>
                      {element.text}
                    </p>
                    {element.type && (
                      <p className="text-xs text-muted-foreground capitalize">
                        {element.type}
                      </p>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* No similar elements message - encourage browser pick */}
          {similarElements.length === 0 && browserOpen && (
            <p className="text-xs text-muted-foreground text-center">
              Click "Pick Element" above, then click on the correct element in the browser window.
            </p>
          )}
          
          {/* Manual text entry fallback - always available */}
          <div className="border-t border-border pt-3 mt-3">
            <details className="group" open>
              <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground flex items-center gap-1">
                <span className="group-open:rotate-90 transition-transform">▶</span>
                Can't use picker? Enter text manually
              </summary>
              <div className="mt-2 space-y-3">
                {/* Text Input */}
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={manualText}
                    onChange={(e) => setManualText(e.target.value)}
                    placeholder="Enter the exact text on the element..."
                    className="flex-1 px-3 py-2 text-sm border border-border rounded-md bg-background"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && manualText.trim()) {
                        handleSaveManualFix();
                      }
                    }}
                  />
                  <Button
                    size="sm"
                    onClick={handleSaveManualFix}
                    className="bg-green-600 hover:bg-green-500"
                  >
                    <CheckCircle2 className="h-4 w-4 mr-1" />
                    Save
                  </Button>
                </div>
                
                {/* Exact Match Toggle */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setExactMatch(!exactMatch)}
                    className={cn(
                      'flex items-center gap-1.5 px-2 py-1 text-xs rounded border transition-colors',
                      exactMatch
                        ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400'
                        : 'border-border text-muted-foreground hover:border-amber-500/50'
                    )}
                  >
                    <Target className="h-3 w-3" />
                    {exactMatch ? 'Exact Match' : 'Partial Match'}
                  </button>
                  <span className="text-[10px] text-muted-foreground">
                    {exactMatch 
                      ? 'Will only match elements with this exact text' 
                      : '⚠️ May match similar text (less reliable)'}
                  </span>
                </div>
                
                {/* Standard Selector Types */}
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">Selector Type:</p>
                  <div className="flex flex-wrap gap-1">
                    {([
                      { type: 'text' as const, label: 'Text', icon: 'T', desc: 'Match by visible text' },
                      { type: 'css' as const, label: 'CSS', icon: '#', desc: 'CSS selector' },
                      { type: 'xpath' as const, label: 'XPath', icon: '/', desc: 'XPath expression' },
                      { type: 'aria' as const, label: 'Aria', icon: '♿', desc: 'aria-label attribute' },
                    ]).map(({ type, label, icon, desc }) => (
                      <button
                        key={type}
                        onClick={() => handleSelectorTypeChange(type)}
                        title={desc}
                        className={cn(
                          'px-2.5 py-1.5 text-xs rounded border transition-colors flex items-center gap-1.5',
                          selectorType === type
                            ? 'bg-blue-500/20 border-blue-500 text-blue-400'
                            : 'border-border hover:border-blue-500/50 text-muted-foreground hover:text-foreground'
                        )}
                      >
                        <span className="font-mono text-sm">{icon}</span>
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                
                {/* Selector Input - Different for each type */}
                {selectorType === 'text' ? (
                  // For Text type, the text input above is the main input - no extra field needed
                  <div className="text-xs text-muted-foreground bg-secondary/50 rounded p-2">
                    <span className="font-medium">Preview:</span>{' '}
                    <code className="bg-background px-1 rounded text-blue-400">
                      {getFinalSelectorPreview() || '(enter text above)'}
                    </code>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground shrink-0">
                        {selectorType === 'css' ? 'CSS:' : 
                         selectorType === 'xpath' ? 'XPath:' : 
                         selectorType === 'aria' ? 'Label:' : 'Value:'}
                      </span>
                      <input
                        type="text"
                        value={manualSelector}
                        onChange={(e) => setManualSelector(e.target.value)}
                        placeholder={getSelectorPlaceholder(selectorType)}
                        className="flex-1 px-2 py-1.5 text-xs font-mono border border-border rounded bg-background"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && (manualText.trim() || manualSelector.trim())) {
                            handleSaveManualFix();
                          }
                        }}
                      />
                    </div>
                    {/* Live Preview */}
                    <div className="text-xs text-muted-foreground bg-secondary/50 rounded p-2">
                      <span className="font-medium">Will use:</span>{' '}
                      <code className="bg-background px-1 rounded text-emerald-400 break-all">
                        {getFinalSelectorPreview() || '(enter selector above)'}
                      </code>
                    </div>
                  </div>
                )}
                
                {/* Fallback Strategies Accordion */}
                <div className="border border-border rounded-lg overflow-hidden">
                  <button
                    onClick={() => setShowFallbackStrategies(!showFallbackStrategies)}
                    className="w-full flex items-center justify-between p-2 bg-secondary/30 hover:bg-secondary/50 transition-colors text-xs"
                  >
                    <span className="font-medium flex items-center gap-2">
                      <AlertTriangle className="h-3 w-3 text-amber-400" />
                      Fallback Strategies (Last Resort)
                    </span>
                    <ChevronRight className={cn('h-3 w-3 transition-transform', showFallbackStrategies && 'rotate-90')} />
                  </button>
                  {showFallbackStrategies && (
                    <div className="p-2 space-y-2 bg-card/50">
                      <p className="text-[10px] text-muted-foreground">
                        Use when standard selectors don't work:
                      </p>
                      <div className="grid grid-cols-3 gap-1">
                        <button
                          onClick={() => setSelectorType('ocr')}
                          className={cn(
                            'flex flex-col items-center p-2 rounded border text-[10px] transition-colors',
                            selectorType === 'ocr'
                              ? 'bg-amber-500/20 border-amber-500 text-amber-400'
                              : 'border-border hover:border-amber-500/50'
                          )}
                        >
                          <Eye className="h-4 w-4 mb-1" />
                          <span className="font-medium">OCR</span>
                          <span className="text-muted-foreground">Visual text</span>
                        </button>
                        <button
                          onClick={() => setSelectorType('coords')}
                          className={cn(
                            'flex flex-col items-center p-2 rounded border text-[10px] transition-colors',
                            selectorType === 'coords'
                              ? 'bg-red-500/20 border-red-500 text-red-400'
                              : 'border-border hover:border-red-500/50'
                          )}
                        >
                          <Target className="h-4 w-4 mb-1" />
                          <span className="font-medium">Coords</span>
                          <span className="text-muted-foreground">X,Y position</span>
                        </button>
                        <button
                          onClick={() => setSelectorType('image')}
                          className={cn(
                            'flex flex-col items-center p-2 rounded border text-[10px] transition-colors',
                            selectorType === 'image'
                              ? 'bg-purple-500/20 border-purple-500 text-purple-400'
                              : 'border-border hover:border-purple-500/50'
                          )}
                        >
                          <ImageIcon className="h-4 w-4 mb-1" />
                          <span className="font-medium">Image</span>
                          <span className="text-muted-foreground">Template</span>
                        </button>
                      </div>
                      
                      {/* OCR Input */}
                      {selectorType === 'ocr' && (
                        <div className="bg-amber-500/10 border border-amber-500/30 rounded p-2">
                          <p className="text-[10px] text-amber-400 mb-1">
                            Enter the exact visible text to find using OCR:
                          </p>
                          <input
                            type="text"
                            value={manualSelector}
                            onChange={(e) => setManualSelector(e.target.value)}
                            placeholder="New Arrivals"
                            className="w-full px-2 py-1 text-xs border border-amber-500/30 rounded bg-background"
                          />
                        </div>
                      )}
                      
                      {/* Coordinates Input */}
                      {selectorType === 'coords' && (
                        <div className="bg-red-500/10 border border-red-500/30 rounded p-2">
                          <p className="text-[10px] text-red-400 mb-1">
                            ⚠️ Coordinates break when window size changes. Format: x,y
                          </p>
                          <input
                            type="text"
                            value={manualSelector}
                            onChange={(e) => setManualSelector(e.target.value)}
                            placeholder="150,300"
                            className="w-full px-2 py-1 text-xs font-mono border border-red-500/30 rounded bg-background"
                          />
                        </div>
                      )}
                      
                      {/* Image Template Input */}
                      {selectorType === 'image' && (
                        <div className="bg-purple-500/10 border border-purple-500/30 rounded p-2">
                          <p className="text-[10px] text-purple-400">
                            Image template matching requires capturing a screenshot of the element.
                            This feature is coming soon.
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </details>
          </div>

          {/* === Smart Overlay Suggestions - Replace Step === */}
          {overlaySuggestions.length > 0 && (
            <div className="border-t border-border pt-3 mt-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-medium text-blue-400 flex items-center gap-1">
                  <Zap className="h-3 w-3" />
                  Replace with Overlay Suggestion
                </p>
                <button 
                  onClick={() => {
                    // Refresh suggestions from browser
                    const flowstral = (window as any).flowstral;
                    if (flowstral?.playwrightRecorder?.getSuggestions) {
                      flowstral.playwrightRecorder.getSuggestions().then(() => {
                        toast.info('Refreshed suggestions');
                      });
                    }
                  }}
                  className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-1"
                >
                  <RefreshCw className="h-3 w-3" />
                  Refresh
                </button>
              </div>
              <div className="grid grid-cols-2 gap-1 max-h-32 overflow-y-auto">
                {overlaySuggestions.map((suggestion, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      // Use EXACT text match with the suggestion
                      onElementPicked({ 
                        text: suggestion.text, 
                        selector: suggestion.selector,
                        selectorType: 'text'
                      });
                      setPickSuccess(true);
                      toast.success(`✅ Step replaced with "${suggestion.text}"`);
                      setTimeout(() => onOpenChange(false), 1000);
                    }}
                    className="p-2 text-left text-xs rounded bg-blue-500/10 border border-blue-500/30 hover:border-blue-500 hover:bg-blue-500/20 transition-colors"
                    title={`Selector: ${suggestion.selector}`}
                  >
                    <span className="font-medium truncate block">
                      {suggestion.text.length > 25 ? suggestion.text.substring(0, 25) + '...' : suggestion.text}
                    </span>
                    <span className="text-[10px] text-muted-foreground capitalize">
                      {suggestion.type}
                    </span>
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">
                Click a suggestion to replace the failed step with that action
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-4 border-t border-border">
          <Button
            variant="ghost"
            onClick={handleSkip}
            className="text-amber-400 hover:text-amber-300 hover:bg-amber-500/10"
          >
            <SkipForward className="h-4 w-4 mr-2" />
            Skip This Step
          </Button>
          
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
