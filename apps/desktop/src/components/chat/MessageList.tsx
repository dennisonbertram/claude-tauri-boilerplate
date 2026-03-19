import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type UIEvent,
} from 'react';
import type { ArtifactRefMessagePart, ThreadMessage } from '@claude-tauri/shared';
import { fetchSessionThread } from '@/lib/workspace-api';
import { ArtifactBlock } from './ArtifactBlock';
import { archiveArtifact, fetchProjectArtifacts } from '@/lib/workspace-api';
import type { UIMessage } from '@ai-sdk/react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { MarkdownRenderer } from './MarkdownRenderer';
import { ToolCallBlock } from './ToolCallBlock';
import { ThinkingBlock } from './ThinkingBlock';
import { useKeyboardShortcuts, type ShortcutDefinition } from '@/hooks/useKeyboardShortcuts';
import { useSettings } from '@/hooks/useSettings';
import type { ToolCallState } from '@/hooks/useStreamEvents';
import {
  ArrowDown,
  Search,
  Send,
  Copy,
  User,
  Bot,
} from 'lucide-react';
import type { ToolCallBlockProps } from './ToolCallBlock';

export interface AssistantResponseMetadata {
  model: string;
  durationMs: number;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
  changedFiles: string[];
}

interface MessageListProps {
  messages: UIMessage[];
  isLoading: boolean;
  toolCalls?: Map<string, ToolCallState>;
  thinkingBlocks?: Map<string, string>;
  showThinking?: boolean;
  thinkingExpanded?: boolean;
  thinkingToggleVersion?: number;
  onToolFixErrors?: ToolCallBlockProps['onFixErrors'];
  onExportSummaryToNewChat?: (summary: string) => void;
  isPrivacyMode?: boolean;
  assistantMetadata?: Record<string, AssistantResponseMetadata>;
  sessionId?: string | null;
  projectId?: string;
}

interface SearchMatch {
  messageIndex: number;
  messageId: string;
}


interface ConversationTurn {
  turnIndex: number;
  userMessageIndex: number;
  userMessageId: string;
  summary: string;
  assistantMessageIndex?: number;
  hasSearchMatch: boolean;
  isCurrentMatch: boolean;
}

const MONO_FONT_STYLE: CSSProperties = { fontFamily: 'var(--chat-mono-font)' };

function getMessageText(message: UIMessage): string {
  return (
    message.parts
      ?.filter((p): p is Extract<typeof p, { type: 'text' }> => p.type === 'text')
      .map((p) => p.text)
      .join('') || ''
  );
}

