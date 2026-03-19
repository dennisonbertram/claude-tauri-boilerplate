# Agent Builder Phase 2 — Visual Hook Builder Spec

**Date**: 2026-03-19
**Status**: In Progress
**Scope**: Visual React Flow canvas for composing Claude Code hooks

---

## Overview

Phase 1 added JSON textareas for hooks. Phase 2 replaces the Hooks tab with a dual-view interface: a **List View** (existing JSON textarea) and a **Canvas View** (React Flow drag-and-drop builder). Both views share the same underlying `hooksJson` data — the canvas compiles to JSON, and existing JSON can be loaded into the canvas.

---

## Hooks JSON Format (Claude Code)

The canonical format for Claude Code hooks:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          { "type": "command", "command": "echo 'running bash'" }
        ]
      }
    ],
    "Stop": [
      {
        "hooks": [
          { "type": "command", "command": "notify-send 'Claude stopped'" }
        ]
      }
    ]
  }
}
```

**Events (triggers):**
`SessionStart`, `SessionEnd`, `PreToolUse`, `PostToolUse`, `Stop`, `SubagentStop`, `UserPromptSubmit`, `PreCompact`, `Notification`

**Hook types (actions):**
- `command` — `{ type: "command", command: string, timeout?: number }`
- `http` — `{ type: "http", url: string, method?: string, headers?: object, timeout?: number }`
- `prompt` — `{ type: "prompt", prompt: string, model?: string }`
- `agent` — `{ type: "agent", description: string }`

**Matcher:** Optional regex string on the hook group (not individual hooks). `PreToolUse`/`PostToolUse` typically use matchers like `"Bash"`, `"Edit|Write"`.

---

## Canvas Data Model

### Node Types

```typescript
type CanvasNodeType = 'trigger' | 'condition' | 'action';

// TriggerNode data
interface TriggerNodeData {
  event: string; // e.g. "PreToolUse"
  label: string;
}

// ConditionNode data (matcher group)
interface ConditionNodeData {
  matcher: string; // regex, e.g. "Bash|Edit"
  label: string;
}

// ActionNode data
interface ActionNodeData {
  hookType: 'command' | 'http' | 'prompt' | 'agent';
  // command
  command?: string;
  timeout?: number;
  // http
  url?: string;
  method?: string;
  headers?: Record<string, string>;
  // prompt
  prompt?: string;
  model?: string;
  // agent
  description?: string;
  label: string;
}
```

### Connection Rules
- `trigger` → `condition` ✅
- `trigger` → `action` ✅
- `condition` → `action` ✅
- `action` → anything ❌ (actions are leaf nodes)
- `condition` → `trigger` ❌
- `action` → `condition` ❌

---

## File Structure

```
apps/desktop/src/
├── components/agent-builder/
│   ├── HookCanvas.tsx           # Main React Flow canvas component
│   ├── nodes/
│   │   ├── TriggerNode.tsx      # Event trigger node
│   │   ├── ConditionNode.tsx    # Matcher/condition node
│   │   └── ActionNode.tsx       # Hook action node
│   ├── panels/
│   │   ├── NodePalette.tsx      # Left sidebar: draggable node templates
│   │   └── NodeConfigPanel.tsx  # Right sidebar: selected node config
│   └── tabs/
│       └── HooksTab.tsx         # MODIFY: add canvas/list toggle
└── lib/
    ├── canvasCompiler.ts        # canvas nodes+edges → hooks JSON string
    ├── canvasGenerator.ts       # hooks JSON string → canvas nodes+edges
    └── connectionRules.ts       # isValidConnection() function
