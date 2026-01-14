import { useState, useEffect } from "react";
import { Scan, AlertTriangle, CheckCircle, Clock, FileText, Download, RefreshCw, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
}

export default function Accessibility() {
  const [url, setUrl] = useState("");
  const [scanType, setScanType] = useState<"full_page" | "component">("full_page");
  const [componentSelector, setComponentSelector] = useState("");
  const [wcagLevel, setWcagLevel] = useState<"A" | "AA" | "AAA">("AA");
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [recentScans, setRecentScans] = useState<ScanResult[]>([]);

  const getApiKey = () => {
    // Get API key from localStorage or environment
    return localStorage.getItem("api_key") || "";
  };

  const scanPage = async () => {
    console.log("[A11y Debug] scanPage called, url:", url);
    if (!url) {
      toast.error("Please enter a URL");
      return;
    }

    setIsScanning(true);
    console.log("[A11y Debug] Starting scan for:", url);
    try {
      const apiKey = getApiKey();
      
      // Build headers - API key is optional for web UI access
      const headers: HeadersInit = {
        "Content-Type": "application/json"
      };
      
      // Add Authorization header only if API key is available
      if (apiKey) {
        headers["Authorization"] = `Bearer ${apiKey}`;
      }

      const response = await fetch(`${API_BASE_URL}/api/accessibility/scan`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          url,
          scan_type: scanType,
          component_selector: scanType === "component" ? componentSelector : null,
          wcag_level: wcagLevel
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || "Scan failed");
      }

      const result = await response.json();
      console.log("[A11y Debug] Scan result:", result);
      console.log("[A11y Debug] Issues:", result.issues?.length || 0);
      setScanResult(result);
      setRecentScans(prev => [result, ...prev].slice(0, 10));
      toast.success(`Scan completed: ${result.summary.total} issues found`);
    } catch (error: any) {
      toast.error(`Scan failed: ${error.message}`);
    } finally {
      setIsScanning(false);
    }
  };

  const getImpactColor = (impact: string) => {
    switch (impact) {
      case "critical":
        return "bg-red-500";
      case "serious":
        return "bg-orange-500";
      case "moderate":
        return "bg-yellow-500";
      case "minor":
        return "bg-blue-500";
      default:
        return "bg-gray-500";
    }
  };

  const exportReport = () => {
    if (!scanResult) return;
    
    const report = {
      url: scanResult.url,
      timestamp: scanResult.timestamp,
      wcag_level: wcagLevel,
      summary: scanResult.summary,
      issues: scanResult.issues
    };

    const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `accessibility-report-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Report exported");
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Accessibility Scanner</h1>
          <p className="text-muted-foreground mt-2">
            Scan pages for WCAG compliance and accessibility issues
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>New Scan</CardTitle>
          <CardDescription>Enter a URL to scan for accessibility issues</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="url">URL</Label>
            <Input
              id="url"
              placeholder="https://example.com"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="scanType">Scan Type</Label>
              <select
                id="scanType"
                className="w-full rounded-md border border-gray-700 bg-gray-800 text-gray-100 px-3 py-2 focus:border-amber-500 focus:outline-none"
                value={scanType}
                onChange={(e) => setScanType(e.target.value as "full_page" | "component")}
              >
                <option value="full_page" className="bg-gray-800 text-gray-100">Full Page</option>
                <option value="component" className="bg-gray-800 text-gray-100">Component</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="wcagLevel">WCAG Level</Label>
              <select
                id="wcagLevel"
                className="w-full rounded-md border border-gray-700 bg-gray-800 text-gray-100 px-3 py-2 focus:border-amber-500 focus:outline-none"
                value={wcagLevel}
                onChange={(e) => setWcagLevel(e.target.value as "A" | "AA" | "AAA")}
              >
                <option value="A" className="bg-gray-800 text-gray-100">WCAG A</option>
                <option value="AA" className="bg-gray-800 text-gray-100">WCAG AA</option>
                <option value="AAA" className="bg-gray-800 text-gray-100">WCAG AAA</option>
              </select>
            </div>
          </div>

          {scanType === "component" && (
            <div className="space-y-2">
              <Label htmlFor="componentSelector">Component Selector</Label>
              <Input
                id="componentSelector"
                placeholder="#my-component or .component-class"
                value={componentSelector}
                onChange={(e) => setComponentSelector(e.target.value)}
              />
            </div>
          )}

          <Button onClick={scanPage} disabled={isScanning} className="w-full">
            {isScanning ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                Scanning...
              </>
            ) : (
              <>
                <Scan className="mr-2 h-4 w-4" />
                Start Scan
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {scanResult && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Scan Results</CardTitle>
                <CardDescription>
                  Scanned: {new Date(scanResult.timestamp).toLocaleString()}
                </CardDescription>
              </div>
              <Button variant="outline" onClick={exportReport}>
                <Download className="mr-2 h-4 w-4" />
                Export Report
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-4 gap-4 mb-6">
              <div className="text-center p-4 bg-red-50 rounded-lg">
                <div className="text-2xl font-bold text-red-600">{scanResult.summary.critical}</div>
                <div className="text-sm text-muted-foreground">Critical</div>
              </div>
              <div className="text-center p-4 bg-orange-50 rounded-lg">
                <div className="text-2xl font-bold text-orange-600">{scanResult.summary.serious}</div>
                <div className="text-sm text-muted-foreground">Serious</div>
              </div>
              <div className="text-center p-4 bg-yellow-50 rounded-lg">
                <div className="text-2xl font-bold text-yellow-600">{scanResult.summary.moderate}</div>
                <div className="text-sm text-muted-foreground">Moderate</div>
              </div>
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">{scanResult.summary.minor}</div>
                <div className="text-sm text-muted-foreground">Minor</div>
              </div>
            </div>

            {/* Issues List - Show all issues directly without tabs for better visibility */}
            <div className="mt-6 space-y-4">
              <h3 className="text-lg font-semibold">Issues Found ({scanResult.issues?.length || 0})</h3>
              
              {(!scanResult.issues || scanResult.issues.length === 0) ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p>No accessibility issues found! 🎉</p>
                </div>
              ) : (
                scanResult.issues.map((issue, idx) => (
                  <Card key={issue.id || idx} className="border-l-4" style={{ borderLeftColor: issue.impact === 'critical' ? '#ef4444' : issue.impact === 'serious' ? '#f97316' : issue.impact === 'moderate' ? '#eab308' : '#3b82f6' }}>
                    <CardContent className="pt-6">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2 flex-wrap">
                            <Badge className={getImpactColor(issue.impact)}>
                              {issue.impact?.toUpperCase()}
                            </Badge>
                            <span className="font-semibold text-lg">{issue.rule || issue.id}</span>
                            {issue.wcag_criterion && (
                              <Badge variant="outline">{issue.wcag_criterion}</Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground mb-3">
                            {issue.description}
                          </p>
                          {issue.element && (
                            <div className="mb-3">
                              <p className="text-xs font-medium mb-1">Affected Element:</p>
                              <code className="block bg-slate-100 dark:bg-slate-800 px-3 py-2 rounded text-xs overflow-x-auto max-w-full whitespace-pre-wrap break-all">
                                {issue.element}
                              </code>
                            </div>
                          )}
                          {issue.suggested_fix && (
                            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 p-4 rounded-md mt-3">
                              <p className="text-sm font-semibold mb-1 text-green-800 dark:text-green-200">✅ Recommended Fix:</p>
                              <p className="text-sm text-green-700 dark:text-green-300">{issue.suggested_fix}</p>
                            </div>
                          )}
                          {issue.help_url && (
                            <a 
                              href={issue.help_url} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-xs text-blue-600 hover:underline mt-3 inline-block"
                            >
                              Learn more about this issue →
                            </a>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>

          </CardContent>
        </Card>
      )}

      {recentScans.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recent Scans</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {recentScans.map((scan) => (
                <div
                  key={scan.scan_id}
                  className="flex items-center justify-between p-3 border rounded-md cursor-pointer hover:bg-muted"
                  onClick={() => setScanResult(scan)}
                >
                  <div>
                    <p className="font-medium">{scan.url}</p>
                    <p className="text-sm text-muted-foreground">
                      {new Date(scan.timestamp).toLocaleString()} • {scan.summary.total} issues
                    </p>
                  </div>
                  <Badge variant="outline">{scan.summary.critical} critical</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

