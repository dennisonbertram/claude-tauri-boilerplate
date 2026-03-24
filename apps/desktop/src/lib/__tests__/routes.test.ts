import { describe, it, expect } from 'vitest';
import { routes, pathToView } from '../routes';

describe('routes', () => {
  describe('dynamic route builders', () => {
    it('chat() returns /chat with no arg', () => {
      expect(routes.chat()).toBe('/chat');
    });

    it('chat("sid-123") returns /chat/sid-123', () => {
      expect(routes.chat('sid-123')).toBe('/chat/sid-123');
    });

    it('workspaces() returns /workspaces with no arg', () => {
      expect(routes.workspaces()).toBe('/workspaces');
    });

    it('workspaces("proj-1") returns /workspaces/proj-1', () => {
      expect(routes.workspaces('proj-1')).toBe('/workspaces/proj-1');
    });

    it('teams() returns /teams with no arg', () => {
      expect(routes.teams()).toBe('/teams');
    });

    it('teams("team-1") returns /teams/team-1', () => {
      expect(routes.teams('team-1')).toBe('/teams/team-1');
    });

    it('agents() returns /agents with no arg', () => {
      expect(routes.agents()).toBe('/agents');
    });

    it('agents("prof-1") returns /agents/prof-1', () => {
      expect(routes.agents('prof-1')).toBe('/agents/prof-1');
    });
  });

  describe('static routes', () => {
    it('documents is /documents', () => {
      expect(routes.documents).toBe('/documents');
    });

    it('tracker is /tracker', () => {
      expect(routes.tracker).toBe('/tracker');
    });
  });
});

describe('pathToView', () => {
  it('maps /chat to "chat"', () => {
    expect(pathToView('/chat')).toBe('chat');
  });

  it('maps /teams/team-abc to "teams" (prefix match)', () => {
    expect(pathToView('/teams/team-abc')).toBe('teams');
  });

  it('maps /workspaces/proj-1 to "workspaces" (prefix match)', () => {
    expect(pathToView('/workspaces/proj-1')).toBe('workspaces');
  });

  it('maps /agents/prof-1 to "agents" (prefix match)', () => {
    expect(pathToView('/agents/prof-1')).toBe('agents');
  });

  it('maps /documents to "documents" (exact match)', () => {
    expect(pathToView('/documents')).toBe('documents');
  });

  it('maps /tracker to "tracker" (exact match)', () => {
    expect(pathToView('/tracker')).toBe('tracker');
  });

  it('falls back to "chat" for /unknown', () => {
    expect(pathToView('/unknown')).toBe('chat');
  });

  it('falls back to "chat" for root /', () => {
    expect(pathToView('/')).toBe('chat');
  });

  it('falls back to "chat" for empty string', () => {
    expect(pathToView('')).toBe('chat');
  });
});

describe('pathToView edge cases (HashRouter awareness)', () => {
  // HashRouter uses location.pathname which is already stripped of hash.
  // React Router's useLocation().pathname inside HashRouter returns clean paths
  // like "/workspaces/proj-1" (not "#/workspaces/proj-1").
  // These tests document that pathToView works with the clean paths it actually receives.

  it('handles deep nested paths with prefix matching', () => {
    expect(pathToView('/workspaces/proj-1/sub/path')).toBe('workspaces');
    expect(pathToView('/teams/team-abc/details')).toBe('teams');
    expect(pathToView('/agents/prof-1/settings')).toBe('agents');
  });

  it('handles paths with query-like suffixes', () => {
    expect(pathToView('/chat?session=123')).toBe('chat');
    expect(pathToView('/workspaces?filter=active')).toBe('workspaces');
  });
});
