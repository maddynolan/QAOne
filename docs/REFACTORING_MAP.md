# ArisTrace/Flowstral Codebase Refactoring Map

## Executive Summary

This document provides a complete memory map of the codebase, categorizing all components by their role, usage status, and refactoring recommendations.

---

## 🎯 CORE PRODUCT FEATURES

Based on the primary user workflow: **Record → Build → Test → Manage**

### Primary Pages (KEEP - High Priority)
| Page | Purpose | Status | Notes |
|------|---------|--------|-------|
| `Dashboard.tsx` | Main dashboard | ✅ Active | Keep as-is |
| `PlaywrightRecorderPage.tsx` | Test recording | ✅ Active | Primary recorder |
| `UnifiedWorkflowEditor.tsx` | Test builder/editor | ✅ Active | Main builder |
| `TestRepository.tsx` | Test management | ✅ Active | Recently enhanced |
| `TestCaseExecution.tsx` | Manual test execution | ✅ Active | Step-by-step execution |
| `Results.tsx` | Test results | ✅ Active | Keep |
| `TestResultsDashboard.tsx` | Results dashboard | ✅ Active | Keep |
| `Performance.tsx` | Performance testing | ✅ Active | K6/Load testing |
| `SalesforceToolsPage.tsx` | Salesforce tools | ✅ Active | Important for SF customers |
| `Settings.tsx` | App settings | ✅ Active | Keep |

### Secondary Pages (KEEP - Medium Priority)
| Page | Purpose | Status | Notes |
|------|---------|--------|-------|
| `AuthPage.tsx` | Authentication | ✅ Active | Keep |
| `CreateTestCase.tsx` | Create test case | ✅ Active | Keep |
| `APIImport.tsx` | API import/testing | ✅ Active | Keep |
| `CICD.tsx` | CI/CD configuration | ⚡ Used | Keep |
| `Defects.tsx` | Defect tracking | ⚡ Used | Keep |
| `Requirements.tsx` | Requirements | ⚡ Used | Keep |
| `TestPlans.tsx` | Test plans | ⚡ Used | Keep |
| `TestRuns.tsx` | Test runs | ⚡ Used | Keep |

---

## 🗄️ ARCHIVE CANDIDATES (Low Priority/Unused)

### Duplicate/Replaced Pages
| Page | Replaced By | Action |
|------|-------------|--------|
| `CDPRecorder.tsx` | PlaywrightRecorderPage | Archive |
| `DesktopRecorder.tsx` | Desktop App | Archive |
| `EnhancedWorkflowEditor.tsx` | UnifiedWorkflowEditor | Archive |
| `FlowstralWorkflowEditor.tsx` | UnifiedWorkflowEditor | Archive |
| `Flowstral.tsx` | PlaywrightRecorderPage | Archive |
| `TestCases.tsx` | TestRepository | Archive |
| `TestSuites.tsx` | TestRepository (Suites tab) | Archive |
| `EnterpriseTestRepository.tsx` | TestRepository | Archive |
| `TestCaseExecutor.tsx` | TestCaseExecution | Archive |

### Unused/Experimental Pages
| Page | Reason | Action |
|------|--------|--------|
| `Blaze.tsx` | Experimental explorer | Archive |
| `Nexus.tsx` | Unused feature | Archive |
| `Trace.tsx` | Unused | Archive |
| `Triage.tsx` | Unused | Archive |
| `Exploration.tsx` | Replaced by recorder | Archive |
| `ElementRepository.tsx` | Not actively used | Archive |
| `FrameworkAnalyzer.tsx` | Experimental | Archive |
| `GherkinConverter.tsx` | Low usage | Archive |
| `Hardening.tsx` | Not needed | Archive |
| `OnboardingPage.tsx` | Not implemented | Archive |
| `ProjectManagement.tsx` | Unused | Archive |
| `Traceability.tsx` | Unused | Archive |
| `RunAutomation.tsx` | Duplicate | Archive |
| `ScheduledRuns.tsx` | Not implemented | Archive |
| `SelectTestCases.tsx` | Part of other flows | Archive |
| `SelfHealing.tsx` | Built into core | Archive |
| `Security.tsx` | Not needed | Archive |
| `Telemetry.tsx` | Not needed | Archive |
| `VirtualUserGenerator.tsx` | Experimental | Archive |

