"""
Accessibility Testing Services

Standalone accessibility scanning - does NOT modify recording or suggest flows.

Features:
- Real axe-core scanning via Playwright
- WCAG 2.1 AA/AAA compliance checking
- Beautiful HTML/JSON/Markdown reports
- Clear violation explanations with fix instructions
"""

from .axe_core_scanner import AxeCoreScanner, get_scanner
from .accessibility_report_generator import AccessibilityReportGenerator, get_report_generator

__all__ = [
    "AxeCoreScanner",
    "get_scanner",
    "AccessibilityReportGenerator", 
    "get_report_generator"
]
