export type WorkflowPromptKey =
  | 'review'
  | 'pr'
  | 'branch'
  | 'browser'
  | 'reviewMemory'
  | 'mergeMemory'
  | 'codeReview';

export interface WorkflowPrompts {
  review: string;
  pr: string;
  branch: string;
  reviewMemory: string;
  mergeMemory: string;
  browser: string;
  codeReview: string;
}

export const WORKFLOW_PROMPT_KEYS: WorkflowPromptKey[] = [
  'review',
  'pr',
  'branch',
  'browser',
  'reviewMemory',
  'mergeMemory',
  'codeReview',
];

export const REPO_WORKFLOW_PROMPT_FILES: Record<WorkflowPromptKey, string> = {
  review: 'workflow-review.md',
  pr: 'workflow-pr.md',
  branch: 'workflow-branch.md',
  browser: 'workflow-browser.md',
  reviewMemory: 'workflow-review-memory.md',
  mergeMemory: 'workflow-merge-memory.md',
  codeReview: 'workflow-code-review.md',
};

export const DEFAULT_CODE_REVIEW_PROMPT = [
  'You are a senior software engineer performing a thorough code review.',
  '',
  'Review the git diff below and provide structured feedback.',
  '',
  'Requirements:',
  '- Identify bugs, edge cases, and unsafe changes',
  '- Suggest concrete improvements with file/line references where possible',
  '- Call out missing tests and propose test cases',
  '- Assign each comment a severity: critical | warning | suggestion | info',
  '',
  'Output format (MUST be valid JSON, no markdown fences):',
  '{',
  '  "summary": "Brief overall assessment in 1-3 sentences.",',
  '  "comments": [',
  '    {',
  '      "file": "path/to/file.ts",',
  '      "line": 42,',
  '      "severity": "warning",',
  '      "body": "Explanation of the issue and suggested fix."',
  '    }',
  '  ]',
  '}',
  '',
  'Use line numbers that match the new file (+ lines in the diff).',
  'Omit "line" if the comment applies to the whole file.',
  'Output ONLY valid JSON. Do not include explanation outside the JSON object.',
].join('\n');

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
  codeReview: DEFAULT_CODE_REVIEW_PROMPT,
  browser: [
    'Use the browser tooling to test the app from the desktop workflow.',
    '',
    'Prerequisites:',
    '- Default to the agent-browser CLI for browser testing instead of the Playwright MCP preset.',
    '- If Chrome is not installed for agent-browser yet, run `agent-browser install` once from Bash.',
    '- Store screenshots and recordings under `.claude/browser-artifacts/agent-browser` for this repo.',
    '- `agentation` is a separate visual-feedback MCP tool, not a replacement for agent-browser.',
    '',
    'Goals:',
    '- Launch or navigate to the target app or URL',
    '- Capture screenshots when visual confirmation matters',
    '- Read page content and console output',
    '- Interact with the page like a user: click, type, scroll, and submit forms',
    '- Save a recording for multi-step flows when needed',
    '- Report failures with concrete repro steps, screenshots, and console details',
    '',
    'Suggested command loop:',
    '- `agent-browser open <url>`',
    '- `agent-browser wait --load networkidle`',
    '- `agent-browser snapshot -i`',
    '- `agent-browser click @eN`, `fill @eN "value"`, `press Enter`, `scroll down 500`',
    '- `agent-browser console` and `agent-browser errors`',
    '- `agent-browser screenshot .claude/browser-artifacts/agent-browser/<name>.png`',
    '- `agent-browser record start .claude/browser-artifacts/agent-browser/<name>.webm` then `agent-browser record stop`',
    '',
    'Testing workflow:',
    '1) Open the target URL with agent-browser and wait for network idle',
    '2) Run `snapshot -i` to get fresh refs before each interaction step',
    '3) Exercise the key user flow with click/fill/press/scroll commands',
    '4) Capture screenshots before and after the critical state changes',
    '5) Check `agent-browser console` and `agent-browser errors` before wrapping up',
    '6) Summarize results, failures, and artifact paths',
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
