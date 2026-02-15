/**
 * ManualAssistCard — Inline card for manually fixing failed test steps.
 *
 * Appears below a failed step in the test results modal when AI auto-fix fails.
 * Gives users 3 ways to provide element information:
 *   1. Paste Element: Copy outerHTML from DevTools → parse → generate selectors
 *   2. Enter Selector: Type CSS/XPath/text selector directly
 *   3. Paste Screenshot: Upload/paste screenshot → Vision AI analysis
 *
 * Each mode calls the backend /api/ai/enhancements/manual-assist endpoint
 * and presents ranked selector candidates with "Use This" buttons.
 */

import React, { useState, useRef, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Code, MousePointerClick, Image, Loader2, CheckCircle2,
  ChevronDown, ChevronUp, AlertCircle, Copy, Wrench, X,
} from "lucide-react";
import {
  manualAssistPasteElement,
  manualAssistEnterSelector,
  manualAssistScreenshot,
  type ManualAssistResult,
  type ManualAssistSelector,
} from "@/modules/recorder/lib/aiEnhancements";

interface ManualAssistCardProps {
  testId: string;
  stepId: string;
  stepIndex: number;
  stepLabel: string;
  failedSelector: string;
  pageUrl?: string;
  onSelectFix: (selector: string) => void;
  onClose: () => void;
}

