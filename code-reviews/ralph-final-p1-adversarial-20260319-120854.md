## CRITICAL

### 1) Consent/guardrail bypass for “dangerous” hooks (command/http) via preloaded JSON (profile/shared state)
**Where**
- `HooksTab` only warns on **Import JSON** (`handleImport`) by searching for `"type":"command"` / `"type":"http"`.
- `HookCanvas` warns only on **drag-drop creation** (`onDrop`) for `hookType === 'command'|'http'`.
- **No warning** when:
  - opening an existing `draft.hooksJson` / `draft.hooksCanvasJson` coming from storage/server,
  - switching to canvas view which calls `generateCanvasFromHooks(hooksJson)` and builds command/http nodes silently,
  - loading `hooksCanvasJson` which can already contain command/http actions.

**Why it’s bad**
If agent profiles can be shared/synced/loaded from remote (common in “agent builder” products), a malicious profile can include command/http hooks. The UI’s “dangerous hook” confirmation can be completely bypassed because it’s only enforced for two creation paths (import and drag-drop), not for existing persisted state.

**Practical exploit flow**
1. Attacker provides a profile with `hooksCanvasJson` containing an `action` node `{hookType:"command", command:"<payload>"}` but a benign-looking `hooksJson` (or even empty).
2. User opens the profile and switches to **Canvas**.
3. Any subsequent edit (even just moving a node; positions are included in the “structural fingerprint”) triggers `notifyChange` → `compileCanvasToHooks` → updates `hooksJson` and may get saved/synced.
4. Later, when hooks run in Claude Code agent events, attacker-controlled commands/HTTP execute.

**Fix**
- Treat command/http hooks as a capability requiring explicit enablement at the profile/session level.
- On load (both `hooksJson` and `hooksCanvasJson`), detect dangerous hooks and show a blocking interstitial until acknowledged.
- Consider a “dangerous hooks disabled” mode where command/http are stripped unless explicitly enabled.

---

## HIGH

### 2) Untrusted `hooksCanvasJson` is loaded with no schema validation/sanitization → persistent DoS/crash + data integrity attacks
**Where**
- `HookCanvas` mount effect: `JSON.parse(hooksCanvasJson)` then `setNodes(saved.nodes as CanvasNode[]); setEdges(saved.edges as CanvasEdge[]);`
- Only checks array existence and counts (`MAX_NODE_COUNT`, `MAX_EDGES`). No validation of:
  - node shape, `type`, `id` uniqueness/length,
  - `position` numeric sanity,
  - `data` types (string vs object), depth, key safety.

**Impact**
- **Persistent crash / bricking the editor**: attacker can craft node `data` that makes compiler throw.
  - Example: condition node `data.matcher = 1` (number). In `compileCanvasToHooks`:
    ```ts
    if (condData.matcher) group.matcher = condData.matcher.slice(...)
    ```
    `1.slice` throws → debounced `notifyChange` will throw on next structural update.
- **Severe UI freeze/memory blow**: attacker can include huge nested objects/arrays in `node.data` because there’s no “flat-only” enforcement on load. Your structural fingerprint does `JSON.stringify(...data: n.data...)` on every change, so deep/large `data` can lock up the renderer.
- **Integrity mismatch**: duplicate node IDs in loaded canvas can cause `nodeById` map overwrites in the compiler, compiling hooks from a different node than what the user thinks they’re seeing.

**Fix**
- Validate `hooksCanvasJson` with a strict schema (zod/io-ts) and reject/sanitize:
  - allow only known node types, require unique IDs, enforce `position` finite bounds,
  - enforce `data` keys/types (string/number/boolean only) + length limits,
  - strip dangerous keys (`__proto__`, `constructor`, etc.).
- Wrap compilation in `try/catch` inside `notifyChange` to prevent a single bad node from breaking the app.

---

