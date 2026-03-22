/**
 * AppSidebar.contextmenu.test.tsx
 *
 * Regression tests for GitHub issue #302: session context menu
 * (rename, fork, export, delete) in the AppSidebar.
 */

import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import React from 'react';
import { AppSidebar } from '../AppSidebar';
import type { Session } from '@claude-tauri/shared';

// Minimal session fixture
function makeSession(overrides: Partial<Session> = {}): Session {
  return {
    id: 'sess-1',
    title: 'Test Session',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

// Default props that satisfy the AppSidebar interface
function defaultProps(overrides: Record<string, unknown> = {}) {
  return {
    activeView: 'chat' as const,
    onSelectView: vi.fn(),
    sessions: [makeSession()],
    activeSessionId: null,
    searchQuery: '',
    onSearchQueryChange: vi.fn(),
    onSelectSession: vi.fn(),
    onNewChat: vi.fn(),
    onDeleteSession: vi.fn(),
    onRenameSession: vi.fn(),
    onForkSession: vi.fn(),
    onExportSession: vi.fn(),
    projects: [],
    workspacesByProject: {},
    selectedWorkspaceId: null,
    onSelectWorkspace: vi.fn(),
    onAddProject: vi.fn(),
    sidebarOpen: true,
    onToggleSidebar: vi.fn(),
    onOpenSettings: vi.fn(),
    ...overrides,
  };
}

describe('AppSidebar session context menu', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  test('hovering a session row shows the three-dot menu trigger', () => {
    render(<AppSidebar {...defaultProps()} />);

    const sessionItem = screen.getByTestId('session-item-sess-1');
    expect(screen.queryByTestId('session-menu-trigger')).toBeNull();

    fireEvent.mouseEnter(sessionItem);
    expect(screen.getByTestId('session-menu-trigger')).toBeTruthy();
  });

  test('clicking the menu trigger opens dropdown with all expected options', () => {
    render(<AppSidebar {...defaultProps()} />);

    const sessionItem = screen.getByTestId('session-item-sess-1');
    fireEvent.mouseEnter(sessionItem);

    const trigger = screen.getByTestId('session-menu-trigger');
    fireEvent.click(trigger);

    expect(screen.getByTestId('session-context-menu')).toBeTruthy();
    expect(screen.getByTestId('menu-rename')).toBeTruthy();
    expect(screen.getByTestId('menu-fork')).toBeTruthy();
    expect(screen.getByTestId('menu-export-json')).toBeTruthy();
    expect(screen.getByTestId('menu-export-md')).toBeTruthy();
    expect(screen.getByTestId('menu-delete')).toBeTruthy();
  });

  test('selecting Rename enters inline edit mode', () => {
    render(<AppSidebar {...defaultProps()} />);

    const sessionItem = screen.getByTestId('session-item-sess-1');
    fireEvent.mouseEnter(sessionItem);
    fireEvent.click(screen.getByTestId('session-menu-trigger'));
    fireEvent.click(screen.getByTestId('menu-rename'));

    // Rename input should appear
    const input = screen.getByTestId('rename-input');
    expect(input).toBeTruthy();
    expect((input as HTMLInputElement).value).toBe('Test Session');
  });

  test('Enter confirms rename and calls onRenameSession', () => {
    const onRenameSession = vi.fn();
    render(<AppSidebar {...defaultProps({ onRenameSession })} />);

    const sessionItem = screen.getByTestId('session-item-sess-1');
    fireEvent.mouseEnter(sessionItem);
    fireEvent.click(screen.getByTestId('session-menu-trigger'));
    fireEvent.click(screen.getByTestId('menu-rename'));

    const input = screen.getByTestId('rename-input');
    fireEvent.change(input, { target: { value: 'Renamed Session' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onRenameSession).toHaveBeenCalledWith('sess-1', 'Renamed Session');
    // Input should be gone
    expect(screen.queryByTestId('rename-input')).toBeNull();
  });

  test('Escape cancels rename without calling callback', () => {
    const onRenameSession = vi.fn();
    render(<AppSidebar {...defaultProps({ onRenameSession })} />);

    const sessionItem = screen.getByTestId('session-item-sess-1');
    fireEvent.mouseEnter(sessionItem);
    fireEvent.click(screen.getByTestId('session-menu-trigger'));
    fireEvent.click(screen.getByTestId('menu-rename'));

    const input = screen.getByTestId('rename-input');
    fireEvent.change(input, { target: { value: 'Renamed Session' } });
    fireEvent.keyDown(input, { key: 'Escape' });

    expect(onRenameSession).not.toHaveBeenCalled();
    expect(screen.queryByTestId('rename-input')).toBeNull();
  });

  test('Delete shows inline confirmation before deleting', () => {
    const onDeleteSession = vi.fn();
    render(<AppSidebar {...defaultProps({ onDeleteSession })} />);

    const sessionItem = screen.getByTestId('session-item-sess-1');
    fireEvent.mouseEnter(sessionItem);
    fireEvent.click(screen.getByTestId('session-menu-trigger'));
    fireEvent.click(screen.getByTestId('menu-delete'));

    // Should show confirmation, not call delete yet
    expect(onDeleteSession).not.toHaveBeenCalled();
    expect(screen.getByTestId('inline-delete-confirmation')).toBeTruthy();
    expect(screen.getByTestId('confirm-delete-button')).toBeTruthy();
    expect(screen.getByTestId('cancel-delete-button')).toBeTruthy();
  });

  test('confirming delete calls onDeleteSession with correct session ID', () => {
    const onDeleteSession = vi.fn();
    render(<AppSidebar {...defaultProps({ onDeleteSession })} />);

    const sessionItem = screen.getByTestId('session-item-sess-1');
    fireEvent.mouseEnter(sessionItem);
    fireEvent.click(screen.getByTestId('session-menu-trigger'));
    fireEvent.click(screen.getByTestId('menu-delete'));
    fireEvent.click(screen.getByTestId('confirm-delete-button'));

    expect(onDeleteSession).toHaveBeenCalledWith('sess-1');
  });

  test('cancelling delete dismisses the confirmation', () => {
    const onDeleteSession = vi.fn();
    render(<AppSidebar {...defaultProps({ onDeleteSession })} />);

    const sessionItem = screen.getByTestId('session-item-sess-1');
    fireEvent.mouseEnter(sessionItem);
    fireEvent.click(screen.getByTestId('session-menu-trigger'));
    fireEvent.click(screen.getByTestId('menu-delete'));
    fireEvent.click(screen.getByTestId('cancel-delete-button'));

    expect(onDeleteSession).not.toHaveBeenCalled();
    expect(screen.queryByTestId('inline-delete-confirmation')).toBeNull();
  });

  test('Fork calls onForkSession with correct session ID', () => {
    const onForkSession = vi.fn();
    render(<AppSidebar {...defaultProps({ onForkSession })} />);

    const sessionItem = screen.getByTestId('session-item-sess-1');
    fireEvent.mouseEnter(sessionItem);
    fireEvent.click(screen.getByTestId('session-menu-trigger'));
    fireEvent.click(screen.getByTestId('menu-fork'));

    expect(onForkSession).toHaveBeenCalledWith('sess-1');
  });

  test('Export JSON calls onExportSession with json format', () => {
    const onExportSession = vi.fn();
    render(<AppSidebar {...defaultProps({ onExportSession })} />);

    const sessionItem = screen.getByTestId('session-item-sess-1');
    fireEvent.mouseEnter(sessionItem);
    fireEvent.click(screen.getByTestId('session-menu-trigger'));
    fireEvent.click(screen.getByTestId('menu-export-json'));

    expect(onExportSession).toHaveBeenCalledWith('sess-1', 'json');
  });

  test('Export Markdown calls onExportSession with md format', () => {
    const onExportSession = vi.fn();
    render(<AppSidebar {...defaultProps({ onExportSession })} />);

    const sessionItem = screen.getByTestId('session-item-sess-1');
    fireEvent.mouseEnter(sessionItem);
    fireEvent.click(screen.getByTestId('session-menu-trigger'));
    fireEvent.click(screen.getByTestId('menu-export-md'));

    expect(onExportSession).toHaveBeenCalledWith('sess-1', 'md');
  });
});
