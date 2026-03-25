import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ConnectBankButton } from '../ConnectBankButton';

// --- Mock state controlled per-test -------------------------------------

const mockConnect = vi.fn();

const defaultHookReturn = {
  connect: mockConnect,
  isConnecting: false,
  error: null as string | null,
  session: null,
};

vi.mock('@/hooks/usePlaid', () => ({
  useConnectBank: () => defaultHookReturn,
}));

vi.mock('@phosphor-icons/react', () => {
  const Icon = (props: Record<string, unknown>) => <svg data-testid="icon" {...props} />;
  return { Bank: Icon };
});

// --- Tests ---------------------------------------------------------------

describe('ConnectBankButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    defaultHookReturn.connect = mockConnect;
    defaultHookReturn.isConnecting = false;
    defaultHookReturn.error = null;
  });

  it('renders button', () => {
    render(<ConnectBankButton />);

    expect(screen.getByRole('button', { name: /Connect Bank Account/ })).toBeInTheDocument();
  });

  it('calls connect handler on click', async () => {
    mockConnect.mockResolvedValue({ sessionId: 's-1', state: 'st', hostedLinkUrl: 'https://example.com' });
    const onSuccess = vi.fn();

    render(<ConnectBankButton onSuccess={onSuccess} />);

    fireEvent.click(screen.getByRole('button', { name: /Connect Bank Account/ }));

    await waitFor(() => {
      expect(mockConnect).toHaveBeenCalledTimes(1);
    });
  });
});
