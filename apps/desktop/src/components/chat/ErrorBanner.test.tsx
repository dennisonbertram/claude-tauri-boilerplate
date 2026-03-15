import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ErrorBanner, type ChatError } from './ErrorBanner';

describe('ErrorBanner', () => {
  it('renders nothing when error is null', () => {
    const { container } = render(
      <ErrorBanner error={null} onDismiss={() => {}} onRetry={() => {}} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders API error with red styling', () => {
    const error: ChatError = {
      type: 'api',
      message: 'Claude API failed',
    };
    render(
      <ErrorBanner error={error} onDismiss={() => {}} onRetry={() => {}} />
    );

    expect(screen.getByText('Claude API failed')).toBeInTheDocument();
    // Should have red/destructive styling
    const banner = screen.getByRole('alert');
    expect(banner.className).toMatch(/destructive|red|error/i);
  });

  it('renders rate limit error with warning styling', () => {
    const error: ChatError = {
      type: 'rate_limit',
      message: 'Rate limited, try again in 30 seconds',
    };
    render(
      <ErrorBanner error={error} onDismiss={() => {}} onRetry={() => {}} />
    );

    expect(screen.getByText(/rate limited/i)).toBeInTheDocument();
    const banner = screen.getByRole('alert');
    expect(banner.className).toMatch(/warning|yellow|amber/i);
  });

  it('renders auth error with redirect messaging', () => {
    const error: ChatError = {
      type: 'auth',
      message: 'Authentication expired',
    };
    render(
      <ErrorBanner error={error} onDismiss={() => {}} onRetry={() => {}} />
    );

    expect(screen.getByText(/authentication expired/i)).toBeInTheDocument();
  });

  it('renders network error with reconnecting indicator', () => {
    const error: ChatError = {
      type: 'network',
      message: 'Server unreachable',
    };
    render(
      <ErrorBanner error={error} onDismiss={() => {}} onRetry={() => {}} />
    );

    expect(screen.getByText(/server unreachable/i)).toBeInTheDocument();
    // Should show reconnecting text
    expect(screen.getByText(/reconnecting/i)).toBeInTheDocument();
  });

  it('shows Retry button for retryable errors', () => {
    const error: ChatError = {
      type: 'api',
      message: 'Temporary failure',
      retryable: true,
    };
    const onRetry = vi.fn();
    render(
      <ErrorBanner error={error} onDismiss={() => {}} onRetry={onRetry} />
    );

    const retryButton = screen.getByRole('button', { name: /retry/i });
    expect(retryButton).toBeInTheDocument();

    fireEvent.click(retryButton);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('does not show Retry button for non-retryable errors', () => {
    const error: ChatError = {
      type: 'auth',
      message: 'Invalid credentials',
      retryable: false,
    };
    render(
      <ErrorBanner error={error} onDismiss={() => {}} onRetry={() => {}} />
    );

    expect(screen.queryByRole('button', { name: /retry/i })).not.toBeInTheDocument();
  });

  it('calls onDismiss when dismiss button is clicked', () => {
    const error: ChatError = {
      type: 'api',
      message: 'Some error',
    };
    const onDismiss = vi.fn();
    render(
      <ErrorBanner error={error} onDismiss={onDismiss} onRetry={() => {}} />
    );

    // Find dismiss/close button
    const dismissButton = screen.getByRole('button', { name: /dismiss|close/i });
    fireEvent.click(dismissButton);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
