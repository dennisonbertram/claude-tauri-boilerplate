// Re-export prompt definitions and API helpers for backwards compatibility
export type { WorkflowPromptKey, WorkflowPrompts } from './workflowPromptDefaults';
export {
  WORKFLOW_PROMPT_KEYS,
  REPO_WORKFLOW_PROMPT_FILES,
  DEFAULT_CODE_REVIEW_PROMPT,
  DEFAULT_WORKFLOW_PROMPTS,
  getWorkflowPrompt,
} from './workflowPromptDefaults';
export { loadRepoWorkflowPrompts, saveRepoWorkflowPrompts } from './workflowPromptApi';

// ── Message builder helpers ─────────────────────────────────────────

function formatChangedFiles(changedFiles: string[] | undefined): string {
  const files = (changedFiles ?? []).map((f) => f.trim()).filter(Boolean);
  if (files.length === 0) return '';
  return `Changed files:\n${files.map((f) => `- ${f}`).join('\n')}`;
}

export function buildReviewWorkflowMessage(input: {
  prompt: string;
  changedFiles?: string[];
  diff?: string;
}): string {
  const sections: string[] = [input.prompt.trim()];
  const filesBlock = formatChangedFiles(input.changedFiles);
  if (filesBlock) sections.push(filesBlock);
  const diff = (input.diff ?? '').trim();
  if (diff) sections.push(['Diff:', '```diff', diff, '```'].join('\n'));
  return sections.filter(Boolean).join('\n\n');
}

export function buildPrWorkflowMessage(input: { prompt: string; diff?: string }): string {
  const sections: string[] = [input.prompt.trim()];
  const diff = (input.diff ?? '').trim();
  if (diff) sections.push(['Diff:', '```diff', diff, '```'].join('\n'));
  return sections.filter(Boolean).join('\n\n');
}

export function buildBranchNameWorkflowMessage(input: {
  prompt: string;
  changedFiles?: string[];
}): string {
  const sections: string[] = [input.prompt.trim()];
  const filesBlock = formatChangedFiles(input.changedFiles);
  if (filesBlock) sections.push(filesBlock);
  return sections.filter(Boolean).join('\n\n');
}

export function buildReviewMemoryDraft(input: {
  prompt: string;
  feedback: string;
}): string {
  return ['## Memory Update', '', input.prompt.trim(), '', 'Review feedback:', input.feedback.trim()]
    .filter(Boolean)
    .join('\n');
}

export function buildMergeMemoryDraft(input: {
  prompt: string;
  workspaceName: string;
  branch: string;
  baseBranch: string;
}): string {
  return [
    '## Memory Update', '', input.prompt.trim(), '',
    `Merged workspace: ${input.workspaceName}`,
    `Branch: ${input.branch}`,
    `Base branch: ${input.baseBranch}`,
  ].filter(Boolean).join('\n');
}

export function buildBrowserWorkflowMessage(input: {
  prompt: string;
  targetUrl?: string;
  task?: string;
}): string {
  const sections: string[] = [input.prompt.trim()];
  const targetUrl = (input.targetUrl ?? '').trim();
  if (targetUrl) sections.push(`Target URL: ${targetUrl}`);
  const task = (input.task ?? '').trim();
  if (task) sections.push(`Task: ${task}`);
  return sections.filter(Boolean).join('\n\n');
}
