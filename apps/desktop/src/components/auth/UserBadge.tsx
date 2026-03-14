import { Avatar, AvatarFallback } from '@/components/ui/avatar';

interface UserBadgeProps {
  email?: string;
  plan?: string;
}

export function UserBadge({ email, plan }: UserBadgeProps) {
  return (
    <div className="flex items-center gap-2 px-3 py-2">
      <Avatar className="h-8 w-8">
        <AvatarFallback className="text-xs">
          {email?.[0]?.toUpperCase() || '?'}
        </AvatarFallback>
      </Avatar>
      <div className="flex flex-col min-w-0">
        <span className="text-sm font-medium truncate">{email || 'Unknown'}</span>
        <span className="text-xs text-muted-foreground">{plan || 'Pro'} Plan</span>
      </div>
    </div>
  );
}
