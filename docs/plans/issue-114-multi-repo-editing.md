# Issue #114 - Multi-repo editing with `/add-dir`

## Goal

Support a bounded MVP for multi-repo editing by letting a workspace store additional writable directories, forwarding those directories into Claude runs, and exposing directory management from the workspace UI.

## Scope

- Persist additional writable directories on workspaces.
- Expose directory management from workspace UI as a `/add-dir` equivalent.
- Pass additional directories into Claude Agent SDK query options.
- Keep directory labels and search behavior readable when multiple repos are attached.

## Checklist

- [ ] Add regression tests for workspace directory persistence and chat passthrough.
- [ ] Add a workspace settings UI for managing additional writable directories.
- [ ] Store the directories in the workspace database record and return them through the API.
- [ ] Forward the directories into Claude Agent SDK runs.
- [ ] Add targeted validation notes for backend and frontend behavior.

