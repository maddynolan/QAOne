import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useEffect } from "react";
import { AuthProvider } from "./contexts/AuthContext";
import { ProtectedRoute, PublicRoute } from "./components/ProtectedRoute";
import { Layout } from "./components/Layout";
import Dashboard from "./pages/Dashboard";
import TestPlans from "./pages/TestPlans";
import TestCases from "./pages/TestCases";
import CreateTestCase from "./pages/CreateTestCase";
import EditTestCase from "./pages/EditTestCase";
import TestRuns from "./pages/TestRuns";
import Requirements from "./pages/Requirements";
import CreateRequirement from "./pages/CreateRequirement";
import Triage from "./pages/Triage";
import Settings from "./pages/Settings";
import CreateTestPlan from "./pages/CreateTestPlan";
import EditTestPlan from "./pages/EditTestPlan";
import TestRunDetail from "./pages/TestRunDetail";
import TestCaseExecution from "./pages/TestCaseExecution";
import CreateTestRun from "./pages/CreateTestRun";
import SelectTestCases from "./pages/SelectTestCases";
import Defects from "./pages/Defects";
import CreateDefect from "./pages/CreateDefect";
import RunAutomation from "./pages/RunAutomation";
import Flowstral from "./pages/Flowstral";
import Trace from "./pages/Trace";
import FlowstralWorkflowEditor from "./pages/FlowstralWorkflowEditor";
import Nexus from "./pages/Nexus";
import Blaze from "./pages/Blaze";
import Exploration from "./pages/Exploration";
import FrameworkAnalyzer from "./pages/FrameworkAnalyzer";
import JiraIntegration from "./pages/JiraIntegration";
import GitHubIntegration from "./pages/GitHubIntegration";
import AzureDevOpsIntegration from "./pages/AzureDevOpsIntegration";
import ConfluenceIntegration from "./pages/ConfluenceIntegration";
import CICDIntegration from "./pages/CICDIntegration";
import Integrations from "./pages/Integrations";
import NotFound from "./pages/NotFound";
import { AuthPage } from "./pages/AuthPage";
import { OnboardingPage } from "./pages/OnboardingPage";
import { dataStorageService } from "./lib/data-storage";
import APIImport from "./pages/APIImport";
import EnhancedAPITesting from "./pages/EnhancedAPITesting";
import GherkinConverter from "./pages/GherkinConverter";
import Accessibility from "./pages/Accessibility";
import Performance from "./pages/Performance";
import Analytics from "./pages/Analytics";
import ElementRepository from "./pages/ElementRepository";
import CICDWizard from "./pages/CICDWizard";
import EnhancedWorkflowEditor from "./pages/EnhancedWorkflowEditor";
import TestResultsDashboard from "./pages/TestResultsDashboard";
import TestSuites from "./pages/TestSuites";
import ScheduledRuns from "./pages/ScheduledRuns";
import ProjectManagement from "./pages/ProjectManagement";
import VirtualUserGenerator from "./pages/VirtualUserGenerator";
import Traceability from "./pages/Traceability";
import TestExecution from "./pages/TestExecution";
import TestCaseExecutor from "./pages/TestCaseExecutor";
import TestPlanDetail from "./pages/TestPlanDetail";
import SelfHealing from "./pages/SelfHealing";

const queryClient = new QueryClient();

