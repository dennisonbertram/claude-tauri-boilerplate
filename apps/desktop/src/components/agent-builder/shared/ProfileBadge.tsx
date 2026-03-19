import type { AgentProfileSummary } from '@claude-tauri/shared';

interface ProfileBadgeProps {
  profile: AgentProfileSummary;
}

export function ProfileBadge({ profile }: ProfileBadgeProps) {
  return (
    <span
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs bg-primary/10 text-primary"
      style={
        profile.color
          ? { backgroundColor: `${profile.color}20`, color: profile.color }
          : undefined
      }
    >
      {profile.icon && <span className="text-xs">{profile.icon}</span>}
      <span className="truncate max-w-[80px]">{profile.name}</span>
    </span>
  );
}
