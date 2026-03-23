import { useState, useEffect, useCallback, useMemo } from 'react';
import type { Document } from '@claude-tauri/shared';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  X,
  CaretLeft,
  CaretRight,
  DownloadSimple,
  FolderOpen,
  File,
  FilePdf,
  FileXls,
  FileText,
  FileDoc,
  FileCode,
  FileCsv,
  ImageSquare,
  FileArrowDown,
  Presentation,
  MagnifyingGlassPlus,
  MagnifyingGlassMinus,
  ArrowCounterClockwise,
} from '@phosphor-icons/react';
import {
  getDocumentFileUrl,
  fetchDocumentContent,
  openDocumentOnComputer,
} from '@/lib/api/documents-api';
import { formatFileSize, formatRelativeDate } from '@/lib/format-utils';

// ---------------------------------------------------------------------------
// Preview type detection
// ---------------------------------------------------------------------------

export type PreviewType =
  | 'image'
  | 'pdf'
  | 'markdown'
  | 'csv'
  | 'json'
  | 'text'
  | 'code'
  | 'office'
  | 'unsupported';

const IMAGE_MIMES = new Set([
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/svg+xml',
  'image/webp',
  'image/bmp',
  'image/tiff',
]);

const CODE_EXTENSIONS = new Set([
  '.js', '.ts', '.tsx', '.jsx', '.py', '.rs', '.go', '.java',
  '.c', '.cpp', '.h', '.rb', '.php', '.swift', '.kt',
  '.sh', '.bash', '.zsh', '.yaml', '.yml', '.toml', '.xml',
  '.html', '.css', '.scss', '.sql',
]);

const OFFICE_MIMES = new Set([
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'application/vnd.oasis.opendocument.spreadsheet',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
  'application/vnd.oasis.opendocument.text',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.ms-powerpoint',
  'application/vnd.oasis.opendocument.presentation',
]);

const OFFICE_EXTENSIONS = new Set(['.numbers', '.pages', '.key']);

export function getPreviewType(mimeType: string, filename: string): PreviewType {
  const ext = ('.' + filename.split('.').pop()?.toLowerCase()).replace('..', '.');

  // Images
  if (IMAGE_MIMES.has(mimeType) || mimeType.startsWith('image/')) return 'image';

  // PDF
  if (mimeType === 'application/pdf' || ext === '.pdf') return 'pdf';

  // Markdown
  if (ext === '.md' || ext === '.mdx' || mimeType === 'text/markdown') return 'markdown';

  // CSV/TSV
  if (ext === '.csv' || ext === '.tsv' || mimeType === 'text/csv' || mimeType === 'text/tab-separated-values') return 'csv';

  // JSON
  if (ext === '.json' || mimeType === 'application/json' || mimeType === 'text/json') return 'json';

  // Office documents
  if (OFFICE_MIMES.has(mimeType) || OFFICE_EXTENSIONS.has(ext)) return 'office';

  // Code files (check before generic text)
  if (CODE_EXTENSIONS.has(ext)) return 'code';

  // Plain text
  if (ext === '.txt' || ext === '.log' || mimeType.startsWith('text/plain')) return 'text';

  // Other text-ish mimes
  if (mimeType.startsWith('text/')) return 'text';

  return 'unsupported';
}

// ---------------------------------------------------------------------------
// Helper: get file type label
// ---------------------------------------------------------------------------

function getFileTypeLabel(mimeType: string, filename: string): string {
  const ext = filename.split('.').pop()?.toUpperCase() ?? '';
  if (mimeType === 'application/pdf') return 'PDF';
  if (mimeType.startsWith('image/')) return ext || 'Image';
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel') || ext === 'CSV') return ext || 'Spreadsheet';
  if (mimeType.includes('word') || mimeType.includes('document')) return ext || 'Document';
  if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) return ext || 'Presentation';
  if (ext) return ext;
  const sub = mimeType.split('/')[1];
  return sub ? sub.toUpperCase().slice(0, 8) : 'File';
}

