import { useState } from 'react';
import type { Session } from '@claude-tauri/shared';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { UserBadge } from '@/components/auth/UserBadge';

interface SessionSidebarProps {
  sessions: Session[];
  activeSessionId: string | null;
  email?: string;
  plan?: string;
  onSelectSession: (id: string) => void;
  onNewChat: () => void;
  onDeleteSession: (id: string) => void;
}

export function SessionSidebar({
  sessions,
  activeSessionId,
  email,
  plan,
  onSelectSession,
  onNewChat,
  onDeleteSession,
}: SessionSidebarProps) {
  return (
    <div className="flex h-full w-[280px] shrink-0 flex-col border-r border-border bg-sidebar">
      <div className="p-3">
        <UserBadge email={email} plan={plan} />
      </div>
      <Separator />
      <div className="p-3">
        <Button onClick={onNewChat} className="w-full" variant="secondary">
          New Chat
        </Button>
      </div>
      <Separator />
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {sessions.map(session => (
            <SessionItem
              key={session.id}
              session={session}
              isActive={session.id === activeSessionId}
              onSelect={() => onSelectSession(session.id)}
              onDelete={() => onDeleteSession(session.id)}
            />
          ))}
          {sessions.length === 0 && (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">
              No conversations yet
            </p>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

function SessionItem({
  session,
  isActive,
  onSelect,
  onDelete,
}: {
  session: Session;
  isActive: boolean;
  onSelect: () => void;
  onDelete: () => void;
}) {
  const [hovering, setHovering] = useState(false);

  const date = new Date(session.createdAt);
  const dateStr = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

  return (
    <button
      onClick={onSelect}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      className={`w-full rounded-md px-3 py-2 text-left transition-colors relative group ${
        isActive
          ? 'bg-sidebar-accent text-sidebar-accent-foreground'
          : 'hover:bg-sidebar-accent/50 text-sidebar-foreground'
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium truncate flex-1">
          {session.title || 'New Chat'}
        </span>
        {hovering && (
          <button
            onClick={e => {
              e.stopPropagation();
              onDelete();
            }}
            className="shrink-0 rounded p-0.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
            title="Delete"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        )}
      </div>
      <span className="text-xs text-muted-foreground">{dateStr}</span>
    </button>
  );
}
