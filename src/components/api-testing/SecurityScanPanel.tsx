/**
 * SecurityScanPanel - OWASP API security testing with findings dashboard.
 * Backend: POST /api/v2/testing/security/scan
 */

import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import {
  Shield, Play, Loader2, AlertTriangle, CheckCircle2,
  AlertCircle, Info, Bug, ChevronDown, ChevronRight,
} from "lucide-react";
import { API_BASE_URL } from "./constants";

const SCAN_TYPES = [
  { id: "auth_matrix", label: "Authentication", description: "Test 401/403 responses for missing/wrong auth", owasp: "API2:2023" },
  { id: "bola", label: "BOLA", description: "Broken Object Level Authorization", owasp: "API1:2023" },
  { id: "injection", label: "Injection", description: "SQL, NoSQL, Command injection", owasp: "API8:2023" },
  { id: "rate_limiting", label: "Rate Limiting", description: "Test for 429 rate limiting", owasp: "API4:2023" },
  { id: "ssrf", label: "SSRF", description: "Server-Side Request Forgery", owasp: "API7:2023" },
  { id: "mass_assignment", label: "Mass Assignment", description: "Test for extra properties accepted", owasp: "API3:2023" },
];

interface Finding {
  id: string;
  title: string;
  category: string;
  severity: "critical" | "high" | "medium" | "low" | "info";
  description: string;
  evidence: string;
  remediation: string;
  endpoint: string;
  method: string;
  cwe_id?: string;
}

interface ScanResult {
  scan_id: string;
  target_url: string;
  duration_ms: number;
  total_tests: number;
  findings: Finding[];
  summary: Record<string, number>;
}

