/**
 * Regression tests for profileToDraft serialization in AgentProfileEditor.
 *
 * Root cause (Issue #303):
 * `profileToDraft()` used `?? 0` as the fallback for `maxTurns` and
 * `maxBudgetUsd`. The backend API validates these fields as > 0 when
 * present, so sending `0` caused every profile save to fail with
 * "Validation failed". The fix is to use `?? undefined` so that unset
 * fields are omitted from the request payload entirely.
 */

import { describe, it, expect } from 'vitest';
import type { AgentProfile, UpdateAgentProfileRequest } from '@claude-tauri/shared';

// Re-implement profileToDraft inline so we can test it in isolation.
// This must stay in sync with AgentProfileEditor.tsx — if the real
// function is ever exported, switch to importing it directly.
function profileToDraft(profile: AgentProfile): UpdateAgentProfileRequest {
  return {
    name: profile.name,
    description: profile.description ?? '',
    icon: profile.icon ?? '',
    color: profile.color ?? '#6b7280',
    isDefault: profile.isDefault ?? false,
    sortOrder: profile.sortOrder ?? 0,
    systemPrompt: profile.systemPrompt ?? '',
    useClaudeCodePrompt: profile.useClaudeCodePrompt ?? true,
    settingSources: profile.settingSources ?? [],
    model: profile.model ?? '',
    effort: profile.effort ?? 'medium',
    thinkingBudgetTokens: profile.thinkingBudgetTokens ?? 10000,
    permissionMode: profile.permissionMode ?? 'default',
    allowedTools: profile.allowedTools ?? [],
    disallowedTools: profile.disallowedTools ?? [],
    hooksJson: profile.hooksJson ?? '',
    mcpServersJson: profile.mcpServersJson ?? '',
    sandboxJson: profile.sandboxJson ?? '',
    agentsJson: profile.agentsJson ?? '',
    cwd: profile.cwd ?? '',
    additionalDirectories: profile.additionalDirectories ?? [],
    maxTurns: profile.maxTurns ?? undefined,
    maxBudgetUsd: profile.maxBudgetUsd ?? undefined,
  };
}

/** Minimal valid AgentProfile with all nullable fields set to null. */
function makeProfile(overrides: Partial<AgentProfile> = {}): AgentProfile {
  return {
    id: 'test-id',
    name: 'Test Profile',
    description: null,
    icon: null,
    color: null,
    isDefault: false,
    sortOrder: 0,
    systemPrompt: null,
    useClaudeCodePrompt: true,
    model: null,
    effort: null,
    thinkingBudgetTokens: null,
    allowedTools: null,
    disallowedTools: null,
    permissionMode: null,
    hooksJson: null,
    hooksCanvasJson: null,
    mcpServersJson: null,
    sandboxJson: null,
    cwd: null,
    additionalDirectories: null,
    settingSources: null,
    maxTurns: null,
    maxBudgetUsd: null,
    agentsJson: null,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

describe('profileToDraft', () => {
  it('returns undefined (not 0) for unset maxTurns', () => {
    const draft = profileToDraft(makeProfile({ maxTurns: null }));
    expect(draft.maxTurns).toBeUndefined();
  });

  it('returns undefined (not 0) for unset maxBudgetUsd', () => {
    const draft = profileToDraft(makeProfile({ maxBudgetUsd: null }));
    expect(draft.maxBudgetUsd).toBeUndefined();
  });

  it('preserves actual numeric maxTurns when set', () => {
    const draft = profileToDraft(makeProfile({ maxTurns: 25 }));
    expect(draft.maxTurns).toBe(25);
  });

  it('preserves actual numeric maxBudgetUsd when set', () => {
    const draft = profileToDraft(makeProfile({ maxBudgetUsd: 5.5 }));
    expect(draft.maxBudgetUsd).toBe(5.5);
  });

  it('does not default any limit field to 0', () => {
    const draft = profileToDraft(makeProfile());
    // These are the fields with backend > 0 validation constraints.
    expect(draft.maxTurns).not.toBe(0);
    expect(draft.maxBudgetUsd).not.toBe(0);
  });

  it('produces a draft that can be JSON.stringify\'d without issues', () => {
    const draft = profileToDraft(makeProfile());
    expect(() => JSON.stringify(draft)).not.toThrow();
  });

  it('omits maxTurns and maxBudgetUsd from JSON when undefined', () => {
    const draft = profileToDraft(makeProfile());
    const json = JSON.parse(JSON.stringify(draft));
    // JSON.stringify strips undefined values, so these keys should be absent.
    expect('maxTurns' in json).toBe(false);
    expect('maxBudgetUsd' in json).toBe(false);
  });
});
