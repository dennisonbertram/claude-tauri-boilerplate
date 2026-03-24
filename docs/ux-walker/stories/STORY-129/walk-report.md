# STORY-129: Handle Agent Stop from Sidebar

## Status: NOT_TESTABLE

## Steps Taken
1. Examined team workspace for agent stop controls
2. No explicit "stop" button found on individual agents in sidebar
3. "Shutdown All" button exists in team header but affects all agents
4. Agents are in "Idle" state so no running agent to stop

## Observations
- No per-agent stop button visible in sidebar when agents are idle
- "Shutdown All" button available for team-level shutdown
- Individual agent stop may only appear when agent is running
- Cannot fully test without running agents
