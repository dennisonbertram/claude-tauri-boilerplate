## CRITICAL

1) **Two-source-of-truth desync (hooksJson vs hooksCanvasJson) causes silent overwrite/data loss**
- **What happens:** `HookCanvas` always prefers `hooksCanvasJson` on mount (Priority 1) and ignores `hooksJson` if canvas JSON exists. But the JSON textarea/import flow in `HooksTab` updates **only** `hooksJson` and leaves `hooksCanvasJson` untouched.
- **Repro (normal usage):**
  1. Build something in Canvas (this writes `hooksCanvasJson`).
  2. Switch to JSON view and edit JSON (or Import JSON).
  3. Switch back to Canvas.
  4. Canvas loads the *old* graph from `hooksCanvasJson` (not your edited/imported JSON).
  5. Make any small change on canvas → debounced `compileCanvasToHooks` runs → **your edited/imported `hooksJson` gets overwritten** by the stale canvas-derived JSON.
- **Why it’s bad:** user believes they updated hooks via JSON/import, but the next canvas interaction reverts it with no warning.
- **Fix direction:** treat one representation as canonical (usually `hooksJson`), or store a hash/timestamp and load whichever is newer; if `hooksJson` is edited/imported, either regenerate canvas state or clear `hooksCanvasJson`.

2) **Debounced `onChange` can fire after unmount/view-switch and overwrite user edits**
- **What happens:** `notifyChange` is debounced (500ms) but there’s **no cancellation/flush on unmount**.
- **Repro:**
  1. In Canvas, move a node (starts debounce timer).
  2. Immediately switch to JSON view and start typing.
  3. The pending debounce fires and calls `onChange({ hooksJson: compiled... })` → **overwrites what you just typed** (or partially typed).
- **Fix direction:** cancel pending debounce on unmount; optionally flush immediately on view switch; or gate updates so Canvas can’t write while JSON view is active.

---

## HIGH

1) **Unknown/new hook events are silently dropped by compiler**
- `generateCanvasFromHooks` will create triggers for *any* event keys found in JSON.
- `compileCanvasToHooks` then filters triggers to `HOOK_EVENTS` only:
  ```ts
  if (!HOOK_EVENTS.includes(event as any)) continue;
  ```
- **Result:** any event not in the current UI constant (future spec additions, custom events) appears on canvas but is **omitted on save/compile**, causing data loss.
- **Fix direction:** don’t hard-filter to `HOOK_EVENTS` when compiling; validate but preserve unknown events (or at least warn loudly and block save).

2) **Loading saved canvas state can produce corrupted/blank canvas and still apply edges**
- In HookCanvas init, if `saved.nodes.length > MAX_NODE_COUNT`, nodes are not set **but edges are still set** and the effect `return`s early.
- **Result:** blank canvas (no nodes) with dangling edges; any subsequent change can compile to `{ hooks: {} }` and overwrite real config.
- **Fix direction:** if nodes exceed limit, either (a) reject the entire saved state with a visible error and don’t set edges, or (b) truncate nodes and also filter edges to existing node IDs.

3) **No meaningful cap/guardrails when generating canvas from hooks JSON**
- `generateCanvasFromHooks` can create an unbounded number of nodes/edges from a (still <=500KB) JSON file.
- **Result:** UI freeze/crash on import/open canvas with large hook arrays.
- **Fix direction:** enforce node/edge caps during generation (and show an error), or progressively render.

4) **Duplicate/multi-parent connections can duplicate hook execution without warning**
- React Flow allows multiple incoming edges to the same Action node (no restrictions shown).
- Compiler will include that action once per parent path → duplicated `hooks` entries → duplicated command/http execution.
- **Fix direction:** enforce single inbound edge per action (and maybe per condition), prevent duplicate edges, and/or dedupe actions in compilation per group.

5) **Round-trip loses grouping semantics for multiple “no matcher” groups**
- Compiler collapses all trigger→action edges into a **single** `noMatcherGroup` per trigger:
  ```ts
  let noMatcherGroup = groups.find((g) => g.matcher === undefined);
  ```
- If original JSON has multiple groups without matcher, canvas→compile merges them and can reorder (edge order-dependent).
- **Fix direction:** represent separate “no matcher” groups explicitly (e.g., a “Group” node) or preserve grouping by encoding group identity.

---

## MEDIUM

1) **Timeout number handling allows NaN/Infinity/negative → corrupted JSON**
- `Number(e.target.value)` can produce `NaN`/`Infinity`. `JSON.stringify(Infinity)` becomes `null`, silently changing meaning.
- **Fix direction:** validate `Number.isFinite`, clamp to >=0 integer, and show inline error.

2) **Sanitization/limits only apply to drag-drop templates, not user edits**
- `sanitizeNodeData` limits strings to 10k, but `onUpdateNode` merges raw input with no limit.
- **Impact:** paste megabytes into Prompt/Command → sluggish UI, huge saved canvas JSON.
- **Fix direction:** apply length limits (and/or trimming) in `onUpdateNode` or per field.

3) **Importing invalid JSON fails silently**
- `handleImport` catches parse errors and does nothing (“silently ignore”).
- **Fix direction:** show an error toast/dialog with parse failure info.

4) **Palette icons for Trigger/Condition likely render as literal `&#9889;` / `&#9881;`**
- Because they’re passed as strings and rendered as `{icon}` (not as an entity in JSX).
- **Fix direction:** pass the actual character (e.g. `"⚡"`, `"⚙"`) or render with `dangerouslySetInnerHTML` (less ideal).

5) **Max node count feedback is console-only**
- On drop when `nodes.length >= MAX_NODE_COUNT`, it only `console.warn`.
- **Fix direction:** show UI feedback (toast) and explain the limit.

6) **Selected node can become “ghost-selected” after deletion**
- `selectedNode` isn’t cleared when a node is deleted via ReactFlow changes.
- **Impact:** config panel may show/edit a node that no longer exists (edits become no-ops).
- **Fix direction:** on nodes change, if selected id no longer exists, clear selection.

7) **“Valid JSON” badge is misleading (no schema validation)**
- It only checks `JSON.parse`, not hook schema validity.
- **Fix direction:** validate shape (`hooks`, arrays, required fields) and show schema errors.

8) **HTTP method defaults inconsistent (GET vs POST)**
- Palette HTTP default: `GET`
- Generator default when missing: `POST`
- **Impact:** importing JSON without method then round-tripping can change behavior.
- **Fix direction:** align defaults with Claude Code spec and keep consistent across palette/generator/compiler.

9) **No user feedback for invalid connections**
- Invalid connections are just ignored; `getInvalidConnectionReason` exists but isn’t used.
- **Fix direction:** use `isValidConnection` prop and show reason on invalid drop.

---

## LOW

1) **Node IDs via `Date.now()` can collide**
- Rapid drops within the same millisecond can produce duplicate IDs.
- **Fix direction:** use a monotonic counter, `crypto.randomUUID()`, or nanoid.

2) **Delete key handling may be inconsistent across platforms**
- `deleteKeyCode="Delete"` only; many expect Backspace too.
- **Fix direction:** support both.

3) **Some node previews can overflow/clip confusingly**
- Condition matcher isn’t truncated; very long regex can break layout.
- **Fix direction:** truncate/tooltip long values.

4) **Dead code / unused ref**
- `reactFlowWrapper` is unused in HookCanvas.

---

CRITICAL: 2  
HIGH: 5  
MEDIUM: 9  
LOW: 4  
APPROVED: NO
