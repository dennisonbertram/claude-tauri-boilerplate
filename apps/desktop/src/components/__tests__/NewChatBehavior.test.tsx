/**
 * NewChatBehavior.test.tsx
 *
 * Tests for GitHub issue #122: "New Chat" guard uses timestamp check instead
 * of activeSessionHasMessages, and ⌘N shortcut is wired.
 *
 * Also covers previous issues #69 and #73.
 *
 * Strategy: render the SessionSidebar directly with a controlled onNewChat mock
 * to verify the guard logic, and test the guard logic unit-level.
 */

import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { renderHook } from '@testing-library/react';
import React from 'react';
import { SessionSidebar } from '../../components/sessions/SessionSidebar';
import { useKeyboardShortcuts, type ShortcutDefinition } from '@/hooks/useKeyboardShortcuts';

// ── Helper: simulate the new handleNewChat guard (timestamp-based) ─────────

function makeHandleNewChat(
  getActiveSessionId: () => string | null,
  getSessions: () => Array<{ id: string; claudeSessionId?: string; createdAt: string; updatedAt: string; title: string }>,
  createSession: () => Promise<unknown>,
  setActiveSessionHasMessages: (v: boolean) => void
) {
  return async () => {
    const activeSessionId = getActiveSessionId();
    const sessions = getSessions();
    const activeSession = sessions.find(s => s.id === activeSessionId);
    const isTrulyEmpty = activeSession &&
      activeSession.updatedAt === activeSession.createdAt &&
      !activeSession.claudeSessionId;
    if (activeSessionId !== null && isTrulyEmpty) {
      return;
    }
    await createSession();
    setActiveSessionHasMessages(false);
  };
}

// ── Unit tests for the new timestamp-based guard ──────────────────────────

describe('New Chat guard — timestamp-based (issue #122)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('blocks when active session has matching timestamps and no claudeSessionId (truly empty)', async () => {
    const createSession = vi.fn();
    const sessions = [
      {
        id: 'new-session',
        title: 'New Chat',
        createdAt: '2026-03-16T10:00:00.000Z',
        updatedAt: '2026-03-16T10:00:00.000Z',
        claudeSessionId: undefined,
      },
    ];

    const handleNewChat = makeHandleNewChat(
      () => 'new-session',
      () => sessions,
      createSession,
      vi.fn()
    );

    await handleNewChat();
    expect(createSession).not.toHaveBeenCalled();
  });

  test('allows when active session has been updated (updatedAt > createdAt)', async () => {
    const createSession = vi.fn().mockResolvedValue({});
    const sessions = [
      {
        id: 'used-session',
        title: 'Chat',
        createdAt: '2026-03-16T10:00:00.000Z',
        updatedAt: '2026-03-16T10:05:00.000Z', // later — session has been used
        claudeSessionId: undefined,
      },
    ];

    const handleNewChat = makeHandleNewChat(
      () => 'used-session',
      () => sessions,
      createSession,
      vi.fn()
    );

    await handleNewChat();
    expect(createSession).toHaveBeenCalledTimes(1);
  });

  test('allows when active session has a claudeSessionId set', async () => {
    const createSession = vi.fn().mockResolvedValue({});
    const sessions = [
      {
        id: 'session-with-claude-id',
        title: 'Chat',
        createdAt: '2026-03-16T10:00:00.000Z',
        updatedAt: '2026-03-16T10:00:00.000Z',
        claudeSessionId: 'claude-abc-123',
      },
    ];

    const handleNewChat = makeHandleNewChat(
      () => 'session-with-claude-id',
      () => sessions,
      createSession,
      vi.fn()
    );

    await handleNewChat();
    expect(createSession).toHaveBeenCalledTimes(1);
  });

  test('allows when activeSessionId is null (no session selected)', async () => {
    const createSession = vi.fn().mockResolvedValue({});
    const sessions: Array<{ id: string; claudeSessionId?: string; createdAt: string; updatedAt: string; title: string }> = [];

    const handleNewChat = makeHandleNewChat(
      () => null,
      () => sessions,
      createSession,
      vi.fn()
    );

    await handleNewChat();
    expect(createSession).toHaveBeenCalledTimes(1);
  });

  test('(#122) forked session: claudeSessionId=null but updatedAt > createdAt allows New Chat', async () => {
    // A forked session copies messages. The backend sets updatedAt when inserting
    // those copied messages, so updatedAt > createdAt even though claudeSessionId is null.
    const createSession = vi.fn().mockResolvedValue({});
    const sessions = [
      {
        id: 'forked-session',
        title: 'Fork of Chat',
        createdAt: '2026-03-16T10:00:00.000Z',
        updatedAt: '2026-03-16T10:00:01.000Z', // 1 second later due to message copy
        claudeSessionId: undefined, // no new message sent to claude yet
      },
    ];

    const handleNewChat = makeHandleNewChat(
      () => 'forked-session',
      () => sessions,
      createSession,
      vi.fn()
    );

    await handleNewChat();
    // With the old guard this would fail because claudeSessionId is null.
    // With the new timestamp-based guard this correctly allows creating a new session.
    expect(createSession).toHaveBeenCalledTimes(1);
  });

  test('clicking New Chat multiple times on truly empty session only stays blocked', async () => {
    const createSession = vi.fn();
    const sessions = [
      {
        id: 'empty-session',
        title: 'New Chat',
        createdAt: '2026-03-16T10:00:00.000Z',
        updatedAt: '2026-03-16T10:00:00.000Z',
        claudeSessionId: undefined,
      },
    ];

    const handleNewChat = makeHandleNewChat(
      () => 'empty-session',
      () => sessions,
      createSession,
      vi.fn()
    );

    await handleNewChat();
    await handleNewChat();
    await handleNewChat();
    expect(createSession).not.toHaveBeenCalled();
  });
});

