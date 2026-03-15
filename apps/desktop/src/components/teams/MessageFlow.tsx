import { useRef, useEffect, useState } from 'react';
import type { TeamMessage } from '@claude-tauri/shared';

const typeColors: Record<TeamMessage['type'], string> = {
  message: 'border-blue-500/40',
  broadcast: 'border-purple-500/40',
  shutdown_request: 'border-red-500/40',
};

const typeLabels: Record<TeamMessage['type'], string> = {
  message: 'DM',
  broadcast: 'Broadcast',
  shutdown_request: 'Shutdown',
};

interface MessageFlowProps {
  messages: TeamMessage[];
  filterAgent?: string;
}

export function MessageFlow({ messages, filterAgent }: MessageFlowProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [filter, setFilter] = useState(filterAgent ?? '');

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const filtered = filter
    ? messages.filter(
        (m) =>
          m.from.toLowerCase().includes(filter.toLowerCase()) ||
          m.to.toLowerCase().includes(filter.toLowerCase())
      )
    : messages;

  return (
    <div data-testid="message-flow" className="flex flex-col h-full min-h-0">
      {/* Filter bar */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
        <span className="text-xs text-muted-foreground">Messages</span>
        <input
          data-testid="message-filter"
          type="text"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter by agent..."
          className="h-6 flex-1 rounded border border-input bg-transparent px-2 text-xs outline-none focus-visible:border-ring"
        />
        <span className="text-xs text-muted-foreground tabular-nums">
          {filtered.length}
        </span>
      </div>

      {/* Message list */}
      <div
        ref={scrollRef}
        data-testid="message-list"
        className="flex-1 overflow-y-auto p-2 space-y-1"
      >
        {filtered.length === 0 ? (
          <p
            data-testid="message-empty"
            className="text-xs text-muted-foreground text-center py-4"
          >
            No messages yet
          </p>
        ) : (
          filtered.map((msg) => (
            <div
              key={msg.id}
              data-testid={`message-${msg.id}`}
              className={`rounded border-l-2 ${typeColors[msg.type]} px-2 py-1.5 text-xs`}
            >
              <div className="flex items-center gap-1 text-muted-foreground">
                <span className="font-medium text-foreground">{msg.from}</span>
                <span>-&gt;</span>
                <span className="font-medium text-foreground">{msg.to}</span>
                <span
                  data-testid={`message-type-${msg.id}`}
                  className={`ml-auto px-1 py-0.5 rounded text-[10px] ${
                    msg.type === 'broadcast'
                      ? 'bg-purple-500/10 text-purple-400'
                      : msg.type === 'shutdown_request'
                        ? 'bg-red-500/10 text-red-400'
                        : 'bg-blue-500/10 text-blue-400'
                  }`}
                >
                  {typeLabels[msg.type]}
                </span>
              </div>
              <p className="font-mono text-xs text-muted-foreground mt-0.5 break-words">
                {msg.content}
              </p>
              <span className="text-[10px] text-muted-foreground/60 mt-0.5 block">
                {new Date(msg.timestamp).toLocaleTimeString()}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
