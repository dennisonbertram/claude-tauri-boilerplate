import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import type { UIMessage } from '@ai-sdk/react';

// --- Heuristic categories ---

const CODE_SUGGESTIONS = [
  'Can you explain this code?',
  'Add tests for this',
  'Refactor this',
];

const ERROR_SUGGESTIONS = [
  'Fix this error',
  'Explain what went wrong',
  'Show me an alternative approach',
];

const GENERAL_SUGGESTIONS = [
  'Tell me more',
  'Can you give an example?',
  'Summarize this',
];

// --- Content detection ---

function hasCodeBlock(text: string): boolean {
  return /```[\s\S]*?```/m.test(text);
}

function hasError(text: string): boolean {
  const lower = text.toLowerCase();
  return (
    /\berror\b/i.test(text) ||
    /\bexception\b/i.test(text) ||
    /\btraceback\b/i.test(text) ||
    /\bfailed\b/i.test(text) ||
    lower.includes('typeerror') ||
    lower.includes('syntaxerror') ||
    lower.includes('referenceerror') ||
    lower.includes('cannot read property')
  );
}

function getLastAssistantText(messages: UIMessage[]): string | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg.role === 'assistant') {
      const textParts = msg.parts?.filter(
        (p): p is { type: 'text'; text: string } => p.type === 'text'
      );
      if (textParts && textParts.length > 0) {
        return textParts.map((p) => p.text).join('\n');
      }
      return null;
    }
  }
  return null;
}

function generateSuggestions(messages: UIMessage[]): string[] {
  if (messages.length === 0) return [];

  const lastMessage = messages[messages.length - 1];
  if (lastMessage.role !== 'assistant') return [];

  const text = getLastAssistantText(messages);
  if (!text) return [];

  const suggestions: string[] = [];

  if (hasCodeBlock(text)) {
    suggestions.push(...CODE_SUGGESTIONS);
  }

  if (hasError(text)) {
    suggestions.push(...ERROR_SUGGESTIONS);
  }

  if (suggestions.length === 0) {
    suggestions.push(...GENERAL_SUGGESTIONS);
  }

  // Deduplicate and limit to 3
  const unique = [...new Set(suggestions)];
  return unique.slice(0, 3);
}

// --- Hook options ---

export interface UseSuggestionsOptions {
  onAccept?: (suggestion: string) => void;
}

// --- Hook ---

export function useSuggestions(
  messages: UIMessage[],
  options: UseSuggestionsOptions = {}
) {
  const { onAccept } = options;
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const lastMessageIdRef = useRef<string | null>(null);

  // Detect when the last message changes to clear dismissed set
  const lastMessage = messages.length > 0 ? messages[messages.length - 1] : null;
  const lastMessageId = lastMessage?.id ?? null;

  useEffect(() => {
    if (lastMessageId !== lastMessageIdRef.current) {
      lastMessageIdRef.current = lastMessageId;
      setDismissed(new Set());
    }
  }, [lastMessageId]);

  const rawSuggestions = useMemo(() => generateSuggestions(messages), [messages]);

  const suggestions = useMemo(
    () => rawSuggestions.filter((s) => !dismissed.has(s)),
    [rawSuggestions, dismissed]
  );

  const currentSuggestion = suggestions.length > 0 ? suggestions[0] : null;

  const accept = useCallback(
    (suggestion: string) => {
      onAccept?.(suggestion);
    },
    [onAccept]
  );

  const dismiss = useCallback((suggestion: string) => {
    setDismissed((prev) => {
      const next = new Set(prev);
      next.add(suggestion);
      return next;
    });
  }, []);

  const dismissAll = useCallback(() => {
    setDismissed((prev) => {
      const next = new Set(prev);
      for (const s of rawSuggestions) {
        next.add(s);
      }
      return next;
    });
  }, [rawSuggestions]);

  return {
    suggestions,
    currentSuggestion,
    accept,
    dismiss,
    dismissAll,
  };
}
