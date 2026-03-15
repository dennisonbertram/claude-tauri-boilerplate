import { useState } from 'react';
import {
  ClipboardList,
  Check,
  X,
  ChevronDown,
  ChevronRight,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { PlanState, PlanStatus } from '@/hooks/useStreamEvents';

interface PlanViewProps {
  plan: PlanState;
  onApprove: () => void;
  onReject: (feedback?: string) => void;
}

const statusLabels: Record<PlanStatus, string> = {
  idle: '',
  planning: 'Planning...',
  review: 'Review Plan',
  approved: 'Plan Approved',
  rejected: 'Plan Rejected',
};

const statusColorClass: Record<PlanStatus, string> = {
  idle: '',
  planning: 'text-blue-400',
  review: 'text-purple-400',
  approved: 'text-green-400',
  rejected: 'text-red-400',
};

export function PlanView({ plan, onApprove, onReject }: PlanViewProps) {
  const [showFeedbackInput, setShowFeedbackInput] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [isCollapsed, setIsCollapsed] = useState(plan.status === 'approved');

  const handleRejectClick = () => {
    setShowFeedbackInput(true);
  };

  const handleConfirmReject = () => {
    onReject(feedback);
    setShowFeedbackInput(false);
    setFeedback('');
  };

  const handleCancelReject = () => {
    setShowFeedbackInput(false);
    setFeedback('');
  };

  const isReviewState = plan.status === 'review';
  const isTerminalState = plan.status === 'approved' || plan.status === 'rejected';
  const showContent = isTerminalState ? !isCollapsed : true;

  return (
    <div
      data-testid="plan-view"
      className={`my-2 rounded-lg border-2 border-purple-400/50 bg-purple-950/20 text-sm overflow-hidden`}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border/50">
        {plan.status === 'planning' ? (
          <Loader2 className="h-4 w-4 text-blue-400 animate-spin" />
        ) : plan.status === 'approved' ? (
          <Check className="h-4 w-4 text-green-400" />
        ) : plan.status === 'rejected' ? (
          <X className="h-4 w-4 text-red-400" />
        ) : (
          <ClipboardList className="h-4 w-4 text-purple-400" />
        )}
        <span
          data-testid="plan-status"
          className={`font-medium ${statusColorClass[plan.status]}`}
        >
          {statusLabels[plan.status]}
        </span>

        {/* Toggle button for collapsed states */}
        {isTerminalState && (
          <button
            data-testid="plan-toggle"
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="ml-auto p-1 rounded hover:bg-muted/50 text-muted-foreground"
            aria-label={isCollapsed ? 'Expand plan' : 'Collapse plan'}
          >
            {isCollapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </button>
        )}
      </div>

      {/* Plan content */}
      {showContent && (
        <div
          data-testid="plan-content"
          className="px-3 py-2 text-foreground whitespace-pre-wrap"
        >
          {plan.content}
          {plan.status === 'planning' && (
            <span className="inline-block w-1.5 h-4 bg-blue-400 animate-pulse ml-0.5 align-text-bottom" />
          )}
        </div>
      )}

      {/* Actions - only in review state */}
      {isReviewState && !showFeedbackInput && (
        <div className="flex items-center justify-end gap-2 px-3 py-2 border-t border-border/50">
          <Button
            variant="destructive"
            size="sm"
            onClick={handleRejectClick}
          >
            Reject
          </Button>
          <Button size="sm" onClick={onApprove}>
            Approve
          </Button>
        </div>
      )}

      {/* Feedback input for rejection */}
      {isReviewState && showFeedbackInput && (
        <div className="px-3 py-2 border-t border-border/50 space-y-2">
          <input
            type="text"
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            placeholder="Feedback (optional)"
            className="w-full bg-muted rounded px-2 py-1.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-purple-400/50"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleConfirmReject();
              if (e.key === 'Escape') handleCancelReject();
            }}
          />
          <div className="flex items-center justify-end gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCancelReject}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleConfirmReject}
            >
              Confirm Reject
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
