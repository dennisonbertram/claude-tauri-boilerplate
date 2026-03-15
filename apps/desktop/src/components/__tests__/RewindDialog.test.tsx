import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { RewindDialog } from '../chat/RewindDialog';
import type { Checkpoint, RewindPreview } from '@claude-tauri/shared';

function makeCheckpoint(overrides: Partial<Checkpoint> = {}): Checkpoint {
  return {
    id: 'cp-1',
    userMessageId: 'msg-1',
    promptPreview: 'Add unit tests for auth',
    timestamp: '2026-03-15T10:25:00.000Z',
    filesChanged: [
      { path: 'src/__tests__/auth.test.ts', action: 'created', tool: 'Write' },
    ],
    turnIndex: 2,
    ...overrides,
  };
}

function makePreview(overrides: Partial<RewindPreview> = {}): RewindPreview {
  return {
    checkpointId: 'cp-1',
    filesAffected: ['src/__tests__/auth.test.ts', 'src/auth.ts', 'src/handler.ts'],
    messagesRemoved: 4,
    ...overrides,
  };
}

describe('RewindDialog', () => {
  it('renders the dialog with title', () => {
    render(
      <RewindDialog
        checkpoint={makeCheckpoint()}
        preview={makePreview()}
        isLoadingPreview={false}
        onRewind={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    expect(screen.getByTestId('rewind-dialog')).toBeInTheDocument();
    expect(screen.getByTestId('rewind-dialog-title')).toHaveTextContent('Rewind to Checkpoint');
  });

  it('shows checkpoint turn and prompt preview', () => {
    render(
      <RewindDialog
        checkpoint={makeCheckpoint({ turnIndex: 2, promptPreview: 'Add unit tests for auth' })}
        preview={makePreview()}
        isLoadingPreview={false}
        onRewind={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    const info = screen.getByTestId('rewind-checkpoint-info');
    expect(info).toHaveTextContent('Turn 3:');
    expect(info).toHaveTextContent('"Add unit tests for auth"');
  });

  it('shows preview data (files affected, messages removed)', () => {
    render(
      <RewindDialog
        checkpoint={makeCheckpoint()}
        preview={makePreview({ filesAffected: ['a.ts', 'b.ts', 'c.ts'], messagesRemoved: 4 })}
        isLoadingPreview={false}
        onRewind={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    expect(screen.getByTestId('rewind-files-affected')).toHaveTextContent('3 files affected');
    expect(screen.getByTestId('rewind-messages-removed')).toHaveTextContent('4 messages removed');
  });

  it('shows singular form for 1 file and 1 message', () => {
    render(
      <RewindDialog
        checkpoint={makeCheckpoint()}
        preview={makePreview({ filesAffected: ['a.ts'], messagesRemoved: 1 })}
        isLoadingPreview={false}
        onRewind={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    expect(screen.getByTestId('rewind-files-affected')).toHaveTextContent('1 file affected');
    expect(screen.getByTestId('rewind-messages-removed')).toHaveTextContent('1 message removed');
  });

  it('shows loading state when preview is loading', () => {
    render(
      <RewindDialog
        checkpoint={makeCheckpoint()}
        preview={null}
        isLoadingPreview={true}
        onRewind={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    expect(screen.getByTestId('rewind-preview-loading')).toHaveTextContent('Loading preview...');
  });

  it('renders three radio buttons for rewind mode', () => {
    render(
      <RewindDialog
        checkpoint={makeCheckpoint()}
        preview={makePreview()}
        isLoadingPreview={false}
        onRewind={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    expect(screen.getByTestId('rewind-mode-code_and_conversation')).toBeInTheDocument();
    expect(screen.getByTestId('rewind-mode-conversation_only')).toBeInTheDocument();
    expect(screen.getByTestId('rewind-mode-code_only')).toBeInTheDocument();
  });

  it('defaults to code_and_conversation mode', () => {
    render(
      <RewindDialog
        checkpoint={makeCheckpoint()}
        preview={makePreview()}
        isLoadingPreview={false}
        onRewind={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    const radio = screen.getByTestId('rewind-mode-code_and_conversation').querySelector('input[type="radio"]');
    expect(radio).toBeChecked();
  });

  it('allows changing rewind mode', () => {
    render(
      <RewindDialog
        checkpoint={makeCheckpoint()}
        preview={makePreview()}
        isLoadingPreview={false}
        onRewind={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    const conversationOnlyRadio = screen.getByTestId('rewind-mode-conversation_only').querySelector('input[type="radio"]')!;
    fireEvent.click(conversationOnlyRadio);

    expect(conversationOnlyRadio).toBeChecked();

    const codeAndConvRadio = screen.getByTestId('rewind-mode-code_and_conversation').querySelector('input[type="radio"]')!;
    expect(codeAndConvRadio).not.toBeChecked();
  });

  it('shows warning text', () => {
    render(
      <RewindDialog
        checkpoint={makeCheckpoint()}
        preview={makePreview()}
        isLoadingPreview={false}
        onRewind={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    expect(screen.getByTestId('rewind-warning')).toHaveTextContent('This action cannot be undone');
  });

  it('cancel button calls onCancel', () => {
    const onCancel = vi.fn();
    render(
      <RewindDialog
        checkpoint={makeCheckpoint()}
        preview={makePreview()}
        isLoadingPreview={false}
        onRewind={vi.fn()}
        onCancel={onCancel}
      />
    );

    fireEvent.click(screen.getByTestId('rewind-cancel-btn'));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('rewind button calls onRewind with selected mode', () => {
    const onRewind = vi.fn();
    render(
      <RewindDialog
        checkpoint={makeCheckpoint()}
        preview={makePreview()}
        isLoadingPreview={false}
        onRewind={onRewind}
        onCancel={vi.fn()}
      />
    );

    // Default mode is code_and_conversation
    fireEvent.click(screen.getByTestId('rewind-confirm-btn'));
    expect(onRewind).toHaveBeenCalledWith('code_and_conversation');
  });

  it('rewind button sends correct mode after changing selection', () => {
    const onRewind = vi.fn();
    render(
      <RewindDialog
        checkpoint={makeCheckpoint()}
        preview={makePreview()}
        isLoadingPreview={false}
        onRewind={onRewind}
        onCancel={vi.fn()}
      />
    );

    // Change to code_only
    const codeOnlyRadio = screen.getByTestId('rewind-mode-code_only').querySelector('input[type="radio"]')!;
    fireEvent.click(codeOnlyRadio);

    fireEvent.click(screen.getByTestId('rewind-confirm-btn'));
    expect(onRewind).toHaveBeenCalledWith('code_only');
  });

  it('clicking overlay calls onCancel', () => {
    const onCancel = vi.fn();
    render(
      <RewindDialog
        checkpoint={makeCheckpoint()}
        preview={makePreview()}
        isLoadingPreview={false}
        onRewind={vi.fn()}
        onCancel={onCancel}
      />
    );

    fireEvent.click(screen.getByTestId('rewind-dialog-overlay'));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('clicking inside dialog does not call onCancel', () => {
    const onCancel = vi.fn();
    render(
      <RewindDialog
        checkpoint={makeCheckpoint()}
        preview={makePreview()}
        isLoadingPreview={false}
        onRewind={vi.fn()}
        onCancel={onCancel}
      />
    );

    fireEvent.click(screen.getByTestId('rewind-dialog'));
    expect(onCancel).not.toHaveBeenCalled();
  });
});
