import { useState, useCallback, type DragEvent } from 'react';
import { CloudArrowUp } from '@phosphor-icons/react';

interface DocumentUploadZoneProps {
  onUpload: (files: File[]) => void;
  children: React.ReactNode;
}

export function DocumentUploadZone({ onUpload, children }: DocumentUploadZoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const dragCounterRef = { current: 0 };

  const handleDragEnter = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current += 1;
    if (e.dataTransfer?.types.includes('Files')) {
      setIsDragOver(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current -= 1;
    if (dragCounterRef.current === 0) {
      setIsDragOver(false);
    }
  }, []);

  const handleDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    dragCounterRef.current = 0;

    const files: File[] = [];
    if (e.dataTransfer?.files) {
      for (let i = 0; i < e.dataTransfer.files.length; i++) {
        const file = e.dataTransfer.files[i];
        if (file) files.push(file);
      }
    }
    if (files.length > 0) {
      onUpload(files);
    }
  }, [onUpload]);

  return (
    <div
      className="relative flex-1 min-h-0 flex flex-col overflow-hidden"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {children}

      {isDragOver && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-4 p-8 rounded-2xl border-2 border-dashed border-foreground/30 bg-card/90">
            <CloudArrowUp size={48} className="text-foreground/60" />
            <div className="text-center">
              <p className="text-lg font-medium text-foreground">Drop files to upload</p>
              <p className="text-sm text-muted-foreground">Release to add documents</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
