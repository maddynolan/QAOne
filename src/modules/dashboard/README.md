# Dashboard & Analytics

Dashboard, analytics, and test results visualization. Provides real-time project health metrics, test execution trends, and detailed results exploration for QA teams.

## Architecture

The module contains three pages that provide progressively deeper views into test data:

1. **Dashboard** -- High-level project health with key metrics (pass rate, test count, defect density), recent activity, and status cards.
2. **Analytics** -- Trend analysis with charts for test execution over time, pass/fail ratios, flaky test tracking, and team performance.
3. **Results** -- Detailed test result exploration with filtering, grouping, and drill-down into individual test run outcomes.

Data is fetched from the backend dashboard API and rendered with chart components.

## File Inventory

### Pages

| File | Lines | Purpose |
|------|-------|---------|
| `pages/Dashboard.tsx` | 585 | Main dashboard with project health metrics, recent activity, and status overview |
| `pages/Analytics.tsx` | 561 | Trend analysis charts -- execution trends, pass/fail ratios, flaky tests |
| `pages/Results.tsx` | 322 | Test result listing with filtering, grouping, and drill-down |

### Module Entry

| File | Purpose |
|------|---------|
| `index.ts` | Barrel exports for all dashboard pages |

## API Endpoints Consumed

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/dashboard/summary` | GET | Overall project health summary |
| `/dashboard/metrics` | GET | Detailed metrics (pass rate, execution time, defect counts) |
| `/dashboard/trends` | GET | Historical trend data for charting |
| `/dashboard/recent-activity` | GET | Recent test executions and changes |
| `/dashboard/team-stats` | GET | Per-team and per-user statistics |

## Dependencies

- **Internal**: `@/lib/api-config`, `@/components/ui/*`, `@/contexts/AuthContext`
- **External**: React 18, Tailwind CSS, Recharts (charting), Radix UI, Lucide icons

## Testing Notes

- Dashboard metrics are aggregated server-side; mock `/dashboard/*` endpoints with known data for consistent tests.
- Charts should be tested with empty data, single data point, and large datasets.
- Analytics trend calculations depend on date ranges; test with various time windows.
- Results page filtering should handle edge cases (no results, all results match, special characters in filters).
