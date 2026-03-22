import { useState, useCallback, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { MarkdownRenderer } from '@/components/chat/MarkdownRenderer';
import * as api from '@/lib/workspace-api';

interface NotesTabProps {
  workspaceId: string;
}

export function NotesTab({ workspaceId }: NotesTabProps) {
  const [notes, setNotes] = useState('');
  const [notesLoaded, setNotesLoaded] = useState(false);
  const [notesSaveStatus, setNotesSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [notesPreviewMode, setNotesPreviewMode] = useState(false);
  const notesSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const notesSavedFadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setNotesLoaded(false);
    api.fetchWorkspaceNotes(workspaceId).then((content) => {
      setNotes(content);
      setNotesLoaded(true);
    }).catch(() => {
      setNotes('');
      setNotesLoaded(true);
    });
  }, [workspaceId]);

  const handleNotesChange = useCallback((value: string) => {
    setNotes(value);
    setNotesSaveStatus('saving');
    if (notesSavedFadeTimerRef.current) {
      clearTimeout(notesSavedFadeTimerRef.current);
      notesSavedFadeTimerRef.current = null;
    }
    if (notesSaveTimerRef.current) {
      clearTimeout(notesSaveTimerRef.current);
    }
    notesSaveTimerRef.current = setTimeout(() => {
      api.saveWorkspaceNotes(workspaceId, value).then(() => {
        setNotesSaveStatus('saved');
        notesSavedFadeTimerRef.current = setTimeout(() => setNotesSaveStatus('idle'), 2000);
      }).catch(() => {
        setNotesSaveStatus('idle');
      });
    }, 600);
  }, [workspaceId]);

  const handleNotesBlur = useCallback(() => {
    if (notesSaveTimerRef.current) {
      clearTimeout(notesSaveTimerRef.current);
      notesSaveTimerRef.current = null;
    }
    if (notesSavedFadeTimerRef.current) {
      clearTimeout(notesSavedFadeTimerRef.current);
      notesSavedFadeTimerRef.current = null;
    }
    setNotesSaveStatus('saving');
    api.saveWorkspaceNotes(workspaceId, notes).then(() => {
      setNotesSaveStatus('saved');
      notesSavedFadeTimerRef.current = setTimeout(() => setNotesSaveStatus('idle'), 2000);
    }).catch(() => {
      setNotesSaveStatus('idle');
    });
  }, [workspaceId, notes]);

  return (
    <div className="flex flex-1 min-h-0 flex-col p-4 gap-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Workspace notes</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Notes are shared with Claude as context when chatting in this workspace.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {notesSaveStatus === 'saving' && (
            <span className="text-xs text-muted-foreground/60">Saving...</span>
          )}
          {notesSaveStatus === 'saved' && (
            <span className="text-xs text-muted-foreground">Saved &#x2713;</span>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setNotesPreviewMode((prev) => !prev)}
          >
            {notesPreviewMode ? 'Edit' : 'Preview'}
          </Button>
        </div>
      </div>
      {!notesLoaded ? (
        <div className="flex flex-1 items-center justify-center">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : notesPreviewMode ? (
        <div className="flex-1 min-h-0 overflow-y-auto rounded-md border border-border bg-muted/20 p-3">
          {notes.trim() ? (
            <MarkdownRenderer content={notes} />
          ) : (
            <p className="text-sm text-muted-foreground italic">No notes yet. Switch to Edit mode to add some.</p>
          )}
        </div>
      ) : (
        <textarea
          className="flex-1 min-h-0 w-full resize-none rounded-md border border-border bg-background px-3 py-2 text-sm font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          placeholder="Add notes, plans, or context for this workspace..."
          value={notes}
          onChange={(e) => handleNotesChange(e.target.value)}
          onBlur={handleNotesBlur}
        />
      )}
    </div>
  );
}
