import type { UpdateAgentProfileRequest } from '@claude-tauri/shared';
import { Input } from '@/components/ui/input';

interface GeneralTabProps {
  draft: UpdateAgentProfileRequest;
  onChange: (updates: Partial<UpdateAgentProfileRequest>) => void;
}

export function GeneralTab({ draft, onChange }: GeneralTabProps) {
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
          placeholder="My Agent Profile"
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
            <input
              type="color"
              value={draft.color || '#6b7280'}
              onChange={(e) => onChange({ color: e.target.value })}
              className="h-8 w-8 shrink-0 cursor-pointer rounded border border-border bg-transparent"
            />
            <Input
              value={draft.color ?? '#6b7280'}
              onChange={(e) => onChange({ color: e.target.value })}
              placeholder="#6b7280"
              className="flex-1"
            />
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Hex color for the accent bar
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

      {/* Sort Order */}
      <div>
        <label className="block text-sm font-medium text-foreground mb-1.5">
          Sort Order
        </label>
        <Input
          type="number"
          value={draft.sortOrder ?? 0}
          onChange={(e) =>
            onChange({ sortOrder: parseInt(e.target.value, 10) || 0 })
          }
          placeholder="0"
          className="w-24"
        />
        <p className="text-xs text-muted-foreground mt-1">
          Lower numbers appear first in the sidebar
        </p>
      </div>
    </div>
  );
}
