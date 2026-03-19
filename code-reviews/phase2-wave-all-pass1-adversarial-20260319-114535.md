## CRITICAL

### 1) `compileCanvasToHooks` is vulnerable to prototype-key collisions → hard crash / persistent DoS
**Where:** `src/lib/canvasCompiler.ts`

**Bug:** `result.hooks` is a plain object (`{}`) and you test existence via:
```ts
if (result.hooks[event]) {
  result.hooks[event].push(...groups);
} else {
  result.hooks[event] = groups;
}
```
If a trigger’s `event` is any property that already exists on `Object.prototype` (e.g. `"toString"`, `"constructor"`, `"hasOwnProperty"`, `"__proto__"`), then `result.hooks[event]` resolves to a function/object from the prototype chain (truthy), and `.push(...)` throws.

**Impact:**
- A *valid JSON* hooks file can permanently brick the Canvas view (and possibly the whole app if the exception isn’t caught by an error boundary).
- This is **persistent** if the malicious event enters saved `hooksJson`/canvas state.

**PoC (valid JSON, no schema required):**
```json
{
  "hooks": {
    "toString": [
      { "hooks": [ { "type": "command", "command": "echo pwn" } ] }
    ]
  }
}
```
Open Canvas (or any action that triggers `compileCanvasToHooks`) → crash.

**Fix:**
- Use a null-prototype dictionary and own-property checks:
  - `const hooks: Record<string, HookGroup[]> = Object.create(null);`
  - Replace `if (result.hooks[event])` with `if (Object.hasOwn(result.hooks, event))`
- Additionally, validate `event` against a strict allowlist (your `HOOK_EVENTS`) before using it as a key.

---

### 2) `generateCanvasFromHooks` is not actually “graceful” on malformed (but valid) JSON → crash-on-load DoS
**Where:** `src/lib/canvasGenerator.ts`

**Bug:** The code assumes `groups` elements are objects and `group.hooks` is iterable and that each hook is an object. Multiple places will throw on `null`/non-object values:

Examples:
- `for (const group of groups as HookGroupInput[]) { const hookList = group.hooks ?? []; }` → `group` can be `null` → `Cannot read properties of null`
- `buildActionData(hook)` expects `hook` object; if `hook` is `null` → `hook.type` throws
- If `group.hooks` is a number/object without `.length`, you hit runtime errors

**Impact:**
- Any attacker-controlled `hooksJson` (imported file, synced profile, shared agent config, etc.) can crash Canvas initialization reliably.

**PoCs:**
1) Minimal crash:
```json
{ "hooks": { "PreToolUse": [ null ] } }
```

2) Hook-level crash:
```json
{ "hooks": { "PreToolUse": [ { "hooks": [ null ] } ] } }
```

**Fix:**
- Strong runtime guards:
  - Ensure `groups` is `Array.isArray(groups)`
  - Ensure each `group` is a non-null object
  - Ensure `group.hooks` is `Array.isArray(group.hooks)`
  - Ensure each hook is a non-null object before reading properties
- Wrap generation in a try/catch at callsite too (defense in depth), returning `null` instead of throwing.

---

## HIGH

### 3) Drag-and-drop accepts arbitrary JSON payloads → injection into node types/data + DoS vectors
**Where:** `src/components/agent-builder/HookCanvas.tsx` (`onDrop`)

**Bug:** The drop handler trusts `application/reactflow` payload entirely:
```ts
const { nodeType, data } = JSON.parse(raw);
...
type: nodeType,
data,
```
No validation that:
- `nodeType` is one of `trigger|condition|action`
- `data` has the expected shape
- sizes/lengths are bounded

**Impact:**
- Easy path to introduce the CRITICAL compiler crash: drop a trigger with `data.event="toString"` or similar, or mutate later via saved state.
- Performance DoS: drop nodes with extremely large `data` objects/strings; those will be carried into state and repeatedly `JSON.stringify`’d in `notifyChange`.

**Fix:**
- Validate `nodeType` against a strict set and validate `data` with a schema (zod/io-ts).
- Enforce max lengths (command/url/prompt/description/matcher), max object depth, max node count.

---

### 4) Unbounded input sizes (hooks JSON import, canvas JSON load, DnD) → UI freeze / memory exhaustion
**Where:**
- `HooksTab.handleImport` (reads entire file into memory, no size cap)
- `HookCanvas` loads `hooksCanvasJson` and directly `setNodes/setEdges`
- `notifyChange` does `compileCanvasToHooks` + `JSON.stringify({nodes,edges})` repeatedly

**Impact:**
- Large JSON file can lock the renderer thread (Tauri/desktop makes this especially painful).
- A malicious `hooksCanvasJson` could contain tens of thousands of nodes/edges and stall on load or on each debounced save.

**Fix:**
- Enforce file size limits before reading (`file.size`)
- Enforce max nodes/edges and truncate/reject
- Consider incremental parsing/worker for huge payloads

