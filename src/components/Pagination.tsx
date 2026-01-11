/**
 * Pagination Component
 * ====================
 * Enterprise-grade pagination with page size selector.
 */

import React from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { Button } from './ui/button';
import { cn } from '../lib/utils';

interface PaginationProps {
  page: number;
  totalPages: number;
  total: number;
  limit: number;
  hasNext: boolean;
  hasPrev: boolean;
  onPageChange: (page: number) => void;
  onLimitChange?: (limit: number) => void;
  showPageSize?: boolean;
  className?: string;
}

export const Pagination: React.FC<PaginationProps> = ({
  page,
  totalPages,
  total,
  limit,
  hasNext,
  hasPrev,
  onPageChange,
  onLimitChange,
  showPageSize = true,
  className,
}) => {
  // Calculate showing range
  const start = total === 0 ? 0 : (page - 1) * limit + 1;
  const end = Math.min(page * limit, total);
  
  // Generate page numbers to show
  const getPageNumbers = () => {
    const pages: (number | 'ellipsis')[] = [];
    const showPages = 5;
    
    if (totalPages <= showPages + 2) {
      // Show all pages
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      // Always show first page
      pages.push(1);
      
      // Calculate range around current page
      let rangeStart = Math.max(2, page - Math.floor(showPages / 2));
      let rangeEnd = Math.min(totalPages - 1, rangeStart + showPages - 1);
      
      // Adjust if at the end
      if (rangeEnd === totalPages - 1) {
        rangeStart = Math.max(2, rangeEnd - showPages + 1);
      }
      
      // Add ellipsis before range if needed
      if (rangeStart > 2) {
        pages.push('ellipsis');
      }
      
      // Add range
      for (let i = rangeStart; i <= rangeEnd; i++) {
        pages.push(i);
      }
      
      // Add ellipsis after range if needed
      if (rangeEnd < totalPages - 1) {
        pages.push('ellipsis');
      }
      
      // Always show last page
      if (totalPages > 1) {
        pages.push(totalPages);
      }
    }
    
    return pages;
  };
  
  const pageNumbers = getPageNumbers();
  
  return (
    <div className={cn(
      'flex items-center justify-between px-4 py-3 border-t border-gray-800 bg-gray-900/50',
      className
    )}>
      {/* Info */}
      <div className="flex items-center gap-4">
        <span className="text-sm text-gray-400">
          Showing <span className="font-medium text-white">{start.toLocaleString()}</span> to{' '}
          <span className="font-medium text-white">{end.toLocaleString()}</span> of{' '}
          <span className="font-medium text-white">{total.toLocaleString()}</span> results
        </span>
        
        {/* Page size selector */}
        {showPageSize && onLimitChange && (
          <select
            value={limit}
            onChange={(e) => onLimitChange(Number(e.target.value))}
            className="h-8 px-2 text-sm bg-gray-800 border border-gray-700 rounded text-white focus:outline-none focus:ring-2 focus:ring-amber-500/50"
          >
            <option value={25}>25 / page</option>
            <option value={50}>50 / page</option>
            <option value={100}>100 / page</option>
            <option value={200}>200 / page</option>
          </select>
        )}
      </div>
      
      {/* Navigation */}
      <div className="flex items-center gap-1">
        {/* First page */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onPageChange(1)}
          disabled={!hasPrev}
          className="h-8 w-8 p-0 text-gray-400 hover:text-white disabled:opacity-30"
          title="First page"
        >
          <ChevronsLeft className="w-4 h-4" />
        </Button>
        
        {/* Previous */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onPageChange(page - 1)}
          disabled={!hasPrev}
          className="h-8 w-8 p-0 text-gray-400 hover:text-white disabled:opacity-30"
          title="Previous page"
        >
          <ChevronLeft className="w-4 h-4" />
        </Button>
        
        {/* Page numbers */}
        <div className="flex items-center gap-1 mx-2">
          {pageNumbers.map((pageNum, idx) => {
            if (pageNum === 'ellipsis') {
              return (
                <span key={`ellipsis-${idx}`} className="w-8 text-center text-gray-500">
                  ...
                </span>
              );
            }
            
            return (
              <Button
                key={pageNum}
                variant={pageNum === page ? 'default' : 'ghost'}
                size="sm"
                onClick={() => onPageChange(pageNum)}
                className={cn(
                  'h-8 w-8 p-0',
                  pageNum === page
                    ? 'bg-amber-500 text-black hover:bg-amber-400'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800'
                )}
              >
                {pageNum}
              </Button>
            );
          })}
        </div>
        
        {/* Next */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onPageChange(page + 1)}
          disabled={!hasNext}
          className="h-8 w-8 p-0 text-gray-400 hover:text-white disabled:opacity-30"
          title="Next page"
        >
          <ChevronRight className="w-4 h-4" />
        </Button>
        
        {/* Last page */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onPageChange(totalPages)}
          disabled={!hasNext}
          className="h-8 w-8 p-0 text-gray-400 hover:text-white disabled:opacity-30"
          title="Last page"
        >
          <ChevronsRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
};

export default Pagination;




