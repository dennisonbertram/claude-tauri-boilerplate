import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FinanceDashboard } from '../FinanceDashboard';
import type { PlaidItem } from '@claude-tauri/shared';

// --- Mock hooks ----------------------------------------------------------

const mockRefreshItems = vi.fn();
const mockRefreshSync = vi.fn();
const mockRefreshBalances = vi.fn().mockResolvedValue(true);
const mockSync = vi.fn().mockResolvedValue(null);
const mockReauth = vi.fn().mockResolvedValue(null);

const defaultItemsHook = {
  items: [] as PlaidItem[],
  isLoading: false,
  error: null as string | null,
  refresh: mockRefreshItems,
};

vi.mock('@/hooks/usePlaid', () => ({
  usePlaidItems: () => defaultItemsHook,
  useSyncStatus: () => ({ statuses: [], refresh: mockRefreshSync }),
  useRefreshBalances: () => ({ refresh: mockRefreshBalances, isRefreshing: false }),
  useTriggerSync: () => ({ sync: mockSync, isSyncing: false }),
  useReauthBank: () => ({ reauth: mockReauth, isReauthing: false }),
  useConnectBank: () => ({ connect: vi.fn(), isConnecting: false, error: null, session: null }),
  useDisconnectBank: () => ({ disconnect: vi.fn(), isDisconnecting: false, error: null }),
  usePlaidTransactions: () => ({
    transactions: [],
    total: 0,
    hasMore: false,
    isLoading: false,
    error: null,
    refresh: vi.fn(),
  }),
  usePlaidAccounts: () => ({ accounts: [], isLoading: false, error: null, refresh: vi.fn() }),
}));

vi.mock('@phosphor-icons/react', () => {
  const Icon = (props: Record<string, unknown>) => <svg data-testid="icon" {...props} />;
  return {
    Bank: Icon,
    ArrowsClockwise: Icon,
    DotsThree: Icon,
    LinkBreak: Icon,
    WarningCircle: Icon,
    Warning: Icon,
    Receipt: Icon,
    MagnifyingGlass: Icon,
    CaretLeft: Icon,
    CaretRight: Icon,
    ArrowUp: Icon,
    ArrowDown: Icon,
    FunnelSimple: Icon,
    Clock: Icon,
    Check: Icon,
    Wallet: Icon,
    CreditCard: Icon,
    Coins: Icon,
    TrendUp: Icon,
  };
});

// --- Helpers -------------------------------------------------------------

function makePlaidItem(overrides: Partial<PlaidItem> = {}): PlaidItem {
  return {
    id: 'item-1',
    itemId: 'plaid-item-1',
    institutionId: 'ins_1',
    institutionName: 'Test Bank',
    accounts: [
      {
        id: 'acct-1',
        name: 'Checking',
        type: 'depository',
        subtype: 'checking',
        mask: '1234',
        currentBalance: 1500,
        currencyCode: 'USD',
      },
    ],
    createdAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

// --- Tests ---------------------------------------------------------------

describe('FinanceDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset to default empty state
    defaultItemsHook.items = [];
    defaultItemsHook.isLoading = false;
    defaultItemsHook.error = null;
  });

  it('renders loading state', () => {
    defaultItemsHook.isLoading = true;

    render(<FinanceDashboard />);

    expect(screen.getByText('Loading financial data...')).toBeInTheDocument();
  });

  it('renders empty state with connect button when no items', () => {
    defaultItemsHook.items = [];

    render(<FinanceDashboard />);

    expect(screen.getByText('Connect Your Bank')).toBeInTheDocument();
    expect(screen.getByText(/Link your bank accounts/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Connect Bank Account/ })).toBeInTheDocument();
  });

  it('renders accounts when items exist', () => {
    defaultItemsHook.items = [makePlaidItem()];

    render(<FinanceDashboard />);

    expect(screen.getByText('Finance')).toBeInTheDocument();
    expect(screen.getByText('Connected Institutions')).toBeInTheDocument();
    expect(screen.getAllByText('Test Bank').length).toBeGreaterThanOrEqual(1);
  });

  it('renders error state', () => {
    defaultItemsHook.error = 'Failed to fetch institutions';

    render(<FinanceDashboard />);

    expect(screen.getByText('Failed to fetch institutions')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });
});
