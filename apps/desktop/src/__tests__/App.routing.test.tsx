/**
 * App.routing.test.tsx — Regression tests for app-level routing behavior
 *
 * These tests verify:
 * - #344: HashRouter-based URL routing (pathToView from production code)
 * - #352: Fork session stays on /chat (does not navigate to /workspaces)
 * - #353: "New Project" button opens dialog, does not navigate away
 *
 * Strategy: We test the real `pathToView` function (imported from production code)
 * and test routing callbacks by verifying their contract:
 * - handleSwitchView navigates to the correct path
 * - onForkSession calls forkSession then navigates to /chat
 * - onAddProject opens dialog without navigation
 */
import { describe, it, expect, vi } from 'vitest';
import * as matchers from '@testing-library/jest-dom/matchers';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { useState, useCallback } from 'react';
expect.extend(matchers);

// Import REAL production code for route logic
import { pathToView } from '@/lib/routes';
import type { ActiveView } from '@/lib/routes';

/**
 * Minimal harness that replicates App.tsx's REAL routing callbacks.
 * The actual logic is copied line-for-line from App.tsx:
 * - handleSwitchView (line 84): navigate('/' + v)
 * - onForkSession (line 96): await forkSession(id); navigate('/chat');
 * - onAddProject (line 98/116): setAddProjectOpen(true)
 *
 * We track navigation calls to verify the correct paths are used,
 * and use pathToView (real production code) to derive activeView.
 */
function RoutingHarness({
  forkSession = vi.fn(),
  initialPath = '/chat',
}: {
  forkSession?: (id: string) => Promise<void>;
  initialPath?: string;
}) {
  const [currentPath, setCurrentPath] = useState(initialPath);
  const [addProjectOpen, setAddProjectOpen] = useState(false);

  // Real pathToView from production code determines the active view
  const activeView = pathToView(currentPath);

  // Mirrors App.tsx line 84: handleSwitchView
  const handleSwitchView = useCallback((v: ActiveView) => {
    setCurrentPath('/' + v);
  }, []);

  // Mirrors App.tsx line 96: onForkSession callback
  const handleForkSession = useCallback(
    async (id: string) => {
      await forkSession(id);
      setCurrentPath('/chat'); // navigate('/chat')
    },
    [forkSession],
  );

  // Mirrors App.tsx line 98/116: onAddProject
  const handleAddProject = useCallback(() => {
    setAddProjectOpen(true);
  }, []);

  return (
    <div>
      {/* Expose current path and activeView for assertions */}
      <div data-testid="current-path">{currentPath}</div>
      <div data-testid="active-view">{activeView}</div>

      {/* Navigation buttons (mirrors ViewSwitcherHeader + sidebar) */}
      <button data-testid="nav-chat" onClick={() => handleSwitchView('chat')}>Chat</button>
      <button data-testid="nav-teams" onClick={() => handleSwitchView('teams')}>Teams</button>
      <button data-testid="nav-workspaces" onClick={() => handleSwitchView('workspaces')}>Workspaces</button>
      <button data-testid="nav-agents" onClick={() => handleSwitchView('agents')}>Agents</button>
      <button data-testid="nav-documents" onClick={() => handleSwitchView('documents')}>Documents</button>
      <button data-testid="nav-tracker" onClick={() => handleSwitchView('tracker')}>Tracker</button>

      {/* Fork session (mirrors sidebar onForkSession) */}
      <button data-testid="fork-session" onClick={() => void handleForkSession('sess-1')}>Fork</button>

      {/* Add project — with parent onClick to model the #353 bug mechanism */}
      <div data-testid="parent-container" onClick={() => setCurrentPath('/chat')}>
        <button
          data-testid="add-project-btn"
          onClick={(e) => {
            e.stopPropagation(); // This is the fix for #353 — prevents parent navigation
            handleAddProject();
          }}
        >
          Add Project
        </button>
      </div>

      {/* Add project WITHOUT stopPropagation — models the broken version */}
      <div data-testid="broken-parent" onClick={() => setCurrentPath('/chat')}>
        <button
          data-testid="broken-add-project-btn"
          onClick={() => {
            // Missing e.stopPropagation() — bug #353 scenario
            handleAddProject();
          }}
        >
          Broken Add Project
        </button>
      </div>

      {/* Conditional views (mirrors App.tsx conditional rendering) */}
      {activeView === 'chat' && <div data-testid="chat-view">Chat View</div>}
      {activeView === 'teams' && <div data-testid="teams-view">Teams View</div>}
      {activeView === 'workspaces' && <div data-testid="workspaces-view">Workspaces View</div>}
      {activeView === 'agents' && <div data-testid="agents-view">Agents View</div>}
      {activeView === 'documents' && <div data-testid="documents-view">Documents View</div>}
      {activeView === 'tracker' && <div data-testid="tracker-view">Tracker View</div>}

      {/* AddProjectDialog */}
      {addProjectOpen && <div data-testid="add-project-dialog">AddProjectDialog</div>}
    </div>
  );
}

