import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AgentBuilderView } from '../AgentBuilderView';
import type { AgentProfile } from '@claude-tauri/shared';

function makeProfile(overrides: Partial<AgentProfile> = {}): AgentProfile {
  return {
  id: 'profile-1',
  name: 'Research Agent',
  description: 'Handles research tasks',
  icon: '🤖',
  color: '#6b7280',
  isDefault: false,
  sortOrder: 0,
  systemPrompt: null,
  useClaudeCodePrompt: true,
  model: null,
  effort: 'medium',
  thinkingBudgetTokens: 10000,
  allowedTools: [],
  disallowedTools: [],
  permissionMode: 'default',
  hooksJson: null,
  hooksCanvasJson: null,
  mcpServersJson: null,
  sandboxJson: null,
  cwd: null,
  additionalDirectories: [],
  settingSources: [],
  maxTurns: null,
  maxBudgetUsd: null,
  agentsJson: null,
  createdAt: '2026-03-24T00:00:00.000Z',
  updatedAt: '2026-03-24T00:00:00.000Z',
  ...overrides,
  };
}

const { addProfile, generateProfile } = vi.hoisted(() => ({
  addProfile: vi.fn(),
  generateProfile: vi.fn(),
}));

vi.mock('@/hooks/useAgentProfiles', () => ({
  useAgentProfiles: () => ({
    profiles: [makeProfile()],
    loading: false,
    error: null,
    addProfile,
    updateProfile: vi.fn(),
    removeProfile: vi.fn(),
    duplicateProfile: vi.fn(),
    generateProfile,
    refresh: vi.fn(),
  }),
}));

describe('AgentBuilderView create modal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    addProfile.mockResolvedValue(makeProfile({ id: 'created-profile', name: 'New Agent Profile' }));
    generateProfile.mockResolvedValue(makeProfile({ id: 'generated-profile', name: 'Research Scout' }));
  });

  it('opens the create modal from the sidebar button', async () => {
    const user = userEvent.setup();

    render(<AgentBuilderView />);

    await user.click(screen.getByRole('button', { name: 'New agent profile' }));

    expect(await screen.findByRole('dialog', { name: 'Create a new agent' })).toBeInTheDocument();
  });

  it('creates a blank profile from the modal', async () => {
    const user = userEvent.setup();

    render(<AgentBuilderView />);

    await user.click(screen.getByRole('button', { name: 'New agent profile' }));
    await user.click(screen.getByRole('button', { name: /create blank profile/i }));

    await waitFor(() => {
      expect(addProfile).toHaveBeenCalledWith({ name: 'New Agent Profile' });
    });

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Create a new agent' })).not.toBeInTheDocument();
    });
  });

  it('generates a profile with AI from the modal prompt', async () => {
    const user = userEvent.setup();

    render(<AgentBuilderView />);

    await user.click(screen.getByRole('button', { name: 'New agent profile' }));
    await user.type(screen.getByLabelText(/agent idea/i), 'A focused code review agent');
    await user.click(screen.getByRole('button', { name: /generate with ai/i }));

    await waitFor(() => {
      expect(generateProfile).toHaveBeenCalledWith({ prompt: 'A focused code review agent' });
    });

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Create a new agent' })).not.toBeInTheDocument();
    });
  });
});
