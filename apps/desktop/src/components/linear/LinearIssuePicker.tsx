import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import type { Project } from '@claude-tauri/shared';
import * as linear from '@/lib/linear-api';
import * as workspaceApi from '@/lib/workspace-api';

type LinearIssue = linear.LinearIssue;

function defaultWorkspaceName(issue: LinearIssue): string {
  const base = issue.id?.trim() || 'linear-issue';
  return base.toLowerCase().replace(/[^a-z0-9-_]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
}

export function LinearIssuePicker({
  isOpen,
  onClose,
  onSelectIssue,
  onOpenSettings,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSelectIssue: (issue: LinearIssue) => void;
  onOpenSettings?: () => void;
}) {
  const [connected, setConnected] = useState<boolean | null>(null);
  const [query, setQuery] = useState('');
  const [issues, setIssues] = useState<LinearIssue[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedIssue, setSelectedIssue] = useState<LinearIssue | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState<string>('');
  const [workspaceName, setWorkspaceName] = useState<string>('');
  const [baseBranch, setBaseBranch] = useState<string>('');
  const [creating, setCreating] = useState(false);

  const reset = useCallback(() => {
    setQuery('');
    setIssues([]);
    setSelectedIssue(null);
    setError(null);
    setLoading(false);
    setProjects([]);
    setProjectId('');
    setWorkspaceName('');
    setBaseBranch('');
    setCreating(false);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    reset();
  }, [isOpen, reset]);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    (async () => {
      try {
        const status = await linear.getStatus();
        if (cancelled) return;
        setConnected(status.connected);
      } catch {
        if (cancelled) return;
        setConnected(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    if (!connected) return;

    let cancelled = false;
    const timer = setTimeout(() => {
      (async () => {
        setLoading(true);
        setError(null);
        try {
          const list = await linear.listIssues(query);
          if (cancelled) return;
          setIssues(list);
        } catch (err) {
          if (cancelled) return;
          setIssues([]);
          setError(err instanceof Error ? err.message : 'Failed to load issues');
        } finally {
          if (!cancelled) setLoading(false);
        }
      })();
    }, 200);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [isOpen, connected, query]);

  const loadProjects = useCallback(async () => {
    const list = await workspaceApi.fetchProjects();
    setProjects(list);
    if (list.length === 1) setProjectId(list[0].id);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    if (!connected) return;
    void loadProjects();
  }, [isOpen, connected, loadProjects]);

  useEffect(() => {
    if (!selectedIssue) return;
    setWorkspaceName(defaultWorkspaceName(selectedIssue));
  }, [selectedIssue]);

  const canCreateWorkspace = useMemo(() => {
    if (!selectedIssue) return false;
    if (!projectId) return false;
    if (!workspaceName.trim()) return false;
    return true;
  }, [selectedIssue, projectId, workspaceName]);

  const handleAttach = useCallback(() => {
    if (!selectedIssue) return;
    onSelectIssue(selectedIssue);
    onClose();
  }, [selectedIssue, onSelectIssue, onClose]);

  const handleCreateWorkspace = useCallback(async () => {
    if (!selectedIssue) return;
    if (!canCreateWorkspace) return;
    setCreating(true);
    try {
      await workspaceApi.createWorkspace(
        projectId,
        workspaceName.trim(),
        baseBranch.trim() || undefined,
        {
          id: selectedIssue.id,
          title: selectedIssue.title,
          summary: selectedIssue.summary,
          url: selectedIssue.url,
        }
      );
      toast.success('Workspace created', { description: `${workspaceName.trim()} from ${selectedIssue.id}` });
      onClose();
    } catch (err) {
      toast.error('Failed to create workspace', {
        description: err instanceof Error ? err.message : 'Unknown error',
      });
    } finally {
      setCreating(false);
    }
  }, [selectedIssue, canCreateWorkspace, projectId, workspaceName, baseBranch, onClose]);

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/50" onClick={onClose} />
      <div
        className="fixed left-1/2 top-1/2 z-50 w-[720px] max-w-[calc(100vw-24px)] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border bg-background shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold">Linear Issues</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">Browse/search issues and attach context to chat.</p>
          </div>
          <Button variant="outline" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>

        {!connected ? (
          <div className="p-4 space-y-3">
            <div className="text-sm">Linear is not connected.</div>
            <div className="text-xs text-muted-foreground">
              Connect Linear in Settings → Linear, then return here.
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() => {
                  onOpenSettings?.();
                  onClose();
                }}
              >
                Open Settings
              </Button>
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-0">
            <div className="border-r border-border p-4">
              <div className="flex items-center gap-2">
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search by title or identifier (e.g. ENG-123)…"
                />
                <Button variant="outline" size="sm" onClick={() => setQuery('')}>
                  Clear
                </Button>
              </div>
              {error && (
                <div className="mt-3 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                  {error}
                </div>
              )}
              <div className="mt-3 max-h-[420px] overflow-auto space-y-2">
                {loading ? (
                  <div className="text-xs text-muted-foreground">Loading…</div>
                ) : issues.length === 0 ? (
                  <div className="text-xs text-muted-foreground">No issues found.</div>
                ) : (
                  issues.map((issue) => {
                    const active = selectedIssue?.id === issue.id;
                    return (
                      <button
                        key={issue.id}
                        className={`w-full rounded-lg border px-3 py-2 text-left transition-colors ${
                          active
                            ? 'border-primary bg-primary/10'
                            : 'border-border hover:bg-accent'
                        }`}
                        onClick={() => setSelectedIssue(issue)}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="text-xs font-mono text-muted-foreground">{issue.id}</div>
                          {issue.createdAt ? (
                            <div className="text-[11px] text-muted-foreground">
                              {new Date(issue.createdAt).toLocaleDateString()}
                            </div>
                          ) : null}
                        </div>
                        <div className="mt-1 text-sm font-medium">{issue.title}</div>
                        {issue.summary ? (
                          <div className="mt-1 text-xs text-muted-foreground line-clamp-2">{issue.summary}</div>
                        ) : null}
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            <div className="p-4 space-y-4">
              {!selectedIssue ? (
                <div className="text-sm text-muted-foreground">Select an issue to attach it or create a workspace.</div>
              ) : (
                <>
                  <div>
                    <div className="text-xs text-muted-foreground">Selected</div>
                    <div className="mt-1 flex items-center justify-between gap-2">
                      <div className="text-sm font-semibold truncate">{selectedIssue.title}</div>
                      <div className="text-xs font-mono text-muted-foreground shrink-0">{selectedIssue.id}</div>
                    </div>
                    {selectedIssue.url ? (
                      <a
                        className="mt-1 inline-block text-xs text-primary underline-offset-2 hover:underline"
                        href={selectedIssue.url}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Open in Linear
                      </a>
                    ) : null}
                  </div>

                  <div className="flex gap-2">
                    <Button onClick={handleAttach}>Attach to chat</Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        window.location.hash = `#linear/issue/${encodeURIComponent(selectedIssue.id)}`;
                        toast.message('Deep link updated', { description: `#linear/issue/${selectedIssue.id}` });
                      }}
                    >
                      Copy deep link
                    </Button>
                  </div>

                  <div className="rounded-lg border border-border p-3 space-y-2">
                    <div className="text-xs font-semibold text-muted-foreground">Create workspace</div>
                    <label className="block text-xs text-muted-foreground">
                      Project
                      <select
                        className="mt-1 h-8 w-full rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                        value={projectId}
                        onChange={(e) => setProjectId(e.target.value)}
                      >
                        <option value="" disabled>
                          Select a project…
                        </option>
                        {projects.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="block text-xs text-muted-foreground">
                      Workspace name
                      <Input
                        className="mt-1"
                        value={workspaceName}
                        onChange={(e) => setWorkspaceName(e.target.value)}
                        placeholder="eng-123"
                      />
                    </label>

                    <label className="block text-xs text-muted-foreground">
                      Base branch (optional)
                      <Input
                        className="mt-1"
                        value={baseBranch}
                        onChange={(e) => setBaseBranch(e.target.value)}
                        placeholder="main"
                      />
                    </label>

                    <Button
                      onClick={() => void handleCreateWorkspace()}
                      disabled={!canCreateWorkspace || creating}
                    >
                      {creating ? 'Creating…' : 'Create workspace'}
                    </Button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}

