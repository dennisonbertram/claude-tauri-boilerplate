import { useCallback, useEffect, useRef, useState, type UIEvent } from 'react';
import type { UIMessage } from '@ai-sdk/react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MarkdownRenderer } from './MarkdownRenderer';
import { ToolCallBlock } from './ToolCallBlock';
import { ThinkingBlock } from './ThinkingBlock';
import type { ToolCallState } from '@/hooks/useStreamEvents';
import { ArrowDown, Loader2 } from 'lucide-react';
import type { ToolCallBlockProps } from './ToolCallBlock';

interface MessageListProps {
  messages: UIMessage[];
  isLoading: boolean;
  toolCalls?: Map<string, ToolCallState>;
  thinkingBlocks?: Map<string, string>;
  onToolFixErrors?: ToolCallBlockProps['onFixErrors'];
}

export function MessageList({
  messages,
  isLoading,
  toolCalls,
  thinkingBlocks,
  onToolFixErrors,
}: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);

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

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    updateScrollButtonVisibility(viewportRef.current);
  }, [messages, toolCalls, thinkingBlocks]);

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

  // Collect thinking blocks and tool calls to show after the latest assistant message
  const thinkingEntries = thinkingBlocks
    ? Array.from(thinkingBlocks.entries())
    : [];
  const toolCallEntries = toolCalls
    ? Array.from(toolCalls.values())
    : [];

  // Filter out empty assistant messages (the AI SDK may create placeholder
  // entries from start/text-start events before any text arrives)
  const visibleMessages = messages.filter((msg) => {
    if (msg.role !== 'assistant') return true;
    const text = msg.parts
      ?.filter((p): p is Extract<typeof p, { type: 'text' }> => p.type === 'text')
      .map((p) => p.text)
      .join('') || '';
    return text.trim().length > 0;
  });

  return (
    <div
      ref={containerRef}
      className="relative flex-1 min-h-0 overflow-hidden"
    >
      <ScrollArea
        className="h-full"
        data-testid="message-list-scroll-area"
        viewportRef={handleViewportMount}
        viewportProps={{ onScroll: handleViewportScroll }}
      >
        <div className="mx-auto max-w-3xl space-y-4 p-4">
          {visibleMessages.map((message, index) => (
            <div key={message.id}>
              <MessageBubble message={message} />

              {/* Render stream event blocks after the last assistant message, only while streaming */}
              {isLoading && message.role === 'assistant' &&
                index === visibleMessages.length - 1 && (
                  <div className="mt-2 space-y-1">
                    {/* Thinking blocks */}
                    {thinkingEntries.map(([key, text]) => (
                      <ThinkingBlock key={key} text={text} />
                    ))}

                    {/* Tool call blocks */}
                    {toolCallEntries.map(tc => (
                      <ToolCallBlock
                        key={tc.toolUseId}
                        toolCall={tc}
                        onFixErrors={onToolFixErrors}
                      />
                    ))}
                  </div>
                )}
            </div>
          ))}

          {/* Streaming indicator when waiting for first response */}
          {isLoading && visibleMessages[visibleMessages.length - 1]?.role === 'user' && (
            <div className="flex justify-start">
              <div className="rounded-lg bg-muted px-4 py-3">
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
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

function MessageBubble({ message }: { message: UIMessage }) {
  const isUser = message.role === 'user';

  // Extract text from message parts
  const text =
    message.parts
      ?.filter(
        (part): part is Extract<typeof part, { type: 'text' }> =>
          part.type === 'text'
      )
      .map(part => part.text)
      .join('') || '';

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] rounded-lg px-4 py-3 bg-primary text-primary-foreground">
          <div className="text-sm whitespace-pre-wrap break-words">{text}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-start gap-3">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-orange-400 to-amber-600 text-white mt-0.5">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2a5 5 0 0 1 5 5v3a5 5 0 0 1-10 0V7a5 5 0 0 1 5-5z" />
          <path d="M8.5 16.5a6.5 6.5 0 0 0 7 0" />
          <path d="M12 16v6" />
        </svg>
      </div>
      <div className="max-w-[80%] min-w-0">
        <span className="text-xs font-medium text-muted-foreground mb-1 block">Claude</span>
        <div className="rounded-lg bg-muted px-4 py-3 text-foreground">
          <MarkdownRenderer content={text} />
        </div>
      </div>
    </div>
  );
}
