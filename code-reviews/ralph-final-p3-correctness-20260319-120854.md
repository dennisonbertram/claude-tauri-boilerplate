## Audit summary (Visual Hook Builder → Claude Code hooks JSON)

Overall architecture is coherent (React Flow canvas ↔ generator ↔ compiler), but there are several **HIGH** issues where invariants are not enforced and/or compilation can silently produce unexpected hooks JSON (including potentially broader-than-intended hook execution).

---

## CRITICAL issues

None found that are guaranteed to crash at runtime in typical flows.

---

## HIGH issues

### 1) **Canvas does not resync from props after mount (stale state risk)**
**File:** `src/components/agent-builder/HookCanvas.tsx`  
The initialization `useEffect` has an empty dependency array and is guarded by `initialized.current`. If `hooksJson` / `hooksCanvasJson` changes while the canvas is mounted (e.g. draft swapped externally, remote load, undo/redo at parent level), the canvas will **not** reload and will continue editing stale nodes/edges.

**Impact:** invalid state transitions; user sees one thing, saved JSON reflects another.  
**Fix:** add a controlled “source of truth” strategy:
- either fully control nodes/edges from props, or
- reinitialize when `hooksCanvasJson`/`hooksJson` changes (with safeguards to avoid clobbering local edits), or
- key the canvas component by a stable draft id so it remounts on draft change.

---

### 2) **Opening Canvas view can mutate hooks JSON without user edits**
**File:** `HookCanvas.tsx`  
Even though the “structural change” effect skips the *first render*, it does **not** skip the first *meaningful initialization update* (loading saved canvas JSON or generating from hooks JSON). After nodes/edges are set, the structural fingerprint changes and `notifyChange()` fires, calling `onChange()` and rewriting:
- `hooksJson` to `compileCanvasToHooks(...)` output (often normalized/pretty-printed and potentially semantically different vs original ordering/grouping),
- `hooksCanvasJson` to a new serialized state.

**Impact:** unexpected dirtying of the draft, potentially surprising diffs, and can overwrite hand-authored JSON formatting/ordering.  
**Fix:** suppress `notifyChange` until after initialization is complete (e.g. a `didInit` ref that only enables compilation after the first user-driven edit), or compute & compare compiled JSON to incoming `hooksJson` before calling `onChange`.

---

### 3) **Compiler silently drops hooks when an Action is connected to multiple parents**
**File:** `src/lib/canvasCompiler.ts`  
`processedActionIds` is used per-trigger to deduplicate actions:

```ts
if (processedActionIds.has(id)) continue;
...
processedActionIds.add(id);
```

If an **action node** is (intentionally or accidentally) connected to:
- multiple condition nodes under the same trigger, or
- both directly to a trigger and via a condition,

then the action will only appear in the first encountered group; subsequent groups silently omit it.

**Impact:** compiled hooks JSON is incomplete vs the visual graph; invariant “graph meaning == compiled meaning” is broken.  
**Fix options:**
- Enforce invariant in the editor: **actions must have exactly one incoming edge** (preferred), OR
- Remove this dedupe logic and allow the same action to appear in multiple groups (less likely desired), OR
- Emit a validation error/warning and block compile.

---

### 4) **MAX_EDGES invariant not maintained during editing**
**File:** `HookCanvas.tsx`  
You cap edges on load (`hooksCanvasJson`) and generation (`canvasGenerator.ts`), but **not** when users connect nodes. `onConnect` adds edges without checking `MAX_EDGES`.

**Impact:** users can exceed intended limits; can bloat saved `hooksCanvasJson`, slow fingerprinting/serialization, and produce unexpectedly large output.  
**Fix:** in `onConnect`, check `edges.length >= MAX_EDGES` (or use updater form and check `eds.length`), and refuse/add warning.

---

### 5) **Empty Condition matcher compiles to “no matcher” (effectively match-all)**
**Files:** `NodePalette.tsx`, `NodeConfigPanel.tsx`, `canvasCompiler.ts`  
Condition template defaults to `matcher: ''`. Compiler only sets `group.matcher` if truthy:

```ts
if (condData.matcher) group.matcher = ...
```

