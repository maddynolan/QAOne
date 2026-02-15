# Accessibility Testing

WCAG compliance scanning with axe-core, multi-level rule selection, component-level targeting, and report generation. Identifies accessibility violations across web applications at A, AA, and AAA conformance levels.

## Architecture

This is a lightweight module with a single page that orchestrates accessibility scans via the backend:

1. **Scan Configuration** -- User enters a target URL, selects WCAG conformance level (A/AA/AAA), and optionally specifies a CSS selector for component-level scanning.
2. **Execution** -- Backend launches a headless browser via Playwright, injects axe-core v4.8.4, and runs the scan as a subprocess (Windows asyncio safety).
3. **Results** -- Violations are returned grouped by impact level (critical, serious, moderate, minor) with WCAG criterion references and suggested fixes.

## File Inventory

### Pages

| File | Lines | Purpose |
|------|-------|---------|
| `pages/Accessibility.tsx` | 347 | URL-based scanner UI -- level selection, component scans, issue filtering, results display |

### Module Entry

| File | Purpose |
|------|---------|
| `index.ts` | Barrel exports for the Accessibility page |

## API Endpoints Consumed

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/accessibility/scan` | POST | Run axe-core scan against a URL |
| `/api/a11y/scan` | POST | V2 scan with automatic report generation |
| `/api/a11y/report/{scan_id}` | GET | Retrieve report in HTML, JSON, or Markdown format |
| `/api/a11y/batch-scan` | POST | Scan multiple URLs concurrently |

## Key Types

```typescript
interface AccessibilityIssue {
  id: string;
  rule: string;
  impact: 'critical' | 'serious' | 'moderate' | 'minor';
  description: string;
  element: string;
  suggested_fix: string;
  wcag_criterion: string;
}

interface ScanResult {
  scan_id: string;
  url: string;
  summary: { total: number; critical: number; serious: number; moderate: number; minor: number };
  issues: AccessibilityIssue[];
  timestamp: string;
}
```

## Dependencies

- **Internal**: `@/lib/api-config`, `@/components/ui/*`
- **External**: React 18, Tailwind CSS, Radix UI, Lucide icons

## Testing Notes

- Backend axe-core scanner runs as a subprocess; requires Playwright browsers installed.
- Scan results vary by page content; use stable test pages for consistent assertions.
- Component-level scanning (CSS selector targeting) should be tested with nested component selectors.
- Batch scan tests should verify concurrent execution and proper result aggregation.
- WCAG level selection (A vs AA vs AAA) produces different rule sets; verify each level returns appropriate violations.
