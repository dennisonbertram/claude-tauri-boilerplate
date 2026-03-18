export type WorkflowPromptKey =
  | 'review'
  | 'pr'
  | 'branch'
  | 'reviewMemory'
  | 'mergeMemory';

export interface WorkflowPrompts {
  review: string;
  pr: string;
  branch: string;
  reviewMemory: string;
  mergeMemory: string;
}

const API_BASE = 'http://localhost:3131';

export const WORKFLOW_PROMPT_KEYS: WorkflowPromptKey[] = [
  'review',
  'pr',
  'branch',
  'reviewMemory',
  'mergeMemory',
];

export const REPO_WORKFLOW_PROMPT_FILES: Record<WorkflowPromptKey, string> = {
  review: 'workflow-review.md',
  pr: 'workflow-pr.md',
  branch: 'workflow-branch.md',
  reviewMemory: 'workflow-review-memory.md',
  mergeMemory: 'workflow-merge-memory.md',
};

export const DEFAULT_WORKFLOW_PROMPTS: WorkflowPrompts = {
  review: [
    'You are reviewing a change set for quality and correctness.',
    '',
    'Goals:',
    '- Identify bugs, edge cases, and unsafe changes',
    '- Suggest concrete improvements (with file/line references when possible)',
    '- Call out missing tests and propose test cases',
    '',
    'Output format:',
    '1) Summary',
    '2) High-risk issues (blockers)',
    '3) Medium/low-risk suggestions',
    '4) Tests to add',
  ].join('\n'),
  pr: [
    'Write a pull request title and description for the change set below.',
    '',
    'Requirements:',
    '- Title: concise, imperative',
    '- Description: what/why, key changes, testing performed, and any follow-ups',
    '- Include a short checklist if appropriate',
  ].join('\n'),
  branch: [
    'Suggest a git branch name for the change set below.',
    '',
    'Requirements:',
    '- Use kebab-case',
    '- Prefer prefix like feature/, fix/, chore/',
    '- Keep it short but specific',
    '- Output ONLY the branch name',
  ].join('\n'),
  reviewMemory: [
    'Summarize the durable lessons from review feedback as repository memory notes.',
    '',
    'Requirements:',
    '- Keep only guidance that should persist across future sessions',
    '- Prefer concise markdown bullets',
    '- Avoid one-off task details',
  ].join('\n'),
  mergeMemory: [
    'Summarize the durable lessons from this merged workspace as repository memory notes.',
    '',
    'Requirements:',
    '- Capture lasting workflow, architecture, or testing guidance',
    '- Prefer concise markdown bullets',
    '- Avoid branch-specific trivia unless it changes future work',
  ].join('\n'),
};

export function getWorkflowPrompt(
  custom: Partial<WorkflowPrompts> | undefined,
  key: WorkflowPromptKey
): string {
  const candidate = custom?.[key];
  if (typeof candidate === 'string' && candidate.trim().length > 0) return candidate;
  return DEFAULT_WORKFLOW_PROMPTS[key];
}

async function getErrorMessage(
  response: Response,
  fallback: string
): Promise<string> {
  try {
    const body = (await response.json()) as { error?: string };
    if (typeof body.error === 'string' && body.error.trim()) return body.error;
  } catch {
    // Ignore JSON parsing failures and use the fallback message.
  }

  return fallback;
}

export async function loadRepoWorkflowPrompts(): Promise<Partial<WorkflowPrompts>> {
  const loaded: Partial<WorkflowPrompts> = {};

  for (const key of WORKFLOW_PROMPT_KEYS) {
    const response = await fetch(
      `${API_BASE}/api/memory/${REPO_WORKFLOW_PROMPT_FILES[key]}`
    );

    if (response.status === 404) continue;
    if (!response.ok) {
      throw new Error(
        await getErrorMessage(
          response,
          `Failed to load repository workflow prompt: ${key}`
        )
      );
    }

    const body = (await response.json()) as { content?: string };
    if (typeof body.content === 'string' && body.content.trim().length > 0) {
      loaded[key] = body.content;
    }
  }

  return loaded;
}

export async function saveRepoWorkflowPrompts(
  prompts: WorkflowPrompts
): Promise<void> {
  for (const key of WORKFLOW_PROMPT_KEYS) {
    const filename = REPO_WORKFLOW_PROMPT_FILES[key];
    const content = prompts[key].trim();
    const shouldPersist =
      content.length > 0 && content !== DEFAULT_WORKFLOW_PROMPTS[key].trim();

    const existingResponse = await fetch(`${API_BASE}/api/memory/${filename}`);

    if (!existingResponse.ok && existingResponse.status !== 404) {
      throw new Error(
        await getErrorMessage(
          existingResponse,
          `Failed to inspect repository workflow prompt: ${key}`
        )
      );
    }

    if (existingResponse.ok) {
      if (!shouldPersist) {
        const deleteResponse = await fetch(`${API_BASE}/api/memory/${filename}`, {
          method: 'DELETE',
        });
        if (!deleteResponse.ok) {
          throw new Error(
            await getErrorMessage(
              deleteResponse,
              `Failed to clear repository workflow prompt: ${key}`
            )
          );
        }
        continue;
      }

      const updateResponse = await fetch(`${API_BASE}/api/memory/${filename}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: prompts[key] }),
      });
      if (!updateResponse.ok) {
        throw new Error(
          await getErrorMessage(
            updateResponse,
            `Failed to save repository workflow prompt: ${key}`
          )
        );
      }
      continue;
    }

    if (!shouldPersist) continue;

    const createResponse = await fetch(`${API_BASE}/api/memory`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: filename, content: prompts[key] }),
    });
    if (!createResponse.ok) {
      throw new Error(
        await getErrorMessage(
          createResponse,
          `Failed to create repository workflow prompt: ${key}`
        )
      );
    }
  }
}

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
  return [
    '## Memory Update',
    '',
    input.prompt.trim(),
    '',
    'Review feedback:',
    input.feedback.trim(),
  ]
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
    '## Memory Update',
    '',
    input.prompt.trim(),
    '',
    `Merged workspace: ${input.workspaceName}`,
    `Branch: ${input.branch}`,
    `Base branch: ${input.baseBranch}`,
  ]
    .filter(Boolean)
    .join('\n');
}
