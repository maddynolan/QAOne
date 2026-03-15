/**
 * @module accessibility
 * @page Accessibility
 *
 * WCAG compliance scanning page using axe-core. Provides URL-based scanning
 * with configurable WCAG level/version selection, component-targeted scans,
 * issue filtering by severity, batch scanning, and multi-format export.
 *
 * @features
 * - URL-based WCAG compliance scanning
 * - WCAG version selector (2.0, 2.1, 2.2)
 * - Level selection (A/AA/AAA)
 * - Component-selector targeted scanning
 * - Multi-URL batch scanning
 * - Issue filtering by impact (critical, serious, moderate, minor)
 * - Multi-format report export (JSON, HTML, Markdown)
 * - Scan history persistence with compliance score
 * - Compliance score gauge (0-100)
 * - Collapsible issue details for long element HTML
 * - Empty state with getting-started guidance
 *
 * @api /api/accessibility/* - Main scan endpoints (10 endpoints)
 * @api /api/a11y/* - V2 scanning with reports (6 endpoints)
 */
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Scan, AlertTriangle, CheckCircle, Download, RefreshCw, Filter, List, ChevronDown, ChevronRight, Trash2, Eye, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { API_BASE_URL } from "@/lib/api-config";

interface AccessibilityIssue {
  id: string;
  rule: string;
  impact: "critical" | "serious" | "moderate" | "minor";
  description: string;
  element: string;
  suggested_fix: string;
  wcag_criterion?: string;
  help_url?: string;
}

interface ScanResult {
  scan_id: string;
  url: string;
  summary: {
    total: number;
    critical: number;
    serious: number;
    moderate: number;
    minor: number;
  };
  issues: AccessibilityIssue[];
  timestamp: string;
  complianceScore?: number;
  scanner_warning?: string;
  scan_method?: "axe_core" | "basic_html";
}

type ScanType = "full_page" | "component";
type WcagLevel = "A" | "AA" | "AAA";
type WcagVersion = "2.0" | "2.1" | "2.2";
type ExportFormat = "json" | "html" | "markdown";
type SeverityFilter = "all" | "critical" | "serious" | "moderate" | "minor";

// Calculate compliance score (0-100) from issue severity counts
function calcComplianceScore(summary: ScanResult['summary']): number {
  const penalty = (summary.critical * 10) + (summary.serious * 5) + (summary.moderate * 2) + (summary.minor * 1);
  return Math.max(0, Math.min(100, 100 - penalty));
}

