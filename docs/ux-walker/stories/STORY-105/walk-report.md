# STORY-105: Archive and Restore Dashboard Visibility

## Walk Report

| Field | Value |
|-------|-------|
| Story | STORY-105 |
| Title | Archive and Restore Dashboard Visibility |
| Category | Dashboard |
| Date | 2026-03-23 |
| App URL | http://localhost:1927 |
| Status | BLOCKED |
| Blocker | Workspace crash (STORY-028 dependency) |

## Steps Attempted

1. Navigated to http://localhost:1927
2. Clicked "Projects" in sidebar navigation
3. Projects page loaded showing "ai-domain-registration" project with 1 workspace
4. Clicked project card to open workspace
5. App crashed with "Something went wrong - An unexpected error occurred" error page

## Result

**BLOCKED** -- This story requires workspace context to access dashboard features.
Clicking into any workspace triggers an unrecoverable crash ("Something went wrong").
All code review, diff viewing, and dashboard stories (STORY-097 through STORY-121) are
blocked by this same workspace crash bug.

## Dependencies

- STORY-028 (workspace management) -- BLOCKER: workspace navigation crashes the app