So a condition node left blank produces a group **without matcher**, which in many hook schemas is “apply to all tools” (or if runtime treats empty regex as match-all, same effect). UI text “No matcher” is ambiguous; many users interpret blank as “disabled / matches nothing”.

**Impact:** hooks can run much more broadly than intended (safety risk, especially with command/http hooks).  
**Fix:** choose one explicit behavior:
- Require matcher for condition nodes; if empty, don’t compile that branch and show validation, OR
- Treat empty as `.*` but render that explicitly and label it “Match all”, OR
- Prevent connecting from a condition with empty matcher.

---

### 6) **Type-soundness/build fragility: reliance on global `React` namespace types**
**Files:** `NodeConfigPanel.tsx`, `NodePalette.tsx`, `HookCanvas.tsx`  
These use `React.FC`, `React.ReactNode`, and `React.DragEvent` without importing `React` as a type. This works only if the project’s TS setup exposes the global `React` namespace from `@types/react` in the current module mode / lint setup.

**Impact:** builds/lint can fail depending on tsconfig/eslint configuration.  
**Fix:** add explicit type imports:

```ts
import type React from 'react';
```

(or avoid `React.FC` entirely and type props directly).

---

## MEDIUM issues

### 1) Loaded `hooksCanvasJson` is only minimally validated/sanitized
**File:** `HookCanvas.tsx`  
You validate array existence and counts, but not:
- node `type` is one of known types,
- `position.x/y` are finite numbers,
- `data` sizes / nested objects (which you otherwise try to keep flat on DnD).

**Impact:** malformed persisted state can degrade performance or cause incorrect compilation.  
**Fix:** apply a validation/sanitization pass similar to `sanitizeNodeData` for loaded nodes, and validate node shape + edge references.

---

### 2) Updates from config panel bypass sanitization/length caps
**File:** `HookCanvas.tsx` (`onUpdateNode`)  
DnD sanitizes strings to `MAX_STRING_LENGTH`, but typing into config panel can create arbitrarily large strings, and nothing prevents adding unexpected keys.

**Impact:** performance/memory bloat; very large saved JSON; slower fingerprint JSON.stringify.  
**Fix:** sanitize/trim in `onUpdateNode` (per-field limits consistent with compiler limits).

---

### 3) Selected node can become stale after deletion
**File:** `HookCanvas.tsx`  
If a selected node is deleted via ReactFlow delete handling, `selectedNode` state is not reconciled against `nodes`.

**Impact:** config panel can show/edit a node that no longer exists; updates become no-ops and UX breaks.  
**Fix:** on nodes change (or in an effect), if `selectedNode.id` no longer exists, clear selection.

---

### 4) Node IDs via `Date.now()` can collide
**File:** `HookCanvas.tsx`  
`id: \`${nodeType}-${Date.now()}\`` can collide if multiple drops occur within the same millisecond (or across multiple clients if merged).

**Impact:** ReactFlow node identity corruption.  
**Fix:** use `crypto.randomUUID()` (best) or an incrementing counter stored in a ref.

---

### 5) Generator trusts runtime types from parsed JSON too much (timeout/headers)
**File:** `canvasGenerator.ts`  
`hook.timeout` and `hook.headers` are assumed to match their TS interfaces, but parsed JSON can contain wrong types; these values are stored into node data and later stringified/fingerprinted.

**Impact:** inconsistent state shape; possible performance issues.  
**Fix:** runtime-type-check and sanitize `timeout` (finite number) and `headers` (string-to-string map with size limits).

---

## LOW issues

### 1) Icons passed as HTML entities in string props won’t render as intended
**File:** `NodePalette.tsx`  
`icon="&#9889;"` will render the literal characters, not ⚡. (JSX only decodes entities in text nodes, not inside string props.)

**Fix:** use unicode literals like `'\u26A1'` or inline text node, or icon components.

### 2) `reactFlowWrapper` ref is unused
**File:** `HookCanvas.tsx`  
Not harmful, but indicates incomplete drop-position logic or dead code.

### 3) Comment mismatch: connectionRules says used as `isValidConnection` prop but it isn’t
**File:** `connectionRules.ts` / `HookCanvas.tsx`  
You validate in `onConnect` only. Not incorrect, just inconsistent documentation.

---

CRITICAL: 0
HIGH: 6
MEDIUM: 5
LOW: 3
APPROVED: NO