---

### 5) Unsafe-by-design execution payloads (command/http hooks) can be imported with no warning/consent gating
**Where:** `HooksTab.handleImport` and generally the model

**Issue:** Import accepts any valid JSON and stores it. If agent profiles/hook configs can be shared/synced across users or downloaded, this is a classic “config-as-code” supply chain vector:
- `command` hooks are effectively local code execution (by the agent runtime)
- `http` hooks can do SSRF / internal network probing / data exfiltration
- regex `matcher` can be crafted for ReDoS in downstream engine

**Impact:** In environments with any untrusted profile sharing, this becomes a practical route to RCE/SSRF when the agent runs hooks.

**Fix:**
- Prominent warning + diff/preview on import
- Policy gates: disable `command` hooks unless user explicitly enables “Allow local commands”
- Allowlist URL schemes/domains, or at least warn on localhost/private IP ranges
- Validate/limit regex complexity if possible (downstream mitigation may be required)

---

### 6) HTTP header injection / request smuggling risk via unvalidated `headers`
**Where:** `canvasCompiler.buildHookEntry` passes through `data.headers` as-is.

**Issue:** UI doesn’t expose `headers`, but they can arrive from:
- imported `hooksJson` → `generateCanvasFromHooks` → node data → saved canvas → compile back
- crafted `hooksCanvasJson`/DnD

If the agent runtime later serializes these directly into HTTP headers, attacker can attempt:
- CRLF injection (`"X": "a\r\nInjected: b"`)
- illegal header names

**Fix:**
- Validate header names/values strictly (no CTLs, no CR/LF)
- Consider dropping headers entirely from the canvas model unless explicitly supported with validation UI

---

## MEDIUM

### 7) Canvas state load is unvalidated → ReactFlow/component assumptions can be violated (crash or weird behavior)
**Where:** `HookCanvas` mount effect loading `hooksCanvasJson`

You `JSON.parse` and `setNodes(saved.nodes as CanvasNode[])` without checking:
- required fields (`id`, `type`, `position`)
- unique IDs
- finite numeric positions
- edges refer to existing node IDs

**Impact:** Malformed saved canvas can break rendering, selection, minimap, or trigger downstream exceptions.

**Fix:** Validate `CanvasState` with a runtime schema; reject/repair invalid nodes/edges.

---

### 8) Round-trip corruption: generator creates “empty” actions that compiler later drops
**Where:**
- `generateCanvasFromHooks` → `buildActionData` fills missing command/url/prompt with `''`
- `compileCanvasToHooks` skips actions with empty required fields (`if (!data.command) return null;` etc.)

**Impact:** Import JSON → Canvas → any change → export JSON can silently delete hooks.

**Fix:** Represent “invalid/incomplete” actions explicitly in UI and block export, or preserve them by emitting placeholders / validation errors.

---

### 9) `timeout` handling can produce `NaN` → serialized as `null` (schema corruption)
**Where:** `NodeConfigPanel` (`Number(e.target.value)`)

If `timeout` becomes `NaN`, compiler includes it (`!= null`), and `JSON.stringify` turns `NaN` into `null`. Downstream may reject or mis-handle.

**Fix:** `const t = Number(...); if (!Number.isFinite(t) || t < 0) unset/error`.

---

### 10) Duplicate edges / parallel edges can cause unintended repeated execution
**Where:** `onConnect` uses `addEdge` with no dedupe; loaded canvas can include duplicates.

**Impact:** Same action may appear multiple times in compiled hooks → repeated command/http calls.

**Fix:** Prevent duplicate (source,target) edges or dedupe during compilation.

---

### 11) Node ID generation via `Date.now()` is collision-prone
**Where:** `HookCanvas.onDrop`

Multiple drops in the same millisecond (or manipulated clocks) can produce duplicate node IDs → state corruption / wrong edge bindings.

**Fix:** `crypto.randomUUID()` or a monotonic counter stored in a ref.

---

## LOW

### 12) Connection rules are only enforced on interactive connect, not on loaded canvas
**Where:** `HookCanvas` uses `checkConnection` inside `onConnect`, but loaded edges bypass rules.

**Impact:** Confusing UI and potentially odd compilation outcomes.

**Fix:** Validate/filter edges after loading and before compiling.

---

### 13) Silent failure patterns reduce user ability to detect malicious/invalid configs
**Where:** import silently ignores invalid JSON; generator/compile “skip gracefully” in some cases

**Impact:** Makes it easier to hide payloads or cause confusing partial state.

**Fix:** Provide explicit error banners and validation diagnostics.

---

### 14) Potential UI inconsistency: `NodePalette` icons passed as HTML entities render literally
Not security, but can confuse users and reduce trust in UI.

---

CRITICAL: 2  
HIGH: 4  
MEDIUM: 5  
LOW: 3  
APPROVED: NO
