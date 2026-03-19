import type { AgentProfile } from '@claude-tauri/shared';

interface ProfileSelectorProps {
  profiles: AgentProfile[];
  selectedProfileId: string | null;
  onSelectProfile: (id: string | null) => void;
  onCreateProfile?: () => void;
}

export function ProfileSelector({
  profiles,
  selectedProfileId,
  onSelectProfile,
  onCreateProfile,
}: ProfileSelectorProps) {
  return (
    <div className="flex gap-2 overflow-x-auto py-2 px-1">
      {/* None/Default option */}
      <button
        onClick={() => onSelectProfile(null)}
        className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-sm border transition-colors ${
          selectedProfileId === null
            ? 'border-primary bg-primary/10 text-primary'
            : 'border-border bg-transparent text-muted-foreground hover:border-primary/50'
        }`}
      >
        Default
      </button>

      {/* Profile cards */}
      {profiles.map((profile) => (
        <button
          key={profile.id}
          onClick={() => onSelectProfile(profile.id)}
          className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-sm border transition-colors flex items-center gap-1.5 ${
            selectedProfileId === profile.id
              ? 'border-primary bg-primary/10 text-primary'
              : 'border-border bg-transparent text-muted-foreground hover:border-primary/50'
          }`}
        >
          {profile.icon && <span>{profile.icon}</span>}
          {profile.name}
        </button>
      ))}

      {/* Create new button */}
      {onCreateProfile && (
        <button
          onClick={onCreateProfile}
          className="flex-shrink-0 px-3 py-1.5 rounded-lg text-sm border border-dashed border-border text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors"
        >
          + New
        </button>
      )}
    </div>
  );
}
