## CRITICAL

### 1) Canvas editing is *lossy* and will silently delete unsupported hooks JSON content
**What happens**
- `generateCanvasFromHooks()` only supports hook types: `command/http/prompt/agent` and only a subset of fields.
- `compileCanvasToHooks()` emits only `{type, command/url/method/headers/prompt/model/description/timeout}` and drops anything else.
- As soon as the canvas changes (including just moving nodes—see HIGH #4), `HookCanvas.notifyChange()` overwrites `draft.hooksJson` with the compiled JSON.

**Why it’s bad**
- If a user imports/has existing hooks JSON with:
  - additional action fields (body, auth, cwd, env, retry, etc.),
  - custom hook types,
  - extra metadata fields,
  - any schema nuances not modeled on the canvas,
  then opening canvas and making *any* change destroys that data with no warning/undo.

**How to reproduce**
1. Paste JSON with an extra field:
   ```json
   {"hooks":{"PreToolUse":[{"hooks":[{"type":"http","url":"https://x","headers":{"A":"B"},"body":"SECRET"}]}]}}
   ```
2. Switch to Canvas, move a node slightly.
3. Switch back to JSON: `body` is gone.

**Fix ideas**
- Treat canvas as a projection that preserves unknown fields (round-trip), or warn “Canvas mode cannot preserve unsupported fields; continuing may delete data”.
- Keep original JSON alongside compiled JSON and only replace on explicit “Apply Canvas Changes”.

---

### 2) Import safety warning for command/HTTP hooks is trivially bypassed (dangerous execution)
**What happens**
- `HooksTab.handleImport()` detects dangerous hooks by:
  ```ts
  JSON.stringify(parsed).includes('"type":"command"')
  ```
  and similarly for http.
- This misses many valid JSON encodings (whitespace, different ordering, nested structures, alternative formatting).

**Why it’s bad**
- Hooks can execute local commands / make HTTP requests. A user can import an untrusted JSON file and get *no warning* even though it contains dangerous actions.

**How to reproduce**
Import JSON containing:
```json
{"hooks":{"PreToolUse":[{"hooks":[{"type" : "command","command":"rm -rf ~"}]}]}}
```
Note the space: `"type" : "command"`. The substring check for `"type":"command"` fails → no confirmation prompt.

**Fix ideas**
- Traverse the parsed object structurally and look for `hook.type === 'command'|'http'` regardless of whitespace/serialization.
- Consider a stronger “untrusted hooks” warning on any import, with a detailed diff/summary.

---

### 3) Connecting the same Action node to multiple parents causes silent, nondeterministic data loss
**What happens**
- The UI allows multiple incoming edges to an action node (no rule prevents it).
- `compileCanvasToHooks()` uses `processedActionIds` per-trigger, and only includes each action once for that trigger based on adjacency traversal order.

**Why it’s bad**
- A user expects shared actions (fan-in) to run for multiple conditions/paths.
- Output will include it under only one group (whichever edge happens to be processed first), silently dropping the other intended execution path.

**How to reproduce**
1. Trigger → Condition A → Action X
2. Trigger → Condition B → Action X (same action node)
3. Export JSON: Action X appears only once, under either A or B (order-dependent).

**Fix ideas**
- Disallow multiple incoming edges to actions (enforce DAG “tree” shape), or
- Support fan-in explicitly by duplicating actions per parent group with stable ordering + UI warning.

---

## HIGH

### 1) Deleting a selected node leaves a “ghost” config panel editing nothing
**What happens**
- `selectedNode` is set on click, but never cleared if that node is deleted via ReactFlow delete.
- Config panel remains open; edits update `selectedNode` state but node no longer exists in `nodes`.

**Impact**
- Confusing UX + false sense of editing saved configuration.
- Potentially overwrites future nodes if IDs collide (see HIGH #5) or if selection logic changes.

**Fix**
- On nodes change, if selected node ID no longer exists, clear selection.

---

### 2) Unknown trigger events can’t be represented/retained in the config UI
**What happens**
- Generator preserves unknown events: `TriggerNodeData = { event, label: event }`.
- But `NodeConfigPanel.TriggerConfig` uses a `<select>` whose options are only `HOOK_EVENTS`.
- If `data.event` isn’t in the options, the select becomes inconsistent; user can’t keep/edit the unknown value.

**Impact**
- Opening a config panel for such a trigger nudges users toward overwriting the event, effectively destroying custom/forward-compatible events.

**Fix**
- Include the current value as an extra option when it’s not in `HOOK_EVENTS`, or use a freeform input with validation.

---

### 3) Edge count is only capped on load/generate, not during normal editing
**What happens**
- Load/generate enforces `MAX_EDGES`, but interactive `onConnect` allows unlimited edges.

**Impact**
- Users can create huge graphs that degrade performance or break serialization/debounce behavior.

**Fix**
- Enforce edge cap in `onConnect` (and provide UI feedback).

---

### 4) Moving nodes rewrites hooks JSON (semantic no-op causes destructive churn)
**What happens**
- The “structural fingerprint” includes `position`, despite the comment saying it ignores drag changes:
  ```ts
  nodes.map(n => ({ id, type, position, data }))
  ```
- Any drag triggers `notifyChange()` → recompiles hooks JSON → overwrites `draft.hooksJson`.

**Impact**
- Pure layout adjustments cause:
  - JSON to be reformatted/rewritten constantly (diff churn),
  - loss of unsupported fields (ties into CRITICAL #1),
  - potential fights with manual JSON edits.

**Fix**
- Exclude `position` from the “semantic” fingerprint and only update `hooksCanvasJson` on position changes.
- Update `hooksJson` only when semantic content changes.

---

### 5) Node IDs can collide (`Date.now()`), corrupting the graph
**What happens**
- New nodes use `id: `${nodeType}-${Date.now()}``.
- Multiple drops within the same millisecond can duplicate IDs.

**Impact**
- ReactFlow behavior becomes undefined: node overwrites, edges attach incorrectly, selection/editing affects wrong node.

**Fix**
- Use `crypto.randomUUID()` or a monotonic counter in a ref.

---

### 6) Loading `hooksCanvasJson` does not validate node/edge shape or types
**What happens**
- The loader only checks `Array.isArray` and count limits, then:
  ```ts
  setNodes(saved.nodes as CanvasNode[]);
  setEdges(saved.edges as CanvasEdge[]);
  ```
- No validation that:
  - node.type is one of `trigger/condition/action`,
  - edge endpoints exist,
  - required fields exist (`event`, `hookType`, etc.),
  - data is flat/safe (could be massive nested structures).

**Impact**
- Malformed saved canvas state can break rendering, compilation output, or degrade performance severely.

**Fix**
- Validate/sanitize loaded nodes/edges similarly to `sanitizeNodeData`, and drop/repair invalid edges.

---

### 7) Multiple user actions fail silently (import/connect/drop), causing confusing UX
**Examples**
- Invalid JSON import: `catch { /* silently ignore */ }`
- Invalid drag payload: silently ignored
- Invalid connection: silently does nothing (no reason shown despite `getInvalidConnectionReason()` existing)

**Impact**
- Users think the app is broken or that their action succeeded when it didn’t.

**Fix**
- Surface a non-blocking toast/banner with the reason and next steps.

---

## MEDIUM

### 1) Timeout number handling allows `Infinity`/`NaN` and silently corrupts JSON
**What happens**
- `NodeConfigPanel` does `Number(e.target.value)` without checking finiteness/range.
- `JSON.stringify({timeout: Infinity})` becomes `{"timeout":null}`.

**Fix**
- Clamp range, require `Number.isFinite`, show validation errors.

---

### 2) Orphaned/incomplete nodes are silently dropped from compiled output
**What happens**
- Compiler skips anything not reachable from triggers, and skips incomplete actions (`command` without command, etc.).
- No UI indicates “this node will not be included in output”.

**Impact**
- Users build a canvas that visually looks fine, but exported JSON is missing pieces.

**Fix**
- Add validation badges on nodes + an “Output warnings” panel listing excluded nodes and why.

---

### 3) Condition with empty matcher becomes unconditional group (surprising semantics)
**What happens**
- Trigger → Condition (matcher empty) → Action produces a group without `matcher`.

**Impact**
- Users might believe the condition is active but it’s effectively “match all”.

**Fix**
- Treat empty matcher as invalid and exclude (with warning), or require matcher input before allowing outgoing connections.

---

### 4) Output ordering can be unstable (edge insertion order dependent)
**What happens**
- Groups and hooks are produced in adjacency list order, which can vary based on user editing history.

**Impact**
- Non-deterministic JSON output → noisy diffs, hard to review changes.

**Fix**
- Sort connected nodes deterministically (e.g., by y-position then id) before emitting.

---

### 5) HookCanvas ignores prop changes while mounted (potential overwrite races)
**What happens**
- Initial load effect has `[]` deps and won’t respond if parent updates `hooksJson` / `hooksCanvasJson` while Canvas view is open.

**Impact**
- External updates (autosave sync, profile switching, collaborative edits) could be overwritten on next debounce tick.

**Fix**
- Add controlled “source of truth” logic: if props change, prompt to reload/merge unless local dirty state is empty.

---

### 6) Structural fingerprint uses expensive `JSON.stringify` of full data every change
**Impact**
- With near-limit nodes (200) and large strings, frequent stringification can cause UI lag.

**Fix**
- Hash only semantic fields, or incrementally track dirty flags; avoid serializing full node data each render.

---

### 7) JSON view only validates “is JSON”, not “is hooks schema”
**Impact**
- Users can save “valid JSON” that won’t generate canvas or won’t execute as expected; no guidance.

**Fix**
- Add schema validation + actionable errors (missing `hooks`, wrong shape, unknown keys).

---

## LOW

### 1) NodePalette icons passed as HTML entities render literally
**What happens**
- `icon="&#9889;"` then `<span>{icon}</span>` renders the literal text `&#9889;` rather than ⚡.

**Fix**
- Pass actual characters (`'⚡'`, `'⚙'`) or render via `dangerouslySetInnerHTML` (prefer characters).

---

### 2) Delete key handling is narrow
- `deleteKeyCode="Delete"` may not cover Backspace or platform differences.

---

### 3) Import size cap has no UX besides `alert()`
- Consider inline error/toast and mention current size.

---

### 4) Confirm dialogs (`window.confirm`) are blocking and repetitive
- Consider a safer “dangerous hooks” banner with per-session acknowledgment.

---

CRITICAL: 3
HIGH: 7
MEDIUM: 7
LOW: 4
APPROVED: NO
