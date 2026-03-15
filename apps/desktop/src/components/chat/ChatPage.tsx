import { useState, useEffect, useMemo } from 'react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import type { UIMessage } from '@ai-sdk/react';
import type { Message } from '@claude-tauri/shared';
import { MessageList } from './MessageList';
import { ChatInput } from './ChatInput';

const API_BASE = 'http://localhost:3131';

interface ChatPageProps {
  sessionId: string | null;
}

/**
 * Convert a persisted Message (from the DB) into a UIMessage
 * that the AI SDK useChat hook understands.
 */
function toUIMessage(msg: Message): UIMessage {
  return {
    id: msg.id,
    role: msg.role,
    parts: [{ type: 'text' as const, text: msg.content }],
  };
}

export function ChatPage({ sessionId }: ChatPageProps) {
  const [input, setInput] = useState('');

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: `${API_BASE}/api/chat`,
        body: { sessionId },
      }),
    [sessionId]
  );

  const { messages, sendMessage, status, setMessages } = useChat({
    // Use sessionId as the chat id so useChat resets its internal state
    // when switching sessions
    id: sessionId ?? undefined,
    transport,
  });

  // Load persisted messages when the session changes
  useEffect(() => {
    if (!sessionId) {
      setMessages([]);
      return;
    }

    let cancelled = false;

    async function loadMessages() {
      try {
        const res = await fetch(
          `${API_BASE}/api/sessions/${sessionId}/messages`
        );
        if (!res.ok) return;

        const saved: Message[] = await res.json();
        if (cancelled) return;

        if (saved.length > 0) {
          setMessages(saved.map(toUIMessage));
        }
      } catch {
        // Server not reachable — leave messages empty
      }
    }

    loadMessages();

    return () => {
      cancelled = true;
    };
  }, [sessionId, setMessages]);

  const isLoading = status === 'submitted' || status === 'streaming';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || isLoading) return;
    setInput('');
    await sendMessage({ text });
  };

  return (
    <div className="flex flex-1 flex-col min-w-0">
      <MessageList messages={messages} isLoading={isLoading} />
      <ChatInput
        input={input}
        onInputChange={setInput}
        onSubmit={handleSubmit}
        isLoading={isLoading}
      />
    </div>
  );
}
