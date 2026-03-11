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
import { useState, useEffect, useCallback } from "react";
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

export default function Accessibility() {
  const [url, setUrl] = useState("");
  const [scanType, setScanType] = useState<"full_page" | "component">("full_page");
  const [componentSelector, setComponentSelector] = useState("");
  const [wcagLevel, setWcagLevel] = useState<"A" | "AA" | "AAA">("AA");
  const [wcagVersion, setWcagVersion] = useState<"2.0" | "2.1" | "2.2">("2.1");
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);

  // Scan history with localStorage persistence
  const [recentScans, setRecentScans] = useState<ScanResult[]>(() => {
    try {
      const saved = localStorage.getItem('flowstral-a11y-history');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });

  // Batch scan state
  const [batchMode, setBatchMode] = useState(false);
  const [batchUrls, setBatchUrls] = useState("");
  const [batchResults, setBatchResults] = useState<ScanResult[]>([]);

  // Severity filter
  const [severityFilter, setSeverityFilter] = useState<string>("all");

  // Export format
  const [exportFormat, setExportFormat] = useState<"json" | "html" | "markdown">("json");

  // Expanded issue details
  const [expandedIssues, setExpandedIssues] = useState<Set<string>>(new Set());

  // Persist scan history
  useEffect(() => {
    try {
      localStorage.setItem('flowstral-a11y-history', JSON.stringify(recentScans.slice(0, 50)));
    } catch { /* ignore quota errors */ }
  }, [recentScans]);

  const getApiKey = () => {
    return localStorage.getItem("api_key") || "";
  };

  const toggleIssueExpanded = (issueId: string) => {
    setExpandedIssues(prev => {
      const next = new Set(prev);
      if (next.has(issueId)) {
        next.delete(issueId);
      } else {
        next.add(issueId);
      }
      return next;
    });
  };

  const scanPage = useCallback(async () => {
    if (!url) {
      toast.error("Please enter a URL");
      return;
    }

    if (!isValidUrl(url)) {
      toast.error("Please enter a valid URL (must start with http:// or https://)");
      return;
    }

    setIsScanning(true);
    setScanError(null);
    try {
      const apiKey = getApiKey();
      const headers: HeadersInit = { "Content-Type": "application/json" };
      if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;

      const response = await fetch(`${API_BASE_URL}/api/accessibility/scan`, {
        method: "POST",
        headers,
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
        } catch { /* response may not be JSON */ }
        throw new Error(detail);
      }

      const result = await response.json();
      result.complianceScore = calcComplianceScore(result.summary);
      setScanResult(result);
      setExpandedIssues(new Set());
      setRecentScans(prev => [result, ...prev.filter(s => s.scan_id !== result.scan_id)].slice(0, 50));
      toast.success(`Scan completed: ${result.summary.total} issues found (Score: ${result.complianceScore})`);
    } catch (error: any) {
      setScanError(error.message);
      toast.error(`Scan failed: ${error.message}`);
    } finally {
      setIsScanning(false);
    }
  }, [url, scanType, componentSelector, wcagLevel, wcagVersion]);

  const runBatchScan = async () => {
    const urls = batchUrls.split('\n').map(u => u.trim()).filter(u => u && isValidUrl(u));
    if (urls.length === 0) {
      toast.error("Enter at least one valid URL (must start with http:// or https://)");
      return;
    }

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
          body: JSON.stringify({ urls, wcag_level: wcagLevel }),
        });
        if (res.ok) {
          const data = await res.json();
          const results = (data.results || data).map((r: any) => ({
            ...r,
            complianceScore: calcComplianceScore(r.summary),
          }));
          setBatchResults(results);
          setRecentScans(prev => [...results, ...prev].slice(0, 50));
          toast.success(`Batch scan complete: ${results.length} URLs scanned`);
          setIsScanning(false);
          return;
        }
      } catch { /* fall through to sequential scan */ }

      // Sequential fallback
      const results: ScanResult[] = [];
      for (const scanUrl of urls) {
        try {
          const res = await fetch(`${API_BASE_URL}/api/accessibility/scan`, {
            method: "POST",
            headers,
            body: JSON.stringify({ url: scanUrl, wcag_level: wcagLevel, wcag_version: wcagVersion }),
          });
          if (res.ok) {
            const result = await res.json();
            result.complianceScore = calcComplianceScore(result.summary);
            results.push(result);
            setBatchResults([...results]);
          }
        } catch {
          toast.error(`Failed to scan: ${scanUrl}`);
        }
      }
      setRecentScans(prev => [...results, ...prev].slice(0, 50));
      toast.success(`Batch scan complete: ${results.length}/${urls.length} URLs scanned`);
    } catch (error: any) {
      setScanError(error.message);
      toast.error(`Batch scan failed: ${error.message}`);
    } finally {
      setIsScanning(false);
    }
  };

  const getImpactColor = (impact: string) => {
    switch (impact) {
      case "critical": return "bg-red-500 text-white";
      case "serious": return "bg-orange-500 text-white";
      case "moderate": return "bg-yellow-500 text-white";
      case "minor": return "bg-blue-500 text-white";
      default: return "bg-secondary text-secondary-foreground";
    }
  };

  const exportReport = async (format?: string) => {
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
      } catch { /* fall through to client-side export */ }
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
      content = `<!DOCTYPE html><html><head><title>A11y Report</title><style>body{font-family:system-ui;max-width:900px;margin:2rem auto;padding:0 1rem}h1{color:#1f2937}.critical{color:#ef4444}.serious{color:#f97316}.moderate{color:#eab308}.minor{color:#3b82f6}table{border-collapse:collapse;width:100%}th,td{border:1px solid #e5e7eb;padding:8px;text-align:left}code{background:#f1f5f9;padding:2px 6px;border-radius:3px;font-size:0.85em}.issue{border-left:4px solid;padding:1rem;margin:1rem 0;background:#f9fafb}.score{font-size:3rem;font-weight:bold;text-align:center;padding:1rem}</style></head><body><h1>Accessibility Report</h1><p><strong>URL:</strong> ${scanResult.url}</p><p><strong>Date:</strong> ${new Date(scanResult.timestamp).toLocaleString()}</p><p><strong>WCAG:</strong> ${wcagVersion} Level ${wcagLevel}</p><div class="score" style="color:${(scanResult.complianceScore ?? 100) >= 80 ? '#22c55e' : (scanResult.complianceScore ?? 100) >= 50 ? '#eab308' : '#ef4444'}">${scanResult.complianceScore ?? calcComplianceScore(scanResult.summary)}/100</div><table><tr><th>Severity</th><th>Count</th></tr><tr><td class="critical">Critical</td><td>${scanResult.summary.critical}</td></tr><tr><td class="serious">Serious</td><td>${scanResult.summary.serious}</td></tr><tr><td class="moderate">Moderate</td><td>${scanResult.summary.moderate}</td></tr><tr><td class="minor">Minor</td><td>${scanResult.summary.minor}</td></tr></table><h2>Issues (${scanResult.summary.total})</h2>${scanResult.issues.map(issue => `<div class="issue" style="border-color:${issue.impact === 'critical' ? '#ef4444' : issue.impact === 'serious' ? '#f97316' : issue.impact === 'moderate' ? '#eab308' : '#3b82f6'}"><strong>${issue.rule || issue.id}</strong> <span class="${issue.impact}">[${issue.impact?.toUpperCase()}]</span><p>${issue.description}</p>${issue.element ? `<p><code>${issue.element}</code></p>` : ''}${issue.suggested_fix ? `<p style="color:#16a34a"><strong>Fix:</strong> ${issue.suggested_fix}</p>` : ''}</div>`).join('')}</body></html>`;
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
  };

  // Filter issues by severity
  const filteredIssues = scanResult?.issues?.filter(issue => {
    if (severityFilter === 'all') return true;
    return issue.impact === severityFilter;
  }) || [];

  // Compliance score for current result
  const complianceScore = scanResult?.complianceScore ?? (scanResult ? calcComplianceScore(scanResult.summary) : null);

  // Handle Enter key on URL input
  const handleUrlKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isScanning) {
      scanPage();
    }
  };

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

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>New Scan</CardTitle>
              <CardDescription>Enter a URL to scan for accessibility issues</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={() => setBatchMode(!batchMode)}>
              <List className="h-4 w-4 mr-1" />
              {batchMode ? 'Single URL' : 'Batch Scan'}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {batchMode ? (
            <div className="space-y-2">
              <Label>URLs (one per line)</Label>
              <Textarea
                placeholder={"https://example.com\nhttps://example.com/about\nhttps://example.com/contact"}
                value={batchUrls}
                onChange={(e) => setBatchUrls(e.target.value)}
                rows={5}
              />
              <p className="text-xs text-muted-foreground">{batchUrls.split('\n').filter(u => u.trim() && isValidUrl(u.trim())).length} valid URL(s)</p>
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="url">URL</Label>
              <Input
                id="url"
                placeholder="https://example.com"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={handleUrlKeyDown}
              />
              {url && !isValidUrl(url) && (
                <p className="text-xs text-destructive">URL must start with http:// or https://</p>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Scan Type</Label>
              <select
                className="w-full rounded-md border border-border bg-background text-foreground px-3 py-2 focus:border-primary focus:outline-none"
                value={scanType}
                onChange={(e) => setScanType(e.target.value as any)}
              >
                <option value="full_page">Full Page</option>
                <option value="component">Component</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label>WCAG Version</Label>
              <select
                className="w-full rounded-md border border-border bg-background text-foreground px-3 py-2 focus:border-primary focus:outline-none"
                value={wcagVersion}
                onChange={(e) => setWcagVersion(e.target.value as any)}
              >
                <option value="2.0">WCAG 2.0</option>
                <option value="2.1">WCAG 2.1</option>
                <option value="2.2">WCAG 2.2</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label>Level</Label>
              <select
                className="w-full rounded-md border border-border bg-background text-foreground px-3 py-2 focus:border-primary focus:outline-none"
                value={wcagLevel}
                onChange={(e) => setWcagLevel(e.target.value as any)}
              >
                <option value="A">Level A</option>
                <option value="AA">Level AA</option>
                <option value="AAA">Level AAA</option>
              </select>
            </div>
          </div>

          {scanType === "component" && (
            <div className="space-y-2">
              <Label>Component Selector</Label>
              <Input
                placeholder="#my-component or .component-class"
                value={componentSelector}
                onChange={(e) => setComponentSelector(e.target.value)}
              />
            </div>
          )}

          <Button onClick={batchMode ? runBatchScan : scanPage} disabled={isScanning || (!batchMode && !!url && !isValidUrl(url))} className="w-full">
            {isScanning ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                Scanning...
              </>
            ) : (
              <>
                <Scan className="mr-2 h-4 w-4" />
                {batchMode ? 'Run Batch Scan' : 'Start Scan'}
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Scan Error */}
      {scanError && !isScanning && (
        <Card className="border-destructive">
          <CardContent className="pt-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-destructive mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-semibold text-destructive">Scan Failed</p>
                <p className="text-sm text-muted-foreground mt-1">{scanError}</p>
                <Button variant="outline" size="sm" className="mt-2" onClick={() => { setScanError(null); scanPage(); }}>
                  <RefreshCw className="mr-1 h-3 w-3" /> Retry
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
            <div className="space-y-2">
              {batchResults.map((result, i) => (
                <div key={i} className="flex items-center justify-between p-3 border border-border rounded-md cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => { setScanResult(result); setBatchMode(false); setExpandedIssues(new Set()); }}>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate text-foreground">{result.url}</p>
                    <p className="text-xs text-muted-foreground">
                      Score: {result.complianceScore}/100 -- {result.summary.total} issues
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white ${
                      (result.complianceScore ?? 0) >= 80 ? 'bg-green-500' : (result.complianceScore ?? 0) >= 50 ? 'bg-yellow-500' : 'bg-red-500'
                    }`}>{result.complianceScore}</div>
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
        <Card className="border-amber-500/50 bg-amber-50/50 dark:bg-amber-950/20">
          <CardContent className="pt-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-semibold text-amber-800 dark:text-amber-300">Limited Scan Results</p>
                <p className="text-sm text-amber-700 dark:text-amber-400 mt-1">{scanResult.scanner_warning}</p>
                <p className="text-xs text-amber-600 dark:text-amber-500 mt-2">
                  For full axe-core scanning with detailed element-level violations, run the backend locally with Playwright installed:
                  <code className="bg-amber-100 dark:bg-amber-800/50 text-amber-900 dark:text-amber-200 px-1.5 py-0.5 rounded ml-1">pip install playwright && playwright install chromium</code>
                </p>
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
                <select className="rounded-md border border-border bg-background text-foreground px-2 py-1 text-sm"
                  value={exportFormat} onChange={(e) => setExportFormat(e.target.value as any)}>
                  <option value="json">JSON</option>
                  <option value="html">HTML</option>
                  <option value="markdown">Markdown</option>
                </select>
                <Button variant="outline" size="sm" onClick={() => exportReport()}>
                  <Download className="mr-1 h-4 w-4" />
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
                <div className={`w-20 h-20 rounded-full flex items-center justify-center text-2xl font-bold text-white shadow-lg ${
                  (complianceScore ?? 0) >= 80 ? 'bg-green-500' : (complianceScore ?? 0) >= 50 ? 'bg-yellow-500' : 'bg-red-500'
                }`}>
                  {complianceScore}
                </div>
                <p className="text-xs text-muted-foreground mt-1">Score</p>
              </div>

              {/* Severity cards */}
              <div className="flex-1 grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className={`text-center p-3 bg-red-50 dark:bg-red-900/20 rounded-lg cursor-pointer transition-all ${severityFilter === 'critical' ? 'ring-2 ring-red-500' : 'hover:ring-2 ring-red-500/50'}`}
                  onClick={() => setSeverityFilter(severityFilter === 'critical' ? 'all' : 'critical')}>
                  <div className="text-2xl font-bold text-red-600 dark:text-red-400">{scanResult.summary.critical}</div>
                  <div className="text-xs text-muted-foreground">Critical</div>
                </div>
                <div className={`text-center p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg cursor-pointer transition-all ${severityFilter === 'serious' ? 'ring-2 ring-orange-500' : 'hover:ring-2 ring-orange-500/50'}`}
                  onClick={() => setSeverityFilter(severityFilter === 'serious' ? 'all' : 'serious')}>
                  <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">{scanResult.summary.serious}</div>
                  <div className="text-xs text-muted-foreground">Serious</div>
                </div>
                <div className={`text-center p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg cursor-pointer transition-all ${severityFilter === 'moderate' ? 'ring-2 ring-yellow-500' : 'hover:ring-2 ring-yellow-500/50'}`}
                  onClick={() => setSeverityFilter(severityFilter === 'moderate' ? 'all' : 'moderate')}>
                  <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{scanResult.summary.moderate}</div>
                  <div className="text-xs text-muted-foreground">Moderate</div>
                </div>
                <div className={`text-center p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg cursor-pointer transition-all ${severityFilter === 'minor' ? 'ring-2 ring-blue-500' : 'hover:ring-2 ring-blue-500/50'}`}
                  onClick={() => setSeverityFilter(severityFilter === 'minor' ? 'all' : 'minor')}>
                  <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{scanResult.summary.minor}</div>
                  <div className="text-xs text-muted-foreground">Minor</div>
                </div>
              </div>
            </div>

            {/* Severity Filter Bar */}
            <div className="flex items-center gap-2 mb-4 flex-wrap">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Filter:</span>
              {['all', 'critical', 'serious', 'moderate', 'minor'].map(sev => (
                <Button key={sev} variant={severityFilter === sev ? 'default' : 'outline'} size="sm" className="h-7 text-xs"
                  onClick={() => setSeverityFilter(sev)}>
                  {sev === 'all' ? `All (${scanResult.summary.total})` : `${sev.charAt(0).toUpperCase() + sev.slice(1)} (${(scanResult.summary as any)[sev] || 0})`}
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
                    <><CheckCircle className="h-8 w-8 mx-auto mb-2 text-green-500" /><p>No accessibility issues found!</p></>
                  ) : (
                    <p>No {severityFilter} issues found</p>
                  )}
                </div>
              ) : (
                filteredIssues.map((issue, idx) => {
                  const issueKey = issue.id || `issue-${idx}`;
                  const isExpanded = expandedIssues.has(issueKey);
                  const hasLongElement = issue.element && issue.element.length > 120;

                  return (
                    <Card key={issueKey} className="border-l-4" style={{ borderLeftColor: issue.impact === 'critical' ? '#ef4444' : issue.impact === 'serious' ? '#f97316' : issue.impact === 'moderate' ? '#eab308' : '#3b82f6' }}>
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
                                      className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-1 transition-colors"
                                    >
                                      {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                                      {isExpanded ? 'Hide' : 'Show'} element HTML
                                    </button>
                                    {isExpanded && (
                                      <code className="block bg-secondary px-3 py-1.5 rounded text-xs text-secondary-foreground overflow-x-auto max-w-full whitespace-pre-wrap break-all">
                                        {issue.element}
                                      </code>
                                    )}
                                    {!isExpanded && (
                                      <code className="block bg-secondary px-3 py-1.5 rounded text-xs text-secondary-foreground overflow-hidden max-w-full whitespace-nowrap text-ellipsis">
                                        {issue.element.slice(0, 120)}...
                                      </code>
                                    )}
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
                                className="text-xs text-primary hover:underline mt-2 inline-block">
                                Learn more →
                              </a>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty State — shown when no scan result and no history */}
      {!scanResult && !batchMode && recentScans.length === 0 && !isScanning && (
        <Card className="border-dashed">
          <CardContent className="py-12">
            <div className="text-center space-y-4">
              <Globe className="h-12 w-12 mx-auto text-muted-foreground/50" />
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

      {/* Scan History */}
      {recentScans.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Scan History ({recentScans.length})</CardTitle>
              <Button variant="ghost" size="sm" className="text-xs text-destructive hover:text-destructive" onClick={() => { setRecentScans([]); localStorage.removeItem('flowstral-a11y-history'); }}>
                <Trash2 className="h-3 w-3 mr-1" />
                Clear History
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {recentScans.slice(0, 20).map((scan, i) => (
                <div
                  key={scan.scan_id || i}
                  className="flex items-center justify-between p-3 border border-border rounded-md cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => { setScanResult(scan); setBatchMode(false); setExpandedIssues(new Set()); }}
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate text-foreground">{scan.url}</p>
                    <p className="text-sm text-muted-foreground">
                      {new Date(scan.timestamp).toLocaleString()} -- {scan.summary.total} issues
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white ${
                      (scan.complianceScore ?? calcComplianceScore(scan.summary)) >= 80 ? 'bg-green-500' :
                      (scan.complianceScore ?? calcComplianceScore(scan.summary)) >= 50 ? 'bg-yellow-500' : 'bg-red-500'
                    }`}>{scan.complianceScore ?? calcComplianceScore(scan.summary)}</div>
                    <Badge variant="outline">{scan.summary.critical} critical</Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
