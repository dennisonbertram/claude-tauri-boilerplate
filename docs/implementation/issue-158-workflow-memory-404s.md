# Issue #158: Workflow Memory 404s

## Summary

The workflow prompt bootstrap path used to probe each repository override file individually through `/api/memory/:filename`. When the repo had no workflow prompt overrides yet, the browser still issued six normal startup requests that each returned `404`, which showed up as noisy console errors even though the app correctly fell back to defaults.

## Change

- Switched `loadRepoWorkflowPrompts()` to fetch the `/api/memory` index once.
- Derived known workflow prompt overrides from the returned file list instead of probing each filename separately.
- Kept the existing save/update/delete behavior unchanged so repository overrides still persist as individual memory files.

## Regression Coverage

- `apps/desktop/src/lib/workflowPrompts.test.ts`
  Verifies the loader reads overrides from the memory index and does not probe missing files individually.
- `apps/desktop/src/hooks/useSettings.test.ts`
  Verifies settings hydration still applies repository workflow overrides on mount.

## Validation

- `pnpm exec vitest run src/lib/workflowPrompts.test.ts`
- `pnpm exec vitest run src/hooks/useSettings.test.ts -t "hydrates repository workflow prompt overrides on mount"`

Manual browser verification was attempted, but this sandbox blocked local port binding for Vite and prevented a live frontend smoke check.
