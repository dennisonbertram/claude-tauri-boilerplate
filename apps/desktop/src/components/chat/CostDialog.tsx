interface CostDialogProps {
  sessionTotalCost: number;
  messageCostCount: number;
  onClose: () => void;
}

export function CostDialog({ sessionTotalCost, messageCostCount, onClose }: CostDialogProps) {
  return (
    <div
      data-testid="cost-dialog-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        data-testid="cost-dialog"
        className="w-80 rounded-xl border border-border bg-background p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-4 text-lg font-semibold">Session Cost</h2>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Total cost</span>
            <span className="font-mono">${sessionTotalCost.toFixed(6)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Messages</span>
            <span className="font-mono">{messageCostCount}</span>
          </div>
        </div>
        <button
          data-testid="cost-dialog-close"
          onClick={onClose}
          className="mt-4 w-full rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground"
        >
          Close
        </button>
      </div>
    </div>
  );
}
