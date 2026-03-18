# Issue #85: AI Code Review with Customizable Prompts

## Feature Description

Add an AI-powered code review feature to the WorkspaceDiffView. A "Review" button triggers Claude to analyze the current workspace diff and return structured review comments with severity levels. The prompt can be customized per-repository. Settings allow selecting the model and thinking effort level for reviews.

## Acceptance Criteria

- [ ] "Review" button in WorkspaceDiffView triggers AI review of current workspace diff
- [ ] Review comments appear inline on the diff with AI badge
- [ ] Right-click review button opens CodeReviewDialog to edit prompt before sending
- [ ] Customize code review prompts per repository (via Workflows settings)
- [ ] Select default model for reviews (`codeReviewModel` setting)
- [ ] Select thinking level for reviews (`codeReviewEffort` setting)
- [ ] Review summary displayed prominently (CodeReviewSummary component)
- [ ] Code review index for navigating review comments

## Implementation Checklist

- [ ] Add `CodeReviewComment` and `CodeReviewResult` types to `packages/shared/src/types.ts`
- [ ] Write regression tests in `apps/server/src/routes/code-review.test.ts` (TDD - red phase)
- [ ] Implement backend endpoint `apps/server/src/routes/code-review.ts`
- [ ] Register route in `apps/server/src/app.ts`
- [ ] Add `codeReviewModel` and `codeReviewEffort` to `AppSettings`
- [ ] Add model/effort selectors to Workflows settings tab
- [ ] Create `CodeReviewDialog` component
- [ ] Add Review button to `WorkspaceDiffView` toolbar
- [ ] Add `codeReview` to `workflowPrompts` and `WorkflowPrompts` type
- [ ] Render AI review comments inline in diff view
- [ ] Create `CodeReviewSummary` component
- [ ] Add `fetchCodeReview` to `workspace-api.ts`
- [ ] Update docs indexes
