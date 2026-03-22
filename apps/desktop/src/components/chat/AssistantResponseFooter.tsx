import { useState } from 'react';
import { Copy } from '@phosphor-icons/react';
import { type AssistantResponseMetadata, formatDuration, truncateText } from './message-list-utils';

export function AssistantResponseFooter({ messageId, text, metadata }: { messageId: string; text: string; metadata: AssistantResponseMetadata }) {
  const [isHovered, setIsHovered] = useState(false);
  const changedFiles = metadata.changedFiles.filter(Boolean);
  const handleCopy = async () => { await navigator.clipboard.writeText(text); };
  return (
    <div className="mt-3 border-t border-border/60 pt-2">
      <div data-testid={`assistant-response-meta-${messageId}`} className="relative flex flex-wrap items-center gap-2 text-xs text-muted-foreground" onMouseEnter={() => setIsHovered(true)} onMouseLeave={() => setIsHovered(false)}>
        <span className="font-medium text-foreground/90">{formatDuration(metadata.durationMs)}</span>
        <span>{metadata.inputTokens + metadata.outputTokens} tokens</span>
        {changedFiles.length > 0 ? <span>{changedFiles.length} file{changedFiles.length === 1 ? '' : 's'} changed</span> : null}
        <button type="button" data-testid={`assistant-response-copy-${messageId}`} onClick={() => { void handleCopy(); }} className="ml-auto inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-muted-foreground transition hover:bg-background/70 hover:text-foreground"><Copy className="h-3.5 w-3.5" /><span>Copy markdown</span></button>
        {isHovered ? (<div className="absolute bottom-full left-0 mb-2 z-10 rounded-md border border-border bg-popover px-3 py-2 text-xs shadow-md whitespace-nowrap"><div className="space-y-0.5"><div>Model: {metadata.model}</div><div>Input: {metadata.inputTokens.toLocaleString()}</div><div>Output: {metadata.outputTokens.toLocaleString()}</div><div>Cache read: {metadata.cacheReadTokens.toLocaleString()}</div><div>Cache write: {metadata.cacheCreationTokens.toLocaleString()}</div></div></div>) : null}
      </div>
      {changedFiles.length > 0 ? (<div className="mt-2 flex flex-wrap gap-1.5">{changedFiles.map((filePath) => (<span key={filePath} className="rounded-full border border-border/70 bg-background/50 px-2 py-0.5 text-[11px] text-muted-foreground">{truncateText(filePath, 48)}</span>))}</div>) : null}
    </div>
  );
}
