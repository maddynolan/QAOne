/**
 * Collection export functions (Postman, HAR) for the API Testing module.
 * These call backend endpoints to generate the export files.
 *
 * Extracted from EnhancedAPITesting.tsx for code splitting.
 */

import { API_BASE_URL } from "@/lib/api-config";

type ToastFn = (opts: { title: string; description: string; variant?: string }) => void;

/**
 * Export the current test suite as a Postman collection via backend.
 */
export async function exportToPostman(testSuite: any, toast: ToastFn) {
  if (!testSuite?.test_cases?.length) {
    toast({ title: "No test suite", description: "Import a spec or HAR first", variant: "destructive" });
    return;
  }
  try {
    const res = await fetch(`${API_BASE_URL}/api/import/export-postman`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ test_suite: testSuite, name: "QAAI API Collection" }),
    });
    if (!res.ok) throw new Error(await res.text());
    const data = await res.json();
    const blob = new Blob([data.collection_json], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "qaai-postman-collection.json";
    a.click();
    URL.revokeObjectURL(a.href);
    toast({ title: "Exported", description: "Postman collection downloaded" });
  } catch (e: any) {
    toast({ title: "Export failed", description: e?.message || "Failed to export Postman", variant: "destructive" });
  }
}

/**
 * Export the current test suite as a HAR file via backend.
 */
export async function exportToHAR(testSuite: any, toast: ToastFn) {
  if (!testSuite?.test_cases?.length) {
    toast({ title: "No test suite", description: "Import a spec or HAR first", variant: "destructive" });
    return;
  }
  try {
    const baseUrl = testSuite.base_url || "";
    const requests = (testSuite.test_cases || []).map((tc: any, _i: number) => {
      const req = tc.request || {};
      const url = req.url || (baseUrl + (tc.path || ""));
      return {
        url,
        method: tc.method || "GET",
        headers: req.headers || {},
        body: req.body,
        statusCode: tc.expected_status || 200,
        duration: 0,
        timestamp: Date.now() / 1000,
      };
    });
    const res = await fetch(`${API_BASE_URL}/api/import/export-har`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requests, creator_name: "QAAI" }),
    });
    if (!res.ok) throw new Error(await res.text());
    const data = await res.json();
    const blob = new Blob([data.har_json], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "qaai-export.har.json";
    a.click();
    URL.revokeObjectURL(a.href);
    toast({ title: "Exported", description: "HAR file downloaded" });
  } catch (e: any) {
    toast({ title: "Export failed", description: e?.message || "Failed to export HAR", variant: "destructive" });
  }
}
