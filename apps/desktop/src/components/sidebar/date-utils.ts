import type { Session } from '@claude-tauri/shared';

/* ------------------------------------------------------------------ */
/*  Date bucketing                                                     */
/* ------------------------------------------------------------------ */

const DATE_BUCKETS = ['Today', 'Yesterday', 'This Week', 'Last Week', 'This Month'] as const;
export type DateBucket = (typeof DATE_BUCKETS)[number] | string;

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

function getDateBucket(date: Date): DateBucket {
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

export function groupSessionsByDate(sessions: Session[]): { bucket: DateBucket; sessions: Session[] }[] {
  const groups = new Map<DateBucket, Session[]>();
  for (const session of sessions) {
    const bucket = getDateBucket(new Date(session.createdAt));
    if (!groups.has(bucket)) groups.set(bucket, []);
    groups.get(bucket)!.push(session);
  }
  const fixedBuckets: { bucket: DateBucket; sessions: Session[] }[] = DATE_BUCKETS
    .filter((b) => groups.has(b))
    .map((b) => ({ bucket: b, sessions: groups.get(b)! }));

  const monthBuckets = Array.from(groups.keys())
    .filter((bucket): bucket is string =>
      !DATE_BUCKETS.includes(bucket as (typeof DATE_BUCKETS)[number])
    )
    .map((bucket) => {
      const [monthLabel, yearLabel] = bucket.split(' ');
      return {
        bucket,
        sessions: groups.get(bucket)!,
        sortValue: (Number(yearLabel) * 12) + MONTH_NAMES.indexOf(monthLabel as any),
      };
    })
    .sort((a, b) => b.sortValue - a.sortValue);

  return [
    ...fixedBuckets,
    ...monthBuckets.map(({ bucket, sessions }) => ({ bucket, sessions })),
  ];
}
