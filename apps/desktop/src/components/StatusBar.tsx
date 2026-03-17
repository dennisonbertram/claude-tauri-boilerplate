import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { formatCost } from '@/lib/pricing';
import { AVAILABLE_MODELS, getModelDisplay } from '@/lib/models';
import { useSettings } from '@/hooks/useSettings';
import type { ToolCallState, CumulativeUsage } from '@/hooks/useStreamEvents';

const API_BASE = 'http://localhost:3131';
const MAX_CONTEXT_TOKENS = 200_000;

// --- Public Props ---

export interface StatusBarProps {
  model: string | null;
  isStreaming: boolean;
  toolCalls: Map<string, ToolCallState>;
  cumulativeUsage: CumulativeUsage;
  sessionTotalCost: number;
  subagentActiveCount: number;
  onShowSettings?: (tab?: string) => void;
}

// --- Main StatusBar ---

export function StatusBar({
  model,
  isStreaming,
  toolCalls,
  cumulativeUsage,
  sessionTotalCost,
  subagentActiveCount,
  onShowSettings,
}: StatusBarProps) {
  return (
    <div
      data-testid="status-bar"
      className="flex items-center h-7 shrink-0 border-t border-border bg-background text-xs text-muted-foreground select-none"
    >
      {/* Left section */}
      <div data-testid="status-bar-left" className="flex items-center gap-0.5 px-2 min-w-0">
        <ModelSegment model={model} />
        <PermissionModeSegment onShowSettings={onShowSettings} />
        <GitBranchSegment />
        <ConnectionIndicator />
      </div>

      {/* Center section */}
      <div data-testid="status-bar-center" className="flex flex-1 items-center justify-center gap-2 min-w-0">
        <TurnTimer isStreaming={isStreaming} />
        <ActiveToolDisplay toolCalls={toolCalls} />
        {subagentActiveCount > 0 && <AgentCountBadge count={subagentActiveCount} />}
      </div>

      {/* Right section */}
      <div data-testid="status-bar-right" className="flex items-center gap-0.5 px-2 min-w-0">
        <ContextUsageSegment cumulativeUsage={cumulativeUsage} />
        {sessionTotalCost > 0 && <CostSegment cost={sessionTotalCost} />}
      </div>
    </div>
  );
}

// --- ModelSegment ---

