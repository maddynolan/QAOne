# Multi-Agent Development Guide — QAAI/Flowstral

> How to use parallel Claude Code agents to work on multiple feature modules simultaneously.

---

## Overview

This guide documents the parallel development workflow used by QAAI — a system where multiple Claude Code agents each own a feature module and work in isolated git worktrees to audit, fix, and enhance their module independently.

**Why:** A single agent working sequentially across 9 modules takes hours. Parallel agents complete the same work in ~15 minutes.

**How it works:**
1. Each agent gets an isolated git worktree (clean copy of the repo)
2. Agents work on their module simultaneously without conflicts
3. Changes are merged back, build-verified, and released

---

## 10 Agent Teams

| Team | Frontend | Backend | Key Page(s) | Scope |
|------|----------|---------|-------------|-------|
| **Record** | `src/modules/recorder/` | `routers/recorder/` | PlaywrightRecorderPage | Browser recording, playback, self-healing, Chrome extension |
| **Build** | `src/modules/test-management/` (builder parts) | `routers/test_management/` (test_cases_crud, gherkin, req2tc) | UnifiedWorkflowEditor | No-code test builder, AI test generation, Gherkin |
| **Tests** | `src/modules/test-management/` (execution parts) | `routers/test_management/` (test_runs, automation, complex_verify) | TestRepository, TestCaseExecution, TestRuns, TestPlans, TestPlayground | Test lifecycle, runs, plans, execution, sub-tabs |
| **Mobile** | `src/modules/mobile-testing/` | `routers/test_management/mobile_flows_api` | MobileTestingPage + 7 sub-components | Maestro, device lab, IPC, flows, inspector |
| **API** | `src/modules/api-testing/` | `routers/api_testing/` | EnhancedAPITesting | Multi-protocol testing, collections, chaining, environments |
| **Perf** | `src/modules/performance/` | `routers/performance/` | VirtualUserGenerator | Load testing, scenarios, metrics, server execution |
| **Visual** | `src/modules/visual-testing/` | `routers/visual_testing/` | VisualTestingPage | Visual regression, 6 comparison modes, baselines |
| **SF** | `src/modules/salesforce/` | `routers/salesforce/` | SalesforceToolsPage | Salesforce-specific testing, OAuth2, code generation |
| **A11Y** | `src/modules/accessibility/` | `routers/accessibility/` | Accessibility | WCAG scanning, axe-core, reports, AI analysis |
| **Deploy** | — | — | — | Docker, Helm, CI/CD, Nginx, monitoring, PgBouncer, Coolify, deployment docs |

---

## File Ownership Map

### Record Team
```
Frontend:
  src/modules/recorder/pages/PlaywrightRecorderPage.tsx     # Main page (~520KB)
  src/modules/recorder/components/ManualAssistCard.tsx       # Manual step fixing
  src/modules/recorder/components/ElementRepairWizard.tsx    # Advanced repair
  src/modules/recorder/components/AITestGenerator.tsx        # AI test gen
  src/modules/recorder/components/confidence/                # Confidence scoring
  src/modules/recorder/lib/aiEnhancements.ts                # API helpers
  src/modules/recorder/lib/automation-linking.ts             # Automation linking
  src/modules/recorder/lib/failureClassification.ts          # Failure classification

Backend:
  backend/app/routers/recorder/playwright_recorder_api.py    # 44 endpoints
  backend/app/routers/recorder/cdp_recorder_api.py           # CDP recording
  backend/app/routers/recorder/flowstral_api.py              # Flowstral pipeline
  backend/app/services/flowstral/                            # 27 Flowstral services
  backend/app/services/flowstral_engine/                     # 9 engine services
  backend/app/routers/ai/ai_enhancements_api.py              # Self-healing endpoints
  backend/app/services/automation/healing_orchestrator.py     # 4-layer healing chain

Extension:
  flowstral-extension/src/                                   # Chrome extension
  flowstral-engine/src/                                      # TypeScript engine

Electron:
  flowstral-desktop/src/main/playwright-recorder.js          # Cross-browser recording
```

### Build Team
```
Frontend:
  src/modules/test-management/pages/UnifiedWorkflowEditor.tsx   # No-code builder (~538KB)
  src/modules/test-management/components/FlowstralWorkflowEditor/  # Visual canvas
  src/modules/test-management/components/VersionHistoryPanel.tsx    # Version control

Backend:
  backend/app/routers/test_management/test_cases_crud_api.py  # Test case CRUD
  backend/app/routers/test_management/gherkin_api.py          # BDD/Gherkin
  backend/app/routers/test_management/requirement_to_testcase_api.py
  backend/app/routers/ai/ai_generation_api.py                 # AI generation (28 endpoints)
  backend/app/services/ai/enhanced_generation_service.py
  backend/app/services/core/version_control_service.py
```

