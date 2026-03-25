# Context Packet — Session 2026-03-25

## Current Milestone
Context Window Visualization feature — planning complete, ready for implementation.

## Key Decisions
- No server changes needed — all token data available client-side
- Donut chart via CSS conic-gradient (no chart library)
- Follow CostDialog modal pattern
- Button in ChatInputToolbar left side
- 5 tasks: 001 then 002 then (003 parallel 004) then 005

## Architecture Notes
- useStreamEvents provides cumulativeUsage
- useCostTracking provides messageCosts
- contextUsage prop already threaded to ChatInput
- ContextIndicator.tsx has percentage/color logic to reuse
