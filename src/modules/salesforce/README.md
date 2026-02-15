# Salesforce

Salesforce-specific testing tools including metadata inspection, SOQL querying, Apex execution, data management, and specialized test orchestration for Salesforce orgs. Provides deep integration with Salesforce APIs for QA workflows.

## Architecture

The module is organized into three layers:

1. **Hub Page** -- `SalesforceToolsPage` serves as the entry point with tabs/sections for all Salesforce testing capabilities.
2. **Components (23 files)** -- Specialized UI components for each Salesforce testing function, from SOQL building to regression testing.
3. **Lib (5 files)** -- API client, service layer, templates, test data factory, and integration helpers that encapsulate all Salesforce API communication.

The `salesforce/` sub-folder within components contains advanced domain-specific tools (metadata assertions, context dashboard, SOQL builder, stage transition tester).

## File Inventory

### Pages

| File | Lines | Purpose |
|------|-------|---------|
| `pages/SalesforceToolsPage.tsx` | 2,506 | Salesforce testing hub with tabs for all SF-specific tools |

### Components -- Top Level

| File | Lines | Purpose |
|------|-------|---------|
| `components/SalesforceIntegrationTesting.tsx` | 925 | Integration test configuration and execution for SF APIs |
| `components/SalesforceTestOrchestrator.tsx` | 877 | Orchestrate multi-step Salesforce test scenarios |
| `components/SalesforceUATesting.tsx` | 876 | User acceptance testing workflows for Salesforce |
| `components/SalesforceRegressionTesting.tsx` | 840 | Regression test suite management for SF deployments |
| `components/SalesforceFunctionalTesting.tsx` | 666 | Functional test case creation and execution |
| `components/SalesforceTemplates.tsx` | 655 | Pre-built test templates for common SF scenarios |
| `components/SalesforceApiReference.tsx` | 591 | Salesforce API endpoint reference and documentation |
| `components/SalesforceValidationPanel.tsx` | 590 | Validation rule testing and assertion configuration |
| `components/SalesforceAssertionBuilder.tsx` | 557 | Build assertions for Salesforce data and UI states |
| `components/SoqlEditor.tsx` | 546 | SOQL query editor with syntax highlighting and execution |
| `components/MobileDeviceSelector.tsx` | 531 | Device selection for Salesforce mobile testing |
| `components/SalesforceQuickRecordCreator.tsx` | 528 | Quickly create Salesforce records for test data |
| `components/SalesforceContextPanel.tsx` | 519 | Display current SF org context (user, org, permissions) |
| `components/SalesforceRecordCloner.tsx` | 517 | Clone Salesforce records for test data duplication |
| `components/SalesforceDataDiff.tsx` | 489 | Compare Salesforce data snapshots before/after operations |
| `components/SalesforceApexExecutor.tsx` | 465 | Execute anonymous Apex code and view results |
| `components/SalesforceDebugLogAnalyzer.tsx` | 431 | Analyze Salesforce debug logs for errors and performance |
| `components/SalesforceFieldAnalyzer.tsx` | 425 | Analyze object field metadata, dependencies, and usage |
| `components/SalesforceReportRunner.tsx` | 419 | Run Salesforce reports and validate output |
| `components/SalesforceRelationshipVisualizer.tsx` | 418 | Visualize object relationships and dependencies |

### Components -- salesforce/ Sub-folder

| File | Lines | Purpose |
|------|-------|---------|
| `components/salesforce/SFContextDashboard.tsx` | 738 | Salesforce org context dashboard with live data |
| `components/salesforce/MetadataAssertions.tsx` | 710 | Assert against Salesforce metadata (objects, fields, layouts) |
| `components/salesforce/SmartSOQLBuilder.tsx` | 601 | AI-assisted SOQL query builder with field suggestions |
| `components/salesforce/StageTransitionTester.tsx` | 484 | Test opportunity/case stage transitions and validation rules |
| `components/salesforce/index.ts` | -- | Barrel export for salesforce sub-components |

### Lib

| File | Lines | Purpose |
|------|-------|---------|
| `lib/salesforce-templates.ts` | 1,835 | Pre-built test templates for common Salesforce testing scenarios |
| `lib/salesforce-api.ts` | 1,312 | Salesforce REST API client (SOQL, CRUD, metadata, Apex, bulk) |
| `lib/salesforce-test-data-factory.ts` | 1,066 | Generate realistic Salesforce test data (accounts, contacts, opportunities, etc.) |
| `lib/salesforce-test-integration.ts` | 549 | Integration test harness for end-to-end SF workflows |
| `lib/salesforce-service.ts` | 498 | Service layer abstracting SF API calls with error handling |

### Module Entry

| File | Purpose |
|------|---------|
| `index.ts` | Barrel exports for pages, components, and lib utilities |

## API Endpoints Consumed

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/salesforce/connect` | POST | Establish Salesforce org connection (OAuth2) |
| `/api/salesforce/query` | POST | Execute SOQL query |
| `/api/salesforce/describe/{object}` | GET | Get object metadata/describe |
| `/api/salesforce/apex/execute` | POST | Execute anonymous Apex |
| `/api/salesforce/records` | POST/PUT/DELETE | CRUD operations on SF records |
| `/api/salesforce/metadata` | GET | Retrieve org metadata |
| `/api/salesforce/bulk` | POST | Bulk data operations |

## Dependencies

- **Internal**: `@/lib/api-config`, `@/components/ui/*`, `@/contexts/AuthContext`
- **External**: React 18, Tailwind CSS, Radix UI, Monaco Editor (SOQL/Apex editing), Lucide icons

## Testing Notes

- Salesforce API calls require an authenticated org connection; mock the `/api/salesforce/*` endpoints for unit tests.
- OAuth2 flow requires Salesforce Connected App credentials; cannot be tested without a real SF org.
- Test data factory generates realistic but synthetic data; verify field length limits match SF org configuration.
- SOQL editor should validate query syntax before execution.
- Stage transition tester depends on org-specific picklist values; tests need configurable stage definitions.
