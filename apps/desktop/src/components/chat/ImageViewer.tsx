import { useState, useCallback, useEffect } from 'react';
import { X, MagnifyingGlassPlus, MagnifyingGlassMinus, ArrowCounterClockwise } from '@phosphor-icons/react';

interface ImageViewerProps {
  src: string;
  alt: string;
}

const MIN_SCALE = 0.25;
const MAX_SCALE = 5;
const ZOOM_STEP = 1.5;

export function ImageViewer({ src, alt }: ImageViewerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [scale, setScale] = useState(1);

  const open = useCallback(() => {
    setScale(1);
    setIsOpen(true);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
    setScale(1);
  }, []);

  const zoomIn = useCallback(() => {
    setScale((s) => Math.min(MAX_SCALE, s * ZOOM_STEP));
  }, []);

  const zoomOut = useCallback(() => {
    setScale((s) => Math.max(MIN_SCALE, s / ZOOM_STEP));
  }, []);

  const resetZoom = useCallback(() => {
    setScale(1);
  }, []);

  // Handle Escape key to close lightbox
  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        close();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, close]);

  return (
    <>
      {/* Inline thumbnail */}
      <img
        src={src}
        alt={alt}
        loading="lazy"
        onClick={open}
        className="max-w-full h-auto rounded-lg my-3 cursor-zoom-in hover:opacity-90 transition-opacity"
      />

      {/* Lightbox overlay */}
      {isOpen && (
        <div
          data-testid="image-lightbox-overlay"
          className="fixed inset-0 z-50 flex items-center justify-center"
        >
          {/* Dark backdrop */}
          <div
            data-testid="image-lightbox-backdrop"
            className="absolute inset-0 bg-black/80"
            onClick={close}
          />

          {/* Controls bar at top */}
          <div className="absolute top-4 right-4 z-10 flex items-center gap-2">
            <button
              onClick={zoomOut}
              aria-label="Zoom out"
              className="rounded-full bg-white/10 hover:bg-white/20 p-2 text-white transition-colors"
            >
              <MagnifyingGlassMinus className="h-5 w-5" />
            </button>
            <button
              onClick={resetZoom}
              aria-label="Reset zoom"
              className="rounded-full bg-white/10 hover:bg-white/20 p-2 text-white transition-colors"
            >
              <ArrowCounterClockwise className="h-5 w-5" />
            </button>
            <button
              onClick={zoomIn}
              aria-label="Zoom in"
              className="rounded-full bg-white/10 hover:bg-white/20 p-2 text-white transition-colors"
            >
              <MagnifyingGlassPlus className="h-5 w-5" />
            </button>
            <button
              onClick={close}
              aria-label="Close lightbox"
              className="rounded-full bg-white/10 hover:bg-white/20 p-2 text-white transition-colors ml-2"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Full-size image */}
          <div className="relative z-[1] max-w-[90vw] max-h-[90vh] overflow-auto">
            <img
              src={src}
              alt={alt}
              className="max-w-none transition-transform duration-200"
              style={{ transform: `scale(${scale})` }}
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}
    </>
  );
}
