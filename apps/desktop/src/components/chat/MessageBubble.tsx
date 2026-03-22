import type { CSSProperties } from 'react';
import type { ArtifactRefMessagePart } from '@claude-tauri/shared';
import type { UIMessage } from '@ai-sdk/react';
import { cn } from '@/lib/utils';
import { MarkdownRenderer } from './MarkdownRenderer';
import { ArtifactBlock } from './ArtifactBlock';
import { User, Robot } from '@phosphor-icons/react';
import { type AssistantResponseMetadata, getMessageText, renderHighlightedText } from './message-list-utils';
import { AssistantResponseFooter } from './AssistantResponseFooter';

export function MessageBubble({ message, highlightQuery, isMatch, densityClass, chatFontClass, chatFontStyle, metadata, artifactRefs, artifactMap, onArchiveArtifact }: { message: UIMessage; highlightQuery: string; isMatch: boolean; densityClass: string; chatFontClass: string; chatFontStyle?: CSSProperties; metadata?: AssistantResponseMetadata; artifactRefs?: ArtifactRefMessagePart[]; artifactMap?: Map<string, import('@claude-tauri/shared').Artifact>; onArchiveArtifact?: (id: string) => void }) {
  const isUser = message.role === 'user';
  const text = getMessageText(message);
  if (isUser) return (<div data-testid="message-bubble" className={cn('rounded-lg bg-primary/10 text-foreground border border-primary/15', densityClass, chatFontClass, isMatch ? 'ring-2 ring-primary/40' : '')} style={chatFontStyle}><span className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1"><User className="h-3 w-3" />You</span><div className="text-sm whitespace-pre-wrap break-words">{highlightQuery ? renderHighlightedText(text, highlightQuery) : text}</div></div>);
  return (<div data-testid="message-bubble" className={cn('max-w-[80%] min-w-0 rounded-lg bg-muted text-foreground', densityClass, chatFontClass, isMatch ? 'ring-2 ring-foreground/40' : '')} style={chatFontStyle}><span className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1"><Robot className="h-3 w-3" />Claude</span><div className={chatFontClass} style={chatFontStyle}><MarkdownRenderer content={text} /></div>{artifactRefs && artifactRefs.length > 0 && (<div className="mt-2 space-y-1">{artifactRefs.map((ref) => { const artifact = artifactMap?.get(ref.artifactId); if (!artifact) return null; return <ArtifactBlock key={ref.artifactId} artifact={artifact} onArchive={onArchiveArtifact} />; })}</div>)}{metadata ? <AssistantResponseFooter messageId={message.id} text={text} metadata={metadata} /> : null}</div>);
}
