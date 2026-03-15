import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CheckpointTimeline } from '../chat/CheckpointTimeline';
import type { Checkpoint } from '@claude-tauri/shared';

function makeCheckpoint(overrides: Partial<Checkpoint> = {}): Checkpoint {
  return {
    id: 'cp-1',
    userMessageId: 'msg-1',
    promptPreview: 'Fix the login bug in auth.ts',
    timestamp: '2026-03-15T10:23:00.000Z',
    filesChanged: [
      { path: 'src/auth.ts', action: 'modified', tool: 'Edit' },
    ],
    turnIndex: 0,
    ...overrides,
  };
}

describe('CheckpointTimeline', () => {
  it('is hidden when no checkpoints exist', () => {
    const { container } = render(
      <CheckpointTimeline checkpoints={[]} onRewind={vi.fn()} />
    );
    expect(container.innerHTML).toBe('');
  });

  it('renders the toggle bar with checkpoint count', () => {
    const checkpoints = [makeCheckpoint()];
    render(<CheckpointTimeline checkpoints={checkpoints} onRewind={vi.fn()} />);

    expect(screen.getByTestId('checkpoint-timeline')).toBeInTheDocument();
    expect(screen.getByTestId('checkpoint-toggle')).toBeInTheDocument();
    expect(screen.getByTestId('checkpoint-count')).toHaveTextContent('1');
  });

  it('is collapsed by default (list not visible)', () => {
    const checkpoints = [makeCheckpoint()];
    render(<CheckpointTimeline checkpoints={checkpoints} onRewind={vi.fn()} />);

    expect(screen.queryByTestId('checkpoint-list')).not.toBeInTheDocument();
  });

  it('expands on toggle click to show checkpoint list', () => {
    const checkpoints = [makeCheckpoint()];
    render(<CheckpointTimeline checkpoints={checkpoints} onRewind={vi.fn()} />);

    fireEvent.click(screen.getByTestId('checkpoint-toggle'));
    expect(screen.getByTestId('checkpoint-list')).toBeInTheDocument();
  });

  it('collapses on second toggle click', () => {
    const checkpoints = [makeCheckpoint()];
    render(<CheckpointTimeline checkpoints={checkpoints} onRewind={vi.fn()} />);

    const toggle = screen.getByTestId('checkpoint-toggle');
    fireEvent.click(toggle); // expand
    expect(screen.getByTestId('checkpoint-list')).toBeInTheDocument();

    fireEvent.click(toggle); // collapse
    expect(screen.queryByTestId('checkpoint-list')).not.toBeInTheDocument();
  });

  it('shows turn number and prompt preview when expanded', () => {
    const checkpoints = [makeCheckpoint({ turnIndex: 2 })];
    render(<CheckpointTimeline checkpoints={checkpoints} onRewind={vi.fn()} />);

    fireEvent.click(screen.getByTestId('checkpoint-toggle'));

    expect(screen.getByTestId('checkpoint-turn-cp-1')).toHaveTextContent('Turn 3:');
    expect(screen.getByTestId('checkpoint-prompt-cp-1')).toHaveTextContent(
      '"Fix the login bug in auth.ts"'
    );
  });

  it('shows file change summary', () => {
    const checkpoints = [
      makeCheckpoint({
        filesChanged: [
          { path: 'src/auth.ts', action: 'modified', tool: 'Edit' },
          { path: 'src/login.tsx', action: 'modified', tool: 'Edit' },
        ],
      }),
    ];
    render(<CheckpointTimeline checkpoints={checkpoints} onRewind={vi.fn()} />);

    fireEvent.click(screen.getByTestId('checkpoint-toggle'));

    expect(screen.getByTestId('checkpoint-files-cp-1')).toHaveTextContent('2 modified');
  });

  it('shows mixed file actions correctly', () => {
    const checkpoints = [
      makeCheckpoint({
        filesChanged: [
          { path: 'src/new.ts', action: 'created', tool: 'Write' },
          { path: 'src/old.ts', action: 'modified', tool: 'Edit' },
          { path: 'src/gone.ts', action: 'deleted', tool: 'Edit' },
        ],
      }),
    ];
    render(<CheckpointTimeline checkpoints={checkpoints} onRewind={vi.fn()} />);

    fireEvent.click(screen.getByTestId('checkpoint-toggle'));

    const summary = screen.getByTestId('checkpoint-files-cp-1').textContent;
    expect(summary).toContain('1 created');
    expect(summary).toContain('1 modified');
    expect(summary).toContain('1 deleted');
  });

  it('renders multiple checkpoints with timeline dots', () => {
    const checkpoints = [
      makeCheckpoint({ id: 'cp-1', turnIndex: 0 }),
      makeCheckpoint({ id: 'cp-2', turnIndex: 1, promptPreview: 'Add tests' }),
      makeCheckpoint({ id: 'cp-3', turnIndex: 2, promptPreview: 'Refactor' }),
    ];
    render(<CheckpointTimeline checkpoints={checkpoints} onRewind={vi.fn()} />);

    fireEvent.click(screen.getByTestId('checkpoint-toggle'));

    expect(screen.getByTestId('checkpoint-count')).toHaveTextContent('3');
    expect(screen.getByTestId('checkpoint-item-cp-1')).toBeInTheDocument();
    expect(screen.getByTestId('checkpoint-item-cp-2')).toBeInTheDocument();
    expect(screen.getByTestId('checkpoint-item-cp-3')).toBeInTheDocument();

    // Timeline dots should exist
    const dots = screen.getAllByTestId('timeline-dot');
    expect(dots).toHaveLength(3);
  });

  it('rewind button triggers onRewind callback with checkpoint id', () => {
    const onRewind = vi.fn();
    const checkpoints = [makeCheckpoint({ id: 'cp-42' })];
    render(<CheckpointTimeline checkpoints={checkpoints} onRewind={onRewind} />);

    fireEvent.click(screen.getByTestId('checkpoint-toggle'));
    fireEvent.click(screen.getByTestId('checkpoint-rewind-cp-42'));

    expect(onRewind).toHaveBeenCalledWith('cp-42');
    expect(onRewind).toHaveBeenCalledTimes(1);
  });

  it('shows timestamp for each checkpoint', () => {
    const checkpoints = [makeCheckpoint({ timestamp: '2026-03-15T10:23:00.000Z' })];
    render(<CheckpointTimeline checkpoints={checkpoints} onRewind={vi.fn()} />);

    fireEvent.click(screen.getByTestId('checkpoint-toggle'));

    const timeEl = screen.getByTestId('checkpoint-time-cp-1');
    expect(timeEl).toBeInTheDocument();
    // The formatted time depends on locale, just check it's non-empty
    expect(timeEl.textContent!.length).toBeGreaterThan(0);
  });
});
