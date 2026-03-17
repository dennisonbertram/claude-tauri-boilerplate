import type { ReactNode } from 'react';
import type { ToolCallBlockProps } from '../ToolCallBlock';

export type GenUIRenderer = (props: ToolCallBlockProps) => ReactNode;

const toolRendererRegistry = new Map<string, GenUIRenderer>();

export function registerToolRenderer(
  name: string,
  renderer: GenUIRenderer
): void {
  toolRendererRegistry.set(name, renderer);
}

export function getToolRenderer(name: string): GenUIRenderer | undefined {
  return toolRendererRegistry.get(name);
}

export function resetToolRenderersForTest(): void {
  toolRendererRegistry.clear();
}
