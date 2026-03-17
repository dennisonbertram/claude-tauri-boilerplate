# Issue #80: Diff Viewer Enhancements

## Scope

- Add range-aware diff and changed-file APIs for historical review.
- Add workspace revision lookup for historical review actions.
- Update workspace diff view to support unified/side-by-side modes.
- Add inline comment scaffolding with markdown rendering in diff lines.
- Add file review actions (review filters and per-file review status).
- Keep changes scoped to diff view and diff endpoints only.

## Acceptance Checklist

- [ ] Backend endpoints accept `fromRef`/`toRef` for historical comparisons.
- [ ] Backend exposes `GET /api/workspaces/:id/revisions`.
- [ ] Diff viewer supports unified and side-by-side rendering modes.
- [ ] Inline line comment composer appears in diff UI and displays markdown previews.
- [ ] File review actions and filter UI are available in the diff view.
- [ ] Existing related tests are updated with focused coverage.
- [ ] New implementation note includes verification outcomes and follow-up risks.
- [ ] Add inline comment/preview flow manual browser-control verification note in this plan (target file: `src/components/workspaces/WorkspaceDiffView`).
