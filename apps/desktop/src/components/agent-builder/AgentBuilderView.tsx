import { useState } from 'react';
import { useAgentProfiles } from '@/hooks/useAgentProfiles';
import { AgentProfileSidebar } from './AgentProfileSidebar';
import { AgentProfileEditor } from './AgentProfileEditor';
import { AgentCreateModal } from './AgentCreateModal';

export function AgentBuilderView() {
  const {
    profiles,
    loading,
    addProfile,
    updateProfile,
    removeProfile,
    duplicateProfile,
    generateProfile,
  } = useAgentProfiles();
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [editorIsDirty, setEditorIsDirty] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createModalLoading, setCreateModalLoading] = useState(false);
  const [createModalError, setCreateModalError] = useState<string | null>(null);

  const selectedProfile = profiles.find((p) => p.id === selectedProfileId) ?? null;

  const canDiscardCurrentDraft = () => {
    if (editorIsDirty) {
      if (!window.confirm('You have unsaved changes. Leave without saving?')) return;
    }
    return true;
  };

  const handleOpenCreateModal = () => {
    setCreateModalError(null);
    setCreateModalOpen(true);
  };

  const handleCreateBlankProfile = async () => {
    setCreateModalError(null);
    if (!canDiscardCurrentDraft()) return;

    // If an unsaved profile with the default name already exists, select it instead
    const existing = profiles.find((p) => p.name === 'New Agent Profile');
    if (existing) {
      setSelectedProfileId(existing.id);
      setEditorIsDirty(false);
      setCreateModalOpen(false);
      return;
    }
    if (!canDiscardCurrentDraft()) return;
    setCreateModalLoading(true);
    try {
      const profile = await addProfile({ name: 'New Agent Profile' });
      setSelectedProfileId(profile.id);
      setEditorIsDirty(false);
      setCreateModalOpen(false);
    } catch (err) {
      setCreateModalError(err instanceof Error ? err.message : 'Failed to create profile');
    } finally {
      setCreateModalLoading(false);
    }
  };

  const handleGenerateProfile = async (prompt: string) => {
    setCreateModalError(null);
    if (!canDiscardCurrentDraft()) return;
    setCreateModalLoading(true);
    try {
      const profile = await generateProfile({ prompt });
      setSelectedProfileId(profile.id);
      setEditorIsDirty(false);
      setCreateModalOpen(false);
    } catch (err) {
      setCreateModalError(err instanceof Error ? err.message : 'Failed to generate profile');
    } finally {
      setCreateModalLoading(false);
    }
  };

  return (
    <div className="flex flex-1 min-h-0 min-w-0">
      <AgentProfileSidebar
        profiles={profiles}
        selectedProfileId={selectedProfileId}
        onSelectProfile={(id) => {
          if (editorIsDirty && selectedProfileId !== id) {
            if (!window.confirm('You have unsaved changes. Leave without saving?')) return;
          }
          setSelectedProfileId(id);
          setEditorIsDirty(false);
        }}
        onCreateProfile={handleOpenCreateModal}
        onDuplicateProfile={async (id) => {
          const dup = await duplicateProfile(id);
          setSelectedProfileId(dup.id);
          setEditorIsDirty(false);
        }}
        onDeleteProfile={async (id) => {
          await removeProfile(id);
          if (selectedProfileId === id) setSelectedProfileId(null);
          setEditorIsDirty(false);
        }}
        loading={loading}
      />
      <div className="flex-1 overflow-hidden">
        {selectedProfile ? (
          <AgentProfileEditor
            profile={selectedProfile}
            onSave={(updates) => updateProfile(selectedProfile.id, updates)}
            onDelete={async () => {
              await removeProfile(selectedProfile.id);
              setSelectedProfileId(null);
              setEditorIsDirty(false);
            }}
            onDirtyChange={setEditorIsDirty}
          />
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <div className="text-center">
              <div className="text-4xl mb-4">
                <svg
                  width="48"
                  height="48"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="mx-auto opacity-40"
                >
                  <path d="M12 8V4H8" />
                  <rect width="16" height="12" x="4" y="8" rx="2" />
                  <path d="M2 14h2" />
                  <path d="M20 14h2" />
                  <path d="M15 13v2" />
                  <path d="M9 13v2" />
                </svg>
              </div>
              <p className="text-lg font-medium">No profile selected</p>
              <p className="text-sm mt-1">
                Select a profile from the sidebar or create a new one
              </p>
            </div>
          </div>
        )}
      </div>
      <AgentCreateModal
        isOpen={createModalOpen}
        isLoading={createModalLoading}
        error={createModalError}
        onClose={() => {
          if (createModalLoading) return;
          setCreateModalOpen(false);
          setCreateModalError(null);
        }}
        onCreateBlank={handleCreateBlankProfile}
        onGenerate={handleGenerateProfile}
      />
    </div>
  );
}
