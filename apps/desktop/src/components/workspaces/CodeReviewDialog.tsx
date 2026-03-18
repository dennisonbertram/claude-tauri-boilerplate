import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';

interface CodeReviewDialogProps {
  isOpen: boolean;
  initialPrompt: string;
  model: string;
  effort: 'low' | 'medium' | 'high' | 'max';
  onClose: () => void;
  onStartReview: (prompt: string, model: string, effort: 'low' | 'medium' | 'high' | 'max') => void;
}

export function CodeReviewDialog({
  isOpen,
  initialPrompt,
  model,
  effort,
  onClose,
  onStartReview,
}: CodeReviewDialogProps) {
  const [prompt, setPrompt] = useState(initialPrompt);
  const [selectedModel, setSelectedModel] = useState(model);
  const [selectedEffort, setSelectedEffort] = useState<'low' | 'medium' | 'high' | 'max'>(effort);

  // Reset fields when dialog opens
  useEffect(() => {
    if (isOpen) {
      setPrompt(initialPrompt);
      setSelectedModel(model);
      setSelectedEffort(effort);
    }
  }, [isOpen, initialPrompt, model, effort]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!isOpen) return null;

  const handleStartReview = () => {
    onStartReview(prompt.trim() || initialPrompt, selectedModel, selectedEffort);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-lg border border-border bg-popover p-6 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold text-foreground">AI Code Review</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Edit the review prompt and settings before starting the review.
        </p>

        <div className="mt-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Review Prompt
            </label>
            <textarea
              data-testid="code-review-dialog-prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={8}
              className="w-full rounded-lg border border-input bg-background px-2.5 py-2 text-sm font-mono outline-none resize-y focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              placeholder="Enter the review prompt..."
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Model</label>
              <input
                data-testid="code-review-dialog-model"
                type="text"
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                className="h-8 w-full rounded-lg border border-input bg-background px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Effort
              </label>
              <select
                data-testid="code-review-dialog-effort"
                value={selectedEffort}
                onChange={(e) =>
                  setSelectedEffort(e.target.value as 'low' | 'medium' | 'high' | 'max')
                }
                className="h-8 w-full rounded-lg border border-input bg-background px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="max">Max</option>
              </select>
            </div>
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleStartReview}>Start Review</Button>
        </div>
      </div>
    </div>
  );
}