function escapeRegExp(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function summarizeMessageText(
  text: string,
  role: UIMessage['role'],
  isPrivacyMode: boolean
): string {
  const trimmed = text.trim().replace(/\s+/g, ' ');
  if (!trimmed) {
    return role === 'user' ? 'User message with no text' : 'Assistant message with no text';
  }

  if (isPrivacyMode) {
    const wordCount = trimmed.split(/\s+/).length;
    return `${role === 'user' ? 'User' : 'Assistant'} message (${wordCount} words)`;
  }

  const maxLen = 80;
  if (trimmed.length <= maxLen) return trimmed;
  return `${trimmed.slice(0, maxLen)}…`;
}

function truncateText(text: string, maxLen = 60): string {
  const trimmed = text.trim().replace(/\s+/g, ' ');
  if (trimmed.length <= maxLen) return trimmed;
  return `${trimmed.slice(0, maxLen)}…`;
}

function formatDuration(durationMs: number): string {
  return `${(durationMs / 1000).toFixed(1)}s`;
}

function getChatWidthClass(width: 'standard' | 'wide' | 'full'): string {
  switch (width) {
    case 'wide':
      return 'max-w-5xl';
    case 'full':
      return 'max-w-none';
    case 'standard':
    default:
      return 'max-w-3xl';
  }
}

function getChatDensityClasses(density: 'comfortable' | 'compact'): {
  content: string;
  bubble: string;
} {
  if (density === 'compact') {
    return {
      content: 'space-y-2 p-3',
      bubble: 'px-3 py-2.5',
    };
  }

  return {
    content: 'space-y-4 p-4',
    bubble: 'px-4 py-3',
  };
}

function renderHighlightedText(text: string, query: string) {
  const escaped = escapeRegExp(query);
  const regex = new RegExp(`(${escaped})`, 'gi');
  const parts = text.split(regex);

  return parts.map((part, index) => {
    if (!part) return <span key={`${part}-${index}`} />;

    const isMatch = part.toLowerCase() === query.toLowerCase();
    return isMatch ? (
      <mark
        key={`${part}-${index}`}
        className="rounded-[2px] bg-yellow-300/60 px-0.5"
      >
        {part}
      </mark>
    ) : (
      <span key={`${part}-${index}`}>{part}</span>
    );
  });
}

export function MessageList({
  messages,
  isLoading,
  toolCalls,
  thinkingBlocks,
  showThinking,
  thinkingExpanded = false,
  thinkingToggleVersion = 0,
  onToolFixErrors,
  onExportSummaryToNewChat,
  isPrivacyMode = false,
  assistantMetadata,
  sessionId,
  projectId,
}: MessageListProps) {
  const { settings } = useSettings();

  // Load thread parts (artifact refs) for the session
  const [threadMessages, setThreadMessages] = useState<ThreadMessage[]>([]);
  const [artifactMap, setArtifactMap] = useState<Map<string, import('@claude-tauri/shared').Artifact>>(new Map());

  useEffect(() => {
    if (!sessionId) {
      setThreadMessages([]);
      return;
    }

    let cancelled = false;
    fetchSessionThread(sessionId)
      .then((msgs) => {
        if (!cancelled) setThreadMessages(msgs);
      })
      .catch(() => {
        // Server may not support thread endpoint yet — silently ignore
      });

    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  useEffect(() => {
    if (!projectId) return;

    let cancelled = false;
    fetchProjectArtifacts(projectId)
      .then((artifacts) => {
        if (cancelled) return;
        const map = new Map<string, import('@claude-tauri/shared').Artifact>();
        for (const artifact of artifacts) {
          map.set(artifact.id, artifact);
        }
        setArtifactMap(map);
      })
      .catch(() => {
        // Silently ignore
      });

    return () => {
      cancelled = true;
    };
  }, [projectId]);

  // Build a map: messageId → ArtifactRefMessagePart[]
  const artifactRefsByMessageId = useMemo<Map<string, ArtifactRefMessagePart[]>>(() => {
    const map = new Map<string, ArtifactRefMessagePart[]>();
    for (const tm of threadMessages) {
      const refs = (tm.parts as import('@claude-tauri/shared').MessagePart[]).filter((p): p is ArtifactRefMessagePart => p.type === 'artifact_ref');
      if (refs.length > 0) {
        map.set(tm.id, refs);
      }
    }
    return map;
  }, [threadMessages]);

  const handleArchiveArtifact = useCallback(async (artifactId: string) => {
    try {
      const updated = await archiveArtifact(artifactId);
      setArtifactMap((prev) => {
        const next = new Map(prev);
        next.set(artifactId, updated);
        return next;
      });
    } catch {
      // Silently ignore
    }
  }, []);
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const messageRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeMatchIndex, setActiveMatchIndex] = useState(0);
  const updateScrollButtonVisibility = useCallback((element?: Element | null) => {
    const viewport = element as HTMLElement | null;
    if (!viewport) return;

    const isScrollable = viewport.scrollHeight > viewport.clientHeight + 4;
    const atBottom =
      viewport.scrollTop + viewport.clientHeight >= viewport.scrollHeight - 4;

    setShowScrollToBottom(isScrollable && !atBottom);
  }, []);

  const handleViewportScroll = useCallback(
    (event: UIEvent<HTMLDivElement>) => {
      updateScrollButtonVisibility(event.currentTarget);
    },
    [updateScrollButtonVisibility]
  );

  const handleViewportMount = useCallback(
    (viewport: HTMLDivElement | null) => {
      viewportRef.current = viewport;

      if (!viewport) {
        setShowScrollToBottom(false);
        return;
      }

      window.requestAnimationFrame(() => {
        if (viewportRef.current === viewport) {
          updateScrollButtonVisibility(viewport);
        }
      });
    },
    [updateScrollButtonVisibility]
  );

  const handleScrollToBottom = useCallback(() => {
    if (viewportRef.current) {
      viewportRef.current.scrollTo({
        top: viewportRef.current.scrollHeight,
        behavior: 'smooth',
      });
    } else {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }

    setShowScrollToBottom(false);
  }, []);

  const visibleMessages = useMemo(
    () =>
      messages.filter((msg) => {
        if (msg.role !== 'assistant') return true;
        const text = getMessageText(msg);
        return text.trim().length > 0;
      }),
    [messages]
  );

  const normalizedSearchQuery = searchQuery.trim();

  const searchMatches = useMemo<SearchMatch[]>(() => {
    if (!normalizedSearchQuery) return [];

    const normalized = normalizedSearchQuery.toLowerCase();
    return visibleMessages
      .map((message, messageIndex) => {
        const text = getMessageText(message);
        const found = text.toLowerCase().includes(normalized);
        if (!found) return null;
        return {
          messageIndex,
          messageId: message.id,
        };
      })
      .filter((item): item is SearchMatch => item !== null);
  }, [normalizedSearchQuery, visibleMessages]);

  useEffect(() => {
    if (!normalizedSearchQuery || !searchMatches.length) {
      setActiveMatchIndex(0);
      return;
    }

    setActiveMatchIndex((current) => {
      if (current >= searchMatches.length) return 0;
      return current;
    });
  }, [normalizedSearchQuery, searchMatches]);

  useEffect(() => {
    if (searchOpen) {
      searchInputRef.current?.focus();
      return;
    }
    setSearchQuery('');
  }, [searchOpen]);

  const openSearch = useCallback(() => {
    setSearchOpen(true);
  }, []);

  const showNextMatch = useCallback(() => {
    if (!searchMatches.length) return;
    setActiveMatchIndex((prev) => (prev + 1) % searchMatches.length);
  }, [searchMatches.length]);

  const showPrevMatch = useCallback(() => {
    if (!searchMatches.length) return;
    setActiveMatchIndex((prev) => (prev - 1 + searchMatches.length) % searchMatches.length);
  }, [searchMatches.length]);

  const jumpToMessageIndex = useCallback((messageIndex: number) => {
    const target = visibleMessages[messageIndex];
    if (!target) return;

    const node = messageRefs.current[target.id];
    node?.scrollIntoView({ behavior: 'smooth', block: 'start' });

    const matchIndex = searchMatches.findIndex((match) => match.messageIndex === messageIndex);
    if (matchIndex !== -1) {
      setActiveMatchIndex(matchIndex);
    }
  }, [searchMatches, visibleMessages]);

  const handleSearchNavShortcuts: ShortcutDefinition[] = useMemo(
    () => [
      {
        id: 'chat-search-open',
        key: 'f',
        meta: true,
        label: 'Find in chat',
        category: 'chat',
        handler: openSearch,
      },
      {
        id: 'chat-search-next',
        key: 'g',
        meta: true,
        label: 'Find next match',
        category: 'chat',
        handler: showNextMatch,
      },
      {
        id: 'chat-search-prev',
        key: 'g',
        meta: true,
        shift: true,
        label: 'Find previous match',
        category: 'chat',
        handler: showPrevMatch,
      },
    ],
    [openSearch, showNextMatch, showPrevMatch]
  );
  useKeyboardShortcuts(handleSearchNavShortcuts);

  useEffect(() => {
    if (!searchMatches.length) return;
    const activeMatch = searchMatches[activeMatchIndex];
    if (!activeMatch) return;

    jumpToMessageIndex(activeMatch.messageIndex);
  }, [activeMatchIndex, jumpToMessageIndex, searchMatches]);

  const sessionSummary = useMemo(() => {
    if (visibleMessages.length === 0) {
      return 'No messages in this conversation.';
    }

    const firstSummaries = visibleMessages
      .slice(0, 3)
      .map((message) => summarizeMessageText(getMessageText(message), message.role, isPrivacyMode));
    const roleCounts = visibleMessages.reduce(
      (acc, message) => {
        if (message.role === 'user') acc.user += 1;
        else acc.assistant += 1;
        return acc;
      },
      { user: 0, assistant: 0 }
    );

    return `${visibleMessages.length} messages (user: ${roleCounts.user}, assistant: ${roleCounts.assistant}). ${firstSummaries.join(' | ')}`;
  }, [isPrivacyMode, visibleMessages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    updateScrollButtonVisibility(viewportRef.current);
  }, [messages, toolCalls, thinkingBlocks, searchMatches, activeMatchIndex]);

  if (messages.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="text-center space-y-2">
          <h2 className="text-xl font-semibold">Start a conversation</h2>
          <p className="text-sm text-muted-foreground">
            Type a message below to begin chatting with Claude.
          </p>
        </div>
      </div>
    );
  }

  const shouldShowThinking = showThinking ?? settings.showThinking ?? true;
  const thinkingEntries = shouldShowThinking && thinkingBlocks
    ? Array.from(thinkingBlocks.entries())
    : [];
  const toolCallEntries = toolCalls
    ? Array.from(toolCalls.values())
    : [];

  const selectedMatch = searchMatches[activeMatchIndex] ?? null;

  const conversationTurns = useMemo<ConversationTurn[]>(() => {
    const turns: ConversationTurn[] = [];
    let i = 0;
    while (i < visibleMessages.length) {
      const msg = visibleMessages[i];
      if (!msg) { i++; continue; }
      if (msg.role === 'user') {
        const next = visibleMessages[i + 1];
        const hasAssistant = next?.role === 'assistant';
        const userText = getMessageText(msg);
        const firstLine = userText.split('\n')[0]?.trim() ?? '';
        const summary = isPrivacyMode
          ? `Task ${turns.length + 1}`
          : firstLine.length > 100 ? `${firstLine.slice(0, 100)}…` : firstLine || `Task ${turns.length + 1}`;
        const userIdx = i;
        const assistantIdx = hasAssistant ? i + 1 : undefined;
        const hasSearchMatch = searchMatches.some(
          (m) => m.messageIndex === userIdx || m.messageIndex === assistantIdx
        );
        const isCurrentMatch =
          selectedMatch?.messageIndex === userIdx ||
          selectedMatch?.messageIndex === assistantIdx;
        turns.push({
          turnIndex: turns.length,
          userMessageIndex: userIdx,
          userMessageId: msg.id,
          summary,
          assistantMessageIndex: assistantIdx,
          hasSearchMatch,
          isCurrentMatch,
        });
        i += hasAssistant ? 2 : 1;
      } else {
        i++;
      }
    }
    return turns;
  }, [visibleMessages, isPrivacyMode, searchMatches, selectedMatch]);

  const showMinimap = conversationTurns.length >= 3;

  const chatWidthClass = getChatWidthClass(settings.chatWidth);
  const densityClasses = getChatDensityClasses(settings.chatDensity);
  const chatFontClass = settings.chatFont === 'mono' ? 'font-mono' : '';
  const chatFontStyle = settings.chatFont === 'mono' ? MONO_FONT_STYLE : undefined;

  return (
    <div
      ref={containerRef}
      className="relative flex flex-1 min-h-0 overflow-hidden flex-col"
    >
      {searchOpen || normalizedSearchQuery ? (
        <div className="border-b border-border bg-background px-3 py-2 space-y-2">
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              ref={searchInputRef}
              data-testid="message-list-search-input"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search conversation"
              className="h-8"
            />
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={showNextMatch}
              disabled={!searchMatches.length}
            >
              Next
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={showPrevMatch}
              disabled={!searchMatches.length}
            >
              Prev
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                if (selectedMatch) {
                  jumpToMessageIndex(selectedMatch.messageIndex);
                }
              }}
              disabled={!searchMatches.length}
            >
              Go
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setSearchOpen(false)}
              aria-label="Close search"
            >
              ×
            </Button>
          </div>

          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <div data-testid="message-list-search-summary">
              {searchMatches.length === 0
                ? 'No matches'
                : `Match ${activeMatchIndex + 1} of ${searchMatches.length}`}
            </div>
            {onExportSummaryToNewChat && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => onExportSummaryToNewChat(sessionSummary)}
                className="h-7"
              >
                <Send className="h-3.5 w-3.5" />
                Export summary to new chat
              </Button>
            )}
          </div>
        </div>
      ) : null}

      <div className="relative flex flex-1 min-h-0">
        <ScrollArea
          className="flex-1 h-full"
          data-testid="message-list-scroll-area"
          viewportRef={handleViewportMount}
          viewportProps={{ onScroll: handleViewportScroll }}
        >
          <div
            className={cn('mx-auto', chatWidthClass, densityClasses.content)}
            data-testid="message-list-content"
          >
            {visibleMessages.map((message, index) => {
              const matchIndex = searchMatches.findIndex(
                (item) => item.messageIndex === index
              );
              const isMatch = matchIndex !== -1;
              const isActiveMatch = selectedMatch?.messageIndex === index;

              return (
                <div
                  key={message.id}
                  ref={(node) => {
                    messageRefs.current[message.id] = node;
                  }}
                  data-testid={`chat-message-${message.id}`}
                  data-match-index={matchIndex}
                  title={summarizeMessageText(
                    getMessageText(message),
                    message.role,
                    isPrivacyMode
                  )}
                  className={`rounded-lg transition ${
                    isActiveMatch ? 'outline outline-2 outline-primary/70' : ''
                  }`}
                >
                  <MessageBubble
                    message={message}
                    highlightQuery={normalizedSearchQuery}
                    isMatch={isMatch}
                    densityClass={densityClasses.bubble}
                    chatFontClass={chatFontClass}
                    chatFontStyle={chatFontStyle}
                    metadata={assistantMetadata?.[message.id]}
                    artifactRefs={artifactRefsByMessageId.get(message.id)}
                    artifactMap={artifactMap}
                    onArchiveArtifact={handleArchiveArtifact}
                  />
                </div>
              );
            })}

            {/* Streaming indicator when waiting for first response */}
            {isLoading && visibleMessages[visibleMessages.length - 1]?.role === 'user' && (
              <div className="flex justify-start">
                <div className="rounded-lg bg-muted px-4 py-3">
                  <div className="flex items-center gap-2">
                    <ArrowDown className="h-4 w-4 animate-spin text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">
                      Claude is thinking...
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Streaming indicator when assistant is actively generating */}
            {isLoading &&
              visibleMessages[visibleMessages.length - 1]?.role === 'assistant' &&
              toolCallEntries.length === 0 && (
                <div className="flex justify-start pl-4">
                  <div className="flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-blue-400" />
                    <span className="text-xs text-muted-foreground">
                      Generating...
                    </span>
                  </div>
                </div>
              )}

            {/* Render stream event blocks after the last assistant message, only while streaming */}
            {visibleMessages.map((message, index) => {
              if (!isLoading || message.role !== 'assistant' || index !== visibleMessages.length - 1) {
                return null;
              }

              return (
                <div key={`stream-events-${message.id}`} className="mt-2 space-y-1">
                  {thinkingEntries.map(([key, text]) => (
                    <ThinkingBlock
                      key={`${key}-${thinkingToggleVersion}`}
                      text={text}
                      defaultExpanded={thinkingExpanded}
                    />
                  ))}

                  {toolCallEntries.map((tc) => (
                    <ToolCallBlock
                      key={tc.toolUseId}
                      toolCall={tc}
                      onFixErrors={onToolFixErrors}
                    />
                  ))}
                </div>
              );
            })}

            <div ref={bottomRef} />
          </div>
        </ScrollArea>

        {showMinimap && (
          <ConversationMinimap
            turns={conversationTurns}
            onJumpTo={jumpToMessageIndex}
          />
        )}

        {showScrollToBottom && (
          <button
            type="button"
            onClick={handleScrollToBottom}
            data-testid="message-list-scroll-to-bottom"
            className="absolute right-10 bottom-4 z-10 inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-2 text-xs shadow-sm transition hover:bg-muted/60"
            aria-label="Scroll to bottom"
          >
            <ArrowDown className="h-4 w-4" />
            <span>Latest</span>
          </button>
        )}
      </div>
    </div>
  );
}

