import { BashDisplay } from '../BashDisplay';
import type { ToolCallBlockProps } from '../ToolCallBlock';
import {
  formatToolResultForDisplay,
  parseToolInput,
  sanitizeDisplayText,
} from './toolData';

interface BashInput {
  command?: string;
  description?: string;
  run_in_background?: boolean;
  [key: string]: unknown;
}

function extractExitCode(status: ToolCallBlockProps['toolCall']['status']): number | undefined {
  if (status === 'running') return undefined;
  if (status === 'error') return 1;
  if (status === 'complete') return 0;
  return undefined;
}

export function BashToolRenderer({ toolCall, onFixErrors }: ToolCallBlockProps) {
  const parsedInput = parseToolInput<BashInput>(toolCall.input);
  const input = parsedInput.value ?? {};
  const command = sanitizeDisplayText(input.command ?? toolCall.input);
  const description = sanitizeDisplayText(input.description);
  const output =
    toolCall.result !== undefined ? formatToolResultForDisplay(toolCall.result) : undefined;
  const duration =
    toolCall.elapsedSeconds != null ? toolCall.elapsedSeconds * 1000 : undefined;
  const exitCode = extractExitCode(toolCall.status);

  return (
    <div className="rounded-lg border border-border bg-muted/30 overflow-hidden">
      <BashDisplay
        command={command}
        description={description || undefined}
        output={output}
        exitCode={exitCode}
        isRunning={toolCall.status === 'running'}
        isBackground={Boolean(input.run_in_background)}
        duration={duration}
      />
      {toolCall.ciFailures && onFixErrors ? (
        <div className="border-t border-border/50 px-3 py-2">
          <div className="mb-2 text-xs font-medium text-muted-foreground">
            {sanitizeDisplayText(toolCall.ciFailures.summary)}
          </div>
          <ul className="mb-2 space-y-1 text-xs text-foreground/90">
            {toolCall.ciFailures.checks.map((check) => (
              <li key={check} className="max-w-full truncate">
                • {sanitizeDisplayText(check)}
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => onFixErrors(toolCall)}
            className="rounded-md bg-primary px-2 py-1 text-xs text-primary-foreground"
          >
            Fix Errors
          </button>
        </div>
      ) : null}
    </div>
  );
}
