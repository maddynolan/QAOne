# Platform (Cross-Cutting)

Settings, integrations, defects, requirements, CI/CD configuration, and platform-wide features. This module contains all cross-cutting concerns that support the core testing modules, including project management, authentication, third-party integrations, and system administration.

## Architecture

The platform module is organized into functional groups:

1. **Integrations** -- Jira, GitHub, Azure DevOps, Confluence integration pages with webhook and sync configuration.
2. **CI/CD** -- Pipeline configuration (CICD, CICDIntegration, CICDWizard) for GitHub Actions, GitLab CI, Jenkins, Azure Pipelines.
3. **Defects & Requirements** -- Defect tracking and requirements management with bidirectional traceability.
4. **Administration** -- Settings, license management, secrets vault, project management, and APM configuration.
5. **Utilities** -- Code analysis (CodeAlchemy, FrameworkAnalyzer), data dependency graphs, and workspace switching.
6. **Auth** -- Authentication page for login/signup/OAuth flows.

## File Inventory

### Pages

| File | Lines | Purpose |
|------|-------|---------|
| `pages/ProjectManagement.tsx` | 2,259 | Project creation, configuration, team management, and settings |
| `pages/FrameworkAnalyzer.tsx` | 1,395 | Analyze test framework usage, patterns, and migration paths |
| `pages/CodeAlchemy.tsx` | 1,336 | Repository import and code analysis for test generation |
| `pages/Traceability.tsx` | 1,019 | End-to-end traceability from requirements to test cases to defects |
| `pages/CICDWizard.tsx` | 870 | Step-by-step CI/CD pipeline configuration wizard |
| `pages/LicenseAdminPage.tsx` | 704 | License management, activation, and feature gating administration |
| `pages/Settings.tsx` | 687 | Application settings -- theme, notifications, API keys, preferences |
| `pages/CreateRequirement.tsx` | 630 | Requirement creation form with priority, status, and linking |
| `pages/CreateDefect.tsx` | 624 | Defect creation form with severity, assignee, and evidence |
| `pages/Requirements.tsx` | 465 | Requirements listing with filtering, status tracking, and bulk operations |
| `pages/SecretsVault.tsx` | 464 | Secure secrets management for API keys, tokens, and credentials |
| `pages/DataDependencyGraph.tsx` | 438 | Visualize data dependencies across test cases and environments |
| `pages/CICD.tsx` | 424 | CI/CD pipeline overview and status dashboard |
| `pages/CICDIntegration.tsx` | 392 | CI/CD tool integration configuration |
| `pages/JiraIntegration.tsx` | 380 | Jira project connection, issue sync, and webhook setup |
| `pages/APMConfig.tsx` | 369 | Application Performance Monitoring configuration |
| `pages/GitHubIntegration.tsx` | 330 | GitHub repository connection, PR triggers, and status checks |
| `pages/ConfluenceIntegration.tsx` | 283 | Confluence space connection for test documentation sync |
| `pages/AuthPage.tsx` | 276 | Login, signup, and OAuth authentication flows |
| `pages/AzureDevOpsIntegration.tsx` | 266 | Azure DevOps project connection and pipeline triggers |
| `pages/Defects.tsx` | 182 | Defect listing with status tracking and assignment |
| `pages/Integrations.tsx` | 160 | Integration hub listing all available third-party connections |
| `pages/NotFound.tsx` | 24 | 404 Not Found page |

### Components

| File | Lines | Purpose |
|------|-------|---------|
| `components/PluginManagement.tsx` | 391 | Plugin installation, configuration, and lifecycle management |
| `components/WorkspaceSwitcher.tsx` | 132 | Switch between workspaces/projects in the sidebar |

### Module Entry

| File | Purpose |
|------|---------|
| `index.ts` | Barrel exports for all platform pages and components |

## API Endpoints Consumed

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/projects` | GET/POST | List and create projects |
| `/api/projects/{id}` | GET/PUT/DELETE | Project CRUD |
| `/defects` | GET/POST | List and create defects |
| `/defects/{id}` | GET/PUT/DELETE | Defect CRUD |
| `/api/requirements` | GET/POST | List and create requirements |
| `/api/requirements/{id}` | GET/PUT/DELETE | Requirement CRUD |
| `/api/secrets` | GET/POST | List and create secrets |
| `/api/secrets/{id}` | DELETE | Delete secret |
| `/api/license/activate` | POST | Activate license key |
| `/api/license/status` | GET | Check license status and features |
| `/api/code-alchemy/import` | POST | Import repository for code analysis |
| `/api/framework/analyze` | POST | Analyze test framework |
| `/dashboard/*` | GET | Dashboard metrics (shared with dashboard module) |
| `/health` | GET | System health check |

## Dependencies

- **Internal**: `@/lib/api-config`, `@/components/ui/*`, `@/contexts/AuthContext`, `@/contexts/ThemeContext`
- **External**: React 18, TanStack React Query, Tailwind CSS, Radix UI, Lucide icons, Supabase (auth)

## Testing Notes

- Authentication flows depend on Supabase auth; mock Supabase client for unit tests.
- Integration pages (Jira, GitHub, Azure DevOps, Confluence) require OAuth credentials; test UI independently of live connections.
- License gating uses `LicenseGate` wrapper component; test both licensed and unlicensed states.
- Secrets vault must never display secret values in logs or error messages.
- CI/CD wizard generates pipeline YAML; validate output syntax for each supported platform.
- Traceability page depends on linked requirements, test cases, and defects; test with various linking states.
- WorkspaceSwitcher should handle rapid switching and verify state cleanup between projects.
