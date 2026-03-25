import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SettingsPanel } from './SettingsPanel';
import { SettingsProvider } from '@/contexts/SettingsContext';

vi.mock('@/components/settings/InstructionsPanel', () => ({
  InstructionsPanel: () => <div>Instructions</div>,
}));

vi.mock('@/components/settings/MemoryPanel', () => ({
  MemoryPanel: () => <div>Memory</div>,
}));

vi.mock('@/components/settings/McpPanel', () => ({
  McpPanel: () => <div>MCP</div>,
}));

vi.mock('@/components/settings/HooksPanel', () => ({
  HooksPanel: () => <div>Hooks</div>,
}));

vi.mock('@/components/settings/LinearPanel', () => ({
  LinearPanel: () => (
    <div>
      <div>Linear Integration</div>
      <button data-testid="linear-connect-button" type="button">
        Connect Linear
      </button>
    </div>
  ),
}));

vi.mock('@/components/settings/GooglePanel', () => ({
  GooglePanel: () => <div>Google Integration</div>,
}));

vi.mock('@/lib/workflowPrompts', async () => {
  const actual = await vi.importActual<typeof import('@/lib/workflowPrompts')>(
    '@/lib/workflowPrompts',
  );
  return {
    ...actual,
    loadRepoWorkflowPrompts: vi.fn().mockResolvedValue({}),
  };
});

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

  test('renders runtime environment controls in General group', () => {
    renderWithProvider(<SettingsPanel {...defaultProps} />);

    expect(screen.getByText('Runtime Environment Variables')).toBeTruthy();
    expect(screen.getByText('No runtime variables configured.')).toBeTruthy();
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

  // ─── Group navigation ───

  test('renders 5 group buttons in sidebar', () => {
    renderWithProvider(<SettingsPanel {...defaultProps} />);

    const tabs = screen.getAllByRole('tab');
    expect(tabs).toHaveLength(5);
    expect(tabs[0].textContent).toBe('General');
    expect(tabs[1].textContent).toBe('AI & Model');
    expect(tabs[2].textContent).toBe('Data & Context');
    expect(tabs[3].textContent).toBe('Integrations');
    expect(tabs[4].textContent).toBe('Status');
  });

  test('shows General group by default with all stacked sections', () => {
    renderWithProvider(<SettingsPanel {...defaultProps} />);
    // General tab content
    expect(screen.getByText('API Key')).toBeTruthy();
    // Appearance tab content (stacked in same group)
    expect(screen.getByText('Theme')).toBeTruthy();
    expect(screen.getByText('Accent Color')).toBeTruthy();
    // Notifications tab content (stacked in same group)
    expect(screen.getByText('Desktop Notifications')).toBeTruthy();
    // Model tab content should NOT be visible
    expect(screen.queryByText('Temperature')).toBeNull();
  });

  test('switches to AI & Model group on click', async () => {
    const user = userEvent.setup();
    renderWithProvider(<SettingsPanel {...defaultProps} />);

    await user.click(screen.getByRole('tab', { name: /ai & model/i }));

    // Model section
    expect(screen.getByText('Temperature')).toBeTruthy();
    expect(screen.getByText('System Prompt')).toBeTruthy();
    expect(screen.getByText('Thinking Effort')).toBeTruthy();
    expect(screen.getByText('Thinking Budget')).toBeTruthy();
    // Advanced section (stacked)
    expect(screen.getByText('Permission Mode')).toBeTruthy();
    expect(screen.getByText('Auto-Compact')).toBeTruthy();
    expect(screen.getByText('Max Turns')).toBeTruthy();
    // Workflows section (stacked)
    expect(screen.getByText('Review Prompt')).toBeTruthy();
    expect(screen.getByText('PR Prompt')).toBeTruthy();
  });

  test('switches to Data & Context group on click', async () => {
    const user = userEvent.setup();
    renderWithProvider(<SettingsPanel {...defaultProps} />);

    await user.click(screen.getByRole('tab', { name: /data & context/i }));

    // Section headers present (use heading role to avoid matching inner content)
    const headings = screen.getAllByRole('heading', { level: 3 });
    const headingTexts = headings.map((h) => h.textContent);
    expect(headingTexts).toContain('Instructions');
    expect(headingTexts).toContain('Memory');
    expect(headingTexts).toContain('MCP');
    expect(headingTexts).toContain('Hooks');
  });

  test('switches to Status group on click and shows resource usage toggle', async () => {
    const user = userEvent.setup();
    renderWithProvider(<SettingsPanel {...defaultProps} />);

    await user.click(screen.getByRole('tab', { name: /status/i }));

    expect(screen.getByText('Account')).toBeTruthy();
    expect(screen.getByTestId('show-resource-usage-toggle')).toBeTruthy();
  });

  test('switches to Integrations group and shows Linear connect controls', async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, json: async () => ({ connected: false }) })) as any
    );

    renderWithProvider(<SettingsPanel {...defaultProps} />);

    await user.click(screen.getByRole('tab', { name: /integrations/i }));

    expect(screen.getByText('Linear Integration')).toBeTruthy();
    expect(screen.getByTestId('linear-connect-button')).toBeTruthy();
  });

  // ─── Deep-link compatibility ───

  test('initialTab="model" opens AI & Model group', () => {
    renderWithProvider(<SettingsPanel {...defaultProps} initialTab="model" />);
    expect(screen.getByText('Temperature')).toBeTruthy();
    expect(screen.getByText('System Prompt')).toBeTruthy();
  });

  test('initialTab="memory" opens Data & Context group', () => {
    renderWithProvider(<SettingsPanel {...defaultProps} initialTab="memory" />);
    const headings = screen.getAllByRole('heading', { level: 3 });
    const headingTexts = headings.map((heading) => heading.textContent);
    expect(headingTexts).toContain('Memory');
    expect(headingTexts).toContain('Instructions');
  });

  test('initialTab="linear" opens Integrations group', () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, json: async () => ({ connected: false }) })) as any
    );
    renderWithProvider(<SettingsPanel {...defaultProps} initialTab="linear" />);
    expect(screen.getByText('Linear Integration')).toBeTruthy();
  });

  // ─── Default values render correctly ───

  test('renders default max tokens value', () => {
    renderWithProvider(<SettingsPanel {...defaultProps} />);
    // Navigate to AI & Model group where the model tab lives
    fireEvent.click(screen.getByRole('tab', { name: /ai & model/i }));
    const slider = screen.getByTestId('max-tokens-slider') as HTMLInputElement;
    expect(slider.value).toBe('4096');
  });

  test('renders default thinking budget tokens value in AI & Model group', () => {
    renderWithProvider(<SettingsPanel {...defaultProps} />);
    fireEvent.click(screen.getByRole('tab', { name: /ai & model/i }));
    const input = screen.getByTestId('thinking-budget-input') as HTMLInputElement;
    expect(input.value).toBe('16000');
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

  test('changing API key persists to credential store', async () => {
    const user = userEvent.setup();
    renderWithProvider(<SettingsPanel {...defaultProps} />);

    const input = screen.getByTestId('api-key-input');
    await user.type(input, 'sk-ant-test-key-123');

    // API key is stored in the secure credential store, not in the main settings blob
    const credStore = JSON.parse(localStorageMock._store['__credential_store'] ?? '{}');
    expect(credStore['api-key']).toBe('sk-ant-test-key-123');
    // Ensure it's NOT in the main settings blob (credential fields are stripped)
    const settings = JSON.parse(localStorageMock._store['claude-tauri-settings']);
    expect(settings.apiKey).toBeUndefined();
  });

  test('changing theme persists to localStorage (visible in General group)', async () => {
    const user = userEvent.setup();
    renderWithProvider(<SettingsPanel {...defaultProps} />);

    // Appearance is stacked in the General group, so theme-select is already visible
    const themeSelect = screen.getByTestId('theme-select');
    await user.selectOptions(themeSelect, 'light');

    const stored = JSON.parse(localStorageMock._store['claude-tauri-settings']);
    expect(stored.theme).toBe('light');
  });

  test('changing accent color and chat presentation persists to localStorage', async () => {
    const user = userEvent.setup();
    renderWithProvider(<SettingsPanel {...defaultProps} />);

    // Appearance controls are in General group (stacked), already visible
    await user.selectOptions(screen.getByTestId('accent-color-select'), 'emerald');
    await user.selectOptions(screen.getByTestId('chat-font-select'), 'mono');
    await user.selectOptions(screen.getByTestId('mono-font-family-select'), 'courier');
    await user.selectOptions(screen.getByTestId('chat-density-select'), 'compact');
    await user.selectOptions(screen.getByTestId('tab-density-select'), 'compact');
    await user.selectOptions(screen.getByTestId('chat-width-select'), 'wide');

    const stored = JSON.parse(localStorageMock._store['claude-tauri-settings']);
    expect(stored.accentColor).toBe('emerald');
    expect(stored.chatFont).toBe('mono');
    expect(stored.monoFontFamily).toBe('courier');
    expect(stored.chatDensity).toBe('compact');
    expect(stored.tabDensity).toBe('compact');
    expect(stored.chatWidth).toBe('wide');
  });

  test('selecting provider updates provider in localStorage', async () => {
    const user = userEvent.setup();
    renderWithProvider(<SettingsPanel {...defaultProps} />);

    const providerSelect = screen.getByTestId('provider-select');
    await user.selectOptions(providerSelect, 'vertex');

    const stored = JSON.parse(localStorageMock._store['claude-tauri-settings']);
    expect(stored.provider).toBe('vertex');
  });

  test('toggling resource usage display persists to localStorage', async () => {
    const user = userEvent.setup();
    renderWithProvider(<SettingsPanel {...defaultProps} />);

    await user.click(screen.getByRole('tab', { name: /status/i }));
    await user.click(screen.getByTestId('show-resource-usage-toggle'));

    const stored = JSON.parse(localStorageMock._store['claude-tauri-settings']);
    expect(stored.showResourceUsage).toBe(true);
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
    await user.click(screen.getByTestId('runtime-env-add-button'));

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
    await user.click(screen.getByTestId('runtime-env-add-button'));

    const envValueInput = screen.getByTestId('runtime-env-value-REMOVE_ME');
    await user.clear(envValueInput);
    await user.type(envValueInput, 'updated');

    let stored = JSON.parse(localStorageMock._store['claude-tauri-settings']);
    expect(stored.runtimeEnv).toEqual({ REMOVE_ME: 'updated' });

    await user.click(screen.getByTestId('runtime-env-remove-REMOVE_ME'));
    stored = JSON.parse(localStorageMock._store['claude-tauri-settings']);
    expect(stored.runtimeEnv).toEqual({});
  });

  test('changing max turns persists to localStorage', async () => {
    renderWithProvider(<SettingsPanel {...defaultProps} />);

    await fireEvent.click(screen.getByRole('tab', { name: /ai & model/i }));

    const input = screen.getByTestId('max-turns-input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '50' } });

    const stored = JSON.parse(localStorageMock._store['claude-tauri-settings']);
    expect(stored.maxTurns).toBe(50);
  });

  test('workspace branch prefix input saves to localStorage', async () => {
    const user = userEvent.setup();
    renderWithProvider(<SettingsPanel {...defaultProps} />);

    await user.click(screen.getByRole('tab', { name: /integrations/i }));
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