// Validate URL format
function isValidUrl(urlStr: string): boolean {
  try {
    const u = new URL(urlStr);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

// Impact color mapping (stable reference)
const IMPACT_COLORS: Record<string, string> = {
  critical: "bg-red-500 text-white",
  serious: "bg-orange-500 text-white",
  moderate: "bg-yellow-500 text-white",
  minor: "bg-blue-500 text-white",
};
const DEFAULT_IMPACT_COLOR = "bg-secondary text-secondary-foreground";

export default function Accessibility() {
  const [url, setUrl] = useState("");
  const [scanType, setScanType] = useState<ScanType>("full_page");
  const [componentSelector, setComponentSelector] = useState("");
  const [wcagLevel, setWcagLevel] = useState<WcagLevel>("AA");
  const [wcagVersion, setWcagVersion] = useState<WcagVersion>("2.1");
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);

  // AbortController ref for cancelling in-flight requests on unmount
  const abortControllerRef = useRef<AbortController | null>(null);

  // Scan history with localStorage persistence
  const [recentScans, setRecentScans] = useState<ScanResult[]>(() => {
    try {
      const saved = localStorage.getItem('flowstral-a11y-history');
      if (!saved) return [];
      const parsed = JSON.parse(saved);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });

  // Batch scan state
  const [batchMode, setBatchMode] = useState(false);
  const [batchUrls, setBatchUrls] = useState("");
  const [batchResults, setBatchResults] = useState<ScanResult[]>([]);

  // Severity filter
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>("all");

  // Export format
  const [exportFormat, setExportFormat] = useState<ExportFormat>("json");

  // Expanded issue details
  const [expandedIssues, setExpandedIssues] = useState<Set<string>>(new Set());

  // Scanner setup status (from /check-setup diagnostic endpoint)
  const [setupStatus, setSetupStatus] = useState<{
    playwright_installed: boolean;
    chromium_available: boolean;
    scan_method: "axe_core" | "basic_html";
    setup_instructions: string[];
  } | null>(null);

  // Check scanner setup on mount
  useEffect(() => {
    const checkSetup = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/accessibility/check-setup`);
        if (res.ok) {
          const data = await res.json();
          setSetupStatus(data);
        }
      } catch {
        // Silently fail — scan itself will show warnings
      }
    };
    checkSetup();
  }, []);

  // Cleanup abort controller on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // Persist scan history
  useEffect(() => {
    try {
      localStorage.setItem('flowstral-a11y-history', JSON.stringify(recentScans.slice(0, 50)));
    } catch {
      // Ignore quota errors — localStorage may be full
    }
  }, [recentScans]);

  const getApiKey = useCallback(() => {
    return localStorage.getItem("api_key") || "";
  }, []);

  const getImpactColor = useCallback((impact: string): string => {
    return IMPACT_COLORS[impact] || DEFAULT_IMPACT_COLOR;
  }, []);

  const toggleIssueExpanded = useCallback((issueId: string) => {
    setExpandedIssues(prev => {
      const next = new Set(prev);
      if (next.has(issueId)) {
        next.delete(issueId);
      } else {
        next.add(issueId);
      }
      return next;
    });
  }, []);

  const scanPage = useCallback(async () => {
    if (!url) {
      toast.error("Please enter a URL");
      return;
    }

    if (!isValidUrl(url)) {
      toast.error("Please enter a valid URL (must start with http:// or https://)");
      return;
    }

    // Abort any in-flight request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setIsScanning(true);
    setScanError(null);
    try {
      const apiKey = getApiKey();
      const headers: HeadersInit = { "Content-Type": "application/json" };
      if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;

      const response = await fetch(`${API_BASE_URL}/api/accessibility/scan`, {
        method: "POST",
        headers,
        signal: controller.signal,
        body: JSON.stringify({
          url,
          scan_type: scanType,
          component_selector: scanType === "component" ? componentSelector : null,
          wcag_level: wcagLevel,
          wcag_version: wcagVersion,
        })
      });

      if (!response.ok) {
        let detail = "Scan failed";
        try {
          const error = await response.json();
          detail = error.detail || detail;
        } catch {
          // response may not be JSON
        }
        throw new Error(detail);
      }

      const result: ScanResult = await response.json();
      result.complianceScore = calcComplianceScore(result.summary);
      setScanResult(result);
      setExpandedIssues(new Set());
      setRecentScans(prev => [result, ...prev.filter(s => s.scan_id !== result.scan_id)].slice(0, 50));
      toast.success(`Scan completed: ${result.summary.total} issues found (Score: ${result.complianceScore})`);
    } catch (error: unknown) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        // Request was cancelled — do not update state
        return;
      }
      const message = error instanceof Error ? error.message : "An unexpected error occurred";
      setScanError(message);
      toast.error(`Scan failed: ${message}`);
    } finally {
      setIsScanning(false);
    }
  }, [url, scanType, componentSelector, wcagLevel, wcagVersion, getApiKey]);

  const runBatchScan = useCallback(async () => {
    const urls = batchUrls.split('\n').map(u => u.trim()).filter(u => u && isValidUrl(u));
    if (urls.length === 0) {
      toast.error("Enter at least one valid URL (must start with http:// or https://)");
      return;
    }

    // Abort any in-flight request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setIsScanning(true);
    setScanError(null);
    setBatchResults([]);
    try {
      const apiKey = getApiKey();
      const headers: HeadersInit = { "Content-Type": "application/json" };
      if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;

      // Try batch endpoint first
      try {
        const res = await fetch(`${API_BASE_URL}/api/a11y/batch-scan`, {
          method: "POST",
          headers,
          signal: controller.signal,
          body: JSON.stringify({ urls, wcag_level: wcagLevel }),
        });
        if (res.ok) {
          const data = await res.json();
          const rawResults: ScanResult[] = data.results || data;
          const results = rawResults.map((r: ScanResult) => ({
            ...r,
            complianceScore: calcComplianceScore(r.summary),
          }));
          setBatchResults(results);
          setRecentScans(prev => [...results, ...prev].slice(0, 50));
          toast.success(`Batch scan complete: ${results.length} URLs scanned`);
          setIsScanning(false);
          return;
        }
      } catch (batchError: unknown) {
        // Propagate abort errors, fall through for other errors
        if (batchError instanceof DOMException && batchError.name === 'AbortError') {
          return;
        }
        // fall through to sequential scan
      }

      // Sequential fallback
      const results: ScanResult[] = [];
      for (const scanUrl of urls) {
        if (controller.signal.aborted) break;
        try {
          const res = await fetch(`${API_BASE_URL}/api/accessibility/scan`, {
            method: "POST",
            headers,
            signal: controller.signal,
            body: JSON.stringify({ url: scanUrl, wcag_level: wcagLevel, wcag_version: wcagVersion }),
          });
          if (res.ok) {
            const result: ScanResult = await res.json();
            result.complianceScore = calcComplianceScore(result.summary);
            results.push(result);
            setBatchResults([...results]);
          }
        } catch (seqError: unknown) {
          if (seqError instanceof DOMException && seqError.name === 'AbortError') {
            break;
          }
          toast.error(`Failed to scan: ${scanUrl}`);
        }
      }
      setRecentScans(prev => [...results, ...prev].slice(0, 50));
      toast.success(`Batch scan complete: ${results.length}/${urls.length} URLs scanned`);
    } catch (error: unknown) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return;
      }
      const message = error instanceof Error ? error.message : "An unexpected error occurred";
      setScanError(message);
      toast.error(`Batch scan failed: ${message}`);
    } finally {
      setIsScanning(false);
    }
  }, [batchUrls, wcagLevel, wcagVersion, getApiKey]);

  const exportReport = useCallback(async (format?: string) => {
    if (!scanResult) return;
    const fmt = format || exportFormat;

    // Try backend export for HTML/Markdown
    if (fmt !== 'json' && scanResult.scan_id) {
      try {
        const res = await fetch(`${API_BASE_URL}/api/a11y/report/${scanResult.scan_id}?format=${fmt}`);
        if (res.ok) {
          const blob = await res.blob();
          const dlUrl = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = dlUrl;
          a.download = `a11y-report-${Date.now()}.${fmt === 'html' ? 'html' : 'md'}`;
          a.click();
          URL.revokeObjectURL(dlUrl);
          toast.success(`${fmt.toUpperCase()} report exported`);
          return;
        }
      } catch {
        // fall through to client-side export
      }
    }

    // Client-side export
    let content: string;
    let mimeType: string;
    let ext: string;

    if (fmt === 'markdown') {
      content = `# Accessibility Report\n\n**URL:** ${scanResult.url}\n**Date:** ${new Date(scanResult.timestamp).toLocaleString()}\n**WCAG Level:** ${wcagLevel} (${wcagVersion})\n**Compliance Score:** ${scanResult.complianceScore ?? calcComplianceScore(scanResult.summary)}/100\n\n## Summary\n\n| Severity | Count |\n|----------|-------|\n| Critical | ${scanResult.summary.critical} |\n| Serious | ${scanResult.summary.serious} |\n| Moderate | ${scanResult.summary.moderate} |\n| Minor | ${scanResult.summary.minor} |\n| **Total** | **${scanResult.summary.total}** |\n\n## Issues\n\n${scanResult.issues.map((issue, i) => `### ${i + 1}. ${issue.rule || issue.id} [${issue.impact?.toUpperCase()}]\n\n${issue.description}\n\n${issue.element ? `**Element:** \`${issue.element}\`` : ''}\n\n${issue.suggested_fix ? `**Fix:** ${issue.suggested_fix}` : ''}\n`).join('\n---\n\n')}`;
      mimeType = 'text/markdown';
      ext = 'md';
    } else if (fmt === 'html') {
      content = `<!DOCTYPE html><html lang="en"><head><title>A11y Report</title><style>body{font-family:system-ui;max-width:900px;margin:2rem auto;padding:0 1rem}h1{color:#1f2937}.critical{color:#ef4444}.serious{color:#f97316}.moderate{color:#eab308}.minor{color:#3b82f6}table{border-collapse:collapse;width:100%}th,td{border:1px solid #e5e7eb;padding:8px;text-align:left}code{background:#f1f5f9;padding:2px 6px;border-radius:3px;font-size:0.85em}.issue{border-left:4px solid;padding:1rem;margin:1rem 0;background:#f9fafb}.score{font-size:3rem;font-weight:bold;text-align:center;padding:1rem}</style></head><body><h1>Accessibility Report</h1><p><strong>URL:</strong> ${scanResult.url}</p><p><strong>Date:</strong> ${new Date(scanResult.timestamp).toLocaleString()}</p><p><strong>WCAG:</strong> ${wcagVersion} Level ${wcagLevel}</p><div class="score" style="color:${(scanResult.complianceScore ?? 100) >= 80 ? '#22c55e' : (scanResult.complianceScore ?? 100) >= 50 ? '#eab308' : '#ef4444'}">${scanResult.complianceScore ?? calcComplianceScore(scanResult.summary)}/100</div><table><tr><th>Severity</th><th>Count</th></tr><tr><td class="critical">Critical</td><td>${scanResult.summary.critical}</td></tr><tr><td class="serious">Serious</td><td>${scanResult.summary.serious}</td></tr><tr><td class="moderate">Moderate</td><td>${scanResult.summary.moderate}</td></tr><tr><td class="minor">Minor</td><td>${scanResult.summary.minor}</td></tr></table><h2>Issues (${scanResult.summary.total})</h2>${scanResult.issues.map(issue => `<div class="issue" style="border-color:${issue.impact === 'critical' ? '#ef4444' : issue.impact === 'serious' ? '#f97316' : issue.impact === 'moderate' ? '#eab308' : '#3b82f6'}"><strong>${issue.rule || issue.id}</strong> <span class="${issue.impact}">[${issue.impact?.toUpperCase()}]</span><p>${issue.description}</p>${issue.element ? `<p><code>${issue.element}</code></p>` : ''}${issue.suggested_fix ? `<p style="color:#16a34a"><strong>Fix:</strong> ${issue.suggested_fix}</p>` : ''}</div>`).join('')}</body></html>`;
      mimeType = 'text/html';
      ext = 'html';
    } else {
      content = JSON.stringify({ url: scanResult.url, timestamp: scanResult.timestamp, wcag_level: wcagLevel, wcag_version: wcagVersion, compliance_score: scanResult.complianceScore, summary: scanResult.summary, issues: scanResult.issues }, null, 2);
      mimeType = 'application/json';
      ext = 'json';
    }

    const blob = new Blob([content], { type: mimeType });
    const dlUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = dlUrl;
    a.download = `a11y-report-${Date.now()}.${ext}`;
    a.click();
    URL.revokeObjectURL(dlUrl);
    toast.success(`${fmt.toUpperCase()} report exported`);
  }, [scanResult, exportFormat, wcagLevel, wcagVersion]);

  // Memoized filtered issues to avoid recomputation on every render
  const filteredIssues = useMemo(() => {
    if (!scanResult?.issues) return [];
    if (severityFilter === 'all') return scanResult.issues;
    return scanResult.issues.filter(issue => issue.impact === severityFilter);
  }, [scanResult?.issues, severityFilter]);

  // Memoized compliance score
  const complianceScore = useMemo(() => {
    if (!scanResult) return null;
    return scanResult.complianceScore ?? calcComplianceScore(scanResult.summary);
  }, [scanResult]);

  // Handle Enter key on URL input
  const handleUrlKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isScanning) {
      scanPage();
    }
  }, [isScanning, scanPage]);

  // Keyboard handler for interactive divs (severity cards, batch results, history items)
  const handleDivKeyDown = useCallback((e: React.KeyboardEvent, action: () => void) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      action();
    }
  }, []);

  // Clear history with confirmation
  const handleClearHistory = useCallback(() => {
    setRecentScans([]);
    localStorage.removeItem('flowstral-a11y-history');
    toast.success("Scan history cleared");
  }, []);

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Accessibility Scanner</h1>
          <p className="text-muted-foreground mt-2">
            Scan pages for WCAG compliance and accessibility issues
          </p>
        </div>
      </div>

      {/* Scanner Setup Warning (shown before scan form if axe-core is unavailable) */}
      {setupStatus && setupStatus.scan_method === 'basic_html' && (
        <Card className="border-amber-500/50 bg-amber-50/50 dark:bg-amber-950/20">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold text-amber-800 dark:text-amber-300 text-sm">Limited Scanner Mode</p>
                <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">
                  The full axe-core scanner is not available. Scans will use basic HTML pattern matching
                  which detects fewer issues. To enable full WCAG scanning:
                </p>
                {setupStatus.setup_instructions.length > 0 && (
                  <ol className="text-xs text-amber-600 dark:text-amber-500 mt-2 list-decimal ml-4 space-y-1">
                    {setupStatus.setup_instructions.map((instruction, i) => (
                      <li key={i}><code className="bg-amber-100 dark:bg-amber-800/50 px-1.5 py-0.5 rounded text-[11px]">{instruction}</code></li>
                    ))}
                  </ol>
                )}
                <Button
                  variant="ghost" size="sm" className="mt-2 h-7 text-xs text-amber-700 dark:text-amber-400"
                  onClick={async () => {
                    try {
                      const res = await fetch(`${API_BASE_URL}/api/accessibility/check-setup`);
                      if (res.ok) {
                        const data = await res.json();
                        setSetupStatus(data);
                        toast.info(data.scan_method === 'axe_core'
                          ? 'Full axe-core scanner is now available! Re-scan to get detailed results.'
                          : `Setup incomplete: ${data.setup_instructions.join(', then ')}`
                        );
                      }
                    } catch { toast.error('Could not check scanner setup'); }
                  }}
                >
                  <RefreshCw className="w-3 h-3 mr-1" /> Re-check Setup
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>New Scan</CardTitle>
              <CardDescription>Enter a URL to scan for accessibility issues</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={() => setBatchMode(!batchMode)} aria-pressed={batchMode}>
              <List className="h-4 w-4 mr-1" aria-hidden="true" />
              {batchMode ? 'Single URL' : 'Batch Scan'}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {batchMode ? (
            <div className="space-y-2">
              <Label htmlFor="batch-urls">URLs (one per line)</Label>
              <Textarea
                id="batch-urls"
                placeholder={"https://example.com\nhttps://example.com/about\nhttps://example.com/contact"}
                value={batchUrls}
                onChange={(e) => setBatchUrls(e.target.value)}
                rows={5}
                aria-describedby="batch-url-count"
              />
              <p id="batch-url-count" className="text-xs text-muted-foreground">{batchUrls.split('\n').filter(u => u.trim() && isValidUrl(u.trim())).length} valid URL(s)</p>
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="url">URL</Label>
              <Input
                id="url"
                type="url"
                placeholder="https://example.com"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={handleUrlKeyDown}
                aria-invalid={url ? !isValidUrl(url) : undefined}
                aria-describedby={url && !isValidUrl(url) ? "url-error" : undefined}
              />
              {url && !isValidUrl(url) && (
                <p id="url-error" className="text-xs text-destructive" role="alert">URL must start with http:// or https://</p>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="scan-type">Scan Type</Label>
              <select
                id="scan-type"
                className="w-full rounded-md border border-border bg-background text-foreground px-3 py-2 focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring"
                value={scanType}
                onChange={(e) => setScanType(e.target.value as ScanType)}
                aria-label="Select scan type"
              >
                <option value="full_page">Full Page</option>
                <option value="component">Component</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="wcag-version">WCAG Version</Label>
              <select
                id="wcag-version"
                className="w-full rounded-md border border-border bg-background text-foreground px-3 py-2 focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring"
                value={wcagVersion}
                onChange={(e) => setWcagVersion(e.target.value as WcagVersion)}
                aria-label="Select WCAG version"
              >
                <option value="2.0">WCAG 2.0</option>
                <option value="2.1">WCAG 2.1</option>
                <option value="2.2">WCAG 2.2</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="wcag-level">Level</Label>
              <select
                id="wcag-level"
                className="w-full rounded-md border border-border bg-background text-foreground px-3 py-2 focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring"
                value={wcagLevel}
                onChange={(e) => setWcagLevel(e.target.value as WcagLevel)}
                aria-label="Select WCAG compliance level"
              >
                <option value="A">Level A</option>
                <option value="AA">Level AA</option>
                <option value="AAA">Level AAA</option>
              </select>
            </div>
          </div>

          {scanType === "component" && (
            <div className="space-y-2">
              <Label htmlFor="component-selector">Component Selector</Label>
              <Input
                id="component-selector"
                placeholder="#my-component or .component-class"
                value={componentSelector}
                onChange={(e) => setComponentSelector(e.target.value)}
              />
            </div>
          )}

          <Button onClick={batchMode ? runBatchScan : scanPage} disabled={isScanning || (!batchMode && !!url && !isValidUrl(url))} className="w-full">
            {isScanning ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                <span aria-live="polite">Scanning...</span>
              </>
            ) : (
              <>
                <Scan className="mr-2 h-4 w-4" aria-hidden="true" />
                {batchMode ? 'Run Batch Scan' : 'Start Scan'}
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Scan Error */}
      {scanError && !isScanning && (
        <Card className="border-destructive" role="alert">
          <CardContent className="pt-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-destructive mt-0.5 flex-shrink-0" aria-hidden="true" />
              <div>
                <p className="font-semibold text-destructive">Scan Failed</p>
                <p className="text-sm text-muted-foreground mt-1">{scanError}</p>
                <Button variant="outline" size="sm" className="mt-2" onClick={() => { setScanError(null); scanPage(); }}>
                  <RefreshCw className="mr-1 h-3 w-3" aria-hidden="true" /> Retry
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Batch Results */}
      {batchMode && batchResults.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Batch Scan Results ({batchResults.length} URLs)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2" role="list" aria-label="Batch scan results">
              {batchResults.map((result, i) => (
                <div
                  key={result.scan_id || i}
                  role="listitem"
                  tabIndex={0}
                  className="flex items-center justify-between p-3 border border-border rounded-md cursor-pointer hover:bg-muted/50 transition-colors focus:outline-none focus:ring-2 focus:ring-ring"
                  onClick={() => { setScanResult(result); setBatchMode(false); setExpandedIssues(new Set()); }}
                  onKeyDown={(e) => handleDivKeyDown(e, () => { setScanResult(result); setBatchMode(false); setExpandedIssues(new Set()); })}
                  aria-label={`View results for ${result.url}, score ${result.complianceScore}, ${result.summary.total} issues`}
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate text-foreground">{result.url}</p>
                    <p className="text-xs text-muted-foreground">
                      Score: {result.complianceScore}/100 -- {result.summary.total} issues
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white ${
                      (result.complianceScore ?? 0) >= 80 ? 'bg-green-500' : (result.complianceScore ?? 0) >= 50 ? 'bg-yellow-500' : 'bg-red-500'
                    }`} aria-hidden="true">{result.complianceScore}</div>
                    <Badge variant="outline">{result.summary.critical} crit</Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Scanner Warning */}
      {scanResult && scanResult.scanner_warning && (
        <Card className="border-amber-500/50 bg-amber-50/50 dark:bg-amber-950/20" role="status">
          <CardContent className="pt-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" aria-hidden="true" />
              <div>
                <p className="font-semibold text-amber-800 dark:text-amber-300">Limited Scan Results</p>
                <p className="text-sm text-amber-700 dark:text-amber-400 mt-1">{scanResult.scanner_warning}</p>
                <p className="text-xs text-amber-600 dark:text-amber-500 mt-2">
                  For full axe-core scanning with detailed element-level violations, run the backend locally with Playwright installed:
                  <code className="bg-amber-100 dark:bg-amber-800/50 text-amber-900 dark:text-amber-200 px-1.5 py-0.5 rounded ml-1">pip install playwright && playwright install chromium</code>
                </p>
                <div className="flex items-center gap-2 mt-3">
                  <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => scanPage()} disabled={isScanning}>
                    <RefreshCw className={`w-3 h-3 mr-1 ${isScanning ? 'animate-spin' : ''}`} /> Re-scan
                  </Button>
                  <Button variant="ghost" size="sm" className="h-7 text-xs text-amber-700 dark:text-amber-400" onClick={async () => {
                    try {
                      const res = await fetch(`${API_BASE_URL}/api/accessibility/check-setup`);
                      if (res.ok) {
                        const data = await res.json();
                        setSetupStatus(data);
                        toast.info(data.scan_method === 'axe_core'
                          ? 'Full axe-core scanner is now available! Re-scan to get detailed results.'
                          : `Setup incomplete: ${data.setup_instructions.join(', then ')}`
                        );
                      }
                    } catch { toast.error('Could not check scanner setup'); }
                  }}>
                    Check Setup
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Scan Results */}
      {scanResult && !batchMode && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <CardTitle className="flex items-center gap-2">
                  Scan Results
                  {scanResult.scan_method === 'axe_core' && (
                    <Badge variant="outline" className="text-xs bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-green-300 dark:border-green-700">axe-core</Badge>
                  )}
                  {scanResult.scan_method === 'basic_html' && (
                    <Badge variant="outline" className="text-xs bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-700">basic HTML</Badge>
                  )}
                </CardTitle>
                <CardDescription>
                  {scanResult.url} -- {new Date(scanResult.timestamp).toLocaleString()}
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <label htmlFor="export-format" className="sr-only">Export format</label>
                <select
                  id="export-format"
                  className="rounded-md border border-border bg-background text-foreground px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  value={exportFormat}
                  onChange={(e) => setExportFormat(e.target.value as ExportFormat)}
                  aria-label="Select export format"
                >
                  <option value="json">JSON</option>
                  <option value="html">HTML</option>
                  <option value="markdown">Markdown</option>
                </select>
                <Button variant="outline" size="sm" onClick={() => exportReport()}>
                  <Download className="mr-1 h-4 w-4" aria-hidden="true" />
                  Export
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {/* Compliance Score + Summary */}
            <div className="flex items-center gap-6 mb-6">
              {/* Score gauge */}
              <div className="text-center">
                <div
                  className={`w-20 h-20 rounded-full flex items-center justify-center text-2xl font-bold text-white shadow-lg ${
                    (complianceScore ?? 0) >= 80 ? 'bg-green-500' : (complianceScore ?? 0) >= 50 ? 'bg-yellow-500' : 'bg-red-500'
                  }`}
                  role="meter"
                  aria-valuenow={complianceScore ?? 0}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`Compliance score: ${complianceScore} out of 100`}
                >
                  {complianceScore}
                </div>
                <p className="text-xs text-muted-foreground mt-1">Score</p>
              </div>

              {/* Severity cards */}
              <div className="flex-1 grid grid-cols-2 sm:grid-cols-4 gap-3" role="group" aria-label="Filter issues by severity">
                {([
                  { key: 'critical' as const, bg: 'bg-red-50 dark:bg-red-900/20', ring: 'ring-red-500', ringHover: 'ring-red-500/50', textColor: 'text-red-600 dark:text-red-400' },
                  { key: 'serious' as const, bg: 'bg-orange-50 dark:bg-orange-900/20', ring: 'ring-orange-500', ringHover: 'ring-orange-500/50', textColor: 'text-orange-600 dark:text-orange-400' },
                  { key: 'moderate' as const, bg: 'bg-yellow-50 dark:bg-yellow-900/20', ring: 'ring-yellow-500', ringHover: 'ring-yellow-500/50', textColor: 'text-yellow-600 dark:text-yellow-400' },
                  { key: 'minor' as const, bg: 'bg-blue-50 dark:bg-blue-900/20', ring: 'ring-blue-500', ringHover: 'ring-blue-500/50', textColor: 'text-blue-600 dark:text-blue-400' },
                ] as const).map(({ key, bg, ring, ringHover, textColor }) => (
                  <div
                    key={key}
                    role="button"
                    tabIndex={0}
                    aria-pressed={severityFilter === key}
                    aria-label={`Filter by ${key}: ${scanResult.summary[key]} issues`}
                    className={`text-center p-3 ${bg} rounded-lg cursor-pointer transition-all focus:outline-none focus:ring-2 focus:${ring} ${severityFilter === key ? `ring-2 ${ring}` : `hover:ring-2 ${ringHover}`}`}
                    onClick={() => setSeverityFilter(severityFilter === key ? 'all' : key)}
                    onKeyDown={(e) => handleDivKeyDown(e, () => setSeverityFilter(severityFilter === key ? 'all' : key))}
                  >
                    <div className={`text-2xl font-bold ${textColor}`}>{scanResult.summary[key]}</div>
                    <div className="text-xs text-muted-foreground">{key.charAt(0).toUpperCase() + key.slice(1)}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Severity Filter Bar */}
            <div className="flex items-center gap-2 mb-4 flex-wrap" role="toolbar" aria-label="Issue severity filter">
              <Filter className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              <span className="text-sm text-muted-foreground" id="filter-label">Filter:</span>
              {(['all', 'critical', 'serious', 'moderate', 'minor'] as const).map(sev => (
                <Button
                  key={sev}
                  variant={severityFilter === sev ? 'default' : 'outline'}
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setSeverityFilter(sev)}
                  aria-pressed={severityFilter === sev}
                  aria-label={sev === 'all' ? `Show all ${scanResult.summary.total} issues` : `Show ${scanResult.summary[sev] || 0} ${sev} issues`}
                >
                  {sev === 'all' ? `All (${scanResult.summary.total})` : `${sev.charAt(0).toUpperCase() + sev.slice(1)} (${scanResult.summary[sev] || 0})`}
                </Button>
              ))}
            </div>

            {/* Issues List */}
            <div className="space-y-3">
              <h3 className="text-lg font-semibold text-foreground">
                Issues ({filteredIssues.length}{severityFilter !== 'all' ? ` of ${scanResult.summary.total}` : ''})
              </h3>

              {filteredIssues.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  {scanResult.summary.total === 0 ? (
                    <>
                      <CheckCircle className="h-8 w-8 mx-auto mb-2 text-green-500" aria-hidden="true" />
                      <p>No accessibility issues found!</p>
                    </>
                  ) : (
                    <p>No {severityFilter} issues found</p>
                  )}
                </div>
              ) : (
                <div role="list" aria-label="Accessibility issues">
                  {filteredIssues.map((issue, idx) => {
                    const issueKey = issue.id || `issue-${idx}`;
                    const isExpanded = expandedIssues.has(issueKey);
                    const hasLongElement = issue.element && issue.element.length > 120;

                    return (
                      <Card key={issueKey} role="listitem" className="border-l-4 mb-3" style={{ borderLeftColor: issue.impact === 'critical' ? '#ef4444' : issue.impact === 'serious' ? '#f97316' : issue.impact === 'moderate' ? '#eab308' : '#3b82f6' }}>
                        <CardContent className="pt-4">
                          <div className="flex items-start justify-between">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-2 flex-wrap">
                                <Badge className={getImpactColor(issue.impact)}>
                                  {issue.impact?.toUpperCase()}
                                </Badge>
                                <span className="font-semibold text-foreground">{issue.rule || issue.id}</span>
                                {issue.wcag_criterion && (
                                  <Badge variant="outline">{issue.wcag_criterion}</Badge>
                                )}
                              </div>
                              <p className="text-sm text-muted-foreground mb-2">{issue.description}</p>
                              {issue.element && (
                                <div className="mb-2">
                                  {hasLongElement ? (
                                    <div>
                                      <button
                                        onClick={() => toggleIssueExpanded(issueKey)}
                                        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-1 transition-colors focus:outline-none focus:ring-2 focus:ring-ring rounded"
                                        aria-expanded={isExpanded}
                                        aria-controls={`element-${issueKey}`}
                                        aria-label={`${isExpanded ? 'Hide' : 'Show'} element HTML for ${issue.rule || issue.id}`}
                                      >
                                        {isExpanded ? <ChevronDown className="h-3 w-3" aria-hidden="true" /> : <ChevronRight className="h-3 w-3" aria-hidden="true" />}
                                        {isExpanded ? 'Hide' : 'Show'} element HTML
                                      </button>
                                      <div id={`element-${issueKey}`}>
                                        {isExpanded ? (
                                          <code className="block bg-secondary px-3 py-1.5 rounded text-xs text-secondary-foreground overflow-x-auto max-w-full whitespace-pre-wrap break-all">
                                            {issue.element}
                                          </code>
                                        ) : (
                                          <code className="block bg-secondary px-3 py-1.5 rounded text-xs text-secondary-foreground overflow-hidden max-w-full whitespace-nowrap text-ellipsis">
                                            {issue.element.slice(0, 120)}...
                                          </code>
                                        )}
                                      </div>
                                    </div>
                                  ) : (
                                    <code className="block bg-secondary px-3 py-1.5 rounded text-xs text-secondary-foreground overflow-x-auto max-w-full whitespace-pre-wrap break-all">
                                      {issue.element}
                                    </code>
                                  )}
                                </div>
                              )}
                              {issue.suggested_fix && (
                                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 p-3 rounded-md">
                                  <p className="text-sm text-green-700 dark:text-green-300">
                                    <span className="font-semibold">Fix: </span>{issue.suggested_fix}
                                  </p>
                                </div>
                              )}
                              {issue.help_url && (
                                <a href={issue.help_url} target="_blank" rel="noopener noreferrer"
                                  className="text-xs text-primary hover:underline mt-2 inline-block focus:outline-none focus:ring-2 focus:ring-ring rounded">
                                  Learn more
                                </a>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty State -- shown when no scan result and no history */}
      {!scanResult && !batchMode && recentScans.length === 0 && !isScanning && (
        <Card className="border-dashed">
          <CardContent className="py-12">
            <div className="text-center space-y-4">
              <Globe className="h-12 w-12 mx-auto text-muted-foreground/50" aria-hidden="true" />
              <div>
                <h3 className="text-lg font-semibold text-foreground">No scans yet</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Enter a URL above to scan for WCAG accessibility violations
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-xl mx-auto mt-6 text-left">
                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="text-sm font-medium text-foreground">1. Enter URL</p>
                  <p className="text-xs text-muted-foreground mt-1">Paste any web page URL to analyze</p>
                </div>
                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="text-sm font-medium text-foreground">2. Choose WCAG Level</p>
                  <p className="text-xs text-muted-foreground mt-1">AA is the standard for most compliance needs</p>
                </div>
                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="text-sm font-medium text-foreground">3. Review Issues</p>
                  <p className="text-xs text-muted-foreground mt-1">Get actionable fixes for each violation</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Scanning live region for screen readers */}
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {isScanning && "Accessibility scan in progress. Please wait."}
        {scanResult && !isScanning && `Scan complete. ${scanResult.summary.total} issues found. Compliance score: ${complianceScore} out of 100.`}
      </div>

      {/* Scan History */}
      {recentScans.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Scan History ({recentScans.length})</CardTitle>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-destructive hover:text-destructive"
                onClick={handleClearHistory}
                aria-label="Clear all scan history"
              >
                <Trash2 className="h-3 w-3 mr-1" aria-hidden="true" />
                Clear History
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2" role="list" aria-label="Recent scan history">
              {recentScans.slice(0, 20).map((scan, i) => {
                const scanScore = scan.complianceScore ?? calcComplianceScore(scan.summary);
                return (
                  <div
                    key={scan.scan_id || i}
                    role="listitem"
                    tabIndex={0}
                    className="flex items-center justify-between p-3 border border-border rounded-md cursor-pointer hover:bg-muted/50 transition-colors focus:outline-none focus:ring-2 focus:ring-ring"
                    onClick={() => { setScanResult(scan); setBatchMode(false); setExpandedIssues(new Set()); }}
                    onKeyDown={(e) => handleDivKeyDown(e, () => { setScanResult(scan); setBatchMode(false); setExpandedIssues(new Set()); })}
                    aria-label={`View scan for ${scan.url}, score ${scanScore}, ${scan.summary.total} issues, scanned ${new Date(scan.timestamp).toLocaleString()}`}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate text-foreground">{scan.url}</p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(scan.timestamp).toLocaleString()} -- {scan.summary.total} issues
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white ${
                        scanScore >= 80 ? 'bg-green-500' :
                        scanScore >= 50 ? 'bg-yellow-500' : 'bg-red-500'
                      }`} aria-hidden="true">{scanScore}</div>
                      <Badge variant="outline">{scan.summary.critical} critical</Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
