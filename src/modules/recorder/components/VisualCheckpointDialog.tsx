/**
 * Visual Checkpoint Dialog
 * Captures a visual baseline screenshot for visual regression testing.
 *
 * Extracted from PlaywrightRecorderPage.tsx (lines 7553-7623).
 */

import React from 'react';
import { Eye, CheckCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';

export interface VisualCheckpointDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentUrl: string;
  visualBaselineName: string;
  setVisualBaselineName: (v: string) => void;
  isCapturingVisual: boolean;
  handleConfirmVisualCapture: () => void;
}

export default function VisualCheckpointDialog({
  open,
  onOpenChange,
  currentUrl,
  visualBaselineName,
  setVisualBaselineName,
  isCapturingVisual,
  handleConfirmVisualCapture,
}: VisualCheckpointDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-foreground flex items-center gap-2">
            <Eye className="h-5 w-5 text-violet-400" />
            Capture Visual Checkpoint
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="p-3 bg-violet-500/10 rounded-lg border border-violet-500/30">
            <p className="text-xs text-violet-700 dark:text-violet-300 mb-1">Current Page</p>
            <p className="text-sm text-foreground truncate">{currentUrl}</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="baseline-name" className="text-foreground">Baseline Name</Label>
            <Input
              id="baseline-name"
              value={visualBaselineName}
              onChange={(e) => setVisualBaselineName(e.target.value)}
              placeholder="e.g., login_page_hero"
              className="bg-secondary border-border text-foreground"
            />
            <p className="text-xs text-muted-foreground">
              This name will be used to reference this baseline in visual regression tests
            </p>
          </div>

          <div className="p-3 bg-muted rounded-lg space-y-2">
            <p className="text-xs font-medium text-foreground">What happens next:</p>
            <ul className="text-xs text-muted-foreground space-y-1">
              <li className="flex items-center gap-2">
                <CheckCircle className="h-3 w-3 text-emerald-400" />
                Screenshot captured and saved as baseline
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="h-3 w-3 text-emerald-400" />
                Visual check step added to your recording
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="h-3 w-3 text-emerald-400" />
                Future test runs will compare against this baseline
              </li>
            </ul>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="border-border text-foreground"
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirmVisualCapture}
            disabled={!visualBaselineName.trim() || isCapturingVisual}
            className="bg-violet-600 hover:bg-violet-700"
          >
            {isCapturingVisual ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Eye className="h-4 w-4 mr-2" />
            )}
            Capture Baseline
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
