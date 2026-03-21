import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { Session } from '@claude-tauri/shared';
import { ChatTabsBar } from '../ChatTabsBar';

const sessions: Session[] = [
  {
    id: 's-1',
    title: 'First Chat',
    createdAt: '2026-03-14T10:00:00.000Z',
    updatedAt: '2026-03-14T10:00:00.000Z',
  },
  {
    id: 's-2',
    title: 'Second Chat',
    createdAt: '2026-03-14T11:00:00.000Z',
    updatedAt: '2026-03-14T11:00:00.000Z',
  },
];

describe('ChatTabsBar', () => {
  it('renders tabs and activates them when clicked', () => {
    const onActivate = vi.fn();

    render(
      <ChatTabsBar
        sessions={sessions}
        openSessionIds={['s-1', 's-2']}
        activeSessionId="s-1"
        onActivate={onActivate}
        onClose={vi.fn()}
        onRename={vi.fn()}
        onNewTab={vi.fn()}
      />
    );

    expect(screen.getByTestId('chat-tab-s-1')).toHaveTextContent('First Chat');
    expect(screen.getByTestId('chat-tab-s-2')).toHaveTextContent('Second Chat');

    fireEvent.click(screen.getByTestId('chat-tab-s-2'));
    expect(onActivate).toHaveBeenCalledWith('s-2');
  });

  it('calls onClose when the close button is clicked', () => {
    const onClose = vi.fn();

    render(
      <ChatTabsBar
        sessions={sessions}
        openSessionIds={['s-1', 's-2']}
        activeSessionId="s-1"
        onActivate={vi.fn()}
        onClose={onClose}
        onRename={vi.fn()}
        onNewTab={vi.fn()}
      />
    );

    fireEvent.click(screen.getByTestId('chat-tab-close-s-2'));
    expect(onClose).toHaveBeenCalledWith('s-2');
  });

  it('enters rename mode on double click and submits rename on Enter', () => {
    const onRename = vi.fn();

    render(
      <ChatTabsBar
        sessions={sessions}
        openSessionIds={['s-1']}
        activeSessionId="s-1"
        onActivate={vi.fn()}
        onClose={vi.fn()}
        onRename={onRename}
        onNewTab={vi.fn()}
      />
    );

    fireEvent.doubleClick(screen.getByTestId('chat-tab-s-1'));
    const input = screen.getByTestId('chat-tab-rename-input-s-1') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'Renamed' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onRename).toHaveBeenCalledWith('s-1', 'Renamed');
  });
});
