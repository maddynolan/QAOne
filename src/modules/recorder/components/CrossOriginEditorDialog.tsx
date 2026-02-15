/**
 * Cross-Origin Step Editor Dialog
 * Allows users to define actions for cross-origin steps that couldn't
 * be automatically captured during recording.
 *
 * Extracted from PlaywrightRecorderPage.tsx (lines 7625-7893).
 */

import React from 'react';
import {
  AlertCircle, Plus, Trash2, Save,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import type { CrossOriginUserAction, RecordedAction } from '@/modules/recorder/types/recorder.types';

export interface CrossOriginEditorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  crossOriginUserActions: CrossOriginUserAction[];
  setCrossOriginUserActions: React.Dispatch<React.SetStateAction<CrossOriginUserAction[]>>;
  editingCrossOriginIndex: number | null;
  setEditingCrossOriginIndex: (v: number | null) => void;
  setActions: React.Dispatch<React.SetStateAction<RecordedAction[]>>;
}

export default function CrossOriginEditorDialog({
  open,
  onOpenChange,
  crossOriginUserActions,
  setCrossOriginUserActions,
  editingCrossOriginIndex,
  setEditingCrossOriginIndex,
  setActions,
}: CrossOriginEditorDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-foreground flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-yellow-500" />
            Edit Cross-Origin Actions
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="p-3 bg-yellow-500/10 rounded-lg border border-yellow-500/30">
            <p className="text-xs text-yellow-300">
              This step was recorded in an external tab where we couldn't capture actions automatically.
              Add selectors below to define what actions to perform during playback.
            </p>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium text-foreground">Actions</h4>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={() => {
                  setCrossOriginUserActions(prev => [...prev, {
                    id: `action_${Date.now()}`,
                    type: 'click',
                    findBy: 'text',
                    selector: '',
                    description: ''
                  }]);
                }}
              >
                <Plus className="h-3 w-3 mr-1" />
                Add Action
              </Button>
            </div>

            {crossOriginUserActions.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground border border-dashed rounded-lg">
                <p className="text-sm">No actions defined</p>
                <p className="text-xs mt-1">Click "Add Action" to define how to interact with elements</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
                {crossOriginUserActions.map((userAction, idx) => (
                  <div key={userAction.id} className="p-3 bg-secondary rounded-lg border border-border space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono text-muted-foreground">Action {idx + 1}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-muted-foreground hover:text-destructive"
                        onClick={() => {
                          setCrossOriginUserActions(prev => prev.filter((_, i) => i !== idx));
                        }}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs text-muted-foreground mb-1 block">Action Type</label>
                        <Select
                          value={userAction.type}
                          onValueChange={(v: any) => {
                            setCrossOriginUserActions(prev => prev.map((a, i) =>
                              i === idx ? { ...a, type: v } : a
                            ));
                          }}
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="click">Click</SelectItem>
                            <SelectItem value="fill">Fill / Type</SelectItem>
                            <SelectItem value="select">Select Option</SelectItem>
                            <SelectItem value="wait">Wait</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <label className="text-xs text-muted-foreground mb-1 block">Find By</label>
                        <Select
                          value={userAction.findBy}
                          onValueChange={(v: any) => {
                            setCrossOriginUserActions(prev => prev.map((a, i) =>
                              i === idx ? { ...a, findBy: v } : a
                            ));
                          }}
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="text">Text Content</SelectItem>
                            <SelectItem value="css">CSS Selector</SelectItem>
                            <SelectItem value="xpath">XPath</SelectItem>
                            <SelectItem value="testId">Test ID</SelectItem>
                            <SelectItem value="coords">Coordinates (x, y)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {userAction.findBy === 'coords' ? (
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs text-muted-foreground mb-1 block">X Position</label>
                          <Input
                            type="number"
                            value={userAction.coords?.x || ''}
                            onChange={(e) => {
                              setCrossOriginUserActions(prev => prev.map((a, i) =>
                                i === idx ? { ...a, coords: { x: parseInt(e.target.value) || 0, y: a.coords?.y || 0 } } : a
                              ));
                            }}
                            className="h-8 text-xs"
                            placeholder="450"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-muted-foreground mb-1 block">Y Position</label>
                          <Input
                            type="number"
                            value={userAction.coords?.y || ''}
                            onChange={(e) => {
                              setCrossOriginUserActions(prev => prev.map((a, i) =>
                                i === idx ? { ...a, coords: { x: a.coords?.x || 0, y: parseInt(e.target.value) || 0 } } : a
                              ));
                            }}
                            className="h-8 text-xs"
                            placeholder="320"
                          />
                        </div>
                      </div>
                    ) : (
                      <div>
                        <label className="text-xs text-muted-foreground mb-1 block">
                          {userAction.findBy === 'text' ? 'Text to find' :
                           userAction.findBy === 'css' ? 'CSS Selector' :
                           userAction.findBy === 'xpath' ? 'XPath Expression' :
                           'Test ID'}
                        </label>
                        <Input
                          value={userAction.selector}
                          onChange={(e) => {
                            setCrossOriginUserActions(prev => prev.map((a, i) =>
                              i === idx ? { ...a, selector: e.target.value } : a
                            ));
                          }}
                          className="h-8 text-xs font-mono"
                          placeholder={
                            userAction.findBy === 'text' ? 'Click here for more info' :
                            userAction.findBy === 'css' ? 'button.submit-btn, #login' :
                            userAction.findBy === 'xpath' ? '//button[@id="submit"]' :
                            'submit-button'
                          }
                        />
                      </div>
                    )}

                    {userAction.type === 'fill' && (
                      <div>
                        <label className="text-xs text-muted-foreground mb-1 block">Value to Type</label>
                        <Input
                          value={userAction.value || ''}
                          onChange={(e) => {
                            setCrossOriginUserActions(prev => prev.map((a, i) =>
                              i === idx ? { ...a, value: e.target.value } : a
                            ));
                          }}
                          className="h-8 text-xs"
                          placeholder="Enter value to type..."
                        />
                      </div>
                    )}

                    {userAction.type === 'wait' && (
                      <div>
                        <label className="text-xs text-muted-foreground mb-1 block">Wait Duration (ms)</label>
                        <Input
                          type="number"
                          value={userAction.value || '2000'}
                          onChange={(e) => {
                            setCrossOriginUserActions(prev => prev.map((a, i) =>
                              i === idx ? { ...a, value: e.target.value } : a
                            ));
                          }}
                          className="h-8 text-xs"
                          placeholder="2000"
                        />
                      </div>
                    )}

                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">Description (optional)</label>
                      <Input
                        value={userAction.description || ''}
                        onChange={(e) => {
                          setCrossOriginUserActions(prev => prev.map((a, i) =>
                            i === idx ? { ...a, description: e.target.value } : a
                          ));
                        }}
                        className="h-8 text-xs"
                        placeholder="Click the login button"
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              onOpenChange(false);
              setEditingCrossOriginIndex(null);
              setCrossOriginUserActions([]);
            }}
            className="border-border text-foreground"
          >
            Cancel
          </Button>
          <Button
            onClick={() => {
              if (editingCrossOriginIndex !== null) {
                setActions(prev => prev.map((action, idx) => {
                  if (idx === editingCrossOriginIndex) {
                    return {
                      ...action,
                      userActions: crossOriginUserActions,
                      description: crossOriginUserActions.length > 0
                        ? `Cross-origin: ${crossOriginUserActions.length} action(s) defined`
                        : action.description
                    };
                  }
                  return action;
                }));
                toast.success(`Saved ${crossOriginUserActions.length} action(s) for cross-origin step`);
              }
              onOpenChange(false);
              setEditingCrossOriginIndex(null);
              setCrossOriginUserActions([]);
            }}
            className="bg-yellow-600 hover:bg-yellow-700"
          >
            <Save className="h-4 w-4 mr-2" />
            Save Actions
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
