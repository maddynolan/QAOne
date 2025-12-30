/**
 * Enterprise Test Repository
 * ==========================
 * High-performance test management page using:
 * - Server-side pagination (via API v2)
 * - Virtual scrolling (only renders visible rows)
 * - Zustand state management (persists across navigation)
 * - React Query caching (auto-refresh, stale-while-revalidate)
 * 
 * Handles 100,000+ test cases without breaking a sweat.
 */

import React, { useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FolderTree, Layers, Target, Rocket, PlayCircle,
  Plus, Settings, Database, Zap
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useSummary, useSuites, usePlans, useReleases } from '@/hooks/useTestData';
import { useTestDataStore } from '@/stores/testDataStore';
import TestCasePanel from '@/components/enterprise/TestCasePanel';

// ============================================================================
// TAB DEFINITIONS
// ============================================================================

type TabId = 'repository' | 'suites' | 'plans' | 'releases' | 'runs';

interface TabDef {
  id: TabId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
}

const TABS: TabDef[] = [
  { id: 'repository', label: 'Test Cases', icon: FolderTree, description: 'All test cases' },
  { id: 'suites', label: 'Suites', icon: Layers, description: 'Group related tests' },
  { id: 'plans', label: 'Plans', icon: Target, description: 'Execution plans' },
  { id: 'releases', label: 'Releases', icon: Rocket, description: 'Sprint/version' },
  { id: 'runs', label: 'Runs', icon: PlayCircle, description: 'Execution history' },
];

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function EnterpriseTestRepository() {
  const navigate = useNavigate();
  
  // Global state
  const activeTab = useTestDataStore((state) => state.activeTab);
  const setActiveTab = useTestDataStore((state) => state.setActiveTab);
  
  // Fetch summary for tab counts
  const { data: summary } = useSummary();
  const { data: suitesData } = useSuites({ page: 1, limit: 1 });
  const { data: plansData } = usePlans({ page: 1, limit: 1 });
  const { data: releasesData } = useReleases({ page: 1, limit: 1 });
  
  // Tab counts
  const tabCounts: Record<TabId, number> = {
    repository: summary?.testCases || 0,
    suites: suitesData?.total || summary?.suites || 0,
    plans: plansData?.total || summary?.plans || 0,
    releases: releasesData?.total || summary?.releases || 0,
    runs: 0,
  };
  
  // Handlers
  const handleOpenTestCase = useCallback((testCase: any) => {
    navigate(`/builder?testId=${testCase.id}`);
  }, [navigate]);
  
  const handleSelectTestCase = useCallback((testCase: any) => {
    // Selection handled by store
  }, []);
  
  const handleCreateTestCase = useCallback(() => {
    navigate('/builder');
    toast.success('Creating new test case');
  }, [navigate]);
  
  return (
    <div className="h-full flex flex-col bg-gray-950 text-white overflow-hidden">
      {/* Header */}
      <header className="flex-none border-b border-gray-800">
        <div className="px-4 py-3 flex items-center justify-between">
          {/* Title */}
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gradient-to-br from-amber-500 to-orange-500">
              <FolderTree className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-semibold flex items-center gap-2">
                Test Management
                <span className="flex items-center gap-1 text-xs font-normal text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                  <Zap className="w-3 h-3" />
                  Enterprise
                </span>
              </h1>
              <p className="text-xs text-gray-500">
                {(summary?.testCases || 0).toLocaleString()} tests • {(summary?.suites || 0)} suites • {(summary?.releases || 0)} releases
              </p>
            </div>
          </div>
          
          {/* Actions */}
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={handleCreateTestCase}
              className="bg-amber-500 hover:bg-amber-400 text-black"
            >
              <Plus className="w-4 h-4 mr-2" />
              New Test
            </Button>
          </div>
        </div>
        
        {/* Tabs */}
        <div className="px-4 flex items-center gap-1 border-t border-gray-800/50 overflow-x-auto">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const count = tabCounts[tab.id];
            
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors",
                  activeTab === tab.id
                    ? "border-amber-500 text-amber-400"
                    : "border-transparent text-gray-400 hover:text-white"
                )}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
                <span className={cn(
                  "text-xs px-1.5 py-0.5 rounded",
                  activeTab === tab.id 
                    ? "bg-amber-500/20 text-amber-400" 
                    : "bg-gray-800 text-gray-500"
                )}>
                  {count.toLocaleString()}
                </span>
              </button>
            );
          })}
        </div>
      </header>
      
      {/* Tab Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'repository' && (
          <TestCasePanel
            onSelectTestCase={handleSelectTestCase}
            onOpenTestCase={handleOpenTestCase}
            onCreateTestCase={handleCreateTestCase}
          />
        )}
        
        {activeTab === 'suites' && (
          <SuitesTab />
        )}
        
        {activeTab === 'plans' && (
          <PlansTab />
        )}
        
        {activeTab === 'releases' && (
          <ReleasesTab />
        )}
        
        {activeTab === 'runs' && (
          <RunsTab />
        )}
      </div>
    </div>
  );
}

// ============================================================================
// PLACEHOLDER TABS (To be expanded)
// ============================================================================

const SuitesTab: React.FC = () => {
  const { data, isLoading } = useSuites({ page: 1, limit: 50 });
  
  return (
    <div className="p-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold">Test Suites</h2>
          <span className="text-sm text-gray-500">
            {data?.total || 0} suites
          </span>
        </div>
        
        {isLoading ? (
          <div className="text-gray-500">Loading suites...</div>
        ) : (
          <div className="grid gap-4">
            {data?.suites?.slice(0, 20).map((suite: any) => (
              <div 
                key={suite.id}
                className="p-4 rounded-lg border border-gray-800 bg-gray-900/50 hover:bg-gray-900 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium text-white">{suite.name}</h3>
                    <p className="text-sm text-gray-500">
                      {suite.testCaseIds?.length || 0} test cases
                    </p>
                  </div>
                  <Layers className="w-5 h-5 text-gray-600" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const PlansTab: React.FC = () => {
  const { data, isLoading } = usePlans({ page: 1, limit: 50 });
  
  return (
    <div className="p-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold">Test Plans</h2>
          <span className="text-sm text-gray-500">
            {data?.total || 0} plans
          </span>
        </div>
        
        {isLoading ? (
          <div className="text-gray-500">Loading plans...</div>
        ) : (
          <div className="grid gap-4">
            {data?.plans?.slice(0, 20).map((plan: any) => (
              <div 
                key={plan.id}
                className="p-4 rounded-lg border border-gray-800 bg-gray-900/50 hover:bg-gray-900 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium text-white">{plan.name}</h3>
                    <p className="text-sm text-gray-500">
                      {plan.status} • {plan.testCaseIds?.length || 0} tests
                    </p>
                  </div>
                  <Target className="w-5 h-5 text-gray-600" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const ReleasesTab: React.FC = () => {
  const { data, isLoading } = useReleases({ page: 1, limit: 50 });
  
  return (
    <div className="p-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold">Releases</h2>
          <span className="text-sm text-gray-500">
            {data?.total || 0} releases
          </span>
        </div>
        
        {isLoading ? (
          <div className="text-gray-500">Loading releases...</div>
        ) : (
          <div className="grid gap-4">
            {data?.releases?.slice(0, 20).map((release: any) => (
              <div 
                key={release.id}
                className="p-4 rounded-lg border border-gray-800 bg-gray-900/50 hover:bg-gray-900 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium text-white">{release.name}</h3>
                    <p className="text-sm text-gray-500">
                      {release.version} • {release.status}
                    </p>
                  </div>
                  <Rocket className="w-5 h-5 text-gray-600" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const RunsTab: React.FC = () => {
  return (
    <div className="p-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold">Test Runs</h2>
        </div>
        <div className="text-center py-12 text-gray-500">
          <PlayCircle className="w-12 h-12 mx-auto mb-4 text-gray-600" />
          <p>No test runs yet</p>
          <p className="text-sm mt-1">Execute a test suite to see runs here</p>
        </div>
      </div>
    </div>
  );
};

