import { useCallback, useEffect, useMemo, useRef, useState, type UIEvent } from 'react';
import type { ArtifactRefMessagePart, ThreadMessage } from '@claude-tauri/shared';
import { fetchSessionThread, archiveArtifact, fetchProjectArtifacts } from '@/lib/workspace-api';
import type { UIMessage } from '@ai-sdk/react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ThinkingBlock } from './ThinkingBlock';
import { ToolCallBlock } from './ToolCallBlock';
import { useKeyboardShortcuts, type ShortcutDefinition } from '@/hooks/useKeyboardShortcuts';
import { useSettings } from '@/hooks/useSettings';
import type { ToolCallState } from '@/hooks/useStreamEvents';
import { ArrowDown, MagnifyingGlass, PaperPlaneRight, SidebarSimple } from '@phosphor-icons/react';
import type { ToolCallBlockProps } from './ToolCallBlock';
import { MessageBubble } from './MessageBubble';
import { ConversationMinimap } from './ConversationMinimap';
import { type AssistantResponseMetadata, type SearchMatch, type ConversationTurn, MONO_FONT_STYLE, getMessageText, summarizeMessageText, getChatWidthClass, getChatDensityClasses } from './message-list-utils';

export type { AssistantResponseMetadata } from './message-list-utils';

interface MessageListProps {
  messages: UIMessage[]; isLoading: boolean; toolCalls?: Map<string, ToolCallState>;
  thinkingBlocks?: Map<string, string>; showThinking?: boolean; thinkingExpanded?: boolean;
  thinkingToggleVersion?: number; onToolFixErrors?: ToolCallBlockProps['onFixErrors'];
  onExportSummaryToNewChat?: (summary: string) => void; isPrivacyMode?: boolean;
  assistantMetadata?: Record<string, AssistantResponseMetadata>; sessionId?: string | null; projectId?: string;
}

