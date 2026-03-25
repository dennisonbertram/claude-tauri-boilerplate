import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { InstitutionCard } from '../InstitutionCard';
import type { PlaidItem } from '@claude-tauri/shared';

// --- Mocks ---------------------------------------------------------------

vi.mock('@/hooks/usePlaid', () => ({
  useDisconnectBank: () => ({ disconnect: vi.fn(), isDisconnecting: false, error: null }),
}));

vi.mock('@phosphor-icons/react', () => {
  const Icon = (props: Record<string, unknown>) => <svg data-testid="icon" {...props} />;
  return {
    Bank: Icon,
    DotsThree: Icon,
    LinkBreak: Icon,
    ArrowsClockwise: Icon,
    Warning: Icon,
    WarningCircle: Icon,
    Clock: Icon,
    Check: Icon,
  };
});

// --- Helpers -------------------------------------------------------------

function makePlaidItem(overrides: Partial<PlaidItem> = {}): PlaidItem {
  return {
    id: 'item-1',
    itemId: 'plaid-item-1',
    institutionId: 'ins_1',
    institutionName: 'Chase',
    accounts: [
      {
        id: 'acct-1',
        name: 'Total Checking',
        type: 'depository',
        subtype: 'checking',
        mask: '9876',
        currentBalance: 2500.5,
        currencyCode: 'USD',
      },
    ],
    createdAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

// --- Tests ---------------------------------------------------------------

describe('InstitutionCard', () => {
  it('renders institution name and accounts', () => {
    const item = makePlaidItem();

    render(<InstitutionCard item={item} />);

    expect(screen.getByText('Chase')).toBeInTheDocument();
    expect(screen.getByText('Total Checking')).toBeInTheDocument();
    expect(screen.getByText(/9876/)).toBeInTheDocument();
    expect(screen.getByText('Connected')).toBeInTheDocument();
  });

  it('shows error badge when item has error', () => {
    const item = makePlaidItem({
      error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' },
    });

    render(<InstitutionCard item={item} />);

    expect(screen.getByText('Error')).toBeInTheDocument();
  });

  it('shows reauth badge for items needing reauth', () => {
    const item = makePlaidItem({
      error: { code: 'ITEM_LOGIN_REQUIRED', message: 'Login required' },
    });

    render(<InstitutionCard item={item} />);

    expect(screen.getByText('Needs Reauth')).toBeInTheDocument();
  });
});
