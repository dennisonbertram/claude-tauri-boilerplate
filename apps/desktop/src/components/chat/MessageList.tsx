import { useEffect, useRef } from 'react';
import type { UIMessage } from '@ai-sdk/react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MarkdownRenderer } from './MarkdownRenderer';
import { ToolCallBlock } from './ToolCallBlock';
import { ThinkingBlock } from './ThinkingBlock';
import type { ToolCallState } from '@/hooks/useStreamEvents';
import { Loader2 } from 'lucide-react';

interface MessageListProps {
  messages: UIMessage[];
  isLoading: boolean;
  toolCalls?: Map<string, ToolCallState>;
  thinkingBlocks?: Map<string, string>;
}

export function MessageList({
  messages,
  isLoading,
  toolCalls,
  thinkingBlocks,
}: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
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

  return (
    <ScrollArea className="flex-1">
      <div className="mx-auto max-w-3xl space-y-4 p-4">
        {messages.map((message, index) => (
          <div key={message.id}>
            <MessageBubble message={message} />

            {/* Render stream event blocks after the last assistant message */}
            {message.role === 'assistant' &&
              index === messages.length - 1 && (
                <div className="mt-2 space-y-1">
                  {/* Thinking blocks */}
                  {thinkingEntries.map(([key, text]) => (
                    <ThinkingBlock key={key} text={text} />
                  ))}

                  {/* Tool call blocks */}
                  {toolCallEntries.map(tc => (
                    <ToolCallBlock key={tc.toolUseId} toolCall={tc} />
                  ))}
                </div>
              )}
          </div>
        ))}

        {/* Streaming indicator when waiting for first response */}
        {isLoading && messages[messages.length - 1]?.role === 'user' && (
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
          messages[messages.length - 1]?.role === 'assistant' &&
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

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[80%] rounded-lg px-4 py-3 ${
          isUser
            ? 'bg-primary text-primary-foreground'
            : 'bg-muted text-foreground'
        }`}
      >
        {isUser ? (
          <div className="text-sm whitespace-pre-wrap break-words">{text}</div>
        ) : (
          <MarkdownRenderer content={text} />
        )}
      </div>
    </div>
  );
}
