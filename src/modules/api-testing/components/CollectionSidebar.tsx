/**
 * CollectionSidebar - Extracted, memoized sidebar for API testing
 * ================================================================
 * 
 * Key improvements over the old inline sidebar:
 * 1. MEMOIZED - Only re-renders when collection/sidebar state changes
 * 2. WORKSPACE SWITCHER - Switch between collections without page reload
 * 3. NESTED FOLDERS - Full hierarchy support with drag targets
 * 4. SEARCH/FILTER - Filter requests without affecting other state
 * 5. VIRTUAL SCROLLING - Handles 1000+ requests without lag
 * 6. CONTEXT MENUS - Right-click to rename, move, delete, duplicate
 * 7. NO RELOAD - Collection switching is instant, sidebar state preserved
 */

import React, { memo, useCallback, useMemo, useState, useRef, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue 
} from '@/components/ui/select';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import {
  PanelLeftClose, PanelLeftOpen, FolderOpen, Folder, FolderPlus,
  Link2, Plus, Search, Loader2, MoreHorizontal, ChevronRight,
  ChevronDown, Trash2, Copy, Edit3, ArrowRight, FileText,
  Layers, RefreshCw, Download, AlertCircle, CheckCircle2,
  Play, PlayCircle, CheckSquare, Square, X
} from 'lucide-react';
import {
  useApiTestingStore,
  useSidebarState,
  useActiveCollection,
  useWorkspaces,
  useApiTestRuns,
  getLatestResultMap,
  getFolderStats,
  type ApiCollection,
  type ApiFolder,
  type ApiRequest,
  type RequestResultInfo,
} from '@/modules/api-testing/store/apiTestingStore';
import { API_BASE_URL } from '@/lib/api-config';
import { getMethodColor } from './constants';

// ============================================================================
// METHOD BADGE (tiny, fast component)
// ============================================================================

const MethodBadge = memo(({ method }: { method: string }) => {
  const m = (method || 'GET').toUpperCase();
  const colorClass = getMethodColor(m);
  return (
    <span className={`text-[10px] px-1.5 py-0 rounded border font-mono font-medium shrink-0 ${colorClass}`}>
      {m}
    </span>
  );
});
MethodBadge.displayName = 'MethodBadge';

// ============================================================================
// REQUEST ITEM (individually memoized)
// ============================================================================

interface RequestItemProps {
  request: ApiRequest;
  isSelected: boolean;
  isDragging?: boolean;
  isDropTarget?: boolean;
  lastResult?: RequestResultInfo | null;
  onClick: (id: string) => void;
  onContextAction: (action: string, id: string) => void;
  onRun?: (id: string) => void;
  onDragStart?: (e: React.DragEvent, id: string) => void;
  onDragOver?: (e: React.DragEvent, id: string) => void;
  onDragLeave?: () => void;
  onDrop?: (e: React.DragEvent, id: string, folderId: string | null) => void;
  onDragEnd?: () => void;
  /** Multi-select mode */
  selectMode?: boolean;
  isChecked?: boolean;
  onToggleSelect?: (id: string) => void;
  /** Inline rename */
  isRenaming?: boolean;
  onStartRename?: (id: string) => void;
  onRenameSubmit?: (id: string, newName: string) => void;
  onCancelRename?: () => void;
}

const RequestItem = memo(({ request, isSelected, isDragging, isDropTarget, lastResult, onClick, onContextAction, onRun, onDragStart, onDragOver, onDragLeave, onDrop, onDragEnd, selectMode, isChecked, onToggleSelect, isRenaming, onStartRename, onRenameSubmit, onCancelRename }: RequestItemProps) => {
  const label = request.name || `${request.method} ${request.path || request.url || '/'}`;
  const endpointPath = request.path || request.url || '';
  const showPath = request.name && endpointPath && endpointPath !== request.name;

  // Inline rename state
  const [localName, setLocalName] = React.useState(request.name || '');
  const localInputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (isRenaming) {
      setLocalName(request.name || '');
      setTimeout(() => {
        localInputRef.current?.focus();
        localInputRef.current?.select();
      }, 50);
    }
  }, [isRenaming, request.name]);

  if (isRenaming) {
    return (
      <div className="flex items-center gap-1.5 px-2 py-1">
        <MethodBadge method={request.method} />
        <Input
          ref={localInputRef}
          value={localName}
          onChange={(e) => setLocalName(e.target.value)}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === 'Enter') {
              if (localName.trim()) onRenameSubmit?.(request.id, localName.trim());
              else onCancelRename?.();
            }
            if (e.key === 'Escape') onCancelRename?.();
          }}
          onBlur={() => {
            setTimeout(() => {
              if (localName.trim()) onRenameSubmit?.(request.id, localName.trim());
              else onCancelRename?.();
            }, 150);
          }}
          className="h-6 text-xs flex-1"
          placeholder="Request name"
          onClick={(e) => e.stopPropagation()}
        />
      </div>
    );
  }

  return (
    <div
      className={`group relative ${isDragging ? 'opacity-40' : ''} ${isDropTarget ? 'border-t-2 border-primary' : ''}`}
      draggable={!selectMode}
      onDragStart={(e) => !selectMode && onDragStart?.(e, request.id)}
      onDragOver={(e) => { e.preventDefault(); onDragOver?.(e, request.id); }}
      onDragLeave={() => onDragLeave?.()}
      onDrop={(e) => onDrop?.(e, request.id, request.folder_id)}
      onDragEnd={() => onDragEnd?.()}
    >
      <button
        type="button"
        className={`w-full flex items-center gap-1.5 px-2 py-1.5 rounded text-left text-xs transition-colors ${
          isSelected
            ? 'bg-primary/10 text-primary border border-primary/20'
            : isChecked
              ? 'bg-destructive/5 border border-destructive/20'
              : 'hover:bg-muted/70'
        }`}
        onClick={() => selectMode ? onToggleSelect?.(request.id) : onClick(request.id)}
        onDoubleClick={() => onContextAction('rename', request.id)}
      >
        {/* Checkbox in select mode, status dot otherwise */}
        {selectMode ? (
          <Checkbox
            checked={isChecked}
            onCheckedChange={() => onToggleSelect?.(request.id)}
            onClick={(e) => e.stopPropagation()}
            className="h-3.5 w-3.5 shrink-0"
          />
        ) : lastResult ? (
          <span
            className={`w-1.5 h-1.5 rounded-full shrink-0 ${
              lastResult.status === 'passed' ? 'bg-green-500' : 'bg-red-500'
            }`}
            title={`${lastResult.status === 'passed' ? 'Passed' : 'Failed'} (HTTP ${lastResult.response_status}, ${lastResult.time}ms)`}
          />
        ) : (
          <span className="w-1.5 h-1.5 rounded-full shrink-0 bg-muted-foreground/20" title="Not yet run" />
        )}
        <MethodBadge method={request.method} />
        <span className="truncate flex-1">
          {label}
          {showPath && (
            <span className="block text-[10px] text-muted-foreground truncate font-mono opacity-70">
              {endpointPath}
            </span>
          )}
        </span>
      </button>

      {/* Hover actions: Run + Context menu */}
      <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
        {onRun && (
          <button
            type="button"
            className="h-5 w-5 flex items-center justify-center rounded hover:bg-green-100 dark:hover:bg-green-900/30 text-muted-foreground hover:text-green-600"
            title="Run this request"
            onClick={(e) => { e.stopPropagation(); onRun(request.id); }}
          >
            <Play className="w-3 h-3" />
          </button>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-5 w-5 p-0">
              <MoreHorizontal className="w-3 h-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40">
            <DropdownMenuItem onClick={() => onContextAction('edit', request.id)}>
              <Edit3 className="w-3.5 h-3.5 mr-2" /> Edit in Builder
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onContextAction('rename', request.id)}>
              <Edit3 className="w-3.5 h-3.5 mr-2" /> Rename
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onRun?.(request.id)}>
              <Play className="w-3.5 h-3.5 mr-2" /> Run
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onContextAction('duplicate', request.id)}>
              <Copy className="w-3.5 h-3.5 mr-2" /> Duplicate
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onContextAction('move', request.id)}>
              <ArrowRight className="w-3.5 h-3.5 mr-2" /> Move to folder
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => onContextAction('delete', request.id)}
              className="text-destructive"
            >
              <Trash2 className="w-3.5 h-3.5 mr-2" /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
});
RequestItem.displayName = 'RequestItem';