### Integration Pages (Keep but Low Priority)
| Page | Status | Notes |
|------|--------|-------|
| `JiraIntegration.tsx` | Keep | Useful |
| `GitHubIntegration.tsx` | Keep | CI/CD |
| `AzureDevOpsIntegration.tsx` | Keep | Enterprise |
| `ConfluenceIntegration.tsx` | Keep | Documentation |
| `CICDIntegration.tsx` | Keep | Duplicate? |
| `CICDWizard.tsx` | Keep | Wizard flow |

---

## 🧩 COMPONENTS MAP

### Core UI Components (src/components/ui/)
All shadcn/ui components - **KEEP ALL** - These are standard UI primitives.

### Application Components

#### KEEP (Active Use)
| Component | Purpose |
|-----------|---------|
| `AppSidebar.tsx` | Main navigation |
| `Layout.tsx` | App layout wrapper |
| `TopNav.tsx` | Top navigation |
| `ProtectedRoute.tsx` | Auth guard |
| `StreamlinedLayout.tsx` | Simplified layout |

#### FlowstralWorkflowEditor/ (CONSOLIDATE)
| Component | Action |
|-----------|--------|
| `FlowstralWorkflowEditor.tsx` | Merge into UnifiedWorkflowEditor |
| `CICDExporter.tsx` | Keep as utility |
| `LocatorBuilder.tsx` | Keep |
| `ScheduleManager.tsx` | Keep |
| `TestRunner.tsx` | Keep |
| `TestSuiteManager.tsx` | Merge into TestRepository |
| `VariableStore.tsx` | Keep |
| `WorkflowNodes.tsx` | Keep |

#### Salesforce Components (CONSOLIDATE)
| Component | Action |
|-----------|--------|
| `SalesforceValidationPanel.tsx` | Keep - Primary |
| `SalesforceContextPanel.tsx` | Merge into ValidationPanel |
| `SoqlEditor.tsx` | Keep |
| All other Salesforce* | Archive or merge |

#### Archive Candidates
| Component | Reason |
|-----------|--------|
| `AIConfiguration.tsx` | Unused |
| `BlackboxLocatorStrategies.tsx` | Experimental |
| `EditAndImprove.tsx` | Unused |
| `MetricCard.tsx` | Unused |
| `Pagination.tsx` | Not used (custom impl in pages) |
| `QualityRating.tsx` | Unused |
| `ReusableModulesManager.tsx` | Experimental |
| `SmartFillDialog.tsx` | Experimental |
| `TraceabilityMatrix.tsx` | Unused |
| `VirtualTestCaseList.tsx` | Not used |
| `WorkspaceSwitcher.tsx` | Not implemented |

---

## 🔧 BACKEND SERVICES MAP

### Core Routers (KEEP)
| Router | Purpose |
|--------|---------|
| `test_cases_crud_api.py` | Test case CRUD + scale data |
| `playwright_recorder_api.py` | Recording API |
| `flowstral_api.py` | Test case generation |
| `salesforce_api.py` | Salesforce integration |
| `performance_api.py` | Performance testing |
| `llm_api.py` | AI/LLM services |
| `health_api.py` | Health checks |
| `test_plans_api.py` | Test plans |
| `test_runs_api.py` | Test runs |
| `defects_api.py` | Defects |
| `requirements_api.py` | Requirements |

### Archive/Consolidate Routers
| Router | Action |
|--------|--------|
| `blaze_api.py` | Archive |
| `cdp_recorder_api.py` | Archive |
| `exploration_*.py` | Consolidate |
| `framework_analyzer_api.py` | Archive |
| `nexus_exploratory_api.py` | Archive |
| `ocr_fallback_api.py` | Archive |
| `traceability_api.py` | Archive |

---

## 📁 PROPOSED NEW STRUCTURE

