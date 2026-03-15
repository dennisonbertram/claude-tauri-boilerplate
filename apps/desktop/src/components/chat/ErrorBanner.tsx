import { X } from 'lucide-react';

export interface ChatError {
  type: 'api' | 'rate_limit' | 'auth' | 'network';
  message: string;
  retryable?: boolean;
}

interface ErrorBannerProps {
  error: ChatError | null;
  onDismiss: () => void;
  onRetry: () => void;
}

const bannerStyles: Record<ChatError['type'], string> = {
  api: 'bg-red-50 border-red-200 text-red-800 error destructive',
  rate_limit: 'bg-amber-50 border-amber-200 text-amber-800 warning yellow',
  auth: 'bg-red-50 border-red-200 text-red-800 error destructive',
  network: 'bg-blue-50 border-blue-200 text-blue-800',
};

/**
 * Dismissible error banner for displaying inline chat errors.
 * Different visual styles for API errors (red), rate limits (yellow/warning),
 * auth errors (red), and network errors (blue with reconnecting indicator).
 */
export function ErrorBanner({ error, onDismiss, onRetry }: ErrorBannerProps) {
  if (!error) return null;

  const style = bannerStyles[error.type];

  return (
    <div
      role="alert"
      className={`flex items-center gap-3 px-4 py-3 border rounded-md mx-4 mt-2 ${style}`}
    >
      <div className="flex-1 text-sm">
        <span>{error.message}</span>
        {error.type === 'network' && (
          <span className="ml-2 text-xs opacity-75">Reconnecting...</span>
        )}
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {error.retryable && (
          <button
            onClick={onRetry}
            className="text-xs font-medium px-2 py-1 rounded hover:bg-black/5 transition-colors"
            aria-label="Retry"
          >
            Retry
          </button>
        )}
        <button
          onClick={onDismiss}
          className="p-1 rounded hover:bg-black/5 transition-colors"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
