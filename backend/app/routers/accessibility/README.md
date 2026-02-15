# Accessibility Routers

Backend API routers for WCAG compliance scanning, accessibility report generation, and compliance checking. Uses axe-core v4.8.4 for automated accessibility testing.

## Router Inventory

| File | Lines | Prefix | Endpoints | Purpose |
|------|-------|--------|-----------|---------|
| `accessibility_api.py` | 495 | `/api/accessibility` | 10 | Main scan endpoint -- URL scanning, component targeting, WCAG level selection (A/AA/AAA) |
| `accessibility_scan_api.py` | 303 | `/api/a11y` | 6 | V2 scanning with automatic report generation (HTML/JSON/Markdown), batch scanning |
| `compliance_api.py` | 114 | `/api/compliance` | 3 | WCAG compliance rule checking and status |

**Total: 19 endpoints across 3 routers**

## Key Endpoints

| Endpoint | Method | Router | Purpose |
|----------|--------|--------|---------|
| `/api/accessibility/scan` | POST | accessibility_api | Run axe-core scan against a URL |
| `/api/a11y/scan` | POST | accessibility_scan_api | V2 scan with report generation |
| `/api/a11y/report/{scan_id}` | GET | accessibility_scan_api | Get report (HTML/JSON/Markdown) |
| `/api/a11y/batch-scan` | POST | accessibility_scan_api | Scan multiple URLs concurrently |
| `/api/compliance/check` | POST | compliance_api | Check WCAG compliance rules |

## Scanning Architecture

1. Launches headless Chrome via Playwright (subprocess for Windows asyncio safety)
2. Navigates to target URL
3. Injects axe-core v4.8.4 from CDN
4. Runs scan with WCAG2A/AA/2.1A/2.1AA rule sets
5. Optional component-selector targeting
6. Returns violations grouped by impact level

## Related Backend Services

| Service Directory | Purpose |
|-------------------|---------|
| `backend/app/services/accessibility/` | axe_scanner.py (standalone subprocess), accessibility_report_generator.py |
| `backend/app/services/agents/` | accessibility_agent.py, accessibility_compliance.py (AI-powered analysis) |
| `backend/app/services/llm/` | accessibility_report_service.py (LLM report generation) |

## Related Frontend Module

- `src/modules/accessibility/` -- Accessibility page with URL scanner and results display
