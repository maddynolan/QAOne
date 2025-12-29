/**
 * ArisTrace/Flowstral - QA Excellence Platform
 * 
 * CORE MODULES:
 * 1. Recorder - Browser test recording & automation (PlaywrightRecorderPage)
 * 2. Builder - Visual test workflow editor (UnifiedWorkflowEditor)
 * 3. Tests - Test repository & management (TestRepository)
 * 4. Automation - Test execution & runs (TestCaseExecution, TestRuns)
 * 5. Performance - Load testing & virtual users (VirtualUserGenerator)
 * 6. API Testing - REST & GraphQL testing (EnhancedAPITesting)
 * 7. Accessibility - WCAG compliance scanning (Accessibility)
 * 
 * ADDITIONAL FEATURES:
 * - Dashboard, Analytics, Results
 * - Test Plans, Test Suites, Defects
 * - Requirements, Traceability
 * - CI/CD Integration, Salesforce Tools
 * - Settings, Integrations
 */

import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useEffect } from "react";

// Layout
import { StreamlinedLayout } from "./components/StreamlinedLayout";

// Core Pages
import PlaywrightRecorderPage from "./pages/PlaywrightRecorderPage";
import UnifiedWorkflowEditor from "./pages/UnifiedWorkflowEditor";
import EnhancedAPITesting from "./pages/EnhancedAPITesting";
import VirtualUserGenerator from "./pages/VirtualUserGenerator";
import SalesforceToolsPage from "./pages/SalesforceToolsPage";

// Test Cases related pages
import TestCases from "./pages/TestCases";
import TestRepository from "./pages/TestRepository";
import EnterpriseTestRepository from "./pages/EnterpriseTestRepository";
import CreateTestCase from "./pages/CreateTestCase";
import EditTestCase from "./pages/EditTestCase";
import TestCaseExecution from "./pages/TestCaseExecution";
// TestExecution.tsx removed - functionality consolidated into TestRepository
import TestSuites from "./pages/TestSuites";
import TestRuns from "./pages/TestRuns";
import TestPlans from "./pages/TestPlans";
import CreateTestPlan from "./pages/CreateTestPlan";
import TestPlanDetail from "./pages/TestPlanDetail";

// Web-only additional pages
import Dashboard from "./pages/Dashboard";
import Analytics from "./pages/Analytics";
import FrameworkAnalyzer from "./pages/FrameworkAnalyzer";
import Traceability from "./pages/Traceability";
import Accessibility from "./pages/Accessibility";
import Requirements from "./pages/Requirements";
import CreateRequirement from "./pages/CreateRequirement";
import Defects from "./pages/Defects";
import CreateDefect from "./pages/CreateDefect";
import Settings from "./pages/Settings";
import ScheduledRuns from "./pages/ScheduledRuns";
import CICDIntegration from "./pages/CICDIntegration";
import ElementRepository from "./pages/ElementRepository";
import SelfHealing from "./pages/SelfHealing";
import Integrations from "./pages/Integrations";
import Results from "./pages/Results";
import ProjectManagement from "./pages/ProjectManagement";

// Auth (keep for future)
import { AuthProvider } from "./contexts/AuthContext";
import { ProtectedRoute, PublicRoute } from "./components/ProtectedRoute";
import { AuthPage } from "./pages/AuthPage";

// Utilities
import { dataStorageService } from "./lib/data-storage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

