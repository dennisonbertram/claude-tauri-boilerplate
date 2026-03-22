import type { CSSProperties } from 'react';
import type { UIMessage } from '@ai-sdk/react';

export interface AssistantResponseMetadata { model: string; durationMs: number; inputTokens: number; outputTokens: number; cacheReadTokens: number; cacheCreationTokens: number; changedFiles: string[]; }
export interface SearchMatch { messageIndex: number; messageId: string; }
export interface ConversationTurn { turnIndex: number; userMessageIndex: number; userMessageId: string; summary: string; assistantMessageIndex?: number; hasSearchMatch: boolean; isCurrentMatch: boolean; }
export const MONO_FONT_STYLE: CSSProperties = { fontFamily: 'var(--chat-mono-font)' };

export function getMessageText(message: UIMessage): string { return message.parts?.filter((p): p is Extract<typeof p, { type: 'text' }> => p.type === 'text').map((p) => p.text).join('') || ''; }
export function escapeRegExp(input: string): string { return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

export function summarizeMessageText(text: string, role: UIMessage['role'], isPrivacyMode: boolean): string {
  const trimmed = text.trim().replace(/\s+/g, ' ');
  if (!trimmed) return role === 'user' ? 'User message with no text' : 'Assistant message with no text';
  if (isPrivacyMode) { const wordCount = trimmed.split(/\s+/).length; return `${role === 'user' ? 'User' : 'Assistant'} message (${wordCount} words)`; }
  const maxLen = 80; if (trimmed.length <= maxLen) return trimmed; return `${trimmed.slice(0, maxLen)}\u2026`;
}

export function truncateText(text: string, maxLen = 60): string { const trimmed = text.trim().replace(/\s+/g, ' '); if (trimmed.length <= maxLen) return trimmed; return `${trimmed.slice(0, maxLen)}\u2026`; }
export function formatDuration(durationMs: number): string { return `${(durationMs / 1000).toFixed(1)}s`; }

export function getChatWidthClass(width: 'standard' | 'wide' | 'full'): string { switch (width) { case 'wide': return 'max-w-5xl'; case 'full': return 'max-w-none'; default: return 'max-w-3xl'; } }
export function getChatDensityClasses(density: 'comfortable' | 'compact'): { content: string; bubble: string } { if (density === 'compact') return { content: 'space-y-2 p-3', bubble: 'px-3 py-2.5' }; return { content: 'space-y-4 p-4', bubble: 'px-4 py-3' }; }

export function renderHighlightedText(text: string, query: string) {
  const escaped = escapeRegExp(query); const regex = new RegExp(`(${escaped})`, 'gi'); const parts = text.split(regex);
  return parts.map((part, index) => { if (!part) return null; const isMatch = part.toLowerCase() === query.toLowerCase(); if (isMatch) return <mark key={`${part}-${index}`} className="rounded-[2px] bg-yellow-300/60 px-0.5">{part}</mark>; return <span key={`${part}-${index}`}>{part}</span>; });
}