function MessageBubble({
  message,
  highlightQuery,
  isMatch,
  densityClass,
  chatFontClass,
  chatFontStyle,
  metadata,
  artifactRefs,
  artifactMap,
  onArchiveArtifact,
}: {
  message: UIMessage;
  highlightQuery: string;
  isMatch: boolean;
  densityClass: string;
  chatFontClass: string;
  chatFontStyle?: CSSProperties;
  metadata?: AssistantResponseMetadata;
  artifactRefs?: ArtifactRefMessagePart[];
  artifactMap?: Map<string, import('@claude-tauri/shared').Artifact>;
  onArchiveArtifact?: (id: string) => void;
}) {
  const isUser = message.role === 'user';
  const text = getMessageText(message);

  if (isUser) {
    return (
      <div
        data-testid="message-bubble"
        className={cn(
          'rounded-lg bg-primary/10 text-foreground border border-primary/15',
          densityClass,
          chatFontClass,
          isMatch ? 'ring-2 ring-primary/40' : ''
        )}
        style={chatFontStyle}
      >
        <span className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1">
          <User className="h-3 w-3" />
          You
        </span>
        <div className="text-sm whitespace-pre-wrap break-words">
          {highlightQuery
            ? renderHighlightedText(text, highlightQuery)
            : text}
        </div>
      </div>
    );
  }

  return (
    <div
      data-testid="message-bubble"
      className={cn(
        'max-w-[80%] min-w-0 rounded-lg bg-muted text-foreground',
        densityClass,
        chatFontClass,
        isMatch ? 'ring-2 ring-foreground/40' : ''
      )}
      style={chatFontStyle}
    >
      <span className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1">
        <Bot className="h-3 w-3" />
        Claude
      </span>
      <div className={chatFontClass} style={chatFontStyle}>
        <MarkdownRenderer content={text} />
      </div>
      {artifactRefs && artifactRefs.length > 0 && (
        <div className="mt-2 space-y-1">
          {artifactRefs.map((ref) => {
            const artifact = artifactMap?.get(ref.artifactId);
            if (!artifact) return null;
            return (
              <ArtifactBlock
                key={ref.artifactId}
                artifact={artifact}
                onArchive={onArchiveArtifact}
              />
            );
          })}
        </div>
      )}
      {metadata ? (
        <AssistantResponseFooter messageId={message.id} text={text} metadata={metadata} />
      ) : null}
    </div>
  );
}

