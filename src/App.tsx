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
import TestRuns from "./pages/TestRuns";
import Triage from "./pages/Triage";
import Settings from "./pages/Settings";
import CreateTestPlan from "./pages/CreateTestPlan";
import EditTestPlan from "./pages/EditTestPlan";
import TestRunDetail from "./pages/TestRunDetail";
import Defects from "./pages/Defects";
import CreateDefect from "./pages/CreateDefect";
import NotFound from "./pages/NotFound";
import { AuthPage } from "./pages/AuthPage";
import { OnboardingPage } from "./pages/OnboardingPage";
import { dataStorageService } from "./lib/data-storage";

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
              <Route path="/runs" element={
                <ProtectedRoute>
                  <Layout><TestRuns /></Layout>
                </ProtectedRoute>
              } />
              <Route path="/runs/:id" element={
                <ProtectedRoute>
                  <Layout><TestRunDetail /></Layout>
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
