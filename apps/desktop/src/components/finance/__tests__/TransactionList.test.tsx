import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TransactionList } from '../TransactionList';
import type { PlaidTransaction } from '@claude-tauri/shared';

// --- Mock state controlled per-test -------------------------------------

const defaultHookReturn = {
  transactions: [] as PlaidTransaction[],
  total: 0,
  hasMore: false,
  isLoading: false,
  error: null as string | null,
  refresh: vi.fn(),
};

vi.mock('@/hooks/usePlaid', () => ({
  usePlaidTransactions: () => defaultHookReturn,
}));

vi.mock('@phosphor-icons/react', () => {
  const Icon = (props: Record<string, unknown>) => <svg data-testid="icon" {...props} />;
  return {
    MagnifyingGlass: Icon,
    CaretLeft: Icon,
    CaretRight: Icon,
    ArrowUp: Icon,
    ArrowDown: Icon,
    Receipt: Icon,
    FunnelSimple: Icon,
  };
});

// --- Helpers -------------------------------------------------------------

function makeTransaction(overrides: Partial<PlaidTransaction> = {}): PlaidTransaction {
  return {
    id: 'tx-1',
    accountId: 'acct-1',
    amount: 42.5,
    date: '2026-03-01',
    name: 'Coffee Shop',
    pending: false,
    paymentChannel: 'in store',
    ...overrides,
  };
}

// --- Tests ---------------------------------------------------------------

describe('TransactionList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    defaultHookReturn.transactions = [];
    defaultHookReturn.total = 0;
    defaultHookReturn.hasMore = false;
    defaultHookReturn.isLoading = false;
    defaultHookReturn.error = null;
  });

  it('renders transactions', () => {
    defaultHookReturn.transactions = [
      makeTransaction({ id: 'tx-1', name: 'Coffee Shop', amount: 4.5, date: '2026-03-01' }),
      makeTransaction({ id: 'tx-2', name: 'Grocery Store', amount: 78.23, date: '2026-03-02' }),
    ];
    defaultHookReturn.total = 2;

    render(<TransactionList />);

    expect(screen.getByText('Coffee Shop')).toBeInTheDocument();
    expect(screen.getByText('Grocery Store')).toBeInTheDocument();
  });

  it('renders empty state', () => {
    defaultHookReturn.transactions = [];

    render(<TransactionList />);

    expect(screen.getByText('No transactions yet')).toBeInTheDocument();
  });

  it('renders loading skeletons', () => {
    defaultHookReturn.isLoading = true;
    defaultHookReturn.transactions = [];

    const { container } = render(<TransactionList />);

    // Should render 5 skeleton rows with animate-pulse divs
    const skeletons = container.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThanOrEqual(5);
  });

  it('renders search input for filtering', () => {
    render(<TransactionList />);

    const searchInput = screen.getByPlaceholderText('Search transactions...');
    expect(searchInput).toBeInTheDocument();
  });
});