function AssistantResponseFooter({
  messageId,
  text,
  metadata,
}: {
  messageId: string;
  text: string;
  metadata: AssistantResponseMetadata;
}) {
  const [isHovered, setIsHovered] = useState(false);
  const changedFiles = metadata.changedFiles.filter(Boolean);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
  };

  return (
    <div className="mt-3 border-t border-border/60 pt-2">
      <div
        data-testid={`assistant-response-meta-${messageId}`}
        className="relative flex flex-wrap items-center gap-2 text-xs text-muted-foreground"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <span className="font-medium text-foreground/90">
          {formatDuration(metadata.durationMs)}
        </span>
        <span>{metadata.inputTokens + metadata.outputTokens} tokens</span>
        {changedFiles.length > 0 ? (
          <span>{changedFiles.length} file{changedFiles.length === 1 ? '' : 's'} changed</span>
        ) : null}
        <button
          type="button"
          data-testid={`assistant-response-copy-${messageId}`}
          onClick={() => {
            void handleCopy();
          }}
          className="ml-auto inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-muted-foreground transition hover:bg-background/70 hover:text-foreground"
        >
          <Copy className="h-3.5 w-3.5" />
          <span>Copy markdown</span>
        </button>

        {isHovered ? (
          <div className="absolute bottom-full left-0 mb-2 z-10 rounded-md border border-border bg-popover px-3 py-2 text-xs shadow-md whitespace-nowrap">
            <div className="space-y-0.5">
              <div>Model: {metadata.model}</div>
              <div>Input: {metadata.inputTokens.toLocaleString()}</div>
              <div>Output: {metadata.outputTokens.toLocaleString()}</div>
              <div>Cache read: {metadata.cacheReadTokens.toLocaleString()}</div>
              <div>Cache write: {metadata.cacheCreationTokens.toLocaleString()}</div>
            </div>
          </div>
        ) : null}
      </div>

      {changedFiles.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {changedFiles.map((filePath) => (
            <span
              key={filePath}
              className="rounded-full border border-border/70 bg-background/50 px-2 py-0.5 text-[11px] text-muted-foreground"
            >
              {truncateText(filePath, 48)}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function ConversationMinimap({
  turns,
  onJumpTo,
}: {
  turns: ConversationTurn[];
  onJumpTo: (messageIndex: number) => void;
}) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  return (
    <div
      className="relative w-7 flex-shrink-0 border-l border-border/20 bg-background/30 select-none flex flex-col items-center pt-3 pb-3 gap-1.5 overflow-y-auto"
      aria-label="Conversation outline"
    >
      {turns.map((turn) => {
        const isHovered = hoveredIndex === turn.turnIndex;

        return (
          <div key={turn.userMessageId} className="relative w-full flex justify-center">
            <button
              type="button"
              onClick={() => onJumpTo(turn.userMessageIndex)}
              onMouseEnter={() => setHoveredIndex(turn.turnIndex)}
              onMouseLeave={() => setHoveredIndex(null)}
              className={cn(
                'w-3.5 h-[3px] rounded-full cursor-pointer transition-all duration-150 focus-visible:outline-none',
                turn.hasSearchMatch
                  ? 'bg-yellow-400 opacity-90'
                  : 'bg-zinc-400',
                turn.isCurrentMatch ? 'opacity-100 w-4' : 'opacity-40',
                'hover:opacity-100 hover:w-4'
              )}
            />

            {/* Hover tooltip — floats to the left */}
            {isHovered && (
              <div className="absolute right-full mr-2 top-1/2 -translate-y-1/2 z-50 pointer-events-none">
                <div className="rounded-md border border-border bg-popover px-2.5 py-1.5 text-xs shadow-md whitespace-nowrap max-w-[220px] overflow-hidden text-ellipsis">
                  <span className="text-muted-foreground mr-1">#{turn.turnIndex + 1}</span>
                  <span className="text-foreground">{turn.summary}</span>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
