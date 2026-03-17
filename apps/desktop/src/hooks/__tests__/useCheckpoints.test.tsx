import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, act } from '@testing-library/react';
import type { ToolCallState } from '../useStreamEvents';
import { useCheckpoints } from '../useCheckpoints';

function Harness(props: {
  sessionId: string | null;
  toolCalls: Map<string, ToolCallState>;
  lastUserPrompt: string;
  userMessageId: string;
  isStreaming: boolean;
}) {
  useCheckpoints(props);
  return null;
}

describe('useCheckpoints', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock as any);
  });

  it('creates a checkpoint when a turn finishes even if there were no file changes', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ checkpoints: [] }) });
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: 'cp-1',
        userMessageId: 'user-1',
        promptPreview: 'Hello',
        timestamp: new Date().toISOString(),
        filesChanged: [],
        turnIndex: 0,
        gitCommit: null,
        messageCount: 2,
      }),
    });

    const { rerender } = render(
      <Harness
        sessionId="s1"
        toolCalls={new Map()}
        lastUserPrompt="Hello"
        userMessageId="user-1"
        isStreaming={true}
      />
    );

    await act(async () => {
      rerender(
        <Harness
          sessionId="s1"
          toolCalls={new Map()}
          lastUserPrompt="Hello"
          userMessageId="user-1"
          isStreaming={false}
        />
      );
    });

    const postCall = fetchMock.mock.calls.find((c) =>
      String(c[0]).includes('/api/sessions/s1/checkpoints') && c[1]?.method === 'POST'
    );
    expect(postCall).toBeTruthy();
    const body = JSON.parse(postCall![1].body);
    expect(body).toMatchObject({
      userMessageId: 'user-1',
      promptPreview: 'Hello',
      filesChanged: [],
    });
  });

  it('includes inferred file changes from completed tool calls when creating the checkpoint', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ checkpoints: [] }) });
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: 'cp-2',
        userMessageId: 'user-2',
        promptPreview: 'Change a file',
        timestamp: new Date().toISOString(),
        filesChanged: [{ path: 'src/a.ts', action: 'modified', tool: 'Edit' }],
        turnIndex: 1,
        gitCommit: 'abc',
        messageCount: 2,
      }),
    });

    const toolCalls = new Map<string, ToolCallState>([
      [
        'tc-1',
        {
          id: 'tc-1',
          name: 'Edit',
          input: JSON.stringify({ file_path: 'src/a.ts' }),
          status: 'complete',
        } as any,
      ],
    ]);

    const { rerender } = render(
      <Harness
        sessionId="s1"
        toolCalls={toolCalls}
        lastUserPrompt="Change a file"
        userMessageId="user-2"
        isStreaming={true}
      />
    );

    await act(async () => {
      rerender(
        <Harness
          sessionId="s1"
          toolCalls={toolCalls}
          lastUserPrompt="Change a file"
          userMessageId="user-2"
          isStreaming={false}
        />
      );
    });

    const postCall = fetchMock.mock.calls.find((c) =>
      String(c[0]).includes('/api/sessions/s1/checkpoints') && c[1]?.method === 'POST'
    );
    expect(postCall).toBeTruthy();
    const body = JSON.parse(postCall![1].body);
    expect(body.filesChanged).toEqual([{ path: 'src/a.ts', action: 'modified', tool: 'Edit' }]);
  });
});