### Tests Team
```
Frontend:
  src/modules/test-management/pages/TestRepository.tsx        # Test hub (~340KB)
  src/modules/test-management/pages/TestCaseExecution.tsx     # Step execution
  src/modules/test-management/pages/TestRuns.tsx              # Run listing
  src/modules/test-management/pages/TestPlayground.tsx        # 10-tab playground
  src/modules/test-management/components/DefectsTabPanel.tsx
  src/modules/test-management/components/RunsTabPanel.tsx
  src/modules/test-management/components/SuitesTabPanel.tsx
  src/modules/test-management/components/PlansTabPanel.tsx
  src/modules/test-management/components/ReleasesTabPanel.tsx

Backend:
  backend/app/routers/test_management/test_runs_api.py        # 14 endpoints
  backend/app/routers/test_management/automation_api.py
  backend/app/routers/test_management/complex_verifications.py
  backend/app/services/executors/                             # Playwright execution
```

### Mobile Team
```
Frontend:
  src/modules/mobile-testing/pages/MobileTestingPage.tsx
  src/modules/mobile-testing/components/MobileTestStudio.tsx
  src/modules/mobile-testing/components/MobileTestFlows.tsx
  src/modules/mobile-testing/components/MobileDeviceLab.tsx
  src/modules/mobile-testing/components/MobileTestRuns.tsx
  src/modules/mobile-testing/components/MobileInspector.tsx
  src/modules/mobile-testing/components/MobileAdvancedTools.tsx
  src/modules/mobile-testing/components/MobileDeviceSelector.tsx
  src/modules/mobile-testing/store/mobileTestingStore.ts

Backend:
  backend/app/routers/test_management/mobile_flows_api.py     # 8 endpoints

Electron:
  flowstral-desktop/src/main/lib/maestro-integration.js       # MaestroRunner
  flowstral-desktop/src/main/index.js                         # 20+ IPC handlers
```

### API Team
```
Frontend:
  src/modules/api-testing/pages/EnhancedAPITesting.tsx        # Main page (~200KB)
  src/modules/api-testing/components/RequestBuilder.tsx
  src/modules/api-testing/components/CollectionSidebar.tsx
  src/modules/api-testing/components/EnvironmentManager.tsx
  src/modules/api-testing/components/AssertionsPanel.tsx
  src/modules/api-testing/components/RequestChainBuilder.tsx
  src/modules/api-testing/components/ResponseTreeExplorer.tsx
  src/modules/api-testing/components/DataDrivenPanel.tsx
  src/modules/api-testing/components/constants.ts
  src/modules/api-testing/store/apiTestingStore.ts

Backend:
  backend/app/routers/api_testing/enhanced_api_testing_api.py  # 46 endpoints
  backend/app/routers/api_testing/api_import_api.py            # 9 endpoints
  backend/app/routers/api_testing/request_chaining_api.py      # 9 endpoints
  backend/app/routers/api_testing/collection_persistence_api.py # 11 endpoints
  backend/app/services/api_testing/                            # All services
```

### Perf Team
```
Frontend:
  src/modules/performance/pages/VirtualUserGenerator.tsx
  src/modules/performance/components/ScenarioBuilder.tsx
  src/modules/performance/components/ScenarioStepCard.tsx
  src/modules/performance/components/WorkloadModelSelector.tsx
  src/modules/performance/components/StagesEditor.tsx
  src/modules/performance/components/ThresholdManager.tsx
  src/modules/performance/store/performanceTestingStore.ts

Backend:
  backend/app/routers/performance/performance_api.py           # 80 endpoints
  backend/app/routers/performance/protocol_recording_api.py    # 13 endpoints
  backend/app/services/performance/                            # All services
```

### Visual Team
```
Frontend:
  src/modules/visual-testing/pages/VisualTestingPage.tsx

Backend:
  backend/app/routers/visual_testing/visual_testing_api.py     # 15 endpoints
  backend/app/services/automation/visual_testing_engine.py

Docs:
  docs/FEATURE-ACCESSIBILITY-VISUAL.md
```

### SF Team
```
Frontend:
  src/modules/salesforce/pages/SalesforceToolsPage.tsx
  src/modules/salesforce/components/                           # 19 components
  src/modules/salesforce/lib/                                  # 5 service files

Backend:
  backend/app/routers/salesforce/salesforce_api.py
  backend/app/routers/salesforce/salesforce_auth.py
  backend/app/services/flowstral/salesforce_playwright_generator.py
  backend/app/services/flowstral/robust_salesforce_generator.py
```

### A11Y Team
```
Frontend:
  src/modules/accessibility/pages/Accessibility.tsx

Backend:
  backend/app/routers/accessibility/accessibility_api.py       # 10 endpoints
  backend/app/routers/accessibility/accessibility_scan_api.py  # 6 endpoints
  backend/app/services/accessibility/axe_scanner.py
  backend/app/services/accessibility/axe_core_scanner.py
  backend/app/services/accessibility/accessibility_report_generator.py
```

