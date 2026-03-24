import { MessageList } from './MessageList';
import { ChatInput } from './ChatInput';
import { ErrorBanner } from './ErrorBanner';
import { PermissionDialog } from './PermissionDialog';
import { PlanView } from './PlanView';
import { SubagentPanel } from './SubagentPanel';
import { RewindDialog } from './RewindDialog';
import { LatestTurnChangesDialog } from './LatestTurnChangesDialog';
import { ShortcutHelpModal } from '@/components/ShortcutHelpModal';
import { SuggestionChips } from './SuggestionChips';
import { getModelDisplay } from '@/lib/models';
import { LinearIssuePicker } from '@/components/linear/LinearIssuePicker';
import { DashboardPromptModal } from '@/components/workspaces/DashboardPromptModal';
import { CostDialog } from './CostDialog';
import { LinearIssueBar } from './LinearIssueBar';
import { CommandTipBanner } from './CommandTipBanner';
import { useChatPageState } from './useChatPageState';
import { useChatPageHandlers } from './chatPageHandlers';
import './gen-ui/defaultRenderers';

// Re-export types that external consumers may need
export type { ChatPageStatusData, ChatPageProps } from './chatPageTypes';
export type { LinearIssueContext } from './chatPageTypes';

import type { ChatPageProps } from './chatPageTypes';

