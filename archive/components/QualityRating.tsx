import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Star } from 'lucide-react';
import { toast } from 'sonner';

interface QualityRatingProps {
  generationId: string | null;
  onRated?: () => void;
}

export function QualityRating({ generationId, onRated }: QualityRatingProps) {
  const [rating, setRating] = useState<number>(0);
  const [hoveredRating, setHoveredRating] = useState<number>(0);
  const [feedback, setFeedback] = useState('');
  const [isApproved, setIsApproved] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showDialog, setShowDialog] = useState(false);

  if (!generationId) {
    return null;
  }

  const handleSubmit = async () => {
    if (rating === 0) {
      toast.error('Please select a rating');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch(`http://localhost:8000/ai/generations/${generationId}/rate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quality_score: rating,
          feedback: feedback || null,
          is_approved: isApproved || rating >= 4
        })
      });

      if (!response.ok) {
        throw new Error('Failed to submit rating');
      }

      toast.success('Thank you for your feedback! This helps improve the AI.');
      setShowDialog(false);
      setRating(0);
      setFeedback('');
      setIsApproved(false);
      onRated?.();
    } catch (error: any) {
      toast.error(`Failed to submit rating: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setShowDialog(true)}
        className="gap-2"
      >
        <Star className="h-4 w-4" />
        Rate Quality
      </Button>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rate Generation Quality</DialogTitle>
            <DialogDescription>
              Your feedback helps improve the AI model. Rate the quality of the generated test cases.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Star Rating */}
            <div>
              <label className="text-sm font-medium mb-2 block">Quality Rating</label>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setRating(star)}
                    onMouseEnter={() => setHoveredRating(star)}
                    onMouseLeave={() => setHoveredRating(0)}
                    className="p-1 rounded hover:bg-accent transition-colors"
                  >
                    <Star
                      className={`h-8 w-8 ${
                        star <= (hoveredRating || rating)
                          ? 'fill-yellow-400 text-yellow-400'
                          : 'text-gray-300'
                      }`}
                    />
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {rating === 0 && 'Select a rating'}
                {rating === 1 && '⭐ Poor - Needs significant improvement'}
                {rating === 2 && '⭐⭐ Fair - Needs improvement'}
                {rating === 3 && '⭐⭐⭐ Good - Acceptable quality'}
                {rating === 4 && '⭐⭐⭐⭐ Very Good - High quality'}
                {rating === 5 && '⭐⭐⭐⭐⭐ Excellent - Perfect quality'}
              </p>
            </div>

            {/* Feedback */}
            <div>
              <label className="text-sm font-medium mb-2 block">
                Feedback (Optional)
              </label>
              <Textarea
                placeholder="What did you like or what could be improved?"
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                rows={3}
              />
            </div>

            {/* Approval Checkbox */}
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="approve"
                checked={isApproved}
                onChange={(e) => setIsApproved(e.target.checked)}
                className="rounded border-gray-300"
              />
              <label htmlFor="approve" className="text-sm">
                Approve this generation for training (recommended for ratings 4-5)
              </label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={isSubmitting || rating === 0}>
              {isSubmitting ? 'Submitting...' : 'Submit Rating'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}


