/**
 * ArisTrace/Flowstral - QA Excellence Platform
 * 
 * CORE MODULES:
 * 1. Smart Trace - Browser test tracing & automation (PlaywrightRecorderPage)
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
import { BrowserRouter, HashRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";

// Use HashRouter in Electron (file:// protocol) since BrowserRouter needs a real server.
// BrowserRouter uses /path URLs; HashRouter uses #/path URLs which work with file://.
const _isFileProtocol = typeof window !== 'undefined' && (
  window.location.protocol === 'file:' || 
  !!(window as any).electronAPI || 
  !!(window as any).flowstral
);
const Router = _isFileProtocol ? HashRouter : BrowserRouter;
import React, { useEffect, useMemo, Suspense, lazy } from "react";

// Layout
import { StreamlinedLayout } from "./components/StreamlinedLayout";

// License Gate - Blocks app without valid license (Electron only)
import { LicenseGate } from "./components/LicenseGate";

// Theme Provider
import { ThemeProvider } from "./contexts/ThemeContext";

// Global Error Boundary - prevents white screen on unhandled errors
import { GlobalErrorBoundary } from "./components/GlobalErrorBoundary";

// AI Provider - Global AI settings
import { AIProvider } from "./contexts/AIContext";

// ── Recorder Module ──
import PlaywrightRecorderPage from "./modules/recorder/pages/PlaywrightRecorderPage";
import SelfHealing from "./modules/recorder/pages/SelfHealing";
import ElementRepository from "./modules/recorder/pages/ElementRepository";

// ── Test Management Module ──
import UnifiedWorkflowEditor from "./modules/test-management/pages/UnifiedWorkflowEditor";
import TestRepository from "./modules/test-management/pages/TestRepository";
import EnterpriseTestRepository from "./modules/test-management/pages/EnterpriseTestRepository";
import TestCases from "./modules/test-management/pages/TestCases";
import CreateTestCase from "./modules/test-management/pages/CreateTestCase";
import EditTestCase from "./modules/test-management/pages/EditTestCase";
import TestCaseExecution from "./modules/test-management/pages/TestCaseExecution";
import TestSuites from "./modules/test-management/pages/TestSuites";
import TestRuns from "./modules/test-management/pages/TestRuns";
import TestPlans from "./modules/test-management/pages/TestPlans";
import CreateTestPlan from "./modules/test-management/pages/CreateTestPlan";
import TestPlanDetail from "./modules/test-management/pages/TestPlanDetail";
import TestPlayground from "./modules/test-management/pages/TestPlayground";
import ScheduledRuns from "./modules/test-management/pages/ScheduledRuns";

// ── API Testing Module ──
// Lazy-load API Testing so a bug there cannot crash the whole site (e.g. flowstral.com)
const EnhancedAPITesting = lazy(() => import("./modules/api-testing/pages/EnhancedAPITesting"));
import APICoverageMap from "./modules/api-testing/pages/APICoverageMap";

// ── Performance Module ──
import VirtualUserGenerator from "./modules/performance/pages/VirtualUserGenerator";

// ── Mobile Testing Module ──
import MobileTestingPage from "./modules/mobile-testing/pages/MobileTestingPage";

// ── Accessibility Module ──
import Accessibility from "./modules/accessibility/pages/Accessibility";

// ── Visual Testing Module ──
import VisualTestingPage from "./modules/visual-testing/pages/VisualTestingPage";

// ── Salesforce Module ──
import SalesforceToolsPage from "./modules/salesforce/pages/SalesforceToolsPage";

// ── AI Testing Module ──
import FlowpilotPage from "./modules/ai-testing/pages/FlowpilotPage";
import AITestingPage from "./modules/ai-testing/pages/AITestingPage";

// ── Dashboard Module ──
import Dashboard from "./modules/dashboard/pages/Dashboard";
import Analytics from "./modules/dashboard/pages/Analytics";
import Results from "./modules/dashboard/pages/Results";

// ── Platform Module (cross-cutting) ──
import Settings from "./modules/platform/pages/Settings";
import Integrations from "./modules/platform/pages/Integrations";
import Defects from "./modules/platform/pages/Defects";
import CreateDefect from "./modules/platform/pages/CreateDefect";
import Requirements from "./modules/platform/pages/Requirements";
import CreateRequirement from "./modules/platform/pages/CreateRequirement";
import Traceability from "./modules/platform/pages/Traceability";
import CICDIntegration from "./modules/platform/pages/CICDIntegration";
import SecretsVault from "./modules/platform/pages/SecretsVault";
import ProjectManagement from "./modules/platform/pages/ProjectManagement";
import AuditLogPage from "./modules/platform/pages/AuditLogPage";
import FrameworkAnalyzer from "./modules/platform/pages/FrameworkAnalyzer";
import CodeAlchemy from "./modules/platform/pages/CodeAlchemy";
import DataDependencyGraph from "./modules/platform/pages/DataDependencyGraph";
import APMConfig from "./modules/platform/pages/APMConfig";
import LicenseAdminPage from "./modules/platform/pages/LicenseAdminPage";
import NotFound from "./modules/platform/pages/NotFound";

// Auth (keep for future)
import { AuthProvider } from "./contexts/AuthContext";
import { ProtectedRoute, PublicRoute } from "./components/ProtectedRoute";
import { AuthPage } from "./modules/platform/pages/AuthPage";

// Landing Page & Marketing Pages
import LandingPage from "./pages/LandingPage";
import SmartRecorderPage from "./pages/marketing/SmartRecorderPage";
import FeaturePage from "./pages/marketing/FeaturePage";
import PricingPage from "./pages/marketing/PricingPage";
import AboutPage from "./pages/marketing/AboutPage";
import ContactPage from "./pages/marketing/ContactPage";
import PlaceholderPage from "./pages/marketing/PlaceholderPage";
import TermsPage from "./pages/marketing/TermsPage";
import PrivacyPage from "./pages/marketing/PrivacyPage";
import FAQPage from "./pages/marketing/FAQPage";
import DemoPage from "./pages/marketing/DemoPage";
import DownloadPage from "./pages/marketing/DownloadPage";
import SignInPage from "./pages/marketing/SignInPage";
import SignUpPage from "./pages/marketing/SignUpPage";
import WelcomePage from "./pages/marketing/WelcomePage";
import ComparePage from "./pages/marketing/ComparePage";
import CostCalculatorPage from "./pages/marketing/CostCalculatorPage";
import BlogPage from "./pages/marketing/BlogPage";

// Utilities
import { dataStorageService } from "./lib/data-storage";

// Web Analytics (GA4 + Clarity) — disabled in Electron
import { initAnalytics, trackPageView } from "./lib/web-analytics";

const queryClient = new QueryClient();

/** Fires a GA4 page_view on every route change. Must be inside <Router>. */
function RouteTracker() {
  const location = useLocation();
  useEffect(() => {
    trackPageView(location.pathname);
  }, [location.pathname]);
  return null;
}

