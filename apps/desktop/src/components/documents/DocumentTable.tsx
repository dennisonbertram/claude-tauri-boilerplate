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
  CaretUp,
  CaretDown,
} from '@phosphor-icons/react';
import { getDocumentFileUrl } from '@/lib/api/documents-api';
import { formatFileSize, formatRelativeDate } from '@/lib/format-utils';

interface DocumentTableProps {
  documents: Document[];
  onDelete: (id: string) => void;
  onOpen: (id: string) => void;
  onContextMenu?: (e: React.MouseEvent, doc: Document) => void;
}

function getSmallIcon(mimeType: string) {
  if (mimeType === 'application/pdf') return <FilePdf size={16} className="text-red-500" />;
  if (mimeType === 'text/csv' || mimeType.includes('spreadsheet') || mimeType.includes('excel')) return <FileXls size={16} className="text-emerald-500" />;
  if (mimeType.startsWith('text/')) return <FileText size={16} className="text-blue-500" />;
  if (mimeType.startsWith('image/')) return <ImageSquare size={16} className="text-purple-500" />;
  return <File size={16} className="text-muted-foreground" />;
}

function getMimeLabel(mimeType: string): { label: string; className: string } {
  if (mimeType === 'application/pdf') return { label: 'PDF', className: 'bg-red-50 text-red-600 border-red-100' };
  if (mimeType.startsWith('image/')) return { label: 'Image', className: 'bg-purple-50 text-purple-600 border-purple-100' };
  if (mimeType === 'text/csv' || mimeType.includes('spreadsheet') || mimeType.includes('excel')) return { label: 'CSV', className: 'bg-emerald-50 text-emerald-600 border-emerald-100' };
  if (mimeType.startsWith('text/')) return { label: 'Text', className: 'bg-blue-50 text-blue-600 border-blue-100' };
  const sub = mimeType.split('/')[1] ?? mimeType;
  return { label: sub.toUpperCase().slice(0, 6), className: 'bg-border/40 text-muted-foreground border-border' };
}

type SortKey = 'name' | 'type' | 'size' | 'date';
type SortDir = 'asc' | 'desc';

export function DocumentTable({ documents, onDelete, onOpen, onContextMenu }: DocumentTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>('date');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const sorted = [...documents].sort((a, b) => {
    const dir = sortDir === 'asc' ? 1 : -1;
    switch (sortKey) {
      case 'name': return dir * a.filename.localeCompare(b.filename);
      case 'type': return dir * a.mimeType.localeCompare(b.mimeType);
      case 'size': return dir * (a.sizeBytes - b.sizeBytes);
      case 'date': return dir * (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      default: return 0;
    }
  });

  const SortIcon = ({ column }: { column: SortKey }) => {
    if (sortKey !== column) return null;
    return sortDir === 'asc' ? <CaretUp size={12} /> : <CaretDown size={12} />;
  };

  const headerClass = 'px-4 py-2.5 text-left text-[11px] font-semibold text-muted-foreground/70 uppercase tracking-wider cursor-pointer select-none hover:text-foreground transition-colors';

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
      <table className="w-full">
        <thead>
          <tr className="border-b border-border/50">
            <th className={headerClass} onClick={() => toggleSort('name')}>
              <span className="flex items-center gap-1">Name <SortIcon column="name" /></span>
            </th>
            <th className={`${headerClass} w-24`} onClick={() => toggleSort('type')}>
              <span className="flex items-center gap-1">Type <SortIcon column="type" /></span>
            </th>
            <th className={`${headerClass} w-24`} onClick={() => toggleSort('size')}>
              <span className="flex items-center gap-1">Size <SortIcon column="size" /></span>
            </th>
            <th className={`${headerClass} w-32`} onClick={() => toggleSort('date')}>
              <span className="flex items-center gap-1">Date Added <SortIcon column="date" /></span>
            </th>
            <th className={`${headerClass} w-24 text-right`}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((doc) => {
            const mime = getMimeLabel(doc.mimeType);
            return (
              <tr
                key={doc.id}
                className="border-b border-border/30 last:border-b-0 hover:bg-sidebar/50 transition-colors cursor-pointer group"
                onClick={() => onOpen(doc.id)}
                onContextMenu={(e) => {
                  if (onContextMenu) {
                    e.preventDefault();
                    e.stopPropagation();
                    onContextMenu(e, doc);
                  }
                }}
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    {getSmallIcon(doc.mimeType)}
                    <span className="text-sm text-foreground truncate max-w-[300px]" title={doc.filename}>
                      {doc.filename}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium border ${mime.className}`}>
                    {mime.label}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-muted-foreground">
                  {formatFileSize(doc.sizeBytes)}
                </td>
                <td className="px-4 py-3 text-sm text-muted-foreground">
                  {formatRelativeDate(doc.createdAt)}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => { e.stopPropagation(); window.open(getDocumentFileUrl(doc.id), '_blank'); }}
                      className="p-1.5 rounded-lg hover:bg-border/40 text-muted-foreground hover:text-foreground transition-colors"
                      title="Download"
                    >
                      <DownloadSimple size={14} />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); onDelete(doc.id); }}
                      className="p-1.5 rounded-lg hover:bg-border/40 text-muted-foreground hover:text-red-500 transition-colors"
                      title="Delete"
                    >
                      <Trash size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