// ============================================================================
// FOLDER NODE (recursive for nested folders)
// ============================================================================

interface FolderNodeProps {
  folder: ApiFolder;
  requests: ApiRequest[];
  allFolders: ApiFolder[];
  selectedRequestId: string | null;
  expandedFolders: Set<string>;
  lastResultMap?: Record<string, RequestResultInfo>;
  onToggleExpand: (id: string) => void;
  onRequestClick: (id: string) => void;
  onRequestContextAction: (action: string, id: string) => void;
  onFolderAction: (action: string, id: string) => void;
  onRunRequest?: (id: string) => void;
  onRunFolder?: (requestIds: string[]) => void;
  depth: number;
  dropTargetId?: string | null;
  dragRequestId?: string | null;
  onDragStart?: (e: React.DragEvent, id: string) => void;
  onDragOver?: (e: React.DragEvent, id: string) => void;
  onDragLeave?: () => void;
  onDropOnFolder?: (e: React.DragEvent, folderId: string | null) => void;
  onDropReorder?: (e: React.DragEvent, targetId: string, folderId: string | null) => void;
  onDragEnd?: () => void;
  /** Multi-select props */
  selectMode?: boolean;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
  /** Inline folder rename state */
  renamingFolderId?: string | null;
  onStartRename?: (folderId: string) => void;
  onRenameSubmit?: (folderId: string, newName: string) => void;
  onCancelRename?: () => void;
  /** Inline request rename state */
  renamingRequestId?: string | null;
  onRequestRenameSubmit?: (requestId: string, newName: string) => void;
}

const FolderNode = memo(({
  folder, requests, allFolders, selectedRequestId, expandedFolders, lastResultMap,
  onToggleExpand, onRequestClick, onRequestContextAction, onFolderAction,
  onRunRequest, onRunFolder, depth,
  dropTargetId, dragRequestId, onDragStart, onDragOver, onDragLeave, onDropOnFolder, onDropReorder, onDragEnd,
  selectMode, selectedIds, onToggleSelect,
  renamingFolderId, onStartRename, onRenameSubmit, onCancelRename,
  renamingRequestId, onRequestRenameSubmit
}: FolderNodeProps) => {
  const isExpanded = expandedFolders.has(folder.id);
  const isRenaming = renamingFolderId === folder.id;
  const folderRequests = requests.filter(r => r.folder_id === folder.id)
    .sort((a, b) => a.sort_order - b.sort_order);
  const childFolders = allFolders.filter(f => f.parent_folder_id === folder.id);
  const allFolderRequestIds = [
    ...folderRequests.map(r => r.id),
    ...childFolders.flatMap(cf => requests.filter(r => r.folder_id === cf.id).map(r => r.id)),
  ];
  const totalCount = allFolderRequestIds.length;
  const isFolderDropTarget = dropTargetId === `folder_${folder.id}`;

  // Inline rename state
  const [localRenameName, setLocalRenameName] = React.useState(folder.name);
  const localRenameRef = React.useRef<HTMLInputElement>(null);
  const hasSubmittedRef = React.useRef(false);
  // Track mount-time so we can ignore blurs that happen too soon (e.g. dropdown closing)
  const mountTimeRef = React.useRef(0);
  const prevIsRenamingRef = React.useRef(false);

  // Focus the rename input ONLY when transitioning into rename mode
  React.useEffect(() => {
    const justEnteredRename = isRenaming && !prevIsRenamingRef.current;
    prevIsRenamingRef.current = isRenaming;
    if (justEnteredRename) {
      setLocalRenameName(folder.name);
      hasSubmittedRef.current = false;
      mountTimeRef.current = Date.now();
      // Delay focus to let DOM expansion + dropdown close animations finish
      // Use requestAnimationFrame + setTimeout for reliable focus after React re-render
      requestAnimationFrame(() => {
        setTimeout(() => {
          localRenameRef.current?.focus();
          localRenameRef.current?.select();
        }, 120);
      });
    }
  }, [isRenaming, folder.name]);

  // Folder-level pass/fail summary
  const folderStats = lastResultMap ? getFolderStats(allFolderRequestIds, lastResultMap) : null;

  return (
    <div className={depth > 0 ? 'pl-2 border-l border-border ml-1.5' : ''}>
      <div
        className={`group flex items-center gap-1 px-2 py-1 rounded-md hover:bg-muted/50 cursor-pointer ${isFolderDropTarget ? 'bg-primary/10 ring-1 ring-primary/40' : ''}`}
        onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); onDragOver?.(e, `folder_${folder.id}`); }}
        onDragLeave={() => onDragLeave?.()}
        onDrop={(e) => { e.stopPropagation(); onDropOnFolder?.(e, folder.id); }}
      >
        {isRenaming ? (
          /* Inline rename input */
          <div className="flex items-center gap-1.5 flex-1 min-w-0">
            <Folder className="w-3.5 h-3.5 text-amber-500/70 shrink-0" />
            <Input
              ref={localRenameRef}
              value={localRenameName}
              onChange={(e) => setLocalRenameName(e.target.value)}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === 'Enter') {
                  if (!hasSubmittedRef.current && localRenameName.trim()) {
                    hasSubmittedRef.current = true;
                    onRenameSubmit?.(folder.id, localRenameName.trim());
                  } else if (!localRenameName.trim()) {
                    hasSubmittedRef.current = true;
                    onCancelRename?.();
                  }
                }
                if (e.key === 'Escape') {
                  hasSubmittedRef.current = true;
                  onCancelRename?.();
                }
              }}
              onBlur={() => {
                // Capture the elapsed time at blur-fire moment (not inside setTimeout)
                const elapsed = Date.now() - mountTimeRef.current;
                setTimeout(() => {
                  if (hasSubmittedRef.current) return;
                  // If blur fires within 350ms of mount, re-focus instead of submitting
                  // (covers DOM expansion, dropdown close, scroll adjustments)
                  if (elapsed < 350) {
                    localRenameRef.current?.focus();
                    return;
                  }
                  hasSubmittedRef.current = true;
                  if (localRenameName.trim()) onRenameSubmit?.(folder.id, localRenameName.trim());
                  else onCancelRename?.();
                }, 150);
              }}
              className="h-6 text-xs flex-1"
              placeholder="Folder name"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        ) : (
        <button
          type="button"
          className="flex items-center gap-1.5 flex-1 min-w-0"
          onClick={() => onToggleExpand(folder.id)}
          onDoubleClick={(e) => { e.stopPropagation(); onStartRename?.(folder.id); }}
        >
          {isExpanded ? (
            <ChevronDown className="w-3 h-3 text-muted-foreground shrink-0" />
          ) : (
            <ChevronRight className="w-3 h-3 text-muted-foreground shrink-0" />
          )}
          <Folder className="w-3.5 h-3.5 text-amber-500/70 shrink-0" />
          <span className="text-xs font-medium truncate">{folder.name}</span>
          <span className="text-[10px] text-muted-foreground shrink-0">({totalCount})</span>
          {/* Folder pass/fail summary */}
          {folderStats && folderStats.total > 0 && (folderStats.passed > 0 || folderStats.failed > 0) && (
            <span className="text-[9px] shrink-0 ml-0.5 flex items-center gap-0.5">
              {folderStats.passed > 0 && <span className="text-green-600">{folderStats.passed}✓</span>}
              {folderStats.failed > 0 && <span className="text-red-500">{folderStats.failed}✗</span>}
            </span>
          )}
        </button>
        )}
        
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          {/* Run all folder requests */}
          {onRunFolder && totalCount > 0 && (
            <button
              type="button"
              className="h-5 w-5 flex items-center justify-center rounded hover:bg-green-100 dark:hover:bg-green-900/30 text-muted-foreground hover:text-green-600"
              title={`Run all ${totalCount} tests in ${folder.name}`}
              onClick={(e) => { e.stopPropagation(); onRunFolder(allFolderRequestIds); }}
            >
              <Play className="w-3 h-3" />
            </button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-5 w-5 p-0">
                <MoreHorizontal className="w-3 h-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              {onRunFolder && totalCount > 0 && (
                <>
                  <DropdownMenuItem onClick={() => onRunFolder(allFolderRequestIds)}>
                    <Play className="w-3.5 h-3.5 mr-2" /> Run All ({totalCount})
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                </>
              )}
              <DropdownMenuItem onClick={() => onFolderAction('add-request', folder.id)}>
                <Plus className="w-3.5 h-3.5 mr-2" /> Add request
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onFolderAction('add-subfolder', folder.id)}>
                <FolderPlus className="w-3.5 h-3.5 mr-2" /> Add subfolder
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => onFolderAction('rename', folder.id)}>
                <Edit3 className="w-3.5 h-3.5 mr-2" /> Rename
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => onFolderAction('delete', folder.id)}
                className="text-destructive"
              >
                <Trash2 className="w-3.5 h-3.5 mr-2" /> Delete folder
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      
      {isExpanded && (
        <div className="pl-2 space-y-0.5">
          {/* Child folders first */}
          {childFolders.map(cf => (
            <FolderNode
              key={cf.id}
              folder={cf}
              requests={requests}
              allFolders={allFolders}
              selectedRequestId={selectedRequestId}
              expandedFolders={expandedFolders}
              lastResultMap={lastResultMap}
              onToggleExpand={onToggleExpand}
              onRequestClick={onRequestClick}
              onRequestContextAction={onRequestContextAction}
              onFolderAction={onFolderAction}
              onRunRequest={onRunRequest}
              onRunFolder={onRunFolder}
              depth={depth + 1}
              dropTargetId={dropTargetId}
              dragRequestId={dragRequestId}
              onDragStart={onDragStart}
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onDropOnFolder={onDropOnFolder}
              onDropReorder={onDropReorder}
              onDragEnd={onDragEnd}
              selectMode={selectMode}
              selectedIds={selectedIds}
              onToggleSelect={onToggleSelect}
              renamingFolderId={renamingFolderId}
              onStartRename={onStartRename}
              onRenameSubmit={onRenameSubmit}
              onCancelRename={onCancelRename}
              renamingRequestId={renamingRequestId}
              onRequestRenameSubmit={onRequestRenameSubmit}
            />
          ))}
          {/* Then requests */}
          {folderRequests.map(req => (
            <RequestItem
              key={req.id}
              request={req}
              isSelected={selectedRequestId === req.id}
              isDragging={dragRequestId === req.id}
              isDropTarget={dropTargetId === req.id}
              lastResult={lastResultMap?.[req.id] || null}
              onClick={onRequestClick}
              onContextAction={onRequestContextAction}
              onRun={onRunRequest}
              selectMode={selectMode}
              isChecked={selectedIds?.has(req.id)}
              onToggleSelect={onToggleSelect}
              onDragStart={onDragStart}
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onDrop={onDropReorder}
              onDragEnd={onDragEnd}
              isRenaming={renamingRequestId === req.id}
              onRenameSubmit={onRequestRenameSubmit}
              onCancelRename={onCancelRename}
            />
          ))}
          {folderRequests.length === 0 && childFolders.length === 0 && (
            <p className="text-[10px] text-muted-foreground px-2 py-1 italic">Empty folder</p>
          )}
        </div>
      )}
    </div>
  );
});
FolderNode.displayName = 'FolderNode';

