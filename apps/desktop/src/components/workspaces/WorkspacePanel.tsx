import { useState, useCallback, useEffect } from 'react';
import type { Workspace } from '@claude-tauri/shared';
import { WorkspaceDiffView } from './WorkspaceDiffView';
import { WorkspaceDashboardsView } from './WorkspaceDashboardsView';
import { WorkspaceMergeDialog } from './WorkspaceMergeDialog';
import { WorkspacePanelHeader } from './WorkspacePanelHeader';
import { WorkspacePanelTabs } from './WorkspacePanelTabs';
import { NotesTab } from './NotesTab';
import { PathsTab } from './PathsTab';
import { ChatPage } from '@/components/chat/ChatPage';
import type { ChatPageStatusData } from '@/components/chat/ChatPage';
import { promptMemoryUpdate } from '@/lib/memoryUpdatePrompt';
import { useSettings } from '@/hooks/useSettings';
import { getWorkflowPrompt, buildMergeMemoryDraft } from '@/lib/workflowPrompts';
import * as api from '@/lib/workspace-api';

type Tab = 'chat' | 'diff' | 'paths' | 'notes' | 'dashboards';

interface WorkspacePanelProps {
  workspace: Workspace;
  onStatusChange?: (data: ChatPageStatusData) => void;
  onWorkspaceUpdate?: () => void;
  onOpenSettings?: (tab?: string) => void;
  onTaskComplete?: (params: {
    status: 'completed' | 'failed' | 'stopped';
    summary: string;
    branch: string;
    workspaceName: string;
  }) => void;
}

export function WorkspacePanel({ workspace, onStatusChange, onWorkspaceUpdate, onOpenSettings, onTaskComplete }: WorkspacePanelProps) {
  const { settings } = useSettings();
  const [activeTab, setActiveTab] = useState<Tab>('chat');
  const [mergeDialog, setMergeDialog] = useState<'merge' | 'discard' | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionLoaded, setSessionLoaded] = useState(false);
  const [branchCopied, setBranchCopied] = useState(false);
  const [pendingPath, setPendingPath] = useState<string | undefined>();

  const handleTaskComplete = useCallback(
    (params: { status: 'completed' | 'failed' | 'stopped'; summary: string }) => {
      onTaskComplete?.({ ...params, branch: workspace.branch, workspaceName: workspace.name });
    },
    [onTaskComplete, workspace.branch, workspace.name]
  );

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

  const handleOpenWorkspacePaths = useCallback((path?: string) => {
    setActiveTab('paths');
    setPendingPath(path?.trim() || undefined);
  }, []);

  const handleBranchCopy = useCallback(() => {
    setBranchCopied(true);
    setTimeout(() => setBranchCopied(false), 1500);
  }, []);

  return (
    <div className="flex flex-1 flex-col min-w-0 min-h-0">
      <WorkspacePanelHeader
        workspace={workspace}
        branchCopied={branchCopied}
        onBranchCopy={handleBranchCopy}
        canMerge={canMerge}
        canDiscard={canDiscard}
        onMerge={() => setMergeDialog('merge')}
        onDiscard={() => setMergeDialog('discard')}
      />

      <WorkspacePanelTabs activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Content */}
      <div className="flex-1 min-h-0 flex flex-col">
        {activeTab === 'chat' ? (
          sessionLoaded ? (
            <ChatPage
              key={workspace.id}
              sessionId={sessionId}
              onStatusChange={onStatusChange}
              workspaceId={workspace.id}
              projectId={workspace.projectId}
              additionalDirectories={workspace.additionalDirectories ?? []}
              onOpenWorkspacePaths={handleOpenWorkspacePaths}
              onTaskComplete={handleTaskComplete}
            />
          ) : (
            <div className="flex flex-1 items-center justify-center">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          )
        ) : activeTab === 'diff' ? (
          <WorkspaceDiffView workspaceId={workspace.id} />
        ) : activeTab === 'dashboards' ? (
          <WorkspaceDashboardsView projectId={workspace.projectId} workspaceId={workspace.id} />
        ) : activeTab === 'notes' ? (
          <NotesTab workspaceId={workspace.id} />
        ) : (
          <PathsTab
            workspaceId={workspace.id}
            initialDirectories={workspace.additionalDirectories ?? []}
            pendingPath={pendingPath}
            onWorkspaceUpdate={onWorkspaceUpdate}
          />
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
