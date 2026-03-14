import { useState } from 'react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { MessageList } from './MessageList';
import { ChatInput } from './ChatInput';

const API_BASE = 'http://localhost:3131';

interface ChatPageProps {
  sessionId: string | null;
}

export function ChatPage({ sessionId }: ChatPageProps) {
  const [input, setInput] = useState('');

  const transport = new DefaultChatTransport({
    api: `${API_BASE}/api/chat`,
    body: { sessionId },
  });

  const { messages, sendMessage, status } = useChat({ transport });

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
