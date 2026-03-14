# Phase 4: SQLite Persistence

## Overview

Added SQLite database persistence for chat sessions and messages using `bun:sqlite`. This provides the data layer for storing conversation history in the desktop app.

## What Was Built

### Schema (`apps/server/src/db/schema.ts`)

Two tables:

- **sessions** - Stores chat sessions with id, title, optional claudeSessionId, and timestamps
- **messages** - Stores messages belonging to sessions with role (user/assistant), content, and timestamps. Foreign key to sessions with ON DELETE CASCADE.

### DB Module (`apps/server/src/db/index.ts`)

CRUD operations using `bun:sqlite`:

- `createDb(path?)` - Initializes DB with WAL mode, foreign keys, and schema. Uses `:memory:` for tests, `~/.claude-tauri/data.db` for production.
- `createSession(db, id, title?)` - Creates a session (default title: "New Chat")
- `getSession(db, id)` - Retrieves a session by ID (returns null if not found)
- `listSessions(db)` - Lists all sessions, newest first
- `deleteSession(db, id)` - Deletes session and cascade-deletes its messages
- `updateSessionTitle(db, id, title)` - Updates title and updated_at timestamp
- `updateClaudeSessionId(db, sessionId, claudeSessionId)` - Links a Claude SDK session
- `addMessage(db, id, sessionId, role, content)` - Adds a message to a session
- `getMessages(db, sessionId)` - Gets messages for a session, ordered by createdAt ASC

All functions map snake_case DB columns to camelCase JS objects.

### Sessions Routes (`apps/server/src/routes/sessions.ts`)

HTTP API using a factory function `createSessionsRouter(db)` for testability:

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/sessions` | List all sessions (newest first) |
| POST | `/api/sessions` | Create a new session |
| GET | `/api/sessions/:id/messages` | Get messages for a session |
| DELETE | `/api/sessions/:id` | Delete a session (cascades) |

### App Integration (`apps/server/src/app.ts`)

Sessions router wired into the main Hono app with `app.route('/api/sessions', createSessionsRouter(db))`.

## Test Coverage

### DB Tests (`apps/server/src/db/db.test.ts`) - 16 tests

- Create/retrieve sessions
- Default title behavior
- Non-existent session returns null
- List sessions empty and ordered
- Delete session and cascade delete messages
- Delete non-existent session (no throw)
- Update title and timestamp
- Update claudeSessionId and timestamp
- Add/retrieve messages
- Message ordering by createdAt
- Empty messages array
- Invalid role rejection (CHECK constraint)
- Foreign key violation rejection

### Route Tests (`apps/server/src/routes/sessions.test.ts`) - 12 tests

- GET /api/sessions returns empty array
- GET /api/sessions returns sessions after creation
- POST /api/sessions with title
- POST /api/sessions with default title
- POST /api/sessions with no body
- GET /api/sessions/:id/messages returns messages
- GET /api/sessions/:id/messages returns empty for no messages
- GET /api/sessions/:id/messages returns 404 for non-existent session
- DELETE /api/sessions/:id deletes and returns ok
- DELETE /api/sessions/:id cascade-deletes messages
- DELETE /api/sessions/:id returns 404 for non-existent session

## Design Decisions

- **Factory function for router** - `createSessionsRouter(db)` accepts a DB instance, making it easy to inject `:memory:` databases in tests without mocking.
- **ID generation in route layer** - `crypto.randomUUID()` is called in routes, not in the DB module. DB functions accept IDs as parameters, keeping them pure and testable.
- **WAL mode** - Enables concurrent reads during writes, better performance for a desktop app.
- **Snake_case in DB, camelCase in JS** - Mapper functions handle the translation at the boundary.

## Files Changed

- `apps/server/src/db/schema.ts` - New: SQL schema
- `apps/server/src/db/index.ts` - New: DB initialization and CRUD
- `apps/server/src/db/db.test.ts` - New: 16 DB unit tests
- `apps/server/src/routes/sessions.ts` - New: Sessions HTTP routes
- `apps/server/src/routes/sessions.test.ts` - New: 12 route integration tests
- `apps/server/src/app.ts` - Modified: Wired in sessions router and DB
