import { Wallet, CreditCard, Coins, TrendUp, Bank } from '@phosphor-icons/react';
import { Card, CardContent } from '@/components/ui/card';
import type { PlaidItem } from '@claude-tauri/shared';

interface AccountsListProps {
  items: PlaidItem[];
}

function formatCurrency(amount: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(amount);
}

function AccountTypeIcon({ type }: { type: string }) {
  switch (type) {
    case 'depository':
      return <Wallet className="h-4 w-4" />;
    case 'credit':
      return <CreditCard className="h-4 w-4" />;
    case 'loan':
      return <Coins className="h-4 w-4" />;
    case 'investment':
      return <TrendUp className="h-4 w-4" />;
    default:
      return <Bank className="h-4 w-4" />;
  }
}

export function AccountsList({ items }: AccountsListProps) {
  const allAccounts = items.flatMap(item =>
    item.accounts.map(acc => ({ ...acc, institutionName: item.institutionName }))
  );

  if (allAccounts.length === 0) {
    return (
      <div className="text-center py-8">
        <Bank className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
        <p className="text-sm text-muted-foreground">No accounts connected</p>
      </div>
    );
  }

  // Group by type
  const grouped = allAccounts.reduce<Record<string, typeof allAccounts>>((acc, account) => {
    const key = account.type;
    if (!acc[key]) acc[key] = [];
    acc[key].push(account);
    return acc;
  }, {});

  const typeLabels: Record<string, string> = {
    depository: 'Depository',
    credit: 'Credit',
    loan: 'Loans',
    investment: 'Investments',
    other: 'Other',
  };

  return (
    <div className="space-y-4">
      {Object.entries(grouped).map(([type, accounts]) => (
        <div key={type}>
          <h3 className="text-xs font-semibold text-muted-foreground/70 uppercase tracking-wider mb-2 px-1">
            {typeLabels[type] || type}
          </h3>
          <div className="grid gap-2 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {accounts.map(account => (
              <Card key={account.id} size="sm">
                <CardContent className="flex items-start gap-3">
                  <div className="flex-shrink-0 rounded-lg bg-muted p-2">
                    <AccountTypeIcon type={account.type} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {account.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {account.institutionName}
                      {account.mask && <span> &middot; ...{account.mask}</span>}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-semibold tabular-nums">
                      {formatCurrency(account.currentBalance, account.currencyCode)}
                    </p>
                    {account.availableBalance !== undefined && account.availableBalance !== account.currentBalance && (
                      <p className="text-[11px] text-muted-foreground tabular-nums">
                        {formatCurrency(account.availableBalance, account.currencyCode)} avail.
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