function getFileTypeIcon(mimeType: string, filename: string, size: number) {
  const previewType = getPreviewType(mimeType, filename);
  switch (previewType) {
    case 'image': return <ImageSquare size={size} className="text-purple-500" />;
    case 'pdf': return <FilePdf size={size} className="text-red-500" />;
    case 'markdown': return <FileDoc size={size} className="text-blue-500" />;
    case 'csv': return <FileCsv size={size} className="text-emerald-500" />;
    case 'json': return <FileCode size={size} className="text-amber-500" />;
    case 'code': return <FileCode size={size} className="text-amber-500" />;
    case 'text': return <FileText size={size} className="text-blue-500" />;
    case 'office': {
      if (mimeType.includes('spreadsheet') || mimeType.includes('excel') || filename.endsWith('.numbers'))
        return <FileXls size={size} className="text-emerald-500" />;
      if (mimeType.includes('presentation') || mimeType.includes('powerpoint') || filename.endsWith('.key'))
        return <Presentation size={size} className="text-orange-500" />;
      return <FileDoc size={size} className="text-blue-500" />;
    }
    default: return <File size={size} className="text-muted-foreground" />;
  }
}

function getTypeBadgeStyle(previewType: PreviewType): string {
  switch (previewType) {
    case 'image': return 'bg-purple-50 text-purple-600 border-purple-100';
    case 'pdf': return 'bg-red-50 text-red-600 border-red-100';
    case 'markdown': return 'bg-blue-50 text-blue-600 border-blue-100';
    case 'csv': return 'bg-emerald-50 text-emerald-600 border-emerald-100';
    case 'json': return 'bg-amber-50 text-amber-600 border-amber-100';
    case 'code': return 'bg-amber-50 text-amber-600 border-amber-100';
    case 'text': return 'bg-blue-50 text-blue-600 border-blue-100';
    case 'office': return 'bg-sky-50 text-sky-600 border-sky-100';
    default: return 'bg-border/40 text-muted-foreground border-border';
  }
}

// ---------------------------------------------------------------------------
// CSV parser
// ---------------------------------------------------------------------------

function parseCsv(text: string, delimiter = ','): string[][] {
  const rows: string[][] = [];
  let current = '';
  let inQuotes = false;
  let row: string[] = [];

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"' && text[i + 1] === '"') {
        current += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === delimiter) {
        row.push(current);
        current = '';
      } else if (ch === '\n' || (ch === '\r' && text[i + 1] === '\n')) {
        row.push(current);
        current = '';
        if (row.length > 0) rows.push(row);
        row = [];
        if (ch === '\r') i++;
      } else {
        current += ch;
      }
    }
  }
  // Last row
  if (current || row.length > 0) {
    row.push(current);
    rows.push(row);
  }
  return rows;
}

// ---------------------------------------------------------------------------
// Sub-components for each preview type
// ---------------------------------------------------------------------------

function ImagePreview({ url, filename }: { url: string; filename: string }) {
  const [scale, setScale] = useState(1);
  const MIN_SCALE = 0.25;
  const MAX_SCALE = 5;
  const ZOOM_STEP = 1.5;

  return (
    <div className="flex flex-col items-center justify-center h-full w-full gap-3">
      <div className="absolute top-16 right-4 z-10 flex items-center gap-1.5">
        <button
          onClick={() => setScale(s => Math.max(MIN_SCALE, s / ZOOM_STEP))}
          className="p-1.5 rounded-lg bg-card/90 border border-border text-muted-foreground hover:text-foreground transition-colors"
          title="Zoom out"
        >
          <MagnifyingGlassMinus size={16} />
        </button>
        <button
          onClick={() => setScale(1)}
          className="p-1.5 rounded-lg bg-card/90 border border-border text-muted-foreground hover:text-foreground transition-colors"
          title="Reset zoom"
        >
          <ArrowCounterClockwise size={16} />
        </button>
        <button
          onClick={() => setScale(s => Math.min(MAX_SCALE, s * ZOOM_STEP))}
          className="p-1.5 rounded-lg bg-card/90 border border-border text-muted-foreground hover:text-foreground transition-colors"
          title="Zoom in"
        >
          <MagnifyingGlassPlus size={16} />
        </button>
      </div>
      <div className="overflow-auto max-h-full max-w-full flex items-center justify-center">
        <img
          src={url}
          alt={filename}
          className="max-w-[90%] max-h-[calc(100vh-200px)] object-contain transition-transform duration-200 rounded-lg"
          style={{ transform: `scale(${scale})` }}
          onClick={() => setScale(s => Math.min(MAX_SCALE, s * ZOOM_STEP))}
        />
      </div>
    </div>
  );
}

