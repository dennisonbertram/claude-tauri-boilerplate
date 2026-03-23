import { useState } from 'react';
import type { Document } from '@claude-tauri/shared';
import {
  File,
  FilePdf,
  FileXls,
  FileText,
  ImageSquare,
  Trash,
  DownloadSimple,
} from '@phosphor-icons/react';
import { getDocumentFileUrl } from '@/lib/api/documents-api';
import { formatFileSize, formatRelativeDate } from '@/lib/format-utils';

interface DocumentCardProps {
  document: Document;
  onDelete: (id: string) => void;
  onOpen: (id: string) => void;
  onContextMenu?: (e: React.MouseEvent, doc: Document) => void;
}

function getDocumentIcon(mimeType: string) {
  if (mimeType === 'application/pdf') return <FilePdf size={40} className="text-red-500" />;
  if (mimeType === 'text/csv' || mimeType.includes('spreadsheet') || mimeType.includes('excel')) return <FileXls size={40} className="text-emerald-500" />;
  if (mimeType.startsWith('text/')) return <FileText size={40} className="text-blue-500" />;
  if (mimeType.startsWith('image/')) return null; // handled separately as thumbnail
  return <File size={40} className="text-muted-foreground" />;
}

export function DocumentCard({ document: doc, onDelete, onOpen, onContextMenu }: DocumentCardProps) {
  const [imgError, setImgError] = useState(false);
  const isImage = doc.mimeType.startsWith('image/');
  const icon = getDocumentIcon(doc.mimeType);

  const handleContextMenu = (e: React.MouseEvent) => {
    if (onContextMenu) {
      e.preventDefault();
      e.stopPropagation();
      onContextMenu(e, doc);
    }
  };

  return (
    <div
      className="group bg-card border border-border rounded-2xl overflow-hidden hover:shadow-soft hover:border-[#d4d2cc] transition-all cursor-pointer flex flex-col"
      onClick={() => onOpen(doc.id)}
      onContextMenu={handleContextMenu}
    >
      {/* Preview area */}
      <div className="relative h-36 flex items-center justify-center bg-sidebar/50">
        {isImage && !imgError ? (
          <img
            src={getDocumentFileUrl(doc.id)}
            alt={doc.filename}
            className="w-full h-full object-cover"
            onError={() => setImgError(true)}
          />
        ) : isImage && imgError ? (
          <ImageSquare size={40} className="text-muted-foreground" />
        ) : (
          icon
        )}

        {/* Hover actions */}
        <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={(e) => { e.stopPropagation(); window.open(getDocumentFileUrl(doc.id), '_blank'); }}
            className="p-1.5 rounded-lg bg-card/90 border border-border text-muted-foreground hover:text-foreground transition-colors shadow-sm"
            title="Download"
          >
            <DownloadSimple size={14} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(doc.id); }}
            className="p-1.5 rounded-lg bg-card/90 border border-border text-muted-foreground hover:text-red-500 transition-colors shadow-sm"
            title="Delete"
          >
            <Trash size={14} />
          </button>
        </div>

        {/* Status badge */}
        {doc.status !== 'ready' && (
          <div className="absolute bottom-2 left-2">
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
              doc.status === 'processing' ? 'bg-amber-100 text-amber-700' :
              doc.status === 'uploading' ? 'bg-blue-100 text-blue-700' :
              'bg-red-100 text-red-700'
            }`}>
              {doc.status}
            </span>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-3 flex flex-col gap-1">
        <p className="text-sm font-medium text-foreground truncate" title={doc.filename}>
          {doc.filename}
        </p>
        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
          <span>{formatFileSize(doc.sizeBytes)}</span>
          <span>{formatRelativeDate(doc.createdAt)}</span>
        </div>
      </div>
    </div>
  );
}
