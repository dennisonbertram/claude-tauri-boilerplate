import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SettingsPanel } from './SettingsPanel';
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
    get _store() {
      return store;
    },
  };
})();

Object.defineProperty(window, 'localStorage', { value: localStorageMock });

function renderWithProvider(ui: React.ReactElement) {
  return render(<SettingsProvider>{ui}</SettingsProvider>);
}

describe('SettingsPanel', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
  };

  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  // ─── Panel open/close ───

  test('renders panel when isOpen is true', () => {
    renderWithProvider(<SettingsPanel {...defaultProps} />);
    expect(screen.getByText('Settings')).toBeInTheDocument();
  });

  test('does not render panel content when isOpen is false', () => {
    renderWithProvider(<SettingsPanel {...defaultProps} isOpen={false} />);
    expect(screen.queryByText('Settings')).not.toBeInTheDocument();
  });

  test('calls onClose when close button is clicked', async () => {
    const user = userEvent.setup();
    renderWithProvider(<SettingsPanel {...defaultProps} />);

    const closeButton = screen.getByTestId('settings-close-button');
    await user.click(closeButton);

    expect(defaultProps.onClose).toHaveBeenCalledOnce();
  });

  // ─── Tab navigation ───

  test('shows General tab by default', () => {
    renderWithProvider(<SettingsPanel {...defaultProps} />);
    expect(screen.getByText('API Key')).toBeInTheDocument();
    // Max Tokens and Model are now in the Model tab, not General
    expect(screen.queryByText('Max Tokens')).toBeNull();
  });

  test('switches to Model tab on click', async () => {
    const user = userEvent.setup();
    renderWithProvider(<SettingsPanel {...defaultProps} />);

    await user.click(screen.getByRole('tab', { name: /model/i }));

    expect(screen.getByText('Temperature')).toBeInTheDocument();
    expect(screen.getByText('System Prompt')).toBeInTheDocument();
    expect(screen.getByText('Thinking Effort')).toBeInTheDocument();
  });

  test('switches to Appearance tab on click', async () => {
    const user = userEvent.setup();
    renderWithProvider(<SettingsPanel {...defaultProps} />);

    await user.click(screen.getByRole('tab', { name: /appearance/i }));

    expect(screen.getByText('Theme')).toBeInTheDocument();
    expect(screen.getByText('Font Size')).toBeInTheDocument();
    expect(screen.getByText('Show Thinking')).toBeInTheDocument();
    expect(screen.getByText('Show Tool Calls')).toBeInTheDocument();
  });

  test('switches to Advanced tab on click', async () => {
    const user = userEvent.setup();
    renderWithProvider(<SettingsPanel {...defaultProps} />);

    await user.click(screen.getByRole('tab', { name: /advanced/i }));

    expect(screen.getByText('Permission Mode')).toBeInTheDocument();
    expect(screen.getByText('Auto-Compact')).toBeInTheDocument();
    expect(screen.getByText('Max Turns')).toBeInTheDocument();
  });

  // ─── Default values render correctly ───

  test('renders default max tokens value', () => {
    renderWithProvider(<SettingsPanel {...defaultProps} />);
    // max-tokens-slider is now in the Model tab
    fireEvent.click(screen.getByRole('tab', { name: 'Model' }));
    const slider = screen.getByTestId('max-tokens-slider') as HTMLInputElement;
    expect(slider.value).toBe('4096');
  });

  // ─── API key masking ───

  test('API key input is masked by default', () => {
    renderWithProvider(<SettingsPanel {...defaultProps} />);
    const input = screen.getByTestId('api-key-input') as HTMLInputElement;
    expect(input.type).toBe('password');
  });

  test('API key can be toggled to visible', async () => {
    const user = userEvent.setup();
    renderWithProvider(<SettingsPanel {...defaultProps} />);

    const toggleButton = screen.getByTestId('api-key-toggle');
    await user.click(toggleButton);

    const input = screen.getByTestId('api-key-input') as HTMLInputElement;
    expect(input.type).toBe('text');
  });

  test('API key visibility toggle switches back to masked', async () => {
    const user = userEvent.setup();
    renderWithProvider(<SettingsPanel {...defaultProps} />);

    const toggleButton = screen.getByTestId('api-key-toggle');
    await user.click(toggleButton); // show
    await user.click(toggleButton); // hide again

    const input = screen.getByTestId('api-key-input') as HTMLInputElement;
    expect(input.type).toBe('password');
  });

  // ─── Settings persistence to localStorage ───

  test('changing API key persists to localStorage', async () => {
    const user = userEvent.setup();
    renderWithProvider(<SettingsPanel {...defaultProps} />);

    const input = screen.getByTestId('api-key-input');
    await user.type(input, 'sk-ant-test-key-123');

    const stored = JSON.parse(localStorageMock._store['claude-tauri-settings']);
    expect(stored.apiKey).toBe('sk-ant-test-key-123');
  });

  test('changing theme persists to localStorage', async () => {
    const user = userEvent.setup();
    renderWithProvider(<SettingsPanel {...defaultProps} />);

    await user.click(screen.getByRole('tab', { name: /appearance/i }));

    const themeSelect = screen.getByTestId('theme-select');
    await user.selectOptions(themeSelect, 'light');

    const stored = JSON.parse(localStorageMock._store['claude-tauri-settings']);
    expect(stored.theme).toBe('light');
  });

  test('changing max turns persists to localStorage', async () => {
    renderWithProvider(<SettingsPanel {...defaultProps} />);

    await fireEvent.click(screen.getByRole('tab', { name: /advanced/i }));

    const input = screen.getByTestId('max-turns-input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '50' } });

    const stored = JSON.parse(localStorageMock._store['claude-tauri-settings']);
    expect(stored.maxTurns).toBe(50);
  });

  // ─── Overlay click closes panel ───

  test('clicking overlay calls onClose', async () => {
    const user = userEvent.setup();
    renderWithProvider(<SettingsPanel {...defaultProps} />);

    const overlay = screen.getByTestId('settings-overlay');
    await user.click(overlay);

    expect(defaultProps.onClose).toHaveBeenCalledOnce();
  });
});
