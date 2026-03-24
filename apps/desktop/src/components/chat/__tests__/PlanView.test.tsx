import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PlanView } from '../PlanView';
import type { PlanState } from '@/hooks/useStreamEvents';

function renderPlan(
  overrides: Partial<PlanState> = {},
  handlers: {
    onApprove?: (feedback?: string) => void;
    onReject?: (feedback?: string) => void;
    onSendInput?: (feedback: string) => void;
  } = {}
) {
  const defaults: PlanState = {
    planId: 'plan-1',
    status: 'review',
    content: '## Plan\n\n1. Read the file\n2. Edit the file\n3. Run tests',
    ...overrides,
  };
  return render(
    <PlanView
      plan={defaults}
      savedPath={null}
      onApprove={handlers.onApprove ?? vi.fn()}
      onReject={handlers.onReject ?? vi.fn()}
      onSendInput={handlers.onSendInput ?? vi.fn()}
      onCopy={vi.fn()}
      onExportToNewChat={vi.fn()}
      onHandoff={vi.fn()}
    />
  );
}

describe('PlanView', () => {
  // -- Content Rendering --

  describe('Content rendering', () => {
    it('renders plan content', () => {
      renderPlan({ content: 'Step 1: Do the thing' });
      expect(screen.getByTestId('plan-content')).toHaveTextContent(
        'Step 1: Do the thing'
      );
    });

    it('renders streaming content during planning phase', () => {
      renderPlan({
        status: 'planning',
        content: 'Analyzing the codebase...',
      });
      expect(screen.getByTestId('plan-content')).toHaveTextContent(
        'Analyzing the codebase...'
      );
    });

    it('renders empty content when plan is just starting', () => {
      renderPlan({ status: 'planning', content: '' });
      expect(screen.getByTestId('plan-content')).toBeInTheDocument();
    });
  });

  // -- Status Indicators --

  describe('Status indicators', () => {
    it('shows "Planning..." during planning phase', () => {
      renderPlan({ status: 'planning' });
      expect(screen.getByTestId('plan-status')).toHaveTextContent('Planning...');
    });

    it('shows "Review Plan" when plan is ready for review', () => {
      renderPlan({ status: 'review' });
      expect(screen.getByTestId('plan-status')).toHaveTextContent('Review Plan');
    });

    it('shows "Plan Approved" after approval', () => {
      renderPlan({ status: 'approved' });
      expect(screen.getByTestId('plan-status')).toHaveTextContent('Plan Approved');
    });

    it('shows "Plan Rejected" after rejection', () => {
      renderPlan({ status: 'rejected' });
      expect(screen.getByTestId('plan-status')).toHaveTextContent('Plan Rejected');
    });
  });

  // -- Approve/Reject Buttons --

  describe('Approve and reject buttons', () => {
    it('shows approve and reject buttons in review state', () => {
      renderPlan({ status: 'review' });
      expect(
        screen.getByRole('button', { name: /^approve$/i })
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /reject/i })
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /approve with feedback/i })
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /provide input/i })
      ).toBeInTheDocument();
    });

    it('does not show buttons during planning phase', () => {
      renderPlan({ status: 'planning' });
      expect(
        screen.queryByRole('button', { name: /approve/i })
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: /reject/i })
      ).not.toBeInTheDocument();
    });

    it('does not show buttons after approval', () => {
      renderPlan({ status: 'approved' });
      expect(
        screen.queryByRole('button', { name: /approve/i })
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: /reject/i })
      ).not.toBeInTheDocument();
    });

    it('does not show buttons after rejection', () => {
      renderPlan({ status: 'rejected' });
      expect(
        screen.queryByRole('button', { name: /approve/i })
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: /reject/i })
      ).not.toBeInTheDocument();
    });

    it('calls onApprove when approve button is clicked', async () => {
      const user = userEvent.setup();
      const onApprove = vi.fn();
      renderPlan({ status: 'review' }, { onApprove });

      await user.click(screen.getByRole('button', { name: /^approve$/i }));
      expect(onApprove).toHaveBeenCalledOnce();
    });
  });

  // -- Reject with Feedback --

  describe('Reject with feedback', () => {
    it('shows feedback input after clicking reject', async () => {
      const user = userEvent.setup();
      renderPlan({ status: 'review' });

      await user.click(screen.getByRole('button', { name: /reject/i }));
      expect(
        screen.getByPlaceholderText(/feedback/i)
      ).toBeInTheDocument();
    });

    it('sends rejection with feedback text', async () => {
      const user = userEvent.setup();
      const onReject = vi.fn();
      renderPlan({ status: 'review' }, { onReject });

      // Click reject to show feedback input
      await user.click(screen.getByRole('button', { name: /reject/i }));

      // Type feedback
      const input = screen.getByPlaceholderText(/feedback/i);
      await user.type(input, 'Please add error handling');

      // Confirm rejection
      await user.click(
        screen.getByRole('button', { name: /confirm/i })
      );

      expect(onReject).toHaveBeenCalledWith('Please add error handling');
    });

    it('sends rejection without feedback when confirmed empty', async () => {
      const user = userEvent.setup();
      const onReject = vi.fn();
      renderPlan({ status: 'review' }, { onReject });

      // Click reject to show feedback input
      await user.click(screen.getByRole('button', { name: /reject/i }));

      // Confirm without typing feedback
      await user.click(
        screen.getByRole('button', { name: /confirm/i })
      );

      expect(onReject).toHaveBeenCalledWith('');
    });

    it('can cancel rejection and go back to review', async () => {
      const user = userEvent.setup();
      const onReject = vi.fn();
      renderPlan({ status: 'review' }, { onReject });

      // Click reject
      await user.click(screen.getByRole('button', { name: /reject/i }));
      expect(screen.getByPlaceholderText(/feedback/i)).toBeInTheDocument();

      // Click cancel
      await user.click(screen.getByRole('button', { name: /cancel/i }));

      // Should be back to showing approve/reject buttons
      expect(
        screen.getByRole('button', { name: /^approve$/i })
      ).toBeInTheDocument();
      expect(onReject).not.toHaveBeenCalled();
    });
  });

  describe('Approve with feedback and planning input', () => {
    it('sends approval with feedback text', async () => {
      const user = userEvent.setup();
      const onApprove = vi.fn();
      renderPlan({ status: 'review' }, { onApprove });

      await user.click(
        screen.getByRole('button', { name: /approve with feedback/i })
      );
      await user.type(
        screen.getByPlaceholderText(/approval notes/i),
        'Looks good, keep the API shape stable'
      );
      await user.click(
        screen.getByRole('button', { name: /approve with feedback/i })
      );

      expect(onApprove).toHaveBeenCalledWith(
        'Looks good, keep the API shape stable'
      );
    });

    it('sends clarifying user input back to planning flow', async () => {
      const user = userEvent.setup();
      const onSendInput = vi.fn();
      renderPlan({ status: 'review' }, { onSendInput });

      await user.click(screen.getByRole('button', { name: /provide input/i }));
      await user.type(
        screen.getByPlaceholderText(/answer claude/i),
        'The implementation should target only the desktop client.'
      );
      await user.click(screen.getByRole('button', { name: /send input/i }));

      expect(onSendInput).toHaveBeenCalledWith(
        'The implementation should target only the desktop client.'
      );
    });
  });

  // -- Visual Distinction --

  describe('Visual distinction', () => {
    it('has a distinctive border for plan view', () => {
      renderPlan({ status: 'review' });
      const container = screen.getByTestId('plan-view');
      // Should have blue/purple-ish border styling
      expect(container.className).toMatch(/border/);
    });
  });

  // -- Collapsible After Approval --

  describe('Collapsible after approval', () => {
    it('shows collapsed summary when approved', () => {
      renderPlan({ status: 'approved' });
      expect(screen.getByTestId('plan-status')).toHaveTextContent(
        'Plan Approved'
      );
    });

    it('can toggle content visibility when approved', async () => {
      const user = userEvent.setup();
      renderPlan({ status: 'approved', content: 'The plan details' });

      // Content should be hidden by default when approved
      const toggleBtn = screen.getByTestId('plan-toggle');
      expect(toggleBtn).toBeInTheDocument();

      // Click to expand
      await user.click(toggleBtn);
      expect(screen.getByTestId('plan-content')).toHaveTextContent(
        'The plan details'
      );

      // Click to collapse again
      await user.click(toggleBtn);
      expect(screen.queryByTestId('plan-content')).not.toBeInTheDocument();
    });
  });
});
