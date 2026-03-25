import { useState } from 'react';
import { Bank, DotsThree, LinkBreak, ArrowsClockwise } from '@phosphor-icons/react';
import { Card, CardHeader, CardTitle, CardContent, CardAction } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { SyncStatusIndicator } from './SyncStatusIndicator';
import { DisconnectDialog } from './DisconnectDialog';
import type { PlaidItem, PlaidItemHealth, PlaidSyncStatus } from '@claude-tauri/shared';

interface InstitutionCardProps {
  item: PlaidItem;
  syncStatus?: PlaidSyncStatus;
  onReauth?: (itemId: string) => void;
  onDisconnected?: () => void;
}

function getItemHealth(item: PlaidItem): PlaidItemHealth {
  if (item.error) {
    if (item.error.code === 'ITEM_LOGIN_REQUIRED') return 'reauth_required';
    return 'error';
  }
  if (item.consentExpiration) {
    const expiresAt = new Date(item.consentExpiration);
    const sevenDaysFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    if (expiresAt < sevenDaysFromNow) return 'consent_expiring';
  }
  return 'healthy';
}

function HealthBadge({ health }: { health: PlaidItemHealth }) {
  switch (health) {
    case 'healthy':
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-green-500/10 px-2 py-0.5 text-[10px] font-medium text-green-600">
          <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
          Connected
        </span>
      );
    case 'reauth_required':
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-600">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
          Needs Reauth
        </span>
      );
    case 'error':
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-2 py-0.5 text-[10px] font-medium text-red-600">
          <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
          Error
        </span>
      );
    case 'consent_expiring':
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-600">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
          Consent Expiring
        </span>
      );
  }
}

function formatCurrency(amount: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(amount);
}

export function InstitutionCard({ item, syncStatus, onReauth, onDisconnected }: InstitutionCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [disconnectOpen, setDisconnectOpen] = useState(false);
  const health = getItemHealth(item);

  return (
    <>
      <Card size="sm">
        <CardHeader>
          <div className="flex items-center gap-2">
            {item.institutionLogoUrl ? (
              <img
                src={item.institutionLogoUrl}
                alt={item.institutionName}
                className="h-8 w-8 rounded-lg object-contain"
              />
            ) : (
              <div
                className="flex h-8 w-8 items-center justify-center rounded-lg"
                style={{ backgroundColor: item.institutionColor || 'var(--muted)' }}
              >
                <Bank className="h-4 w-4 text-white" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <CardTitle className="truncate">{item.institutionName}</CardTitle>
              <div className="flex items-center gap-2 mt-0.5">
                <HealthBadge health={health} />
                <SyncStatusIndicator status={syncStatus} lastSyncedAt={item.lastSyncedAt} compact />
              </div>
            </div>
          </div>
          <CardAction>
            <div className="relative">
              <Button variant="ghost" size="icon-xs" onClick={() => setMenuOpen(!menuOpen)}>
                <DotsThree className="h-4 w-4" weight="bold" />
              </Button>
              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
                  <div className="absolute right-0 top-full z-50 mt-1 w-40 rounded-lg border border-border bg-card shadow-lg py-1">
                    {health === 'reauth_required' && onReauth && (
                      <button
                        className="flex w-full items-center gap-2 px-3 py-1.5 text-sm text-foreground hover:bg-accent"
                        onClick={() => { setMenuOpen(false); onReauth(item.itemId); }}
                      >
                        <ArrowsClockwise className="h-3.5 w-3.5" />
                        Reconnect
                      </button>
                    )}
                    <button
                      className="flex w-full items-center gap-2 px-3 py-1.5 text-sm text-destructive hover:bg-accent"
                      onClick={() => { setMenuOpen(false); setDisconnectOpen(true); }}
                    >
                      <LinkBreak className="h-3.5 w-3.5" />
                      Disconnect
                    </button>
                  </div>
                </>
              )}
            </div>
          </CardAction>
        </CardHeader>

        <CardContent>
          {item.accounts.length === 0 ? (
            <p className="text-xs text-muted-foreground">No accounts</p>
          ) : (
            <div className="space-y-2">
              {item.accounts.map(account => (
                <div key={account.id} className="flex items-center justify-between text-sm">
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-foreground">
                      {account.name}
                      {account.mask && (
                        <span className="text-muted-foreground ml-1">...{account.mask}</span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground capitalize">{account.subtype || account.type}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium tabular-nums">
                      {formatCurrency(account.currentBalance, account.currencyCode)}
                    </p>
                    {account.availableBalance !== undefined && account.availableBalance !== account.currentBalance && (
                      <p className="text-xs text-muted-foreground tabular-nums">
                        {formatCurrency(account.availableBalance, account.currencyCode)} avail.
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <DisconnectDialog
        item={item}
        isOpen={disconnectOpen}
        onClose={() => setDisconnectOpen(false)}
        onDisconnected={() => onDisconnected?.()}
      />
    </>
  );
}
