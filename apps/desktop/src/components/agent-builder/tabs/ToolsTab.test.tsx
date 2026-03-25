import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ToolsTab } from './ToolsTab';
import type { UpdateAgentProfileRequest } from '@claude-tauri/shared';

describe('Profile ToolsTab precedence copy', () => {
  it('labels permission mode as a profile override', () => {
    render(
      <ToolsTab
        draft={{ permissionMode: 'default' } as UpdateAgentProfileRequest}
        onChange={() => undefined}
      />
    );

    expect(
      screen.getByText(/This profile overrides the global permission mode while it is active\./)
    ).toBeInTheDocument();
  });
});