const App = () => {
  useEffect(() => {
    // Initialize sample data when app starts
    dataStorageService.initializeSampleData();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <AuthProvider>
          <BrowserRouter>
            <Routes>
              {/* Public Routes */}
              <Route path="/auth" element={<PublicRoute><AuthPage /></PublicRoute>} />
              
              {/* Protected Routes */}
              <Route path="/" element={
                <ProtectedRoute>
                  <Layout><Dashboard /></Layout>
                </ProtectedRoute>
              } />
              <Route path="/onboarding" element={
                <ProtectedRoute>
                  <OnboardingPage />
                </ProtectedRoute>
              } />
              <Route path="/plans" element={
                <ProtectedRoute>
                  <Layout><TestPlans /></Layout>
                </ProtectedRoute>
              } />
              <Route path="/plans/create" element={
                <ProtectedRoute>
                  <Layout><CreateTestPlan /></Layout>
                </ProtectedRoute>
              } />
              <Route path="/plans/edit/:id" element={
                <ProtectedRoute>
                  <Layout><EditTestPlan /></Layout>
                </ProtectedRoute>
              } />
              <Route path="/cases" element={
                <ProtectedRoute>
                  <Layout><TestCases /></Layout>
                </ProtectedRoute>
              } />
              <Route path="/cases/create" element={
                <ProtectedRoute>
                  <Layout><CreateTestCase /></Layout>
                </ProtectedRoute>
              } />
              <Route path="/cases/edit/:id" element={
                <ProtectedRoute>
                  <Layout><EditTestCase /></Layout>
                </ProtectedRoute>
              } />
              <Route path="/test-suites" element={
                <ProtectedRoute>
                  <TestSuites />
                </ProtectedRoute>
              } />
              <Route path="/suites" element={
                <ProtectedRoute>
                  <TestSuites />
                </ProtectedRoute>
              } />
              <Route path="/execution" element={
                <ProtectedRoute>
                  <Layout><TestExecution /></Layout>
                </ProtectedRoute>
              } />
              <Route path="/execution/run/:id" element={
                <ProtectedRoute>
                  <Layout><TestCaseExecutor /></Layout>
                </ProtectedRoute>
              } />
              <Route path="/execution/plan/:id" element={
                <ProtectedRoute>
                  <Layout><TestPlanDetail /></Layout>
                </ProtectedRoute>
              } />
              <Route path="/runs" element={
                <ProtectedRoute>
                  <Layout><TestExecution /></Layout>
                </ProtectedRoute>
              } />
              <Route path="/runs/create" element={
                <ProtectedRoute>
                  <Layout><CreateTestRun /></Layout>
                </ProtectedRoute>
              } />
              <Route path="/runs/create/select-cases" element={
                <ProtectedRoute>
                  <Layout><SelectTestCases /></Layout>
                </ProtectedRoute>
              } />
              <Route path="/runs/:id" element={
                <ProtectedRoute>
                  <Layout><TestRunDetail /></Layout>
                </ProtectedRoute>
              } />
              <Route path="/runs/:runId/cases/:caseId/execute" element={
                <ProtectedRoute>
                  <Layout><TestCaseExecution /></Layout>
                </ProtectedRoute>
              } />
              <Route path="/scheduled-runs" element={
                <ProtectedRoute>
                  <ScheduledRuns />
                </ProtectedRoute>
              } />
              <Route path="/projects" element={
                <ProtectedRoute>
                  <ProjectManagement />
                </ProtectedRoute>
              } />
              <Route path="/runs/automation" element={
                <ProtectedRoute>
                  <Layout><RunAutomation /></Layout>
                </ProtectedRoute>
              } />
              <Route path="/results-dashboard" element={
                <ProtectedRoute>
                  <TestResultsDashboard />
                </ProtectedRoute>
              } />
              <Route path="/flowstral" element={
                <ProtectedRoute>
                  <Layout><Trace /></Layout>
                </ProtectedRoute>
              } />
              <Route path="/flowstral-legacy" element={
                <ProtectedRoute>
                  <Layout><Flowstral /></Layout>
                </ProtectedRoute>
              } />
              <Route path="/flowstral/workflow-editor" element={
                <ProtectedRoute>
                  <FlowstralWorkflowEditor />
                </ProtectedRoute>
              } />
              <Route path="/workflow-editor" element={
                <ProtectedRoute>
                  <EnhancedWorkflowEditor />
                </ProtectedRoute>
              } />
              <Route path="/builder" element={
                <ProtectedRoute>
                  <UnifiedWorkflowEditor />
                </ProtectedRoute>
              } />
              <Route path="/nexus" element={
                <ProtectedRoute>
                  <Layout><Blaze /></Layout>
                </ProtectedRoute>
              } />
              <Route path="/nexus-legacy" element={
                <ProtectedRoute>
                  <Layout><Nexus /></Layout>
                </ProtectedRoute>
              } />
              <Route path="/exploration" element={
                <ProtectedRoute>
                  <Layout><Exploration /></Layout>
                </ProtectedRoute>
              } />
              <Route path="/framework-analyzer" element={
                <ProtectedRoute>
                  <Layout><FrameworkAnalyzer /></Layout>
                </ProtectedRoute>
              } />
              <Route path="/requirements" element={
                <ProtectedRoute>
                  <Layout><Requirements /></Layout>
                </ProtectedRoute>
              } />
              <Route path="/requirements/create" element={
                <ProtectedRoute>
                  <Layout><CreateRequirement /></Layout>
                </ProtectedRoute>
              } />
              <Route path="/requirements/edit/:id" element={
                <ProtectedRoute>
                  <Layout><CreateRequirement /></Layout>
                </ProtectedRoute>
              } />
              <Route path="/defects" element={
                <ProtectedRoute>
                  <Layout><Defects /></Layout>
                </ProtectedRoute>
              } />
              <Route path="/defects/create" element={
                <ProtectedRoute>
                  <Layout><CreateDefect /></Layout>
                </ProtectedRoute>
              } />
              <Route path="/defects/edit/:id" element={
                <ProtectedRoute>
                  <Layout><CreateDefect /></Layout>
                </ProtectedRoute>
              } />
              <Route path="/triage" element={
                <ProtectedRoute>
                  <Layout><Triage /></Layout>
                </ProtectedRoute>
              } />
              <Route path="/settings" element={
                <ProtectedRoute>
                  <Layout><Settings /></Layout>
                </ProtectedRoute>
              } />
              <Route path="/integrations" element={
                <ProtectedRoute>
                  <Layout><Integrations /></Layout>
                </ProtectedRoute>
              } />
              <Route path="/integrations/jira" element={
                <ProtectedRoute>
                  <Layout><JiraIntegration /></Layout>
                </ProtectedRoute>
              } />
              <Route path="/integrations/github" element={
                <ProtectedRoute>
                  <Layout><GitHubIntegration /></Layout>
                </ProtectedRoute>
              } />
              <Route path="/integrations/azure-devops" element={
                <ProtectedRoute>
                  <Layout><AzureDevOpsIntegration /></Layout>
                </ProtectedRoute>
              } />
              <Route path="/integrations/confluence" element={
                <ProtectedRoute>
                  <Layout><ConfluenceIntegration /></Layout>
                </ProtectedRoute>
              } />
              <Route path="/integrations/cicd" element={
                <ProtectedRoute>
                  <Layout><CICDIntegration /></Layout>
                </ProtectedRoute>
              } />
              {/* API Import merged into Enhanced API Testing (Apex) */}
              <Route path="/api-import" element={
                <ProtectedRoute>
                  <Layout><EnhancedAPITesting /></Layout>
                </ProtectedRoute>
              } />
              <Route path="/enhanced-api-testing" element={
                <ProtectedRoute>
                  <Layout><EnhancedAPITesting /></Layout>
                </ProtectedRoute>
              } />
              <Route path="/virtual-users" element={
                <ProtectedRoute>
                  <Layout><VirtualUserGenerator /></Layout>
                </ProtectedRoute>
              } />
              <Route path="/load-testing" element={
                <ProtectedRoute>
                  <Layout><VirtualUserGenerator /></Layout>
                </ProtectedRoute>
              } />
              <Route path="/gherkin" element={
                <ProtectedRoute>
                  <Layout><GherkinConverter /></Layout>
                </ProtectedRoute>
              } />
              <Route path="/accessibility" element={
                <ProtectedRoute>
                  <Layout><Accessibility /></Layout>
                </ProtectedRoute>
              } />
              {/* /performance redirects to merged /load-testing page */}
              <Route path="/performance" element={
                <ProtectedRoute>
                  <Layout><VirtualUserGenerator /></Layout>
                </ProtectedRoute>
              } />
              <Route path="/analytics" element={
                <ProtectedRoute>
                  <Layout><Analytics /></Layout>
                </ProtectedRoute>
              } />
              <Route path="/traceability" element={
                <ProtectedRoute>
                  <Layout><Traceability /></Layout>
                </ProtectedRoute>
              } />
              <Route path="/elements" element={
                <ProtectedRoute>
                  <Layout><ElementRepository /></Layout>
                </ProtectedRoute>
              } />
              <Route path="/self-healing" element={
                <ProtectedRoute>
                  <Layout><SelfHealing /></Layout>
                </ProtectedRoute>
              } />
              <Route path="/cicd" element={
                <ProtectedRoute>
                  <Layout><CICDWizard /></Layout>
                </ProtectedRoute>
              } />
              
              {/* Catch-all route */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
