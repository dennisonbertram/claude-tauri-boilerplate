const DATE_BUCKETS = ['Today', 'Yesterday', 'This Week', 'Last Week', 'This Month'] as const;
export type DateBucket = (typeof DATE_BUCKETS)[number] | string;

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
] as const;

export { DATE_BUCKETS, MONTH_NAMES };

/**
 * Classify a date into a human-readable bucket label
 * (Today, Yesterday, This Week, Last Week, This Month, or "Month Year").
 */
export function getDateBucket(date: Date): DateBucket {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 7);
  const lastWeekAgo = new Date(today);
  lastWeekAgo.setDate(lastWeekAgo.getDate() - 14);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  if (d >= today) return 'Today';
  if (d >= yesterday) return 'Yesterday';
  if (d >= weekAgo) return 'This Week';
  if (d >= lastWeekAgo) return 'Last Week';
  if (d >= monthStart) return 'This Month';
  if (d >= lastMonthStart) return `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
  return `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
}
