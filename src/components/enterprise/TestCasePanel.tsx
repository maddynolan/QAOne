/**
 * Enterprise Test Case Panel
 * ==========================
 * Drop-in replacement for test case list with:
 * - Server-side pagination
 * - Virtual scrolling (only renders visible rows)
 * - Automatic caching
 * - Preserves state across navigation
 * 
 * Usage:
 *   <TestCasePanel 
 *     onSelectTestCase={(tc) => navigate(`/builder/${tc.id}`)}
 *     onOpenTestCase={(tc) => navigate(`/builder/${tc.id}`)}
 *   />
 */

import React, { useState, useCallback, useEffect } from 'react';
import { 
  Search, Filter, RefreshCw, ChevronDown, Plus, Grid, List,
  Bot, FileText, Loader2, Database, Wifi, WifiOff
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useTestCases, useSummary, TestCaseListItem } from '@/hooks/useTestData';
import { useTestDataStore } from '@/stores/testDataStore';
import { VirtualTestCaseList } from '../VirtualTestCaseList';
import { Pagination } from '../Pagination';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

// ============================================================================
// TYPES
// ============================================================================

interface TestCasePanelProps {
  onSelectTestCase?: (testCase: TestCaseListItem) => void;
  onOpenTestCase?: (testCase: TestCaseListItem) => void;
  onCreateTestCase?: () => void;
  className?: string;
}

// ============================================================================
// FILTER BAR
// ============================================================================

interface FilterBarProps {
  search: string;
  onSearchChange: (search: string) => void;
  priority: string | null;
  onPriorityChange: (priority: string | null) => void;
  automationStatus: string | null;
  onAutomationStatusChange: (status: string | null) => void;
  onReset: () => void;
}

const FilterBar: React.FC<FilterBarProps> = ({
  search,
  onSearchChange,
  priority,
  onPriorityChange,
  automationStatus,
  onAutomationStatusChange,
  onReset,
}) => {
  const hasFilters = search || priority || automationStatus;
  
  return (
    <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-200 dark:border-gray-800">
      {/* Search */}
      <div className="relative flex-1 max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500" />
        <Input
          placeholder="Search test cases..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9 bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white h-9"
        />
      </div>
      
      {/* Priority Filter */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button 
            variant="outline" 
            size="sm"
            className={cn(
              "border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 h-9",
              priority && "border-blue-500 dark:border-amber-500/50 text-blue-600 dark:text-amber-400"
            )}
          >
            <Filter className="w-4 h-4 mr-2" />
            {priority ? `Priority: ${priority}` : 'Priority'}
            <ChevronDown className="w-4 h-4 ml-2" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700">
          <DropdownMenuItem onClick={() => onPriorityChange(null)} className="text-gray-700 dark:text-gray-300">
            All Priorities
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onPriorityChange('critical')} className="text-red-600 dark:text-red-400">
            Critical
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onPriorityChange('high')} className="text-orange-600 dark:text-orange-400">
            High
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onPriorityChange('medium')} className="text-yellow-600 dark:text-yellow-400">
            Medium
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onPriorityChange('low')} className="text-green-600 dark:text-green-400">
            Low
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      
      {/* Automation Status Filter */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button 
            variant="outline" 
            size="sm"
            className={cn(
              "border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 h-9",
              automationStatus && "border-blue-500 dark:border-amber-500/50 text-blue-600 dark:text-amber-400"
            )}
          >
            <Bot className="w-4 h-4 mr-2" />
            {automationStatus === 'full' ? 'Automated' : 
             automationStatus === 'partial' ? 'Partial' :
             automationStatus === 'none' ? 'Manual' : 'Status'}
            <ChevronDown className="w-4 h-4 ml-2" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700">
          <DropdownMenuItem onClick={() => onAutomationStatusChange(null)} className="text-gray-700 dark:text-gray-300">
            All Statuses
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onAutomationStatusChange('full')} className="text-emerald-600 dark:text-emerald-400">
            <Bot className="w-4 h-4 mr-2" />
            Automated
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onAutomationStatusChange('partial')} className="text-amber-600 dark:text-amber-400">
            <Bot className="w-4 h-4 mr-2" />
            Partial
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onAutomationStatusChange('none')} className="text-gray-600 dark:text-gray-400">
            <FileText className="w-4 h-4 mr-2" />
            Manual
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      
      {/* Reset Filters */}
      {hasFilters && (
        <Button 
          variant="ghost" 
          size="sm"
          onClick={onReset}
          className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white h-9"
        >
          Clear filters
        </Button>
      )}
    </div>
  );
};

// ============================================================================
// STATS BAR
// ============================================================================

interface StatsBarProps {
  total: number;
  automated: number;
  manual: number;
  isConnected: boolean;
  isLoading: boolean;
  onRefresh: () => void;
}

