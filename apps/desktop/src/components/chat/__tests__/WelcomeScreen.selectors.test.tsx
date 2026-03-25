import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { WelcomeScreen } from '../WelcomeScreen';
import type { AgentProfile, Project } from '@claude-tauri/shared';

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
];

const mockProject: Project = {
  id: 'project-1',
  name: 'Alpha Demo',
  repoPath: '/Users/me/alpha-demo',
  repoPathCanonical: '/Users/me/alpha-demo',
  defaultBranch: 'main',
  isDeleted: false,
  createdAt: '2026-03-20T00:00:00Z',
  updatedAt: '2026-03-20T00:00:00Z',
};

describe('WelcomeScreen selector helper copy', () => {
  const defaultProps = {
    onNewChat: vi.fn(),
    onSubmit: vi.fn(),
    agentProfiles: mockProfiles,
    selectedProfileId: null,
    onSelectProfile: vi.fn(),
    projects: [mockProject],
    selectedProjectId: null,
    onSelectProject: vi.fn(),
    modelDisplay: 'Haiku 4.5',
    currentModel: 'claude-haiku-4-5-20251001',
    onSelectModel: vi.fn(),
  };

  it('shows composer-first guidance', () => {
    render(<WelcomeScreen {...defaultProps} />);

    expect(
      screen.getByText(/start typing now/i),
    ).toBeInTheDocument();

    const composer = screen.getByRole('textbox', { name: 'Start your first message' });
    const templatesHeading = screen.getByText('Start with a template');
    expect(
      composer.compareDocumentPosition(templatesHeading) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  it('hides optional setup helpers until optional controls are expanded', () => {
    render(<WelcomeScreen {...defaultProps} />);

    expect(screen.queryByText(/start as \(optional\)/i)).toBeNull();
    expect(screen.queryByText(/Model \(optional\)/i)).toBeNull();
    expect(screen.queryByText(/project \(optional\)/i)).toBeNull();
  });

  it('shows optional helper copy for all selectors when expanded', async () => {
    const user = userEvent.setup();
    render(<WelcomeScreen {...defaultProps} />);

    await user.click(screen.getByRole('button', { name: /optional setup controls/i }));

    expect(screen.getByText(/start as \(optional\)/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Choose one to apply its behavior to this chat/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Project \(optional\)/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/Optional workspace context only/i)).toBeInTheDocument();
    expect(screen.getByText(/Model \(optional\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Model choice updates the default for new chats/i)).toBeInTheDocument();
    expect(screen.getByText(/A selected profile can still override it for this run/i)).toBeInTheDocument();
  });

  it('keeps composer as the main first action before template suggestions', () => {
    render(<WelcomeScreen {...defaultProps} />);

    const composer = screen.getByRole('textbox', { name: 'Start your first message' });
    const templatesHeading = screen.getByText('Start with a template');
    expect(
      composer.compareDocumentPosition(templatesHeading) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });
});
