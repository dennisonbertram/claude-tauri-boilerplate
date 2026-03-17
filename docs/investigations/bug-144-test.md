# Bug #144: New Chat / /new Command — Manual Browser Test Results

**Date:** 2026-03-17
**Tester:** Claude Code (browser automation)
**App URL:** http://localhost:1420/

---

## Summary

The "New Chat" button and `/new` command work correctly in most cases, but there is a **regression**: when a **forked session** is active, clicking "New Chat" (or pressing Cmd+N) silently does nothing. The session is incorrectly identified as "truly empty" due to a SQLite timestamp precision bug in the server-side fork logic.

---

## Test Results

### Test 1: New Chat button from a normal session — PASS

**Steps:**
1. Selected "My Test Session" (has messages, `claudeSessionId` set)
2. Clicked "New Chat" button

**Result:** A new session "Sparkly Biscuit" was created and selected. The chat area immediately showed the "Start a conversation" empty state with no old messages visible. Input placeholder changed to "Type a message... (/ for commands)". **Correct behavior.**

---

### Test 2: /new command from a session with messages — PASS

**Steps:**
1. Selected "My Test Session" (has messages)
2. Clicked the input field, typed `/`
3. Command palette appeared showing: `/clear`, `/new`, `/help`, `/compact`, `/settings`
4. Clicked `/new` from the palette

**Result:** A new session "Cozy Cupcake" was created and selected. Chat area shows empty state. **Correct behavior.**

---

### Test 3: New Chat button from a fork session — FAIL (BUG)

**Steps:**
1. Selected "My Test Session (fork)" (has 5 messages, visible in chat area)
2. Clicked "New Chat" button (multiple times)
3. Also tried Cmd+N keyboard shortcut

**Result:** Nothing happened. No new session was created. The old messages remained visible. The button appeared to receive the click but the handler silently returned without action.

---

## Root Cause Analysis

### The Guard Logic in `handleNewChat` (App.tsx, lines 96–110)

```typescript
const handleNewChat = async () => {
  const activeSession = sessions.find(s => s.id === activeSessionId);
  const isTrulyEmpty = activeSession &&
    activeSession.updatedAt === activeSession.createdAt &&
    !activeSession.claudeSessionId;
  if (activeSessionId !== null && isTrulyEmpty) {
    return;  // <-- silently bails out
  }
  await createSession();
  setActiveSessionHasMessages(false);
};
```

The intent is: if there's already a truly-empty new session active, don't create another one (avoid duplicate empty sessions piling up). The condition uses two signals:
- `updatedAt === createdAt` — session was never modified
- `claudeSessionId === null` — no Claude conversation started yet

### The Problem: SQLite Timestamp Precision

When a fork session is created, the server does this (sessions.ts, lines 107–126):

```typescript
const forkedSession = createSession(db, newId, title);  // sets created_at = datetime('now')

for (const msg of messagesToCopy) {
  addMessage(db, crypto.randomUUID(), newId, msg.role, msg.content);
}

// Touch updated_at so the session is not mistaken for a "truly empty" session
if (messagesToCopy.length > 0) {
  db.prepare(`UPDATE sessions SET updated_at = datetime('now') WHERE id = ?`).run(newId);
}
```

The problem: **`datetime('now')` in SQLite has only second-level precision.** Both `createSession` (which sets `created_at`) and the subsequent `UPDATE sessions SET updated_at` execute within the same wall-clock second. They both resolve to the same timestamp string (e.g., `"2026-03-17 05:53:25"`).

### Confirmed from Live API Data

```json
{
  "id": "7f279826-77d0-48b6-8332-6c3fb79a7b4e",
  "title": "My Test Session (fork)",
  "claudeSessionId": null,
  "createdAt": "2026-03-17 05:53:25",
  "updatedAt": "2026-03-17 05:53:25"   <-- identical to createdAt
}
```

This fork has **5 messages** (confirmed via API), but `updatedAt === createdAt` makes `isTrulyEmpty` return `true`. The New Chat handler then returns early, silently doing nothing.

---

## Notification Toast Persistence Bug (Secondary Issue)

During testing, "Session exported" toasts (from earlier export actions) persisted indefinitely in the bottom-right corner — they did not auto-dismiss. This is a separate UI bug: the `toast.success()` calls in `exportSession` don't set a duration, so they either use the default (which should auto-dismiss) or something is preventing dismissal. This did not block the "New Chat" button click but was visually distracting.

---

## Proposed Fix

The fix should be on the **server side** in the fork endpoint. Instead of using `datetime('now')` for both `created_at` and the `updated_at` touch, use `datetime('now', '+1 second')` or simply set `updated_at` to a value one second after `created_at`:

```sql
-- Option A: explicit +1 second offset
UPDATE sessions SET updated_at = datetime('now', '+1 second') WHERE id = ?

-- Option B: always touch updated_at on fork (even for empty forks)
-- and use current time with a guaranteed-different value by tracking created_at
```

Alternatively, the `isTrulyEmpty` guard in `handleNewChat` could be changed to not rely on timestamp comparison, and instead track "has this session ever been edited or had messages added" via a dedicated boolean or count check:

```typescript
// Alternative: check message count directly, not timestamp equality
// (requires fetching messages or storing message_count on session)
```

The simplest safe fix is to change the guard to also skip the early-return if the session title contains "(fork)" — but that's fragile. The cleanest fix is the `+1 second` approach on the server.

---

## Files Examined

- `/Users/dennisonbertram/Develop/claude-tauri-boilerplate/apps/desktop/src/App.tsx` — `handleNewChat` guard logic (lines 96–110)
- `/Users/dennisonbertram/Develop/claude-tauri-boilerplate/apps/server/src/routes/sessions.ts` — fork endpoint (lines 85–130), `updated_at` touch logic
- `/Users/dennisonbertram/Develop/claude-tauri-boilerplate/apps/desktop/src/hooks/useSessions.ts` — session state management

---

## Conclusion

| Feature | Status |
|---------|--------|
| New Chat button (normal session) | PASS |
| /new command (normal session) | PASS |
| Command palette opens on `/` | PASS |
| New Chat button (fork session) | FAIL — silently does nothing |
| Cmd+N shortcut (fork session) | FAIL — silently does nothing |
| Console errors during testing | None |
| Notification toast auto-dismiss | FAIL — toasts persist indefinitely |