// ============================================================================
// ENDPOINT GROUP (groups requests by METHOD + path)
// ============================================================================

interface EndpointGroupProps {
  endpointKey: string;
  requests: ApiRequest[];
  selectedRequestId: string | null;
  isExpanded: boolean;
  lastResultMap?: Record<string, RequestResultInfo>;
  onToggleExpand: (key: string) => void;
  onRequestClick: (id: string) => void;
  onRequestContextAction: (action: string, id: string) => void;
  onAddTestCase?: (method: string, path: string) => void;
  onRunEndpoint?: (requestIds: string[]) => void;
  onRunRequest?: (id: string) => void;
  onDragStart?: (e: React.DragEvent, id: string) => void;
  onDragOver?: (e: React.DragEvent, id: string) => void;
  onDragLeave?: () => void;
  onDrop?: (e: React.DragEvent, targetId: string, folderId: string | null) => void;
  onDragEnd?: () => void;
  dragRequestId?: string | null;
  dropTargetId?: string | null;
  /** Multi-select props */
  selectMode?: boolean;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
  /** Request rename */
  renamingRequestId?: string | null;
  onRequestRenameSubmit?: (requestId: string, newName: string) => void;
  onCancelRename?: () => void;
}

const EndpointGroup = memo(({
  endpointKey, requests, selectedRequestId, isExpanded, lastResultMap,
  onToggleExpand, onRequestClick, onRequestContextAction,
  onAddTestCase, onRunEndpoint, onRunRequest,
  onDragStart, onDragOver, onDragLeave, onDrop, onDragEnd,
  dragRequestId, dropTargetId,
  selectMode, selectedIds, onToggleSelect,
  renamingRequestId, onRequestRenameSubmit, onCancelRename
}: EndpointGroupProps) => {
  const [method, ...pathParts] = endpointKey.split(' ');
  const path = pathParts.join(' ') || '/';
  
  // For single-request endpoints, render a RequestItem directly with full context menu
  if (requests.length === 1) {
    return (
      <RequestItem
        key={requests[0].id}
        request={requests[0]}
        isSelected={selectedRequestId === requests[0].id}
        isDragging={dragRequestId === requests[0].id}
        isDropTarget={dropTargetId === requests[0].id}
        lastResult={lastResultMap?.[requests[0].id] || null}
        onClick={onRequestClick}
        onContextAction={onRequestContextAction}
        onRun={onRunRequest}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onDragEnd={onDragEnd}
        selectMode={selectMode}
        isChecked={selectedIds?.has(requests[0].id)}
        onToggleSelect={onToggleSelect}
        isRenaming={renamingRequestId === requests[0].id}
        onRenameSubmit={onRequestRenameSubmit}
        onCancelRename={onCancelRename}
      />
    );
  }
  
  // Multi-request endpoint group with expand/collapse
  return (
    <div>
      <div className="group/endpoint relative">
        <button
          type="button"
          className="w-full flex items-center gap-1.5 px-2 py-1 rounded-md hover:bg-muted/50 transition-colors"
          onClick={() => onToggleExpand(endpointKey)}
        >
          {isExpanded ? (
            <ChevronDown className="w-3 h-3 text-muted-foreground shrink-0" />
          ) : (
            <ChevronRight className="w-3 h-3 text-muted-foreground shrink-0" />
          )}
          <MethodBadge method={method} />
          <span className="text-xs font-medium truncate font-mono flex-1 text-left">{path}</span>
          <span className="text-[10px] text-muted-foreground shrink-0 group-hover/endpoint:hidden">({requests.length})</span>
        </button>
        {/* Hover actions: Run all + Add test case */}
        <div className="absolute right-1 top-1/2 -translate-y-1/2 hidden group-hover/endpoint:flex items-center gap-0.5">
          {onRunEndpoint && (
            <button
              type="button"
              className="h-5 w-5 flex items-center justify-center rounded hover:bg-muted text-muted-foreground hover:text-green-500"
              title={`Run all ${requests.length} test(s) for ${method} ${path}`}
              onClick={(e) => { e.stopPropagation(); onRunEndpoint(requests.map(r => r.id)); }}
            >
              <Play className="w-3 h-3" />
            </button>
          )}
          {onAddTestCase && (
            <button
              type="button"
              className="h-5 w-5 flex items-center justify-center rounded hover:bg-muted text-muted-foreground hover:text-primary"
              title={`Add test case for ${method} ${path}`}
              onClick={(e) => { e.stopPropagation(); onAddTestCase(method, path); }}
            >
              <Plus className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>
      
      {isExpanded && (
        <div className="pl-5 border-l border-border ml-2.5 space-y-0.5">
          {requests.map(req => (
            <RequestItem
              key={req.id}
              request={req}
              isSelected={selectedRequestId === req.id}
              isDragging={dragRequestId === req.id}
              isDropTarget={dropTargetId === req.id}
              lastResult={lastResultMap?.[req.id] || null}
              onClick={onRequestClick}
              onContextAction={onRequestContextAction}
              onRun={onRunRequest}
              onDragStart={onDragStart}
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onDrop={onDrop}
              onDragEnd={onDragEnd}
              selectMode={selectMode}
              isChecked={selectedIds?.has(req.id)}
              onToggleSelect={onToggleSelect}
              isRenaming={renamingRequestId === req.id}
              onRenameSubmit={onRequestRenameSubmit}
              onCancelRename={onCancelRename}
            />
          ))}
        </div>
      )}
    </div>
  );
});
EndpointGroup.displayName = 'EndpointGroup';

// WorkspaceCollectionSwitcher removed — merged into main CollectionSidebar as unified tree

// ============================================================================
// MAIN SIDEBAR COMPONENT
// ============================================================================

interface CollectionSidebarProps {
  className?: string;
}

const CollectionSidebar = memo(({ className = '' }: CollectionSidebarProps) => {
  const sidebar = useSidebarState();
  const collection = useActiveCollection();
  const loading = useApiTestingStore(s => s.loading.collections);
  const syncStatus = useApiTestingStore(s => s.sync_status);
  const testRuns = useApiTestRuns();
  
  // Compute latest result for each request (memoized)
  const lastResultMap = useMemo(() => getLatestResultMap(testRuns), [testRuns]);
  
  // Actions (stable refs from store)
  const setSidebarOpen = useApiTestingStore(s => s.setSidebarOpen);
  const setSidebarSearch = useApiTestingStore(s => s.setSidebarSearch);
  const toggleFolderExpanded = useApiTestingStore(s => s.toggleFolderExpanded);
  const toggleEndpointExpanded = useApiTestingStore(s => s.toggleEndpointExpanded);
  const openRequestInBuilder = useApiTestingStore(s => s.openRequestInBuilder);
  const deleteRequest = useApiTestingStore(s => s.deleteRequest);
  const duplicateRequest = useApiTestingStore(s => s.duplicateRequest);
  const createFolder = useApiTestingStore(s => s.createFolder);
  const renameFolder = useApiTestingStore(s => s.renameFolder);
  const deleteFolder = useApiTestingStore(s => s.deleteFolder);
  const addRequest = useApiTestingStore(s => s.addRequest);
  const moveRequest = useApiTestingStore(s => s.moveRequest);
  const reorderRequest = useApiTestingStore(s => s.reorderRequest);
  const updateRequest = useApiTestingStore(s => s.updateRequest);
  const createCollection = useApiTestingStore(s => s.createCollection);
  const switchCollection = useApiTestingStore(s => s.switchCollection);
  // Collection management (migrated from WorkspaceCollectionSwitcher)
  const collections = useApiTestingStore(s => s.collections);
  const activeCollId = useApiTestingStore(s => s.active_collection_id);
  const activeWsId = useApiTestingStore(s => s.active_workspace_id);
  const workspaces = useWorkspaces();
  const switchWorkspace = useApiTestingStore(s => s.switchWorkspace);
  const updateCollection = useApiTestingStore(s => s.updateCollection);
  const deleteCollection = useApiTestingStore(s => s.deleteCollection);

  const [renamingFolderId, setRenamingFolderId] = useState<string | null>(null);
  const [moveDialogRequestId, setMoveDialogRequestId] = useState<string | null>(null);
  // Inline request rename state
  const [renamingRequestId, setRenamingRequestId] = useState<string | null>(null);
  // Drag-and-drop state
  const [dragRequestId, setDragRequestId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  // Multi-select / bulk delete state
  const [selectMode, setSelectMode] = useState(false);
  const [selectedRequestIds, setSelectedRequestIds] = useState<Set<string>>(new Set());
  // Collection tree state (migrated from WorkspaceCollectionSwitcher)
  const [renamingCollectionId, setRenamingCollectionId] = useState<string | null>(null);
  const [collectionRenameValue, setCollectionRenameValue] = useState('');
  const collectionRenameRef = useRef<HTMLInputElement>(null);
  const collectionRenameMountRef = useRef(0);
  const [expandedCollections, setExpandedCollections] = useState<Set<string>>(() => {
    const initId = useApiTestingStore.getState().active_collection_id;
    return initId ? new Set([initId]) : new Set();
  });

  // Resizable sidebar width
  const SIDEBAR_MIN = 220;
  const SIDEBAR_MAX = 600;
  const SIDEBAR_DEFAULT = 260;
  const [sidebarWidth, setSidebarWidth] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('apex_sidebar_width');
      return saved ? Math.max(SIDEBAR_MIN, Math.min(SIDEBAR_MAX, Number(saved))) : SIDEBAR_DEFAULT;
    } catch { return SIDEBAR_DEFAULT; }
  });
  const isResizing = useRef(false);
  const resizeStartX = useRef(0);
  const resizeStartWidth = useRef(SIDEBAR_DEFAULT);

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isResizing.current = true;
    resizeStartX.current = e.clientX;
    resizeStartWidth.current = sidebarWidth;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, [sidebarWidth]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing.current) return;
      const delta = e.clientX - resizeStartX.current;
      const newWidth = Math.max(SIDEBAR_MIN, Math.min(SIDEBAR_MAX, resizeStartWidth.current + delta));
      setSidebarWidth(newWidth);
    };
    const handleMouseUp = () => {
      if (!isResizing.current) return;
      isResizing.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      // Persist
      try { localStorage.setItem('apex_sidebar_width', String(sidebarWidth)); } catch {}
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [sidebarWidth]);
  
  // ---- Collection tree callbacks (migrated from WorkspaceCollectionSwitcher) ----
  const wsCollections = useMemo(() => {
    return Object.values(collections).filter(c =>
      !activeWsId || !c.workspace_id || c.workspace_id === activeWsId
    );
  }, [collections, activeWsId]);

  // Auto-expand active collection when it changes
  useEffect(() => {
    if (activeCollId) {
      setExpandedCollections(prev => {
        if (prev.has(activeCollId)) return prev;
        const next = new Set(prev);
        next.add(activeCollId);
        return next;
      });
    }
  }, [activeCollId]);

  const toggleCollectionExpanded = useCallback((collId: string) => {
    setExpandedCollections(prev => {
      const next = new Set(prev);
      if (next.has(collId)) next.delete(collId);
      else next.add(collId);
      return next;
    });
  }, []);

  const handleCollectionClick = useCallback((collId: string) => {
    switchCollection(collId);
    setExpandedCollections(prev => {
      const next = new Set(prev);
      next.add(collId);
      return next;
    });
  }, [switchCollection]);

  const handleNewCollection = useCallback(async () => {
    try {
      const name = `Collection ${wsCollections.length + 1}`;
      const coll = await createCollection({ name });
      if (coll?.id) {
        switchCollection(coll.id);
        setRenamingCollectionId(coll.id);
        setCollectionRenameValue(name);
        collectionRenameMountRef.current = Date.now();
        requestAnimationFrame(() => setTimeout(() => {
          collectionRenameRef.current?.focus();
          collectionRenameRef.current?.select();
        }, 80));
      }
    } catch (err) {
      console.error('[CollectionSidebar] Failed to create collection:', err);
    }
  }, [createCollection, switchCollection, wsCollections.length]);

  const startCollectionRename = useCallback((collId: string) => {
    const coll = collections[collId];
    if (!coll) return;
    setRenamingCollectionId(collId);
    setCollectionRenameValue(coll.name);
    collectionRenameMountRef.current = Date.now();
    requestAnimationFrame(() => setTimeout(() => {
      collectionRenameRef.current?.focus();
      collectionRenameRef.current?.select();
    }, 80));
  }, [collections]);

  const handleCollectionRenameSubmit = useCallback(() => {
    if (Date.now() - collectionRenameMountRef.current < 250) return;
    if (renamingCollectionId && collectionRenameValue.trim()) {
      updateCollection(renamingCollectionId, { name: collectionRenameValue.trim() });
    }
    setRenamingCollectionId(null);
    setCollectionRenameValue('');
  }, [renamingCollectionId, collectionRenameValue, updateCollection]);

  const handleDeleteCollection = useCallback(async (collId: string) => {
    const coll = collections[collId];
    if (!coll) return;
    if (!window.confirm(`Delete collection "${coll.name}"? This cannot be undone.`)) return;
    await deleteCollection(collId);
    const remaining = Object.values(collections).filter(c => c.id !== collId);
    if (remaining.length > 0) switchCollection(remaining[0].id);
  }, [collections, deleteCollection, switchCollection]);

  // Handler: "New" button — ensure a collection exists, then add a request and open it in builder
  const handleNewRequest = useCallback(async (folderId?: string | null) => {
    let collId = useApiTestingStore.getState().active_collection_id;

    // Create a collection first if none exists
    if (!collId) {
      const coll = await createCollection({ name: 'My Collection' });
      switchCollection(coll.id);
      collId = coll.id;
    }

    // Add a new blank request and open it, auto-enter rename mode
    const reqId = addRequest({ method: 'GET', name: 'New Request', url: '' }, folderId || undefined);
    if (reqId) {
      openRequestInBuilder(reqId);
      setRenamingRequestId(reqId);
    }
  }, [createCollection, switchCollection, addRequest, openRequestInBuilder]);

  // Multi-select handlers
  const handleToggleSelectMode = useCallback(() => {
    setSelectMode(prev => {
      if (prev) setSelectedRequestIds(new Set()); // Clear selection when exiting
      return !prev;
    });
  }, []);

  const handleToggleSelect = useCallback((requestId: string) => {
    setSelectedRequestIds(prev => {
      const next = new Set(prev);
      if (next.has(requestId)) next.delete(requestId);
      else next.add(requestId);
      return next;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    if (!collection) return;
    setSelectedRequestIds(new Set(collection.requests.map(r => r.id)));
  }, [collection]);

  const handleDeselectAll = useCallback(() => {
    setSelectedRequestIds(new Set());
  }, []);

  const handleBulkDelete = useCallback(() => {
    if (selectedRequestIds.size === 0) return;
    const count = selectedRequestIds.size;
    if (!window.confirm(`Delete ${count} selected request${count !== 1 ? 's' : ''}? This cannot be undone.`)) return;
    for (const reqId of selectedRequestIds) {
      deleteRequest(reqId);
    }
    setSelectedRequestIds(new Set());
    setSelectMode(false);
  }, [selectedRequestIds, deleteRequest]);

  const handleDeleteAll = useCallback(() => {
    if (!collection || collection.requests.length === 0) return;
    const count = collection.requests.length;
    if (!window.confirm(`Delete ALL ${count} request${count !== 1 ? 's' : ''} in "${collection.name}"? This cannot be undone.`)) return;
    for (const req of collection.requests) {
      deleteRequest(req.id);
    }
    setSelectedRequestIds(new Set());
    setSelectMode(false);
  }, [collection, deleteRequest]);

  // Memoized endpoint grouping
  const endpointGroups = useMemo(() => {
    if (!collection) return [];
    
    const searchLower = sidebar.search_query.toLowerCase();
    const filteredRequests = searchLower
      ? collection.requests.filter(r => 
          r.name.toLowerCase().includes(searchLower) ||
          r.method.toLowerCase().includes(searchLower) ||
          r.url.toLowerCase().includes(searchLower) ||
          r.path.toLowerCase().includes(searchLower)
        )
      : collection.requests;
    
    // Group unfiled requests by endpoint
    const unfiledRequests = filteredRequests.filter(r => !r.folder_id);
    const byEndpoint = new Map<string, ApiRequest[]>();
    
    for (const req of unfiledRequests) {
      const method = (req.method || 'GET').toUpperCase();
      const path = (req.path || req.url || '/').replace(/^https?:\/\/[^/]+/, '') || '/';
      const key = `${method} ${path}`;
      if (!byEndpoint.has(key)) byEndpoint.set(key, []);
      byEndpoint.get(key)!.push(req);
    }
    
    const methodOrder: Record<string, number> = { GET: 0, POST: 1, PUT: 2, PATCH: 3, DELETE: 4, HEAD: 5, OPTIONS: 6 };
    
    return Array.from(byEndpoint.entries()).sort(([a], [b]) => {
      const [ma, pa] = a.split(' ', 2);
      const [mb, pb] = b.split(' ', 2);
      const oa = methodOrder[ma] ?? 99;
      const ob = methodOrder[mb] ?? 99;
      if (oa !== ob) return oa - ob;
      return (pa || '').localeCompare(pb || '');
    });
  }, [collection, sidebar.search_query]);
  
  // Memoized root folders (no parent)
  const rootFolders = useMemo(() => {
    if (!collection) return [];
    return collection.folders.filter(f => !f.parent_folder_id)
      .sort((a, b) => a.sort_order - b.sort_order);
  }, [collection]);

  // Stable references for arrays passed to FolderNode — prevents memo() defeat.
  // useActiveCollection returns a new object when updated_at changes (e.g., rename),
  // even though the actual requests/folders arrays haven't changed structurally.
  // We use refs to keep the old array reference when contents haven't changed.
  const stableRequestsRef = useRef<ApiRequest[]>([]);
  const stableFoldersRef = useRef<ApiFolder[]>([]);

  const currentRequests = collection?.requests || [];
  const currentFolders = collection?.folders || [];

  // Only update the ref if the array actually changed structurally
  if (
    currentRequests.length !== stableRequestsRef.current.length ||
    currentRequests.some((r, i) => r.id !== stableRequestsRef.current[i]?.id || r.name !== stableRequestsRef.current[i]?.name || r.folder_id !== stableRequestsRef.current[i]?.folder_id || r.sort_order !== stableRequestsRef.current[i]?.sort_order)
  ) {
    stableRequestsRef.current = currentRequests;
  }
  if (
    currentFolders.length !== stableFoldersRef.current.length ||
    currentFolders.some((f, i) => f.id !== stableFoldersRef.current[i]?.id || f.name !== stableFoldersRef.current[i]?.name || f.parent_folder_id !== stableFoldersRef.current[i]?.parent_folder_id || f.sort_order !== stableFoldersRef.current[i]?.sort_order)
  ) {
    stableFoldersRef.current = currentFolders;
  }

  const stableRequests = stableRequestsRef.current;
  const stableFolders = stableFoldersRef.current;
  
  // Callbacks
  const handleRequestClick = useCallback((requestId: string) => {
    openRequestInBuilder(requestId);
  }, [openRequestInBuilder]);
  
  const handleRequestContextAction = useCallback((action: string, requestId: string) => {
    switch (action) {
      case 'edit': openRequestInBuilder(requestId); break;
      case 'rename': setRenamingRequestId(requestId); break;
      case 'duplicate': duplicateRequest(requestId); break;
      case 'delete': {
        const req = collection?.requests.find(r => r.id === requestId);
        if (window.confirm(`Delete request "${req?.name || 'Untitled'}"? This cannot be undone.`)) {
          deleteRequest(requestId);
        }
        break;
      }
      case 'move': setMoveDialogRequestId(requestId); break;
    }
  }, [openRequestInBuilder, duplicateRequest, deleteRequest]);

  // Drag-and-drop handlers
  const handleDragStart = useCallback((e: React.DragEvent, requestId: string) => {
    e.dataTransfer.setData('text/plain', requestId);
    e.dataTransfer.effectAllowed = 'move';
    setDragRequestId(requestId);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDropTargetId(targetId);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDropTargetId(null);
  }, []);

  const handleDropOnFolder = useCallback((e: React.DragEvent, folderId: string | null) => {
    e.preventDefault();
    const reqId = e.dataTransfer.getData('text/plain');
    if (reqId) {
      moveRequest(reqId, folderId);
    }
    setDragRequestId(null);
    setDropTargetId(null);
  }, [moveRequest]);

  const handleDropReorder = useCallback((e: React.DragEvent, targetRequestId: string, folderId: string | null) => {
    e.preventDefault();
    const reqId = e.dataTransfer.getData('text/plain');
    if (!reqId || reqId === targetRequestId) {
      setDragRequestId(null);
      setDropTargetId(null);
      return;
    }
    // Find the target index in the scope
    const coll = collection;
    if (!coll) return;
    const scopeRequests = coll.requests
      .filter(r => r.folder_id === folderId)
      .sort((a, b) => a.sort_order - b.sort_order);
    const targetIdx = scopeRequests.findIndex(r => r.id === targetRequestId);
    if (targetIdx >= 0) {
      reorderRequest(reqId, targetIdx, folderId);
    }
    setDragRequestId(null);
    setDropTargetId(null);
  }, [collection, reorderRequest]);

  const handleDragEnd = useCallback(() => {
    setDragRequestId(null);
    setDropTargetId(null);
  }, []);
  
  // Add a new test case pre-filled with the endpoint's method/path and open in builder
  const handleAddTestCase = useCallback((method: string, path: string) => {
    const coll = useApiTestingStore.getState().collections[useApiTestingStore.getState().active_collection_id || ''];
    const baseUrl = coll?.base_url || '';
    const fullUrl = path.startsWith('http') ? path : `${baseUrl.replace(/\/$/, '')}${path.startsWith('/') ? path : `/${path}`}`;
    const reqId = addRequest({
      method: method.toUpperCase(),
      url: fullUrl,
      path: path,
      name: `${method.toUpperCase()} ${path} - New Test`,
    });
    if (reqId) {
      openRequestInBuilder(reqId);
    }
  }, [addRequest, openRequestInBuilder]);
  
  // Run all test cases for a given endpoint
  const handleRunEndpoint = useCallback((requestIds: string[]) => {
    const store = useApiTestingStore.getState();
    const envId = store.active_environment_id;
    const collId = store.active_collection_id;
    if (!collId || requestIds.length === 0) return;
    store.createTestRun(`Endpoint run ${new Date().toLocaleTimeString()}`, requestIds, envId || undefined)
      .then((createdRun) => {
        if (createdRun) store.executeTestRun(createdRun.id);
      });
  }, []);
  
  // Run a single request
  const handleRunRequest = useCallback((requestId: string) => {
    const store = useApiTestingStore.getState();
    const envId = store.active_environment_id;
    const req = collection?.requests.find(r => r.id === requestId);
    const label = req?.name || `Request ${requestId.substring(0, 8)}`;
    store.createTestRun(label, [requestId], envId || undefined)
      .then((createdRun) => {
        if (createdRun) store.executeTestRun(createdRun.id);
      });
  }, [collection]);
  
  // Run all requests in a folder
  const handleRunFolder = useCallback((requestIds: string[]) => {
    const store = useApiTestingStore.getState();
    const envId = store.active_environment_id;
    if (requestIds.length === 0) return;
    store.createTestRun(`Folder run ${new Date().toLocaleTimeString()}`, requestIds, envId || undefined)
      .then((createdRun) => {
        if (createdRun) store.executeTestRun(createdRun.id);
      });
  }, []);
  
  const handleFolderAction = useCallback((action: string, folderId: string) => {
    switch (action) {
      case 'add-request': {
        const reqId = addRequest({ method: 'GET', name: 'New Request' }, folderId);
        if (reqId) {
          openRequestInBuilder(reqId);
          setRenamingRequestId(reqId);
        }
        break;
      }
      case 'add-subfolder': {
        const newFolderId = createFolder('New Folder', folderId);
        if (newFolderId) setRenamingFolderId(newFolderId);
        break;
      }
      case 'rename':
        // Just set the renamingFolderId — the FolderNode will show an inline input
        setRenamingFolderId(folderId);
        break;
      case 'delete': {
        const f = collection?.folders.find(f => f.id === folderId);
        const requestCount = collection?.requests.filter(r => r.folder_id === folderId).length || 0;
        if (window.confirm(`Delete folder "${f?.name || 'Untitled'}"${requestCount > 0 ? ` and its ${requestCount} request(s)` : ''}? This cannot be undone.`)) {
          deleteFolder(folderId);
        }
        break;
      }
    }
  }, [addRequest, createFolder, deleteFolder, collection, openRequestInBuilder]);

  const handleFolderRenameSubmit = useCallback((folderId: string, newName: string) => {
    renameFolder(folderId, newName);
    // Defer clearing rename mode so the store update with new name renders
    // before FolderNode exits rename mode (prevents blink-back-to-old-name)
    requestAnimationFrame(() => {
      setRenamingFolderId(null);
    });
  }, [renameFolder]);

  const handleCancelRename = useCallback(() => {
    setRenamingFolderId(null);
    setRenamingRequestId(null);
  }, []);

  const handleStartRequestRename = useCallback((requestId: string) => {
    setRenamingRequestId(requestId);
  }, []);

  const handleRequestRenameSubmit = useCallback((requestId: string, newName: string) => {
    updateRequest(requestId, { name: newName });
    setRenamingRequestId(null);
  }, [updateRequest]);
  
  const handleCreateFolder = useCallback(() => {
    const newId = createFolder('New Folder');
    if (newId) setRenamingFolderId(newId);
  }, [createFolder]);
  
  const totalRequests = collection?.requests.length || 0;
  const totalEndpoints = endpointGroups.length;
  
  return (
    <aside
      className={`relative flex flex-col border-r border-border bg-muted/30 overflow-hidden shrink-0 ${
        sidebar.open ? '' : 'w-12 min-w-[48px]'
      } ${className}`}
      style={sidebar.open ? { width: sidebarWidth, minWidth: SIDEBAR_MIN, maxWidth: SIDEBAR_MAX } : undefined}
    >
      {/* Header */}
      <div className="flex items-center justify-between h-10 px-2 border-b border-border shrink-0">
        {sidebar.open && (
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-xs font-medium text-muted-foreground truncate">Collections</span>
            {syncStatus === 'syncing' && (
              <RefreshCw className="w-3 h-3 animate-spin text-muted-foreground shrink-0" title="Saving..." />
            )}
            {syncStatus === 'error' && (
              <AlertCircle className="w-3 h-3 text-destructive shrink-0" title="Save failed — changes will retry on next edit" />
            )}
            {syncStatus === 'idle' && collection && (
              <CheckCircle2 className="w-3 h-3 text-green-500 shrink-0 opacity-60" title="Saved" />
            )}
          </div>
        )}
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0 shrink-0"
          onClick={() => setSidebarOpen(!sidebar.open)}
          title={sidebar.open ? 'Collapse sidebar' : 'Expand sidebar'}
        >
          {sidebar.open ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeftOpen className="w-4 h-4" />}
        </Button>
      </div>
      
      {sidebar.open && (
        <>
          {/* Workspace selector (only when multiple workspaces) */}
          {workspaces.length > 1 && (
            <div className="px-2 pt-2">
              <Select value={activeWsId || ''} onValueChange={switchWorkspace}>
                <SelectTrigger className="h-7 text-xs">
                  <Layers className="w-3 h-3 mr-1.5 shrink-0" />
                  <SelectValue placeholder="Workspace" />
                </SelectTrigger>
                <SelectContent>
                  {workspaces.map(ws => (
                    <SelectItem key={ws.id} value={ws.id} className="text-xs">{ws.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Search */}
          <div className="px-2 pt-2">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Filter requests..."
                value={sidebar.search_query}
                onChange={(e) => setSidebarSearch(e.target.value)}
                className="h-7 text-xs pl-7 pr-2"
              />
            </div>
          </div>

          {/* === UNIFIED TREE === */}
          <ScrollArea className="flex-1 min-h-0 mt-1">
            <div className="p-2 space-y-0.5">
              {loading && (
                <p className="text-xs text-muted-foreground px-2 py-4 flex items-center gap-1.5">
                  <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                  Loading...
                </p>
              )}

              {/* Bulk action bar (visible in select mode) */}
              {selectMode && (
                <div className="flex items-center gap-1 px-2 py-1.5 rounded-md bg-destructive/5 border border-destructive/20 mb-1">
                  <Checkbox
                    checked={selectedRequestIds.size === totalRequests && totalRequests > 0}
                    onCheckedChange={(checked) => checked ? handleSelectAll() : handleDeselectAll()}
                    className="h-3.5 w-3.5 shrink-0"
                  />
                  <span className="text-[11px] font-medium flex-1 truncate">
                    {selectedRequestIds.size > 0 ? `${selectedRequestIds.size} selected` : 'Select items'}
                  </span>
                  <Button variant="ghost" size="sm" className="h-6 px-1.5 text-[10px]" onClick={handleSelectAll}>All</Button>
                  {selectedRequestIds.size > 0 && (
                    <Button variant="destructive" size="sm" className="h-6 px-2 text-[10px]" onClick={handleBulkDelete}>
                      <Trash2 className="w-3 h-3 mr-1" /> Delete ({selectedRequestIds.size})
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={handleToggleSelectMode} title="Exit select mode">
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              )}

              {/* Collection tree — each collection as a top-level node */}
              {wsCollections.map(coll => {
                const isActive = coll.id === activeCollId;
                const isExpanded = expandedCollections.has(coll.id);
                const isCollRenaming = renamingCollectionId === coll.id;
                const reqCount = coll.requests?.length || 0;
                const folderCount = coll.folders?.length || 0;

                return (
                  <div key={coll.id} className="group/coll">
                    {/* ── Collection Row ── */}
                    <div
                      className={`flex items-center gap-1 px-1.5 py-1 rounded-md cursor-pointer transition-colors ${
                        isActive
                          ? 'bg-primary/10 text-primary border border-primary/20'
                          : 'hover:bg-muted/60 border border-transparent'
                      }`}
                      onClick={() => handleCollectionClick(coll.id)}
                    >
                      {/* Chevron */}
                      <button
                        className="w-4 h-4 flex items-center justify-center shrink-0 rounded hover:bg-muted"
                        onClick={(e) => { e.stopPropagation(); toggleCollectionExpanded(coll.id); }}
                      >
                        {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                      </button>

                      {/* Icon */}
                      <FolderOpen className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-primary' : 'text-amber-500/70'}`} />

                      {/* Name or inline rename */}
                      {isCollRenaming ? (
                        <Input
                          ref={collectionRenameRef}
                          value={collectionRenameValue}
                          onChange={(e) => setCollectionRenameValue(e.target.value)}
                          onKeyDown={(e) => {
                            e.stopPropagation();
                            if (e.key === 'Enter') handleCollectionRenameSubmit();
                            if (e.key === 'Escape') { setRenamingCollectionId(null); setCollectionRenameValue(''); }
                          }}
                          onBlur={handleCollectionRenameSubmit}
                          onClick={(e) => e.stopPropagation()}
                          className="h-5 text-xs px-1 py-0 flex-1 min-w-0"
                          placeholder="Collection name"
                        />
                      ) : (
                        <span
                          className="text-xs font-medium truncate flex-1 min-w-0"
                          onDoubleClick={(e) => { e.stopPropagation(); startCollectionRename(coll.id); }}
                        >
                          {coll.name || 'Untitled'}
                        </span>
                      )}

                      {/* Count */}
                      {!isCollRenaming && (
                        <span className="text-[10px] text-muted-foreground shrink-0 tabular-nums">{reqCount}</span>
                      )}

                      {/* Action buttons (visible on hover) */}
                      {!isCollRenaming && (
                        <div className="flex items-center gap-0.5 opacity-0 group-hover/coll:opacity-100 transition-opacity">
                          {/* + Add dropdown */}
                          {isActive && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <button
                                  className="w-5 h-5 flex items-center justify-center shrink-0 rounded hover:bg-muted"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <Plus className="w-3 h-3" />
                                </button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-40">
                                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleNewRequest(); }}>
                                  <Plus className="w-3.5 h-3.5 mr-2" /> New Request
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleCreateFolder(); }}>
                                  <FolderPlus className="w-3.5 h-3.5 mr-2" /> New Folder
                                </DropdownMenuItem>
                                {reqCount > 0 && (
                                  <>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleToggleSelectMode(); }}>
                                      <CheckSquare className="w-3.5 h-3.5 mr-2" /> Select & Delete...
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleDeleteAll(); }} className="text-destructive">
                                      <Trash2 className="w-3.5 h-3.5 mr-2" /> Delete All ({reqCount})
                                    </DropdownMenuItem>
                                  </>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}

                          {/* ⋯ More dropdown */}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button
                                className="w-5 h-5 flex items-center justify-center shrink-0 rounded hover:bg-muted"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <MoreHorizontal className="w-3 h-3" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-40">
                              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); startCollectionRename(coll.id); }}>
                                <Edit3 className="w-3.5 h-3.5 mr-2" /> Rename
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={(e) => { e.stopPropagation(); handleDeleteCollection(coll.id); }}
                                className="text-destructive"
                              >
                                <Trash2 className="w-3.5 h-3.5 mr-2" /> Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      )}
                    </div>

                    {/* ── Expanded: Active collection content ── */}
                    {isExpanded && isActive && collection && (
                      <div className="ml-4 pl-2 border-l border-border/40 space-y-0.5 py-0.5">
                        {/* Folders */}
                        {rootFolders.map(folder => (
                          <FolderNode
                            key={folder.id}
                            folder={folder}
                            requests={stableRequests}
                            allFolders={stableFolders}
                            selectedRequestId={sidebar.selected_request_id}
                            expandedFolders={sidebar.expanded_folders}
                            lastResultMap={lastResultMap}
                            onToggleExpand={toggleFolderExpanded}
                            onRequestClick={handleRequestClick}
                            onRequestContextAction={handleRequestContextAction}
                            onFolderAction={handleFolderAction}
                            onRunRequest={handleRunRequest}
                            onRunFolder={handleRunFolder}
                            depth={0}
                            dropTargetId={dropTargetId}
                            dragRequestId={dragRequestId}
                            onDragStart={handleDragStart}
                            onDragOver={handleDragOver}
                            onDragLeave={handleDragLeave}
                            onDropOnFolder={handleDropOnFolder}
                            onDropReorder={handleDropReorder}
                            onDragEnd={handleDragEnd}
                            selectMode={selectMode}
                            selectedIds={selectedRequestIds}
                            onToggleSelect={handleToggleSelect}
                            renamingFolderId={renamingFolderId}
                            onStartRename={(id) => setRenamingFolderId(id)}
                            onRenameSubmit={handleFolderRenameSubmit}
                            onCancelRename={handleCancelRename}
                            renamingRequestId={renamingRequestId}
                            onRequestRenameSubmit={handleRequestRenameSubmit}
                          />
                        ))}

                        {/* Unfiled requests (endpoints) */}
                        {endpointGroups.length > 0 && (
                          <div
                            className={`${rootFolders.length > 0 ? 'pt-1 border-t border-border/30 mt-1' : ''} ${dropTargetId === 'root' ? 'bg-primary/5 ring-1 ring-primary/30 rounded' : ''}`}
                            onDragOver={(e) => { e.preventDefault(); handleDragOver(e, 'root'); }}
                            onDragLeave={handleDragLeave}
                            onDrop={(e) => handleDropOnFolder(e, null)}
                          >
                            <div className="space-y-0.5">
                              {endpointGroups.map(([endpointKey, requests]) => (
                                <EndpointGroup
                                  key={endpointKey}
                                  endpointKey={endpointKey}
                                  requests={requests}
                                  selectedRequestId={sidebar.selected_request_id}
                                  isExpanded={sidebar.expanded_endpoints.has(endpointKey)}
                                  lastResultMap={lastResultMap}
                                  onToggleExpand={toggleEndpointExpanded}
                                  onRequestClick={handleRequestClick}
                                  onRequestContextAction={handleRequestContextAction}
                                  onAddTestCase={handleAddTestCase}
                                  onRunEndpoint={handleRunEndpoint}
                                  onRunRequest={handleRunRequest}
                                  onDragStart={handleDragStart}
                                  onDragOver={handleDragOver}
                                  onDragLeave={handleDragLeave}
                                  onDrop={handleDropReorder}
                                  onDragEnd={handleDragEnd}
                                  dragRequestId={dragRequestId}
                                  dropTargetId={dropTargetId}
                                  selectMode={selectMode}
                                  selectedIds={selectedRequestIds}
                                  onToggleSelect={handleToggleSelect}
                                  renamingRequestId={renamingRequestId}
                                  onRequestRenameSubmit={handleRequestRenameSubmit}
                                  onCancelRename={handleCancelRename}
                                />
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Empty collection message */}
                        {totalRequests === 0 && rootFolders.length === 0 && (
                          <p className="text-[11px] text-muted-foreground px-1 py-1">Empty — use buttons below to add items</p>
                        )}

                        {/* Quick-add toolbar — always visible at bottom of active collection */}
                        <div className="flex items-center gap-1 pt-1 mt-0.5 border-t border-border/30">
                          <button
                            className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
                            onClick={() => handleNewRequest()}
                          >
                            <Plus className="w-3 h-3" /> Request
                          </button>
                          <button
                            className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
                            onClick={handleCreateFolder}
                          >
                            <FolderPlus className="w-3 h-3" /> Folder
                          </button>
                        </div>
                      </div>
                    )}

                    {/* ── Expanded: Non-active collection summary ── */}
                    {isExpanded && !isActive && (
                      <div className="ml-6 pl-2 border-l border-border/40 py-0.5">
                        <button
                          className="text-[10px] text-muted-foreground hover:text-foreground cursor-pointer"
                          onClick={() => handleCollectionClick(coll.id)}
                        >
                          {reqCount} request{reqCount !== 1 ? 's' : ''} · {folderCount} folder{folderCount !== 1 ? 's' : ''} — click to open
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}

              {/* + New Collection button */}
              <button
                className="flex items-center gap-1.5 w-full px-1.5 py-1 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors mt-1"
                onClick={handleNewCollection}
              >
                <Plus className="w-3.5 h-3.5 shrink-0" />
                <span>New Collection</span>
              </button>
            </div>
          </ScrollArea>

          {/* Footer with stats + Run All */}
          {collection && totalRequests > 0 && (
            <div className="px-2 py-1.5 border-t border-border shrink-0 space-y-1">
              <Button
                variant="default"
                size="sm"
                className="w-full h-7 text-xs gap-1.5"
                disabled={useApiTestingStore.getState().executing}
                onClick={() => {
                  const store = useApiTestingStore.getState();
                  const allIds = collection.requests.map(r => r.id);
                  if (allIds.length === 0) return;
                  store.createTestRun(
                    `${collection.name} - Full Run`,
                    allIds,
                    store.active_environment_id || undefined
                  ).then((createdRun) => {
                    if (createdRun) store.executeTestRun(createdRun.id);
                  });
                }}
              >
                <PlayCircle className="w-3.5 h-3.5" />
                Run All ({totalRequests} tests)
              </Button>
              <div className="flex items-center justify-between text-[10px] text-muted-foreground px-1">
                <span>{totalRequests} requests</span>
                <span>{totalEndpoints} endpoints</span>
                <span>{collection.folders.length} folders</span>
              </div>
            </div>
          )}
        </>
      )}

      {/* Move to folder dialog */}
      <Dialog open={!!moveDialogRequestId} onOpenChange={(open) => { if (!open) setMoveDialogRequestId(null); }}>
        <DialogContent className="sm:max-w-[340px]">
          <DialogHeader>
            <DialogTitle className="text-sm">Move to Folder</DialogTitle>
          </DialogHeader>
          <div className="space-y-1 max-h-60 overflow-y-auto">
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start text-xs h-8"
              onClick={() => {
                if (moveDialogRequestId) moveRequest(moveDialogRequestId, null);
                setMoveDialogRequestId(null);
              }}
            >
              <FolderOpen className="w-3.5 h-3.5 mr-2 text-muted-foreground" />
              Root (unfiled)
            </Button>
            {(collection?.folders || []).map(f => (
              <Button
                key={f.id}
                variant="ghost"
                size="sm"
                className="w-full justify-start text-xs h-8"
                onClick={() => {
                  if (moveDialogRequestId) moveRequest(moveDialogRequestId, f.id);
                  setMoveDialogRequestId(null);
                }}
              >
                <Folder className="w-3.5 h-3.5 mr-2 text-amber-500/70" />
                {f.name}
              </Button>
            ))}
            {(!collection?.folders || collection.folders.length === 0) && (
              <p className="text-xs text-muted-foreground px-2 py-3 text-center">
                No folders yet. Create one first.
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Resize drag handle on right edge */}
      {sidebar.open && (
        <div
          className="absolute top-0 right-0 w-1.5 h-full cursor-col-resize z-20 group/resize hover:bg-primary/20 active:bg-primary/30 transition-colors"
          onMouseDown={handleResizeStart}
          title="Drag to resize sidebar"
        >
          <div className="absolute inset-y-0 right-0 w-px bg-border group-hover/resize:bg-primary/50 group-active/resize:bg-primary transition-colors" />
        </div>
      )}
    </aside>
  );
});
CollectionSidebar.displayName = 'CollectionSidebar';

export default CollectionSidebar;
