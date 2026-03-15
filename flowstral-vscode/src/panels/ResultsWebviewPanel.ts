import * as vscode from 'vscode';

type ResultType = 'test-run' | 'accessibility' | 'exploration' | 'api-test' | 'ai-test';

export class ResultsWebviewPanel {
  public static currentPanel: ResultsWebviewPanel | undefined;
  private static readonly viewType = 'flowstralResults';

  private readonly panel: vscode.WebviewPanel;
  private disposables: vscode.Disposable[] = [];

  private constructor(panel: vscode.WebviewPanel) {
    this.panel = panel;

    this.panel.onDidDispose(() => this.dispose(), null, this.disposables);
  }

  public static createOrShow(
    context: vscode.ExtensionContext,
    data: unknown,
    type: ResultType
  ): void {
    const column = vscode.ViewColumn.Beside;

    if (ResultsWebviewPanel.currentPanel) {
      ResultsWebviewPanel.currentPanel.panel.reveal(column);
      ResultsWebviewPanel.currentPanel.update(data, type);
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      ResultsWebviewPanel.viewType,
      'Flowstral Results',
      column,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [],
      }
    );

    ResultsWebviewPanel.currentPanel = new ResultsWebviewPanel(panel);
    ResultsWebviewPanel.currentPanel.update(data, type);
  }

  private update(data: unknown, type: ResultType): void {
    this.panel.title = this.getTitle(type);
    this.panel.webview.html = this.getHtml(data, type);
  }

  private getTitle(type: ResultType): string {
    switch (type) {
      case 'test-run':
        return 'Test Results';
      case 'accessibility':
        return 'Accessibility Scan';
      case 'exploration':
        return 'Exploration Results';
      case 'api-test':
        return 'API Test Results';
      case 'ai-test':
        return 'AI Test Results';
      default:
        return 'Flowstral Results';
    }
  }

  private getHtml(data: unknown, type: ResultType): string {
    let content = '';

    switch (type) {
      case 'test-run':
        content = this.renderTestRun(data);
        break;
      case 'accessibility':
        content = this.renderAccessibility(data);
        break;
      case 'exploration':
        content = this.renderExploration(data);
        break;
      case 'api-test':
        content = this.renderApiTest(data);
        break;
      case 'ai-test':
        content = this.renderAiTest(data);
        break;
      default:
        content = `<pre>${this.escapeHtml(JSON.stringify(data, null, 2))}</pre>`;
    }

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Flowstral Results</title>
  <style>
    :root {
      --bg: var(--vscode-editor-background);
      --fg: var(--vscode-editor-foreground);
      --border: var(--vscode-panel-border);
      --card-bg: var(--vscode-editorWidget-background);
      --success: #22c55e;
      --error: #ef4444;
      --warning: #f59e0b;
      --info: #3b82f6;
      --muted: var(--vscode-descriptionForeground);
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: var(--vscode-font-family, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif);
      font-size: var(--vscode-font-size, 13px);
      color: var(--fg);
      background: var(--bg);
      padding: 16px;
      line-height: 1.5;
    }

    .header {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 20px;
      padding-bottom: 12px;
      border-bottom: 1px solid var(--border);
    }

    .header h1 {
      font-size: 18px;
      font-weight: 600;
    }

    .badge {
      display: inline-block;
      padding: 2px 10px;
      border-radius: 12px;
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .badge-passed { background: #166534; color: #bbf7d0; }
    .badge-failed { background: #991b1b; color: #fecaca; }
    .badge-running { background: #1e40af; color: #bfdbfe; }
    .badge-critical { background: #991b1b; color: #fecaca; }
    .badge-serious { background: #9a3412; color: #fed7aa; }
    .badge-moderate { background: #854d0e; color: #fef08a; }
    .badge-minor { background: #374151; color: #d1d5db; }
    .badge-high { background: #9a3412; color: #fed7aa; }
    .badge-medium { background: #854d0e; color: #fef08a; }
    .badge-low { background: #374151; color: #d1d5db; }

    .meta {
      color: var(--muted);
      font-size: 12px;
      margin-bottom: 16px;
    }

    .card {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 6px;
      padding: 12px;
      margin-bottom: 12px;
    }

    .card-title {
      font-weight: 600;
      margin-bottom: 8px;
      font-size: 14px;
    }

    .summary-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
      gap: 12px;
      margin-bottom: 16px;
    }

    .summary-item {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 6px;
      padding: 12px;
      text-align: center;
    }

    .summary-value {
      font-size: 24px;
      font-weight: 700;
    }

    .summary-label {
      font-size: 11px;
      color: var(--muted);
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .step-list {
      list-style: none;
    }

    .step-item {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      padding: 8px;
      border-bottom: 1px solid var(--border);
    }

    .step-item:last-child { border-bottom: none; }

    .step-number {
      flex-shrink: 0;
      width: 24px;
      height: 24px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 11px;
      font-weight: 600;
      background: var(--border);
    }

    .step-passed .step-number { background: #166534; color: #bbf7d0; }
    .step-failed .step-number { background: #991b1b; color: #fecaca; }
    .step-skipped .step-number { background: #374151; color: #9ca3af; }

    .step-content { flex: 1; min-width: 0; }

    .step-action {
      font-weight: 600;
      font-size: 13px;
    }

    .step-target {
      font-size: 12px;
      color: var(--muted);
      word-break: break-all;
    }

    .step-error {
      margin-top: 4px;
      padding: 6px 8px;
      background: #450a0a;
      border-radius: 4px;
      font-size: 12px;
      color: #fca5a5;
    }

    .step-duration {
      flex-shrink: 0;
      font-size: 11px;
      color: var(--muted);
    }

    .step-healed {
      display: inline-block;
      padding: 1px 6px;
      border-radius: 4px;
      background: #1e3a5f;
      color: #93c5fd;
      font-size: 10px;
      margin-left: 4px;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 12px;
    }

    th, td {
      text-align: left;
      padding: 8px;
      border-bottom: 1px solid var(--border);
    }

    th {
      font-weight: 600;
      color: var(--muted);
      text-transform: uppercase;
      font-size: 10px;
      letter-spacing: 0.5px;
    }

    .screenshot {
      max-width: 100%;
      border: 1px solid var(--border);
      border-radius: 4px;
      margin: 8px 0;
    }

    pre {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 4px;
      padding: 12px;
      overflow-x: auto;
      font-family: var(--vscode-editor-font-family, monospace);
      font-size: 12px;
      white-space: pre-wrap;
      word-break: break-word;
    }

    .section { margin-bottom: 24px; }

    .section-title {
      font-size: 15px;
      font-weight: 600;
      margin-bottom: 12px;
      padding-bottom: 4px;
      border-bottom: 1px solid var(--border);
    }

    .status-icon { margin-right: 4px; }

    .page-item {
      padding: 6px 0;
      border-bottom: 1px solid var(--border);
      font-size: 12px;
    }

    .page-item:last-child { border-bottom: none; }

    .page-url {
      font-family: monospace;
      word-break: break-all;
    }

    .response-status {
      font-size: 32px;
      font-weight: 700;
    }

    .response-status.ok { color: var(--success); }
    .response-status.error { color: var(--error); }
    .response-status.redirect { color: var(--warning); }
  </style>
</head>
<body>
  ${content}
</body>
</html>`;
  }

  private renderTestRun(data: unknown): string {
    const run = data as Record<string, unknown>;
    const status = (run.status as string) || 'unknown';
    const testName = (run.test_name as string) || (run.test_case_id as string) || 'Test';
    const durationMs = run.duration_ms as number | undefined;
    const stepsTotal = run.steps_total as number | undefined;
    const stepsPassed = run.steps_passed as number | undefined;
    const stepsFailed = run.steps_failed as number | undefined;
    const results = (run.results as Array<Record<string, unknown>>) || [];

    let html = `
      <div class="header">
        <h1>${this.escapeHtml(testName)}</h1>
        <span class="badge badge-${status}">${status}</span>
        ${durationMs ? `<span class="meta">${this.formatDuration(durationMs)}</span>` : ''}
      </div>`;

    // Summary cards
    html += `
      <div class="summary-grid">
        <div class="summary-item">
          <div class="summary-value">${stepsTotal || results.length || 0}</div>
          <div class="summary-label">Total Steps</div>
        </div>
        <div class="summary-item">
          <div class="summary-value" style="color: var(--success)">${stepsPassed || 0}</div>
          <div class="summary-label">Passed</div>
        </div>
        <div class="summary-item">
          <div class="summary-value" style="color: var(--error)">${stepsFailed || 0}</div>
          <div class="summary-label">Failed</div>
        </div>
        ${durationMs ? `
        <div class="summary-item">
          <div class="summary-value">${this.formatDuration(durationMs)}</div>
          <div class="summary-label">Duration</div>
        </div>` : ''}
      </div>`;

    // Step list
    if (results.length > 0) {
      html += `<div class="section">
        <div class="section-title">Steps</div>
        <div class="card">
          <ul class="step-list">`;

      for (const step of results) {
        const stepStatus = (step.status as string) || 'pending';
        const stepNum = step.step_number as number;
        const action = (step.action as string) || '';
        const target = (step.target as string) || '';
        const selector = (step.selector as string) || '';
        const errorMsg = step.error_message as string | undefined;
        const stepDuration = step.duration_ms as number | undefined;
        const healed = step.healed as boolean;

        html += `
          <li class="step-item step-${stepStatus}">
            <div class="step-number">${stepNum || ''}</div>
            <div class="step-content">
              <div class="step-action">
                <span class="status-icon">${stepStatus === 'passed' ? '\u2713' : stepStatus === 'failed' ? '\u2717' : '\u2014'}</span>
                ${this.escapeHtml(action)}
                ${healed ? '<span class="step-healed">healed</span>' : ''}
              </div>
              ${target ? `<div class="step-target">${this.escapeHtml(target)}</div>` : ''}
              ${selector ? `<div class="step-target">Selector: ${this.escapeHtml(selector)}</div>` : ''}
              ${errorMsg ? `<div class="step-error">${this.escapeHtml(errorMsg)}</div>` : ''}
            </div>
            ${stepDuration ? `<div class="step-duration">${stepDuration}ms</div>` : ''}
          </li>`;
      }

      html += `</ul></div></div>`;
    }

    // Screenshots
    const screenshots = results
      .filter((s) => s.screenshot)
      .map((s) => ({ step: s.step_number, screenshot: s.screenshot as string }));

    if (screenshots.length > 0) {
      html += `<div class="section">
        <div class="section-title">Screenshots</div>`;
      for (const ss of screenshots) {
        html += `
          <div class="card">
            <div class="card-title">Step ${ss.step}</div>
            <img class="screenshot" src="data:image/png;base64,${ss.screenshot}" alt="Step ${ss.step} screenshot" />
          </div>`;
      }
      html += `</div>`;
    }

    return html;
  }

  private renderAccessibility(data: unknown): string {
    const scan = data as Record<string, unknown>;
    const url = (scan.url as string) || '';
    const wcagLevel = (scan.wcagLevel as string) || 'AA';
    const summary = (scan.summary as Record<string, number>) || {};
    const issues = (scan.issues as Array<Record<string, unknown>>) || [];

    let html = `
      <div class="header">
        <h1>Accessibility Scan</h1>
        <span class="meta">WCAG ${this.escapeHtml(wcagLevel)}</span>
      </div>
      <div class="meta">${this.escapeHtml(url)}</div>`;

    // Summary
    html += `
      <div class="summary-grid">
        <div class="summary-item">
          <div class="summary-value">${summary.total || issues.length || 0}</div>
          <div class="summary-label">Total Issues</div>
        </div>
        <div class="summary-item">
          <div class="summary-value" style="color: var(--error)">${summary.critical || 0}</div>
          <div class="summary-label">Critical</div>
        </div>
        <div class="summary-item">
          <div class="summary-value" style="color: #f97316">${summary.serious || 0}</div>
          <div class="summary-label">Serious</div>
        </div>
        <div class="summary-item">
          <div class="summary-value" style="color: var(--warning)">${summary.moderate || 0}</div>
          <div class="summary-label">Moderate</div>
        </div>
        <div class="summary-item">
          <div class="summary-value">${summary.minor || 0}</div>
          <div class="summary-label">Minor</div>
        </div>
      </div>`;

    // Issues table
    if (issues.length > 0) {
      html += `<div class="section">
        <div class="section-title">Issues</div>
        <div class="card">
          <table>
            <thead>
              <tr>
                <th>Impact</th>
                <th>Rule</th>
                <th>Description</th>
                <th>Element</th>
                <th>Suggested Fix</th>
              </tr>
            </thead>
            <tbody>`;

      for (const issue of issues) {
        const impact = (issue.impact as string) || 'unknown';
        html += `
          <tr>
            <td><span class="badge badge-${impact}">${impact}</span></td>
            <td>${this.escapeHtml((issue.rule as string) || '')}</td>
            <td>${this.escapeHtml((issue.description as string) || '')}</td>
            <td><code>${this.escapeHtml((issue.element as string) || '')}</code></td>
            <td>${this.escapeHtml((issue.suggested_fix as string) || '')}</td>
          </tr>`;
      }

      html += `</tbody></table></div></div>`;
    }

    return html;
  }

  private renderExploration(data: unknown): string {
    const result = data as Record<string, unknown>;
    const url = (result.url as string) || '';
    const pagesDiscovered = (result.pages_discovered as number) || 0;
    const pages = (result.pages as Array<Record<string, unknown>>) || [];
    const defects = (result.defects as Array<Record<string, unknown>>) || [];
    const forms = (result.forms as Array<Record<string, unknown>>) || [];
    const durationMs = result.duration_ms as number | undefined;

    let html = `
      <div class="header">
        <h1>Exploration Results</h1>
        ${durationMs ? `<span class="meta">${this.formatDuration(durationMs)}</span>` : ''}
      </div>
      <div class="meta">${this.escapeHtml(url)}</div>`;

    // Summary
    html += `
      <div class="summary-grid">
        <div class="summary-item">
          <div class="summary-value">${pagesDiscovered || pages.length}</div>
          <div class="summary-label">Pages Found</div>
        </div>
        <div class="summary-item">
          <div class="summary-value" style="color: ${defects.length > 0 ? 'var(--error)' : 'var(--success)'}">${defects.length}</div>
          <div class="summary-label">Defects</div>
        </div>
        <div class="summary-item">
          <div class="summary-value">${forms.length}</div>
          <div class="summary-label">Forms</div>
        </div>
      </div>`;

    // Defects
    if (defects.length > 0) {
      html += `<div class="section">
        <div class="section-title">Defects Found</div>`;
      for (const defect of defects) {
        const severity = (defect.severity as string) || 'medium';
        html += `
          <div class="card">
            <div class="card-title">
              <span class="badge badge-${severity}">${severity}</span>
              ${this.escapeHtml((defect.type as string) || '')}
            </div>
            <p>${this.escapeHtml((defect.description as string) || '')}</p>
            <div class="meta">URL: ${this.escapeHtml((defect.url as string) || '')}</div>
          </div>`;
      }
      html += `</div>`;
    }

    // Pages
    if (pages.length > 0) {
      html += `<div class="section">
        <div class="section-title">Discovered Pages</div>
        <div class="card">`;
      for (const page of pages.slice(0, 50)) {
        html += `
          <div class="page-item">
            <strong>${this.escapeHtml((page.title as string) || 'Untitled')}</strong>
            <div class="page-url">${this.escapeHtml((page.url as string) || '')}</div>
          </div>`;
      }
      if (pages.length > 50) {
        html += `<div class="meta" style="padding: 8px 0;">...and ${pages.length - 50} more pages</div>`;
      }
      html += `</div></div>`;
    }

    // Forms
    if (forms.length > 0) {
      html += `<div class="section">
        <div class="section-title">Forms</div>`;
      for (const form of forms) {
        const fields = (form.fields as string[]) || [];
        html += `
          <div class="card">
            <div class="card-title">${this.escapeHtml((form.method as string) || 'GET')} ${this.escapeHtml((form.action as string) || '')}</div>
            <div class="meta">URL: ${this.escapeHtml((form.url as string) || '')}</div>
            <div>Fields: ${fields.map((f) => this.escapeHtml(f)).join(', ') || 'none'}</div>
          </div>`;
      }
      html += `</div>`;
    }

    return html;
  }

  private renderApiTest(data: unknown): string {
    const result = data as Record<string, unknown>;
    const url = (result.url as string) || '';
    const method = (result.method as string) || 'GET';
    const statusCode = (result.status_code as number) || 0;
    const responseTime = (result.response_time_ms as number) || 0;
    const headers = (result.headers as Record<string, string>) || {};
    const body = result.body;
    const requestBody = result.requestBody as string | undefined;
    const assertions = (result.assertions as Array<Record<string, unknown>>) || [];

    const statusClass = statusCode >= 200 && statusCode < 300 ? 'ok' : statusCode >= 400 ? 'error' : 'redirect';

    let html = `
      <div class="header">
        <h1>API Test Results</h1>
        <span class="badge badge-${statusCode >= 200 && statusCode < 300 ? 'passed' : 'failed'}">${method}</span>
      </div>
      <div class="meta">${this.escapeHtml(url)}</div>`;

    // Summary
    html += `
      <div class="summary-grid">
        <div class="summary-item">
          <div class="response-status ${statusClass}">${statusCode}</div>
          <div class="summary-label">Status Code</div>
        </div>
        <div class="summary-item">
          <div class="summary-value">${responseTime}ms</div>
          <div class="summary-label">Response Time</div>
        </div>
      </div>`;

    // Request body
    if (requestBody) {
      html += `<div class="section">
        <div class="section-title">Request Body</div>
        <pre>${this.escapeHtml(this.formatJson(requestBody))}</pre>
      </div>`;
    }

    // Response headers
    const headerKeys = Object.keys(headers);
    if (headerKeys.length > 0) {
      html += `<div class="section">
        <div class="section-title">Response Headers</div>
        <div class="card">
          <table>
            <thead><tr><th>Header</th><th>Value</th></tr></thead>
            <tbody>`;
      for (const key of headerKeys) {
        html += `<tr><td><strong>${this.escapeHtml(key)}</strong></td><td>${this.escapeHtml(headers[key])}</td></tr>`;
      }
      html += `</tbody></table></div></div>`;
    }

    // Response body
    if (body !== undefined && body !== null) {
      html += `<div class="section">
        <div class="section-title">Response Body</div>
        <pre>${this.escapeHtml(typeof body === 'string' ? body : JSON.stringify(body, null, 2))}</pre>
      </div>`;
    }

    // Assertions
    if (assertions.length > 0) {
      html += `<div class="section">
        <div class="section-title">Assertions</div>
        <div class="card">
          <table>
            <thead><tr><th>Type</th><th>Result</th><th>Expected</th><th>Actual</th></tr></thead>
            <tbody>`;
      for (const assertion of assertions) {
        const passed = assertion.passed as boolean;
        html += `
          <tr>
            <td>${this.escapeHtml((assertion.type as string) || '')}</td>
            <td><span class="badge badge-${passed ? 'passed' : 'failed'}">${passed ? 'PASS' : 'FAIL'}</span></td>
            <td>${this.escapeHtml((assertion.expected as string) || '')}</td>
            <td>${this.escapeHtml((assertion.actual as string) || '')}</td>
          </tr>`;
      }
      html += `</tbody></table></div></div>`;
    }

    return html;
  }

  private renderAiTest(data: unknown): string {
    const result = data as Record<string, unknown>;
    const description = (result.description as string) || '';
    const targetUrl = (result.targetUrl as string) || '';
    const events = (result.events as Array<Record<string, unknown>>) || [];
    const results = result.results as Record<string, unknown> | undefined;

    let html = `
      <div class="header">
        <h1>AI Test Results</h1>
        <span class="badge badge-passed">AI Generated</span>
      </div>
      <div class="meta">Goal: ${this.escapeHtml(description)}</div>
      <div class="meta">URL: ${this.escapeHtml(targetUrl)}</div>`;

    // Extract step events
    const stepEvents = events.filter(
      (e) => e.type === 'step' || e.type === 'test_complete'
    );

    if (stepEvents.length > 0) {
      html += `<div class="section">
        <div class="section-title">Execution Steps</div>
        <div class="card">
          <ul class="step-list">`;

      let stepNum = 1;
      for (const event of stepEvents) {
        const eventData = event.data as Record<string, unknown> | undefined;
        const stepData = eventData || event;
        const action = (stepData.action as string) || (stepData.description as string) || (stepData.message as string) || '';
        const status = (stepData.status as string) || 'passed';

        if (event.type === 'step') {
          html += `
            <li class="step-item step-${status}">
              <div class="step-number">${stepNum++}</div>
              <div class="step-content">
                <div class="step-action">
                  <span class="status-icon">${status === 'passed' ? '\u2713' : status === 'failed' ? '\u2717' : '\u2014'}</span>
                  ${this.escapeHtml(action)}
                </div>
              </div>
            </li>`;
        }
      }

      html += `</ul></div></div>`;
    }

    // Raw results
    if (results) {
      html += `<div class="section">
        <div class="section-title">Full Results</div>
        <pre>${this.escapeHtml(JSON.stringify(results, null, 2))}</pre>
      </div>`;
    }

    return html;
  }

  private formatDuration(ms: number): string {
    if (ms < 1000) {
      return `${ms}ms`;
    }
    const seconds = Math.round(ms / 1000);
    if (seconds < 60) {
      return `${seconds}s`;
    }
    const minutes = Math.floor(seconds / 60);
    const remaining = seconds % 60;
    return `${minutes}m ${remaining}s`;
  }

  private formatJson(str: string): string {
    try {
      return JSON.stringify(JSON.parse(str), null, 2);
    } catch {
      return str;
    }
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  private dispose(): void {
    ResultsWebviewPanel.currentPanel = undefined;
    this.panel.dispose();
    while (this.disposables.length) {
      const disposable = this.disposables.pop();
      if (disposable) {
        disposable.dispose();
      }
    }
  }
}
