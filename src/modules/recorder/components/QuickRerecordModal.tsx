/**
 * Quick Re-record Modal - Simple inline step re-recording
 * 
 * A streamlined experience for re-recording a failed step without
 * leaving the builder. Automatically opens browser and allows
 * single-click element capture.
 * 
 * Flow:
 * 1. Opens browser to last known URL (or user-specified)
 * 2. User clicks "Start Picking" and clicks the element
 * 3. User clicks "Save" and it's done - stays in builder
 * 
 * @author Flowstral
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  MousePointer2, 
  CheckCircle2, 
  XCircle, 
  Play,
  Loader2,
  Globe,
  MonitorPlay,
  Save,
  RefreshCw,
  AlertCircle,
  Crosshair,
  X
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface QuickRerecordModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  step: {
    name?: string;
    type?: string;
    selector?: string;
    value?: string;
    url?: string;
  } | null;
  stepIndex: number;
  lastKnownUrl?: string | null;
  onSave: (updates: {
    manualSelector?: string;
    manualText?: string;
    selectorObj?: any;
  }) => void;
}

interface PickedElement {
  tag: string;
  text: string;
  selector: string;
  selectors: Array<{
    type: string;
    selector: string;
    reliability: number;
    description: string;
  }>;
}

export default function QuickRerecordModal({
  open,
  onOpenChange,
  step,
  stepIndex,
  lastKnownUrl,
  onSave
}: QuickRerecordModalProps) {
  // State
  const [status, setStatus] = useState<'idle' | 'opening' | 'ready' | 'picking' | 'picked'>('idle');
  const [targetUrl, setTargetUrl] = useState('');
  const [browserOpen, setBrowserOpen] = useState(false);
  const [pickedElement, setPickedElement] = useState<PickedElement | null>(null);
  const [selectedSelector, setSelectedSelector] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Flowstral API
  const flowstral = (window as any).flowstral;

  // Initialize URL when modal opens
  useEffect(() => {
    if (open) {
      // Priority: lastKnownUrl > step.url > empty
      const url = lastKnownUrl || step?.url || '';
      setTargetUrl(url);
      setStatus('idle');
      setPickedElement(null);
      setSelectedSelector('');
      setError(null);
      
      // Check if browser is already open
      checkBrowserStatus();
    }
  }, [open, lastKnownUrl, step]);

  // Check if browser is open
  const checkBrowserStatus = useCallback(async () => {
    if (!flowstral?.playwrightRecorder?.isBrowserOpen) {
      setBrowserOpen(false);
      return;
    }
    
    try {
      const result = await flowstral.playwrightRecorder.isBrowserOpen();
      setBrowserOpen(result?.isOpen || false);
      if (result?.isOpen) {
        setStatus('ready');
      }
    } catch (e) {
      setBrowserOpen(false);
    }
  }, [flowstral]);

  // Open browser to URL
  const openBrowser = useCallback(async () => {
    if (!flowstral?.playwrightRecorder) {
      setError('Browser control not available (Electron only)');
      return;
    }

    if (!targetUrl) {
      setError('Please enter a URL');
      return;
    }

    setStatus('opening');
    setError(null);

    try {
      // First try reopening to failure state if available
      let result;
      if (flowstral.playwrightRecorder.reopenToFailure) {
        result = await flowstral.playwrightRecorder.reopenToFailure();
      }
      
      // If that didn't work or no failure state, navigate manually
      if (!result?.success) {
        // Start browser if needed
        if (flowstral.playwrightRecorder.start) {
          await flowstral.playwrightRecorder.start({ url: targetUrl });
        } else if (flowstral.playwrightRecorder.navigateTo) {
          await flowstral.playwrightRecorder.navigateTo(targetUrl);
        }
      }
      
      setBrowserOpen(true);
      setStatus('ready');
      toast.success('Browser opened! Ready to pick element.');
    } catch (e: any) {
      setError(e.message || 'Failed to open browser');
      setStatus('idle');
    }
  }, [flowstral, targetUrl]);

  // Start element picker
  const startPicking = useCallback(async () => {
    if (!flowstral?.elementPicker) {
      setError('Element picker not available');
      return;
    }

    setStatus('picking');
    setError(null);
    toast.info('Click on the element you want to use');

    try {
      const result = await flowstral.elementPicker.start();
      
      if (result?.success && result.elementInfo) {
        const element: PickedElement = {
          tag: result.elementInfo.tag,
          text: result.elementInfo.text || result.elementInfo.ariaLabel || '',
          selector: result.elementInfo.selectors?.[0]?.selector || '',
          selectors: result.elementInfo.selectors || []
        };
        
        setPickedElement(element);
        setSelectedSelector(element.selector);
        setStatus('picked');
        toast.success('Element captured!');
      } else if (result?.cancelled) {
        setStatus('ready');
        toast.info('Picker cancelled');
      } else {
        setStatus('ready');
        setError(result?.error || 'Failed to pick element');
      }
    } catch (e: any) {
      setStatus('ready');
      setError(e.message || 'Picker failed');
    }
  }, [flowstral]);

  // Cancel picking
  const cancelPicking = useCallback(async () => {
    if (flowstral?.elementPicker) {
      await flowstral.elementPicker.stop();
    }
    setStatus('ready');
  }, [flowstral]);

  // Test selector
  const testSelector = useCallback(async () => {
    if (!flowstral?.elementPicker || !selectedSelector) return;
    
    try {
      const result = await flowstral.elementPicker.testSelector(selectedSelector);
      if (result.success) {
        toast.success(`Found element: ${result.message}`);
        await flowstral.elementPicker.highlight(selectedSelector);
      } else {
        toast.error(`Not found: ${result.message}`);
      }
    } catch (e: any) {
      toast.error(e.message);
    }
  }, [flowstral, selectedSelector]);

  // Save and close
  const handleSave = useCallback(() => {
    if (!selectedSelector && !pickedElement?.text) {
      toast.error('No element selected');
      return;
    }

    // Build update object
    const updates: any = {};
    
    if (selectedSelector) {
      updates.manualSelector = selectedSelector;
    }
    
    if (pickedElement?.text) {
      updates.manualText = pickedElement.text;
    }
    
    if (pickedElement?.selectors) {
      updates.selectorObj = {
        selector: selectedSelector,
        text: pickedElement.text,
        tag: pickedElement.tag,
        alternatives: pickedElement.selectors
      };
    }

    onSave(updates);
    onOpenChange(false);
    toast.success(`Step ${stepIndex + 1} updated!`);
  }, [selectedSelector, pickedElement, onSave, onOpenChange, stepIndex]);

  // Close browser when modal closes
  const handleClose = useCallback(async () => {
    // Optionally close browser - for now, leave it open for convenience
    onOpenChange(false);
  }, [onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Crosshair className="h-5 w-5 text-purple-500" />
            Quick Re-record Step {stepIndex + 1}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Step Info */}
          {step && (
            <div className="bg-secondary/50 rounded-lg p-3 text-sm">
              <div className="flex items-center gap-2 mb-1">
                <Badge variant="outline" className="text-xs">{step.type}</Badge>
                <span className="font-medium">{step.name || 'Unnamed step'}</span>
              </div>
              {step.selector && (
                <p className="text-xs text-muted-foreground font-mono truncate">
                  {step.selector}
                </p>
              )}
            </div>
          )}

          {/* Error Display */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-red-700 dark:text-red-400 flex-shrink-0" />
              <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
            </div>
          )}

          {/* Step 1: URL & Open Browser */}
          {(status === 'idle' || status === 'opening') && (
            <div className="space-y-3">
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-2">
                  <Globe className="h-4 w-4" />
                  Target URL
                </label>
                <Input
                  value={targetUrl}
                  onChange={(e) => setTargetUrl(e.target.value)}
                  placeholder="https://example.com/page"
                  className="font-mono text-sm"
                />
              </div>

              <Button
                onClick={openBrowser}
                disabled={status === 'opening' || !targetUrl}
                className="w-full bg-purple-600 hover:bg-purple-500"
              >
                {status === 'opening' ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Opening Browser...
                  </>
                ) : (
                  <>
                    <MonitorPlay className="h-4 w-4 mr-2" />
                    Open Browser
                  </>
                )}
              </Button>

              {!flowstral?.playwrightRecorder && (
                <p className="text-xs text-amber-700 dark:text-amber-400 text-center">
                  Browser control requires Electron app
                </p>
              )}
            </div>
          )}

          {/* Step 2: Pick Element */}
          {(status === 'ready' || status === 'picking') && (
            <div className="space-y-3">
              <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-3 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                <span className="text-sm text-emerald-700 dark:text-emerald-400">Browser ready</span>
              </div>

              <Button
                onClick={status === 'picking' ? cancelPicking : startPicking}
                className={cn(
                  'w-full',
                  status === 'picking'
                    ? 'bg-red-500 hover:bg-red-600'
                    : 'bg-blue-500 hover:bg-blue-600'
                )}
              >
                {status === 'picking' ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Click Element... (ESC to cancel)
                  </>
                ) : (
                  <>
                    <MousePointer2 className="h-4 w-4 mr-2" />
                    Start Picking Element
                  </>
                )}
              </Button>
            </div>
          )}

          {/* Step 3: Element Picked - Ready to Save */}
          {status === 'picked' && pickedElement && (
            <div className="space-y-3">
              <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  <span className="text-sm font-medium text-emerald-700 dark:text-emerald-400">Element Captured!</span>
                </div>
                <div className="space-y-1 text-xs">
                  <p><span className="text-muted-foreground">Tag:</span> {pickedElement.tag}</p>
                  {pickedElement.text && (
                    <p><span className="text-muted-foreground">Text:</span> {pickedElement.text}</p>
                  )}
                </div>
              </div>

              {/* Selector Options */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Selector</label>
                <select
                  value={selectedSelector}
                  onChange={(e) => setSelectedSelector(e.target.value)}
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm font-mono"
                >
                  {pickedElement.selectors.map((sel, idx) => (
                    <option key={idx} value={sel.selector}>
                      {sel.type}: {sel.selector.substring(0, 50)}...
                    </option>
                  ))}
                </select>
              </div>

              {/* Test Button */}
              <Button
                variant="outline"
                size="sm"
                onClick={testSelector}
                className="w-full"
              >
                <Play className="h-3 w-3 mr-2" />
                Test Selector
              </Button>

              {/* Pick Again */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setStatus('ready');
                  setPickedElement(null);
                }}
                className="w-full text-muted-foreground"
              >
                <RefreshCw className="h-3 w-3 mr-2" />
                Pick Different Element
              </Button>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={!pickedElement && !selectedSelector}
            className="bg-green-600 hover:bg-green-500"
          >
            <Save className="h-4 w-4 mr-2" />
            Save Step
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
