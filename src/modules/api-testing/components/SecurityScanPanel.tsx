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

  // Client-side security scan fallback when backend endpoint is unavailable
  const runClientSideScan = useCallback(async (): Promise<ScanResult> => {
    const findings: Finding[] = [];
    const startTime = Date.now();
    let testCount = 0;

    // Helper: make a test request via the backend proxy
    const testRequest = async (method: string, url: string, headers?: Record<string, string>, body?: any) => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/v2/testing/execute`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            test_suite: {
              test_cases: [{
                test_case_id: `sec_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
                title: "Security Test",
                method,
                path: url,
                request: { headers: headers || {}, body },
                expected_status: 200,
                assertions: [],
                test_type: "security",
              }],
              base_url: "",
            },
            execution_config: { base_url: "", parallel: false },
            mode: "automated",
          }),
        });
        const data = await res.json();
        const result = data?.execution_results?.test_results?.[0] || data?.test_results?.[0];
        return {
          status: result?.actual_status ?? result?.status_code ?? 0,
          body: result?.response_body ?? result?.response_data ?? "",
          headers: result?.response_headers ?? {},
          error: result?.error,
        };
      } catch {
        return { status: 0, body: "", headers: {}, error: "Request failed" };
      }
    };

    // AUTH_MATRIX: test without auth
    if (selectedTests.includes("auth_matrix")) {
      testCount++;
      const res = await testRequest("GET", targetUrl);
      if (res.status === 200) {
        findings.push({
          id: `f_${Date.now()}_auth`, title: "Endpoint accessible without authentication",
          category: "auth_matrix", severity: "high",
          description: `${targetUrl} returned 200 OK without any authentication headers. The endpoint may be missing authentication controls.`,
          evidence: `GET ${targetUrl} → ${res.status} (no auth headers sent)`,
          remediation: "Implement authentication middleware (Bearer token, API key, or session-based auth) on all sensitive endpoints.",
          endpoint: targetUrl, method: "GET", cwe_id: "CWE-306",
        });
      }
    }

    // INJECTION: test with SQL injection payload
    if (selectedTests.includes("injection")) {
      testCount++;
      const injectionUrl = targetUrl.includes("?")
        ? `${targetUrl}&id=' OR 1=1 --`
        : `${targetUrl}?id=' OR 1=1 --`;
      const res = await testRequest("GET", injectionUrl);
      if (res.status === 200 && !res.error) {
        const bodyStr = typeof res.body === "string" ? res.body : JSON.stringify(res.body || "");
        if (bodyStr.length > 10 && !bodyStr.includes("error") && !bodyStr.includes("invalid")) {
          findings.push({
            id: `f_${Date.now()}_sqli`, title: "Possible SQL injection vulnerability",
            category: "injection", severity: "critical",
            description: "The endpoint returned a successful response when a SQL injection payload was sent. This could indicate the input is not properly sanitized.",
            evidence: `GET ${injectionUrl} → ${res.status} (response body: ${bodyStr.slice(0, 200)}...)`,
            remediation: "Use parameterized queries/prepared statements. Never concatenate user input into SQL queries. Implement input validation.",
            endpoint: targetUrl, method: "GET", cwe_id: "CWE-89",
          });
        }
      }
      // Also test POST with JSON injection
      testCount++;
      const postRes = await testRequest("POST", targetUrl, { "Content-Type": "application/json" }, { test: "'; DROP TABLE users; --" });
      if (postRes.status && postRes.status < 400 && !postRes.error) {
        findings.push({
          id: `f_${Date.now()}_sqli_post`, title: "POST endpoint may be vulnerable to injection",
          category: "injection", severity: "medium",
          description: "The endpoint accepted a POST request with injection payloads without returning an error.",
          evidence: `POST ${targetUrl} with injection payload → ${postRes.status}`,
          remediation: "Validate and sanitize all input fields. Use parameterized queries for database operations.",
          endpoint: targetUrl, method: "POST", cwe_id: "CWE-89",
        });
      }
    }

    // RATE_LIMITING: send rapid requests
    if (selectedTests.includes("rate_limiting")) {
      testCount++;
      let allOk = true;
      for (let i = 0; i < 10; i++) {
        const res = await testRequest("GET", targetUrl);
        if (res.status === 429) { allOk = false; break; }
      }
      if (allOk) {
        findings.push({
          id: `f_${Date.now()}_rate`, title: "No rate limiting detected",
          category: "rate_limiting", severity: "medium",
          description: "10 rapid sequential requests all returned successfully. No rate limiting (HTTP 429) was enforced.",
          evidence: "10 rapid GET requests → all returned 200 (no 429 detected)",
          remediation: "Implement rate limiting using token bucket or sliding window algorithms. Return HTTP 429 with Retry-After header.",
          endpoint: targetUrl, method: "GET", cwe_id: "CWE-770",
        });
      }
    }

    // BOLA: test with modified IDs
    if (selectedTests.includes("bola")) {
      testCount++;
      // Try accessing resource with different ID patterns
      const baseWithId = targetUrl.replace(/\/(\d+)([/?#]|$)/, '/99999$2');
      if (baseWithId !== targetUrl) {
        const res = await testRequest("GET", baseWithId);
        if (res.status === 200) {
          findings.push({
            id: `f_${Date.now()}_bola`, title: "Possible BOLA — different resource ID accessible",
            category: "bola", severity: "high",
            description: "Changing the resource ID in the URL returned a successful response. Without proper authorization checks, users may access other users' resources.",
            evidence: `GET ${baseWithId} → ${res.status} (original URL had different ID)`,
            remediation: "Implement object-level authorization checks. Verify that the requesting user has permission to access the specific resource.",
            endpoint: targetUrl, method: "GET", cwe_id: "CWE-639",
          });
        }
      }
    }

    // MASS_ASSIGNMENT: test with extra fields
    if (selectedTests.includes("mass_assignment")) {
      testCount++;
      const res = await testRequest("POST", targetUrl, { "Content-Type": "application/json" }, {
        test_field: "test_value",
        is_admin: true,
        role: "admin",
        __proto__: { admin: true },
      });
      if (res.status && res.status < 400 && !res.error) {
        const bodyStr = typeof res.body === "string" ? res.body : JSON.stringify(res.body || "");
        if (bodyStr.includes("admin") || bodyStr.includes("is_admin")) {
          findings.push({
            id: `f_${Date.now()}_mass`, title: "Possible mass assignment vulnerability",
            category: "mass_assignment", severity: "high",
            description: "The endpoint accepted extra fields (is_admin, role) in the request body and they appeared in the response, suggesting the API may be vulnerable to mass assignment.",
            evidence: `POST ${targetUrl} with {is_admin: true, role: "admin"} → ${res.status}`,
            remediation: "Use an allowlist of permitted fields for each endpoint. Never directly bind request data to internal objects without filtering.",
            endpoint: targetUrl, method: "POST", cwe_id: "CWE-915",
          });
        }
      }
    }

    // SSRF: test with internal URL
    if (selectedTests.includes("ssrf")) {
      testCount++;
      const res = await testRequest("POST", targetUrl, { "Content-Type": "application/json" }, {
        url: "http://169.254.169.254/latest/meta-data/",
        callback: "http://localhost:8080/admin",
      });
      if (res.status && res.status < 400 && !res.error) {
        findings.push({
          id: `f_${Date.now()}_ssrf`, title: "Endpoint accepts URL parameters (potential SSRF)",
          category: "ssrf", severity: "low",
          description: "The endpoint accepted a request body containing internal URL references without rejection. If the server fetches these URLs, it could be vulnerable to SSRF.",
          evidence: `POST ${targetUrl} with internal URLs → ${res.status}`,
          remediation: "Validate and sanitize URL inputs. Block requests to internal/private IP ranges (169.254.x.x, 10.x.x.x, 127.x.x.x, localhost).",
          endpoint: targetUrl, method: "POST", cwe_id: "CWE-918",
        });
      }
    }

    const duration = Date.now() - startTime;
    const summary: Record<string, number> = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
    findings.forEach(f => { summary[f.severity] = (summary[f.severity] || 0) + 1; });

    return {
      scan_id: `scan_${Date.now()}`,
      target_url: targetUrl,
      duration_ms: duration,
      total_tests: testCount,
      findings,
      summary,
    };
  }, [targetUrl, selectedTests]);

  const handleScan = useCallback(async () => {
    if (!targetUrl.trim()) {
      toast({ title: "Missing URL", description: "Enter a target API URL", variant: "destructive" });
      return;
    }
    if (!targetUrl.match(/^https?:\/\//i)) {
      toast({ title: "Invalid URL", description: "URL must start with http:// or https://", variant: "destructive" });
      return;
    }
    setScanning(true);
    setResult(null);
    try {
      // Try backend first
      const res = await fetch(`${API_BASE_URL}/api/v2/testing/security/scan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target_url: targetUrl,
          tests: selectedTests,
        }),
      });
      if (!res.ok) throw new Error(`Backend scan failed: ${res.statusText}`);
      const data = await res.json();
      setResult(data);
      const totalFindings = data.findings?.length || 0;
      toast({
        title: "Scan complete",
        description: `${totalFindings} finding(s) in ${((data.duration_ms || 0) / 1000).toFixed(1)}s`,
      });
    } catch {
      // Fallback: run client-side security scan via the API proxy
      try {
        const clientResult = await runClientSideScan();
        setResult(clientResult);
        toast({
          title: "Scan complete (client-side)",
          description: `${clientResult.findings.length} finding(s) in ${(clientResult.duration_ms / 1000).toFixed(1)}s`,
        });
      } catch (err2: any) {
        toast({ title: "Scan failed", description: err2.message, variant: "destructive" });
      }
    } finally {
      setScanning(false);
    }
  }, [targetUrl, selectedTests, toast, runClientSideScan]);

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
