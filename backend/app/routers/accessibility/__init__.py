"""
Accessibility Testing Module Routers

WCAG compliance scanning using axe-core, compliance checking, and
multi-format report generation (HTML, JSON, Markdown). Supports
WCAG 2.0/2.1 levels A/AA/AAA with component-targeted scanning.

Routers:
- accessibility_api: /api/accessibility/* - Main axe-core scan endpoint (10 endpoints)
- accessibility_scan_api: /api/a11y/* - V2 scanning with report generation (6 endpoints)
- compliance_api: /api/compliance/* - WCAG compliance verification
"""
from .accessibility_api import router as accessibility_router
from .accessibility_scan_api import router as a11y_scan_router
from .compliance_api import router as compliance_router
