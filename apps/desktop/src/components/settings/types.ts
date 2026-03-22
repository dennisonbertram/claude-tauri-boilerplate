import type { AppSettings } from '@/hooks/useSettings';

export interface TabProps {
  settings: AppSettings;
  updateSettings: (updates: Partial<AppSettings>) => void;
}
