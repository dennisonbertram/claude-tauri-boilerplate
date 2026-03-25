import { useState, useMemo } from 'react';
import {
  MagnifyingGlass,
  CaretLeft,
  CaretRight,
  ArrowUp,
  ArrowDown,
  Receipt,
  FunnelSimple,
} from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { usePlaidTransactions } from '@/hooks/usePlaid';
import type { PlaidTransactionSort } from '@claude-tauri/shared';

interface TransactionListProps {
  accountIds?: string[];
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(Math.abs(amount));
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

const PAGE_SIZE = 25;

export function TransactionList({ accountIds }: TransactionListProps) {
  const [search, setSearch] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [sort, setSort] = useState<PlaidTransactionSort>('date_desc');
  const [offset, setOffset] = useState(0);
  const [showFilters, setShowFilters] = useState(false);

  const filters = useMemo(
    () => ({
      accountIds,
      search: search || undefined,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      sort,
      limit: PAGE_SIZE,
      offset,
    }),
    [accountIds, search, startDate, endDate, sort, offset],
  );

  const { transactions, total, hasMore, isLoading, error, refresh } = usePlaidTransactions(filters);

  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  const toggleSort = (field: 'date' | 'amount') => {
    if (sort === `${field}_desc`) setSort(`${field}_asc`);
    else setSort(`${field}_desc`);
    setOffset(0);
  };

  if (error) {
    return (
      <div className="text-center py-8">
        <p className="text-sm text-destructive mb-2">{error}</p>
        <Button variant="outline" size="sm" onClick={refresh}>
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Search and Filters */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <MagnifyingGlass className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setOffset(0); }}
            placeholder="Search transactions..."
            className="w-full rounded-lg border border-border bg-background pl-8 pr-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground/60 outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
        <Button
          variant={showFilters ? 'secondary' : 'outline'}
          size="sm"
          onClick={() => setShowFilters(!showFilters)}
        >
          <FunnelSimple className="h-3.5 w-3.5" data-icon="inline-start" />
          Filters
        </Button>
      </div>

      {showFilters && (
        <div className="flex items-center gap-2 rounded-lg bg-muted/50 p-3">
          <div className="flex items-center gap-1.5">
            <label className="text-xs text-muted-foreground">From</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => { setStartDate(e.target.value); setOffset(0); }}
              className="rounded border border-border bg-background px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
          <div className="flex items-center gap-1.5">
            <label className="text-xs text-muted-foreground">To</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => { setEndDate(e.target.value); setOffset(0); }}
              className="rounded border border-border bg-background px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
          {(startDate || endDate) && (
            <Button
              variant="ghost"
              size="xs"
              onClick={() => { setStartDate(''); setEndDate(''); setOffset(0); }}
            >
              Clear
            </Button>
          )}
        </div>
      )}

      {/* Table */}
      <div className="rounded-lg border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">
                <button
                  className="inline-flex items-center gap-1 hover:text-foreground"
                  onClick={() => toggleSort('date')}
                >
                  Date
                  {sort.startsWith('date') && (
                    sort === 'date_asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                  )}
                </button>
              </th>
              <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Description</th>
              <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Category</th>
              <th className="text-right px-3 py-2 text-xs font-medium text-muted-foreground">
                <button
                  className="inline-flex items-center gap-1 hover:text-foreground ml-auto"
                  onClick={() => toggleSort('amount')}
                >
                  Amount
                  {sort.startsWith('amount') && (
                    sort === 'amount_asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                  )}
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {isLoading && transactions.length === 0 ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-b border-border last:border-0">
                  <td className="px-3 py-2.5"><div className="h-4 w-20 animate-pulse rounded bg-muted" /></td>
                  <td className="px-3 py-2.5"><div className="h-4 w-40 animate-pulse rounded bg-muted" /></td>
                  <td className="px-3 py-2.5"><div className="h-4 w-24 animate-pulse rounded bg-muted" /></td>
                  <td className="px-3 py-2.5 text-right"><div className="h-4 w-16 animate-pulse rounded bg-muted ml-auto" /></td>
                </tr>
              ))
            ) : transactions.length === 0 ? (
              <tr>
                <td colSpan={4} className="text-center py-8">
                  <Receipt className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
                  <p className="text-sm text-muted-foreground">
                    {search ? 'No transactions match your search' : 'No transactions yet'}
                  </p>
                </td>
              </tr>
            ) : (
              transactions.map(tx => (
                <tr key={tx.id} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                  <td className="px-3 py-2.5 text-muted-foreground whitespace-nowrap">
                    {formatDate(tx.date)}
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex flex-col">
                      <span className="text-foreground truncate max-w-[250px]">
                        {tx.merchantName || tx.name}
                      </span>
                      {tx.pending && (
                        <span className="text-[10px] text-amber-500 font-medium">Pending</span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-muted-foreground text-xs">
                    {tx.personalFinanceCategory || tx.category?.[0] || '--'}
                  </td>
                  <td className={`px-3 py-2.5 text-right tabular-nums font-medium ${
                    tx.amount < 0 ? 'text-green-600' : 'text-foreground'
                  }`}>
                    {tx.amount < 0 ? '+' : '-'}{formatCurrency(tx.amount)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {total > PAGE_SIZE && (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            Showing {offset + 1}–{Math.min(offset + PAGE_SIZE, total)} of {total}
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon-xs"
              disabled={offset === 0}
              onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
            >
              <CaretLeft className="h-3.5 w-3.5" />
            </Button>
            <span className="px-2">
              Page {currentPage} of {totalPages}
            </span>
            <Button
              variant="ghost"
              size="icon-xs"
              disabled={!hasMore}
              onClick={() => setOffset(offset + PAGE_SIZE)}
            >
              <CaretRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
