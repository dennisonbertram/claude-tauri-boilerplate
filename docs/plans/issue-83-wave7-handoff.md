# Issue #83 handoff: checkpoint git rollback and message truncation

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
7. Confirm no console errors and the timeline no longer shows checkpoints after the selected one.

Note: perform this browser pass with the Chrome MCP tooling (`mcp__claude-in-chrome__*`) and capture at least one screenshot before and after rewind.
