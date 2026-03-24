import { useState, useEffect } from 'react';
import type { AgentDefinition } from '@claude-tauri/shared';
import { AVAILABLE_MODELS } from '@/lib/models';

interface AddAgentDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (agent: AgentDefinition) => Promise<boolean>;
}

const MODEL_OPTIONS = AVAILABLE_MODELS.map((model) => ({
  value: model.id,
  label: model.label,
}));

const PERMISSION_MODES: AgentDefinition['permissionMode'][] = [
  'normal',
  'acceptEdits',
  'dontAsk',
  'plan',
];

export function AddAgentDialog({ isOpen, onClose, onAdd }: AddAgentDialogProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [model, setModel] = useState('');
  const [permissionMode, setPermissionMode] = useState<AgentDefinition['permissionMode']>('normal');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const resetForm = () => {
    setName('');
    setDescription('');
    setModel('');
    setPermissionMode('normal');
    setError(null);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleAdd = async () => {
    if (!name.trim()) {
      setError('Agent name is required');
      return;
    }
    if (!description.trim()) {
      setError('Agent description is required');
      return;
    }

    setSubmitting(true);
    setError(null);

    const agent: AgentDefinition = {
      name: name.trim(),
      description: description.trim(),
      model: model || undefined,
      tools: [],
      permissionMode,
    };

    const success = await onAdd(agent);
    setSubmitting(false);

    if (success) {
      resetForm();
      onClose();
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
    };
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <>
      {/* Overlay */}
      <div
        data-testid="add-agent-overlay"
        className="fixed inset-0 z-40 bg-black/50"
        onClick={handleClose}
      />

      {/* Dialog */}
      <div
        data-testid="add-agent-dialog"
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
      >
        <div className="w-full max-w-md rounded-lg border border-border bg-background shadow-xl flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <h2 className="text-lg font-semibold">Add Agent</h2>
            <button
              data-testid="add-agent-close"
              onClick={handleClose}
              className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          {/* Body */}
          <div className="p-4 space-y-3">
            {/* Name */}
            <div className="space-y-1">
              <label className="text-sm font-medium">Name</label>
              <input
                data-testid="add-agent-name"
                type="text"
                value={name}
                onChange={(e) => { setName(e.target.value); setError(null); }}
                placeholder="Agent name"
                className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              />
            </div>

            {/* Description */}
            <div className="space-y-1">
              <label className="text-sm font-medium">Description</label>
              <input
                data-testid="add-agent-description"
                type="text"
                value={description}
                onChange={(e) => { setDescription(e.target.value); setError(null); }}
                placeholder="What does this agent do?"
                className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              />
            </div>

            {/* Model */}
            <div className="space-y-1">
              <label className="text-sm font-medium">Model</label>
              <select
                data-testid="add-agent-model"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="h-8 w-full rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <option value="">Default model</option>
                {MODEL_OPTIONS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Permission Mode */}
            <div className="space-y-1">
              <label className="text-sm font-medium">Permission Mode</label>
              <select
                data-testid="add-agent-permission"
                value={permissionMode}
                onChange={(e) => setPermissionMode(e.target.value as AgentDefinition['permissionMode'])}
                className="h-8 w-full rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                {PERMISSION_MODES.map((mode) => (
                  <option key={mode} value={mode}>
                    {mode}
                  </option>
                ))}
              </select>
            </div>

            {/* Error */}
            {error && (
              <p data-testid="add-agent-error" className="text-sm text-destructive">
                {error}
              </p>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-2 border-t border-border px-4 py-3">
            <button
              data-testid="add-agent-cancel"
              onClick={handleClose}
              className="h-8 rounded-lg border border-border px-3 text-sm text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            >
              Cancel
            </button>
            <button
              data-testid="add-agent-submit"
              onClick={handleAdd}
              disabled={submitting}
              className="h-8 rounded-lg bg-primary px-3 text-sm text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {submitting ? 'Adding...' : 'Add Agent'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
