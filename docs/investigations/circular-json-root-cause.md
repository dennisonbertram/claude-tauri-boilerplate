# Root Cause Analysis: Circular JSON Serialization Bug (Issue #296)

## Summary

Sending any chat message caused a fatal error:
```
Converting circular structure to JSON
  → starting at object with constructor HTMLButtonElement
  | property __reactFiber$... → object with constructor FiberNode
  --- property stateNode closes the circle
```

Also seen: `TypeError: Cannot read properties of undefined (reading 'state') at Chat.makeRequest`

## Root Cause

Two related issues in the chat submit pipeline:

### 1. DOM Event Leaking Through onSubmit (Primary Cause)

**File:** `apps/desktop/src/components/chat/ChatInput.tsx`

The `onSubmit` prop was typed as `(e: FormEvent) => void`, and two code paths passed DOM event objects through it:

**Path A — Enter key press (line 437):**
```typescript
// BEFORE (broken)
if (e.key === 'Enter' && !e.shiftKey) {
  e.preventDefault();
  if (input.trim() && !isLoading) {
    onSubmit(e as unknown as FormEvent); // <-- KeyboardEvent with DOM refs
  }
}
```

This cast a `KeyboardEvent<HTMLTextAreaElement>` to `FormEvent`. The event's `target` and `currentTarget` properties point to the `HTMLTextAreaElement` DOM node.

**Path B — Form native submit (button click):**
```tsx
<form onSubmit={onSubmit} ...>
```

When the Send button (`type="submit"`) is clicked, the browser fires a native `SubmitEvent`. React wraps this in a `FormEvent` where `e.nativeEvent.submitter` is the `HTMLButtonElement` (the Send button). React attaches `__reactFiber$` internal properties to rendered DOM nodes, creating a circular reference chain:

```
HTMLButtonElement
  → __reactFiber$abc123 (FiberNode)
    → stateNode
      → HTMLButtonElement (circular!)
```

### 2. Extraneous `attachments` Property on sendMessage (Secondary)

**File:** `apps/desktop/src/components/chat/ChatPage.tsx`

```typescript
// BEFORE (broken)
await sendMessage({
  text: payload,
  attachments: attachmentRefs,  // <-- not part of AI SDK API
} as any);
```

The `attachments` property is not part of the Vercel AI SDK's `sendMessage` type signature. While it was effectively ignored by the SDK at runtime, the `as any` cast suppressed TypeScript's type checking, masking the API mismatch and any future issues.

### Why It Manifested

The Vercel AI SDK's `DefaultChatTransport.sendMessages()` calls `JSON.stringify(body)` where `body` includes `messages: this.state.messages`. If any DOM event reference leaked into the message state (or was captured in a closure that got serialized during error handling), the circular reference in React's fiber tree would cause `JSON.stringify` to throw.

The second error (`Cannot read properties of undefined (reading 'state')`) indicates that the `Chat` instance's internal state became corrupted or the instance was garbage collected after the first error, causing cascading failures on subsequent `makeRequest` calls.

## The Fix

### ChatInput.tsx

1. Changed `onSubmit` prop type from `(e: FormEvent) => void` to `() => void`
2. Removed `FormEvent` from imports
3. Enter key handler now calls `onSubmit()` with no arguments
4. Form's `onSubmit` handler calls `e.preventDefault()` locally, then `onSubmit()`:
   ```tsx
   <form onSubmit={(e) => { e.preventDefault(); onSubmit(); }} ...>
   ```

### ChatPage.tsx

1. Changed `handleSubmit` from `async (e: React.FormEvent) => { e.preventDefault(); ... }` to `async () => { ... }`
2. Removed the unused `attachmentRefs` variable
3. Simplified `sendMessage` call: `await sendMessage({ text: payload })`

## What the Regression Tests Cover

File: `apps/desktop/src/components/chat/__tests__/ChatInput.serialization.test.tsx`

| Test | What it verifies |
|------|-----------------|
| `onSubmit prop type is () => void` | Module exports correctly, contract change is in place |
| `plain submit payload survives JSON.stringify` | The payload format ChatPage builds is serializable |
| `sendMessage payload with only text property` | No extraneous properties like `attachments` |
| `circular reference demonstration` | Proves the exact __reactFiber$ cycle causes JSON.stringify to throw |
| `composePromptWithAttachments output is a plain string` | Attachment composition produces clean strings |
| `fix prevents event object leakage` | Simulates before/after: event with circular refs vs clean payload |
| `full message array is serializable` | The complete transport body (messages + metadata) survives stringify |

## Lessons Learned / Patterns to Avoid

1. **Never pass DOM events across component boundaries for data flow.** If a parent only needs to know "submit happened", use `() => void`, not `(e: FormEvent) => void`.

2. **Avoid `as unknown as X` casts on events.** The cast `e as unknown as FormEvent` on line 437 was a code smell — it bypassed TypeScript's safety to pass an incompatible event type.

3. **Avoid `as any` on SDK calls.** The `sendMessage({ ... } as any)` suppressed the type error about `attachments` not being a valid field, hiding an API mismatch.

4. **Keep `e.preventDefault()` close to the event source.** The form's `onSubmit` handler should call `preventDefault()` before delegating to business logic, not pass the event to the business logic layer.

5. **DOM elements are never JSON-serializable** due to React's internal fiber references. Any code path that might `JSON.stringify` data must ensure no DOM node references can reach it.
