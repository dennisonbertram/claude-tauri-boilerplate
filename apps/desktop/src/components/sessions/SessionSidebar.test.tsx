import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SessionSidebar } from './SessionSidebar';
import type { Session } from '@claude-tauri/shared';

vi.mock('@phosphor-icons/react', () => {
  const Icon = (props: Record<string, unknown>) => <svg data-testid="icon" {...props} />;
  return {
    ChatCircle: Icon,
    Plus: Icon,
  };
});

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

function makeSession(overrides: Partial<Session> = {}): Session {
  return {
    id: 'session-1',
    title: 'Daily standup',
    createdAt: '2026-03-22T12:00:00.000Z',
    updatedAt: '2026-03-22T12:00:00.000Z',
    ...overrides,
  };
}

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

    expect(screen.getByText('First Chat')).toBeTruthy();
    expect(screen.getByText('Second Chat')).toBeTruthy();
  });

  test('groups sessions into Last Week and month buckets', async () => {
    const monthNames = [
      'January',
      'February',
      'March',
      'April',
      'May',
      'June',
      'July',
      'August',
      'September',
      'October',
      'November',
      'December',
    ] as const;

    const now = new Date();
    const dayMs = 24 * 60 * 60 * 1000;
    const toMonthLabel = (date: Date) => `${monthNames[date.getMonth()]} ${date.getFullYear()}`;

    // Create dates that will fall into predictable buckets regardless of current date:
    // - 10 days ago: "Last Week" (7-14 days ago)
    // - 20 days ago: "This Month" or prior month bucket (>14 days, depends on month boundaries)
    // - 40 days ago: Previous month bucket
    // - 70 days ago: Two months ago bucket
    const lastWeekDate = new Date(now.getTime() - (10 * dayMs));
    const olderDate = new Date(now.getTime() - (40 * dayMs));
    const evenOlderDate = new Date(now.getTime() - (70 * dayMs));

    const sessions = [
      makeSession({ id: 'lastWeek', title: 'Last week summary', createdAt: lastWeekDate.toISOString() }),
      makeSession({ id: 'olderDate', title: 'Older summary', createdAt: olderDate.toISOString() }),
      makeSession({ id: 'evenOlder', title: 'Even older summary', createdAt: evenOlderDate.toISOString() }),
    ];

    render(<SessionSidebar {...defaultProps} sessions={sessions} />);

    // Wait for ScrollArea to finish async state updates
    await waitFor(() => {
      expect(screen.getByText('Last Week')).toBeTruthy();
    });

    // The older dates will be in month buckets (exact month depends on current date)
    expect(screen.getByText(toMonthLabel(olderDate))).toBeTruthy();
    expect(screen.getByText(toMonthLabel(evenOlderDate))).toBeTruthy();
    expect(screen.getByText('Last week summary')).toBeTruthy();
    expect(screen.getByText('Older summary')).toBeTruthy();
    expect(screen.getByText('Even older summary')).toBeTruthy();
  });

  test('renders New Chat button', () => {
    render(<SessionSidebar {...defaultProps} />);

    expect(screen.getByRole('button', { name: 'New chat' })).toBeTruthy();
  });

  test('shows empty state when no sessions', () => {
    render(<SessionSidebar {...defaultProps} sessions={[]} />);

    expect(screen.getByText('No conversations yet')).toBeTruthy();
  });

  // ─── Context Menu / Three-dot Menu ───

  test('shows context menu button on session hover', async () => {
    render(<SessionSidebar {...defaultProps} />);

    // The "..." / more button should appear on the session items
    const sessionItem = screen.getByText('First Chat').closest('button')!;
    fireEvent.mouseEnter(sessionItem);

    // Should have a menu trigger (three dots or similar)
    const menuButton = sessionItem.querySelector('[data-testid="session-menu-trigger"]');
    expect(menuButton).toBeTruthy();
  });

  test('opens context menu with right-click on session item', async () => {
    render(<SessionSidebar {...defaultProps} />);

    const sessionItem = screen.getByText('First Chat').closest('button')!;
    fireEvent.contextMenu(sessionItem);

    await waitFor(() => {
      expect(screen.getByText('Rename')).toBeTruthy();
      expect(screen.getByText('Fork')).toBeTruthy();
    });
  });

  test('context menu contains Rename option', async () => {
    render(<SessionSidebar {...defaultProps} />);

    const sessionItem = screen.getByText('First Chat').closest('button')!;
    fireEvent.mouseEnter(sessionItem);

    const menuButton = sessionItem.querySelector('[data-testid="session-menu-trigger"]')!;
    fireEvent.click(menuButton);

    await waitFor(() => {
      expect(screen.getByText('Rename')).toBeTruthy();
    });
  });

  test('context menu contains Fork option', async () => {
    render(<SessionSidebar {...defaultProps} />);

    const sessionItem = screen.getByText('First Chat').closest('button')!;
    fireEvent.mouseEnter(sessionItem);

    const menuButton = sessionItem.querySelector('[data-testid="session-menu-trigger"]')!;
    fireEvent.click(menuButton);

    await waitFor(() => {
      expect(screen.getByText('Fork')).toBeTruthy();
    });
  });

  test('context menu contains Export as JSON option', async () => {
    render(<SessionSidebar {...defaultProps} />);

    const sessionItem = screen.getByText('First Chat').closest('button')!;
    fireEvent.mouseEnter(sessionItem);

    const menuButton = sessionItem.querySelector('[data-testid="session-menu-trigger"]')!;
    fireEvent.click(menuButton);

    await waitFor(() => {
      expect(screen.getByText('Export JSON')).toBeTruthy();
    });
  });

  test('context menu contains Export as Markdown option', async () => {
    render(<SessionSidebar {...defaultProps} />);

    const sessionItem = screen.getByText('First Chat').closest('button')!;
    fireEvent.mouseEnter(sessionItem);

    const menuButton = sessionItem.querySelector('[data-testid="session-menu-trigger"]')!;
    fireEvent.click(menuButton);

    await waitFor(() => {
      expect(screen.getByText('Export Markdown')).toBeTruthy();
    });
  });

  test('context menu contains Delete option', async () => {
    render(<SessionSidebar {...defaultProps} />);

    const sessionItem = screen.getByText('First Chat').closest('button')!;
    fireEvent.mouseEnter(sessionItem);

    const menuButton = sessionItem.querySelector('[data-testid="session-menu-trigger"]')!;
    fireEvent.click(menuButton);

    await waitFor(() => {
      expect(screen.getByText('Delete')).toBeTruthy();
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
    expect(input).toBeTruthy();
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
    expect(screen.getByText('First Chat')).toBeTruthy();
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

  test('clicking Delete shows inline confirmation within the session row', async () => {
    render(<SessionSidebar {...defaultProps} />);

    const sessionItem = screen.getByText('First Chat').closest('button')!;
    fireEvent.mouseEnter(sessionItem);

    const menuButton = sessionItem.querySelector('[data-testid="session-menu-trigger"]')!;
    fireEvent.click(menuButton);

    await waitFor(() => {
      fireEvent.click(screen.getByText('Delete'));
    });

    // Dropdown should be gone; inline confirmation should appear inside the row
    await waitFor(() => {
      const inlineConfirm = screen.getByTestId('inline-delete-confirmation');
      expect(inlineConfirm).toBeTruthy();
      // The inline confirm must be a descendant of the session row button
      expect(sessionItem.contains(inlineConfirm)).toBe(true);
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
      fireEvent.click(screen.getByTestId('confirm-delete-button'));
    });

    expect(defaultProps.onDeleteSession).toHaveBeenCalledWith('session-1');
  });

  // ─── Regression: inline delete confirmation ───

  test('clicking Delete then Cancel does not remove the session', async () => {
    render(<SessionSidebar {...defaultProps} />);

    const sessionItem = screen.getByText('First Chat').closest('button')!;
    fireEvent.mouseEnter(sessionItem);

    const menuButton = sessionItem.querySelector('[data-testid="session-menu-trigger"]')!;
    fireEvent.click(menuButton);

    await waitFor(() => {
      fireEvent.click(screen.getByText('Delete'));
    });

    // Cancel the deletion
    await waitFor(() => {
      fireEvent.click(screen.getByTestId('cancel-delete-button'));
    });

    // onDeleteSession must NOT have been called
    expect(defaultProps.onDeleteSession).not.toHaveBeenCalled();

    // Session title should still be visible (session not removed)
    expect(screen.getByText('First Chat')).toBeTruthy();
  });

  test('the confirmation is contained within the session row, not a separate floating menu', async () => {
    render(<SessionSidebar {...defaultProps} />);

    const sessionItem = screen.getByText('First Chat').closest('button')!;
    fireEvent.mouseEnter(sessionItem);

    const menuButton = sessionItem.querySelector('[data-testid="session-menu-trigger"]')!;
    fireEvent.click(menuButton);

    await waitFor(() => {
      fireEvent.click(screen.getByText('Delete'));
    });

    await waitFor(() => {
      const inlineConfirm = screen.getByTestId('inline-delete-confirmation');

      // Confirmation element is inside the session row button
      expect(sessionItem.contains(inlineConfirm)).toBe(true);

      // No separate floating dropdown should be open (no element with top-full positioning outside the row)
      const floatingMenus = document.querySelectorAll('[class*="top-full"]');
      // Any remaining top-full elements must be inside the session row (not floating outside)
      floatingMenus.forEach((el) => {
        expect(sessionItem.contains(el)).toBe(true);
      });
    });
  });

  // ─── Section Header ───

  test('renders the "CONVERSATIONS" section header', () => {
    render(<SessionSidebar {...defaultProps} />);

    expect(screen.getByText('Conversations')).toBeTruthy();
  });

  test('renders the + button in the section header', () => {
    render(<SessionSidebar {...defaultProps} />);

    const plusButton = screen.getByRole('button', { name: 'New chat' });
    expect(plusButton).toBeTruthy();
  });

  test('clicking the + button in the header calls onNewChat', () => {
    render(<SessionSidebar {...defaultProps} />);

    const plusButton = screen.getByRole('button', { name: 'New chat' });
    fireEvent.click(plusButton);

    expect(defaultProps.onNewChat).toHaveBeenCalledTimes(1);
  });

  test('+ button does not throw when onNewChat is undefined', () => {
    const propsWithoutOnNewChat = {
      ...defaultProps,
      onNewChat: undefined as unknown as () => void,
    };

    render(<SessionSidebar {...propsWithoutOnNewChat} />);

    const plusButton = screen.getByRole('button', { name: 'New chat' });
    expect(() => fireEvent.click(plusButton)).not.toThrow();
  });

  // ─── Regression: header does not break existing functionality ───

  test('New Chat button below header still works', () => {
    render(<SessionSidebar {...defaultProps} />);

    // The icon-only "New chat" header button.
    const newChatButton = screen.getByRole('button', { name: 'New chat' });
    fireEvent.click(newChatButton);

    expect(defaultProps.onNewChat).toHaveBeenCalled();
  });

  test('session list still renders below header', () => {
    render(<SessionSidebar {...defaultProps} />);

    expect(screen.getByText('Conversations')).toBeTruthy();
    expect(screen.getByText('First Chat')).toBeTruthy();
    expect(screen.getByText('Second Chat')).toBeTruthy();
  });

  test('empty state still renders when no sessions', () => {
    render(<SessionSidebar {...defaultProps} sessions={[]} />);

    expect(screen.getByText('Conversations')).toBeTruthy();
    expect(screen.getByText('No conversations yet')).toBeTruthy();
  });

  test('focuses session search with Cmd+K shortcut', async () => {
    render(<SessionSidebar {...defaultProps} />);

    fireEvent.keyDown(document, { key: 'k', metaKey: true });

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Search sessions')).toHaveFocus();
    });
  });

  test('prevents global handlers from consuming Cmd+K for session search', async () => {
    const interceptedWindowShortcut = vi.fn();
    const intercept = () => interceptedWindowShortcut();
    window.addEventListener('keydown', intercept);

    try {
      render(<SessionSidebar {...defaultProps} />);

      fireEvent.keyDown(document, { key: 'k', metaKey: true });

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Search sessions')).toHaveFocus();
      });

      expect(interceptedWindowShortcut).not.toHaveBeenCalled();
    } finally {
      window.removeEventListener('keydown', intercept);
    }
  });
});
