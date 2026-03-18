import type { ElementType } from 'react';
import { Globe, Camera, Video, MousePointerClick, Type, ScrollText, TerminalSquare, FileText, CheckCircle2, Loader2, XCircle, ExternalLink } from 'lucide-react';
import type { ToolCallState } from '@/hooks/useStreamEvents';
import {
  formatToolInputForDisplay,
  parseToolInput,
  sanitizeDisplayText,
  sanitizeUrl,
} from './gen-ui/toolData';

const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.svg'];
const VIDEO_EXTENSIONS = ['.webm', '.mp4', '.mov', '.m4v'];

type BrowserPreview = { kind: 'image' | 'video'; src: string };
type ConsoleEntry = { level: string; text: string };

function StatusIndicator({ status }: { status: ToolCallState['status'] }) {
  switch (status) {
    case 'running':
      return <Loader2 className="h-4 w-4 animate-spin text-blue-400" data-testid="status-running" />;
    case 'complete':
      return <CheckCircle2 className="h-4 w-4 text-green-400" data-testid="status-complete" />;
    case 'error':
      return <XCircle className="h-4 w-4 text-red-400" data-testid="status-error" />;
  }
}

function extractStrings(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap((item) => extractStrings(item));
  if (value && typeof value === 'object') {
    return Object.values(value).flatMap((item) => extractStrings(item));
  }
  return [];
}

function findPreview(value: unknown): BrowserPreview | null {
  const strings = extractStrings(value);

  for (const raw of strings) {
    const text = sanitizeDisplayText(raw).trim();
    const lower = text.toLowerCase();

    if (
      text.startsWith('data:image/') ||
      IMAGE_EXTENSIONS.some((ext) => lower.endsWith(ext))
    ) {
      return { kind: 'image', src: text };
    }

    if (
      text.startsWith('data:video/') ||
      VIDEO_EXTENSIONS.some((ext) => lower.endsWith(ext))
    ) {
      return { kind: 'video', src: text };
    }
  }

  return null;
}

function extractConsoleEntries(value: unknown): ConsoleEntry[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((entry) => {
      if (typeof entry === 'string') {
        return { level: 'info', text: sanitizeDisplayText(entry) };
      }
      if (!entry || typeof entry !== 'object') return null;

      const level = sanitizeDisplayText((entry as Record<string, unknown>).level ?? 'info') || 'info';
      const text =
        sanitizeDisplayText(
          (entry as Record<string, unknown>).text ??
            (entry as Record<string, unknown>).message ??
            ''
        ) || '';
      if (!text) return null;
      return { level, text };
    })
    .filter((item): item is ConsoleEntry => item !== null);
}

function extractTextResult(value: unknown): string | null {
  if (typeof value === 'string') {
    const trimmed = sanitizeDisplayText(value).trim();
    return trimmed || null;
  }

  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    for (const key of ['text', 'content', 'pageText', 'markdown', 'result']) {
      const candidate = record[key];
      if (typeof candidate === 'string' && candidate.trim()) {
        return sanitizeDisplayText(candidate);
      }
    }
  }

  return null;
}

function getBrowserAction(name: string): {
  label: string;
  Icon: ElementType;
} {
  const lower = name.toLowerCase();
  if (lower.includes('screenshot')) return { label: 'Screenshot', Icon: Camera };
  if (lower.includes('gif') || lower.includes('video') || lower.includes('record')) {
    return { label: 'Recording', Icon: Video };
  }
  if (lower.includes('console')) return { label: 'Console', Icon: TerminalSquare };
  if (lower.includes('page_text') || lower.includes('read_page') || lower.includes('snapshot')) {
    return { label: 'Read page', Icon: FileText };
  }
  if (lower.includes('navigate')) return { label: 'Navigate', Icon: Globe };
  if (lower.includes('click') || lower.includes('computer')) {
    return { label: 'Interact', Icon: MousePointerClick };
  }
  if (lower.includes('type') || lower.includes('fill') || lower.includes('form_input')) {
    return { label: 'Type', Icon: Type };
  }
  if (lower.includes('scroll')) return { label: 'Scroll', Icon: ScrollText };
  return { label: 'Browser automation', Icon: Globe };
}

