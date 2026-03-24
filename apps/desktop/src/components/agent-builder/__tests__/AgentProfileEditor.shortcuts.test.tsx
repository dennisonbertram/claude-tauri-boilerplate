import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/react';
import { AgentProfileEditor } from '../AgentProfileEditor';
import type { AgentProfile, UpdateAgentProfileRequest } from '@claude-tauri/shared';

function makeProfile(overrides: Partial<AgentProfile> = {}): AgentProfile {
  return {
    id: 'test-id',
    name: 'Profile from file',
    description: null,
    icon: '🤖',
    color: '#6b7280',
    isDefault: false,
    sortOrder: 0,
    systemPrompt: null,
    useClaudeCodePrompt: true,
    settingSources: [],
    model: null,
    effort: 'medium',
    thinkingBudgetTokens: 10000,
    permissionMode: 'default',
    allowedTools: [],
    disallowedTools: [],
    hooksJson: '',
    hooksCanvasJson: null,
    mcpServersJson: '',
    sandboxJson: '',
    agentsJson: '',
    cwd: null,
    additionalDirectories: [],
    maxTurns: null,
    maxBudgetUsd: null,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

describe('AgentProfileEditor Cmd/Ctrl+S shortcut', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let onSave: any;

  beforeEach(() => {
    onSave = vi.fn().mockResolvedValue(makeProfile());
  });

  it('saves the updated profile and prevents default on Cmd+S', async () => {
    render(
      <AgentProfileEditor
        profile={makeProfile()}
        onSave={async (payload: UpdateAgentProfileRequest) =>
          onSave(payload) as unknown as AgentProfile
        }
        onDelete={async () => undefined}
      />
    );

    const nameInput = screen.getByPlaceholderText('Enter profile name...');
    fireEvent.change(nameInput, { target: { value: 'Updated profile name' } });

    const event = new KeyboardEvent('keydown', { key: 's', metaKey: true });
    const preventDefault = vi.spyOn(event, 'preventDefault');

    document.dispatchEvent(event);

    expect(preventDefault).toHaveBeenCalled();
    expect(onSave).toHaveBeenCalledOnce();
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Updated profile name' })
    );
  });

  it('prevents default even when there are no draft changes', async () => {
    render(
      <AgentProfileEditor
        profile={makeProfile({ name: 'Unchanged' })}
        onSave={async () => makeProfile({ name: 'Unchanged' })}
        onDelete={async () => undefined}
      />
    );

    const event = new KeyboardEvent('keydown', { key: 's', metaKey: true });
    const preventDefault = vi.spyOn(event, 'preventDefault');

    document.dispatchEvent(event);

    expect(preventDefault).toHaveBeenCalled();
  });
});
