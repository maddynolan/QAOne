/**
 * @module salesforce
 *
 * Salesforce-specific testing tools, metadata analysis, and test generation.
 *
 * Features:
 * - Salesforce org connection & OAuth2 authentication
 * - Metadata exploration (objects, fields, validation rules, flows)
 * - SOQL query editor
 * - Apex code execution
 * - Validation rule testing (positive & negative)
 * - Functional, regression, integration, and UAT testing
 * - Test data generation with industry-specific templates
 * - Salesforce-specific Playwright code generation
 */

// Pages
export { default as SalesforceToolsPage } from './pages/SalesforceToolsPage';

// Components
export { default as SalesforceApexExecutor } from './components/SalesforceApexExecutor';
export { default as SalesforceApiReference } from './components/SalesforceApiReference';
export { default as SalesforceAssertionBuilder } from './components/SalesforceAssertionBuilder';
export { default as SalesforceContextPanel } from './components/SalesforceContextPanel';
export { default as SalesforceDataDiff } from './components/SalesforceDataDiff';
export { default as SalesforceDebugLogAnalyzer } from './components/SalesforceDebugLogAnalyzer';
export { default as SalesforceFieldAnalyzer } from './components/SalesforceFieldAnalyzer';
export { default as SalesforceFunctionalTesting } from './components/SalesforceFunctionalTesting';
export { default as SalesforceIntegrationTesting } from './components/SalesforceIntegrationTesting';
export { default as SalesforceQuickRecordCreator } from './components/SalesforceQuickRecordCreator';
export { default as SalesforceRecordCloner } from './components/SalesforceRecordCloner';
export { default as SalesforceRegressionTesting } from './components/SalesforceRegressionTesting';
export { default as SalesforceRelationshipVisualizer } from './components/SalesforceRelationshipVisualizer';
export { default as SalesforceReportRunner } from './components/SalesforceReportRunner';
export { default as SalesforceTemplates } from './components/SalesforceTemplates';
export { default as SalesforceTestOrchestrator } from './components/SalesforceTestOrchestrator';
export { default as SalesforceUATesting } from './components/SalesforceUATesting';
export { default as SalesforceValidationPanel } from './components/SalesforceValidationPanel';
export { default as SoqlEditor } from './components/SoqlEditor';

// Lib
export { salesforceApi } from './lib/salesforce-api';
export { salesforceService } from './lib/salesforce-service';
export { salesforceTestIntegration } from './lib/salesforce-test-integration';
export { testDataFactory } from './lib/salesforce-test-data-factory';
