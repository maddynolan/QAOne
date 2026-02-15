/**
 * Column customization dialog for ProjectManagement.
 */
import React, { useState } from 'react';
import { Columns, GripVertical, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '@/components/ui/dialog';
import type { BoardColumn } from '../../types/project-management-types';

export const ColumnCustomizer: React.FC<{
  columns: BoardColumn[];
  onSave: (columns: BoardColumn[]) => void;
  open: boolean;
  onClose: () => void;
}> = ({ columns, onSave, open, onClose }) => {
  const [editedColumns, setEditedColumns] = useState<BoardColumn[]>(columns);
  const [newColumnName, setNewColumnName] = useState('');

  const addColumn = () => {
    if (!newColumnName.trim()) return;
    const newCol: BoardColumn = {
      id: newColumnName.toLowerCase().replace(/\s+/g, '_'),
      name: newColumnName,
      color: '#6366f1',
    };
    setEditedColumns([...editedColumns, newCol]);
    setNewColumnName('');
  };

  const [draggedCol, setDraggedCol] = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);

  const removeColumn = (id: string) => {
    setEditedColumns(editedColumns.filter(c => c.id !== id));
  };

  const updateColumn = (id: string, updates: Partial<BoardColumn>) => {
    setEditedColumns(editedColumns.map(c => c.id === id ? { ...c, ...updates } : c));
  };

  const handleColDragStart = (e: React.DragEvent, colId: string) => {
    setDraggedCol(colId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleColDragOver = (e: React.DragEvent, colId: string) => {
    e.preventDefault();
    if (colId !== draggedCol) setDragOverCol(colId);
  };

  const handleColDragEnd = () => {
    if (draggedCol && dragOverCol && draggedCol !== dragOverCol) {
      const cols = [...editedColumns];
      const dragIdx = cols.findIndex(c => c.id === draggedCol);
      const dropIdx = cols.findIndex(c => c.id === dragOverCol);
      if (dragIdx !== -1 && dropIdx !== -1) {
        const [removed] = cols.splice(dragIdx, 1);
        cols.splice(dropIdx, 0, removed);
        setEditedColumns(cols);
      }
    }
    setDraggedCol(null);
    setDragOverCol(null);
  };

  const colors = ['#6366f1', '#ec4899', '#22c55e', '#f59e0b', '#06b6d4', '#8b5cf6', '#ef4444', '#64748b'];

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Columns className="w-5 h-5" />
            Customize Columns
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Existing columns */}
          <div className="space-y-2">
            {editedColumns.map((col, index) => (
              <div
                key={col.id}
                draggable
                onDragStart={(e) => handleColDragStart(e, col.id)}
                onDragOver={(e) => handleColDragOver(e, col.id)}
                onDragEnd={handleColDragEnd}
                onDragLeave={() => setDragOverCol(null)}
                className={`flex items-center gap-2 p-2 rounded-lg cursor-move transition-all ${
                  draggedCol === col.id ? 'opacity-50 bg-primary/20 border border-primary' :
                  dragOverCol === col.id ? 'bg-primary/10 border border-dashed border-primary' :
                  'bg-muted/50 hover:bg-muted'
                }`}
              >
                <GripVertical className="w-4 h-4 text-muted-foreground" />
                <div
                  className="w-4 h-4 rounded-full cursor-pointer"
                  style={{ backgroundColor: col.color }}
                />
                <Input
                  value={col.name}
                  onChange={(e) => updateColumn(col.id, { name: e.target.value })}
                  className="flex-1 h-8"
                />
                <Input
                  type="number"
                  placeholder="WIP"
                  value={col.wipLimit || ''}
                  onChange={(e) => updateColumn(col.id, { wipLimit: parseInt(e.target.value) || undefined })}
                  className="w-16 h-8"
                />
                {!col.isDefault && (
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeColumn(col.id)}>
                    <X className="w-4 h-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>

          {/* Add new column */}
          <div className="flex items-center gap-2">
            <Input
              placeholder="New column name..."
              value={newColumnName}
              onChange={(e) => setNewColumnName(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && addColumn()}
            />
            <Button onClick={addColumn} disabled={!newColumnName.trim()}>
              <Plus className="w-4 h-4 mr-1" />
              Add
            </Button>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => { onSave(editedColumns); onClose(); }}>Save Changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
