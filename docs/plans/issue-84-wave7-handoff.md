# Issue #84 Wave 8 completion handoff

## Scope completed

- Plan mode remains toggleable through **Settings → Advanced → Permission Mode**.
- Plans render in a dedicated `PlanView` panel before implementation.
- The plan panel now supports:
  - approve
  - reject with feedback
  - approve with feedback
  - provide additional user input to continue planning
  - copy plan
  - export plan into a new chat draft
  - handoff copy for another agent
- Plans are archived under `.context/plans/`.
- Plan UI now uses a distinct user-input icon/state while the user is entering follow-up answers or feedback.

## Targeted automated validation

- `cd apps/server && bun test src/routes/plan.test.ts`
  - Result: `14 pass, 0 fail`
- `cd apps/desktop && vitest run src/components/chat/__tests__/PlanView.test.tsx src/components/chat/__tests__/ChatPageTransport.test.tsx`
  - Result: `29 pass, 0 fail`

## Manual browser-control verification note

1. Start the app on port `1420`.
2. Open **Settings → Advanced** and set **Permission Mode** to `Plan`.
3. Send a prompt that should produce a plan.
   - Expected: the dedicated plan panel appears before any implementation work.
4. Use each plan action:
   - `Approve`
   - `Approve with Feedback`
   - `Reject`
   - `Provide Input`
   - `Copy`
   - `Export to New Chat`
   - `Handoff`
5. Confirm `.context/plans/` now contains the archived plan file.
6. After **Export to New Chat**, confirm the new chat opens with a draft seeded from the plan.

## Notes

- The additional user-input path is the planning follow-up loop: it lets users answer Claude’s planning questions or provide clarifications without leaving plan mode.
