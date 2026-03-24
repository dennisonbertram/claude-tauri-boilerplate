# Issue #350: Can't Add Agents to Existing Team

## Summary

The backend API supports adding agents to existing teams (`POST /:id/agents`), but the **frontend has no UI to invoke it**. The `TeamWorkspace` component (the team detail view) only displays existing agents in a read-only sidebar with no "Add Agent" button or dialog. The `TeamCreationDialog` agent form is only used during team creation and is not reusable for editing.

## Architecture Overview

### Data Flow

1. **Shared types** (`packages/shared/src/types.ts`, lines 522-560):
   - `AgentDefinition` - name, description, model, tools, permissionMode
   - `TeamConfig` - id, name, agents[], displayMode, createdAt
   - `TeammateStatus` - name, status, currentTask, model, tools

2. **Server API** (`apps/server/src/routes/teams.ts`):
   - `POST /api/teams` - Create team with agents (line 37)
   - `GET /api/teams/:id` - Get team detail + agent statuses (line 96)
   - `POST /api/teams/:id/agents` - **Add agent to existing team** (line 125)
   - `DELETE /api/teams/:id/agents/:name` - **Remove agent from team** (line 162)
   - `POST /api/teams/:id/shutdown` - Shutdown all agents (line 267)

3. **Frontend hook** (`apps/desktop/src/hooks/useTeams.ts`):
   - `createTeam()` - calls POST /api/teams (line 61)
   - `deleteTeam()` - calls DELETE /api/teams/:id (line 90)
   - `shutdownTeam()` - calls POST /api/teams/:id/shutdown (line 109)
   - **MISSING: `addAgent()` function** - no wrapper for `POST /api/teams/:id/agents`
   - **MISSING: `removeAgent()` function** - no wrapper for `DELETE /api/teams/:id/agents/:name`

4. **Frontend components**:
   - `TeamsView` (`apps/desktop/src/components/teams/TeamsView.tsx`) - list + create dialog
   - `TeamCreationDialog` (`apps/desktop/src/components/teams/TeamCreationDialog.tsx`) - agent form (creation only)
   - `TeamWorkspace` (`apps/desktop/src/components/teams/TeamWorkspace.tsx`) - detail view (read-only agents sidebar)
   - `TeammateCard` (`apps/desktop/src/components/teams/TeammateCard.tsx`) - individual agent display card

## Root Cause

The backend has full CRUD for agents within a team, but the frontend is missing:

1. **`useTeams` hook** does not expose `addAgent(teamId, agent)` or `removeAgent(teamId, agentName)` functions.
2. **`TeamWorkspace`** renders agents in a read-only sidebar (lines 100-116) with no "Add Agent" button.
3. **`TeamCreationDialog`** agent form is tightly coupled to team creation -- it builds `AgentDefinition[]` inline and passes them to `onCreate`. There is no reusable agent editor component.

## Existing Agent Selection Code (TeamCreationDialog)

The agent form in `TeamCreationDialog` (lines 195-277) renders per-agent cards with:

```tsx
// Line 195-277 of TeamCreationDialog.tsx
{agents.map((agent, index) => (
  <div key={index} data-testid={`agent-form-${index}`} className="rounded-lg border border-border p-3 space-y-2">
    {/* Header with remove button */}
    <div className="flex items-center justify-between">
      <span className="text-xs font-medium text-muted-foreground">Agent {index + 1}</span>
      {agents.length > 1 && (
        <button data-testid={`remove-agent-${index}`} onClick={() => removeAgent(index)}>Remove</button>
      )}
    </div>
    {/* Name + model row */}
    <div className="grid grid-cols-2 gap-2">
      <input data-testid={`agent-name-${index}`} value={agent.name} ... placeholder="Agent name" />
      <select data-testid={`agent-model-${index}`} value={agent.model ?? ''} ...>
        <option value="">Default model</option>
        {MODEL_OPTIONS.map(...)}
      </select>
    </div>
    {/* Description */}
    <input data-testid={`agent-description-${index}`} value={agent.description} ... placeholder="What does this agent do?" />
    {/* Permission mode */}
    <select data-testid={`agent-permission-${index}`} value={agent.permissionMode ?? 'normal'} ...>
      {PERMISSION_MODES.map(...)}
    </select>
  </div>
))}
```

