import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SettingsPanel } from '../settings/SettingsPanel';
import { SettingsProvider } from '@/contexts/SettingsContext';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
  };
})();

Object.defineProperty(window, 'localStorage', { value: localStorageMock });

function renderWithProvider(ui: React.ReactElement) {
  return render(<SettingsProvider>{ui}</SettingsProvider>);
}

const defaultProps = {
  isOpen: true,
  onClose: vi.fn(),
};

describe('Settings model selector (#119)', () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  it('renders model selector with correct options', () => {
    renderWithProvider(<SettingsPanel {...defaultProps} />);

    const select = screen.getByTestId('model-select');
    expect(select).toBeInTheDocument();

    const options = Array.from(select.querySelectorAll('option')).map(
      (o) => (o as HTMLOptionElement).value,
    );
    expect(options).toContain('claude-sonnet-4-6');
    expect(options).toContain('claude-opus-4-6');
    expect(options).toContain('claude-haiku-4-5-20251001');
  });

  it('default selected model is claude-sonnet-4-6', () => {
    renderWithProvider(<SettingsPanel {...defaultProps} />);

    const select = screen.getByTestId('model-select') as HTMLSelectElement;
    expect(select.value).toBe('claude-sonnet-4-6');
  });

  it('changing model calls updateSettings with new value', () => {
    renderWithProvider(<SettingsPanel {...defaultProps} />);

    const select = screen.getByTestId('model-select');
    fireEvent.change(select, { target: { value: 'claude-opus-4-6' } });

    // After changing, the stored settings should have the new model
    const saved = localStorageMock.setItem.mock.calls.find(([key]) =>
      key === 'claude-tauri-settings',
    );
    expect(saved).toBeDefined();
    const savedSettings = JSON.parse(saved![1]);
    expect(savedSettings.model).toBe('claude-opus-4-6');
  });

  it('model selector is in the General tab, not the Model tab', () => {
    renderWithProvider(<SettingsPanel {...defaultProps} />);

    // General tab is active by default — model-select should be visible
    expect(screen.getByTestId('model-select')).toBeInTheDocument();

    // Switch to the Model tab
    fireEvent.click(screen.getByRole('tab', { name: 'Model' }));

    // model-select should no longer be present (it lives in General tab only)
    expect(screen.queryByTestId('model-select')).not.toBeInTheDocument();
  });
});
