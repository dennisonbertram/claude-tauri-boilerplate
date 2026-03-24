interface ViewSwitcherHeaderProps {
  activeView: 'chat' | 'teams' | 'workspaces' | 'agents' | 'documents' | 'tracker';
  onSwitchView: (view: 'chat' | 'teams' | 'workspaces' | 'agents' | 'documents' | 'tracker') => void;
}

export function ViewSwitcherHeader({ activeView, onSwitchView }: ViewSwitcherHeaderProps) {
  if (activeView !== 'chat') return null;

  const tabs = [
    { view: 'chat' as const, label: 'Chat' },
    { view: 'workspaces' as const, label: 'Code' },
    { view: 'teams' as const, label: 'Cowork' },
    { view: 'tracker' as const, label: 'Tracker' },
  ];

  return (
    <header className="h-14 flex items-center justify-center w-full absolute top-0 z-20 pointer-events-none">
      <div className="bg-sidebar/80 backdrop-blur-md border border-border rounded-full p-1 flex items-center gap-1 shadow-sm pointer-events-auto">
        {tabs.map((tab) => (
          <button
            key={tab.view}
            onClick={() => onSwitchView(tab.view)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium ${
              activeView === tab.view
                ? 'bg-card shadow-sm border border-border text-foreground'
                : 'text-muted-foreground hover:text-foreground transition-colors'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
    </header>
  );
}
