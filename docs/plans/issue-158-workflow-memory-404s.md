# Issue #158 Plan: Workflow Memory 404s

## Goal

Stop normal app startup/settings usage from generating browser console noise for missing workflow memory prompt files.

## Acceptance Criteria

- [x] Missing workflow prompt overrides do not trigger browser-visible `404` noise during normal startup.
- [x] Repository workflow prompt overrides still load when present.
- [x] Regression coverage proves the loader treats missing files as a clean empty state.
- [ ] Manual verification confirms the console stays clean for the workflow-memory scenario.

## Plan

- [x] Inspect the workflow prompt bootstrap path and confirm where the `404`s originate.
- [x] Add a failing regression test for the missing-file startup path.
- [x] Change the loader to use the memory index as the source of truth for workflow prompt overrides.
- [x] Run targeted tests and attempt manual verification.
- [x] Update the engineering log and implementation note.

## Notes

- Manual browser verification is still blocked in this sandbox because local Vite port binding returned `EPERM`.
