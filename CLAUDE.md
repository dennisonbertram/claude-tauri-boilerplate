# CLAUDE.md - Project Policies for AI Agents

All agents working on this project MUST read and follow these policies.

---

## 1. Project Overview

This is **claude-tauri-boilerplate**, an MVP boilerplate project. We use best practices, keep code clean, and don't skimp on security -- but we don't over-engineer for enterprise scale. Keep things focused and reasonable.

---

## 2. Documentation Structure

All project documentation lives in `docs/`. Start with **`docs/INDEX.md`** -- it links to every subfolder.

Every docs subfolder has its own `INDEX.md` with a listing of files and descriptions.

**Rules:**
- When creating a new file in any docs folder, ALWAYS update that folder's `INDEX.md` to include it.
- When a file's content meaningfully changes, update the `INDEX.md` description to reflect the change.
- The top-level `docs/INDEX.md` links to all subfolder indexes. If you add a new subfolder, add it there too.

Current structure:

```
docs/
  INDEX.md                  # Master index -- start here
  research/INDEX.md         # Research notes, library evaluations
  design/INDEX.md           # Design documents, wireframes, architecture
  explorations/INDEX.md     # Spikes, proof-of-concepts
  plans/INDEX.md            # Feature plans with checklists
  investigations/INDEX.md   # Deep-dive tech investigations
  implementation/INDEX.md   # Code change documentation
  testing/INDEX.md          # Test results and validation
  decisions/INDEX.md        # Architecture decision records
  logs/INDEX.md             # Engineering, observational, and systems logs
  runbooks/INDEX.md         # Operational runbooks
  devlog/INDEX.md           # Chronological developer log
  context/INDEX.md          # Onboarding context for new agents
```

---

## 3. Strict TDD Policy

Test-Driven Development is mandatory. No exceptions.

1. **Write tests FIRST.** Before implementing any feature, write the tests that define correct behavior.
2. **Tests must be meaningful.** No trivial tests like `expect(true).toBe(true)`. Every test must assert something real about the system.
3. **Tests must not be underspecified.** Cover edge cases, error conditions, invalid inputs, and realistic scenarios -- not just the happy path.
4. **Tests must pass before any commit.** If tests fail, the commit is blocked. Fix the code, not the tests (unless the test itself is wrong).
5. **Bug fix protocol:**
   - Document the bug in the engineering log (`docs/logs/engineering-log.md`)
   - Write a regression test that **fails** (proving the bug exists)
   - Fix the bug
   - Verify the regression test now passes
   - Commit

---

## 4. Worktree Workflow

Never commit directly to `main`. All work happens in branches via git worktrees.

- Code-writing subagents MUST use `isolation: "worktree"` to get their own copy of the repo.
- Read-only subagents (research, investigation, exploration) do NOT need worktree isolation.
- When all tests pass in a worktree, merge the branch back to `main`.
- After a successful merge, clean up the worktree.

Flow:
```
1. Create worktree (branch is created automatically)
2. Do work in the worktree
3. Run tests -- all must pass
4. Merge branch to main
5. Delete the worktree
```

---

## 5. Feature Development Process

Before implementing any feature:

1. **Create a plan document** in `docs/plans/` with:
   - Feature description (what and why)
   - Acceptance criteria (how we know it's done)
   - Checklist of implementation steps
2. **Update `docs/plans/INDEX.md`** with the new plan.
3. As work progresses, **check items off the checklist** in the plan document.
4. When the feature is complete, mark the plan as done.

This keeps work trackable and lets any agent pick up where another left off.

---

## 6. Logging Requirements

Three logs are maintained in `docs/logs/`. Keep entries dated and concise.

### Engineering Log (`docs/logs/engineering-log.md`)
Record bugs found, fixes applied, and technical decisions made during development. This is the factual record of what happened and why.

Format:
```markdown
## YYYY-MM-DD
### [Brief title]
- **What:** Description of the bug/fix/decision
- **Why:** Reasoning or root cause
- **Result:** Outcome
```

### Observational Log (`docs/logs/observational-log.md`)
Track observations, patterns noticed, things that seem off, performance notes, UX concerns. These are things noticed but not necessarily acted on yet. Think of this as a scratchpad for future investigation.

### Systems Log (`docs/logs/systems-log.md`)
Document each system/module in the project: what it does, how systems interact, dependencies, and what you need to know to work on it. Update this as the architecture evolves. This is the living architecture reference.

---

## 7. GitHub Issues

When reviewing code or spotting problems:

- **Create a GitHub issue** so the work can be tracked and picked up by any agent.
- Issues must include:
  - Clear description of the problem or enhancement
  - Reproduction steps (for bugs)
  - Acceptance criteria (how we know it's fixed/done)
- Label issues appropriately: `bug`, `enhancement`, `documentation`, `tech-debt`, etc.
- Reference related plan documents or log entries when applicable.

---

## 8. Communication Style

- Use **plain language**. Avoid jargon unless it's necessary and well-known.
- The user manages many things and needs to understand how everything fits together at a **high level**.
- Agents handle the technical details; the user handles direction and decisions.
- Be **concise and clear** about what was done and what it means.
- Don't pad responses with filler. Say what matters, then stop.

---

## 9. Agent Task Completion

When an agent completes a task, it MUST report back with:

1. **What was completed** -- a clear summary in 1-3 sentences.
2. **What files were changed or created** -- list the paths.
3. **Any issues encountered** -- problems, blockers, things that didn't work as expected.
4. **Next steps** -- if there's follow-up work, say what it is.

Do not give vague summaries. Be specific about what changed and where.

---

## 10. Nightly Tasks

Automated agents can pick up work from **`docs/nightly-tasks.md`**.

Tasks listed there should be:
- **Atomic** -- one task, one concern, independently completable.
- **Well-described** -- clear enough that an agent can do it without asking questions.
- **Prioritized** -- most important tasks first.

When completing a nightly task, remove it from the list and log the completion in the engineering log.

---

## 11. MVP Mindset

This is an MVP. The goal is to build something that works well, not something that handles every edge case at planetary scale.

- Use best practices. Keep code DRY.
- Do NOT skimp on security. Auth, input validation, and data protection are always worth doing right.
- Do NOT optimize for enterprise scale. We don't need distributed caching, multi-region failover, or abstract factory patterns.
- Prefer simplicity over cleverness. If the simple approach works, use it.
- Avoid premature abstraction. Extract patterns when you see them repeated, not before.

---

## 12. Index Maintenance

This is important enough to restate clearly:

- Every `docs/` subfolder has an `INDEX.md`.
- **Creating a file?** Update that folder's `INDEX.md` immediately.
- **Changing a file's content significantly?** Update the `INDEX.md` description.
- **Adding a new docs subfolder?** Add it to `docs/INDEX.md`.
- Never leave an index stale. If you touched files in a docs folder, check the index.
