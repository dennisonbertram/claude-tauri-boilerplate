import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSuggestions } from '../useSuggestions';
import type { UIMessage } from '@ai-sdk/react';

function makeMessage(role: 'user' | 'assistant', text: string): UIMessage {
  return {
    id: `msg-${Math.random().toString(36).slice(2)}`,
    role,
    parts: [{ type: 'text' as const, text }],
  };
}

describe('useSuggestions', () => {
  describe('suggestion generation', () => {
    it('returns no suggestions when there are no messages', () => {
      const { result } = renderHook(() => useSuggestions([]));
      expect(result.current.suggestions).toEqual([]);
      expect(result.current.currentSuggestion).toBeNull();
    });

    it('returns no suggestions when last message is from the user', () => {
      const messages = [makeMessage('user', 'Hello')];
      const { result } = renderHook(() => useSuggestions(messages));
      expect(result.current.suggestions).toEqual([]);
    });

    it('generates code-related suggestions when assistant message contains code blocks', () => {
      const messages = [
        makeMessage('user', 'Show me an example'),
        makeMessage('assistant', 'Here is some code:\n```javascript\nconst x = 1;\n```'),
      ];
      const { result } = renderHook(() => useSuggestions(messages));
      expect(result.current.suggestions.length).toBeGreaterThan(0);
      // Should include at least one code-related suggestion
      const hasCodeSuggestion = result.current.suggestions.some(
        (s) =>
          s.toLowerCase().includes('explain') ||
          s.toLowerCase().includes('test') ||
          s.toLowerCase().includes('refactor')
      );
      expect(hasCodeSuggestion).toBe(true);
    });

    it('generates error-related suggestions when assistant message contains error content', () => {
      const messages = [
        makeMessage('user', 'Run this'),
        makeMessage('assistant', 'Error: Cannot read property "foo" of undefined\nTypeError at line 42'),
      ];
      const { result } = renderHook(() => useSuggestions(messages));
      expect(result.current.suggestions.length).toBeGreaterThan(0);
      const hasErrorSuggestion = result.current.suggestions.some(
        (s) =>
          s.toLowerCase().includes('fix') ||
          s.toLowerCase().includes('error') ||
          s.toLowerCase().includes('wrong')
      );
      expect(hasErrorSuggestion).toBe(true);
    });

    it('generates general follow-up suggestions for non-code/non-error responses', () => {
      const messages = [
        makeMessage('user', 'Tell me about React hooks'),
        makeMessage('assistant', 'React hooks are a feature that lets you use state and lifecycle features in functional components.'),
      ];
      const { result } = renderHook(() => useSuggestions(messages));
      expect(result.current.suggestions.length).toBeGreaterThan(0);
    });

    it('currentSuggestion returns the first suggestion', () => {
      const messages = [
        makeMessage('user', 'Hello'),
        makeMessage('assistant', 'Here is some code:\n```\nconst x = 1;\n```'),
      ];
      const { result } = renderHook(() => useSuggestions(messages));
      expect(result.current.currentSuggestion).toBe(result.current.suggestions[0]);
    });

    it('limits suggestions to at most 3', () => {
      const messages = [
        makeMessage('user', 'Show me code'),
        makeMessage('assistant', 'Here is code:\n```\nconst x = 1;\n```\nAlso there was an Error: something failed'),
      ];
      const { result } = renderHook(() => useSuggestions(messages));
      expect(result.current.suggestions.length).toBeLessThanOrEqual(3);
    });
  });

  describe('accept', () => {
    it('calls onAccept callback with the accepted suggestion text', () => {
      const messages = [
        makeMessage('user', 'Hello'),
        makeMessage('assistant', 'Here is code:\n```\nconst x = 1;\n```'),
      ];
      const onAccept = vi.fn();
      const { result } = renderHook(() => useSuggestions(messages, { onAccept }));

      const suggestion = result.current.currentSuggestion;
      expect(suggestion).not.toBeNull();

      act(() => {
        result.current.accept(suggestion!);
      });

      expect(onAccept).toHaveBeenCalledWith(suggestion);
    });
  });

  describe('dismiss', () => {
    it('removes dismissed suggestion from the list', () => {
      const messages = [
        makeMessage('user', 'Hello'),
        makeMessage('assistant', 'Here is code:\n```\nconst x = 1;\n```'),
      ];
      const { result } = renderHook(() => useSuggestions(messages));
      const firstSuggestion = result.current.suggestions[0];
      expect(firstSuggestion).toBeDefined();

      act(() => {
        result.current.dismiss(firstSuggestion);
      });

      expect(result.current.suggestions).not.toContain(firstSuggestion);
    });

    it('dismissed suggestions do not reappear on re-render', () => {
      const messages = [
        makeMessage('user', 'Hello'),
        makeMessage('assistant', 'Here is code:\n```\nconst x = 1;\n```'),
      ];
      const { result, rerender } = renderHook(
        ({ msgs }) => useSuggestions(msgs),
        { initialProps: { msgs: messages } }
      );

      const firstSuggestion = result.current.suggestions[0];
      act(() => {
        result.current.dismiss(firstSuggestion);
      });

      // Re-render with same messages
      rerender({ msgs: messages });
      expect(result.current.suggestions).not.toContain(firstSuggestion);
    });

    it('currentSuggestion updates after dismissing the first suggestion', () => {
      const messages = [
        makeMessage('user', 'Hello'),
        makeMessage('assistant', 'Here is code:\n```\nconst x = 1;\n```'),
      ];
      const { result } = renderHook(() => useSuggestions(messages));

      if (result.current.suggestions.length < 2) return; // skip if not enough suggestions

      const first = result.current.suggestions[0];
      const second = result.current.suggestions[1];

      act(() => {
        result.current.dismiss(first);
      });

      expect(result.current.currentSuggestion).toBe(second);
    });
  });

  describe('dismissAll', () => {
    it('clears all suggestions', () => {
      const messages = [
        makeMessage('user', 'Hello'),
        makeMessage('assistant', 'Here is code:\n```\nconst x = 1;\n```'),
      ];
      const { result } = renderHook(() => useSuggestions(messages));
      expect(result.current.suggestions.length).toBeGreaterThan(0);

      act(() => {
        result.current.dismissAll();
      });

      expect(result.current.suggestions).toEqual([]);
      expect(result.current.currentSuggestion).toBeNull();
    });
  });

  describe('message changes', () => {
    it('regenerates suggestions when messages change', () => {
      const initialMessages = [
        makeMessage('user', 'Hello'),
        makeMessage('assistant', 'Here is code:\n```\nconst x = 1;\n```'),
      ];

      const { result, rerender } = renderHook(
        ({ msgs }) => useSuggestions(msgs),
        { initialProps: { msgs: initialMessages } }
      );

      const initialSuggestions = [...result.current.suggestions];
      expect(initialSuggestions.length).toBeGreaterThan(0);

      // Change messages to something with an error
      const newMessages = [
        ...initialMessages,
        makeMessage('user', 'Run it'),
        makeMessage('assistant', 'Error: Something went wrong'),
      ];

      rerender({ msgs: newMessages });

      // Suggestions should change (error-based now)
      const hasErrorSuggestion = result.current.suggestions.some(
        (s) =>
          s.toLowerCase().includes('fix') ||
          s.toLowerCase().includes('error') ||
          s.toLowerCase().includes('wrong')
      );
      expect(hasErrorSuggestion).toBe(true);
    });

    it('clears dismissed set when messages change', () => {
      const initialMessages = [
        makeMessage('user', 'Hello'),
        makeMessage('assistant', 'Here is code:\n```\nconst x = 1;\n```'),
      ];

      const { result, rerender } = renderHook(
        ({ msgs }) => useSuggestions(msgs),
        { initialProps: { msgs: initialMessages } }
      );

      // Dismiss all
      act(() => {
        result.current.dismissAll();
      });
      expect(result.current.suggestions).toEqual([]);

      // New messages arrive
      const newMessages = [
        ...initialMessages,
        makeMessage('user', 'Do something else'),
        makeMessage('assistant', 'Sure, here is more code:\n```\nconst y = 2;\n```'),
      ];
      rerender({ msgs: newMessages });

      // Should have new suggestions (dismissed set was cleared)
      expect(result.current.suggestions.length).toBeGreaterThan(0);
    });
  });
});