function ModelSegment({
  model,
}: {
  model: string | null;
}) {
  const { settings, updateSettings } = useSettings();
  const selectedModel = settings.model;
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selectModelByIndex = useCallback((index: number) => {
    const nextModel = AVAILABLE_MODELS[index];
    if (!nextModel) return false;
    updateSettings({ model: nextModel.id });
    setOpen(false);
    return true;
  }, [updateSettings]);

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  // Fast switching: while picker is open, number keys map to model options.
  useEffect(() => {
    if (!open) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setOpen(false);
        return;
      }

      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }

      const index = Number.parseInt(e.key, 10) - 1;
      if (!Number.isFinite(index)) return;
      if (selectModelByIndex(index)) {
        e.preventDefault();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, selectModelByIndex]);

  const displayLabel = selectedModel ? getModelDisplay(selectedModel) : (model ?? 'No model');

  return (
    <div ref={ref} className="relative" data-testid="model-segment">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-muted/50 transition-colors"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="shrink-0"
        >
          <path d="M12 2a4 4 0 0 0-4 4v2H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V10a2 2 0 0 0-2-2h-2V6a4 4 0 0 0-4-4Z" />
          <circle cx="12" cy="14" r="2" />
        </svg>
        <span className="truncate max-w-[120px]">{displayLabel}</span>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="10"
          height="10"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="shrink-0 opacity-50"
        >
          <polyline points="18 15 12 9 6 15" />
        </svg>
      </button>
      {open && (
        <div className="absolute bottom-full left-0 mb-1 w-44 rounded-md border border-border bg-popover shadow-lg z-50">
          {AVAILABLE_MODELS.map((m, index) => (
            <button
              key={m.id}
              type="button"
              onClick={() => {
                selectModelByIndex(index);
              }}
              className={`flex w-full items-center gap-2 px-3 py-1.5 text-xs transition-colors hover:bg-muted/50 ${
                selectedModel === m.id ? 'text-foreground font-medium' : 'text-muted-foreground'
              }`}
            >
              {selectedModel === m.id && (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="shrink-0"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
              {selectedModel !== m.id && <span className="w-3" />}
              <span>{m.label}</span>
              <span className="ml-auto text-[10px] text-muted-foreground/60">{index + 1}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// --- PermissionModeSegment ---

const PERMISSION_MODE_LABELS: Record<string, string> = {
  default: 'Normal',
  acceptEdits: 'Accept Edits',
  plan: 'Plan',
  bypassPermissions: 'Bypass',
};

function PermissionModeSegment({ onShowSettings }: { onShowSettings?: (tab?: string) => void }) {
  const { settings } = useSettings();
  const label = PERMISSION_MODE_LABELS[settings.permissionMode] ?? 'Normal';

  return (
    <button
      type="button"
      data-testid="permission-mode-segment"
      onClick={() => onShowSettings?.('advanced')}
      className="flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-muted/50 transition-colors"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="shrink-0"
      >
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
      <span>{label}</span>
    </button>
  );
}

// --- GitBranchSegment ---

function GitBranchSegment() {
  const [branch, setBranch] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchGitStatus() {
      try {
        const res = await fetch(`${API_BASE}/api/git/status`);
        if (!res.ok) throw new Error('Failed');
        const data = await res.json();
        if (!cancelled && data.branch) {
          setBranch(data.branch);
        }
      } catch {
        if (!cancelled) {
          setBranch(null);
        }
      }
    }

    fetchGitStatus();
    const interval = setInterval(fetchGitStatus, 10_000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  if (!branch) return null;

  return (
    <div data-testid="git-branch-segment" className="flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-muted/50 transition-colors">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="shrink-0"
      >
        <line x1="6" y1="3" x2="6" y2="15" />
        <circle cx="18" cy="6" r="3" />
        <circle cx="6" cy="18" r="3" />
        <path d="M18 9a9 9 0 0 1-9 9" />
      </svg>
      <span className="truncate max-w-[100px]">{branch}</span>
    </div>
  );
}

// --- ConnectionIndicator ---

function ConnectionIndicator() {
  const [connected, setConnected] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function checkHealth() {
      try {
        const res = await fetch(`${API_BASE}/api/health`);
        if (!cancelled) setConnected(res.ok);
      } catch {
        if (!cancelled) setConnected(false);
      }
    }

    // Use the git status fetch result as a proxy. We also do a dedicated health check.
    checkHealth();
    const interval = setInterval(checkHealth, 15_000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return (
    <div className="flex items-center gap-1 px-1.5 py-0.5" title={connected ? 'Connected' : 'Disconnected'}>
      <span
        data-testid="connection-dot"
        className={`inline-block h-2 w-2 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`}
      />
    </div>
  );
}

// --- ContextUsageSegment ---

function ContextUsageSegment({ cumulativeUsage }: { cumulativeUsage: CumulativeUsage }) {
  const totalUsed = cumulativeUsage.inputTokens + cumulativeUsage.outputTokens;

  const { percentage, colorClass } = useMemo(() => {
    const pct = MAX_CONTEXT_TOKENS > 0
      ? Math.min(100, Math.round((totalUsed / MAX_CONTEXT_TOKENS) * 100))
      : 0;

    let cls: string;
    if (pct < 50) {
      cls = 'bg-green-500';
    } else if (pct < 80) {
      cls = 'bg-yellow-500';
    } else {
      cls = 'bg-red-500';
    }

    return { percentage: pct, colorClass: cls };
  }, [totalUsed]);

  if (totalUsed === 0) return null;

  return (
    <div data-testid="context-usage-segment" className="flex items-center gap-1 px-1.5 py-0.5">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="shrink-0"
      >
        <path d="M21 12a9 9 0 1 1-9-9" />
        <path d="M12 3v9l6 3" />
      </svg>
      <div className="h-2 w-10 rounded-full bg-muted overflow-hidden">
        <div
          data-testid="context-usage-fill"
          className={`h-full rounded-full transition-all duration-300 ${colorClass}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <span className="tabular-nums text-[10px]">{percentage}%</span>
    </div>
  );
}

// --- CostSegment ---

function CostSegment({ cost }: { cost: number }) {
  return (
    <div data-testid="cost-segment" className="flex items-center gap-1 px-1.5 py-0.5 tabular-nums">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="shrink-0"
      >
        <line x1="12" y1="1" x2="12" y2="23" />
        <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
      </svg>
      <span>{formatCost(cost)}</span>
    </div>
  );
}

// --- TurnTimer ---

function TurnTimer({ isStreaming }: { isStreaming: boolean }) {
  const [elapsed, setElapsed] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (isStreaming) {
      setElapsed(0);
      intervalRef.current = setInterval(() => {
        setElapsed((prev) => prev + 1);
      }, 1000);
    } else {
      setElapsed(0);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isStreaming]);

  if (!isStreaming) return null;

  const minutes = Math.floor(elapsed / 60);
  const seconds = elapsed % 60;
  const formatted = `${minutes}:${seconds.toString().padStart(2, '0')}`;

  return (
    <div data-testid="turn-timer" className="flex items-center gap-1 px-1.5 py-0.5 tabular-nums">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="shrink-0 animate-spin"
        style={{ animationDuration: '2s' }}
      >
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
      <span>{formatted}</span>
    </div>
  );
}

// --- ActiveToolDisplay ---

function ActiveToolDisplay({ toolCalls }: { toolCalls: Map<string, ToolCallState> }) {
  const activeTool = useMemo(() => {
    for (const tc of toolCalls.values()) {
      if (tc.status === 'running') return tc;
    }
    return null;
  }, [toolCalls]);

  if (!activeTool) return null;

  return (
    <div data-testid="active-tool-display" className="flex items-center gap-1 px-1.5 py-0.5 max-w-[200px]">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="shrink-0"
      >
        <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
      </svg>
      <span className="truncate">{activeTool.name}</span>
    </div>
  );
}

// --- AgentCountBadge ---

function AgentCountBadge({ count }: { count: number }) {
  return (
    <span
      data-testid="agent-count-badge"
      className="inline-flex items-center justify-center rounded-full bg-muted px-1.5 text-[10px] font-semibold leading-4 min-w-[18px]"
    >
      {count}
    </span>
  );
}
