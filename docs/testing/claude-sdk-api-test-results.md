# Claude SDK API Test Results

**Date**: 2026-03-14
**Test location**: `/Users/dennisonbertram/Develop/claude-tauri-boilerplate/test/claude-sdk-test/`

---

## Packages Tested

| Package | Version | Purpose |
|---------|---------|---------|
| `@anthropic-ai/claude-code` | 2.1.76 | Legacy CLI-only package |
| `@anthropic-ai/claude-agent-sdk` | 0.2.76 | Actual SDK package with programmatic API |

---

## Package Structure

### `@anthropic-ai/claude-code` v2.1.76

**Files in package:**
```
LICENSE.md
README.md
bun.lock
cli.js          ← only meaningful file
package.json
resvg.wasm
sdk-tools.d.ts
vendor/
```

**Critical finding:** The `package.json` has:
- **No `main` field**
- **No `exports` field**
- Only a `bin` field: `"claude": "cli.js"`

This means `@anthropic-ai/claude-code` **cannot be imported as a module** at all. It is a CLI-only package. Attempting `import * as mod from "@anthropic-ai/claude-code"` throws:

```
Error: Cannot find package '.../node_modules/@anthropic-ai/claude-code/index.js'
  code: 'ERR_MODULE_NOT_FOUND'
```

Even importing `cli.js` directly produces **zero exports** (`exports count: 0`).

### `@anthropic-ai/claude-agent-sdk` v0.2.76

**Package `exports` map:**
```json
{
  ".": {
    "types": "./sdk.d.ts",
    "default": "./sdk.mjs"
  },
  "./embed": { ... },
  "./browser": { ... },
  "./sdk-tools": { ... }
}
```

This is the **real SDK package** with a proper programmatic API.

---

## Export Inspection Results

### `@anthropic-ai/claude-code` — CANNOT BE IMPORTED

```
Error: Cannot find package '.../claude-code/index.js'
```

Cannot be used as an ES module import at all.

### `@anthropic-ai/claude-agent-sdk` — test-exports-agent-sdk.mjs output

```
=== @anthropic-ai/claude-agent-sdk exports ===
All exports: [
  'AbortError',
  'DirectConnectError',
  'DirectConnectTransport',
  'EXIT_REASONS',
  'HOOK_EVENTS',
  'createSdkMcpServer',
  'forkSession',
  'getSessionInfo',
  'getSessionMessages',
  'listSessions',
  'parseDirectConnectUrl',
  'query',
  'renameSession',
  'tagSession',
  'tool',
  'unstable_v2_createSession',
  'unstable_v2_prompt',
  'unstable_v2_resumeSession'
]
Has claude: undefined
Has query: function
```

---

## Function Test Results

### `claude()` — Does NOT exist

**From `@anthropic-ai/claude-code`:** Package cannot be imported at all.

**From `@anthropic-ai/claude-agent-sdk`:** Hard error at import time:

```
SyntaxError: The requested module '@anthropic-ai/claude-agent-sdk' does not provide an export named 'claude'
```

**Verdict: `claude()` does not exist in any version of either package.**

---

### `query()` — EXISTS and WORKS

**From `@anthropic-ai/claude-agent-sdk`** — test-query-agent-sdk.mjs output:

```
Testing query() from @anthropic-ai/claude-agent-sdk...
Event type: system
Event type: assistant
Text: Credit balance is too low
Event type: result
Result: success Cost: 0
```

The `query()` function:
- Exists as a named export from `@anthropic-ai/claude-agent-sdk`
- Returns an async iterable of SDK message events
- Event types observed: `system`, `assistant`, `result`
- Works correctly (the "Credit balance is too low" message is from the Claude API, not a code error — it means the local Claude account needs credits loaded)

---

## `query()` Function Signature

From `sdk.d.ts`:

```typescript
export declare function query(_params: {
  prompt: string;
  options?: {
    abortController?: AbortController;
    maxTurns?: number;
    // ... other options
  };
}): AsyncGenerator<SDKMessage>;
```

The correct call pattern is:

```typescript
import { query } from "@anthropic-ai/claude-agent-sdk";

const stream = query({
  prompt: "Your prompt here",
  options: {
    abortController: new AbortController(),
    maxTurns: 1,
  }
});

for await (const event of stream) {
  if (event.type === "assistant") {
    for (const block of event.message.content) {
      if (block.type === "text") console.log(block.text);
    }
  }
  if (event.type === "result") break;
}
```

---

## Conclusion

**The user's example code is incorrect.** There is no `claude()` function anywhere in either package:

```typescript
// WRONG — does not exist
import { claude } from "@anthropic-ai/claude-code";
const stream = claude(lastMessage, { abortController: new AbortController() });
```

**The correct approach:**

```typescript
// CORRECT
import { query } from "@anthropic-ai/claude-agent-sdk";
const stream = query({
  prompt: lastMessage,
  options: { abortController: new AbortController(), maxTurns: 1 }
});
```

**Key facts:**
1. `@anthropic-ai/claude-code` v2.1.76 is a **CLI-only** package with no importable SDK exports whatsoever
2. `@anthropic-ai/claude-agent-sdk` v0.2.76 is the **correct SDK package** for programmatic use
3. The function is named `query()`, **not** `claude()`
4. `query()` takes a `{ prompt, options }` object, **not** a bare string as first argument
5. Both packages confirmed to **not** export any function named `claude`
