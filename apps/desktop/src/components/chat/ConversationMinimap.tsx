import { useState } from 'react';
import { cn } from '@/lib/utils';
import type { ConversationTurn } from './message-list-utils';

export function ConversationMinimap({ turns, onJumpTo }: { turns: ConversationTurn[]; onJumpTo: (messageIndex: number) => void }) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  return (
    <div className="relative w-5 flex-shrink-0 border-l border-border/20 bg-background/30 select-none flex flex-col items-center pt-3 pb-3 gap-1.5 overflow-y-auto" aria-label="Conversation outline">
      {turns.map((turn) => { const isHovered = hoveredIndex === turn.turnIndex; return (
        <div key={turn.userMessageId} className="relative w-full flex justify-center">
          <button type="button" onClick={() => onJumpTo(turn.userMessageIndex)} onMouseEnter={() => setHoveredIndex(turn.turnIndex)} onMouseLeave={() => setHoveredIndex(null)} className={cn('w-3.5 h-[3px] rounded-full cursor-pointer transition-all duration-150 focus-visible:outline-none', turn.hasSearchMatch ? 'bg-yellow-400 opacity-90' : 'bg-zinc-400', turn.isCurrentMatch ? 'opacity-100 w-4' : 'opacity-40', 'hover:opacity-100 hover:w-4')} />
          {isHovered && (<div className="absolute right-full mr-2 top-1/2 -translate-y-1/2 z-50 pointer-events-none"><div className="rounded-md border border-border bg-popover px-2.5 py-1.5 text-xs shadow-md whitespace-nowrap max-w-[220px] overflow-hidden text-ellipsis"><span className="text-muted-foreground mr-1">#{turn.turnIndex + 1}</span><span className="text-foreground">{turn.summary}</span></div></div>)}
        </div>); })}
    </div>
  );
}
