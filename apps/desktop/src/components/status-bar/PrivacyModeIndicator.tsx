import { useSettings } from '@/hooks/useSettings';

export function PrivacyModeIndicator({ onShowSettings }: { onShowSettings?: (tab?: string) => void }) {
  const { settings } = useSettings();

  if (!settings.privacyMode) return null;

  return (
    <button
      type="button"
      data-testid="privacy-mode-indicator"
      onClick={() => onShowSettings?.('advanced')}
      className="flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-muted/50 transition-colors text-amber-500"
      title="Enterprise Privacy Mode is active. AI-generated titles and summaries are disabled."
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="shrink-0"
      >
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
      </svg>
      <span>Privacy</span>
    </button>
  );
}
