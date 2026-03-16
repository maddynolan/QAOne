/**
 * Flowstral - QA Automation Platform
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

// ── Critical path: keep eager (auth, landing, sign-in/up) ──
import { AuthProvider } from "./contexts/AuthContext";
import { ProtectedRoute, PublicRoute } from "./components/ProtectedRoute";
import LandingPage from "./pages/LandingPage";
import SignInPage from "./pages/marketing/SignInPage";
import SignUpPage from "./pages/marketing/SignUpPage";
import PageLoadingFallback from "./components/PageLoadingFallback";

// ── Lazy-loaded pages: loaded on-demand per route ──

// Auth
const AuthPage = lazy(() => import("./modules/platform/pages/AuthPage").then(m => ({ default: m.AuthPage })));

// Recorder Module
const PlaywrightRecorderPage = lazy(() => import("./modules/recorder/pages/PlaywrightRecorderPage"));
const SelfHealing = lazy(() => import("./modules/recorder/pages/SelfHealing"));
const ElementRepository = lazy(() => import("./modules/recorder/pages/ElementRepository"));

// Test Management Module
const UnifiedWorkflowEditor = lazy(() => import("./modules/test-management/pages/UnifiedWorkflowEditor"));
const TestRepository = lazy(() => import("./modules/test-management/pages/TestRepository"));
const EnterpriseTestRepository = lazy(() => import("./modules/test-management/pages/EnterpriseTestRepository"));
const TestCases = lazy(() => import("./modules/test-management/pages/TestCases"));
const CreateTestCase = lazy(() => import("./modules/test-management/pages/CreateTestCase"));
const EditTestCase = lazy(() => import("./modules/test-management/pages/EditTestCase"));
const TestCaseExecution = lazy(() => import("./modules/test-management/pages/TestCaseExecution"));
const TestSuites = lazy(() => import("./modules/test-management/pages/TestSuites"));
const TestRuns = lazy(() => import("./modules/test-management/pages/TestRuns"));
const TestPlans = lazy(() => import("./modules/test-management/pages/TestPlans"));
const CreateTestPlan = lazy(() => import("./modules/test-management/pages/CreateTestPlan"));
const TestPlanDetail = lazy(() => import("./modules/test-management/pages/TestPlanDetail"));
const TestPlayground = lazy(() => import("./modules/test-management/pages/TestPlayground"));
const ScheduledRuns = lazy(() => import("./modules/test-management/pages/ScheduledRuns"));

// API Testing Module
const EnhancedAPITesting = lazy(() => import("./modules/api-testing/pages/EnhancedAPITesting"));
const APICoverageMap = lazy(() => import("./modules/api-testing/pages/APICoverageMap"));

// Performance Module
const VirtualUserGenerator = lazy(() => import("./modules/performance/pages/VirtualUserGenerator"));

// Mobile Testing Module
const MobileTestingPage = lazy(() => import("./modules/mobile-testing/pages/MobileTestingPage"));

// Accessibility Module
const Accessibility = lazy(() => import("./modules/accessibility/pages/Accessibility"));

// Visual Testing Module
const VisualTestingPage = lazy(() => import("./modules/visual-testing/pages/VisualTestingPage"));

// Salesforce Module
const SalesforceToolsPage = lazy(() => import("./modules/salesforce/pages/SalesforceToolsPage"));

// AI Testing Module
const FlowpilotPage = lazy(() => import("./modules/ai-testing/pages/FlowpilotPage"));
const AITestingPage = lazy(() => import("./modules/ai-testing/pages/AITestingPage"));

// Dashboard Module
const Dashboard = lazy(() => import("./modules/dashboard/pages/Dashboard"));
const Analytics = lazy(() => import("./modules/dashboard/pages/Analytics"));
const Results = lazy(() => import("./modules/dashboard/pages/Results"));

// Platform Module (cross-cutting)
const Settings = lazy(() => import("./modules/platform/pages/Settings"));
const Integrations = lazy(() => import("./modules/platform/pages/Integrations"));
const Defects = lazy(() => import("./modules/platform/pages/Defects"));
const CreateDefect = lazy(() => import("./modules/platform/pages/CreateDefect"));
const Requirements = lazy(() => import("./modules/platform/pages/Requirements"));
const CreateRequirement = lazy(() => import("./modules/platform/pages/CreateRequirement"));
const Traceability = lazy(() => import("./modules/platform/pages/Traceability"));
const CICDIntegration = lazy(() => import("./modules/platform/pages/CICDIntegration"));
const SecretsVault = lazy(() => import("./modules/platform/pages/SecretsVault"));
const ProjectManagement = lazy(() => import("./modules/platform/pages/ProjectManagement"));
const AuditLogPage = lazy(() => import("./modules/platform/pages/AuditLogPage"));
const FrameworkAnalyzer = lazy(() => import("./modules/platform/pages/FrameworkAnalyzer"));
const CodeAlchemy = lazy(() => import("./modules/platform/pages/CodeAlchemy"));
const DataDependencyGraph = lazy(() => import("./modules/platform/pages/DataDependencyGraph"));
const APMConfig = lazy(() => import("./modules/platform/pages/APMConfig"));
const LicenseAdminPage = lazy(() => import("./modules/platform/pages/LicenseAdminPage"));
const NotFound = lazy(() => import("./modules/platform/pages/NotFound"));

// Marketing Pages
const SmartRecorderPage = lazy(() => import("./pages/marketing/SmartRecorderPage"));
const FeaturePage = lazy(() => import("./pages/marketing/FeaturePage"));
const PricingPage = lazy(() => import("./pages/marketing/PricingPage"));
const AboutPage = lazy(() => import("./pages/marketing/AboutPage"));
const ContactPage = lazy(() => import("./pages/marketing/ContactPage"));
const PlaceholderPage = lazy(() => import("./pages/marketing/PlaceholderPage"));
const TermsPage = lazy(() => import("./pages/marketing/TermsPage"));
const PrivacyPage = lazy(() => import("./pages/marketing/PrivacyPage"));
const FAQPage = lazy(() => import("./pages/marketing/FAQPage"));
const DemoPage = lazy(() => import("./pages/marketing/DemoPage"));
const DownloadPage = lazy(() => import("./pages/marketing/DownloadPage"));
const WelcomePage = lazy(() => import("./pages/marketing/WelcomePage"));
const ComparePage = lazy(() => import("./pages/marketing/ComparePage"));
const CostCalculatorPage = lazy(() => import("./pages/marketing/CostCalculatorPage"));
const BlogPage = lazy(() => import("./pages/marketing/BlogPage"));

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
                <Route path="/auth" element={<PublicRoute><Suspense fallback={<PageLoadingFallback />}><AuthPage /></Suspense></PublicRoute>} />

                {/* Marketing Pages */}
                <Route path="/landing" element={<LandingPage />} />
                <Route path="/test-playground" element={<Suspense fallback={<PageLoadingFallback />}><TestPlayground /></Suspense>} />
                <Route path="/products/smart-recorder" element={<Suspense fallback={<PageLoadingFallback />}><SmartRecorderPage /></Suspense>} />
                <Route path="/products/:feature" element={<Suspense fallback={<PageLoadingFallback />}><FeaturePage /></Suspense>} />
                <Route path="/pricing" element={<Suspense fallback={<PageLoadingFallback />}><PricingPage /></Suspense>} />
                <Route path="/about" element={<Suspense fallback={<PageLoadingFallback />}><AboutPage /></Suspense>} />
                <Route path="/contact" element={<Suspense fallback={<PageLoadingFallback />}><ContactPage /></Suspense>} />
                <Route path="/terms" element={<Suspense fallback={<PageLoadingFallback />}><TermsPage /></Suspense>} />
                <Route path="/privacy" element={<Suspense fallback={<PageLoadingFallback />}><PrivacyPage /></Suspense>} />
                <Route path="/faq" element={<Suspense fallback={<PageLoadingFallback />}><FAQPage /></Suspense>} />
                <Route path="/demo" element={<Suspense fallback={<PageLoadingFallback />}><DemoPage /></Suspense>} />
                <Route path="/download" element={<Suspense fallback={<PageLoadingFallback />}><DownloadPage /></Suspense>} />
                <Route path="/signin" element={<SignInPage />} />
                <Route path="/signup" element={<SignUpPage />} />
                <Route path="/welcome" element={<Suspense fallback={<PageLoadingFallback />}><WelcomePage /></Suspense>} />
                <Route path="/compare/:competitor" element={<Suspense fallback={<PageLoadingFallback />}><ComparePage /></Suspense>} />
                <Route path="/tools/cost-calculator" element={<Suspense fallback={<PageLoadingFallback />}><CostCalculatorPage /></Suspense>} />
                <Route path="/blog" element={<Suspense fallback={<PageLoadingFallback />}><BlogPage /></Suspense>} />
                <Route path="/blog/:slug" element={<Suspense fallback={<PageLoadingFallback />}><BlogPage /></Suspense>} />
                <Route path="/resources/:page" element={<Suspense fallback={<PageLoadingFallback />}><PlaceholderPage /></Suspense>} />
                <Route path="/company/:page" element={<Suspense fallback={<PageLoadingFallback />}><PlaceholderPage /></Suspense>} />

                {/* License Admin Dashboard (restricted to admin emails) */}
                <Route path="/admin/licenses" element={<Suspense fallback={<PageLoadingFallback />}><LicenseAdminPage /></Suspense>} />
                
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
                  <Route path="/recorder" element={<Suspense fallback={<PageLoadingFallback />}><PlaywrightRecorderPage /></Suspense>} />
                  <Route path="/playwright-recorder" element={<Navigate to="/recorder" replace />} />

                  {/* ─────────────────────────────────────────────────────────
                      2. TEST CASES MODULE
                      Unified test case management (manual + automated)
                      ───────────────────────────────────────────────────────── */}
                  <Route path="/test-cases" element={<Suspense fallback={<PageLoadingFallback />}><TestRepository /></Suspense>} />
                  <Route path="/test-cases/list" element={<Suspense fallback={<PageLoadingFallback />}><TestCases /></Suspense>} />
                  <Route path="/test-cases/create" element={<Suspense fallback={<PageLoadingFallback />}><CreateTestCase /></Suspense>} />
                  <Route path="/test-cases/edit/:id" element={<Suspense fallback={<PageLoadingFallback />}><EditTestCase /></Suspense>} />
                  <Route path="/test-cases/builder" element={<Suspense fallback={<PageLoadingFallback />}><UnifiedWorkflowEditor /></Suspense>} />
                  <Route path="/test-cases/builder/:id" element={<Suspense fallback={<PageLoadingFallback />}><UnifiedWorkflowEditor /></Suspense>} />
                  {/* Step-level manual execution with evidence/screenshots/defects */}
                  <Route path="/test-cases/execute/:testCaseId" element={<Suspense fallback={<PageLoadingFallback />}><TestCaseExecution /></Suspense>} />
                  <Route path="/execution/run/:runId/:testCaseId" element={<Suspense fallback={<PageLoadingFallback />}><TestCaseExecution /></Suspense>} />
                  <Route path="/repository" element={<Suspense fallback={<PageLoadingFallback />}><TestRepository /></Suspense>} />
                  <Route path="/enterprise" element={<Suspense fallback={<PageLoadingFallback />}><EnterpriseTestRepository /></Suspense>} />
                  <Route path="/test-runs" element={<Suspense fallback={<PageLoadingFallback />}><TestRuns /></Suspense>} />
                  
                  {/* Legacy routes - redirect to new paths */}
                  <Route path="/builder" element={<Navigate to="/test-cases/builder" replace />} />
                  <Route path="/cases" element={<Navigate to="/test-cases" replace />} />
                  <Route path="/cases/create" element={<Navigate to="/test-cases/create" replace />} />
                  <Route path="/execution" element={<Navigate to="/test-cases/execute" replace />} />
                  
                  {/* ─────────────────────────────────────────────────────────
                      3. API TESTING MODULE
                      REST, GraphQL, and API endpoint testing
                      ───────────────────────────────────────────────────────── */}
                  <Route path="/api" element={<Suspense fallback={<PageLoadingFallback />}><EnhancedAPITesting /></Suspense>} />
                  <Route path="/api/collections" element={<Suspense fallback={<PageLoadingFallback />}><EnhancedAPITesting /></Suspense>} />
                  <Route path="/api/history" element={<Suspense fallback={<PageLoadingFallback />}><EnhancedAPITesting /></Suspense>} />
                  <Route path="/api/environments" element={<Suspense fallback={<PageLoadingFallback />}><EnhancedAPITesting /></Suspense>} />
                  
                  {/* Legacy routes */}
                  <Route path="/enhanced-api-testing" element={<Navigate to="/api" replace />} />
                  <Route path="/api-import" element={<Navigate to="/api" replace />} />
                  
                  {/* ─────────────────────────────────────────────────────────
                      4. PERFORMANCE MODULE
                      Load testing, stress testing, virtual users
                      ───────────────────────────────────────────────────────── */}
                  <Route path="/performance" element={<Suspense fallback={<PageLoadingFallback />}><VirtualUserGenerator /></Suspense>} />
                  <Route path="/performance/load-test" element={<Suspense fallback={<PageLoadingFallback />}><VirtualUserGenerator /></Suspense>} />
                  <Route path="/performance/stress-test" element={<Suspense fallback={<PageLoadingFallback />}><VirtualUserGenerator /></Suspense>} />
                  <Route path="/performance/reports" element={<Suspense fallback={<PageLoadingFallback />}><VirtualUserGenerator /></Suspense>} />
                  
                  {/* Legacy routes */}
                  <Route path="/virtual-users" element={<Navigate to="/performance" replace />} />
                  <Route path="/load-testing" element={<Navigate to="/performance" replace />} />
                  
                  {/* ─────────────────────────────────────────────────────────
                      5. SALESFORCE MODULE
                      Salesforce-specific testing tools
                      ───────────────────────────────────────────────────────── */}
                  <Route path="/salesforce" element={<Suspense fallback={<PageLoadingFallback />}><SalesforceToolsPage /></Suspense>} />
                  <Route path="/salesforce/metadata" element={<Suspense fallback={<PageLoadingFallback />}><SalesforceToolsPage /></Suspense>} />
                  <Route path="/salesforce/apex" element={<Suspense fallback={<PageLoadingFallback />}><SalesforceToolsPage /></Suspense>} />
                  <Route path="/salesforce/validation" element={<Suspense fallback={<PageLoadingFallback />}><SalesforceToolsPage /></Suspense>} />
                  
                  {/* Legacy routes */}
                  <Route path="/salesforce-tools" element={<Navigate to="/salesforce" replace />} />

                  {/* ─────────────────────────────────────────────────────────
                      6. MOBILE TESTING MODULE
                      Mobile device emulation and native app testing
                      ───────────────────────────────────────────────────────── */}
                  <Route path="/mobile" element={<Suspense fallback={<PageLoadingFallback />}><MobileTestingPage /></Suspense>} />
                  <Route path="/mobile/devices" element={<Suspense fallback={<PageLoadingFallback />}><MobileTestingPage /></Suspense>} />
                  <Route path="/mobile/native" element={<Suspense fallback={<PageLoadingFallback />}><MobileTestingPage /></Suspense>} />
                  
                  {/* ─────────────────────────────────────────────────────────
                      7. FLOWPILOT MODULE
                      Goal-based agentic testing with AI
                      ───────────────────────────────────────────────────────── */}
                  <Route path="/flowpilot" element={<Suspense fallback={<PageLoadingFallback />}><FlowpilotPage /></Suspense>} />
                  <Route path="/flowpilot/explorer" element={<Suspense fallback={<PageLoadingFallback />}><FlowpilotPage /></Suspense>} />
                  <Route path="/flowpilot/generator" element={<Suspense fallback={<PageLoadingFallback />}><FlowpilotPage /></Suspense>} />
                  <Route path="/flowpilot/self-healer" element={<Suspense fallback={<PageLoadingFallback />}><FlowpilotPage /></Suspense>} />

                  {/* ─────────────────────────────────────────────────────────
                      8. AI TESTING MODULE - REVOLUTIONARY
                      Plain English → Comprehensive Tests (World's Simplest)
                      ───────────────────────────────────────────────────────── */}
                  <Route path="/ai-testing" element={<Suspense fallback={<PageLoadingFallback />}><AITestingPage /></Suspense>} />

                  {/* ═══════════════════════════════════════════════════════════
                      WEB-ONLY ADDITIONAL FEATURES
                      These are available on web but not shown in desktop nav
                      ═══════════════════════════════════════════════════════════ */}
                  
                  {/* Dashboard & Analytics */}
                  <Route path="/dashboard" element={<Suspense fallback={<PageLoadingFallback />}><Dashboard /></Suspense>} />
                  <Route path="/analytics" element={<Suspense fallback={<PageLoadingFallback />}><Analytics /></Suspense>} />
                  <Route path="/results" element={<Suspense fallback={<PageLoadingFallback />}><Results /></Suspense>} />
                  <Route path="/results-dashboard" element={<Suspense fallback={<PageLoadingFallback />}><Results /></Suspense>} />

                  {/* Test Suites & Plans (linked to Repository) */}
                  <Route path="/suites" element={<Suspense fallback={<PageLoadingFallback />}><TestSuites /></Suspense>} />
                  <Route path="/test-suites" element={<Suspense fallback={<PageLoadingFallback />}><TestSuites /></Suspense>} />
                  <Route path="/plans" element={<Suspense fallback={<PageLoadingFallback />}><TestPlans /></Suspense>} />
                  <Route path="/plans/create" element={<Suspense fallback={<PageLoadingFallback />}><CreateTestPlan /></Suspense>} />
                  <Route path="/plans/:id" element={<Suspense fallback={<PageLoadingFallback />}><TestPlanDetail /></Suspense>} />
                  <Route path="/runs" element={<Suspense fallback={<PageLoadingFallback />}><TestRuns /></Suspense>} />

                  {/* Requirements & Traceability */}
                  <Route path="/requirements" element={<Suspense fallback={<PageLoadingFallback />}><Requirements /></Suspense>} />
                  <Route path="/requirements/create" element={<Suspense fallback={<PageLoadingFallback />}><CreateRequirement /></Suspense>} />
                  <Route path="/traceability" element={<Suspense fallback={<PageLoadingFallback />}><Traceability /></Suspense>} />

                  {/* Defects */}
                  <Route path="/defects" element={<Suspense fallback={<PageLoadingFallback />}><Defects /></Suspense>} />
                  <Route path="/defects/create" element={<Suspense fallback={<PageLoadingFallback />}><CreateDefect /></Suspense>} />

                  {/* Tools & Utilities */}
                  <Route path="/accessibility" element={<Suspense fallback={<PageLoadingFallback />}><Accessibility /></Suspense>} />
                  <Route path="/visual-testing" element={<Suspense fallback={<PageLoadingFallback />}><VisualTestingPage /></Suspense>} />
                  <Route path="/framework-analyzer" element={<Suspense fallback={<PageLoadingFallback />}><FrameworkAnalyzer /></Suspense>} />
                  <Route path="/code-alchemy" element={<Suspense fallback={<PageLoadingFallback />}><CodeAlchemy /></Suspense>} />
                  <Route path="/elements" element={<Suspense fallback={<PageLoadingFallback />}><ElementRepository /></Suspense>} />
                  <Route path="/self-healing" element={<Suspense fallback={<PageLoadingFallback />}><SelfHealing /></Suspense>} />
                  <Route path="/scheduled-runs" element={<Suspense fallback={<PageLoadingFallback />}><ScheduledRuns /></Suspense>} />

                  {/* Integrations */}
                  <Route path="/integrations" element={<Suspense fallback={<PageLoadingFallback />}><Integrations /></Suspense>} />
                  <Route path="/cicd" element={<Suspense fallback={<PageLoadingFallback />}><CICDIntegration /></Suspense>} />

                  {/* Secrets Vault */}
                  <Route path="/secrets" element={<Suspense fallback={<PageLoadingFallback />}><SecretsVault /></Suspense>} />

                  {/* API Coverage Map */}
                  <Route path="/coverage" element={<Suspense fallback={<PageLoadingFallback />}><APICoverageMap /></Suspense>} />

                  {/* Data Dependency Graph */}
                  <Route path="/data-flow" element={<Suspense fallback={<PageLoadingFallback />}><DataDependencyGraph /></Suspense>} />

                  {/* APM Configuration */}
                  <Route path="/apm" element={<Suspense fallback={<PageLoadingFallback />}><APMConfig /></Suspense>} />

                  {/* Project Management */}
                  <Route path="/projects" element={<Suspense fallback={<PageLoadingFallback />}><ProjectManagement /></Suspense>} />
                  <Route path="/project-boards" element={<Suspense fallback={<PageLoadingFallback />}><ProjectManagement /></Suspense>} />

                  {/* Audit Log — Enterprise compliance */}
                  <Route path="/audit-log" element={<Suspense fallback={<PageLoadingFallback />}><AuditLogPage /></Suspense>} />

                  {/* Settings */}
                  <Route path="/settings" element={<Suspense fallback={<PageLoadingFallback />}><Settings /></Suspense>} />
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

                {/* Marketing URL redirects — prevent 404 for common typed URLs */}
                <Route path="/features" element={<Navigate to="/" replace />} />
                <Route path="/smart-recorder" element={<Navigate to="/products/smart-recorder" replace />} />
                
                {/* ═══════════════════════════════════════════════════════════
                    404 - CATCH ALL
                    ═══════════════════════════════════════════════════════════ */}
                <Route path="*" element={<Suspense fallback={<PageLoadingFallback />}><NotFound /></Suspense>} />
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
