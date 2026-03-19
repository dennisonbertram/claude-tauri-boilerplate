import { useState, useRef, useEffect } from 'react';
import type { AgentProfile } from '@claude-tauri/shared';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';

interface AgentProfileSidebarProps {
  profiles: AgentProfile[];
  selectedProfileId: string | null;
  onSelectProfile: (id: string) => void;
  onCreateProfile: () => void;
  onDuplicateProfile: (id: string) => void;
  onDeleteProfile: (id: string) => void;
  loading: boolean;
}

export function AgentProfileSidebar({
  profiles,
  selectedProfileId,
  onSelectProfile,
  onCreateProfile,
  onDuplicateProfile,
  onDeleteProfile,
  loading,
}: AgentProfileSidebarProps) {
  const sorted = [...profiles].sort((a, b) => {
    const orderA = a.sortOrder ?? 0;
    const orderB = b.sortOrder ?? 0;
    if (orderA !== orderB) return orderA - orderB;
    return a.name.localeCompare(b.name);
  });

  return (
    <div className="flex h-full w-[280px] shrink-0 flex-col min-h-0 overflow-hidden border-r border-border bg-sidebar">
      {/* Header */}
      <div className="flex items-center justify-between p-3">
        <h3 className="text-sm font-semibold text-foreground">Agent Profiles</h3>
      </div>
      <Separator />

      {/* New Profile button */}
      <div className="p-3">
        <Button onClick={onCreateProfile} className="w-full" variant="secondary">
          + New Profile
        </Button>
      </div>
      <Separator />

      {/* Profile list */}
      <ScrollArea className="flex-1 min-h-0 overflow-hidden">
        <div className="p-2 space-y-1">
          {loading ? (
            // Loading skeletons
            <>
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="rounded-md px-3 py-2 animate-pulse"
                >
                  <div className="flex items-center gap-2">
                    <div className="h-6 w-6 rounded bg-muted" />
                    <div className="flex-1 space-y-1">
                      <div className="h-3.5 w-24 rounded bg-muted" />
                      <div className="h-2.5 w-16 rounded bg-muted" />
                    </div>
                  </div>
                </div>
              ))}
            </>
          ) : sorted.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">
              No agent profiles yet
            </p>
          ) : (
            sorted.map((profile) => (
              <ProfileItem
                key={profile.id}
                profile={profile}
                isSelected={profile.id === selectedProfileId}
                onSelect={() => onSelectProfile(profile.id)}
                onDuplicate={() => onDuplicateProfile(profile.id)}
                onDelete={() => onDeleteProfile(profile.id)}
              />
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

function ProfileItem({
  profile,
  isSelected,
  onSelect,
  onDuplicate,
  onDelete,
}: {
  profile: AgentProfile;
  isSelected: boolean;
  onSelect: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const [hovering, setHovering] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const icon = profile.icon || '🤖';
  const color = profile.color || '#6b7280';

  // Close menu when clicking outside
  useEffect(() => {
    if (!menuOpen) return;

    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
        setConfirmDelete(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpen]);

  const handleMenuAction = (action: string) => {
    switch (action) {
      case 'duplicate':
        setMenuOpen(false);
        onDuplicate();
        break;
      case 'delete':
        setConfirmDelete(true);
        break;
      case 'confirm-delete':
        setMenuOpen(false);
        setConfirmDelete(false);
        onDelete();
        break;
    }
  };

  return (
    <button
      onClick={onSelect}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => {
        setHovering(false);
        if (!menuOpen) setConfirmDelete(false);
      }}
      className={`w-full rounded-md px-3 py-2 text-left transition-colors relative group ${
        isSelected
          ? 'bg-sidebar-accent text-sidebar-accent-foreground'
          : 'hover:bg-sidebar-accent/50 text-sidebar-foreground'
      }`}
    >
      <div className="flex items-center gap-2">
        {/* Color accent bar */}
        <div
          className="w-0.5 h-8 rounded-full shrink-0"
          style={{ backgroundColor: color }}
        />
        {/* Icon */}
        <span className="text-lg shrink-0" aria-hidden="true">
          {icon}
        </span>
        {/* Name and badge */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-medium truncate">{profile.name}</span>
            {profile.isDefault && (
              <span className="shrink-0 rounded px-1 py-0.5 text-[10px] font-medium bg-primary/10 text-primary">
                default
              </span>
            )}
          </div>
          {profile.description && (
            <p className="text-xs text-muted-foreground truncate mt-0.5">
              {profile.description}
            </p>
          )}
        </div>

        {/* Menu trigger */}
        {hovering && (
          <div
            role="button"
            tabIndex={0}
            onClick={(e) => {
              e.stopPropagation();
              setMenuOpen(!menuOpen);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.stopPropagation();
                setMenuOpen(!menuOpen);
              }
            }}
            className="shrink-0 rounded p-0.5 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="5" r="1" />
              <circle cx="12" cy="12" r="1" />
              <circle cx="12" cy="19" r="1" />
            </svg>
          </div>
        )}
      </div>

      {/* Context menu dropdown */}
      {menuOpen && (
        <div
          ref={menuRef}
          className="absolute right-0 top-full mt-1 z-50 min-w-[140px] rounded-md border border-border bg-popover p-1 shadow-md"
          onClick={(e) => e.stopPropagation()}
        >
          {confirmDelete ? (
            <div
              role="button"
              tabIndex={0}
              onClick={() => handleMenuAction('confirm-delete')}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleMenuAction('confirm-delete');
              }}
              className="flex w-full items-center rounded-sm px-2 py-1.5 text-sm text-destructive hover:bg-destructive/10 cursor-pointer"
            >
              Confirm Delete
            </div>
          ) : (
            <>
              <div
                role="button"
                tabIndex={0}
                onClick={() => handleMenuAction('duplicate')}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleMenuAction('duplicate');
                }}
                className="flex w-full items-center rounded-sm px-2 py-1.5 text-sm hover:bg-accent cursor-pointer"
              >
                Duplicate
              </div>
              <Separator className="my-1" />
              <div
                role="button"
                tabIndex={0}
                onClick={() => handleMenuAction('delete')}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleMenuAction('delete');
                }}
                className="flex w-full items-center rounded-sm px-2 py-1.5 text-sm text-destructive hover:bg-destructive/10 cursor-pointer"
              >
                Delete
              </div>
            </>
          )}
        </div>
      )}
    </button>
  );
}
