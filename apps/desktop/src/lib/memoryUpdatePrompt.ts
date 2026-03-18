import { toast } from 'sonner';

export type MemoryUpdateTrigger = 'review-feedback' | 'workspace-merge';

export interface MemoryUpdatePromptOptions {
  trigger: MemoryUpdateTrigger;
  draft?: {
    fileName: string;
    content: string;
  };
  onOpenMemory?: () => void;
}

export const MEMORY_UPDATE_DRAFT_KEY = 'claude-tauri-memory-draft';

export function queueMemoryUpdateDraft(draft: {
  fileName: string;
  content: string;
}): void {
  window.sessionStorage.setItem(MEMORY_UPDATE_DRAFT_KEY, JSON.stringify(draft));
}

export function consumeMemoryUpdateDraft():
  | { fileName: string; content: string }
  | null {
  const raw = window.sessionStorage.getItem(MEMORY_UPDATE_DRAFT_KEY);
  if (!raw) return null;
  window.sessionStorage.removeItem(MEMORY_UPDATE_DRAFT_KEY);

  try {
    const parsed = JSON.parse(raw) as Partial<{
      fileName: string;
      content: string;
    }>;
    if (!parsed.fileName || !parsed.content) return null;
    return {
      fileName: parsed.fileName,
      content: parsed.content,
    };
  } catch {
    return null;
  }
}

const MEMORY_UPDATE_PROMPTS: Record<
  MemoryUpdateTrigger,
  { title: string; description: string }
> = {
  'review-feedback': {
    title: 'Update memory from review feedback?',
    description:
      'Capture durable guidance in Settings → Memory so future sessions reuse the same repo memory files.',
  },
  'workspace-merge': {
    title: 'Update memory after merge?',
    description:
      'Record any lasting changes in Settings → Memory so the next session starts with the same memory files.',
  },
};

export function promptMemoryUpdate({
  trigger,
  draft,
  onOpenMemory,
}: MemoryUpdatePromptOptions): void {
  const prompt = MEMORY_UPDATE_PROMPTS[trigger];

  toast.info(prompt.title, {
    description: prompt.description,
    duration: 8000,
    action: {
      label: 'Open Memory',
      onClick: () => {
        if (draft) queueMemoryUpdateDraft(draft);
        onOpenMemory?.();
      },
    },
  });
}
