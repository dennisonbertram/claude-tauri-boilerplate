# STORY-010: List and Organize Sessions by Date

## Walk Date
2026-03-22

## Goal
Verify session organization by date in the sidebar.

## Steps Performed

### Step 1: Check date groupings in sidebar
- Sessions are grouped under three headers: **TODAY**, **YESTERDAY**, **THIS WEEK**
- Headers are displayed as uppercase static text labels
- **Result**: PASS - Date groupings exist

### Step 2: Verify chronological ordering
- Sessions within each group appear to be in reverse chronological order (newest first)
- TODAY section has the most sessions (~30+)
- YESTERDAY section has ~12 sessions (all from Mar 21 afternoon)
- THIS WEEK section has ~20+ sessions
- **Result**: PASS - Chronological ordering appears correct within groups

### Step 3: Check if date groupings are correct
- **Potential issue**: Sessions named "Mar 21 at 9:15 PM" and "Mar 21 at 9:09 PM" appear under TODAY instead of YESTERDAY
  - Today is March 22, so March 21 sessions should be under YESTERDAY
  - This could be a timezone issue (server UTC vs local time), or these sessions were created late enough to cross midnight
  - Meanwhile, "Mar 21 at 2:53 PM" and similar are correctly under YESTERDAY
  - **Inconsistency**: Some March 21 sessions are under TODAY, others under YESTERDAY
- Only 3 date groups visible (TODAY, YESTERDAY, THIS WEEK) -- no LAST WEEK, THIS MONTH, or OLDER groups
- **Result**: PARTIAL - Groupings exist but may have timezone-related misclassification

## Findings

| # | Type | Severity | Description |
|---|------|----------|-------------|
| 1 | Pass | - | Date group headers (TODAY, YESTERDAY, THIS WEEK) are present and visible |
| 2 | Pass | - | Sessions appear chronologically ordered within groups |
| 3 | Bug | MEDIUM | Some Mar 21 sessions appear under TODAY instead of YESTERDAY (possible timezone issue) |
| 4 | UX | LOW | Only 3 date groups available -- older sessions all fall under THIS WEEK with no further granularity |
| 5 | Info | LOW | Many sessions use timestamps as names (e.g., "Mar 21 at 9:15 PM") rather than content-based names |

## Screenshots
- `screenshots/date-groupings-top.png` - Top of sidebar showing TODAY group
- `screenshots/date-groupings-scrolled.png` - Scrolled view showing YESTERDAY and THIS WEEK

## Overall Result: PARTIAL PASS
Date grouping is implemented with TODAY/YESTERDAY/THIS WEEK categories. Chronological ordering within groups appears correct. However, some sessions may be misclassified between TODAY and YESTERDAY (possible timezone issue), and there's no granularity beyond THIS WEEK.
