# Test Management

Test case lifecycle management -- creation, organization, execution, reporting, and CI/CD integration. This module covers the full journey from building test cases (visual no-code or code) through organizing them into plans/suites, executing runs, and viewing results.

## Architecture

The module is structured around three functional areas:

1. **Build** -- `UnifiedWorkflowEditor` (the second-largest page at ~11,800 lines) provides a visual no-code/code test builder with 60+ step types. The `FlowstralWorkflowEditor` sub-components add canvas-based workflow editing, CI/CD export, scheduling, and variable management.
2. **Organize** -- `TestRepository` (~7,200 lines) serves as the test management hub with folders, suites, releases, and tagging. Supporting pages handle test plans, suites, and enterprise-scale repositories.
3. **Execute & Report** -- `TestCaseExecution` handles step-by-step execution with evidence capture. `TestRuns`, `TestRunDetail`, and `TestResultsDashboard` provide execution tracking and result visualization.

State is managed through a combination of local React state in page components and server state via TanStack React Query for CRUD operations.

## File Inventory

### Pages

| File | Lines | Purpose |
|------|-------|---------|
| `pages/UnifiedWorkflowEditor.tsx` | 11,783 | Primary no-code/code test builder with 60+ step types, drag-drop, and AI generation |
| `pages/TestRepository.tsx` | 7,256 | Test management hub -- folders, suites, releases, search, bulk operations |
| `pages/TestPlayground.tsx` | 1,857 | 10-tab interactive testing playground for experiments |
| `pages/TestCaseExecution.tsx` | 1,222 | Step-by-step manual/automated execution with screenshots and evidence capture |
| `pages/TestRunDetail.tsx` | 1,080 | Detailed view of a single test run with step results |
| `pages/TestCases.tsx` | 976 | Test case listing with filtering and sorting |
| `pages/TestResultsDashboard.tsx` | 931 | Aggregated test results visualization with charts |
| `pages/CreateTestCase.tsx` | 927 | Test case creation form |
| `pages/ScheduledRuns.tsx` | 848 | Scheduled test run management |
| `pages/TestPlanDetail.tsx` | 748 | Test plan detail view with linked test cases |
| `pages/TestSuites.tsx` | 574 | Test suite listing and management |
| `pages/EditTestCase.tsx` | 497 | Test case editing form |
| `pages/TestRuns.tsx` | 364 | Test run listing and status overview |
| `pages/EnterpriseTestRepository.tsx` | 327 | Enterprise-scale test repository with advanced features |
| `pages/CreateTestRun.tsx` | 280 | Test run creation form |
| `pages/TestPlans.tsx` | 244 | Test plan listing |
| `pages/CreateTestPlan.tsx` | 223 | Test plan creation form |
| `pages/EditTestPlan.tsx` | 211 | Test plan editing form |

### Components -- FlowstralWorkflowEditor

| File | Lines | Purpose |
|------|-------|---------|
| `components/FlowstralWorkflowEditor/FlowstralWorkflowEditor.tsx` | 2,241 | Main visual canvas-based workflow editor |
| `components/FlowstralWorkflowEditor/CICDExporter.tsx` | 706 | Export to GitHub Actions, GitLab CI, Jenkins, Azure Pipelines |
| `components/FlowstralWorkflowEditor/LocatorBuilder.tsx` | 690 | Build and test element locators interactively |
| `components/FlowstralWorkflowEditor/VariableStore.tsx` | 675 | Manage test variables, parameters, and data binding |
| `components/FlowstralWorkflowEditor/WorkflowNodes.tsx` | 660 | Visual workflow node type definitions and rendering |
| `components/FlowstralWorkflowEditor/TestSuiteManager.tsx` | 660 | Organize tests into suites within the editor |
| `components/FlowstralWorkflowEditor/ScheduleManager.tsx` | 570 | Schedule test execution with cron-like configuration |
| `components/FlowstralWorkflowEditor/TestRunner.tsx` | 347 | Execute tests directly from the workflow builder |
| `components/FlowstralWorkflowEditor/index.ts` | -- | Barrel export for workflow editor sub-components |

### Components -- Standalone

| File | Lines | Purpose |
|------|-------|---------|
| `components/SimpleStepEditor.tsx` | 867 | Simplified step editor for quick test case authoring |
| `components/ReusableModulesManager.tsx` | 558 | Manage reusable test modules/fragments across test cases |
| `components/VirtualTestCaseList.tsx` | 331 | Virtualized list for rendering large test case collections efficiently |
| `components/TraceabilityMatrix.tsx` | 191 | Requirements-to-test-cases traceability matrix view |

### Module Entry

| File | Purpose |
|------|---------|
| `index.ts` | Barrel exports for pages and components |

## API Endpoints Consumed

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/test-cases` | GET/POST | List and create test cases |
| `/test-cases/{id}` | GET/PUT/DELETE | Read, update, delete individual test case |
| `/test-cases/bulk` | POST/DELETE | Bulk create/delete test cases |
| `/test-cases/search` | POST | Search test cases with filters |
| `/test-plans` | GET/POST | List and create test plans |
| `/test-plans/{id}` | GET/PUT/DELETE | Read, update, delete individual test plan |
| `/test-runs` | GET/POST | List and create test runs |
| `/test-runs/{id}` | GET/PUT | Read, update test run |
| `/test-runs/ws/{executionId}` | WebSocket | Real-time execution progress (step_start, step_complete, screenshot, self_healing) |
| `/automation/convert` | POST | Convert test steps to Playwright script |
| `/automation/execute` | POST | Execute automation script |
| `/ai/generate-tests` | POST | AI-powered test case generation from requirements |
| `/ai/rewrite` | POST | AI test case rewriting and formatting |
| `/api/gherkin/convert` | POST | Convert test cases to/from Gherkin/BDD format |
| `/api/req2tc/generate` | POST | Generate test cases from requirements |

## Dependencies

- **Internal**: `recorder` module (for recorded step integration), `@/lib/api-config`, `@/hooks/useExecutionWebSocket`, `@/components/ui/*`, `@/contexts/AuthContext`
- **External**: React 18, TanStack React Query, Tailwind CSS, Radix UI, Lucide icons, Monaco Editor (for code view)

## Testing Notes

- `UnifiedWorkflowEditor` supports 60+ step types; each step type should be tested for add/edit/delete/reorder.
- Test execution via WebSocket requires a running backend with Playwright installed for automated mode.
- CI/CD export (CICDExporter) generates pipeline YAML for 4 platforms -- validate output syntax for each.
- The `VirtualTestCaseList` uses virtualization for performance; test with 1000+ test cases to verify smooth scrolling.
- Traceability matrix depends on requirements being linked to test cases via the platform module.
