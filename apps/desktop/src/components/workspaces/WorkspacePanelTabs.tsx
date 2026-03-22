type Tab = 'chat' | 'diff' | 'paths' | 'notes' | 'dashboards';

interface WorkspacePanelTabsProps {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
}

export function WorkspacePanelTabs({ activeTab, onTabChange }: WorkspacePanelTabsProps) {
  const tabClass = (tab: Tab) =>
    `px-4 py-2 text-sm font-medium transition-colors ${
      activeTab === tab
        ? 'border-b-2 border-primary text-foreground'
        : 'text-muted-foreground hover:text-foreground'
    }`;

  return (
    <div className="flex border-b border-border">
      <button type="button" onClick={() => onTabChange('chat')} className={tabClass('chat')}>
        Chat
      </button>
      <button type="button" onClick={() => onTabChange('diff')} className={tabClass('diff')}>
        Diff
      </button>
      <button type="button" onClick={() => onTabChange('paths')} className={tabClass('paths')}>
        Paths
      </button>
      <button type="button" onClick={() => onTabChange('notes')} className={tabClass('notes')}>
        Notes
      </button>
      <button
        type="button"
        onClick={() => onTabChange('dashboards')}
        className={`flex items-center gap-1.5 ${tabClass('dashboards')}`}
      >
        <svg
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <rect x="3" y="3" width="7" height="7" />
          <rect x="14" y="3" width="7" height="7" />
          <rect x="14" y="14" width="7" height="7" />
          <rect x="3" y="14" width="7" height="7" />
        </svg>
        Dashboards
      </button>
    </div>
  );
}
