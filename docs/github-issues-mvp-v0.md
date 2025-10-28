# QAOne MVP v0 - GitHub Issues

This document contains all 14 EPICs with detailed checklists for the QAOne MVP. Each EPIC can be copied as individual GitHub issues or imported as a single markdown file.

## Labels
- `epic` - Main EPIC issues
- `backend` - Backend/FastAPI related
- `frontend` - Frontend/React related  
- `runner` - Test runner related
- `integration` - Third-party integrations
- `security` - Security and auth related
- `analytics` - Analytics and reporting
- `infra` - Infrastructure and DevOps
- `good first issue` - Good for new contributors
- `docs` - Documentation related

## Milestone
`MVP v0`

---

## EPIC 1 — Multi-Tenancy & Data Model (Supabase + RLS)

**Labels:** `epic`, `backend`, `security`  
**Assignee:** `[be]`

### Description
Implement a robust multi-tenant data model using Supabase with Row Level Security (RLS) to ensure complete data isolation between organizations and projects.

### Acceptance Criteria
- [ ] Database schema supports organizations → projects → test cases hierarchy
- [ ] Row Level Security policies implemented for all tables
- [ ] Users can only access data from their organizations/projects
- [ ] Database functions for user permission checking
- [ ] Proper indexes for performance
- [ ] Migration scripts for schema deployment
- [ ] TypeScript types generated from database schema
- [ ] Service layer for database operations

### Tasks
- [ ] Design database schema with proper relationships
- [ ] Implement RLS policies for all tables
- [ ] Create helper functions for permission checking
- [ ] Add database indexes for performance
- [ ] Generate TypeScript types from schema
- [ ] Create service layer for CRUD operations
- [ ] Write migration scripts
- [ ] Test data isolation between tenants

---

## EPIC 2 — Auth, RBAC & Org/Project Switcher

**Labels:** `epic`, `frontend`, `backend`, `security`  
**Assignees:** `[fe]`, `[be]`

### Description
Implement authentication, role-based access control, and organization/project switching functionality.

### Acceptance Criteria
- [ ] Supabase Auth integration with email/password
- [ ] Role-based access control (owner, admin, member, viewer)
- [ ] Organization and project membership management
- [ ] UI for switching between organizations/projects
- [ ] Protected routes based on user permissions
- [ ] User profile management
- [ ] Invitation system for organization members

### Tasks
- [ ] Set up Supabase Auth configuration
- [ ] Implement user registration and login flows
- [ ] Create RBAC middleware for API routes
- [ ] Build organization switcher component
- [ ] Build project switcher component
- [ ] Implement protected route components
- [ ] Create user profile management UI
- [ ] Build invitation system
- [ ] Add role-based UI element visibility
- [ ] Test permission boundaries

---

## EPIC 3 — AI Service v0 (Generate Tests)

**Labels:** `epic`, `backend`, `ai`  
**Assignee:** `[be]`

### Description
Implement AI-powered test case generation service that can create structured test cases from requirements and context.

### Acceptance Criteria
- [ ] `/ai/generate-tests` endpoint implemented
- [ ] Support for different test styles (Gherkin, imperative)
- [ ] Context-aware test generation
- [ ] Audit trail for AI usage and costs
- [ ] Rate limiting and idempotency
- [ ] Integration with custom LLM backend
- [ ] Fallback to mock service in development

### Tasks
- [ ] Implement AI service backend endpoint
- [ ] Add request validation and rate limiting
- [ ] Create test case generation logic
- [ ] Implement audit logging for AI usage
- [ ] Add idempotency key support
- [ ] Create mock AI service for development
- [ ] Add error handling and retries
- [ ] Write comprehensive tests
- [ ] Document API usage

---

## EPIC 4 — AI Service v0 (Triage)

**Labels:** `epic`, `backend`, `ai`  
**Assignee:** `[be]`

### Description
Implement AI-powered failure triage that analyzes test logs and artifacts to provide root cause analysis and suggested fixes.

### Acceptance Criteria
- [ ] `/ai/triage` endpoint implemented
- [ ] Analysis of test logs and artifacts
- [ ] Root cause categorization (locator, timing, network, data, environment)
- [ ] Suggested fixes and selector improvements
- [ ] Flakiness likelihood scoring
- [ ] Related test case identification
- [ ] Confidence scoring for analysis