// ═══════════════════════════════════════════════════════════════════════════
// ELECTRON DETECTION
// ═══════════════════════════════════════════════════════════════════════════

// Check if running in Electron desktop app
const isElectron = (): boolean => {
  // Check for Electron-specific globals
  if (typeof window !== 'undefined') {
    // @ts-ignore - electron preload may expose this
    if (window.electron) return true;
    // Check user agent
    if (navigator.userAgent.toLowerCase().includes('electron')) return true;
    // Check for Electron-specific process
    // @ts-ignore
    if (window.process?.type === 'renderer') return true;
  }
  return false;
};

// Root route component - shows Landing Page for web, redirects to Dashboard for Electron
const RootRoute = () => {
  const inElectron = useMemo(() => isElectron(), []);
  
  if (inElectron) {
    // Electron app: go directly to Dashboard
    return <Navigate to="/dashboard" replace />;
  }
  
  // Web browser: show Landing Page
  return <LandingPage />;
};

// ═══════════════════════════════════════════════════════════════════════════
// MAIN APP COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

const App = () => {
  useEffect(() => {
    // Initialize web analytics (GA4 + Clarity) — skipped in Electron
    initAnalytics();

    // One-time cleanup: remove old localStorage test data
    // All data now lives in persistent database (/api/db/)
    const cleaned = localStorage.getItem('qaai_localstorage_cleaned_v3');
    if (!cleaned) {
      const keysToRemove = [
        'test_cases', 'flowstral_test_cases', 'test_plans', 'test_runs',
        'test_execution_history', 'test_suites', 'defects', 'test_defects',
        'test_releases', 'releases', 'test_repository_folders', 'test_folders',
        'test_schedules', 'test_environments', 'reusable_modules',
        'deleted_test_ids', 'workflow_test_history', 'qaai_test_results',
        'unified_test_history', 'tm_test_cases', 'tm_test_suites', 
        'tm_schedules', 'tm_environments', 'tm_cache_timestamps',
        'requirements', 'use_scale_db', 'execution_queue',
        'api_saved_requests', 'api_saved_chains',
        'qaai_localstorage_cleaned_v2', // clean up old marker
      ];
      // Also remove unified_test_case_* and run_results_* keys
      Object.keys(localStorage).filter(k => k.startsWith('unified_test_case_')).forEach(k => keysToRemove.push(k));
      Object.keys(localStorage).filter(k => k.startsWith('run_results_')).forEach(k => keysToRemove.push(k));
      keysToRemove.forEach(k => { try { localStorage.removeItem(k); } catch {} });
      localStorage.setItem('qaai_localstorage_cleaned_v3', 'true');
      console.log('[QAAI] Cleaned old localStorage test data. All data now in persistent database.');
    }
    // No sample data - enterprise mode: all data comes from team members via the database
  }, []);

  return (
    <GlobalErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AIProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <AuthProvider>
              <Router>
              <RouteTracker />
              <Routes>
                {/* ═══════════════════════════════════════════════════════════
                    PUBLIC ROUTES
                    - Web: Shows Landing Page
                    - Electron: Redirects to Dashboard
                    ═══════════════════════════════════════════════════════════ */}
                <Route path="/" element={<RootRoute />} />
                <Route path="/auth" element={<PublicRoute><AuthPage /></PublicRoute>} />
                
                {/* Marketing Pages */}
                <Route path="/landing" element={<LandingPage />} />
                <Route path="/test-playground" element={<TestPlayground />} />
                <Route path="/products/smart-recorder" element={<SmartRecorderPage />} />
                <Route path="/products/:feature" element={<FeaturePage />} />
                <Route path="/pricing" element={<PricingPage />} />
                <Route path="/about" element={<AboutPage />} />
                <Route path="/contact" element={<ContactPage />} />
                <Route path="/terms" element={<TermsPage />} />
                <Route path="/privacy" element={<PrivacyPage />} />
                <Route path="/faq" element={<FAQPage />} />
                <Route path="/demo" element={<DemoPage />} />
                <Route path="/download" element={<DownloadPage />} />
                <Route path="/signin" element={<SignInPage />} />
                <Route path="/signup" element={<SignUpPage />} />
                <Route path="/welcome" element={<WelcomePage />} />
                <Route path="/compare/:competitor" element={<ComparePage />} />
                <Route path="/tools/cost-calculator" element={<CostCalculatorPage />} />
                <Route path="/blog" element={<BlogPage />} />
                <Route path="/blog/:slug" element={<BlogPage />} />
                <Route path="/resources/:page" element={<PlaceholderPage />} />
                <Route path="/company/:page" element={<PlaceholderPage />} />
                
                {/* License Admin Dashboard (restricted to admin emails) */}
                <Route path="/admin/licenses" element={<LicenseAdminPage />} />
                
                {/* ═══════════════════════════════════════════════════════════
                    MAIN APPLICATION - Streamlined Layout
                    Protected by License Gate (Electron app requires valid license)
                    ═══════════════════════════════════════════════════════════ */}
                <Route element={<LicenseGate><StreamlinedLayout /></LicenseGate>}>
                  
                  {/* Default App Home: Redirect to Smart Trace */}
                  <Route path="/app" element={<Navigate to="/recorder" replace />} />

                  {/* ─────────────────────────────────────────────────────────
                      1. SMART TRACE MODULE
                      Browser test tracing, playback, and automation
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
                  <Route path="/api" element={<Suspense fallback={<div className="flex items-center justify-center min-h-[50vh]"><span className="text-muted-foreground">Loading API Testing...</span></div>}><EnhancedAPITesting /></Suspense>} />
                  <Route path="/api/collections" element={<Suspense fallback={<div className="flex items-center justify-center min-h-[50vh]"><span className="text-muted-foreground">Loading API Testing...</span></div>}><EnhancedAPITesting /></Suspense>} />
                  <Route path="/api/history" element={<Suspense fallback={<div className="flex items-center justify-center min-h-[50vh]"><span className="text-muted-foreground">Loading API Testing...</span></div>}><EnhancedAPITesting /></Suspense>} />
                  <Route path="/api/environments" element={<Suspense fallback={<div className="flex items-center justify-center min-h-[50vh]"><span className="text-muted-foreground">Loading API Testing...</span></div>}><EnhancedAPITesting /></Suspense>} />
                  
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

                  {/* ─────────────────────────────────────────────────────────
                      6. MOBILE TESTING MODULE
                      Mobile device emulation and native app testing
                      ───────────────────────────────────────────────────────── */}
                  <Route path="/mobile" element={<MobileTestingPage />} />
                  <Route path="/mobile/devices" element={<MobileTestingPage />} />
                  <Route path="/mobile/native" element={<MobileTestingPage />} />
                  
                  {/* ─────────────────────────────────────────────────────────
                      7. FLOWPILOT MODULE
                      Goal-based agentic testing with AI
                      ───────────────────────────────────────────────────────── */}
                  <Route path="/flowpilot" element={<FlowpilotPage />} />
                  <Route path="/flowpilot/explorer" element={<FlowpilotPage />} />
                  <Route path="/flowpilot/generator" element={<FlowpilotPage />} />
                  <Route path="/flowpilot/self-healer" element={<FlowpilotPage />} />

                  {/* ─────────────────────────────────────────────────────────
                      8. AI TESTING MODULE - REVOLUTIONARY
                      Plain English → Comprehensive Tests (World's Simplest)
                      ───────────────────────────────────────────────────────── */}
                  <Route path="/ai-testing" element={<AITestingPage />} />

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
                  <Route path="/visual-testing" element={<VisualTestingPage />} />
                  <Route path="/framework-analyzer" element={<FrameworkAnalyzer />} />
                  <Route path="/code-alchemy" element={<CodeAlchemy />} />
                  <Route path="/elements" element={<ElementRepository />} />
                  <Route path="/self-healing" element={<SelfHealing />} />
                  <Route path="/scheduled-runs" element={<ScheduledRuns />} />
                  
                  {/* Integrations */}
                  <Route path="/integrations" element={<Integrations />} />
                  <Route path="/cicd" element={<CICDIntegration />} />
                  
                  {/* Secrets Vault */}
                  <Route path="/secrets" element={<SecretsVault />} />
                  
                  {/* API Coverage Map */}
                  <Route path="/coverage" element={<APICoverageMap />} />
                  
                  {/* Data Dependency Graph */}
                  <Route path="/data-flow" element={<DataDependencyGraph />} />
                  
                  {/* APM Configuration */}
                  <Route path="/apm" element={<APMConfig />} />
                  
                  {/* Project Management */}
                  <Route path="/projects" element={<ProjectManagement />} />
                  <Route path="/project-boards" element={<ProjectManagement />} />
                  
                  {/* Audit Log — Enterprise compliance */}
                  <Route path="/audit-log" element={<AuditLogPage />} />

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
              </Router>
            </AuthProvider>
          </TooltipProvider>
        </AIProvider>
      </ThemeProvider>
    </QueryClientProvider>
    </GlobalErrorBoundary>
  );
};

export default App;
