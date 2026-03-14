/**
 * VersionHistoryPanel
 *
 * Shows the complete version history for a test case with:
 * - Timeline view of all versions (newest first)
 * - Diff summary per version (human-readable changes)
 * - Expand to see full diff details
 * - Compare any two versions side-by-side
 * - Revert to any previous version
 *
 * Usage:
 *   <VersionHistoryPanel testCaseId="abc-123" onRevert={(snapshot) => updateTestCase(snapshot)} />
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  History,
  GitBranch,
  RotateCcw,
  ChevronDown,
  ChevronRight,
  Clock,
  User,
  Diff,
  Eye,
  AlertTriangle,
  CheckCircle2,
  Plus,
  Minus,
  Edit3,
  Loader2,
} from 'lucide-react';
import { API_BASE_URL } from '@/lib/api-config';
import axios from 'axios';
import { toast } from 'sonner';

interface Version {
  id: string;
  test_case_id: string;
  version: number;
  change_type: string; // created, modified, status_change, restored, branched
  changed_by: string;
  diff_summary: string;
  diff_details: {
    added?: Array<{ field: string; values?: string[]; count?: number }>;
    removed?: Array<{ field: string; values?: string[]; count?: number }>;
    modified?: Array<{ field: string; old?: unknown; new?: unknown; modified_indices?: number[] }>;
  };
  parent_version_id?: string;
  metadata: Record<string, any>;
  created_at: string;
}

interface VersionSnapshot {
  id: string;
  version: number;
  snapshot: Record<string, any>;
  change_type: string;
  changed_by: string;
  created_at: string;
}

interface VersionHistoryPanelProps {
  testCaseId: string;
  testCaseName?: string;
  onRevert?: (snapshot: Record<string, any>) => void;
  onClose?: () => void;
}

const changeTypeConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  created: { label: 'Created', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400', icon: <Plus className="h-3 w-3" /> },
  modified: { label: 'Modified', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400', icon: <Edit3 className="h-3 w-3" /> },
  status_change: { label: 'Status', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400', icon: <AlertTriangle className="h-3 w-3" /> },
  restored: { label: 'Restored', color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400', icon: <RotateCcw className="h-3 w-3" /> },
  branched: { label: 'Branched', color: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400', icon: <GitBranch className="h-3 w-3" /> },
};

export function VersionHistoryPanel({
  testCaseId,
  testCaseName,
  onRevert,
  onClose,
}: VersionHistoryPanelProps) {
  const [versions, setVersions] = useState<Version[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [expandedVersion, setExpandedVersion] = useState<string | null>(null);
  const [revertDialogOpen, setRevertDialogOpen] = useState(false);
  const [selectedRevertVersion, setSelectedRevertVersion] = useState<Version | null>(null);
  const [reverting, setReverting] = useState(false);
  const [snapshotPreview, setSnapshotPreview] = useState<VersionSnapshot | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const fetchVersions = useCallback(async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_BASE_URL}/test-cases/${testCaseId}/versions`, {
        params: { limit: 100 },
      });
      setVersions(response.data.versions || []);
      setTotal(response.data.total || 0);
    } catch (err) {
      console.error('[VersionHistory] Failed to fetch versions:', err);
      setVersions([]);
      toast.error('Failed to load version history');
    } finally {
      setLoading(false);
    }
  }, [testCaseId]);

  useEffect(() => {
    if (testCaseId) {
      fetchVersions();
    }
  }, [testCaseId, fetchVersions]);

  const handleViewSnapshot = async (version: Version): Promise<boolean> => {
    try {
      setPreviewLoading(true);
      const response = await axios.get(
        `${API_BASE_URL}/test-cases/${testCaseId}/versions/${version.id}`
      );
      setSnapshotPreview(response.data);
      return true;
    } catch (err) {
      console.error('[VersionHistory] Failed to load snapshot:', err);
      toast.error('Failed to load version snapshot');
      return false;
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleRevert = async () => {
    if (!selectedRevertVersion) return;

    // Guard: ensure snapshot is loaded before reverting
    if (!snapshotPreview?.snapshot) {
      toast.error('Cannot revert: version snapshot not loaded. Please try again.');
      setRevertDialogOpen(false);
      return;
    }

    try {
      setReverting(true);
      const response = await axios.post(
        `${API_BASE_URL}/test-cases/${testCaseId}/versions/${selectedRevertVersion.id}/revert`,
        {}
      );

      if (response.data.status === 'reverted') {
        // Refresh version list
        await fetchVersions();

        // Notify parent to update the test case in its state
        if (onRevert && snapshotPreview?.snapshot) {
          onRevert(snapshotPreview.snapshot);
        }
        toast.success(`Reverted to version ${selectedRevertVersion.version}`);
      }
      setRevertDialogOpen(false);
      setSelectedRevertVersion(null);
    } catch (err) {
      console.error('[VersionHistory] Revert failed:', err);
      toast.error('Failed to revert to this version. Please try again.');
    } finally {
      setReverting(false);
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);

      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      if (diffDays < 7) return `${diffDays}d ago`;
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  const renderDiffDetails = (version: Version) => {
    const details = version.diff_details || {};
    const items: React.ReactNode[] = [];

    (details.added || []).forEach((a, i) => {
      items.push(
        <div key={`add-${i}`} className="flex items-center gap-2 text-xs text-green-600 dark:text-green-400">
          <Plus className="h-3 w-3" />
          <span>
            {a.field === 'steps'
              ? `Added ${a.count} step(s)`
              : a.field === 'tags'
              ? `Added tags: ${(a.values || []).join(', ')}`
              : `Added ${a.field}`}
          </span>
        </div>
      );
    });

    (details.removed || []).forEach((r, i) => {
      items.push(
        <div key={`rem-${i}`} className="flex items-center gap-2 text-xs text-red-600 dark:text-red-400">
          <Minus className="h-3 w-3" />
          <span>
            {r.field === 'steps'
              ? `Removed ${r.count} step(s)`
              : r.field === 'tags'
              ? `Removed tags: ${(r.values || []).join(', ')}`
              : `Removed ${r.field}`}
          </span>
        </div>
      );
    });

    (details.modified || []).forEach((m, i) => {
      items.push(
        <div key={`mod-${i}`} className="flex items-center gap-2 text-xs text-blue-600 dark:text-blue-400">
          <Edit3 className="h-3 w-3" />
          <span>
            {m.field === 'steps'
              ? `Modified step(s): ${(m.modified_indices || []).join(', ')}`
              : m.old !== undefined
              ? `${m.field}: "${String(m.old).slice(0, 30)}" → "${String(m.new).slice(0, 30)}"`
              : `Updated ${m.field}`}
          </span>
        </div>
      );
    });

    return items.length > 0 ? (
      <div className="mt-2 space-y-1 pl-6 border-l-2 border-gray-200 dark:border-gray-700">
        {items}
      </div>
    ) : null;
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-gray-50 dark:bg-gray-800/50">
        <div className="flex items-center gap-2">
          <History className="h-4 w-4 text-blue-500" />
          <h3 className="font-semibold text-sm">Version History</h3>
          <Badge variant="secondary" className="text-xs">{total} versions</Badge>
        </div>
        {onClose && (
          <Button variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
        )}
      </div>

      {/* Version Timeline */}
      <ScrollArea className="flex-1 p-4">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            <span className="ml-2 text-sm text-muted-foreground">Loading history...</span>
          </div>
        ) : versions.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <History className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No version history yet</p>
            <p className="text-xs mt-1">Versions are created automatically when you save changes</p>
          </div>
        ) : (
          <div className="space-y-1">
            {versions.map((version, index) => {
              const config = changeTypeConfig[version.change_type] || changeTypeConfig.modified;
              const isExpanded = expandedVersion === version.id;
              const isLatest = index === 0;

              return (
                <div
                  key={version.id}
                  className={`relative rounded-lg border transition-colors ${
                    isLatest
                      ? 'border-blue-200 bg-blue-50/50 dark:border-blue-800 dark:bg-blue-900/10'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                  }`}
                >
                  {/* Timeline connector */}
                  {index < versions.length - 1 && (
                    <div className="absolute left-5 top-full w-px h-1 bg-gray-300 dark:bg-gray-600" />
                  )}

                  {/* Version row */}
                  <div
                    className="flex items-start gap-3 p-3 cursor-pointer"
                    role="button"
                    tabIndex={0}
                    aria-expanded={isExpanded}
                    aria-label={`Version ${version.version} - ${version.diff_summary}`}
                    onClick={() => setExpandedVersion(isExpanded ? null : version.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setExpandedVersion(isExpanded ? null : version.id);
                      }
                    }}
                  >
                    <div className="flex-shrink-0 mt-0.5">
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge className={`text-xs ${config.color}`}>
                          <span className="flex items-center gap-1">
                            {config.icon}
                            v{version.version}
                          </span>
                        </Badge>
                        <span className="text-xs text-muted-foreground truncate">
                          {version.diff_summary}
                        </span>
                        {isLatest && (
                          <Badge variant="outline" className="text-xs border-blue-300 text-blue-600">
                            Current
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatDate(version.created_at)}
                        </span>
                        {version.changed_by && version.changed_by !== 'system' && (
                          <span className="flex items-center gap-1">
                            <User className="h-3 w-3" />
                            {version.changed_by.slice(0, 8)}
                          </span>
                        )}
                        {version.metadata?.restored_from_version && (
                          <span className="flex items-center gap-1 text-purple-600">
                            <RotateCcw className="h-3 w-3" />
                            from v{version.metadata.restored_from_version}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={() => handleViewSnapshot(version)}
                        aria-label={`View snapshot for version ${version.version}`}
                      >
                        <Eye className="h-3 w-3 mr-1" />
                        View
                      </Button>
                      {!isLatest && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs text-orange-600 hover:text-orange-700"
                          aria-label={`Revert to version ${version.version}`}
                          onClick={async () => {
                            setSelectedRevertVersion(version);
                            const loaded = await handleViewSnapshot(version);
                            if (loaded) {
                              setRevertDialogOpen(true);
                            }
                          }}
                        >
                          <RotateCcw className="h-3 w-3 mr-1" />
                          Revert
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Expanded diff details */}
                  {isExpanded && renderDiffDetails(version)}
                </div>
              );
            })}
          </div>
        )}
      </ScrollArea>

      {/* Snapshot Preview Dialog */}
      {snapshotPreview && !revertDialogOpen && (
        <Dialog open={!!snapshotPreview} onOpenChange={() => setSnapshotPreview(null)}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Version {snapshotPreview.version} Snapshot</DialogTitle>
              <DialogDescription>
                {snapshotPreview.change_type} on {formatDate(snapshotPreview.created_at)}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Title</label>
                <p className="text-sm">{snapshotPreview.snapshot.title || snapshotPreview.snapshot.name || '-'}</p>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Description</label>
                <p className="text-sm text-muted-foreground">{snapshotPreview.snapshot.description || '-'}</p>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Steps ({(snapshotPreview.snapshot.steps || []).length})</label>
                <div className="mt-1 space-y-1 max-h-60 overflow-y-auto">
                  {(snapshotPreview.snapshot.steps || []).map((step: Record<string, unknown>, i: number) => (
                    <div key={i} className="text-xs p-2 bg-gray-50 dark:bg-gray-800 rounded border">
                      <span className="font-mono text-muted-foreground mr-2">{i + 1}.</span>
                      {step.action || step.description || JSON.stringify(step).slice(0, 100)}
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex gap-4">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Priority</label>
                  <p className="text-sm">{snapshotPreview.snapshot.priority || '-'}</p>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Type</label>
                  <p className="text-sm">{snapshotPreview.snapshot.test_type || '-'}</p>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Tags</label>
                  <p className="text-sm">{(snapshotPreview.snapshot.tags || []).join(', ') || '-'}</p>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Revert Confirmation Dialog */}
      <Dialog open={revertDialogOpen} onOpenChange={setRevertDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RotateCcw className="h-4 w-4 text-orange-500" />
              Revert to Version {selectedRevertVersion?.version}?
            </DialogTitle>
            <DialogDescription>
              This will create a new version with the content from version {selectedRevertVersion?.version}.
              No history will be lost — you can always undo this.
            </DialogDescription>
          </DialogHeader>
          {snapshotPreview && (
            <div className="p-3 bg-orange-50 dark:bg-orange-900/10 rounded-lg border border-orange-200 dark:border-orange-800">
              <p className="text-xs font-medium text-orange-800 dark:text-orange-300 mb-1">
                Restoring: {snapshotPreview.snapshot.title || 'Untitled'}
              </p>
              <p className="text-xs text-orange-600 dark:text-orange-400">
                {(snapshotPreview.snapshot.steps || []).length} steps,
                type: {snapshotPreview.snapshot.test_type || 'manual'}
              </p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setRevertDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="default"
              className="bg-orange-600 hover:bg-orange-700"
              onClick={handleRevert}
              disabled={reverting}
            >
              {reverting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Reverting...
                </>
              ) : (
                <>
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Revert to v{selectedRevertVersion?.version}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Re-export for backwards compatibility with default imports
export default VersionHistoryPanel;
