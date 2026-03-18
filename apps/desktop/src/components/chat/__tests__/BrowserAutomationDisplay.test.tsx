import '@testing-library/jest-dom/vitest';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ToolCallBlock } from '../ToolCallBlock';
import type { ToolCallState } from '@/hooks/useStreamEvents';

function makeToolCall(overrides: Partial<ToolCallState> = {}): ToolCallState {
  return {
    toolUseId: 'tool-browser-1',
    name: 'mcp__claude-in-chrome__get_screenshot',
    status: 'complete',
    input: '{"url":"http://localhost:1420/settings"}',
    result: {
      path: '/tmp/settings-page.png',
      caption: 'Settings page screenshot',
    },
    ...overrides,
  };
}

describe('BrowserAutomationDisplay', () => {
  it('renders screenshot previews for browser screenshot tools', () => {
    render(<ToolCallBlock toolCall={makeToolCall()} />);

    expect(screen.getByTestId('browser-automation-action')).toHaveTextContent(
      'Screenshot'
    );
    expect(
      screen.getByTestId('browser-automation-preview-image')
    ).toHaveAttribute('src', '/tmp/settings-page.png');
  });

  it('renders console messages for browser console tools', () => {
    render(
      <ToolCallBlock
        toolCall={makeToolCall({
          name: 'mcp__claude-in-chrome__read_console_messages',
          input: '',
          result: [
            { level: 'error', text: 'Unhandled promise rejection' },
            { level: 'warn', text: 'Deprecated prop' },
          ],
        })}
      />
    );

    expect(screen.getByTestId('browser-automation-action')).toHaveTextContent(
      'Console'
    );
    expect(screen.getByText('Unhandled promise rejection')).toBeInTheDocument();
    expect(screen.getByText('Deprecated prop')).toBeInTheDocument();
  });

  it('renders captured page text for page-reading tools', () => {
    render(
      <ToolCallBlock
        toolCall={makeToolCall({
          name: 'mcp__claude-in-chrome__get_page_text',
          input: '{"includeHidden":false}',
          result: {
            text: 'Settings\nAppearance\nMCP Servers',
          },
        })}
      />
    );

    expect(screen.getByTestId('browser-automation-action')).toHaveTextContent(
      'Read page'
    );
    expect(screen.getByTestId('browser-automation-text')).toHaveTextContent(
      'Appearance'
    );
  });

  it('renders animated recordings for gif capture tools', () => {
    render(
      <ToolCallBlock
        toolCall={makeToolCall({
          name: 'mcp__claude-in-chrome__gif_creator',
          result: {
            gif: '/tmp/chat-flow.gif',
            title: 'Chat flow recording',
          },
        })}
      />
    );

    expect(screen.getByTestId('browser-automation-action')).toHaveTextContent(
      'Recording'
    );
    expect(
      screen.getByTestId('browser-automation-preview-image')
    ).toHaveAttribute('src', '/tmp/chat-flow.gif');
  });
});
