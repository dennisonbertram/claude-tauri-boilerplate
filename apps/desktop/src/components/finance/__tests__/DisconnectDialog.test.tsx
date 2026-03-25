import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { DisconnectDialog } from '../DisconnectDialog';
import type { PlaidItem } from '@claude-tauri/shared';

// --- Mock state controlled per-test -------------------------------------

const mockDisconnect = vi.fn();

const defaultHookReturn = {
  disconnect: mockDisconnect,
  isDisconnecting: false,
  error: null as string | null,
};

vi.mock('@/hooks/usePlaid', () => ({
  useDisconnectBank: () => defaultHookReturn,
}));

vi.mock('@phosphor-icons/react', () => {
  const Icon = (props: Record<string, unknown>) => <svg data-testid="icon" {...props} />;
  return { Warning: Icon };
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
        currentBalance: 2500,
        currencyCode: 'USD',
      },
    ],
    createdAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

const defaultProps = {
  item: makePlaidItem(),
  isOpen: true,
  onClose: vi.fn(),
  onDisconnected: vi.fn(),
};

// --- Tests ---------------------------------------------------------------

describe('DisconnectDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    defaultHookReturn.disconnect = mockDisconnect;
    defaultHookReturn.isDisconnecting = false;
    defaultHookReturn.error = null;
  });

  it('shows confirmation message', () => {
    render(<DisconnectDialog {...defaultProps} />);

    expect(screen.getByText('Disconnect Chase?')).toBeInTheDocument();
    expect(screen.getByText(/remove all accounts and transaction data/)).toBeInTheDocument();
  });

  it('calls disconnect on confirm', async () => {
    mockDisconnect.mockResolvedValue(true);

    render(<DisconnectDialog {...defaultProps} />);

    fireEvent.click(screen.getByRole('button', { name: 'Disconnect' }));

    await waitFor(() => {
      expect(mockDisconnect).toHaveBeenCalledWith('plaid-item-1');
    });
  });

  it('closes on cancel', () => {
    const onClose = vi.fn();

    render(<DisconnectDialog {...defaultProps} onClose={onClose} />);

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not render when isOpen is false', () => {
    render(<DisconnectDialog {...defaultProps} isOpen={false} />);

    expect(screen.queryByText('Disconnect Chase?')).not.toBeInTheDocument();
  });
});
