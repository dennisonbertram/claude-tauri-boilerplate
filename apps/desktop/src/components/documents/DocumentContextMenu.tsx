import { useEffect, useRef, useCallback } from 'react';
import type { Document } from '@claude-tauri/shared';
import {
  ArrowSquareOut,
  FolderOpen,
  ClipboardText,
  DownloadSimple,
  Link,
  PencilSimple,
  Trash,
} from '@phosphor-icons/react';
import { getDocumentFileUrl, openDocumentOnComputer } from '@/lib/api/documents-api';

export interface ContextMenuPosition {
  x: number;
  y: number;
}

export interface DocumentContextMenuState {
  document: Document | null;
  position: ContextMenuPosition | null;
}

interface DocumentContextMenuProps {
  state: DocumentContextMenuState;
  onClose: () => void;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
}

export function DocumentContextMenu({
  state,
  onClose,
  onOpen,
  onDelete,
}: DocumentContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  // Close on click outside, scroll, or Escape
  useEffect(() => {
    if (!state.document || !state.position) return;

    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        handleClose();
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') handleClose();
    }
    function handleScroll() {
      handleClose();
    }

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('scroll', handleScroll, true);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, [state.document, state.position, handleClose]);

  // Adjust position to prevent overflow
  useEffect(() => {
    if (!menuRef.current || !state.position) return;
    const menu = menuRef.current;
    const rect = menu.getBoundingClientRect();
    const viewportW = window.innerWidth;
    const viewportH = window.innerHeight;

    let adjustedX = state.position.x;
    let adjustedY = state.position.y;

    if (rect.right > viewportW) {
      adjustedX = viewportW - rect.width - 8;
    }
    if (rect.bottom > viewportH) {
      adjustedY = viewportH - rect.height - 8;
    }
    if (adjustedX < 0) adjustedX = 8;
    if (adjustedY < 0) adjustedY = 8;

    if (adjustedX !== state.position.x || adjustedY !== state.position.y) {
      menu.style.left = `${adjustedX}px`;
      menu.style.top = `${adjustedY}px`;
    }
  }, [state.position]);

  if (!state.document || !state.position) return null;

  const doc = state.document;
  const fileUrl = getDocumentFileUrl(doc.id);

  const handleOpen = () => {
    onOpen(doc.id);
    handleClose();
  };

  const handleOpenOnComputer = async () => {
    try {
      await openDocumentOnComputer(doc.id);
    } catch (err) {
      console.error('Failed to open document on computer:', err);
    }
    handleClose();
  };

  const handleCopyFilePath = async () => {
    try {
      await navigator.clipboard.writeText(doc.storagePath);
    } catch (err) {
      console.error('Failed to copy file path:', err);
    }
    handleClose();
  };

  const handleDownload = () => {
    const a = window.document.createElement('a');
    a.href = fileUrl;
    a.download = doc.filename;
    a.style.display = 'none';
    window.document.body.appendChild(a);
    a.click();
    window.document.body.removeChild(a);
    handleClose();
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(fileUrl);
    } catch (err) {
      console.error('Failed to copy link:', err);
    }
    handleClose();
  };

  const handleDelete = () => {
    onDelete(doc.id);
    handleClose();
  };

  const itemClass =
    'flex items-center gap-2.5 w-full text-sm px-3 py-2 rounded-lg hover:bg-sidebar-accent/50 transition-colors cursor-pointer text-foreground';
  const disabledClass =
    'flex items-center gap-2.5 w-full text-sm px-3 py-2 rounded-lg opacity-50 cursor-not-allowed text-foreground';
  const destructiveClass =
    'flex items-center gap-2.5 w-full text-sm px-3 py-2 rounded-lg hover:bg-red-500/10 transition-colors cursor-pointer text-red-500';

  return (
    <div
      ref={menuRef}
      className="fixed z-[100] min-w-[200px] bg-card border border-border rounded-xl shadow-lg p-1.5 animate-in fade-in zoom-in-95 duration-100"
      style={{ left: state.position.x, top: state.position.y }}
      onClick={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* Open */}
      <button className={itemClass} onClick={handleOpen}>
        <ArrowSquareOut size={16} className="text-muted-foreground" />
        Open
      </button>

      {/* Open on Computer */}
      <button className={itemClass} onClick={handleOpenOnComputer}>
        <FolderOpen size={16} className="text-muted-foreground" />
        Open on Computer
      </button>

      {/* Copy File Path */}
      <button className={itemClass} onClick={handleCopyFilePath}>
        <ClipboardText size={16} className="text-muted-foreground" />
        Copy File Path
      </button>

      {/* Separator */}
      <div className="border-t border-border my-1" />

      {/* Download */}
      <button className={itemClass} onClick={handleDownload}>
        <DownloadSimple size={16} className="text-muted-foreground" />
        Download
      </button>

      {/* Copy Link */}
      <button className={itemClass} onClick={handleCopyLink}>
        <Link size={16} className="text-muted-foreground" />
        Copy Link
      </button>

      {/* Separator */}
      <div className="border-t border-border my-1" />

      {/* Rename (disabled placeholder) */}
      <button className={disabledClass} disabled>
        <PencilSimple size={16} className="text-muted-foreground" />
        Rename
      </button>

      {/* Delete */}
      <button className={destructiveClass} onClick={handleDelete}>
        <Trash size={16} />
        Delete
      </button>
    </div>
  );
}
