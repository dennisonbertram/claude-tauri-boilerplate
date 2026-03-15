import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SessionSidebar } from './SessionSidebar';
import type { Session } from '@claude-tauri/shared';

const mockSessions: Session[] = [
  {
    id: 'session-1',
    title: 'First Chat',
    createdAt: '2026-03-14T10:00:00.000Z',
    updatedAt: '2026-03-14T10:00:00.000Z',
  },
  {
    id: 'session-2',
    title: 'Second Chat',
    createdAt: '2026-03-14T11:00:00.000Z',
    updatedAt: '2026-03-14T11:00:00.000Z',
  },
];

const defaultProps = {
  sessions: mockSessions,
  activeSessionId: 'session-1',
  email: 'test@example.com',
  plan: 'pro',
  onSelectSession: vi.fn(),
  onNewChat: vi.fn(),
  onDeleteSession: vi.fn(),
  onRenameSession: vi.fn(),
  onForkSession: vi.fn(),
  onExportSession: vi.fn(),
};

describe('SessionSidebar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('renders session list with titles', () => {
    render(<SessionSidebar {...defaultProps} />);

    expect(screen.getByText('First Chat')).toBeInTheDocument();
    expect(screen.getByText('Second Chat')).toBeInTheDocument();
  });

  test('renders New Chat button', () => {
    render(<SessionSidebar {...defaultProps} />);

    expect(screen.getByText('New Chat')).toBeInTheDocument();
  });

  test('shows empty state when no sessions', () => {
    render(<SessionSidebar {...defaultProps} sessions={[]} />);

    expect(screen.getByText('No conversations yet')).toBeInTheDocument();
  });

  // ─── Context Menu / Three-dot Menu ───

  test('shows context menu button on session hover', async () => {
    render(<SessionSidebar {...defaultProps} />);

    // The "..." / more button should appear on the session items
    const sessionItem = screen.getByText('First Chat').closest('button')!;
    fireEvent.mouseEnter(sessionItem);

    // Should have a menu trigger (three dots or similar)
    const menuButton = sessionItem.querySelector('[data-testid="session-menu-trigger"]');
    expect(menuButton).toBeInTheDocument();
  });

  test('context menu contains Rename option', async () => {
    render(<SessionSidebar {...defaultProps} />);

    const sessionItem = screen.getByText('First Chat').closest('button')!;
    fireEvent.mouseEnter(sessionItem);

    const menuButton = sessionItem.querySelector('[data-testid="session-menu-trigger"]')!;
    fireEvent.click(menuButton);

    await waitFor(() => {
      expect(screen.getByText('Rename')).toBeInTheDocument();
    });
  });

  test('context menu contains Fork option', async () => {
    render(<SessionSidebar {...defaultProps} />);

    const sessionItem = screen.getByText('First Chat').closest('button')!;
    fireEvent.mouseEnter(sessionItem);

    const menuButton = sessionItem.querySelector('[data-testid="session-menu-trigger"]')!;
    fireEvent.click(menuButton);

    await waitFor(() => {
      expect(screen.getByText('Fork')).toBeInTheDocument();
    });
  });

  test('context menu contains Export as JSON option', async () => {
    render(<SessionSidebar {...defaultProps} />);

    const sessionItem = screen.getByText('First Chat').closest('button')!;
    fireEvent.mouseEnter(sessionItem);

    const menuButton = sessionItem.querySelector('[data-testid="session-menu-trigger"]')!;
    fireEvent.click(menuButton);

    await waitFor(() => {
      expect(screen.getByText('Export JSON')).toBeInTheDocument();
    });
  });

  test('context menu contains Export as Markdown option', async () => {
    render(<SessionSidebar {...defaultProps} />);

    const sessionItem = screen.getByText('First Chat').closest('button')!;
    fireEvent.mouseEnter(sessionItem);

    const menuButton = sessionItem.querySelector('[data-testid="session-menu-trigger"]')!;
    fireEvent.click(menuButton);

    await waitFor(() => {
      expect(screen.getByText('Export Markdown')).toBeInTheDocument();
    });
  });

  test('context menu contains Delete option', async () => {
    render(<SessionSidebar {...defaultProps} />);

    const sessionItem = screen.getByText('First Chat').closest('button')!;
    fireEvent.mouseEnter(sessionItem);

    const menuButton = sessionItem.querySelector('[data-testid="session-menu-trigger"]')!;
    fireEvent.click(menuButton);

    await waitFor(() => {
      expect(screen.getByText('Delete')).toBeInTheDocument();
    });
  });

  // ─── Rename ───

  test('clicking Rename enters inline edit mode', async () => {
    render(<SessionSidebar {...defaultProps} />);

    const sessionItem = screen.getByText('First Chat').closest('button')!;
    fireEvent.mouseEnter(sessionItem);

    const menuButton = sessionItem.querySelector('[data-testid="session-menu-trigger"]')!;
    fireEvent.click(menuButton);

    await waitFor(() => {
      fireEvent.click(screen.getByText('Rename'));
    });

    // An input field should appear with the current title
    const input = screen.getByDisplayValue('First Chat');
    expect(input).toBeInTheDocument();
    expect(input.tagName).toBe('INPUT');
  });

  test('submitting rename calls onRenameSession', async () => {
    const user = userEvent.setup();
    render(<SessionSidebar {...defaultProps} />);

    const sessionItem = screen.getByText('First Chat').closest('button')!;
    fireEvent.mouseEnter(sessionItem);

    const menuButton = sessionItem.querySelector('[data-testid="session-menu-trigger"]')!;
    fireEvent.click(menuButton);

    await waitFor(() => {
      fireEvent.click(screen.getByText('Rename'));
    });

    const input = screen.getByDisplayValue('First Chat');
    await user.clear(input);
    await user.type(input, 'Renamed Chat');
    await user.keyboard('{Enter}');

    expect(defaultProps.onRenameSession).toHaveBeenCalledWith(
      'session-1',
      'Renamed Chat'
    );
  });

  test('pressing Escape during rename cancels edit', async () => {
    const user = userEvent.setup();
    render(<SessionSidebar {...defaultProps} />);

    const sessionItem = screen.getByText('First Chat').closest('button')!;
    fireEvent.mouseEnter(sessionItem);

    const menuButton = sessionItem.querySelector('[data-testid="session-menu-trigger"]')!;
    fireEvent.click(menuButton);

    await waitFor(() => {
      fireEvent.click(screen.getByText('Rename'));
    });

    const input = screen.getByDisplayValue('First Chat');
    await user.clear(input);
    await user.type(input, 'Changed');
    await user.keyboard('{Escape}');

    // Should NOT have called rename
    expect(defaultProps.onRenameSession).not.toHaveBeenCalled();

    // Should show original title
    expect(screen.getByText('First Chat')).toBeInTheDocument();
  });

  // ─── Fork ───

  test('clicking Fork calls onForkSession with session id', async () => {
    render(<SessionSidebar {...defaultProps} />);

    const sessionItem = screen.getByText('First Chat').closest('button')!;
    fireEvent.mouseEnter(sessionItem);

    const menuButton = sessionItem.querySelector('[data-testid="session-menu-trigger"]')!;
    fireEvent.click(menuButton);

    await waitFor(() => {
      fireEvent.click(screen.getByText('Fork'));
    });

    expect(defaultProps.onForkSession).toHaveBeenCalledWith('session-1');
  });

  // ─── Export ───

  test('clicking Export JSON calls onExportSession with json format', async () => {
    render(<SessionSidebar {...defaultProps} />);

    const sessionItem = screen.getByText('First Chat').closest('button')!;
    fireEvent.mouseEnter(sessionItem);

    const menuButton = sessionItem.querySelector('[data-testid="session-menu-trigger"]')!;
    fireEvent.click(menuButton);

    await waitFor(() => {
      fireEvent.click(screen.getByText('Export JSON'));
    });

    expect(defaultProps.onExportSession).toHaveBeenCalledWith(
      'session-1',
      'json'
    );
  });

  test('clicking Export Markdown calls onExportSession with md format', async () => {
    render(<SessionSidebar {...defaultProps} />);

    const sessionItem = screen.getByText('First Chat').closest('button')!;
    fireEvent.mouseEnter(sessionItem);

    const menuButton = sessionItem.querySelector('[data-testid="session-menu-trigger"]')!;
    fireEvent.click(menuButton);

    await waitFor(() => {
      fireEvent.click(screen.getByText('Export Markdown'));
    });

    expect(defaultProps.onExportSession).toHaveBeenCalledWith(
      'session-1',
      'md'
    );
  });

  // ─── Delete with confirmation ───

  test('clicking Delete shows confirmation before deleting', async () => {
    render(<SessionSidebar {...defaultProps} />);

    const sessionItem = screen.getByText('First Chat').closest('button')!;
    fireEvent.mouseEnter(sessionItem);

    const menuButton = sessionItem.querySelector('[data-testid="session-menu-trigger"]')!;
    fireEvent.click(menuButton);

    await waitFor(() => {
      fireEvent.click(screen.getByText('Delete'));
    });

    // Should show confirmation state
    await waitFor(() => {
      expect(screen.getByText('Confirm Delete')).toBeInTheDocument();
    });
  });

  test('confirming delete calls onDeleteSession', async () => {
    render(<SessionSidebar {...defaultProps} />);

    const sessionItem = screen.getByText('First Chat').closest('button')!;
    fireEvent.mouseEnter(sessionItem);

    const menuButton = sessionItem.querySelector('[data-testid="session-menu-trigger"]')!;
    fireEvent.click(menuButton);

    await waitFor(() => {
      fireEvent.click(screen.getByText('Delete'));
    });

    await waitFor(() => {
      fireEvent.click(screen.getByText('Confirm Delete'));
    });

    expect(defaultProps.onDeleteSession).toHaveBeenCalledWith('session-1');
  });
});
