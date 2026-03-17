Reviewed and confirmed that the SSE timeout protection is already present in `apps/server/src/index.ts` (`idleTimeout: 0`), so no functional fix was needed.  
I added regression coverage to prevent that line being removed, and ran targeted validation.

- Changed files:
  - [apps/server/src/index.test.ts](/Users/dennisonbertram/Develop/claude-tauri-boilerplate/.claude/worktrees/issue-147/apps/server/src/index.test.ts)
  - [docs/plans/issue-147-wave-3-handoff.md](/Users/dennisonbertram/Develop/claude-tauri-boilerplate/.claude/worktrees/issue-147/docs/plans/issue-147-wave-3-handoff.md)

- Validation run:
  - `cd apps/server && bun test src/index.test.ts` — **pass**

- Notes:
  - The first run from root and then from `apps/server` failed due missing `@claude-tauri/shared` resolution in that Bun test invocation context, so I switched to a content-regression test that avoids importing the full server runtime graph.
  - No UI/browser verification was run (backend-only change).

If you want, I can add a stronger end-to-end streaming test (runtime-level) once the environment for Bun + shared package resolution is fully wired for server tests.