/**
 * @module test-management
 *
 * Test case creation, management, execution, and reporting.
 *
 * Features:
 * - Visual no-code test builder (UnifiedWorkflowEditor)
 * - Test repository with folders & suites
 * - Step-by-step manual execution with evidence capture
 * - Test plans, test runs, and scheduled runs
 * - Reusable modules & workflow editor
 * - AI test generation from requirements
 * - Gherkin/BDD support
 */

// Pages
export { default as UnifiedWorkflowEditor } from './pages/UnifiedWorkflowEditor';
export { default as TestRepository } from './pages/TestRepository';
export { default as EnterpriseTestRepository } from './pages/EnterpriseTestRepository';
export { default as TestCases } from './pages/TestCases';
export { default as CreateTestCase } from './pages/CreateTestCase';
export { default as EditTestCase } from './pages/EditTestCase';
export { default as TestCaseExecution } from './pages/TestCaseExecution';
export { default as TestSuites } from './pages/TestSuites';
export { default as TestRuns } from './pages/TestRuns';
export { default as TestPlans } from './pages/TestPlans';
export { default as CreateTestPlan } from './pages/CreateTestPlan';
export { default as TestPlanDetail } from './pages/TestPlanDetail';
export { default as TestPlayground } from './pages/TestPlayground';
export { default as ScheduledRuns } from './pages/ScheduledRuns';

// Components
export { default as ReusableModulesManager } from './components/ReusableModulesManager';
export { default as SimpleStepEditor } from './components/SimpleStepEditor';
export { default as VirtualTestCaseList } from './components/VirtualTestCaseList';
export { default as TraceabilityMatrix } from './components/TraceabilityMatrix';