The "+ Add Agent" button (line 187-192):
```tsx
<button data-testid="add-agent-button" onClick={addAgent}>+ Add Agent</button>
```

## Implementation Plan

### Step 1: Add `addAgent` and `removeAgent` to `useTeams` hook

**File**: `apps/desktop/src/hooks/useTeams.ts`

Add two new functions:

```ts
const addAgent = useCallback(
  async (teamId: string, agent: AgentDefinition) => {
    try {
      const res = await apiFetch(`/api/teams/${teamId}/agents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(agent),
      });
      if (!res.ok) {
        const body = await res.json();
        setError(body.error ?? 'Failed to add agent');
        return false;
      }
      await fetchTeamDetail(teamId);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error');
      return false;
    }
  },
  [fetchTeamDetail]
);

const removeAgent = useCallback(
  async (teamId: string, agentName: string) => {
    try {
      const res = await apiFetch(`/api/teams/${teamId}/agents/${encodeURIComponent(agentName)}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const body = await res.json();
        setError(body.error ?? 'Failed to remove agent');
        return false;
      }
      await fetchTeamDetail(teamId);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error');
      return false;
    }
  },
  [fetchTeamDetail]
);
```

Return them from the hook alongside existing functions.

### Step 2: Extract reusable `AgentFormFields` component

**New file**: `apps/desktop/src/components/teams/AgentFormFields.tsx`

Extract the per-agent form fields from `TeamCreationDialog` into a standalone component that can be reused in both creation and add-to-existing-team dialogs.

### Step 3: Create `AddAgentDialog` component

**New file**: `apps/desktop/src/components/teams/AddAgentDialog.tsx`

A simpler dialog (compared to TeamCreationDialog) that:
- Shows a single agent form (name, description, model, permission mode)
- Calls `addAgent(teamId, agentDefinition)` on submit
- Validates the agent has name + description before submitting

### Step 4: Add "Add Agent" button to `TeamWorkspace`

**File**: `apps/desktop/src/components/teams/TeamWorkspace.tsx`

In the agents sidebar (lines 100-116), add:
- An "Add Agent" button below the agent list header
- Render `AddAgentDialog` controlled by local state
- Pass `addAgent` from `useTeams` through props or restructure to access hook directly

### Step 5: Wire `TeamsView` to pass `addAgent`/`removeAgent`

**File**: `apps/desktop/src/components/teams/TeamsView.tsx`

- Destructure `addAgent` and `removeAgent` from `useTeams()`
- Pass them through to `TeamWorkspace` as props

### Step 6: Add remove functionality to `TeammateCard`

**File**: `apps/desktop/src/components/teams/TeammateCard.tsx`

The component already accepts an `onStop` prop (line 18). Add an `onRemove` prop with similar UX (confirmation before removal).

## Files to Modify

| File | Change |
|------|--------|
| `apps/desktop/src/hooks/useTeams.ts` | Add `addAgent()`, `removeAgent()` functions |
| `apps/desktop/src/components/teams/TeamWorkspace.tsx` | Add "Add Agent" button + dialog |
| `apps/desktop/src/components/teams/TeamsView.tsx` | Pass new functions through to TeamWorkspace |
| `apps/desktop/src/components/teams/TeammateCard.tsx` | Add `onRemove` prop |
| `apps/desktop/src/components/teams/AgentFormFields.tsx` | **NEW** - Extracted reusable agent form |
| `apps/desktop/src/components/teams/AddAgentDialog.tsx` | **NEW** - Dialog for adding agent to existing team |

## API Endpoints (Already Implemented)

Both server endpoints exist and are tested in `apps/server/src/routes/teams.test.ts`:

- `POST /api/teams/:id/agents` (line 125 of teams.ts) - accepts `AgentDefinition` body, validates name/description, checks for duplicates, returns updated team
- `DELETE /api/teams/:id/agents/:name` (line 162 of teams.ts) - removes agent by name, returns updated team