### 3) Edge-order–dependent compilation allows bypassing conditions (unintended unconditional execution)
**Where**
- `compileCanvasToHooks` tracks `processedActionIds` per trigger and iterates `connectedIds = adjacency.get(trigger.id)`.
- If an `action` node has **multiple incoming edges** (valid in ReactFlow), compilation semantics depend on edge ordering:
  - If `Trigger → Action` is seen before `Trigger → Condition → Action`, the action becomes an unconditional group and the conditioned path is skipped.

**Exploit**
A malicious `hooksCanvasJson` can include both edges (and order them) so a command/http hook runs without the intended matcher condition, even if the diagram visually “looks” conditioned at a glance.

**Fix**
- Enforce a strict graph constraint: an `action` must have exactly one parent (either a trigger or a condition).
- Or compile *both* paths explicitly and warn on multi-parent actions instead of silently picking one based on edge order.

---

### 4) `generateCanvasFromHooks` can be used for DoS (no early cutoff while parsing huge hooks JSON)
**Where**
- `generateCanvasFromHooks` builds `nodes`/`edges` for *all* groups/hooks, then truncates at the end.
- No limit on input size; no early stop when `nodes.length` exceeds limits.

**Impact**
A very large but valid `hooksJson` can freeze the UI when switching to canvas view (or on mount regeneration path).

**Fix**
- Enforce a maximum `hooksJson` length before parsing/generating.
- Stop generating once node/edge caps are reached (early break).

---

## MEDIUM

### 5) Runtime edge count is not capped (MAX_EDGES only applied on load/generation)
**Where**
- `HookCanvas.onConnect` adds edges with no limit; user can create far more than 400 edges.

**Impact**
Large edge counts can degrade performance and produce massive `hooksCanvasJson`/`hooksJson`.

**Fix**
- Enforce `MAX_EDGES` in `onConnect` and on edges changes.

---

### 6) Prototype-pollution risk surface from unsafe key handling in multiple places
**Where**
- `sanitizeNodeData` does not block keys like `__proto__` / `constructor`.
- `onUpdateNode` merges with object spread: `{ ...n.data, ...newData }`.

**Impact**
Depending on JS engine/runtime hardening, crafted data with `__proto__` keys can lead to prototype mutation or at minimum weird object shapes (e.g., null-proto) that break assumptions elsewhere.

**Fix**
- Reject/strip dangerous keys everywhere you accept untrusted objects (canvas load, drag-drop, generator output).
- Consider constructing `data` objects with `Object.create(null)`.

---

### 7) Compiler emits unvalidated types for hook fields (schema corruption → downstream crashes/odd behavior)
**Where**
- `buildHookEntry` checks only truthiness, not type:
  - `entry.command = data.command;` (could be object/number)
  - `entry.url = data.url;` etc.

**Impact**
A malicious canvas state can output hooks JSON with invalid types. If the Claude Agent SDK assumes strings and performs string operations, this can crash or misbehave (best case: hooks ignored; worst case: unexpected coercions).

**Fix**
- Enforce types (`typeof === 'string'`) and lengths for all hook fields in the compiler before emitting.

---

## LOW

### 8) Node IDs based on `Date.now()` are collision-prone and predictable
**Where**
- `HookCanvas.onDrop`: `id: \`${nodeType}-${Date.now()}\``

**Impact**
Fast drops (or automated event injection) can collide IDs, causing ReactFlow/node map confusion and incorrect compilation.

**Fix**
- Use a UUID (`crypto.randomUUID()`) or a monotonic counter stored in state/ref.

---

### 9) Silent failure on invalid import hides issues
**Where**
- `handleImport` catches and “silently ignore(s)” invalid JSON.

**Impact**
User can’t tell if an import failed due to tampering/encoding errors; not a direct exploit but harms recovery/forensics.

**Fix**
- Surface an error message.

---

CRITICAL: 1  
HIGH: 4  
MEDIUM: 3  
LOW: 2  
APPROVED: NO
