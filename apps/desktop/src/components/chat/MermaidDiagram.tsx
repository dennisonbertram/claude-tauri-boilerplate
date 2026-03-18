import { useEffect, useRef, useState, useCallback, useId } from 'react';

interface MermaidDiagramProps {
  code: string;
}

type RenderState =
  | { status: 'loading' }
  | { status: 'success'; svg: string }
  | { status: 'error'; message: string };

/**
 * Renders a Mermaid diagram from a string of Mermaid syntax.
 *
 * Features:
 * - Async rendering via mermaid.render()
 * - Loading state while rendering
 * - Error state for invalid syntax
 * - Fullscreen expand button
 * - Pan and zoom in fullscreen modal via CSS transforms
 * - Adapts to dark/light theme via the document root's `dark` class
 */
export function MermaidDiagram({ code }: MermaidDiagramProps) {
  const diagramId = useId().replace(/:/g, '');
  const [renderState, setRenderState] = useState<RenderState>({ status: 'loading' });
  const [isFullscreen, setIsFullscreen] = useState(false);
  const svgContainerRef = useRef<HTMLDivElement>(null);

  // Pan/zoom state for fullscreen mode
  const [scale, setScale] = useState(1);
  const [translate, setTranslate] = useState({ x: 0, y: 0 });
  const isPanning = useRef(false);
  const panStart = useRef({ x: 0, y: 0 });
  const translateStart = useRef({ x: 0, y: 0 });

  useEffect(() => {
    let cancelled = false;

    async function renderDiagram() {
      try {
        // Dynamic import to avoid SSR issues and keep initial bundle smaller
        const mermaid = (await import('mermaid')).default;

        const isDark = document.documentElement.classList.contains('dark');

        mermaid.initialize({
          startOnLoad: false,
          theme: isDark ? 'dark' : 'default',
          securityLevel: 'loose', // needed for unicode and complex labels
          fontFamily: 'inherit',
        });

        const uniqueId = `mermaid-${diagramId}-${Date.now()}`;
        const { svg } = await mermaid.render(uniqueId, code);

        if (!cancelled) {
          setRenderState({ status: 'success', svg });
        }
      } catch (err) {
        if (!cancelled) {
          const message =
            err instanceof Error ? err.message : 'Failed to render diagram';
          setRenderState({ status: 'error', message });
        }
      }
    }

    renderDiagram();

    return () => {
      cancelled = true;
    };
  }, [code, diagramId]);

  const openFullscreen = useCallback(() => {
    setScale(1);
    setTranslate({ x: 0, y: 0 });
    setIsFullscreen(true);
  }, []);

  const closeFullscreen = useCallback(() => {
    setIsFullscreen(false);
  }, []);

  // Keyboard handler for fullscreen modal
  useEffect(() => {
    if (!isFullscreen) return;

    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeFullscreen();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isFullscreen, closeFullscreen]);

  // Pan handlers for fullscreen
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    isPanning.current = true;
    panStart.current = { x: e.clientX, y: e.clientY };
    translateStart.current = { ...translate };
    e.preventDefault();
  }, [translate]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isPanning.current) return;
    const dx = e.clientX - panStart.current.x;
    const dy = e.clientY - panStart.current.y;
    setTranslate({
      x: translateStart.current.x + dx,
      y: translateStart.current.y + dy,
    });
  }, []);

  const handleMouseUp = useCallback(() => {
    isPanning.current = false;
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setScale((prev) => Math.min(Math.max(prev * delta, 0.25), 5));
  }, []);

  const resetView = useCallback(() => {
    setScale(1);
    setTranslate({ x: 0, y: 0 });
  }, []);

  return (
    <>
      <div
        data-testid="mermaid-diagram"
        className="relative my-4 rounded-lg border border-border bg-card overflow-hidden"
      >
        {/* Toolbar */}
        <div className="flex items-center justify-between px-3 py-1.5 border-b border-border bg-muted/50">
          <span className="text-xs text-muted-foreground font-mono">mermaid</span>
          <button
            onClick={openFullscreen}
            aria-label="Expand diagram to fullscreen"
            className="text-xs px-2 py-1 rounded bg-white/10 hover:bg-white/20 transition-colors text-muted-foreground"
          >
            Expand
          </button>
        </div>

        {/* Diagram content */}
        <div className="p-4 flex justify-center overflow-auto">
          {renderState.status === 'loading' && (
            <div className="text-xs text-muted-foreground py-4 animate-pulse">
              Rendering diagram...
            </div>
          )}
          {renderState.status === 'error' && (
            <div
              data-testid="mermaid-error"
              className="text-xs text-destructive py-4 font-mono"
            >
              <span className="font-semibold">Diagram error:</span>{' '}
              {renderState.message}
            </div>
          )}
          {renderState.status === 'success' && (
            <div
              ref={svgContainerRef}
              className="max-w-full overflow-auto"
              // biome-ignore lint/security/noDangerouslySetInnerHtml: mermaid-generated SVG
              dangerouslySetInnerHTML={{ __html: renderState.svg }}
            />
          )}
        </div>
      </div>

      {/* Fullscreen modal */}
      {isFullscreen && renderState.status === 'success' && (
        <div
          className="fixed inset-0 z-50 flex flex-col bg-background/95 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="Mermaid diagram fullscreen view"
        >
          {/* Modal toolbar */}
          <div className="flex items-center justify-between px-4 py-2 border-b border-border shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-mono text-muted-foreground">
                mermaid diagram
              </span>
              <span className="text-xs text-muted-foreground">
                {Math.round(scale * 100)}%
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={resetView}
                className="text-xs px-2 py-1 rounded bg-muted hover:bg-muted/80 transition-colors"
              >
                Reset
              </button>
              <button
                onClick={closeFullscreen}
                aria-label="Close fullscreen"
                className="text-xs px-2 py-1 rounded bg-muted hover:bg-muted/80 transition-colors"
              >
                Close
              </button>
            </div>
          </div>

          {/* Pan/zoom canvas */}
          <div
            className="flex-1 overflow-hidden cursor-grab active:cursor-grabbing select-none"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onWheel={handleWheel}
          >
            <div
              style={{
                transform: `translate(${translate.x}px, ${translate.y}px) scale(${scale})`,
                transformOrigin: 'center center',
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              // biome-ignore lint/security/noDangerouslySetInnerHtml: mermaid-generated SVG
              dangerouslySetInnerHTML={{ __html: renderState.svg }}
            />
          </div>

          {/* Zoom hint */}
          <div className="shrink-0 px-4 py-2 border-t border-border text-xs text-muted-foreground text-center">
            Scroll to zoom · Drag to pan · Esc to close
          </div>
        </div>
      )}
    </>
  );
}
