/**
 * Virtual Test Case List
 * ======================
 * High-performance list rendering using virtual scrolling.
 * Only renders visible rows, perfect for 100K+ test cases.
 * 
 * Features:
 * - Virtual scrolling (only renders ~20 visible rows)
 * - Hover prefetch (preloads test case on hover)
 * - Keyboard navigation
 * - Selection support
 * - Loading states
 */

import React, { useCallback, useRef, useMemo } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { 
  FileText, 
  ChevronRight, 
  Bot, 
  AlertCircle,
  Clock,
  Tag,
  Folder
} from 'lucide-react';
import { cn } from '../lib/utils';
import { TestCaseListItem, usePrefetchTestCase } from '../hooks/useTestData';

// ============================================================================
// TYPES
// ============================================================================

interface VirtualTestCaseListProps {
  testCases: TestCaseListItem[];
  selectedId?: string | null;
  onSelect?: (testCase: TestCaseListItem) => void;
  onOpen?: (testCase: TestCaseListItem) => void;
  isLoading?: boolean;
  emptyMessage?: string;
  className?: string;
}

// ============================================================================
// PRIORITY BADGE
// ============================================================================

const PriorityBadge: React.FC<{ priority: string }> = ({ priority }) => {
  const colors: Record<string, string> = {
    critical: 'bg-red-500/20 text-red-400 border-red-500/30',
    high: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
    medium: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    low: 'bg-green-500/20 text-green-400 border-green-500/30',
  };
  
  return (
    <span className={cn(
      'px-2 py-0.5 text-xs font-medium rounded border capitalize',
      colors[priority.toLowerCase()] || colors.medium
    )}>
      {priority}
    </span>
  );
};

// ============================================================================
// AUTOMATION BADGE
// ============================================================================

const AutomationBadge: React.FC<{ status: string }> = ({ status }) => {
  if (status === 'full') {
    return (
      <span className="flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
        <Bot className="w-3 h-3" />
        Automated
      </span>
    );
  }
  
  if (status === 'partial') {
    return (
      <span className="flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">
        <Bot className="w-3 h-3" />
        Partial
      </span>
    );
  }
  
  return (
    <span className="flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded bg-gray-500/20 text-gray-400 border border-gray-500/30">
      <FileText className="w-3 h-3" />
      Manual
    </span>
  );
};

// ============================================================================
// TEST CASE ROW
// ============================================================================

interface TestCaseRowProps {
  testCase: TestCaseListItem;
  isSelected: boolean;
  onSelect: () => void;
  onOpen: () => void;
  onHover: () => void;
  style: React.CSSProperties;
}

const TestCaseRow: React.FC<TestCaseRowProps> = React.memo(({
  testCase,
  isSelected,
  onSelect,
  onOpen,
  onHover,
  style,
}) => {
  return (
    <div
      style={style}
      className={cn(
        'absolute top-0 left-0 w-full px-4 py-3 border-b border-gray-800/50',
        'flex items-center gap-4 cursor-pointer transition-colors',
        'hover:bg-gray-800/50',
        isSelected && 'bg-amber-500/10 border-l-2 border-l-amber-500'
      )}
      onClick={onSelect}
      onDoubleClick={onOpen}
      onMouseEnter={onHover}
    >
      {/* Icon */}
      <div className={cn(
        'flex-none w-9 h-9 rounded-lg flex items-center justify-center',
        testCase.automation_status === 'full' 
          ? 'bg-emerald-500/20 text-emerald-400'
          : testCase.automation_status === 'partial'
          ? 'bg-amber-500/20 text-amber-400'
          : 'bg-gray-700/50 text-gray-400'
      )}>
        {testCase.automation_status === 'full' ? (
          <Bot className="w-4 h-4" />
        ) : (
          <FileText className="w-4 h-4" />
        )}
      </div>
      
      {/* Main content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h4 className="font-medium text-white truncate">
            {testCase.name}
          </h4>
        </div>
        
        {testCase.description && (
          <p className="text-xs text-gray-500 truncate mt-0.5">
            {testCase.description}
          </p>
        )}
        
        {/* Tags */}
        {testCase.tags && testCase.tags.length > 0 && (
          <div className="flex items-center gap-1 mt-1">
            <Tag className="w-3 h-3 text-gray-500" />
            {testCase.tags.slice(0, 3).map((tag, i) => (
              <span key={i} className="text-xs text-gray-500 bg-gray-800 px-1.5 py-0.5 rounded">
                {tag}
              </span>
            ))}
            {testCase.tags.length > 3 && (
              <span className="text-xs text-gray-600">+{testCase.tags.length - 3}</span>
            )}
          </div>
        )}
      </div>
      
      {/* Folder */}
      {testCase.folder_name && (
        <div className="hidden md:flex items-center gap-1 text-xs text-gray-500">
          <Folder className="w-3 h-3" />
          <span className="truncate max-w-[120px]">{testCase.folder_name}</span>
        </div>
      )}
      
      {/* Priority */}
      <div className="hidden sm:block flex-none">
        <PriorityBadge priority={testCase.priority} />
      </div>
      
      {/* Automation status */}
      <div className="hidden lg:block flex-none">
        <AutomationBadge status={testCase.automation_status} />
      </div>
      
      {/* Updated time */}
      {testCase.updated_at && (
        <div className="hidden xl:flex items-center gap-1 text-xs text-gray-500 flex-none">
          <Clock className="w-3 h-3" />
          {new Date(testCase.updated_at).toLocaleDateString()}
        </div>
      )}
      
      {/* Arrow */}
      <ChevronRight className="w-4 h-4 text-gray-600 flex-none" />
    </div>
  );
});

