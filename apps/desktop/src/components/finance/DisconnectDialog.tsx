import { Warning } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { useDisconnectBank } from '@/hooks/usePlaid';
import type { PlaidItem } from '@claude-tauri/shared';

interface DisconnectDialogProps {
  item: PlaidItem;
  isOpen: boolean;
  onClose: () => void;
  onDisconnected: () => void;
}

export function DisconnectDialog({ item, isOpen, onClose, onDisconnected }: DisconnectDialogProps) {
  const { disconnect, isDisconnecting, error } = useDisconnectBank();

  if (!isOpen) return null;

  const handleDisconnect = async () => {
    const success = await disconnect(item.itemId);
    if (success) {
      onDisconnected();
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Dialog */}
      <div className="relative z-10 w-full max-w-md rounded-2xl bg-card border border-border shadow-lg p-6">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 rounded-full bg-destructive/10 p-2">
            <Warning className="h-5 w-5 text-destructive" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-semibold text-foreground">
              Disconnect {item.institutionName}?
            </h3>
            <p className="text-sm text-muted-foreground mt-2">
              This will remove all accounts and transaction data from {item.institutionName}.
              You can reconnect at any time, but historical data will need to be re-synced.
            </p>
            {item.accounts.length > 0 && (
              <div className="mt-3 rounded-lg bg-muted/50 p-3">
                <p className="text-xs font-medium text-muted-foreground mb-1">
                  {item.accounts.length} account{item.accounts.length > 1 ? 's' : ''} will be removed:
                </p>
                <ul className="text-xs text-muted-foreground space-y-0.5">
                  {item.accounts.map(acc => (
                    <li key={acc.id}>
                      {acc.name} {acc.mask ? `(...${acc.mask})` : ''}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {error && (
              <p className="text-xs text-destructive mt-2">{error}</p>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <Button variant="outline" size="sm" onClick={onClose} disabled={isDisconnecting}>
            Cancel
          </Button>
          <Button variant="destructive" size="sm" onClick={handleDisconnect} disabled={isDisconnecting}>
            {isDisconnecting ? 'Disconnecting...' : 'Disconnect'}
          </Button>
        </div>
      </div>
    </div>
  );
}
