"""
HTML Test Report Generator

Generates self-contained HTML reports from test run results.
Reports are standalone (inline CSS, no external dependencies) and can be
shared with stakeholders, attached to emails, or archived.
"""

from typing import Dict, Any, List, Optional
from datetime import datetime
import html
import logging

logger = logging.getLogger(__name__)


class HTMLReportGenerator:
    """Generate self-contained HTML reports from test execution results."""

    @staticmethod
    def generate(test_run: Dict[str, Any]) -> str:
        """
        Generate a self-contained HTML report from a test run result.

        Args:
            test_run: Same format as JUnitReportGenerator.generate()

        Returns:
            Complete HTML document string
        """
        try:
            steps = test_run.get('steps', [])
            test_case_name = html.escape(test_run.get('test_case_name', test_run.get('name', 'Unknown Test')))
            status = test_run.get('status', 'unknown')
            duration_ms = test_run.get('duration_ms', 0) or 0
            started_at = test_run.get('started_at', datetime.utcnow().isoformat())
            environment = html.escape(str(test_run.get('environment', 'Default')))

            total = len(steps)
            passed = sum(1 for s in steps if s.get('status') == 'passed')
            failed = sum(1 for s in steps if s.get('status') == 'failed')
            skipped = sum(1 for s in steps if s.get('status') == 'skipped')
            healed = sum(1 for s in steps if s.get('healed'))

            status_color = '#22c55e' if status == 'passed' else '#ef4444' if status == 'failed' else '#6b7280'
            status_label = status.upper()

            # Build step rows
            step_rows = []
            for idx, step in enumerate(steps):
                s_status = step.get('status', 'passed')
                s_name = html.escape(step.get('name', step.get('description', f'Step {idx + 1}')))
                s_error = html.escape(step.get('error', '')) if step.get('error') else ''
                s_healed = step.get('healed', False)
                s_selector = html.escape(step.get('working_selector', '')) if step.get('working_selector') else ''
                s_duration = step.get('duration_ms', 0) or 0

                icon = '&#x2705;' if s_status == 'passed' else '&#x274C;' if s_status == 'failed' else '&#x23ED;' if s_status == 'skipped' else '&#x2B55;'
                row_bg = '#f0fdf4' if s_status == 'passed' else '#fef2f2' if s_status == 'failed' else '#f9fafb'

                error_html = f'<div style="color:#dc2626;font-size:12px;margin-top:4px;font-family:monospace;background:#fee2e2;padding:6px;border-radius:4px;">{s_error}</div>' if s_error else ''
                healed_html = f'<div style="color:#d97706;font-size:12px;margin-top:4px;background:#fef3c7;padding:6px;border-radius:4px;">&#x1F527; Self-healed: <code>{s_selector}</code></div>' if s_healed and s_selector else ''

                screenshot_html = ''
                if step.get('screenshot'):
                    screenshot_html = f'<div style="margin-top:8px;"><img src="data:image/png;base64,{step["screenshot"]}" style="max-width:400px;border:1px solid #d1d5db;border-radius:4px;" /></div>'

                step_rows.append(f'''
                <div style="display:flex;align-items:flex-start;gap:12px;padding:10px 16px;background:{row_bg};border-bottom:1px solid #e5e7eb;">
                    <span style="font-size:12px;color:#6b7280;min-width:28px;text-align:right;">{idx + 1}</span>
                    <span style="font-size:16px;">{icon}</span>
                    <div style="flex:1;">
                        <div style="font-size:14px;font-weight:500;">{s_name}</div>
                        {error_html}
                        {healed_html}
                        {screenshot_html}
                    </div>
                    <span style="font-size:12px;color:#9ca3af;">{s_duration}ms</span>
                </div>''')

            steps_html = '\n'.join(step_rows)

            return f'''<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Test Report: {test_case_name}</title>
<style>
  * {{ margin: 0; padding: 0; box-sizing: border-box; }}
  body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f3f4f6; color: #111827; }}
  .container {{ max-width: 900px; margin: 24px auto; padding: 0 16px; }}
  .header {{ background: white; border-radius: 8px; padding: 24px; margin-bottom: 16px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }}
  .status-badge {{ display: inline-block; padding: 4px 12px; border-radius: 9999px; font-weight: 700; font-size: 13px; color: white; }}
  .summary {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 12px; margin-bottom: 16px; }}
  .summary-card {{ background: white; border-radius: 8px; padding: 16px; text-align: center; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }}
  .summary-card .value {{ font-size: 28px; font-weight: 700; }}
  .summary-card .label {{ font-size: 12px; color: #6b7280; margin-top: 4px; }}
  .steps {{ background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }}
  .steps-header {{ padding: 16px; border-bottom: 1px solid #e5e7eb; font-weight: 600; font-size: 16px; }}
  .footer {{ text-align: center; padding: 24px; color: #9ca3af; font-size: 12px; }}
</style>
</head>
<body>
<div class="container">
  <div class="header">
    <div style="display:flex;justify-content:space-between;align-items:center;">
      <div>
        <h1 style="font-size:20px;margin-bottom:8px;">{test_case_name}</h1>
        <div style="font-size:13px;color:#6b7280;">
          Environment: {environment} &bull; Started: {started_at} &bull; Duration: {duration_ms}ms
        </div>
      </div>
      <span class="status-badge" style="background:{status_color};">{status_label}</span>
    </div>
  </div>

  <div class="summary">
    <div class="summary-card"><div class="value">{total}</div><div class="label">Total Steps</div></div>
    <div class="summary-card"><div class="value" style="color:#22c55e;">{passed}</div><div class="label">Passed</div></div>
    <div class="summary-card"><div class="value" style="color:#ef4444;">{failed}</div><div class="label">Failed</div></div>
    <div class="summary-card"><div class="value" style="color:#6b7280;">{skipped}</div><div class="label">Skipped</div></div>
    <div class="summary-card"><div class="value" style="color:#d97706;">{healed}</div><div class="label">Healed</div></div>
  </div>

  <div class="steps">
    <div class="steps-header">Step Timeline</div>
    {steps_html}
  </div>

  <div class="footer">
    Generated by Flowstral &bull; {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S UTC')}
  </div>
</div>
</body>
</html>'''

        except Exception as e:
            logger.error(f"Failed to generate HTML report: {e}")
            return f'<html><body><h1>Report Error</h1><p>{html.escape(str(e))}</p></body></html>'
