import { useRef, useEffect } from 'react';
import type { Session } from '@claude-tauri/shared';
import { ChatCircle, Plus } from '@phosphor-icons/react';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { UserBadge } from '@/components/auth/UserBadge';
import { SessionItem } from './SessionItem';

const DATE_BUCKETS = ['Today', 'Yesterday', 'This Week', 'Last Week', 'This Month'] as const;
type DateBucket = (typeof DATE_BUCKETS)[number] | string;

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

function getDateBucket(date: Date): DateBucket {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 7);
  const lastWeekAgo = new Date(today);
  lastWeekAgo.setDate(lastWeekAgo.getDate() - 14);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  if (d >= today) return 'Today';
  if (d >= yesterday) return 'Yesterday';
  if (d >= weekAgo) return 'This Week';
  if (d >= lastWeekAgo) return 'Last Week';
  if (d >= monthStart) return 'This Month';
  if (d >= lastMonthStart) return `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
  return `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
}

function groupSessionsByDate(sessions: Session[]): { bucket: DateBucket; sessions: Session[] }[] {
  const groups = new Map<DateBucket, Session[]>();
  for (const session of sessions) {
    const bucket = getDateBucket(new Date(session.createdAt));
    if (!groups.has(bucket)) groups.set(bucket, []);
    groups.get(bucket)!.push(session);
  }
  const monthBuckets = Array.from(groups.keys())
    .filter((bucket): bucket is string =>
      !DATE_BUCKETS.includes(bucket as (typeof DATE_BUCKETS)[number])
    )
    .map((bucket) => {
      const [monthLabel, yearLabel] = bucket.split(' ');
      return {
        bucket,
        sessions: groups.get(bucket)!,
        sortValue: (Number(yearLabel) * 12) + MONTH_NAMES.indexOf(monthLabel as any),
      };
    })
    .sort((a, b) => b.sortValue - a.sortValue);

  return [
    ...DATE_BUCKETS
      .filter((b) => groups.has(b))
      .map((bucket) => ({ bucket, sessions: groups.get(bucket)! })),
    ...monthBuckets.map(({ bucket, sessions }) => ({ bucket, sessions })),
  ];
}

interface SessionSidebarProps {
  sessions: Session[];
  activeSessionId: string | null;
  email?: string;
  plan?: string;
  searchQuery?: string;
  onSearchQueryChange?: (query: string) => void;
  onSelectSession: (id: string) => void;
  onNewChat: () => void;
  onDeleteSession: (id: string) => void;
  onRenameSession: (id: string, title: string) => void;
  onForkSession: (id: string) => void;
  onExportSession: (id: string, format: 'json' | 'md') => void;
  onOpenSettings?: (tab?: string) => void;
}

export function SessionSidebar({
  sessions,
  activeSessionId,
  email,
  plan,
  onSelectSession,
  onNewChat,
  onDeleteSession,
  onRenameSession,
  onForkSession,
  onExportSession,
  searchQuery = '',
  onSearchQueryChange,
}: SessionSidebarProps) {
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isSessionSearchShortcut = (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k';
      if (isSessionSearchShortcut) {
        e.preventDefault();
        e.stopPropagation();
        searchRef.current?.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="flex h-full w-[280px] shrink-0 flex-col min-h-0 overflow-hidden border-r border-border bg-sidebar">
      {/* Section header */}
      <div className="flex items-center justify-between px-3 py-2 border-b">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Conversations
        </span>
        <button
          onClick={() => onNewChat?.()}
          className="h-5 w-5 rounded flex items-center justify-center text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          aria-label="New chat"
          title="New chat"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="p-3">
        <Input
          ref={searchRef}
          data-testid="session-search-input"
          value={searchQuery}
          onChange={(event) => onSearchQueryChange?.(event.target.value)}
          placeholder="Search sessions"
          className="mt-2"
        />
      </div>
      <Separator />
      <ScrollArea className="flex-1 min-h-0 overflow-hidden">
        <div className="p-2 space-y-1">
          {sessions.length > 0 ? (
            groupSessionsByDate(sessions).map(({ bucket, sessions: groupSessions }) => (
              <div key={bucket}>
                <div className="px-2 pt-3 pb-1 text-xs font-semibold text-muted-foreground/60 uppercase tracking-wide">
                  {bucket}
                </div>
                {groupSessions.map(session => (
                  <SessionItem
                    key={session.id}
                    session={session}
                    isActive={session.id === activeSessionId}
                    onSelect={() => onSelectSession(session.id)}
                    onDelete={() => onDeleteSession(session.id)}
                    onRename={(title) => onRenameSession(session.id, title)}
                    onFork={() => onForkSession(session.id)}
                    onExport={(format) => onExportSession(session.id, format)}
                  />
                ))}
              </div>
            ))
          ) : searchQuery ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              No sessions match &ldquo;{searchQuery}&rdquo;
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 px-4 text-center text-muted-foreground">
              <ChatCircle className="h-8 w-8 mb-3 opacity-40" />
              <p className="text-sm font-medium mb-1">No conversations yet</p>
              <p className="text-xs opacity-70">Start a conversation with Claude</p>
            </div>
          )}
        </div>
      </ScrollArea>
      {/* Footer: UserBadge */}
      <div className="border-t border-border p-2 flex items-center">
        <UserBadge email={email} plan={plan} />
      </div>
    </div>
  );
}
