import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
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

describe('SettingsPanel tabs overflow fix (#118)', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
  };

  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  it('renders all tabs', () => {
    renderWithProvider(<SettingsPanel {...defaultProps} />);

    const expectedTabs = [
      'General',
      'Git',
      'Model',
      'Workflows',
      'Appearance',
      'Instructions',
      'Memory',
      'MCP',
      'Linear',
      'Hooks',
      'Advanced',
      'Status',
    ];

    for (const label of expectedTabs) {
      expect(screen.getByRole('tab', { name: label })).toBeInTheDocument();
    }
  });

  it('renders exactly 12 tabs', () => {
    renderWithProvider(<SettingsPanel {...defaultProps} />);
    const tabs = screen.getAllByRole('tab');
    expect(tabs).toHaveLength(12);
  });

  it('tab container has flex-wrap class', () => {
    renderWithProvider(<SettingsPanel {...defaultProps} />);
    const tablist = screen.getByRole('tablist');
    expect(tablist.className).toContain('flex-wrap');
  });

  it('tab container does NOT have overflow-x-auto class', () => {
    renderWithProvider(<SettingsPanel {...defaultProps} />);
    const tablist = screen.getByRole('tablist');
    expect(tablist.className).not.toContain('overflow-x-auto');
  });

  it('tab container does NOT have scrollbar-hide class', () => {
    renderWithProvider(<SettingsPanel {...defaultProps} />);
    const tablist = screen.getByRole('tablist');
    expect(tablist.className).not.toContain('scrollbar-hide');
  });

  it('applies compact tab density from saved settings', () => {
    localStorageMock.setItem(
      'claude-tauri-settings',
      JSON.stringify({ tabDensity: 'compact' })
    );

    renderWithProvider(<SettingsPanel {...defaultProps} />);

    const tablist = screen.getByRole('tablist');
    const generalTab = screen.getByRole('tab', { name: 'General' });

    expect(tablist.className).toContain('gap-1');
    expect(generalTab.className).toContain('px-2.5');
    expect(generalTab.className).toContain('py-1.5');
    expect(generalTab.className).toContain('text-xs');
  });

  it('each tab button has role="tab"', () => {
    renderWithProvider(<SettingsPanel {...defaultProps} />);
    const tabs = screen.getAllByRole('tab');
    for (const tab of tabs) {
      expect(tab).toHaveAttribute('role', 'tab');
    }
  });
});
