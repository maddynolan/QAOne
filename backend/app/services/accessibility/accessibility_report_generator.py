"""
Accessibility Report Generator

Generates beautiful, actionable accessibility reports in multiple formats:
- HTML (viewable in browser, print to PDF)
- JSON (for API consumption)
- Markdown (for documentation)

Reports clearly explain:
- WHAT is wrong
- WHY it matters
- HOW to fix it
- WHO is affected
"""

import json
from typing import Dict, List, Any, Optional
from datetime import datetime
from pathlib import Path
import logging

logger = logging.getLogger(__name__)


class AccessibilityReportGenerator:
    """
    Generates professional accessibility reports from scan results.
    """
    
    def __init__(self):
        pass
    
    def generate_html_report(self, scan_result: Dict[str, Any]) -> str:
        """Generate a beautiful HTML report"""
        
        summary = scan_result.get("summary", {})
        violations = scan_result.get("violations", [])
        scan_info = scan_result.get("scan_info", {})
        executive_summary = scan_result.get("executive_summary", "")
        
        # Determine status color
        status = summary.get("status", "UNKNOWN")
        status_color = {
            "PASS": "#10b981",
            "MINOR_ISSUES": "#f59e0b", 
            "SERIOUS_ISSUES": "#f97316",
            "CRITICAL_ISSUES": "#ef4444"
        }.get(status, "#6b7280")
        
        score = summary.get("compliance_score", 0)
        score_color = "#10b981" if score >= 90 else "#f59e0b" if score >= 70 else "#ef4444"
        
        # Build violation cards
        violation_cards = ""
        for v in violations:
            impact_color = {
                "critical": "#ef4444",
                "serious": "#f97316",
                "moderate": "#f59e0b",
                "minor": "#3b82f6"
            }.get(v.get("impact"), "#6b7280")
            
            affected_html = ""
            for elem in v.get("affected_elements", [])[:3]:
                html_escaped = elem.get("html", "").replace("<", "&lt;").replace(">", "&gt;")
                affected_html += f"""
                <div class="code-block">
                    <code>{html_escaped}</code>
                    <p class="fix-hint">💡 {elem.get("fix_suggestion", "")}</p>
                </div>
                """
            
            wcag_badges = "".join([
                f'<span class="wcag-badge">{c}</span>'
                for c in v.get("wcag_criteria", [])
            ])
            
            violation_cards += f"""
            <div class="violation-card" style="border-left-color: {impact_color}">
                <div class="violation-header">
                    <span class="impact-badge" style="background: {impact_color}">
                        {v.get("impact_emoji", "")} {v.get("impact", "").upper()}
                    </span>
                    <span class="rule-id">{v.get("rule_id", "")}</span>
                </div>
                
                <h3>❌ What's Wrong</h3>
                <p>{v.get("what_is_wrong", "")}</p>
                
                <h3>⚠️ Why It Matters</h3>
                <p>{v.get("why_it_matters", "")}</p>
                
                <h3>✅ How to Fix</h3>
                <p class="fix-instruction">{v.get("how_to_fix", "")}</p>
                
                <h3>🎯 WCAG Criteria</h3>
                <div class="wcag-badges">{wcag_badges}</div>
                
                <h3>📍 Affected Elements ({v.get("element_count", 0)} found)</h3>
                {affected_html}
                
                <a href="{v.get("learn_more", "#")}" target="_blank" class="learn-more">
                    📚 Learn More →
                </a>
            </div>
            """
        
        html = f"""
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Accessibility Report - {scan_info.get("url", "")}</title>
    <style>
        * {{
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }}
        
        body {{
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
            line-height: 1.6;
            color: #1f2937;
            background: #f3f4f6;
            padding: 20px;
        }}
        
        .container {{
            max-width: 1000px;
            margin: 0 auto;
        }}
        
        .header {{
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 40px;
            border-radius: 16px;
            margin-bottom: 24px;
            text-align: center;
        }}
        
        .header h1 {{
            font-size: 2em;
            margin-bottom: 8px;
        }}
        
        .header .url {{
            opacity: 0.9;
            font-size: 0.95em;
            word-break: break-all;
        }}
        
        .header .timestamp {{
            opacity: 0.7;
            font-size: 0.85em;
            margin-top: 8px;
        }}
        
        .score-section {{
            display: flex;
            gap: 20px;
            margin-bottom: 24px;
        }}
        
        .score-card {{
            flex: 1;
            background: white;
            border-radius: 12px;
            padding: 24px;
            text-align: center;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }}
        
        .score-circle {{
            width: 120px;
            height: 120px;
            border-radius: 50%;
            margin: 0 auto 16px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 2.5em;
            font-weight: bold;
            color: white;
        }}
        
        .score-label {{
            font-size: 0.9em;
            color: #6b7280;
        }}
        
        .status-card {{
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 16px;
        }}
        
        .status-indicator {{
            width: 20px;
            height: 20px;
            border-radius: 50%;
        }}
        
        .summary-grid {{
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 12px;
            margin-bottom: 24px;
        }}
        
        .summary-item {{
            background: white;
            padding: 16px;
            border-radius: 8px;
            text-align: center;
            box-shadow: 0 1px 4px rgba(0,0,0,0.1);
        }}
        
        .summary-count {{
            font-size: 2em;
            font-weight: bold;
        }}
        
        .summary-label {{
            font-size: 0.8em;
            color: #6b7280;
            text-transform: uppercase;
        }}
        
        .critical {{ color: #ef4444; }}
        .serious {{ color: #f97316; }}
        .moderate {{ color: #f59e0b; }}
        .minor {{ color: #3b82f6; }}
        
        .section {{
            background: white;
            border-radius: 12px;
            padding: 24px;
            margin-bottom: 24px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }}
        
        .section h2 {{
            color: #374151;
            margin-bottom: 16px;
            padding-bottom: 8px;
            border-bottom: 2px solid #e5e7eb;
        }}
        
        .violation-card {{
            background: #fafafa;
            border-left: 4px solid #ef4444;
            border-radius: 8px;
            padding: 20px;
            margin-bottom: 16px;
        }}
        
        .violation-header {{
            display: flex;
            align-items: center;
            gap: 12px;
            margin-bottom: 16px;
        }}
        
        .impact-badge {{
            padding: 4px 12px;
            border-radius: 20px;
            color: white;
            font-size: 0.8em;
            font-weight: bold;
        }}
        
        .rule-id {{
            color: #6b7280;
            font-family: monospace;
        }}
        
        .violation-card h3 {{
            font-size: 0.95em;
            color: #374151;
            margin: 16px 0 8px;
        }}
        
        .violation-card p {{
            color: #4b5563;
            font-size: 0.95em;
        }}
        
        .fix-instruction {{
            background: #ecfdf5;
            border: 1px solid #10b981;
            border-radius: 6px;
            padding: 12px;
            color: #065f46;
        }}
        
        .code-block {{
            background: #1f2937;
            border-radius: 6px;
            padding: 12px;
            margin: 8px 0;
            overflow-x: auto;
        }}
        
        .code-block code {{
            color: #f9fafb;
            font-family: 'Fira Code', 'Consolas', monospace;
            font-size: 0.85em;
        }}
        
        .fix-hint {{
            color: #fbbf24;
            font-size: 0.85em;
            margin-top: 8px;
        }}
        
        .wcag-badges {{
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
        }}
        
        .wcag-badge {{
            background: #ede9fe;
            color: #5b21b6;
            padding: 4px 10px;
            border-radius: 4px;
            font-size: 0.8em;
        }}
        
        .learn-more {{
            display: inline-block;
            margin-top: 16px;
            color: #667eea;
            text-decoration: none;
            font-weight: 500;
        }}
        
        .learn-more:hover {{
            text-decoration: underline;
        }}
        
        .executive-summary {{
            white-space: pre-wrap;
            font-family: inherit;
        }}
        
        .executive-summary table {{
            width: 100%;
            border-collapse: collapse;
            margin: 16px 0;
        }}
        
        .executive-summary th, .executive-summary td {{
            border: 1px solid #e5e7eb;
            padding: 8px 12px;
            text-align: left;
        }}
        
        .executive-summary th {{
            background: #f3f4f6;
        }}
        
        .footer {{
            text-align: center;
            padding: 24px;
            color: #6b7280;
            font-size: 0.85em;
        }}
        
        .no-issues {{
            text-align: center;
            padding: 60px 20px;
        }}
        
        .no-issues .checkmark {{
            font-size: 4em;
            margin-bottom: 16px;
        }}
        
        @media print {{
            body {{
                background: white;
            }}
            .header {{
                break-inside: avoid;
            }}
            .violation-card {{
                break-inside: avoid;
            }}
        }}
        
        @media (max-width: 768px) {{
            .score-section {{
                flex-direction: column;
            }}
            .summary-grid {{
                grid-template-columns: repeat(2, 1fr);
            }}
        }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>♿ Accessibility Report</h1>
            <p class="url">{scan_info.get("url", "Unknown URL")}</p>
            <p class="timestamp">
                Scanned: {scan_info.get("scan_time", "")} | 
                WCAG Level: {scan_info.get("wcag_level", "AA")} |
                Duration: {scan_info.get("scan_duration_ms", 0)}ms
            </p>
        </div>
        
        <div class="score-section">
            <div class="score-card">
                <div class="score-circle" style="background: {score_color}">
                    {score:.0f}%
                </div>
                <div class="score-label">Compliance Score</div>
            </div>
            <div class="score-card status-card">
                <div class="status-indicator" style="background: {status_color}"></div>
                <div>
                    <div style="font-size: 1.5em; font-weight: bold; color: {status_color}">
                        {status.replace("_", " ")}
                    </div>
                    <div class="score-label">Overall Status</div>
                </div>
            </div>
        </div>
        
        <div class="summary-grid">
            <div class="summary-item">
                <div class="summary-count critical">{summary.get("critical", 0)}</div>
                <div class="summary-label">🔴 Critical</div>
            </div>
            <div class="summary-item">
                <div class="summary-count serious">{summary.get("serious", 0)}</div>
                <div class="summary-label">🟠 Serious</div>
            </div>
            <div class="summary-item">
                <div class="summary-count moderate">{summary.get("moderate", 0)}</div>
                <div class="summary-label">🟡 Moderate</div>
            </div>
            <div class="summary-item">
                <div class="summary-count minor">{summary.get("minor", 0)}</div>
                <div class="summary-label">🔵 Minor</div>
            </div>
        </div>
        
        <div class="section">
            <h2>📋 Executive Summary</h2>
            <div class="executive-summary">{executive_summary}</div>
        </div>
        
        <div class="section">
            <h2>🔍 Detailed Findings ({summary.get("total_violations", 0)} Issues)</h2>
            
            {violation_cards if violation_cards else '''
            <div class="no-issues">
                <div class="checkmark">✅</div>
                <h3>No Accessibility Issues Found!</h3>
                <p>This page appears to meet WCAG compliance standards.</p>
            </div>
            '''}
        </div>
        
        <div class="footer">
            <p>Generated by <strong>Flowstral Accessibility Scanner</strong></p>
            <p>Using axe-core™ accessibility engine</p>
            <p>Report generated: {datetime.utcnow().isoformat()}</p>
        </div>
    </div>
</body>
</html>
"""
        return html
    
    def generate_json_report(self, scan_result: Dict[str, Any]) -> str:
        """Generate JSON report for API consumption"""
        return json.dumps(scan_result, indent=2, default=str)
    
    def generate_markdown_report(self, scan_result: Dict[str, Any]) -> str:
        """Generate Markdown report for documentation"""
        
        summary = scan_result.get("summary", {})
        violations = scan_result.get("violations", [])
        scan_info = scan_result.get("scan_info", {})
        
        md = f"""# ♿ Accessibility Report

**URL:** {scan_info.get("url", "")}  
**Scan Time:** {scan_info.get("scan_time", "")}  
**WCAG Level:** {scan_info.get("wcag_level", "AA")}  
**Scanner:** Flowstral Axe-Core Scanner

---

## 📊 Summary

| Metric | Value |
|--------|-------|
| Compliance Score | {summary.get("compliance_score", 0):.1f}% |
| Total Issues | {summary.get("total_violations", 0)} |
| Critical | {summary.get("critical", 0)} 🔴 |
| Serious | {summary.get("serious", 0)} 🟠 |
| Moderate | {summary.get("moderate", 0)} 🟡 |
| Minor | {summary.get("minor", 0)} 🔵 |

---

## 🔍 Detailed Findings

"""
        
        for i, v in enumerate(violations, 1):
            md += f"""
### {i}. {v.get("impact_emoji", "")} {v.get("rule_id", "")} ({v.get("impact", "").upper()})

**❌ What's Wrong:** {v.get("what_is_wrong", "")}

**⚠️ Why It Matters:** {v.get("why_it_matters", "")}

**✅ How to Fix:** {v.get("how_to_fix", "")}

**🎯 WCAG Criteria:** {", ".join(v.get("wcag_criteria", []))}

**📍 Affected Elements:** {v.get("element_count", 0)} found

"""
            for elem in v.get("affected_elements", [])[:2]:
                md += f"""
```html
{elem.get("html", "")}
```
> 💡 {elem.get("fix_suggestion", "")}

"""
            
            md += f"[📚 Learn More]({v.get('learn_more', '#')})\n\n---\n"
        
        if not violations:
            md += """
### ✅ No Issues Found!

This page appears to meet WCAG compliance standards. Great job!
"""
        
        md += f"""
---

*Report generated by Flowstral Accessibility Scanner*  
*Using axe-core™ accessibility engine*
"""
        
        return md
    
    def save_report(
        self,
        scan_result: Dict[str, Any],
        output_path: str,
        format: str = "html"
    ) -> str:
        """Save report to file"""
        
        path = Path(output_path)
        path.parent.mkdir(parents=True, exist_ok=True)
        
        if format == "html":
            content = self.generate_html_report(scan_result)
        elif format == "json":
            content = self.generate_json_report(scan_result)
        elif format == "markdown" or format == "md":
            content = self.generate_markdown_report(scan_result)
        else:
            raise ValueError(f"Unsupported format: {format}")
        
        with open(path, "w", encoding="utf-8") as f:
            f.write(content)
        
        logger.info(f"Accessibility report saved to: {path}")
        return str(path)


# Singleton instance
_generator: Optional[AccessibilityReportGenerator] = None

def get_report_generator() -> AccessibilityReportGenerator:
    """Get or create report generator instance"""
    global _generator
    if _generator is None:
        _generator = AccessibilityReportGenerator()
    return _generator
