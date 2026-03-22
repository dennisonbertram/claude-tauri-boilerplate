import { useState, useCallback, useMemo } from 'react';
import { fuzzyMatchScore } from './attachment-utils';
import type { AttachedImage } from './types';

export function useMentions(
  availableFiles: string[],
  images: AttachedImage[],
  showPalette: boolean
) {
  const [isMentionOpen, setIsMentionOpen] = useState(false);
  const [mentionFilter, setMentionFilter] = useState('');
  const [selectedMentionIndex, setSelectedMentionIndex] = useState(0);
  const [mentionStart, setMentionStart] = useState<number | null>(null);
  const [mentionCursor, setMentionCursor] = useState(0);

  const mentionAvailable = useMemo(() => {
    const values = new Set<string>(availableFiles.length ? availableFiles : []);
    for (const file of images) values.add(file.name);
    return Array.from(values).filter(Boolean);
  }, [availableFiles, images]);

  const mentionCandidates = useMemo(() => {
    const filtered = mentionAvailable
      .map((file) => ({ file, score: fuzzyMatchScore(file, mentionFilter) }))
      .filter((row) => Number.isFinite(row.score))
      .sort((a, b) => {
        if (a.score !== b.score) return a.score - b.score;
        return a.file.localeCompare(b.file);
      })
      .map((row) => row.file);
    return filtered.slice(0, 8);
  }, [mentionAvailable, mentionFilter]);

  const closeMentionPalette = useCallback(() => {
    setIsMentionOpen(false);
    setMentionFilter('');
    setSelectedMentionIndex(0);
    setMentionStart(null);
    setMentionCursor(0);
  }, []);

  const updateMentionState = useCallback(
    (value: string, cursor: number) => {
      if (showPalette) { closeMentionPalette(); return; }
      const beforeCursor = value.slice(0, cursor);
      const atIndex = beforeCursor.lastIndexOf('@');
      if (atIndex === -1) { closeMentionPalette(); return; }
      const prefix = beforeCursor.slice(0, atIndex);
      const query = beforeCursor.slice(atIndex + 1);
      if (prefix.length > 0 && !/\s/.test(prefix[prefix.length - 1])) { closeMentionPalette(); return; }
      if (query.includes(' ') || query.includes('\n')) { closeMentionPalette(); return; }
      setMentionStart(atIndex);
      setMentionFilter(query);
      setMentionCursor(cursor);
      setSelectedMentionIndex(0);
      setIsMentionOpen(true);
    },
    [showPalette, closeMentionPalette]
  );

  return {
    isMentionOpen,
    mentionCandidates,
    selectedMentionIndex,
    setSelectedMentionIndex,
    mentionStart,
    mentionCursor,
    closeMentionPalette,
    updateMentionState,
  };
}