### Deploy Team
```
Docker:
  Dockerfile.frontend                                # Frontend multi-stage build
  backend/Dockerfile                                 # Backend API image
  backend/Dockerfile.worker                          # Playwright worker image
  docker-compose.yml                                 # Dev (PostgreSQL only)
  docker-compose.full.yml                            # Full production stack
  docker-compose.monitoring.yml                      # Standalone monitoring
  docker-compose.air-gapped.yml                      # Air-gapped deployment

Kubernetes:
  helm/qaai/Chart.yaml                               # Helm chart metadata
  helm/qaai/values.yaml                              # Chart values
  helm/qaai/templates/                               # K8s templates (deployments, services, ingress, networkpolicy)

CI/CD:
  .github/workflows/ci.yml                           # Main CI pipeline
  .github/workflows/deploy-coolify.yml               # Coolify CD pipeline
  .github/workflows/deploy-production.yml            # Production deploy
  .github/workflows/deploy-staging.yml               # Staging deploy
  .github/workflows/security-scan.yml                # Security scanning
  .github/workflows/openapi.yml                      # OpenAPI validation

Nginx:
  nginx/default.conf                                 # OWASP headers, rate limiting, proxy

Monitoring:
  prometheus/prometheus.yml                          # Prometheus scrape config
  prometheus/alert_rules.yml                         # Alert rules
  alertmanager/alertmanager.yml                      # Alertmanager config
  grafana/datasources/prometheus.yml                 # Grafana datasource
  grafana/dashboards/                                # Dashboard JSONs

Deploy Configs:
  deploy/pgbouncer/pgbouncer.ini                     # Connection pooling
  deploy/coolify/README.md                           # Coolify setup guide
  deploy/coolify/.env.example                        # Environment template

Docs:
  docs/SAAS-DEPLOYMENT-GUIDE.md
  docs/ON-PREM-DEPLOYMENT-RUNBOOK.md
  docs/DEPLOYMENT-AND-DATA-ARCHITECTURE.md
```

---

## Standard Agent Prompt Template

When spawning a feature agent, use this template:

```
You are the [TEAM_NAME] agent for the QAAI/Flowstral platform.

YOUR MODULE: [list of owned files]

MISSION:
1. Read ALL files in your module (frontend pages, components, store, backend routers, services)
2. Identify: dead code, broken features, UI issues (especially light theme contrast),
   missing functionality, error handling gaps
3. Fix ALL bugs and broken features you find
4. Enhance with competitive improvements (better UX, missing validations,
   error messages, loading states)
5. Verify changes compile: run `npx vite build` for frontend changes
6. List all changes you made for the commit message

RULES:
- Only modify files in YOUR module
- Don't break existing APIs or data formats
- Preserve backward compatibility
- Use existing patterns (Tailwind, shadcn/ui, Zustand, Axios)
- Test with `npx vite build` before finishing

IMPORTANT: This is a WORKTREE agent — you're in an isolated copy of the repo.
Your changes will be merged by the parent agent.
```

---

## Spawn & Merge Workflow

### Step 1: Spawn Agents
```
Launch up to 5 parallel agents with isolation: "worktree"
Each gets the standard prompt + team-specific mission
```

### Step 2: Wait for Completion
```
All agents run concurrently
Each produces a summary of changes
```

### Step 3: Merge Changes
```
For each completed agent worktree:
  1. Check which files were modified: git status --short
  2. Copy modified files to main worktree: cp <worktree>/<file> <main>/<file>
  3. Repeat for all agents
```

### Step 4: Verify Build
```
cd <main_worktree>
npx vite build                    # Frontend compiles
npx jest --passWithNoTests        # Tests pass
```

### Step 5: Commit & Push
```
git add <all modified files>
git commit -m "v3.X.0: <description>"
cd C:\QAAI
git merge <worktree_branch> --no-edit
git push origin main
```

### Step 6: Build & Release
```
cd C:\QAAI\flowstral-desktop
npm run build:webapp
npm run build:win
gh release create vX.Y.Z ...
```

---

## Batch Strategy

When working on all 10 teams:

**Batch 1** (5 agents — largest feature modules):
- Record, Build, API, Perf, SF

**Batch 2** (4 agents — remaining feature modules):
- Tests, Mobile, Visual, A11Y

**Batch 3** (1 agent — infrastructure):
- Deploy

The Deploy agent runs separately because it touches cross-cutting infra files (Docker, Helm, CI/CD) that don't conflict with feature modules. It can also run in parallel with any feature batch if needed.

This prevents overwhelming system resources while maintaining parallelism.

---

## Conflict Resolution

If two agents modify the same file:
1. Review both sets of changes
2. Apply non-conflicting changes from each
3. Manually merge conflicting sections
4. Re-verify build

**Prevention:** File ownership is clearly defined — each team owns distinct files. Cross-cutting files (App.tsx, AppSidebar.tsx, CLAUDE.md) are modified by the parent agent, not child agents.

---

## History

| Version | Date | Agents | Scope |
|---------|------|--------|-------|
| v3.19.0 | 2026-03-09 | 5 parallel | A11Y fix, Visual/Mobile/Perf/TestMgmt robustness |
| v3.20.0 | 2026-03-14 | 9 parallel | Full platform audit + dead code cleanup + enhancements |
| v3.21.0 | 2026-03-14 | 1 (Deploy) | 10th agent team + infrastructure audit (Docker, Helm, CI/CD, Nginx, monitoring) |