### Tasks
- [ ] Implement triage analysis endpoint
- [ ] Create log parsing and analysis logic
- [ ] Add artifact processing (screenshots, videos, traces)
- [ ] Implement root cause categorization
- [ ] Create fix suggestion engine
- [ ] Add flakiness detection
- [ ] Implement related case finding
- [ ] Add confidence scoring
- [ ] Write tests for triage accuracy

---

## EPIC 5 — Playwright Runner (Agent) v0

**Labels:** `epic`, `runner`, `backend`, `infra`  
**Assignee:** `[be]`

### Description
Implement a Playwright-based test runner that can execute UI tests and collect artifacts.

### Acceptance Criteria
- [ ] Playwright test execution engine
- [ ] Artifact collection (screenshots, videos, traces)
- [ ] Test result reporting
- [ ] Parallel test execution
- [ ] Environment configuration
- [ ] Integration with test run ingestion API

### Tasks
- [ ] Set up Playwright test runner
- [ ] Implement artifact collection
- [ ] Create test result reporting
- [ ] Add parallel execution support
- [ ] Implement environment configuration
- [ ] Create API integration for result submission
- [ ] Add error handling and retries
- [ ] Write runner tests
- [ ] Document runner usage

---

## EPIC 6 — Results Ingestion & Run Detail UI

**Labels:** `epic`, `backend`, `frontend`  
**Assignees:** `[be]`, `[fe]`

### Description
Implement test run result ingestion and detailed UI for viewing test run results.

### Acceptance Criteria
- [ ] `/runs/ingest` endpoint for test result submission
- [ ] Test run detail page with step-by-step results
- [ ] Artifact viewing (screenshots, videos, logs)
- [ ] Test run history and filtering
- [ ] Real-time updates for running tests
- [ ] Export functionality for test results

### Tasks
- [ ] Implement run ingestion API
- [ ] Create test run detail page
- [ ] Build artifact viewer components
- [ ] Add test run history and filtering
- [ ] Implement real-time updates
- [ ] Create export functionality
- [ ] Add search and filtering
- [ ] Write comprehensive tests

---

## EPIC 7 — Jira Integration (MVP)

**Labels:** `epic`, `integration`, `backend`  
**Assignee:** `[be]`

### Description
Implement basic Jira integration for defect tracking and issue management.

### Acceptance Criteria
- [ ] Jira webhook endpoint for issue updates
- [ ] Defect creation from failed tests
- [ ] Issue status synchronization
- [ ] Basic Jira API integration
- [ ] Configuration management for Jira settings

### Tasks
- [ ] Set up Jira API integration
- [ ] Implement webhook endpoint
- [ ] Create defect-to-issue mapping
- [ ] Add status synchronization
- [ ] Implement configuration management
- [ ] Add error handling
- [ ] Write integration tests
- [ ] Document Jira setup

---

## EPIC 8 — Analytics v1 (Org Dashboard)

**Labels:** `epic`, `analytics`, `frontend`  
**Assignee:** `[fe]`

### Description
Create organization-level analytics dashboard with key metrics and insights.

### Acceptance Criteria
- [ ] Test execution metrics and trends
- [ ] Failure rate analysis
- [ ] Test coverage reporting
- [ ] Performance metrics
- [ ] Team productivity insights
- [ ] Customizable dashboard widgets

### Tasks
- [ ] Design analytics data model
- [ ] Create metrics calculation logic
- [ ] Build dashboard components
- [ ] Add chart and visualization libraries
- [ ] Implement filtering and date ranges
- [ ] Add export functionality
- [ ] Create responsive design
- [ ] Write analytics tests

---

## EPIC 9 — Self-Healing Hooks (Selectors & Retries)

**Labels:** `epic`, `runner`, `ai`  
**Assignee:** `[be]`

### Description
Implement self-healing capabilities for test selectors and automatic retry mechanisms.

### Acceptance Criteria
- [ ] Selector healing for UI tests
- [ ] Automatic retry with exponential backoff
- [ ] Smart selector suggestions
- [ ] Flaky test detection
- [ ] Self-healing configuration options

### Tasks
- [ ] Implement selector healing logic
- [ ] Add retry mechanisms
- [ ] Create selector suggestion engine
- [ ] Implement flaky test detection
- [ ] Add configuration options
- [ ] Write healing tests
- [ ] Document self-healing features

---

## EPIC 10 — Usage & Cost Telemetry

**Labels:** `epic`, `backend`, `analytics`  
**Assignee:** `[be]`

