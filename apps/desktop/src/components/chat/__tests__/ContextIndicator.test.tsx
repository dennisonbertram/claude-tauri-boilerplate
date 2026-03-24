import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ContextIndicator } from '../ContextIndicator';
import type { ContextUsage } from '../ContextIndicator';

// Default max tokens for Claude (200k context window)
const MAX_TOKENS = 200_000;

function makeUsage(overrides: Partial<ContextUsage> = {}): ContextUsage {
  return {
    inputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    cacheCreationTokens: 0,
    maxTokens: MAX_TOKENS,
    ...overrides,
  };
}

describe('ContextIndicator', () => {
  // --- Rendering at different utilization levels ---

  describe('Utilization levels and colors', () => {
    it('renders green bar when usage is under 50%', () => {
      const usage = makeUsage({
        inputTokens: 30_000,
        outputTokens: 10_000,
      });
      render(<ContextIndicator usage={usage} />);

      const fill = screen.getByTestId('context-meter-fill');
      expect(fill.className).toMatch(/green/);
    });

    it('renders yellow bar when usage is between 50% and 80%', () => {
      const usage = makeUsage({
        inputTokens: 100_000,
        outputTokens: 20_000,
      });
      render(<ContextIndicator usage={usage} />);

      const fill = screen.getByTestId('context-meter-fill');
      expect(fill.className).toMatch(/yellow/);
    });

    it('renders red bar when usage is above 80%', () => {
      const usage = makeUsage({
        inputTokens: 150_000,
        outputTokens: 20_000,
      });
      render(<ContextIndicator usage={usage} />);

      const fill = screen.getByTestId('context-meter-fill');
      expect(fill.className).toMatch(/red/);
    });

    it('shows correct percentage text', () => {
      const usage = makeUsage({
        inputTokens: 50_000,
        outputTokens: 50_000,
      });
      render(<ContextIndicator usage={usage} />);

      expect(screen.getByText('50%')).toBeInTheDocument();
    });

    it('shows 0% when no tokens used', () => {
      const usage = makeUsage();
      render(<ContextIndicator usage={usage} />);

      expect(screen.getByText('0%')).toBeInTheDocument();
    });

    it('caps at 100% even if tokens exceed max', () => {
      const usage = makeUsage({
        inputTokens: 200_000,
        outputTokens: 50_000,
      });
      render(<ContextIndicator usage={usage} />);

      expect(screen.getByText('100%')).toBeInTheDocument();
    });
  });

  // --- Tooltip with token counts ---

  describe('Tooltip with token counts', () => {
    it('shows token breakdown on hover', async () => {
      const user = userEvent.setup();
      const usage = makeUsage({
        inputTokens: 50_000,
        outputTokens: 20_000,
        cacheReadTokens: 10_000,
        cacheCreationTokens: 5_000,
      });
      render(<ContextIndicator usage={usage} />);

      const indicator = screen.getByTestId('context-indicator');
      await user.hover(indicator);

      expect(screen.getByText(/Input:/)).toBeInTheDocument();
      expect(screen.getByText(/50,000/)).toBeInTheDocument();
      expect(screen.getByText(/Output:/)).toBeInTheDocument();
      expect(screen.getByText(/20,000/)).toBeInTheDocument();
      expect(screen.getByText(/Cache Read:/)).toBeInTheDocument();
      expect(screen.getByText(/10,000/)).toBeInTheDocument();
      expect(screen.getByText(/Cache Write:/)).toBeInTheDocument();
      expect(screen.getByText(/5,000/)).toBeInTheDocument();
    });

    it('hides tooltip when not hovered', () => {
      const usage = makeUsage({ inputTokens: 50_000 });
      render(<ContextIndicator usage={usage} />);

      // Tooltip content should not be visible by default
      expect(screen.queryByText(/Input:/)).not.toBeInTheDocument();
    });
  });

  // --- Warning state (pulse animation) ---

  describe('Warning state at high usage', () => {
    it('applies pulse class when usage exceeds 80%', () => {
      const usage = makeUsage({
        inputTokens: 170_000,
        outputTokens: 10_000,
      });
      render(<ContextIndicator usage={usage} />);

      const indicator = screen.getByTestId('context-indicator');
      expect(indicator.className).toMatch(/animate-pulse/);
    });

    it('does not apply pulse class when usage is under 80%', () => {
      const usage = makeUsage({
        inputTokens: 30_000,
        outputTokens: 10_000,
      });
      render(<ContextIndicator usage={usage} />);

      const indicator = screen.getByTestId('context-indicator');
      expect(indicator.className).not.toMatch(/animate-pulse/);
    });
  });

  // --- Compaction indicator ---

  describe('Compaction indicator', () => {
    it('shows "Compacting..." when isCompacting is true', () => {
      const usage = makeUsage({ inputTokens: 50_000 });
      render(<ContextIndicator usage={usage} isCompacting={true} />);

      expect(screen.getByText(/Compacting/)).toBeInTheDocument();
    });

    it('does not show "Compacting..." when isCompacting is false', () => {
      const usage = makeUsage({ inputTokens: 50_000 });
      render(<ContextIndicator usage={usage} isCompacting={false} />);

      expect(screen.queryByText(/Compacting/)).not.toBeInTheDocument();
    });

    it('does not show "Compacting..." by default', () => {
      const usage = makeUsage({ inputTokens: 50_000 });
      render(<ContextIndicator usage={usage} />);

      expect(screen.queryByText(/Compacting/)).not.toBeInTheDocument();
    });
  });

  // --- Null/zero usage handling ---

  describe('Edge cases', () => {
    it('handles maxTokens of 0 without crashing (division by zero)', () => {
      const usage = makeUsage({ maxTokens: 0 });
      render(<ContextIndicator usage={usage} />);

      expect(screen.getByText('0%')).toBeInTheDocument();
    });

    it('renders the meter fill width as a percentage style', () => {
      const usage = makeUsage({
        inputTokens: 60_000,
        outputTokens: 40_000,
      });
      render(<ContextIndicator usage={usage} />);

      const fill = screen.getByTestId('context-meter-fill');
      expect(fill.style.width).toBe('50%');
    });
  });
});
