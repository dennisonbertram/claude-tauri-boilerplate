import { useState, useCallback, useEffect } from 'react';
import type { Workspace } from '@claude-tauri/shared';
import { Button } from '@/components/ui/button';
import { WorkspaceStatusBadge } from './WorkspaceStatusBadge';
import { WorkspaceDiffView } from './WorkspaceDiffView';
import { WorkspaceMergeDialog } from './WorkspaceMergeDialog';
import { ChatPage } from '@/components/chat/ChatPage';
import type { ChatPageStatusData } from '@/components/chat/ChatPage';
import { copyTextToClipboard } from '@/lib/clipboard';
import { promptMemoryUpdate } from '@/lib/memoryUpdatePrompt';
import { useSettings } from '@/hooks/useSettings';
import { getWorkflowPrompt, buildMergeMemoryDraft } from '@/lib/workflowPrompts';
import * as api from '@/lib/workspace-api';

type Tab = 'chat' | 'diff';

interface WorkspacePanelProps {
  workspace: Workspace;
  onStatusChange?: (data: ChatPageStatusData) => void;
  onWorkspaceUpdate?: () => void;
  onOpenSettings?: (tab?: string) => void;
}

export function WorkspacePanel({ workspace, onStatusChange, onWorkspaceUpdate, onOpenSettings }: WorkspacePanelProps) {
  const { settings } = useSettings();
  const [activeTab, setActiveTab] = useState<Tab>('chat');
  const [mergeDialog, setMergeDialog] = useState<'merge' | 'discard' | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionLoaded, setSessionLoaded] = useState(false);

  // Load the existing session for this workspace on mount.
  useEffect(() => {
    setSessionLoaded(false);
    api.getWorkspaceSession(workspace.id).then((session) => {
      setSessionId(session?.id ?? null);
      setSessionLoaded(true);
    }).catch(() => {
      setSessionId(null);
      setSessionLoaded(true);
    });
  }, [workspace.id]);

  const canMerge = workspace.status === 'ready' || workspace.status === 'active';
  const canDiscard = workspace.status === 'ready' || workspace.status === 'active';

  const handleMerge = useCallback(async () => {
    await api.mergeWorkspace(workspace.id);
    onWorkspaceUpdate?.();
    const prompt = getWorkflowPrompt(settings.workflowPrompts, 'mergeMemory');
    promptMemoryUpdate({
      trigger: 'workspace-merge',
      draft: {
        fileName: 'MEMORY.md',
        content: buildMergeMemoryDraft({
          prompt,
          workspaceName: workspace.name,
          branch: workspace.branch,
          baseBranch: workspace.baseBranch,
        }),
      },
      onOpenMemory: () => onOpenSettings?.('memory'),
    });
  }, [
    workspace.id,
    workspace.name,
    workspace.branch,
    workspace.baseBranch,
    onWorkspaceUpdate,
    onOpenSettings,
    settings.workflowPrompts,
  ]);

  const handleDiscard = useCallback(async () => {
    await api.discardWorkspace(workspace.id);
    onWorkspaceUpdate?.();
  }, [workspace.id, onWorkspaceUpdate]);

  return (
    <div className="flex flex-1 flex-col min-w-0 min-h-0">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-2">
        <div className="flex items-center gap-3 min-w-0">
          <h2 className="text-sm font-semibold text-foreground truncate">{workspace.name}</h2>
          <span className="text-xs font-mono text-muted-foreground shrink-0">{workspace.branch}</span>
          <button
            type="button"
            className="rounded px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            aria-label={`Copy branch name for ${workspace.name}`}
            onClick={() => {
              void copyTextToClipboard(workspace.branch);
            }}
          >
            Copy
          </button>
          <WorkspaceStatusBadge status={workspace.status} />
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {canMerge && (
            <Button variant="outline" size="sm" onClick={() => setMergeDialog('merge')}>
              Merge
            </Button>
          )}
          {canDiscard && (
            <Button variant="destructive" size="sm" onClick={() => setMergeDialog('discard')}>
              Discard
            </Button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border">
        <button
          onClick={() => setActiveTab('chat')}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === 'chat'
              ? 'border-b-2 border-primary text-foreground'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Chat
        </button>
        <button
          onClick={() => setActiveTab('diff')}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === 'diff'
              ? 'border-b-2 border-primary text-foreground'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Diff
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 flex flex-col">
        {activeTab === 'chat' ? (
          sessionLoaded ? (
            <ChatPage
              key={workspace.id}
              sessionId={sessionId}
              onStatusChange={onStatusChange}
              workspaceId={workspace.id}
            />
          ) : (
            <div className="flex flex-1 items-center justify-center">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          )
        ) : (
          <WorkspaceDiffView workspaceId={workspace.id} />
        )}
      </div>

      {/* Merge/Discard dialog */}
      {mergeDialog && (
        <WorkspaceMergeDialog
          isOpen={true}
          mode={mergeDialog}
          workspaceName={workspace.name}
          branch={workspace.branch}
          baseBranch={workspace.baseBranch}
          onClose={() => setMergeDialog(null)}
          onConfirm={mergeDialog === 'merge' ? handleMerge : handleDiscard}
        />
      )}
    </div>
  );
}