function PdfPreview({ url }: { url: string }) {
  return (
    <iframe
      src={url}
      className="w-full h-full border-0 rounded-lg"
      title="PDF Preview"
    />
  );
}

function MarkdownPreview({ content }: { content: string }) {
  return (
    <div className="max-w-3xl mx-auto w-full p-8 overflow-y-auto">
      <div className="bg-card rounded-2xl border border-border shadow-soft p-8 max-w-none text-foreground [&_h1]:text-3xl [&_h1]:font-bold [&_h1]:mb-4 [&_h1]:mt-6 [&_h1]:leading-tight [&_h2]:text-2xl [&_h2]:font-semibold [&_h2]:mb-3 [&_h2]:mt-5 [&_h2]:leading-tight [&_h3]:text-xl [&_h3]:font-semibold [&_h3]:mb-2 [&_h3]:mt-4 [&_h4]:text-lg [&_h4]:font-medium [&_h4]:mb-2 [&_h4]:mt-3 [&_p]:mb-3 [&_p]:leading-relaxed [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:mb-3 [&_ul]:space-y-1 [&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:mb-3 [&_ol]:space-y-1 [&_li]:leading-relaxed [&_strong]:font-semibold [&_em]:italic [&_code]:bg-border/30 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-[13px] [&_code]:font-mono [&_pre]:bg-sidebar [&_pre]:border [&_pre]:border-border [&_pre]:rounded-xl [&_pre]:p-4 [&_pre]:mb-3 [&_pre]:overflow-x-auto [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_pre_code]:text-sm [&_blockquote]:border-l-4 [&_blockquote]:border-border [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-muted-foreground [&_blockquote]:mb-3 [&_a]:text-blue-500 [&_a]:underline [&_a]:underline-offset-2 [&_hr]:border-border [&_hr]:my-6 [&_table]:w-full [&_table]:border-collapse [&_table]:mb-3 [&_th]:border [&_th]:border-border [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_th]:font-semibold [&_th]:bg-sidebar/50 [&_td]:border [&_td]:border-border [&_td]:px-3 [&_td]:py-2 [&_img]:max-w-full [&_img]:rounded-lg [&_img]:my-3">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
      </div>
    </div>
  );
}

