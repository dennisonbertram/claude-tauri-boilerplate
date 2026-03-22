import { Toaster } from 'sonner';
import { useTheme } from '@/hooks/useTheme';

/**
 * Wrapper around Toaster that reads the user's theme preference
 * so toast notifications match the active theme.
 */
export function ThemedToaster() {
  const { effectiveTheme } = useTheme();
  return <Toaster position="top-right" theme={effectiveTheme} />;
}