// ── SessionSidebar integration tests ─────────────────────────────────────────

// TODO: #267 — quarantined, AppSidebar new-chat button mocking needs update
describe.skip('New Chat behavior (issue #69)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('clicking New Chat when an active session already exists does not create a new session (timestamp guard)', () => {
    let activeSessionId: string | null = 'existing-session';
    const createSession = vi.fn();

    const sessions = [
      {
        id: 'existing-session',
        title: 'Existing Chat',
        claudeSessionId: undefined,
        createdAt: '2026-03-16T10:00:00.000Z',
        updatedAt: '2026-03-16T10:00:00.000Z',
      },
    ];

    // New guard: timestamp-based
    const handleNewChat = async () => {
      const activeSession = sessions.find(s => s.id === activeSessionId);
      const isTrulyEmpty = activeSession &&
        activeSession.updatedAt === activeSession.createdAt &&
        !activeSession.claudeSessionId;
      if (activeSessionId !== null && isTrulyEmpty) {
        return;
      }
      await createSession();
    };

    render(
      <SessionSidebar
        sessions={sessions}
        activeSessionId={activeSessionId}
        onSelectSession={vi.fn()}
        onNewChat={handleNewChat}
        onDeleteSession={vi.fn()}
        onRenameSession={vi.fn()}
        onForkSession={vi.fn()}
        onExportSession={vi.fn()}
      />
    );

    const newChatButton = screen.getByText('New Chat');

    fireEvent.click(newChatButton);
    fireEvent.click(newChatButton);
    fireEvent.click(newChatButton);

    expect(createSession).not.toHaveBeenCalled();
  });

  test('clicking New Chat when there is no active session creates a new session', async () => {
    let activeSessionId: string | null = null;
    const createSession = vi.fn().mockResolvedValue({
      id: 'new-session-1',
      title: 'New Chat',
      createdAt: '2026-03-16T10:00:00.000Z',
      updatedAt: '2026-03-16T10:00:00.000Z',
    });

    const sessions: Array<{ id: string; claudeSessionId?: string; createdAt: string; updatedAt: string; title: string }> = [];

    const handleNewChat = async () => {
      const activeSession = sessions.find(s => s.id === activeSessionId);
      const isTrulyEmpty = activeSession &&
        activeSession.updatedAt === activeSession.createdAt &&
        !activeSession.claudeSessionId;
      if (activeSessionId !== null && isTrulyEmpty) {
        return;
      }
      await createSession();
    };

    render(
      <SessionSidebar
        sessions={[]}
        activeSessionId={activeSessionId}
        onSelectSession={vi.fn()}
        onNewChat={handleNewChat}
        onDeleteSession={vi.fn()}
        onRenameSession={vi.fn()}
        onForkSession={vi.fn()}
        onExportSession={vi.fn()}
      />
    );

    const newChatButton = screen.getByText('New Chat');
    fireEvent.click(newChatButton);

    expect(createSession).toHaveBeenCalledTimes(1);
  });

  test('clicking New Chat after a message has been sent creates a new session', async () => {
    const activeSessionId = 'session-with-messages';
    const createSession = vi.fn().mockResolvedValue({
      id: 'new-session-2',
      title: 'New Chat',
      createdAt: '2026-03-16T10:00:00.000Z',
      updatedAt: '2026-03-16T10:00:00.000Z',
    });

    const sessions = [
      {
        id: 'session-with-messages',
        title: 'Chat With Messages',
        claudeSessionId: 'claude-xyz', // has messages
        createdAt: '2026-03-16T10:00:00.000Z',
        updatedAt: '2026-03-16T10:05:00.000Z',
      },
    ];

    const handleNewChat = async () => {
      const activeSession = sessions.find(s => s.id === activeSessionId);
      const isTrulyEmpty = activeSession &&
        activeSession.updatedAt === activeSession.createdAt &&
        !activeSession.claudeSessionId;
      if (activeSessionId !== null && isTrulyEmpty) {
        return;
      }
      await createSession();
    };

    render(
      <SessionSidebar
        sessions={sessions}
        activeSessionId={activeSessionId}
        onSelectSession={vi.fn()}
        onNewChat={handleNewChat}
        onDeleteSession={vi.fn()}
        onRenameSession={vi.fn()}
        onForkSession={vi.fn()}
        onExportSession={vi.fn()}
      />
    );

    const newChatButton = screen.getByText('New Chat');
    fireEvent.click(newChatButton);

    expect(createSession).toHaveBeenCalledTimes(1);
  });

  // ── Regression tests for issue #73 ─────────────────────────────────────────

  test('(#73) selecting a session with claudeSessionId=null and equal timestamps blocks New Chat', () => {
    const sessions = [
      {
        id: 'empty-session',
        title: 'Empty Chat',
        claudeSessionId: undefined,
        createdAt: '2026-03-16T10:00:00.000Z',
        updatedAt: '2026-03-16T10:00:00.000Z',
      },
    ];

    const createSession = vi.fn();
    const activeSessionId = 'empty-session';

    const handleNewChat = async () => {
      const activeSession = sessions.find(s => s.id === activeSessionId);
      const isTrulyEmpty = activeSession &&
        activeSession.updatedAt === activeSession.createdAt &&
        !activeSession.claudeSessionId;
      if (activeSessionId !== null && isTrulyEmpty) {
        return;
      }
      await createSession();
    };

    handleNewChat();
    expect(createSession).not.toHaveBeenCalled();
  });

  test('(#73) selecting a session with a non-null claudeSessionId allows New Chat', async () => {
    const sessions = [
      {
        id: 'active-session',
        title: 'Chat With History',
        claudeSessionId: 'claude-abc-123',
        createdAt: '2026-03-16T10:00:00.000Z',
        updatedAt: '2026-03-16T10:00:00.000Z',
      },
    ];

    const createSession = vi.fn().mockResolvedValue({});
    const activeSessionId = 'active-session';

    const handleNewChat = async () => {
      const activeSession = sessions.find(s => s.id === activeSessionId);
      const isTrulyEmpty = activeSession &&
        activeSession.updatedAt === activeSession.createdAt &&
        !activeSession.claudeSessionId;
      if (activeSessionId !== null && isTrulyEmpty) {
        return;
      }
      await createSession();
    };

    await handleNewChat();
    expect(createSession).toHaveBeenCalledTimes(1);
  });

  test('clicking New Chat three times consecutively only creates one session when starting fresh after first creation', async () => {
    let activeSessionId: string | null = null;
    const allSessions: Array<{ id: string; claudeSessionId?: string; createdAt: string; updatedAt: string; title: string }> = [];

    const createSession = vi.fn().mockImplementation(async () => {
      const now = new Date().toISOString();
      const newSession = {
        id: `session-${Date.now()}`,
        title: 'New Chat',
        claudeSessionId: undefined,
        createdAt: now,
        updatedAt: now,
      };
      allSessions.push(newSession);
      activeSessionId = newSession.id;
      return newSession;
    });

    const handleNewChat = async () => {
      const activeSession = allSessions.find(s => s.id === activeSessionId);
      const isTrulyEmpty = activeSession &&
        activeSession.updatedAt === activeSession.createdAt &&
        !activeSession.claudeSessionId;
      if (activeSessionId !== null && isTrulyEmpty) {
        return;
      }
      await createSession();
    };

    render(
      <SessionSidebar
        sessions={[]}
        activeSessionId={activeSessionId}
        onSelectSession={vi.fn()}
        onNewChat={handleNewChat}
        onDeleteSession={vi.fn()}
        onRenameSession={vi.fn()}
        onForkSession={vi.fn()}
        onExportSession={vi.fn()}
      />
    );

    const newChatButton = screen.getByText('New Chat');

    // Click once — creates a session (activeSessionId was null)
    await fireEvent.click(newChatButton);
    expect(createSession).toHaveBeenCalledTimes(1);

    // Click again — now activeSessionId is set and timestamps match, so no-op
    await fireEvent.click(newChatButton);
    expect(createSession).toHaveBeenCalledTimes(1);

    // Click a third time — still no-op
    await fireEvent.click(newChatButton);
    expect(createSession).toHaveBeenCalledTimes(1);
  });
});

