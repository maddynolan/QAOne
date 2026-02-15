/**
 * TreeItem - Recursive folder/test tree renderer
 *
 * Renders a single node in the test repository tree with support for:
 * - Drag-and-drop reordering
 * - Context menu (rename, delete, duplicate)
 * - Expand/collapse for folders
 * - Status indicators for test cases
 */

import React, { useState, useEffect } from 'react';
import {
  Folder, FolderOpen, FileText, ChevronRight, ChevronDown,
  MoreVertical, Copy, GripVertical, CheckCircle, AlertCircle,
  Clock, Zap, Star, Pencil, Trash2
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { TreeNode, TreeItemProps, TestCase, TestFolder } from '../types/test-repository.types';

export function TreeItem({
  node,
  selectedId,
  onSelect,
  onToggle,
  onDragStart,
  onDragOver,
  onDrop,
  expandedFolders,
  onRename,
  onDelete,
  onDuplicate,
  testCases = []
}: TreeItemProps) {
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [contextMenuPos, setContextMenuPos] = useState({ x: 0, y: 0 });
  const isExpanded = expandedFolders.has(node.id);
  const isSelected = selectedId === node.id;
  const hasChildren = node.type === 'folder' && node.children && node.children.length > 0;

  const testCase = node.type === 'test' ? node.data as TestCase : null;
  const folder = node.type === 'folder' ? node.data as TestFolder : null;
  const isRootFolder = node.id === 'root';

  // Calculate folder test count from testCases state (accurate count)
  const folderTestCount = node.type === 'folder'
    ? testCases.filter(tc => tc.folderId === node.id || (node.id === 'root' && !tc.folderId)).length
    : 0;

  // Close context menu when clicking outside
  useEffect(() => {
    const handleClickOutside = () => setShowContextMenu(false);
    if (showContextMenu) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [showContextMenu]);

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenuPos({ x: e.clientX, y: e.clientY });
    setShowContextMenu(true);
  };

  const getStatusIcon = () => {
    if (!testCase) return null;
    switch (testCase.lastResult) {
      case 'passed': return <CheckCircle className="w-3.5 h-3.5 text-green-500" />;
      case 'failed': return <AlertCircle className="w-3.5 h-3.5 text-red-500" />;
      default: return <Clock className="w-3.5 h-3.5 text-muted-foreground" />;
    }
  };

  return (
    <div className="relative">
      <div
        draggable
        onDragStart={(e) => onDragStart(e, node)}
        onDragOver={onDragOver}
        onDrop={(e) => onDrop(e, node)}
        onClick={() => onSelect(node)}
        onContextMenu={handleContextMenu}
        className={cn(
          "flex items-center gap-1 px-2 py-1.5 rounded-md cursor-pointer transition-colors group",
          isSelected
            ? "bg-primary/20 text-primary"
            : "hover:bg-accent text-foreground",
          "select-none"
        )}
        style={{ paddingLeft: `${node.depth * 16 + 8}px` }}
      >
        {/* Expand/Collapse */}
        {node.type === 'folder' ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggle(node.id);
            }}
            className="p-0.5 hover:bg-accent rounded"
          >
            {hasChildren ? (
              isExpanded ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )
            ) : (
              <span className="w-4 h-4" />
            )}
          </button>
        ) : (
          <span className="w-5" />
        )}

        {/* Icon */}
        {node.type === 'folder' ? (
          isExpanded ? (
            <FolderOpen className="w-4 h-4 text-primary" />
          ) : (
            <Folder className="w-4 h-4 text-primary" />
          )
        ) : (
          <FileText className="w-4 h-4 text-muted-foreground" />
        )}

        {/* Name */}
        <span className="flex-1 truncate text-sm">{node.name}</span>

        {/* Test case indicators */}
        {testCase && (
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {getStatusIcon()}
            {testCase.automationStatus === 'full' && (
              <Zap className="w-3.5 h-3.5 text-blue-400" />
            )}
            {testCase.starred && (
              <Star className="w-3.5 h-3.5 text-yellow-400 fill-yellow-400" />
            )}
          </div>
        )}

        {/* Folder count badge */}
        {node.type === 'folder' && (
          <Badge className="h-5 px-1.5 text-xs bg-secondary text-muted-foreground opacity-0 group-hover:opacity-100">
            {folderTestCount}
          </Badge>
        )}

        {/* Drag handle and menu button */}
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100">
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleContextMenu(e);
            }}
            className="p-0.5 hover:bg-accent rounded"
          >
            <MoreVertical className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
          <GripVertical className="w-3.5 h-3.5 text-muted-foreground cursor-grab" />
        </div>
      </div>

      {/* Context Menu */}
      {showContextMenu && (
        <div
          className="fixed z-50 bg-popover border border-border rounded-lg shadow-xl py-1 min-w-[160px]"
          style={{ left: contextMenuPos.x, top: contextMenuPos.y }}
          onClick={(e) => e.stopPropagation()}
        >
          {node.type === 'folder' ? (
            <>
              <button
                onClick={() => {
                  onRename?.(node);
                  setShowContextMenu(false);
                }}
                disabled={isRootFolder}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Pencil className="w-4 h-4" />
                Rename Folder
              </button>
              <button
                onClick={() => {
                  onDelete?.(node);
                  setShowContextMenu(false);
                }}
                disabled={isRootFolder}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-destructive hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Trash2 className="w-4 h-4" />
                Delete Folder
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => {
                  onRename?.(node);
                  setShowContextMenu(false);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-accent"
              >
                <Pencil className="w-4 h-4" />
                Rename Test
              </button>
              <button
                onClick={() => {
                  onDuplicate?.(node);
                  setShowContextMenu(false);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-accent"
              >
                <Copy className="w-4 h-4" />
                Duplicate Test
              </button>
              <div className="border-t border-border my-1" />
              <button
                onClick={() => {
                  onDelete?.(node);
                  setShowContextMenu(false);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-destructive hover:bg-accent"
              >
                <Trash2 className="w-4 h-4" />
                Delete Test
              </button>
            </>
          )}
        </div>
      )}

      {/* Children */}
      {node.type === 'folder' && isExpanded && node.children && (
        <div>
          {node.children.map((child) => (
            <TreeItem
              key={child.id}
              node={child}
              selectedId={selectedId}
              onSelect={onSelect}
              onToggle={onToggle}
              onDragStart={onDragStart}
              onDragOver={onDragOver}
              onDrop={onDrop}
              onContextMenu={() => {}}
              expandedFolders={expandedFolders}
              onRename={onRename}
              onDelete={onDelete}
              onDuplicate={onDuplicate}
              testCases={testCases}
            />
          ))}
        </div>
      )}
    </div>
  );
}
