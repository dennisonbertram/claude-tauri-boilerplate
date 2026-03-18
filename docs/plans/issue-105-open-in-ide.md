# Issue #105: Open In IDE Integration

## Feature Description

Add an "Open In" button to workspace panels so users can open the workspace directory (or a specific file) in their preferred IDE. The preferred IDE is configurable in Settings.

## Acceptance Criteria

- [x] "Open In" button on workspace (opens workspace root directory)
- [x] Configurable default IDE in settings
- [x] Support: VS Code, Cursor, Xcode, Android Studio, JetBrains, Zed, IntelliJ, Fork, Sourcetree
- [x] Open specific file (not just directory) when clicking from file view
- [x] Configure custom URL for repository "Open" button

## Implementation Checklist

- [x] Add `preferredIde` and `customIdeUrl` to `AppSettings` in `useSettings.ts`
- [x] Add defaults to `DEFAULT_SETTINGS`
- [x] Write tests for `ide-opener.ts` (TDD — write tests first, make them pass)
- [x] Create `apps/desktop/src/lib/ide-opener.ts` utility
- [x] Add "Open In" button to `WorkspacePanel.tsx` header
- [x] Add IDE settings section to `SettingsPanel.tsx` (General tab or new IDE tab)
- [x] Update `docs/plans/INDEX.md`

## IDE URL Schemes

| IDE | URL scheme |
|-----|-----------|
| VS Code | `vscode://file/{path}` |
| Cursor | `cursor://file/{path}` |
| Zed | `zed://file/{path}` |
| IntelliJ | `idea://open?file={path}` |
| Xcode | CLI only: `open -a Xcode {path}` |
| Fork | `fork://open?path={path}` |
| Sourcetree | `sourcetree://cloneRepo?type=local&cloneURL={path}` |
| Android Studio | `studio://open?file={path}` |
| Custom | User-provided template with `{path}` placeholder |

## Status

COMPLETE — all checklist items done, tests passing.
