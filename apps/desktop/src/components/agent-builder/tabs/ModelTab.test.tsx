import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ModelTab } from './ModelTab';
import type { UpdateAgentProfileRequest } from '@claude-tauri/shared';

describe('Profile ModelTab copy for overrides', () => {
  it('labels the model picker as a profile override', () => {
    render(
      <ModelTab
        draft={{} as UpdateAgentProfileRequest}
        onChange={() => undefined}
      />
    );

    expect(
      screen.getByText(/This profile override is used when this profile is active\./)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Leave empty to use global defaults\./)
    ).toBeInTheDocument();
  });

  it('labels behavior controls as profile overrides', () => {
    const draft: UpdateAgentProfileRequest = {
      model: '',
      effort: 'medium',
      thinkingBudgetTokens: 10000,
    };

    render(<ModelTab draft={draft} onChange={() => undefined} />);

    expect(
      screen.getByText(/Profile controls are overrides for this chat run\./)
    ).toBeInTheDocument();
  });
});
