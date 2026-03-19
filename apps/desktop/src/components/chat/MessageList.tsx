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
  BookOpen,
  FileText,
  ChevronDown,
  ChevronUp,
  Send,
  Copy,
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

interface TocItem {
  messageIndex: number;
  messageId: string;
  label: string;
  summary: string;
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
  toc: string;
  bubble: string;
} {
  if (density === 'compact') {
    return {
      content: 'space-y-2 p-3',
      toc: 'max-h-20',
      bubble: 'px-3 py-2.5',
    };
  }

  return {
    content: 'space-y-4 p-4',
    toc: 'max-h-24',
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

  const tocItems = useMemo<TocItem[]>(() => {
    return visibleMessages.map((message, messageIndex) => {
      const text = getMessageText(message);
      return {
        messageIndex,
        messageId: message.id,
        label: `${message.role === 'user' ? 'You' : 'Claude'} #${messageIndex + 1}`,
        summary: summarizeMessageText(text, message.role, isPrivacyMode),
      };
    });
  }, [visibleMessages, isPrivacyMode]);

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

  const showToc = visibleMessages.length >= 6;

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
  const chatWidthClass = getChatWidthClass(settings.chatWidth);
  const densityClasses = getChatDensityClasses(settings.chatDensity);
  const chatFontClass = settings.chatFont === 'mono' ? 'font-mono' : '';
  const chatFontStyle = settings.chatFont === 'mono' ? MONO_FONT_STYLE : undefined;

  return (
    <div
      ref={containerRef}
      className="relative flex flex-1 min-h-0 overflow-hidden"
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

      {showToc ? (
        <div
          className="border-b border-border bg-background/85 px-3 py-2"
          data-testid="message-list-toc"
        >
          <div className="mb-2 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <BookOpen className="h-4 w-4" />
              <span>Table of Contents</span>
            </div>
            <div
              className="flex items-center gap-1 text-xs text-muted-foreground"
              data-testid="message-list-session-summary"
            >
              <FileText className="h-3.5 w-3.5" />
              <span>{visibleMessages.length} messages</span>
            </div>
          </div>

          <div className={cn('flex flex-col gap-1 overflow-auto pr-1', densityClasses.toc)}>
            {tocItems.map((item, tocIndex) => {
              const isMatch = searchMatches.some((match) => match.messageIndex === item.messageIndex);
              const isActive = selectedMatch?.messageIndex === item.messageIndex;
              const isMatchActive = selectedMatch?.messageIndex === item.messageIndex;
              const summaryText =
                item.summary.length > 120 ? `${item.summary.slice(0, 120)}…` : item.summary;

              return (
                <button
                  key={item.messageId}
                  type="button"
                  data-testid="message-list-toc-entry"
                  data-toc-entry-index={tocIndex}
                  onClick={() => jumpToMessageIndex(item.messageIndex)}
                  className={`rounded-md border border-transparent px-2 py-1 text-left text-xs transition-colors ${
                    isActive
                      ? 'border-primary/40 bg-primary/8'
                      : 'hover:bg-muted/80'
                  } ${isMatch ? 'font-medium' : ''}`}
                  title={summaryText}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span>{item.label}</span>
                    <span className="text-muted-foreground">{item.summary}</span>
                  </div>
                  <span className="sr-only">{summaryText}</span>
                  {isMatchActive ? (
                    <span className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-primary">
                      <ChevronUp className="h-3 w-3" />
                      Search hit
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      <ScrollArea
        className="h-full"
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

      {showScrollToBottom && (
        <button
          type="button"
          onClick={handleScrollToBottom}
          data-testid="message-list-scroll-to-bottom"
          className="absolute right-4 bottom-4 z-10 inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-2 text-xs shadow-sm transition hover:bg-muted/60"
          aria-label="Scroll to bottom"
        >
          <ArrowDown className="h-4 w-4" />
          <span>Latest</span>
        </button>
      )}
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
          'rounded-lg bg-primary text-primary-foreground',
          densityClass,
          chatFontClass,
          isMatch ? 'ring-2 ring-primary-foreground/50' : ''
        )}
        style={chatFontStyle}
      >
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
      <span className="text-xs font-medium text-muted-foreground mb-1 block">Claude</span>
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
