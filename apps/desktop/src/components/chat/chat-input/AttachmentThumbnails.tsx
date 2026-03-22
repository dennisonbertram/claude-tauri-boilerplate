import { X, FileText } from '@phosphor-icons/react';
import type { AttachedImage } from './types';
import { isImageMatchVisible } from './attachment-utils';

interface AttachmentThumbnailsProps {
  images: AttachedImage[];
  onRemove: (id: string) => void;
}

export function AttachmentThumbnails({ images, onRemove }: AttachmentThumbnailsProps) {
  if (images.length === 0) return null;

  return (
    <div data-testid="image-thumbnails" className="mb-2 flex flex-wrap gap-2 px-2">
      {images.map((img) => {
        const isImage = isImageMatchVisible(img);
        return (
          <div
            key={img.id}
            data-testid={isImage ? 'image-thumbnail' : 'file-attachment-item'}
            className="group relative border rounded-md border-border bg-muted/40"
          >
            {isImage ? (
              <img
                src={img.dataUrl}
                alt={img.name}
                className="h-16 w-16 rounded-md object-cover"
              />
            ) : (
              <div className="flex h-16 w-40 items-center gap-2 px-2 py-1.5 text-sm">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <span className="truncate max-w-28">{img.name}</span>
              </div>
            )}
            <button
              type="button"
              aria-label="Remove attachment"
              onClick={() => onRemove(img.id)}
              className="absolute -top-1.5 -right-1.5 rounded-full bg-destructive text-destructive-foreground p-0.5 opacity-0 transition-opacity group-hover:opacity-100"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
