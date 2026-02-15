/**
 * Report export and generation functions for API test results.
 * Supports JUnit XML, HTML, JSON, and Allure formats.
 *
 * All functions accept executionResults as a parameter (no closure dependency).
 * Download functions also accept a toast callback for user notification.
 *
 * Extracted from EnhancedAPITesting.tsx for code splitting.
 */

type ToastFn = (opts: { title: string; description: string }) => void;

// ---------------------------------------------------------------------------
// Helpers: trigger file download
// ---------------------------------------------------------------------------

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function dateSuffix(): string {
  return new Date().toISOString().split('T')[0];
}

// ---------------------------------------------------------------------------
// Content generators (return strings for inline viewing)
// ---------------------------------------------------------------------------

export function generateJUnitXMLContent(executionResults: any): string {
  if (!executionResults) return '';
  const testResults = executionResults.test_results || [];
  const summary = executionResults.summary || {};
  return `<?xml version="1.0" encoding="UTF-8"?>
<testsuite name="API Test Suite" tests="${summary.total || 0}" failures="${summary.failed || 0}" errors="0" time="${(summary.total_duration_ms || 0) / 1000}">
${testResults.map((result: any, idx: number) => `  <testcase name="${result.title || result.name || `Test ${idx + 1}`}" classname="api.tests" time="${(result.response_time_ms || 0) / 1000}">
${result.status !== 'passed' ? `    <failure message="${result.error_message || 'Test failed'}" type="${result.error_type || 'AssertionError'}">
      Expected: ${result.expected_status || 200}
      Actual: ${result.actual_status || 'N/A'}
    </failure>` : ''}
  </testcase>`).join('\n')}
</testsuite>`;
}

export function generateHTMLContent(executionResults: any): string {
  if (!executionResults) return '';
  const testResults = executionResults.test_results || [];
  const summary = executionResults.summary || {};
  return `<!DOCTYPE html>
<html>
<head>
  <title>API Test Report - ${new Date().toLocaleDateString()}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 20px; background: #f5f5f5; }
    .container { max-width: 100%; background: white; padding: 24px; border-radius: 8px; }
    h1 { color: #333; border-bottom: 2px solid #4f46e5; padding-bottom: 10px; font-size: 1.5rem; }
    h2 { font-size: 1.2rem; margin-top: 20px; }
    .summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin: 20px 0; }
    .stat { text-align: center; padding: 16px; background: #f8f9fa; border-radius: 8px; }
    .stat-value { font-size: 28px; font-weight: bold; }
    .stat-label { color: #666; margin-top: 4px; font-size: 12px; }
    .passed { color: #22c55e; }
    .failed { color: #ef4444; }
    table { width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 13px; }
    th, td { padding: 10px; text-align: left; border-bottom: 1px solid #eee; }
    th { background: #f8f9fa; font-weight: 600; }
    .badge { padding: 3px 10px; border-radius: 12px; font-size: 11px; display: inline-block; }
    .badge-pass { background: #dcfce7; color: #166534; }
    .badge-fail { background: #fee2e2; color: #991b1b; }
    .timestamp { color: #888; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <h1>API Test Report</h1>
    <p class="timestamp">Generated: ${new Date().toLocaleString()}</p>
    <div class="summary">
      <div class="stat"><div class="stat-value">${summary.total || 0}</div><div class="stat-label">Total Tests</div></div>
      <div class="stat"><div class="stat-value passed">${summary.passed || 0}</div><div class="stat-label">Passed</div></div>
      <div class="stat"><div class="stat-value failed">${summary.failed || 0}</div><div class="stat-label">Failed</div></div>
      <div class="stat"><div class="stat-value">${summary.pass_rate?.toFixed(1) || 0}%</div><div class="stat-label">Pass Rate</div></div>
    </div>
    <h2>Test Results</h2>
    <table>
      <thead><tr><th>Test Case</th><th>Status</th><th>Response Time</th><th>Status Code</th></tr></thead>
      <tbody>
        ${testResults.map((result: any, idx: number) => `
        <tr>
          <td>${result.title || result.name || `Test ${idx + 1}`}</td>
          <td><span class="badge ${result.status === 'passed' ? 'badge-pass' : 'badge-fail'}">${result.status || 'unknown'}</span></td>
          <td>${result.response_time_ms?.toFixed(2) || 'N/A'}ms</td>
          <td>${result.actual_status || result.status_code || 'N/A'}</td>
        </tr>`).join('')}
      </tbody>
    </table>
  </div>
</body>
</html>`;
}