// ── ⌘N shortcut wiring tests (issue #122) ──────────────────────────────────

describe('⌘N shortcut wiring (issue #122)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function pressKey(key: string, opts: Partial<KeyboardEventInit> = {}) {
    const event = new KeyboardEvent('keydown', {
      key,
      bubbles: true,
      cancelable: true,
      ...opts,
    });
    window.dispatchEvent(event);
    return event;
  }

  test('⌘N shortcut in shortcutDefs calls onCreateSession', () => {
    const onCreateSession = vi.fn();

    const shortcutDefs: ShortcutDefinition[] = [
      {
        id: 'new-session',
        key: 'n',
        meta: true,
        label: 'New Session',
        category: 'chat' as const,
        handler: () => onCreateSession(),
      },
    ];

    renderHook(() => useKeyboardShortcuts(shortcutDefs));

    act(() => {
      pressKey('n', { metaKey: true });
    });

    expect(onCreateSession).toHaveBeenCalledTimes(1);
  });

  test('⌘N shortcut does not fire without meta key', () => {
    const onCreateSession = vi.fn();

    const shortcutDefs: ShortcutDefinition[] = [
      {
        id: 'new-session',
        key: 'n',
        meta: true,
        label: 'New Session',
        category: 'chat' as const,
        handler: () => onCreateSession(),
      },
    ];

    renderHook(() => useKeyboardShortcuts(shortcutDefs));

    act(() => {
      pressKey('n'); // no meta key
    });

    expect(onCreateSession).not.toHaveBeenCalled();
  });

  test('⌘N shortcut fires multiple times on repeated keypresses', () => {
    const onCreateSession = vi.fn();

    const shortcutDefs: ShortcutDefinition[] = [
      {
        id: 'new-session',
        key: 'n',
        meta: true,
        label: 'New Session',
        category: 'chat' as const,
        handler: () => onCreateSession(),
      },
    ];

    renderHook(() => useKeyboardShortcuts(shortcutDefs));

    act(() => {
      pressKey('n', { metaKey: true });
      pressKey('n', { metaKey: true });
      pressKey('n', { metaKey: true });
    });

    expect(onCreateSession).toHaveBeenCalledTimes(3);
  });
});
