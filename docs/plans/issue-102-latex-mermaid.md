# Issue #102: LaTeX Rendering and Mermaid Diagram Support

**Status**: Completed 2026-03-18

## What and Why

Add LaTeX math rendering and Mermaid diagram support to chat messages in the desktop app. Claude frequently outputs mathematical notation and architecture diagrams; without rendering these look like raw syntax.

## Acceptance Criteria

- [x] LaTeX rendering in chat messages (inline `$...$` and block `$$...$$`)
- [x] Mermaid diagram rendering in chat
- [x] Mermaid diagrams support pan and zoom when expanded
- [x] Expand Mermaid diagrams to fullscreen
- [x] Diagrams adapt to app theme (dark/light)
- [x] Unicode support in Mermaid diagrams
- [ ] Copy rendered tables as markdown (low priority, not implemented)

## Implementation

### Dependencies Added

- `katex` - KaTeX math rendering engine
- `remark-math` - remark plugin to parse `$` and `$$` math nodes
- `rehype-katex` - rehype plugin to render math nodes with KaTeX
- `mermaid` - Mermaid diagram rendering library
- `@types/katex` - TypeScript types for KaTeX

### Files Changed

- `apps/desktop/package.json` - Added dependencies
- `apps/desktop/src/components/chat/MarkdownRenderer.tsx` - Added `remarkMath`, `rehypeKatex`, `katex/dist/katex.min.css` import, and mermaid detection in `pre`/`code` renderers
- `apps/desktop/src/components/chat/MermaidDiagram.tsx` - New component with async rendering, loading/error states, fullscreen modal, pan/zoom

### Files Created

- `apps/desktop/src/components/chat/MermaidDiagram.tsx`
- `apps/desktop/src/components/chat/__tests__/MarkdownRendererLatexMermaid.test.tsx` (13 tests)
- `docs/plans/issue-102-latex-mermaid.md` (this file)

## Test Results

13 new tests, all passing. 1109 total tests passing with no regressions.
