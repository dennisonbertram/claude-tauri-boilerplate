# Investigation: Blank Frontend at localhost:1420

**Date**: 2026-03-22
**Status**: Root cause identified

## Symptom

Navigating to `http://localhost:1420` shows a completely blank white page. The Vite dev server is running, and the HTML shell loads, but no React content renders.

## Root Cause

**Case-insensitive filesystem collision between `App.tsx` and the `app/` directory.**

In `apps/desktop/src/`, two entries coexist:

```
App.tsx          (the main React component)
app/             (directory with helper modules: BootScreen, constants, etc.)
app/index.ts     (barrel that exports ErrorScreen, LoadingScreen, etc.)
```

`App.tsx` line 29 imports from `'./app'`:

```ts
import { ThemedToaster, useSidecarBoot, ViewSwitcherHeader, useAppKeyboardShortcuts,
         useTaskNotifications, defaultStatusData, ErrorScreen, LoadingScreen } from './app';
```

The intent is to resolve to `./app/index.ts`. However, on macOS (case-insensitive HFS+/APFS), Vite resolves `'./app'` to `./App.tsx` first (file takes precedence over directory). This creates a **circular self-import**: `App.tsx` tries to import `ErrorScreen` from itself.

### Proof from Vite's transformed output

Fetching `http://localhost:1420/src/App.tsx` shows the resolved import:

```js
import { ThemedToaster, ..., ErrorScreen, LoadingScreen } from "/src/App.tsx";
```

It points back to `/src/App.tsx` -- not `/src/app/index.ts`.

### Browser console error

```
SyntaxError: The requested module '/src/App.tsx' does not provide an export named 'ErrorScreen'
```

This is the circular import failing because `App.tsx` only has a `default` export (`App`), not named exports like `ErrorScreen`.

## Fix Options

### Option A: Rename the import to be explicit (simplest)

Change the import in `App.tsx` from:
```ts
import { ... } from './app';
```
to:
```ts
import { ... } from './app/index';
```

### Option B: Rename the `app/` directory

Rename `app/` to something that doesn't collide, e.g. `app-utils/` or `app-core/`.

### Option C: Rename `App.tsx`

Rename the main component file (e.g. to `AppRoot.tsx`) to avoid the case collision. This requires updating `main.tsx` as well.

### Option D: Add `resolve.extensions` or case-sensitivity enforcement in Vite config

This is more fragile and doesn't fix the underlying naming conflict.

## Recommendation

**Option A** is the lowest-risk fix -- a single line change, no file renames, no downstream updates needed.

## Environment

- macOS (Darwin 24.1.0) with case-insensitive APFS
- Vite 6.x with `@vitejs/plugin-react`
- Both Vite dev server (port 1420) and Hono backend (port 3131) are running normally
- The issue would NOT occur on case-sensitive Linux filesystems
