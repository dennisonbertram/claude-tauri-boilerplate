import { useState, useEffect } from 'react';
import type { UpdateAgentProfileRequest } from '@claude-tauri/shared';
import { Input } from '@/components/ui/input';

interface GeneralTabProps {
  draft: UpdateAgentProfileRequest;
  onChange: (updates: Partial<UpdateAgentProfileRequest>) => void;
}

export function GeneralTab({ draft, onChange }: GeneralTabProps) {
  const [colorPopoverOpen, setColorPopoverOpen] = useState(false);

  useEffect(() => {
    if (!colorPopoverOpen) return;
    function handleClick(e: MouseEvent) {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-color-popover]')) setColorPopoverOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [colorPopoverOpen]);

  return (
    <div className="space-y-5">
      {/* Name */}
      <div>
        <label className="block text-sm font-medium text-foreground mb-1.5">
          Name <span className="text-destructive">*</span>
        </label>
        <Input
          value={draft.name ?? ''}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder="Enter profile name..."
        />
      </div>

      {/* Description */}
      <div>
        <label className="block text-sm font-medium text-foreground mb-1.5">
          Description
        </label>
        <Input
          value={draft.description ?? ''}
          onChange={(e) => onChange({ description: e.target.value })}
          placeholder="A short description of this agent profile"
        />
      </div>

      {/* Icon and Color side by side */}
      <div className="grid grid-cols-2 gap-4">
        {/* Icon */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">
            Icon
          </label>
          <div className="flex items-center gap-2">
            <span className="text-2xl" aria-hidden="true">
              {draft.icon || '🤖'}
            </span>
            <Input
              value={draft.icon ?? ''}
              onChange={(e) => onChange({ icon: e.target.value })}
              placeholder="🤖"
              className="flex-1"
            />
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Enter an emoji character
          </p>
        </div>

        {/* Color */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">
            Color
          </label>
          <div className="flex items-center gap-2">
            <div className="relative" data-color-popover>
              <button
                type="button"
                onClick={() => setColorPopoverOpen(o => !o)}
                className="h-8 w-8 shrink-0 rounded border border-border cursor-pointer transition-transform hover:scale-105"
                style={{ backgroundColor: draft.color || '#6b7280' }}
                title="Choose color"
              />
              {colorPopoverOpen && (
                <div className="absolute top-9 left-0 z-50 p-2 rounded-lg border border-border bg-popover shadow-lg grid grid-cols-6 gap-1">
                  {['#ef4444','#f97316','#eab308','#22c55e','#06b6d4','#3b82f6','#8b5cf6','#ec4899','#6b7280','#1e293b','#ffffff','#000000'].map(c => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => { onChange({ color: c }); setColorPopoverOpen(false); }}
                      className="h-6 w-6 rounded cursor-pointer border border-border/50 hover:scale-110 transition-transform"
                      style={{ backgroundColor: c }}
                      title={c}
                    />
                  ))}
                </div>
              )}
            </div>
            <Input
              value={draft.color ?? '#6b7280'}
              onChange={(e) => onChange({ color: e.target.value })}
              placeholder="#6b7280"
              className="flex-1"
            />
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Click the swatch to choose a preset color, or enter a hex value
          </p>
        </div>
      </div>

      {/* Is Default */}
      <div className="flex items-center gap-3">
        <input
          type="checkbox"
          id="agent-is-default"
          checked={draft.isDefault ?? false}
          onChange={(e) => onChange({ isDefault: e.target.checked })}
          className="h-4 w-4 rounded border-border text-primary focus:ring-ring"
        />
        <div>
          <label
            htmlFor="agent-is-default"
            className="text-sm font-medium text-foreground cursor-pointer"
          >
            Default Profile
          </label>
          <p className="text-xs text-muted-foreground">
            Use this profile by default for new sessions
          </p>
        </div>
      </div>

    </div>
  );
}
