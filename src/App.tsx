import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useEffect } from "react";
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
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Layout><Dashboard /></Layout>} />
            <Route path="/plans" element={<Layout><TestPlans /></Layout>} />
            <Route path="/plans/create" element={<Layout><CreateTestPlan /></Layout>} />
            <Route path="/plans/edit/:id" element={<Layout><EditTestPlan /></Layout>} />
            <Route path="/cases" element={<Layout><TestCases /></Layout>} />
            <Route path="/cases/create" element={<Layout><CreateTestCase /></Layout>} />
            <Route path="/runs" element={<Layout><TestRuns /></Layout>} />
            <Route path="/runs/:id" element={<Layout><TestRunDetail /></Layout>} />
            <Route path="/defects" element={<Layout><Defects /></Layout>} />
            <Route path="/defects/create" element={<Layout><CreateDefect /></Layout>} />
            <Route path="/triage" element={<Layout><Triage /></Layout>} />
            <Route path="/settings" element={<Layout><Settings /></Layout>} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
