/**
 * ReleasesTabPanel - Renders the Releases tab content in Test Repository.
 * Shows release cards with status, dates, suite count, and actions.
 */
import React from 'react';
import {
  Rocket, Calendar, Target, Edit, Copy, Trash2, MoreVertical,
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
import type { Release } from '../types/test-repository.types';

interface ReleasesTabPanelProps {
  releases: Release[];
  searchTerm: string;
  onEditRelease: (release: Release) => void;
  onDeleteRelease: (releaseId: string) => void;
}

export function ReleasesTabPanel({
  releases,
  searchTerm,
  onEditRelease,
  onDeleteRelease,
}: ReleasesTabPanelProps) {
  return (
    <div className="flex-1 overflow-y-auto p-4">
      <div className="max-w-5xl mx-auto">
        {/* Search results info */}
        {searchTerm.trim() && (
          <div className="mb-4 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
            <span className="text-blue-600 dark:text-primary">
              Found {releases.length} releases matching "{searchTerm}"
            </span>
          </div>
        )}
        {releases.length === 0 ? (
          <div className="text-center py-16">
            <Rocket className="w-16 h-16 mx-auto mb-4 text-gray-600" />
            <h3 className="text-lg font-semibold mb-2">
              {searchTerm.trim() ? 'No Matching Releases' : 'No Releases'}
            </h3>
            <p className="text-gray-500 mb-4">
              {searchTerm.trim() ? `No releases found matching "${searchTerm}"` : 'Create releases to track testing across sprints'}
            </p>
          </div>
        ) : (
          <div className="grid gap-4">
            {releases.map((release) => (
              <Card key={release.id} className="bg-gray-50 dark:bg-gray-900/50 border-gray-200 dark:border-gray-800 hover:border-blue-500/50 dark:hover:border-amber-500/30 transition-all">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-gray-900 dark:text-white">{release.name}</h3>
                        <Badge className={cn(
                          "text-xs",
                          release.status === 'planning' && "bg-blue-500/10 text-blue-400",
                          release.status === 'active' && "bg-green-500/10 text-green-400",
                          release.status === 'completed' && "bg-gray-500/10 text-gray-500 dark:text-gray-400"
                        )}>
                          {release.status}
                        </Badge>
                      </div>
                      {release.description && (
                        <p className="text-sm text-gray-500 mt-1">{release.description}</p>
                      )}
                      <div className="flex items-center gap-4 mt-3">
                        <span className="text-xs text-gray-500 flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {new Date(release.startDate).toLocaleDateString()}
                          {release.endDate && ` - ${new Date(release.endDate).toLocaleDateString()}`}
                        </span>
                        <Badge className="bg-secondary text-foreground">
                          {release.suiteIds.length} suites
                        </Badge>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-border text-foreground"
                      >
                        <Target className="w-4 h-4 mr-1" />
                        View
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-500 dark:text-gray-400">
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="bg-white dark:bg-gray-900 border-gray-200 dark:border-border">
                          <DropdownMenuItem
                            className="text-foreground focus:bg-secondary"
                            onClick={() => onEditRelease(release)}
                          >
                            <Edit className="w-4 h-4 mr-2" /> Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-foreground focus:bg-secondary">
                            <Copy className="w-4 h-4 mr-2" /> Duplicate
                          </DropdownMenuItem>
                          <DropdownMenuSeparator className="bg-secondary" />
                          <DropdownMenuItem
                            className="text-red-400 focus:bg-red-500/10"
                            onClick={() => onDeleteRelease(release.id)}
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