```
src/
├── pages/
│   ├── core/                    # Core features
│   │   ├── Dashboard.tsx
│   │   ├── Recording.tsx        # (PlaywrightRecorderPage)
│   │   ├── Builder.tsx          # (UnifiedWorkflowEditor)
│   │   ├── Repository.tsx       # (TestRepository)
│   │   ├── Execution.tsx        # (TestCaseExecution)
│   │   └── Results.tsx
│   ├── management/              # Test management
│   │   ├── TestPlans.tsx
│   │   ├── TestRuns.tsx
│   │   ├── Defects.tsx
│   │   └── Requirements.tsx
│   ├── integrations/            # External integrations
│   │   ├── CICD.tsx
│   │   ├── Jira.tsx
│   │   ├── GitHub.tsx
│   │   └── AzureDevOps.tsx
│   ├── performance/             # Performance testing
│   │   └── Performance.tsx
│   ├── salesforce/              # Salesforce specific
│   │   └── SalesforceTools.tsx
│   ├── settings/
│   │   └── Settings.tsx
│   └── auth/
│       └── Auth.tsx
├── components/
│   ├── ui/                      # shadcn components (keep all)
│   ├── layout/                  # Layout components
│   │   ├── AppSidebar.tsx
│   │   ├── TopNav.tsx
│   │   └── Layout.tsx
│   ├── builder/                 # Builder components
│   │   ├── WorkflowNodes.tsx
│   │   ├── LocatorBuilder.tsx
│   │   └── VariableStore.tsx
│   ├── recorder/                # Recorder components
│   └── salesforce/              # Salesforce components
│       ├── ValidationPanel.tsx
│       └── SoqlEditor.tsx
├── lib/                         # Utilities (consolidate)
├── hooks/                       # Custom hooks
└── stores/                      # State management

archive/                         # Archived files
├── pages/
└── components/
```

---

## 📋 REFACTORING PHASES

### Phase 1: Archive Unused Files
- Move unused pages to `archive/pages/`
- Move unused components to `archive/components/`
- Update App.tsx routes

### Phase 2: Consolidate Duplicates
- Merge workflow editors into UnifiedWorkflowEditor
- Merge test case views into TestRepository
- Consolidate Salesforce components

### Phase 3: Reorganize Structure
- Create new folder structure
- Move files to appropriate locations
- Update imports

### Phase 4: Clean Up
- Remove dead code
- Update documentation
- Final testing

---

## ✅ ARCHIVED FILES

### Pages Archived (archive/pages/) - 20 files
```
Blaze.tsx              - Experimental explorer
CDPRecorder.tsx        - Replaced by PlaywrightRecorderPage
DesktopRecorder.tsx    - Desktop-specific, not web
DocsAndDemos.tsx       - Not implemented
EnhancedWorkflowEditor.tsx - Replaced by UnifiedWorkflowEditor
Exploration.tsx        - Replaced by recorder
Flowstral.tsx          - Replaced by PlaywrightRecorderPage
FlowstralWorkflowEditor.tsx - Replaced by UnifiedWorkflowEditor
GherkinConverter.tsx   - Low usage
Hardening.tsx          - Not needed
Nexus.tsx              - Unused
OnboardingPage.tsx     - Not implemented
RunAutomation.tsx      - Duplicate functionality
Security.tsx           - Not needed in UI
SelectTestCases.tsx    - Part of other flows
Telemetry.tsx          - Not needed in UI
TestCaseExecutor.tsx   - Replaced by TestCaseExecution
TestExecution.tsx      - Consolidated into TestRepository
Trace.tsx              - Unused
Triage.tsx             - Unused
```

### Components Archived (archive/components/) - 3 files
```
EditAndImprove.tsx     - Unused
MetricCard.tsx         - Unused
QualityRating.tsx      - Unused
```

### Components KEPT (Required by other modules)
```
AIConfiguration.tsx       - Used by Settings.tsx
BlackboxLocatorStrategies.tsx - Used by UnifiedWorkflowEditor
ReusableModulesManager.tsx - Used by UnifiedWorkflowEditor
SmartFillDialog.tsx       - Used by UnifiedWorkflowEditor
TraceabilityMatrix.tsx    - Used by TestRunDetail
VirtualTestCaseList.tsx   - Used by TestCasePanel
Pagination.tsx            - Used by TestCasePanel
WorkspaceSwitcher.tsx     - Used by TopNav
```

---

## 📊 REFACTORING SUMMARY

### Before Refactoring
- **Pages**: 67 TSX files
- **Components**: 48 TSX files (including ui/)
- Many duplicates and experimental features

### After Refactoring
- **Pages**: 47 TSX files (-20 archived)
- **Components**: 45 TSX files (-3 archived)
- Cleaner, focused codebase

### CORE MODULES PRESERVED
1. ✅ **Recorder** - PlaywrightRecorderPage
2. ✅ **Builder** - UnifiedWorkflowEditor
3. ✅ **Tests** - TestRepository
4. ✅ **Automation** - TestCaseExecution, TestRuns
5. ✅ **Performance** - VirtualUserGenerator
6. ✅ **API Testing** - EnhancedAPITesting
7. ✅ **Accessibility** - Accessibility (added proper route)

---

*Last Updated: December 29, 2024*

