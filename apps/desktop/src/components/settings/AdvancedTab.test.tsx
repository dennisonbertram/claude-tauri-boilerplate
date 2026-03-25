import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AdvancedTab } from './AdvancedTab';
import { DEFAULT_SETTINGS } from '@/hooks/useSettings';

describe('Settings AdvancedTab precedence copy', () => {
  it('labels permission mode as a global default that profiles can override', () => {
    render(
      <AdvancedTab
        settings={DEFAULT_SETTINGS}
        updateSettings={() => undefined}
      />
    );

    expect(
      screen.getByText(/Global default for how Claude handles actions that need approval\./)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Profile settings can override this value\./)
    ).toBeInTheDocument();
  });
});
