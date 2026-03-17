import { useState } from 'react';
import {
  ClipboardList,
  Check,
  X,
  MessageSquare,
  ChevronDown,
  ChevronRight,
  Loader2,
  Copy,
  Share2,
  ArrowRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { PlanState, PlanStatus } from '@/hooks/useStreamEvents';

interface PlanViewProps {
  plan: PlanState;
  savedPath?: string | null;
  onApprove: (feedback?: string) => void;
  onReject: (feedback?: string) => void;
  onSendInput: (feedback: string) => void;
  onCopy: () => void;
  onExportToNewChat: () => void;
  onHandoff: () => void;
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

export function PlanView({
  plan,
  savedPath,
  onApprove,
  onReject,
  onSendInput,
  onCopy,
  onExportToNewChat,
  onHandoff,
}: PlanViewProps) {
  const [inputMode, setInputMode] = useState<'approve' | 'reject' | 'input' | null>(null);
  const [feedback, setFeedback] = useState('');
  const [isCollapsed, setIsCollapsed] = useState(plan.status === 'approved');

  const handleConfirmInput = () => {
    if (inputMode === 'approve') {
      onApprove(feedback);
    } else if (inputMode === 'reject') {
      onReject(feedback);
    } else if (inputMode === 'input') {
      onSendInput(feedback);
    }
    setInputMode(null);
    setFeedback('');
  };

  const handleCancelInput = () => {
    setInputMode(null);
    setFeedback('');
  };

  const isReviewState = plan.status === 'review';
  const isTerminalState = plan.status === 'approved' || plan.status === 'rejected';
  const showContent = isTerminalState ? !isCollapsed : true;
  const isInputState = inputMode !== null;
  const inputPlaceholder =
    inputMode === 'approve'
      ? 'Approval notes (optional)'
      : inputMode === 'reject'
        ? 'Feedback for changes (optional)'
        : 'Answer Claude or provide clarifying input';
  const confirmLabel =
    inputMode === 'approve'
      ? 'Approve with feedback'
      : inputMode === 'reject'
        ? 'Confirm Reject'
        : 'Send Input';

  return (
    <div
      data-testid="plan-view"
      className={`my-2 rounded-lg border-2 border-purple-400/50 bg-purple-950/20 text-sm overflow-hidden`}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border/50">
        {isInputState ? (
          <MessageSquare className="h-4 w-4 text-amber-400" />
        ) : plan.status === 'planning' ? (
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
          {isInputState ? 'User Input Required' : statusLabels[plan.status]}
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

      {savedPath && (
        <div className="px-3 pb-2 text-xs text-muted-foreground">
          Saved to <span className="font-mono">{savedPath}</span>
        </div>
      )}

      {/* Actions - only in review state */}
      {isReviewState && !isInputState && (
        <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 border-t border-border/50">
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="ghost" size="sm" onClick={onCopy}>
              <Copy className="mr-1 h-3.5 w-3.5" />
              Copy
            </Button>
            <Button variant="ghost" size="sm" onClick={onExportToNewChat}>
              <ArrowRight className="mr-1 h-3.5 w-3.5" />
              Export to New Chat
            </Button>
            <Button variant="ghost" size="sm" onClick={onHandoff}>
              <Share2 className="mr-1 h-3.5 w-3.5" />
              Handoff
            </Button>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setInputMode('input')}>
              Provide Input
            </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setInputMode('reject')}
          >
            Reject
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setInputMode('approve')}
          >
            Approve with Feedback
          </Button>
          <Button size="sm" onClick={onApprove}>
            Approve
          </Button>
          </div>
        </div>
      )}

      {/* Feedback input for approval, rejection, or clarifying user input */}
      {isReviewState && isInputState && (
        <div className="px-3 py-2 border-t border-border/50 space-y-2">
          <input
            type="text"
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            placeholder={inputPlaceholder}
            className="w-full bg-muted rounded px-2 py-1.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-purple-400/50"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleConfirmInput();
              if (e.key === 'Escape') handleCancelInput();
            }}
          />
          <div className="flex items-center justify-end gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCancelInput}
            >
              Cancel
            </Button>
            <Button
              variant={inputMode === 'reject' ? 'destructive' : 'default'}
              size="sm"
              onClick={handleConfirmInput}
            >
              {confirmLabel}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
