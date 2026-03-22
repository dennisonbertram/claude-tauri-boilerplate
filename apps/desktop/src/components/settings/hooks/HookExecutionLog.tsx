import type { HookExecutionLog as HookExecutionLogEntry } from './types';

export function HookExecutionLog({ logs }: { logs: HookExecutionLogEntry[] }) {
  return (
    <div data-testid="hooks-execution-log" className="space-y-2">
      <h3 className="text-sm font-medium text-foreground">Execution Log</h3>
      <div className="rounded-lg border border-border bg-muted/20 p-3 max-h-40 overflow-y-auto font-mono text-xs">
        {logs.length === 0 ? (
          <div data-testid="hooks-log-empty" className="text-muted-foreground text-center py-2">
            No hook executions yet
          </div>
        ) : (
          logs.map((log, i) => (
            <div key={i} className="flex items-center gap-2 py-0.5">
              <span className="text-muted-foreground">[{log.timestamp}]</span>
              <span>{log.event}</span>
              <span className="text-muted-foreground">&rarr;</span>
              <span>{log.hookName}</span>
              <span className={log.result === 'success' ? 'text-green-400' : 'text-red-400'}>
                {log.result === 'success' ? 'OK' : 'FAIL'}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
