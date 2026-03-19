import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AgentProfileSidebar } from './AgentProfileSidebar';
import type { AgentProfile } from '@claude-tauri/shared';

const makeProfile = (overrides: Partial<AgentProfile> = {}): AgentProfile => ({
  id: 'profile-1',
  name: 'Research Agent',
  description: 'Handles research tasks',
  icon: null,
  color: null,
  isDefault: false,
  sortOrder: 0,
  systemPrompt: null,
  useClaudeCodePrompt: true,
  model: null,
  effort: null,
  thinkingBudgetTokens: null,
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
  createdAt: '2026-03-19T10:00:00.000Z',
  updatedAt: '2026-03-19T10:00:00.000Z',
  ...overrides,
});

const mockProfiles: AgentProfile[] = [
  makeProfile({ id: 'profile-1', name: 'Research Agent', sortOrder: 0 }),
  makeProfile({
    id: 'profile-2',
    name: 'Code Review Agent',
    description: 'Reviews pull requests',
    sortOrder: 1,
    isDefault: true,
    icon: '🔍',
    color: '#ef4444',
  }),
];

const defaultProps = {
  profiles: mockProfiles,
  selectedProfileId: 'profile-1',
  onSelectProfile: vi.fn(),
  onCreateProfile: vi.fn(),
  onDuplicateProfile: vi.fn(),
  onDeleteProfile: vi.fn(),
  loading: false,
};

describe('AgentProfileSidebar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── Section 1: Section Header ───

  test('renders the "AGENT PROFILES" section header', () => {
    render(<AgentProfileSidebar {...defaultProps} />);

    expect(screen.getByText('Agent Profiles')).toBeTruthy();
  });

  test('renders the + button with aria-label "New agent profile"', () => {
    render(<AgentProfileSidebar {...defaultProps} />);

    const button = screen.getByRole('button', { name: 'New agent profile' });
    expect(button).toBeTruthy();
  });

  test('clicking + button calls onCreateProfile', () => {
    render(<AgentProfileSidebar {...defaultProps} />);

    const button = screen.getByRole('button', { name: 'New agent profile' });
    fireEvent.click(button);

    expect(defaultProps.onCreateProfile).toHaveBeenCalledTimes(1);
  });

  // ─── Section 2: Profile List ───

  test('renders a list of agent profiles', () => {
    render(<AgentProfileSidebar {...defaultProps} />);

    expect(screen.getByText('Research Agent')).toBeTruthy();
    expect(screen.getByText('Code Review Agent')).toBeTruthy();
  });

  test('highlights the active profile', () => {
    render(<AgentProfileSidebar {...defaultProps} selectedProfileId="profile-1" />);

    const selectedButton = screen.getByText('Research Agent').closest('button')!;
    expect(selectedButton.className).toContain('bg-sidebar-accent');
    expect(selectedButton.className).toContain('text-sidebar-accent-foreground');

    const unselectedButton = screen.getByText('Code Review Agent').closest('button')!;
    expect(unselectedButton.className).not.toContain('text-sidebar-accent-foreground');
  });

  test('calls onSelectProfile when a profile is clicked', () => {
    render(<AgentProfileSidebar {...defaultProps} />);

    fireEvent.click(screen.getByText('Code Review Agent'));

    expect(defaultProps.onSelectProfile).toHaveBeenCalledWith('profile-2');
  });

  // ─── Section 3: Empty State ───

  test('renders empty state when no profiles exist', () => {
    render(<AgentProfileSidebar {...defaultProps} profiles={[]} />);

    expect(screen.getByText('No agent profiles yet')).toBeTruthy();
  });

  // ─── Section 4: Regression ───

  test('section header renders even with empty profile list', () => {
    render(<AgentProfileSidebar {...defaultProps} profiles={[]} />);

    expect(screen.getByText('Agent Profiles')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'New agent profile' })).toBeTruthy();
  });

  test('renders loading skeletons when loading is true', () => {
    const { container } = render(<AgentProfileSidebar {...defaultProps} loading={true} />);

    const skeletons = container.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBe(3);

    // Should not render profile names while loading
    expect(screen.queryByText('Research Agent')).toBeNull();
  });

  test('renders profiles sorted by sortOrder', () => {
    const reversed = [
      makeProfile({ id: 'p-b', name: 'Beta Agent', sortOrder: 2 }),
      makeProfile({ id: 'p-a', name: 'Alpha Agent', sortOrder: 1 }),
    ];

    render(<AgentProfileSidebar {...defaultProps} profiles={reversed} />);

    const buttons = screen.getAllByRole('button');
    // Filter to profile item buttons (exclude the + button)
    const profileButtons = buttons.filter(
      (b) => b.textContent?.includes('Alpha') || b.textContent?.includes('Beta')
    );
    expect(profileButtons[0].textContent).toContain('Alpha');
    expect(profileButtons[1].textContent).toContain('Beta');
  });
});