// ═══════════════════════════════════════════════════════════════════════════
// MAIN APP COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

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
              {/* ═══════════════════════════════════════════════════════════
                  PUBLIC ROUTES
                  ═══════════════════════════════════════════════════════════ */}
              <Route path="/auth" element={<PublicRoute><AuthPage /></PublicRoute>} />
              
              {/* ═══════════════════════════════════════════════════════════
                  MAIN APPLICATION - Streamlined Layout
                  ═══════════════════════════════════════════════════════════ */}
              <Route element={<StreamlinedLayout />}>
                
                {/* Default: Redirect to Recorder */}
                <Route path="/" element={<Navigate to="/recorder" replace />} />
                
                {/* ─────────────────────────────────────────────────────────
                    1. RECORDER MODULE
                    Browser test recording, playback, and automation
                    ───────────────────────────────────────────────────────── */}
                <Route path="/recorder" element={<PlaywrightRecorderPage />} />
                <Route path="/playwright-recorder" element={<Navigate to="/recorder" replace />} />
                
                {/* ─────────────────────────────────────────────────────────
                    2. TEST CASES MODULE
                    Unified test case management (manual + automated)
                    ───────────────────────────────────────────────────────── */}
                <Route path="/test-cases" element={<TestRepository />} />
                <Route path="/test-cases/list" element={<TestCases />} />
                <Route path="/test-cases/create" element={<CreateTestCase />} />
                <Route path="/test-cases/edit/:id" element={<EditTestCase />} />
                <Route path="/test-cases/builder" element={<UnifiedWorkflowEditor />} />
                <Route path="/test-cases/builder/:id" element={<UnifiedWorkflowEditor />} />
                {/* Step-level manual execution with evidence/screenshots/defects */}
                <Route path="/test-cases/execute/:testCaseId" element={<TestCaseExecution />} />
                <Route path="/execution/run/:runId/:testCaseId" element={<TestCaseExecution />} />
                <Route path="/repository" element={<TestRepository />} />
                <Route path="/enterprise" element={<EnterpriseTestRepository />} />
                <Route path="/test-runs" element={<TestRuns />} />
                
                {/* Legacy routes - redirect to new paths */}
                <Route path="/builder" element={<Navigate to="/test-cases/builder" replace />} />
                <Route path="/cases" element={<Navigate to="/test-cases" replace />} />
                <Route path="/cases/create" element={<Navigate to="/test-cases/create" replace />} />
                <Route path="/execution" element={<Navigate to="/test-cases/execute" replace />} />
                
                {/* ─────────────────────────────────────────────────────────
                    3. API TESTING MODULE
                    REST, GraphQL, and API endpoint testing
                    ───────────────────────────────────────────────────────── */}
                <Route path="/api" element={<EnhancedAPITesting />} />
                <Route path="/api/collections" element={<EnhancedAPITesting />} />
                <Route path="/api/history" element={<EnhancedAPITesting />} />
                <Route path="/api/environments" element={<EnhancedAPITesting />} />
                
                {/* Legacy routes */}
                <Route path="/enhanced-api-testing" element={<Navigate to="/api" replace />} />
                <Route path="/api-import" element={<Navigate to="/api" replace />} />
                
                {/* ─────────────────────────────────────────────────────────
                    4. PERFORMANCE MODULE
                    Load testing, stress testing, virtual users
                    ───────────────────────────────────────────────────────── */}
                <Route path="/performance" element={<VirtualUserGenerator />} />
                <Route path="/performance/load-test" element={<VirtualUserGenerator />} />
                <Route path="/performance/stress-test" element={<VirtualUserGenerator />} />
                <Route path="/performance/reports" element={<VirtualUserGenerator />} />
                
                {/* Legacy routes */}
                <Route path="/virtual-users" element={<Navigate to="/performance" replace />} />
                <Route path="/load-testing" element={<Navigate to="/performance" replace />} />
                
                {/* ─────────────────────────────────────────────────────────
                    5. SALESFORCE MODULE
                    Salesforce-specific testing tools
                    ───────────────────────────────────────────────────────── */}
                <Route path="/salesforce" element={<SalesforceToolsPage />} />
                <Route path="/salesforce/metadata" element={<SalesforceToolsPage />} />
                <Route path="/salesforce/apex" element={<SalesforceToolsPage />} />
                <Route path="/salesforce/validation" element={<SalesforceToolsPage />} />
                
                {/* Legacy routes */}
                <Route path="/salesforce-tools" element={<Navigate to="/salesforce" replace />} />

                {/* ═══════════════════════════════════════════════════════════
                    WEB-ONLY ADDITIONAL FEATURES
                    These are available on web but not shown in desktop nav
                    ═══════════════════════════════════════════════════════════ */}
                
                {/* Dashboard & Analytics */}
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/analytics" element={<Analytics />} />
                <Route path="/results" element={<Results />} />
                <Route path="/results-dashboard" element={<Results />} />
                
                {/* Test Suites & Plans (linked to Repository) */}
                <Route path="/suites" element={<TestSuites />} />
                <Route path="/test-suites" element={<TestSuites />} />
                <Route path="/plans" element={<TestPlans />} />
                <Route path="/plans/create" element={<CreateTestPlan />} />
                <Route path="/plans/:id" element={<TestPlanDetail />} />
                <Route path="/runs" element={<TestRuns />} />
                
                {/* Requirements & Traceability */}
                <Route path="/requirements" element={<Requirements />} />
                <Route path="/requirements/create" element={<CreateRequirement />} />
                <Route path="/traceability" element={<Traceability />} />
                
                {/* Defects */}
                <Route path="/defects" element={<Defects />} />
                <Route path="/defects/create" element={<CreateDefect />} />
                
                {/* Tools & Utilities */}
                <Route path="/accessibility" element={<Accessibility />} />
                <Route path="/framework-analyzer" element={<FrameworkAnalyzer />} />
                <Route path="/elements" element={<ElementRepository />} />
                <Route path="/self-healing" element={<SelfHealing />} />
                <Route path="/scheduled-runs" element={<ScheduledRuns />} />
                
                {/* Integrations */}
                <Route path="/integrations" element={<Integrations />} />
                <Route path="/cicd" element={<CICDIntegration />} />
                
                {/* Project Management */}
                <Route path="/projects" element={<ProjectManagement />} />
                <Route path="/project-boards" element={<ProjectManagement />} />
                
                {/* Settings */}
                <Route path="/settings" element={<Settings />} />
              </Route>

              {/* ═══════════════════════════════════════════════════════════
                  LEGACY REDIRECTS
                  Keep for backward compatibility with old URLs
                  ═══════════════════════════════════════════════════════════ */}
              <Route path="/flowstral" element={<Navigate to="/recorder" replace />} />
              <Route path="/flowstral/*" element={<Navigate to="/recorder" replace />} />
              <Route path="/trace" element={<Navigate to="/recorder" replace />} />
              <Route path="/nexus" element={<Navigate to="/recorder" replace />} />
              <Route path="/blaze" element={<Navigate to="/recorder" replace />} />
              <Route path="/exploration" element={<Navigate to="/recorder" replace />} />
              <Route path="/cdp-recorder" element={<Navigate to="/recorder" replace />} />
              <Route path="/desktop-recorder" element={<Navigate to="/recorder" replace />} />
              <Route path="/test-builder" element={<Navigate to="/test-cases/builder" replace />} />
              <Route path="/workflow-editor" element={<Navigate to="/test-cases/builder" replace />} />
              <Route path="/gherkin" element={<Navigate to="/test-cases" replace />} />
              <Route path="/triage" element={<Navigate to="/test-cases" replace />} />
              {/* /projects handled in main routes */}
              <Route path="/onboarding" element={<Navigate to="/recorder" replace />} />
              
              {/* ═══════════════════════════════════════════════════════════
                  404 - CATCH ALL
                  ═══════════════════════════════════════════════════════════ */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
