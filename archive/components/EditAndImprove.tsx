import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Edit } from 'lucide-react';
import { toast } from 'sonner';

interface EditAndImproveProps {
  generationId: string | null;
  originalOutput: string;
  onCorrected?: () => void;
}

export function EditAndImprove({ generationId, originalOutput, onCorrected }: EditAndImproveProps) {
  const [correctedOutput, setCorrectedOutput] = useState(originalOutput);
  const [feedback, setFeedback] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showDialog, setShowDialog] = useState(false);

  if (!generationId) {
    return null;
  }

  const handleSubmit = async () => {
    if (!correctedOutput.trim()) {
      toast.error('Please provide corrected output');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch(`http://localhost:8000/ai/generations/${generationId}/correct`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          corrected_output: correctedOutput,
          feedback: feedback || null
        })
      });

      if (!response.ok) {
        throw new Error('Failed to submit correction');
      }

      toast.success('Correction saved! This helps train a better model.');
      setShowDialog(false);
      setFeedback('');
      onCorrected?.();
    } catch (error: any) {
      toast.error(`Failed to submit correction: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => {
          setCorrectedOutput(originalOutput);
          setShowDialog(true);
        }}
        className="gap-2"
      >
        <Edit className="h-4 w-4" />
        Edit & Improve
      </Button>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit & Improve Generated Output</DialogTitle>
            <DialogDescription>
              Make corrections to improve the generated output. Your corrections will be used to train a better model.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Original Output */}
            <div>
              <label className="text-sm font-medium mb-2 block">Original Output</label>
              <div className="p-3 bg-muted rounded-md text-sm font-mono max-h-40 overflow-y-auto">
                {originalOutput}
              </div>
            </div>

            {/* Corrected Output */}
            <div>
              <label className="text-sm font-medium mb-2 block">
                Corrected Output <span className="text-red-500">*</span>
              </label>
              <Textarea
                value={correctedOutput}
                onChange={(e) => setCorrectedOutput(e.target.value)}
                rows={15}
                className="font-mono text-sm"
                placeholder="Edit the output with your corrections..."
              />
            </div>

            {/* Feedback */}
            <div>
              <label className="text-sm font-medium mb-2 block">
                Feedback (Optional)
              </label>
              <Textarea
                placeholder="What was wrong? What improvements did you make?"
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={isSubmitting || !correctedOutput.trim()}>
              {isSubmitting ? 'Submitting...' : 'Save Correction'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}


