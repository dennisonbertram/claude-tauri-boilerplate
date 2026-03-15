import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CostDisplay } from '../CostDisplay';
import type { MessageCost } from '@/hooks/useCostTracking';

function makeCost(overrides: Partial<MessageCost> = {}): MessageCost {
  return {
    messageId: 'msg-1',
    model: 'claude-sonnet-4',
    inputTokens: 5000,
    outputTokens: 1000,
    cacheReadTokens: 0,
    cacheCreationTokens: 0,
    costUsd: 0.03,
    durationMs: 2000,
    timestamp: Date.now(),
    ...overrides,
  };
}

describe('CostDisplay', () => {
  describe('empty state', () => {
    it('does not render when session total is 0 and no costs', () => {
      const { container } = render(
        <CostDisplay messageCosts={[]} sessionTotalCost={0} />
      );
      expect(container.firstChild).toBeNull();
    });
  });

  describe('cost badge', () => {
    it('shows the session total cost as a badge', () => {
      render(
        <CostDisplay
          messageCosts={[makeCost()]}
          sessionTotalCost={0.03}
        />
      );
      expect(screen.getByTestId('cost-badge')).toHaveTextContent('$0.03');
    });

    it('shows larger costs correctly', () => {
      render(
        <CostDisplay
          messageCosts={[makeCost({ costUsd: 1.24 })]}
          sessionTotalCost={1.24}
        />
      );
      expect(screen.getByTestId('cost-badge')).toHaveTextContent('$1.24');
    });

    it('shows sub-cent costs with precision', () => {
      render(
        <CostDisplay
          messageCosts={[makeCost({ costUsd: 0.001 })]}
          sessionTotalCost={0.001}
        />
      );
      expect(screen.getByTestId('cost-badge')).toHaveTextContent('$0.0010');
    });
  });

  describe('expandable detail panel', () => {
    it('does not show detail panel by default', () => {
      render(
        <CostDisplay
          messageCosts={[makeCost()]}
          sessionTotalCost={0.03}
        />
      );
      expect(screen.queryByTestId('cost-detail-panel')).not.toBeInTheDocument();
    });

    it('shows detail panel when badge is clicked', async () => {
      const user = userEvent.setup();
      render(
        <CostDisplay
          messageCosts={[makeCost()]}
          sessionTotalCost={0.03}
        />
      );

      await user.click(screen.getByTestId('cost-badge'));
      expect(screen.getByTestId('cost-detail-panel')).toBeInTheDocument();
    });

    it('hides detail panel when clicked again (toggle)', async () => {
      const user = userEvent.setup();
      render(
        <CostDisplay
          messageCosts={[makeCost()]}
          sessionTotalCost={0.03}
        />
      );

      await user.click(screen.getByTestId('cost-badge'));
      expect(screen.getByTestId('cost-detail-panel')).toBeInTheDocument();

      await user.click(screen.getByTestId('cost-badge'));
      expect(screen.queryByTestId('cost-detail-panel')).not.toBeInTheDocument();
    });
  });

  describe('CostDetailPanel content', () => {
    it('shows per-message breakdown with model name', async () => {
      const user = userEvent.setup();
      const costs = [
        makeCost({ messageId: 'msg-1', model: 'claude-opus-4', costUsd: 0.15 }),
        makeCost({ messageId: 'msg-2', model: 'claude-sonnet-4', costUsd: 0.03 }),
      ];
      render(
        <CostDisplay messageCosts={costs} sessionTotalCost={0.18} />
      );

      await user.click(screen.getByTestId('cost-badge'));

      // Both messages should appear
      expect(screen.getByText(/opus/i)).toBeInTheDocument();
      expect(screen.getByText(/sonnet/i)).toBeInTheDocument();
    });

    it('shows token counts for each message', async () => {
      const user = userEvent.setup();
      const costs = [
        makeCost({
          messageId: 'msg-1',
          inputTokens: 5000,
          outputTokens: 1000,
          costUsd: 0.03,
        }),
      ];
      render(
        <CostDisplay messageCosts={costs} sessionTotalCost={0.03} />
      );

      await user.click(screen.getByTestId('cost-badge'));

      expect(screen.getByText(/5,000/)).toBeInTheDocument();
      expect(screen.getByText(/1,000/)).toBeInTheDocument();
    });

    it('shows cost per message entry', async () => {
      const user = userEvent.setup();
      const costs = [
        makeCost({ messageId: 'msg-1', costUsd: 0.15 }),
        makeCost({ messageId: 'msg-2', costUsd: 0.03 }),
      ];
      render(
        <CostDisplay messageCosts={costs} sessionTotalCost={0.18} />
      );

      await user.click(screen.getByTestId('cost-badge'));

      expect(screen.getByText('$0.15')).toBeInTheDocument();
      expect(screen.getByText('$0.03')).toBeInTheDocument();
    });

    it('shows session total in the detail panel', async () => {
      const user = userEvent.setup();
      const costs = [
        makeCost({ messageId: 'msg-1', costUsd: 0.15 }),
        makeCost({ messageId: 'msg-2', costUsd: 0.03 }),
      ];
      render(
        <CostDisplay messageCosts={costs} sessionTotalCost={0.18} />
      );

      await user.click(screen.getByTestId('cost-badge'));

      // The session total line
      expect(screen.getByTestId('cost-session-total')).toHaveTextContent('$0.18');
    });

    it('shows multiple messages with different models', async () => {
      const user = userEvent.setup();
      const costs = [
        makeCost({ messageId: 'msg-1', model: 'claude-opus-4', costUsd: 0.15, inputTokens: 10000, outputTokens: 2000 }),
        makeCost({ messageId: 'msg-2', model: 'claude-sonnet-4', costUsd: 0.03, inputTokens: 3000, outputTokens: 500 }),
        makeCost({ messageId: 'msg-3', model: 'claude-3-5-haiku-20241022', costUsd: 0.001, inputTokens: 500, outputTokens: 100 }),
      ];
      render(
        <CostDisplay messageCosts={costs} sessionTotalCost={0.181} />
      );

      await user.click(screen.getByTestId('cost-badge'));

      const panel = screen.getByTestId('cost-detail-panel');
      expect(panel).toBeInTheDocument();
      // All three message rows should be present
      const rows = screen.getAllByTestId(/^cost-message-row-/);
      expect(rows).toHaveLength(3);
    });

    it('shows cache token info when present', async () => {
      const user = userEvent.setup();
      const costs = [
        makeCost({
          messageId: 'msg-1',
          cacheReadTokens: 8000,
          cacheCreationTokens: 2000,
          costUsd: 0.05,
        }),
      ];
      render(
        <CostDisplay messageCosts={costs} sessionTotalCost={0.05} />
      );

      await user.click(screen.getByTestId('cost-badge'));

      expect(screen.getByText(/8,000/)).toBeInTheDocument();
      expect(screen.getByText(/2,000/)).toBeInTheDocument();
    });
  });
});
