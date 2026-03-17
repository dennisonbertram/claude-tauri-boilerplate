# Issue #83 handoff: checkpoint git rollback and message truncation

## Wave 8 completion update

- Checkpoints are now created once per completed turn, including turns with no file changes.
- Rewind now reloads persisted session messages after confirmation so the chat UI reflects the truncated history immediately.
- The checkpoint timeline now shows a `View changes` action for the most recent checkpoint pair when git commits are available.
- Added a lightweight latest-turn diff dialog plus regression coverage for:
  - end-of-turn checkpoint creation
  - empty-change checkpoint payloads
  - post-rewind message refresh
  - latest-turn change action wiring

## Targeted automated validation

- `cd apps/server && bun test src/routes/checkpoints.test.ts`
- `cd apps/desktop && pnpm test -- useCheckpoints CheckpointTimeline ChatPageRewindRefresh`

Result:
- server: `17 pass, 0 fail`
- desktop targeted run: `75 files passed, 992 tests passed`

## Manual browser verification (required)

1. Start the app stack and open chat:
   - `pnpm dev:all`
   - `http://localhost:1420` (desktop window if using Tauri)
2. Open a workspace-backed session or create one with a sample repo.
3. In chat, run a couple of turns that produce file changes so checkpoints are auto-created.
4. Open the checkpoint timeline and verify entries appear in order with prompt previews.
5. Select a checkpoint and open the rewind dialog:
   - Confirm the preview shows estimated message removal and affected files.
6. Test each mode:
   - **Code & Conversation**: after confirm, working tree and files should reflect checkpoint snapshot; conversation length should shrink.
   - **Conversation only**: files remain changed; conversation trims to the checkpoint message count.
   - **Code only**: files revert to checkpoint snapshot; conversation length remains unchanged.
   - Verify rewind API success payload includes `restoredWorktreePath` (non-null for code modes, `null` for conversation-only) to confirm the restore target path.
7. After at least two checkpoints with git commits exist, click `View changes` on the latest checkpoint:
   - verify the diff dialog opens
   - verify the latest-turn diff content loads without console errors
7. Confirm no console errors and the timeline no longer shows checkpoints after the selected one.

Note: perform this browser pass with the Chrome MCP tooling (`mcp__claude-in-chrome__*`) and capture at least one screenshot before and after rewind.