TestCaseRow.displayName = 'TestCaseRow';

// ============================================================================
// SKELETON ROW
// ============================================================================

const SkeletonRow: React.FC<{ style: React.CSSProperties }> = ({ style }) => (
  <div
    style={style}
    className="absolute top-0 left-0 w-full px-4 py-3 border-b border-gray-800/50 flex items-center gap-4"
  >
    <div className="w-9 h-9 rounded-lg bg-gray-800 animate-pulse" />
    <div className="flex-1 space-y-2">
      <div className="h-4 bg-gray-800 rounded w-1/3 animate-pulse" />
      <div className="h-3 bg-gray-800/50 rounded w-2/3 animate-pulse" />
    </div>
    <div className="w-16 h-5 bg-gray-800 rounded animate-pulse" />
    <div className="w-20 h-5 bg-gray-800 rounded animate-pulse" />
  </div>
);

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const VirtualTestCaseList: React.FC<VirtualTestCaseListProps> = ({
  testCases,
  selectedId,
  onSelect,
  onOpen,
  isLoading = false,
  emptyMessage = 'No test cases found',
  className,
}) => {
  const parentRef = useRef<HTMLDivElement>(null);
  const prefetchTestCase = usePrefetchTestCase();
  
  // Row height constant
  const ROW_HEIGHT = 72;
  
  // Virtual list configuration
  const rowVirtualizer = useVirtualizer({
    count: isLoading ? 10 : testCases.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 5, // Render 5 extra rows above/below for smoother scrolling
  });
  
  // Callbacks
  const handleSelect = useCallback((tc: TestCaseListItem) => {
    onSelect?.(tc);
  }, [onSelect]);
  
  const handleOpen = useCallback((tc: TestCaseListItem) => {
    onOpen?.(tc);
  }, [onOpen]);
  
  const handleHover = useCallback((tc: TestCaseListItem) => {
    // Prefetch test case details on hover
    prefetchTestCase(tc.id);
  }, [prefetchTestCase]);
  
  // Empty state
  if (!isLoading && testCases.length === 0) {
    return (
      <div className={cn('flex flex-col items-center justify-center h-64 text-gray-500', className)}>
        <AlertCircle className="w-12 h-12 mb-4 text-gray-600" />
        <p className="text-lg font-medium">{emptyMessage}</p>
        <p className="text-sm mt-1">Try adjusting your filters or search query</p>
      </div>
    );
  }
  
  return (
    <div
      ref={parentRef}
      className={cn('h-full overflow-auto', className)}
    >
      <div
        style={{
          height: `${rowVirtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {rowVirtualizer.getVirtualItems().map((virtualRow) => {
          if (isLoading) {
            return (
              <SkeletonRow
                key={virtualRow.key}
                style={{
                  height: `${virtualRow.size}px`,
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              />
            );
          }
          
          const testCase = testCases[virtualRow.index];
          if (!testCase) return null;
          
          return (
            <TestCaseRow
              key={testCase.id}
              testCase={testCase}
              isSelected={selectedId === testCase.id}
              onSelect={() => handleSelect(testCase)}
              onOpen={() => handleOpen(testCase)}
              onHover={() => handleHover(testCase)}
              style={{
                height: `${virtualRow.size}px`,
                transform: `translateY(${virtualRow.start}px)`,
              }}
            />
          );
        })}
      </div>
    </div>
  );
};

export default VirtualTestCaseList;