export default function SecurityScanPanel() {
  const { toast } = useToast();
  const [targetUrl, setTargetUrl] = useState("");
  const [selectedTests, setSelectedTests] = useState<string[]>(SCAN_TYPES.map(t => t.id));
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [expandedFinding, setExpandedFinding] = useState<string | null>(null);
  const [severityFilter, setSeverityFilter] = useState<string>("all");

  const toggleTest = (id: string) => {
    setSelectedTests(prev =>
      prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id]
    );
  };

  const handleScan = useCallback(async () => {
    if (!targetUrl.trim()) {
      toast({ title: "Missing URL", description: "Enter a target API URL", variant: "destructive" });
      return;
    }
    setScanning(true);
    setResult(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v2/testing/security/scan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target_url: targetUrl,
          tests: selectedTests,
        }),
      });
      if (!res.ok) throw new Error(`Scan failed: ${res.statusText}`);
      const data = await res.json();
      setResult(data);
      const totalFindings = data.findings?.length || 0;
      toast({
        title: "Scan complete",
        description: `${totalFindings} finding(s) in ${((data.duration_ms || 0) / 1000).toFixed(1)}s`,
      });
    } catch (err: any) {
      toast({ title: "Scan failed", description: err.message, variant: "destructive" });
    } finally {
      setScanning(false);
    }
  }, [targetUrl, selectedTests, toast]);

  const severityColor = (s: string) => {
    const colors: Record<string, string> = {
      critical: "bg-red-600 text-white",
      high: "bg-orange-500 text-white",
      medium: "bg-amber-500 text-white",
      low: "bg-blue-500 text-white",
      info: "bg-gray-500 text-white",
    };
    return colors[s] || "bg-gray-500 text-white";
  };

  const severityIcon = (s: string) => {
    switch (s) {
      case "critical": return <AlertTriangle className="w-4 h-4 text-red-600" />;
      case "high": return <AlertCircle className="w-4 h-4 text-orange-500" />;
      case "medium": return <AlertCircle className="w-4 h-4 text-amber-500" />;
      case "low": return <Info className="w-4 h-4 text-blue-500" />;
      default: return <Info className="w-4 h-4 text-gray-500" />;
    }
  };

  const filteredFindings = result?.findings?.filter(f =>
    severityFilter === "all" || f.severity === severityFilter
  ) || [];

  return (
    <div className="space-y-4">
      {/* Scan Config */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="w-4 h-4" />
            OWASP API Security Scan
          </CardTitle>
          <CardDescription>Test your API against OWASP Top 10 API Security risks (2023)</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="https://api.example.com"
              value={targetUrl}
              onChange={e => setTargetUrl(e.target.value)}
              className="flex-1 font-mono text-sm"
              onKeyDown={e => { if (e.key === "Enter") handleScan(); }}
            />
            <Button onClick={handleScan} disabled={scanning || !targetUrl.trim()}>
              {scanning ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Play className="w-4 h-4 mr-2" />
              )}
              {scanning ? "Scanning..." : "Run Scan"}
            </Button>
          </div>

          {/* Test type selector */}
          <div>
            <Label className="text-xs font-medium mb-2 block">Security Tests</Label>
            <div className="grid grid-cols-3 gap-2">
              {SCAN_TYPES.map(test => (
                <label
                  key={test.id}
                  className={`flex items-start gap-2 p-2 rounded-lg border cursor-pointer transition-colors ${selectedTests.includes(test.id) ? "border-primary bg-primary/5" : "hover:bg-muted/50"}`}
                >
                  <input
                    type="checkbox"
                    checked={selectedTests.includes(test.id)}
                    onChange={() => toggleTest(test.id)}
                    className="mt-0.5"
                  />
                  <div>
                    <p className="text-xs font-medium">{test.label}</p>
                    <p className="text-[10px] text-muted-foreground">{test.description}</p>
                    <Badge variant="outline" className="text-[9px] mt-0.5 h-4">{test.owasp}</Badge>
                  </div>
                </label>
              ))}
            </div>
            <div className="flex gap-2 mt-2">
              <Button variant="link" size="sm" className="h-5 p-0 text-xs" onClick={() => setSelectedTests(SCAN_TYPES.map(t => t.id))}>
                Select All
              </Button>
              <Button variant="link" size="sm" className="h-5 p-0 text-xs" onClick={() => setSelectedTests([])}>
                Clear All
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      {result && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              Scan Results
              <Badge variant={result.findings.length === 0 ? "default" : "destructive"} className="text-xs">
                {result.findings.length} finding(s)
              </Badge>
              <span className="text-xs text-muted-foreground font-normal">
                in {(result.duration_ms / 1000).toFixed(1)}s — {result.total_tests} tests
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Summary bars */}
            <div className="flex gap-2">
              {["critical", "high", "medium", "low", "info"].map(sev => {
                const count = result.summary?.[sev] || 0;
                return (
                  <Button
                    key={sev}
                    variant={severityFilter === sev ? "default" : "outline"}
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => setSeverityFilter(severityFilter === sev ? "all" : sev)}
                  >
                    <Badge className={`${severityColor(sev)} mr-1 text-[10px] h-4 px-1.5`}>{count}</Badge>
                    {sev}
                  </Button>
                );
              })}
              {severityFilter !== "all" && (
                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setSeverityFilter("all")}>
                  Show all
                </Button>
              )}
            </div>

            {result.findings.length === 0 ? (
              <Alert>
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <AlertDescription>No security vulnerabilities found. Your API passed all selected tests.</AlertDescription>
              </Alert>
            ) : (
              <ScrollArea className="h-[400px]">
                <div className="space-y-2">
                  {filteredFindings.map(finding => (
                    <div key={finding.id} className="border rounded-lg overflow-hidden">
                      <div
                        className="flex items-center gap-2 p-3 cursor-pointer hover:bg-muted/30 transition-colors"
                        onClick={() => setExpandedFinding(expandedFinding === finding.id ? null : finding.id)}
                      >
                        {expandedFinding === finding.id ? (
                          <ChevronDown className="w-4 h-4 shrink-0" />
                        ) : (
                          <ChevronRight className="w-4 h-4 shrink-0" />
                        )}
                        {severityIcon(finding.severity)}
                        <Badge className={`${severityColor(finding.severity)} text-[10px] h-5 shrink-0`}>
                          {finding.severity.toUpperCase()}
                        </Badge>
                        <span className="text-sm font-medium flex-1 truncate">{finding.title}</span>
                        <span className="text-xs text-muted-foreground font-mono shrink-0">
                          {finding.method} {finding.endpoint}
                        </span>
                        {finding.cwe_id && (
                          <Badge variant="outline" className="text-[9px] h-4 shrink-0">{finding.cwe_id}</Badge>
                        )}
                      </div>
                      {expandedFinding === finding.id && (
                        <div className="px-3 pb-3 space-y-2 border-t bg-muted/10">
                          <div className="pt-2">
                            <p className="text-xs font-medium text-muted-foreground">Description</p>
                            <p className="text-sm">{finding.description}</p>
                          </div>
                          {finding.evidence && (
                            <div>
                              <p className="text-xs font-medium text-muted-foreground">Evidence</p>
                              <pre className="text-xs bg-muted p-2 rounded font-mono overflow-x-auto">{finding.evidence}</pre>
                            </div>
                          )}
                          <div>
                            <p className="text-xs font-medium text-green-600 dark:text-green-400">Remediation</p>
                            <p className="text-sm">{finding.remediation}</p>
                          </div>
                          <div className="flex gap-2 text-xs text-muted-foreground">
                            <span>Category: {finding.category}</span>
                            {finding.cwe_id && <span>CWE: {finding.cwe_id}</span>}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
