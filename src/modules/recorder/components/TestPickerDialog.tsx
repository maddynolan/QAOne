/**
 * Test Picker Dialog
 * Enterprise-scale dialog for selecting an existing test case to automate.
 * Supports search, filters (status, folder, tag), and pagination.
 *
 * Extracted from PlaywrightRecorderPage.tsx (lines 7895-8122).
 */

import React from 'react';
import {
  Search, Folder, Tag, X, FileText, ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { TESTS_PER_PAGE } from '@/modules/recorder/constants/recorderConstants';

export interface TestPickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  allTestCases: any[];
  filteredTestCases: any[];
  paginatedTestCases: any[];
  testSearchQuery: string;
  setTestSearchQuery: (v: string) => void;
  testStatusFilter: string;
  setTestStatusFilter: (v: string) => void;
  testFolderFilter: string;
  setTestFolderFilter: (v: string) => void;
  testTagFilter: string;
  setTestTagFilter: (v: string) => void;
  allFolders: { id: string; name: string }[];
  allTags: string[];
  testPage: number;
  setTestPage: React.Dispatch<React.SetStateAction<number>>;
  totalTestPages: number;
  onSelectTestCase: (tc: any) => void;
}

export default function TestPickerDialog({
  open,
  onOpenChange,
  allTestCases,
  filteredTestCases,
  paginatedTestCases,
  testSearchQuery,
  setTestSearchQuery,
  testStatusFilter,
  setTestStatusFilter,
  testFolderFilter,
  setTestFolderFilter,
  testTagFilter,
  setTestTagFilter,
  allFolders,
  allTags,
  testPage,
  setTestPage,
  totalTestPages,
  onSelectTestCase,
}: TestPickerDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[85vh] bg-card border-border flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle className="text-foreground flex items-center justify-between">
            <span>Select Test Case to Automate</span>
            <Badge className="bg-purple-500/20 text-purple-700 dark:text-purple-400 border-purple-500/30">
              {filteredTestCases.length} of {allTestCases.length} tests
            </Badge>
          </DialogTitle>
        </DialogHeader>

        {/* Search & Filters */}
        <div className="space-y-3 pb-3 border-b border-border">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={testSearchQuery}
              onChange={(e) => setTestSearchQuery(e.target.value)}
              placeholder="Search by name, ID, description, or tags..."
              className="pl-10 bg-secondary border-border text-foreground"
            />
          </div>

          <div className="flex gap-2 flex-wrap">
            <Select value={testStatusFilter} onValueChange={(v: any) => setTestStatusFilter(v)}>
              <SelectTrigger className="w-[140px] h-8 bg-secondary border-border text-xs">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent className="bg-secondary border-border">
                <SelectItem value="all" className="text-xs">All Status</SelectItem>
                <SelectItem value="none" className="text-xs">
                  <span className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-muted-foreground" />
                    Manual Only
                  </span>
                </SelectItem>
                <SelectItem value="partial" className="text-xs">
                  <span className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-amber-500" />
                    Partial
                  </span>
                </SelectItem>
                <SelectItem value="full" className="text-xs">
                  <span className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    Automated
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>

            <Select value={testFolderFilter} onValueChange={setTestFolderFilter}>
              <SelectTrigger className="w-[160px] h-8 bg-secondary border-border text-xs">
                <Folder className="h-3 w-3 mr-1" />
                <SelectValue placeholder="Folder" />
              </SelectTrigger>
              <SelectContent className="bg-secondary border-border">
                <SelectItem value="all" className="text-xs">All Folders</SelectItem>
                <SelectItem value="orphan" className="text-xs text-primary">Orphaned (No Folder)</SelectItem>
                {allFolders.map(f => (
                  <SelectItem key={f.id} value={f.id} className="text-xs">{f.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {allTags.length > 0 && (
              <Select value={testTagFilter} onValueChange={setTestTagFilter}>
                <SelectTrigger className="w-[140px] h-8 bg-secondary border-border text-xs">
                  <Tag className="h-3 w-3 mr-1" />
                  <SelectValue placeholder="Tag" />
                </SelectTrigger>
                <SelectContent className="bg-secondary border-border">
                  <SelectItem value="all" className="text-xs">All Tags</SelectItem>
                  {allTags.map(tag => (
                    <SelectItem key={tag} value={tag} className="text-xs">{tag}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {(testSearchQuery || testStatusFilter !== 'all' || testFolderFilter !== 'all' || testTagFilter !== 'all') && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setTestSearchQuery('');
                  setTestStatusFilter('all');
                  setTestFolderFilter('all');
                  setTestTagFilter('all');
                }}
                className="h-8 text-xs text-muted-foreground hover:text-foreground"
              >
                <X className="h-3 w-3 mr-1" />
                Clear
              </Button>
            )}
          </div>
        </div>

        {/* Test Cases List */}
        <div className="flex-1 min-h-0 overflow-hidden">
          <ScrollArea className="h-full">
            {paginatedTestCases.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <FileText className="h-10 w-10 mx-auto mb-3 opacity-50" />
                <p className="text-sm">
                  {allTestCases.length === 0 ? 'No test cases found' : 'No tests match your filters'}
                </p>
                {testSearchQuery && (
                  <p className="text-xs mt-1">Try adjusting your search or filters</p>
                )}
              </div>
            ) : (
              <div className="space-y-2 pr-4">
                {paginatedTestCases.map(tc => {
                  const status = tc.automationStatus ||
                    (tc.steps?.some((s: any) => s.qword || s.selector) ?
                      (tc.steps.every((s: any) => s.qword || s.selector) ? 'full' : 'partial') : 'none');
                  const automatedCount = tc.steps?.filter((s: any) => s.qword || s.selector).length || 0;

                  return (
                    <div
                      key={tc.id}
                      onClick={() => onSelectTestCase(tc)}
                      className="p-3 rounded-lg border border-border hover:border-purple-500/50 cursor-pointer transition-colors group"
                    >
                      <div className="flex items-start gap-3">
                        <div className={cn(
                          "w-2 h-2 rounded-full mt-1.5 shrink-0",
                          status === 'full' && "bg-emerald-500",
                          status === 'partial' && "bg-amber-500",
                          status === 'none' && "bg-muted-foreground"
                        )} />

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm text-foreground truncate">{tc.name || tc.title}</span>
                            {status === 'full' && (
                              <Badge className="bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-[10px] px-1.5">Automated</Badge>
                            )}
                            {status === 'partial' && (
                              <Badge className="bg-amber-500/20 text-primary text-[10px] px-1.5">Partial</Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                            <span>{tc.steps?.length || 0} steps</span>
                            {status !== 'none' && (
                              <span className="text-emerald-700/70 dark:text-emerald-400/70">{automatedCount} automated</span>
                            )}
                            {tc.folderId && allFolders.find(f => f.id === tc.folderId) && (
                              <span className="flex items-center gap-1">
                                <Folder className="h-3 w-3" />
                                {allFolders.find(f => f.id === tc.folderId)?.name}
                              </span>
                            )}
                          </div>
                          {tc.tags && tc.tags.length > 0 && (
                            <div className="flex gap-1 mt-1.5">
                              {tc.tags.slice(0, 3).map((tag: string) => (
                                <Badge key={tag} variant="outline" className="text-[10px] px-1.5 py-0 border-white/20 text-muted-foreground">
                                  {tag}
                                </Badge>
                              ))}
                              {tc.tags.length > 3 && (
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-white/20 text-muted-foreground">
                                  +{tc.tags.length - 3}
                                </Badge>
                              )}
                            </div>
                          )}
                        </div>

                        <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-purple-400 shrink-0" />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </div>

        {/* Pagination */}
        {totalTestPages > 1 && (
          <div className="flex items-center justify-between pt-3 border-t border-border">
            <span className="text-xs text-muted-foreground">
              Page {testPage} of {totalTestPages} -- Showing {((testPage - 1) * TESTS_PER_PAGE) + 1}-{Math.min(testPage * TESTS_PER_PAGE, filteredTestCases.length)} of {filteredTestCases.length}
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setTestPage(p => Math.max(1, p - 1))}
                disabled={testPage === 1}
                className="h-7 text-xs border-white/20"
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setTestPage(p => Math.min(totalTestPages, p + 1))}
                disabled={testPage === totalTestPages}
                className="h-7 text-xs border-white/20"
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
