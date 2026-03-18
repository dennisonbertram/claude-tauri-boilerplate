import { toast } from 'sonner';

export type MemoryUpdateTrigger = 'review-feedback' | 'workspace-merge';

export interface MemoryUpdatePromptOptions {
  trigger: MemoryUpdateTrigger;
  onOpenMemory?: () => void;
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
  onOpenMemory,
}: MemoryUpdatePromptOptions): void {
  const prompt = MEMORY_UPDATE_PROMPTS[trigger];

  toast.info(prompt.title, {
    description: prompt.description,
    duration: 8000,
    action: {
      label: 'Open Memory',
      onClick: () => onOpenMemory?.(),
    },
  });
}