export function isBrowserAutomationTool(name: string): boolean {
  const lower = name.toLowerCase();
  return (
    lower.startsWith('mcp__claude-in-chrome__') ||
    lower.startsWith('mcp__playwright__browser_') ||
    lower.includes('browser') ||
    lower.includes('chrome')
  );
}

export function BrowserAutomationDisplay({ toolCall }: { toolCall: ToolCallState }) {
  const { label, Icon } = getBrowserAction(toolCall.name);
  const parsedInput = parseToolInput<Record<string, unknown>>(toolCall.input);
  const preview = findPreview(toolCall.result);
  const consoleEntries = extractConsoleEntries(toolCall.result);
  const textResult = extractTextResult(toolCall.result);
  const inputUrl =
    sanitizeUrl(parsedInput.value?.url) ??
    sanitizeUrl(parsedInput.value?.targetUrl) ??
    sanitizeUrl(parsedInput.value?.pageUrl);

  return (
    <div
      className="my-2 overflow-hidden rounded-lg border border-border bg-muted/30 text-sm"
      data-testid="browser-automation-card"
    >
      <div className="flex items-center gap-2 px-3 py-2">
        <Icon className="h-4 w-4 shrink-0 text-blue-400" />
        <span className="font-medium text-foreground" data-testid="browser-automation-action">
          {label}
        </span>

        {inputUrl ? (
          <a
            href={inputUrl}
            target="_blank"
            rel="noreferrer"
            className="min-w-0 truncate text-xs font-mono text-blue-400 hover:underline"
          >
            {inputUrl}
          </a>
        ) : (
          <span className="min-w-0 truncate text-xs font-mono text-muted-foreground">
            {sanitizeDisplayText(toolCall.name)}
          </span>
        )}

        {inputUrl ? <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground" /> : null}

        <span className="ml-auto shrink-0">
          <StatusIndicator status={toolCall.status} />
        </span>
      </div>

      {toolCall.input ? (
        <div className="border-t border-border/50 px-3 py-2">
          <div className="mb-1 text-xs font-medium text-muted-foreground">Input</div>
          <pre className="max-h-28 overflow-auto whitespace-pre-wrap break-all text-xs font-mono text-foreground/80">
            {formatToolInputForDisplay(toolCall.input)}
          </pre>
        </div>
      ) : null}

      {preview ? (
        <div className="border-t border-border/50 px-3 py-3">
          {preview.kind === 'image' ? (
            <img
              src={preview.src}
              alt={label}
              data-testid="browser-automation-preview-image"
              className="max-h-80 w-full rounded-md border border-border object-contain"
            />
          ) : (
            <video
              src={preview.src}
              controls
              data-testid="browser-automation-preview-video"
              className="max-h-80 w-full rounded-md border border-border"
            />
          )}
        </div>
      ) : null}

      {consoleEntries.length > 0 ? (
        <div className="border-t border-border/50 px-3 py-2">
          <div className="mb-1 text-xs font-medium text-muted-foreground">Console</div>
          <div className="space-y-1">
            {consoleEntries.map((entry, index) => (
              <div
                key={`${entry.level}-${index}`}
                className="rounded-md border border-border/60 bg-background/60 px-2 py-1 font-mono text-xs"
              >
                <span className="mr-2 uppercase text-muted-foreground">{entry.level}</span>
                <span>{entry.text}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {textResult && !preview ? (
        <div className="border-t border-border/50 px-3 py-2">
          <div className="mb-1 text-xs font-medium text-muted-foreground">Captured text</div>
          <pre
            data-testid="browser-automation-text"
            className="max-h-64 overflow-auto whitespace-pre-wrap break-words text-xs text-foreground/85"
          >
            {textResult}
          </pre>
        </div>
      ) : null}
    </div>
  );
}