export function generateAllureContent(executionResults: any): string {
  if (!executionResults) return '';
  const testResults = executionResults.test_results || [];
  const executionId = executionResults.execution_id || `exec_${Date.now()}`;
  const allureResults = testResults.map((result: any, idx: number) => {
    const uuid = `${executionId}_${idx}`;
    const startTime = result.start_time ? new Date(result.start_time).getTime() : Date.now();
    return {
      uuid, name: result.title || result.name || `Test ${idx + 1}`,
      status: result.status === 'passed' ? 'passed' : 'failed',
      start: startTime, stop: startTime + (result.response_time_ms || 0),
      labels: [{ name: 'suite', value: 'API Test Suite' }],
      parameters: [
        { name: 'endpoint', value: result.endpoint || result.url || '' },
        { name: 'method', value: result.method || 'GET' }
      ]
    };
  });
  return JSON.stringify({ format: 'allure2', results: allureResults }, null, 2);
}

// ---------------------------------------------------------------------------
// Download functions (trigger browser file downloads)
// ---------------------------------------------------------------------------

export function exportAsJUnitXML(executionResults: any, toast: ToastFn) {
  if (!executionResults) return;

  const testResults = executionResults.test_results || [];
  const summary = executionResults.summary || {};

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<testsuite name="API Test Suite" tests="${summary.total || 0}" failures="${summary.failed || 0}" errors="0" time="${(summary.total_duration_ms || 0) / 1000}">
${testResults.map((result: any, idx: number) => `  <testcase name="${result.title || result.name || `Test ${idx + 1}`}" classname="api.tests" time="${(result.response_time_ms || 0) / 1000}">
${result.status !== 'passed' ? `    <failure message="${result.error_message || 'Test failed'}" type="${result.error_type || 'AssertionError'}">
      Expected: ${result.expected_status || 200}
      Actual: ${result.actual_status || 'N/A'}
    </failure>` : ''}
  </testcase>`).join('\n')}
</testsuite>`;

  downloadBlob(new Blob([xml], { type: 'application/xml' }), `api-test-results-${dateSuffix()}.xml`);
  toast({ title: "Exported", description: "JUnit XML report downloaded" });
}

export function exportAsHTML(executionResults: any, toast: ToastFn) {
  if (!executionResults) return;

  const testResults = executionResults.test_results || [];
  const summary = executionResults.summary || {};

  const html = `<!DOCTYPE html>
<html>
<head>
  <title>API Test Report - ${new Date().toLocaleDateString()}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 40px; background: #f5f5f5; }
    .container { max-width: 1200px; margin: 0 auto; background: white; padding: 40px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
    h1 { color: #333; border-bottom: 2px solid #4f46e5; padding-bottom: 10px; }
    .summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; margin: 30px 0; }
    .stat { text-align: center; padding: 20px; background: #f8f9fa; border-radius: 8px; }
    .stat-value { font-size: 36px; font-weight: bold; }
    .stat-label { color: #666; margin-top: 5px; }
    .passed { color: #22c55e; }
    .failed { color: #ef4444; }
    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
    th, td { padding: 12px; text-align: left; border-bottom: 1px solid #eee; }
    th { background: #f8f9fa; font-weight: 600; }
    .badge { padding: 4px 12px; border-radius: 20px; font-size: 12px; }
    .badge-pass { background: #dcfce7; color: #166534; }
    .badge-fail { background: #fee2e2; color: #991b1b; }
    .timestamp { color: #888; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <h1>API Test Report</h1>
    <p class="timestamp">Generated: ${new Date().toLocaleString()}</p>

    <div class="summary">
      <div class="stat">
        <div class="stat-value">${summary.total || 0}</div>
        <div class="stat-label">Total Tests</div>
      </div>
      <div class="stat">
        <div class="stat-value passed">${summary.passed || 0}</div>
        <div class="stat-label">Passed</div>
      </div>
      <div class="stat">
        <div class="stat-value failed">${summary.failed || 0}</div>
        <div class="stat-label">Failed</div>
      </div>
      <div class="stat">
        <div class="stat-value">${summary.pass_rate?.toFixed(1) || 0}%</div>
        <div class="stat-label">Pass Rate</div>
      </div>
    </div>

    <h2>Test Results</h2>
    <table>
      <thead>
        <tr>
          <th>Test Case</th>
          <th>Status</th>
          <th>Response Time</th>
          <th>Status Code</th>
        </tr>
      </thead>
      <tbody>
        ${testResults.map((result: any, idx: number) => `
        <tr>
          <td>${result.title || result.name || `Test ${idx + 1}`}</td>
          <td><span class="badge ${result.status === 'passed' ? 'badge-pass' : 'badge-fail'}">${result.status || 'unknown'}</span></td>
          <td>${result.response_time_ms?.toFixed(2) || 'N/A'}ms</td>
          <td>${result.actual_status || result.status_code || 'N/A'}</td>
        </tr>`).join('')}
      </tbody>
    </table>
  </div>
</body>
</html>`;

  downloadBlob(new Blob([html], { type: 'text/html' }), `api-test-report-${dateSuffix()}.html`);
  toast({ title: "Exported", description: "HTML report downloaded" });
}

export function exportAsJSON(executionResults: any, toast: ToastFn) {
  if (!executionResults) return;

  downloadBlob(
    new Blob([JSON.stringify(executionResults, null, 2)], { type: 'application/json' }),
    `api-test-results-${dateSuffix()}.json`
  );
  toast({ title: "Exported", description: "JSON results downloaded" });
}

export function exportAsAllure(executionResults: any, toast: ToastFn) {
  if (!executionResults) return;

  const testResults = executionResults.test_results || [];
  const executionId = executionResults.execution_id || `exec_${Date.now()}`;

  // Generate Allure-compatible JSON files
  const allureResults: any[] = testResults.map((result: any, idx: number) => {
    const uuid = `${executionId}_${idx}_${Date.now()}`;
    const startTime = result.start_time ? new Date(result.start_time).getTime() : Date.now() - (result.response_time_ms || 0);
    const stopTime = startTime + (result.response_time_ms || 0);

    return {
      uuid: uuid,
      historyId: `${result.test_case_id || result.title || `test_${idx}`}`,
      name: result.title || result.name || `Test ${idx + 1}`,
      fullName: `api.tests.${result.test_case_id || `test_${idx}`}`,
      status: result.status === 'passed' ? 'passed' : 'failed',
      statusDetails: result.status !== 'passed' ? {
        message: result.error_message || 'Test failed',
        trace: result.stack_trace || ''
      } : undefined,
      stage: 'finished',
      start: startTime,
      stop: stopTime,
      labels: [
        { name: 'suite', value: 'API Test Suite' },
        { name: 'subSuite', value: result.category || 'functional' },
        { name: 'host', value: 'localhost' },
        { name: 'thread', value: 'main' },
        { name: 'package', value: 'api.tests' },
        { name: 'testMethod', value: result.method || 'GET' },
        { name: 'severity', value: result.priority || 'normal' },
        ...(result.tags || []).map((tag: string) => ({ name: 'tag', value: tag }))
      ],
      parameters: [
        { name: 'endpoint', value: result.endpoint || result.url || '' },
        { name: 'method', value: result.method || 'GET' },
        { name: 'expected_status', value: String(result.expected_status || 200) },
        { name: 'actual_status', value: String(result.actual_status || result.status_code || '') }
      ],
      attachments: result.response_body ? [
        {
          name: 'Response Body',
          source: `${uuid}-response.json`,
          type: 'application/json'
        }
      ] : [],
      steps: [
        {
          name: `${result.method || 'GET'} ${result.endpoint || result.url || '/'}`,
          status: result.status === 'passed' ? 'passed' : 'failed',
          start: startTime,
          stop: stopTime,
          attachments: [],
          parameters: []
        }
      ]
    };
  });

  // Create a ZIP-like structure with all results
  const allureContainer = {
    uuid: executionId,
    name: 'API Test Suite',
    children: allureResults.map(r => r.uuid),
    befores: [],
    afters: [],
    start: Math.min(...allureResults.map(r => r.start)),
    stop: Math.max(...allureResults.map(r => r.stop))
  };

  // Export as single JSON file (can be used with allure generate)
  const allureExport = {
    _meta: {
      format: 'allure2',
      version: '2.0',
      generated: new Date().toISOString()
    },
    container: allureContainer,
    results: allureResults
  };

  downloadBlob(
    new Blob([JSON.stringify(allureExport, null, 2)], { type: 'application/json' }),
    `allure-results-${dateSuffix()}.json`
  );
  toast({
    title: "Exported",
    description: "Allure format results downloaded. Use 'allure generate' to create the report.",
  });
}
