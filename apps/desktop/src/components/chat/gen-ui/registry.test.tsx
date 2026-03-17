import { afterEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ToolCallBlock } from '../ToolCallBlock';
import type { ToolCallState } from '@/hooks/useStreamEvents';
import {
  getToolRenderer,
  registerToolRenderer,
  resetToolRenderersForTest,
} from './registry';

function makeToolCall(overrides: Partial<ToolCallState> = {}): ToolCallState {
  return {
    toolUseId: 'tool-1',
    name: 'CustomTool',
    status: 'complete',
    input: '{"query":"abc"}',
    result: 'done',
    ...overrides,
  };
}

afterEach(() => {
  resetToolRenderersForTest();
});

describe('gen-ui registry', () => {
  it('registers and looks up renderers by tool name', () => {
    const renderer = () => <div data-testid="custom-renderer">Custom</div>;

    registerToolRenderer('CustomTool', renderer);

    expect(getToolRenderer('CustomTool')).toBe(renderer);
  });

  it('returns undefined for unknown tool names', () => {
    expect(getToolRenderer('UnknownTool')).toBeUndefined();
  });

  it('allows ToolCallBlock to render a registered renderer', () => {
    registerToolRenderer('CustomTool', ({ toolCall }) => (
      <div data-testid="custom-renderer">{toolCall.name}</div>
    ));

    render(<ToolCallBlock toolCall={makeToolCall()} />);

    expect(screen.getByTestId('custom-renderer')).toHaveTextContent('CustomTool');
  });

  it('falls back to the generic tool block when no renderer is registered', () => {
    render(
      <ToolCallBlock
        toolCall={makeToolCall({ name: 'UnknownTool', summary: 'Some summary' })}
      />
    );

    expect(screen.getByText('UnknownTool')).toBeInTheDocument();
    expect(screen.getByText('Some summary')).toBeInTheDocument();
  });
});
