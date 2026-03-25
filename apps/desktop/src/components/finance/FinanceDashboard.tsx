import { useState, useCallback } from 'react';
import { Bank, ArrowsClockwise } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  usePlaidItems,
  useSyncStatus,
  useRefreshBalances,
  useTriggerSync,
  useReauthBank,
} from '@/hooks/usePlaid';
import { ConnectBankButton } from './ConnectBankButton';
import { InstitutionCard } from './InstitutionCard';
import { AccountsList } from './AccountsList';
import { TransactionList } from './TransactionList';
import { ReauthBanner } from './ReauthBanner';
import { LinkFlowFallback } from './LinkFlowFallback';

type Tab = 'overview' | 'transactions';

export function FinanceDashboard() {
  const { items, isLoading, error, refresh: refreshItems } = usePlaidItems();
  const { statuses: syncStatuses, refresh: refreshSync } = useSyncStatus();
  const { refresh: refreshBalancesAction, isRefreshing } = useRefreshBalances();
  const { sync, isSyncing } = useTriggerSync();
  const { reauth } = useReauthBank();
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [pendingLinkSession, setPendingLinkSession] = useState<{ sessionId: string } | null>(null);

  const itemsNeedingReauth = items.filter(item => item.error?.code === 'ITEM_LOGIN_REQUIRED');
  const healthyItems = items.filter(item => !item.error);

  const handleRefresh = useCallback(async () => {
    await Promise.all([
      refreshBalancesAction(),
      sync(),
    ]);
    setTimeout(() => {
      refreshItems();
      refreshSync();
    }, 1000);
  }, [refreshBalancesAction, sync, refreshItems, refreshSync]);

  const handleReauth = useCallback(async (itemId: string) => {
    await reauth(itemId);
  }, [reauth]);

  const handleDisconnected = useCallback(() => {
    refreshItems();
  }, [refreshItems]);

  const handleConnectSuccess = useCallback(() => {
    // After connecting, refresh the items list after a short delay
    setTimeout(refreshItems, 2000);
  }, [refreshItems]);

  // Loading state
  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center space-y-3">
          <ArrowsClockwise className="h-8 w-8 mx-auto text-muted-foreground animate-spin" />
          <p className="text-sm text-muted-foreground">Loading financial data...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center space-y-3">
          <p className="text-sm text-destructive">{error}</p>
          <Button variant="outline" size="sm" onClick={refreshItems}>
            Retry
          </Button>
        </div>
      </div>
    );
  }

  // Empty state — no institutions connected
  if (items.length === 0 && !pendingLinkSession) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center space-y-4 max-w-sm">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
            <Bank className="h-8 w-8 text-muted-foreground" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-foreground">Connect Your Bank</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Link your bank accounts to view balances, track transactions, and manage your finances.
            </p>
          </div>
          <ConnectBankButton onSuccess={handleConnectSuccess} size="lg" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border">
        <div className="flex items-center gap-4">
          <h1 className="text-lg font-semibold text-foreground">Finance</h1>
          <div className="flex items-center gap-1 rounded-lg bg-muted p-0.5">
            <button
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                activeTab === 'overview'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              onClick={() => setActiveTab('overview')}
            >
              Overview
            </button>
            <button
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                activeTab === 'transactions'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              onClick={() => setActiveTab('transactions')}
            >
              Transactions
            </button>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing || isSyncing}
          >
            <ArrowsClockwise className={`h-3.5 w-3.5 ${isRefreshing || isSyncing ? 'animate-spin' : ''}`} data-icon="inline-start" />
            Refresh
          </Button>
          <ConnectBankButton onSuccess={handleConnectSuccess} variant="outline" size="sm" />
        </div>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1 min-h-0">
        <div className="px-6 py-4 space-y-6">
          {/* Pending Link Flow Fallback */}
          {pendingLinkSession && (
            <LinkFlowFallback
              sessionId={pendingLinkSession.sessionId}
              onComplete={() => { setPendingLinkSession(null); refreshItems(); }}
              onCancel={() => setPendingLinkSession(null)}
            />
          )}

          {/* Reauth Banners */}
          {itemsNeedingReauth.map(item => (
            <ReauthBanner
              key={item.id}
              item={item}
              onReauthStarted={refreshItems}
            />
          ))}

          {activeTab === 'overview' ? (
            <>
              {/* Institutions */}
              <section>
                <h2 className="text-sm font-semibold text-muted-foreground/70 uppercase tracking-wider mb-3">
                  Connected Institutions
                </h2>
                <div className="grid gap-3 grid-cols-1 lg:grid-cols-2">
                  {items.map(item => (
                    <InstitutionCard
                      key={item.id}
                      item={item}
                      syncStatus={syncStatuses.find(s => s.itemId === item.itemId)}
                      onReauth={handleReauth}
                      onDisconnected={handleDisconnected}
                    />
                  ))}
                </div>
              </section>

              {/* Accounts */}
              {healthyItems.length > 0 && (
                <section>
                  <h2 className="text-sm font-semibold text-muted-foreground/70 uppercase tracking-wider mb-3">
                    Accounts
                  </h2>
                  <AccountsList items={healthyItems} />
                </section>
              )}

              {/* Recent Transactions Preview */}
              <section>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-semibold text-muted-foreground/70 uppercase tracking-wider">
                    Recent Transactions
                  </h2>
                  <Button
                    variant="ghost"
                    size="xs"
                    onClick={() => setActiveTab('transactions')}
                  >
                    View All
                  </Button>
                </div>
                <TransactionList />
              </section>
            </>
          ) : (
            <TransactionList />
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
