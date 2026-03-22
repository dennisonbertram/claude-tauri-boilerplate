import { useState } from 'react';
import type { AppSettings } from '@/hooks/useSettings';
import { AVAILABLE_MODELS } from '@/lib/models';
import {
  DEFAULT_WORKFLOW_PROMPTS,
  saveRepoWorkflowPrompts,
} from '@/lib/workflowPrompts';
import { EffortSelector } from '@/components/ui/EffortSelector';
import { SettingField } from '@/components/settings/SettingField';
import type { TabProps } from '@/components/settings/types';

export function WorkflowsTab({ settings, updateSettings }: TabProps) {
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);

  const handleSave = async (workflowPrompts: AppSettings['workflowPrompts']) => {
    setSaveState('saving');
    setSaveError(null);
    try {
      await saveRepoWorkflowPrompts(workflowPrompts);
      setSaveState('saved');
    } catch (error) {
      setSaveState('error');
      setSaveError(error instanceof Error ? error.message : 'Failed to save repository prompts');
    }
  };

  return (
    <>
      <div className="rounded-lg border border-border bg-muted/30 px-3 py-2">
        <div className="text-sm font-medium text-foreground">Repository-scoped workflow prompts</div>
        <div className="mt-1 text-xs text-muted-foreground">
          These prompts override the defaults for this repository only and power
          the `/review`, `/pr`, `/branch`, and `/browser` workflows.
        </div>
      </div>

      <SettingField
        label="Review Prompt"
        description="Prompt template used by /review"
      >
        <textarea
          data-testid="workflow-review-prompt"
          value={settings.workflowPrompts.review}
          onChange={(e) =>
            updateSettings({
              workflowPrompts: {
                ...settings.workflowPrompts,
                review: e.target.value,
              },
            })
          }
          rows={8}
          className="w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none resize-y focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        />
      </SettingField>

      <SettingField
        label="PR Prompt"
        description="Prompt template used by /pr"
      >
        <textarea
          data-testid="workflow-pr-prompt"
          value={settings.workflowPrompts.pr}
          onChange={(e) =>
            updateSettings({
              workflowPrompts: {
                ...settings.workflowPrompts,
                pr: e.target.value,
              },
            })
          }
          rows={8}
          className="w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none resize-y focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        />
      </SettingField>

      <SettingField
        label="Branch Naming Prompt"
        description="Prompt template used by /branch"
      >
        <textarea
          data-testid="workflow-branch-prompt"
          value={settings.workflowPrompts.branch}
          onChange={(e) =>
            updateSettings({
              workflowPrompts: {
                ...settings.workflowPrompts,
                branch: e.target.value,
              },
            })
          }
          rows={6}
          className="w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none resize-y focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        />
      </SettingField>

      <SettingField
        label="Browser Testing Prompt"
        description="Prompt template used by /browser"
      >
        <textarea
          data-testid="workflow-browser-prompt"
          value={settings.workflowPrompts.browser}
          onChange={(e) =>
            updateSettings({
              workflowPrompts: {
                ...settings.workflowPrompts,
                browser: e.target.value,
              },
            })
          }
          rows={10}
          className="w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none resize-y focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        />
      </SettingField>

      <SettingField
        label="Review Memory Prompt"
        description="Draft template used when durable review feedback should become repository memory"
      >
        <textarea
          data-testid="workflow-review-memory-prompt"
          value={settings.workflowPrompts.reviewMemory}
          onChange={(e) =>
            updateSettings({
              workflowPrompts: {
                ...settings.workflowPrompts,
                reviewMemory: e.target.value,
              },
            })
          }
          rows={6}
          className="w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none resize-y focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        />
      </SettingField>

      <SettingField
        label="Merge Memory Prompt"
        description="Draft template used after a merge when lasting guidance should be recorded"
      >
        <textarea
          data-testid="workflow-merge-memory-prompt"
          value={settings.workflowPrompts.mergeMemory}
          onChange={(e) =>
            updateSettings({
              workflowPrompts: {
                ...settings.workflowPrompts,
                mergeMemory: e.target.value,
              },
            })
          }
          rows={6}
          className="w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none resize-y focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        />
      </SettingField>

      <div className="rounded-lg border border-border bg-muted/30 px-3 py-2 mt-2">
        <div className="text-sm font-medium text-foreground">AI Code Review</div>
        <div className="mt-1 text-xs text-muted-foreground">
          Configure the model, effort level, and prompt for inline diff reviews.
        </div>
      </div>

      <SettingField
        label="Code Review Model"
        description="Model used for AI-powered inline diff reviews"
      >
        <select
          data-testid="code-review-model-select"
          value={settings.codeReviewModel}
          onChange={(e) => updateSettings({ codeReviewModel: e.target.value })}
          className="h-8 w-full rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          {AVAILABLE_MODELS.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </select>
      </SettingField>

      <SettingField
        label="Code Review Effort"
        description="Thinking effort level for AI code reviews"
      >
        <EffortSelector
          data-testid="code-review-effort-select"
          value={settings.codeReviewEffort}
          onChange={(val) =>
            updateSettings({
              codeReviewEffort: val as AppSettings['codeReviewEffort'],
            })
          }
        />
      </SettingField>

      <SettingField
        label="Code Review Prompt"
        description="System prompt for AI diff reviews. Must instruct Claude to output JSON."
      >
        <textarea
          data-testid="workflow-code-review-prompt"
          value={settings.workflowPrompts.codeReview}
          onChange={(e) =>
            updateSettings({
              workflowPrompts: {
                ...settings.workflowPrompts,
                codeReview: e.target.value,
              },
            })
          }
          rows={10}
          className="w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none resize-y focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        />
      </SettingField>

      <div className="flex items-center justify-between gap-3">
        <div
          data-testid="workflow-prompts-status"
          className={`text-xs ${
            saveState === 'error'
              ? 'text-red-400'
              : saveState === 'saved'
                ? 'text-green-400'
                : 'text-muted-foreground'
          }`}
        >
          {saveState === 'saving' && 'Saving repository prompts...'}
          {saveState === 'saved' && 'Repository prompts saved.'}
          {saveState === 'error' && (saveError ?? 'Failed to save repository prompts')}
          {saveState === 'idle' &&
            'Defaults are used when a repository override is empty or removed.'}
        </div>
        <div className="flex items-center gap-2">
          <button
            data-testid="workflow-prompts-reset"
            onClick={() => {
              const workflowPrompts = { ...DEFAULT_WORKFLOW_PROMPTS };
              updateSettings({ workflowPrompts });
              void handleSave(workflowPrompts);
            }}
            className="rounded-lg border border-input px-3 py-1.5 text-sm text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          >
            Use defaults
          </button>
          <button
            data-testid="workflow-prompts-save"
            onClick={() => void handleSave(settings.workflowPrompts)}
            disabled={saveState === 'saving'}
            className="rounded-lg bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {saveState === 'saving' ? 'Saving...' : 'Save to repository'}
          </button>
        </div>
      </div>
    </>
  );
}
