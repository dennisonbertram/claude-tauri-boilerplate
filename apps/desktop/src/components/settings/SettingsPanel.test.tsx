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
    expect(screen.getByText('Settings')).toBeTruthy();
  });

  test('shows provider selector with default of anthropic', () => {
    renderWithProvider(<SettingsPanel {...defaultProps} />);

    const providerSelect = screen.getByTestId('provider-select') as HTMLSelectElement;
    expect(providerSelect.value).toBe('anthropic');
  });

  test('renders runtime environment controls in General tab', () => {
    renderWithProvider(<SettingsPanel {...defaultProps} />);

    expect(screen.getByText('Runtime Environment Variables')).toBeTruthy();
    expect(screen.getByText('No environment variables configured.')).toBeTruthy();
  });

  test('does not render panel content when isOpen is false', () => {
    renderWithProvider(<SettingsPanel {...defaultProps} isOpen={false} />);
    expect(screen.queryByText('Settings')).toBeNull();
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
    expect(screen.getByText('API Key')).toBeTruthy();
    // Max Tokens and Model are now in the Model tab, not General
    expect(screen.queryByText('Max Tokens')).toBeNull();
  });

  test('switches to Model tab on click', async () => {
    const user = userEvent.setup();
    renderWithProvider(<SettingsPanel {...defaultProps} />);

    await user.click(screen.getByRole('tab', { name: /model/i }));

    expect(screen.getByText('Temperature')).toBeTruthy();
    expect(screen.getByText('System Prompt')).toBeTruthy();
    expect(screen.getByText('Thinking Effort')).toBeTruthy();
  });

  test('switches to Appearance tab on click', async () => {
    const user = userEvent.setup();
    renderWithProvider(<SettingsPanel {...defaultProps} />);

    await user.click(screen.getByRole('tab', { name: /appearance/i }));

    expect(screen.getByText('Theme')).toBeTruthy();
    expect(screen.getByText('Font Size')).toBeTruthy();
    expect(screen.getByText('Show Thinking')).toBeTruthy();
    expect(screen.getByText('Show Tool Calls')).toBeTruthy();
  });

  test('switches to Workflows tab on click', async () => {
    const user = userEvent.setup();
    renderWithProvider(<SettingsPanel {...defaultProps} />);

    await user.click(screen.getByRole('tab', { name: /workflows/i }));

    expect(screen.getByText('Review Prompt')).toBeInTheDocument();
    expect(screen.getByText('PR Prompt')).toBeInTheDocument();
    expect(screen.getByText('Branch Naming Prompt')).toBeInTheDocument();
    expect(screen.getByText('Browser Testing Prompt')).toBeInTheDocument();
    expect(screen.getByTestId('workflow-prompts-save')).toBeInTheDocument();
  });

  test('switches to Advanced tab on click', async () => {
    const user = userEvent.setup();
    renderWithProvider(<SettingsPanel {...defaultProps} />);

    await user.click(screen.getByRole('tab', { name: /advanced/i }));

    expect(screen.getByText('Permission Mode')).toBeTruthy();
    expect(screen.getByText('Auto-Compact')).toBeTruthy();
    expect(screen.getByText('Max Turns')).toBeTruthy();
  });

  test('switches to Linear tab on click and shows connect controls', async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, json: async () => ({ connected: false }) })) as any
    );

    renderWithProvider(<SettingsPanel {...defaultProps} />);

    await user.click(screen.getByRole('tab', { name: /linear/i }));

    expect(screen.getByText('Linear Integration')).toBeTruthy();
    expect(screen.getByTestId('linear-connect-button')).toBeTruthy();
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

  test('selecting provider updates provider in localStorage', async () => {
    const user = userEvent.setup();
    renderWithProvider(<SettingsPanel {...defaultProps} />);

    const providerSelect = screen.getByTestId('provider-select');
    await user.selectOptions(providerSelect, 'vertex');

    const stored = JSON.parse(localStorageMock._store['claude-tauri-settings']);
    expect(stored.provider).toBe('vertex');
  });

  test('shows and saves Bedrock fields when Bedrock is selected', async () => {
    const user = userEvent.setup();
    renderWithProvider(<SettingsPanel {...defaultProps} />);

    await user.selectOptions(screen.getByTestId('provider-select'), 'bedrock');

    const baseUrlInput = screen.getByTestId('provider-bedrock-base-url');
    await user.type(baseUrlInput, 'https://bedrock.internal');

    const stored = JSON.parse(localStorageMock._store['claude-tauri-settings']);
    expect(stored.bedrockBaseUrl).toBe('https://bedrock.internal');
  });

  test('shows and saves Vertex fields when Vertex is selected', async () => {
    const user = userEvent.setup();
    renderWithProvider(<SettingsPanel {...defaultProps} />);

    await user.selectOptions(screen.getByTestId('provider-select'), 'vertex');

    const projectIdInput = screen.getByTestId('provider-vertex-project-id');
    const baseUrlInput = screen.getByTestId('provider-vertex-base-url');
    await user.type(projectIdInput, 'gcp-project');
    await user.type(baseUrlInput, 'https://vertex.internal');

    const stored = JSON.parse(localStorageMock._store['claude-tauri-settings']);
    expect(stored.vertexProjectId).toBe('gcp-project');
    expect(stored.vertexBaseUrl).toBe('https://vertex.internal');
  });

  test('shows and saves custom base URL when Custom is selected', async () => {
    const user = userEvent.setup();
    renderWithProvider(<SettingsPanel {...defaultProps} />);

    await user.selectOptions(screen.getByTestId('provider-select'), 'custom');

    const customUrlInput = screen.getByTestId('provider-custom-base-url');
    await user.type(customUrlInput, 'https://gateway.internal');

    const stored = JSON.parse(localStorageMock._store['claude-tauri-settings']);
    expect(stored.customBaseUrl).toBe('https://gateway.internal');
  });

  test('adds and persists a runtime env variable', async () => {
    const user = userEvent.setup();
    renderWithProvider(<SettingsPanel {...defaultProps} />);

    const keyInput = screen.getByTestId('runtime-env-key-input');
    const valueInput = screen.getByTestId('runtime-env-value-input');
    await user.type(keyInput, 'RUNTIME_TOKEN');
    await user.type(valueInput, 'abc123');
    await user.click(screen.getByTestId('runtime-env-add'));

    const stored = JSON.parse(localStorageMock._store['claude-tauri-settings']);
    expect(stored.runtimeEnv).toEqual({ RUNTIME_TOKEN: 'abc123' });
  });

  test('edits and removes a runtime env variable', async () => {
    const user = userEvent.setup();
    renderWithProvider(<SettingsPanel {...defaultProps} />);

    const keyInput = screen.getByTestId('runtime-env-key-input');
    const valueInput = screen.getByTestId('runtime-env-value-input');
    await user.type(keyInput, 'REMOVE_ME');
    await user.type(valueInput, 'to-remove');
    await user.click(screen.getByTestId('runtime-env-add'));

    const envValueInput = screen.getByTestId('runtime-env-value-0');
    await user.clear(envValueInput);
    await user.type(envValueInput, 'updated');

    let stored = JSON.parse(localStorageMock._store['claude-tauri-settings']);
    expect(stored.runtimeEnv).toEqual({ REMOVE_ME: 'updated' });

    await user.click(screen.getByTestId('runtime-env-remove-0'));
    stored = JSON.parse(localStorageMock._store['claude-tauri-settings']);
    expect(stored.runtimeEnv).toEqual({});
  });

  test('changing max turns persists to localStorage', async () => {
    renderWithProvider(<SettingsPanel {...defaultProps} />);

    await fireEvent.click(screen.getByRole('tab', { name: /advanced/i }));

    const input = screen.getByTestId('max-turns-input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '50' } });

    const stored = JSON.parse(localStorageMock._store['claude-tauri-settings']);
    expect(stored.maxTurns).toBe(50);
  });

  test('workspace branch prefix input saves to localStorage', async () => {
    const user = userEvent.setup();
    renderWithProvider(<SettingsPanel {...defaultProps} />);

    await user.click(screen.getByRole('tab', { name: /git/i }));
    const prefixInput = screen.getByTestId('workspace-branch-prefix-input');
    await user.clear(prefixInput);
    await user.type(prefixInput, 'feature');

    const stored = JSON.parse(localStorageMock._store['claude-tauri-settings']);
    expect(stored.workspaceBranchPrefix).toBe('feature');
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
