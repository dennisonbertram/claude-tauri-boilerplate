import type { WorkflowPrompts } from './workflowPromptDefaults';
import {
  WORKFLOW_PROMPT_KEYS,
  REPO_WORKFLOW_PROMPT_FILES,
  DEFAULT_WORKFLOW_PROMPTS,
} from './workflowPromptDefaults';

const API_BASE = 'http://localhost:3131';

async function getErrorMessage(response: Response, fallback: string): Promise<string> {
  try {
    const body = (await response.json()) as { error?: string };
    if (typeof body.error === 'string' && body.error.trim()) return body.error;
  } catch {
    // Ignore JSON parsing failures and use the fallback message.
  }
  return fallback;
}

async function listMemoryFiles(): Promise<Set<string>> {
  const response = await fetch(`${API_BASE}/api/memory`);
  if (!response.ok) {
    throw new Error(await getErrorMessage(response, 'Failed to list repository memory files'));
  }

  const body = (await response.json()) as { files?: Array<{ name?: string }> };
  return new Set(
    (body.files ?? [])
      .map((file) => (typeof file.name === 'string' ? file.name : ''))
      .filter((name) => name.length > 0)
  );
}

export async function loadRepoWorkflowPrompts(): Promise<Partial<WorkflowPrompts>> {
  const loaded: Partial<WorkflowPrompts> = {};
  const existingFiles = await listMemoryFiles();

  for (const key of WORKFLOW_PROMPT_KEYS) {
    const filename = REPO_WORKFLOW_PROMPT_FILES[key];
    if (!existingFiles.has(filename)) continue;

    const response = await fetch(`${API_BASE}/api/memory/${filename}`);
    if (!response.ok) {
      throw new Error(
        await getErrorMessage(response, `Failed to load repository workflow prompt: ${key}`)
      );
    }

    const body = (await response.json()) as { content?: string };
    if (typeof body.content === 'string' && body.content.trim().length > 0) {
      loaded[key] = body.content;
    }
  }

  return loaded;
}

export async function saveRepoWorkflowPrompts(prompts: WorkflowPrompts): Promise<void> {
  for (const key of WORKFLOW_PROMPT_KEYS) {
    const filename = REPO_WORKFLOW_PROMPT_FILES[key];
    const content = prompts[key].trim();
    const shouldPersist = content.length > 0 && content !== DEFAULT_WORKFLOW_PROMPTS[key].trim();

    const existingResponse = await fetch(`${API_BASE}/api/memory/${filename}`);

    if (!existingResponse.ok && existingResponse.status !== 404) {
      throw new Error(
        await getErrorMessage(existingResponse, `Failed to inspect repository workflow prompt: ${key}`)
      );
    }

    if (existingResponse.ok) {
      if (!shouldPersist) {
        const deleteResponse = await fetch(`${API_BASE}/api/memory/${filename}`, { method: 'DELETE' });
        if (!deleteResponse.ok) {
          throw new Error(
            await getErrorMessage(deleteResponse, `Failed to clear repository workflow prompt: ${key}`)
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
          await getErrorMessage(updateResponse, `Failed to save repository workflow prompt: ${key}`)
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
        await getErrorMessage(createResponse, `Failed to create repository workflow prompt: ${key}`)
      );
    }
  }
}