### Description
Implement comprehensive telemetry for AI usage, costs, and platform metrics.

### Acceptance Criteria
- [ ] AI usage tracking and cost calculation
- [ ] Platform usage metrics
- [ ] Performance monitoring
- [ ] Error tracking and alerting
- [ ] Usage analytics and reporting

### Tasks
- [ ] Implement telemetry collection
- [ ] Add cost calculation logic
- [ ] Create usage analytics
- [ ] Implement performance monitoring
- [ ] Add error tracking
- [ ] Create alerting system
- [ ] Write telemetry tests

---

## EPIC 11 — CI/CD & Quality Gates

**Labels:** `epic`, `infra`, `qa`  
**Assignee:** `[devops]`

### Description
Set up CI/CD pipelines with quality gates and automated testing.

### Acceptance Criteria
- [ ] GitHub Actions CI/CD pipeline
- [ ] Automated testing (unit, integration, e2e)
- [ ] Code quality checks (linting, formatting)
- [ ] Security scanning
- [ ] Deployment automation
- [ ] Quality gates for PRs

### Tasks
- [ ] Set up GitHub Actions workflows
- [ ] Configure automated testing
- [ ] Add code quality checks
- [ ] Implement security scanning
- [ ] Create deployment automation
- [ ] Set up quality gates
- [ ] Write CI/CD documentation

---

## EPIC 12 — Security & Secrets Hygiene

**Labels:** `epic`, `security`, `infra`  
**Assignees:** `[devops]`, `[be]`

### Description
Implement comprehensive security measures and secrets management.

### Acceptance Criteria
- [ ] Secrets management and rotation
- [ ] API security (rate limiting, authentication)
- [ ] Data encryption at rest and in transit
- [ ] Security headers and CORS
- [ ] Vulnerability scanning
- [ ] Security audit logging

### Tasks
- [ ] Implement secrets management
- [ ] Add API security measures
- [ ] Configure encryption
- [ ] Set up security headers
- [ ] Implement vulnerability scanning
- [ ] Add security audit logging
- [ ] Create security documentation

---

## EPIC 13 — Docs & Demos

**Labels:** `epic`, `docs`  
**Assignee:** `[fe]`

### Description
Create comprehensive documentation and demo materials.

### Acceptance Criteria
- [ ] API documentation with examples
- [ ] User guides and tutorials
- [ ] Architecture documentation
- [ ] Demo environment setup
- [ ] Video tutorials
- [ ] Developer onboarding guide

### Tasks
- [ ] Write API documentation
- [ ] Create user guides
- [ ] Document architecture
- [ ] Set up demo environment
- [ ] Create video tutorials
- [ ] Write developer guide
- [ ] Add inline code documentation

---

## EPIC 14 — Hardening & Bug Bash

**Labels:** `epic`, `qa`  
**Assignees:** `[fe]`, `[be]`

### Description
Final hardening phase with comprehensive testing and bug fixing.

### Acceptance Criteria
- [ ] Comprehensive test coverage
- [ ] Performance optimization
- [ ] Bug fixing and stability improvements
- [ ] User acceptance testing
- [ ] Load testing
- [ ] Security penetration testing

### Tasks
- [ ] Increase test coverage
- [ ] Optimize performance
- [ ] Fix identified bugs
- [ ] Conduct UAT
- [ ] Perform load testing
- [ ] Security testing
- [ ] Final documentation review

---

## Import Instructions

### Option 1: Individual Issues
Copy each EPIC section above and create individual GitHub issues with the specified labels and assignees.

### Option 2: Bulk Import
1. Create a GitHub Project called "MVP v0"
2. Import this markdown file as issues
3. Assign labels and team members as specified

### Option 3: Automated Creation
Use GitHub CLI or API to create all issues programmatically:

```bash
# Example using GitHub CLI
gh issue create --title "EPIC 1 — Multi-Tenancy & Data Model" --body "$(cat epic1.md)" --label "epic,backend,security" --assignee @backend-team
```

## Next Steps

1. **Create GitHub Project**: Set up "MVP v0" project board
2. **Assign Team Members**: Update `[be]`, `[fe]`, `[devops]` placeholders with actual usernames
3. **Break Down EPICs**: Create child issues for each checklist item
4. **Set Priorities**: Order EPICs by dependency and business value
5. **Track Progress**: Use GitHub project boards for visual progress tracking
