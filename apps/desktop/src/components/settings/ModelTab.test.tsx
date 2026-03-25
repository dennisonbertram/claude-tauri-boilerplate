import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ModelTab } from './ModelTab';
import { DEFAULT_SETTINGS, type AppSettings } from '@/hooks/useSettings';

function renderSettings(overrides: Partial<AppSettings> = {}) {
  const settings: AppSettings = {
    ...DEFAULT_SETTINGS,
    ...overrides,
  };

  render(<ModelTab settings={settings} updateSettings={() => undefined} />);
}

describe('Settings ModelTab copy for global defaults', () => {
  it('labels model control as a global default', () => {
    renderSettings();

    expect(screen.getByText(/Global default for the next chat run\./)).toBeInTheDocument();
    expect(
      screen.getByText(/Profile settings can override this value\./)
    ).toBeInTheDocument();
  });

  it('labels behavior controls as run-level defaults that profiles can override', () => {
    renderSettings();

    expect(
      screen.getByText(/Default thinking effort for the next chat run\./)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Default thinking effort for the next chat run\.[\s\S]*Profile values can override this default\./)
    ).toBeInTheDocument();
  });
});