export function MessageList({ messages, isLoading, toolCalls, thinkingBlocks, showThinking, thinkingExpanded = false, thinkingToggleVersion = 0, onToolFixErrors, onExportSummaryToNewChat, isPrivacyMode = false, assistantMetadata, sessionId, projectId }: MessageListProps) {
  const { settings } = useSettings();
  const [threadMessages, setThreadMessages] = useState<ThreadMessage[]>([]);
  const [artifactMap, setArtifactMap] = useState<Map<string, import('@claude-tauri/shared').Artifact>>(new Map());

  useEffect(() => {
    if (!sessionId) { setThreadMessages([]); return; }
    let cancelled = false;
    fetchSessionThread(sessionId).then((msgs) => { if (!cancelled) setThreadMessages(msgs); }).catch(() => {});
    return () => { cancelled = true; };
  }, [sessionId]);

  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    fetchProjectArtifacts(projectId).then((artifacts) => { if (cancelled) return; const map = new Map<string, import('@claude-tauri/shared').Artifact>(); for (const a of artifacts) map.set(a.id, a); setArtifactMap(map); }).catch(() => {});
    return () => { cancelled = true; };
  }, [projectId]);

  const artifactRefsByMessageId = useMemo<Map<string, ArtifactRefMessagePart[]>>(() => {
    const map = new Map<string, ArtifactRefMessagePart[]>();
    for (const tm of threadMessages) { const refs = (tm.parts as import('@claude-tauri/shared').MessagePart[]).filter((p): p is ArtifactRefMessagePart => p.type === 'artifact_ref'); if (refs.length > 0) map.set(tm.id, refs); }
    return map;
  }, [threadMessages]);

  const handleArchiveArtifact = useCallback(async (artifactId: string) => { try { const updated = await archiveArtifact(artifactId); setArtifactMap((prev) => { const next = new Map(prev); next.set(artifactId, updated); return next; }); } catch {} }, []);

  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const messageRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [minimapOpen, setMinimapOpen] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeMatchIndex, setActiveMatchIndex] = useState(0);

  const updateScrollButtonVisibility = useCallback((element?: Element | null) => {
    const viewport = element as HTMLElement | null; if (!viewport) return;
    const isScrollable = viewport.scrollHeight > viewport.clientHeight + 4;
    const atBottom = viewport.scrollTop + viewport.clientHeight >= viewport.scrollHeight - 4;
    setShowScrollToBottom(isScrollable && !atBottom);
  }, []);

  const handleViewportScroll = useCallback((event: UIEvent<HTMLDivElement>) => { updateScrollButtonVisibility(event.currentTarget); }, [updateScrollButtonVisibility]);
  const handleViewportMount = useCallback((viewport: HTMLDivElement | null) => { viewportRef.current = viewport; if (!viewport) { setShowScrollToBottom(false); return; } window.requestAnimationFrame(() => { if (viewportRef.current === viewport) updateScrollButtonVisibility(viewport); }); }, [updateScrollButtonVisibility]);
  const handleScrollToBottom = useCallback(() => { if (viewportRef.current) viewportRef.current.scrollTo({ top: viewportRef.current.scrollHeight, behavior: 'smooth' }); else bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); setShowScrollToBottom(false); }, []);

  const visibleMessages = useMemo(() => messages.filter((msg) => { if (msg.role !== 'assistant') return true; return getMessageText(msg).trim().length > 0; }), [messages]);
  const normalizedSearchQuery = searchQuery.trim();

  const searchMatches = useMemo<SearchMatch[]>(() => {
    if (!normalizedSearchQuery) return [];
    const normalized = normalizedSearchQuery.toLowerCase();
    return visibleMessages.map((message, messageIndex) => { if (!getMessageText(message).toLowerCase().includes(normalized)) return null; return { messageIndex, messageId: message.id }; }).filter((item): item is SearchMatch => item !== null);
  }, [normalizedSearchQuery, visibleMessages]);

  useEffect(() => { if (!normalizedSearchQuery || !searchMatches.length) { setActiveMatchIndex(0); return; } setActiveMatchIndex((c) => (c >= searchMatches.length ? 0 : c)); }, [normalizedSearchQuery, searchMatches]);
  useEffect(() => { if (searchOpen) { searchInputRef.current?.focus(); return; } setSearchQuery(''); }, [searchOpen]);

  const openSearch = useCallback(() => setSearchOpen(true), []);
  const showNextMatch = useCallback(() => { if (!searchMatches.length) return; setActiveMatchIndex((prev) => (prev + 1) % searchMatches.length); }, [searchMatches.length]);
  const showPrevMatch = useCallback(() => { if (!searchMatches.length) return; setActiveMatchIndex((prev) => (prev - 1 + searchMatches.length) % searchMatches.length); }, [searchMatches.length]);

  const jumpToMessageIndex = useCallback((messageIndex: number) => {
    const target = visibleMessages[messageIndex]; if (!target) return;
    messageRefs.current[target.id]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    const matchIndex = searchMatches.findIndex((match) => match.messageIndex === messageIndex);
    if (matchIndex !== -1) setActiveMatchIndex(matchIndex);
  }, [searchMatches, visibleMessages]);

  const handleSearchNavShortcuts: ShortcutDefinition[] = useMemo(() => [
    { id: 'chat-search-open', key: 'f', meta: true, label: 'Find in chat', category: 'chat', handler: openSearch },
    { id: 'chat-search-next', key: 'g', meta: true, label: 'Find next match', category: 'chat', handler: showNextMatch },
    { id: 'chat-search-prev', key: 'g', meta: true, shift: true, label: 'Find previous match', category: 'chat', handler: showPrevMatch },
  ], [openSearch, showNextMatch, showPrevMatch]);
  useKeyboardShortcuts(handleSearchNavShortcuts);

  useEffect(() => { if (!searchMatches.length) return; const activeMatch = searchMatches[activeMatchIndex]; if (activeMatch) jumpToMessageIndex(activeMatch.messageIndex); }, [activeMatchIndex, jumpToMessageIndex, searchMatches]);

  const sessionSummary = useMemo(() => {
    if (visibleMessages.length === 0) return 'No messages in this conversation.';
    const firstSummaries = visibleMessages.slice(0, 3).map((message) => summarizeMessageText(getMessageText(message), message.role, isPrivacyMode));
    const roleCounts = visibleMessages.reduce((acc, message) => { if (message.role === 'user') acc.user += 1; else acc.assistant += 1; return acc; }, { user: 0, assistant: 0 });
    return `${visibleMessages.length} messages (user: ${roleCounts.user}, assistant: ${roleCounts.assistant}). ${firstSummaries.join(' | ')}`;
  }, [isPrivacyMode, visibleMessages]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); updateScrollButtonVisibility(viewportRef.current); }, [messages, toolCalls, thinkingBlocks, searchMatches, activeMatchIndex]);

  const selectedMatch = searchMatches[activeMatchIndex] ?? null;

  const conversationTurns = useMemo<ConversationTurn[]>(() => {
    const turns: ConversationTurn[] = []; let i = 0;
    while (i < visibleMessages.length) {
      const msg = visibleMessages[i]; if (!msg) { i++; continue; }
      if (msg.role === 'user') {
        const next = visibleMessages[i + 1]; const hasAssistant = next?.role === 'assistant';
        const userText = getMessageText(msg); const firstLine = userText.split('\n')[0]?.trim() ?? '';
        const summary = isPrivacyMode ? `Task ${turns.length + 1}` : firstLine.length > 100 ? `${firstLine.slice(0, 100)}\u2026` : firstLine || `Task ${turns.length + 1}`;
        const userIdx = i; const assistantIdx = hasAssistant ? i + 1 : undefined;
        const hasSearchMatch = searchMatches.some((m) => m.messageIndex === userIdx || m.messageIndex === assistantIdx);
        const isCurrentMatch = selectedMatch?.messageIndex === userIdx || selectedMatch?.messageIndex === assistantIdx;
        turns.push({ turnIndex: turns.length, userMessageIndex: userIdx, userMessageId: msg.id, summary, assistantMessageIndex: assistantIdx, hasSearchMatch, isCurrentMatch });
        i += hasAssistant ? 2 : 1;
      } else { i++; }
    }
    return turns;
  }, [visibleMessages, isPrivacyMode, searchMatches, selectedMatch]);

  if (messages.length === 0) return (<div className="flex flex-1 items-center justify-center"><div className="text-center space-y-2"><h2 className="text-xl font-semibold">Start a conversation</h2><p className="text-sm text-muted-foreground">Type a message below to begin chatting with Claude.</p></div></div>);

  const shouldShowThinking = showThinking ?? settings.showThinking ?? true;
  const thinkingEntries = shouldShowThinking && thinkingBlocks ? Array.from(thinkingBlocks.entries()) : [];
  const toolCallEntries = toolCalls ? Array.from(toolCalls.values()) : [];
  const showMinimap = conversationTurns.length >= 3;
  const chatWidthClass = getChatWidthClass(settings.chatWidth);
  const densityClasses = getChatDensityClasses(settings.chatDensity);
  const chatFontClass = settings.chatFont === 'mono' ? 'font-mono' : '';
  const chatFontStyle = settings.chatFont === 'mono' ? MONO_FONT_STYLE : undefined;

  return (
    <div ref={containerRef} className="relative flex flex-1 min-h-0 overflow-hidden flex-col">
      {searchOpen || normalizedSearchQuery ? (
        <div className="border-b border-border bg-background px-3 py-2 space-y-2">
          <div className="flex items-center gap-2">
            <MagnifyingGlass className="h-4 w-4 text-muted-foreground" />
            <Input ref={searchInputRef} data-testid="message-list-search-input" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search conversation" className="h-8" />
            <Button type="button" variant="secondary" size="sm" onClick={showNextMatch} disabled={!searchMatches.length}>Next</Button>
            <Button type="button" variant="secondary" size="sm" onClick={showPrevMatch} disabled={!searchMatches.length}>Prev</Button>
            <Button type="button" variant="outline" size="sm" onClick={() => { if (selectedMatch) jumpToMessageIndex(selectedMatch.messageIndex); }} disabled={!searchMatches.length}>Go</Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setSearchOpen(false)} aria-label="Close search">{'\u00d7'}</Button>
          </div>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <div data-testid="message-list-search-summary">{searchMatches.length === 0 ? 'No matches' : `Match ${activeMatchIndex + 1} of ${searchMatches.length}`}</div>
            {onExportSummaryToNewChat && (<Button type="button" size="sm" variant="outline" onClick={() => onExportSummaryToNewChat(sessionSummary)} className="h-7"><PaperPlaneRight className="h-3.5 w-3.5" />Export summary to new chat</Button>)}
          </div>
        </div>
      ) : null}

      <div className="relative flex flex-1 min-h-0">
        <ScrollArea className="flex-1 h-full" data-testid="message-list-scroll-area" viewportRef={handleViewportMount} viewportProps={{ onScroll: handleViewportScroll }}>
          <div className={cn('mx-auto', chatWidthClass, densityClasses.content)} data-testid="message-list-content">
            {visibleMessages.map((message, index) => {
              const matchIndex = searchMatches.findIndex((item) => item.messageIndex === index);
              const isMatch = matchIndex !== -1; const isActiveMatch = selectedMatch?.messageIndex === index;
              return (
                <div key={message.id} ref={(node) => { messageRefs.current[message.id] = node; }} data-testid={`chat-message-${message.id}`} data-match-index={matchIndex} title={summarizeMessageText(getMessageText(message), message.role, isPrivacyMode)} className={`rounded-lg transition ${isActiveMatch ? 'outline outline-2 outline-primary/70' : ''}`}>
                  <MessageBubble message={message} highlightQuery={normalizedSearchQuery} isMatch={isMatch} densityClass={densityClasses.bubble} chatFontClass={chatFontClass} chatFontStyle={chatFontStyle} metadata={assistantMetadata?.[message.id]} artifactRefs={artifactRefsByMessageId.get(message.id)} artifactMap={artifactMap} onArchiveArtifact={handleArchiveArtifact} />
                </div>
              );
            })}
            {isLoading && visibleMessages[visibleMessages.length - 1]?.role === 'user' && (<div className="flex justify-start"><div className="rounded-lg bg-muted px-4 py-3"><div className="flex items-center gap-2"><ArrowDown className="h-4 w-4 animate-spin text-muted-foreground" /><span className="text-sm text-muted-foreground">Claude is thinking...</span></div></div></div>)}
            {isLoading && visibleMessages[visibleMessages.length - 1]?.role === 'assistant' && toolCallEntries.length === 0 && (<div className="flex justify-start pl-4"><div className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-blue-400" /><span className="text-xs text-muted-foreground">Generating...</span></div></div>)}
            {visibleMessages.map((message, index) => { if (!isLoading || message.role !== 'assistant' || index !== visibleMessages.length - 1) return null; return (<div key={`stream-events-${message.id}`} className="mt-2 space-y-1">{thinkingEntries.map(([key, text]) => (<ThinkingBlock key={`${key}-${thinkingToggleVersion}`} text={text} defaultExpanded={thinkingExpanded} />))}{toolCallEntries.map((tc) => (<ToolCallBlock key={tc.toolUseId} toolCall={tc} onFixErrors={onToolFixErrors} />))}</div>); })}
            <div ref={bottomRef} />
          </div>
        </ScrollArea>
        {conversationTurns.length >= 3 && (<button type="button" onClick={() => setMinimapOpen(prev => !prev)} className="absolute right-0 top-2 z-20 flex h-5 w-5 items-center justify-center rounded-l-sm bg-background/60 border border-r-0 border-border/40 hover:bg-muted/60 transition-colors" title={minimapOpen ? 'Hide outline' : 'Show outline'}><SidebarSimple className="h-3 w-3 text-muted-foreground" /></button>)}
        {showMinimap && minimapOpen && (<ConversationMinimap turns={conversationTurns} onJumpTo={jumpToMessageIndex} />)}
        {showScrollToBottom && (<button type="button" onClick={handleScrollToBottom} data-testid="message-list-scroll-to-bottom" className="absolute right-10 bottom-4 z-10 inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-2 text-xs shadow-sm transition hover:bg-muted/60" aria-label="Scroll to bottom"><ArrowDown className="h-4 w-4" /><span>Latest</span></button>)}
      </div>
    </div>
  );
}
