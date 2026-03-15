import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ErrorBoundary } from './ErrorBoundary';

// Use a module-level flag to control throwing behavior
// so we can change it between the click and the re-render
let shouldThrow = false;

function ThrowingComponent() {
  if (shouldThrow) {
    throw new Error('Test render error');
  }
  return <div>Normal content</div>;
}

describe('ErrorBoundary', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    shouldThrow = false;
    consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('renders children when no error occurs', () => {
    render(
      <ErrorBoundary>
        <div>Hello World</div>
      </ErrorBoundary>
    );

    expect(screen.getByText('Hello World')).toBeInTheDocument();
  });

  it('renders error message when child component throws', () => {
    shouldThrow = true;
    render(
      <ErrorBoundary>
        <ThrowingComponent />
      </ErrorBoundary>
    );

    expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
  });

  it('displays a "Try Again" button', () => {
    shouldThrow = true;
    render(
      <ErrorBoundary>
        <ThrowingComponent />
      </ErrorBoundary>
    );

    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
  });

  it('logs error details to console', () => {
    shouldThrow = true;
    render(
      <ErrorBoundary>
        <ThrowingComponent />
      </ErrorBoundary>
    );

    expect(consoleSpy).toHaveBeenCalled();
  });

  it('recovers when "Try Again" is clicked and error condition is resolved', () => {
    shouldThrow = true;
    render(
      <ErrorBoundary>
        <ThrowingComponent />
      </ErrorBoundary>
    );

    expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();

    // Fix the error condition before clicking Try Again
    shouldThrow = false;

    // Click Try Again -- ErrorBoundary resets state and re-renders children
    fireEvent.click(screen.getByRole('button', { name: /try again/i }));

    // Now children should render successfully
    expect(screen.getByText('Normal content')).toBeInTheDocument();
    expect(screen.queryByText(/something went wrong/i)).not.toBeInTheDocument();
  });

  it('does not show the error boundary UI when no error occurs', () => {
    render(
      <ErrorBoundary>
        <ThrowingComponent />
      </ErrorBoundary>
    );

    expect(screen.queryByText(/something went wrong/i)).not.toBeInTheDocument();
    expect(screen.getByText('Normal content')).toBeInTheDocument();
  });
});
