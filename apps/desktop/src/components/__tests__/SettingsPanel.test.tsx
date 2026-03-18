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

function getLastStoredSettings() {
  const lastCall = localStorageMock.setItem.mock.calls.at(-1);
  if (!lastCall) {
    return null;
  }
  return JSON.parse(lastCall[1]) as { runtimeEnv?: Record<string, string> };
}

describe('SettingsPanel runtime env', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
  };

  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  it('adds and persists a runtime environment variable', () => {
    renderWithProvider(<SettingsPanel {...defaultProps} />);

    const keyInput = screen.getByTestId('runtime-env-key-input');
    const valueInput = screen.getByTestId('runtime-env-value-input');
    const addButton = screen.getByTestId('runtime-env-add-button');

    fireEvent.change(keyInput, { target: { value: 'RUNTIME_TOKEN' } });
    fireEvent.change(valueInput, { target: { value: 'abc123' } });
    fireEvent.click(addButton);

    const saved = getLastStoredSettings();
    expect(saved?.runtimeEnv).toEqual({ RUNTIME_TOKEN: 'abc123' });
  });

  it('edits an existing runtime environment variable', () => {
    localStorageMock.setItem(
      'claude-tauri-settings',
      JSON.stringify({
        runtimeEnv: {
          RUNTIME_TOKEN: 'abc123',
        },
      })
    );

    renderWithProvider(<SettingsPanel {...defaultProps} />);

    const valueInput = screen.getByTestId('runtime-env-value-RUNTIME_TOKEN');
    fireEvent.change(valueInput, { target: { value: 'def456' } });

    const saved = getLastStoredSettings();
    expect(saved?.runtimeEnv).toEqual({ RUNTIME_TOKEN: 'def456' });
  });

  it('removes an existing runtime environment variable', async () => {
    localStorageMock.setItem(
      'claude-tauri-settings',
      JSON.stringify({
        runtimeEnv: {
          RUNTIME_TOKEN: 'abc123',
          FEATURE_FLAG: 'enabled',
        },
      })
    );

    renderWithProvider(<SettingsPanel {...defaultProps} />);

    const removeButton = await screen.findByTestId('runtime-env-remove-RUNTIME_TOKEN');
    fireEvent.click(removeButton);

    const saved = getLastStoredSettings();
    expect(saved?.runtimeEnv).toEqual({ FEATURE_FLAG: 'enabled' });
  });
});
