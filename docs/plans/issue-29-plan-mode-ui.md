# Issue #29: Plan Mode - Planning UI with Approve/Reject Flow

## Overview

Add a Plan Mode UI that displays agent-proposed plans and lets users approve or reject them. The Claude Agent SDK supports a "plan" permission mode where the agent proposes a plan before executing. We need shared types, frontend components, backend endpoint, and event mapping.

## Acceptance Criteria

- Plan content streams into the UI as it arrives
- Users can approve a plan with one click
- Users can reject a plan and provide feedback
- Plan shows status: Planning..., Review Plan, Approved, Rejected
- Approved plans collapse to a summary
- Plan is visually distinct (blue/purple border)
- Backend endpoint accepts plan decisions
- All tests pass

## Implementation Checklist

### Phase 1: Shared Types
- [x] Add `StreamPlanStart`, `StreamPlanContent`, `StreamPlanComplete`, `StreamPlanApproved`, `StreamPlanRejected` to `packages/shared/src/types.ts`
- [x] Add `PlanDecisionRequest` type for the plan decision endpoint
- [x] Add plan event types to `StreamEvent` union

### Phase 2: Backend
- [x] Create `PlanStore` in `apps/server/src/services/plan-store.ts` (similar to PermissionStore)
- [x] Create plan route in `apps/server/src/routes/plan.ts` with `POST /` endpoint
- [x] Register route in `apps/server/src/app.ts` at `/api/chat/plan`
- [x] Add plan event mapping in `apps/server/src/services/event-mapper.ts`

### Phase 3: Backend Tests (TDD - written first)
- [x] `apps/server/src/routes/plan.test.ts` - plan endpoint validation
- [x] `apps/server/src/services/event-mapper-plan.test.ts` - plan event mapping

### Phase 4: Frontend State
- [x] Add plan state to `useStreamEvents` reducer
- [x] Handle `plan:start`, `plan:content`, `plan:complete`, `plan:approved`, `plan:rejected` events

### Phase 5: Frontend Component
- [x] Create `apps/desktop/src/components/chat/PlanView.tsx`
- [x] Integrate into `ChatPage.tsx`

### Phase 6: Frontend Tests (TDD - written first)
- [x] `apps/desktop/src/components/chat/__tests__/PlanView.test.tsx`

## Status: COMPLETE
