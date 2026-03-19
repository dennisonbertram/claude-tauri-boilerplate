import { MessageSquare, FolderOpen, Users, Bot, Settings, User } from 'lucide-react';

type ActiveView = 'chat' | 'workspaces' | 'teams' | 'agents';

interface ActivityBarProps {
  activeView: ActiveView;
  onSelectView: (view: ActiveView) => void;
  onOpenSettings: () => void;
  email?: string;
  plan?: string;
}

const viewItems: { view: ActiveView; icon: typeof MessageSquare; label: string; title: string }[] = [
  {
    view: 'chat',
    icon: MessageSquare,
    label: 'Chat',
    title: 'Chat — Standalone conversations, quick questions and one-off tasks',
  },
  {
    view: 'workspaces',
    icon: FolderOpen,
    label: 'Workspaces',
    title: 'Workspaces — Git worktree environments with isolated branches and embedded chat',
  },
  {
    view: 'teams',
    icon: Users,
    label: 'Teams',
    title: 'Teams — Multi-agent PR and team workflows',
  },
  {
    view: 'agents',
    icon: Bot,
    label: 'Agents',
    title: 'Agents — Custom agent profiles and configurations',
  },
];

export function ActivityBar({ activeView, onSelectView, onOpenSettings, email }: ActivityBarProps) {
  const initial = email ? email.charAt(0).toUpperCase() : null;

  return (
    <div className="w-12 flex flex-col border-r bg-sidebar h-full shrink-0">
      {/* Top: view buttons */}
      <div className="flex-1 space-y-1 p-1">
        {viewItems.map(({ view, icon: Icon, label, title }) => {
          const isActive = activeView === view;
          return (
            <button
              key={view}
              data-testid={`view-tab-${view}`}
              title={title}
              aria-label={label}
              onClick={() => onSelectView(view)}
              className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${
                isActive
                  ? 'bg-accent text-accent-foreground'
                  : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
              }`}
            >
              <Icon className="h-5 w-5" />
            </button>
          );
        })}
      </div>

      {/* Bottom: settings + user avatar */}
      <div className="p-1 space-y-1">
        <button
          data-testid="activity-bar-settings"
          title="Settings"
          aria-label="Open settings"
          onClick={onOpenSettings}
          className="w-10 h-10 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-accent/50 hover:text-foreground transition-colors"
        >
          <Settings className="h-5 w-5" />
        </button>
        <div
          className="w-8 h-8 mx-auto rounded-full bg-muted flex items-center justify-center text-xs font-medium"
          title={email ?? 'User'}
        >
          {initial ?? <User className="h-4 w-4 text-muted-foreground" />}
        </div>
      </div>
    </div>
  );
}