function CsvPreview({ content, filename }: { content: string; filename: string }) {
  const delimiter = filename.endsWith('.tsv') ? '\t' : ',';
  const rows = useMemo(() => parseCsv(content, delimiter), [content, delimiter]);
  const header = rows[0] ?? [];
  const body = rows.slice(1);
  const maxRows = 500;
  const truncated = body.length > maxRows;
  const displayRows = truncated ? body.slice(0, maxRows) : body;

  return (
    <div className="max-w-full overflow-auto p-6">
      <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-sidebar/50">
              {header.map((cell, i) => (
                <th
                  key={i}
                  className="px-4 py-2.5 text-left text-[11px] font-semibold text-muted-foreground/70 uppercase tracking-wider whitespace-nowrap"
                >
                  {cell}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {displayRows.map((row, ri) => (
              <tr
                key={ri}
                className={`border-b border-border/30 last:border-b-0 ${ri % 2 === 1 ? 'bg-sidebar/30' : ''}`}
              >
                {row.map((cell, ci) => (
                  <td key={ci} className="px-4 py-2 text-foreground whitespace-nowrap max-w-[300px] truncate">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {truncated && (
          <div className="px-4 py-2 text-xs text-muted-foreground border-t border-border bg-sidebar/30">
            Showing first {maxRows} of {body.length} rows
          </div>
        )}
      </div>
    </div>
  );
}

function JsonPreview({ content }: { content: string }) {
  const formatted = useMemo(() => {
    try {
      return JSON.stringify(JSON.parse(content), null, 2);
    } catch {
      return content;
    }
  }, [content]);

  return (
    <div className="max-w-4xl mx-auto w-full p-6 overflow-auto">
      <pre className="bg-card border border-border rounded-xl p-6 overflow-x-auto text-sm font-mono leading-relaxed text-foreground whitespace-pre-wrap break-words">
        {formatted}
      </pre>
    </div>
  );
}

function TextPreview({ content, filename }: { content: string; filename: string }) {
  return (
    <div className="max-w-4xl mx-auto w-full p-6 overflow-auto">
      <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
        <div className="flex items-center px-4 py-2 border-b border-border/50 bg-sidebar/30">
          <span className="text-xs text-muted-foreground font-mono">{filename}</span>
        </div>
        <pre className="p-6 overflow-x-auto text-sm font-mono leading-relaxed text-foreground whitespace-pre-wrap break-words">
          {content}
        </pre>
      </div>
    </div>
  );
}

function CodePreview({ content, filename }: { content: string; filename: string }) {
  const lines = content.split('\n');

  return (
    <div className="max-w-4xl mx-auto w-full p-6 overflow-auto">
      <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
        <div className="flex items-center justify-between px-4 py-2 border-b border-border/50 bg-sidebar/30">
          <span className="text-xs text-muted-foreground font-mono">{filename}</span>
          <span className="text-xs text-muted-foreground">{lines.length} lines</span>
        </div>
        <pre className="p-4 overflow-x-auto text-sm font-mono leading-relaxed text-foreground">
          {lines.map((line, i) => (
            <span key={i} className="block">
              <span className="inline-block w-10 text-right select-none text-muted-foreground/40 mr-4 text-xs">
                {i + 1}
              </span>
              {line}
            </span>
          ))}
        </pre>
      </div>
    </div>
  );
}

function OfficeFileCard({
  doc,
  onOpenOnComputer,
  onDownload,
}: {
  doc: Document;
  onOpenOnComputer: () => void;
  onDownload: () => void;
}) {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="bg-card border border-border rounded-2xl p-10 max-w-sm w-full text-center shadow-sm">
        <div className="flex justify-center mb-5">
          {getFileTypeIcon(doc.mimeType, doc.filename, 64)}
        </div>
        <p className="text-lg font-medium text-foreground mb-1 truncate">{doc.filename}</p>
        <p className="text-sm text-muted-foreground mb-1">{getFileTypeLabel(doc.mimeType, doc.filename)}</p>
        <p className="text-sm text-muted-foreground mb-6">{formatFileSize(doc.sizeBytes)}</p>
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={onOpenOnComputer}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-foreground text-background text-sm font-medium hover:bg-[var(--app-cta)] transition-colors shadow-sm"
          >
            <FolderOpen size={16} />
            Open on Computer
          </button>
          <button
            onClick={onDownload}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border bg-card text-foreground text-sm font-medium hover:bg-sidebar/50 transition-colors"
          >
            <DownloadSimple size={16} />
            Download
          </button>
        </div>
      </div>
    </div>
  );
}

function UnsupportedFileCard({
  doc,
  onOpenOnComputer,
  onDownload,
}: {
  doc: Document;
  onOpenOnComputer: () => void;
  onDownload: () => void;
}) {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="bg-card border border-border rounded-2xl p-10 max-w-sm w-full text-center shadow-sm">
        <div className="flex justify-center mb-5">
          <FileArrowDown size={64} className="text-muted-foreground" />
        </div>
        <p className="text-lg font-medium text-foreground mb-1 truncate">{doc.filename}</p>
        <p className="text-sm text-muted-foreground mb-1">{doc.mimeType}</p>
        <p className="text-sm text-muted-foreground mb-6">{formatFileSize(doc.sizeBytes)}</p>
        <p className="text-xs text-muted-foreground mb-6">Preview not available for this file type</p>
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={onOpenOnComputer}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-foreground text-background text-sm font-medium hover:bg-[var(--app-cta)] transition-colors shadow-sm"
          >
            <FolderOpen size={16} />
            Open on Computer
          </button>
          <button
            onClick={onDownload}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border bg-card text-foreground text-sm font-medium hover:bg-sidebar/50 transition-colors"
          >
            <DownloadSimple size={16} />
            Download
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main modal component
// ---------------------------------------------------------------------------

interface DocumentPreviewModalProps {
  document: Document | null;
  documents: Document[];
  onClose: () => void;
  onNavigate: (id: string) => void;
}

export function DocumentPreviewModal({
  document: doc,
  documents,
  onClose,
  onNavigate,
}: DocumentPreviewModalProps) {
  const [textContent, setTextContent] = useState<string | null>(null);
  const [isLoadingContent, setIsLoadingContent] = useState(false);
  const [contentError, setContentError] = useState<string | null>(null);

  const previewType = doc ? getPreviewType(doc.mimeType, doc.filename) : 'unsupported';
  const fileUrl = doc ? getDocumentFileUrl(doc.id) : '';

  // Current index in document list
  const currentIndex = doc ? documents.findIndex(d => d.id === doc.id) : -1;
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex >= 0 && currentIndex < documents.length - 1;

  const goToPrev = useCallback(() => {
    if (hasPrev) onNavigate(documents[currentIndex - 1].id);
  }, [hasPrev, currentIndex, documents, onNavigate]);

  const goToNext = useCallback(() => {
    if (hasNext) onNavigate(documents[currentIndex + 1].id);
  }, [hasNext, currentIndex, documents, onNavigate]);

  const handleDownload = useCallback(() => {
    if (!doc) return;
    const a = window.document.createElement('a');
    a.href = fileUrl;
    a.download = doc.filename;
    a.style.display = 'none';
    window.document.body.appendChild(a);
    a.click();
    window.document.body.removeChild(a);
  }, [doc, fileUrl]);

  const handleOpenOnComputer = useCallback(async () => {
    if (!doc) return;
    try {
      await openDocumentOnComputer(doc.id);
    } catch (err) {
      console.error('Failed to open document on computer:', err);
    }
  }, [doc]);

  // Fetch text content for text-based previews
  useEffect(() => {
    if (!doc) {
      setTextContent(null);
      setContentError(null);
      return;
    }

    const needsContent = ['markdown', 'csv', 'json', 'text', 'code'].includes(previewType);
    if (!needsContent) {
      setTextContent(null);
      setContentError(null);
      return;
    }

    let cancelled = false;
    setIsLoadingContent(true);
    setContentError(null);

    fetchDocumentContent(doc.id)
      .then(content => {
        if (!cancelled) {
          setTextContent(content);
          setIsLoadingContent(false);
        }
      })
      .catch(err => {
        if (!cancelled) {
          setContentError(err.message);
          setIsLoadingContent(false);
        }
      });

    return () => { cancelled = true; };
  }, [doc?.id, previewType]);

  // Keyboard shortcuts
  useEffect(() => {
    if (!doc) return;

    function handleKeyDown(e: KeyboardEvent) {
      // Don't capture if user is typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      switch (e.key) {
        case 'Escape':
          onClose();
          break;
        case 'ArrowLeft':
          goToPrev();
          break;
        case 'ArrowRight':
          goToNext();
          break;
        case 'd':
        case 'D':
          if (!e.metaKey && !e.ctrlKey) handleDownload();
          break;
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [doc, onClose, goToPrev, goToNext, handleDownload]);

  // Lock body scroll when open
  useEffect(() => {
    if (doc) {
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = ''; };
    }
  }, [doc]);

  if (!doc) return null;

  const typeLabel = getFileTypeLabel(doc.mimeType, doc.filename);
  const badgeStyle = getTypeBadgeStyle(previewType);

  // Render preview content
  function renderContent() {
    if (previewType === 'image') {
      return <ImagePreview url={fileUrl} filename={doc!.filename} />;
    }

    if (previewType === 'pdf') {
      return <PdfPreview url={fileUrl} />;
    }

    if (previewType === 'office') {
      return <OfficeFileCard doc={doc!} onOpenOnComputer={handleOpenOnComputer} onDownload={handleDownload} />;
    }

    if (previewType === 'unsupported') {
      return <UnsupportedFileCard doc={doc!} onOpenOnComputer={handleOpenOnComputer} onDownload={handleDownload} />;
    }

    // Text-based previews
    if (isLoadingContent) {
      return (
        <div className="flex items-center justify-center h-full">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-border border-t-foreground rounded-full animate-spin" />
            <p className="text-sm text-muted-foreground">Loading content...</p>
          </div>
        </div>
      );
    }

    if (contentError) {
      return (
        <div className="flex items-center justify-center h-full">
          <div className="text-center space-y-2 max-w-sm">
            <p className="text-sm font-medium text-foreground">Failed to load content</p>
            <p className="text-sm text-muted-foreground">{contentError}</p>
            <button
              onClick={handleOpenOnComputer}
              className="mt-4 flex items-center gap-2 mx-auto px-4 py-2 rounded-lg border border-border bg-card text-foreground text-sm font-medium hover:bg-sidebar/50 transition-colors"
            >
              <FolderOpen size={16} />
              Open on Computer
            </button>
          </div>
        </div>
      );
    }

    if (textContent === null) return null;

    switch (previewType) {
      case 'markdown':
        return <MarkdownPreview content={textContent} />;
      case 'csv':
        return <CsvPreview content={textContent} filename={doc!.filename} />;
      case 'json':
        return <JsonPreview content={textContent} />;
      case 'code':
        return <CodePreview content={textContent} filename={doc!.filename} />;
      case 'text':
        return <TextPreview content={textContent} filename={doc!.filename} />;
      default:
        return null;
    }
  }

  return (
    <div className="fixed inset-0 z-[200] flex flex-col animate-in fade-in duration-150">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal content */}
      <div className="relative z-10 flex flex-col h-full">
        {/* Header */}
        <div className="h-12 flex items-center justify-between px-4 bg-card/95 backdrop-blur-sm border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            {/* Navigation */}
            <button
              onClick={goToPrev}
              disabled={!hasPrev}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-sidebar/50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              title="Previous document (Left arrow)"
            >
              <CaretLeft size={18} />
            </button>
            <button
              onClick={goToNext}
              disabled={!hasNext}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-sidebar/50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              title="Next document (Right arrow)"
            >
              <CaretRight size={18} />
            </button>
          </div>

          {/* Filename (center) */}
          <div className="flex-1 text-center px-4">
            <span className="text-sm font-medium text-foreground truncate block">{doc.filename}</span>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={handleDownload}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-sidebar/50 transition-colors"
              title="Download (D)"
            >
              <DownloadSimple size={16} />
              <span className="hidden sm:inline">Download</span>
            </button>
            <button
              onClick={handleOpenOnComputer}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-sidebar/50 transition-colors"
              title="Open on Computer"
            >
              <FolderOpen size={16} />
              <span className="hidden sm:inline">Open</span>
            </button>
            <div className="w-px h-5 bg-border mx-1" />
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-sidebar/50 transition-colors"
              title="Close (Escape)"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Content area */}
        <div className="flex-1 overflow-auto relative">
          {renderContent()}
        </div>

        {/* Footer */}
        <div className="h-10 flex items-center justify-center gap-3 px-4 bg-card/95 backdrop-blur-sm border-t border-border shrink-0">
          <div className="flex items-center gap-2">
            {getFileTypeIcon(doc.mimeType, doc.filename, 14)}
            <span className="text-xs text-muted-foreground truncate max-w-[200px]">{doc.filename}</span>
          </div>
          <span className="text-xs text-muted-foreground/50">&#183;</span>
          <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium border ${badgeStyle}`}>
            {typeLabel}
          </span>
          <span className="text-xs text-muted-foreground/50">&#183;</span>
          <span className="text-xs text-muted-foreground">{formatFileSize(doc.sizeBytes)}</span>
          <span className="text-xs text-muted-foreground/50">&#183;</span>
          <span className="text-xs text-muted-foreground">{formatRelativeDate(doc.createdAt)}</span>
        </div>
      </div>
    </div>
  );
}