export function ChatPage(props: ChatPageProps) {
  const { sessionId, onOpenSettings, projectId } = props;

  const state = useChatPageState(props);
  const handlers = useChatPageHandlers(state, props);

  const {
    settings,
    updateSettings,
    input,
    attachments,
    setAttachments,
    linearIssue,
    setLinearIssue,
    linearPickerOpen,
    setLinearPickerOpen,
    helpOpen,
    setHelpOpen,
    costOpen,
    setCostOpen,
    thinkingExpanded,
    thinkingToggleVersion,
    dashboardModalOpen,
    setDashboardModalOpen,
    dashboardModalLoading,
    dashboardModalError,
    setDashboardModalError,
    toolCalls,
    thinkingBlocks,
    plan,
    isLoading,
    messages,
    subagents,
    subagentActiveCount,
    subagentPanelVisible,
    toggleSubagentPanel,
    messageCosts,
    sessionTotalCost,
    contextUsage,
    suggestedFiles,
    rewindTarget,
    rewindPreview,
    isLoadingPreview,
    latestChangesOpen,
    setLatestChangesOpen,
    latestChangesLoading,
    latestChangesDiff,
    latestChangesError,
    archivedPlanPath,
    assistantMetadata,
    suggestions,
    contextSummary,
    mcpServers,
    sessionInfo,
  } = state;

  const {
    paletteOpen,
    paletteFilter,
    filteredCommands,
    handleInputChange,
    handleCommandSelectAndClear,
    handlePaletteClose,
    shortcuts,
    chatError,
    handleRetry,
    handleDismissError,
    handlePermissionDecision,
    pendingPermissionEntries,
    handlePlanApprove,
    handlePlanReject,
    handlePlanInput,
    handlePlanCopy,
    handlePlanExportToNewChat,
    handlePlanHandoff,
    handleFixErrors,
    handleRewindConfirm,
    handleRewindCancel,
    handleAcceptGhostText,
    handleSuggestionChipSelect,
    handleDashboardModalConfirm,
    handleSubmit,
  } = handlers;

  const showCommandTip =
    !settings.hasDismissedCommandTip &&
    messages.some((m) => m.role === 'assistant');

  return (
    <div className="flex flex-1 flex-col min-w-0 min-h-0">
      <MessageList
        messages={messages}
        isLoading={isLoading}
        toolCalls={toolCalls}
        thinkingBlocks={thinkingBlocks}
        showThinking={settings.showThinking}
        thinkingExpanded={thinkingExpanded}
        thinkingToggleVersion={thinkingToggleVersion}
        onToolFixErrors={handleFixErrors}
        assistantMetadata={assistantMetadata}
        sessionId={sessionId}
        projectId={projectId}
      />

      {/* Subagent visualization panel */}
      {(subagents.length > 0 || subagentPanelVisible) && (
        <SubagentPanel
          agents={subagents}
          activeCount={subagentActiveCount}
          isVisible={subagentPanelVisible}
          onToggleVisibility={toggleSubagentPanel}
        />
      )}

      <LatestTurnChangesDialog
        open={latestChangesOpen}
        loading={latestChangesLoading}
        diff={latestChangesDiff}
        error={latestChangesError}
        onClose={() => setLatestChangesOpen(false)}
      />

      {/* Rewind dialog */}
      {rewindTarget && (
        <RewindDialog
          checkpoint={rewindTarget}
          preview={rewindPreview}
          isLoadingPreview={isLoadingPreview}
          onRewind={handleRewindConfirm}
          onCancel={handleRewindCancel}
        />
      )}

      {/* Error banner */}
      <ErrorBanner
        error={chatError}
        onDismiss={handleDismissError}
        onRetry={handleRetry}
      />

      {/* Plan view */}
      {plan && plan.status !== 'idle' && (
        <div className="border-t border-border px-4 py-2">
          <PlanView
            plan={plan}
            savedPath={archivedPlanPath}
            onApprove={handlePlanApprove}
            onReject={handlePlanReject}
            onSendInput={handlePlanInput}
            onCopy={handlePlanCopy}
            onExportToNewChat={handlePlanExportToNewChat}
            onHandoff={handlePlanHandoff}
          />
        </div>
      )}

      {/* Permission dialogs */}
      {pendingPermissionEntries.length > 0 && (
        <div className="border-t border-border px-4 py-2 space-y-2">
          {pendingPermissionEntries.map((perm) => (
            <PermissionDialog
              key={perm.requestId}
              request={{
                type: 'permission:request',
                ...perm,
              }}
              onDecision={handlePermissionDecision}
            />
          ))}
        </div>
      )}

      {/* Suggestion chips */}
      {suggestions.length > 0 && !isLoading && (
        <SuggestionChips
          suggestions={suggestions}
          onSelect={handleSuggestionChipSelect}
          onDismiss={state.dismissSuggestion}
        />
      )}

      {/* Linear issue context bar */}
      {linearIssue && (
        <LinearIssueBar
          linearIssue={linearIssue}
          onOpenPicker={() => setLinearPickerOpen(true)}
          onClear={() => {
            setLinearIssue(null);
            if (window.location.hash.startsWith('#linear/issue/'))
              window.location.hash = '';
          }}
        />
      )}

      {/* Command tip */}
      {showCommandTip && (
        <CommandTipBanner
          onDismiss={() => updateSettings({ hasDismissedCommandTip: true })}
        />
      )}

      {/* Footer composer */}
      <div className="relative border-t border-border bg-background/95 backdrop-blur-sm z-20 px-4 py-4 flex flex-col items-stretch">
        <ChatInput
          input={input}
          onInputChange={handleInputChange}
          onSubmit={handleSubmit}
          isLoading={isLoading}
          showPalette={paletteOpen}
          paletteFilter={paletteFilter}
          paletteCommands={filteredCommands}
          onCommandSelect={handleCommandSelectAndClear}
          onPaletteClose={handlePaletteClose}
          images={attachments}
          onImagesChange={setAttachments}
          availableFiles={suggestedFiles}
          ghostText={undefined}
          onAcceptSuggestion={handleAcceptGhostText}
          contextSummary={isLoading ? undefined : contextSummary}
          mcpServerNames={mcpServers.map((s) => s.name)}
          modelDisplay={getModelDisplay(sessionInfo?.model ?? settings.model)}
          sessionTotalCost={sessionTotalCost}
          onCostClick={() => setCostOpen(true)}
          contextUsage={contextUsage}
        />
      </div>

      <ShortcutHelpModal
        isOpen={helpOpen}
        onClose={() => setHelpOpen(false)}
        shortcuts={shortcuts}
      />

      {costOpen && (
        <CostDialog
          sessionTotalCost={sessionTotalCost}
          messageCostCount={messageCosts.length}
          onClose={() => setCostOpen(false)}
        />
      )}

      <LinearIssuePicker
        isOpen={linearPickerOpen}
        onClose={() => setLinearPickerOpen(false)}
        onSelectIssue={(issue) => {
          setLinearIssue({
            id: issue.id,
            title: issue.title,
            summary: issue.summary,
            url: issue.url,
          });
          window.location.hash = `#linear/issue/${encodeURIComponent(issue.id)}`;
        }}
        onOpenSettings={() => onOpenSettings?.('linear')}
      />

      <DashboardPromptModal
        isOpen={dashboardModalOpen}
        title="New Dashboard"
        isLoading={dashboardModalLoading}
        error={dashboardModalError}
        onConfirm={handleDashboardModalConfirm}
        onCancel={() => {
          if (!dashboardModalLoading) {
            setDashboardModalOpen(false);
            setDashboardModalError(null);
          }
        }}
      />
    </div>
  );
}