export default function ManualAssistCard({
  testId,
  stepId,
  stepIndex,
  stepLabel,
  failedSelector,
  pageUrl,
  onSelectFix,
  onClose,
}: ManualAssistCardProps) {
  const [expanded, setExpanded] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ManualAssistResult | null>(null);

  // Paste Element state
  const [htmlContent, setHtmlContent] = useState("");

  // Enter Selector state
  const [selectorType, setSelectorType] = useState<string>("css");
  const [selectorValue, setSelectorValue] = useState("");

  // Screenshot state
  const [screenshotB64, setScreenshotB64] = useState<string | null>(null);
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetResult = useCallback(() => {
    setResult(null);
    setError(null);
  }, []);

  // ── Paste Element handler ──
  const handlePasteElement = useCallback(async () => {
    if (!htmlContent.trim()) {
      setError("Please paste the element HTML first.");
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await manualAssistPasteElement({
        test_id: testId,
        step_id: stepId,
        step_index: stepIndex,
        step_label: stepLabel,
        html_content: htmlContent,
        failed_selector: failedSelector,
        page_url: pageUrl,
      });
      setResult(res);
      if (!res.success) setError(res.message);
    } catch (err: any) {
      setError(err?.message || "Failed to parse element.");
    } finally {
      setLoading(false);
    }
  }, [htmlContent, testId, stepId, stepIndex, stepLabel, failedSelector, pageUrl]);

  // ── Enter Selector handler ──
  const handleEnterSelector = useCallback(async () => {
    if (!selectorValue.trim()) {
      setError("Please enter a selector.");
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await manualAssistEnterSelector({
        test_id: testId,
        step_id: stepId,
        step_index: stepIndex,
        step_label: stepLabel,
        selector_type: selectorType,
        selector_value: selectorValue,
      });
      setResult(res);
      if (!res.success) setError(res.message);
    } catch (err: any) {
      setError(err?.message || "Selector validation failed.");
    } finally {
      setLoading(false);
    }
  }, [selectorValue, selectorType, testId, stepId, stepIndex, stepLabel]);

  // ── Screenshot handler ──
  const handleScreenshot = useCallback(async () => {
    if (!screenshotB64) {
      setError("Please upload or paste a screenshot first.");
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await manualAssistScreenshot({
        test_id: testId,
        step_id: stepId,
        step_index: stepIndex,
        step_label: stepLabel,
        screenshot_b64: screenshotB64,
        failed_selector: failedSelector,
        page_url: pageUrl,
      });
      setResult(res);
      if (!res.success) setError(res.message);
    } catch (err: any) {
      setError(err?.message || "Screenshot analysis failed.");
    } finally {
      setLoading(false);
    }
  }, [screenshotB64, testId, stepId, stepIndex, stepLabel, failedSelector, pageUrl]);

  // ── File/paste handlers for screenshot ──
  const processImageFile = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setScreenshotPreview(dataUrl);
      // Strip the data:image/...;base64, prefix
      const b64 = dataUrl.split(",")[1] || dataUrl;
      setScreenshotB64(b64);
      resetResult();
    };
    reader.readAsDataURL(file);
  }, [resetResult]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processImageFile(file);
  }, [processImageFile]);

  const handlePasteImage = useCallback((e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of Array.from(items)) {
      if (item.type.startsWith("image/")) {
        const file = item.getAsFile();
        if (file) {
          e.preventDefault();
          processImageFile(file);
          return;
        }
      }
    }
  }, [processImageFile]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer?.files?.[0];
    if (file && file.type.startsWith("image/")) {
      processImageFile(file);
    }
  }, [processImageFile]);

  // ── Collapsed state ──
  if (!expanded) {
    return (
      <Card className="mt-2 border-amber-500/30 bg-amber-500/5">
        <CardContent className="p-3">
          <button
            onClick={() => setExpanded(true)}
            className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400 hover:underline w-full"
          >
            <Wrench className="w-4 h-4" />
            <span className="font-medium">Manual Assist</span>
            <span className="text-muted-foreground">— Paste element, enter selector, or upload screenshot</span>
            <ChevronDown className="w-4 h-4 ml-auto" />
          </button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mt-2 border-amber-500/30 bg-amber-500/5">
      <CardContent className="p-4 space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Wrench className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            <span className="text-sm font-semibold text-amber-600 dark:text-amber-400">
              Manual Assist
            </span>
            <span className="text-xs text-muted-foreground">
              — AI couldn't fix this step. Help it by providing element info.
            </span>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setExpanded(false)}>
              <ChevronUp className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="paste_element" onValueChange={() => resetResult()}>
          <TabsList className="grid w-full grid-cols-3 h-9">
            <TabsTrigger value="paste_element" className="text-xs gap-1">
              <Code className="w-3.5 h-3.5" />
              Paste Element
            </TabsTrigger>
            <TabsTrigger value="enter_selector" className="text-xs gap-1">
              <MousePointerClick className="w-3.5 h-3.5" />
              Enter Selector
            </TabsTrigger>
            <TabsTrigger value="paste_screenshot" className="text-xs gap-1">
              <Image className="w-3.5 h-3.5" />
              Screenshot
            </TabsTrigger>
          </TabsList>

          {/* ──── Tab 1: Paste Element ──── */}
          <TabsContent value="paste_element" className="space-y-2 mt-2">
            <p className="text-xs text-muted-foreground">
              In Chrome DevTools: right-click the element &rarr; <strong>Copy</strong> &rarr; <strong>Copy outerHTML</strong>, then paste below.
            </p>
            <Textarea
              className="min-h-[80px] font-mono text-xs"
              placeholder={'<button class="btn-primary" data-testid="submit" aria-label="Submit form">Submit</button>'}
              value={htmlContent}
              onChange={e => { setHtmlContent(e.target.value); resetResult(); }}
            />
            <Button
              size="sm"
              onClick={handlePasteElement}
              disabled={loading || !htmlContent.trim()}
              className="gap-1"
            >
              {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Code className="w-3.5 h-3.5" />}
              Generate Selectors
            </Button>
          </TabsContent>

          {/* ──── Tab 2: Enter Selector ──── */}
          <TabsContent value="enter_selector" className="space-y-2 mt-2">
            <p className="text-xs text-muted-foreground">
              Enter a CSS selector, XPath, or text content to locate the element.
            </p>
            <div className="flex gap-2">
              <Select value={selectorType} onValueChange={v => { setSelectorType(v); resetResult(); }}>
                <SelectTrigger className="w-[130px] h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="css">CSS Selector</SelectItem>
                  <SelectItem value="xpath">XPath</SelectItem>
                  <SelectItem value="text">Text Content</SelectItem>
                </SelectContent>
              </Select>
              <Input
                className="flex-1 h-8 text-xs font-mono"
                placeholder={
                  selectorType === "xpath"
                    ? "//button[@data-testid='submit']"
                    : selectorType === "text"
                      ? "Submit Order"
                      : "[data-testid=\"submit\"]"
                }
                value={selectorValue}
                onChange={e => { setSelectorValue(e.target.value); resetResult(); }}
                onKeyDown={e => { if (e.key === "Enter") handleEnterSelector(); }}
              />
            </div>
            <Button
              size="sm"
              onClick={handleEnterSelector}
              disabled={loading || !selectorValue.trim()}
              className="gap-1"
            >
              {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <MousePointerClick className="w-3.5 h-3.5" />}
              Apply Selector
            </Button>
          </TabsContent>

          {/* ──── Tab 3: Screenshot ──── */}
          <TabsContent value="paste_screenshot" className="space-y-2 mt-2">
            <p className="text-xs text-muted-foreground">
              Take a screenshot of the area containing the element. Drag &amp; drop, click to upload, or <strong>Ctrl+V</strong> to paste.
            </p>
            <div
              className="border-2 border-dashed rounded-lg p-4 text-center cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => fileInputRef.current?.click()}
              onDragOver={e => e.preventDefault()}
              onDrop={handleDrop}
              onPaste={handlePasteImage}
              tabIndex={0}
            >
              {screenshotPreview ? (
                <div className="space-y-2">
                  <img
                    src={screenshotPreview}
                    alt="Screenshot preview"
                    className="max-h-[150px] mx-auto rounded border"
                  />
                  <p className="text-xs text-muted-foreground">Click or paste to replace</p>
                </div>
              ) : (
                <div className="space-y-1 py-2">
                  <Image className="w-8 h-8 mx-auto text-muted-foreground opacity-40" />
                  <p className="text-xs text-muted-foreground">Drop image, click to browse, or Ctrl+V to paste</p>
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileSelect}
              />
            </div>
            <Button
              size="sm"
              onClick={handleScreenshot}
              disabled={loading || !screenshotB64}
              className="gap-1"
            >
              {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Image className="w-3.5 h-3.5" />}
              Analyze Screenshot
            </Button>
          </TabsContent>
        </Tabs>

        {/* ──── Error ──── */}
        {error && (
          <div className="flex items-start gap-2 text-xs text-red-500 bg-red-500/5 border border-red-500/20 rounded p-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* ──── Results ──── */}
        {result?.success && result.selectors.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-green-600 dark:text-green-400 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              {result.message}
            </p>
            <div className="space-y-1.5">
              {result.selectors.map((sel, i) => (
                <SelectorCandidateRow
                  key={i}
                  selector={sel}
                  isRecommended={sel.selector === result.recommended_selector}
                  onUse={() => onSelectFix(sel.selector)}
                />
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}


// ──────────────────────────────────────────────────────────────────────────
// Sub-component: Selector candidate row
// ──────────────────────────────────────────────────────────────────────────

function SelectorCandidateRow({
  selector,
  isRecommended,
  onUse,
}: {
  selector: ManualAssistSelector;
  isRecommended: boolean;
  onUse: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const confidenceColor =
    selector.confidence >= 0.9
      ? "text-green-600 border-green-500 bg-green-500/10"
      : selector.confidence >= 0.7
        ? "text-amber-600 border-amber-500 bg-amber-500/10"
        : "text-red-500 border-red-500 bg-red-500/10";

  const handleCopy = () => {
    navigator.clipboard.writeText(selector.selector);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div
      className={`flex items-center gap-2 p-2 rounded border text-xs ${
        isRecommended ? "border-green-500/40 bg-green-500/5" : "border-border"
      }`}
    >
      {isRecommended && (
        <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-green-500 text-green-600 bg-green-500/10 flex-shrink-0">
          Best
        </Badge>
      )}
      <Badge variant="outline" className={`text-[10px] px-1.5 py-0 flex-shrink-0 ${confidenceColor}`}>
        {Math.round(selector.confidence * 100)}%
      </Badge>
      <code className="font-mono text-xs truncate flex-1 text-foreground" title={selector.selector}>
        {selector.selector}
      </code>
      <span className="text-muted-foreground text-[10px] hidden sm:inline flex-shrink-0">
        {selector.strategy}
      </span>
      <Button variant="ghost" size="sm" className="h-6 w-6 p-0 flex-shrink-0" onClick={handleCopy} title="Copy selector">
        {copied ? <CheckCircle2 className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
      </Button>
      <Button
        size="sm"
        className="h-6 text-xs px-2 flex-shrink-0"
        onClick={onUse}
      >
        Use This
      </Button>
    </div>
  );
}
