/**
 * SuitesTabPanel - Renders the Suites tab content in Test Repository.
 * Shows suite cards with test count, schedule, last run, and actions.
 */
import React from 'react';
import {
  Layers, Clock, Play, Edit, Copy, Trash2, MoreVertical, Plus,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import type { TestSuite } from '../types/test-repository.types';

interface SuitesTabPanelProps {
  suites: TestSuite[];
  searchTerm: string;
  onEditSuite: (suite: TestSuite) => void;
  onDeleteSuite: (suiteId: string) => void;
}

export function SuitesTabPanel({
  suites,
  searchTerm,
  onEditSuite,
  onDeleteSuite,
}: SuitesTabPanelProps) {
  return (
    <div className="flex-1 overflow-y-auto p-4">
      <div className="max-w-5xl mx-auto">
        {/* Search results info */}
        {searchTerm.trim() && (
          <div className="mb-4 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
            <span className="text-blue-600 dark:text-primary">
              Found {suites.length} suites matching "{searchTerm}"
            </span>
          </div>
        )}
        {suites.length === 0 ? (
          <div className="text-center py-16">
            <Layers className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">
              {searchTerm.trim() ? 'No Matching Suites' : 'No Test Suites'}
            </h3>
            <p className="text-muted-foreground mb-4">
              {searchTerm.trim() ? `No suites found matching "${searchTerm}"` : 'Create suites to group related tests for execution'}
            </p>
          </div>
        ) : (
          <div className="grid gap-4">
            {suites.map((suite) => (
              <Card key={suite.id} className="bg-secondary/50 border-border hover:border-blue-500/50 dark:hover:border-amber-500/30 transition-all">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-semibold text-foreground">{suite.name}</h3>
                      {suite.description && (
                        <p className="text-sm text-muted-foreground mt-1">{suite.description}</p>
                      )}
                      <div className="flex items-center gap-4 mt-3">
                        <Badge className="bg-secondary text-foreground">
                          {suite.testCaseIds.length} tests
                        </Badge>
                        {suite.schedule && (
                          <Badge className="bg-blue-500/10 text-blue-400">
                            <Clock className="w-3 h-3 mr-1" />
                            {suite.schedule}
                          </Badge>
                        )}
                        {suite.lastRun && (
                          <span className="text-xs text-muted-foreground">
                            Last run: {new Date(suite.lastRun.date).toLocaleDateString()}
                            <span className="ml-2 text-green-400">{suite.lastRun.passed}✓</span>
                            <span className="ml-1 text-red-400">{suite.lastRun.failed}✗</span>
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        onClick={() => {
                          toast.info(`Running suite: ${suite.name}`);
                        }}
                        className="bg-green-600 hover:bg-green-500"
                      >
                        <Play className="w-4 h-4 mr-1" />
                        Run
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="bg-popover border-border">
                          <DropdownMenuItem
                            className="text-foreground focus:bg-secondary"
                            onClick={() => onEditSuite(suite)}
                          >
                            <Edit className="w-4 h-4 mr-2" /> Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-foreground focus:bg-secondary"
                            onClick={() => {
                              onEditSuite({
                                ...suite,
                                id: '',
                                name: `${suite.name} (Copy)`,
                              });
                              toast.info(`Duplicating suite: ${suite.name}`);
                            }}
                          >
                            <Copy className="w-4 h-4 mr-2" /> Duplicate
                          </DropdownMenuItem>
                          <DropdownMenuSeparator className="bg-secondary" />
                          <DropdownMenuItem
                            className="text-red-400 focus:bg-red-500/10"
                            onClick={() => onDeleteSuite(suite.id)}
                          >
                            <Trash2 className="w-4 h-4 mr-2" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
