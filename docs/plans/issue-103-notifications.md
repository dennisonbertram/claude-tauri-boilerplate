# Issue #103: Notifications, Sound Effects, and Unread Indicators

## Feature Description

Desktop notifications when Claude completes work, notification sounds, macOS badge updates,
workspace unread indicators, and quit confirmation if an agent is running.

## Acceptance Criteria

- [x] macOS notification when Claude completes a task (browser Notification API)
- [ ] macOS badge only updates on completion (not mid-work) — requires native Tauri integration (deferred)
- [x] Branch name in notification text
- [x] Notification sounds (configurable in settings)
- [x] Button to test notification sounds
- [x] Mark workspaces as unread
- [x] Unread count in non-focused workspaces (dot indicator in sidebar)
- [x] Quit confirmation prompt if agent is running (beforeunload handler)

## Implementation Summary

### Files Changed

- `apps/desktop/src/lib/notifications.ts` — browser Notification API + Web Audio API sounds
- `apps/desktop/src/lib/__tests__/notifications.test.ts` — full test coverage
- `apps/desktop/src/hooks/useUnread.ts` — transient workspace unread tracking
- `apps/desktop/src/hooks/__tests__/useUnread.test.ts` — full test coverage
- `apps/desktop/src/hooks/useSettings.ts` — added `notificationsEnabled`, `notificationSound`, `notificationsWorkspaceUnread`
- `apps/desktop/src/hooks/useSubagents.ts` — added `onRootTaskComplete` callback option
- `apps/desktop/src/components/chat/ChatPage.tsx` — added `onTaskComplete` prop
- `apps/desktop/src/components/workspaces/WorkspacePanel.tsx` — added `onTaskComplete` prop with workspace context
- `apps/desktop/src/components/workspaces/ProjectSidebar.tsx` — added `isWorkspaceUnread` prop + unread dot UI
- `apps/desktop/src/components/settings/SettingsPanel.tsx` — added Notifications tab
- `apps/desktop/src/App.tsx` — wired all together

### Key Decisions

- Used browser `Notification` API (works in Tauri webview) instead of native Tauri notifications to avoid Rust changes
- Used Web Audio API (`AudioContext`) for programmatic sound generation — no asset files needed
- Unread state is transient (React state, not persisted) per MVP guidelines
- `beforeunload` handler for quit confirmation — works in Tauri webview
- macOS badge count (dock badge) deferred — requires Tauri native plugin changes

## Status

Implementation complete. Tests pass (19 new tests). Committed in 6 logical commits.

Note: macOS dock badge update is not implemented because it requires Tauri native plugin integration
(`tauri-plugin-notification` or `window-state`), which would require Rust code changes and Cargo.toml
updates outside the scope of this MVP slice.
