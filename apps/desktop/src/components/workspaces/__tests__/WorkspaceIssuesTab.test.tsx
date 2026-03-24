import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { WorkspaceIssuesTab } from '../WorkspaceIssuesTab';

// Mock useProjectTracker
const mockUseProjectTracker = vi.fn();
vi.mock('@/hooks/useProjectTracker', () => ({
  useProjectTracker: (...args: unknown[]) => mockUseProjectTracker(...args),
}));

// Mock tracker sub-components
vi.mock('@/components/tracker/KanbanBoard', () => ({
  KanbanBoard: () => <div data-testid="kanban-board">KanbanBoard</div>,
}));
vi.mock('@/components/tracker/IssueListView', () => ({
  IssueListView: () => <div data-testid="issue-list-view">IssueListView</div>,
}));
vi.mock('@/components/tracker/IssueDetailPanel', () => ({
  IssueDetailPanel: () => <div data-testid="issue-detail-panel">IssueDetailPanel</div>,
}));
vi.mock('@/components/tracker/CreateIssueDialog', () => ({
  CreateIssueDialog: () => <div data-testid="create-issue-dialog">CreateIssueDialog</div>,
}));
vi.mock('@/components/tracker/TrackerFilters', () => ({
  TrackerFilters: () => <div data-testid="tracker-filters">TrackerFilters</div>,
}));

const defaultHookReturn = {
  loading: false,
  project: {
    id: 'tp-1',
    name: 'Test Project',
    slug: 'test',
    statuses: [],
    labels: [],
    issueCount: 0,
  },
  issues: [],
  createIssue: vi.fn(),
  updateIssue: vi.fn(),
  moveIssue: vi.fn(),
  deleteIssue: vi.fn(),
  addComment: vi.fn(),
};

describe('WorkspaceIssuesTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseProjectTracker.mockReturnValue(defaultHookReturn);
  });

  it('calls useProjectTracker with correct projectId and projectName', () => {
    render(<WorkspaceIssuesTab projectId="proj-123" projectName="My Workspace" />);
    expect(mockUseProjectTracker).toHaveBeenCalledWith('proj-123', 'My Workspace');
  });

  it('shows loading spinner while loading', () => {
    mockUseProjectTracker.mockReturnValue({ ...defaultHookReturn, loading: true, project: null });
    const { container } = render(<WorkspaceIssuesTab projectId="proj-123" projectName="My Workspace" />);
    expect(container.querySelector('.animate-spin')).toBeTruthy();
  });

  it('renders header with Issues title when loaded', () => {
    render(<WorkspaceIssuesTab projectId="proj-123" projectName="My Workspace" />);
    expect(screen.getByText('Issues')).toBeInTheDocument();
  });

  it('renders view mode toggle buttons', () => {
    render(<WorkspaceIssuesTab projectId="proj-123" projectName="My Workspace" />);
    expect(screen.getByTestId('view-mode-kanban')).toBeInTheDocument();
    expect(screen.getByTestId('view-mode-list')).toBeInTheDocument();
  });

  it('renders create issue button', () => {
    render(<WorkspaceIssuesTab projectId="proj-123" projectName="My Workspace" />);
    expect(screen.getByTestId('create-issue-button')).toBeInTheDocument();
  });

  it('renders KanbanBoard by default', () => {
    render(<WorkspaceIssuesTab projectId="proj-123" projectName="My Workspace" />);
    expect(screen.getByTestId('kanban-board')).toBeInTheDocument();
  });

  it('renders TrackerFilters when project is loaded', () => {
    render(<WorkspaceIssuesTab projectId="proj-123" projectName="My Workspace" />);
    expect(screen.getByTestId('tracker-filters')).toBeInTheDocument();
  });

  it('shows fallback message when no project is available', () => {
    mockUseProjectTracker.mockReturnValue({ ...defaultHookReturn, project: null });
    render(<WorkspaceIssuesTab projectId="proj-123" projectName="My Workspace" />);
    expect(screen.getByText('No tracker project available')).toBeInTheDocument();
  });
});
