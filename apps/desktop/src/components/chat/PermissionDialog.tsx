import { useState } from 'react';
import {
  Shield,
  ShieldWarning,
  ShieldCheck,
  TerminalWindow,
  PencilSimple,
  FileText,
  Globe,
} from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import type { StreamPermissionRequest, RiskLevel } from '@claude-tauri/shared';

export interface PermissionDecisionResult {
  requestId: string;
  decision: 'allow_once' | 'allow_always' | 'deny';
  scope?: 'session' | 'permanent';
}

interface PermissionDialogProps {
  request: StreamPermissionRequest;
  onDecision: (result: PermissionDecisionResult) => void;
}

/** Map risk levels to border color classes */
const riskBorderClass: Record<RiskLevel, string> = {
  low: 'border-blue-400/50',
  medium: 'border-yellow-400/50',
  high: 'border-red-400/50',
};

/** Map risk levels to background classes */
const riskBgClass: Record<RiskLevel, string> = {
  low: 'bg-blue-950/20',
  medium: 'bg-yellow-950/20',
  high: 'bg-red-950/20',
};

/** Get the icon for a tool's risk level */
function RiskIcon({ riskLevel }: { riskLevel: RiskLevel }) {
  switch (riskLevel) {
    case 'high':
      return <ShieldWarning className="h-5 w-5 text-red-400" />;
    case 'medium':
      return <Shield className="h-5 w-5 text-yellow-400" />;
    case 'low':
      return <ShieldCheck className="h-5 w-5 text-blue-400" />;
  }
}

/** Get the icon for a tool name */
function ToolIcon({ name }: { name: string }) {
  switch (name) {
    case 'Bash':
      return <TerminalWindow className="h-4 w-4" />;
    case 'Write':
    case 'Edit':
    case 'NotebookEdit':
      return <PencilSimple className="h-4 w-4" />;
    default:
      if (name.toLowerCase().includes('browser') || name.toLowerCase().includes('chrome')) {
        return <Globe className="h-4 w-4" />;
      }
      return <FileText className="h-4 w-4" />;
  }
}

/** Format tool input for display, with special handling for known tools */
function ToolInputDisplay({
  toolName,
  toolInput,
}: {
  toolName: string;
  toolInput: Record<string, unknown>;
}) {
  if (toolName === 'Bash' && typeof toolInput.command === 'string') {
    return (
      <div className="space-y-2">
        <div className="text-xs font-medium text-muted-foreground">Command</div>
        <div className="bg-zinc-900 text-green-300 rounded p-2 text-xs font-mono whitespace-pre-wrap break-all">
          $ {toolInput.command}
        </div>
        {toolInput.description && (
          <div className="text-xs text-muted-foreground italic">
            {String(toolInput.description)}
          </div>
        )}
      </div>
    );
  }

  if (
    (toolName === 'Write' || toolName === 'Edit') &&
    typeof toolInput.file_path === 'string'
  ) {
    return (
      <div className="space-y-2">
        <div className="text-xs font-medium text-muted-foreground">File</div>
        <div className="bg-muted rounded px-2 py-1 text-xs font-mono">
          {toolInput.file_path}
        </div>
        {toolInput.content && (
          <>
            <div className="text-xs font-medium text-muted-foreground">Content</div>
            <pre className="bg-muted rounded p-2 text-xs font-mono whitespace-pre-wrap break-all max-h-32 overflow-y-auto">
              {String(toolInput.content).slice(0, 500)}
              {String(toolInput.content).length > 500 ? '...' : ''}
            </pre>
          </>
        )}
        {toolInput.old_string && (
          <>
            <div className="text-xs font-medium text-muted-foreground">Replace</div>
            <pre className="bg-red-950/30 text-red-300 rounded p-2 text-xs font-mono whitespace-pre-wrap break-all max-h-24 overflow-y-auto">
              {String(toolInput.old_string).slice(0, 300)}
            </pre>
            <div className="text-xs font-medium text-muted-foreground">With</div>
            <pre className="bg-green-950/30 text-green-300 rounded p-2 text-xs font-mono whitespace-pre-wrap break-all max-h-24 overflow-y-auto">
              {String(toolInput.new_string ?? '').slice(0, 300)}
            </pre>
          </>
        )}
      </div>
    );
  }

  // Default: show formatted JSON
  return (
    <div className="space-y-1">
      <div className="text-xs font-medium text-muted-foreground">Input</div>
      <pre className="bg-muted rounded p-2 text-xs font-mono whitespace-pre-wrap break-all max-h-48 overflow-y-auto">
        {JSON.stringify(toolInput, null, 2)}
      </pre>
    </div>
  );
}

export function PermissionDialog({ request, onDecision }: PermissionDialogProps) {
  const [alwaysAllow, setAlwaysAllow] = useState(false);

  const handleAllow = () => {
    if (alwaysAllow) {
      onDecision({
        requestId: request.requestId,
        decision: 'allow_always',
        scope: 'session',
      });
    } else {
      onDecision({
        requestId: request.requestId,
        decision: 'allow_once',
      });
    }
  };

  const handleDeny = () => {
    onDecision({
      requestId: request.requestId,
      decision: 'deny',
    });
  };

  return (
    <div
      data-risk={request.riskLevel}
      className={`my-2 rounded-lg border-2 ${riskBorderClass[request.riskLevel]} ${riskBgClass[request.riskLevel]} text-sm overflow-hidden`}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border/50">
        <RiskIcon riskLevel={request.riskLevel} />
        <span className="font-medium text-foreground">Permission Required</span>
      </div>

      {/* Tool info */}
      <div className="px-3 py-2 space-y-3">
        <div className="flex items-center gap-2">
          <ToolIcon name={request.toolName} />
          <span className="font-medium">{request.toolName}</span>
        </div>

        <ToolInputDisplay
          toolName={request.toolName}
          toolInput={request.toolInput}
        />

        {/* Always allow checkbox */}
        <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
          <input
            type="checkbox"
            checked={alwaysAllow}
            onChange={(e) => setAlwaysAllow(e.target.checked)}
            className="rounded border-border"
            aria-label="Always allow this tool"
          />
          Always allow {request.toolName} for this session
        </label>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-2 px-3 py-2 border-t border-border/50">
        <Button
          variant="destructive"
          size="sm"
          onClick={handleDeny}
        >
          Deny
        </Button>
        <Button
          size="sm"
          onClick={handleAllow}
        >
          Allow
        </Button>
      </div>
    </div>
  );
}