const StatsBar: React.FC<StatsBarProps> = ({
  total,
  automated,
  manual,
  isConnected,
  isLoading,
  onRefresh,
}) => {
  return (
    <div className="flex items-center justify-between px-4 py-2 bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-800">
      {/* Stats */}
      <div className="flex items-center gap-4 text-sm">
        <div className="flex items-center gap-2">
          <Database className="w-4 h-4 text-blue-600 dark:text-amber-500" />
          <span className="text-gray-900 dark:text-white font-medium">{total.toLocaleString()}</span>
          <span className="text-gray-600 dark:text-gray-400">test cases</span>
        </div>
        <div className="h-4 w-px bg-gray-300 dark:bg-gray-700" />
        <div className="flex items-center gap-1.5">
          <Bot className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
          <span className="text-emerald-600 dark:text-emerald-400">{automated.toLocaleString()}</span>
          <span className="text-gray-600 dark:text-gray-500">automated</span>
        </div>
        <div className="flex items-center gap-1.5">
          <FileText className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400" />
          <span className="text-gray-500 dark:text-gray-400">{manual.toLocaleString()}</span>
          <span className="text-gray-600 dark:text-gray-500">manual</span>
        </div>
      </div>
      
      {/* Connection status & Refresh */}
      <div className="flex items-center gap-2">
        <span className={cn(
          "flex items-center gap-1.5 text-xs px-2 py-1 rounded",
          isConnected 
            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400" 
            : "bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400"
        )}>
          {isConnected ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
          {isConnected ? 'Connected' : 'Offline'}
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={onRefresh}
          disabled={isLoading}
          className="h-7 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
        >
          <RefreshCw className={cn("w-3.5 h-3.5", isLoading && "animate-spin")} />
        </Button>
      </div>
    </div>
  );
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const TestCasePanel: React.FC<TestCasePanelProps> = ({
  onSelectTestCase,
  onOpenTestCase,
  onCreateTestCase,
  className,
}) => {
  // Store state
  const filters = useTestDataStore((state) => state.filters);
  const pagination = useTestDataStore((state) => state.pagination);
  const selectedTestCaseId = useTestDataStore((state) => state.selectedTestCaseId);
  const setSearch = useTestDataStore((state) => state.setSearch);
  const setPriority = useTestDataStore((state) => state.setPriority);
  const setAutomationStatus = useTestDataStore((state) => state.setAutomationStatus);
  const setPage = useTestDataStore((state) => state.setPage);
  const setLimit = useTestDataStore((state) => state.setLimit);
  const resetFilters = useTestDataStore((state) => state.resetFilters);
  const selectTestCase = useTestDataStore((state) => state.selectTestCase);
  
  // Local search state for debouncing
  const [localSearch, setLocalSearch] = useState(filters.search);
  
  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (localSearch !== filters.search) {
        setSearch(localSearch);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [localSearch, filters.search, setSearch]);
  
  // Fetch data
  const { data: summaryData, isError: summaryError } = useSummary();
  const { 
    data: testCasesData, 
    isLoading, 
    isError,
    refetch 
  } = useTestCases({
    page: pagination.page,
    limit: pagination.limit,
    search: filters.search || undefined,
    priority: filters.priority || undefined,
    status: filters.automationStatus || undefined,
    sortBy: filters.sortBy,
    sortOrder: filters.sortOrder,
  });
  
  const testCases = testCasesData?.testCases || [];
  const total = testCasesData?.total || 0;
  const totalPages = testCasesData?.totalPages || 0;
  const hasNext = testCasesData?.hasNext || false;
  const hasPrev = testCasesData?.hasPrev || false;
  
  // Handlers
  const handleSelect = useCallback((tc: TestCaseListItem) => {
    selectTestCase(tc.id);
    onSelectTestCase?.(tc);
  }, [selectTestCase, onSelectTestCase]);
  
  const handleOpen = useCallback((tc: TestCaseListItem) => {
    onOpenTestCase?.(tc);
  }, [onOpenTestCase]);
  
  const handleRefresh = useCallback(() => {
    refetch();
  }, [refetch]);
  
  return (
    <div className={cn("flex flex-col h-full bg-white dark:bg-gray-950", className)}>
      {/* Stats Bar */}
      <StatsBar
        total={summaryData?.testCases || 0}
        automated={summaryData?.automated || 0}
        manual={summaryData?.manual || 0}
        isConnected={!summaryError}
        isLoading={isLoading}
        onRefresh={handleRefresh}
      />
      
      {/* Filter Bar */}
      <FilterBar
        search={localSearch}
        onSearchChange={setLocalSearch}
        priority={filters.priority}
        onPriorityChange={setPriority}
        automationStatus={filters.automationStatus}
        onAutomationStatusChange={setAutomationStatus}
        onReset={resetFilters}
      />
      
      {/* Test Case List */}
      <div className="flex-1 overflow-hidden">
        {isError ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-600 dark:text-gray-400">
            <WifiOff className="w-12 h-12 mb-4 text-red-500 dark:text-red-400" />
            <p className="text-lg font-medium text-red-600 dark:text-red-400">Connection Error</p>
            <p className="text-sm mt-1">Could not connect to the backend API</p>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleRefresh}
              className="mt-4 border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Retry
            </Button>
          </div>
        ) : (
          <VirtualTestCaseList
            testCases={testCases}
            selectedId={selectedTestCaseId}
            onSelect={handleSelect}
            onOpen={handleOpen}
            isLoading={isLoading}
            emptyMessage={filters.search ? 'No test cases match your search' : 'No test cases found'}
          />
        )}
      </div>
      
      {/* Pagination */}
      {!isError && testCases.length > 0 && (
        <Pagination
          page={pagination.page}
          totalPages={totalPages}
          total={total}
          limit={pagination.limit}
          hasNext={hasNext}
          hasPrev={hasPrev}
          onPageChange={setPage}
          onLimitChange={setLimit}
        />
      )}
    </div>
  );
};

export default TestCasePanel;