```

No new backend changes. `hooksCanvasJson` column already exists in `agent_profiles`.

---

## Component Specs

### HookCanvas.tsx

```tsx
interface HookCanvasProps {
  hooksJson: string | null;
  hooksCanvasJson: string | null;
  onChange: (hooksJson: string, hooksCanvasJson: string) => void;
  readOnly?: boolean;
}
```

- Uses `ReactFlow` from `@xyflow/react`
- `nodeTypes` = `{ trigger: TriggerNode, condition: ConditionNode, action: ActionNode }`
- Left panel: `NodePalette` (draggable nodes, 200px wide)
- Right panel: `NodeConfigPanel` (shown when node selected, 260px wide)
- Toolbar: zoom in/out, fit view, clear canvas
- On change: compile to hooksJson via `canvasCompiler`, serialize canvas to hooksCanvasJson
- On mount: if hooksCanvasJson exists, load it; else if hooksJson exists, generate from it

### TriggerNode.tsx

Visual: Purple header with lightning bolt icon, event name dropdown inside, drag handle at top.
Handles: source (bottom only).
Style: `border-2 border-purple-500/50 bg-purple-900/20 rounded-lg`

### ConditionNode.tsx

Visual: Blue header with filter icon, matcher regex input inside.
Handles: target (top), source (bottom).
Style: `border-2 border-blue-500/50 bg-blue-900/20 rounded-lg`

### ActionNode.tsx

Visual: Green header with play icon, action type badge, key config fields inside.
Handles: target (top) only — leaf node.
Style: `border-2 border-green-500/50 bg-green-900/20 rounded-lg`

### NodePalette.tsx

Draggable template cards for:
- **Triggers** (9 events)
- **Condition** (matcher)
- **Actions** (command, http, prompt, agent)

On drag start: set `dataTransfer.setData('application/reactflow', JSON.stringify({ type, data }))`.

### NodeConfigPanel.tsx

Shown when a node is selected. Renders appropriate form based on node type:
- Trigger: event dropdown
- Condition: matcher input + regex test tool
- Action: switches on hookType — shows relevant fields

### canvasCompiler.ts

```typescript
export function compileCanvasToHooks(
  nodes: Node[],
  edges: Edge[]
): string // JSON string matching hooks format
```

Algorithm:
1. Find all trigger nodes
2. For each trigger, find connected conditions (direct edges from trigger)
3. For each condition, find connected actions
4. For triggers with direct action connections (no condition), group them without matcher
5. Build the hooks JSON structure

### canvasGenerator.ts

```typescript
export function generateCanvasFromHooks(
  hooksJson: string
): { nodes: Node[]; edges: Edge[]; } | null
```

Algorithm:
1. Parse hooksJson
2. For each event key (trigger), create a TriggerNode
3. For each hook group with a matcher, create a ConditionNode
4. For each hook in the group, create an ActionNode
5. Auto-layout: triggers at x=0, conditions at x=300, actions at x=600, y spaced by 150px

### connectionRules.ts

```typescript
export function isValidConnection(
  sourceType: CanvasNodeType,
  targetType: CanvasNodeType
): boolean
```

### HooksTab.tsx (modifications)

Add toggle at top: `[📋 JSON] [🎨 Canvas]` buttons.
- JSON view: existing textarea (keep as-is)
- Canvas view: render `<HookCanvas />` with the profile's hooksJson/hooksCanvasJson
- When canvas changes, call parent's `onChange` with new hooksJson + hooksCanvasJson

---

## Dependencies to Install

```bash
cd apps/desktop && pnpm add @xyflow/react
```

Import CSS in main entry: `import '@xyflow/react/dist/style.css';`

---

## Repomix Include Pattern

```
apps/desktop/src/components/agent-builder/HookCanvas.tsx,apps/desktop/src/components/agent-builder/nodes/**,apps/desktop/src/components/agent-builder/panels/**,apps/desktop/src/components/agent-builder/tabs/HooksTab.tsx,apps/desktop/src/lib/canvasCompiler.ts,apps/desktop/src/lib/canvasGenerator.ts,apps/desktop/src/lib/connectionRules.ts
```

---

## Wave Decomposition

### Wave 1: Foundation (parallel)
- **1A**: Install @xyflow/react + CSS import + canvas types + connectionRules.ts
- **1B**: canvasCompiler.ts + canvasGenerator.ts

### Wave 2: UI Components (parallel, after Wave 1)
- **2A**: TriggerNode + ConditionNode + ActionNode
- **2B**: NodePalette + NodeConfigPanel

### Wave 3: Integration (after Wave 2)
- **3**: HookCanvas.tsx + update HooksTab.tsx
