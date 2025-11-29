"""
Flowstral Real-Time Output Generation
Generates Playwright code, test steps, and UI panels in real-time
"""

import logging
from typing import Dict, List, Any, Optional
from datetime import datetime

logger = logging.getLogger(__name__)


class RealTimeOutputGenerator:
    """
    Generates real-time outputs for Flowstral UI:
    1. Real-Time Playwright Code
    2. Real-Time Test Steps
    3. Real-Time Accessibility Panel
    4. Real-Time Performance Panel
    """
    
    def __init__(self):
        self.playwright_lines: List[str] = []
        self.test_steps: List[Dict[str, Any]] = []
    
    def generate_playwright_line(
        self,
        event_type: str,
        selector: Optional[str],
        value: Optional[str] = None,
        url: Optional[str] = None
    ) -> str:
        """Generate a Playwright code line for an event"""
        line = ""
        
        if event_type == "navigate" and url:
            line = f'  await page.goto("{url}");'
        
        elif event_type == "click" and selector:
            line = f'  await page.click("{selector}");'
        
        elif event_type == "type" and selector and value:
            line = f'  await page.fill("{selector}", "{value}");'
        
        elif event_type == "select" and selector and value:
            line = f'  await page.selectOption("{selector}", "{value}");'
        
        elif event_type == "scroll":
            line = f'  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));'
        
        elif event_type == "wait":
            line = f'  await page.waitForLoadState("networkidle");'
        
        if line:
            self.playwright_lines.append(line)
        
        return line
    
    def generate_test_step(
        self,
        step_number: int,
        event_type: str,
        action_description: str,
        expected_result: Optional[str] = None
    ) -> Dict[str, Any]:
        """Generate a test step"""
        step = {
            "step_number": step_number,
            "action": action_description,
            "expected_result": expected_result or self._infer_expected_result(event_type),
            "type": event_type
        }
        
        self.test_steps.append(step)
        return step
    
    def _infer_expected_result(self, event_type: str) -> str:
        """Infer expected result from event type"""
        results = {
            "click": "Element is clicked and action is triggered",
            "type": "Text is entered into the field",
            "select": "Option is selected",
            "navigate": "Page navigates to the URL",
            "scroll": "Page scrolls to the target",
            "wait": "Page finishes loading"
        }
        return results.get(event_type, "Action completes successfully")
    
    def generate_accessibility_panel(
        self,
        wcag_snapshot: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Generate accessibility panel data"""
        violations = wcag_snapshot.get("violations", [])
        summary = wcag_snapshot.get("summary", {})
        
        # Group by rule
        by_rule = {}
        for violation in violations:
            rule_id = violation.get("id", "unknown")
            if rule_id not in by_rule:
                by_rule[rule_id] = []
            by_rule[rule_id].append(violation)
        
        # Format for UI
        panel_items = []
        for rule_id, rule_violations in by_rule.items():
            first_violation = rule_violations[0]
            panel_items.append({
                "rule_id": rule_id,
                "rule_name": first_violation.get("rule", ""),
                "impact": first_violation.get("impact", "minor"),
                "count": len(rule_violations),
                "description": first_violation.get("description", ""),
                "suggested_fix": first_violation.get("suggested_fix", ""),
                "help_url": first_violation.get("helpUrl", "")
            })
        
        # Sort by impact
        impact_order = {"critical": 0, "serious": 1, "moderate": 2, "minor": 3}
        panel_items.sort(key=lambda x: impact_order.get(x["impact"], 4))
        
        return {
            "total_issues": summary.get("total", 0),
            "critical": summary.get("critical", 0),
            "serious": summary.get("serious", 0),
            "moderate": summary.get("moderate", 0),
            "minor": summary.get("minor", 0),
            "issues": panel_items[:10]  # Top 10 for UI
        }
    
    def generate_performance_panel(
        self,
        performance_snapshot: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Generate performance panel data"""
        page_level = performance_snapshot.get("page_level", {})
        network_analysis = performance_snapshot.get("network_calls", {})
        bottlenecks = performance_snapshot.get("bottlenecks", [])
        
        # Format metrics for UI
        metrics = []
        
        if page_level.get("lcp"):
            metrics.append({
                "name": "LCP",
                "value": f"{page_level.get('lcp', 0):.0f}ms",
                "status": "good" if page_level.get("lcp", 0) < 2500 else "warning",
                "threshold": "2500ms"
            })
        
        if page_level.get("fcp"):
            metrics.append({
                "name": "FCP",
                "value": f"{page_level.get('fcp', 0):.0f}ms",
                "status": "good" if page_level.get("fcp", 0) < 1800 else "warning",
                "threshold": "1800ms"
            })
        
        if page_level.get("cls"):
            metrics.append({
                "name": "CLS",
                "value": f"{page_level.get('cls', 0):.2f}",
                "status": "good" if page_level.get("cls", 0) < 0.1 else "warning",
                "threshold": "0.1"
            })
        
        # API calls
        slow_calls = network_analysis.get("slow_calls", [])
        api_items = []
        for call in slow_calls[:5]:  # Top 5 slow calls
            api_items.append({
                "url": call.get("url", ""),
                "method": call.get("method", "GET"),
                "duration": f"{call.get('duration', 0):.0f}ms",
                "status": "slow"
            })
        
        return {
            "page_score": performance_snapshot.get("summary", {}).get("page_score", 0),
            "metrics": metrics,
            "warnings": page_level.get("warnings", []),
            "slow_api_calls": api_items,
            "bottlenecks": bottlenecks[:5]  # Top 5 bottlenecks
        }
    
    def get_full_playwright_script(self, test_name: str = "Flowstral Test") -> str:
        """Get complete Playwright script"""
        lines = [
            "import { test, expect } from '@playwright/test';",
            "",
            f"test('{test_name}', async ({{ page }}) => {{"  # Escape braces for f-string
        ]
        lines.extend(self.playwright_lines)
        lines.append("});")
        return "\n".join(lines)
    
    def get_test_steps(self) -> List[Dict[str, Any]]:
        """Get all test steps"""
        return self.test_steps
    
    def reset(self):
        """Reset generator state"""
        self.playwright_lines = []
        self.test_steps = []

