# Feature: Context Window Visualization

## Overview
Add a context window visualization feature that shows users how much of the AI model's context window has been consumed and what's using it. Two modes:
1. **Inline indicator** — always visible below chat input, showing remaining context as compact summary
2. **Modal view** — opened via toolbar button, showing detailed visual breakdown

## Current State
- ContextIndicator.tsx exists with basic percentage bar + hover tooltip
- useStreamEvents.ts tracks CumulativeUsage (inputTokens, outputTokens, cacheReadTokens, cacheCreationTokens)
- useCostTracking.ts tracks per-message costs with token breakdowns
- ChatInputToolbar.tsx has cost pill + model display in toolbar
- CostDialog.tsx provides modal pattern to follow
- contextUsage prop already threaded through ChatInput
- Models: Sonnet 4.6, Opus 4.6, Haiku 4.5

## Architecture

### Data Model
No server changes needed — all data available client-side via:
- cumulativeUsage from useStreamEvents (total tokens across turns)
- messageCosts from useCostTracking (per-message token breakdown)
- contextUsage already passed as prop to ChatInput

Need to add maxTokens context window sizes per model (all 200k).

### Components

#### 1. Enhanced Inline Indicator
Location: Below chat input (where contextUsage display currently lives)
Behavior: Mini progress bar + "X% context remaining", color-coded. Clicking opens modal.

#### 2. Context Visualization Button
Location: ChatInputToolbar.tsx — left side
Behavior: Icon button (ChartPie from Phosphor) opens modal

#### 3. Context Visualization Modal
Location: New file ContextVisualizationModal.tsx

Modal contents:
- Header: "Context Window" + model name + close button
- Donut chart: CSS conic-gradient showing proportions (Input/Output/Cache/Remaining)
- Stats grid: Total used/max, per-category with percentages
- Per-message breakdown: Scrollable list with mini-bars

## Task Breakdown

### TASK-001: Add model context limits
- Type: feature
- Scope: Add contextWindow field to model definitions
- Files: apps/desktop/src/lib/models.ts
- Tests: Unit test for context window lookup

### TASK-002: Create ContextVisualizationModal component
- Type: feature
- Scope: Modal with donut chart, stats grid, per-message breakdown
- Files: apps/desktop/src/components/chat/ContextVisualizationModal.tsx, test file
- Dependencies: TASK-001

### TASK-003: Add context button to toolbar + wire up modal
- Type: feature
- Scope: Button in ChatInputToolbar, modal state in ChatInput
- Files: ChatInputToolbar.tsx, types.ts, ChatInput.tsx
- Dependencies: TASK-002

### TASK-004: Enhance inline context display
- Type: feature
- Scope: Replace plain text with clickable mini progress bar
- Files: ChatInput.tsx
- Dependencies: TASK-002

### TASK-005: Integration wiring in ChatPage
- Type: feature
- Scope: Thread messageCosts from ChatPage to modal
- Files: ChatPage.tsx, types.ts
- Dependencies: TASK-003, TASK-004

## Execution Strategy
TASK-001 then TASK-002 then (TASK-003 parallel with TASK-004) then TASK-005

## Visual Design Notes
- Follow CostDialog pattern: fixed overlay, click-outside-to-close, rounded-xl
- CSS conic-gradient donut chart (no chart library)
- Colors: Input=blue-500, Output=purple-500, CacheRead=cyan-500, CacheWrite=amber-500, Remaining=muted
- Modal max-w-md, dark mode compatible via Tailwind
