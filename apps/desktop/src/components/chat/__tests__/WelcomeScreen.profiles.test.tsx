import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { WelcomeScreen } from '../WelcomeScreen';
import type { AgentProfile } from '@claude-tauri/shared';

const mockProfiles: AgentProfile[] = [
  {
    id: 'prof-1',
    name: 'Code Reviewer',
    description: 'Reviews code',
    icon: null,
    color: null,
    isDefault: false,
    sortOrder: 0,
    systemPrompt: null,
    useClaudeCodePrompt: true,
    model: 'claude-sonnet',
    effort: null,
    thinkingBudgetTokens: null,
    permissionMode: 'plan',
    allowedTools: [],
    disallowedTools: [],
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
    createdAt: '2026-03-20T00:00:00Z',
    updatedAt: '2026-03-20T00:00:00Z',
  },
  {
    id: 'prof-2',
    name: 'Research Assistant',
    description: 'Researches topics',
    icon: null,
    color: null,
    isDefault: false,
    sortOrder: 1,
    systemPrompt: null,
    useClaudeCodePrompt: true,
    model: 'claude-opus',
    effort: null,
    thinkingBudgetTokens: null,
    permissionMode: 'default',
    allowedTools: [],
    disallowedTools: [],
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
    createdAt: '2026-03-20T00:00:00Z',
    updatedAt: '2026-03-20T00:00:00Z',
  },
];

const defaultProps = {
  onNewChat: vi.fn(),
  onSubmit: vi.fn(),
};

describe('WelcomeScreen profile selector', () => {
  it('renders profile selector when agentProfiles is non-empty and onSelectProfile provided', () => {
    const onSelectProfile = vi.fn();
    render(
      <WelcomeScreen
        {...defaultProps}
        agentProfiles={mockProfiles}
        selectedProfileId={null}
        onSelectProfile={onSelectProfile}
      />,
    );

    // "Start as (optional)" label should be visible
    expect(screen.getByText('Start as (optional)')).toBeDefined();
    // Profile names should be rendered
    expect(screen.getByText('Code Reviewer')).toBeDefined();
    expect(screen.getByText('Research Assistant')).toBeDefined();
    // Default option from ProfileSelector
    expect(screen.getByText('Default')).toBeDefined();
  });

  it('hides profile selector when agentProfiles is empty', () => {
    render(
      <WelcomeScreen
        {...defaultProps}
        agentProfiles={[]}
        selectedProfileId={null}
        onSelectProfile={vi.fn()}
      />,
    );

    expect(screen.queryByText('Start as')).toBeNull();
    expect(screen.queryByText('Default')).toBeNull();
  });

  it('calls onSelectProfile when a profile is clicked', async () => {
    const user = userEvent.setup();
    const onSelectProfile = vi.fn();
    render(
      <WelcomeScreen
        {...defaultProps}
        agentProfiles={mockProfiles}
        selectedProfileId={null}
        onSelectProfile={onSelectProfile}
      />,
    );

    await user.click(screen.getByText('Code Reviewer'));
    expect(onSelectProfile).toHaveBeenCalledWith('prof-1');

    await user.click(screen.getByText('Research Assistant'));
    expect(onSelectProfile).toHaveBeenCalledWith('prof-2');
  });

  it('visually indicates the selected profile', () => {
    render(
      <WelcomeScreen
        {...defaultProps}
        agentProfiles={mockProfiles}
        selectedProfileId="prof-1"
        onSelectProfile={vi.fn()}
      />,
    );

    const selectedButton = screen.getByText('Code Reviewer').closest('button')!;
    const unselectedButton = screen.getByText('Research Assistant').closest('button')!;

    // Selected profile has active styling (border-primary bg-primary/10)
    expect(selectedButton.className).toContain('border-primary');
    expect(selectedButton.className).toContain('bg-primary/10');

    // Unselected profile does not have active styling
    expect(unselectedButton.className).not.toContain('bg-primary/10');
  });

  it('hides profile selector when onSelectProfile is undefined', () => {
    render(
      <WelcomeScreen
        {...defaultProps}
        agentProfiles={mockProfiles}
        selectedProfileId={null}
        // onSelectProfile intentionally omitted
      />,
    );

    expect(screen.queryByText('Start as')).toBeNull();
    expect(screen.queryByText('Code Reviewer')).toBeNull();
    expect(screen.queryByText('Research Assistant')).toBeNull();
  });
});