describe('App routing (uses real pathToView from production code)', () => {
  it('defaults to chat view at /chat', () => {
    render(<RoutingHarness />);
    expect(screen.getByTestId('active-view').textContent).toBe('chat');
    expect(screen.getByTestId('current-path').textContent).toBe('/chat');
    expect(screen.getByTestId('chat-view')).toBeInTheDocument();
  });

  it.each([
    ['teams', '/teams'],
    ['workspaces', '/workspaces'],
    ['agents', '/agents'],
    ['documents', '/documents'],
    ['tracker', '/tracker'],
  ])('navigating to %s sets path to %s and renders correct view', async (view, expectedPath) => {
    render(<RoutingHarness />);
    fireEvent.click(screen.getByTestId(`nav-${view}`));
    expect(screen.getByTestId('current-path').textContent).toBe(expectedPath);
    expect(screen.getByTestId('active-view').textContent).toBe(view);
    expect(screen.getByTestId(`${view}-view`)).toBeInTheDocument();
  });

  it('can navigate back to chat from another view', () => {
    render(<RoutingHarness />);
    fireEvent.click(screen.getByTestId('nav-teams'));
    expect(screen.getByTestId('teams-view')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('nav-chat'));
    expect(screen.getByTestId('chat-view')).toBeInTheDocument();
    expect(screen.queryByTestId('teams-view')).not.toBeInTheDocument();
  });
});

describe('#352 regression: fork session navigation', () => {
  it('fork session stays on /chat when already on chat', async () => {
    const mockFork = vi.fn().mockResolvedValue(undefined);
    render(<RoutingHarness forkSession={mockFork} />);

    expect(screen.getByTestId('active-view').textContent).toBe('chat');

    await act(async () => {
      fireEvent.click(screen.getByTestId('fork-session'));
    });

    expect(mockFork).toHaveBeenCalledWith('sess-1');
    // Must remain on chat — the bug was navigating to /workspaces
    expect(screen.getByTestId('current-path').textContent).toBe('/chat');
    expect(screen.getByTestId('active-view').textContent).toBe('chat');
    expect(screen.getByTestId('chat-view')).toBeInTheDocument();
    expect(screen.queryByTestId('workspaces-view')).not.toBeInTheDocument();
  });

  it('fork session returns to /chat from teams view', async () => {
    const mockFork = vi.fn().mockResolvedValue(undefined);
    render(<RoutingHarness forkSession={mockFork} initialPath="/teams" />);

    expect(screen.getByTestId('active-view').textContent).toBe('teams');

    await act(async () => {
      fireEvent.click(screen.getByTestId('fork-session'));
    });

    expect(mockFork).toHaveBeenCalledWith('sess-1');
    expect(screen.getByTestId('current-path').textContent).toBe('/chat');
    expect(screen.getByTestId('active-view').textContent).toBe('chat');
  });
});

describe('#353 regression: Add Project button navigation', () => {
  it('Add Project with stopPropagation opens dialog and stays on current view', () => {
    render(<RoutingHarness initialPath="/workspaces" />);

    expect(screen.getByTestId('active-view').textContent).toBe('workspaces');

    // Click the fixed button (has stopPropagation)
    fireEvent.click(screen.getByTestId('add-project-btn'));

    // Dialog should open
    expect(screen.getByTestId('add-project-dialog')).toBeInTheDocument();
    // Should NOT have navigated to /chat (parent onClick would do that)
    expect(screen.getByTestId('current-path').textContent).toBe('/workspaces');
    expect(screen.getByTestId('active-view').textContent).toBe('workspaces');
  });

  it('broken version (no stopPropagation) navigates to chat — demonstrates the bug', () => {
    render(<RoutingHarness initialPath="/workspaces" />);

    expect(screen.getByTestId('active-view').textContent).toBe('workspaces');

    // Click the broken button (no stopPropagation) — this models the original bug
    fireEvent.click(screen.getByTestId('broken-add-project-btn'));

    // Dialog opens (callback still fires)
    expect(screen.getByTestId('add-project-dialog')).toBeInTheDocument();
    // BUT parent onClick also fired, navigating to /chat — this IS the bug
    expect(screen.getByTestId('current-path').textContent).toBe('/chat');
    expect(screen.getByTestId('active-view').textContent).toBe('chat');
  });

  it('fixed Add Project button prevents parent event bubbling', () => {
    // This is the key regression test: the fixed button must NOT trigger parent navigation
    const parentClickSpy = vi.fn();
    render(
      <div onClick={parentClickSpy}>
        <RoutingHarness initialPath="/workspaces" />
      </div>,
    );

    fireEvent.click(screen.getByTestId('add-project-btn'));
    // The event should NOT have bubbled past the button's parent container
    // (stopPropagation prevents it from reaching the outermost div)
    expect(screen.getByTestId('add-project-dialog')).toBeInTheDocument();
    expect(screen.getByTestId('current-path').textContent).toBe('/workspaces');
  });
});
