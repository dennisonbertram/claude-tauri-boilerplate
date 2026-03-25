import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';

interface AgentCreateModalProps {
  isOpen: boolean;
  isLoading: boolean;
  error: string | null;
  onClose: () => void;
  onCreateBlank: () => Promise<void>;
  onGenerate: (prompt: string) => Promise<void>;
}

function SpinnerIcon() {
  return (
    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

export function AgentCreateModal({
  isOpen,
  isLoading,
  error,
  onClose,
  onCreateBlank,
  onGenerate,
}: AgentCreateModalProps) {
  const [prompt, setPrompt] = useState('');
  const promptRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!isOpen) {
      setPrompt('');
      return;
    }

    promptRef.current?.focus();
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }

      if (event.key === 'Enter' && (event.metaKey || event.ctrlKey) && prompt.trim() && !isLoading) {
        void onGenerate(prompt.trim());
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isLoading, onClose, onGenerate, prompt]);

  if (!isOpen) return null;

  const handleBlankCreate = () => {
    void onCreateBlank();
  };

  const handleGenerate = () => {
    if (!prompt.trim() || isLoading) return;
    void onGenerate(prompt.trim());
  };

  return (
    <>
      <div
        data-testid="agent-create-backdrop"
        className="fixed inset-0 z-40 bg-black/50"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-label="Create a new agent"
        data-testid="agent-create-modal"
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
      >
        <div className="w-full max-w-2xl rounded-xl border border-border bg-popover shadow-2xl">
          <div className="flex items-center justify-between border-b border-border px-6 py-4">
            <div>
              <h2 className="text-lg font-semibold text-popover-foreground">Create a new agent</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Start from scratch or let Claude draft the first version for you.
              </p>
            </div>
            <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Close create agent modal">
              <span aria-hidden="true">×</span>
            </Button>
          </div>

          <div className="grid gap-4 px-6 py-5 md:grid-cols-[1fr_1.2fr]">
            <section className="rounded-lg border border-border bg-background/70 p-4">
              <h3 className="text-sm font-semibold text-foreground">Blank profile</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Create an empty agent profile and fill in the details yourself.
              </p>
              <Button
                className="mt-4 w-full"
                variant="outline"
                onClick={handleBlankCreate}
                disabled={isLoading}
              >
                {isLoading ? <SpinnerIcon /> : null}
                Create blank profile
              </Button>
            </section>

            <section className="rounded-lg border border-border bg-background/70 p-4">
              <h3 className="text-sm font-semibold text-foreground">Generate with AI</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Describe the agent you want and Claude will generate a starter profile.
              </p>

              <label className="mt-4 block text-sm font-medium text-foreground" htmlFor="agent-create-prompt">
                Agent idea
              </label>
              <textarea
                id="agent-create-prompt"
                ref={promptRef}
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                rows={6}
                placeholder="Example: Create a focused code review agent that checks for security issues, summarizes risk, and keeps feedback short."
                className="mt-2 w-full resize-none rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
                disabled={isLoading}
                aria-label="Agent idea"
              />

              <div className="mt-4 flex items-center justify-between gap-3">
                <p className="text-xs text-muted-foreground">
                  Press <kbd className="font-mono">Cmd+Enter</kbd> to generate
                </p>
                <Button onClick={handleGenerate} disabled={isLoading || !prompt.trim()}>
                  {isLoading ? <SpinnerIcon /> : null}
                  Generate with AI
                </Button>
              </div>
            </section>
          </div>

          {error && (
            <div className="px-6 pb-2">
              <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            </div>
          )}

          <div className="flex justify-end border-t border-border px-6 py-4">
            <Button variant="ghost" onClick={onClose} disabled={isLoading}>
              Cancel
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
